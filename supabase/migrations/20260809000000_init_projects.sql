-- Lot 1 — projets et brief guidé.
-- Deux tables : projects (métadonnées + avancement) et project_briefs
-- (réponses du brief en jsonb, validées côté serveur par zod).

-- projects
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  metier        text,
  status        text not null default 'brief'
                check (status in ('brief','brief_complete','directions','kit')),
  current_step  smallint not null default 1 check (current_step between 1 and 8),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- brief : une ligne par projet, données en jsonb validées côté serveur par zod
create table public.project_briefs (
  project_id      uuid primary key references public.projects(id) on delete cascade,
  data            jsonb not null default '{}'::jsonb,
  completed_steps smallint[] not null default '{}',
  updated_at      timestamptz not null default now()
);

-- RLS : chaque utilisateur ne voit et ne modifie que ses propres projets.
alter table public.projects enable row level security;
alter table public.project_briefs enable row level security;

create policy "projects_select_own"
  on public.projects for select
  using (user_id = (select auth.uid()));

create policy "projects_insert_own"
  on public.projects for insert
  with check (user_id = (select auth.uid()));

create policy "projects_update_own"
  on public.projects for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "projects_delete_own"
  on public.projects for delete
  using (user_id = (select auth.uid()));

create policy "project_briefs_select_own"
  on public.project_briefs for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create policy "project_briefs_insert_own"
  on public.project_briefs for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create policy "project_briefs_update_own"
  on public.project_briefs for update
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

create policy "project_briefs_delete_own"
  on public.project_briefs for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

-- updated_at automatique sur les deux tables.
create function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger project_briefs_set_updated_at
  before update on public.project_briefs
  for each row execute function public.set_updated_at();

-- Tri du tableau de bord : projets d'un utilisateur, plus récents d'abord.
create index projects_user_id_updated_at_idx
  on public.projects (user_id, updated_at desc);
