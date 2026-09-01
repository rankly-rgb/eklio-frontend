"use client";

import { MonoLabel } from "@/components/ui/mono-label";
import { SectionHeader } from "@/components/ui/section-header";
import { CopyBlockRow, CopyButton, CopyChip } from "@/components/site/copy-chip";
import { StalenessBanner } from "@/components/site/staleness-banner";
import {
  builderOf,
  copyAllText,
  groupCopyBlocks,
  leadLine,
} from "@/lib/site/output";
import type { SiteEditorState } from "@/components/site/use-site-editor";
import type {
  SetupSheetOutput,
  SiteCatalog,
  PromptOutput,
} from "@/lib/site/types";

/*
 * Le panneau de sortie — ce avec quoi elle repart.
 *
 * DEUX FORMES, et c'est `output.kind` qui décide, jamais une liste écrite ici :
 *   `prompt`      — un bloc mono, un bouton, un compteur de caractères
 *   `setup_sheet` — des étapes numérotées, puis les blocs de copy
 *
 * ⚠ Squarespace, Wix et Webflow n'ont AUCUN champ où coller un prompt. On ne
 * leur en propose pas — ni bloc, ni bouton, ni « copiez ceci au cas où ». Leur
 * `accepts_prompt` est généré depuis `output_kind` et ne peut pas le
 * contredire.
 *
 * ⚠ RIEN N'EST MODIFIABLE ICI. `output` est une fonction pure du spec,
 * regénérée à chaque écriture et jamais relue. Une zone de texte éditable
 * serait un travail perdu à la frappe suivante.
 *
 * Changer de constructeur appelle `site_spec_set_target`, qui renvoie la
 * sortie regénérée DANS LE MÊME APPEL : aucune relecture, donc aucun état
 * intermédiaire où le panneau montrerait l'ancien texte sous la nouvelle
 * pastille.
 */
export function OutputPanel({
  editor,
  catalog,
  brandKitId,
}: {
  editor: SiteEditorState;
  catalog: SiteCatalog;
  brandKitId: string;
}) {
  const { spec, output } = editor.envelope;
  const builder = builderOf(catalog.builder_targets, spec.target);

  /*
   * `mark-copied` avance `last_copied_spec_version` sur `spec_version` : c'est
   * lui qui EFFACE la bannière de péremption, et l'enveloppe retournée porte
   * `diff.stale = false`.
   *
   * Il est appelé sur les gestes qui emportent la sortie ENTIÈRE — « Copy
   * prompt », « Copy all text », le téléchargement — et pas sur la copie d'une
   * pastille isolée. Effacer « vous avez copié une version plus ancienne »
   * parce qu'un hex a été repris serait faux : elle n'a pas repris le reste.
   *
   * L'analytique (`site_output_copied`, `setup_sheet_downloaded`) est émise
   * PAR LES ROUTES, côté serveur, comme partout ailleurs dans ce dépôt : pas
   * de SDK client, pas de cookie, pas de bannière de consentement.
   */
  const markCopied = () => void editor.markCopied();

  return (
    <section aria-labelledby="site-output" className="flex flex-col gap-5">
      <SectionHeader id="site-output" title="Your instructions" />

      {/* Au-dessus de la sortie, et impossible à manquer : c'est toute la
          raison d'être du diff. */}
      <StalenessBanner editor={editor} />

      {/* ── Constructeurs ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label="Website builder">
        {catalog.builder_targets.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={entry.id === spec.target}
            onClick={() => void editor.setTarget(entry.id)}
            className={`flex h-[34px] items-center rounded-pill border px-4 text-ui transition-colors duration-[var(--dur-select)] ${
              entry.id === spec.target
                ? "border-accent bg-card text-ink"
                : "border-line text-ink-2 hover:text-ink"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <p className="max-w-[720px] text-body leading-prose text-ink">
        {leadLine(builder)}
      </p>

      {output.kind === "prompt" ? (
        <PromptBlock
          output={output}
          builderLabel={builder.label}
          onCopied={markCopied}
        />
      ) : (
        <SetupSheet
          output={output}
          brandKitId={brandKitId}
          target={spec.target}
          onCopied={markCopied}
        />
      )}
    </section>
  );
}

/* ── `prompt` ───────────────────────────────────────────────────────────── */

function PromptBlock({
  output,
  builderLabel,
  onCopied,
}: {
  output: PromptOutput;
  builderLabel: string;
  onCopied: () => void;
}) {
  return (
    <div className="relative">
      <div className="max-h-[420px] overflow-auto rounded-card border border-line bg-card p-6">
        <pre className="whitespace-pre-wrap font-mono text-mono leading-[1.7] tracking-mono-hex text-ink-2">
          {output.text}
        </pre>
      </div>

      {/*
        Le bouton reste COLLÉ en bas du bloc : le prompt fait plusieurs
        milliers de caractères, et le geste ne doit pas demander de remonter.
      */}
      <div className="sticky bottom-4 mt-4 flex flex-wrap items-center gap-4">
        <CopyButton text={output.text} onCopied={onCopied}>
          {`Copy prompt for ${builderLabel}`}
        </CopyButton>
        <MonoLabel tracking="14">
          {`${output.char_count.toLocaleString("en-US")} characters`}
        </MonoLabel>
      </div>
    </div>
  );
}

/* ── `setup_sheet` ──────────────────────────────────────────────────────── */

function SetupSheet({
  output,
  brandKitId,
  target,
  onCopied,
}: {
  output: SetupSheetOutput;
  brandKitId: string;
  target: string;
  /** Appelé par les gestes qui emportent la sortie entière, eux seuls. */
  onCopied: () => void;
}) {
  const groups = groupCopyBlocks(output.copy_blocks);

  return (
    <div className="flex flex-col gap-8">
      <ol className="flex flex-col gap-7">
        {output.steps.map((step) => (
          /*
            Le numéro vient de `step.n`. Il n'est PAS l'index : la feuille est
            passée de huit à neuf étapes sans prévenir, et un numéro codé en
            dur aurait renommé la moitié d'entre elles.
          */
          <li key={step.n} className="flex gap-4">
            <MonoLabel tracking="14" tone="ink-3" className="mt-0.5 w-6 flex-none">
              {String(step.n).padStart(2, "0")}
            </MonoLabel>

            <div className="min-w-0 flex-1">
              <h3 className="font-display text-subsection font-medium text-ink">
                {step.title}
              </h3>
              <p className="mt-1.5 max-w-[720px] whitespace-pre-line text-ui leading-prose text-ink-2">
                {step.body}
              </p>

              {step.values.length > 0 ? (
                <div className="mt-3.5 flex flex-wrap gap-2">
                  {step.values.map((value) => (
                    <CopyChip
                      key={`${value.label}-${value.value}`}
                      label={value.label}
                      value={value.value}
                      swatch={value.kind === "hex"}
                    />
                  ))}
                </div>
              ) : null}

              {step.builder_hint ? (
                <p className="mt-3 border-l border-line pl-3 text-meta leading-body text-ink-2">
                  {`Where: ${step.builder_hint}`}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {/* ── Les blocs de copy ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <CopyButton text={copyAllText(output)} onCopied={onCopied}>
            Copy all text
          </CopyButton>

          {/*
            Le PDF est rendu depuis `format=md` — la même sortie, dans son
            format markdown. Un lien, pas un `fetch` : le navigateur sait
            télécharger, et un blob construit à la main ne survit pas au
            bac à sable du téléchargement.
          */}
          <a
            href={`/api/brand-kits/${brandKitId}/site-output/pdf?target=${target}`}
            onClick={onCopied}
            className="inline-flex h-10 items-center whitespace-nowrap rounded-pill border border-line px-[26px] text-ui text-ink transition-colors hover:bg-card"
          >
            Download as PDF
          </a>
        </div>

        {groups.map((group) => (
          <div key={group.page}>
            <MonoLabel tracking="16" as="h3">
              {group.page}
            </MonoLabel>
            <div className="mt-3 flex flex-col gap-4">
              {group.sections.map((section) => (
                <div key={`${group.page}-${section.section}`}>
                  <p className="text-ui font-medium text-ink">{section.section}</p>
                  <div className="mt-1">
                    {section.blocks.map((block, index) => (
                      <CopyBlockRow
                        key={`${block.label}-${index}`}
                        label={block.label}
                        text={block.text}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
