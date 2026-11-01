import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import inventoryJson from "@/lib/visual-library/inventory.generated.json";
import type { Inventory } from "@/lib/visual-library/inventory";
import { assignMonth, candidates, chooseIllustration, MATCH_THRESHOLD, REPEAT_SPACING, type PostSignals } from "@/lib/visual-library/match";

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

describe("jamais le même dessin à moins de dix posts d'écart", () => {
  const post: PostSignals = { cardLine: "When the map changes", hook: "Changed plans can leave you without direction." };
  const filler = (i: number): PostSignals => ({ cardLine: `Unrelated line ${i}` });

  it("le voisin prend le suivant au-dessus du seuil, ou rien", () => {
    const [a, b] = assignMonth([post, post], entries);
    expect(a?.id).toBe("grief-folded-map");
    expect(b?.id).not.toBe(a?.id);
  });

  it("à dix posts d'écart, le même dessin revient — à neuf, non", () => {
    expect(REPEAT_SPACING).toBe(10);
    const ten = assignMonth([post, ...Array.from({ length: 9 }, (_, i) => filler(i)), post], entries);
    expect(ten[10]?.id).toBe("grief-folded-map");
    const nine = assignMonth([post, ...Array.from({ length: 8 }, (_, i) => filler(i)), post], entries);
    expect(nine[9]?.id).not.toBe("grief-folded-map");
  });

  it("déterministe : le même mois donne les mêmes dessins", () => {
    const posts = [{ hook: "hidden load" }, { hook: "breaking a pattern" }, { hook: "grounding" }];
    expect(assignMonth(posts, entries)).toEqual(assignMonth(posts, entries));
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA COUVERTURE, MESURÉE SUR LE VRAI MOIS DE DÉCEMBRE 2026
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Décembre, relu en production (lecture seule), apparié par ce module. Premier
 * arrêt le 2026-11-01 au matin : 18/30 — 60 %, sous les 70 % de la consigne. Le
 * seuil n'a pas été baissé ; sont arrivés depuis 28 dessins (lot 6) et l'écart
 * de dix posts à la place de l'unicité stricte. Ce test fige le chiffre : s'il
 * bouge, il doit bouger pour une raison qu'on écrit (un lot, une banque
 * élargie), jamais parce qu'on a desserré le barème.
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

  /*
   * 18/30 le 2026-11-01 au matin (64 dessins, unicité stricte) ; 28/30 le soir :
   * lot 6 (28 dessins), unicité remplacée par l'écart de dix posts, et trois
   * corrections de justesse du barème (racine de « change », mots non
   * discriminants mesurés, expression entière). Le seuil n'a pas bougé.
   */
  it("28 sur 30, écart de dix posts tenu", () => {
    expect(posts).toHaveLength(30);
    expect(month.filter(Boolean)).toHaveLength(28);
  });

  it("aucun dessin ne revient à moins de dix posts", () => {
    month.forEach((m, i) => {
      if (!m) return;
      for (let j = Math.max(0, i - REPEAT_SPACING + 1); j < i; j += 1) expect(month[j]?.id, `rang ${i}`).not.toBe(m.id);
    });
  });
});
