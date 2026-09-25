import { run } from '../lib/db.mjs';
const now=Date.now();
const rows=[
 ['demo-psg-lyon','football','Ligue 1','Book A','1X2','PSG',null,1.92,new Date(now-180000).toISOString(),'demo'],
 ['demo-psg-lyon','football','Ligue 1','Book B','1X2','PSG',null,1.90,new Date(now-120000).toISOString(),'demo'],
 ['demo-psg-lyon','football','Ligue 1','Book FR','1X2','PSG',null,2.05,new Date(now-60000).toISOString(),'demo']
];
for(const x of rows) run(`INSERT OR IGNORE INTO odds_snapshots(event_id,sport,competition,bookmaker,market,selection,line,odds,observed_at,source) VALUES (?,?,?,?,?,?,?,?,?,?)`,...x);
console.log('Demo snapshots inserted.');
