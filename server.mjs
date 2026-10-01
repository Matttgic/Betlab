import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { backtestFootballFLB } from './lib/backtest.mjs';
import {
  applyIsotonicCalibrator,
  attachPregameFeatures,
  fitIsotonicCalibrator,
  fractionalKelly,
  temporalSplit
} from './lib/research.mjs';
import {
  readSportsDataset,
  readSportsDataverseManifest,
  summarizeSportsDataverse
} from './lib/sportsdataverse.mjs';
import {
  dashboardStats,
  insertSignal,
  insertSnapshots,
  listSignals,
  listSnapshots,
  listStrategies,
  regulatoryStatus,
  storeMode
} from './lib/store.mjs';

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

export async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const p = url.pathname;
    if (p === '/api/health' && req.method === 'GET') return json(res,200,{ok:true,service:'BetLab',store:storeMode(),time:new Date().toISOString()});
    if (p === '/api/dashboard' && req.method === 'GET') return json(res,200,await dashboardStats());
    if (p === '/api/strategies' && req.method === 'GET') return json(res,200,{items:await listStrategies()});
    if (p === '/api/snapshots' && req.method === 'GET') {
      const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 100)));
      return json(res,200,{items:await listSnapshots(limit)});
    }
    if (p === '/api/snapshots' && req.method === 'POST') {
      if (!authorized(req)) return json(res,401,{error:'Unauthorized'});
      const body = JSON.parse(await readBody(req));
      const items = (Array.isArray(body) ? body : [body]).filter((x) => x.event_id && x.sport && x.bookmaker && x.market && x.selection && Number(x.odds)>1 && x.observed_at);
      return json(res,201,{inserted:await insertSnapshots(items)});
    }
    if (p === '/api/signals' && req.method === 'GET') {
      const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 100)));
      return json(res,200,{items:await listSignals(limit)});
    }
    if (p === '/api/signals' && req.method === 'POST') {
      if (!authorized(req)) return json(res,401,{error:'Unauthorized'});
      const x = JSON.parse(await readBody(req));
      if (!x.event_id || !x.strategy_id || !x.market || !x.selection || !(Number(x.odds)>1) || !x.decision) return json(res,400,{error:'Champs requis manquants'});
      return json(res,201,await insertSignal(x));
    }
    if (p === '/api/backtests/football-flb' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      const result = backtestFootballFLB(String(body.csv||''),{devig:body.devig||'multiplicative',stake:Number(body.stake||10)});
      return json(res,200,result);
    }
    if (p === '/api/research/capabilities' && req.method === 'GET') {
      return json(res,200,{
        temporalSplit:true,
        isotonicCalibration:true,
        eloPregame:true,
        fatiguePregame:true,
        fractionalKelly:true,
        productionSignalsChanged:false,
        note:'Research utilities are isolated from the SHADOW/production promotion path.'
      });
    }
    if (p === '/api/research/temporal-split' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const result = temporalSplit(rows,{trainEnd:body.trainEnd,calibrationEnd:body.calibrationEnd,dateField:body.dateField||'date'});
      return json(res,200,result);
    }
    if (p === '/api/research/pregame-features' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      const matches = Array.isArray(body.matches) ? body.matches : [];
      return json(res,200,{items:attachPregameFeatures(matches,body.options||{})});
    }
    if (p === '/api/research/calibrate' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      const observations = Array.isArray(body.observations) ? body.observations : [];
      const calibrator = fitIsotonicCalibrator(observations);
      const probabilities = Array.isArray(body.probabilities) ? body.probabilities : [];
      return json(res,200,{calibrator,calibrated:probabilities.map((value)=>applyIsotonicCalibrator(calibrator,value))});
    }
    if (p === '/api/research/kelly' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      return json(res,200,{fraction:fractionalKelly(body.p,body.odds,{fraction:body.fraction??0.25,cap:body.cap??0.10})});
    }
    if (p === '/api/sportsdataverse/status' && req.method === 'GET') {
      return json(res,200,summarizeSportsDataverse(await readSportsDataverseManifest()));
    }
    const sdvMatch = p.match(/^\/api\/sportsdataverse\/([a-z0-9_-]+)\/([a-zA-Z0-9_-]+)$/);
    if (sdvMatch && req.method === 'GET') {
      const limit = Math.min(5000,Math.max(1,Number(url.searchParams.get('limit')||500)));
      const result = await readSportsDataset(sdvMatch[1],sdvMatch[2],limit);
      return json(res,200,result);
    }
    if (p === '/api/regulatory/status' && req.method === 'GET') return json(res,200,await regulatoryStatus());
    if (p.startsWith('/api/')) return json(res,404,{error:'Not found'});
    if (serveStatic(req,res,p)) return;
    return text(res,404,'Not found');
  } catch (err) {
    console.error(err);
    return json(res,err.statusCode||500,{error:err.message || 'Internal error'});
  }
}

const server = http.createServer(handleRequest);
server.listen(PORT,()=>console.log(`BetLab running on http://localhost:${PORT} (${storeMode()})`));
