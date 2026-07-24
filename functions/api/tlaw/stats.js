import { apiError, empty, json, optionsResponse } from "../../_shared/http.js";

async function readStats(context) {
  if (!context.env.TLAW_DB) {
    return { status: 503, payload: { ok: false, error: "TLAW_DB binding is unavailable" } };
  }

  const row = await context.env.TLAW_DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM legal_acts) AS acts,
      (SELECT COUNT(*) FROM act_revisions) AS revisions,
      (SELECT COUNT(*) FROM legal_units) AS units,
      (SELECT COUNT(*) FROM legal_units WHERE unit_type='article') AS articles,
      (SELECT COUNT(*) FROM legal_concepts WHERE status='active') AS concepts,
      (SELECT COUNT(*) FROM legal_references) AS referencesCount,
      (SELECT COUNT(*) FROM legal_conflicts WHERE status IN ('detected','under_review','confirmed')) AS openConflicts,
      (SELECT value FROM system_metadata WHERE key='constitution_source_hash') AS constitutionSourceHash
  `).first();

  return {
    status: 200,
    payload: {
      ok: true,
      data: {
        acts: Number(row?.acts ?? 0),
        revisions: Number(row?.revisions ?? 0),
        units: Number(row?.units ?? 0),
        articles: Number(row?.articles ?? 0),
        concepts: Number(row?.concepts ?? 0),
        references: Number(row?.referencesCount ?? 0),
        openConflicts: Number(row?.openConflicts ?? 0),
        constitutionImported: Boolean(row?.constitutionSourceHash)
      }
    }
  };
}

export async function onRequestGet(context) {
  try { const result = await readStats(context); return json(result.payload, result.status); }
  catch (error) { console.error("TLAW stats failure", error); return apiError("Statistics lookup failed", 500); }
}
export async function onRequestHead(context) {
  try { const result = await readStats(context); return empty(result.status); }
  catch { return empty(500); }
}
export function onRequestOptions() { return optionsResponse(); }
