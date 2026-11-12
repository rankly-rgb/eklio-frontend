-- ============================================================================
-- scripts/seo-pages/arming-checks.sql — les vérifications du runbook (SEO_PAGES_ARMING.md)
-- ============================================================================
-- LECTURE SEULE. Aucune ligne n'est écrite. Chaque bloc porte le numéro de l'étape
-- du runbook et le résultat attendu. Éprouvé sur la base locale rejouée depuis zéro
-- (2026-11-12, session 2) avant d'être donné.
-- ============================================================================

-- ── Étape 1.b — les huit tables existent, RLS active ────────────────────────
-- Attendu : 8 lignes, rls = t partout.
select c.relname as table_name, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('seo_modality_terms', 'seo_population_terms', 'seo_query_templates', 'seo_query_metrics',
                     'seo_targets', 'seo_pieces', 'seo_quota_config', 'seo_slot_claims')
 order by 1;

-- ── Étape 1.c — les données de référence ────────────────────────────────────
-- Attendu : templates 5 ; modality_terms = active_modalities ; population_terms 10 ;
-- quota_rows 4 ; metrics 0 ; pieces 0.
select (select count(*) from public.seo_query_templates where active)        as templates,
       (select count(*) from public.seo_modality_terms)                       as modality_terms,
       (select count(*) from public.modality_cards where active)              as active_modalities,
       (select count(*) from public.seo_population_terms)                     as population_terms,
       (select count(*) from public.seo_quota_config)                         as quota_rows,
       (select count(*) from public.seo_query_metrics)                        as metrics,
       (select count(*) from public.seo_pieces)                               as pieces;

-- Attendu : standard 1 / 2, trial 0 / 0.
select plan, kind, monthly_slots, monthly_attempts from public.seo_quota_config order by plan, kind;

-- ── Étape 1.d — les portes ne sont ouvertes qu'au service_role ─────────────
-- Attendu : 4 lignes, anon = f, authenticated = f, service_role = t partout.
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  as service_role
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('claim_seo_slot', 'release_seo_slot', 'seo_quota_for', 'seo_month_entitled')
 order by 1;

-- ── Étape 1.e — le quota, sur des comptes réels (lecture seule) ─────────────
-- Un abonné payant ou comp : attendu article 2, local_page 1.
select s.user_id, q.kind, q.slots
  from (select s.user_id from public.subscriptions s
         where s.status = 'active' and public.credit_plan_for(s.user_id) = 'standard'
         order by s.created_at limit 1) s
 cross join lateral public.seo_quota_for(s.user_id, (date_trunc('month', now()) + interval '1 month')::date) q;

-- Un essai gratuit : attendu article 0, local_page 0. Aucune ligne = aucun compte en essai : rien à vérifier.
select s.user_id, q.kind, q.slots
  from (select s.user_id from public.subscriptions s
         where s.status = 'trialing' and public.credit_plan_for(s.user_id) = 'trial'
         order by s.created_at limit 1) s
 cross join lateral public.seo_quota_for(s.user_id, (date_trunc('month', now()) + interval '1 month')::date) q;

-- Un compte sans abonnement : attendu 0 / 0.
select q.kind, q.slots from public.seo_quota_for(gen_random_uuid(), (date_trunc('month', now()) + interval '1 month')::date) q;

-- ── Étape 4 et 6 — rien n'a été généré ni dépensé ───────────────────────────
-- Attendu : 0 | 0 | 0.
select (select count(*) from public.seo_pieces)      as pieces,
       (select count(*) from public.seo_slot_claims) as claims,
       (select count(*) from public.credit_ledger where reason like '%seo_piece_write%') as ledger_rows;

-- ── Étape 5 — les sources que les pièces peuvent citer, à l'URL exacte ──────
select id, label, kind, url from public.insight_sources where active and url is not null order by sort_order;
