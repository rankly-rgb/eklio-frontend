/*
 * ── CONTRE-VÉRIFICATION DE LA BANQUE (F48) — lecture seule, aucun appel ──
 * Relit `content_topics` et rejoue sur chaque ligne ce que la base, `parse()`,
 * le budget de mots et `checkEthics` en disent : le « 128/128 » du remplissage
 * n'est cru qu'après cette lecture. C'est elle qui a trouvé les 16 titres en double.
 *   bun scripts/production-path/openai-month/checks/bank-check.ts
 */
import { localDb } from "../../local-db";
import { budgetErrors } from "@/lib/compose/budget";
import { ARCHETYPES } from "@/lib/compose/archetypes/index";
import { checkEthics } from "@/lib/ethics/rules";
const db = localDb();
const rows = await db.read<{ id: string; archetype_key: string; title: string; hook: string; payload: unknown; caption_seed: string; reviewed: boolean; valid: boolean; bank_valid: boolean }>(
  `select id, archetype_key, title, hook, payload, caption_seed, ethics_reviewed_at is not null as reviewed,
          public.content_topic_payload_valid(archetype_key, payload) as valid,
          public.content_topic_bank_payload_valid(archetype_key, payload) as bank_valid
     from public.content_topics`);
const out = { rows: rows.length, reviewed: 0, sqlValid: 0, sqlBankValid: 0, parseOk: 0, overBudget: 0, ethicsHits: 0, dupTitles: 0, payloadCarouselPanels: [] as number[] };
const titles = new Map<string, number>();
for (const r of rows) {
  if (r.reviewed) out.reviewed++;
  if (r.valid) out.sqlValid++;
  if (r.bank_valid) out.sqlBankValid++;
  if (ARCHETYPES[r.archetype_key].parse(r.payload) !== null) out.parseOk++;
  if (r.archetype_key !== "practitioner_card" && budgetErrors(r.archetype_key, r.payload).length > 0) out.overBudget++;
  if (checkEthics([r.title, r.hook, r.caption_seed, JSON.stringify(r.payload)].join("\n")).violations.length > 0) out.ethicsHits++;
  titles.set(r.title.toLowerCase(), (titles.get(r.title.toLowerCase()) ?? 0) + 1);
  if (r.archetype_key === "carousel") out.payloadCarouselPanels.push((r.payload as { cards: unknown[] }).cards.length);
}
out.dupTitles = [...titles.values()].filter((n) => n > 1).length;
console.log(JSON.stringify(out));
console.log(JSON.stringify(rows.slice(0, 3).map((r) => ({ a: r.archetype_key, t: r.title, h: r.hook, p: r.payload })), null, 1));
await db.close();
