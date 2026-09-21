# Premier rendu réel — 2026-09-21

Huit captures, toutes à **1440 px**, toutes prises sur `next dev` servant la
base locale (**147 migrations rejouées**) et le compte de test.

**Aucun fichier de ce dossier n'est une fixture.** Chacun porte l'étiquette
**« chemin réel, base locale, compte de test »** et rien d'autre. Le texte, les
diagrammes, les couleurs, les dates, la ligne « Why this one » et la ligne
déontologique sont tous sortis de l'application, contre Postgres et contre
l'API Anthropic.

## Le compte

Rowan Mercier, LMFT fictive à Oakland (CA). EMDR en tête, pour deux
populations du catalogue — « Professionals who look fine from outside » et
« Adults at a crossroads they did not choose » — c'est-à-dire le burnout au
retour au travail. Brand kit complet, direction `warm-signal` choisie,
palette `clay_sand` / `olive_chalk` réelle, check-in d'octobre rempli.

## Les fichiers

| fichier | ce qu'il montre | étiquette |
|---|---|---|
| `01-month-stream.png` | Le flux d'octobre 2026 : **16 cartes** générées, chacune avec son thème, son registre, sa date, son extrait de légende et son « Why this one », plus les trois posts écrits à la demande sous « Your own posts ». | chemin réel, base locale, compte de test |
| `02-month-calendar.png` | Le même mois en vue calendrier. | chemin réel, base locale, compte de test |
| `03-new-post-write-panel.png` | Le panneau « New post » tel qu'il s'ouvre : trois sujets tirés de sa banque, son champ d'idée libre, le choix Single card / Carousel, et le coût en crédits **avant** le clic. | chemin réel, base locale, compte de test |
| `04-write-it-review-single.png` | La relecture après « Write it » sur une carte simple — l'idée libre « why rest feels hard after going back to work ». | chemin réel, base locale, compte de test |
| `05-write-it-review-carousel.png` | La relecture après « Write it » sur un carrousel : quatre cartes en 4:5, la mention du moteur « Slide 2 · cut words: glosses dropped », et la ligne déontologique. | chemin réel, base locale, compte de test |
| `06-manual-post-incomplete.png` | Un post manuel incomplet — titre saisi, légende vide signalée en rouge — avec le panneau de génération au-dessus. | chemin réel, base locale, compte de test |
| `07-visuals-12-1080x1350.png` | La planche des douze premiers visuels qui composent, chacun à sa taille native de 1080 × 1350. | chemin réel, base locale, compte de test |
| `08-visuals-12-at-350.png` | La même planche, cartes ramenées à 350 px de large. | chemin réel, base locale, compte de test |

## Ce que les captures montrent et qu'on ne voyait pas avant

**`05` n'aurait pas pu être prise avant aujourd'hui.** L'écran de relecture
inlinait un `<svg width="1080" height="1350">` dans un conteneur
`max-w-[420px] overflow-hidden` : un SVG à dimensions absolues ne se met pas à
l'échelle, il est **rogné**. Toutes les cartes étaient coupées aux deux tiers,
chaque titre tranché en plein mot, et les vignettes de carrousel réduites à
une colonne de 200 px de large sur 1350 de haut. Corrigé dans
`components/content/review-surface.tsx` ; le détail est dans le rapport.

**`08` est la capture qui sert à décider quelque chose.** À 350 px — la
largeur d'une vignette dans un fil — les *glosses* des diagrammes (cartes 4,
5, 8, 12) sont à la limite du lisible. Les cartes à une seule phrase (1, 2, 6,
9) tiennent sans effort. C'est un arbitrage de direction artistique, pas un
défaut, et il se voit mieux ici que partout ailleurs.

**Cinq titres sont tronqués sur `07` et `08`**, et ce n'est pas la mise en
page : `content_items.title` est borné à **34 caractères** par un CHECK, la
banque écrit des titres « d'au plus huit mots », et `cardBands` fait du titre
le bandeau de titre de la carte. Les trois ne se sont jamais parlé. Le harnais
ramène le titre sur une frontière de mot pour que la ligne entre en base ; le
rapport dit pourquoi ce n'est pas la réparation.

## Ce qui a servi à les produire

`scripts/local-render/` — quatre scripts et un fichier SQL, écrits pour ce
rendu et conservés pour qu'il soit reproductible. Deux d'entre eux comblent
des pilotes qui n'existaient nulle part dans les deux dépôts : l'envoi d'un
lot à la Batch API, et le remplissage de la banque de sujets. Tout ce qui
juge ce qu'ils écrivent — schéma, RPC, validateurs de payload, gardes
déontologiques, moteur de composition — est celui du produit.
