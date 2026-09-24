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

## F16 — ⚠ UN MOIS A ÉTÉ ÉCRIT AVEC LE BRIEF D'UNE AUTRE PRATICIENNE

**⚠ CETTE ENTRÉE A ÉTÉ RÉÉCRITE LE 2026-09-23. Le premier diagnostic était
faux**, et il était rassurant : on avait conclu à une identité inventée par le
modèle. La vraie cause est une clause `where` manquante, et elle est pire.

### Ce qui a été vu

Trouvé par l'évaluateur indépendant le 2026-09-21, sur une carte publiable.
Dans un carrousel du mois d'**Isla Thornbury**, une carte praticienne porte :

```
"Rowan Mercier Therapy"
"Evening slots open in October"
"rowan@rowanmercier.com"
```

Le pied de la même carte — et des trente-neuf fichiers du mois — dit « Isla
Thornbury Therapy ». On en avait conclu que le modèle avait fabriqué une
identité professionnelle complète.

### Ce qui s'est réellement passé

`20-month.ts` lisait le brief de la praticienne ainsi :

```ts
.from("project_briefs").select("practice_name, city, state, modality_ids, …")
.limit(1).single()          // ⚠ aucun .eq("project_id", …)
```

Il n'y a pas de filtre. Avec **quinze praticiennes en base**, cette lecture
rend toujours la PREMIÈRE ligne de la table — et la première ligne est
`rowan.mercier@eklio-test.invalid`.

⚠ **Chaque mois écrit depuis le 2026-09-21 l'a donc été à partir du brief de
Rowan Mercier** : son nom de cabinet, sa ville, son État, ses modalités.
« Rowan Mercier Therapy » sur le mois d'Isla Thornbury n'est pas une invention,
c'est **l'identité d'une autre praticienne, servie par une clause manquante**.
Le modèle n'a fabriqué que l'adresse e-mail, dérivée du nom qu'on venait de lui
tendre.

### ⚠ Et le contrôle était aveugle par construction

`checkInventedIdentity` reçoit son `practiceName` et sa liste d'autorisation de
**cette même lecture**. Il autorisait donc « Rowan Mercier Therapy » sur les
quinze comptes, et aurait signalé le vrai nom de chacune si elle l'avait écrit.

**Un filet nourri par la source qu'il surveille ne surveille rien.** C'est le
défaut de mesure le plus coûteux de la session : le contrôle était vert parce
qu'il regardait la fuite depuis l'intérieur de la fuite.

### Ce qui est corrigé, et ce qui ne l'était pas

Le brief se lit par `project_id`. Le test
`lib/content/__tests__/one-brief-one-practitioner.test.ts` pose la règle pour
tout le dépôt : **une lecture qui demande LE brief — celle qui finit en
`.single()` ou `.maybeSingle()` — doit nommer son projet.** Une lecture qui
balaie tous les briefs (le `cron` de relance) reste permise, et le test ne la
touche pas.

⚠ **Le produit n'avait pas ce défaut** : `lib/app/header-context.ts` et
`lib/images/context.ts` filtrent tous les deux par `project_id`. Le défaut
était dans le harnais seul — mais le harnais est la spécification du chemin
serveur, qui n'écrit pas encore de mois. **La règle doit tenir le jour où il
l'écrira.**

`checkInventedIdentity` reste : il refuse toute adresse, URL ou téléphone dans
un payload — ces informations vivent dans le profil, pas dans le contenu — et
tout nom de cabinet qui n'est pas celui du compte. **Mais il ne remplace pas la
liaison de données, et cette entrée dit pourquoi :** pendant deux jours, il l'a
remplacée en apparence.

⚠ **À refaire avant de conclure quoi que ce soit des mois enregistrés** : les
douze mois de preuve portent tous le nom, la ville et l'État de Rowan Mercier.
Aucune conclusion sur la personnalisation ne peut s'appuyer dessus.

## F17 — ⚠ CE QUE DEVIENT UN LOT INTERROMPU

**Mesuré, pas supposé : 0,81 $ d'appels déjà payés ont été jetés le
2026-09-23.** Un remplissage de banque accumulait 695 réponses en mémoire et
insérait à la fin ; PostgreSQL est tombé au 280ᵉ appel. La banque n'a pas
gagné un sujet.

Le même défaut existait à deux endroits de plus dans la génération mensuelle.

### Le cas qui coûte le plus cher

Un lot Batch est **facturé à la soumission**. Entre `batches.create` et la
première réponse il se passe vingt-cinq à trente minutes. Dans cette fenêtre,
l'argent est dépensé et le résultat n'existe nulle part chez nous — et
l'identifiant du lot ne vivait que dans une ligne de log. Un processus qui
mourait là ne pouvait même pas aller chercher ce qu'il avait payé : il fallait
re-soumettre, donc repayer.

### Ce qui est conservé, repris, perdu

| moment de l'interruption | conservé | repris | perdu |
|---|---|---|---|
| avant `batches.create` | rien à conserver | le tirage se refait | rien (rien n'est payé) |
| **pendant l'attente du lot** | l'identifiant, écrit avant l'attente | le lot est **rattaché**, pas re-soumis | rien |
| pendant la lecture des résultats | chaque réponse, écrite à l'arrivée | les réponses déjà écrites | au plus la réponse en cours |
| entre la génération et la publication | toutes les réponses et les crédits déjà soldés | tout, sans un appel de plus | rien |
| après `clearJournal` | les trente posts en base | — | — |

Un crédit déjà soldé est marqué dans le journal : **sans ce drapeau, une
reprise facture un second crédit pour un post déjà payé.**

### Ce que le journal ne fait pas

Il ne publie rien. Un mois ne s'écrit en base qu'une fois **entier et
contrôlé** — `checkMonth` ne peut pas juger un mélange sur vingt-neuf posts.
Le journal sépare donc deux choses qui étaient confondues : le TRAVAIL PAYÉ,
qui doit survivre à tout, et la PUBLICATION, qui doit rester atomique.

### ⚠ Ce qu'il faut pour la production

Le journal du harnais est un fichier, sous `.eklio-journal/`. C'est suffisant
pour un script qu'on relance à la main ; ça ne l'est pas pour Vercel, où le
système de fichiers ne survit pas à l'invocation.

Il faut donc une **table durable** avant d'armer la génération mensuelle :

1. `content_generation_runs` — une ligne par (kit, mois) : l'identifiant du
   lot, son état, l'horodatage de soumission. Écrite **avant** l'attente ;
2. `content_generation_results` — une ligne par sujet : la sortie du modèle,
   son `usage`, et si le crédit est soldé. Écrite **à l'arrivée** de chaque
   réponse ;
3. une reprise qui, au réveil, lit la ligne de `runs` et rattache le lot au
   lieu d'en créer un — un `cron` qui re-soumettrait à chaque réveil paierait
   le mois une fois par réveil ;
4. une purge : un lot Anthropic reste lisible 29 jours, donc une ligne plus
   vieille que ça n'est plus rattachable et doit être close explicitement.

### La migration est écrite, et elle n'est pas appliquée

`eklio-backend/supabase/migrations/20260923100000_a_paid_batch_survives_a_crash.sql`
porte les deux tables, leur `enable row level security`, leurs policies et le
`revoke all` — **dans le même fichier**, parce qu'une table créée dans une
migration et protégée dans la suivante est ouverte entre les deux. Elle porte
aussi `abandon_stale_generation_runs()` pour le point 4.

Elle a été **rejouée sur la base locale de vérification, jamais sur la
production** : elle part avec les autres à l'étape 3 de la mise en production.

⚠ **Les deux verrous, et pas un seul.** `enable row level security` plus une
policy qui refuse laisse le GRANT de table en place : `has_table_privilege`
répondrait encore vrai. Le dépôt révoque explicitement sur `stripe_events`,
`banned_phrases`, `comp_grants` et `on_demand_writes` pour cette raison, et
seul le second verrou se lit dans un audit de privilèges. Ces tables portent
des réponses de modèle non encore contrôlées et l'état d'un crédit : une
cliente qui pourrait y écrire pourrait marquer `settled` sur un sujet qu'elle
n'a pas payé.

⚠ **Rien de tout cela n'existe EN BASE aujourd'hui**, et la migration écrite
n'y change rien tant qu'elle n'est pas appliquée. `insight_runs` est la seule
table de ce genre, et elle ne couvre pas la génération de contenu. C'est
pourquoi **l'étape 7b de la mise en production est bloquante** : tant que ces
tables ne sont pas en base, `CONTENT_GENERATION_ARMED` reste à `false`, parce
qu'une génération mensuelle interrompue serait **intégralement reperdue et
repayée**.

## F18 — ⚠ LA BANQUE PAYAIT DES LIGNES QU'ELLE REFUSAIT D'ÉCRIRE

**Mesuré le 2026-09-23 : 224 sujets écrits pour 260 appels payés.** Les 36
manquants étaient **tous** des `practitioner_card`, tous refusés sur
« schema: a required field is missing ».

La cause est **une moitié de correction**. En interdisant au modèle d'inventer
une identité (F16), on a cessé de lui DEMANDER le contenu d'une carte
praticienne — ses lignes viennent du brief à la composition. On n'a pas cessé
de l'EXIGER de sa réponse : le validateur du script et la contrainte
`content_topics_payload_check` réclamaient toujours un `lines` de deux à
quatre phrases. On payait donc des lignes pour les jeter.

⚠ **Et rien ne le disait.** Le script comptait ses échecs pour le bilan final,
et ce remplissage-là a été interrompu avant sa fin : seize minutes de refus en
silence. Le premier échec de chaque MOTIF s'imprime désormais dès qu'il
arrive.

⚠ **Le défaut n'était pas que comptable.** Les 39 sujets déjà en banque
portaient des phrases écrites par un modèle pour une praticienne qui n'existe
pas — la matière même dont « Rowan Mercier Therapy » était faite. Une banque
qui détient des lignes de praticienne est une banque d'où une identité peut
ressortir. Elles ont été **vidées**, et
`content_topic_bank_payload_valid` exige désormais `{}`.

La contrainte de `content_items` **ne bouge pas** : une carte publiée sans ses
lignes est une carte vide. Les deux tables partageaient un validateur et
n'ont pas la même exigence ; elles en ont maintenant deux.

*Migration : `20260923110000_the_bank_never_holds_a_practitioners_lines.sql`,
rejouée en local, jamais appliquée à la production.*

## F19 — ⚠ CHAQUE ESSAI REFUSÉ RENDAIT LE SUIVANT PLUS PAUVRE

Trouvé le 2026-09-23 en lisant `20-month.ts` avant de compter les essais.

Un mois refusé sortait en erreur — c'est voulu, « un mois qui échoue n'est
jamais livré ». Mais le `throw` était placé **avant** le bloc qui rend à la
banque les sujets sur-générés non publiés et solde leurs crédits. Un essai
refusé gardait donc pour **quatre-vingt-dix jours** une vingtaine de sujets
qu'il n'avait pas publiés, et ne soldait aucune de leurs réservations.

⚠ **C'est F13 vu de l'intérieur.** On cherchait la cause de l'assèchement dans
le tirage — un mois de 23 posts, puis un de 16 — et elle était dans **l'ordre
de deux blocs**. Plus on réessayait, moins il restait pour réessayer.

Aucune suite ne pouvait le voir : les deux blocs existaient, chacun était
juste, et le script se terminait sur un `throw` attendu. Le test lit donc
**l'ordre**, qui était la seule chose fausse
(`scripts/local-render/__tests__/refused-gives-back.test.ts`).

⚠ **La restitution ne dépend pas du verdict** : ce qui n'a pas été publié n'a
rien coûté à la praticienne, qu'on livre ou qu'on refuse.

## F20 — ⚠ NEUF FOIS LA MÊME IMAGE, ET TOUS LES CONTRÔLES AU VERT

**Mesuré le 2026-09-23**, sur le premier mois tiré d'une banque enfin remplie.
Le mois a passé `checkMonth` en entier. La planche à 390px s'ouvre sur **neuf
cartes praticiennes identiques** : mêmes trois lignes venues du brief — « EMDR
/ Oakland, CA / Taking new clients » —, même dessin de porte, seul le titre
changeait.

**Aucun contrôle ne pouvait le voir**, et c'est ça qui compte :

* `mix.dominant` plafonne un archétype à 30 % du mois. **9 sur 30 font
  exactement 30,0 %** — le plafond au centième près ;
* `checkDuplicateTitles` compare les titres, et les neuf titres différaient.

Le défaut était **sous** le titre, dans le payload, où rien ne regardait.
C'est F15 encore une fois : l'entonnoir vert, la planche mauvaise. Ici la
mesure existait, elle était simplement posée sur la mauvaise grandeur.

### La cause

La carte praticienne **n'a pas de contenu propre** : ses lignes viennent du
brief et ne varient donc pas d'un post à l'autre. Elle ne peut pas prendre son
tour comme un archétype qui écrit quelque chose de neuf à chaque fois. Elle
est plafonnée à deux par mois.

⚠ **Et le plafond a d'abord été posé au mauvais endroit.** Placé dans la ronde
par famille, il ne tenait que sur le PREMIER des deux tirages : le rattrapage
qui complète le mois demande un sujet **sans nommer d'archétype**, et il en a
repris huit à l'essai suivant. Un plafond posé sur une seule des deux portes
n'est pas un plafond. Il vit maintenant dans `accept`, par où les deux passent.

### Le filet

`checkIdenticalPayloads` : **deux posts au même payload sont le même visuel**,
quoi que disent leurs titres. Plafond de deux, et un test tient le plafond du
TIRAGE en dessous ou à égalité de celui du CONTRÔLE — sinon chaque essai tire
ce que le contrôle refusera, et se condamne lui-même.

⚠ **Ce qu'il faut en retenir pour les autres archétypes** : tout archétype
dont le payload vient d'une source fixe (le brief, le bilan, un catalogue)
aura le même défaut le jour où la banque en portera assez. Le filet est
générique exprès.

## F21 — ⚠ UN MOIS DE QUINZE POSTS EST SORTI SANS UN SEUL CONSTAT

**Mesuré le 2026-09-23**, quatrième essai, sur une banque à sec. Le tirage n'a
rendu que 18 candidats pour 30 posts ; 15 ont été écrits ; le mois est sorti
**sans refus et sans erreur**.

Le rapport portait pourtant la ligne exacte :

```
"shortfall": [
  "statement: 5 of 18 (the bank had no more)",
  "simple: 6 of 18 (the bank had no more)",
  "varied: 7 of 18 (the bank had no more)"
]
```

⚠ **Mais un `shortfall` de rapport n'est pas un contrôle.** Rien ne refusait le
mois. La règle « un mois qui échoue n'est jamais livré » ne couvrait pas le cas
où ce qui échoue est le **NOMBRE** — et c'est le cas le plus simple à voir et
le seul que personne n'avait posé.

Un mois court n'est pas un mois imparfait : c'est **la moitié de ce qui a été
acheté**. `credit_quotas` accorde trente crédits `post_generation` par mois ;
en livrer quinze est une demi-livraison. Les mois de 23, 16 et 10 posts des
jours précédents étaient dans le même cas, et ont été lus comme des résultats.

`checkCount` passe désormais en PREMIER dans `checkMonth`. Aucun échange ne
peut le réparer — s'il manque des posts, le banc est vide par construction —
donc le constat sort du premier tour et le mois est refusé.

⚠ **C'est la troisième fois de la session qu'une grandeur mesurée et imprimée
n'était reliée à aucun refus** : le `shortfall` ici, les échecs comptés pour un
bilan jamais atteint (F18), les sujets rendus après un `throw` (F19).
**Imprimer une grandeur n'est pas la contrôler.**

## F22 — ⚠ ZÉRO CARROUSEL SUR QUATRE-VINGT-DIX POSTS LIVRÉS

**Mesuré le 2026-09-23** sur trois mois livrés, banque portant **23 carrousels
libres**. Pas un seul dans les trente visuels d'aucun des trois. Le carrousel
est pourtant le format que les onze références utilisent le plus, et c'est
celui sur lequel l'identité inventée de F16 était passée.

Ce n'était pas une cause, c'en était deux — et la première masquait la seconde.

### 1. L'ordre de tirage condamnait un format par son rang

Le rapport de rejet ne nommait que le titre. « Aucun carrousel tiré » et
« cinq carrousels refusés » se ressemblaient donc — et ils demandent deux
corrections opposées. **Le rapport nomme maintenant l'archétype**, et la
réponse est sortie tout de suite :

| famille | rang de tirage | rejets « redondant » |
|---|---|---|
| statement | 1er | 7 |
| simple | 2e | 15 |
| varied (dont le carrousel) | 3e | **23** |

`redundantAgainst` compare un titre à TOUS ceux déjà acceptés, **sans regarder
le format**. La famille tirée en dernier affronte les trente-six titres des
deux premières et perd. Ce n'était pas un manque de stock, c'était un ordre de
passage.

Les formats larges passent donc en premier (`DRAW_ORDER`). `single_statement`
a la forme la plus souple et le plus gros stock : c'est lui qui peut absorber
les rejets, pas le carrousel.

### 2. ⚠ Et chaque carrousel tiré était payé puis jeté

L'ordre corrigé, il restait zéro carrousel — et cette fois ils n'étaient plus
refusés au tirage mais à la validation, sur `payload_shape`. **Une sonde d'un
seul appel** a montré ce que le modèle rendait :

```json
{"cards": [...], "card_line": "...", "caption": "...", "alt_text": "..."}
```

`cards` au **premier niveau**. `o.payload` valait donc `undefined`, et
`parse(undefined)` rend `null`.

⚠ **Le carrousel est le seul archétype dont la forme emploie elle-même le mot
« payload »**, pour les cartes qu'il empile. Le modèle a lu le second et
aplati le premier. Les dix autres n'ont pas ce piège : l'enveloppe était
décrite une fois, dans le préfixe, et elle suffisait partout ailleurs.

Deux corrections, encore la cause et le filet :

* la consigne montre **l'enveloppe entière** et dit que les deux « payload »
  ne sont pas le même ;
* une sortie aplatie est **relevée**, pas jetée. Le contenu était juste ;
  seules les accolades étaient mal placées, et jeter un appel payé pour un
  niveau d'imbrication est le défaut qu'on répare. Le relevé est étroit
  exprès : la forme doit parser telle quelle, sinon le refus tient.

### Ce qu'il faut en retenir

⚠ **Un archétype peut disparaître complètement sans qu'aucun contrôle ne
bouge.** `mix.distinct` demande sept archétypes sur onze : un mois à dix
archétypes sur onze passe, et le onzième peut être absent depuis toujours.
Les trois mois livrés affichaient un entonnoir vert, un mélange conforme et
dix archétypes — et il manquait le format le plus important.

**La mesure qui l'aurait vu n'existait pas** : personne ne comparait la
composition livrée à la composition VISÉE. C'est la même leçon que F15, prise
par un autre bout.

## F23 — ⚠ UN IDENTIFIANT DE LOT SANS SA LISTE DE SUJETS NE SE REPREND PAS

**Rencontré en vrai le 2026-09-23, pas imaginé.** Une commande interrompue a
laissé un lot soumis — donc **payé** — et la reprise l'a bien rattaché. Puis
elle a **refait son tirage**.

Les deux ensembles se sont trouvés identiques, et le mois est passé. Pas par
conception : `next_topic_for_kit` trie par `created_at desc, id`, donc deux
tirages consécutifs sur la même banque rendent la même chose.

⚠ **C'est une coïncidence d'ordonnancement, pas une garantie.** Un sujet
ajouté par un remplissage, un sujet expiré, un sujet pris par une autre
praticienne entre les deux — et la reprise aurait payé un lot dont elle ne
savait plus lire les réponses. Le mois serait sorti vide en ayant tout dépensé.

C'est le défaut de F17 d'un cran plus fin : **on avait sauvé ce qu'il fallait
pour RETROUVER le travail payé, pas ce qu'il fallait pour le RECONNAÎTRE.**

La liste des sujets part donc dans la **même écriture** que l'identifiant, et
la reprise fait foi du lot :

* les sujets du tirage frais qui n'y sont pas sont **rendus** à la banque —
  sinon chaque reprise doublerait ce qui en sort ;
* si un sujet du lot n'est plus tirable, la reprise **s'arrête** au lieu de
  livrer un mois amputé. Effacer `.eklio-journal/` abandonne alors un lot déjà
  payé : c'est une décision, et le message le dit.

⚠ **Le même champ manque aux tables serveur de F17.** `content_generation_runs`
porte `batch_id` ; `content_generation_results` porte une ligne par sujet,
**écrite à l'arrivée** — donc vide pendant les vingt-cinq minutes où la
question se pose. La migration doit écrire les lignes de `results` (sans
`result`) **à la soumission**, en même temps que le `run`.

## F24 — ⚠ DIX ESSAIS POUR UN MOIS QUI PASSE TOUS LES CONTRÔLES

**C'est le chiffre que le cahier des charges demandait**, et il faut le lire
avec ce qui l'accompagne : *les contrôles ont changé sept fois pendant les dix
essais*, toujours dans le sens du serrage. Un essai n'a donc pas affronté la
même porte que le suivant.

| # | compte | verdict | motif |
|---|---|---|---|
| 1 | imogen.hale | passé, **puis abandonné** | 9 cartes praticiennes identiques — F20, invisible aux contrôles d'alors |
| 2 | maren.okafor | refusé | `mix.distinct`, `mix.dominant`, `mix.loneSentence` — tirage à 30 faute de banque |
| 3 | orin.fenwick | refusé | `mix.samePayload` (8 cartes identiques), `text.echo` |
| 4 | lysa.brandt | passé à **15 posts**, puis abandonné | F21 : rien ne refusait un mois court |
| 5 | teo.marrow | **passé** | — mais zéro carrousel (F22) |
| 6 | wilder.nance | **passé** | — zéro carrousel |
| 7 | edda.linnet | **passé** | — zéro carrousel |
| 8 | fable.ostrow | passé à **29 posts**, puis abandonné | un insert refusé par la déontologie, jamais recompté |
| 9 | rue.calloway | refusé | `month.short` (21/30), `mix.dominant` |
| 10 | **odile.marchetti** | **LIVRÉ** | 30 posts, 48 volets, 4 carrousels, 10 archétypes |

### Ce que le chiffre dit vraiment

⚠ **Quatre des dix essais sont « passés » sur des contrôles qui les auraient
refusés une heure plus tard.** Trois défauts majeurs — neuf visuels identiques,
un mois de quinze posts, un mois de vingt-neuf — sont sortis avec un entonnoir
entièrement vert. Aucun n'a été trouvé par une suite : ils l'ont été **en
regardant la planche** et **en lisant le rapport de rejet**.

**Un mois livré tous les trois essais n'est pas tenable** — et ce n'est même
pas la bonne inquiétude. La bonne est celle-ci : *le taux de passage ne
mesurait pas la qualité, il mesurait la sévérité des contrôles du moment*.

### Ce qu'il faudra remesurer

Les quatre derniers essais (7 à 10) ont tourné sur des contrôles proches des
actuels : **trois passés, un refusé**. C'est l'estimation la moins mauvaise
qu'on ait — **environ 1,3 essai par mois livré** — et elle repose sur quatre
points, ce qui ne suffit pas. ⚠ **À remesurer sur dix essais consécutifs sans
changer un seul contrôle**, avant de dimensionner quoi que ce soit dessus (et
F13 dimensionne la banque dessus).

### Ce que chaque essai coûte

| | par essai |
|---|---|
| appels au modèle | 54 candidats, chemin Batch |
| argent | **0,047 $ à 0,093 $** — moyenne **0,072 $** |
| banque | **~30 sujets**, livré ou refusé (F13) |

⚠ **L'argent n'est pas le facteur limitant, la banque l'est.** Dix essais ont
coûté 0,72 $ et **300 sujets**, soit plus que ce qu'un remplissage à 0,42 $
produit. C'est la banque qu'il faut dimensionner sur le nombre d'essais, pas le
budget.

## F25 — ⚠ LE CHEMIN BATCH NE RÉSERVAIT AUCUN CRÉDIT

**Mesuré le 2026-09-23 en faisant les comptes de la session** : dix mois
générés, trois cents posts écrits, et `credit_ledger` n'avait pas gagné **une
seule ligne**.

`reserve()` n'était appelé que dans la branche **synchrone**. La branche Batch
composait, écrivait et livrait sans jamais consulter `credit_quotas`.
`quotaRefusals` valait 0 dans les dix rapports — non parce que le quota tenait,
mais parce que personne ne le consultait.

⚠ **ET C'EST LE CHEMIN DE PRODUCTION.** Le synchrone ne sert qu'au **premier**
mois d'un compte — « une nouvelle abonnée n'attend pas trente minutes ». Tous
les mois suivants passent par le lot. Le quota de trente crédits
`post_generation` n'était donc appliqué qu'**une fois par praticienne, à
l'inscription, et jamais ensuite**.

La réservation se fait avant `batches.create` : un lot est facturé à la
soumission, donc réserver après serait réserver pour une dépense déjà faite. Un
refus de quota **retire le candidat du lot** plutôt que d'arrêter le mois — on
ne paie pas un appel pour un post qu'on n'a pas le droit de livrer.

⚠ **Même famille que F18, F19, F21 et F23** : la grandeur existait, elle était
juste, et elle n'était branchée que d'un côté. C'est le motif le plus fréquent
de la session, et aucune suite ne le voyait, parce que chaque moitié était
correcte prise seule.

**À vérifier avant d'ouvrir la facturation** : que `credit_ledger` gagne trente
lignes par mois généré, sur le chemin Batch comme sur le synchrone. La requête
est d'une ligne, et elle n'avait jamais été posée.

```sql
select date_trunc('month', created_at) as mois, count(*)
  from public.credit_ledger group by 1 order by 1 desc;
```

## F26 — ⚠ LA NOTATION INDÉPENDANTE DU MOIS LIVRÉ, ET CE QU'ELLE TROUVE

Une seule passe, sans tour de correction, sur le mois d'`odile.marchetti`
(30 posts, 48 volets) — le mois qui passe TOUS les contrôles automatiques.

| critère | note brute |
|---|---|
| Élaboration | **1,80 / 5** |
| Lisibilité à 390 px | **3,10 / 5** |
| Variété visuelle | **1,60 / 5** |
| Qualité des illustrations | **2,20 / 5** |
| Typographie | **2,40 / 5** |
| Couleur | **2,90 / 5** |
| Écriture | **1,40 / 5** |

⚠ **Un mois au vert sur toutes les barrières automatiques note 1,4 sur 5 en
écriture.** C'est F15 énoncé en chiffres : *les contrôles mesurent ce qu'on a
su formuler, pas ce qu'une lectrice voit.*

### Les défauts vérifiés en base, un par un

**1. Quatre titres s'arrêtent avant leur sens.** Vérifié : « Success masks an
overdriven » (27 car.), « When life changes without » (25), « High performance
masks held » (27), « The thing that works costs » (26) — **tous sous la limite
de 30 caractères**. Ils n'ont donc PAS été coupés par `clampCardLine` : le
modèle les a écrits ainsi, et `checkDangling` les a laissés passer.

⚠ **Le trou est dans ma liste, et je l'y ai mis.** `DANGLING` avait été réduit
aux articles, `of/to/than`, conjonctions non adverbiales et relatifs, parce que
l'anglais laisse légitimement une préposition en fin de proposition relative
(« information to work with »). Mais « When life changes without » n'a pas de
relative : la différence est **grammaticale, pas lexicale**, et un contrôle qui
ne regarde que le DERNIER MOT ne peut pas la faire. « Success masks an
overdriven » est pire encore : le dernier mot est un adjectif, et ce qui
manque est le nom qu'il qualifie — deux mots avant, il y a « an ».

**2. Deux volets identiques à l'intérieur d'un même carrousel.** Vérifié : le
carrousel « Rest does not look productive » empile
`single_statement, surface_and_beneath, single_statement, surface_and_beneath,
single_statement`. Les deux `surface_and_beneath` n'ont pas d'énoncé propre,
donc chacun **affiche le titre du carrousel** — même phrase, même pentagone,
même mise en page, aux volets 2 et 4 d'un même post. Idem pour « Your body
knows what you deny ».

⚠ **`checkIdenticalPayloads` ne regarde pas DANS un carrousel.** Il compare les
payloads de posts ; un carrousel n'a qu'un payload, et la répétition est à
l'intérieur.

**3. Une affirmation clinique fausse est passée.** « Efficiency can become
trauma. », sous le surtitre `BEHIND THE PRACTICE`, signée par une clinicienne
EMDR. `checkEthics` ne l'a pas vue.

**4. Un titre de livre non attribué.** « Your body keeps score of what rest
meant… » — *The Body Keeps the Score*, dans la voix de la praticienne, sans
source.

**5. Deux volets de clôture vendent des rendez-vous.** « October evening slots
now open for those learning to unfreeze. » et « Evening slots opening in
October. » ferment deux carrousels différents.

**6. Neuf apostrophes droites** (U+0027) dans un empattement de display à
90 px. Comptées en base.

**7. Un acronyme inventé, à une lettre de la modalité.** `lettered_technique`
fabrique sa mnémonique depuis les initiales de ses tuiles : « EMP », « EMD »,
« FTG ». **« EMD » sur une carte EMDR se lira comme une faute de frappe.**

### Ce que la mesure nuance

* **« La couverture d'illustration est le problème » — non, plus maintenant.**
  Mesuré sur ce mois : 24 volets sur 48 portent une figure, couverture moyenne
  **49,4 %** de la bande contenu, minimum **9,6 %**, plancher 9 %, **aucun en
  dessous**. Le reproche d'élaboration ne porte plus sur la TAILLE du dessin —
  il porte sur ce qu'il y a SOUS le titre : les tuiles sans glose. C'est un
  autre défaut que celui corrigé au tour précédent, et il fallait la mesure
  pour le dire.
* **« comparison_pair n'a aucune illustration » — faux.** Son
  `illustrationZone` vaut `content` : les bulles SONT son illustration.
  L'observation juste est que seules les deux tuiles hautes reçoivent une
  queue, ce qui se lit comme un défaut de rendu.
* **« La mnémonique est sous le plancher » — non.** `smallestInContent` la
  tient à 30 px au canvas, soit **10,83 px à 390**, c'est-à-dire AU plancher.
  ⚠ **Mais deux planchers se contredisent** : `TYPE.mono.floor` vaut **22**,
  soit 7,9 px à 390. Seul `smallestInContent` empêche aujourd'hui une mono de
  descendre là. Un chemin qui poserait de la mono dans la bande contenu sans
  passer par l'échelle publierait du 7,9 px.
* **« Or et rose se confondent » — la mesure confirme le chiffre, pas le
  seuil.** ΔE76 = **15,14**, contre un plancher de 15 : au centième près. Le
  plancher avait été posé comme *le minimum atteignable*, jamais comme *le
  minimum perceptible*, et ces deux choses ont été confondues.
* **« La tuile haute n'a pas de bord » — juste, et l'exclusion est à moi.**
  Pierre contre papier : ΔE76 = **9,82**. `checkTints` exclut délibérément la
  paire papier/teinte. Cette exclusion est maintenant montrée fausse.

### Ce qu'il faut en tirer

⚠ **Aucun de ces sept défauts n'aurait été trouvé par une suite de tests.** Ils
l'ont été en REGARDANT la planche. Le mois est au vert sur quinze contrôles
bloquants et il n'est pas publiable.

**Les contrôles à écrire, dans l'ordre de gravité** — aucun n'existe :

1. un titre qui s'arrête avant son sens (grammatical, pas lexical) ;
2. deux volets identiques DANS un carrousel ;
3. une affirmation clinique qui n'est pas dans le catalogue déontologique ;
4. une citation d'ouvrage non attribuée ;
5. un volet de clôture qui vend un créneau ;
6. une apostrophe droite ;
7. une mnémonique fabriquée depuis des initiales.

## F27 — ⚠ « BRANCHÉ D'UN SEUL CÔTÉ » : LA CLASSE, ET SON RECENSEMENT

Sept occurrences maintenant, toutes de la même forme : **une grandeur juste,
calculée, que personne ne lit** — ou lue à un endroit où elle n'est pas
produite.

| # | la grandeur | ce qui manquait |
|---|---|---|
| F18 | les échecs du remplissage de banque | comptés pour un bilan que l'interruption n'a jamais atteint — 36 appels payés jetés en silence |
| F19 | les sujets sur-générés rendus | le bloc était **après** le `throw` du refus |
| F21 | `shortfall` | imprimé depuis toujours, relié à aucun refus — un mois de 15 posts est sorti sans constat |
| F23 | `batch_id` | sauvé **sans** la liste de sujets qui le rend lisible |
| F25 | `reserve_credit` | appelé sur la branche synchrone seulement, jamais sur Batch |
| **F27a** | `response.usage` | **jeté** par `oneLine` et par `callGeneration` : le coût de tout appel produit, thèmes, légendes, textes alternatifs, kit |
| **F27b** | `ethicsFlags` | une ligne de rapport — le post partait en base quand même |

⚠ **Chaque moitié était juste.** Aucune suite ne pouvait le voir : un test
regarde un module, et le défaut est ENTRE deux.

### Le recensement, fait à la requête plutôt qu'à l'œil

Trois endroits produisaient sans consommateur, et deux ont été trouvés par le
test lui-même le jour où il a été écrit :

* `judgeUsage` — le juge de complétude, ajouté le 24, absent du rapport ;
* `themesUsage` — la dérivation des thèmes, absente du rapport ET du total ;
* la liste des genres de crédit, écrite dans **trois** tables
  (`credit_ledger`, `credit_quotas`, `credit_balances`) et modifiée dans une.
  La requête qui les trouve toutes tient en une ligne et n'avait jamais été
  posée :

```sql
select conrelid::regclass, conname from pg_constraint
 where pg_get_constraintdef(oid) like '%post_generation%';
```

### Le test qui tient la jonction

`scripts/local-render/__tests__/nothing-is-wired-on-one-side.test.ts`.

⚠ **Il trouve les compteurs DANS LA SOURCE, il ne les liste pas.** Une liste
écrite à la main ne grandit pas quand quelqu'un ajoute un appel payant — et
c'est exactement ce qui venait d'arriver deux fois. Le test exige de chaque
accumulateur qu'il soit dans le rapport **et** dans le total, vérifie que les
deux branches réservent, que les sujets sont rendus avant le refus, que le lot
part avec ses sujets, qu'une violation déontologique écarte le candidat.

### ⚠ ET LA RÈGLE DE F16, ÉNONCÉE

**Aucun contrôle ne tire sa référence de la source qu'il surveille.**

`checkInventedIdentity` recevait son nom de cabinet et sa liste
d'autorisation d'une lecture de brief non filtrée — la fuite même qu'il devait
attraper. Il autorisait donc le nom d'une autre praticienne sur les quinze
comptes, et aurait signalé le vrai nom de chacune.

Les trois contrôles qui prennent une référence ont été vérifiés :

| contrôle | sa référence | d'où elle vient |
|---|---|---|
| `checkInventedIdentity` | nom du cabinet, ville, État, modalités | le brief, lu par `project_id` ✓ |
| `checkAcronym` | les modalités de la praticienne | le brief ✓ |
| `checkTints` | la palette de direction | le kit, pas le SVG mesuré ✓ |

Les autres (`checkMix`, `checkDuplicateTitles`, `checkEcho`,
`checkIdenticalPayloads`, les sept de F26) ne comparent que le contenu à
lui-même : ils n'ont pas de référence externe à corrompre.

### ⚠ Ce qui reste ouvert

**Aucun chemin PRODUIT n'appelle `reserve_credit` pour une génération
mensuelle.** Le point d'étranglement SQL est juste, le plafond est tenu — et
c'est le harnais qui frappe à la porte. `runMonthForKit` ne réserve rien.
C'est la même forme, un cran plus haut : le garde existe, personne ne
l'appelle. Voir l'étape 8b de la mise en production.

## F28 — LA MESURE À CONTRÔLES GELÉS : DEUX MOIS LIVRÉS SUR DIX

**C'est le chiffre demandé, et c'est le premier qui veut dire quelque chose.**
Le précédent — dix essais pour un mois — ne valait rien : les contrôles avaient
bougé sept fois pendant, toujours en se serrant, donc le taux de passage
mesurait la sévérité de l'heure.

### Le protocole

Contrôles gelés au commit `8ef5b39`, dix comptes neufs, dix kits, banque
remplie **avant** de commencer (890 appels, 1,68 $, 1 252 sujets libres pour
un besoin mesuré de ~30 par essai). Dix essais lancés **en parallèle**.

### Le résultat

| essai | verdict | posts | motifs |
|---|---|---|---|
| pia.rosenthal | **LIVRÉ** | 30 | — |
| quill.marchand | **LIVRÉ** | 30 | — |
| lena.ashworth | refusé | 36 préparés | `text.borrowed` |
| noor.bexley | refusé | 36 préparés | `month.short` |
| kai.lindqvist | refusé | 35 préparés | `text.dangling`, `text.echo` |
| mira.calloway | refusé | 36 préparés | `text.dangling`, `text.unfinished` |
| oren.faulkner | refusé | 36 préparés | `text.dangling`, `text.unfinished` |
| rune.eberhardt | refusé | 23 préparés | six constats, banque à sec |
| sable.ingram | **n'a pas pu démarrer** | 0 tiré | banque épuisée |
| tova.lindgren | **n'a pas pu démarrer** | 0 tiré | banque épuisée |

**Deux mois livrés sur dix essais. Huit essais ont réellement tourné : deux
livrés, un sur quatre.** Coût : **0,89 $** pour les dix, soit **0,089 $ par
essai** et **0,45 $ par mois livré**.

### ⚠ Ce que les deux derniers disent, et qui compte autant

`sable.ingram` et `tova.lindgren` n'ont tiré **aucun candidat**. Dix
praticiennes du MÊME segment tirant en parallèle épuisent une banque de dix
mois : la fenêtre anti-collision retire à chacune ce que les neuf autres
viennent d'assigner.

⚠ **F13 dimensionnait la banque pour dix mois CONSÉCUTIFS, pas pour dix mois
SIMULTANÉS.** Ce n'est pas la même grandeur, et c'est celle qui compte en
production : un `cron` mensuel génère tous les mois d'un segment le même jour.
Le stock doit couvrir `N praticiennes × 72 candidats` en une fois, pas
`N × 30` étalés.

### Les refusés étaient proches

Six des huit ont préparé **35 ou 36 posts pour 30**, avec un banc réel, et
n'ont échoué que sur **un ou deux** constats — un mot suspendu, une recopie,
un titre d'ouvrage. Contre huit à dix constats par essai au premier tour.

⚠ **Aucun n'a été corrigé en relâchant un contrôle.** Entre les deux tours,
quatre causes ont été traitées côté GÉNÉRATION : la ponctuation normalisée au
point d'assemblage, le sigle nommé plutôt qu'inventé, le carrousel tiré deux
fois par tour, et 43 sujets de banque purgés parce qu'ils portaient un titre
d'ouvrage écrit avant que le contrôle existe.

### ⚠ Et un défaut que le mélange ne voit toujours pas

Le mois livré porte **zéro `single_statement`**. C'est l'exact miroir de F22 —
le carrousel absent — et pour la même raison : `mix.distinct` se contente de
sept archétypes sur onze, donc l'absence complète d'un format ne déplace aucun
chiffre. L'ordre de tirage a été inversé pour sauver le carrousel, et la
phrase seule, désormais tirée en dernier, a pris sa place dans le trou.

**Un plancher par format, et pas seulement un compte de formats.** Le
carrousel en a un depuis F22 ; les dix autres n'en ont pas.

## F29 — LA NOTATION DU MOIS LIVRÉ À CONTRÔLES GELÉS

Une passe, sans tour de correction, sur `pia.rosenthal` — le mois qui passe
les quinze contrôles **plus les sept de F26**, sans qu'un seuil ait bougé.

| critère | 2026-09-23 (odile) | 2026-09-24 (pia) |
|---|---|---|
| Élaboration | 1,80 | **2,20** |
| Lisibilité à 390 px | 3,10 | **3,30** |
| Variété visuelle | 1,60 | **2,10** |
| Illustrations | 2,20 | **1,80** |
| Typographie | 2,40 | **2,90** |
| Couleur | 2,90 | **3,10** |
| Écriture | 1,40 | **1,60** |

Six critères sur sept montent, d'environ un demi-point. **Aucun n'atteint 3,5.**
Les sept contrôles ont supprimé les défauts qu'ils nomment — plus une seule
apostrophe droite, plus un sigle inventé, plus de citation non attribuée, plus
de volet répété — et **l'écriture reste à 1,6**.

### Ce que la mesure confirme

* **« Looking stable. Burning »** — 23 caractères, donc **pas tronquée** : le
  modèle l'a écrite, et le juge de complétude l'a dite COMPLÈTE. C'est un vrai
  manque du juge, sur le seul cas où il aurait dû trancher.
* **« Competence can trap »** — 19 caractères, verbe transitif sans objet, même
  verdict du juge. Deux ratés sur une trentaine de lignes jugées.
* **Trois posts bâtis sur « X is not failure, it's information »** — vérifié en
  base. `redundantAgainst` compare les TITRES au tirage ; ces trois-là ont des
  titres différents et la même phrase.
* **« Body says no » sept fois** en libellé de bloc — aucun contrôle ne regarde
  la répétition d'un libellé À TRAVERS les posts.
* **Zéro `single_statement`, zéro `lettered_technique`** — déjà F28 pour le
  premier ; le second est la conséquence assumée du catalogue de techniques
  nommées, et il faut le dire ainsi plutôt que le découvrir.

### ⚠ Le surtitre porte un identifiant interne

La notation relève « ONLY ONE » et « A SOFT INVITATION » imprimés au-dessus
des cartes — un drapeau de pagination et un libellé d'intention, sur une carte
publiable. Je n'ai pas retrouvé leur origine dans le temps imparti.

**Ce que j'ai pu prouver est du même ordre et pire** : sur le chemin du
harnais, `eyebrowFor` reçoit `intent` brut et rend **« CORRECTAMYTH »** et
**« BEHINDTHEPRACTICE »** — les soulignés retirés, les mots collés. Le champ
attendait un LIBELLÉ (`angle_label`, « A soft invitation »), il reçoit un CODE.

⚠ **C'est encore la classe de F27** : une valeur juste, lue au mauvais endroit.
Et aucun des vingt-deux contrôles ne regarde la bande de surtitre.

### Ce que je n'écarte pas

Rien de substantiel. La seule nuance porte sur « EMDR for unwanted turning »,
« Competence can trap », « Your body learned before » : la notation les range
avec les phrases inachevées, et elles sont **syntaxiquement complètes**. Ce qui
leur manque est le SENS, et `text.unfinished` ne le mesure pas — c'est un
critère de plus à écrire, pas un faux positif de la notation.

## F30 — ⚠ LA BANDE DE SURTITRE : TROIS CAUSES, ET AUCUNE N'ÉTAIT CELLE QU'ON CROYAIT

La notation indépendante relève quatre surtitres sur deux planches publiables :
« CORRECTAMYTH », « BEHINDTHEPRACTICE », « ONLY ONE », « A SOFT INVITATION ».
F29 en avait retrouvé une cause sur deux et laissé l'autre ouverte faute de
budget. Les trois sont maintenant établies, et elles sont différentes.

**1. « CORRECTAMYTH », « BEHINDTHEPRACTICE » — un code dans un champ de
libellé.** `scripts/local-render/20-month.ts` passait `topic.intent` —
`correct_a_myth`, `behind_the_practice` — dans un champ nommé `angleLabel`.
Mise en capitales, la ponctuation tombe, le tiret bas avec, et les mots se
collent. ⚠ **Le chemin PRODUIT lisait le bon champ depuis le début** :
`content_item_json` joint `content_intents.label` et `lib/content/review.ts`
le passe. Une même fonction de rendu, deux appelants, un seul juste — et c'est
le harnais qui fabrique les planches qu'on note.

**2. « ONLY ONE » — un libellé de six mots dans une bande qui en tient
quatre.** ⚠ **Ce n'était pas un drapeau de pagination**, comme la notation
l'a lu. `content_intents` porte « You are not the only one » pour `normalise` :
six mots, vingt-quatre caractères. `eyebrowFor` retirait les mots outils —
you, are, not, the — et gardait les trois premiers restants. Il restait un
fragment **qui dit le contraire de la phrase dont il vient**, imprimé au-dessus
d'un diagramme à quatre blocs, sur la carte d'une clinicienne.

**3. « A SOFT INVITATION » n'était pas un défaut.** C'est le libellé `invite`,
rendu correctement. Il est noté ici pour qu'on cesse de le chercher.

### Trois verrous, parce qu'il y avait trois causes

| où | ce qui change |
|---|---|
| base | `content_intents.label` de `normalise` raccourci en « Not the only one », et une contrainte `check` refuse tout libellé au-delà de 4 mots / 22 caractères — la borne du rendu |
| rendu | `eyebrowFor` prend un libellé de catalogue **verbatim** s'il tient, et l'ABANDONNE s'il ne tient pas : refuser vaut mieux qu'imprimer un contresens |
| harnais | il lit le catalogue une fois et passe le **libellé**, plus le code |
| contrôle | `checkEyebrow` : 1 à 4 mots, 22 caractères, aucun identifiant interne, aucun mot collé, aucune valeur hors du catalogue |

⚠ **`checkEyebrow` lit la valeur COMPOSÉE, pas ses entrées.** Un contrôle qui
relirait `angleLabel` n'aurait jamais vu « CORRECTAMYTH », qui est ce que la
clinicienne, elle, a vu.

⚠ **Et sa référence vient de la base, pas des cartes.** Un contrôle qui
tirerait la liste des libellés autorisés des valeurs observées les
autoriserait toutes, « CORRECTAMYTH » compris (F16).

⚠ **Un mot collé se reconnaît sans liste.** « CORRECTAMYTH » ne colle pas les
mots du libellé (« Myth, gently corrected ») mais ceux du CODE : le contrôle
découpe le mot avec le vocabulaire des libellés ET des identifiants, et un mot
qui se découpe entièrement n'est pas un mot. C'est ce qui attrapera le prochain
code, celui qui n'existe pas encore.

⚠ **Un piège rencontré en l'écrivant** : comparer après avoir retiré les
espaces faisait de « BEHIND THE PRACTICE » — le libellé, correctement rendu —
le code `behind_the_practice`. Un code n'a pas d'espace ; c'est par là qu'on
les distingue, et c'est justement ce qui rend « BEHINDTHEPRACTICE »
reconnaissable.

## F31 — ⚠ DIX BORNES DE MÉLANGE, ET UNE SEULE SAVAIT DIRE « PAS ASSEZ »

`mix.dominant`, `mix.loneSentence`, `mix.identical` sont des PLAFONDS ;
`mix.distinct` se contente de sept archétypes sur onze. Un format pouvait donc
disparaître entièrement d'un mois livré sans déplacer un chiffre — et c'est
arrivé deux fois, aux deux bouts :

| date | ce qui manquait | ce qui l'a vu |
|---|---|---|
| 2026-09-23 | zéro carrousel sur soixante posts | rien — plancher `mix.carousel` ajouté après |
| 2026-09-24 | zéro phrase seule sur trente posts | rien |

⚠ **La seconde est la conséquence de la correction de la première.** L'ordre de
tirage a été inversé pour sauver le carrousel, et la phrase seule, désormais
tirée en dernier, a pris sa place dans le trou. Corriger format par format
déplace le trou.

### Le plancher est calculé, pas posé

Trois familles, donc un tiers visé chacune par le tirage ; le plancher en est la
moitié — **cinq sur trente**. Si une quatrième famille apparaît, la part visée
tombe à un quart et le plancher suit.

Mesuré sur les six mois enregistrés, et c'est la seule raison pour laquelle le
seuil vaut un demi :

| mois | statement | simple | varied |
|---|---|---|---|
| isla | 12 | 10 | 8 |
| marlow | 10 | 11 | 9 |
| perrin | 11 | 11 | 8 |
| wren | 11 | 14 | **5** |
| odile | 9 | 11 | 10 |
| **pia** | **2** | 20 | 8 |

Cinq sur six tiennent, `wren` **exactement** au plancher — le dépassement est
donc strict, comme pour `mix.dominant` et pour la même raison. Le sixième est
celui que ce plancher existe pour refuser.

⚠ **`pia` était à la fois le seul mois vert enregistré et le défaut.** Le
fichier qui affirmait « un bon mois passe encore » est devenu
`the-month-that-should-not-have-passed` : le plancher le refuse, et **aucun
autre contrôle n'a rien à dire**, ce qui est ce qui reste du garde-fou. Il
reste à geler un mois vert.

⚠ **Les familles vivent désormais du côté du contrôle, et le tirage les lit.**
Deux listes tenues à la main auraient divergé au premier archétype ajouté, et
le plancher aurait alors mesuré une composition que personne ne vise. Le poids
double du carrousel reste au tirage, où il a un sens.

## F32 — ⚠ LE MODÈLE N'AVAIT JAMAIS VU UN BON POST

Le préfixe ne portait que des RÈGLES — trente caractères, pas de promesse de
résultat, quatre mots par libellé, pas d'apostrophe droite — et une règle dit
ce qu'il ne faut PAS faire. La notation met l'écriture à 1,6 sur 5, trois
planches de suite, et les sept contrôles de F26 n'ont pas déplacé ce chiffre :
ils ont supprimé les sept défauts qu'ils nomment, exactement, et rien d'autre.

**Trois à quatre exemples par archétype**, choisis parmi les 701 posts de la
base par `scripts/local-render/15-examples.ts`, qui n'en écrit aucun :

1. les vingt-trois contrôles, entiers ;
2. le juge de complétude sur les lignes que le lexique ne tranche pas ;
3. aucune des formules que F29 a nommées ;
4. pas deux exemples du même archétype qui partagent une chaîne ou deux
   premiers mots.

⚠ **Seule la normalisation typographique leur est appliquée** — ce que la
chaîne applique à chaque post depuis. Tout le reste est écarté, jamais réparé :
un exemple retouché enseignerait une conformité que la production n'a pas
produite. Ce sont des **fixtures versionnées**, jamais livrées à personne, et
un test les repasse aux contrôles pour qu'elles ne pourrissent pas.

### ⚠ Deux défauts trouvés en les choisissant

**`judgeCompleteness` plafonnait à 1500 jetons.** Sur des lots de quarante
lignes la réponse dépassait, le JSON arrivait tronqué, `JSON.parse` levait — et
le juge rendait un verdict **vide**, qui ne refuse rien. Trois lots sur quatre
sont passés sans être jugés, **en silence**. ⚠ Le mutisme est le comportement
voulu (un juge en panne ne doit pas faire tomber un mois), et c'est exactement
ce qui rendait le défaut invisible.

**Le comparateur de ressemblance prenait `archetype_key` pour du texte.** Tous
les carrousels portent « single_statement » dans leur premier volet : le
premier retenu bloquait les sept autres, et l'archétype le plus important du
catalogue serait parti avec **un seul** exemple.

### La passe de révision

Elle relit les candidats **ensemble**, ce qu'aucun contrôle par post ne peut
faire, et réécrit ce qu'un lecteur verrait. Elle ne juge pas la conformité — le
code le fait, exactement, et son avis là-dessus est du bruit.

⚠ **Avant la composition, pas après** : le SVG est dessiné une fois, et c'est
lui qu'on publie. ⚠ **Avant le juge**, aussi, pour qu'il lise les lignes
révisées. ⚠ **Chaque réécriture repasse `validateCopy`**, là où les autres
réponses de modèle passent ; une ligne trop longue est écartée et non rognée —
`clampCardLine` a raison à l'écriture, où une ligne coupée vaut mieux que rien,
mais ici l'original tenait entier.

⚠ **`CONTENT_EXAMPLES=off` et `CONTENT_REVISION=off`** existent pour que
l'effet de chaque changement se mesure seul. Trois changements dans la même
session, et une note qui monte ne dit pas lequel a payé.

## F33 — ⚠ LA MESURE N'A PAS PU AVOIR LIEU : LE SOLDE DU COMPTE FOURNISSEUR S'EST ÉPUISÉ

**Ce n'est pas un plafond de session, et il ne faut pas le lire comme tel.** Le
plafond de la demande était de 8 $ ; la dépense réelle de la session est
d'environ **1,5 $**. Ce qui s'est arrêté est la facturation du compte
Anthropic :

```
invalid_request_error: Your credit balance is too low to access the Anthropic API.
```

### Ce qui a tourné, et ce qui n'a pas pu

| étape | état |
|---|---|
| remplissage de banque (490 sujets visés) | **250 écrits** (~0,72 $) puis coupure ; banque à 2 187 sujets, le plus bas archétype à 19 tirables |
| bras 1a — Sonnet seul | lot soumis, **72 requêtes en erreur, 0 réponse** |
| bras 1b — Sonnet + exemples | lot soumis, **72 en erreur, 0 réponse** |
| bras 1c — Sonnet + exemples + révision | lot soumis, **72 en erreur, 0 réponse** |
| mesure finale, dix mois | **pas lancée** — aucun appel ne passe |
| notation indépendante | **pas faite** — il n'y a pas de planche à noter |

⚠ **L'effet séparé de 1a, 1b et 1c n'est donc PAS mesuré.** Les trois
commutateurs existent, ils sont testés, et le protocole est écrit — un bras par
changement, même banque, même mois, lots en parallèle. Il ne manque que des
appels qui aboutissent. **Écrire un chiffre ici serait l'inventer.**

### ⚠ Ce que l'incident a appris, et qui vaut la dépense

Trois mensonges se sont enchaînés, et c'est le troisième qu'on lit en premier.

**1. Le motif d'échec : « schema », deux cent seize fois.** Le harnais rangeait
toute réponse non conforme sous « schema » — « le modèle a rendu une forme
invalide ». Il n'avait rien rendu du tout. ⚠ Un `sinon, schema` range sous le
seul motif qu'on sait nommer **tout ce qu'on ne sait pas nommer**, y compris ce
qui n'est pas de notre côté. Les motifs du fournisseur — `errored`, `expired`,
`canceled` — portent maintenant leur nom, et `not_json` aussi.

**2. Le verdict du mois : `month.short`.** Un mois court, donc un défaut de
génération. Il n'y avait pas eu de génération. Un lot qui se termine
`{"succeeded":0,"errored":72}` est maintenant signalé **à la fin du lot**, avant
qu'on relise quoi que ce soit : « ce n'est pas un défaut d'écriture ».

**3. L'attente d'un lot n'avait aucune borne.** `while (status !== "ended")`
toutes les quinze secondes, sans fin. Un lot qui n'aboutit jamais — compte
suspendu, lot expiré, identifiant rejoué — laissait le run tourner
indéfiniment, sans qu'aucune ligne ne le dise. Borne à quatre-vingt-dix minutes,
soit trois fois la durée observée sur six mesures, et l'erreur rappelle que le
lot est payé et que le journal le garde (F23).

### ⚠ Et deux défauts trouvés en préparant la mesure, qui l'auraient faussée

**La quota est mensuelle et vit dans le ledger, pas dans `content_months`.**
Deux essais ont été lancés sur des comptes « neufs » — aucun mois en base — dont
la quota d'octobre était déjà consommée par une session précédente. Ils ont
écrit **deux posts sur trente** et ont été refusés sur `month.short`. Choisir un
compte d'essai se fait sur le LEDGER, ou sur un mois neuf.

**Un essai refusé ne rapportait ni son entonnoir ni ses échecs.** Le chemin
LIVRÉ imprimait les deux ; le chemin refusé — le plus fréquent — ne les
imprimait pas. Donc ni la conformité au premier appel, qui est le chiffre que
cette session devait mesurer, ni la raison des vingt-huit posts manquants. Il a
fallu lire la base pour comprendre. ⚠ **Un essai refusé qui ne dit pas son
entonnoir n'apprend rien**, et les essais refusés sont trois sur quatre.

### ⚠ LA BANQUE EST PRÊTE, ET CE N'EST PAS LE REMPLISSAGE QUI L'A FAITE

Le remplissage s'est arrêté à 250 sujets sur 490. Ce sont les **assignations
orphelines** qui ont rendu la banque — `98-release-orphans.ts`, sur les deux
mois visés :

| mois | kits orphelins | sujets rendus |
|---|---|---|
| 2026-10-01 | 2 | 57 |
| 2026-11-01 | **24** | **858** |

⚠ **Neuf cent quinze sujets étaient assignés à des kits sans un seul post** —
le résidu de toutes les sessions d'essais précédentes, y compris les lots que
la coupure de facturation a laissés en plan. Personne ne les comptait, et ils
étaient retirés à tout le segment pendant quatre-vingt-dix jours.

Résultat, mesuré après le nettoyage, contre le seuil de **dix essais
simultanés** :

| archétype | tirables | seuil (N=10) |
|---|---|---|
| `concentric_control` | 127 | 67 |
| `surface_and_beneath` | 131 | 84 |
| `cycle` | 133 | 84 |
| `carousel` | 191 | 167 |
| `single_statement` | 530 | 367 |
| les six autres | 136 à 241 | 34 à 84 |

**Les onze passent.** La mesure finale à dix essais peut donc partir sans
remplissage — le coût de la banque, pour cette mesure-là, est nul.

⚠ **Et c'est une leçon de dimensionnement, pas seulement de ménage** : F13
compte ce qu'un essai CONSOMME, et suppose que ce qu'il n'utilise pas revient.
Ça ne revient que si quelqu'un le rend. Un run tué, un lot en erreur, une
session interrompue laissent leurs assignations en place, et le stock
« manquant » qu'on s'apprête à racheter est déjà là.

### Ce qu'il reste à faire, dès que le compte est rechargé

1. ~~finir le remplissage~~ — **inutile** : la banque passe le seuil pour dix
   essais simultanés sur les onze archétypes (voir ci-dessus) ;
2. trois bras, un par changement, sur trois comptes au ledger vierge pour le
   mois visé : `CONTENT_EXAMPLES=off CONTENT_REVISION=off`, puis
   `CONTENT_REVISION=off`, puis rien ;
3. la mesure finale : dix essais en parallèle, contrôles gelés, à comparer terme
   à terme avec F28 — **un mois livré pour quatre essais, 0,45 $ par mois livré,
   écriture 1,6** ;
4. la planche, puis une notation indépendante sans tour de correction.

## F34 — LA MESURE : 1 MOIS LIVRÉ POUR 1,12 ESSAI, ET L'ÉCRITURE PASSE DE 1,6 À 2,2

Contrôles gelés, banque remplie avant de commencer, dix essais lancés en
parallèle sur dix comptes neufs, mois 2027-01. Même protocole que F28, terme à
terme.

| | F28 — référence (Haiku) | F34 — cette session (Sonnet) |
|---|---|---|
| essais réellement tournés | 8 | **9** |
| mois livrés | 2 | **8** |
| **essais par mois livré** | **4,00** | **1,12** |
| coût par essai | 0,089 $ | 0,362 $ |
| **coût par mois livré** | **0,45 $** | **0,407 $** |
| conformité au premier appel | non mesurée | **48,2 %** (314 / 652) |

⚠ **Le coût par essai a quadruplé et le coût par mois livré a BAISSÉ.** C'est
tout le pari de la session : le taux de passage est passé de un sur quatre à
huit sur neuf, et il absorbe le surcoût du modèle.

| essai | verdict | conforme 1er appel | coût |
|---|---|---|---|
| corin.aldhelm | **LIVRÉ** | 36/72 | 0,3376 $ |
| dara.okonkwo | **LIVRÉ** | 34/72 | 0,3553 $ |
| devon.marrable | **LIVRÉ** | 36/72 | 0,3509 $ |
| edda.linnet | **LIVRÉ** | 36/72 | 0,3589 $ |
| esme.varga | refusé (`text.unfinished`, `text.echo`) | 32/72 | 0,3894 $ |
| fable.ostrow | **LIVRÉ** | 34/72 | 0,4204 $ |
| fionn.brackenridge | **LIVRÉ** | 34/74 | 0,3471 $ |
| gil.amaranth | **LIVRÉ** | 36/72 | 0,3469 $ |
| hana.torvald | **LIVRÉ** | 36/74 | 0,3496 $ |
| ilya.sandoval | **n'a pas démarré** — garde-fou | — | 0 $ |

⚠ **`ilya.sandoval` EST UN RÉSULTAT, PAS UNE PANNE.** Les neuf autres avaient
pris tout le `single_statement` tirable ; le garde-fou de banque a refusé
**avant toute dépense** en nommant l'archétype et la commande de remplissage.
Dans F28, le même cas — `sable.ingram`, `tova.lindgren` — produisait deux mois
qui ne tiraient aucun candidat, et rien ne le disait.

### ⚠ L'effet de 1a, 1b et 1c, séparément

Trois bras, un mois chacun, même code, même banque, même mois calendaire, un
commutateur de différence.

| | 1a seul | 1a + 1b | 1a + 1b + 1c |
|---|---|---|---|
| verdict | livré | refusé (`clinicalClaim`, `echo`) | livré |
| conformité 1er appel | 35/72 | 36/72 | 35/72 |
| coût | 0,3432 $ | 0,3247 $ | 0,3341 $ |

Et les notations indépendantes, sur les deux planches livrées :

| critère | `pia` (F29, Haiku) | 1a seul | 1a+1b+1c |
|---|---|---|---|
| Élaboration | 2,20 | 1,8 | 2,0 |
| Lisibilité à 390 px | 3,30 | 3,2 | 2,5 |
| Variété visuelle | 2,10 | 1,5 | 1,8 |
| Illustrations | 1,80 | 2,2 | 2,6 |
| Typographie | 2,90 | 2,8 | 2,2 |
| Couleur | 3,10 | 2,5 | 2,3 |
| **Écriture** | **1,60** | **2,3** | **2,2** |

**1a — le modèle. C'est lui, et lui seul, qui a bougé la note.** L'écriture
passe de 1,6 à 2,2–2,3 sur les deux planches, et le taux de passage de 1 sur 4
à 8 sur 9. Il coûte quatre fois plus par essai et moins par mois livré.

**1b — les exemples. Rien de mesurable. RETIRÉ.** La conformité au premier
appel vaut **48,6 %** sans eux (72 candidats) et **48,2 %** avec (652
candidats, neuf mois) : c'est la seule grandeur dure dont on dispose, elle est
bien échantillonnée du côté « avec », et elle ne bouge pas. Le mécanisme, ses
fixtures et ses tests restent en place, éteints — `CONTENT_EXAMPLES=on` les
rallume.

**1c — la passe de révision. Rien de mesurable non plus, et GARDÉE.** C'est un
jugement, pas une mesure, et il faut le lire comme tel. Elle réécrit deux à
cinq posts par mois, et chaque réécriture nomme un vrai défaut — « comparison
left incomplete in title », « duplicate labels EMDR work/The plan reused ». Or
**les deux notations désignent la répétition d'une carte à l'autre comme le
principal défaut d'écriture du mois**, et la passe est la seule chose du
système qui regarde les posts ENSEMBLE : la retirer laisserait ce défaut sans
propriétaire. Elle est sous-dimensionnée, pas inutile.

### ⚠ CE QUE CETTE MESURE NE PEUT PAS TRANCHER

Les deux notations ont été rendues par deux agents distincts. Sur des critères
que **ni les exemples ni la révision ne peuvent toucher** — la typographie, la
lisibilité, la couleur sortent toutes du moteur de composition, inchangé entre
les deux bras — elles s'écartent de **0,6 à 0,8 point**. L'effet cherché sur
l'écriture est de 0,1.

⚠ **Le bruit du notateur dépasse l'effet mesuré.** Ce qui est solide : le
passage de 1,6 à 2,2–2,3 contre la référence, qui est six fois plus grand que
cet écart. Ce qui ne l'est pas : la comparaison de 1b et 1c entre eux. Un
protocole capable de trancher demanderait plusieurs mois par bras et **le même
notateur sur tous**, ce qui n'a pas été fait ici et doit être dit.

### ⚠ ET UN MOIS VERT PORTAIT UNE PROMESSE D'EFFICACITÉ

La notation de la planche complète a relevé, sur un mois livré sans un seul
constat :

> « Bilateral stimulation gives an overworked nervous system a way to power
> down. »

Le seul défaut que la notation ait qualifié de « ne doit pas sortir du
bâtiment ». Les trois motifs de `checkClinicalClaim` attrapaient « X guérit
Y », « X EST un diagnostic », « votre corps VA s'effondrer » — aucun
n'attrapait une technique nommée sujet d'un verbe de résultat, qui est la forme
la plus naturelle qu'un modèle produise quand on lui demande d'expliquer
comment le travail marche.

Le motif renforcé refuse l'affirmation NUE et laisse passer la nuancée : « EMDR
can help » est ce qu'un ordre demande d'écrire, « EMDR helps » ce qu'il refuse.
Calibré sur les 7 199 lignes écrites de la base — **29 refusées, 0,40 %**, et
chacune est une vraie promesse.

⚠ **Trois d'entre elles vivaient dans `month-pia`**, le mois vert de référence,
**et deux avaient été retenues comme EXEMPLES à montrer au modèle.** On
enseignait le défaut. C'est le meilleur argument contre 1b qu'on ait trouvé, et
il ne vient pas d'un chiffre.

### Les planches

* `design/preview-2026-09-24a/` — bras 1a seul
* `design/preview-2026-09-24b/` — bras 1a + 1b + 1c

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
| 7b | ⚠ **BLOQUANT — créer `content_generation_runs` et `content_generation_results` (F17) AVANT d'armer la génération mensuelle.** Ce n'est pas une amélioration à planifier : **tant que ces deux tables n'existent pas, une génération interrompue est repayée EN ENTIER**, et un lot Batch est facturé à la soumission, donc avant qu'une seule réponse existe. Vercel n'a pas de disque qui survive à l'invocation : le journal fichier (`.eklio-journal/`) est le chemin LOCAL, ces tables sont le chemin SERVEUR, et il n'y a pas de troisième chemin. ⚠ **`CONTENT_GENERATION_ARMED` reste à `false` tant que l'étape 1 du rejeu ne montre pas les deux tables présentes.** La migration est écrite et rejouée (`20260923100000_a_paid_batch_survives_a_crash.sql`, RLS et policies comprises) ; elle part avec les autres à l'étape 3. | agent (migration) |
| 8 | **Générer la banque de production.** Voir F13 pour le dimensionnement : `N × 90 × 3` par segment, 0,00290 $ le sujet. ⚠ **Après** les migrations et **après** F12, sinon les segments n'existent pas. Un mois généré sur une banque à sec sort court sans que rien le signale. | agent (clé passée par commande) |
| 8a | ⚠ **BLOQUANT — la banque doit être dimensionnée pour un SEGMENT SIMULTANÉ avant d'armer le `cron` mensuel.** Tout le dimensionnement de F13 suppose une praticienne qui tire son mois, puis la suivante le mois d'après. Le `cron` fera l'inverse : **un segment entier le même jour**, et la fenêtre de 90 jours interdit à chacune ce que ses consœurs viennent de prendre — le même matin. Le modèle est dans `lib/content/bank.ts`, calculé sur la boucle de tirage et testé : `tours × N × essais × retenus + N × tirés ÷ (1 − 40 %)`. À cinq praticiennes et quatre essais, **2 405 sujets par segment (6,97 $)**, contre 580 dans le dimensionnement précédent. ⚠ Et le garde-fou de `20-month.ts` doit rester en place : il compte le stock tirable **par archétype** avec la requête qui tire, et déclenche le remplissage AVANT la génération. Sans lui, la banque est remplie après l'échec — c'est-à-dire après avoir payé l'écriture d'un mois qui ne pouvait pas sortir. | agent |
| 8b | ⚠ **BLOQUANT — brancher la réservation de crédit sur le chemin PRODUIT, puis vérifier que `credit_ledger` grossit** (F25, F27). ⚠ **Aucun chemin produit n'appelle `reserve_credit` pour une génération mensuelle** : `runMonthForKit` ne réserve rien, et le seul appelant du dépôt est le harnais. Le point d'étranglement SQL est juste et le plafond est tenu — personne ne frappe à la porte. Tant que ce n'est pas fait, le quota de trente posts n'existe que pour le harnais. La vérification ensuite : `select kind, reservations, cost_usd from credit_month_audit where user_id = … and month = …` doit montrer **trente réservations `post_generation`** pour un mois généré. ⚠ **Avant l'étape 9**, sinon on ouvre la facturation sur un compteur que rien n'incrémente. | agent |
| 8c | **Vérifier le coût du kit au livre.** `bookKitCost` écrit une ligne `overhead` par kit généré. Mesuré en local : dix kits, dix lignes, **0,2618 $**, soit 0,026 $ le kit. C'était la seule ligne d'un total de session qu'on ne savait pas prouver. | agent |
| 8d | ⚠ **BLOQUANT — le juge de complétude a besoin de la clé.** Les contrôles d'écriture de F26 tranchent quatre titres sur cinq par un appel court (~0,001 $ le mois). Sans clé il rend un verdict vide, et **un verdict vide ne refuse rien** : le mois passe avec ses phrases inachevées. Vérifier que la variable est posée dans l'environnement de la tâche mensuelle, pas seulement dans celui du build. | agent, **humain** pour le secret |
| 9 | **Stripe.** ⚠ **Le test de bout en bout n'a jamais été confirmé** — ni en test, ni en production. Avant d'ouvrir : un paiement réel de bout en bout, un webhook reçu et vérifié, un remboursement, une annulation d'abonnement. | **humain** |
| 10 | **Premier mois réel sur un compte témoin**, planche regardée par une personne avant d'ouvrir aux autres. ⚠ Le regard ne remplace pas la barrière et la barrière ne remplace pas le regard : le mois validé à l'œil le 2026-09-21 portait trois recopies de titre, un titre coupé et une identité inventée (F16) — tous invisibles à l'œil, tous refusés par `checkMonth`. | agent génère, **humain** regarde |

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

### ⚠ LA CONSOMMATION NETTE DÉPEND DE LA RESTITUTION, PAS DU TIRAGE

**Tout ce qui suit compte ce qu'un essai CONSOMME, et suppose que le reste
revient. Ça ne revient que si quelqu'un le rend.**

Mesuré le 2026-09-24 : **915 sujets** assignés à vingt-six kits **sans un seul
post** — 858 sur 2026-11 par vingt-quatre kits, 57 sur 2026-10 par deux. Le
résidu de toutes les exécutions interrompues : un run tué, un lot en erreur,
une session coupée. La fenêtre anti-collision les retirait à **tout le
segment** pendant quatre-vingt-dix jours, pour des posts que personne n'a
jamais écrits.

⚠ **Et on s'apprêtait à racheter ce qu'on possédait déjà.** Le garde-fou voyait
la banque basse et aurait déclenché un remplissage ; après libération, les onze
archétypes passaient le seuil de dix essais simultanés sans écrire un sujet de
plus. En production, le stock s'érode à chaque incident et la facture de banque
grossit sans qu'aucun sujet n'ait servi.

**Corrigé le 2026-09-24** (`20260924140000`), par deux verrous :

| verrou | ce qu'il fait |
|---|---|
| `topic_assignment_holds` | une assignation ne retient que si elle a produit un `content_item`, ou si elle est encore dans son **délai de grâce** (3 h). Posé dans `drawable_topics_for_kit`, donc valable pour le tirage, le compteur et `next_topic_for_kit` d'un coup. ⚠ Il tient **sans balai** |
| `release_stale_topic_assignments()` | efface les périmées et **rend le nombre**. La génération l'appelle avant de compter le stock |

⚠ **Le délai de grâce doit excéder une génération entière** : un lot met
vingt-cinq à trente minutes et le harnais abandonne à quatre-vingt-dix. Trois
heures laissent une génération légitime finir sans se faire voler les sujets
qu'elle est en train d'écrire, et rendent un incident **au tour suivant** plutôt
qu'au trimestre suivant.

**Conséquence sur le dimensionnement** : les tableaux ci-dessous restent justes
pour un régime SANS incident. Avec incidents et sans restitution, la
consommation nette tend vers le TIRAGE entier (72 par essai) et non vers les 30
retenus — soit **2,4 fois** le stock calculé. C'est la restitution qui fait
tenir le chiffre, pas le tirage.

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

### La composition, par archétype — mesurée sur le TIRAGE

⚠ **Les cibles étaient calquées sur le mélange d'un mois PUBLIÉ. C'est la
mauvaise grandeur.** Ce qui vide la banque, c'est le TIRAGE : `20-month.ts`
tire `CANDIDATES` sujets répartis en trois familles, à tour de rôle dans
chacune.

| famille | archétypes | tirés par mois **chacun** |
|---|---|---|
| statement | `single_statement`, `practitioner_card` | 18 / 2 = **9** |
| simple | `surface_and_beneath`, `comparison_pair`, `numbered_strategies`, `cycle`, `concentric_control` | 18 / 5 ≈ **4** |
| varied | `carousel`, `quadrant_model`, `annotated_curve`, `lettered_technique` | 18 / 4 ≈ **5** |

Un diagramme de la famille « varied » était donc tiré 4,5 fois par mois pour
un stock de 5 : à sec au premier mois. Une phrase seule était tirée 9 fois
pour un stock de 16. C'est ce rapport-là, et non le mélange publié, qui
explique qu'une banque « équilibrée » ne rende plus que des phrases seules
dès qu'elle se vide.

**Cible par segment**, `10-topic-bank.ts --months N` :

| mois tenus | sujets / segment | 2 segments | coût |
|---|---|---|---|
| 1 | 58 | 116 | 0,34 $ |
| 4 | 232 | 464 | 1,35 $ |
| **10** (cible) | **580** | **1 160** | **3,36 $** |

⚠ **Six mois ont été remplis ce jour-là, pas dix** : dix coûtent 3,36 $ d'un
plafond de session de 4 $, ce qui ne laissait pas de quoi générer les mois
que la même demande exigeait. C'est une décision de budget, écrite ici plutôt
que devinée plus tard depuis un stock qui ne correspond à aucune cible.

### ⚠ UN MOIS REFUSÉ COÛTE AUTANT DE BANQUE QU'UN MOIS LIVRÉ

**Mesuré le 2026-09-23 sur quatre essais consécutifs**, banque partant de
**372 sujets libres** :

| essai | compte | tirés | publiés | rendus | reste après |
|---|---|---|---|---|---|
| 1 | imogen.hale | 54 | 30 | 24 | 318 |
| 2 | maren.okafor | 30 | 29 | 1 | ~289 |
| 3 | orin.fenwick | 39 | 30 | 9 | ~118 |
| 4 | lysa.brandt | **18** | — | — | **88** |

⚠ **Le quatrième essai n'a pas pu tirer un mois.** Dix-huit candidats pour
trente posts : la banque ne portait plus de quoi en composer un.

La raison tient en une ligne : **un mois REFUSÉ garde ses trente sujets**. Il
reste en `proposed` — ses posts sont écrits, ce sont eux qu'on relit pour
savoir ce qui cloche — donc ses sujets restent assignés, et la fenêtre
anti-collision les retire à TOUTES les praticiennes du segment pour 90 jours.
Seuls les sur-générés non retenus reviennent (F19).

⚠ **LE DIMENSIONNEMENT DE F13 COMPTE DONC DES ESSAIS, PAS DES LIVRAISONS.**
`stock = N × 90 × 3` suppose un mois par mois et par praticienne. À deux
essais pour un mois livré, il faut le doubler ; à trois, le tripler. Le
tableau ci-dessus dit 30 sujets par essai, quel qu'en soit le verdict — c'est
le chiffre à multiplier, et il n'apparaissait nulle part.

| praticiennes | 1 essai / mois | 2 essais / mois | 3 essais / mois |
|---|---|---|---|
| 5 | 1 350 sujets · 3,92 $ | 2 700 · 7,83 $ | 4 050 · 11,75 $ |
| 20 | 5 400 · 15,66 $ | 10 800 · 31,32 $ | 16 200 · 46,98 $ |
| 40 | 10 800 · 31,32 $ | 21 600 · 62,64 $ | 32 400 · 93,96 $ |

⚠ **La requête de surveillance doit donc compter les sujets libres PAR
ARCHÉTYPE, pas au total.** Au quatrième essai la banque portait encore 88
sujets libres — assez en apparence — mais `cycle` et `numbered_strategies`
n'en avaient que cinq chacun, et un mois ne se compose pas avec ça :

```sql
-- ⚠ Le total ment. C'est le minimum par archétype qui dit si un mois passe.
select t.archetype_key,
       count(*) filter (where a.topic_id is null) as libres
  from public.content_topics t
  left join public.topic_assignments a on a.topic_id = t.id
 group by 1
 order by 2;
```

**Seuil d'alerte : moins de 5 sujets libres sur UN archétype quelconque.**
Mesuré : c'est la valeur qu'avaient `cycle` et `numbered_strategies` quand le
quatrième essai n'a tiré que 18 candidats sur 54.

### ⚠ Le stock se dimensionne PAR ARCHÉTYPE, pas en total

Trouvé en regardant une banque qui se vide. `PER_SEGMENT` vise 16
`single_statement` pour 4 de chaque diagramme — un rapport de 4 pour 1, qui
correspond au mélange souhaité d'un mois. Mais les diagrammes s'épuisent
QUATRE FOIS PLUS VITE, et à mesure que la banque se vide, le tirage ne trouve
plus que des phrases seules.

Mesuré le 2026-09-21 sur le douzième mois de la journée : la banque ne portait
plus que des `single_statement` tirables, le mois est sorti à **46,7 % de
phrases seules (14 sur 30)**, et `checkMonth` l'a refusé — correctement, pour
`mix.dominant` et `mix.loneSentence` à la fois.

**Conséquence** : le seuil d'alerte doit être posé par archétype, et les
cibles de remplissage inversées par rapport à l'intuition — il faut PLUS de
diagrammes que de phrases seules en stock, pas moins, parce qu'un mois sain en
consomme plus. Un total sain qui cache un archétype à zéro produit un mois
refusé.

**Seuil d'alerte** : quand le stock TIRABLE d'un segment — les sujets ni
assignés, ni bloqués par la fenêtre — descend sous `N × 90`, soit le tiers de
la cible, il reste de quoi servir un mois par praticienne et plus aucune marge
pour les refus. C'est là qu'un remplissage doit partir, pas quand la banque
est vide : un mois généré sur une banque à sec sort court, et **rien dans le
produit ne le signale aujourd'hui** à l'abonnée.

La requête qui le mesure — **par archétype**, sinon elle rassure à tort :

```sql
select s.id, s.modality_id, s.persona_id, t.archetype_key, count(t.id) as tirables
  from public.content_segments s
  join public.content_topics t on t.segment_id = s.id
 where t.ethics_reviewed_at is not null
   and (t.expires_at is null or t.expires_at > now())
   and not exists (select 1 from public.topic_assignments a where a.topic_id = t.id)
 group by 1, 2, 3, 4
 order by 5 asc;
```

⚠ **Et la banque du bac à sable est à SEC au moment où ceci est écrit** : 1
sujet tirable sur les 499 générés en cinq remplissages, consommés par douze
mois réels en une journée. Ce n'est pas une anomalie de test — c'est le débit
réel d'une seule praticienne fictive multiplié par douze, et il dit ce que
coûte un segment vivant.


3. ce que le produit RÉPOND quand la banque est vide. Aujourd'hui le tirage
   rend moins de candidats que demandé, le mois sort plus court, et rien ne le
   signale à l'abonnée.

⚠ **Et le symptôme était masqué.** `10-topic-bank.ts` comparait ses cibles au
nombre de sujets EXISTANTS, pas disponibles : il répondait « the bank is
already at target » sur une banque intégralement bloquée. Corrigé par
`--scale`, mais le fond reste : *exister* et *être tirable* sont deux choses,
et c'est la seconde qui fait un mois.

### ⚠ 2026-09-24 — TOUT CE QUI PRÉCÈDE DIMENSIONNE DIX MOIS QUI SE SUIVENT. LE `cron` N'EN FERA PAS UN.

**Bloquant avant d'armer le `cron` mensuel.**

Les chiffres ci-dessus supposent une praticienne qui tire son mois, puis la
suivante le mois d'après. Ce n'est pas ce que le produit fera : **un `cron`
mensuel génère un segment entier le même jour**. Dix consœurs EMDR de
Californie tirent en parallèle, et la fenêtre de 90 jours interdit à chacune ce
que les neuf autres viennent de prendre — le même matin, pas trois mois plus
tard.

Le modèle est désormais dans le code (`lib/content/bank.ts`), calculé sur la
boucle de tirage et testé, au lieu d'être une table recopiée :

```
stock(archétype) = tours × N × essais × retenus(archétype)   ← bloqué 90 jours
                 + N × tirés(archétype) ÷ (1 − 40 %)          ← le pic simultané
```

⚠ **Le second terme est celui qu'on oublie, et c'est lui qui a coûté le
quatrième essai du 2026-09-23** : 88 sujets libres au total, `cycle` et
`numbered_strategies` à cinq pour un tirage de cinq, 18 candidats tirés sur 54.
Il faut qu'un sujet soit là pour que le dédoublonnage le refuse.

| situation | sujets / segment | coût (Haiku, sync) |
|---|---|---|
| `cron` mensuel · 5 praticiennes · 4 essais | 2 405 | 6,97 $ |
| `cron` mensuel · 10 praticiennes | 4 806 | 13,94 $ |
| `cron` mensuel · 20 praticiennes | 9 605 | 27,85 $ |
| mesure : 10 mois le même jour · 4 essais | 1 325 | 3,84 $ |
| mesure : 10 mois le même jour · 2 essais | 728 | 2,11 $ |

⚠ **Dix mois générés dans la même journée bloquent DIX tours, pas trois** : la
fenêtre ne s'ouvre pas entre deux essais lancés à dix minutes d'intervalle.
C'est le même modèle, et seul `--rounds` les distingue.

#### ⚠ Trois chiffres sur onze étaient faux, et rien ne pouvait le dire

La table `DRAWN_PER_MONTH` de `10-topic-bank.ts` datait de `CANDIDATES = 54`.
Elle annonçait **9 `practitioner_card` par mois pour un plafond de 2**, et **5
`carousel` pour un format tiré deux fois par tour** (il en faut 10). Elle est
supprimée : les cibles se calculent sur la boucle de tirage.

| archétype | tiré / essai (calculé) | table écrite à la main |
|---|---|---|
| `single_statement` | 22 | 9 |
| `practitioner_card` | **2** | **9** |
| `carousel` | **10** | **5** |
| `concentric_control`, `lettered_technique` | 4 | 4 / 5 |
| les six autres | 5 | 4 / 5 |

#### Le garde-fou : le remplissage part AVANT la génération

`20-month.ts` compte le stock tirable **par archétype** avant de tirer, et
remplit de lui-même s'il manque (`--no-fill` refuse en nommant ce qui manque et
la commande). Jusqu'ici la banque était remplie **après l'échec** — c'est-à-dire
après avoir payé l'écriture d'un mois qui ne pouvait pas sortir.

⚠ **Et il compte avec la requête qui TIRE.** La requête de surveillance
publiée plus haut compte les sujets « non assignés » ; le tirage écarte en plus
ce que ce kit a déjà pris, ce qu'une consœur du même État a pris dans les 90
jours, les sujets non relus, les expirés, et les segments qui ne correspondent
pas. Deux questions différentes, une seule qui décide si le mois sort — et la
surveillance rassurait sur un stock que le tirage ne voyait pas. La migration
`20260924130000` fait de `next_topic_for_kit` un `limit 1` posé sur
`drawable_topics_for_kit`, et de `drawable_count_for_kit` un `group by` sur la
même liste : elles ne peuvent plus répondre différemment, et le fichier le
vérifie sur vingt-cinq kits à l'application.

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
