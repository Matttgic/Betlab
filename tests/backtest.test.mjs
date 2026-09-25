import test from 'node:test';import assert from 'node:assert/strict';import {backtestFootballFLB} from '../lib/backtest.mjs';
const csv=`Date,HomeTeam,AwayTeam,FTR,AvgH,AvgD,AvgA,AvgCH,AvgCD,AvgCA
01/01/25,A,B,H,1.90,3.50,4.20,1.80,3.60,4.60
02/01/25,C,D,A,2.10,3.30,3.50,2.20,3.20,3.40
03/01/25,E,F,D,1.45,4.50,7.50,1.50,4.30,7.00
`;
test('football backtest parses and returns buckets',()=>{const r=backtestFootballFLB(csv);assert.equal(r.meta.matches,3);assert.equal(r.meta.observations,9);assert.ok(r.executable.favoriteClose);assert.equal(r.buckets.length,10)});
