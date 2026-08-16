import { CopyButton } from "@/components/kit/copy-button";
import { EthicsDisclaimer } from "@/components/ethics-disclaimer";
import { optionLabel } from "@/lib/brief/steps";
import type { KitContent } from "@/lib/ai/kit";
import type { DirectionPalette, DirectionTypography } from "@/types/database";

const PALETTE_ORDER: { key: keyof DirectionPalette; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "light_neutral", label: "Light neutral" },
  { key: "dark_neutral", label: "Dark neutral" },
];

/** RGB is derived here rather than stored, so the two can never drift apart. */
function hexToRgb(hex: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return "";
  const int = parseInt(match[1], 16);
  return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`;
}

export function BrandKitView({
  practiceName,
  directionName,
  palette,
  typography,
  content,
  exportPrompt,
}: {
  practiceName: string;
  directionName: string;
  palette: DirectionPalette;
  typography: DirectionTypography;
  content: KitContent;
  exportPrompt: string;
}) {
  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce">
          Brand kit · {directionName}
        </p>
        <h1 className="font-display text-4xl leading-tight">{practiceName}</h1>
      </header>

      <Section title="Positioning">
        <p className="text-lg leading-relaxed">{content.positioning_statement}</p>
      </Section>

      <Section title="Brand story">
        <Prose text={content.brand_story} />
      </Section>

      <Section title="Palette">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {PALETTE_ORDER.map(({ key, label }) => {
            const hex = palette[key];
            return (
              <div key={key} className="flex flex-col gap-2">
                <span
                  aria-hidden="true"
                  className="block h-20 w-full rounded border border-noir/10"
                  style={{ backgroundColor: hex }}
                />
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-gris-fonce">
                  {label}
                </span>
                <span className="font-mono text-xs">{hex}</span>
                <span className="font-mono text-[0.65rem] text-gris-fonce">
                  rgb({hexToRgb(hex)})
                </span>
                <CopyButton value={hex} label="Copy hex" className="self-start" />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Typography">
        {/* Font names are shown as text: Next.js needs typefaces known at build
            time, so a generated font is never loaded at runtime. */}
        <dl className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <dt className="font-mono text-xs uppercase tracking-[0.15em] text-gris-fonce">
              Headings
            </dt>
            <dd className="text-lg">{typography.headings}</dd>
            <CopyButton value={typography.headings} />
          </div>
          <div className="flex items-baseline gap-3">
            <dt className="font-mono text-xs uppercase tracking-[0.15em] text-gris-fonce">
              Body
            </dt>
            <dd className="text-lg">{typography.body}</dd>
            <CopyButton value={typography.body} />
          </div>
        </dl>
        <p className="text-sm text-gris-fonce">
          Both are real, existing typefaces. Your site builder loads them — we
          show the names so you can set them there.
        </p>
      </Section>

      <Section title="Voice & tone">
        <div className="flex flex-wrap gap-2">
          {content.voice_and_tone.adjectives.map((adjective) => (
            <span
              key={adjective}
              className="rounded-full border border-noir/25 px-3 py-1 font-mono text-xs"
            >
              {adjective}
            </span>
          ))}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-gris-fonce">
              Sounds like you
            </span>
            <ul className="flex flex-col gap-2 text-sm leading-relaxed">
              {content.voice_and_tone.do_examples.map((example) => (
                <li key={example}>{example}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-gris-fonce">
              Does not
            </span>
            <ul className="flex flex-col gap-2 text-sm leading-relaxed text-gris-fonce">
              {content.voice_and_tone.dont_examples.map((example) => (
                <li key={example}>{example}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Website copy">
        <div className="flex flex-col gap-3">
          {content.website_copy.map((page) => (
            <details
              key={page.page}
              className="rounded-lg border border-noir/15 bg-cream-light p-5"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-mono text-sm">
                <span>{optionLabel("pages", page.page)}</span>
                <span className="text-xs text-gris-fonce">
                  {page.sections.length}{" "}
                  {page.sections.length === 1 ? "section" : "sections"}
                </span>
              </summary>

              <div className="mt-5 flex flex-col gap-6">
                {page.sections.map((section) => (
                  <div key={section.heading} className="flex flex-col gap-2">
                    <h3 className="font-display text-xl leading-tight">
                      {section.heading}
                    </h3>
                    <Prose text={section.body} />
                    <CopyButton
                      value={`${section.heading}\n\n${section.body}`}
                      label="Copy section"
                      className="self-start"
                    />
                  </div>
                ))}

                <CopyButton
                  value={page.sections
                    .map((s) => `${s.heading}\n\n${s.body}`)
                    .join("\n\n---\n\n")}
                  label="Copy the whole page"
                  className="self-start"
                />
              </div>
            </details>
          ))}
        </div>
      </Section>

      {content.social_templates.length > 0 && (
        <Section title="Social templates">
          <div className="grid gap-4 md:grid-cols-2">
            {content.social_templates.map((template) => (
              <article
                key={template.name}
                className="flex flex-col gap-3 rounded-lg border border-noir/15 bg-cream-light p-5"
              >
                <h3 className="font-display text-xl leading-tight">
                  {template.name}
                </h3>
                <p className="text-sm text-gris-fonce">{template.purpose}</p>

                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs uppercase tracking-[0.15em] text-gris-fonce">
                    Layout
                  </span>
                  <p className="text-sm leading-relaxed">{template.layout}</p>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs uppercase tracking-[0.15em] text-gris-fonce">
                    Example caption
                  </span>
                  <p className="text-sm leading-relaxed">
                    {template.example_caption}
                  </p>
                  <CopyButton
                    value={template.example_caption}
                    className="self-start"
                  />
                </div>
              </article>
            ))}
          </div>
        </Section>
      )}

      <Section title="Site builder prompt">
        <p className="text-sm text-gris-fonce">
          One prompt, written to work in Squarespace, Lovable, Framer and
          Webflow. Paste it whole — the per-platform notes are at the end.
        </p>
        <CopyButton
          value={exportPrompt}
          label="Copy the prompt"
          copiedLabel="Copied — paste it into your builder"
          className="self-start"
        />
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-noir/15 bg-cream-light p-5 text-sm leading-relaxed">
          {exportPrompt}
        </pre>
      </Section>

      {/*
        TODO(export): PDF export. Not trivial here — it needs either a headless
        browser at request time or a client-side renderer, and neither belongs
        in this pass. The seam: render this component to a dedicated
        print-stylesheet route (/app/projects/[id]/kit/print) and let the
        browser's own "Save as PDF" carry it, before reaching for a service.
      */}

      <EthicsDisclaimer />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b border-noir/10 pb-2 font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Preserves the paragraph breaks the model wrote. */
function Prose({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed">
      {text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
    </div>
  );
}
