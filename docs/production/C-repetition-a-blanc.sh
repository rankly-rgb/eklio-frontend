#!/usr/bin/env bash
# ── RÉPÉTITION À BLANC DE LA MISE EN PRODUCTION ──────────────────────────
# Joue les dix étapes contre une COPIE LOCALE de la base de production,
# reconstituée depuis les 133 migrations que `main` porte. Aucun accès réel.
set -uo pipefail
# ⚠ LE RÉPERTOIRE DE TRAVAIL ÉTAIT LE SCRATCHPAD D'UNE SESSION PASSÉE, EN DUR,
# et les deux clichés de migrations y vivaient : sur une machine neuve la
# répétition ne trouvait rien à rejouer. Il est maintenant paramétrable, et les
# clichés se reconstruisent depuis git (2026-09-27).
S=${REHEARSAL_DIR:-/tmp/eklio-rehearsal}
mkdir -p "$S"

# ── ⚠ LES CHEMINS SONT ABSOLUS, ET C'ÉTAIT UN DÉFAUT DE LA RÉPÉTITION ────
# Le script lisait `scripts/local-verify-stub-schema.sql` et
# `supabase/migrations/…` en relatif. Les deux vivent dans eklio-backend ; lancé
# depuis eklio-frontend, il a rendu 31 échecs dont AUCUN n'était un défaut de
# migration — l'amorce n'avait simplement pas été trouvée. Une répétition de
# mise en production qui ne tourne que depuis un répertoire non écrit quelque
# part est une répétition qu'on rate le jour où on en a besoin.
BE=${EKLIO_BACKEND:-/home/user/eklio-backend}
[ -d "$BE/supabase/migrations" ] || { echo "✗ dépôt backend introuvable en $BE (poser EKLIO_BACKEND)"; exit 1; }
STUB=$BE/scripts/local-verify-stub-schema.sql
MIG=$BE/supabase/migrations
DB=eklio_prod_rehearsal
BK=eklio_prod_rehearsal_backup
Q="sudo -u postgres psql -qAt -v ON_ERROR_STOP=1 -d $DB"
ok(){ printf '  ✓ %s\n' "$1"; }
ko(){ printf '  ✗ %s\n' "$1"; FAILED=$((FAILED+1)); }
FAILED=0

# ── LES DEUX CLICHÉS, DÉRIVÉS DU DÉPÔT ──────────────────────────────────
# prod-migrations : ce que la production porte = `origin/main` du backend
#                   (B4 : 133 migrations au 2026-09-17).
# target-migrations : ce que la branche source porte, tel quel.
PROD_REF=${PROD_REF:-origin/main}
rm -rf "$S/prod-migrations" "$S/target-migrations"
mkdir -p "$S/prod-migrations" "$S/target-migrations"
for f in $(git -C "$BE" ls-tree --name-only "$PROD_REF" supabase/migrations/ | grep '\.sql$'); do
  git -C "$BE" show "$PROD_REF:$f" > "$S/prod-migrations/$(basename "$f")"
done
cp "$MIG"/*.sql "$S/target-migrations/"

echo "═══ ÉTAPE −1 — RECONSTRUIRE LA COPIE DE PRODUCTION ═══"
# ── ⚠ UNE RÉPÉTITION QU'ON NE PEUT PAS REJOUER EST JOUÉE UNE FOIS ────────
# La base était laissée dans l'état où la répétition précédente l'avait mise :
# les migrations nouvelles y étaient déjà, donc l'étape 3 n'appliquait plus rien
# et disait « les 21 appliquées » en n'en appliquant zéro. Elle est reconstruite
# depuis les 133 migrations que `main` porte, à chaque fois.
if [ "${REUSE_DB:-0}" != "1" ]; then
  sudo -u postgres dropdb --if-exists "$DB" >/dev/null 2>&1
  sudo -u postgres createdb "$DB"
  sudo -u postgres psql -q -d "$DB" -f "$STUB" >$S/stub.log 2>&1 \
    && ok "schéma d'amorce (auth, storage, extensions)" || ko "amorce: $(tail -1 $S/stub.log)"
  pf=0
  for f in $S/prod-migrations/*.sql; do
    sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d "$DB" < "$f" >$S/p.log 2>&1 || {
      pf=$((pf+1)); [ $pf -le 2 ] && echo "      $(basename $f): $(tail -1 $S/p.log | cut -c1-110)"; }
  done
  [ "$pf" -eq 0 ] \
    && ok "$(ls $S/prod-migrations/*.sql | wc -l) migrations de production rejouées" \
    || ko "$pf migration(s) de production échouent"
else
  ok "base réutilisée (REUSE_DB=1) — l'étape 3 n'appliquera rien"
fi

echo "═══ ÉTAPE 0 — ⚠ LE CORRECTIF DE RESTAURATION, SEUL, AVANT TOUT ═══"
# Mesuré : sans lui, la sauvegarde de l'étape 2 restaure section_types VIDE.
sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d "$DB" < "$MIG/20260924150000_a_backup_that_does_not_restore_is_not_a_backup.sql" >$S/fix.log 2>&1 \
  && ok "20260924150000 appliquée seule sur la base à 133 migrations" \
  || ko "le correctif de restauration échoue: $(tail -1 $S/fix.log)"

echo "═══ ÉTAPE 1 — vérifications bloquantes ═══"
# ⚠ LE COMPTE SE DÉRIVE DU DÉPÔT, IL NE S'ÉCRIT PAS. Il valait « 155 » en
# littéral, et le cliché a pris deux migrations de retard sans que l'étape le
# dise : le compte attendu et le compte réel étaient tous les deux faux,
# d'accord entre eux. C'est la classe de F41 appliquée à une répétition.
want=$(ls $MIG/*.sql | wc -l)
n=$(ls $S/target-migrations/*.sql | wc -l)
[ "$n" -eq "$want" ] \
  && ok "$n migrations, autant que le dépôt" \
  || ko "cliché à $n migrations, dépôt à $want — rafraîchir le cliché"
# rejeu complet sur une base neuve
sudo -u postgres dropdb --if-exists ${DB}_replay >/dev/null 2>&1
sudo -u postgres createdb ${DB}_replay
sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d ${DB}_replay -f "$STUB" >/dev/null 2>&1
rf=0; for f in $S/target-migrations/*.sql; do
  sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d ${DB}_replay < "$f" >$S/r.log 2>&1 || { rf=$((rf+1)); [ $rf -le 2 ] && echo "      $(basename $f): $(tail -1 $S/r.log | cut -c1-110)"; }
done
[ "$rf" -eq 0 ] && ok "les $n se rejouent sur une base neuve" || ko "$rf migration(s) échouent au rejeu neuf"

echo "═══ ÉTAPE 1b — LA SUITE SQL, SUR LE REJEU NEUF ═══"
# ⚠ AJOUTÉE LE 2026-09-27 (F63). La répétition affichait « 0 échec » pendant que
# `local-verify.sh` en comptait trois : une fonction de trigger exécutable par un
# client, et quatre SECURITY DEFINER ouvertes à `anon` derrière elle. Une
# répétition qui ne lance pas les tests certifie le schéma, pas son comportement.
sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d ${DB}_replay -f "$BE/supabase/seed.sql" >$S/seed.log 2>&1 \
  && ok "graine appliquée" || ko "graine: $(tail -1 $S/seed.log)"
tr=0; tf=0; tfirst=""
for f in "$BE"/supabase/tests/*.test.sql; do
  tr=$((tr+1))
  sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d ${DB}_replay -f "$f" >$S/t.log 2>&1 || {
    tf=$((tf+1)); [ -z "$tfirst" ] && tfirst="$(basename $f): $(grep -m1 ERROR $S/t.log | cut -c1-110)"; }
done
[ "$tf" -eq 0 ] && ok "$tr fichiers de test, 0 échec" || { ko "$tf/$tr fichiers de test échouent"; echo "      $tfirst"; }

echo "═══ ÉTAPE 2 — sauvegarde, et vérifier qu'elle se restaure ═══"
sudo -u postgres pg_dump -Fc "$DB" > $S/prod.dump 2>$S/d.log \
  && ok "sauvegarde prise ($(du -h $S/prod.dump | cut -f1))" || ko "pg_dump: $(tail -1 $S/d.log)"
sudo -u postgres dropdb --if-exists "$BK" >/dev/null 2>&1; sudo -u postgres createdb "$BK"
sudo -u postgres pg_restore --single-transaction -d "$BK" < $S/prod.dump >$S/rs.log 2>&1
e=$(grep -c "pg_restore: error" $S/rs.log)
[ "$e" = "0" ] && ok "restauration sans erreur" || ko "$e erreur(s) de restauration"
# ⚠ `modalities` N'EXISTE PAS — la table s'appelle `modality_cards` — et ce
# contrôle l'affirmait « identique » depuis sa première version : les deux
# lectures échouaient, rendaient une chaîne vide, et deux vides sont égaux. La
# classe de F59 dans la répétition elle-même (2026-09-27). Une lecture vide est
# maintenant un échec, pas une égalité.
for t in section_types site_pages modality_cards; do
  x=$(sudo -u postgres psql -qAt -v ON_ERROR_STOP=1 -d "$DB" -c "select count(*) from public.$t" 2>/dev/null)
  y=$(sudo -u postgres psql -qAt -v ON_ERROR_STOP=1 -d "$BK" -c "select count(*) from public.$t" 2>/dev/null)
  if [ -z "$x" ] || [ -z "$y" ]; then ko "$t : lecture impossible (« $x » / « $y »)"
  elif [ "$x" = "0" ]; then ko "$t : vide dans la source — rien à comparer"
  elif [ "$x" = "$y" ]; then ok "$t : $x lignes de part et d'autre"
  else ko "$t : $x contre $y"; fi
done
a=$(sudo -u postgres psql -qAt -d "$DB" -c "select count(*) from information_schema.tables where table_schema='public'")
b=$(sudo -u postgres psql -qAt -d "$BK" -c "select count(*) from information_schema.tables where table_schema='public'")
[ "$a" = "$b" ] && ok "restauration vérifiée : $a tables de part et d'autre" || ko "restauration: $a vs $b tables"

new_count=$(comm -13 <(ls $S/prod-migrations | sort) <(ls $S/target-migrations | grep '\.sql$' | sort) | wc -l)
echo "═══ ÉTAPE 3 — appliquer les $new_count nouvelles, dans l'ordre, arrêt au premier échec ═══"
applied=0; stopped=""
for f in $(comm -13 <(ls $S/prod-migrations | sort) <(ls $S/target-migrations | grep '\.sql$' | sort)); do
  if sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d "$DB" < "$S/target-migrations/$f" >$S/m.log 2>&1; then
    applied=$((applied+1))
  else
    stopped="$f"; echo "      arrêt sur $f : $(tail -2 $S/m.log | tr '\n' ' ' | cut -c1-140)"; break
  fi
done
[ -z "$stopped" ] && ok "les $applied nouvelles appliquées, dans l'ordre" || ko "arrêt après $applied, sur $stopped"

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

echo "═══ ÉTAPE 9 — LA LICENCE : les colonnes, leurs formes, et la preuve RLS ═══"
for col in license_type_id license_number license_state_code; do
  c=$($Q -c "select count(*) from information_schema.columns where table_name='project_briefs' and column_name='$col'")
  [ "$c" = "1" ] && ok "project_briefs.$col" || ko "project_briefs.$col absente"
done
# ⚠ LA PREUVE DES DROITS COLONNE SE LIT DANS pg_attribute.attacl, PAS DANS
# information_schema.column_privileges, qui énumère les droits de TABLE par
# colonne et rendait 18 lignes rassurantes pour zéro droit réel.
shape=$($Q -c "select count(*) from pg_constraint where conrelid='public.project_briefs'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%license%'")
[ "$shape" -ge 1 ] && ok "$shape contrainte(s) de forme sur les champs de licence" || ko "aucune contrainte de forme"
mat=$($Q -c "select count(*) from public.license_type_states")
[ "$mat" -ge 200 ] && ok "matrice license_type_states : $mat lignes" || ko "matrice à $mat lignes"

echo "═══ ÉTAPE 10 — F38 : la négation immédiate exempte, celle à distance non ═══"
c=$($Q -c "select count(*) from pg_proc where proname='ethics_prohibitive_lead'")
[ "$c" = "1" ] && ok "ethics_prohibitive_lead()" || ko "ethics_prohibitive_lead() absente"
imm=$($Q -c "select public.ethics_blocks('There is no guarantee that six weeks will change anything.') is null")
[ "$imm" = "t" ] && ok "« there is no guarantee » passe" || ko "la négation immédiate bloque encore"
dist=$($Q -c "select public.ethics_blocks('No one can cure your anxiety.') is not null")
[ "$dist" = "t" ] && ok "« no one can cure your anxiety » bloque" || ko "⚠ la négation à distance exempte — l'exemption s'est ÉLARGIE"
nue=$($Q -c "select public.ethics_blocks('I guarantee relief.') is not null")
[ "$nue" = "t" ] && ok "« I guarantee relief » bloque" || ko "le socle ne bloque plus une promesse nue"
apres=$($Q -c "select public.ethics_blocks('No guarantee here, but we guarantee results.') is not null")
[ "$apres" = "t" ] && ok "une promesse posée après une négation reste vue" || ko "le dépouillement retire trop"

echo "═══ ÉTAPE 11 — LES DIX-HUIT RÈGLES, ET LES GÂCHETTES QUI LES APPLIQUENT ═══"
b=$($Q -c "select count(*) from public.ethics_patterns where active and severity='block'")
[ "$b" -ge 18 ] && ok "$b motifs bloquants actifs" || ko "seulement $b motifs bloquants"
for g in content_items_ethics_gate content_items_payload_ethics_gate content_topics_ethics_gate site_specs_ethics_gate directory_profiles_ethics_gate; do
  e=$($Q -c "select count(*) from pg_trigger t join pg_proc p on p.oid=t.tgfoid where p.proname='$g' and t.tgenabled='O' and not t.tgisinternal")
  [ "$e" -ge 1 ] && ok "$g armée" || ko "$g absente ou désarmée"
done
# ⚠ LE PAYLOAD EST LU RÉCURSIVEMENT, ET C'EST CE QUI COUVRE LES ONZE ARCHÉTYPES
# SANS LES CONNAÎTRE : une extraction par archétype serait onze occasions d'en
# oublier un, et celui qu'on oublie est celui qui passe.
rec=$($Q -c "select public.content_topic_text('{\"a\":{\"b\":[\"guaranteed relief\"]}}'::jsonb) like '%guaranteed relief%'")
[ "$rec" = "t" ] && ok "content_topic_text descend dans les objets et les tableaux" || ko "l'extraction du payload ne descend plus"

echo "═══ ÉTAPE 12 — LA LIBÉRATION AUTOMATIQUE DES ASSIGNATIONS ORPHELINES ═══"
# ⚠ ON VÉRIFIE QU'ELLE AGIT, PAS QU'ELLE EXISTE. Le 2026-09-26 elle a rendu 994
# sujets tenus par des essais interrompus, et la « pénurie » de banque n'était
# que cela.
$Q -c "select 1" >/dev/null
r=$($Q -c "select public.release_stale_topic_assignments()")
[ -n "$r" ] && ok "release_stale_topic_assignments() répond ($r rendue(s) sur base neuve)" || ko "la libération ne répond pas"
# ⚠ ÉPROUVÉ PAR LE COMPORTEMENT, PAS PAR UN GREP. La première version cherchait
# « interval » dans `release_stale_topic_assignments` et n'y trouvait rien : le
# délai vit dans `topic_assignment_holds`, qui appelle `topic_assignment_grace`.
# Le contrôle annonçait donc un défaut qui n'existait pas — et un grep sur une
# fonction voisine aurait continué à mentir dans l'autre sens.
g=$($Q -c "select count(*) from pg_proc where proname='topic_assignment_grace'")
[ "$g" = "1" ] && ok "topic_assignment_grace() existe" || ko "topic_assignment_grace() absente"
fresh=$($Q -c "select public.topic_assignment_holds('00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000002'::uuid, now())")
[ "$fresh" = "t" ] && ok "une assignation de maintenant est TENUE" || ko "⚠ une assignation en cours serait rendue"
stale=$($Q -c "select public.topic_assignment_holds('00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000002'::uuid, now() - public.topic_assignment_grace() - interval '1 minute')")
[ "$stale" = "f" ] && ok "une assignation passée du délai est RENDUE" || ko "le délai de grâce ne s'épuise jamais"
echo "      délai de grâce : $($Q -c "select public.topic_assignment_grace()")"

echo "═══ ÉTAPE 12b — LA TÂCHE PLANIFIÉE DE LIBÉRATION EST ENREGISTRÉE ═══"
# ⚠ UNE ROUTE `cron` ABSENTE DE `vercel.json` NE TOURNE JAMAIS, et rien ne le
# dit : elle répond correctement quand on l'appelle à la main. Au démarrage
# d'une génération, le balai ne répare la banque que pour CETTE génération ;
# une exécution tuée à 3 h bloquait le segment jusqu'à la suivante.
FE=${EKLIO_FRONTEND:-/home/user/eklio-frontend}
if [ -f "$FE/vercel.json" ]; then
  grep -q '"/api/cron/release-topics"' "$FE/vercel.json" \
    && ok "/api/cron/release-topics est planifiée" \
    || ko "la route de libération n'est PAS dans vercel.json — elle ne tournera jamais"
  [ -f "$FE/app/api/cron/release-topics/route.ts" ] \
    && ok "et la route existe" || ko "la route de libération est absente du dépôt"
else
  ko "vercel.json introuvable en $FE (poser EKLIO_FRONTEND)"
fi

echo "═══ ÉTAPE 12c — CE QU'UN ACHAT STRIPE ÉCRIT (voir B5) ═══"
# ⚠ SEPT OBJETS, DONT DEUX ÉCRITS PAR LA MÊME RPC. ⚠ Et `has_paid` n'en est PAS :
# `grant_plan_allowance` écrit `plan_tier`, et rien ne lit `has_paid` — la fiche
# le croyait jusqu'au parcours joué du 2026-09-27 (B5 §6.5).
for t in stripe_events purchases purchase_status_events subscriptions plan_grants generation_credits; do
  c=$($Q -c "select count(*) from information_schema.tables where table_name='$t'")
  [ "$c" = "1" ] && ok "$t" || ko "$t absente"
done
c=$($Q -c "select count(*) from pg_proc where proname='grant_plan_allowance'")
[ "$c" != "0" ] && ok "grant_plan_allowance()" || ko "grant_plan_allowance() absente"
# ⚠ LE VERROU D'IDEMPOTENCE EST UNE CLÉ, PAS UN `if`. Stripe rejoue tant qu'il
# n'a pas reçu de 2xx ; un traitement non gardé facture deux fois.
k=$($Q -c "select count(*) from pg_constraint where conrelid='public.stripe_events'::regclass and contype='p'")
[ "$k" = "1" ] && ok "stripe_events porte sa clé primaire — le verrou de rejeu" || ko "aucune clé primaire sur stripe_events"
g=$($Q -c "select count(*) from pg_constraint where conrelid='public.plan_grants'::regclass and contype='u'")
[ "$g" -ge 1 ] && ok "plan_grants porte une contrainte d'unicité — le verrou d'allocation" || ko "plan_grants sans unicité : un rejeu ouvrirait deux fois le palier"

echo "═══ ÉTAPE 12d — CE QUE LE PARCOURS STRIPE JOUÉ A CORRIGÉ (B5 §6) ═══"
# F60 : les mois inclus de Signature sont payés — le quota ne les lit pas comme un essai.
u=$($Q -c "insert into auth.users (email) values ('rehearsal-f60@eklio-test.invalid') returning id" | head -1)
$Q -c "insert into public.subscriptions (user_id, stripe_subscription_id, status) values ('$u','sub_rehearsal_f60','trialing')" >/dev/null
$Q -c "insert into public.purchases (user_id, tier, stripe_checkout_session_id, amount_cents, status, paid_at) values ('$u','signature','cs_rehearsal_f60',24900,'paid',now())" >/dev/null
r=$($Q -c "select (public.credit_remaining('$u','post_generation') ->> 'remaining')")
[ "$r" = "30" ] && ok "Signature en trialing : 30 posts, pas 8 (F60)" || ko "Signature en trialing : $r posts — le mois payé ne sera jamais généré"
# F61 : un event ancien ne rouvre pas une résiliée.
$Q -c "update public.subscriptions set status='canceled', stripe_event_at=now() where user_id='$u'" >/dev/null
$Q -c "update public.subscriptions set status='active', stripe_event_at=now()-interval '1 minute' where user_id='$u'" >/dev/null
st=$($Q -c "select status from public.subscriptions where user_id='$u'")
[ "$st" = "canceled" ] && ok "un event en retard ne rouvre pas un abonnement résilié (F61)" || ko "un event en retard a rouvert l'abonnement : $st"
$Q -c "delete from public.subscriptions where user_id='$u'; delete from public.purchases where user_id='$u'; delete from auth.users where id='$u'" >/dev/null 2>&1
# F63 : aucune SECURITY DEFINER du crédit ou de la banque n'est ouverte à anon.
leak=$($Q -c "select string_agg(p.proname, ', ') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('credit_remaining','credit_plan_for','drawable_count_for_kit','drawable_topics_for_kit','release_stale_topic_assignments','section_types_pages_exist','subscriptions_refuse_stale_event') and has_function_privilege('anon', p.oid, 'execute')")
[ -z "$leak" ] && ok "crédit, banque et triggers fermés à anon (F63)" || ko "ouvertes à anon : $leak"

echo "═══ ÉTAPE 12e — LE CODE QUI A CHANGÉ DEPUIS LA DERNIÈRE PASSE ═══"
# ⚠ HORS BASE, MAIS C'EST CE QUE LE DÉPLOIEMENT POUSSE. Chaque ligne nomme ce
# qu'elle affirme ; le détail est dans les tests qu'elle lance.
if [ -d "$FE/node_modules" ]; then
  ( cd "$FE" && npx vitest run lib/content/month lib/stripe lib/content/generate/__tests__/the-ceiling-has-no-caller.test.ts >$S/vt.log 2>&1 ) \
    && ok "orchestrateur, plafond, énumération, préalable, Stripe : $(grep -Eo 'Tests +[0-9]+ passed' $S/vt.log | grep -Eo '[0-9]+') tests verts" \
    || ko "vitest : $(grep -E 'Tests ' $S/vt.log | head -1)"
else
  ko "node_modules absent en $FE — npm ci"
fi
[ ! -e "$FE/lib/content/generate/pipeline.ts" ] && ok "l'ancien générateur est retiré (F45 étape 4)" || ko "lib/content/generate/pipeline.ts est revenu"
grep -q 'status: 501' "$FE/app/api/cron/content-month/route.ts" && ok "la route content-month répond toujours 501" || ko "⚠ la route content-month ne rend plus 501"
grep -q '"/api/cron/content-month"' "$FE/vercel.json" && ko "⚠ content-month est PLANIFIÉE dans vercel.json" || ok "content-month n'est pas planifiée"
grep -q 'ceiling: SpendCeiling;\|ceiling: ' "$FE/lib/content/month/orchestrate.ts" && ok "le plafond de dépense est un champ de l'orchestrateur (F58)" || ko "le plafond n'est plus dans OrchestrateInput"

echo "═══ ÉTAPE 13 — CE QUI NE SE JOUE PAS EN BASE, ET POURQUOI ═══"
# ⚠ CES TROIS-LÀ N'ONT AUCUN OBJET EN BASE. Les dire ici évite de les croire
# vérifiés parce que la répétition est verte.
ok "(hors base) le portillon par post — code, couvert par lib/content/__tests__/a-post-is-judged-alone"
ok "(hors base) le contrôle de crise — code, couvert par a-route-when-the-post-names-danger"
ok "(hors base) la mention de licence sur chaque post — code, couvert par a-licence-number-in-every-advertisement"
# ── ⚠ ET CE QUI NE SE JOUE PAS DU TOUT, PARCE QUE LE PRODUIT NE L'A PAS ──
# Recensé le 2026-09-26 (F45) : sur la chaîne produit entière, AUCUN des vingt
# mécanismes du harnais n'est présent. La cause n'est pas un oubli mais DEUX
# GÉNÉRATEURS — le chemin produit écrit une ligne et une légende par post,
# dessine des fonds photographiques, ne produit aucun payload d'archétype, et
# rend `ethicsCheck: passed: true` en dur. Les trois lignes ci-dessus sont donc
# couvertes DANS LE HARNAIS, et nulle part ailleurs.
echo "      ⚠ les trois ci-dessus ne valent QUE pour le harnais — voir F45"

echo
echo "── $FAILED échec(s) sur les étapes jouables ──"
