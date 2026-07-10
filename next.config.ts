import type { NextConfig } from "next";

// Cross-Origin Isolation (COOP/COEP) headers were previously set globally
// for the Zoom Meeting SDK's SharedArrayBuffer requirement, then removed
// entirely because applying COEP page-wide broke the YouTube iframe embed
// on /events/live (every ancestor document of an isolated frame needs COEP,
// and that page renders both the YouTube preview and the Zoom iframe).
//
// Fix: `zoom-meeting.html` is already a separate static file loaded inside
// its own <iframe> (see src/components/zoom-embed.tsx), not the main app
// page. So isolation headers can be scoped to just that one path — the
// Zoom iframe becomes cross-origin-isolated (unlocking SharedArrayBuffer,
// which Ribbon/Gallery view rely on internally) without touching the rest
// of the app, so the YouTube embed on the same page keeps working.
//
// Using `credentialless` (not `require-corp`) for COEP so Zoom's own CDN
// vendor scripts (source.zoom.us) don't need to send back
// Cross-Origin-Resource-Policy headers themselves.
//
// NOTE: this headers() block was confirmed NOT to actually reach
// /zoom-meeting.html in practice — Next.js has a known issue where static
// files served from /public can bypass the headers() pipeline. The real
// fix is in middleware.ts at the project root, which intercepts every
// request (including public files) and sets these same headers. This
// block is left in place as a harmless no-op / backup in case that
// Next.js behavior changes.
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/zoom-meeting.html",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;
