# DIAGNOSTIC — Pages SEO mensuelles (Monthly Presence), v1

Établi le 2026-11-12, en lecture seule, sur `main` (frontend `1d50469`, backend `24761f7`).
Préfixes : `FE/` = `eklio-frontend`, `BE/` = `eklio-backend`, `MIG/` = `BE/supabase/migrations`.

État de référence mesuré avant toute écriture :

- **Vitest** : 242 fichiers, **5 217 tests, tous verts** (`npx vitest run`, 18,5 s).
- **SQL** : 181 migrations rejouées depuis zéro sur PostgreSQL 16 local (`BE/scripts/local-verify.sh`), **105 fichiers de test, 0 échec**. La dérive contre l'empreinte de production montre 8 divergences, déjà présentes sur `main` (F81 n'est pas encore en production).

## Verdict

**Aucun fait établi n'est contredit au point de changer l'architecture demandée.** Plusieurs faits sont faux dans le détail. Ils sont listés ici et le code s'y adapte :

| Fait du brief | Ce que dit le code | Effet sur le chantier |
|---|---|---|
| « L'entitlement Monthly Presence est décidé en TypeScript, sans chokepoint SQL » | **Faux depuis le 20 septembre.** `check_monthly_presence_entitlement(uuid)` existe en SQL (`MIG/20260920140000_monthly_presence_has_a_chokepoint.sql:108`, service_role), ainsi que `monthly_presence_entitled()` (`:150`, authenticated). `canUseMonthlyPresence` l'appelle (`FE/lib/billing/entitlements.ts:448`). En revanche, **le cron Instagram choisit encore ses comptes en TS** (`FE/lib/content/month/due.ts:133`, `isEntitledToMonthlyPresence`). | Favorable. `seo_quota_for` s'appuie sur ce chokepoint au lieu de le réécrire. |
| Ethics Guard = « table `ethics_rules`, regex compilées, RPC service-role uniquement » | Les regex sont en TS (`FE/lib/ethics/rules.ts:172`, `checkEthics` `:491`), avec un miroir SQL `ethics_patterns` et `ethics_scan(text)` / `ethics_blocks(text)`. Ces deux fonctions sont accordées à **anon, authenticated et service_role** (`MIG/20260914084054_the_guard_moves_into_the_write.sql:117,135`). `ethics_rules` ne sert qu'à rédiger la consigne de réécriture (`FE/lib/ethics/guard.ts:87-101`). | Nom et droits différents, même usage. |
| `banned_phrases` = « correspondance littérale, PostgREST » | La correspondance est une regex `~*` bornée par `\y`, avec métacaractères échappés, dans la RPC `usp_banned_phrases_check(text) → text[]`, `SECURITY DEFINER` et **service-role uniquement** (`MIG/20260901074903_usp_distinct_and_banned_phrase_checks.sql:110-127`). La table est fermée à anon et authenticated. | Même usage. Côté serveur, l'appel passe par le client admin. |
| « Les quatre gates USP » | Il y en a **cinq** dans `runGates` (`FE/lib/generation/usp-options.ts:259`) : la cinquième est `register`. | Voir §4 : trois s'adaptent au texte long, deux non. |
| « Populations » | Il n'y a pas de colonne « populations » : ce sont les **personas**, `project_briefs.client_persona_ids text[]` → `client_persona_cards`. Leurs libellés ne sont pas des requêtes (« New parents who did not expect to feel this »). | Il faut une table de termes de recherche par clé de persona et de modalité. C'est de la donnée curée, pas du texte libre. |
| « Constructeur de site (Squarespace, Lovable, Framer, Webflow) » | Il y a **deux colonnes** : `project_briefs.builder_target_id` → `builder_targets` (lovable, framer, v0, generic, squarespace, wix, webflow), et `project_briefs.site_platform_id` → `site_platforms`. Cette seconde colonne porte sur la *publication automatique* : Squarespace, Wix et Webflow y sont `refused` (`MIG/20260914091227_the_squarespace_answer.sql`). | La checklist lit `builder_target_id` et couvre les 7 valeurs (`generic` sert de repli). |
| « Nom de la praticienne, titre de licence » dans le brief | Le nom est dans `site_specs.practice_details->>'practitioner_name'`. Le titre vient de `project_briefs.license_type_id` et son sigle de `license_type_states.abbreviation`, uniquement si `verified_at` est posé. | Lecture adaptée. |
| F142 (« un fichier de types a dérivé ») | **F142 n'existe nulle part** : ni dans les `.md` des deux dépôts, ni dans les commits ou les branches. Le plus haut numéro trouvé est F88 (`FE/FINDINGS.md:4152-4283`). Le constat lui-même est vrai : `FE/types/supabase.ts` porte un **ADDENDUM écrit à la main** (`:4107` et suivantes), et les deux copies frontend et backend diffèrent. | Voir §9 : la régénération locale est bloquée dans ce bac à sable. |
| `WriterPort` réutilisable | `WriterPort` est taillé pour des **posts Instagram** (`topics → WrittenPost{cardLine, payload, caption…}`, `FE/lib/content/month/orchestrate.ts:160`). La brique de texte générique en dessous, `TextModel` et `openAiTextModel` avec un compteur `SpendMeter`, est réutilisable telle quelle. | Le rédacteur SEO est un port distinct, `SeoWriterPort`, construit sur les mêmes `openAiTransport`, `meteredCall`, `spendMeter` et `openAiCostUsd`. Le pipeline Instagram reste intact. |

## 1. Le pipeline mensuel Instagram

- **Cron** : `FE/app/api/cron/content-month/route.ts:68` (`GET`). Il est **absent de `FE/vercel.json`**, ce qui constitue le premier verrou (`route.ts:22`).
- **Garde** : `contentGenerationArmed()` (`FE/lib/content/generate/armed.ts:26`) n'accepte que la chaîne exacte `"true"` (`:24`). Sans elle, la route répond 503 en nommant l'interrupteur (`route.ts:72-81`). Elle vérifie ensuite `OPENAI_API_KEY` avant toute lecture (`:88-94`).
- **Choix des abonnées** :
  - `selectDueMonths(serverDuePort(admin))` (`route.ts:100`, `due.ts:110`).
  - Les candidates viennent **de `subscriptions` seulement** (`server-ports.ts:337-344`). Une praticienne qui a seulement un `comp_grants` n'est jamais candidate. Je le note dans FOLLOWUP sans le corriger.
  - L'éligibilité se décide en TS (`due.ts:133`), puis le mois déjà servi et le quota de crédits sont vérifiés.
- **Coût** :
  - Il y a un compteur par compte, `spendMeter(MONTH_CAP_USD = 3)` (`route.ts:115`, `run-for-kit.ts:92`).
  - Le coût est journalisé à deux endroits :
    1. `content_generation_runs.cost_usd` (`FE/lib/content/month/journal-port.ts:420` `rememberCost`, `:472` `publishRun`) ;
    2. **`credit_ledger`**, le livre unique de tout appel payant. On y écrit par `reserve_credit(... p_estimated_cost_usd, p_provider, p_model, p_month)` puis `settle_credit(id, actual)`. Le `kind = 'overhead'` prend zéro crédit et porte quand même son coût (`MIG/20260924100000_every_paid_call_is_in_the_book.sql:92`, vue d'audit `credit_month_audit`).
  - **Le chantier SEO réserve et règle chaque appel sur ce livre, en `overhead`.**
- **Harnais de session** : `FE/scripts/production-path/openai-month/session.ts` tient un journal JSONL de session avec plafond (`sessionMeter`). C'est ce modèle qui sert pour le plafond de 3 $ de cette session.

## 2. `WriterPort`

- **Interface** : `FE/lib/content/month/orchestrate.ts:160`, `write(WriteRequest) → WriteResult`. Le contrat est spécifique aux sujets et aux posts (`:76-158`).
- **Implémentation OpenAI** : `openAiWriter` (`FE/lib/content/month/openai-writer.ts:91`).
  - Il fait un appel `/v1/responses` par sujet, en sortie JSON stricte.
  - Il passe par `meteredCall` (`FE/lib/content/generate/openai.ts:288`), qui réserve le **pire coût** avant l'envoi (`worstCaseCallUsd`) et règle le coût réel (`openAiCostUsd`, `:168`).
  - Le modèle est `OPENAI_COPY_MODEL = "gpt-5.6-terra"` (`FE/lib/content/generate/provider.ts:384`), au tarif de 2 $ / 12 $ le MTok (`copy-batch.ts:119`).
- **Mode fixture** : il n'y a pas de doublure de `WriterPort` dans le produit, par décision (`orchestrate.ts:52-55`). Les tests injectent une doublure. `stubContentModel` (`FE/lib/content/generate/stub-model.ts:89`) double l'ancien `ContentModel`.
- **Journal de dépense** :
  - `WriterLedger` en mémoire (`openai-writer.ts:78`).
  - Le puits `WriteSink.spent` pousse chaque dépense au journal dès qu'elle est connue (`orchestrate.ts:117-122`).
  - Le compteur `SpendMeter` (`openai.ts:241`) refuse l'appel qui franchirait le plafond (`SpendCapReached`).

## 3. Ethics Guard et `banned_phrases`

- **Ethics** :
  - Pur : `checkEthics(text)` (`FE/lib/ethics/rules.ts:491`) → `{ok, violations[{ruleId, severity, excerpt}]}`.
  - Réécriture ciblée : `enforceEthics(fields, rules, rewrite)` (`FE/lib/ethics/guard.ts:110`). Il tente deux réécritures par champ, puis lève `EthicsComplianceError`.
  - En base : `ethics_blocks(text)` est appelée par des **triggers BEFORE INSERT/UPDATE qui lèvent `check_violation`** sur `content_items` (`MIG/20260914084054…sql:185-215`), `site_specs` et `directory_profiles` (`:217`).
- **Banned phrases** :
  - `checkBannedPhrases(text)` (`FE/lib/generation/banned-phrases.ts:12`) passe par le client admin → `usp_banned_phrases_check`.
  - Il n'existe pas de fonction pure.
  - Le trigger `directory_profiles_ethics_gate` applique **les deux** en base (`MIG/20260914084054…sql:217-245`). **C'est le modèle retenu pour `seo_pieces`**. Une modification du corps par la praticienne ne peut donc pas être enregistrée sans passer les deux contrôles, quel que soit l'appelant.
- **En cas d'échec, ailleurs dans le produit** :
  - kit : réécriture ciblée, puis échec du job (`FE/lib/generation/pipeline.ts:235`) ;
  - annuaire : réécriture puis nouveau scan, sinon refus (`FE/lib/directory/generate.ts:273`) ;
  - mois : constat `ethics.blocked` (`FE/lib/content/month-checks.ts:1137`).
  - **Aucune quarantaine n'existe** aujourd'hui. Elle sera neuve dans `seo_pieces.status`.

## 4. Les gates USP sur un texte long

Les cinq gates sont dans `runGates` (`FE/lib/generation/usp-options.ts:259`) :

| Gate | Lieu | Utilisable telle quelle sur 1 000 mots ? |
|---|---|---|
| Phrases bannies | `usp_banned_phrases_check` (SQL) | **Oui**, sans limite de taille. Le `safeParse` qui la précède borne l'énoncé USP à 200 caractères (`how-you-work-shapes.ts:99`), mais l'appel direct n'a pas cette borne. |
| Register | `checkRegister` (`usp-register.ts:89`) | **Non**. Sur un texte long, la moindre mention de la modalité cochée échoue, alors qu'une page EMDR doit dire « EMDR ». |
| Spécificité | `passesSpecificity` (`usp-specificity.ts:47`) | **Non** : un seul token commun suffit (`:52-55`), donc tout texte long passe. Le tokenizer `tokenize` (`:30`) est réutilisable. |
| Distance | Jaccard ≥ 0,55 (`usp-options.ts:369-376`, seuil `usp-guardrails.ts:18`) | **Non** : le seuil est calibré pour 200 caractères et dilué sur un texte long. |
| Collision | `usp_check_distinct` (`MIG/20260901074903…sql:43-88`) | **Non** : la gate est liée à `usp_fingerprints` et à `scope_key`. |

Conclusion :

- Les phrases bannies sont réutilisées telles quelles.
- La spécificité, la distance et la collision sont réécrites pour le texte long, avec des **shingles de 5 mots** (Jaccard), le tokenizer étant réutilisé. La spécificité vérifie la présence de la requête cible et des faits du brief, pas un seul token.
- La collision entre utilisatrices compare aux pièces des autres abonnées de même modalité et même ville. C'est une lecture service-role de `seo_pieces`.
- Le register n'est pas appliqué : il interdit précisément ce qu'une page de modalité doit dire.

## 5. Tamponnage de licence et règles par État

- **Lecture** : `project_briefs.license_type_id`, `license_number` et `state`, puis `license_type_states.abbreviation` et `verified_at` (`FE/lib/content/month/server-ports.ts:79-130`, `serverPreflightPort().licenceFacts` / `.stateVerified`).
- **Mention** : `licenceMention(facts)` (`FE/lib/content/licence.ts:59`) → « LMFT 123456 ».
- **F12** : seul un État dont la ligne est `verified_at` passe (`FE/lib/content/month/preflight.ts:229-237`, `state_unverified`). **La Californie est aujourd'hui le seul État vérifié** (`MIG/20260917160202_california_is_the_first_verified_state.sql:80-101`).
- **F76** : `project_briefs.state` est la seule autorité (`MIG/20261012090000_the_practice_state_has_one_authority.sql:27-30,697`).
- Le pipeline SEO réutilise ces deux lectures et refuse **avant toute réservation** une abonnée dont l'État n'est pas vérifié.
- Incohérence relevée, non corrigée (FOLLOWUP) : un psychologue en Californie a `abbreviation = NULL`, et `licenceMention` retombe sur « PSY » (`licence.ts:41`), contrairement à la migration `:13-20`.

## 6. Les champs du brief lus

| Donnée | Colonne | Forme |
|---|---|---|
| Modalités | `project_briefs.modality_ids text[]` (+ `modality_prominence`) | Clés de `modality_cards` (14 actives). La première est la modalité principale. |
| Populations | `project_briefs.client_persona_ids text[]` | Clés de `client_persona_cards` (10) |
| État, ville | `project_briefs.state` (`^[A-Za-z]{2}$`), `project_briefs.city` | Autorité unique (F76) |
| Constructeur | `project_briefs.builder_target_id` → `builder_targets` | 7 valeurs |
| Nom de la praticienne | `site_specs.practice_details->>'practitioner_name'` (`site_specs.brand_kit_id`) | jsonb |
| Titre, licence | `project_briefs.license_type_id`, `license_number` ; `license_type_states.abbreviation` | Matrice F12 |
| Site existant | `project_briefs.site_url` (http(s), ≤ 500) | Peut être NULL |
| Marque | `project_briefs.positioning`, `usp_statement`, `tone_card_id` ; `brand_kits.voice_guide {sounds_like, never_write}` | Le cron Instagram code la voix en dur (`run-for-kit.ts:210`). Le SEO lit `voice_guide`. |
| Liaison | `project_briefs.project_id` → `projects.user_id` ; `brand_kits.project_id` (unique) | 1 projet = 1 kit |
| Sources externes | `insight_sources.url` (`MIG/20260920150200_insight_watch.sql:22`) | 5 URL, toutes des racines de site (apa.org/news, counseling.org, nimh.nih.gov/news, psychologytoday.com, pubmed). **Aucun lecteur TS aujourd'hui.** |

## 7. L'entitlement Monthly Presence

- **Règle unique en SQL** : `check_monthly_presence_entitlement(p_user)` (`MIG/20260920140000…sql:108-134`). Elle accepte :
  - `subscriptions.status ∈ {active, trialing}` ;
  - ou `past_due` dans la grâce de `monthly_presence_past_due_grace()` (3 jours) ;
  - ou un `comp_grant_active(p_user)` (`MIG/20260901182419_comp_grant_entitlement.sql:64`, soit `revoked_at is null and expires_at > now()`).
- **Palier 249 $ (Practice Suite, `signature`)** : ce n'est pas une donnée à part. L'achat crée un vrai abonnement Stripe avec **90 jours d'essai** (`FE/lib/billing/plans.ts:224`, `FE/lib/stripe/monthly-presence.ts`), donc `status = 'trialing'`. `credit_plan_for(uuid)` distingue l'essai payé (Signature, plan `standard`) d'un essai gratuit (plan `trial`) (`MIG/20260927100000_a_paid_inclusion_is_not_a_trial.sql:31-57`).
- **« Active ce mois » s'exprime en SQL avec les données existantes**, ce qui ne déclenche pas d'arrêt :
  - le droit **maintenant** (chokepoint) ;
  - un mois cible dans la fenêtre de génération (courant ou suivant) ;
  - le droit **couvre encore le 1ᵉʳ du mois cible**. Pour un abonnement `cancel_at_period_end`, il faut `current_period_end > mois`. Pour un octroi comp, il faut `expires_at > mois`.
  - Il n'existe **pas d'historique** d'abonnement : on ne peut pas savoir si quelqu'un était abonné en mars. C'est sans conséquence ici, car on ne réserve jamais pour un mois passé.

## 8. L'onglet Content

- **Routes** : `FE/app/app/content/page.tsx` (mois), `[id]/page.tsx`, `plan/`, `log/`. Ce sont des composants serveur. `createClient()` puis `auth.getUser()`, et redirection vers `/login?next=…` sans session (`page.tsx:47-51`).
- **Paramètres** : `searchParams` est une Promise (Next 16), et `month` est validé par `^\d{4}-\d{2}-01$` (`page.tsx:78-81`).
- **Navigation** : un seul tableau `links` dans `FE/components/app/app-header.tsx:93-120`. L'entrée Content est à `:107`. Ce même tableau alimente `MobileNav`. **C'est là qu'on ajoute « Website pages ».**
- **Composants** : `ButtonLink`/`Button` (`components/ui/button.tsx`), `MonoLabel`, `StatusChip`, `SectionHeader`, et `CopyBlockRow`/`CopyButton`/`useCopied` (`components/site/copy-chip.tsx`, le seul presse-papiers du produit). Les états vides suivent le motif `rounded-card border border-line p-8` (`page.tsx:57-68`).
- **Offre** : `MonthlyPresenceSubscriptionCard` (`components/presence/subscription-card.tsx:19`), plus `/pricing`.

## 9. La CI, les migrations et les types

- **Backend** :
  - `BE/.github/workflows/db-tests.yml` lance `supabase start` (Postgres seul), puis `supabase db reset --local` (rejeu complet, seed compris), puis chaque `supabase/tests/*.test.sql` par `psql -v ON_ERROR_STOP=1`.
  - `schema-drift.yml` compare le rejeu à `schema_fingerprint.production.txt`, un instantané daté.
  - Tests registres à tenir à jour : `20260911180620_tenancy_layer.test.sql` (toute table neuve doit atteindre `projects` ou être classée avec sa raison) et `20260911170458_function_surface.test.sql` (toute fonction `SECURITY DEFINER` exécutable par anon/PUBLIC doit lire `auth.uid()`).
- **Frontend** : `FE/.github/workflows/verify.yml` clone `eklio-backend@main` à côté, puis lance `npm run verify` (typecheck, lint, test, build). **Aucune génération ni vérification de types en CI.**
  - `FE/types/__tests__/generated-types-drift.test.ts` épingle seulement des noms et l'addendum.
  - `FE/lib/__tests__/rpc-signatures.test.ts` compare les `rpc()` aux `Args` déclarés.
- **Génération des types** :
  - Commande documentée : `supabase gen types typescript --db-url …` (`BE/types/supabase.ts:1-27`). Les deux copies actuelles ont en réalité été produites depuis la base de **production** par le serveur MCP.
  - **Bloqueur dans ce bac à sable** : pas de Docker, pas de CLI Supabase. Le générateur `postgres-meta` qu'utilise le CLI n'est pas installé, et sa récupération a été refusée par la politique de la session. Je ne régénère donc pas les types ici. Je ne les édite pas non plus à la main (interdit 8).
  - Le code SEO lit et écrit les nouvelles tables par un accès non typé, isolé dans un seul module (`lib/seo/db.ts`), avec validation Zod à la frontière. La régénération figure dans ce qu'il te reste à faire.

## Conséquences retenues pour la suite

1. `seo_quota_for` / `claim_seo_slot` : en SQL, construits sur `check_monthly_presence_entitlement` et `credit_plan_for`. Le quota est dans `seo_quota_config`, par plan.
2. Les coûts LLM SEO sont réservés et réglés sur `credit_ledger` (`overhead`, `ref_type = 'seo_slot'`), en plus de `seo_pieces.cost_usd`.
3. Les gardes éthiques et les phrases bannies sont appliquées **par trigger** sur `seo_pieces` (modèle `directory_profiles`), et aussi en TS avant écriture pour pouvoir réécrire.
4. Le rédacteur SEO est un port neuf (`SeoWriterPort`) sur le transport et le compteur existants. Le pipeline Instagram n'est pas touché.
5. Les tables de termes de recherche (modalités et personas) sont curées en migration, car les libellés de personas ne sont pas des requêtes.
