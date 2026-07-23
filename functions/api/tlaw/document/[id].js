import { apiError, empty, json, optionsResponse } from "../../../_shared/http.js";

async function readDocument(context) {
  if (!context.env.TLAW_DB) return { status: 503, payload: { ok: false, error: "TLAW_DB binding is unavailable" } };
  const id = String(context.params.id ?? "").trim();
  if (!id || id.length > 160) return { status: 400, payload: { ok: false, error: "Invalid document identifier" } };

  const act = await context.env.TLAW_DB.prepare(`
    SELECT id, act_type AS actType, title, short_title AS shortTitle,
           act_number AS actNumber, issuer, status, adopted_on AS adoptedOn,
           effective_from AS effectiveFrom, official_url AS officialUrl,
           current_revision_id AS currentRevisionId, updated_at AS updatedAt
    FROM legal_acts WHERE id=? LIMIT 1`).bind(id).first();
  if (!act) return { status: 404, payload: { ok: false, error: "Legal document not found" } };

  const result = await context.env.TLAW_DB.prepare(`
    SELECT id, parent_id AS parentId, unit_type AS unitType, unit_number AS unitNumber,
           heading, text_plain AS textPlain, sort_order AS sortOrder, depth, path
    FROM legal_units WHERE act_id=? ORDER BY sort_order`).bind(id).all();

  return { status: 200, payload: { ok: true, data: { ...act, units: result.results ?? [] } } };
}

export async function onRequestGet(context) {
  try { const r = await readDocument(context); return json(r.payload, r.status); }
  catch (e) { console.error("TLAW document failure", e); return apiError("Document lookup failed", 500); }
}
export async function onRequestHead(context) {
  try { const r = await readDocument(context); return empty(r.status); }
  catch { return empty(500); }
}
export function onRequestOptions() { return optionsResponse(); }
