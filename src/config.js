// -----------------------------------------------------------------------------
// Integration configuration: defaults (mirroring the manifest `config_schema`)
// and normalization, so the rest of the code never deals with raw form values.
// -----------------------------------------------------------------------------

import { COUNTIES } from './hungaromet/model.js';

/** The languages of the Gladys interface, in the order of the manifest options. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/** The refresh intervals offered, in minutes (option values are strings). */
export const REFRESH_CHOICES = ['10', '20', '30', '60'];

// Defaults: they MUST stay equal to the `default` values of the manifest
// (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  // Selector of a Gladys house (source "houses"); empty = the first located house.
  house: '',
  // Coordinates typed by hand: strings, so that a comma or a decimal point
  // both work (a Gladys number field refuses decimals on some cores).
  latitude: '',
  longitude: '',
  // HungaroMet station number; empty = the station nearest to the location.
  station_id: '',
  // County of the warnings (code 1 to 20); empty = the county of the location.
  county: '',
  // District of the 3-hour warnings (name or code); empty = the whole county.
  district: '',
  // The stations report every 10 minutes: a faster pace reads nothing new.
  refresh_minutes: '10',
  language: 'fr',
};

/**
 * Parse a coordinate typed by a user: "47.07", "47,07", " 47.07 ".
 * @param {unknown} value
 * @param {number} limit 90 for a latitude, 180 for a longitude
 * @returns {number | null} null when empty or invalid
 */
export function parseCoordinate(value, limit) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const text = value.trim().replace(',', '.');
  if (!/^[-+]?\d+(\.\d+)?$/.test(text)) {
    return null;
  }
  const number = Number(text);
  return Math.abs(number) <= limit ? number : null;
}

/**
 * Merge the user config with the defaults and type every value.
 * @param {Record<string, unknown>} [raw] config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const merged = { ...DEFAULT_CONFIG, ...raw };
  const latitude = parseCoordinate(merged.latitude, 90);
  const longitude = parseCoordinate(merged.longitude, 180);
  const refresh = REFRESH_CHOICES.includes(String(merged.refresh_minutes))
    ? Number(merged.refresh_minutes)
    : Number(DEFAULT_CONFIG.refresh_minutes);
  const stationId = String(merged.station_id ?? '').trim();
  const county = String(merged.county ?? '').trim();
  return {
    house: typeof merged.house === 'string' ? merged.house : '',
    // Both or neither: one coordinate alone is no location.
    latitude: latitude !== null && longitude !== null ? latitude : null,
    longitude: latitude !== null && longitude !== null ? longitude : null,
    // A coordinate typed but unreadable: said in the connection status.
    coordinatesInvalid:
      (String(merged.latitude ?? '').trim() !== '' ||
        String(merged.longitude ?? '').trim() !== '') &&
      (latitude === null || longitude === null),
    stationId: /^\d{1,6}$/.test(stationId) ? String(Number(stationId)) : '',
    stationIdInvalid: stationId !== '' && !/^\d{1,6}$/.test(stationId),
    county: COUNTIES.some((entry) => String(entry.code) === county) ? Number(county) : null,
    district: String(merged.district ?? '')
      .trim()
      .slice(0, 60),
    refreshMs: refresh * 60 * 1000,
    language: LANGUAGES.includes(merged.language) ? merged.language : DEFAULT_CONFIG.language,
  };
}
