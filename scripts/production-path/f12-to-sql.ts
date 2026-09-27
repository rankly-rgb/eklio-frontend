/*
 * F12 — du fichier rempli au SQL à coller, sans rien réécrire à la main.
 *
 *   npx tsx scripts/production-path/f12-to-sql.ts CA > /tmp/f12-CA.sql
 *
 * Lit `docs/production/F12-license-type-states.csv` et imprime, pour l'État
 * demandé, UNE transaction qui pose `verified_at` sur les lignes `oui`.
 *
 * ⚠ IL REFUSE PLUTÔT QUE DE DEVINER, et chaque refus nomme la ligne :
 *   · une ligne de l'État sans réponse `oui`/`non` ;
 *   · une ligne `oui` sans `source_url` ou sans `verified_by` ;
 *   · un `verified_by` qui ressemble à un script ou à un agent.
 *
 * ⚠ ET IL DIT CE QU'UN `non` COÛTE. La porte du KIT
 * (`state_is_sellable`) exige que TOUTES les lignes d'un État soient vérifiées :
 * une seule ligne `non` laissée à NULL garde l'État fermé pour tous les titres.
 * Le script l'imprime en tête et n'émet rien : c'est une décision produit, pas
 * un versement.
 *
 * Il n'ouvre aucune connexion. Il imprime ; une personne colle.
 */
import { readFileSync } from "node:fs";

const state = (process.argv[2] ?? "").toUpperCase();
if (!/^[A-Z]{2}$/.test(state)) {
  console.error("usage : f12-to-sql.ts <ÉTAT>   (ex. CA)");
  process.exit(2);
}

const file = process.env.F12_CSV ?? "docs/production/F12-license-type-states.csv";
const [header, ...lines] = readFileSync(file, "utf8").replace(/\r/g, "").trim().split("\n");
const cols = header.split(",");
const rows = lines
  .map((line) => {
    const values = line.split(",");
    return Object.fromEntries(cols.map((c, i) => [c, (values[i] ?? "").trim()]));
  })
  .filter((r) => r.state_code === state);

const errors: string[] = [];
if (rows.length === 0) errors.push(`aucune ligne pour ${state} dans le fichier`);
for (const r of rows) {
  const who = `${r.license_type_id}/${state}`;
  const answer = r.sellable_oui_non.toLowerCase();
  if (answer !== "oui" && answer !== "non") errors.push(`${who} : sellable_oui_non vide ou illisible (« ${r.sellable_oui_non} »)`);
  if (answer === "oui" && !/^https:\/\//.test(r.source_url)) errors.push(`${who} : oui sans source_url https://`);
  if (answer === "oui" && r.verified_by.length < 3) errors.push(`${who} : oui sans verified_by`);
  if (/harness|script|claude|agent|probe|\.ts|\.sql/i.test(r.verified_by)) {
    errors.push(`${who} : verified_by « ${r.verified_by} » n'est pas le nom d'une personne`);
  }
  if (r.note.includes("'")) errors.push(`${who} : la note contient une apostrophe droite — la remplacer par ’`);
}
if (errors.length > 0) {
  console.error(`✗ rien n'est émis pour ${state} :\n  ` + errors.join("\n  "));
  process.exit(1);
}

const no = rows.filter((r) => r.sellable_oui_non.toLowerCase() === "non");
if (no.length > 0) {
  console.error(
    `✗ ${state} a ${no.length} ligne(s) « non » (${no.map((r) => r.license_type_id).join(", ")}).\n` +
      `  state_is_sellable exige TOUTES les lignes vérifiées : laissées à NULL, elles gardent ${state}\n` +
      `  fermé pour la génération de kit, quel que soit le titre. C'est une décision produit\n` +
      `  (retirer le couple de la matrice ? ouvrir par couple ?), pas un versement. Rien n'est émis.`
  );
  process.exit(1);
}

const out: string[] = [
  `-- F12 — ${state}, ${rows.length} ligne(s), émis le ${new Date().toISOString().slice(0, 10)} depuis le fichier.`,
  `-- ⚠ À relire avant de coller : c'est la seule preuve qu'une personne a lu les règles.`,
  "begin;",
];
for (const r of rows) {
  out.push(
    `update public.license_type_states set verified_at = now(), verified_by = '${r.verified_by}', ` +
      `source_url = '${r.source_url}', note = ${r.note ? `'${r.note}'` : "null"} ` +
      `where license_type_id = '${r.license_type_id}' and state_code = '${state}';`
  );
}
out.push(
  `-- la preuve, dans la même transaction : l'État doit être vendable, et CE nombre de lignes vérifiées.`,
  `select public.state_is_sellable('${state}') as vendable,`,
  `       (select count(*) from public.license_type_states where state_code = '${state}' and verified_at is not null) as verifiees;`,
  `-- attendu : t | ${rows.length}. Sinon : rollback;`,
  "commit;"
);
console.log(out.join("\n"));
