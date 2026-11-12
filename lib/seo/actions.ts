import { z } from "zod";
import { seoDb, seoPatch } from "@/lib/seo/db";
import type { Finding } from "@/lib/seo/finding";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  CE QUE LA PRATICIENNE FAIT D'UNE PIÈCE — ET CE QUE LA BASE EN DIT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Quatre gestes : relire et approuver, modifier le texte (avant l'approbation),
 * exporter (copier, télécharger), déclarer où elle l'a publiée. Chacun est un
 * UPDATE par le client de SESSION : la base tient le reste —
 *   - GRANT par colonne (status, published_url, body_md seulement) ;
 *   - RLS : la sienne, et un abonnement en cours ;
 *   - `seo_pieces_transition_gate` : les seules transitions permises ;
 *   - `seo_pieces_ethics_gate` : phrases bannies et Ethics Guard sur tout texte
 *     enregistré, y compris le corps qu'elle vient de modifier.
 *
 * ⚠ LE CONTRÔLE AVANT ENREGISTREMENT EST POUR ELLE, PAS POUR LA BASE. Une
 * modification passe d'abord par `usp_banned_phrases_check` et `ethics_scan`
 * pour lui dire QUELLE phrase pose problème ; la base refuserait de toute façon,
 * mais avec un message d'erreur, pas une phrase à réécrire.
 */

export const pieceActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), reviewed: z.literal(true) }),
  z.object({ action: z.literal("edit"), body_md: z.string().trim().min(200).max(40000) }),
  z.object({ action: z.literal("export"), format: z.enum(["copy", "markdown", "html"]) }),
  z.object({
    action: z.literal("publish"),
    url: z
      .string()
      .trim()
      .max(500)
      .refine((u) => /^https?:\/\/[^\s/$.?#][^\s]*$/.test(u), "Paste the full address of the page, starting with https://"),
  }),
]);

export type PieceAction = z.infer<typeof pieceActionSchema>;

type Outcome = { ok: true } | { ok: false; status: 400 | 404 | 409; message: string; findings?: Finding[] };

export type TextChecks = {
  bannedPhrases(text: string): Promise<string[]>;
  ethicsBlocks(text: string): Promise<Array<{ rule: string; excerpt: string }>>;
};

/** Les deux systèmes éthiques, sur un corps modifié, avant l'enregistrement. */
export async function editFindings(text: string, checks: TextChecks): Promise<Finding[]> {
  const [banned, ethics] = await Promise.all([checks.bannedPhrases(text), checks.ethicsBlocks(text)]);
  return [
    ...banned.map((p) => ({ check: "banned_phrase", detail: `“${p}” is a phrase almost every therapist site uses. Say it in your own words.` })),
    ...ethics.map((e) => ({ check: `ethics.${e.rule}`, detail: `“${e.excerpt}” can put a license at risk in an ad. Describe the work instead.` })),
  ];
}

/**
 * L'UPDATE, et la traduction de ce que la base répond. Zéro ligne touchée veut
 * dire : pas la sienne, ou plus d'abonnement (RLS) — 404, pour ne pas confirmer
 * l'existence de la pièce d'une autre.
 */
export async function applyPieceAction(
  sessionClient: unknown,
  id: string,
  action: Exclude<PieceAction, { action: "export" }> | { action: "export" },
  currentStatus: string
): Promise<Outcome> {
  const db = seoDb(sessionClient);
  let patch;
  switch (action.action) {
    case "approve":
      if (currentStatus !== "needs_review") return { ok: false, status: 409, message: "This page has already been reviewed." };
      patch = seoPatch("seo_pieces", { status: "approved" });
      break;
    case "edit":
      if (currentStatus !== "needs_review") {
        return { ok: false, status: 409, message: "The text can only be changed before you confirm your review." };
      }
      patch = seoPatch("seo_pieces", { body_md: action.body_md });
      break;
    case "export":
      // Copier ou télécharger une pièce relue la marque « copiée », une fois.
      if (currentStatus !== "approved") return { ok: true };
      patch = seoPatch("seo_pieces", { status: "exported" });
      break;
    case "publish":
      if (!["approved", "exported", "published"].includes(currentStatus)) {
        return { ok: false, status: 409, message: "Review the page before marking it as published." };
      }
      patch = seoPatch("seo_pieces", { status: "published", published_url: action.url });
      break;
  }
  const { data, error } = await db.from("seo_pieces").update(patch).eq("id", id).select("id");
  if (error) {
    if (error.code === "23514") return { ok: false, status: 400, message: friendlyDbMessage(error.message) };
    throw new Error(`seo_pieces update: ${error.message}`);
  }
  if (!data || (data as unknown[]).length === 0) {
    return { ok: false, status: 404, message: "This page is not available to change." };
  }
  return { ok: true };
}

function friendlyDbMessage(message: string): string {
  if (/Advertising ethics/i.test(message)) return "A phrase in the text can put a license at risk in an ad. Describe the work instead.";
  if (/Banned phrase/i.test(message)) return "The text uses a phrase almost every therapist site uses. Say it in your own words.";
  return "That change could not be saved.";
}
