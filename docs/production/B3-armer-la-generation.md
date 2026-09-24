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
