import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, get, run } from './lib/db.mjs';
import { backtestFootballFLB } from './lib/backtest.mjs';
import { robustEV } from './lib/math.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 8787);
const ingestToken = process.env.INGEST_TOKEN || '';

function json(res, status, body) {
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(body));
}
function text(res, status, body, type='text/plain; charset=utf-8') {
  res.writeHead(status, {'content-type':type}); res.end(body);
}
async function readBody(req, max = 20 * 1024 * 1024) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > max) throw new Error('Payload trop volumineux'); chunks.push(c); }
  return Buffer.concat(chunks).toString('utf8');
}
function authorized(req) {
  if (!ingestToken) return true;
  return req.headers.authorization === `Bearer ${ingestToken}`;
}
function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//,'');
  const full = path.normalize(path.join(PUBLIC, rel));
  if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) return false;
  const ext = path.extname(full);
  const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
  text(res, 200, fs.readFileSync(full), types[ext] || 'application/octet-stream'); return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const p = url.pathname;
    if (p === '/api/health' && req.method === 'GET') return json(res,200,{ok:true,service:'BetLab',time:new Date().toISOString()});
    if (p === '/api/dashboard' && req.method === 'GET') {
      const strategies = get('SELECT COUNT(*) AS n FROM strategies').n;
      const intraday = get('SELECT COUNT(*) AS n FROM strategies WHERE requires_intraday=1').n;
      const snapshots = get('SELECT COUNT(*) AS n FROM odds_snapshots').n;
      const signals = get('SELECT COUNT(*) AS n FROM signals').n;
      const shadow = get("SELECT COUNT(*) AS n FROM signals WHERE decision='SHADOW_BET'").n;
      return json(res,200,{strategies,intraday,snapshots,signals,shadow,regulatoryMode:'DEFAULT_DENY_UNTIL_RULES_LOADED'});
    }
    if (p === '/api/strategies' && req.method === 'GET') {
      return json(res,200,{items:all('SELECT * FROM strategies ORDER BY priority, family, name')});
    }
    if (p === '/api/snapshots' && req.method === 'GET') {
      const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 100)));
      return json(res,200,{items:all('SELECT * FROM odds_snapshots ORDER BY observed_at DESC, id DESC LIMIT ?',limit)});
    }
    if (p === '/api/snapshots' && req.method === 'POST') {
      if (!authorized(req)) return json(res,401,{error:'Unauthorized'});
      const body = JSON.parse(await readBody(req));
      const items = Array.isArray(body) ? body : [body]; let inserted = 0;
      for (const x of items) {
        if (!x.event_id || !x.sport || !x.bookmaker || !x.market || !x.selection || !(Number(x.odds)>1) || !x.observed_at) continue;
        const r = run(`INSERT OR IGNORE INTO odds_snapshots(event_id,sport,competition,bookmaker,market,selection,line,odds,observed_at,source)
          VALUES (?,?,?,?,?,?,?,?,?,?)`,x.event_id,x.sport,x.competition||null,x.bookmaker,x.market,x.selection,x.line??null,Number(x.odds),x.observed_at,x.source||null);
        inserted += Number(r.changes || 0);
      }
      return json(res,201,{inserted});
    }
    if (p === '/api/signals' && req.method === 'GET') {
      const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 100)));
      return json(res,200,{items:all(`SELECT s.*, st.name AS strategy_name FROM signals s LEFT JOIN strategies st ON st.id=s.strategy_id ORDER BY s.created_at DESC, s.id DESC LIMIT ?`,limit)});
    }
    if (p === '/api/signals' && req.method === 'POST') {
      if (!authorized(req)) return json(res,401,{error:'Unauthorized'});
      const x = JSON.parse(await readBody(req));
      if (!x.event_id || !x.strategy_id || !x.market || !x.selection || !(Number(x.odds)>1) || !x.decision) return json(res,400,{error:'Champs requis manquants'});
      let calc = {};
      if ([x.p_model,x.p_market,x.odds].every((v)=>Number.isFinite(Number(v)))) calc = robustEV({modelP:Number(x.p_model),marketP:Number(x.p_market),odds:Number(x.odds),reliability:Number(x.reliability ?? .25),uncertainty:Number(x.uncertainty ?? .03)});
      const created = x.created_at || new Date().toISOString();
      const r = run(`INSERT INTO signals(event_id,strategy_id,market,selection,bookmaker,odds,p_market,p_model,p_shrunk,ev_raw,ev_robust,decision,revision_of,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,x.event_id,x.strategy_id,x.market,x.selection,x.bookmaker||null,Number(x.odds),x.p_market??null,x.p_model??null,calc.pShrunk??x.p_shrunk??null,calc.evRaw??x.ev_raw??null,calc.evRobust??x.ev_robust??null,x.decision,x.revision_of??null,created);
      return json(res,201,{id:Number(r.lastInsertRowid),created_at:created,...calc});
    }
    if (p === '/api/backtests/football-flb' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      const result = backtestFootballFLB(String(body.csv||''),{devig:body.devig||'multiplicative',stake:Number(body.stake||10)});
      return json(res,200,result);
    }
    if (p === '/api/regulatory/status' && req.method === 'GET') {
      const last = get('SELECT MAX(version_date) AS version_date, COUNT(*) AS n FROM regulatory_rules');
      return json(res,200,{jurisdiction:'FR',loaded:Number(last?.n||0)>0,versionDate:last?.version_date||null,policy:'DEFAULT_DENY_WITHOUT_CURRENT_RULE'});
    }
    if (p.startsWith('/api/')) return json(res,404,{error:'Not found'});
    if (serveStatic(req,res,p)) return;
    return text(res,404,'Not found');
  } catch (err) {
    console.error(err);
    return json(res,500,{error:err.message || 'Internal error'});
  }
});
server.listen(PORT,()=>console.log(`BetLab running on http://localhost:${PORT}`));
