import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  guardAction,
  GUARD_DAYS_BEFORE,
  EXTENSION_DAYS,
  MAX_EXTENSIONS,
  PROVES_SHE_WAS_WARNED,
  type GuardRow,
} from "@/app/api/cron/trial-guard/route";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * UN ESSAI DONT LE PRÉAVIS N'EST PAS PROUVÉ NE SE CONVERTIT PAS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `guardAction` décide si une carte est débitée. Il n'y a pas de version « à
 * peu près » de ce test : chaque cas ci-dessous est une façon de NE PAS SAVOIR
 * si elle a été prévenue, et toutes doivent tomber du côté « ne pas
 * convertir ».
 *
 * Le défaut historique est le premier cas : une ligne marquée par du code qui
 * enregistrait une TENTATIVE. Elle a une date de préavis, elle n'a aucune
 * preuve, et l'ancienne lecture la prenait pour quelqu'un de prévenu.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-12T12:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

/** Un essai qui se convertit dans deux jours, et personne n'a rien prouvé. */
function row(over: Partial<GuardRow> = {}): GuardRow {
  const end = iso(NOW.getTime() + 2 * DAY);
  return {
    status: "trialing",
    trialEnd: end,
    trialNoticeSentFor: null,
    trialNoticeState: null,
    trialExtensions: 0,
    ...over,
  };
}

describe("ce qui vaut preuve qu'elle a été prévenue", () => {
  /*
   * ⚠ LA LISTE EST COURTE ET ELLE EST LA GARANTIE. `accepted` est ce que ce
   * produit sait produire aujourd'hui ; `delivered` viendra du webhook Resend.
   * Rien d'autre ne doit y entrer sans que quelqu'un relise pourquoi.
   */
  it("n'admet que « accepté » et « remis »", () => {
    expect([...PROVES_SHE_WAS_WARNED]).toEqual(["accepted", "delivered"]);
  });

  it("⚠ et n'admet PAS un état qui ne dit qu'une tentative", () => {
    for (const state of ["sent", "attempted", "queued", "ok"]) {
      expect(PROVES_SHE_WAS_WARNED as readonly string[]).not.toContain(state);
    }
  });
});

describe("guardAction — quand il ne faut RIEN faire", () => {
  it("un abonnement déjà payant n'a pas de bascule à empêcher", () => {
    expect(guardAction(row({ status: "active" }), NOW)).toBe("none");
  });

  it("sans date de fin d'essai, il n'y a pas de débit annoncé", () => {
    expect(guardAction(row({ trialEnd: null }), NOW)).toBe("none");
    expect(guardAction(row({ trialEnd: "pas une date" }), NOW)).toBe("none");
  });

  /*
   * Un essai déjà terminé n'a plus de conversion à empêcher, seulement une
   * facture à discuter. Agir ici donnerait l'illusion d'avoir protégé
   * quelqu'un.
   */
  it("un essai déjà passé est hors de portée", () => {
    expect(guardAction(row({ trialEnd: iso(NOW.getTime() - DAY) }), NOW)).toBe("none");
  });

  it("un essai encore loin est laissé au balayage d'envoi", () => {
    expect(
      guardAction(row({ trialEnd: iso(NOW.getTime() + (GUARD_DAYS_BEFORE + 1) * DAY) }), NOW)
    ).toBe("none");
  });

  it("et une preuve d'acceptation pour CETTE date-là suffit", () => {
    const end = iso(NOW.getTime() + 2 * DAY);
    expect(
      guardAction(
        row({ trialEnd: end, trialNoticeSentFor: end, trialNoticeState: "accepted" }),
        NOW
      )
    ).toBe("none");
  });

  it("« delivered » aussi, pour le jour où le webhook sera branché", () => {
    const end = iso(NOW.getTime() + 2 * DAY);
    expect(
      guardAction(
        row({ trialEnd: end, trialNoticeSentFor: end, trialNoticeState: "delivered" }),
        NOW
      )
    ).toBe("none");
  });
});

describe("⚠ guardAction — toutes les façons de ne pas savoir", () => {
  const end = iso(NOW.getTime() + 2 * DAY);

  /*
   * ⚠ LE DÉFAUT HISTORIQUE, EN UN CAS. La ligne porte une date de préavis et
   * aucune preuve : c'est exactement ce que l'ancien code écrivait, et le
   * prendre pour « prévenue » est la faute que tout ce fichier existe pour
   * rendre impossible.
   */
  it("marquée pour la bonne date mais SANS état : on ne convertit pas", () => {
    expect(guardAction(row({ trialEnd: end, trialNoticeSentFor: end }), NOW)).toBe("extend");
  });

  it("jamais marquée du tout", () => {
    expect(guardAction(row({ trialEnd: end }), NOW)).toBe("extend");
  });

  /*
   * Une date différente veut dire que le préavis annonçait un AUTRE débit —
   * typiquement celui d'avant une prolongation. Il ne couvre pas celui-ci.
   */
  it("marquée pour une AUTRE date", () => {
    expect(
      guardAction(
        row({
          trialEnd: end,
          trialNoticeSentFor: iso(NOW.getTime() - 9 * DAY),
          trialNoticeState: "accepted",
        }),
        NOW
      )
    ).toBe("extend");
  });

  it("rebondie, signalée, échouée — la preuve du contraire", () => {
    for (const state of ["bounced", "complained", "failed"]) {
      expect(
        guardAction(
          row({ trialEnd: end, trialNoticeSentFor: end, trialNoticeState: state }),
          NOW
        ),
        state
      ).toBe("extend");
    }
  });
});

describe("guardAction — les bornes, parce que c'est là que ça se joue", () => {
  it("⚠ exactement au plancher légal, il agit encore", () => {
    const end = iso(NOW.getTime() + GUARD_DAYS_BEFORE * DAY);
    expect(guardAction(row({ trialEnd: end }), NOW)).toBe("extend");
  });

  it("une seconde au-delà, il laisse le balayage faire son travail", () => {
    const end = iso(NOW.getTime() + GUARD_DAYS_BEFORE * DAY + 1000);
    expect(guardAction(row({ trialEnd: end }), NOW)).toBe("none");
  });

  it("l'instant même de la bascule est encore évitable", () => {
    expect(guardAction(row({ trialEnd: iso(NOW.getTime()) }), NOW)).toBe("extend");
  });

  /*
   * ⚠ SANS PLAFOND, UNE PANNE D'ENVOI DURABLE OFFRIRAIT L'ABONNEMENT. La
   * cliente garderait le service sans jamais être facturée ni jamais décider.
   */
  it("prolonge tant qu'il reste des prolongations", () => {
    expect(guardAction(row({ trialExtensions: MAX_EXTENSIONS - 1 }), NOW)).toBe("extend");
  });

  it("⚠ puis annule plutôt que de convertir en silence", () => {
    expect(guardAction(row({ trialExtensions: MAX_EXTENSIONS }), NOW)).toBe("cancel");
    expect(guardAction(row({ trialExtensions: MAX_EXTENSIONS + 5 }), NOW)).toBe("cancel");
  });

  it("et la prolongation laisse au balayage un cycle complet de réessais", () => {
    // Sept jours de rab contre une fenêtre d'envoi de sept jours : la nouvelle
    // date repart avec tout le temps, pas avec ce qu'il en restait.
    expect(EXTENSION_DAYS).toBeGreaterThanOrEqual(GUARD_DAYS_BEFORE);
  });
});

/*
 * ── VERIFY-THEN-CONSUME, LU DANS LA SOURCE ──────────────────────────────
 *
 * Vérifié sur le CODE plutôt qu'avec un faux Stripe : ce qui doit être garanti
 * n'est pas qu'un scénario passe, c'est qu'il n'existe aucun chemin où la
 * ligne dit « prolongé » sans que Stripe l'ait fait.
 */
describe("la route n'écrit jamais avant que Stripe ait confirmé", () => {
  const source = readFileSync("app/api/cron/trial-guard/route.ts", "utf8");
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("l'appel Stripe précède physiquement l'écriture", () => {
    const stripeCall = code.indexOf("stripe.subscriptions.update");
    const write = code.indexOf("trial_extensions:");
    expect(stripeCall).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(-1);
    expect(stripeCall).toBeLessThan(write);
  });

  /*
   * ⚠ LA PREUVE EST EFFACÉE AVEC LA DATE. Après une prolongation, l'ancien
   * préavis portait sur un débit qui n'aura pas lieu. La garder ferait croire
   * au balayage qu'il a déjà prévenu pour la nouvelle date.
   */
  it("et la prolongation efface la preuve du préavis précédent", () => {
    expect(code).toContain("trial_notice_sent_for: null");
    expect(code).toContain("trial_notice_state: null");
  });

  it("l'annulation se fait en fin de période, pas séance tenante", () => {
    expect(code).toContain("cancel_at_period_end: true");
    expect(code).not.toMatch(/stripe\.subscriptions\.cancel\(/);
  });
});

/*
 * ── LE GARDE DOIT ÊTRE ARMÉ ─────────────────────────────────────────────
 * Une garantie qui n'est planifiée nulle part est une intention.
 */
describe("le garde est planifié", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    crons: Array<{ path: string; schedule: string }>;
  };

  it("⚠ figure dans vercel.json", () => {
    const paths = vercel.crons.map((c) => c.path);
    expect(paths).toContain("/api/cron/trial-guard");
  });

  /*
   * Après `trial-ending` : un préavis accepté aujourd'hui doit être enregistré
   * AVANT que le garde décide si elle a été prévenue. Dans l'autre ordre, il
   * prolongerait un essai que le balayage venait d'annoncer.
   */
  it("et tourne APRÈS le balayage d'envoi, jamais avant", () => {
    const hour = (path: string) => {
      const cron = vercel.crons.find((c) => c.path === path);
      if (!cron) throw new Error(`${path} absent de vercel.json`);
      return Number(cron.schedule.split(" ")[1]);
    };
    expect(hour("/api/cron/trial-guard")).toBeGreaterThan(
      hour("/api/cron/trial-ending")
    );
  });
});
