import test from 'node:test';import assert from 'node:assert/strict';
import {devigMultiplicative,devigPower,robustEV,maxDrawdown,longestLosingStreak} from '../lib/math.mjs';
test('multiplicative devig sums to 1',()=>{const p=devigMultiplicative([2,3.5,4]);assert.ok(Math.abs(p.reduce((a,b)=>a+b,0)-1)<1e-12)});
test('power devig sums to 1',()=>{const p=devigPower([2,3.5,4]);assert.ok(Math.abs(p.reduce((a,b)=>a+b,0)-1)<1e-8)});
test('robust EV shrinks toward market',()=>{const r=robustEV({modelP:.60,marketP:.52,odds:2,reliability:.25,uncertainty:.02});assert.ok(r.pShrunk<.60&&r.pShrunk>.52);assert.ok(r.evRobust<r.evRaw)});
test('drawdown and losing streak',()=>{assert.equal(maxDrawdown([10,-5,-7,3]),-12);assert.equal(longestLosingStreak([true,false,false,true,false]),2)});
