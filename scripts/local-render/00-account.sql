-- Les deux seules lignes du compte de test qui ne passent pas par le produit,
-- et la raison de chacune :
--
--   auth.users  — GoTrue écrit cette table, et GoTrue n'existe pas dans ce bac
--                 à sable. Le trigger `on_auth_user_created` fait le reste.
--   comp_grants — la table des comptes offerts. Elle porte `granted_by` parce
--                 qu'elle est écrite à la main par construction ; il n'y a pas
--                 de RPC, et il ne doit pas y en avoir.
--
-- Tout le reste du compte — projet, brief, segments, préférences, check-in,
-- kit, mois — passe par les tables et les RPC du produit.

insert into auth.users (email)
     values ('rowan.mercier@eklio-test.invalid')
on conflict do nothing;

insert into public.comp_grants (user_id, reason, granted_by, generation_credits, expires_at)
select u.id,
       'first real render, local base, test account',
       'scripts/local-render/00-account.sql',
       200,
       now() + interval '30 days'
  from auth.users u
 where u.email = 'rowan.mercier@eklio-test.invalid'
   and not exists (select 1 from public.comp_grants g where g.user_id = u.id and g.revoked_at is null);

select p.id as profile_id, p.email from public.profiles p
 where p.email = 'rowan.mercier@eklio-test.invalid';

-- ── ⚠ LA PORTE DE QUALIFICATION, OUVERTE EN LOCAL ET SEULEMENT LÀ ───────
--
-- Trouvé par le rendu réel, pas par une lecture : sur une base fraîchement
-- rejouée, `license_type_states.verified_at` est NULL sur les 254 lignes de
-- la matrice. `project_state_is_sellable` compte les lignes vérifiées de
-- l'État, n'en trouve aucune, et `/api/briefs/[id]/generate` répond 409
-- « We're not open in CA yet » — dans les cinquante États, pour les onze
-- titres. Un environnement neuf ne peut donc générer AUCUN kit.
--
-- Le refus est juste : il empêche d'imprimer un titre d'exercice que
-- personne n'a vérifié contre un board. Ce qui manque n'est pas du code,
-- c'est l'acte : quelqu'un lit le site du board et pose la date.
--
-- Ici, pour une thérapeute fictive dans une base locale, cet acte n'existe
-- pas et on n'en fabrique pas l'apparence : `verified_by` dit exactement ce
-- qui s'est passé. Rien de ceci n'est une migration, rien n'est dans la
-- graine, et rien ne quitte cette machine.
update public.license_type_states
   set verified_at = now(),
       verified_by = 'LOCAL RENDER HARNESS — not a board check',
       abbreviation = case license_type_id
                        when 'lmft' then 'LMFT'
                        when 'lcsw' then 'LCSW'
                        when 'lpcc' then 'LPCC'
                        when 'licensed_psychologist' then 'Psychologist'
                      end
 where state_code = 'CA';
