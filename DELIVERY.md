# Refonte US — journal de livraison

Ce document accompagne les dix lots du cahier des charges. Il porte trois
choses, et rien d'autre : les ÉCARTS avec les références, les DEMANDES au
dépôt de schéma, et les DÉCISIONS structurantes qu'un futur passage aurait
besoin de connaître avant de toucher au code.

Il ne redécrit pas ce que le code dit déjà : chaque module porte son propre
commentaire.

---

## 1. Écarts avec le contrat visuel

La règle du cahier des charges est explicite : « Where this prompt and a
reference file disagree, the reference file wins — report the discrepancy
rather than silently choosing. » Voici les cas où la question s'est posée.

| # | Sujet | Référence | Prompt | Retenu |
|---|---|---|---|---|
| 1 | Grille de contenu en mobile | Écran 8 : deux colonnes | §5 : « horizontal scroll » | La référence — deux colonnes |
| 2 | Boutons pleins sur le kit | Écrans 5 et 6 : un primary + un accent | §2 : au plus un par écran | Les références — les deux, le §5 fusionnant les deux écrans |
| 3 | Padding haut de la colonne de question | 44px (Écran 1) / 32px (Écran 2) | §1 : « 24–40px » | Les deux valeurs, par étape |
| 4 | Tracking de l'avatar | 0.08em (tous les en-têtes) | §1 : ne le liste pas | La référence — token `--tracking-mono-08` ajouté |
| 5 | Encre de corps des maquettes | Écran 1 et carte 3 : teinte du primaire désaturée · carte 1 : `secondary` tel quel | — | La règle déterministe : les références se contredisent ENTRE ELLES, et la règle doit tenir pour n'importe quelle palette générée |
| 6 | Deuxième barre des vignettes de palette | Six traitements différents sur six cartes | — | Une règle unique (l'accent à 55 %) : quatre cartes sur six la suivent déjà |
| 7 | Polices de l'app | `<link>` Google Fonts | §1 : « une seule requête » | `next/font/google` — auto-hébergé, donc ZÉRO requête. L'écart va dans le sens de l'intention |

## 2. Le contraste du chrome ne passe pas AA — et il ne peut pas

Le §9 demande que « le contraste du chrome passe AA sur chaque paire ». Mesuré
(cf. `lib/brand/__tests__/contrast.test.ts`), il ne passe pas, avec les valeurs
relevées telles quelles dans les références :

| Paire | Ratio | AA texte courant | AA grand texte |
|---|---|---|---|
| `--ink-3` sur `--bg` | 2.57:1 | ✗ | ✗ |
| `--accent` sur `--bg` | 4.20:1 | ✗ | ✓ |
| `--bg` sur `--accent` | 4.20:1 | ✗ | ✓ |

Le §1 et le §9 se contredisent. Les tokens n'ont PAS bougé — la consigne sur
les références est explicite. Ce qui a été fait à la place :

- **Corrigé** là où la référence n'impose rien : les erreurs en ligne étaient
  en `--accent` ; elles passent en `--ink` avec un filet argile de 1px. Un
  message d'erreur illisible est une contradiction.
- **Laissé, et nommé** là où la référence impose la couleur : « 11 MORE
  LOCKED » et « 2 REGENERATIONS LEFT » en `--ink-3` (Écrans 4 et 7), et le
  libellé du bouton `accent` en 14px semi-gras (Écrans 4 et 6), qui n'atteint
  pas le seuil « grand texte » de WCAG.

`--ink-3` reste par ailleurs légitime là où il est du texte INACTIF (item de
checklist barré) ou décoratif (`aria-hidden` : lignes de placeholder, barre
d'URL de la maquette).

**Décision à prendre par un humain :** soit assombrir `--ink-3` et `--accent`
d'environ 8 points de clarté, soit assumer ces trois paires. Le test fige les
ratios : il échouera si quelqu'un change un token sans revenir ici.

## 3. Demandes au dépôt de schéma

Aucune migration n'a été écrite ici (§8). Quatre manques ont été contournés, et
chacun mérite une colonne ou une table.

### 3.1 `practice_stages` — l'étape 1 du brief

Le §5 demande des « stage cards » à l'étape 1. Aucune table de catalogue n'existe
pour ce choix, contrairement à `site_goals`, `specialties` ou
`client_persona_cards`. La liste est donc **codée en dur** dans
`components/brief/step-bodies.tsx`, contre la règle du §6, et le choix est rangé
dans `project_briefs.data.stage`.

**Demandé :** une table `practice_stages (id, label, description, sort_order,
active)` sur le modèle de `site_goals`, plus une colonne
`project_briefs.practice_stage_id`.

### 3.2 Un état de génération de premier ordre

Il n'existe pas de table de jobs. L'état d'une génération vit dans
`brand_kits.content.generation` — un `jsonb` libre, sans CHECK, resté du lot 3.
Conséquences : pas d'index sur les jobs en cours, pas de contrainte sur les
statuts, et un job dont le processus meurt reste `running` jusqu'à son
plafond de cinq minutes.

**Demandé :** `brand_kits.generation_status` + `generation_stage` +
`generation_started_at`, ou une petite table `generation_jobs`.

### 3.3 `email_log` — le plafond d'envoi

L'état d'envoi (dernier e-mail par type, désinscription) vit dans
`auth.users.raw_user_meta_data.eklio_emails`, écrit par l'API admin. C'est le
seul stockage durable par utilisateur accessible au serveur sans migration.

**Demandé :** `email_log (user_id, kind, sent_at, unsubscribed_at)` avec un
index sur `(user_id, sent_at desc)`. Elle donnerait le plafond des 72 h en une
requête, un historique consultable, et la désinscription comme donnée de
premier ordre plutôt que comme clé de métadonnée.

### 3.4 `projects.current_step` est mort

`project_briefs.progress_step` est canonique (§0.5). Plus rien dans ce dépôt ne
lit ni n'écrit `projects.current_step` — vérifié par grep, seuls des
commentaires le mentionnent. Le seul code qui en dépendait était
`app/app/projets/[id]/brief/actions.ts`, retiré au lot 1 avec toute
l'arborescence française.

**La colonne peut être supprimée** par une migration backend.

## 4. Décisions structurantes

### 4.1 Route handlers, pas server actions

Le dépôt portait les deux conventions. Le §7 décrit une surface HTTP explicite
— un PATCH, un statut sondé toutes les 1,5 s, un 404 plutôt qu'un 403. Deux
raisons ont tranché : React dispatche les server actions EN SÉRIE, donc un
sondage se mettrait en travers de l'autosave et des clics ; et une action ne
porte ni verbe ni code de statut. Les server actions restent pour les
formulaires d'AUTHENTIFICATION, où l'amélioration progressive compte.

### 4.2 Palettes et typographies ne sont pas générées

Trois contraintes de la base sont impossibles à garantir en les demandant à un
modèle : cinq hex valides par direction, TROIS polices de titre distinctes
entre les directions, et une URL Google Fonts réelle. Elles sont tirées du
catalogue (`lib/generation/select.ts`), dans l'ordre des choix du praticien. Le
modèle garde ce qu'il fait bien — écrire.

### 4.3 Ordre des trois gardes

Structure (zod) → rendu (les CHECK de la base, une reprise par champ) →
déontologie. La déontologie passe en DERNIER parce qu'une reprise de longueur
réécrit du texte : la vérifier avant validerait une version qui n'existe plus.

### 4.4 L'heure du cron est en UTC

`0 5 1 * *` tombe à 00:00 EST l'hiver et 01:00 EDT l'été — toujours le 1er à
New York. `0 4 1 * *` semblerait plus juste en été, mais l'hiver il tomberait à
23:00 EST le DERNIER jour du mois précédent, et `monthKey()` remplirait alors
le mois qui vient de finir.

### 4.5 Ce que le PDF est, et n'est pas

Il est écrit à la main (`lib/kit/pdf.ts`), sans dépendance : un rendu headless
ajouterait ~300 Mo et un navigateur en serverless, une bibliothèque de mise en
page ajouterait une dépendance pour une page de texte et cinq rectangles.

C'est un livrable de RÉFÉRENCE — hex de la palette, noms des polices, guide de
voix, copy du site, avec les couleurs réelles du praticien. Ce n'est PAS un
rendu de la maquette : les polices de marque n'y sont pas embarquées, les
titres sont composés en Times. Le kit à l'écran reste la référence visuelle.

## 5. Ce qui n'a pas pu être vérifié ici

- **La comparaison visuelle côte à côte.** Aucun navigateur n'est installé dans
  cet environnement (ni Playwright, ni Puppeteer, ni Chromium). Chaque écran a
  été construit en LISANT le balisage de sa référence — géométries, couleurs et
  espacements relevés valeur par valeur, et annotés dans le code — mais aucune
  capture n'a été comparée à l'œil. C'est la vérification qui reste à faire.
- **Un parcours de bout en bout contre la base.** Les lectures et écritures
  sont typées contre le schéma réel du projet US, et les contraintes ont été
  transcrites depuis les CHECK eux-mêmes, mais aucun brief n'a été rempli
  jusqu'à un kit dans cet environnement.
- **Un envoi d'e-mail réel.** `RESEND_API_KEY` n'est pas renseignée : les
  envois sont journalisés, pas émis.

## 6. Corrections trouvées en chemin

- **`lib/ethics/rules.ts` — la règle `client_voice` manquait son propre
  contre-exemple.** La table `ethics_rules` donne « Clients often tell me... »
  comme exemple interdit ; le motif exigeait un possessif (« my clients say »)
  et laissait donc passer la phrase que la base cite elle-même. Le possessif
  devient facultatif, avec une liste FERMÉE d'adverbes de fréquence — un
  `\w+` générique bloquerait « clients with anxiety report », qui décrit une
  population et non un éloge.
