export type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";
export type ImageQuality = "low" | "medium" | "high";

const IMAGES_ENDPOINT = "https://api.openai.com/v1/images/generations";

// Approximate gpt-image-1 per-image pricing (USD), as of Aug 2026 — OpenAI's own
// pricing page was unreachable from this environment, so these were cross-checked
// against several dated secondary sources instead. Re-verify before relying on
// this for budgeting; OpenAI can change prices at any time.
const PRICE_PER_IMAGE_USD: Record<ImageQuality, { square: number; nonSquare: number }> = {
  low: { square: 0.011, nonSquare: 0.016 },
  medium: { square: 0.042, nonSquare: 0.063 },
  high: { square: 0.167, nonSquare: 0.25 },
};

export function estimateCostUsd(size: ImageSize, quality: ImageQuality, count: number): number {
  const perImage =
    size === "1024x1024"
      ? PRICE_PER_IMAGE_USD[quality].square
      : PRICE_PER_IMAGE_USD[quality].nonSquare;
  return perImage * count;
}

export class InvalidApiKeyError extends Error {}
export class ContentPolicyError extends Error {}

export interface GenerateImagesParams {
  apiKey: string;
  prompt: string;
  n: number;
  size: ImageSize;
  quality: ImageQuality;
}

export async function generateImages(params: GenerateImagesParams): Promise<string[]> {
  const { apiKey, prompt, n, size, quality } = params;

  const requestBody = JSON.stringify({
    model: "gpt-image-1",
    prompt,
    n,
    size,
    quality,
  });

  const send = () =>
    fetch(IMAGES_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: requestBody,
    });

  let res = await send();

  if (res.status === 429) {
    const retryAfterHeader = res.headers.get("retry-after");
    const waitMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 20_000;
    console.error(`Rate limited by OpenAI — waiting ${Math.round(waitMs / 1000)}s and retrying once...`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    res = await send();
  }

  if (!res.ok) {
    const payload: { error?: { message?: string; code?: string } } | null = await res
      .json()
      .catch(() => null);
    const message = payload?.error?.message ?? `HTTP ${res.status}`;
    const code = payload?.error?.code ?? "";

    if (res.status === 401) {
      throw new InvalidApiKeyError("OpenAI rejected the API key.");
    }
    if (code === "content_policy_violation" || code === "moderation_blocked") {
      throw new ContentPolicyError(message);
    }
    throw new Error(`OpenAI API error (${res.status}): ${message}`);
  }

  const json: { data: { b64_json: string }[] } = await res.json();
  return json.data.map((item) => item.b64_json);
}
