import { describe, expect, it } from "vitest";
import { drawMonth, type DrawnTopic, type DrawPorts } from "@/lib/content/month/draw";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE TIRAGE, ÉPROUVÉ PAR UNE BANQUE EN MÉMOIRE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ LA DOUBLURE SE COMPORTE COMME `assign_topic_to_kit`, PAS COMME UNE LISTE :
 * elle MARQUE ce qu'elle rend. Un sujet rendu deux fois ferait passer des tests
 * que la vraie banque ferait échouer, puisqu'elle retire de la circulation
 * chaque sujet qu'elle assigne.
 *
 * ⚠ ET LES TITRES SONT RÉELLEMENT DISTINCTS, PARCE QUE LE DÉDOUBLONNAGE EST VRAI.
 * La première version de ce fichier utilisait « Alpha one », « Alpha two »,
 * « Echo one/two/three » : `redundantAgainst` les a refusés, à juste titre, et
 * trois tests ont échoué. Le contrôle avait raison ; c'étaient les fixtures qui
 * étaient fausses. Une fixture de tirage doit ressembler à une banque réelle,
 * sinon elle éprouve un tirage que personne ne fera.
 */

const FAMILIES = {
  varied: ["carousel", "quadrant", "cycle"],
  simple: ["surface_and_beneath"],
  statement: ["single_statement"],
};
const DRAW_ORDER = ["varied", "simple", "statement"];

/** Une banque qui assigne une fois chaque sujet, comme la vraie. */
function bank(stock: Array<[string, string]>) {
  const free = stock.map(([archetype, title], i) => ({
    id: `t${i + 1}`,
    archetype_key: archetype,
    intent: "educate",
    title,
    hook: null as string | null,
  }));
  const assigned: DrawnTopic[] = [];
  const calls: Array<string | undefined> = [];

  const ports: DrawPorts = {
    async assign(archetype) {
      calls.push(archetype);
      const i = free.findIndex((t) => archetype === undefined || t.archetype_key === archetype);
      if (i === -1) return null;
      const [taken] = free.splice(i, 1);
      assigned.push(taken);
      return taken.id;
    },
    async topic(id) {
      return assigned.find((t) => t.id === id) ?? null;
    },
  };
  return { ports, calls, assigned, free };
}

const INPUT = {
  families: FAMILIES,
  drawOrder: DRAW_ORDER,
  perFamily: 2,
  candidates: 6,
  practitionerCap: 2,
  practitionerPayload: true,
};

describe("la ronde par famille", () => {
  /*
   * ⚠ À TOUR DE RÔLE, PAS « LE PREMIER JUSQU'À ÉPUISEMENT ». C'est le défaut qui
   * a sorti le mois de perrin.vale avec 5 archétypes sur 11 alors que la banque
   * en portait 23, 23 et 30 : le premier archétype de la famille absorbait le
   * quota entier.
   */
  it("prend un archétype différent à chaque passage", async () => {
    const world = bank([
      ["carousel", "What burnout actually costs"],
      ["carousel", "Three myths about sleep hygiene"],
      ["quadrant", "Where grief hides in the body"],
      ["quadrant", "Reading a panic attack from inside"],
      ["cycle", "How avoidance keeps itself alive"],
    ]);
    /* La ronde SEULE : sans rattrapage, varied ne peut pas gagner un troisième. */
    const out = await drawMonth(world.ports, {
      ...INPUT,
      drawOrder: ["varied"],
      perFamily: 2,
      candidates: 2,
    });
    const variedTaken = out.drawn.filter((c) => c.family === "varied");
    expect(variedTaken).toHaveLength(2);
    expect(
      new Set(variedTaken.map((c) => c.topic.archetype_key)).size,
      "les deux sujets de varied viennent du même archétype : la ronde ne tourne pas"
    ).toBe(2);
  });

  it("les trois familles passent, dans l'ordre reçu", async () => {
    const world = bank([
      ["carousel", "What burnout actually costs"],
      ["quadrant", "Where grief hides in the body"],
      ["surface_and_beneath", "The calm that is really vigilance"],
      ["single_statement", "Rest is not a reward"],
    ]);
    const out = await drawMonth(world.ports, { ...INPUT, perFamily: 1, candidates: 3 });
    expect(out.drawn.map((c) => c.family)).toEqual(["varied", "simple", "statement"]);
  });

  /*
   * ⚠ LA PÉNURIE EST DITE, PAS DEVINÉE. Un mois de quinze posts a été livré sans
   * un seul constat le 2026-09-23 : le rapport portait bien un `shortfall`, mais
   * c'était une ligne de rapport, pas un contrôle.
   */
  it("une famille à sec est nommée avec son compte", async () => {
    const world = bank([["carousel", "What burnout actually costs"]]);
    const out = await drawMonth(world.ports, { ...INPUT, perFamily: 2, candidates: 2 });
    expect(out.shortfall).toContain("simple: 0 of 2 (the bank had no more)");
    expect(out.shortfall).toContain("statement: 0 of 2 (the bank had no more)");
    expect(out.shortfall.find((s) => s.startsWith("varied"))).toBe(
      "varied: 1 of 2 (the bank had no more)"
    );
  });
});

describe("les deux plafonds, sur la seule porte par où tout passe", () => {
  /*
   * ⚠ LE PLAFOND PRATICIENNE TENAIT SUR UNE SEULE DES DEUX PORTES. Posé dans la
   * ronde, le rattrapage — qui demande un sujet sans nommer d'archétype — en a
   * repris huit. Neuf cartes praticiennes sur trente, toutes identiques, et le
   * mois a passé tous les contrôles : 9 sur 30 font exactement 30,0 %.
   */
  it("le rattrapage ne peut pas dépasser le plafond praticienne", async () => {
    const world = bank([
      ["practitioner_card", "Where I trained and why"],
      ["practitioner_card", "Fifteen years in perinatal work"],
      ["practitioner_card", "The reading that changed my practice"],
      ["practitioner_card", "How a first session actually goes"],
    ]);
    /* Aucune famille ne porte practitioner_card : tout passe par le rattrapage. */
    const out = await drawMonth(world.ports, { ...INPUT, perFamily: 0, candidates: 6 });
    const cards = out.drawn.filter((c) => c.topic.archetype_key === "practitioner_card");
    expect(cards, "le rattrapage a dépassé le plafond").toHaveLength(2);
    expect(out.rejected.map((r) => r.because)).toContain(
      "déjà 2 cartes praticiennes, et leurs lignes sont identiques"
    );
  });

  it("une carte praticienne sans faits au brief n'entre pas dans la ronde", async () => {
    const world = bank([["practitioner_card", "Where I trained and why"]]);
    await drawMonth(world.ports, {
      ...INPUT,
      families: { varied: ["practitioner_card"] },
      drawOrder: ["varied"],
      perFamily: 2,
      candidates: 0,
      practitionerPayload: false,
    });
    expect(
      world.calls,
      "un sujet a été assigné pour un archétype qu'on ne peut pas composer"
    ).toEqual([]);
  });

  /*
   * ⚠ SUR LA LIGNE DE CARTE, PAS SUR LE TITRE. Deux titres distincts en banque
   * peuvent se réduire au MÊME texte à trente caractères : le mois de
   * marlow.quint est sorti avec deux cartes « When the body disagrees », l'une en
   * quadrant, l'autre en courbe.
   */
  it("deux titres qui se coupent au même texte ne passent pas tous les deux", async () => {
    const long = "When the body disagrees with what the mind has decided";
    const world = bank([
      ["carousel", long + " today"],
      ["quadrant", long + " again"],
    ]);
    const out = await drawMonth(world.ports, {
      ...INPUT,
      perFamily: 2,
      candidates: 2,
      drawOrder: ["varied"],
    });
    expect(out.drawn).toHaveLength(1);
    expect(out.rejected[0]?.because).toMatch(/même ligne de carte une fois coupée/);
  });
});

describe("ce qui est refusé est relâché", () => {
  /*
   * ⚠ NE PAS LE RELÂCHER BLOQUE TOUT LE SEGMENT TROIS HEURES. La banque locale
   * portait 994 assignations orphelines le 2026-09-26, et deux essais sur cinq
   * étaient refusés avant la moindre dépense pour cette seule raison.
   */
  it("chaque refus met son sujet dans releasedEarly", async () => {
    const long = "When the body disagrees with what the mind has decided";
    const world = bank([
      ["carousel", long + " today"],
      ["quadrant", long + " again"],
    ]);
    const out = await drawMonth(world.ports, {
      ...INPUT,
      perFamily: 2,
      candidates: 2,
      drawOrder: ["varied"],
    });
    expect(out.releasedEarly).toHaveLength(out.rejected.length);
    expect(out.releasedEarly).toHaveLength(1);
    /* Et le sujet relâché n'est PAS dans les retenus. */
    expect(out.drawn.map((c) => c.topic.id)).not.toContain(out.releasedEarly[0]);
  });

  /*
   * ⚠ ET LE MOTIF NOMME L'ARCHÉTYPE. Le mois de teo.marrow est sorti sans un
   * seul carrousel et le rapport ne permettait pas de dire si aucun n'avait été
   * tiré ou si les cinq avaient été refusés : deux corrections opposées.
   */
  it("le motif de refus nomme l'archétype et le titre", async () => {
    const long = "When the body disagrees with what the mind has decided";
    const world = bank([
      ["carousel", long + " today"],
      ["quadrant", long + " again"],
    ]);
    const out = await drawMonth(world.ports, {
      ...INPUT,
      perFamily: 2,
      candidates: 2,
      drawOrder: ["varied"],
    });
    expect(out.rejected[0].archetype).toBe("quadrant");
    expect(out.rejected[0].title).toContain("again");
  });
});

describe("le rattrapage", () => {
  /*
   * ⚠ CE QUI MANQUE DANS UNE FAMILLE EST PRIS AILLEURS. Le second compte de test
   * n'a pu tirer que 28 candidats sur 36 le 2026-09-21 : l'anti-collision lui
   * refusait tout ce que la première praticienne avait pris dans les 90 jours.
   * Mieux vaut trente posts dont le mélange penche que vingt-deux bien répartis.
   */
  it("complète depuis n'importe quelle famille, sans nommer d'archétype", async () => {
    const world = bank([
      ["carousel", "What burnout actually costs"],
      ["single_statement", "Rest is not a reward"],
      ["single_statement", "Anger often arrives as fatigue"],
      ["single_statement", "Boundaries are information"],
    ]);
    const out = await drawMonth(world.ports, { ...INPUT, perFamily: 1, candidates: 4 });
    expect(out.drawn).toHaveLength(4);
    expect(
      world.calls.filter((c) => c === undefined).length,
      "le rattrapage a nommé un archétype"
    ).toBeGreaterThan(0);
  });

  it("s'arrête quand la banque n'a plus rien, sans boucler", async () => {
    const world = bank([["carousel", "What burnout actually costs"]]);
    const out = await drawMonth(world.ports, { ...INPUT, perFamily: 1, candidates: 30 });
    expect(out.drawn).toHaveLength(1);
    expect(world.free).toHaveLength(0);
  });

  /*
   * ⚠ UN SUJET ASSIGNÉ MAIS ILLISIBLE N'EST PAS UN CANDIDAT. La lecture suit
   * l'assignation : si elle ne rend rien, le sujet est marqué pris sans être
   * utilisable, et le tirage doit passer au suivant plutôt que d'inventer.
   */
  it("un sujet assigné que la lecture ne rend pas n'entre pas dans le mois", async () => {
    const ports: DrawPorts = {
      async assign() {
        return "ghost";
      },
      async topic() {
        return null;
      },
    };
    const out = await drawMonth(ports, { ...INPUT, perFamily: 1, candidates: 3 });
    expect(out.drawn).toEqual([]);
  });
});
