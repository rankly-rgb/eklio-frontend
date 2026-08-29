import type {
  BuilderTarget,
  CopyBlock,
  SetupSheetOutput,
  SiteOutput,
  SiteTarget,
} from "@/lib/site/types";

/*
 * La sortie dérivée — LUE, copiée, jamais réécrite.
 *
 * `output` est une fonction pure du spec. La base la regénère à chaque
 * écriture et ne la relit jamais : elle édite le spec, la sortie suit. D'où
 * l'absence totale de zone de texte modifiable dans le panneau — le bouton
 * copie, et c'est tout.
 *
 * Ce module ne fait que regrouper et mettre en forme pour l'affichage.
 */

/** Le constructeur courant, avec son libellé — ou un repli sur l'identifiant. */
export function builderOf(
  targets: BuilderTarget[],
  target: SiteTarget
): BuilderTarget {
  return (
    targets.find((entry) => entry.id === target) ?? {
      id: target,
      label: target,
      output_kind: "prompt",
      accepts_prompt: true,
    }
  );
}

/**
 * La phrase d'introduction du panneau.
 *
 * Les deux disent la même chose sur deux registres : dans un cas on colle un
 * prompt, dans l'autre on saisit à la main. Squarespace, Wix et Webflow n'ont
 * PAS de champ où coller un prompt — leur en proposer un enverrait quelqu'un
 * chercher une boîte qui n'existe pas.
 */
export function leadLine(builder: BuilderTarget): string {
  return builder.output_kind === "prompt"
    ? `Paste this into ${builder.label}. It builds the site; you keep it.`
    : `${builder.label} has no prompt box. Here's exactly what to enter, in order.`;
}

export type CopyGroup = {
  page: string;
  sections: Array<{ section: string; blocks: CopyBlock[] }>;
};

/**
 * Les blocs de copy, groupés par page puis par section, DANS L'ORDRE OÙ ILS
 * ARRIVENT.
 *
 * Cet ordre est celui des sections sur le site : c'est ce qui permet de
 * descendre la liste en la collant au fur et à mesure. Le retrier par ordre
 * alphabétique ferait sauter d'une page à l'autre.
 */
export function groupCopyBlocks(blocks: CopyBlock[]): CopyGroup[] {
  const groups: CopyGroup[] = [];

  for (const block of blocks) {
    let group = groups.find((entry) => entry.page === block.page);
    if (!group) {
      group = { page: block.page, sections: [] };
      groups.push(group);
    }

    let section = group.sections.find((entry) => entry.section === block.section);
    if (!section) {
      section = { section: block.section, blocks: [] };
      group.sections.push(section);
    }

    section.blocks.push(block);
  }

  return groups;
}

/**
 * « Copy all text » — tous les blocs, dans l'ordre, avec leurs en-têtes.
 *
 * Les en-têtes sont là parce que le presse-papier n'a pas de structure : sans
 * eux, trente-trois chaînes collées bout à bout ne se raccrochent à rien.
 */
export function copyAllText(output: SetupSheetOutput): string {
  return groupCopyBlocks(output.copy_blocks)
    .map((group) =>
      [
        group.page.toUpperCase(),
        "",
        ...group.sections.flatMap((section) => [
          section.section,
          ...section.blocks.map((block) => `${block.label}: ${block.text}`),
          "",
        ]),
      ].join("\n")
    )
    .join("\n")
    .trimEnd();
}

/** Ce que le bouton principal met dans le presse-papier, quelle que soit la forme. */
export function primaryCopyText(output: SiteOutput): string {
  return output.kind === "prompt" ? output.text : copyAllText(output);
}

/**
 * Le nombre de caractères d'un prompt.
 *
 * Il vient de la base (`char_count`) et n'est pas recompté ici : `text.length`
 * compte des unités UTF-16, ce qui n'est pas ce qu'un constructeur mesure.
 */
export function promptCharCount(output: SiteOutput): number | null {
  return output.kind === "prompt" ? output.char_count : null;
}
