# Le dernier geste — Vercel, DNS, Stripe en réel, dans l'ordre

Établi le 2026-09-27 à partir du **code**, pas de la mémoire : chaque variable
ci-dessous est lue quelque part (`grep process.env`, `requireEnv`,
`priceEnvVar`), et chaque vérification est une commande qui rend oui ou non.

⚠ **Rien de ceci n'a été fait.** Aucune variable Vercel posée, aucun
enregistrement DNS, aucune connexion à la production.

`<domaine>` ci-dessous : le domaine de production. **Il n'est écrit nulle part
dans les deux dépôts** — `.env.example` dit `hello@eklio.com`, rien ne dit que
c'est le domaine acheté. C'est la première chose à confirmer.

---

## 0 · Avant Vercel — l'ordre qui casse s'il est inversé

1. **Les migrations d'abord, le code ensuite.** Le webhook écrit
   `subscriptions.stripe_event_at` (20260927110000). Déployé avant la migration,
   **chaque event d'abonnement répond 500** (`PGRST204`). Rien n'est perdu —
   Stripe rejoue pendant trois jours — mais le tableau de bord Stripe se couvre
   d'échecs et on cherche au mauvais endroit.
2. **La répétition à blanc à zéro échec** sur la branche validée :
   `bash docs/production/C-repetition-a-blanc.sh` (≈ 3 min).

---

## 1 · Vercel — la liste exacte, la portée, l'ordre

### 1.1 Les dix-neuf règles

| # | variable | Production | Preview | ce qui casse si elle manque | ce qui casse si la portée est trop large |
|---|---|---|---|---|---|
| 1 | `NEXT_PUBLIC_SUPABASE_URL` | ✓ | base de **dev** ou rien | toutes les pages (500 au proxy) | ⚠ une preview sur la base de prod = une URL publique d'inscription par branche |
| 2 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | idem | idem | idem |
| 3 | `SUPABASE_SERVICE_ROLE_KEY` | ✓ | **jamais** | webhook, crons, admin : 500 | ⚠ contourne la RLS — lisible par tout build de preview |
| 4 | `NEXT_PUBLIC_SITE_URL` | `https://<domaine>` | **jamais** | repli sur `VERCEL_URL` : retours Stripe et liens de confirmation vers `eklio-xxxx.vercel.app`, **refusés** par la liste de redirections Supabase | une preview enverrait ses liens de confirmation vers la prod |
| 5 | `STRIPE_SECRET_KEY` | `sk_live_…` | `sk_test_…` ou rien | bouton d'achat : `StripeConfigError` | ⚠ `sk_test_` en prod **ne lève rien** : aucun paiement réel n'arrive jamais |
| 6 | `STRIPE_WEBHOOK_SECRET` | `whsec_` de l'endpoint **de prod** | rien | la route rend 500, Stripe rejoue | le secret d'un autre endpoint : tout 400, **paiements sans droit** |
| 7-10 | `STRIPE_PRICE_STARTER` / `_PRACTICE` / `_SIGNATURE` / `_MONTHLY_PRESENCE` | `price_…` **live** | rien | ce palier : 500 au checkout | des prix de test avec une clé live : 500 |
| 11 | `CRON_SECRET` | 32+ caractères | **jamais** | les **sept** crons répondent **503** en nommant la variable | une preview armerait des crons sur sa base |
| 12 | `RESEND_API_KEY` | `re_…` | **jamais** | aucun e-mail ; ⚠ **aucun essai ne se convertit** sans préavis (§17602, `trial-guard`) | une preview enverrait de vrais e-mails |
| 13 | `EMAIL_FROM` | `Eklio <hello@<domaine>>` | libre | défaut `hello@eklio.com` — refusé si ce domaine n'est pas vérifié chez Resend | — |
| 14 | `ANTHROPIC_API_KEY` | ✓ **en dernier** | **jamais** | la génération de kit | ⚠ **trop tôt** : `/api/briefs/[id]/generate` n'a pas de verrou d'armement, chaque inscription dépense |
| 15 | `CONTENT_GENERATION_ARMED` | **absente** | absente | — | la route reste 501 de toute façon ; armée, elle mettrait des mois en file que rien ne rédige |
| 16 | `OPENAI_API_KEY` | **absente** | absente | — | arme une dépense qu'aucun écran ne déclenche (F6, F42) |
| 17 | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | libre | libre | rien : **aucun code ne la lit** | — |
| 18-19 | `STRIPE_PRICE_FOUNDATION`, `_ROSTER` | **absentes** | absentes | — | catalogue mort (`offer.ts`) : poser, c'est faire croire qu'ils se vendent |

**Ne pas poser** non plus : `CONTENT_COPY_MODEL`, `CONTENT_COPY_PROVIDER`,
`CONTENT_COPY_EFFORT`, `CONTENT_EXAMPLES`, `CONTENT_REVISION`,
`CONTENT_PREFIX_BASELINE`, `CONTENT_IMAGE_*` — des réglages de mesure avec leurs
défauts dans le code. `VERCEL_ENV`, `VERCEL_URL`, `NODE_ENV` sont posées par
Vercel.

### 1.2 ⚠ `NEXT_PUBLIC_*` est figée AU BUILD

Les trois `NEXT_PUBLIC_*` sont copiées dans le JavaScript au moment du build.
**Poser ou changer l'une d'elles ne change rien tant qu'on n'a pas redéployé.**
C'est la cause la plus probable de « j'ai corrigé la variable et rien n'a bougé ».

### 1.3 L'ordre de pose

| étape | geste | pourquoi à ce moment |
|---|---|---|
| a | `EMAIL_FROM`, `CRON_SECRET`, `RESEND_API_KEY` | sans risque ; les crons passent de 503 à 404 (armés) |
| b | les trois Supabase + `NEXT_PUBLIC_SITE_URL` | ⚠ puis **plus aucun build de preview** avec ces valeurs |
| c | les cinq Stripe (clé, 4 prix) | le checkout s'ouvre ; le webhook n'est pas encore là → §3 |
| d | **redéployer** (1.2) | les `NEXT_PUBLIC_*` n'existent qu'après |
| e | `STRIPE_WEBHOOK_SECRET`, après avoir créé l'endpoint (§3), puis redéployer | le secret n'existe qu'une fois l'endpoint créé |
| f | `ANTHROPIC_API_KEY` — **en dernier**, et seulement quand la génération de kit doit s'ouvrir | seule variable qui dépense à chaque inscription |

### 1.4 La vérification — un script, pas un regard

```sh
vercel env pull --environment=production /tmp/eklio.production.env
vercel env pull --environment=preview    /tmp/eklio.preview.env
npx tsx scripts/production-path/vercel-env-check.ts production /tmp/eklio.production.env --phase=1
npx tsx scripts/production-path/vercel-env-check.ts preview    /tmp/eklio.preview.env --prod=/tmp/eklio.production.env
rm /tmp/eklio.*.env
```

Il n'imprime aucune valeur. Il refuse : une variable absente, une forme
inattendue (`sk_test_` en production), une variable présente en preview qui
n'y a rien à faire, une valeur de preview **identique** à celle de production,
et `ANTHROPIC_API_KEY` posée avant la phase 2. Éprouvé le 2026-09-27 dans les
deux sens sur des fichiers synthétiques.

Puis, en ligne :

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://<domaine>/api/cron/nudges
# 404 : CRON_SECRET posée (la route cache son existence sans le bon jeton)
# 503 : CRON_SECRET absente — ⚠ B2 disait l'inverse (401/404), c'était faux
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<domaine>/api/stripe/webhook
# 400 : la route répond et refuse une requête sans signature
curl -s -o /dev/null -w '%{http_code}\n' https://<domaine>/api/cron/content-month -H "authorization: Bearer $CRON_SECRET"
# 503 : pas armée. C'est la bonne réponse.
```

Et dans Vercel → Settings → Cron Jobs : **sept** tâches (`anon-briefs`,
`nudges`, `purge-deleted-kits`, `purge-events`, `release-topics`,
`trial-ending`, `trial-guard`). Pas `content-month`.

**Temps : 25 min**, dont la moitié à recopier des valeurs depuis trois tableaux
de bord.

---

## 2 · DNS — les enregistrements, et l'ordre

Les valeurs **exactes** sont celles qu'affichent Vercel et Resend au moment de
l'ajout du domaine ; celles-ci sont les valeurs habituelles, à confronter, pas à
recopier.

| # | où | type | nom | valeur | pour |
|---|---|---|---|---|---|
| 1 | registrar | `A` | `@` | celle que Vercel affiche (habituellement `76.76.21.21`) | le site |
| 2 | registrar | `CNAME` | `www` | celle que Vercel affiche (habituellement `cname.vercel-dns.com`) | le site |
| 3 | registrar | `TXT` | `resend._domainkey` (ou ce que Resend affiche) | la clé DKIM de Resend | ⚠ sans elle, le préavis d'avant-prélèvement part en spam |
| 4 | registrar | `MX` + `TXT` (SPF) | `send` (ou ce que Resend affiche) | valeurs Resend | le retour des rebonds |
| 5 | registrar | `TXT` | `_dmarc` | `v=DMARC1; p=none;` | Gmail et Yahoo l'exigent des expéditeurs |

**L'ordre, et pourquoi :**

1. Ajouter `<domaine>` et `www.<domaine>` dans Vercel → Domains. Poser 1 et 2.
2. Ajouter le domaine dans Resend. Poser 3, 4, 5. Cliquer « Verify ».
3. ⚠ **Attendre que Vercel affiche le certificat** avant la suite : un
   endpoint Stripe sur un domaine sans TLS échoue à chaque envoi.
4. Supabase → Authentication → URL Configuration : **Site URL** =
   `https://<domaine>`, **Redirect URLs** += `https://<domaine>/auth/callback`.
   Sans cette ligne, le lien de confirmation d'inscription est refusé.
5. Poser `NEXT_PUBLIC_SITE_URL` (1.3 b) et redéployer.

**Temps : 15 min de gestes**, plus la propagation (de minutes à quelques heures,
hors de nos mains).

---

## 3 · Stripe en réel — l'endpoint, puis un achat remboursé

1. Stripe (mode **live**) → Developers → Webhooks → **Add endpoint** :
   `https://<domaine>/api/stripe/webhook`, et **exactement ces douze events**
   (`HANDLED_EVENT_TYPES`, `lib/stripe/webhook.ts`) :
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`,
   `charge.dispute.closed`, `charge.refund.updated`, `refund.updated`.
2. Copier son `whsec_…` → `STRIPE_WEBHOOK_SECRET` (1.3 e), redéployer.
3. Un achat Starter réel, **remboursé aussitôt** ; `B5-stripe.md` §5.
   ⚠ **Sans la case Monthly Presence** : un panier kit + abonnement remboursé
   reste ouvert (F62).

**Temps : 15 min.**

---

## 4 · Le coup d'œil — quand il y aura quelque chose à regarder

`B6-le-coup-d-oeil.md` dit quoi regarder. Ce qui manquait : **quoi ouvrir**.

```sh
npx tsx scripts/production-path/planche-390.ts design/<le mois>/planche.html
```

rend la planche à 390 px en une seule image, et refuse une planche qui n'a pas
trente cartes. **Quinze minutes**, sections 1 à 3 de B6 plus la case du pied de
licence.

⚠ **Aujourd'hui il n'y a pas de planche réelle à regarder.** La seule planche
du chemin produit (`design/production-first-month/`) est une **rédaction
rejouée** d'un mois payé une session plus tôt ; aucun mois ne peut être rédigé
avant le 1ᵉʳ octobre, ni par le produit tant que `WriterPort` n'a pas son
transport. Le coup d'œil vient après ce mois-là, pas avant.
