# 2026-09-21c — retrouver le niveau d'élaboration des visuels validés

**chemin réel, base locale, compte de test.**

Tout ce qui porte cette mention est sorti de `GET /api/content-items/[id]/image`
— la route que le bouton de téléchargement appelle — sur un mois généré de bout
en bout pour `isla.thornbury@eklio-test.invalid`, créé pour cette preuve et
jamais retouché à la main.

## ⚠ Il a fallu six mois réels, et cinq comptes de plus, pour arriver ici

Chacun a été gardé, parce que ce que chacun a montré n'est lisible nulle part
ailleurs :

| compte | résultat | ce que ce mois-là a révélé |
|---|---|---|
| `thea.brannon` | 10/30 | le dédoublonnage refusait 106 sujets sur 116 : il mesurait la taille du lot, pas la redondance |
| `wren.ashcombe` | 30/30 | l'entonnoir était vert ; la planche montrait des teintes de marque saturées, un titre tronqué, un nom d'axe sorti de sa bande |
| `juno.calvert` | 23/30 | « nervous system » comptait pour deux mots distinctifs : 51 refus sur 76, banque à sec |
| `perrin.vale` | 30/30 | **5 archétypes sur 11.** Le tirage vidait le premier archétype de chaque famille ; la variété des mois précédents était un artefact de la pénurie |
| `marlow.quint` | 30/30 | deux cartes titrées pareil — deux titres distincts en banque se réduisent au même texte une fois coupés à trente caractères |
| `isla.thornbury` | 30/30 | le mois de ce dossier |

**Quatre de ces six mois affichaient un entonnoir parfait.** 30 écrits, 30
visuels, zéro pénurie, zéro repli — pendant que la planche montrait six
icebergs identiques, ou deux fois le même titre. C'est la raison d'être du
contrôle indépendant décrit plus bas : aucune des mesures que ce pipeline
produit ne regarde une image.

Rien de ce dossier n'a touché la production : pas de `main`, aucune variable
Vercel, aucune connexion à la base de production. La clef Anthropic est passée
par la ligne de commande et n'est écrite dans aucun fichier.

## Ce qu'il y a dedans

| fichier | ce que c'est |
|---|---|
| `visuals/NN-<archétype>.png` | les visuels du mois, un par fichier, 1080×1350 |
| `01-thirty-visuals-1080x1350.png` | la planche à taille de toile |
| `02-thirty-visuals-at-390.png` | la planche à 390px — **la largeur à laquelle la lisibilité se mesure** |
| `03-pair-<archétype>.png` | les onze planches « référence / produit », côte à côte |
| `funnel.json` | l'entonnoir complet du mois : tiré, refusé, réparé, publié, coût |
| `grading/` | les notes de l'agent de contrôle indépendant, brutes |

## Pourquoi 390 et plus 350

La planche de lisibilité était à 350px. Elle est à 390 — un post à pleine
largeur dans un fil de téléphone — et c'est de cette valeur que le plancher
typographique se **déduit** au lieu d'être posé à la main :

```
CONTENT_MIN_AT_CANVAS = ceil(THUMB.minPx × CANVAS.width / THUMB.width)
                      = ceil(10.5 × 1080 / 390)
                      = 30
```

Aucun texte de contenu ne descend sous 30px à 1080, donc sous 10.5px effectifs
à 390.

## Les références, et pourquoi elles sont reconstruites

`design/reference/posts/` **n'existait pas**. `design/reference/` ne contenait
que huit exports d'écrans (`*.dc.html`) et des captures de `home-v3` : aucun
visuel de post, aucune toile 1080×1350.

Les onze références ont donc été **reconstruites depuis la spécification
écrite**, en SVG, par `scripts/reference/build-post-references.ts` — un fichier
qui n'importe rien de `lib/compose`. Une référence produite par le moteur
qu'elle sert à juger ne juge rien. Chacune porte la mention **« référence
reconstruite, pas un rendu produit »** dans son `<title>` et dans son `<desc>`,
et les planches `03-pair-*` la répètent au-dessus de la colonne de gauche.

Voir `design/reference/posts/README.md`.

## Le contrôle indépendant

Un agent qui n'a vu ni le code ni les échanges reçoit deux choses : les onze
références et les trente visuels produits. Il note chaque visuel de 1 à 5 sur
quatre critères — présence et pertinence de l'illustration, teintes par partie,
lisibilité, élaboration par rapport aux références. Ses notes brutes sont dans
`grading/`.
