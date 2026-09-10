import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { claimAnonBrief } from "@/lib/anon/claim";
import { hashAnonToken } from "@/lib/anon/token";

/*
 * ── S'INSCRIRE RÉCLAME LE BRIEF, ÇA N'EN COMMENCE PAS UN AUTRE ──────────
 *
 * Elle a répondu à sept étapes et regarde trois directions. Le compte existe
 * pour qu'elle garde ÇA — donc la première chose qu'il doit faire est d'en
 * prendre possession.
 */

const ROOT = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** Un faux client : on observe les filtres, parce que ce sont eux la règle. */
function fakeAdmin(row: { id: string } | null, error?: { message: string }) {
  const filters: Record<string, unknown> = {};
  let patch: Record<string, unknown> = {};
  const chain = {
    update(next: Record<string, unknown>) { patch = next; return chain; },
    eq(col: string, value: unknown) { filters[`eq:${col}`] = value; return chain; },
    is(col: string, value: unknown) { filters[`is:${col}`] = value; return chain; },
    gt(col: string, value: unknown) { filters[`gt:${col}`] = value; return chain; },
    select() { return chain; },
    async maybeSingle() { return { data: row, error: error ?? null }; },
  };
  return {
    client: { from: () => chain } as never,
    seen: () => ({ filters, patch }),
  };
}

describe("réclamer", () => {
  it("attache la ligne et efface le jeton ET l'expiration", async () => {
    const admin = fakeAdmin({ id: "project-1" });
    const outcome = await claimAnonBrief(admin.client, {
      token: "T".repeat(43),
      userId: "user-1",
    });

    expect(outcome).toEqual({ claimed: true, projectId: "project-1" });

    const { patch } = admin.seen();
    expect(patch.user_id).toBe("user-1");
    /*
     * ⚠ LES DEUX ENSEMBLE. Le cookie qui pointait dessus ne vaut plus rien
     * pour qui le copie, et la purge ne doit jamais venir chercher une ligne
     * qu'elle possède. `projects_anon_expiry_check` autorise cette paire et
     * interdit l'autre.
     */
    expect(patch.anon_token_hash).toBeNull();
    expect(patch.anon_expires_at).toBeNull();
  });

  it("⚠ ne cherche que par EMPREINTE, jamais par jeton en clair", async () => {
    const token = "T".repeat(43);
    const admin = fakeAdmin({ id: "project-1" });
    await claimAnonBrief(admin.client, { token, userId: "user-1" });

    const { filters } = admin.seen();
    expect(filters["eq:anon_token_hash"]).toBe(hashAnonToken(token));
    expect(filters["eq:anon_token_hash"]).not.toBe(token);
  });

  it("⚠ et seulement une ligne NON RÉCLAMÉE et NON EXPIRÉE", async () => {
    const admin = fakeAdmin({ id: "project-1" });
    await claimAnonBrief(admin.client, { token: "T".repeat(43), userId: "user-1" });

    const { filters } = admin.seen();
    // Sans le premier, rejouer un vieux cookie déplacerait le projet de
    // quelqu'un d'autre d'un compte à l'autre.
    expect(filters["is:user_id"]).toBeNull();
    // Sans le second, un cookie gardé au-delà de l'échéance ressusciterait un
    // brief que la purge avait le droit d'effacer.
    expect(filters["gt:anon_expires_at"]).toBeTruthy();
  });

  it("sans cookie, il n'y a rien à réclamer et ce n'est pas une erreur", async () => {
    const admin = fakeAdmin(null);
    expect(await claimAnonBrief(admin.client, { token: null, userId: "u" })).toEqual({
      claimed: false,
      reason: "no_token",
    });
  });

  it("une ligne absente, déjà prise ou périmée rend le même verdict", async () => {
    const admin = fakeAdmin(null);
    expect(await claimAnonBrief(admin.client, { token: "T".repeat(43), userId: "u" })).toEqual({
      claimed: false,
      reason: "not_found",
    });
  });

  it("une panne se dit, et ne se confond pas avec une absence", async () => {
    const admin = fakeAdmin(null, { message: "boom" });
    expect(await claimAnonBrief(admin.client, { token: "T".repeat(43), userId: "u" })).toEqual({
      claimed: false,
      reason: "failed",
    });
  });
});

describe("l'inscription", () => {
  const AUTH = read("lib/actions/auth.ts");

  it("⚠ lit le cookie AVANT de créer le compte", () => {
    // `signUp` peut ouvrir une session, et `resolveBriefCaller` rendrait alors
    // la nouvelle utilisatrice en oubliant le cookie.
    expect(AUTH.indexOf("currentAnonToken")).toBeLessThan(AUTH.indexOf("auth.signUp"));
  });

  it("⚠ réclame SANS attendre de session", () => {
    /*
     * C'est ce qui sort la confirmation d'e-mail du chemin critique au lieu de
     * simplement la raccourcir : `signUp` rend l'id de la nouvelle
     * utilisatrice même quand aucune session n'est délivrée, donc le brief est
     * attaché tout de suite et l'attend, qu'elle entre directement ou qu'elle
     * doive confirmer d'abord.
     */
    expect(AUTH).toMatch(/if \(data\.user && anonToken\)/);
    expect(AUTH).toContain("claimAnonBrief");
    // La redirection dépend de la session, la réclamation non.
    expect(AUTH).toMatch(/data\.session \? "\/app" : "\/signup\/check-your-email"/);
  });

  it("et le cookie dépensé est supprimé", () => {
    // Sur un appareil partagé, le suivant porterait sinon un jeton vers le
    // projet réclamé de quelqu'un d'autre.
    expect(AUTH).toMatch(/jar\.delete\(ANON_COOKIE\)/);
  });
});

describe("la purge", () => {
  const CRON = read("app/api/cron/anon-briefs/route.ts");

  it("⚠ répète le filtre sur le DELETE, pas seulement sur le SELECT", () => {
    /*
     * Entre les deux, une de ces lignes peut avoir été réclamée par quelqu'un
     * qui vient de s'inscrire — et effacer le brief d'une personne qui vient
     * de créer un compte est la pire chose que cette route puisse faire.
     */
    const afterDelete = CRON.slice(CRON.indexOf(".delete()"));
    expect(afterDelete).toContain('.is("user_id", null)');
    expect(afterDelete).toContain('.lt("anon_expires_at"');
  });

  it("est planifiée, contrairement au cron de génération", () => {
    const crons = JSON.parse(read("vercel.json")) as { crons: { path: string }[] };
    expect(crons.crons.map((c) => c.path)).toContain("/api/cron/anon-briefs");
    // Celui qui dépense reste désarmé ; celui qui nettoie ne coûte rien.
    expect(crons.crons.map((c) => c.path)).not.toContain("/api/cron/content-month");
  });
});
