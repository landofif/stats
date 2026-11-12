// Last.fm calls, and mapping of its JSON to plain rows.
const API = 'https://ws.audioscrobbler.com/2.0/';
// Last.fm's "no artwork" star, served as if it were a real cover.
const PLACEHOLDER = '2a96cbd8b46e442fc41c2b86b821562f';

async function call(env, method, params = {}) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    method, user: env.LASTFM_USER, api_key: env.LASTFM_API_KEY, format: 'json', ...params,
  });
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.error) {
    throw new Error(`last.fm ${res.status}: ${body?.message ?? 'no JSON'}`);
  }
  return body;
}

export async function recentPage(env, params = {}) {
  return (await call(env, 'user.getrecenttracks', { limit: 200, ...params })).recenttracks;
}

export async function userInfo(env) {
  const { user } = await call(env, 'user.getinfo');
  return { playcount: Number(user.playcount), registered: Number(user.registered?.unixtime ?? 0) };
}

export const totalPages = (recenttracks) => Number(recenttracks?.['@attr']?.totalPages ?? 0);

export function mapTracks(recenttracks) {
  // A single track comes as an object, not a one-item array.
  const items = [].concat(recenttracks?.track ?? []);
  let nowPlaying = null;
  const tracks = [];
  for (const t of items) {
    const image = t.image?.find((i) => i.size === 'large')?.['#text'] ?? '';
    const row = {
      artist: t.artist?.['#text'] ?? '',
      track: t.name ?? '',
      album: t.album?.['#text'] ?? '',
      image: image.includes(PLACEHOLDER) ? '' : image,
    };
    // The playing track is in every page, has no date, and is not a scrobble yet.
    if (t['@attr']?.nowplaying === 'true') nowPlaying = row;
    else if (t.date?.uts) tracks.push({ ts: Number(t.date.uts), ...row });
  }
  return { nowPlaying, tracks };
}
