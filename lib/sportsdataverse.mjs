import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.env.BETLAB_SPORTSDATAVERSE_DIR || path.resolve(process.cwd(), 'data/sportsdataverse');
const MAX_ROWS = 5000;

export const SUPPORTED_SPORTS = Object.freeze(['nhl', 'nba', 'wnba', 'nfl', 'mlb']);

export async function readSportsDataverseManifest() {
  try {
    const raw = await fs.readFile(path.join(ROOT, 'manifest.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function summarizeSportsDataverse(manifest) {
  if (!manifest) return { available: false, healthy: false, supportedSports: SUPPORTED_SPORTS };
  return {
    available: true,
    healthy: Boolean(manifest.healthy),
    generatedAt: manifest.generatedAt,
    season: manifest.season,
    healthySports: manifest.healthySports || [],
    supportedSports: SUPPORTED_SPORTS,
    sports: Object.fromEntries(Object.entries(manifest.sports || {}).map(([sport, meta]) => [sport, {
      healthy: Boolean(meta?.healthy),
      datasets: Object.fromEntries(Object.entries(meta?.datasets || {}).map(([name, info]) => [name, { rows: Number(info?.rows || 0) }]))
    }])),
    errors: manifest.errors || []
  };
}

export async function readSportsDataset(sport, dataset, limit = 500) {
  const normalizedSport = String(sport || '').toLowerCase();
  if (!SUPPORTED_SPORTS.includes(normalizedSport)) throw Object.assign(new Error('Unsupported sport'), { statusCode: 400 });
  const manifest = await readSportsDataverseManifest();
  if (!manifest) throw Object.assign(new Error('SportsDataverse snapshots unavailable'), { statusCode: 503 });
  const info = manifest.sports?.[normalizedSport]?.datasets?.[dataset];
  if (!info?.file) throw Object.assign(new Error('Unknown dataset'), { statusCode: 404 });
  const safeName = path.basename(String(info.file));
  if (safeName !== info.file) throw new Error('Unsafe dataset path in manifest');
  const raw = await fs.readFile(path.join(ROOT, safeName), 'utf8');
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) throw new Error('Invalid SportsDataverse snapshot');
  const cap = Math.max(1, Math.min(MAX_ROWS, Number(limit) || 500));
  return { sport: normalizedSport, dataset, total: rows.length, rows: rows.slice(0, cap) };
}
