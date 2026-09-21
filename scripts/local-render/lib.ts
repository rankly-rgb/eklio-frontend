/*
 * ── LE HARNAIS DU PREMIER RENDU RÉEL ────────────────────────────────────
 *
 * Ces quatre scripts existent pour produire UN mois réel sur une base locale,
 * et pour que quelqu'un d'autre puisse le reproduire. Ils ne font pas partie
 * du produit : `app/` n'en importe rien, et rien ici ne tourne sur Vercel.
 *
 * ⚠ CE QU'ILS SONT, ET CE QU'ILS NE SONT PAS. Le schéma, les RPC, les gardes
 * déontologiques, les validateurs de payload et le rendu sont ceux du produit,
 * sans double. Ce que ces fichiers ajoutent, ce sont les DEUX PILOTES qui
 * n'existaient nulle part dans le dépôt — la soumission d'un lot à la Batch
 * API, et le remplissage de la banque de sujets — et c'est dit en toutes
 * lettres dans `design/preview-2026-09-21/README.md`.
 *
 * ⚠ LA CLEF N'EST JAMAIS ÉCRITE. Elle arrive par `ANTHROPIC_API_KEY` sur la
 * ligne de commande, elle n'est lue qu'ici, et aucun de ces scripts ne
 * l'imprime — pas même tronquée.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";

export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

export function anthropicKeyOrDie(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Pass it on the command line — never in a file:\n" +
        '  ANTHROPIC_API_KEY="$EKLIO_ANTHROPIC_API_KEY" npx tsx scripts/local-render/...'
    );
  }
  return key;
}

/** Le compte de test, nommé une fois. */
export const TEST_EMAIL = "rowan.mercier@eklio-test.invalid";
export const MONTH = "2026-10-01";

export async function testKit(db: ReturnType<typeof admin>) {
  const { data: user } = await db.from("profiles").select("id").eq("email", TEST_EMAIL).single();
  if (!user) throw new Error(`No test account for ${TEST_EMAIL}. Run 00-account.ts first.`);
  const { data: project } = await db.from("projects").select("id").eq("user_id", user.id).single();
  if (!project) throw new Error("The test account has no project.");
  const { data: kit } = await db.from("brand_kits").select("id").eq("project_id", project.id).single();
  if (!kit) throw new Error("The test account has no brand kit.");
  return { userId: user.id, projectId: project.id, kitId: kit.id };
}

/* ── Le plafond, en dollars, lu avant chaque appel et jamais après ────── */

export const SESSION_CAP_USD = 2;

export async function spentSoFarUsd(db: ReturnType<typeof admin>): Promise<number> {
  const { data } = await db
    .from("credit_ledger")
    .select("actual_cost_usd, estimated_cost_usd");
  return (data ?? []).reduce(
    (total, row) => total + Number(row.actual_cost_usd ?? row.estimated_cost_usd ?? 0),
    0
  );
}

/*
 * ⚠ LES QUATRE TABLES QUE LES TYPES NE CONNAISSENT PAS, ET POURQUOI.
 *
 * `types/supabase.ts` est généré depuis le projet Supabase déployé. Ce projet
 * n'a pas les migrations du chantier, donc quatre tables du 20 et 21 septembre
 * n'y figurent pas : `content_segments`, `topic_assignments`,
 * `content_intents`, `on_demand_writes`.
 *
 * Le produit ne bute jamais dessus — il ne les atteint qu'à travers des RPC,
 * qui sont typées. Un script qui lit ou écrit ces tables directement est le
 * premier à le découvrir, et c'est ce qu'a fait ce rendu. La sortie de secours
 * est nommée ici plutôt que recopiée à quatre endroits, pour qu'elle disparaisse
 * d'un seul coup le jour où les types sont régénérés.
 */
type EqChain<Row> = {
  eq: (column: string, value: unknown) => EqChain<Row>;
  maybeSingle: () => PromiseLike<{ data: Row | null; error: unknown }>;
};

export function untypedTable<Row>(db: ReturnType<typeof admin>, table: string) {
  return (db as unknown as {
    from: (t: string) => {
      select: (columns: string) => PromiseLike<{ data: Row[] | null; error: unknown }> & {
        eq: (column: string, value: unknown) => EqChain<Row>;
      };
      insert: (row: Record<string, unknown>) => {
        select: (columns: string) => { single: () => PromiseLike<{ data: Row | null; error: unknown }> };
      };
    };
  }).from(table);
}
