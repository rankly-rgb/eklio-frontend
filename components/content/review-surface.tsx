"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonClasses } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import { ethicsRuleWords, type EthicsLine } from "@/lib/content/ethics-line";

/*
 * ── L'ÉCRAN DE RELECTURE ────────────────────────────────────────────────
 *
 * Ce qu'elle fait ici, dans l'ordre où elle le fait : elle regarde la carte,
 * elle en essaie une autre s'il y en a, elle copie la légende, elle télécharge
 * l'image, elle va publier ailleurs, elle revient cocher « I posted this ».
 *
 * Donc Copy caption et Download image sont les deux actions dominantes, en
 * haut, dans le style primaire. Tout le reste de l'écran — l'éditeur de
 * champs, la publication, la suppression — est en dessous et secondaire. C'est
 * l'inverse de ce que l'écran faisait avant, où le geste le plus visible était
 * un formulaire.
 *
 * ⚠ LES VARIANTES SONT GRATUITES, ET « GRATUIT » EST LITTÉRAL. Aucune
 * n'appelle de modèle : le contenu est écrit, les faire tenir autrement est de
 * l'arithmétique. Elles sont composées par `lib/compose/` pendant le rendu de
 * la page, côté serveur, et arrivent ici en SVG.
 *
 * ⚠ LE SVG EST INLINÉ, ET IL PORTE SON TEXTE À ELLE. `lib/compose/svg.ts`
 * échappe `& < > "` sur chaque nœud de texte et sur les deux attributs qu'il
 * écrit ; un `<` dans une légende ne peut donc pas ouvrir d'élément. C'est la
 * raison pour laquelle l'inlining est acceptable ici alors que la page de
 * référence, elle, ne montre que des fixtures.
 */

export type LayoutChoice = {
  archetypeKey: string;
  label: string;
  svg: string;
  /** Le même que `rendered_assets.content_hash` : choisir déjà rendu ne rend rien. */
  contentHash: string;
  resolution: string[];
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string };

export function ReviewSurface({
  itemId,
  caption,
  rationale,
  angleLabel,
  ethics,
  layouts,
  chosen,
}: {
  itemId: string;
  caption: string | null;
  rationale: string | null;
  angleLabel: string | null;
  ethics: EthicsLine;
  layouts: LayoutChoice[];
  /** `compose_archetype` tel qu'il est en base, ou `null` pour « celle du sujet ». */
  chosen: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(
    () => layouts.findIndex((l) => l.archetypeKey === chosen) >= 0
      ? layouts.findIndex((l) => l.archetypeKey === chosen)
      : 0
  );
  const [copied, setCopied] = useState(false);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  const current = layouts[selected] ?? null;

  /*
   * ⚠ CE QUE LA LIGNE DÉONTOLOGIQUE A RÉELLEMENT PU REGARDER. Une légende, une
   * carte composée, ou rien. Le `ethics` reçu porte déjà le résultat du scan ;
   * ce booléen dit s'il y avait une SURFACE à scanner.
   */
  const hasCheckableContent = Boolean(caption?.trim()) || layouts.length > 0;

  const keep = useCallback(
    async (index: number) => {
      const layout = layouts[index];
      if (!layout) return;

      /*
       * ⚠ L'APERÇU CHANGE TOUT DE SUITE, LE TÉLÉCHARGEMENT ATTEND. La route
       * PNG compose à partir de ce que la BASE porte, pas de ce que cet écran
       * affiche : si le bouton restait actif pendant l'enregistrement, elle
       * pourrait télécharger la mise en page précédente en croyant avoir la
       * nouvelle. L'aperçu est optimiste, le fichier ne l'est pas.
       */
      setSelected(index);
      setSave({ kind: "saving" });
      try {
        const response = await fetch(`/api/content-items/${itemId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ compose_archetype: layout.archetypeKey }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setSave({ kind: "error", message: body?.error ?? "That layout did not save." });
          return;
        }
        setSave({ kind: "idle" });
        router.refresh();
      } catch {
        setSave({ kind: "error", message: "That layout did not save. Check your connection." });
      }
    },
    [itemId, layouts, router]
  );

  async function copyCaption() {
    if (!caption) return;
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /*
       * ⚠ PAS DE « Copied » QUAND ÇA N'A PAS COPIÉ. Le presse-papiers est
       * refusé sur une page non sécurisée et dans certains navigateurs mobiles.
       * Dire le contraire est exactement le genre de mensonge qui lui fait
       * coller une légende vide dans Instagram.
       */
      setSave({ kind: "error", message: "Your browser would not let us copy. Select the caption and copy it." });
    }
  }

  return (
    <section className="mt-6 flex flex-col gap-6">
      {/*
       * ── LES GESTES DOMINANTS N'APPARAISSENT QUE QUAND ILS ONT UN OBJET ──
       *
       * ⚠ « Copy caption » ÉTAIT AFFICHÉ GRISÉ SUR UN POST VIDE, en action
       * principale. Un bouton désactivé en tête d'écran dit « voici ce que
       * vous devriez faire ici » et ne le permet pas : c'est un reproche, pas
       * une action. Il n'y a rien à copier tant que rien n'est écrit, donc il
       * n'y a pas de bouton.
       */}
      {caption || current ? (
      <div className="flex flex-wrap items-center gap-3">
        {caption ? (
        <Button type="button" onClick={() => void copyCaption()} aria-live="polite">
          {copied ? "Copied" : "Copy caption"}
        </Button>
        ) : null}

        {current ? (
          /*
           * ⚠ UN `<a>` NU, PAS UN `<Link>`. `next/link` préfetche, et
           * préfetcher cette URL-ci déclencherait une composition et un
           * rasterisage complets pour une carte que personne n'a demandée —
           * sur chaque carte du mois qu'elle survole.
           */
          <a
            href={`/api/content-items/${itemId}/image`}
            className={`${buttonClasses("secondary")} ${
              save.kind === "saving" ? "pointer-events-none opacity-50" : ""
            }`}
            aria-disabled={save.kind === "saving"}
            download
          >
            {save.kind === "saving" ? "Saving the layout…" : "Download image"}
          </a>
        ) : null}
      </div>
      ) : null}

      {save.kind === "error" ? (
        <p role="alert" className="text-helper text-danger">
          {save.message}
        </p>
      ) : null}

      {/* ── Pourquoi celui-ci ──────────────────────────────────────────── */}
      {rationale ? (
        <p className="max-w-[560px] text-helper leading-prose text-ink-2">
          <span className="text-ink">Why this one:</span> {rationale}
          {angleLabel ? <span className="text-ink-2"> · {angleLabel}</span> : null}
        </p>
      ) : null}

      {/*
       * ⚠ ELLE NE CERTIFIE PLUS UNE VÉRIFICATION QUI N'A PORTÉ SUR RIEN.
       *
       * « Checked for promised outcomes… Nothing to flag. » s'affichait sur un
       * post entièrement vide. C'est faux au sens le plus simple : le scan a
       * tourné sur une chaîne vide. Une ligne qui rassure à propos de rien est
       * pire qu'absente, parce qu'elle s'use — et le jour où elle porte sur du
       * vrai texte, on ne la lit plus.
       */}
      {hasCheckableContent ? <EthicsNote ethics={ethics} /> : null}

      {/* ── La carte, et les autres façons de la poser ──────────────────── */}
      {current ? (
        <div className="flex flex-col gap-4">
          <div className="max-w-[420px] overflow-hidden rounded-card border border-line">
            <div dangerouslySetInnerHTML={{ __html: current.svg }} />
          </div>

          {current.resolution.length > 0 ? (
            /*
             * Ce que le résolveur a dû faire pour que ça tienne, dans ses mots.
             * « cut words: glosses dropped » est une information dont elle a
             * besoin AVANT de publier, pas une erreur à cacher.
             */
            <p className="max-w-[420px] text-helper leading-prose text-ink-2">
              {current.resolution.join(" · ")}
            </p>
          ) : null}

          {layouts.length > 1 ? (
            <div className="flex flex-col gap-3">
              <MonoLabel tracking="16">Another way to set it</MonoLabel>
              <p className="max-w-[560px] text-helper leading-prose text-ink-2">
                Same words, same colours — only the arrangement changes. These cost nothing:
                nothing is generated, and picking one you have already seen renders nothing at all.
              </p>
              <ul className="flex flex-wrap gap-3">
                {layouts.map((layout, index) => (
                  <li key={layout.archetypeKey}>
                    <button
                      type="button"
                      onClick={() => void keep(index)}
                      aria-pressed={index === selected}
                      className={`flex w-[132px] flex-col gap-2 rounded-card border p-2 text-left ${
                        index === selected ? "border-ink" : "border-line"
                      }`}
                    >
                      <span
                        className="overflow-hidden rounded-[4px]"
                        // Même échappement que la grande carte : voir l'en-tête.
                        dangerouslySetInnerHTML={{ __html: layout.svg }}
                      />
                      <span className="text-helper text-ink-2">{layout.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        /*
         * ⚠ PLUS DE « There is no card for this one yet ». C'était une phrase
         * qui constatait un manque sans rien proposer — et sous elle, un
         * formulaire vide. Le panneau d'écriture prend cette place : il est
         * rendu par la page, au-dessus, et ce bloc n'a plus de raison d'être.
         */
        null
      )}
    </section>
  );
}

/**
 * La ligne déontologique.
 *
 * ⚠ ELLE DIT CE QUI A ÉTÉ REGARDÉ, PAS « TOUT VA BIEN ». Une phrase
 * rassurante sans objet est ce qui fait qu'on cesse de la lire ; nommer la
 * surface scannée — sa légende, son titre, ET les libellés du diagramme — est
 * ce qui la rend vérifiable.
 */
function EthicsNote({ ethics }: { ethics: EthicsLine }) {
  if (!ethics.scanned) {
    return (
      <p className="max-w-[560px] text-helper leading-prose text-ink-2">
        The advertising check could not run just now. Nothing is blocked — but nothing was
        confirmed either.
      </p>
    );
  }

  if (ethics.blocking.length > 0) {
    /*
     * ⚠ CE CAS NE DEVRAIT PAS EXISTER, ET C'EST EXACTEMENT POUR ÇA QU'IL EST
     * ÉCRIT. Un motif bloquant ne peut pas être enregistré : le trigger refuse
     * l'écriture. S'il apparaît ici, quelque chose a contourné le chemin
     * d'écriture, et le taire serait laisser publier une phrase qui met une
     * licence en jeu.
     */
    return (
      <p role="alert" className="max-w-[560px] text-helper leading-prose text-danger">
        Do not publish this yet: it reads as {ethicsRuleWords(ethics.blocking[0].rule_id)} (
        “{ethics.blocking[0].excerpt}”). Rewrite it as a description of the work.
      </p>
    );
  }

  if (ethics.warnings.length > 0) {
    return (
      <p className="max-w-[560px] text-helper leading-prose text-ink-2">
        Worth a second look: this reads as{" "}
        {ethics.warnings.map((w) => ethicsRuleWords(w.rule_id)).join(", ")}. It will publish — a
        board may still read it as advertising.
      </p>
    );
  }

  return (
    <p className="max-w-[560px] text-helper leading-prose text-ink-2">
      Checked for promised outcomes, client voice, urgency and diagnosis — in the caption, the
      title, the line on the image, and every label on the card. Nothing to flag.
    </p>
  );
}
