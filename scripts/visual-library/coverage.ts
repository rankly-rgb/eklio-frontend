/*
 * La couverture thématique, mesurée par le code du produit
 * (`lib/visual-library/match.ts`) sur des données relues en production.
 *
 *   bun scripts/visual-library/coverage.ts
 *
 * Écrit design/visual-library-2026-11-01/couverture.json et imprime le résumé.
 * Aucun modèle, aucune écriture en base.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import inventoryJson from "@/lib/visual-library/inventory.generated.json";
import type { Inventory } from "@/lib/visual-library/inventory";
import { assignMonth, candidates, type PostSignals } from "@/lib/visual-library/match";

const root = join(import.meta.dirname, "..", "..");
const dir = join(root, "design/visual-library-2026-11-01");
const entries = (inventoryJson as Inventory).entries;
const drawable = entries.filter((e) => e.drawable).map((e) => e.id);

type Row = { cardLine?: string; hook?: string; topic_title?: string; title?: string; payload?: unknown; caption?: string };
const december = (JSON.parse(readFileSync(join(dir, "december-2026-posts.json"), "utf8")) as { posts: Row[] }).posts;
const bank = (JSON.parse(readFileSync(join(dir, "bank-2026-11-01.json"), "utf8")) as { topics: Row[] }).topics;

const signals = (r: Row): PostSignals => ({
  title: r.topic_title ?? r.title ?? null,
  hook: r.hook ?? null,
  cardLine: r.cardLine ?? null,
  payload: r.payload,
  caption: r.caption ?? null,
});

/* 1. Décembre, comme un mois : dans l'ordre, sans répétition. */
const month = assignMonth(december.map(signals), entries);
const monthRows = december.map((r, i) => ({
  cardLine: r.cardLine,
  illustration: month[i]?.id ?? null,
  score: month[i]?.score ?? null,
  reasons: month[i]?.reasons ?? [],
  /* Ce qu'il aurait pris sans la règle d'anti-répétition. */
  firstChoice: candidates(signals(r), entries)[0]?.id ?? null,
}));
const monthCovered = month.filter(Boolean).length;
const monthAnyMatch = monthRows.filter((r) => r.firstChoice).length;

/* 2. La banque entière : qui trouve un dessin, et lesquels sont demandés. */
const firsts = bank.map((r) => candidates(signals(r), entries)[0]?.id ?? null);
const bankCovered = firsts.filter(Boolean).length;
const demand = new Map<string, number>();
for (const id of firsts) if (id) demand.set(id, (demand.get(id) ?? 0) + 1);
const anyCandidate = new Set(bank.flatMap((r) => candidates(signals(r), entries).map((m) => m.id)));

const report = {
  measuredWith: "lib/visual-library/match.ts, seuil MATCH_THRESHOLD = 1, inventaire du 2026-11-01",
  december: {
    posts: december.length,
    coveredDistinct: monthCovered,
    coverageDistinct: +(monthCovered / december.length).toFixed(3),
    withAnyMatch: monthAnyMatch,
    coverageAnyMatch: +(monthAnyMatch / december.length).toFixed(3),
    rows: monthRows,
  },
  bank: {
    topics: bank.length,
    covered: bankCovered,
    coverage: +(bankCovered / bank.length).toFixed(3),
    mostChosen: [...demand.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
    neverChosenFirst: drawable.filter((id) => !demand.has(id)).sort(),
    neverMatchedAtAll: drawable.filter((id) => !anyCandidate.has(id)).sort(),
    uncoveredTitles: bank.filter((_, i) => !firsts[i]).map((r) => r.title),
  },
};
writeFileSync(join(dir, "couverture.json"), JSON.stringify(report, null, 1) + "\n");
console.log(
  JSON.stringify(
    {
      december: { coveredDistinct: `${monthCovered}/${december.length}`, withAnyMatch: `${monthAnyMatch}/${december.length}` },
      bank: { covered: `${bankCovered}/${bank.length}`, mostChosen: report.bank.mostChosen.slice(0, 6) },
      neverMatchedAtAll: report.bank.neverMatchedAtAll.length,
    },
    null,
    1
  )
);
