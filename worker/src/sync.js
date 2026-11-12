// Copies scrobbles from Last.fm into D1: new ones first, then older history.
import { recentPage, mapTracks, totalPages } from './lastfm.js';
import { offsetSeconds } from './time.js';

// Last.fm pages fetched per run. Kept low for the free plan's CPU and query limits.
const PAGES_PER_RUN = 4;

async function insert(db, tracks, tz) {
  if (!tracks.length) return 0;
  const rows = tracks.map((t) => [t.ts, t.ts + offsetSeconds(t.ts, tz), t.artist, t.track, t.album, t.image]);
  // One JSON parameter: D1 allows 100 bound parameters, a page needs 1000.
  const res = await db.prepare(
    `INSERT OR IGNORE INTO scrobbles (ts, lt, artist, track, album, image)
     SELECT value->>0, value->>1, value->>2, value->>3, value->>4, value->>5 FROM json_each(?)`,
  ).bind(JSON.stringify(rows)).run();
  return res.meta.changes;
}

export async function sync(env, { fetchPage = recentPage, now = Math.floor(Date.now() / 1000) } = {}) {
  const db = env.DB;
  const state = await db.prepare(
    `SELECT (SELECT MIN(ts) FROM scrobbles) AS lo, (SELECT MAX(ts) FROM scrobbles) AS hi,
            (SELECT value FROM meta WHERE key = 'count') AS count,
            (SELECT value FROM meta WHERE key = 'backfill_done') AS done`,
  ).first();
  let { lo, hi } = state;
  let count = state.count ?? 0;
  let done = !!state.done;
  let budget = PAGES_PER_RUN;
  let ok = false;

  const load = (params) => { budget--; return fetchPage(env, params); };
  const store = async (page) => {
    const { tracks } = mapTracks(page);
    count += await insert(db, tracks, env.TZ_NAME);
    return tracks;
  };

  try {
    // New scrobbles. `to` fixes the window so pages don't shift while reading, and the
    // oldest page goes in first: stopping early then leaves no hole below the newest row.
    // `from` is the newest stored second again, in case Last.fm treats it as exclusive.
    if (hi != null) {
      const window = { from: hi, to: now };
      const first = await load({ ...window, page: 1 });
      for (let p = totalPages(first); p >= 1 && (p === 1 || budget > 0); p--) {
        await store(p === 1 ? first : await load({ ...window, page: p }));
      }
    }
    // Older history, walking back from the oldest stored scrobble.
    while (!done && budget > 0) {
      const page = await load(lo == null ? {} : { to: lo + 1 });
      const tracks = await store(page);
      for (const t of tracks) lo = Math.min(lo ?? t.ts, t.ts);
      done = totalPages(page) <= 1;
    }
    ok = true;
  } finally {
    // Also after an error, so `count` covers the pages that did go in.
    await db.prepare(
      `INSERT INTO meta (key, value) VALUES ('count', ?), ('backfill_done', ?), ('last_sync', ?)
       ON CONFLICT (key) DO UPDATE SET value = COALESCE(excluded.value, meta.value)`,
    ).bind(count, done ? 1 : 0, ok ? now : null).run();
  }
  return { count, done };
}
