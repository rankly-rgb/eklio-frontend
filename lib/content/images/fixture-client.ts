import type {
  ContentImageClient,
  ContentImageResult,
  ContentImageUsage,
} from "@/lib/content/images/client";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  ⚠  FIXTURE. RIEN DE CE QUI SORT D'ICI N'A TOUCHÉ OPENAI.  ⚠
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le nom du fichier le dit, ce bandeau le répète, et `fixtureImageClient`
 * l'annonce dans sa signature de retour (`isFixture: true`). Trois fois, parce
 * qu'un chiffre de coût sorti d'ici et recopié dans un rapport sans étiquette
 * serait indiscernable d'une mesure.
 *
 * Les jetons ci-dessous sont un ORDRE DE GRANDEUR plausible pour un portrait
 * 1024×1536, et non une valeur observée. Ils servent à exercer le chaînage —
 * réservation → appel → lecture d'`usage` → règlement → déduplication — et à
 * rien d'autre.
 */

/** Marque de fabrique : un client de fixture le déclare, on ne le devine pas. */
export type FixtureImageClient = ContentImageClient & { readonly isFixture: true };

/** Des jetons plausibles, JAMAIS observés. Voir le bandeau. */
export const FIXTURE_USAGE: Record<"low" | "medium", ContentImageUsage> = {
  low: { input_tokens: 42, output_tokens: 1_560, total_tokens: 1_602 },
  medium: { input_tokens: 42, output_tokens: 3_180, total_tokens: 3_222 },
};

/** Un PNG minuscule mais valide : un pixel, pour que les octets soient de vrais octets. */
export const FIXTURE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

export type FixtureOptions = {
  /** Remplace `usage`. `null` simule une réponse qui n'en porte aucun. */
  usage?: ContentImageUsage | null;
  /** Lève au lieu de rendre. Pour les chemins de modération et de panne. */
  throws?: Error;
  /** Compte les appels, pour prouver qu'une déduplication n'en fait pas un second. */
  calls?: { n: number };
};

export function fixtureImageClient(options: FixtureOptions = {}): FixtureImageClient {
  return {
    isFixture: true,
    async generate(request): Promise<ContentImageResult> {
      if (options.calls) options.calls.n += 1;
      if (options.throws) throw options.throws;
      return {
        bytes: FIXTURE_PNG,
        contentType: "image/png",
        usage:
          options.usage === undefined
            ? FIXTURE_USAGE[request.quality === "medium" ? "medium" : "low"]
            : options.usage,
      };
    },
  };
}
