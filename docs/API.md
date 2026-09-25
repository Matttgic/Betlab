# API

## Health
`GET /api/health`

Retourne notamment le store actif : `SQLITE_LOCAL` ou `SUPABASE`.

## Dashboard
`GET /api/dashboard`

## Strategies
`GET /api/strategies`

## Odds snapshots
`GET /api/snapshots?limit=100`

`POST /api/snapshots`

```json
{
  "event_id":"match-123",
  "sport":"football",
  "competition":"Ligue 1",
  "bookmaker":"Book FR",
  "market":"1X2",
  "selection":"HOME",
  "odds":2.05,
  "observed_at":"2026-09-25T16:30:00Z",
  "source":"provider-name"
}
```

Si `INGEST_TOKEN` est configuré, inclure `Authorization: Bearer <token>`.

## Shadow signals
`GET /api/signals?limit=100`

`POST /api/signals`

```json
{
  "event_id":"match-123",
  "strategy_id":"bookmaker_lag",
  "market":"1X2",
  "selection":"HOME",
  "bookmaker":"Book FR",
  "odds":2.05,
  "p_market":0.52,
  "p_model":0.57,
  "reliability":0.25,
  "uncertainty":0.03,
  "decision":"SHADOW_BET"
}
```

## Football-Data FLB backtest
`POST /api/backtests/football-flb`

Body: `{ "csv": "...", "devig": "multiplicative|power", "stake": 10 }`.

## Supabase production adapter

BetLab n'expose pas directement les tables Supabase au rôle `anon`. Le serveur Vercel appelle une petite surface RPC protégée par `INGEST_TOKEN` avec la clé publishable du projet.
