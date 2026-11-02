# Cinquième session — la spécification visuelle, codée (2026-11-02)

> **Étiquette.** Planche « après » : **orchestrateur complet** (`orchestrateMonthForKit`),
> base locale chargée de l'état de production, décembre **repris depuis son journal**
> (la rédaction réelle de la répétition 10 : 57 posts) ; cartes par `card-store`
> (`serverCardRasteriser`), dépôt remplacé par le disque. **Planche « avant »** :
> `design/visual-library-2026-11-02/planche-apres/` — même mois, même journal, moteur
> d'avant cette session. Les maquettes de la spec (à gauche dans `cote-a-cote-spec.jpg`)
> sont écrites à la main : ce ne sont pas des rendus du moteur.

- `MAPPING.md` — les 14 idiomes, écrits avant de coder ; contradictions de la spec.
- `planche-apres/planche-390.jpg` — chaque carte à 390 px ; `mesures.json`.
- `cote-a-cote-spec.jpg` — spec / moteur, idiome par idiome.

## Mesures

| Mesure | Avant | Après |
|---|---|---|
| Idiomes implémentés | 0 / 14 | **3 / 14** (9 grand dessin, 10 citation, 13 couverture) + le choix de serif (14) |
| Idiomes rendus sur ce mois | — | grand dessin 3, citation 1, couverture 1 (les deux autres fonds profonds : phrase seule ordinaire — leur phrase passe 4 lignes de script à 96 px) |
| Répartition des 5 fonds sur 30 | crème/papier 14, photo 16 | **crème 13, photo 9, profond 3, ocre 3, terracotta 2** |
| Rythme (grille de 9) | — | 0 voisin identique hors crème ; 22/22 grilles avec ≥ 3 non-crème dont ≥ 2 sombres (au pire 4 non-crème) |
| Signature structurelle la plus fréquente | 7 / 30 | **7 / 30** (« colonne · dessin à gauche · crème ») — 17 signatures distinctes ; plafond maintenu à 25 % |
| Titres avec un mot seul en fin de ligne | non mesuré | **0** |
| Connecteurs non ancrés | — | **sans objet** : l'idiome à connecteurs (bulles) n'est pas codé |
| Remplissage vertical le plus bas | — | **45,9 %** de la hauteur (carte 26, phrase seule sur profond) ; 47,1 % (carte 21) ; les autres ≥ 74 % — mesuré, pas encore contrôlé |
| Surfaces de texte non couvertes | — | **0** — `spec-visuelle.test.ts`, dérivé du rendu de chaque archétype sur chaque fond |
| Mention de licence lisible | 30/30 | **30/30** — par fond, au pire pixel : crème 4,82, photo 4,76, ocre 4,81, terracotta 4,72, profond 4,72 |
| Cartes sans dessin, forme ni fond | 0 | 0 |
| Mois sorti à 30 posts | oui | **oui** (3 posts sans dessin remplacés par le banc) |
| Coût de la session | | **0,107 $** — journal du run : 0,936 → 1,043 |

## Transposé plutôt que copié

- `text-wrap: balance` → un calcul de coupure (programmation dynamique, à nombre de
  lignes égal, la plus longue ligne minimale), qui refuse une dernière ligne d'un mot.
- Le cadre flexbox 96 / 80 / 170 et `justify-content: center` → les bandes du moteur :
  le contenu s'arrête à 64 px du pied ; le centrage est calculé.
- Signature : 25 px Karla centrée, mais dans la bande de pied du moteur (≈ 1 250 px)
  et sans `letter-spacing` (l'estimateur de largeur ne le modélise pas).
- Les couleurs de la spec sont **dérivées** de la direction de marque (crème = papier
  refroidi, teintes pleines = primaire / secondaire vers la crème) : identiques à la
  spec pour la crème du kit de test, approchées pour les pastels.
- Le scrim photo dégradé de la spec → le voile local de la session 3 (bandes derrière
  le texte, halos derrière les dessins), en couleur sombre sur photo.
- L'italique coloré (`<em>`) n'est pas transposé : rien, dans ce que le modèle écrit, ne
  dit quels mots souligner. C'est une surface à ouvrir (FOLLOWUP F108).

## Planchers tenus en foncant, pas en baissant

Quatre valeurs de la spec mesuraient sous 4,5:1 : signature `#746A60` sur ocre (4,20)
et terracotta (4,12), italique terracotta sur crème (2,94), texte de courbe (4,01). Le
moteur résout chaque encre secondaire à 4,7:1 contre son fond **au pire pixel du grain**.
