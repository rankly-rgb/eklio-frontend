import { describe, expect, it } from "vitest";
import {
  ImageModerationError,
  ImageNotConfiguredError,
  ImageTransientError,
  openAiImageClient,
} from "@/lib/images/client";

/*
 * La frontière. Ce fichier ne fait qu'une chose qui compte : classer une
 * réponse en « à retenter », « prompt refusé » ou « pas configuré ». La suite
 * de la pipeline ne fait qu'obéir à cette classification, donc c'est ici
 * qu'elle doit être juste.
 *
 * Aucun appel réseau : `fetch` est injecté.
 */

function client(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  return openAiImageClient("sk-test-not-a-real-key", (async () => response) as unknown as typeof fetch);
}

const REQUEST = { prompt: "p", size: "1024x1024", quality: "medium", user: "u" } as const;

describe("la classification des réponses", () => {
  it("un 200 rend les octets décodés depuis b64_json", async () => {
    const c = client({
      ok: true,
      json: async () => ({ data: [{ b64_json: Buffer.from("hello").toString("base64") }], usage: { total_tokens: 7 } }),
    });
    const result = await c.generate(REQUEST);
    expect(result.bytes.toString()).toBe("hello");
    expect(result.contentType).toBe("image/webp");
    expect(result.usage).toEqual({ total_tokens: 7 });
  });

  it("un 200 sans image est transitoire, pas un succès vide", async () => {
    const c = client({ ok: true, json: async () => ({ data: [] }) });
    await expect(c.generate(REQUEST)).rejects.toBeInstanceOf(ImageTransientError);
  });

  it.each([429, 500, 502, 503])("un %s est transitoire", async (status) => {
    const c = client({ ok: false, status, json: async () => ({ error: { message: "later" } }) });
    await expect(c.generate(REQUEST)).rejects.toBeInstanceOf(ImageTransientError);
  });

  it.each(["content_policy_violation", "moderation_blocked"])(
    "« %s » est une modération, jamais un transitoire",
    async (code) => {
      const c = client({ ok: false, status: 400, json: async () => ({ error: { message: "refused", code } }) });
      await expect(c.generate(REQUEST)).rejects.toBeInstanceOf(ImageModerationError);
    }
  );

  it.each([401, 403])("un %s est « pas configuré », et ne dit rien de la clé", async (status) => {
    const c = client({ ok: false, status, json: async () => ({ error: { message: "bad key" } }) });
    await expect(c.generate(REQUEST)).rejects.toBeInstanceOf(ImageNotConfiguredError);
    await c.generate(REQUEST).catch((err: Error) => {
      // Jamais la clé, ni un fragment : seulement le fait qu'elle ne va pas.
      expect(err.message).not.toContain("sk-");
    });
  });

  it("un autre 4xx est notre bug : ni transitoire, ni modération", async () => {
    const c = client({ ok: false, status: 422, json: async () => ({ error: { message: "bad param" } }) });
    const err = await c.generate(REQUEST).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ImageTransientError);
    expect(err).not.toBeInstanceOf(ImageModerationError);
  });

  it("un réseau qui tombe n'est jamais arrivé jusqu'à une décision", async () => {
    const c = openAiImageClient("sk-test", (async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch);
    await expect(c.generate(REQUEST)).rejects.toBeInstanceOf(ImageTransientError);
  });

  it("sans clé, le client refuse d'être construit", () => {
    expect(() => openAiImageClient("")).toThrow(ImageNotConfiguredError);
  });
});
