# E — Fusionner vers `main` : la topologie, et pourquoi la fusion n'a PAS été faite

**2026-09-27.** Phase 1 du brief « fusionner vers main, sans rien mettre en
service ». Tout ce qui suit a été **mesuré** — git, l'API des déploiements GitHub,
et deux webhooks joués contre une base qui a la forme de la production — et rien
n'a été écrit sur `main`.

> **Verdict : ARRÊT, conformément au brief.** Fusionner déclenche un déploiement
> en production (§3). Contre la base de production actuelle, le code de la branche
> casserait **le webhook des abonnements** et **le contrôle d'accès Monthly
> Presence**, qui fonctionnent aujourd'hui (§4). Le Brand Kit, lui, continuerait
> d'encaisser. La fusion est sûre **après** les 30 migrations, et seulement après
> (§5) : prouvé en jouant le code de `main` sur la base complète.

---

## 1 · Ce que porte `main` aujourd'hui

| dépôt | `main` | date | contenu |
|---|---|---|---|
| eklio-frontend | `60f7708` | 2026-09-17 | « Merge claude/bold-bohr-o9kv30: the site setup material » — le produit avant la série F45–F65 |
| eklio-backend | `960b5f3` | 2026-09-17 | « Name the four obsolete migrations, and forbid applying them » — **133 migrations**, celles que la production a enregistrées (B4) |

⚠ L'entrée « MISE EN PRODUCTION » de `FOLLOWUP.md` dit encore « `main` n'existe
pas » (étape 6). C'est faux depuis au moins le 2026-09-02 : `BRANCH_STATE.md` §4
note le renommage de `claude/eklio-bootstrap-ukuxfu` en `main`, « default branch
and Vercel's production branch both updated, by the repo owner ».

## 2 · `claude/busy-dijkstra-040z1t` est-elle un sur-ensemble ?

| branche | frontend : commits absents de busy | backend : commits absents de busy | verdict |
|---|---|---|---|
| `main` | **0** (busy : +147) | **0** (busy : +28) | ancêtre strict — avance rapide possible |
| `claude/gallant-lamport-mt20i0` | **0** (+4) | **0** (+2) | contenue |
| `claude/great-brahmagupta-za7qmx` | **0** (+121) | **0** (+13) | contenue |
| `claude/eklio-reveal-rebuild-28o625` | 115 | 73 | **histoire disjointe** — voir ci-dessous |

**`eklio-reveal-rebuild-28o625` n'a aucun ancêtre commun** avec `main` ni avec
busy (racines `c1dfe319` / `35e44f01` contre `436625d3` / `aa35e451`). C'est une
lignée antérieure (dernier commit 2026-09-02, PR #9, #13, #14, #15). Comparée
fichier à fichier :

| | frontend | backend |
|---|---|---|
| fichiers de reveal-rebuild | 355 | 132 |
| identiques dans busy | 202 | 73 |
| différents | 98 | 17 |
| **absents de busy** (hors `design/reference/`) | **14** | **1** |

Les absents frontend sont **l'ancienne génération mensuelle et l'ancienne page de
kit** : `app/api/cron/monthly`, `app/api/calendar`, `app/api/content/[id]/unlock`,
`lib/generation/monthly.ts`, `lib/presence/month.ts`, `lib/data/calendar.ts`,
`app/app/brand-kits/[id]/page.tsx`, `components/kit/brand-kit-view.tsx`… — **jamais
présents sur la lignée de `main`**, remplacés depuis par `content-month`, le
préalable et les pages de sections. L'absent backend est le test de
`monthly_content_calendar`, retiré avec sa table morte le 2026-09-10 (`328544d`).

**Rien de reveal-rebuild n'est à reprendre.** Aucune branche n'a été supprimée.

## 3 · Ce que Vercel déploie — lu dans l'API des déploiements GitHub

| environnement | ce qui déclenche | preuve |
|---|---|---|
| **Production** | **un push sur `main`** | dernier déploiement Production : `60f7708` (= `main`), 2026-09-17 14:30 ; 20 déploiements Production, tous sur la lignée de `main` |
| **Preview** | **chaque commit poussé sur n'importe quelle branche** | busy `c5a3721` déployé en Preview le 2026-09-27 à 10:42 |

Aucune `vercel.json` ni `.vercel/` ne porte la branche : c'est un réglage du
projet Vercel, et l'API des déploiements le montre. Le backend n'a aucun
déploiement (Supabase ne se déploie pas depuis git).

⚠ **Fusionner vers `main`, c'est déployer en production.** « Fusionner déplace du
code, n'arme rien » est vrai pour la génération (la route reste en 501) ; ce n'est
pas vrai pour le reste du code, qui part servir de vraies requêtes.

⚠ Et chaque Preview de busy tourne **déjà** avec les variables de portée Preview.
Si elles pointent vers la base de production, les défauts de §4 existent déjà sur
ces URL de prévisualisation. Invérifiable sans accès Vercel — à regarder.

## 4 · La question qui décide : busy déployée sur la base de production actuelle

**Méthode.** Une base reconstruite depuis les 133 migrations de `main` backend et
sa graine (0 échec), servie par PostgREST ; le webhook de busy puis celui de
`main` joués contre elle par `scripts/stripe-path/play.ts` (événements signés,
vraie route). Et un relevé des 229 objets que les 30 nouvelles migrations
ajoutent — **0 retiré** : elles sont purement additives —, recherchés dans le code
de busy et de `main`.

### Ce qui CASSERAIT — ce qui fonctionne aujourd'hui

| route / surface | sur `main` aujourd'hui | sur busy, base actuelle | cause |
|---|---|---|---|
| `POST /api/stripe/webhook` — `customer.subscription.created/updated/deleted`, `invoice.payment_failed` | ✓ 200, abonnement écrit | **✗ 500 à chaque event** (`PGRST204`) — joué : 7/7 | `subscriptions.stripe_event_at` (F61) |
| `POST /api/stripe/webhook` — `checkout.session.completed` de **Signature** | ✓ | kit débloqué ✓, mais l'abonnement des trois mois inclus n'est **jamais** enregistré | même colonne, via `upsertSubscription` |
| `POST /api/monthly-presence/checkout` | ✓ refuse une abonnée déjà active | **✗ ouvre un SECOND checkout d'abonnement à une abonnée active** — double facturation possible | `canUseMonthlyPresence` appelle la RPC `monthly_presence_entitled`, absente → `false` |
| accueil `/app` (`lib/data/home.ts`) | ✓ | **✗ Monthly Presence affiché verrouillé pour toutes les abonnées** | même RPC |

### Ce qui continuerait de FONCTIONNER — le Brand Kit encaisse

| route | busy, base actuelle | joué |
|---|---|---|
| checkout Starter / Practice / Signature | ✓ | — (création de session : Stripe) |
| webhook `checkout.session.completed` (kit) | ✓ achat, allocation, `plan_tier` — **les trois paliers** | ✓ |
| rejeu, doublon parallèle, signatures forgées, paiement différé | ✓ | ✓ |
| remboursement d'un kit | ✓ | ✓ |

### Ce qui ne marchait pas et ne marcherait toujours pas — pas une régression

Les écrans et routes de contenu mensuel (`/app/content`, `/app/content/[id]`,
`swap`, écriture à la demande, compteur de crédits, `cron/release-topics`)
appellent des tables et RPC absentes de la production ; elles n'existent pas sur
`main` non plus. Et `/api/cron/content-month` **reste en 501** (vérifié sur busy).

**Conclusion : une route existante casserait — trois, dont une qui peut facturer
deux fois. La fusion n'a pas été faite.**

## 5 · L'ordre sûr, prouvé

Le code de `main` **tel qu'il est déployé** a été joué contre la base **complète**
(133 + 30 migrations) : tout le parcours passe — abonnements, désordre (tenu par le
trigger de F61, même sans que `main` envoie l'horodatage), remboursements. Un seul
échec : **deux allocations pour une session**, défaut de `main` que busy corrige
(B5 §6.4). Les migrations ne cassent donc rien de ce qui tourne.

D'où la séquence, reprise dans `D-le-dernier-geste.md` §0 :

1. **les 30 migrations en production** (le code de `main` continue de fonctionner) ;
2. **puis** fusionner busy vers `main` — c'est-à-dire déployer.

Dans cet ordre, aucune fenêtre ne casse les abonnements ni l'accès Monthly
Presence.
