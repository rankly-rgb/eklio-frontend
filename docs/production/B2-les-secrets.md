# Les quatre secrets — noms exacts, portée exacte, et l'ordre

⚠ **La portée est la partie qui se rate.** Un nom mal orthographié donne une
erreur au premier appel, et on le voit. Une portée trop large ne donne rien du
tout : elle marche, et c'est le problème.

## Les noms, et où ils sont lus

| variable | lue par | portée Vercel |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | routes serveur, `scripts/` | **Production uniquement** |
| `ANTHROPIC_API_KEY` | `/api/briefs/[id]/generate`, `/api/cron/content-month` | **Production uniquement** |
| `CRON_SECRET` | `lib/api/cron.ts`, les six routes `cron` | **Production uniquement** |
| `RESEND_API_KEY` | `/api/cron/trial-guard`, `/api/cron/trial-ending` | **Production uniquement** |

Et une non secrète qui les accompagne : `EMAIL_FROM`, lue par
`lib/email/transport.ts`, qui peut aller partout.

## ⚠ L'ERREUR DE PORTÉE, NOMMÉE

**Coller ces quatre-là sur `Preview` et `Development` en même temps que sur
`Production`.** C'est le geste naturel — Vercel coche les trois par défaut — et
c'est celui à ne pas faire, pour deux raisons différentes :

1. **`SUPABASE_SERVICE_ROLE_KEY` contourne la RLS.** Sur `Preview`, chaque
   branche poussée obtient une URL publique, devinable, et un build qui porte
   cette clé peut lire et écrire la base de production entière. Le
   contournement de RLS est le but de cette clé ; l'exposer sur une URL de
   prévisualisation la met à portée de quiconque connaît le nom de la branche.
2. **`ANTHROPIC_API_KEY` dépense de l'argent.** Une prévisualisation qui la
   porte peut appeler `/api/briefs/[id]/generate` — ou, une fois le `cron`
   armé, `/api/cron/content-month`. ⚠ Un lot Batch **est facturé à la
   soumission** : une prévisualisation oubliée n'a pas besoin d'aboutir pour
   coûter.

## ⚠ L'ERREUR DE MOMENT, NOMMÉE

**Coller `ANTHROPIC_API_KEY` avant que `CONTENT_GENERATION_ARMED` soit
explicitement à autre chose que `"true"`.**

Le verrou tient : `/api/cron/content-month` répond `503` si la variable n'est
pas exactement `"true"`, et `vercel.json` ne liste pas cette route. Mais
`/api/briefs/[id]/generate` n'a pas de verrou d'armement — c'est la génération
de kit, elle est censée répondre. Poser la clé ouvre donc immédiatement une
dépense par inscription, avant que le quota de crédits soit branché sur le
chemin produit (**étape 8b, bloquante**).

**L'ordre est donc :** les trois autres secrets d'abord, `ANTHROPIC_API_KEY` en
dernier, après 8b.

## L'ordre, en six lignes

1. `EMAIL_FROM` (non secrète) — partout.
2. `CRON_SECRET` — Production. ⚠ **Avant** de repointer Vercel : sans elle les
   six `crons` répondent 404, et un 404 sur un `cron` ne réveille personne.
3. `RESEND_API_KEY` — Production.
4. `SUPABASE_SERVICE_ROLE_KEY` — Production. ⚠ Après elle, plus aucun build de
   prévisualisation ne doit être déclenché sur la branche de production.
5. — **faire l'étape 8b** (le crédit branché sur le chemin produit) —
6. `ANTHROPIC_API_KEY` — Production, en dernier.

## Comment vérifier, sans rien deviner

| variable | la vérification |
|---|---|
| `CRON_SECRET` | `curl -s -o /dev/null -w '%{http_code}' https://<site>/api/cron/nudges` → **401** (et non 404 : 404 veut dire que la variable manque) |
| `SUPABASE_SERVICE_ROLE_KEY` | une page `/app` se charge pour un compte connecté |
| `RESEND_API_KEY` | `/api/cron/trial-ending` appelé avec le secret → 200 et un envoi dans le tableau de bord Resend |
| `ANTHROPIC_API_KEY` | `/api/briefs/[id]/generate` sur un brief de test rend un kit ; ⚠ elle est lue par la ROUTE, pas par le client : une clé posée dans un shell ne sert à rien ici |

---

## ⚠ Mise à jour du 2026-09-26 — un cinquième secret, et il n'existe pas encore

La fiche parle de **quatre** secrets. Un cinquième est apparu au brief du
2026-09-26 : `EKLIO_OPENAI_API_KEY`, pour basculer la rédaction sur OpenAI.

**Il n'a pas été posé, et la bascule est reportée** (F42) :

| | constat |
|---|---|
| la clef | absente de l'environnement, de `/run/secrets` et de tout `.env` |
| les domaines OpenAI | tous refusés par la politique d'egress — 403 au CONNECT |

⚠ **Ne l'ajoute pas à cette liste tant que la bascule n'est pas mesurée.** Un
secret posé en production pour un chemin qu'aucun run n'a exercé est une portée
de plus à se tromper, pour rien. `lib/content/generate/provider.ts` est en place
et éprouvé hors ligne ; le transport HTTP n'est pas écrit.

⚠ **Et si la bascule se fait un jour, la portée n'est pas « Production ».** Les
trois bras de comparaison (M2) tournent en local contre une copie : la clef y
passe **par commande**, jamais par une variable Vercel.

## ⚠ Ce qui n'a pas changé, et qui reste la ligne la plus importante

`ANTHROPIC_API_KEY` doit être lue **par la route**, pas seulement au build. La
condition 4 de B3 reste non vérifiée : aucun kit n'a été généré par
`/api/briefs/[id]/generate`. Tout ce qui a été mesuré depuis — deux mois livrés,
0,574 $ le mois — l'a été **par le harnais**, jamais par le produit.
