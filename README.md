# Eklio — frontend

Plateforme SaaS qui transforme un brief guidé en identité de marque complète
(stratégie, palette, typographies, direction artistique) + un prompt prêt à
coller dans Lovable/Framer/Webflow.

Ce repo porte le frontend Next.js **et** les route handlers / server actions
qui parlent à Supabase et à l'API Anthropic (Claude) — ces appels restent
strictement côté serveur.

Le schéma de base de données (migrations SQL, RLS) vit dans le repo
[`eklio-backend`](../eklio-backend), qui est la source de vérité du schéma,
appliqué sur la base US `eklio-backend-us` (ref `fobgdsupyfslxbswfuay`).
Ce repo ne fait que consommer les types TypeScript générés depuis Supabase
(`types/supabase.ts`) — il n'applique aucune migration.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Postgres, Auth, RLS)
- Anthropic (Claude) — appels serveur uniquement (directions et copy du kit,
  contenu mensuel, suggestions du brief). Les budgets de sortie restent SOUS
  le seuil au-delà duquel le SDK refuse un appel non streamé (~21 300 jetons)
  et lève **côté client**, avant la moindre requête.
- Stripe — checkout hébergé + webhook signé. Le webhook est la **seule**
  autorité sur ce qui est payé : aucune redirection n'accorde de droit.
- Déploiement : Vercel

## Setup local

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs (voir ci-dessous)
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

Sans variables Supabase valides, les pages compilent mais toute page qui
passe par le proxy (`proxy.ts`, ex-middleware) plantera avec une erreur
Supabase explicite — c'est attendu tant que `.env.local` n'est pas renseigné.

## Variables d'environnement

Voir `.env.example`. Ne jamais committer `.env.local`.

| Variable | Où la trouver | Où la mettre sur Vercel |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard Supabase → Project Settings → API → Project URL | Project Settings → Environment Variables (Production + Preview) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard Supabase → Project Settings → API → `anon` `public` key | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard Supabase → Project Settings → API → `service_role` key (secrète) | idem — **jamais** en variable `NEXT_PUBLIC_*` |
| `ANTHROPIC_API_KEY` | Console Anthropic | idem, réservée aux route handlers serveur |
| `NEXT_PUBLIC_SITE_URL` | URL publique du déploiement (ex. `https://eklio.vercel.app`) | idem — base du lien de confirmation d'email (`emailRedirectTo`) **et** des URL de retour de Stripe Checkout ; sans elle, repli sur `http://localhost:3000` |
| `STRIPE_SECRET_KEY` | Dashboard Stripe → Developers → API keys (`sk_test_…` / `sk_live_…`) | idem — **jamais** en `NEXT_PUBLIC_*` |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` en local, ou Dashboard → Webhooks → signing secret (`whsec_…`) | idem — sans elle la route webhook refuse **tout** event |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Dashboard Stripe → API keys (`pk_test_…` / `pk_live_…`) | idem |
| `STRIPE_PRICE_STARTER` / `_PRACTICE` / `_SIGNATURE` / `_MONTHLY_PRESENCE` | Dashboard Stripe → Products, un prix par tier + l'abonnement (`price_…`) | idem — ⚠️ ces ids **diffèrent** entre le mode test et le mode live |
| `RESEND_API_KEY` | Dashboard Resend → API Keys | idem — **absente**, rien n'est envoyé : l'envoi est journalisé et le cron continue |
| `EMAIL_FROM` | Expéditeur affiché, sur un domaine **vérifié** chez Resend | idem — sinon tout part en spam ou est refusé |
| `CRON_SECRET` | Généré à la main, partagé avec Vercel Cron | idem — **absent**, les routes de cron répondent 404 à tout le monde. Sans lui, n'importe qui déclencherait une génération payante par utilisateur |

Les variables `NEXT_PUBLIC_*` sont exposées au bundle client : n'y mettre que
l'URL, la clé anon et la clé publiable Stripe — jamais la service_role key, la
clé Anthropic ni la clé secrète Stripe.

Les **montants** ne sont pas des variables d'environnement : ils vivent dans
`lib/billing/plans.ts`, seule source du prix affiché comme du prix facturé.
L'environnement ne porte que les **identifiants** de prix Stripe.

### Paiement en mode test

La procédure complète (création des prix, `stripe listen`, carte de test,
vérifications en base, rejeu d'un event pour l'idempotence) est décrite dans
`NOTES.md`, section « Checkout Stripe en mode test ». En résumé :

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# reporter le whsec_… affiché dans .env.local, puis redémarrer npm run dev
```

Carte de test : `4242 4242 4242 4242`, date future quelconque, CVC quelconque.

## Structure

```
design/reference/     les huit écrans approuvés — LE CONTRAT VISUEL
styles/tokens.css     seule source des couleurs, rayons, ombres, échelles
app/                  routes (App Router) : pages, layouts, route handlers
  login/, signup/     auth email/mot de passe
  pricing/            tarifs publics — 3 tiers + add-on + FAQ
  dev/ui, dev/preview galeries de contrôle visuel (non liées, sans données)
  app/                espace connecté, protégé par proxy.ts
    briefs/[id]       le brief en 7 étapes + son récapitulatif
    brand-kits/[id]   le kit ; `/reveal` porte génération puis révélation
    content/          le mois entier
    checkout/         choix du tier, add-on, retours succès / annulation
  api/                LA surface HTTP de l'interface (cf. §7 du cahier des charges)
    cron/             run mensuel et relances, appelés par Vercel Cron
components/
  ui/                 primitives (Button, MonoLabel, Progress7, glyphes…)
  preview/            <BrandPreview> et les quatre cartes de marque
  brief/ reveal/ kit/ home/   un dossier par écran
lib/
  brand/              formes, couleurs dérivées, échantillon
  catalog/            lecture du catalogue en base (ton, palettes, paires…)
  data/               clients typés (brief, kit, checklist, calendrier, accueil)
  generation/         pipeline, sélection déterministe, validation, job
  ethics/             socle déontologique + Ethics Guard
  email/              transport, état d'envoi, gabarits
  billing/, stripe/, kit/, api/
types/supabase.ts     types générés depuis le schéma Supabase US (voir eklio-backend)
proxy.ts              ex-"middleware" (renommé en Next.js 16) : session + garde /app
DELIVERY.md           écarts au contrat visuel, demandes de schéma, décisions
```

## Typographies

Trois familles, chargées par `next/font/google` (`lib/fonts.ts`), donc
auto-hébergées — zéro requête vers Google au runtime :

- **Fraunces** — titres, questions du brief, wordmark.
- **Karla** — corps de texte et interface.
- **IBM Plex Mono** — bandeaux, hex, prix, libellés d'état, barre d'URL.

Les polices de MARQUE (celles des paires du catalogue) sont chargées
DYNAMIQUEMENT depuis Google au changement de modèle : elles ne sont pas
connues au build. Les `preconnect` du layout racine existent pour elles.

## Commandes

```bash
npm run dev      # serveur de dev
npm run build    # build de production
npm run start    # sert le build de production
npm run lint     # ESLint
npm run test     # Vitest (modules purs, gardes, contraintes de rendu, contraste)
```

## Déploiement Vercel

1. Connecter le repo `eklio-frontend` depuis le dashboard Vercel (New Project → Import Git Repository).
2. Framework Preset : Next.js (détecté automatiquement).
3. Renseigner les variables d'environnement ci-dessus dans Project Settings →
   Environment Variables, pour les environnements **Production** et
   **Preview** (utiliser un projet Supabase séparé pour Preview si vous
   voulez isoler les données de test — sinon un seul projet suffit pour
   démarrer).
4. Déployer. Le build (`next build`) est vérifié en local avant chaque push
   sur `claude/eklio-bootstrap-ukuxfu`.

## Ce qui reste ouvert

Voir `DELIVERY.md` pour le détail — écarts au contrat visuel, demandes au
dépôt de schéma, décisions structurantes. En résumé :

- **Le contraste du chrome ne passe pas AA sur trois paires**, avec les
  valeurs des références. Décision à prendre par un humain.
- **Quatre manques de schéma** contournés ici : `practice_stages`, un état de
  génération de premier ordre, `email_log`, et `projects.current_step` qui
  peut désormais être supprimée.
- **La comparaison visuelle côte à côte** n'a pas pu être faite : aucun
  navigateur n'est installé dans l'environnement de développement. Chaque
  écran a été construit en lisant le balisage de sa référence.
- **Page publique partageable d'un kit** (`share_slug` déjà en base, policy
  RLS publique à ajouter le moment venu).
