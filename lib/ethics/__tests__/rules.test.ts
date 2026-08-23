import { describe, expect, it } from "vitest";
import {
  EthicsComplianceError,
  buildRegenerationFeedback,
  generateWithEthicsGuard,
} from "@/lib/ethics/enforce";
import { ETHICS_DISCLAIMER_TEXT } from "@/lib/ethics/disclaimer";
import {
  ETHICS_SYSTEM_RULES,
  FORBIDDEN_PATTERNS,
  checkEthics,
  type EthicsSeverity,
} from "@/lib/ethics/rules";

/*
 * Ce fichier est le contrat de la couche déontologie. Une chaîne légitime qui
 * échoue ici ne se corrige pas en affaiblissant un pattern, mais en ajoutant
 * un cas d'autorisation explicite ci-dessous (VALID_COPY / FALSE_POSITIVES).
 */

type Case = { label: string; text: string; severity: EthicsSeverity };

const VIOLATIONS: Case[] = [
  // Promesses de résultat.
  {
    label: "promesse de guérison datée",
    text: "Our program will heal your anxiety in 12 weeks.",
    severity: "block",
  },
  {
    label: "promesse de résolution d'une condition",
    text: "We fix depression at the root so it never comes back.",
    severity: "block",
  },
  {
    label: "promesse de disparition sans verbe de résolution",
    text: "After a few months, your panic attacks will be a thing of the past.",
    severity: "block",
  },
  {
    label: "délai promis",
    text: "Most people see real results in 6 weeks of weekly sessions.",
    severity: "block",
  },
  {
    label: "garantie",
    text: "Satisfaction guaranteed, or your next session is free.",
    severity: "block",
  },
  {
    label: "efficacité prouvée",
    text: "A clinically proven method for lifelong calm.",
    severity: "block",
  },
  {
    label: "proven to",
    text: "This approach is proven to reduce distress.",
    severity: "block",
  },
  {
    label: "taux de réussite",
    text: "92% of my clients report feeling steadier after eight sessions.",
    severity: "block",
  },
  {
    label: "soulagement durable",
    text: "Somatic work offers lasting relief from what you carry.",
    severity: "block",
  },
  {
    label: "libération promise",
    text: "Together we will free you from the weight you have been carrying.",
    severity: "block",
  },
  {
    label: "affirmation d'efficacité",
    text: "Finally, therapy that works.",
    severity: "block",
  },

  // Témoignages.
  {
    label: "mot testimonial",
    text: "Read the testimonials from people who trusted the process.",
    severity: "block",
  },
  {
    label: "éloge client paraphrasé",
    text: "My clients say they finally feel heard here.",
    severity: "block",
  },
  {
    label: "avis clients",
    text: "See our client reviews before you book.",
    severity: "block",
  },
  {
    label: "éloge client non chiffré",
    text: "Most of my clients feel steadier within a season of work.",
    severity: "block",
  },
  {
    label: "note en étoiles",
    text: "Rated 4.9 out of 5 stars by the people I work with.",
    severity: "block",
  },
  {
    label: "glyphe étoile",
    text: "★★★★★ — a practice built on trust.",
    severity: "block",
  },
  {
    label: "success story",
    text: "Browse a few success stories from the last year.",
    severity: "block",
  },

  // Superlatifs auto-décernés.
  {
    label: "meilleur thérapeute",
    text: "The best therapist in Austin for burnout.",
    severity: "block",
  },
  {
    label: "numéro un",
    text: "#1 counselor for couples in the Bay Area.",
    severity: "block",
  },
  {
    label: "top-rated",
    text: "A top-rated trauma clinic serving all of Ohio.",
    severity: "block",
  },
  {
    label: "reconnaissance non étayée (warn)",
    text: "An award-winning practitioner with fifteen years of experience.",
    severity: "warn",
  },

  // Diagnostic du lecteur.
  {
    label: "diagnostic du lecteur",
    text: "If you cannot sleep and your chest is tight, you have anxiety.",
    severity: "block",
  },

  // Urgence et rareté.
  {
    label: "rareté",
    text: "Only 2 spots left this month — book before rates go up.",
    severity: "block",
  },
  {
    label: "urgence",
    text: "Act now: this limited-time offer ends Friday.",
    severity: "block",
  },
];

/* Copy psychoéducative conforme : doit passer intégralement. */
const VALID_COPY: string[] = [
  "Anxiety is a protective response. In our work together, we look at what it is trying to keep you safe from, and how that response formed.",
  "A first session is mostly conversation. You describe what brought you here, I ask questions about your history, and together we decide whether this is a good fit.",
  "I am a Licensed Professional Counselor (LPC #12345) in the state of Texas, trained in EMDR and Internal Family Systems.",
  "This practice serves adults navigating grief, life transitions, and the aftermath of trauma.",
  "Understand what your anxiety is protecting you from, at a pace that belongs to you.",
  "Therapy is not a straight line. Some weeks feel like movement, others feel like circling the same corner — both are part of the work.",
  "Sessions are 50 minutes, weekly or every other week, in person in Portland or by secure video anywhere in Oregon.",
  "EMDR is an evidence-based modality for processing distressing memories. It does not erase a memory; it changes how your body holds it.",
  ETHICS_DISCLAIMER_TEXT,
];

/*
 * Faux positifs : mots légitimes contenant un fragment interdit, ou tournures
 * proches d'un interdit mais licites. Toutes doivent passer.
 */
const FALSE_POSITIVES: { label: string; text: string }[] = [
  {
    label: "mots contenant un fragment de « cure »",
    text: "The manicure metaphor is obscure, but the point is that a secure base changes everything.",
  },
  {
    label: "« best » hors superlatif auto-décerné",
    text: "We follow best practices for confidentiality, and we find the approach that works best for you.",
  },
  {
    label: "relecture professionnelle légitime",
    text: "Every intake note is reviewed by a licensed clinical supervisor.",
  },
  {
    label: "« star » dans un autre mot",
    text: "Starting therapy is its own kind of beginning; restarting after a pause is too.",
  },
  {
    label: "durée de séance sans promesse",
    text: "Most people come weekly for 12 weeks before we revisit the plan together.",
  },
  {
    label: "« end » sans promesse de résolution",
    text: "At the end of each session we take a few minutes to land before you head back out.",
  },
  {
    label: "problème technique réparé, sans condition clinique",
    text: "If the booking link is broken, email me and I will fix it the same day.",
  },
  {
    label: "fréquentation décrite sans résultat annoncé",
    text: "Most of my clients stay in weekly work for about six months.",
  },
  {
    label: "modalité fondée sur des preuves, sans promesse",
    text: "Cognitive behavioral therapy is an evidence-based approach to working with anxious thinking.",
  },
  {
    label: "évocation d'un vécu sans diagnostic",
    text: "If you have been carrying a low hum of dread for months, you are not alone.",
  },
];

describe("FORBIDDEN_PATTERNS", () => {
  it("n'utilise jamais le drapeau g (exec doit rester sans état)", () => {
    const stateful = FORBIDDEN_PATTERNS.filter(
      ({ pattern }) => pattern.global || pattern.sticky
    );
    expect(stateful).toEqual([]);
  });

  it("est insensible à la casse partout", () => {
    const caseSensitive = FORBIDDEN_PATTERNS.filter(
      ({ pattern }) => !pattern.ignoreCase
    );
    expect(caseSensitive).toEqual([]);
  });

  it("documente une raison pour chaque pattern", () => {
    for (const { reason } of FORBIDDEN_PATTERNS) {
      expect(reason.length).toBeGreaterThan(10);
    }
  });
});

describe("checkEthics — contenus en violation", () => {
  it.each(VIOLATIONS)("détecte : $label", ({ text, severity }) => {
    const { ok, violations } = checkEthics(text);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.severity === severity)).toBe(true);
    expect(ok).toBe(severity !== "block");

    // L'extrait fautif doit être cité pour pouvoir être renvoyé au modèle.
    for (const violation of violations) {
      expect(violation.excerpt.length).toBeGreaterThan(0);
      expect(text.toLowerCase()).toContain(violation.excerpt.toLowerCase());
    }
  });
});

describe("checkEthics — copy psychoéducative conforme", () => {
  it.each(VALID_COPY)("laisse passer : %s", (text) => {
    const { ok, violations } = checkEthics(text);

    expect(violations).toEqual([]);
    expect(ok).toBe(true);
  });
});

describe("checkEthics — faux positifs", () => {
  it.each(FALSE_POSITIVES)("laisse passer : $label", ({ text }) => {
    expect(checkEthics(text)).toEqual({ ok: true, violations: [] });
  });
});

describe("checkEthics — cas dégénérés", () => {
  it("accepte une chaîne vide", () => {
    expect(checkEthics("")).toEqual({ ok: true, violations: [] });
  });

  it("ne se déclenche pas sur le bloc de règles lui-même hors contexte", () => {
    // ETHICS_SYSTEM_RULES cite volontairement des interdits comme exemples :
    // il ne passe donc pas checkEthics, et ne doit jamais y être soumis.
    expect(ETHICS_SYSTEM_RULES).toContain("PSYCHOEDUCATION ONLY");
    expect(checkEthics(ETHICS_SYSTEM_RULES).ok).toBe(false);
  });
});

describe("buildRegenerationFeedback", () => {
  it("cite l'extrait et la raison des violations bloquantes", () => {
    const { violations } = checkEthics("Satisfaction guaranteed.");
    const feedback = buildRegenerationFeedback(violations);

    expect(feedback).toContain("guaranteed");
    expect(feedback).toContain("Garantit un résultat");
  });

  it("ignore les warn dès qu'une violation bloquante est présente", () => {
    const { violations } = checkEthics(
      "An award-winning practice. Satisfaction guaranteed."
    );
    const feedback = buildRegenerationFeedback(violations);

    expect(violations.some((v) => v.severity === "warn")).toBe(true);
    expect(feedback).toContain("guaranteed");
    expect(feedback).not.toContain("award-winning");
  });

  it("renvoie une chaîne vide sans violation", () => {
    expect(buildRegenerationFeedback([])).toBe("");
  });
});

describe("generateWithEthicsGuard", () => {
  const publishableText = (result: { copy: string }) => [result.copy];

  it("régénère avec feedback puis réussit", async () => {
    const feedbacks: (string | null)[] = [];
    const drafts = [
      "We guarantee lasting relief in 8 weeks.",
      "We look at what your anxiety is protecting you from.",
    ];

    const result = await generateWithEthicsGuard(
      async (feedback) => {
        feedbacks.push(feedback);
        return { copy: drafts[feedbacks.length - 1] };
      },
      { publishableText, label: "test-retry" }
    );

    expect(result.copy).toBe(drafts[1]);
    expect(feedbacks).toHaveLength(2);
    expect(feedbacks[0]).toBeNull();
    expect(feedbacks[1]).toContain("REJECTED");
    expect(feedbacks[1]).toContain("guarantee");
  });

  it("lève EthicsComplianceError après maxRetries sans jamais renvoyer le contenu bloqué", async () => {
    let calls = 0;
    const blocked = "The best therapist in town, results guaranteed.";

    const run = generateWithEthicsGuard(
      async () => {
        calls++;
        return { copy: blocked };
      },
      { publishableText, label: "test-fail", maxRetries: 2 }
    );

    await expect(run).rejects.toBeInstanceOf(EthicsComplianceError);
    expect(calls).toBe(3);

    const error: unknown = await run.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EthicsComplianceError);
    const compliance = error as EthicsComplianceError;
    expect(compliance.attempts).toBe(3);
    expect(compliance.violations.some((v) => v.severity === "block")).toBe(true);
    // Le contenu bloqué ne ressort jamais : seule l'erreur remonte.
    expect(compliance.message).not.toContain(blocked);
  });

  it("respecte maxRetries: 0 (une seule tentative)", async () => {
    let calls = 0;

    await expect(
      generateWithEthicsGuard(
        async () => {
          calls++;
          return { copy: "Guaranteed results." };
        },
        { publishableText, label: "test-no-retry", maxRetries: 0 }
      )
    ).rejects.toBeInstanceOf(EthicsComplianceError);
    expect(calls).toBe(1);
  });

  it("vérifie chaque chaîne publiable, pas seulement la première", async () => {
    const attempts: string[][] = [];
    const rounds = [
      ["A grounded place to start.", "Guaranteed calm in 4 weeks."],
      ["A grounded place to start.", "A pace that belongs to you."],
    ];

    const result = await generateWithEthicsGuard(
      async () => {
        const copies = rounds[attempts.length];
        attempts.push(copies);
        return { copies };
      },
      { publishableText: (r: { copies: string[] }) => r.copies, label: "test-multi" }
    );

    expect(attempts).toHaveLength(2);
    expect(result.copies).toEqual(rounds[1]);
  });

  it("laisse passer un warn sans régénérer", async () => {
    let calls = 0;

    const result = await generateWithEthicsGuard(
      async () => {
        calls++;
        return { copy: "An award-winning practitioner based in Denver." };
      },
      { publishableText, label: "test-warn" }
    );

    expect(calls).toBe(1);
    expect(result.copy).toContain("award-winning");
  });
});
