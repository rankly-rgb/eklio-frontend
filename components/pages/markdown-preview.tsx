import { Fragment, type ReactNode } from "react";

/*
 * L'aperçu d'une pièce, rendu en éléments React — jamais en HTML injecté. Le
 * sous-ensemble est celui que le code assemble (`assembleBody`) : titres H2/H3,
 * paragraphes, puces, liens http(s), gras. Un `# ` collé par la praticienne
 * s'affiche en H2, comme l'export le rendra.
 */

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      m[1] ? (
        <a key={`${keyBase}-${i}`} href={m[2]} className="underline decoration-line underline-offset-2 hover:decoration-ink" rel="noreferrer" target="_blank">
          {m[1]}
        </a>
      ) : (
        <strong key={`${keyBase}-${i}`} className="font-semibold">
          {m[3]}
        </strong>
      )
    );
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MarkdownPreview({ markdown }: { markdown: string }) {
  const blocks = markdown.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, idx) => {
        const key = `b${idx}`;
        const heading = /^(#{1,6})\s+(.+)$/.exec(block);
        if (heading && !block.includes("\n")) {
          return heading[1].length <= 2 ? (
            <h2 key={key} className="mt-4 font-display text-h3 font-medium leading-tight text-ink">
              {inline(heading[2], key)}
            </h2>
          ) : (
            <h3 key={key} className="mt-2 text-body font-semibold text-ink">
              {inline(heading[2], key)}
            </h3>
          );
        }
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={key} className="ml-5 list-disc text-body leading-prose text-ink-2">
              {lines.map((l, j) => (
                <li key={`${key}-${j}`}>{inline(l.replace(/^\s*[-*]\s+/, ""), `${key}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={key} className="text-body leading-prose text-ink-2">
            {lines.map((l, j) => (
              <Fragment key={`${key}-${j}`}>
                {j > 0 ? " " : null}
                {inline(l, `${key}-${j}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
