import { z } from "zod";
import { PIECE_COLUMNS, pieceRowSchema, seoDb, type PieceRow } from "@/lib/seo/db";

/*
 * Les lectures de l'écran, avec le client de SESSION : la RLS de `seo_pieces`
 * ne lui montre que ses pièces, jamais un brouillon ni une quarantaine, et
 * reste lisible après résiliation (son historique est à elle).
 */

export type PieceView = PieceRow & { primaryQuery: string };

async function withQueries(client: unknown, rows: PieceRow[]): Promise<PieceView[]> {
  if (rows.length === 0) return [];
  const db = seoDb(client);
  const { data, error } = await db
    .from("seo_targets")
    .select("id, primary_query")
    .in("id", [...new Set(rows.map((r) => r.target_id))]);
  if (error) throw new Error(`seo_targets: ${error.message}`);
  const queries = new Map(
    z.array(z.object({ id: z.string(), primary_query: z.string() })).parse(data ?? []).map((t) => [t.id, t.primary_query])
  );
  return rows.map((r) => ({ ...r, primaryQuery: queries.get(r.target_id) ?? r.title ?? "" }));
}

const KIND_ORDER = { local_page: 0, article: 1 } as const;

export async function readMonthPieces(client: unknown, month: string): Promise<PieceView[]> {
  const { data, error } = await seoDb(client).from("seo_pieces").select(PIECE_COLUMNS).eq("month", month).order("created_at");
  if (error) throw new Error(`seo_pieces: ${error.message}`);
  const rows = z.array(pieceRowSchema).parse(data ?? []);
  rows.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  return withQueries(client, rows);
}

/** Les mois où elle a des pièces, le plus récent d'abord. */
export async function readPieceMonths(client: unknown): Promise<string[]> {
  const { data, error } = await seoDb(client).from("seo_pieces").select("month").order("month", { ascending: false });
  if (error) throw new Error(`seo_pieces months: ${error.message}`);
  return [...new Set(z.array(z.object({ month: z.string() })).parse(data ?? []).map((r) => r.month))];
}

export async function readPiece(client: unknown, id: string): Promise<PieceView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await seoDb(client).from("seo_pieces").select(PIECE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`seo_pieces: ${error.message}`);
  if (!data) return null;
  const [view] = await withQueries(client, [pieceRowSchema.parse(data)]);
  return view;
}

/** Ses pièces que d'autres peuvent citer : pour recalculer les liens internes à l'affichage. */
export async function readLinkablePieces(client: unknown) {
  const { data, error } = await seoDb(client)
    .from("seo_pieces")
    .select("id, title, slug, status, published_url")
    .in("status", ["approved", "exported", "published"]);
  if (error) throw new Error(`seo_pieces (links): ${error.message}`);
  return z
    .array(z.object({ id: z.string(), title: z.string().nullable(), slug: z.string().nullable(), status: z.string(), published_url: z.string().nullable() }))
    .parse(data ?? []);
}
