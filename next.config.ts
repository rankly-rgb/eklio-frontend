import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
