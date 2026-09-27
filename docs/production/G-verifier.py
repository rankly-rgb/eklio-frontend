"""Assemble G-verifications.sql — appelé par G-generer.sh, pas à la main.

    python3 G-verifier.py <travail> <sortie>

<travail> porte main.txt, new.txt, et les états attendus relevés dans la base de
référence (les nouvelles migrations appliquées en postgres) :
  exp_objects.txt   « f|signature|propriétaire|acl triée » et « r|relation|propriétaire|acl triée|rls »
  exp_columns.txt   « table.colonne|type » pour les colonnes que les migrations ajoutent
  exp_triggers.txt  « table.trigger » pour les triggers qu'elles ajoutent
  exp_policies.txt  « table.policy » pour les policies qu'elles ajoutent

Lecture seule : aucune écriture, aucune table temporaire. Une ligne par
contrôle, statut OK ou PAS OK, et le détail de ce qui manque.
"""
import sys

work, out_path = sys.argv[1:3]
rd = lambda n: [l.rstrip("\n") for l in open(f"{work}/{n}") if l.strip()]
main, new = rd("main.txt"), rd("new.txt")
objs, cols, trgs, pols = rd("exp_objects.txt"), rd("exp_columns.txt"), rd("exp_triggers.txt"), rd("exp_policies.txt")
esc = lambda s: s.replace("'", "''")
# ⚠ UNE LISTE PAR LIGNE, pas une valeur par ligne : le fichier doit tenir sous
# 100 lignes. Le collage de la version à 616 lignes s'arrêtait deux fois à la
# ligne 100 (2026-09-27) — la copie, pas l'éditeur, qui a reçu 9068 lignes.
values = lambda rows: ", ".join("(" + ",".join(f"'{esc(c)}'" for c in r) + ")" for r in rows)
split = lambda f: (f.split("_", 1)[0], f.split("_", 1)[1][: -len(".sql")])

all_mig = [split(f) for f in main + new]
new_mig = [split(f) for f in new]
funcs = [o.split("|")[1:] for o in objs if o.startswith("f|")]   # sig, owner, acl
rels = [o.split("|")[1:] for o in objs if o.startswith("r|")]    # rel, owner, acl, rls

# ⚠ Seuls les rôles qui comptent (PUBLIC, anon, authenticated, service_role) : un
# rôle propre à Supabase, présent en production et pas en local, ne doit pas
# produire une fausse alerte. Et une ACL NULLE vaut ses droits par défaut réels
# (acldefault) — sinon « exécutable par PUBLIC » implicite resterait invisible.
ACL_F = """coalesce((select string_agg(case when e.grantee = 0 then 'public' else pg_get_userbyid(e.grantee) end || ':' || e.privilege_type, ',' order by case when e.grantee = 0 then 'public' else pg_get_userbyid(e.grantee) end, e.privilege_type) from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) e where e.grantee = 0 or pg_get_userbyid(e.grantee) in ('anon','authenticated','service_role')), '-')"""
ACL_R = """coalesce((select string_agg(case when e.grantee = 0 then 'public' else pg_get_userbyid(e.grantee) end || ':' || e.privilege_type, ',' order by case when e.grantee = 0 then 'public' else pg_get_userbyid(e.grantee) end, e.privilege_type) from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) e where e.grantee = 0 or pg_get_userbyid(e.grantee) in ('anon','authenticated','service_role')), '-')"""

sql = f"""-- ════════════════════════════════════════════════════════════════════════════
--  G — VÉRIFICATIONS, À COLLER APRÈS G-migrations-a-coller.sql
-- ════════════════════════════════════════════════════════════════════════════
-- Généré par docs/production/G-generer.sh. LECTURE SEULE.
-- Une ligne par contrôle : statut OK ou PAS OK, et dans « détail » ce qui manque
-- ou diffère. Les valeurs attendues viennent du rejeu local en postgres ; elles
-- ne sont pas écrites à la main.
-- Éprouvé : toutes les lignes OK sur une copie migrée, toutes PAS OK sur une
-- copie non migrée.
-- ════════════════════════════════════════════════════════════════════════════
with
mig(version, name) as (values
    {values(all_mig)}),
new_mig(version, name) as (values
    {values(new_mig)}),
exp_f(sig, owner, acl) as (values
    {values(funcs)}),
exp_r(rel, owner, acl, rls) as (values
    {values(rels)}),
exp_c(col, typ) as (values
    {values([c.split("|") for c in cols])}),
exp_t(trg) as (values
    {values([[t] for t in trgs])}),
exp_p(pol) as (values
    {values([[p] for p in pols])}),
act_f as (
  select p.oid::regprocedure::text as sig, pg_get_userbyid(p.proowner) as owner, {ACL_F} as acl
    from pg_proc p where p.pronamespace = 'public'::regnamespace),
act_r as (
  select c.oid::regclass::text as rel, pg_get_userbyid(c.relowner) as owner, {ACL_R} as acl,
         c.relrowsecurity::text as rls
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','v','m','S','p')),
checks(ordre, controle, bad, total, detail) as (
  select 1, 'registre : les {len(all_mig)} migrations du dépôt enregistrées',
         (select count(*) from mig m where not exists (select 1 from supabase_migrations.schema_migrations s where s.version = m.version)),
         {len(all_mig)},
         (select 'absentes : ' || string_agg(m.version, ' ') from mig m
           where not exists (select 1 from supabase_migrations.schema_migrations s where s.version = m.version))
  union all
  select 2, 'registre : total = {len(all_mig)}, rien de plus',
         (select abs(count(*) - {len(all_mig)}) from supabase_migrations.schema_migrations), {len(all_mig)},
         (select 'enregistrées : ' || count(*) || ' ; hors dépôt : ' || coalesce(string_agg(s.version, ' ') filter (where m.version is null), 'aucune')
            from supabase_migrations.schema_migrations s left join mig m on m.version = s.version)
  union all
  select 3, 'registre : les {len(new_mig)} nouvelles sous le nom de leur fichier',
         (select count(*) from new_mig n where not exists
            (select 1 from supabase_migrations.schema_migrations s where s.version = n.version and s.name = n.name)),
         {len(new_mig)},
         (select 'absentes ou mal nommées : ' || string_agg(n.version, ' ') from new_mig n where not exists
            (select 1 from supabase_migrations.schema_migrations s where s.version = n.version and s.name = n.name))
  union all
  select 4, 'dérive : les {len(funcs)} fonctions créées, propriétaire et droits exacts',
         (select count(*) from exp_f e left join act_f a using (sig)
           where a.sig is null or a.owner <> e.owner or a.acl <> e.acl),
         {len(funcs)},
         (select string_agg(e.sig || case when a.sig is null then ' ABSENTE' when a.owner <> e.owner then ' propriétaire ' || a.owner
                                          else ' droits ' || a.acl || ' attendus ' || e.acl end, ' ; ')
            from exp_f e left join act_f a using (sig)
           where a.sig is null or a.owner <> e.owner or a.acl <> e.acl)
  union all
  select 5, 'dérive : les {len(rels)} tables et vues créées, propriétaire, droits et RLS exacts',
         (select count(*) from exp_r e left join act_r a using (rel)
           where a.rel is null or a.owner <> e.owner or a.acl <> e.acl or a.rls <> e.rls),
         {len(rels)},
         (select string_agg(e.rel || case when a.rel is null then ' ABSENTE' when a.rls <> e.rls then ' RLS ' || a.rls
                                          when a.owner <> e.owner then ' propriétaire ' || a.owner else ' droits ' || a.acl end, ' ; ')
            from exp_r e left join act_r a using (rel)
           where a.rel is null or a.owner <> e.owner or a.acl <> e.acl or a.rls <> e.rls)
  union all
  select 6, 'dérive : les {len(cols)} colonnes ajoutées, au bon type',
         (select count(*) from exp_c e where not exists (select 1 from information_schema.columns c
            where c.table_schema = 'public' and c.table_name || '.' || c.column_name = e.col and c.data_type = e.typ)),
         {len(cols)},
         (select 'absentes ou mal typées : ' || string_agg(e.col, ' ') from exp_c e where not exists (select 1 from information_schema.columns c
            where c.table_schema = 'public' and c.table_name || '.' || c.column_name = e.col and c.data_type = e.typ))
  union all
  select 7, 'dérive : les {len(trgs)} triggers ajoutés',
         (select count(*) from exp_t e where not exists (select 1 from pg_trigger t
            where not t.tgisinternal and t.tgrelid::regclass::text || '.' || t.tgname = e.trg)),
         {len(trgs)},
         (select 'absents : ' || string_agg(e.trg, ' ') from exp_t e where not exists (select 1 from pg_trigger t
            where not t.tgisinternal and t.tgrelid::regclass::text || '.' || t.tgname = e.trg))
  union all
  select 8, 'dérive : les {len(pols)} policies ajoutées',
         (select count(*) from exp_p e where not exists (select 1 from pg_policies p
            where p.schemaname = 'public' and p.tablename || '.' || p.policyname = e.pol)),
         {len(pols)},
         (select 'absentes : ' || string_agg(e.pol, ' ') from exp_p e where not exists (select 1 from pg_policies p
            where p.schemaname = 'public' and p.tablename || '.' || p.policyname = e.pol))
  union all
  select 9, 'F63 : les 4 fonctions privilégiées existent et sont FERMÉES à anon',
         (select 4 - count(*) filter (where not has_function_privilege('anon', p.oid, 'execute')) from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('credit_remaining','drawable_count_for_kit','drawable_topics_for_kit','release_stale_topic_assignments')),
         4,
         (select 'trouvées : ' || count(*) || ' ; ouvertes à anon : ' ||
                 coalesce(string_agg(p.proname, ', ') filter (where has_function_privilege('anon', p.oid, 'execute')), 'aucune')
            from pg_proc p where p.pronamespace = 'public'::regnamespace
             and p.proname in ('credit_remaining','drawable_count_for_kit','drawable_topics_for_kit','release_stale_topic_assignments'))
  union all
  select 10, 'F61 : subscriptions.stripe_event_at et le trigger qui refuse un event en retard',
         (select 2 - (select count(*) from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='stripe_event_at')
                   - (select count(*) from pg_trigger where not tgisinternal and tgname = 'subscriptions_refuse_stale_event')),
         2, null
  union all
  select 11, 'F64 : les deux triggers qui tiennent le numéro de licence sur le brief',
         (select 2 - count(*) from pg_trigger where not tgisinternal
           and tgname in ('site_specs_licence_number_from_brief','project_briefs_licence_number_to_specs')),
         2, null
)
select controle as "contrôle",
       case when bad = 0 then 'OK' else 'PAS OK' end as statut,
       case when bad = 0 then total || '/' || total else coalesce(detail, (total - bad) || '/' || total) end as "détail"
  from checks order by ordre;
"""
# Repli : l'en-tête réduit à deux lignes, chaque ligne de continuation (indentée)
# rattachée à la précédente — le SQL ignore les retours à la ligne, et le corps ne
# porte aucun commentaire qu'un repli pourrait avaler (vérifié ci-dessous).
import re
head, _, body = sql.partition("\nwith\n")
assert "--" not in body.replace("'-'", ""), "un commentaire dans le corps : le repli l'avalerait"
sql = ("-- G — VÉRIFICATIONS, à coller APRÈS G-migrations-a-coller.sql. Lecture seule. Généré par G-generer.sh.\n"
       "-- Une ligne par contrôle : OK ou PAS OK, et le détail. Éprouvé : 11 OK sur copie migrée, 11 PAS OK sinon.\n"
       "with\n" + re.sub(r"\n[ \t]+", " ", body))
text = sql
# ⚠ LE COLLAGE SE TRONQUE SANS RIEN DIRE (constaté le 2026-09-27 : un aperçu ne
# copiait que les 100 premières lignes). La première ligne dit donc combien il y
# en a et laquelle est la dernière : Ctrl+Fin dans l'éditeur doit tomber dessus.
last = text.rstrip().splitlines()[-1]
n = len(text.rstrip().splitlines()) + 1
text = f"-- ⚑ {n} LIGNES. La dernière est : {last}   (Ctrl+Fin dans l'éditeur pour vérifier le collage)\n" + text
open(out_path, "w").write(text)
print(f"   {out_path} : 11 contrôles — {len(funcs)} fonctions, {len(rels)} relations, {len(cols)} colonnes, {len(trgs)} triggers, {len(pols)} policies attendus")
