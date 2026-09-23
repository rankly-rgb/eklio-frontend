import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/*
 * ── ⚠ UN BRIEF APPARTIENT À UNE PRATICIENNE, ET À UNE SEULE ────────────
 *
 * Trouvé le 2026-09-23, et c'est la VRAIE cause de F16.
 *
 * `20-month.ts` lisait le brief ainsi :
 *
 *     .from("project_briefs").select("practice_name, city, state, …")
 *     .limit(1).single()
 *
 * — sans `.eq("project_id", …)`. Avec quinze praticiennes en base, cette
 * lecture rendait toujours la PREMIÈRE ligne. Chaque mois écrit depuis le
 * 2026-09-21 l'a donc été à partir du brief de « Rowan Mercier Therapy » :
 * son nom de cabinet, sa ville, son État, ses modalités.
 *
 * « Rowan Mercier Therapy » sur le mois d'Isla Thornbury n'était pas une
 * identité INVENTÉE. C'était l'identité D'UNE AUTRE PRATICIENNE, servie par
 * une clause `where` manquante. Le modèle n'a fabriqué que l'adresse e-mail,
 * dérivée du nom qu'on venait de lui tendre.
 *
 * ⚠ ET LE CONTRÔLE ÉTAIT AVEUGLE PAR CONSTRUCTION : `checkInventedIdentity`
 * reçoit son `practiceName` et sa liste d'autorisation de cette même lecture.
 * Il autorisait donc le nom d'une autre sur les quinze comptes, et aurait
 * signalé le vrai nom de chacune. Un filet nourri par la source qu'il
 * surveille ne surveille rien.
 *
 * La règle que ce test pose : une lecture qui demande LE brief — celle qui
 * finit en `.single()` ou `.maybeSingle()` — doit nommer son projet. Une
 * lecture qui balaie TOUS les briefs (un `cron` de relance) n'a pas à le
 * faire, et ce test ne la touche pas.
 */
const FILES = execSync(
  `grep -rl '\\.from("project_briefs")' --include=*.ts app lib scripts || true`,
  { encoding: "utf8" }
).split("\n").filter(Boolean);

/** Le maillon complet, de `.from(` jusqu'au `;` qui le termine. */
function chains(source: string): string[] {
  const out: string[] = [];
  let at = source.indexOf('.from("project_briefs")');
  while (at !== -1) {
    const end = source.indexOf(";", at);
    out.push(source.slice(at, end === -1 ? source.length : end));
    at = source.indexOf('.from("project_briefs")', at + 1);
  }
  return out;
}

describe("un brief appartient à une praticienne", () => {
  it("le dépôt lit bien des briefs quelque part", () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it.each(FILES)("%s ne lit jamais LE brief sans nommer son projet", (file) => {
    for (const chain of chains(readFileSync(file, "utf8"))) {
      const readsOne =
        chain.includes(".select(") &&
        (chain.includes(".single()") || chain.includes(".maybeSingle()"));
      if (!readsOne) continue;
      expect(chain, `${file} : lecture d'un brief sans project_id`).toContain("project_id");
    }
  });

  /*
   * ⚠ ET LA LECTURE DU MOIS EN PARTICULIER, qui est celle qui a fuité. Elle
   * est nommée à part pour que ce test échoue avec le bon nom si quelqu'un
   * relâche la règle générale.
   */
  it("le mois lit le brief du compte dont il écrit le mois", () => {
    const source = readFileSync("scripts/local-render/20-month.ts", "utf8");
    const chain = chains(source).find((c) => c.includes("practice_name"));
    expect(chain).toBeDefined();
    expect(chain).toContain('.eq("project_id", projectId)');
    expect(chain).not.toContain(".limit(1)");
  });
});
