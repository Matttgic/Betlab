import { clampProbability } from './math.mjs';

export function parseMatchDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return new Date(value.getTime());
  const text = String(value ?? '').trim();
  if (!text) return null;
  const euro = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (euro) {
    let year = Number(euro[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const date = new Date(Date.UTC(year, Number(euro[2]) - 1, Number(euro[1])));
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function temporalSplit(rows, {
  trainEnd,
  calibrationEnd,
  dateField = 'date'
} = {}) {
  const trainEndDate = parseMatchDate(trainEnd);
  const calibrationEndDate = parseMatchDate(calibrationEnd);
  if (!trainEndDate || !calibrationEndDate || trainEndDate >= calibrationEndDate) {
    throw new Error('Temporal split requires trainEnd < calibrationEnd with valid dates');
  }
  const train = [], calibration = [], test = [], rejected = [];
  const ordered = [...rows].map((row, index) => ({ row, index, date: parseMatchDate(row?.[dateField]) }))
    .sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity) || a.index - b.index);
  for (const item of ordered) {
    if (!item.date) { rejected.push(item.row); continue; }
    if (item.date <= trainEndDate) train.push(item.row);
    else if (item.date <= calibrationEndDate) calibration.push(item.row);
    else test.push(item.row);
  }
  return {
    train,
    calibration,
    test,
    rejected,
    meta: {
      trainEnd: trainEndDate.toISOString(),
      calibrationEnd: calibrationEndDate.toISOString(),
      train: train.length,
      calibration: calibration.length,
      test: test.length,
      rejected: rejected.length
    }
  };
}

export function fitIsotonicCalibrator(observations) {
  const clean = observations
    .map((o) => ({ p: Number(o.p), y: Number(o.y), weight: Number(o.weight ?? 1) }))
    .filter((o) => Number.isFinite(o.p) && (o.y === 0 || o.y === 1) && Number.isFinite(o.weight) && o.weight > 0)
    .sort((a, b) => a.p - b.p);
  if (!clean.length) throw new Error('No valid observations for isotonic calibration');

  const grouped = [];
  for (const o of clean) {
    const last = grouped[grouped.length - 1];
    if (last && last.lo === o.p) {
      last.hi = o.p;
      last.weight += o.weight;
      last.sumY += o.y * o.weight;
      last.value = last.sumY / last.weight;
    } else {
      grouped.push({ lo: o.p, hi: o.p, weight: o.weight, sumY: o.y * o.weight, value: o.y });
    }
  }

  const blocks = [];
  for (const block of grouped) {
    blocks.push({ ...block });
    while (blocks.length >= 2 && blocks.at(-2).value > blocks.at(-1).value) {
      const right = blocks.pop();
      const left = blocks.pop();
      const weight = left.weight + right.weight;
      const sumY = left.sumY + right.sumY;
      blocks.push({ lo: left.lo, hi: right.hi, weight, sumY, value: sumY / weight });
    }
  }
  return {
    n: clean.length,
    minP: clean[0].p,
    maxP: clean.at(-1).p,
    blocks: blocks.map(({ lo, hi, weight, value }) => ({ lo, hi, weight, value: clampProbability(value) }))
  };
}

export function applyIsotonicCalibrator(calibrator, p) {
  const x = clampProbability(Number(p));
  const blocks = calibrator?.blocks || [];
  if (!blocks.length) throw new Error('Invalid isotonic calibrator');
  if (x <= blocks[0].hi) return blocks[0].value;
  for (const block of blocks) if (x <= block.hi) return block.value;
  return blocks.at(-1).value;
}

export function fractionalKelly(p, odds, { fraction = 0.25, cap = 0.10 } = {}) {
  const probability = clampProbability(Number(p));
  const decimalOdds = Number(odds);
  if (!(decimalOdds > 1)) return 0;
  const edge = probability * decimalOdds - 1;
  if (!(edge > 0)) return 0;
  const fullKelly = edge / (decimalOdds - 1);
  return Math.max(0, Math.min(Number(cap), fullKelly * Math.max(0, Number(fraction))));
}

function scoreFromMatch(match) {
  if (Number.isFinite(Number(match.homeGoals)) && Number.isFinite(Number(match.awayGoals))) {
    const h = Number(match.homeGoals), a = Number(match.awayGoals);
    return h > a ? 1 : h < a ? 0 : 0.5;
  }
  const result = String(match.result ?? '').toUpperCase();
  if (result === 'H') return 1;
  if (result === 'A') return 0;
  if (result === 'D') return 0.5;
  return null;
}

export function buildEloFeatures(matches, {
  initialRating = 1500,
  k = 20,
  homeAdvantage = 100,
  dateField = 'date',
  homeField = 'home',
  awayField = 'away'
} = {}) {
  const ratings = new Map();
  const ordered = [...matches].map((match, index) => ({ match, index, date: parseMatchDate(match?.[dateField]) }))
    .sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity) || a.index - b.index);
  const out = [];
  for (const { match, index } of ordered) {
    const home = String(match?.[homeField] ?? '');
    const away = String(match?.[awayField] ?? '');
    if (!home || !away) continue;
    const homeElo = ratings.get(home) ?? initialRating;
    const awayElo = ratings.get(away) ?? initialRating;
    const expectedHome = 1 / (1 + 10 ** (-(homeElo + homeAdvantage - awayElo) / 400));
    out.push({ index, homeElo, awayElo, eloDiff: homeElo - awayElo, eloHomeWinProb: expectedHome });
    const score = scoreFromMatch(match);
    if (score === null) continue;
    const delta = k * (score - expectedHome);
    ratings.set(home, homeElo + delta);
    ratings.set(away, awayElo - delta);
  }
  return out.sort((a, b) => a.index - b.index);
}

export function buildFatigueFeatures(matches, {
  dateField = 'date',
  homeField = 'home',
  awayField = 'away',
  congestionDays = 7
} = {}) {
  const history = new Map();
  const ordered = [...matches].map((match, index) => ({ match, index, date: parseMatchDate(match?.[dateField]) }))
    .sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity) || a.index - b.index);
  const result = [];
  const snapshot = (team, date) => {
    const dates = history.get(team) || [];
    const prior = dates.filter((d) => d < date);
    const last = prior.at(-1);
    const daysSinceLast = last ? (date - last) / 86_400_000 : null;
    const windowStart = new Date(date.getTime() - congestionDays * 86_400_000);
    const matchesInWindow = prior.filter((d) => d >= windowStart).length;
    return { daysSinceLast, matchesInWindow };
  };
  for (const { match, index, date } of ordered) {
    if (!date) continue;
    const home = String(match?.[homeField] ?? '');
    const away = String(match?.[awayField] ?? '');
    if (!home || !away) continue;
    const h = snapshot(home, date), a = snapshot(away, date);
    result.push({
      index,
      homeDaysSinceLast: h.daysSinceLast,
      awayDaysSinceLast: a.daysSinceLast,
      homeMatchesLast7: h.matchesInWindow,
      awayMatchesLast7: a.matchesInWindow,
      restDiffDays: h.daysSinceLast == null || a.daysSinceLast == null ? null : h.daysSinceLast - a.daysSinceLast
    });
    history.set(home, [...(history.get(home) || []), date]);
    history.set(away, [...(history.get(away) || []), date]);
  }
  return result.sort((a, b) => a.index - b.index);
}

export function attachPregameFeatures(matches, options = {}) {
  const elo = new Map(buildEloFeatures(matches, options.elo).map((x) => [x.index, x]));
  const fatigue = new Map(buildFatigueFeatures(matches, options.fatigue).map((x) => [x.index, x]));
  return matches.map((match, index) => ({
    ...match,
    ...(elo.get(index) || {}),
    ...(fatigue.get(index) || {}),
    index: undefined
  }));
}
