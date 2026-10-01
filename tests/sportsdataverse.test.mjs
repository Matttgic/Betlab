import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeSportsDataverse, SUPPORTED_SPORTS } from '../lib/sportsdataverse.mjs';

test('multisport status is explicit when snapshots are unavailable', () => {
  const status = summarizeSportsDataverse(null);
  assert.equal(status.available,false);
  assert.equal(status.healthy,false);
  assert.deepEqual(status.supportedSports,SUPPORTED_SPORTS);
});

test('multisport status preserves per-sport health and row counts', () => {
  const status = summarizeSportsDataverse({
    healthy:true,
    generatedAt:'2026-10-02T00:00:00Z',
    season:2026,
    healthySports:['nhl'],
    sports:{
      nhl:{healthy:true,datasets:{load_nhl_schedule:{file:'x.json',rows:100}}},
      mlb:{healthy:false,datasets:{}}
    },
    errors:[{sport:'mlb',error:'unavailable'}]
  });
  assert.equal(status.available,true);
  assert.equal(status.sports.nhl.datasets.load_nhl_schedule.rows,100);
  assert.equal(status.sports.mlb.healthy,false);
  assert.equal(status.errors.length,1);
});
