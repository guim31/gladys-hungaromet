import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, parseCoordinate } from '../src/config.js';

test('coordinates accept a comma or a point, and refuse the rest', () => {
  assert.equal(parseCoordinate('47,50', 90), 47.5);
  assert.equal(parseCoordinate(' 19.04 ', 180), 19.04);
  assert.equal(parseCoordinate('abc', 90), null);
  assert.equal(parseCoordinate('95', 90), null);
  assert.equal(parseCoordinate('', 90), null);
});

test('the defaults, and every value typed', () => {
  const config = normalizeConfig({});
  assert.equal(config.refreshMs, 10 * 60 * 1000);
  assert.equal(config.language, 'fr');
  assert.equal(config.county, null);
  assert.equal(config.district, '');
  assert.equal(DEFAULT_CONFIG.county, '');
  const typed = normalizeConfig({
    latitude: '47,5',
    longitude: '19.04',
    station_id: ' 044527 ',
    county: '13',
    district: ' Pécsi ',
    refresh_minutes: '30',
    language: 'de',
  });
  assert.equal(typed.latitude, 47.5);
  assert.equal(typed.stationId, '44527');
  assert.equal(typed.county, 13);
  assert.equal(typed.district, 'Pécsi');
  assert.equal(typed.refreshMs, 30 * 60 * 1000);
  assert.equal(typed.language, 'de');
});

test('invalid values fall back, and are flagged where the user must know', () => {
  const config = normalizeConfig({
    latitude: 'north',
    longitude: '19',
    station_id: 'Pécs',
    county: '99',
    refresh_minutes: '1',
    language: 'hu',
  });
  assert.equal(config.coordinatesInvalid, true);
  assert.equal(config.latitude, null);
  assert.equal(config.stationIdInvalid, true);
  assert.equal(config.stationId, '');
  assert.equal(config.county, null);
  assert.equal(config.refreshMs, 10 * 60 * 1000);
  assert.equal(config.language, 'fr');
});
