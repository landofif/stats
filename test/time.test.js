import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offsetSeconds, bucketKey, bucketRange } from '../worker/src/time.js';

const TZ = 'Europe/Zurich';
const at = (iso) => Date.parse(iso) / 1000;

test('offset follows daylight saving time', () => {
  assert.equal(offsetSeconds(at('2026-01-15T12:00:00Z'), TZ), 3600);
  assert.equal(offsetSeconds(at('2026-07-15T12:00:00Z'), TZ), 7200);
  // Clocks go forward at 01:00 UTC on the last Sunday of March.
  assert.equal(offsetSeconds(at('2026-03-29T00:59:59Z'), TZ), 3600);
  assert.equal(offsetSeconds(at('2026-03-29T01:00:00Z'), TZ), 7200);
});

test('bucket keys use local time', () => {
  // 23:30 UTC on Sunday 5 July is 01:30 on Monday 6 July in Zurich.
  const ts = at('2026-07-05T23:30:00Z');
  assert.equal(bucketKey(ts, 'day', TZ), '2026-07-06');
  assert.equal(bucketKey(ts, 'week', TZ), '2026-07-06');
  assert.equal(bucketKey(ts, 'month', TZ), '2026-07');
  // A Sunday belongs to the week that started the Monday before.
  assert.equal(bucketKey(at('2026-07-05T12:00:00Z'), 'week', TZ), '2026-06-29');
  assert.equal(bucketKey(at('2026-07-31T22:30:00Z'), 'month', TZ), '2026-08');
});

test('bucket ranges include every step', () => {
  assert.deepEqual(bucketRange('2026-02-27', '2026-03-02', 'day'),
    ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  assert.deepEqual(bucketRange('2026-06-29', '2026-07-13', 'week'),
    ['2026-06-29', '2026-07-06', '2026-07-13']);
  assert.deepEqual(bucketRange('2025-11', '2026-02', 'month'),
    ['2025-11', '2025-12', '2026-01', '2026-02']);
  assert.deepEqual(bucketRange('2026-03', '2026-02', 'month'), []);
});
