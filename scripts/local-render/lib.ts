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
import { readFileSync } from "node:fs";
import type { Database } from "../../types/supabase";

/*
 * ── `.env.local` EST LU ICI, ET LA CLEF ANTHROPIC N'Y EST PAS ───────────
 *
 * ⚠ ET C'EST PRÉCISÉMENT POURQUOI ON PEUT LE LIRE. Ce fichier ne porte que
 * l'adresse de la façade locale et les deux JWT qu'`edge/up.sh` re-tire à
 * chaque démarrage — ils ne valent que sur cette machine, et l'un d'eux change
 * à chaque exécution. La clef Anthropic, elle, continue d'arriver par la ligne
 * de commande et par elle seule (`anthropicKeyOrDie`).
 *
 * Sans cette lecture, chaque script devait être précédé d'un `export` dans le
 * shell, et un shell qui ne survit pas entre deux commandes — un agent, un
 * script CI, un second terminal — faisait échouer le harnais sur une erreur de
 * configuration qui ressemblait à une erreur de produit.
 */
function fromEnvLocal(name: string): string | undefined {
  try {
    const line = readFileSync(".env.local", "utf8")
      .split("\n")
      .find((l) => l.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") || undefined;
  } catch {
    return undefined;
  }
}

/** La variable d'environnement, sinon `.env.local`. */
export function localEnv(name: string): string | undefined {
  return process.env[name] ?? fromEnvLocal(name);
}

export function admin() {
  const url = localEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = localEnv("SUPABASE_SERVICE_ROLE_KEY");
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
/**
 * Le mois visé.
 *
 * ⚠ SURCHARGEABLE, PARCE QUE LE QUOTA EST MENSUEL. `credit_quotas` accorde 30
 * `post_generation` par personne ET PAR MOIS, et `credit_ledger` est en ajout
 * seul : une mesure refaite sur le même mois se heurte au quota déjà consommé
 * par la précédente. Mesurer le mois suivant est plus honnête que de créer une
 * praticienne de plus à chaque essai — et c'est aussi ce qu'une abonnée fait.
 */
export const MONTH = (() => {
  const i = process.argv.indexOf("--month");
  return i === -1 ? "2026-10-01" : (process.argv[i + 1] ?? "2026-10-01");
})();

/**
 * Le compte de test, ou un autre, nommé par son email.
 *
 * ⚠ UN SECOND COMPTE PLUTÔT QU'UN SCRIPT QUI ÉCRASE. `20-month.ts` refuse
 * d'écraser un mois — « un mois, une fois, jusqu'à ce qu'il soit lu » — et
 * c'est un refus qu'on ne contourne pas pour se simplifier une mesure. Pour
 * regénérer un mois, on crée une praticienne de plus.
 */
export async function accountFor(db: ReturnType<typeof admin>, email?: string | null) {
  const wanted = email?.trim() || TEST_EMAIL;
  const { data: user } = await db.from("profiles").select("id").eq("email", wanted).single();
  if (!user) throw new Error(`No account for ${wanted}.`);
  const { data: project } = await db.from("projects").select("id").eq("user_id", user.id).limit(1).single();
  if (!project) throw new Error(`${wanted} has no project.`);
  const { data: kit } = await db.from("brand_kits").select("id").eq("project_id", project.id).single();
  if (!kit) throw new Error(`${wanted} has no brand kit.`);
  return { userId: user.id, projectId: project.id, kitId: kit.id };
}

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

/**
 * Ce qu'un run a le droit de dépenser.
 *
 * ⚠ IL ÉTAIT IMPRIMÉ DANS CHAQUE RAPPORT ET N'ARRÊTAIT RIEN. `capUsd: 2`
 * figurait au bas de tous les rapports de mois et de banque depuis le premier
 * jour, à côté du coût réel, et rien ne le lisait : une valeur juste, publiée
 * au bon endroit, branchée d'un seul côté — la classe de F27, dans le fichier
 * qui la recense.
 *
 * ⚠ ET IL NE PEUT PAS SE MESURER SUR LE LEDGER. `spentSoFarUsd` somme TOUT
 * l'historique — 10,82 $ au 2026-09-24 — donc un plafond de session comparé à
 * lui refuserait tout, pour toujours. La grandeur juste est ce que CE run
 * dépense.
 */
export const SESSION_CAP_USD = (() => {
  const asked = Number(process.env.CONTENT_SESSION_CAP_USD);
  return Number.isFinite(asked) && asked > 0 ? asked : 2;
})();

let spentThisRun = 0;

/** Ce que ce run a dépensé jusqu'ici. */
export function runSpendUsd(): number {
  return spentThisRun;
}

/**
 * Inscrit une dépense, et arrête le run si le plafond est franchi.
 *
 * ⚠ IL ARRÊTE APRÈS, PAS AVANT, et c'est assumé : le coût d'un appel n'est
 * connu qu'une fois l'appel fait. Ce qu'il empêche est le SUIVANT — un run qui
 * boucle, un lot relancé, dix mois lancés d'affilée. Un plafond qui prétendrait
 * arrêter la première dépense mentirait sur ce qu'il sait.
 */
export function noteSpend(usd: number, what: string): void {
  spentThisRun += usd;
  if (spentThisRun > SESSION_CAP_USD) {
    throw new Error(
      `plafond de dépense franchi : ${spentThisRun.toFixed(4)} $ > ${SESSION_CAP_USD} $ ` +
      `(dernier poste : ${what}). Relever CONTENT_SESSION_CAP_USD, en connaissance de cause.`
    );
  }
}

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
export type DeleteChain = {
  eq: (column: string, value: unknown) => DeleteChain;
  in: (column: string, values: unknown[]) => PromiseLike<{ error: unknown }>;
};

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
      delete: () => DeleteChain;
      insert: (row: Record<string, unknown>) => {
        select: (columns: string) => { single: () => PromiseLike<{ data: Row | null; error: unknown }> };
      };
    };
  }).from(table);
}
