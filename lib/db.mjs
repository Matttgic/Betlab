import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { STRATEGIES } from './strategies.mjs';

const dbPath = path.resolve(process.env.DATABASE_PATH || './data/betlab.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  family TEXT NOT NULL,
  stage TEXT NOT NULL,
  priority TEXT NOT NULL,
  requires_intraday INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS odds_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  competition TEXT,
  bookmaker TEXT NOT NULL,
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  line REAL,
  odds REAL NOT NULL CHECK(odds > 1),
  observed_at TEXT NOT NULL,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, bookmaker, market, selection, line, observed_at)
);
CREATE INDEX IF NOT EXISTS idx_snap_event_time ON odds_snapshots(event_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_snap_market ON odds_snapshots(sport, market, observed_at);
CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  bookmaker TEXT,
  odds REAL NOT NULL,
  p_market REAL,
  p_model REAL,
  p_shrunk REAL,
  ev_raw REAL,
  ev_robust REAL,
  decision TEXT NOT NULL CHECK(decision IN ('NO_BET','SHADOW_BET','CANARY','PRODUCTION')),
  revision_of INTEGER,
  created_at TEXT NOT NULL,
  result TEXT,
  profit REAL,
  closing_odds REAL,
  FOREIGN KEY(strategy_id) REFERENCES strategies(id),
  FOREIGN KEY(revision_of) REFERENCES signals(id)
);
CREATE INDEX IF NOT EXISTS idx_signal_created ON signals(created_at DESC);
CREATE TABLE IF NOT EXISTS research_trials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  parameters_json TEXT NOT NULL,
  train_period TEXT,
  validation_period TEXT,
  test_period TEXT,
  roi REAL,
  sharpe REAL,
  brier REAL,
  clv REAL,
  selected INTEGER NOT NULL DEFAULT 0,
  rejected_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(strategy_id) REFERENCES strategies(id)
);
CREATE TABLE IF NOT EXISTS regulatory_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jurisdiction TEXT NOT NULL,
  version_date TEXT NOT NULL,
  sport TEXT,
  competition TEXT,
  phase TEXT,
  market TEXT,
  allowed INTEGER NOT NULL,
  source_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const insertStrategy = db.prepare(`INSERT OR IGNORE INTO strategies
(id,name,family,stage,priority,requires_intraday,description) VALUES (?,?,?,?,?,?,?)`);
for (const s of STRATEGIES) insertStrategy.run(s.id,s.name,s.family,s.stage,s.priority,s.requiresIntraday?1:0,s.description);

export function all(sql, ...params) { return db.prepare(sql).all(...params); }
export function get(sql, ...params) { return db.prepare(sql).get(...params); }
export function run(sql, ...params) { return db.prepare(sql).run(...params); }
