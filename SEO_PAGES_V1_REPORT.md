# Pages SEO mensuelles v1 — rapport

**12 pièces sont sorties du vrai chemin produit (3 comptes de test, base locale). 2 ont passé tous les contrôles du premier coup. Le dernier mois, propre, fait 3 pièces pour 0,154 $, soit 0,4 % des 39 $ de l'abonnement.**

## Ce qui est fait

**Backend** (`eklio-backend`, branche `claude/seo-pages-v1`, trois commits, chacun vérifié vert isolément) :

| Migration | Contenu |
|---|---|
| `20261112100000_seo_targets_templates_metrics.sql` | `seo_query_templates`, `seo_modality_terms` et `seo_population_terms` (termes de recherche curés), `seo_query_metrics` (vide), `seo_targets` avec `UNIQUE (user_id, intent_key)` |
| `20261112101000_seo_pieces_review_lifecycle.sql` | `seo_pieces` ; `CHECK` NULL-sûrs (FAQ, JSON-LD, slug, URL, complétude) ; `GRANT UPDATE` par colonne (`status`, `published_url`, `body_md`) ; trigger de transitions ; garde éthique et phrases bannies **en trigger** |
| `20261112102000_seo_quota_chokepoint.sql` | `seo_quota_config`, `seo_slot_claims`, `seo_month_entitled`, `seo_quota_for`, `claim_seo_slot` (verrou consultatif, quota + tentatives), `release_seo_slot` ; `seo_pieces.slot_id NOT NULL` en clé composite ; une quarantaine rend l'emplacement par trigger |

**Frontend** (`eklio-frontend`, branche `claude/seo-pages-v1`) :
- `lib/seo/` (ciblage, brief, rédacteur, contrôles, gates, dérivés, pipeline) ;
- la route `app/api/cron/seo-pages` (drapeau `SEO_GENERATION_ARMED`, absente de `vercel.json`) ;
- la section **Website pages** (`/app/pages`, `/app/pages/[id]`) et `POST /api/seo-pieces/[id]`.

### Chiffres mesurés

- **Vitest** : 5 217 → **5 346** tests (242 → 249 fichiers), tous verts. Typecheck, lint et build verts.
- **SQL** : 181 → **184** migrations rejouées depuis zéro, 105 → **108** fichiers de test, 0 échec.
- **Vrai mois** :
  - 17 appels `gpt-5.6-terra`, soit 0,038 $ par appel et 0,054 $ par pièce écrite.
  - Plafond par abonnée : 1,50 $ au pire, soit 3,8 % de 39 $.
- **Captures dans le vrai produit** : liste du mois, relecture obligatoire, panneau de copie. Le parcours complet relire → confirmer → copier → « Where did you publish it? » a été joué dans le navigateur, et la base en garde la trace (`approved_at`, `exported_at`, `published_url`).
- **Gates contre une autre abonnée** : la distance entre les deux « first session » de deux praticiennes vaut 0,012 (seuil 0,15).

## Ce que la relecture a trouvé, et corrigé

Sur les 10 pièces mises en quarantaine ou réécrites pendant les deux premiers mois, **la majorité venait de défauts de MES contrôles**, pas du modèle :

| Défaut | Correction |
|---|---|
| « réponse d'abord » refusait « No. », « Not necessarily. », « Yes, you can… » | la FAQ n'est plus bloquante (le brief ne l'exige que sous les H2) |
| `medi-?cal` reconnaissait « medical » comme une assurance | `medi-cal` exigé |
| Le mot « paragraphs » publié comme un paragraphe | contrôle `structure.fragment` |
| Titres en minuscules | casse de tête posée en code |
| La même question sur trois pages de son site | gate `gate.question_repeated` + liste des questions déjà traitées dans le brief |
| Liste détachée de sa phrase d'annonce | contrôle `structure.list_detached` |

Chaque correction est épinglée par un test sur la phrase réelle. Le troisième mois, rédigé après corrections, a été relu en entier :
- aucune affirmation clinique, aucune ville ni aucun fait de cabinet inventés, aucune URL ;
- aucune question répétée entre les pages.

**Remarque non bloquante** : la formule de son USP revient 4 ou 5 fois sur les trois pages. C'est à la praticienne d'en juger en relecture.

## Trouvé sans corriger

Le détail est dans `FOLLOWUP.md`, entrées S1 à S10. Les plus importants :
- **Comptes Instagram** : le cron ignore les octrois comp sans abonnement, et l'éligibilité Instagram est encore décidée en TypeScript.
- **« PSY »** : un psychologue en Californie reçoit la mention « PSY », contre la règle de la migration.
- **Liens externes** : `insight_sources` ne porte que des pages d'accueil. Aucune pièce ne cite donc de source.
- **F142** n'existe pas dans les dépôts. Les types ne sont **pas régénérés** : pas de Docker ni de CLI ici, et la récupération de `postgres-meta` a été refusée. Le code passe donc par `lib/seo/db.ts`, confronté au SQL des migrations.

## Faits du brief qui étaient faux (détail : `DIAGNOSTIC.md`)

- Un chokepoint SQL d'entitlement existait déjà (`check_monthly_presence_entitlement`). Je m'en suis servi.
- Il y a 5 gates USP, pas 4.
- Les « populations » sont les personas.
- Il y a deux colonnes de constructeur ; la bonne est `builder_target_id`.
- `banned_phrases` passe par une RPC regex en service-role, et l'Ethics Guard est ouverte à `authenticated`.

## Arbitrages que j'aurais pris autrement

- **Liens externes à l'URL exacte** : appliqué, mais sans URL profonde curée il ne reste rien à citer. Il faut curer `insight_sources` avant que l'AEO en profite.
- **Quota** : appliqué tel que demandé (1 page locale + 2 articles). Un essai **gratuit** (`credit_plan_for = 'trial'`) reçoit **0** : c'est mon interprétation, réglable dans `seo_quota_config`. Practice Suite (essai payé de 90 jours) et un comp reçoivent 1 + 2.
- Relecture obligatoire, cibles tirées de la grille et section séparée : d'accord.

## Dépense lue dans le journal

`credit_ledger` (base locale, `reason = 'settled: seo_piece_write'`) : 17 règlements, **0,6447 $** au total, sous l'arrêt fixé à 2,50 $. Aucun appel à DataForSEO, Semrush ou à une recherche web, aucun appel Stripe, aucune écriture en production.

## Ce qu'il te reste à faire, dans l'ordre

1. **Migrations** : appliquer, dans l'ordre, `20261112100000`, `20261112101000`, `20261112102000`, depuis `eklio-backend@claude/seo-pages-v1`. Puis régénérer `schema_fingerprint.production.txt`.
2. **Types** : régénérer `types/supabase.ts` dans les deux dépôts (`supabase gen types`), en réappliquant l'addendum du frontend. Ensuite, passer `lib/seo/db.ts` aux appels typés (S4).
3. **Variables** : poser `SEO_GENERATION_ARMED=false` **explicitement** dans Vercel. `OPENAI_API_KEY` et `CRON_SECRET` existent déjà.
4. **Décisions** : les URL profondes à curer dans `insight_sources` ; le quota de l'essai gratuit.
5. **Armer**, en dernier : ajouter `/api/cron/seo-pages` à `vercel.json`, puis passer `SEO_GENERATION_ARMED` à `true`.

## Note sur la branche

Tu as demandé `claude/seo-pages-v1` ; la session en prévoyait une autre (`claude/relaxed-clarke-viyecj`). J'ai suivi ta consigne explicite. Les deux dépôts sont poussés sur `claude/seo-pages-v1`. Rien n'a été fusionné, rien n'est sur `main`, et aucune PR n'a été ouverte.
