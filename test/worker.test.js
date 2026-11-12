// Integration: the real Worker handlers against a fake Last.fm (over fetch) and SQLite.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/src/index.js';
import { fakeD1, fakeLastfm, scrobble } from './fixtures.js';

const realFetch = globalThis.fetch;
const minutesAgo = (m) => Math.floor(Date.now() / 1000) - m * 60;
let api;
let env;
let requested;

beforeEach(() => {
  api = fakeLastfm([
    scrobble(minutesAgo(10), 'Alpha', 'Song A', 'First'),
    scrobble(minutesAgo(20), 'Alpha', 'Song B', 'First'),
    scrobble(minutesAgo(30), 'Beta', 'Song C', 'Second'),
  ], { nowPlaying: scrobble(0, 'Beta', 'Song D', 'Second') });
  env = { DB: fakeD1(), TZ_NAME: 'Europe/Zurich', LASTFM_USER: 'someone', LASTFM_API_KEY: 'test-key' };
  requested = [];
  globalThis.fetch = async (url) => {
    const q = Object.fromEntries(new URL(url).searchParams);
    requested.push(q);
    const body = q.method === 'user.getinfo'
      ? { user: { playcount: '3', registered: { unixtime: '1500000000' } } }
      : { recenttracks: api.recent(q) };
    return Response.json(body);
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

const get = async (path) => {
  const res = await worker.fetch(new Request(`https://worker.example${path}`), env);
  return { status: res.status, headers: res.headers, body: await res.json() };
};

test('scheduled sync fills the database and the routes serve it', async () => {
  await worker.scheduled({}, env);
  assert.ok(requested.every((q) => q.user === 'someone' && q.api_key === 'test-key' && q.format === 'json'));

  const summary = await get('/summary');
  assert.equal(summary.status, 200);
  assert.equal(summary.headers.get('access-control-allow-origin'), '*');
  assert.equal(summary.body.count, 3);
  assert.equal(summary.body.playcount, 3);
  assert.equal(summary.body.backfillDone, true);

  const top = await get('/top?type=artists');
  assert.deepEqual(top.body.items, [
    { artist: 'Alpha', plays: 2, image: 'https://img.example/large.jpg' },
    { artist: 'Beta', plays: 1, image: 'https://img.example/large.jpg' },
  ]);
  assert.match(top.headers.get('cache-control'), /max-age=60/);

  const trends = await get(`/trends?bucket=day&from=${minutesAgo(60)}`);
  assert.equal(trends.body.plays, 3);
  assert.equal(trends.body.buckets.reduce((sum, b) => sum + b.plays, 0), 3);
  assert.equal(trends.body.clock.length, 7);
});

test('/recent is live and separates the playing track', async () => {
  const { body } = await get('/recent?limit=2');
  assert.deepEqual(body.nowPlaying, { artist: 'Beta', track: 'Song D', album: 'Second', image: 'https://img.example/large.jpg' });
  assert.deepEqual(body.tracks.map((t) => t.track), ['Song A', 'Song B']);
  assert.equal(requested[0].limit, '2');
});

test('bad requests get clear errors', async () => {
  assert.equal((await get('/top?type=genres')).status, 400);
  assert.equal((await get('/trends?bucket=year')).status, 400);
  assert.equal((await get('/nope')).status, 404);
  const post = await worker.fetch(new Request('https://worker.example/top', { method: 'POST' }), env);
  assert.equal(post.status, 405);
});

test('a Last.fm error is reported without the API key', async () => {
  globalThis.fetch = async () => Response.json({ error: 10, message: 'Invalid API key' }, { status: 403 });
  const res = await get('/recent');
  assert.equal(res.status, 502);
  assert.equal(res.body.error, 'last.fm 403: Invalid API key');
  // /summary still answers from the database.
  assert.equal((await get('/summary')).body.playcount, null);
});

test('without an API key nothing is synced', async () => {
  delete env.LASTFM_API_KEY;
  await worker.scheduled({}, env);
  assert.equal(requested.length, 0);
  assert.equal((await get('/recent')).status, 503);
  assert.equal((await get('/summary')).body.count, 0);
});
