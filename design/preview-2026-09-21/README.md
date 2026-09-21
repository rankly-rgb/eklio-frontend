# Vraies publications, générées par l'app — 2026-09-21

Seize captures, toutes à **1440 px** (les visuels à leur taille native), toutes
prises sur `next dev` servant la base locale — **147 migrations rejouées** — et
le compte de test.

**Aucun fichier de ce dossier n'est une fixture.** Chacun porte l'étiquette
**« chemin réel, base locale, compte de test »** et rien d'autre. Le texte, les
diagrammes, les couleurs, les dates, la ligne « Why this one » et la ligne
déontologique sont tous sortis de l'application, contre Postgres et contre
l'API Anthropic. Rien n'a touché Vercel ni la base de production.

## Le compte

Rowan Mercier, LMFT fictive à Oakland (CA). EMDR en tête, pour deux
populations du catalogue — « Professionals who look fine from outside » et
« Adults at a crossroads they did not choose » : le burnout au retour au
travail. Brand kit complet généré par la vraie route, direction `warm-signal`
choisie, palette `clay_sand` / `olive_chalk`, check-in d'octobre rempli,
accès par `comp_grant`. Banque à **26 sujets par segment**, exactement.

## Les fichiers

### Le mois

| fichier | ce qu'il montre |
|---|---|
| `01-month-stream.png` | Le flux d'octobre 2026 : **16 cartes** générées, chacune avec son thème, son registre, sa date, son extrait de légende et son « Why this one » — puis ses propres posts en dessous. |
| `02-month-calendar.png` | Le même mois en vue calendrier. |

### Le panneau d'écriture

| fichier | ce qu'il montre |
|---|---|
| `03-new-post-write-panel.png` | Le panneau « New post » tel qu'il s'ouvre : trois sujets tirés de sa banque, son champ d'idée libre, le choix Single card / Carousel, et le coût en crédits **avant** le clic. |
| `06-manual-post-incomplete.png` | Un post manuel incomplet — titre saisi, légende vide signalée en rouge — avec le panneau de génération au-dessus. |
| `09-write-panel-disarmed.png` | Le panneau **désarmé**, après correction : il dit « switched on **here** » et non « for your account », et il nomme le verrou exact là où un détail technique a le droit d'être lu. |

### Les trois « Write it », cliqués pour de vrai

Playwright s'est connecté par l'écran de connexion, a ouvert « New post »
depuis le calendrier, et a **cliqué sur le bouton**. Rien n'a été posté à la
route par-dessus l'interface.

| fichier | ce qu'il montre | tentatives |
|---|---|---|
| `10-write-it-from-suggested-topic.png` | Depuis un sujet suggéré — « The Efficient Nervous System Paradox ». | 4 |
| `11-write-it-from-free-idea.png` | Depuis son idée : « why rest feels hard after going back to work ». | 1 |
| `12-write-it-carousel.png` | Un carrousel de 4 cartes, avec la mention du moteur « Slide 2 · cut words: glosses dropped ». | 1 |

⚠ **Les tentatives sont le chiffre intéressant.** Un refus n'est pas une
panne : c'est le budget de mots qui fait son travail (`label` 1-3 mots,
`gloss` 1-6). Le sujet suggéré a demandé quatre clics ; l'idée libre et le
carrousel un seul.

### Le carrousel, slide par slide

| fichier | ce qu'il montre |
|---|---|
| `13-carousel-slide-1.png` … `-4.png` | Les quatre cartes, une par fichier, en **1080 × 1350**, servies par `GET /api/content-items/[id]/image?slide=N` — la route que le bouton de téléchargement appelle. |

### Les planches

| fichier | ce qu'il montre |
|---|---|
| `07-visuals-12-1080x1350.png` | Les douze premiers visuels qui composent, chacun à sa taille native de 1080 × 1350. |
| `08-visuals-12-at-350.png` | La même planche, cartes ramenées à 350 px — la largeur d'une vignette dans un fil. |

## Ce que ces captures ont coûté de trouver

**`12` et `13` n'auraient pas pu être prises la veille.** L'écran de relecture
inlinait un `<svg width="1080" height="1350">` dans un conteneur
`max-w-[420px] overflow-hidden` : un SVG à dimensions absolues ne se met pas à
l'échelle, il est **rogné**. Toutes les cartes étaient coupées aux deux tiers.

**`09` non plus.** Naima a signalé un « Write it » sur lequel elle ne pouvait
pas cliquer ; trois défauts se cachaient derrière ce seul bouton gris, dont
celui-ci : taper un titre faisait disparaître le panneau tout entier.

**Et cinq titres sont tronqués sur `07` et `08`** — ce n'est pas la mise en
page. `content_items.title` est borné à 34 caractères, la banque écrit des
titres « d'au plus huit mots », et `cardBands` fait du titre le bandeau de la
carte. Les trois ne se sont jamais parlé.

Le détail des neuf défauts est dans `../../FIRST_REAL_RENDER.md`.

## Ce qui a servi à les produire

`scripts/local-render/` — cinq scripts et un fichier SQL, écrits pour ce rendu
et conservés pour qu'il soit reproductible. Deux d'entre eux comblent des
pilotes qui n'existaient nulle part dans les deux dépôts : l'envoi d'un lot à
la Batch API, et le remplissage de la banque de sujets. Tout ce qui juge ce
qu'ils écrivent — schéma, RPC, validateurs de payload, gardes déontologiques,
moteur de composition — est celui du produit.
