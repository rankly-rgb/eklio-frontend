-- I — CE QUE LES PREVIEWS ONT PU LAISSER EN PRODUCTION. Lecture seule : aucun insert, update ni delete.
-- À coller tel quel dans l'éditeur SQL de eklio-backend-us. Une seule grille : section, ligne, date, indice.
-- Indice d'origine le plus sûr : l'URL de retour que Stripe garde dans l'événement (success_url) —
-- un hôte *.vercel.app autre que le domaine de production = un paiement lancé depuis une preview.
with t as (
  select c.relname as tbl,
         (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::bigint as n
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
     and (c.relname in ('profiles', 'stripe_events') or exists (select 1 from pg_attribute a where a.attrelid = c.oid
          and a.attname in ('user_id', 'project_id', 'brand_kit_id', 'organization_id') and not a.attisdropped))
)
select * from (
  select 1 as o, 'A · tables de données client non vides' as section, tbl as ligne, null::timestamptz as date, n || ' ligne(s)' as indice
    from t where n > 0
  union all
  select 2, 'B · comptes', coalesce(u.email, '(sans adresse)'), u.created_at,
         case when u.email ~* '(test|example|invalid|\+)' then 'adresse de test' else '' end
         || ' · dernière connexion ' || coalesce(to_char(u.last_sign_in_at, 'YYYY-MM-DD'), 'jamais')
         || ' · projets=' || (select count(*) from public.projects p where p.user_id = u.id)
    from auth.users u
  union all
  select 3, 'C · projets anonymes (sans compte)', coalesce(p.name, '(sans nom)'), p.created_at,
         'étape=' || coalesce(p.current_step::text, '?') || ' · jeton anonyme expire ' || coalesce(to_char(p.anon_expires_at, 'YYYY-MM-DD'), '—')
    from public.projects p where p.user_id is null
  union all
  select 4, 'D · achats', pu.tier || ' ' || pu.amount_cents || ' ' || pu.currency || ' ' || pu.status, pu.created_at,
         case when pu.stripe_checkout_session_id like 'cs_test_%' then 'session Stripe de TEST' else 'session Stripe live' end
         || ' · compte ' || coalesce((select email from auth.users where id = pu.user_id), '?')
    from public.purchases pu
  union all
  select 5, 'E · événements Stripe', e.type, e.processed_at,
         case when (e.payload ->> 'livemode')::boolean then 'LIVE' else 'test' end
         || ' · retour vers ' || coalesce(substring(e.payload -> 'data' -> 'object' ->> 'success_url' from '^https?://([^/]+)'), '—')
    from public.stripe_events e
  union all
  select 6, 'F · abonnements', s.status || coalesce(' ' || s.stripe_price_id, ''), s.created_at,
         'compte ' || coalesce((select email from auth.users where id = s.user_id), '?')
    from public.subscriptions s
) r order by o, date nulls first, ligne;
