-- Lot 2 — correction : une table `directions` héritée d'une session de
-- bootstrap antérieure (sans lien avec Eklio) existait déjà avec un schéma
-- différent (colonnes `summary`, `typography`, `tone_descriptors`, `status`
-- au lieu de `description`, `typographie_titre`, `typographie_corps`), ce
-- qui a empêché `20260815090000_init_directions.sql` de créer la bonne
-- table (« relation already exists ») et a laissé des policies partielles.
--
-- La table est vide (0 ligne) : on la supprime et on la recrée à l'identique
-- de la migration initiale, sans risque de perte de données.

drop table if exists public.directions cascade;

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
