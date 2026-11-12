// Local-time helpers. SQLite has no time zones, so rows store a shifted timestamp.
const formatters = new Map();
const offsets = new Map();

// Seconds to add to a UTC timestamp to get wall-clock time in `tz`.
export function offsetSeconds(ts, tz) {
  const hour = Math.floor(ts / 3600); // offsets only change on the hour
  const key = `${tz}|${hour}`;
  let offset = offsets.get(key);
  if (offset === undefined) {
    let fmt = formatters.get(tz);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
      });
      formatters.set(tz, fmt);
    }
    const p = {};
    for (const { type, value } of fmt.formatToParts(new Date(hour * 3600e3))) p[type] = Number(value);
    offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) / 1000 - hour * 3600;
    offsets.set(key, offset);
  }
  return offset;
}

// Same keys as the SQL in stats.js: day 'YYYY-MM-DD', week = its Monday, month 'YYYY-MM'.
export function bucketKey(ts, bucket, tz) {
  const d = new Date((ts + offsetSeconds(ts, tz)) * 1000);
  if (bucket === 'week') d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, bucket === 'month' ? 7 : 10);
}

// Every key from `first` to `last`, so quiet days still get a bar.
export function bucketRange(first, last, bucket) {
  const keys = [];
  const d = new Date(`${first.length === 7 ? `${first}-01` : first}T00:00:00Z`);
  for (let key = first; key <= last && keys.length < 2000;) {
    keys.push(key);
    if (bucket === 'month') d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCDate(d.getUTCDate() + (bucket === 'week' ? 7 : 1));
    key = d.toISOString().slice(0, bucket === 'month' ? 7 : 10);
  }
  return keys;
}
