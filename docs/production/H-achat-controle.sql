-- H — L'ACHAT DE CONTRÔLE, VU DE LA BASE. Lecture seule. Changer UNE ligne : l'adresse ci-dessous.
-- À coller deux fois : après l'achat (les lignes « achat ») puis après le remboursement (toutes).
with p as (select lower('ADRESSE@DU.COMPTE.DE.TEST') as email),
u as (select au.id from auth.users au, p where lower(au.email) = p.email),
b as (select pu.* from public.purchases pu where pu.user_id = (select id from u) order by pu.created_at desc limit 1),
checks(ordre, controle, ok, detail) as (
  select 1, 'compte : trouvé par son adresse', (select count(*) from u) = 1, (select count(*) || ' compte(s)' from u)
  union all select 2, 'achat : une ligne purchases Starter à 7900 cents',
    exists (select 1 from b where tier = 'starter' and amount_cents = 7900),
    (select coalesce(string_agg(tier || ' ' || amount_cents || ' ' || currency, ' '), 'aucune') from b)
  union all select 3, 'achat : payé (paid_at posé, payment_intent relié)',
    exists (select 1 from b where paid_at is not null and stripe_payment_intent_id is not null),
    (select coalesce(string_agg(status || ' · pi=' || coalesce(left(stripe_payment_intent_id, 8), 'NULL'), ' '), 'aucune') from b)
  union all select 4, 'achat : l''événement Stripe enregistré (verrou de rejeu)',
    exists (select 1 from public.stripe_events e, b where e.type = 'checkout.session.completed'
             and e.payload -> 'data' -> 'object' ->> 'id' = b.stripe_checkout_session_id),
    (select count(*) || ' événement(s) checkout.session.completed pour cette session' from public.stripe_events e, b
      where e.payload -> 'data' -> 'object' ->> 'id' = b.stripe_checkout_session_id)
  union all select 5, 'achat : le palier ouvert (plan_grants + generation_credits)',
    exists (select 1 from public.plan_grants g, b where g.project_id = b.project_id and g.tier = 'starter')
      and exists (select 1 from public.generation_credits c, b where c.project_id = b.project_id and c.plan_tier = 'starter'),
    (select 'grants=' || (select count(*) from public.plan_grants g where g.project_id = b.project_id)
            || ' · plan_tier=' || coalesce((select c.plan_tier from public.generation_credits c where c.project_id = b.project_id), 'NULL') from b)
  union all select 6, 'remboursement : l''achat passé en refunded',
    exists (select 1 from b where status = 'refunded'), (select coalesce(string_agg(status, ' '), 'aucune') from b)
  union all select 7, 'remboursement : la transition paid → refunded tracée',
    exists (select 1 from public.purchase_status_events s, b where s.purchase_id = b.id
             and s.previous_status = 'paid' and s.new_status = 'refunded' and s.event_type = 'charge.refunded'),
    (select coalesce(string_agg(coalesce(s.previous_status, '∅') || '→' || s.new_status || ' (' || s.event_type || ')', ' ; ' order by s.occurred_at), 'aucune')
       from public.purchase_status_events s, b where s.purchase_id = b.id)
)
select controle as "contrôle", case when ok then 'OK' else 'PAS OK' end as statut, detail as "détail" from checks order by ordre;
