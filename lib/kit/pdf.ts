/*
 * Le moteur PDF 1.4 à la main (polices de base Helvetica/Times, sans
 * dépendance) derrière la feuille d'installation exportable
 * (`renderMarkdownPdf`, plus bas).
 *
 * Le kit de marque en PDF — Lot 5 — a sa propre implémentation désormais :
 * `lib/kit/pdf/brand-guide.ts`, pdf-lib + fontkit, ses polices de marque
 * réellement embarquées. Ce moteur-ci reste exactement pour ce que
 * `renderMarkdownPdf` en fait : une page de texte, aucune police de marque à
 * embarquer, aucune raison de payer pdf-lib pour ça.
 */

const PAGE_WIDTH = 595.28; // A4 en points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type Font = "title" | "body" | "mono";

const FONT_RESOURCE: Record<Font, string> = {
  title: "/F1",
  body: "/F2",
  mono: "/F3",
};

/*
 * Largeurs moyennes par police, en millièmes de cadratin. Les métriques
 * exactes des polices de base demanderaient une table AFM entière ; ces
 * moyennes suffisent à décider où couper une ligne, ce qui est le seul usage
 * qu'on en fait.
 */
const AVERAGE_WIDTH: Record<Font, number> = {
  title: 0.5,
  body: 0.5,
  mono: 0.6,
};

/** Échappe une chaîne pour un littéral PDF, et retire ce qui n'est pas latin-1. */
function escapeText(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/·/g, "-")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/** Coupe un paragraphe à la largeur disponible, sans couper de mot. */
function wrap(text: string, font: Font, size: number, width: number): string[] {
  const maxChars = Math.max(8, Math.floor(width / (size * AVERAGE_WIDTH[font])));
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxChars) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

/** Un flux de contenu par page, construit en coordonnées PDF (origine en bas). */
class PageBuilder {
  private readonly parts: string[] = [];
  private cursor = PAGE_HEIGHT - MARGIN;

  get isEmpty(): boolean {
    return this.parts.length === 0;
  }

  get remaining(): number {
    return this.cursor - MARGIN;
  }

  space(points: number): void {
    this.cursor -= points;
  }

  text(
    content: string,
    { font, size, leading, gray = 0 }: { font: Font; size: number; leading: number; gray?: number }
  ): void {
    for (const line of wrap(content, font, size, CONTENT_WIDTH)) {
      this.cursor -= leading;
      if (line === "") continue;
      this.parts.push(
        `BT ${gray} g ${FONT_RESOURCE[font]} ${size} Tf 1 0 0 1 ${MARGIN.toFixed(2)} ${this.cursor.toFixed(2)} Tm (${escapeText(line)}) Tj ET`
      );
    }
  }

  rule(): void {
    this.cursor -= 10;
    this.parts.push(
      `0.85 g ${MARGIN} ${this.cursor.toFixed(2)} ${CONTENT_WIDTH} 0.7 re f`
    );
    this.cursor -= 6;
  }

  build(): string {
    return this.parts.join("\n");
  }
}

/** Compose le fichier PDF à partir des flux de page. */
function assemble(pages: string[]): Uint8Array {
  const objects: string[] = [];
  const pageCount = pages.length;

  // 1 catalogue, 2 pages, 3..(2+n) pages, puis les contenus, puis 3 polices.
  const pageIds = pages.map((_, index) => 3 + index);
  const contentIds = pages.map((_, index) => 3 + pageCount + index);
  const fontIds = [3 + pageCount * 2, 4 + pageCount * 2, 5 + pageCount * 2];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Count ${pageCount} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`
  );

  pages.forEach((_, index) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 ${fontIds[0]} 0 R /F2 ${fontIds[1]} 0 R /F3 ${fontIds[2]} 0 R >> >> ` +
        `/Contents ${contentIds[index]} 0 R >>`
    );
  });

  pages.forEach((stream) => {
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  // latin-1 : les littéraux ont déjà été réduits à cette plage par escapeText.
  const bytes = new Uint8Array(pdf.length);
  for (let index = 0; index < pdf.length; index += 1) {
    bytes[index] = pdf.charCodeAt(index) & 0xff;
  }
  return bytes;
}

/*
 * ── La feuille d'installation, en PDF ────────────────────────────────────
 *
 * L'éditeur de site propose « Download as PDF ». La source est le `md` que
 * renvoie `site_output_get(…, 'md')` : c'est la MÊME sortie que celle qu'on
 * copie, dans un autre format. Rien n'est recomposé ici — le §8 du contrat est
 * explicite, la sortie dérivée ne se réécrit pas côté client.
 *
 * On réutilise le `PageBuilder` ci-dessus plutôt que d'ajouter un moteur : le
 * markdown que la base émet est du texte, des titres, des listes et des
 * citations. Le rendu ci-dessous couvre exactement ça, et laisse passer le
 * reste en paragraphe — un markdown inconnu se lit encore, il ne disparaît pas.
 */
export function renderMarkdownPdf(title: string, markdown: string): Uint8Array {
  const pages: PageBuilder[] = [];
  let page = new PageBuilder();
  pages.push(page);

  const ensure = (needed: number) => {
    if (page.remaining < needed) {
      page = new PageBuilder();
      pages.push(page);
    }
  };

  page.text(title, { font: "title", size: 22, leading: 28 });
  page.rule();
  page.space(8);

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    ensure(60);

    if (line.trim() === "") {
      page.space(8);
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      const depth = line.match(/^#+/)![0].length;
      const text = line.replace(/^#+\s*/, "");
      ensure(48);
      page.space(6);
      page.text(text, {
        font: "title",
        size: depth === 1 ? 18 : depth === 2 ? 15 : 13,
        leading: depth === 1 ? 24 : 20,
      });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      page.rule();
      continue;
    }
    if (/^>\s?/.test(line)) {
      page.text(line.replace(/^>\s?/, ""), {
        font: "mono",
        size: 9,
        leading: 14,
        gray: 0.45,
      });
      continue;
    }
    if (/^\s*([-*+]|\d+\.)\s/.test(line)) {
      page.text(line.replace(/^\s*[-*+]\s/, "- "), {
        font: "body",
        size: 10.5,
        leading: 15,
      });
      continue;
    }
    page.text(line, { font: "body", size: 10.5, leading: 15 });
  }

  return assemble(pages.filter((entry) => !entry.isEmpty).map((entry) => entry.build()));
}
