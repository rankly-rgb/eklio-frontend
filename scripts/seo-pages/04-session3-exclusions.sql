-- ⚠ HARNAIS, BASE LOCALE SEULEMENT (session 3).
-- La mesure finale passe par la route, qui sert TOUTES les abonnées vivantes. Dana et
-- Maya (les comptes de la session 1, dont les mois de novembre portent maintenant les
-- pièces FIXTURE des preuves de concurrence et de reprise) ne doivent ni dépenser ni
-- compter : leur abonnement local passe à « canceled », comme le webhook le poserait.
update public.subscriptions set status = 'canceled'
 where user_id in ('5e0c0001-0000-4000-8000-000000000001', '5e0c0001-0000-4000-8000-000000000002');
