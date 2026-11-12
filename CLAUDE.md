# lastfm-stats

Personal Last.fm listening stats: a Cloudflare Worker with the scrobble history, a phone site and a Qt desktop app. Read `docs/index.md` first.

- `worker/` syncs scrobbles from Last.fm into D1 every minute and serves the stats as JSON. Both apps only talk to the Worker.
- The phone site (`index.html`, `app.js`, `style.css`) is served by GitHub Pages from the repo root.
- `desktop/` is the Qt 6 / QML app. Its helpers in `qml/Api.qml` and its colours in `qml/Theme.qml` mirror `app.js` and `style.css`: change both sides together.
- Tests: `npm test` (Node's built-in runner; D1 is faked with `node:sqlite`). Fixtures are made up.
- The repo is public: the Last.fm API key lives only as a Worker secret, never in a file.
