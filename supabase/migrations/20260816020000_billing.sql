-- Billing: one-time kit purchases and the Monthly Presence subscription.
--
-- Writes come from the Stripe webhook, which has no user session and therefore
-- uses the service-role client. That is why there are SELECT policies here and
-- no INSERT/UPDATE policies: nothing client-side may ever mint or alter a
-- purchase record. RLS still scopes reads to the owner.

create type order_status as enum ('pending', 'paid', 'refunded', 'failed');

-- Mirrors Stripe's subscription statuses. Stored as text rather than an enum
-- so a new Stripe status can never break the webhook mid-flight.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Nullable: a subscription belongs to a person, and survives any one project.
  project_id uuid references public.projects (id) on delete set null,

  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_id_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- One-time kit purchases.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,

  -- 'starter' | 'practice' | 'signature' — see lib/billing/plans.ts. Text
  -- rather than an enum so adding a tier is a code change, not a migration.
  tier text not null,
  amount_cents integer not null,
  currency text not null default 'usd',
  status order_status not null default 'pending',

  stripe_checkout_session_id text not null unique,
  stripe_customer_id text,
  stripe_payment_intent_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_project_id_idx on public.orders (project_id, created_at desc);
create index orders_user_id_idx on public.orders (user_id);

alter table public.orders enable row level security;

create policy "orders_select_own"
  on public.orders for select
  using (auth.uid() = user_id);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Monthly Presence deliveries
-- ---------------------------------------------------------------------------

-- One row per delivered month. Generation is manual in this pass; the
-- scheduler that would create these on a cadence is deliberately not built —
-- see the retention seams in lib/ai/monthly-presence.ts.
create table public.monthly_presence_deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,

  -- First day of the month this delivery covers, so a month can be requested
  -- exactly once and re-runs are idempotent.
  period_start date not null,

  -- { posts, stories, editorial_calendar } — see lib/ai/monthly-presence.ts.
  content jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (project_id, period_start)
);

create index monthly_presence_project_idx
  on public.monthly_presence_deliveries (project_id, period_start desc);

alter table public.monthly_presence_deliveries enable row level security;

create policy "monthly_presence_select_own"
  on public.monthly_presence_deliveries for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = monthly_presence_deliveries.project_id and p.user_id = auth.uid()
    )
  );

create policy "monthly_presence_insert_own"
  on public.monthly_presence_deliveries for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = monthly_presence_deliveries.project_id and p.user_id = auth.uid()
    )
  );

create policy "monthly_presence_update_own"
  on public.monthly_presence_deliveries for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = monthly_presence_deliveries.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = monthly_presence_deliveries.project_id and p.user_id = auth.uid()
    )
  );

create policy "monthly_presence_delete_own"
  on public.monthly_presence_deliveries for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = monthly_presence_deliveries.project_id and p.user_id = auth.uid()
    )
  );

create trigger monthly_presence_set_updated_at
  before update on public.monthly_presence_deliveries
  for each row execute function public.set_updated_at();
