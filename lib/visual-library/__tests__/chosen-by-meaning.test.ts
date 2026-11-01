import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import inventoryJson from "@/lib/visual-library/inventory.generated.json";
import type { Inventory } from "@/lib/visual-library/inventory";
import { assignMonth, candidates, chooseIllustration, MATCH_THRESHOLD, type PostSignals } from "@/lib/visual-library/match";

const entries = (inventoryJson as Inventory).entries;

describe("le dessin dit le contenu", () => {
  it("l'iceberg va sur ce qui est caché, le baromètre sur l'intensité, l'ancre sur l'ancrage", () => {
    expect(candidates({ hook: "Anxiety can be a hidden load: what is beneath the surface." }, entries)[0]?.id).toBe("anx-iceberg");
    expect(candidates({ cardLine: "Measuring a feeling", hook: "Anger has an intensity you can notice." }, entries)[0]?.id).toBe("anger-gauge");
    expect(candidates({ hook: "Grounding can help you hold steady when things shift." }, entries)[0]?.id).toBe("ground-anchor");
  });

  it("l'objet nommé appelle son dessin", () => {
    expect(candidates({ cardLine: "The past can echo" }, entries).map((m) => m.id)).toContain("mem-echo-rings");
    expect(candidates({ cardLine: "When the map changes", hook: "Plans changed without permission." }, entries)[0]?.id).toBe("grief-folded-map");
  });
});

describe("un refus plutôt qu'un objet inadapté", () => {
  it("rien sous le seuil : null, jamais une illustration par défaut", () => {
    expect(chooseIllustration({ cardLine: "Book a consult", hook: "Wednesdays are open." }, entries, new Set())).toBeNull();
  });

  it("un mot générique ne suffit pas (« two », « once », « time »)", () => {
    expect(candidates({ hook: "Two people, one time, once more." }, entries)).toEqual([]);
  });

  it("la légende confirme, elle ne suffit pas par un mot", () => {
    expect(candidates({ cardLine: "Feeling Is Not Surrender", caption: "Your mood can shift." }, entries)).toEqual([]);
  });

  it("le nom de la famille seul ne suffit pas (0,5 sous un seuil de 1)", () => {
    expect(MATCH_THRESHOLD).toBe(1);
    expect(candidates({ cardLine: "EMDR in Oakland" }, entries)).toEqual([]);
  });

  it("un xtra- ou un dessin sans thème n'est jamais tiré", () => {
    const ids = entries.filter((e) => !e.drawable).map((e) => e.id);
    const all = candidates({ hook: "wave soft dome splash spiral feathers", cardLine: "a soft wave" }, entries).map((m) => m.id);
    for (const id of ids) expect(all).not.toContain(id);
  });
});

describe("deux posts du même mois ne portent pas la même illustration", () => {
  it("le second prend le suivant au-dessus du seuil, ou rien", () => {
    const post: PostSignals = { cardLine: "When the map changes", hook: "Changed plans can leave you without direction." };
    const [a, b] = assignMonth([post, post], entries);
    expect(a?.id).toBe("grief-folded-map");
    expect(b?.id).not.toBe(a?.id);
  });

  it("déterministe : le même mois donne les mêmes dessins", () => {
    const posts = [{ hook: "hidden load" }, { hook: "breaking a pattern" }, { hook: "grounding" }];
    expect(assignMonth(posts, entries)).toEqual(assignMonth(posts, entries));
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA MESURE QUI ARRÊTE LE CHANTIER (2026-11-01)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le mois de décembre 2026, relu en production (lecture seule), apparié par ce
 * module : 18 posts sur 30 trouvent une illustration distincte — 60 %, sous les
 * 70 % que la consigne fixe. Le seuil n'est pas baissé : un seuil abaissé rend
 * exactement le défaut qu'on corrige. Ce test fige le chiffre ; s'il bouge, il
 * doit bouger pour une raison qu'on écrit (un nouveau lot de dessins, une banque
 * élargie), pas parce qu'on a desserré le barème.
 */
describe("couverture mesurée sur décembre 2026", () => {
  const dir = join(__dirname, "..", "..", "..", "design/visual-library-2026-11-01");
  const posts = (JSON.parse(readFileSync(join(dir, "december-2026-posts.json"), "utf8")) as {
    posts: Array<{ cardLine: string; hook: string; topic_title: string; payload: unknown; caption: string }>;
  }).posts;
  const month = assignMonth(
    posts.map((p) => ({ title: p.topic_title, hook: p.hook, cardLine: p.cardLine, payload: p.payload, caption: p.caption })),
    entries
  );

  it("18 sur 30 avec l'anti-répétition", () => {
    expect(posts).toHaveLength(30);
    expect(month.filter(Boolean)).toHaveLength(18);
  });

  it("aucune illustration n'est posée deux fois", () => {
    const ids = month.filter(Boolean).map((m) => m!.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
