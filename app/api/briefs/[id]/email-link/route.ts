import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, readJson, serverError } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { resolveBriefCaller } from "@/lib/anon/session";
import { clientIp, ipBucket } from "@/lib/anon/token";
import { resumeBriefEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/transport";
import { track } from "@/lib/analytics";
import { loadBrief } from "@/lib/data/brief";
import { resumeStep } from "@/lib/brief/flow";

/*
 * ── "EMAIL ME A LINK TO COME BACK TO THIS" ──────────────────────────────
 *
 * The only place the anonymous path asks for an email address, and the reason
 * it works where the wall did not: by the time she is asked, she is looking at
 * something she wants to keep. It is the same address the signup wall used to
 * demand, obtained at the moment it is worth giving.
 *
 * ⚠ IT CREATES NO ACCOUNT AND SUBSCRIBES HER TO NOTHING. One email, sent
 * because she pressed a button. The address is not stored: it goes to the
 * transport and is gone. Keeping it would turn a favour into a list, and this
 * product has not asked her about a list.
 */
export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().trim().email("That email address doesn't look right."),
});

/** One address per brief per hour: a link, not a way to mail strangers. */
const EMAIL_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 };

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/briefs/[id]/email-link">
) {
  const caller = await resolveBriefCaller();

  /*
   * Only an anonymous caller needs this. A signed-in brief is already reachable
   * from her account, and sending a bearer link for it would be handing out a
   * second, weaker key to something that already has a proper lock.
   */
  if (caller.kind !== "anon") {
    return NextResponse.json(
      { error: "This brief is already saved to your account." },
      { status: 409 }
    );
  }

  const { id } = await ctx.params;
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) {
    return badRequest(body.error.issues[0]?.message ?? "That could not be sent.");
  }

  const verdict = rateLimit(
    `email-link:${ipBucket(clientIp(request))}`,
    EMAIL_LIMIT
  );
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: "We've sent a few of those already. Check your inbox, including spam." },
      { status: 429, headers: { "retry-after": String(verdict.retryAfterSeconds) } }
    );
  }

  try {
    /*
     * ⚠ READ THROUGH RLS, WITH HER OWN TOKEN. This is what proves the brief is
     * the one she is holding: a caller who names someone else's id reads
     * nothing, and no email is sent. Without it, this route would mail a
     * working link for any brief id to any address.
     */
    const bundle = await loadBrief(caller.supabase, id, null);
    if (!bundle) {
      return NextResponse.json({ error: "We can't find that brief." }, { status: 404 });
    }

    const outcome = await sendEmail(
      resumeBriefEmail({
        to: body.data.email,
        token: caller.token,
        practiceName: bundle.brief.practice_name,
        step: resumeStep(bundle.brief),
      })
    );

    /*
     * ⚠ THE ADDRESS IS NEVER LOGGED, and neither is the token. `delivered` and
     * nothing else — the same rule the analytics module has carried since it
     * was written.
     */
    track("email_sent", { kind: "resume_brief", delivered: outcome.delivered });

    if (!outcome.delivered) {
      return NextResponse.json(
        { error: "We couldn't send that just now. Try again in a moment." },
        { status: 502 }
      );
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    return serverError("POST /api/briefs/[id]/email-link", error);
  }
}
