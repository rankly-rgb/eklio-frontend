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
- Anthropic (Claude) — génération des directions et Ethics Guard, serveur uniquement
- Stripe — checkout + webhook, montants lus dans la table `plans`
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
app/                 routes (App Router)
  login/, signup/    auth email/mot de passe
  app/               espace connecté, protégé par proxy.ts
    brief/           les sept étapes, autosave + preview en direct
    directions/      le reveal (gratuit) et le choix (payant)
    checkout/        les paliers, lus dans `plans`
    kit/             le livrable : couleurs, type, voix, prompt à copier
  api/stripe/webhook route handler Stripe (service_role)
components/          brief/, directions/, checkout/, kit/, ui/
lib/
  supabase/          clients Supabase (browser, server, admin, proxy)
  eklio/             enveloppe d'erreur, appels RPC, catalogues, plans
  ai/                génération des directions, Ethics Guard, bornes de rendu
  stripe/            client Stripe
  actions/           server actions (auth, brief, génération, checkout, kit)
types/supabase.ts    généré depuis la base (source : eklio-backend)
docs/CONTRACT_CHEATSHEET.md  le contrat back → front en une page
proxy.ts             ex-"middleware" : refresh de session + garde /app
```

## Typographies

- **Karla** (corps) et **IBM Plex Mono** (interface/labels) : chargées via
  `next/font/google`, rien à faire. Karla est la police de corps des huit
  maquettes validées ; le bootstrap avait posé Inter, qui n'apparaît dans
  aucune d'elles.
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

## Ce qui n'est PAS encore implémenté

Coupé de la V1 en connaissance de cause. Le schéma porte déjà tout, ces écrans
n'ont besoin d'aucune migration.

- **L'éditeur de spec de site** — `site_spec_patch`, `site_spec_reset`,
  `site_spec_fix_contrast` et la bannière de péremption. Le kit rend la sortie
  en lecture seule et sait déjà changer de constructeur.
- **Export PDF** du kit de marque.
- **Page publique partageable** — `share_slug` existe, mais aucune policy ne
  laisse un visiteur non authentifié lire un kit. L'arbitrage est ouvert côté
  backend : ouvrir `brand_kits` à `anon` exposerait un livrable payant à qui
  devine un slug.
- **Calendrier de contenu mensuel** et **checklist de lancement** — tables
  semées, écrans non construits.
- **E-mails transactionnels** au-delà de ceux de Supabase Auth.

## Ce qu'il reste à brancher avant d'encaisser

1. **Stripe** : coller `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET`. Aucun
   produit ni prix à créer — les montants viennent de `plans`. Pointer le
   webhook sur `/api/stripe/webhook` et lui abonner `checkout.session.completed`,
   `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed` et
   `payment_intent.payment_failed`.
2. **La migration de sécurité** du repo backend
   (`20260831090000_revoke_internal_function_surface.sql`) : `supabase db push`.
   Elle est écrite et testée, elle n'a **pas** été appliquée.
3. **Leaked password protection** dans Supabase Auth — une case à cocher.
4. **Licence Recoleta** — `lib/fonts.ts` sert Fraunces en attendant.
5. **Mentions légales, CGV, politique de confidentialité.** Rien de tout ça
   n'existe, et on ne peut pas encaisser sans.
