import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Où atterrit-on après une connexion réussie ?
 *
 * Le bug que ce fichier ferme : le proxy posait bien `?next=` en interceptant
 * une page protégée, mais `signIn` redirigeait inconditionnellement vers
 * `/app`. Sur le tunnel de paiement, ça donnait un praticien parti de
 * `/pricing` pour acheter, renvoyé vers son tableau de bord après connexion,
 * sans rien qui lui dise où était passé son achat — une intention perdue au
 * moment précis où elle était la plus forte.
 *
 * Le correctif ne peut pas se contenter de suivre `next` : ce paramètre vient
 * de l'URL, donc de n'importe qui. Les trois cas sont donc testés ensemble,
 * parce qu'ils ne valent que pris ensemble — suivre `next` sans le filtrer
 * échangerait une fuite de conversion contre une faille d'open redirect.
 */

const signInWithPassword = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword } }),
}));

/* `redirect()` lève en vrai : on reproduit ce contrat pour capter sa cible. */
class RedirectSignal extends Error {
  constructor(readonly target: string) {
    super(`redirect:${target}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    throw new RedirectSignal(target);
  },
}));

const { signIn } = await import("@/lib/actions/auth");

/** Soumet le formulaire de connexion et rend la cible de redirection. */
async function signInWith(next?: string | null): Promise<string> {
  const formData = new FormData();
  formData.set("email", "clinician@example.com");
  formData.set("password", "correct-horse-battery");
  if (next !== undefined && next !== null) formData.set("next", next);

  try {
    await signIn(null, formData);
  } catch (error) {
    if (error instanceof RedirectSignal) return error.target;
    throw error;
  }
  throw new Error("signIn n'a pas redirigé alors que la connexion a réussi");
}

beforeEach(() => {
  signInWithPassword.mockReset();
  signInWithPassword.mockResolvedValue({ error: null });
});

describe("next interne — on revient là où le praticien allait", () => {
  it("redirige vers la cible du checkout", async () => {
    expect(await signInWith("/app/checkout?plan=practice&project=abc")).toBe(
      "/app/checkout?plan=practice&project=abc"
    );
  });

  it("redirige vers n'importe quelle autre page interne", async () => {
    expect(await signInWith("/app/projets/abc/kit")).toBe(
      "/app/projets/abc/kit"
    );
    expect(await signInWith("/pricing")).toBe("/pricing");
  });
});

describe("next absent — comportement d'avant, inchangé", () => {
  it("redirige vers le tableau de bord", async () => {
    expect(await signInWith()).toBe("/app");
    expect(await signInWith("")).toBe("/app");
  });
});

describe("next externe — ignoré, pas d'open redirect", () => {
  it("refuse une URL absolue et retombe sur le tableau de bord", async () => {
    for (const hostile of [
      "https://evil.example",
      "http://evil.example/app/checkout",
      "javascript:alert(1)",
    ]) {
      expect(await signInWith(hostile)).toBe("/app");
    }
  });

  it("refuse les déguisements en chemin interne", async () => {
    // `//evil.example` et `/\evil.example` sont résolus par le navigateur
    // comme un autre domaine, malgré leur air de chemin relatif à la racine.
    for (const hostile of [
      "//evil.example",
      "/\\evil.example",
      "/%2F%2Fevil.example",
      "/\t/evil.example",
    ]) {
      expect(await signInWith(hostile)).toBe("/app");
    }
  });

  it("connecte quand même le praticien malgré un `next` hostile", async () => {
    // Le refus porte sur la DESTINATION, jamais sur l'authentification :
    // bloquer la connexion punirait la victime de l'attaque, pas l'attaquant.
    await signInWith("https://evil.example");
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "clinician@example.com",
      password: "correct-horse-battery",
    });
  });
});

describe("connexion refusée — aucune redirection, quel que soit `next`", () => {
  it("rend l'erreur au lieu de rediriger", async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials", message: "bad" },
    });

    const formData = new FormData();
    formData.set("email", "clinician@example.com");
    formData.set("password", "faux");
    formData.set("next", "/app/checkout");

    // Un `next` valide ne doit pas devenir une porte d'entrée : la redirection
    // n'a lieu qu'APRÈS une authentification réussie.
    await expect(signIn(null, formData)).resolves.toEqual({
      error: "That email and password don't match. Try again.",
    });
  });
});
