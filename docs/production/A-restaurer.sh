#!/usr/bin/env bash
# ── RESTAURER UNE SAUVEGARDE EKLIO, ET LE PROUVER ───────────────────────
#
# ⚠ `pg_restore` NU PERD DES DONNÉES EN SILENCE SUR CETTE BASE.
#
# Mesuré le 2026-09-24 : `section_types` porte onze lignes de référence et
# s'en restaure ZÉRO, dans une base qui paraît intacte — même nombre de
# tables, de fonctions et de policies de part et d'autre. Le mécanisme est une
# contrainte `CHECK` qui appelle une fonction lisant une AUTRE table : une
# `CHECK` est immédiate par construction, elle s'évalue pendant le `COPY`,
# avant que la table qu'elle consulte soit chargée.
#
#   pg_restore nu                → section_types restaure 0 sur 11, en silence
#   pg_restore --single-transaction → la restauration entière avorte
#
# ── LA PROCÉDURE, EN TROIS TEMPS ────────────────────────────────────────
#
# C'est la forme documentée pour toute contrainte qu'on ne peut pas tenir
# pendant le chargement :
#
#   1. le SCHÉMA seul        `--section=pre-data`
#   2. on RETIRE les `CHECK` qui lisent une autre table, en gardant leur
#      définition exacte
#   3. les DONNÉES           `--section=data`
#   4. on REPOSE les contraintes — et elles se valident alors sur des données
#      COMPLÈTES, ce qui est le seul moment où la question a un sens
#   5. le reste              `--section=post-data` (index, clés étrangères,
#      triggers ; ⚠ `pg_dump` pose déjà les clés étrangères ici, APRÈS les
#      données, et c'est exactement pourquoi une clé étrangère se restaure
#      nativement là où une `CHECK` échoue)
#
# ⚠ ET LES CONTRAINTES REPOSÉES SONT VALIDÉES, PAS DÉCLARÉES. On ne met pas
# `NOT VALID` : une contrainte reposée sans validation rendrait la
# restauration verte en laissant passer exactement ce qu'elle interdit.
#
# ── ⚠ LA VÉRIFICATION EST LE LIVRABLE ──────────────────────────────────
#
# Compter les tables, les fonctions et les policies ne voyait RIEN : les trois
# comptes étaient identiques pendant que onze lignes manquaient. On compare
# donc, table par table, le nombre de lignes ET une empreinte du contenu.
#
# Usage :
#   bash docs/production/A-restaurer.sh <dump> <base-cible> [<base-source>]
#
# Sans base source, la vérification de contenu est sautée et le dit.
set -uo pipefail
DUMP="${1:?usage: A-restaurer.sh <dump> <base-cible> [<base-source>]}"
TARGET="${2:?base cible}"
SOURCE="${3:-}"
PSQL="sudo -u postgres psql -qAt -v ON_ERROR_STOP=1"
FAILED=0
ok(){ printf '  ✓ %s\n' "$1"; }
ko(){ printf '  ✗ %s\n' "$1"; FAILED=$((FAILED+1)); }

echo "═══ 1 · le schéma seul ═══"
sudo -u postgres dropdb --if-exists "$TARGET" >/dev/null 2>&1
sudo -u postgres createdb "$TARGET"
# ⚠ ON NE PRÉ-POSE RIEN. Les schémas `auth`, `storage` et `extensions` sont
# DANS la sauvegarde : les poser d'abord produit dix erreurs « schema already
# exists » au chargement du schéma, puis quatre « multiple primary keys » au
# post-data, pour des objets qui sont pourtant tous là. Dix-sept écarts
# apparents, zéro écart réel — et c'est le genre de bruit qui fait conclure
# que la procédure ne marche pas alors qu'elle marche.
sudo -u postgres pg_restore --section=pre-data -d "$TARGET" < "$DUMP" >/tmp/pre.log 2>&1
e=$(grep -c "pg_restore: error" /tmp/pre.log || true)
[ "$e" = "0" ] && ok "schéma restauré" || ko "$e erreur(s) au schéma"

echo "═══ 2 · retirer les CHECK qui lisent une autre table ═══"
# ⚠ Énumérées depuis le CATALOGUE, jamais écrites à la main : une liste tenue
# à la main ne grandit pas toute seule, et la prochaine contrainte de cette
# classe arriverait sans que personne la rajoute.
DROPPED=$($PSQL -d "$TARGET" -c "
  select string_agg(
           format('%s|%s|%s', c.conrelid::regclass, c.conname, pg_get_constraintdef(c.oid)),
           E'\n')
    from pg_constraint c
   where c.contype = 'c'
     and c.connamespace = 'public'::regnamespace
     and exists (
       select 1 from pg_depend d join pg_proc p on p.oid = d.refobjid
        where d.objid = c.oid and d.refclassid = 'pg_proc'::regclass
          and p.pronamespace = 'public'::regnamespace
          and pg_get_functiondef(p.oid) ~* 'from public\.'
     );")
if [ -z "$DROPPED" ]; then
  ok "aucune contrainte de cette classe — rien à retirer"
else
  echo "$DROPPED" | while IFS='|' read -r tbl con def; do
    [ -z "$con" ] && continue
    $PSQL -d "$TARGET" -c "alter table $tbl drop constraint $con;" >/dev/null && \
      ok "retirée : $tbl.$con"
  done
fi

echo "═══ 3 · les données ═══"
sudo -u postgres pg_restore --section=data -d "$TARGET" < "$DUMP" >/tmp/data.log 2>&1
e=$(grep -c "pg_restore: error" /tmp/data.log || true)
[ "$e" = "0" ] && ok "données restaurées sans erreur" || { ko "$e erreur(s) aux données"; grep "pg_restore: error" /tmp/data.log | head -3; }

echo "═══ 4 · reposer les contraintes, et les VALIDER ═══"
if [ -n "$DROPPED" ]; then
  echo "$DROPPED" | while IFS='|' read -r tbl con def; do
    [ -z "$con" ] && continue
    if $PSQL -d "$TARGET" -c "alter table $tbl add constraint $con $def;" >/dev/null 2>&1; then
      ok "reposée et validée : $tbl.$con"
    else
      ko "$tbl.$con refuse les données restaurées — la sauvegarde elle-même violait la contrainte"
    fi
  done
fi

echo "═══ 5 · index, clés étrangères, triggers ═══"
sudo -u postgres pg_restore --section=post-data -d "$TARGET" < "$DUMP" >/tmp/post.log 2>&1
e=$(grep -c "pg_restore: error" /tmp/post.log || true)
[ "$e" = "0" ] && ok "post-data restauré" || ko "$e erreur(s) au post-data"

echo "═══ 6 · ⚠ LA VÉRIFICATION : LIGNE À LIGNE, PAS TABLE À TABLE ═══"
if [ -z "$SOURCE" ]; then
  echo "  ⚠ pas de base source fournie — le contenu n'est PAS vérifié."
  echo "    Compter les tables ne voyait rien : les comptes étaient identiques"
  echo "    pendant que onze lignes manquaient."
  exit $FAILED
fi

# Empreinte par table : compte + md5 du contenu entier, lignes triées.
digest() {
  sudo -u postgres psql -qAt -d "$1" -c "
    select t.table_name || ' ' ||
           (select count(*) from information_schema.columns c
             where c.table_schema='public' and c.table_name=t.table_name)
      from information_schema.tables t
     where t.table_schema='public' and t.table_type='BASE TABLE'
     order by t.table_name;" | while read -r tbl _; do
    n=$(sudo -u postgres psql -qAt -d "$1" -c "select count(*) from public.\"$tbl\"" 2>/dev/null)
    h=$(sudo -u postgres psql -qAt -d "$1" -c "
        select coalesce(md5(string_agg(x, '' order by x)), 'vide')
          from (select (public.\"$tbl\".*)::text as x from public.\"$tbl\") s" 2>/dev/null)
    echo "$tbl|$n|$h"
  done
}
digest "$SOURCE" > /tmp/src.digest
digest "$TARGET" > /tmp/tgt.digest
diffs=$(diff /tmp/src.digest /tmp/tgt.digest | grep '^[<>]' || true)
tables=$(wc -l < /tmp/src.digest)
if [ -z "$diffs" ]; then
  ok "$tables tables identiques, ligne à ligne et contenu compris"
else
  ko "des tables diffèrent :"
  diff /tmp/src.digest /tmp/tgt.digest | grep '^[<>]' | head -12 | sed 's/^/      /'
fi

echo
echo "── $FAILED écart(s) ──"
exit $FAILED
