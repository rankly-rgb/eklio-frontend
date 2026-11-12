-- ============================================================================
-- scripts/seo-pages/03-session2-profiles.sql — ⚠ HARNAIS, PAS DU PRODUIT
-- ============================================================================
-- Les profils de la session 2 (« éprouver avant d'armer »), posés par le même
-- chemin que 00-kit.sql : auth.users, projet, brief STRUCTURÉ, kit, spec du site,
-- abonnement actif (ce que le webhook poserait). Rien du chantier SEO n'est écrit ici.
--
--   A   psychologue  Los Angeles, CA  CBT                 ligne d'autrice, « PSY »
--   B   LCSW         Brooklyn, NY     somatic (≈ trauma)  règles d'un autre État
--   C   LPC          Austin, TX       Gottman, couples    population « couples »
--   C′  LMFT         San Diego, CA    Gottman, couples    « couples » dans un État vérifié
--   D   LMFT         Oakland, CA      EMDR                collision avec E
--   E   LMFT         Oakland, CA      EMDR                collision avec D
--
-- ⚠ B ET C NE SONT PAS VÉRIFIÉS, EXPRÈS. New York et le Texas n'ont pas de ligne
-- `license_type_states.verified_at` (F12) : le pipeline doit les refuser AVANT toute
-- réservation. Les « vérifier » ici pour obtenir des pièces serait assouplir les
-- règles de licence — interdit. C′ éprouve la population « couples » en Californie.
--
-- ⚠ « Trauma-informed » n'est pas une modalité du catalogue (`modality_cards`) :
-- B porte `somatic_experiencing`, la plus proche, et le rapport le dit.
-- ============================================================================
\set ON_ERROR_STOP on
select current_database() = 'eklio_local_verify' as local_db \gset
\if :local_db
\else
  \echo 'Refus : cette fixture ne s''applique qu''à eklio_local_verify.'
  \quit
\endif

create or replace function pg_temp.seo_profile(
  p_tag text, p_email text, p_name text, p_practice text,
  p_state text, p_city text, p_licence text, p_number text,
  p_modalities text[], p_personas text[], p_builder text,
  p_positioning text, p_usp text
) returns void language plpgsql as $$
declare
  v_user uuid := ('5e5e0001-0000-4000-8000-0000000000' || p_tag)::uuid;
  v_project uuid := ('5e5e0002-0000-4000-8000-0000000000' || p_tag)::uuid;
  v_kit uuid := ('5e5e0003-0000-4000-8000-0000000000' || p_tag)::uuid;
begin
  insert into auth.users (id, email) values (v_user, p_email) on conflict (id) do nothing;
  insert into public.projects (id, user_id, name) values (v_project, v_user, p_practice) on conflict (id) do nothing;
  insert into public.project_briefs (project_id) values (v_project) on conflict (project_id) do nothing;
  update public.project_briefs set
    practice_name = p_practice, state = p_state, city = p_city,
    modality_ids = p_modalities, client_persona_ids = p_personas,
    license_type_id = p_licence, license_number = p_number,
    builder_target_id = p_builder, positioning = p_positioning, usp_statement = p_usp
  where project_id = v_project;
  insert into public.brand_kits (id, project_id, voice_guide)
  values (v_kit, v_project,
          '{"sounds_like":["plain and specific","warm without gushing","unhurried"],
            "never_write":["jargon without explaining it","exclamation marks","promises about results"]}')
  on conflict (id) do nothing;
  insert into public.site_specs
    (brand_kit_id, user_id, primary_hex, secondary_hex, accent_hex, light_neutral_hex, dark_neutral_hex,
     heading_font, body_font, google_fonts_url, hero, pages, practice_details, paper_hex)
  values (v_kit, v_user, '#3B2C3A', '#4A5361', '#B4674A', '#F3EDE4', '#241B23', 'A', 'B', 'u',
          '{"overline":"o","headline":"h","subhead":"s","cta_label":"c"}'::jsonb,
          public.site_spec_default_pages(null, null),
          jsonb_build_object('practitioner_name', p_name), '#FAF7F2')
  on conflict (brand_kit_id) do update set practice_details = excluded.practice_details;
  insert into public.subscriptions (user_id, stripe_subscription_id, status, current_period_end)
  values (v_user, 'sub_local_seo_s2_' || p_tag, 'active', now() + interval '30 days')
  on conflict (user_id) do update set status = 'active', current_period_end = excluded.current_period_end;
end $$;

select pg_temp.seo_profile('a1', 'a.psychologist@seo-test.local', 'Dr. Ines Alvarez', 'Alvarez Psychology',
  'CA', 'Los Angeles', 'licensed_psychologist', '28456', array['cbt', 'act'], array['high_functioning', 'first_time_therapy'],
  'squarespace',
  'Practical, skills-based CBT for adults who want to understand their patterns and leave each session with something to try.',
  'Structured CBT for professionals and first-time clients who want a clear plan more than open-ended talk.');

select pg_temp.seo_profile('b1', 'b.lcsw@seo-test.local', 'Marcus Reed', 'Reed Clinical Social Work',
  'NY', 'Brooklyn', 'lcsw', 'R-104552', array['somatic_experiencing', 'emdr'], array['carrying_old_thing', 'crossroads'],
  'webflow',
  'Body-aware, trauma-informed therapy for adults who carry something from years back and are tired of explaining it.',
  'Slow, body-aware trauma work that does not ask you to retell everything to get somewhere.');

select pg_temp.seo_profile('c1', 'c.lpc@seo-test.local', 'Hannah Cole', 'Cole Couples Counseling',
  'TX', 'Austin', 'lpc', '77812', array['gottman', 'eft'], array['couples_roommates', 'new_parents'],
  'wix',
  'Direct, structured couples counseling for partners who feel more like roommates than a team.',
  'Gottman-based couples work with a clear structure for partners who want to talk to each other again.');

select pg_temp.seo_profile('c2', 'c2.lmft@seo-test.local', 'Diego Ramirez', 'Ramirez Couples Therapy',
  'CA', 'San Diego', 'lmft', '119034', array['gottman', 'eft'], array['couples_roommates', 'new_parents'],
  'wix',
  'Direct, structured couples therapy for partners who feel more like roommates than a team.',
  'Gottman Method and EFT for couples who want to stop having the same argument and start talking to each other again.');

select pg_temp.seo_profile('d1', 'd.lmft@seo-test.local', 'Priya Natarajan', 'Natarajan Therapy',
  'CA', 'Oakland', 'lmft', '120455', array['emdr', 'somatic_experiencing'], array['carrying_old_thing', 'high_functioning'],
  'squarespace',
  'Steady EMDR for adults who look fine from the outside and still feel the old thing every day.',
  'EMDR with room for the body, for professionals who have outgrown just talking about it.');

select pg_temp.seo_profile('e1', 'e.lmft@seo-test.local', 'Jordan Ellis', 'Ellis Counseling',
  'CA', 'Oakland', 'lmft', '121877', array['emdr', 'ifs'], array['carrying_old_thing', 'caregivers'],
  'lovable',
  'Patient EMDR and IFS for adults who spend their days caring for others and rarely get to put the old thing down.',
  'EMDR for caregivers who never get to be the patient, paced around a life that does not pause.');

select u.email, b.state, b.city, b.license_type_id, b.modality_ids[1] as principal,
       public.seo_month_entitled(u.id, (date_trunc('month', now()) + interval '1 month')::date) as entitled_next,
       public.state_is_sellable(b.state) as state_verified
  from auth.users u
  join public.projects p on p.user_id = u.id
  join public.project_briefs b on b.project_id = p.id
 where u.email like '%@seo-test.local' and u.id::text like '5e5e0001%'
 order by u.email;
