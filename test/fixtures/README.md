# Fixtures

Files recorded from the HungaroMet open data portal (https://odp.met.hu/), 19 and 20 November 2026.
Public data, no personal information. Database: Meteorological Database, HungaroMet Nonprofit Zrt.

| File                         | Source                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `synop-10min-latest.zip`     | `weather/weather_reports/synoptic/hungary/10_minutes/csv/HABP_10M_SYNOP_LATEST.csv.zip`, as served |
| `synop-10min.csv`            | the same file, unzipped, 16 stations kept                                       |
| `station-meta.csv`           | `weather/weather_reports/synoptic/hungary/meta/station_meta_auto.csv`, same stations |
| `warnings-now-active.xml`    | `weather/warnings/waex/waex20261119_2025.xml.zip`: wind gusts in Baranya and Bács-Kiskun |
| `warnings-now-none.xml`      | `weather/warnings/waex/waex20261120_2003.xml.zip`: no warning                   |
| `outlook-today-active.xml`   | `weather/warnings/wbex/wbex20261119_2025.xml.zip`                               |
| `outlook-tomorrow-none.xml`  | `weather/warnings/wcex/wcex20261120_2003.xml.zip`                               |
| `outlook-day2-active.xml`    | `weather/warnings/wdex/wdex20261120_1320.xml.zip`: rain in Baranya, Somogy, Tolna |
| `listing-waex.html`          | the index page of `weather/warnings/waex/`                                      |
| `gladys-feature-table.json`  | category/type couples of the Gladys core (see its `source`)                     |
