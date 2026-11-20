// -----------------------------------------------------------------------------
// A simulated HungaroMet open data portal: a `fetch` that answers the files of
// the integration with the recordings of test/fixtures. No network.
//
// The recordings are dated (19 and 20 November 2026): the observations are
// re-dated to the last 10-minute step before the test clock, and the outlook
// files get the Hungarian day they stand for (today, tomorrow, the day after).
// -----------------------------------------------------------------------------

import { crc32, deflateRawSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { hungarianDate } from '../../src/hungaromet/model.js';

const fixture = (name) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

export const FIXTURES = {
  stations: fixture('station-meta.csv'),
  observations: fixture('synop-10min.csv'),
  nowActive: fixture('warnings-now-active.xml'),
  nowNone: fixture('warnings-now-none.xml'),
  todayActive: fixture('outlook-today-active.xml'),
  tomorrowNone: fixture('outlook-tomorrow-none.xml'),
  day2Active: fixture('outlook-day2-active.xml'),
};

/** Test clock: Thursday 19 November 2026, 20:05 in Budapest (19:05 UTC). */
export const NOW = Date.parse('2026-11-19T19:05:00Z');
export const TIME_ZONE = 'Europe/Budapest';

/** A one-entry ZIP archive, as the portal serves them. */
export function zip(name, text) {
  const data = Buffer.from(text, 'utf8');
  const packed = deflateRawSync(data);
  const nameBytes = Buffer.from(name, 'utf8');
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(packed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(0, 42);
  const centralOffset = local.length + nameBytes.length + packed.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBytes.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, nameBytes, packed, central, nameBytes, end]);
}

const stamp = (time) => new Date(time).toISOString().replace(/\D/g, '').slice(0, 12);

/** The recorded observations, the newest row moved to the last step before `now`. */
export function observationsAt(now, text = FIXTURES.observations) {
  const step = Math.floor((now - 5 * 60 * 1000) / (10 * 60 * 1000)) * 10 * 60 * 1000;
  const recorded = Date.UTC(2026, 10, 20, 21, 30);
  return text.replace(/^(\d{12});/gm, (_, time) => {
    const t = Date.UTC(
      +time.slice(0, 4),
      +time.slice(4, 6) - 1,
      +time.slice(6, 8),
      +time.slice(8, 10),
      +time.slice(10, 12),
    );
    return `${stamp(step + (t - recorded))};`;
  });
}

/** A warning file re-dated to a Hungarian day. */
export const withExpiry = (xml, day) =>
  xml.replace(/<expires>\d{8}<\/expires>/, `<expires>${day}</expires>`);

const listing = (names) =>
  `<html><body><pre>${names.map((name) => `<a href="${name}">${name}</a>`).join('\n')}</pre></body></html>`;

/**
 * @param {object} [options]
 * @param {() => number} [options.now]
 */
export function createFakeHungaroMet({ now = () => NOW } = {}) {
  const requests = [];
  // Warning products: the current file name and its XML (a function of now).
  const products = {
    waex: { name: 'waex20261119_2025.xml.zip', xml: () => FIXTURES.nowActive },
    wbex: {
      name: 'wbex20261119_2025.xml.zip',
      xml: () => withExpiry(FIXTURES.todayActive, hungarianDate(now(), 0)),
    },
    wcex: {
      name: 'wcex20261119_2003.xml.zip',
      xml: () => withExpiry(FIXTURES.tomorrowNone, hungarianDate(now(), 1)),
    },
    wdex: {
      name: 'wdex20261119_1320.xml.zip',
      xml: () => withExpiry(FIXTURES.day2Active, hungarianDate(now(), 2)),
    },
  };
  // Answers by endpoint: a body, a function, an Error or { status }.
  const answers = {
    stations: () => FIXTURES.stations,
    observations: () => zip('HABP_10M_SYNOP_LATEST.csv', observationsAt(now())),
  };

  function endpointOf(url) {
    const path = url.pathname;
    if (path.endsWith('/station_meta_auto.csv')) return { endpoint: 'stations' };
    if (path.endsWith('/HABP_10M_SYNOP_LATEST.csv.zip')) return { endpoint: 'observations' };
    const m = /\/weather\/warnings\/(w[a-e]ex)\/(.*)$/.exec(path);
    if (m) return { endpoint: m[2] === '' ? 'listing' : 'warning', product: m[1], file: m[2] };
    return { endpoint: null };
  }

  async function fetch(input) {
    const url = new URL(String(input));
    const { endpoint, product, file } = endpointOf(url);
    requests.push({ endpoint, product, url });
    const answer =
      endpoint === 'listing' || endpoint === 'warning'
        ? (answers[`${endpoint}:${product}`] ?? answers[endpoint])
        : answers[endpoint];
    if (answer instanceof Error) {
      throw answer;
    }
    if (answer && typeof answer === 'object' && answer.status) {
      return new Response(answer.body ?? 'error', { status: answer.status });
    }
    let body = typeof answer === 'function' ? answer(url) : answer;
    if (body === undefined && endpoint === 'listing') {
      body = listing([products[product].name]);
    }
    if (body === undefined && endpoint === 'warning' && file === products[product].name) {
      body = zip(file.replace('.zip', ''), products[product].xml());
    }
    if (body === undefined) {
      return new Response('not found', { status: 404 });
    }
    return new Response(body, { status: 200 });
  }

  return {
    fetch,
    requests,
    answers,
    products,
    /** Requests per endpoint. */
    count: (endpoint) => requests.filter((request) => request.endpoint === endpoint).length,
  };
}
