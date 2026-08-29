# Vérifier le chemin de paiement, à la main

Le parcours complet — inscription, génération, paywall, achat, éditeur de site,
remboursement, rachat — n'a **jamais été exécuté de bout en bout**. Chaque lot a
été vérifié isolément, contre des doublures de ports et des analyses statiques.
Ce document est la passe qui manque.

Il se suit dans un navigateur, en **mode test Stripe**, contre un projet
Supabase **de développement** — jamais le projet US de production. Chaque étape
donne l'action exacte et **la seule observation qui la confirme**. Une étape qui
ne donne pas son observation s'arrête là : la suivante s'appuie dessus.

---

## 0. Avant de commencer

### 0.1 Les variables manquantes

`.env.local` porte aujourd'hui quatre variables sur quatorze. **Les dix autres
sont la raison pour laquelle ce parcours n'a jamais été exécuté** — l'étape 7
échoue à la première ligne sans elles.

| Variable | Étapes qui en dépendent | Ce qui se passe sans elle |
|---|---|---|
| `STRIPE_SECRET_KEY` | 7, 8, 12, 14 | `StripeConfigError` à la création de session ; le bouton d'achat renvoie une erreur serveur |
| `STRIPE_WEBHOOK_SECRET` | 8, 12, 14 | Tout event est refusé : le paiement passe chez Stripe et **rien** n'est débloqué |
| `STRIPE_PRICE_STARTER` / `_PRACTICE` / `_SIGNATURE` | 7 | `StripeConfigError` sur le palier choisi |
| `STRIPE_PRICE_MONTHLY_PRESENCE` | 7 (add-on coché) | idem, dès que l'add-on reste coché |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 7 | Le checkout hébergé se charge quand même — la variable n'est pas lue par ce dépôt aujourd'hui, mais elle est documentée |
| `CRON_SECRET` | *(hors parcours)* | Les routes de cron répondent **404**, délibérément : un secret absent est une porte ouverte, pas une commodité |
| `RESEND_API_KEY`, `EMAIL_FROM` | *(hors parcours)* | Aucun e-mail transactionnel ; sans effet sur ce chemin |

Les ids de prix **diffèrent entre test et live**. Prendre ceux du catalogue de
test, sinon la session se crée contre un catalogue qui n'existe pas.

### 0.2 Le relais de webhook

Sans lui, **aucune étape après la 7 ne fonctionne** : le webhook est la seule
autorité sur ce qui est payé, et aucune page ni redirection n'accorde de droit.

```
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Reporter le `whsec_…` affiché dans `STRIPE_WEBHOOK_SECRET`, **puis redémarrer
`next dev`** — les variables d'environnement sont lues au démarrage.

> Garder ce terminal ouvert et visible pendant tout le parcours. C'est là que
> se lisent les events, et plusieurs observations ci-dessous s'y trouvent
> plutôt qu'à l'écran.

### 0.3 Carte de test

`4242 4242 4242 4242`, date future quelconque, CVC quelconque.

---

## 1 → 6 · De l'inscription à la révélation

| # | Action | Observation qui confirme |
|---|---|---|
| **1** | S'inscrire avec une adresse neuve | Redirection vers `/signup/check-your-email`. Confirmer depuis le dashboard Supabase (Authentication → l'utilisateur → Confirm) si les e-mails ne sont pas configurés |
| **2** | Ouvrir `/app` | La page d'accueil s'affiche, **sans nudge de marque** — aucun projet n'existe encore |
| **3** | Démarrer un brief, répondre aux 7 étapes | À l'étape 1, le champ **« Your name, as it should appear on your site »** est présent sous le nom du cabinet, et il est facultatif |
| **4** | « Build my brand » | Navigation vers `/app/brand-kits/…/reveal`, écran d'attente, les étapes avancent |
| **5** | Attendre la fin | **Trois** cartes de direction, complètes : nom, justification, maquette, trois hex lisibles, paire typographique rendue dans elle-même, mots-clés |
| **6** | Sur une carte, **non payé** : lire le bouton | Il dit **« This one's ready when you are »**, pas « Choose this direction » |

**6b — le contrôle qui compte.** Ouvrir les devtools, onglet Réseau, recharger
`/reveal`, chercher `about_excerpt` dans le document HTML.

> **Attendu : zéro occurrence.** La révélation est gratuite et entière, mais ce
> paragraphe n'est dessiné sur aucune carte et ne doit pas partir. S'il
> apparaît, `forReveal()` a été contourné — regarder si la page passe encore
> `kit.directions.map(forReveal)`.

---

## 7 · Le plafond de générations

| # | Action | Observation |
|---|---|---|
| **7a** | Revenir au brief, relancer « Build my brand » | La génération repart : c'est la régénération gratuite |
| **7b** | La relancer une **troisième** fois | **402**, et le navigateur part sur `/app/checkout?project=…` sans afficher d'erreur |

> **Ce qu'il faut vraiment vérifier ici**, et qui a été signalé comme un
> blocage possible : le refus doit arriver **au troisième essai**, pas au
> premier. `consume_generation_credit` résout le projet *à travers* le kit et
> rend `false` si la ligne `brand_kits` n'existe pas encore. La route crée la
> ligne avant d'appeler le crédit — mais si le premier essai d'un compte tout
> neuf répond déjà 402, **c'est cette précondition qui a lâché**, et le
> symptôme ment : « allocation épuisée » sur un compte qui n'a rien consommé.
>
> **En cas d'échec :** vérifier dans Supabase que la ligne `brand_kits` du
> projet existe, puis appeler `consume_generation_credit` à la main sur son id.

**7c** — dans le terminal du serveur : `[analytics] site_editor_opened` ne doit
**pas** apparaître ; `generation_started` doit apparaître **deux fois**.

---

## 8 · L'achat

| # | Action | Observation |
|---|---|---|
| **8a** | Sur `/app/checkout`, choisir un palier, payer avec la carte de test | Retour sur `/app/checkout/success` |
| **8b** | Regarder le terminal `stripe listen` | `checkout.session.completed` → `200` |
| **8c** | Rester sur la page de succès | Elle passe d'elle-même de « Payment received » à **« You're all set. »** — elle relit `purchases`, elle n'accorde rien |
| **8d** | Supabase → `purchases` | Une ligne, `status = 'paid'`, `stripe_payment_intent_id` **renseigné** ← la suite en dépend entièrement |
| **8e** | Supabase → l'allocation du projet | Elle a été créée. **C'est le point d'intégration que personne n'a exercé.** Si elle manque, chercher dans le terminal une erreur PostgREST sur `grant_plan_allowance` : un nom de paramètre faux ne se voit qu'ici |

> **En cas d'échec en 8e :** comparer les arguments envoyés
> (`lib/stripe/webhook-store.ts`, `grantPlanAllowance`) à la signature réelle.
> Le symptôme est une **boucle** — la route jette, `forgetEvent` désarme
> l'idempotence, et Stripe rejoue indéfiniment le même event. Dans
> `stripe listen`, le même id d'event revient en `500`.

---

## 9 → 11 · Le kit, l'éditeur, la sortie

| # | Action | Observation |
|---|---|---|
| **9** | Retourner sur `/reveal`, choisir une direction | Le bouton dit maintenant **« Choose this direction »**, et le clic mène au kit — plus au checkout |
| **10** | Sur le kit, « Edit your site » | `/app/brand-kits/…/site` s'ouvre : rail à gauche, maquette collée au défilement, panneau de sortie en dessous |
| **11a** | Changer la couleur **Primary** | La maquette change **en fondu**, pas d'un coup, et le bandeau de contraste se recalcule |
| **11b** | Regarder le bloc Contraste | **Sept** paires, toujours dans le même ordre. Choisir un primaire très clair : au moins une paire passe en rouge avec un bouton `Fix` |
| **11c** | Cliquer `Fix` | **Toutes** les sept lignes se re-rendent, pas seulement celle cliquée. Une paire qui passait peut baisser — c'est correct |
| **11d** | Lire la ligne du bouton si elle est sous 4,5 | Elle dit **« below AA »**, jamais « fail », et porte la note sur la taille minimale |

---

## 12 · La bannière de péremption

| # | Action | Observation |
|---|---|---|
| **12a** | Après une édition, regarder au-dessus de la sortie | Bandeau argile, les libellés de ce qui a changé, bouton **« Copy the updated version »** |
| **12b** | Cliquer « Copy all text » (ou « Copy prompt ») | Le bandeau **disparaît** |
| **12c** | Ré-éditer une couleur | Le bandeau **revient** |
| **12d** | Copier une pastille hex isolée | Le bandeau **ne disparaît pas** — une pastille n'est pas la sortie entière |

**12e** — cible Squarespace : la feuille porte **neuf** étapes numérotées et
**aucun bloc de prompt**. Passer à Lovable : un bloc mono avec un compteur de
caractères, et la sortie change **dans le même appel**, sans rechargement.

---

## 13 · Le remboursement — révocation

| # | Action | Observation |
|---|---|---|
| **13a** | **Laisser l'éditeur de site ouvert**, sur un autre onglet rembourser le paiement (Stripe test → Payments → Refund) | `stripe listen` montre `charge.refunded` → `200` |
| **13b** | Supabase → `purchases` | `status = 'refunded'` |
| **13c** | Supabase → `purchase_status_events` | **Une ligne**, `previous_status = 'paid'`. Si l'insert a échoué sur un nom de colonne, le statut n'aura pas bougé non plus — les deux écritures sont un seul port |
| **13d** | Revenir sur l'onglet de l'éditeur, changer une couleur | Redirection vers `/app/checkout?project=…&reversed=1`, **sans bandeau d'erreur**, et le spec revient à son dernier état confirmé |
| **13e** | La page de checkout | Affiche **« That purchase was reversed… everything you wrote is still saved »** |
| **13f** | Appeler `/api/brand-kits/<id>/pdf` | **402**, corps portant `checkoutUrl` et la même phrase. **C'est la vérification la plus importante du document** : le PDF quitte le produit dès qu'il est composé |
| **13g** | Ouvrir `/app/brand-kits/<id>` | Redirection vers le checkout |
| **13h** | Ouvrir `/reveal` | **S'ouvre normalement, complet.** La révélation reste gratuite — c'est le point de vente, pas le livrable |

> **En cas d'échec en 13f ou 13g :** `brand_kit_entitled` rend encore `true`.
> Vérifier qu'elle lit bien `purchases.status`, et qu'elle traite
> `partially_refunded` comme **entitling** — c'est ce que suppose
> `ENTITLING_STATUSES` dans `lib/billing/entitlements.ts`, et une divergence
> ferait lire « votre achat a été annulé » sur un kit qui s'ouvre.

---

## 14 · Le rachat

| # | Action | Observation |
|---|---|---|
| **14a** | Depuis le checkout, racheter | `checkout.session.completed` → `200`, nouvelle ligne `purchases` en `paid` |
| **14b** | Rouvrir l'éditeur de site | Il s'ouvre, **avec le spec exactement tel qu'il était** : les couleurs éditées, la copy, les instructions supplémentaires |
| **14c** | `/api/brand-kits/<id>/pdf` | Le fichier se télécharge |

> La révocation ne porte **que sur l'accès futur**. Le PDF téléchargé à
> l'étape 12 reste sur le disque de la praticienne, et rien ici n'essaie de
> l'atteindre.

---

## Facultatif · Litige et remboursement échoué

Ces chemins ne se déclenchent pas depuis le dashboard en mode test aussi
simplement qu'un remboursement.

```
stripe trigger charge.dispute.created
stripe trigger charge.dispute.closed
```

Les objets générés ne portent **pas** le `payment_intent` de l'achat réel : la
recherche par `purchaseByPaymentIntent` rendra `null` et l'event sera **ignoré**
avec la raison « aucun achat pour ce payment_intent ». C'est le comportement
attendu, et c'est **tout** ce que `stripe trigger` peut confirmer ici.

Pour éprouver réellement le litige, il faut un `payment_intent` existant —
`stripe trigger` avec un fixture override, ou la carte de test de litige
`4000 0000 0000 0259`, qui produit un litige sur un vrai paiement.

---

## Ce que cette passe ne couvre pas

- **Le paiement différé** (`checkout.session.async_payment_succeeded`). Il
  demande un moyen de paiement asynchrone — prélèvement SEPA en test. C'est le
  bug qui laissait une cliente payer sans jamais être débloquée : il vaut sa
  propre passe.
- **Le run mensuel** — `CRON_SECRET` absente, routes en 404 par conception.
- **Les e-mails transactionnels** — `RESEND_API_KEY` absente.
