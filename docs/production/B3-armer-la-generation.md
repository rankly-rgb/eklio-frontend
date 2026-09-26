# `CONTENT_GENERATION_ARMED` — la séquence, et rien avant

⚠ **Deux verrous, et ils échouent différemment.** `vercel.json` ne liste pas
`/api/cron/content-month` ; et la route répond `503` si
`CONTENT_GENERATION_ARMED` n'est pas **exactement** la chaîne `"true"`. Ni
`"false"`, ni `"0"`, ni `"TRUE"` n'arment : seule l'égalité stricte.

Deux plutôt qu'un parce qu'un `cron` peut être ajouté par quelqu'un qui lit
`vercel.json` comme de la configuration, tandis qu'une variable d'environnement
demande d'être allé chercher le commentaire qui l'explique. L'un seul est une
étourderie ; les deux ensemble sont une décision.

## Ce qui doit être VRAI avant de poser `true`

Chaque ligne se vérifie, aucune ne se suppose.

| # | condition | la vérification |
|---|---|---|
| 1 | `content_generation_runs` et `content_generation_results` existent (F17) | `select count(*) from information_schema.tables where table_name in ('content_generation_runs','content_generation_results')` → **2** |
| 2 | le crédit est réservé sur le chemin PRODUIT (F25, 8b) | générer un mois par le produit, puis `select kind, reservations from credit_month_audit where user_id = … and month = …` → **30 réservations `post_generation`** |
| 3 | la banque est dimensionnée pour un segment SIMULTANÉ (F13, 8a) | `select * from drawable_count_for_kit(:kit)` ≥ `fillTrigger({practitioners: N, attempts: 4})` sur **les onze** archétypes |
| 4 | `ANTHROPIC_API_KEY` est lue par la route, pas seulement par le build | un kit généré par `/api/briefs/[id]/generate` |
| 5 | le juge de complétude a la clé (8d) | sans elle il rend un verdict vide, et **un verdict vide ne refuse rien** |
| 6 | un mois réel a été regardé par une personne (étape 10) | la planche, quinze minutes |

⚠ **La 3 est celle qu'on saute.** Le garde-fou de `20-month.ts` refuse avant de
dépenser, mais il vit dans le HARNAIS : le chemin produit n'a pas encore ce
garde-fou. Tant qu'il ne l'a pas, un `cron` armé sur une banque courte livre des
mois courts.

## La séquence

1. poser `CONTENT_GENERATION_ARMED=false` **explicitement** — pas « absente ».
   Une variable absente et une variable à `false` se comportent pareil
   aujourd'hui, et ne se lisent pas pareil dans six mois ;
2. ajouter l'entrée `/api/cron/content-month` à `vercel.json`, **schedule
   mensuel**, et déployer. La route répond alors `503` à chaque firing — c'est
   le comportement voulu, et il prouve que le `cron` est enregistré ;
3. vérifier les six conditions ci-dessus ;
4. passer `CONTENT_GENERATION_ARMED` à `true` ;
5. **déclencher le `cron` à la main** une fois, sur un seul kit témoin, et lire
   `credit_month_audit` ;
6. laisser le firing mensuel suivant se produire seul.

## Comment vérifier APRÈS

```sql
-- une ligne par kit servi, aucune en double : la clé unique l'interdit
select month, count(*) from public.content_months where month = :month group by 1;
-- trente réservations par kit, et le coût réel au livre
select user_id, kind, reservations, settlements, cost_usd
  from public.credit_month_audit where month = :month order by 1;
-- et ce qu'aucune requête ne dit : la planche
```

⚠ **Un double firing ne peut pas produire deux mois** :
`content_months_kit_month_key` est unique sur `(brand_kit_id, month)`, donc le
second insert est refusé par la base et non par un drapeau que quelqu'un a
pensé à lire.

---

## ⚠ Mise à jour du 2026-09-26 — la condition 3 a changé d'échelle

**Le seuil de banque a baissé de 43 %.** La condition 3 renvoyait à
`fillTrigger({practitioners: N, attempts: 4})`. Deux de ses termes ont bougé :

* **le tirage.** F41 a montré que les 102 candidats par essai venaient d'une
  tautologie — la moitié était payée sans être examinée. Le tirage est désormais
  dérivé de ce que la boucle consomme et vaut **57**. `fillTrigger` s'en déduit :
  **174 → 99** pour un essai, **1 704 → 954** pour un segment de dix.
* **`attempts`.** Le 4 venait de « 1 mois livré sur 4 essais ». Les deux mois du
  2026-09-26 ont été livrés en **un essai chacun**, portillon par post en place.
  ⚠ **Deux mois ne font pas une moyenne** : garder `attempts: 4` reste le choix
  prudent jusqu'à la mesure de confirmation à cinq mois (M4). Le dimensionnement
  ne doit pas se détendre sur deux points.

Donc : la vérification reste la même, ses nombres ont baissé, et **il ne faut pas
en profiter pour baisser `attempts`.**

## ⚠ Et la condition 3 reste celle qu'on saute, pour la même raison

Le garde-fou vit toujours dans le harnais et non sur le chemin produit. Ce qui a
changé le 2026-09-26 : la pénurie de banque constatée n'était **pas** un manque
de sujets mais **994 assignations orphelines** tenues par des essais interrompus.
`release_stale_topic_assignments()` les a rendues, et zéro archétype est repassé
sous le seuil. La libération tourne en tête de génération dans le harnais — **pas
sur le chemin produit non plus.** C'est le même trou, et il en porte maintenant
deux choses.

---

## ⚠ Mise à jour du 2026-09-26 (seconde passe) — la condition 4 n'est pas une vérification

La fiche présente la condition 4 — « générer un mois par le PRODUIT » — comme une
case à cocher. Le recensement de F45 montre qu'elle n'en est pas une.

**Le chemin produit n'est pas le même générateur.** Sur sa chaîne entière, aucun
des vingt mécanismes du harnais n'est présent : ni les trente contrôles de mois,
ni le portillon par post, ni la mention de licence, ni la banque, ni le crédit de
contenu. Il écrit une ligne et une légende par post, dessine des fonds
photographiques, ne produit aucun payload d'archétype, et rend
`ethicsCheck: { passed: true }` en dur.

⚠ **Armer la route aujourd'hui rend un 501, et c'est une chance.** Le balayage
mensuel n'est pas écrit. Armer une route qui appellerait `generateMonth`
mettrait en vente **des mois sans mention de licence et sans aucun des trente
contrôles** — ce que la Californie interdit dans toute publicité.

La condition 4 devient donc : **choisir lequel des deux générateurs survit.**
F45 pose les deux options et dit pourquoi la troisième — armer « pour voir » —
est mauvaise.

## Ce qui a quand même avancé côté produit

| | |
|---|---|
| ✓ | la libération des assignations tourne enfin sans génération : `/api/cron/release-topics`, planifiée |
| ✓ | la décision du garde-fou est extraite dans `lib/content/bank-guard.ts`, prête |
| ✗ | mais elle ne garde rien : le chemin produit ne tire pas de la banque |
