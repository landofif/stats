import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sync } from '../worker/src/sync.js';
import { top, trends, status } from '../worker/src/stats.js';
import { fakeD1, fakeLastfm, scrobble, IMG } from './fixtures.js';

const TZ = 'Europe/Zurich';
const at = (iso) => Date.parse(iso) / 1000;
const NOW = at('2026-07-10T12:00:00Z');

async function dbWith(scrobbles) {
  const env = { DB: fakeD1(), TZ_NAME: TZ };
  const api = fakeLastfm(scrobbles);
  for (let i = 0; i < 5; i++) await sync(env, { fetchPage: api.fetchPage, now: NOW });
  return env.DB;
}

const LISTENS = [
  scrobble(at('2026-07-01T10:00:00Z'), 'Alpha', 'Song A', 'First'),
  scrobble(at('2026-07-02T10:00:00Z'), 'Alpha', 'Song A', 'First'),
  scrobble(at('2026-07-03T10:00:00Z'), 'Alpha', 'Song B', 'First'),
  scrobble(at('2026-07-04T10:00:00Z'), 'Beta', 'Song C', ''),
  scrobble(at('2026-07-05T10:00:00Z'), 'Beta', 'Song C', ''),
  scrobble(at('2026-05-01T10:00:00Z'), 'Gamma', 'Old one', 'Earlier'),
];

test('top artists, tracks and albums are ranked by plays', async () => {
  const db = await dbWith(LISTENS);
  const all = { from: 0, to: NOW, limit: 10 };
  assert.deepEqual(await top(db, { type: 'artists', ...all }), [
    { artist: 'Alpha', plays: 3, image: IMG }, { artist: 'Beta', plays: 2, image: IMG }, { artist: 'Gamma', plays: 1, image: IMG },
  ]);
  // Equal plays: the one listened to most recently comes first.
  assert.deepEqual(await top(db, { type: 'tracks', ...all }), [
    { artist: 'Beta', track: 'Song C', plays: 2, image: IMG },
    { artist: 'Alpha', track: 'Song A', plays: 2, image: IMG },
    { artist: 'Alpha', track: 'Song B', plays: 1, image: IMG },
    { artist: 'Gamma', track: 'Old one', plays: 1, image: IMG },
  ]);
  // Scrobbles without an album are left out of the album list.
  assert.deepEqual(await top(db, { type: 'albums', ...all }), [
    { artist: 'Alpha', album: 'First', plays: 3, image: IMG }, { artist: 'Gamma', album: 'Earlier', plays: 1, image: IMG },
  ]);
});

test('top lists carry the cover played most, ignoring plays without one', async () => {
  const db = await dbWith([
    scrobble(at('2026-07-01T10:00:00Z'), 'Alpha', 'One', 'Single', 'https://img.example/single.jpg'),
    scrobble(at('2026-07-02T10:00:00Z'), 'Alpha', 'Two', 'Record', 'https://img.example/record.jpg'),
    scrobble(at('2026-07-03T10:00:00Z'), 'Alpha', 'Two', 'Record', 'https://img.example/record.jpg'),
    scrobble(at('2026-07-04T10:00:00Z'), 'Alpha', 'Three', 'Bootleg', ''),
    scrobble(at('2026-07-05T10:00:00Z'), 'Alpha', 'Three', 'Bootleg', ''),
    scrobble(at('2026-07-06T10:00:00Z'), 'Alpha', 'Three', 'Bootleg', ''),
    scrobble(at('2026-07-07T10:00:00Z'), 'Beta', 'Four', 'Tape', ''),
  ]);
  const all = { from: 0, to: NOW, limit: 10 };
  assert.deepEqual(await top(db, { type: 'artists', ...all }), [
    { artist: 'Alpha', plays: 6, image: 'https://img.example/record.jpg' },
    { artist: 'Beta', plays: 1, image: '' },
  ]);
  assert.deepEqual((await top(db, { type: 'tracks', ...all })).map((t) => [t.track, t.image]), [
    ['Three', ''], ['Two', 'https://img.example/record.jpg'], ['Four', ''], ['One', 'https://img.example/single.jpg'],
  ]);
  assert.deepEqual((await top(db, { type: 'albums', ...all })).map((a) => [a.album, a.image]), [
    ['Bootleg', ''], ['Record', 'https://img.example/record.jpg'], ['Tape', ''], ['Single', 'https://img.example/single.jpg'],
  ]);
});

test('top lists respect the period and the limit', async () => {
  const db = await dbWith(LISTENS);
  const july = { from: at('2026-07-01T00:00:00Z'), to: NOW };
  assert.deepEqual(await top(db, { type: 'artists', ...july, limit: 1 }), [{ artist: 'Alpha', plays: 3, image: IMG }]);
  assert.equal((await top(db, { type: 'artists', ...july, limit: 10 })).length, 2);
});

test('trends count plays per day and fill quiet days with zero', async () => {
  const db = await dbWith(LISTENS);
  const res = await trends(db, { from: at('2026-07-01T00:00:00Z'), to: NOW, bucket: 'day', tz: TZ, now: NOW });
  assert.equal(res.plays, 5);
  assert.deepEqual(res.buckets.map((b) => b.key), [
    '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05',
    '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10',
  ]);
  assert.deepEqual(res.buckets.map((b) => b.plays), [1, 1, 1, 1, 1, 0, 0, 0, 0, 0]);
});

test('all-time trends start at the first scrobble', async () => {
  const db = await dbWith(LISTENS);
  const res = await trends(db, { from: 0, to: NOW, bucket: 'month', tz: TZ, now: NOW });
  assert.deepEqual(res.buckets, [
    { key: '2026-05', plays: 1 }, { key: '2026-06', plays: 0 }, { key: '2026-07', plays: 5 },
  ]);
  const weeks = await trends(db, { from: at('2026-06-29T00:00:00Z'), to: NOW, bucket: 'week', tz: TZ, now: NOW });
  assert.deepEqual(weeks.buckets, [{ key: '2026-06-29', plays: 5 }, { key: '2026-07-06', plays: 0 }]);
});

test('the listening clock uses local time across daylight saving', async () => {
  // Both are 20:00 in Zurich on a Wednesday: 19:00 UTC in winter, 18:00 UTC in summer.
  const db = await dbWith([scrobble(at('2026-01-14T19:00:00Z')), scrobble(at('2026-07-08T18:00:00Z'))]);
  const res = await trends(db, { from: 0, to: NOW, bucket: 'month', tz: TZ, now: NOW });
  assert.equal(res.clock[3][20], 2);
  assert.equal(res.clock.flat().reduce((a, b) => a + b), 2);
});

test('an empty period gives no buckets', async () => {
  const db = await dbWith(LISTENS);
  const res = await trends(db, { from: at('2026-01-01T00:00:00Z'), to: at('2026-02-01T00:00:00Z'), bucket: 'day', tz: TZ, now: NOW });
  assert.deepEqual(res.buckets, []);
  assert.equal(res.plays, 0);
});

test('status reports the import state', async () => {
  assert.deepEqual(await status(fakeD1()), { count: 0, backfillDone: false, lastSync: null, firstTs: null });
  assert.deepEqual(await status(await dbWith(LISTENS)), {
    count: 6, backfillDone: true, lastSync: NOW, firstTs: at('2026-05-01T10:00:00Z'),
  });
});
