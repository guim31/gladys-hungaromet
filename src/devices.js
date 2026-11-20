// -----------------------------------------------------------------------------
// The two devices of the integration, and the states they publish.
//
//   - station: the 10-minute observations of one automatic HungaroMet station
//     (external id from the station number, e.g. 44527);
//   - warnings: the official warnings of a county (external id "c<code>"), or
//     of a district for the 3-hour warnings (external id "d<code>").
//
// Feature keys are forever (Gladys keys history, scenes and dashboards on
// them). Everything is read-only: HungaroMet is a data source, nothing to drive.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';
import { FEATURE_NAMES, HORIZON_NAMES, TEXT, warningLabel } from './i18n.js';

/** Device types (first part of the external ids): forever. */
export const DEVICE_TYPES = { STATION: 'station', WARNINGS: 'warnings' };

const sensor = (category, type, unit, min, max) => ({ category, type, unit, min, max });
const level = { category: C.RISK, type: 'integer', min: 0, max: 3 };

/** Features of the station device, by key: forever. */
export const STATION_FEATURES = {
  temperature: sensor(C.TEMPERATURE_SENSOR, 'decimal', U.CELSIUS, -40, 50),
  humidity: sensor(C.HUMIDITY_SENSOR, 'decimal', U.PERCENT, 0, 100),
  pressure: sensor(C.PRESSURE_SENSOR, 'decimal', U.HECTO_PASCAL, 850, 1100),
  wind_speed: sensor(C.SPEED_SENSOR, 'decimal', U.KILOMETER_PER_HOUR, 0, 200),
  wind_gust: sensor(C.SPEED_SENSOR, 'decimal', U.KILOMETER_PER_HOUR, 0, 200),
  wind_direction: sensor(C.ANGLE_SENSOR, 'integer', U.DEGREE, 0, 360),
  rain_rate: sensor(C.PRECIPITATION_SENSOR, 'decimal', U.MILLIMETER_PER_HOUR, 0, 200),
  visibility: sensor(C.DISTANCE_SENSOR, 'decimal', U.KM, 0, 100),
};

/** Features of the warnings device, by key: forever. */
export const WARNING_FEATURES = {
  warning_now: level,
  warning_today: level,
  warning_tomorrow: level,
  warnings: { category: C.TEXT, type: 'text', min: 0, max: 0 },
};

/** Platform id of the warnings device: the district if chosen, else the county. */
export const areaPlatformId = (area) =>
  area.district ? `d${area.district.code}` : `c${area.county}`;

function buildFeatures(ids, definitions, language) {
  return Object.entries(definitions).map(([key, definition]) => ({
    name: FEATURE_NAMES[language][key],
    external_id: ids.feature(key),
    category: definition.category,
    type: definition.type,
    ...(definition.unit ? { unit: definition.unit } : {}),
    // Display bounds of the gauges; the core never clamps a state on them.
    min: definition.min,
    max: definition.max,
    read_only: true,
    has_feedback: false,
    keep_history: true,
  }));
}

/**
 * The devices to publish. Polling: the container refreshes the data itself
 * (src/poller.js); the core's onPoll, once a minute, is only a fallback.
 * @param {object} gladys
 * @param {{ station: object | null, area: { county: number, name: string, district: object | null } | null, language: string }} target
 */
export function buildDevices(gladys, { station, area, language }) {
  const devices = [];
  if (station) {
    const ids = gladys.externalIds(DEVICE_TYPES.STATION, station.id);
    devices.push({
      name: `HungaroMet ${station.name}`.slice(0, 60),
      external_id: ids.device,
      model: 'Automatic weather station',
      should_poll: true,
      poll_frequency: 60000,
      features: buildFeatures(ids, STATION_FEATURES, language),
      params: [{ name: 'station_id', value: station.id }],
    });
  }
  if (area) {
    const ids = gladys.externalIds(DEVICE_TYPES.WARNINGS, areaPlatformId(area));
    devices.push({
      name: `${TEXT.warningsDevice[language]} ${area.district?.name ?? area.name}`,
      external_id: ids.device,
      model: 'Weather warnings',
      should_poll: true,
      poll_frequency: 60000,
      features: buildFeatures(ids, WARNING_FEATURES, language),
    });
  }
  return devices;
}

const state = (ids, key, value) =>
  value === null || value === undefined
    ? null
    : { device_feature_external_id: ids.feature(key), state: value };

/** States of the station device from an observation (values already converted). */
export function stationStates(gladys, station, observation) {
  const ids = gladys.externalIds(DEVICE_TYPES.STATION, station.id);
  return Object.keys(STATION_FEATURES)
    .map((key) => state(ids, key, observation.values[key]))
    .filter(Boolean);
}

/**
 * One line per horizon with warnings: "Next 3 hours: Yellow · Wind gusts" …
 * null when there is none at all.
 */
export function warningsSummary(levels, language) {
  const parts = [];
  for (const horizon of ['now', 'today', 'tomorrow']) {
    const list = levels[horizon];
    if (list && list.length > 0) {
      parts.push(
        `${HORIZON_NAMES[language][horizon]}${language === 'fr' ? ' : ' : ': '}${list.map((w) => warningLabel(w, language)).join(', ')}`,
      );
    }
  }
  return parts.length > 0 ? parts.join(' | ') : null;
}

/**
 * States of the warnings device.
 * @param {{ now: Array | null, today: Array | null, tomorrow: Array | null }} levels
 *   the warnings of each horizon (null when that source is unknown)
 */
export function warningStates(gladys, area, levels, language) {
  const ids = gladys.externalIds(DEVICE_TYPES.WARNINGS, areaPlatformId(area));
  const max = (list) => (list === null ? null : list.reduce((m, w) => Math.max(m, w.level), 0));
  const states = [
    state(ids, 'warning_now', max(levels.now)),
    state(ids, 'warning_today', max(levels.today)),
    state(ids, 'warning_tomorrow', max(levels.tomorrow)),
  ];
  if (levels.now !== null || levels.today !== null || levels.tomorrow !== null) {
    const summary = warningsSummary(levels, language) ?? TEXT.noWarning[language];
    states.push({
      device_feature_external_id: ids.feature('warnings'),
      text: summary.slice(0, 250),
    });
  }
  return states.filter(Boolean);
}
