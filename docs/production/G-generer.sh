#!/usr/bin/env bash
# ── G — FABRIQUER G-migrations-a-coller.sql ───────────────────────────────────
#
# Le fichier à coller dans l'éditeur SQL de Supabase se RÉGÉNÈRE, il ne s'édite
# pas. Ce script :
#   1. reconstruit localement la base de production (les migrations de
#      origin/main du backend + sa graine + un registre de ces versions) ;
#   2. en copie une, y applique les nouvelles migrations EN `postgres` — la
#      référence ;
#   3. relève les objets créés (par oid : rien de recréé, rien de retiré) et
#      leurs droits dans la référence ;
#   4. écrit le fichier : garde-fou, migrations + registre, droits explicites,
#      contrôles avant commit — une seule transaction ;
#   5. l'ÉPROUVE : collé sur une copie de la base de production, il doit donner
#      exactement la référence, objets ET droits ; recollé, il doit refuser.
#
#   bash docs/production/G-generer.sh
set -euo pipefail
BE=${EKLIO_BACKEND:-/home/user/eklio-backend}
FE=${EKLIO_FRONTEND:-/home/user/eklio-frontend}
W=${WORK:-/tmp/eklio-g}
OUT=$FE/docs/production/G-migrations-a-coller.sql
BASE=eklio_g_base; REF=eklio_g_ref; TRY=eklio_g_try
mkdir -p "$W"; chmod 755 "$W"
PSQL="sudo -u postgres psql -qAt -v ON_ERROR_STOP=1"

git -C "$BE" fetch -q origin main
ls_main() { git -C "$BE" ls-tree --name-only origin/main supabase/migrations/ | grep '\.sql$' | xargs -n1 basename | sort; }
ls_main > "$W/main.txt"
comm -13 "$W/main.txt" <(ls "$BE"/supabase/migrations/*.sql | xargs -n1 basename | sort) > "$W/new.txt"
echo "main : $(wc -l < "$W/main.txt") migrations ; nouvelles : $(wc -l < "$W/new.txt")"

echo "== 1 · la base de production, reconstruite =="
rm -rf "$W/prodmig"; mkdir -p "$W/prodmig"
while read -r f; do git -C "$BE" show "origin/main:supabase/migrations/$f" > "$W/prodmig/$f"; done < "$W/main.txt"
git -C "$BE" show origin/main:supabase/seed.sql > "$W/seed.sql"
for db in $TRY $REF $BASE; do sudo -u postgres dropdb --if-exists $db; done
sudo -u postgres createdb $BASE
sudo -u postgres psql -q -d $BASE -f "$BE/scripts/local-verify-stub-schema.sql" >/dev/null 2>&1
while read -r f; do $PSQL -d $BASE < "$W/prodmig/$f" >/dev/null 2>"$W/err.log" || { echo "✗ $f : $(tail -1 "$W/err.log")"; exit 1; }; done < "$W/main.txt"
$PSQL -d $BASE < "$W/seed.sql" >/dev/null 2>&1
$PSQL -d $BASE -c "create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text);"
$PSQL -d $BASE -c "insert into supabase_migrations.schema_migrations (version, name) values $(sed -E "s/^([0-9]+)_(.*)\.sql$/('\1','\2')/" "$W/main.txt" | paste -sd,)"

echo "== 2 · la référence : les nouvelles, appliquées en postgres =="
sudo -u postgres createdb -T $BASE $REF
while read -r f; do sudo -u postgres psql -q -1 -v ON_ERROR_STOP=1 -d $REF < "$BE/supabase/migrations/$f" >/dev/null 2>"$W/err.log" || { echo "✗ $f : $(tail -1 "$W/err.log")"; exit 1; }; done < "$W/new.txt"

echo "== 3 · les objets créés, et leurs droits =="
OBJ="select 'f|'||p.oid::regprocedure::text||'|'||p.oid from pg_proc p where p.pronamespace='public'::regnamespace
     union all select 'r|'||c.oid::regclass::text||'|'||c.oid from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','v','m','S','p')"
$PSQL -d $BASE -c "$OBJ" | sort > "$W/base.obj"
$PSQL -d $REF  -c "$OBJ" | sort > "$W/ref.obj"
python3 - "$W" <<'PY'
import sys
w = sys.argv[1]
def load(p):
    return {l.rsplit('|', 1)[0]: l.rsplit('|', 1)[1].strip() for l in open(p) if l.strip()}
b, r = load(w + "/base.obj"), load(w + "/ref.obj")
removed = [k for k in b if k not in r]
recreated = [k for k in b if k in r and b[k] != r[k]]
new = [k for k in r if k not in b]
if removed or recreated:
    sys.exit(f"✗ retirés {removed[:5]} ou recréés {recreated[:5]} : les droits par défaut toucheraient aussi des objets existants")
open(w + "/new.obj", "w").write("\n".join(new) + "\n")
print(f"   {len(new)} objets créés, 0 retiré, 0 recréé")
PY
{
  echo "create temp table _new(kind text, name text);"
  python3 -c "import sys; rows=[l.strip().split('|',1) for l in open(sys.argv[1]) if l.strip()]; print('insert into _new values '+','.join(\"('%s','%s')\" % (k, n.replace(\"'\", \"''\")) for k, n in rows)+';')" "$W/new.obj"
  cat <<'SQL'
with x as (
  select 'function public.'||p.oid::regprocedure::text as obj, p.proacl as acl
    from pg_proc p join _new n on n.kind='f' and n.name = p.oid::regprocedure::text
   where p.pronamespace='public'::regnamespace
  union all
  select case when c.relkind='S' then 'sequence ' else 'table ' end||'public.'||quote_ident(c.relname), c.relacl
    from pg_class c join _new n on n.kind='r' and n.name = c.oid::regclass::text
   where c.relnamespace='public'::regnamespace
), g as (
  select x.obj, case when e.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(e.grantee)) end as who,
         string_agg(e.privilege_type, ', ' order by e.privilege_type) as privs
    from x cross join lateral aclexplode(x.acl) e
   where e.grantee = 0 or pg_get_userbyid(e.grantee) in ('anon','authenticated','service_role')
   group by 1, 2
)
select line from (
  select obj k, 0 o, 'revoke all on '||obj||' from public, anon, authenticated, service_role;' line from x
  union all select obj, 1, 'grant '||privs||' on '||obj||' to '||who||';' from g) s
order by k, o, line;
SQL
} > "$W/acl.q.sql"
$PSQL -d $REF < "$W/acl.q.sql" > "$W/acl.sql"
echo "   $(grep -c '^revoke' "$W/acl.sql") objets, $(grep -c '^grant' "$W/acl.sql") grants"

echo "== 4 · le fichier =="
python3 "$FE/docs/production/G-assembler.py" "$W" "$BE/supabase/migrations" "$OUT"

echo "== 5 · l'épreuve : collé sur une copie de la production ==" # ACL comparées comme ENSEMBLES : l'ordre des entrées n'est pas un droit
ACLQ="select 'f '||p.oid::regprocedure::text||' '||pg_get_userbyid(p.proowner)||' '||coalesce((select string_agg(x::text, ',' order by x::text) from unnest(p.proacl) x),'-') from pg_proc p where p.pronamespace='public'::regnamespace
      union all select 'r '||c.oid::regclass::text||' '||pg_get_userbyid(c.relowner)||' '||coalesce((select string_agg(x::text, ',' order by x::text) from unnest(c.relacl) x),'-')||' rls='||c.relrowsecurity from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','v','m','S','p')
      union all select 'p '||tablename||'.'||policyname||' '||cmd||' '||array_to_string(roles,',') from pg_policies where schemaname='public'
      union all select 't '||tgrelid::regclass::text||'.'||tgname from pg_trigger where not tgisinternal
      union all select 'c '||table_name||'.'||column_name||' '||data_type from information_schema.columns where table_schema='public'"
sudo -u postgres createdb -T $BASE $TRY
sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d $TRY -f "$OUT" > "$W/try.log" 2>&1 || { echo "✗ le fichier échoue sur la copie : $(grep -m1 ERROR "$W/try.log")"; exit 1; }
$PSQL -d $REF -c "$ACLQ" | sort > "$W/ref.state"
$PSQL -d $TRY -c "$ACLQ" | sort > "$W/try.state"
d=$(diff "$W/ref.state" "$W/try.state" | grep -c '^[<>]' || true)
[ "$d" = "0" ] && echo "   ✓ identique à la référence : $(wc -l < "$W/ref.state") objets, droits, propriétaires, policies, triggers, colonnes" \
  || { echo "   ✗ $d écart(s) avec la référence :"; diff "$W/ref.state" "$W/try.state" | grep '^[<>]' | head -8; exit 1; }
n=$($PSQL -d $TRY -c "select count(*) from supabase_migrations.schema_migrations")
echo "   registre : $n"
sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d $TRY -f "$OUT" > "$W/try2.log" 2>&1 && { echo "   ✗ un second collage n'a PAS été refusé"; exit 1; }
grep -q 'déjà enregistrées' "$W/try2.log" && echo "   ✓ second collage refusé : « déjà enregistrées »" || { echo "   ✗ second collage refusé pour une autre raison : $(grep -m1 ERROR "$W/try2.log")"; exit 1; }
[ "$($PSQL -d $TRY -c "select count(*) from supabase_migrations.schema_migrations")" = "$n" ] && echo "   ✓ et il n'a rien changé"
echo "✓ $OUT prêt"

echo "== 6 · les vérifications d'après =="
ACL_F=$(sed -n 's/^ACL_F = """\(.*\)"""$/\1/p' "$FE/docs/production/G-verifier.py")
ACL_R=$(sed -n 's/^ACL_R = """\(.*\)"""$/\1/p' "$FE/docs/production/G-verifier.py")
[ -n "$ACL_F" ] && [ -n "$ACL_R" ] || { echo "✗ expressions d'ACL introuvables dans G-verifier.py"; exit 1; }
$PSQL -d $REF -c "select 'f|'||p.oid::regprocedure::text||'|'||pg_get_userbyid(p.proowner)||'|'||$ACL_F from pg_proc p where p.pronamespace='public'::regnamespace
                  union all select 'r|'||c.oid::regclass::text||'|'||pg_get_userbyid(c.relowner)||'|'||$ACL_R||'|'||c.relrowsecurity::text from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','v','m','S','p')" \
  | sort > "$W/ref.full"
# seuls les objets CRÉÉS (new.obj) : les autres ne dépendent pas de ce collage
python3 - "$W" <<'PY'
import sys
w = sys.argv[1]
new = {l.strip() for l in open(w + "/new.obj") if l.strip()}
keep = [l for l in open(w + "/ref.full") if "|".join(l.split("|")[:2]) in new]
open(w + "/exp_objects.txt", "w").writelines(keep)
print(f"   {len(keep)} objets attendus sur {len(new)} créés")
PY
COLS="select table_name||'.'||column_name||'|'||data_type from information_schema.columns where table_schema='public'"
TRG="select tgrelid::regclass::text||'.'||tgname from pg_trigger where not tgisinternal and tgrelid::regclass::text not like 'pg\_%' and tgrelid::regclass::text not like '%.%'"
POL="select tablename||'.'||policyname from pg_policies where schemaname='public'"
for k in COLS:exp_columns TRG:exp_triggers POL:exp_policies; do q=${k%%:*}; f=${k#*:}
  comm -13 <($PSQL -d $BASE -c "${!q}" | sort) <($PSQL -d $REF -c "${!q}" | sort) > "$W/$f.txt"
done
python3 "$FE/docs/production/G-verifier.py" "$W" "$FE/docs/production/G-verifications.sql"
VER=$FE/docs/production/G-verifications.sql
$PSQL -d $TRY -F' | ' -f "$VER" > "$W/ver-try.txt"
$PSQL -d $BASE -F' | ' -f "$VER" > "$W/ver-base.txt"
ok_try=$(grep -c '| OK |' "$W/ver-try.txt"); ko_base=$(grep -c '| PAS OK |' "$W/ver-base.txt"); n=$(wc -l < "$W/ver-try.txt")
[ "$ok_try" = "$n" ] && echo "   ✓ sur la copie migrée : $ok_try/$n OK" || { echo "   ✗ sur la copie migrée :"; cat "$W/ver-try.txt"; exit 1; }
# Contre-épreuve : sur la base NON migrée, chaque contrôle doit échouer — sauf
# aucun : un contrôle qui passe sans les migrations ne vérifie rien.
[ "$ko_base" = "$n" ] && echo "   ✓ contre-épreuve, sur la base non migrée : $ko_base/$n PAS OK" || { echo "   ✗ contrôles qui passent SANS les migrations :"; grep '| OK |' "$W/ver-base.txt"; exit 1; }
echo "✓ $VER prêt"
