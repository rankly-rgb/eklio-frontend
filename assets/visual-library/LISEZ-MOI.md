# Pack visuels Eklio — préparé le 1er novembre 2026

142 fichiers issus des 5 lots générés sur ChatGPT, renommés, normalisés et vectorisés.

## Contenu

| Dossier | Fichiers | Format |
|---|---|---|
| 01-illustrations | 65 | SVG recolorable + PNG transparent, carré ≤1024 |
| 02-fonds | 30 | JPEG 1080×1080, désaturé |
| 03-textures | 10 | JPEG 1024×1024, niveaux de gris |
| 04-formes | 17 | SVG recolorable + PNG transparent |
| 05-accents | 20 | SVG recolorable + PNG transparent, format conservé |

`correspondance.csv` — identifiant ↔ nom ChatGPT d'origine.
`themes.csv` — identifiant ↔ thèmes, pour que le moteur choisisse le dessin par le sens.
`_proof.html` — preuve de recoloration.

## SVG

Chaque tracé est en `fill="currentColor"` : la couleur vient du CSS parent,
donc le même dessin sort en terracotta chez l'une et en vert sauge chez l'autre.

## Les 6 illustrations à reprendre

- `emdr-lighthouse` — faisceau jaune
- `practice-notebook`, `agency-open-gate`, `practice-doorway`, `practice-two-cups`, `eft-nest` — aplats noirs massifs

Prompt de reprise : `Redraw. Outline only, no filled areas, no colour at all.`

## Manquants

- `shape-pebble`, `shape-ribbon-fold`
- `bg-marble-vein`, `bg-concrete-soft`, `bg-candle-glow`

## Identifiants `xtra-`

7 fichiers en plus de la spécification, conservés et nommés `xtra-*`.
Sans thèmes attribués : ils ne seront pas tirés tant qu'on ne leur en donne pas.

## Note

Les PNG transparents ont été retirés du pack : ce sont des doublons des SVG,
qui sont strictement meilleurs (recolorables, sans perte à toute taille).
