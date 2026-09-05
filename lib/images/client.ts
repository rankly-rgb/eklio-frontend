import {
  BACKGROUND,
  IMAGE_MODEL,
  IMAGE_CONTENT_TYPE,
  MODERATION,
  OUTPUT_COMPRESSION,
  OUTPUT_FORMAT,
  type ImageQuality,
  type ImageSize,
} from "@/lib/images/config";

/*
 * ── THE MODEL CLIENT, AND WHY IT IS AN INTERFACE ────────────────────────
 *
 * Every test of the orchestration — claim, fingerprint, signed upload,
 * record, settle, retry, fallback — runs against a stub and spends nothing.
 * If the only way to exercise this pipeline were to call the real API, the
 * design would be wrong: nobody writes a second test for a path that costs
 * a quarter to run.
 *
 * So `generateBrandImage` takes an `ImageModelClient`. `openAiImageClient()`
 * is one implementation, used in exactly two places (the route handler and
 * the one-shot script). Everything else passes a stub.
 *
 * ── THE ONE DISTINCTION THIS FILE EXISTS TO MAKE ────────────────────────
 *
 * A moderation refusal is NOT a failure to retry. It means the prompt is
 * wrong, and retrying a wrong prompt spends money to be refused again. It is
 * classified here, at the boundary, and carried as a distinct error class all
 * the way to `brand_images.status = 'moderated'`, which is terminal.
 *
 * Everything transient — a timeout, a 429, a 5xx, a dropped socket — is
 * `ImageTransientError`, and gets exactly one retry. Never a loop.
 */

const IMAGES_ENDPOINT = "https://api.openai.com/v1/images/generations";

export type ImageUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

export type ImageRequest = {
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
  /** Passed to OpenAI as `user`, for their abuse tooling. Never logged by us. */
  user: string;
};

export type ImageResult = {
  bytes: Buffer;
  contentType: string;
  /**
   * Recorded when present (gpt-image-1 returns it). NEVER used to compute
   * money — the price table in config.ts is the only source of cost.
   */
  usage: ImageUsage | null;
};

export interface ImageModelClient {
  generate(request: ImageRequest): Promise<ImageResult>;
}

/** The prompt was refused. Terminal: an operator must see it, not a retry loop. */
export class ImageModerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageModerationError";
  }
}

/** A timeout, a 429, a 5xx, a dropped connection. Retried exactly once. */
export class ImageTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageTransientError";
  }
}

/** The key is missing or rejected. Never retried, and never charged for. */
export class ImageNotConfiguredError extends Error {
  constructor(message = "OPENAI_API_KEY is not set. Image generation is disabled until it is configured server-side.") {
    super(message);
    this.name = "ImageNotConfiguredError";
  }
}

type OpenAiImagePayload = {
  data?: { b64_json?: string }[];
  usage?: ImageUsage;
  error?: { message?: string; code?: string; type?: string };
};

/**
 * The real client.
 *
 * `response_format` is deliberately NOT sent: GPT image models always return
 * `b64_json` and reject the parameter. `revised_prompt` is DALL-E 3 only and
 * is not read.
 *
 * The key is read from the environment by the CALLER and passed in, so this
 * function has no ambient dependency and can be constructed in a test without
 * an environment. It is never logged, never included in an error, and never
 * returned — the only place it appears is the Authorization header.
 */
export function openAiImageClient(apiKey: string, fetchImpl: typeof fetch = fetch): ImageModelClient {
  if (!apiKey) throw new ImageNotConfiguredError();

  return {
    async generate({ prompt, size, quality, user }: ImageRequest): Promise<ImageResult> {
      let response: Response;
      try {
        response = await fetchImpl(IMAGES_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: IMAGE_MODEL,
            prompt,
            n: 1,
            size,
            quality,
            background: BACKGROUND,
            output_format: OUTPUT_FORMAT,
            output_compression: OUTPUT_COMPRESSION,
            moderation: MODERATION,
            user,
          }),
        });
      } catch (err) {
        // A dropped socket or a DNS failure never got as far as a decision.
        throw new ImageTransientError(`Could not reach the image API: ${(err as Error).message}`);
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as OpenAiImagePayload | null;
        const message = payload?.error?.message ?? `HTTP ${response.status}`;
        const code = payload?.error?.code ?? "";

        if (response.status === 401 || response.status === 403) {
          throw new ImageNotConfiguredError("The image API rejected the configured key.");
        }
        if (code === "content_policy_violation" || code === "moderation_blocked") {
          throw new ImageModerationError(message);
        }
        if (response.status === 429 || response.status >= 500) {
          throw new ImageTransientError(message);
        }
        // Any other 4xx is our bug — a bad parameter, a malformed body. Not
        // retryable, and not a moderation refusal either.
        throw new Error(`Image API refused the request (${response.status}): ${message}`);
      }

      const payload = (await response.json()) as OpenAiImagePayload;
      const b64 = payload.data?.[0]?.b64_json;
      if (!b64) {
        throw new ImageTransientError("The image API returned no image.");
      }

      return {
        bytes: Buffer.from(b64, "base64"),
        contentType: IMAGE_CONTENT_TYPE,
        usage: payload.usage ?? null,
      };
    },
  };
}

/**
 * Builds the real client from the environment, or throws the "not configured"
 * error a caller can tell apart from a genuine model failure.
 */
export function openAiImageClientFromEnv(): ImageModelClient {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ImageNotConfiguredError();
  return openAiImageClient(key);
}
