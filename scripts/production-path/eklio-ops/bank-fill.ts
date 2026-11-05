/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE REMPLISSAGE DE LA BANQUE D'UNE PRATICIENNE (2026-11-05)
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   bun scripts/production-path/eklio-ops/bank-fill.ts --kit <id>            simulation
 *   bun scripts/production-path/eklio-ops/bank-fill.ts --kit <id> --write    écriture
 *
 * Ce qu'il écrit : des lignes `content_topics` (phrases seules et carrousels)
 * dans les segments que le kit tire — rien d'autre, rien de retiré. La
 * génération est `fillBank` (`scripts/local-render/12-topic-bank-openai.ts`) :
 * même consigne, mêmes gardes (budget de mots, déontologie, triggers en base),
 * et le contrôle de variété à la source.
 *
 * ⚠ IDEMPOTENT. Chaque segment est complété jusqu'à une CIBLE ; relancé, il
 * n'a plus rien à écrire et ne paie rien.
 *
 * ⚠ LES PLANCHERS SONT LUS AVANT D'ÉCRIRE. S'ils mordent encore une fois le
 * remplissage projeté, le script s'arrête sur cette fiche et dit lequel.
 */
import inventoryJson from "../../../lib/visual-library/inventory.generated.json";
import type { Inventory } from "../../../lib/visual-library/inventory";
import { candidates } from "../../../lib/visual-library/match";
import { bankTarget } from "../../../lib/content/bank";
import { fillBank } from "../../local-render/12-topic-bank-openai";
import { bankFloors, flag, option, production, refuse, requireEnv, requireKit, requireMigrations, table, type Db } from "./common";

const ENTRIES = (inventoryJson as Inventory).entries;
const write = flag("--write");
const capUsd = Number(option("--cap") ?? 1.5);

const db = production();
await requireMigrations(db);
const kit = await requireKit(db, option("--kit"));
const key = write ? requireEnv(["OPENAI_API_KEY"]).OPENAI_API_KEY : null;

/** Les segments que ce kit tire : ceux de ses sujets tirables. */
async function kitSegments(d: Db, kitId: string): Promise<string[]> {
  const { data, error } = await d.rpc("drawable_topics_for_kit", { p_brand_kit_id: kitId });
  if (error) refuse(`drawable_topics_for_kit : ${error.message}`);
  const ids = (data ?? []).map((r) => r.topic_id);
  if (!ids.length) return [];
  const { data: rows } = await d.from("content_topics").select("segment_id").in("id", ids);
  return [...new Set((rows ?? []).map((r) => r.segment_id))];
}

/** La couverture thématique de la fiche : la part de ses sujets tirables qu'un dessin dit par le sens. */
async function coverage(d: Db, kitId: string) {
  const { data } = await d.rpc("drawable_topics_for_kit", { p_brand_kit_id: kitId });
  const ids = (data ?? []).map((r) => r.topic_id);
  if (!ids.length) return { matched: 0, of: 0 };
  const { data: rows } = await d.from("content_topics").select("title, hook").in("id", ids);
  const matched = (rows ?? []).filter((t) => candidates({ cardLine: t.title, hook: t.hook }, ENTRIES).length > 0).length;
  return { matched, of: rows?.length ?? 0 };
}

const segments = await kitSegments(db, kit.id);
if (!segments.length) refuse(`aucun segment ne sert le kit ${kit.id} : la banque n'a rien pour lui`);

/*
 * Les cibles : ce que le dimensionnement de la banque (`bankTarget`, une
 * praticienne, trois tours bloqués) demande en phrases seules et en
 * carrousels, réparti sur les segments du kit.
 */
const demand = bankTarget({ practitioners: 1, attempts: 1, rounds: 3 });
const targets = {
  single_statement: Math.ceil(demand.single_statement / segments.length),
  carousel: Math.ceil(demand.carousel / segments.length),
};

const before = await bankFloors(db, kit.id);
const coverBefore = await coverage(db, kit.id);
const planned = await fillBank({ db: db as never, key, segments, targets, write: false, capUsd });
const toWrite = planned.plan.reduce((a, p) => a + p.toWrite, 0);

/* Les planchers projetés : le banc d'aujourd'hui, plus ce que le remplissage ajouterait. */
const add = (a: string) => planned.plan.filter((p) => p.archetype === a).reduce((s, p) => s + p.toWrite, 0);
const projected = {
  total: before.total + toWrite,
  margin: Math.min(10, (before.by.single_statement ?? 0) + add("single_statement")) + Math.min(9, (before.by.carousel ?? 0) + add("carousel")) - before.needed,
};

console.log(`\nREMPLISSAGE DE LA BANQUE — kit ${kit.id} — ${write ? "ÉCRITURE" : "SIMULATION (rien ne sera écrit)"}`);
console.log(`  segments tirés par ce kit : ${segments.length} · cibles par segment : ${JSON.stringify(targets)}\n`);
console.log("  Ce qui serait écrit, table content_topics :");
table(planned.plan.map((p) => ({ segment: p.segment, archetype: p.archetype, "en banque": p.held, cible: p.target, "à écrire": p.toWrite })));
console.log(`\n  Total à écrire : ${toWrite} sujet(s).`);
console.log(`  Planchers avant  : ${before.total} tirables, marge de posts à phrase ${before.margin >= 0 ? "+" : ""}${before.margin}${before.failing.length ? ` — MORD : ${before.failing.join(" ; ")}` : ""}`);
console.log(`  Planchers projetés : ${projected.total} tirables, marge ${projected.margin >= 0 ? "+" : ""}${projected.margin}`);
console.log(`  Couverture thématique avant : ${coverBefore.matched}/${coverBefore.of} sujets tirables trouvent un dessin.`);

if (projected.total < 55 || projected.margin < 2) {
  refuse(`un plancher mord même après le remplissage projeté (tirables ${projected.total}, marge ${projected.margin}) : la fiche ne peut pas porter un mois. Rien n'est écrit.`);
}
if (!write) {
  console.log(`\n  SIMULATION : rien n'a été écrit, rien n'a été dépensé. Relancer avec --write pour écrire.\n`);
  process.exit(0);
}
if (toWrite === 0) {
  console.log(`\n  Rien à écrire : les cibles sont atteintes (relance idempotente). 0 $.\n`);
  process.exit(0);
}

const out = await fillBank({ db: db as never, key, segments, targets, write: true, capUsd });
const after = await bankFloors(db, kit.id);
const coverAfter = await coverage(db, kit.id);
console.log(`\n  ÉCRIT : ${out.written} sujet(s) (${out.drawable} tirables), échecs ${JSON.stringify(out.failures)}`);
console.log(`  COÛT MESURÉ : ${out.costUsd} $ (${out.calls} appels, modèle ${"model" in out ? out.model : "—"})`);
console.log(`  Planchers après : ${after.total} tirables, marge ${after.margin >= 0 ? "+" : ""}${after.margin}${after.failing.length ? ` — MORD : ${after.failing.join(" ; ")}` : ""}`);
console.log(`  Couverture thématique après : ${coverAfter.matched}/${coverAfter.of}.`);
console.log(`  Si le script s'est arrêté en route : les sujets écrits restent, rien n'est à défaire ; relancer complète jusqu'aux cibles.\n`);
