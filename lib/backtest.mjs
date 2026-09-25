import { parseCSV, extractFootballDataMatch } from './csv.mjs';
import {
  devigMultiplicative, devigPower, mean, brierBinary, logLossBinary,
  bootstrapMeanCI, maxDrawdown, longestLosingStreak, eceBinary
} from './math.mjs';

const ODDS_BUCKETS = [
  [1.01, 1.25, '<1.25'], [1.25, 1.50, '1.25–1.49'], [1.50, 1.75, '1.50–1.74'],
  [1.75, 2.00, '1.75–1.99'], [2.00, 2.50, '2.00–2.49'], [2.50, 3.00, '2.50–2.99'],
  [3.00, 4.00, '3.00–3.99'], [4.00, 6.00, '4.00–5.99'], [6.00, 10.00, '6.00–9.99'],
  [10.00, Infinity, '10+']
];

function summarize(obs, stake = 10) {
  if (!obs.length) return null;
  const returns = obs.map((o) => o.y ? stake * (o.odds - 1) : -stake);
  const wins = obs.map((o) => Boolean(o.y));
  const profit = returns.reduce((a, b) => a + b, 0);
  const roiReturns = obs.map((o) => o.y ? o.odds - 1 : -1);
  const [ciLow, ciHigh] = bootstrapMeanCI(roiReturns);
  const top10 = [...returns].sort((a, b) => b - a).slice(0, 10).reduce((a, b) => a + b, 0);
  const longshotProfit = obs.reduce((s, o, i) => s + (o.odds > 5 ? returns[i] : 0), 0);
  return {
    n: obs.length,
    wins: wins.filter(Boolean).length,
    winRate: mean(obs.map((o) => o.y)),
    avgOdds: mean(obs.map((o) => o.odds)),
    avgFairP: mean(obs.map((o) => o.p)),
    brier: mean(obs.map((o) => brierBinary(o.p, o.y))),
    logLoss: mean(obs.map((o) => logLossBinary(o.p, o.y))),
    ece: eceBinary(obs),
    stakeTotal: stake * obs.length,
    returnTotal: stake * obs.length + profit,
    profit,
    roi: profit / (stake * obs.length),
    roiCi95: [ciLow, ciHigh],
    maxDrawdown: maxDrawdown(returns),
    longestLosingStreak: longestLosingStreak(wins),
    longshotDependencyRatio: profit > 0 ? longshotProfit / profit : null,
    profitConcentrationTop10: profit > 0 ? top10 / profit : null
  };
}

function executableStrategy(matches, selector, useOpen = false, stake = 10) {
  const obs = [];
  for (const m of matches) {
    const odds = useOpen && m.open ? m.open : m.close;
    if (!odds) continue;
    const ps = devigMultiplicative(m.close);
    const idx = selector(odds);
    const resultIdx = { H: 0, D: 1, A: 2 }[m.result];
    obs.push({ odds: odds[idx], p: ps[idx], y: idx === resultIdx ? 1 : 0, idx,
      clv: useOpen && m.open ? odds[idx] / m.close[idx] - 1 : null });
  }
  const summary = summarize(obs, stake);
  if (!summary) return null;
  summary.avgClv = mean(obs.map((o) => o.clv).filter(Number.isFinite));
  return summary;
}

export function backtestFootballFLB(csv, { devig = 'multiplicative', stake = 10 } = {}) {
  const rows = parseCSV(csv);
  const matches = rows.map(extractFootballDataMatch).filter(Boolean);
  if (!matches.length) throw new Error('Aucun match exploitable trouvé. Vérifie que le CSV contient FTR et des cotes 1X2 Football-Data.');
  const devigFn = devig === 'power' ? devigPower : devigMultiplicative;
  const observations = [];
  for (const m of matches) {
    const ps = devigFn(m.close);
    const resultIdx = { H: 0, D: 1, A: 2 }[m.result];
    for (let i = 0; i < 3; i++) {
      observations.push({ odds: m.close[i], p: ps[i], y: i === resultIdx ? 1 : 0, outcome: ['H', 'D', 'A'][i] });
    }
  }
  const buckets = ODDS_BUCKETS.map(([lo, hi, label]) => {
    const obs = observations.filter((o) => o.odds >= lo && o.odds < hi);
    const s = summarize(obs, stake);
    return s ? { label, ...s, calibrationGap: s.winRate - s.avgFairP } : { label, n: 0 };
  });
  const favorite = executableStrategy(matches, (odds) => odds.indexOf(Math.min(...odds)), false, stake);
  const longshot = executableStrategy(matches, (odds) => odds.indexOf(Math.max(...odds)), false, stake);
  const favoriteOpen = matches.some((m) => m.open) ? executableStrategy(matches, (odds) => odds.indexOf(Math.min(...odds)), true, stake) : null;
  const longshotOpen = matches.some((m) => m.open) ? executableStrategy(matches, (odds) => odds.indexOf(Math.max(...odds)), true, stake) : null;
  return {
    meta: { rows: rows.length, matches: matches.length, observations: observations.length, devig, stake },
    marketDiagnostic: summarize(observations, stake),
    buckets,
    executable: { favoriteClose: favorite, longshotClose: longshot, favoriteOpen, longshotOpen },
    warning: 'Le diagnostic par bucket traite chaque issue 1X2 comme une observation de calibration; ce n’est pas une stratégie consistant à parier simultanément les 3 issues.'
  };
}
