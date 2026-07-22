const baseHeaders = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff"
};

export function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...baseHeaders,
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}

export function empty(status = 204, extraHeaders = {}) {
  return new Response(null, { status, headers: { ...baseHeaders, ...extraHeaders } });
}

export function apiError(message, status = 500) {
  return json({ ok: false, error: message }, status);
}

export function optionsResponse() {
  return empty(204, {
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, HEAD, OPTIONS",
    "access-control-max-age": "86400"
  });
}
