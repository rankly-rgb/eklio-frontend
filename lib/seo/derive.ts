import type { SeoKind } from "@/lib/seo/kinds";
import type { ChecklistStep, InternalLink } from "@/lib/seo/db";
import type { Practitioner } from "@/lib/seo/context";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LES DÉRIVÉS — CALCULÉS EN CODE, JAMAIS GÉNÉRÉS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le HTML propre, le JSON-LD, la signature, les liens internes et la checklist
 * de publication ne passent PAS par le modèle : ils se calculent depuis la
 * pièce et le brief. Rien de ce qui engage la praticienne — son nom dans les
 * données structurées, sa licence, l'adresse d'une de ses pages — ne peut donc
 * être inventé.
 */

/* ── Le HTML : un sous-ensemble de Markdown, échappé ─────────────────── */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Le texte en ligne : tout est échappé, puis seuls `[texte](https://…)` et
 * `**gras**` redeviennent des balises. Un lien dont l'URL n'est pas http(s)
 * reste du texte : un `javascript:` collé dans le corps ne devient jamais un lien.
 */
export function inlineHtml(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label: string, url: string) => `<a href="${url}">${label}</a>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return out;
}

/**
 * Le corps en HTML propre : titres, paragraphes, listes, liens, gras. Pas de
 * classe, pas de style, pas d'attribut inventé — chaque constructeur applique
 * sa propre typographie.
 */
export function markdownToHtml(md: string): string {
  const html: string[] = [];
  const blocks = md.replace(/\r\n/g, "\n").split(/\n{2,}/);
  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;
    const heading = /^(#{1,6})\s+(.+)$/.exec(block);
    if (heading && !block.includes("\n")) {
      // ⚠ Jamais de H1 dans le corps : un « # » collé par la praticienne descend en H2.
      const level = Math.max(2, heading[1].length);
      html.push(`<h${level}>${inlineHtml(heading[2].trim())}</h${level}>`);
      continue;
    }
    const lines = block.split("\n");
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      html.push(`<ul>\n${lines.map((l) => `  <li>${inlineHtml(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("\n")}\n</ul>`);
      continue;
    }
    html.push(`<p>${inlineHtml(lines.map((l) => l.trim()).join(" "))}</p>`);
  }
  return html.join("\n");
}

/* ── La signature ─────────────────────────────────────────────────────── */

/**
 * « By Dana Whitfield, LMFT 123456 » — le nom, puis la mention de licence telle
 * que `licenceMention` la compose selon les règles de son État (F12, F73).
 */
export function bylineFor(p: Practitioner): string {
  return `By ${p.name}, ${p.licenceMention}`;
}

/* ── Le JSON-LD ───────────────────────────────────────────────────────── */

export type JsonLdInput = {
  kind: SeoKind;
  title: string;
  meta: string;
  practitioner: Practitioner;
  topic: string | null;
  /** Pour une page locale : « Oakland, CA », depuis le brief. */
  place: string | null;
  url: string | null;
};

/**
 * L'entité principale. `Article` pour un article, `WebPage` pour une page
 * locale — et ⚠ JAMAIS `LocalBusiness` : le brief n'a pas d'adresse, et un
 * `LocalBusiness` sans adresse vraie est une fiche que Google rejette ou, pire,
 * une adresse inventée.
 */
export function primaryJsonLd(i: JsonLdInput): Record<string, unknown> {
  const author: Record<string, unknown> = {
    "@type": "Person",
    name: i.practitioner.name,
    ...(i.practitioner.credential ? { jobTitle: i.practitioner.credential } : {}),
  };
  return {
    "@context": "https://schema.org",
    "@type": i.kind === "article" ? "Article" : "WebPage",
    ...(i.kind === "article" ? { headline: i.title } : { name: i.title }),
    description: i.meta,
    inLanguage: "en-US",
    author,
    ...(i.topic ? { about: { "@type": "Thing", name: i.topic } } : {}),
    ...(i.place ? { contentLocation: { "@type": "Place", name: i.place } } : {}),
    ...(i.url ? { url: i.url, mainEntityOfPage: i.url } : {}),
  };
}

export function faqJsonLd(faq: Array<{ question: string; answer: string }>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function jsonLdScripts(blocks: Array<Record<string, unknown>>): string {
  return blocks
    .map((b) => `<script type="application/ld+json">\n${JSON.stringify(b, null, 2).replace(/</g, "\\u003c")}\n</script>`)
    .join("\n");
}

/* ── Les liens internes : ses autres pièces ───────────────────────────── */

export type LinkablePiece = {
  id: string;
  title: string | null;
  slug: string | null;
  status: string;
  published_url: string | null;
};

/**
 * Ses pièces publiées d'abord (avec l'URL qu'ELLE a déclarée), puis celles
 * qu'elle a approuvées sans les publier encore (avec le chemin suggéré par le
 * slug, sur son site s'il est connu). Jamais une pièce en relecture ni en
 * quarantaine : on ne propose pas un lien vers une page qui n'existera peut-être pas.
 */
export function internalLinksFor(
  selfId: string | null,
  pieces: readonly LinkablePiece[],
  siteUrl: string | null,
  max = 5
): InternalLink[] {
  const base = siteUrl ? siteUrl.replace(/\/+$/, "") : "";
  const published = pieces.filter((p) => p.id !== selfId && p.status === "published" && p.published_url && p.title);
  const approved = pieces.filter(
    (p) => p.id !== selfId && (p.status === "approved" || p.status === "exported") && p.slug && p.title
  );
  return [
    ...published.map((p) => ({ pieceId: p.id, title: p.title!, href: p.published_url!, published: true })),
    ...approved.map((p) => ({ pieceId: p.id, title: p.title!, href: `${base}/${p.slug}`, published: false })),
  ].slice(0, max);
}

/* ── La checklist de publication, par constructeur ───────────────────── */

type BuilderGuide = {
  label: string;
  newPage: string;
  seo: string;
  code: string;
};

/**
 * Les gestes de chaque constructeur de `builder_targets`. Les constructeurs
 * « à prompt » (Lovable, v0, Framer AI, autre) reçoivent une consigne à coller ;
 * les autres, des menus.
 */
const BUILDERS: Record<string, BuilderGuide> = {
  squarespace: {
    label: "Squarespace",
    newPage: "In the Pages panel, click + and add a blank page (or a blog post, for an article).",
    seo: "Open the page settings (gear icon) › SEO: paste the title and the description. Under General, set the URL slug.",
    code: "Page settings › Advanced › Page Header Code Injection: paste the structured data. Code injection is not available on every Squarespace plan; if you do not see it, skip this step.",
  },
  webflow: {
    label: "Webflow",
    newPage: "In the Pages panel, create a new static page (or a CMS item, for an article).",
    seo: "Open the page settings: set the slug, then paste the title tag and meta description under SEO Settings.",
    code: "Page settings › Custom code › Inside <head> tag: paste the structured data.",
  },
  framer: {
    label: "Framer",
    newPage: "Add a new page from the Pages panel (or a CMS item, for an article).",
    seo: "Open the page settings: set the path, then paste the title and description under SEO.",
    code: "Page settings › Custom Code › End of <head> tag: paste the structured data.",
  },
  wix: {
    label: "Wix",
    newPage: "Pages & Menu › + Add Page (or a new blog post, for an article).",
    seo: "Page's SEO basics: set the URL slug, title tag and meta description.",
    code: "SEO › Advanced SEO › Structured data markup: paste each structured data block.",
  },
  lovable: {
    label: "Lovable",
    newPage: "Ask Lovable for a new page at the slug below, and paste the HTML export into the chat as its content.",
    seo: "Ask it to set the page <title> and meta description to the text below, exactly.",
    code: "Ask it to add the structured data below inside the page <head>, unchanged.",
  },
  v0: {
    label: "v0",
    newPage: "Ask v0 for a new route at the slug below, and paste the HTML export as its content.",
    seo: "Ask it to set the page metadata (title and description) to the text below, exactly.",
    code: "Ask it to add the structured data below in a <script type=\"application/ld+json\"> tag on that page.",
  },
  generic: {
    label: "your site builder",
    newPage: "Create a new page (or blog post, for an article) on your site.",
    seo: "In the page's SEO settings, set the URL slug, the page title and the meta description.",
    code: "If your builder lets you add code to the page head, paste the structured data there.",
  },
};

export function builderLabel(builder: string): string {
  return (BUILDERS[builder] ?? BUILDERS.generic).label;
}

export function checklistFor(builder: string, piece: { kind: SeoKind; slug: string }): ChecklistStep[] {
  const b = BUILDERS[builder] ?? BUILDERS.generic;
  return [
    { step: "Read it as its author", detail: "Read the whole text. Change anything that does not sound like you, then confirm you have reviewed it." },
    { step: "Create the page", detail: b.newPage },
    { step: "Set the address", detail: `Use /${piece.slug} as the page address.` },
    { step: "Add the title and description", detail: b.seo },
    { step: "Paste the text", detail: "Copy the text block (or the HTML export) into the page body. Keep the headings as headings." },
    { step: "Add the questions", detail: "Paste the FAQ at the end of the page, each question as a small heading." },
    { step: "Add the structured data", detail: b.code },
    { step: "Link your pages", detail: "Add the suggested links to your other pages where they fit naturally." },
    { step: "Publish, then tell us where", detail: "Publish the page, then paste its address below so your next pages can link to it." },
  ];
}

/* ── Les exports ──────────────────────────────────────────────────────── */

export type ExportPiece = {
  kind: SeoKind;
  title: string;
  meta: string;
  slug: string;
  h1: string;
  bodyMd: string;
  faq: Array<{ question: string; answer: string }>;
  schemaJsonLd: Record<string, unknown>;
  internalLinks: InternalLink[];
  byline: string;
};

export function exportMarkdown(p: ExportPiece): string {
  const related = p.internalLinks.filter((l) => l.published);
  return [
    "---",
    `title: ${JSON.stringify(p.title)}`,
    `description: ${JSON.stringify(p.meta)}`,
    `slug: ${p.slug}`,
    "---",
    "",
    `# ${p.h1}`,
    "",
    `*${p.byline}*`,
    "",
    p.bodyMd.trim(),
    "",
    "## Frequently asked questions",
    "",
    ...p.faq.flatMap((f) => [`### ${f.question}`, "", f.answer, ""]),
    ...(related.length > 0 ? ["## Related pages", "", ...related.map((l) => `- [${l.title}](${l.href})`), ""] : []),
  ].join("\n");
}

export function exportHtml(p: ExportPiece): string {
  const related = p.internalLinks.filter((l) => l.published);
  return [
    `<!-- ${p.title} — ${p.meta} -->`,
    "<article>",
    `<h1>${inlineHtml(p.h1)}</h1>`,
    `<p><em>${inlineHtml(p.byline)}</em></p>`,
    markdownToHtml(p.bodyMd),
    "<h2>Frequently asked questions</h2>",
    ...p.faq.flatMap((f) => [`<h3>${inlineHtml(f.question)}</h3>`, `<p>${inlineHtml(f.answer)}</p>`]),
    ...(related.length > 0
      ? ["<h2>Related pages</h2>", "<ul>", ...related.map((l) => `  <li><a href="${escapeHtml(l.href)}">${inlineHtml(l.title)}</a></li>`), "</ul>"]
      : []),
    "</article>",
    jsonLdScripts([p.schemaJsonLd, faqJsonLd(p.faq)]),
  ].join("\n");
}
