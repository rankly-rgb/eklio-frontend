import { describe, it, expect } from "vitest";
import {
  owedNotice,
  formatChargeDate,
  NOTICE_DAYS_BEFORE,
} from "@/app/api/cron/trial-ending/route";
import { trialEndingEmail } from "@/lib/email/templates";
import { formatUsd, MONTHLY_PRESENCE } from "@/lib/billing/plans";

/*
 * Le préavis d'avant-prélèvement.
 *
 * Ce produit n'a AUCUNE primitive de remboursement après-coup : rien, nulle
 * part, ne sait rendre $39 encaissés. Ce message est donc la seule protection
 * qui existe entre une praticienne qui a oublié et un débit qu'on ne saura pas
 * annuler. Ces tests figent la fenêtre et le contenu obligatoire.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-09T12:00:00Z");

function row(overrides: Partial<Parameters<typeof owedNotice>[0]> = {}) {
  return {
    status: "trialing",
    trialEnd: new Date(NOW.getTime() + 5 * DAY).toISOString(),
    trialNoticeSentFor: null,
    ...overrides,
  };
}

/*
 * ── LA FENÊTRE LÉGALE ────────────────────────────────────────────────────
 *
 * Bus. & Prof. Code § 17602 (Californie, amendé le 1er juillet 2025) : pour un
 * essai gratuit de plus de 31 jours, préavis entre 3 et 21 jours avant la
 * bascule. Nos 90 jours sont largement au-dessus de 31, donc la fenêtre
 * s'applique et le marché du produit est américain.
 *
 * Le test ne fige pas « 7 » pour le plaisir de figer une constante : il fige
 * qu'on est DANS la fenêtre, avec de la marge contre le plancher — le balayage
 * tourne une fois par jour, et un préavis prévu à J-3 qui glisse d'un jour est
 * hors délai.
 */
describe("la fenêtre de préavis", () => {
  it("tient dans les bornes légales de 3 à 21 jours", () => {
    expect(NOTICE_DAYS_BEFORE).toBeGreaterThanOrEqual(3);
    expect(NOTICE_DAYS_BEFORE).toBeLessThanOrEqual(21);
  });

  it("et garde au moins trois jours de marge sur le plancher", () => {
    // De quoi encaisser plusieurs balayages ratés d'affilée sans sortir des
    // clous. C'est ça, l'argument — pas le chiffre rond.
    expect(NOTICE_DAYS_BEFORE - 3).toBeGreaterThanOrEqual(3);
  });
});

describe("owedNotice", () => {
  it("prévient un essai qui finit dans la fenêtre", () => {
    expect(owedNotice(row(), NOW)).toBe(true);
  });

  it("ne prévient pas un abonnement qui n'est pas en essai", () => {
    for (const status of ["active", "past_due", "canceled", "paused"]) {
      expect(owedNotice(row({ status }), NOW), status).toBe(false);
    }
  });

  it("ne prévient pas trop tôt", () => {
    const far = new Date(NOW.getTime() + 30 * DAY).toISOString();
    expect(owedNotice(row({ trialEnd: far }), NOW)).toBe(false);
  });

  /*
   * La borne basse compte autant que la haute : un essai déjà terminé n'a plus
   * de préavis à recevoir, seulement une facture. Prévenir après coup serait
   * pire que de ne rien dire.
   */
  it("ne prévient pas après coup", () => {
    const past = new Date(NOW.getTime() - DAY).toISOString();
    expect(owedNotice(row({ trialEnd: past }), NOW)).toBe(false);
  });

  it("aux bornes exactes : maintenant oui, sept jours oui, au-delà non", () => {
    const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
    expect(owedNotice(row({ trialEnd: at(0) }), NOW)).toBe(true);
    expect(owedNotice(row({ trialEnd: at(NOTICE_DAYS_BEFORE * DAY) }), NOW)).toBe(true);
    expect(owedNotice(row({ trialEnd: at(NOTICE_DAYS_BEFORE * DAY + 1) }), NOW)).toBe(false);
    expect(owedNotice(row({ trialEnd: at(-1) }), NOW)).toBe(false);
  });

  it("ne prévient pas deux fois pour la même date", () => {
    const trialEnd = new Date(NOW.getTime() + 5 * DAY).toISOString();
    expect(owedNotice(row({ trialEnd, trialNoticeSentFor: trialEnd }), NOW)).toBe(false);
  });

  /*
   * ⚠ MAIS UN ESSAI PROLONGÉ EN MÉRITE UN NOUVEAU. Elle rachète Practice Suite,
   * la date bouge de 90 jours : l'avertissement déjà envoyé ne portait pas sur
   * le prélèvement qu'elle va subir. Un booléen aurait avalé ce second préavis.
   */
  it("prévient à nouveau quand l'essai a été prolongé", () => {
    const oldEnd = new Date(NOW.getTime() - 80 * DAY).toISOString();
    const newEnd = new Date(NOW.getTime() + 5 * DAY).toISOString();
    expect(
      owedNotice(row({ trialEnd: newEnd, trialNoticeSentFor: oldEnd }), NOW)
    ).toBe(true);
  });

  /*
   * Postgres et Stripe ne formatent pas l'ISO pareil pour le même instant. La
   * comparaison porte sur l'INSTANT, sinon deux écritures de la même seconde
   * se liraient comme deux dates — donc deux préavis pour un seul débit.
   */
  it("compare des instants, pas des chaînes", () => {
    expect(
      owedNotice(
        row({
          trialEnd: "2026-09-14T12:00:00.000Z",
          trialNoticeSentFor: "2026-09-14T12:00:00+00:00",
        }),
        NOW
      )
    ).toBe(false);
  });

  it("une date illisible ne déclenche rien", () => {
    expect(owedNotice(row({ trialEnd: "pas une date" }), NOW)).toBe(false);
    expect(owedNotice(row({ trialEnd: null }), NOW)).toBe(false);
  });
});

/*
 * ── CE QUE LE MESSAGE DOIT CONTENIR ──────────────────────────────────────
 *
 * Les quatre mentions exigées par § 17602 : la durée et les conditions de la
 * période reconduite, le MONTANT, la FRÉQUENCE, et COMMENT ANNULER. Aucune
 * n'est décorative — c'est pour ça qu'elles sont épinglées ici plutôt que
 * laissées à la relecture.
 */
describe("le contenu du préavis", () => {
  const email = trialEndingEmail({
    to: "her@example.com",
    userId: "11111111-1111-4111-8111-111111111111",
    chargeDate: "December 8, 2026",
    amount: formatUsd(MONTHLY_PRESENCE.amountCents),
    interval: MONTHLY_PRESENCE.interval,
  });

  it("nomme la date, dans le sujet comme dans le corps", () => {
    expect(email.subject).toContain("December 8, 2026");
    expect(email.text).toContain("December 8, 2026");
    expect(email.html).toContain("December 8, 2026");
  });

  it("nomme le montant et la périodicité", () => {
    for (const body of [email.text, email.html]) {
      expect(body).toContain("$39");
      expect(body).toContain("month");
    }
  });

  it("dit comment annuler, et le lien mène quelque part", () => {
    expect(email.text).toMatch(/cancel/i);
    expect(email.text).toContain("/app/settings#subscription");
    expect(email.html).toContain("/app/settings#subscription");
  });

  /*
   * ⚠ ET IL DIT QUE LE KIT RESTE À ELLE. C'est la phrase qui empêche une
   * résiliation d'être vécue comme une perte : sans elle, quelqu'un garde un
   * abonnement dont il ne veut plus par peur de perdre ce qu'il a acheté.
   */
  it("rappelle que résilier ne retire pas le kit", () => {
    expect(email.text).toMatch(/one-time purchase/i);
  });

  /*
   * ⚠ AUCUN LIEN DE DÉSINSCRIPTION. Ce message annonce un débit : lui offrir
   * de s'en désinscrire reviendrait à lui offrir de ne plus être prévenue
   * avant d'être prélevée. Les relances, elles, en ont un — et doivent le
   * garder.
   */
  it("ne propose PAS de se désinscrire", () => {
    expect(email.html).not.toContain("/api/unsubscribe");
    expect(email.text).not.toContain("/api/unsubscribe");
    expect(email.text).not.toMatch(/stop receiving/i);
  });
});

describe("formatChargeDate", () => {
  it("écrit la date comme une lectrice américaine la lit", () => {
    expect(formatChargeDate("2026-12-08T00:00:00.000Z")).toBe("December 8, 2026");
  });

  /*
   * En UTC, explicitement. Sans ça, un serveur à l'ouest lirait minuit UTC
   * comme la veille au soir et annoncerait le 7 pour un débit du 8.
   */
  it("sans glisser d'un jour selon le fuseau du serveur", () => {
    expect(formatChargeDate("2026-12-08T00:30:00.000Z")).toBe("December 8, 2026");
  });
});
