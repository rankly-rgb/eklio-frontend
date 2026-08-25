import { CopyButton } from "@/components/kit/copy-button";
import { EthicsDisclaimer } from "@/components/ethics-disclaimer";
import { PALETTE_ENTRIES, type Palette } from "@/lib/ai/directions";
import { optionLabel, PAGE_OPTIONS } from "@/lib/brief/steps";
import { KIT_TIER_RULES, type KitTier } from "@/lib/kit/tiers";
import type { PageCopy, StoredKit } from "@/lib/kit/content";

/*
 * La page de kit : le livrable tel que le praticien le lit, l'imprime et le
 * fait circuler.
 *
 * Composant serveur — la seule interactivité est la copie au presse-papiers
 * (`CopyButton`) et le dépliage des pages, confié à `<details>` natif plutôt
 * qu'à un état React : rien à hydrater, et les sections restent ouvrables
 * sans JavaScript.
 *
 * Le disclaimer déontologique (Lot 0) ferme le document. Il n'est pas
 * optionnel : c'est le garde-fou de niveau 3, requis sur tout livrable
 * publiable.
 */

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-rule pt-8">
      <div className="flex flex-col gap-1">
        <h2 className="label-mono text-ink-muted">{title}</h2>
        {hint && <p className="text-sm text-ink-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/* Les paragraphes arrivent séparés par des sauts de ligne, pas en HTML. */
function Prose({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph !== "")
        .map((paragraph, index) => (
          <p key={index} className="whitespace-pre-wrap leading-relaxed">
            {paragraph}
          </p>
        ))}
    </div>
  );
}

function PaletteGrid({ palette }: { palette: Partial<Palette> }) {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-5">
      {PALETTE_ENTRIES.map(({ key, label }) => {
        const hex = palette[key];
        if (!hex) return null;
        return (
          <div key={key} className="flex flex-col gap-2">
            <span
              aria-hidden="true"
              className="block h-20 w-full rounded border border-rule"
              style={{ backgroundColor: hex }}
            />
            <span className="label-mono text-ink-muted">{label}</span>
            {/* Copie au clic : le libellé du bouton EST la valeur hex. */}
            <CopyButton
              value={hex}
              label={hex.toUpperCase()}
              copiedLabel="Copied"
              className="self-start !text-ink"
            />
          </div>
        );
      })}
    </div>
  );
}

function PageSectionList({ page }: { page: PageCopy }) {
  return (
    <details className="border-b border-rule last:border-b-0">
      <summary className="flex cursor-pointer items-baseline gap-3 py-4 marker:text-ink-muted">
        <span className="text-lg font-medium">
          {optionLabel(PAGE_OPTIONS, page.page) ?? page.page}
        </span>
        <span className="font-mono text-xs text-ink-muted">
          {page.sections.length} section
          {page.sections.length > 1 ? "s" : ""}
        </span>
      </summary>
      <div className="flex flex-col gap-6 pb-6">
        {page.sections.map((section, index) => (
          <article key={index} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4">
              <h4 className="font-display text-xl leading-tight">
                {section.heading}
              </h4>
              <CopyButton
                value={`${section.heading}\n\n${section.body}`}
                label="Copy section"
                className="shrink-0"
              />
            </div>
            <Prose text={section.body} className="text-ink-soft" />
          </article>
        ))}
      </div>
    </details>
  );
}

export function BrandKitView({
  practiceName,
  directionName,
  palette,
  headingFont,
  bodyFont,
  kit,
  tier,
  websitePrompt,
}: {
  practiceName: string;
  directionName: string;
  palette: Partial<Palette>;
  headingFont: string;
  bodyFont: string;
  kit: StoredKit;
  /*
   * Le tier LIVRÉ, lu sur `brand_kits.tier` par la page. Il arrive en prop
   * plutôt que depuis `kit.tier` : la colonne fait foi depuis le Lot 4, le
   * champ du jsonb n'est plus qu'un héritage du Lot 3.
   */
  tier: KitTier;
  websitePrompt: string;
}) {
  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-xs tracking-[0.08em] text-ink-muted">
          Brand kit · {directionName} · {KIT_TIER_RULES[tier].label}
        </p>
        <h1 className="font-display text-[40px] leading-tight">
          {practiceName}
        </h1>
        <p className="max-w-[65ch] text-lg leading-relaxed text-ink-soft">
          {kit.positioning_statement}
        </p>
      </header>

      <Section title="Brand story">
        <Prose text={kit.brand_story} className="max-w-[65ch] text-ink-soft" />
      </Section>

      <Section title="Palette" hint="Click any value to copy it.">
        <PaletteGrid palette={palette} />
      </Section>

      <Section
        title="Typography"
        /*
         * Les polices ne sont PAS chargées à l'exécution : `next/font` exige un
         * nom connu à la compilation, et le modèle choisit le sien à la
         * génération. On affiche donc le nom en texte, et on le dit.
         */
        hint="Both are real, available typefaces. We show the names — your site builder loads them."
      >
        <dl className="flex flex-col gap-3">
          {[
            { label: "headings", value: headingFont },
            { label: "body", value: bodyFont },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-wrap items-baseline gap-3">
              <dt className="label-mono w-24 shrink-0 text-ink-muted">
                {label}
              </dt>
              <dd className="text-lg">{value}</dd>
              <CopyButton value={value} />
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Voice & tone">
        <div className="flex flex-wrap gap-2">
          {kit.voice_and_tone.adjectives.map((adjective) => (
            <span
              key={adjective}
              className="rounded-full bg-accent-surface px-3 py-1 font-mono text-xs text-ink-soft"
            >
              {adjective}
            </span>
          ))}
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h3 className="label-mono text-ink-muted">Sounds like you</h3>
            <ul className="flex flex-col gap-3">
              {kit.voice_and_tone.do_examples.map((example, index) => (
                <li
                  key={index}
                  className="border-l-2 border-rule-strong pl-4 text-ink-soft"
                >
                  {example}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="label-mono text-ink-muted">Never write this</h3>
            <ul className="flex flex-col gap-3">
              {kit.voice_and_tone.dont_examples.map((example, index) => (
                <li
                  key={index}
                  className="border-l-2 border-danger pl-4 text-ink-soft"
                >
                  {example}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section
        title="Website copy"
        hint="Finished copy for the pages you asked for. Open a page to read it, copy a section as you build."
      >
        <div className="flex flex-col">
          {kit.website_copy.map((page) => (
            <PageSectionList key={page.page} page={page} />
          ))}
        </div>
      </Section>

      {websitePrompt.trim() !== "" && (
        <Section
          title="Website prompt"
          hint="One prompt, four builders. Paste it into Squarespace, Lovable, Framer or Webflow — the per-platform notes are inside."
        >
          <div className="flex flex-col gap-3">
            <CopyButton
              value={websitePrompt}
              label="Copy the prompt"
              copiedLabel="Copied to your clipboard"
              className="self-start rounded border border-rule px-4 py-2 !text-ink no-underline"
            />
            <pre className="max-h-[420px] overflow-auto rounded bg-paper-raised p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink-soft">
              {websitePrompt}
            </pre>
          </div>
        </Section>
      )}

      {kit.social_templates.length > 0 && (
        <Section
          title="Social templates"
          hint="Specs to build once and reuse. Your designer — or your design tool — can work straight from these."
        >
          <div className="flex flex-col">
            {kit.social_templates.map((template, index) => (
              <div
                key={index}
                className="flex flex-col gap-3 border-b border-rule py-6 last:border-b-0"
              >
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-medium">{template.name}</h3>
                  <p className="text-sm text-ink-muted">{template.purpose}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="label-mono text-ink-muted">Layout</span>
                  <Prose text={template.layout} className="text-sm text-ink-soft" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="label-mono text-ink-muted">
                    Example caption
                  </span>
                  <div className="flex items-start gap-3">
                    <Prose
                      text={template.example_caption}
                      className="min-w-0 flex-1 text-sm text-ink-soft"
                    />
                    <CopyButton
                      value={template.example_caption}
                      className="shrink-0"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Garde-fou de niveau 3 — requis au pied de tout livrable publiable. */}
      <footer className="border-t border-rule pt-8">
        <EthicsDisclaimer className="max-w-[65ch]" />
      </footer>
    </article>
  );
}
