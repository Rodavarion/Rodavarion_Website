import { apiError, empty, json, optionsResponse } from "../../_shared/http.js";

async function readVersion(env) {
  if (!env.TLAW_DB) {
    return { status: 503, payload: { ok: false, error: "TLAW_DB binding is unavailable" } };
  }

  const rows = await env.TLAW_DB
    .prepare(`SELECT key, value FROM system_metadata
              WHERE key IN ('platform', 'schema_version') ORDER BY key`)
    .all();

  const metadata = Object.fromEntries((rows.results ?? []).map((row) => [row.key, row.value]));

  return {
    status: 200,
    payload: {
      ok: true,
      service: "Rodavarion TLAW",
      applicationVersion: "2.1.0",
      schemaVersion: metadata.schema_version ?? "unknown",
      platform: metadata.platform ?? "cloudflare-native",
      runtime: "Cloudflare Pages Functions",
      database: "Cloudflare D1"
    }
  };
}

export async function onRequestGet(context) {
  try {
    const result = await readVersion(context.env);
    return json(result.payload, result.status);
  } catch (error) {
    console.error("TLAW version failure", error);
    return apiError("Version lookup failed", 500);
  }
}

export async function onRequestHead(context) {
  try {
    const result = await readVersion(context.env);
    return empty(result.status, { "content-type": "application/json; charset=utf-8" });
  } catch (error) {
    console.error("TLAW version HEAD failure", error);
    return empty(500);
  }
}

export function onRequestOptions() {
  return optionsResponse();
}
