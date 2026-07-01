import type { NextConfig } from "next";

// Zoom Meeting SDK is loaded inside /public/zoom-meeting.html via the Zoom CDN,
// isolated from the host app bundle. No npm SDK import → no Turbopack config needed.
const nextConfig: NextConfig = {};

export default nextConfig;
