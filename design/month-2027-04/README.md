# Avril 2027 : F131 corrigé, mois livré à trente (2026-11-05)

**Provenance.** Avril 2027 a été rédigé à neuf par l'orchestrateur complet, avec la
configuration `eafdf83`, et publié à 30 dans la base locale. Les cartes sont rendues par le
chemin `card-store` et réduites à 390 px (`planche/planche-390.jpg`).

| Mesure | Mars 2027 | Avril 2027 |
|---|---|---|
| Mois sorti à 30 | oui | **oui** |
| Formats distincts par fenêtre de neuf (22 fenêtres) | de 1 à 2 | **3 dans toutes** |
| Format le plus présent dans une fenêtre de neuf | 9 | **5** |
| Plus longue série d'un même format | 14 | **2** |
| Rythme des fonds : voisins identiques, fenêtres en défaut | 2, 0 | 2, 0 (aucune dégradation) |
| Cartes sous le plancher de remplissage (contrôle du moteur) | 5 (cartes 1, 3, 26, 28, 29) | **0** |
| Cartes praticiennes à lignes de fiche | 1 (carte 25) | 0 |
| Cartes vides | 0 | **0** |
| Licence lisible ≥ 4,5:1 | 30/30 | **30/30** (pire : 4,72) |
| Emphase valide | 23/30 | 23/30 |
| Cartes sans dessin, sur photo | 4 | 5, toutes en `photo_statement` |
| Coût du mois (journal) | 0,7014 $ | **0,6942 $** |

La carte 25 de mars, d'avant la correction, est dans
`../month-2027-03/planche/cartes/25-practitioner_card.jpg`. Depuis `413e17f`, son payload
est refusé par `identity.briefLabel`, et la carte praticienne n'entre plus dans la ronde.
