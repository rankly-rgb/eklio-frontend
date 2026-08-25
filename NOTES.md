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

## Correctif — la génération du kit échouait en « Something went wrong »

Trois causes empilées, chacune reproduite contre l'API réelle, chacune masquée
par la suivante. La génération des directions marchait : même clé, même SDK,
même modèle — seul le kit tombait.

**1. Le SDK refusait l'appel avant même de partir.**
`messages.create()` non streamé lève côté CLIENT dès que `max_tokens` dépasse
environ 21 300 (`calculateNonstreamingTimeout` : `60 min × max_tokens / 128000
> 10 min`). Les directions (8 000) passent, le kit (32 000) non. Le garde
partait en **zéro seconde**, sans requête réseau, sans statut HTTP, sans rien
dans l'onglet Réseau — d'où une panne en apparence muette. Correctif :
`messages.stream(...).finalMessage()`, la réponse prévue par le SDK.
`NON_STREAMING_MAX_TOKENS` documente le seuil, et un test l'assert contre le
SDK réel.

**2. Une borne cosmétique jetait un kit entier.**
Le modèle a rendu 6 contre-exemples de voix pour un maximum annoncé de 5 :
`too_big` zod, **127 secondes de génération perdues**. L'API n'autorise pas
`minItems`/`maxItems` dans un schéma d'outil strict — « 3 à 5 exemples » n'est
qu'une consigne, jamais une garantie. Une borne serrée côté zod ne discipline
donc pas le modèle, elle détruit le livrable. Correctif : les listes
d'exemples sont **normalisées** (on garde les premières), la prose voit ses
bornes élargies (la tronquer au milieu d'une phrase serait pire).

**3. La déontologie punissait la conformité.**
Le prompt multi-plateformes disait au constructeur de site « No hype, no
urgency, **no testimonials**, no outcome claims (no "proven", no "results", no
"**lasting relief**") » — le modèle appliquant le socle à la lettre. Les motifs
attrapaient la mention, pas l'affirmation, et la garde échouait après 3
tentatives. Correctif dans `checkEthics` : une occurrence dont le marqueur
prohibitif est **immédiatement accolé** (`no`, `never`, `without`, `avoid`,
`exclude`, `omit`) n'est pas une violation. Volontairement étroit — ni virgule
ni mot intercalé — donc « No matter what, we guarantee results » reste bloqué,
et le balayage continue au-delà de la mention prohibitive pour attraper une
vraie violation plus loin dans la même chaîne. Cas adverses testés.

**Diagnostic** : `logGenerationFailure()` nomme désormais la nature de l'échec
côté serveur (déontologie + violations, longueur, périmètre + pages manquantes,
structure + chemins zod, ou erreur API avec son statut). L'UI distingue le cas
actionnable de la longueur du générique.

**Vérifié en réel** : génération complète en 140 s, les 6 pages demandées.
Cause 100 % frontend, aucune intervention backend.

## Lot 4 : pricing en dollars, Stripe, Monthly Presence

### Ce qui a été vérifié en base avant d'écrire une ligne

Le schéma du Lot 4 est bien appliqué sur l'US et le front ne fait que le
consommer. Trois écarts entre le brief du lot et la base réelle, tous relevés
en interrogeant `fobgdsupyfslxbswfuay` :

- `subscriptions` n'a **pas** de colonne `stripe_customer_id` (le brief la
  supposait). La résolution customer → user passe donc uniquement par
  `profiles.stripe_customer_id`, qui est unique — c'est d'ailleurs plus sain :
  une seule correspondance canonique, pas deux à tenir synchronisées.
- `purchases` porte `amount_cents` (pas `amount`), plus
  `stripe_checkout_session_id` (unique), `stripe_payment_intent_id` et un
  `status` contraint (`pending`/`paid`/`refunded`/`failed`).
- `monthly_presence_content` porte un `status`
  (`pending`/`generating`/`complete`/`failed`) que le brief ne mentionnait pas.

`brand_kits.tier` existe bien, avec le kit de test déjà backfillé en
`signature`, et la note du Lot 3 ci-dessus (« pas de colonne `tier` ») est
désormais périmée : la migration backend l'a ajoutée.

### `.env.local` — le repointage n'est PAS le sujet

Le brief du lot demandait de signaler que `.env.local` pointe sur l'EU et doit
être repointé sur l'US. **Ce n'est plus vrai** : le fichier pointe déjà sur
`https://fobgdsupyfslxbswfuay.supabase.co` et porte ses cinq variables
renseignées (URL, anon, service_role, site URL, clé Anthropic).

Ce qui manque réellement pour tester le Lot 4, ce sont les **quatre variables
Stripe**, absentes du fichier : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, plus les quatre ids de prix
(`STRIPE_PRICE_STARTER`, `_PRACTICE`, `_SIGNATURE`, `_MONTHLY_PRESENCE`).
Voir `.env.example`, qui les documente.

### Trois « tiers » qui ne veulent pas dire la même chose

C'est la distinction la plus facile à confondre, et la confondre coûterait de
l'argent dans un sens ou dans l'autre :

- le tier **acheté** — `purchases`, via `resolveEntitledTier`. C'est le DROIT
  COURANT. `purchases` est un journal d'ÉVÉNEMENTS (un upgrade ajoute une
  ligne, il n'en remplace aucune), donc le droit est le **plus généreux** des
  achats payés, jamais le dernier. Prendre le dernier dégraderait un client qui
  vient de payer davantage.
- le tier **livré** — `brand_kits.tier`. L'INSTANTANÉ de la génération, qui
  reste vrai même après une montée en gamme. C'est lui que la page de kit
  affiche. Le commentaire de la colonne en base dit exactement cela.
- le tier **paramètre** de `resolveKitScope()`, qui ne fait que traduire l'un ou
  l'autre en périmètre de pages.

La couture du Lot 3 a tenu sa promesse : le branchement s'est fait chez
l'appelant (`app/app/projets/[id]/kit/actions.ts`), et pas une ligne de la
génération n'a bougé.

`DEFAULT_KIT_TIER = "signature"` a disparu au profit de
`FALLBACK_KIT_TIER = "starter"`. Le sens du repli s'est INVERSÉ : tant que le
paiement n'existait pas, servir le plus généreux était le bon choix ; depuis
qu'il existe, une valeur inattendue ne doit jamais ouvrir le livrable le plus
complet. Ce repli ne sert qu'à RELIRE un kit déjà livré — aucune génération
n'en part, elles partent toutes d'un achat payé.

Corollaire : `brand_kits.tier` étant une colonne, le tier n'est plus écrit dans
le jsonb `content`. Il y reste **toléré en lecture** pour les kits du Lot 3
déjà en base ; deux copies auraient dérivé à la première montée en gamme.

### Stripe — ce qui accorde un droit, et ce qui n'en accorde aucun

**Le webhook fait autorité, et lui seul.** Rien d'autre dans l'application
n'écrit `purchases` ni `subscriptions` : ni la page de succès, ni une server
action, ni un formulaire. Une redirection se forge dans la barre d'adresse ;
une signature HMAC, non. La page de succès RELIT ce que le webhook a écrit, et
affiche « confirmation en cours » avec un rafraîchissement automatique **borné**
tant que la ligne n'est pas là — une roue qui tourne indéfiniment ne dit rien
de plus qu'un écran figé.

**Idempotence.** `stripe_events` porte `stripe_event_id` en clé primaire. Le
verrou est posé AVANT le traitement et **défait si celui-ci échoue** : sans ce
désarmement, le verrou se retournerait contre nous — le rejeu de Stripe verrait
« déjà traité » et laisserait un paiement encaissé sans droit accordé. On
préfère un rejeu de trop à un droit perdu.

**Le code de retour est un contrat.** 2xx signifie « traité, ne rejoue pas ».
On ne le rend donc que si l'event est traité, dupliqué ou délibérément ignoré.
Une panne rend 500, pour que Stripe REVIENNE.

**Deux pièges de l'API `2026-07-29.dahlia`**, vérifiés dans les types du SDK
(`stripe@22.5.0`) plutôt que supposés :
- `current_period_end` n'est **plus** sur l'abonnement, il vit sur ses ITEMS.
  Lire l'ancien emplacement aurait rendu `undefined` en silence, donc un accès
  sans échéance. On retient la date la plus lointaine — c'est jusque-là que le
  praticien a payé.
- une facture ne porte **plus** `subscription` à la racine : l'abonnement qui
  l'a produite est dans `parent.subscription_details`.

**Le montant écrit dans `purchases` vient du CATALOGUE**, pas de
`amount_total` : quand l'add-on est gardé, le total de la session comprend
aussi les $39 du premier mois, qui ne sont pas un achat de kit.

**La service_role bypasse la RLS.** Chaque écriture du webhook porte donc
elle-même la contrainte que la policy aurait portée — d'où le
`.is("stripe_customer_id", null)` de `linkCustomer`, qui empêche d'écraser la
correspondance d'un autre compte.

**Un seul customer Stripe par utilisateur**, pour le paiement unique comme pour
l'abonnement : c'est ce qui rend la résolution customer → user possible. La clé
d'idempotence de la création dérive de l'id utilisateur, donc deux onglets ne
créent pas deux customers.

**L'add-on est coché par défaut ET le dit**, à côté de sa microcopy. Cocher par
défaut sans le dire serait un dark pattern — et ce produit s'adresse à des
cliniciens tenus de ne pas en employer dans leur propre publicité.

### Monthly Presence — les cinq leçons du kit, appliquées d'emblée

C'est la surface publiable la plus volumineuse et la plus répétée du produit :
le kit se relit une fois, ceci part en ligne douze fois par mois.

1. **Streaming.** `PRESENCE_MAX_TOKENS = 24000` est délibérément au-dessus du
   seuil du SDK (~21 333) : ce livrable ne tient pas en dessous. Un test vérifie
   le TRANSPORT (`stream()` appelé, `create()` jamais), parce que `create()`
   lèverait côté CLIENT, en zéro seconde, sans statut HTTP ni entrée réseau.
2. **Aucune borne cassante.** Les listes sont normalisées, jamais refusées sur
   leur compte ; un mois plus court est accepté. Seule une liste VIDE est
   refusée. La prose garde des bornes larges.
3. **Déontologie sans piège.** `generateWithEthicsGuard` et
   `ETHICS_SYSTEM_RULES` réutilisés tels quels. Le prompt ne demande jamais au
   modèle d'ÉCRIRE une liste d'interdits dans le livrable — c'est ce qui avait
   fait échouer le kit sur sa propre conformité — et un test fige ce contrat.
   **Rien n'est exclu du contrôle**, notes de calendrier comprises : elles sont
   lues juste avant de publier, et une consigne fautive s'y recopierait.
4. `stop_reason: "max_tokens"` lève `PresenceTruncatedError` — un échec de
   LONGUEUR, actionnable, pas un JSON invalide opaque.
5. `export const maxDuration = 300` sur la **page** qui porte l'action (les
   Server Actions en héritent), et l'interface annonce une à deux minutes.

**Le point de fuite déontologique n'est pas celui du kit.** Sur un site, la
promesse de résultat se glisse dans la page About ; sur un réseau social, elle
se glisse dans le **hook** — la première ligne doit arrêter le défilement, et
c'est exactement ce qu'un modèle entraîné au copywriting produit pour y
arriver. Le prompt système le dit explicitement.

**Écriture par la service_role, obligatoirement** :
`monthly_presence_content` est en INSERT et UPDATE refusés aux clients par RLS.
L'appartenance du projet est donc vérifiée AVANT, avec le client de session.
Le statut n'est écrit qu'à la fin, en `complete` : sans ordonnanceur pour le
nettoyer, un `generating` intermédiaire laisserait un mois éternellement « en
cours » qu'aucun bouton ne débloque.

**Le mois est calé au premier en UTC.** Le fuseau du serveur ne doit pas
décider dans quel mois tombe un livrable : un praticien à Honolulu et un
serveur à Francfort ne sont pas d'accord sur la date pendant dix heures par
jour.

### Seams anti-churn — documentés, PAS construits

Le churn de 10-15 %/mois est le risque central du modèle économique : une
cohorte est à moitié partie avant la fin de l'année, et l'acquisition ne fait
que remplir un seau percé. Trois coutures sont identifiées dans
`lib/billing/plans.ts` (`TODO(retention)`), près du modèle d'abonnement :

1. **calendrier livré**, pas seulement généré (un abonnement qu'on doit aller
   consulter se résilie ; un abonnement qui arrive se garde) ;
2. **rappels de publication** le jour dit, avec le texte prêt à copier ;
3. **publication facilitée** — copier-coller douze fois dans Instagram est le
   vrai coût du produit pour l'utilisateur.

Aucun cron, aucun ordonnanceur n'est écrit : c'est une décision
d'infrastructure qui n'appartient pas au front.

### Checkout Stripe en mode test — procédure, NON exécutée ici

**Aucune clé Stripe n'était disponible dans cet environnement** (les quatre
variables sont absentes de `.env.local`), donc aucun paiement de test n'a été
joué. Le code compile, `lint`, `tsc` et les 225 tests passent, mais le premier
aller-retour réel reste à faire par vous :

1. Dashboard Stripe **en mode test** → Products : créer quatre prix — trois
   uniques (`$79`, `$149`, `$249`) et un récurrent mensuel (`$39`). Relever les
   quatre `price_…` et les mettre dans `.env.local`
   (`STRIPE_PRICE_STARTER`, `_PRACTICE`, `_SIGNATURE`, `_MONTHLY_PRESENCE`).
   ⚠️ Ces ids DIFFÈRENT entre le mode test et le mode live.
2. Developers → API keys : copier `sk_test_…` dans `STRIPE_SECRET_KEY` et
   `pk_test_…` dans `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
3. Dans un terminal : `stripe login`, puis
   `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
   La commande affiche un `whsec_…` : le mettre dans `STRIPE_WEBHOOK_SECRET`
   et **redémarrer `npm run dev`** (les variables sont lues au démarrage).
4. Aller sur `/pricing` → « Choose Practice » → `/app/checkout`. Laisser la case
   Monthly Presence cochée. Le total affiché doit être **$188** ($149 + $39).
5. Payer avec la carte de test `4242 4242 4242 4242`, n'importe quelle date
   future et n'importe quel CVC.
6. Vérifier dans le terminal `stripe listen` : `checkout.session.completed` puis
   `customer.subscription.created` doivent renvoyer **200**.
7. Vérifier en base : une ligne `purchases` en `status = 'paid'` au montant
   **14900** (le kit seul, pas les $188), une ligne `subscriptions` en `active`
   avec `current_period_end` renseigné, une ligne `stripe_events` par event, et
   `profiles.stripe_customer_id` rempli.
8. Rejouer le même event (`stripe events resend <evt_…>`) : la réponse doit être
   `{"status":"duplicate"}` et **aucune** seconde ligne `purchases` ne doit
   apparaître.
9. Décocher l'add-on et refaire un achat : la session doit passer en
   `mode: payment`, `purchases` gagner une ligne, `subscriptions` rester
   inchangée.
10. `stripe trigger invoice.payment_failed` : l'abonnement doit passer en
    `past_due`, et la page Monthly Presence doit le DIRE plutôt que de proposer
    de racheter.

### Limites connues, à traiter ensuite

- **`/login` ignore le paramètre `next`.** Le proxy le pose bien
  (`/login?next=/app/checkout`), mais `signIn` redirige inconditionnellement
  vers `/app`. Un praticien parti de `/pricing` sans session atterrit donc sur
  son tableau de bord au lieu du checkout. Correctif volontairement laissé de
  côté ici : il touche `lib/actions/auth.ts`, hors du périmètre facturation.
- **La page d'accueil est toujours en français** alors que `/pricing` est en
  anglais, d'où un libellé « Pricing » dans une navigation française. Laisser
  `/pricing` injoignable aurait été la pire des deux incohérences.
- **Aucun portail de gestion d'abonnement** (`billingPortal.sessions`) : le
  praticien voit son abonnement mais ne peut pas le résilier depuis
  l'application. La microcopy promet « Cancel anytime » — à tenir au prochain
  lot.
- **Toujours aucun appel Anthropic réel joué ici** : la génération Monthly
  Presence n'a pas été exécutée contre l'API.

## Reste après le lot 4

- Brancher les seams anti-churn (cron/ordonnanceur, envoi mensuel, rappels).
- Portail Stripe de gestion d'abonnement, pour tenir la promesse « Cancel
  anytime » dans l'application.
- Partage public du kit (`/kit/[slug]` + policy de lecture anonyme) : toujours
  une décision de schéma à prendre dans `eklio-backend` d'abord.
- `maxDuration` côté Vercel sur la génération du kit comme sur celle du mois
  (le code le pose sur la page de presence ; le plan Vercel doit suivre).
- Correctif `stop_reason` sur `lib/ai/directions.ts` : les directions ne
  distinguent toujours pas la coupure par longueur d'une erreur de structure,
  contrairement au kit et au mois.
- Purge des données de test + retrait des `TODO(post-test-data)`.
- Export PDF (`brand_kits.pdf_url` existe et reste vide).
- Mise en prod : variables Vercel pointées sur l'US, Site URL de prod, SMTP
  réel, endpoint webhook Stripe en mode live, rotation des secrets.
