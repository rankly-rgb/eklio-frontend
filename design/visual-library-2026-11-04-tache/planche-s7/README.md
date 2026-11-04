# Planche de la session 7 — la règle de la tache (2026-11-04)

**Provenance.** `planche-390.jpg` : trente cartes de décembre, sorties de l'orchestrateur
complet en reprise de journal (la rédaction de la session 6 est relue, pas repayée ; mois
sorti à 30), rendues par le chemin `card-store`, réduites à 390 px. Moteur du commit
`df1ab87`. `mesures.json` vient du script de harnais de la planche ; `traitement.json` vient
de `structureOf` (le code de production), relu sur les SVG des planches 6 et 7.

⚠ **Même mois rédigé, pas la même sélection.** Les nouveaux contrôles et le nouveau plan des
fonds font choisir au sélecteur trente posts différents parmi les 57 rédigés : cinq
`concentric_control` et un seul `cycle` (session 6 : deux et cinq). Les écarts sur la pile de
blocs et sur les idiomes viennent surtout de là.

| Mesure | Session 6 | Session 7 |
|---|---|---|
| Cartes avec une tache sous le dessin | 11/30 (relu dans le SVG) | **2/30** |
| Cartes au trait nu | 5/30 | **16/30** |
| Signature la plus fréquente, traitement compris | « bubbles » 5/30 | 4/30 (trois ex aequo) |
| Cartes portant la pile de blocs | 12/30 | 14/30 (autre sélection) |
| Idiomes finis | 6/14 | 6/14 (le 8 est retiré) |
| Surfaces de texte non couvertes | 0 | 0 |
| Mention de licence ≥ 4,5:1 | 30/30 | 30/30 (pire 4,72) |
| Mois sorti à 30 | oui | oui |

## Les règles

- **Taille.** Une tache ne se pose que sous un dessin de 300 px de large au plus sur la toile,
  soit 108 px vus à 390 px (`SHAPE_MAX_DRAWING_WIDTH`).
- **Mois.** Six taches au plus sur trente, six traits nus au moins (`checkDrawingTreatment`).
  Ce contrôle ne s'applique qu'aux mois composés avec leur plan de fonds.
- **Signature.** Elle compte le traitement du dessin : nu, sur tache, sur photo, ou clair sur
  sombre.
- **Trait seul.** Un dessin d'un seul trait (un seul sous-chemin) ne va pas sur une photo ; le
  plan des fonds lui laisse les aplats. C'était la carte 9 de la session 6.
- **Pilules et bulles.** Elles n'ont plus de case ni de dessin, sur aucun fond.
