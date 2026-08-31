# Contrat back → front, en une page

Extrait une seule fois de `eklio-backend/FRONTEND_CONTRACT.md` (2 198 lignes) et
de son README. **Lire ceci, pas le contrat**, sauf pour l'éditeur de spec de
site (v1.1), qui a besoin des sections 2 à 4 in extenso.

## La règle qui tient tout

Toutes les entrées sont des fonctions Postgres appelées en RPC PostgREST, avec
le **JWT de l'utilisatrice**. `auth.uid()` cadre chacune d'elles.

⚠ **Jamais en service_role** : `auth.uid()` y vaut NULL, l'appel rend
`unauthenticated`. Seule exception, le webhook Stripe → `grant_plan_allowance`.

## Le péage

Le reveal est gratuit — c'est l'argument de vente. Tout ce qui suit le choix
d'une direction est payant.

| gratuit | payant (`payment_required` sinon) |
|---|---|
| `site_catalog`, `brand_kit_entitled`, `consume_generation_credit` | `brand_kit_select_direction`, `site_spec_*`, `site_output_*` |

`brand_kit_entitled(kit)` est **l'unique** définition de « elle a payé ». Un
second exemplaire dans une route est un exemplaire qui dérive. On l'appelle pour
décider quoi **rendre**, jamais pour décider si on **autorise** : la RPC gardée
a déjà décidé.

`false` couvre trois états exprès : pas connectée, pas son kit, pas payé.

## L'ordre de divulgation (à ne pas aplatir)

1. pas de `auth.uid()` → `unauthenticated`
2. pas son kit / inexistant → `not_found`
3. son kit, non payé → `payment_required`
4. son kit, payé, pas de spec → `not_found`

Sur `payment_required` : ouvrir le checkout. Sur `not_found` : s'excuser.
Les fondre en « une erreur est survenue » est le moyen le plus sûr de perdre la
vente.

## Les crédits de génération

`consume_generation_credit(kit)` → booléen, à appeler **juste avant** l'appel au
modèle. `false` = ne pas appeler le modèle, pour toutes les raisons à la fois.

⚠ Lire `generation_credits` et décider depuis les nombres est une course. Les
compteurs sont lisibles pour **afficher**, pas pour décider.

L'allocation vit dans `plans` (tier, label, price_cents, directions_limit,
regenerations_limit). `directions_limit` = directions **par run**.
Total de runs = `1 + regenerations_limit`. **Ne jamais recopier ces nombres.**

## Génération des directions — les bornes dures

`brand_kits.directions` est écrit par le front. Deux CHECK le refusent :

Palette, exactement ces cinq clés (`accent` optionnel en plus) :
`{primary, secondary, light, dark, paper}`.
⚠ `{primary, secondary, accent, light_neutral, dark_neutral}` est **refusé**.

| champ | borne |
|---|---|
| `name` | ≤ 20 car., 1 ou 2 mots |
| `rationale` | 60–95 car. (les deux bouts) |
| `hero.headline` | ≤ 46 |
| `hero.subhead` | ≤ 60 |
| `tone_keywords` | exactement 3 mots simples, joints ` · ` ≤ 32 |
| le tableau | exactement 3 directions, ids distincts, **3 polices de titre distinctes** |

⚠ **Valider en JS AVANT l'insert, et rejouer.** Le CHECK part à l'INSERT, quand
l'appel au modèle est déjà payé. Lire les bornes depuis
`site_catalog().direction_limits`, ne pas les coder en dur.

⚠ Ne pas borner la génération avec `site_spec_limits` : un titre de direction
fait 46, un titre de spec de site fait 90. Ce ne sont pas les mêmes écrans.

## Le brief

Table `project_briefs`, PK `project_id`. Toutes les colonnes de réponse sont
nullables : un brief à moitié rempli est l'état **normal**.

- `palette_family_ids` est **ordonné** (l'élément 1 pilote la preview), max 3.
- Les catalogues : filtrer `active = true` **à l'affichage** seulement. La
  lecture ne filtre pas dessus, pour qu'un brief ayant choisi une carte retirée
  continue de la résoudre.
- `brief_preview(p_brief_id => project_id)` rend toute la preview en un
  aller-retour, avec ses défauts : CLAY & SAND, Fraunces / Nunito Sans,
  « A calmer place to start. », « Book a consult ».
- `projects.current_step` (1..8) et `progress_step` (1..7) **ne sont pas
  synchronisés** : cycle de vie du projet vs. reprise du brief.

## Ce que le front ne doit jamais faire

- Écrire `brand_kits.selected_direction_id` en direct : un trigger le refuse
  (42501). Passer par `brand_kit_select_direction`.
- Écrire `spec_version` ou `change_marks` : retirés aux clients par privilège
  de colonne.
- Recalculer l'entitlement, les allocations, ou les bornes de longueur.

## Stripe

`grant_plan_allowance(p_project_id, p_tier, p_grant_key)` — **service_role
uniquement**, depuis le webhook. Passer **l'id d'événement Stripe**, toujours.

⚠ La forme à 2 arguments n'est pas idempotente contre celle à 3 pour le même
achat : les deux rendent `true`, écrivent deux `plan_grants` et remettent le
compteur à zéro deux fois. Une seule forme, partout.

⚠ Si le webhook n'appelle jamais cette fonction, une cliente qui a payé reste
sur le plan `free` : l'entitlement (piloté par `purchases`) lui ouvre le
livrable, mais son allocation reste à deux runs. Rien ne le déduit.

Statuts qui donnent droit : `paid` et `partially_refunded`. Pas `pending`,
`failed`, `refunded`, `disputed`.
