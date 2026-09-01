import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { loadBrief, type BriefBundle } from "@/lib/data/brief";
import { readCatalog } from "@/lib/catalog/read";
import type { Catalog } from "@/lib/catalog/types";
import {
  directionBases,
  heroOverline,
  type DirectionBasis,
} from "@/lib/generation/select";
import { buildBriefContext } from "@/lib/generation/brief-context";
import {
  callGeneration,
  callRewrite,
  systemPrompt,
  type GenerationCall,
  type GenerationDraft,
} from "@/lib/generation/model";
import {
  failures,
  maxLengthConstraint,
  nameConstraint,
  rationaleConstraint,
  repairInstruction,
  toneKeywordsIssue,
  truncateOnWordBoundary,
} from "@/lib/generation/validate";
import { enforceEthics, fieldMap, type Rewriter } from "@/lib/ethics/guard";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import {
  directionsSchema,
  socialTemplatesSchema,
  voiceGuideSchema,
  type Direction,
  type SocialTemplates,
} from "@/lib/brand/shapes";
import {
  readJob,
  withJob,
  type GenerationJob,
  type GenerationStage,
} from "@/lib/generation/job";

/*
 * La pipeline de génération (§7).
 *
 * SIX ÉTAPES, celles que l'Écran 3 affiche, et elles ne sont pas décoratives :
 * les trois premières correspondent à du travail réellement fait avant l'appel
 * modèle (lecture du brief, choix des typographies, construction des
 * palettes), les trois dernières à l'appel lui-même. Comme c'est UN seul
 * appel, ces trois-là avancent sur un rythme qui SUIT approximativement sa
 * durée — mais `done` n'est jamais rapporté avant l'écriture réelle : le
 * statut le déduit de la présence des directions en base, pas du job.
 *
 * ORDRE DES GARDES, et il compte :
 *   1. structure — le schéma zod de l'outil ;
 *   2. rendu     — les CHECK de la base, avec UNE reprise par champ fautif ;
 *   3. déontologie — passe déterministe puis réécriture ciblée.
 * La déontologie passe EN DERNIER parce qu'une reprise de longueur réécrit du
 * texte : vérifier avant reviendrait à valider une version qui n'existe plus.
 */

type Client = SupabaseClient<Database>;

export class GenerationNotImplementedError extends Error {
  constructor() {
    super("The generation pipeline lands in lot 6.");
    this.name = "GenerationNotImplementedError";
  }
}

export type PipelineInput = {
  supabase: Client;
  /** Client service_role : le job écrit hors du contexte de la requête. */
  admin: Client;
  projectId: string;
  brandKitId: string;
  userId: string;
  /** Injecté par les tests ; l'appel réel par défaut. */
  call?: GenerationCall;
  rewrite?: (system: string, instruction: string) => Promise<string>;
};

/** Rythme d'avancement des trois étapes portées par l'appel modèle. */
const STAGE_TICK_MS = 14_000;

async function setStage(
  admin: Client,
  brandKitId: string,
  stage: GenerationStage
): Promise<void> {
  const { data } = await admin
    .from("brand_kits")
    .select("content")
    .eq("id", brandKitId)
    .maybeSingle();

  const job = readJob(data?.content);
  if (!job || job.status !== "running") return;

  await admin
    .from("brand_kits")
    .update({ content: withJob(data?.content, { ...job, stage }) as never })
    .eq("id", brandKitId);
}

async function finishJob(
  admin: Client,
  brandKitId: string,
  patch: Partial<GenerationJob>
): Promise<void> {
  const { data } = await admin
    .from("brand_kits")
    .select("content")
    .eq("id", brandKitId)
    .maybeSingle();

  const job = readJob(data?.content);
  if (!job) return;

  await admin
    .from("brand_kits")
    .update({
      content: withJob(data?.content, {
        ...job,
        finished_at: new Date().toISOString(),
        ...patch,
      }) as never,
    })
    .eq("id", brandKitId);
}

export async function runGenerationPipeline(input: PipelineInput): Promise<void> {
  const { supabase, admin, projectId, brandKitId, userId } = input;
  const call = input.call ?? callGeneration;
  const rewriteCall = input.rewrite ?? callRewrite;

  const bundle = await loadBrief(supabase, projectId, userId);
  if (!bundle) throw new Error("Brief introuvable pour la génération.");

  const catalog = await readCatalog(supabase);

  // ── 1. Reading your positioning ────────────────────────────────────────
  await setStage(admin, brandKitId, "positioning");

  // ── 2 et 3. Choosing typefaces / Building your palette ─────────────────
  // Travail réel, et déterministe : les CHECK de la base exigent des hex
  // valides, trois polices de titre distinctes et une URL Google réelle.
  await setStage(admin, brandKitId, "typefaces");
  const bases = directionBases(
    bundle.brief.palette_family_ids,
    bundle.brief.type_pairing_id,
    catalog
  );
  await setStage(admin, brandKitId, "palette");

  /*
   * Les trois étapes restantes sont portées par un seul appel : elles avancent
   * sur une minuterie qui en suit approximativement la durée. Elle est arrêtée
   * dès que l'appel rend, et elle ne peut jamais atteindre `done` — c'est la
   * présence des directions en base qui en décide.
   */
  const ticker = startStageTicker(admin, brandKitId);

  let draft: GenerationDraft;
  try {
    const system = systemPrompt(catalog.ethicsRules);
    const prompt = buildBriefContext(bundle, catalog, bases);
    draft = await call(system, prompt);
  } finally {
    ticker.stop();
  }

  // ── Garde 2 : les contraintes de rendu, avec une reprise par champ ──────
  const repaired = await repairDraft(draft, (instruction) =>
    rewriteCall(ETHICS_SYSTEM_RULES, instruction)
  );

  // ── Garde 3 : la déontologie, sur TOUTE chaîne publiable ────────────────
  const rewriter: Rewriter = async (request) => {
    const problems = request.problems
      .map(
        (problem) =>
          `- "${problem.excerpt}" breaks the rule "${problem.description}"${
            problem.exampleForbidden
              ? ` (never write things like "${problem.exampleForbidden}")`
              : ""
          }`
      )
      .join("\n");

    return rewriteCall(
      ETHICS_SYSTEM_RULES,
      `Rewrite this line so it no longer breaks the advertising rules below.

Line:
${request.text}

Problems:
${problems}

Keep the same meaning, the same length, and the same voice. Reply with the
rewritten line only — no quotes, no explanation.`
    );
  };

  const publishable = publishableFields(repaired);
  const guarded = await enforceEthics(publishable, catalog.ethicsRules, rewriter);
  const guardedText = fieldMap(guarded.fields);

  // ── Assemblage et écriture ─────────────────────────────────────────────
  const assembled = assemble(repaired, bases, bundle, catalog, guardedText);

  /*
   * On revalide APRÈS la déontologie : une réécriture peut avoir rallongé une
   * ligne. Les maximums sont alors ramenés sur une frontière de mot plutôt que
   * de perdre une minute de génération pour deux caractères.
   */
  const directions = directionsSchema.parse(
    assembled.directions.map(clampDirection)
  );
  const socialTemplates = socialTemplatesSchema.parse(
    clampSocial(assembled.socialTemplates)
  );
  const voiceGuide = voiceGuideSchema.parse(assembled.voiceGuide);

  const { error } = await admin
    .from("brand_kits")
    .update({
      directions: directions as never,
      social_templates: socialTemplates as never,
      voice_guide: voiceGuide as never,
      ethics_check: guarded.check as never,
      practitioner_line: assembled.practitionerLine,
      updated_at: new Date().toISOString(),
    })
    .eq("id", brandKitId);

  if (error) {
    // Un CHECK rejeté ici ne doit PAS remonter en 500 : le job passe en échec,
    // et l'écran de révélation propose « Try again » avec le brief intact.
    throw new Error(`Écriture du kit refusée : ${error.message}`);
  }

  const { error: checklistError } = await admin.rpc("seed_launch_checklist", {
    p_brand_kit_id: brandKitId,
  });
  if (checklistError) {
    // La checklist est un accessoire : son absence n'invalide pas un kit écrit.
    console.error("[generation] seed_launch_checklist", checklistError);
  }

  await finishJob(admin, brandKitId, { status: "done", stage: "directions" });
}

function startStageTicker(admin: Client, brandKitId: string) {
  const remaining: GenerationStage[] = ["voice", "copy", "directions"];
  let index = 0;

  const timer = setInterval(() => {
    const stage = remaining[index];
    index += 1;
    if (!stage) {
      clearInterval(timer);
      return;
    }
    void setStage(admin, brandKitId, stage);
  }, STAGE_TICK_MS);

  return {
    stop: () => clearInterval(timer),
  };
}

/* ── Reprise des champs hors contraintes ────────────────────────────────── */

async function repairDraft(
  draft: GenerationDraft,
  repair: (instruction: string) => Promise<string>
): Promise<GenerationDraft> {
  const next: GenerationDraft = structuredClone(draft);

  for (const [index, direction] of next.directions.entries()) {
    const checks = [
      { constraint: nameConstraint(`directions[${index}].name`), value: direction.name },
      {
        constraint: rationaleConstraint(`directions[${index}].rationale`),
        value: direction.rationale,
      },
      {
        constraint: maxLengthConstraint(
          `directions[${index}].hero_headline`,
          46,
          "the site headline, rendered at 27px in the card mockup"
        ),
        value: direction.hero_headline,
      },
      {
        constraint: maxLengthConstraint(
          `directions[${index}].hero_subhead`,
          60,
          "the line under the headline"
        ),
        value: direction.hero_subhead,
      },
    ];

    for (const failure of failures(checks)) {
      const rewritten = (await repair(repairInstruction(failure))).trim();
      if (!rewritten) continue;
      const field = failure.field.split(".")[1] as
        | "name"
        | "rationale"
        | "hero_headline"
        | "hero_subhead";
      direction[field] = rewritten;
    }

    const toneIssue = toneKeywordsIssue(direction.tone_keywords);
    if (toneIssue) {
      const rewritten = await repair(
        repairInstruction({
          field: `directions[${index}].tone_keywords`,
          requirement: toneIssue,
          value: direction.tone_keywords.join(", "),
        })
      );
      const words = rewritten
        .toLowerCase()
        .replace(/[^a-z\s,·]/g, "")
        .split(/[\s,·]+/)
        .filter(Boolean);
      if (words.length >= 3) direction.tone_keywords = words.slice(0, 3);
    }
  }

  const socialChecks = [
    {
      constraint: maxLengthConstraint("social.statement_headline", 34, "a statement post"),
      value: next.social.statement_headline,
    },
    {
      constraint: maxLengthConstraint("social.question_headline", 34, "a question post"),
      value: next.social.question_headline,
    },
    {
      constraint: maxLengthConstraint("social.notes_headline", 20, "a small-caps label"),
      value: next.social.notes_headline,
    },
  ];

  for (const failure of failures(socialChecks)) {
    const rewritten = (await repair(repairInstruction(failure))).trim();
    if (!rewritten) continue;
    const key = failure.field.split(".")[1] as
      | "statement_headline"
      | "question_headline"
      | "notes_headline";
    next.social[key] = rewritten;
  }

  return next;
}

/* ── Ce qui passe par la déontologie ────────────────────────────────────── */

/**
 * Toute chaîne que le praticien pourrait publier (§7).
 *
 * UNE EXCEPTION, documentée et volontaire : `voice_guide.never_write`. Ces
 * lignes NOMMENT la faute à éviter — elles sont affichées barrées sous « Never
 * write this ». Les vérifier ferait échouer la génération sur sa propre
 * pédagogie.
 */
function publishableFields(draft: GenerationDraft) {
  const fields: { field: string; text: string }[] = [];

  draft.directions.forEach((direction, index) => {
    fields.push(
      { field: `directions[${index}].name`, text: direction.name },
      { field: `directions[${index}].rationale`, text: direction.rationale },
      { field: `directions[${index}].hero_headline`, text: direction.hero_headline },
      { field: `directions[${index}].hero_subhead`, text: direction.hero_subhead },
      { field: `directions[${index}].about_excerpt`, text: direction.about_excerpt }
    );
  });

  draft.voice_guide.sounds_like.forEach((line, index) => {
    fields.push({ field: `voice_guide.sounds_like[${index}]`, text: line });
  });

  fields.push(
    { field: "social.statement_headline", text: draft.social.statement_headline },
    { field: "social.question_headline", text: draft.social.question_headline },
    { field: "social.notes_headline", text: draft.social.notes_headline },
    { field: "social.notes_body", text: draft.social.notes_body }
  );

  return fields;
}

/* ── Assemblage ─────────────────────────────────────────────────────────── */

function slug(value: string, index: number): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `direction-${index + 1}`;
}

function assemble(
  draft: GenerationDraft,
  bases: DirectionBasis[],
  bundle: BriefBundle,
  catalog: Catalog,
  guarded: Map<string, string>
) {
  const license = bundle.brief.license_type_id
    ? catalog.licenseTypes.find((entry) => entry.id === bundle.brief.license_type_id)
    : null;

  const overline = heroOverline(
    license?.label ?? null,
    bundle.brief.city,
    bundle.brief.state
  );

  const ctaLabel =
    catalog.primaryActions.find(
      (entry) => entry.id === bundle.brief.primary_action_id
    )?.label ?? "Book a consult";

  const text = (field: string, fallback: string) => guarded.get(field) ?? fallback;

  const directions = draft.directions.map((direction, index) => {
    const basis = bases[index] ?? bases[bases.length - 1];
    const name = text(`directions[${index}].name`, direction.name);

    return {
      id: slug(name, index),
      name,
      rationale: text(`directions[${index}].rationale`, direction.rationale),
      about_excerpt: text(
        `directions[${index}].about_excerpt`,
        direction.about_excerpt
      ),
      palette: basis.palette,
      hero: {
        overline,
        headline: text(
          `directions[${index}].hero_headline`,
          direction.hero_headline
        ),
        subhead: text(`directions[${index}].hero_subhead`, direction.hero_subhead),
        cta_label: ctaLabel,
      },
      typography: basis.typography,
      tone_keywords: direction.tone_keywords.map((word) =>
        word.trim().toLowerCase()
      ),
      rendering: {
        nav_surface: direction.nav_surface,
        cta_shape: direction.cta_shape,
        cta_style: direction.cta_style,
      },
      /*
       * La recommandée est celle bâtie sur la palette « LEADING » du praticien
       * et sur sa paire typographique — c'est-à-dire la première, puisque
       * `directionBases()` respecte cet ordre. On l'écrit en DONNÉE pour que
       * l'écran n'ait pas à connaître cette convention.
       */
      recommended: index === 0,
    } satisfies Direction;
  });

  /*
   * Les ids doivent être distincts (`brand_kit_directions_shape_valid`). Deux
   * noms qui se réduisent au même slug arrivent : on suffixe plutôt que de
   * faire échouer l'écriture.
   */
  const seen = new Set<string>();
  for (const direction of directions) {
    let candidate = direction.id;
    let suffix = 2;
    while (seen.has(candidate)) {
      candidate = `${direction.id}-${suffix}`;
      suffix += 1;
    }
    seen.add(candidate);
    direction.id = candidate;
  }

  const practiceName = bundle.brief.practice_name ?? bundle.project.name;

  const socialTemplates: SocialTemplates = [
    {
      id: "statement",
      type: "post",
      layout: "statement",
      headline: text("social.statement_headline", draft.social.statement_headline),
      body: null,
      palette_role: "primary",
      typography_role: "heading",
    },
    {
      id: "question",
      type: "post",
      layout: "question",
      headline: text("social.question_headline", draft.social.question_headline),
      body: null,
      palette_role: "light",
      typography_role: "heading",
    },
    {
      id: "notes",
      type: "post",
      layout: "notes",
      headline: text("social.notes_headline", draft.social.notes_headline),
      body: text("social.notes_body", draft.social.notes_body),
      palette_role: "secondary",
      typography_role: "body",
    },
    {
      id: "signature",
      type: "story",
      layout: "signature",
      headline: practiceName,
      body: null,
      palette_role: "light",
      typography_role: "heading",
    },
  ];

  const voiceGuide = {
    sounds_like: draft.voice_guide.sounds_like.map((line, index) =>
      text(`voice_guide.sounds_like[${index}]`, line)
    ),
    // `never_write` NOMME la faute : il ne passe pas par la déontologie.
    never_write: draft.voice_guide.never_write,
  };

  /*
   * La ligne de la tuile `signature`, dans l'ordre de ce qu'on sait vraiment :
   *
   *   1. ce qu'elle a écrit elle-même (`practitioner_line`) ;
   *   2. son NOM, désormais demandé à l'étape 1, composé avec sa licence ;
   *   3. le nom du cabinet — le repli d'avant, qui nommait la structure et
   *      jamais la personne.
   *
   * Le deuxième cas est nouveau : jusqu'ici la tuile disait « Elm & Ember
   * Counseling, LCSW », ce qui attribue une licence à une raison sociale. Rien
   * ne se COMPOSE à partir de `practitioner_line` en sens inverse — un nom
   * portant une virgule, un titre en deux mots ou un suffixe ne se redécoupe
   * pas, et c'est pour ça que les deux champs existent séparément.
   */
  const practitionerName = bundle.data.practitioner_name?.trim();
  const practitionerLine =
    bundle.data.practitioner_line?.trim() ||
    (practitionerName
      ? license?.label
        ? `${practitionerName}, ${license.label}`
        : practitionerName
      : license?.label
        ? `${practiceName}, ${license.label}`
        : practiceName);

  return { directions, socialTemplates, voiceGuide, practitionerLine };
}

/** Dernier filet sur les maximums, après réécriture déontologique. */
function clampDirection(direction: Direction): Direction {
  return {
    ...direction,
    name: truncateOnWordBoundary(direction.name, 20),
    hero: {
      ...direction.hero,
      headline: truncateOnWordBoundary(direction.hero.headline, 46),
      subhead: truncateOnWordBoundary(direction.hero.subhead, 60),
    },
  };
}

function clampSocial(templates: SocialTemplates): SocialTemplates {
  return [
    { ...templates[0], headline: truncateOnWordBoundary(templates[0].headline, 34) },
    { ...templates[1], headline: truncateOnWordBoundary(templates[1].headline, 34) },
    { ...templates[2], headline: truncateOnWordBoundary(templates[2].headline, 20) },
    templates[3],
  ];
}

/**
 * « Write it for me » — une suggestion pour un champ libre du brief.
 *
 * Elle passe par le même socle déontologique que la génération : ce que le
 * praticien colle dans son brief finit dans la copy de son site.
 */
export async function suggestFieldText(input: {
  supabase: Client;
  projectId: string;
  field: string;
  userId: string;
  rewrite?: (system: string, instruction: string) => Promise<string>;
}): Promise<string> {
  const { supabase, projectId, field, userId } = input;
  const rewriteCall = input.rewrite ?? callRewrite;

  const bundle = await loadBrief(supabase, projectId, userId);
  if (!bundle) throw new Error("Brief introuvable.");

  const catalog = await readCatalog(supabase);
  const bases = directionBases(
    bundle.brief.palette_family_ids,
    bundle.brief.type_pairing_id,
    catalog
  );

  const ASKS: Record<string, string> = {
    positioning:
      "Write one sentence, 60 characters at most, naming who this practice serves and what they are carrying.",
    problem_text:
      "Write two sentences describing what this practitioner's clients are carrying when they first call. Their words, not clinical language.",
    gain_text:
      "Write one sentence, 60 characters at most, describing what changes for these clients. Describe the work, never promise a result.",
    practitioner_line:
      "Write the practitioner's name and credential as a single line, e.g. 'Nora Whitfield, LCSW'. Use only what the brief gives you.",
  };

  const ask = ASKS[field] ?? ASKS.positioning;

  const suggestion = await rewriteCall(
    systemPrompt(catalog.ethicsRules),
    `${buildBriefContext(bundle, catalog, bases)}

${ask}

Reply with the line only — no quotes, no explanation, no preamble.`
  );

  return suggestion.trim();
}
