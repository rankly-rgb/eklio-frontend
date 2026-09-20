import { createHash } from "node:crypto";
import {
  contentImageModel,
  CONTENT_IMAGE_SIZE,
  ESTIMATE_DRIFT_WARN,
  estimatedCostUsd,
  imageCostUsd,
  resolveQuality,
} from "@/lib/content/images/config";
import {
  ContentImageModerationError,
  ContentImageNotConfiguredError,
  ContentImageTransientError,
  type ContentImageClient,
} from "@/lib/content/images/client";

/*
 * ── LE CHEMIN PAYANT, EN ENTIER ─────────────────────────────────────────
 *
 *   déduplication → réservation → appel → lecture d'`usage` → stockage →
 *   règlement avec le coût RÉEL
 *
 * et le plafond mensuel est en SQL, pas ici. `reserve_credit` refuse quand le
 * quota est atteint (`credit_quotas`, plafond appliqué dans la statement qui
 * bouge le nombre), et cette fonction n'a aucun moyen de le contourner :
 * elle ne sait pas ce qu'est un quota, elle sait seulement qu'on lui a répondu
 * non.
 *
 * ── ⚠ LA DÉDUPLICATION EST AVANT LA RÉSERVATION, PAS APRÈS ──────────────
 *
 * Un prompt déjà généré pour ce kit ne doit ni appeler l'API, ni réserver un
 * crédit, ni écrire une ligne de journal. Interroger d'abord évite les trois.
 *
 * `record_custom_visual` sait aussi rattraper le cas — il relâche le crédit
 * quand il trouve la ligne déjà là — mais ce rattrapage existe pour LA COURSE
 * entre deux demandes simultanées, pas pour le cas courant. Le faire porter
 * le cas courant remplirait le journal de paires réservation/libération qui
 * ne disent rien.
 */

export type CustomVisualDeps = {
  client: ContentImageClient;
  /** Le chemin déjà stocké pour ce (kit, prompt), ou null. */
  lookup(brandKitId: string, promptHash: string): Promise<string | null>;
  reserve(input: {
    userId: string;
    estimatedCostUsd: number;
    model: string;
    contentItemId: string | null;
  }): Promise<{ ok: boolean; reason: string; reservationId: string | null }>;
  upload(storagePath: string, bytes: Buffer, contentType: string): Promise<void>;
  /** `record_custom_visual` : écrit la ligne ET règle le crédit, ou relâche. */
  record(input: {
    brandKitId: string;
    promptHash: string;
    contentItemId: string | null;
    model: string;
    quality: string;
    size: string;
    storagePath: string;
    costUsd: number | null;
    reservationId: string;
  }): Promise<{ ok: boolean; reason: string; storagePath: string | null }>;
  /** Libère une réservation sans rien facturer. Pour les échecs avant écriture. */
  release(reservationId: string): Promise<void>;
  /** Injecté pour que le test lise l'avertissement de dérive plutôt que la console. */
  warn?(message: string): void;
};

export type CustomVisualInput = {
  brandKitId: string;
  userId: string;
  contentItemId: string | null;
  prompt: string;
};

export type CustomVisualOutcome =
  | { ok: true; reason: "cached"; storagePath: string; costUsd: 0; calledModel: false }
  | { ok: true; reason: "generated"; storagePath: string; costUsd: number | null; calledModel: true }
  | { ok: false; reason: string; calledModel: boolean };

/**
 * `prompt_hash` — SHA-256 hexadécimal minuscule, la forme que
 * `custom_visual_hash_check` exige en base.
 *
 * ⚠ LE MODÈLE, LA QUALITÉ ET LA TAILLE SONT DANS LE HACHAGE. Le même prompt
 * en `medium` n'est pas la même image qu'en `low`, et changer de modèle doit
 * produire une image neuve plutôt que servir celle d'avant. Sans eux, un
 * changement de configuration serait invisible et le cache servirait
 * indéfiniment ce que l'ancienne configuration avait produit.
 */
export function promptHash(prompt: string, model: string, quality: string, size: string): string {
  return createHash("sha256")
    .update(JSON.stringify({ prompt: prompt.trim(), model, quality, size }))
    .digest("hex");
}

/** `{kit}/custom/{hash}.png` — la convention que `custom_visual_path_prefix_check` exige. */
export function customVisualPath(brandKitId: string, hash: string): string {
  return `${brandKitId}/custom/${hash}.png`;
}

export async function generateCustomVisual(
  input: CustomVisualInput,
  deps: CustomVisualDeps
): Promise<CustomVisualOutcome> {
  // ── La qualité, résolue avant tout le reste ────────────────────────────
  // Une variable d'environnement au-dessus du plafond lève ici : avant
  // l'appel, avant la réservation, avant qu'une ligne soit écrite.
  const quality = resolveQuality();
  /*
   * ⚠ LU UNE FOIS, ICI, ET RÉUTILISÉ. Le modèle entre dans le `prompt_hash` et
   * dans la ligne enregistrée : le relire à chaque usage ouvrirait la porte à
   * un hachage calculé sur un modèle et une ligne écrite sur un autre, si la
   * variable changeait entre deux lectures.
   */
  const model = contentImageModel();
  const hash = promptHash(input.prompt, model, quality, CONTENT_IMAGE_SIZE);

  /*
   * ── 0. LA CLEF, AVANT TOUT LE RESTE ───────────────────────────────────
   *
   * ⚠ ET AVANT LA RÉSERVATION, PAS APRÈS. Sans cette porte, une
   * `OPENAI_API_KEY` absente faisait réserver un crédit, lever à l'appel,
   * relâcher, et rendre `failed` avec `calledModel: true` — trois lignes de
   * journal, un aller-retour, et un mot faux : rien n'avait été appelé.
   *
   * `not_configured` est un refus d'environnement, pas une panne : le reste de
   * l'écran fonctionne, et seul ce chemin-ci est fermé.
   */
  if (deps.client.configured?.() === false) {
    return { ok: false, reason: "not_configured", calledModel: false };
  }

  // ── 1. Déjà généré ? Alors ni appel, ni crédit, ni journal ─────────────
  const cached = await deps.lookup(input.brandKitId, hash);
  if (cached) {
    return { ok: true, reason: "cached", storagePath: cached, costUsd: 0, calledModel: false };
  }

  // ── 2. Le crédit, AVANT l'appel ────────────────────────────────────────
  const estimated = estimatedCostUsd(quality === "medium" ? "medium" : "low");
  const reservation = await deps.reserve({
    userId: input.userId,
    estimatedCostUsd: estimated,
    model,
    contentItemId: input.contentItemId,
  });

  if (!reservation.ok || !reservation.reservationId) {
    // `not_entitled`, `quota_exhausted` : des refus, pas des pannes. Rien n'a
    // été appelé et rien n'a été dépensé.
    return { ok: false, reason: reservation.reason, calledModel: false };
  }

  // ── 3. L'appel. Une modération est terminale, une panne a UN réessai ────
  let result;
  try {
    result = await callOnce(deps.client, input, quality);
  } catch (error) {
    await deps.release(reservation.reservationId);
    if (error instanceof ContentImageModerationError) {
      return { ok: false, reason: "moderated", calledModel: true };
    }
    /*
     * ⚠ UNE CLEF ABSENTE N'EST PAS UN APPEL RATÉ. Elle peut arriver ici malgré
     * la porte ci-dessus — un client qui ne déclare pas `configured` — et
     * `calledModel: true` serait alors un mensonge dans le sens qui coûte :
     * un appelant qui compte les appels facturés en compterait un de trop.
     */
    if (error instanceof ContentImageNotConfiguredError) {
      return { ok: false, reason: "not_configured", calledModel: false };
    }
    return { ok: false, reason: "failed", calledModel: true };
  }

  // ── 4. Le coût réel, depuis `usage` et depuis lui seul ─────────────────
  const actual = imageCostUsd(result.usage);

  if (actual !== null && estimated > 0) {
    const drift = Math.abs(actual - estimated) / estimated;
    if (drift > ESTIMATE_DRIFT_WARN) {
      // ⚠ LE SEUL SIGNAL QUE L'HYPOTHÈSE A DÉRIVÉ. Une estimation qui ne se
      // compare jamais au réel est une constante que personne ne relira.
      (deps.warn ?? console.warn)(
        `[content-images] estimate drift ${(drift * 100).toFixed(0)}%: estimated ` +
          `$${estimated.toFixed(6)}, actual $${actual.toFixed(6)} for ${model} ` +
          `at quality "${quality}". ESTIMATED_OUTPUT_TOKENS in config.ts is out of date.`
      );
    }
  }

  // ── 5. Les octets, puis la ligne ───────────────────────────────────────
  const storagePath = customVisualPath(input.brandKitId, hash);
  try {
    await deps.upload(storagePath, result.bytes, result.contentType);
  } catch {
    await deps.release(reservation.reservationId);
    return { ok: false, reason: "upload_failed", calledModel: true };
  }

  const recorded = await deps.record({
    brandKitId: input.brandKitId,
    promptHash: hash,
    contentItemId: input.contentItemId,
    model,
    quality,
    size: CONTENT_IMAGE_SIZE,
    storagePath,
    costUsd: actual,
    reservationId: reservation.reservationId,
  });

  /*
   * `record_custom_visual` a réglé le crédit avec `actual`, ou l'a relâché en
   * trouvant la ligne déjà écrite par une demande concurrente.
   *
   * ⚠ LE COÛT RAPPORTÉ EST ZÉRO DANS LE SECOND CAS, et l'appel a quand même
   * eu lieu. C'est la seule forme honnête : Eklio a bien payé OpenAI pour ces
   * octets, mais le LEDGER n'a rien facturé à la praticienne parce que la
   * course a été perdue. `calledModel: true` est ce qui distingue cette
   * ligne-là d'un vrai cache, et un appelant qui somme les coûts du ledger ne
   * doit pas y compter une dépense que le ledger n'a pas.
   */
  return {
    ok: true,
    reason: "generated",
    storagePath: recorded.storagePath ?? storagePath,
    costUsd: recorded.reason === "cached" ? 0 : actual,
    calledModel: true,
  };
}

/**
 * Un appel, puis UN réessai sur une panne. Jamais une boucle.
 *
 * ⚠ ET JAMAIS DE RÉESSAI SUR UNE MODÉRATION. Un prompt refusé sera refusé
 * autant de fois qu'on le posera, et chaque fois coûtera.
 */
async function callOnce(
  client: ContentImageClient,
  input: CustomVisualInput,
  quality: ReturnType<typeof resolveQuality>
) {
  const request = { prompt: input.prompt, quality, user: input.userId };
  try {
    return await client.generate(request);
  } catch (error) {
    if (error instanceof ContentImageTransientError) {
      return await client.generate(request);
    }
    throw error;
  }
}
