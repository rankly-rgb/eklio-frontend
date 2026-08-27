import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { setUnsubscribed, unsubscribeTokenValid } from "@/lib/email/state";
import { EMAIL_COLORS } from "@/lib/email/palette";

/*
 * Désinscription des e-mails.
 *
 * Le lien porte un identifiant utilisateur : SANS SIGNATURE, changer un
 * chiffre désinscrirait quelqu'un d'autre. Le jeton est un HMAC, comparé en
 * temps constant.
 *
 * La réponse est du HTML NU, pas du JSON : ce lien est cliqué depuis un
 * client e-mail, par quelqu'un qui veut lire une phrase, pas un objet. Elle
 * ne charge pas le bundle CSS de l'application — d'où les couleurs prises
 * dans `lib/email/palette.ts`, qui explique pourquoi elles y sont recopiées.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("u") ?? "";
  const token = request.nextUrl.searchParams.get("t") ?? "";

  if (!userId || !token || !unsubscribeTokenValid(userId, token)) {
    return page(
      "That link doesn't look right.",
      "Reply to any of our emails and we'll take you off the list by hand.",
      400
    );
  }

  const admin = createAdminClient();
  const { data: account } = await admin.auth.admin.getUserById(userId);
  if (!account?.user) {
    return page(
      "That link doesn't look right.",
      "Reply to any of our emails and we'll take you off the list by hand.",
      400
    );
  }

  await setUnsubscribed(admin, userId, account.user.user_metadata);

  return page(
    "You're off the list.",
    "We won't email you again about your brief, your directions, or your monthly content. Your account and your work are untouched.",
    200
  );
}

function page(heading: string, body: string, status: number): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Eklio</title></head>
<body style="margin:0;background:${EMAIL_COLORS.bg};color:${EMAIL_COLORS.ink};font:400 16px/1.6 -apple-system,Segoe UI,sans-serif;">
<main style="max-width:520px;margin:0 auto;padding:96px 24px;">
  <p style="font:600 20px Georgia,serif;margin:0 0 32px;">Eklio</p>
  <h1 style="font:500 34px/1.1 Georgia,serif;margin:0 0 16px;">${heading}</h1>
  <p style="color:${EMAIL_COLORS.ink2};margin:0;">${body}</p>
</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}
