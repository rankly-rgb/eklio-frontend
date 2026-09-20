import {
  contentImageModel,
  CONTENT_IMAGE_SIZE,
  type ContentImageQuality,
} from "@/lib/content/images/config";

/*
 * ── LE CLIENT, ET POURQUOI C'EST UNE INTERFACE ──────────────────────────
 *
 * Même forme que `lib/images/client.ts`, et pour la même raison : toute
 * l'orchestration — réserver, appeler, lire `usage`, régler, dédupliquer —
 * doit être exerçable sans clef et sans dépenser. Si la seule façon
 * d'éprouver ce chemin était d'appeler l'API, personne n'écrirait le second
 * test.
 *
 * ⚠ ET LE DOUBLE DE TEST EST DANS UN FICHIER QUI LE DIT.
 * `fixture-client.ts` : le nom est le premier endroit où quelqu'un apprend que
 * ce qui en sort n'a jamais touché OpenAI. Un double nommé `stub-client` ou
 * `client-test` laisserait la question ouverte une ligne de plus qu'il ne
 * faut.
 */

const IMAGES_ENDPOINT = "https://api.openai.com/v1/images/generations";

/** Ce que l'API dit avoir consommé. LA source du coût réel. */
export type ContentImageUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
};

export type ContentImageRequest = {
  prompt: string;
  quality: ContentImageQuality;
  /** Transmis comme `user` à OpenAI, pour leur outillage anti-abus. Jamais journalisé ici. */
  user: string;
};

export type ContentImageResult = {
  bytes: Buffer;
  contentType: string;
  /**
   * ⚠ SANS `usage`, IL N'Y A PAS DE COÛT RÉEL. Ce modèle n'a pas de prix
   * forfaitaire par image : une réponse sans `usage` ne peut pas être
   * valorisée, et `imageCostUsd` rend `null` plutôt qu'un nombre.
   */
  usage: ContentImageUsage | null;
};

export interface ContentImageClient {
  generate(request: ContentImageRequest): Promise<ContentImageResult>;
  /**
   * `false` quand ce client SAIT qu'il ne peut pas appeler — typiquement une
   * `OPENAI_API_KEY` absente.
   *
   * ⚠ IL EXISTE POUR QU'ON N'AIT PAS À RÉSERVER UN CRÉDIT POUR L'APPRENDRE.
   * Sans lui, le chemin réserve, appelle, échoue, relâche : trois lignes de
   * journal et un aller-retour pour une configuration qu'on pouvait lire
   * d'abord. Optionnel, parce qu'un double de test est toujours capable
   * d'appeler et n'a rien à déclarer.
   */
  configured?(): boolean;
}

/** Le prompt a été refusé. Terminal : un opérateur doit le voir, pas une boucle de réessai. */
export class ContentImageModerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentImageModerationError";
  }
}

/** Un timeout, un 429, un 5xx, une connexion coupée. Réessayé exactement une fois. */
export class ContentImageTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentImageTransientError";
  }
}

/** La clef n'est pas configurée. Distincte d'un échec d'appel, comme côté Anthropic. */
export class ContentImageNotConfiguredError extends Error {
  constructor() {
    super(
      "OPENAI_API_KEY is not set. Custom visuals are disabled until it is configured server-side."
    );
    this.name = "ContentImageNotConfiguredError";
  }
}

function classify(status: number, body: string): Error {
  // ⚠ UNE MODÉRATION N'EST PAS UNE PANNE. Réessayer un prompt refusé dépense
  // pour se faire refuser à nouveau. La distinction est faite ici, à la
  // frontière, et portée comme une classe jusqu'au bout.
  if (status === 400 && /moderation|safety|content_policy/i.test(body)) {
    return new ContentImageModerationError(body.slice(0, 500));
  }
  if (status === 429 || status >= 500) {
    return new ContentImageTransientError(`${status}: ${body.slice(0, 200)}`);
  }
  return new Error(`OpenAI images ${status}: ${body.slice(0, 500)}`);
}

/**
 * L'implémentation réelle. Utilisée à un seul endroit — le chemin de
 * production — et jamais dans un test.
 */
export function openAiContentImageClient(): ContentImageClient {
  return {
    // ⚠ LUE À CHAQUE APPEL. Une clef posée après le démarrage doit être vue.
    configured: () => Boolean(process.env.OPENAI_API_KEY),

    async generate(request) {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new ContentImageNotConfiguredError();

      let response: Response;
      try {
        response = await fetch(IMAGES_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: contentImageModel(),
            prompt: request.prompt,
            size: CONTENT_IMAGE_SIZE,
            quality: request.quality,
            n: 1,
            user: request.user,
          }),
        });
      } catch (error) {
        throw new ContentImageTransientError(String(error));
      }

      if (!response.ok) {
        throw classify(response.status, await response.text());
      }

      const payload = (await response.json()) as {
        data?: Array<{ b64_json?: string }>;
        usage?: ContentImageUsage;
      };

      const b64 = payload.data?.[0]?.b64_json;
      if (!b64) {
        // Une 200 sans image est une panne de l'autre côté, pas un refus.
        throw new ContentImageTransientError("OpenAI returned 200 with no image data");
      }

      return {
        bytes: Buffer.from(b64, "base64"),
        contentType: "image/png",
        usage: payload.usage ?? null,
      };
    },
  };
}
