import { apiError, empty, json, optionsResponse } from "../../_shared/http.js";
import { TLAW_APPLICATION_VERSION, TLAW_RELEASE_CHANNEL } from "../../_shared/tlaw-meta.js";

async function readVersion(env) {
  if (!env.TLAW_DB) return { status: 503, payload: { ok: false, error: "TLAW_DB binding is unavailable" } };
  const rows = await env.TLAW_DB.prepare(`
    SELECT key, value FROM system_metadata
    WHERE key IN ('platform','schema_version','constitution_source_hash') ORDER BY key`).all();
  const metadata = Object.fromEntries((rows.results ?? []).map((row) => [row.key, row.value]));
  return {
    status: 200,
    payload: {
      ok: true,
      service: "Rodavarion TLAW",
      jurisdiction: "Ukraine",
      applicationVersion: TLAW_APPLICATION_VERSION,
      releaseChannel: TLAW_RELEASE_CHANNEL,
      schemaVersion: metadata.schema_version ?? "unknown",
      constitutionImported: Boolean(metadata.constitution_source_hash),
      platform: metadata.platform ?? "cloudflare-native",
      runtime: "Cloudflare Pages Functions",
      database: "Cloudflare D1"
    }
  };
}
export async function onRequestGet(context) {
  try { const r = await readVersion(context.env); return json(r.payload, r.status); }
  catch (e) { console.error("TLAW version failure", e); return apiError("Version lookup failed", 500); }
}
export async function onRequestHead(context) {
  try { const r = await readVersion(context.env); return empty(r.status); }
  catch { return empty(500); }
}
export function onRequestOptions() { return optionsResponse(); }
