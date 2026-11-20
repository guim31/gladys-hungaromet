// -----------------------------------------------------------------------------
// Wires the Gladys SDK to the HungaroMet service: handlers, configuration
// actions, widget, refresh timer. Everything external is injectable (fetch,
// store, clock, timers, logger) so the tests run the real wiring against the
// SDK's fake Gladys and recorded HungaroMet files.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { LANGUAGES, normalizeConfig } from './config.js';
import { createHungaroMetClient } from './hungaromet/client.js';
import { ACTION_TEXT, TEXT, formatNumber, formatWhen } from './i18n.js';
import { createPoller } from './poller.js';
import { createService } from './service.js';
import { Store } from './store.js';
import { WIDGET_KEY, buildWeatherContent } from './widgets.js';

/** Configuration action keys: forever. */
export const ACTIONS = { LIST_STATIONS: 'list_stations', CHECK: 'check_connection' };

const NEAREST_COUNT = 8;

/**
 * A failed action: Gladys shows the thrown message in red, and a returned one
 * in green. The message is the multi-language object.
 */
export class ActionFailure extends Error {
  constructor(text) {
    super(text.en);
    this.message = text;
  }
}

/** The same message in every language. */
const everyLanguage = (build) => Object.fromEntries(LANGUAGES.map((lang) => [lang, build(lang)]));

/** Text of the "List the nearest stations" action (throws on a failure). */
export function nearestMessage(result) {
  if (result.problem) {
    throw new ActionFailure(TEXT[result.problem]);
  }
  return everyLanguage((lang) => {
    const t = ACTION_TEXT[lang];
    const where = result.place.source === 'house' ? t.yourHouse(result.place.name) : t.coordinates;
    return [
      t.nearest(where),
      ...result.stations.map((station) =>
        t.station({ ...station, distance: formatNumber(station.distance, lang) }),
      ),
      t.copy,
    ].join('\n');
  });
}

/** Text of the "Check the connection" action (throws on a failure). */
export function checkMessage(result, { now, timeZone }) {
  const { target, errors } = result;
  if (errors.setup) {
    throw new ActionFailure(
      everyLanguage((lang) => ACTION_TEXT[lang].failed('HungaroMet', errors.setup)),
    );
  }
  if (!target.station && !target.area) {
    throw new ActionFailure(TEXT[target.problem ?? 'notConfigured']);
  }
  const stationFailed = Boolean(target.station && (errors.observations || !result.observation));
  const warningsFailed = Boolean(target.area && (errors.warnings || errors.outlook));
  const message = everyLanguage((lang) => {
    const t = ACTION_TEXT[lang];
    const parts = [];
    if (target.station) {
      if (stationFailed) {
        parts.push(t.failed(t.stationPart, errors.observations ?? 'no recent observation'));
      } else {
        const temperature = result.observation.values.temperature;
        parts.push(
          t.observation(
            target.station.name,
            temperature === undefined ? '?' : formatNumber(temperature, lang),
            formatWhen(result.observation.time, lang, timeZone, now),
          ),
        );
      }
    }
    if (target.area) {
      if (warningsFailed) {
        parts.push(t.failed(t.warningsPart, errors.warnings ?? errors.outlook));
      } else {
        const { levels } = result;
        const count = ['now', 'today', 'tomorrow'].reduce(
          (sum, horizon) => sum + (levels[horizon]?.length ?? 0),
          0,
        );
        parts.push(t.warningsCount(target.area.district?.name ?? target.area.name, count));
      }
      if (result.districts.length > 0) {
        parts.push(
          t.districts(
            result.districts.map((district) => `${district.code} ${district.name}`).join(', '),
          ),
        );
      }
    }
    const text = t.checkOk(parts.join(' '));
    return target.problem ? `${text} ${TEXT[target.problem][lang]}` : text;
  });
  // Every source failed, or the configuration has a problem: red.
  const allFailed = (!target.station || stationFailed) && (!target.area || warningsFailed);
  if (target.problem || allFailed) {
    throw new ActionFailure(message);
  }
  return message;
}

/**
 * @param {object} gladys GladysIntegration (or the SDK's fake Gladys)
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {{ load: Function, save: Function }} [options.store]
 * @param {() => number} [options.now]
 * @param {boolean} [options.timers] run the refresh timer
 * @param {object} [options.logger]
 * @param {string} [options.timeZone]
 */
export function registerHandlers(gladys, options = {}) {
  const now = options.now ?? (() => Date.now());
  const logger = options.logger ?? createLogger({ name: 'hungaromet' });
  // The supervisor injects TZ, the time zone of Gladys; undefined = the system's.
  const timeZone = options.timeZone ?? (process.env.TZ || undefined);
  const store = options.store ?? new Store('/data');
  let config = normalizeConfig(gladys.config ?? {});
  const getConfig = () => config;

  const client = createHungaroMetClient({ fetch: options.fetch, logger: logger.child('http') });
  const service = createService({ gladys, client, store, logger, getConfig, now });

  // The widget is nudged when what it shows changed, not after every refresh.
  let shown = null;
  const refreshWidget = () => {
    const next = JSON.stringify(service.snapshot());
    if (next !== shown) {
      shown = next;
      gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  };
  const poller = createPoller({
    gladys,
    service,
    getConfig,
    logger,
    now,
    timers: options.timers ?? true,
    onCycle: refreshWidget,
  });

  gladys.onScanRequest(() => service.publishDevices());

  gladys.onPoll(async (device) => {
    if (service.owns(device.external_id)) {
      await poller.pollFromCore(device);
    }
  });

  // A device just added (or updated): the SDK forgot what it had published
  // for it, and Gladys dropped the states sent before it existed.
  const sendAgain = async () => {
    await service.publishStates();
    gladys.requestWidgetRefresh(WIDGET_KEY);
  };
  gladys.onDeviceCreated(sendAgain);
  gladys.onDeviceUpdated(sendAgain);
  gladys.onDeviceDeleted(() => gladys.requestWidgetRefresh(WIDGET_KEY));

  gladys.onAction(ACTIONS.LIST_STATIONS, async () => {
    logger.info('Action: list the nearest stations');
    let result;
    try {
      result = await service.nearest(NEAREST_COUNT);
    } catch (err) {
      throw new ActionFailure(
        everyLanguage((lang) => ACTION_TEXT[lang].failed('HungaroMet', err.message)),
      );
    }
    return nearestMessage(result);
  });

  gladys.onAction(ACTIONS.CHECK, async () => {
    logger.info('Action: check the connection');
    const result = await service.check();
    refreshWidget();
    return checkMessage(result, { now: now(), timeZone });
  });

  gladys.onWidgetGet(WIDGET_KEY, async ({ settings, language, units }) =>
    buildWeatherContent(service.snapshot(), {
      gladys,
      settings,
      language,
      units,
      now: now(),
      timeZone,
    }),
  );

  async function start() {
    service.reset();
    await poller.restart();
  }

  gladys.onConfigUpdated(async (newConfig) => {
    logger.info('Configuration updated');
    config = normalizeConfig(newConfig);
    await start();
  });

  // The SDK logs the connection lifecycle itself (gladys-sdk).
  let ready = Promise.resolve();
  gladys.on('connected', async () => {
    ready = (async () => {
      try {
        config = normalizeConfig(await gladys.getConfig());
        await start();
      } catch (err) {
        logger.error(`Initialization failed (${err.message})`);
        await gladys.setConnectionStatus(false, TEXT.initFailed).catch(() => {});
      }
    })();
    await ready;
  });

  return {
    service,
    poller,
    get ready() {
      return ready;
    },
    async stop() {
      poller.stop();
      await poller.idle;
    },
  };
}
