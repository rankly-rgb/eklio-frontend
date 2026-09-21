import { describe, expect, it } from "vitest";
import { collisionsIn, redundantAgainst } from "@/lib/content/dedup";
import { checkinLeaks, ARCHETYPE_THAT_MAY_QUOTE_THE_CHECKIN } from "@/lib/content/leakage";
import { capitaliseTitle, eyebrowFor, EYEBROW_MAX_WORDS } from "@/lib/content/bands";

/*
 * ── LES QUATRE DÉFAUTS DU MOIS DU 2026-09-21b, ÉCRITS COMME DES CAS ─────
 *
 * ⚠ CHAQUE CAS PART DES DONNÉES RÉELLES DE CE MOIS-LÀ, PAS D'UN EXEMPLE
 * INVENTÉ. Un cas écrit après coup avec une fixture commode prouve que le
 * correctif marche sur la fixture. Les titres, les réponses de bilan et les
 * libellés ci-dessous sont ceux qui ont été publiés : la suite échouait sur
 * eux avant le correctif, ce qui est la seule preuve qui compte.
 */

/** Les titres du mois rendu, dans l'état où ils sont sortis. */
const PUBLISHED_TITLES = [
  "Life rewrote itself",
  "When life rewrites itself",
  "When the map stops matching",
  "When the map no longer fits",
  "How competence masks exhaustion",
  "When competence masks the cost",
  "The competence mask slips",
  "Rest is not a reward",
  "The Sunday dread starts early",
  "Three small returns",
];

describe("défaut 1 — deux titres de même sens dans un mois", () => {
  it("les reformulations du mois rendu sont vues", () => {
    const found = collisionsIn(PUBLISHED_TITLES);
    const pairs = found.map((c) => [PUBLISHED_TITLES[c.a], PUBLISHED_TITLES[c.b]] as const);

    const contains = (a: string, b: string) =>
      pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

    expect(contains("Life rewrote itself", "When life rewrites itself")).toBe(true);
    expect(contains("How competence masks exhaustion", "When competence masks the cost")).toBe(true);
    expect(contains("How competence masks exhaustion", "The competence mask slips")).toBe(true);
    expect(contains("When competence masks the cost", "The competence mask slips")).toBe(true);
  });

  /*
   * ⚠ CETTE PAIRE PASSE, ET LE CAS EXISTE POUR QUE PERSONNE NE CROIE LE
   * CONTRAIRE.
   *
   * « When the map stops matching » et « When the map no longer fits » sont la
   * sixième paire du mois rendu, et une comparaison lexicale ne peut pas les
   * attraper sans attraper aussi deux titres qui partagent « life » ou
   * « emdr » par coïncidence — la signature est identique : un mot porteur en
   * commun. La règle qui les attrapait a refusé 106 sujets sur 116 au tirage
   * réel et rendu un mois de 10 posts ; voir le bloc qui l'explique dans
   * `dedup.ts`.
   *
   * Le cas est écrit à l'endroit, comme une limite connue, plutôt que retiré
   * du fichier — un trou qu'aucun test ne nomme se referme tout seul dans la
   * tête du prochain lecteur.
   */
  it("deux titres qui ne partagent qu'un mot passent — limite assumée", () => {
    const pair = ["When the map stops matching", "When the map no longer fits"];
    expect(collisionsIn(pair)).toEqual([]);
  });

  it("et les titres qui ne redisent rien sont laissés tranquilles", () => {
    const found = collisionsIn(PUBLISHED_TITLES);
    const touched = new Set(found.flatMap((c) => [PUBLISHED_TITLES[c.a], PUBLISHED_TITLES[c.b]]));
    expect(touched.has("Rest is not a reward")).toBe(false);
    expect(touched.has("The Sunday dread starts early")).toBe(false);
    expect(touched.has("Three small returns")).toBe(false);
  });

  it("au tirage, le doublon est refusé et nommé", () => {
    const accepted = ["Life rewrote itself", "Rest is not a reward"];
    expect(redundantAgainst("When life rewrites itself", accepted)).toContain("Life rewrote itself");
    expect(redundantAgainst("The Sunday dread starts early", accepted)).toBeNull();
  });

  /*
   * ── ⚠ LE CAS QUI AURAIT ÉVITÉ LE MOIS À DIX POSTS ────────────────────
   *
   * Tous les autres cas de ce fichier partent de paires choisies à la main,
   * et une paire choisie à la main ne dit rien du TAUX de faux positifs. La
   * règle retirée refusait 106 sujets sur 116 au tirage réel, et la suite
   * était verte.
   *
   * Ce cas mesure donc ce qui compte : ce qu'un vrai lot PERD. Le seuil est
   * un sur dix, pas zéro, parce qu'il en reste un et qu'il est nommé ci-
   * dessous — un faux positif à 10 % est absorbé par la sur-génération (44
   * candidats pour 30 posts) ; à 91 %, il ne l'est pas.
   */
  it("un vrai lot de dix titres distincts n'en perd pas plus d'un", () => {
    const drawn = [
      "When your nervous system grieves the life you lost",
      "When your life script suddenly rewrites itself",
      "EMDR and the myth of moving on",
      "What EMDR does when plans end",
      "The body keeping its own timeline about going back",
      "Reading a hard first week back as personal failure",
      "What switching off actually asks of a nervous system",
      "Three small returns after a long leave",
      "The Sunday dread starts before the alarm",
      "Rest is not a reward",
    ];
    const kept: string[] = [];
    const refused: string[] = [];
    for (const title of drawn) {
      if (redundantAgainst(title, kept)) refused.push(title);
      else kept.push(title);
    }
    expect(refused.length, `refusés : ${refused.join(" | ")}`).toBeLessThanOrEqual(1);
  });

  /*
   * ⚠ LE FAUX POSITIF QUI RESTE, NOMMÉ PLUTÔT QUE SUBI.
   *
   * « nervous system » est un terme composé : deux mots qui n'en désignent
   * qu'un. La règle des deux mots distinctifs partagés le compte pour deux et
   * rapproche donc deux titres qui n'ont en commun qu'une partie du corps.
   *
   * Le fusionner — compter un bigramme partagé comme un seul concept — casse
   * un VRAI positif du même mois : « competence masks exhaustion » et « when
   * competence masks the cost » ne partagent, eux aussi, qu'un bigramme, et
   * c'est précisément la répétition à attraper. Les deux cas ont la même
   * signature lexicale ; les séparer demanderait de savoir lequel est le
   * propos du titre.
   *
   * Il est donc gardé, au prix mesuré d'un sujet sur dix reposé en banque.
   */
  it("« nervous system » rapproche deux titres qui n'ont rien en commun", () => {
    const hit = redundantAgainst("What switching off actually asks of a nervous system", [
      "When your nervous system grieves the life you lost",
    ]);
    expect(hit).toContain("nerv");
  });

  it("le premier sujet d'un mois n'a rien à redire", () => {
    expect(redundantAgainst("Life rewrote itself", [])).toBeNull();
  });

  /*
   * ⚠ LE MOT DU MOIS N'EST PAS UN DOUBLON. C'est le cas qui distingue une
   * règle utilisable d'une règle qui vide la banque : dans un mois sur
   * l'épuisement, « burnout » revient partout et ce n'est pas une répétition.
   */
  it("le sujet du mois revient sans que rien ne soit refusé", () => {
    const month = [
      "Burnout is not a mood",
      "Burnout after the holidays",
      "The burnout nobody names",
      "What burnout costs a Sunday",
      "Burnout and the body clock",
    ];
    expect(collisionsIn(month)).toEqual([]);
  });
});

describe("défaut 2 — une réponse de bilan recopiée sur une carte", () => {
  const facts = {
    sessionsTheme: "a lot of returning-to-work burnout in sessions this month",
    happening: "Evening slots opening October",
    location: "Oakland, California",
  };

  it("« Oakland California » sur un diagramme est vu", () => {
    expect(checkinLeaks("quadrant_model", "Oakland, California | still bracing", facts)).toContain(
      "oakl cali"
    );
  });

  it("« Evening slots opening October » sur un diagramme est vu", () => {
    expect(checkinLeaks("cycle", "Evening slots opening October", facts).length).toBeGreaterThan(0);
  });

  it("la carte praticienne, elle, a le droit — c'est son contenu", () => {
    expect(
      checkinLeaks(ARCHETYPE_THAT_MAY_QUOTE_THE_CHECKIN, "Oakland, California", facts)
    ).toEqual([]);
  });

  /*
   * ⚠ UN MOT EN COMMUN N'EST PAS UNE CITATION. Le bilan dit « burnout » et le
   * mois parle de burnout : c'est ce à quoi le bilan sert. Une règle qui
   * refuserait ça refuserait tous les mois.
   */
  it("parler du sujet que le bilan a fait remonter n'est pas le recopier", () => {
    expect(checkinLeaks("cycle", "Burnout is not a mood you wait out", facts)).toEqual([]);
  });
});

describe("défaut 3 — un surtitre de quatorze mots, dix fois", () => {
  const theme = "returning to work when the body has not agreed to it";

  it("un thème-phrase est ramené à une étiquette", () => {
    const eyebrow = eyebrowFor({ theme, title: null, angleLabel: null }, "Elm & Ember");
    expect(eyebrow.split(" ").length).toBeLessThanOrEqual(EYEBROW_MAX_WORDS);
  });

  it("dix cartes d'un même thème portent dix surtitres", () => {
    const titles = PUBLISHED_TITLES;
    const eyebrows = titles.map((title) =>
      eyebrowFor({ theme, title, angleLabel: null }, "Elm & Ember")
    );
    // Pas dix identiques : c'est exactement ce que le mois rendu montrait.
    expect(new Set(eyebrows).size).toBeGreaterThanOrEqual(titles.length - 2);
    for (const e of eyebrows) expect(e.split(" ").length).toBeLessThanOrEqual(EYEBROW_MAX_WORDS);
  });

  it("les étiquettes du cahier des charges passent telles quelles", () => {
    expect(eyebrowFor({ angleLabel: "After EMDR" }, "X")).toBe("AFTER EMDR");
    expect(eyebrowFor({ angleLabel: "Grounding" }, "X")).toBe("GROUNDING");
  });
});

describe("défaut 4 — un titre qui commence en minuscule", () => {
  it("la majuscule est posée", () => {
    expect(capitaliseTitle("rest is not a reward")).toBe("Rest is not a reward");
  });

  it("un nom propre déjà écrit garde sa casse", () => {
    expect(capitaliseTitle("eMDR is not hypnosis")).toBe("eMDR is not hypnosis");
    expect(capitaliseTitle("EMDR is not hypnosis")).toBe("EMDR is not hypnosis");
    expect(capitaliseTitle("iPhone notifications at night")).toBe("iPhone notifications at night");
  });

  it("une citation ou un guillemet ouvrant ne bloque pas la majuscule", () => {
    expect(capitaliseTitle('"rest is not a reward"')).toBe('"Rest is not a reward"');
  });

  it("un titre déjà correct n'est pas touché", () => {
    expect(capitaliseTitle("Rest is not a reward")).toBe("Rest is not a reward");
  });
});
