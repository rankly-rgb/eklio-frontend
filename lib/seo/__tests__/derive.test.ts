import { describe, expect, it } from "vitest";
import {
  bylineFor,
  bylineFromStored,
  checklistFor,
  exportHtml,
  exportMarkdown,
  faqJsonLd,
  inlineHtml,
  internalLinksFor,
  markdownToHtml,
  primaryJsonLd,
  type ExportPiece,
} from "@/lib/seo/derive";

const PRACTITIONER = {
  name: "Dana Whitfield",
  credential: "LMFT",
  licenceMention: "LMFT 123456",
  title: "Licensed Marriage and Family Therapist",
  doctorate: false,
};

describe("le HTML propre", () => {
  it("échappe tout, puis rend seulement liens http(s) et gras", () => {
    expect(inlineHtml('<script>x</script> **bold** [NIMH](https://www.nimh.nih.gov/news)')).toBe(
      '&lt;script&gt;x&lt;/script&gt; <strong>bold</strong> <a href="https://www.nimh.nih.gov/news">NIMH</a>'
    );
    expect(inlineHtml("[x](javascript:alert(1))")).not.toContain("<a");
  });
  it("titres, paragraphes, listes — et jamais de H1 dans le corps", () => {
    const html = markdownToHtml("Intro line.\n\n# Pasted title\n\n## Section\n\nText.\n\n- one\n- two\n\n### Sub");
    expect(html).toContain("<p>Intro line.</p>");
    expect(html).toContain("<h2>Pasted title</h2>");
    expect(html).not.toContain("<h1>");
    expect(html).toContain("<ul>\n  <li>one</li>\n  <li>two</li>\n</ul>");
    expect(html).toContain("<h3>Sub</h3>");
  });
});

describe("le JSON-LD, calculé", () => {
  it("Article avec auteur Person pour un article", () => {
    const ld = primaryJsonLd({ kind: "article", title: "T", meta: "M", practitioner: PRACTITIONER, topic: "EMDR therapy", place: null, url: null });
    expect(ld["@type"]).toBe("Article");
    expect(ld.author).toEqual({ "@type": "Person", name: "Dana Whitfield", jobTitle: "Licensed Marriage and Family Therapist" });
  });
  it("jamais de LocalBusiness ni d'adresse pour une page locale", () => {
    const ld = primaryJsonLd({ kind: "local_page", title: "T", meta: "M", practitioner: PRACTITIONER, topic: null, place: "Oakland, CA", url: null });
    expect(ld["@type"]).toBe("WebPage");
    expect(JSON.stringify(ld)).not.toMatch(/LocalBusiness|address|PostalAddress/);
  });
  it("FAQPage depuis la FAQ", () => {
    const ld = faqJsonLd([{ question: "Q?", answer: "A." }]);
    expect(ld["@type"]).toBe("FAQPage");
    expect((ld.mainEntity as unknown[]).length).toBe(1);
  });
  it("la signature porte la mention de licence", () => {
    expect(bylineFor(PRACTITIONER)).toBe("By Dana Whitfield, Licensed Marriage and Family Therapist, LMFT 123456");
  });
});

describe("liens internes : ses autres pièces approuvées ou publiées", () => {
  const pieces = [
    { id: "a", title: "Published", slug: "published", status: "published", published_url: "https://her.site/emdr" },
    { id: "b", title: "Approved", slug: "approved-page", status: "approved", published_url: null },
    { id: "c", title: "In review", slug: "review", status: "needs_review", published_url: null },
    { id: "d", title: "Self", slug: "self", status: "published", published_url: "https://her.site/self" },
  ];
  it("publiées avec leur URL, approuvées avec un chemin suggéré, jamais une pièce en relecture ni elle-même", () => {
    const links = internalLinksFor("d", pieces, "https://her.site/");
    expect(links).toEqual([
      { pieceId: "a", title: "Published", href: "https://her.site/emdr", published: true },
      { pieceId: "b", title: "Approved", href: "https://her.site/approved-page", published: false },
    ]);
  });
});

describe("la checklist suit son constructeur", () => {
  it.each(["squarespace", "webflow", "framer", "wix", "lovable", "v0", "generic"])("%s", (builder) => {
    const steps = checklistFor(builder, { kind: "local_page", slug: "emdr-therapy-oakland-ca" });
    expect(steps.length).toBeGreaterThanOrEqual(8);
    expect(steps.some((s) => s.detail.includes("/emdr-therapy-oakland-ca"))).toBe(true);
  });
  it("un constructeur inconnu retombe sur le générique", () => {
    expect(checklistFor("dreamweaver", { kind: "article", slug: "x" })).toEqual(checklistFor("generic", { kind: "article", slug: "x" }));
  });
  it("Squarespace et Webflow n'ont pas les mêmes gestes", () => {
    const sq = checklistFor("squarespace", { kind: "article", slug: "x" });
    const wf = checklistFor("webflow", { kind: "article", slug: "x" });
    expect(sq.map((s) => s.detail)).not.toEqual(wf.map((s) => s.detail));
  });
});

describe("les exports", () => {
  const piece: ExportPiece = {
    kind: "article",
    title: "How EMDR therapy works",
    meta: "M",
    slug: "emdr-therapy-works",
    h1: "How EMDR therapy works",
    bodyMd: "Intro.\n\n## What is it?\n\nIt is a therapy.",
    faq: [{ question: "Q?", answer: "A." }],
    schemaJsonLd: { "@context": "https://schema.org", "@type": "Article" },
    internalLinks: [
      { pieceId: "a", title: "Published", href: "https://her.site/emdr", published: true },
      { pieceId: "b", title: "Not yet", href: "/not-yet", published: false },
    ],
    byline: "By Dana Whitfield, LMFT 123456",
  };
  it("Markdown : un H1, la signature, la FAQ, seulement les liens publiés", () => {
    const md = exportMarkdown(piece);
    expect(md.match(/^# /gm)).toHaveLength(1);
    expect(md).toContain("*By Dana Whitfield, LMFT 123456*");
    expect(md).toContain("### Q?");
    expect(md).toContain("[Published](https://her.site/emdr)");
    expect(md).not.toContain("/not-yet");
  });
  it("HTML : un H1, et les deux blocs JSON-LD", () => {
    const html = exportHtml(piece);
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html.match(/application\/ld\+json/g)).toHaveLength(2);
    expect(html).toContain('"@type": "FAQPage"');
  });
});

describe("la ligne d'autrice et le Person (session 3)", () => {
  it("le titre lisible paraît dans la signature ET en jobTitle", () => {
    const psy = { name: "Ines Alvarez", credential: null, licenceMention: "PSY 28456", title: "Licensed Psychologist", doctorate: false };
    expect(bylineFor(psy)).toBe("By Ines Alvarez, Licensed Psychologist, PSY 28456");
    const ld = primaryJsonLd({ kind: "article", title: "T", meta: "M", practitioner: psy, topic: null, place: null, url: null });
    expect(ld.author).toEqual({ "@type": "Person", name: "Ines Alvarez", jobTitle: "Licensed Psychologist" });
  });
  it("sans titre au catalogue, le sigle reste le jobTitle", () => {
    const ld = primaryJsonLd({ kind: "article", title: "T", meta: "M", practitioner: { ...PRACTITIONER, title: null }, topic: null, place: null, url: null });
    expect((ld.author as { jobTitle?: string }).jobTitle).toBe("LMFT");
  });
  it("une pièce déjà écrite signe avec le nom et le titre figés dans son JSON-LD", () => {
    const stored = { author: { "@type": "Person", name: "Diego Ramirez", jobTitle: "Licensed Marriage and Family Therapist" } };
    expect(bylineFromStored(stored, "LMFT 98765")).toBe("By Diego Ramirez, Licensed Marriage and Family Therapist, LMFT 98765");
    // les pièces des sessions 1–2 n'avaient qu'un sigle (ou rien) : pas de titre doublé
    expect(bylineFromStored({ author: { name: "Dana Whitfield", jobTitle: "LMFT" } }, "LMFT 123456")).toBe("By Dana Whitfield, LMFT 123456");
    expect(bylineFromStored({}, "LMFT 1")).toBeNull();
  });
});
