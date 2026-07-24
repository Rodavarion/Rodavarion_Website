import { apiError, empty, json, optionsResponse } from "../../../_shared/http.js";

const normalize = (value) =>
  String(value ?? "")
    .toLocaleLowerCase("uk-UA")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const clampInt = (value, fallback, min, max) => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

async function catalog(env) {
  const result = await env.TLAW_DB.prepare(`
    SELECT
      c.id AS conceptId,
      c.slug,
      c.canonical_label AS canonicalLabel,
      c.concept_kind AS conceptKind,
      a.alias,
      a.normalized_alias AS normalizedAlias,
      a.weight
    FROM legal_concepts c
    JOIN legal_concept_aliases a ON a.concept_id=c.id
    WHERE c.status='active'
    ORDER BY length(a.normalized_alias) DESC, a.weight DESC, c.canonical_label
  `).all();

  return {
    ok: true,
    mode: "catalog",
    data: result.results ?? []
  };
}

async function resolve(env, url) {
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return { status: 400, payload: { ok: false, error: "Concept query must contain at least 2 characters" } };
  }

  const normalized = normalize(q);
  const limit = clampInt(url.searchParams.get("limit"), 30, 1, 100);

  const conceptResult = await env.TLAW_DB.prepare(`
    SELECT
      c.id,
      c.slug,
      c.canonical_label AS canonicalLabel,
      c.description,
      c.concept_kind AS conceptKind,
      a.alias AS matchedAlias,
      a.weight AS aliasWeight
    FROM legal_concept_aliases a
    JOIN legal_concepts c ON c.id=a.concept_id
    WHERE c.status='active'
      AND (
        a.normalized_alias=?
        OR a.normalized_alias LIKE ?
        OR ? LIKE '%' || a.normalized_alias || '%'
      )
    ORDER BY
      CASE WHEN a.normalized_alias=? THEN 0 ELSE 1 END,
      a.weight DESC,
      length(a.normalized_alias) DESC
    LIMIT 1
  `).bind(normalized, `%${normalized}%`, normalized, normalized).first();

  if (!conceptResult) {
    return {
      status: 200,
      payload: { ok: true, query: q, normalizedQuery: normalized, data: null }
    };
  }

  const aliases = await env.TLAW_DB.prepare(`
    SELECT alias, normalized_alias AS normalizedAlias, alias_kind AS aliasKind, weight
    FROM legal_concept_aliases
    WHERE concept_id=?
    ORDER BY weight DESC, length(normalized_alias) DESC
  `).bind(conceptResult.id).all();

  const units = await env.TLAW_DB.prepare(`
    SELECT
      l.id AS linkId,
      l.relation_type AS relationType,
      l.confidence,
      l.origin,
      l.review_status AS reviewStatus,
      l.note,
      u.id AS unitId,
      u.act_id AS actId,
      u.unit_type AS unitType,
      u.unit_number AS unitNumber,
      u.heading,
      u.text_plain AS textPlain,
      u.path,
      u.sort_order AS sortOrder,
      a.title AS actTitle,
      a.act_number AS actNumber
    FROM legal_concept_unit_links l
    JOIN legal_units u ON u.id=l.unit_id
    JOIN legal_acts a ON a.id=u.act_id
    WHERE l.concept_id=?
      AND l.review_status<>'rejected'
    ORDER BY
      CASE l.review_status WHEN 'reviewed' THEN 0 ELSE 1 END,
      l.confidence DESC,
      a.title,
      u.sort_order
    LIMIT ?
  `).bind(conceptResult.id, limit).all();

  const relations = await env.TLAW_DB.prepare(`
    SELECT
      r.id,
      r.relation_type AS relationType,
      r.confidence,
      r.origin,
      r.review_status AS reviewStatus,
      r.note,
      CASE WHEN r.source_concept_id=? THEN 'outgoing' ELSE 'incoming' END AS direction,
      other.id AS conceptId,
      other.slug,
      other.canonical_label AS canonicalLabel,
      other.concept_kind AS conceptKind
    FROM legal_concept_relations r
    JOIN legal_concepts other
      ON other.id=CASE
        WHEN r.source_concept_id=? THEN r.target_concept_id
        ELSE r.source_concept_id
      END
    WHERE (r.source_concept_id=? OR r.target_concept_id=?)
      AND r.review_status<>'rejected'
    ORDER BY
      CASE r.review_status WHEN 'reviewed' THEN 0 ELSE 1 END,
      r.confidence DESC,
      other.canonical_label
  `).bind(conceptResult.id, conceptResult.id, conceptResult.id, conceptResult.id).all();

  return {
    status: 200,
    payload: {
      ok: true,
      query: q,
      normalizedQuery: normalized,
      data: {
        concept: conceptResult,
        aliases: aliases.results ?? [],
        units: units.results ?? [],
        relations: relations.results ?? []
      }
    }
  };
}

async function handle(context) {
  if (!context.env.TLAW_DB) {
    return { status: 503, payload: { ok: false, error: "TLAW_DB binding is unavailable" } };
  }

  const url = new URL(context.request.url);
  if (url.searchParams.get("catalog") === "1") {
    return { status: 200, payload: await catalog(context.env) };
  }
  return resolve(context.env, url);
}

export async function onRequestGet(context) {
  try {
    const result = await handle(context);
    return json(result.payload, result.status);
  } catch (error) {
    console.error("TLAW concept resolution failure", error);
    return apiError("Concept resolution failed", 500);
  }
}

export async function onRequestHead(context) {
  try {
    const result = await handle(context);
    return empty(result.status);
  } catch {
    return empty(500);
  }
}

export function onRequestOptions() {
  return optionsResponse();
}
