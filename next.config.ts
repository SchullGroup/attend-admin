import type { NextConfig } from "next";

// Cross-Origin Isolation (COOP/COEP) headers were previously set globally
// here for the Zoom Meeting SDK's SharedArrayBuffer requirement (video
// renderer needs it, or video stays black). Temporarily REMOVED to test
// whether it's the cause of the YouTube "embed shows a broken icon, refused
// to load" bug on /events/live: for a nested iframe to be cross-origin-
// isolated, every ancestor document (i.e. this page) also needs COEP set,
// and that requirement applies page-wide — it can't be scoped to "only when
// a Zoom meeting is on screen" vs "only when a YouTube link is on screen"
// since both render from the same /events/live route.
//
// If Zoom's video goes black after this, that confirms Zoom does still need
// it and this block should be restored:
//
// async headers() {
//   return [
//     {
//       source: "/(.*)",
//       headers: [
//         { key: "Cross-Origin-Opener-Policy",  value: "same-origin" },
//         { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
//       ],
//     },
//   ];
// },
const nextConfig: NextConfig = {};

export default nextConfig;
