# Références de composition — onze archétypes

**référence reconstruite, pas un rendu produit.**

## Ce que ces fichiers sont, et ce qu'ils ne sont pas

Le cahier des charges du 2026-09-21 dit : « si `design/reference/posts/` contient
des exports Claude Design, ils font foi ». **Le dossier n'existait pas.**
`design/reference/` ne contenait que huit exports d'ÉCRANS (`*.dc.html`,
parcours d'onboarding et accueil) et des captures de `home-v3` — aucun visuel de
post, aucune toile 1080×1350. Vérifiable : `grep -o 'viewBox' design/reference/*.dc.html`
ne renvoie rien.

Ces onze SVG sont donc **reconstruits à partir de la spécification écrite** du
système validé, comme le cahier des charges le prévoit dans ce cas. Ils sont le
CONTRAT que le moteur doit atteindre — même famille de composition, même genre
d'illustration, même logique de teintes, même densité — et non une cible au
pixel près.

## Pourquoi ils ne passent pas par le moteur

Une référence produite par le moteur qu'elle sert à juger ne juge rien : elle
mesure la conformité du moteur à lui-même. Chaque fichier ici est donc écrit à
la main, en SVG, depuis la spécification seule — `scripts/reference/build-post-references.ts`
n'est qu'un moyen de les écrire, pas un rendu de `lib/compose`.

C'est aussi pourquoi l'agent de contrôle indépendant ne voit que ce dossier et
les trente visuels produits : ni le code, ni ces échanges.

## La spécification, en un écran

* toile 1080×1350 ; bandes surtitre / titre / contenu / pied ;
* chaque zone porte **soit** du texte **soit** une illustration, jamais les deux ;
* dégagements : 40px glyphe↔trait, 32px glyphe↔bord de champ, 48px champ↔champ,
  64px avant le pied de carte ;
* **illustration obligatoire sur chaque carte-diagramme** : un objet en trait
  continu occupant 25 à 45 % de la bande de contenu, épaisseur 3-5px,
  extrémités arrondies, sans remplissage, sans dégradé, sans ombre ;
* l'illustration porte le sens du diagramme — un cercle vide n'est pas une
  illustration ;
* couleur : un ton papier + 2-3 teintes du kit **adoucies en aplats**, chaque
  partie d'un diagramme multi-parties avec sa propre teinte ;
* budgets : phrase seule ≤ 14 mots, diagramme ≤ 45 mots en tout, libellés 1-3
  mots, glose ≤ 6 mots ;
* typographie : titre ≥ 2 × libellé, plancher absolu 30px à 1080 pour tout
  libellé et toute glose, surtitre mono ≥ 22px, rien sous 10.5px effectifs à
  390px de large.

## Les onze fichiers

| fichier | illustration | teintes |
|---|---|---|
| `single-statement.svg` | petite marque dessinée | 0 (papier seul) |
| `quadrant-model.svg` | profil de tête | 4 |
| `cycle.svg` | fil noué | 3 |
| `surface-and-beneath.svg` | forme émergeant d'une ligne d'eau | 2 |
| `comparison-pair.svg` | deux bulles qui se font face | 2 |
| `numbered-strategies.svg` | plante en pot | 3 |
| `lettered-technique.svg` | ancre | 3 |
| `concentric-control.svg` | anneaux, silhouette assise au centre | 3 |
| `annotated-curve.svg` | courbe annotée | 3 |
| `practitioner-card.svg` | porte entrouverte | 1 |
| `carousel.svg` | les trois volets côte à côte | variable |
