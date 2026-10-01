import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.js';

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; return this; },
    json(value) { this.body = value; return this; }
  };
}

async function call(path, { method = 'GET', body, query = {} } = {}) {
  const req = { method, body, query: { path, ...query } };
  const res = response();
  await handler(req, res);
  return res;
}

test('Vercel serverless exposes Research Core capabilities', async () => {
  const res = await call('research/capabilities');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.temporalSplit, true);
  assert.equal(res.body.isotonicCalibration, true);
  assert.equal(res.body.productionSignalsChanged, false);
});

test('Vercel serverless executes fractional Kelly', async () => {
  const res = await call('research/kelly', {
    method: 'POST',
    body: { p: 0.6, odds: 2.0, fraction: 0.25, cap: 0.1 }
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.fraction > 0);
  assert.ok(res.body.fraction <= 0.1);
});

test('Vercel serverless exposes SportsDataverse status', async () => {
  const res = await call('sportsdataverse/status');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.available, true);
  assert.equal(res.body.healthy, true);
  assert.ok(res.body.healthySports.includes('nhl'));
  assert.ok(res.body.healthySports.includes('mlb'));
});

test('unknown Vercel API route returns 404', async () => {
  const res = await call('does/not/exist');
  assert.equal(res.statusCode, 404);
});
