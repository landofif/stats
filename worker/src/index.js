// Routes, CORS and the scheduled sync. Read-only and public: the data is on the Last.fm profile anyway.
import { sync } from './sync.js';
import { recentPage, userInfo, mapTracks } from './lastfm.js';
import { top, trends, status, TOP_TYPES, BUCKETS } from './stats.js';

const json = (data, status = 200, maxAge = 0) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': maxAge ? `public, max-age=${maxAge}` : 'no-store',
  },
});

const int = (value, fallback) => (/^\d+$/.test(value ?? '') ? Number(value) : fallback);

async function route(url, env) {
  const q = url.searchParams;
  const now = Math.floor(Date.now() / 1000);
  const from = int(q.get('from'), 0);
  const to = int(q.get('to'), now + 1);

  switch (url.pathname) {
    case '/summary': {
      // Playcount is live so the apps can show how far the import is; it may fail on its own.
      const info = env.LASTFM_API_KEY ? await userInfo(env).catch(() => null) : null;
      return json({ ...(await status(env.DB)), playcount: info?.playcount ?? null, registered: info?.registered ?? null });
    }
    case '/recent': {
      if (!env.LASTFM_API_KEY) return json({ error: 'LASTFM_API_KEY is not set' }, 503);
      const limit = Math.min(int(q.get('limit'), 50), 200);
      return json(mapTracks(await recentPage(env, { limit })));
    }
    case '/top': {
      const type = q.get('type') ?? 'artists';
      if (!TOP_TYPES.includes(type)) return json({ error: 'unknown type' }, 400);
      const limit = Math.min(int(q.get('limit'), 50), 200);
      return json({ items: await top(env.DB, { type, from, to, limit }) }, 200, 60);
    }
    case '/trends': {
      const bucket = q.get('bucket') ?? 'day';
      if (!BUCKETS.includes(bucket)) return json({ error: 'unknown bucket' }, 400);
      return json(await trends(env.DB, { from, to, bucket, tz: env.TZ_NAME, now }), 200, 60);
    }
    default:
      return json({ error: 'not found' }, 404);
  }
}

export default {
  async fetch(request, env) {
    if (request.method !== 'GET') return json({ error: 'GET only' }, 405);
    try {
      return await route(new URL(request.url), env);
    } catch (err) {
      return json({ error: err.message }, 502);
    }
  },

  async scheduled(event, env) {
    if (env.LASTFM_API_KEY) await sync(env);
  },
};
