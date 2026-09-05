import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/*
 * La garde qui compte dans ces deux scripts : une clé service_role contourne
 * RLS, donc un run qui en utiliserait une ne prouverait rien sur la frontière
 * même qu'il existe pour exercer. Elle est détectée par CONTENU, jamais par le
 * nom de la variable -- c'est précisément une clé secrète collée dans une
 * variable nommée NEXT_PUBLIC_... qu'il faut attraper.
 */

const JWT = (role: string) =>
  ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify({ role })).toString("base64url"), "sig"].join(".");

async function keyFrom(value: string): Promise<{ key?: string; died?: string }> {
  vi.resetModules();
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = value;
  const { publishableKey } = await import("@/scripts/brand-image/shared");
  try {
    return { key: publishableKey() };
  } catch (err) {
    return { died: (err as Error).message };
  }
}

describe("publishableKey refuse une clé secrète", () => {
  const exit = process.exit;
  const write = process.stderr.write;
  let stderr = "";

  beforeEach(() => {
    stderr = "";
    // `die` appelle process.exit ; on le transforme en throw pour l'observer.
    process.exit = ((code?: number) => {
      throw new Error(`exit:${code}\n${stderr}`);
    }) as never;
    process.stderr.write = ((chunk: string) => {
      stderr += chunk;
      return true;
    }) as never;
  });

  afterEach(() => {
    process.exit = exit;
    process.stderr.write = write;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  });

  it.each([
    ["le préfixe sb_secret_", "sb_secret_abc123"],
    ["un JWT dont le rôle est service_role", JWT("service_role")],
  ])("%s est refusé", async (_label, value) => {
    const result = await keyFrom(value);
    expect(result.key).toBeUndefined();
    expect(result.died).toContain("service_role");
  });

  it.each([
    ["le préfixe sb_publishable_", "sb_publishable_abc123"],
    ["un JWT dont le rôle est anon", JWT("anon")],
  ])("%s passe", async (_label, value) => {
    const result = await keyFrom(value);
    expect(result.key).toBe(value);
  });

  it("une clé de forme inconnue passe plutôt que de bloquer la procédure", async () => {
    // Le refus vise une erreur précise et connaissable. Bloquer tout ce qu'on
    // ne reconnaît pas rendrait la procédure impossible le jour où Supabase
    // change de format, sans rien avoir protégé.
    const result = await keyFrom("some-other-shape");
    expect(result.key).toBe("some-other-shape");
  });
});
