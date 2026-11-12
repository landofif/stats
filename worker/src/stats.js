// Stats computed from the stored scrobbles.
import { bucketKey, bucketRange } from './time.js';

const TOP = {
  artists: { cols: 'artist', where: '' },
  tracks: { cols: 'artist, track', where: '' },
  albums: { cols: 'artist, album', where: "AND album != ''" },
};
export const TOP_TYPES = Object.keys(TOP);

// `image` is the cover played most in the period, so an artist gets their most played
// album's. Plays without a cover don't count. The play count is zero-padded in front of
// the URL so MAX() picks by count; SUBSTR cuts it off again.
export async function top(db, { type, from, to, limit }) {
  const { cols, where } = TOP[type];
  const { results } = await db.prepare(
    `SELECT ${cols}, SUM(n) AS plays,
            COALESCE(SUBSTR(MAX(CASE WHEN image != '' THEN printf('%08d', n) || image END), 9), '') AS image
     FROM (SELECT ${cols}, image, COUNT(*) AS n, MAX(ts) AS last FROM scrobbles
           WHERE ts >= ? AND ts < ? ${where} GROUP BY ${cols}, image)
     GROUP BY ${cols} ORDER BY plays DESC, MAX(last) DESC LIMIT ?`,
  ).bind(from, to, limit).all();
  return results;
}

// Keys must match bucketKey() in time.js.
const BUCKET = {
  day: "strftime('%Y-%m-%d', lt, 'unixepoch')",
  week: "strftime('%Y-%m-%d', lt, 'unixepoch', 'weekday 0', '-6 days')",
  month: "strftime('%Y-%m', lt, 'unixepoch')",
};
export const BUCKETS = Object.keys(BUCKET);

// Plays per bucket plus a weekday x hour grid (clock[0] is Sunday), from one table scan.
export async function trends(db, { from, to, bucket, tz, now }) {
  const { results } = await db.prepare(
    `SELECT ${BUCKET[bucket]} AS bucket,
            CAST(strftime('%w', lt, 'unixepoch') AS INTEGER) AS dow,
            CAST(strftime('%H', lt, 'unixepoch') AS INTEGER) AS hour,
            COUNT(*) AS plays
     FROM scrobbles WHERE ts >= ? AND ts < ? GROUP BY 1, 2, 3 ORDER BY 1`,
  ).bind(from, to).all();

  const counts = new Map();
  const clock = Array.from({ length: 7 }, () => Array(24).fill(0));
  let plays = 0;
  for (const r of results) {
    counts.set(r.bucket, (counts.get(r.bucket) ?? 0) + r.plays);
    clock[r.dow][r.hour] += r.plays;
    plays += r.plays;
  }
  if (!plays) return { plays, buckets: [], clock };

  // "All time" (from 0) starts at the first scrobble, not in 1970.
  const first = from > 0 ? bucketKey(from, bucket, tz) : results[0].bucket;
  const last = bucketKey(Math.min(to - 1, now), bucket, tz);
  const buckets = bucketRange(first, last, bucket).map((key) => ({ key, plays: counts.get(key) ?? 0 }));
  return { plays, buckets, clock };
}

export async function status(db) {
  const row = await db.prepare(
    `SELECT (SELECT MIN(ts) FROM scrobbles) AS firstTs, (SELECT json_group_object(key, value) FROM meta) AS meta`,
  ).first();
  const meta = JSON.parse(row.meta);
  return {
    count: meta.count ?? 0,
    backfillDone: !!meta.backfill_done,
    lastSync: meta.last_sync ?? null,
    firstTs: row.firstTs,
  };
}
