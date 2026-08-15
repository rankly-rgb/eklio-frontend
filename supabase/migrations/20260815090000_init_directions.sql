-- Lot 2 — directions créatives générées par l'IA.
-- Une ligne par direction (1 à 3 par projet), remplacée intégralement à
-- chaque (re)génération.

create table public.directions (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  position           smallint not null check (position between 1 and 3),
  name               text not null,
  description        text not null,
  palette            jsonb not null,
  typographie_titre  text not null,
  typographie_corps  text not null,
  is_selected        boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (project_id, position)
);

alter table public.directions enable row level security;

create policy "directions_select_own"
  on public.directions for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create policy "directions_insert_own"
  on public.directions for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create policy "directions_update_own"
  on public.directions for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create policy "directions_delete_own"
  on public.directions for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create trigger directions_set_updated_at
  before update on public.directions
  for each row execute function public.set_updated_at();

create index directions_project_id_idx on public.directions (project_id);
