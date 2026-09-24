# F12 — la seule ligne de la mise en production qui demande un acte professionnel

⚠ **Un agent ne remplit pas `verified_by`.** Écrire un nom dans cette colonne
fabriquerait l'apparence d'une vérification professionnelle qui n'a pas eu lieu.
Tout le reste a été préparé pour que l'acte humain se réduise à **lire et
cocher**.

## ⚠ D'abord : la portée réelle n'est pas 240 lignes, c'est 4

`license_type_states` compte **240 lignes** — dix types de licence sur
cinquante-et-un États. Vérifier les 240 est un travail de plusieurs jours, et
c'est ce que l'entrée « mise en production » laissait entendre.

**Ce n'est pas nécessaire pour ouvrir.** `project_state_is_sellable` refuse un
État tant qu'aucune de ses lignes n'est vérifiée : ouvrir dans UN État demande
donc de vérifier **les lignes de cet État-là**, et rien d'autre. Les autres
restent à `NULL`, et le produit répond `409 We're not open in <ST> yet` — ce qui
est la bonne réponse, pas une panne.

| portée | lignes à vérifier | temps humain |
|---|---|---|
| **Californie seule** (où sont les comptes d'essai) | **4** | ~20 min |
| Californie + 4 États voisins | ~19 | ~1 h 30 |
| les cinquante-et-un | 240 | plusieurs jours |

⚠ **Les quatre lignes de Californie portent déjà `verified_at`, et c'est un
piège.** Leur `verified_by` dit `LOCAL RENDER HARNESS — not a board check` :
c'est le harnais qui les a posées pour pouvoir générer un mois de test. **Elles
doivent être effacées et refaites**, ou la première vente se fera sur une
vérification qui n'a jamais eu lieu :

```sql
update public.license_type_states
   set verified_at = null, verified_by = null
 where verified_by = 'LOCAL RENDER HARNESS — not a board check';
```

## La question à poser, type de licence par type de licence

Pour chaque ligne, une seule question, et elle ne porte pas sur l'existence du
titre mais sur **la publicité** :

> Dans cet État, une personne titulaire de ce titre a-t-elle le droit de
> s'annoncer au public sous ce titre pour proposer une psychothérapie en cabinet
> privé — et le board impose-t-il de faire figurer le numéro de licence ou une
> mention particulière dans la publicité ?

Trois réponses possibles, et une seule fait `sellable` :

| réponse | ce qu'on écrit |
|---|---|
| oui, sans mention obligatoire | `sellable_oui_non = oui`, `note` vide |
| oui, avec mention obligatoire | `sellable_oui_non = oui`, et la mention exacte dans `note` ⚠ elle devra apparaître sur les visuels |
| non, ou le titre n'existe pas dans cet État | `sellable_oui_non = non` |

## Où chercher — ⚠ les sources ne sont pas inventées ici

**Aucune URL n'est pré-remplie dans le fichier, volontairement.** Une URL de
board devinée par un agent est une source qui a l'air vérifiée et ne l'est pas,
ce qui est pire que l'absence. La colonne `source_url` est à remplir par la
personne qui regarde, et c'est **elle** qui fait la valeur de la ligne.

Pour la Californie, les deux organismes compétents sont nommément :

| types de licence | organisme |
|---|---|
| `lmft`, `lcsw`, `lpcc` | California **Board of Behavioral Sciences** (BBS) |
| `licensed_psychologist` | California **Board of Psychology** |

Pour les autres États, le registre à chercher porte l'un de ces noms : *Board of
Behavioral Health*, *Board of Social Work Examiners*, *Board of Professional
Counselors*, *Board of Psychology*. ⚠ Prendre la page du board de l'État, pas un
agrégateur privé.

## Le fichier

`docs/production/F12-license-type-states.csv` — une ligne par
(type de licence, État), **la Californie en premier**, avec les colonnes à
remplir. Une fois rempli, il se reverse par :

```sql
-- ⚠ `verified_by` porte le nom de la personne, pas celui d'un script.
update public.license_type_states t
   set verified_at = now(), verified_by = :name, source_url = :url, note = nullif(:note,'')
 where t.license_type_id = :lt and t.state_code = :st;
```

⚠ **Et on ne verse que les lignes `oui`.** Une ligne `non` reste à `NULL` : ce
n'est pas un échec de vérification, c'est un État où l'on ne vend pas.
