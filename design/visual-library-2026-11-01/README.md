# Bibliothèque de visuels — planche de décembre 2026 (2026-11-01)

> **Étiquette — ce qui n'est PAS exactement le chemin de production.**
> Les 30 posts sont ceux de **décembre 2026 écrits en production** (kit `45de0dac`,
> relus en lecture seule : `december-2026-posts.json`), **pas réécrits par
> l'orchestrateur** : le compte OpenAI est à court de crédit
> (`insufficient_quota` / `credit_balance_exhausted`, constaté le 2026-11-01 à la
> troisième répétition), la rédaction est bloquée. L'orchestrateur n'est donc pas
> appelé de bout en bout. Ses deux étapes visuelles le sont, telles quelles :
> `illustrateMonth` (le port `illustrate`, sur l'ordre de publication, comme le
> `redraw` du sélecteur) puis `composeCard`, avec la palette, le pied et la
> mention de licence que `run-for-kit` leur passe. La carte gardée est décidée
> par `reviewCardFrom` et rendue par `serverCardRasteriser` (vraies polices),
> comme `card-store` ; le dépôt Storage est remplacé par une écriture disque
> (pas de Storage local). Kit, cabinet et licence lus dans la base locale
> chargée de l'état de production. Le surtitre retombe sur le titre (pas de
> sujet de banque lu) : en production il vient du libellé d'angle du sujet.
>
> Harnais : `scratchpad/rehearsal/cards-dec.ts`, `planche-dec.ts`, `sheet.py`.

## Les fichiers

- `planche/planche-390.jpg` — les 30 emplacements, **chaque carte à 390 px de
  large** (la largeur d'un téléphone dans le fil), numérotés, avec l'archétype
  posé, le dessin et le fond photo.
- `planche/cartes/NN-archetype.jpg` — chaque carte seule, à 390 px.
- `planche/mesures.json` — les mesures carte par carte.

## Mesures (lues, pas estimées)

| Mesure | Valeur |
|---|---|
| Cartes composées | **28 / 30** — #19 « EMDR in Oakland » et #24 « Old patterns, present cues » sont écartés : aucun dessin au-dessus du seuil. En production le sélecteur prend un remplaçant au banc ; ici, sans rédaction, l'emplacement reste vide et le dit. |
| Cartes avec illustration de la bibliothèque | **28 / 30** (28 / 28 composées) |
| Cartes avec fond photo | **11 / 30** (toutes les phrases seules et les couvertures de carrousel, palette claire) |
| Cartes avec forme derrière le titre | 17 / 30 (les autres ont la photo) |
| Cartes sans illustration, ni forme, ni fond | **0** |
| Mention de licence lisible sur fond photo | **11 / 11** — pire pixel sous la bande du pied ≥ 4,5:1 contre l'encre, mesuré sur le rendu |
| Mention de licence présente au pied | 28 / 28 |
| Même dessin à moins de dix posts | 0 |
| Même fond photo à moins de dix posts | 0 |
| Couverture thématique, décembre | **28 / 30 — 93 %** (24 / 30 sans quatre appariements douteux, voir plus bas) |
| Couverture, banque (186 sujets) | 180 / 186 — 97 % |
| Dessins distincts dans le mois | 22 |
| Dessins tirables jamais choisis ce mois-ci | 70 / 92 |
| Dessins jamais appariés à aucun sujet de la banque | 17 : anger-gauge, anger-pressure-valve, anger-storm-cloud, anx-iceberg, anx-tangled-thread, bound-door-ajar, bound-raised-palm, bound-two-rooms, change-set-aside-block, delay-icicle-thaw, eft-cord-between-hands, emdr-lighthouse, ground-feet-standing, pace-hourglass, pace-seedling-stages, practice-clock, rule-ruler |
| Dépense modèle du chantier | **0,79 $** (journal des runs, base locale) : 0,688 $ (répétition 7, mois refusé), 0,081 $ (8) et 0,026 $ (9) — ces deux dernières coupées par le crédit épuisé |

## Ce que les répétitions ont trouvé, et qui est corrigé

1. **L'écart de dix se jugeait sur la réserve, pas sur le mois** (répétition 7 :
   `prot-thorn-branch` à neuf posts, mois refusé). Les dessins sont maintenant
   rejoués sur l'ordre retenu à chaque tour du sélecteur.
2. **Un carrousel refusé revenait en couverture vide**, que le décor faisait
   passer pour une carte (#8, #10). Une couverture n'est plus jamais une carte.
3. **Le contour d'harmonisation débordait** jusque dans le dégagement du pied :
   le moteur refusait des phrases seules (#30). L'encre reste dans sa place.

## Appariements douteux (comptés dans les 28)

`bound-drawn-line` deux fois (#4, #18) via « deciding » ; `agency-lantern` (#2)
via « hope » ; `agency-compass` (#15) sur « Curiosity about patterns ». Ils
passent le seuil ; je ne l'ai pas monté pour les écarter.

## Ce que la planche montre et qu'aucune mesure ne dit

- Dans `concentric_control`, le dessin vit dans le petit cercle central (#17,
  #18) : lisible, mais petit.
- La forme derrière le titre est très discrète (teinte de la palette sous un
  titre qui doit tenir 4,5:1 dessus) ; elle se voit à peine à 390 px.
- `eft-shelter` (#14, #27) se réduit à un chevron : le dessin du pack est
  minimal.
