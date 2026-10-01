# BetLab research core and multisport layer

## Research core

`lib/research.mjs` adds reusable research utilities without changing the existing SHADOW/production promotion logic:

- strict chronological train / calibration / test splitting;
- isotonic probability calibration;
- pregame Elo features;
- pregame rest/fatigue and 7-day congestion features;
- fractional Kelly sizing with a configurable cap.

### Leakage rule

Elo ratings are emitted before the current match result updates team ratings. Fatigue features only inspect prior match dates. Calibration must be fitted on the calibration partition rather than the final test partition.

### Research endpoints

- `GET /api/research/capabilities`
- `POST /api/research/temporal-split`
- `POST /api/research/pregame-features`
- `POST /api/research/calibrate`
- `POST /api/research/kelly`

These endpoints are research utilities. They do not promote signals to production.

## SportsDataverse layer

The sync adapter writes sport-specific JSON snapshots plus `data/sportsdataverse/manifest.json`. Each sport is isolated: a failure in one source does not mark successful sports as failed.

Supported adapters:

- NHL schedule + player boxscores;
- NBA schedule + player boxscores;
- WNBA schedule + player boxscores;
- NFL schedule;
- MLB regular-season schedule via the current MLB Stats API wrapper and SportsDataverse parser.

### API

- `GET /api/sportsdataverse/status`
- `GET /api/sportsdataverse/:sport/:dataset`

Only manifest-declared snapshot files can be read by the API.

## Refresh

GitHub Actions workflow: `.github/workflows/sportsdataverse-sync.yml`.

Default schedule: daily at 05:43 UTC.

Local example:

```bash
pip install -r scripts/requirements-sportsdataverse.txt
python scripts/sportsdataverse_sync.py --season 2026 --sports nhl,nba,wnba,nfl,mlb
```

## Promotion policy

Multisport data availability is not evidence of betting profitability. New strategies still belong in LAB/SHADOW until temporal validation, calibration, uncertainty checks and market-price backtests satisfy the existing promotion criteria.
