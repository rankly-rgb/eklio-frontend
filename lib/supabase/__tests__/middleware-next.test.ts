import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/*
 * Ce que le proxy emporte quand il intercepte une page protégée.
 *
 * L'autre moitié du correctif `next`. Faire consommer `next` par `/login` ne
 * sert à rien si le proxy n'y met pas ce qu'il faut : `/app/checkout` sans sa
 * query string ramène le praticien sur le tier RECOMMANDÉ par défaut, pas sur
 * celui qu'il venait de choisir. La redirection marche, l'achat non — et
 * personne ne voit rien, parce qu'un Signature dégradé en Practice reste une
 * page de checkout parfaitement crédible.
 */

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      // Pas de session : c'est le cas qui déclenche la redirection.
      getUser: async () => ({ data: { user: null } }),
    },
  }),
}));

const { updateSession } = await import("@/lib/supabase/middleware");
const { safeNextPath } = await import("@/lib/auth/next-url");

/** Renvoie le `next` posé par le proxy pour une URL protégée donnée. */
async function nextFor(url: string): Promise<string | null> {
  const response = await updateSession(
    new NextRequest(new URL(url, "https://eklio.test"))
  );
  const location = response.headers.get("location");
  if (!location) return null;
  return new URL(location).searchParams.get("next");
}

describe("le proxy emporte le chemin ET la query string", () => {
  it("conserve le tier choisi au checkout", async () => {
    expect(await nextFor("/app/checkout?plan=signature&project=abc")).toBe(
      "/app/checkout?plan=signature&project=abc"
    );
  });

  it("conserve un chemin sans query, sans y ajouter de `?` parasite", async () => {
    expect(await nextFor("/app")).toBe("/app");
    expect(await nextFor("/app/projets/abc/kit")).toBe(
      "/app/projets/abc/kit"
    );
  });

  it("redirige bien vers /login", async () => {
    const response = await updateSession(
      new NextRequest(new URL("/app/checkout", "https://eklio.test"))
    );
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });

  it("laisse passer une page publique sans redirection", async () => {
    // `/pricing` n'est pas sous `/app` : aucune session n'est exigée.
    expect(await nextFor("/pricing")).toBeNull();
  });
});

describe("ce que le proxy écrit passe le contrôle anti-open-redirect", () => {
  it("est accepté tel quel par `safeNextPath`", async () => {
    /*
     * Les deux bouts de la chaîne doivent s'accorder : un proxy qui écrirait
     * une valeur que le contrôle refuse casserait le tunnel en silence, en
     * renvoyant tout le monde sur le tableau de bord. Ce test relie les deux.
     */
    for (const url of [
      "/app",
      "/app/checkout?plan=practice&project=abc-123",
      "/app/projets/11111111-1111-4111-8111-111111111111/presence",
    ]) {
      const next = await nextFor(url);
      expect(next).not.toBeNull();
      expect(safeNextPath(next)).toBe(url);
    }
  });
});
