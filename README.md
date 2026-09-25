# BetLab Research Engine

BetLab is a research-oriented sports-betting strategy laboratory. It is designed to test hypotheses, compare models, record real-time odds snapshots, and promote strategies through a strict lifecycle: LAB → SHADOW → CANARY → PRODUCTION.

## What is included

- Strategy registry with benchmark, LAB and SHADOW states
- Multiplicative and Power de-vig utilities
- Market/model probability shrinkage
- Raw and robust EV calculations
- Football-Data-compatible CSV backtests
- Brier score, Log Loss and calibration/ECE
- ROI, drawdown and losing-streak analysis
- Longshot dependency and profit-concentration checks
- Immutable shadow-prediction ledger
- Odds snapshot ingestion API
- PostgreSQL/Supabase schema
- France/ANJ regulatory gate designed as default-deny
- Full research specification in `docs/RESEARCH_SPEC.md`

## Philosophy

A historical ROI is never treated as proof of a durable edge. Strategies must survive time-aware out-of-sample testing, calibration checks, robustness tests, and live shadow validation before production use.

The project deliberately separates:

- **research hypotheses** from validated strategies;
- **model probability** from market probability;
- **raw EV** from uncertainty-adjusted robust EV;
- **historical backtests** from true timestamped market-microstructure tests.

## Quick start

```bash
npm install
npm test
npm start
```

Open `http://localhost:3000`.

## Sample backtest

Use the bundled sample file:

```bash
curl -X POST http://localhost:3000/api/backtest/football-data \
  -H 'content-type: application/json' \
  -d '{"csvPath":"data/sample-football-data.csv"}'
```

## Persistence

The default runtime can operate locally for research. For durable storage, apply:

```text
supabase/schema.sql
```

to a PostgreSQL/Supabase project, then connect the ingestion layer to that database.

## Important limitations

- Intraday bookmaker-lag, steam and live strategies require real timestamped odds snapshots. Opening/closing-only datasets are not enough.
- The regulatory filter is default-deny until an up-to-date allowed competition/phase/market dataset is loaded.
- No strategy is presented as profitable merely because it performed well historically.

See `docs/RESEARCH_SPEC.md` for the full methodology and `docs/API.md` for endpoints.
