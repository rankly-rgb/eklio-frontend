# Eklio — frontend

Plateforme SaaS qui transforme un brief guidé en identité de marque complète
(stratégie, palette, typographies, direction artistique) + un prompt prêt à
coller dans Lovable/Framer/Webflow.

Ce repo porte le frontend Next.js **et** les route handlers / server actions
qui parlent à Supabase et à l'API Anthropic (Claude) — ces appels restent
strictement côté serveur.

Le schéma de base de données (migrations SQL, RLS) vit dans le repo
[`eklio-backend`](../eklio-backend), qui est la source de vérité du schéma.
Ce repo ne fait que consommer les types TypeScript générés depuis Supabase
(`types/database.ts`).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Postgres, Auth, RLS)
- Anthropic (Claude) — appels serveur uniquement, pas encore branchés (stub)
- Stripe — pas encore intégré (emplacement prévu dans le schéma et l'UI)
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

Les variables `NEXT_PUBLIC_*` sont exposées au bundle client : n'y mettre que
l'URL et la clé anon, jamais la service_role key ni la clé Anthropic.

## Structure

```
app/                 routes (App Router) : pages, layouts, route handlers
  login/, signup/    auth email/mot de passe
  app/               espace connecté (guided flow à venir), protégé par proxy.ts
  auth/callback/     échange du code de confirmation email contre une session
components/          composants UI partagés
lib/
  supabase/          clients Supabase (browser, server, admin, proxy)
  actions/           server actions (auth, etc.)
  fonts.ts           chargement des 3 typographies (voir note Recoleta ci-dessous)
  ai/                stub pour les futurs appels Claude (non implémenté)
types/database.ts    types générés depuis le schéma Supabase (à régénérer, voir eklio-backend)
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

## Brand shots (image generation CLI)

Self-contained CLI (`scripts/brand-shots/`) that calls OpenAI's Images API
(`gpt-image-1`) to generate photoreal brand-ambiance stills for the marketing
site and Instagram — stationery flat-lays, paper texture, warm light. Not for
UI mockups: no real UI, no long copy.

**Set the key.** Add to `.env.local` at the repo root (already gitignored,
never committed):

```
OPENAI_API_KEY=sk-...your key...
```

**Run a preset:**

```bash
npm run brand-shots -- --shot flatlay
npm run brand-shots -- --shot card-macro --count 2 --size 1024x1024
npm run brand-shots -- --shot desk --quality medium
npm run brand-shots -- --shot texture --quality low
npm run brand-shots -- --shot swatch
npm run brand-shots -- --prompt "your own art direction" --size 1024x1536
```

Presets: `flatlay`, `card-macro`, `desk`, `texture`, `swatch` — briefs live in
`scripts/brand-shots/presets.json` alongside the master art direction that's
prepended to every shot (editable without touching code). `--prompt "..."`
generates a free prompt instead of a preset (still gets the master art
direction prepended). Options: `--count` (1-4, default 1), `--size`
(`1536x1024` default, `1024x1024`, `1024x1536`), `--quality`
(`low`/`medium`/`high`, default `high`). Runs of more than 2 images print the
estimated cost and ask for confirmation (`--yes` skips the prompt).

**Output:** `brand-shots/<date>-<shot>-<n>.png` at the repo root (gitignored).

**Cost:** printed after every run — gpt-image-1 is priced per image by size
and quality (roughly $0.01–$0.02 low, $0.04–$0.06 medium, $0.17–$0.25 high);
the CLI's estimate is approximate and OpenAI's pricing can change.

## Ce qui n'est PAS encore implémenté (stubs volontaires)

- Génération IA réelle (guided flow, 3 directions, kit de marque) — `lib/ai/`
  et `app/app/page.tsx` contiennent des TODO explicites.
- Stripe (paiement, webhooks).
- Export PDF du kit de marque.
- Génération du prompt multi-constructeurs (Lovable/Framer/Webflow).
- Page publique partageable d'un kit de marque (`share_slug` déjà en base,
  policy RLS publique à ajouter le moment venu).
