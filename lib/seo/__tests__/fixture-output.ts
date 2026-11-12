import type { WriterOutput } from "@/lib/seo/output";

/*
 * ⚠ FIXTURE — PAS DU PRODUIT. Une sortie de rédacteur fabriquée en code pour
 * éprouver les contrôles et le pipeline sans appeler de modèle. Elle n'a aucun
 * sens clinique : elle a la FORME qu'il faut (longueur, réponse d'abord, requête
 * placée), et un vocabulaire tiré d'une graine pour que deux fixtures ne se
 * ressemblent pas.
 */

const VOCAB = [
  "steady", "pacing", "structure", "attention", "memory", "body", "breath", "notice", "slow", "plan",
  "question", "conversation", "rhythm", "practice", "skills", "safety", "ground", "routine", "season",
  "window", "anchor", "detail", "choice", "language", "evening", "morning", "kitchen", "letter", "garden",
  "river", "stone", "ladder", "lantern", "harbor", "meadow", "compass", "thread", "pebble", "orchard",
  "canvas", "violin", "maple", "copper", "linen", "cedar", "willow", "amber", "quartz", "tulip", "falcon",
];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function sentence(next: () => number, words: number): string {
  const w = Array.from({ length: words }, () => VOCAB[Math.floor(next() * VOCAB.length)]);
  return w[0][0].toUpperCase() + w[0].slice(1) + " " + w.slice(1).join(" ") + ".";
}

export function fixtureOutput(input: {
  query: string;
  seed: number;
  bodyWords: number;
  faqCount?: number;
  title?: string;
  meta?: string;
}): WriterOutput {
  const next = rng(input.seed);
  /*
   * Des mots propres à la GRAINE pour les titres et les questions : deux
   * fixtures ne posent jamais la même question (la gate « question répétée »
   * les prendrait, à raison, pour deux pages qui se concurrencent).
   */
  let counter = 0;
  const own = () => {
    let n = input.seed * 1000 + counter++;
    let w = "";
    do {
      w = String.fromCharCode(97 + (n % 26)) + w;
      n = Math.floor(n / 26);
    } while (n > 0);
    return `${w}ex`;
  };
  const headings = [
    `What is the ${own()} ${own()}`,
    `How does the ${own()} ${own()} work`,
    `Who is the ${own()} ${own()} for`,
    `When does the ${own()} ${own()} matter`,
  ];
  const perSection = Math.floor((input.bodyWords - 40) / headings.length);
  const sections = headings.map((heading) => {
    const opener = `In short, ${heading.toLowerCase()} is described here in plain terms.`;
    const paragraphs: string[] = [opener];
    let count = opener.split(" ").length;
    while (count < perSection) {
      const s = sentence(next, 12);
      paragraphs.push(s);
      count += 12;
    }
    // Cinq phrases par paragraphe : un paragraphe reste sous la borne du schéma.
    const grouped: string[] = [];
    for (let i = 0; i < paragraphs.length; i += 5) grouped.push(paragraphs.slice(i, i + 5).join(" "));
    return { heading, paragraphs: grouped, bullets_intro: "", bullets: [], subsections: [] };
  });
  return {
    title: input.title ?? input.query,
    meta_description:
      input.meta ??
      `A plain explanation of ${input.query}: what it involves, how sessions usually run, and what to ask before you start working with a therapist.`.slice(0, 155).padEnd(150, "."),
    h1: input.query,
    intro: `${input.query} is explained on this page in plain words. ${sentence(next, 20)} ${sentence(next, 6)}`,
    sections,
    faq: Array.from({ length: input.faqCount ?? 4 }, () => {
      const a = own();
      const b = own();
      return { question: `Why ${a} and ${b}?`, answer: `The ${a} and ${b} answer is short. ${sentence(next, 10)}` };
    }),
  };
}
