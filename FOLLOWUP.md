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

## F35 — ⚠ L'AUDIT DU CORPUS : DIX-SEPT CLASSES D'UN COUP, ET LE PLUS GROS TROU DU JEU DE CONTRÔLES

Jusqu'ici chaque classe de défauts avait été découverte par une **notation de
planche**, un défaut à la fois : F26 en a trouvé sept, F29 un, F34 un. C'est
lent, et ça garantit qu'il en reste.

Le 2026-09-24, le corpus entier — **5 381 lignes de carte, 400 légendes, 399
alternatifs** — a été soumis à un audit mené **à l'aveugle** : l'auditeur
n'avait pas la liste des contrôles existants, seulement les règles de publicité
de l'ACA et de l'APA et l'instruction de classer par exposition. Il a rendu
dix-sept catégories.

### ⚠ LE CONSTAT CENTRAL : AUCUN CONTRÔLE D'ÉCRITURE NE LISAIT LA LÉGENDE

`writtenLinesIn` rendait la ligne de carte et les chaînes du payload — ce qui
est **dessiné** — et rien d'autre. Or la légende est le texte publié le plus
**long**, et c'est là que vivaient :

| dans la légende | compté |
|---|---|
| une annonce de disponibilité (« two evening slots ») | **341 / 400** |
| du contenu tiré de la patientèle réelle | **76 / 400** |
| une comparaison d'efficacité avec la thérapie par la parole | 7 |

⚠ **`checkSellsSlots` existe depuis F26 et n'a jamais regardé l'endroit où l'on
vend.** Seul `checkEthics` voyait la légende, et il ne porte que les six règles
du brief : les vingt-trois contrôles d'écriture regardaient la carte pendant que
le paragraphe en dessous disait ce qu'il voulait.

**Mesuré après branchement, sur les neuf mois livrés de F34 : SEPT sont
refusés**, tous sur des affirmations d'efficacité dans la légende. ⚠ **Le taux
de livraison de 8 sur 9 avait été mesuré la légende non lue**, et il faut le
lire ainsi.

### Le sort des dix-sept classes

| # | classe | disposition |
|---|---|---|
| 1 | identité / titre / juridiction contradictoires | ⚠ **artefact du corpus** — il mélange 43 comptes d'essai. `checkInventedIdentity` couvre l'intérieur d'un mois, et les mois de F34 passent |
| 2 | **aucun numéro de licence dans 400 publicités** | ⚠ **LIMITE CONNUE, BLOQUANTE** — voir ci-dessous |
| 3 | contenu tiré de la patientèle | ✅ `text.caseload`, 0,78 % |
| 4 | EMDR au-delà de sa base de preuves | ⚠ **partiellement** — `text.clinicalClaim` prend la promesse nue ; « EMDR for burnout » en titre reste ouvert |
| 5 | symptômes physiques attribués au psychique, sans orientation médicale | ⚠ **LIMITE CONNUE** — voir ci-dessous |
| 6 | **aucune ressource de crise, aucun avertissement** | ⚠ **LIMITE CONNUE, BLOQUANTE** |
| 7 | pseudo-diagnostic à distance, trait requalifié | ✅ `text.pathologised` (forme nominale) + `text.clinicalClaim` (verbale) |
| 8 | comparaison d'efficacité | ✅ `text.comparative`, 0,02 % |
| 9 | mécanisme neurologique faux | ✅ `text.falseMechanism`, 0,10 % |
| 10 | rareté fabriquée, disponibilité périmée | ✅ `checkSellsSlots`, **désormais sur la légende** |
| 11 | résultats implicites tirés de l'expérience patiente | ⚠ limite connue — « Some people find that… their body stops bracing » demande un jugement |
| 12 | van der Kolk non attribué | ✅ `checkBorrowed` + `99-purge-borrowed.ts` |
| 13 | contradictions internes, négations tombées | ⚠ **non formulable** — « EMDR works with memory. It does not work with loss. » contredit six autres lignes du même corpus. Un regex ne trouve pas une négation tombée |
| 14 | alternatif qui retient l'information | ⚠ limite connue — 109 alternatifs sur 399 paraphrasent au lieu de citer (WCAG 1.1.1) |
| 15 | titres tronqués | ✅ `checkUnfinished` + juge |
| 16 | saturation de gabarit | ⚠ partiellement — passe de révision, `checkDuplicateTitles`, `checkEcho` |
| 17 | orthographe britannique | ⚠ limite connue, 13 occurrences contre 29 américaines |

### ⚠ TROIS LIMITES CONNUES, ET DEUX SONT BLOQUANTES

**A. Aucun numéro de licence, dans aucune des 400 publicités.** Californie
B&P §4980.44(c) et §4999.80 exigent le type ET le numéro de licence dans
**toute** publicité ; la Virginie et l'Oregon ont l'équivalent. ⚠ **Le produit
n'a pas de champ pour ça** : `project_briefs` ne porte ni type ni numéro de
licence, donc aucun contrôle ne peut exiger ce qu'il n'y a pas à mettre. Il faut
la colonne, le champ de brief, et la ligne sur la carte praticienne —
**avant** d'ouvrir.

**B. Aucune ressource de crise, aucun avertissement de portée, dans aucun
post.** Ce corpus s'adresse explicitement à des personnes en détresse — deuil,
dissociation, effondrement — et les invite à s'identifier à une liste de
symptômes. Zéro mention de 988 ou d'une ligne d'écoute sur 400 posts, et jamais
la phrase qui dit que lire un post ne crée pas de relation thérapeutique. ⚠ **Ce
n'est pas un défaut de contrôle, c'est un manque de gabarit** : la légende n'a
pas de pied. Il se pose une fois, dans le gabarit, et il se contrôle ensuite.

**C. Symptômes physiques attribués à une cause psychique, sans un mot
d'orientation médicale.** Dix-huit légendes portent un faisceau somatique —
oppression thoracique, insomnie, tachycardie, fatigue que le repos ne touche pas
— avec une attribution causale au système nerveux. ⚠ **Zéro occurrence de
« médecin », « bilan », « écarter une cause médicale » dans les 5 180 unités du
corpus.** Ce sont les mêmes symptômes qu'une apnée du sommeil, une anémie, une
thyroïdite ou un trouble du rythme, et deux légendes ajoutent « this is not
something to fix faster ». La forme est détectable — une liste de symptômes plus
une attribution causale — mais le geste juste n'est pas de refuser : c'est
d'**exiger la ligne d'orientation** dans le gabarit, comme en B.

## F36 — LA RÉPÉTITION À BLANC : JOUABLE EN 37 SECONDES, ET ELLE A TROUVÉ QUE LA SAUVEGARDE NE SE RESTAURE PAS

**La séquence de mise en production n'avait jamais été jouée.** Elle l'a été le
2026-09-24 contre une copie locale de la base de production, reconstituée depuis
les **133 migrations que `main` porte**, sans aucun accès à la production réelle.

`docs/production/C-repetition-a-blanc.sh` la rejoue ; son résultat est dans
`C-repetition-resultat.txt`.

### ⚠ CE QU'ELLE A TROUVÉ : L'ÉTAPE 2 ÉCHOUE SUR LA PRODUCTION ACTUELLE

L'étape 2 dit « sauvegarde de la base de production, et vérification qu'elle se
restaure — une sauvegarde non restaurée n'est pas une sauvegarde ».

```
pg_restore: error: COPY failed for table "section_types":
  violates check constraint "section_types_allowed_pages_check"
```

Mesuré sur la base réelle : `section_types` porte **onze** lignes et s'en
restaure **zéro**. ⚠ Et la base restaurée paraît intacte — 89 tables, 301
fonctions, 210 policies, identiques de part et d'autre. **Seul le compte de
lignes d'une table de référence diffère, et personne ne le comptait.**

**Le mécanisme** : une `CHECK` qui lit une AUTRE table.
`section_types_allowed_pages_check` appelle `site_spec_page_keys()`, qui lit
`site_pages`. Une `CHECK` est immédiate par construction — elle s'évalue ligne à
ligne pendant le `COPY`, avant que la table qu'elle consulte soit chargée.

⚠ **Et aucune invocation de `pg_restore` ne sauve ça** :

| mode | résultat |
|---|---|
| par défaut | `section_types` restaure **0 sur 11**, en silence |
| `--single-transaction` | la restauration **entière avorte**, base inutilisable |

**Corrigé** (`20260924150000`) : le non-vide reste en `CHECK` — intra-ligne,
donc restaurable — et l'appartenance aux pages devient un `CONSTRAINT TRIGGER
DEFERRABLE INITIALLY DEFERRED`, vérifié au COMMIT. Mesuré après correction, sur
la base réelle, dans les deux modes : **zéro erreur, 11 sur 11**.

⚠ **ET ÇA CHANGE L'ORDRE DE LA LISTE.** Le correctif doit être appliqué **seul,
AVANT la sauvegarde** — sinon la sauvegarde prise à l'étape 2 est celle de la
production telle qu'elle est, et elle ne se restaure pas. Prouvé dans les deux
sens :

| | erreurs | `section_types` restauré |
|---|---|---|
| sauvegarde de la production telle quelle | 1 | **0 sur 11** |
| correctif seul d'abord, puis sauvegarde | **0** | **11 sur 11** |

⚠ **Et `content_items_payload_valid` est de la même classe** — elle appelle
`content_topic_payload_valid`, qui lit `content_archetypes`. Elle survit
aujourd'hui **par chance d'ordre alphabétique** : `content_archetypes` se copie
avant `content_items`. Renommer l'une des deux tables suffirait à perdre tous
les posts publiés d'une sauvegarde.

### Ce qui a été joué, et ce qui ne peut pas l'être

| étape | jouée ? | résultat |
|---|---|---|
| 0 — correctif de restauration, seul | ✅ | appliqué sur la base à 133 migrations |
| 1 — vérifications bloquantes | ✅ | 155 migrations se rejouent sur une base neuve, 0 échec |
| 2 — sauvegarde + restauration vérifiée | ✅ | 0 erreur, comptes de lignes identiques, 69 tables de part et d'autre |
| 3 — appliquer les 22 nouvelles, dans l'ordre | ✅ | les 22 appliquées, arrêt au premier échec jamais atteint |
| 4 — F12 | ✅ | 240 lignes à NULL, aucun État vendable — la bonne réponse, pas une panne |
| 5 — variables d'environnement | ⚠ **non jouable** | Vercel. Préparée dans `docs/production/B2-les-secrets.md` |
| 6 — la branche source | ⚠ **analysée, non jouée** | l'analyse est faite et prouvée (`B4`) ; le `push` est l'acte |
| 7 — repointer Vercel, six `crons` | ⚠ **non jouable** | Vercel |
| 7b — les deux tables de F17 | ✅ | présentes |
| 8 — banque | ✅ partiellement | les cinq fonctions de tirage répondent ; le remplissage coûte de l'argent et n'est pas répété |
| 8b — crédit sur le chemin produit | ✅ partiellement | `reserve_credit`, `settle_credit`, `credit_month_audit` et l'invariant sont là. ⚠ Que `runMonthForKit` les APPELLE reste à faire (étape bloquante) |
| 8c — coût du kit au livre | ⚠ non joué | demande un appel payant |
| 8d — clé du juge | ⚠ **non jouable** | hors base |
| 9 — Stripe | ⚠ **non jouable** | demande des clés de test Stripe, absentes de cet environnement. Liste cochable dans `B5-stripe.md` |
| 10 — coup d'œil sur la planche | ✅ | fait, deux fois, par notation indépendante (F34) |

**Durée de la partie jouable : 37 secondes.** Ce qui prendra du temps le jour
venu n'est aucune de ces étapes : c'est F12 (vingt minutes de lecture), Stripe
(un achat réel et un remboursement) et le coup d'œil (quinze minutes).

### ⚠ Ce qui reste incertain

1. **Stripe n'a jamais été testé, et ne peut pas l'être ici.** C'est la seule
   étape dont on ne sait rien du tout — pas « à revérifier », « jamais fait ».
2. **Les migrations ne sont pas idempotentes.** Rejouer `20260921090000` sur une
   base qui la porte déjà échoue — sur une contrainte ajoutée trois jours plus
   tard par `20260924120000`. Le rejeu complet dans l'ordre fonctionne (155, 0
   échec) ; la reprise d'une séquence interrompue se fait **à partir de la
   migration qui a échoué**, jamais depuis le début.
3. **La copie locale n'a pas les données de production.** Elle a le schéma et
   les semences. Une contrainte que seules des données réelles violeraient ne
   peut pas se voir ici — et c'est exactement ce qui vient d'être trouvé sur
   `section_types`, avec onze lignes de semence.
4. **`runMonthForKit` ne réserve toujours aucun crédit** (étape 8b). La
   répétition montre que la plomberie SQL est là ; elle ne montre pas que
   quelqu'un frappe à la porte.

## F37 — LES TROIS BLOCAGES D'OUVERTURE : LEVÉS, ET CE QU'ILS ONT APPRIS

### A · la sauvegarde se restaure, et c'est prouvé

| tentative | résultat |
|---|---|
| `pg_restore` nu | `section_types` restaure **0 sur 11**, en silence |
| `pg_restore --single-transaction` | la restauration **entière avorte** |
| **`docs/production/A-restaurer.sh`** | **0 écart sur 86 tables, contenu compris** |

La procédure en trois temps — schéma, retrait des `CHECK` qui lisent une autre
table, données, contraintes reposées **et validées**, post-data — fonctionne sur
la production **telle qu'elle est**, sans migration préalable.

⚠ **Les contraintes à retirer sont énumérées depuis le catalogue**, jamais
écrites à la main : la prochaine de cette classe arriverait sans que personne la
rajoute.

⚠ **Et la vérification est le livrable.** Compter les tables, les fonctions et
les policies ne voyait rien — les trois comptes étaient identiques pendant que
onze lignes manquaient. L'étape 6 compare, table par table, le **nombre de
lignes ET une empreinte md5 du contenu entier**. Elle est **sensible**, vérifié
dans les deux sens : 0 écart sur la base à 1 086 posts, et une seule ligne
retirée est détectée.

⚠ **Un piège écarté en route** : pré-poser le schéma stub (`auth`, `storage`,
`extensions`) produit **dix-sept écarts apparents pour zéro écart réel** — ces
schémas sont DANS la sauvegarde. C'est le genre de bruit qui fait conclure que
la procédure échoue alors qu'elle marche.

### B · ce que portent désormais les posts

**La licence.** `license_number` et `license_state_code` au brief, avec
contrainte de forme. La mention — `LMFT 12345` — va au **pied de carte**, seule
bande présente sur les onze archétypes, déjà en mono, et qui portait déjà le nom
du cabinet.

⚠ **Le refus vit à la génération, pas au contrôle de mois** : un contrôle qui
refuserait à la fin aurait laissé payer soixante-douze appels pour un mois qu'on
savait irrecevable. Le message nomme le champ.

⚠ **La règle la plus stricte partout, pas cinquante règles.** Gérer cinquante
variantes demanderait de vérifier cinquante boards **et** de maintenir la
matrice ensuite ; appliquer la plus stricte demande un champ.

⚠ **Et la RLS est prouvée, pas supposée.**
`information_schema.column_privileges` ne distingue pas un droit de table
énuméré d'un droit par colonne — elle rendait dix-huit lignes pour deux colonnes
neuves. La migration lit `pg_attribute.attacl`, la seule grandeur juste, et
**lève** si elle trouve quelque chose.

**La crise.** Règle **conditionnelle**, et c'est la décision de fond : aucun
board d'État, ni l'ACA ni l'APA, n'exige une ligne de crise sur chaque
publicité, et en poser une sur quatre cents posts qui parlent de fatigue au
retour de congé la rendrait invisible exactement là où elle compte.

> **Une lectrice à qui l'on parle de risque aigu ne doit pas rester sans route
> vers de l'aide immédiate.**

⚠ **`crisis` seul a été retiré du vocabulaire, et c'est mesuré** : il faisait
cinq refus sur 1 356 posts, et les cinq étaient faux — « in crisis mode », « not
in crisis, but in a kind of steady depletion ». Un contrôle déontologique qui
refuse cinq fois à tort sur un corpus où il ne devrait rien refuser se fait
désarmer au premier mois perdu, et il serait **absent le jour où il compte**.

⚠ **Il est dormant sur ce corpus : zéro refus sur 1 356 posts.** Il ne trouve
rien parce qu'il n'y a rien, pas parce qu'il ne voit rien.

### C · les surfaces, dérivées de la source

`checkSellsSlots` existe depuis F26 et n'a jamais regardé l'endroit où l'on
vend : **341 légendes sur 400** portaient une annonce de disponibilité. Le
contrôle était juste, il était branché, il ne voyait pas la surface.

`lib/content/__tests__/every-check-on-every-surface.test.ts` lit les champs de
`PostUnderCheck` **dans le type lui-même** et exige que chacun soit lu par
`writtenLinesIn` ou **exempté avec une raison nommée**. Une liste écrite à la
main resterait exacte et fausse le jour où un post gagne un champ.

Deux preuves plutôt qu'une : la source dit qu'une ligne existe, et un post dont
chaque surface porte une chaîne unique prouve qu'elle **arrive**.

⚠ **Les neuf contrôles de texte lisent la même liste** — assertion sur
l'ensemble exact, pas sur un compte, parce qu'un seuil arbitraire ne prouve
rien. Ceux qui prennent `month.posts` regardent une **structure** et le disent ;
c'est la seule raison acceptable de ne pas lire la liste commune.

### ⚠ CE QUE LA LÉGENDE A COÛTÉ, EN TAUX DE LIVRAISON

| état du pipeline | livrés | essais |
|---|---|---|
| F34, la légende **non lue** | 8 | 9 |
| la légende lue, consigne inchangée | **0** | 5 |
| la légende lue, **consigne corrigée** | 1 | 4 |

⚠ **Le taux de 8 sur 9 avait été mesuré la légende non lue**, et il faut le lire
ainsi. La consigne du préfixe ne disait de la légende que sa LONGUEUR : les
règles de déontologie et la liste des « NEVER » se lisaient comme des règles de
carte. Le modèle a fait ce qu'on lui demandait — des cartes propres et des
légendes qui promettent. **Ce n'était pas un défaut de modèle.**

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
| 1b | **Appliquer `20260924150000`** — elle déplace la contrainte qui rendait la base non restaurable vers un trigger différé. ⚠ **Ce n'est plus un préalable à la sauvegarde** : `docs/production/A-restaurer.sh` restaure la production **telle qu'elle est**, sans migration. C'est une amélioration du schéma, pas un verrou. | agent (jeton Supabase) |
| 2 | **Sauvegarde de la base de production, puis `bash docs/production/A-restaurer.sh <dump> <cible> <source>`**, et lire l'étape 6. ⚠ `pg_restore` nu perd `section_types` en silence ; `--single-transaction` fait avorter la restauration entière. La procédure en trois temps rend **0 écart sur 86 tables, contenu compris**, et la vérification détecte une seule ligne retirée. ⚠ Compter les tables, les fonctions et les policies ne voyait rien : les trois comptes étaient identiques pendant que onze lignes manquaient. | agent (jeton Supabase) |
| 3 | **Appliquer les 149 migrations** dans l'ordre, transaction par transaction, en s'arrêtant à la première erreur. | agent (jeton Supabase) |
| 4 | **F12 — `license_type_states.verified_at`.** Sur une base neuve, les 240 lignes de la matrice sont à NULL et `project_state_is_sellable` refuse TOUT : `/api/briefs/[id]/generate` répond `409 We're not open in CA yet` dans les cinquante États. ⚠ **Ce n'est pas du code, c'est un acte** : quelqu'un lit le site du board de chaque État et pose la date. Un agent qui remplirait `verified_by` fabriquerait l'apparence d'une vérification professionnelle qui n'a pas eu lieu. | **humain** |
| 5 | **Variables d'environnement.** Voir le tableau ci-dessous. | agent pour les non-secrètes, **humain** pour les secrets |
| 6 | **Créer `main`** depuis la branche validée. ⚠ Aujourd'hui `main` **n'existe pas** : les seules branches distantes sont `claude/gallant-lamport-mt20i0` et `claude/great-brahmagupta-za7qmx`. La branche source est celle que Naima a validée, nommée explicitement dans la demande — jamais « la dernière ». | **humain** décide laquelle ; agent exécute |
| 7 | **Repointer Vercel** sur `main`, vérifier que les quatre `crons` de `vercel.json` (`anon-briefs` 05:00, `nudges` 14:00, `purge-deleted-kits` 06:00, `purge-events` 04:00) sont enregistrés et que `CRON_SECRET` les protège. | agent (jeton Vercel) |
| 7b | ⚠ **BLOQUANT — créer `content_generation_runs` et `content_generation_results` (F17) AVANT d'armer la génération mensuelle.** Ce n'est pas une amélioration à planifier : **tant que ces deux tables n'existent pas, une génération interrompue est repayée EN ENTIER**, et un lot Batch est facturé à la soumission, donc avant qu'une seule réponse existe. Vercel n'a pas de disque qui survive à l'invocation : le journal fichier (`.eklio-journal/`) est le chemin LOCAL, ces tables sont le chemin SERVEUR, et il n'y a pas de troisième chemin. ⚠ **`CONTENT_GENERATION_ARMED` reste à `false` tant que l'étape 1 du rejeu ne montre pas les deux tables présentes.** La migration est écrite et rejouée (`20260923100000_a_paid_batch_survives_a_crash.sql`, RLS et policies comprises) ; elle part avec les autres à l'étape 3. | agent (migration) |
| 8 | **Générer la banque de production.** Voir F13 pour le dimensionnement : `N × 90 × 3` par segment, 0,00290 $ le sujet. ⚠ **Après** les migrations et **après** F12, sinon les segments n'existent pas. Un mois généré sur une banque à sec sort court sans que rien le signale. | agent (clé passée par commande) |
| 4b | ⚠ **BLOQUANT — le numéro de licence n'existe nulle part (F35).** Californie B&P §4980.44(c) et §4999.80 exigent le type ET le numéro de licence dans **toute** publicité ; la Virginie et l'Oregon ont l'équivalent. Sur les 400 posts du corpus, **zéro numéro**. ⚠ Ce n'est pas un défaut de contrôle : `project_briefs` n'a pas de colonne pour ça, donc aucun contrôle ne peut exiger ce qu'il n'y a rien à mettre. Il faut la colonne, le champ de brief, la ligne sur la carte praticienne, et un contrôle qui refuse un mois sans elle. **Avant la première vente**, parce que chacun des posts déjà produits est une infraction publicitaire en l'état. | agent (migration + champ), **humain** pour le numéro |
| 4c | ⚠ **BLOQUANT — aucune ressource de crise, aucun avertissement de portée (F35).** Zéro mention de 988 ou d'une ligne d'écoute sur 400 posts, et jamais la phrase disant que lire un post ne crée pas de relation thérapeutique — sur un contenu qui s'adresse explicitement à des personnes en deuil, en dissociation, en effondrement. ⚠ Et zéro mot d'orientation médicale, alors que dix-huit légendes attribuent un faisceau somatique (oppression thoracique, insomnie, fatigue que le repos ne touche pas) à une cause psychique. Le geste est un **pied de légende dans le gabarit**, posé une fois, contrôlé ensuite. | agent |
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

> **⚠ MISE À JOUR DU 2026-09-26 — LE DIMENSIONNEMENT A BAISSÉ DE 43 %.**
> Les chiffres de cette entrée ont été calculés avec un tirage de 102 candidats
> par essai. F41 a montré que ce 102 venait d'une tautologie : la moitié du
> tirage était payée sans être examinée. Le tirage est désormais **dérivé** de ce
> que la boucle consomme (`candidatesToSubmit`), et vaut **57**.
>
> | | avec 102 tirés | avec 57 tirés |
> |---|---|---|
> | seuil de remplissage, un essai | 174 | **99** (−43 %) |
> | cible de banque, un essai | 203 | **129** (−36 %) |
> | seuil, segment de 10 praticiennes | 1 704 | **954** (−44 %) |
> | cible, segment de 10 | 2 604 | **1 853** (−29 %) |
>
> Le raisonnement de l'entrée — la fenêtre de 90 jours, le tirage simultané de
> tout un segment, le fait que le total mente et qu'il faille compter par
> archétype — reste entièrement valable. Seule l'échelle change, et elle change
> dans le bon sens : **la banque n'avait pas besoin d'être deux fois plus
> grande.** Le 2026-09-26, la pénurie constatée n'était d'ailleurs pas un manque
> de sujets mais **994 assignations orphelines** tenues par des essais
> interrompus ; la libération automatique les a rendues et zéro archétype est
> passé sous le seuil.

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

---

## F38 — Les deux niveaux déontologiques ne lisaient pas le même socle

**Trouvé en payant.** Le 2026-09-24, `sable.ingram` a écrit 29 posts pour 30
retenus. Les trente contrôles du mois étaient verts, les dix échanges de
contenu avaient tous abouti, et c'est la GÂCHETTE SQL qui a refusé le
trentième :

```
database · Advertising ethics: guarantee
```

Le mois est tombé sur `month.short`. 0,54 $, un banc consommé, rien de livré.

**La cause n'est pas un motif manquant.** Les dix-neuf motifs existent des deux
côtés, avec les mêmes identifiants — `parity.test.ts` le vérifiait et il avait
raison. Ce qui diverge est une EXEMPTION, et une exemption n'a pas de nom dans
un recensement : `lib/ethics/rules.ts` laisse passer un terme interdit
immédiatement précédé d'une négation (`isProhibitiveMention`), et
`public.ethics_patterns` ne connaît pas cette notion. Mesuré sur 21 sondes
prohibitives, une par motif bloquant :

| | code | base |
|---|---|---|
| sondes bloquées | 17 | 21 |
| désaccords | — | 4 : les trois formes de `guarantee`, et `client reviews` |

**Corrigé, dans le sens strict.** `checkEthics` prend une lecture ;
`"as-database"` retire l'exemption, et tout ce qui écrit en base l'emploie
désormais — onze chemins, avec un test dérivé de la source
(`as-strict-as-the-database.test.ts`) qui fait tomber la vérification si un
appel neuf repart en lecture indulgente. Deux exemptions nommées subsistent :
la boîte de saisie de la clinicienne et le scan d'un prompt.

**Et le socle est devenu un contrôle de mois.** `checkAdvertisingEthics` entre
dans `checkMonth`, sur toutes les surfaces, pied de carte et surtitre compris.
C'est la moitié importante de la correction : un constat de `checkMonth`
déclenche un ÉCHANGE — le post fautif part, un remplaçant du banc prend sa
place, le mois reste à trente. Un refus à l'`insert` n'a pas ce recours.

### ⚠ Ce qui reste à décider, et qui ne se décide pas seule

**La base a tort, et je l'ai suivie quand même.**

> « There is no guarantee that six weeks will change anything. »

est de la copy CONFORME : c'est l'anti-promesse, exactement ce que l'ACA C.3.a
cherche à obtenir. La gâchette la refuse. Le motif juste est celui du code, et
la correction juste serait d'ajouter l'exemption prohibitive à
`public.ethics_patterns` — c'est-à-dire de relâcher un contrôle déontologique
en production, sur une session sans relecture. Le garde-fou de la session
l'interdit, et il a raison de l'interdire.

Le pipeline perd donc une tournure honnête. Ça coûte du style et rien d'autre,
et c'est le bon prix à payer en attendant une décision. **La question à
trancher :** ajoute-t-on `exception_pattern` aux quatre motifs concernés, ou
garde-t-on les deux niveaux stricts et assume-t-on que la copy générée ne nie
jamais explicitement une promesse ?

---

## F39 — `checkClinicalClaim` refuse la phrase qui dé-pathologise

Même classe que F38, autre contrôle, et trouvée en mesurant les seize essais.

`checkClinicalClaim` porte une règle juste : on ne rend pas un mot de
diagnostic prédicat d'un comportement ordinaire. « Efficiency can become
trauma » banalise ce qu'une clinicienne soigne, et le contrôle a raison de le
refuser.

Mais le motif est aveugle à la négation, et il refuse donc l'inverse exact :

| phrase | verdict | ce qu'elle fait |
|---|---|---|
| `Not all change is trauma` | **refusé** | dé-pathologise |
| `Not Every Block Is Trauma` | **refusé** | dé-pathologise |
| `Change is not always trauma` | passe | dé-pathologise, même sens |
| `A block is not trauma` | passe | dé-pathologise, même sens |
| `Efficiency can become trauma` | refusé | banalise — bon refus |
| `Overwork is burnout` | refusé | affirme — bon refus |

La différence entre la ligne 1 et la ligne 3 n'est pas le sens, c'est l'ordre
des mots : le motif exige `(is|are|becomes) + (a|an)? + <diagnostic>`, et
`is not always trauma` intercale deux mots qu'il n'autorise pas. Une négation
**en tête** de phrase ne le voit pas ; une négation **interne** l'évite.

**Mesuré :** 2 des 10 constats `text.clinicalClaim` des seize essais sont de
cette forme. C'est 20 % d'une classe, sur des phrases conformes.

### Ce que j'ai fait, et ce que je n'ai pas fait

Je n'ai **pas** touché au contrôle. Le garde-fou de la session du 2026-09-26
autorisait F38 « dans les conditions ci-dessus » et rien d'autre ; étendre le
principe de la négation immédiate à un second contrôle déontologique est une
décision du même ordre que F38, et F38 a montré qu'elle te revient.

Le prompt prévient donc le modèle : écrire « X is not trauma » plutôt que
« Not every X is Y ». Ça marche, et **ce n'est pas là que la correction
appartient** — enseigner à un modèle le tic d'un vérificateur est fragile, et
la prochaine formulation conforme tombera de la même façon.

**La question à trancher :** applique-t-on à `checkClinicalClaim` le même
dépouillement qu'à `ethics_scan` — retirer les occurrences immédiatement niées
avant d'appliquer le motif — ou élargit-on seulement le motif pour tolérer un
adverbe entre le verbe et le diagnostic ? Le premier est cohérent avec F38 ; le
second est plus étroit. Dans les deux cas, la consigne de contournement sort du
prompt le jour où c'est fait.

### ⚠ Et un troisième cas, du même genre, non corrigé

« I am not the best therapist in Portland » reste bloqué des DEUX côtés après
F38 : entre `not` et `best` il y a `the`, et l'exemption n'admet que des blancs
et des guillemets. La phrase est un désaveu explicite, donc conforme. Élargir
l'exemption aux déterminants (`the`, `a`, `an`) la débloquerait — c'est une
modification du motif du code, que la décision de F38 disait de reprendre tel
quel. À décider avec le reste.

---

## F40 — Le remplissage de banque dépense hors registre

Mesuré le 2026-09-26, pendant la mesure à cinq mois. Le garde-fou de banque a
déclenché un remplissage pour `juno.wexford` :

| | dépense |
|---|---|
| ce que le remplissage rapporte lui-même | **1,1980 $** |
| ce que `credit_ledger` porte pour ce compte | **0,0046 $** |

`10-topic-bank.ts` écrit sa propre dépense dans son rapport JSON et ne la
consigne pas au livre. Trois conséquences :

1. **Le plafond de session ne la voit pas.** `CONTENT_SESSION_CAP_USD` est
   appliqué au point de règlement du crédit ; un remplissage peut donc dépenser
   au-delà du plafond sans que rien ne l'arrête.
2. **Le coût par mois livré est faux si on le lit au registre.** C'est pourquoi
   les deux sessions ont rapporté des chiffres qui ne se recoupent pas : la
   veille, « les remplissages (~0,5 $) hors registre » ; ce jour, 1,20 $.
3. **Un remplissage déclenché par le garde-fou est invisible à l'opératrice.**
   Il tourne en sous-processus, et sa sortie JSON atterrit dans le fichier du
   mois — ce qui a fait lire un remplissage comme un mois livré par mon propre
   dépouillement avant correction.

**Corrigé dans le harnais de mois** : un post écarté par le portillon ou par la
déontologie est désormais soldé AU COÛT RÉEL et non à zéro. `settle_credit` rend
`already_settled` sans lever, donc la première issue est celle qui reste au
livre : un zéro y effaçait la dépense pour de bon.

**Pas corrigé** : le remplissage lui-même. Il faudrait qu'il réserve et solde
par lot comme le mois le fait, ce qui touche au chemin de crédit et mérite d'être
regardé avec le reste du livre.

---

## F41 — « 46 sur 102 » n'était pas un taux de conformité

Deux briefs de suite ont conclu, sur ce chiffre, que la **première écriture**
était le goulot du pipeline. Le numérateur était juste ; le dénominateur non.

La boucle d'examen des candidats porte, en première ligne :

```ts
if (usable.length >= WANTED + SPARE_POOL) break;
```

Elle s'arrête dès qu'elle tient **48** utilisables. Sur 102 candidats tirés,
elle en regarde une cinquantaine et ne touche jamais aux autres.
`funnel.candidates` compte le TIRAGE ; `funnel.conformantFirstCall` compte les
conformes parmi les EXAMINÉS. Diviser l'un par l'autre mélange deux ensembles.

Mesure du 2026-09-26, `tova.lindgren` : 46 conformes au premier appel,
2 réparés — soit 48 utilisables, c'est-à-dire exactement le seuil d'arrêt. Le
taux vrai est donc **46 sur ~48, environ 96 %**, et non 45 %.

**Conséquences, et elles ne sont pas petites :**

1. **La priorité 1 de ce brief visait un problème qui n'existe pas à cette
   échelle.** Les trois consignes ont été écrites et elles sont justes — le
   portillon montre 5 posts écartés sur 45 pour `text.unfinished` et
   `text.clinicalClaim` — mais « 46/102 » annonçait une hémorragie là où il y a
   une fuite.
2. **Le tirage est deux fois ce que le run examine.** 102 tirés pour ~50
   regardés : les 52 autres sont assignés au kit, comptés par
   `drawable_count_for_kit`, et rendus à la fin. C'est ce qui a relevé
   `fillTrigger` de 42 % à la session précédente et fait refuser trois essais
   sur cinq avant la moindre dépense.
3. **`PREPARATION_YIELD = 0.479` est probablement faux du même défaut.** Il a
   été calibré en divisant des utilisables par des tirés. S'il vaut en réalité
   ~0,9, la banque est sur-provisionnée d'un facteur deux et le seuil de
   remplissage avec elle.

**Corrigé** : `funnel.examined` est compté après le `break`, à côté du
numérateur qu'il divise, avec un test qui tombe si quelqu'un le déplace avant.

**À décider :** re-calibrer `CANDIDATES_PER_ATTEMPT` et `PREPARATION_YIELD` sur
`examined` plutôt que sur `candidates`. Ça demande deux ou trois runs pour
mesurer le rendement réel, et ça devrait faire baisser à la fois le coût par
mois et le seuil de banque. **C'est le chantier qui rapporte le plus, et il
n'était pas visible avant d'avoir le bon dénominateur.**

---

## F42 — La bascule OpenAI est construite et n'a pas pu être mesurée

Trois blocages indépendants, tous constatés au démarrage du 2026-09-26 :

| | constat |
|---|---|
| clef OpenAI | **absente de l'environnement.** `EKLIO_OPENAI_API_KEY` n'existe ni en variable, ni dans `/run/secrets`, ni dans un `.env` |
| domaines OpenAI | **tous refusés par la politique d'egress.** 403 au CONNECT sur `developers.openai.com`, `platform.openai.com`, `api.openai.com`, `openai.com`, `cdn.openai.com`, `help.openai.com` |
| compte Anthropic | **sous limite d'usage** jusqu'au 2026-10-01 00:00 UTC — le bras de référence ne pouvait pas tourner non plus |

Aucun appel n'a donc été fait, et **0 $ dépensé**.

### Ce qui est fait et éprouvé

`lib/content/generate/provider.ts` — la couture, pilotée par
`CONTENT_COPY_PROVIDER`. Les deux traductions sont pures, donc entièrement
vérifiables hors ligne : 29 tests. Chaque nom de champ vient des déclarations de
`openai@7.23.0` (`resources/responses/responses.d.ts`), générées depuis la
spécification de l'API — la documentation étant inaccessible.

Le mois et « Write it » passent désormais par le **même** assembleur. Ils
construisaient les mêmes paramètres à deux endroits, avec deux littéraux de
plafond ; une bascule faite d'un seul côté aurait laissé la moitié des posts
chez l'ancien fournisseur.

### Ce qui manque pour mesurer, dans l'ordre

1. **Une clef OpenAI**, et l'ouverture de `api.openai.com` dans la politique
   réseau de l'environnement.
2. **Lire les deux tarifs sur la page** et les dater dans `PRICE_VERIFIED_ON`.
   `priceRefusal()` refuse aujourd'hui de chiffrer un coût pour les deux
   candidats — délibérément : `rateFor()` retombe sur le tarif le plus cher
   connu, ce qui est prudent pour un plafond et **faux pour une comparaison**.
   Un candidat facturé au tarif d'Opus rendrait la conclusion inverse de la
   vérité.
3. **Le transport HTTP OpenAI** — non écrit. Trois endpoints là où Anthropic en
   demande un : `POST /v1/files` (`purpose: "batch"`) pour téléverser le JSONL,
   `POST /v1/batches` qui référence le fichier, puis le téléchargement de la
   sortie. `openAiBatchLine()` produit déjà les lignes du JSONL. Je ne l'ai pas
   écrit parce que du code réseau que rien ne peut exercer contre l'API réelle
   se trompe d'une façon que seul un vrai appel révèle — et il resterait au
   dépôt en ayant l'air fini.
4. **Le choix des deux candidats est une hypothèse de position, pas de prix.**
   `gpt-5.6-luna` et `gpt-5.6-terra` sont les paliers bas et médian de la
   famille complète la plus récente, lus dans le type `ChatModel` du SDK, qui
   ordonne `sol, terra, luna`. La recherche web rend des agrégateurs tiers qui
   se contredisent **au sein d'une même page** (« $4/$20 » puis « $5/$30 » pour
   `gpt-5.6-sol`) : ce n'est pas une source.

### Ce que le SDK établit de première main, et qui compte pour ce pipeline

- **Sortie structurée stricte** : `text.format = {type:"json_schema", name,
  schema, strict}`. C'est le meilleur argument d'OpenAI ici — la classe d'échec
  « forme invalide » disparaît par construction. Mais `strict: true` exige
  `additionalProperties: false` sur chaque objet, donc onze schémas de payload
  écrits à la main, donc une **seconde source de vérité** pour la forme des
  cartes. L'enveloppe est contrainte, le payload reste libre. Le jour où les
  archétypes gagnent une définition machine (un schéma zod que le moteur ET le
  prompt liraient), `strict: true` devient gratuit.
- **Cache de préfixe** : `prompt_cache_key` + `prompt_cache_retention:
  'in_memory' | '24h'`, avec `cached_tokens` ET `cache_write_tokens` dans
  `usage.input_tokens_details` — la comptabilité de coût n'a rien à approximer.
  Le SDK déclare les motifs d'invalidation, dont `text_format_changed` et
  `reasoning_effort_changed` : l'effort et le schéma doivent être constants pour
  une clef donnée, d'où **une clef par archétype**.
- **Batch** : `/v1/responses` accepté, `completion_window: '24h'` **seule valeur
  déclarée**. Le harnais abandonne un lot à 90 minutes ; cette borne est la
  nôtre, et un lot abandonné peut continuer à être facturé jusqu'à son terme.

---

## F43 — Le temps humain qui reste avant d'ouvrir, réestimé au 2026-09-26

> **⚠ MISE À JOUR DU 2026-09-26 (seconde passe) — LE TOTAL N'EST PLUS LE BON
> CHIFFRE.** Les 4 h 30 supposaient que la ligne 6 — « générer un mois par le
> produit » — était une vérification de trente minutes. F45 montre que ce n'est
> pas une vérification : le chemin produit n'est pas le même générateur, et
> aucun des vingt mécanismes du harnais n'y est présent.
>
> | | temps | nature |
> |---|---|---|
> | lignes 1 à 5 (F12, Vercel, DNS, Stripe, coup d'œil) | **≈ 4 h** | gestes humains, prêts |
> | ligne 6 — un mois par le produit | **non estimable** | chantier de développement, pas un geste (F45) |
>
> **Et Stripe est passé de 1 h 30 à ≈ 30 min** : `B5-stripe.md` porte désormais
> les requêtes exactes de chaque étape, les deux verrous d'idempotence à
> éprouver, la signature forgée, et un tableau « si ça ne marche pas » qui dit
> où chercher dans l'ordre. Ce qui restait à découvrir a été établi sans appeler
> Stripe.
>
> Donc : **≈ 3 h de gestes humains** (4 h moins l'heure économisée sur Stripe),
> plus un chantier dont la taille dépend de la décision de F45.

La répétition à blanc passe à **0 échec** et la restauration est prouvée à
**0 écart sur 86 tables**. Ce qui reste n'est plus du code : c'est du temps de
personne, sur des choses qu'aucun script ne peut jouer.

| # | ce qu'il reste | temps | pourquoi une personne |
|---|---|---|---|
| 1 | **F12 Californie : refaire les 4 lignes** | **20 min** | les quatre portent déjà `verified_at`, posé par le harnais, `verified_by = "LOCAL RENDER HARNESS — not a board check"`. Il faut les **effacer** et lire la règle du board. Sinon la première vente se fait sur une vérification qui n'a pas eu lieu |
| 2 | **Vercel** : variables, portées, domaine | **1 h** | quatre secrets à poser en portée *Production uniquement* — B2. Une portée trop large ne donne aucune erreur, elle marche |
| 3 | **DNS** | **30 min** + propagation | rien de local |
| 4 | **Stripe de bout en bout** | **1 h 30** | ⚠ **jamais fait**, ni en test ni en réel. Mode test, puis un achat réel remboursé aussitôt — B5 |
| 5 | **Le coup d'œil sur une planche réelle** | **15 min** | B6. Les deux mois du 2026-09-26 sont sortis sans un constat et **n'ont pas été regardés** |
| 6 | **Générer un mois par le PRODUIT** | **30 min** | condition 4 de B3. Tout ce qui a été mesuré l'a été par le harnais, jamais par la route |
| | **total** | **≈ 4 h 30** | hors propagation DNS |

### ⚠ Et deux choses qui ressemblent à du temps humain et sont du développement

**Ni l'une ni l'autre n'est dans les 4 h 30.**

1. **Le garde-fou de banque et la libération des assignations ne vivent que dans
   le harnais.** `20-month.ts` refuse avant de dépenser si la banque est courte,
   et rend les assignations orphelines en tête de génération. Le chemin produit
   — `/api/cron/content-month` — n'a **ni l'un ni l'autre**. Un `cron` armé sur
   une banque courte livre des mois courts, et une exécution tuée retire des
   sujets au segment pour trois heures sans que rien ne les rende. C'est le même
   trou depuis l'origine, et il porte maintenant deux choses.
2. **La notation indépendante n'a pas eu lieu** (voir F44, M5). « Zéro constat »
   ne veut pas dire « bonne planche », il veut dire « rien de ce qu'on sait
   nommer ». Les trente contrôles ne jugent pas si une phrase dit quelque chose.

### Ce qui est prêt et n'attend personne

Reconstruction de la copie de production depuis les 133 migrations, application
des 24 nouvelles dans l'ordre, sauvegarde et restauration prouvées ligne à ligne,
F38, les 18 règles et les 5 gâchettes, le délai de grâce de 3 h éprouvé dans les
deux sens. Tout cela se rejoue en une commande, depuis n'importe quel répertoire,
et chaque relance reconstruit la base.

---

## F44 — Tout ce qui attend du solde, dans l'ordre, avec son coût

> **⚠ MISE À JOUR DU 2026-09-26 (seconde passe).** Deux choses ont changé, et
> aucune ne touche l'ordre.
>
> **M0 reste en premier, et sa raison s'est renforcée.** F41 a divisé le tirage
> par deux — 102 → 57 — sans qu'aucun appel ne le vérifie. Le seuil de banque a
> suivi (174 → 99 pour un essai), et c'est ce seuil que le garde-fou applique
> désormais depuis `lib/content/bank-guard.ts`. Si le rendement réel est sous
> 0,85, le banc s'amincit et **tous les chiffres qui suivent sont mesurés sur un
> pipeline qui n'est plus celui qu'on croit**. Un essai, 0,32 $.
>
> **Et une mesure sort de la liste.** M2 — les trois bras de comparaison de
> modèles — n'est plus seulement bloquée (F42 : ni clef ni egress) : elle est
> devenue sans objet à court terme. Le coût par mois livré est passé de 3,22 $ à
> 0,574 $ sans changer de fournisseur, F41 devrait l'amener vers 0,32 $, et
> **F45 dit que le générateur mesuré n'est pas celui qui est branché au
> produit**. Comparer des modèles sur un générateur dont on ne sait pas s'il
> survivra est une mesure qu'il faudra refaire.
>
> | ordre | mesure | essais | coût |
> |---|---|---|---|
> | **M0** | le premier essai post-F41 | 1 | 0,32 $ |
> | **M1** | portillon sans les consignes | 1 | 0,32 $ |
> | **M4** | confirmation à cinq mois | 5 | 1,60 $ |
> | **M5** | notation indépendante | 1 juge | 0,20 $ |
> | ~~M2~~ | *reportée jusqu'à la décision de F45* | — | — |
> | | **total** | **7** | **≈ 2,45 $** |
>
> ⚠ **Rien de cette liste ne vaut si F45 tranche pour le chemin produit.** Les
> sept essais mesurent le harnais. Si c'est l'autre générateur qui survit, ils
> mesurent un pipeline qu'on jette — et il faut donc trancher F45 AVANT de
> dépenser, même si trancher ne coûte rien.

**Une seule entrée, à lire de haut en bas.** Le compte Anthropic est sous limite
d'usage jusqu'au **2026-10-01 00:00 UTC**. Chaque mesure ci-dessous est prête :
son code est écrit, ses champs de rapport existent, et rien ne reste à
instrumenter.

Les coûts viennent des deux mois livrés du 2026-09-26 — **0,5612 $ et 0,5868 $
pour 102 candidats soumis**. Depuis F41 le tirage est de **57**, donc l'ordre de
grandeur attendu est **≈ 0,32 $ par essai**. ⚠ C'est une extrapolation : le
premier essai post-F41 la confirmera ou non, et **il faut la lire avant de
chiffrer la suite.**

| ordre | mesure | ce qu'elle tranche | essais | coût estimé |
|---|---|---|---|---|
| **M0** | **le premier essai post-F41** | le tirage à 57 suffit-il ? `funnel.examined` doit valoir ~50 et `gate.arrived` ~45 | 1 | **0,32 $** |
| **M1** | portillon **sans** les consignes | ce que chacun apporte dans les 3,22 $ → 0,574 $ | 1 | 0,32 $ |
| **M4** | confirmation à cinq mois | 2/2 n'est pas un taux ; cinq d'affilée en est un | 5 | 1,60 $ |
| **M5** | notation indépendante | « zéro constat » ne dit pas « bonne planche » | 0 + 1 juge | 0,20 $ |
| **M2** | les trois bras de modèle | Sonnet contre deux candidats OpenAI | 12 | 4 $ + OpenAI |
| | **total sans M2** | | **7** | **≈ 2,45 $** |

### Pourquoi cet ordre, et pas celui du brief

1. **M0 d'abord, et il est nouveau.** F41 a divisé le tirage par deux sans
   qu'aucun appel ne le vérifie. Si le rendement réel est sous 0,85, le banc
   s'amincit et tout ce qui suit est mesuré sur un pipeline qui n'est plus celui
   qu'on croit. Un essai, 0,32 $, et il conditionne les six autres.
2. **M1 ensuite**, parce que son résultat change ce qu'on garde : si les
   consignes n'apportent rien, 2 106 caractères de préfixe par archétype sortent,
   et M4 se mesure sur le pipeline allégé. Détails et commande :
   `docs/mesures/M1-separer-portillon-et-consignes.md`.
3. **M4 avant M5.** Noter une planche coûte un appel de juge ; la noter avant
   d'avoir cinq mois ferait noter un échantillon de deux.
4. **M2 en dernier, et peut-être jamais.** Le gain attendu s'est effondré : le
   coût par mois livré est passé de 3,22 $ à 0,574 $ **sans changer de
   fournisseur**, et F41 devrait l'amener vers 0,32 $. Une bascule de fournisseur
   pour gagner sur un chiffre déjà divisé par dix n'est plus le levier qu'elle
   était. Elle reste bloquée de toute façon (F42 : ni clef ni egress).

### Ce qu'il faut avoir sous la main avant de lancer

- **La banque.** Vérifier `drawable_count_for_kit` contre `fillTrigger` sur les
  onze archétypes **avant** de dépenser — le garde-fou le fait, mais le savoir
  évite de découvrir un remplissage à 1,20 $ au milieu d'une mesure (F40).
- **Un kit frais par essai**, brief complet, aucun mois à la date visée. La
  requête est dans M1.
- **Le mode lot, pas le synchrone.** `--batch` force le lot même au premier mois
  d'un kit ; le synchrone coûte le double et tient six heures pour cinq essais.
  C'est l'erreur qui a coûté 0,39 $ le 2026-09-26.
- **`CONTENT_SESSION_CAP_USD`**, qui ne voit pas les remplissages de banque
  (F40). Le plafond réel est donc celui-là **plus** ce qu'un remplissage peut
  déclencher.

---

## F45 — ⚠ LE CHEMIN PRODUIT N'EST PAS LE MÊME GÉNÉRATEUR

**C'est le constat le plus lourd de la session du 2026-09-26, et il est plus
large que ce qu'on cherchait.**

On cherchait deux mécanismes manquants côté produit : le garde-fou de banque et
la libération des assignations. Le recensement, mené mécaniquement sur la chaîne
transitive des imports, dit autre chose : **aucun** des vingt mécanismes du
harnais n'est présent sur le chemin produit.

| absent du chemin produit | ce que cela voudrait dire si la route était armée |
|---|---|
| `checkMonth` (trente contrôles) | un mois part sans qu'aucun contrôle de mois ne l'ait lu |
| `checkPostAlone` (portillon) | aucun post n'est jugé seul |
| `licenceMention` / `licenceMissingMessage` | **un mois produit ne porterait AUCUNE mention de licence**, que la Californie exige dans toute publicité |
| `guardBank`, `drawable_count_for_kit`, `assign_topic_to_kit` | pas de banque du tout |
| `judgeCompleteness`, `reviseMonth` | ni juge de complétude, ni passe de révision |
| `composeWithFallback` | pas de composition vectorielle des onze archétypes |
| `reserve_credit` / `settle_credit` | **le quota de trente posts achetés n'est tenu nulle part** |

### La cause n'est pas un oubli

Ce sont **deux générateurs** :

| | harnais (`scripts/local-render/20-month.ts`) | produit (`generateMonth`, `lib/content/generate/pipeline.ts`) |
|---|---|---|
| ce qui est écrit | un payload d'archétype par post | une ligne et une légende par post |
| l'image | composition vectorielle, coût nul | un fond photographique dessiné par API |
| la banque | `assign_topic_to_kit` | `planMonth`, aucun tirage |
| la déontologie | trente contrôles + portillon + gâchettes SQL | `checkEthics` à la réécriture, puis `ethicsCheck: { passed: true }` **en dur** |

Tout ce qui a été mesuré depuis trois semaines — 2 mois livrés, 0,574 $ le mois,
F38, F41, les trois classes de refus, la notation — l'a été **sur le harnais**.
Le chemin produit n'a jamais généré un mois, et il ne générerait pas le même.

### ⚠ Ce que cela change pour l'ouverture

`CONTENT_GENERATION_ARMED=true` sur la route actuelle rendrait un **501** : la
balayage mensuel n'est pas écrit. C'est une chance. **Armer une route qui
appellerait `generateMonth` mettrait en vente des mois sans mention de licence et
sans aucun des trente contrôles.**

La condition 4 de `B3` — « générer un mois par le PRODUIT » — n'est donc pas une
vérification de trente minutes. C'est un chantier : soit le chemin produit
appelle le générateur du harnais, soit le harnais devient le produit.

### Ce qui a été fait, et ce qui ne pouvait pas l'être

**Porté** — la libération des assignations, seul mécanisme indépendant du
générateur : `/api/cron/release-topics`, enregistrée dans `vercel.json`, avec sa
RPC déclarée dans `types/supabase.ts` (qui ne la portait pas, d'où le cast dans
le harnais).

**Extrait** — la décision du garde-fou dans `lib/content/bank-guard.ts`, port
injecté, éprouvée par le comportement. Prête pour le jour où un chemin produit
tirera de la banque. ⚠ **Elle ne comble rien aujourd'hui** : on ne garde pas une
banque que ce chemin ne consulte pas.

**Impossible à porter** — les dix-huit autres. Ils portent sur des payloads
d'archétypes composés, que le chemin produit ne produit pas.

### La décision à prendre, et elle n'est pas technique

Deux générateurs coûtent deux fois. Le harnais est celui qui est mesuré, contrôlé
et déontologiquement tenu ; le chemin produit est celui qui est branché aux
routes, au crédit d'images et à l'approbation. **Il faut choisir lequel survit**,
et ce n'est pas une décision que je prends seul :

1. **le harnais devient le produit** — sortir `20-month.ts` de `scripts/`, lui
   donner une entrée serveur, et retirer `generateMonth`. C'est le chemin mesuré,
   et le coût est celui de le rendre appelable depuis une route (pas de
   sous-processus, pas d'`argv`, un budget par requête) ;
2. **le chemin produit appelle le générateur du harnais** — plus petit en
   apparence, mais il laisse deux entrées et la question « laquelle a tourné » se
   posera à chaque incident.

⚠ **Un troisième choix existe et il est mauvais** : armer le chemin produit tel
quel « pour voir ». Ce serait mettre en vente des publicités sans mention de
licence.

---

## F46 — L'absence d'abréviation n'était pas un contrôle de vérification d'État

Trouvé en portant l'étage A de F45, le 2026-09-26.

F12 a établi la règle : `license_type_states` porte 240 couples (type de licence,
État) et une colonne `verified_at`. **Un État n'est vendable que lorsqu'une
personne a lu la règle publicitaire de son board.** C'est une vérification
manuelle, 20 minutes pour la Californie, et c'est tout l'objet de la fiche
`F12-comment-verifier.md`.

**Elle n'était pas appliquée sur le chemin de génération.** Deux fois :

1. **Le harnais lit `abbreviation` sans regarder `verified_at`.** Sa requête
   filtre sur `(license_type_id, state_code)` et prend l'abréviation quelle que
   soit sa vérification.
2. **Et même une abréviation nulle ne refuserait pas.** `licenceMention` fait
   `facts.abbreviation?.trim() || LICENCE_ABBREVIATION[type]` : il retombe sur une
   table du code, dix types, indépendante de l'État. La mention s'imprime.

Donc : un mois généré pour une praticienne d'un État dont personne n'a lu les
règles porte une mention de licence d'apparence correcte. ⚠ **C'est précisément
le cas que F12 existe pour empêcher**, et il passait.

`lib/brief/license-state.ts` le fait correctement — il ne rend l'abréviation que
si `verified_at` n'est pas nul. La règle existait donc, appliquée d'un côté et pas
de l'autre : encore la classe de F27.

### Corrigé côté produit, pas côté harnais

`preflight` porte une porte **séparée et explicite** — `stateVerified(typeId,
stateCode)` — qui échoue fermé : pas de couple vérifié, pas de génération. Elle
est distincte du contrôle de licence parce que ce sont deux questions : « le brief
porte-t-il de quoi écrire la mention » et « avons-nous le droit de vendre dans cet
État ».

⚠ **Le harnais n'est pas corrigé, et c'est délibéré.** Il tourne en local, sur des
comptes de test californiens, et sa précondition de licence est mesurée dans cet
état depuis trois sessions. Le modifier maintenant changerait le comportement du
seul pipeline dont on ait des chiffres. Il héritera de la porte quand il
deviendra le chemin produit (F45, étape 1).

### La question qui reste

Faut-il retirer le repli `LICENCE_ABBREVIATION` de `licenceMention` ? Il rend la
fonction tolérante là où la matrice est la seule autorité. Mais il sert aussi
l'écran de brief, où afficher « LMFT » avant qu'un État soit vérifié est utile et
sans risque. **Deux appelants, deux besoins** — la bonne réponse est probablement
un second point d'entrée strict plutôt qu'un repli retiré, et ça mérite d'être
décidé plutôt que deviné.

---

## F47 — Le port de crédit écrasait six motifs de refus sur sept

**Le quatrième mécanisme trouvé branché d'un seul côté**, après le dénominateur de
F41, la porte de vérification d'État de F46 et le verdict en dur du générateur
retiré.

`reserve_credit` distingue **sept** issues : `reserved`, `quota_exhausted`,
`not_entitled`, `no_quota_configured`, `no_user`, `unknown_kind`,
`invalid_cost`. Et son propre code porte l'avertissement qui explique pourquoi :

> ranger une violation de forme sous `quota_exhausted` est un **mensonge sur son
> compte**, et aurait envoyé quelqu'un sur une page de paiement acheter des
> crédits qu'elle avait déjà.

Le port TypeScript rendait `string | null`. Les six refus devenaient un `null`,
et `withPaidCall` levait `QuotaRefused` pour tous. **Le SQL prenait soin de
distinguer ; la couche au-dessus jetait ce soin.**

| motif | ce qu'on annonçait | ce que c'est |
|---|---|---|
| `quota_exhausted` | quota épuisé | ✓ juste |
| `not_entitled` | quota épuisé | l'abonnement ne porte pas ce droit |
| `no_quota_configured` | quota épuisé | défaut de configuration de notre côté |
| `no_user` | quota épuisé | défaut de programmation |
| `unknown_kind` | quota épuisé | défaut de programmation |
| `invalid_cost` | quota épuisé | défaut de programmation |

### Corrigé

`CreditPort.reserve` rend un `ReserveOutcome` qui porte le motif. `ReserveRefused`
remplace `QuotaRefused` — le nom ne dit plus « quota », puisque cinq motifs sur
six n'en sont pas un — et `aPurchaseWouldHelp(reason)` dit lequel des deux cas
mérite une page de paiement. Un huitième motif futur devient `"unknown"`, jamais
`quota_exhausted`.

⚠ **Et une panne de transport n'est plus un refus.** La base tombée ne dit rien du
droit de la praticienne ; le port lève au lieu de rendre `{ok:false}`.

---

## F48 — Mon propre recensement a flatté quatre fois de suite

À consigner parce que c'est un défaut d'INSTRUMENT, et qu'un instrument qui
flatte est pire qu'un instrument absent : il produit un vert que personne ne
cherche à vérifier.

Le recensement harnais/produit a pris quatre formes en une session, et **les
quatre se trompaient dans le même sens** :

| forme | ce qu'elle comptait | le biais |
|---|---|---|
| 1 | le fichier du harnais seul | **perdait** un mécanisme dès qu'on le déplaçait dans `lib/` — une exemption devenait « périmée » alors que le mécanisme était là, ailleurs |
| 2 | la chaîne transitive du harnais | **ramassait** tout le CRUD de `lib/data/content.ts`, qui n'est pas de l'orchestration de mois |
| 3 | la chaîne transitive du produit | comptait les imports de `run.ts`, **le générateur qu'on retire** ; et comptait les `export function check…(` de `month-checks.ts` comme des **appels** |
| 4 | idem, définitions exclues | comptait un appel écrit DANS un module que rien n'invoque : `checkMonth` appelle `checkPostAlone`, donc `checkPostAlone` paraissait branché alors que rien n'appelle `checkMonth` |

À chaque étape, la correction faisait **baisser** le nombre de mécanismes
« portés ». C'est le signe qu'il faut chercher : une mesure qui s'améliore en
montant est suspecte.

### La forme retenue, et son biais assumé

**Les deux côtés sont des listes nommées.** Porter un mécanisme veut dire inscrire
son module dans `PRODUCT_ORCHESTRATION` — un geste délibéré, qu'une relecture
voit. Un module partagé figure sur les deux listes, et c'est ce que « porté » veut
dire.

⚠ **Le biais est de SOUS-COMPTER, délibérément.** Un recensement qui surestime
rend un vert faux, qu'on ne cherche pas ; un recensement qui sous-estime rend un
rouge qu'il faut résoudre — en portant, ou en écrivant une raison nommée. C'est la
même règle que « échouer fermé », appliquée à une mesure.

### ⚠ Ce que cela dit des trois autres

F41, F46 et F47 ont tous la même forme : une valeur produite avec soin d'un côté,
lue avec négligence de l'autre. F48 ajoute le cas où **l'instrument de mesure
lui-même** en est la victime. Les quatre ensemble font une règle :

> Quand une mesure va dans le sens qu'on espère, chercher ce qu'elle compte de
> travers avant de s'en réjouir.

---

## F49 — Six règlements de crédit portent sur `null` et ne font rien

**Trouvé le 2026-09-26**, en retraçant la fidélité de `lib/content/month/assemble.ts`
à l'assemblage du harnais.

`candidate.reservationId` n'est affecté à une valeur non nulle qu'à **un seul
endroit** de `scripts/local-render/20-month.ts` : après un insert réussi. Or six
appels `settle(candidate.reservationId, …)` sont placés **avant** ce point —
échec de collecte du lot, échec de réparation, refus déontologique, échec du
moteur, refus du portillon, candidats écartés. Tous les six reçoivent `null` et
ne font rien.

### Ce qui n'est pas perdu, et ce qui est faux

**L'argent n'est pas perdu.** La surgénération est un frais général, et une
réservation de phase règle le lot entier à son coût réel. Le total facturé est
juste.

**Six lignes affirment pourtant une comptabilité qu'elles ne font pas.** Et la
session précédente en a *élaboré une* — le règlement du portillon, passé de 0 au
coût réel sous F40 — en croyant que cela changeait un chiffre.

### Ce qui a été fait, et pourquoi pas la suppression

Le fait est rendu **visible** plutôt que corrigé à l'aveugle :

```ts
if (!reservationId) {
  settlesWithoutReservation += 1;
  return;
}
```

et `settlesWithoutReservation` figure au rapport de fin de run, à côté de
`inserts`.

> Les retirer sans pouvoir rejouer un mois réel serait échanger un mensonge
> visible contre un trou invisible.

Le compte fournisseur est sous limite d'usage jusqu'au 1er octobre : le prochain
mois réel dira lequel des six doit disparaître et lequel doit recevoir une vraie
réservation.

---

## F50 — La liste « produit » du recensement n'a pas de point d'entrée

**Trouvé le 2026-09-26**, en appliquant la règle de F48 *avant* de publier un
compte qui montait : sept mécanismes portés, puis neuf.

`app/api/cron/content-month/route.ts` — la seule porte du chemin produit —
n'importe que `authorizeCron` et `contentGenerationArmed`. Elle n'appelle **ni**
le préalable, **ni** le port de crédit, **ni** la garde de banque, **ni**
l'assemblage.

Donc quatre des sept racines de `PRODUCT_ORCHESTRATION` sont des **modules que
rien n'invoque**, et les inscrire comme racines les a déclarés points d'entrée
alors qu'aucun ne l'est.

### ⚠ La forme nommée de F48 n'a pas supprimé le défaut, elle l'a déplacé

F48 visait « un appel écrit DANS un module que rien n'invoque ». La liste nommée
a déplacé le même défaut d'un cran : ce n'est plus la chaîne transitive qui se
trompe, **c'est le choix des racines**. Une liste nommée n'est pas plus vraie
qu'une chaîne calculée ; elle est seulement plus lisible.

### Les deux nombres, tenus séparés

| | compte |
|---|---|
| extraits, éprouvés, sans CLI-isme | **9** |
| atteignables depuis un fichier que le runtime invoque | **1** (`release_stale_topic_assignments`, par sa route planifiée) |

Les huit autres sont du code juste que personne n'appelle.

### Ce que le recensement fait maintenant

- `PRODUCT_ENTRY_POINTS` — et un test vérifie que chacun exporte vraiment un
  handler HTTP : une racine qu'on ne peut pas prouver invoquée n'en est pas une ;
- `EXTRACTED_NOT_WIRED` — chaque module porté sans appelant, avec sa raison, et
  un test qui **tombe** le jour où un point d'entrée l'atteint sans qu'on ait
  retiré sa ligne ;
- **une seconde serrure sur le 501**, indépendante des exemptions : un
  recensement pourrait devenir vert en exemptions tout en n'ayant toujours aucun
  appelant ;
- un test qui rend l'appartenance à `PRODUCT_ORCHESTRATION` **méritée** : pas de
  `process.argv`, `process.exit`, `spawn*` ni `console.*`. Un module qui en porte
  est un morceau de harnais déplacé, pas un module porté.

### ⚠ Le sixième mécanisme branché d'un seul côté, en six sessions

F46 (le portillon de vérification), F47 (les sept motifs de refus), F49 (les six
règlements), F50 (l'appelant lui-même), plus les deux trouvés cette session au
passage :

- **`abandon_stale_generation_runs()`** était en base depuis le 2026-09-23, et
  aucun fichier TypeScript ne l'appelait. Sans lui, une ligne `submitted` de plus
  de vingt-neuf jours reste ouverte et `content_generation_runs_unique` empêche
  alors **tout nouveau mois pour ce kit** : la praticienne bloquée par la trace
  d'une panne d'il y a un mois. Branché sur le balai quotidien.
- **les deux tables du journal** (`content_generation_runs`,
  `content_generation_results`) n'étaient déclarées ni dans `types/supabase.ts`
  ni écrites par aucun TypeScript — la migration qui les crée dit pourtant
  noir sur blanc que sans elles « une génération mensuelle interrompue en
  production est intégralement reperdue et repayée ».

> La question n'est plus « y en a-t-il un autre ». C'est **la forme dominante des
> défauts de ce dépôt** : le SQL est écrit avec soin, en avance, et son appelant
> n'arrive jamais. Chercher le suivant se fait en partant du SQL, pas du
> TypeScript.

---

## F51 — La ronde du tirage vide la banque de sa famille quand les doublons refusent

**Trouvé le 2026-09-26**, en extrayant le tirage dans `lib/content/month/draw.ts`.

Quand un sujet est refusé par le dédoublonnage — ni pénurie, ni plafond
praticienne — rien ne sort de `live` et `taken` ne monte pas : le tour
recommence. `assign_topic_to_kit` rend un sujet **différent** à chaque appel,
puisqu'il vient de marquer le précédent assigné, donc la boucle finit bien — mais
elle finit en **assignant puis refusant tout le reste de la famille**.

### ⚠ C'est une cause plausible des 994 assignations orphelines

Chaque refus part dans `releasedEarly`, donc tout se répare **si l'appelant
relâche**. Un run tué au milieu ne relâche rien, et le segment entier reste
bloqué trois heures — la fenêtre de `topic_assignment_grace()`.

### Pourquoi le garde-fou n'est pas posé

S'arrêter après un tour infructueux changerait le nombre de candidats d'un mois,
donc son mélange, donc les chiffres mesurés. Or cette extraction est une
**délégation** : le harnais appelle le module. Un portage qui modifie le
comportement du seul pipeline mesuré n'est pas un portage.

J'ai écrit le garde-fou, puis je l'ai retiré : il aurait fait passer les tests en
changeant silencieusement le tirage. Un mois réel tranchera — et la mesure à
prendre est le nombre d'assignations par candidat retenu, pas le nombre de
candidats.

---

## F52 — Le contrôleur de signatures RPC héritait des paramètres de la voisine

**Trouvé le 2026-09-26**, et *pas* en le cherchant.

`lib/__tests__/rpc-signatures.test.ts` lisait la déclaration d'une fonction dans
une fenêtre de **600 caractères à l'aveugle** après son nom. Or `Args: never` ne
correspond à aucune des deux formes cherchées (`{…}` ou `Record<…>`) : la
recherche continuait dans la fenêtre et attrapait le `Args: { … }` de la fonction
**suivante**.

Conséquence : une fonction sans argument héritait des arguments de sa voisine, et
le contrôleur exigeait alors d'un appel juste qu'il envoie un paramètre qui
n'existe pas.

**Vingt-quatre fonctions sur deux cent vingt-quatre** portent `Args: never`.
Toutes étaient exposées à la même méprise.

### ⚠ Ce qui l'a révélé, et ce que ça dit

`release_stale_topic_assignments` n'était appelé que par un **alias local**
(`rpc(...)`, sans point), que l'extracteur de sites ne voit pas — il cherche
`.rpc("`. En le faisant passer par une couture partagée qui écrit `db.rpc(...)`,
le site est devenu visible et le défaut a parlé.

Donc :

1. le défaut dormait depuis que le contrôleur existe, et rien ne l'aurait
   réveillé sans un appel nouveau ;
2. **l'extracteur de sites a un angle mort qui reste** : tout appel passant par un
   alias local est invisible à ce contrôleur. Le harnais en avait deux.

Corrigé : la fenêtre s'arrête à la déclaration suivante, `Args: never` vaut
explicitement « aucun paramètre », et trois tests vérifient désormais que le
lecteur ne confond pas deux voisines — dont un qui parcourt les vingt-quatre.

> Un contrôleur qui se trompe accuse le code juste. Celui-là a failli faire
> réécrire une couture correcte.

---

## F53 — Rien ne vérifiait qu'une exemption soit encore nécessaire

**Trouvé le 2026-09-26**, en cherchant pourquoi `licenceMention` figurait encore
dans la carte d'exemptions.

`ONLY_IN_HARNESS` portait trois tests : que chaque entrée dise pourquoi, que
chacune concerne un mécanisme encore présent dans le harnais, et que la carte ne
porte rien d'inexistant. **Aucun ne vérifiait que le mécanisme soit encore absent
du produit.**

Deux exemptions ont donc survécu une session entière après leur portage :

| exemption | ce qu'elle disait | ce qui était vrai |
|---|---|---|
| `licenceMissingMessage` | « ⚠ CELLE-CI EST GRAVE … un mois produit ne porterait AUCUNE mention » | appelée par `month/preflight.ts` depuis l'étage A |
| `licenceMention` | « la mention se compose sur la carte, et le chemin produit ne compose pas de cartes » | idem |

Le « ⚠ CELLE-CI EST GRAVE » était vrai à l'écriture et faux depuis. C'est une
ligne qui rassure faussement dans un sens, et qui aurait menti dans l'autre le
jour où le mécanisme disparaît.

### ⚠ Le biais de F48, dans l'autre sens

F48 disait : une mesure qui s'améliore en montant est suspecte. Le pendant est
qu'une exemption de trop fait paraître le portage **moins** avancé qu'il n'est —
donc personne ne la cherche. Un compte qui flatte se fait relire ; un compte qui
se rabaisse passe pour de la prudence.

### La forme retenue

Deux cartes aux obligations **opposées**, et un test pour chacune :

- `ONLY_IN_HARNESS` — le produit ne doit **pas** l'appeler ;
- `ON_BOTH_SIDES` — le produit **doit** l'atteindre, transitivement, et la ligne
  dit par quel chemin.

Les deux étaient mélangées, et c'est le mélange qui empêchait d'écrire le test :
une entrée était là pour dire le contraire des autres (`checkEthics`, présent des
deux côtés, listé pour information).

### ⚠ Et `checkEthics` n'est atteint que transitivement

Le recensement direct lit la source des fichiers nommés. `checkEthics` n'y
apparaît pas : il est appelé par `checkAdvertisingEthics` dans
`lib/content/month-checks.ts`, que `month/select.ts` atteint. Le test de
`ON_BOTH_SIDES` traverse donc la chaîne, là où celui des exemptions lit la source
directe — deux règles différentes pour deux affirmations différentes, ce qui est
la seule façon de ne pas confondre « appelle » et « peut atteindre ».

---

## F55 — « Un mois qui échoue n'est jamais livré » n'était pas un contrôle

**Mesuré le 2026-09-26 sur la base locale**, pas craint.

`content_months` portait un mois de trente posts en `proposed`, avec trente posts
en base — et son livre de crédit disait : **30 réservations, 0 règlement, 30
libérations**. Or le harnais ne libère les crédits d'un mois livré que dans un
seul cas :

```ts
const monthPasses = selection.remaining.length === 0;
for (const candidate of delivered) await settle(candidate.reservationId, cost, monthPasses);
```

Ce mois-là avait donc été **refusé par ses propres contrôles**, et il était en
base, en `proposed`, indistinguable d'un bon mois. Une session ultérieure l'a relu
comme un mois livré — la mienne, pour le rejeu.

### La cause est un ordre

Les posts étaient écrits **avant** que le verdict de mois existe, et le verdict ne
décidait plus que des crédits et du code de sortie. Le seul endroit où le refus
était écrit est un code non nul dans un terminal que personne ne garde.

### Deux conséquences, et la seconde vaut de l'argent

1. Un mois refusé reste visible à la praticienne.
2. Un mois « livré » peut avoir consommé **zéro quota** : `credit_balances.consumed`
   valait 0 pour ce mois. Le plafond de trente posts par mois n'a donc contraint
   aucun des mois récents du harnais.

### Corrigé

`assembleMonth` **n'écrit rien** tant que `selection.remaining` n'est pas vide : le
banc a servi, les échanges ont eu lieu, et s'il reste un constat le mois ne
s'écrit pas du tout. L'orchestrateur le dit, rend les sujets, et ferme la ligne du
mois en `failed`.

Et les réservations se **soldent** désormais, au coût réparti — le premier mois
sorti du chemin produit avait laissé vingt-neuf réservations sans issue, quota juste
et livres muets.

---

## F56 — ⚠ Chaque carte téléchargée sortait sans numéro de licence

**Trouvé le 2026-09-26 en vérifiant un mois sorti du chemin produit.** C'est le
défaut le plus grave de la série.

`content_items` n'a pas de colonne de pied : la carte est **recomposée à la
lecture**, par `cardBands(item, practiceName, licence)`. Le paramètre `licence`
était **facultatif**, et le seul appelant de production ne le passait pas :

```ts
const bands = cardBands(item, practiceName);   // lib/content/review.ts:101
```

`reviewCardFor` est partagé par **l'écran de relecture** et par
**`app/api/content-items/[id]/image`** — la route qui produit le fichier que la
praticienne publie. Le repli rendait le nom du cabinet seul.

Donc chaque carte affichée et chaque image téléchargée était une **publicité sans
numéro de licence**, ce que la Californie exige dans toute publicité d'un
praticien licencié (B&P §651). C'est exactement l'infraction que F45 reprochait à
l'autre générateur — vivante, sur le chemin de lecture, pendant que la composition
à l'écriture la portait.

### ⚠ Et un test bénissait le défaut

```
it("sans mention, le pied est celui d'avant", …)   → expect(footer).toBe("Willow Clinic")
```

Il affirmait que l'omission était le comportement attendu. Un seul autre test
passait la mention, explicitement.

### Corrigé, et de la seule façon qu'on ne peut pas oublier

Le paramètre n'est plus facultatif : `licence: string | null`. Le compilateur a
nommé les deux appelants de production, et `null` est désormais une réponse
explicite — un brief incomplet — que `licenceMissingMessage` sait dire. Une
lecture unique, `licenceMentionFor`, résout la mention depuis le brief et la
matrice `license_type_states` en lisant `verified_at`.

**Prouvé** : trente cartes relues par le chemin de lecture, 30/30 portent
`LMFT 12345`, 30/30 vectorielles. Planche dans `design/production-first-month/`.

---

## F57 — `redundantAgainst` dépend de l'ordre, donc un mois qui passe peut échouer relu

**Trouvé le 2026-09-26** en rejouant un mois déjà livré à travers le tirage.

`redundantAgainst(titre, déjà_acceptés)` compare un titre à ceux **déjà acceptés**.
Le verdict dépend donc de l'ORDRE d'examen : rejouer un ensemble déjà dédoublonné
dans un autre ordre en refuse un.

Mesuré : les trente posts d'un mois livré, repassés par `drawMonth`, en ont perdu
un — puis `mix.dominant` est monté à 31,0 % (9/29) contre 30,0 % (9/30) à
l'origine, le plafond étant un dépassement strict. **Deux constats, une seule
cause, et la cause était le rejeu.**

Ce n'est pas un défaut du mois source : ses trente lignes de carte sont distinctes
une fois coupées à trente caractères.

### Ce que ça implique

Un contrôle dont le verdict dépend de l'ordre ne peut pas servir à **vérifier**
un mois déjà constitué — seulement à en **construire** un. Toute relecture d'un
mois existant à travers le tirage inventera des refus. À décider quand un mois
réel pourra être rejoué : ou bien le dédoublonnage devient symétrique (comparer
toutes les paires), ou bien il reste réservé à la construction et la relecture
utilise `checkMonth` seul.
