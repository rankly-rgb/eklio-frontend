import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");
const code = (path: string) =>
  read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/*
 * ── UNE RPC REFUSE DANS UN 200 ───────────────────────────────────────────
 *
 * Les huit fonctions du contrat répondent à un refus par un 200 dont le CORPS
 * porte `{"error":{"code","message"}}`. PostgREST n'a rien à signaler : la
 * fonction a bien rendu un jsonb.
 *
 * D'où la règle de CHANTIER_LOG.md, écrite après que 325 appels « 200, zéro
 * ligne ERROR » m'aient servi de preuve que la lecture allait bien : le statut
 * dit que le transport a marché, ce qui n'était pas la question. On lit
 * l'ENVELOPPE.
 *
 * Ces tests tiennent les deux moitiés de la règle : que la lecture se fasse
 * avec le client de session (sans quoi `auth.uid()` est NULL et les huit
 * fonctions refusent), et qu'une panne ne puisse pas se faire passer pour une
 * ligne absente.
 */

const EDITOR_PAGE = "app/app/brand-kits/[id]/site-editor/page.tsx";

describe("la spec se lit avec la session de la praticienne", () => {
  it("la page ouvre le client de session, jamais un client sans session", () => {
    const body = code(EDITOR_PAGE);
    expect(body).toContain('from "@/lib/supabase/server"');
    expect(body).toMatch(/createClient\s*\(\s*\)/);
    // `auth.uid()` est NULL sur service_role : la lecture répondrait
    // `unauthenticated` pour tout le monde, tout le temps.
    expect(body).not.toMatch(/createAdminClient\s*\(/);
  });

  it("⚠ le client passé à siteSpecGet est celui que la page a authentifié", () => {
    const body = code(EDITOR_PAGE);
    // Une session résolue, puis la MÊME variable portée jusqu'à la lecture.
    expect(body).toMatch(/const\s+supabase\s*=\s*await\s+createClient\(\)/);
    expect(body).toMatch(/siteSpecGet\(\s*supabase\s*,/);
    expect(body).toMatch(/auth\.getUser\(\)/);
  });

  it("la couche d'appel n'accepte qu'un client typé de session", () => {
    // `call()` prend `Client = SupabaseClient<Database>` et la doc du module
    // dit pourquoi. Si quelqu'un élargissait ce type, ce test le dirait.
    const rpc = read("lib/site/rpc.ts");
    expect(rpc).toContain("type Client = SupabaseClient<Database>");
    expect(rpc).toContain("auth.uid()");
  });
});

describe("⚠ une panne ne se déguise pas en spec absente", () => {
  it("`call` traduit bien une erreur de transport en 500", () => {
    const rpc = code("lib/site/rpc.ts");
    // Le code rendu est `not_found` — le MÊME que pour une ligne absente.
    // C'est `status` qui les sépare, et c'est pour ça qu'il doit être lu.
    expect(rpc).toMatch(/status:\s*500/);
  });

  it("la page lit le STATUT avant le code, et ne redirige pas sur un 500", () => {
    const body = code(EDITOR_PAGE);
    expect(body).toContain("envelope.status !== 500");
    const guard = body.indexOf("envelope.status !== 500");
    // Les deux redirections sont DERRIÈRE la garde, pas devant.
    expect(guard).toBeLessThan(body.indexOf('envelope.error.code === "payment_required"'));
    expect(guard).toBeLessThan(body.indexOf('envelope.error.code === "not_found"'));
  });

  it("le throw nomme le statut, pour qu'un journal distingue les deux cas", () => {
    expect(code(EDITOR_PAGE)).toContain("status ${envelope.status}");
  });

  it("la règle est écrite là où la prochaine session la lira", () => {
    const log = read("CHANTIER_LOG.md");
    expect(log).toContain("READ THE ENVELOPE, NOT THE STATUS");
    expect(log).toContain("are not evidence that a call succeeded");
  });
});
