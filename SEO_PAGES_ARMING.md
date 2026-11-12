# Pages SEO mensuelles — runbook d'armement

À suivre seule, dans l'ordre, une étape après l'autre. Ce document ne fait rien lui-même.

Pour chaque étape, il donne trois choses :
- le geste exact ;
- la vérification en lecture seule à lancer juste après, avec le résultat attendu ;
- ce qui doit t'arrêter, et comment revenir en arrière sans perte.

Les requêtes de vérification sont regroupées dans `scripts/seo-pages/arming-checks.sql`. Elles ont été éprouvées sur la base locale rejouée depuis zéro avant d'être écrites ici. Lance-les dans l'éditeur SQL du projet `fobgdsupyfslxbswfuay` (lecture seule, aucune n'écrit).

> **Deux préalables qui ne sont pas des étapes techniques** (rapport, « Session 2 ») :
> 1. **Le message des États non vérifiés.** Une abonnée de New York ou du Texas lit aujourd'hui « Your first pages arrive on {date} » alors que rien n'arrivera (FOLLOWUP S12). Ce message est visible dès que la section est déployée, même drapeau éteint. Il est à trancher avant l'étape 4.
> 2. **La cadence du cron.** Un déclenchement sert une à deux abonnées (S11). Décide-la avant l'étape 6.

---

## 1. Appliquer les trois migrations

**Geste.** Depuis `eklio-backend`, sur la branche qui porte les migrations (`claude/seo-pages-v1`, ou `main` après fusion) :

```bash
supabase link --project-ref fobgdsupyfslxbswfuay
```

```bash
supabase db push --linked --dry-run
```

La liste affichée doit contenir **exactement** ces trois fichiers, dans cet ordre :

1. `20261112100000_seo_targets_templates_metrics.sql`
2. `20261112101000_seo_pieces_review_lifecycle.sql`
3. `20261112102000_seo_quota_chokepoint.sql`

Puis :

```bash
supabase db push --linked
```

**Vérification.**

a. Les trois versions sont enregistrées. Attendu : 3 lignes.
```sql
select version from supabase_migrations.schema_migrations
 where version in ('20261112100000', '20261112101000', '20261112102000') order by 1;
```

b. à e. Ce sont les blocs « Étape 1.b » à « Étape 1.e » de `arming-checks.sql`. Résultats attendus :
- **1.b** : 8 tables, `rls = t` partout.
- **1.c** : `templates 5`, `modality_terms = active_modalities`, `population_terms 10`, `quota_rows 4`, `metrics 0`, `pieces 0` ; quotas `standard 1/2`, `trial 0/0`.
- **1.d** : `claim_seo_slot`, `release_seo_slot`, `seo_quota_for`, `seo_month_entitled` → `anon f`, `authenticated f`, `service_role t`.
- **1.e** : un abonné payant ou comp → `local_page 1`, `article 2`. Un essai gratuit → `0 / 0` (aucune ligne = aucun compte en essai, rien à vérifier). Un uuid inconnu → `0 / 0`.

**T'arrêter si :**
- le `--dry-run` liste une autre migration que ces trois-là. La production aurait alors une dérive à comprendre d'abord : ne pousse rien ;
- l'une des vérifications diffère.

**Revenir en arrière.** C'est possible tant que `seo_pieces` est vide, ce qui est le cas jusqu'à l'étape 7. Vérifie d'abord `select count(*) from public.seo_pieces;` → `0`. Puis, en une transaction :
```sql
begin;
drop table if exists public.seo_pieces, public.seo_slot_claims, public.seo_quota_config, public.seo_targets,
  public.seo_query_metrics, public.seo_query_templates, public.seo_population_terms, public.seo_modality_terms cascade;
drop function if exists public.claim_seo_slot(uuid, date, text), public.release_seo_slot(uuid, text),
  public.seo_quota_for(uuid, date), public.seo_month_entitled(uuid, date), public.seo_pieces_slot_gate(),
  public.seo_pieces_quarantine_is_final(), public.seo_pieces_ethics_gate(), public.seo_pieces_transition_gate(),
  public.seo_targets_kit_owner_gate(), public.seo_faq_valid(jsonb), public.seo_jsonld_valid(jsonb),
  public.seo_template_slots(text);
delete from supabase_migrations.schema_migrations where version in ('20261112100000', '20261112101000', '20261112102000');
commit;
```
Les migrations sont purement additives : aucune table existante n'est modifiée. Rien d'autre n'est donc à restaurer.

---

## 2. Rafraîchir l'empreinte du schéma

**Geste.** Depuis `eklio-backend`. `$PROD_URL` est la chaîne de connexion de production, posée dans ton shell et nulle part ailleurs.
```bash
psql "$PROD_URL" -At -f supabase/tests/helpers/schema_fingerprint.sql | sort > supabase/tests/helpers/schema_fingerprint.production.txt
```
Puis commite le fichier, avec un message sur le modèle des précédents (« Empreinte de production rafraîchie (184 migrations) … »).

**Vérification.** Sur ta machine :
```bash
bash scripts/local-verify.sh
```
Dans la section « Drift against the recorded production fingerprint », aucun objet `seo_*` ne doit rester en « ONLY IN THE REPLAY ».

Le contrôle exact :
```bash
python3 supabase/tests/helpers/schema_drift_report.py supabase/tests/helpers/schema_fingerprint.production.txt /tmp/_replay_fingerprint.txt | grep -c "seo_"
```
Attendu : `0`. Le workflow `schema-drift.yml` de la branche doit passer.

**T'arrêter si :** un objet `seo_*` apparaît en « DIFFERENT ». La production n'a alors pas exécuté ce que le dépôt décrit : compare les deux lignes avant tout.

**Revenir en arrière.** `git revert` du commit d'empreinte. Rien en base.

---

## 3. Régénérer les types dans les deux dépôts

**Geste.**
- Dans `eklio-backend` :
  ```bash
  supabase gen types typescript --project-id fobgdsupyfslxbswfuay > types/supabase.ts
  ```
- Dans `eklio-frontend`, même commande. **Réapplique ensuite l'ADDENDUM écrit à la main** en fin de fichier (`ProjectStatus`, `SubscriptionStatus`, `PurchaseStatus`). Recopie-le depuis la version précédente : `git show HEAD:types/supabase.ts | sed -n '/ADDENDUM/,$p'`.

**Vérification.** Dans `eklio-frontend` :
```bash
grep -c "claim_seo_slot\|seo_quota_for\|release_seo_slot\|      seo_pieces: {\|      seo_targets: {" types/supabase.ts
```
Attendu : `5` ou plus.

```bash
npm run typecheck
```

```bash
npx vitest run lib/seo types/__tests__/generated-types-drift.test.ts lib/__tests__/rpc-signatures.test.ts
```
Tout doit être vert. Le module SEO passe encore par un accès non typé (`lib/seo/db.ts`) : il compile donc avec ou sans ces types. Ce qui prouve qu'il correspond à la base, c'est `lib/seo/__tests__/rpc-contract.test.ts`, qui confronte ses colonnes et ses RPC aux migrations. Le passage aux appels typés est la tâche S4 de `FOLLOWUP.md` (du code, hors runbook).

**T'arrêter si :** `typecheck` échoue sur un fichier hors `lib/seo` (dérive des types existants, l'ancien F142), ou si l'addendum manque.

**Revenir en arrière.** `git checkout -- types/supabase.ts` dans chaque dépôt.

---

## 4. Poser `SEO_GENERATION_ARMED=false` dans Vercel

**Préalable.** Le code doit être déployé (fusion de `eklio-frontend@claude/seo-pages-v1`, ta décision), sinon la route n'existe pas encore. Le message des États non vérifiés doit être tranché (préalable 1).

**Geste.** Vercel → projet eklio-frontend → Settings → Environment Variables → `SEO_GENERATION_ARMED` = `false`, en **Production, Preview et Development**. Écris la valeur explicitement plutôt que de laisser la variable absente (même règle que `CONTENT_GENERATION_ARMED`, `docs/production/B3-armer-la-generation.md`). Redéploie.

**Vérification.**
```bash
curl -sS -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $CRON_SECRET" https://eklio.app/api/cron/seo-pages
```
Attendu : `503`. Sans `-o /dev/null`, le corps contient `"armed":false`.

En SQL, bloc « Étape 4 et 6 » de `arming-checks.sql` : attendu `0 | 0 | 0`.

**T'arrêter si :** le code de retour est `200`, ou si l'une des trois valeurs SQL est non nulle.

**Revenir en arrière.** Rien à défaire : la variable éteinte est l'état sûr.

---

## 5. Curer les URL profondes de `insight_sources`

C'est la seule liste de liens externes qu'une pièce peut citer. La comparaison se fait **à l'URL exacte** (à la barre finale près) : une pièce qui cite une URL absente de la table échoue. Aujourd'hui, la table ne contient que des pages d'accueil, si bien qu'aucune pièce ne cite de source (S6).

**Format attendu**, une ligne par page :

| Colonne | Valeur |
|---|---|
| `id` | identifiant `snake_case`, unique, stable |
| `label` | nom de la source, 80 caractères au plus |
| `kind` | `association`, `government`, `journal`, `feed`, `calendar` ou `press` |
| `url` | l'URL exacte de la page, `https://`, celle qu'on veut voir citée |
| `active` | `true` |
| `sort_order` | entier |

**Geste**, gabarit à compléter :
```sql
insert into public.insight_sources (id, label, kind, url, active, sort_order) values
  ('<id>', '<label>', '<kind>', 'https://<page exacte>', true, <ordre>);
```

**Vérification.** Le bloc « Étape 5 » de `arming-checks.sql` liste toutes les URL citables. Chaque nouvelle URL doit répondre `200` :
```bash
curl -sS -o /dev/null -w "%{http_code}\n" "<url>"
```

**T'arrêter si :** une URL redirige ou répond 404. La veille hebdomadaire lit **la même table** : une ligne ajoutée ici devient aussi une source de veille.

**Revenir en arrière.**
```sql
update public.insight_sources set active = false where id in (...);
```
Ne supprime pas la ligne : `insight_cards.source_id` la référence.

---

## 6. Ajouter la route cron à `vercel.json`

**Geste.** Dans `eklio-frontend/vercel.json`, ajoute à `crons` :
```json
{ "path": "/api/cron/seo-pages", "schedule": "*/15 * * * *" }
```
**Pourquoi toutes les 15 minutes.** Un déclenchement sert une à deux abonnées, et un mois d'abonnée prend 1,5 à 2,5 minutes (S11). La route est idempotente : une fois toutes ses abonnées servies, un appel ne fait que des lectures, sans réservation ni dépense. À 15 minutes, environ 100 abonnées sont servies en 12 heures. Une cadence sous la journée suppose un plan Vercel qui l'autorise ; un seul appel par jour ne servirait qu'une ou deux abonnées par jour.

Commite, ouvre une PR, fusionne, déploie.

**Vérification.** Vercel → Settings → Cron Jobs doit lister `/api/cron/seo-pages`. Les logs de la route montrent des `503` (drapeau toujours éteint). En SQL, le bloc « Étape 4 et 6 » reste à `0 | 0 | 0`.

**T'arrêter si :** une réponse `200` apparaît dans les logs (le drapeau n'est pas à `false` là où la route tourne).

**Revenir en arrière.** Retire l'entrée, puis redéploie.

---

## 7. Un premier mois sur ton propre compte de contrôle, à la main

**Préalables.** Ton compte doit avoir :
- un kit ;
- un brief complet : ville, État **vérifié** (aujourd'hui la Californie seulement), modalités, licence et numéro ;
- un nom de praticienne dans la spec du site ;
- Monthly Presence active.

La route servirait **toutes** les abonnées à la fois. Ce mois-ci se lance donc par le harnais, pour ton seul compte. Le harnais refuse la production sauf si les deux drapeaux sont présents ensemble, et il s'arrête avant 2,50 $ lus dans `credit_ledger`.

**Geste.** Depuis `eklio-frontend`, sur ta machine, avec les clés dans ton seul shell :
```bash
SUPABASE_SERVICE_ROLE_KEY="<clé service de production>" EKLIO_OPENAI_API_KEY="<clé OpenAI>" bun scripts/seo-pages/run-user-month.ts --confirm --since "$(date -u +%Y-%m-%dT%H:%M:%S)" --user <ton uuid> --month <1er du mois suivant, AAAA-MM-01> --production-url https://fobgdsupyfslxbswfuay.supabase.co --i-write-production --out control-month.json
```

**Vérification**, avec `<uid>` et `<M>` remplacés par tes valeurs.
```sql
select kind, status, (gates_report->>'first_pass')::boolean as first_pass, gates_report->>'reason' as reason, cost_usd
  from public.seo_pieces where user_id = '<uid>' and month = '<M>' order by created_at;
```
Attendu : 3 lignes (1 `local_page`, 2 `article`), statut `needs_review` (une `quarantined` reste acceptable, raison lisible).

```sql
select status, count(*) from public.seo_slot_claims where user_id = '<uid>' and month = '<M>' group by 1;
```
Attendu : `used` = nombre de pièces en relecture ; `released` = quarantaines ; aucun `claimed`.

```sql
select round(sum(actual_cost_usd), 4) from public.credit_ledger
 where user_id = '<uid>' and reason = 'settled: seo_piece_write' and month = '<M>';
```
Attendu : environ 0,15 $, et toujours moins de 0,50 $.

Ensuite, ouvre `/app/pages?month=<M>` et **lis les trois pièces en entier** :
- relecture, copie, puis « Where did you publish it? » sur au moins une pièce ;
- sur la page de la pièce, vérifie la ligne d'autrice telle qu'affichée.

**T'arrêter si :**
- une pièce contient une affirmation clinique, un lieu, un prix, une assurance ou une URL que tu n'as pas fournis ;
- la ligne d'autrice ou la licence est fausse ;
- le coût dépasse 0,50 $ ;
- un emplacement reste `claimed` plus de deux heures.

**Revenir en arrière.** Tes pièces ne sont visibles que de toi. Pour les effacer :
```sql
delete from public.seo_pieces where user_id = '<uid>' and month = '<M>';
delete from public.seo_slot_claims where user_id = '<uid>' and month = '<M>';
```
Ensuite, remets ses cibles disponibles :
```sql
update public.seo_targets set status = 'available', assigned_month = null where user_id = '<uid>' and assigned_month = '<M>';
```
`credit_ledger` est en ajout seul : le coût dépensé y reste, et c'est voulu.

---

## 8. Passer le drapeau à `true`

**Geste.** Vercel → Environment Variables → `SEO_GENERATION_ARMED` = `true` en **Production seulement** (Preview et Development restent à `false`). Redéploie : une variable ne prend effet qu'au déploiement suivant.

**Vérification.** Le premier déclenchement suivant renvoie `200` et `"armed":true` dans les logs de la route. Une heure après :
```sql
select count(distinct user_id) as abonnees_servies, count(*) as pieces from public.seo_pieces where month = '<M>';
```
Les deux valeurs doivent croître de déclenchement en déclenchement.

**T'arrêter si :** un seuil de la section suivante est franchi.

**Revenir en arrière.** Remets `false`, puis redéploie : la route répond `503` dès le déploiement. Rien n'est perdu :
- les pièces écrites restent ;
- un emplacement réservé mais jamais rempli est rendu automatiquement (`stale_claim`) à la réservation suivante de la même abonnée, au-delà de deux heures.

---

## Le lendemain du premier cron : quoi regarder

`<M>` est le mois généré, le 1ᵉʳ du mois suivant le déclenchement.

```sql
-- 1. Où en sont les pièces
select status, count(*) from public.seo_pieces where month = '<M>' group by 1 order by 2 desc;

-- 2. Taux de quarantaine et de passage du premier coup
select count(*) as pieces,
       round(100.0 * count(*) filter (where status = 'quarantined') / nullif(count(*), 0), 1) as quarantaine_pct,
       round(100.0 * count(*) filter (where (gates_report->>'first_pass')::boolean) / nullif(count(*), 0), 1) as premier_coup_pct
  from public.seo_pieces where month = '<M>';

-- 3. Pourquoi les quarantaines
select gates_report->>'reason' as raison, count(*) from public.seo_pieces
 where month = '<M>' and status = 'quarantined' group by 1 order by 2 desc;

-- 4. Ce que ça coûte, par abonnée et en tout
select user_id, round(sum(actual_cost_usd), 4) as usd from public.credit_ledger
 where reason = 'settled: seo_piece_write' and month = '<M>' group by 1 order by 2 desc limit 20;
select round(sum(actual_cost_usd), 2) as total_usd, count(distinct user_id) as abonnees,
       round(sum(actual_cost_usd) / nullif(count(distinct user_id), 0), 3) as usd_par_abonnee
  from public.credit_ledger where reason = 'settled: seo_piece_write' and month = '<M>';

-- 5. Des emplacements bloqués (exécution coupée)
select count(*) from public.seo_slot_claims where month = '<M>' and status = 'claimed' and claimed_at < now() - interval '2 hours';
```

Repères mesurés en session 2, sur 44 pièces réelles :
- 50 à 58 % de passage du premier coup ;
- 8 % de quarantaine au dernier tour (33 % au pire tour, dont 3 sur 4 avaient une cause depuis corrigée) ;
- 0,15 $ par mois d'abonnée en moyenne, 0,21 $ au plus.

**Éteins le drapeau (étape 8, retour arrière) si l'un de ces seuils est franchi :**

| Seuil | Pourquoi |
|---|---|
| **Quarantaine au-dessus de 20 %** sur au moins 15 pièces | Plus du double du dernier tour mesuré : quelque chose a changé (modèle, données, banque) |
| **Une même raison concentre plus de la moitié des quarantaines** | Défaut systématique : un contrôle ou une cible, pas le modèle |
| **Coût moyen au-dessus de 0,50 $ par abonnée**, ou une abonnée au plafond de 1,50 $ | Trois fois la mesure : boucle ou modèle changé |
| **Un emplacement `claimed` depuis plus de deux heures** sur plusieurs abonnées | Exécutions coupées : la cadence ou la durée de la route |
| **Une pièce en relecture avec une affirmation clinique, un lieu ou une URL inventés**, trouvée en la lisant | Les contrôles ne tiennent plus : c'est le seul signal qui ne se lit pas en SQL |
