import { describe, expect, it } from "vitest";
import { greeting } from "@/lib/data/home";

/*
 * La salutation de l'accueil. Le nudge, lui, est testé par la priorité qu'il
 * encode — cf. le commentaire de `pickNudge` : AU PLUS UN par écran.
 */
describe("greeting", () => {
  it("suit l'heure locale", () => {
    expect(greeting("Nora", new Date("2026-09-15T09:00:00"))).toBe(
      "Good morning, Nora."
    );
    expect(greeting("Nora", new Date("2026-09-15T14:00:00"))).toBe(
      "Good afternoon, Nora."
    );
    expect(greeting("Nora", new Date("2026-09-15T21:00:00"))).toBe(
      "Good evening, Nora."
    );
  });

  it("reste une phrase quand on ne connaît pas le prénom", () => {
    expect(greeting(null, new Date("2026-09-15T09:00:00"))).toBe("Good morning.");
  });
});
