import { describe, expect, it } from "vitest";
import { ingest, md5, type IngestPort } from "@/lib/visual-library/ingest";
import type { Inventory, LibraryEntry } from "@/lib/visual-library/inventory";

/* Un seau en mémoire, qui tient l'eTag (MD5) de chaque objet comme le stockage. */
function bucket(contents: Map<string, Uint8Array>) {
  const store = new Map<string, string>();
  const uploads: string[] = [];
  const port: IngestPort = {
    existing: async () => new Map(store),
    upload: async (path, bytes) => {
      uploads.push(path);
      store.set(path, md5(bytes));
      return null;
    },
    bytesOf: (e) => contents.get(e.id)!,
  };
  return { port, uploads, store };
}

const entry = (id: string): LibraryEntry => ({
  id, family: "illustrations", file: `x/${id}.svg`, ext: "svg", contentType: "image/svg+xml",
  sha256: "-", bytes: 1, storagePath: `library/illustrations/${id}.svg`, themes: ["t"], drawable: true,
});
const inventory: Inventory = { entries: [entry("a"), entry("b"), entry("c")] };

describe("l'ingestion se relance sans rien dupliquer", () => {
  it("la première fois tout part, la seconde rien", async () => {
    const contents = new Map([["a", Buffer.from("A")], ["b", Buffer.from("B")], ["c", Buffer.from("C")]]);
    const b = bucket(contents);
    const first = await ingest(b.port, inventory, { dryRun: false });
    expect(first.uploaded).toHaveLength(3);
    const second = await ingest(b.port, inventory, { dryRun: false });
    expect(second.uploaded).toEqual([]);
    expect(second.skipped).toBe(3);
    expect(b.uploads).toHaveLength(3);
  });

  it("un fichier modifié repart, et lui seul", async () => {
    const contents = new Map([["a", Buffer.from("A")], ["b", Buffer.from("B")], ["c", Buffer.from("C")]]);
    const b = bucket(contents);
    await ingest(b.port, inventory, { dryRun: false });
    contents.set("b", Buffer.from("B v2"));
    const again = await ingest(b.port, inventory, { dryRun: false });
    expect(again.uploaded).toEqual(["library/illustrations/b.svg"]);
  });

  it("à blanc, rien n'est déposé — le plan est seulement dit", async () => {
    const b = bucket(new Map([["a", Buffer.from("A")], ["b", Buffer.from("B")], ["c", Buffer.from("C")]]));
    const dry = await ingest(b.port, inventory, { dryRun: true });
    expect(dry.uploaded).toHaveLength(3);
    expect(b.uploads).toEqual([]);
  });
});
