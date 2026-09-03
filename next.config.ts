import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * `satori` (via its `harfbuzzjs` dependency, a wasm binary) and
   * `@resvg/resvg-js` (a native binary) both do Node-specific things a
   * bundled Server Components build can't trace correctly — left bundled,
   * `next build` hits `ENOENT … harfbuzzjs/hb.wasm` while collecting page
   * data, even though the packages work fine outside Turbopack's bundling
   * (confirmed directly: `satori()` renders real glyph paths from a
   * plain Node script with no Next.js involved). Opting them out here
   * makes Next `require()` them natively instead of bundling them.
   */
  serverExternalPackages: ["satori", "@resvg/resvg-js"],
  experimental: {
    serverActions: {
      // Derrière le proxy GitHub Codespaces, l'Origin (….app.github.dev) ne
      // correspond pas au Host vu par le serveur dev (localhost) : sans ces
      // origines de confiance, la protection CSRF des Server Actions rejette
      // les formulaires avec « Invalid Server Actions request ».
      allowedOrigins: ["localhost:3000", "*.app.github.dev"],
    },
  },
};

export default nextConfig;
