import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyIsotonicCalibrator,
  attachPregameFeatures,
  fitIsotonicCalibrator,
  fractionalKelly,
  temporalSplit
} from '../lib/research.mjs';

test('temporal split never mixes later rows into training', () => {
  const rows = [
    { id: 3, date: '03/01/2023' },
    { id: 1, date: '01/01/2020' },
    { id: 4, date: '01/01/2025' },
    { id: 2, date: '30/06/2021' }
  ];
  const out = temporalSplit(rows,{trainEnd:'2020-12-31',calibrationEnd:'2022-12-31'});
  assert.deepEqual(out.train.map(x=>x.id),[1]);
  assert.deepEqual(out.calibration.map(x=>x.id),[2]);
  assert.deepEqual(out.test.map(x=>x.id),[3,4]);
});

test('isotonic calibration is monotone', () => {
  const calibrator = fitIsotonicCalibrator([
    {p:0.1,y:0},{p:0.2,y:1},{p:0.3,y:0},{p:0.8,y:1},{p:0.9,y:1}
  ]);
  const values = [0.1,0.2,0.3,0.8,0.9].map(p=>applyIsotonicCalibrator(calibrator,p));
  for (let i=1;i<values.length;i++) assert.ok(values[i] >= values[i-1]);
});

test('Elo and fatigue features are pregame only', () => {
  const matches = [
    {date:'2026-01-01',home:'A',away:'B',result:'H'},
    {date:'2026-01-04',home:'A',away:'C',result:'A'},
    {date:'2026-01-08',home:'A',away:'B',result:'H'}
  ];
  const out = attachPregameFeatures(matches);
  assert.equal(out[0].homeElo,1500);
  assert.equal(out[0].awayElo,1500);
  assert.equal(out[0].homeDaysSinceLast,null);
  assert.equal(out[1].homeDaysSinceLast,3);
  assert.equal(out[2].homeDaysSinceLast,4);
  assert.equal(out[2].awayDaysSinceLast,7);
  assert.ok(out[1].homeElo > 1500,'second match sees first result');
});

test('quarter Kelly is capped', () => {
  assert.equal(fractionalKelly(0.5,2),0);
  const stake = fractionalKelly(0.75,2,{fraction:0.25,cap:0.1});
  assert.ok(stake > 0 && stake <= 0.1);
});
