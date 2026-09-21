import { describe, expect, it, vi } from "vitest";
import { readPath, writePath, repairPayload } from "@/lib/content/generate/repair";
import { budgetErrors } from "@/lib/compose/budget";

/*
 * ── CE QUE LA RÉPARATION A DÛ APPRENDRE À LIRE ──────────────────────────
 *
 * Mesuré le 2026-09-21 : sur huit payloads hors budget, la réparation en
 * corrigeait zéro. Le modèle rendait pourtant la bonne phrase — il ajoutait
 * son propre décompte derrière, parce qu'on lui avait demandé de compter :
 *
 *     "Looks fine outside\n\n(3 words)"
 *
 * Trois mots, et recomptés à cinq. Chaque réécriture était donc rejetée, rien
 * ne changeait, et la boucle s'arrêtait après une passe. Après correction :
 * huit sur huit.
 */

const message = (text: string) => ({
  content: [{ type: "text" as const, text }],
  usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
}) as never;

describe("les chemins", () => {
  const payload = { items: [{ label: "one", gloss: "two" }], surface: { label: "s" } };

  it("se lisent comme budgetErrors les écrit", () => {
    expect(readPath(payload, "items[0].gloss")).toBe("two");
    expect(readPath(payload, "surface.label")).toBe("s");
    expect(readPath(payload, "nowhere[3].label")).toBeNull();
  });

  it("s'écrivent sans toucher à l'original", () => {
    const next = writePath(payload, "items[0].label", "changed") as typeof payload;
    expect(next.items[0].label).toBe("changed");
    expect(payload.items[0].label).toBe("one");
  });
});

describe("la réparation lit la réponse du modèle", () => {
  const tooLong = { statement: "This statement runs on well past the twenty four word limit that the database enforces on a single statement card and so it must come back shorter than it is" };

  it("⚠ LE DÉCOMPTE QUE LE MODÈLE AJOUTE N'EST PAS LA PHRASE", async () => {
    const port = vi.fn(async () => message("Rest is learned, not forced\n\n(5 words)"));
    const out = await repairPayload(port, "single_statement", tooLong);
    expect(out.ok).toBe(true);
    expect((out.payload as { statement: string }).statement).toBe("Rest is learned, not forced");
    expect(out.passes).toBe(1);
  });

  it("les guillemets qu'il met autour non plus", async () => {
    const port = vi.fn(async () => message('"Rest is learned, not forced"'));
    const out = await repairPayload(port, "single_statement", tooLong);
    expect((out.payload as { statement: string }).statement).toBe("Rest is learned, not forced");
  });

  it("une réponse qui ne raccourcit rien est refusée, et la boucle s'arrête", async () => {
    const port = vi.fn(async () => message("This statement runs on well past the twenty four word limit that the database enforces on a single statement card and so it must come back shorter than it is"));
    const out = await repairPayload(port, "single_statement", tooLong);
    expect(out.ok).toBe(false);
    expect(out.rewritten).toEqual([]);
    expect(port).toHaveBeenCalledTimes(1);
  });

  /*
   * ⚠ DEUX PASSES, ET ELLES SERVENT. La version d'avant jetait toute réponse
   * non conforme, donc rien ne changeait et la seconde passe n'existait que
   * sur le papier. Un progrès monotone les rend réelles.
   */
  it("une réponse plus courte mais encore trop longue est gardée, et la passe suivante finit le travail", async () => {
    const replies = [
      // 27 mots : plus court que les 30 d'origine, toujours au-dessus des 24.
      "Rest is learned and it is never forced by anyone at all and that is the whole of what this card is trying to say",
      "Rest is learned, never forced",
    ];
    let call = 0;
    const port = vi.fn(async () => message(replies[Math.min(call++, replies.length - 1)]));
    const out = await repairPayload(port, "single_statement", tooLong);
    expect(out.ok).toBe(true);
    expect(out.passes).toBe(2);
    expect(budgetErrors("single_statement", out.payload)).toEqual([]);
  });
});
