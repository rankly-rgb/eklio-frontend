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

⚠ **Corrigé le 2026-09-27 : les quatre lignes californiennes ne sont « déjà
marquées » que sur une base LOCALE.** C'est `scripts/local-render/00-account.sql`
qui y pose `verified_by = 'LOCAL RENDER HARNESS — not a board check'`, et il n'a
jamais touché la production. La copie de production rejouée (répétition, étape 4)
porte **240 lignes à NULL**. La fiche disait « à effacer et refaire » : en
production il n'y a rien à effacer — mais on le **lit** d'abord plutôt que de le
supposer, et c'est la première ligne du geste ci-dessous.

## ⚠ Ce que la porte exige réellement — éprouvé sur la base, pas lu

`scripts/production-path/f12-gate.ts` interroge les deux portes contre la base
locale, dans les deux sens, et rend la base telle qu'il l'a trouvée :

| porte | lit | ouvre quand |
|---|---|---|
| **kit** — `project_state_is_sellable` (409 sinon) | `project_briefs.state` | **TOUTES** les lignes de l'État sont vérifiées |
| **mois** — `stateVerified` du préalable (F46) | `license_state_code ?? state` | **CE couple** (titre, État) est vérifié |

Trois conséquences pour le geste :

1. **Les quatre lignes de Californie, pas « celle du titre ».** Avec `lmft` seul
   vérifié, le mois s'ouvrirait pour une LMFT et le kit resterait fermé pour tout
   le monde.
2. **Une seule réponse `non` garde la Californie fermée pour les kits.** « On ne
   verse que les lignes `oui` » laisse la ligne `non` à NULL, et `state_is_sellable`
   refuse l'État entier. En Californie les quatre titres existent et se
   publicisent — `oui` est attendu partout ; si une lecture dit autre chose,
   **s'arrêter** : c'est une décision produit, pas un versement.
   `f12-to-sql.ts` refuse d'émettre dans ce cas, et le dit.
3. **Un brief sans État passe la porte du kit** (« État vide → VRAI »,
   20260915101137). C'est une décision écrite, pas un trou : aucune juridiction
   n'est revendiquée. Mais elle a été écrite avant que chaque carte porte un
   titre et un numéro (F56) — elle mérite d'être relue (F64).

## Le geste, mécanique — vingt minutes dont quinze de lecture

```sh
# 1. LIRE la production, avant tout (lecture seule) :
#    select license_type_id, verified_at, verified_by from license_type_states
#     where state_code = 'CA' or verified_at is not null;
#    attendu : 4 lignes CA, verified_at NULL, et rien d'autre de vérifié.
#    Une ligne 'LOCAL RENDER HARNESS' ou 'migration probe' → l'effacer (requête plus bas).
# 2. LIRE les deux boards (le seul acte qu'aucun script ne fait), remplir les
#    4 lignes CA du CSV : oui/non, source_url https://…, TON nom, note.
# 3. Émettre le SQL — il refuse s'il manque quoi que ce soit :
npx tsx scripts/production-path/f12-to-sql.ts CA > /tmp/f12-CA.sql
# 4. Relire /tmp/f12-CA.sql, le coller dans l'éditeur SQL de Supabase.
#    Il se termine par sa propre preuve : `t | 4`. Sinon : rollback.
```

Éprouvé le 2026-09-27 sur la copie de production rejouée : CSV rempli de valeurs
de test → 4 `UPDATE`, `vendable = t`, `verifiees = 4` ; puis remis à NULL.

```sql
-- seulement si l'étape 1 trouve une ligne posée par un script :
update public.license_type_states
   set verified_at = null, verified_by = null
 where verified_by in ('LOCAL RENDER HARNESS — not a board check', 'migration probe');
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
(type de licence, État), **la Californie en premier**. Vérifié le 2026-09-27
contre la matrice rejouée : **240 couples, les mêmes, ni plus ni moins**
(`f12-gate.ts`). La colonne `statut_actuel` disait `DÉJÀ-MARQUÉ-HARNAIS` pour la
Californie ; elle dit maintenant `À-VÉRIFIER-EN-PREMIER`, ce qui est vrai en
production.

`scripts/production-path/f12-to-sql.ts <ÉTAT>` le reverse — ⚠ `verified_by` porte
le nom de la personne, et le script refuse un nom qui ressemble à un script.
Une ligne `non` n'est pas versée, et le script refuse tout l'État plutôt que de
le laisser fermé sans le dire.
