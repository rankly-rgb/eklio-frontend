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


---

# Session 2 — éprouver avant d'armer (2026-11-12)

**Dernier mois des cinq profils (janvier) : 6 pièces sur 12 passées du premier coup (50 %), les profils B (New York) et C (Texas) n'en recevant aucune. Coût moyen : 0,150 $ par mois d'abonnée. Armable après le runbook ? Non en l'état ; oui une fois tranchés le message affiché aux États non vérifiés et la cadence du cron.**

## Ce qui a tourné

Tout s'est fait sur la base locale, par le vrai chemin `claim_seo_slot` → rédacteur OpenAI → contrôles → `seo_pieces`, drapeau armé dans le seul processus local. Au total : **44 pièces sur 3 mois**, 70 appels réglés au livre.

**Comment les mois ont été déclenchés**
- **Premier tour (décembre)** : par la route de cron, appelée cinq fois, car elle ne sert qu'une abonnée par appel (S11).
- **Deuxième et troisième tours** : par `runSeoMonthForUser`, ce que la route appelle pour chaque abonnée. Le choix du mois diffère : la route vise toujours le mois suivant, et décembre était déjà pris.
- **Janvier** : pour ouvrir ce mois, l'horloge de la **seule base de test locale** a été avancée de 31 jours, par une cale `LD_PRELOAD` compilée dans le bac à sable. Elle n'est pas commitée et ne touche rien du produit.

**Les profils**
- **A, C′, D, E** : 3 mois chacun.
- **B (NY) et C (TX)** : refusés au préalable sur les trois tours (`state_unverified`, F12), sans réservation ni dépense. Les « vérifier » localement aurait assoupli les règles de licence. **C′** (Californie, couples) éprouve donc la population « couples » à la place de C.
- **« Trauma-informed »** (B) n'existe pas au catalogue : B porte `somatic_experiencing` (S13).

**Lena (compte n°3) sur trois mois enchaînés.** Décembre a été publié par le vrai flux (relecture, copie, adresse), puis novembre, puis janvier.
- 9 pièces, 9 intentions distinctes.
- Les pièces de janvier pointent vers ses **5 pages publiées** (le plafond), avec les URL qu'elle a déclarées.
- Les questions répétées ont été prises par la gate, et toutes réécrites.

## Taux, tour par tour

| Tour | Code | Pièces | 1ᵉʳ coup | Quarantaine | En relecture à la fin |
|---|---|---|---|---|---|
| T1 déc. | v1 de la session 1 | 14 (12 cibles + 2 reprises) | 8 (57 %) | 2 (14 %) | 12 |
| Lena nov. + janv. | corrections 1 à 4 | 6 | 1 | 0 | 6 |
| T2 nov. | corrections 1 à 7 (dont 4) | 12 | 7 (58 %) | 4 (33 %), dont 3 cibles impossibles enregistrées avant la correction 1 | 8 |
| T3 janv. | corrections retenues (4 retirée, 10 active puis retirée) | 12 | 6 (50 %) | 1 (8 %) | 11 |

**Ce que montre le taux global, et ce qu'il ne montre pas**
- **Taux global** : il ne monte pas. Sur 12 pièces, il bouge d'une ou deux pièces d'un tour à l'autre.
- **Causes visées par les corrections retenues** : elles ont toutes disparu au dernier tour. Les échecs restants viennent d'autres causes :
  - la meta trop courte (3 pièces sur 12, défaut du modèle, S15) ;
  - trois faux positifs de contrôle nouveaux, mesurés trop tard pour être corrigés puis re-mesurés (S14).
- **Quarantaine** : elle tombe à 8 %.

J'ai appliqué la règle « une correction qui ne fait pas monter le taux est retirée » **cause par cause**. Décision n°8 ci-dessous.

## Les pièces

Le verdict est établi en lisant chaque phrase en cause. « Contrôle » signifie que le contrôle a refusé un texte correct ; « modèle » que le texte était fautif. La distance est le Jaccard sur shingles de 5 racines. Le seuil de collision entre abonnées est 0,15 ; celui de distance chez elle, 0,20.

| Tour | Profil | Pièce | 1ᵉʳ coup | Contrôle(s) en cause au 1ᵉʳ passage | Verdict | Statut final | Coût | Distance max (elle / autres) |
|---|---|---|---|---|---|---|---|---|
| T1 déc. | A | page locale `local:cbt:los-angeles-ca` | oui | — | — | en relecture | 0.024 $ | 0.0031 / 0 |
| T1 déc. | A | article `article:cbt:first-session` | non | seo.meta_length | modèle | en relecture | 0.058 $ | 0.0095 / 0.0046 |
| T1 déc. | A | article `article:cbt:for-high_functioning` | oui | — | — | en relecture | 0.039 $ | 0.0095 / 0.0017 |
| T1 déc. | C′ | page locale `local:gottman:san-diego-ca` | oui | — | — | en relecture | 0.022 $ | 0.0075 / 0.0006 |
| T1 déc. | C′ | article `article:gottman:first-session` | non | seo.title_length | ciblage : requête de 64 car. → corr. 1 | quarantaine | 0.064 $ | 0.0069 / 0.0007 |
| T1 déc. | C′ | article `article:gottman:for-couples_roommates` | non | seo.meta_length, structure.answer_first | modèle ; modèle (ouverture hors sujet) | en relecture | 0.070 $ | 0.006 / 0 |
| T1 déc. | C′ | article `article:gottman:for-new_parents` | oui | — | — | en relecture | 0.034 $ | 0.0069 / 0.001 |
| T1 déc. | D | page locale `local:emdr:oakland-ca` | non | clinical.claim | contrôle : « you will be invited » → corr. 2 | quarantaine | 0.054 $ | 0.004 / 0.0104 |
| T1 déc. | D | page locale `local:somatic_experiencing:oakland-ca` | non | gate.question_repeated | contrôle → corr. 3 | en relecture | 0.055 $ | 0.002 / 0 |
| T1 déc. | D | article `article:emdr:first-session` | non | gate.question_repeated | contrôle → corr. 3 | en relecture | 0.064 $ | 0.0051 / 0.0128 |
| T1 déc. | D | article `article:emdr:for-carrying_old_thing` | oui | — | — | en relecture | 0.034 $ | 0.0033 / 0.0078 |
| T1 déc. | E | page locale `local:emdr:oakland-ca` | oui | — | — | en relecture | 0.031 $ | 0.0022 / 0.0103 |
| T1 déc. | E | article `article:emdr:first-session` | oui | — | — | en relecture | 0.030 $ | 0.0008 / 0.0128 |
| T1 déc. | E | article `article:emdr:for-carrying_old_thing` | oui | — | — | en relecture | 0.035 $ | 0.0028 / 0.0012 |
| T2 nov. | Lena | page locale `local:ifs:berkeley-ca` | non | gate.question_repeated | modèle (section contact reprise) | publiée | 0.048 $ | 0.0081 / 0.0105 |
| T2 nov. | Lena | article `article:emdr:for-high_functioning` | oui | — | — | publiée | 0.029 $ | 0.0016 / 0.0047 |
| T2 nov. | Lena | article `article:ifs:first-session` | non | structure.list_detached | modèle | publiée | 0.056 $ | 0.0081 / 0.0046 |
| T2 nov. | A | page locale `local:act:los-angeles-ca` | oui | — | — | en relecture | 0.027 $ | 0.0031 / 0 |
| T2 nov. | A | article `article:act:first-session` | non | ethics.proven, seo.title_length | ciblage : requête de 67 car. → corr. 1b ; modèle (« get rid of ») → corr. 8 | quarantaine | 0.060 $ | 0.0025 / 0 |
| T2 nov. | A | article `article:cbt:for-first_time_therapy` | oui | — | — | en relecture | 0.042 $ | 0.0092 / 0 |
| T2 nov. | C′ | page locale `local:eft:san-diego-ca` | oui | — | — | en relecture | 0.021 $ | 0.0078 / 0 |
| T2 nov. | C′ | article `article:eft:first-session` | non | seo.meta_length, seo.title_length | ciblage : requête de 61 car. → corr. 1b ; modèle | quarantaine | 0.067 $ | 0.0062 / 0.0022 |
| T2 nov. | C′ | article `article:eft:for-couples_roommates` | oui | — | — | en relecture | 0.042 $ | 0.0056 / 0 |
| T2 nov. | D | page locale `local:pop-carrying_old_thing:oakland-ca` | oui | — | — | en relecture | 0.036 $ | 0.002 / 0.0034 |
| T2 nov. | D | article `article:emdr:for-high_functioning` | non | schema.invalid | modèle (paragraphe vide) | quarantaine | 0.059 $ | 0.0051 / 0.0048 |
| T2 nov. | D | article `article:somatic_experiencing:first-session` | non | seo.meta_length, seo.title_length, structure.answer_first | ciblage : requête de 62 car. → corr. 1b ; contrôle : « You do not need to… » → corr. 9 ; modèle | quarantaine | 0.070 $ | 0.0018 / 0.0015 |
| T2 nov. | E | page locale `local:ifs:oakland-ca` | oui | — | — | en relecture | 0.023 $ | 0.0052 / 0.0038 |
| T2 nov. | E | article `article:emdr:for-caregivers` | oui | — | — | en relecture | 0.037 $ | 0.0019 / 0.003 |
| T2 nov. | E | article `article:ifs:first-session` | non | ethics.proven | modèle (« get rid of ») → corr. 8 | en relecture | 0.064 $ | 0.0021 / 0.0041 |
| T3 janv. | Lena | page locale `local:pop-new_parents:berkeley-ca` | non | gate.question_repeated | modèle (contact recopié) | en relecture | 0.062 $ | 0.0069 / 0.0047 |
| T3 janv. | Lena | article `article:emdr:how-it-works` | non | gate.question_repeated | modèle ×4 (→ corr. 6) + contrôle ×1 (→ corr. 5) | en relecture | 0.080 $ | 0.0056 / 0.0062 |
| T3 janv. | Lena | article `article:ifs:for-new_parents` | non | structure.fragment | contrôle : « Topics may include: » → corr. 7 | en relecture | 0.069 $ | 0.0023 / 0.001 |
| T3 janv. | A | page locale `local:pop-high_functioning:los-angeles-ca` | non | gate.question_repeated, seo.meta_length | contrôle discutable (section contact) ; modèle | quarantaine | 0.052 $ | 0.0034 / 0.0007 |
| T3 janv. | A | article `article:act:for-first_time_therapy` | oui | — | — | en relecture | 0.031 $ | 0.0078 / 0 |
| T3 janv. | A | article `article:cbt:how-it-works` | non | seo.meta_length | modèle | en relecture | 0.058 $ | 0.0092 / 0.0007 |
| T3 janv. | C′ | page locale `local:pop-couples_roommates:san-diego-ca` | non | seo.meta_length, structure.answer_first | contrôle : « uses » ≠ « used » (non corrigé) ; modèle | en relecture | 0.048 $ | 0.0078 / 0 |
| T3 janv. | C′ | article `article:eft:for-new_parents` | oui | — | — | en relecture | 0.043 $ | 0.0031 / 0 |
| T3 janv. | C′ | article `article:gottman:how-it-works` | non | clinical.claim | contrôle : « not … diagnoses » (non corrigé) | en relecture | 0.071 $ | 0.0033 / 0.0006 |
| T3 janv. | D | page locale `local:pop-high_functioning:oakland-ca` | oui | — | — | en relecture | 0.048 $ | 0.004 / 0.0039 |
| T3 janv. | D | article `article:emdr:how-it-works` | oui | — | — | en relecture | 0.040 $ | 0.0022 / 0.0046 |
| T3 janv. | D | article `article:somatic_experiencing:how-it-works` | oui | — | — | en relecture | 0.036 $ | 0.0018 / 0.0011 |
| T3 janv. | E | page locale `local:pop-carrying_old_thing:oakland-ca` | non | structure.answer_first | contrôle ×1 (non corrigé), modèle ×1 | en relecture | 0.070 $ | 0.0017 / 0.0034 |
| T3 janv. | E | article `article:emdr:how-it-works` | oui | — | — | en relecture | 0.030 $ | 0.0022 / 0.0036 |
| T3 janv. | E | article `article:ifs:for-carrying_old_thing` | non | structure.list_detached | modèle | en relecture | 0.072 $ | 0.0052 / 0.0013 |

## Ce que la lecture a montré

**D et E (Oakland, EMDR), les 6 pièces de janvier côte à côte.**
- **Contenu** : aucune affirmation clinique, aucune promesse, aucun lieu ni fait de cabinet inventé, aucune URL. Chaque texte porte le positionnement de sa praticienne : le corps pour D, les aidantes pour E.
- **Collision** : les deux ont reçu le même article, « how EMDR therapy works », et le même plan (huit phases, stimulation bilatérale, clôture, « not hypnosis »). Mais le texte est propre à chacune : distance 0,0128 au plus, très en dessous du seuil de 0,15.
- **La gate n'a rien eu à bloquer, et ne rend aucune pièce impossible à écrire.** Elle compare les mots, pas les intentions. D et E visaient déjà la même page locale en décembre (« EMDR therapy in Oakland, CA »). C'est la décision n°3, pas un seuil.
- **Défaut de E** : le premier paragraphe de sa page locale commence en minuscule (S20).
- **Termes de recherche** : « adults healing from the past », mon terme curé de la session 1, produit des requêtes que personne ne tape vraisemblablement (S19).

**A (psychologue, Los Angeles).** Lu en entier, le contenu est sans défaut de fond.
- **Ligne d'autrice affichée, identique sur les trois pièces : « By Dr. Ines Alvarez, PSY 28456 »** (capture `SAMPLES/session-2/REAL-PRODUCT-PATH_profile-A_2026-12-01_piece-view-byline.png`).
- **JSON-LD** : `{"@type":"Person","name":"Dr. Ines Alvarez"}`, sans `jobTitle`.
- **« PSY 28456 »** a la forme d'un numéro de licence californien. Aucun titre professionnel n'apparaît, ni sur la page ni dans les données structurées : c'est l'effet de S3 (code partagé, non touché, décision n°4).
- **Mineurs** : un « I may suggest… » à la première personne au milieu d'un texte à la troisième, et « CBT therapy » en titre.

## Les corrections, avec leur effet mesuré

| # | Commit | Correction | Type | Avant | Après | Sort |
|---|---|---|---|---|---|---|
| 1 | `ac2f0a8` | Ne pas cibler une requête plus longue que le title (60) | ciblage | 1 quarantaine (T1, 64 car.) | — | gardée, mais incomplète, d'où 1b |
| 1b | `8604192` | …ni la choisir si elle est déjà enregistrée | ciblage | 3 quarantaines (T2, 61 à 67 car.) | 0 (T3) | gardée |
| 2 | `6cf12bc` | « you will be invited » n'est pas une promesse ; le constat cite la phrase | contrôle | 1 quarantaine (T1) | 0 (T2, T3) | gardée |
| 3 | `6457c65` | Deux questions sur deux approches ne se répètent pas | contrôle | 3 réécritures (T1) | 0 | gardée |
| 4 | `ed3781a` | Brief : meta en mots, « trop court est l'erreur fréquente » | brief | trop courts : 138, 139 | trop longs : 163, 168, 172 | **retirée** (`b22383e`) |
| 5 | `98bd8bf` | Deux questions courtes sur un même sujet ne sont pas la même | contrôle | 1 (Lena janv.) | 0 | gardée |
| 6 | `45f451d` | Brief : questions déjà sur son site, à part, en dernier, plus récentes d'abord, 80 au lieu de 40 | brief | 4 répétitions vraies dans une pièce (Lena janv.) | 0 à la régénération ; 1 au T3 (contact) | gardée |
| 7 | `db08e32` | Une introduction de liste suivie de sa liste n'est pas un fragment | contrôle | 2 (Lena janv., régénération) | 0 | gardée |
| 8 | `23889d9` | Brief : nomme « get rid of »… que l'Ethics Guard bloque (le garde lui-même n'est pas touché) | brief | 2/12 (T2) | 0/12 (T3) | gardée |
| 9 | `0fa8614` | « You do not need to… » répond à « How much… do you need…? » | contrôle | 1 (T2) | 0 sous cette forme | gardée |
| 10 | `6c44b87` | Schéma : `bullets_intro` posé par le code devant la liste | schéma | 1/12 (T2) | 1/12 (T3) | **retirée** (`28340fb`) |

**Vérifications**
- Chaque correction a son commit, vert isolément : Vitest, typecheck, lint et build.
- Chaque correction de contrôle épingle la phrase réelle dans un test qui échouait avant.
- Les corrections du brief ont été vérifiées en régénérant seulement les pièces concernées (`scripts/seo-pages/regen-check.ts`, coût au livre, rien d'écrit dans `seo_pieces`) :
  - meta : 142 et 151 caractères au lieu de 139 et 138 ;
  - questions : 0 répétition au lieu de 5.
- Aucune migration n'a été ajoutée, et ni l'Ethics Guard, ni `banned_phrases`, ni les règles de licence n'ont été touchés.
- **Vitest : 5 346 → 5 366 tests**, tous verts.

## Trouvé sans le corriger

Le détail est dans `FOLLOWUP.md`, entrées S11 à S21.

- **S11** : la route sert une à deux abonnées par appel.
- **S12** : ⚠ les États non vérifiés lisent « Your first pages arrive on {date} ». Capture : `SAMPLES/session-2/REAL-PRODUCT-SCREEN_profile-B_NY_app-pages_empty-state.png`.
- **S14** : trois faux positifs de contrôle restants.
  - « uses » et « used » ne donnent pas la même racine dans « réponse d'abord » ;
  - « not … diagnoses » est pris pour un diagnostic ;
  - les sections de contact sont prises pour une répétition.
- **S15** : la meta reste la première cause d'échec du premier coup.
- **S16** : une liste reste parfois détachée de son introduction.
- **S17** : deux abonnées de la même ville peuvent viser la même intention.
- **S18** : la ligne d'autrice de la psychologue ne porte aucun titre professionnel.
- **S19** : deux termes curés sont à relire.
- **S20** : un premier paragraphe peut commencer en minuscule.

## Dépense

Lue dans `credit_ledger` : `reason = 'settled: seo_piece_write'`, à partir du début de session (2026-11-12 17:23 UTC).
- **2,2289 $** pour 70 appels réglés, sous l'arrêt de 2,50 $.
- Le garde de session relit le livre avant **chaque** appel OpenAI (`scripts/seo-pages/session.ts`).
- Cumul des deux sessions au livre : 2,8736 $.
- Aucun appel à DataForSEO, Semrush, une recherche web ou Stripe, aucune écriture en production.

## Décisions qui t'appartiennent

1. **Message des États non vérifiés (S12)** : remplacer « Your first pages arrive on… » par « Website pages are not available in your state yet » tant que l'État n'est pas vérifié. Je recommande ce changement **avant tout déploiement de la section**.
2. **Cadence du cron (S11)** : `*/15 * * * *`, si le plan Vercel l'autorise. Je le recommande : la route est idempotente et un appel sans travail ne coûte rien.
3. **Même intention pour deux abonnées d'une même ville (S17)** : je recommande de l'autoriser, puisque ce sont deux sites distincts dont les textes sont mesurés comme éloignés, plutôt qu'une exclusivité par ville.
4. **Ligne d'autrice du psychologue (S18, code partagé S3)** : je recommande d'ajouter le titre professionnel à la signature et en `jobTitle`, après lecture de la règle californienne.
5. **URL profondes dans `insight_sources` (runbook, étape 5)** : quelques pages thématiques par modalité (APA, NIMH). Sans elles, aucune pièce ne cite de source.
6. **Termes curés (S19)** : relire `seo_modality_terms` et `seo_population_terms`, à commencer par « CBT therapy » et « adults healing from the past ».
7. **Quota de l'essai gratuit** : je recommande de le garder à 0.
8. **Règle de retrait** : je l'ai appliquée cause par cause. Appliquée au taux global, elle retirerait aussi la correction des cibles impossibles, qui supprime des quarantaines certaines. Je recommande de garder la lecture par cause.
9. **« Trauma-informed » au catalogue (S13)** : je recommande de ne pas l'ajouter en v1.

## Livrables de la session

**Runbook** : `SEO_PAGES_ARMING.md`, avec ses vérifications SQL dans `scripts/seo-pages/arming-checks.sql`, éprouvées sur la base locale.

**`SAMPLES/session-2/`** :
- les 9 pièces relues (D et E en janvier, A en décembre), chacune étiquetée vrai chemin produit, profil et mois dans son nom et en première ligne ;
- la capture de la ligne d'autrice de A ;
- la capture de l'écran de B.

**Harnais `scripts/seo-pages/`** :
- `03-session2-profiles.sql`, `session.ts`, `run-user-month.ts`, `regen-check.ts`, `measure.ts`, `publish-month.mjs`, `byline.mjs` ;
- un mode production explicite pour l'étape 7 du runbook (S21).
