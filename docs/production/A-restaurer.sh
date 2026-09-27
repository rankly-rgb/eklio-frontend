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

# ── ⚠ UN CONTRÔLE QUI NE VÉRIFIE PAS QU'IL A LU NE VÉRIFIE RIEN (2026-09-27) ──
# Trois formes creuses vivaient ici. (1) Les journaux s'écrivaient dans /tmp
# sous un nom fixe : un `pg_restore` qui ne partait pas (sauvegarde absente)
# laissait le journal de la passe PRÉCÉDENTE, et « 0 erreur » s'y lisait. (2) Le
# code de sortie de `pg_restore` était ignoré. (3) L'empreinte d'une base
# injoignable est VIDE, deux vides sont égaux, et `diff` concluait « 0 tables
# identiques ». Chaque lecture doit maintenant prouver qu'elle a eu lieu.
[ -s "$DUMP" ] || { echo "✗ sauvegarde absente ou vide : $DUMP"; exit 1; }
LOGS=$(mktemp -d)
# restore <section> <journal> — ok seulement si pg_restore a TOURNÉ, rendu 0, et
# écrit un journal neuf sans erreur.
restore() {
  local section=$1 log=$LOGS/$1.log rc e
  sudo -u postgres pg_restore --section="$section" -d "$TARGET" < "$DUMP" >"$log" 2>&1
  rc=$?
  e=$(grep -c "pg_restore: error" "$log" || true)
  if [ "$rc" = "0" ] && [ "$e" = "0" ]; then return 0; fi
  echo "      pg_restore --section=$section : code $rc, $e erreur(s)"; grep "pg_restore: error" "$log" | head -3 | sed 's/^/      /'
  return 1
}

echo "═══ 1 · le schéma seul ═══"
# ⚠ UN `dropdb` RATÉ ÉTAIT AVALÉ (2026-09-27) : une cible tenue ouverte (PostgREST
# branché dessus) survivait, et la restauration se faisait par-dessus une base
# sale. La vérification l'a vu, mais trop tard pour dire pourquoi.
sudo -u postgres dropdb --if-exists "$TARGET" >$LOGS/drop.log 2>&1 \
  || { ko "la cible $TARGET n'a pas pu être supprimée : $(tail -1 $LOGS/drop.log)"; exit $FAILED; }
sudo -u postgres createdb "$TARGET" || { ko "createdb $TARGET"; exit $FAILED; }
# ⚠ ON NE PRÉ-POSE RIEN. Les schémas `auth`, `storage` et `extensions` sont
# DANS la sauvegarde : les poser d'abord produit dix erreurs « schema already
# exists » au chargement du schéma, puis quatre « multiple primary keys » au
# post-data, pour des objets qui sont pourtant tous là. Dix-sept écarts
# apparents, zéro écart réel — et c'est le genre de bruit qui fait conclure
# que la procédure ne marche pas alors qu'elle marche.
restore pre-data && ok "schéma restauré" || ko "le schéma ne s'est pas restauré"

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
restore data && ok "données restaurées sans erreur" || ko "les données ne se sont pas restaurées"

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
restore post-data && ok "post-data restauré" || ko "le post-data ne s'est pas restauré"

echo "═══ 6 · ⚠ LA VÉRIFICATION : LIGNE À LIGNE, PAS TABLE À TABLE ═══"
if [ -z "$SOURCE" ]; then
  echo "  ⚠ pas de base source fournie — le contenu n'est PAS vérifié."
  echo "    Compter les tables ne voyait rien : les comptes étaient identiques"
  echo "    pendant que onze lignes manquaient."
  exit $FAILED
fi

# Empreinte par table : compte + md5 du contenu entier, lignes triées.
# ⚠ Une source peut être DISTANTE (une URI postgresql://, la production) : elle se
# lit alors par `psql <uri>` avec le PGPASSWORD de l'environnement, pas par sudo.
q() {
  case "$1" in
    postgresql://*|postgres://*) local db=$1; shift; psql "$db" -qAt -v ON_ERROR_STOP=1 "$@" ;;
    *) local db=$1; shift; sudo -u postgres psql -qAt -v ON_ERROR_STOP=1 -d "$db" "$@" ;;
  esac
}
digest() {
  q "$1" -c "
    select t.table_name || ' ' ||
           (select count(*) from information_schema.columns c
             where c.table_schema='public' and c.table_name=t.table_name)
      from information_schema.tables t
     where t.table_schema='public' and t.table_type='BASE TABLE'
     order by t.table_name;" | while read -r tbl _; do
    n=$(q "$1" -c "select count(*) from public.\"$tbl\"" 2>/dev/null)
    h=$(q "$1" -c "
        select coalesce(md5(string_agg(x, '' order by x)), 'vide')
          from (select (public.\"$tbl\".*)::text as x from public.\"$tbl\") s" 2>/dev/null)
    echo "$tbl|$n|$h"
  done
}
# ⚠ LES DROITS AUSSI (2026-09-27). Une sauvegarde prise sans les privilèges se
# restaure avec des lignes identiques et CHAQUE FONCTION OUVERTE À TOUS : la
# vérification disait « 0 écart ». Constaté sur la doublure de production.
acl_digest() {
  q "$1" -c "
    select 'function '||p.oid::regprocedure::text||' '||coalesce(p.proacl::text,'(défaut)')
      from pg_proc p where p.pronamespace = 'public'::regnamespace
    union all
    select 'table '||c.relname||' '||coalesce(c.relacl::text,'(défaut)')||' rls='||c.relrowsecurity
      from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','v','m')
    union all
    select 'policy '||tablename||'.'||policyname||' '||cmd||' '||array_to_string(roles, ',')
      from pg_policies where schemaname = 'public'
    order by 1"
}
acl_digest "$SOURCE" > $LOGS/src.acl
acl_digest "$TARGET" > $LOGS/tgt.acl
if [ ! -s $LOGS/src.acl ]; then
  ko "les droits de la source n'ont pas été lus"
elif ! diff -q $LOGS/src.acl $LOGS/tgt.acl >/dev/null; then
  ko "les DROITS diffèrent ($(diff $LOGS/src.acl $LOGS/tgt.acl | grep -c '^[<>]') ligne(s)) :"
  diff $LOGS/src.acl $LOGS/tgt.acl | grep '^[<>]' | head -6 | sed 's/^/      /'
else
  ok "droits identiques : $(wc -l < $LOGS/src.acl) fonctions, tables et policies"
fi

digest "$SOURCE" > $LOGS/src.digest
digest "$TARGET" > $LOGS/tgt.digest
diffs=$(diff $LOGS/src.digest $LOGS/tgt.digest | grep '^[<>]' || true)
tables=$(wc -l < $LOGS/src.digest)
# ⚠ AVANT de comparer : chaque côté a-t-il été LU ? Une base injoignable rend une
# empreinte vide ; une table illisible rend « nom|| » des deux côtés.
unread=$(cat $LOGS/src.digest $LOGS/tgt.digest | awk -F'|' '$2=="" || $3==""' | head -3)
expected=$(q "$SOURCE" -c "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'" 2>/dev/null)
if [ -z "$expected" ] || [ "$expected" = "0" ] || [ "$tables" != "$expected" ]; then
  ko "la source n'a pas été lue : $tables table(s) empreintes pour « ${expected:-illisible} » attendues"
elif [ -n "$unread" ]; then
  ko "des tables n'ont pas été lues (compte ou empreinte vide) : $(echo $unread | tr '\n' ' ')"
elif [ -z "$diffs" ]; then
  ok "$tables tables identiques, ligne à ligne et contenu compris"
else
  ko "des tables diffèrent :"
  diff $LOGS/src.digest $LOGS/tgt.digest | grep '^[<>]' | head -12 | sed 's/^/      /'
fi

echo
echo "── $FAILED écart(s) ──"
exit $FAILED
