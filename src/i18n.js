// -----------------------------------------------------------------------------
// Every text the integration produces, in the four languages of the Gladys
// interface: English, French, German (informal "du") and Spanish (formal
// "usted"). Feature names follow the `language` of the configuration (they are
// frozen once the device is created); widget texts follow the language of the
// dashboard. The official warning texts of HungaroMet are passed on unchanged
// (in English), as its terms of use require. test/i18n.test.js checks every table.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

/** Feature names, by language then feature key. */
export const FEATURE_NAMES = {
  en: {
    temperature: 'Temperature',
    humidity: 'Humidity',
    pressure: 'Pressure (station level)',
    wind_speed: 'Wind speed',
    wind_gust: 'Wind gusts',
    wind_direction: 'Wind direction',
    rain_rate: 'Rain intensity',
    visibility: 'Visibility',
    warning_now: 'Warning, next 3 hours',
    warning_today: 'Warning outlook, today',
    warning_tomorrow: 'Warning outlook, tomorrow',
    warnings: 'Weather warnings',
  },
  fr: {
    temperature: 'Température',
    humidity: 'Humidité',
    pressure: 'Pression (station)',
    wind_speed: 'Vitesse du vent',
    wind_gust: 'Rafales',
    wind_direction: 'Direction du vent',
    rain_rate: 'Intensité de pluie',
    visibility: 'Visibilité',
    warning_now: 'Alerte, 3 prochaines heures',
    warning_today: "Vigilance, aujourd'hui",
    warning_tomorrow: 'Vigilance, demain',
    warnings: 'Alertes météo',
  },
  de: {
    temperature: 'Temperatur',
    humidity: 'Luftfeuchtigkeit',
    pressure: 'Luftdruck (Station)',
    wind_speed: 'Windgeschwindigkeit',
    wind_gust: 'Windböen',
    wind_direction: 'Windrichtung',
    rain_rate: 'Regenintensität',
    visibility: 'Sichtweite',
    warning_now: 'Warnung, nächste 3 Stunden',
    warning_today: 'Warnvorschau, heute',
    warning_tomorrow: 'Warnvorschau, morgen',
    warnings: 'Wetterwarnungen',
  },
  es: {
    temperature: 'Temperatura',
    humidity: 'Humedad',
    pressure: 'Presión (estación)',
    wind_speed: 'Velocidad del viento',
    wind_gust: 'Ráfagas',
    wind_direction: 'Dirección del viento',
    rain_rate: 'Intensidad de lluvia',
    visibility: 'Visibilidad',
    warning_now: 'Alerta, próximas 3 horas',
    warning_today: 'Previsión de alertas, hoy',
    warning_tomorrow: 'Previsión de alertas, mañana',
    warnings: 'Alertas meteorológicas',
  },
};

/** Warning types, by language then type key. */
export const WARNING_TYPE_NAMES = {
  en: {
    thunderstorm: 'Thunderstorm',
    wind: 'Wind gusts',
    torrential_rain: 'Torrential rain',
    freezing_rain: 'Freezing rain',
    blowing_snow: 'Blowing snow',
    rain: 'Rain',
    snow: 'Snowfall',
    fog: 'Dense fog',
    cold: 'Extreme cold',
    heat: 'Heat',
  },
  fr: {
    thunderstorm: 'Orage',
    wind: 'Rafales',
    torrential_rain: 'Pluie torrentielle',
    freezing_rain: 'Pluie verglaçante',
    blowing_snow: 'Congères',
    rain: 'Pluie',
    snow: 'Neige',
    fog: 'Brouillard dense',
    cold: 'Grand froid',
    heat: 'Canicule',
  },
  de: {
    thunderstorm: 'Gewitter',
    wind: 'Sturmböen',
    torrential_rain: 'Starkregen',
    freezing_rain: 'Glatteisregen',
    blowing_snow: 'Schneeverwehungen',
    rain: 'Dauerregen',
    snow: 'Schneefall',
    fog: 'Dichter Nebel',
    cold: 'Strenge Kälte',
    heat: 'Hitze',
  },
  es: {
    thunderstorm: 'Tormenta',
    wind: 'Rachas de viento',
    torrential_rain: 'Lluvia torrencial',
    freezing_rain: 'Lluvia helada',
    blowing_snow: 'Ventisca',
    rain: 'Lluvia',
    snow: 'Nevada',
    fog: 'Niebla densa',
    cold: 'Frío extremo',
    heat: 'Calor',
  },
};

/** Warning levels, by language then level key. */
export const WARNING_LEVEL_NAMES = {
  en: { yellow: 'Yellow', orange: 'Orange', red: 'Red' },
  fr: { yellow: 'Jaune', orange: 'Orange', red: 'Rouge' },
  de: { yellow: 'Gelb', orange: 'Orange', red: 'Rot' },
  es: { yellow: 'Amarilla', orange: 'Naranja', red: 'Roja' },
};

/** Horizons of a warning, by language. */
export const HORIZON_NAMES = {
  en: { now: 'Next 3 hours', today: 'Today', tomorrow: 'Tomorrow' },
  fr: { now: '3 prochaines heures', today: "Aujourd'hui", tomorrow: 'Demain' },
  de: { now: 'Nächste 3 Stunden', today: 'Heute', tomorrow: 'Morgen' },
  es: { now: 'Próximas 3 horas', today: 'Hoy', tomorrow: 'Mañana' },
};

/** Fixed messages, each a multi-language object. */
export const TEXT = {
  noWarning: {
    en: 'No warning',
    fr: 'Aucune alerte',
    de: 'Keine Warnung',
    es: 'Ninguna alerta',
  },
  warningsDevice: {
    en: 'HungaroMet warnings',
    fr: 'Alertes HungaroMet',
    de: 'HungaroMet-Warnungen',
    es: 'Alertas HungaroMet',
  },
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les journaux de l'intégration.",
    de: 'Die Initialisierung ist fehlgeschlagen, sieh in den Protokollen der Integration nach.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },
  notConfigured: {
    en: 'No location: set the position of a Gladys house, or pick a house, coordinates, a station or a county.',
    fr: "Aucun lieu : renseignez la position d'une maison Gladys, ou choisissez une maison, des coordonnées, une station ou un comitat.",
    de: 'Kein Ort: Lege die Position eines Gladys-Zuhauses fest oder wähle ein Zuhause, Koordinaten, eine Station oder ein Komitat.',
    es: 'Ningún lugar: defina la posición de una casa de Gladys, o elija una casa, coordenadas, una estación o un condado.',
  },
  coordinatesInvalid: {
    en: 'The latitude and longitude are not readable: type two numbers, such as 47.50 and 19.04.',
    fr: 'Latitude et longitude illisibles : saisissez deux nombres, comme 47,50 et 19,04.',
    de: 'Breiten- und Längengrad sind nicht lesbar: Gib zwei Zahlen ein, etwa 47,50 und 19,04.',
    es: 'La latitud y la longitud no son legibles: escriba dos números, como 47,50 y 19,04.',
  },
  stationIdInvalid: {
    en: 'The station number has five digits, such as 44527: use the "List the nearest stations" action.',
    fr: "Le numéro de station a cinq chiffres, comme 44527 : utilisez l'action « Lister les stations proches ».",
    de: 'Die Stationsnummer hat fünf Ziffern, etwa 44527: Nutze die Aktion „Nächste Stationen anzeigen“.',
    es: 'El número de estación tiene cinco cifras, como 44527: use la acción «Listar las estaciones cercanas».',
  },
  houseNotFound: {
    en: 'The chosen house no longer exists or has no position: pick it again, or set its position in Gladys.',
    fr: "La maison choisie n'existe plus ou n'a pas de position : choisissez-la de nouveau, ou placez-la dans Gladys.",
    de: 'Das gewählte Zuhause gibt es nicht mehr oder es hat keine Position: Wähle es erneut oder lege seine Position in Gladys fest.',
    es: 'La casa elegida ya no existe o no tiene posición: elíjala de nuevo, o defina su posición en Gladys.',
  },
  outsideHungary: {
    en: 'This location is more than 50 km from any HungaroMet station: HungaroMet only covers Hungary.',
    fr: 'Ce lieu est à plus de 50 km de toute station HungaroMet : HungaroMet ne couvre que la Hongrie.',
    de: 'Dieser Ort ist mehr als 50 km von jeder HungaroMet-Station entfernt: HungaroMet deckt nur Ungarn ab.',
    es: 'Este lugar está a más de 50 km de cualquier estación de HungaroMet: HungaroMet solo cubre Hungría.',
  },
  stationUnknown: {
    en: 'This station number is not among the HungaroMet stations reporting now: use the "List the nearest stations" action.',
    fr: "Ce numéro ne correspond à aucune station HungaroMet qui publie en ce moment : utilisez l'action « Lister les stations proches ».",
    de: 'Diese Nummer gehört zu keiner HungaroMet-Station, die gerade meldet: Nutze die Aktion „Nächste Stationen anzeigen“.',
    es: 'Este número no corresponde a ninguna estación de HungaroMet que publique ahora: use la acción «Listar las estaciones cercanas».',
  },
  districtUnknown: {
    en: 'The district is unknown: type its name or code as listed by the "Check the connection" action. Warnings of the whole county meanwhile.',
    fr: "District inconnu : saisissez son nom ou son code comme les liste l'action « Tester la connexion ». En attendant, alertes de tout le comitat.",
    de: 'Unbekannter Kreis: Gib seinen Namen oder Code ein, wie ihn die Aktion „Verbindung prüfen“ auflistet. Bis dahin Warnungen des ganzen Komitats.',
    es: 'Distrito desconocido: escriba su nombre o código como los lista la acción «Comprobar la conexión». Mientras tanto, alertas de todo el condado.',
  },
  unreachable: {
    en: 'HungaroMet does not answer: the values will be updated when it is back.',
    fr: 'HungaroMet ne répond pas : les valeurs seront mises à jour à son retour.',
    de: 'HungaroMet antwortet nicht: Die Werte werden aktualisiert, sobald der Dienst zurück ist.',
    es: 'HungaroMet no responde: los valores se actualizarán cuando vuelva.',
  },
};

/** Texts of the widget, by language. */
export const WIDGET_TEXT = {
  en: {
    temperature: 'Temperature',
    humidity: 'Humidity',
    wind: 'Wind',
    gusts: 'Gusts',
    warnings: 'Warnings',
    none: 'None',
    source: 'Data: HungaroMet Nonprofit Zrt.',
    notConfigured: 'Set the location in the integration configuration.',
    waiting: 'Waiting for the first HungaroMet data…',
  },
  fr: {
    temperature: 'Température',
    humidity: 'Humidité',
    wind: 'Vent',
    gusts: 'Rafales',
    warnings: 'Alertes',
    none: 'Aucune',
    source: 'Données : HungaroMet Nonprofit Zrt.',
    notConfigured: "Indiquez le lieu dans la configuration de l'intégration.",
    waiting: 'En attente des premières données HungaroMet…',
  },
  de: {
    temperature: 'Temperatur',
    humidity: 'Feuchte',
    wind: 'Wind',
    gusts: 'Böen',
    warnings: 'Warnungen',
    none: 'Keine',
    source: 'Daten: HungaroMet Nonprofit Zrt.',
    notConfigured: 'Lege den Ort in der Konfiguration der Integration fest.',
    waiting: 'Warte auf die ersten HungaroMet-Daten…',
  },
  es: {
    temperature: 'Temperatura',
    humidity: 'Humedad',
    wind: 'Viento',
    gusts: 'Ráfagas',
    warnings: 'Alertas',
    none: 'Ninguna',
    source: 'Datos: HungaroMet Nonprofit Zrt.',
    notConfigured: 'Indique el lugar en la configuración de la integración.',
    waiting: 'Esperando los primeros datos de HungaroMet…',
  },
};

/** Texts of the configuration actions, by language. */
export const ACTION_TEXT = {
  en: {
    nearest: (where) => `Stations reporting now, nearest to ${where}:`,
    station: (s) => `${s.id} ${s.name} (${s.county}, ${s.altitude} m) — ${s.distance} km`,
    copy: 'Copy a number into "Weather station" and save, or leave it empty for the nearest one.',
    checkOk: (parts) => `HungaroMet answers. ${parts}`,
    observation: (name, value, time) => `${name}: ${value} °C at ${time}.`,
    warningsCount: (area, count) => `Warnings for ${area}: ${count} in force or announced.`,
    districts: (list) => `Districts of the county: ${list}.`,
    failed: (what, reason) => `${what} failed: ${reason}.`,
    stationPart: 'Station',
    warningsPart: 'Warnings',
    yourHouse: (name) => `the house “${name}”`,
    coordinates: 'the configured coordinates',
  },
  fr: {
    nearest: (where) => `Stations qui publient, les plus proches de ${where} :`,
    station: (s) => `${s.id} ${s.name} (${s.county}, ${s.altitude} m) — ${s.distance} km`,
    copy: 'Copiez un numéro dans « Station météo » et enregistrez, ou laissez vide pour la plus proche.',
    checkOk: (parts) => `HungaroMet répond. ${parts}`,
    observation: (name, value, time) => `${name} : ${value} °C à ${time}.`,
    warningsCount: (area, count) => `Alertes pour ${area} : ${count} en cours ou annoncée(s).`,
    districts: (list) => `Districts du comitat : ${list}.`,
    failed: (what, reason) => `${what} : échec (${reason}).`,
    stationPart: 'Station',
    warningsPart: 'Alertes',
    yourHouse: (name) => `la maison « ${name} »`,
    coordinates: 'les coordonnées saisies',
  },
  de: {
    nearest: (where) => `Stationen, die gerade melden, am nächsten zu ${where}:`,
    station: (s) => `${s.id} ${s.name} (${s.county}, ${s.altitude} m) — ${s.distance} km`,
    copy: 'Kopiere eine Nummer in „Wetterstation“ und speichere, oder lass das Feld leer für die nächste.',
    checkOk: (parts) => `HungaroMet antwortet. ${parts}`,
    observation: (name, value, time) => `${name}: ${value} °C um ${time}.`,
    warningsCount: (area, count) => `Warnungen für ${area}: ${count} aktiv oder angekündigt.`,
    districts: (list) => `Kreise des Komitats: ${list}.`,
    failed: (what, reason) => `${what} fehlgeschlagen: ${reason}.`,
    stationPart: 'Station',
    warningsPart: 'Warnungen',
    yourHouse: (name) => `Zuhause „${name}“`,
    coordinates: 'eingegebene Koordinaten',
  },
  es: {
    nearest: (where) => `Estaciones que publican ahora, más cercanas a ${where}:`,
    station: (s) => `${s.id} ${s.name} (${s.county}, ${s.altitude} m) — ${s.distance} km`,
    copy: 'Copie un número en «Estación meteorológica» y guarde, o déjelo vacío para la más cercana.',
    checkOk: (parts) => `HungaroMet responde. ${parts}`,
    observation: (name, value, time) => `${name}: ${value} °C a las ${time}.`,
    warningsCount: (area, count) => `Alertas para ${area}: ${count} en vigor o anunciada(s).`,
    districts: (list) => `Distritos del condado: ${list}.`,
    failed: (what, reason) => `${what}: error (${reason}).`,
    stationPart: 'Estación',
    warningsPart: 'Alertas',
    yourHouse: (name) => `la casa «${name}»`,
    coordinates: 'las coordenadas indicadas',
  },
};

/** The language to use, English for anything Gladys may send we do not know. */
export const pickLanguage = (language) => (LANGUAGES.includes(language) ? language : 'en');

/** A decimal number with the separator of the language: 8.6 → "8,6" in French. */
export const formatNumber = (value, language, digits = 1) =>
  new Intl.NumberFormat(pickLanguage(language), { maximumFractionDigits: digits }).format(value);

/** "Orange · Wind gusts" */
export function warningLabel(warning, language) {
  const lang = pickLanguage(language);
  const level = WARNING_LEVEL_NAMES[lang][['', 'yellow', 'orange', 'red'][warning.level]];
  return `${level} · ${WARNING_TYPE_NAMES[lang][warning.type]}`;
}

/** A short local date and time: "Tue 18:00" in the Gladys time zone. */
export function formatWhen(time, language, timeZone, now) {
  const lang = pickLanguage(language);
  const sameDay =
    new Date(time).toLocaleDateString('en-CA', { timeZone }) ===
    new Date(now).toLocaleDateString('en-CA', { timeZone });
  return new Intl.DateTimeFormat(lang, {
    timeZone,
    ...(sameDay ? {} : { weekday: 'short' }),
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}
