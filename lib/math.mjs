export const clamp = (x, lo = 1e-9, hi = 1 - 1e-9) => Math.min(hi, Math.max(lo, x));

export function devigMultiplicative(odds) {
  const qs = odds.map((o) => (Number.isFinite(o) && o > 1 ? 1 / o : NaN));
  if (qs.some((q) => !Number.isFinite(q))) return null;
  const sum = qs.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return null;
  return qs.map((q) => q / sum);
}

export function devigPower(odds) {
  const qs = odds.map((o) => (Number.isFinite(o) && o > 1 ? 1 / o : NaN));
  if (qs.some((q) => !Number.isFinite(q))) return null;
  let lo = 0.05, hi = 5;
  const f = (k) => qs.reduce((s, q) => s + q ** k, 0) - 1;
  if (f(lo) < 0 || f(hi) > 0) return devigMultiplicative(odds);
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid; else hi = mid;
  }
  const k = (lo + hi) / 2;
  const ps = qs.map((q) => q ** k);
  const sum = ps.reduce((a, b) => a + b, 0);
  return ps.map((p) => p / sum);
}

export function expectedValue(p, odds) {
  return clampProbability(p) * odds - 1;
}

export function clampProbability(p) {
  return clamp(Number(p));
}

export function shrunkProbability(modelP, marketP, reliability = 0.25) {
  const w = Math.min(1, Math.max(0, Number(reliability)));
  return clampProbability(w * clampProbability(modelP) + (1 - w) * clampProbability(marketP));
}

export function conservativeProbability(pShrunk, uncertainty = 0.03, z = 1) {
  return clampProbability(pShrunk - Math.max(0, Number(uncertainty)) * z);
}

export function robustEV({ modelP, marketP, odds, reliability = 0.25, uncertainty = 0.03 }) {
  const pShrunk = shrunkProbability(modelP, marketP, reliability);
  const pConservative = conservativeProbability(pShrunk, uncertainty);
  return {
    pShrunk,
    pConservative,
    evRaw: expectedValue(modelP, odds),
    evShrunk: expectedValue(pShrunk, odds),
    evRobust: expectedValue(pConservative, odds)
  };
}

export function brierBinary(p, y) {
  return (clampProbability(p) - Number(y)) ** 2;
}

export function logLossBinary(p, y) {
  const pp = clampProbability(p);
  return -(Number(y) * Math.log(pp) + (1 - Number(y)) * Math.log(1 - pp));
}

export function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

export function percentile(xs, p) {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const idx = (a.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return a[lo];
  return a[lo] + (a[hi] - a[lo]) * (idx - lo);
}

export function seededRandom(seed = 123456789) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

export function bootstrapMeanCI(xs, reps = 600, alpha = 0.05, seed = 20260925) {
  if (!xs.length) return [null, null];
  if (xs.length === 1) return [xs[0], xs[0]];
  const rnd = seededRandom(seed);
  const means = new Array(reps);
  for (let r = 0; r < reps; r++) {
    let s = 0;
    for (let i = 0; i < xs.length; i++) s += xs[Math.floor(rnd() * xs.length)];
    means[r] = s / xs.length;
  }
  return [percentile(means, alpha / 2), percentile(means, 1 - alpha / 2)];
}

export function maxDrawdown(profits) {
  let equity = 0, peak = 0, worst = 0;
  for (const p of profits) {
    equity += p;
    peak = Math.max(peak, equity);
    worst = Math.min(worst, equity - peak);
  }
  return worst;
}

export function longestLosingStreak(wins) {
  let cur = 0, best = 0;
  for (const w of wins) {
    if (w) cur = 0;
    else { cur += 1; best = Math.max(best, cur); }
  }
  return best;
}

export function eceBinary(observations, bins = 10) {
  if (!observations.length) return null;
  let total = 0;
  for (let b = 0; b < bins; b++) {
    const lo = b / bins, hi = (b + 1) / bins;
    const bucket = observations.filter((o) => o.p >= lo && (b === bins - 1 ? o.p <= hi : o.p < hi));
    if (!bucket.length) continue;
    const conf = mean(bucket.map((o) => o.p));
    const acc = mean(bucket.map((o) => o.y));
    total += (bucket.length / observations.length) * Math.abs(conf - acc);
  }
  return total;
}

export function marketMAD(ps) {
  if (!ps.length) return null;
  const med = percentile(ps, 0.5);
  return percentile(ps.map((p) => Math.abs(p - med)), 0.5);
}
