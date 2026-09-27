#!/usr/bin/env bash
# ── APPLIQUER LES 30 MIGRATIONS EN PRODUCTION — QUATRE CONDITIONS, PUIS L'ACTE ──
#
# Écrit le 2026-09-27, la session qui devait l'exécuter n'ayant PAS pu joindre la
# production (secrets absents du conteneur, hôte direct en IPv6 seulement, pooler
# et api.supabase.com fermés). Voir `F-application-resultat.md`.
#
#   PGPASSWORD vient de SUPABASE_DB_PASSWORD, par l'environnement, jamais écrit.
#   POOLER_HOST : l'hôte du « Session pooler » (IPv4) que le tableau de bord
#   Supabase affiche sous Connect — par ex. aws-0-us-east-1.pooler.supabase.com.
#   ⚠ PAS le « Transaction pooler » (6543) : pg_dump et les migrations DDL
#   veulent une session.
#
#   bash docs/production/F-appliquer-les-migrations.sh            # conditions 1 à 3, AUCUNE écriture
#   bash docs/production/F-appliquer-les-migrations.sh --apply    # idem, puis l'application si tout est vert
#
# La condition 4 (le code de `main` contre la copie migrée) se joue entre les
# deux, à la main, par `scripts/stripe-path/play.ts` — §4 ci-dessous. `--apply`
# exige le fichier qu'elle laisse.
set -uo pipefail

REF=fobgdsupyfslxbswfuay
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD absente de l'environnement}"
: "${POOLER_HOST:?POOLER_HOST : l'hôte du Session pooler (Supabase → Connect)}"
export PGPASSWORD="$SUPABASE_DB_PASSWORD"
export PGSSLMODE=${PGSSLMODE:-require}
# PROD_URI ne sert qu'à l'épreuve locale du script (une doublure de la production).
PROD=${PROD_URI:-"postgresql://postgres.$REF@$POOLER_HOST:5432/postgres"}
BE=${EKLIO_BACKEND:-/home/user/eklio-backend}
FE=${EKLIO_FRONTEND:-/home/user/eklio-frontend}
W=${WORK:-/tmp/eklio-apply}
LOCAL=eklio_prod_restored
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
mkdir -p "$W"
ok(){ printf '  ✓ %s\n' "$1"; }
die(){ printf '  ✗ %s\n  → ARRÊT. Rien n’a été écrit en production.\n' "$1"; exit 1; }
prod(){ psql "$PROD" -qAt -v ON_ERROR_STOP=1 "$@"; }
loc(){ sudo -u postgres psql -qAt -v ON_ERROR_STOP=1 -d "$LOCAL" "$@"; }

# Les 30 : ce que la branche porte et que `origin/main` (= la production) n'a pas.
git -C "$BE" fetch -q origin main
NEW=$(comm -13 <(git -C "$BE" ls-tree --name-only origin/main supabase/migrations/ | grep '\.sql$' | xargs -n1 basename | sort) \
               <(ls "$BE"/supabase/migrations/*.sql | xargs -n1 basename | sort))
N=$(echo "$NEW" | grep -c .)
[ "$N" = "30" ] || die "$N migrations nouvelles, 30 attendues — la branche a bougé, relire avant d'appliquer"
echo "$NEW" | grep -q '^20260927110000_' || die "F61 absente de la liste"
echo "$NEW" | grep -q '^20260927130000_' || die "F64 absente de la liste"

echo "═══ 0 · la production, en lecture ═══"
sv=$(prod -c "show server_version_num") || die "connexion à la production impossible"
cv=$(pg_dump --version | grep -Eo '[0-9]+' | head -1)
[ "${sv:0:2}" -le "$cv" ] || die "serveur PostgreSQL ${sv:0:2}, pg_dump $cv : installer pg_dump ${sv:0:2} (un dump d'une version plus récente échoue)"
ok "serveur $sv, pg_dump $cv"
# Le registre : aucune des 30 ne doit y être déjà.
already=$(prod -c "select string_agg(version, ' ') from supabase_migrations.schema_migrations where version in ($(echo "$NEW" | cut -d_ -f1 | sed "s/.*/'&'/" | paste -sd,))")
[ -z "$already" ] || die "déjà enregistrées en production : $already"
reg=$(prod -c "select count(*) from supabase_migrations.schema_migrations")
ok "registre : $reg migrations enregistrées, aucune des 30"

echo "═══ 1 · SAUVEGARDE FRAÎCHE ═══"
stamp=$(prod -c "select to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS \"UTC\"')")
DUMP="$W/prod-$(date -u +%Y%m%dT%H%M%SZ).dump"
# ⚠ AVEC LES DROITS. `--no-privileges` rendait une copie où chaque fonction était
# exécutable par tous : le rejeu de 20260920140000 l'a refusé (« comp_grant_active
# was opened to authenticated »), et la copie ne ressemblait plus à la production.
pg_dump "$PROD" -Fc --no-owner -f "$DUMP" 2>"$W/dump.log" || die "pg_dump : $(tail -2 "$W/dump.log")"
[ -s "$DUMP" ] || die "sauvegarde vide"
ok "sauvegarde prise à $stamp — $(du -h "$DUMP" | cut -f1), $DUMP"
echo "$stamp" > "$W/backup.stamp"

echo "═══ 2 · RESTAURATION PROUVÉE, LIGNE À LIGNE ═══"
# Les droits restaurés nomment des rôles : ceux de la production qui manquent au
# Postgres local sont créés, sans connexion ni attribut. Sinon chaque GRANT échoue.
for r in $(prod -c "select rolname from pg_roles where rolname !~ '^pg_' order by 1"); do
  sudo -u postgres psql -qAt -c "select 1 from pg_roles where rolname = '$r'" | grep -q 1 \
    || sudo -u postgres psql -q -c "create role \"$r\" nologin" >/dev/null
done
# A-restaurer.sh compare la cible à une SOURCE ; la source ici est la production
# elle-même, lue par son URI. Empreinte = compte + md5 du contenu trié.
bash "$FE/docs/production/A-restaurer.sh" "$DUMP" "$LOCAL" "$PROD" | tee "$W/restore.log"
grep -q '── 0 écart(s) ──' "$W/restore.log" || die "la restauration a des écarts — voir $W/restore.log"
grep -q 'tables identiques, ligne à ligne' "$W/restore.log" || die "la comparaison ligne à ligne n'a pas eu lieu"
ok "restauration prouvée : $(grep -o '[0-9]* tables identiques' "$W/restore.log")"

echo "═══ 3 · REJEU À BLANC SUR LA COPIE RESTAURÉE ═══"
objects(){ sudo -u postgres psql -qAt -d "$LOCAL" -c "
  select 'table '||table_name from information_schema.tables where table_schema='public'
  union all select 'column '||table_name||'.'||column_name from information_schema.columns where table_schema='public'
  union all select 'function '||p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
  union all select 'policy '||tablename||'.'||policyname from pg_policies where schemaname='public'
  union all select 'trigger '||tgrelid::regclass||'.'||tgname from pg_trigger where not tgisinternal" | sort -u; }
objects > "$W/before.txt"
[ "$(wc -l < "$W/before.txt")" -gt 500 ] || die "l'inventaire d'avant n'a pas été lu"
rows_before=$(loc -c "select sum(n_live_tup) from pg_stat_user_tables")
for f in $NEW; do
  sudo -u postgres psql -q -1 -v ON_ERROR_STOP=1 -d "$LOCAL" < "$BE/supabase/migrations/$f" >"$W/m.log" 2>&1 \
    || die "le rejeu échoue sur $f : $(grep -m1 ERROR "$W/m.log")"
done
ok "les $N migrations appliquées à la copie, 0 erreur"
objects > "$W/after.txt"
removed=$(comm -23 "$W/before.txt" "$W/after.txt")
added=$(comm -13 "$W/before.txt" "$W/after.txt" | wc -l)
[ -z "$removed" ] || die "objets RETIRÉS par les migrations : $(echo "$removed" | head -5 | tr '\n' ' ')"
ok "additivité sur les données réelles : $added objets ajoutés, 0 retiré"
touch "$W/condition3.ok"

cat <<EOF

═══ 4 · CONTRE-ÉPREUVE — le code de \`main\` contre la copie migrée ═══
  À jouer maintenant, puis relancer avec --apply :
    DB=$LOCAL bash $FE/scripts/local-render/edge/up.sh
    (worktree de origin/main, npm ci, next dev -p 3002 avec STRIPE_WEBHOOK_SECRET=\$WHSEC)
    ROUTE=http://localhost:3002/api/stripe/webhook DB=$LOCAL WHSEC=… npx tsx scripts/stripe-path/play.ts
  Attendu : sections 1, 1b, 2, 4, 5, 6, 7 vertes ; seul échec admis, la double
  allocation de 4c (défaut de main, corrigé par la branche). Alors :
    touch $W/condition4.ok
EOF

[ "$APPLY" = "1" ] || { echo; echo "Sans --apply : rien n'a été écrit en production."; exit 0; }
[ -f "$W/condition4.ok" ] || die "condition 4 non attestée ($W/condition4.ok absent)"
age=$(( $(date +%s) - $(stat -c %Y "$DUMP") ))
[ "$age" -lt 3600 ] || die "la sauvegarde a $((age/60)) min — plus d'une heure, en reprendre une"

echo "═══ APPLICATION EN PRODUCTION — une transaction par migration, arrêt au premier échec ═══"
# ⚠ Enregistrée sous le NOM DU FICHIER, comme `supabase db push` : sinon un push
# futur la réappliquerait (README du backend, « le cas inverse »). Même
# transaction que la migration : l'une sans l'autre est impossible.
cols=$(prod -c "select string_agg(column_name, ',') from information_schema.columns where table_schema='supabase_migrations' and table_name='schema_migrations'")
echo "$cols" | grep -q 'version' && echo "$cols" | grep -q 'name' || die "schema_migrations sans version/name : $cols"
applied=0
for f in $NEW; do
  v=${f%%_*}; name=${f#*_}; name=${name%.sql}
  { cat "$BE/supabase/migrations/$f"; echo; echo "insert into supabase_migrations.schema_migrations (version, name) values ('$v', '$name');"; } \
    | psql "$PROD" -q -1 -v ON_ERROR_STOP=1 >"$W/apply-$v.log" 2>&1 || {
      echo "  ✗ ÉCHEC sur $f (transaction annulée : elle n'a rien laissé) :"; grep -m3 ERROR "$W/apply-$v.log" | sed 's/^/      /'
      echo "  → $applied migration(s) appliquée(s) AVANT elle, et enregistrées. ARRÊT. Aucune correction improvisée."
      echo "  → Restauration possible depuis $DUMP (état d'avant la première), par A-restaurer.sh vers une base neuve."
      exit 2; }
  applied=$((applied+1)); ok "$f"
done
ok "$applied/$N migrations appliquées en production"
