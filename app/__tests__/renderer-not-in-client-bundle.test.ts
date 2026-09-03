import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * `satori` and `@resvg/resvg-js` are native/Node-only (Lot 4.1–4.3's
 * condition 3): a native binary in a client bundle is not merely bloat,
 * it's a build failure or a browser trying to load a `.node` file. Two
 * checks, in the same static-scan style as the paywall enumeration
 * (`app/__tests__/brand-kit-entitlement.test.ts`):
 *
 *   1. Every file that imports either package is itself server-only — no
 *      `"use client"` directive.
 *   2. No `"use client"` file anywhere in the repo imports either package,
 *      or imports anything under `lib/kit/render/` (where every renderer
 *      that touches them lives).
 *
 * This is a static, direct-import check — it does not walk the full
 * transitive import graph the way `max-duration.test.ts` does for
 * generation markers, and it is not a substitute for actually inspecting a
 * built client bundle. That inspection is part of proving a deployed
 * preview build works (condition 3) and is tracked separately, not
 * something this test can do without a real Next.js build.
 */

const ROOT = resolve(__dirname, "../..");
const NATIVE_PACKAGES = ["satori", "@resvg/resvg-js"];
const SERVER_ONLY_RENDER_PATH = "lib/kit/render/";

const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_DIRS.has(entry.name)) return [];
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function relative(file: string): string {
  return file.slice(ROOT.length + 1).replace(/\\/g, "/");
}

const FILES = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "lib")), ...walk(join(ROOT, "components"))];

function isClientFile(source: string): boolean {
  return /^\s*["']use client["'];?/.test(source);
}

function importsAny(source: string, specifiers: string[]): boolean {
  return specifiers.some((spec) => {
    const escaped = spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`from\\s+["']${escaped}["']`).test(source);
  });
}

describe("satori/@resvg/resvg-js never reach a client bundle", () => {
  it("the scan itself finds files", () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it.each(FILES.map((file) => [relative(file), file] as const))(
    "%s does not import a native renderer package from a client file",
    (path, file) => {
      const source = readFileSync(file, "utf8");
      const client = isClientFile(source);
      const importsNative = importsAny(source, NATIVE_PACKAGES);
      const importsRenderPath = source.includes(SERVER_ONLY_RENDER_PATH);

      if (importsNative || importsRenderPath) {
        expect(
          client,
          `${path} is a "use client" file but imports a native renderer package ` +
            "(directly or via lib/kit/render/), which cannot run in a browser."
        ).toBe(false);
      }
    }
  );

  it("the two packages are only ever imported from lib/kit/render/", () => {
    const importers = FILES.filter((file) =>
      importsAny(readFileSync(file, "utf8"), NATIVE_PACKAGES)
    ).map(relative);

    for (const path of importers) {
      expect(path.startsWith(SERVER_ONLY_RENDER_PATH)).toBe(true);
    }
  });
});
