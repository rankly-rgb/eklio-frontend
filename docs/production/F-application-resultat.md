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

---

## Seconde tentative — 2026-09-27, même session : toujours injoignable

Les deux réglages ont été faits, mais **ce conteneur ne les voit pas** :
`SUPABASE_DB_PASSWORD` est absente de l'environnement du processus, d'un shell de
connexion et du processus initial. Les réglages d'environnement s'appliquent aux
**nouvelles sessions**.

Et un second obstacle, qu'une nouvelle session ne lèvera pas : **le port 5432 du
pooler n'est pas joignable en direct** (les IPv4 du pooler répondent « fermé »),
et le proxy de sortie, s'il accepte le tunnel `CONNECT` vers
`aws-0-us-east-1.pooler.supabase.com:5432` (« 200 Connection Established »),
**ne laisse pas passer le protocole Postgres** : le `SSLRequest` reste sans réponse.
Le proxy intercepte le TLS ; la négociation Postgres n'est pas du TLS d'emblée.
Autoriser un domaine dans la politique réseau ouvre le HTTPS vers lui, pas le
protocole Postgres.

Rien n'a été lu ni écrit en production. Deux voies :

1. **Lancer le script depuis une machine qui atteint Postgres** — celle de Naima :
   `psql` et `pg_dump` 16 ou plus récents, les deux dépôts, Postgres local pour la
   copie. Le script est autonome et s'arrête de lui-même sur toute condition rouge.
2. Ou une connexion sans proxy, si l'environnement cloud en propose une (niveau
   d'accès réseau « complet ») — à vérifier dans ses réglages, puis une **nouvelle
   session**.

L'achat de contrôle d'après est écrit dans `B5-stripe.md` §5b.

---

## Voie G — l'éditeur SQL de Supabase (2026-09-27)

Aucun environnement n'atteignant Postgres, les migrations passent par
l'éditeur SQL du tableau de bord. Deux fichiers, régénérés et éprouvés par
`G-generer.sh` (ne pas les éditer à la main) :

| fichier | quoi |
|---|---|
| `G-migrations-a-coller.sql` | garde-fou, les 30 migrations chacune suivie de son inscription au registre, les droits explicites des 71 objets créés, contrôles avant commit — **une seule transaction** |
| `G-verifications.sql` | 11 contrôles en lecture seule, OK / PAS OK et le détail |

**Le rôle de l'éditeur.** Les privilèges par défaut de Supabase sont attachés à
`postgres` : sous un autre rôle, les 19 tables créées n'auraient aucun droit pour
l'application et les 51 fonctions seraient exécutables par PUBLIC. Le fichier
passe donc en `postgres` pour la transaction et pose explicitement les droits des
71 objets ; si le rôle de l'éditeur ne peut pas devenir `postgres`, il s'arrête
sur la première ligne utile.

**Éprouvé sur une copie de la production reconstruite** :

| cas | résultat |
|---|---|
| collé en `postgres` | identique à la référence : 1396 objets, droits, propriétaires, policies, triggers, colonnes ; registre 163 |
| collé par un rôle membre de `postgres` | identique, 0 écart |
| collé par un rôle étranger à `postgres` | arrêt à `set local role postgres`, rien de fait |
| une migration qui échoue au milieu | tout annulé, y compris les tables des migrations précédentes ; registre 133 |
| collé une seconde fois | refusé : « déjà enregistrées », rien de changé |
| vérifications, copie migrée / non migrée | 11/11 OK / 11/11 PAS OK |
| un droit accordé à un rôle tiers / F63 rouverte à `anon` | pas de fausse alerte / signalée deux fois |

**Taille : 466 Ko.** Si l'éditeur refuse un texte de cette taille, ne pas le
découper — la transaction unique est ce qui rend l'échec sans conséquence.
