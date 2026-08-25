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
- Anthropic (Claude) — appels serveur uniquement (directions, kit de marque,
  Monthly Presence). Les générations longues passent obligatoirement par
  `messages.stream()` : le SDK refuse tout appel non streamé au-delà d'environ
  21 300 jetons de sortie, et lève **côté client**, avant la moindre requête.
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
app/                 routes (App Router) : pages, layouts, route handlers
  login/, signup/    auth email/mot de passe
  pricing/           tarifs publics (anglais) — 3 tiers + add-on + FAQ
  app/               espace connecté, protégé par proxy.ts
    checkout/        choix du tier, add-on, retours succès / annulation
    projets/[id]/    brief → directions → kit → presence
  api/stripe/        route handler du webhook Stripe (signature + idempotence)
  auth/callback/     échange du code de confirmation email contre une session
components/          composants UI partagés (billing/, kit/, presence/, ui/…)
lib/
  supabase/          clients Supabase (browser, server, admin, proxy)
  actions/           server actions (auth, etc.)
  fonts.ts           chargement des 3 typographies (voir note Recoleta ci-dessous)
  ai/                appels Claude : directions, kit, monthly-presence
  ethics/            socle déontologique + garde de régénération (modules purs)
  billing/           catalogue (prix, tiers) et droits lus en base
  stripe/            client, checkout, métadonnées, traitement des events
  kit/, brief/, presence/, projects/   modules purs (formes, périmètres, mois)
types/supabase.ts    types générés depuis le schéma Supabase US (voir eklio-backend)
proxy.ts             ex-"middleware" (renommé en Next.js 16) : refresh de session + garde /app
```

## Typographies

- **Inter** (corps) et **IBM Plex Mono** (interface/labels) : chargées via
  `next/font/google`, rien à faire.
- **Recoleta Bold** (titres) est une police commerciale non disponible sur
  Google Fonts. En attendant l'achat de la licence, `lib/fonts.ts` utilise
  **Fraunces** comme placeholder visuel sur le rôle `--font-display`. Les
  instructions pour brancher les vrais fichiers `.woff2` via
  `next/font/local` sont commentées directement dans `lib/fonts.ts`.

## Commandes

```bash
npm run dev      # serveur de dev
npm run build    # build de production
npm run start    # sert le build de production
npm run lint     # ESLint
npm run test     # Vitest (modules purs, gardes de génération, webhook)
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

## Ce qui n'est PAS encore implémenté (stubs volontaires)

- Génération IA réelle (guided flow, 3 directions, kit de marque) — `lib/ai/`
  et `app/app/page.tsx` contiennent des TODO explicites.
- Stripe (paiement, webhooks).
- Export PDF du kit de marque.
- Génération du prompt multi-constructeurs (Lovable/Framer/Webflow).
- Page publique partageable d'un kit de marque (`share_slug` déjà en base,
  policy RLS publique à ajouter le moment venu).
