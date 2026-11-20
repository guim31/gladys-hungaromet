// -----------------------------------------------------------------------------
// HTTP client of the HungaroMet Open Data Portal (odp.met.hu): plain files
// behind an Apache directory listing, no account, no key.
//   - weather_reports/synoptic/hungary/meta/station_meta_auto.csv: stations;
//   - weather_reports/synoptic/hungary/10_minutes/csv/HABP_10M_SYNOP_LATEST.csv.zip:
//     the last 10-minute observation of every automatic station (one file);
//   - warnings/<product>/: one zipped XML per issue, listed by the index page
//     (waex: warnings for the next 3 hours, wbex/wcex/wdex: outlook for today,
//     tomorrow and the day after, English texts).
// Read-only GET requests; nothing personal is ever sent (the nearest station
// is computed in the container, the portal only serves whole-country files).
// -----------------------------------------------------------------------------

import { unzipFirst } from './zip.js';

const BASE = 'https://odp.met.hu/weather';
export const URLS = {
  stations: `${BASE}/weather_reports/synoptic/hungary/meta/station_meta_auto.csv`,
  observationsDir: `${BASE}/weather_reports/synoptic/hungary/10_minutes/csv/`,
  observations: `${BASE}/weather_reports/synoptic/hungary/10_minutes/csv/HABP_10M_SYNOP_LATEST.csv.zip`,
  warnings: `${BASE}/warnings/`,
};

/** The warning products read, by role. */
export const PRODUCTS = { now: 'waex', today: 'wbex', tomorrow: 'wcex', day2: 'wdex' };

/** An answer that is not the expected file: `status` is the HTTP status, if any. */
export class HungaroMetError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'HungaroMetError';
    this.status = status;
  }
}

/**
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {number} [options.timeoutMs]
 * @param {string} [options.userAgent]
 * @param {{ debug: Function }} [options.logger]
 */
export function createHungaroMetClient({
  fetch = globalThis.fetch,
  timeoutMs = 20000,
  userAgent = 'gladys-hungaromet (+https://github.com/guim31/gladys-hungaromet)',
  logger,
} = {}) {
  async function get(address) {
    const url = new URL(address);
    const where = url.host + url.pathname;
    logger?.debug(`GET ${where}`);
    let response;
    try {
      response = await fetch(url, {
        headers: { 'user-agent': userAgent },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const reason =
        err.name === 'TimeoutError' ? `no answer within ${timeoutMs / 1000} s` : err.message;
      throw new HungaroMetError(`${url.host} unreachable (${reason})`);
    }
    if (!response.ok) {
      throw new HungaroMetError(`${where} answered HTTP ${response.status}`, response.status);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async function getZipped(address) {
    const body = await get(address);
    try {
      return unzipFirst(body).data.toString('utf8');
    } catch (err) {
      throw new HungaroMetError(`${new URL(address).pathname}: ${err.message}`);
    }
  }

  return {
    /** Metadata of the automatic stations (CSV text). */
    stations: async () => (await get(URLS.stations)).toString('utf8'),

    /** Latest 10-minute observations of every station (CSV text). */
    observations: () => getZipped(URLS.observations),

    /** Index page of the 10-minute files (HTML text). */
    observationListing: async () => (await get(URLS.observationsDir)).toString('utf8'),

    /** One dated 10-minute file (CSV text). */
    observationFile: (name) => {
      if (!/^HABP_10M_SYNOP_\d{14}\.csv\.zip$/.test(name)) {
        throw new HungaroMetError(`unexpected observation file name ${name}`);
      }
      return getZipped(`${URLS.observationsDir}${name}`);
    },

    /** Index page of a warning product (HTML text). */
    listing: async (product) => (await get(`${URLS.warnings}${product}/`)).toString('utf8'),

    /** One warning file (XML text). */
    warningFile: (product, name) => {
      if (!/^w[a-e][eh]x\d{8}_\d{4}\.xml\.zip$/.test(name)) {
        throw new HungaroMetError(`unexpected warning file name ${name}`);
      }
      return getZipped(`${URLS.warnings}${product}/${name}`);
    },
  };
}
