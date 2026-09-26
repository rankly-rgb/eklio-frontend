# La sauvegarde — la procédure, et la preuve

⚠ **`pg_restore` nu perd des données en silence sur cette base.**

Mesuré le 2026-09-24 : `section_types` porte onze lignes de référence et s'en
restaure **zéro**, dans une base qui paraît intacte — même nombre de tables, de
fonctions et de policies de part et d'autre.

| tentative | résultat |
|---|---|
| `pg_restore` nu | `section_types` restaure **0 sur 11**, en silence, code de sortie 1 |
| `pg_restore --single-transaction` | la restauration **entière avorte**, base inutilisable |
| **la procédure en trois temps** | **0 écart sur 86 tables, contenu compris** |

## Le mécanisme

`section_types_allowed_pages_check` appelle `site_spec_page_keys()`, qui lit
`site_pages`. ⚠ **Une `CHECK` est immédiate par construction** : elle s'évalue
ligne à ligne pendant le `COPY`, avant que la table qu'elle consulte soit
chargée. La fonction rend un tableau vide, et les onze lignes échouent une à
une.

⚠ **Et une clé étrangère ne poserait pas ce problème** : `pg_dump` repose les
clés étrangères dans `post-data`, c'est-à-dire **après toutes les données**.
C'est la raison pour laquelle l'invariant devrait à terme être une clé
étrangère et non une `CHECK` — voir `FOLLOWUP.md`.

## La procédure

`bash docs/production/A-restaurer.sh <dump> <base-cible> [<base-source>]`

1. **le schéma seul** — `--section=pre-data` ;
2. **on retire** les `CHECK` qui lisent une autre table, en gardant leur
   définition exacte. ⚠ Elles sont **énumérées depuis le catalogue**, jamais
   écrites à la main : la prochaine contrainte de cette classe arriverait sans
   que personne la rajoute ;
3. **les données** — `--section=data` ;
4. **on repose** les contraintes, et elles se **valident** alors sur des
   données complètes. ⚠ Pas de `NOT VALID` : une contrainte reposée sans
   validation rendrait la restauration verte en laissant passer exactement ce
   qu'elle interdit ;
5. **le reste** — `--section=post-data`.

⚠ **On ne pré-pose aucun schéma.** `auth`, `storage` et `extensions` sont dans
la sauvegarde ; les poser d'abord produit dix erreurs « schema already exists »
puis quatre « multiple primary keys », pour des objets qui sont tous là.
Dix-sept écarts apparents, zéro écart réel — le genre de bruit qui fait
conclure que la procédure échoue alors qu'elle marche.

## ⚠ La vérification est le livrable

Compter les tables, les fonctions et les policies **ne voyait rien** : les
trois comptes étaient identiques pendant que onze lignes manquaient. L'étape 6
compare donc, **table par table**, le nombre de lignes **et une empreinte md5
du contenu entier**, lignes triées.

**Et elle est sensible, ce qui a été vérifié dans les deux sens :**

| test | résultat |
|---|---|
| base réelle (1 086 posts, 86 tables) restaurée | **0 écart** |
| une seule ligne retirée après restauration | **détectée**, sur le compte et sur l'empreinte |

```
< section_types|11|58cb0552f151a520b15b33e69b4c0be6
> section_types|10|d88233bafee7abd5ee81426e5594a991
```

⚠ **Sans base source, l'étape 6 se saute et le dit.** Une vérification qui ne
peut pas comparer doit l'annoncer, pas se taire : c'est le silence qui a laissé
passer le défaut la première fois.

## Ce que ça change dans la liste

L'étape 2 ne dit plus « vérifier qu'elle se restaure » mais **« la restaurer
avec `A-restaurer.sh`, et lire l'étape 6 »**. La procédure fonctionne sur la
production **telle qu'elle est** : elle ne demande aucune migration préalable,
et l'étape 1b devient une amélioration du schéma plutôt qu'un préalable.

---

## ⚠ Mise à jour du 2026-09-26 — rejouée, et la procédure s'est adaptée seule

Rejouée intégralement sur la copie de production reconstruite depuis les 157
migrations :

```
═══ 6 · LA VÉRIFICATION : LIGNE À LIGNE, PAS TABLE À TABLE ═══
  ✓ 86 tables identiques, ligne à ligne et contenu compris
── 0 écart(s) ──
```

**Et elle ne retire plus la même contrainte.** À l'écriture, l'étape 2 retirait
`section_types_allowed_pages_check`. Cette `CHECK` n'existe plus : la migration
`20260924150000` l'a remplacée par un trigger de contrainte différé, qui se
restaure nativement. L'étape 2 a donc trouvé et traité une **autre** contrainte
de la même classe, apparue depuis :

```
═══ 2 · retirer les CHECK qui lisent une autre table ═══
  ✓ retirée : content_items.content_items_payload_valid
═══ 4 · reposer les contraintes, et les VALIDER ═══
  ✓ reposée et validée : content_items.content_items_payload_valid
```

⚠ **C'est le seul résultat de cette fiche qui valait d'être écrit.** L'étape 2
énumère depuis `pg_constraint`/`pg_depend`/`pg_proc` au lieu de porter une liste.
Une liste tenue à la main aurait nommé `section_types`, ne l'aurait plus trouvée,
et aurait laissé passer `content_items` — c'est-à-dire aurait reproduit
exactement le défaut d'origine sur une autre table, avec un script vert.
