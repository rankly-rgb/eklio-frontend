"""Assemble G-migrations-a-coller.sql — appelé par G-generer.sh, pas à la main.

    python3 G-assembler.py <travail> <dossier des migrations> <sortie>

<travail> porte main.txt (les migrations de production), new.txt (les nouvelles,
dans l'ordre) et acl.sql (les droits explicites des objets qu'elles créent).
"""
import sys

work, mig_dir, out_path = sys.argv[1:4]
main = [l.strip() for l in open(f"{work}/main.txt") if l.strip()]
new = [l.strip() for l in open(f"{work}/new.txt") if l.strip()]
acl = open(f"{work}/acl.sql").read().strip()
n_objects = sum(1 for l in acl.splitlines() if l.startswith("revoke "))

version = lambda f: f.split("_", 1)[0]
label = lambda f: f.split("_", 1)[1][: -len(".sql")]
arr = lambda xs: ",".join(f"'{x}'" for x in xs)
v_main, v_new = [version(f) for f in main], [version(f) for f in new]

parts = [f"""-- ════════════════════════════════════════════════════════════════════════════
--  G — LES {len(new)} MIGRATIONS, À COLLER EN UNE FOIS DANS L'ÉDITEUR SQL DE SUPABASE
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
--   2. il pose EXPLICITEMENT, à la fin, les droits des {n_objects} objets que ces
--      migrations créent, tels que le rejeu en postgres les produit : le résultat
--      ne dépend plus des privilèges par défaut.
-- Aucune ne supprime ni ne recrée un objet existant (vérifié par oid) : ces
-- {n_objects} objets sont les seuls que les privilèges par défaut toucheraient.
--
-- Un second collage ne fait rien : le garde-fou d'entrée refuse si l'une des
-- {len(new)} est déjà enregistrée.
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
    from unnest(array[{arr(v_new)}]) v
   where exists (select 1 from supabase_migrations.schema_migrations s where s.version = v);
  if v_already is not null then
    raise exception 'ARRÊT : déjà enregistrées : %. Ce fichier a déjà été appliqué, en tout ou partie. Rien n''a été fait.', v_already;
  end if;
  select string_agg(v, ' ') into v_missing
    from unnest(array[{arr(v_main)}]) v
   where not exists (select 1 from supabase_migrations.schema_migrations s where s.version = v);
  if v_missing is not null then
    raise exception 'ARRÊT : la base n''est pas celle attendue — migrations de la production absentes du registre : %. Rien n''a été fait.', v_missing;
  end if;
  raise notice 'Garde-fou : rôle postgres, les {len(main)} de la production présentes, aucune des {len(new)}. On applique.';
end
$guard$;
"""]

for f in new:
    body = open(f"{mig_dir}/{f}").read().rstrip()
    parts.append(
        "\n-- ┌──────────────────────────────────────────────────────────────────────\n"
        f"-- │ {f}\n"
        "-- └──────────────────────────────────────────────────────────────────────\n"
        f"{body}\n;\n"
        f"insert into supabase_migrations.schema_migrations (version, name) values ('{version(f)}', '{label(f)}');\n"
    )

parts.append(f"""
-- ════════════════════════════════════════════════════════════════════════════
--  LES DROITS DES {n_objects} OBJETS CRÉÉS — explicites, tels que le rejeu en postgres
--  les produit. Indépendants des privilèges par défaut du rôle qui colle.
-- ════════════════════════════════════════════════════════════════════════════
{acl}

-- ════════════════════════════════════════════════════════════════════════════
--  CONTRÔLES AVANT COMMIT — un seul échec annule TOUT
-- ════════════════════════════════════════════════════════════════════════════
do $check$
declare v_n int; v_bad text;
begin
  select count(*) into v_n from supabase_migrations.schema_migrations where version in ({arr(v_new)});
  if v_n <> {len(new)} then raise exception 'CONTRÔLE : % des {len(new)} enregistrées. Tout est annulé.', v_n; end if;

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

  raise notice 'Contrôles avant commit : tous verts. Les {len(new)} migrations sont appliquées et enregistrées.';
end
$check$;

commit;
""")

text = "".join(parts)
# ⚠ LE COLLAGE SE TRONQUE SANS RIEN DIRE (constaté le 2026-09-27 : un aperçu ne
# copiait que les 100 premières lignes). La première ligne dit donc combien il y
# en a et laquelle est la dernière : Ctrl+Fin dans l'éditeur doit tomber dessus.
last = text.rstrip().splitlines()[-1]
n = len(text.rstrip().splitlines()) + 1
text = f"-- ⚑ {n} LIGNES. La dernière est : {last}   (Ctrl+Fin dans l'éditeur pour vérifier le collage)\n" + text
open(out_path, "w").write(text)
print(f"   {out_path} : {len(new)} migrations, {n_objects} objets aux droits explicites")
