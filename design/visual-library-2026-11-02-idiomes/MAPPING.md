# Les 14 idiomes — mapping écrit avant de coder (2026-11-02)

Source : `spec-visuelle-eklio.zip` (spec.html, style2.css). Une colonne « fait » dit ce que
cette session livre ; le reste est nommé, pas à moitié codé.

| # | Idiome (spec) | Archétype qui le rend | Nouveau ? | Surfaces de texte | Fond | Cette session |
|---|---|---|---|---|---|---|
| 1 | Photo en arche | — | **abandonné (2026-11-04)** : la colonne à côté de l'arche ne tient pas 4 lignes à 80 px (52 % des phrases de 31–40 car., F120) | — | — | **abandonné** |
| 2 | Photo en cercle | single_statement | non (rendu) | statement, eyebrow, signature | crème | non |
| 3 | Photo pleine, texte sur courbe | — | **oui** : `arc_statement {arc, statement}` | arc (italique serif sur grand rayon), statement | photo | non |
| 4 | Courbe autour d'un dessin | — | **oui** : `ring_statement {ring, statement}` | ring (capitales espacées), statement | ocre | non |
| 5 | Grille, taches décalées | — | **oui** : `grid_six {cells[6]{label}}` + un dessin apparié par cellule | 6 libellés | crème | non |
| 6 | Bulles reliées | cycle (`nodes`) | non (rendu) ; connecteurs calculés | libellés des nœuds | crème | non |
| 7 | Pilules à case | numbered_strategies (`items`) | non (rendu) | libellés (+ glose) | crème | non |
| 8 | Interrupteurs | — | **oui** : `practice_offers {rows[]{label, on}}` — l'état vient du BRIEF, jamais du modèle (une offre affirmée est une publicité) | libellés | crème | non |
| 9 | Grand dessin, fond plein | single_statement | non (rendu) | statement, signature | terracotta / ocre plein | **oui** |
| 10 | Citation, fond profond | single_statement | non (rendu) | statement (script), signature | profond | **oui** |
| 11 | Couches, sans boîtes | surface_and_beneath | non (rendu) | labels + gloses | crème | non |
| 12 | Carte praticienne | practitioner_card | non (rendu) ; monogramme dérivé du nom du cabinet | nom, crédit, lignes | crème | non |
| 13 | Couverture de carrousel | carousel (diapositive 1) | non (rendu) | statement, eyebrow « n/N », signature | photo + scrim | **oui** |
| 14 | Variante Cormorant du 9 | — | comparaison de serif, pas un idiome | — | — | (seuil de police : oui) |

**Pourquoi cet ordre.** Le même mois rédigé (journal de décembre) ne porte que les archétypes
de la banque : un archétype NOUVEAU (3, 4, 5, 8) n'apparaîtrait sur aucune des deux planches
sans payer une rédaction, et chacun ouvre une charge utile, un validateur, une entrée au schéma
et des surfaces à brancher sur les onze chemins d'écriture. Les rendus d'archétypes existants
(9, 10, 13 d'abord : ceux que Naima a nommés les plus forts et qui tiennent sur une phrase)
n'ouvrent AUCUNE surface de texte nouvelle : leurs chaînes sont les champs déjà contrôlés.

**Contradictions relevées dans la spec.**
- L'idiome 14 s'intitule « Variante serif Cormorant » mais sa classe `corm` passe le titre en
  **Fraunces** 122 px ; le 9 est en Cormorant 138 px. Les images sont justes, l'étiquette est
  inversée.
- La spec pose Cormorant à 74 px (arche), sous le « ~80 px » du prompt.
- Sous le plancher de 4,5:1, mesuré avec `contrastRatio` : signature `#746A60` sur ocre pastel
  (4,20) et terracotta pastel (4,12) ; italique d'accent `#C97B63` sur crème (2,94) et sur
  terracotta pastel (2,52) ; texte de courbe `#8A6A24` sur ocre pastel (4,01). Le moteur fonce
  ces encres dans leur teinte jusqu'au plancher ; il ne baisse rien.
