# Rituels

Suivi d'habitudes pour téléphone. Appli web installable, hors ligne, sans compte, sans serveur.
Idées reprises de Habo (fait, pas fait, sauté qui ne casse pas la série, notes, archives), sans son code.

## Les quatre écrans

- Aujourd'hui : anneau du jour, semaine en haut, une tuile par habitude. Toucher = fait. ••• = pas fait, sauté, note.
- Calendrier : 15 semaines par habitude, série, record, taux sur 30 jours. Toucher un jour l'ouvre pour le modifier.
- Objectifs : ce que vous voulez accomplir cette année ou l'an prochain (financier, patrimoine, immobilier…),
  mesuré par un montant, des étapes ou une estimation. Pourcentage atteint et rythme : en avance, dans les temps, en retard.
- Habitudes : ajouter, modifier (jours, couleur, émoji), réordonner, archiver, supprimer, exporter et importer, choisir le thème.

## Types d'habitudes

- À cocher : fait ou pas fait.
- Chiffrée : objectif et unité (2 L, 20 pages). Chaque appui sur la tuile ajoute le pas choisi ; − pour corriger.
- À arrêter (tabac, sucre) : chaque jour compte comme tenu, sauf écart noté. La tuile affiche « X j sans ».
- Fréquence : jours fixes, ou « X fois par semaine ». La série se compte alors en semaines,
  et l'habitude sort de l'anneau du jour une fois l'objectif de la semaine atteint.

## Suivi

- Humeur du jour (5 émojis) en bas de l'écran Aujourd'hui.
- Bilan de la semaine en haut du Calendrier (semaine en cours ou précédente) : taux de réussite,
  meilleure série, habitude à relancer, jour le plus difficile, humeur et lien humeur / habitude.
  Le dimanche, un bandeau sur Aujourd'hui y renvoie.
- Série en danger : à partir de 18 h pour les séries quotidiennes, et à tout moment quand un
  objectif hebdomadaire devient juste.
- Célébration (animation et vibration) quand la journée devient complète.

## Routines

Une habitude peut appartenir à une routine (champ « Routine »), avec une durée, une consigne, une liste et un journal.
La routine a sa carte, son anneau et un minuteur guidé étape par étape.

## Thèmes

Verre par défaut (toujours clair), Verre nuit et Classique, dans Habitudes > Apparence.

## Fichiers

- `index.html`, `styles.css`, `app.js` : l'appli
- `logic.js` : calculs de séries et de taux (testés)
- `sw.js`, `manifest.webmanifest`, `icons/` : installation et mode hors ligne
- `tests/logic.test.mjs` : `node --test tests/logic.test.mjs`
- `tools/make-icons.mjs` : régénère les icônes

## Installer sur l'iPhone

1. Mettre le dossier en ligne en HTTPS (GitHub Pages, gratuit).
2. Ouvrir l'adresse dans Safari, bouton Partager, « Sur l'écran d'accueil ».
3. Ouvrir Rituels depuis l'icône : les données restent sur le téléphone.

Exporter une sauvegarde de temps en temps : supprimer l'icône efface les données.

## Limites de cette version

- Pas de rappels : sur iPhone, une appli web a besoin d'un serveur pour envoyer des notifications.
- Pas de synchronisation entre appareils.
