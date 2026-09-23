# 2026-09-23 — le mois qui passe la porte

**Compte** `odile.marchetti@eklio-test.invalid` · mois `2026-10-01` · base locale,
chemin produit. Trentième visuel compris, aucun retouché.

## Ce que la planche contient

| fichier | ce que c'est |
|---|---|
| `01-thirty-visuals-1080x1350.png` | les 48 volets à leur taille de publication |
| `02-thirty-visuals-at-390.png` | la même planche à **390 px**, la largeur d'une vignette dans un fil |
| `03-pair-<archétype>.png` | onze planches **référence / produit**, une par archétype |
| `visuals/` | les 48 PNG, carrousels **volet par volet** |

⚠ **Chaque PNG vient de `GET /api/content-items/[id]/image`**, la route que le
bouton de téléchargement appelle. Recomposer ici donnerait une planche qui
prouve que le harnais sait dessiner, pas que le produit sait livrer.

## Ce que le mois porte

30 posts, **48 volets** (4 carrousels dépliés), 10 archétypes sur 11.

| archétype | posts |
|---|---|
| single_statement | 9 |
| numbered_strategies | 4 |
| carousel | 4 |
| concentric_control | 3 |
| lettered_technique | 3 |
| comparison_pair | 2 |
| quadrant_model | 2 |
| annotated_curve | 1 |
| cycle | 1 |
| surface_and_beneath | 1 |

⚠ **`practitioner_card` est absent**, et c'est permis : elle est plafonnée à deux
par mois depuis qu'un tirage en a sorti neuf identiques (F20), et ce tirage-ci
n'en a pris aucune. La planche `03-pair-practitioner_card.png` porte donc la
référence seule, marquée « absent du mois ».

## Ce qui a été mesuré dessus

| grandeur | mesure | plancher |
|---|---|---|
| volets portant une figure | **24 sur 48** | — |
| couverture de la figure dans la bande contenu | moyenne **49,4 %**, min 9,6 %, max 93,3 % | 9 % |
| volets sous le plancher | **0** | — |
| écart ΔE76 minimal entre deux aplats d'une carte | **15,1** (hors paire papier/teinte) | 15 |
| plus petit corps dans la bande contenu, au canvas | **30 px** (= 10,5 px à 390) | 30 |
| légende, mots en moyenne | 123 | — |
| texte alternatif, caractères en moyenne | 197 | 420 max |

⚠ **La couverture est bimodale** : un volet porte une grande figure ou n'en
porte aucune. Les 24 sans figure sont des `single_statement` — l'archétype dont
`illustrationZone` vaut `none`, par conception, et la référence le traite de la
même façon.

## Ce que cette planche a coûté

Dixième essai. **Neuf mois refusés ou insuffisants avant celui-ci** ; le détail
des refus est dans le rapport de session. Cet essai-là : **0,090 $**, chemin
Batch, 54 candidats pour 30 posts.
