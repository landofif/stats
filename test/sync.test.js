import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sync } from '../worker/src/sync.js';
import { fakeD1, fakeLastfm, history, scrobble } from './fixtures.js';

const NOW = 1_780_000_000;
const env = () => ({ DB: fakeD1(), TZ_NAME: 'Europe/Zurich' });
const stored = async (db) => (await db.prepare('SELECT ts FROM scrobbles ORDER BY ts DESC').all()).results.map((r) => r.ts);
const tsOf = (list) => list.map((s) => s.ts).sort((a, b) => b - a);

async function runUntilDone(e, api, now = NOW) {
  for (let run = 1; run <= 20; run++) {
    const res = await sync(e, { fetchPage: api.fetchPage, now });
    if (res.done) return run;
  }
  assert.fail('backfill never finished');
}

for (const inclusive of [true, false]) {
  test(`backfill imports the whole history over several runs (bounds ${inclusive ? 'inclusive' : 'exclusive'})`, async () => {
    const e = env();
    const api = fakeLastfm(history(1900, NOW - 100), { inclusive });

    const first = await sync(e, { fetchPage: api.fetchPage, now: NOW });
    // 4 pages of 200 per run; pages overlap by a row when the bounds are inclusive.
    assert.equal(api.calls.length, 4);
    assert.equal(first.done, false);
    assert.ok(first.count >= 797 && first.count <= 800);
    assert.equal(first.count, (await stored(e.DB)).length);

    const runs = await runUntilDone(e, api);
    assert.ok(runs >= 2);
    assert.deepEqual(await stored(e.DB), tsOf(api.scrobbles));
    const meta = await e.DB.prepare("SELECT value FROM meta WHERE key = 'count'").first();
    assert.equal(meta.value, 1900);
  });

  test(`new scrobbles are picked up after the backfill (bounds ${inclusive ? 'inclusive' : 'exclusive'})`, async () => {
    const e = env();
    const api = fakeLastfm(history(50, NOW - 100), { inclusive });
    await runUntilDone(e, api);

    api.scrobbles.push(scrobble(NOW + 10), scrobble(NOW + 20));
    api.calls.length = 0;
    const res = await sync(e, { fetchPage: api.fetchPage, now: NOW + 60 });
    assert.deepEqual(res, { count: 52, done: true });
    assert.equal(api.calls.length, 1); // one cheap call when up to date
    assert.deepEqual(await stored(e.DB), tsOf(api.scrobbles));
  });
}

test('a long gap is filled oldest first, so stopping early leaves no hole', async () => {
  const e = env();
  const api = fakeLastfm(history(10, NOW - 500_000));
  await runUntilDone(e, api, NOW - 400_000);

  // 1500 new scrobbles = 8 pages, more than one run can fetch.
  api.scrobbles.push(...history(1500, NOW - 100));
  await sync(e, { fetchPage: api.fetchPage, now: NOW });
  const after = await stored(e.DB);
  const newest = after[0];
  // Everything Last.fm has up to the newest stored scrobble is stored.
  assert.deepEqual(after, tsOf(api.scrobbles.filter((s) => s.ts <= newest)));
  assert.ok(after.length < 1510);

  for (let i = 0; i < 5; i++) await sync(e, { fetchPage: api.fetchPage, now: NOW });
  assert.deepEqual(await stored(e.DB), tsOf(api.scrobbles));
});

test('two tracks scrobbled in the same second are both kept, and re-reading adds nothing', async () => {
  const e = env();
  const api = fakeLastfm([scrobble(NOW - 50, 'A', 'One'), scrobble(NOW - 50, 'B', 'Two'), scrobble(NOW - 300, 'A', 'One')]);
  await runUntilDone(e, api);
  const res = await sync(e, { fetchPage: api.fetchPage, now: NOW });
  assert.equal(res.count, 3);
});

test('the playing track is not stored', async () => {
  const e = env();
  const api = fakeLastfm(history(3, NOW - 100), { nowPlaying: scrobble(0, 'Live', 'Playing') });
  await runUntilDone(e, api);
  assert.equal((await stored(e.DB)).length, 3);
});

test('a failed Last.fm call keeps what was imported and the next run continues', async () => {
  const e = env();
  const api = fakeLastfm(history(900, NOW - 100));
  api.failOnCall = 3;
  await assert.rejects(sync(e, { fetchPage: api.fetchPage, now: NOW }), /Operation failed/);

  const meta = await e.DB.prepare("SELECT json_group_object(key, value) AS m FROM meta").first();
  // Two pages went in before the failure, and the counter matches them.
  const rows = (await stored(e.DB)).length;
  assert.ok(rows >= 399);
  assert.deepEqual(JSON.parse(meta.m), { backfill_done: 0, count: rows, last_sync: null });

  await runUntilDone(e, api);
  assert.deepEqual(await stored(e.DB), tsOf(api.scrobbles));
  const count = await e.DB.prepare("SELECT value FROM meta WHERE key = 'count'").first();
  assert.equal(count.value, 900);
});

test('rows store local wall-clock time', async () => {
  const e = env();
  const ts = Date.parse('2026-07-15T12:00:00Z') / 1000;
  await sync(e, { fetchPage: fakeLastfm([scrobble(ts)]).fetchPage, now: ts + 60 });
  const row = await e.DB.prepare('SELECT lt - ts AS offset FROM scrobbles').first();
  assert.equal(row.offset, 7200);
});
