import { apiError, empty, json, optionsResponse } from "../../_shared/http.js";

const clampInt = (value, fallback, min, max) => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

async function search(context) {
  if (!context.env.TLAW_DB) return { status: 503, payload: { ok: false, error: "TLAW_DB binding is unavailable" } };
  const url = new URL(context.request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return { status: 400, payload: { ok: false, error: "Search query must contain at least 2 characters" } };
  const limit = clampInt(url.searchParams.get("limit"), 25, 1, 100);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, 1000000);
  const normalized = q.toLocaleLowerCase("uk-UA").normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const pattern = `%${normalized}%`;

  const result = await context.env.TLAW_DB.prepare(`
    SELECT u.id, u.act_id AS actId, u.unit_type AS unitType, u.unit_number AS unitNumber,
           u.heading, u.text_plain AS textPlain, u.path, u.sort_order AS sortOrder,
           a.title AS actTitle, a.act_number AS actNumber
    FROM legal_units u
    JOIN legal_acts a ON a.id=u.act_id
    WHERE u.normalized_text LIKE ?
       OR lower(COALESCE(u.heading,'')) LIKE ?
       OR lower(COALESCE(u.unit_number,'')) = lower(?)
    ORDER BY CASE WHEN lower(COALESCE(u.unit_number,''))=lower(?) THEN 0 ELSE 1 END,
             u.sort_order
    LIMIT ? OFFSET ?`)
    .bind(pattern, `%${q.toLocaleLowerCase("uk-UA")}%`, q, q, limit, offset).all();

  return {
    status: 200,
    payload: {
      ok: true, query: q, data: result.results ?? [],
      pagination: { limit, offset, returned: result.results?.length ?? 0 }
    }
  };
}

export async function onRequestGet(context) {
  try { const r = await search(context); return json(r.payload, r.status); }
  catch (e) { console.error("TLAW search failure", e); return apiError("Search failed", 500); }
}
export async function onRequestHead(context) {
  try { const r = await search(context); return empty(r.status); }
  catch { return empty(500); }
}
export function onRequestOptions() { return optionsResponse(); }
