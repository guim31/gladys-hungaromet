# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-20

### Added

- HungaroMet in Gladys: the official Hungarian weather, from open data, no account and no key.
- A station device with the 10-minute readings of the nearest automatic weather station (or a
  chosen one): temperature, humidity, pressure, wind speed, gusts, wind direction, rain intensity
  and visibility.
- A warnings device for your county, or your district: the highest level for the next 3 hours,
  the outlook levels for today and tomorrow, and the warnings in words.
- A scene trigger "New HungaroMet warning", filtered by type, level and horizon, with the official
  text of the warning.
- A dashboard widget with the readings and the warnings, each block can be hidden.
- Two configuration actions: list the nearest stations, check the connection.
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-hungaromet/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-hungaromet/releases/tag/v1.0.0
