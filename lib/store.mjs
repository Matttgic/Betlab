import { robustEV } from './math.mjs';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';
const INGEST_TOKEN = process.env.INGEST_TOKEN || '';
const REMOTE = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && INGEST_TOKEN);

let localDb = null;
async function local() {
  if (!localDb) localDb = await import('./db.mjs');
  return localDb;
}

async function rpc(name, args = {}) {
  if (!REMOTE) throw new Error('Supabase remote store is not configured');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify(args)
  });
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  if (!response.ok) {
    const message = body?.message || body?.hint || body?.details || String(body || response.statusText);
    throw new Error(`Supabase RPC ${name}: ${message}`);
  }
  return body;
}

export function storeMode() { return REMOTE ? 'SUPABASE' : 'SQLITE_LOCAL'; }

export async function dashboardStats() {
  if (REMOTE) return rpc('betlab_dashboard', { p_token: INGEST_TOKEN });
  const { get } = await local();
  const strategies = get('SELECT COUNT(*) AS n FROM strategies').n;
  const intraday = get('SELECT COUNT(*) AS n FROM strategies WHERE requires_intraday=1').n;
  const snapshots = get('SELECT COUNT(*) AS n FROM odds_snapshots').n;
  const signals = get('SELECT COUNT(*) AS n FROM signals').n;
  const shadow = get("SELECT COUNT(*) AS n FROM signals WHERE decision='SHADOW_BET'").n;
  return { strategies, intraday, snapshots, signals, shadow, regulatoryMode: 'DEFAULT_DENY_UNTIL_RULES_LOADED' };
}

export async function listStrategies() {
  if (REMOTE) return (await rpc('betlab_strategies', { p_token: INGEST_TOKEN })) || [];
  const { all } = await local();
  return all('SELECT * FROM strategies ORDER BY priority, family, name');
}

export async function listSnapshots(limit = 100) {
  if (REMOTE) return (await rpc('betlab_snapshots', { p_token: INGEST_TOKEN, p_limit: limit })) || [];
  const { all } = await local();
  return all('SELECT * FROM odds_snapshots ORDER BY observed_at DESC, id DESC LIMIT ?', limit);
}

export async function insertSnapshots(items) {
  if (REMOTE) {
    return Number(await rpc('betlab_insert_snapshots', { p_token: INGEST_TOKEN, p_items: items }) || 0);
  }
  const { run } = await local();
  let inserted = 0;
  for (const x of items) {
    const r = run(`INSERT OR IGNORE INTO odds_snapshots(event_id,sport,competition,bookmaker,market,selection,line,odds,observed_at,source)
      VALUES (?,?,?,?,?,?,?,?,?,?)`, x.event_id, x.sport, x.competition || null, x.bookmaker, x.market, x.selection,
      x.line ?? null, Number(x.odds), x.observed_at, x.source || null);
    inserted += Number(r.changes || 0);
  }
  return inserted;
}

export async function listSignals(limit = 100) {
  if (REMOTE) return (await rpc('betlab_signals', { p_token: INGEST_TOKEN, p_limit: limit })) || [];
  const { all } = await local();
  return all(`SELECT s.*, st.name AS strategy_name FROM signals s LEFT JOIN strategies st ON st.id=s.strategy_id ORDER BY s.created_at DESC, s.id DESC LIMIT ?`, limit);
}

export async function insertSignal(x) {
  let calc = {};
  if ([x.p_model, x.p_market, x.odds].every((v) => Number.isFinite(Number(v)))) {
    calc = robustEV({
      modelP: Number(x.p_model),
      marketP: Number(x.p_market),
      odds: Number(x.odds),
      reliability: Number(x.reliability ?? .25),
      uncertainty: Number(x.uncertainty ?? .03)
    });
  }
  const created = x.created_at || new Date().toISOString();

  if (REMOTE) {
    const id = await rpc('betlab_insert_signal', {
      p_token: INGEST_TOKEN,
      p_event_id: x.event_id,
      p_strategy_id: x.strategy_id,
      p_market: x.market,
      p_selection: x.selection,
      p_bookmaker: x.bookmaker || null,
      p_odds: Number(x.odds),
      p_market_probability: x.p_market ?? null,
      p_model_probability: x.p_model ?? null,
      p_shrunk_probability: calc.pShrunk ?? x.p_shrunk ?? null,
      p_ev_raw: calc.evRaw ?? x.ev_raw ?? null,
      p_ev_robust: calc.evRobust ?? x.ev_robust ?? null,
      p_decision: x.decision,
      p_revision_of: x.revision_of ?? null,
      p_created_at: created
    });
    return { id: Number(id), created_at: created, ...calc };
  }

  const { run } = await local();
  const r = run(`INSERT INTO signals(event_id,strategy_id,market,selection,bookmaker,odds,p_market,p_model,p_shrunk,ev_raw,ev_robust,decision,revision_of,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, x.event_id, x.strategy_id, x.market, x.selection, x.bookmaker || null, Number(x.odds),
    x.p_market ?? null, x.p_model ?? null, calc.pShrunk ?? x.p_shrunk ?? null, calc.evRaw ?? x.ev_raw ?? null,
    calc.evRobust ?? x.ev_robust ?? null, x.decision, x.revision_of ?? null, created);
  return { id: Number(r.lastInsertRowid), created_at: created, ...calc };
}

export async function regulatoryStatus() {
  if (REMOTE) return rpc('betlab_regulatory_status', { p_token: INGEST_TOKEN });
  const { get } = await local();
  const last = get('SELECT MAX(version_date) AS version_date, COUNT(*) AS n FROM regulatory_rules');
  return {
    jurisdiction: 'FR',
    loaded: Number(last?.n || 0) > 0,
    versionDate: last?.version_date || null,
    policy: 'DEFAULT_DENY_WITHOUT_CURRENT_RULE'
  };
}
