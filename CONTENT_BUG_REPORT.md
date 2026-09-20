# CONTENT_BUG_REPORT.md — pourquoi `/app/content` échoue en preview

Diagnostic du 2026-09-20. Branche `claude/great-brahmagupta-za7qmx`
(frontend `77e0fd0`, backend `5567d16`).

**Toute sortie citée ici est marquée [chemin réel] ou [fixture].** Les preuves
de ce rapport viennent toutes d'exécutions, pas de lectures de code.

---

## RÉSUMÉ EN UNE PHRASE

`get_content_month` déployé en production ne porte pas les trois champs que le
schéma Zod de cette branche exige (`rationale`, `compose_archetype`, `topic`),
donc `safeParse` échoue, donc `decode` rend `server_error`, donc l'écran écrit
« Something went wrong. Try again. » — **et ce n'est vrai que si le mois
contient au moins un post ; un mois vide se rend normalement.**

---

## 1.1 OÙ LE MESSAGE EST PRODUIT

| étape | fichier |
|---|---|
| le texte | `lib/data/content.ts:393` — `refusal("server_error", "Something went wrong. Try again.")` |
| qui le décide | `lib/data/content.ts:387-394`, la fonction `decode()` : `schema.safeParse(data)` échoue |
| qui l'affiche | `app/app/content/page.tsx:177` — `{!result.ok ? <p>{result.message}</p> : …}` |

⚠ **Ce n'est PAS l'error boundary** (`app/app/error.tsx`). Elle remplacerait
toute la page ; ici le check-in se rend au-dessus du message, ce qui prouve
que la page s'est rendue et que seul le bloc du mois a refusé.

**L'erreur d'origine est-elle perdue ?** Non, mais elle est pauvre.
`decode()` journalise `console.error("[content] get_content_month shape",
parsed.error.issues)` — donc les trois chemins fautifs sont dans les logs de
fonction Vercel. Ce qui manque n'est pas la journalisation, c'est que **l'écran
ne distingue pas trois situations qu'une utilisatrice vit différemment** :
« rien encore ce mois-ci », « pas encore activé », et « c'est cassé ». Les
trois s'écrivent aujourd'hui de la même façon. C'est le défaut corrigé en 2.1.

---

## 1.2 HYPOTHÈSE « VARIABLES D'ENVIRONNEMENT » — **ÉCARTÉE**

**Preuve [chemin réel].** Recherche de `process.env.` sur tout ce que la route
peut atteindre :

```
lib/content/images/config.ts:29   CONTENT_IMAGE_MODEL           ?? défaut
lib/content/images/config.ts:81   CONTENT_IMAGE_QUALITY         ?? défaut  (paramètre par défaut = lu à l'APPEL)
lib/content/images/config.ts:82   CONTENT_IMAGE_QUALITY_CEILING ?? défaut  (idem)
lib/content/images/client.ts:100  OPENAI_API_KEY                (lu DANS la fonction, lève une erreur nommée)
lib/content/generate/copy-batch.ts:48  CONTENT_COPY_MODEL       ?? défaut
```

Deux lectures au chargement de module (`config.ts:29`, `copy-batch.ts:48`),
**toutes deux avec un `??` : aucune ne peut lever.**

Et surtout — **aucun de ces modules n'est atteignable depuis `/app/content`.**

```
$ grep -rln "lib/content/images" app lib components | grep -v __tests__
lib/content/images/generate.ts
lib/content/images/fixture-client.ts
lib/content/images/client.ts        ← il ne s'importe que lui-même

$ grep -rln "content/generate/copy-batch" app lib components | grep -v __tests__
(rien)
```

**Conclusion : aucune variable d'environnement de ce chantier n'est lue lors
du rendu de `/app/content`.** L'absence de configuration Vercel n'est pas la
cause. *(Elle le deviendra quand le chemin visuel custom sera câblé ; voir
§4.)*

`ENV_REQUIRED.md` (backend) décrit correctement les cinq variables et leurs
défauts. Il est cohérent avec ce que le code lit.

---

## 1.3 HYPOTHÈSE « BASE DE DONNÉES » — **CONFIRMÉE. C'EST LA CAUSE RACINE.**

### La méthode : reconstruire la preview, pas la raisonner

J'ai rejoué sur la stack PostgreSQL 16 locale **uniquement les migrations
antérieures au chantier** — c'est-à-dire ce que `fobgdsupyfslxbswfuay` porte :

```
$ bash prodlike.sh
prod-like rebuilt: 133 migrations
```

133, ce qui correspond au tronc d'avant le chantier. Production porte en plus
les 14 de `claude/stoic-ritchie-1liqrz` (`FOLLOWUP.md` F1), **dont aucune ne
touche `content_item_json`** — la forme du contenu y est donc identique.

### Ce que production renvoie réellement **[chemin réel]**

Appel de `get_content_month` depuis le rôle `authenticated`, avec un kit et un
post réels :

```json
{"items": [{"id": "…", "tags": [], "theme": null, "title": "A post that exists",
  "posted": false, "status": "draft", "caption": null, "channel": null,
  "alt_text": null, "category": null, "month_id": null, "register": null,
  "archetype": "statement", "posted_at": null, "created_at": "…",
  "image_slot": null, "updated_at": "…", "brand_kit_id": "…",
  "on_image_text": null, "scheduled_for": "2026-09-01"}],
 "month": "2026-09-01",
 "counts": {"ready": 0, "posted": 0, "proposed": 0, "scheduled": 1},
 "unscheduled": []}
```

**21 clefs par item. Il en manque trois** que `contentItemSchema` exige.

### Ce que le schéma en fait **[chemin réel]**

Cette charge exacte, passée à `contentMonthSchema.safeParse` :

```
PARSE FAILED. Issues:
  items.0.rationale        -> invalid_type: expected string, received undefined
  items.0.compose_archetype -> invalid_type: expected string, received undefined
  items.0.topic            -> invalid_type: expected object, received undefined
```

⚠ **Les trois sont `.nullable()` mais PAS `.optional()`.** En Zod, `nullable`
accepte `null` ; il **exige quand même que la clef soit là**. Une clef absente
et une clef à `null` sont deux choses différentes, et c'est toute la panne.

- `lib/data/content.ts:200` — `rationale: z.string().nullable()`
- `lib/data/content.ts:213` — `compose_archetype: z.string().nullable()`
- `lib/data/content.ts:222` — `topic: z.object({…}).nullable()`

Les trois ont été ajoutés par les migrations `20260921090000` et
`20260921110000`, **qui ne sont pas appliquées en production**.

### Et le mois VIDE, lui, passe **[chemin réel]**

```
EMPTY MONTH: PARSE SUCCEEDED
```

`items: []` ne fait jamais tourner `contentItemSchema`. **Donc la page n'échoue
que pour une praticienne qui a déjà au moins un post** — ce qui est
exactement le cas observé en preview.

### Inventaire de ce qui manque en production **[chemin réel]**

```
--- RPC appelées par /app/content ---
get_content_month     PRESENT (ancienne forme)
get_content_item      PRESENT (ancienne forme)
update_content_item   PRESENT (ancienne forme)
approve_content_month PRESENT
ethics_scan           PRESENT
credit_meter          ABSENT   ← chantier
swap_content_item     ABSENT   ← chantier
reserve_credit        ABSENT   ← chantier
--- tables ---
content_items, content_months, content_registers,
content_preferences, content_checkins            PRESENT
content_archetypes, content_topics, content_intents,
credit_ledger, credit_balances, rendered_assets   ABSENT ← chantier
--- colonnes de content_items ---
theme, on_image_text            PRESENT
rationale, topic_id, compose_archetype   ABSENT ← chantier
```

**Ce qui est absent et se dégrade proprement** (vérifié en lisant le code de
chaque appelant) :

| absent | appelant | ce qu'il fait |
|---|---|---|
| `credit_meter` | `getCreditMeter` (`lib/billing/credits.ts:61`) | journalise, rend un compteur à zéro ; `CreditsMeter` rend `null` quand aucune ligne n'est à montrer → **invisible, pas cassé** |
| `content_archetypes` | `archetypeLabels` (`app/app/content/[id]/page.tsx`) | `data ?? []` → libellés repliés sur la clef |
| `content_topics` | `reviewCardFor` (`lib/content/review.ts`) | `maybeSingle()` sans lecture de l'erreur → carte `null` |
| `theme_source*` | `getContentMonthRecord` | journalise et rend `null` |

**Un seul appel est fatal, et c'est le schéma, pas une absence.**

### `/app/content/[id]` échoue aussi, et plus silencieusement

`getContentItem` passe par `contentItemSchema` **directement**. Tout item de
production échoue donc au parse, `decode` rend `server_error`, et
`app/app/content/[id]/page.tsx:37-38` fait :

```tsx
if (result.code === "payment_required") redirect("/app/checkout");
notFound();
```

→ **un 404 sur un post qui existe.** Pire que le message générique : rien
n'indique qu'il s'agit d'une panne.

---

## 1.4 HYPOTHÈSE « ÉTAT VIDE TRAITÉ COMME UNE ERREUR » — **ÉCARTÉE sur le fond, CONFIRMÉE sur la forme**

⚠ **CLAUSE D'ARRÊT — un fait du brief est contredit par les dépôts.** Le brief
dit « le pipeline est livré derrière `content_pipeline_enabled` à `false` ».
**Ce réglage n'existe nulle part**, ni en base ni dans le code :

```
$ grep -rn "content_pipeline_enabled" (les deux dépôts)
(rien)
$ select key from public.app_settings;   [chemin réel, base prod-like]
  … 19 clefs, aucune ne s'en approche
```

Le vrai mécanisme est double et il est ailleurs : `CONTENT_GENERATION_ARMED`
non posée, **et** aucune entrée `vercel.json` pour
`app/api/cron/content-month/route.ts`, qui répond 503 en nommant la variable.

**Sur le fond** : un mois vide n'est PAS traité comme une erreur — le parse
réussit (preuve ci-dessus) et `ContentStream` se rend avec zéro carte.

**Sur la forme, il y a quand même un défaut** : ce que voit alors une
praticienne est un titre de mois, « 0 of 0 ready », et une grille vide. Il n'y
a **aucun état vide conçu** qui lui dise ce qui va se passer et quand. C'est ce
que 2.3 corrige, et c'est ce que verront les vraies utilisatrices entre
l'abonnement et la première génération.

---

## 1.5 LE LIEN « DONE »

`components/content/check-in-line.tsx:72`. **Ce n'est pas un reliquat : il est
de moi, ajouté dans la session précédente, et il a une raison.**

`CheckInLine` initialise `open = !answered`. Quand elle répond dans la session,
le serveur sait que c'est répondu mais l'état React reste ouvert — sans ce
bouton, la carte resterait dépliée jusqu'au rechargement. « Done » la replie.

⚠ **Mais il n'est pas au brief et sur aucune maquette**, et il apparaît
exactement là où la capture le montre : sous une carte de check-in répondue.
Il est **conservé** — retirer une affordance qui marche pour respecter une
maquette qui ne prévoyait pas ce cas serait un recul — et il est **noté ici
comme un écart assumé** plutôt que laissé à découvrir.

---

## 1.6 VERDICT PAR HYPOTHÈSE

| # | hypothèse | verdict | preuve |
|---|---|---|---|
| 1.2 | variables d'environnement | **ÉCARTÉE** | aucun module lisant `process.env` n'est atteignable depuis la route ; les deux lectures au chargement ont un défaut |
| 1.3 | divergence de schéma base ↔ code | **CONFIRMÉE — CAUSE RACINE** | charge réelle de production reproduite sur 133 migrations ; `safeParse` nomme les trois clefs absentes |
| 1.4 | état vide traité comme une erreur | **ÉCARTÉE** (le vide parse) mais **défaut d'UX confirmé** (aucun état vide conçu) | `EMPTY MONTH: PARSE SUCCEEDED` |
| 1.5 | « Done » reliquat | **ÉCARTÉE** — délibéré, hors maquette, conservé et documenté | lecture de `check-in-line.tsx:60-76` |

**Condition exacte de la panne :** production sans les migrations du chantier
**ET** au moins un post dans le mois consulté.

---
---

# PHASE 2 — CE QUI A ÉTÉ CORRIGÉ

Quatre commits, dans l'ordre où le brief les demande.

## 2.1 — `eb9bc4d` · trois situations cessent de partager une phrase

**Le défaut, avant la cause racine :** un message générique en preview coûte
une session de débogage pour une information que le serveur avait déjà.

**`decode()` distingue maintenant** (`lib/data/content.ts`) :

| code | quand | statut | ce que l'écran dit |
|---|---|---|---|
| `not_deployed` | la RPC ou la table n'existe pas ici | **503** | « pas activé dans cet environnement », **sans « réessayez »** |
| `schema_mismatch` | la charge parse contre un contrat plus récent que la base | **500** | idem — la distinction ne la concerne pas |
| `server_error` | tout le reste | 500 | « Something went wrong. Try again. » |

⚠ **`not_deployed` est reconnu au SQLSTATE, jamais au texte du message.**
`42883`, `42P01`, `42703`, `PGRST202`, `PGRST204`. Un message d'erreur est
traduit, reformulé et versionné ; un SQLSTATE ne l'est pas.

⚠ **Et l'erreur PostgREST est journalisée EN ENTIER** — `code`, `details`,
`hint` — pas seulement `message`. Le type de l'argument était
`{ message: string }` : le seul champ qui distingue « cette fonction n'existe
pas » de « la connexion a lâché » était présent dans l'objet et invisible dans
les types. Personne ne s'en servait.

**La cause voyage, mais pas jusqu'à elle.** `ContentResult` porte un `detail`
optionnel ; `lib/env/deploy.ts` décide qui a le droit de le lire.

⚠ **`VERCEL_ENV` est lu AVANT `NODE_ENV`, et c'est le cas qui compte** : une
preview Vercel est construite avec `NODE_ENV=production`. Lire `NODE_ENV`
d'abord fermerait la porte exactement là où elle doit être ouverte — **et le
défaut serait invisible, puisqu'il produit le comportement le plus prudent.**
Il y a un test pour ce cas précis. Le défaut est « non » : une variable
absente ferme.

**Et `/app/content/[id]` cesse de transformer une panne en 404.** `notFound()`
était appelé pour tout refus non payant ; avec une base en retard, **chaque
post existant répondait « cette page n'existe pas »** — le seul message qui
garantisse que personne ne cherche la vraie cause. `not_found` reste un 404,
parce qu'il en est un.

## 2.2 — `e57184b` · les dépendances absentes dégradent, elles ne font pas tomber

- **Aucune lecture d'environnement au chargement d'un module.**
  `CONTENT_IMAGE_MODEL` et `CONTENT_COPY_MODEL` étaient des constantes de
  module. Avec un `??`, donc sans danger de levée — mais une constante fige la
  réponse à l'import : une variable posée après le démarrage n'aurait jamais
  été vue, et changer de modèle aurait demandé un redéploiement. Ce sont des
  fonctions. Les lectures restantes sont toutes dans des corps de fonction ou
  des paramètres par défaut, évalués à l'appel.
- **Une table absente est journalisée, puis la page continue.**
  `reviewCardFor` ne lisait même pas `error` : avec `content_topics` absente,
  une table manquante et un sujet retiré de la banque produisaient la même
  page et rien ne les distinguait dans les logs. Idem `archetypeLabels`.
- **Sans clef OpenAI, le chemin visuel custom se ferme sans rien dépenser.**
  Le client peut déclarer `configured()`, lu à chaque appel, et
  `generateCustomVisual` demande **avant de réserver**. Sans cette porte, une
  `OPENAI_API_KEY` absente réservait un crédit, levait à l'appel, relâchait, et
  rendait `failed` avec `calledModel: true` — **un mot faux : rien n'avait été
  appelé.** Deux tests vérifient que le compte d'appels ET le compte de
  réservations valent zéro.

## 2.3 — `2bb14fd` · l'état vide est conçu

Un mois sans posts affiche `MonthEmpty`, et **ne promet « écrit le 1er » que là
où `contentGenerationArmed()` dit que quelque chose écrira vraiment le 1er.**
Ailleurs il propose ce qui marche : écrire le premier post elle-même.

C'est aussi ce que verront les vraies utilisatrices entre l'abonnement et la
première génération.

## 2.4 — `1ccfb03` · LA CAUSE RACINE

```ts
function sinceMigration<T extends z.ZodType>(schema: T, migration: string) {
  return schema.nullable().default(null).describe(`absent before ${migration}`);
}
```

`rationale`, `compose_archetype` et `topic` passent par là. **Absente vaut
`null`**, donc le type de sortie ne bouge pas et aucun écran n'apprend cette
histoire.

⚠ **Ce n'est pas « tout en optionnel par prudence ».** Chaque appel nomme la
migration qui a introduit la clef, `.describe()` la rend lisible à l'exécution,
et `toleratedKeys()` l'énumère — **un test fige la liste à exactement trois.**
Une tolérance qu'on n'énumère pas s'élargit : à la première charge qui ne parse
pas, la tentation est d'ajouter un `sinceMigration` de plus, et personne ne
compte.

Le jour où les migrations sont appliquées partout, ces trois peuvent redevenir
des `nullable` nus, et le nom de la migration dit quand on en a le droit.

---
---

# PHASE 3 — VÉRIFICATION

## 3.1 Le test qui reproduisait l'échec **[chemin réel]**

`lib/data/__tests__/older-database.test.ts`. Sa charge n'est pas une fixture
inventée : c'est la sortie de `get_content_month` capturée sur les 133
migrations d'avant le chantier.

**Vérifié dans les deux sens :**

```
$ git stash push lib/data/content.ts     # schéma d'avant le correctif
  × le mois se décode quand même
  × et une clef absente vaut `null`, pas `undefined`
  × un item seul se décode aussi — c'est le chemin de /app/content/[id]
  Tests  3 failed | 6 passed

$ git stash pop                          # schéma corrigé
  Tests  12 passed
```

Le fichier fige aussi la **borne** de la tolérance : une clef vraiment
obligatoire qui manque reste une erreur, un mauvais TYPE reste une erreur, un
`null` explicite passe, une base à jour fait traverser les trois valeurs — et
une assertion vérifie que la fixture ne porte **vraiment pas** les trois clefs,
sans quoi quelqu'un la « corrigerait » et le test ne mesurerait plus rien.

## 3.2 Les quatre configurations **[chemin réel]**

Ce dépôt n'a pas d'infrastructure de rendu React, et en ajouter une serait une
dépendance hors périmètre. La décision d'écran a donc été sortie du JSX
(`lib/content/month-screen.ts`), **pure et sans lecture d'environnement**, et
`lib/content/__tests__/month-screen.test.ts` la parcourt :

| # | configuration | `/app/content` | `/app/content/[id]` |
|---|---|---|---|
| 1 | **ni variables ni migrations** *(la preview)* | `month` — ses cartes s'affichent ; un mois vide donne `empty` avec `automatic: false` | l'item se décode ; une panne donne l'écran « pas activé ici », **plus un 404** |
| 2 | migrations, pas de variables | `empty` avec `automatic: false` — l'écran ne promet pas le 1er ; les cartes déjà écrites s'affichent | idem |
| 3 | les deux, zéro post | `empty` avec `automatic: true` ; `generating` et `generation_failed` distingués | idem |
| 4 | les deux, un mois généré | `month` | l'item se décode avec ses trois valeurs |

Le cas le plus fort chaîne tout : la charge capturée → `getContentMonth` →
`monthScreen` → `month`. **Des cartes à l'écran, là où la preview affichait une
erreur.**

⚠ **CE QUE CES TESTS NE PROUVENT PAS, ET QUI EST DIT PLUTÔT QUE SOUS-ENTENDU.**
Ils prouvent que la page **choisit** le bon écran. Ils ne prouvent pas que
chaque composant se **peint** correctement — seul un rendu le dirait, et ce
dépôt n'en fait pas. La preview reste le juge de ce dernier point.

## 3.3 Les suites

- **Vitest : 3 902 tests au vert, 164 fichiers, 0 échec** **[chemin réel]**.
- **Lint : 0 erreur**, un avertissement préexistant sans rapport
  (`lib/directory/__tests__/database-contract.test.ts`).
- **SQL : 146 migrations rejouées depuis zéro, 95 fichiers de tests, 0 échec**
  **[chemin réel]**, rejouée dans cette session sur la stack PostgreSQL 16
  locale. Aucun fichier du dépôt backend n'a été modifié ici — la suite est
  rejouée quand même, parce que « rien n'a changé donc ça passe encore » est
  une déduction, et cette section ne contient que des mesures.

---

# CE QUI RESTE CONDITIONNÉ

| ce qui manque | ce que la page fait aujourd'hui | ce qui s'ouvre quand c'est posé |
|---|---|---|
| **les migrations du chantier** en production | tout se rend ; `rationale`, l'angle et la mise en page gardée sont `null` partout | la ligne « Why this one », le libellé d'angle, le changement de mise en page, le compteur de crédits, Swap |
| `CONTENT_GENERATION_ARMED` + l'entrée `vercel.json` | l'état vide propose d'écrire soi-même | le mois écrit le 1er |
| `OPENAI_API_KEY` | le chemin visuel custom rend `not_configured` sans rien réserver | les visuels custom — qui ne sont de toute façon **câblés à aucun écran** (`lib/content/images/` n'est importé que par lui-même) |

⚠ **Aucune migration n'a été appliquée à la production, et aucune variable n'a
été posée.** Le correctif rend le code tolérant ; il ne remplace pas le
déploiement. **`/app/content` fonctionne maintenant en preview, mais dans un
état dégradé qui est visible et nommé plutôt que masqué.**
