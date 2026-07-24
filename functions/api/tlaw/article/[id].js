import { apiError, empty, json, optionsResponse } from "../../../_shared/http.js";

async function readArticle(context) {
  if (!context.env.TLAW_DB) return { status: 503, payload: { ok: false, error: "TLAW_DB binding is unavailable" } };
  const id = String(context.params.id ?? "").trim();
  if (!id || id.length > 160) return { status: 400, payload: { ok: false, error: "Invalid article identifier" } };

  const article = await context.env.TLAW_DB.prepare(`
    SELECT id, act_id AS actId, parent_id AS parentId, unit_number AS unitNumber,
           heading, text_plain AS textPlain, sort_order AS sortOrder, depth, path,
           content_hash AS contentHash
    FROM legal_units WHERE id=? AND unit_type='article' LIMIT 1`).bind(id).first();
  if (!article) return { status: 404, payload: { ok: false, error: "Article not found" } };

  const children = await context.env.TLAW_DB.prepare(`
    SELECT id, unit_type AS unitType, unit_number AS unitNumber, heading,
           text_plain AS textPlain, sort_order AS sortOrder, depth, path
    FROM legal_units WHERE parent_id=? ORDER BY sort_order`).bind(id).all();

  return { status: 200, payload: { ok: true, data: { ...article, children: children.results ?? [] } } };
}

export async function onRequestGet(context) {
  try { const r = await readArticle(context); return json(r.payload, r.status); }
  catch (e) { console.error("TLAW article failure", e); return apiError("Article lookup failed", 500); }
}
export async function onRequestHead(context) {
  try { const r = await readArticle(context); return empty(r.status); }
  catch { return empty(500); }
}
export function onRequestOptions() { return optionsResponse(); }
