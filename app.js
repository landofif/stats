// Phone site. Only talks to the Worker, which has the scrobble history.
const API = 'https://lastfm-stats.kzn-intranet.workers.dev';

const PERIODS = [
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '3 months', days: 90 },
  { id: '180d', label: '6 months', days: 180 },
  { id: '365d', label: '12 months', days: 365 },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];
const TYPES = [['artists', 'Artists'], ['tracks', 'Tracks'], ['albums', 'Albums']];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const state = { view: 'recent', type: 'artists', period: '30d', from: '', to: '' };
try { Object.assign(state, JSON.parse(localStorage.getItem('stats-state'))); } catch {}
const save = () => { try { localStorage.setItem('stats-state', JSON.stringify(state)); } catch {} };

const $ = (sel) => document.querySelector(sel);
const num = (n) => n.toLocaleString('en');
const sec = (date) => Math.floor(date / 1000);

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (value != null && value !== false) el.setAttribute(key, value);
  }
  el.append(...kids.flat().filter((kid) => kid != null && kid !== false));
  return el;
}

// ---- data ----
const cache = new Map();
let drawId = 0;

// Draws cached data at once, then refreshes it if it is `live` or over a minute old.
async function load(path, draw, live = false) {
  const id = ++drawId;
  const hit = cache.get(path);
  // New content fades in; a background refresh of what is already shown does not.
  $('#content').classList.add('enter');
  if (hit) draw(hit.data);
  else $('#content').replaceChildren(h('p', { class: 'hint' }, 'Loading…'));
  if (hit && !live && Date.now() - hit.at < 60e3) return;
  try {
    const res = await fetch(API + path);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.status);
    cache.set(path, { data, at: Date.now() });
    if (id !== drawId) return;
    if (hit) $('#content').classList.remove('enter');
    draw(data);
  } catch (err) {
    if (id === drawId && !hit) $('#content').replaceChildren(h('p', { class: 'hint' }, `Could not load: ${err.message}`));
  }
}

// The chosen period as { from, to, days }. Presets start at local midnight, so a
// "7 days" chart has exactly 7 bars; `to` is left out so the URL stays cacheable.
function range() {
  const period = PERIODS.find((p) => p.id === state.period);
  const now = new Date();
  if (period.days) {
    return { from: sec(new Date(now.getFullYear(), now.getMonth(), now.getDate() - period.days + 1)), days: period.days };
  }
  if (period.id === 'custom') {
    if (!state.from || !state.to || state.from > state.to) return null;
    const from = new Date(`${state.from}T00:00`);
    const to = new Date(`${state.to}T00:00`);
    to.setDate(to.getDate() + 1);
    return { from: sec(from), to: sec(to), days: Math.round((to - from) / 864e5) };
  }
  return { from: 0, days: 0 };
}

const bucketFor = (days) => (days === 0 || days > 366 ? 'month' : days > 31 ? 'week' : 'day');
const query = (r) => `from=${r.from}${r.to ? `&to=${r.to}` : ''}`;

// ---- controls ----
function pressable(items, current, pick) {
  return items.map(([id, label]) => h('button', {
    'aria-pressed': String(id === current),
    onclick: () => { pick(id); save(); show(); },
  }, label));
}

function periodControls() {
  const chips = h('div', { class: 'chips' },
    pressable(PERIODS.map((p) => [p.id, p.label]), state.period, (id) => { state.period = id; }));
  if (state.period !== 'custom') return [chips];
  const input = (key) => h('input', {
    type: 'date', value: state[key], 'aria-label': key === 'from' ? 'From' : 'To',
    onchange: (e) => { state[key] = e.target.value; save(); show(); },
  });
  return [chips, h('div', { class: 'dates' }, input('from'), '–', input('to'))];
}

// ---- views ----
function art(src) {
  return src ? h('img', { class: 'art', src, alt: '', loading: 'lazy' }) : h('div', { class: 'art' });
}

function showRecent() {
  $('#controls').replaceChildren();
  load('/recent?limit=100', ({ nowPlaying, tracks }) => {
    const out = [];
    if (nowPlaying) {
      out.push(h('div', { class: 'card playing' }, art(nowPlaying.image), h('div', { class: 'text' },
        h('div', { class: 'label' }, h('span', { class: 'eq' }, h('i'), h('i'), h('i')), 'Now playing'),
        h('div', { class: 'name' }, nowPlaying.track),
        h('div', { class: 'sub' }, nowPlaying.artist))));
    }
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 864e5).toDateString();
    let day = '';
    let rows;
    for (const t of tracks) {
      const date = new Date(t.ts * 1000);
      if (date.toDateString() !== day) {
        day = date.toDateString();
        const title = day === today ? 'Today' : day === yesterday ? 'Yesterday'
          : date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        rows = h('div', { class: 'rows' });
        out.push(h('h2', {}, title), rows);
      }
      rows.append(h('div', { class: 'row' }, art(t.image),
        h('div', { class: 'text' }, h('div', { class: 'name' }, t.track),
          h('div', { class: 'sub' }, t.album ? `${t.artist} · ${t.album}` : t.artist)),
        h('div', { class: 'side' }, date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))));
    }
    if (!out.length) out.push(h('p', { class: 'hint' }, 'No scrobbles yet.'));
    $('#content').replaceChildren(...out);
  }, true);
}

function showTop() {
  $('#controls').replaceChildren(
    h('div', { class: 'segments' }, pressable(TYPES, state.type, (id) => { state.type = id; })),
    ...periodControls());
  const r = range();
  if (!r) return $('#content').replaceChildren(h('p', { class: 'hint' }, 'Pick a start and an end date.'));
  load(`/top?type=${state.type}&limit=100&${query(r)}`, ({ items }) => {
    if (!items.length) return $('#content').replaceChildren(h('p', { class: 'hint' }, 'Nothing in this period.'));
    const max = items[0].plays;
    $('#content').replaceChildren(h('div', { class: 'rows top' }, items.map((item, i) => h('div', { class: 'row' },
      h('div', { class: 'rank' }, String(i + 1)),
      h('div', { class: 'text' },
        h('div', { class: 'name' }, item.track ?? item.album ?? item.artist),
        state.type !== 'artists' && h('div', { class: 'sub' }, item.artist),
        h('div', { class: 'meter' }, h('span', { style: `width:${(item.plays / max) * 100}%` }))),
      h('div', { class: 'side' }, num(item.plays))))));
  });
}

function bucketLabel(key, bucket) {
  const date = new Date(`${key.length === 7 ? `${key}-01` : key}T00:00`);
  if (bucket === 'month') return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const day = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return bucket === 'week' ? `Week of ${day.replace(/^\w+,? /, '')}` : day;
}

// Hover, focus or tap on a mark writes its value to the caption above the chart.
function marks(caption, idle) {
  let picked;
  caption.replaceChildren(idle);
  return (text, value) => {
    const pick = (e) => {
      picked?.setAttribute('aria-pressed', 'false');
      picked = e.currentTarget;
      picked.setAttribute('aria-pressed', 'true');
      caption.replaceChildren(`${text}: `, h('b', {}, value));
    };
    return { 'aria-label': `${text}: ${value}`, 'aria-pressed': 'false', onpointerenter: pick, onfocus: pick, onclick: pick };
  };
}

function showTrends() {
  $('#controls').replaceChildren(...periodControls());
  const r = range();
  if (!r) return $('#content').replaceChildren(h('p', { class: 'hint' }, 'Pick a start and an end date.'));
  const bucket = bucketFor(r.days);
  load(`/trends?bucket=${bucket}&${query(r)}`, ({ plays, buckets, clock }) => {
    if (!plays) return $('#content').replaceChildren(h('p', { class: 'hint' }, 'Nothing in this period.'));

    // All time has no fixed length: count from the first bucket to today.
    const days = r.days || Math.max(1, Math.round((Date.now() - new Date(`${buckets[0].key}-01T00:00`)) / 864e5));
    const byHour = Array.from({ length: 24 }, (_, hour) => clock.reduce((sum, row) => sum + row[hour], 0));
    const peak = byHour.indexOf(Math.max(...byHour));
    const tile = (value, label) => h('div', { class: 'tile' }, h('div', { class: 'value' }, value), h('div', { class: 'label' }, label));

    const unit = { day: 'day', week: 'week', month: 'month' }[bucket];
    const max = Math.max(...buckets.map((b) => b.plays));
    const barCaption = h('p', { class: 'caption' });
    const bar = marks(barCaption, `Most in one ${unit}: ${num(max)}`);
    const chart = h('div', { class: 'card' },
      h('h2', {}, `Scrobbles per ${unit}`), barCaption,
      h('div', { class: 'bars' }, buckets.map((b) => h('button', bar(bucketLabel(b.key, bucket), num(b.plays)),
        h('span', { style: `height:${(b.plays / max) * 100}%` })))),
      h('div', { class: 'axis' }, h('span', {}, bucketLabel(buckets[0].key, bucket)),
        h('span', {}, bucketLabel(buckets.at(-1).key, bucket))));

    const clockMax = Math.max(...clock.flat());
    const clockCaption = h('p', { class: 'caption' });
    const cell = marks(clockCaption, `Busiest hour: ${String(peak).padStart(2, '0')}:00`);
    const grid = h('div', { class: 'clock' });
    for (const dow of [1, 2, 3, 4, 5, 6, 0]) {
      grid.append(h('div', { class: 'day' }, DAYS[dow]), ...clock[dow].map((n, hour) => h('button', {
        ...cell(`${DAYS[dow]} ${String(hour).padStart(2, '0')}:00`, num(n)),
        // One hue, light to dark; empty hours keep the neutral cell colour.
        style: n ? `background: color-mix(in oklab, var(--blue) ${Math.round(15 + 85 * (n / clockMax))}%, var(--surface-2))` : null,
      })));
    }
    grid.append(h('div', {}), ...['00', '06', '12', '18'].map((t) => h('div', { class: 'hour' }, t)));

    $('#content').replaceChildren(
      h('div', { class: 'tiles' }, tile(num(plays), 'Scrobbles'),
        tile((plays / days).toFixed(1), 'Per day'), tile(`${String(peak).padStart(2, '0')}:00`, 'Peak hour')),
      chart,
      h('div', { class: 'card' }, h('h2', {}, 'When you listen'), clockCaption, grid));
  });
}

// ---- shell ----
const VIEWS = { recent: showRecent, top: showTop, trends: showTrends };

function show() {
  if (!VIEWS[state.view]) state.view = 'recent';
  for (const tab of document.querySelectorAll('#tabs button')) {
    tab.setAttribute('aria-pressed', String(tab.dataset.view === state.view));
  }
  $('#content').scrollTop = 0;
  VIEWS[state.view]();
  // The period row scrolls sideways; keep the chosen one on screen.
  $('.chips [aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

async function showSync() {
  try {
    const s = await (await fetch(`${API}/summary`)).json();
    $('#sync').textContent = s.backfillDone ? `${num(s.count)} scrobbles`
      : s.playcount ? `Importing ${num(s.count)} of ${num(s.playcount)}`
      : s.count ? `Importing… ${num(s.count)}` : 'Waiting for the first sync';
  } catch {}
}

for (const tab of document.querySelectorAll('#tabs button')) {
  tab.addEventListener('click', () => { state.view = tab.dataset.view; save(); show(); });
}
// Reopening the home-screen app refreshes what is on screen.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  show();
  showSync();
});
show();
showSync();
