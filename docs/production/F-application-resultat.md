# F — Les 30 migrations en production : NON appliquées, et le script qui le fera

**2026-09-27, après-midi.** Feu vert de Naima pour l'étape 2 de la séquence
(`D-le-dernier-geste.md`) : les migrations, et rien d'autre.

## ⚠ Condition 1 impossible : rien n'a été lu ni écrit en production

| ce qu'il fallait | ce que le conteneur avait |
|---|---|
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | **absentes** de l'environnement, et de `/run/secrets` |
| l'hôte direct `db.fobgdsupyfslxbswfuay.supabase.co:5432` | résout en **IPv6 seulement**, que ce conteneur ne prend pas en charge |
| le pooler Supabase (IPv4) | **fermé** |
| `api.supabase.com` | **refusé** par le proxy (403 au CONNECT) |

Un connecteur Supabase est attaché à la session, mais il ne produit pas de
sauvegarde `pg_dump` restaurable : il ne remplit pas la condition 1. **Il n'a pas
été utilisé.** Aucune donnée de production n'a été lue.

**Pour la prochaine session** (réglages de l'environnement → Edit) :
`SUPABASE_DB_PASSWORD` en variable d'environnement, et l'hôte du **Session
pooler** (tableau de bord Supabase → Connect, par ex.
`aws-0-us-east-1.pooler.supabase.com`) ajouté aux domaines autorisés. Le jeton
d'accès n'est pas nécessaire au script.

## Ce qui a été fait à la place : le script, éprouvé sur une doublure

`docs/production/F-appliquer-les-migrations.sh` joue les quatre conditions puis
l'application, et **refuse d'écrire** tant qu'elles ne sont pas toutes vertes.
Il a été joué de bout en bout contre une **doublure de la production** : la base
reconstruite depuis les 133 migrations de `main`, servie en TCP avec mot de passe
comme le serait le pooler, avec un registre `schema_migrations`.

| étape | sur la doublure |
|---|---|
| 0 · lecture, registre | ✓ aucune des 30 déjà enregistrée ; version du serveur contre `pg_dump` vérifiée |
| 1 · sauvegarde | ✓ horodatage du serveur relevé et rapporté |
| 2 · restauration prouvée | ✓ **droits identiques** (476 fonctions, tables, policies) ; **67 tables identiques ligne à ligne** (compte + md5 du contenu) |
| 3 · rejeu à blanc | ✓ 30/30, 0 erreur ; **301 objets ajoutés, 0 retiré** |
| 4 · `main` contre la copie migrée | ✓ tout le parcours du webhook ; seul échec, la double allocation de 4c (défaut de `main`, corrigé par la branche) |
| application | ✓ 30/30, une transaction par migration, **inscrite au registre sous le nom du fichier** (comme `supabase db push`) |
| relance | ✓ refuse : « déjà enregistrées » |
| F63 | ✓ les quatre fonctions fermées à `anon` |

## Ce que l'épreuve a trouvé — avant que ça compte

1. **Mon script sauvegardait avec `--no-privileges`.** La copie restaurée avait
   chaque fonction ouverte à tous ; le rejeu l'a refusé (« comp_grant_active was
   opened to authenticated »). Corrigé : sauvegarde avec les droits, et les rôles
   de la production sont recréés localement avant la restauration.
2. **`A-restaurer.sh` certifiait « 0 écart » sur cette copie aux droits perdus.** Il
   comparait les lignes, jamais les droits. Une restauration de production qui
   aurait ouvert toutes les fonctions à `anon` passait sa vérification. Corrigé :
   empreinte des droits des fonctions, des tables, du RLS et des policies ;
   contre-épreuve faite (l'ancienne sauvegarde échoue maintenant).
3. **`A-restaurer.sh` avalait un `dropdb` raté** : une cible tenue ouverte était
   restaurée par-dessus. Bloquant désormais.
4. **Le rôle qui applique compte.** Sous `postgres`, les privilèges par défaut de
   Supabase donnent `EXECUTE` à `anon`/`authenticated` sur chaque nouvelle
   fonction ; sous un autre rôle, non (48 écarts de droits sur la doublure, tous
   de cette nature). Le script se connecte en `postgres.<ref>` — le même rôle que
   le rejeu local, où F63 et F64 tiennent (7 fonctions fermées à `anon`).
   ⚠ Observation, hors périmètre : `abandon_stale_generation_runs()` reste
   exécutable par `authenticated` dans ce modèle ; il ne touche que des lots de
   plus de 29 jours.

## Les vérifications d'après — ce qui en restera à la prochaine passe

| vérification | comment | limite |
|---|---|---|
| dérive production / rejeu | la même comparaison, production contre `eklio_local_verify` | écarts attendus : ceux de `schema_drift_accepted.txt` |
| F63 | `has_function_privilege('anon', …)` sur les quatre | — |
| `/api/cron/content-month` → 503 | `curl` sur le domaine de production | domaine inconnu des dépôts (D §0) |
| achat de test contre la production migrée | ⚠ **impossible sans argent réel en l'état** : la production a une clé **live**, et un événement signé exige le `whsec_` de l'endpoint de production, qu'aucun agent ne détient. Faisable : un checkout en carte réelle remboursé aussitôt (B5 §5), par Naima — ou un rejeu du dernier event réel depuis le tableau de bord Stripe | décision de Naima |

## Ce qui reste avant la fusion

1. Les deux réglages d'environnement ci-dessus, puis **une session qui lance le
   script** (≈ 15 min, dont 5 pour la condition 4).
2. Les vérifications d'après.
3. Le feu vert de Naima pour l'étape 3 — la fusion, qui est le déploiement.
