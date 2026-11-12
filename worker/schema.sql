CREATE TABLE IF NOT EXISTS scrobbles (
  ts INTEGER NOT NULL,   -- scrobble time, unix seconds (UTC)
  lt INTEGER NOT NULL,   -- ts shifted to wall-clock time in TZ_NAME, used for day/hour buckets
  artist TEXT NOT NULL,
  track TEXT NOT NULL,
  album TEXT NOT NULL,
  PRIMARY KEY (ts, artist, track)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value) WITHOUT ROWID;
