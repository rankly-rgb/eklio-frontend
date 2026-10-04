/*
 * ── LA PLANCHE DU PREMIER MOIS OPENAI — FAITE DES RELECTURES, PAS DES RAPPORTS ──
 *
 * ⚠ LES CARTES VIENNENT DE `verify.ts`, c'est-à-dire du chemin de lecture : le mois
 * relu en base sous l'identité de la praticienne, recomposé comme la route d'image
 * le compose. Les chiffres de coût viennent du journal de dépense, appel par appel.
 * Rien ici ne reprend ce que l'orchestrateur a dit de lui-même.
 *
 *   bun scripts/production-path/openai-month/planche.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { MODEL_RATES } from "@/lib/content/generate/copy-batch";
import { OPENAI_COPY_MODEL, PRICE_SOURCE, PRICE_VERIFIED_ON } from "@/lib/content/generate/provider";

const DIR = "design/production-first-month";
const read = (f: string) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const usd = (n: number) => `${n.toFixed(4)} $`;

const jan = read("jan-run.json");
const janV = read("jan-verify.json");
const janCards = read("jan-verify-cards.json") as Array<{ title: string; archetype: string; footer: string; svgs: string[] }>;
const dec = read("dec-run-2-resumed.json");
const decV = read("dec-verify.json");
const calls = readFileSync(`${DIR}/openai-calls.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { label: string; usd: number });
const total = calls.reduce((a, c) => a + c.usd, 0);
const unmeasured = calls.filter((c) => c.label.startsWith("en vol au SIGKILL")).reduce((a, c) => a + c.usd, 0);
const bank = calls.filter((c) => c.label.startsWith("banque")).reduce((a, c) => a + c.usd, 0);
const rate = MODEL_RATES[OPENAI_COPY_MODEL];
const janO = jan.outcome;
const cachedShare = jan.usageThisRun.cacheRead / jan.usageThisRun.input;

const figures = janCards.map((c) => `
    <figure>
      ${c.svgs[0]}
      <figcaption><b>${esc(c.title)}</b><br>${esc(c.archetype)}${c.svgs.length > 1 ? ` · ${c.svgs.length} panneaux` : ""}<br><span class="foot">${esc(c.footer)}</span></figcaption>
    </figure>`).join("");

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Premier mois OpenAI</title>
<style>
  :root { --paper:#FAF6EE; --ink:#2B2A27; --warn:#8A4B2A; --rule:#2B2A2726; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --paper:#1E1D1B; --ink:#F4EEE3; --warn:#E0A27E; --rule:#F4EEE326; } }
  :root[data-theme="dark"] { --paper:#1E1D1B; --ink:#F4EEE3; --warn:#E0A27E; --rule:#F4EEE326; }
  body { background:var(--paper); color:var(--ink); margin:0; padding:24px 16px; font:15px/1.5 ui-sans-serif,system-ui,sans-serif; }
  .wrap { max-width:1200px; margin:0 auto; }
  h1 { font-size:22px; margin:0 0 8px; } h2 { font-size:17px; margin:28px 0 8px; }
  .label { border:2px solid var(--warn); color:var(--warn); padding:12px 16px; border-radius:6px; font-weight:600; margin:12px 0 20px; }
  .label ul { margin:6px 0 0; padding-left:20px; font-weight:400; }
  dl { display:grid; grid-template-columns:minmax(0,max-content) 1fr; gap:4px 16px; margin:0 0 12px; }
  dt { opacity:.75; } dd { margin:0; font-weight:600; font-variant-numeric:tabular-nums; min-width:0; overflow-wrap:anywhere; }
  .label, li, p { overflow-wrap:anywhere; }
  ul.find li { margin-bottom:6px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:16px; margin-top:12px; }
  figure { margin:0; } figure svg { width:100%; height:auto; display:block; border:1px solid var(--rule); }
  figcaption { font-size:12px; margin-top:6px; } .foot { opacity:.75; }
  code { font-size:13px; }
</style></head><body><div class="wrap">
<h1>Premier mois OpenAI — janvier 2027, 30 posts</h1>
<div class="label">chemin produit, base locale, OpenAI — avec ces étapes hors du chemin produit :
<ul>
  <li><b>banque de sujets : harnais</b> (<code>openai-month/bank.ts</code>) — il n'existe aucun fournisseur de banque côté produit ;</li>
  <li><b>compte, brief et kit : posés par le harnais</b> (<code>00-account.sql</code>, <code>setup.ts</code>) — kit SANS directions, palette lue dans la première famille du brief (<code>clay_sand</code>) ;</li>
  <li><b>transport : client SQL de Bun à la place de PostgREST</b> (<code>local-db.ts</code>), en <code>service_role</code> pour l'écriture et sous l'identité de la praticienne pour la relecture — le registre npm, Docker Hub et ghcr sont refusés dans cet environnement ;</li>
  <li><b>appelant : un lanceur</b> (<code>openai-month/month.ts</code>) — la route de cron reste en 501 ;</li>
  <li><b>relecture : SVG, sans rasterisation PNG</b> (<code>@resvg/resvg-js</code> non installable).</li>
</ul>
Tout ce qui décide — préalable, tirage, rédaction (<code>openAiWriter</code>), relecture, juge, composition, portillon, sélection, écriture, crédit, journal — est le code de <code>lib/</code>.</div>

<h2>Le modèle et son tarif</h2>
<dl>
  <dt>Modèle</dt><dd>${OPENAI_COPY_MODEL} — sortie stricte sur le schéma de chaque archétype, cache de préfixe par archétype</dd>
  <dt>Tarif</dt><dd>${rate.inputPerMTok} $ entrée · ${rate.outputPerMTok} $ sortie par MTok, lu le ${PRICE_VERIFIED_ON[OPENAI_COPY_MODEL]} sur ${PRICE_SOURCE} (lu par l'opératrice ; l'egress de l'agent reste refusé)</dd>
  <dt>Cache</dt><dd>tarif de l'entrée en cache NON transmis : facturé plein — tous les coûts ci-dessous sont des bornes hautes (${(cachedShare * 100).toFixed(0)} % de l'entrée de janvier a été lue en cache)</dd>
</dl>

<h2>Janvier — sans interruption</h2>
<dl>
  <dt>Coût réel du mois (journal)</dt><dd>${usd(janO.costUsd)} — ${jan.callsThisRun} appels, ${jan.usageThisRun.input.toLocaleString("fr")} tokens en entrée, ${jan.usageThisRun.output.toLocaleString("fr")} en sortie</dd>
  <dt>Banque amortie</dt><dd>≈ ${usd((bank / 159) * 30)} pour 30 sujets publiés (${usd(bank)} pour 159 sujets écrits)</dd>
  <dt>Rédaction</dt><dd>${jan.writerLedger.answered}/${jan.writerLedger.attempted} réponses · ${jan.writerLedger.conformantFirstCall} conformes au premier appel · ${jan.writerLedger.repaired} réparée · ${jan.writerLedger.fromBrief} carte de praticienne assemblée</dd>
  <dt>Portillon</dt><dd>${janO.gate.passedAlone}/${janO.gate.arrived} — refus : ${Object.entries(janO.gate.byCheck).map(([k, v]) => `${k} ×${v}`).join(", ")}</dd>
  <dt>Juge</dt><dd>${janO.editing.judgedAnswered}/${janO.editing.judged} lignes avec verdict, ${janO.editing.judgedIncomplete} inachevées — un lot de 40 s'est tu (puce recopiée, corrigé après ce mois)</dd>
  <dt>Livré</dt><dd>${janV.readPath.items} posts relus · licence « ${esc(janV.licence.mentionReadFromDatabase)} » sur ${janV.licence.onFooter} pieds et dans ${janV.licence.inEverySvg} SVG · ${janV.cards.vector}/${janV.cards.composed} vectorielles · contrôles relus : ${janV.checks.month.length + janV.checks.alone.length} constat</dd>
  <dt>Crédit</dt><dd>${janV.ledger.byEntry.map((e: { entry_type: string; n: number }) => `${e.n} ${e.entry_type}`).join(" + ")} · quota ${janV.ledger.remaining.consumed}/${janV.ledger.remaining.limit} · réservation de plus : <b>${janV.quotaProbe.outcome.reason}</b>, livre ${janV.quotaProbe.ledgerRowsBefore} → ${janV.quotaProbe.ledgerRowsAfter} lignes</dd>
</dl>

<h2>Décembre — tué à 25 réponses, repris</h2>
<dl>
  <dt>Reprise</dt><dd>${dec.outcome.resumed.reused} réponses relues du journal, ${dec.outcome.writing.asked} sujets rédigés à la reprise, aucun sujet rédigé deux fois au journal (${decV.resume.topicsWrittenOnce} une fois) · ${decV.resume.reservations} réservations pour ${decV.readPath.items} posts</dd>
  <dt>Coût</dt><dd>${usd(dec.outcome.costUsd)} au journal + jusqu'à ${usd(unmeasured / 2)} d'appels en vol au SIGKILL, facturés et jamais reçus (pire cas inscrit, non mesuré)</dd>
  <dt>Juge</dt><dd>352 lignes en un appel, 0 refus — rejoué sur les 30 publiés : « EMDR does not erase » est inachevée, et elle est partie</dd>
</dl>

<h2>Ce que ce premier mois a révélé</h2>
<ul class="find">
  <li>Un rédacteur synchrone n'écrivait <b>rien</b> au journal (pas de lot ⇒ aucune ligne à mettre à jour), et les réponses n'y entraient qu'après la dernière. Corrigé.</li>
  <li>La reprise d'un mois tué était <b>refusée par le préalable</b> : ses propres sujets assignés vidaient la banque. Corrigé — la garde juge la banque du départ.</li>
  <li>Le juge recopiait les lignes avec leur puce : des lots entiers sans verdict, donc sans refus. Corrigé, et compté (<code>judgedAnswered</code>).</li>
  <li>Le portillon ne recevait ni la mention ni les verdicts quand l'appelant les omettait. Corrigé.</li>
  <li>Trois des six familles de palette actives échouent le contrôle de teintes sur les diagrammes (F72) ; la palette d'épreuve des tests aussi — c'est elle qui a fait tomber novembre (25/57 au portillon, refus <code>mix.*</code>).</li>
  <li>Un mois refusé rend ses sujets, mais reste reprenable : le reprendre publierait des sujets non assignés (F71). Novembre n'a pas été repris pour cette raison.</li>
  <li>Un numéro de licence saisi avec son sigle donne « LMFT LMFT 123456 » sur toutes les cartes, et aucun contrôle ne le voit (F73).</li>
</ul>
<p>Session : ${usd(total)} sur 5 $ (dont ${usd(unmeasured)} de pire cas non mesuré) — ${calls.length} lignes au journal de dépense <code>openai-calls.jsonl</code>.</p>

<h2>Les trente cartes de janvier, relues</h2>
<div class="grid">${figures}
</div>
</div></body></html>`;

writeFileSync(`${DIR}/planche-openai.html`, html);
console.log(`planche-openai.html : ${janCards.length} cartes, session ${usd(total)}`);
