# Le premier rendu réel — 2026-09-21

Branche `claude/great-brahmagupta-za7qmx`. La partie 1 est livrée en `824227b`
et `11c979f` ; ce document dit ce que le premier mois réel a produit, ce qu'il
a coûté, et les **neuf défauts qu’il a trouvés** — dont six corrigés ici.

**Tout chiffre de ce document vient d'une exécution.** Les coûts viennent des
objets `usage` renvoyés par l'API ou de `credit_ledger` ; les refus viennent
des messages que la base et le moteur ont réellement rendus.

---

## 0. Ce qu'il a fallu monter pour que « chemin réel » veuille dire quelque chose

`DECISIONS.md` du 2026-09-03 a constaté qu'aucun endpoint Supabase n'était
joignable et que Docker n'existait pas ici. **Les deux moitiés de ce constat
ont changé** : `api.anthropic.com` et le registre npm répondent. Docker, non.

La pile locale est donc :

| couche | ce que c'est |
|---|---|
| Postgres 16 local | les **147** migrations rejouées, 96 fichiers de test SQL, **0 échec** |
| **PostgREST 12.2.3** | la vraie brique que Supabase fait tourner, pointée sur cette base — 86 relations, 232 fonctions dans son cache de schéma |
| une passerelle locale | `/rest/v1/*` vers PostgREST, et **quatre points d'entrée GoTrue** écrits pour ce rendu, parce que GoTrue n'est pas là |
| `next dev` | l'application, sans une ligne modifiée pour la circonstance |

**Ce qui est un double, et c'est tout :** le serveur d'authentification. Il
signe les mêmes JWT HS256 contre des lignes qui existent déjà dans
`auth.users`, et il n'accorde rien que la RLS n'accorderait pas — les lectures
passent par `auth.uid()`, les policies, et les mêmes RPC qu'en production.
`/storage/v1/*` répond **501**, exprès : un appel qui en a besoin doit tomber
bruyamment, et l'un l'a fait (voir §5).

Le rejeu sort en code 1 sur une seule chose, et ce n'est pas un test : la
comparaison à l'empreinte de **production**, qui n'a pas ces migrations — 559
objets présents dans le rejeu, absents de la base déployée. C'est le même
écart que `CONTENT_BUG_REPORT.md` décrit depuis le 20 septembre.

---

## 1. Le coût réel, ventilé

Haiku 4.5 à 1 $ / 5 $ le MTok, Batch −50 %. Opus 5 à 5 $ / 25 $.

| étape | appels | jetons entrée | jetons sortie | coût |
|---|---|---|---|---|
| **Banque de sujets**, 4 passes en Batch | 115 + 20 relances | 112 500 | 48 707 | **0,2127 $** |
| **Le mois**, passe jetée (1/30) | 30 | 19 252 | 10 773 | 0,0366 $ |
| **Le mois**, passe gardée (16/30) | 30 + 25 relances | 47 893 | 21 310 | **0,1159 $** |
| **Trois générations à la demande**, réussies | 3 | — | — | **0,009616 $** *(lu dans `credit_ledger`)* |
| Les mêmes, **tentatives refusées** | 8 | — | — | **non mesuré** — voir §4, défaut 4 |
| **Le brand kit** (Opus 5, 1 appel) | 1 | — | — | **non mesuré**, borné à ≤ 0,23 $ — voir §4, défaut 4 |
| Sondes de diagnostic | 2 | — | — | ~0,006 $ |

**Total mesuré : 0,381 $. Total borné, tout compris : ≤ 0,66 $.**
Plafond de session : 2 $. Jamais approché.

⚠ **Le `credit_ledger` ne portait aucune somme avant aujourd'hui.** Les
0,009616 $ ci-dessus sont les trois premiers montants qu'il ait jamais
enregistrés, et ils n'y sont que parce que le défaut 4 a été corrigé.

---

## 2. Le mois : 16 sur 30, et pourquoi

| | posts valides | taux |
|---|---|---|
| **Le lot seul, prompt du dépôt tel quel** | **1 / 30** | 3 % |
| **Avec une relance citant le reproche exact** | **16 / 30** | 53 % |

Les 30 sujets ont été tirés de la banque par `assign_topic_to_kit` — la RPC du
produit, avec sa fenêtre anti-collision de 90 jours. Aucun épuisement : la
banque a répondu 30 fois sur 30.

### Les causes des 14 refus restants

| cause | nombre | ce que c'était |
|---|---|---|
| **budget de mots** | 10 | un `gloss` à 7-9 mots là où 6 sont permis, un `label` à 4 là où 3 sont permis. Les dépassements sont **toujours de 1 à 3 mots** ; jamais un paragraphe. |
| **schéma** | 4 | `payload_shape` (la forme ne correspond pas à l'archétype) ou `not_json`. |
| **éthique** | **0** | rien n'a été signalé par le garde déontologique, ni en base ni dans `checkEthics`. |

Sur la passe jetée, il y avait en plus **6 refus de la base** sur
`content_items_title_check` — voir défaut 5.

### La banque, pour situer

4 passes, 115 idées demandées, **49 écrites** (26 pour `high_functioning`, 23
pour `crossroads`), toutes relues par `checkEthics` avant que
`ethics_reviewed_at` soit posé.

| passe | demandées | écrites | ce qui a changé |
|---|---|---|---|
| 1 | 52 | 19 (37 %) | prompt initial |
| 2 | 33 | 10 (30 %) | + un exemple chiffré bon/mauvais → **sans effet** |
| 3 | 23 | 16 (70 %) | + **une relance citant le champ qui a débordé** → 9 réparations sur 15 |
| 4 | 7 | 4 (57 %) | idem |

**L'exemple dans le prompt n'a rien changé. Le reproche nominatif a doublé le
taux d'acceptation.** C'est le résultat le plus actionnable de la journée, et
il porte directement sur une décision écrite du dépôt : voir défaut 6.

---

## 3. Les collisions texte/illustration détectées par le moteur

19 posts portent des mots. Le moteur en compose **14** et en **refuse 5**, tous
avec la même phrase :

> `does not fit one card at the typographic floors — break to a carousel`

| archétype | refus |
|---|---|
| `cycle` | 2 |
| `quadrant_model` | 1 |
| `concentric_control` | 1 |
| `annotated_curve` | 1 |

⚠ **Ces cinq-là avaient passé le budget de mots.** Ce sont deux portes
différentes : le budget compte les mots, le moteur mesure des boîtes. Un post
peut tenir dans la première et pas dans la seconde, et 26 % de ce qui a été
écrit tombe là.

⚠ **Le moteur nomme le remède et personne ne l'applique.** « break to a
carousel » est une instruction, et rien dans le mois ne bascule un post refusé
vers un carrousel. Ces cinq posts restent dans le flux sans visuel.

Une collision plus douce est visible sur `05-write-it-review-carousel.png` :
le résolveur annonce lui-même **« Slide 2 · cut words: glosses dropped »**. Il
a laissé tomber des glosses pour que la carte tienne, et il le dit — c'est le
bon comportement, et c'est la seule raison pour laquelle on le sait.

---

## 4. Les six défauts que le mois lui-même a trouvés

### 1 — ⚠ Une base fraîche ne peut générer AUCUN kit, dans les cinquante États

`project_state_is_sellable` compte les lignes vérifiées de
`license_type_states`. Sur le rejeu, **`verified_at` est NULL sur les 240
lignes**, donc `/api/briefs/[id]/generate` répond `409 We're not open in CA
yet` — pour les onze titres, partout.

Le refus est juste : il empêche d'imprimer un titre d'exercice que personne
n'a vérifié contre un board. Ce qui manque n'est pas du code, c'est **l'acte**,
et rien dans le dépôt ne dit qu'il est requis avant la première génération.

**Non corrigé**, parce que ce n'est pas au code de le corriger. Ouvert en local
pour les quatre lignes de CA, avec `verified_by = 'LOCAL RENDER HARNESS — not a
board check'`, dans `scripts/local-render/00-account.sql` et nulle part
ailleurs.

### 2 — ⚠ `credit_ledger` comptait le crédit et jetait l'argent — **corrigé**

`app/api/content-items/[id]/write/route.ts` passait `costUsd: null`, alors que
`runOnDemandWrite` rend son `usage` et que `apply_on_demand_write` accepte
`p_cost_usd` depuis le premier jour. **Le seul endroit où le produit enregistre
ce qu'une génération coûte en argent était vide**, et un plafond de dépense lu
dans le ledger aurait lu zéro pour toujours.

Corrigé : `syncCostUsd()` ajouté à côté de `batchCostUsd()` — mêmes prix, même
table, sans la remise de lot — et la route l'appelle. Première somme
enregistrée : `0,004617 $`.

⚠ **Ce qui reste ouvert** : une écriture **refusée** ne journalise toujours
rien. `release_on_demand_write(p_write_id)` ne prend pas de coût, et une
sortie rejetée a pourtant coûté des jetons. Le ledger sous-déclare d'exactement
les échecs — ici, 8 tentatives sur 11. Le réparer demande une colonne, donc une
migration.

### 3 — ⚠ L'écran de relecture n'a jamais montré la carte — **corrigé**

`lib/compose/svg.ts` émet `<svg width="1080" height="1350">` en attributs
absolus, parce que resvg les lit pour dimensionner le PNG. Inliné dans la page,
ce SVG garde ses 1080 px ; les conteneurs de `review-surface.tsx` étaient
`max-w-[420px] overflow-hidden` et `w-[200px]`. Un SVG à dimensions absolues
**ne se met pas à l'échelle : il est rogné.**

Résultat, sur l'écran dont le produit dit « then you read it over » :

> Your nervou… / vigilant afte… / that's what … / there.

Les deux tiers droits de chaque carte étaient coupés, chaque titre tranché en
plein mot, et les vignettes de carrousel réduites à une colonne de la largeur
d'un doigt. **Sur trois surfaces** : la grande carte, les vignettes de
carrousel, et les variantes de mise en page.

Corrigé sur le conteneur et non dans `svg.ts` — le PNG a besoin de ces
attributs, la page a besoin de les ignorer. Une classe,
`[&>svg]:block [&>svg]:h-auto [&>svg]:w-full`, et le `viewBox` fait ce pour
quoi il existe. Avant / après : `05-write-it-review-carousel.png`.

### 4 — ⚠ Le carrousel était le seul archétype à qui on ne disait pas le budget — **corrigé**

`archetypeInstruction()` écrivait `{"label": "1-3 words", "gloss": "1-6 words"}`
pour dix archétypes. Pour le onzième — celui qui **empile trois à huit
payloads** — elle écrivait `{"cards": [… {"archetype_key": …, "payload": {that
archetype's shape}}]}` et s'arrêtait là. Ni les formes, ni les nombres.

Un seul `gloss` trop long suffit à faire refuser le carrousel entier. Le
carrousel à la demande a échoué **trois fois de suite** sur `over_budget`
pendant que les cartes simples passaient.

Corrigé : l'instruction du carrousel inline désormais les dix formes internes,
**reprises de la même table `SHAPES`**, jamais recopiées.

Et dans la même table, `comparison_pair` disait `{"left": [2-4 items], "right":
[the SAME number of items]}` — **la seule ligne des onze à ne pas dire ce
qu'est un « item »**. Le modèle inventait la forme et `entry.parse` refusait en
bloc (`payload_shape`, sans dire quelle clef manquait) : dix refus sur trente
au premier mois. Corrigé de la même façon.

### 5 — ⚠ Un sujet de banque ne peut pas devenir le titre du post qu'il produit

Trois bornes qui ne se sont jamais parlé :

| | ce que ça dit |
|---|---|
| `content_items_title_check` | `char_length(title) <= 34` |
| la banque | des titres « d'au plus huit mots », soit ~50 caractères |
| `cardBands()` | `headline: item.title` — **le titre EST le bandeau de titre de la carte** |

Six inserts refusés au premier mois. Le harnais ramène le titre sur une
frontière de mot pour que la ligne entre ; c'est pour ça que cinq titres sont
tronqués sur `07` et `08`. **Ce n'est pas la réparation** — c'est la forme
visible du désaccord. La réparation est que l'une des trois bornes cède, et
c'est une décision.

### 6 — ⚠ Le prompt caching du mois ne met rien en cache, et c'est mesurable

`copy-batch.ts` construit tout autour de deux multiplicateurs de marge : la
Batch API (−50 %) et le prompt caching. Le premier fonctionne. Le second, non :

```
cache_read_input_tokens  = 0     sur les 4 lots de la banque
cache_creation_input_tokens = 0   et sur les 2 lots du mois
```

Le fichier prédit lui-même ce symptôme — « un zéro constant est la preuve
qu'un invalidateur est entré ». Ce n'en est pas un. Mesuré avec
`messages.count_tokens` sur le vrai `cachedPrefix()` :

| archétype | jetons du préfixe |
|---|---|
| `single_statement` | **461** |
| `carousel` | **478** |
| `quadrant_model` | **499** |

Le minimum cachable d'un préfixe dépend du modèle et vaut au moins 512 jetons.
**Le préfixe est trop court pour être mis en cache, quoi qu'il arrive** : le
`cache_control` est inerte depuis le premier jour, silencieusement, et le
calcul de marge de `batchCostUsd` en tient compte comme s'il fonctionnait.

**Non corrigé**, délibérément : allonger un préfixe pour franchir un seuil est
une décision de conception, pas une réparation. Le chiffre est là pour que
quelqu'un la prenne.

### Et une décision du dépôt que ce rendu met à l'épreuve

`write-one.ts` écrit, en toutes lettres :

> ⚠ LA RELANCE NE DIT PAS AU MODÈLE CE QU'IL A RATÉ, et c'est délibéré […]
> Le mois relance à l'identique ; ici aussi.

Ce que la journée a mesuré :

| relance | réparations |
|---|---|
| **à l'identique** (le produit) | mois passe 1 : **1 post sur 30** |
| **citant le champ qui a débordé** | mois passe 2 : **16 sur 30** ; banque : **11 réparations sur 20 relances** |

La décision est écrite et assumée, donc elle n'a **pas** été renversée ici. Le
chiffre est versé en face.

---

## 5. Ce qui a surpris

**Le garde déontologique n'a rien eu à dire.** Zéro signalement sur les 16
posts du mois et sur les 3 écritures à la demande ; sur 115 sujets de banque,
**quatre** refus déontologiques en base (« Therapy that works »), contre
**soixante** refus de longueur et deux de schéma. Sur un sujet où tout le dépôt s'attend à
se battre, la contrainte qui mord n'est pas l'éthique : **c'est le comptage de
mots.** Au premier mois, 13 refus sur 30 pour le budget et 6 pour la borne de
34 caractères du titre — dix-neuf sur vingt-neuf. Le produit est bien plus
serré typographiquement que déontologiquement.

**Les deux portes se cumulent, et personne ne les avait vues ensemble.** Un
post passe le budget de mots, puis le moteur le refuse pour la même raison
sous une autre forme — la place. 53 % franchissent la première, 74 % de
ceux-là franchissent la seconde : **environ 39 % d'un lot arrive en visuel.**

**Le Batch a mis 25 à 30 minutes pour 30 requêtes**, à chaque fois, avec zéro
avancement pendant les vingt premières. C'est conforme au service et sans
rapport avec la taille du lot — mais un « mois généré dans la nuit » n'est pas
la même promesse produit qu'un mois généré en trois minutes, et le dépôt n'a
nulle part écrit laquelle il tient.

**Le storage absent n'a fait tomber personne.** `local edge: storage is not
stood up` apparaît quatre fois dans les logs, sur le cache de polices, et le
kit s'est rendu quand même. La dégradation qui a coûté quatre déploiements en
septembre marche.

**Et la chose qu'on ne peut pas ne pas voir sur `08`** : à 350 px, les cartes à
une phrase se lisent et les diagrammes ne se lisent plus. Le produit tire vers
les diagrammes — neuf archétypes sur onze en sont — et le fil Instagram est à
350 px.

---

## 6. Trois défauts de plus, trouvés en s'en servant

Le 2026-09-21, après le rendu : *« je ne peux pas cliquer sur le bouton Write
it »*. Le bouton était désarmé, et c'était correct. Ce qu'il y avait derrière
ne l'était pas.

### 7 — ⚠ Le panneau n'avait qu'un verrou sur deux — **corrigé**

`WriteAvailability` documente son état désarmé ainsi : *« Le drapeau est
éteint, **ou la clef absente** »*. La page ne testait que le drapeau.

Vérifié en cliquant, `ANTHROPIC_API_KEY` retirée de l'environnement et
`CONTENT_GENERATION_ARMED="true"` : « Write it » s'allume, annonce **« Uses 1
of your 7 left this month »**, et rend un **503 « Generation isn't available
right now — that's on us »** au clic.

Aucun crédit n'est perdu : la clef est vérifiée **avant** `reserve_credit`, et
le `credit_ledger` est resté à 18 lignes de part et d'autre du clic. Mais on
invitait à dépenser sur quelque chose qui ne pouvait pas tourner.

La décision est remontée dans `lib/content/write-screen.ts` — `writeStateFor`
et `writeOffReason` — où la matrice est éprouvée, plutôt que dans une cascade
de ternaires de la page. Six cas de test nouveaux, dont celui qui manquait.

### 8 — ⚠ Le message envoyait chercher du côté de la facturation — **corrigé**

> Writing isn't switched on **for your account** yet.

Ce n'est pas une propriété du compte. Aucun plan, aucun achat, aucun
`comp_grant` n'ouvre cette porte : c'est une variable d'environnement du
serveur. Une praticienne qui lit cette phrase va voir sa facturation ; une
opératrice va voir le compte ; le levier n'est ni l'un ni l'autre. C'est la
même famille de confusion que `content_pipeline_enabled`, qui a coûté trois
briefs (F7, F11).

La phrase dit maintenant « switched on **here** », et la cause exacte —
`CONTENT_GENERATION_ARMED is not exactly "true"`, `ANTHROPIC_API_KEY is not
set`, ou les deux — s'affiche sous elle **uniquement** là où
`showsTechnicalDetail()` l'autorise, l'idiome que `lib/env/deploy.ts` porte
déjà pour l'écran du mois. En production, la phrase seule.

### 9 — ⚠ Taper un titre faisait disparaître le panneau — **corrigé**

Le plus coûteux des trois, et le plus invisible.

```ts
const postKind = hasCaption || card !== null ? "generated" : …
```

`reviewCardFor` a une exception littérale et documentée : pour
`single_statement`, la ligne affichée **EST** le titre. Et `statement` est
l'archétype par défaut d'un post créé par « New post ».

Donc : elle crée un post, le panneau lui propose d'écrire ; elle tape un titre
— la première chose que le formulaire demande — et au rendu suivant **le
panneau a disparu**, remplacé par « Download image » et une carte faite de ses
quatre mots. Elle a perdu l'offre d'écrire en faisant ce qu'on lui demandait.

Et `manual_partial` devenait **inatteignable** pour l'archétype par défaut :
la colonne la plus soigneusement décrite de la matrice, la seule qui porte
`warnsOverwrite`, ne pouvait pas se produire. `write-panel-matrix.test.ts`
était vert du début à la fin — il teste la fonction, pas la façon dont la page
y entre. C'est exactement le trou que `write-screen.ts` existe pour fermer, et
il était resté ouvert d'une couche au-dessus.

Le bon prédicat était déjà calculé dix lignes plus bas dans la même page :
`eklioWroteThis` — le sujet de banque, le payload du diagramme, la ligne
« Why this one », les trois marques qu'une écriture machine laisse et qu'une
frappe au clavier ne laisse jamais. `postKindFor` s'en sert désormais, et sept
cas de test figent la distinction.
