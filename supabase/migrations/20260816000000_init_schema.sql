-- Eklio initial schema.
--
-- Note on repo layout: README points at eklio-backend as the schema source of
-- truth, but that repo has never carried a migration and this schema did not
-- exist anywhere. Migrations live here so the app and its schema ship together.
--
-- Everything is owner-only. RLS is the security boundary: the browser client
-- uses the anon key, so any table without a correct policy is a data leak.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Drives both the dashboard badge and the Resume-by-status routing.
--   brief          -> Draft
--   brief_complete -> Brief complete
--   directions     -> Directions ready
--   kit            -> Brand kit
create type project_status as enum (
  'brief',
  'brief_complete',
  'directions',
  'kit'
);

-- One row per step of the 7-step brief, keyed by these names.
create type brief_step as enum (
  'practice',
  'positioning',
  'ideal_client',
  'voice',
  'palette',
  'typography',
  'website'
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Profile rows are created by the trigger below, never by the client, so there
-- is deliberately no INSERT policy.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Untitled practice',
  status project_status not null default 'brief',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects (user_id, updated_at desc);

alter table public.projects enable row level security;

create policy "projects_select_own"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "projects_insert_own"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "projects_update_own"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "projects_delete_own"
  on public.projects for delete
  using (auth.uid() = user_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- brief_answers
-- ---------------------------------------------------------------------------

-- One row per (project, step). Autosave upserts on this pair on every field
-- blur, so the unique constraint is load-bearing, not just hygiene.
create table public.brief_answers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  step brief_step not null,
  answer jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, step)
);

create index brief_answers_project_id_idx on public.brief_answers (project_id);

alter table public.brief_answers enable row level security;

-- Ownership is transitive through projects; every policy re-checks it.
create policy "brief_answers_select_own"
  on public.brief_answers for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = brief_answers.project_id and p.user_id = auth.uid()
    )
  );

create policy "brief_answers_insert_own"
  on public.brief_answers for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = brief_answers.project_id and p.user_id = auth.uid()
    )
  );

create policy "brief_answers_update_own"
  on public.brief_answers for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = brief_answers.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = brief_answers.project_id and p.user_id = auth.uid()
    )
  );

create policy "brief_answers_delete_own"
  on public.brief_answers for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = brief_answers.project_id and p.user_id = auth.uid()
    )
  );

create trigger brief_answers_set_updated_at
  before update on public.brief_answers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- directions
-- ---------------------------------------------------------------------------

-- Exactly three rows per project after a successful generation. Saving is
-- replace-not-append: the previous three are deleted inside the same
-- transaction as the insert.
create table public.directions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  name text not null,
  description text not null,
  -- { primary, secondary, accent, light_neutral, dark_neutral } as hex strings
  palette jsonb not null default '{}'::jsonb,
  -- { headings, body } as real font names (proper nouns, never translated)
  typography jsonb not null default '{}'::jsonb,
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, position)
);

create index directions_project_id_idx on public.directions (project_id, position);

alter table public.directions enable row level security;

create policy "directions_select_own"
  on public.directions for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = directions.project_id and p.user_id = auth.uid()
    )
  );

create policy "directions_insert_own"
  on public.directions for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = directions.project_id and p.user_id = auth.uid()
    )
  );

create policy "directions_update_own"
  on public.directions for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = directions.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = directions.project_id and p.user_id = auth.uid()
    )
  );

create policy "directions_delete_own"
  on public.directions for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = directions.project_id and p.user_id = auth.uid()
    )
  );

create trigger directions_set_updated_at
  before update on public.directions
  for each row execute function public.set_updated_at();
