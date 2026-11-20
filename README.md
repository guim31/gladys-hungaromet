# HungaroMet for Gladys Assistant

The official weather of **Hungary** in [Gladys Assistant](https://gladysassistant.com), from the
open data of **HungaroMet** (formerly OMSZ), the Hungarian Meteorological Service: the readings of
the nearest automatic weather station every 10 minutes, and the official warnings of your county
or district (next 3 hours, today, tomorrow).

No account, no API key. Not affiliated with HungaroMet. Database: Meteorological Database,
HungaroMet Nonprofit Zrt.

## Features

- **Station device**: temperature, humidity, pressure at station level, wind speed, gusts, wind
  direction, rain intensity and visibility of the nearest station (or a chosen one).
- **Warnings device**: the highest warning level for the next 3 hours (by district, or for the
  whole county), the outlook levels for today and tomorrow (by county), and the warnings in words.
- **Scene trigger** "New HungaroMet warning", filtered by type (thunderstorm, wind gusts,
  torrential rain, freezing rain, blowing snow, rain, snowfall, dense fog, extreme cold, heat),
  level (yellow, orange, red) and horizon (next 3 hours, today, tomorrow).
- **Dashboard widget** with the readings and the warnings, each block can be hidden.
- **Actions**: list the nearest stations, check the connection (also lists the districts of the
  county).
- Texts in English, French, German and Spanish.

Compared with [gladys-meteoalarm](https://github.com/guim31/gladys-meteoalarm), which also shows
the Hungarian warnings by county through the European Meteoalarm feed, this integration reads
HungaroMet directly and adds the station readings and the 3-hour warnings by district.

## Requirements

- Gladys Assistant **5.3.0** or later.
- A place in Hungary: a located Gladys house, coordinates, a station or a county.
- Internet access to `odp.met.hu`.

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter
`https://github.com/guim31/gladys-hungaromet` (or install it from the store once listed). Open its
configuration (every field is optional), then add the two devices from the **Discovery** tab.

The user documentation is in [`docs/`](docs/en.md) ([français](docs/fr.md),
[Deutsch](docs/de.md), [español](docs/es.md)).

## How it works

HungaroMet publishes its open data as plain files on [odp.met.hu](https://odp.met.hu/):

- `weather/weather_reports/synoptic/hungary/10_minutes/csv/HABP_10M_SYNOP_LATEST.csv.zip`: the last
  10-minute observation of every automatic station, in one zipped CSV;
- `weather/weather_reports/synoptic/hungary/meta/station_meta_auto.csv`: the stations and their
  county;
- `weather/warnings/waex/`, `wbex/`, `wcex/`, `wdex/`: one zipped XML per issue of the 3-hour
  warnings (by district) and of the outlook for today, tomorrow and the day after (by county).

The integration downloads these whole-country files (about 20 small requests an hour), computes
the nearest station in the container, and only downloads a warning file when a new one is issued.
The house position never leaves Gladys. The ZIP files are read with `node:zlib`, without any
dependency beyond the Gladys SDK.

## Limits

- One place, one station and one warning area per installation.
- The official texts of the warnings are in English (unchanged, as the HungaroMet terms of use
  require).
- Pressure is at station level (HungaroMet does not publish a sea-level value in this file).
- Tested against the real HungaroMet files, not yet on a real Gladys instance: feedback welcome.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
```

The tests run against the SDK's fake Gladys and files recorded from odp.met.hu
([`test/fixtures`](test/fixtures/README.md)); they never touch the network.

Versions and releases belong to the **Release** workflow (Actions → Release): never edit the
`version` of `package.json` or of the manifest by hand. See [`CLAUDE.md`](CLAUDE.md) for the
project rules.

## Credits

- [HungaroMet Nonprofit Zrt.](https://www.met.hu) for the open data (Meteorological Database) and
  its [terms of use](https://odp.met.hu/ODP_General_Term_of_Use.pdf). The cover shows the official
  HungaroMet logo, published on the open data portal.
- The [Gladys Assistant](https://github.com/GladysAssistant) integration template and SDK.

## License

[Apache-2.0](LICENSE).
