#!/usr/bin/env bash
# ── RÉPÉTITION À BLANC DE LA MISE EN PRODUCTION ──────────────────────────
# Joue les dix étapes contre une COPIE LOCALE de la base de production,
# reconstituée depuis les 133 migrations que `main` porte. Aucun accès réel.
set -uo pipefail
S=/tmp/claude-0/-home-user/5b3a3612-b0c0-5aab-a84a-6d1f41b6eecf/scratchpad
DB=eklio_prod_rehearsal
BK=eklio_prod_rehearsal_backup
Q="sudo -u postgres psql -qAt -v ON_ERROR_STOP=1 -d $DB"
ok(){ printf '  ✓ %s\n' "$1"; }
ko(){ printf '  ✗ %s\n' "$1"; FAILED=$((FAILED+1)); }
FAILED=0

echo "═══ ÉTAPE 0 — ⚠ LE CORRECTIF DE RESTAURATION, SEUL, AVANT TOUT ═══"
# Mesuré : sans lui, la sauvegarde de l'étape 2 restaure section_types VIDE.
sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d "$DB" < supabase/migrations/20260924150000_a_backup_that_does_not_restore_is_not_a_backup.sql >$S/fix.log 2>&1 \
  && ok "20260924150000 appliquée seule sur la base à 133 migrations" \
  || ko "le correctif de restauration échoue: $(tail -1 $S/fix.log)"

echo "═══ ÉTAPE 1 — vérifications bloquantes ═══"
n=$(ls $S/target-migrations/*.sql | wc -l)
[ "$n" -eq 155 ] && ok "155 migrations sur la branche source" || ko "compte de migrations: $n"
# rejeu complet sur une base neuve
sudo -u postgres dropdb --if-exists ${DB}_replay >/dev/null 2>&1
sudo -u postgres createdb ${DB}_replay
sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d ${DB}_replay -f scripts/local-verify-stub-schema.sql >/dev/null 2>&1
rf=0; for f in $S/target-migrations/*.sql; do
  sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d ${DB}_replay < "$f" >$S/r.log 2>&1 || { rf=$((rf+1)); [ $rf -le 2 ] && echo "      $(basename $f): $(tail -1 $S/r.log | cut -c1-110)"; }
done
[ "$rf" -eq 0 ] && ok "les 155 se rejouent sur une base neuve" || ko "$rf migration(s) échouent au rejeu neuf"

echo "═══ ÉTAPE 2 — sauvegarde, et vérifier qu'elle se restaure ═══"
sudo -u postgres pg_dump -Fc "$DB" > $S/prod.dump 2>$S/d.log \
  && ok "sauvegarde prise ($(du -h $S/prod.dump | cut -f1))" || ko "pg_dump: $(tail -1 $S/d.log)"
sudo -u postgres dropdb --if-exists "$BK" >/dev/null 2>&1; sudo -u postgres createdb "$BK"
sudo -u postgres pg_restore --single-transaction -d "$BK" < $S/prod.dump >$S/rs.log 2>&1
e=$(grep -c "pg_restore: error" $S/rs.log)
[ "$e" = "0" ] && ok "restauration sans erreur" || ko "$e erreur(s) de restauration"
for t in section_types site_pages modalities; do
  x=$(sudo -u postgres psql -qAt -d "$DB" -c "select count(*) from public.$t" 2>/dev/null)
  y=$(sudo -u postgres psql -qAt -d "$BK" -c "select count(*) from public.$t" 2>/dev/null)
  [ "$x" = "$y" ] && ok "$t : $x lignes de part et d'autre" || ko "$t : $x contre $y"
done
a=$(sudo -u postgres psql -qAt -d "$DB" -c "select count(*) from information_schema.tables where table_schema='public'")
b=$(sudo -u postgres psql -qAt -d "$BK" -c "select count(*) from information_schema.tables where table_schema='public'")
[ "$a" = "$b" ] && ok "restauration vérifiée : $a tables de part et d'autre" || ko "restauration: $a vs $b tables"

echo "═══ ÉTAPE 3 — appliquer les 21 nouvelles, dans l'ordre, arrêt au premier échec ═══"
applied=0; stopped=""
for f in $(comm -13 <(ls $S/prod-migrations | sort) <(ls $S/target-migrations | sort)); do
  if sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d "$DB" < "$S/target-migrations/$f" >$S/m.log 2>&1; then
    applied=$((applied+1))
  else
    stopped="$f"; echo "      arrêt sur $f : $(tail -2 $S/m.log | tr '\n' ' ' | cut -c1-140)"; break
  fi
done
[ -z "$stopped" ] && ok "les 21 appliquées, dans l'ordre" || ko "arrêt après $applied, sur $stopped"

echo "═══ ÉTAPE 4 — F12 : la matrice refuse tout tant qu'elle est vide ═══"
rows=$($Q -c "select count(*) from public.license_type_states")
nullv=$($Q -c "select count(*) from public.license_type_states where verified_at is null")
[ "$rows" = "$nullv" ] && ok "les $rows lignes sont à NULL sur une base neuve" || ko "$rows lignes, $nullv à NULL"
sellable=$($Q -c "select count(*) from public.license_type_states where verified_at is not null")
[ "$sellable" = "0" ] && ok "aucun État vendable : c'est la bonne réponse, pas une panne" || ko "$sellable déjà marqués"

echo "═══ ÉTAPE 7b — les deux tables de F17 existent ═══"
t=$($Q -c "select count(*) from information_schema.tables where table_name in ('content_generation_runs','content_generation_results')")
[ "$t" = "2" ] && ok "content_generation_runs et content_generation_results" || ko "seulement $t des 2 tables de F17"

echo "═══ ÉTAPE 8 — la banque : les fonctions de tirage existent et répondent ═══"
for fn in next_topic_for_kit drawable_topics_for_kit drawable_count_for_kit release_stale_topic_assignments assign_topic_to_kit; do
  c=$($Q -c "select count(*) from pg_proc where proname='$fn'")
  [ "$c" != "0" ] && ok "$fn" || ko "$fn absente"
done
empty=$($Q -c "select count(*) from public.content_topics")
[ "$empty" = "0" ] && ok "banque vide sur une base neuve — le remplissage est l'étape 8" || ko "$empty sujets déjà là"

echo "═══ ÉTAPE 8b — le crédit : le point d'étranglement et la vue d'audit ═══"
for fn in reserve_credit settle_credit; do
  c=$($Q -c "select count(*) from pg_proc where proname='$fn'")
  [ "$c" != "0" ] && ok "$fn" || ko "$fn absente"
done
v=$($Q -c "select count(*) from information_schema.views where table_name='credit_month_audit'")
[ "$v" = "1" ] && ok "credit_month_audit" || ko "credit_month_audit absente"
i=$($Q -c "select count(*) from pg_indexes where indexname='credit_ledger_one_outcome_per_reservation'")
[ "$i" = "1" ] && ok "l'invariant un-seul-dénouement-par-réservation" || ko "l'invariant de crédit manque"

echo "═══ ÉTAPE 8d — le juge : rien à vérifier en base, mais la clé doit être lue par la ROUTE ═══"
ok "(hors base — voir docs/production/B2-les-secrets.md)"

echo
echo "── $FAILED échec(s) sur les étapes jouables ──"
