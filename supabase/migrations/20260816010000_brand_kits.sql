-- Brand kits: the deliverable a chosen direction turns into.
--
-- RLS mirrors the existing tables exactly — ownership is transitive through
-- projects and re-checked in every policy. Owner-only read and write.

create table public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  direction_id uuid not null references public.directions (id) on delete cascade,

  -- Snapshot of the chosen direction at generation time. Kept denormalized on
  -- purpose: regenerating directions must never silently rewrite a kit that
  -- has already been delivered.
  direction_snapshot jsonb not null default '{}'::jsonb,

  -- { primary, secondary, accent, light_neutral, dark_neutral } as hex.
  -- RGB is derived in the view rather than stored, so the two can never drift.
  palette jsonb not null default '{}'::jsonb,
  -- { headings, body } as real font names.
  typography jsonb not null default '{}'::jsonb,

  -- { positioning_statement, brand_story, voice_and_tone, website_copy,
  --   social_templates } — see lib/ai/kit.ts for the exact shape.
  content jsonb not null default '{}'::jsonb,

  -- Ready-to-paste site prompt covering Squarespace, Lovable, Framer, Webflow.
  export_prompt text,

  -- Reserved for a future public share page. No public RLS policy exists yet,
  -- so a slug is currently only readable by the owner — deliberately.
  share_slug text unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One kit per project. Rebuilding replaces it in place.
  unique (project_id)
);

create index brand_kits_project_id_idx on public.brand_kits (project_id);

alter table public.brand_kits enable row level security;

create policy "brand_kits_select_own"
  on public.brand_kits for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = brand_kits.project_id and p.user_id = auth.uid()
    )
  );

create policy "brand_kits_insert_own"
  on public.brand_kits for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = brand_kits.project_id and p.user_id = auth.uid()
    )
  );

create policy "brand_kits_update_own"
  on public.brand_kits for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = brand_kits.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = brand_kits.project_id and p.user_id = auth.uid()
    )
  );

create policy "brand_kits_delete_own"
  on public.brand_kits for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = brand_kits.project_id and p.user_id = auth.uid()
    )
  );

create trigger brand_kits_set_updated_at
  before update on public.brand_kits
  for each row execute function public.set_updated_at();
