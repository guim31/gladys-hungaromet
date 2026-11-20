// -----------------------------------------------------------------------------
// The HTTP client: addresses, archives, and the failures it turns into
// readable errors (network down, HTTP error, damaged archive).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { URLS, createHungaroMetClient } from '../src/hungaromet/client.js';
import { zip } from './helpers/fakeHungaroMet.js';

const answering = (body, status = 200) => {
  const seen = [];
  const fetch = async (url, init) => {
    seen.push({ url: String(url), init });
    return new Response(body, { status });
  };
  return { fetch, seen };
};

test('the files of the portal, with a user agent and nothing personal', async () => {
  const { fetch, seen } = answering(zip('x.csv', 'StationNumber\n1'));
  const client = createHungaroMetClient({ fetch });
  assert.equal(await client.observations(), 'StationNumber\n1');
  assert.equal(seen[0].url, URLS.observations);
  assert.match(seen[0].init.headers['user-agent'], /gladys-hungaromet/);
  await client.warningFile('waex', 'waex20261119_2025.xml.zip');
  assert.equal(seen[1].url, 'https://odp.met.hu/weather/warnings/waex/waex20261119_2025.xml.zip');
  await client.listing('wbex');
  assert.equal(seen[2].url, 'https://odp.met.hu/weather/warnings/wbex/');
  await client.observationFile('HABP_10M_SYNOP_20261120213805.csv.zip');
  assert.match(seen[3].url, /10_minutes\/csv\/HABP_10M_SYNOP_20261120213805\.csv\.zip$/);
});

test('a file name that is not a warning file is never requested', () => {
  const { fetch, seen } = answering('x');
  const client = createHungaroMetClient({ fetch });
  assert.throws(() => client.warningFile('waex', '../../etc/passwd'), /unexpected warning file/);
  assert.throws(() => client.observationFile('../x.csv.zip'), /unexpected observation file/);
  assert.equal(seen.length, 0);
});

test('network down, HTTP error, timeout and damaged archive: readable errors', async () => {
  const down = createHungaroMetClient({
    fetch: async () => {
      throw new TypeError('fetch failed');
    },
  });
  await assert.rejects(down.stations(), /odp\.met\.hu unreachable \(fetch failed\)/);

  const slow = createHungaroMetClient({
    fetch: async () => {
      const err = new Error('timeout');
      err.name = 'TimeoutError';
      throw err;
    },
    timeoutMs: 5000,
  });
  await assert.rejects(slow.listing('waex'), /no answer within 5 s/);

  const failing = createHungaroMetClient(answering('oops', 503));
  await assert.rejects(
    failing.observations(),
    (err) => err.status === 503 && /HTTP 503/.test(err.message),
  );

  const damaged = createHungaroMetClient(answering('<html>maintenance</html>'));
  await assert.rejects(damaged.observations(), /not a ZIP archive/);
});
