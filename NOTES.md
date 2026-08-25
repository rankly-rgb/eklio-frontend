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

## Lot 3 : kit de marque (génération + page de kit)

- **Schéma** : `brand_kits` était **déjà en place et suffisante** sur la base US
  — aucune migration n'a été appliquée par le prompt backend du Lot 3, et
  `types/supabase.ts` était donc déjà à jour (vérifié par régénération et
  comparaison le 2026-08-25, addendum `ProjectStatus` inchangé).
- **Pas de colonne `tier`** : `brand_kits` porte `id`, `project_id` (unique),
  `direction_id`, `content` (jsonb), `multi_builder_prompt`, `pdf_url`,
  `share_slug` (unique), `created_at`, `updated_at` — et rien d'autre. Le tier
  qui a produit le kit est donc rangé **dans `content`**, faute de colonne. Si
  le Lot 4 doit requêter le tier (facturation, statistiques), c'est une
  migration à faire dans `eklio-backend` — pas ici.
- **Découpage de la persistance** : le prompt multi-plateformes va dans la
  colonne `multi_builder_prompt` (colonne de premier ordre déjà prévue au
  schéma), le reste du livrable dans `content`. Il n'existe qu'à un seul
  endroit. `project_id` étant unique, une régénération **remplace** le kit
  (upsert `onConflict: project_id`) : un projet porte un kit et un seul, pas
  d'historique.
- **Génération** : `lib/ai/kit.ts`, même mécanique que les directions — SDK
  serveur-only, outil unique forcé, schéma strict, validation zod — enveloppée
  par `generateWithEthicsGuard`. Trois gardes cumulées : structurelle, de
  périmètre (`applyScope` : une page demandée manquante = `KitScopeError`,
  aucune écriture), et déontologique.
- **Mapping brief → prompt mutualisé** : extrait dans `lib/ai/brief-context.ts`
  et utilisé par les directions comme par le kit. Deux copies auraient dérivé à
  la première question ajoutée au brief.
- **Contre-exemples du guide de voix (`dont_examples`)** : seules chaînes du kit
  **exclues** du contrôle déontologique, délibérément. Ce sont des
  contre-exemples affichés sous « never write this », jamais de la copy à
  publier ; les vérifier reviendrait à demander au modèle d'illustrer une faute
  sans jamais l'écrire, et la génération échouerait sur sa propre pédagogie. Le
  prompt leur demande de **nommer** la faute plutôt que de la démontrer. Un test
  fige ce contrat.
- **Seam de gating par tier** : `lib/kit/tiers.ts` (module pur). Starter = 3
  pages, pas de specs sociales ; Practice = 6 pages + specs ; Signature = tout.
  Le tier est aujourd'hui constant (`DEFAULT_KIT_TIER = "signature"`, le plus
  généreux tant que le paiement n'existe pas). Au Lot 4, il n'y a **qu'une
  ligne à changer** dans `app/app/projets/[id]/kit/actions.ts` : lire le tier
  acheté au lieu de la constante.
- **Polices** : toujours affichées en texte, jamais chargées à l'exécution —
  `next/font` exige un nom connu à la compilation et le modèle choisit le sien
  à la génération. La page de kit le dit à l'utilisateur.
- **Partage — limite connue** : `share_slug` est fabriqué et conservé (stable
  d'une régénération à l'autre), mais la RLS de `brand_kits` est **owner-only**
  (policy `brand_kits_all_own`). Aucune lecture anonyme par slug n'est possible
  aujourd'hui : construire une route publique `/kit/[slug]` donnerait un 404
  pour tout le monde sauf le propriétaire. Ouvrir un vrai partage public est une
  **décision de schéma à prendre dans `eklio-backend`** (policy de lecture
  anonyme par slug, ou vue publique) — le front ne la prend pas.
- **Non testé de bout en bout ici** : toujours aucune `ANTHROPIC_API_KEY` dans
  cet environnement. Le premier appel réel reste à vérifier une fois la clé
  renseignée.
- **Durée de génération** : le kit est nettement plus long que les directions
  (jusqu'à 8 pages de copy, les specs sociales et le prompt en une réponse). Le
  point de vigilance `maxDuration` noté au Lot 2 vaut a fortiori ici.

## Correctif — bouton de génération inatteignable (post-Lot 3)

Symptôme : brief rempli, aucun bouton pour générer les 3 directions.

**Cause racine** : la complétude du brief était déduite de la NAVIGATION
(`project_briefs.completed_steps`, `projects.current_step`) et non des
RÉPONSES. `completed_steps` n'enregistre que les clics sur « Continue » ;
l'autosave écrit sans y toucher. Les deux dérivent — et ce même signal gâtait
les trois chemins vers la génération :

1. le lien « Review your brief » du rail (`maxStep >= 8`) ;
2. le statut `brief_complete`, donc la reprise depuis le tableau de bord ;
3. le bouton de génération sur le récapitulatif lui-même.

Les trois étant en aval du même événement (une étape 7 validée), un praticien
bloqué sur un champ requis n'avait **aucun** moyen d'atteindre l'écran qui lui
aurait dit ce qui manquait. Le récapitulatif était scellé derrière l'événement
qu'il sert à débloquer.

**Correctif** : `lib/brief/completeness.ts` (module pur) calcule la complétude
depuis les données, avec les mêmes `stepSchemas` que le bouton « Continue »,
sur le brouillon normalisé (clés anglaises du Lot 2, anciennes clés françaises
traduites). Utilisé par le récapitulatif, par le badge « to complete » de
chaque section et par la bascule de statut dans `saveBriefStep`. Le lien vers
le récapitulatif est désormais **toujours** affiché, et l'écran de blocage
**nomme** les étapes à finir avec un lien vers chacune, au lieu d'un
« Complete all 7 steps » muet.

`completed_steps` reste écrit et sert toujours de trace de navigation ; il
n'est simplement plus l'oracle de la complétude.

## Correctif (2ᵉ passe) — le clic « Review your brief » paraissait inerte

Le correctif précédent (complétude sur les données) était juste mais
incomplet : il n'a pas débloqué le cas réel. Audit empirique repris de zéro.

**Ce qui a été écarté par la preuve** : le champ requis `primary_action` **se
rend bien** à l'étape 7 (vérifié par rendu SSR réel, cf.
`components/brief/__tests__/step-form-fields.test.ts`). Aucune divergence
clé écrite / clé lue : les données en base portent bien les clés anglaises du
Lot 2, et `missingBriefSteps()` rend exactement `[7]` sur ce brief. Aucune
source de complétude concurrente ne subsiste.

**Cause 1 — pas de retour au point d'action.** Quand la validation d'une étape
échouait, le seul signal était un message SOUS le champ fautif. Sur l'étape 7,
`primary_action` est le 2ᵉ de cinq champs et le bouton est tout en bas, après
deux groupes de cases (8 + 5 options) : le message s'affichait plusieurs
centaines de pixels au-dessus de l'écran. Le praticien cliquait, ne voyait
rien bouger, et en concluait que le champ n'existait pas. `globalError` — le
seul encart placé près du bouton — n'était alimenté que par les erreurs de
sauvegarde, jamais par un échec de validation.

**Cause 2 — la sortie de secours n'existait pas sous 1024px.** Le lien
« Review your brief » ajouté à la passe précédente vit dans `StepRail`, dont
le conteneur est `hidden lg:block`. Sur écran étroit, le récapitulatif restait
donc joignable uniquement par le bouton de l'étape 7, lui-même conditionné à
la validation qui échouait.

**Correctifs** : `lib/brief/step-errors.ts` (module pur) nomme les champs
manquants et désigne celui à focaliser ; `StepForm` affiche ce message à côté
du bouton et ramène le focus (+ `scrollIntoView`, `prefers-reduced-motion`
respecté) sur le premier champ fautif, à la validation client comme au refus
serveur. Le lien de récapitulatif est extrait dans
`components/brief/review-brief-link.tsx` et rendu aussi sous 1024px, à côté de
la barre de progression.

Cause 100 % frontend : aucune migration, aucune intervention backend.

## Reste pour le lot 4

- Pricing en dollars, Stripe, Monthly Presence.
- **Branchement réel du gating par tier** : lire le tier acheté et le passer à
  `resolveKitScope()` (voir seam ci-dessus).
- Partage public du kit, s'il est voulu : décision de schéma côté
  `eklio-backend` d'abord (cf. limite RLS ci-dessus).
- Export PDF (`brand_kits.pdf_url` existe et reste vide), page marketing.
- Régénérer `types/supabase.ts` depuis le projet US après toute évolution du
  schéma dans `eklio-backend` (`supabase gen types typescript --project-id
  fobgdsupyfslxbswfuay`), sans oublier de réappliquer l'addendum manuel.
