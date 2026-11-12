// Test doubles: D1 on Node's built-in SQLite, and a made-up Last.fm history.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');

export function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
  });
  return { prepare: (sql) => stmt(sql) };
}

export const scrobble = (ts, artist = 'Artist', track = `Track ${ts}`, album = 'Album') => ({ ts, artist, track, album });

// `count` scrobbles, one every `step` seconds, ending at `end`.
export const history = (count, end, step = 200) =>
  Array.from({ length: count }, (_, i) => scrobble(end - i * step));

const raw = (s, playing = false) => ({
  artist: { '#text': s.artist },
  name: s.track,
  album: { '#text': s.album },
  image: [{ size: 'large', '#text': 'https://img.example/large.jpg' }],
  ...(playing ? { '@attr': { nowplaying: 'true' } } : { date: { uts: String(s.ts) } }),
});

// Answers like user.getRecentTracks. `inclusive: false` treats from/to as exclusive,
// since Last.fm doesn't document which it is.
export function fakeLastfm(scrobbles, { inclusive = true, nowPlaying = null } = {}) {
  const api = { scrobbles, calls: [], failOnCall: 0 };
  api.recent = (params = {}) => {
    api.calls.push(params);
    if (api.calls.length === api.failOnCall) throw new Error('last.fm 500: Operation failed');
    const limit = Number(params.limit ?? 200);
    const page = Number(params.page ?? 1);
    const from = params.from == null ? -Infinity : Number(params.from);
    const to = params.to == null ? Infinity : Number(params.to);
    const hits = api.scrobbles
      .filter((s) => (inclusive ? s.ts >= from && s.ts <= to : s.ts > from && s.ts < to))
      .sort((a, b) => b.ts - a.ts);
    const track = hits.slice((page - 1) * limit, page * limit).map((s) => raw(s));
    if (nowPlaying) track.unshift(raw(nowPlaying, true));
    return {
      track: track.length === 1 ? track[0] : track,
      '@attr': { totalPages: String(Math.ceil(hits.length / limit)), total: String(hits.length) },
    };
  };
  api.fetchPage = async (env, params) => api.recent(params);
  return api;
}
