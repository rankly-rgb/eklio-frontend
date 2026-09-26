# F45 — Porter le générateur du harnais sur le chemin produit

**Décision de Naima, 2026-09-26 : le générateur du harnais devient le chemin
produit ; l'autre est retiré.** La raison n'est pas une préférence. Le générateur
produit rend `ethicsCheck: { passed: true }` en dur et ne porte aucune mention de
licence : armé, il vendrait des publicités illégales en Californie.

Ce document est le plan. Il existe parce qu'un portage fait par morceaux
laisserait des trous de la même famille que celui qu'on répare.

---

## 0 · L'état de départ, mesuré

| | harnais | produit |
|---|---|---|
| fichier | `scripts/local-render/20-month.ts`, **2 259 lignes** | `lib/content/generate/pipeline.ts` + `run.ts`, **826 lignes** |
| ce qui est écrit | un payload d'archétype par post | une ligne et une légende par post |
| l'image | composition vectorielle, **coût nul** | un fond photographique, **payant** |
| la banque | `assign_topic_to_kit` | `planMonth`, aucun tirage |
| la déontologie | 23 contrôles + portillon + 5 gâchettes SQL | `checkEthics` à la réécriture, puis `passed: true` **en dur** |
| la licence | pied de carte sur les onze archétypes | **rien** |
| le quota | `reserve_credit` par post écrit | **rien** (l'allocation d'images, pas le crédit de contenu) |
| appelé par | une commande | **rien** — `runMonthForKit` n'a qu'un appelant, un script |

⚠ **Le générateur retiré n'a qu'un seul appelant hors tests** :
`scripts/content/generate-month.ts`. La frontière de retrait est donc nette, et
c'est la bonne nouvelle de ce plan.

---

## 1 · La découverte qui change la forme du portage

**La plupart des vingt mécanismes ne sont PAS dans le harnais.** Ils sont déjà
dans `lib/`, purs, et le harnais ne fait que les appeler :

| mécanisme | où il vit déjà | portable tel quel |
|---|---|---|
| `checkMonth`, `checkAcrossPosts`, `checkPostAlone` | `lib/content/month-checks.ts` | ✓ pur |
| les 23 contrôles d'écriture | `lib/content/writing-checks.ts` | ✓ pur |
| `licenceMention`, `licenceMissingMessage` | `lib/content/licence.ts` | ✓ pur |
| `checkEthics` + les 18 motifs | `lib/ethics/rules.ts` | ✓ pur |
| `composeWithFallback` | `lib/compose/fallback.ts` | ✓ pur |
| `guardBank` | `lib/content/bank-guard.ts` | ✓ pur, port injecté |
| `bankShortfall`, `fillTrigger`, `candidatesToSubmit` | `lib/content/bank.ts` | ✓ pur |
| `cachedPrefix`, `variablePart`, `validateCopy` | `lib/content/generate/copy-batch.ts` | ✓ pur |
| `anthropicBody`, `openAiBody` | `lib/content/generate/provider.ts` | ✓ pur |
| `repairPayload`, `reviseMonth`, `judgeCompleteness` | `lib/content/generate/*` | ✓ ports injectés |
| `chooseArchetype`, `scheduleDates` | `lib/content/generate/plan.ts` | ✓ pur — **à garder du fichier retiré** |

**Ce qui manque n'est donc pas les mécanismes : c'est l'ORCHESTRATEUR.** Les
2 259 lignes du harnais sont, pour l'essentiel, de l'orchestration mêlée à une
interface en ligne de commande.

Le portage consiste à extraire cette orchestration dans `lib/`, avec ses ports
injectés, et à laisser au harnais ce qui est vraiment de la ligne de commande.

---

## 2 · Les vingt mécanismes, par ordre de dépendance

L'ordre est celui d'exécution, qui est aussi celui des dépendances : chacun
suppose que le précédent a répondu.

### Étage A — le préalable, AVANT la première dépense

| # | mécanisme | base | route | environnement |
|---|---|---|---|---|
| A1 | le mois n'existe pas déjà | `content_months` + clé unique `(brand_kit_id, month)` | — | — |
| A2 | **`licenceMissingMessage`** | `project_briefs.license_*`, `license_type_states` | — | — |
| A3 | `guardBank` → `release_stale_topic_assignments` | la RPC, **déjà déclarée** dans `types/supabase.ts` | — | — |
| A4 | `guardBank` → `drawable_count_for_kit` + `bankShortfall` | la RPC, **à déclarer** | — | — |
| A5 | le quota du mois est disponible | `reserve_credit` en lecture sèche | — | — |

⚠ **Tout l'étage A est pur ou en lecture, et entièrement éprouvable hors ligne.**
C'est aussi celui qui porte le blocage légal (A2) et la protection de l'argent
(A5). Il se porte en premier, et il se porte en entier.

### Étage B — le tirage

| # | mécanisme | base | route |
|---|---|---|---|
| B1 | `candidatesToSubmit` → `assign_topic_to_kit` | la RPC, **à déclarer** | — |
| B2 | le dédoublonnage du tirage (`redundantAgainst`) | — | — |
| B3 | la libération des sujets non retenus | `topic_assignments` en suppression | — |

### Étage C — l'écriture, et c'est là que le serveur change tout

| # | mécanisme | ce qui change côté serveur |
|---|---|---|
| C1 | le préfixe mis en cache + la partie variable | rien, pur |
| C2 | la soumission du lot | ⚠ **le journal** — voir §3 |
| C3 | la collecte et `validateCopy` | rien, pur |
| C4 | `repairPayload` | un appel de plus, port injecté |
| C5 | le plafond de dépense | ⚠ `CONTENT_SESSION_CAP_USD` est une variable de session ; une route a besoin d'un plafond **par requête** |

### Étage D — la composition et les contrôles

| # | mécanisme | base | route |
|---|---|---|---|
| D1 | `composeWithFallback` (cartes vectorielles) | — | — |
| D2 | `licenceMention` → le pied de carte | — | — |
| D3 | `judgeCompleteness` | — | un appel, port injecté |
| D4 | `reviseMonth` | — | un appel, port injecté |
| D5 | `checkPostAlone` — le portillon par post | — | — |
| D6 | `checkMonth` à l'assemblage + les échanges du banc | — | — |

### Étage E — l'écriture en base

| # | mécanisme | base |
|---|---|---|
| E1 | l'insert dans `content_items` | les 5 gâchettes déontologiques + le budget de mots |
| E2 | le remplaçant quand un insert est refusé | — |
| E3 | **`reserve_credit` / `settle_credit`** par post écrit | l'invariant `credit_ledger_one_outcome_per_reservation` |
| E4 | la fermeture du journal | ⚠ voir §3 |

---

## 3 · Ce qui doit être RÉÉCRIT pour un contexte serveur

### 3.1 Le journal — et il existe déjà en base

⚠ **Le journal sur disque ne survit pas à une invocation Vercel.**
`scripts/local-render/journal.ts` écrit un fichier JSON : sur un serveur sans
état, un lot payé dont l'invocation meurt est un lot perdu. C'est exactement le
défaut que 7b nommait.

**Et la version serveur est déjà écrite**, par la migration
`20260923100000_a_paid_batch_survives_a_crash.sql` :

| table | colonnes |
|---|---|
| `content_generation_runs` | `brand_kit_id, month, batch_id, state, cost_usd, closed_at` |
| `content_generation_results` | `run_id, topic_id, result, usage, settled` |

Plus `abandon_stale_generation_runs()`. **Rien à concevoir : il faut brancher.**
Le port du journal devient une interface à deux implémentations — fichier pour le
harnais, tables pour le serveur — ou une seule, la base, des deux côtés. **La
seconde est meilleure** : deux implémentations d'un journal, c'est deux façons de
reprendre un lot payé.

### 3.2 Le plafond de dépense

`CONTENT_SESSION_CAP_USD` borne une *session* de ligne de commande. Une route a
besoin d'un plafond **par requête**, et le bon endroit est celui qui existe déjà :
`reserve_credit` en SQL, qui refuse au-delà du quota. Le plafond de session reste
au harnais.

### 3.3 Le remplissage de banque

Le harnais lance `10-topic-bank.ts` en **sous-processus**. Une route ne peut pas.
Deux réponses : la route **refuse** en nommant l'archétype manquant (c'est déjà ce
que `guardBank` rend), et un `cron` séparé remplit. ⚠ Le remplissage dépense
**hors registre** (F40) : ce défaut doit être corrigé avant qu'un `cron` le
déclenche tout seul.

### 3.4 Les sorties

`console.error` et `process.exit` deviennent une valeur de retour et un statut
HTTP. L'orchestrateur ne doit **rien** imprimer : il rend un rapport, et
l'appelant décide s'il l'imprime ou le sérialise.

---

## 4 · Ce qui est propre au harnais et n'a PAS à être porté

| | pourquoi |
|---|---|
| les sept drapeaux `argv` (`--confirm`, `--batch`, `--sync`, `--no-fill`, `--practitioners`, `--attempts`, `--rounds`) | une route n'a pas de ligne de commande ; `--confirm` est remplacé par le fait qu'un abonnement a été payé |
| `spawnSync` du remplissage | §3.3 |
| `console.error` du rapport | §3.4 |
| `CONTENT_SESSION_CAP_USD` | §3.2 |
| `CONTENT_PREFIX_BASELINE` | interrupteur de MESURE (M1) ; il n'a rien à faire en production |
| le choix du compte par `--email` | la route itère les abonnements dus |

---

## 5 · Ce que le générateur retiré emporte avec lui

| retiré | pourquoi |
|---|---|
| `generateMonth` (`lib/content/generate/pipeline.ts`) | le générateur lui-même |
| `runMonthForKit`, `persistGeneratedMonth` (`run.ts`) | son orchestration |
| `scripts/content/generate-month.ts` | son seul appelant hors tests |
| les **fonds photographiques** : `drawGround`, `groundPath`, `themesNeedingGround`, `content_grounds` | ⚠ les cartes sont vectorielles, à coût nul, et elles portent le pied de licence et passent les 18 règles sur toutes les surfaces — ce qu'une image générée ne peut pas garantir |
| `AllowancePort`, `reserve_content_image` / `settle_content_image`, `GROUND_COST_CENTS` | l'allocation d'images n'a plus d'objet sur le chemin du mois |
| `lib/content/generate/ground.ts` et la table `content_grounds` | écrits par `run.ts` **seul** — ils partent avec lui |

⚠ **`lib/images/` NE PART PAS, et c'est vérifié.** Il sert deux routes vivantes —
`/api/brand-kits/[id]/images` et `/…/[slot]` — plus l'écran
`app/app/content/[id]`, pour la **photographie de marque** (`brand_images`), qui
est un autre produit et un autre chantier (F6). Ce qui part est le chemin par
lequel le MOIS dessinait des fonds : `ground.ts`, `content_grounds`,
`GROUND_COST_CENTS`, et les appels d'allocation d'images dans `run.ts`. Confondre
les deux retirerait une fonctionnalité en vente.

**À GARDER du fichier retiré** : `chooseArchetype` et `scheduleDates`
(`lib/content/generate/plan.ts`), que le harnais importe déjà. Purs, utiles,
sans rapport avec le générateur.

⚠ **Le retrait se fait EN DERNIER.** Tant que l'orchestrateur serveur n'a pas
généré un mois, `generateMonth` est la seule chose qui ressemble à un chemin
produit, et le retirer avant laisserait le dépôt sans aucun. On le retire quand le
recensement est vert et qu'un mois est sorti.

---

## 6 · L'ordre de portage, et ce que chaque étape prouve

| # | ce qu'on porte | ce que ça prouve | appel API |
|---|---|---|---|
| 1 | **l'étage A en entier** — le préalable | une génération impossible est refusée avant de dépenser, et un brief sans licence ne génère pas | **non** |
| 2 | **l'étage D5/D6 + E1/E3** — les contrôles et l'écriture | un mois de posts donnés est contrôlé, composé, et écrit avec son crédit | **non** |
| 3 | le journal en base (§3.1) | un lot payé survit à une invocation qui meurt | non (reprise éprouvable avec des lignes posées à la main) |
| 4 | les étages B et C — tirage et écriture | le mois se génère | **oui** |
| 5 | le retrait du générateur produit (§5) | il n'y a plus qu'un chemin | non |

⚠ **Les étapes 1, 2 et 3 ne demandent AUCUN appel.** C'est la moitié du portage,
et c'est celle qui porte le blocage légal et la protection de l'argent.

---

## 7 · La garantie qui empêche que ça recommence

Le recensement (`lib/content/__tests__/the-harness-is-not-the-product.test.ts`)
devient la barrière :

1. il échoue tant qu'un mécanisme du harnais n'a pas d'équivalent produit ;
2. il ne peut pas être satisfait par une valeur en dur — `ethicsCheck: { passed:
   true }` le fait tomber ;
3. **la route ne sort de son 501 que lorsqu'il est vert**, et c'est vérifié par un
   test, pas par une intention.

⚠ **Le point 2 est celui qui compte.** Le générateur retiré passait pour
déontologiquement contrôlé parce qu'il rendait un objet qui disait `passed: true`.
Un recensement qui ne regarderait que les noms d'appels pourrait être satisfait
de la même façon.
