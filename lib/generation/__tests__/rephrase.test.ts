import { describe, expect, it } from "vitest";
import {
  ProperNounIntroducedError,
  findIntroducedProperNoun,
  rephrase,
} from "@/lib/generation/rephrase";

/*
 * La seule vérification déterministe possible sur une réécriture de texte
 * libre : un nom propre qui n'était pas dans l'original ne devrait jamais
 * apparaître dans le résultat (§2.1, §2.7).
 */

describe("findIntroducedProperNoun", () => {
  it("ne signale rien quand la réécriture ne fait que resserrer", () => {
    const original = "She's direct, but you never feel judged, even on a hard day.";
    const rewritten = "She's direct, but you never feel judged.";
    expect(findIntroducedProperNoun(original, rewritten)).toBeNull();
  });

  it("ignore la majuscule de début de phrase", () => {
    const original = "she works with first responders carrying trauma from the job.";
    const rewritten = "She works with first responders carrying trauma from the job.";
    expect(findIntroducedProperNoun(original, rewritten)).toBeNull();
  });

  it("ignore un sigle en capitales déjà connu ou nouveau (pas un nom propre Title Case)", () => {
    const original = "She trained in EMDR.";
    const rewritten = "She trained in EMDR and CBT.";
    expect(findIntroducedProperNoun(original, rewritten)).toBeNull();
  });

  it("signale un mot capitalisé absent de l'original, hors début de phrase", () => {
    const original = "She's direct, but you never feel judged.";
    const rewritten = "She's direct, but you never feel judged, says Sarah.";
    expect(findIntroducedProperNoun(original, rewritten)).toBe("Sarah");
  });

  it("ne compte pas un mot déjà présent dans l'original, même en minuscules", () => {
    const original = "Portland clinicians trust her judgment.";
    const rewritten = "Her judgment is why Portland clinicians trust her.";
    expect(findIntroducedProperNoun(original, rewritten)).toBeNull();
  });
});

describe("rephrase", () => {
  it("lève ProperNounIntroducedError plutôt que de renvoyer le texte", async () => {
    const call = async () => "She's direct, but you never feel judged, says Maria.";
    await expect(
      rephrase("referral_quote", "She's direct, but you never feel judged.", call)
    ).rejects.toBeInstanceOf(ProperNounIntroducedError);
  });

  it("renvoie la réécriture quand elle n'ajoute rien", async () => {
    const call = async () => "She's direct, but never judges you.";
    await expect(
      rephrase(
        "referral_quote",
        "She's direct, but you never feel judged, honestly.",
        call
      )
    ).resolves.toBe("She's direct, but never judges you.");
  });
});
