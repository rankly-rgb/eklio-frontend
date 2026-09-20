import { describe, expect, it } from "vitest";
import { checkEthics, hasBlockingViolation } from "@/lib/ethics/rules";

/*
 * ── LE CORPUS PARTAGÉ ───────────────────────────────────────────────────
 *
 * Depuis le 14 septembre, la garde déontologique a DEUX implémentations :
 *
 *   ici        `FORBIDDEN_PATTERNS`, vingt expressions régulières compilées
 *   en base    `ethics_patterns`, les mêmes traduites en POSIX
 *
 * ⚠ DEUX IMPLÉMENTATIONS D'UNE MÊME RÈGLE EST EXACTEMENT LA DIVERGENCE QUE CE
 * DÉPÔT A DÉJÀ PAYÉE TROIS FOIS. Elle est assumée ici pour une raison qu'on
 * peut dire : une fonction SQL ne peut pas lire du TypeScript, et un scan qui
 * ne tourne que dans l'application ne couvre pas le texte écrit directement par
 * une RPC — ce qui est précisément le trou que le lot devait fermer.
 *
 * Ce qui tient les deux ensemble en attendant une fusion, c'est CE CORPUS :
 * les six exemples que `ethics_rules.example_forbidden` porte en base, plus les
 * reformulations que `ETHICS_SYSTEM_RULES` donne comme correctes. Chaque
 * implémentation doit bloquer les uns et laisser passer les autres, et un
 * fichier de chaque côté le vérifie sur les mêmes phrases :
 *
 *   ici               eklio-frontend/lib/ethics/__tests__/shared-corpus.test.ts
 *   son jumeau SQL    eklio-backend/supabase/tests/20260914170000_the_guard_in_the_write.test.sql
 *
 * La fusion reste à faire et est consignée dans OUT_OF_SCOPE.md.
 */

/**
 * ⚠ RECOPIÉ DE `ethics_rules.example_forbidden`, EN BASE, LE 14 SEPTEMBRE.
 *
 * Ce ne sont pas des phrases inventées pour un test : c'est ce que le produit
 * MONTRE à la praticienne quand elle demande à lire la règle. Un exemple que le
 * scanner ne bloque pas est une règle affichée et non appliquée — ce qui est
 * exactement ce qui a été trouvé en écrivant ce fichier.
 */
const WHAT_THE_PRODUCT_SHOWS_HER = [
  { rule: "timeframe", text: "Heal your anxiety in 12 weeks." },
  {
    rule: "proven",
    text: "A clinically proven method that resolves trauma for good.",
  },
  { rule: "client_voice", text: "Clients often tell me..." },
  { rule: "credential", text: "Certified in EMDR after a weekend intensive." },
  { rule: "scarcity", text: "Limited spots available." },
  { rule: "diagnosis", text: "If you have PTSD, this page is for you." },
] as const;

/**
 * Les reformulations que `ETHICS_SYSTEM_RULES` donne comme CORRECTES, dans le
 * prompt lui-même. Une garde qui refuse tout est verte sur le bloc du dessus et
 * inutilisable.
 */
const WHAT_THE_RULES_SAY_TO_WRITE_INSTEAD = [
  "understand what your anxiety is protecting you from",
  "a space to look at the patterns that keep repeating",
  "learn how your nervous system responds to stress",
  "We will find an approach that works best for you.",
  "People navigating anxiety are welcome here.",
  "A first session is fifty minutes, and mostly you talk.",
];

describe("⚠ chaque exemple que le produit lui montre est bloqué", () => {
  it.each(WHAT_THE_PRODUCT_SHOWS_HER)(
    "$rule — $text",
    ({ text }) => {
      const { violations } = checkEthics(text);
      expect(
        hasBlockingViolation(violations),
        `"${text}" est l'exemple affiché d'une règle et il n'est pas bloqué : ` +
          `la règle est montrée et non appliquée`
      ).toBe(true);
    }
  );

  it("⚠ « Limited spots available. » — celui qui manquait", () => {
    /*
     * Trouvé le 14 septembre en portant ces motifs en SQL et en exigeant du
     * scanner qu'il bloque les six exemples de `ethics_rules`. Le motif de
     * rareté exigeait « only N spots left » ou « limited-TIME offer » : la
     * phrase que le produit affiche comme interdite passait, des deux côtés.
     *
     * Aucun test ne posait cette question. C'est pourquoi celui-ci existe.
     */
    const { violations } = checkEthics("Limited spots available.");
    expect(hasBlockingViolation(violations)).toBe(true);
    expect(violations.some((v) => v.ruleId === "scarcity")).toBe(true);
  });
});

describe("et ce que les règles disent d'écrire à la place passe", () => {
  it.each(WHAT_THE_RULES_SAY_TO_WRITE_INSTEAD)("%s", (text) => {
    const { violations } = checkEthics(text);
    expect(
      hasBlockingViolation(violations),
      `"${text}" est donné comme la reformulation CORRECTE par ` +
        `ETHICS_SYSTEM_RULES, et le scanner le refuse`
    ).toBe(false);
  });

  it("l'exception de « that works » tient des deux côtés", () => {
    // Postgres n'a pas d'anticipation négative ; la traduction SQL porte
    // l'exception dans une colonne. Les deux doivent se comporter pareil.
    expect(
      hasBlockingViolation(checkEthics("A method that works, every time.").violations)
    ).toBe(true);
    expect(
      hasBlockingViolation(
        checkEthics("We will find an approach that works best for you.").violations
      )
    ).toBe(false);
  });
});

describe("le corpus lui-même ne se vide pas", () => {
  it("les six règles y sont, une par règle", () => {
    /*
     * ⚠ Une garde anti-vacuité. Un corpus réduit à une phrase resterait vert
     * et ne prouverait plus rien — c'est la forme que prend une énumération
     * qui a cessé de vérifier quoi que ce soit.
     */
    expect(WHAT_THE_PRODUCT_SHOWS_HER).toHaveLength(6);
    expect(new Set(WHAT_THE_PRODUCT_SHOWS_HER.map((e) => e.rule)).size).toBe(6);
    expect(WHAT_THE_RULES_SAY_TO_WRITE_INSTEAD.length).toBeGreaterThanOrEqual(6);
  });
});
