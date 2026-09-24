# Stripe — la liste cochable, dix lignes

⚠ **Le test de bout en bout n'a jamais été confirmé**, ni en test ni en
production. Ce n'est pas « à revérifier » : c'est « jamais fait ».

Un seul achat réel suffit à cocher les dix. À faire en mode test d'abord, puis
une fois en réel avec un remboursement immédiat.

| # | le geste | ce qui doit se produire | où le voir |
|---|---|---|---|
| 1 | acheter **Monthly Presence** sur un compte neuf | `checkout.session.completed` reçu | Stripe → Événements |
| 2 | — | la signature du webhook est **vérifiée**, pas seulement reçue | log de la route, statut 200 |
| 3 | — | une ligne d'abonnement en base, statut actif | `select status, current_period_end from subscriptions where user_id = …` |
| 4 | — | le quota de crédits du mois existe | `select * from credit_month_audit where user_id = … and month = date_trunc('month', now())` |
| 5 | — | l'écran `/app` montre l'abonnement actif, sans rechargement forcé | le navigateur |
| 6 | **rembourser** depuis Stripe | `charge.refunded` reçu et traité | Stripe → Événements, puis la base |
| 7 | **annuler** l'abonnement depuis Stripe | `customer.subscription.deleted` reçu ; la base passe à annulé | `select status from subscriptions` |
| 8 | — | l'accès se ferme à la fin de période, pas à l'instant | `current_period_end` respecté |
| 9 | rejouer le même webhook **deux fois** | le second est ignoré, pas appliqué deux fois | aucune ligne en double |
| 10 | envoyer un webhook à **signature invalide** | rejeté en 400, rien en base | log de la route |

⚠ **La 9 et la 10 sont celles qu'on oublie, et ce sont les deux qui coûtent.**
Stripe rejoue un webhook quand il n'a pas reçu de 200 à temps : un traitement
non idempotent facture deux fois. Et une route qui accepte une signature
invalide accepte un abonnement que personne n'a payé.

⚠ **La 4 dépend de l'étape 8b.** Tant que le crédit n'est pas branché sur le
chemin produit, la ligne 4 sera vide même si tout le reste marche — ce n'est pas
un échec de Stripe, et il faut le savoir avant de chercher au mauvais endroit.
