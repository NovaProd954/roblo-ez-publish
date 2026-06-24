/**
 * Roblo-ez Publish worker template
 *
 * This is a configurable proxy/template, not a hardcoded Roblox implementation.
 * Wire ROBLOX_ACTION_URL / ROBLOX_IMPORT_URL to the endpoint that actually performs
 * the Roblox publish/import step in your own deployment.
 */

const ALLOWED_ORIGINS = new Set([
  'https://axolotleless.github.io',
  'https://github.com',
]);

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
    ...init,
  });
}

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin);
}

async function proxyJson(url, payload, extraHeaders = {}) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  });
  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { ok: false, message: text || 'Upstream returned a non-JSON response.' };
  }
  return { status: resp.status, data };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-origin': request.headers.get('origin') || '*',
          'access-control-allow-headers': 'content-type',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-max-age': '86400',
        },
      });
    }

    const origin = request.headers.get('origin');
    if (!isAllowedOrigin(origin)) {
      return json({ ok: false, message: 'Origin blocked by worker allowlist.' }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
    }

    const action = String(body.action || '');
    const originHeader = origin || '*';

    if (action === 'searchModels') {
      const q = String(body.query || '').trim();
      const category = String(body.category || '').trim();
      const license = String(body.license || '').trim();
      const animated = !!body.animated;
      const limit = Math.max(1, Math.min(24, Number(body.limit) || 8));

      const searchUrl = env.POLYPIZZA_SEARCH_URL || env.FREE_MODEL_SEARCH_URL;
      if (!searchUrl) {
        return json({
          ok: false,
          message: 'Set POLYPIZZA_SEARCH_URL (or FREE_MODEL_SEARCH_URL) on the worker before using model search.',
          models: [],
        }, { status: 501, headers: { 'access-control-allow-origin': originHeader } });
      }

      const url = new URL(searchUrl);
      if (q) url.searchParams.set('q', q);
      if (category) url.searchParams.set('category', category);
      if (license) url.searchParams.set('license', license);
      if (animated) url.searchParams.set('animated', 'true');
      url.searchParams.set('limit', String(limit));

      const resp = await fetch(url.toString(), {
        headers: {
          'accept': 'application/json',
          ...(env.POLYPIZZA_AUTH_TOKEN ? { 'authorization': `Bearer ${env.POLYPIZZA_AUTH_TOKEN}` } : {}),
        },
      });

      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { items: [], raw: text };
      }

      const models = Array.isArray(data.models) ? data.models
        : Array.isArray(data.items) ? data.items
        : Array.isArray(data.results) ? data.results
        : Array.isArray(data.data) ? data.data
        : [];

      return json({
        ok: true,
        message: `Returned ${models.length} model(s).`,
        models,
        raw: data,
      }, { headers: { 'access-control-allow-origin': originHeader } });
    }

    if (action === 'importModel') {
      const endpoint = env.ROBLOX_IMPORT_URL || env.ROBLOX_MODEL_IMPORT_URL || env.ROBLOX_ACTION_URL;
      if (!endpoint) {
        return json({
          ok: false,
          message: 'Set ROBLOX_IMPORT_URL (or ROBLOX_ACTION_URL) on the worker before using model import.',
        }, { status: 501, headers: { 'access-control-allow-origin': originHeader } });
      }

      const { status, data } = await proxyJson(endpoint, {
        action: 'importModel',
        cookie: body.cookie || '',
        universeId: body.universeId || '',
        model: body.model || null,
      });

      return json(data, {
        status,
        headers: { 'access-control-allow-origin': originHeader },
      });
    }

    if (action === 'createUniverse' || action === 'createPlace') {
      const endpoint = env.ROBLOX_ACTION_URL;
      if (!endpoint) {
        return json({
          ok: false,
          message: 'Set ROBLOX_ACTION_URL on the worker before using universe/place creation.',
        }, { status: 501, headers: { 'access-control-allow-origin': originHeader } });
      }

      const { status, data } = await proxyJson(endpoint, body);
      return json(data, {
        status,
        headers: { 'access-control-allow-origin': originHeader },
      });
    }

    return json({
      ok: false,
      message: `Unknown action: ${action}`,
    }, { status: 400, headers: { 'access-control-allow-origin': originHeader } });
  }
};
