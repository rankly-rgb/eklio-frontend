import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canUseMonthlyPresence } from "@/lib/billing/entitlements";
import { loadHome } from "@/lib/data/home";
import { licenceMentionFor } from "@/lib/content/review";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { MonoLabel } from "@/components/ui/mono-label";
import { MarkdownPreview } from "@/components/pages/markdown-preview";
import { CopyPanel, PublishForm, ReviewPanel } from "@/components/pages/piece-actions";
import { KIND_LABEL } from "@/lib/seo/kinds";
import { readLinkablePieces, readPiece } from "@/lib/seo/read";
import { STATUS_TEXT, exportOpen, monthLabel, searchLine } from "@/lib/seo/screen";
import { builderLabel, bylineFromStored, faqJsonLd, internalLinksFor, jsonLdScripts } from "@/lib/seo/derive";

/*
 * /app/pages/[id] — une pièce : l'aperçu rendu, puis ce qu'elle en fait.
 *
 *   needs_review  relire (et modifier le texte), puis confirmer « en tant
 *                 qu'autrice » — l'export n'existe pas avant ;
 *   approved +    les blocs copiables un par un, les exports Markdown et HTML,
 *                 la checklist de SON constructeur, et « Where did you publish it? ».
 *
 * Abonnement terminé : tout reste lisible, rien ne s'écrit (la base refuse).
 */
export default async function WebsitePagePage({ params }: PageProps<"/app/pages/[id]">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/pages");

  const { id } = await params;
  const piece = await readPiece(supabase, id);
  if (!piece) notFound();

  const [entitled, linkable, home] = await Promise.all([
    canUseMonthlyPresence(supabase),
    readLinkablePieces(supabase),
    loadHome(supabase, user.id),
  ]);
  const mention = home.brandKit ? await licenceMentionFor(supabase, home.brandKit.projectId) : null;
  const byline = bylineFromStored(piece.schema_jsonld, mention);
  const links = internalLinksFor(piece.id, linkable, null);
  const status = piece.status as keyof typeof STATUS_TEXT;
  const open = exportOpen(piece.status);
  const faq = piece.faq ?? [];
  const steps = piece.checklist;
  const builder = home.brandKit ? await builderOf(supabase, home.brandKit.projectId) : "generic";

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-6 max-md:px-[var(--gutter-sm)]">
      <Breadcrumb items={[{ label: "Website pages", href: `/app/pages?month=${piece.month}` }, { label: monthLabel(piece.month) }]} />

      <div className="mt-4 flex flex-col gap-2">
        <MonoLabel tracking="12">{KIND_LABEL[piece.kind]} · {STATUS_TEXT[status]}</MonoLabel>
        <p className="text-helper text-ink-2">{searchLine(piece.primaryQuery)}</p>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <article aria-label="Preview" className="flex max-w-[720px] flex-col gap-4">
          <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink">{piece.h1}</h1>
          {byline ? <p className="text-helper italic text-ink-2">{byline}</p> : null}
          <MarkdownPreview markdown={piece.body_md ?? ""} />
          {faq.length > 0 ? (
            <section aria-labelledby="faq-heading" className="mt-6 flex flex-col gap-4">
              <h2 id="faq-heading" className="font-display text-h3 font-medium text-ink">Frequently asked questions</h2>
              {faq.map((f, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <h3 className="text-body font-semibold text-ink">{f.question}</h3>
                  <p className="text-body leading-prose text-ink-2">{f.answer}</p>
                </div>
              ))}
            </section>
          ) : null}
        </article>

        <aside className="flex flex-col gap-6">
          {status === "needs_review" && entitled ? <ReviewPanel id={piece.id} body={piece.body_md ?? ""} /> : null}
          {status === "needs_review" && !entitled ? (
            <p className="text-helper leading-prose text-ink-2">Your Monthly Presence has ended, so this page can no longer be reviewed.</p>
          ) : null}

          {open ? (
            <CopyPanel
              id={piece.id}
              markExported={entitled && status === "approved"}
              blocks={{
                title: piece.title ?? "",
                meta: piece.meta_description ?? "",
                slug: piece.slug ?? "",
                body: `# ${piece.h1}\n\n${byline ? `*${byline}*\n\n` : ""}${piece.body_md ?? ""}`,
                faq: faq.map((f) => `### ${f.question}\n\n${f.answer}`).join("\n\n"),
                jsonLd: jsonLdScripts([piece.schema_jsonld ?? {}, faqJsonLd(faq)]),
              }}
            />
          ) : null}

          {open && links.length > 0 ? (
            <section aria-labelledby="links-heading" className="flex flex-col gap-3 rounded-card border border-line p-6">
              <h2 id="links-heading" className="font-display text-h3 font-medium text-ink">Link your pages</h2>
              <ul className="flex flex-col gap-2 text-helper text-ink-2">
                {links.map((l) => (
                  <li key={l.pieceId}>
                    <span className="text-ink">{l.title}</span> — {l.published ? l.href : `${l.href} (once you publish it)`}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {open && steps.length > 0 ? (
            <section aria-labelledby="steps-heading" className="flex flex-col gap-3 rounded-card border border-line p-6">
              <h2 id="steps-heading" className="font-display text-h3 font-medium text-ink">
                Steps for {builderLabel(builder)}
              </h2>
              <ol className="ml-5 flex list-decimal flex-col gap-2 text-helper leading-prose text-ink-2">
                {steps.map((s, i) => (
                  <li key={i}>
                    <span className="font-medium text-ink">{s.step}.</span> {s.detail}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {open && entitled ? (
            <section className="rounded-card border border-line p-6">
              <PublishForm id={piece.id} current={piece.published_url} primary={status !== "approved"} />
            </section>
          ) : null}
          {piece.published_url ? (
            <p className="text-helper text-ink-2">
              Published at{" "}
              <a href={piece.published_url} className="underline" rel="noreferrer" target="_blank">
                {piece.published_url}
              </a>
            </p>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

async function builderOf(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string): Promise<string> {
  const { data } = await supabase.from("project_briefs").select("builder_target_id").eq("project_id", projectId).maybeSingle();
  return data?.builder_target_id ?? "generic";
}
