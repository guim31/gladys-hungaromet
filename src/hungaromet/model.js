// -----------------------------------------------------------------------------
// HungaroMet open data, parsed: stations, 10-minute observations, warnings.
// Pure functions of the downloaded texts (no network, no clock of their own),
// tested on files recorded from odp.met.hu.
// -----------------------------------------------------------------------------

/** Missing value of the HungaroMet CSV files. */
const MISSING = -999;
const MINUTE = 60 * 1000;
// A value missing from the last row is taken from an earlier one this recent
// (the precipitation of a 10-minute step often arrives one run later).
const FALLBACK_AGE = 30 * MINUTE;

/**
 * The 19 counties and Budapest, with the codes of the warning files: the
 * outlook (wb..we) uses the county code, the 3-hour warnings (wa) the district
 * code, whose hundreds are the county code (204 Pécsi → 2 Baranya). Budapest
 * (district 101) has no county in the outlook: it falls under Pest (13).
 * Codes are forever (they are stored in the configuration).
 */
export const COUNTIES = [
  { code: 1, name: 'Budapest', outlook: 13 },
  { code: 2, name: 'Baranya' },
  { code: 3, name: 'Bács-Kiskun' },
  { code: 4, name: 'Békés' },
  { code: 5, name: 'Borsod-Abaúj-Zemplén' },
  { code: 6, name: 'Csongrád-Csanád' },
  { code: 7, name: 'Fejér' },
  { code: 8, name: 'Győr-Moson-Sopron' },
  { code: 9, name: 'Hajdú-Bihar' },
  { code: 10, name: 'Heves' },
  { code: 11, name: 'Komárom-Esztergom' },
  { code: 12, name: 'Nógrád' },
  { code: 13, name: 'Pest' },
  { code: 14, name: 'Somogy' },
  { code: 15, name: 'Szabolcs-Szatmár-Bereg' },
  { code: 16, name: 'Jász-Nagykun-Szolnok' },
  { code: 17, name: 'Tolna' },
  { code: 18, name: 'Vas' },
  { code: 19, name: 'Veszprém' },
  { code: 20, name: 'Zala' },
];

export const countyByCode = (code) => COUNTIES.find((county) => county.code === code) ?? null;

/** County of a station from the `RegioName` of the metadata ("Budapest XI." → Budapest). */
export function countyOfRegion(region) {
  const name = String(region ?? '').trim();
  if (name.startsWith('Budapest')) {
    return 1;
  }
  return COUNTIES.find((county) => county.name === name)?.code ?? null;
}

/** Warning types, by the letter code of the XML files. Keys are forever. */
export const WARNING_TYPES = {
  a: 'thunderstorm',
  b: 'wind',
  c: 'torrential_rain',
  d: 'freezing_rain',
  e: 'blowing_snow',
  f: 'rain',
  g: 'snow',
  h: 'fog',
  i: 'cold',
  j: 'heat',
};
export const WARNING_TYPE_KEYS = Object.values(WARNING_TYPES);

/** Levels 1 to 3 of the HungaroMet warning system, by key. Keys are forever. */
export const WARNING_LEVELS = { 1: 'yellow', 2: 'orange', 3: 'red' };
export const WARNING_LEVEL_KEYS = Object.values(WARNING_LEVELS);

/** Horizons of the warnings: 3-hour warning, outlook for today and tomorrow. */
export const HORIZONS = ['now', 'today', 'tomorrow'];

const round1 = (value) => Math.round(value * 10) / 10;

/** "202611202130" (UTC) → epoch ms. */
function parseUtcStamp(stamp) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(stamp).trim());
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}

/** Semicolon CSV with padded cells → array of { header: value } (trimmed). */
function parseCsv(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  if (lines.length === 0) {
    return [];
  }
  const header = lines[0].split(';').map((cell) => cell.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(';');
    return Object.fromEntries(header.map((key, i) => [key, (cells[i] ?? '').trim()]));
  });
}

const number = (text) => {
  if (text === undefined || text === '') {
    return null;
  }
  const value = Number(text);
  return Number.isFinite(value) && value !== MISSING ? value : null;
};

/**
 * Station metadata (station_meta_auto.csv): one entry per station, from its
 * most recent period.
 * @returns {Array<{ id: string, name: string, lat: number, lon: number, altitude: number | null, county: number | null, until: string }>}
 */
export function parseStations(text) {
  const byId = new Map();
  for (const row of parseCsv(text)) {
    const id = String(Number(row.StationNumber));
    const lat = number(row.Latitude);
    const lon = number(row.Longitude);
    if (!/^\d+$/.test(id) || lat === null || lon === null) {
      continue;
    }
    const entry = {
      id,
      name: row.StationName,
      lat,
      lon,
      altitude: number(row.Elevation),
      county: countyOfRegion(row.RegioName),
      until: row.EndDate,
    };
    const previous = byId.get(id);
    if (!previous || entry.until > previous.until) {
      byId.set(id, entry);
    }
  }
  if (byId.size === 0) {
    throw new Error('the station list is empty or unreadable');
  }
  return [...byId.values()];
}

/** CSV columns → value of the station device, converted to the published units. */
const FIELDS = {
  temperature: { column: 't', convert: round1 },
  humidity: { column: 'u', convert: Math.round },
  pressure: { column: 'p', convert: round1 },
  wind_speed: { column: 'fs', convert: (ms) => round1(ms * 3.6) },
  wind_gust: { column: 'fx', convert: (ms) => round1(ms * 3.6) },
  wind_direction: { column: 'fsd', convert: Math.round },
  // A 10-minute sum, published as an hourly rate.
  rain_rate: { column: 'r', convert: (mm) => round1(mm * 6) },
  visibility: { column: 'v', convert: (m) => round1(m / 1000) },
};
export const OBSERVATION_KEYS = Object.keys(FIELDS);

/**
 * The latest observation of every station (HABP_10M_SYNOP_*.csv). The file
 * also repeats corrections of the last 24 hours: per station, the newest row
 * wins, a value it lacks is taken from a row at most 30 minutes older.
 * @returns {Map<string, { id: string, name: string, lat: number, lon: number, time: number, values: Record<string, number> }>}
 */
export function parseObservations(text) {
  const rows = parseCsv(text);
  if (rows.length === 0 || !('StationNumber' in rows[0])) {
    throw new Error('the observation file is empty or unreadable');
  }
  const byId = new Map();
  for (const row of rows) {
    const id = String(Number(row.StationNumber));
    const time = parseUtcStamp(row.Time);
    if (time === null || !/^\d+$/.test(id)) {
      continue;
    }
    const list = byId.get(id) ?? [];
    list.push({ row, time });
    byId.set(id, list);
  }
  const result = new Map();
  for (const [id, list] of byId) {
    list.sort((a, b) => b.time - a.time);
    const [latest] = list;
    const values = {};
    for (const [key, { column, convert }] of Object.entries(FIELDS)) {
      for (const { row, time } of list) {
        if (latest.time - time > FALLBACK_AGE) {
          break;
        }
        const value = number(row[column]);
        if (value !== null) {
          values[key] = convert(value);
          break;
        }
      }
    }
    // The vane reads 0 in a calm: no direction without wind.
    if (values.wind_speed === 0) {
      delete values.wind_direction;
    }
    result.set(id, {
      id,
      name: latest.row.StationName,
      lat: number(latest.row.Latitude),
      lon: number(latest.row.Longitude),
      time: latest.time,
      values,
    });
  }
  return result;
}

/** Great-circle distance in km. */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * The `count` stations nearest to a point, closest first.
 * @param {Array<{ lat: number, lon: number }>} stations
 */
export function nearestStations(stations, lat, lon, count) {
  return stations
    .map((station) => ({ ...station, distance: distanceKm(lat, lon, station.lat, station.lon) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

/** The newest file of a product in its index page, or null. */
export function latestFileName(html, product) {
  const pattern = new RegExp(`${product}\\d{8}_\\d{4}\\.xml\\.zip`, 'g');
  const names = [...new Set(String(html).match(pattern) ?? [])].sort();
  return names.at(-1) ?? null;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (text) =>
  String(text)
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ENTITIES[name])
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .trim();
const tag = (xml, name) => {
  const m = new RegExp(`<${name}(?:\\s+code="([^"]*)")?[^>]*>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? { code: m[1] ?? null, text: decode(m[2]) } : null;
};

/**
 * One warning file (waex / wbex / wcex / wdex XML).
 * @returns {{ type: string, issued: number | null, expires: string | null, areas: Array<{ code: number, name: string }>, warnings: Array<{ area: number, areaName: string, type: string, level: number, text: string }> }}
 */
export function parseWarningFile(xml) {
  const text = String(xml);
  if (!/<msg>/.test(text)) {
    throw new Error('the warning file is not a HungaroMet message');
  }
  const issuedCode = tag(text, 'issued')?.code;
  const issued = issuedCode ? Date.parse(`${issuedCode.replace(' ', 'T')}Z`) : null;
  const expires = tag(text, 'expires')?.text ?? '';
  const areas = [...text.matchAll(/<msgArea code="(\d+)">([^<]*)<\/msgArea>/g)].map((m) => ({
    code: Number(m[1]),
    name: decode(m[2]),
  }));
  const warnings = [];
  for (const [, block] of text.matchAll(/<area>([\s\S]*?)<\/area>/g)) {
    const area = tag(block, 'areadesc');
    for (const [, info] of block.matchAll(/<info>([\s\S]*?)<\/info>/g)) {
      const event = tag(info, 'event');
      const level = Number(tag(info, 'level')?.code);
      const type = WARNING_TYPES[event?.code];
      if (!area || !type || !WARNING_LEVELS[level]) {
        continue;
      }
      warnings.push({
        area: Number(area.code),
        areaName: area.text,
        type,
        level,
        text: tag(info, 'description')?.text ?? '',
      });
    }
  }
  return {
    type: tag(text, 'msgType')?.code ?? null,
    issued: Number.isFinite(issued) ? issued : null,
    // The outlook files expire at the end of a day (YYYYMMDD); the 3-hour
    // warnings say "for the next 3 hours" and stay valid until the next issue.
    expires: /^\d{8}$/.test(expires) ? expires : null,
    areas,
    warnings,
  };
}

/** The local date in Hungary, YYYYMMDD: the days of the outlook are Hungarian days. */
export function hungarianDate(time, offsetDays = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(time));
  const get = (type) => Number(parts.find((part) => part.type === type).value);
  const day = new Date(Date.UTC(get('year'), get('month') - 1, get('day') + offsetDays));
  return day.toISOString().slice(0, 10).replaceAll('-', '');
}

/** Districts of a county, from the area list of a 3-hour warning file. */
export const districtsOf = (file, county) =>
  (file?.areas ?? []).filter((area) => area.code >= 100 && Math.floor(area.code / 100) === county);

/**
 * Find a district typed by the user: its code ("204") or its name, with or
 * without the "-i" suffix and accents ("Pécsi", "pecs").
 */
export function findDistrict(file, typed) {
  const fold = (value) =>
    String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/i$/, '').trim();
  const wanted = fold(typed);
  return (
    (file?.areas ?? []).find(
      (area) =>
        area.code >= 100 &&
        (String(area.code) === String(typed).trim() || fold(area.name) === wanted),
    ) ?? null
  );
}

/**
 * The warnings of one place for one horizon, the strongest first, one per type.
 * @param {ReturnType<typeof parseWarningFile> | null} file
 * @param {(areaCode: number) => boolean} matches
 */
export function warningsFor(file, matches) {
  const byType = new Map();
  for (const warning of file?.warnings ?? []) {
    if (!matches(warning.area)) {
      continue;
    }
    const previous = byType.get(warning.type);
    if (!previous || warning.level > previous.level) {
      byType.set(warning.type, warning);
    }
  }
  return [...byType.values()].sort(
    (a, b) =>
      b.level - a.level || WARNING_TYPE_KEYS.indexOf(a.type) - WARNING_TYPE_KEYS.indexOf(b.type),
  );
}

/** Highest level of a list of warnings, 0 when none. */
export const maxLevel = (warnings) => warnings.reduce((max, w) => Math.max(max, w.level), 0);

/**
 * Pick, among the parsed outlook files, the one for a given Hungarian day:
 * the most recently issued whose `expires` is that day.
 */
export function outlookForDay(files, day) {
  return (
    files
      .filter((file) => file && file.expires === day)
      .sort((a, b) => (b.issued ?? 0) - (a.issued ?? 0))[0] ?? null
  );
}
