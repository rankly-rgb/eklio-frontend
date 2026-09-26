# M1 — Séparer l'effet du portillon de celui des consignes

**Prêt à lancer. Un seul appel. Ne coûte rien à écrire, ne peut pas être joué
sans solde.**

## Ce qu'on ne sait pas

Le 2026-09-26, deux choses sont entrées dans le pipeline **dans le même run** :

1. **le portillon par post** — chaque post est contrôlé seul à son arrivée, donc
   un défaut ne consomme plus d'échange du banc ;
2. **trois consignes de préfixe** — complétude sur toutes les surfaces, règle du
   carrousel, nuance clinique sur toutes les surfaces.

Le résultat cumulé est connu et mesuré :

| | avant | après |
|---|---|---|
| mois livrés | 2 / 16 | 2 / 2 |
| échanges consommés | jusqu'à 10 par essai | 0 |
| posts écrits portant encore un défaut | 24 / 478 (5 %) | 0 / 60 (0 %) |
| coût par mois livré | 3,22 $ | 0,574 $ |

**La part de chacun est inconnue.** C'est la seule question que cet essai
tranche.

## L'essai

Un mois, portillon **activé** (il l'est toujours), consignes **retirées**. Tout
le reste identique : même banque, mêmes trente contrôles, mêmes dix-huit règles
déontologiques, même modèle, même effort, même tirage.

```sh
cd /home/user/eklio-frontend
set -a; . /tmp/eklio-edge/keys.env; set +a

ANTHROPIC_API_KEY="$EKLIO_ANTHROPIC_API_KEY" \
CONTENT_SESSION_CAP_USD=2 \
CONTENT_PREFIX_BASELINE=1 \
  npx tsx scripts/local-render/20-month.ts --confirm --batch \
    --month 2027-07-01 --email <un kit frais>@eklio-test.invalid \
    --practitioners 1 --attempts 1 --rounds 1 \
  > M1.json 2> M1.log
```

**Choisir le kit** — il doit avoir un brief complet et aucun mois pour la date
visée :

```sql
select pr.email
  from brand_kits bk
  join projects p on p.id = bk.project_id
  join profiles pr on pr.id = p.user_id
  join project_briefs pb on pb.project_id = p.id
 where pb.license_number is not null
   and coalesce(pb.license_state_code, pb.state) is not null
   and pb.license_type_id is not null
   and not exists (select 1 from content_months cm
                    where cm.brand_kit_id = bk.id and cm.month = '2027-07-01')
   and not exists (select 1 from content_items ci where ci.brand_kit_id = bk.id)
 order by p.created_at desc limit 3;
```

## Ce qu'il faut lire, et où

Tout est déjà dans le rapport JSON. Aucune instrumentation à ajouter.

| grandeur | champ | référence (mois avec consignes) |
|---|---|---|
| run témoin ? | `prefixBaseline` | doit valoir `true` |
| posts passant seuls | `gate.passedAlone / gate.arrived` | 40/45 et 40/43 |
| écartés par classe | `gate.byCheck` | `unfinished` 5, `clinicalClaim` 3, `dangling` 1, `echo` 1 sur 88 |
| conformité 1er appel | `funnel.conformantFirstCall / funnel.examined` | 46/49 et 48/48 |
| échanges consommés | `dropped.length` | 0 et 0 |
| verdict | `findings` vide = livré | livré, livré |
| coût | `costUsd` | 0,5612 $ et 0,5868 $ |

## Comment lire le résultat

- **Le portillon fait l'essentiel** si le taux de passage seul reste haut (disons
  au-dessus de 80 %) et que le mois est livré. Les consignes n'auraient alors
  qu'un effet marginal, et leur coût en tokens de préfixe — 2 106 caractères,
  environ 580 tokens mis en cache par archétype — mériterait d'être rediscuté.
- **Les consignes font l'essentiel** si le taux de passage s'effondre (disons
  sous 60 %) et que le banc s'épuise. Le portillon aurait alors surtout rendu le
  défaut *visible* et *bon marché*, pas rare.
- **Les deux comptent** si le taux baisse sans que le mois soit refusé : le
  portillon absorbe ce que les consignes n'ont pas empêché, ce qui est le
  résultat que j'attends.

⚠ **Un essai ne tranche pas une variance.** Si le taux de passage tombe entre
60 % et 80 %, il faut un second essai témoin avant de conclure quoi que ce soit —
les deux mois de référence eux-mêmes diffèrent de 40/45 et 40/43.

## Ce que l'interrupteur ne fait pas

`CONTENT_PREFIX_BASELINE=1` **ne relâche aucun contrôle.** Les trente contrôles
du mois, les dix-huit règles déontologiques, le portillon et les gâchettes SQL
restent identiques. Ce qui change est ce que le modèle **sait** avant d'écrire,
pas ce qu'on **accepte** de lui : un mois témoin sera refusé plus souvent, jamais
moins.

Il ne retire pas non plus la **règle du carrousel**, qui vit dans la forme du
carrousel et non dans le bloc des trois classes. `carousel.samePanel` n'est donc
pas dans le périmètre de cet essai — c'était la première classe de l'audit
précédent (14 constats) et elle est tombée à 0 sur les deux mois de référence,
ce qui reste à confirmer sur plus de deux mois.

Il se crie au démarrage et s'inscrit dans le rapport, pour qu'un run témoin ne
puisse jamais passer pour un run de référence.
