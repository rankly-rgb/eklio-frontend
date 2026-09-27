-- ════════════════════════════════════════════════════════════════════════════
--  G — LES 30 MIGRATIONS, À COLLER EN UNE FOIS DANS L'ÉDITEUR SQL DE SUPABASE
-- ════════════════════════════════════════════════════════════════════════════
--
-- Généré par docs/production/G-generer.sh depuis eklio-backend : les fichiers de
-- supabase/migrations absents de origin/main, dans l'ordre, F61 (20260927110000)
-- et F64 (20260927130000) comprises. NE PAS ÉDITER À LA MAIN : regénérer.
--
-- UNE SEULE TRANSACTION. Une erreur n'importe où — une migration, le registre,
-- un contrôle final — annule TOUT : la base reste exactement comme avant.
--
-- ⚠ LE RÔLE. Les privilèges par défaut de Supabase (tables ouvertes à
-- anon/authenticated/service_role, fonctions exécutables par eux) sont attachés
-- au rôle postgres : un objet créé sous un autre rôle n'en reçoit AUCUN — des
-- tables que l'application ne peut plus lire, des fonctions exécutables par
-- PUBLIC —, et une fonction SECURITY DEFINER s'exécute avec les droits de son
-- propriétaire. Ce fichier fait donc deux choses :
--   1. il passe en postgres pour la transaction (set local role postgres) : si le
--      rôle de l'éditeur ne le peut pas, il s'arrête sur cette ligne, rien n'est
--      fait ;
--   2. il pose EXPLICITEMENT, à la fin, les droits des 71 objets que ces
--      migrations créent, tels que le rejeu en postgres les produit : le résultat
--      ne dépend plus des privilèges par défaut.
-- Aucune ne supprime ni ne recrée un objet existant (vérifié par oid) : ces
-- 71 objets sont les seuls que les privilèges par défaut toucheraient.
--
-- Un second collage ne fait rien : le garde-fou d'entrée refuse si l'une des
-- 30 est déjà enregistrée.
-- ════════════════════════════════════════════════════════════════════════════

begin;

set local role postgres;

do $guard$
declare
  v_missing text;
  v_already text;
begin
  if current_user <> 'postgres' then
    raise exception 'ARRÊT : le rôle courant est %, pas postgres. Rien n''a été fait.', current_user;
  end if;
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'ARRÊT : supabase_migrations.schema_migrations introuvable. Rien n''a été fait.';
  end if;
  select string_agg(v, ' ') into v_already
    from unnest(array['20260920140000','20260920140100','20260920150000','20260920150100','20260920150200','20260920150300','20260920160000','20260920160100','20260920170000','20260920180000','20260921090000','20260921100000','20260921110000','20260921120000','20260921140000','20260923100000','20260923110000','20260924100000','20260924120000','20260924130000','20260924140000','20260924150000','20260924160000','20260926090000','20260926120000','20260927090000','20260927100000','20260927110000','20260927120000','20260927130000']) v
   where exists (select 1 from supabase_migrations.schema_migrations s where s.version = v);
  if v_already is not null then
    raise exception 'ARRÊT : déjà enregistrées : %. Ce fichier a déjà été appliqué, en tout ou partie. Rien n''a été fait.', v_already;
  end if;
  select string_agg(v, ' ') into v_missing
    from unnest(array['20260823000000','20260823150000','20260825160000','20260827100000','20260827101000','20260827102000','20260827103000','20260827104000','20260827105000','20260827106000','20260827107000','20260830060048','20260830060159','20260830060321','20260830060424','20260830060516','20260830060617','20260830060701','20260830060712','20260830060759','20260830060903','20260830061029','20260830061046','20260830061119','20260830061318','20260830061402','20260830061432','20260830061454','20260830061516','20260830061639','20260830061753','20260830062004','20260830062021','20260830062040','20260830062227','20260830062241','20260830062321','20260901074421','20260901074458','20260901074515','20260901074531','20260901074612','20260901074638','20260901074731','20260901074802','20260901074842','20260901074903','20260901074933','20260901182351','20260901182419','20260901190000','20260902090000','20260903090000','20260903140000','20260903160000','20260903180000','20260903190000','20260903200000','20260903210000','20260903220000','20260903230000','20260903240000','20260903250000','20260903260000','20260903270000','20260903280000','20260903290000','20260905175222','20260905175503','20260905181048','20260905182335','20260905185500','20260905190204','20260905191203','20260905194933','20260906112044','20260906155600','20260906164920','20260909094038','20260909100346','20260909140552','20260909150116','20260910082539','20260910083735','20260910084320','20260910093929','20260910094102','20260910100415','20260910100758','20260910102753','20260910144421','20260910192157','20260910210435','20260910212308','20260910212828','20260911113747','20260911133504','20260911170021','20260911170458','20260911180620','20260911180839','20260911180918','20260911182533','20260911190810','20260911191432','20260911193259','20260911195327','20260911195907','20260912144121','20260912145638','20260912153103','20260912153157','20260914072327','20260914073802','20260914074549','20260914075810','20260914080527','20260914081457','20260914082152','20260914084054','20260914091227','20260914091622','20260914134552','20260915053102','20260915100122','20260915101137','20260915122121','20260915125159','20260915135138','20260915135207','20260917073026','20260917101844','20260917101901']) v
   where not exists (select 1 from supabase_migrations.schema_migrations s where s.version = v);
  if v_missing is not null then
    raise exception 'ARRÊT : la base n''est pas celle attendue — migrations de main absentes du registre : %. Rien n''a été fait.', v_missing;
  end if;
  raise notice 'Garde-fou : rôle postgres, les 133 de main présentes, aucune des 30. On applique.';
end
$guard$;

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260920140000_monthly_presence_has_a_chokepoint.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — Monthly Presence gets the database chokepoint it never had
-- ============================================================================
-- This migration LIFTS A DOCUMENTED STOP. `20260901182419_comp_grant_entitlement`
-- ended its header with this, and then did nothing about it:
--
--   > Monthly Presence entitlement is NOT centralised in the database. […]
--   > There is no database chokepoint to OR a comp check into without either
--   > (a) writing a fabricated `subscriptions` row, which
--   > `stripe_subscription_id text not null unique` makes impossible without
--   > inventing a fake Stripe id, or (b) an application-code special case,
--   > which is out of scope. Per instruction for exactly this case: STOPPING
--   > here rather than centralising Monthly Presence myself. A comp grant does
--   > not currently unlock Monthly Presence; this is a known, reported gap,
--   > not an oversight.
--
-- ── WHY THE OBJECTION NO LONGER HOLDS ────────────────────────────────────
--
-- Objection (a) was about writing a ROW. Nothing here writes one: the comp
-- clause is a function call, exactly as `brand_kit_entitled` already does it.
-- Objection (b) was about scattering a special case through the callers; a
-- single function is the opposite of that.
--
-- What remains is the real reason it was left in TypeScript, stated in
-- `20260827106000_subscription_state`: the past_due grace period needs a
-- CLOCK, and a clock has no place in a stored generated column. True — of a
-- COLUMN. `subscriptions.active` stays exactly what it is (Stripe liveness,
-- never the gate). A FUNCTION may read `now()`, and every other gate in this
-- schema already does.
--
-- ── WHY IT HAS TO MOVE NOW ───────────────────────────────────────────────
--
-- Because the content pipeline is about to spend money. `canUseMonthlyPresence`
-- in TypeScript is a fine answer to "what should this screen show"; it is not
-- a place to decide whether a paid API call may happen, because nothing stops
-- the next caller from not asking. Every credit reservation in
-- `20260920140100` goes through this function, in the database, and a caller
-- that forgets gets no credit rather than a free one.
--
-- ── THE TWO-FUNCTION SHAPE, AND WHY IT IS NOT ONE ────────────────────────
--
-- The same shape `comp_grant_active` / `comp_access_active` already uses, for
-- the same reason. A function that takes an arbitrary `p_user` and answers a
-- question about their money must NEVER be callable by a signed-in client:
-- that is a subscription-status probe on any account whose uuid you can guess.
-- So:
--
--   check_monthly_presence_entitlement(uuid)  arbitrary user, service_role only
--   monthly_presence_entitled()               auth.uid()-scoped, authenticated
--
-- The second is defined FROM the first, so the rule is written once.
--
-- ⚠ NULL-SAFETY. Every branch below answers true or false and never NULL:
--   * `exists` never returns NULL;
--   * `comp_grant_active` is `<integer> is not null`, which never returns NULL;
--   * `p_user is not null and (...)` short-circuits before either.
-- The past_due arm never compares NULL to the clock: `current_period_end is
-- not null` is tested before the addition, never as `not (… <= now())`, which
-- a NULL would make TRUE. That is the same trap `comp_grants` names in its own
-- table comment, and it is the one that leaks a permissive default.
-- ============================================================================


-- ============================================================================
-- 1. monthly_presence_past_due_grace — three days, written once
-- ============================================================================
-- It was `PAST_DUE_GRACE_DAYS = 3` in `lib/billing/entitlements.ts`, and that
-- file keeps it as a constant it EXPORTS for copy and for tests — but it is no
-- longer the constant anything DECIDES with. A function rather than a literal
-- inside the gate below, so that changing the commercial choice is a migration
-- with a diff rather than an edit inside a WHERE clause.
--
-- It exists for a card that was refused this morning: Stripe retries, and three
-- days is almost always enough. It is not a grace on cancellation.

create or replace function public.monthly_presence_past_due_grace()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '3 days'
$$;

comment on function public.monthly_presence_past_due_grace() is
  'How long a past_due subscription keeps Monthly Presence while Stripe retries the card. THE one place the three days are written. A commercial choice, so it is a function with a diff rather than a literal buried in a predicate.';

revoke all on function public.monthly_presence_past_due_grace() from public;
grant execute on function public.monthly_presence_past_due_grace() to authenticated, service_role;


-- ============================================================================
-- 2. check_monthly_presence_entitlement — THE gate, arbitrary user, internal
-- ============================================================================
-- The exact sentence `isEntitledToMonthlyPresence` was computing, plus the comp
-- clause it could never reach:
--
--   status ∈ {active, trialing}
--   OR (status = 'past_due' AND current_period_end + grace > now())
--   OR an active comp grant
--
-- ⚠ `comp_grant_active` IS NOT GRANTED TO ANYONE, and must not become so. It
-- is reachable here because a SECURITY DEFINER body runs with the owner's
-- privileges for the duration of the call — the same way `brand_kit_entitled`
-- reaches it. Adding a GRANT to make this "work" would open a comp-status
-- probe on every account, which its own migration's guard rail refuses.

create or replace function public.check_monthly_presence_entitlement(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null
     and (
       exists (
         select 1
           from public.subscriptions s
          where s.user_id = p_user
            and (
              s.status in ('active', 'trialing')
              or (
                s.status = 'past_due'
                -- A past_due with no known period end opens nothing: we do not
                -- invent a grace date we were never given.
                and s.current_period_end is not null
                and s.current_period_end + public.monthly_presence_past_due_grace() > now()
              )
            )
       )
       or public.comp_grant_active(p_user)
     )
$$;

comment on function public.check_monthly_presence_entitlement(uuid) is
  'THE definition of "this user may use Monthly Presence": an active or trialing subscription, or a past_due one still inside the retry grace, or an active comp grant. Every credit reservation goes through this. INTERNAL ONLY — it answers about an arbitrary user, so granting it to authenticated would be a subscription-status probe on any uuid. Clients call monthly_presence_entitled() instead. Never returns NULL.';

revoke all on function public.check_monthly_presence_entitlement(uuid) from public, anon, authenticated;
grant execute on function public.check_monthly_presence_entitlement(uuid) to service_role;


-- ============================================================================
-- 3. monthly_presence_entitled — the same sentence, about yourself
-- ============================================================================
-- What `lib/billing/entitlements.ts` calls from a SESSION client. It decides
-- nothing of its own: it is §2 with `auth.uid()` substituted, so there is one
-- rule and not two that agree for now.

create or replace function public.monthly_presence_entitled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.check_monthly_presence_entitlement((select auth.uid()))
$$;

comment on function public.monthly_presence_entitled() is
  'Whether the CALLING user may use Monthly Presence. auth.uid()-scoped, defined from check_monthly_presence_entitlement so the rule is written exactly once. False when there is no caller.';

revoke all on function public.monthly_presence_entitled() from public, anon;
grant execute on function public.monthly_presence_entitled() to authenticated, service_role;


-- ============================================================================
-- Guard rails
-- ============================================================================
do $$
declare
  v_user uuid;
  v_sub  uuid;
begin
  -- ---- NULL answers false, never NULL ------------------------------------
  if public.check_monthly_presence_entitlement(null) is not false then
    raise exception 'check_monthly_presence_entitlement: a null user did not answer false.';
  end if;
  if public.monthly_presence_entitled() is not false then
    raise exception 'monthly_presence_entitled: no caller did not answer false.';
  end if;

  -- ---- the probe is closed ------------------------------------------------
  if has_function_privilege('anon', 'public.check_monthly_presence_entitlement(uuid)'::regprocedure, 'EXECUTE') then
    raise exception 'anon can execute check_monthly_presence_entitlement.';
  end if;
  if has_function_privilege('authenticated', 'public.check_monthly_presence_entitlement(uuid)'::regprocedure, 'EXECUTE') then
    raise exception 'authenticated can execute check_monthly_presence_entitlement, which is a subscription probe on any uuid.';
  end if;

  -- ---- the self-scoped one is open to signed-in callers, never to anon ----
  if has_function_privilege('anon', 'public.monthly_presence_entitled()'::regprocedure, 'EXECUTE') then
    raise exception 'anon can execute monthly_presence_entitled.';
  end if;
  if not has_function_privilege('authenticated', 'public.monthly_presence_entitled()'::regprocedure, 'EXECUTE') then
    raise exception 'authenticated cannot execute monthly_presence_entitled.';
  end if;

  -- ---- comp_grant_active stayed shut -------------------------------------
  -- Reaching it from a SECURITY DEFINER body must not have required opening it.
  if has_function_privilege('authenticated', 'public.comp_grant_active(uuid)'::regprocedure, 'EXECUTE') then
    raise exception 'comp_grant_active was opened to authenticated; it must stay internal.';
  end if;

  -- ---- the four arms of the sentence, against real rows -------------------
  -- Built and rolled back inside this block: the guard rail must prove the
  -- predicate, not merely assert its privileges.
  -- ⚠ `auth.users` CARRIES A TRIGGER. `handle_new_user` mirrors the row into
  -- `public.profiles`, whose `email` is NOT NULL — so the email goes on the
  -- auth row and the profile is never inserted by hand here.
  v_user := gen_random_uuid();
  insert into auth.users (id, email) values (v_user, 'grace-probe@example.invalid');

  -- no subscription at all
  if public.check_monthly_presence_entitlement(v_user) is not false then
    raise exception 'entitlement: a user with no subscription was entitled.';
  end if;

  insert into public.subscriptions (user_id, stripe_subscription_id, status, current_period_end)
  values (v_user, 'sub_grace_probe', 'active', now() + interval '20 days')
  returning id into v_sub;

  if public.check_monthly_presence_entitlement(v_user) is not true then
    raise exception 'entitlement: an active subscription was not entitled.';
  end if;

  update public.subscriptions set status = 'trialing' where id = v_sub;
  if public.check_monthly_presence_entitlement(v_user) is not true then
    raise exception 'entitlement: a trialing subscription was not entitled.';
  end if;

  -- past_due INSIDE the grace: period ended an hour ago, grace is three days
  update public.subscriptions
     set status = 'past_due', current_period_end = now() - interval '1 hour'
   where id = v_sub;
  if public.check_monthly_presence_entitlement(v_user) is not true then
    raise exception 'entitlement: a past_due subscription inside the grace was refused.';
  end if;

  -- past_due OUTSIDE the grace
  update public.subscriptions
     set current_period_end = now() - interval '4 days'
   where id = v_sub;
  if public.check_monthly_presence_entitlement(v_user) is not false then
    raise exception 'entitlement: a past_due subscription past the grace was entitled.';
  end if;

  -- ⚠ past_due with NO period end. The trap: written as `not (period_end <=
  -- now())` this arm would be TRUE on a NULL and hand out the product.
  update public.subscriptions set current_period_end = null where id = v_sub;
  if public.check_monthly_presence_entitlement(v_user) is not false then
    raise exception 'entitlement: a past_due subscription with no period end was entitled -- the NULL arm leaks.';
  end if;

  -- canceled is canceled
  update public.subscriptions
     set status = 'canceled', current_period_end = now() + interval '20 days'
   where id = v_sub;
  if public.check_monthly_presence_entitlement(v_user) is not false then
    raise exception 'entitlement: a canceled subscription was entitled.';
  end if;

  -- ---- and the comp grant reaches it, which is the whole point ------------
  insert into public.comp_grants (user_id, reason, granted_by, expires_at)
  values (v_user, 'chokepoint guard rail', 'migration 20260920140000', now() + interval '1 day');

  if public.check_monthly_presence_entitlement(v_user) is not true then
    raise exception 'entitlement: an active comp grant did not unlock Monthly Presence -- the gap 20260901182419 reported is still open.';
  end if;

  -- an expired grant grants nothing
  update public.comp_grants set expires_at = now() - interval '1 second' where user_id = v_user;
  if public.check_monthly_presence_entitlement(v_user) is not false then
    raise exception 'entitlement: an EXPIRED comp grant still unlocked Monthly Presence.';
  end if;

  -- a revoked grant grants nothing
  update public.comp_grants
     set expires_at = now() + interval '1 day', revoked_at = now()
   where user_id = v_user;
  if public.check_monthly_presence_entitlement(v_user) is not false then
    raise exception 'entitlement: a REVOKED comp grant still unlocked Monthly Presence.';
  end if;

  delete from public.comp_grants   where user_id = v_user;
  delete from public.subscriptions where user_id = v_user;
  delete from public.profiles      where id      = v_user;
  delete from auth.users           where id      = v_user;
end
$$;


-- ============================================================================
-- DOWN
-- ============================================================================
--   drop function if exists public.monthly_presence_entitled();
--   drop function if exists public.check_monthly_presence_entitlement(uuid);
--   drop function if exists public.monthly_presence_past_due_grace();
--   -- and lib/billing/entitlements.ts goes back to deciding it in TypeScript.
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260920140000', 'monthly_presence_has_a_chokepoint');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260920140100_credit_ledger_append_only.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — the credit ledger: append-only, and the only door to a paid call
-- ============================================================================
-- Sibling of `content_image_allowance` (`20260910083735` §6), and deliberately
-- NOT a replacement for it. That meter answers "how many cents of photographs
-- has this KIT spent this month"; this ledger answers "how many acts of each
-- KIND has this USER spent this month, and what did they actually cost". Two
-- different grains, two different questions, and merging them would put a
-- per-kit cents budget in charge of a per-user act quota.
--
-- ── ⚠ THE GRAIN, AND WHY IT IS THE USER HERE AND THE KIT THERE ───────────
--
-- Every other Content table is keyed on `brand_kit_id`, and `DIAGNOSTIC.md`
-- §0.5 flagged that the chantier brief wrote `user_id` throughout. The split
-- is not a compromise, it follows the money:
--
--   * Monthly Presence is bought ONCE PER USER. `subscriptions.user_id` is
--     `not null unique` — one subscription per person, never per kit. A
--     regeneration allowance that reset per kit would multiply by the number
--     of kits she owns, and `countUnpaidProjects` lets her have three.
--   * Content is written PER KIT, because a caption belongs to a brand.
--
-- So credits are per user; topics, assets and posts stay per kit. The join
-- between them is `brand_kits → projects.user_id`, which is the same join
-- every Content policy already makes.
--
-- ── ⚠ APPEND-ONLY MEANS SETTLEMENT IS A ROW, NOT AN UPDATE ───────────────
--
-- The brief asks for both "no UPDATE, no DELETE" and "settle_credit writes
-- actual_cost_usd after the call". Those are only compatible one way: an
-- outcome is a NEW ENTRY that names the reservation it closes.
--
--   reservation   delta = -1   estimated_cost_usd set, actual_cost_usd null
--   settlement    delta =  0   actual_cost_usd set, reservation_id set
--   release       delta = +1   the credit comes back, reservation_id set
--
-- The balance is `-sum(delta)` and it is therefore a fact about rows that can
-- never be edited. A reservation that was never settled is visible as a row
-- with no outcome, which is what lets the 15-minute sweeper find it — a state
-- an UPDATE-in-place ledger cannot express at all, because a stuck row and a
-- settled row look the same.
--
-- ⚠ `swap` IS RECORDED WITH `delta = 0`. It is free and unlimited: it only
-- draws from the topic bank and calls no model. It is written down anyway,
-- because "she swapped eleven times this month" is the signal that the bank's
-- scoring is wrong, and a free act that leaves no trace cannot be measured.
--
-- ── NULL-SAFETY ──────────────────────────────────────────────────────────
-- Every CHECK below is written so that NULL fails it, not passes it: a CHECK
-- rejects only on FALSE, so `x > 0` on a NULL x ACCEPTS. Nullable columns are
-- therefore always guarded as `col is null or <predicate>`, and never as a
-- bare predicate. The validators are added to the registry of
-- `20260830061119_null_safe_jsonb_validators` at the bottom of this file.
-- ============================================================================


-- ============================================================================
-- 1. credit_quotas — the defaults, as data rather than as literals
-- ============================================================================
-- "Modifiable SQL constants" as a catalogue table, for the same reason
-- `content_registers` is one: the numbers are needed in TWO places — the
-- trigger that enforces them and the meter the UI draws (PHASE 5.5) — and two
-- hard-coded lists holding the same four numbers is exactly the drift this
-- repo already paid for once with `min_tier`.
--
-- `monthly_limit IS NULL` means UNLIMITED. Not `-1`, not a large number: an
-- unlimited swap is the absence of a ceiling, and writing it as 2147483647
-- would make "unlimited" a number someone could reach.

create table if not exists public.credit_quotas (
  plan          text     not null,
  kind          text     not null,
  monthly_limit integer,
  constraint credit_quotas_pkey primary key (plan, kind),
  constraint credit_quotas_plan_check check (plan in ('standard', 'trial')),
  constraint credit_quotas_kind_check check
    (kind in ('post_generation', 'swap', 'regeneration', 'custom_visual')),
  -- NULL is unlimited and legal; a number must be a count, so zero or more.
  constraint credit_quotas_limit_check check (monthly_limit is null or monthly_limit >= 0)
);

comment on table public.credit_quotas is
  'How many acts of each kind a plan may spend per calendar month. monthly_limit NULL means unlimited -- never a sentinel number, because an unlimited swap is the absence of a ceiling, not a ceiling nobody reaches. Read by the enforcing trigger AND by the credits meter, which is why it is a table and not two copies of four literals.';
comment on column public.credit_quotas.plan is
  'standard for a paid or comped subscriber; trial for one still inside the Stripe trial. Derived by credit_plan_for(uuid), never stored on the user.';

insert into public.credit_quotas (plan, kind, monthly_limit) values
  -- The month itself: thirty posts. This is the count the generation cron
  -- reserves against, one per post, so a rerun of a finished month refuses.
  ('standard', 'post_generation',  30),
  -- ⚠ UNLIMITED, AND THE PRODUCT DEPENDS ON IT. Swap is the one action that
  -- must never make her hesitate: it draws a different topic from the bank
  -- and calls nothing. Metering it would turn "this one isn't me" into a
  -- budget decision.
  ('standard', 'swap',            null),
  ('standard', 'regeneration',     10),
  ('standard', 'custom_visual',     4),
  -- Trial credits are SEPARATE and smaller, and carry NO custom visual: the
  -- paid image path is the only one that spends real money per call, and a
  -- trial that has not charged a card yet does not open it. Zero rather than
  -- an absent row, so the refusal is a quota answer and not a lookup miss.
  ('trial',    'post_generation',   8),
  ('trial',    'swap',             null),
  ('trial',    'regeneration',      3),
  ('trial',    'custom_visual',     0)
on conflict (plan, kind) do update
  set monthly_limit = excluded.monthly_limit;

alter table public.credit_quotas enable row level security;

drop policy if exists "credit_quotas_select_all"    on public.credit_quotas;
drop policy if exists "credit_quotas_insert_denied" on public.credit_quotas;
drop policy if exists "credit_quotas_update_denied" on public.credit_quotas;
drop policy if exists "credit_quotas_delete_denied" on public.credit_quotas;

-- A catalogue: any signed-in caller may read it (the meter lists it), nobody
-- but a migration may write it.
create policy "credit_quotas_select_all" on public.credit_quotas
  for select to authenticated using (true);
create policy "credit_quotas_insert_denied" on public.credit_quotas
  for insert with check (false);
create policy "credit_quotas_update_denied" on public.credit_quotas
  for update using (false);
create policy "credit_quotas_delete_denied" on public.credit_quotas
  for delete using (false);


-- ============================================================================
-- 2. credit_ledger — append-only
-- ============================================================================

create table if not exists public.credit_ledger (
  id                 uuid        not null default gen_random_uuid(),
  user_id            uuid        not null references auth.users (id) on delete cascade,
  kind               text        not null,
  entry_type         text        not null,
  -- Credits taken are NEGATIVE, credits returned POSITIVE, and an entry that
  -- moves nothing is 0. The balance is -sum(delta) over a month.
  delta              integer     not null,
  reason             text        not null,
  ref_type           text,
  ref_id             uuid,
  -- The reservation this entry closes. NULL on a reservation itself.
  reservation_id     uuid        references public.credit_ledger (id) on delete restrict,
  -- ⚠ THE MONTH IS STORED, NOT DERIVED FROM created_at. A reservation taken at
  -- 23:59 on the 31st and settled at 00:01 belongs to the reservation's month,
  -- or the settlement would land in a month that never reserved anything.
  month              date        not null,
  estimated_cost_usd numeric(12, 6),
  actual_cost_usd    numeric(12, 6),
  provider           text,
  model              text,
  created_at         timestamptz not null default now(),

  constraint credit_ledger_pkey primary key (id),
  constraint credit_ledger_kind_check check
    (kind in ('post_generation', 'swap', 'regeneration', 'custom_visual')),
  constraint credit_ledger_entry_type_check check
    (entry_type in ('reservation', 'settlement', 'release')),
  constraint credit_ledger_month_check check (month = date_trunc('month', month)::date),
  constraint credit_ledger_reason_check check (btrim(reason) <> ''),
  -- Nullable, so guarded as `is null or` — a bare `>= 0` would ACCEPT a NULL,
  -- since a CHECK rejects only on FALSE.
  constraint credit_ledger_estimated_check check
    (estimated_cost_usd is null or estimated_cost_usd >= 0),
  constraint credit_ledger_actual_check check
    (actual_cost_usd is null or actual_cost_usd >= 0),
  constraint credit_ledger_provider_check check
    (provider is null or btrim(provider) <> ''),
  constraint credit_ledger_model_check check
    (model is null or btrim(model) <> ''),
  constraint credit_ledger_ref_check check
    ((ref_type is null) = (ref_id is null)),

  -- ── the shape of each entry type, spelled out ──────────────────────────
  -- A reservation opens; it names no reservation and knows no actual cost.
  constraint credit_ledger_reservation_shape_check check (
    entry_type <> 'reservation'
    or (reservation_id is null and actual_cost_usd is null and delta <= 0)
  ),
  -- A settlement closes one and carries the real cost. It moves no credit:
  -- the reservation already took it.
  constraint credit_ledger_settlement_shape_check check (
    entry_type <> 'settlement'
    or (reservation_id is not null and delta = 0)
  ),
  -- A release closes one and gives the credit back. It never has a cost:
  -- nothing was spent.
  constraint credit_ledger_release_shape_check check (
    entry_type <> 'release'
    or (reservation_id is not null and delta >= 0 and actual_cost_usd is null)
  ),
  -- ⚠ A swap moves nothing, whatever the entry type. This is the constraint
  -- that makes "free and unlimited" structural rather than a promise the RPC
  -- keeps: a future writer that tries to charge for a swap is refused by the
  -- row, not by the function it forgot to call.
  constraint credit_ledger_swap_is_free_check check (kind <> 'swap' or delta = 0)
);

comment on table public.credit_ledger is
  'Every act that could cost money, as an append-only journal. UPDATE and DELETE are refused by policy AND by trigger. An outcome is a NEW ROW naming its reservation (settlement or release), never an edit -- which is also what makes a stuck reservation visible to the 15-minute sweeper, since an edited-in-place ledger cannot tell a stuck row from a settled one.';
comment on column public.credit_ledger.delta is
  'Credits taken are negative, returned positive, and 0 moves nothing. A swap is always 0: it draws a different topic from the bank and calls no model.';
comment on column public.credit_ledger.month is
  'The calendar month this entry is counted in. STORED, not derived from created_at: a settlement at 00:01 on the 1st closes a reservation taken at 23:59 on the 31st, and both belong to the reservation''s month.';
comment on column public.credit_ledger.actual_cost_usd is
  'What the call really cost, written by settle_credit ON A NEW ROW. NULL on a reservation (not yet known) and on a release (nothing was spent).';

-- ⚠ ONE OUTCOME PER RESERVATION, EVER. Without this, a retried settle_credit
-- writes a second settlement, and a reservation that was released and then
-- settled would return a credit AND spend it.
create unique index if not exists credit_ledger_one_outcome_per_reservation
  on public.credit_ledger (reservation_id)
  where entry_type in ('settlement', 'release');

create index if not exists credit_ledger_user_month_idx
  on public.credit_ledger (user_id, month desc, kind);

-- The sweeper's index: open reservations, oldest first. Partial, because a
-- settled reservation is never swept and there are far more of those.
create index if not exists credit_ledger_open_reservations_idx
  on public.credit_ledger (created_at)
  where entry_type = 'reservation';


-- ============================================================================
-- 3. credit_balances — derived, and written ONLY by the trigger in §5
-- ============================================================================
-- A TABLE, not a materialized view. A materialized view is refreshed by
-- `REFRESH MATERIALIZED VIEW`, which takes a lock over the whole relation and
-- cannot run inside a row trigger without serialising every reservation in the
-- product behind one another.

create table if not exists public.credit_balances (
  user_id            uuid        not null references auth.users (id) on delete cascade,
  kind               text        not null,
  month              date        not null,
  -- -sum(delta): how many credits of this kind this month has actually taken.
  consumed           integer     not null default 0,
  reservations       integer     not null default 0,
  settlements        integer     not null default 0,
  releases           integer     not null default 0,
  estimated_cost_usd numeric(14, 6) not null default 0,
  actual_cost_usd    numeric(14, 6) not null default 0,
  updated_at         timestamptz not null default now(),

  constraint credit_balances_pkey primary key (user_id, kind, month),
  constraint credit_balances_kind_check check
    (kind in ('post_generation', 'swap', 'regeneration', 'custom_visual')),
  constraint credit_balances_month_check check (month = date_trunc('month', month)::date),
  constraint credit_balances_consumed_check     check (consumed >= 0),
  constraint credit_balances_reservations_check check (reservations >= 0),
  constraint credit_balances_settlements_check  check (settlements >= 0),
  constraint credit_balances_releases_check     check (releases >= 0),
  constraint credit_balances_estimated_check    check (estimated_cost_usd >= 0),
  constraint credit_balances_actual_check       check (actual_cost_usd >= 0),
  -- A reservation is closed at most once (§2's unique index), so outcomes can
  -- never outnumber reservations. This is the row-level echo of that index.
  constraint credit_balances_outcomes_check
    check (settlements + releases <= reservations)
);

comment on table public.credit_balances is
  'The running total of credit_ledger, per (user, kind, month). Written ONLY by credit_ledger_apply() -- never by hand, never by an RPC. A table rather than a materialized view because REFRESH takes a relation-wide lock and would serialise every reservation in the product.';
comment on column public.credit_balances.consumed is
  'Credits actually taken this month: -sum(delta). A reservation raises it, a release lowers it again, a settlement leaves it alone.';

create index if not exists credit_balances_user_month_idx
  on public.credit_balances (user_id, month desc);


-- ============================================================================
-- 4. The plan a user is on, and the ceiling that follows
-- ============================================================================
-- ⚠ DERIVED, NEVER STORED. A `plan` column on the user would be a second
-- source for a fact Stripe already owns, and the two would disagree the first
-- time a trial converted without the column being written.

create or replace function public.credit_plan_for(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    -- A comp grant is the full paid product, so it is never on trial credits.
    when public.comp_grant_active(p_user) then 'standard'
    when exists (
      select 1 from public.subscriptions s
       where s.user_id = p_user and s.status = 'trialing'
    ) then 'trial'
    else 'standard'
  end
$$;

comment on function public.credit_plan_for(uuid) is
  'Which row of credit_quotas applies to this user: trial while the Stripe subscription is trialing, standard otherwise -- and standard for a comp grant, which is the full paid product. Derived, never stored: a plan column would be a second source for a fact Stripe owns. INTERNAL ONLY.';

revoke all on function public.credit_plan_for(uuid) from public, anon, authenticated;

create or replace function public.credit_monthly_limit(p_user uuid, p_kind text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select q.monthly_limit
    from public.credit_quotas q
   where q.plan = public.credit_plan_for(p_user)
     and q.kind = p_kind
$$;

comment on function public.credit_monthly_limit(uuid, text) is
  'This user''s monthly ceiling for this kind, or NULL for unlimited. ⚠ NULL IS AMBIGUOUS HERE ON PURPOSE AND THE CALLER MUST NOT GUESS: it also comes back when the (plan, kind) pair has no row at all. credit_ledger_apply() treats an absent pair as a REFUSAL by checking the row''s existence separately -- fail closed, never "no row means no ceiling". INTERNAL ONLY.';

revoke all on function public.credit_monthly_limit(uuid, text) from public, anon, authenticated;


-- ============================================================================
-- 5. credit_ledger_apply — the balance, and the ceiling, in one atomic act
-- ============================================================================
-- ⚠ VERIFY-THEN-CONSUME IN ONE STATEMENT, the same rule `reserve_content_image`
-- follows and for the same reason: there is still no post-purchase refund
-- primitive in this product, so a check followed by an increment can be raced
-- into an overspend that nothing can undo.
--
-- The UPDATE below is the check and the increment as a single act. It takes
-- the row lock, so a concurrent caller that was waiting re-evaluates the WHERE
-- against the row as the winner left it; when the WHERE fails, no row is
-- written, `row_count` is 0, and the exception rolls the ledger insert back
-- with it. Two simultaneous reservations cannot both pass the ceiling.
--
-- ── ⚠ WHY THIS IS NOT `insert … on conflict do update`, WHICH IT WAS ─────
--
-- Because PostgreSQL evaluates the proposed INSERT tuple's CHECK constraints
-- BEFORE it consults the arbiter index. The first draft here upserted, and the
-- guard rail below caught it on the very first settlement: the proposed tuple
-- for a settlement is `(reservations 0, settlements 1)`, which
-- `credit_balances_outcomes_check` refuses — and it was refused even though
-- that tuple was never going to be inserted, the row already existing.
--
-- The lesson is worth keeping: an upsert whose INSERT branch is unreachable
-- still has to be a LEGAL row. Rather than weaken the invariant to make an
-- impossible tuple legal, the row is created empty first and the deltas are
-- applied by the UPDATE — which is the only statement that ever moves a
-- number, and therefore the only one the ceiling has to guard.
--
-- The loop handles the one race that leaves: two transactions both finding no
-- row. One wins the primary key, the other catches `unique_violation`, loops,
-- and takes the UPDATE path — where the WHERE guards it like everyone else.

create or replace function public.credit_ledger_apply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit    integer;
  v_has_row  boolean;
  v_take     integer := -new.delta;   -- credits this entry takes (negative = gives back)
  v_written  boolean := false;
begin
  if new.entry_type = 'reservation' then
    select true, q.monthly_limit
      into v_has_row, v_limit
      from public.credit_quotas q
     where q.plan = public.credit_plan_for(new.user_id)
       and q.kind = new.kind;

    -- ⚠ FAIL CLOSED ON A MISSING PAIR. `credit_monthly_limit` returns NULL
    -- both for "unlimited" and for "no such row", and reading the second as
    -- the first would make a typo'd kind free and infinite.
    if not coalesce(v_has_row, false) then
      -- ⚠ EK011, NOT `check_violation`. See the header on the two codes.
      raise exception 'credit_ledger: no quota row for kind % on this user''s plan', new.kind
        using errcode = 'EK011';
    end if;
  end if;

  loop
    update public.credit_balances b
       set consumed           = b.consumed + v_take,
           reservations       = b.reservations
                                + case when new.entry_type = 'reservation' then 1 else 0 end,
           settlements        = b.settlements
                                + case when new.entry_type = 'settlement'  then 1 else 0 end,
           releases           = b.releases
                                + case when new.entry_type = 'release'     then 1 else 0 end,
           estimated_cost_usd = b.estimated_cost_usd + coalesce(new.estimated_cost_usd, 0),
           actual_cost_usd    = b.actual_cost_usd    + coalesce(new.actual_cost_usd, 0),
           updated_at         = now()
     where b.user_id = new.user_id
       and b.kind    = new.kind
       and b.month   = new.month
       -- THE CEILING, in the same statement that moves the number.
       and (v_limit is null
            or new.entry_type <> 'reservation'
            or b.consumed + v_take <= v_limit);

    get diagnostics v_written = row_count;
    exit when v_written;

    -- Nothing moved. Either the row exists and the ceiling refused it, or this
    -- is the month's first entry and there is no row yet. Those are different
    -- answers and only one of them is a refusal.
    if exists (
      select 1 from public.credit_balances b
       where b.user_id = new.user_id and b.kind = new.kind and b.month = new.month
    ) then
      raise exception 'credit_ledger: the monthly limit of % for % is exhausted',
        v_limit, new.kind
        using errcode = 'EK010';
    end if;

    begin
      insert into public.credit_balances (user_id, kind, month)
      values (new.user_id, new.kind, new.month);
    exception when unique_violation then
      -- Another transaction created it between our UPDATE and our INSERT.
      -- Loop: the UPDATE path guards it exactly as it guards everyone else.
      null;
    end;
  end loop;

  return null;   -- AFTER trigger; the return value is ignored
end
$$;

comment on function public.credit_ledger_apply() is
  'Maintains credit_balances from credit_ledger, and enforces the monthly ceiling in the SAME statement that increments the total. THE only writer of credit_balances. Refuses on a missing quota row rather than treating it as unlimited.';

-- ⚠ REVOKE, LIKE EVERY OTHER TRIGGER FUNCTION IN THIS SCHEMA. A function is
-- created with EXECUTE granted to `public` by default, and this repo also
-- grants to `anon` by DEFAULT PRIVILEGES. Left alone, a trigger function is
-- callable straight from the browser — and this one takes a trigger record, so
-- the call would merely fail, but `20260902090000_revoke_internal_function_surface`
-- made "no trigger function is reachable from a client" a rule with a test
-- behind it rather than a case-by-case judgement. That test is what caught
-- this file's first draft.
revoke all on function public.credit_ledger_apply() from public, anon, authenticated;

drop trigger if exists credit_ledger_apply on public.credit_ledger;
create trigger credit_ledger_apply
  after insert on public.credit_ledger
  for each row execute function public.credit_ledger_apply();


-- ============================================================================
-- 6. Append-only, enforced twice
-- ============================================================================
-- The policies below already refuse UPDATE and DELETE to every client. The
-- trigger refuses them to EVERYONE, service_role included — and service_role
-- bypasses RLS entirely, so without it the one role the pipeline actually runs
-- as would be the one role that could rewrite the journal.

-- ⚠ AND IT MUST STILL LET THE USER BE DELETED. The first version of this
-- trigger refused every DELETE, full stop — and the guard rail below caught
-- what that meant: `credit_ledger.user_id` is `on delete cascade`, so refusing
-- every DELETE made `delete from auth.users` FAIL. An append-only journal that
-- makes an account undeletable is not a journal, it is a hostage.
--
-- An `ON DELETE CASCADE` runs as an AFTER trigger on the PARENT, so by the
-- time the child row is being deleted the user row is already gone. That is
-- the difference, and it is checkable: the user still exists → somebody is
-- editing history; the user is gone → this is the cascade, let it through.
create or replace function public.credit_ledger_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from auth.users u where u.id = old.user_id) then
    return old;
  end if;

  raise exception 'credit_ledger is append-only: % is refused. Correct an entry by appending another.',
    tg_op
    using errcode = 'restrict_violation';
end
$$;

comment on function public.credit_ledger_is_append_only() is
  'Refuses UPDATE and DELETE on credit_ledger for EVERY role, service_role included -- the policies alone would not, since service_role bypasses RLS and is the role the pipeline runs as. The ONE delete it allows is the FK cascade from a deleted auth.users row, told apart by the parent already being gone; without that exception an account could never be deleted.';

revoke all on function public.credit_ledger_is_append_only() from public, anon, authenticated;

drop trigger if exists credit_ledger_no_update on public.credit_ledger;
create trigger credit_ledger_no_update
  before update on public.credit_ledger
  for each row execute function public.credit_ledger_is_append_only();

drop trigger if exists credit_ledger_no_delete on public.credit_ledger;
create trigger credit_ledger_no_delete
  before delete on public.credit_ledger
  for each row execute function public.credit_ledger_is_append_only();


-- ============================================================================
-- 7. RLS
-- ============================================================================
alter table public.credit_ledger   enable row level security;
alter table public.credit_balances enable row level security;

drop policy if exists "credit_ledger_select_own"    on public.credit_ledger;
drop policy if exists "credit_ledger_insert_denied" on public.credit_ledger;
drop policy if exists "credit_ledger_update_denied" on public.credit_ledger;
drop policy if exists "credit_ledger_delete_denied" on public.credit_ledger;

-- ⚠ `user_id = (select auth.uid())` AND NEVER `<>` ANYWHERE. With no caller,
-- auth.uid() is NULL, the comparison is NULL, and a policy that is not TRUE
-- refuses. Written as a negation it would have been TRUE and shown the journal
-- to an anonymous reader.
create policy "credit_ledger_select_own" on public.credit_ledger
  for select using (user_id = (select auth.uid()));
create policy "credit_ledger_insert_denied" on public.credit_ledger
  for insert with check (false);
create policy "credit_ledger_update_denied" on public.credit_ledger
  for update using (false);
create policy "credit_ledger_delete_denied" on public.credit_ledger
  for delete using (false);

drop policy if exists "credit_balances_select_own"    on public.credit_balances;
drop policy if exists "credit_balances_insert_denied" on public.credit_balances;
drop policy if exists "credit_balances_update_denied" on public.credit_balances;
drop policy if exists "credit_balances_delete_denied" on public.credit_balances;

create policy "credit_balances_select_own" on public.credit_balances
  for select using (user_id = (select auth.uid()));
create policy "credit_balances_insert_denied" on public.credit_balances
  for insert with check (false);
create policy "credit_balances_update_denied" on public.credit_balances
  for update using (false);
create policy "credit_balances_delete_denied" on public.credit_balances
  for delete using (false);


-- ============================================================================
-- 8. reserve_credit — the ONLY door, and it is the entitlement chokepoint
-- ============================================================================
-- ⚠ NOTHING IN THIS PRODUCT MAY CALL A PAID API WITHOUT PASSING HERE FIRST.
-- The entitlement test is the first statement in the body, not a precondition
-- the caller is trusted to have checked, because a caller that forgets a
-- precondition gets a free call and nothing notices.

create or replace function public.reserve_credit(
  p_user               uuid,
  p_kind               text,
  p_reason             text,
  p_ref_type           text    default null,
  p_ref_id             uuid    default null,
  p_estimated_cost_usd numeric default null,
  p_provider           text    default null,
  p_model              text    default null,
  p_month              date    default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', coalesce(p_month, now()))::date;
  v_id    uuid;
  v_delta integer;
begin
  if p_user is null then
    return jsonb_build_object('ok', false, 'reason', 'no_user');
  end if;

  if p_kind is null
     or p_kind not in ('post_generation', 'swap', 'regeneration', 'custom_visual') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_kind');
  end if;

  -- ⚠ THE CHOKEPOINT. Comp grants are already inside it.
  if not public.check_monthly_presence_entitlement(p_user) then
    return jsonb_build_object('ok', false, 'reason', 'not_entitled');
  end if;

  if p_estimated_cost_usd is not null and p_estimated_cost_usd < 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_cost');
  end if;

  -- A swap takes nothing; everything else takes one credit.
  v_delta := case when p_kind = 'swap' then 0 else -1 end;

  begin
    insert into public.credit_ledger
      (user_id, kind, entry_type, delta, reason, ref_type, ref_id, month,
       estimated_cost_usd, provider, model)
    values
      (p_user, p_kind, 'reservation', v_delta, coalesce(nullif(btrim(p_reason), ''), p_kind),
       p_ref_type, p_ref_id, v_month,
       case when p_kind = 'swap' then null else p_estimated_cost_usd end,
       p_provider, p_model)
    returning id into v_id;
  exception
    -- ⚠ ONLY THE TWO CODES credit_ledger_apply() RAISES, NEVER
    -- `check_violation` WHOLESALE. The first version caught check_violation,
    -- and the guard rail below caught it doing so: a malformed call (a
    -- ref_type with no ref_id, which the row's own CHECK refuses) came back to
    -- the caller as `quota_exhausted`. That is a lie about her account, and it
    -- would have sent someone to a checkout page to buy credits she already
    -- had. A shape violation is a programming error and must keep crossing
    -- the boundary as one.
    when sqlstate 'EK010' then
      return jsonb_build_object('ok', false, 'reason', 'quota_exhausted',
                                'kind', p_kind, 'month', v_month);
    when sqlstate 'EK011' then
      return jsonb_build_object('ok', false, 'reason', 'no_quota_configured',
                                'kind', p_kind);
  end;

  return jsonb_build_object('ok', true, 'reason', 'reserved',
                            'reservation_id', v_id, 'month', v_month);
end
$$;

comment on function public.reserve_credit(uuid, text, text, text, uuid, numeric, text, text, date) is
  'Reserves one credit BEFORE a paid call, or refuses having spent nothing. THE chokepoint: it calls check_monthly_presence_entitlement itself rather than trusting the caller to have done it. Returns {ok, reason, reservation_id, month}. A swap reserves with delta 0 -- recorded, free, and never counted against a ceiling.';

revoke all on function public.reserve_credit(uuid, text, text, text, uuid, numeric, text, text, date)
  from public, anon, authenticated;
grant execute on function public.reserve_credit(uuid, text, text, text, uuid, numeric, text, text, date)
  to service_role;


-- ============================================================================
-- 9. settle_credit — the outcome, as a new row
-- ============================================================================
-- Called AFTER the API call, with what it really cost. On failure it releases
-- instead: the credit comes back, and no cost is recorded, because nothing was
-- spent.

create or replace function public.settle_credit(
  p_reservation_id  uuid,
  p_actual_cost_usd numeric default null,
  p_succeeded       boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r           public.credit_ledger%rowtype;
  v_succeeded boolean := coalesce(p_succeeded, false);
  v_id        uuid;
begin
  if p_reservation_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_reservation');
  end if;

  -- ⚠ `for update` ON THE RESERVATION, not on the balance. Two concurrent
  -- settlements of the same reservation serialise here; the second then sees
  -- the outcome the first wrote and returns `already_settled` rather than
  -- colliding on the unique index and raising.
  select * into r
    from public.credit_ledger
   where id = p_reservation_id and entry_type = 'reservation'
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_such_reservation');
  end if;

  if exists (
    select 1 from public.credit_ledger o
     where o.reservation_id = r.id
       and o.entry_type in ('settlement', 'release')
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_settled');
  end if;

  if p_actual_cost_usd is not null and p_actual_cost_usd < 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_cost');
  end if;

  insert into public.credit_ledger
    (user_id, kind, entry_type, delta, reason, ref_type, ref_id, reservation_id,
     month, actual_cost_usd, provider, model)
  values (
    r.user_id, r.kind,
    case when v_succeeded then 'settlement' else 'release' end,
    -- A settlement moves nothing: the reservation already took the credit.
    -- A release gives back exactly what it took.
    case when v_succeeded then 0 else -r.delta end,
    case when v_succeeded then 'settled: ' else 'released: ' end || r.reason,
    r.ref_type, r.ref_id, r.id,
    -- ⚠ THE RESERVATION'S MONTH, not today's. See the column comment.
    r.month,
    case when v_succeeded then p_actual_cost_usd else null end,
    r.provider, r.model
  )
  returning id into v_id;

  return jsonb_build_object('ok', true,
                            'reason', case when v_succeeded then 'settled' else 'released' end,
                            'entry_id', v_id);
end
$$;

comment on function public.settle_credit(uuid, numeric, boolean) is
  'Closes a reservation by APPENDING its outcome: a settlement carrying the real cost, or a release giving the credit back. Never an UPDATE -- the ledger refuses those. Idempotent by refusal: a second call answers already_settled rather than writing a second outcome.';

revoke all on function public.settle_credit(uuid, numeric, boolean) from public, anon, authenticated;
grant execute on function public.settle_credit(uuid, numeric, boolean) to service_role;


-- ============================================================================
-- 10. release_stale_credit_reservations — the fifteen-minute sweeper
-- ============================================================================
-- A reservation whose call never came back holds a credit forever. Fifteen
-- minutes is longer than any call this product makes, including a Batch poll.
--
-- ⚠ IT RELEASES, IT NEVER DELETES. The stuck reservation stays in the journal,
-- and the release names it. "This one hung" is a fact worth keeping.

create or replace function public.release_stale_credit_reservations(
  p_older_than interval default interval '15 minutes'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r       record;
  v_count integer := 0;
begin
  for r in
    select l.*
      from public.credit_ledger l
     where l.entry_type = 'reservation'
       -- ⚠ ONLY RESERVATIONS THAT HOLD A CREDIT. A swap reserves with delta 0
       -- and has nothing to give back; sweeping it would write a release per
       -- swap per user per month -- fifty rows of noise saying nothing moved.
       -- "Open" is only a meaningful state for an entry that took something.
       and l.delta < 0
       and l.created_at < now() - coalesce(p_older_than, interval '15 minutes')
       and not exists (
         select 1 from public.credit_ledger o
          where o.reservation_id = l.id
            and o.entry_type in ('settlement', 'release')
       )
     order by l.created_at
     for update of l skip locked
  loop
    insert into public.credit_ledger
      (user_id, kind, entry_type, delta, reason, ref_type, ref_id, reservation_id, month,
       provider, model)
    values
      (r.user_id, r.kind, 'release', -r.delta,
       'released after ' || coalesce(p_older_than, interval '15 minutes')::text || ': ' || r.reason,
       r.ref_type, r.ref_id, r.id, r.month, r.provider, r.model);
    v_count := v_count + 1;
  end loop;

  return v_count;
end
$$;

comment on function public.release_stale_credit_reservations(interval) is
  'Gives back every credit held by a reservation older than p_older_than (default 15 minutes) with no outcome. Only entries with delta < 0 -- a swap holds nothing and has nothing to release. Appends a release naming the stuck reservation; never deletes it. `skip locked` so a sweep and a late settle_credit cannot fight over the same row. Compares against now(), the transaction clock, so rows written during a pass are never its own candidates.';

revoke all on function public.release_stale_credit_reservations(interval)
  from public, anon, authenticated;
grant execute on function public.release_stale_credit_reservations(interval) to service_role;


-- ============================================================================
-- 11. credit_meter — what the UI may read about ITSELF
-- ============================================================================
-- auth.uid()-scoped, and it is the only credit function a signed-in client may
-- call. PHASE 5.5 draws it: swaps unlimited, regenerations and custom visuals
-- finite. `limit` NULL means unlimited and the UI must print a word, not a
-- number.

create or replace function public.credit_meter(p_month date default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(
      q.kind,
      jsonb_build_object(
        'limit',    q.monthly_limit,
        'consumed', coalesce(b.consumed, 0),
        'remaining', case
                       when q.monthly_limit is null then null
                       else greatest(q.monthly_limit - coalesce(b.consumed, 0), 0)
                     end
      )
    ),
    '{}'::jsonb
  )
    from public.credit_quotas q
    left join public.credit_balances b
      on b.user_id = (select auth.uid())
     and b.kind    = q.kind
     and b.month   = date_trunc('month', coalesce(p_month, now()))::date
   where (select auth.uid()) is not null
     and q.plan = public.credit_plan_for((select auth.uid()))
$$;

comment on function public.credit_meter(date) is
  'The calling user''s credits for a month, as {kind: {limit, consumed, remaining}}. A NULL limit means unlimited and remaining is NULL with it -- the UI prints a word there, never a number. auth.uid()-scoped; answers {} with no caller.';

revoke all on function public.credit_meter(date) from public, anon;
grant execute on function public.credit_meter(date) to authenticated, service_role;


-- ============================================================================
-- Guard rails
-- ============================================================================
do $$
declare
  v_user uuid;
  v_res  jsonb;
  v_res2 jsonb;
  v_id   uuid;
  v_n    integer;
  t      text;
  fn     text;
begin
  -- ---- RLS is on, and nothing is client-writable -------------------------
  foreach t in array array['credit_ledger', 'credit_balances', 'credit_quotas'] loop
    if not (select relrowsecurity from pg_class
             where oid = ('public.' || t)::regclass) then
      raise exception 'credit ledger: RLS is not enabled on %', t;
    end if;
    if exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = t
         and cmd in ('INSERT', 'UPDATE', 'DELETE')
         and coalesce(qual, with_check) is distinct from 'false'
    ) then
      raise exception 'credit ledger: % has a write policy that is not `false`', t;
    end if;
  end loop;

  -- ---- the spending functions are service_role only ----------------------
  foreach fn in array array[
    'reserve_credit(uuid,text,text,text,uuid,numeric,text,text,date)',
    'settle_credit(uuid,numeric,boolean)',
    'release_stale_credit_reservations(interval)',
    'credit_plan_for(uuid)',
    'credit_monthly_limit(uuid,text)'
  ] loop
    if has_function_privilege('anon', ('public.' || fn)::regprocedure, 'EXECUTE') then
      raise exception 'anon can execute %', fn;
    end if;
    if has_function_privilege('authenticated', ('public.' || fn)::regprocedure, 'EXECUTE') then
      raise exception 'authenticated can execute %, which spends or probes another user''s credits', fn;
    end if;
  end loop;

  -- ---- no trigger function is reachable from a client --------------------
  foreach fn in array array['credit_ledger_apply()', 'credit_ledger_is_append_only()'] loop
    foreach t in array array['anon', 'authenticated'] loop
      if has_function_privilege(t, ('public.' || fn)::regprocedure, 'EXECUTE') then
        raise exception '% can execute the trigger function %', t, fn;
      end if;
    end loop;
  end loop;

  -- ---- the meter is the one door a client has ----------------------------
  if has_function_privilege('anon', 'public.credit_meter(date)'::regprocedure, 'EXECUTE') then
    raise exception 'anon can execute credit_meter';
  end if;
  if not has_function_privilege('authenticated', 'public.credit_meter(date)'::regprocedure, 'EXECUTE') then
    raise exception 'authenticated cannot execute credit_meter';
  end if;

  -- ---- every SECURITY DEFINER here has an empty search_path --------------
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.proname in ('credit_ledger_apply', 'credit_plan_for', 'credit_monthly_limit',
                         'reserve_credit', 'settle_credit',
                         'release_stale_credit_reservations', 'credit_meter')
       -- ⚠ THE LITERAL IS `search_path=""`, WITH THE QUOTES. That is how
       -- Postgres stores `set search_path = ''` in proconfig, and the repo
       -- already writes it this way in 20260830060712. Written as
       -- `search_path=` the assertion never matches and always fires.
       and not coalesce(p.proconfig, '{}') @> array['search_path=""']
  ) then
    raise exception 'credit ledger: a SECURITY DEFINER function has no `set search_path = ''''`';
  end if;

  -- ======================================================================
  -- Behaviour, against real rows
  -- ======================================================================
  v_user := gen_random_uuid();
  insert into auth.users (id, email) values (v_user, 'ledger-probe@example.invalid');

  -- ---- no entitlement, no credit -----------------------------------------
  v_res := public.reserve_credit(v_user, 'regeneration', 'probe');
  if v_res ->> 'reason' <> 'not_entitled' then
    raise exception 'reserve_credit: an unentitled user was served (%)', v_res;
  end if;
  if exists (select 1 from public.credit_ledger where user_id = v_user) then
    raise exception 'reserve_credit: a refusal still wrote a ledger entry.';
  end if;

  -- ---- entitle her, by comp grant (no fabricated Stripe row) -------------
  insert into public.comp_grants (user_id, reason, granted_by, expires_at)
  values (v_user, 'ledger guard rail', 'migration 20260920140100', now() + interval '1 day');

  -- ---- a reservation takes exactly one ------------------------------------
  -- ⚠ ref_type AND ref_id TOGETHER. `credit_ledger_ref_check` refuses one
  -- without the other, and an earlier draft of this probe passed the type with
  -- a null id -- which is how the over-broad exception handler in §8 was found.
  v_res := public.reserve_credit(v_user, 'regeneration', 'probe',
                                 'content_item', gen_random_uuid(),
                                 0.004, 'anthropic', 'claude-haiku-4-5-20251001');
  if not (v_res ->> 'ok')::boolean then
    raise exception 'reserve_credit: an entitled user was refused (%)', v_res;
  end if;
  v_id := (v_res ->> 'reservation_id')::uuid;

  select consumed into v_n from public.credit_balances
   where user_id = v_user and kind = 'regeneration'
     and month = date_trunc('month', now())::date;
  if v_n <> 1 then
    raise exception 'credit_balances: consumed is % after one reservation, expected 1', v_n;
  end if;

  -- ---- settling writes a ROW and leaves consumed alone --------------------
  v_res := public.settle_credit(v_id, 0.0031, true);
  if not (v_res ->> 'ok')::boolean then
    raise exception 'settle_credit refused a live reservation (%)', v_res;
  end if;

  select consumed into v_n from public.credit_balances
   where user_id = v_user and kind = 'regeneration'
     and month = date_trunc('month', now())::date;
  if v_n <> 1 then
    raise exception 'credit_balances: settling changed consumed to %, expected 1', v_n;
  end if;
  if (select actual_cost_usd from public.credit_balances
       where user_id = v_user and kind = 'regeneration'
         and month = date_trunc('month', now())::date) <> 0.0031 then
    raise exception 'credit_balances: the real cost was not carried onto the balance.';
  end if;

  -- ---- settling twice is refused, not doubled -----------------------------
  v_res := public.settle_credit(v_id, 9.99, true);
  if (v_res ->> 'reason') <> 'already_settled' then
    raise exception 'settle_credit: a second settlement was accepted (%)', v_res;
  end if;

  -- ---- a release gives the credit back -------------------------------------
  v_res := public.reserve_credit(v_user, 'regeneration', 'probe that fails');
  v_res := public.settle_credit((v_res ->> 'reservation_id')::uuid, null, false);
  if (v_res ->> 'reason') <> 'released' then
    raise exception 'settle_credit(succeeded=false) did not release (%)', v_res;
  end if;
  select consumed into v_n from public.credit_balances
   where user_id = v_user and kind = 'regeneration'
     and month = date_trunc('month', now())::date;
  if v_n <> 1 then
    raise exception 'a release did not give the credit back: consumed is %, expected 1', v_n;
  end if;

  -- ---- the ceiling actually bites -----------------------------------------
  -- 10 regenerations a month on standard; one is already consumed.
  for v_n in 1..9 loop
    v_res := public.reserve_credit(v_user, 'regeneration', 'filling the month');
    if not (v_res ->> 'ok')::boolean then
      raise exception 'reserve_credit refused regeneration #% of 10 (%)', v_n + 1, v_res;
    end if;
  end loop;
  v_res := public.reserve_credit(v_user, 'regeneration', 'the eleventh');
  if (v_res ->> 'reason') <> 'quota_exhausted' then
    raise exception 'reserve_credit: the 11th regeneration of the month was served (%)', v_res;
  end if;
  select consumed into v_n from public.credit_balances
   where user_id = v_user and kind = 'regeneration'
     and month = date_trunc('month', now())::date;
  if v_n <> 10 then
    raise exception 'the refused 11th still moved the balance: consumed is %', v_n;
  end if;

  -- ---- next month starts fresh, structurally ------------------------------
  v_res := public.reserve_credit(v_user, 'regeneration', 'next month',
                                 null, null, null, null, null,
                                 (date_trunc('month', now()) + interval '1 month')::date);
  if not (v_res ->> 'ok')::boolean then
    raise exception 'a new month did not start with a full allowance (%)', v_res;
  end if;

  -- ---- swaps are free and unlimited ---------------------------------------
  for v_n in 1..50 loop
    v_res := public.reserve_credit(v_user, 'swap', 'swapping');
    if not (v_res ->> 'ok')::boolean then
      raise exception 'swap #% was refused (%) -- swaps must be unlimited', v_n, v_res;
    end if;
  end loop;
  select consumed into v_n from public.credit_balances
   where user_id = v_user and kind = 'swap'
     and month = date_trunc('month', now())::date;
  if v_n <> 0 then
    raise exception 'fifty swaps consumed %, expected 0', v_n;
  end if;

  -- ---- a swap that tries to cost money is refused BY THE ROW --------------
  begin
    insert into public.credit_ledger
      (user_id, kind, entry_type, delta, reason, month)
    values (v_user, 'swap', 'reservation', -1, 'a swap that charges',
            date_trunc('month', now())::date);
    raise exception 'a swap with delta -1 was accepted; credit_ledger_swap_is_free_check does not bite.';
  exception when check_violation then null;
  end;

  -- ---- append-only, against service_role's own hand -----------------------
  begin
    update public.credit_ledger set reason = 'rewritten' where user_id = v_user;
    raise exception 'credit_ledger accepted an UPDATE.';
  exception when restrict_violation then null;
  end;
  begin
    delete from public.credit_ledger where user_id = v_user;
    raise exception 'credit_ledger accepted a DELETE.';
  exception when restrict_violation then null;
  end;

  -- ---- the sweeper releases what hung, and nothing else -------------------
  v_res  := public.reserve_credit(v_user, 'custom_visual', 'a call that hangs');
  v_id   := (v_res ->> 'reservation_id')::uuid;
  v_res2 := public.reserve_credit(v_user, 'custom_visual', 'a call that returns');
  v_res2 := public.settle_credit((v_res2 ->> 'reservation_id')::uuid, 0.02, true);

  if public.release_stale_credit_reservations(interval '15 minutes') <> 0 then
    raise exception 'the sweeper released a reservation younger than its window.';
  end if;

  -- ⚠ A NEGATIVE WINDOW, AND `interval '0'` WOULD NOT HAVE WORKED. The sweeper
  -- compares against `now()`, which inside a transaction is the transaction's
  -- start time — the same instant `created_at` defaulted to. So `created_at <
  -- now() - interval '0'` is FALSE for every row written in this block, and a
  -- zero window sweeps nothing. The rows cannot be backdated either: the
  -- ledger refuses UPDATE. So the window is pushed one second into the future
  -- instead, which is the same test from the other side.
  --
  -- `now()` is the right clock for the sweeper itself: a job that swept by
  -- `clock_timestamp()` would treat rows written during its own pass as
  -- candidates.
  v_n := public.release_stale_credit_reservations(interval '-1 second');

  -- The one that hung got its release, and it names the reservation.
  if not exists (
    select 1 from public.credit_ledger
     where reservation_id = v_id and entry_type = 'release'
  ) then
    raise exception 'the sweeper left the hung reservation open.';
  end if;

  -- The one that returned was NOT touched: its settlement still stands alone.
  if (select count(*) from public.credit_ledger
       where user_id = v_user and kind = 'custom_visual' and entry_type = 'release') <> 1 then
    raise exception 'the sweeper released a custom_visual that had already settled.';
  end if;

  select consumed into v_n from public.credit_balances
   where user_id = v_user and kind = 'custom_visual'
     and month = date_trunc('month', now())::date;
  if v_n <> 1 then
    raise exception 'after the sweep custom_visual consumed is %, expected 1 (the settled one only)', v_n;
  end if;

  -- ⚠ AND IT NEVER TOUCHED THE FIFTY SWAPS. They reserve with delta 0, so
  -- they hold nothing and have nothing to release.
  if exists (
    select 1 from public.credit_ledger
     where user_id = v_user and kind = 'swap' and entry_type = 'release'
  ) then
    raise exception 'the sweeper wrote a release for a swap, which holds no credit.';
  end if;

  -- ---- the trial plan carries no custom visual ----------------------------
  update public.comp_grants set revoked_at = now() where user_id = v_user;
  insert into public.subscriptions (user_id, stripe_subscription_id, status, current_period_end)
  values (v_user, 'sub_ledger_probe', 'trialing', now() + interval '14 days');

  if public.credit_plan_for(v_user) <> 'trial' then
    raise exception 'credit_plan_for: a trialing subscription is not on trial credits.';
  end if;
  v_res := public.reserve_credit(v_user, 'custom_visual', 'a trial asking for a paid image');
  if (v_res ->> 'reason') <> 'quota_exhausted' then
    raise exception 'a trial was served a custom visual (%)', v_res;
  end if;

  -- ---- a malformed call is a 500, NOT a fake quota refusal ---------------
  -- The regression this file was written twice for.
  begin
    v_res := public.reserve_credit(v_user, 'regeneration', 'probe', 'content_item', null);
    raise exception 'reserve_credit swallowed a shape violation and answered %', v_res;
  exception when check_violation then null;
  end;

  -- ---- an unknown kind is refused, never treated as unlimited -------------
  v_res := public.reserve_credit(v_user, 'not_a_kind', 'probe');
  if (v_res ->> 'reason') <> 'unknown_kind' then
    raise exception 'reserve_credit accepted an unknown kind (%)', v_res;
  end if;

  -- ---- NULLs answer, they do not crash and they do not grant --------------
  if (public.reserve_credit(null, 'regeneration', 'probe') ->> 'reason') <> 'no_user' then
    raise exception 'reserve_credit(null user) did not refuse.';
  end if;
  if (public.settle_credit(null) ->> 'reason') <> 'no_reservation' then
    raise exception 'settle_credit(null) did not refuse.';
  end if;
  if (public.settle_credit(gen_random_uuid()) ->> 'reason') <> 'no_such_reservation' then
    raise exception 'settle_credit(unknown) did not refuse.';
  end if;

  -- ---- teardown. The ledger refuses DELETE, so the cascade does it. -------
  delete from auth.users where id = v_user;
  if exists (select 1 from public.credit_ledger where user_id = v_user) then
    raise exception 'deleting the user left ledger rows behind.';
  end if;
end
$$;


-- ============================================================================
-- DOWN
-- ============================================================================
--   drop function if exists public.credit_meter(date);
--   drop function if exists public.release_stale_credit_reservations(interval);
--   drop function if exists public.settle_credit(uuid, numeric, boolean);
--   drop function if exists public.reserve_credit(uuid,text,text,text,uuid,numeric,text,text,date);
--   drop function if exists public.credit_monthly_limit(uuid, text);
--   drop function if exists public.credit_plan_for(uuid);
--   drop trigger  if exists credit_ledger_no_delete on public.credit_ledger;
--   drop trigger  if exists credit_ledger_no_update on public.credit_ledger;
--   drop function if exists public.credit_ledger_is_append_only();
--   drop trigger  if exists credit_ledger_apply on public.credit_ledger;
--   drop function if exists public.credit_ledger_apply();
--   drop table    if exists public.credit_balances;
--   drop table    if exists public.credit_ledger;
--   drop table    if exists public.credit_quotas;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260920140100', 'credit_ledger_append_only');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260920150000_content_archetypes.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — les onze archétypes, comme catalogue et non comme CHECK élargi
-- ============================================================================
-- ⚠ POURQUOI PAS `alter constraint content_items_archetype_check`.
--
-- `content_items.archetype` porte cinq valeurs (statement, question, notes,
-- signature, story) et c'est un axe de MISE EN PAGE. `content_items.register`
-- porte six valeurs et c'est un axe de SÛRETÉ ÉDITORIALE. L'en-tête de
-- `20260910083735` raconte pourquoi les deux ont été rendus DISJOINTS par
-- construction, avec un garde-fou qui fait échouer la migration s'ils se
-- recouvrent : « deux vocabulaires qui ne s'accordent que parce que les deux
-- sont actuellement permissifs » avaient déjà produit un défaut avec
-- `min_tier`.
--
-- Les onze du chantier Content ne sont pas un sur-ensemble des cinq : c'est un
-- autre découpage, plus fin, qui porte en plus la FORME DU CONTENU (combien
-- d'items, quelles clefs) et pas seulement la disposition. Élargir le CHECK de
-- cinq à onze referait exactement ce que ce garde-fou refuse, sur l'autre axe.
--
-- Un catalogue, donc, comme `content_registers` — et pour la même raison
-- qu'elle : les onze sont nécessaires à DEUX endroits (le validateur de
-- `content_topics.payload` et le moteur de rendu), et deux listes codées en
-- dur de onze chaînes sont la dérive que ce dépôt a déjà payée une fois.
--
-- ── `carousel` N'EST PAS UNE MISE EN PAGE, ET IL EST QUAND MÊME ICI ──────
--
-- C'est un NOMBRE DE CARTES : un carrousel de quatre cartes est quatre mises
-- en page à la suite. Il est dans le catalogue parce que la résolution de
-- dépassement (PHASE 3.2) y bascule — « réduire l'illustration → réduire les
-- mots → basculer en carrousel » — donc le pipeline doit pouvoir le nommer.
-- Il porte `is_multi_card` pour que rien ne le traite comme une carte simple,
-- et son payload est validé en récursant sur les archétypes de ses cartes.
-- ============================================================================


-- ============================================================================
-- 1. content_words — compter des mots, une seule fois
-- ============================================================================
-- Les budgets du chantier sont en MOTS, pas en caractères : « label de 1 à 3
-- mots », « gloss de 6 mots au plus ». Écrire ce compte à la main dans chaque
-- branche du validateur, c'est onze occasions de le faire différemment.
--
-- ⚠ NULL-SAFE PAR CONSTRUCTION. `array_length` sur un tableau vide rend NULL,
-- pas 0 — et un NULL rendu ici remonterait dans un CHECK qui accepterait
-- silencieusement. Le `coalesce` est le point de ce wrapper autant que le
-- découpage l'est.

create or replace function public.content_words(p text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    array_length(
      regexp_split_to_array(btrim(coalesce(p, '')), '\s+'),
      1
    ),
    0
  ) - case when btrim(coalesce(p, '')) = '' then 1 else 0 end
$$;

comment on function public.content_words(text) is
  'How many words in p. 0 for NULL and for an empty string -- array_length returns NULL on an empty array, and a NULL carried up into a CHECK would have made it accept. Immutable, so usable inside a constraint.';

revoke all on function public.content_words(text) from public;
grant execute on function public.content_words(text) to authenticated, service_role;


-- ============================================================================
-- 2. content_archetypes — les onze, avec ce que le moteur doit savoir
-- ============================================================================
create table if not exists public.content_archetypes (
  id              text     primary key,
  label           text     not null,
  -- La bande dans laquelle le dessin vit. `none` pour un archétype qui n'a
  -- aucune illustration (une déclaration nue), et c'est une valeur, pas une
  -- absence : « pas de dessin » est une décision de composition.
  illustration_zone text   not null,
  -- Combien d'éléments le payload porte. Bornes INCLUSIVES. Un archétype à
  -- élément unique porte 1..1 plutôt qu'un NULL : le validateur lit toujours
  -- deux nombres, jamais deux nombres ou rien.
  items_min       smallint not null,
  items_max       smallint not null,
  is_multi_card   boolean  not null default false,
  sort_order      smallint not null,
  active          boolean  not null default true,

  constraint content_archetypes_label_check check (char_length(label) between 1 and 48),
  constraint content_archetypes_zone_check
    check (illustration_zone in ('none', 'content', 'content_center')),
  constraint content_archetypes_items_check check (items_min >= 0 and items_max >= items_min)
);

comment on table public.content_archetypes is
  'The eleven composition archetypes, as data. SEPARATE from content_items.archetype (five layouts) and content_registers (six editorial shapes): three vocabularies describing three axes, and conflating them is the defect 20260910083735 already defused once between the first two.';
comment on column public.content_archetypes.illustration_zone is
  'Where the drawing lives. `none` = no illustration at all, a decision rather than an absence. `content_center` = an object drawn inside a shape whose labels sit outside it -- the ONLY exception to "a band carries text OR drawing, never both".';
comment on column public.content_archetypes.is_multi_card is
  'True for carousel only. A carousel is not a layout, it is a card count; this flag exists so that nothing treats it as a single card.';

insert into public.content_archetypes
  (id, label, illustration_zone, items_min, items_max, is_multi_card, sort_order) values
  ('single_statement',    'A single statement',      'none',           1, 1, false,  1),
  ('quadrant_model',      'A quadrant model',        'content',        4, 4, false,  2),
  ('cycle',               'A cycle',                 'content',        3, 6, false,  3),
  ('surface_and_beneath', 'Surface and beneath',     'content',        2, 2, false,  4),
  ('comparison_pair',     'A comparison',            'content',        2, 2, false,  5),
  ('numbered_strategies', 'Numbered strategies',     'content',        3, 5, false,  6),
  ('lettered_technique',  'A lettered technique',    'content',        3, 5, false,  7),
  ('concentric_control',  'Concentric control',      'content_center', 2, 4, false,  8),
  ('annotated_curve',     'An annotated curve',      'content',        2, 4, false,  9),
  ('practitioner_card',   'A practitioner card',     'none',           2, 4, false, 10),
  ('carousel',            'A carousel',              'none',           3, 8, true,  11)
on conflict (id) do update
  set label             = excluded.label,
      illustration_zone = excluded.illustration_zone,
      items_min         = excluded.items_min,
      items_max         = excluded.items_max,
      is_multi_card     = excluded.is_multi_card,
      sort_order        = excluded.sort_order;

alter table public.content_archetypes enable row level security;

drop policy if exists "content_archetypes_select_all"    on public.content_archetypes;
drop policy if exists "content_archetypes_insert_denied" on public.content_archetypes;
drop policy if exists "content_archetypes_update_denied" on public.content_archetypes;
drop policy if exists "content_archetypes_delete_denied" on public.content_archetypes;

create policy "content_archetypes_select_all" on public.content_archetypes
  for select to authenticated using (true);
create policy "content_archetypes_insert_denied" on public.content_archetypes
  for insert with check (false);
create policy "content_archetypes_update_denied" on public.content_archetypes
  for update using (false);
create policy "content_archetypes_delete_denied" on public.content_archetypes
  for delete using (false);


-- ============================================================================
-- 3. Les briques du payload — un item, une paire
-- ============================================================================
-- ⚠ CHAQUE VALIDATEUR REND true OU false, JAMAIS NULL. C'est la règle du
-- registre de `20260830061119`, et elle vaut ici plus qu'ailleurs : un CHECK
-- ne rejette que sur FALSE, donc un validateur qui rend NULL sur un payload
-- vide ACCEPTE ce payload. Le garde-fou de fin de fichier rejoue chacun sur
-- `null`, `'{}'`, `'[]'`, `'"x"'` et `42` et exige false.

/**
 * Un item de diagramme : { label (1..3 mots), gloss (≤ 6 mots) }.
 *
 * Les bornes ne sont pas décoratives. Un label de quatre mots ne tient pas
 * dans un quadrant à 1080px sans descendre sous le plancher de 30px que la
 * PHASE 3.2 refuse de franchir ; le refuser ICI est ce qui fait que le moteur
 * n'a jamais à choisir entre une collision et un texte illisible.
 */
create or replace function public.content_item_valid(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is not null
     and jsonb_typeof(p) = 'object'
     and p ?& array['label', 'gloss']
     and jsonb_typeof(p -> 'label') = 'string'
     and jsonb_typeof(p -> 'gloss') = 'string'
     and public.content_words(p ->> 'label') between 1 and 3
     and public.content_words(p ->> 'gloss') between 1 and 6
$$;

comment on function public.content_item_valid(jsonb) is
  'One diagram item: a label of 1 to 3 words, a gloss of at most 6. The bounds are the typographic budget of the composition engine, stated upstream -- refusing here is what spares the engine ever having to choose between a collision and text below the legibility floor. Never NULL.';

/**
 * Un tableau de n items, borné par les deux bornes de l'archétype.
 *
 * ⚠ `jsonb_array_length` SUR AUTRE CHOSE QU'UN TABLEAU LÈVE. L'ordre des
 * conjonctions n'est donc pas libre : le type se teste avant la longueur, et
 * SQL ne garantit pas l'évaluation paresseuse d'un `and` — d'où le `case`.
 */
create or replace function public.content_items_valid(p jsonb, p_min integer, p_max integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p is null then false
    when jsonb_typeof(p) <> 'array' then false
    when jsonb_array_length(p) < p_min then false
    when jsonb_array_length(p) > p_max then false
    else not exists (
      select 1 from jsonb_array_elements(p) e(value)
       where not public.content_item_valid(e.value)
    )
  end
$$;

comment on function public.content_items_valid(jsonb, integer, integer) is
  'An array of content_item_valid, p_min to p_max inclusive. The `case` is not style: jsonb_array_length raises on a non-array, and SQL makes no promise to evaluate an `and` lazily.';

revoke all on function public.content_item_valid(jsonb) from public;
revoke all on function public.content_items_valid(jsonb, integer, integer) from public;
grant execute on function public.content_item_valid(jsonb) to authenticated, service_role;
grant execute on function public.content_items_valid(jsonb, integer, integer) to authenticated, service_role;


-- ============================================================================
-- 4. content_topic_payload_valid — le dispatch, par archétype
-- ============================================================================
-- Un seul point d'entrée, onze branches. C'est lui que le CHECK de
-- `content_topics` appelle, et c'est lui que le pipeline de rédaction appelle
-- avant d'écrire : une sortie de modèle non conforme est rejetée, jamais
-- dégradée en silence.
--
-- ⚠ LE CARROUSEL RÉCURSE, ET IL NE PEUT PAS S'IMBRIQUER. Ses cartes sont des
-- archétypes à part entière, donc la validation d'une carte est cette même
-- fonction — mais `carousel` est exclu des archétypes de carte. Sans cette
-- exclusion la récursion n'aurait pas de fond, et `carousel` n'a de toute
-- façon aucun sens comme carte d'un carrousel.

create or replace function public.content_topic_payload_valid(p_archetype text, p jsonb)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when p_archetype is null or p is null then false
    when jsonb_typeof(p) <> 'object' then false

    -- Une déclaration nue. Le budget de 24 mots est celui qui tient en display
    -- 64-110px sur 1080 de large sans passer en carrousel.
    when p_archetype = 'single_statement' then
      p ? 'statement'
      and jsonb_typeof(p -> 'statement') = 'string'
      and public.content_words(p ->> 'statement') between 3 and 24

    -- Exactement quatre, et les deux axes nommés. Un quadrant à trois cases
    -- n'est pas un quadrant ; à cinq, il n'y a plus de quadrant du tout.
    when p_archetype = 'quadrant_model' then
      p ?& array['axis_x', 'axis_y', 'items']
      and jsonb_typeof(p -> 'axis_x') = 'string'
      and jsonb_typeof(p -> 'axis_y') = 'string'
      and public.content_words(p ->> 'axis_x') between 1 and 3
      and public.content_words(p ->> 'axis_y') between 1 and 3
      and public.content_items_valid(p -> 'items', 4, 4)

    -- Trois nœuds au moins : à deux, c'est un aller-retour, pas un cycle.
    when p_archetype = 'cycle' then
      p ? 'nodes' and public.content_items_valid(p -> 'nodes', 3, 6)

    when p_archetype = 'surface_and_beneath' then
      p ?& array['surface', 'beneath']
      and public.content_item_valid(p -> 'surface')
      and public.content_item_valid(p -> 'beneath')

    -- Deux colonnes, chacune avec son en-tête et ses lignes. Les deux colonnes
    -- portent le MÊME nombre de lignes : une comparaison dont un côté a une
    -- ligne de plus se lit comme un déséquilibre plutôt que comme un contraste.
    when p_archetype = 'comparison_pair' then
      p ?& array['left', 'right']
      and public.content_items_valid(p -> 'left', 2, 4)
      and public.content_items_valid(p -> 'right', 2, 4)
      and jsonb_array_length(p -> 'left') = jsonb_array_length(p -> 'right')

    when p_archetype = 'numbered_strategies' then
      p ? 'items' and public.content_items_valid(p -> 'items', 3, 5)

    -- L'acronyme et ses lettres doivent s'accorder, ET DANS L'ORDRE. Un
    -- « RAIN » dont les items commencent par R, I, A, N est un gabarit qui
    -- ment, et personne ne le verra avant la publication.
    when p_archetype = 'lettered_technique' then
      p ?& array['acronym', 'items']
      and jsonb_typeof(p -> 'acronym') = 'string'
      and char_length(p ->> 'acronym') between 3 and 5
      and public.content_items_valid(p -> 'items', 3, 5)
      and jsonb_array_length(p -> 'items') = char_length(p ->> 'acronym')
      and not exists (
        select 1
          from jsonb_array_elements(p -> 'items') with ordinality as e(value, n)
         where upper(left(e.value ->> 'label', 1))
               <> upper(substr(p ->> 'acronym', e.n::integer, 1))
      )

    -- Du plus extérieur au plus intérieur. L'ordre du tableau EST le dessin.
    when p_archetype = 'concentric_control' then
      p ? 'rings' and public.content_items_valid(p -> 'rings', 2, 4)

    when p_archetype = 'annotated_curve' then
      p ?& array['axis_x', 'axis_y', 'points']
      and jsonb_typeof(p -> 'axis_x') = 'string'
      and jsonb_typeof(p -> 'axis_y') = 'string'
      and public.content_words(p ->> 'axis_x') between 1 and 3
      and public.content_words(p ->> 'axis_y') between 1 and 3
      and public.content_items_valid(p -> 'points', 2, 4)

    -- ⚠ AUCUN TITRE DE PRATIQUE ICI. La carte porte des LIGNES libres et pas
    -- un `credential` : quel titre une praticienne peut imprimer est décidé
    -- par `license_type_states`, État par État, et une seconde source dans un
    -- payload de sujet serait la façon exacte dont « psychologist » finit sur
    -- la carte de quelqu'un qui n'a pas le droit de l'écrire.
    when p_archetype = 'practitioner_card' then
      p ? 'lines'
      and jsonb_typeof(p -> 'lines') = 'array'
      and jsonb_array_length(p -> 'lines') between 2 and 4
      and not exists (
        select 1 from jsonb_array_elements(p -> 'lines') e(value)
         where jsonb_typeof(e.value) <> 'string'
            or public.content_words(e.value #>> '{}') not between 1 and 8
      )

    when p_archetype = 'carousel' then
      p ? 'cards'
      and jsonb_typeof(p -> 'cards') = 'array'
      and jsonb_array_length(p -> 'cards') between 3 and 8
      and not exists (
        select 1 from jsonb_array_elements(p -> 'cards') e(value)
         where jsonb_typeof(e.value) <> 'object'
            or not (e.value ?& array['archetype_key', 'payload'])
            or jsonb_typeof(e.value -> 'archetype_key') <> 'string'
            -- ⚠ LE FOND DE LA RÉCURSION.
            or (e.value ->> 'archetype_key') = 'carousel'
            or not exists (
                 select 1 from public.content_archetypes a
                  where a.id = (e.value ->> 'archetype_key') and a.active
               )
            or not public.content_topic_payload_valid(
                 e.value ->> 'archetype_key', e.value -> 'payload')
      )

    -- ⚠ UN ARCHÉTYPE INCONNU EST UN REFUS, jamais un laissez-passer. Écrit
    -- comme un `else true` ce validateur aurait accepté n'importe quel payload
    -- sous n'importe quelle clef mal orthographiée.
    else false
  end
$$;

comment on function public.content_topic_payload_valid(text, jsonb) is
  'The payload shape, per archetype. ONE entry point, eleven branches, and an unknown archetype REFUSES -- written as `else true` it would have accepted any payload under a misspelled key. `stable` rather than `immutable`: the carousel branch reads content_archetypes. Never NULL.';

revoke all on function public.content_topic_payload_valid(text, jsonb) from public, anon;
grant execute on function public.content_topic_payload_valid(text, jsonb) to authenticated, service_role;


-- ============================================================================
-- Guard rails
-- ============================================================================
do $$
declare
  -- ⚠ `v_arch`, PAS `a`. Les blocs ci-dessous aliasent `content_archetypes a`,
  -- et plpgsql résout `a.id` vers la VARIABLE avant la table : un `record`
  -- nommé `a` fait échouer chaque `exists` avec « tuple structure is
  -- indeterminate », loin de la ligne qui a choisi le nom.
  v_arch record;
  v_n    integer;
  junk   text;
begin
  -- ---- onze archétypes, et le catalogue est bien peuplé ------------------
  select count(*) into v_n from public.content_archetypes;
  if v_n <> 11 then
    raise exception 'content_archetypes: % lignes, attendu 11', v_n;
  end if;
  if (select count(*) from public.content_archetypes where is_multi_card) <> 1 then
    raise exception 'content_archetypes: is_multi_card doit être vrai pour carousel seul.';
  end if;

  -- ---- ⚠ LES TROIS VOCABULAIRES NE SE RECOUVRENT PAS ---------------------
  -- Le même garde-fou que 20260910083735 pose entre archetype et register, et
  -- pour la même raison : le jour où une valeur appartient à deux axes, c'est
  -- l'axe le plus permissif qui gagne. `question` est déjà nommé
  -- `reflective_question` côté register pour éviter la collision évidente ; il
  -- n'y en a aucune autre, et ce bloc refuse la prochaine.
  if exists (
    select 1 from public.content_archetypes a
     where a.id in (select id from public.content_registers)
  ) then
    raise exception 'un archétype de composition porte le nom d''un registre éditorial.';
  end if;
  if exists (
    select 1 from public.content_archetypes a
     where a.id in ('statement', 'question', 'notes', 'signature', 'story')
  ) then
    raise exception 'un archétype de composition porte le nom d''une mise en page content_items.';
  end if;

  -- ---- content_words compte, et ne rend jamais NULL ----------------------
  if public.content_words(null) <> 0 then
    raise exception 'content_words(null) ne rend pas 0.';
  end if;
  if public.content_words('') <> 0 then
    raise exception 'content_words('''') ne rend pas 0.';
  end if;
  if public.content_words('   ') <> 0 then
    raise exception 'content_words(espaces) ne rend pas 0.';
  end if;
  if public.content_words('one') <> 1 then
    raise exception 'content_words(un mot) ne rend pas 1.';
  end if;
  if public.content_words('  three  little   words ') <> 3 then
    raise exception 'content_words: les espaces multiples ne sont pas repliés.';
  end if;

  -- ---- les briques rejettent ce qui n'est pas un item --------------------
  foreach junk in array array['null', '{}', '[]', '"x"', '42', 'true'] loop
    if public.content_item_valid(junk::jsonb) is not false then
      raise exception 'content_item_valid(%) n''a pas rendu false.', junk;
    end if;
    if public.content_items_valid(junk::jsonb, 1, 4) is not false then
      raise exception 'content_items_valid(%) n''a pas rendu false.', junk;
    end if;
  end loop;
  if public.content_item_valid(null) is not false then
    raise exception 'content_item_valid(NULL) n''a pas rendu false.';
  end if;

  -- ---- les budgets de mots mordent --------------------------------------
  if public.content_item_valid('{"label":"a b c d","gloss":"short"}'::jsonb) then
    raise exception 'un label de quatre mots a été accepté.';
  end if;
  if public.content_item_valid('{"label":"","gloss":"short"}'::jsonb) then
    raise exception 'un label vide a été accepté.';
  end if;
  if public.content_item_valid('{"label":"one two","gloss":"a b c d e f g"}'::jsonb) then
    raise exception 'un gloss de sept mots a été accepté.';
  end if;
  if not public.content_item_valid('{"label":"one two","gloss":"a b c d e f"}'::jsonb) then
    raise exception 'un item bien formé a été rejeté.';
  end if;

  -- ---- ⚠ ONZE BRANCHES, ONZE REFUS SUR LE VIDE --------------------------
  -- Anti-vacuité de tout ce qui suit : si une branche rendait NULL, le CHECK
  -- de content_topics accepterait ce payload-là en silence.
  for v_arch in select id from public.content_archetypes loop
    foreach junk in array array['null', '[]', '"x"', '42', '{}'] loop
      if public.content_topic_payload_valid(v_arch.id, junk::jsonb) is not false then
        raise exception 'content_topic_payload_valid(%, %) n''a pas rendu false.', v_arch.id, junk;
      end if;
    end loop;
  end loop;
  if public.content_topic_payload_valid('pas_un_archetype',
       '{"statement":"une phrase parfaitement valide ailleurs"}'::jsonb) is not false then
    raise exception 'un archétype inconnu a laissé passer un payload.';
  end if;
  if public.content_topic_payload_valid(null, '{}'::jsonb) is not false then
    raise exception 'content_topic_payload_valid(NULL, …) n''a pas rendu false.';
  end if;

  -- ---- et chaque branche ACCEPTE sa forme -------------------------------
  if not public.content_topic_payload_valid('single_statement',
       '{"statement":"Rest is not a reward you earn after everything else is done"}'::jsonb) then
    raise exception 'single_statement: une déclaration bien formée a été rejetée.';
  end if;
  if public.content_topic_payload_valid('single_statement', '{"statement":"Too short"}'::jsonb) then
    raise exception 'single_statement: deux mots ont été acceptés.';
  end if;

  if not public.content_topic_payload_valid('quadrant_model', $j$
    {"axis_x":"Effort","axis_y":"Relief","items":[
      {"label":"Push through","gloss":"costly and familiar"},
      {"label":"Step back","gloss":"quiet and unpractised"},
      {"label":"Ask for help","gloss":"hardest of the four"},
      {"label":"Wait it out","gloss":"sometimes the answer"}]}$j$::jsonb) then
    raise exception 'quadrant_model: un quadrant bien formé a été rejeté.';
  end if;
  if public.content_topic_payload_valid('quadrant_model', $j$
    {"axis_x":"Effort","axis_y":"Relief","items":[
      {"label":"One","gloss":"a"},{"label":"Two","gloss":"b"},{"label":"Three","gloss":"c"}]}$j$::jsonb) then
    raise exception 'quadrant_model: trois cases ont été acceptées comme un quadrant.';
  end if;

  if not public.content_topic_payload_valid('cycle', $j$
    {"nodes":[{"label":"Notice","gloss":"the first flicker"},
              {"label":"Name it","gloss":"out loud if possible"},
              {"label":"Let it pass","gloss":"without arguing"}]}$j$::jsonb) then
    raise exception 'cycle: trois nœuds bien formés ont été rejetés.';
  end if;
  if public.content_topic_payload_valid('cycle', $j$
    {"nodes":[{"label":"There","gloss":"and back"},{"label":"Back","gloss":"and there"}]}$j$::jsonb) then
    raise exception 'cycle: deux nœuds ont été acceptés comme un cycle.';
  end if;

  if not public.content_topic_payload_valid('surface_and_beneath', $j$
    {"surface":{"label":"Im fine","gloss":"said quickly"},
     "beneath":{"label":"Im tired","gloss":"said to no one"}}$j$::jsonb) then
    raise exception 'surface_and_beneath: une paire bien formée a été rejetée.';
  end if;

  if not public.content_topic_payload_valid('comparison_pair', $j$
    {"left":[{"label":"Advice","gloss":"tells you what"},{"label":"Fixing","gloss":"ends the feeling"}],
     "right":[{"label":"Witness","gloss":"stays with you"},{"label":"Holding","gloss":"lets it move"}]}$j$::jsonb) then
    raise exception 'comparison_pair: une comparaison équilibrée a été rejetée.';
  end if;
  if public.content_topic_payload_valid('comparison_pair', $j$
    {"left":[{"label":"Advice","gloss":"tells you what"},{"label":"Fixing","gloss":"ends the feeling"}],
     "right":[{"label":"Witness","gloss":"stays with you"}]}$j$::jsonb) then
    raise exception 'comparison_pair: deux colonnes inégales ont été acceptées.';
  end if;

  if not public.content_topic_payload_valid('numbered_strategies', $j$
    {"items":[{"label":"Name it","gloss":"before it grows"},
              {"label":"Slow down","gloss":"one breath longer"},
              {"label":"Ask once","gloss":"then let go"}]}$j$::jsonb) then
    raise exception 'numbered_strategies: trois stratégies ont été rejetées.';
  end if;

  -- ⚠ L'ACRONYME S'ACCORDE, ET DANS L'ORDRE.
  if not public.content_topic_payload_valid('lettered_technique', $j$
    {"acronym":"RAIN","items":[
      {"label":"Recognise","gloss":"what is here"},
      {"label":"Allow","gloss":"it to be here"},
      {"label":"Investigate","gloss":"with kindness"},
      {"label":"Nurture","gloss":"what needs it"}]}$j$::jsonb) then
    raise exception 'lettered_technique: RAIN bien formé a été rejeté.';
  end if;
  if public.content_topic_payload_valid('lettered_technique', $j$
    {"acronym":"RAIN","items":[
      {"label":"Recognise","gloss":"what is here"},
      {"label":"Investigate","gloss":"with kindness"},
      {"label":"Allow","gloss":"it to be here"},
      {"label":"Nurture","gloss":"what needs it"}]}$j$::jsonb) then
    raise exception 'lettered_technique: un RAIN dans le désordre (R,I,A,N) a été accepté.';
  end if;
  if public.content_topic_payload_valid('lettered_technique', $j$
    {"acronym":"RAIN","items":[
      {"label":"Recognise","gloss":"what is here"},
      {"label":"Allow","gloss":"it to be here"},
      {"label":"Investigate","gloss":"with kindness"}]}$j$::jsonb) then
    raise exception 'lettered_technique: trois items pour quatre lettres ont été acceptés.';
  end if;

  if not public.content_topic_payload_valid('concentric_control', $j$
    {"rings":[{"label":"Out there","gloss":"none of it yours"},
              {"label":"Right here","gloss":"some of it yours"}]}$j$::jsonb) then
    raise exception 'concentric_control: deux anneaux ont été rejetés.';
  end if;

  if not public.content_topic_payload_valid('annotated_curve', $j$
    {"axis_x":"Weeks","axis_y":"Steadiness","points":[
      {"label":"Start","gloss":"everything at once"},
      {"label":"Dip","gloss":"the honest middle"},
      {"label":"Steady","gloss":"not the same as fixed"}]}$j$::jsonb) then
    raise exception 'annotated_curve: une courbe bien formée a été rejetée.';
  end if;

  if not public.content_topic_payload_valid('practitioner_card', $j$
    {"lines":["Evenings and early mornings","Telehealth across two states"]}$j$::jsonb) then
    raise exception 'practitioner_card: deux lignes ont été rejetées.';
  end if;
  if public.content_topic_payload_valid('practitioner_card', $j$
    {"lines":["A line that runs on and on and on and on and on and on","Second"]}$j$::jsonb) then
    raise exception 'practitioner_card: une ligne de plus de huit mots a été acceptée.';
  end if;

  -- ---- le carrousel récurse, et ne s'imbrique pas -----------------------
  if not public.content_topic_payload_valid('carousel', $j$
    {"cards":[
      {"archetype_key":"single_statement","payload":{"statement":"The first card says one thing only"}},
      {"archetype_key":"cycle","payload":{"nodes":[
        {"label":"Notice","gloss":"the first flicker"},
        {"label":"Name it","gloss":"out loud if possible"},
        {"label":"Let it pass","gloss":"without arguing"}]}},
      {"archetype_key":"single_statement","payload":{"statement":"And the last one closes the door"}}]}$j$::jsonb) then
    raise exception 'carousel: un carrousel bien formé a été rejeté.';
  end if;
  if public.content_topic_payload_valid('carousel', $j$
    {"cards":[
      {"archetype_key":"single_statement","payload":{"statement":"A card that is perfectly fine"}},
      {"archetype_key":"single_statement","payload":{"statement":"Another card that is fine too"}},
      {"archetype_key":"single_statement","payload":{"statement":"x"}}]}$j$::jsonb) then
    raise exception 'carousel: une carte au payload invalide est passée -- la récursion ne mord pas.';
  end if;
  if public.content_topic_payload_valid('carousel', $j$
    {"cards":[
      {"archetype_key":"single_statement","payload":{"statement":"A card that is perfectly fine"}},
      {"archetype_key":"single_statement","payload":{"statement":"Another card that is fine too"}},
      {"archetype_key":"carousel","payload":{"cards":[]}}]}$j$::jsonb) then
    raise exception 'carousel: un carrousel imbriqué a été accepté.';
  end if;
end
$$;


-- ============================================================================
-- DOWN
-- ============================================================================
--   drop function if exists public.content_topic_payload_valid(text, jsonb);
--   drop function if exists public.content_items_valid(jsonb, integer, integer);
--   drop function if exists public.content_item_valid(jsonb);
--   drop function if exists public.content_words(text);
--   drop table    if exists public.content_archetypes;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260920150000', 'content_archetypes');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260920150100_topic_bank_and_assignment.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — la banque de sujets, et le tirage qui alimente Swap
-- ============================================================================
-- Swap doit être INSTANTANÉ, GRATUIT ET DÉTERMINISTE. Ces trois mots excluent
-- ensemble la seule implémentation évidente — demander un autre sujet à un
-- modèle — et imposent celle-ci : une banque pré-générée, et un tirage qui est
-- une requête.
--
-- ── ⚠ POURQUOI LES SUJETS NE SONT PAS CLEFÉS SUR UN KIT ─────────────────
--
-- Un sujet est du STOCK : « le cycle de la rumination pour une praticienne
-- EMDR qui reçoit des adultes en burnout » ne devient celui de personne en
-- étant écrit. Ce qui appartient à quelqu'un est l'ATTRIBUTION, et c'est
-- `topic_assignments` qui la porte.
--
-- La distinction n'est pas théorique : la contrainte anti-collision de la
-- PHASE 2.2 — un même sujet n'est pas servi à deux praticiennes partageant
-- (État, modalité) dans une fenêtre de 90 jours — ne peut PAS s'exprimer si
-- chaque kit a sa copie privée du sujet. Elle a besoin que « le même sujet »
-- soit une ligne, pas une ressemblance.
--
-- ── ⚠ ET L'ATTRIBUTION EST PAR KIT, PAS PAR PERSONNE ────────────────────
--
-- Contrairement aux crédits (`20260920140100`, qui suivent l'abonnement, donc
-- la personne). Une caption appartient à une MARQUE : deux kits d'une même
-- praticienne sont deux voix, et leur interdire un sujet commun n'aurait pas
-- de sens. La collision INTER-personnes, elle, se pose au niveau de la
-- personne, et le §4 la pose là en joignant `projects.user_id`.
-- ============================================================================


-- ============================================================================
-- 1. content_segments — structuré, jamais du texte libre
-- ============================================================================
-- Modalité × population × (optionnel) État. Les trois côtés pointent vers des
-- catalogues qui existent déjà — `modality_cards`, `client_persona_cards`,
-- `license_type_states` pour les codes d'État — plutôt que de recopier trois
-- vocabulaires.

create table if not exists public.content_segments (
  id           uuid     primary key default gen_random_uuid(),
  modality_id  text     not null references public.modality_cards (id),
  persona_id   text     not null references public.client_persona_cards (id),
  -- NULL = ce segment vaut pour tous les États. Ce n'est pas « inconnu » :
  -- c'est le cas général, et c'est le plus fréquent.
  state_code   char(2),
  created_at   timestamptz not null default now(),

  constraint content_segments_state_check
    check (state_code is null or state_code ~ '^[A-Z]{2}$')
);

comment on table public.content_segments is
  'Modality x population x (optional) state. Three foreign keys into the catalogues that already exist, never free text -- a segment described in prose can be neither counted, nor degraded towards a neighbour, nor used for the anti-collision window.';
comment on column public.content_segments.state_code is
  'NULL means every state. The general case, not an unknown: most topics do not depend on the jurisdiction, and the ones that do (telehealth, insurance) name it.';

-- ⚠ DEUX INDEX PARTIELS, PAS UN `unique nulls not distinct`. La clause existe
-- depuis PostgreSQL 15 et marcherait ici ; deux index partiels marchent aussi
-- sur une base plus ancienne, et surtout ils DISENT les deux cas — « ce
-- segment-là pour cet État » et « ce segment-là pour tous » — là où la clause
-- laisse la lectrice déduire que NULL a été rendu comparable.
create unique index if not exists content_segments_with_state_key
  on public.content_segments (modality_id, persona_id, state_code)
  where state_code is not null;
create unique index if not exists content_segments_any_state_key
  on public.content_segments (modality_id, persona_id)
  where state_code is null;

alter table public.content_segments enable row level security;

drop policy if exists "content_segments_select_all"    on public.content_segments;
drop policy if exists "content_segments_insert_denied" on public.content_segments;
drop policy if exists "content_segments_update_denied" on public.content_segments;
drop policy if exists "content_segments_delete_denied" on public.content_segments;

create policy "content_segments_select_all" on public.content_segments
  for select to authenticated using (true);
create policy "content_segments_insert_denied" on public.content_segments
  for insert with check (false);
create policy "content_segments_update_denied" on public.content_segments
  for update using (false);
create policy "content_segments_delete_denied" on public.content_segments
  for delete using (false);


-- ============================================================================
-- 2. content_topics — la banque
-- ============================================================================
create table if not exists public.content_topics (
  id                  uuid     primary key default gen_random_uuid(),
  segment_id          uuid     not null references public.content_segments (id) on delete cascade,
  archetype_key       text     not null references public.content_archetypes (id),
  intent              text     not null,
  title               text     not null,
  hook                text     not null,
  payload             jsonb    not null,
  caption_seed        text     not null,
  -- Alimente la ligne « Why this one: … » sous chaque carte. Un GABARIT, pas
  -- une phrase finie : il porte des substitutions que le pipeline remplit avec
  -- ce que le brief de la praticienne dit réellement.
  rationale_template  text     not null,
  -- NULL = pas encore relu. La garde déontologique passe UNE fois par sujet,
  -- ici, et non à chaque post : c'est ce qui rend trente publications
  -- mensuelles tenables.
  ethics_reviewed_at  timestamptz,
  timely              boolean  not null default false,
  expires_at          timestamptz,
  generation_batch_id uuid,
  created_at          timestamptz not null default now(),

  constraint content_topics_intent_check check
    (intent in ('educate', 'normalise', 'invite', 'correct_a_myth', 'behind_the_practice')),
  constraint content_topics_title_check   check (char_length(title) between 1 and 80),
  constraint content_topics_hook_check    check (char_length(hook) between 1 and 160),
  constraint content_topics_caption_check check (char_length(caption_seed) between 1 and 2200),
  constraint content_topics_rationale_check
    check (char_length(rationale_template) between 1 and 200),

  -- ⚠ LE PAYLOAD EST VALIDÉ PAR ARCHÉTYPE, DANS LA LIGNE.
  --
  -- Pas dans le pipeline seulement : un sujet mal formé écrit par un chemin
  -- qu'on n'a pas encore imaginé produirait un rendu cassé au 1er du mois, la
  -- nuit, pour tout le monde à la fois. La contrainte est ce qui fait que la
  -- seule façon d'obtenir un quadrant à trois cases est de ne pas en obtenir.
  constraint content_topics_payload_check
    check (public.content_topic_payload_valid(archetype_key, payload)),

  -- Un sujet daté a une date de péremption, et un sujet intemporel n'en a pas.
  -- Les deux moitiés, parce que l'une sans l'autre laisse passer la moitié des
  -- incohérences : un « awareness month » sans fin resterait proposé en juin.
  constraint content_topics_timely_expiry_check check (timely = (expires_at is not null))
);

comment on table public.content_topics is
  'The topic bank. STOCK, not anybody''s property: what belongs to a kit is the topic_assignments row. That distinction is what makes the cross-practitioner anti-collision window expressible at all -- it needs "the same topic" to be one row, not a resemblance.';
comment on column public.content_topics.payload is
  'The archetype''s structured fields, validated by content_topic_payload_valid IN THE ROW. A malformed topic written through some path nobody anticipated would break rendering on the 1st, overnight, for everybody at once.';
comment on column public.content_topics.ethics_reviewed_at is
  'When the ethics guard reviewed THIS TOPIC. Once per topic, never per post: that is what makes thirty monthly publications affordable. The generated TEXT still goes through banned_phrases on every write -- diagram labels included.';
comment on column public.content_topics.rationale_template is
  'The template for the "Why this one: ..." line. A template and not a finished sentence: the pipeline substitutes what her own brief says, so the justification is hers rather than generic copy.';

create index if not exists content_topics_segment_idx
  on public.content_topics (segment_id, archetype_key);
-- Le tirage ne considère QUE les sujets relus. Index partiel : les non relus
-- sont du stock en cours de fabrication et n'ont rien à faire dans le plan.
create index if not exists content_topics_reviewed_idx
  on public.content_topics (segment_id)
  where ethics_reviewed_at is not null;
create index if not exists content_topics_timely_idx
  on public.content_topics (expires_at)
  where timely;
create index if not exists content_topics_batch_idx
  on public.content_topics (generation_batch_id);

-- ⚠ LA POLICY DE `content_topics` EST PLUS BAS, APRÈS `topic_assignments`.
-- Elle lit cette table-là, et une policy est analysée à la création : écrite
-- ici, la migration échoue sur « relation topic_assignments does not exist ».
-- L'ordre des sections suit donc la dépendance, pas la lecture.

-- ============================================================================
-- 3. topic_assignments — ce qui appartient à un kit
-- ============================================================================
create table if not exists public.topic_assignments (
  brand_kit_id uuid not null references public.brand_kits (id) on delete cascade,
  topic_id     uuid not null references public.content_topics (id) on delete cascade,
  month        date not null,
  assigned_at  timestamptz not null default now(),

  -- ⚠ LA CLEF PRIMAIRE EST (kit, sujet) ET PAS (kit, sujet, mois). C'est elle
  -- qui dit « jamais deux fois le même sujet, à vie » : un sujet déjà attribué
  -- en mars ne peut pas l'être à nouveau en novembre, parce que la ligne
  -- existe déjà. Y ajouter le mois transformerait la règle en « jamais deux
  -- fois dans le même mois », ce qui n'est pas la même promesse.
  constraint topic_assignments_pkey primary key (brand_kit_id, topic_id),
  constraint topic_assignments_month_check check (month = date_trunc('month', month)::date)
);

comment on table public.topic_assignments is
  'Which topic was served to which kit, and for which month. The primary key is (kit, topic) WITHOUT the month: that is what holds "never the same topic twice, ever". With the month in it the promise would become "never twice in the same month".';

create index if not exists topic_assignments_topic_idx
  on public.topic_assignments (topic_id, assigned_at desc);
create index if not exists topic_assignments_kit_month_idx
  on public.topic_assignments (brand_kit_id, month desc);

alter table public.topic_assignments enable row level security;

drop policy if exists "topic_assignments_select_own"    on public.topic_assignments;
drop policy if exists "topic_assignments_insert_denied" on public.topic_assignments;
drop policy if exists "topic_assignments_update_denied" on public.topic_assignments;
drop policy if exists "topic_assignments_delete_denied" on public.topic_assignments;

create policy "topic_assignments_select_own" on public.topic_assignments
  for select using (exists (
    select 1 from public.brand_kits bk
      join public.projects pr on pr.id = bk.project_id
     where bk.id = topic_assignments.brand_kit_id
       and pr.user_id = (select auth.uid())
  ));
create policy "topic_assignments_insert_denied" on public.topic_assignments
  for insert with check (false);
create policy "topic_assignments_update_denied" on public.topic_assignments
  for update using (false);
create policy "topic_assignments_delete_denied" on public.topic_assignments
  for delete using (false);


alter table public.content_topics enable row level security;

drop policy if exists "content_topics_select_assigned" on public.content_topics;
drop policy if exists "content_topics_insert_denied"   on public.content_topics;
drop policy if exists "content_topics_update_denied"   on public.content_topics;
drop policy if exists "content_topics_delete_denied"   on public.content_topics;

-- ⚠ ELLE NE VOIT QUE CE QUI LUI A ÉTÉ ATTRIBUÉ, et c'est un choix de produit
-- autant que de sécurité. La banque entière lisible, c'est le catalogue des
-- sujets du concurrent d'à côté, et c'est aussi la fin de l'effet « celui-ci a
-- été choisi pour vous ».
create policy "content_topics_select_assigned" on public.content_topics
  for select using (exists (
    select 1
      from public.topic_assignments ta
      join public.brand_kits bk on bk.id = ta.brand_kit_id
      join public.projects   pr on pr.id = bk.project_id
     where ta.topic_id = content_topics.id
       and pr.user_id = (select auth.uid())
  ));
create policy "content_topics_insert_denied" on public.content_topics
  for insert with check (false);
create policy "content_topics_update_denied" on public.content_topics
  for update using (false);
create policy "content_topics_delete_denied" on public.content_topics
  for delete using (false);


-- ============================================================================
-- 4. La fenêtre anti-collision, écrite une fois
-- ============================================================================
create or replace function public.topic_collision_window()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '90 days'
$$;

comment on function public.topic_collision_window() is
  'How long a topic served to one practitioner stays unavailable to another sharing (state, modality). THE one place the 90 days are written.';

revoke all on function public.topic_collision_window() from public;
grant execute on function public.topic_collision_window() to authenticated, service_role;


-- ============================================================================
-- 5. next_topic_for_kit — le tirage. Une requête, aucun modèle.
-- ============================================================================
-- ⚠ LA DÉGRADATION VERS LES SEGMENTS ADJACENTS N'EST PAS UNE CASCADE.
--
-- Écrite comme une échelle de replis — « essaie le segment exact ; s'il est
-- vide essaie la même modalité ; sinon la même population » — elle aurait
-- autant de comportements que de barreaux, et chacun serait un endroit où un
-- sujet moins bon peut battre un meilleur par accident d'ordre.
--
-- Elle est ici UN SEUL classement. Un segment exact marque plus haut qu'un
-- segment qui ne partage que la modalité, qui marque plus haut qu'un segment
-- qui ne partage que la population. Quand le segment principal est épuisé, ce
-- sont mécaniquement les voisins qui sortent en tête — sans qu'aucune ligne de
-- code ne s'appelle « repli ».
--
-- ⚠ ET LE CLASSEMENT EST TOTAL. `order by … , t.id` ferme le dernier
-- ex aequo : deux appels sur le même état de banque rendent le même sujet.
-- Sans ce dernier critère, « déterministe » serait faux dès deux sujets de
-- même score, et le test de la PHASE 6 qui rejoue un mois ne prouverait rien.

create or replace function public.next_topic_for_kit(
  p_brand_kit_id uuid,
  p_month        date,
  p_archetype    text default null
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with kit as (
    select coalesce(pb.modality_ids, '{}')       as modalities,
           coalesce(pb.client_persona_ids, '{}') as personas,
           upper(nullif(btrim(coalesce(pb.state, '')), '')) as state_code,
           pr.user_id                            as user_id
      from public.brand_kits bk
      join public.projects      pr on pr.id = bk.project_id
      left join public.project_briefs pb on pb.project_id = pr.id
     where bk.id = p_brand_kit_id
  )
  select t.id
    from public.content_topics t
    join public.content_segments s on s.id = t.segment_id
   cross join kit k
   where
     -- Un sujet non relu n'est pas du stock, c'est un brouillon.
     t.ethics_reviewed_at is not null
     -- Un sujet daté et périmé ne sort plus. `expires_at is null` couvre les
     -- intemporels, et le CHECK de la table garantit qu'ils ne sont pas
     -- `timely` -- les deux moitiés se tiennent.
     and (t.expires_at is null or t.expires_at > now())
     and (p_archetype is null or t.archetype_key = p_archetype)

     -- ── Jamais deux fois, à vie ────────────────────────────────────────
     and not exists (
       select 1 from public.topic_assignments ta
        where ta.brand_kit_id = p_brand_kit_id and ta.topic_id = t.id
     )

     -- ── Anti-collision inter-praticiennes ──────────────────────────────
     -- ⚠ ENTRE PERSONNES, PAS ENTRE KITS. Deux kits d'une même praticienne
     -- sont deux voix et n'ont aucune raison de s'exclure ; deux praticiennes
     -- du même État pratiquant la même modalité parlent, elles, au même
     -- public, et le même diagramme chez les deux se voit.
     and not exists (
       select 1
         from public.topic_assignments ta
         join public.brand_kits   obk on obk.id = ta.brand_kit_id
         join public.projects     opr on opr.id = obk.project_id
         left join public.project_briefs opb on opb.project_id = opr.id
        where ta.topic_id = t.id
          and ta.assigned_at > now() - public.topic_collision_window()
          and opr.user_id is distinct from k.user_id
          and k.state_code is not null
          and upper(nullif(btrim(coalesce(opb.state, '')), '')) = k.state_code
          and coalesce(opb.modality_ids, '{}') && k.modalities
     )

     -- Un segment qui ne partage NI la modalité NI la population n'est pas un
     -- voisin, c'est quelqu'un d'autre. Le classement ci-dessous ne pourrait
     -- pas l'exclure : il lui donnerait simplement le plus petit score, et il
     -- sortirait quand même une fois tout le reste épuisé.
     and (s.modality_id = any (k.modalities) or s.persona_id = any (k.personas))
     and (s.state_code is null or s.state_code = k.state_code)

   order by
     -- recouvrement modalité + population
     (case when s.modality_id = any (k.modalities) then 2 else 0 end)
     + (case when s.persona_id = any (k.personas) then 2 else 0 end)
     -- un segment qui NOMME son État est plus précis qu'un segment général
     + (case when s.state_code is not null then 1 else 0 end)
     -- bonus d'actualité
     + (case when t.timely then 3 else 0 end)
     desc,
     -- fraîcheur, à score égal
     t.created_at desc,
     -- ⚠ LE DERNIER EX AEQUO. Sans lui, « déterministe » est faux.
     t.id
   limit 1
$$;

comment on function public.next_topic_for_kit(uuid, date, text) is
  'The next topic for this kit, or NULL when the bank has nothing eligible left. A QUERY: no model call, therefore free and instant -- this is what Swap runs on. Degradation towards neighbouring segments is a single ranking rather than a ladder of fallbacks, and the sort ends on t.id so that two calls against the same bank state return the same topic.';

revoke all on function public.next_topic_for_kit(uuid, date, text) from public, anon, authenticated;
grant execute on function public.next_topic_for_kit(uuid, date, text) to service_role;


-- ============================================================================
-- 6. assign_topic_to_kit — le tirage ET l'attribution, atomiques
-- ============================================================================
-- ⚠ TIRER PUIS ÉCRIRE EN DEUX APPELS EST UNE COURSE. Deux Swap simultanés
-- liraient le même « prochain sujet » et l'un des deux écrirait une ligne déjà
-- écrite. `on conflict do nothing` + la boucle font que le perdant en tire un
-- autre au lieu d'échouer.

create or replace function public.assign_topic_to_kit(
  p_brand_kit_id uuid,
  p_month        date,
  p_archetype    text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', coalesce(p_month, now()))::date;
  v_topic uuid;
  v_done  boolean;
  v_tries integer := 0;
begin
  if p_brand_kit_id is null then
    return null;
  end if;

  loop
    v_tries := v_tries + 1;
    -- Une banque dimensionnée pour ~500 sujets par segment ne produit pas dix
    -- collisions d'affilée ; dix tours est une borne contre une boucle
    -- infinie, pas un budget de réessais attendu.
    exit when v_tries > 10;

    v_topic := public.next_topic_for_kit(p_brand_kit_id, v_month, p_archetype);
    if v_topic is null then
      return null;
    end if;

    insert into public.topic_assignments (brand_kit_id, topic_id, month)
    values (p_brand_kit_id, v_topic, v_month)
    on conflict (brand_kit_id, topic_id) do nothing;

    get diagnostics v_done = row_count;
    if v_done then
      return v_topic;
    end if;
  end loop;

  return null;
end
$$;

comment on function public.assign_topic_to_kit(uuid, date, text) is
  'Draws the next topic AND assigns it, atomically. Two simultaneous swaps would otherwise read the same "next" and one would write a row that already exists: the loser of the on-conflict simply draws another. Returns NULL when the bank has nothing left -- a caller that gets NULL must SAY so, not retry.';

revoke all on function public.assign_topic_to_kit(uuid, date, text) from public, anon, authenticated;
grant execute on function public.assign_topic_to_kit(uuid, date, text) to service_role;


-- ============================================================================
-- Guard rails
-- ============================================================================
do $$
declare
  v_seg_a  uuid;
  v_seg_b  uuid;
  v_seg_c  uuid;
  v_mod    text;
  v_mod2   text;
  v_per    text;
  v_user_1 uuid := gen_random_uuid();
  v_user_2 uuid := gen_random_uuid();
  v_proj_1 uuid := gen_random_uuid();
  v_proj_2 uuid := gen_random_uuid();
  v_kit_1  uuid := gen_random_uuid();
  v_kit_2  uuid := gen_random_uuid();
  v_t      uuid;
  v_t2     uuid;
  v_month  date := date_trunc('month', now())::date;
  v_n      integer;
  t        text;
begin
  -- ---- RLS et surface ----------------------------------------------------
  foreach t in array array['content_segments', 'content_topics', 'topic_assignments'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'topic bank: RLS absente sur %', t;
    end if;
  end loop;
  foreach t in array array['next_topic_for_kit(uuid,date,text)',
                           'assign_topic_to_kit(uuid,date,text)'] loop
    if has_function_privilege('authenticated', ('public.' || t)::regprocedure, 'EXECUTE') then
      raise exception 'authenticated peut exécuter %, qui sert un sujet à un kit arbitraire', t;
    end if;
  end loop;

  -- ---- Deux praticiennes, même État, même modalité -----------------------
  select id into v_mod  from public.modality_cards where active order by sort_order limit 1;
  select id into v_mod2 from public.modality_cards where active and id <> v_mod
   order by sort_order limit 1;
  select id into v_per  from public.client_persona_cards where active order by sort_order limit 1;
  if v_mod is null or v_mod2 is null or v_per is null then
    raise exception 'les catalogues de modalités/populations sont vides; ce garde-fou ne prouve rien.';
  end if;

  insert into auth.users (id, email) values
    (v_user_1, 'topics-1@example.invalid'), (v_user_2, 'topics-2@example.invalid');
  insert into public.projects (id, user_id, name) values
    (v_proj_1, v_user_1, 'P1'), (v_proj_2, v_user_2, 'P2');
  insert into public.project_briefs (project_id, modality_ids, client_persona_ids, state) values
    (v_proj_1, array[v_mod], array[v_per], 'CA'),
    (v_proj_2, array[v_mod], array[v_per], 'CA');
  insert into public.brand_kits (id, project_id) values
    (v_kit_1, v_proj_1), (v_kit_2, v_proj_2);

  insert into public.content_segments (modality_id, persona_id, state_code)
  values (v_mod, v_per, null) returning id into v_seg_a;

  -- Un sujet relu, intemporel.
  insert into public.content_topics
    (segment_id, archetype_key, intent, title, hook, payload, caption_seed,
     rationale_template, ethics_reviewed_at)
  values (v_seg_a, 'single_statement', 'normalise', 'Rest is not earned',
          'A sentence she can post as is',
          '{"statement":"Rest is not a reward you earn after everything else is done"}'::jsonb,
          'Rest is not a reward.', 'Because {{specialty}} keeps coming up.', now())
  returning id into v_t;

  -- ---- le tirage le trouve -----------------------------------------------
  if public.next_topic_for_kit(v_kit_1, v_month) is distinct from v_t then
    raise exception 'le tirage n''a pas trouvé le seul sujet éligible.';
  end if;

  -- ---- déterminisme : deux appels, même réponse --------------------------
  if public.next_topic_for_kit(v_kit_1, v_month)
     is distinct from public.next_topic_for_kit(v_kit_1, v_month) then
    raise exception 'deux tirages consécutifs ont rendu deux sujets différents.';
  end if;

  -- ---- l'attribution est atomique et consomme ----------------------------
  if public.assign_topic_to_kit(v_kit_1, v_month) is distinct from v_t then
    raise exception 'assign_topic_to_kit n''a pas attribué le sujet attendu.';
  end if;
  select count(*) into v_n from public.topic_assignments where brand_kit_id = v_kit_1;
  if v_n <> 1 then
    raise exception 'assign_topic_to_kit a écrit % ligne(s), attendu 1', v_n;
  end if;

  -- ---- ⚠ JAMAIS DEUX FOIS, À VIE ----------------------------------------
  if public.next_topic_for_kit(v_kit_1, v_month) is not null then
    raise exception 'un sujet déjà attribué a été reproposé au même kit.';
  end if;
  -- Y compris dans un autre mois : c'est la clef primaire sans le mois qui le
  -- tient, et c'est la moitié de la règle qu'un test par mois raterait.
  if public.next_topic_for_kit(v_kit_1, (v_month + interval '5 months')::date) is not null then
    raise exception 'un sujet attribué en mars a été reproposé en août au même kit.';
  end if;

  -- ---- ⚠ ANTI-COLLISION : même État, même modalité, 90 jours -------------
  if public.next_topic_for_kit(v_kit_2, v_month) is not null then
    raise exception 'le même sujet a été servi à deux praticiennes de CA pratiquant la même modalité.';
  end if;

  -- Une praticienne d'un AUTRE État n'est pas concernée par la fenêtre.
  update public.project_briefs set state = 'FL' where project_id = v_proj_2;
  if public.next_topic_for_kit(v_kit_2, v_month) is distinct from v_t then
    raise exception 'la fenêtre a bloqué une praticienne d''un autre État.';
  end if;

  -- Une praticienne du même État mais d'une AUTRE modalité non plus.
  update public.project_briefs set state = 'CA', modality_ids = array[v_mod2]
   where project_id = v_proj_2;
  if public.next_topic_for_kit(v_kit_2, v_month) is distinct from v_t then
    raise exception 'la fenêtre a bloqué une praticienne d''une autre modalité.';
  end if;

  -- ---- un sujet non relu n'est jamais servi ------------------------------
  update public.project_briefs set modality_ids = array[v_mod] where project_id = v_proj_2;
  insert into public.content_topics
    (segment_id, archetype_key, intent, title, hook, payload, caption_seed,
     rationale_template, ethics_reviewed_at)
  values (v_seg_a, 'single_statement', 'invite', 'Not reviewed yet', 'A hook',
          '{"statement":"This one has not been through the ethics guard at all"}'::jsonb,
          'seed', 'Because.', null)
  returning id into v_t2;
  if public.next_topic_for_kit(v_kit_2, v_month) is not null then
    raise exception 'un sujet non relu par la garde déontologique a été servi.';
  end if;

  -- ---- un sujet daté et périmé ne sort plus ------------------------------
  update public.content_topics
     set ethics_reviewed_at = now(), timely = true, expires_at = now() - interval '1 day'
   where id = v_t2;
  if public.next_topic_for_kit(v_kit_2, v_month) is not null then
    raise exception 'un sujet daté et périmé a été servi.';
  end if;
  update public.content_topics set expires_at = now() + interval '30 days' where id = v_t2;
  if public.next_topic_for_kit(v_kit_2, v_month) is distinct from v_t2 then
    raise exception 'un sujet daté et valide n''est pas passé devant un intemporel (bonus timely).';
  end if;

  -- ---- le CHECK timely/expires_at tient les deux moitiés -----------------
  begin
    insert into public.content_topics
      (segment_id, archetype_key, intent, title, hook, payload, caption_seed,
       rationale_template, timely, expires_at)
    values (v_seg_a, 'single_statement', 'invite', 'Timely forever', 'A hook',
            '{"statement":"A timely topic that somehow never expires at all"}'::jsonb,
            'seed', 'Because.', true, null);
    raise exception 'un sujet timely sans expires_at a été accepté.';
  exception when check_violation then null;
  end;
  begin
    insert into public.content_topics
      (segment_id, archetype_key, intent, title, hook, payload, caption_seed,
       rationale_template, timely, expires_at)
    values (v_seg_a, 'single_statement', 'invite', 'Timeless but dated', 'A hook',
            '{"statement":"A timeless topic that somehow carries an expiry"}'::jsonb,
            'seed', 'Because.', false, now() + interval '1 day');
    raise exception 'un sujet non timely avec expires_at a été accepté.';
  exception when check_violation then null;
  end;

  -- ---- ⚠ LE PAYLOAD EST REFUSÉ PAR LA LIGNE -----------------------------
  begin
    insert into public.content_topics
      (segment_id, archetype_key, intent, title, hook, payload, caption_seed,
       rationale_template)
    values (v_seg_a, 'quadrant_model', 'educate', 'Three is not four', 'A hook',
            '{"axis_x":"A","axis_y":"B","items":[{"label":"One","gloss":"a"}]}'::jsonb,
            'seed', 'Because.');
    raise exception 'un quadrant à un seul item a été écrit en base.';
  exception when check_violation then null;
  end;

  -- ---- un segment qui ne partage rien n'est pas un voisin ----------------
  insert into public.content_segments (modality_id, persona_id, state_code)
  values (v_mod2, (select id from public.client_persona_cards
                    where active and id <> v_per order by sort_order limit 1), null)
  returning id into v_seg_c;
  insert into public.content_topics
    (segment_id, archetype_key, intent, title, hook, payload, caption_seed,
     rationale_template, ethics_reviewed_at)
  values (v_seg_c, 'single_statement', 'educate', 'Someone elses subject', 'A hook',
          '{"statement":"This belongs to a different modality and a different population"}'::jsonb,
          'seed', 'Because.', now());

  -- kit_1 a déjà pris v_t ; le seul autre sujet éligible pour lui serait v_t2,
  -- pas celui du segment étranger.
  if public.next_topic_for_kit(v_kit_1, v_month) is distinct from v_t2 then
    raise exception 'le tirage a servi un segment qui ne partage ni modalité ni population.';
  end if;

  -- ---- teardown ----------------------------------------------------------
  delete from public.content_segments where id in (v_seg_a, v_seg_c);
  delete from auth.users where id in (v_user_1, v_user_2);
end
$$;


-- ============================================================================
-- DOWN
-- ============================================================================
--   drop function if exists public.assign_topic_to_kit(uuid, date, text);
--   drop function if exists public.next_topic_for_kit(uuid, date, text);
--   drop function if exists public.topic_collision_window();
--   drop table    if exists public.topic_assignments;
--   drop table    if exists public.content_topics;
--   drop table    if exists public.content_segments;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260920150100', 'topic_bank_and_assignment');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260920150200_insight_watch.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — la veille : UN pipeline hebdomadaire pour tout le parc
-- ============================================================================
-- ⚠ JAMAIS DE RECHERCHE WEB PAR UTILISATRICE, et c'est une décision de coût
-- autant que de produit.
--
-- Par utilisatrice, la veille coûte (nombre d'abonnées × nombre de recherches)
-- par semaine, pour produire à peu près les mêmes cartes chez tout le monde :
-- l'APA publie la même chose pour toutes. Une fois pour le parc, elle coûte un
-- run — et le plafond dur de 40 recherches vit dans le code du run, pas dans
-- une intention.
--
-- Les cartes ne sont pas du contenu. Elles alimentent `content_topics` avec
-- `timely = true`, et c'est le sujet qui est publié, après la garde
-- déontologique. Une carte de veille ne traverse jamais l'écran de personne.
-- ============================================================================


-- ============================================================================
-- 1. insight_sources — une liste CURÉE, et curée veut dire close
-- ============================================================================
create table if not exists public.insight_sources (
  id          text     primary key,
  label       text     not null,
  kind        text     not null,
  -- NULL pour une source qui n'est pas une URL (un calendrier de mois de
  -- sensibilisation tenu à la main).
  url         text,
  active      boolean  not null default true,
  sort_order  smallint not null,

  constraint insight_sources_label_check check (char_length(label) between 1 and 80),
  constraint insight_sources_kind_check
    check (kind in ('association', 'government', 'journal', 'feed', 'calendar', 'press')),
  -- Nullable, donc gardé par `is null or` : un `~` nu accepterait un NULL,
  -- puisqu'un CHECK ne rejette que sur FALSE.
  constraint insight_sources_url_check
    check (url is null or url ~ '^https://')
);

comment on table public.insight_sources is
  'The watch sources, curated by hand. Closed by construction: the weekly run reads ONLY these rows, so widening the watch is a migration with a diff rather than a prompt parameter.';

insert into public.insight_sources (id, label, kind, url, sort_order) values
  ('apa',              'American Psychological Association', 'association', 'https://www.apa.org/news',        1),
  ('aca',              'American Counseling Association',    'association', 'https://www.counseling.org',      2),
  ('nimh',             'National Institute of Mental Health','government',  'https://www.nimh.nih.gov/news',   3),
  ('psychology_today', 'Psychology Today',                   'press',       'https://www.psychologytoday.com', 4),
  ('pubmed',           'PubMed, requêtes suivies',           'feed',        'https://pubmed.ncbi.nlm.nih.gov', 5),
  ('awareness_months', 'US awareness months',                'calendar',    null,                              6)
on conflict (id) do update
  set label = excluded.label, kind = excluded.kind,
      url = excluded.url, sort_order = excluded.sort_order;

alter table public.insight_sources enable row level security;

drop policy if exists "insight_sources_select_all"    on public.insight_sources;
drop policy if exists "insight_sources_insert_denied" on public.insight_sources;
drop policy if exists "insight_sources_update_denied" on public.insight_sources;
drop policy if exists "insight_sources_delete_denied" on public.insight_sources;

create policy "insight_sources_select_all" on public.insight_sources
  for select to authenticated using (true);
create policy "insight_sources_insert_denied" on public.insight_sources
  for insert with check (false);
create policy "insight_sources_update_denied" on public.insight_sources
  for update using (false);
create policy "insight_sources_delete_denied" on public.insight_sources
  for delete using (false);


-- ============================================================================
-- 2. insight_runs — le plafond de recherches, en base
-- ============================================================================
-- ⚠ LE PLAFOND EST UN CHECK, PAS UNE CONSTANTE DANS LE CODE. « 40 recherches
-- par run maximum, plafond dur dans le code » — le code peut être contourné
-- par un second appelant ; une contrainte de ligne ne peut pas.

create table if not exists public.insight_runs (
  id            uuid     primary key default gen_random_uuid(),
  week          date     not null,
  searches_used integer  not null default 0,
  state         text     not null default 'running',
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,

  constraint insight_runs_week_key unique (week),
  -- Le lundi de la semaine. Un run par semaine pour tout le parc, et l'unicité
  -- le rend structurel plutôt que confié à un cron qui ne se déclenche qu'une
  -- fois si tout va bien.
  constraint insight_runs_week_check check (week = date_trunc('week', week)::date),
  constraint insight_runs_state_check check (state in ('running', 'done', 'failed')),
  constraint insight_runs_searches_check
    check (searches_used between 0 and 40),
  constraint insight_runs_finished_check
    check ((state = 'running') = (finished_at is null))
);

comment on table public.insight_runs is
  'One watch run per week, for the WHOLE estate. Uniqueness on the week makes "only once" structural rather than entrusted to a cron. searches_used is bounded to 40 BY THE ROW: a ceiling held only in code is a ceiling a second caller ignores.';

alter table public.insight_runs enable row level security;
revoke all on table public.insight_runs from anon, authenticated;

-- ⚠ LE REFUS EST ÉCRIT, PAS DÉDUIT. Sous RLS, l'absence de policy refuse déjà
-- tout le monde sauf le propriétaire et service_role — mais elle se lit
-- exactement comme une policy oubliée, et `20260911180620_tenancy_layer` fait
-- échouer la suite sur ce silence. L'effet est le même ; ce qui change est
-- qu'une lectrice sait que c'est voulu.
drop policy if exists "insight_runs_denied" on public.insight_runs;
create policy "insight_runs_denied" on public.insight_runs
  for all using (false) with check (false);


-- ============================================================================
-- 3. insight_cards — ce que le run produit
-- ============================================================================
create table if not exists public.insight_cards (
  id           uuid     primary key default gen_random_uuid(),
  source_id    text     not null references public.insight_sources (id),
  run_id       uuid     not null references public.insight_runs (id) on delete cascade,
  summary      text     not null,
  -- Les segments que cette carte concerne. Un tableau d'uuid plutôt qu'une
  -- table de liaison : une carte en nomme cinq ou six et n'est jamais jointe
  -- en volume — c'est `content_topics` qui l'est.
  segments     uuid[]   not null default '{}',
  published_at timestamptz,
  -- ⚠ NOT NULL. Une carte de veille SANS péremption est une actualité qui
  -- devient un mensonge : « ce mois-ci » lu en juin. La table refuse d'en
  -- porter une, plutôt que de compter sur le run pour toujours en poser une.
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),

  constraint insight_cards_summary_check check (char_length(summary) between 1 and 600),
  constraint insight_cards_segments_check
    check (coalesce(array_length(segments, 1), 0) between 0 and 24)
);

comment on table public.insight_cards is
  'What one watch run found. expires_at is NOT NULL: a piece of news with no expiry becomes a lie ("this month", read in June), and the table refuses to carry one rather than trusting the run to always set it. Cards are not content -- they feed content_topics with timely = true, and it is the topic that goes through the ethics guard.';

create index if not exists insight_cards_run_idx    on public.insight_cards (run_id);
create index if not exists insight_cards_expiry_idx on public.insight_cards (expires_at);
create index if not exists insight_cards_segments_idx
  on public.insight_cards using gin (segments);

alter table public.insight_cards enable row level security;
revoke all on table public.insight_cards from anon, authenticated;

drop policy if exists "insight_cards_denied" on public.insight_cards;
create policy "insight_cards_denied" on public.insight_cards
  for all using (false) with check (false);


-- ============================================================================
-- 4. Le trigger qui valide les segments d'une carte
-- ============================================================================
-- ⚠ UN TABLEAU NE PORTE PAS DE CLEF ÉTRANGÈRE. Sans ce trigger,
-- `insight_cards.segments` serait un sac d'uuid qui RESSEMBLE à une référence,
-- et un uuid mort y rétrécirait la portée d'une carte en silence au lieu
-- d'échouer. C'est exactement le motif que `content_preferences` a déjà posé
-- pour `accepted_registers`.

create or replace function public.insight_cards_validate_segments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unknown uuid;
begin
  select s into v_unknown
    from unnest(new.segments) as s
   where s not in (select id from public.content_segments)
   limit 1;

  if v_unknown is not null then
    raise exception 'insight_cards: % n''est pas un segment connu', v_unknown
      using errcode = 'check_violation';
  end if;

  return new;
end
$$;

comment on function public.insight_cards_validate_segments() is
  'Validates insight_cards.segments against content_segments -- an array carries no foreign key, and a dead uuid in it would silently narrow a card''s reach instead of failing.';

revoke all on function public.insight_cards_validate_segments() from public, anon, authenticated;

drop trigger if exists insight_cards_validate_segments on public.insight_cards;
create trigger insight_cards_validate_segments
  before insert or update on public.insight_cards
  for each row execute function public.insight_cards_validate_segments();


-- ============================================================================
-- 5. Le lien vers la banque : d'où vient un sujet daté
-- ============================================================================
alter table public.content_topics
  add column if not exists insight_card_id uuid references public.insight_cards (id) on delete set null;

comment on column public.content_topics.insight_card_id is
  'The watch card this topic was born from, when it came from one. ON DELETE SET NULL: purging expired cards must not take with them the topics they produced, which have been reviewed and may already be assigned.';

create index if not exists content_topics_insight_idx
  on public.content_topics (insight_card_id)
  where insight_card_id is not null;


-- ============================================================================
-- Guard rails
-- ============================================================================
do $$
declare
  v_run  uuid;
  v_seg  uuid;
  v_card uuid;
  v_mod  text;
  v_per  text;
  v_n    integer;
  t      text;
begin
  select count(*) into v_n from public.insight_sources;
  if v_n <> 6 then
    raise exception 'insight_sources: % lignes, attendu 6', v_n;
  end if;

  foreach t in array array['insight_runs', 'insight_cards'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'veille: RLS absente sur %', t;
    end if;
    -- Ces deux-là sont des instruments d'Eklio, pas des données de cliente.
    -- Le refus est ÉCRIT (`for all using (false)`), pas déduit de l'absence de
    -- policy : les deux ont le même effet, et seul le premier se distingue
    -- d'un oubli. Le REVOKE reste la seconde barrière.
    if not exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = t
         and qual = 'false' and with_check = 'false'
    ) then
      raise exception 'veille: % n''écrit pas son refus; RLS sans policy se lit comme un oubli.', t;
    end if;
    if has_table_privilege('authenticated', 'public.' || t, 'SELECT') then
      raise exception 'authenticated peut lire %', t;
    end if;
  end loop;

  -- ---- le plafond de 40 est tenu par la ligne ----------------------------
  insert into public.insight_runs (week) values (date_trunc('week', now())::date)
  returning id into v_run;

  begin
    update public.insight_runs set searches_used = 41 where id = v_run;
    raise exception 'un run a pu enregistrer 41 recherches; le plafond dur ne mord pas.';
  exception when check_violation then null;
  end;

  update public.insight_runs set searches_used = 40 where id = v_run;

  -- ---- un run par semaine ------------------------------------------------
  begin
    insert into public.insight_runs (week) values (date_trunc('week', now())::date);
    raise exception 'deux runs de veille ont été acceptés pour la même semaine.';
  exception when unique_violation then null;
  end;

  -- ---- une carte sans péremption est refusée -----------------------------
  begin
    insert into public.insight_cards (source_id, run_id, summary, expires_at)
    values ('apa', v_run, 'Une carte qui ne périme jamais', null);
    raise exception 'une carte de veille sans expires_at a été acceptée.';
  exception when not_null_violation then null;
  end;

  -- ---- les segments sont validés contre le catalogue ---------------------
  begin
    insert into public.insight_cards (source_id, run_id, summary, segments, expires_at)
    values ('apa', v_run, 'Une carte qui nomme un segment mort',
            array[gen_random_uuid()], now() + interval '60 days');
    raise exception 'un uuid de segment inconnu a été accepté dans une carte.';
  exception when check_violation then null;
  end;

  select id into v_mod from public.modality_cards where active order by sort_order limit 1;
  select id into v_per from public.client_persona_cards where active order by sort_order limit 1;
  insert into public.content_segments (modality_id, persona_id, state_code)
  values (v_mod, v_per, 'NV') returning id into v_seg;

  insert into public.insight_cards (source_id, run_id, summary, segments, expires_at)
  values ('apa', v_run, 'Une carte bien formée', array[v_seg], now() + interval '60 days')
  returning id into v_card;

  -- ---- ⚠ PURGER UNE CARTE N'EMPORTE PAS LE SUJET QU'ELLE A PRODUIT -------
  insert into public.content_topics
    (segment_id, archetype_key, intent, title, hook, payload, caption_seed,
     rationale_template, ethics_reviewed_at, timely, expires_at, insight_card_id)
  values (v_seg, 'single_statement', 'educate', 'Un sujet daté', 'Un hook',
          '{"statement":"A timely statement born out of a watch card this week"}'::jsonb,
          'seed', 'Because.', now(), true, now() + interval '30 days', v_card);

  delete from public.insight_cards where id = v_card;

  select count(*) into v_n from public.content_topics
   where segment_id = v_seg and insight_card_id is null;
  if v_n <> 1 then
    raise exception 'supprimer la carte a emporté le sujet qu''elle avait produit.';
  end if;

  -- ---- teardown ----------------------------------------------------------
  delete from public.content_segments where id = v_seg;
  delete from public.insight_runs where id = v_run;
end
$$;


-- ============================================================================
-- DOWN
-- ============================================================================
--   alter table public.content_topics drop column if exists insight_card_id;
--   drop trigger  if exists insight_cards_validate_segments on public.insight_cards;
--   drop function if exists public.insight_cards_validate_segments();
--   drop table    if exists public.insight_cards;
--   drop table    if exists public.insight_runs;
--   drop table    if exists public.insight_sources;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260920150200', 'insight_watch');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260920150300_rendered_assets_and_libraries.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — une image générée UNE SEULE FOIS, à deux niveaux
-- ============================================================================
-- Deux chemins, deux coûts, une seule règle.
--
--   * le RENDU VECTORIEL est gratuit en argent et cher en temps : Satori plus
--     resvg, une seconde environ par carte, trente cartes par mois par
--     abonnée. Le redéposer à chaque affichage, c'est une seconde d'attente
--     pour rien et un objet de stockage de plus à chaque fois.
--   * le VISUEL CUSTOM appelle une API facturée à l'image. Le regénérer, c'est
--     payer deux fois le même pixel.
--
-- La règle est la même des deux côtés : AVANT DE RENDRE, ON REGARDE SI ÇA
-- EXISTE. Ce qui change est ce qu'on hache — un payload pour l'un, un prompt
-- pour l'autre.
--
-- ── ⚠ LE GRAIN : LE KIT, PAS LA PERSONNE ────────────────────────────────
--
-- Le brief du chantier écrit `user_id` sur ces tables. Elles portent
-- `brand_kit_id`, et pour une raison qui se voit dans le chemin de stockage :
-- `20260903090000` a posé `{brand_kit_id}/…` comme convention du bucket, et la
-- policy qui garde ces objets (`brand_kit_asset_path_owner`) lit ce premier
-- segment. Un asset clefé sur la personne aurait un chemin qui ne correspond à
-- rien, ou une seconde convention de chemin à côté de la première.
--
-- Et c'est aussi le bon grain : un rendu dépend de la PALETTE, qui appartient à
-- une marque. Deux kits d'une même praticienne ont deux palettes et ne
-- partagent donc jamais un rendu, même à payload identique — ce que le hash
-- dit déjà, puisque la palette est dedans.
--
-- Les CRÉDITS, eux, restent par personne (`20260920140100`) : ils suivent
-- l'abonnement. Le décompte et l'objet ne sont pas au même étage, et c'est
-- voulu.
-- ============================================================================


-- ============================================================================
-- 1. rendered_assets — le cache de rendu, déduit du hash
-- ============================================================================
create table if not exists public.rendered_assets (
  id            uuid     primary key default gen_random_uuid(),
  brand_kit_id  uuid     not null references public.brand_kits (id) on delete cascade,
  -- SHA-256 de (archetype_key + payload normalisé + palette + typographie +
  -- version du moteur), en hexadécimal minuscule. Le CHECK porte sur la FORME,
  -- pas sur le contenu : la base ne peut pas recalculer le hash, mais elle
  -- peut refuser ce qui n'est pas un SHA-256.
  content_hash  text     not null,
  archetype_key text     not null references public.content_archetypes (id),
  palette_key   text     not null,
  storage_path  text     not null,
  width         integer  not null,
  height        integer  not null,
  bytes         integer  not null,
  render_ms     integer  not null,
  created_at    timestamptz not null default now(),

  -- ⚠ LA CONTRAINTE QUI EST TOUT LE SUJET. Deux rendus du même contenu pour le
  -- même kit ne peuvent pas coexister ; le second appel trouve le premier.
  constraint rendered_assets_kit_hash_key unique (brand_kit_id, content_hash),

  constraint rendered_assets_hash_check check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint rendered_assets_palette_check check (char_length(palette_key) between 1 and 64),
  constraint rendered_assets_path_check check (char_length(storage_path) between 1 and 512),
  constraint rendered_assets_dims_check check (width > 0 and height > 0),
  constraint rendered_assets_bytes_check check (bytes > 0),
  constraint rendered_assets_render_ms_check check (render_ms >= 0),
  -- ⚠ LE CHEMIN COMMENCE PAR LE KIT. C'est ce que la policy de storage.objects
  -- lit (`brand_kit_asset_path_owner`), donc un chemin qui ne respecte pas la
  -- convention produit un objet que personne ne peut lire -- visible seulement
  -- au moment où elle ouvre le post.
  constraint rendered_assets_path_prefix_check
    check (storage_path like (brand_kit_id::text || '/%'))
);

comment on table public.rendered_assets is
  'The render cache. UNIQUE (brand_kit_id, content_hash) is the whole point: rendering the same content twice for the same kit is impossible, the second call finds the first. Changing a word changes the hash and therefore produces a new asset; merely displaying the post produces none.';
comment on column public.rendered_assets.content_hash is
  'SHA-256 of (archetype_key + normalised payload + palette + typography + engine version), lowercase hex. The engine version is IN the hash on purpose: a change to the composition engine must invalidate every cached render, and a cache that survives its renderer serves last month''s bug forever.';
comment on column public.rendered_assets.storage_path is
  'Path inside the private content-assets bucket. Starts with the kit id because that is what the storage.objects policy reads; a path breaking the convention yields an object nobody can read, and it only shows up when she opens the post.';

create index if not exists rendered_assets_kit_idx on public.rendered_assets (brand_kit_id);

alter table public.rendered_assets enable row level security;

drop policy if exists "rendered_assets_select_own"    on public.rendered_assets;
drop policy if exists "rendered_assets_insert_denied" on public.rendered_assets;
drop policy if exists "rendered_assets_update_denied" on public.rendered_assets;
drop policy if exists "rendered_assets_delete_denied" on public.rendered_assets;

create policy "rendered_assets_select_own" on public.rendered_assets
  for select using (exists (
    select 1 from public.brand_kits bk
      join public.projects pr on pr.id = bk.project_id
     where bk.id = rendered_assets.brand_kit_id
       and pr.user_id = (select auth.uid())
  ));
create policy "rendered_assets_insert_denied" on public.rendered_assets
  for insert with check (false);
create policy "rendered_assets_update_denied" on public.rendered_assets
  for update using (false);
create policy "rendered_assets_delete_denied" on public.rendered_assets
  for delete using (false);


-- ============================================================================
-- 2. custom_visual_generations — le seul chemin qui coûte de l'argent
-- ============================================================================
create table if not exists public.custom_visual_generations (
  id            uuid     primary key default gen_random_uuid(),
  brand_kit_id  uuid     not null references public.brand_kits (id) on delete cascade,
  -- Le post pour lequel elle a demandé l'image. ON DELETE SET NULL : supprimer
  -- un post ne doit pas effacer la trace d'une dépense.
  content_item_id uuid   references public.content_items (id) on delete set null,
  prompt_hash   text     not null,
  model         text     not null,
  quality       text     not null,
  size          text     not null,
  storage_path  text     not null,
  cost_usd      numeric(12, 6) not null,
  -- La ligne du ledger qui a payé. NOT NULL : une image produite sans
  -- réservation de crédit est exactement ce que cette table existe pour rendre
  -- impossible.
  --
  -- ⚠ `on delete cascade`, ET LE PREMIER JET DISAIT `restrict`. C'était le
  -- réflexe (« une image ne doit pas survivre à la preuve de son paiement »)
  -- et le garde-fou l'a attrapé : `credit_ledger.user_id` est lui-même
  -- `on delete cascade`, donc un RESTRICT ici rendait la suppression d'un
  -- compte impossible — la même classe de défaut que le trigger append-only
  -- de `20260920140100` avait produite, trouvée de la même façon.
  --
  -- Et le RESTRICT ne gardait rien de plus : ce qui interdit une image sans
  -- paiement est le NOT NULL, pas la règle de suppression. La règle de
  -- suppression ne gouverne que le jour où la ligne de ledger disparaît, ce
  -- qui n'arrive qu'à la suppression du compte — où tout part de toute façon.
  reservation_id uuid    not null references public.credit_ledger (id) on delete cascade,
  created_at    timestamptz not null default now(),

  constraint custom_visual_kit_prompt_key unique (brand_kit_id, prompt_hash),
  constraint custom_visual_hash_check check (prompt_hash ~ '^[0-9a-f]{64}$'),
  constraint custom_visual_quality_check check (quality in ('low', 'medium')),
  constraint custom_visual_size_check check (size ~ '^[0-9]{3,5}x[0-9]{3,5}$'),
  constraint custom_visual_model_check check (btrim(model) <> ''),
  constraint custom_visual_cost_check check (cost_usd >= 0),
  constraint custom_visual_path_check check (char_length(storage_path) between 1 and 512),
  constraint custom_visual_path_prefix_check
    check (storage_path like (brand_kit_id::text || '/%'))
);

comment on table public.custom_visual_generations is
  'Every paid image, once. UNIQUE (brand_kit_id, prompt_hash): a prompt already generated for this kit is served from storage and never regenerated, so the credit is spent on the FIRST generation only. reservation_id is NOT NULL -- an image produced without a credit reservation is exactly what this table exists to make impossible -- and ON DELETE CASCADE, because the NOT NULL is what holds that rule while a RESTRICT would only have made accounts undeletable.';
comment on column public.custom_visual_generations.quality is
  'low by default, medium at most. Both the model and this setting are driven by environment variables in the pipeline; the CHECK bounds what any of them may write, so a misconfigured variable cannot buy the expensive tier.';

create index if not exists custom_visual_kit_idx on public.custom_visual_generations (brand_kit_id);

alter table public.custom_visual_generations enable row level security;

drop policy if exists "custom_visual_select_own"    on public.custom_visual_generations;
drop policy if exists "custom_visual_insert_denied" on public.custom_visual_generations;
drop policy if exists "custom_visual_update_denied" on public.custom_visual_generations;
drop policy if exists "custom_visual_delete_denied" on public.custom_visual_generations;

create policy "custom_visual_select_own" on public.custom_visual_generations
  for select using (exists (
    select 1 from public.brand_kits bk
      join public.projects pr on pr.id = bk.project_id
     where bk.id = custom_visual_generations.brand_kit_id
       and pr.user_id = (select auth.uid())
  ));
create policy "custom_visual_insert_denied" on public.custom_visual_generations
  for insert with check (false);
create policy "custom_visual_update_denied" on public.custom_visual_generations
  for update using (false);
create policy "custom_visual_delete_denied" on public.custom_visual_generations
  for delete using (false);


-- ============================================================================
-- 3. illustration_library — les objets monoline, versionnés
-- ============================================================================
create table if not exists public.illustration_library (
  id            uuid     primary key default gen_random_uuid(),
  slug          text     not null,
  version       smallint not null default 1,
  archetype_key text     references public.content_archetypes (id),
  -- Le SVG lui-même. En base et non dans le bucket : ce sont des objets
  -- monoline de quelques centaines d'octets que le moteur INLINE dans sa
  -- composition -- un aller-retour de stockage par carte pour 400 octets
  -- coûterait plus que le dessin.
  svg           text     not null,
  active        boolean  not null default true,
  created_at    timestamptz not null default now(),

  constraint illustration_library_slug_version_key unique (slug, version),
  constraint illustration_library_slug_check check (slug ~ '^[a-z0-9_]{2,48}$'),
  constraint illustration_library_version_check check (version >= 1),
  -- Une borne, pas une validation. Un SVG de 64 Ko n'est pas un objet
  -- monoline, c'est une illustration importée -- et il ferait exploser le
  -- temps de rasterisation de chaque carte qui le porte.
  constraint illustration_library_svg_check
    check (char_length(svg) between 20 and 8192 and svg like '<svg%')
);

comment on table public.illustration_library is
  'Monoline SVG objects, versioned and attributed per archetype. Held in the database rather than the bucket: these are a few hundred bytes each and the engine inlines them into its composition -- one storage round trip per card for 400 bytes would cost more than the drawing. Versioned because a redrawn object must not silently change last month''s rendered cards, whose hash was taken over the old one.';

create index if not exists illustration_library_archetype_idx
  on public.illustration_library (archetype_key, slug)
  where active;

alter table public.illustration_library enable row level security;

drop policy if exists "illustration_library_select_all"    on public.illustration_library;
drop policy if exists "illustration_library_insert_denied" on public.illustration_library;
drop policy if exists "illustration_library_update_denied" on public.illustration_library;
drop policy if exists "illustration_library_delete_denied" on public.illustration_library;

create policy "illustration_library_select_all" on public.illustration_library
  for select to authenticated using (true);
create policy "illustration_library_insert_denied" on public.illustration_library
  for insert with check (false);
create policy "illustration_library_update_denied" on public.illustration_library
  for update using (false);
create policy "illustration_library_delete_denied" on public.illustration_library
  for delete using (false);


-- ============================================================================
-- 4. background_library — les fonds, et leur fenêtre anti-collision
-- ============================================================================
create table if not exists public.background_library (
  id           uuid     primary key default gen_random_uuid(),
  slug         text     not null unique,
  storage_path text     not null,
  -- Le traitement : ce n'est pas une photographie de catalogue, c'est un fond
  -- neutre. Le champ existe pour que le moteur choisisse un fond dont le
  -- traitement s'accorde à la palette, pas pour décrire une scène.
  treatment    text     not null,
  active       boolean  not null default true,
  created_at   timestamptz not null default now(),

  constraint background_library_slug_check check (slug ~ '^[a-z0-9_]{2,48}$'),
  constraint background_library_treatment_check
    check (treatment in ('paper', 'linen', 'wash', 'grain', 'shadow'))
);

comment on table public.background_library is
  'Neutral photographic backgrounds. `treatment` describes the surface, never a scene: the engine picks a background whose treatment suits the palette, and a catalogue of scenes would be a second editorial axis nobody asked for.';

alter table public.background_library enable row level security;

drop policy if exists "background_library_select_all"    on public.background_library;
drop policy if exists "background_library_insert_denied" on public.background_library;
drop policy if exists "background_library_update_denied" on public.background_library;
drop policy if exists "background_library_delete_denied" on public.background_library;

create policy "background_library_select_all" on public.background_library
  for select to authenticated using (true);
create policy "background_library_insert_denied" on public.background_library
  for insert with check (false);
create policy "background_library_update_denied" on public.background_library
  for update using (false);
create policy "background_library_delete_denied" on public.background_library
  for delete using (false);


create table if not exists public.background_assignments (
  brand_kit_id uuid not null references public.brand_kits (id) on delete cascade,
  asset_id     uuid not null references public.background_library (id) on delete cascade,
  assigned_at  timestamptz not null default now(),

  -- La même forme que `topic_assignments`, et pour la même raison : c'est la
  -- clef primaire sans le mois qui tient « pas deux fois le même fond ».
  constraint background_assignments_pkey primary key (brand_kit_id, asset_id)
);

comment on table public.background_assignments is
  'Which background went to which kit. Same shape as topic_assignments and for the same reason: the primary key without a month is what holds "not the same background twice", and the 90-day (state, modality) window is applied by next_background_for_kit rather than restated here.';

create index if not exists background_assignments_asset_idx
  on public.background_assignments (asset_id, assigned_at desc);

alter table public.background_assignments enable row level security;

drop policy if exists "background_assignments_select_own"    on public.background_assignments;
drop policy if exists "background_assignments_insert_denied" on public.background_assignments;
drop policy if exists "background_assignments_update_denied" on public.background_assignments;
drop policy if exists "background_assignments_delete_denied" on public.background_assignments;

create policy "background_assignments_select_own" on public.background_assignments
  for select using (exists (
    select 1 from public.brand_kits bk
      join public.projects pr on pr.id = bk.project_id
     where bk.id = background_assignments.brand_kit_id
       and pr.user_id = (select auth.uid())
  ));
create policy "background_assignments_insert_denied" on public.background_assignments
  for insert with check (false);
create policy "background_assignments_update_denied" on public.background_assignments
  for update using (false);
create policy "background_assignments_delete_denied" on public.background_assignments
  for delete using (false);


-- ============================================================================
-- 5. next_background_for_kit — la même fenêtre que les sujets
-- ============================================================================
-- ⚠ LA MÊME FONCTION `topic_collision_window()`, RÉUTILISÉE ENTIÈRE. Deux
-- fenêtres de 90 jours écrites séparément sont deux fenêtres qui finiront par
-- valoir 90 et 60.

create or replace function public.next_background_for_kit(p_brand_kit_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with kit as (
    select coalesce(pb.modality_ids, '{}') as modalities,
           upper(nullif(btrim(coalesce(pb.state, '')), '')) as state_code,
           pr.user_id as user_id
      from public.brand_kits bk
      join public.projects pr on pr.id = bk.project_id
      left join public.project_briefs pb on pb.project_id = pr.id
     where bk.id = p_brand_kit_id
  )
  select b.id
    from public.background_library b
   cross join kit k
   where b.active
     and not exists (
       select 1 from public.background_assignments ba
        where ba.brand_kit_id = p_brand_kit_id and ba.asset_id = b.id
     )
     and not exists (
       select 1
         from public.background_assignments ba
         join public.brand_kits   obk on obk.id = ba.brand_kit_id
         join public.projects     opr on opr.id = obk.project_id
         left join public.project_briefs opb on opb.project_id = opr.id
        where ba.asset_id = b.id
          and ba.assigned_at > now() - public.topic_collision_window()
          and opr.user_id is distinct from k.user_id
          and k.state_code is not null
          and upper(nullif(btrim(coalesce(opb.state, '')), '')) = k.state_code
          and coalesce(opb.modality_ids, '{}') && k.modalities
     )
   order by b.slug
   limit 1
$$;

comment on function public.next_background_for_kit(uuid) is
  'The next unused background for this kit, honouring the same 90-day (state, modality) window as topics -- via topic_collision_window(), reused whole rather than restated, because two separately-written 90-day windows end up being 90 and 60. Ordered by slug, so it is deterministic. NULL when the library is exhausted.';

revoke all on function public.next_background_for_kit(uuid) from public, anon, authenticated;
grant execute on function public.next_background_for_kit(uuid) to service_role;


-- ============================================================================
-- 6. Le bucket privé, et qui peut y lire
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-assets', 'content-assets', false, 10485760,
        array['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- ⚠ LECTURE SEULE POUR LE CLIENT, ET AUCUNE ÉCRITURE DU TOUT.
--
-- `brand-assets` accorde INSERT et UPDATE à `authenticated`, parce que le
-- navigateur y dépose via une URL d'upload signée. Rien de tel ici : chaque
-- octet de ce bucket est écrit par le pipeline, côté serveur, en service_role.
-- Donner au client une policy d'écriture ouvrirait un chemin qu'aucun code
-- n'emprunte — et un chemin que personne n'emprunte est un chemin que
-- personne ne surveille.
--
-- La lecture, elle, est nécessaire : `/app/content/[id]` signe l'URL avec le
-- client de session, et signer demande le droit de lire.
--
-- Le prédicat est `brand_kit_asset_path_owner` (20260903090000), réutilisé
-- tel quel : possédé ET payé, via brand_kit_entitled. Un kit dont l'achat a
-- été annulé cesse de servir ses images, sans une ligne de plus.
drop policy if exists "content_assets_storage_select_own_paid" on storage.objects;
create policy "content_assets_storage_select_own_paid"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'content-assets'
    and public.brand_kit_asset_path_owner(name)
  );


-- ============================================================================
-- Guard rails
-- ============================================================================
do $$
declare
  v_user uuid := gen_random_uuid();
  v_proj uuid := gen_random_uuid();
  v_kit  uuid := gen_random_uuid();
  v_kit2 uuid := gen_random_uuid();
  v_proj2 uuid := gen_random_uuid();
  v_user2 uuid := gen_random_uuid();
  v_res  jsonb;
  v_bg1  uuid;
  v_bg2  uuid;
  v_hash text := repeat('a', 64);
  v_mod  text;
  v_per  text;
  v_n    integer;
  t      text;
begin
  foreach t in array array['rendered_assets', 'custom_visual_generations',
                           'illustration_library', 'background_library',
                           'background_assignments'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'assets: RLS absente sur %', t;
    end if;
    if exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = t
         and cmd in ('INSERT', 'UPDATE', 'DELETE')
         and coalesce(qual, with_check) is distinct from 'false'
    ) then
      raise exception 'assets: % porte une policy d''écriture qui n''est pas `false`', t;
    end if;
  end loop;

  if has_function_privilege('authenticated', 'public.next_background_for_kit(uuid)'::regprocedure, 'EXECUTE') then
    raise exception 'authenticated peut exécuter next_background_for_kit';
  end if;

  -- ---- le bucket est privé, et sans policy d'écriture pour le client -----
  if (select public from storage.buckets where id = 'content-assets') then
    raise exception 'le bucket content-assets est public.';
  end if;
  if exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'content_assets%' and cmd <> 'SELECT'
  ) then
    raise exception 'content-assets accorde une écriture au client; tout y est écrit côté serveur.';
  end if;

  -- ---- la déduplication mord ---------------------------------------------
  select id into v_mod from public.modality_cards where active order by sort_order limit 1;
  select id into v_per from public.client_persona_cards where active order by sort_order limit 1;

  insert into auth.users (id, email) values (v_user, 'assets@example.invalid');
  insert into public.projects (id, user_id, name) values (v_proj, v_user, 'A');
  insert into public.project_briefs (project_id, modality_ids, client_persona_ids, state)
  values (v_proj, array[v_mod], array[v_per], 'CA');
  insert into public.brand_kits (id, project_id) values (v_kit, v_proj);

  insert into public.rendered_assets
    (brand_kit_id, content_hash, archetype_key, palette_key, storage_path,
     width, height, bytes, render_ms)
  values (v_kit, v_hash, 'single_statement', 'sage', v_kit::text || '/a.png',
          1080, 1350, 40000, 900);

  begin
    insert into public.rendered_assets
      (brand_kit_id, content_hash, archetype_key, palette_key, storage_path,
       width, height, bytes, render_ms)
    values (v_kit, v_hash, 'single_statement', 'sage', v_kit::text || '/b.png',
            1080, 1350, 40000, 900);
    raise exception 'le même contenu a été rendu deux fois pour le même kit.';
  exception when unique_violation then null;
  end;

  -- ---- ⚠ UN CHEMIN QUI NE COMMENCE PAS PAR LE KIT EST REFUSÉ -------------
  -- La policy de storage.objects le lirait comme « pas à elle », et l'image
  -- serait invisible au moment où elle ouvre le post -- pas avant.
  begin
    insert into public.rendered_assets
      (brand_kit_id, content_hash, archetype_key, palette_key, storage_path,
       width, height, bytes, render_ms)
    values (v_kit, repeat('b', 64), 'single_statement', 'sage', 'ailleurs/c.png',
            1080, 1350, 40000, 900);
    raise exception 'un chemin de stockage hors convention a été accepté.';
  exception when check_violation then null;
  end;

  -- ---- un hash qui n'est pas un SHA-256 est refusé -----------------------
  begin
    insert into public.rendered_assets
      (brand_kit_id, content_hash, archetype_key, palette_key, storage_path,
       width, height, bytes, render_ms)
    values (v_kit, 'pas-un-hash', 'single_statement', 'sage', v_kit::text || '/d.png',
            1080, 1350, 40000, 900);
    raise exception 'un content_hash qui n''est pas un SHA-256 a été accepté.';
  exception when check_violation then null;
  end;

  -- ---- ⚠ AUCUNE IMAGE PAYANTE SANS RÉSERVATION DE CRÉDIT ----------------
  begin
    insert into public.custom_visual_generations
      (brand_kit_id, prompt_hash, model, quality, size, storage_path, cost_usd,
       reservation_id)
    values (v_kit, repeat('c', 64), 'gpt-image-2', 'low', '1024x1536',
            v_kit::text || '/v.png', 0.02, null);
    raise exception 'une image payante a été enregistrée sans réservation de crédit.';
  exception when not_null_violation then null;
  end;

  -- Avec une vraie réservation, elle passe -- et une seconde fois, non.
  insert into public.comp_grants (user_id, reason, granted_by, expires_at)
  values (v_user, 'assets guard rail', 'migration 20260920150300', now() + interval '1 day');
  v_res := public.reserve_credit(v_user, 'custom_visual', 'guard rail');
  if not (v_res ->> 'ok')::boolean then
    raise exception 'la réservation du garde-fou a été refusée: %', v_res;
  end if;

  insert into public.custom_visual_generations
    (brand_kit_id, prompt_hash, model, quality, size, storage_path, cost_usd, reservation_id)
  values (v_kit, repeat('c', 64), 'gpt-image-2', 'low', '1024x1536',
          v_kit::text || '/v.png', 0.02, (v_res ->> 'reservation_id')::uuid);

  begin
    insert into public.custom_visual_generations
      (brand_kit_id, prompt_hash, model, quality, size, storage_path, cost_usd, reservation_id)
    values (v_kit, repeat('c', 64), 'gpt-image-2', 'low', '1024x1536',
            v_kit::text || '/w.png', 0.02, (v_res ->> 'reservation_id')::uuid);
    raise exception 'le même prompt a été facturé deux fois pour le même kit.';
  exception when unique_violation then null;
  end;

  -- ---- la qualité est bornée par la ligne --------------------------------
  begin
    insert into public.custom_visual_generations
      (brand_kit_id, prompt_hash, model, quality, size, storage_path, cost_usd, reservation_id)
    values (v_kit, repeat('d', 64), 'gpt-image-2', 'high', '1024x1536',
            v_kit::text || '/x.png', 0.19, (v_res ->> 'reservation_id')::uuid);
    raise exception 'la qualité `high` a été acceptée; une variable mal réglée peut acheter le palier cher.';
  exception when check_violation then null;
  end;

  -- ---- ⚠ LA FENÊTRE DE FOND, LA MÊME QUE CELLE DES SUJETS ---------------
  insert into public.background_library (slug, storage_path, treatment)
  values ('probe_linen_01', 'library/probe_linen_01.jpg', 'linen') returning id into v_bg1;
  insert into public.background_library (slug, storage_path, treatment)
  values ('probe_wash_02', 'library/probe_wash_02.jpg', 'wash') returning id into v_bg2;

  insert into auth.users (id, email) values (v_user2, 'assets2@example.invalid');
  insert into public.projects (id, user_id, name) values (v_proj2, v_user2, 'B');
  insert into public.project_briefs (project_id, modality_ids, client_persona_ids, state)
  values (v_proj2, array[v_mod], array[v_per], 'CA');
  insert into public.brand_kits (id, project_id) values (v_kit2, v_proj2);

  if public.next_background_for_kit(v_kit) is null then
    raise exception 'aucun fond disponible alors que la bibliothèque en porte deux.';
  end if;

  insert into public.background_assignments (brand_kit_id, asset_id) values (v_kit, v_bg1);

  -- Elle ne le reçoit pas deux fois.
  if public.next_background_for_kit(v_kit) = v_bg1 then
    raise exception 'un fond déjà attribué a été reproposé au même kit.';
  end if;

  -- Et la consœur du même État, même modalité, ne le reçoit pas non plus.
  if public.next_background_for_kit(v_kit2) = v_bg1 then
    raise exception 'le même fond a été servi à deux praticiennes de CA pratiquant la même modalité.';
  end if;

  -- Mais elle reçoit bien l'autre : la fenêtre borne un asset, pas la
  -- bibliothèque.
  if public.next_background_for_kit(v_kit2) is distinct from v_bg2 then
    raise exception 'la fenêtre a fermé toute la bibliothèque au lieu d''un seul fond.';
  end if;

  -- ---- la bibliothèque d'illustrations refuse ce qui n'est pas monoline --
  begin
    insert into public.illustration_library (slug, svg)
    values ('probe_circle', '<svg>' || repeat('x', 9000) || '</svg>');
    raise exception 'un SVG de 9 Ko a été accepté comme objet monoline.';
  exception when check_violation then null;
  end;
  begin
    insert into public.illustration_library (slug, svg)
    values ('probe_circle', '<html>not an svg at all here</html>');
    raise exception 'un document qui n''est pas un SVG a été accepté.';
  exception when check_violation then null;
  end;

  -- ---- versionnage : deux versions d'un même slug coexistent -------------
  insert into public.illustration_library (slug, version, svg, archetype_key)
  values ('probe_circle', 1, '<svg viewBox="0 0 10 10"><circle r="4"/></svg>', 'cycle');
  insert into public.illustration_library (slug, version, svg, archetype_key)
  values ('probe_circle', 2, '<svg viewBox="0 0 10 10"><circle r="5"/></svg>', 'cycle');
  select count(*) into v_n from public.illustration_library where slug = 'probe_circle';
  if v_n <> 2 then
    raise exception 'deux versions d''un même objet ne coexistent pas (% ligne(s))', v_n;
  end if;

  -- ---- teardown ----------------------------------------------------------
  delete from public.illustration_library where slug = 'probe_circle';
  delete from public.background_library where id in (v_bg1, v_bg2);
  delete from auth.users where id in (v_user, v_user2);
end
$$;


-- ============================================================================
-- DOWN
-- ============================================================================
--   drop policy   if exists "content_assets_storage_select_own_paid" on storage.objects;
--   delete from storage.buckets where id = 'content-assets';
--   drop function if exists public.next_background_for_kit(uuid);
--   drop table    if exists public.background_assignments;
--   drop table    if exists public.background_library;
--   drop table    if exists public.illustration_library;
--   drop table    if exists public.custom_visual_generations;
--   drop table    if exists public.rendered_assets;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260920150300', 'rendered_assets_and_libraries');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260920160000_a_diagram_label_is_published_text.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — un label de diagramme est du texte publié, comme la caption
-- ============================================================================
-- ⚠ LE TROU QUE `DIAGNOSTIC.md` §3.2 A MESURÉ, ET IL EST RÉEL.
--
-- `20260914084054_the_guard_moves_into_the_write` a posé la garde
-- déontologique DANS l'écriture, par trigger, sur `site_specs`,
-- `content_items` et `directory_profiles`. Son commentaire de table dit
-- pourquoi : « a scan that runs only in the application does not cover text
-- written straight through a RPC ».
--
-- Le chantier Content introduit une quatrième surface de texte publié —
-- `content_topics.payload`, qui porte les labels et les gloses imprimés DANS
-- le diagramme — et aucun de ces trois triggers ne la couvre. Un label
-- « Guaranteed relief » écrit dans un payload atteindrait le rendu, le PNG,
-- et le feed d'une praticienne sans passer sous aucune garde.
--
-- Ce n'est pas hypothétique au sens où il faudrait imaginer un chemin : le
-- pipeline de rédaction écrit ces payloads, et c'est un modèle qui les écrit.
--
-- ── POURQUOI LE PAYLOAD DEMANDE UNE FONCTION ────────────────────────────
--
-- `ethics_blocks(text)` prend du texte. Un payload est un objet dont la forme
-- dépend de l'archétype : `statement` ici, `items[].label` là, `cards[].
-- payload.nodes[].gloss` deux niveaux plus bas. Écrire onze extractions, une
-- par archétype, donnerait onze occasions d'en oublier une — et celle qu'on
-- oublie est exactement celle qui passe.
--
-- `content_topic_text` aplatit donc TOUTE chaîne de caractères du jsonb,
-- récursivement, sans rien savoir des archétypes. Un douzième archétype ajouté
-- demain est couvert le jour où il est ajouté, sans que personne y pense.
-- ============================================================================


-- ============================================================================
-- 1. content_topic_text — toute chaîne du payload, aplatie
-- ============================================================================
create or replace function public.content_topic_text(p jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  -- ⚠ RÉCURSIF ET AVEUGLE À LA FORME. Il ne connaît ni les onze archétypes ni
  -- leurs clefs : il descend dans tout objet et tout tableau, et rend chaque
  -- feuille de type `string`. Une extraction par archétype serait onze
  -- occasions d'en oublier une, et celle qu'on oublie est celle qui passe.
  with recursive leaves(value) as (
    select coalesce(p, 'null'::jsonb)
    union all
    select child.value
      from leaves l
     cross join lateral (
       /*
        * ⚠ LE `case` EST DANS L'ARGUMENT, PAS DANS UN `where`.
        *
        * `jsonb_each` sur un tableau LÈVE, et `jsonb_array_elements` sur un
        * objet aussi. Une fonction qui rend un ensemble est évaluée AVANT le
        * filtre qui devait l'éviter — la première version l'apprenait à
        * l'exécution, avec « cannot extract elements from an object ».
        *
        * Passer un objet vide ou un tableau vide à la branche qui ne
        * s'applique pas rend l'appel toujours légal et l'ensemble vide.
        */
       select value from jsonb_each(
                case when jsonb_typeof(l.value) = 'object' then l.value else '{}'::jsonb end)
       union all
       select value from jsonb_array_elements(
                case when jsonb_typeof(l.value) = 'array' then l.value else '[]'::jsonb end)
     ) as child(value)
  )
  select coalesce(string_agg(value #>> '{}', E'\n'), '')
    from leaves
   where jsonb_typeof(value) = 'string'
$$;

comment on function public.content_topic_text(jsonb) is
  'Every string leaf of a topic payload, newline-joined, for the ethics scanners. Recursive and shape-blind on purpose: it knows nothing about the eleven archetypes, so a twelfth is covered the day it is added rather than the day somebody remembers to extend this.';

revoke all on function public.content_topic_text(jsonb) from public, anon;
grant execute on function public.content_topic_text(jsonb) to authenticated, service_role;


-- ============================================================================
-- 2. Le trigger — la même forme que les trois autres
-- ============================================================================
create or replace function public.content_topics_ethics_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_block text;
  v_text  text;
begin
  -- ⚠ `ethics_blocks` REND LE PASSAGE FAUTIF, PAS UN BOOLÉEN. Lu comme un
  -- booléen il lève « invalid input syntax for type boolean: "Heal your
  -- anxiety" » — ce qui refuse bien la ligne, mais pour la mauvaise raison et
  -- avec un message que personne ne peut agir. La forme ci-dessous est celle
  -- de `content_items_ethics_gate`, reprise telle quelle.
  --
  -- ⚠ ET LE PAYLOAD EST SCANNÉ AUTANT QUE LA CAPTION. Le titre et le hook sont
  -- internes, mais ils nourrissent la rédaction : une promesse de résultat
  -- dans un titre finit dans la caption qu'on en tire.
  foreach v_text in array array[
    new.title,
    new.hook,
    new.caption_seed,
    new.rationale_template,
    public.content_topic_text(new.payload)
  ]
  loop
    v_block := public.ethics_blocks(v_text);
    if v_block is not null then
      raise exception 'Advertising ethics: %', v_block
        using errcode = 'check_violation',
              hint = 'That phrasing can put a licence at risk. Rewrite it as a description of the work.';
    end if;
  end loop;

  return new;
end
$$;

comment on function public.content_topics_ethics_gate() is
  'The fourth published-text surface, joining site_specs, content_items and directory_profiles. Scans the caption seed AND every string inside the payload -- a diagram label is published text in exactly the way a caption is, and until this trigger nothing checked one.';

revoke all on function public.content_topics_ethics_gate() from public, anon, authenticated;

drop trigger if exists content_topics_ethics_gate on public.content_topics;
create trigger content_topics_ethics_gate
  before insert or update on public.content_topics
  for each row execute function public.content_topics_ethics_gate();


-- ============================================================================
-- 3. banned_phrases sur la même surface
-- ============================================================================
-- `ethics_blocks` couvre les motifs déontologiques (`ethics_patterns`). Les
-- trente-deux formulations littérales de `banned_phrases` sont une AUTRE
-- liste, et `usp_banned_phrases_check` est l'oracle qui la lit sans la fuiter.
--
-- ⚠ ON NE RECOPIE PAS LA LISTE. Elle a bougé deux fois cette semaine
-- (DIAGNOSTIC.md §0.1), et une copie TypeScript en aurait trente là où la
-- production en a trente-deux.

create or replace function public.content_topics_banned_phrases_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_text text;
  v_hits text[];
begin
  v_text := concat_ws(E'\n',
    new.caption_seed,
    public.content_topic_text(new.payload)
  );

  -- ⚠ L'ORACLE REND UN `text[]` DES PHRASES TROUVÉES. Il ne rend pas la liste
  -- complète, et c'est pour ça qu'il existe : `banned_phrases` est
  -- service_role only précisément pour que la liste ne fuite jamais.
  v_hits := public.usp_banned_phrases_check(v_text);

  if coalesce(array_length(v_hits, 1), 0) > 0 then
    raise exception 'Banned phrasing: %', v_hits[1]
      using errcode = 'check_violation',
            hint = 'That formulation is on the banned list. Say what the work is instead.';
  end if;

  return new;
end
$$;

comment on function public.content_topics_banned_phrases_gate() is
  'The thirty-odd literal formulations, checked on the caption seed and on every diagram label. Calls usp_banned_phrases_check rather than reading banned_phrases: the table is service_role only precisely so the list is never copied, and it gained two entries this week.';

revoke all on function public.content_topics_banned_phrases_gate() from public, anon, authenticated;

drop trigger if exists content_topics_banned_phrases_gate on public.content_topics;
create trigger content_topics_banned_phrases_gate
  before insert or update on public.content_topics
  for each row execute function public.content_topics_banned_phrases_gate();


-- ============================================================================
-- Guard rails
-- ============================================================================
do $$
declare
  v_seg  uuid;
  v_mod  text;
  v_per  text;
  v_rule record;
  v_n    integer;
begin
  -- ---- l'aplatissement voit tout, y compris deux niveaux plus bas ---------
  if public.content_topic_text('{"a":"one","b":{"c":"two"},"d":[{"e":"three"}]}'::jsonb)
     not like '%one%' then
    raise exception 'content_topic_text a perdu une chaîne de premier niveau.';
  end if;
  if public.content_topic_text('{"a":"one","b":{"c":"two"},"d":[{"e":"three"}]}'::jsonb)
     not like '%two%' then
    raise exception 'content_topic_text a perdu une chaîne imbriquée.';
  end if;
  if public.content_topic_text('{"a":"one","b":{"c":"two"},"d":[{"e":"three"}]}'::jsonb)
     not like '%three%' then
    raise exception 'content_topic_text a perdu une chaîne dans un tableau d''objets.';
  end if;
  -- Un carrousel imbrique un payload dans un payload. C'est le cas le plus
  -- profond que le schéma autorise, et c'est celui qu'une extraction écrite à
  -- la main oublie.
  if public.content_topic_text(
       '{"cards":[{"archetype_key":"cycle","payload":{"nodes":[{"label":"deep","gloss":"g"}]}}]}'::jsonb
     ) not like '%deep%' then
    raise exception 'content_topic_text ne descend pas dans un carrousel.';
  end if;
  if public.content_topic_text(null) <> '' then
    raise exception 'content_topic_text(null) ne rend pas une chaîne vide.';
  end if;

  -- ---- ⚠ LA GARDE MORD SUR UN LABEL, PAS SEULEMENT SUR UNE CAPTION -------
  select id into v_mod from public.modality_cards where active order by sort_order limit 1;
  select id into v_per from public.client_persona_cards where active order by sort_order limit 1;
  insert into public.content_segments (modality_id, persona_id) values (v_mod, v_per)
  returning id into v_seg;

  -- Chacune des six règles porte, dans `ethics_rules`, l'exemple de ce qu'elle
  -- interdit. On les pose une à une DANS UN LABEL — la surface qui n'était
  -- gardée par rien.
  for v_rule in
    select example_forbidden from public.ethics_rules
     where active and example_forbidden is not null
  loop
    begin
      insert into public.content_topics
        (segment_id, archetype_key, intent, title, hook, payload, caption_seed,
         rationale_template)
      values (v_seg, 'single_statement', 'educate', 'A title', 'A hook',
              jsonb_build_object('statement', v_rule.example_forbidden),
              'A caption', 'Because.');
      raise exception 'la garde déontologique a laissé passer « % » dans un payload.',
        left(v_rule.example_forbidden, 60);
    exception when check_violation then null;
    end;
  end loop;

  -- ---- et elle laisse passer ce qui est acceptable ------------------------
  insert into public.content_topics
    (segment_id, archetype_key, intent, title, hook, payload, caption_seed,
     rationale_template)
  values (v_seg, 'single_statement', 'normalise', 'Rest is not earned', 'A hook',
          '{"statement":"Rest is not a reward you earn after everything else is done"}'::jsonb,
          'Rest is not a reward.', 'Because it keeps coming up.');

  select count(*) into v_n from public.content_topics where segment_id = v_seg;
  if v_n <> 1 then
    raise exception 'un sujet acceptable a été refusé (% écrits)', v_n;
  end if;

  -- ---- teardown ----------------------------------------------------------
  delete from public.content_segments where id = v_seg;
end
$$;


-- ============================================================================
-- DOWN
-- ============================================================================
--   drop trigger  if exists content_topics_banned_phrases_gate on public.content_topics;
--   drop function if exists public.content_topics_banned_phrases_gate();
--   drop trigger  if exists content_topics_ethics_gate on public.content_topics;
--   drop function if exists public.content_topics_ethics_gate();
--   drop function if exists public.content_topic_text(jsonb);
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260920160000', 'a_diagram_label_is_published_text');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260920160100_render_dedup_and_cost_report.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — écrire un rendu une seule fois, et savoir ce qu'un mois a coûté
-- ============================================================================
-- Deux RPC que le pipeline appelle, et une vue que la preuve de coût lit.
--
-- ⚠ LA DÉDUPLICATION EST DANS LE RPC, PAS DANS L'APPELANT. `rendered_assets`
-- porte déjà `unique (brand_kit_id, content_hash)` — mais une contrainte
-- d'unicité refuse un doublon en LEVANT, et un appelant qui reçoit une
-- exception a déjà dépensé la seconde de rendu qu'elle devait éviter.
--
-- Le RPC répond « voici le chemin » dans les deux cas. C'est la différence
-- entre « on ne stocke pas deux fois » et « on ne REND pas deux fois », et
-- seule la seconde est ce que le chantier demande.
-- ============================================================================


-- ============================================================================
-- 1. rendered_asset_path — la question posée AVANT de rendre
-- ============================================================================
create or replace function public.rendered_asset_path(
  p_brand_kit_id uuid,
  p_content_hash text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ra.storage_path
    from public.rendered_assets ra
   where ra.brand_kit_id = p_brand_kit_id
     and ra.content_hash = p_content_hash
$$;

comment on function public.rendered_asset_path(uuid, text) is
  'The stored path for this (kit, content hash), or NULL. THE call the pipeline makes before rendering anything: a hit means the second of Satori and resvg is never spent. NULL means render.';

revoke all on function public.rendered_asset_path(uuid, text) from public, anon, authenticated;
grant execute on function public.rendered_asset_path(uuid, text) to service_role;


-- ============================================================================
-- 2. record_rendered_asset — idempotent, et il rend le chemin qui gagne
-- ============================================================================
create or replace function public.record_rendered_asset(
  p_brand_kit_id  uuid,
  p_content_hash  text,
  p_archetype_key text,
  p_palette_key   text,
  p_storage_path  text,
  p_width         integer,
  p_height        integer,
  p_bytes         integer,
  p_render_ms     integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing text;
begin
  v_existing := public.rendered_asset_path(p_brand_kit_id, p_content_hash);
  if v_existing is not null then
    -- ⚠ LE CHEMIN EXISTANT, PAS CELUI QU'ON PROPOSAIT. Deux rendus du même
    -- contenu produisent le même SVG à l'octet près (c'est la suite de
    -- déterminisme qui le tient), donc les deux chemins sont interchangeables
    -- — mais un seul objet existe dans le bucket, et c'est celui-là.
    return jsonb_build_object('ok', true, 'reason', 'cached', 'storage_path', v_existing);
  end if;

  insert into public.rendered_assets
    (brand_kit_id, content_hash, archetype_key, palette_key, storage_path,
     width, height, bytes, render_ms)
  values (p_brand_kit_id, p_content_hash, p_archetype_key, p_palette_key, p_storage_path,
          p_width, p_height, p_bytes, p_render_ms)
  on conflict (brand_kit_id, content_hash) do nothing;

  -- Une course perdue rend le chemin du gagnant. `on conflict do nothing`
  -- plutôt que `do update` : le premier rendu est aussi bon que le second et
  -- il est déjà dans le bucket.
  return jsonb_build_object(
    'ok', true,
    'reason', case when found then 'rendered' else 'cached' end,
    'storage_path', public.rendered_asset_path(p_brand_kit_id, p_content_hash)
  );
end
$$;

comment on function public.record_rendered_asset(uuid, text, text, text, text, integer, integer, integer, integer) is
  'Records a render, or reports the one already there. Idempotent by answer rather than by exception: a unique violation would arrive after the second the render already cost. Returns {ok, reason: rendered|cached, storage_path}.';

revoke all on function public.record_rendered_asset(uuid, text, text, text, text, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.record_rendered_asset(uuid, text, text, text, text, integer, integer, integer, integer)
  to service_role;


-- ============================================================================
-- 3. record_custom_visual — le seul chemin qui dépense, et il paie une fois
-- ============================================================================
create or replace function public.record_custom_visual(
  p_brand_kit_id    uuid,
  p_prompt_hash     text,
  p_content_item_id uuid,
  p_model           text,
  p_quality         text,
  p_size            text,
  p_storage_path    text,
  p_cost_usd        numeric,
  p_reservation_id  uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing text;
begin
  select storage_path into v_existing
    from public.custom_visual_generations
   where brand_kit_id = p_brand_kit_id and prompt_hash = p_prompt_hash;

  if v_existing is not null then
    -- ⚠ ET LA RÉSERVATION EST RELÂCHÉE. Un prompt déjà généré ne coûte rien,
    -- donc le crédit qui avait été réservé pour lui revient. Sans cette ligne,
    -- la déduplication économiserait l'appel d'API et dépenserait quand même
    -- le crédit — ce qui est la moitié de la promesse.
    perform public.settle_credit(p_reservation_id, null, false);
    return jsonb_build_object('ok', true, 'reason', 'cached', 'storage_path', v_existing);
  end if;

  insert into public.custom_visual_generations
    (brand_kit_id, prompt_hash, content_item_id, model, quality, size,
     storage_path, cost_usd, reservation_id)
  values (p_brand_kit_id, p_prompt_hash, p_content_item_id, p_model, p_quality, p_size,
          p_storage_path, p_cost_usd, p_reservation_id)
  on conflict (brand_kit_id, prompt_hash) do nothing;

  if not found then
    perform public.settle_credit(p_reservation_id, null, false);
    select storage_path into v_existing
      from public.custom_visual_generations
     where brand_kit_id = p_brand_kit_id and prompt_hash = p_prompt_hash;
    return jsonb_build_object('ok', true, 'reason', 'cached', 'storage_path', v_existing);
  end if;

  perform public.settle_credit(p_reservation_id, p_cost_usd, true);
  return jsonb_build_object('ok', true, 'reason', 'generated', 'storage_path', p_storage_path);
end
$$;

comment on function public.record_custom_visual(uuid, text, uuid, text, text, text, text, numeric, uuid) is
  'Records a paid image and settles its credit, or reports the one already there AND RELEASES the credit. Without that release, dedup would save the API call and spend the credit anyway -- half a promise.';

revoke all on function public.record_custom_visual(uuid, text, uuid, text, text, text, text, numeric, uuid)
  from public, anon, authenticated;
grant execute on function public.record_custom_visual(uuid, text, uuid, text, text, text, text, numeric, uuid)
  to service_role;


-- ============================================================================
-- 4. content_month_cost — la preuve de coût, ventilée par poste
-- ============================================================================
-- ⚠ LIT `credit_ledger`, PAS UNE ESTIMATION. Le ledger porte l'estimé et le
-- réel dans deux colonnes distinctes précisément pour que l'écart entre ce
-- qu'on croyait dépenser et ce qu'on a dépensé soit un nombre qu'on peut
-- regarder, plutôt qu'une question à laquelle personne ne peut répondre.

create or replace function public.content_month_cost(p_user uuid, p_month date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(
      kind,
      jsonb_build_object(
        'reservations',  reservations,
        'settlements',   settlements,
        'releases',      releases,
        'consumed',      consumed,
        'estimated_usd', estimated_usd,
        'actual_usd',    actual_usd
      )
    ),
    '{}'::jsonb
  )
  from (
    select l.kind,
           count(*) filter (where l.entry_type = 'reservation') as reservations,
           count(*) filter (where l.entry_type = 'settlement')  as settlements,
           count(*) filter (where l.entry_type = 'release')     as releases,
           -sum(l.delta)                                        as consumed,
           coalesce(sum(l.estimated_cost_usd), 0)               as estimated_usd,
           coalesce(sum(l.actual_cost_usd), 0)                  as actual_usd
      from public.credit_ledger l
     where l.user_id = p_user
       and l.month = date_trunc('month', p_month)::date
     group by l.kind
  ) per_kind
$$;

comment on function public.content_month_cost(uuid, date) is
  'What one month actually cost this user, per kind, read from credit_ledger. Estimated and actual are separate numbers on purpose: the gap between what we expected to spend and what we spent is the only way to tell a pricing assumption from a measurement.';

revoke all on function public.content_month_cost(uuid, date) from public, anon, authenticated;
grant execute on function public.content_month_cost(uuid, date) to service_role;


-- ============================================================================
-- Guard rails
-- ============================================================================
do $$
declare
  v_user uuid := gen_random_uuid();
  v_proj uuid := gen_random_uuid();
  v_kit  uuid := gen_random_uuid();
  v_hash text := repeat('e', 64);
  v_res  jsonb;
  v_r1   jsonb;
  v_r2   jsonb;
  v_n    integer;
  v_mod  text;
  v_per  text;
  fn     text;
begin
  foreach fn in array array[
    'rendered_asset_path(uuid,text)',
    'record_rendered_asset(uuid,text,text,text,text,integer,integer,integer,integer)',
    'record_custom_visual(uuid,text,uuid,text,text,text,text,numeric,uuid)',
    'content_month_cost(uuid,date)'
  ] loop
    if has_function_privilege('authenticated', ('public.' || fn)::regprocedure, 'EXECUTE') then
      raise exception 'authenticated peut exécuter %', fn;
    end if;
  end loop;

  select id into v_mod from public.modality_cards where active order by sort_order limit 1;
  select id into v_per from public.client_persona_cards where active order by sort_order limit 1;

  insert into auth.users (id, email) values (v_user, 'dedup@example.invalid');
  insert into public.projects (id, user_id, name) values (v_proj, v_user, 'D');
  insert into public.project_briefs (project_id, modality_ids, client_persona_ids, state)
  values (v_proj, array[v_mod], array[v_per], 'CA');
  insert into public.brand_kits (id, project_id) values (v_kit, v_proj);
  insert into public.comp_grants (user_id, reason, granted_by, expires_at)
  values (v_user, 'dedup guard rail', 'migration 20260920160100', now() + interval '1 day');

  -- ---- ⚠ PREUVE DE DÉDUPLICATION : deux rendus, UN enregistrement --------
  v_r1 := public.record_rendered_asset(v_kit, v_hash, 'single_statement', 'sage',
                                       v_kit::text || '/first.png', 1080, 1350, 40000, 900);
  v_r2 := public.record_rendered_asset(v_kit, v_hash, 'single_statement', 'sage',
                                       v_kit::text || '/second.png', 1080, 1350, 40000, 12);

  if (v_r1 ->> 'reason') <> 'rendered' then
    raise exception 'le premier rendu n''a pas été enregistré: %', v_r1;
  end if;
  if (v_r2 ->> 'reason') <> 'cached' then
    raise exception 'le second rendu du même contenu a été enregistré à nouveau: %', v_r2;
  end if;
  if (v_r2 ->> 'storage_path') <> (v_r1 ->> 'storage_path') then
    raise exception 'le second appel a rendu un chemin différent du premier.';
  end if;

  select count(*) into v_n from public.rendered_assets where brand_kit_id = v_kit;
  if v_n <> 1 then
    raise exception 'deux rendus du même contenu ont produit % enregistrements', v_n;
  end if;

  -- Un contenu DIFFÉRENT produit bien un second asset: la déduplication
  -- n'écrase pas, elle distingue.
  v_r1 := public.record_rendered_asset(v_kit, repeat('f', 64), 'single_statement', 'sage',
                                       v_kit::text || '/third.png', 1080, 1350, 40000, 900);
  if (v_r1 ->> 'reason') <> 'rendered' then
    raise exception 'un contenu différent a été pris pour un doublon.';
  end if;

  -- ---- ⚠ ET UN PROMPT DÉJÀ GÉNÉRÉ REND SON CRÉDIT -----------------------
  v_res := public.reserve_credit(v_user, 'custom_visual', 'first image');
  v_r1 := public.record_custom_visual(v_kit, repeat('a', 64), null, 'gpt-image-2', 'low',
                                      '1024x1536', v_kit::text || '/v1.png', 0.02,
                                      (v_res ->> 'reservation_id')::uuid);
  if (v_r1 ->> 'reason') <> 'generated' then
    raise exception 'la première image n''a pas été générée: %', v_r1;
  end if;

  v_res := public.reserve_credit(v_user, 'custom_visual', 'the same image again');
  v_r2 := public.record_custom_visual(v_kit, repeat('a', 64), null, 'gpt-image-2', 'low',
                                      '1024x1536', v_kit::text || '/v2.png', 0.02,
                                      (v_res ->> 'reservation_id')::uuid);
  if (v_r2 ->> 'reason') <> 'cached' then
    raise exception 'le même prompt a été regénéré: %', v_r2;
  end if;

  -- Un seul crédit consommé sur les deux demandes.
  select consumed into v_n from public.credit_balances
   where user_id = v_user and kind = 'custom_visual'
     and month = date_trunc('month', now())::date;
  if v_n <> 1 then
    raise exception 'deux demandes du même prompt ont consommé % crédits, attendu 1', v_n;
  end if;

  -- ---- la preuve de coût lit bien le ledger ------------------------------
  if (public.content_month_cost(v_user, now()::date) #>> '{custom_visual,actual_usd}')::numeric
     <> 0.02 then
    raise exception 'content_month_cost ne rapporte pas le coût réel: %',
      public.content_month_cost(v_user, now()::date);
  end if;

  delete from auth.users where id = v_user;
end
$$;


-- ============================================================================
-- DOWN
-- ============================================================================
--   drop function if exists public.content_month_cost(uuid, date);
--   drop function if exists public.record_custom_visual(uuid,text,uuid,text,text,text,text,numeric,uuid);
--   drop function if exists public.record_rendered_asset(uuid,text,text,text,text,integer,integer,integer,integer);
--   drop function if exists public.rendered_asset_path(uuid, text);
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260920160100', 'render_dedup_and_cost_report');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260920170000_the_collision_window_is_computed_once.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — la fenêtre anti-collision se calcule UNE fois, pas par sujet
-- ============================================================================
-- ⚠ UN DÉFAUT TROUVÉ PAR LA VÉRIFICATION 6.4, ET PAR RIEN D'AUTRE.
--
-- `next_topic_for_kit` (20260920150100) exprimait la fenêtre de 90 jours comme
-- un `not exists` CORRÉLÉ : pour chaque sujet candidat, une sous-requête qui
-- joint `topic_assignments`, `brand_kits`, `projects` et `project_briefs`.
--
-- C'est correct, et tous les garde-fous passaient : ils tournent sur deux ou
-- trois sujets. La simulation de la PHASE 6 tourne sur cent praticiennes,
-- douze mois, trente publications — 36 000 appels contre une banque de 7 500
-- sujets. À ce volume, la sous-requête corrélée s'exécute environ 270 millions
-- de fois, et la simulation ne termine pas.
--
-- ── CE QUE ÇA VEUT DIRE POUR LA PRODUCTION ──────────────────────────────
--
-- Le cron mensuel appelle ce RPC trente fois par abonnée, en série, dans les
-- 300 secondes que Vercel accorde. L'ancienne forme y tenait pour les
-- premières abonnées et cessait d'y tenir à mesure que la banque grandissait —
-- c'est-à-dire que le mois se serait mis à échouer un jour, sans qu'aucun
-- changement de code l'explique.
--
-- ── LA CORRECTION ───────────────────────────────────────────────────────
--
-- La fenêtre ne dépend pas du sujet candidat : c'est l'ensemble des sujets
-- servis récemment aux praticiennes du même (État, modalité). Calculé une fois
-- dans un CTE, il devient une anti-jointure au lieu d'une sous-requête par
-- ligne.
--
-- ⚠ LA SÉMANTIQUE EST INCHANGÉE, ET C'EST LA CONDITION. Le tri, les bornes,
-- l'exclusion à vie, la dégradation vers les voisins : identiques au token
-- près. Une optimisation qui change aussi le classement n'est pas une
-- optimisation, c'est un autre produit.
-- ============================================================================

create or replace function public.next_topic_for_kit(
  p_brand_kit_id uuid,
  p_month        date,
  p_archetype    text default null
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with kit as (
    select coalesce(pb.modality_ids, '{}')       as modalities,
           coalesce(pb.client_persona_ids, '{}') as personas,
           upper(nullif(btrim(coalesce(pb.state, '')), '')) as state_code,
           pr.user_id                            as user_id
      from public.brand_kits bk
      join public.projects      pr on pr.id = bk.project_id
      left join public.project_briefs pb on pb.project_id = pr.id
     where bk.id = p_brand_kit_id
  ),
  /*
   * ⚠ LES SUJETS BLOQUÉS PAR LA FENÊTRE, CALCULÉS UNE SEULE FOIS.
   *
   * Cet ensemble ne dépend pas du sujet candidat — il dépend de la praticienne
   * et de l'horloge. Écrit comme un `not exists` corrélé il était recalculé
   * pour chacun des 7 500 sujets de la banque, à chacun des 30 appels du mois,
   * pour chacune des abonnées.
   */
  blocked as (
    select distinct ta.topic_id
      from public.topic_assignments ta
      join public.brand_kits   obk on obk.id = ta.brand_kit_id
      join public.projects     opr on opr.id = obk.project_id
      left join public.project_briefs opb on opb.project_id = opr.id
     cross join kit k
     where ta.assigned_at > now() - public.topic_collision_window()
       and opr.user_id is distinct from k.user_id
       and k.state_code is not null
       and upper(nullif(btrim(coalesce(opb.state, '')), '')) = k.state_code
       and coalesce(opb.modality_ids, '{}') && k.modalities
  ),
  mine as (
    select ta.topic_id from public.topic_assignments ta
     where ta.brand_kit_id = p_brand_kit_id
  )
  select t.id
    from public.content_topics t
    join public.content_segments s on s.id = t.segment_id
   cross join kit k
   where t.ethics_reviewed_at is not null
     and (t.expires_at is null or t.expires_at > now())
     and (p_archetype is null or t.archetype_key = p_archetype)
     and not exists (select 1 from mine m where m.topic_id = t.id)
     and not exists (select 1 from blocked b where b.topic_id = t.id)
     and (s.modality_id = any (k.modalities) or s.persona_id = any (k.personas))
     and (s.state_code is null or s.state_code = k.state_code)
   order by
     (case when s.modality_id = any (k.modalities) then 2 else 0 end)
     + (case when s.persona_id = any (k.personas) then 2 else 0 end)
     + (case when s.state_code is not null then 1 else 0 end)
     + (case when t.timely then 3 else 0 end)
     desc,
     t.created_at desc,
     t.id
   limit 1
$$;

comment on function public.next_topic_for_kit(uuid, date, text) is
  'The next topic for this kit, or NULL when the bank has nothing eligible left. A QUERY: no model call, therefore free and instant -- this is what Swap runs on. The 90-day window is computed ONCE per call rather than per candidate topic; as a correlated subquery it ran ~270 million times in the phase 6 simulation and never finished. Degradation towards neighbouring segments is a single ranking rather than a ladder of fallbacks, and the sort ends on t.id so that two calls against the same bank state return the same topic.';

revoke all on function public.next_topic_for_kit(uuid, date, text) from public, anon, authenticated;
grant execute on function public.next_topic_for_kit(uuid, date, text) to service_role;


-- ============================================================================
-- Les index que cette forme veut
-- ============================================================================
-- ⚠ `assigned_at` SEUL, ET PAS `(topic_id, assigned_at)`. Le CTE `blocked`
-- part de la FENÊTRE — les attributions des 90 derniers jours, tous sujets
-- confondus — et remonte vers les praticiennes. L'index existant
-- `topic_assignments_topic_idx (topic_id, assigned_at desc)` servait la forme
-- corrélée, qui partait d'un sujet ; il ne sert plus le chemin qu'on prend.
create index if not exists topic_assignments_assigned_at_idx
  on public.topic_assignments (assigned_at desc);

-- L'anti-jointure « déjà servi à CE kit » part du kit.
create index if not exists topic_assignments_kit_topic_idx
  on public.topic_assignments (brand_kit_id, topic_id);


-- ============================================================================
-- Guard rails
-- ============================================================================
-- ⚠ LA SÉMANTIQUE, PAS LA VITESSE. Une optimisation se garde par ce qu'elle
-- n'a PAS changé ; la vitesse est mesurée par la simulation de la phase 6, qui
-- est le seul endroit où elle est mesurable.
do $$
declare
  v_mod  text; v_mod2 text; v_per text;
  v_u1 uuid := gen_random_uuid(); v_u2 uuid := gen_random_uuid();
  v_p1 uuid := gen_random_uuid(); v_p2 uuid := gen_random_uuid();
  v_k1 uuid := gen_random_uuid(); v_k2 uuid := gen_random_uuid();
  v_seg uuid; v_t uuid;
  v_month date := date_trunc('month', now())::date;
begin
  select id into v_mod  from public.modality_cards where active order by sort_order limit 1;
  select id into v_mod2 from public.modality_cards where active and id <> v_mod
   order by sort_order limit 1;
  select id into v_per  from public.client_persona_cards where active order by sort_order limit 1;

  insert into auth.users (id, email) values
    (v_u1, 'reopt-1@example.invalid'), (v_u2, 'reopt-2@example.invalid');
  insert into public.projects (id, user_id, name) values (v_p1, v_u1, 'A'), (v_p2, v_u2, 'B');
  insert into public.project_briefs (project_id, modality_ids, client_persona_ids, state)
  values (v_p1, array[v_mod], array[v_per], 'CA'),
         (v_p2, array[v_mod], array[v_per], 'CA');
  insert into public.brand_kits (id, project_id) values (v_k1, v_p1), (v_k2, v_p2);

  insert into public.content_segments (modality_id, persona_id) values (v_mod, v_per)
  returning id into v_seg;
  insert into public.content_topics
    (segment_id, archetype_key, intent, title, hook, payload, caption_seed,
     rationale_template, ethics_reviewed_at)
  values (v_seg, 'single_statement', 'normalise', 'A topic', 'A hook',
          '{"statement":"Rest is not a reward you earn after everything else is done"}'::jsonb,
          'seed', 'Because.', now())
  returning id into v_t;

  -- Trouvé
  if public.next_topic_for_kit(v_k1, v_month) is distinct from v_t then
    raise exception 'la forme optimisée ne trouve plus le seul sujet éligible.';
  end if;

  -- Déterministe
  if public.next_topic_for_kit(v_k1, v_month)
     is distinct from public.next_topic_for_kit(v_k1, v_month) then
    raise exception 'la forme optimisée n''est plus déterministe.';
  end if;

  perform public.assign_topic_to_kit(v_k1, v_month);

  -- À vie
  if public.next_topic_for_kit(v_k1, v_month) is not null then
    raise exception 'la forme optimisée reproposerait un sujet déjà attribué.';
  end if;
  if public.next_topic_for_kit(v_k1, (v_month + interval '5 months')::date) is not null then
    raise exception 'la forme optimisée reproposerait un sujet dans un autre mois.';
  end if;

  -- La fenêtre inter-praticiennes
  if public.next_topic_for_kit(v_k2, v_month) is not null then
    raise exception 'la forme optimisée a perdu la fenêtre de 90 jours.';
  end if;

  -- Et elle ne bloque ni un autre État ni une autre modalité
  update public.project_briefs set state = 'FL' where project_id = v_p2;
  if public.next_topic_for_kit(v_k2, v_month) is distinct from v_t then
    raise exception 'la forme optimisée bloque une praticienne d''un autre État.';
  end if;
  update public.project_briefs set state = 'CA', modality_ids = array[v_mod2]
   where project_id = v_p2;
  if public.next_topic_for_kit(v_k2, v_month) is distinct from v_t then
    raise exception 'la forme optimisée bloque une praticienne d''une autre modalité.';
  end if;

  delete from public.content_segments where id = v_seg;
  delete from auth.users where id in (v_u1, v_u2);
end
$$;


-- ============================================================================
-- DOWN
-- ============================================================================
--   drop index if exists public.topic_assignments_kit_topic_idx;
--   drop index if exists public.topic_assignments_assigned_at_idx;
--   -- restore next_topic_for_kit from 20260920150100 (the correlated form).
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260920170000', 'the_collision_window_is_computed_once');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260920180000_a_cte_referenced_once_is_inlined.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — `as materialized`, ou l'optimisation qui n'en était pas une
-- ============================================================================
-- ⚠ `20260920170000` A DÉPLACÉ LA FENÊTRE DANS UN CTE ET N'A RIEN CHANGÉ.
--
-- Depuis PostgreSQL 12, un CTE référencé UNE SEULE FOIS est INLINÉ : le
-- planificateur le recopie à l'endroit où il est lu et pousse la corrélation
-- dedans. `blocked` est lu une fois, dans un `not exists` corrélé sur
-- `t.id` — il redevenait donc mot pour mot la sous-requête corrélée que la
-- migration précédente croyait avoir retirée.
--
-- La mesure le disait et je ne l'ai pas lue tout de suite : le coût par
-- attribution CROISSAIT avec la table (6 ms à vide, 60 ms à 9 000
-- attributions, 127 ms à 18 000). Un coût constant par appel aurait été le
-- signe que le CTE tenait ; un coût qui suit la taille de la table est le
-- signe qu'on la rescanne à chaque candidat.
--
-- `as materialized` est la barrière d'optimisation qui dit au planificateur de
-- calculer l'ensemble une fois. C'est un mot, et c'est tout l'écart entre les
-- deux formes.
--
-- ── CE QUE ÇA APPREND SUR LA PREMIÈRE CORRECTION ────────────────────────
--
-- Elle était juste sur le fond et sans effet dans les faits, et le garde-fou
-- ne pouvait pas le voir : il éprouve la SÉMANTIQUE, qui n'avait pas changé.
-- Seule une mesure à l'échelle pouvait trancher, et c'est exactement ce que la
-- vérification 6.4 est. Une optimisation qu'aucune mesure n'accompagne est une
-- intention.
-- ============================================================================

create or replace function public.next_topic_for_kit(
  p_brand_kit_id uuid,
  p_month        date,
  p_archetype    text default null
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with kit as materialized (
    select coalesce(pb.modality_ids, '{}')       as modalities,
           coalesce(pb.client_persona_ids, '{}') as personas,
           upper(nullif(btrim(coalesce(pb.state, '')), '')) as state_code,
           pr.user_id                            as user_id
      from public.brand_kits bk
      join public.projects      pr on pr.id = bk.project_id
      left join public.project_briefs pb on pb.project_id = pr.id
     where bk.id = p_brand_kit_id
  ),
  /*
   * ⚠ `as materialized`, ET C'EST LE MOT QUI FAIT TOUT.
   *
   * Sans lui, PostgreSQL inline ce CTE (il n'est lu qu'une fois) et repousse
   * la corrélation sur `t.id` à l'intérieur — ce qui restaure exactement la
   * sous-requête par sujet candidat que cette forme existe pour supprimer.
   *
   * L'ensemble ne dépend que de la praticienne et de l'horloge. Une fois.
   */
  blocked as materialized (
    select distinct ta.topic_id
      from public.topic_assignments ta
      join public.brand_kits   obk on obk.id = ta.brand_kit_id
      join public.projects     opr on opr.id = obk.project_id
      left join public.project_briefs opb on opb.project_id = opr.id
     cross join kit k
     where ta.assigned_at > now() - public.topic_collision_window()
       and opr.user_id is distinct from k.user_id
       and k.state_code is not null
       and upper(nullif(btrim(coalesce(opb.state, '')), '')) = k.state_code
       and coalesce(opb.modality_ids, '{}') && k.modalities
  ),
  mine as materialized (
    select ta.topic_id from public.topic_assignments ta
     where ta.brand_kit_id = p_brand_kit_id
  )
  select t.id
    from public.content_topics t
    join public.content_segments s on s.id = t.segment_id
   cross join kit k
   where t.ethics_reviewed_at is not null
     and (t.expires_at is null or t.expires_at > now())
     and (p_archetype is null or t.archetype_key = p_archetype)
     and not exists (select 1 from mine m where m.topic_id = t.id)
     and not exists (select 1 from blocked b where b.topic_id = t.id)
     and (s.modality_id = any (k.modalities) or s.persona_id = any (k.personas))
     and (s.state_code is null or s.state_code = k.state_code)
   order by
     (case when s.modality_id = any (k.modalities) then 2 else 0 end)
     + (case when s.persona_id = any (k.personas) then 2 else 0 end)
     + (case when s.state_code is not null then 1 else 0 end)
     + (case when t.timely then 3 else 0 end)
     desc,
     t.created_at desc,
     t.id
   limit 1
$$;

comment on function public.next_topic_for_kit(uuid, date, text) is
  'The next topic for this kit, or NULL when the bank has nothing eligible left. A QUERY: no model call, therefore free and instant -- this is what Swap runs on. The window and the lifetime set are MATERIALIZED CTEs: without that keyword PostgreSQL inlines a once-referenced CTE and pushes the correlation back inside, which is the per-candidate subquery this shape exists to remove. Degradation towards neighbouring segments is a single ranking rather than a ladder of fallbacks, and the sort ends on t.id so that two calls against the same bank state return the same topic.';

revoke all on function public.next_topic_for_kit(uuid, date, text) from public, anon, authenticated;
grant execute on function public.next_topic_for_kit(uuid, date, text) to service_role;


-- ============================================================================
-- Guard rails — la sémantique, encore, et toujours pas la vitesse
-- ============================================================================
do $$
declare
  v_mod  text; v_mod2 text; v_per text;
  v_u1 uuid := gen_random_uuid(); v_u2 uuid := gen_random_uuid();
  v_p1 uuid := gen_random_uuid(); v_p2 uuid := gen_random_uuid();
  v_k1 uuid := gen_random_uuid(); v_k2 uuid := gen_random_uuid();
  v_seg uuid; v_t uuid;
  v_month date := date_trunc('month', now())::date;
begin
  select id into v_mod  from public.modality_cards where active order by sort_order limit 1;
  select id into v_mod2 from public.modality_cards where active and id <> v_mod
   order by sort_order limit 1;
  select id into v_per  from public.client_persona_cards where active order by sort_order limit 1;

  insert into auth.users (id, email) values
    (v_u1, 'mat-1@example.invalid'), (v_u2, 'mat-2@example.invalid');
  insert into public.projects (id, user_id, name) values (v_p1, v_u1, 'A'), (v_p2, v_u2, 'B');
  insert into public.project_briefs (project_id, modality_ids, client_persona_ids, state)
  values (v_p1, array[v_mod], array[v_per], 'CA'),
         (v_p2, array[v_mod], array[v_per], 'CA');
  insert into public.brand_kits (id, project_id) values (v_k1, v_p1), (v_k2, v_p2);

  insert into public.content_segments (modality_id, persona_id) values (v_mod, v_per)
  returning id into v_seg;
  insert into public.content_topics
    (segment_id, archetype_key, intent, title, hook, payload, caption_seed,
     rationale_template, ethics_reviewed_at)
  values (v_seg, 'single_statement', 'normalise', 'A topic', 'A hook',
          '{"statement":"Rest is not a reward you earn after everything else is done"}'::jsonb,
          'seed', 'Because.', now())
  returning id into v_t;

  if public.next_topic_for_kit(v_k1, v_month) is distinct from v_t then
    raise exception 'la forme matérialisée ne trouve plus le seul sujet éligible.';
  end if;
  if public.next_topic_for_kit(v_k1, v_month)
     is distinct from public.next_topic_for_kit(v_k1, v_month) then
    raise exception 'la forme matérialisée n''est plus déterministe.';
  end if;

  perform public.assign_topic_to_kit(v_k1, v_month);

  if public.next_topic_for_kit(v_k1, v_month) is not null then
    raise exception 'la forme matérialisée reproposerait un sujet déjà attribué.';
  end if;
  if public.next_topic_for_kit(v_k1, (v_month + interval '5 months')::date) is not null then
    raise exception 'la forme matérialisée reproposerait un sujet dans un autre mois.';
  end if;
  if public.next_topic_for_kit(v_k2, v_month) is not null then
    raise exception 'la forme matérialisée a perdu la fenêtre de 90 jours.';
  end if;

  update public.project_briefs set state = 'FL' where project_id = v_p2;
  if public.next_topic_for_kit(v_k2, v_month) is distinct from v_t then
    raise exception 'la forme matérialisée bloque une praticienne d''un autre État.';
  end if;
  update public.project_briefs set state = 'CA', modality_ids = array[v_mod2]
   where project_id = v_p2;
  if public.next_topic_for_kit(v_k2, v_month) is distinct from v_t then
    raise exception 'la forme matérialisée bloque une praticienne d''une autre modalité.';
  end if;

  delete from public.content_segments where id = v_seg;
  delete from auth.users where id in (v_u1, v_u2);
end
$$;


-- ============================================================================
-- DOWN
-- ============================================================================
--   -- restore next_topic_for_kit from 20260920170000 (the inlined CTE form,
--   -- which is semantically identical and asymptotically worse).
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260920180000', 'a_cte_referenced_once_is_inlined');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260921090000_an_item_knows_why_it_was_chosen.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — un post sait de quel sujet il vient, et pourquoi celui-là
-- ============================================================================
-- L'écran de contenu doit porter deux choses que la base ne sait pas encore
-- dire : le LIBELLÉ D'ANGLE sous la vignette (« Myth, gently corrected »,
-- « Behind the practice ») et la ligne de justification (« Why this one: … »).
--
-- ⚠ LES DEUX VIENNENT DU SUJET, ET ELLES NE SONT PAS LA MÊME CHOSE.
--
-- L'angle est une propriété du SUJET, partagée par toutes les praticiennes à
-- qui il est servi : `content_topics.intent`. La justification est une
-- propriété de l'ITEM, parce qu'elle cite son brief à elle —
-- `rationale_template` porte des substitutions, et ce qui est rendu n'est vrai
-- que pour une personne. Les mettre au même endroit voudrait dire que l'un des
-- deux ment.
--
-- ── POURQUOI UN CATALOGUE D'INTENTIONS ET PAS UNE TRADUCTION EN TYPESCRIPT ─
--
-- Parce que le libellé est lu à un seul endroit — l'écran — et décidé à un
-- autre — la banque. Une table de correspondance `intent → phrase` côté client
-- serait une seconde source : le jour où une sixième intention est générée, le
-- sujet existe, il est servi, et sa vignette n'a pas de libellé. Un catalogue
-- avec une clef étrangère fait échouer l'écriture du sujet, ce qui est le bon
-- moment pour l'apprendre.
-- ============================================================================


-- ============================================================================
-- 1. content_intents — les cinq angles, avec leurs mots
-- ============================================================================
create table if not exists public.content_intents (
  id         text     primary key,
  -- La phrase que la praticienne lit sous sa vignette. Pas un nom technique.
  label      text     not null,
  sort_order smallint not null,

  constraint content_intents_label_check check (char_length(label) between 1 and 40)
);

comment on table public.content_intents is
  'The five editorial angles a topic can take, with the words the practitioner reads under her thumbnail. A catalogue rather than a TypeScript lookup: the label is read on one screen and decided in the topic bank, and a second copy would mean a sixth angle ships with a blank label instead of failing at the write.';

insert into public.content_intents (id, label, sort_order) values
  ('correct_a_myth',      'Myth, gently corrected', 1),
  ('behind_the_practice', 'Behind the practice',    2),
  ('invite',              'A soft invitation',      3),
  ('normalise',           'You are not the only one', 4),
  ('educate',             'How the work works',     5)
on conflict (id) do update
  set label = excluded.label, sort_order = excluded.sort_order;

alter table public.content_intents enable row level security;

drop policy if exists "content_intents_select_all"    on public.content_intents;
drop policy if exists "content_intents_insert_denied" on public.content_intents;
drop policy if exists "content_intents_update_denied" on public.content_intents;
drop policy if exists "content_intents_delete_denied" on public.content_intents;

create policy "content_intents_select_all" on public.content_intents
  for select to authenticated using (true);
create policy "content_intents_insert_denied" on public.content_intents
  for insert with check (false);
create policy "content_intents_update_denied" on public.content_intents
  for update using (false);
create policy "content_intents_delete_denied" on public.content_intents
  for delete using (false);


-- ============================================================================
-- 2. content_topics.intent devient une clef étrangère
-- ============================================================================
-- ⚠ LE CHECK EST REMPLACÉ, PAS DOUBLÉ. Garder les deux donnerait deux listes
-- de cinq chaînes à tenir d'accord — exactement la dérive que
-- `content_registers` et `content_archetypes` sont des tables pour éviter.
alter table public.content_topics drop constraint if exists content_topics_intent_check;
alter table public.content_topics
  drop constraint if exists content_topics_intent_fkey;
alter table public.content_topics
  add constraint content_topics_intent_fkey
  foreign key (intent) references public.content_intents (id);


-- ============================================================================
-- 3. content_items gagne son sujet et sa justification
-- ============================================================================
alter table public.content_items
  add column if not exists topic_id uuid references public.content_topics (id) on delete set null;

alter table public.content_items
  add column if not exists rationale text;

alter table public.content_items drop constraint if exists content_items_rationale_check;
alter table public.content_items
  add constraint content_items_rationale_check
  check (rationale is null or char_length(rationale) <= 200);

comment on column public.content_items.topic_id is
  'The bank topic this post came from. ON DELETE SET NULL: retiring a topic must not delete posts already written from it, and a post that outlives its topic simply stops showing an angle.';
comment on column public.content_items.rationale is
  'The rendered "Why this one: ..." line. Rendered rather than templated because it cites HER brief -- content_topics.rationale_template carries the substitutions, and what comes out is only true for one person.';

create index if not exists content_items_topic_idx
  on public.content_items (topic_id)
  where topic_id is not null;


-- ============================================================================
-- 4. content_item_json porte les deux
-- ============================================================================
-- ⚠ ÉTENDRE `content_item_json` SUFFIT. `get_content_month` l'appelle pour
-- chaque ligne, et `get_content_item` aussi : les deux écrans gagnent l'angle
-- et la justification en même temps, sans qu'aucune des deux fonctions change.
-- C'est pour ça que cette forme existe.

create or replace function public.content_item_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'id',            ci.id,
    'brand_kit_id',  ci.brand_kit_id,
    'archetype',     ci.archetype,
    'register',      ci.register,
    'month_id',      ci.month_id,
    -- ⚠ `theme` A ÉTÉ PERDU UNE FOIS EN ÉCRIVANT CETTE FONCTION, parce que le
    -- corps a été repris de `20260910100758` alors que `20260910102753` l'avait
    -- ajouté ensuite. `create or replace` remplace le corps EN ENTIER : une
    -- clef oubliée disparaît de tous les écrans en silence. Le garde-fou en
    -- bas de ce fichier vérifie désormais le jeu de clefs, plutôt que de faire
    -- confiance à la relecture.
    'theme',         ci.theme,
    'status',        ci.status,
    'title',         ci.title,
    'caption',       ci.caption,
    'on_image_text', ci.on_image_text,
    'alt_text',      ci.alt_text,
    'tags',          to_jsonb(ci.tags),
    'category',      ci.category,
    'image_slot',    ci.image_slot,
    'scheduled_for', ci.scheduled_for,
    'created_at',    ci.created_at,
    'updated_at',    ci.updated_at,
    'posted',        coalesce(last_pub.action = 'published', false),
    'posted_at',     case when last_pub.action = 'published' then last_pub.occurred_at end,
    'channel',       case when last_pub.action = 'published' then last_pub.channel end,
    -- La ligne « Why this one: … », rendue pour ELLE.
    'rationale',     ci.rationale,
    /*
     * Le sujet dont ce post vient, ou `null`.
     *
     * ⚠ `null` EST UN ÉTAT NORMAL, PAS UNE ERREUR. Un post qu'elle a créé
     * elle-même ne vient d'aucun sujet ; un post dont le sujet a été retiré
     * de la banque non plus. L'écran n'affiche alors pas de libellé d'angle,
     * ce qui est correct — et il n'invente pas « Uncategorised ».
     */
    'topic',         case when t.id is null then null else jsonb_build_object(
                       'id',          t.id,
                       'angle',       t.intent,
                       'angle_label', ci_intent.label,
                       'archetype_key', t.archetype_key,
                       'timely',      t.timely
                     ) end
  )
  from public.content_items ci
  left join public.content_topics  t         on t.id = ci.topic_id
  left join public.content_intents ci_intent on ci_intent.id = t.intent
  left join lateral (
    select cp.action, cp.occurred_at, cp.channel
      from public.content_publications cp
     where cp.content_item_id = ci.id
     order by cp.occurred_at desc, cp.id desc
     limit 1
  ) last_pub on true
  where ci.id = p_id
$function$;

comment on function public.content_item_json(uuid) is
  'One content item as the screens read it. Carries `rationale` (the rendered "Why this one" line, hers) and `topic` (the bank topic''s angle and its label, shared). `topic` is null for a post she wrote herself or whose topic was retired -- a normal state, and the screen shows no angle rather than inventing one.';


-- ============================================================================
-- 5. set_content_item_topic — le pipeline attache le sujet et sa justification
-- ============================================================================
create or replace function public.set_content_item_topic(
  p_id        uuid,
  p_topic_id  uuid,
  p_rationale text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kit uuid;
begin
  select brand_kit_id into v_kit from public.content_items where id = p_id;
  if v_kit is null then
    return public.content_error('not_found');
  end if;

  -- ⚠ LE SUJET DOIT AVOIR ÉTÉ ATTRIBUÉ À CE KIT. Sans cette vérification, un
  -- appelant pourrait épingler sur un post le sujet d'une consœur, et la
  -- policy de `content_topics` le rendrait alors lisible — ce qui contourne
  -- exactement ce qu'elle garde.
  if p_topic_id is not null and not exists (
    select 1 from public.topic_assignments ta
     where ta.brand_kit_id = v_kit and ta.topic_id = p_topic_id
  ) then
    return public.content_error('forbidden');
  end if;

  update public.content_items
     set topic_id   = p_topic_id,
         rationale  = left(nullif(btrim(coalesce(p_rationale, '')), ''), 200),
         updated_at = now()
   where id = p_id;

  return public.content_item_json(p_id);
end
$$;

comment on function public.set_content_item_topic(uuid, uuid, text) is
  'Attaches a bank topic and its rendered rationale to a post. Refuses a topic that was never assigned to this kit -- otherwise a caller could pin a colleague''s topic on a post and make it readable through content_topics'' own policy.';

revoke all on function public.set_content_item_topic(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_content_item_topic(uuid, uuid, text) to service_role;


-- ============================================================================
-- 6. custom_visual_path — la question posée AVANT de dépenser
-- ============================================================================
-- Le pendant de `rendered_asset_path`, pour le chemin payant. Interroger
-- d'abord évite l'appel, la réservation ET la ligne de journal ;
-- `record_custom_visual` sait rattraper le cas, mais ce rattrapage existe pour
-- la course entre deux demandes simultanées, pas pour le cas courant.
create or replace function public.custom_visual_path(
  p_brand_kit_id uuid,
  p_prompt_hash  text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select cv.storage_path
    from public.custom_visual_generations cv
   where cv.brand_kit_id = p_brand_kit_id
     and cv.prompt_hash  = p_prompt_hash
$$;

comment on function public.custom_visual_path(uuid, text) is
  'The stored path for this (kit, prompt hash), or NULL. THE call the custom-visual path makes before reserving a credit: a hit means no API call, no reservation and no ledger row at all.';

revoke all on function public.custom_visual_path(uuid, text) from public, anon, authenticated;
grant execute on function public.custom_visual_path(uuid, text) to service_role;


-- ============================================================================
-- Guard rails
-- ============================================================================
-- ⚠ LE JEU DE CLEFS, AVANT TOUT LE RESTE.
--
-- `create or replace function` remplace le corps EN ENTIER. Reprendre ce corps
-- d'une migration antérieure à la dernière fait disparaître, sans erreur, tout
-- ce que les migrations intermédiaires y avaient ajouté — et la perte se voit
-- sur un écran, des jours plus tard. C'est arrivé ici avec `theme`.
--
-- Ce bloc épingle donc le contrat : toutes les clefs d'avant, plus les deux
-- nouvelles.
do $keys$
declare
  v_keys text[];
  v_expected text[] := array[
    'id', 'brand_kit_id', 'archetype', 'register', 'month_id', 'theme', 'status',
    'title', 'caption', 'on_image_text', 'alt_text', 'tags', 'category',
    'image_slot', 'scheduled_for', 'created_at', 'updated_at',
    'posted', 'posted_at', 'channel',
    'rationale', 'topic'
  ];
  v_missing text;
begin
  select array_agg(k order by k) into v_keys
    from jsonb_object_keys(
      public.content_item_json((select id from public.content_items limit 1))
    ) as k;

  -- Aucune ligne en base : le contrat se vérifie contre une ligne posée ici.
  if v_keys is null then
    raise notice 'content_item_json: aucune ligne pour éprouver le jeu de clefs; le test le fera.';
    return;
  end if;

  foreach v_missing in array v_expected loop
    if not (v_missing = any (v_keys)) then
      raise exception 'content_item_json a perdu la clef « % ». `create or replace` remplace le corps en entier.', v_missing;
    end if;
  end loop;
end
$keys$;


do $$
declare
  v_mod  text; v_per text;
  v_u    uuid := gen_random_uuid();
  v_p    uuid := gen_random_uuid();
  v_k    uuid := gen_random_uuid();
  v_seg  uuid; v_topic uuid; v_item uuid; v_json jsonb;
  v_n    integer;
begin
  select count(*) into v_n from public.content_intents;
  if v_n <> 5 then
    raise exception 'content_intents: % lignes, attendu 5', v_n;
  end if;

  -- ⚠ LES CINQ INTENTIONS DE LA BANQUE ONT TOUTES UN LIBELLÉ. C'est ce que la
  -- clef étrangère garantit maintenant, et ce bloc le prouve sur les données.
  if exists (
    select 1 from public.content_topics t
     where not exists (select 1 from public.content_intents i where i.id = t.intent)
  ) then
    raise exception 'un sujet porte une intention qui n''a pas de libellé.';
  end if;

  if has_function_privilege('authenticated', 'public.set_content_item_topic(uuid,uuid,text)'::regprocedure, 'EXECUTE') then
    raise exception 'authenticated peut exécuter set_content_item_topic.';
  end if;
  if has_function_privilege('authenticated', 'public.custom_visual_path(uuid,text)'::regprocedure, 'EXECUTE') then
    raise exception 'authenticated peut exécuter custom_visual_path.';
  end if;

  -- ---- l'angle et la justification arrivent bien sur l'item --------------
  select id into v_mod from public.modality_cards where active order by sort_order limit 1;
  select id into v_per from public.client_persona_cards where active order by sort_order limit 1;

  insert into auth.users (id, email) values (v_u, 'why@example.invalid');
  insert into public.projects (id, user_id, name) values (v_p, v_u, 'W');
  insert into public.project_briefs (project_id, modality_ids, client_persona_ids, state)
  values (v_p, array[v_mod], array[v_per], 'CA');
  insert into public.brand_kits (id, project_id) values (v_k, v_p);
  -- ⚠ `get_content_month` PASSE PAR `content_kit_access`, qui refuse un kit
  -- non payé. Sans ce droit, la sonde de la fin lirait un objet d'erreur et
  -- conclurait que `rationale` n'est pas porté — vrai, mais pour une raison
  -- qui n'a rien à voir. Un octroi comp plutôt qu'un achat fabriqué : c'est
  -- la table qui existe pour ça.
  insert into public.comp_grants (user_id, reason, granted_by, expires_at)
  values (v_u, 'topic link guard rail', 'migration 20260921090000', now() + interval '1 day');

  insert into public.content_segments (modality_id, persona_id) values (v_mod, v_per)
  returning id into v_seg;
  insert into public.content_topics
    (segment_id, archetype_key, intent, title, hook, payload, caption_seed,
     rationale_template, ethics_reviewed_at)
  values (v_seg, 'single_statement', 'correct_a_myth', 'A topic', 'A hook',
          '{"statement":"Rest is not a reward you earn after everything else is done"}'::jsonb,
          'seed', 'Because {{specialty}} keeps coming up.', now())
  returning id into v_topic;

  insert into public.content_items (brand_kit_id, archetype, status, title)
  values (v_k, 'statement', 'draft', 'A post')
  returning id into v_item;

  -- ⚠ UN SUJET NON ATTRIBUÉ EST REFUSÉ. Sinon on épinglerait le sujet d'une
  -- consœur et la policy de content_topics le rendrait lisible.
  -- ⚠ `content_error` IMBRIQUE : `{"error": {"code": …, "message": …}}`.
  -- Lu à plat (`->> 'error'`) il rend l'objet sérialisé, jamais le code, et
  -- l'assertion passe pour la mauvaise raison — ce qu'elle a fait ici.
  if (public.set_content_item_topic(v_item, v_topic, 'Because burnout keeps coming up.')
      #>> '{error,code}') is distinct from 'forbidden' then
    raise exception 'un sujet non attribué à ce kit a été épinglé sur un post.';
  end if;

  insert into public.topic_assignments (brand_kit_id, topic_id, month)
  values (v_k, v_topic, date_trunc('month', now())::date);

  v_json := public.set_content_item_topic(v_item, v_topic, 'Because burnout keeps coming up.');
  if v_json #>> '{topic,angle}' <> 'correct_a_myth' then
    raise exception 'l''angle n''est pas porté par content_item_json: %', v_json;
  end if;
  if v_json #>> '{topic,angle_label}' <> 'Myth, gently corrected' then
    raise exception 'le libellé d''angle n''est pas porté: %', v_json #>> '{topic,angle_label}';
  end if;
  if v_json ->> 'rationale' <> 'Because burnout keeps coming up.' then
    raise exception 'la justification n''est pas portée: %', v_json ->> 'rationale';
  end if;

  -- ---- un post sans sujet n'invente pas d'angle --------------------------
  v_json := public.set_content_item_topic(v_item, null, null);
  if v_json -> 'topic' <> 'null'::jsonb then
    raise exception 'un post sans sujet porte quand même un objet topic: %', v_json -> 'topic';
  end if;
  if v_json ->> 'rationale' is not null then
    raise exception 'un post sans sujet porte quand même une justification.';
  end if;

  -- ---- retirer le sujet n'emporte pas le post ----------------------------
  v_json := public.set_content_item_topic(v_item, v_topic, 'Because.');
  delete from public.topic_assignments where topic_id = v_topic;
  delete from public.content_topics where id = v_topic;
  select count(*) into v_n from public.content_items where id = v_item and topic_id is null;
  if v_n <> 1 then
    raise exception 'retirer un sujet de la banque a emporté le post qui en venait.';
  end if;

  /*
   * ⚠ `get_content_month` N'EST PAS ÉPROUVÉ ICI, ET C'EST UNE LIMITE DU LIEU.
   *
   * Il passe par `content_kit_access` → `kit_paid_access`, qui est scopée
   * ⚠ ET LE MOT « dollar-dollar » EST ÉCRIT EN TOUTES LETTRES CI-DESSOUS :
   * les deux caractères, dans un commentaire, referment le bloc qui les
   * contient. Le message d'erreur qui en sort pointe la ligne du commentaire
   * et parle de syntaxe, ce qui envoie chercher au mauvais endroit.
   *
   * `auth.uid()`. Dans un bloc « do dollar-dollar » de migration il n'y a pas
   * d'appelant :
   * `auth.uid()` est NULL et la fonction rend `not_found` — correctement, et
   * pour une raison qui n'a rien à voir avec ce qu'on voulait mesurer.
   *
   * L'assertion vit donc dans `supabase/tests/20260921090000_why_this_one.test.sql`,
   * qui pose un vrai claim JWT. C'est la même répartition que partout dans ce
   * dépôt : une sonde de migration prouve ce qui est vrai pour le
   * propriétaire, un fichier de test prouve ce qui est vrai pour une cliente.
   */

  delete from public.content_segments where id = v_seg;
  delete from auth.users where id = v_u;
end
$$;


-- ============================================================================
-- DOWN
-- ============================================================================
--   drop function if exists public.custom_visual_path(uuid, text);
--   drop function if exists public.set_content_item_topic(uuid, uuid, text);
--   -- restore content_item_json from 20260910102753 (drops rationale + topic);
--   alter table public.content_items drop column if exists rationale;
--   alter table public.content_items drop column if exists topic_id;
--   alter table public.content_topics drop constraint if exists content_topics_intent_fkey;
--   drop table if exists public.content_intents;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260921090000', 'an_item_knows_why_it_was_chosen');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260921100000_swap_is_a_draw_not_a_generation.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — Swap : un tirage, pas une génération
-- ============================================================================
-- ⚠ SWAP NE COÛTE RIEN PARCE QU'IL N'APPELLE RIEN, et c'est la banque qui le
-- permet.
--
-- La tentation, en écrivant ce bouton, est de redemander une carte à un
-- modèle. Ce serait instantanément cher (trente abonnées qui swappent trois
-- fois valent un mois de génération), lent, et non déterministe — trois
-- propriétés que « instantané, gratuit et déterministe » exclut chacune.
--
-- `content_topics` porte déjà tout ce qu'une carte a besoin d'avoir :
-- `caption_seed` est la caption, `payload` est le diagramme, `hook` est la
-- ligne posée SUR l'image, `rationale_template` est la justification. Un swap
-- ne fabrique donc rien : il tire le sujet suivant et recopie ce qui est déjà
-- écrit.
--
-- Le ledger l'enregistre quand même, avec `delta = 0` : « elle a swappé onze
-- fois ce mois-ci » est le signal que le scoring de la banque est mauvais, et
-- un acte gratuit qui ne laisse aucune trace ne peut pas être mesuré.
-- ============================================================================


-- ============================================================================
-- 1. render_rationale — le gabarit, rempli avec SON brief
-- ============================================================================
create or replace function public.render_rationale(
  p_template     text,
  p_brand_kit_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_out       text := coalesce(p_template, '');
  v_specialty text;
  v_modality  text;
begin
  select s.label into v_specialty
    from public.brand_kits bk
    join public.projects pr on pr.id = bk.project_id
    join public.project_briefs pb on pb.project_id = pr.id
    join public.specialties s on s.id = any (pb.specialty_ids)
   where bk.id = p_brand_kit_id
   order by s.sort_order
   limit 1;

  select m.label into v_modality
    from public.brand_kits bk
    join public.projects pr on pr.id = bk.project_id
    join public.project_briefs pb on pb.project_id = pr.id
    join public.modality_cards m on m.id = any (pb.modality_ids)
   where bk.id = p_brand_kit_id
   order by m.sort_order
   limit 1;

  v_out := replace(v_out, '{{specialty}}', coalesce(lower(v_specialty), 'this'));
  v_out := replace(v_out, '{{modality}}',  coalesce(lower(v_modality),  'the work'));

  /*
   * ⚠ TOUT PLACEHOLDER INCONNU EST RETIRÉ, PAS LAISSÉ.
   *
   * Un gabarit qui nomme une substitution que cette fonction ne connaît pas
   * afficherait `{{something}}` sous une carte, sur l'écran d'une praticienne.
   * Le retirer laisse une phrase un peu plus courte ; le laisser laisse une
   * phrase manifestement cassée. La première se lit, la seconde se signale.
   */
  v_out := regexp_replace(v_out, '\s*\{\{[a-z_]+\}\}\s*', ' ', 'g');
  v_out := btrim(regexp_replace(v_out, '\s+', ' ', 'g'));

  return left(nullif(v_out, ''), 200);
end
$$;

comment on function public.render_rationale(text, uuid) is
  'Fills a topic''s rationale template with THIS kit''s brief. An unknown placeholder is removed rather than left: `{{something}}` under a card on a practitioner''s screen is visibly broken, while a slightly shorter sentence simply reads.';

revoke all on function public.render_rationale(text, uuid) from public, anon, authenticated;


-- ============================================================================
-- 2. swap_content_item — tire, recopie, journalise
-- ============================================================================
create or replace function public.swap_content_item(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kit    uuid;
  v_user   uuid;
  v_month  date;
  v_topic  uuid;
  v_t      public.content_topics%rowtype;
  v_res    jsonb;
begin
  -- ⚠ LA PROPRIÉTÉ D'ABORD, ET PAR LE MÊME CHEMIN QUE PARTOUT. Un item qui
  -- n'est pas à elle répond `not_found`, jamais `payment_required` : la
  -- distinction dirait à une inconnue que cet identifiant existe.
  select ci.brand_kit_id into v_kit from public.content_items ci where ci.id = p_id;
  if v_kit is null then
    return public.content_error('not_found');
  end if;

  declare v_access text;
  begin
    v_access := public.content_kit_access(v_kit);
    if v_access is not null then
      return public.content_error(v_access);
    end if;
  end;

  select pr.user_id into v_user
    from public.brand_kits bk join public.projects pr on pr.id = bk.project_id
   where bk.id = v_kit;

  select coalesce(ci.scheduled_for, current_date) into v_month
    from public.content_items ci where ci.id = p_id;
  v_month := date_trunc('month', v_month)::date;

  -- ── Le tirage. Gratuit, déterministe, aucun modèle ────────────────────
  v_topic := public.assign_topic_to_kit(v_kit, v_month);
  if v_topic is null then
    /*
     * ⚠ LA BANQUE EST VIDE POUR CE SEGMENT, ET ON LE DIT.
     *
     * Un appelant qui reçoit ça doit l'AFFICHER, pas réessayer : réessayer
     * tirera le même rien. C'est aussi le signal de dimensionnement que la
     * simulation de la phase 6 mesure — quand il apparaît en production, la
     * banque est sous-dimensionnée pour ce segment.
     */
    return public.content_error('bank_exhausted');
  end if;

  select * into v_t from public.content_topics where id = v_topic;

  -- ── La recopie. Rien n'est fabriqué ───────────────────────────────────
  update public.content_items ci
     set title         = left(v_t.title, 34),
         caption       = v_t.caption_seed,
         on_image_text = v_t.hook,
         topic_id      = v_t.id,
         rationale     = public.render_rationale(v_t.rationale_template, v_kit),
         updated_at    = now()
   where ci.id = p_id;

  -- ── Le journal. delta 0, et il compte quand même ──────────────────────
  v_res := public.reserve_credit(
    v_user, 'swap', 'swapped ' || p_id::text, 'content_item', p_id,
    null, null, null, v_month
  );
  if (v_res ->> 'ok')::boolean then
    perform public.settle_credit((v_res ->> 'reservation_id')::uuid, null, true);
  end if;

  return public.content_item_json(p_id);
end
$$;

comment on function public.swap_content_item(uuid) is
  'Draws the next bank topic for this kit and copies it onto the post. No model call: caption_seed IS the caption, hook IS the on-image line, payload IS the diagram. That is why Swap is instant, free and deterministic, and why it is the dominant action on the stream. Recorded in credit_ledger with delta 0 -- "she swapped eleven times" is the signal the bank''s scoring is wrong, and a free act that leaves no trace cannot be measured.';

revoke all on function public.swap_content_item(uuid) from public, anon;
grant execute on function public.swap_content_item(uuid) to authenticated, service_role;


-- ============================================================================
-- Guard rails
-- ============================================================================
do $$
declare
  v_mod text; v_per text; v_spec text;
  v_u uuid := gen_random_uuid(); v_p uuid := gen_random_uuid(); v_k uuid := gen_random_uuid();
  v_seg uuid; v_item uuid; v_json jsonb; v_n integer;
begin
  -- Le gabarit se remplit, et un placeholder inconnu disparaît.
  if public.render_rationale('Because {{specialty}} keeps coming up.', null)
     is distinct from 'Because this keeps coming up.' then
    raise exception 'render_rationale: la substitution par défaut ne s''applique pas: %',
      public.render_rationale('Because {{specialty}} keeps coming up.', null);
  end if;
  if public.render_rationale('Because {{unknown_thing}} matters.', null)
     is distinct from 'Because matters.' then
    raise exception 'render_rationale: un placeholder inconnu survit: %',
      public.render_rationale('Because {{unknown_thing}} matters.', null);
  end if;

  if has_function_privilege('anon', 'public.swap_content_item(uuid)'::regprocedure, 'EXECUTE') then
    raise exception 'anon peut exécuter swap_content_item.';
  end if;
  if has_function_privilege('authenticated', 'public.render_rationale(text,uuid)'::regprocedure, 'EXECUTE') then
    raise exception 'authenticated peut exécuter render_rationale directement.';
  end if;

  select id into v_mod  from public.modality_cards where active order by sort_order limit 1;
  select id into v_per  from public.client_persona_cards where active order by sort_order limit 1;
  select id into v_spec from public.specialties where active order by sort_order limit 1;

  insert into auth.users (id, email) values (v_u, 'swap@example.invalid');
  insert into public.projects (id, user_id, name) values (v_p, v_u, 'S');
  insert into public.project_briefs (project_id, modality_ids, client_persona_ids, specialty_ids, state)
  values (v_p, array[v_mod], array[v_per], array[v_spec], 'CA');
  insert into public.brand_kits (id, project_id) values (v_k, v_p);
  insert into public.comp_grants (user_id, reason, granted_by, expires_at)
  values (v_u, 'swap guard rail', 'migration 20260921100000', now() + interval '1 day');

  insert into public.content_segments (modality_id, persona_id) values (v_mod, v_per)
  returning id into v_seg;
  insert into public.content_topics
    (segment_id, archetype_key, intent, title, hook, payload, caption_seed,
     rationale_template, ethics_reviewed_at)
  values (v_seg, 'single_statement', 'invite', 'Drawn by the swap',
          'A hook the composer will set on the image',
          '{"statement":"Rest is not a reward you earn after everything else is done"}'::jsonb,
          'The caption the bank already wrote.', 'Because {{specialty}} keeps coming up.', now());

  insert into public.content_items (brand_kit_id, archetype, status, title)
  values (v_k, 'statement', 'proposed', 'Before the swap')
  returning id into v_item;

  /*
   * ⚠ UN APPELANT EST POSÉ, PARCE QUE `swap_content_item` EN EXIGE UN.
   *
   * Elle passe par `content_kit_access` → `kit_paid_access`, scopée
   * `auth.uid()`. Sans claim, `auth.uid()` est NULL, la fonction répond
   * `not_found` — correctement — et la sonde mesure l'absence d'appelant au
   * lieu du swap.
   *
   * Poser le claim ici n'est pas un contournement : c'est la seule façon
   * d'exercer une fonction dont la portée EST l'appelant. Il est retiré juste
   * après, et la portée elle-même est éprouvée depuis un vrai rôle dans
   * `supabase/tests/20260921100000_swap.test.sql`.
   */
  perform set_config('request.jwt.claims', json_build_object('sub', v_u)::text, true);

  -- ⚠ LE SWAP RECOPIE, IL NE FABRIQUE PAS.
  v_json := public.swap_content_item(v_item);
  if v_json ? 'error' then
    raise exception 'le swap a échoué: %', v_json;
  end if;
  if v_json ->> 'caption' <> 'The caption the bank already wrote.' then
    raise exception 'le swap n''a pas recopié la caption du sujet: %', v_json ->> 'caption';
  end if;
  if v_json ->> 'on_image_text' <> 'A hook the composer will set on the image' then
    raise exception 'le swap n''a pas recopié le hook: %', v_json ->> 'on_image_text';
  end if;
  if v_json ->> 'rationale' not like 'Because %keeps coming up.' then
    raise exception 'la justification n''a pas été rendue: %', v_json ->> 'rationale';
  end if;
  if v_json #>> '{topic,angle_label}' <> 'A soft invitation' then
    raise exception 'le libellé d''angle n''a pas suivi: %', v_json #>> '{topic,angle_label}';
  end if;

  -- ⚠ ET IL EST GRATUIT. delta 0, consommation 0, et une ligne quand même.
  select consumed into v_n from public.credit_balances
   where user_id = v_u and kind = 'swap' and month = date_trunc('month', now())::date;
  if coalesce(v_n, -1) <> 0 then
    raise exception 'un swap a consommé % crédit(s)', v_n;
  end if;
  select count(*) into v_n from public.credit_ledger
   where user_id = v_u and kind = 'swap';
  if v_n < 1 then
    raise exception 'un swap n''a laissé aucune trace dans le journal.';
  end if;

  -- ── La banque épuisée se dit, elle ne boucle pas ───────────────────────
  v_json := public.swap_content_item(v_item);
  if (v_json #>> '{error,code}') is distinct from 'bank_exhausted' then
    raise exception 'un second swap sur une banque à un seul sujet n''a pas dit bank_exhausted: %', v_json;
  end if;

  perform set_config('request.jwt.claims', null, true);

  delete from public.content_segments where id = v_seg;
  delete from auth.users where id = v_u;
end
$$;


-- ============================================================================
-- DOWN
-- ============================================================================
--   drop function if exists public.swap_content_item(uuid);
--   drop function if exists public.render_rationale(text, uuid);
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260921100000', 'swap_is_a_draw_not_a_generation');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260921110000_a_layout_is_hers_to_change.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — the layout is hers to change, and it is not the column you think
-- ============================================================================
--
-- ⚠ THERE ARE TWO COLUMNS CALLED SOMETHING LIKE "ARCHETYPE", AND THEY ARE NOT
-- THE SAME VOCABULARY. This was found by the TypeScript compiler while wiring
-- the review screen, not by reading:
--
--   content_items.archetype        statement | question | notes | signature |
--                                  story | google_post
--                                  → the POST FORMAT. What kind of thing this
--                                    is on a feed. It predates this chantier.
--
--   content_archetypes.id          single_statement | quadrant_model | cycle |
--                                  surface_and_beneath | comparison_pair |
--                                  numbered_strategies | lettered_technique |
--                                  concentric_control | annotated_curve |
--                                  practitioner_card | carousel
--                                  → the CARD LAYOUT. How the composition
--                                    engine sets it. Added by this chantier.
--
-- The sets are disjoint, and the guard rail at the bottom of this file asserts
-- that they stay disjoint — because the day one word appears in both, every
-- screen reading either column starts being right by accident.
--
-- Until now an item's layout was reachable only THROUGH its topic
-- (`content_topics.archetype_key`), which is read-only from her side. So the
-- review screen could show two or three other layouts of the same content and
-- could not let her keep one. This column is what makes that choice stick.
--
-- ⚠ NULL IS THE NORMAL STATE AND IT MEANS "WHATEVER THE TOPIC SAYS". It is not
-- "unset, please backfill": a topic that gets a better default layout should
-- move every item that never overrode it, and only a null can follow.
-- ============================================================================

alter table public.content_items
  add column if not exists compose_archetype text;

alter table public.content_items
  drop constraint if exists content_items_compose_archetype_fkey;

alter table public.content_items
  add constraint content_items_compose_archetype_fkey
  foreign key (compose_archetype) references public.content_archetypes(id)
  on update cascade
  -- ⚠ RESTRICT, NOT SET NULL. Deleting a layout out from under the posts that
  -- chose it should be loud: eleven layouts are a contract the engine
  -- implements, and losing one silently turns her chosen card back into
  -- somebody else's default.
  on delete restrict;

comment on column public.content_items.compose_archetype is
  'The CARD LAYOUT she kept for this post, from content_archetypes.id. NOT content_items.archetype, which is the post format (statement/question/notes/...) and a different vocabulary entirely. Null means "use the topic''s layout", which is the normal state.';

create index if not exists content_items_compose_archetype_idx
  on public.content_items (compose_archetype)
  where compose_archetype is not null;


-- ============================================================================
-- The patch accepts it, and the foreign key is what refuses a bad one
-- ============================================================================
-- Everything else in this function is `20260914084054`'s body, unchanged. It
-- is repeated in full because `create or replace` replaces the whole body, and
-- a partial copy is how `theme` nearly disappeared once already.
create or replace function public.update_content_item(p_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_kit        uuid;
  v_error      text;
  v_bad        text;
  v_next_state text;
  v_next_alt   text;
begin
  select ci.brand_kit_id into v_kit
    from public.content_items ci
   where ci.id = p_id;

  if v_kit is null then
    return public.content_error('not_found');
  end if;

  v_error := public.content_kit_access(v_kit);
  if v_error is not null then
    return public.content_error(v_error);
  end if;

  select string_agg(key, ', ') into v_bad
    from jsonb_object_keys(p_patch) as key
   where key not in ('archetype','status','title','caption','alt_text',
                     'tags','category','image_slot','scheduled_for',
                     'on_image_text','compose_archetype');
  if v_bad is not null then
    return public.content_error('unknown_field');
  end if;

  select case when p_patch ? 'status'   then p_patch ->> 'status'   else ci.status end,
         case when p_patch ? 'alt_text' then p_patch ->> 'alt_text' else ci.alt_text end
    into v_next_state, v_next_alt
    from public.content_items ci
   where ci.id = p_id;

  if v_next_state = 'ready' and coalesce(btrim(v_next_alt), '') = '' then
    return public.content_error('alt_text_required');
  end if;

  /*
   * ⚠ LOOKED UP IN THE CATALOGUE, NOT LISTED AGAIN HERE. The foreign key is
   * still the guarantee; this read exists so that a bad layout comes back as a
   * refusal she can be shown, instead of a foreign-key violation that reaches
   * the browser as a 500. The twelfth layout added tomorrow is accepted by both
   * without either being edited.
   */
  if p_patch ? 'compose_archetype'
     and nullif(btrim(p_patch ->> 'compose_archetype'), '') is not null
     and not exists (
       select 1 from public.content_archetypes ca
        where ca.id = btrim(p_patch ->> 'compose_archetype') and ca.active
     )
  then
    return public.content_error('unknown_layout');
  end if;

  update public.content_items ci set
    archetype     = case when p_patch ? 'archetype'  then p_patch ->> 'archetype'  else ci.archetype end,
    -- ⚠ AN EMPTY STRING CLEARS IT, and clearing is a real choice: it is how she
    -- goes back to the layout the topic came with. Storing '' instead would
    -- break the foreign key and would mean nothing.
    compose_archetype = case when p_patch ? 'compose_archetype'
                             then nullif(btrim(p_patch ->> 'compose_archetype'), '')
                             else ci.compose_archetype end,
    status        = case when p_patch ? 'status'     then p_patch ->> 'status'     else ci.status end,
    title         = case when p_patch ? 'title'      then p_patch ->> 'title'      else ci.title end,
    caption       = case when p_patch ? 'caption'    then p_patch ->> 'caption'    else ci.caption end,
    alt_text      = case when p_patch ? 'alt_text'   then p_patch ->> 'alt_text'   else ci.alt_text end,
    category      = case when p_patch ? 'category'   then p_patch ->> 'category'   else ci.category end,
    image_slot    = case when p_patch ? 'image_slot' then p_patch ->> 'image_slot' else ci.image_slot end,
    on_image_text = case when p_patch ? 'on_image_text'
                         then nullif(btrim(p_patch ->> 'on_image_text'), '') else ci.on_image_text end,
    scheduled_for = case when p_patch ? 'scheduled_for'
                         then nullif(p_patch ->> 'scheduled_for', '')::date else ci.scheduled_for end,
    tags          = case when p_patch ? 'tags'
                         then public.content_normalize_tags(
                                array(select jsonb_array_elements_text(p_patch -> 'tags')))
                         else ci.tags end,
    updated_at    = now()
  where ci.id = p_id;

  return jsonb_build_object('id', p_id, 'saved_at', now());
end
$function$;

comment on function public.update_content_item(uuid, jsonb) is
  'Patch semantics: an absent key is left alone, a present null clears. The allow-list is the whole contract - `theme` is deliberately absent, because the month owns it. `compose_archetype` IS accepted: the layout is hers. An unknown value is refused twice over - once as `unknown_layout`, so she sees a refusal rather than a 500, and once by the foreign key, which is the guarantee. Neither lists the catalogue: both read it.';


-- ============================================================================
-- And the review screen can read back what it saved
-- ============================================================================
create or replace function public.content_item_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'id',            ci.id,
    'brand_kit_id',  ci.brand_kit_id,
    'archetype',     ci.archetype,
    'register',      ci.register,
    'month_id',      ci.month_id,
    'theme',         ci.theme,
    'status',        ci.status,
    'title',         ci.title,
    'caption',       ci.caption,
    'on_image_text', ci.on_image_text,
    'alt_text',      ci.alt_text,
    'tags',          to_jsonb(ci.tags),
    'category',      ci.category,
    'image_slot',    ci.image_slot,
    'scheduled_for', ci.scheduled_for,
    'created_at',    ci.created_at,
    'updated_at',    ci.updated_at,
    'posted',        coalesce(last_pub.action = 'published', false),
    'posted_at',     case when last_pub.action = 'published' then last_pub.occurred_at end,
    'channel',       case when last_pub.action = 'published' then last_pub.channel end,
    'rationale',     ci.rationale,
    -- The layout she kept, or null for "whatever the topic says".
    'compose_archetype', ci.compose_archetype,
    'topic',         case when t.id is null then null else jsonb_build_object(
                       'id',          t.id,
                       'angle',       t.intent,
                       'angle_label', ci_intent.label,
                       'archetype_key', t.archetype_key,
                       'timely',      t.timely
                     ) end
  )
  from public.content_items ci
  left join public.content_topics  t         on t.id = ci.topic_id
  left join public.content_intents ci_intent on ci_intent.id = t.intent
  left join lateral (
    select cp.action, cp.occurred_at, cp.channel
      from public.content_publications cp
     where cp.content_item_id = ci.id
     order by cp.occurred_at desc, cp.id desc
     limit 1
  ) last_pub on true
  where ci.id = p_id
$function$;


-- ============================================================================
-- A swap draws new content, so it drops the layout she kept for the old
-- ============================================================================
-- ⚠ NOT AN OVERSIGHT TO KEEP IT. `compose_archetype` is a layout she chose for
-- ONE piece of content: a cycle because that topic had three steps, a
-- comparison because that one had two sides. Swap replaces the content
-- entirely. Carrying her override across would apply a layout chosen for a
-- diagram that is no longer on the card, and the review screen would then show
-- her a refusal she never caused.
--
-- The body is `20260921100000`'s, repeated in full for the same reason as
-- above: `create or replace` replaces the whole body.
create or replace function public.swap_content_item(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_kit    uuid;
  v_user   uuid;
  v_month  date;
  v_topic  uuid;
  v_t      public.content_topics%rowtype;
  v_res    jsonb;
begin
  select ci.brand_kit_id into v_kit from public.content_items ci where ci.id = p_id;
  if v_kit is null then
    return public.content_error('not_found');
  end if;

  declare v_access text;
  begin
    v_access := public.content_kit_access(v_kit);
    if v_access is not null then
      return public.content_error(v_access);
    end if;
  end;

  select pr.user_id into v_user
    from public.brand_kits bk join public.projects pr on pr.id = bk.project_id
   where bk.id = v_kit;

  select coalesce(ci.scheduled_for, current_date) into v_month
    from public.content_items ci where ci.id = p_id;
  v_month := date_trunc('month', v_month)::date;

  v_topic := public.assign_topic_to_kit(v_kit, v_month);
  if v_topic is null then
    return public.content_error('bank_exhausted');
  end if;

  select * into v_t from public.content_topics where id = v_topic;

  update public.content_items ci
     set title         = left(v_t.title, 34),
         caption       = v_t.caption_seed,
         on_image_text = v_t.hook,
         topic_id      = v_t.id,
         rationale     = public.render_rationale(v_t.rationale_template, v_kit),
         -- The one line this redefinition exists for.
         compose_archetype = null,
         updated_at    = now()
   where ci.id = p_id;

  v_res := public.reserve_credit(
    v_user, 'swap', 'swapped ' || p_id::text, 'content_item', p_id,
    null, null, null, v_month
  );
  if (v_res ->> 'ok')::boolean then
    perform public.settle_credit((v_res ->> 'reservation_id')::uuid, null, true);
  end if;

  return public.content_item_json(p_id);
end
$function$;

revoke all on function public.swap_content_item(uuid) from public, anon;
grant execute on function public.swap_content_item(uuid) to authenticated, service_role;


-- ============================================================================
-- GUARD RAILS
-- ============================================================================
do $guard$
declare
  v_expected text[];
  v_overlap  text;
  v_key      text;
  v_def      text;
begin
  -- ── 1. The two vocabularies are disjoint, and must stay that way ─────────
  select string_agg(ca.id, ', ') into v_overlap
    from public.content_archetypes ca
   where ca.id in ('statement','question','notes','signature','story','google_post');
  if v_overlap is not null then
    raise exception
      'a layout key collides with a post format: %. Two columns named like "archetype" now share a word, and every screen reading either one is right by accident.',
      v_overlap;
  end if;

  -- ── 2. The patch accepts the layout and still refuses the theme ──────────
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'update_content_item';

  if v_def not like '%''compose_archetype''%' then
    raise exception 'update_content_item does not accept compose_archetype; the review screen could not keep a layout';
  end if;
  if v_def like '%''theme''%' then
    raise exception 'update_content_item accepts theme; a re-themed post composes on the wrong ground';
  end if;

  -- ── 3. A swap drops the layout she kept for the previous content ────────
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'swap_content_item';
  if v_def not like '%compose_archetype = null%' then
    raise exception
      'swap_content_item keeps compose_archetype; her layout for the old content would be applied to the new, and the screen would show a refusal she never caused';
  end if;

  -- ── 4. The json carries every key the screens read ───────────────────────
  -- ⚠ READ FROM THE FUNCTION SOURCE, NOT FROM A CALL. A call needs a row, and
  -- a row needs a kit, a user and an entitlement; a migration has none of them
  -- and `content_item_json` would return no row at all. The source text is
  -- what `create or replace` overwrote, so it is the thing worth pinning.
  v_expected := array[
    'alt_text','archetype','brand_kit_id','caption','category','channel',
    'compose_archetype','created_at','id','image_slot','month_id',
    'on_image_text','posted','posted_at','rationale','register','scheduled_for',
    'status','tags','theme','title','topic','updated_at'
  ];

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'content_item_json';

  foreach v_key in array v_expected
  loop
    if v_def not like '%''' || v_key || '''%' then
      raise exception
        'content_item_json lost the key %. `create or replace` replaces the whole body, and a key dropped by a copy-paste disappears from every screen in silence.',
        v_key;
    end if;
  end loop;
end
$guard$;


-- ============================================================================
-- DOWN
-- ============================================================================
--   drop index public.content_items_compose_archetype_idx;
--   alter table public.content_items drop column compose_archetype;
--   -- then restore update_content_item and content_item_json from
--   -- 20260921090000_an_item_knows_why_it_was_chosen.sql
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260921110000', 'a_layout_is_hers_to_change');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260921120000_a_post_can_be_asked_for.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — un post peut être demandé, pas seulement reçu
-- ============================================================================
--
-- Jusqu'ici le produit ne savait écrire qu'un MOIS ENTIER, en batch, le 1er.
-- Quand elle crée un post ou rouvre un post inachevé, elle tombe sur un
-- formulaire vide — exactement ce que ce produit promet de ne jamais lui
-- montrer.
--
-- ⚠ ET IL N'Y A PAS DE SECOND CHEMIN DE GÉNÉRATION. Même banque, même modèle,
-- mêmes gardes déontologiques, même moteur de composition, même journal de
-- crédits. La seule différence est l'appel : synchrone au lieu du Batch,
-- toujours derrière le même préfixe mis en cache.
--
-- ── ⚠ LE TROU STRUCTUREL QUE CETTE MIGRATION OUVRE D'ABORD ──────────────
--
-- **Un payload de diagramme n'avait nulle part où vivre sur un post.** Il vit
-- sur `content_topics.payload`, et un sujet de banque est du STOCK partagé
-- entre praticiennes. Une idée à elle n'est pas du stock : l'écrire dans la
-- banque la ferait entrer dans le pool anti-collision des autres.
--
-- Donc `content_items.payload`. Nullable, et null veut dire « celui du sujet »
-- — exactement comme `compose_archetype` porte « la mise en page du sujet »
-- quand il est null.
-- ============================================================================

alter table public.content_items
  add column if not exists payload jsonb;

comment on column public.content_items.payload is
  'The diagram payload of THIS post, when it has one of its own. Null means "the topic''s payload", which is the normal state for a post drawn from the bank. Written by generation, never by the editor: update_content_item does not accept it.';

-- ⚠ UN PAYLOAD SANS MISE EN PAGE NE VEUT RIEN DIRE. Le validateur prend un
-- archétype ; sans lui il n'y a rien contre quoi valider, et le moteur n'aurait
-- pas de module à appeler.
alter table public.content_items
  drop constraint if exists content_items_payload_needs_archetype;
alter table public.content_items
  add constraint content_items_payload_needs_archetype
  check (payload is null or compose_archetype is not null);

-- ⚠ ET IL EST VALIDÉ PAR LE MÊME VALIDATEUR QUE LA BANQUE. Une seconde
-- définition de « ce qu'est un payload de cycle » dériverait de la première le
-- jour où l'un des onze archétypes change de bornes.
alter table public.content_items
  drop constraint if exists content_items_payload_valid;
alter table public.content_items
  add constraint content_items_payload_valid
  check (
    payload is null
    or public.content_topic_payload_valid(compose_archetype, payload)
  );


-- ============================================================================
-- Le payload d'un post est du texte publié, comme celui d'un sujet
-- ============================================================================
-- ⚠ MÊME GARDE QUE `20260920160000`, POUR LA MÊME RAISON. Un mot posé sur la
-- carte est publié aussi fort qu'une phrase de légende. La garde existante sur
-- `content_items` lit `title`, `caption`, `on_image_text` et `alt_text` ; elle
-- ne connaissait pas `payload`, qui n'existait pas.
create or replace function public.content_items_payload_ethics_gate()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_block   text;
  v_text    text;
  v_cliches text[];
begin
  if new.payload is null then
    return new;
  end if;

  v_text := public.content_topic_text(new.payload);
  if coalesce(btrim(v_text), '') = '' then
    return new;
  end if;

  v_block := public.ethics_blocks(v_text);
  if v_block is not null then
    raise exception 'Advertising ethics: %', v_block
      using errcode = 'check_violation',
            hint = 'That phrasing can put a licence at risk. Rewrite it as a description of the work.';
  end if;

  v_cliches := public.usp_banned_phrases_check(v_text);
  if coalesce(array_length(v_cliches, 1), 0) > 0 then
    raise exception 'Worn phrasing on the card: %', array_to_string(v_cliches, ', ')
      using errcode = 'check_violation',
            hint = 'These phrases appear on every practice website. Say the thing itself.';
  end if;

  return new;
end
$$;

revoke all on function public.content_items_payload_ethics_gate() from public, anon, authenticated;

drop trigger if exists content_items_payload_ethics_gate on public.content_items;
create trigger content_items_payload_ethics_gate
  before insert or update of payload on public.content_items
  for each row execute function public.content_items_payload_ethics_gate();


-- ============================================================================
-- Trois sujets proposés, GRATUITEMENT et sans rien consommer
-- ============================================================================
-- ⚠ PROPOSER N'EST PAS TIRER. `assign_topic_to_kit` écrit une ligne
-- d'assignation : un sujet montré puis refusé serait brûlé à vie pour elle.
-- Cette fonction ne fait que REGARDER, et « Show three others » peut donc
-- tourner autant de fois qu'elle veut.
--
-- ⚠ ET C'EST `next_topic_for_kit`, PAS `next_topic_for_user`. Le brief nomme
-- la seconde ; elle n'existe pas. Les sujets sont assignés PAR KIT — c'est
-- l'arbitrage de grain consigné au §10.4 du rapport d'implémentation : le
-- contenu appartient à une marque, les crédits à une personne. Une même
-- praticienne avec deux cabinets a deux calendriers et deux banques tirées.
create or replace function public.suggest_topics_for_kit(
  p_brand_kit_id uuid,
  p_month        date default null,
  p_limit        integer default 3,
  p_exclude      uuid[] default '{}'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_error text;
  v_out   jsonb;
begin
  /*
   * ⚠ LE DROIT D'ABORD, ET IL MANQUAIT. Cette fonction lisait la banque en
   * joignant `brand_kits` sans passer par `content_kit_access` : un kit
   * impayé, ou celui de quelqu'un d'autre, recevait des suggestions.
   *
   * Gratuites ne veut pas dire publiques. La banque est le stock du produit ;
   * la montrer à qui n'y a pas droit, c'est la livrer.
   *
   * `content_kit_access` répond `not_found` avant `payment_required`, comme
   * partout : un 402 à une inconnue confirmerait que ce kit existe.
   */
  v_error := public.content_kit_access(p_brand_kit_id);
  if v_error is not null then
    return public.content_error(v_error);
  end if;

  with kit as materialized (
    select coalesce(pb.modality_ids, '{}')       as modalities,
           coalesce(pb.client_persona_ids, '{}') as personas,
           upper(nullif(btrim(coalesce(pb.state, '')), '')) as state_code,
           pr.user_id                            as user_id,
           bk.id                                 as kit_id
      from public.brand_kits bk
      join public.projects      pr on pr.id = bk.project_id
      left join public.project_briefs pb on pb.project_id = pr.id
     where bk.id = p_brand_kit_id
  ),
  blocked as materialized (
    select distinct ta.topic_id
      from public.topic_assignments ta
      join public.brand_kits   obk on obk.id = ta.brand_kit_id
      join public.projects     opr on opr.id = obk.project_id
      left join public.project_briefs opb on opb.project_id = opr.id
     cross join kit k
     where ta.assigned_at > now() - public.topic_collision_window()
       and opr.user_id is distinct from k.user_id
       and k.state_code is not null
       and upper(nullif(btrim(coalesce(opb.state, '')), '')) = k.state_code
       and coalesce(opb.modality_ids, '{}') && k.modalities
  ),
  mine as materialized (
    select ta.topic_id from public.topic_assignments ta
     where ta.brand_kit_id = p_brand_kit_id
  )
  select coalesce(jsonb_agg(row_to_json(picked)::jsonb order by picked.rank), '[]'::jsonb)
    from (
      select t.id,
             t.title,
             t.hook,
             t.intent                                            as angle,
             ci_intent.label                                     as angle_label,
             t.archetype_key,
             t.timely,
             public.render_rationale(t.rationale_template, p_brand_kit_id) as rationale,
             row_number() over (
               order by
                 (case when s.modality_id = any (k.modalities) then 2 else 0 end)
                 + (case when s.persona_id = any (k.personas) then 2 else 0 end)
                 + (case when s.state_code is not null then 1 else 0 end)
                 + (case when t.timely then 3 else 0 end)
                 desc,
                 t.created_at desc,
                 t.id
             ) as rank
        from public.content_topics t
        join public.content_segments s on s.id = t.segment_id
        left join public.content_intents ci_intent on ci_intent.id = t.intent
       cross join kit k
       where t.ethics_reviewed_at is not null
         and (t.expires_at is null or t.expires_at > now())
         and not (t.id = any (coalesce(p_exclude, '{}')))
         and not exists (select 1 from mine m where m.topic_id = t.id)
         and not exists (select 1 from blocked b where b.topic_id = t.id)
         and (s.modality_id = any (k.modalities) or s.persona_id = any (k.personas))
         and (s.state_code is null or s.state_code = k.state_code)
       order by rank
       limit greatest(coalesce(p_limit, 3), 0)
    ) picked
  into v_out;

  return coalesce(v_out, '[]'::jsonb);
end
$$;

comment on function public.suggest_topics_for_kit(uuid, date, integer, uuid[]) is
  'Up to N bank topics this kit could be given, WITHOUT assigning any of them. Free and unlimited: showing a topic and having it refused must not burn it for life, which is what assign_topic_to_kit would do. `p_exclude` is how "show three others" walks past the ones already seen.';

revoke all on function public.suggest_topics_for_kit(uuid, date, integer, uuid[]) from public, anon;
grant execute on function public.suggest_topics_for_kit(uuid, date, integer, uuid[]) to authenticated, service_role;


-- ============================================================================
-- « Write it » — un crédit, une fois, même si elle double-clique
-- ============================================================================
-- ⚠ L'IDEMPOTENCE EST EN BASE, PAS DANS LE BOUTON. Un bouton désactivé pendant
-- la requête protège d'un double clic et de rien d'autre : deux onglets, un
-- réseau qui rejoue, un retour arrière puis un nouveau clic passent tous à
-- côté. Ce qui tient est une clef unique sur une table.
create table if not exists public.on_demand_writes (
  id              uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  -- La clef que le client génère pour CETTE intention d'écriture. Deux clics
  -- sur le même bouton portent la même ; deux demandes distinctes non.
  idempotency_key text not null,
  reservation_id  uuid not null references public.credit_ledger(id) on delete cascade,
  state           text not null default 'reserved',
  created_at      timestamptz not null default now(),
  settled_at      timestamptz,

  constraint on_demand_writes_key_check check (char_length(idempotency_key) between 8 and 128),
  constraint on_demand_writes_state_check check (state in ('reserved', 'written', 'released')),
  constraint on_demand_writes_unique unique (content_item_id, idempotency_key)
);

comment on table public.on_demand_writes is
  'One row per "Write it" intent. The unique key on (item, idempotency_key) is what makes a double click cost one credit instead of two -- a disabled button protects against a double click and nothing else: two tabs, a replayed request and a back-then-click all walk past it.';

create index if not exists on_demand_writes_item_idx
  on public.on_demand_writes (content_item_id, created_at desc);

alter table public.on_demand_writes enable row level security;

-- ⚠ AUCUNE POLICY OUVERTE. Cette table se lit et s'écrit uniquement par les
-- fonctions SECURITY DEFINER ci-dessous. Le navigateur n'a rien à y faire :
-- une cliente qui pourrait insérer une ligne pourrait se réserver un crédit.
drop policy if exists on_demand_writes_no_browser on public.on_demand_writes;
create policy on_demand_writes_no_browser on public.on_demand_writes
  for all to authenticated, anon using (false) with check (false);

/*
 * ⚠ LA POLICY NE SUFFIT PAS, ET C'EST MON PROPRE GARDE-FOU QUI L'A DIT.
 *
 * `enable row level security` + une policy qui refuse bloque bien la ligne,
 * mais le GRANT de table reste : `has_table_privilege('authenticated', …,
 * 'INSERT')` répondait vrai. Deux verrous différents, et seul le second se
 * lit dans un audit de privilèges.
 *
 * Ce dépôt révoque explicitement sur ses tables internes — `stripe_events`,
 * `banned_phrases`, `comp_grants` — et celle-ci en est une : une cliente qui
 * pourrait y insérer une ligne pourrait se réserver un crédit.
 */
revoke all on table public.on_demand_writes from anon, authenticated;


create or replace function public.begin_on_demand_write(
  p_item_id         uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kit      uuid;
  v_user     uuid;
  v_error    text;
  v_existing public.on_demand_writes%rowtype;
  v_month    date;
  v_res      jsonb;
  v_id       uuid;
begin
  select ci.brand_kit_id into v_kit from public.content_items ci where ci.id = p_item_id;
  if v_kit is null then
    return public.content_error('not_found');
  end if;

  v_error := public.content_kit_access(v_kit);
  if v_error is not null then
    return public.content_error(v_error);
  end if;

  /*
   * ⚠ LA CLEF EST CONSULTÉE AVANT TOUTE RÉSERVATION. Le second clic doit
   * retrouver la première ligne, pas en créer une seconde puis la relâcher :
   * un journal plein de paires réservation/libération ne dit plus rien.
   */
  select * into v_existing from public.on_demand_writes
   where content_item_id = p_item_id and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'ok', true,
      'reason', 'already_started',
      'write_id', v_existing.id,
      'reservation_id', v_existing.reservation_id,
      'state', v_existing.state
    );
  end if;

  select pr.user_id into v_user
    from public.brand_kits bk join public.projects pr on pr.id = bk.project_id
   where bk.id = v_kit;

  select coalesce(ci.scheduled_for, current_date) into v_month
    from public.content_items ci where ci.id = p_item_id;
  v_month := date_trunc('month', v_month)::date;

  /*
   * ⚠ LE PLAFOND EST APPLIQUÉ ICI, EN SQL. `reserve_credit` refuse quand le
   * quota mensuel de `regeneration` est atteint (10 au plan standard), et
   * cette fonction n'a aucun moyen de le contourner : elle ne sait pas ce
   * qu'est un quota, seulement qu'on lui a répondu non.
   */
  v_res := public.reserve_credit(
    p_user => v_user, p_kind => 'regeneration', p_reason => 'write ' || p_item_id::text,
    p_ref_type => 'content_item', p_ref_id => p_item_id, p_month => v_month
  );

  if not coalesce((v_res ->> 'ok')::boolean, false) then
    -- `quota_exhausted` remonte tel quel : l'écran dit la date de renouvellement.
    return public.content_error(coalesce(v_res #>> '{error,code}', v_res ->> 'reason', 'quota_exhausted'));
  end if;

  begin
    insert into public.on_demand_writes (content_item_id, idempotency_key, reservation_id)
    values (p_item_id, p_idempotency_key, (v_res ->> 'reservation_id')::uuid)
    returning id into v_id;
  exception when unique_violation then
    /*
     * ⚠ LA COURSE, RÉSOLUE PAR LA CONTRAINTE. Deux requêtes simultanées
     * passent toutes les deux la lecture ci-dessus ; une seule insère. La
     * perdante relâche SON crédit et rend la ligne gagnante, donc une seule
     * dépense subsiste.
     */
    perform public.settle_credit((v_res ->> 'reservation_id')::uuid, null, false);
    select * into v_existing from public.on_demand_writes
     where content_item_id = p_item_id and idempotency_key = p_idempotency_key;
    return jsonb_build_object(
      'ok', true, 'reason', 'already_started',
      'write_id', v_existing.id, 'reservation_id', v_existing.reservation_id,
      'state', v_existing.state
    );
  end;

  return jsonb_build_object(
    'ok', true, 'reason', 'reserved',
    'write_id', v_id, 'reservation_id', (v_res ->> 'reservation_id')::uuid, 'state', 'reserved'
  );
end
$$;

comment on function public.begin_on_demand_write(uuid, text) is
  'Reserves ONE regeneration credit for a "Write it", idempotently. A second call with the same key returns the first row and reserves nothing. The monthly ceiling is applied by reserve_credit, in SQL -- this function cannot bypass it because it does not know what a quota is.';

revoke all on function public.begin_on_demand_write(uuid, text) from public, anon;
grant execute on function public.begin_on_demand_write(uuid, text) to authenticated, service_role;


-- ============================================================================
-- Le résultat, écrit sur le post et réglé en une transaction
-- ============================================================================
create or replace function public.apply_on_demand_write(
  p_write_id          uuid,
  p_title             text,
  p_caption           text,
  p_on_image_text     text,
  p_alt_text          text,
  p_compose_archetype text,
  p_payload           jsonb,
  p_rationale         text default null,
  p_topic_id          uuid default null,
  p_cost_usd          numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_write public.on_demand_writes%rowtype;
  v_kit   uuid;
  v_error text;
begin
  select * into v_write from public.on_demand_writes where id = p_write_id;
  if not found then
    return public.content_error('not_found');
  end if;

  select ci.brand_kit_id into v_kit from public.content_items ci where ci.id = v_write.content_item_id;
  v_error := public.content_kit_access(v_kit);
  if v_error is not null then
    return public.content_error(v_error);
  end if;

  /*
   * ⚠ DÉJÀ ÉCRIT VEUT DIRE : ON NE RÉÉCRIT PAS, ET ON NE REFACTURE PAS. C'est
   * la seconde moitié de l'idempotence — la première empêche de réserver deux
   * fois, celle-ci empêche d'écrire deux fois si la génération est rejouée.
   */
  if v_write.state <> 'reserved' then
    return jsonb_build_object('ok', true, 'reason', 'already_written',
                              'id', v_write.content_item_id);
  end if;

  update public.content_items ci set
    title             = coalesce(left(p_title, 34), ci.title),
    caption           = coalesce(p_caption, ci.caption),
    on_image_text     = coalesce(p_on_image_text, ci.on_image_text),
    alt_text          = coalesce(p_alt_text, ci.alt_text),
    compose_archetype = coalesce(p_compose_archetype, ci.compose_archetype),
    payload           = coalesce(p_payload, ci.payload),
    rationale         = coalesce(p_rationale, ci.rationale),
    topic_id          = coalesce(p_topic_id, ci.topic_id),
    status            = case when ci.status = 'proposed' then 'draft' else ci.status end,
    updated_at        = now()
  where ci.id = v_write.content_item_id;

  update public.on_demand_writes
     set state = 'written', settled_at = now()
   where id = p_write_id;

  -- Le crédit est réglé avec son coût réel, comme partout ailleurs.
  perform public.settle_credit(v_write.reservation_id, p_cost_usd, true);

  return jsonb_build_object('ok', true, 'reason', 'written', 'id', v_write.content_item_id);
end
$$;

comment on function public.apply_on_demand_write(uuid, text, text, text, text, text, jsonb, text, uuid, numeric) is
  'Writes a generated post onto its item and settles the credit, in one transaction. Idempotent on the write row''s state: a replayed generation does not rewrite and does not re-charge.';

revoke all on function public.apply_on_demand_write(uuid, text, text, text, text, text, jsonb, text, uuid, numeric) from public, anon;
grant execute on function public.apply_on_demand_write(uuid, text, text, text, text, text, jsonb, text, uuid, numeric) to authenticated, service_role;


create or replace function public.release_on_demand_write(p_write_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_write public.on_demand_writes%rowtype;
  v_error text;
  v_kit   uuid;
begin
  select * into v_write from public.on_demand_writes where id = p_write_id;
  if not found then
    return public.content_error('not_found');
  end if;

  select ci.brand_kit_id into v_kit from public.content_items ci where ci.id = v_write.content_item_id;
  v_error := public.content_kit_access(v_kit);
  if v_error is not null then
    return public.content_error(v_error);
  end if;

  if v_write.state <> 'reserved' then
    return jsonb_build_object('ok', true, 'reason', 'not_reserved');
  end if;

  /*
   * ⚠ LA LIGNE EST SUPPRIMÉE, PAS MARQUÉE. Une génération qui échoue ne doit
   * pas bloquer la suivante : si la ligne restait avec sa clef, un nouveau
   * « Write it » identique retrouverait un écrit mort et ne repartirait
   * jamais. Le crédit, lui, est relâché — rien n'a été produit.
   */
  perform public.settle_credit(v_write.reservation_id, null, false);
  delete from public.on_demand_writes where id = p_write_id;

  return jsonb_build_object('ok', true, 'reason', 'released');
end
$$;

revoke all on function public.release_on_demand_write(uuid) from public, anon;
grant execute on function public.release_on_demand_write(uuid) to authenticated, service_role;


-- ============================================================================
-- Et l'écran relit ce qui a été écrit
-- ============================================================================
-- Corps de `20260921110000`, plus `payload`. Repris en entier : `create or
-- replace` remplace tout, et une clef perdue disparaît de tous les écrans en
-- silence — ce qui est déjà arrivé une fois avec `theme`.
create or replace function public.content_item_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'id',            ci.id,
    'brand_kit_id',  ci.brand_kit_id,
    'archetype',     ci.archetype,
    'register',      ci.register,
    'month_id',      ci.month_id,
    'theme',         ci.theme,
    'status',        ci.status,
    'title',         ci.title,
    'caption',       ci.caption,
    'on_image_text', ci.on_image_text,
    'alt_text',      ci.alt_text,
    'tags',          to_jsonb(ci.tags),
    'category',      ci.category,
    'image_slot',    ci.image_slot,
    'scheduled_for', ci.scheduled_for,
    'created_at',    ci.created_at,
    'updated_at',    ci.updated_at,
    'posted',        coalesce(last_pub.action = 'published', false),
    'posted_at',     case when last_pub.action = 'published' then last_pub.occurred_at end,
    'channel',       case when last_pub.action = 'published' then last_pub.channel end,
    'rationale',     ci.rationale,
    'compose_archetype', ci.compose_archetype,
    -- Le diagramme de CE post, quand il en a un à lui.
    'payload',       ci.payload,
    'topic',         case when t.id is null then null else jsonb_build_object(
                       'id',          t.id,
                       'angle',       t.intent,
                       'angle_label', ci_intent.label,
                       'archetype_key', t.archetype_key,
                       'timely',      t.timely
                     ) end
  )
  from public.content_items ci
  left join public.content_topics  t         on t.id = ci.topic_id
  left join public.content_intents ci_intent on ci_intent.id = t.intent
  left join lateral (
    select cp.action, cp.occurred_at, cp.channel
      from public.content_publications cp
     where cp.content_item_id = ci.id
     order by cp.occurred_at desc, cp.id desc
     limit 1
  ) last_pub on true
  where ci.id = p_id
$function$;


-- ============================================================================
-- GUARD RAILS
-- ============================================================================
do $guard$
declare
  v_def text;
  v_key text;
  v_expected text[] := array[
    'alt_text','archetype','brand_kit_id','caption','category','channel',
    'compose_archetype','created_at','id','image_slot','month_id',
    'on_image_text','payload','posted','posted_at','rationale','register',
    'scheduled_for','status','tags','theme','title','topic','updated_at'
  ];
begin
  -- ── 1. Le json porte encore toutes ses clefs, plus `payload` ────────────
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'content_item_json';
  foreach v_key in array v_expected loop
    if v_def not like '%''' || v_key || '''%' then
      raise exception 'content_item_json a perdu la clef %', v_key;
    end if;
  end loop;

  -- ── 2. Le payload N'EST PAS patchable depuis l'éditeur ──────────────────
  -- ⚠ Il vient de la génération, qui l'a fait valider par le modèle puis par
  -- la garde déontologique. Le rendre patchable ouvrirait un chemin où un
  -- diagramme arrive sans être passé par l'un ni par l'autre.
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'update_content_item';
  if v_def like '%''payload''%' then
    raise exception 'update_content_item accepte payload; un diagramme pourrait entrer sans garde';
  end if;

  -- ── 3. Le navigateur ne touche ni la table d'écritures ni ses fonctions ─
  if has_table_privilege('authenticated', 'public.on_demand_writes', 'INSERT') then
    raise exception 'authenticated peut insérer dans on_demand_writes; elle pourrait se réserver un crédit';
  end if;
  if has_function_privilege('anon', 'public.begin_on_demand_write(uuid,text)'::regprocedure, 'EXECUTE') then
    raise exception 'anon peut démarrer une écriture';
  end if;

  -- ── 4. Les suggestions passent par le contrôle de droit ─────────────────
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'suggest_topics_for_kit';
  if v_def not like '%content_kit_access%' then
    raise exception 'suggest_topics_for_kit ne vérifie pas le droit; un kit impayé recevrait la banque';
  end if;

  -- ── 5. Un payload sans mise en page est refusé ──────────────────────────
  if not exists (
    select 1 from pg_constraint
     where conname = 'content_items_payload_needs_archetype'
       and conrelid = 'public.content_items'::regclass
  ) then
    raise exception 'la contrainte payload/compose_archetype a disparu';
  end if;
end
$guard$;


-- ============================================================================
-- DOWN
-- ============================================================================
--   drop function if exists public.release_on_demand_write(uuid);
--   drop function if exists public.apply_on_demand_write(uuid,text,text,text,text,text,jsonb,text,uuid,numeric);
--   drop function if exists public.begin_on_demand_write(uuid,text);
--   drop table if exists public.on_demand_writes;
--   drop function if exists public.suggest_topics_for_kit(uuid,date,integer,uuid[]);
--   drop trigger if exists content_items_payload_ethics_gate on public.content_items;
--   drop function if exists public.content_items_payload_ethics_gate();
--   alter table public.content_items drop column payload;
--   -- puis restaurer content_item_json depuis 20260921110000
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260921120000', 'a_post_can_be_asked_for');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260921140000_a_refused_attempt_still_cost_money.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Une tentative refusée a coûté des jetons, et le livre l'ignorait
-- ============================================================================
-- ⚠ LA PLOMBERIE ÉTAIT COMPLÈTE, ET UNE VALEUR `null` LA TRAVERSAIT.
--
-- `settle_credit(p_reservation_id, p_actual_cost_usd, p_succeeded => false)`
-- écrit depuis toujours une ligne `release` qui REND le crédit ET porte
-- `actual_cost_usd`. Les deux choses sont déjà séparées en base : le crédit
-- utilisateur et l'argent dépensé auprès du fournisseur.
--
-- `release_on_demand_write` appelait pourtant `settle_credit(…, null, false)`.
-- Le crédit revenait, ce qui est juste ; la dépense disparaissait, ce qui ne
-- l'est pas. Mesuré le 2026-09-21 : sur onze appels de « Write it », trois ont
-- abouti et huit ont été refusés par le budget de mots. Le livre portait le
-- coût des trois. Un plafond de dépense lu là sous-déclarait donc d'exactement
-- ce qui rate — c'est-à-dire de la majorité.
--
-- Le paramètre est AJOUTÉ avec un défaut, jamais substitué : les appelants qui
-- ne le passent pas se comportent exactement comme avant.
--
-- ⚠ ET LE CRÉDIT REVIENT TOUJOURS. Enregistrer la dépense n'est pas facturer :
-- `settle_credit` écrit `delta = -r.delta` sur une release, et rien ici ne
-- touche à ce calcul. Une tentative refusée coûte de l'argent à Eklio et ne
-- coûte rien à la praticienne.

-- ⚠ L'ANCIENNE SIGNATURE EST RETIRÉE, PAS LAISSÉE À CÔTÉ. Deux surcharges dont
-- l'une a un défaut rendent tout appel à un seul argument ambigu — « function
-- is not unique » — et PostgREST choisit par NOM d'argument, donc la panne
-- n'apparaîtrait qu'au premier appelant positionnel. La nouvelle signature
-- couvre exactement l'ancienne : `p_cost_usd` vaut `null` par défaut, ce qui
-- est le comportement d'avant, au caractère près.
drop function if exists public.release_on_demand_write(uuid);

create or replace function public.release_on_demand_write(
  p_write_id uuid,
  p_cost_usd numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_write public.on_demand_writes%rowtype;
  v_error text;
  v_kit   uuid;
begin
  select * into v_write from public.on_demand_writes where id = p_write_id;
  if not found then
    return public.content_error('not_found');
  end if;

  select ci.brand_kit_id into v_kit from public.content_items ci where ci.id = v_write.content_item_id;
  v_error := public.content_kit_access(v_kit);
  if v_error is not null then
    return public.content_error(v_error);
  end if;

  if v_write.state <> 'reserved' then
    return jsonb_build_object('ok', true, 'reason', 'not_reserved');
  end if;

  -- ⚠ LE COÛT PASSE, LE CRÉDIT REVIENT. C'est toute la réparation.
  perform public.settle_credit(v_write.reservation_id, p_cost_usd, false);
  delete from public.on_demand_writes where id = p_write_id;

  return jsonb_build_object('ok', true, 'reason', 'released');
end
$function$;

-- ⚠ LA SURFACE ANONYME NE S'ÉLARGIT PAS. Une fonction naît avec EXECUTE
-- accordé à PUBLIC ; `20260902090000_revoke_internal_function_surface.sql` le
-- documente, et une signature nouvelle est une fonction nouvelle.
revoke all on function public.release_on_demand_write(uuid, numeric) from public, anon;
grant execute on function public.release_on_demand_write(uuid, numeric) to authenticated, service_role;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260921140000', 'a_refused_attempt_still_cost_money');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260923100000_a_paid_batch_survives_a_crash.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — un lot déjà payé survit à une panne
-- ============================================================================
--
-- ⚠ MESURÉ, PAS SUPPOSÉ : 0,81 $ D'APPELS DÉJÀ PAYÉS ONT ÉTÉ JETÉS.
--
-- Le 2026-09-23, un remplissage de banque accumulait 695 réponses en mémoire
-- et insérait à la fin. PostgreSQL est tombé au 280ᵉ appel. La banque n'a pas
-- gagné un sujet, et l'argent était dépensé.
--
-- Le même défaut existait dans la génération mensuelle, sous une forme plus
-- chère.
--
-- ── ⚠ UN LOT BATCH EST FACTURÉ À LA SOUMISSION ─────────────────────────
--
-- Entre `batches.create` et la première réponse il se passe vingt-cinq à
-- trente minutes. Dans cette fenêtre l'argent est dépensé et le résultat
-- n'existe nulle part chez nous — et l'identifiant du lot ne vivait que dans
-- une ligne de log. Un processus qui mourait là ne pouvait même pas aller
-- CHERCHER ce qu'il avait payé : il fallait re-soumettre, donc repayer.
--
-- Le harnais local résout ça avec un fichier (`.eklio-journal/`). Vercel n'a
-- pas de système de fichiers qui survive à l'invocation : il faut ces deux
-- tables. Tant qu'elles n'existent pas, **une génération mensuelle
-- interrompue en production est intégralement reperdue et repayée**.
--
-- ── CE QUE CES TABLES NE FONT PAS ───────────────────────────────────────
--
-- Elles ne publient rien. Un mois ne s'écrit dans `content_items` qu'une fois
-- ENTIER et CONTRÔLÉ — le contrôle de mélange ne peut pas juger un mois sur
-- vingt-neuf posts. Elles séparent donc deux choses qui étaient confondues :
-- le TRAVAIL PAYÉ, qui doit survivre à tout, et la PUBLICATION, qui doit
-- rester atomique.
-- ============================================================================


-- ============================================================================
-- Une ligne par (kit, mois) : le lot, son état, quand il a été soumis
-- ============================================================================

create table if not exists public.content_generation_runs (
  id            uuid primary key default gen_random_uuid(),
  brand_kit_id  uuid not null references public.brand_kits(id) on delete cascade,
  month         date not null,
  -- ⚠ L'IDENTIFIANT DU LOT, ÉCRIT AVANT L'ATTENTE. C'est la seule fenêtre où
  -- cette écriture change quelque chose : après, il est trop tard pour aller
  -- rechercher ce qui a été payé.
  batch_id      text,
  state         text not null default 'submitted',
  -- Ce que le mois a coûté jusqu'ici, pour qu'une reprise n'ait pas à le
  -- recalculer depuis des réponses qu'elle n'a plus.
  cost_usd      numeric(10, 5) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  closed_at     timestamptz,

  constraint content_generation_runs_state_check
    check (state in ('submitted', 'collected', 'published', 'abandoned')),
  -- ⚠ LE PREMIER DU MOIS, COMME PARTOUT AILLEURS DANS CE SCHÉMA.
  constraint content_generation_runs_month_check
    check (month = date_trunc('month', month)::date),
  -- Un kit n'a qu'un mois en cours à la fois : deux lots ouverts sur le même
  -- mois, c'est le mois payé deux fois.
  constraint content_generation_runs_unique unique (brand_kit_id, month)
);

comment on table public.content_generation_runs is
  'One row per (kit, month) generation attempt. `batch_id` is written BEFORE waiting on the batch: a Batch job is billed at submission, and without its id a process that dies during the 25-minute wait cannot even fetch what it paid for. A resume reattaches to this batch; it never creates a second one.';

comment on column public.content_generation_runs.state is
  'submitted -> the batch exists and is billed. collected -> every result is in content_generation_results. published -> the month is in content_items. abandoned -> older than the 29 days Anthropic keeps a batch readable, so it can never be reattached.';

create index if not exists content_generation_runs_open_idx
  on public.content_generation_runs (state, created_at)
  where state in ('submitted', 'collected');


-- ============================================================================
-- Une ligne par sujet : la sortie du modèle, son usage, et si le crédit est soldé
-- ============================================================================

create table if not exists public.content_generation_results (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references public.content_generation_runs(id) on delete cascade,
  topic_id      uuid not null references public.content_topics(id) on delete cascade,
  -- La sortie du modèle, telle qu'elle a été validée. Null quand la réponse
  -- est arrivée mais n'a pas passé la validation : la ligne existe quand même,
  -- parce que l'appel a été payé et qu'une reprise ne doit pas le refaire.
  result        jsonb,
  usage         jsonb not null default '{}'::jsonb,
  /*
   * ⚠ SANS CE DRAPEAU, UNE REPRISE FACTURE DEUX FOIS. Le premier passage a
   * réservé puis soldé un crédit pour ce sujet ; le second, reprenant le même
   * résultat, en consommerait un autre pour un post déjà payé.
   */
  settled       boolean not null default false,
  created_at    timestamptz not null default now(),

  constraint content_generation_results_unique unique (run_id, topic_id)
);

comment on table public.content_generation_results is
  'One row per topic, INSERTED AT SUBMISSION with result null, then filled AS EACH RESULT ARRIVES -- never after the whole stream is in memory. A crash then costs at most the response in flight. `settled` says the credit has already been charged for this topic, so a resume does not charge a second one.';

-- ── ⚠ LES LIGNES EXISTENT DÈS LA SOUMISSION, RÉPONSE OU PAS ─────────────
--
-- Rencontré en vrai le 2026-09-23 sur le chemin local : une reprise a
-- rattaché le bon lot — déjà payé — puis a REFAIT SON TIRAGE. Les deux
-- ensembles se sont trouvés identiques et le mois est passé, parce que
-- `next_topic_for_kit` trie par `created_at desc, id`. C'est une coïncidence
-- d'ordonnancement, pas une garantie : un sujet ajouté, expiré ou pris par
-- une autre praticienne entre les deux, et la reprise paie un lot dont elle
-- ne sait plus lire les réponses.
--
-- ⚠ UN `batch_id` SANS SA LISTE DE SUJETS NE SE REPREND DONC PAS. On avait
-- sauvé de quoi RETROUVER le travail payé, pas de quoi le RECONNAÎTRE.
--
-- D'où l'ordre d'écriture, qui n'est pas négociable :
--
--   1. `content_generation_runs` : la ligne, avec `batch_id`, à la soumission ;
--   2. `content_generation_results` : UNE LIGNE PAR SUJET, `result` à null,
--      dans la même transaction — c'est la liste des sujets du lot ;
--   3. puis chaque `result` se remplit à l'arrivée de sa réponse.
--
-- Sans l'étape 2, la table reste vide pendant les vingt-cinq minutes où la
-- question se pose, et c'est exactement la fenêtre que ces tables existent
-- pour couvrir.

create index if not exists content_generation_results_run_idx
  on public.content_generation_results (run_id);


-- ============================================================================
-- Ni l'une ni l'autre ne se lit depuis un navigateur
-- ============================================================================
-- ⚠ AUCUNE POLICY OUVERTE, ET LE GRANT RÉVOQUÉ EN PLUS. Ces deux tables
-- portent des réponses de modèle non encore contrôlées et l'état d'un crédit.
-- Une cliente qui pourrait y écrire pourrait marquer `settled` sur un sujet
-- qu'elle n'a pas payé.
--
-- Le dépôt révoque explicitement sur ses tables internes — `stripe_events`,
-- `banned_phrases`, `comp_grants`, `on_demand_writes` — parce que
-- `enable row level security` plus une policy qui refuse laisse le GRANT de
-- table en place : `has_table_privilege` répondrait encore vrai, et seul le
-- second verrou se lit dans un audit de privilèges.

alter table public.content_generation_runs enable row level security;
drop policy if exists content_generation_runs_no_browser on public.content_generation_runs;
create policy content_generation_runs_no_browser on public.content_generation_runs
  for all to authenticated, anon using (false) with check (false);
revoke all on table public.content_generation_runs from anon, authenticated;

alter table public.content_generation_results enable row level security;
drop policy if exists content_generation_results_no_browser on public.content_generation_results;
create policy content_generation_results_no_browser on public.content_generation_results
  for all to authenticated, anon using (false) with check (false);
revoke all on table public.content_generation_results from anon, authenticated;


-- ============================================================================
-- Un lot plus vieux que ce qu'Anthropic garde n'est plus rattachable
-- ============================================================================
-- ⚠ VINGT-NEUF JOURS, ET C'EST UNE CONTRAINTE EXTERNE. Passé ce délai, les
-- résultats d'un lot ne sont plus lisibles : une ligne `submitted` plus
-- ancienne ne peut plus être reprise, et la laisser ouverte ferait croire à
-- une reprise possible. Elle est close explicitement, jamais supprimée — ce
-- qu'elle a coûté reste lisible.

create or replace function public.abandon_stale_generation_runs()
returns integer
language sql
security definer
set search_path to ''
as $$
  with closed as (
    update public.content_generation_runs
       set state = 'abandoned',
           closed_at = now(),
           updated_at = now()
     where state in ('submitted', 'collected')
       and created_at < now() - interval '29 days'
    returning 1
  )
  select count(*)::integer from closed;
$$;

comment on function public.abandon_stale_generation_runs() is
  'Closes runs whose batch Anthropic no longer keeps readable (29 days). They are marked abandoned, never deleted: what they cost stays legible.';

revoke all on function public.abandon_stale_generation_runs() from public, anon;
grant execute on function public.abandon_stale_generation_runs() to service_role;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260923100000', 'a_paid_batch_survives_a_crash');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260923110000_the_bank_never_holds_a_practitioners_lines.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — la banque ne détient jamais les lignes d'une praticienne
-- ============================================================================
--
-- ⚠ MESURÉ, PAS SUPPOSÉ : 36 APPELS PAYÉS SUR 260 ONT ÉTÉ JETÉS.
--
-- Le 2026-09-23, un remplissage de banque a écrit 224 sujets pour 260 appels.
-- Les 36 manquants étaient TOUS des `practitioner_card`, et tous refusés sur
-- « schema: a required field is missing ». Pas un ne l'a dit à l'écran : le
-- script comptait ses échecs pour la fin, et la fin n'est jamais venue.
--
-- La cause est une moitié de correction. Depuis l'interdiction d'inventer une
-- identité, on ne demande plus au modèle le CONTENU d'une carte praticienne :
-- ses lignes viennent du brief à la composition — modalité, ville,
-- disponibilité — et de nulle part ailleurs. Mais la contrainte de la banque,
-- elle, exigeait toujours un `lines` de deux à quatre phrases. On a donc
-- continué à PAYER pour des lignes qu'on refusait ensuite d'écrire.
--
-- ── LE DÉFAUT N'EST PAS SEULEMENT COMPTABLE ─────────────────────────────
--
-- Les 39 lignes déjà en banque portent des phrases écrites par un modèle pour
-- une praticienne qui n'existe pas — c'est exactement la matière dont
-- « Rowan Mercier Therapy » était faite. Elles ne sont plus lues par personne
-- depuis que la composition prend le brief, mais elles sont LÀ, et une banque
-- qui détient des lignes de praticienne est une banque d'où une identité peut
-- ressortir.
--
-- On ne les répare pas, on les vide : `{}`, et la contrainte exige désormais
-- `{}`.
--
-- ⚠ LA CONTRAINTE DE `content_items` NE BOUGE PAS. Une carte PUBLIÉE doit
-- toujours porter ses deux à quatre lignes : sinon on imprime une carte vide.
-- Ce qui change est la seule banque, d'où le validateur séparé — les deux
-- tables partageaient une fonction et n'ont pas la même exigence.
-- ============================================================================

create or replace function public.content_topic_bank_payload_valid(p_archetype text, p jsonb)
returns boolean
language sql
stable
set search_path to ''
as $$
  select case
    when p_archetype is null or p is null then false
    when jsonb_typeof(p) <> 'object' then false
    -- ⚠ LE SUJET D'UNE CARTE PRATICIENNE N'A PAS DE CORPS. Son titre et son
    -- accroche restent du modèle : « Where to start », « How I work » ne
    -- nomment personne. Ses lignes, elles, viennent du brief à la composition.
    when p_archetype = 'practitioner_card' then p = '{}'::jsonb
    else public.content_topic_payload_valid(p_archetype, p)
  end;
$$;

comment on function public.content_topic_bank_payload_valid(text, jsonb) is
  'Bank-side payload validation. Identical to content_topic_payload_valid except for practitioner_card, whose bank payload must be empty: a practitioner card''s lines come from her own brief at composition time, never from a model, so the bank has nothing to hold. content_items keeps the strict rule -- a published card still needs its lines.';

-- ⚠ DÉTACHER, VIDER, PUIS RECONTRAINDRE — ET DANS CET ORDRE. L'ancienne
-- contrainte exige `lines` : un `update` qui met `{}` alors qu'elle est encore
-- posée est refusé par la contrainte qu'on est en train de remplacer. Mesuré
-- au premier rejeu de cette migration, sur la ligne « The Cost of Looking
-- Composed ».
alter table public.content_topics drop constraint if exists content_topics_payload_check;

-- Rien n'est perdu : ces lignes ne sont plus lues depuis que la composition
-- prend le brief.
update public.content_topics
   set payload = '{}'::jsonb
 where archetype_key = 'practitioner_card'
   and payload <> '{}'::jsonb;

alter table public.content_topics
  add constraint content_topics_payload_check
  check (public.content_topic_bank_payload_valid(archetype_key, payload));
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260923110000', 'the_bank_never_holds_a_practitioners_lines');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260924100000_every_paid_call_is_in_the_book.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — tout appel payant est dans le livre
-- ============================================================================
--
-- ⚠ MESURÉ : DIX MOIS, TROIS CENTS POSTS, `credit_ledger` INCHANGÉ.
--
-- Le 2026-09-23, après dix générations mensuelles, le livre de crédits portait
-- toujours ses 844 lignes du 21. Le chemin Batch ne réservait rien (F25), et
-- il est LE chemin de production : le synchrone ne sert qu'au premier mois
-- d'un compte, « une nouvelle abonnée n'attend pas trente minutes ».
--
-- Ce trou est bouché côté TypeScript. Mais en le bouchant, trois autres
-- appels payants se sont révélés n'être dans aucun compteur :
--
--   * la RÉPARATION d'un payload qui dépasse son budget de mots ;
--   * la DÉRIVATION DES THÈMES depuis le bilan mensuel ;
--   * le JUGE DE COMPLÉTUDE, ajouté le 24 pour les contrôles de F26.
--
-- Et un quatrième, plus gros, n'y était jamais entré : la GÉNÉRATION DE KIT.
-- C'est la seule ligne du total d'une session qu'on ne savait pas prouver.
--
-- ── ⚠ CES APPELS NE CONSOMMENT PAS DE CRÉDIT, ET DOIVENT ÊTRE AU LIVRE ──
--
-- Un crédit est un post que la praticienne a acheté. Une réparation, un juge,
-- une dérivation de thèmes sont des FRAIS GÉNÉRAUX : les facturer prendrait à
-- la cliente un post qu'elle n'a pas eu. Mais ne pas les écrire du tout, c'est
-- exactement le défaut qu'on répare — une dépense qui n'apparaît nulle part.
--
-- D'où un `kind` de plus, `overhead`, qui prend ZÉRO crédit et porte son coût.
-- `swap` faisait déjà ça (delta 0, quota illimité) ; réutiliser son nom pour
-- un juge de syntaxe aurait rendu le livre illisible.
-- ============================================================================

-- ── 1. Le nouveau genre, et sa gratuité inscrite dans la table ───────────

alter table public.credit_ledger drop constraint if exists credit_ledger_kind_check;
alter table public.credit_ledger
  add constraint credit_ledger_kind_check
  check (kind in ('post_generation', 'swap', 'regeneration', 'custom_visual', 'overhead'));

-- ⚠ LA GRATUITÉ EST UNE CONTRAINTE, PAS UNE CONVENTION. `credit_ledger` a
-- déjà `credit_ledger_swap_is_free_check` pour la même raison : une ligne
-- d'overhead à delta -1 prendrait un post à quelqu'un, et aucune relecture de
-- code ne rattrape ça aussi sûrement qu'un CHECK.
alter table public.credit_ledger drop constraint if exists credit_ledger_overhead_is_free_check;
alter table public.credit_ledger
  add constraint credit_ledger_overhead_is_free_check
  check (kind <> 'overhead' or delta = 0);

comment on constraint credit_ledger_overhead_is_free_check on public.credit_ledger is
  'Overhead entries carry their cost and take no credit. A credit is a post the practitioner bought; a repair, a completeness judge or a theme derivation is not one, and charging her for it would take away a post she never got.';

-- ── 2. La ligne de quota, sans quoi le garde échoue fermé ────────────────
--
-- ⚠ `credit_ledger_apply()` LÈVE EK011 QUAND LE COUPLE (plan, kind) MANQUE,
-- et c'est voulu : `credit_monthly_limit` rend NULL pour « illimité » ET pour
-- « pas de ligne », et lire le second comme le premier rendrait un `kind`
-- mal orthographié gratuit et infini. Il faut donc la poser pour chaque plan.

-- ── ⚠ LA LISTE DES GENRES VIT DANS TROIS TABLES, ET IL FAUT LES TROIS ───
--
-- Trouvé en deux échecs successifs du même rejeu, pas en relisant :
--
--   1. `credit_quotas_kind_check` → l'insertion de la ligne de quota échoue ;
--   2. `credit_balances_kind_check` → `reserve_credit` échoue à la PREMIÈRE
--      réservation, sur un message qui ne parle pas de genre.
--
-- ⚠ C'EST LA MÊME CLASSE DE DÉFAUTS QUE F18 À F25 : une valeur juste, écrite
-- à un endroit, pas lue aux autres. La requête qui les trouve tient en une
-- ligne et n'avait jamais été posée :
--
--   select conrelid::regclass, conname from pg_constraint
--    where pg_get_constraintdef(oid) like '%post_generation%';

alter table public.credit_quotas drop constraint if exists credit_quotas_kind_check;
alter table public.credit_quotas
  add constraint credit_quotas_kind_check
  check (kind in ('post_generation', 'swap', 'regeneration', 'custom_visual', 'overhead'));

alter table public.credit_balances drop constraint if exists credit_balances_kind_check;
alter table public.credit_balances
  add constraint credit_balances_kind_check
  check (kind in ('post_generation', 'swap', 'regeneration', 'custom_visual', 'overhead'));

insert into public.credit_quotas (plan, kind, monthly_limit)
select p.plan, 'overhead', null
  from (select distinct plan from public.credit_quotas) p
on conflict (plan, kind) do nothing;

-- ── 3. Le point d'étranglement accepte le genre, et le garde gratuit ─────

create or replace function public.reserve_credit(
  p_user uuid,
  p_kind text,
  p_reason text,
  p_ref_type text default null,
  p_ref_id uuid default null,
  p_estimated_cost_usd numeric default null,
  p_provider text default null,
  p_model text default null,
  p_month date default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_month date := date_trunc('month', coalesce(p_month, now()))::date;
  v_id    uuid;
  v_delta integer;
begin
  if p_user is null then
    return jsonb_build_object('ok', false, 'reason', 'no_user');
  end if;

  if p_kind is null
     or p_kind not in ('post_generation', 'swap', 'regeneration', 'custom_visual', 'overhead') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_kind');
  end if;

  -- ⚠ THE CHOKEPOINT. Comp grants are already inside it.
  if not public.check_monthly_presence_entitlement(p_user) then
    return jsonb_build_object('ok', false, 'reason', 'not_entitled');
  end if;

  if p_estimated_cost_usd is not null and p_estimated_cost_usd < 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_cost');
  end if;

  -- A swap takes nothing; overhead takes nothing; everything else takes one.
  v_delta := case when p_kind in ('swap', 'overhead') then 0 else -1 end;

  begin
    insert into public.credit_ledger
      (user_id, kind, entry_type, delta, reason, ref_type, ref_id, month,
       estimated_cost_usd, provider, model)
    values
      (p_user, p_kind, 'reservation', v_delta, coalesce(nullif(btrim(p_reason), ''), p_kind),
       p_ref_type, p_ref_id, v_month,
       case when p_kind = 'swap' then null else p_estimated_cost_usd end,
       p_provider, p_model)
    returning id into v_id;
  exception
    -- ⚠ ONLY THE TWO CODES credit_ledger_apply() RAISES, NEVER
    -- `check_violation` WHOLESALE. The first version caught check_violation,
    -- and the guard rail below caught it doing so: a malformed call (a
    -- ref_type with no ref_id, which the row's own CHECK refuses) came back to
    -- the caller as `quota_exhausted`. That is a lie about her account, and it
    -- would have sent someone to a checkout page to buy credits she already
    -- had. A shape violation is a programming error and must keep crossing
    -- the boundary as one.
    when sqlstate 'EK010' then
      return jsonb_build_object('ok', false, 'reason', 'quota_exhausted',
                                'kind', p_kind, 'month', v_month);
    when sqlstate 'EK011' then
      return jsonb_build_object('ok', false, 'reason', 'no_quota_configured',
                                'kind', p_kind);
  end;

  return jsonb_build_object('ok', true, 'reason', 'reserved',
                            'reservation_id', v_id, 'month', v_month);
end
$$;

comment on function public.reserve_credit(uuid, text, text, text, uuid, numeric, text, text, date) is
  'The only door to a paid call. Every path -- batch, synchronous, repair, theme derivation, completeness judge, kit generation -- goes through it, and the quota ceiling is enforced by credit_ledger_apply() in the same statement that moves the number. `overhead` takes no credit and still books its cost: a dollar spent nowhere in the book is the defect F18 through F25 kept finding.';

-- ── 4. Ce qu'un mois doit faire grossir, en une requête ──────────────────
--
-- ⚠ ELLE N'AVAIT JAMAIS ÉTÉ POSÉE, et c'est pour ça que dix mois ont pu ne
-- rien écrire. Une vue rend la vérification triviale, donc faisable à chaque
-- mise en production plutôt qu'une fois par incident.

create or replace view public.credit_month_audit as
  select l.user_id,
         l.month,
         l.kind,
         count(*) filter (where l.entry_type = 'reservation') as reservations,
         count(*) filter (where l.entry_type = 'settlement')  as settlements,
         count(*) filter (where l.entry_type = 'release')     as releases,
         sum(coalesce(l.actual_cost_usd, l.estimated_cost_usd, 0))::numeric(12, 5) as cost_usd
    from public.credit_ledger l
   group by l.user_id, l.month, l.kind;

comment on view public.credit_month_audit is
  'One row per (user, month, kind): how many reservations, settlements and releases, and what they cost. A generated month must show thirty post_generation reservations; if it shows none, no credit was taken and the counter is not counting.';

-- ⚠ La vue hérite de la RLS de `credit_ledger` (security_invoker), donc une
-- cliente n'y voit que ses lignes. Sans ce réglage une vue est lue avec les
-- droits de son PROPRIÉTAIRE, et celle-ci ouvrirait le livre entier.
alter view public.credit_month_audit set (security_invoker = on);
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260924100000', 'every_paid_call_is_in_the_book');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260924120000_an_eyebrow_is_a_label_not_a_code.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — un surtitre est un libellé, pas un code
-- ============================================================================
--
-- ⚠ « ONLY ONE » A ÉTÉ IMPRIMÉ SUR UNE CARTE PUBLIABLE, AU-DESSUS D'UN
-- DIAGRAMME À QUATRE BLOCS.
--
-- Une notation indépendante l'a lu comme un drapeau de pagination interne.
-- Ce n'en était pas un, et la vérité est pire : `content_intents.label` porte
-- « You are not the only one » pour `normalise`, et `eyebrowFor` en retirait
-- les mots outils — you, are, not, the — avant de garder les trois premiers
-- restants. Il restait « ONLY ONE », qui dit le CONTRAIRE de la phrase dont il
-- vient, sur la carte d'une clinicienne.
--
-- ── ⚠ LA BANDE MONO TIENT VINGT-DEUX CARACTÈRES ────────────────────────
--
-- « You are not the only one » en fait vingt-quatre, et six mots pour un
-- plafond de quatre. Le libellé ne tenait pas, et c'est le CODE qui le
-- rabotait au lieu du catalogue d'être juste.
--
-- Les cinq libellés, mesurés :
--
--   behind_the_practice  « Behind the practice »     19 car., 3 mots  ✓
--   correct_a_myth       « Myth, gently corrected »  22 car., 3 mots  ✓
--   educate              « How the work works »      18 car., 4 mots  ✓
--   invite               « A soft invitation »       17 car., 3 mots  ✓
--   normalise            « You are not the only one » 24 car., 6 mots ✗
--
-- Un seul dépasse. Il est raccourci ici, dans la table où quelqu'un l'a
-- écrit — pas dans une fonction qui le découpe à la volée.
-- ============================================================================

update public.content_intents
   set label = 'Not the only one'
 where id = 'normalise'
   and label = 'You are not the only one';

-- ── ⚠ ET AUCUN LIBELLÉ NE PEUT PLUS DÉPASSER LA BANDE ───────────────────
--
-- Sans cette contrainte, la sixième intention arrive avec une phrase et se
-- fait raboter en silence, exactement comme la cinquième. La borne est celle
-- du rendu : `EYEBROW_MAX_WORDS = 4`, `EYEBROW_MAX_CHARS = 22`.
--
-- ⚠ LES DEUX BORNES VIVENT DANS DEUX DÉPÔTS, et c'est assumé : le rendu les
-- applique, la base les garantit. Une seule des deux suffirait à refuser, mais
-- seule celle-ci empêche la donnée fautive d'exister.

alter table public.content_intents drop constraint if exists content_intents_label_fits_band;
alter table public.content_intents
  add constraint content_intents_label_fits_band
  check (
    length(btrim(label)) between 1 and 22
    and array_length(regexp_split_to_array(btrim(label), '\s+'), 1) between 1 and 4
  );

comment on constraint content_intents_label_fits_band on public.content_intents is
  'An eyebrow label has to fit the mono band as written: at most four words and twenty-two characters. "You are not the only one" fit neither, and the renderer shortened it to "ONLY ONE" -- printed above a four-block diagram on a clinician''s card, saying the opposite of the sentence it came from. A label that does not fit is refused here rather than trimmed there.';
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260924120000', 'an_eyebrow_is_a_label_not_a_code');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260924130000_the_bank_is_counted_before_it_is_drawn.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — compter la banque avec la requête qui la tire
-- ============================================================================
--
-- ⚠ LE QUATRIÈME ESSAI DU 2026-09-23 N'A TIRÉ QUE 18 CANDIDATS SUR 54.
--
-- La banque portait 88 sujets libres — assez, en apparence. Mais `cycle` et
-- `numbered_strategies` n'en avaient que cinq chacun, et un mois ne se compose
-- pas avec ça. Le total mentait, et il a menti au moment exact où il fallait
-- décider de remplir.
--
-- ── ⚠ ET LA SURVEILLANCE NE POSAIT PAS LA MÊME QUESTION QUE LE TIRAGE ────
--
-- La requête de surveillance de F13 compte les sujets « non assignés ». Le
-- tirage, lui, écarte en plus : ce que CE kit a déjà pris, ce qu'une consœur
-- du même État et de la même modalité a pris dans les 90 jours, les sujets
-- non relus sur le plan éthique, les expirés, et ceux dont le segment ne
-- correspond ni à la modalité ni au persona de la praticienne.
--
-- Deux questions différentes, dont une seule décide si le mois sort. La
-- surveillance rassurait donc sur un stock que le tirage ne voyait pas.
--
-- ⚠ UNE SEULE DÉFINITION, PAS DEUX. `next_topic_for_kit` devient un `limit 1`
-- posé sur la liste, et le compteur groupe la MÊME liste par archétype. Deux
-- requêtes tenues à la main auraient divergé au premier filtre ajouté — et
-- c'est la divergence qui a coûté l'essai.
-- ============================================================================

create or replace function public.drawable_topics_for_kit(
  p_brand_kit_id uuid,
  p_archetype text default null
)
returns table (topic_id uuid, archetype_key text)
language sql
stable
security definer
set search_path to ''
as $$
  with kit as materialized (
    select coalesce(pb.modality_ids, '{}')       as modalities,
           coalesce(pb.client_persona_ids, '{}') as personas,
           upper(nullif(btrim(coalesce(pb.state, '')), '')) as state_code,
           pr.user_id                            as user_id
      from public.brand_kits bk
      join public.projects      pr on pr.id = bk.project_id
      left join public.project_briefs pb on pb.project_id = pr.id
     where bk.id = p_brand_kit_id
  ),
  /*
   * ⚠ `as materialized`, ET C'EST LE MOT QUI FAIT TOUT. Sans lui, PostgreSQL
   * inline le CTE et repousse la corrélation sur `t.id` à l'intérieur, ce qui
   * restaure la sous-requête par sujet candidat que cette forme supprime.
   */
  blocked as materialized (
    select distinct ta.topic_id
      from public.topic_assignments ta
      join public.brand_kits   obk on obk.id = ta.brand_kit_id
      join public.projects     opr on opr.id = obk.project_id
      left join public.project_briefs opb on opb.project_id = opr.id
     cross join kit k
     where ta.assigned_at > now() - public.topic_collision_window()
       and opr.user_id is distinct from k.user_id
       and k.state_code is not null
       and upper(nullif(btrim(coalesce(opb.state, '')), '')) = k.state_code
       and coalesce(opb.modality_ids, '{}') && k.modalities
  ),
  mine as materialized (
    select ta.topic_id from public.topic_assignments ta
     where ta.brand_kit_id = p_brand_kit_id
  )
  select t.id, t.archetype_key
    from public.content_topics t
    join public.content_segments s on s.id = t.segment_id
   cross join kit k
   where t.ethics_reviewed_at is not null
     and (t.expires_at is null or t.expires_at > now())
     and (p_archetype is null or t.archetype_key = p_archetype)
     and not exists (select 1 from mine m where m.topic_id = t.id)
     and not exists (select 1 from blocked b where b.topic_id = t.id)
     and (s.modality_id = any (k.modalities) or s.persona_id = any (k.personas))
     and (s.state_code is null or s.state_code = k.state_code)
   order by
     (case when s.modality_id = any (k.modalities) then 2 else 0 end)
     + (case when s.persona_id = any (k.personas) then 2 else 0 end)
     + (case when s.state_code is not null then 1 else 0 end)
     + (case when t.timely then 3 else 0 end)
     desc,
     t.created_at desc,
     t.id
$$;

comment on function public.drawable_topics_for_kit(uuid, text) is
  'Every topic this kit could draw right now, in the order the draw would take them. next_topic_for_kit is a limit 1 over this list, and the per-archetype count that decides whether to refill is a group by over the same list -- so the monitoring query and the draw can never answer differently, which is exactly what cost the fourth attempt of 2026-09-23: 88 free topics in total, five in the two archetypes that mattered.';

/*
 * ⚠ LE TIRAGE DEVIENT UN `limit 1` SUR LA LISTE. Il garde le même contrat —
 * un uuid ou null — et perd sa copie des filtres.
 */
create or replace function public.next_topic_for_kit(
  p_brand_kit_id uuid,
  p_month date,
  p_archetype text default null
)
returns uuid
language sql
stable
security definer
set search_path to ''
as $$
  select d.topic_id
    from public.drawable_topics_for_kit(p_brand_kit_id, p_archetype) d
   limit 1
$$;

/*
 * Le compteur par archétype : la même liste, groupée.
 *
 * ⚠ IL REND AUSSI LES ARCHÉTYPES À ZÉRO. Un archétype absent du résultat se
 * lit « pas de ligne », et une ligne manquante ne se compare à aucun seuil —
 * c'est le cas qui fait sortir un mois court.
 */
create or replace function public.drawable_count_for_kit(p_brand_kit_id uuid)
returns table (archetype_key text, drawable bigint)
language sql
stable
security definer
set search_path to ''
as $$
  select k.archetype_key,
         count(d.topic_id) as drawable
    from (select distinct archetype_key from public.content_topics) k
    left join public.drawable_topics_for_kit(p_brand_kit_id) d
           on d.archetype_key = k.archetype_key
   group by k.archetype_key
   order by drawable asc, k.archetype_key
$$;

revoke all on function public.drawable_topics_for_kit(uuid, text) from public;
revoke all on function public.drawable_count_for_kit(uuid) from public;
grant execute on function public.drawable_topics_for_kit(uuid, text) to authenticated, service_role;
grant execute on function public.drawable_count_for_kit(uuid) to authenticated, service_role;

/*
 * ── ⚠ LA PREUVE QUE LES DEUX RÉPONSES SONT LA MÊME ──────────────────────
 *
 * Sans elle, ce fichier n'aurait affirmé la non-divergence que par sa mise en
 * page. Sur chaque kit qui porte un brief, le tirage doit rendre exactement la
 * tête de la liste, et le compteur exactement sa longueur.
 */
do $$
declare
  v_kit uuid;
  v_next uuid;
  v_head uuid;
  v_counted bigint;
  v_listed bigint;
begin
  for v_kit in
    select bk.id from public.brand_kits bk
      join public.projects pr on pr.id = bk.project_id
      join public.project_briefs pb on pb.project_id = pr.id
     limit 25
  loop
    select public.next_topic_for_kit(v_kit, date_trunc('month', now())::date) into v_next;
    select d.topic_id into v_head
      from public.drawable_topics_for_kit(v_kit) d limit 1;
    if v_next is distinct from v_head then
      raise exception 'le tirage et la liste divergent sur le kit %: % vs %', v_kit, v_next, v_head;
    end if;

    select coalesce(sum(drawable), 0) into v_counted
      from public.drawable_count_for_kit(v_kit);
    select count(*) into v_listed from public.drawable_topics_for_kit(v_kit);
    if v_counted <> v_listed then
      raise exception 'le compteur et la liste divergent sur le kit %: % vs %', v_kit, v_counted, v_listed;
    end if;
  end loop;
end $$;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260924130000', 'the_bank_is_counted_before_it_is_drawn');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260924140000_an_assignment_that_delivered_nothing_is_not_held.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — une assignation qui n'a rien livré ne retient rien
-- ============================================================================
--
-- ⚠ NEUF CENT QUINZE SUJETS ÉTAIENT ASSIGNÉS À DES KITS SANS UN SEUL POST.
--
-- Mesuré le 2026-09-24 : vingt-quatre kits orphelins sur 2026-11 retenaient
-- 858 sujets, plus 57 sur 2026-10. Le résidu de toutes les exécutions
-- interrompues — un run tué, un lot en erreur, une session coupée — et la
-- fenêtre anti-collision les retirait à TOUT LE SEGMENT pendant quatre-vingt-
-- dix jours, pour des posts que personne n'a jamais écrits.
--
-- ⚠ ET ON S'APPRÊTAIT À RACHETER CE QU'ON POSSÉDAIT DÉJÀ. Le dimensionnement
-- de F13 compte ce qu'un essai CONSOMME et suppose que le reste revient. Ça ne
-- revient que si quelqu'un le rend. En production, le stock s'érode à chaque
-- incident et la facture de banque grossit sans qu'aucun sujet n'ait servi.
--
-- ── DEUX VERROUS, PARCE QU'UN SEUL NE SUFFIT PAS ────────────────────────
--
-- 1. LE TIRAGE CESSE DE LES VOIR. Une assignation sans `content_item` et plus
--    vieille que le délai de grâce ne bloque plus personne — même si
--    personne ne l'a effacée. C'est le verrou qui tient tout seul.
-- 2. UN BALAI LES EFFACE. `release_stale_topic_assignments()` les supprime, et
--    la génération l'appelle avant de tirer. C'est le verrou qui garde la
--    table propre et qui rend le nombre visible.
--
-- ⚠ LE DÉLAI DE GRÂCE DOIT ÊTRE PLUS LONG QU'UNE GÉNÉRATION. Un lot met
-- vingt-cinq à trente minutes ; le harnais abandonne à quatre-vingt-dix. Trois
-- heures laissent une génération légitime finir sans se faire voler ses
-- sujets, et rendent un incident au tour suivant plutôt qu'au trimestre
-- suivant.
-- ============================================================================

create or replace function public.topic_assignment_grace()
returns interval
language sql
immutable
set search_path to ''
as $$
  select interval '3 hours'
$$;

comment on function public.topic_assignment_grace() is
  'How long an assignment may hold a topic without a content_item behind it. It must exceed a whole generation -- a batch takes 25 to 30 minutes and the harness gives up at 90 -- so a legitimate run in flight is never robbed of the topics it is writing. Past it, the assignment delivered nothing and stops blocking the segment.';

/*
 * ⚠ CE QU'UNE ASSIGNATION RETIENT VRAIMENT.
 *
 * Elle retient si elle a produit un post, OU si elle est encore dans son délai
 * de grâce — c'est-à-dire si une génération est peut-être en train de l'écrire.
 * Tout le reste est un résidu.
 */
create or replace function public.topic_assignment_holds(
  p_brand_kit_id uuid,
  p_topic_id uuid,
  p_assigned_at timestamptz
)
returns boolean
language sql
stable
set search_path to ''
as $$
  select p_assigned_at > now() - public.topic_assignment_grace()
      or exists (
        select 1 from public.content_items ci
         where ci.topic_id = p_topic_id
           and ci.brand_kit_id = p_brand_kit_id
      )
$$;

/*
 * ⚠ LE BALAI. Il rend le nombre visible : sans lui, la banque « se répare »
 * en silence et personne n'apprend qu'un run a été tué.
 */
create or replace function public.release_stale_topic_assignments()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_released integer;
begin
  with gone as (
    delete from public.topic_assignments ta
     where not public.topic_assignment_holds(ta.brand_kit_id, ta.topic_id, ta.assigned_at)
    returning 1
  )
  select count(*) into v_released from gone;
  return v_released;
end;
$$;

comment on function public.release_stale_topic_assignments() is
  'Deletes every assignment that delivered no content_item and is past the grace period, and returns how many. Generation calls it before drawing. 915 topics were held this way on 2026-09-24 by twenty-six kits with no posts at all -- the residue of killed runs and errored batches -- and the collision window withheld them from the whole segment for ninety days.';

revoke all on function public.release_stale_topic_assignments() from public;
grant execute on function public.release_stale_topic_assignments() to authenticated, service_role;

/*
 * ── ⚠ ET LE TIRAGE CESSE DE LES VOIR, BALAI OU PAS ──────────────────────
 *
 * `drawable_topics_for_kit` est la source unique : `next_topic_for_kit` en est
 * un `limit 1`, `drawable_count_for_kit` un `group by`. Le filtre posé ici
 * vaut donc pour les trois d'un coup.
 */
create or replace function public.drawable_topics_for_kit(
  p_brand_kit_id uuid,
  p_archetype text default null
)
returns table (topic_id uuid, archetype_key text)
language sql
stable
security definer
set search_path to ''
as $$
  with kit as materialized (
    select coalesce(pb.modality_ids, '{}')       as modalities,
           coalesce(pb.client_persona_ids, '{}') as personas,
           upper(nullif(btrim(coalesce(pb.state, '')), '')) as state_code,
           pr.user_id                            as user_id
      from public.brand_kits bk
      join public.projects      pr on pr.id = bk.project_id
      left join public.project_briefs pb on pb.project_id = pr.id
     where bk.id = p_brand_kit_id
  ),
  /*
   * ⚠ `as materialized`, ET C'EST LE MOT QUI FAIT TOUT. Sans lui, PostgreSQL
   * inline le CTE et repousse la corrélation sur `t.id` à l'intérieur.
   */
  blocked as materialized (
    select distinct ta.topic_id
      from public.topic_assignments ta
      join public.brand_kits   obk on obk.id = ta.brand_kit_id
      join public.projects     opr on opr.id = obk.project_id
      left join public.project_briefs opb on opb.project_id = opr.id
     cross join kit k
     where ta.assigned_at > now() - public.topic_collision_window()
       -- ⚠ Une consœur qui n'a rien livré ne vous retire rien.
       and public.topic_assignment_holds(ta.brand_kit_id, ta.topic_id, ta.assigned_at)
       and opr.user_id is distinct from k.user_id
       and k.state_code is not null
       and upper(nullif(btrim(coalesce(opb.state, '')), '')) = k.state_code
       and coalesce(opb.modality_ids, '{}') && k.modalities
  ),
  mine as materialized (
    select ta.topic_id from public.topic_assignments ta
     where ta.brand_kit_id = p_brand_kit_id
       -- ⚠ Et un essai tué ne se prive pas lui-même de ses propres sujets.
       and public.topic_assignment_holds(ta.brand_kit_id, ta.topic_id, ta.assigned_at)
  )
  select t.id, t.archetype_key
    from public.content_topics t
    join public.content_segments s on s.id = t.segment_id
   cross join kit k
   where t.ethics_reviewed_at is not null
     and (t.expires_at is null or t.expires_at > now())
     and (p_archetype is null or t.archetype_key = p_archetype)
     and not exists (select 1 from mine m where m.topic_id = t.id)
     and not exists (select 1 from blocked b where b.topic_id = t.id)
     and (s.modality_id = any (k.modalities) or s.persona_id = any (k.personas))
     and (s.state_code is null or s.state_code = k.state_code)
   order by
     (case when s.modality_id = any (k.modalities) then 2 else 0 end)
     + (case when s.persona_id = any (k.personas) then 2 else 0 end)
     + (case when s.state_code is not null then 1 else 0 end)
     + (case when t.timely then 3 else 0 end)
     desc,
     t.created_at desc,
     t.id
$$;

/*
 * ── ⚠ LA PREUVE, SUR DES DONNÉES FABRIQUÉES ET DÉFAITES ────────────────
 *
 * Sans elle, ce fichier n'affirmerait la libération que par sa mise en page.
 */
do $$
declare
  v_kit uuid;
  v_topic uuid;
  v_before bigint;
  v_after bigint;
  v_released integer;
begin
  select bk.id into v_kit
    from public.brand_kits bk
    join public.projects pr on pr.id = bk.project_id
    join public.project_briefs pb on pb.project_id = pr.id
   limit 1;
  if v_kit is null then return; end if;

  select d.topic_id into v_topic from public.drawable_topics_for_kit(v_kit) d limit 1;
  if v_topic is null then return; end if;

  select count(*) into v_before from public.drawable_topics_for_kit(v_kit);

  -- Une assignation fraîche retient : une génération en vol garde ses sujets.
  insert into public.topic_assignments (brand_kit_id, topic_id, month, assigned_at)
  values (v_kit, v_topic, date_trunc('month', now())::date, now());
  select count(*) into v_after from public.drawable_topics_for_kit(v_kit);
  if v_after <> v_before - 1 then
    raise exception 'une assignation fraîche devrait retenir: % puis %', v_before, v_after;
  end if;

  -- La même, vieillie et sans post, ne retient plus rien.
  update public.topic_assignments
     set assigned_at = now() - public.topic_assignment_grace() - interval '1 minute'
   where brand_kit_id = v_kit and topic_id = v_topic;
  select count(*) into v_after from public.drawable_topics_for_kit(v_kit);
  if v_after <> v_before then
    raise exception 'une assignation périmée et vide devrait libérer: % puis %', v_before, v_after;
  end if;

  -- Et le balai l'efface.
  select public.release_stale_topic_assignments() into v_released;
  if v_released < 1 then
    raise exception 'le balai n''a rien libéré alors qu''une assignation périmée existait';
  end if;
  if exists (select 1 from public.topic_assignments where brand_kit_id = v_kit and topic_id = v_topic) then
    raise exception 'le balai a laissé l''assignation périmée en place';
  end if;
end $$;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260924140000', 'an_assignment_that_delivered_nothing_is_not_held');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260924150000_a_backup_that_does_not_restore_is_not_a_backup.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — une sauvegarde qui ne se restaure pas n'est pas une sauvegarde
-- ============================================================================
--
-- ⚠ TROUVÉ EN RÉPÉTANT LA MISE EN PRODUCTION À BLANC, le 2026-09-24. L'étape 2
-- de la liste dit « sauvegarde de la base de production, et vérification
-- qu'elle se restaure ». Elle ne se restaure pas.
--
--   pg_restore: error: COPY failed for table "section_types":
--     violates check constraint "section_types_allowed_pages_check"
--
-- Mesuré sur la base réelle : `section_types` porte **onze** lignes et s'en
-- restaure **zéro**. Et la base restaurée paraît intacte — 89 tables, 301
-- fonctions, 210 policies, identiques de part et d'autre. Seul le compte de
-- lignes d'une table de référence diffère, et personne ne le comptait.
--
-- ── ⚠ LE MÉCANISME : UNE `CHECK` QUI LIT UNE AUTRE TABLE ────────────────
--
-- `section_types_allowed_pages_check` appelle `site_spec_page_keys()`, qui lit
-- `public.site_pages`. À la restauration, `pg_restore` copie `section_types`
-- AVANT `site_pages` — l'ordre est alphabétique, pas dépendanciel pour les
-- références passant par une fonction. La fonction rend donc un tableau vide,
-- et les onze lignes échouent une à une.
--
-- ⚠ ET AUCUNE INVOCATION DE `pg_restore` NE SAUVE ÇA. Sans
-- `--single-transaction`, la table se restaure vide en silence. AVEC, la
-- restauration entière avorte et la base est inutilisable. Une `CHECK` est
-- immédiate par construction : elle ne se diffère pas.
--
-- ── CE QUI CHANGE, ET CE QUI NE CHANGE PAS ──────────────────────────────
--
-- L'invariant est juste et il est GARDÉ : une section ne peut pas s'annoncer
-- sur une page qui n'existe pas. Ce qui change est l'endroit où il se vérifie.
--
--   ce qui reste en `CHECK`       le tableau n'est pas vide — intra-ligne,
--                                 donc restaurable par construction ;
--   ce qui devient un TRIGGER     l'appartenance aux pages de `site_pages`,
--     `DEFERRABLE INITIALLY       vérifiée au COMMIT et non à la ligne, donc
--     DEFERRED`                   satisfaite dès que les deux tables sont là.
--
-- ⚠ LA RESTAURATION SE FAIT DÉSORMAIS AVEC `--single-transaction`, et c'est
-- une consigne, pas une préférence : c'est elle qui rend le contrôle différé
-- utile. Elle est écrite dans l'étape 2 de la liste de mise en production.
--
-- ⚠ ET LE VRAI CORRECTIF DURABLE EST AILLEURS. `allowed_pages` est un
-- `text[]` ; l'invariant est une intégrité référentielle, et une clé étrangère
-- se restaure NATIVEMENT parce que `pg_dump` repose les clés étrangères APRÈS
-- toutes les données. La forme juste est une table de jointure
-- `section_type_pages(section_type_id, page_key)` avec deux clés étrangères.
-- Elle touche le code applicatif : elle est écrite dans `FOLLOWUP.md` plutôt
-- que faite ici, à la fin d'une session de sécurité.
-- ============================================================================

alter table public.section_types drop constraint if exists section_types_allowed_pages_check;

-- ⚠ Intra-ligne seulement. Rien qui lise une autre table.
alter table public.section_types
  add constraint section_types_allowed_pages_check
  check (coalesce(array_length(allowed_pages, 1), 0) > 0);

create or replace function public.section_types_pages_exist()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_missing text[];
begin
  select array_agg(k) into v_missing
    from unnest(new.allowed_pages) as k
   where k not in (select sp.key from public.site_pages sp);

  if v_missing is not null then
    raise exception
      'section_types.allowed_pages cite des pages qui n''existent pas dans site_pages: %',
      array_to_string(v_missing, ', ');
  end if;
  return null;
end;
$$;

comment on function public.section_types_pages_exist() is
  'Checks that allowed_pages names only pages that exist, at COMMIT rather than per row. It used to be a CHECK calling site_spec_page_keys(), and that made the database unrestorable: pg_restore copies section_types before site_pages, so the function saw no pages and all eleven rows failed -- silently, leaving a reference table empty in a backup that otherwise looked identical.';

drop trigger if exists section_types_pages_exist_trigger on public.section_types;
create constraint trigger section_types_pages_exist_trigger
  after insert or update of allowed_pages on public.section_types
  deferrable initially deferred
  for each row execute function public.section_types_pages_exist();

/*
 * ── ⚠ LA PREUVE, DANS LES DEUX SENS ─────────────────────────────────────
 *
 * Sans elle, ce fichier n'affirmerait la correction que par sa mise en page.
 */
do $$
declare
  v_pages text[];
begin
  select array_agg(key) into v_pages from public.site_pages;
  if v_pages is null then return; end if;

  -- Les lignes existantes passent encore.
  if exists (
    select 1 from public.section_types st
     where not (st.allowed_pages <@ v_pages)
  ) then
    raise exception 'une ligne de section_types cite déjà une page inexistante';
  end if;

  -- Et une page inventée est toujours refusée, au COMMIT.
  begin
    insert into public.section_types
      (id, sort_order, label, description, fields, default_enabled, allowed_pages)
    values ('__rehearsal__', 999, 'x', 'y', '[]'::jsonb, false, array['__no_such_page__']);
    -- ⚠ Le trigger est différé : il ne parle qu'ici.
    raise exception '__expected__';
  exception
    when others then
      if position('__no_such_page__' in sqlerrm) = 0 and sqlerrm <> '__expected__' then
        raise exception 'le trigger n''a pas refusé une page inventée: %', sqlerrm;
      end if;
  end;
end $$;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260924150000', 'a_backup_that_does_not_restore_is_not_a_backup');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260924160000_a_licence_number_is_required_in_every_advertisement.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Eklio — un numéro de licence dans chaque publicité
-- ============================================================================
--
-- ⚠ QUATRE CENTS POSTS PRODUITS, ZÉRO NUMÉRO DE LICENCE.
--
-- Trouvé par l'audit du corpus (F35). Californie B&P §4980.44 (LMFT), §4996.2
-- (LCSW) et §4999.80 (LPCC) exigent le TYPE et le NUMÉRO de licence dans
-- **toute** publicité ; le Texas, la Virginie et d'autres imposent
-- l'équivalent. Chacun des quatre cents posts déjà produits est une infraction
-- publicitaire en l'état.
--
-- ⚠ ET CE N'ÉTAIT PAS UN DÉFAUT DE CONTRÔLE. `project_briefs` porte déjà
-- `license_type_id` et `state`, mais aucune colonne pour le NUMÉRO : aucun
-- contrôle ne peut exiger ce qu'il n'y a rien à mettre. C'est la raison pour
-- laquelle le trou a tenu quatre cents posts.
--
-- ── ⚠ LA RÈGLE LA PLUS STRICTE, PAS CINQUANTE RÈGLES ────────────────────
--
-- Les cinquante-et-un territoires servis n'imposent pas la même chose : tous
-- exigent le titre, une partie exige le numéro. Gérer cinquante variantes
-- demanderait de vérifier cinquante boards ET de maintenir la table ensuite ;
-- appliquer la plus stricte partout demande une colonne. Le produit porte donc
-- **abréviation + numéro** dans chaque publicité, dans tous les États.
--
-- Ce choix se paie d'un champ de plus au brief, et il s'achète une conformité
-- qui ne dépend pas de l'exactitude d'une matrice de cinquante lignes.
-- ============================================================================

alter table public.project_briefs
  add column if not exists license_number text,
  add column if not exists license_state_code char(2);

/*
 * ⚠ L'ÉTAT DE DÉLIVRANCE N'EST PAS L'ÉTAT DU CABINET. Une praticienne peut
 * exercer en télésanté depuis un État et porter une licence d'un autre ; c'est
 * le numéro et l'État qui l'a délivré qui identifient la licence auprès du
 * board. Par défaut c'est le même, et la colonne le reste jusqu'à ce que
 * quelqu'un dise le contraire.
 */
comment on column public.project_briefs.license_state_code is
  'The state that ISSUED the licence, which is not always the state the practice sits in: a clinician may work by telehealth from one state under another state''s licence, and it is the issuing board that the number belongs to. Null means "the same as state".';

comment on column public.project_briefs.license_number is
  'The licence number as the board prints it. California B&P 4980.44, 4996.2 and 4999.80 require the licence type AND number in every advertisement, and other states match; the product applies that rule everywhere rather than maintaining fifty variants. Four hundred posts were produced without it because there was no column to put it in -- no check can demand what there is nowhere to write.';

/*
 * ⚠ PAS DE `not null`, ET C'EST VOULU. Les briefs existants n'ont pas ce
 * numéro, et une colonne obligatoire les rendrait tous invalides d'un coup —
 * y compris ceux du harnais, qui servent à mesurer. Le refus se fait au moment
 * de GÉNÉRER, avec un message qui nomme le champ à remplir, pas au moment de
 * lire une ligne écrite avant que la colonne existe.
 *
 * ⚠ MAIS LE FORMAT EST CONTRAINT DÈS QU'IL Y A QUELQUE CHOSE. Un numéro vide,
 * un espace, ou une phrase entière ne sont pas des numéros, et ils
 * s'imprimeraient tels quels sur une carte publiable.
 */
alter table public.project_briefs drop constraint if exists project_briefs_license_number_shape;
alter table public.project_briefs
  add constraint project_briefs_license_number_shape
  check (
    license_number is null
    or (
      btrim(license_number) = license_number
      and char_length(license_number) between 3 and 20
      and license_number ~ '^[A-Za-z0-9][A-Za-z0-9 .#-]*[A-Za-z0-9]$'
      and license_number ~ '[0-9]'
    )
  );

comment on constraint project_briefs_license_number_shape on public.project_briefs is
  'A licence number has digits, no leading or trailing space, and is short. Boards print them in many shapes (LMFT 12345, PSY29384, 0701-004321) so the pattern is permissive about separators and strict about the rest -- but a number that is blank, or a sentence, is not a number, and it would print as written on a publishable card.';

alter table public.project_briefs drop constraint if exists project_briefs_license_state_shape;
alter table public.project_briefs
  add constraint project_briefs_license_state_shape
  check (license_state_code is null or license_state_code ~ '^[A-Z]{2}$');

/*
 * ── ⚠ LA RLS N'A PAS À CHANGER, ET IL FAUT LE DIRE PLUTÔT QUE LE SUPPOSER ──
 *
 * Les policies de `project_briefs` sont au niveau de la LIGNE : elles
 * autorisent une praticienne à lire et écrire SES briefs, quelle que soit la
 * colonne. Deux colonnes de plus sont donc couvertes par les policies
 * existantes sans une ligne de SQL.
 *
 * ⚠ CE NE SERAIT PAS VRAI AVEC DES DROITS PAR COLONNE (`grant ... (col)`), qui
 * doivent être étendus à la main à chaque ajout. La vérification ci-dessous le
 * prouve plutôt que de le croire — et elle LÈVE au lieu d'avertir : une
 * colonne sans droit serait illisible pour la praticienne, ce qui est pire
 * qu'une migration qui refuse de s'appliquer.
 */
do $$
declare
  v_policies integer;
  v_colgrants integer;
begin
  select count(*) into v_policies from pg_policies where tablename = 'project_briefs';
  if v_policies = 0 then
    raise exception 'project_briefs n''a aucune policy : les deux colonnes seraient sans protection';
  end if;

  /*
   * ⚠ `information_schema.column_privileges` NE DISTINGUE PAS LES DEUX CAS :
   * elle énumère un droit de TABLE colonne par colonne, et rend donc dix-huit
   * lignes pour deux colonnes neuves alors qu'aucun droit par colonne
   * n'existe. Un premier jet a lu ces dix-huit lignes comme un avertissement,
   * ce qui était faux dans le sens qui inquiète pour rien.
   *
   * La grandeur juste est `pg_attribute.attacl` : elle n'est renseignée QUE
   * pour un droit réellement posé sur une colonne. Zéro veut dire que tous les
   * droits sont au niveau de la table, donc que les colonnes neuves les
   * héritent sans une ligne de SQL.
   */
  select count(*) into v_colgrants
    from pg_attribute a
   where a.attrelid = 'public.project_briefs'::regclass
     and a.attacl is not null;

  if v_colgrants > 0 then
    raise exception
      'project_briefs porte % droit(s) PAR COLONNE : les deux colonnes neuves doivent être ajoutées à la main',
      v_colgrants;
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='project_briefs'
       and column_name in ('license_number','license_state_code')
     group by table_name having count(*) = 2
  ) then
    raise exception 'les deux colonnes ne sont pas là';
  end if;
end $$;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260924160000', 'a_licence_number_is_required_in_every_advertisement');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260926090000_ethics_immediate_negation.sql
-- └──────────────────────────────────────────────────────────────────────
-- ════════════════════════════════════════════════════════════════════════
--  F38 — UN TERME INTERDIT IMMÉDIATEMENT NIÉ EST CONFORME
-- ════════════════════════════════════════════════════════════════════════
--
-- Le 2026-09-24, un mois généré est sorti à 29 posts sur 30. Les trente
-- contrôles du mois étaient verts, dix échanges de contenu avaient abouti, et
-- c'est la gâchette `content_items_ethics_gate` qui a refusé le trentième :
--
--     Advertising ethics: guarantee
--
-- Le mois est tombé sur `month.short`. Le texte fautif disait, en substance,
-- « there is no guarantee that six weeks will change anything » — c'est-à-dire
-- l'ANTI-PROMESSE, exactement ce que l'ACA C.3.a cherche à obtenir d'une
-- publicité de praticien licencié.
--
-- Le côté TypeScript ne s'y trompait pas : `lib/ethics/rules.ts` exempte depuis
-- l'origine un terme interdit immédiatement précédé d'une négation
-- (`isProhibitiveMention`). Ce côté-ci ne connaissait pas cette notion. Le
-- recensement des motifs était pourtant vert des deux côtés — un recensement
-- compare des NOMS, et une exemption n'est pas un motif.
--
-- Décision de Naima, 2026-09-26 : c'est le motif du code qui est juste.
--
-- ⚠ ET SUR CE SEUL POINT. L'exemption ne vaut que pour la négation IMMÉDIATE.
-- Une négation à distance dans la même phrase, dans une autre phrase, ou après
-- le terme, ne l'ouvre pas — « I can cure your anxiety, no question » reste
-- bloqué, et doit le rester.
--
-- ── ⚠ POURQUOI PAS UN `exception_pattern` ──────────────────────────────────
--
-- La table en porte déjà un, et il aurait été tentant d'y écrire la négation.
-- Il est testé sur LE TEXTE ENTIER (`not p_text ~* exception_pattern`) : une
-- seule tournure prohibitive quelque part dans une légende de trois cents mots
-- aurait exempté la légende entière, promesse comprise. C'est précisément la
-- négation à distance que la décision exclut. Il reste pour ce qu'il sait
-- faire — `therapy_that_works` contre « an approach that works best for you ».
--
-- ── ⚠ POURQUOI PAS UN LOOKBEHIND ──────────────────────────────────────────
--
-- Les expressions régulières de Postgres portent le lookahead `(?=...)` et
-- PAS le lookbehind : `(?<=...)` lève `invalid regular expression`. La
-- contrainte « ce qui précède immédiatement » ne peut donc pas s'écrire comme
-- en JavaScript.
--
-- Elle s'obtient autrement, et plus simplement : on RETIRE d'une copie du
-- texte les occurrences précédées de la négation — la concaténation
-- `négation || motif` impose l'adjacence — puis on applique le motif inchangé
-- à ce qu'il reste. Deux propriétés tombent gratuitement :
--
--   * l'extrait cité dans le message d'erreur est automatiquement la première
--     occurrence NON niée, là où un booléen aurait nommé la première tout
--     court ;
--   * « no guarantee, but we guarantee results » reste bloqué sur la seconde,
--     sans qu'on ait à compter quoi que ce soit.
--
-- Le remplacement met une ESPACE et non rien : deux fragments ne peuvent pas
-- se souder en un mot qui n'existait pas.

/*
 * La négation, écrite UNE fois et lisible par un test.
 *
 * ⚠ JUMELLE DE `PROHIBITIVE_LEAD` DANS eklio-frontend/lib/ethics/rules.ts,
 * traduite en POSIX : `\b` devient `\y`, et l'apostrophe est doublée. Les deux
 * listes de marqueurs sont écrites en toutes lettres des deux côtés, comme
 * celle de `ethics_parity` : le fichier à contrôler est dans l'autre dépôt, et
 * une liste qui se lit elle-même ne contrôle rien.
 *
 * Après le marqueur, seuls des blancs, des guillemets ou des parenthèses
 * peuvent s'intercaler. NI VIRGULE NI MOT : « no matter what, we guarantee
 * results » reste bloqué, et c'est voulu.
 */
create or replace function public.ethics_prohibitive_lead()
returns text
language sql
immutable
as $$
  select '\y(no|not|never|without|avoid|avoids|avoiding|exclude|excludes|excluding|omit|omits|omitting)\y[[:space:]"''‘’“”(\[]*'
$$;

comment on function public.ethics_prohibitive_lead() is
  'F38 — la négation qui, IMMÉDIATEMENT accolée à un terme interdit, en fait '
  'une mention conforme. Jumelle de PROHIBITIVE_LEAD côté TypeScript.';

create or replace function public.ethics_scan(p_text text)
returns jsonb
language sql
stable
as $$
  with stripped as (
    select ep.rule_id,
           ep.severity,
           ep.sort_order,
           ep.pattern,
           /*
            * ⚠ UNE COPIE PAR MOTIF. Chaque motif est dépouillé de SES propres
            * occurrences niées : retirer la négation d'un coup pour tous les
            * motifs supprimerait le mot « no » que le motif d'à côté devait
            * lire.
            */
           regexp_replace(
             p_text,
             public.ethics_prohibitive_lead() || '(' || ep.pattern || ')',
             ' ',
             'gi'
           ) as kept
      from public.ethics_patterns ep
     where ep.active
       and p_text is not null
       and not coalesce(p_text ~* ep.exception_pattern, false)
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'rule_id',  rule_id,
      'severity', severity,
      'excerpt',  coalesce(substring(kept from '(?i)(' || pattern || ')'), '(match)')
    ) order by sort_order),
    '[]'::jsonb)
    from stripped
   where kept ~* pattern
$$;

comment on function public.ethics_scan(text) is
  'Toutes les violations déontologiques d''un texte. F38 : une occurrence '
  'immédiatement précédée d''une négation n''en est pas une — voir '
  'ethics_prohibitive_lead(). Une négation à distance ne l''ouvre pas.';
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260926090000', 'ethics_immediate_negation');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260926120000_a_preflight_can_read_the_quota.sql
-- └──────────────────────────────────────────────────────────────────────
-- ════════════════════════════════════════════════════════════════════════
--  LE PRÉALABLE DOIT POUVOIR LIRE LE QUOTA SANS LE CONSOMMER
-- ════════════════════════════════════════════════════════════════════════
--
-- F45 porte le générateur du harnais sur le chemin produit. Son premier étage
-- est le PRÉALABLE : refuser une génération impossible AVANT la première
-- dépense. Il sait déjà refuser un brief sans mention de licence et une banque
-- trop courte ; il ne sait pas dire « le quota du mois est déjà épuisé ».
--
-- ⚠ ET IL NE DOIT PAS L'APPRENDRE EN RÉSERVANT. `reserve_credit` répond
-- `quota_exhausted`, mais il ÉCRIT une ligne au livre pour le découvrir — et
-- l'invariant `credit_ledger_one_outcome_per_reservation` exige alors un
-- dénouement. Sonder le quota en réservant laisserait une réservation à solder
-- pour une question.
--
-- ── ⚠ ET SURTOUT : ON N'A PAS RECOPIÉ LA BORNE ──────────────────────────
--
-- La tentation était d'écrire la jointure dans le code TypeScript du préalable.
-- Elle aurait été juste le jour de son écriture. La borne vit dans
-- `credit_ledger_apply()`, qui lit `credit_quotas` par `credit_plan_for(user)` ;
-- le compteur vit dans `credit_balances.consumed`. Deux sources, et un troisième
-- lecteur qui les joint à sa façon est un troisième endroit où la règle peut
-- diverger. C'est exactement la classe de F27 — et de F41, où un tirage dérivé
-- d'un ratio tautologique s'est confirmé lui-même pendant deux sessions.
--
-- Cette fonction lit donc LES MÊMES DEUX SOURCES, dans le même ordre, avec la
-- même lecture du NULL. Si la borne change, elle suit.
--
-- ⚠ ELLE ÉCHOUE FERMÉ, comme `credit_ledger_apply`. Un couple (plan, kind)
-- absent de `credit_quotas` rend `remaining = 0`, pas « illimité » :
-- `monthly_limit` vaut NULL pour « illimité » ET pour « pas de ligne », et lire
-- le second comme le premier ouvrirait la dépense à un compte sans droit.

create or replace function public.credit_remaining(
  p_user  uuid,
  p_kind  text,
  p_month date default date_trunc('month', now())::date
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with quota as (
    select q.monthly_limit, true as has_row
      from public.credit_quotas q
     where q.plan = public.credit_plan_for(p_user)
       and q.kind = p_kind
  ),
  used as (
    select coalesce(b.consumed, 0) as consumed
      from public.credit_balances b
     where b.user_id = p_user
       and b.kind = p_kind
       and b.month = date_trunc('month', p_month)::date
  )
  select jsonb_build_object(
    /*
     * ⚠ `unlimited` N'EST VRAI QUE SI LA LIGNE EXISTE ET QUE SA BORNE EST NULL.
     * Sans la ligne, ce n'est pas illimité : c'est un plan qui n'achète pas ce
     * genre de crédit.
     */
    'unlimited',  coalesce((select has_row from quota), false)
                  and (select monthly_limit from quota) is null,
    'limit',      (select monthly_limit from quota),
    'consumed',   coalesce((select consumed from used), 0),
    'remaining',
      case
        when not coalesce((select has_row from quota), false) then 0
        when (select monthly_limit from quota) is null then null
        else greatest(
          0,
          (select monthly_limit from quota) - coalesce((select consumed from used), 0)
        )
      end,
    'month',      date_trunc('month', p_month)::date
  )
$$;

comment on function public.credit_remaining(uuid, text, date) is
  'Le quota restant d''un mois, EN LECTURE SEULE. Lit les deux mêmes sources '
  'que credit_ledger_apply() — credit_quotas par credit_plan_for(), et '
  'credit_balances.consumed — pour qu''un préalable ne puisse pas diverger de la '
  'borne qu''il annonce. Échoue fermé : pas de ligne de quota => remaining 0. '
  'remaining NULL signifie illimité, et unlimited le dit explicitement.';

/*
 * ⚠ `service_role` SEUL. Le préalable tourne côté serveur ; une praticienne n'a
 * pas à interroger le livre de crédit, et `credit_balances` porte déjà des RLS
 * qui le disent. Une fonction `security definer` accordée à `authenticated`
 * serait un contournement de ces policies.
 */
revoke all on function public.credit_remaining(uuid, text, date) from public;
grant execute on function public.credit_remaining(uuid, text, date) to service_role;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260926120000', 'a_preflight_can_read_the_quota');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260927090000_a_trigger_function_is_never_a_client_call.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- ⚠ LA FONCTION DE TRIGGER DE 20260924150000 ÉTAIT EXÉCUTABLE PAR UN CLIENT
-- ============================================================================
--
-- Trouvé le 2026-09-27 en rejouant la suite SQL : deux tests
-- (20260831090000_revoke_internal_function_surface, 20260911170458_function_surface)
-- échouaient sur `section_types_pages_exist()`. La migration de restauration a
-- créé la fonction sans révoquer l'EXECUTE que PostgreSQL accorde à PUBLIC par
-- défaut ; `anon` et `authenticated` l'héritaient.
--
-- Nouvelle migration plutôt que retouche de 20260924150000 : la répétition à
-- blanc applique celle-là SEULE, en premier, et son octet exact est ce qu'on a
-- éprouvé contre la restauration.
revoke all on function public.section_types_pages_exist() from public, anon, authenticated;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260927090000', 'a_trigger_function_is_never_a_client_call');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260927100000_a_paid_inclusion_is_not_a_trial.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- ⚠ LES TROIS MOIS INCLUS DANS SIGNATURE SONT PAYÉS, ET LE QUOTA LES LISAIT
--   COMME UN ESSAI GRATUIT
-- ============================================================================
--
-- Trouvé le 2026-09-27 en JOUANT le parcours Stripe sur la base locale (cas F54,
-- « les deux bouts s'accordent-ils réellement ») :
--
--   · le webhook reçoit l'achat Signature (249 $), crée chez Stripe l'abonnement
--     des trois mois inclus avec `trial_period_days: 90`, et pose la ligne du
--     mois suivant en `generating` ;
--   · `credit_plan_for` voit `subscriptions.status = 'trialing'` et rend `trial` ;
--   · `credit_quotas(trial, post_generation)` vaut 8 ; le mois en promet 30 ;
--   · l'énumération des dues l'écarte (« quota épuisé : 8 pour 30 ») et le
--     préalable le refuserait pour la même raison.
--
-- La ligne payée restait donc en `generating` pour toujours, sur la cliente qui
-- a payé le plus cher. Chaque bout avait son test, et chaque test passait.
--
-- ── POURQUOI LA CORRECTION EST ICI ET PAS DANS LE QUOTA ─────────────────
--
-- Le quota d'essai est juste pour ce qu'il décrit : « a trial that has not
-- charged a card yet ». Ce qui était faux, c'est d'appeler essai un abonnement
-- `trialing` que la cliente a PAYÉ. Dans ce produit, `trial_period_days` n'est
-- posé qu'à un seul endroit — `grantIncludedMonthlyPresence`, pour Signature —
-- mais la règle ne s'appuie pas sur ce fait : elle demande l'achat lui-même.
--
-- Un achat Signature ENTITLING (`paid`, `partially_refunded` — la liste de
-- `lib/billing/entitlements.ts` et de 20260830062227) rend le plan `standard`.
-- Remboursé ou contesté, il cesse de compter et l'essai redevient un essai.
create or replace function public.credit_plan_for(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    -- A comp grant is the full paid product, so it is never on trial credits.
    when public.comp_grant_active(p_user) then 'standard'
    -- ⚠ A trial she paid for is not a trial: Signature's three included months.
    when exists (
      select 1 from public.purchases pu
       where pu.user_id = p_user
         and pu.tier = 'signature'
         and pu.status in ('paid', 'partially_refunded')
    ) then 'standard'
    when exists (
      select 1 from public.subscriptions s
       where s.user_id = p_user and s.status = 'trialing'
    ) then 'trial'
    else 'standard'
  end
$$;

comment on function public.credit_plan_for(uuid) is
  'Which row of credit_quotas applies to this user: trial while the Stripe subscription is trialing AND nothing paid covers it; standard otherwise -- for a comp grant, and for an entitling Signature purchase, whose three included months are a paid trial (20260927100000). Derived, never stored. INTERNAL ONLY.';

revoke all on function public.credit_plan_for(uuid) from public, anon, authenticated;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260927100000', 'a_paid_inclusion_is_not_a_trial');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260927110000_a_stale_subscription_event_does_not_rewrite.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- ⚠ UN ÉVÉNEMENT D'ABONNEMENT EN RETARD RÉÉCRIVAIT L'ÉTAT COURANT
-- ============================================================================
--
-- Trouvé le 2026-09-27 en JOUANT le parcours sur la base locale. Stripe ne
-- garantit pas l'ordre de livraison, et le webhook faisait un `upsert` aveugle
-- de l'objet reçu :
--
--   · `deleted` (annulé) puis un `updated` ANTÉRIEUR arrivé en retard →
--     l'abonnement redevenait `active` : accès rouvert, mois mis en file, pour
--     une cliente qui a résilié ;
--   · `updated` (active) puis `created` (incomplete) de la même seconde →
--     l'abonnement redescendait en `incomplete` : plus d'accès, pour une
--     cliente qui vient de payer.
--
-- ── DEUX RÈGLES, PARCE QUE L'HORODATAGE SEUL NE SUFFIT PAS ───────────────
--
-- 1. L'HORODATAGE DE L'ÉVÉNEMENT. `stripe_event_at` porte `event.created` ; un
--    événement strictement plus ancien que celui déjà appliqué ne réécrit rien.
--    Mais Stripe horodate à la SECONDE, et `created` et `updated` partagent
--    souvent la même.
-- 2. LES ÉTATS SANS RETOUR, pour le même `stripe_subscription_id` — des faits
--    de la machine d'états de Stripe, pas des préférences :
--      · `canceled` et `incomplete_expired` sont terminaux ;
--      · on ne revient jamais à `incomplete` après l'avoir quitté.
--
-- Un NOUVEL abonnement (autre `stripe_subscription_id`) sur le même compte
-- passe toujours : la ligne est clé sur `user_id`, et se réabonner après une
-- résiliation est légitime.
--
-- ⚠ LA LIGNE EST GARDÉE, PAS REFUSÉE. Lever ferait rendre 500 au webhook et
-- Stripe rejouerait indéfiniment un événement qui ne sera jamais plus récent.
-- Le trigger rend OLD : l'écriture devient sans effet, l'événement est traité.
alter table public.subscriptions
  add column if not exists stripe_event_at timestamptz;

comment on column public.subscriptions.stripe_event_at is
  'created of the most recent Stripe event applied to this row. An older event does not rewrite it (20260927110000).';

create or replace function public.subscriptions_refuse_stale_event()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.stripe_subscription_id is distinct from old.stripe_subscription_id then
    return new;
  end if;

  if new.stripe_event_at is not null and old.stripe_event_at is not null
     and new.stripe_event_at < old.stripe_event_at then
    return old;
  end if;

  if old.status in ('canceled', 'incomplete_expired') and new.status is distinct from old.status then
    return old;
  end if;

  if new.status = 'incomplete' and old.status <> 'incomplete' then
    return old;
  end if;

  -- Une écriture sans horodatage (un cron qui pose une notice) garde le dernier.
  if new.stripe_event_at is null then
    new.stripe_event_at := old.stripe_event_at;
  end if;

  return new;
end
$$;

comment on function public.subscriptions_refuse_stale_event() is
  'Keeps a late Stripe event from rewriting a subscription: an older event, a move out of a terminal state, or a return to incomplete for the same stripe_subscription_id leaves the row as it was. Returns OLD rather than raising, so the webhook answers 2xx and Stripe stops replaying (20260927110000).';

revoke all on function public.subscriptions_refuse_stale_event() from public, anon, authenticated;

drop trigger if exists subscriptions_refuse_stale_event on public.subscriptions;
create trigger subscriptions_refuse_stale_event
  before update on public.subscriptions
  for each row execute function public.subscriptions_refuse_stale_event();
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260927110000', 'a_stale_subscription_event_does_not_rewrite');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260927120000_revoke_from_public_does_not_revoke_from_anon.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- ⚠ « REVOKE … FROM PUBLIC » NE RETIRE RIEN À anon NI À authenticated
-- ============================================================================
--
-- Trouvé le 2026-09-27 : le test 20260911170458_function_surface échouait déjà
-- sur la fonction de trigger de 20260924150000, et s'arrêtait là. Débloqué, il
-- nomme quatre fonctions SECURITY DEFINER appelables par `anon` :
--
--   credit_remaining(uuid, text, date)   le quota de N'IMPORTE QUEL compte
--   drawable_count_for_kit(uuid)         la banque de N'IMPORTE QUEL kit
--   drawable_topics_for_kit(uuid, text)  idem, avec les sujets
--   release_stale_topic_assignments()    le balai, déclenchable par un anonyme
--
-- Les quatre migrations écrivaient `revoke all … from public`. Mais Supabase
-- accorde EXECUTE à `anon` et `authenticated` EXPLICITEMENT, par privilèges par
-- défaut : l'ACL portait `anon=X/postgres`, que révoquer PUBLIC ne touche pas.
-- La même leçon que 20260831090000, réapprise quatre fois en une semaine.
--
-- Les quatre appelants sont serveur, par la service_role : `lib/content/month/
-- server-ports.ts`, `draw-port.ts`, `app/api/cron/release-topics/route.ts`.
revoke all on function public.credit_remaining(uuid, text, date)    from public, anon, authenticated;
revoke all on function public.drawable_count_for_kit(uuid)          from public, anon, authenticated;
revoke all on function public.drawable_topics_for_kit(uuid, text)   from public, anon, authenticated;
revoke all on function public.release_stale_topic_assignments()     from public, anon, authenticated;

grant execute on function public.credit_remaining(uuid, text, date)  to service_role;
grant execute on function public.drawable_count_for_kit(uuid)        to service_role;
grant execute on function public.drawable_topics_for_kit(uuid, text) to service_role;
grant execute on function public.release_stale_topic_assignments()   to service_role;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260927120000', 'revoke_from_public_does_not_revoke_from_anon');

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260927130000_the_licence_number_has_one_authority.sql
-- └──────────────────────────────────────────────────────────────────────
-- ============================================================================
-- ⚠ LE NUMÉRO DE LICENCE A UNE SEULE AUTORITÉ : project_briefs.license_number
-- ============================================================================
--
-- F64, trouvé le 2026-09-27. Le numéro vivait à deux endroits :
--
--   · `site_specs.practice_details.license_number` — où la praticienne le
--     TAPE (éditeur de site, réglages), et d'où le kit, le site et la
--     signature e-mail le lisent ;
--   · `project_briefs.license_number` — que le préalable du mois et la carte
--     de contenu EXIGENT (F56), et que rien n'écrivait.
--
-- Chaque cliente réelle aurait donc tapé son numéro, et vu son premier mois
-- refusé pour « licence manquante ».
--
-- ── LA DÉCISION (2026-09-27) ────────────────────────────────────────────
--
-- Le brief fait autorité. C'est la source du pied de carte, c'est ce que la
-- conformité californienne exige sur chaque publicité (B&P §4980.44, §4996.2,
-- §4999.80), et c'est déjà ce que le préalable interroge. L'éditeur de site
-- écrit dans le brief, et non l'inverse.
--
-- ── ⚠ POURQUOI UNE PROJECTION TENUE PAR TRIGGER, ET PAS UNE LECTURE RÉÉCRITE ─
--
-- Six fonctions SQL lisent `site_specs` (get, patch, reset, fix_contrast,
-- site_output_get, seed) et une douzaine de lecteurs TypeScript passent par
-- `site_spec_get`. Réécrire chacune pour aller chercher le brief, c'est six
-- occasions d'en oublier une — et celle qu'on oublie est un second arbitre.
--
-- La copie dans `site_specs` reste donc, mais elle ne peut plus DIVERGER :
--
--   1. toute écriture du numéro dans une spec est d'abord écrite dans le
--      brief, puis la spec prend la valeur du brief (trigger BEFORE) ;
--   2. toute écriture directe du brief est recopiée dans les specs du projet
--      (trigger AFTER) ;
--   3. une spec créée prend la valeur du brief.
--
-- Une copie qui ne peut pas diverger n'est pas une seconde source : c'est la
-- même valeur, lue plus près. Le test le prouve dans les trois sens.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. La règle de forme, en UN endroit
-- ---------------------------------------------------------------------------
/*
 * La même règle que `project_briefs_license_number_shape` (20260924160000),
 * mais qui DIT ce qui ne va pas. La contrainte reste l'arbitre final ; cette
 * fonction sert à rendre une erreur de champ avant d'y arriver. Un test vérifie
 * qu'elles s'accordent sur chaque cas.
 */
create or replace function public.licence_number_problem(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p is null then null
    when btrim(p) <> p then 'Remove the spaces at the start or end of the license number.'
    when p = '' then null
    when char_length(p) < 3 or char_length(p) > 20
      then 'A license number is 3 to 20 characters, as your board prints it.'
    when p !~ '^[A-Za-z0-9][A-Za-z0-9 .#-]*[A-Za-z0-9]$'
      then 'Use only the letters, digits, spaces, dots, dashes or # that your board prints.'
    when p !~ '[0-9]'
      then 'A license number contains at least one digit.'
    else null
  end
$$;

comment on function public.licence_number_problem(text) is
  'Why a licence number would be refused by project_briefs_license_number_shape, in words, or NULL when it would pass. Empty string passes here because the site editor clears a field with it; it is stored as NULL. (20260927130000, F64)';

-- ---------------------------------------------------------------------------
-- 2. La reprise — écrite une fois, même sans cliente réelle
-- ---------------------------------------------------------------------------
/*
 * ⚠ TROIS CAS, ET UN SEUL S'ARRÊTE :
 *
 *   spec porte un numéro, brief vide  → le brief le prend (la reprise)
 *   les deux portent un numéro, ≠     → le brief gagne ; la spec suivra (§3).
 *                                       Compté et imprimé : c'est la décision.
 *   spec porte un numéro INVALIDE     → ARRÊT. Le recopier violerait la
 *                                       contrainte ; l'effacer perdrait ce
 *                                       qu'elle a tapé sans le lui dire. Une
 *                                       personne tranche, ligne par ligne.
 */
create or replace function public.licence_number_reprise()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bad   text;
  v_taken int;
  v_lost  int;
begin
  select string_agg(format('%s (« %s »)', ss.brand_kit_id, ss.practice_details->>'license_number'), ', ')
    into v_bad
    from public.site_specs ss
   where nullif(btrim(coalesce(ss.practice_details->>'license_number', '')), '') is not null
     and public.licence_number_problem(ss.practice_details->>'license_number') is not null;
  if v_bad is not null then
    raise exception
      'Reprise F64 : numéros de licence invalides dans des specs de site, à corriger à la main avant cette migration : %', v_bad;
  end if;

  select count(*) into v_lost
    from public.site_specs ss
    join public.brand_kits bk on bk.id = ss.brand_kit_id
    join public.project_briefs pb on pb.project_id = bk.project_id
   where nullif(ss.practice_details->>'license_number', '') is not null
     and pb.license_number is not null
     and pb.license_number <> ss.practice_details->>'license_number';

  -- Un projet peut porter plusieurs kits : le plus récent non supprimé l'emporte,
  -- la règle de `queueFirstContentMonth` (F54).
  with candidates as (
    select distinct on (bk.project_id)
           bk.project_id, ss.practice_details->>'license_number' as n
      from public.site_specs ss
      join public.brand_kits bk on bk.id = ss.brand_kit_id
     where nullif(ss.practice_details->>'license_number', '') is not null
     order by bk.project_id, (bk.deleted_at is null) desc, bk.created_at desc
  )
  update public.project_briefs pb
     set license_number = c.n
    from candidates c
   where pb.project_id = c.project_id
     and pb.license_number is null;
  get diagnostics v_taken = row_count;

  raise notice 'Reprise F64 : % numéro(s) repris des specs vers le brief ; % spec(s) en désaccord avec le brief, le brief gagne.',
    v_taken, v_lost;
  return jsonb_build_object('taken', v_taken, 'brief_won', v_lost);
end
$$;

comment on function public.licence_number_reprise() is
  'One-time F64 reprise: copies a licence number typed in a site spec into an empty brief, lets the brief win a disagreement, and stops on a number the brief constraint would refuse. A function so the rule is tested, not only run. INTERNAL ONLY. (20260927130000)';

revoke all on function public.licence_number_reprise() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. La spec ne peut plus diverger
-- ---------------------------------------------------------------------------
create or replace function public.site_specs_licence_number_from_brief()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid;
  v_brief   text;
  v_typed   text;
  v_before  text;
begin
  select bk.project_id into v_project from public.brand_kits bk where bk.id = new.brand_kit_id;
  select pb.license_number into v_brief from public.project_briefs pb where pb.project_id = v_project;
  if not found then
    -- Pas de brief (un kit ne naît pas sans brief ; ceci ne devrait pas
    -- arriver). On n'invente pas d'autorité : la spec ne porte rien.
    new.practice_details := jsonb_set(coalesce(new.practice_details, '{}'::jsonb), '{license_number}', 'null'::jsonb);
    return new;
  end if;

  v_typed := nullif(btrim(coalesce(new.practice_details->>'license_number', '')), '');
  v_before := case when tg_op = 'UPDATE'
                   then nullif(btrim(coalesce(old.practice_details->>'license_number', '')), '')
              end;

  /*
   * Une ÉDITION du numéro par la spec (valeur changée par rapport à la ligne
   * précédente, ou une spec créée avec un numéro alors que le brief n'en a pas)
   * s'écrit dans le brief. La contrainte du brief est l'arbitre : une forme
   * refusée lève ici, et `site_spec_patch` l'a déjà dit en mots avant.
   */
  if (tg_op = 'UPDATE' and v_typed is distinct from v_before)
     or (tg_op = 'INSERT' and v_typed is not null and v_brief is null) then
    /*
     * ⚠ LE DRAPEAU ÉVITE LA BOUCLE. Écrire le brief déclenche la recopie vers
     * les specs (§3, trigger AFTER) — qui viserait la ligne en cours de mise à
     * jour. La valeur y est déjà : on le dit à la recopie, pour cette écriture.
     */
    perform set_config('eklio.licence_from_spec', 'on', true);
    update public.project_briefs set license_number = v_typed
     where project_id = v_project and license_number is distinct from v_typed;
    perform set_config('eklio.licence_from_spec', 'off', true);
    v_brief := v_typed;
  end if;

  new.practice_details := jsonb_set(coalesce(new.practice_details, '{}'::jsonb),
                                    '{license_number}', coalesce(to_jsonb(v_brief), 'null'::jsonb));
  return new;
end
$$;

comment on function public.site_specs_licence_number_from_brief() is
  'Keeps site_specs.practice_details.license_number equal to project_briefs.license_number, the single authority: an edit through the spec is written to the brief first, and the spec then takes the brief''s value. (20260927130000, F64)';

revoke all on function public.site_specs_licence_number_from_brief() from public, anon, authenticated;

drop trigger if exists site_specs_licence_number_from_brief on public.site_specs;
create trigger site_specs_licence_number_from_brief
  before insert or update on public.site_specs
  for each row execute function public.site_specs_licence_number_from_brief();

create or replace function public.project_briefs_licence_number_to_specs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('eklio.licence_from_spec', true) = 'on' then
    return null;
  end if;
  update public.site_specs ss
     set practice_details = jsonb_set(ss.practice_details, '{license_number}',
                                      coalesce(to_jsonb(new.license_number), 'null'::jsonb))
    from public.brand_kits bk
   where bk.id = ss.brand_kit_id
     and bk.project_id = new.project_id
     and (ss.practice_details->>'license_number') is distinct from new.license_number;
  return null;
end
$$;

comment on function public.project_briefs_licence_number_to_specs() is
  'Copies a licence number written to the brief into every site spec of the project, so no reader of a spec can see another value. (20260927130000, F64)';

revoke all on function public.project_briefs_licence_number_to_specs() from public, anon, authenticated;

drop trigger if exists project_briefs_licence_number_to_specs on public.project_briefs;
create trigger project_briefs_licence_number_to_specs
  after insert or update of license_number on public.project_briefs
  for each row
  execute function public.project_briefs_licence_number_to_specs();

-- La reprise AVANT l'alignement : sinon l'alignement écraserait les numéros
-- tapés dans les specs par un brief vide. Ordre vérifié par le test.
select public.licence_number_reprise();

-- Aligner les copies existantes sur l'autorité (déclenche le trigger §3).
update public.site_specs ss
   set practice_details = ss.practice_details
 where true;

-- ---------------------------------------------------------------------------
-- 4. L'éditeur reçoit une erreur de champ, pas un refus de contrainte
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.site_spec_patch(p_brand_kit_id uuid, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET jit TO 'off'
AS $function$
declare
  v_gate jsonb;
  s        public.site_specs%rowtype;
  n        public.site_specs%rowtype;
  k        text;
  v_marks  jsonb := '{}'::jsonb;
  v_hero   jsonb;
  v_det    jsonb;
  v_len    int;
  v_path   text;
  v_next   int;
begin
  v_gate := public.site_spec_entitlement_error(p_brand_kit_id);
  if v_gate is not null then return v_gate; end if;

  select * into s
    from public.site_specs
   where brand_kit_id = p_brand_kit_id
     and user_id = (select auth.uid());
  if not found then
    return public.site_spec_error('not_found', 'No site spec for this brand kit.');
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    return public.site_spec_error('invalid_body', 'The update must be a JSON object.');
  end if;

  for k in select jsonb_object_keys(p_patch) loop
    if not (k = any (public.site_spec_patchable_keys())) then
      return public.site_spec_error('unknown_field',
        format('"%s" is not a field of the site spec.', k), k);
    end if;
  end loop;

  n := s;

  for k in select unnest(array['primary', 'secondary', 'accent',
                               'light_neutral', 'dark_neutral', 'paper']) loop
    if p_patch ? k then
      if jsonb_typeof(p_patch->k) <> 'string'
         or (p_patch->>k) !~ '^#[0-9A-Fa-f]{6}$' then
        return public.site_spec_error('invalid_field',
          'A color must be a hex value like #3B2C3A.', k);
      end if;
      case k
        when 'primary'       then n.primary_hex       := upper(p_patch->>k);
        when 'secondary'     then n.secondary_hex     := upper(p_patch->>k);
        when 'accent'        then n.accent_hex        := upper(p_patch->>k);
        when 'light_neutral' then n.light_neutral_hex := upper(p_patch->>k);
        when 'dark_neutral'  then n.dark_neutral_hex  := upper(p_patch->>k);
        when 'paper'         then n.paper_hex         := upper(p_patch->>k);
      end case;
    end if;
  end loop;

  if p_patch ? 'type_pairing_id' then
    if jsonb_typeof(p_patch->'type_pairing_id') = 'null' then
      n.type_pairing_id := null;
    elsif jsonb_typeof(p_patch->'type_pairing_id') <> 'string' then
      return public.site_spec_error('invalid_field',
        'The type pairing must be a catalog id.', 'type_pairing_id');
    else
      if not exists (select 1 from public.type_pairings tp
                      where tp.id = p_patch->>'type_pairing_id') then
        return public.site_spec_error('invalid_field',
          format('"%s" is not a type pairing we carry.', p_patch->>'type_pairing_id'),
          'type_pairing_id');
      end if;
      n.type_pairing_id := p_patch->>'type_pairing_id';
      select tp.heading_font, tp.body_font, tp.google_fonts_url
        into n.heading_font, n.body_font, n.google_fonts_url
        from public.type_pairings tp where tp.id = n.type_pairing_id;
    end if;
  end if;

  for k in select unnest(array['heading_font', 'body_font', 'google_fonts_url']) loop
    if p_patch ? k then
      if jsonb_typeof(p_patch->k) <> 'string' or btrim(p_patch->>k) = '' then
        return public.site_spec_error('invalid_field',
          'This must be a font name we can render.', k);
      end if;
      case k
        when 'heading_font'     then n.heading_font     := btrim(p_patch->>k);
        when 'body_font'        then n.body_font        := btrim(p_patch->>k);
        when 'google_fonts_url' then n.google_fonts_url := btrim(p_patch->>k);
      end case;
    end if;
  end loop;

  if p_patch ? 'hero' then
    if jsonb_typeof(p_patch->'hero') <> 'object' then
      return public.site_spec_error('invalid_field', 'The hero must be an object.', 'hero');
    end if;
    v_hero := n.hero;
    for k in select jsonb_object_keys(p_patch->'hero') loop
      if not (k = any (array['overline', 'headline', 'subhead',
                             'cta_label', 'cta_target_url'])) then
        return public.site_spec_error('unknown_field',
          format('"%s" is not a field of the hero.', k), 'hero.' || k);
      end if;
      v_hero := jsonb_set(v_hero, array[k], p_patch->'hero'->k);
    end loop;

    if not public.site_spec_hero_valid(v_hero) then
      return public.site_spec_error('invalid_field',
        'Every hero field must be text.', 'hero');
    end if;
    if not public.site_spec_hero_lengths_valid(v_hero) then
      for k, v_len in select * from (values ('overline', 48), ('headline', 90),
                                            ('subhead', 220), ('cta_label', 28)) x(a, b) loop
        if coalesce(char_length(v_hero->>k), 0) > v_len then
          return public.site_spec_error('too_long',
            format('This is %s characters. The limit is %s.',
                   char_length(v_hero->>k), v_len), 'hero.' || k);
        end if;
      end loop;
    end if;
    if not public.site_spec_cta_target_url_valid(v_hero) then
      return public.site_spec_error('invalid_field',
        'The button link must start with https://, http://, mailto: or tel:.',
        'hero.cta_target_url');
    end if;
    n.hero := v_hero;
  end if;

  if p_patch ? 'about_excerpt' then
    if jsonb_typeof(p_patch->'about_excerpt') <> 'string' then
      return public.site_spec_error('invalid_field',
        'The About text must be text.', 'about_excerpt');
    end if;
    if char_length(p_patch->>'about_excerpt') > 600 then
      return public.site_spec_error('too_long',
        format('This is %s characters. The limit is 600.',
               char_length(p_patch->>'about_excerpt')), 'about_excerpt');
    end if;
    n.about_excerpt := p_patch->>'about_excerpt';
  end if;

  if p_patch ? 'extra_instructions' then
    if jsonb_typeof(p_patch->'extra_instructions') = 'null' then
      n.extra_instructions := null;
    elsif jsonb_typeof(p_patch->'extra_instructions') <> 'string' then
      return public.site_spec_error('invalid_field',
        'Your notes must be text.', 'extra_instructions');
    elsif char_length(p_patch->>'extra_instructions') > 2000 then
      return public.site_spec_error('too_long',
        format('This is %s characters. The limit is 2000.',
               char_length(p_patch->>'extra_instructions')), 'extra_instructions');
    else
      n.extra_instructions := p_patch->>'extra_instructions';
    end if;
  end if;

  if p_patch ? 'pages' then
    if not public.site_spec_pages_valid(p_patch->'pages') then
      return public.site_spec_error('invalid_field',
        'Each page needs a known key, a label, an enabled flag and a list of sections with unique keys.',
        'pages');
    end if;
    if not public.site_spec_pages_lengths_valid(p_patch->'pages') then
      v_path := public.site_spec_first_overlong_field(p_patch->'pages');
      return public.site_spec_error('too_long',
        'This is over 800 characters, which is the limit for a section field.',
        coalesce(v_path, 'pages'));
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_patch->'pages') pg
      cross join lateral jsonb_array_elements(pg.value->'sections') sc
      join public.section_types st on st.id = sc.value->>'type'
       where not (pg.value->>'key' = any (st.allowed_pages))
    ) then
      return public.site_spec_error('invalid_field',
        'One of these sections is not allowed on the page it was put on.', 'pages');
    end if;
    n.pages := p_patch->'pages';
  end if;

  if p_patch ? 'practice_details' then
    if jsonb_typeof(p_patch->'practice_details') <> 'object' then
      return public.site_spec_error('invalid_field',
        'The practice details must be an object.', 'practice_details');
    end if;
    v_det := n.practice_details;
    for k in select jsonb_object_keys(p_patch->'practice_details') loop
      if not (k = any (public.site_spec_practice_detail_keys())) then
        return public.site_spec_error('unknown_field',
          format('"%s" is not a practice detail.', k), 'practice_details.' || k);
      end if;
      v_det := jsonb_set(v_det, array[k], p_patch->'practice_details'->k);
    end loop;
    if not public.site_spec_practice_details_valid(v_det) then
      return public.site_spec_error('invalid_field',
        'The state must be a two-letter code, and every other detail must be text.',
        'practice_details');
    end if;
    /*
     * ⚠ LE NUMÉRO DE LICENCE A UNE AUTORITÉ, ET CE N'EST PAS CETTE LIGNE
     * (20260927130000, F64). Il est validé ICI par la règle du brief, pour que
     * l'éditeur reçoive une erreur de champ lisible plutôt qu'un refus de
     * contrainte au moment où le trigger l'écrit dans `project_briefs`.
     */
    if public.licence_number_problem(v_det->>'license_number') is not null then
      return public.site_spec_error('invalid_field',
        public.licence_number_problem(v_det->>'license_number'),
        'practice_details.license_number');
    end if;
    n.practice_details := v_det;
  end if;

  if p_patch ? 'target' then
    if jsonb_typeof(p_patch->'target') <> 'string'
       or not exists (select 1 from public.builder_targets bt
                       where bt.id = p_patch->>'target') then
      return public.site_spec_error('invalid_field',
        'Pick one of the website builders we support.', 'target');
    end if;
    n.target := p_patch->>'target';
  end if;

  v_next := s.spec_version + 1;

  if n.primary_hex is distinct from s.primary_hex then
    v_marks := v_marks || jsonb_build_object('colors|Primary color changed', v_next); end if;
  if n.secondary_hex is distinct from s.secondary_hex then
    v_marks := v_marks || jsonb_build_object('colors|Secondary color changed', v_next); end if;
  if n.accent_hex is distinct from s.accent_hex then
    v_marks := v_marks || jsonb_build_object('colors|Accent color changed', v_next); end if;
  if n.paper_hex is distinct from s.paper_hex then
    v_marks := v_marks || jsonb_build_object('colors|Page background changed', v_next); end if;
  if n.light_neutral_hex is distinct from s.light_neutral_hex then
    v_marks := v_marks || jsonb_build_object('colors|Section background changed', v_next); end if;
  if n.dark_neutral_hex is distinct from s.dark_neutral_hex then
    v_marks := v_marks || jsonb_build_object('colors|Body text color changed', v_next); end if;

  if n.heading_font is distinct from s.heading_font then
    v_marks := v_marks || jsonb_build_object('typography|Heading font changed', v_next); end if;
  if n.body_font is distinct from s.body_font then
    v_marks := v_marks || jsonb_build_object('typography|Body font changed', v_next); end if;
  if n.google_fonts_url is distinct from s.google_fonts_url then
    v_marks := v_marks || jsonb_build_object('typography|Font stylesheet changed', v_next); end if;

  if n.hero is distinct from s.hero then
    v_marks := v_marks || jsonb_build_object('copy|Hero copy edited', v_next); end if;
  if n.about_excerpt is distinct from s.about_excerpt then
    v_marks := v_marks || jsonb_build_object('copy|About text edited', v_next); end if;
  if n.practice_details is distinct from s.practice_details then
    v_marks := v_marks || jsonb_build_object('copy|Practice details edited', v_next); end if;

  if n.pages is distinct from s.pages then
    if public.site_spec_pages_skeleton(n.pages)
       is distinct from public.site_spec_pages_skeleton(s.pages) then
      v_marks := v_marks || jsonb_build_object('structure|Page structure changed', v_next);
    end if;
    if public.site_spec_pages_copy(n.pages)
       is distinct from public.site_spec_pages_copy(s.pages) then
      v_marks := v_marks || jsonb_build_object('copy|Section copy edited', v_next);
    end if;
  end if;

  if n.extra_instructions is distinct from s.extra_instructions then
    v_marks := v_marks || jsonb_build_object('instructions|Your own notes edited', v_next); end if;

  if n.target is distinct from s.target then
    v_marks := v_marks || jsonb_build_object('structure|Website builder changed', v_next); end if;

  if v_marks = '{}'::jsonb then
    return public.site_spec_envelope(to_jsonb(s));
  end if;

  update public.site_specs
     set primary_hex        = n.primary_hex,
         secondary_hex      = n.secondary_hex,
         accent_hex         = n.accent_hex,
         light_neutral_hex  = n.light_neutral_hex,
         dark_neutral_hex   = n.dark_neutral_hex,
         paper_hex          = n.paper_hex,
         type_pairing_id    = n.type_pairing_id,
         heading_font       = n.heading_font,
         body_font          = n.body_font,
         google_fonts_url   = n.google_fonts_url,
         hero               = n.hero,
         about_excerpt      = n.about_excerpt,
         pages              = n.pages,
         practice_details   = n.practice_details,
         extra_instructions = n.extra_instructions,
         target             = n.target,
         spec_version       = v_next,
         change_marks       = coalesce(change_marks, '{}'::jsonb) || v_marks
   where id = s.id
   returning * into n;

  return public.site_spec_envelope(to_jsonb(n));
end
$function$;

revoke all on function public.site_spec_patch(uuid, jsonb) from public, anon;
grant execute on function public.site_spec_patch(uuid, jsonb) to authenticated;
revoke all on function public.licence_number_problem(text) from public, anon;
grant execute on function public.licence_number_problem(text) to authenticated, service_role;
;
insert into supabase_migrations.schema_migrations (version, name) values ('20260927130000', 'the_licence_number_has_one_authority');

-- ════════════════════════════════════════════════════════════════════════════
--  LES DROITS DES 71 OBJETS CRÉÉS — explicites, tels que le rejeu en postgres
--  les produit. Indépendants des privilèges par défaut du rôle qui colle.
-- ════════════════════════════════════════════════════════════════════════════
revoke all on function public.abandon_stale_generation_runs() from public, anon, authenticated, service_role;
grant EXECUTE on function public.abandon_stale_generation_runs() to authenticated;
grant EXECUTE on function public.abandon_stale_generation_runs() to service_role;
revoke all on function public.apply_on_demand_write(uuid,text,text,text,text,text,jsonb,text,uuid,numeric) from public, anon, authenticated, service_role;
grant EXECUTE on function public.apply_on_demand_write(uuid,text,text,text,text,text,jsonb,text,uuid,numeric) to authenticated;
grant EXECUTE on function public.apply_on_demand_write(uuid,text,text,text,text,text,jsonb,text,uuid,numeric) to service_role;
revoke all on function public.assign_topic_to_kit(uuid,date,text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.assign_topic_to_kit(uuid,date,text) to service_role;
revoke all on function public.begin_on_demand_write(uuid,text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.begin_on_demand_write(uuid,text) to authenticated;
grant EXECUTE on function public.begin_on_demand_write(uuid,text) to service_role;
revoke all on function public.check_monthly_presence_entitlement(uuid) from public, anon, authenticated, service_role;
grant EXECUTE on function public.check_monthly_presence_entitlement(uuid) to service_role;
revoke all on function public.content_item_valid(jsonb) from public, anon, authenticated, service_role;
grant EXECUTE on function public.content_item_valid(jsonb) to anon;
grant EXECUTE on function public.content_item_valid(jsonb) to authenticated;
grant EXECUTE on function public.content_item_valid(jsonb) to service_role;
revoke all on function public.content_items_payload_ethics_gate() from public, anon, authenticated, service_role;
grant EXECUTE on function public.content_items_payload_ethics_gate() to service_role;
revoke all on function public.content_items_valid(jsonb,integer,integer) from public, anon, authenticated, service_role;
grant EXECUTE on function public.content_items_valid(jsonb,integer,integer) to anon;
grant EXECUTE on function public.content_items_valid(jsonb,integer,integer) to authenticated;
grant EXECUTE on function public.content_items_valid(jsonb,integer,integer) to service_role;
revoke all on function public.content_month_cost(uuid,date) from public, anon, authenticated, service_role;
grant EXECUTE on function public.content_month_cost(uuid,date) to service_role;
revoke all on function public.content_topic_bank_payload_valid(text,jsonb) from public, anon, authenticated, service_role;
grant EXECUTE on function public.content_topic_bank_payload_valid(text,jsonb) to anon;
grant EXECUTE on function public.content_topic_bank_payload_valid(text,jsonb) to authenticated;
grant EXECUTE on function public.content_topic_bank_payload_valid(text,jsonb) to public;
grant EXECUTE on function public.content_topic_bank_payload_valid(text,jsonb) to service_role;
revoke all on function public.content_topic_payload_valid(text,jsonb) from public, anon, authenticated, service_role;
grant EXECUTE on function public.content_topic_payload_valid(text,jsonb) to authenticated;
grant EXECUTE on function public.content_topic_payload_valid(text,jsonb) to service_role;
revoke all on function public.content_topic_text(jsonb) from public, anon, authenticated, service_role;
grant EXECUTE on function public.content_topic_text(jsonb) to authenticated;
grant EXECUTE on function public.content_topic_text(jsonb) to service_role;
revoke all on function public.content_topics_banned_phrases_gate() from public, anon, authenticated, service_role;
grant EXECUTE on function public.content_topics_banned_phrases_gate() to service_role;
revoke all on function public.content_topics_ethics_gate() from public, anon, authenticated, service_role;
grant EXECUTE on function public.content_topics_ethics_gate() to service_role;
revoke all on function public.content_words(text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.content_words(text) to anon;
grant EXECUTE on function public.content_words(text) to authenticated;
grant EXECUTE on function public.content_words(text) to service_role;
revoke all on function public.credit_ledger_apply() from public, anon, authenticated, service_role;
grant EXECUTE on function public.credit_ledger_apply() to service_role;
revoke all on function public.credit_ledger_is_append_only() from public, anon, authenticated, service_role;
grant EXECUTE on function public.credit_ledger_is_append_only() to service_role;
revoke all on function public.credit_meter(date) from public, anon, authenticated, service_role;
grant EXECUTE on function public.credit_meter(date) to authenticated;
grant EXECUTE on function public.credit_meter(date) to service_role;
revoke all on function public.credit_monthly_limit(uuid,text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.credit_monthly_limit(uuid,text) to service_role;
revoke all on function public.credit_plan_for(uuid) from public, anon, authenticated, service_role;
grant EXECUTE on function public.credit_plan_for(uuid) to service_role;
revoke all on function public.credit_remaining(uuid,text,date) from public, anon, authenticated, service_role;
grant EXECUTE on function public.credit_remaining(uuid,text,date) to service_role;
revoke all on function public.custom_visual_path(uuid,text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.custom_visual_path(uuid,text) to service_role;
revoke all on function public.drawable_count_for_kit(uuid) from public, anon, authenticated, service_role;
grant EXECUTE on function public.drawable_count_for_kit(uuid) to service_role;
revoke all on function public.drawable_topics_for_kit(uuid,text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.drawable_topics_for_kit(uuid,text) to service_role;
revoke all on function public.ethics_prohibitive_lead() from public, anon, authenticated, service_role;
grant EXECUTE on function public.ethics_prohibitive_lead() to anon;
grant EXECUTE on function public.ethics_prohibitive_lead() to authenticated;
grant EXECUTE on function public.ethics_prohibitive_lead() to public;
grant EXECUTE on function public.ethics_prohibitive_lead() to service_role;
revoke all on function public.insight_cards_validate_segments() from public, anon, authenticated, service_role;
grant EXECUTE on function public.insight_cards_validate_segments() to service_role;
revoke all on function public.licence_number_problem(text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.licence_number_problem(text) to authenticated;
grant EXECUTE on function public.licence_number_problem(text) to service_role;
revoke all on function public.licence_number_reprise() from public, anon, authenticated, service_role;
grant EXECUTE on function public.licence_number_reprise() to service_role;
revoke all on function public.monthly_presence_entitled() from public, anon, authenticated, service_role;
grant EXECUTE on function public.monthly_presence_entitled() to authenticated;
grant EXECUTE on function public.monthly_presence_entitled() to service_role;
revoke all on function public.monthly_presence_past_due_grace() from public, anon, authenticated, service_role;
grant EXECUTE on function public.monthly_presence_past_due_grace() to anon;
grant EXECUTE on function public.monthly_presence_past_due_grace() to authenticated;
grant EXECUTE on function public.monthly_presence_past_due_grace() to service_role;
revoke all on function public.next_background_for_kit(uuid) from public, anon, authenticated, service_role;
grant EXECUTE on function public.next_background_for_kit(uuid) to service_role;
revoke all on function public.next_topic_for_kit(uuid,date,text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.next_topic_for_kit(uuid,date,text) to service_role;
revoke all on function public.project_briefs_licence_number_to_specs() from public, anon, authenticated, service_role;
grant EXECUTE on function public.project_briefs_licence_number_to_specs() to service_role;
revoke all on function public.record_custom_visual(uuid,text,uuid,text,text,text,text,numeric,uuid) from public, anon, authenticated, service_role;
grant EXECUTE on function public.record_custom_visual(uuid,text,uuid,text,text,text,text,numeric,uuid) to service_role;
revoke all on function public.record_rendered_asset(uuid,text,text,text,text,integer,integer,integer,integer) from public, anon, authenticated, service_role;
grant EXECUTE on function public.record_rendered_asset(uuid,text,text,text,text,integer,integer,integer,integer) to service_role;
revoke all on function public.release_on_demand_write(uuid,numeric) from public, anon, authenticated, service_role;
grant EXECUTE on function public.release_on_demand_write(uuid,numeric) to authenticated;
grant EXECUTE on function public.release_on_demand_write(uuid,numeric) to service_role;
revoke all on function public.release_stale_credit_reservations(interval) from public, anon, authenticated, service_role;
grant EXECUTE on function public.release_stale_credit_reservations(interval) to service_role;
revoke all on function public.release_stale_topic_assignments() from public, anon, authenticated, service_role;
grant EXECUTE on function public.release_stale_topic_assignments() to service_role;
revoke all on function public.render_rationale(text,uuid) from public, anon, authenticated, service_role;
grant EXECUTE on function public.render_rationale(text,uuid) to service_role;
revoke all on function public.rendered_asset_path(uuid,text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.rendered_asset_path(uuid,text) to service_role;
revoke all on function public.reserve_credit(uuid,text,text,text,uuid,numeric,text,text,date) from public, anon, authenticated, service_role;
grant EXECUTE on function public.reserve_credit(uuid,text,text,text,uuid,numeric,text,text,date) to service_role;
revoke all on function public.section_types_pages_exist() from public, anon, authenticated, service_role;
grant EXECUTE on function public.section_types_pages_exist() to service_role;
revoke all on function public.set_content_item_topic(uuid,uuid,text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.set_content_item_topic(uuid,uuid,text) to service_role;
revoke all on function public.settle_credit(uuid,numeric,boolean) from public, anon, authenticated, service_role;
grant EXECUTE on function public.settle_credit(uuid,numeric,boolean) to service_role;
revoke all on function public.site_specs_licence_number_from_brief() from public, anon, authenticated, service_role;
grant EXECUTE on function public.site_specs_licence_number_from_brief() to service_role;
revoke all on function public.subscriptions_refuse_stale_event() from public, anon, authenticated, service_role;
grant EXECUTE on function public.subscriptions_refuse_stale_event() to service_role;
revoke all on function public.suggest_topics_for_kit(uuid,date,integer,uuid[]) from public, anon, authenticated, service_role;
grant EXECUTE on function public.suggest_topics_for_kit(uuid,date,integer,uuid[]) to authenticated;
grant EXECUTE on function public.suggest_topics_for_kit(uuid,date,integer,uuid[]) to service_role;
revoke all on function public.swap_content_item(uuid) from public, anon, authenticated, service_role;
grant EXECUTE on function public.swap_content_item(uuid) to authenticated;
grant EXECUTE on function public.swap_content_item(uuid) to service_role;
revoke all on function public.topic_assignment_grace() from public, anon, authenticated, service_role;
grant EXECUTE on function public.topic_assignment_grace() to anon;
grant EXECUTE on function public.topic_assignment_grace() to authenticated;
grant EXECUTE on function public.topic_assignment_grace() to public;
grant EXECUTE on function public.topic_assignment_grace() to service_role;
revoke all on function public.topic_assignment_holds(uuid,uuid,timestamp with time zone) from public, anon, authenticated, service_role;
grant EXECUTE on function public.topic_assignment_holds(uuid,uuid,timestamp with time zone) to anon;
grant EXECUTE on function public.topic_assignment_holds(uuid,uuid,timestamp with time zone) to authenticated;
grant EXECUTE on function public.topic_assignment_holds(uuid,uuid,timestamp with time zone) to public;
grant EXECUTE on function public.topic_assignment_holds(uuid,uuid,timestamp with time zone) to service_role;
revoke all on function public.topic_collision_window() from public, anon, authenticated, service_role;
grant EXECUTE on function public.topic_collision_window() to anon;
grant EXECUTE on function public.topic_collision_window() to authenticated;
grant EXECUTE on function public.topic_collision_window() to service_role;
revoke all on table public.background_assignments from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.background_assignments to anon;
grant DELETE, INSERT, SELECT, UPDATE on table public.background_assignments to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table public.background_assignments to service_role;
revoke all on table public.background_library from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.background_library to anon;
grant DELETE, INSERT, SELECT, UPDATE on table public.background_library to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table public.background_library to service_role;
revoke all on table public.content_archetypes from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.content_archetypes to anon;
grant DELETE, INSERT, SELECT, UPDATE on table public.content_archetypes to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table public.content_archetypes to service_role;
revoke all on table public.content_generation_results from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.content_generation_results to service_role;
revoke all on table public.content_generation_runs from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.content_generation_runs to service_role;
revoke all on table public.content_intents from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.content_intents to anon;
grant DELETE, INSERT, SELECT, UPDATE on table public.content_intents to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table public.content_intents to service_role;
revoke all on table public.content_segments from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.content_segments to anon;
grant DELETE, INSERT, SELECT, UPDATE on table public.content_segments to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table public.content_segments to service_role;
revoke all on table public.content_topics from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.content_topics to anon;
grant DELETE, INSERT, SELECT, UPDATE on table public.content_topics to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table public.content_topics to service_role;
revoke all on table public.credit_balances from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.credit_balances to anon;
grant DELETE, INSERT, SELECT, UPDATE on table public.credit_balances to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table public.credit_balances to service_role;
revoke all on table public.credit_ledger from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.credit_ledger to anon;
grant DELETE, INSERT, SELECT, UPDATE on table public.credit_ledger to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table public.credit_ledger to service_role;
revoke all on table public.credit_month_audit from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.credit_month_audit to anon;
grant DELETE, INSERT, SELECT, UPDATE on table public.credit_month_audit to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table public.credit_month_audit to service_role;
revoke all on table public.credit_quotas from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.credit_quotas to anon;
grant DELETE, INSERT, SELECT, UPDATE on table public.credit_quotas to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table public.credit_quotas to service_role;
revoke all on table public.custom_visual_generations from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.custom_visual_generations to anon;
grant DELETE, INSERT, SELECT, UPDATE on table public.custom_visual_generations to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table public.custom_visual_generations to service_role;
revoke all on table public.illustration_library from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.illustration_library to anon;
grant DELETE, INSERT, SELECT, UPDATE on table public.illustration_library to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table public.illustration_library to service_role;
revoke all on table public.insight_cards from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.insight_cards to service_role;
revoke all on table public.insight_runs from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.insight_runs to service_role;
revoke all on table public.insight_sources from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.insight_sources to anon;
grant DELETE, INSERT, SELECT, UPDATE on table public.insight_sources to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table public.insight_sources to service_role;
revoke all on table public.on_demand_writes from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.on_demand_writes to service_role;
revoke all on table public.rendered_assets from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.rendered_assets to anon;
grant DELETE, INSERT, SELECT, UPDATE on table public.rendered_assets to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table public.rendered_assets to service_role;
revoke all on table public.topic_assignments from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT, UPDATE on table public.topic_assignments to anon;
grant DELETE, INSERT, SELECT, UPDATE on table public.topic_assignments to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table public.topic_assignments to service_role;

-- ════════════════════════════════════════════════════════════════════════════
--  CONTRÔLES AVANT COMMIT — un seul échec annule TOUT
-- ════════════════════════════════════════════════════════════════════════════
do $check$
declare v_n int; v_bad text;
begin
  select count(*) into v_n from supabase_migrations.schema_migrations where version in ('20260920140000','20260920140100','20260920150000','20260920150100','20260920150200','20260920150300','20260920160000','20260920160100','20260920170000','20260920180000','20260921090000','20260921100000','20260921110000','20260921120000','20260921140000','20260923100000','20260923110000','20260924100000','20260924120000','20260924130000','20260924140000','20260924150000','20260924160000','20260926090000','20260926120000','20260927090000','20260927100000','20260927110000','20260927120000','20260927130000');
  if v_n <> 30 then raise exception 'CONTRÔLE : % des 30 enregistrées. Tout est annulé.', v_n; end if;

  select count(*), string_agg(p.proname, ', ') filter (where has_function_privilege('anon', p.oid, 'execute'))
    into v_n, v_bad
    from pg_proc p where p.pronamespace = 'public'::regnamespace
     and p.proname in ('credit_remaining','drawable_count_for_kit','drawable_topics_for_kit','release_stale_topic_assignments');
  if v_n <> 4 then raise exception 'CONTRÔLE F63 : % fonctions trouvées sur 4. Tout est annulé.', v_n; end if;
  if v_bad is not null then raise exception 'CONTRÔLE F63 : ouvertes à anon : %. Tout est annulé.', v_bad; end if;

  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='subscriptions' and column_name='stripe_event_at') then
    raise exception 'CONTRÔLE F61 : subscriptions.stripe_event_at absente. Tout est annulé.';
  end if;
  select count(*) into v_n from pg_trigger where not tgisinternal and tgname in
    ('subscriptions_refuse_stale_event','site_specs_licence_number_from_brief','project_briefs_licence_number_to_specs');
  if v_n <> 3 then raise exception 'CONTRÔLE F61/F64 : % triggers sur 3. Tout est annulé.', v_n; end if;

  select string_agg(c.relname, ', ') into v_bad from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relname in ('credit_ledger','content_topics','topic_assignments','content_generation_runs')
     and not has_table_privilege('service_role', c.oid, 'select');
  if v_bad is not null then raise exception 'CONTRÔLE : service_role ne lit pas : %. Tout est annulé.', v_bad; end if;

  select string_agg(p.proname, ', ') into v_bad from pg_proc p
   where p.pronamespace = 'public'::regnamespace and pg_get_userbyid(p.proowner) <> 'postgres'
     and p.proname in ('credit_remaining','reserve_credit','settle_credit','licence_number_reprise');
  if v_bad is not null then raise exception 'CONTRÔLE : fonctions non possédées par postgres : %. Tout est annulé.', v_bad; end if;

  raise notice 'Contrôles avant commit : tous verts. Les 30 migrations sont appliquées et enregistrées.';
end
$check$;

commit;
