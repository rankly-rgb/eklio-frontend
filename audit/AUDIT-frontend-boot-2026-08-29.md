# Audit — `npm run dev` ne démarre plus (frontend Eklio)

- Date : 2026-08-29
- Dépôt : `rankly-rgb/eklio-frontend`
- Branche auditée : `claude/eklio-design-system-flow-zmf8rl` @ `db8c43b`
- Journaux : [`audit/logs/`](logs/)
- Passe **lecture seule**. Aucun correctif appliqué, aucune dépendance touchée, aucun fichier de configuration ni d'environnement modifié.

---

## 0. Trois faits de l'énoncé contredits par le dépôt

Signalés d'emblée, comme demandé, avant tout diagnostic.

### 0.1 — L'écran « SITE EDITOR » n'existe pas dans ce dépôt

L'énoncé attribue la panne à « the SITE EDITOR screen (new route for an editable site spec, live mockup, derived builder output) », dernier travail fusionné. Cet écran est introuvable.

```
$ grep -ril "site.editor\|site_spec\|siteSpec\|site-editor" . --exclude-dir=node_modules --exclude-dir=.git
(aucune sortie)
```

Les cinq derniers commits (`audit/logs/20-site-editor-absence.log`) :

| Commit | Sujet | Date | Contenu |
|---|---|---|---|
| `db8c43b` | docs: variables d'e-mail et de cron dans le tableau du README | 2026-08-27 | `README.md` seul (+3) |
| `162910c` | docs: README aligné sur l'arborescence et les typographies réelles | 2026-08-27 | `README.md` seul |
| `fc8763d` | lot 10 — mobile, états vides et d'erreur, analytics, accessibilité | 2026-08-27 | 35 fichiers |
| `0f8a908` | lot 9 — run mensuel et e-mails transactionnels | 2026-08-27 | 11 fichiers |
| `23d5c10` | lot 8 — accueil, checklist, calendrier, fenêtre de déverrouillage | 2026-08-27 | 9 fichiers |

Aucune route nouvelle n'a atterri après le lot 10 ; les deux derniers commits ne touchent que `README.md`. **Les deux derniers commits ne peuvent pas casser un démarrage : ils ne contiennent que de la documentation.**

Le seul artefact voisin par le nom est [app/api/brand-kits/[id]/site-prompt/route.ts](app/api/brand-kits/%5Bid%5D/site-prompt/route.ts) et [lib/kit/site-prompt.ts](lib/kit/site-prompt.ts) — un *site prompt* (texte à coller dans un builder), pas un éditeur. Il est antérieur au lot 8.

### 0.2 — Il n'y a pas de répertoire `src/`

L'énoncé demande de balayer « `src/` ou `app/` ». Le code vit dans [app/](app/), [components/](components/), [lib/](lib/), [types/](types/). Le balayage a porté sur ces quatre répertoires plus `instrumentation.ts`, `proxy.ts`, `next.config.ts`, `vitest.config.mts` (`audit/logs/09-dependency-integrity.log`).

### 0.3 — Le vocabulaire de palette est déjà celui du schéma déployé

L'énoncé annonce que le frontend suppose `{primary, secondary, accent, light_neutral, dark_neutral}`. Il ne le suppose nulle part.

- [lib/brand/shapes.ts:21-36](lib/brand/shapes.ts#L21-L36) déclare exactement `["primary","secondary","light","dark","paper"]`, transcrit du CHECK `brand_kit_palette_valid`.
- `grep -rn "light_neutral\|dark_neutral"` → **aucune occurrence** (`audit/logs/13-site-editor-checks.log`).
- Les 60 occurrences d'`accent` sont toutes le *token produit d'Eklio* (`--accent`, l'argile) : [components/ui/button.tsx:13](components/ui/button.tsx#L13), [components/ui/mono-label.tsx:21](components/ui/mono-label.tsx#L21), etc. Aucune n'est un rôle de palette de marque générée.

Le reste de la section « Context » est **vérifié conforme** :

| Fait annoncé | Vérification |
|---|---|
| Next 16 / React 19 / Tailwind 4 / TS / Zod 4 / Vitest | `next@16.3.0`, `react@19.2.8`, `tailwindcss@4.3.3`, `typescript@5.9.3`, `zod@4.4.3`, `vitest@4.1.11` — `audit/logs/09` |
| Branche source de vérité | `git rev-parse --abbrev-ref HEAD` → `claude/eklio-design-system-flow-zmf8rl` ✅ |
| Branche gelée `c1dfe31` | existe, sujet « Bootstrap Eklio frontend… » — **jamais checkoutée** |
| Ref Supabase `fobgdsupyfslxbswfuay` | cité en commentaire [lib/brand/shapes.ts:6](lib/brand/shapes.ts#L6) |
| Addendum `ProjectStatus` | présent, [types/supabase.ts:1118](types/supabase.ts#L1118) |

---

## 1. Verdict

**L'application n'est pas cassée. `next dev` refuse de démarrer parce qu'un serveur de dev Next 16 est déjà vivant sur ce même répertoire (PID 7712, port 3000) et détient le verrou d'instance unique `.next/dev/lock` ; Next sort en code 1 plutôt que de démarrer un second.**

Le serveur déjà en place sert l'application correctement : `GET http://localhost:3000/` répond **200** avec le HTML complet de la page d'accueil (`audit/logs/02-dev-server-state.log`).

---

## 2. Preuves

### 2.1 La première erreur, verbatim

`audit/logs/01-npm-run-dev.log` — `npm run dev`, code de sortie **1** :

```
> eklio-frontend@0.1.0 dev
> next dev

 ⚠ Port 3000 is in use by an unknown process, using available port 3001 instead.
   ▲ Next.js 16.3.0 (Turbopack)
   - Local:         http://localhost:3001
   - Network:       http://10.0.10.53:3001
   - Environments: .env.local
 ✓ Ready in 349ms
 ✓ Running next.config.ts took 25ms
 ⨯ Another next dev server is already running.

- Local:        http://localhost:3000
- PID:          7712
- Dir:          /workspaces/eklio-frontend
- Log:          .next/dev/logs/next-development.log

You can access the existing server at http://localhost:3000,
or run kill 7712 to stop it and start a new one.
```

C'est la **première et la seule** erreur. Il n'y a pas de cascade : le processus sort immédiatement après.

Le piège est dans l'ordre d'affichage : Next imprime `✓ Ready in 349ms` sur le port 3001 **avant** de découvrir le verrou et de mourir. Une lecture rapide du terminal montre un « Ready » suivi d'un arrêt sans page servie.

### 2.2 Le verrou, sur disque

```
$ cat .next/dev/lock
{"pid":7712,"port":3000,"hostname":"localhost","appUrl":"http://localhost:3000","startedAt":1787996072024}
```
(`audit/logs/15-lock-contents.log`)

### 2.3 Le code qui refuse, ligne par ligne

`node_modules/next/dist/build/lockfile.js`, méthode `Lockfile.acquireWithRetriesOrExit` (`audit/logs/16-next-lockfile-source.log`) :

- ligne 169-173 : boucle de reprise pendant `MAX_RETRY_MS = 1000` ms (ligne 79) ;
- ligne 174 : si le verrou n'est toujours pas acquis…
- ligne 178-179 : relit `.next/dev/lock` et le parse ;
- ligne 181-195 : imprime exactement le bloc cité en 2.1, y compris `kill ${serverInfo.pid}` (ligne 194) ;
- **ligne 211 : `process.exit(1)`.**

### 2.4 Le processus détenteur

`audit/logs/02-dev-server-state.log` :

```
    PID    PPID     ELAPSED STAT   RSS COMMAND
   7712    7700       26:26 Sl   436360 next-server (v16.3.0)
   7700    7699       26:26 Sl    79144 node /workspaces/eklio-frontend/node_modules/.bin/next dev --hostname 0.0.0.0 --port 3000
   7699    7687       26:26 S      1992 sh -c next dev --hostname 0.0.0.0 --port 3000
   7687       1       26:26 Sl    70324 npm run dev --hostname 0.0.0.0 --port 3000

LISTEN 0  511  0.0.0.0:3000  0.0.0.0:*  users:(("next-server (v1",pid=7712,fd=22))
```

Démarré le **Sat Aug 29 09:34:30 2026** (`audit/logs/14-dev-lock.log`), soit ~26 min avant l'audit. Ce n'est pas un zombie : il est en état `Sl`, il écoute, et il répond.

### 2.5 Le serveur en place sert l'application

`audit/logs/03-route-probe.log` :

```
/            -> 200
/login       -> 200
/signup      -> 200
/pricing     -> 200
/app         -> 307   (redirection d'auth, attendue)
/dev/preview -> 200
/dev/ui      -> 200
/nope        -> 404   (not-found, attendu)
/api/catalog -> 401   (garde d'auth, attendue)
/api/home    -> 401   (garde d'auth, attendue)
```

### 2.6 Tout le reste de la chaîne est vert

| Commande | Code | Journal |
|---|---|---|
| `npm run build` | **0** — `✓ Compiled successfully in 14.5s`, 35 routes | `04-npm-run-build.log` |
| `npx tsc --noEmit` | **0** — sortie vide | `05-tsc-noemit.log` |
| `npm run lint` | **0** — sortie vide | `06-npm-run-lint.log` |
| `npm run test -- --run` | **0** — `Test Files 20 passed (20) / Tests 243 passed (243)` | `07-npm-test.log` |
| `npm ls --all` | 1 — voir §2.7 | `08-npm-ls-all.log` |

### 2.7 La seule erreur de `npm ls --all`, verbatim

```
npm error invalid: lightningcss-linux-x64-musl@1.32.0 /workspaces/eklio-frontend/node_modules/lightningcss-linux-x64-musl
```
(`audit/logs/08-npm-ls-all.log:1051`)

Binaire **musl** hissé à la racine alors que `node_modules/vite/node_modules/lightningcss` en veut la 1.33.0 ; c'est une dépendance *optionnelle* de la chaîne `vitest → vite`, sur une machine glibc. Sans effet : les 243 tests passent et le build réussit. Tout le reste des lignes du journal est `UNMET OPTIONAL DEPENDENCY` pour des binaires d'autres plateformes (darwin, win32, android…) — bruit normal d'un `npm ci` sur Linux x64.

---

## 3. Classification (Étape 2)

**Aucune des six familles proposées ne s'applique.** Les six décrivent un dépôt cassé ; ce dépôt compile, type-checke, linte, teste et sert. La famille réelle est une **septième : collision d'instance à l'exécution — un verrou d'instance unique détenu par un serveur de dev vivant.**

Ligne unique qui le prouve : `node_modules/next/dist/build/lockfile.js:211` — `process.exit(1)`, atteint depuis la branche « dev » ouverte ligne 176, alimentée par la lecture de `.next/dev/lock` (ligne 178), lequel désigne le PID 7712 qui écoute sur `0.0.0.0:3000` et répond 200.

Exclusion de chacune des six, avec sa preuve :

| Famille | Exclue par |
|---|---|
| (a) résolution / intégrité d'install | `npm ci` propre en worktree : `added 417 packages, found 0 vulnerabilities` (`18-worktree-head.log`). Seule anomalie : §2.7, sans effet. |
| (b) incompatibilité Node/npm | `node_modules/next/package.json` → `engines: {"node": ">=20.9.0"}` ; installé : **v24.18.1**. Conforme. npm 11.16.0. (`00`/`14`) |
| (c) parse de configuration | `✓ Running next.config.ts took 51ms` (`04`). `postcss.config.mjs` charge `@tailwindcss/postcss` ; [app/globals.css:1](app/globals.css#L1) = `@import "tailwindcss"` ; **zéro** occurrence de `@tailwind base;` ou d'un `tailwind.config.js` dans le dépôt (`10-config-audit.log`). |
| (d) résolution de module | `npx tsc --noEmit` code 0 ; alias `@/*` → `./*` résolu à la fois par [tsconfig.json](tsconfig.json) et par [vitest.config.mts:15-17](vitest.config.mts#L15-L17). |
| (e) erreur TypeScript / compilation | `tsc --noEmit` code 0, sortie vide. |
| (f) crash au boot | Aucune lecture d'env au niveau module (§5). Le serveur vivant répond 200 sur 7 routes. |

---

## 4. Hypothèses classées

### H1 — Un `next dev` déjà en cours détient `.next/dev/lock` — **confiance : haute (établie)**

- **Pour** : §2.1 à §2.5. Message verbatim, verrou sur disque nommant le PID 7712, processus vivant, port écouté, 200 servi, et la ligne de code qui provoque la sortie 1.
- **Ce qui la tuerait** : que le PID 7712 soit mort ou que le port 3000 ne réponde pas. `ps` et `ss` montrent l'inverse, et `curl` renvoie 200.
- **Expérience décisive** : même commit, checkout propre hors du dépôt, `npm ci` neuf, `next dev -p 3055` → le serveur **démarre et répond** (HTTP 500, faute de `.env.local` dans le worktree — les secrets n'y ont délibérément pas été copiés ; l'erreur vient de [proxy.ts:5](proxy.ts#L5) → [lib/supabase/middleware.ts:13](lib/supabase/middleware.ts#L13), pas du démarrage). Même code, autre répertoire donc autre verrou : **il démarre**. La différence n'est pas dans le code. Le journal `audit/logs/19-worktree-dev.log` mélange deux lancements successifs sur le port 3055 — le premier a servi, le second a trouvé le port pris (`EADDRINUSE`) ; l'en-tête du journal le précise.

### H2 — L'URL transférée du Codespace ne pointe pas sur le bon port — **confiance : moyenne, non prouvée**

- **Pour** : le verrou enregistre `"hostname":"localhost"` et `"appUrl":"http://localhost:3000"` alors que le serveur a été lancé avec `--hostname 0.0.0.0` et écoute bien sur `0.0.0.0:3000` (§2.4). La tentative refusée, elle, a annoncé `http://localhost:3001` avant de mourir — un port 3001 transféré par VS Code puis ouvert dans le navigateur ne mène nulle part.
- **Contre** : rien ici ne le confirme ; le transfert de ports d'un Codespace n'est pas observable depuis ce shell.
- **Ce qui la confirmerait ou la tuerait** : l'onglet PORTS de VS Code — quels ports sont transférés, avec quelle visibilité, et lequel le navigateur a ouvert. **Action humaine.**

### H3 — Variables d'environnement manquantes — **confiance : basse pour la panne, haute comme dette**

- **Pour la dette** : `.env.local` ne porte que 5 clés ; `.env.example` en déclare 15. Manquent par NOM : `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRACTICE`, `STRIPE_PRICE_SIGNATURE`, `STRIPE_PRICE_MONTHLY_PRESENCE`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`audit/logs/11-env-audit.log`).
- **Contre pour la panne** : aucune de ces lectures n'est au niveau module (§5), et le serveur vivant sert 200. Aucune ne peut empêcher un démarrage.
- **Ce qui la tuerait comme cause** : c'est déjà fait — le serveur démarre et sert avec l'`.env.local` actuel.

### H4 — Régression introduite par un commit récent — **confiance : nulle (réfutée)**

- **Contre** : `HEAD` construit depuis un checkout vierge (`18-worktree-head.log`), et les deux derniers commits ne touchent que `README.md` (§0.1).

### H5 — Intégrité de `node_modules` / dérive du lockfile — **confiance : nulle (réfutée)**

- **Contre** : `package.json` et `package-lock.json` n'ont pas été modifiés depuis `35d75de` (`git log --oneline -- package-lock.json`), soit 12 commits avant HEAD. `npm ls --package-lock-only --depth=0` et `npm ls --depth=0` listent les **mêmes 17 paquets aux mêmes versions** : zéro dérive. Une seule copie de React (`node_modules/react`, plus le `react` compilé interne de Next, normal) et une seule de Next (`audit/logs/09`).

### H6 — Dépendance non déclarée importée par du code récent — **confiance : nulle (réfutée)**

Balayage exhaustif des spécificateurs nus (`audit/logs/09-dependency-integrity.log`). Paquets externes importés, en tout et pour tout :

`@anthropic-ai/sdk`, `@supabase/ssr`, `@supabase/supabase-js`, `next`, `react`, `stripe`, `vitest`, `zod`, plus les intégrés `node:crypto`, `node:fs`, `node:path`, `node:url`.

**Les huit sont déclarés dans `package.json`.** Tout le reste est de l'alias interne `@/…`. Aucune librairie de couleur/OKLCH, aucune de drag-and-drop, aucune de PDF externe ([lib/kit/pdf.ts](lib/kit/pdf.ts) n'importe rien de tiers).

---

## 5. Audit d'environnement (noms seuls, aucune valeur)

Toutes les lectures de `process.env` du code applicatif, avec leur portée :

| Variable | Fichier:ligne | Portée | Dans `.env.local` ? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | [lib/supabase/middleware.ts:14](lib/supabase/middleware.ts#L14), [lib/supabase/server.ts:13](lib/supabase/server.ts#L13), [:42](lib/supabase/server.ts#L42), [lib/supabase/client.ts:10](lib/supabase/client.ts#L10) | dans une fonction | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | [lib/supabase/middleware.ts:15](lib/supabase/middleware.ts#L15), [lib/supabase/server.ts:14](lib/supabase/server.ts#L14), [lib/supabase/client.ts:11](lib/supabase/client.ts#L11) | dans une fonction | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | [lib/supabase/server.ts:43](lib/supabase/server.ts#L43), [lib/email/state.ts:137](lib/email/state.ts#L137) | dans une fonction | ✅ |
| `NEXT_PUBLIC_SITE_URL` | [lib/actions/auth.ts:66](lib/actions/auth.ts#L66), [lib/email/templates.ts:108](lib/email/templates.ts#L108), [lib/email/state.ts:156](lib/email/state.ts#L156), [lib/stripe/client.ts:75](lib/stripe/client.ts#L75) | dans une fonction, avec repli | ✅ |
| `CRON_SECRET` | [lib/api/cron.ts:15](lib/api/cron.ts#L15) | dans une fonction | ❌ manquante |
| `RESEND_API_KEY` | [lib/email/transport.ts:28](lib/email/transport.ts#L28) | dans une fonction | ❌ manquante |
| `EMAIL_FROM` | [lib/email/transport.ts:24](lib/email/transport.ts#L24) | dans une fonction, avec repli | ❌ manquante |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | [lib/stripe/client.ts:34](lib/stripe/client.ts#L34) via `requireEnv`, appelée depuis [:41](lib/stripe/client.ts#L41), [:48](lib/stripe/client.ts#L48), [:59](lib/stripe/client.ts#L59) | dans une fonction, paresseuse | ❌ manquantes |
| `ANTHROPIC_API_KEY` | jamais lue explicitement ; le SDK la lit lui-même, instancié paresseusement [lib/ai/client.ts:14-18](lib/ai/client.ts#L14-L18) | dans une fonction | ✅ |
| `NEXT_RUNTIME` | [instrumentation.ts:10](instrumentation.ts#L10) | dans `register()` | fournie par Next |

**Aucune lecture au niveau module. Aucune variable serveur atteignable depuis un fichier `"use client"`** : les 33 fichiers `"use client"` (`audit/logs/11`) n'importent ni `lib/ai/client`, ni `lib/stripe/client`, ni `lib/supabase/server`. Le scénario de la famille (f) est structurellement empêché — c'est délibéré et documenté dans les commentaires de [lib/stripe/client.ts:5-19](lib/stripe/client.ts#L5-L19) et [lib/ai/client.ts:3-11](lib/ai/client.ts#L3-L11).

Conséquences des clés absentes, en exploitation et non au démarrage :

- Cron : [lib/api/cron.ts:17-20](lib/api/cron.ts#L17-L20) renvoie **404 à tout appel** sans `CRON_SECRET`.
- E-mail : [lib/email/transport.ts:30-35](lib/email/transport.ts#L30-L35) **journalise sans envoyer**, et retourne `{ok:true, delivered:false}`.
- Stripe : [lib/stripe/client.ts:35](lib/stripe/client.ts#L35) lève `StripeConfigError` **au premier appel** — checkout et webhook.

Effet de bord observé en chambre blanche : sans les deux `NEXT_PUBLIC_SUPABASE_*`, [proxy.ts:5](proxy.ts#L5) → [lib/supabase/middleware.ts:13](lib/supabase/middleware.ts#L13) lève sur **chaque** requête et toute route rend 500 (`audit/logs/19-worktree-dev.log`). Ces deux clés sont présentes dans le `.env.local` de ce poste ; la remarque vaut pour tout autre environnement.

---

## 6. Audit de configuration (Étape 4)

| Point | Constat |
|---|---|
| `next.config.ts` | Une seule clé : `experimental.serverActions.allowedOrigins`. Forme **identique** à celle documentée par Next 16 lui-même (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md:16-25` — `experimental` y est toujours le niveau attendu). Aucun avertissement de clé inconnue au build ; seulement la bannière `- Experiments (use with caution): · serverActions`. |
| `tsconfig.json` | `moduleResolution: "bundler"`, `paths: {"@/*": ["./*"]}`. Tous les alias résolvent (`tsc` code 0). `include` couvre `.next/types` et `.next/dev/types`. |
| Tailwind 4 | Entrée CSS-first : [app/globals.css:1](app/globals.css#L1) `@import "tailwindcss"`. Plugin PostCSS : [postcss.config.mjs](postcss.config.mjs) → `@tailwindcss/postcss`. **Aucun** `@tailwind base;`, **aucun** `tailwind.config.*` dans le dépôt. |
| `app/` + `pages/` | Pas de `pages/`. Un seul App Router. |
| `middleware.ts` | **Absent, et c'est correct** en Next 16 : le fichier s'appelle [proxy.ts](proxy.ts) et exporte `proxy()`. Le build le confirme : `ƒ Proxy (Middleware)`. |
| Layouts | Deux, hiérarchiques et légitimes : [app/layout.tsx](app/layout.tsx) (racine) et [app/app/layout.tsx](app/app/layout.tsx) (segment applicatif). Aucun segment dupliqué. |
| `instrumentation.ts` | `register()` force `ipv4first` sous `NEXT_RUNTIME === "nodejs"` — parade Codespaces documentée sur place. |

---

## 7. Le premier commit fautif

**Il n'y en a pas.**

Bisect **exécuté**, pas statique, mais réduit à un seul point parce que ce point est vert :

```
$ git worktree add /tmp/eklio-audit-db8c43b db8c43b
$ cd /tmp/eklio-audit-db8c43b && npm ci
added 417 packages, and audited 418 packages in 18s
found 0 vulnerabilities
$ npm run build
… 35 routes … BUILD_EXIT=0
```
(`audit/logs/18-worktree-head.log`)

`HEAD` construit depuis un checkout vierge, avec un `node_modules` neuf, hors du dépôt. Il n'existe pas d'état « mauvais » à encadrer : le dernier bon commit **est** `db8c43b`, le HEAD lui-même. Chercher un premier commit fautif reviendrait à en inventer un.

Le worktree a été retiré et `git worktree list` ne montre plus que le dépôt principal.

---

## 8. Rayon d'impact

| Surface | État |
|---|---|
| Serveur de dev en place (PID 7712, :3000) | **fonctionnel** — 200 sur `/`, `/login`, `/signup`, `/pricing`, `/dev/preview`, `/dev/ui` ; 307 et 401 attendus sur les surfaces gardées |
| Un **second** `next dev` sur ce répertoire | **refusé**, code 1 — le seul symptôme réel |
| `npm run build` | vert |
| Types (`tsc --noEmit`) | vert |
| Lint | vert |
| Tests (20 fichiers, 243 cas) | verts |
| Production / Vercel | non affectée : `next build` ne prend pas ce verrou de dev |

Rien n'est masqué par cette panne : elle intervient **avant** tout travail, et n'altère aucun artefact.

Deux dettes distinctes, déjà présentes avant l'incident et sans rapport avec lui : les 10 clés d'environnement absentes (§5) et le binaire `lightningcss-linux-x64-musl` invalide (§2.7).

---

## 9. Correctif minimal par hypothèse — **décrit, non appliqué**

### H1 — diff nul

Deux voies, aucune ne touche un fichier :

1. **Utiliser le serveur qui tourne déjà** : ouvrir `http://localhost:3000`. Rien à faire.
2. **Le remplacer** : `kill 7712`, puis `npm run dev`. Next libère le verrou à la sortie (`lockfile.js:131-140`, écouteur `process.on('exit')`).

Aucune modification de `package.json`, de configuration ou de code n'est justifiée. En particulier : **ne pas** supprimer `.next/dev/lock` à la main pendant que 7712 vit — le verrou est un verrou de fichier natif, pas seulement ce JSON, et le supprimer laisserait deux serveurs se disputer le même `distDir`.

### H2 — aucun diff dans le dépôt

Vérifier l'onglet PORTS de VS Code, ne garder que le port 3000 transféré, ouvrir *son* URL. Le port 3001 éventuellement transféré par la tentative avortée est à retirer.

### H3 — hors dépôt, à la main

Ajouter dans `.env.local` les noms manquants listés en §5, en reprenant le gabarit de [.env.example](.env.example). Les valeurs ne relèvent pas de ce dépôt. Plus petit diff possible : les seules clés dont une surface est réellement exercée en dev.

### §2.7 — diff nul recommandé

Ne rien faire. Le paquet est optionnel, d'une autre libc, et sans effet mesurable. Toute réinstallation serait un coût sans contrepartie, et hors périmètre de cette passe.

---

## 10. Actions humaines vs actions Claude Code

### Humain — nécessitent un terminal interactif, un navigateur, un tableau de bord ou un secret

1. Décider du sort du serveur PID 7712 : le garder, ou `kill 7712`. **La décision, pas l'exécution** : un `kill` détruit l'état d'un processus lancé par quelqu'un d'autre.
2. Ouvrir l'onglet PORTS de VS Code, constater quels ports sont transférés et avec quelle visibilité, et ouvrir l'URL du port 3000 (H2).
3. Renseigner les clés manquantes de `.env.local` (§5) — valeurs détenues par Resend, Stripe et le générateur de `CRON_SECRET`.
4. Récupérer les ids de prix Stripe (`STRIPE_PRICE_*`) dans le tableau de bord Stripe, en mode cohérent avec la clé secrète employée.
5. Trancher la contradiction du §0.1 : où se trouve réellement le travail « SITE EDITOR ». Il n'est ni sur cette branche, ni dans son historique. Candidats à examiner : `origin/claude/eklio-fr-us-migration-53dnk1` (branche distante présente, non auditée ici), une PR non fusionnée, ou un autre dépôt.

### Claude Code — faisables sans dashboard ni credential, sur demande explicite

1. Relire, sur la branche que l'humain désignera au point 5, le travail « SITE EDITOR », et refaire cette passe s'il existe ailleurs.
2. Documenter dans le README la collision de verrou de Next 16 et le geste `kill <pid>` — c'est la panne qui reviendra.
3. Aligner `.env.example` et le tableau du README sur les 10 clés réellement lues (§5), si un écart de documentation est constaté.
4. Rien d'autre. Le dépôt n'a aucun correctif à recevoir pour ce symptôme.

---

## 11. Non expliqué

Section tenue honnête ; tout ce qui suit a été observé sans être élucidé.

1. **« The developer cannot reach the app in the browser at all »** — non expliqué. Depuis ce shell, `http://localhost:3000/` renvoie 200 avec le HTML complet. L'état du transfert de ports du Codespace n'est pas observable ici : ni l'onglet PORTS, ni la visibilité des ports, ni l'URL réellement ouverte par le navigateur. H2 est une piste, pas une conclusion.

2. **Qui a lancé le PID 7712, et pourquoi** — non expliqué. Démarré le 2026-08-29 à 09:34:30 avec `npm run dev --hostname 0.0.0.0 --port 3000`, parent `PPID 1`, hors de cette session d'audit. Le journal `.next/dev/logs/next-development.log` ne contient que trois lignes de bannière et aucune erreur.

3. **Le verrou enregistre `"hostname":"localhost"`** alors que le serveur a été lancé avec `--hostname 0.0.0.0` et écoute bien sur `0.0.0.0:3000`. Si cet `appUrl` sert d'indice au transfert de ports du Codespace, l'effet n'a pas pu être établi ici.

4. **Pourquoi l'énoncé décrit un écran « SITE EDITOR » absent de ce dépôt** — non expliqué (§0.1). Aucun commit, aucun fichier, aucune ligne de documentation ne s'y rapporte. La branche distante `origin/claude/eklio-fr-us-migration-53dnk1` n'a pas été examinée : elle sort du périmètre déclaré de cette passe.

5. **Pourquoi `npm run dev --hostname 0.0.0.0 --port 3000` a transmis ses drapeaux à `next`** alors que `package.json` ne définit que `"dev": "next dev"` et qu'aucun `--` ne sépare les arguments. Le `sh -c` du processus 7699 montre pourtant `next dev --hostname 0.0.0.0 --port 3000`. Comportement de npm 11.16.0 non vérifié ici ; sans incidence sur la panne.

6. **Pourquoi le port 3000 était décrit comme « in use by an unknown process »** par la tentative refusée, alors qu'il est tenu par un `next-server` du même répertoire. Détail d'affichage de Next ; non creusé.
