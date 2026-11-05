import { describe, expect, it } from "vitest";
import { checkBriefLabel } from "@/lib/content/month-checks";
import { identityAllowList } from "@/lib/content/practitioner";

/*
 * LA CARTE 25 DE MARS 2027 (2026-11-05) : une `practitioner_card` dont les deux
 * lignes étaient la modalité et l'État de la fiche, imprimés tels quels.
 */
const facts = { practiceName: "Ember consulting", city: null, state: "California", modalities: ["EMDR"], takingClients: null } as never;
const brief = ["Ember consulting", ...identityAllowList(facts)];

describe("un texte de carte n'est jamais une valeur de la fiche, imprimée telle quelle", () => {
  it("la carte 25 d'avant est refusée, sur ses deux lignes", () => {
    const findings = checkBriefLabel({ lines: ["EMDR", "California"] }, brief);
    expect(findings.map((f) => f.check)).toEqual(["identity.briefLabel", "identity.briefLabel"]);
  });

  it("casse et espaces n'y changent rien", () => {
    expect(checkBriefLabel({ items: [{ label: " emdr ", gloss: "x" }] }, brief)).toHaveLength(1);
  });

  it("une phrase qui nomme la modalité reste permise", () => {
    expect(checkBriefLabel({ statement: "EMDR can include memories that still shape the present." }, brief)).toEqual([]);
  });
});
