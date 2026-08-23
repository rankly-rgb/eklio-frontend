# Notes — lot 1 : design system fond blanc + guided flow persistant

## Schéma de base de données — à lire avant toute chose

Le schéma **ne vit plus dans ce repo**. Il est porté par
[`eklio-backend`](../eklio-backend), source de vérité unique, et appliqué sur
la base de production **US** `eklio-backend-us` (ref `fobgdsupyfslxbswfuay`,
`us-east-1`), déjà à jour.

**Ne jamais appliquer de migration depuis le front** — pas de `supabase db
push` ici, pas de dossier `supabase/migrations/`. C'est exactement ce qui a
produit les dérives de schéma décrites plus bas. Toute évolution du schéma
passe par une migration dans `eklio-backend`, puis par une régénération de
`types/supabase.ts` de ce côté-ci.

L'ancienne base EU est conservée intacte comme filet de sécurité, mais n'est
plus la cible : ne rien y écrire.

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
- **Types Supabase** : `types/supabase.ts` est désormais **généré** depuis le
  projet US `eklio-backend-us` (ref `fobgdsupyfslxbswfuay`, `us-east-1`) et
  couvre les 6 tables réelles (`projects`, `project_briefs`, `directions`,
  `profiles`, `brand_kits`, `generation_credits`). Pour le régénérer :
  `supabase gen types typescript --project-id fobgdsupyfslxbswfuay >
  types/supabase.ts`, puis **réappliquer l'addendum manuel** en fin de
  fichier (l'union `ProjectStatus` : `projects.status` est un `text` contraint
  par CHECK, pas un enum Postgres, donc rendu en `string` par le générateur).
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
- Le parcours complet (création → 7 étapes → fermeture → reprise) et le test
  des politiques RLS depuis le navigateur n'ont pas été exécutés en conditions
  réelles dans cet environnement ; le rendu et la navigation ont été vérifiés
  visuellement (375, 768, 1024-1280, 1440 px) sur des écrans alimentés en
  mémoire. À rejouer contre la base US une fois `.env.local` renseigné.
- Vercel : renseigner `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (serveur
  uniquement) — voir `.env.example`.

## Lot 2 : génération des 3 directions créatives

- **Schéma** : table `directions` (1 ligne par direction, 1 à 3 par projet),
  RLS via appartenance du projet, trigger `set_updated_at`. Elle est déjà en
  place sur la base US — le DDL vit dans `eklio-backend`, plus dans ce repo
  (voir « Schéma de base de données » en haut de ce fichier).
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
- **Dérive de schéma (3ᵉ occurrence)** : une table `directions` héritée d'une
  session de bootstrap antérieure sans lien avec Eklio existait déjà dans le
  projet Supabase réel, avec un schéma différent (`summary`, `typography`,
  `tone_descriptors`, `status` au lieu de `description`,
  `typographie_titre`, `typographie_corps`). Elle a fait échouer silencieusement
  le `create table` de la migration initiale (« already exists »), causant
  l'erreur `PGRST204: Could not find the 'description' column`. Corrigé à
  l'époque par une migration correctrice côté front (table héritée vide,
  0 ligne — aucune perte de donnée), puis définitivement par le passage du
  schéma dans `eklio-backend` : la base US est repartie propre, et le front
  n'applique plus rien. C'est la raison d'être de la règle en tête de fichier.

## Reste pour le lot 3

- Kit de marque complet, prompt multi-constructeurs, export PDF, Stripe,
  page marketing, statut `kit`.
- Régénérer `types/supabase.ts` depuis le projet US après toute évolution du
  schéma dans `eklio-backend` (`supabase gen types typescript --project-id
  fobgdsupyfslxbswfuay`), sans oublier de réappliquer l'addendum manuel.
- Sur Vercel, le temps de génération (jusqu'à ~1 minute annoncé à
  l'utilisateur) peut dépasser le timeout par défaut des fonctions
  serverless sur le plan gratuit (10 s) — vérifier le plan et, si besoin,
  augmenter `maxDuration` sur la route ou passer par une génération
  asynchrone dans un lot ultérieur.
