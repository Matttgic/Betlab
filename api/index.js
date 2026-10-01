import { backtestFootballFLB } from '../lib/backtest.mjs';
import {
  applyIsotonicCalibrator,
  attachPregameFeatures,
  fitIsotonicCalibrator,
  fractionalKelly,
  temporalSplit
} from '../lib/research.mjs';
import {
  readSportsDataset,
  readSportsDataverseManifest,
  summarizeSportsDataverse
} from '../lib/sportsdataverse.mjs';

const U = (process.env.SUPABASE_URL || 'https://zbmgskmvrqrzjdreggxg.supabase.co').replace(/\/$/, '');
const K = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_5_cFyydmpxFryLIy0J2p8A_KsSaVUjP';

async function rpc(name, args = {}) {
  const r = await fetch(`${U}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: K, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(args)
  });
  const raw = await r.text();
  let body;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  if (!r.ok) throw new Error(body?.message || body?.hint || String(body || r.statusText));
  return body;
}

function out(res, status, body) {
  res.status(status);
  res.setHeader('cache-control', 'no-store');
  return res.json(body);
}

function lim(req, d = 50, max = 500) {
  const n = Number(req.query?.limit || d);
  return Math.min(max, Math.max(1, Number.isFinite(n) ? n : d));
}

function routePath(req) {
  const raw = req.query?.path;
  return Array.isArray(raw) ? raw.join('/') : String(raw || '');
}

function bodyOf(req) {
  if (req.body == null || req.body === '') return {};
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return req.body;
}

export default async function handler(req, res) {
  try {
    const p = routePath(req);
    const method = String(req.method || 'GET').toUpperCase();

    if (p === 'health' && method === 'GET') {
      return out(res, 200, {
        ok: true,
        service: 'BetLab',
        store: 'SUPABASE',
        mode: 'PUBLIC_READ_PRIVATE_WRITE',
        researchCore: true,
        sportsDataverse: true,
        time: new Date().toISOString()
      });
    }

    if (p === 'dashboard' && method === 'GET') return out(res, 200, await rpc('betlab_public_dashboard'));
    if (p === 'strategies' && method === 'GET') return out(res, 200, { items: await rpc('betlab_public_strategies') || [] });
    if (p === 'regulatory/status' && method === 'GET') return out(res, 200, await rpc('betlab_public_regulatory_status'));
    if (p === 'feed/status' && method === 'GET') return out(res, 200, await rpc('betlab_public_feed_status'));
    if (p === 'snapshots' && method === 'GET') return out(res, 200, { items: await rpc('betlab_public_snapshots', { p_limit: lim(req, 100) }) || [] });
    if (p === 'events/current' && method === 'GET') return out(res, 200, { items: await rpc('betlab_public_current_events', { p_limit: lim(req, 60, 200) }) || [] });
    if (p === 'backtests' && method === 'GET') return out(res, 200, { items: await rpc('betlab_public_backtests', { p_limit: lim(req, 50, 200) }) || [] });
    if (p === 'signals' && method === 'GET') return out(res, 200, { items: await rpc('betlab_public_signals', { p_limit: lim(req, 50, 200) }) || [] });

    if (p === 'backtests/football-flb' && method === 'POST') {
      const body = bodyOf(req);
      const result = backtestFootballFLB(String(body.csv || ''), {
        devig: body.devig || 'multiplicative',
        stake: Number(body.stake || 10)
      });
      return out(res, 200, result);
    }

    if (p === 'research/capabilities' && method === 'GET') {
      return out(res, 200, {
        temporalSplit: true,
        isotonicCalibration: true,
        eloPregame: true,
        fatiguePregame: true,
        fractionalKelly: true,
        productionSignalsChanged: false,
        note: 'Research utilities are isolated from the SHADOW/production promotion path.'
      });
    }

    if (p === 'research/temporal-split' && method === 'POST') {
      const body = bodyOf(req);
      const rows = Array.isArray(body.rows) ? body.rows : [];
      return out(res, 200, temporalSplit(rows, {
        trainEnd: body.trainEnd,
        calibrationEnd: body.calibrationEnd,
        dateField: body.dateField || 'date'
      }));
    }

    if (p === 'research/pregame-features' && method === 'POST') {
      const body = bodyOf(req);
      const matches = Array.isArray(body.matches) ? body.matches : [];
      return out(res, 200, { items: attachPregameFeatures(matches, body.options || {}) });
    }

    if (p === 'research/calibrate' && method === 'POST') {
      const body = bodyOf(req);
      const observations = Array.isArray(body.observations) ? body.observations : [];
      const calibrator = fitIsotonicCalibrator(observations);
      const probabilities = Array.isArray(body.probabilities) ? body.probabilities : [];
      return out(res, 200, {
        calibrator,
        calibrated: probabilities.map((value) => applyIsotonicCalibrator(calibrator, value))
      });
    }

    if (p === 'research/kelly' && method === 'POST') {
      const body = bodyOf(req);
      return out(res, 200, {
        fraction: fractionalKelly(body.p, body.odds, {
          fraction: body.fraction ?? 0.25,
          cap: body.cap ?? 0.10
        })
      });
    }

    if (p === 'sportsdataverse/status' && method === 'GET') {
      return out(res, 200, summarizeSportsDataverse(await readSportsDataverseManifest()));
    }

    const sdvMatch = p.match(/^sportsdataverse\/([a-z0-9_-]+)\/([a-zA-Z0-9_-]+)$/);
    if (sdvMatch && method === 'GET') {
      const result = await readSportsDataset(sdvMatch[1], sdvMatch[2], lim(req, 500, 5000));
      return out(res, 200, result);
    }

    return out(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error(e);
    return out(res, e?.statusCode || 500, { error: e?.message || 'Internal error' });
  }
}
