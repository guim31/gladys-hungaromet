// -----------------------------------------------------------------------------
// The parsers, on files recorded from odp.met.hu on 19 and 20 November 2026.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  countyOfRegion,
  districtsOf,
  findDistrict,
  hungarianDate,
  latestFileName,
  maxLevel,
  mergeObservations,
  nearestStations,
  observationFileNames,
  outlookForDay,
  parseObservations,
  parseStations,
  parseWarningFile,
  warningsFor,
} from '../src/hungaromet/model.js';
import { unzipFirst } from '../src/hungaromet/zip.js';
import { FIXTURES, withExpiry, zip } from './helpers/fakeHungaroMet.js';

const raw = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

test('the station list keeps the latest period of each station, with its county', () => {
  const stations = parseStations(FIXTURES.stations);
  const sopron = stations.filter((station) => station.id === '13704');
  assert.equal(sopron.length, 1);
  assert.equal(sopron[0].until, '20261120');
  assert.deepEqual(
    stations.find((station) => station.id === '44527'),
    {
      id: '44527',
      name: 'Budapest Pestszentlőrinc',
      lat: 47.4292,
      lon: 19.1822,
      altitude: 138.1,
      county: 1,
      until: stations.find((station) => station.id === '44527').until,
    },
  );
  assert.ok(stations.every((station) => station.county !== null));
  assert.throws(() => parseStations('StationNumber;Latitude\n'), /empty or unreadable/);
});

test('counties from the RegioName of the metadata, Budapest districts included', () => {
  assert.equal(countyOfRegion('Budapest XVIII.'), 1);
  assert.equal(countyOfRegion('Győr-Moson-Sopron     '), 8);
  assert.equal(countyOfRegion('Wien'), null);
});

test('the real latest-observation archive unzips and parses: every station once', () => {
  const { name, data } = unzipFirst(raw('synop-10min-latest.zip'));
  assert.match(name, /^HABP_10M_SYNOP_\d{14}\.csv$/);
  const observations = parseObservations(data.toString('utf8'));
  assert.ok(observations.size > 250, `${observations.size} stations`);
  for (const observation of observations.values()) {
    assert.ok(Number.isFinite(observation.time));
  }
});

test('an observation: units converted, the newest row first, a late value taken from the row before', () => {
  const observations = parseObservations(FIXTURES.observations);
  const budapest = observations.get('44527');
  assert.equal(budapest.time, Date.UTC(2026, 10, 20, 21, 30));
  assert.deepEqual(budapest.values, {
    temperature: 8.3,
    humidity: 78,
    pressure: 992.7,
    wind_speed: 9.7, // 2.7 m/s
    wind_gust: 14.8, // 4.1 m/s
    wind_direction: 284,
    // Missing at 21:30, 0.0 at 21:20.
    rain_rate: 0,
    visibility: 20,
  });
  // A station that measures less: no pressure, no visibility in Újpest.
  assert.deepEqual(Object.keys(observations.get('44165').values).sort(), [
    'humidity',
    'rain_rate',
    'temperature',
    'wind_direction',
    'wind_gust',
    'wind_speed',
  ]);
  // A radiation-only station: nothing for the weather.
  assert.deepEqual(observations.get('38317').values, {});
  assert.throws(() => parseObservations(''), /empty or unreadable/);
});

test('a value older than 30 minutes is not reused, and no wind direction in a calm', () => {
  const header = FIXTURES.observations.split('\n')[0];
  const row = (time, t, fs) =>
    `${time};        11111;Test;  47.0;  19.0;   100.0;  0.0;    ;  ${t};    ;-999;;-999;;-999;;-999;;-999;;-999;;-999;;-999;;-999;;${fs};;  90;;-999;;-999;;-999;;-999;;-999;;-999;;-999;;-999;;-999;;-999;;-999;;-999;;EOR`;
  const text = [header, row('202611201200', '5.0', '0.0'), row('202611201300', '-999', '0.0')].join(
    '\n',
  );
  const observation = parseObservations(text).get('11111');
  assert.equal(observation.values.temperature, undefined);
  assert.equal(observation.values.wind_speed, 0);
  assert.equal(observation.values.wind_direction, undefined);
});

test('observations merged: a station late in the newest file keeps its last reading', () => {
  const older = parseObservations(FIXTURES.observations);
  const newer = new Map([
    ['44527', { ...older.get('44527'), time: older.get('44527').time + 600000 }],
  ]);
  const merged = mergeObservations(older, newer);
  assert.equal(merged.size, older.size);
  assert.equal(merged.get('44527').time, newer.get('44527').time);
  // An older reading never replaces a newer one.
  assert.equal(mergeObservations(newer, older).get('44527').time, newer.get('44527').time);
  assert.deepEqual(
    observationFileNames(
      'a HABP_10M_SYNOP_20261120213805.csv.zip b HABP_10M_SYNOP_20261120212804.csv.zip HABP_10M_SYNOP_LATEST.csv.zip',
    ),
    ['HABP_10M_SYNOP_20261120212804.csv.zip', 'HABP_10M_SYNOP_20261120213805.csv.zip'],
  );
});

test('nearest stations, by great-circle distance', () => {
  const stations = parseStations(FIXTURES.stations);
  const [first] = nearestStations(stations, 46.0763, 18.2281, 3);
  assert.equal(first.id, '38528');
  assert.ok(first.distance < 2);
});

test('the newest file of the real index page of the 3-hour warnings', () => {
  const html = raw('listing-waex.html').toString('utf8');
  assert.equal(latestFileName(html, 'waex'), 'waex20261120_2003.xml.zip');
  assert.equal(latestFileName(html, 'wbex'), null);
});

test('a 3-hour warning file: 175 districts, the warnings of a district or a county', () => {
  const file = parseWarningFile(FIXTURES.nowActive);
  assert.equal(file.type, 'wa');
  assert.equal(file.issued, Date.UTC(2026, 10, 19, 20, 25, 12));
  assert.equal(file.expires, null);
  assert.equal(file.areas.length, 175);
  assert.equal(file.warnings.length, 27);
  const pecs = warningsFor(file, (code) => code === 204);
  assert.deepEqual(pecs, [
    {
      area: 204,
      areaName: 'Pécsi',
      type: 'wind',
      level: 1,
      text: 'The windspeed can temporarily exceed 70 km/h.',
    },
  ]);
  // Sellyei (207) has no warning, Baranya has.
  assert.deepEqual(
    warningsFor(file, (code) => code === 207),
    [],
  );
  assert.equal(maxLevel(warningsFor(file, (code) => Math.floor(code / 100) === 2)), 1);
  assert.equal(districtsOf(file, 2).length, 10);
  assert.deepEqual(districtsOf(file, 1), [{ code: 101, name: 'Budapest' }]);
  const none = parseWarningFile(FIXTURES.nowNone);
  assert.equal(none.warnings.length, 0);
  assert.equal(none.areas.length, 175);
  assert.throws(() => parseWarningFile('<html>'), /not a HungaroMet message/);
});

test('districts found by code or by name, with or without accents and suffix', () => {
  const file = parseWarningFile(FIXTURES.nowNone);
  for (const typed of ['204', 'Pécsi', 'pecsi', 'Pécs', ' PECS ']) {
    assert.deepEqual(findDistrict(file, typed), { code: 204, name: 'Pécsi' }, typed);
  }
  assert.equal(findDistrict(file, 'Atlantis'), null);
  assert.equal(findDistrict(file, '13'), null, 'a county code is not a district');
});

test('outlook files: one warning per type, the strongest; the file of a Hungarian day', () => {
  const today = parseWarningFile(FIXTURES.todayActive);
  assert.equal(today.expires, '20261119');
  const bekes = warningsFor(today, (code) => code === 4);
  assert.deepEqual(
    bekes.map((warning) => warning.type),
    ['thunderstorm', 'wind'],
  );
  const day2 = parseWarningFile(FIXTURES.day2Active);
  const older = parseWarningFile(withExpiry(FIXTURES.day2Active, '20261119'));
  older.issued = today.issued - 3600 * 1000;
  assert.equal(outlookForDay([today, older, day2], '20261119'), today);
  assert.equal(outlookForDay([today, day2], '20261122'), day2);
  assert.equal(outlookForDay([today], '20261130'), null);
});

test('the Hungarian day turns at midnight in Budapest, not in UTC', () => {
  assert.equal(hungarianDate(Date.parse('2026-11-19T22:59:00Z')), '20261119');
  assert.equal(hungarianDate(Date.parse('2026-11-19T23:01:00Z')), '20261120');
  assert.equal(hungarianDate(Date.parse('2026-12-31T12:00:00Z'), 1), '20270101');
  // Summer time: UTC+2.
  assert.equal(hungarianDate(Date.parse('2026-07-01T22:30:00Z')), '20260702');
});

test('the ZIP reader: deflated and stored entries, damaged archives refused', () => {
  assert.equal(unzipFirst(zip('a.txt', 'hello')).data.toString(), 'hello');
  const stored = zip('a.txt', 'x');
  assert.throws(() => unzipFirst(Buffer.from('not a zip at all, really not')), /not a ZIP/);
  assert.throws(() => unzipFirst(stored.subarray(0, stored.length - 30)), /ZIP/);
  assert.throws(() => unzipFirst('text'), /not a ZIP/);
});
