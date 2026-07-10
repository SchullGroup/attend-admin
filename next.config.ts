import type { NextConfig } from "next";

// Cross-Origin Isolation for Zoom's Ribbon/Gallery view (needs
// SharedArrayBuffer, which needs COOP/COEP) is now handled entirely
// client-side by public/coi-serviceworker.js, registered from inside
// public/zoom-meeting.html with its scope narrowed to that one path.
// See proxy.ts (currently disabled) for the server-header approach
// that was tried first and dropped — it kept coinciding with the YouTube
// embed on /events/live breaking, and this app already hit one confirmed
// Next.js bug where headers() doesn't reliably reach files under /public.
// No headers are set here; nothing to configure.
const nextConfig: NextConfig = {};

export default nextConfig;
