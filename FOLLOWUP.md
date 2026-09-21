# FOLLOWUP.md — hors périmètre du chantier Content

Ce fichier ne porte que ce qui a été **rencontré** pendant le chantier Content et
**laissé intact** parce qu'il ouvre un autre chantier. Rien ici n'a été modifié.

---

## F1 — ⚠ La production porte 14 migrations que le tronc n'a pas

**Rencontré en** PHASE 0. **Détail complet** : `eklio-backend/DIAGNOSTIC.md` §0.1.

`fobgdsupyfslxbswfuay` a 148 migrations appliquées. `claude/great-brahmagupta-za7qmx`
et `origin/main` en portent 133. Les 14 manquantes existent sur
`origin/claude/stoic-ritchie-1liqrz` (tête `46d4111`) et n'ont été mergées nulle part :

### La liste exacte, une par une

Colonne « conflit » : ce que la migration ferait à CE chantier si les deux branches se
rencontraient. Elle a été établie en lisant les quatorze fichiers sur
`origin/claude/stoic-ritchie-1liqrz`, pas en les devinant d'après leurs noms.

| # | Identifiant | Ce qu'elle touche | Conflit avec ce chantier |
|---|---|---|---|
| 1 | `20260917160202_california_is_the_first_verified_state` | Supprime cinq paires de `license_type_states` pour `CA` (lpc, lmhc, lcpc, licsw, lmsw), qui ne figurent pas au tableau du BBS | Aucun. Aucune migration de ce chantier ne lit `license_type_states`. |
| 2 | `20260917164228_lep_the_fourth_bbs_licence` | Ajoute `lep` à `license_types` et la paire `(lep, CA)` à `license_type_states` | Aucun. |
| 3 | `20260917164434_a_closure_is_a_decision_with_a_snapshot` | **Crée `public.sellability_decisions`** (+ RLS, + données) | ⚠ **OUI.** `supabase/tests/20260911180620_tenancy_layer.test.sql` énumère TOUTES les tables et exige une déclaration par table. Une table nouvelle sans déclaration fait échouer ce test au merge. Une ligne à ajouter, mais elle doit être ajoutée. |
| 4 | `20260917164505_florida_settles_the_national_description` | Réécrit le `comment on column license_types.description` (cite Florida Statutes 490.012(2)(b)) + garde-fou | Aucun pour le schéma. ⚠ **Attention** : `20260827107000_english_only_schema.test.sql` scanne les commentaires ; celui-ci est en anglais, donc il passe — mais c'est une coïncidence heureuse, pas une garantie. |
| 5 | `20260917165937_the_decision_table_says_no_out_loud` | Remplace la policy `sellability_decisions_no_browser` par des policies qui refusent explicitement | ⚠ Dépend de la n°3. Même remarque. |
| 6 | `20260917210004_positioning_is_a_second_family_of_rules` | **Crée `public.positioning_rules` et `public.positioning_patterns`** (+ RLS, + policies) | ⚠ **OUI, deux fois.** Même raison que la n°3 : deux tables de plus à déclarer dans `tenancy_layer.test.sql`. |
| 7 | `20260918185950_the_ten_positioning_rules_v1` | Insère les dix règles et leurs motifs dans les deux tables ci-dessus | ⚠ Dépend de la n°6. |
| 8 | `20260918190034_how_many_findings_the_free_report_shows` | Une ligne dans `app_settings` | Aucun. |
| 9 | `20260918193221_third_person_becomes_present_without_and_the_cap_is_decided` | `update` sur `positioning_patterns` / `positioning_rules` (règle « troisième personne ») + plafond | ⚠ Dépend de la n°6. |
| 10 | `20260919132507_third_person_is_anchored_not_capitalised` | Réécrit le motif de la même règle : `[A-Z]` ne contraignait rien, les deux moteurs compilent sans égard à la casse | ⚠ Dépend de la n°6. |
| 11 | `20260919172421_the_window_does_the_work_not_the_sentence_boundary` | Réécrit encore le même motif : `[^.!?]` se fermait sur « Ph.D. » | ⚠ Dépend de la n°6. |
| 12 | `20260919200211_the_model_is_told_the_thirty_phrases` | **Redéfinit `public.usp_banned_phrases_list()`** | ⚠ **OUI, indirectement.** `20260831090000_revoke_internal_function_surface.test.sql` énumère la surface de fonctions exposée ; un `create or replace` qui ne rejoue pas ses `revoke`/`grant` peut rouvrir la fonction. À vérifier au merge, pas à supposer. |
| 13 | `20260920081353_an_anonymised_testimonial_is_still_a_testimonial` | **Insère un motif dans `ethics_patterns`** | ⚠ **OUI, et c'est le plus franc.** `supabase/tests/20260914200000_ethics_parity.test.sql` affirme « 19 motifs, mêmes identifiants, mêmes règles ». Un vingtième motif fait échouer ce test tel quel. Côté écran, `lib/content/ethics-line.ts` retombe sur l'identifiant mis en mots pour une règle inconnue — dégradé, pas cassé. |
| 14 | `20260920081641_two_craft_cliches_join_the_thirty` | **Insère deux phrases dans `banned_phrases`** (30 → 32) | ⚠ **OUI, en comportement.** `content_topics_banned_phrases_gate` (20260920160000) appelle `usp_banned_phrases_check` : un sujet accepté par la banque en local peut être refusé en production. C'est le bon sens du décalage — la production est plus stricte — mais il faut le savoir avant de charger une banque. |

**Résumé des conflits** : trois tables nouvelles à déclarer dans `tenancy_layer.test.sql`
(n°3, n°6 ×2), un test de parité déontologique à remonter de 19 à 20 motifs (n°13), une
surface de fonction à revérifier (n°12), et un gate de phrases qui devient plus strict
(n°14). Aucun conflit de schéma au sens strict : **rien de ce chantier ne redéfinit un
objet que ces quatorze touchent, et réciproquement.** Ce sont des tests d'énumération
qui casseront, pas des `create table` qui se marcheront dessus.


**Pourquoi c'est un problème et pas une nuance.** Un CI qui rejoue les migrations depuis
zéro depuis cette branche produit un schéma qui n'est pas celui de la production. La
liste de phrases interdites contre laquelle le moteur de composition est testé ici a 30
entrées ; celle qui refuse en production en a 32.

**Atténuation tenue dans ce chantier** : aucune migration neuve ne référence un objet
introduit par ces 14, et tout contrôle de phrase passe par le RPC
`usp_banned_phrases_check` plutôt que par une copie de la liste.

**Ce qu'il faut faire** : merger `claude/stoic-ritchie-1liqrz` dans le tronc backend,
puis rejouer `scripts/verify-recovered-migrations.sh`, puis reprendre les cinq points du
résumé ci-dessus. C'est de l'hygiène de branches, explicitement hors périmètre ici.

⚠ **L'enjeu, en une phrase** : les 143 migrations que le CI rejoue ne décrivent pas la
production, et quelqu'un doit le savoir AVANT le prochain déploiement. Appliquer ces
quatorze est hors périmètre ; les ignorer au moment de déployer ne l'est pas.

---

## F2 — La branche de référence citée au prompt a divergé

**Rencontré en** PHASE 0. **Détail** : `DIAGNOSTIC.md` §0.2.

`claude/eklio-reveal-rebuild-28o625` existe des deux côtés mais sa tête frontend
(`e7d5855`, merge de la PR #15) n'est pas un ancêtre du tronc courant. Elle n'est plus
une référence utilisable. Le travail se fait sur `claude/great-brahmagupta-za7qmx`.

Rien à faire, sinon cesser de la citer. Sa suppression relèverait de l'hygiène de
branches, hors périmètre.

---

## F3 — `local-verify.sh` sort en 1 quand la dérive est grande, et cache son propre résumé

**Rencontré en** PHASE 6.3.

Le script termine par

```bash
python3 supabase/tests/helpers/schema_drift_report.py … | grep -E '…' | head -20
…
echo "Migrations replayed clean. Tests: $ran run, $failed failed."
```

Sous `set -euo pipefail`, `head -20` ferme le tuyau dès la vingtième ligne, le
processus amont reçoit SIGPIPE, et le script **s'arrête là** — avant la ligne
qui dit combien de tests ont tourné et combien ont échoué.

Tant que la dérive tient en vingt lignes, on ne le voit pas. Ce chantier ajoute
478 objets (tables, policies, contraintes, index, fonctions), le rapport en fait
plus de vingt, et le script est sorti en 1 avec **zéro test en échec** — un
signal rouge pour une raison qui n'est pas celle qu'on croit lire.

**Correctif** : capturer la sortie du rapport dans une variable avant de la
tronquer, ou remplacer `head -20` par `sed -n '1,20p'` qui lit jusqu'au bout.
Une ligne, mais dans un fichier que ce chantier n'avait pas à toucher.

**Ce que la dérive elle-même dit** : `ONLY IN PRODUCTION: 0`, `DIFFERENT: 0`,
et 478 objets que le rejeu produit et que l'empreinte enregistrée n'a pas.
C'est la forme attendue — les migrations produisent tout ce que la production a,
plus tout ce que ce chantier ajoute. L'empreinte
`supabase/tests/helpers/schema_fingerprint.production.txt` sera à réenregistrer
le jour où ces migrations seront appliquées.

---

## F4 — Deux des « réglages limités » de l'écran de relecture n'ont pas de mécanisme

**Rencontré en** PHASE 5, en câblant `/app/content/[id]`. **Clause d'arrêt appliquée :
rapporté, pas contourné.**

Le chantier demande, pour l'écran de relecture, « des réglages limités (variante de
teinte, changement d'archétype, mot accentué) ». Le troisième est livré (voir
`IMPLEMENTATION_REPORT.md`). Les deux autres ne le sont pas, et chacun pour une raison
différente :

**La variante de teinte.** Il n'existe aucune colonne qui porte le choix clair/sombre
d'un post. Le choix appartient au planificateur du mois (`DARK_CARD_RATIO` dans la
couche de composition), qui décide combien de cartes d'un mois tournent sur fond sombre.
`content_items.theme` ressemble au bon endroit et ne l'est pas : c'est le THÈME du mois
auquel le post appartient, validé contre `content_months.themes` par trigger, et
délibérément absent de la liste blanche de `update_content_item`.

Un sélecteur clair/sombre aurait donc été un réglage qui ne se garde pas : elle choisit
sombre, elle recharge, c'est clair. C'est pire qu'un réglage absent. **Ce qu'il faudrait
pour le livrer** : une colonne `content_items.dark` nullable (null = « ce que le mois a
décidé »), dans la liste blanche du patch, et une décision produit sur qui gagne quand
le planificateur et elle ne sont pas d'accord. Cette dernière question n'est pas une
question d'implémentation.

**Le mot accentué.** Le moteur de composition n'a aucune notion d'accentuation : aucun
des onze modules d'archétype, ni `svg.ts`, ni `layout.ts`, ni `measure.ts` ne porte de
concept de mot mis en valeur. Le livrer voudrait dire ajouter un balisage inline au
texte des payloads, le faire traverser la mesure (un mot en 600 ne mesure pas comme le
même mot en 400), le faire traverser l'émission SVG, et le faire entrer dans
`contentHash` — sinon deux cartes qui diffèrent par leur accentuation partageraient une
entrée de cache et l'une servirait l'image de l'autre.

C'est un chantier de composition, pas un réglage d'écran. **Ce qu'il faudrait pour le
livrer** : un champ `accent` optionnel par élément de payload, propagé à travers les
cinq fichiers ci-dessus, avec sa propre suite — dont un cas négatif prouvant que le hash
change quand l'accentuation change.

---

## F5 — `lib/images/config.ts` porte une table de prix par image, et elle est correcte

**Rencontré en** relisant la DÉCISION 1 (« si une telle table existe déjà dans ce que tu
as écrit, supprime-la »).

Il existe deux chemins d'image dans ce dépôt, et ils ne sont pas facturés pareil :

- **`lib/images/`** — les photographies de marque, modèle `gpt-image-1`. Ce modèle A une
  grille de prix par image, et `lib/images/client.ts` dit en toutes lettres que `usage`
  est enregistré mais **jamais** utilisé pour calculer de l'argent. La table de prix y
  est la bonne source. Ce chemin précède ce chantier et n'a pas été touché.
- **`lib/content/images/`** — les visuels custom de ce chantier, modèle
  `gpt-image-2.5-flare`. Ce modèle n'a PAS de grille par image : il est facturé au
  token. `actual_cost_usd` y est donc calculé depuis `usage`, et il n'existe aucune
  table de prix par image dans ces fichiers.

La table qui existe n'est donc pas celle que la décision demande de supprimer : elle
décrit un autre modèle, sur un autre chemin, et elle y est juste. **Ce qu'il faut
faire** : rien, tant que `lib/images/` reste sur `gpt-image-1`. Le jour où il migre vers
un modèle facturé au token, la table devient un mensonge et doit partir avec lui.

---

## F6 — Le chemin visuel custom n'est importé par aucun écran

**Rencontré en** déboguant `/app/content` (`CONTENT_BUG_REPORT.md` §1.2).

```
$ grep -rln "lib/content/images" app lib components | grep -v __tests__
lib/content/images/generate.ts
lib/content/images/fixture-client.ts
lib/content/images/client.ts
```

Le répertoire ne s'importe que lui-même. La bibliothèque est écrite, testée
(26 tests) et **injoignable** : aucune route, aucun composant, aucun script ne
l'appelle. C'est cohérent avec `IMPLEMENTATION_REPORT.md` §7.1, qui l'annonce
comme non câblée — mais ça veut dire que **les quatre variables d'environnement
d'image ne servent à rien tant que rien ne l'appelle**, et que la ligne 2 de
l'estimation de coût (§10.7) porte sur un chemin que personne n'emprunte.

**Ce qu'il faut faire** : le câbler à l'écran de relecture (un bouton « make me
an image for this »), ou l'assumer comme livré-en-avance. Hors périmètre du
débogage.

---

## F7 — `content_pipeline_enabled` n'existe pas, et le brief le suppose

**Rencontré en** PHASE 1 du débogage. **Clause d'arrêt appliquée.**

Le brief de débogage dit « le pipeline est livré derrière
`content_pipeline_enabled` à `false` ». Ce réglage n'existe ni en base
(`app_settings` porte 19 clefs, aucune approchante) ni dans le code des deux
dépôts.

Le vrai mécanisme est **double** : `CONTENT_GENERATION_ARMED` non posée, **et**
aucune entrée `vercel.json` pour `/api/cron/content-month`. Voir
`lib/content/generate/armed.ts`, qui explique pourquoi il y a deux verrous.

**Ce qu'il faut faire** : rien au code. Mais quiconque cherchera
`content_pipeline_enabled` pour activer la génération ne trouvera rien, et
conclura peut-être qu'il manque une migration. Les deux verrous sont nommés
ici pour que la prochaine recherche tombe sur la bonne réponse.

---

## F8 — Le repli des libellés d'archétype est plus visible qu'il n'y paraît

**Rencontré en** PHASE 2.2.

`archetypeLabels()` lit `content_archetypes`. Table absente en production →
repli sur la clef déguisée en mots : `single_statement` devient
« single statement » au lieu de « A single statement ».

C'est délibérément moins bon qu'un libellé — c'est le bon comportement pour un
repli — et c'est maintenant journalisé. Mais sur l'écran de relecture, les
vignettes de variantes portent ces mots, et une praticienne n'a aucun moyen de
savoir qu'elle lit un repli.

**Ce qu'il faut faire** : rien tant que les migrations ne sont pas appliquées —
le repli disparaît avec elles. Noté pour que « pourquoi les libellés sont
moches » ait déjà sa réponse.

---

## F9 — ⚠ CE QU'IL FAUT FAIRE POUR QUE `/app/content` SOIT PLEINEMENT FONCTIONNEL

**La seule entrée à lire avant un déploiement du contenu.** Les morceaux
existaient dispersés — `ENV_REQUIRED.md` pour les variables, F1 pour les
migrations, `IMPLEMENTATION_REPORT.md` §10 pour le reste. Ceci est la liste
unique, dans l'ordre d'exécution.

⚠ **Aujourd'hui la page FONCTIONNE mais DÉGRADE** : elle se rend, elle montre
les cartes, et tout ce que les migrations apportent — la ligne « Why this
one », le libellé d'angle, la mise en page gardée, le compteur de crédits,
Swap — est absent. La dégradation est visible et nommée, pas masquée.

### 1. Appliquer les migrations (13, dans cet ordre)

```
20260920140000_monthly_presence_has_a_chokepoint
20260920140100_credit_ledger_append_only
20260920150000_content_archetypes
20260920150100_topic_bank_and_assignment
20260920150200_insight_watch
20260920150300_rendered_assets_and_libraries
20260920160000_a_diagram_label_is_published_text
20260920160100_render_dedup_and_cost_report
20260920170000_the_collision_window_is_computed_once
20260920180000_a_cte_referenced_once_is_inlined
20260921090000_an_item_knows_why_it_was_chosen
20260921100000_swap_is_a_draw_not_a_generation
20260921110000_a_layout_is_hers_to_change
```

⚠ **Elles s'insèrent proprement APRÈS les 14 de F1** — celles-ci s'arrêtent à
`20260920081641`, celles-ci commencent à `20260920140000`, donc l'horodatage
ne s'entrelace pas. **Mais F1 reste à traiter d'abord** : merger
`claude/stoic-ritchie-1liqrz` casse cinq tests d'énumération, et c'est plus
simple à réparer avant qu'après.

**À ce stade, `/app/content` est entièrement fonctionnel en lecture et en
écriture manuelle.** Rien de ce qui suit n'est nécessaire pour ça. Après
application, les trois `sinceMigration` de `lib/data/content.ts` peuvent
redevenir de simples `nullable` — chacun porte le nom de la migration qui le
libère.

### 2. Saisir les variables

**Requises pour la génération :**

| variable | pourquoi |
|---|---|
| `ANTHROPIC_API_KEY` | ⚠ **probablement déjà posée** — le reste de l'app s'en sert. À vérifier, pas à supposer. |
| `OPENAI_API_KEY` | uniquement pour les visuels custom, et **ce chemin n'est câblé à aucun écran** (F6). Sans elle, il refuse proprement sans rien réserver. |

**Facultatives — toutes ont un défaut qui marche.** `CONTENT_COPY_MODEL`,
`CONTENT_IMAGE_MODEL`, `CONTENT_IMAGE_QUALITY`,
`CONTENT_IMAGE_QUALITY_CEILING`. Détail et défauts dans
`eklio-backend/ENV_REQUIRED.md`. Une variable oubliée ici ne casse rien : elle
change ce qui est facturé.

### 3. Basculer le drapeau — **deux verrous, et les deux doivent s'ouvrir**

1. ajouter l'entrée `/api/cron/content-month` dans `vercel.json` ;
2. poser `CONTENT_GENERATION_ARMED` à **exactement** `"true"` — toute autre
   valeur, `"false"` et `"1"` compris, laisse fermé.

⚠ **`content_pipeline_enabled` N'EXISTE PAS**, malgré ce qu'on peut lire
ailleurs. Voir F7 : c'est ce couple-là, et rien d'autre.

⚠ **Dans cet ordre, et le drapeau EN DERNIER.** Il fait dépenser de l'argent
au nom de quelqu'un d'autre — un appel de modèle par post, deux fois. Armer la
génération avant que les migrations soient là écrirait dans des tables qui
n'existent pas ; l'armer avant les clefs échouerait après avoir réservé des
crédits.

### Vérifier que c'est fait

`/app/content` montre le compteur de crédits (invisible tant que
`credit_meter` est absente), une carte porte « Why this one: … » et son
libellé d'angle, et Swap répond au lieu de rendre une erreur. Les trois
signaux viennent de trois migrations différentes : les trois ensemble disent
que le lot est passé en entier.

---

## F10 — ⚠ UNE SUITE VERTE NE DIT PAS QUE ÇA COMPILE

**Rencontré en** déboguant quatre déploiements Vercel en échec d'affilée.

`2bb14fd` a cassé le build. Les trois commits suivants ne touchaient que du
markdown et ont échoué aussi : ils héritaient de la casse. Pendant ce temps,
Vitest (3 902 au vert), ESLint et la suite SQL disaient tous oui.

**La cause tenait en une ligne, dans un fichier de test :**

```ts
status: "ready",   // ContentMonthRecord["status"] vaut
                   // "proposed" | "generating" | "approved" | "failed"
```

**Pourquoi rien ne l'a vue.** Vitest ne vérifie pas les types — il transpile en
effaçant les annotations, donc un fichier qui ne compile pas peut avoir tous
ses tests au vert. `next build` lance `tsc` sur TOUT le projet, fichiers de
test compris, et tombait en 15 secondes.

⚠ **Et c'est exactement l'angle mort du bug d'origine, une couche plus haut :**
la vérification locale ne reproduisait pas les conditions de déploiement. La
première fois c'était la base, cette fois c'est le compilateur.

⚠ **Ma part, nommément :** j'ai lancé `tsc` après avoir écrit
`lib/content/month-screen.ts`, puis j'ai écrit le fichier de test, puis je
n'ai plus lancé que Vitest et ESLint. Le typage n'a jamais vu le fichier qui
le cassait. La commande existait ; c'est la discipline qui manquait, et c'est
pour ça que le correctif est une commande unique plutôt qu'une note.

**Corrigé, et c'est le livrable durable de cette session :**

```bash
npm run typecheck   # next typegen && tsc --noEmit
npm run verify      # typecheck + lint + test + build
```

`npm run verify` est la commande à lancer avant de pousser. Elle est décrite
dans `README.md` §Commandes, avec le tableau de ce que chaque moitié attrape et
rate.

⚠ **`typecheck` lance `next typegen` d'abord**, parce que `RouteContext`,
`PageProps` et `LayoutProps` sont générés par Next. Sur un dépôt fraîchement
cloné, `tsc --noEmit` seul échoue sur des dizaines d'erreurs sans rapport —
une commande de vérification qui ne marche qu'après un build est verte chez qui
vient de builder et rouge partout ailleurs.

**Ce qui reste à faire, et qui est hors périmètre ici :** brancher
`npm run verify` sur un CI, pour que la discipline ne repose pas sur la mémoire
de qui pousse. Tant que ce n'est pas fait, Vercel reste le premier endroit où
un build cassé se voit — c'est-à-dire trop tard.

---

## F12 — ⚠ AVANT TOUTE MISE EN PRODUCTION : vérifier `license_type_states.verified_at` en base de production

**Rencontré le 2026-09-21**, en produisant le premier rendu réel sur une base
locale fraîchement rejouée.

`project_state_is_sellable` compte les lignes **vérifiées** de
`license_type_states` pour l'État du brief. Sur le rejeu des 147 migrations,
`verified_at` est **NULL sur les 240 lignes** de la matrice. Conséquence
directe, mesurée en cliquant : `/api/briefs/[id]/generate` répond
`409 We're not open in CA yet` — pour les onze titres d'exercice, dans les
cinquante États. **Aucun brand kit ne peut être généré, nulle part.**

Le refus est juste : il empêche d'imprimer sur une page publique un titre que
personne n'a vérifié contre le site d'un board. Ce qui manque n'est pas du
code, c'est **l'acte** — et rien dans le dépôt ne dit qu'il doit être fait
avant la première vente.

**À faire, et dans cet ordre :**

```sql
-- 1. Combien de lignes la production tient-elle pour vérifiées ?
select count(*) filter (where verified_at is not null) as verified,
       count(*)                                        as total
  from public.license_type_states;

-- 2. Et pour quels États la porte est-elle réellement ouverte ?
select state_code,
       count(*) filter (where verified_at is not null) as verified,
       count(*)                                        as total
  from public.license_type_states
 group by state_code
 having count(*) filter (where verified_at is not null) > 0
 order by state_code;
```

⚠ **Si la première requête rend `verified = 0`, la production est dans l'état
du rejeu et le produit ne peut vendre dans aucun État.** Ce n'est pas un bug à
corriger en code : quelqu'un lit le site du board, puis pose la date et son
nom dans `verified_by`. Tant que ce n'est pas fait pour au moins un État, la
mise en production n'a pas d'objet.

⚠ **Et ne jamais poser ces dates par script.** Une matrice vérifiée par une
migration est une matrice que personne n'a lue ; c'est exactement le défaut
que ce garde-fou existe pour empêcher. En local, le harnais ouvre la
Californie avec `verified_by = 'LOCAL RENDER HARNESS — not a board check'`,
précisément pour que la ligne dise ce qu'elle vaut.

---

## MISE EN PRODUCTION — la liste, dans l'ordre

⚠ **Rien de ceci n'a été fait.** `main` n'existe pas, aucune variable Vercel
n'est posée, aucune connexion à une base de production n'a eu lieu. Cette
entrée est la seule liste ordonnée ; toute autre note de mise en production
ailleurs dans ce fichier lui est subordonnée.

La colonne « qui » dit ce qu'un agent peut faire seul avec un jeton, et ce qui
demande un geste humain. **La part humaine est réduite à six lignes**, et
chacune l'est pour une raison nommée : un secret qu'un agent ne doit pas
détenir, un acte de responsabilité professionnelle, ou une décision de
facturation.

| # | étape | qui |
|---|---|---|
| 1 | **Vérifications bloquantes avant toute migration.** `npm run verify` vert sur la branche source ; `scripts/local-verify.sh` rejoue les 149 migrations sur une base neuve ; le rapport de dérive est lu, pas seulement lancé. | agent |
| 2 | **Sauvegarde de la base de production**, et vérification qu'elle se restaure — une sauvegarde non restaurée n'est pas une sauvegarde. | agent (jeton Supabase) |
| 3 | **Appliquer les 149 migrations** dans l'ordre, transaction par transaction, en s'arrêtant à la première erreur. | agent (jeton Supabase) |
| 4 | **F12 — `license_type_states.verified_at`.** Sur une base neuve, les 240 lignes de la matrice sont à NULL et `project_state_is_sellable` refuse TOUT : `/api/briefs/[id]/generate` répond `409 We're not open in CA yet` dans les cinquante États. ⚠ **Ce n'est pas du code, c'est un acte** : quelqu'un lit le site du board de chaque État et pose la date. Un agent qui remplirait `verified_by` fabriquerait l'apparence d'une vérification professionnelle qui n'a pas eu lieu. | **humain** |
| 5 | **Variables d'environnement.** Voir le tableau ci-dessous. | agent pour les non-secrètes, **humain** pour les secrets |
| 6 | **Créer `main`** depuis la branche validée. ⚠ Aujourd'hui `main` **n'existe pas** : les seules branches distantes sont `claude/gallant-lamport-mt20i0` et `claude/great-brahmagupta-za7qmx`. La branche source est celle que Naima a validée, nommée explicitement dans la demande — jamais « la dernière ». | **humain** décide laquelle ; agent exécute |
| 7 | **Repointer Vercel** sur `main`, vérifier que les quatre `crons` de `vercel.json` (`anon-briefs` 05:00, `nudges` 14:00, `purge-deleted-kits` 06:00, `purge-events` 04:00) sont enregistrés et que `CRON_SECRET` les protège. | agent (jeton Vercel) |
| 8 | **Générer la banque de production.** Voir F13 pour le dimensionnement : `N × 90 × 3` par segment, 0,00290 $ le sujet. ⚠ **Après** les migrations et **après** F12, sinon les segments n'existent pas. Un mois généré sur une banque à sec sort court sans que rien le signale. | agent (clé passée par commande) |
| 9 | **Stripe.** ⚠ **Le test de bout en bout n'a jamais été confirmé** — ni en test, ni en production. Avant d'ouvrir : un paiement réel de bout en bout, un webhook reçu et vérifié, un remboursement, une annulation d'abonnement. | **humain** |
| 10 | **Premier mois réel sur un compte témoin**, planche regardée par une personne avant d'ouvrir aux autres. | agent génère, **humain** regarde |

### Les variables, et leur portée exacte

| variable | portée | qui la pose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | build + navigateur | agent |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build + navigateur — publique par construction, protégée par la RLS | agent |
| `NEXT_PUBLIC_SITE_URL` | build + navigateur | agent |
| `SUPABASE_SERVICE_ROLE_KEY` | **serveur uniquement** — contourne la RLS | **humain** |
| `ANTHROPIC_API_KEY` | **serveur uniquement** ⚠ lue par la ROUTE, pas par le client : une clé posée dans le shell d'un script ne sert à rien à `/api/briefs/[id]/generate`, qui tourne dans le processus Next. C'est ce qui a fait échouer trois générations de kit en silence le 2026-09-21. | **humain** |
| `CRON_SECRET` | serveur uniquement — sans elle les quatre `crons` répondent 404 | **humain** |
| `RESEND_API_KEY`, `EMAIL_FROM` | serveur uniquement | **humain** (clé), agent (adresse) |
| `CONTENT_COPY_MODEL` | serveur — défaut si absente | agent |
| `CONTENT_IMAGE_MODEL`, `CONTENT_IMAGE_QUALITY`, `CONTENT_IMAGE_QUALITY_CEILING`, `OPENAI_API_KEY` | ⚠ **à NE PAS poser.** Le chemin des visuels custom n'est câblé à aucun écran (F6). Les poser armerait une dépense qu'aucune interface ne déclenche. | personne |
| `CONTENT_GENERATION_ARMED` | serveur — **c'est le seul drapeau d'armement.** `content_pipeline_enabled` n'existe pas, dans aucun des deux dépôts (F7) | **humain** décide du moment |

### Ce qui reste vrai quoi qu'il arrive

* aucun appel OpenAI, aucun visuel custom, tant que F6 n'est pas tranché ;
* la clé Anthropic ne s'écrit dans aucun fichier — ni `.env.local`, ni script
  commité, ni log, ni capture ;
* un mois qui ne passe pas `checkMonth` n'est jamais livré (voir
  `lib/content/month-checks.ts`), et le pipeline sort en erreur plutôt que de
  publier un mois dégradé.

## F15 — ⚠ AUCUNE MESURE DE CE PIPELINE NE REGARDE UNE IMAGE

**Six mois réels ont été générés le 2026-09-21 pour en obtenir un bon. Quatre
des six affichaient un entonnoir PARFAIT** — 30 écrits, 30 visuels, zéro
pénurie, zéro repli — et trois d'entre eux étaient mauvais :

* `wren.ashcombe` : teintes de marque à pleine saturation sur dix-neuf cartes,
  un titre arrêté sur « you get », un nom d'axe posé hors de sa bande ;
* `perrin.vale` : **5 archétypes sur 11**, six icebergs identiques, onze
  phrases seules ;
* `marlow.quint` : deux cartes portant le même titre.

Chacun de ces défauts a été trouvé en REGARDANT la planche. Aucun n'est
visible dans `funnel.json`, aucun ne fait échouer une suite, et le pire des
trois — l'effondrement du mélange d'archétypes — se lisait dans les mesures
comme une AMÉLIORATION, puisque la pénurie avait disparu.

**Ce qu'il faut décider :**

1. un contrôle automatique du MÉLANGE : aucun archétype au-delà de N % d'un
   mois, et au moins K archétypes distincts sur 30 posts. C'est le seul de ces
   défauts qui se calcule sans regarder une image ;
2. qui regarde les planches, et quand. Le contrôle indépendant décrit dans
   `design/preview-2026-09-21c/README.md` a trouvé en une passe ce que quatre
   entonnoirs verts avaient laissé passer — mais il n'est lancé à la main que
   parce qu'un cahier des charges le demandait ce jour-là ;
3. ⚠ **la variété d'un mois a longtemps été un effet de bord de la pénurie.**
   Tant que la banque était maigre, le tirage tombait sur d'autres archétypes
   faute de stock. Remplir la banque a révélé le défaut au lieu de le corriger.
   Toute mesure de qualité qui s'améliore quand une ressource se raréfie est à
   relire.

## F13 — ⚠ LA BANQUE DE SUJETS SE TARIT POUR LA SIXIÈME PRATICIENNE D'UN SEGMENT

**Mesuré le 2026-09-21, pas déduit.** Au moment de générer un mois pour le
sixième compte de test — même modalité (EMDR), même État (CA) que les cinq
précédents — la banque contenait **118 sujets dont 2 tirables**.

Ce n'est pas un artefact du bac à sable. `next_topic_for_kit` bloque tout sujet
assigné dans les 90 jours à une AUTRE utilisatrice du même État et de la même
modalité. C'est exactement ce que la fenêtre existe pour faire : deux
thérapeutes EMDR de Californie ne doivent pas publier le même post le même
mois. La conséquence arithmétique est que le stock nécessaire croît avec le
nombre d'abonnées d'un segment, et qu'il n'est dimensionné nulle part.

**Ce qu'il faut décider avant d'ouvrir un segment à plus de cinq abonnées :**

1. combien de sujets par segment pour `N` abonnées à 30 posts/mois sur une
   fenêtre de 90 jours — l'ordre de grandeur est `N × 90` et personne ne l'a
   posé par écrit. ⚠ **Et il faut le multiplier par trois** : mesuré sur la
   banque réelle, le dédoublonnage refuse environ 40 % des sujets tirés, parce
   que la banque elle-même produit des titres qui se recouvrent — tous écrits
   depuis les mêmes trois thèmes de segment. Un sujet refusé sort de la banque
   pour 90 jours comme les autres ;
2. qui remplit la banque, et quand. Aucun travail de fond ne la remplit
   aujourd'hui : `10-topic-bank.ts` est un script de harnais, pas un `cron` ;

### Le dimensionnement, chiffré

`stock = N × 90 × 3` — `N` praticiennes du segment, 90 jours de fenêtre
anti-collision, ×3 pour les ~40 % de sujets que le dédoublonnage refuse au
tirage (la banque produit des titres qui se recouvrent : ils sortent tous des
mêmes trois thèmes de segment).

**Coût par sujet, mesuré aujourd'hui** sur trois remplissages réels —
122 sujets pour 0,343 $, 128 pour 0,374 $, 249 pour 0,732 $ — soit 499 sujets
pour 1,449 $, **0,00290 $ le sujet**, en Haiku 4.5, appels synchrones. En
Batch API le prix tombe de moitié : ces chiffres sont un plafond, pas une
estimation basse.

| praticiennes du segment | stock nécessaire | coût de génération |
|---|---|---|
| 5 | 1 350 sujets | **3,92 $** |
| 20 | 5 400 sujets | **15,66 $** |
| 40 | 10 800 sujets | **31,32 $** |

Pour mémoire, la banque du bac à sable a demandé **cinq remplissages pour
atteindre 295 sujets tirables** sur deux segments, et elle s'est vidée à
chaque mois généré : douze mois réels l'ont traversée en une journée.

**Seuil d'alerte** : quand le stock TIRABLE d'un segment — les sujets ni
assignés, ni bloqués par la fenêtre — descend sous `N × 90`, soit le tiers de
la cible, il reste de quoi servir un mois par praticienne et plus aucune marge
pour les refus. C'est là qu'un remplissage doit partir, pas quand la banque
est vide : un mois généré sur une banque à sec sort court, et **rien dans le
produit ne le signale aujourd'hui** à l'abonnée.

La requête qui le mesure :

```sql
select s.id, s.modality_id, s.persona_id, count(t.id) as tirables
  from public.content_segments s
  join public.content_topics t on t.segment_id = s.id
 where t.ethics_reviewed_at is not null
   and (t.expires_at is null or t.expires_at > now())
   and not exists (select 1 from public.topic_assignments a where a.topic_id = t.id)
 group by 1, 2, 3;
```


3. ce que le produit RÉPOND quand la banque est vide. Aujourd'hui le tirage
   rend moins de candidats que demandé, le mois sort plus court, et rien ne le
   signale à l'abonnée.

⚠ **Et le symptôme était masqué.** `10-topic-bank.ts` comparait ses cibles au
nombre de sujets EXISTANTS, pas disponibles : il répondait « the bank is
already at target » sur une banque intégralement bloquée. Corrigé par
`--scale`, mais le fond reste : *exister* et *être tirable* sont deux choses,
et c'est la seconde qui fait un mois.

## F14 — ⚠ LA GÉNÉRATION DE KIT N'EST INSCRITE DANS AUCUN LEDGER

`credit_ledger` enregistre `post_generation` et `regeneration` avec leur coût
réel. La génération d'un kit de marque — `/api/briefs/[id]/generate`, qui est
un appel payant et pas le moins cher — n'y figure pas, et aucune autre table ne
la porte (`generation_runs`, `ai_usage`, `model_calls` n'existent pas).

Conséquence directe, constatée ce jour : le coût d'une session ne peut pas être
lu en base. Le total rapporté pour le 2026-09-21c additionne le ledger
(0,11 $) et ce que les scripts IMPRIMENT (banque de sujets, 0,34 $) — les cinq
générations de kit de la journée ne sont chiffrées nulle part.

Le cahier des charges du 2026-09-21 demandait que « `credit_ledger` enregistre
chaque appel payant avec son coût réel, qu'il aboutisse ou non ». C'est fait
pour le pipeline de contenu. Ça ne l'est pas pour le kit.

## F11 — ✅ RÉSOLU LE 2026-09-21 — le premier rendu réel a été produit

**La clef était là cette fois**, sous le nom `EKLIO_ANTHROPIC_API_KEY`, passée
à chaque commande et écrite dans aucun fichier. Les six prérequis listés plus
bas ont tous été faits, dans l'ordre, et le mois existe :

| prérequis | ce qui s'est passé |
|---|---|
| 1. la clef | présente ; appel minimal HTTP 200 avant toute dépense |
| 2. les 147 migrations | rejouées, 96 fichiers de test SQL, **0 échec** |
| 3. le compte de test | Rowan Mercier, LMFT, EMDR, burnout au retour au travail, Oakland CA — kit complet, direction choisie, check-in rempli |
| 4. la banque, ≥ 26 par segment | **49 sujets** : 26 pour `high_functioning`, 23 pour `crossroads` |
| 5. le mois réel, sans visuels custom | **16 posts sur 30**, en Batch, aucun appel OpenAI |
| 6. le coût lu, jamais recalculé | lu dans `usage` et dans `credit_ledger` — **0,381 $ mesuré**, plafond 2 $ |

⚠ **Et `@playwright/test` a été installé en premier, comme cette fiche le
demandait.** Huit captures à 1440 px dans `design/preview-2026-09-21/`.

**Le rendu a trouvé neuf défauts, dont six sont corrigés.** Ils ont leur
propre document : **`FIRST_REAL_RENDER.md`**. Le plus lourd, pour qui ne lit
qu'une ligne : *l'écran de relecture n'avait jamais montré une carte entière —
il en rognait les deux tiers droits.*

⚠ **Ce qui reste bloquant pour une VRAIE mise en service**, et qui n'est pas
dans le code : `license_type_states.verified_at` est NULL sur les 240 lignes
d'une base fraîche, donc **aucun kit ne peut être généré dans aucun État**.
Quelqu'un doit lire les sites des boards. Voir défaut 1 du rapport.

---

## F11 (archive) — Le premier rendu réel d'un mois n'a pas pu être produit : pas de clef Anthropic

**Rencontré en** PHASE B du chantier « état dégradé et premier rendu réel »,
2026-09-21. **Arrêt demandé par le brief, et respecté : aucune fixture n'a été
substituée.**

⚠ **RENCONTRÉ UNE TROISIÈME FOIS le 2026-09-21**, sur un brief qui annonçait la
clef sous le nom `EKLIO_ANTHROPIC_API_KEY` — choisi pour qu'elle ne se
substitue pas à l'authentification de la session Claude Code elle-même. Ce nom
n'était pas davantage posé que l'autre :

```
$ env | cut -d= -f1 | grep -iE 'anthropic|eklio|api_key'
ANTHROPIC_BASE_URL     # le proxy de Claude Code, pas une clef
# EKLIO_ANTHROPIC_API_KEY : absente
# ANTHROPIC_API_KEY       : absente
# aucun .env, aucun /run/secrets, aucun ~/.eklio
```

La partie 2 n'a donc, pour la troisième fois, pas été tentée. Le blocage n'est
pas dans les dépôts : tout ce qui suit est prêt et vert.

```
$ env | grep ANTHROPIC
ANTHROPIC_BASE_URL=<posée — le proxy de Claude Code, pas une clef>
# ANTHROPIC_API_KEY : absente de l'environnement ET de tout .env
# (.env.example la porte vide, c'est un gabarit)
```

Rien de la partie B n'a été tenté : ni compte de test, ni banque de sujets, ni
mois généré, ni captures. Un rendu fabriqué depuis des doubles aurait
ressemblé exactement au vrai, et c'est le seul résultat qu'il fallait éviter
ici.

**Ce qu'il faut pour le produire, une fois la clef disponible** — et dans cet
ordre, parce que chaque étape dépend de la précédente :

1. `ANTHROPIC_API_KEY` dans l'environnement de la session. **Sans elle, rien
   de ce qui suit n'a de sens.**
2. Rejouer les **147** migrations sur la stack Postgres locale
   (`bash scripts/local-verify.sh` côté backend). ⚠ 146 jusqu'au
   2026-09-21 ; `20260921120000_a_post_can_be_asked_for` est la 147e.
3. Créer le compte de test — thérapeute fictive, EMDR, burnout au retour au
   travail, brand kit complet avec une palette réelle — et répondre au
   check-in mensuel.
4. Remplir la banque par le **vrai pipeline de génération de sujets**, au
   moins **26 sujets par segment** — le seuil mesuré en §10.8 du rapport
   d'implémentation. En dessous, le tirage épuise la banque au troisième mois.
5. Lancer la génération mensuelle réelle (Batch + prompt caching), **sans
   visuels custom** : ce chemin n'est câblé à aucun écran (F6) et demanderait
   en plus une `OPENAI_API_KEY`.
6. Lire le coût réel dans `credit_ledger`, jamais le recalculer.

⚠ **`content_pipeline_enabled` n'existe pas** — voir F7. Ce qui arme la
génération est `CONTENT_GENERATION_ARMED="true"` **plus** l'entrée
`vercel.json`, et en local seul le premier compte.

⚠ **ET CE NOM CIRCULE ENCORE DANS LES BRIEFS.** Le brief du 2026-09-21
demandait d'activer « les drapeaux (`content_pipeline_enabled`,
`CONTENT_GENERATION_ARMED`) » en local. Vérifié une fois de plus ce jour-là :

```
$ grep -rn content_pipeline_enabled --include='*.ts' --include='*.tsx' \
      --include='*.json' --include='*.sql' eklio-frontend eklio-backend
# aucun résultat
```

Il n'existe ni en TypeScript, ni en JSON, ni en SQL, dans aucun des deux
dépôts. Il n'y a qu'UN drapeau à poser, et c'est le second.

⚠ **Et il faudra un navigateur headless pour les captures.** Chromium est
présent dans l'environnement d'exécution (`PLAYWRIGHT_BROWSERS_PATH`), mais
`@playwright/test` n'est pas une dépendance de ce dépôt — l'ajouter est une
décision à prendre, pas un détail d'outillage. Le brief du 2026-09-21
l'accorde ; il n'a PAS été installé, parce qu'une dépendance ajoutée pour des
captures qui ne peuvent pas être prises n'est qu'un diff de plus à relire.
C'est la première commande à lancer le jour où la clef est là.
