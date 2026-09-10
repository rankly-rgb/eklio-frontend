import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { signUpMessage } from "@/lib/auth/signup-message";

/*
 * ── CE QU'UNE PROSPECT LIT QUAND L'INSCRIPTION ÉCHOUE ───────────────────
 *
 * Mesuré pendant la marche d'acquisition, sur un téléphone : après soixante
 * secondes de « One moment… », une thérapeute a lu
 *
 *   « We couldn't create the account: Unexpected token 'H', "Host not i"...
 *     is not valid JSON »
 *
 * La panne amont venait du bac à sable ; l'écran qui l'affiche, non. Ce
 * fichier tient la règle : le message d'amont ne sort jamais, et le cas par
 * défaut est une phrase d'humain.
 */

const ROOT = resolve(__dirname, "../../..");
const AUTH = readFileSync(join(ROOT, "lib/actions/auth.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("le message d'amont ne sort jamais", () => {
  it("la correspondance vit hors du module d'actions serveur", () => {
    /*
     * `lib/actions/auth.ts` est `"use server"` : tout export y doit être une
     * fonction async. `tsc` et la suite ont accepté une fonction pure dedans ;
     * `next build` l'a refusée. Gardé ici pour que le prochain qui ajoute un
     * message le mette au bon endroit du premier coup.
     */
    expect(AUTH).toContain('from "@/lib/auth/signup-message"');
    expect(AUTH).not.toContain("export function signUpMessage");
  });

  it("aucune interpolation de `error.message` dans ce qu'elle lit", () => {
    // ⚠ LA RÉGRESSION EXACTE. `${error.message}` dans une chaîne rendue est ce
    //   qui a mis un message d'analyseur JSON devant une clinicienne.
    expect(AUTH).not.toMatch(/error:\s*`[^`]*\$\{error\.message\}/);
  });

  it("mais il est journalisé, parce qu'un ingénieur en a besoin", () => {
    expect(AUTH).toMatch(/console\.error\([^)]*error\.message/);
  });
});

describe("chaque cas dit quoi faire ensuite", () => {
  const CASES = [
    ["user_already_exists", /Sign in instead/],
    ["email_exists", /Sign in instead/],
    ["weak_password", /at least 8 characters/],
    ["email_address_invalid", /Check it and try again/],
    ["over_email_send_rate_limit", /Wait a minute/],
    ["signup_disabled", /Email us/],
  ] as const;

  it.each(CASES)("%s", (code, expected) => {
    expect(signUpMessage(code)).toMatch(expected);
  });

  it("et le cas par défaut est une phrase, pas un code", () => {
    for (const unknown of [undefined, "some_new_supabase_code", "unexpected_failure"]) {
      const message = signUpMessage(unknown);
      expect(message).toBe(
        "Something went wrong on our side, not yours. Try again in a moment."
      );
      // Rien de machine : ni le code, ni un guillemet d'analyseur, ni « JSON ».
      expect(message).not.toMatch(/JSON|token|undefined|_/);
    }
  });

  it("aucun message ne laisse la prospect sans geste suivant", () => {
    const all = [
      ...CASES.map(([code]) => signUpMessage(code)),
      signUpMessage(undefined),
    ];
    expect(all.length).toBeGreaterThanOrEqual(7); // anti-vacuité
    for (const message of all) {
      expect(message.length).toBeGreaterThan(30);
      expect(message).toMatch(/\.$/);
    }
  });
});

describe("l'attente a une échéance côté client", () => {
  const FORM = readFileSync(join(ROOT, "components/auth-form.tsx"), "utf8");

  it("bien en deçà des soixante secondes mesurées", () => {
    const slow = Number(FORM.match(/SLOW_AFTER_MS\s*=\s*([\d_]+)/)?.[1].replace(/_/g, ""));
    const stuck = Number(FORM.match(/STUCK_AFTER_MS\s*=\s*([\d_]+)/)?.[1].replace(/_/g, ""));
    expect(slow).toBeGreaterThan(0);
    expect(slow).toBeLessThan(15_000);
    expect(stuck).toBeGreaterThan(slow);
    expect(stuck).toBeLessThan(30_000);
  });

  it("et elle dit que rien n'est perdu", () => {
    expect(FORM).toMatch(/haven't been lost/);
    expect(FORM).toContain('role="status"');
  });
});
