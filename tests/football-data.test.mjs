import test from 'node:test';
import assert from 'node:assert/strict';
import { backtestFootballFLBMany } from '../lib/backtest.mjs';
import {
  downloadFootballDataSet,
  footballDataUrl,
  recentSeasonKeys,
  seasonKeyForDate
} from '../lib/footballData.mjs';

const CSV = `Date,HomeTeam,AwayTeam,FTR,AvgCH,AvgCD,AvgCA,AvgH,AvgD,AvgA\n01/09/2026,Alpha,Beta,H,1.80,3.50,4.50,1.90,3.40,4.20\n08/09/2026,Gamma,Delta,A,2.10,3.30,3.40,2.20,3.20,3.20\n`;

test('Football-Data season helpers use European season boundaries', () => {
  const date = new Date('2026-10-02T00:00:00Z');
  assert.equal(seasonKeyForDate(date), '2627');
  assert.deepEqual(recentSeasonKeys(3, date), ['2627', '2526', '2425']);
  assert.equal(footballDataUrl('2627', 'E0'), 'https://www.football-data.co.uk/mmz4281/2627/E0.csv');
});

test('Football-Data downloader tolerates multiple leagues and seasons', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => CSV });
  const data = await downloadFootballDataSet({ seasons: ['2627', '2526'], leagues: ['E0', 'F1'], fetchImpl });
  assert.equal(data.items.length, 4);
  assert.equal(data.errors.length, 0);
  assert.equal(data.items[0].csv, CSV);
});

test('aggregate FLB backtest merges multiple CSV sources', () => {
  const result = backtestFootballFLBMany([CSV, CSV], { stake: 10 });
  assert.equal(result.meta.sourceCount, 2);
  assert.equal(result.meta.matches, 4);
  assert.equal(result.meta.observations, 12);
  assert.equal(result.executable.favoriteClose.n, 4);
});
