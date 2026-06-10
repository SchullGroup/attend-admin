/**
 * /admin/registers/[id] — proxy route
 * Real implementation lives at /(dashboard)/registers/[id]/page.tsx
 * This file exists so that /admin/registers/:id resolves correctly in the browser.
 */
export { default } from "../../../registers/[id]/page";
