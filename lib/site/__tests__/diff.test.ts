import { describe, expect, it } from "vitest";
import { looksStale, stalenessBanner } from "@/lib/site/diff";
import { clayAndSand } from "@/lib/site/__tests__/envelope.fixture";

/*
 * La bannière de péremption : elle apparaît, et elle s'efface sur mark-copied.
 */

describe("elle apparaît", () => {
  it("quand le spec a dépassé la version copiée", () => {
    const envelope = clayAndSand();

    // 4 contre 3 : elle a édité depuis sa dernière copie.
    expect(envelope.spec.spec_version).toBe(4);
    expect(envelope.spec.last_copied_spec_version).toBe(3);
    expect(envelope.diff.stale).toBe(true);
    expect(stalenessBanner(envelope.diff).visible).toBe(true);
  });

  it("dit ce qui a changé, sans répéter une zone", () => {
    const envelope = clayAndSand();
    envelope.diff.changes = [
      { area: "copy", label: "About text edited" },
      { area: "copy", label: "Hero copy edited" },
      { area: "colors", label: "Primary color changed" },
    ];

    const banner = stalenessBanner(envelope.diff);
    expect(banner.headline).toBe("Copy and Colors changed since you last copied this.");
    expect(banner.changes).toEqual([
      "About text edited",
      "Hero copy edited",
      "Primary color changed",
    ]);
  });

  it("nomme une seule zone sans conjonction bancale", () => {
    expect(
      stalenessBanner({ stale: true, changes: [{ area: "colors", label: "x" }] }).headline
    ).toBe("Colors changed since you last copied this.");
  });

  it("retombe sur la zone brute plutôt que de l'effacer", () => {
    // Une zone que la base ajouterait doit rester nommée.
    expect(
      stalenessBanner({ stale: true, changes: [{ area: "seo", label: "x" }] }).headline
    ).toBe("seo changed since you last copied this.");
  });
});

describe("elle s'efface sur mark-copied", () => {
  it("et seulement là", () => {
    const before = clayAndSand();
    expect(stalenessBanner(before.diff).visible).toBe(true);

    /*
     * L'enveloppe que renvoie `site_output_mark_copied` : la version copiée a
     * rattrapé la version du spec, et `diff.stale` est retombé.
     */
    const after = clayAndSand();
    after.spec.last_copied_spec_version = after.spec.spec_version;
    after.diff = { stale: false, changes: [] };
    after.etag = "a-different-etag";

    expect(stalenessBanner(after.diff).visible).toBe(false);
    // L'etag DOIT avoir bougé : il couvre `last_copied_spec_version` depuis
    // `20260829116000`. Sinon le client recevrait un 304 sur sa relecture et
    // garderait la bannière à l'écran — la copie qui devait l'effacer ne
    // l'effacerait pas.
    expect(after.etag).not.toBe(before.etag);
  });

  it("une seconde copie redondante ne change rien", () => {
    const copied = clayAndSand();
    copied.spec.last_copied_spec_version = copied.spec.spec_version;
    copied.diff = { stale: false, changes: [] };

    expect(looksStale(copied)).toBe(false);
    expect(stalenessBanner(copied.diff).visible).toBe(false);
  });

  it("une édition après la copie la ramène", () => {
    const edited = clayAndSand();
    edited.spec.last_copied_spec_version = 4;
    edited.spec.spec_version = 5;
    edited.diff = { stale: true, changes: [{ area: "colors", label: "Palette edited" }] };

    expect(looksStale(edited)).toBe(true);
    expect(stalenessBanner(edited.diff).visible).toBe(true);
  });
});

describe("`diff.stale` fait foi", () => {
  it("il dit la même chose que la comparaison des versions", () => {
    const envelope = clayAndSand();
    expect(looksStale(envelope)).toBe(envelope.diff.stale);
  });

  it("un spec jamais copié est périmé", () => {
    const fresh = clayAndSand();
    fresh.spec.last_copied_spec_version = null;
    expect(looksStale(fresh)).toBe(true);
  });
});
