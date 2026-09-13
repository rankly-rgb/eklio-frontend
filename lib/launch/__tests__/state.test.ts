import { describe, expect, it } from "vitest";
import {
  applyStatus,
  currentKey,
  resolvedCount,
  signature,
  statusOf,
} from "@/lib/launch/state";
import { LAUNCH_STEP_KEYS, type LaunchStep } from "@/lib/data/checklist";
import { STEP_PLACES } from "@/lib/launch/places";

/*
 * Les transitions de la checklist — la coche optimiste, le retour en arrière
 * après un refus du serveur, le compteur qui suit, et la carte « prochaine
 * étape » qui lit le MÊME tableau que le rail.
 *
 * Ce fichier couvre les transitions, pas le câblage : il n'y a ni DOM ni
 * testing-library dans ce dépôt, et ce chantier n'a pas le droit d'ajouter une
 * dépendance. Ce que ces tests ne peuvent pas voir est nommé dans la liste à
 * faire à la main, jamais sous-entendu par un vert.
 */

function rows(...statuses: LaunchStep["status"][]): LaunchStep[] {
  return LAUNCH_STEP_KEYS.map((key, index) => ({
    key,
    label: `Step ${index + 1}`,
    description: null,
    status: statuses[index] ?? "todo",
  }));
}

describe("la coche optimiste", () => {
  it("déplace UNE ligne et laisse les six autres identiques", () => {
    const before = rows();
    const after = applyStatus(before, "google_profile", "done");

    expect(statusOf(after, "google_profile", "todo")).toBe("done");
    for (const item of after) {
      if (item.key === "google_profile") continue;
      // Identiques, et le MÊME objet : une ligne non touchée ne doit pas
      // provoquer de re-rendu.
      expect(item).toBe(before.find((row) => row.key === item.key));
    }
  });

  it("ne mute pas le tableau d'origine", () => {
    const before = rows();
    applyStatus(before, "site_setup", "done");
    expect(statusOf(before, "site_setup", "todo")).toBe("todo");
  });
});

describe("le retour en arrière après un refus du serveur", () => {
  it("repose la ligne exactement où elle était", () => {
    /*
     * Le vrai scénario : elle coche, l'écriture échoue, la ligne revient.
     * C'est ce que fait le provider dans son `catch` — jamais une ligne qui
     * prétend un état que le serveur a refusé.
     */
    const start = rows("done", "skipped");
    const optimistic = applyStatus(start, "update_directory", "done");
    expect(statusOf(optimistic, "update_directory", "todo")).toBe("done");

    const reverted = applyStatus(optimistic, "update_directory", "skipped");
    expect(signature(reverted)).toBe(signature(start));
  });

  it("un retour depuis `todo` revient bien à `todo`, pas à `done`", () => {
    const start = rows();
    const reverted = applyStatus(applyStatus(start, "first_post", "done"), "first_post", "todo");
    expect(signature(reverted)).toBe(signature(start));
  });
});

describe("le compteur suit la même règle que le serveur", () => {
  it("`resolved` compte done ET skipped", () => {
    // `get_launch_progress` compte `status <> 'todo'`. Si ces deux règles
    // divergent, l'anneau et la base se contredisent.
    expect(resolvedCount(rows("done", "skipped", "todo"))).toBe(2);
    expect(resolvedCount(rows())).toBe(0);
    expect(resolvedCount(rows("done", "done", "done", "done", "done", "done", "done"))).toBe(7);
  });

  it("il bouge à la coche, sans attendre le serveur", () => {
    const before = rows();
    expect(resolvedCount(before)).toBe(0);
    expect(resolvedCount(applyStatus(before, "email_signature", "done"))).toBe(1);
  });
});

describe("la ligne courante", () => {
  it("est la première `todo`, et se déplace quand celle-là est résolue", () => {
    const before = rows("done");
    expect(currentKey(before)).toBe("update_directory");
    expect(currentKey(applyStatus(before, "update_directory", "done"))).toBe("google_profile");
  });

  it("saute une étape passée, elle n'y revient pas", () => {
    expect(currentKey(rows("skipped"))).toBe("update_directory");
  });

  it("vaut null quand les sept sont résolues — c'est la ligne de fin", () => {
    expect(currentKey(rows("done", "done", "done", "done", "done", "done", "skipped"))).toBeNull();
  });
});

describe("⚠ le rail et la carte « prochaine étape » ne peuvent pas se contredire", () => {
  it("la carte lit son état dans le MÊME tableau que le rail", () => {
    /*
     * La carte choisit son étape sur le SERVEUR ; son état, lui, sort du
     * tableau client. Donc une coche dans le rail est visible par la carte
     * immédiatement, avant même que le serveur ait rechoisi l'étape suivante.
     */
    const server = rows();
    const cardStep = currentKey(server);
    expect(cardStep).toBe("site_setup");

    const afterRailClick = applyStatus(server, "site_setup", "done");
    expect(statusOf(afterRailClick, "site_setup", "todo")).toBe("done");
    expect(currentKey(afterRailClick)).toBe("update_directory");
  });

  it("le repli de `statusOf` est l'état serveur, jamais `todo` par défaut", () => {
    // Une clé absente du tableau ne doit pas se faire passer pour à faire.
    expect(statusOf([], "booking_link", "done")).toBe("done");
    expect(statusOf([], "booking_link", "skipped")).toBe("skipped");
  });
});

describe("⚠ aucun lien sortant ne vise un compte", () => {
  it("chaque service est une origine nue — pas de chemin, pas de paramètre", () => {
    /*
     * Eklio n'a ni son identifiant Psychology Today, ni son fiche Google, ni
     * son pseudo Instagram. Une URL construite serait une devinette, et une
     * devinette qui tombe sur le mauvais profil est pire que la page d'accueil
     * du service.
     */
    for (const [key, place] of Object.entries(STEP_PLACES)) {
      if (!place.service) continue;
      const url = new URL(place.service.url);
      expect(url.protocol, key).toBe("https:");
      expect(url.pathname, key).toBe("/");
      expect(url.search, key).toBe("");
      expect(url.hash, key).toBe("");
    }
  });

  it("les sept étapes ont toutes un lieu, et il est nommé", () => {
    for (const key of LAUNCH_STEP_KEYS) {
      expect(STEP_PLACES[key], key).toBeDefined();
      expect(STEP_PLACES[key].label.length, key).toBeGreaterThan(0);
    }
  });

  it("⚠ LES SEPT sont `declared` — Eklio n'en observe aucune", () => {
    /*
     * `site_setup` était l'exception : on la croyait entièrement interne.
     * Elle ne l'est pas. Le prompt est ASSEMBLÉ ici et le site est construit
     * ailleurs, chez son constructeur — Eklio ne voit pas plus son site publié
     * que sa fiche Psychology Today. L'exception était une erreur de lecture
     * de l'étape, pas une propriété de l'étape.
     */
    for (const key of LAUNCH_STEP_KEYS) {
      expect(STEP_PLACES[key].declared, key).toBe(true);
    }
  });
});
