# Stripe — la fiche de bout en bout

> **⚠ JOUÉ LE 2026-09-27 — EN PARTIE, ET LA PARTIE EST NOMMÉE.**
>
> `scripts/stripe-path/play.ts` joue le parcours contre **la vraie route**
> (`next dev`), **la vraie vérification de signature** (`constructEventAsync`,
> HMAC sur les octets reçus) et **la vraie base** (PostgREST + les RPC, sur les
> 162 migrations rejouées). Résultat : `B5-parcours-resultat.txt`, **0 échec,
> 1 défaut ouvert**.
>
> Ce qui n'a PAS été joué : tout ce qui parle aux serveurs de Stripe.
> `api.stripe.com` était refusé par la politique réseau du bac à sable (403 au
> CONNECT) — la clé de test était là, le chemin non. Donc : création de la
> session de checkout, paiement dans le navigateur, `subscriptions.retrieve`,
> la création chez Stripe des trois mois inclus, un remboursement émis par
> Stripe. Les événements ont été construits à la forme de l'API ; **§2 ci-dessous
> est ce qui reste, et c'est désormais un contrôle, pas une découverte.**
>
> **⚠ SECONDE TENTATIVE, 2026-09-27 (après-midi) : toujours 403.** Le brief
> annonçait `api.stripe.com` autorisé ; le proxy du bac à sable refusait encore
> le CONNECT. **Rien de ce que le harnais a établi n'a donc été confronté aux
> serveurs de Stripe** — ni confirmé, ni démenti. §3 reste le seul contrôle qui
> le fera, et il se joue depuis une machine qui atteint Stripe.
>
> **Le premier passage a rendu 8 échecs.** Cinq étaient la fiche qui se
> trompait, trois étaient le produit — dont un cas F54 réel. Tout est en §6.

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

**`foundation` et `roster` : ⚠ DÉJÀ TRAITÉ, cette section était périmée.**
`app/app/checkout/actions.ts` valide `tier` par `sellableKitTierSchema`, et
`createCheckoutSession` relit `plans.sellable` en base (`refuseIfUnsellable`) :
`foundation` et `roster` y valent `false`. Une requête forgée reçoit l'erreur
générique, pas un 500. Vérifié le 2026-09-27 :
`select tier, sellable from plans` → les trois vendables sont
`starter`, `practice`, `signature`.

Les quatre derniers vivent dans `lib/billing/offer.ts`, **que rien n'importe** :
de la configuration morte. Ne pas les poser.

### 0.3 Ce qu'un achat écrit en base — sept objets, tous vérifiables

| objet | rôle |
|---|---|
| `stripe_events` | le **verrou d'idempotence** : une clé primaire sur `stripe_event_id` |
| `profiles.stripe_customer_id` | la correspondance customer → utilisateur |
| `purchases` | la ligne d'achat |
| `purchase_status_events` | les transitions **APRÈS** l'achat (remboursement, litige) — ⚠ **vide à l'achat** : c'est le comportement correct, pas un oubli |
| `subscriptions` | l'abonnement |
| `plan_grants` | l'allocation du palier ; `grant_key` = **l'id de la session de checkout** (`cs_…`) depuis le 2026-09-27 |
| `generation_credits` | `plan_tier` = le palier, compteurs remis à zéro — ⚠ **`has_paid` n'est PAS écrit** et rien ne le lit |

Les deux derniers sont écrits par
`grant_plan_allowance(p_project_id, p_tier, p_grant_key)` — **une RPC, deux
tables**. Le septième objet, pour tout abonnement, est `content_months` : la
ligne du mois suivant en `generating`, posée par `customer.subscription.created`
quand `CONTENT_GENERATION_ARMED=true` (F54).

---

## 1 · Avant de commencer — dix minutes, une fois

- [ ] **mode test Stripe**, base **locale** (`eklio_local_verify`). Jamais le
      projet US de production.
- [ ] dans le tableau de bord Stripe **test** : quatre prix — 79 $, 149 $, 249 $
      ponctuels, 39 $/mois récurrent. Noter les quatre `price_…`.
- [ ] la base et la façade :

```sh
bash ../eklio-backend/scripts/local-verify.sh      # 0 FAILED ; le code 1 final est la dérive attendue
bash scripts/local-render/edge/up.sh
sudo -u postgres psql -f scripts/stripe-path/setup.sql
```

- [ ] `stripe listen --forward-to localhost:3000/api/stripe/webhook` ; copier le
      `whsec_…` qu'il imprime.
- [ ] `next dev`, la clé **passée par la commande**, jamais écrite :

```sh
. /tmp/eklio-edge/keys.env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE" STRIPE_SECRET_KEY="$EKLIO_STRIPE_TEST_KEY" \
STRIPE_WEBHOOK_SECRET=whsec_… STRIPE_PRICE_STARTER=price_… STRIPE_PRICE_PRACTICE=price_… \
STRIPE_PRICE_SIGNATURE=price_… STRIPE_PRICE_MONTHLY_PRESENCE=price_… \
CONTENT_GENERATION_ARMED=true npx next dev
```

⚠ `CONTENT_GENERATION_ARMED=true` n'ouvre ici que la **mise en file** du mois
(`queue.ts`) : aucune clé de modèle n'est posée, la route `cron` reste en 501.

---

## 2 · Le parcours automatique — deux minutes, sans Stripe

```sh
WHSEC=whsec_… npx tsx scripts/stripe-path/play.ts
```

Attendu : `✓ AUCUN ÉCHEC`, et **une** ligne `⚠ OUVERT` (§6.3). Il couvre,
contre la vraie route et la vraie base :

| | ce qui est éprouvé |
|---|---|
| 1 | un achat par palier vendable, les sept objets chacun |
| 1b | Signature : l'abonnement des mois inclus, `trialing` |
| 2 | Monthly Presence seul, l'abonnement arrivé **avant** la session |
| 3 | **F54** : `generating` posé par le webhook, **dû** pour `selectDueMonths` câblé sur la base, puis `already_served` une fois `proposed` |
| 4 | le rejeu (même id) ; le même event deux fois **en parallèle** ; deux events de succès pour une session |
| 5 | quatre signatures refusées : inventée, mauvais secret, horodatage d'une heure, corps modifié |
| 6 | le désordre : un `updated` ancien après le `deleted` ; un `created` (incomplete) après l'`updated` (active) |
| 7 | le remboursement ; et le remboursement d'un panier Starter + Monthly Presence |

---

## 3 · Ce qui reste à la main — un CONTRÔLE, quinze minutes

Tout ce qui suit est ce que le parcours automatique **n'a pas pu** jouer : le
dialogue avec les serveurs de Stripe. Chaque ligne dit ce qu'on regarde et ce
qu'on doit voir. Les requêtes de §2.1 ci-dessous restent valides.

- [ ] **Signature, dans le navigateur** (`4242 4242 4242 4242`). Dans le
      terminal `stripe listen` : `checkout.session.completed` puis
      `customer.subscription.created` **200**. En base :
      `select status, trial_end from subscriptions where user_id = :'uid'` →
      `trialing`, `trial_end` à J+90. ⚠ **Et aucune ligne
      `trois mois inclus NON accordés` dans le log** — c'est l'appel
      `subscriptions.create` que le bac à sable n'a pas pu faire.
- [ ] **La case Monthly Presence n'est plus proposée** sur l'écran de paiement
      d'un kit Starter ou Practice (F62, §6.3) : à sa place, une phrase qui
      renvoie à l'abonnement depuis le kit. Acheter le kit, puis s'abonner
      depuis `/app` : deux sessions, deux paiements que les remboursements
      retrouvent.
- [ ] **Monthly Presence seul.** `checkout.session.completed` répond
      `ignored — métadonnées de session illisibles` : **c'est normal**, la
      session n'a pas de palier ; l'abonnement vient de
      `customer.subscription.created`.
- [ ] **Annuler à la fin de la période** depuis Stripe :
      `cancel_at_period_end = true`, `current_period_end` **inchangé**.
- [ ] **Renvoyer** un event depuis Stripe → Événements → **Renvoyer** : réponse
      `duplicate`.

Si ces cinq lignes sont conformes, le chemin de paiement est vérifié en test.

---

### 2.1 Les requêtes, pour lire les sept objets à la main

```sql
\set uid '<user_id>'
select stripe_event_id, type, processed_at from stripe_events order by processed_at desc limit 5;
select stripe_customer_id from profiles where id = :'uid';
select tier, kind, amount_cents, currency, status, paid_at
  from purchases where user_id = :'uid' order by created_at desc limit 1;
-- ⚠ 24900, PAS 249.
select previous_status, new_status, event_type, amount_cents
  from purchase_status_events
 where purchase_id = (select id from purchases where user_id = :'uid' order by created_at desc limit 1);
-- ⚠ ZÉRO ligne à l'achat : le journal commence au remboursement.
with p as (select project_id, stripe_checkout_session_id as cs from purchases
            where user_id = :'uid' order by created_at desc limit 1)
select g.tier, g.grant_key = p.cs as cle_est_la_session, c.plan_tier
  from p join plan_grants g on g.project_id = p.project_id
         join generation_credits c on c.project_id = p.project_id;
-- attendu : le palier, true, le palier. (`has_paid` reste false : rien ne l'écrit, rien ne le lit.)
select stripe_subscription_id, status, active, current_period_end, trial_end, stripe_event_at
  from subscriptions where user_id = :'uid';
select month, status from content_months cm join brand_kits k on k.id = cm.brand_kit_id
  join projects pr on pr.id = k.project_id where pr.user_id = :'uid';
-- attendu, abonnement ouvert : le mois suivant en `generating`
select public.credit_remaining(:'uid', 'post_generation', (date_trunc('month', now()) + interval '1 month')::date);
-- ⚠ Signature en `trialing` : remaining = 30, PAS 8 (§6.1)
```

## 4 · Si ça ne marche pas — où chercher, dans l'ordre

| symptôme | cause la plus probable | où regarder |
|---|---|---|
| le bouton d'achat rend un 500 | une variable de prix absente | le log serveur cite le NOM exact : `StripeConfigError` le porte |
| paiement encaissé, rien en base | `STRIPE_WEBHOOK_SECRET` faux | la route rend 400 et le dit ; `stripe listen` affiche le bon `whsec_` |
| l'event est en base, l'achat non | le traitement a levé après le verrou | chercher `forgetEvent` dans le log : si absent, la ligne d'event est restée et le rejeu l'ignorera |
| l'achat est là, le palier pas ouvert | `grant_plan_allowance` | `plan_grants` vide → l'appeler à la main avec `(project_id, tier, '<cs_…>')` et lire son retour ; `generation_credits.plan_tier` pas au palier → c'est la seconde moitié qui a échoué. ⚠ **Pas `has_paid`** : rien ne l'écrit |
| toute la route rend 500 sur les abonnements, `PGRST204 … stripe_event_at` | le code est déployé **avant** la migration 20260927110000 | appliquer les migrations d'abord ; Stripe rejoue, rien n'est perdu |
| Signature payé, le mois reste en `generating` | le quota lit l'essai comme gratuit | `credit_remaining` doit rendre 30 ; 8 veut dire que 20260927100000 manque (§6.1) |
| log `trois mois inclus NON accordés` | l'appel `subscriptions.create` a échoué | poser l'abonnement à la main dans Stripe (prix Monthly Presence, `trial_period_days: 90`, métadonnées de la session) ; le webhook fera le reste |
| `/app` ne montre rien | cache de page, pas Stripe | recharger ; si ça apparaît, c'est un défaut de revalidation, pas de paiement |
| tout marche, `credit_month_audit` vide | **attendu** | le crédit de contenu n'est pas branché sur le chemin produit (F45) — ce n'est pas un échec de Stripe |

⚠ **La dernière ligne compte.** L'ancienne fiche renvoyait à « l'étape 8b » pour
la même raison ; le recensement du 2026-09-26 a montré que c'est plus large que
le crédit — voir F45. Ne pas chercher du côté de Stripe ce qui n'y est pas.

---

## 5 · Une fois en réel — cinq minutes

- [ ] le même parcours, **un seul achat**, en clés de production
- [ ] **remboursement immédiat** depuis Stripe
- [ ] vérifier en base (§2.1) que l'achat passe en `refunded`

⚠ **En réel, la seule chose qui change est la clé.** Si le parcours de test est
vert, un échec en réel est presque toujours une variable posée en portée
`Preview` au lieu de `Production` — voir `B2-les-secrets.md`.

---

## 5a · ✓ LA LISTE — l'achat de contrôle, à cocher (Naima, ≈ 10 min)

Le code en production est celui de `main` ; le schéma, celui des 177 migrations.

- [ ] **1. Un compte de test** sur le site de production, avec ton adresse et un
      suffixe : `naima+controle@…`. Brief rempli, **État : Californie** (la seule
      vendable aujourd'hui).
- [ ] **2. Acheter depuis le kit du compte** — le bouton d'achat de SON kit, pas
      `/pricing` (un achat sans projet n'ouvre aucun palier, et le contrôle 5
      dirait PAS OK). **Starter, 79 $**, carte réelle, **case Monthly Presence
      décochée**.
- [ ] **3. Dans Stripe (mode live)** → Developers → Webhooks → l'endpoint de
      production → le dernier `checkout.session.completed` : **200**, corps
      contenant `"status":"processed"`.
- [ ] **4. Coller `H-achat-controle.sql`** dans l'éditeur SQL, ton adresse de test
      à la ligne 3 : contrôles **1 à 5 OK**, 6 et 7 PAS OK (normal : pas encore
      remboursé). M'envoyer le résultat.
- [ ] **5. Rembourser** : Stripe → Payments → ce paiement → **Refund** → montant
      total → Refund. Puis Webhooks : le `charge.refunded` en **200**.
- [ ] **6. Recoller `H-achat-controle.sql`** : **7/7 OK**. M'envoyer le résultat.

Coût : les frais Stripe du paiement, que le remboursement ne rend pas (≈ 2,60 $).
La requête H a été éprouvée par `scripts/stripe-path/h-proof.ts` : vraie route,
vraie signature, base à 177 — 5 OK / 2 PAS OK après l'achat, 7/7 après le
remboursement.

## 5b · L'achat de contrôle contre la production migrée — Naima, dix minutes

À jouer **juste après** l'application des 30 migrations, **avant** la fusion : le
code en production est encore celui de `main`, et on vérifie qu'il encaisse sur le
schéma migré (prouvé sur une doublure, `F-application-resultat.md` ; ceci le
confirme sur la vraie base).

### ✓ Recommandé : un achat Starter en carte réelle, remboursé aussitôt

**Pourquoi celui-là.** C'est le seul des deux qui ÉCRIT : il fait passer un
événement neuf par tout le chemin — signature, `stripe_events`, `purchases`,
`plan_grants`, `generation_credits`, puis `charge.refunded` et
`purchase_status_events`. Coût : les frais Stripe du paiement, que le
remboursement ne rend pas (≈ 2,60 $ sur 79 $ aux tarifs US standard).

1. Un compte de test sur le site de production (une adresse à toi, avec `+eklio-controle`).
2. Remplir le brief jusqu'au checkout ; **Starter**, carte réelle.
3. Stripe (live) → Developers → Webhooks → l'endpoint de production → le dernier
   `checkout.session.completed` : réponse **200**, corps `"status":"processed"`.
4. Dans l'éditeur SQL Supabase (lecture seule), avec l'`id` du compte :
   ```sql
   select tier, amount_cents, status from purchases where user_id = '<uid>';      -- starter | 7900 | paid
   select tier, grant_key from plan_grants g join purchases p on p.project_id = g.project_id
    where p.user_id = '<uid>';                                                     -- une ligne
   ```
5. Stripe → Payments → ce paiement → **Refund** (total). Attendre le
   `charge.refunded` : **200**.
6. `select status from purchases where user_id = '<uid>';` → **refunded** ;
   `select new_status, previous_status from purchase_status_events …` → `refunded`, `paid`.
7. Le kit du compte de test est refermé : `/app` ne le montre plus comme payé.

### Pas recommandé seul : renvoyer un événement réel depuis le tableau de bord

Stripe → Events → un `checkout.session.completed` passé → **Resend**. Il ne coûte
rien, mais il **ne prouve presque rien** : l'id de l'événement est déjà dans
`stripe_events`, la route répond `duplicate` **sans rien écrire**. Il confirme la
signature et le routage — pas qu'un achat s'enregistre sur le schéma migré. À
faire en complément (réponse 200 `duplicate` attendue), jamais à la place.

---

## ⚠ Ce que cette fiche ne couvre pas, et qu'il faut savoir avant de la jouer

Stripe encaisse. Il n'ouvre pas un mois de contenu.

Le recensement de F45 a montré que le chemin produit de génération n'est pas le
générateur mesuré : un achat réussi ouvre le palier (`plan_grants`,
`generation_credits.plan_tier`), pose la ligne du mois en `generating` si la
génération est armée, et **rien de plus**. Le mois qu'une cliente
attend ensuite ne se génère aujourd'hui que par le harnais, à la main.

Donc : cette fiche verte veut dire « l'argent rentre et le droit s'ouvre ». Elle
ne veut pas dire « la cliente reçoit son mois ». Les deux sont nécessaires pour
ouvrir ; ils ne sont pas le même chantier.

---

## 6 · Ce que le parcours joué a démenti — 2026-09-27

Premier passage : **8 échecs**. Aucun n'aurait été vu sans jouer le parcours ;
chacun avait un test unitaire vert.

### 6.1 ⚠ F54, réel : les trois mois de Signature étaient lus comme un essai gratuit

Le webhook posait bien le mois en `generating`. L'énumération réelle l'écartait :
**`quota_exhausted — 8 restant(s) pour 30 promis`**. Les trois mois inclus sont
un essai Stripe (`trial_period_days: 90`), `credit_plan_for` voyait `trialing` et
rendait le plan `trial`, dont le quota est de 8 posts. Le préalable aurait refusé
pour la même raison. La cliente qui paie le plus cher attendait un mois qui ne
viendrait jamais.

**Corrigé** : `20260927100000_a_paid_inclusion_is_not_a_trial.sql` — un achat
Signature `paid` ou `partially_refunded` rend le plan `standard`. Remboursé, il
cesse de compter. Test SQL, et le parcours §3 qui le rejoue sur la base.

Et la moitié « énumération » n'avait **aucun port réel** : `selectDueMonths`
n'était éprouvé qu'entre doublures. `serverDuePort`
(`lib/content/month/server-ports.ts`) le câble sur la base, sur **le même kit**
que `queueFirstContentMonth` choisit — le plus récent non supprimé.

### 6.2 Le désordre rouvrait un abonnement résilié

`deleted` puis un `updated` plus ancien → l'abonnement redevenait `active`.
`updated` (active) puis `created` (incomplete) → il redescendait en `incomplete`.
**Corrigé** : `20260927110000` — `subscriptions.stripe_event_at` porte
`event.created`, un event plus ancien ne réécrit rien, `canceled` est terminal et
on ne revient pas à `incomplete` sur le même `stripe_subscription_id`. La ligne
est gardée (le trigger rend `OLD`), pas refusée : lever ferait rejouer Stripe à
l'infini.

⚠ **ORDRE DE DÉPLOIEMENT — À NE PAS PERDRE** : cette migration **avant** le code. Le code déployé
seul fait répondre 500 à tous les events d'abonnement (`PGRST204`) — rien n'est
perdu, Stripe rejoue, mais le tableau de bord Stripe se couvre d'échecs.

### 6.3 FERMÉ PAR LE PRODUIT — Starter ou Practice acheté AVEC Monthly Presence : un remboursement ne fermait rien

> **Tranché le 2026-09-27 (après-midi).** Le champ n'a pas pu être relevé :
> Stripe injoignable. La brief prévoyait ce cas — « si le bon champ n'existe pas,
> masquer la case serait la réponse » ; un champ qu'on ne peut pas voir ne vaut
> pas mieux. Le panier combiné n'est plus vendu :
> `KIT_AND_MONTHLY_PRESENCE_IN_ONE_CHECKOUT = false` (`lib/billing/plans.ts`),
> l'écran ne montre plus la case, et **le serveur refuse** une requête qui la
> porte, avant tout appel à Stripe (`CombinedCheckoutClosedError`, test
> comportemental et contre-épreuve). Monthly Presence s'ajoute depuis le kit
> (`/api/monthly-presence/checkout`), en mode `subscription` pur : ce paiement-là
> n'a pas de kit à fermer.
>
> **Pour rouvrir** : jouer le panier en test, relever le champ, corriger
> `handleChargeRefunded`, passer la constante à `true`. Le parcours automatique
> garde une ligne `⚠ OUVERT` qui dit ce que le webhook ferait d'ici là.


Case cochée, le checkout passe en mode `subscription`, et Stripe rend alors
`payment_intent: null` sur la session : l'argent est sur la facture. L'achat est
écrit sans `stripe_payment_intent_id`, et `charge.refunded` — clé sur le
payment intent — répond `aucun achat pour ce payment_intent`. **Un remboursement
ou un litige laisse le kit ouvert.**

**Non corrigé, exprès.** Retrouver l'achat depuis la charge passe par la facture,
dont la forme dépend de la version d'API (`invoice.payments` depuis 2025) : un
correctif écrit sans pouvoir appeler Stripe se tromperait d'une façon que seul un
vrai appel révèle — la leçon de `WriterPort`. §3, ligne 2, relève exactement le
champ qu'il faut. D'ici là, **deux options sûres** : masquer la case (le kit
seul, puis l'abonnement depuis `/app`), ou traiter un remboursement de ce panier
à la main (`record_purchase_status_event`).

### 6.4 Une session, deux allocations

`grant_key` était l'id d'**event**. Deux events de succès distincts pour une même
session (`completed` puis `async_payment_succeeded`, ou un envoi manuel)
ouvraient deux allocations, et la seconde **remettait à zéro** directions et
régénérations consommées. **Corrigé** : la clé est la session de checkout. Le cas
que l'id d'event couvrait — un rejeu après `forgetEvent` — l'est toujours.

### 6.5 La fiche se trompait cinq fois

| la fiche disait | le parcours a montré |
|---|---|
| `purchase_status_events` : « au moins une ligne » à l'achat | **zéro** — le journal commence au remboursement ; c'est correct |
| `generation_credits.has_paid = true` (×3) | `grant_plan_allowance` ne l'écrit pas, et **aucun code ne le lit** : c'est `plan_tier` qui compte |
| 0.2 : `foundation`/`roster` achetables par requête forgée | déjà fermé par `sellableKitTierSchema` et `plans.sellable` |

### 6.6 Ce qui a tenu du premier coup

Les quatre signatures forgées (400, aucune trace) ; le rejeu (`duplicate`, rien
de dédoublé) ; le même event **deux fois en parallèle** (un `processed`, un
`duplicate`, une ligne) ; l'abonnement arrivé avant sa session ; le paiement
différé (`pending` sans droit, puis `paid`) ; le remboursement complet
(`paid → refunded`, tracé par le trigger).
