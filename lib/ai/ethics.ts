import "server-only";

import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { anthropic, GENERATION_MODEL } from "@/lib/ai/client";
import type { EthicsRule } from "@/lib/ai/directions";

/**
 * L'Ethics Guard.
 *
 * La base stocke le VERDICT (`brand_kits.ethics_check`) et en valide la forme.
 * Le contrôle lui-même appartient à ce repo : il demande un appel au modèle,
 * et le schéma ne fait pas d'appels.
 *
 * On passe après la génération plutôt qu'à sa place : les six règles sont déjà
 * dans le prompt de génération, ce second passage est le filet, pas la
 * première ligne.
 */

const FindingSchema = z.object({
  field: z.string(),
  excerpt: z.string(),
  rule_id: z.string(),
  rewrite: z.string(),
});

const VerdictSchema = z.object({
  findings: z.array(FindingSchema),
});

export type EthicsFinding = z.infer<typeof FindingSchema>;

export type EthicsCheck = {
  passed: boolean;
  flagged: { field: string; excerpt: string; rule_id: string }[];
  checked_at: string;
};

/**
 * `fields` est une carte chemin → texte. Le chemin est rendu tel quel dans
 * `flagged[].field`, donc il doit désigner sans ambiguïté où la phrase vit
 * (`directions[1].hero.subhead`), pour qu'une relecture humaine la retrouve.
 */
export async function runEthicsGuard(
  fields: Record<string, string>,
  rules: EthicsRule[],
  limits: Record<string, number>
): Promise<{ check: EthicsCheck; rewrites: Record<string, string> }> {
  const client = anthropic();

  const response = await client.messages.parse({
    model: GENERATION_MODEL,
    max_tokens: 8000,
    system: `You review marketing copy written for a therapist in private practice in the United States, against six rules. A line that breaks one of them is a claim made about a clinician's practice that she cannot stand behind.

THE RULES
${rules.map((r) => `- ${r.id} — ${r.short_label}: ${r.description} Never: "${r.example_forbidden}"`).join("\n")}

Return one finding per line that breaks a rule. For each, give:
- field: the path exactly as it was given to you.
- excerpt: the offending words, verbatim, as they appear in that field.
- rule_id: one of ${rules.map((r) => r.id).join(", ")}.
- rewrite: the FULL replacement text for that field, keeping her voice and meaning, with the violation removed.

A rewrite must respect the same character limit as the field it replaces:
${Object.entries(limits).map(([k, v]) => `- any field ending in ${k}: at most ${v} characters`).join("\n")}

Return an empty findings list when nothing breaks a rule. Do not flag copy for being plain, short, or unexciting — that is not what these rules are for.`,
    messages: [
      {
        role: "user",
        content: Object.entries(fields)
          .map(([path, text]) => `${path}\n${text}`)
          .join("\n\n"),
      },
    ],
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(VerdictSchema) },
  });

  const findings = response.parsed_output?.findings ?? [];
  const rewrites: Record<string, string> = {};
  for (const f of findings) {
    if (f.rewrite && fields[f.field] !== undefined) rewrites[f.field] = f.rewrite;
  }

  return {
    check: {
      // `passed` dit qu'il ne reste rien à corriger APRÈS réécriture. Ce que
      // le garde a trouvé reste inscrit dans `flagged` : le kit garde la trace
      // de ce qui a été attrapé, même quand il a été réparé.
      passed: findings.every((f) => Boolean(rewrites[f.field])),
      flagged: findings.map(({ field, excerpt, rule_id }) => ({ field, excerpt, rule_id })),
      checked_at: new Date().toISOString(),
    },
    rewrites,
  };
}
