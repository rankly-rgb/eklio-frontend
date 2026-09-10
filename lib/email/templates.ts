import type { OutgoingEmail } from "@/lib/email/transport";
import { unsubscribeUrl } from "@/lib/email/state";
import { EMAIL_COLORS } from "@/lib/email/palette";
import { siteUrl } from "@/lib/site-url";

/*
 * Les trois e-mails transactionnels (§7).
 *
 * MÊME VOIX QUE LE PRODUIT : phrases courtes, anglais américain, pas de point
 * d'exclamation, pas de mot de hype, UNE seule action. Ce produit interdit à
 * ses utilisateurs l'urgence et la rareté dans leur propre publicité ; les
 * employer pour leur écrire serait incohérent.
 *
 * Le HTML est volontairement minimal — tableaux et styles en ligne, sans
 * police web ni image. Les clients e-mail cassent tout le reste, et un e-mail
 * qui arrive en texte lisible vaut mieux qu'un e-mail qui arrive cassé.
 *
 * Les couleurs viennent de `lib/email/palette.ts` : aucun client e-mail ne
 * résout `var(--ink)`, d'où le seul endroit du dépôt où les tokens sont
 * recopiés — et il dit pourquoi.
 */

const { ink: INK, ink2: INK_2, bg: BG, line: LINE } = EMAIL_COLORS;

function layout({
  heading,
  body,
  ctaLabel,
  ctaHref,
  userId,
}: {
  heading: string;
  body: string[];
  ctaLabel: string;
  ctaHref: string;
  /*
   * ⚠ NULL POUR UN ENVOI QU'ELLE A DEMANDÉ ELLE-MÊME, une fois. Le pied de
   * page propose de « ne plus recevoir ces e-mails » : sur un lien de reprise
   * réclamé à l'instant, il n'y a rien à désabonner, et l'offrir quand même
   * enverrait quelqu'un cliquer sur un lien qui ne peut rien faire — sans
   * compte, `unsubscribeUrl` n'a pas d'identité à porter.
   *
   * Ce n'est PAS une dérogation à la règle : les envois répétés (relances,
   * préavis, mois prêt) portent tous un identifiant et gardent le lien.
   */
  userId: string | null;
}): string {
  const unsubscribe = userId ? unsubscribeUrl(userId) : null;

  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:${BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 24px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td style="font:600 20px Georgia,serif;color:${INK};padding-bottom:28px;">Eklio</td></tr>
      <tr><td style="font:500 26px/1.2 Georgia,serif;color:${INK};padding-bottom:16px;">${escapeHtml(heading)}</td></tr>
      ${body
        .map(
          (paragraph) =>
            // Échappé ICI, et seulement ici : les mêmes chaînes servent la
            // version texte, où « &amp; » se lirait à l'écran.
            `<tr><td style="font:400 16px/1.6 -apple-system,Segoe UI,sans-serif;color:${INK_2};padding-bottom:14px;">${escapeHtml(paragraph)}</td></tr>`
        )
        .join("")}
      <tr><td style="padding:14px 0 28px;">
        <a href="${ctaHref}" style="display:inline-block;background:${INK};color:${BG};text-decoration:none;font:600 15px -apple-system,Segoe UI,sans-serif;padding:12px 26px;border-radius:999px;">${ctaLabel}</a>
      </td></tr>
      ${
        unsubscribe
          ? `<tr><td style="border-top:1px solid ${LINE};padding-top:18px;font:400 13px/1.6 -apple-system,Segoe UI,sans-serif;color:${INK_2};">
        <a href="${unsubscribe}" style="color:${INK_2};">Stop receiving these emails</a>
      </td></tr>`
          : ""
      }
    </table>
  </td></tr>
</table>
</body></html>`;
}

function plain({
  heading,
  body,
  ctaLabel,
  ctaHref,
  userId,
}: {
  heading: string;
  body: string[];
  ctaLabel: string;
  ctaHref: string;
  userId: string | null;
}): string {
  return [
    heading,
    "",
    ...body,
    "",
    `${ctaLabel}: ${ctaHref}`,
    ...(userId ? ["", `Stop receiving these emails: ${unsubscribeUrl(userId)}`] : []),
  ].join("\n");
}

function build(input: {
  to: string;
  subject: string;
  heading: string;
  body: string[];
  ctaLabel: string;
  ctaHref: string;
  userId: string | null;
}): OutgoingEmail {
  return {
    to: input.to,
    subject: input.subject,
    html: layout(input),
    text: plain(input),
  };
}

/**
 * Brief abandonné depuis 24 h, deux étapes ou plus franchies.
 *
 * Le lien reprend À L'ÉTAPE ENREGISTRÉE. Renvoyer sur la première question
 * ferait recommencer quelqu'un qui a déjà répondu — la raison même pour
 * laquelle il n'est pas revenu.
 */
export function briefAbandonedEmail(input: {
  to: string;
  userId: string;
  projectId: string;
  step: number;
  practiceName: string | null;
}): OutgoingEmail {
  const name = input.practiceName?.trim();

  return build({
    to: input.to,
    userId: input.userId,
    subject: "Your brief is waiting where you left it",
    heading: "You stopped at step " + input.step + " of 7.",
    body: [
      name
        ? `Everything you told us about ${name} is saved.`
        : "Everything you told us is saved.",
      "Picking it back up takes a few minutes. You can stop again at any step.",
    ],
    ctaLabel: "Pick up where I left off",
    ctaHref: `${siteUrl()}/app/briefs/${input.projectId}?step=${input.step}`,
  });
}

/** Kit généré, aucune direction retenue après 48 h. */
export function directionUnchosenEmail(input: {
  to: string;
  userId: string;
  brandKitId: string;
  directionNames: string[];
}): OutgoingEmail {
  return build({
    to: input.to,
    userId: input.userId,
    subject: "Three directions are still waiting",
    heading: "Your three directions are ready.",
    body: [
      input.directionNames.length === 3
        ? `${input.directionNames.join(", ")} — each one is a complete identity.`
        : "Each one is a complete identity.",
      "Choosing one takes a minute, and you can change your mind later.",
    ],
    ctaLabel: "See my directions",
    ctaHref: `${siteUrl()}/app/brand-kits/${input.brandKitId}/reveal`,
  });
}

/**
 * Premier du mois. Deux messages selon le droit, et c'est la seule
 * différence : abonné, tout le mois est ouvert ; sinon, un post est prêt et
 * onze attendent.
 */
export function monthReadyEmail(input: {
  to: string;
  userId: string;
  monthName: string;
  entitled: boolean;
  readyTitle: string | null;
}): OutgoingEmail {
  return build({
    to: input.to,
    userId: input.userId,
    subject: `${input.monthName} is ready in your brand`,
    heading: input.entitled
      ? `${input.monthName} is ready.`
      : `One post for ${input.monthName} is ready.`,
    body: input.entitled
      ? [
          "Twelve posts, four stories and an editorial calendar, in your colors.",
          input.readyTitle
            ? `First up: “${input.readyTitle}”.`
            : "They are waiting whenever you have a moment.",
        ]
      : [
          input.readyTitle
            ? `This month's post is “${input.readyTitle}”.`
            : "This month's post is ready.",
          "Eleven more are waiting behind Monthly Presence.",
        ],
    ctaLabel: "See this month",
    ctaHref: `${siteUrl()}/app/content`,
  });
}

/* ── LE PRÉAVIS D'AVANT-PRÉLÈVEMENT ────────────────────────────────────────
 *
 * ⚠ CE N'EST PAS UNE RELANCE, ET IL NE PASSE PAS PAR `build()`.
 *
 * `layout()` termine tous les autres e-mails par « Stop receiving these
 * emails ». Le mettre ici serait une faute : ce message est TRANSACTIONNEL —
 * il annonce un prélèvement à venir sur la carte de quelqu'un. Lui offrir de
 * s'en désinscrire reviendrait à lui offrir de ne plus être prévenue avant
 * d'être débitée, ce qui est exactement l'inverse de ce à quoi il sert. Le
 * plafond de 72 h et la déduplication par type de `lib/email/state.ts` sont
 * contournés pour la même raison, et le cron le dit là où il le fait.
 *
 * ── CE QU'IL DOIT CONTENIR, ET QUI L'EXIGE ───────────────────────────────
 *
 * La loi californienne sur la reconduction automatique (Bus. & Prof. Code
 * § 17602, amendée le 1er juillet 2025) impose, pour un essai gratuit de plus
 * de 31 jours, un préavis entre 3 et 21 jours avant la bascule, portant :
 *
 *   1. la durée et les conditions de la période reconduite  → « every month »
 *   2. le MONTANT                                            → $39
 *   3. la FRÉQUENCE                                          → monthly
 *   4. COMMENT ANNULER                                       → le lien, en CTA
 *
 * Les quatre sont dans le corps ci-dessous, et un test les y épingle. Aucun
 * n'est décoratif : ce produit n'a aucune primitive de remboursement
 * après-coup, donc ce message est la SEULE protection entre une praticienne
 * qui a oublié et $39 qu'on ne saura pas lui rendre.
 */
export function trialEndingEmail(input: {
  to: string;
  userId: string;
  /** Déjà formatée pour un lecteur américain — « December 8, 2026 ». */
  chargeDate: string;
  amount: string;
  interval: string;
}): OutgoingEmail {
  const heading = `Your included months end on ${input.chargeDate}.`;
  const body = [
    `Practice Suite came with three months of Monthly Presence. They end on ${input.chargeDate}.`,
    `On that day, Monthly Presence renews at ${input.amount} every ${input.interval}, charged to the card you paid with. It continues every ${input.interval} until you cancel.`,
    "If you would rather it stopped, cancel before that date and you will not be charged. Your brand kit is yours either way — it was a one-time purchase, and cancelling Monthly Presence takes nothing away from it.",
  ];
  const ctaLabel = "Manage or cancel";
  const ctaHref = `${siteUrl()}/app/settings#subscription`;

  return {
    to: input.to,
    subject: `Monthly Presence renews on ${input.chargeDate}`,
    html: billingLayout({ heading, body, ctaLabel, ctaHref }),
    text: [
      heading,
      "",
      ...body,
      "",
      `${ctaLabel}: ${ctaHref}`,
    ].join("\n"),
  };
}

/**
 * Le gabarit du préavis : `layout()` sans le pied de désinscription.
 *
 * Recopié plutôt que paramétré par un booléen `withUnsubscribe`. Un drapeau
 * se met à faux par accident ; deux fonctions dont une n'a jamais eu de lien
 * de désinscription ne peuvent pas en gagner un par une valeur par défaut mal
 * choisie. C'est la même raison qui fait que ce fichier ne partage pas
 * `build()` avec les relances.
 */
function billingLayout({
  heading,
  body,
  ctaLabel,
  ctaHref,
}: {
  heading: string;
  body: string[];
  ctaLabel: string;
  ctaHref: string;
}): string {
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:${BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 24px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td style="font:600 20px Georgia,serif;color:${INK};padding-bottom:28px;">Eklio</td></tr>
      <tr><td style="font:500 26px/1.2 Georgia,serif;color:${INK};padding-bottom:16px;">${escapeHtml(heading)}</td></tr>
      ${body
        .map(
          (paragraph) =>
            `<tr><td style="font:400 16px/1.6 -apple-system,Segoe UI,sans-serif;color:${INK_2};padding-bottom:14px;">${escapeHtml(paragraph)}</td></tr>`
        )
        .join("")}
      <tr><td style="padding:14px 0 28px;">
        <a href="${ctaHref}" style="display:inline-block;background:${INK};color:${BG};text-decoration:none;font:600 15px -apple-system,Segoe UI,sans-serif;padding:12px 26px;border-radius:999px;">${escapeHtml(ctaLabel)}</a>
      </td></tr>
      <tr><td style="border-top:1px solid ${LINE};padding-top:18px;font:400 13px/1.6 -apple-system,Segoe UI,sans-serif;color:${INK_2};">
        You are receiving this because you have an active subscription with Eklio.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/*
 * Le nom d'une practice arrive de l'utilisateur : il ne va pas brut dans du
 * HTML. Déclaré en `function` pour être hissé — `layout` l'appelle plus haut
 * dans le fichier.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


/*
 * ── "EMAIL ME A LINK TO COME BACK TO THIS" ──────────────────────────────
 *
 * The one email on the anonymous path, and she asks for it.
 *
 * ⚠ IT IS NOT AN ACCOUNT, AND IT IS NOT A SEQUENCE. The signed token lives in
 * a cookie; if the cookie survives, she resumes and never needs this. If it is
 * gone — a different phone, a cleared browser, a private tab — her brief is
 * unreachable forever, and this is the only thing that can bring it back.
 *
 * That is why the ask works where the wall did not: at the end of the brief
 * and again at the reveal she is looking at something she wants to keep, so
 * "don't lose this" is a reason she already has. It is the same address the
 * wall used to demand, obtained at the moment it is worth giving.
 *
 * ⚠ THE LINK CARRIES THE TOKEN. That makes this email as good as the cookie —
 * anyone holding it can open the brief. It is a brief, not a bank; the same
 * trade every magic link makes. What it must never carry is anything she
 * wrote: the subject and the body name her practice at most, and only when she
 * has given it a name herself.
 */
export function resumeBriefEmail(input: {
  to: string;
  token: string;
  practiceName: string | null;
  step: number;
}): OutgoingEmail {
  const name = input.practiceName?.trim();

  return build({
    to: input.to,
    // No account, so nothing to unsubscribe from. See `layout`.
    userId: null,
    subject: name ? `Your brand for ${name}` : "Your brand, saved",
    heading: "Here's the link back to your brief.",
    body: [
      name
        ? `Everything you've told us about ${name} is saved — you're at step ${input.step} of 7.`
        : `Everything you've told us is saved — you're at step ${input.step} of 7.`,
      "Open this on any device to pick it up. The link works for the next 30 days.",
    ],
    ctaLabel: "Open my brief",
    ctaHref: `${siteUrl()}/brief/resume?t=${encodeURIComponent(input.token)}`,
  });
}
