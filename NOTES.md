# Notes — lot 1 : design system fond blanc + guided flow persistant

## Décisions prises

- **Recoleta Bold** : la police est commerciale et le fichier
  `public/fonts/Recoleta-Bold.woff2` n'est pas dans le repo. Elle est déclarée
  en `@font-face` dans `app/globals.css` (et non via `next/font/local`, qui
  fait échouer le build si le fichier est absent). Repli configuré :
  `Georgia, 'Times New Roman', serif`. Dès que le fichier licencié est
  obtenu, le déposer tel quel en `public/fonts/Recoleta-Bold.woff2` — aucune
  modification de code nécessaire. Pour bénéficier de l'auto-hébergement
  optimisé de `next/font/local`, on pourra alors migrer `lib/fonts.ts`.
- **Tailwind v4** : le projet utilise la configuration CSS-first de Tailwind 4
  (`@theme inline` dans `globals.css`). Il n'y a volontairement pas de
  `tailwind.config.ts` : c'est la convention de cette version, les tokens y
  sont exposés depuis les variables CSS.
- **Types Supabase** : aucun projet Supabase Eklio n'était accessible depuis
  cet environnement (le MCP Supabase ne liste qu'un projet d'un autre
  produit, auquel je n'ai pas touché). La migration n'a donc **pas été
  appliquée sur une base distante** ; `types/supabase.ts` est écrit à la main
  au format `supabase gen types typescript` et devra être régénéré une fois
  la base branchée (`supabase gen types typescript --project-id … >
  types/supabase.ts`).
- **Pastilles de couleurs (étape 5) et polices d'aperçu (étape 6)** : les
  valeurs hex des familles chromatiques et les piles de polices des styles
  typographiques vivent dans `lib/brief/steps.ts`. Ce sont des **données de
  contenu du brief** (aperçus montrés à l'utilisateur), pas des couleurs
  d'interface — l'interface elle-même ne consomme que les tokens.
- **Sauvegarde** : deux modes dans `saveBriefStep` — brouillon (au blur et
  aux clics de choix, validation assouplie `briefDraftSchema`) et complet
  (bouton « Continuer », validation stricte du schéma d'étape). Les deux
  passent côté serveur ; rien ne transite par le localStorage.
- **Annonce d'étape aux lecteurs d'écran** : assurée par le route announcer
  intégré de l'App Router (chaque étape est une navigation avec un nouveau
  `h1`), sans focus programmatique qui laisserait un anneau visible.
- **« Mélange serif + sans »** (étape 6) : rendu en serif italique faute de
  pouvoir mélanger deux polices dans un seul libellé proprement ; à raffiner
  si besoin.

## Ce qui manque / n'a pas pu être vérifié ici

- `public/fonts/Recoleta-Bold.woff2` (licence à acheter). Les titres
  s'affichent en Georgia en attendant.
- La migration `supabase/migrations/20260809000000_init_projects.sql` doit
  être appliquée sur le projet Supabase Eklio (CLI : `supabase db push`, ou
  dashboard). Sans base distante accessible, le parcours complet
  (création → 7 étapes → fermeture → reprise) et le test des politiques RLS
  depuis le navigateur n'ont pas pu être exécutés en conditions réelles dans
  cet environnement ; le rendu et la navigation ont été vérifiés visuellement
  (375, 768, 1024-1280, 1440 px) sur des écrans alimentés en mémoire.
- Vercel : renseigner `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (serveur
  uniquement) — voir `.env.example`.

## Lot 2 : génération des 3 directions créatives

- **Migration** `supabase/migrations/20260815090000_init_directions.sql` :
  table `directions` (1 ligne par direction, 1 à 3 par projet), RLS via
  appartenance du projet, trigger `set_updated_at`. À appliquer sur la base
  distante (dashboard ou `supabase db push`) avant de tester — voir la
  section « Ce qui manque » du lot 1 pour la marche à suivre.
- **Génération** : `lib/ai/directions.ts` construit un prompt en français à
  partir du brief puis appelle `claude-opus-5` avec un unique outil forcé
  (`tool_choice`, schéma strict) pour obtenir une réponse JSON garantie —
  pas de parsing de texte libre. La réponse repasse par zod avant d'entrer
  en base (défense en profondeur, comme pour le brief).
- **Sauvegarde** : `generateDirections` (server action) supprime les
  directions existantes puis insère les 3 nouvelles en une fois ; le projet
  passe en `status = 'directions'`. Pas de limite de régénération pour
  l'instant — prévu pour être gaté par Stripe plus tard.
- **Polices choisies par le modèle** : affichées en texte simple (nom de la
  police), sans tentative de chargement dynamique — `next/font/google`
  exige un nom statique connu à la compilation, incompatible avec un choix
  fait à l'exécution par l'IA.
- **Non testé de bout en bout ici** : aucune clé `ANTHROPIC_API_KEY` n'était
  disponible dans cet environnement pour un appel réel. Le code compile
  (lint + tsc + build verts) mais le premier appel réel doit être vérifié
  par vous une fois la clé renseignée dans `.env.local` (et sur Vercel).

## Reste pour le lot 3

- Kit de marque complet, prompt multi-constructeurs, export PDF, Stripe,
  page marketing, statut `kit`.
- Régénérer `types/supabase.ts` depuis la base réelle une fois les deux
  migrations appliquées (`supabase gen types typescript`).
- Sur Vercel, le temps de génération (jusqu'à ~1 minute annoncé à
  l'utilisateur) peut dépasser le timeout par défaut des fonctions
  serverless sur le plan gratuit (10 s) — vérifier le plan et, si besoin,
  augmenter `maxDuration` sur la route ou passer par une génération
  asynchrone dans un lot ultérieur.
