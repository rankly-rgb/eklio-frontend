# Stripe — la fiche de bout en bout

⚠ **Jamais exécuté, ni en test ni en production.** Ce n'est pas « à
revérifier » : c'est « jamais fait ». C'est aussi le seul chemin qui encaisse de
l'argent.

**Objectif de cette fiche : ramener l'heure et demie à une demi-heure de gestes
mécaniques.** Tout ce qui pouvait être établi sans appeler Stripe l'a été — les
variables, les montants, les tables touchées, les requêtes de vérification. Ce
qui reste est le parcours dans le navigateur.

---

## 0 · Ce qui a été vérifié sans appeler Stripe (2026-09-26)

### 0.1 Les quatre prix annoncés correspondent exactement au code

| palier | annoncé | `lib/billing/plans.ts` | |
|---|---|---|---|
| Starter | 79 $ | `amountCents: 7900` | ✓ |
| Practice | 149 $ | `amountCents: 14900` | ✓ |
| Signature | 249 $ | `amountCents: 24900` | ✓ |
| Monthly Presence | 39 $/mois | `amountCents: 3900`, `interval: month` | ✓ |

**Aucun écart.** La page de tarifs itère `LEGACY_KIT_TIERS` — exactement ces
trois paliers ponctuels — plus l'abonnement.

### 0.2 ⚠ Mais le code peut exiger CINQ variables que rien ne déclare

`.env.example` en déclare sept ; le code en lit **douze**.

| variable | montant | déclarée | atteignable depuis un achat |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | — | ✓ | oui |
| `STRIPE_WEBHOOK_SECRET` | — | ✓ | oui |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | — | ✓ | déclarée, **non lue par ce dépôt** |
| `STRIPE_PRICE_STARTER` | 79 $ | ✓ | oui, page de tarifs |
| `STRIPE_PRICE_PRACTICE` | 149 $ | ✓ | oui |
| `STRIPE_PRICE_SIGNATURE` | 249 $ | ✓ | oui |
| `STRIPE_PRICE_MONTHLY_PRESENCE` | 39 $/mois | ✓ | oui |
| `STRIPE_PRICE_FOUNDATION` | 390 $ | **✗** | ⚠ **oui**, par requête forgée |
| `STRIPE_PRICE_ROSTER` | 690 $ | **✗** | ⚠ **oui**, par requête forgée |
| `STRIPE_PRICE_IDENTITY_ADDON` | 89 $ | ✗ | non |
| `STRIPE_PRICE_ROSTER_SEAT` | 120 $ | ✗ | non |
| `STRIPE_PRICE_FILL_SOLO` | 59 $ | ✗ | non |
| `STRIPE_PRICE_FILL_PRACTICE` | 69 $ | ✗ | non |

**`foundation` et `roster` sont le point à traiter.** `kitTierSchema` est un
`z.enum(KIT_TIERS)` et `KIT_TIERS` porte les cinq paliers ; l'action de checkout
accepte donc `tier: "foundation"`, puis `requireEnv("STRIPE_PRICE_FOUNDATION")`
lève. Ce n'est **pas** une fuite d'argent — rien n'est débité — mais c'est un
500 non géré sur un point d'entrée de paiement. Deux réponses possibles :

1. **poser les deux variables** dans Stripe et dans `.env.example`, si les
   paliers sont destinés à la vente ;
2. **restreindre le schéma de l'action** à `LEGACY_KIT_TIERS`, si non.

⚠ La seconde est la bonne tant que la page de tarifs ne les montre pas. Un
palier achetable par requête et invisible à l'écran est un palier dont personne
ne connaît le prix.

Les quatre derniers vivent dans `lib/billing/offer.ts`, **que rien n'importe** :
de la configuration morte. Ne pas les poser.

### 0.3 Ce qu'un achat écrit en base — sept objets, tous vérifiables

| objet | rôle |
|---|---|
| `stripe_events` | le **verrou d'idempotence** : une clé primaire sur `stripe_event_id` |
| `profiles.stripe_customer_id` | la correspondance customer → utilisateur |
| `purchases` | la ligne d'achat |
| `purchase_status_events` | chaque transition de statut, via `record_purchase_status_event` |
| `subscriptions` | l'abonnement |
| `plan_grants` | l'allocation du palier, avec sa propre clé d'idempotence (`grant_key`) |
| `generation_credits` | `has_paid`, et les compteurs de génération du palier |

Les deux derniers sont écrits par
`grant_plan_allowance(p_project_id, p_tier, p_grant_key)` — **une RPC, deux
tables**. Une allocation à moitié posée est le cas qu'on ne pense pas à
vérifier.

---

## 1 · Avant de commencer — cinq minutes

- [ ] **mode test Stripe**, projet Supabase de **développement**. Jamais le
      projet US de production.
- [ ] les **sept** variables déclarées sont posées dans `.env.local` (0.2).
- [ ] `stripe listen --forward-to localhost:3000/api/stripe/webhook` tourne, et
      son `whsec_…` est dans `STRIPE_WEBHOOK_SECRET`.
- [ ] noter l'`user_id` du compte de test : toutes les requêtes en dépendent.

```sql
-- pose-le une fois, les requêtes suivantes le réutilisent
\set uid '<user_id>'
```

---

## 2 · Le parcours — vingt minutes

### 2.1 Acheter Signature (249 $)

- [ ] cliquer l'achat sur la page de tarifs, payer avec `4242 4242 4242 4242`

**Ce qui doit se produire**, dans cet ordre :

```sql
-- a) le verrou d'idempotence porte l'event
select stripe_event_id, type, processed_at
  from stripe_events order by processed_at desc limit 5;
-- attendu : checkout.session.completed, processed_at non nul

-- b) le customer est relié
select stripe_customer_id from profiles where id = :'uid';
-- attendu : cus_…

-- c) l'achat est enregistré, au bon montant
select tier, kind, amount_cents, currency, status, paid_at
  from purchases where user_id = :'uid' order by created_at desc limit 1;
-- attendu : signature | … | 24900 | usd | paid (ou l'équivalent) | non nul
-- ⚠ 24900, PAS 249. Une confusion dollars/cents ici se voit sur la facture.

-- d) la transition de statut est tracée
select previous_status, new_status, event_type, amount_cents
  from purchase_status_events
 where purchase_id = (select id from purchases where user_id = :'uid'
                       order by created_at desc limit 1)
 order by occurred_at;
-- attendu : au moins une ligne, new_status cohérent avec (c)

-- e) l'allocation du palier est ouverte — DEUX tables, pas une
--    `grant_plan_allowance` écrit `plan_grants` ET `generation_credits`.
with p as (select project_id from purchases where user_id = :'uid'
            order by created_at desc limit 1)
select 'plan_grants' as t, tier, grant_key, granted_at::text as detail
  from plan_grants where project_id = (select project_id from p)
union all
select 'generation_credits', plan_tier, has_paid::text,
       directions_generated || ' directions, ' || regenerations_used || ' régénérations'
  from generation_credits where project_id = (select project_id from p);
-- attendu : une ligne plan_grants au bon palier ET has_paid = true
-- ⚠ `grant_key` EST LA CLÉ D'IDEMPOTENCE DE L'ALLOCATION, distincte de celle
--    du webhook : un rejeu ne doit pas ouvrir deux fois le même palier.
```

- [ ] `/app` montre le palier acheté **sans rechargement forcé**

### 2.2 L'abonnement Monthly Presence

- [ ] acheter l'add-on (ou le laisser coché)

```sql
select stripe_subscription_id, stripe_price_id, status, active,
       current_period_end, cancel_at_period_end, trial_end
  from subscriptions where user_id = :'uid';
-- attendu : status actif, active = true, current_period_end dans le futur
```

⚠ **`trial_end` peut être non nul** : l'offre inclut trois mois. Ce n'est pas
une anomalie — voir `INCLUDED_MONTHLY_PRESENCE_COPY`.

### 2.3 Rembourser

- [ ] depuis Stripe → le paiement → **Rembourser**

```sql
select new_status, event_type, amount_cents, occurred_at
  from purchase_status_events
 where purchase_id = (select id from purchases where user_id = :'uid'
                       order by created_at desc limit 1)
 order by occurred_at;
-- attendu : une ligne de plus, event_type = charge.refunded
select status from purchases where user_id = :'uid' order by created_at desc limit 1;
-- attendu : remboursé, PAS supprimé
```

### 2.4 Annuler l'abonnement

- [ ] depuis Stripe → l'abonnement → **Annuler à la fin de la période**

```sql
select status, active, cancel_at_period_end, current_period_end
  from subscriptions where user_id = :'uid';
-- attendu : cancel_at_period_end = true, current_period_end INCHANGÉ
-- ⚠ L'ACCÈS SE FERME À LA FIN DE PÉRIODE, PAS À L'INSTANT. Elle a payé le mois.
```

---

## 3 · Les deux qu'on oublie, et ce sont les deux qui coûtent — cinq minutes

### 3.1 Le rejeu

Stripe rejoue un event tant qu'il n'a pas reçu de 2xx. Un traitement non
idempotent facture deux fois.

- [ ] dans Stripe → Événements → le `checkout.session.completed` → **Renvoyer**

```sql
-- l'event ne doit apparaître QU'UNE FOIS
select stripe_event_id, count(*) from stripe_events
 group by 1 having count(*) > 1;
-- attendu : zéro ligne

-- et l'achat ne doit pas s'être dédoublé
select count(*) from purchases where user_id = :'uid';
-- attendu : le même nombre qu'avant le renvoi
```

⚠ **Le verrou est `recordEvent`, et il a un contrepoids.** Si le traitement
échoue APRÈS l'enregistrement, `forgetEvent` retire la ligne : sans cela, le
rejeu verrait « déjà traité » et laisserait un paiement encaissé sans droit
accordé. **On préfère un rejeu de trop à un droit perdu.** Pour l'éprouver, il
faut faire échouer le traitement — c'est un test de code, pas de parcours, et il
existe (`lib/stripe/__tests__/`).

### 3.2 La signature invalide

Une route qui accepte une signature invalide accorde un abonnement que personne
n'a payé.

```sh
curl -i -X POST http://localhost:3000/api/stripe/webhook \
  -H 'stripe-signature: t=1,v1=deadbeef' \
  -H 'content-type: application/json' \
  -d '{"id":"evt_forged","type":"checkout.session.completed","data":{"object":{}}}'
```

- [ ] réponse **400**
- [ ] `select count(*) from stripe_events where stripe_event_id = 'evt_forged';` → **0**

---

## 4 · Si ça ne marche pas — où chercher, dans l'ordre

| symptôme | cause la plus probable | où regarder |
|---|---|---|
| le bouton d'achat rend un 500 | une variable de prix absente | le log serveur cite le NOM exact : `StripeConfigError` le porte |
| paiement encaissé, rien en base | `STRIPE_WEBHOOK_SECRET` faux | la route rend 400 et le dit ; `stripe listen` affiche le bon `whsec_` |
| l'event est en base, l'achat non | le traitement a levé après le verrou | chercher `forgetEvent` dans le log : si absent, la ligne d'event est restée et le rejeu l'ignorera |
| l'achat est là, le palier pas ouvert | `grant_plan_allowance` | `plan_grants` vide → l'appeler à la main avec `(project_id, tier, grant_key)` et lire son retour ; `generation_credits.has_paid` faux → c'est la seconde moitié qui a échoué |
| `/app` ne montre rien | cache de page, pas Stripe | recharger ; si ça apparaît, c'est un défaut de revalidation, pas de paiement |
| tout marche, `credit_month_audit` vide | **attendu** | le crédit de contenu n'est pas branché sur le chemin produit (F45) — ce n'est pas un échec de Stripe |

⚠ **La dernière ligne compte.** L'ancienne fiche renvoyait à « l'étape 8b » pour
la même raison ; le recensement du 2026-09-26 a montré que c'est plus large que
le crédit — voir F45. Ne pas chercher du côté de Stripe ce qui n'y est pas.

---

## 5 · Une fois en réel — cinq minutes

- [ ] le même parcours, **un seul achat**, en clés de production
- [ ] **remboursement immédiat** depuis Stripe
- [ ] vérifier 2.3 en base

⚠ **En réel, la seule chose qui change est la clé.** Si le parcours de test est
vert, un échec en réel est presque toujours une variable posée en portée
`Preview` au lieu de `Production` — voir `B2-les-secrets.md`.

---

## ⚠ Ce que cette fiche ne couvre pas, et qu'il faut savoir avant de la jouer

Stripe encaisse. Il n'ouvre pas un mois de contenu.

Le recensement de F45 a montré que le chemin produit de génération n'est pas le
générateur mesuré : un achat réussi ouvre le palier (`plan_grants`,
`generation_credits.has_paid`) et **rien de plus**. Le mois qu'une cliente
attend ensuite ne se génère aujourd'hui que par le harnais, à la main.

Donc : cette fiche verte veut dire « l'argent rentre et le droit s'ouvre ». Elle
ne veut pas dire « la cliente reçoit son mois ». Les deux sont nécessaires pour
ouvrir ; ils ne sont pas le même chantier.
