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
