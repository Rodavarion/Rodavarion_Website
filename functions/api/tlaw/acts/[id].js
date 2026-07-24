import { apiError, empty, json, optionsResponse } from "../../../_shared/http.js";

async function getAct(context) {
  if (!context.env.TLAW_DB) {
    return { status: 503, payload: { ok: false, error: "TLAW_DB binding is unavailable" } };
  }

  const id = String(context.params.id ?? "").trim();
  if (!id || id.length > 160) {
    return { status: 400, payload: { ok: false, error: "Invalid act identifier" } };
  }

  const act = await context.env.TLAW_DB
    .prepare(`SELECT id, act_type AS actType, title, short_title AS shortTitle,
                     act_number AS actNumber, issuer, status, adopted_on AS adoptedOn,
                     effective_from AS effectiveFrom, effective_to AS effectiveTo,
                     official_url AS officialUrl, language,
                     current_revision_id AS currentRevisionId,
                     created_at AS createdAt, updated_at AS updatedAt
              FROM legal_acts WHERE id = ? LIMIT 1`)
    .bind(id).first();

  if (!act) return { status: 404, payload: { ok: false, error: "Legal act not found" } };

  const revision = await context.env.TLAW_DB
    .prepare(`SELECT id, revision_number AS revisionNumber, valid_from AS validFrom,
                     valid_to AS validTo, source_url AS sourceUrl, source_hash AS sourceHash,
                     text_plain AS textPlain, created_at AS createdAt
              FROM act_revisions WHERE act_id = ?
              ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END, revision_number DESC
              LIMIT 1`)
    .bind(id, act.currentRevisionId ?? "").first();

  return { status: 200, payload: { ok: true, data: { ...act, revision: revision ?? null } } };
}

export async function onRequestGet(context) {
  try {
    const result = await getAct(context);
    return json(result.payload, result.status);
  } catch (error) {
    console.error("TLAW act lookup failure", error);
    return apiError("Act lookup failed", 500);
  }
}

export async function onRequestHead(context) {
  try {
    const result = await getAct(context);
    return empty(result.status, { "content-type": "application/json; charset=utf-8" });
  } catch (error) {
    console.error("TLAW act HEAD failure", error);
    return empty(500);
  }
}

export function onRequestOptions() {
  return optionsResponse();
}
