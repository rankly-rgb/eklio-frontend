import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractFontFileUrl,
  fetchFontFileUrl,
  FontAcquisitionError,
} from "@/lib/kit/render/font-cache";

/*
 * Real CSS shapes captured directly from fonts.googleapis.com/css2 with the
 * `UnrealSourceEngine/UnrealEngine3` User-Agent — the fix this file exists
 * to lock in. An earlier UA choice (MSIE 6.0) looked reasonable and was
 * wrong: it gets `font/eot`, not ttf, and a URL with no `.ttf` in it at
 * all (`https://fonts.gstatic.com/l/font?kit=…`) — which the regex
 * correctly refuses to match, so the earlier version failed on every real
 * call rather than caching the wrong format. These fixtures are what the
 * live endpoint actually returns for the working UA, not a guess at its
 * shape.
 */

const REAL_TTF_CSS = `@font-face {
  font-family: 'Fraunces';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/fraunces/v38/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIchRujDg.ttf) format('truetype');
}`;

const REAL_EOT_CSS = `@font-face {
  font-family: 'Fraunces';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(https://fonts.gstatic.com/l/font?kit=6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIchRujDw&skey=2eca4ab215eafb9c&v=v38);
}`;

const MULTI_FAMILY_CSS = `@font-face {
  font-family: 'Nunito Sans';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/nunitosans/v15/abc.ttf) format('truetype');
}
@font-face {
  font-family: 'Fraunces';
  font-style: normal;
  font-weight: 500;
  src: url(https://fonts.gstatic.com/s/fraunces/v38/xyz.ttf) format('truetype');
}`;

describe("extractFontFileUrl", () => {
  it("finds the ttf src URL for the requested family", () => {
    expect(extractFontFileUrl(REAL_TTF_CSS, "Fraunces")).toBe(
      "https://fonts.gstatic.com/s/fraunces/v38/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIchRujDg.ttf"
    );
  });

  it("returns null rather than a wrong-format URL when the response has no .ttf src", () => {
    // The EOT-format response some UAs get — a kit-query URL with no .ttf
    // in it. Matching it anyway would hand satori bytes it can't parse.
    expect(extractFontFileUrl(REAL_EOT_CSS, "Fraunces")).toBeNull();
  });

  it("picks the block for the requested family, not just the first block", () => {
    expect(extractFontFileUrl(MULTI_FAMILY_CSS, "Fraunces")).toBe(
      "https://fonts.gstatic.com/s/fraunces/v38/xyz.ttf"
    );
    expect(extractFontFileUrl(MULTI_FAMILY_CSS, "Nunito Sans")).toBe(
      "https://fonts.gstatic.com/s/nunitosans/v15/abc.ttf"
    );
  });

  it("returns null for a family that isn't in the CSS at all", () => {
    expect(extractFontFileUrl(REAL_TTF_CSS, "Newsreader")).toBeNull();
  });
});

describe("fetchFontFileUrl — the User-Agent fallback list", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls through to the next User-Agent when the first returns no ttf src", async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      // First UA: the EOT shape (no .ttf src). Second UA: the real one.
      const body = call === 1 ? REAL_EOT_CSS : REAL_TTF_CSS;
      return new Response(body, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const url = await fetchFontFileUrl("https://fonts.googleapis.com/css2?family=Fraunces", "Fraunces");

    expect(url).toBe(
      "https://fonts.gstatic.com/s/fraunces/v38/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIchRujDg.ttf"
    );
    expect(call).toBe(2);
  });

  it("does not call a later User-Agent once an earlier one succeeds", async () => {
    const fetchMock = vi.fn(async () => new Response(REAL_TTF_CSS, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchFontFileUrl("https://fonts.googleapis.com/css2?family=Fraunces", "Fraunces");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws a named FontAcquisitionError, not a generic one, when every User-Agent fails", async () => {
    const fetchMock = vi.fn(async () => new Response(REAL_EOT_CSS, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchFontFileUrl("https://fonts.googleapis.com/css2?family=Fraunces", "Fraunces")
    ).rejects.toBeInstanceOf(FontAcquisitionError);
  });
});
