import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Cross-Origin Isolation — required by Zoom Meeting SDK for video rendering.
        // Without these headers the browser blocks SharedArrayBuffer (used by the
        // Zoom canvas renderer) and video stays black / throws "includes of undefined".
        //
        // COEP: credentialless  — allows cross-origin assets (fonts, CDN scripts)
        //                         without needing CORP headers on every resource.
        // COOP: same-origin     — isolates the browsing context so SAB is available.
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy",  value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;
