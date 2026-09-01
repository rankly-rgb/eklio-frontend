import type { OutgoingEmail } from "@/lib/email/transport";
import { unsubscribeUrl } from "@/lib/email/state";
import { EMAIL_COLORS } from "@/lib/email/palette";

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
  userId: string;
}): string {
  const unsubscribe = unsubscribeUrl(userId);

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
      <tr><td style="border-top:1px solid ${LINE};padding-top:18px;font:400 13px/1.6 -apple-system,Segoe UI,sans-serif;color:${INK_2};">
        <a href="${unsubscribe}" style="color:${INK_2};">Stop receiving these emails</a>
      </td></tr>
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
  userId: string;
}): string {
  return [
    heading,
    "",
    ...body,
    "",
    `${ctaLabel}: ${ctaHref}`,
    "",
    `Stop receiving these emails: ${unsubscribeUrl(userId)}`,
  ].join("\n");
}

function build(input: {
  to: string;
  subject: string;
  heading: string;
  body: string[];
  ctaLabel: string;
  ctaHref: string;
  userId: string;
}): OutgoingEmail {
  return {
    to: input.to,
    subject: input.subject,
    html: layout(input),
    text: plain(input),
  };
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
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
