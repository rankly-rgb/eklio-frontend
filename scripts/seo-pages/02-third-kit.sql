-- ============================================================================
-- scripts/seo-pages/02-third-kit.sql — ⚠ HARNAIS, PAS DU PRODUIT
-- ============================================================================
-- UNE TROISIÈME PRATICIENNE, APRÈS LA RELECTURE. Les pièces du deuxième compte
-- ont montré quatre défauts à la relecture (fragment « paragraphs », titre en
-- minuscules, même question sur trois pages, « Yes » à un « What if »). Les
-- contrôles sont corrigés ; un mois ne s'écrase pas, d'où un compte de plus.
-- ============================================================================
-- (copie de 00-kit.sql, autres identifiants, Berkeley, Framer)
-- ============================================================================
-- Le kit de test californien du premier mois SEO réel, sur la BASE LOCALE
-- (`eklio_local_verify`, rejouée depuis zéro par `eklio-backend/scripts/local-verify.sh`).
--
-- Ce qui est posé ici à la main, et pourquoi :
--   * auth.users        — GoTrue n'existe pas dans ce bac à sable ;
--   * le projet, le brief, le kit, la spec du site — leur écrivain produit est la
--     génération de kit (`/api/briefs/[id]/generate`), un appel payant hors
--     périmètre : on pose les champs STRUCTURÉS qu'elle aurait écrits ;
--   * subscriptions     — la ligne que le webhook Stripe écrit à l'abonnement
--     (aucun appel Stripe dans ce chantier).
--
-- Ce qui N'EST PAS posé ici : tout ce que le chantier SEO écrit — cibles,
-- emplacements, pièces, coûts. Ça, c'est le chemin produit, déclenché par la
-- route de cron (`scripts/seo-pages/run-month.ts`).
--
-- Refus en dehors d'une base locale : psql -d eklio_local_verify, rien d'autre.
-- ============================================================================
\set ON_ERROR_STOP on
select current_database() = 'eklio_local_verify' as local_db \gset
\if :local_db
\else
  \echo 'Refus : cette fixture ne s''applique qu''à eklio_local_verify.'
  \quit
\endif

insert into auth.users (id, email) values ('5e0c0001-0000-4000-8000-000000000003', 'lena.park@seo-test.local')
on conflict (id) do nothing;

insert into public.projects (id, user_id, name)
values ('5e0c0002-0000-4000-8000-000000000003', '5e0c0001-0000-4000-8000-000000000003', 'Lena Park Therapy')
on conflict (id) do nothing;

insert into public.project_briefs (project_id) values ('5e0c0002-0000-4000-8000-000000000003')
on conflict (project_id) do nothing;

update public.project_briefs set
  practice_name      = 'Lena Park Therapy',
  state              = 'CA',
  city               = 'Berkeley',
  modality_ids       = array['emdr', 'ifs'],
  client_persona_ids = array['new_parents', 'high_functioning'],
  license_type_id    = 'lmft',
  license_number     = '778899',
  builder_target_id  = 'framer',
  positioning        = 'Careful, collaborative EMDR and IFS for adults who keep everything running and rarely stop to look at what it costs them.',
  usp_statement      = 'Sessions that make room for the part of you that is always on duty, for new parents and demanding careers alike.'
where project_id = '5e0c0002-0000-4000-8000-000000000003';

insert into public.brand_kits (id, project_id, voice_guide)
values ('5e0c0003-0000-4000-8000-000000000003', '5e0c0002-0000-4000-8000-000000000003',
        '{"sounds_like":["plain and specific","warm without gushing","unhurried"],
          "never_write":["jargon without explaining it","exclamation marks","promises about results"]}')
on conflict (id) do nothing;

insert into public.site_specs
  (brand_kit_id, user_id, primary_hex, secondary_hex, accent_hex, light_neutral_hex, dark_neutral_hex,
   heading_font, body_font, google_fonts_url, hero, pages, practice_details, paper_hex)
values ('5e0c0003-0000-4000-8000-000000000003', '5e0c0001-0000-4000-8000-000000000003',
        '#3B2C3A', '#4A5361', '#B4674A', '#F3EDE4', '#241B23', 'A', 'B', 'u',
        '{"overline":"o","headline":"h","subhead":"s","cta_label":"c"}'::jsonb,
        public.site_spec_default_pages(null, null),
        '{"practitioner_name":"Lena Park"}'::jsonb, '#FAF7F2')
on conflict (brand_kit_id) do update set practice_details = excluded.practice_details;

insert into public.subscriptions (user_id, stripe_subscription_id, status, current_period_end)
values ('5e0c0001-0000-4000-8000-000000000003', 'sub_local_seo_test_3', 'active', now() + interval '30 days')
on conflict (user_id) do update set status = 'active', current_period_end = excluded.current_period_end;

select b.state, b.city, b.modality_ids, b.client_persona_ids, b.license_type_id,
       public.seo_month_entitled('5e0c0001-0000-4000-8000-000000000003', (date_trunc('month', now()) + interval '1 month')::date) as entitled_next_month
  from public.project_briefs b where b.project_id = '5e0c0002-0000-4000-8000-000000000003';
