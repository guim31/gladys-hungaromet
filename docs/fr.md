# HungaroMet

La météo officielle de la **Hongrie** dans Gladys, d'après les données ouvertes de **HungaroMet**
(ex-OMSZ), le service météorologique hongrois : les mesures de la **station automatique** la plus
proche toutes les 10 minutes, et les **alertes météo officielles** de votre comitat ou district :
les alertes des 3 prochaines heures et la vigilance d'aujourd'hui et de demain.

Données ouvertes : ni compte, ni clé d'API. Base de données : Meteorological Database, HungaroMet
Nonprofit Zrt. Cette intégration n'a aucun lien avec HungaroMet.

## Présentation

- **Deux appareils** : la station la plus proche (température, humidité, pression, vent, rafales,
  direction du vent, intensité de pluie, visibilité) et les alertes de votre comitat, ou de votre
  district pour les alertes à 3 heures.
- **Un déclencheur de scène**, « Nouvelle alerte HungaroMet », dès qu'une alerte est émise pour les
  3 prochaines heures, aujourd'hui ou demain.
- **Un widget** de tableau de bord avec les mesures et les alertes.
- **Lecture seule** : HungaroMet est une source de données, rien n'est piloté.

L'intégration [Meteoalarm](https://github.com/guim31/gladys-meteoalarm) affiche aussi les alertes
hongroises, par comitat, via le flux européen Meteoalarm. Celle-ci lit HungaroMet directement : elle
ajoute les mesures des stations et les alertes à 3 heures, que HungaroMet émet par district.

## Prérequis

- Gladys **5.3.0** ou plus récent.
- Un lieu en **Hongrie**.
- Votre maison Gladys placée sur la carte (**Paramètres → Maisons**), ou des coordonnées, une
  station ou un comitat saisis dans la configuration.
- Gladys doit accéder à Internet (`odp.met.hu`).

## Configuration

Installez l'intégration depuis **Intégrations → Installer depuis GitHub** (ou depuis le store), puis
ouvrez sa configuration. Tous les champs sont facultatifs : par défaut, l'intégration prend la
position de votre première maison placée, la station la plus proche et les alertes de son comitat,
et se rafraîchit toutes les 10 minutes.

| Champ                              | Usage                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Maison                             | La maison dont la position est utilisée. Vide : la première maison qui a une position.                                             |
| Latitude, Longitude                | Un autre lieu qu'une maison, par exemple `47,50` et `19,04` (le point marche aussi). Les deux, ou aucune.                          |
| Station météo                      | Le numéro d'une station HungaroMet, par exemple `44527` (Budapest Pestszentlőrinc). Vide : la plus proche.                         |
| Comitat des alertes                | L'un des 19 comitats ou Budapest. Vide : le comitat du lieu.                                                                       |
| District des alertes à 3 heures    | Le nom ou le code d'un district (járás), par exemple `Pécsi` ou `204`. Vide : tout le comitat.                                     |
| Fréquence de rafraîchissement      | 10, 20, 30 ou 60 minutes. Les stations publient toutes les 10 minutes.                                                             |
| Langue des noms de fonctionnalités | Langue des noms de fonctionnalités (fixés à la création des appareils) et des textes des événements de scène. Français par défaut. |

La position de la maison est lue grâce à la permission `location` de Gladys, affichée à
l'installation. Elle ne quitte jamais Gladys : HungaroMet publie des fichiers pour tout le pays, et
la station la plus proche est calculée dans l'intégration. Elle n'est jamais écrite dans les
journaux.

Ouvrez ensuite l'onglet **Découverte** de l'intégration et ajoutez les deux appareils à Gladys.

## Appareils

### Station

Le nom est « HungaroMet » suivi du nom de la station. Valeurs de la dernière observation sur
10 minutes :

| Fonctionnalité     | Unité | Remarque                                                  |
| ------------------ | ----- | --------------------------------------------------------- |
| Température        | °C    | Température de l'air                                      |
| Humidité           | %     |                                                           |
| Pression (station) | hPa   | Pression à l'altitude de la station, non ramenée à la mer |
| Vitesse du vent    | km/h  | Moyenne sur 10 minutes (convertie depuis les m/s)         |
| Rafales            | km/h  | Plus forte rafale des 10 dernières minutes                |
| Direction du vent  | °     | D'où vient le vent : 0 = nord, 90 = est                   |
| Intensité de pluie | mm/h  | Pluie des 10 dernières minutes, en taux horaire           |
| Visibilité         | km    |                                                           |

Une station qui ne mesure pas une valeur (beaucoup n'ont ni baromètre ni visibilimètre) laisse la
fonctionnalité vide. Une station muette depuis plus de 3 heures n'est plus republiée comme actuelle.

### Alertes

Le nom est « Alertes HungaroMet » (dans la langue de la configuration) suivi du comitat ou du
district. HungaroMet émet les alertes à 3 heures par district et la vigilance par comitat ; Budapest
reprend la vigilance du comitat de Pest.

| Fonctionnalité              | Unité | Remarque                                                                                         |
| --------------------------- | ----- | ------------------------------------------------------------------------------------------------ |
| Alerte, 3 prochaines heures | 0 à 3 | Niveau le plus haut en cours : 0 aucun, 1 jaune, 2 orange, 3 rouge (district ou comitat)         |
| Vigilance, aujourd'hui      | 0 à 3 | Niveau le plus haut de la vigilance du jour pour le comitat                                      |
| Vigilance, demain           | 0 à 3 | Niveau le plus haut de la vigilance de demain pour le comitat                                    |
| Alertes météo               | texte | Toutes les alertes, ex. « 3 prochaines heures : Jaune · Rafales \| Aujourd'hui : Jaune · Pluie » |

Sans district, « Alerte, 3 prochaines heures » est le niveau le plus haut de tous les districts du
comitat. Types d'alerte : orage, rafales, pluie torrentielle, pluie verglaçante, congères, pluie,
neige, brouillard dense, grand froid, canicule.

## Widget

**Météo HungaroMet** affiche, dans la langue et les unités du tableau de bord :

- le nom de la station (tel que nommée dans Gladys), puis sa température, son humidité, le vent et
  les rafales ;
- les alertes des 3 prochaines heures, d'aujourd'hui et de demain, ou une ligne verte « Aucune » ;
- la source et l'heure de l'observation.

Son réglage **Blocs affichés** masque les mesures ou les alertes.

## Déclencheur de scène

**Nouvelle alerte HungaroMet** se déclenche quand HungaroMet émet une alerte pour la zone, ou en
relève le niveau. Une alerte à 3 heures ne se redéclenche qu'après avoir été levée puis réémise ;
une alerte de vigilance se déclenche une fois par jour et par type, qu'elle soit vue d'abord pour
demain ou pour aujourd'hui. Un redémarrage ne la redéclenche pas, et le tout premier démarrage se
contente de noter les alertes déjà émises.

Filtres (vide = tous) : **Types d'alerte**, **Niveaux** (jaune, orange, rouge) et **Échéance**
(3 prochaines heures, aujourd'hui, demain).

Informations transmises aux actions de la scène : type d'alerte, niveau, échéance, niveau (1 à 3),
les clés du type, du niveau et de l'échéance, niveau relevé, texte officiel (en anglais, inchangé)
et district ou comitat. Par exemple, un message : `HungaroMet : alerte
{{triggerEvent.data.type_label}} {{triggerEvent.data.level_label}}
({{triggerEvent.data.horizon_label}})`.

## Actions de configuration

- **Lister les stations proches** : les 8 stations qui publient, les plus proches du lieu, avec
  leur numéro, leur comitat, leur altitude et leur distance. Copiez un numéro dans « Station météo »
  pour en choisir une autre.
- **Tester la connexion** : lit toutes les sources tout de suite et dit ce qui a répondu : la
  température de la station et son heure, le nombre d'alertes, et les districts du comitat avec
  leur code.

## Exemples de scènes

- **Orage en approche** : déclencheur « Nouvelle alerte HungaroMet », types « Orage » et
  « Rafales », échéance « 3 prochaines heures » → fermer les volets, rentrer le store, envoyer un
  message.
- **Pluie verglaçante demain** : déclencheur « Nouvelle alerte HungaroMet », type « Pluie
  verglaçante », échéance « Demain » → rappeler de partir plus tôt et de couvrir le pare-brise.
- **Après-midi chaud** : quand « Température » dépasse 30 °C → fermer les volets côté sud.

## Dépannage

- **« Aucun lieu »** : aucune maison n'a de position. Placez votre maison sur la carte dans
  **Paramètres → Maisons**, ou saisissez des coordonnées, une station ou un comitat.
- **« À plus de 50 km de toute station HungaroMet »** : le lieu est hors de Hongrie.
- **« District inconnu »** : lancez **Tester la connexion**, qui liste les districts du comitat
  avec leur code, puis saisissez l'un d'eux.
- **« HungaroMet ne répond pas »** : Gladys n'accède pas à `odp.met.hu` ; les valeurs seront mises
  à jour à son retour. Les journaux disent quelle source échoue, une fois, et quand elle remarche.
- **Une fonctionnalité reste vide** : la station ne la mesure pas. Choisissez-en une autre avec
  **Lister les stations proches**.
- **Plus de détails** : passez la variable `LOG_LEVEL` du conteneur à `debug`.

## Limites

- **Données** : données ouvertes de HungaroMet, libres d'usage en citant la source (« Database:
  Meteorological Database, HungaroMet Nonprofit Zrt. », affichée par le widget). Le vent est
  converti des m/s en km/h et la pluie en taux horaire ; les alertes et leurs textes officiels sont
  transmis sans modification.
- **Requêtes** : une vingtaine de petits fichiers par heure au rythme par défaut (observations et
  index des alertes à 3 heures à chaque rafraîchissement, index de la vigilance toutes les
  30 minutes, un fichier d'alerte seulement quand un nouveau est émis, liste des stations une fois
  par jour). HungaroMet ne publie aucune limite de débit.
- Un lieu, une station et une zone par installation.
- Les noms des fonctionnalités sont fixés à la création des appareils : changer la langue ensuite ne
  les renomme pas.
- Les textes officiels des alertes sont en anglais (HungaroMet les publie aussi en hongrois).
- Testée sur les vrais fichiers de HungaroMet, mais pas encore sur une vraie instance Gladys : vos
  retours sont les bienvenus.
