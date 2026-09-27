/*
 * ══════════════════════════════════════════════════════════════════════════
 *  F12 — LA PORTE REFUSE-T-ELLE UN ÉTAT NON VÉRIFIÉ, SUR LA VRAIE BASE ?
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Deux portes lisent `license_type_states.verified_at`, et une vérification
 * d'État doit ouvrir LES DEUX et rien d'autre :
 *
 *   · la génération de KIT  — `project_state_is_sellable(project)` (RPC, 409) ;
 *   · la génération de MOIS — `stateVerified(type, État)` du préalable (F46),
 *     par `serverPreflightPort`, le port du chemin produit.
 *
 * Ce script les interroge contre la base locale rejouée, dans les deux sens :
 * rien de vérifié → refus ; UNE ligne vérifiée → ouverture de CE couple
 * seulement ; puis il remet la base exactement comme il l'a trouvée.
 *
 * Il vérifie aussi que `F12-license-type-states.csv` décrit la matrice réelle :
 * mêmes 240 couples, ni un de plus, ni un de moins.
 *
 *   npx tsx scripts/production-path/f12-gate.ts
 *
 * Aucun appel de modèle. Local seulement : la façade `edge/up.sh` doit tourner.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { admin } from "../local-render/lib";
import { serverPreflightPort, type MonthRpcClient } from "@/lib/content/month/server-ports";

const DB = process.env.DB ?? "eklio_local_verify";
const sql = new pg.Client({ host: "127.0.0.1", user: "stripe_path", password: "eklio_local", database: DB });
let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  await sql.connect();
  const db = admin();
  const port = serverPreflightPort(db as unknown as MonthRpcClient, { stateCode: null });

  console.log("═══ le fichier décrit-il la matrice ? ═══");
  const csv = readFileSync("docs/production/F12-license-type-states.csv", "utf8").trim().split("\n").slice(1);
  const filePairs = new Set(csv.map((line) => line.split(",").slice(0, 2).join("/")));
  const dbPairs = new Set<string>(
    (await sql.query("select license_type_id || '/' || state_code as k from public.license_type_states")).rows.map(
      (r: { k: string }) => r.k
    )
  );
  const missing = [...dbPairs].filter((k) => !filePairs.has(k));
  const extra = [...filePairs].filter((k) => !dbPairs.has(k));
  /* ⚠ Deux ensembles vides ont la même taille : on exige d'avoir LU la matrice. */
  check(
    `${filePairs.size} couples dans le fichier, ${dbPairs.size} en base`,
    dbPairs.size >= 200 && filePairs.size === dbPairs.size && csv.length === filePairs.size
  );
  check("aucun couple de la base absent du fichier", missing.length === 0, missing.slice(0, 5).join(", "));
  check("aucun couple du fichier absent de la base", extra.length === 0, extra.slice(0, 5).join(", "));
  const ca = csv.slice(0, 4).map((l) => l.split(",")[0] + "/" + l.split(",")[1]);
  check("la Californie en tête, quatre lignes", ca.every((k) => k.endsWith("/CA")), ca.join(" "));

  console.log("═══ la porte, dans les deux sens ═══");
  const before = (
    await sql.query("select license_type_id, verified_at, verified_by from public.license_type_states where state_code = 'CA'")
  ).rows as Array<{ license_type_id: string; verified_at: Date | null; verified_by: string | null }>;

  /* Un projet californien, LMFT, par les tables du produit. */
  const user = (await sql.query("insert into auth.users (email) values ($1) returning id", [`f12-gate-${Date.now()}@eklio-test.invalid`])).rows[0].id;
  const project = (await sql.query("insert into public.projects (user_id, name) values ($1, 'f12 gate') returning id", [user])).rows[0].id;
  const brief = await sql.query(
    "insert into public.project_briefs (project_id, license_type_id, state) values ($1, 'lmft', 'CA') returning project_id",
    [project]
  ).catch((e: Error) => e);
  if (brief instanceof Error) {
    check("un brief CA/LMFT s'écrit", false, brief.message);
  }

  try {
    await sql.query("update public.license_type_states set verified_at = null, verified_by = null where state_code = 'CA'");
    const kitClosed = await db.rpc("project_state_is_sellable", { p_project_id: project });
    check("rien de vérifié : le KIT est refusé", kitClosed.error === null && kitClosed.data === false, JSON.stringify(kitClosed.data ?? kitClosed.error?.message));
    check("rien de vérifié : le MOIS est refusé (F46)", (await port.stateVerified("lmft", "CA")) === false);

    await sql.query(
      "update public.license_type_states set verified_at = now(), verified_by = 'f12-gate.ts — PROBE, restored' where state_code = 'CA' and license_type_id = 'lmft'"
    );
    const kitOpen = await db.rpc("project_state_is_sellable", { p_project_id: project });
    check("lmft/CA SEUL vérifié : le KIT reste fermé — il faut les quatre lignes de l'État", kitOpen.data === false, JSON.stringify(kitOpen.data ?? kitOpen.error?.message));
    check("lmft/CA vérifié : le MOIS s'ouvre pour lmft", (await port.stateVerified("lmft", "CA")) === true);
    check("…et PAS pour lcsw/CA, qui n'est pas vérifié", (await port.stateVerified("lcsw", "CA")) === false);
    check("…ni pour lmft/NV", (await port.stateVerified("lmft", "NV")) === false);
    check("…et une casse différente ne contourne rien", (await port.stateVerified("lmft", "ca")) === true);
    await sql.query(
      "update public.license_type_states set verified_at = now(), verified_by = 'f12-gate.ts — PROBE, restored' where state_code = 'CA'"
    );
    const kitAll = await db.rpc("project_state_is_sellable", { p_project_id: project });
    check("les quatre lignes CA vérifiées : le KIT s'ouvre", kitAll.data === true, JSON.stringify(kitAll.data ?? kitAll.error?.message));

    /*
     * ⚠ UN BRIEF SANS ÉTAT PASSE LA PORTE DU KIT — c'est la décision écrite de
     * 20260915101137 (« aucune juridiction revendiquée »), pas un défaut. Imprimé
     * pour qu'on la voie, pas compté (F64, dernière remarque).
     */
    await sql.query("update public.license_type_states set verified_at = null, verified_by = null where state_code = 'CA'");
    await sql.query("update public.project_briefs set state = null where project_id = $1", [project]);
    const noState = await db.rpc("project_state_is_sellable", { p_project_id: project });
    console.log(`  · brief SANS État, rien de vérifié : kit ${noState.data === true ? "OUVERT (décision de 20260915101137)" : "fermé"}`);
  } finally {
    for (const row of before) {
      await sql.query(
        "update public.license_type_states set verified_at = $1, verified_by = $2 where state_code = 'CA' and license_type_id = $3",
        [row.verified_at, row.verified_by, row.license_type_id]
      );
    }
    await sql.query("delete from public.project_briefs where project_id = $1", [project]);
    await sql.query("delete from public.projects where id = $1", [project]);
    await sql.query("delete from auth.users where id = $1", [user]);
    const after = (
      await sql.query("select count(*)::int as n from public.license_type_states where verified_by like 'f12-gate.ts%'")
    ).rows[0].n;
    check("la base est rendue telle quelle", after === 0);
  }

  await sql.end();
  console.log(failures === 0 ? "\n✓ AUCUN ÉCHEC" : `\n✗ ${failures} ÉCHEC(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
