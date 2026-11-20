// -----------------------------------------------------------------------------
// The HungaroMet service: where the data is read (location, station, county),
// when it is read (each source at its own pace), and what Gladys receives
// (devices, states, "new warning" scene events, the connection status).
//
// Pace of the sources, all public files of odp.met.hu (see docs, "Limits"):
//   - station metadata: at setup, then once a day;
//   - 10-minute observations (one file for every station): every cycle;
//   - 3-hour warnings: the index page every cycle, the file when a new one
//     is issued;
//   - outlook (today, tomorrow, the day after): index pages every 30 minutes,
//     the files when new ones are issued (4 to 6 times a day).
// About 20 small requests an hour at the default pace of 10 minutes.
// -----------------------------------------------------------------------------

import { areaPlatformId, buildDevices, stationStates, warningStates } from './devices.js';
import { PRODUCTS } from './hungaromet/client.js';
import {
  WARNING_LEVELS,
  countyByCode,
  districtsOf,
  findDistrict,
  hungarianDate,
  latestFileName,
  nearestStations,
  outlookForDay,
  parseObservations,
  parseStations,
  parseWarningFile,
  warningsFor,
} from './hungaromet/model.js';
import { HORIZON_NAMES, TEXT, WARNING_LEVEL_NAMES, WARNING_TYPE_NAMES } from './i18n.js';
import { createIssueLog } from './issues.js';

/** Scene trigger key: forever. */
export const WARNING_TRIGGER = 'warning_issued';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
export const METADATA_MAX_AGE = 24 * HOUR;
export const OUTLOOK_MAX_AGE = 30 * MINUTE;
// A station silent for this long is down: its last values are not re-sent.
export const OBSERVATION_MAX_AGE = 3 * HOUR;
// An unchanged value is re-sent this often, so Gladys never shows it as stale.
export const HEARTBEAT = 6 * HOUR;
// Beyond this distance from every station, the place is not in Hungary.
export const MAX_DISTANCE_KM = 50;

const OUTLOOK_PRODUCTS = [PRODUCTS.today, PRODUCTS.tomorrow, PRODUCTS.day2];

const formatCoordinates = (lat, lon) => `${lat.toFixed(2)}, ${lon.toFixed(2)}`;

/**
 * @param {object} options
 * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
 * @param {ReturnType<import('./hungaromet/client.js').createHungaroMetClient>} options.client
 * @param {{ load: Function, save: Function }} options.store
 * @param {object} options.logger
 * @param {() => object} options.getConfig the current normalized config
 * @param {() => number} options.now
 */
export function createService({ gladys, client, store, logger, getConfig, now }) {
  const issues = createIssueLog(logger);
  let metadata = null; // { stations, at }
  let observations = null; // { byId, at }
  // Warning files by product: { name, file }.
  const files = {};
  let outlookReadAt = null;
  let target = null; // { station, area, place, problem }
  let memory; // { area, seen }, undefined until loaded
  let lastStatus = null;
  // The last error of each failing source, for the check action.
  const lastErrors = new Map();

  async function loadMetadata() {
    if (metadata && now() - metadata.at < METADATA_MAX_AGE) {
      return metadata;
    }
    try {
      metadata = { stations: parseStations(await client.stations()), at: now() };
      issues.ok('metadata', 'Station list: HungaroMet answers again');
    } catch (err) {
      issues.fail('metadata', `Station list unavailable (${err.message})`);
      // A stale list stays better than none.
      if (!metadata) {
        throw err;
      }
    }
    return metadata;
  }

  async function readObservations() {
    observations = { byId: parseObservations(await client.observations()), at: now() };
  }

  /** Download the newest file of a product, unless it is the one already read. */
  async function readProduct(product) {
    const name = latestFileName(await client.listing(product), product);
    if (!name) {
      throw new Error(`no ${product} file listed`);
    }
    if (files[product]?.name !== name) {
      files[product] = { name, file: parseWarningFile(await client.warningFile(product, name)) };
      logger.debug(`${product}: ${name} read`);
    }
  }

  async function readWarnings() {
    await readProduct(PRODUCTS.now);
  }

  async function readOutlook() {
    for (const product of OUTLOOK_PRODUCTS) {
      await readProduct(product);
    }
    outlookReadAt = now();
  }

  /** The location typed or of a house, or a configuration problem. */
  async function resolveLocation(config) {
    if (config.coordinatesInvalid) {
      return { problem: 'coordinatesInvalid' };
    }
    if (config.latitude !== null) {
      return {
        place: {
          lat: config.latitude,
          lon: config.longitude,
          name: formatCoordinates(config.latitude, config.longitude),
          source: 'coordinates',
        },
      };
    }
    const houses = await gladys.getHouses();
    const located = houses.filter(
      (house) => typeof house.latitude === 'number' && typeof house.longitude === 'number',
    );
    const house = config.house
      ? located.find((candidate) => candidate.selector === config.house)
      : located[0];
    if (config.house && !house) {
      return { problem: 'houseNotFound' };
    }
    return house
      ? { place: { lat: house.latitude, lon: house.longitude, name: house.name, source: 'house' } }
      : { place: null };
  }

  /** The stations reporting a temperature in the last file, with their metadata. */
  function reportingStations() {
    const meta = new Map((metadata?.stations ?? []).map((station) => [station.id, station]));
    return [...(observations?.byId.values() ?? [])]
      .filter((obs) => obs.values.temperature !== undefined && obs.lat !== null)
      .map((obs) => ({
        id: obs.id,
        name: obs.name,
        lat: obs.lat,
        lon: obs.lon,
        altitude: meta.get(obs.id)?.altitude ?? null,
        county: meta.get(obs.id)?.county ?? null,
      }));
  }

  /**
   * Work out the station and the warning area from the config, then publish
   * the devices. Throws when HungaroMet or Gladys does not answer (retried at
   * the next cycle); a configuration problem is reported in `target.problem`.
   */
  async function setup() {
    const config = getConfig();
    const location = await resolveLocation(config);
    if (location.problem) {
      target = { station: null, area: null, place: null, problem: location.problem };
      return target;
    }
    const { place } = location;
    if (!place && !config.stationId && !config.county && !config.district) {
      target = { station: null, area: null, place: null, problem: 'notConfigured' };
      return target;
    }
    await loadMetadata();
    await readObservations();
    let problem = config.stationIdInvalid ? 'stationIdInvalid' : null;

    let station = null;
    const reporting = reportingStations();
    if (config.stationId) {
      station = reporting.find((candidate) => candidate.id === config.stationId) ?? null;
      problem = station ? problem : 'stationUnknown';
    } else if (place) {
      const [nearest] = nearestStations(reporting, place.lat, place.lon, 1);
      if (nearest && nearest.distance <= MAX_DISTANCE_KM) {
        station = nearest;
      } else {
        problem = 'outsideHungary';
      }
    }

    // The county: chosen, else the one of the station nearest to the place
    // (every station, reporting or not), else the one of the chosen station.
    let county = config.county;
    if (!county && place && problem !== 'outsideHungary') {
      county = nearestStations(metadata.stations, place.lat, place.lon, 1)[0]?.county ?? null;
    }
    county ??= station?.county ?? null;

    let district = null;
    if (config.district) {
      await readWarnings();
      district = findDistrict(files[PRODUCTS.now].file, config.district);
      if (district) {
        county = Math.floor(district.code / 100);
      } else {
        problem = 'districtUnknown';
      }
    }
    const countyEntry = countyByCode(county);
    const area = countyEntry ? { county, name: countyEntry.name, district } : null;

    target = { station, area, place, problem };
    logger.info(
      `Ready: ${station ? `station ${station.id} ${station.name}` : 'no station'}, ` +
        `${area ? `warnings for ${district ? `district ${district.name}` : `county ${area.name}`}` : 'no warnings'}` +
        `${problem ? ` (${problem})` : ''}`,
    );
    await gladys.publishDiscoveredDevices(
      buildDevices(gladys, { station, area, language: config.language }),
    );
    return target;
  }

  /** Run one source, logging a lasting failure once; resolves true on success. */
  async function attempt(key, label, read) {
    try {
      await read();
      lastErrors.delete(key);
      issues.ok(key, `${label}: HungaroMet answers again`);
      return true;
    } catch (err) {
      lastErrors.set(key, err.message);
      issues.fail(key, `${label} unavailable (${err.message})`);
      return false;
    }
  }

  async function reportStatus(connected, message) {
    const next = JSON.stringify({ connected, message });
    if (next === lastStatus) {
      return;
    }
    lastStatus = next;
    await gladys.setConnectionStatus(connected, message);
  }

  /** The warnings of the area for each horizon; null where the source was never read. */
  function levels() {
    const area = target?.area;
    if (!area) {
      return { now: null, today: null, tomorrow: null };
    }
    const nowFile = files[PRODUCTS.now]?.file ?? null;
    const inArea = area.district
      ? (code) => code === area.district.code
      : (code) => code >= 100 && Math.floor(code / 100) === area.county;
    const outlookCode = countyByCode(area.county).outlook ?? area.county;
    const outlooks = OUTLOOK_PRODUCTS.map((product) => files[product]?.file ?? null);
    const haveOutlook = outlooks.some(Boolean);
    const forDay = (offset) =>
      haveOutlook
        ? warningsFor(
            outlookForDay(outlooks, hungarianDate(now(), offset)),
            (code) => code === outlookCode,
          )
        : null;
    return {
      now: nowFile ? warningsFor(nowFile, inArea) : null,
      today: forDay(0),
      tomorrow: forDay(1),
    };
  }

  /** The current observation of the station, if fresh. */
  function freshObservation() {
    const observation = target?.station ? observations?.byId.get(target.station.id) : null;
    return observation && now() - observation.time < OBSERVATION_MAX_AGE ? observation : null;
  }

  /** The states of the devices the user added to Gladys. */
  function currentStates() {
    if (!target) {
      return [];
    }
    const config = getConfig();
    const created = new Set((gladys.devices ?? []).map((device) => device.external_id));
    const states = [];
    const { station, area } = target;
    const observation = freshObservation();
    if (station && observation && created.has(gladys.externalIds('station', station.id).device)) {
      states.push(...stationStates(gladys, station, observation));
    }
    if (area && created.has(gladys.externalIds('warnings', areaPlatformId(area)).device)) {
      states.push(...warningStates(gladys, area, levels(), config.language));
    }
    return states;
  }

  async function publishStates() {
    const states = currentStates();
    if (states.length === 0) {
      return;
    }
    const result = await gladys.publishChangedStates(states, { heartbeat: HEARTBEAT });
    logger.debug(`${result.count} state(s) published`);
  }

  /**
   * Fire the scene trigger for every warning not announced yet, or whose
   * level rose. A 3-hour warning is announced again once it was lifted; an
   * outlook warning once per Hungarian day and type, whether first seen for
   * tomorrow or for today. The very first run for an area only takes note:
   * a fresh install does not fire for warnings issued before it.
   */
  async function announceWarnings() {
    const area = target?.area;
    if (!area) {
      return;
    }
    if (memory === undefined) {
      memory = (await store.load()) ?? null;
    }
    const areaId = areaPlatformId(area);
    const baseline = memory?.area !== areaId;
    const seen = baseline ? {} : { ...memory.seen };
    const current = levels();
    const next = {};
    const fresh = [];
    const keep = (key, warning, horizon) => {
      const previous = seen[key];
      if (previous === undefined || warning.level > previous) {
        fresh.push({ warning, horizon, update: previous !== undefined });
      }
      next[key] = Math.max(warning.level, previous ?? 0);
    };
    for (const warning of current.now ?? []) {
      keep(`now:${warning.type}`, warning, 'now');
    }
    const today = hungarianDate(now(), 0);
    const tomorrow = hungarianDate(now(), 1);
    for (const warning of current.today ?? []) {
      keep(`day:${today}:${warning.type}`, warning, 'today');
    }
    for (const warning of current.tomorrow ?? []) {
      keep(`day:${tomorrow}:${warning.type}`, warning, 'tomorrow');
    }
    // An outlook source not read this time keeps what it had announced.
    for (const [key, value] of Object.entries(seen)) {
      const day = key.startsWith('day:') ? key.slice(4, 12) : null;
      const sourceMissing =
        (key.startsWith('now:') && current.now === null) ||
        (day !== null && current.today === null);
      if (!(key in next) && (sourceMissing || (day !== null && day >= today))) {
        next[key] = value;
      }
    }
    const nextMemory = { area: areaId, seen: next };
    if (JSON.stringify(nextMemory) !== JSON.stringify(memory)) {
      memory = nextMemory;
      await store
        .save(memory)
        .catch((err) => issues.fail('store', `Cannot write /data (${err.message})`));
    }
    if (baseline) {
      logger.debug(`${fresh.length} warning(s) noted, first run: no scene event`);
      return;
    }
    const language = getConfig().language;
    for (const { warning, horizon, update } of fresh) {
      const levelKey = WARNING_LEVELS[warning.level];
      logger.info(
        `New warning: ${levelKey} ${warning.type} (${horizon})${update ? ', level raised' : ''}`,
      );
      await gladys
        .publishSceneEvent(WARNING_TRIGGER, {
          warning_type: warning.type,
          level: levelKey,
          horizon,
          level_number: warning.level,
          type_label: WARNING_TYPE_NAMES[language][warning.type],
          level_label: WARNING_LEVEL_NAMES[language][levelKey],
          horizon_label: HORIZON_NAMES[language][horizon],
          is_update: update,
          // The official text, unchanged (HungaroMet terms of use).
          description: warning.text.slice(0, 1000),
          area: warning.areaName,
        })
        .catch((err) => logger.error(`Scene event refused (${err.message})`));
    }
  }

  return {
    /** Forget the target: the config changed. The files read stay valid. */
    reset() {
      target = null;
      lastStatus = null;
    },

    /**
     * One refresh: setup if needed, read the sources that are due, publish
     * the states, announce the new warnings, report the status.
     * @returns {Promise<boolean>} whether a source answered
     */
    async cycle({ forceOutlook = false } = {}) {
      let freshSetup = false;
      if (!target) {
        try {
          await setup();
          freshSetup = true;
        } catch (err) {
          lastErrors.set('setup', err.message);
          issues.fail('setup', `Setup failed (${err.message})`);
          await reportStatus(false, TEXT.unreachable);
          return false;
        }
        lastErrors.delete('setup');
        issues.ok('setup', 'Setup done: HungaroMet answers again');
      } else if (metadata && now() - metadata.at >= METADATA_MAX_AGE) {
        await loadMetadata().catch(() => {});
      }
      const { station, area, problem } = target;
      if (!station && !area) {
        await reportStatus(false, TEXT[problem ?? 'notConfigured']);
        return false;
      }
      const results = [];
      if (station && !freshSetup) {
        results.push(await attempt('observations', 'Observations', readObservations));
      } else if (station) {
        results.push(true);
      }
      if (area) {
        results.push(await attempt('warnings', 'Warnings', readWarnings));
        if (forceOutlook || outlookReadAt === null || now() - outlookReadAt >= OUTLOOK_MAX_AGE) {
          results.push(await attempt('outlook', 'Warning outlook', readOutlook));
        }
      }
      await publishStates();
      await announceWarnings();
      const anyOk = results.some(Boolean);
      if (problem) {
        await reportStatus(false, TEXT[problem]);
      } else {
        await reportStatus(anyOk, anyOk ? undefined : TEXT.unreachable);
      }
      return anyOk;
    },

    publishStates,

    /** Publish the devices again (a scan request). */
    async publishDevices() {
      if (target) {
        await gladys.publishDiscoveredDevices(
          buildDevices(gladys, { ...target, language: getConfig().language }),
        );
      }
    },

    /** Whether a device belongs to the current target. */
    owns(externalId) {
      if (!target) {
        return false;
      }
      return buildDevices(gladys, { ...target, language: getConfig().language }).some(
        (device) => device.external_id === externalId,
      );
    },

    /** Everything the widget shows. */
    snapshot() {
      return { target, observation: freshObservation(), levels: levels() };
    },

    /** The `count` nearest stations reporting now. */
    async nearest(count) {
      const location = await resolveLocation(getConfig());
      if (location.problem || !location.place) {
        return { problem: location.problem ?? 'notConfigured' };
      }
      await loadMetadata();
      if (!observations || now() - observations.at > 15 * MINUTE) {
        await readObservations();
      }
      const { place } = location;
      return {
        place,
        stations: nearestStations(reportingStations(), place.lat, place.lon, count).map(
          (station) => ({
            ...station,
            county: countyByCode(station.county)?.name ?? '?',
            distance: Math.round(station.distance * 10) / 10,
            altitude: station.altitude === null ? '?' : Math.round(station.altitude),
          }),
        ),
      };
    },

    /** Read every source now (configuration action). */
    async check() {
      target = null;
      lastStatus = null;
      lastErrors.clear();
      await this.cycle({ forceOutlook: true });
      const current = levels();
      return {
        target,
        observation: freshObservation(),
        levels: current,
        districts: target?.area ? districtsOf(files[PRODUCTS.now]?.file, target.area.county) : [],
        errors: Object.fromEntries(lastErrors),
      };
    },
  };
}
