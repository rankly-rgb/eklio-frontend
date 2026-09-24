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
