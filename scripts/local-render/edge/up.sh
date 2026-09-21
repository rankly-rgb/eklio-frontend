#!/usr/bin/env bash
# scripts/local-render/edge/up.sh — la façade Supabase, en local, pour un bac à
# sable qui a un vrai PostgreSQL mais pas Docker.
#
#   /rest/v1/*    -> PostgREST 12.2.3, la brique que Supabase fait tourner
#   /auth/v1/*    -> les quatre points d'entrée GoTrue que @supabase/ssr appelle
#   /storage/v1/* -> 501, pour qu'un appel qui en a besoin tombe bruyamment
#
# ⚠ AUCUN SECRET N'EST ÉCRIT ICI NI COMMITÉ. Le secret JWT est tiré à chaque
# exécution dans $WORK, qui est hors du dépôt, et les deux clefs qu'il signe
# n'ont de valeur que sur cette machine.
set -euo pipefail
cd "$(dirname "$0")"

DB=${DB:-eklio_local_verify}
WORK=${WORK:-/tmp/eklio-edge}
PGRST_VERSION=v12.2.3
mkdir -p "$WORK"

if [ ! -x "$WORK/postgrest" ]; then
  echo "== Fetching PostgREST $PGRST_VERSION =="
  curl -sSL -o "$WORK/pgrst.tar.xz" \
    "https://github.com/PostgREST/postgrest/releases/download/$PGRST_VERSION/postgrest-$PGRST_VERSION-linux-static-x64.tar.xz"
  tar xf "$WORK/pgrst.tar.xz" -C "$WORK"
fi

echo "== Roles PostgREST connects as =="
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" <<SQL
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname='authenticator') then
    create role authenticator login noinherit password 'eklio_local';
  end if;
  if not exists (select 1 from pg_roles where rolname='edge_auth') then
    create role edge_auth login password 'eklio_local';
  end if;
end \$\$;
grant anon, authenticated, service_role to authenticator;
grant usage on schema public, auth, storage, extensions to authenticator;
grant usage on schema auth to edge_auth;
grant select on auth.users to edge_auth;
SQL

if [ ! -f "$WORK/jwt.secret" ]; then
  head -c 48 /dev/urandom | base64 | tr -d '=+/' | head -c 48 > "$WORK/jwt.secret"
fi
node mintkeys.mjs "$(cat "$WORK/jwt.secret")" > "$WORK/keys.env"

cat > "$WORK/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:eklio_local@127.0.0.1:5432/$DB"
db-schemas = "public"
db-anon-role = "anon"
db-extra-search-path = "public, extensions"
jwt-secret = "$(cat "$WORK/jwt.secret")"
server-host = "127.0.0.1"
server-port = 3001
db-pool = 10
CONF

( cd "$WORK" && nohup ./postgrest postgrest.conf > postgrest.log 2>&1 & )
sleep 5
WORK="$WORK" DB="$DB" nohup node gateway.mjs > "$WORK/gateway.log" 2>&1 &
sleep 3

echo
echo "== The local edge is up on http://127.0.0.1:54321 =="
echo "Put these in .env.local (the Anthropic key NEVER goes in a file):"
echo "  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321"
sed -n 's/^ANON=/  NEXT_PUBLIC_SUPABASE_ANON_KEY=/p' "$WORK/keys.env"
sed -n 's/^SERVICE=/  SUPABASE_SERVICE_ROLE_KEY=/p' "$WORK/keys.env"
