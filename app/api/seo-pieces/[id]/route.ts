import { authenticate, badRequest, json, notFound, readJson, serverError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { applyPieceAction, editFindings, pieceActionSchema } from "@/lib/seo/actions";
import { readLinkablePieces, readPiece } from "@/lib/seo/read";
import { exportOpen } from "@/lib/seo/screen";
import { bylineFromStored, exportHtml, exportMarkdown, internalLinksFor } from "@/lib/seo/derive";
import { licenceMentionFor } from "@/lib/content/review";
import { loadHome } from "@/lib/data/home";

/*
 * POST /api/seo-pieces/[id] — les quatre gestes de la praticienne sur une pièce :
 * `approve` (relu en tant qu'autrice), `edit` (le corps, avant l'approbation),
 * `export` (copier, Markdown, HTML — seulement une pièce relue), `publish` (où).
 *
 * Tout passe par le client de SESSION : la base décide (RLS, GRANT par colonne,
 * transitions, garde éthique). Le client admin ne sert qu'à LIRE les phrases
 * bannies pour lui dire laquelle, avant d'écrire : la RPC n'est pas ouverte au
 * navigateur, et le texte contrôlé est le sien.
 */
export const runtime = "nodejs";

export async function POST(request: Request, ctx: RouteContext<"/api/seo-pieces/[id]">) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;
  const { supabase, userId } = auth.session;

  const { id } = await ctx.params;
  const parsed = pieceActionSchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "That change could not be saved.");
  const action = parsed.data;

  try {
    const piece = await readPiece(supabase, id);
    if (!piece) return notFound();

    if (action.action === "edit") {
      const admin = createAdminClient();
      const findings = await editFindings(action.body_md, {
        async bannedPhrases(text) {
          const { data, error } = await admin.rpc("usp_banned_phrases_check", { p_text: text });
          if (error) throw new Error(error.message);
          return (data ?? []) as string[];
        },
        async ethicsBlocks(text) {
          const { data, error } = await supabase.rpc("ethics_scan", { p_text: text });
          if (error) throw new Error(error.message);
          return z
            .array(z.object({ rule_id: z.string(), severity: z.string(), excerpt: z.string() }))
            .parse(data ?? [])
            .filter((v) => v.severity === "block")
            .map((v) => ({ rule: v.rule_id, excerpt: v.excerpt }));
        },
      });
      if (findings.length > 0) {
        return json({ error: "Some phrases need rewording before this can be saved.", findings }, { status: 400 });
      }
    }

    if (action.action === "export" && !exportOpen(piece.status)) {
      return json({ error: "Confirm your review first: export opens once you have read it as its author." }, { status: 409 });
    }

    const outcome = await applyPieceAction(supabase, id, action, piece.status);
    if (!outcome.ok) return json({ error: outcome.message, findings: outcome.findings ?? [] }, { status: outcome.status });

    if (action.action === "export" && action.format !== "copy") {
      const home = await loadHome(supabase, userId);
      const mention = home.brandKit ? await licenceMentionFor(supabase, home.brandKit.projectId) : null;
      const links = internalLinksFor(piece.id, await readLinkablePieces(supabase), null);
      const exportable = {
        kind: piece.kind,
        title: piece.title ?? "",
        meta: piece.meta_description ?? "",
        slug: piece.slug ?? "",
        h1: piece.h1 ?? "",
        bodyMd: piece.body_md ?? "",
        faq: piece.faq ?? [],
        schemaJsonLd: piece.schema_jsonld ?? {},
        internalLinks: links,
        byline: bylineFromStored(piece.schema_jsonld, mention) ?? "",
      };
      const content = action.format === "markdown" ? exportMarkdown(exportable) : exportHtml(exportable);
      return json({ ok: true, filename: `${piece.slug}.${action.format === "markdown" ? "md" : "html"}`, content });
    }
    return json({ ok: true });
  } catch (error) {
    return serverError("POST /api/seo-pieces/[id]", error);
  }
}
