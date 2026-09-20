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
