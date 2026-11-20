// -----------------------------------------------------------------------------
// The integration end to end: the SDK's fake Gladys, a simulated HungaroMet
// portal (recorded files), a controllable clock. Devices, states, the
// container's own refresh timer, the onPoll fallback, the "new warning"
// trigger, the actions, the logs.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../src/store.js';
import { HEARTBEAT, WARNING_TRIGGER } from '../src/service.js';
import { FIXTURES, NOW, observationsAt, withExpiry, zip } from './helpers/fakeHungaroMet.js';
import { HOUSE, createWorld, featureId } from './helpers/world.js';

const STATION = '38528'; // Pécs Egyetem, 1.6 km from HOUSE
const AREA = 'c2'; // Baranya county

const stationFeature = (world, key, id = STATION) => featureId(world.gladys, 'station', id, key);
const areaFeature = (world, key, id = AREA) => featureId(world.gladys, 'warnings', id, key);
const statesOf = (world, featureExternalId) =>
  world.gladys.fake.states.filter(
    (state) => state.device_feature_external_id === featureExternalId,
  );

/** The recorded observations with another temperature (column t) at a station. */
function withTemperature(world, temperature, id = STATION) {
  const text = FIXTURES.observations.replace(/^.*$/gm, (line) => {
    const cells = line.split(';');
    if (cells[1]?.trim() !== id) {
      return line;
    }
    cells[8] = ` ${temperature}`;
    return cells.join(';');
  });
  world.hungaromet.answers.observations = () =>
    zip('HABP_10M_SYNOP_LATEST.csv', observationsAt(world.clock.now, text));
}

/** A new issue of the 3-hour warnings. */
function issueNow(world, xml, name = 'waex20261119_2249.xml.zip') {
  world.hungaromet.products.waex = { name, xml: () => xml };
}

test('the house gives two devices: the nearest station, and the warnings of its county', async () => {
  const world = await createWorld();
  assert.deepEqual(
    world.gladys.fake.discoveredDevices.map((device) => [device.name, device.external_id]),
    [
      ['HungaroMet Pécs Egyetem', world.gladys.externalIds('station', STATION).device],
      ['Alertes HungaroMet Baranya', world.gladys.externalIds('warnings', AREA).device],
    ],
  );
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
  // Nothing is published for devices the user has not added.
  assert.equal(world.gladys.fake.states.length, 0);
  await world.app.stop();
});

test('adding the devices publishes their states at once, from what was already read', async () => {
  const world = await createWorld();
  const requests = world.hungaromet.requests.length;
  await world.createAll();
  assert.equal(world.hungaromet.requests.length, requests, 'no new request');
  const last = (id) => world.gladys.fake.lastState(id);
  assert.equal(last(stationFeature(world, 'temperature')), 7.2);
  assert.equal(last(stationFeature(world, 'pressure')), 989.1);
  assert.equal(last(stationFeature(world, 'wind_speed')), 2.9);
  // Pécs Egyetem has no visibility sensor: no state rather than a fake 0.
  assert.equal(statesOf(world, stationFeature(world, 'visibility')).length, 0);
  assert.equal(last(areaFeature(world, 'warning_now')), 1);
  assert.equal(last(areaFeature(world, 'warning_today')), 1);
  assert.equal(last(areaFeature(world, 'warning_tomorrow')), 0);
  assert.equal(
    statesOf(world, areaFeature(world, 'warnings')).at(-1).text,
    "3 prochaines heures : Jaune · Rafales | Aujourd'hui : Jaune · Rafales",
  );
  assert.ok(world.gladys.fake.widgetRefreshes.includes('weather'));
  await world.app.stop();
});

test('the states refresh on the container timer, without any onPoll from the core', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const world = await createWorld({ timers: true });
  await world.createAll();
  withTemperature(world, 9.4);
  const before = world.hungaromet.count('observations');

  world.clock.now += 10 * 60 * 1000;
  t.mock.timers.tick(10 * 60 * 1000);
  await world.app.poller.idle;

  assert.equal(world.hungaromet.count('observations'), before + 1);
  assert.equal(world.gladys.fake.lastState(stationFeature(world, 'temperature')), 9.4);
  const polls = world.gladys.fake.wsMessages.filter((message) => /poll/i.test(message.type));
  assert.equal(polls.length, 0, 'the core never polled');
  await world.app.stop();
});

test("the core's onPoll is a fallback: skipped after a recent refresh, used when the timer stalls", async () => {
  const world = await createWorld();
  await world.createAll();
  const station = world.gladys.fake.discoveredDevices[0];
  const before = world.hungaromet.count('observations');
  assert.deepEqual(await world.gladys.fake.poll(station), { success: true });
  assert.equal(world.hungaromet.count('observations'), before, 'refreshed recently: skipped');

  world.clock.now += 10 * 60 * 1000;
  withTemperature(world, 6.1);
  await world.gladys.fake.poll(station);
  assert.equal(world.hungaromet.count('observations'), before + 1);
  assert.equal(world.gladys.fake.lastState(stationFeature(world, 'temperature')), 6.1);

  // A device of another integration (or a stale one) is ignored.
  await world.gladys.fake.poll({ external_id: 'ext:test-integration:station:1' });
  assert.equal(world.hungaromet.count('observations'), before + 1);
  await world.app.stop();
});

test('only the changes are published, and an unchanged value is re-sent every 6 hours', async (t) => {
  // The SDK dates its heartbeat with the system clock.
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const world = await createWorld();
  await world.createAll();
  const temperature = stationFeature(world, 'temperature');
  assert.equal(statesOf(world, temperature).length, 1);
  t.mock.timers.setTime(NOW + 10 * 60 * 1000);
  await world.refresh(10);
  assert.equal(statesOf(world, temperature).length, 1, 'unchanged: not sent again');
  t.mock.timers.setTime(NOW + HEARTBEAT + 20 * 60 * 1000);
  world.clock.now += HEARTBEAT;
  await world.refresh(10);
  assert.equal(statesOf(world, temperature).length, 2, 'heartbeat');
  await world.app.stop();
});

test('pace: observations and the 3-hour warning index every cycle, files only when new', async () => {
  const world = await createWorld();
  for (let i = 0; i < 6; i += 1) {
    await world.refresh(10);
  }
  assert.equal(world.hungaromet.count('observations'), 7);
  assert.equal(world.hungaromet.count('stations'), 1);
  const listings = (product) =>
    world.hungaromet.requests.filter((r) => r.endpoint === 'listing' && r.product === product)
      .length;
  assert.equal(listings('waex'), 7);
  assert.equal(listings('wbex'), 3, 'the outlook every 30 minutes');
  // Each warning file is downloaded once, it did not change.
  assert.equal(world.hungaromet.count('warning'), 4);
  // About 28 small requests in this hour, 20 an hour after it.
  assert.ok(world.hungaromet.requests.length <= 30, `${world.hungaromet.requests.length}`);
  await world.app.stop();
});

test('a station silent for hours: its last values are not re-sent as current', async () => {
  const world = await createWorld();
  await world.createAll();
  const recorded = observationsAt(world.clock.now);
  world.hungaromet.answers.observations = () => zip('x.csv', recorded);
  world.clock.now += 4 * 3600 * 1000;
  const before = world.gladys.fake.states.length;
  await world.app.service.cycle();
  const station = world.gladys.fake.states
    .slice(before)
    .filter((state) => state.device_feature_external_id.includes(':station:'));
  assert.deepEqual(station, []);
  await world.app.stop();
});

test('the first run only takes note of the warnings in force: no scene event', async () => {
  const world = await createWorld();
  await world.refresh(10);
  assert.equal(world.gladys.fake.sceneEvents.length, 0);
  await world.app.stop();
});

test('a new warning fires the trigger once, a raised level again, a lifted one fires when re-issued', async () => {
  const world = await createWorld({ start: NOW });
  await world.createAll();
  issueNow(world, FIXTURES.nowNone, 'waex20261119_2100.xml.zip');
  await world.app.service.cycle();
  const events = () => world.gladys.fake.sceneEvents.filter((e) => e.key === WARNING_TRIGGER);
  // The first cycle saw wind in the 3-hour file (baseline); now lifted.
  assert.equal(events().length, 0);

  issueNow(world, FIXTURES.nowActive, 'waex20261119_2200.xml.zip');
  await world.refresh(10);
  assert.equal(events().length, 1);
  assert.deepEqual(events()[0].data, {
    warning_type: 'wind',
    level: 'yellow',
    horizon: 'now',
    level_number: 1,
    type_label: 'Rafales',
    level_label: 'Jaune',
    horizon_label: '3 prochaines heures',
    is_update: false,
    description: 'The windspeed can temporarily exceed 70 km/h.',
    area: 'Bólyi',
  });

  await world.refresh(10);
  assert.equal(events().length, 1, 'the same warning: no second event');

  issueNow(
    world,
    FIXTURES.nowActive.replace('<level code="1">1</level>', '<level code="2">2</level>'),
    'waex20261119_2230.xml.zip',
  );
  await world.refresh(10);
  assert.equal(events().length, 2);
  assert.equal(events()[1].data.level, 'orange');
  assert.equal(events()[1].data.is_update, true);
  assert.equal(world.gladys.fake.lastState(areaFeature(world, 'warning_now')), 2);
  await world.app.stop();
});

test('outlook warnings fire once per Hungarian day, announced for tomorrow then not again for today', async () => {
  const world = await createWorld();
  const events = () => world.gladys.fake.sceneEvents.filter((e) => e.key === WARNING_TRIGGER);
  // Tomorrow gets the rain of the day-after file.
  world.hungaromet.products.wcex = {
    name: 'wcex20261119_2100.xml.zip',
    xml: () => withExpiry(FIXTURES.day2Active, '20261120'),
  };
  await world.refresh(30);
  assert.deepEqual(
    events().map((e) => [e.data.horizon, e.data.warning_type, e.data.area]),
    [['tomorrow', 'rain', 'Baranya']],
  );
  // Next morning, the same rain is today's.
  world.clock.now = Date.parse('2026-11-20T06:00:00Z');
  world.hungaromet.products.wbex = {
    name: 'wbex20261120_0600.xml.zip',
    xml: () => withExpiry(FIXTURES.day2Active, '20261120'),
  };
  await world.app.service.cycle({ forceOutlook: true });
  assert.deepEqual(
    events().filter((e) => e.data.horizon === 'today'),
    [],
  );
  await world.app.stop();
});

test('a restart does not fire again for the warnings already announced', async () => {
  const store = new MemoryStore();
  const first = await createWorld({ store });
  issueNow(first, FIXTURES.nowNone, 'waex20261119_2100.xml.zip');
  await first.refresh(10);
  issueNow(first, FIXTURES.nowActive, 'waex20261119_2200.xml.zip');
  await first.refresh(10);
  assert.equal(first.gladys.fake.sceneEvents.length, 1);
  await first.app.stop();

  const second = await createWorld({ store });
  await second.refresh(10);
  assert.equal(second.gladys.fake.sceneEvents.length, 0);
  await second.app.stop();
});

test('the trigger data match the filters declared in the manifest', async () => {
  const { readFile } = await import('node:fs/promises');
  const manifest = JSON.parse(
    await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
  );
  const [trigger] = manifest.scene_triggers;
  const world = await createWorld();
  issueNow(world, FIXTURES.nowNone, 'waex20261119_2100.xml.zip');
  await world.refresh(10);
  issueNow(world, FIXTURES.nowActive, 'waex20261119_2200.xml.zip');
  await world.refresh(10);
  const [event] = world.gladys.fake.sceneEvents;
  for (const field of trigger.fields) {
    const values = field.options.map((option) => option.value);
    assert.ok(values.includes(event.data[field.key]), `${field.key}: ${event.data[field.key]}`);
  }
  for (const variable of trigger.variables) {
    assert.ok(variable.key in event.data, `variable ${variable.key}`);
  }
  await world.app.stop();
});

test('a district narrows the 3-hour warnings, the outlook stays the county one', async () => {
  const world = await createWorld({ config: { district: 'Sellyei' } });
  await world.createAll();
  const id = 'd207';
  assert.equal(world.gladys.fake.discoveredDevices[1].name, 'Alertes HungaroMet Sellyei');
  assert.equal(world.gladys.fake.lastState(areaFeature(world, 'warning_now', id)), 0);
  assert.equal(world.gladys.fake.lastState(areaFeature(world, 'warning_today', id)), 1);
  await world.app.stop();
});

test('Budapest: the 3-hour warnings of Budapest, the outlook of Pest county', async () => {
  const world = await createWorld({
    connect: false,
    config: { latitude: '47.43', longitude: '19.18' },
  });
  // The recorded outlook, Baranya renamed Pest (13).
  world.hungaromet.products.wbex.xml = () =>
    withExpiry(FIXTURES.todayActive, '20261119').replace(
      '<areadesc code="2">Baranya',
      '<areadesc code="13">Pest',
    );
  await world.gladys.connect();
  await world.app.ready;
  await world.createAll();
  const [station, area] = world.gladys.fake.discoveredDevices;
  assert.equal(station.name, 'HungaroMet Budapest Pestszentlőrinc');
  assert.equal(area.name, 'Alertes HungaroMet Budapest');
  assert.equal(world.gladys.fake.lastState(areaFeature(world, 'warning_today', 'c1')), 1);
  assert.equal(world.gladys.fake.lastState(areaFeature(world, 'warning_now', 'c1')), 0);
  await world.app.stop();
});

test('a chosen station and county, and a station that measures less', async () => {
  const world = await createWorld({ config: { station_id: '44165', county: '6' } });
  await world.createAll();
  const [station, area] = world.gladys.fake.discoveredDevices;
  assert.equal(station.name, 'HungaroMet Budapest Újpest');
  assert.equal(area.name, 'Alertes HungaroMet Csongrád-Csanád');
  assert.equal(statesOf(world, stationFeature(world, 'pressure', '44165')).length, 0);
  assert.equal(world.gladys.fake.lastState(stationFeature(world, 'temperature', '44165')), 8.7);
  await world.app.stop();
});

test('a normal refresh cycle writes nothing at info level, and never the home coordinates', async () => {
  const world = await createWorld();
  await world.createAll();
  const before = world.logs.at('info').length;
  for (let i = 0; i < 4; i += 1) {
    await world.refresh(10);
  }
  assert.equal(world.logs.at('info').length, before);
  for (const line of world.logs.lines) {
    assert.doesNotMatch(line.text, /46\.07|18\.22/);
  }
  await world.app.stop();
});

test('a network cut is logged once, its recovery once, shown in the status, values kept', async () => {
  const world = await createWorld();
  await world.createAll();
  const cut = new TypeError('fetch failed');
  world.hungaromet.answers.observations = cut;
  world.hungaromet.answers.listing = cut;
  for (let i = 0; i < 3; i += 1) {
    await world.refresh(10);
  }
  const warnings = world.logs.at('warn');
  assert.equal(warnings.filter((l) => /Observations unavailable/.test(l.text)).length, 1);
  assert.equal(warnings.filter((l) => /^Warnings unavailable/.test(l.text)).length, 1);
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  assert.match(world.gladys.fake.connectionStatus.message.fr, /HungaroMet ne répond pas/);
  // The warnings stay as last read.
  assert.equal(world.gladys.fake.lastState(areaFeature(world, 'warning_now')), 1);

  delete world.hungaromet.answers.listing;
  world.hungaromet.answers.observations = () => zip('x.csv', observationsAt(world.clock.now));
  await world.refresh(10);
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
  assert.equal(world.logs.at('info').filter((l) => /answers again/.test(l.text)).length >= 2, true);
  await world.app.stop();
});

test('HungaroMet down at startup: retried at the next cycle, then the devices appear', async () => {
  const world = await createWorld({ connect: false });
  world.hungaromet.answers.stations = { status: 503 };
  await world.gladys.connect();
  await world.app.ready;
  assert.equal(world.gladys.fake.discoveredDevices.length, 0);
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  world.hungaromet.answers.stations = () => FIXTURES.stations;
  await world.refresh(10);
  assert.equal(world.gladys.fake.discoveredDevices.length, 2);
  await world.app.stop();
});

test('configuration problems are reported in the status', async () => {
  const cases = [
    [{ houses: [] }, 'notConfigured'],
    [{ config: { latitude: 'abc', longitude: '19' } }, /illisibles/],
    [{ config: { house: 'gone' } }, /n'existe plus/],
    [{ config: { latitude: '48.85', longitude: '2.35' } }, /ne couvre que la Hongrie/],
    [{ config: { station_id: '99999' } }, /aucune station HungaroMet/],
    [{ config: { station_id: 'abc' } }, /cinq chiffres/],
    [{ config: { district: 'Atlantis' } }, /District inconnu/],
  ];
  for (const [options, expected] of cases) {
    const world = await createWorld(options);
    const status = world.gladys.fake.connectionStatus;
    assert.equal(status.connected, false, JSON.stringify(options));
    assert.equal(typeof status.message, 'object', 'a multi-language object, never a string');
    if (expected instanceof RegExp) {
      assert.match(status.message.fr, expected);
    } else {
      assert.match(status.message.en, /No location/);
    }
    await world.app.stop();
  }
});

test('a configuration change reads the new place', async () => {
  const world = await createWorld();
  await world.gladys.fake.configUpdated({ latitude: '47.58', longitude: '21.58' });
  const names = world.gladys.fake.discoveredDevices.map((device) => device.name);
  assert.ok(names.includes('HungaroMet Debrecen Kismacs'), names.join());
  assert.ok(names.includes('Alertes HungaroMet Hajdú-Bihar'), names.join());
  await world.app.stop();
});

test('a scan request publishes the devices again', async () => {
  const world = await createWorld();
  const before = world.gladys.fake.discoveredDevices.length;
  await world.gladys.fake.scanRequest();
  assert.ok(world.gladys.fake.discoveredDevices.length >= before);
  await world.app.stop();
});

test('the "list the nearest stations" action, with distances (green)', async () => {
  const world = await createWorld();
  const ack = await world.gladys.fake.action('list_stations', {});
  assert.equal(ack.success, true);
  const lines = ack.data.message.fr.split('\n');
  assert.match(lines[0], /maison « Maison »/);
  assert.match(lines[1], /^38528 Pécs Egyetem \(Baranya, 174 m\) — 1,6 km$/);
  assert.match(ack.data.message.de, /Kopiere eine Nummer/);
  await world.app.stop();
});

test('the "list the nearest stations" action fails in red without a location', async () => {
  const world = await createWorld({ houses: [] });
  const ack = await world.gladys.fake.action('list_stations', {});
  assert.equal(ack.success, false);
  assert.match(ack.error.fr, /Aucun lieu/);
  world.hungaromet.answers.observations = new TypeError('fetch failed');
  await world.gladys.fake.configUpdated({ latitude: '47.43', longitude: '19.18' });
  const down = await world.gladys.fake.action('list_stations', {});
  assert.equal(down.success, false);
  assert.match(down.error.en, /HungaroMet failed: .*unreachable/);
  await world.app.stop();
});

test('the "check the connection" action: green when it reads, red when it fails', async () => {
  const world = await createWorld();
  const ack = await world.gladys.fake.action('check_connection', {});
  assert.equal(ack.success, true);
  assert.match(
    ack.data.message.en,
    /HungaroMet answers\. Pécs Egyetem: 7\.2 °C at .*Warnings for Baranya: 2 in force or announced\. Districts of the county: 201 Bólyi, /,
  );
  assert.match(ack.data.message.fr, /7,2 °C/);

  world.hungaromet.answers.observations = { status: 500 };
  world.hungaromet.answers.listing = { status: 500 };
  const failed = await world.gladys.fake.action('check_connection', {});
  assert.equal(failed.success, false);
  assert.match(failed.error.en, /HungaroMet failed: .*HTTP 500|Station failed/);
  assert.ok(failed.error.fr);
  const infos = world.logs.at('info').filter((line) => /Action: check/.test(line.text));
  assert.equal(infos.length, 2, 'one line per user action');
  await world.app.stop();
});

test('feature names follow the configured language', async () => {
  for (const [language, name] of [
    ['en', 'Wind gusts'],
    ['fr', 'Rafales'],
    ['de', 'Windböen'],
    ['es', 'Ráfagas'],
  ]) {
    const world = await createWorld({ config: { language } });
    const [station] = world.gladys.fake.discoveredDevices;
    assert.equal(station.features.find((f) => f.external_id.endsWith(':wind_gust')).name, name);
    await world.app.stop();
  }
});

test('the house is the first located one when none is chosen', async () => {
  const world = await createWorld({
    houses: [
      { id: 'h0', name: 'Nowhere', selector: 'nowhere', latitude: null, longitude: null },
      HOUSE,
    ],
  });
  assert.equal(world.gladys.fake.discoveredDevices[0].name, 'HungaroMet Pécs Egyetem');
  await world.app.stop();
});
