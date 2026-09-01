import { describe, expect, it } from "vitest";
import {
  canSend,
  EMAIL_COOLDOWN_HOURS,
  parseEmailState,
  unsubscribeToken,
  unsubscribeTokenValid,
} from "@/lib/email/state";

/*
 * Le plafond d'envoi. Un praticien qui abandonne son brief, revient, génère,
 * puis ne choisit pas déclenche TROIS raisons d'écrire en deux jours. Ce
 * plafond est ce qui l'empêche d'en recevoir trois.
 */

const NOW = new Date("2026-09-15T12:00:00.000Z");
const HOUR = 3600_000;

describe("canSend", () => {
  it("écrit à quelqu'un qu'on n'a jamais contacté", () => {
    expect(canSend({ sent: {}, unsubscribed: false }, "brief_abandoned", NOW)).toBe(
      true
    );
  });

  it("n'écrit jamais à un désinscrit", () => {
    expect(canSend({ sent: {}, unsubscribed: true }, "month_ready", NOW)).toBe(
      false
    );
  });

  it("n'envoie jamais deux fois le même type", () => {
    const sentLongAgo = new Date(NOW.getTime() - 400 * HOUR).toISOString();
    expect(
      canSend(
        { sent: { brief_abandoned: sentLongAgo }, unsubscribed: false },
        "brief_abandoned",
        NOW
      )
    ).toBe(false);
  });

  it(`retient un AUTRE type pendant ${EMAIL_COOLDOWN_HOURS} h`, () => {
    const recent = new Date(NOW.getTime() - 10 * HOUR).toISOString();
    expect(
      canSend(
        { sent: { brief_abandoned: recent }, unsubscribed: false },
        "direction_unchosen",
        NOW
      )
    ).toBe(false);
  });

  it("laisse passer un autre type une fois le plafond écoulé", () => {
    const old = new Date(NOW.getTime() - (EMAIL_COOLDOWN_HOURS + 1) * HOUR)
      .toISOString();
    expect(
      canSend(
        { sent: { brief_abandoned: old }, unsubscribed: false },
        "direction_unchosen",
        NOW
      )
    ).toBe(true);
  });

  it("ignore une date illisible plutôt que de bloquer pour toujours", () => {
    expect(
      canSend(
        { sent: { brief_abandoned: "not-a-date" }, unsubscribed: false },
        "month_ready",
        NOW
      )
    ).toBe(true);
  });
});

describe("parseEmailState", () => {
  it("tolère des métadonnées absentes ou étrangères", () => {
    expect(parseEmailState(undefined)).toEqual({ sent: {}, unsubscribed: false });
    expect(parseEmailState({ other_app: true })).toEqual({
      sent: {},
      unsubscribed: false,
    });
  });

  it("relit ce qu'on y a écrit", () => {
    expect(
      parseEmailState({
        eklio_emails: {
          sent: { month_ready: "2026-09-01T05:00:00.000Z" },
          unsubscribed: true,
        },
      })
    ).toEqual({
      sent: { month_ready: "2026-09-01T05:00:00.000Z" },
      unsubscribed: true,
    });
  });
});

describe("unsubscribeToken", () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

  it("valide son propre jeton", () => {
    const user = "11111111-1111-1111-1111-111111111111";
    expect(unsubscribeTokenValid(user, unsubscribeToken(user))).toBe(true);
  });

  it("refuse le jeton d'un autre utilisateur", () => {
    const a = "11111111-1111-1111-1111-111111111111";
    const b = "22222222-2222-2222-2222-222222222222";
    expect(unsubscribeTokenValid(b, unsubscribeToken(a))).toBe(false);
  });

  it("refuse un jeton de longueur différente sans lever", () => {
    const user = "11111111-1111-1111-1111-111111111111";
    expect(unsubscribeTokenValid(user, "short")).toBe(false);
    expect(unsubscribeTokenValid(user, "")).toBe(false);
  });

  process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
});
