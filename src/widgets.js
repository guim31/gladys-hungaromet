// -----------------------------------------------------------------------------
// The dashboard widget "HungaroMet weather": the station's readings and the
// official warnings (next 3 hours, today, tomorrow). Built from what the last
// refresh read (no request of its own), in the language and the unit system
// of the dashboard: the core caches the content per settings, language and
// units, pre-localizing it here is the expected design.
//
// Budget of the core: 8 components at most, 2 texts. This content uses at
// most 7: heading, 4 tiles, status, caption.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { areaPlatformId } from './devices.js';
import {
  HORIZON_NAMES,
  TEXT,
  WIDGET_TEXT,
  formatWhen,
  pickLanguage,
  warningLabel,
} from './i18n.js';

/** Widget key: forever. */
export const WIDGET_KEY = 'weather';

/** Values of the `blocks` setting: forever. */
export const WIDGET_BLOCKS = ['readings', 'warnings'];

// Content lifetime: the data moves every 10 minutes; the service also nudges
// the widget after each refresh that changed something.
const TTL_SECONDS = 600;

const LEVEL_COLORS = {
  1: WIDGET_COLORS.WARNING,
  2: WIDGET_COLORS.WARNING,
  3: WIDGET_COLORS.DANGER,
};

const round = (value) => Math.round(value * 10) / 10;

/** Metric values, converted for a dashboard in US units. */
function unitsOf(units) {
  const us = units === 'us';
  return {
    temperature: (celsius) => (us ? round((celsius * 9) / 5 + 32) : celsius),
    temperatureUnit: us ? '°F' : '°C',
    speed: (kmh) => (us ? round(kmh / 1.609344) : kmh),
    speedUnit: us ? 'mph' : 'km/h',
  };
}

const textOnly = (text) => ({
  ttl_seconds: 60,
  components: [{ type: 'text', variant: 'body', text }],
});

/** The name the user gave the device in Gladys, if added. */
const gladysName = (gladys, externalId) =>
  (gladys?.devices ?? []).find((device) => device.external_id === externalId)?.name ?? null;

/**
 * @param {ReturnType<import('./service.js').createService>['snapshot']} snapshot
 * @param {{ gladys?: object, settings?: object, language: string, units: string, now: number, timeZone?: string }} context
 */
export function buildWeatherContent(
  snapshot,
  { gladys, settings, language, units, now, timeZone },
) {
  const lang = pickLanguage(language);
  const t = WIDGET_TEXT[lang];
  const blocks = Array.isArray(settings?.blocks) ? settings.blocks : WIDGET_BLOCKS;
  const { target, observation, levels } = snapshot;
  if (!target || (!target.station && !target.area)) {
    return textOnly(
      target?.problem && TEXT[target.problem] ? TEXT[target.problem][lang] : t.notConfigured,
    );
  }
  const haveWarnings = levels.now !== null || levels.today !== null || levels.tomorrow !== null;
  if (!observation && !haveWarnings) {
    return textOnly(t.waiting);
  }
  const convert = unitsOf(units);
  const stationName = target.station
    ? (gladysName(gladys, gladys?.externalIds('station', target.station.id).device) ??
      target.station.name)
    : null;
  const areaName = target.area
    ? (gladysName(gladys, gladys?.externalIds('warnings', areaPlatformId(target.area)).device) ??
      target.area.district?.name ??
      target.area.name)
    : null;
  const components = [
    { type: 'text', variant: 'heading', text: String(stationName ?? areaName).slice(0, 40) },
  ];

  if (blocks.includes('readings') && observation) {
    const values = observation.values;
    const tile = (label, value, unit, icon) =>
      value === undefined ? null : { type: 'value', label, value, unit, icon };
    components.push(
      ...[
        tile(
          t.temperature,
          values.temperature === undefined ? undefined : convert.temperature(values.temperature),
          convert.temperatureUnit,
          'thermometer',
        ),
        tile(t.humidity, values.humidity, '%', 'droplet'),
        tile(
          t.wind,
          values.wind_speed === undefined ? undefined : convert.speed(values.wind_speed),
          convert.speedUnit,
          'wind',
        ),
        tile(
          t.gusts,
          values.wind_gust === undefined ? undefined : convert.speed(values.wind_gust),
          convert.speedUnit,
          'wind',
        ),
      ].filter(Boolean),
    );
  }

  if (blocks.includes('warnings') && haveWarnings) {
    const items = [];
    for (const horizon of ['now', 'today', 'tomorrow']) {
      for (const warning of (levels[horizon] ?? []).slice(0, 3)) {
        items.push({
          label: HORIZON_NAMES[lang][horizon].slice(0, 40),
          value: warningLabel(warning, lang).slice(0, 40),
          color: LEVEL_COLORS[warning.level],
          icon: 'alert-triangle',
        });
      }
    }
    if (items.length === 0) {
      items.push({
        label: `${t.warnings} · ${areaName}`.slice(0, 40),
        value: t.none,
        color: WIDGET_COLORS.SUCCESS,
        icon: 'check-circle',
      });
    }
    components.push({ type: 'status', items: items.slice(0, 10) });
  }

  // Attribution asked by the terms of use of the HungaroMet open data.
  const time = observation ? ` · ${formatWhen(observation.time, lang, timeZone, now)}` : '';
  components.push({ type: 'text', variant: 'caption', text: `${t.source}${time}` });
  return { ttl_seconds: TTL_SECONDS, components };
}
