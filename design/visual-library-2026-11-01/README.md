# Bibliothèque de visuels — arrêt après l'étape 2 (2026-11-01)

> **Étiquette.** Aucune planche de cartes n'est produite ici. Le chantier s'est
> arrêté sur la clause « couverture thématique sous 70 % après l'étape 2 ». Les
> chiffres ci-dessous sont produits par le code du produit
> (`lib/visual-library/match.ts`) sur des **données de production relues en
> lecture seule** — les 30 posts du mois de décembre 2026 du kit `45de0dac` et
> les 186 sujets de la banque — et non par un rendu. Aucun modèle appelé.
>
> Reproduire : `bun scripts/visual-library/coverage.ts` (écrit `couverture.json`).

## La mesure qui arrête

| Mesure | Valeur |
|---|---|
| Décembre — posts qui trouvent une illustration **distincte** (règle d'anti-répétition) | **18 / 30 — 60 %** |
| Décembre — posts qui trouvent une illustration, répétitions permises | 21 / 30 — 70 % |
| Banque — sujets qui trouvent au moins une illustration | 162 / 186 — 87 % |
| Illustrations tirables | 64 (65 dessins, dont `xtra-wave-soft` sans thème) |
| Illustrations jamais appariées à aucun sujet de la banque | 14 |
| Coût | 0,00 $ — aucun appel de modèle |

Le seuil (`MATCH_THRESHOLD = 1`) a été fixé **avant** la mesure et n'a pas bougé.
Deux resserrements ont été faits en lisant les appariements (une expression
réduite à un mot par les mots génériques ; « open » rendu générique) : ils
corrigent des faux positifs, ils ne remontent pas la couverture.

## Pourquoi c'est bas

La banque ne parle que de deux situations : *le passé qui pèse encore*
(`carrying_old_thing`) et *le changement non choisi* (`crossroads`), à travers
EMDR, TCC et EFT (F80). Les dessins couvrent quatorze territoires — colère,
anxiété, limites, ancrage, rythme… Le mois tire trente sujets de deux
territoires, et ces deux-là ont peu de dessins :

| Illustration | Sujets de la banque qui la demandent en premier |
|---|---|
| grief-folded-map | 41 |
| grief-two-paths | 18 |
| mem-photo-frame | 14 |
| cbt-balance-scale | 9 |
| mem-rearview, eft-shelter, mem-echo-rings | 8 chacune |

L'anti-répétition fait le reste : le premier post « plan changé » prend la carte
pliée, le cinquième n'a plus rien de juste.

**Jamais appariées** (14) : anger-pressure-valve, anger-storm-cloud, anx-iceberg,
anx-tangled-thread, bound-door-ajar, bound-raised-palm, bound-two-rooms,
eft-cord-between-hands, eft-two-chairs, emdr-lighthouse, ground-feet-standing,
pace-hourglass, pace-seedling-stages, practice-clock.

## Ce qui manque au prochain lot

Les 24 sujets de la banque sans dessin, et les 12 posts de décembre restés vides,
parlent de cinq choses que la bibliothèque ne montre pas :

1. **Les schémas de protection** — « Protective Patterns, Not Defects », « Old
   Alarm, Present Life », « A Pause Before Old Patterns », « EFT listens for
   patterns ».
2. **Les vieilles règles** — « Old Rules, Present Life », « Updating Old Rules »,
   « The Rules That Stayed ».
3. **Ne pas tout raconter** — « EMDR Without Full Retelling », « More Than the
   Story », « EMDR Beyond One Story ».
4. **Le passé qui ne s'efface pas** — « The Past Need Not Vanish », « EFT Is Not
   Erasing », « CBT is not forgetting », « The Long-Ago Myth ».
5. **Les émotions qui arrivent en retard** — « When Feelings Catch Up »,
   « Feelings Aren't Detours », « Feelings can arrive later ».

Et, pour l'anti-répétition, **plusieurs dessins par idée dominante** :
« plan qui change / avenir qui n'arrivera pas » (au moins quatre), « le passé
dans le présent » (au moins quatre).

## Décembre, post par post

Voir `couverture.json` (`december.rows`) : l'illustration retenue, son score et
ce qui l'a fait monter. Plusieurs appariements retenus restent faibles (un mot
thématique plus le nom de la famille) — par exemple « A place for the past » →
`cbt-balance-scale`. Ils passent le seuil ; ils ne le dépassent pas de beaucoup.

## Non fait, par la clause d'arrêt

- Le branchement du refus dans le générateur : à 60 %, chaque mois serait refusé
  après avoir été payé.
- L'étape 3 (zéro carte vide). Mesuré au passage : décembre porte **7**
  `single_statement` sur 30 (titre et trait), pas 6.
- L'étape 4 et la planche de 30 cartes.
