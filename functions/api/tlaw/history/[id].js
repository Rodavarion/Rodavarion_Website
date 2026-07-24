import { apiError, empty, json, optionsResponse } from "../../../_shared/http.js";

async function history(context) {
  if (!context.env.TLAW_DB) return { status: 503, payload: { ok: false, error: "TLAW_DB binding is unavailable" } };
  const id = String(context.params.id ?? "").trim();
  if (!id || id.length > 160) return { status: 400, payload: { ok: false, error: "Invalid unit identifier" } };

  const unit = await context.env.TLAW_DB.prepare(`
    SELECT id, act_id AS actId, unit_type AS unitType, unit_number AS unitNumber,
           heading, path, content_hash AS contentHash
    FROM legal_units WHERE id=? LIMIT 1`).bind(id).first();
  if (!unit) return { status: 404, payload: { ok: false, error: "Legal unit not found" } };

  const rows = await context.env.TLAW_DB.prepare(`
    SELECT id, event_type AS eventType, previous_content_hash AS previousContentHash,
           current_content_hash AS currentContentHash, note,
           effective_from AS effectiveFrom, created_at AS createdAt
    FROM legal_unit_history WHERE unit_id=? ORDER BY created_at DESC`).bind(id).all();

  return { status: 200, payload: { ok: true, data: { unit, events: rows.results ?? [] } } };
}
export async function onRequestGet(context) {
  try { const r = await history(context); return json(r.payload, r.status); }
  catch (e) { console.error("TLAW history failure", e); return apiError("History lookup failed", 500); }
}
export async function onRequestHead(context) {
  try { const r = await history(context); return empty(r.status); }
  catch { return empty(500); }
}
export function onRequestOptions() { return optionsResponse(); }
