# Le mois de février 2027 (session 11, 2026-11-05) : refusé sur `mix.list`

Configuration : `7bbbf5a`. Elle porte les plafonds tranchés (listes à 14, phrase seule à
35 %), le quota d'ouverture au portillon et le portillon aligné sur « zéro carte vide ».
Février a été rédigé parce que le plafond de dépense mensuel comptait déjà les mois de
décembre et de janvier.

| Mesure | Session 9 | Session 11 |
|---|---|---|
| Mois sorti à 30 | non | **non** — un seul constat : `mix.list` 16/30, plafond 14 |
| Posts perdus avant le portillon, faute de dessin | 13 | **2** |
| Échanges consommés par le quota d'ouverture au portillon | — | 12 (« when… » 9, « after… » 2, « a unwanted… » 1) |
| Ouverture la plus fréquente dans le mois | 7/30 | sous le plafond : aucun constat `variety.opening` |
| Posts à phrase après le portillon | 14 | **25** (13 phrases seules, 11 carrousels, 1 praticienne) |
| Posts à phrase admissibles, et nécessaires | 20 et 18 | 21 et 16 |
| Posts à phrase retenus par le sélecteur | 14 | **14** (7 phrases seules, 6 carrousels, 1 praticienne) |
| Entonnoir : tirés, arrivés, portillon, retenus, écrits | 57, 44, 41, 30, 0 | 57, **55**, 43, 30, 0 |
| Coût du mois (journal) | 0,6786 $ | 0,6839 $ |

**La cause.** Les posts à phrase étaient là : 25 pour 16 nécessaires. C'est l'échange du
sélecteur qui ne les prend pas. `mix.list` tombe dans la branche générique de
`selectDeliverable` (`finding.check.startsWith("mix.")`). Cette branche retire le dernier post
de l'archétype le plus fréquent (`single_statement`, une phrase) et prend le premier du banc,
quelle que soit sa forme. Sur 13 échanges : 9 au titre de `mix.list`, 2 de `mix.dominant` et 2
de `mix.floor.statement`. Il reste 7 phrases seules retenues, sur 13 disponibles.
