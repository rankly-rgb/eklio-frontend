import { z } from "zod";
import type { SeoKind } from "@/lib/seo/kinds";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  L'ACCÈS AUX TABLES ET AUX RPC SEO — UN SEUL ENDROIT, ET POURQUOI IL EST NON TYPÉ
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ LES TYPES SUPABASE N'ONT PAS ÉTÉ RÉGÉNÉRÉS (2026-11-12). Les tables
 * `seo_*` et les fonctions `claim_seo_slot`, `release_seo_slot`, `seo_quota_for`
 * n'existent pas dans `types/supabase.ts`, et ce fichier ne s'édite PAS à la
 * main : il se régénère depuis la base migrée (`supabase gen types`), ce que le
 * bac à sable de ce chantier ne pouvait pas faire (ni Docker, ni CLI).
 *
 * Plutôt que d'écrire ces types à la main ou de semer des `as never` dans tout
 * le chantier, l'accès passe par CE module :
 *
 *   - `seoDb(client)`  le client, vu sans son générique de schéma ;
 *   - `seoRpc(...)`    les trois RPC, nommées ICI avec leurs paramètres exacts.
 *                      `lib/seo/__tests__/rpc-contract.test.ts` confronte cette
 *                      table aux signatures SQL des migrations, à la place du
 *                      contrôleur générique (`lib/__tests__/rpc-signatures.test.ts`),
 *                      qui lit les types ;
 *   - chaque ligne LUE passe par un schéma Zod : une colonne renommée échoue à
 *     la lecture, bruyamment, au lieu de rendre `undefined`.
 *
 * Après régénération des types, ce module peut se resserrer (FOLLOWUP.md).
 */

type Result<T = unknown> = { data: T; error: { message: string; code?: string } | null };

/** Le sous-ensemble du client Supabase que le chantier SEO emploie. */
export type SeoClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<Result>;
};

export function seoDb(client: unknown): SeoClient {
  return client as SeoClient;
}

/* ── Les RPC du chantier, et leurs paramètres exacts ──────────────────── */

export const SEO_RPC_ARGS = {
  claim_seo_slot: ["p_user", "p_month", "p_kind"],
  release_seo_slot: ["p_claim_id", "p_reason"],
  seo_quota_for: ["p_user", "p_month"],
} as const;

export type SeoRpc = keyof typeof SEO_RPC_ARGS;

export async function seoRpc<N extends SeoRpc>(
  db: SeoClient,
  name: N,
  args: Record<(typeof SEO_RPC_ARGS)[N][number], unknown>
): Promise<unknown> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
}

/* ── Les réponses des RPC, lues par schéma ────────────────────────────── */

export const claimResultSchema = z.object({
  ok: z.boolean(),
  reason: z.string(),
  claim_id: z.string().uuid().optional(),
  kind: z.string().optional(),
  month: z.string().optional(),
});
export type ClaimResult = z.infer<typeof claimResultSchema>;

export async function claimSeoSlot(
  db: SeoClient,
  input: { userId: string; month: string; kind: SeoKind }
): Promise<ClaimResult> {
  const data = await seoRpc(db, "claim_seo_slot", { p_user: input.userId, p_month: input.month, p_kind: input.kind });
  return claimResultSchema.parse(data);
}

export async function releaseSeoSlot(db: SeoClient, claimId: string, reason: string): Promise<boolean> {
  const data = await seoRpc(db, "release_seo_slot", { p_claim_id: claimId, p_reason: reason });
  return z.object({ ok: z.boolean() }).parse(data).ok;
}

export async function seoQuotaFor(
  db: SeoClient,
  input: { userId: string; month: string }
): Promise<Record<SeoKind, number>> {
  const data = await seoRpc(db, "seo_quota_for", { p_user: input.userId, p_month: input.month });
  const rows = z.array(z.object({ kind: z.enum(["local_page", "article"]), slots: z.number().int() })).parse(data);
  const quota: Record<SeoKind, number> = { local_page: 0, article: 0 };
  for (const row of rows) quota[row.kind] = row.slots;
  return quota;
}

/* ── Les lignes, lues par schéma ──────────────────────────────────────── */

export const PIECE_STATUSES = ["draft", "needs_review", "approved", "exported", "published", "quarantined"] as const;
export type PieceStatus = (typeof PIECE_STATUSES)[number];

const faqItem = z.object({ question: z.string(), answer: z.string() });

export const internalLinkSchema = z.object({
  pieceId: z.string(),
  title: z.string(),
  href: z.string(),
  /** Vraie URL déclarée par elle, ou chemin suggéré tant qu'elle n'a pas publié. */
  published: z.boolean(),
});
export type InternalLink = z.infer<typeof internalLinkSchema>;

export const checklistStepSchema = z.object({ step: z.string(), detail: z.string() });
export type ChecklistStep = z.infer<typeof checklistStepSchema>;

export const pieceRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  target_id: z.string(),
  month: z.string(),
  kind: z.enum(["local_page", "article"]),
  status: z.enum(PIECE_STATUSES),
  title: z.string().nullable(),
  meta_description: z.string().nullable(),
  slug: z.string().nullable(),
  h1: z.string().nullable(),
  body_md: z.string().nullable(),
  faq: z.array(faqItem).nullable(),
  schema_jsonld: z.record(z.string(), z.unknown()).nullable(),
  internal_links: z.array(internalLinkSchema),
  checklist: z.array(checklistStepSchema),
  writer_model: z.string().nullable(),
  cost_usd: z.coerce.number(),
  approved_at: z.string().nullable(),
  exported_at: z.string().nullable(),
  published_url: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PieceRow = z.infer<typeof pieceRowSchema>;

export const PIECE_COLUMNS =
  "id, user_id, target_id, month, kind, status, title, meta_description, slug, h1, body_md, faq, schema_jsonld, internal_links, checklist, writer_model, cost_usd, approved_at, exported_at, published_url, created_at, updated_at";

export const targetRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  brand_kit_id: z.string(),
  kind: z.enum(["local_page", "article"]),
  template_id: z.string(),
  modality_key: z.string().nullable(),
  population_key: z.string().nullable(),
  state: z.string().nullable(),
  city: z.string().nullable(),
  primary_query: z.string(),
  intent_key: z.string(),
  status: z.enum(["available", "assigned", "retired"]),
  assigned_month: z.string().nullable(),
});
export type TargetRow = z.infer<typeof targetRowSchema>;

export const TARGET_COLUMNS =
  "id, user_id, brand_kit_id, kind, template_id, modality_key, population_key, state, city, primary_query, intent_key, status, assigned_month";
