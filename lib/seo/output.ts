import { z } from "zod";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  CE QUE LE RÉDACTEUR REND — UNE STRUCTURE, PAS UNE PAGE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le modèle ne rend PAS du Markdown libre : il rend des sections (titre H2,
 * paragraphes, puces, sous-sections H3) et une FAQ. Le Markdown, le HTML, le
 * slug, le JSON-LD, la signature et les liens internes sont calculés EN CODE
 * (`derive.ts`). Trois raisons :
 *
 *   - « réponse d'abord » se vérifie sur une structure : le premier paragraphe
 *     sous chaque H2 est connu, pas deviné par un parseur ;
 *   - un seul H1 est garanti par construction : le corps n'en porte jamais ;
 *   - rien de ce qui engage la praticienne (sa licence, son nom dans les
 *     données structurées) ne passe par le modèle.
 *
 * Le schéma Zod est la validation (étape 1 des contrôles) ; le schéma JSON
 * envoyé au fournisseur en sortie stricte en est la transcription, et un test
 * les tient alignés.
 */

const text = z.string().trim().min(1);

export const sectionSchema = z.object({
  heading: text.max(120),
  paragraphs: z.array(text.max(2000)).min(1).max(8),
  bullets: z.array(text.max(400)).max(8),
  subsections: z
    .array(z.object({ heading: text.max(120), paragraphs: z.array(text.max(2000)).min(1).max(6) }))
    .max(4),
});

export const writerOutputSchema = z.object({
  title: text.max(120),
  meta_description: text.max(320),
  h1: text.max(160),
  intro: text.max(2000),
  sections: z.array(sectionSchema).min(3).max(10),
  faq: z.array(z.object({ question: text.max(300), answer: text.max(1500) })).min(1).max(10),
});

export type WriterOutput = z.infer<typeof writerOutputSchema>;
export type Section = z.infer<typeof sectionSchema>;

/** La transcription en schéma JSON strict (`additionalProperties: false` partout). */
export function writerOutputJsonSchema(): Record<string, unknown> {
  const str = { type: "string" };
  const strings = { type: "array", items: str };
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "meta_description", "h1", "intro", "sections", "faq"],
    properties: {
      title: str,
      meta_description: str,
      h1: str,
      intro: str,
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["heading", "paragraphs", "bullets", "subsections"],
          properties: {
            heading: str,
            paragraphs: strings,
            bullets: strings,
            subsections: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["heading", "paragraphs"],
                properties: { heading: str, paragraphs: strings },
              },
            },
          },
        },
      },
      faq: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "answer"],
          properties: { question: str, answer: str },
        },
      },
    },
  };
}

/**
 * Le corps en Markdown, sans H1. L'intro d'abord, puis chaque section :
 * `## titre`, ses paragraphes, ses puces, ses `### sous-sections`.
 *
 * ⚠ LES TITRES SONT NETTOYÉS DE TOUT `#` : un titre « # Why EMDR » rendu tel
 * quel deviendrait un second H1.
 */
export function assembleBody(output: WriterOutput): string {
  const clean = (heading: string) => heading.replace(/^#+\s*/, "").trim();
  const blocks: string[] = [output.intro.trim()];
  for (const section of output.sections) {
    blocks.push(`## ${clean(section.heading)}`);
    for (const p of section.paragraphs) blocks.push(p.trim());
    if (section.bullets.length > 0) blocks.push(section.bullets.map((b) => `- ${b.trim()}`).join("\n"));
    for (const sub of section.subsections) {
      blocks.push(`### ${clean(sub.heading)}`);
      for (const p of sub.paragraphs) blocks.push(p.trim());
    }
  }
  return blocks.join("\n\n") + "\n";
}

/**
 * Le chemin inverse, pour un corps modifié par la praticienne : les sections H2
 * et leur premier paragraphe. Sert aux contrôles qui ne lisent que le Markdown.
 */
export function sectionsOf(bodyMd: string): Array<{ heading: string; firstParagraph: string }> {
  const out: Array<{ heading: string; firstParagraph: string }> = [];
  const lines = bodyMd.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^##\s+(.+)$/.exec(lines[i]);
    if (!m) continue;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j += 1;
    const para: string[] = [];
    while (j < lines.length && lines[j].trim() !== "" && !/^#{1,6}\s/.test(lines[j])) {
      para.push(lines[j].trim());
      j += 1;
    }
    out.push({ heading: m[1].trim(), firstParagraph: para.join(" ") });
  }
  return out;
}

/** Le premier paragraphe du corps — l'intro. */
export function firstParagraphOf(bodyMd: string): string {
  const para: string[] = [];
  for (const line of bodyMd.split(/\r?\n/)) {
    if (line.trim() === "") {
      if (para.length > 0) break;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      if (para.length > 0) break;
      continue;
    }
    para.push(line.trim());
  }
  return para.join(" ");
}

/** Les mots du corps, Markdown retiré (liens réduits à leur texte). */
export function wordCount(bodyMd: string): number {
  const plain = bodyMd
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^-\s+/gm, "")
    .replace(/[*_`>]/g, " ");
  return plain.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}
