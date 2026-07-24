import { apiError, empty, json, optionsResponse } from "../../../_shared/http.js";

const allowedStatuses = new Set(["draft","adopted","effective","suspended","expired","repealed"]);

function integerParameter(value, fallback, minimum, maximum) {
  if (value === null || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function buildListQuery(url) {
  const search = url.searchParams;
  const clauses = [];
  const bindings = [];
  const query = (search.get("q") ?? "").trim();
  const type = (search.get("type") ?? "").trim();
  const status = (search.get("status") ?? "").trim();

  if (query) {
    clauses.push("(title LIKE ? OR short_title LIKE ? OR act_number LIKE ?)");
    const pattern = `%${query}%`;
    bindings.push(pattern, pattern, pattern);
  }
  if (type) {
    clauses.push("act_type = ?");
    bindings.push(type);
  }
  if (status) {
    if (!allowedStatuses.has(status)) return { error: "Unsupported act status" };
    clauses.push("status = ?");
    bindings.push(status);
  }

  const limit = integerParameter(search.get("limit"), 25, 1, 100);
  const offset = integerParameter(search.get("offset"), 0, 0, 1000000);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  return {
    sql: `SELECT id, act_type AS actType, title, short_title AS shortTitle,
                 act_number AS actNumber, issuer, status, adopted_on AS adoptedOn,
                 effective_from AS effectiveFrom, effective_to AS effectiveTo,
                 official_url AS officialUrl, language,
                 current_revision_id AS currentRevisionId,
                 created_at AS createdAt, updated_at AS updatedAt
          FROM legal_acts
          ${where}
          ORDER BY CASE WHEN effective_from IS NULL THEN 1 ELSE 0 END,
                   effective_from DESC, title COLLATE NOCASE ASC
          LIMIT ? OFFSET ?`,
    bindings: [...bindings, limit, offset],
    limit, offset,
    filters: { q: query || null, type: type || null, status: status || null }
  };
}

async function listActs(context) {
  if (!context.env.TLAW_DB) {
    return { status: 503, payload: { ok: false, error: "TLAW_DB binding is unavailable" } };
  }

  const query = buildListQuery(new URL(context.request.url));
  if (query.error) return { status: 400, payload: { ok: false, error: query.error } };

  const result = await context.env.TLAW_DB.prepare(query.sql).bind(...query.bindings).all();

  return {
    status: 200,
    payload: {
      ok: true,
      data: result.results ?? [],
      pagination: { limit: query.limit, offset: query.offset, returned: result.results?.length ?? 0 },
      filters: query.filters
    }
  };
}

export async function onRequestGet(context) {
  try {
    const result = await listActs(context);
    return json(result.payload, result.status);
  } catch (error) {
    console.error("TLAW acts list failure", error);
    return apiError("Acts lookup failed", 500);
  }
}

export async function onRequestHead(context) {
  try {
    const result = await listActs(context);
    return empty(result.status, { "content-type": "application/json; charset=utf-8" });
  } catch (error) {
    console.error("TLAW acts HEAD failure", error);
    return empty(500);
  }
}

export function onRequestOptions() {
  return optionsResponse();
}
