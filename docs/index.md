# lastfm-stats docs

## What it does
Shows Last.fm listening stats for one user (`LASTFM_USER` in `worker/wrangler.jsonc`) in three views:
- **Recent**: now playing and the last 100 scrobbles, live from Last.fm.
- **Top**: artists, tracks or albums for a period (7 days to all time, or a custom range).
- **Trends**: scrobbles per day, week or month, plus a weekday x hour listening clock.

## Why a Worker with its own database
Last.fm only offers top lists for fixed periods and is slow. The Worker copies every scrobble into D1 once and then answers any range from that copy. It also keeps the API key out of this public repo. The data it serves is already public on the Last.fm profile, so there is no login.

## Key files
- `worker/src/index.js` – routes, CORS, the scheduled sync.
- `worker/src/sync.js` – the sync (see below).
- `worker/src/stats.js` – SQL for top lists and trends.
- `worker/src/lastfm.js` – Last.fm calls and mapping of its JSON.
- `worker/src/time.js` – local-time offset and bucket keys.
- `worker/schema.sql` – tables `scrobbles` and `meta`.
- `app.js`, `style.css`, `index.html` – phone site.
- `desktop/qml/*.qml`, `desktop/main.cpp` – desktop app.

## Look
Tinted dark surfaces with pink as the main accent and baby blue as the second (light variants follow the system). Square corners everywhere (no rounding, by request), one loud gradient card for now playing, a hero card for number one in Top. Charts: bars are pink, the listening clock is blue. Motion is short on purpose: 200 ms fades and an 8 px rise, nothing travels across the screen.
- Colours live in `style.css` (`:root`) and `desktop/qml/Theme.qml`: change both together.
- Font is Rubik (Google Fonts on the site, the installed font on the desktop). Desktop sidebar icons are ligatures of the installed Material Symbols Rounded font.

## Worker API
All `GET`, JSON, public. `from`/`to` are unix seconds (`from` inclusive, `to` exclusive, default: everything up to now).

| Route | Returns |
|---|---|
| `/summary` | `{count, backfillDone, lastSync, firstTs, playcount, registered}`; `playcount` is live from Last.fm, `null` if that call fails |
| `/recent?limit=50` | `{nowPlaying, tracks:[{ts, artist, track, album, image}]}`, live from Last.fm |
| `/top?type=artists\|tracks\|albums&from=&to=&limit=50` | `{items:[{artist, track?, album?, plays}]}` |
| `/trends?bucket=day\|week\|month&from=&to=` | `{plays, buckets:[{key, plays}], clock}`; `clock[weekday][hour]`, weekday 0 = Sunday |

`/top` and `/trends` are cacheable for 60 s.

## How the sync works
A cron trigger runs `sync()` every minute, with at most 4 Last.fm pages (800 scrobbles) per run.
1. **New scrobbles**: everything from the newest stored scrobble up to now. If that is more than one page, the oldest page is stored first, so a run that stops early leaves no hole.
2. **History**: until `backfill_done`, it walks back from the oldest stored scrobble.

`meta` holds `count`, `backfill_done` and `last_sync`. The count is kept there because `COUNT(*)` would read every row on each app start.

Each row also stores `lt`, the scrobble time shifted to wall-clock time in `TZ_NAME`. SQLite has no time zones, so day buckets and the listening clock use `lt`; range filters use the real `ts`.

## Setup / deploy
1. `npm install`. In a shell without nvm there is no `npx`; use `./node_modules/.bin/wrangler`.
2. Database (once): `wrangler d1 create lastfm-stats`, put the id in `worker/wrangler.jsonc`, then `wrangler d1 execute lastfm-stats --remote --file worker/schema.sql --config worker/wrangler.jsonc`.
3. `wrangler secret put LASTFM_API_KEY --config worker/wrangler.jsonc`, then `npm run deploy`.
4. Phone site: push to GitHub with Pages on (branch `main`, root). Open it in Safari, Share → Add to Home Screen.
5. Desktop app: `cmake -S desktop -B desktop/build -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=$HOME/.local`, then `cmake --build desktop/build` and `cmake --install desktop/build`. This installs `~/.local/bin/lastfm-stats`, a launcher entry and the icon.

Live: Worker https://lastfm-stats.kzn-intranet.workers.dev, site https://landofif.github.io/stats/, repo `landofif/stats` (local folder `~/lastfm-stats`).

Local preview of the site: the `stats-site` entry in `~/.claude/launch.json`.

## Gotchas
- Last.fm doesn't say whether `from`/`to` are inclusive. The sync asks for one second more on each side and relies on `INSERT OR IGNORE`, so either way works (tested both).
- Cloudflare free plan limits shape the sync: 10 ms CPU and 50 D1 queries per run (hence 4 pages and one JSON-parameter insert per page), and 100,000 D1 row writes per day. A history larger than that pauses when the limit is hit and continues the next day; nothing is lost.
- D1 also bills rows read: an all-time top list reads the whole table. The apps cache answers for a minute to keep that down.
- Changing `TZ_NAME` does not rewrite `lt` for rows already stored.
- The playing track appears in every Last.fm page and has no date; it is never stored.
- Qt logs to the journal when not started from a terminal. To see QML warnings: `QT_FORCE_STDERR_LOGGING=1 lastfm-stats`.
- Track and artist names are untrusted text: the site builds DOM nodes (no `innerHTML`), and QML `Text` showing them sets `textFormat: Text.PlainText`.

## Tests
`npm test`: `time.test.js`, `sync.test.js`, `stats.test.js` (unit, on a fake Last.fm and SQLite) and `worker.test.js` (integration: the real handlers, scheduled sync, then every route). The two apps have no automated tests.
