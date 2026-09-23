# 2026-09-23 — un mois qui passe la porte

**chemin réel, base locale, compte de test.**

Tout ce qui porte cette mention est sorti de `GET /api/content-items/[id]/image`
— la route que le bouton de téléchargement appelle — sur un mois généré de bout
en bout, **et qui a passé `checkMonth` sans qu'aucun contrôle ne soit affaibli
pour l'y aider**.

Rien n'a touché la production : pas de `main`, aucune variable Vercel, aucune
connexion à la base de production. La clef Anthropic est passée par la ligne de
commande et n'est écrite dans aucun fichier.

## Ce qui a changé depuis la planche du 2026-09-21c

| | |
|---|---|
| identité | le modèle ne peut plus écrire de nom, d'adresse, de téléphone ni d'identifiant : `practitioner_card` a quitté son schéma de sortie, et ses lignes viennent du brief |
| teintes | mesurées en ΔE76, pas en RGB — `#DDC096` et `#D1AA73` étaient « distinctes » à 43 en RGB et à **11,7** perceptuellement |
| illustration | `MIN_FIGURE_EXTENT` mesure ce que le tracé OCCUPE, pas ce que sa boîte réserve : le profil du quadrant couvrait 4,4 % de la bande pour 9,2 % dans les références |
| variété | deux orientations par objet asymétrique, tirées d'une clef propre à la carte |
| barrière | `checkMonth` refuse le mois avant publication ; le sélecteur échange les posts fautifs contre des remplaçants sur-générés |

## Ce qu'il y a dedans

| fichier | ce que c'est |
|---|---|
| `visuals/NN-<archétype>[-<volet>].png` | les visuels, un par fichier, 1080×1350 — les carrousels volet par volet |
| `01-thirty-visuals-1080x1350.png` | la planche à taille de toile |
| `02-thirty-visuals-at-390.png` | la planche à 390px, la largeur où la lisibilité se mesure |
| `03-pair-<archétype>.png` | les onze planches « référence / produit » |
| `funnel.json` | l'entonnoir, **et le nombre d'essais qu'il a fallu** |
| `grading/` | les notes de la notation indépendante, brutes |

## Le chiffre qui compte

Le nombre d'essais nécessaires pour obtenir un mois qui passe tous les
contrôles est dans `funnel.json`, avec le motif de refus de chacun. C'est lui
qui dit si le pipeline tient en production : un mois livré tous les trois
essais ne tient pas.
