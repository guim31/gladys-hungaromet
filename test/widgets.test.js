// -----------------------------------------------------------------------------
// The "HungaroMet weather" widget: budget of the core, languages, units, the
// setting that hides a block, and the name given in Gladys.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY, buildWeatherContent } from '../src/widgets.js';
import { FIXTURES } from './helpers/fakeHungaroMet.js';
import { createWorld } from './helpers/world.js';

const get = async (world, { language = 'en', units = 'metric', settings } = {}) => {
  const ack = await world.gladys.fake.widgetGet(WIDGET_KEY, { language, units, settings });
  assert.equal(ack.success, true);
  return ack.data.content;
};
const ofType = (content, type) => content.components.filter((c) => c.type === type);

test('the full content fits the budget of the core', async () => {
  const world = await createWorld();
  const content = await get(world);
  assert.deepEqual(validateWidgetContent(content), []);
  assert.ok(content.components.length <= 8);
  assert.ok(ofType(content, 'text').length <= 2);
  assert.equal(ofType(content, 'text')[0].text, 'Pécs Egyetem');
  assert.deepEqual(
    ofType(content, 'value').map((tile) => [tile.label, tile.value, tile.unit]),
    [
      ['Temperature', 7.2, '°C'],
      ['Humidity', 98, '%'],
      ['Wind', 2.9, 'km/h'],
      ['Gusts', 5.4, 'km/h'],
    ],
  );
  const [status] = ofType(content, 'status');
  assert.deepEqual(
    status.items.map((item) => [item.label, item.value]),
    [
      ['Next 3 hours', 'Yellow · Wind gusts'],
      ['Today', 'Yellow · Wind gusts'],
    ],
  );
  assert.match(
    ofType(content, 'text').at(-1).text,
    /^Data: HungaroMet Nonprofit Zrt\. · 0?8:00 PM$/,
  );
  await world.app.stop();
});

test('US units, French texts, and no warning at all', async () => {
  const world = await createWorld({ connect: false });
  world.hungaromet.products.waex.xml = () => FIXTURES.nowNone;
  world.hungaromet.products.wbex.xml = () => FIXTURES.tomorrowNone;
  await world.gladys.connect();
  await world.app.ready;
  const content = await get(world, { language: 'fr', units: 'us' });
  assert.deepEqual(ofType(content, 'value')[0], {
    type: 'value',
    label: 'Température',
    value: 45,
    unit: '°F',
    icon: 'thermometer',
  });
  const [status] = ofType(content, 'status');
  assert.deepEqual(status.items, [
    { label: 'Alertes · Baranya', value: 'Aucune', color: 'success', icon: 'check-circle' },
  ]);
  await world.app.stop();
});

test('the blocks setting hides the readings or the warnings', async () => {
  const world = await createWorld();
  const warningsOnly = await get(world, { settings: { blocks: ['warnings'] } });
  assert.equal(ofType(warningsOnly, 'value').length, 0);
  assert.equal(ofType(warningsOnly, 'status').length, 1);
  const readingsOnly = await get(world, { settings: { blocks: ['readings'] } });
  assert.equal(ofType(readingsOnly, 'status').length, 0);
  assert.equal(ofType(readingsOnly, 'value').length, 4);
  await world.app.stop();
});

test('the heading is the name given in Gladys, and the widget refreshes on a rename', async () => {
  const world = await createWorld();
  const [station] = world.gladys.fake.discoveredDevices;
  await world.gladys.fake.deviceCreated({ ...station, name: 'Jardin' });
  const content = await get(world);
  assert.equal(ofType(content, 'text')[0].text, 'Jardin');
  await world.app.stop();
});

test('not configured, then waiting: a single text', () => {
  const t0 = buildWeatherContent(
    { target: null, observation: null, levels: { now: null, today: null, tomorrow: null } },
    { language: 'de', units: 'metric', now: 0 },
  );
  assert.equal(t0.components.length, 1);
  assert.match(t0.components[0].text, /Lege den Ort/);
  const waiting = buildWeatherContent(
    {
      target: { station: { id: '1', name: 'X' }, area: null },
      observation: null,
      levels: { now: null, today: null, tomorrow: null },
    },
    { language: 'es', units: 'metric', now: 0 },
  );
  assert.match(waiting.components[0].text, /Esperando/);
});
