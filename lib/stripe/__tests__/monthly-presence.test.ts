import { describe, it, expect } from "vitest";
import {
  planIncludedMonths,
  type ExistingSubscription,
} from "@/lib/stripe/monthly-presence";
import {
  INCLUDED_MONTHLY_PRESENCE_TRIAL_DAYS,
  INCLUDED_MONTHLY_PRESENCE_COPY,
  includesMonthlyPresence,
  MONTHLY_PRESENCE,
  formatUsd,
} from "@/lib/billing/plans";
import { KIT_TIERS } from "@/lib/kit/tiers";

/*
 * Les trois mois inclus dans Practice Suite.
 *
 * Ce fichier fige la seule règle du lot qui décide combien de temps quelqu'un
 * ne paie pas. Elle est pure exprès : ce qui suit se teste aux bornes, sans
 * Stripe, sans réseau et sans horloge implicite.
 */

const DAY = 24 * 60 * 60;
const NOW = 1_800_000_000; // un instant fixe, en secondes Unix
const ADDED = INCLUDED_MONTHLY_PRESENCE_TRIAL_DAYS * DAY;

function existing(overrides: Partial<ExistingSubscription> = {}): ExistingSubscription {
  return {
    id: "sub_existing",
    status: "active",
    trialEnd: null,
    currentPeriodEnd: NOW + 10 * DAY,
    ...overrides,
  };
}

describe("planIncludedMonths — personne qui n'est pas encore abonnée", () => {
  it("crée un abonnement avec 90 jours d'essai", () => {
    const plan = planIncludedMonths(null, NOW);
    expect(plan).toEqual({ action: "create", trialPeriodDays: 90 });
  });

  it("et les 90 jours viennent du catalogue, pas d'un littéral", () => {
    expect(INCLUDED_MONTHLY_PRESENCE_TRIAL_DAYS).toBe(90);
    const plan = planIncludedMonths(null, NOW);
    expect(plan.action === "create" && plan.trialPeriodDays).toBe(
      INCLUDED_MONTHLY_PRESENCE_TRIAL_DAYS
    );
  });

  /*
   * Un abonnement MORT ne se prolonge pas — il n'y a rien à prolonger, et
   * repousser l'essai d'un abonnement résilié ne le ressusciterait pas.
   */
  it("un abonnement résilié ou expiré compte pour rien", () => {
    for (const status of ["canceled", "incomplete_expired"]) {
      expect(planIncludedMonths(existing({ status }), NOW).action).toBe("create");
    }
  });
});

describe("planIncludedMonths — quelqu'un qui est DÉJÀ abonné", () => {
  /*
   * ⚠ LA DEMANDE EXPLICITE DU LOT : trois mois AJOUTÉS, jamais un second
   * abonnement. `action: "extend"` porte l'id de celui qu'elle a déjà.
   */
  it("prolonge l'abonnement existant au lieu d'en créer un second", () => {
    const plan = planIncludedMonths(existing(), NOW);
    expect(plan.action).toBe("extend");
    expect(plan.action === "extend" && plan.subscriptionId).toBe("sub_existing");
  });

  it("tout abonnement encore vivant est prolongé, y compris en souffrance", () => {
    for (const status of [
      "active",
      "trialing",
      "past_due",
      "unpaid",
      "paused",
      "incomplete",
    ]) {
      expect(
        planIncludedMonths(existing({ status }), NOW).action,
        `statut ${status}`
      ).toBe("extend");
    }
  });

  /*
   * ⚠ ON PART DE LA FIN DE CE QU'ELLE A DÉJÀ PAYÉ. Partir de maintenant lui
   * avalerait les jours déjà réglés : « trois mois offerts » lui coûterait
   * alors une fraction de mois.
   */
  it("ajoute 90 jours APRÈS la période déjà payée, pas après aujourd'hui", () => {
    const paidUntil = NOW + 10 * DAY;
    const plan = planIncludedMonths(existing({ currentPeriodEnd: paidUntil }), NOW);

    expect(plan.action === "extend" && plan.trialEnd).toBe(paidUntil + ADDED);
    // Et surtout : PAS 90 jours à compter de maintenant.
    expect(plan.action === "extend" && plan.trialEnd).not.toBe(NOW + ADDED);
  });

  /*
   * Un second achat de Practice Suite pendant les trois premiers mois. La base
   * est alors l'essai en cours, pas la période : elle doit finir avec 180
   * jours, pas 90.
   */
  it("empile sur un essai en cours", () => {
    const trialEnd = NOW + 80 * DAY;
    const plan = planIncludedMonths(
      existing({ status: "trialing", trialEnd, currentPeriodEnd: trialEnd }),
      NOW
    );
    expect(plan.action === "extend" && plan.trialEnd).toBe(trialEnd + ADDED);
  });

  /*
   * ⚠ ET JAMAIS DEPUIS UNE DATE PASSÉE. Un `past_due` traîne une fin de
   * période dépassée ; s'en servir comme base rendrait moins de 90 jours,
   * voire une date d'essai déjà expirée que Stripe traiterait comme un essai
   * terminé — c'est-à-dire un prélèvement immédiat sur quelqu'un à qui on
   * vient de promettre trois mois.
   */
  it("ne part jamais d'une date déjà passée", () => {
    const plan = planIncludedMonths(
      existing({ status: "past_due", currentPeriodEnd: NOW - 40 * DAY }),
      NOW
    );
    expect(plan.action === "extend" && plan.trialEnd).toBe(NOW + ADDED);
    expect(plan.action === "extend" && plan.trialEnd).toBeGreaterThan(NOW);
  });

  it("une période et un essai tous deux nuls repartent de maintenant", () => {
    const plan = planIncludedMonths(
      existing({ trialEnd: null, currentPeriodEnd: null }),
      NOW
    );
    expect(plan.action === "extend" && plan.trialEnd).toBe(NOW + ADDED);
  });

  /*
   * Le plafond Stripe est de deux ans depuis le `billing_cycle_anchor`, et
   * l'anchor est déplacé sur le `trial_end` à chaque mise à jour. Chaque
   * prolongation repart donc d'une ancre neuve : le pas reste de 90 jours,
   * quel que soit le nombre d'achats.
   */
  it("chaque prolongation ne fait qu'un pas de 90 jours", () => {
    let base = NOW;
    for (let i = 0; i < 10; i += 1) {
      const plan = planIncludedMonths(
        existing({ status: "trialing", trialEnd: base, currentPeriodEnd: base }),
        NOW
      );
      const next = plan.action === "extend" ? plan.trialEnd : 0;
      expect(next - base).toBe(ADDED);
      base = next;
    }
  });
});

describe("le tier qui inclut l'abonnement", () => {
  it("est Practice Suite, et lui seul", () => {
    expect(includesMonthlyPresence("signature")).toBe(true);
    for (const tier of KIT_TIERS) {
      if (tier === "signature") continue;
      expect(includesMonthlyPresence(tier), tier).toBe(false);
    }
  });

  // Garde anti-vacuité : la liste des tiers doit avoir de quoi mordre.
  it("et l'échelle compte plus d'un palier", () => {
    expect(KIT_TIERS.length).toBeGreaterThan(1);
  });
});

/*
 * ── LA PHRASE VENDUE ─────────────────────────────────────────────────────
 *
 * Trois faits, tous les trois obligatoires : ce qui est inclus, ce qui est
 * prélevé ensuite, et qu'on peut arrêter avant. Le troisième est celui qu'une
 * page de vente « oublie », et c'est celui qui rend les deux autres honnêtes.
 */
describe("la phrase des trois mois", () => {
  it("dit les trois mois, le montant, la périodicité et la sortie", () => {
    expect(INCLUDED_MONTHLY_PRESENCE_COPY).toContain("three months");
    expect(INCLUDED_MONTHLY_PRESENCE_COPY).toContain(
      formatUsd(MONTHLY_PRESENCE.amountCents)
    );
    expect(INCLUDED_MONTHLY_PRESENCE_COPY).toContain(MONTHLY_PRESENCE.interval);
    expect(INCLUDED_MONTHLY_PRESENCE_COPY).toMatch(/cancel/i);
  });

  it("et le montant vient du catalogue plutôt que d'être écrit à la main", () => {
    /*
     * Le canari : si quelqu'un recopie « $39 » en dur et que le catalogue
     * bouge, la phrase mentirait sans que rien ne casse. On vérifie qu'elle
     * suit la source.
     */
    expect(INCLUDED_MONTHLY_PRESENCE_COPY).toContain("$39");
    expect(formatUsd(MONTHLY_PRESENCE.amountCents)).toBe("$39");
  });
});
