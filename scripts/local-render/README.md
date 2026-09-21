# `scripts/local-render/` — le harnais du premier rendu réel

Écrit le 2026-09-21 pour produire un mois réel sur une base locale, et gardé
pour que ce rendu soit **reproductible**. Rien ici n'est du produit : `app/`
n'en importe rien, et rien ne tourne sur Vercel.

## Ce qui est neuf ici, et ce qui ne l'est pas

Deux **pilotes** n'existaient nulle part dans les deux dépôts, et c'est tout ce
que ces fichiers ajoutent :

- **l'envoi d'un lot à la Batch API.** `lib/content/generate/copy-batch.ts`
  porte `cachedPrefix`, `variablePart`, `buildBatchRequests`, `validateCopy`,
  `collectCopy`, `batchCostUsd` — tous exportés, tous testés — et
  `messages.batches.create` n'est appelé nulle part ;
- **le remplissage de la banque de sujets.** Le tirage existe
  (`next_topic_for_kit`, `assign_topic_to_kit`, la fenêtre de 90 jours, les
  onze validateurs de payload) ; aucune ligne n'écrit dans `content_topics`.

Tout ce qui **juge** ce que ces pilotes écrivent est celui du produit : le
schéma, les RPC, `content_topic_payload_valid`, les deux gardes déontologiques
en trigger, `checkEthics`, et le moteur de composition.

## La clef

Elle arrive **par la commande, jamais par un fichier** :

```bash
ANTHROPIC_API_KEY="$EKLIO_ANTHROPIC_API_KEY" npx tsx scripts/local-render/10-topic-bank.ts --confirm
```

Aucun script d'ici ne l'imprime, même tronquée, et `.env.local` ne la porte
pas.

## L'ordre

```bash
# 0. La base : les 147 migrations et la suite SQL
bash ../../../eklio-backend/scripts/local-verify.sh

# 1. La façade Supabase : PostgREST + les quatre points d'entrée GoTrue
bash scripts/local-render/edge/up.sh     # imprime les valeurs pour .env.local

# 2. Le compte de test
sudo -u postgres psql -d eklio_local_verify -f scripts/local-render/00-account.sql
npx tsx scripts/local-render/00-account.ts

# 3. Le kit, par la vraie route : POST /api/briefs/<project>/generate
#    puis direction, préférences de contenu, check-in — par leurs routes.

# 4. La banque (à relancer jusqu'à 26 par segment : elle complète, elle ne refait pas)
ANTHROPIC_API_KEY="$EKLIO_ANTHROPIC_API_KEY" npx tsx scripts/local-render/10-topic-bank.ts --confirm

# 5. Le mois
ANTHROPIC_API_KEY="$EKLIO_ANTHROPIC_API_KEY" npx tsx scripts/local-render/20-month.ts --confirm

# 6. Les captures, et ce que le moteur a répondu
npx tsx scripts/local-render/40-captures.ts
npx tsx scripts/local-render/50-report.ts
```

`edge/` monte PostgREST 12.2.3 (le binaire est téléchargé hors du dépôt) et une
passerelle Node de 150 lignes. **La moitié authentification est un double** —
GoTrue n'est pas là — et elle n'accorde rien que la RLS n'accorderait pas :
elle signe des JWT HS256 contre des lignes qui existent déjà dans
`auth.users`. `/storage/v1/*` répond 501 exprès.

## Ce qu'il a trouvé

`../../FIRST_REAL_RENDER.md`, et les captures dans
`../../design/preview-2026-09-21/`.
