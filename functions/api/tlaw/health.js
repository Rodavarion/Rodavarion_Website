const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });

export async function onRequestGet(context) {
  try {
    if (!context.env.TLAW_DB) {
      return json({
        ok: false,
        error: "TLAW_DB binding is unavailable"
      }, 503);
    }

    const row = await context.env.TLAW_DB
      .prepare(`
        SELECT value
        FROM system_metadata
        WHERE key = 'schema_version'
        LIMIT 1
      `)
      .first();

    return json({
      ok: true,
      service: "Rodavarion TLAW",
      runtime: "Cloudflare Pages Functions",
      database: "Cloudflare D1",
      schemaVersion: row?.value ?? "unknown",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("TLAW health failure", error);

    return json({
      ok: false,
      error: "Database health check failed"
    }, 500);
  }
}
