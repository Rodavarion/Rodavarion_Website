const securityHeaders = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin"
};

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...securityHeaders,
      "content-type": "application/json; charset=utf-8"
    }
  });

async function readHealth(context) {
  if (!context.env.TLAW_DB) {
    return {
      status: 503,
      payload: {
        ok: false,
        error: "TLAW_DB binding is unavailable"
      }
    };
  }

  const row = await context.env.TLAW_DB
    .prepare(`
      SELECT value
      FROM system_metadata
      WHERE key = 'schema_version'
      LIMIT 1
    `)
    .first();

  return {
    status: 200,
    payload: {
      ok: true,
      service: "Rodavarion TLAW",
      runtime: "Cloudflare Pages Functions",
      database: "Cloudflare D1",
      schemaVersion: row?.value ?? "unknown",
      timestamp: new Date().toISOString()
    }
  };
}

export async function onRequestGet(context) {
  try {
    const result = await readHealth(context);
    return json(result.payload, result.status);
  } catch (error) {
    console.error("TLAW health failure", error);

    return json({
      ok: false,
      error: "Database health check failed"
    }, 500);
  }
}

export async function onRequestHead(context) {
  try {
    const result = await readHealth(context);

    return new Response(null, {
      status: result.status,
      headers: {
        ...securityHeaders,
        "content-type": "application/json; charset=utf-8"
      }
    });
  } catch (error) {
    console.error("TLAW HEAD health failure", error);

    return new Response(null, {
      status: 500,
      headers: securityHeaders
    });
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      ...securityHeaders,
      "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400"
    }
  });
}
