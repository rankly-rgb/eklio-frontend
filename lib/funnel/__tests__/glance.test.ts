import { describe, expect, it } from "vitest";
import {
  renderCeilingGlance,
  unreadableCeiling,
  type Glance,
  type Orphans,
} from "@/lib/funnel/glance";

/*
 * ── LE SEUL BLOC QUE QUELQU'UN LIRA À SEPT HEURES DU MATIN ──────────────
 *
 * Il est testé sur le JSON EXACT que `public.anon_spend_today()` a rendu en
 * production le 2026-09-11, copié tel quel. Ce n'est pas une fixture inventée
 * pour faire passer un test : c'est la sortie de la base, et si sa forme
 * change, ce fichier casse avant que le rapport n'affiche un blanc.
 */
const LIVE_2026_09_11: Glance = {
  day: "2026-09-11",
  enabled: true,
  reveals: { used: 0, cap: 150, left: 150, pct: 0.0 },
  assists: { used: 0, cap: 750, left: 750, pct: 0.0 },
  spend_usd: 0.0,
  spend_usd_max: 0.0,
  headroom_usd: 13.07,
  rates: { reveal: 0.0376, assist: 0.0099, reveal_max: 0.214, assist_max: 0.0387 },
  distinct_ips: 0,
  busiest_ip_reveals: 0,
  refused: { total: 0, ip_cap: 0, global_cap: 0, disabled: 0, unreadable: 0 },
};

const NO_ORPHANS: Orphans = { total: 0, amount_cents: 0, oldest: null, rows: [] };

const text = (g: Glance, o: Orphans | undefined = NO_ORPHANS) =>
  renderCeilingGlance(g, o).join("\n");

describe("la vue du plafond — journée calme", () => {
  const out = text(LIVE_2026_09_11);

  it("porte les deux plafonds RÉELLEMENT en base, pas des exemples", () => {
    expect(out).toContain("0 / 150");
    expect(out).toContain("0 / 750");
  });

  it("donne la marge en dollars, qui est la chose sur laquelle on agit", () => {
    expect(out).toContain("$  13.07");
  });

  it("dit que personne n'a été refusé, plutôt que de taire la ligne", () => {
    // Une ligne absente se lit comme « pas de problème » ET comme « pas
    // mesuré ». Elle est toujours écrite.
    expect(out).toContain("nobody has been turned away today");
  });

  it("⚠ dit à CHAQUE fois que les dollars sont des estimations", () => {
    expect(out).toContain("Dollars are ESTIMATES");
    expect(out).toContain("not from an invoice");
  });

  it("ne porte PAS la marque d'alerte une journée calme", () => {
    expect(out).not.toContain("⚠ TODAY");
  });
});

describe("⚠ ce qui doit sauter aux yeux", () => {
  it("un refus GLOBAL nomme ce qu'il est et ce qu'il faut faire", () => {
    const out = text({
      ...LIVE_2026_09_11,
      reveals: { used: 150, cap: 150, left: 0, pct: 100.0 },
      spend_usd: 5.64,
      headroom_usd: 7.43,
      refused: { total: 4, ip_cap: 1, global_cap: 3, disabled: 0, unreadable: 0 },
    });
    expect(out).toContain("⚠ TODAY");
    expect(out).toContain("3 GLOBAL CAP");
    // La phrase qui dit ce que ça VEUT dire, pas seulement le nombre.
    expect(out).toContain("finished the brief and got");
    expect(out).toContain("anon_generation_daily_global");
  });

  it("un refus par IP ne déclenche PAS la phrase du refus global", () => {
    // Ce ne sont pas le même événement : l'un coûte une visiteuse, l'autre
    // coûte une thérapeute qui avait tout rempli.
    const out = text({
      ...LIVE_2026_09_11,
      refused: { total: 2, ip_cap: 2, global_cap: 0, disabled: 0, unreadable: 0 },
    });
    expect(out).toContain("2 per-IP");
    expect(out).not.toContain("finished the brief and got");
    // Mais la marque est là quand même : un refus est un refus.
    expect(out).toContain("⚠ TODAY");
  });

  it("le coupe-circuit fermé est la première ligne, pas une note de bas de page", () => {
    const out = text({ ...LIVE_2026_09_11, enabled: false });
    expect(out).toContain("ANONYMOUS GENERATION IS OFF");
    expect(out).toContain("anon_generation_enabled");
    const lines = renderCeilingGlance({ ...LIVE_2026_09_11, enabled: false });
    // Au-dessus des compteurs, qui à ce moment-là ne veulent plus rien dire.
    const off = lines.findIndex((l) => l.includes("IS OFF"));
    const reveals = lines.findIndex((l) => l.includes("reveals"));
    expect(off).toBeLessThan(reveals);
  });

  it("alerte à 80 % AVANT le premier refus", () => {
    // Le seuil est le sujet du lot : voir venir plutôt que rencontrer.
    const at79 = text({
      ...LIVE_2026_09_11,
      reveals: { used: 118, cap: 150, left: 32, pct: 78.7 },
    });
    const at80 = text({
      ...LIVE_2026_09_11,
      reveals: { used: 120, cap: 150, left: 30, pct: 80.0 },
    });
    expect(at79).not.toContain("⚠ TODAY");
    expect(at80).toContain("⚠ TODAY");
  });
});

describe("⚠ un plafond illisible n'est jamais un zéro rassurant", () => {
  it("le dit, et dit comment le lire", () => {
    const out = unreadableCeiling("permission denied for function anon_spend_today").join("\n");
    expect(out).toContain("could not be read");
    expect(out).toContain("unknown spend, not as no spend");
    // Et surtout : aucun chiffre inventé.
    expect(out).not.toMatch(/\$\s*0\.00/);
  });
});

/*
 * ── QUELQU'UN A PAYÉ ET N'A RIEN EU ─────────────────────────────────────
 *
 * Trois chemins produisent un achat sans projet : `/pricing` qui mène au
 * checkout sans projet, la réclamation du brief qui échoue à l'inscription, et
 * `purchases_project_id_fkey ON DELETE SET NULL` qui détache l'achat dès qu'on
 * supprime un projet. Aucun des trois n'ouvre quoi que ce soit — et sans cette
 * ligne, aucun des trois ne se voit.
 */
describe("⚠ les achats orphelins", () => {
  const ORPHANS: Orphans = {
    total: 2,
    amount_cents: 22800,
    oldest: "2026-10-05T09:12:00Z",
    rows: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        user_id: "22222222-2222-2222-2222-222222222222",
        tier: "starter",
        amount_cents: 7900,
        created_at: "2026-10-05T09:12:00Z",
        suggested_project_id: "33333333-3333-3333-3333-333333333333",
      },
      {
        id: "44444444-4444-4444-4444-444444444444",
        user_id: "55555555-5555-5555-5555-555555555555",
        tier: "practice",
        amount_cents: 14900,
        created_at: "2026-10-06T18:40:00Z",
        suggested_project_id: null,
      },
    ],
  };

  it("dit explicitement qu'il n'y en a pas, plutôt que de taire la ligne", () => {
    // Une ligne absente se lit comme « rien à signaler » ET comme « pas
    // mesuré ». Elle est toujours écrite.
    expect(text(LIVE_2026_09_11)).toContain("every paid purchase names its project");
  });

  it("un orphelin met la marque d'alerte sur la journée", () => {
    const out = text(LIVE_2026_09_11, ORPHANS);
    expect(out).toContain("⚠ TODAY");
    expect(out).toContain("⚠ orphaned");
  });

  it("donne l'argent pris, parce que c'est ce qui rend la chose urgente", () => {
    expect(text(LIVE_2026_09_11, ORPHANS)).toContain("$228.00");
    expect(text(LIVE_2026_09_11, ORPHANS)).toContain("nothing opened");
  });

  it("⚠ donne la commande à coller quand le projet est évident", () => {
    /*
     * À sept heures du matin, l'écart entre un indice et une instruction
     * qu'on peut coller, c'est si la chose est réparée aujourd'hui ou jamais.
     * Et la seconde commande compte autant : rattacher l'achat ne rouvre pas
     * l'allocation, `grant_plan_allowance` doit être appelée derrière.
     */
    const out = text(LIVE_2026_09_11, ORPHANS);
    expect(out).toContain(
      "update public.purchases set project_id = '33333333-3333-3333-3333-333333333333'"
    );
    expect(out).toContain("grant_plan_allowance('33333333-3333-3333-3333-333333333333', 'starter'");
  });

  it("ne propose RIEN quand le projet n'est pas évident", () => {
    const out = text(LIVE_2026_09_11, ORPHANS);
    expect(out).toContain("no single obvious project");
    // Et surtout : pas de commande inventée pour la deuxième ligne.
    expect(out).not.toContain("project_id = 'null'");
    expect(out).not.toContain("project_id = ''");
  });

  it("⚠ une lecture impossible n'est PAS zéro", () => {
    // C'est la distinction qui compte : « aucun » et « je ne sais pas » se
    // lisent pareil sur un rapport, et l'un des deux demande d'agir.
    // ⚠ Appelé sans le second argument, pas avec `undefined` passé au helper :
    // une valeur par défaut de paramètre se déclenche sur `undefined`, donc le
    // helper aurait rendu « zéro orphelin » et ce test aurait menti.
    const out = renderCeilingGlance(LIVE_2026_09_11).join("\n");
    expect(out).toContain("could not be read");
    expect(out).not.toContain("every paid purchase names its project");
  });
});
