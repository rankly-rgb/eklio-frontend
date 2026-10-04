/*
 * ── LES SIX FAMILLES DE PALETTE AU CONTRÔLE DE TEINTES — aucun appel ─────
 * Compose cinq diagrammes par famille, clair et sombre, et passe `checkTints`.
 * Trouvé le 2026-10-04 : trois des six familles actives échouent (FOLLOWUP F72).
 *   bun scripts/production-path/openai-month/checks/palette-tints.ts
 */
import { localDb } from "../../local-db";
import { cardPalette } from "@/lib/compose/palette";
import { checkTints } from "@/lib/content/month-checks";
import { composeCard } from "@/lib/content/month/compose-card";
const db = localDb();
const fams = await db.read<{ id: string; primary_hex: string; secondary_hex: string; light_hex: string; dark_hex: string; paper_hex: string; active: boolean }>("select id, primary_hex, secondary_hex, light_hex, dark_hex, paper_hex, active from public.palette_families order by sort_order");
const item = (l: string, g: string) => ({ label: l, gloss: g });
const payloads: Record<string, unknown> = {
  quadrant_model: { axis_x: "effort", axis_y: "rest", items: [item("Sunday dread","starts before the alarm"), item("Rest fails","the body stays braced"), item("Still bracing","nothing asked it to"), item("Sleep breaks","waking at four")] },
  cycle: { nodes: [item("Push harder","the list gets done"), item("Run empty","nothing left by Friday"), item("Brace again","Monday asks the same")] },
  concentric_control: { rings: [item("The workload","not yours to set"), item("The pace","partly yours to set"), item("The stopping","entirely yours")] },
  comparison_pair: { left: [item("Looks fine","shows up on time"), item("Sounds steady","answers every message")], right: [item("Feels braced","shoulders never drop"), item("Sleeps light","awake before the alarm")] },
  surface_and_beneath: { surface: item("Handling it","every deadline met"), beneath: item("Running empty","no memory of resting") },
};
for (const f of fams) {
  const d = { primary: f.primary_hex, secondary: f.secondary_hex, light: f.light_hex, dark: f.dark_hex, paper: f.paper_hex };
  const bad: string[] = [];
  for (const dark of [false, true]) for (const [a, payload] of Object.entries(payloads)) {
    const card = composeCard({ archetype: a, payload, palette: cardPalette("k", d, dark), eyebrow: "EDUCATE", headline: "Rest is not a reward", footer: "Rowan Mercier Therapy · LMFT 123456", licenceMention: "LMFT 123456" });
    if (checkTints(card.svg, d).length > 0) bad.push(`${a}${dark ? "(sombre)" : ""}`);
  }
  console.log(`${f.id.padEnd(16)} ${f.active ? "active " : "retirée"} ${bad.length === 0 ? "ok" : "REFUSÉ : " + bad.join(", ")}`);
}
await db.close();
