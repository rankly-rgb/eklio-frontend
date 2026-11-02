# Planche de la session 6 — les idiomes 2, 6, 7 (2026-11-02)

**Provenance.** `planche-390.jpg` : les trente cartes du mois de décembre, produites par
l'orchestrateur complet en reprise de journal (la rédaction de décembre est réutilisée, pas
repayée ; mois sorti à 30), rendues par le chemin de production `card-store`, réduites à 390 px.
`cote-a-cote-spec.jpg` : à gauche les PNG de la spec, à droite la carte de la planche qui rend
le même idiome. `mesures.json` : mesures faites sur ces trente cartes (script de harnais,
étiqueté comme tel).

## Mesures (avant = planche de la session 5, après = cette planche)

| Mesure | Avant | Après |
|---|---|---|
| Idiomes implémentés (sur 14) | 3 (+ seuil serif) | 6 (2, 6, 7, 9, 10, 13) + seuil serif (14) |
| Cartes portant la pile de blocs | 16/30 | 12/30 |
| Signature la plus fréquente, fond exclu | « colonne · dessin à gauche » 8/30 | « aucun aplat · dessin seul » 7/30 (= plafond 25 %) |
| Remplissage vertical le plus bas | 45,9 % (mesuré, pas contrôlé) | 45,9 % citation (exemptée par la spec) ; 68,3 % hors exemptées ; contrôle à 2/3 qui refuse |
| Surfaces de texte non couvertes | 0 | 0 (aucune surface nouvelle : les idiomes rendent des champs existants) |
| Mention de licence ≥ 4,5:1 | 30/30 | 30/30 (pire : photo 4,76, profond 4,72, terracotta 4,72) |
| Encres de la spec restituées après classement | 0/4 | 0/4 — aucune ne tient même le plancher « grand texte » de 3:1 à sa taille rendue |
| Connecteurs des bulles | — | 10, 0 non ancré, pire contraste 3,63:1 |
| Mois sorti à 30 | oui | oui |

## Transpositions

- **Pilules (7)** et **bulles (6)** sont des rendus de `numbered_strategies` et `cycle` :
  aucune charge utile, aucun validateur, aucune chaîne nouvelle. La spec pose leurs libellés
  sur crème sans dessin ; le moteur garde le dessin du post à droite des pilules quand la place
  le permet, et le laisse sur photo (la photo tient lieu de visuel).
- **Cases cochées** : toutes cochées. Une case vide affirmerait quelque chose que la rédaction
  n'a pas écrit.
- **Connecteurs** : calculés du bord bas d'une bulle au bord haut de la suivante, jamais posés.
- **Cercle (2)** : photo du pack découpée par `clipPath`, réservé à la phrase seule sur crème
  hors carrousel. Pas d'italique coloré (F108).
- **Remplissage** : le contrôle (2/3 de la bande utile) ne s'applique qu'aux cartes illustrées ;
  citation et couverture de carrousel en sont exemptées parce que la spec les dessine ainsi.
