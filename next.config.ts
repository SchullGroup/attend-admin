import type { NextConfig } from "next";

// Cross-Origin Isolation for Zoom's Ribbon/Gallery view (SharedArrayBuffer
// → COOP/COEP) is set server-side in src/proxy.ts, scoped to
// /zoom-meeting.html and /events/live. COEP is `credentialless`, which is
// why the YouTube embed on /events/live keeps working (its iframe carries
// the matching `credentialless` attribute — see StreamPreviewCard.tsx).
// The earlier coi-serviceworker.js approach was abandoned (never achieved
// isolation); headers() here was avoided because it doesn't reliably reach
// files under /public. No headers are set in this file on purpose.
const nextConfig: NextConfig = {};

export default nextConfig;
