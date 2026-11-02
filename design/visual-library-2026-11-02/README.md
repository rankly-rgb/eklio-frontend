# Quatrième session — la luminance juste (F99), puis la monotonie structurelle (F102)

> **Étiquette.** Planche « après » : **orchestrateur complet** (`orchestrateMonthForKit`),
> base locale chargée de l'état de production, décembre **repris depuis son journal** —
> la même rédaction réelle (route cron, 57 posts, 2026-11-01) que les deux planches de la
> session précédente ; seul le juge de complétude est rappelé (non déterministe, F101).
> Cartes par `card-store` (`serverCardRasteriser`), dépôt Storage remplacé par le disque.
> **Planche « avant »** : celle de la session précédente,
> `design/visual-library-2026-11-01/planche-apres/` — même mois, même journal, moteur
> d'avant F99. F99 ne change pas la palette de ce kit (vérifié : aplats et encres
> identiques), donc elle vaut état actuel.
> `nuancier-f99.jpg` : les 12 variantes du catalogue avant/après — harnais (rendu
> direct des palettes), pas le chemin de production.

## F99 — une seule colorimétrie

`lib/brand/color.ts` porte luminance, contraste et Lab ; `lib/compose/palette.ts`,
`lib/kit/render/luminance.ts` et `lib/brand/shapes.ts` l'importent.
`lib/__tests__/one-colorimetry.test.ts` lit le code source (lib, app, components,
scripts) et échoue sur toute seconde implémentation — **0 trouvée**.

| Variante | Encre / papier | Aplats (encre sur aplat), avant → après | Texte sur photo, pire pixel | Licence sur photo | Dessin sur photo |
|---|---|---|---|---|---|
| plum_bone clair | 15,65 → 15,65 | 11,82 / 5,84 / 3,43 / 8,40 → 11,82 / 5,84 / 4,56 / 8,40 | 7,21 | 7,21 | 4,25 |
| plum_bone sombre | 15,65 → 15,65 | 13,06 / **2,59** / 8,61 / 4,51 → 13,06 / **8,21** / 8,61 / 4,91 | 7,20 | 7,20 | 3,89 |
| clay_sand clair | 13,31 → 13,31 | inchangés : 10,33 / 7,63 / 6,21 / 6,17 | 7,25 | 7,25 | 4,16 |
| clay_sand sombre | 13,31 → 13,31 | inchangés : 5,27 / 4,01 / 7,68 / 8,84 | 7,13 | 7,13 | 3,76 |
| ink_blue_chalk clair | 15,18 → 15,18 | 11,31 / 7,40 / 5,82 / 8,97 → 11,31 / 7,40 / 5,82 / 4,62 | 7,29 | 7,29 | 4,22 |
| ink_blue_chalk sombre | 15,18 → 15,18 | 12,23 / 6,32 / 8,24 / 3,97 → 12,23 / 5,29 / 8,24 / 6,75 | 7,29 | 7,29 | 3,79 |
| olive_chalk clair | 13,63 → 13,63 | inchangés : 10,17 / 3,78 / 6,60 / 6,75 | 7,28 | 7,28 | 4,12 |
| olive_chalk sombre | 13,63 → 13,63 | 5,48 / 10,25 / 7,53 / 4,42 → 5,16 / 10,25 / 7,53 / 4,78 | 7,30 | 7,30 | 3,72 |
| ochre_paper clair | 14,90 → 14,90 | inchangés : 11,69 / 5,44 / 9,41 / 7,08 | 7,29 | 7,29 | 4,28 |
| ochre_paper sombre | 14,90 → 14,90 | inchangés : 4,16 / 8,93 / 8,55 / 12,32 | 7,13 | 7,13 | 3,90 |
| slate_bone clair | 14,60 → 14,60 | 11,13 / 4,15 / 7,28 / 8,49 → 11,13 / 4,43 / 5,65 / 10,07 | 7,37 | 7,37 | 4,19 |
| slate_bone sombre | 14,60 → 14,60 | 8,91 / 3,88 / 8,16 / 13,11 → 8,76 / 4,94 / 8,16 / 13,11 | 7,14 | 7,14 | 3,82 |

Planchers : texte sur papier/photo 4,5:1 ; texte sur aplat 3:1 (`TINT_INK_MIN_CONTRAST`,
inchangé) ; dessin 3:1. **Surfaces sous un plancher : 1 avant (plum_bone sombre aplat 2,
2,59:1), 0 après.** Photo : 12 variantes × 27 fonds, mesuré sur le rendu.

**Déplacement visuel.** 12 aplats sur 48 bougent (ΔE76 : 0,8 à 30,9 — médiane ~6) ;
papiers, encres principales, primaires et secondaires inchangés. Six aplats changent
d'encre (sombre ↔ claire). Le seul changement franc : slate_bone clair, aplat 3, passe
d'un gris clair à l'ardoise du primaire (ΔE 30,9). Les palettes se reconnaissent.

## F102 — la monotonie structurelle

**Signature** (`lib/compose/structure.ts`) : lue dans le SVG livré — disposition des
aplats (aucun / colonne / bandes pleine largeur / rangée / grille), place du dessin par
rapport à eux, fond (photo / papier). Éprouvée sur la planche : numbered_strategies et
cycle donnent la même image ; surface_and_beneath s'en distingue.

**Contrôle** : `structure.dominant`, au plus 25 % du mois par signature (7 sur 30), le
dernier post de la signature dominante échangé. **Fonds photo** : rouverts à toutes les
mises en page (mesure : 6 mises en page × 12 variantes × 14 fonds, texte ≥ 7,13:1,
dessins ≥ 3,71:1, 0 échec), une carte sur deux selon le rang du dessin.

| Mesure | Avant | Après |
|---|---|---|
| Signature la plus fréquente | **11/30** (phrase sur photo) | **7/30** |
| Signatures distinctes | 5 | 8 |
| Cartes avec fond photo | 11/30 | **16/30** |
| Mention de licence lisible | 30/30 | 30/30 (16/16 sur photo, pire pixel 7,25:1) |
| Cartes sans dessin, forme ni fond | 0 | 0 |
| Surfaces sous un plancher | 1 (palette, F99) | 0 |
| Secondes implémentations du contraste | 2 (+ une luma gamma) | **0** (test) |
| Mois sorti à 30 posts | oui | **oui** — 12 échanges, tous de tournure (F80), aucun de structure |
| Même fond à moins de dix posts | 0 | **1** (bg-curtain-light, cartes 21 et 28 — F96) |
| Coût de la session | | **0,057 $** (journal du run : 0,880 → 0,936) |
