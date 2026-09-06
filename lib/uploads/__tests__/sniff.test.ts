import { describe, expect, it } from "vitest";
import { claimedTypeFor, looksLikeSvg, safeFileName, sniff } from "@/lib/uploads/sniff";

/*
 * ── L'EXTENSION EST UNE AFFIRMATION, PAS UNE PREUVE ─────────────────────
 *
 * `portrait.png` peut être un SVG portant un script, et un navigateur à qui
 * l'on demande de l'afficher comme une image exécutera ce script sous notre
 * origine. Ces tests fixent que ce sont les OCTETS qui décident, et que ce que
 * l'appelant a annoncé ne sert qu'à le lui dire.
 */

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00);
const WEBP = new Uint8Array([
  ...text("RIFF"), 0x24, 0x00, 0x00, 0x00, ...text("WEBPVP8 "),
]);
const PDF = text("%PDF-1.7\n1 0 obj\n");

describe("les signatures", () => {
  it.each([
    ["image/jpeg", JPEG],
    ["image/png", PNG],
    ["image/webp", WEBP],
    ["application/pdf", PDF],
  ])("%s est reconnu par ses octets", (expected, sample) => {
    const result = sniff(sample);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mimeType).toBe(expected);
  });

  it("un fichier vide est refusé comme vide, pas comme inconnu", () => {
    const result = sniff(new Uint8Array(0));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("empty");
  });

  it("un type inconnu est refusé", () => {
    const result = sniff(text("MZ\u0090\u0000this is a windows executable"));
    expect(result.ok).toBe(false);
  });
});

describe("⚠ le mensonge est détecté, et le fichier est classé sur ses octets", () => {
  it("un SVG appelé .png est un SVG, et le désaccord est signalé", () => {
    // LE cas qui compte : stocké en png, il serait servi en image et exécuté.
    const result = sniff(text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), "image/png");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mimeType).toBe("image/svg+xml");
    expect(result.mismatched).toBe(true);
  });

  it("un PNG appelé .svg reste un PNG", () => {
    const result = sniff(PNG, "image/svg+xml");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mimeType).toBe("image/png");
    expect(result.mismatched).toBe(true);
  });

  it("une signature binaire l'emporte sur du texte trouvé plus loin", () => {
    // Un PNG contenant la chaîne « <svg » dans ses données ne devient pas un
    // SVG : les signatures sont testées AVANT la reconnaissance par forme.
    const trap = new Uint8Array([...PNG, ...text('<svg onload="alert(1)">')]);
    const result = sniff(trap);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mimeType).toBe("image/png");
  });

  it("un fichier honnête n'est pas signalé", () => {
    const result = sniff(PNG, "image/png");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mismatched).toBe(false);
  });
});

describe("le SVG est reconnu par sa forme, étroitement", () => {
  it("accepte un prologue réel", () => {
    expect(looksLikeSvg(text('<?xml version="1.0"?><svg xmlns="x"></svg>'))).toBe(true);
    expect(looksLikeSvg(text("<!-- exported --> <svg></svg>"))).toBe(true);
    expect(looksLikeSvg(text('<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x.dtd"><svg/>'))).toBe(
      true
    );
  });

  it("refuse une page HTML qui CONTIENT un svg", () => {
    // Sinon une page complète, script compris, serait stockée comme image.
    expect(looksLikeSvg(text("<html><body><svg></svg></body></html>"))).toBe(false);
  });

  it("ne boucle pas sur un prologue malformé", () => {
    // La boucle de dépouillement est bornée : un fichier fabriqué ne doit pas
    // faire tourner le serveur.
    const nasty = text("<!--".repeat(5000));
    const started = Date.now();
    expect(looksLikeSvg(nasty)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("le nom du fichier", () => {
  it("perd son chemin", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("C:\\Users\\me\\portrait.png")).toBe("portrait.png");
  });

  it("perd ses caractères de contrôle", () => {
    expect(safeFileName("port\u0000rait\u001f.png")).toBe("portrait.png");
  });

  it("rend null quand il ne reste rien", () => {
    expect(safeFileName("")).toBeNull();
    expect(safeFileName("   ")).toBeNull();
    expect(safeFileName(null)).toBeNull();
  });
});

describe("le type annoncé", () => {
  it("se lit dans l'extension quand l'en-tête ne dit rien d'utile", () => {
    expect(claimedTypeFor("logo.SVG", null)).toBe("image/svg+xml");
    expect(claimedTypeFor("scan.pdf", "application/octet-stream")).toBe("application/pdf");
    expect(claimedTypeFor("thing.exe", null)).toBeNull();
  });
});
