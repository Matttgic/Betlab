export const FOOTBALL_DATA_LEAGUES = Object.freeze([
  { code: 'E0', name: 'Premier League', country: 'Angleterre' },
  { code: 'SP1', name: 'La Liga', country: 'Espagne' },
  { code: 'D1', name: 'Bundesliga', country: 'Allemagne' },
  { code: 'I1', name: 'Serie A', country: 'Italie' },
  { code: 'F1', name: 'Ligue 1', country: 'France' }
]);

const LEAGUE_BY_CODE = new Map(FOOTBALL_DATA_LEAGUES.map((league) => [league.code, league]));

function normalizeSeasonKey(value) {
  const season = String(value || '').trim();
  if (!/^\d{4}$/.test(season)) throw new Error(`Saison Football-Data invalide: ${season}`);
  return season;
}

function normalizeLeagueCode(value) {
  const league = String(value || '').trim().toUpperCase();
  if (!LEAGUE_BY_CODE.has(league)) throw new Error(`Ligue Football-Data non supportée: ${league}`);
  return league;
}

export function seasonKeyForDate(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const startYear = month >= 7 ? year : year - 1;
  return `${String(startYear).slice(-2)}${String(startYear + 1).slice(-2)}`;
}

export function recentSeasonKeys(count = 3, date = new Date()) {
  const current = seasonKeyForDate(date);
  const startYear = 2000 + Number(current.slice(0, 2));
  const n = Math.min(6, Math.max(1, Number(count) || 3));
  return Array.from({ length: n }, (_, index) => {
    const y = startYear - index;
    return `${String(y).slice(-2)}${String(y + 1).slice(-2)}`;
  });
}

export function seasonLabel(season) {
  const key = normalizeSeasonKey(season);
  return `20${key.slice(0, 2)}/20${key.slice(2)}`;
}

export function footballDataUrl(season, league) {
  const seasonKey = normalizeSeasonKey(season);
  const leagueCode = normalizeLeagueCode(league);
  return `https://www.football-data.co.uk/mmz4281/${seasonKey}/${leagueCode}.csv`;
}

export async function downloadFootballDataCsv({ season, league, fetchImpl = fetch } = {}) {
  const seasonKey = normalizeSeasonKey(season);
  const leagueCode = normalizeLeagueCode(league);
  const url = footballDataUrl(seasonKey, leagueCode);
  const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(12000) : undefined;
  const response = await fetchImpl(url, {
    headers: {
      accept: 'text/csv,text/plain;q=0.9,*/*;q=0.5',
      'user-agent': 'BetLab/1.0 (+https://betlab-sandy.vercel.app)'
    },
    signal
  });
  if (!response.ok) throw new Error(`Football-Data ${leagueCode} ${seasonKey}: HTTP ${response.status}`);
  const csv = await response.text();
  const header = String(csv).split(/\r?\n/, 1)[0] || '';
  if (!header.includes('FTR')) throw new Error(`Football-Data ${leagueCode} ${seasonKey}: CSV sans colonne FTR`);
  const meta = LEAGUE_BY_CODE.get(leagueCode);
  return {
    season: seasonKey,
    seasonLabel: seasonLabel(seasonKey),
    league: leagueCode,
    leagueName: meta.name,
    country: meta.country,
    url,
    csv
  };
}

export async function downloadFootballDataSet({ seasons, leagues, fetchImpl = fetch } = {}) {
  const seasonList = (Array.isArray(seasons) && seasons.length ? seasons : recentSeasonKeys(3))
    .slice(0, 6)
    .map(normalizeSeasonKey);
  const leagueList = (Array.isArray(leagues) && leagues.length ? leagues : FOOTBALL_DATA_LEAGUES.map((x) => x.code))
    .slice(0, FOOTBALL_DATA_LEAGUES.length)
    .map(normalizeLeagueCode);

  const jobs = [];
  for (const season of seasonList) {
    for (const league of leagueList) jobs.push({ season, league });
  }

  const settled = await Promise.allSettled(jobs.map((job) => downloadFootballDataCsv({ ...job, fetchImpl })));
  const items = [];
  const errors = [];
  settled.forEach((entry, index) => {
    if (entry.status === 'fulfilled') items.push(entry.value);
    else errors.push({ ...jobs[index], error: entry.reason?.message || String(entry.reason) });
  });
  return { items, errors, seasons: seasonList, leagues: leagueList };
}
