import { z } from "zod";

/*
 * L'état d'une génération.
 *
 * OÙ IL VIT — dans `brand_kits.content.generation`. Il n'existe pas de table
 * de jobs dans le schéma, et ce dépôt n'écrit pas de migration (§8) : la
 * colonne `content` est un `jsonb` libre, sans CHECK, restée du lot 3. C'est
 * une place correcte, pas une place idéale.
 *
 * DEMANDE AU DÉPÔT DE SCHÉMA — une colonne dédiée (ou une petite table
 * `generation_jobs`) donnerait un index sur les jobs en cours, une contrainte
 * sur les statuts, et permettrait de balayer les jobs orphelins. En l'état, un
 * job dont le processus meurt reste `running` jusqu'au TTL ci-dessous.
 */

export const GENERATION_STAGES = [
  { id: "positioning", label: "Reading your positioning" },
  { id: "typefaces", label: "Choosing typefaces" },
  { id: "palette", label: "Building your palette" },
  { id: "voice", label: "Writing your voice guide" },
  { id: "copy", label: "Drafting your site copy" },
  { id: "directions", label: "Rendering your three directions" },
] as const;

export type GenerationStage = (typeof GENERATION_STAGES)[number]["id"];

export const GENERATION_STAGE_IDS = GENERATION_STAGES.map(
  (stage) => stage.id
) as GenerationStage[];

/**
 * Au-delà de ce délai, un job encore `running` est considéré comme mort : le
 * processus qui le portait n'existe plus, et l'écran de révélation doit dire
 * la panne plutôt que tourner indéfiniment.
 */
export const GENERATION_TIMEOUT_MS = 5 * 60 * 1000;

export const generationJobSchema = z.object({
  status: z.enum(["running", "done", "failed"]),
  stage: z.enum(GENERATION_STAGE_IDS as [GenerationStage, ...GenerationStage[]]),
  started_at: z.string(),
  finished_at: z.string().nullable().optional(),
  /** Message court, destiné aux logs serveur — jamais renvoyé au client. */
  error: z.string().nullable().optional(),
});

export type GenerationJob = z.infer<typeof generationJobSchema>;

/** L'état lu par l'écran de révélation. */
export type GenerationStatus = {
  status: "running" | "done" | "failed";
  /** Index de l'étape en cours, de 0 à 5. */
  stageIndex: number;
  startedAt: string;
};

export function startedJob(now: Date = new Date()): GenerationJob {
  return {
    status: "running",
    stage: "positioning",
    started_at: now.toISOString(),
  };
}

/**
 * Lit le job dans le blob `content`, en tolérant l'absence : un kit d'avant
 * cette convention n'a pas de job, et ce n'est pas une erreur.
 */
export function readJob(content: unknown): GenerationJob | null {
  if (!content || typeof content !== "object") return null;
  const raw = (content as Record<string, unknown>).generation;
  const parsed = generationJobSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Réécrit le blob `content` en n'y remplaçant que la clé `generation`. */
export function withJob(content: unknown, job: GenerationJob): object {
  const base =
    content && typeof content === "object" && !Array.isArray(content)
      ? (content as Record<string, unknown>)
      : {};
  return { ...base, generation: job };
}

/**
 * Statut présenté au client.
 *
 * Un job `running` plus vieux que le plafond est rendu `failed` : sans table de
 * jobs, c'est la seule façon de distinguer « ça travaille » de « le processus
 * est mort ». On ne rapporte JAMAIS `done` avant que les directions ne soient
 * réellement en base — c'est `directionsPresent` qui en décide, pas le job.
 */
export function statusOf(
  job: GenerationJob | null,
  directionsPresent: boolean,
  now: Date = new Date()
): GenerationStatus | null {
  if (directionsPresent) {
    return {
      status: "done",
      stageIndex: GENERATION_STAGES.length - 1,
      startedAt: job?.started_at ?? now.toISOString(),
    };
  }

  if (!job) return null;

  const stageIndex = Math.max(0, GENERATION_STAGE_IDS.indexOf(job.stage));

  if (job.status === "failed") {
    return { status: "failed", stageIndex, startedAt: job.started_at };
  }

  // `done` sans directions en base est une incohérence : on la traite comme un
  // échec plutôt que d'envoyer l'utilisateur sur une révélation vide.
  if (job.status === "done") {
    return { status: "failed", stageIndex, startedAt: job.started_at };
  }

  const age = now.getTime() - Date.parse(job.started_at);
  if (Number.isNaN(age) || age > GENERATION_TIMEOUT_MS) {
    return { status: "failed", stageIndex, startedAt: job.started_at };
  }

  return { status: "running", stageIndex, startedAt: job.started_at };
}
