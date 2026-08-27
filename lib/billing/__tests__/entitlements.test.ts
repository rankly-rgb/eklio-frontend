import { describe, expect, it } from "vitest";
import {
  isEntitledToMonthlyPresence,
  PAST_DUE_GRACE_DAYS,
  type Subscription,
} from "@/lib/billing/entitlements";

/*
 * Les quatre bornes de la règle d'accès (§7). Elles sont testées ici parce que
 * c'est la SEULE définition du droit dans l'application : les tuiles
 * verrouillées, la carte du kit, la route `unlock` et le cron mensuel la
 * relisent tous. Si elle bouge, elle bouge ici.
 */

const NOW = new Date("2026-09-15T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function subscription(overrides: Partial<Subscription>): Subscription {
  return {
    status: "active",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: "sub_test",
    ...overrides,
  };
}

describe("isEntitledToMonthlyPresence", () => {
  it("active : accès ouvert", () => {
    expect(isEntitledToMonthlyPresence(subscription({ status: "active" }), NOW)).toBe(
      true
    );
  });

  it("trialing : accès ouvert", () => {
    expect(
      isEntitledToMonthlyPresence(subscription({ status: "trialing" }), NOW)
    ).toBe(true);
  });

  it("past_due DANS la grâce : accès ouvert", () => {
    // Période terminée il y a deux jours : la carte a été refusée, Stripe
    // réessaie encore, le calendrier reste ouvert.
    const endedTwoDaysAgo = new Date(NOW.getTime() - 2 * DAY_MS).toISOString();
    expect(
      isEntitledToMonthlyPresence(
        subscription({ status: "past_due", currentPeriodEnd: endedTwoDaysAgo }),
        NOW
      )
    ).toBe(true);
  });

  it("past_due HORS grâce : accès fermé", () => {
    const endedFourDaysAgo = new Date(NOW.getTime() - 4 * DAY_MS).toISOString();
    expect(
      isEntitledToMonthlyPresence(
        subscription({ status: "past_due", currentPeriodEnd: endedFourDaysAgo }),
        NOW
      )
    ).toBe(false);
  });

  it("la borne exacte de la grâce est fermée, pas ouverte", () => {
    const exactlyAtLimit = new Date(
      NOW.getTime() - PAST_DUE_GRACE_DAYS * DAY_MS
    ).toISOString();
    expect(
      isEntitledToMonthlyPresence(
        subscription({ status: "past_due", currentPeriodEnd: exactlyAtLimit }),
        NOW
      )
    ).toBe(false);
  });

  it("past_due sans fin de période connue : accès fermé", () => {
    // On ne devine pas une date de grâce qu'on n'a pas.
    expect(
      isEntitledToMonthlyPresence(
        subscription({ status: "past_due", currentPeriodEnd: null }),
        NOW
      )
    ).toBe(false);
  });

  it("aucun abonnement : accès fermé", () => {
    expect(isEntitledToMonthlyPresence(null, NOW)).toBe(false);
  });

  it.each(["canceled", "unpaid", "paused", "incomplete", "incomplete_expired"])(
    "%s : accès fermé même avec une période qui court encore",
    (status) => {
      const inTenDays = new Date(NOW.getTime() + 10 * DAY_MS).toISOString();
      expect(
        isEntitledToMonthlyPresence(
          subscription({ status, currentPeriodEnd: inTenDays }),
          NOW
        )
      ).toBe(false);
    }
  );
});
