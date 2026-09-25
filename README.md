# BetLab Research Engine

MVP autonome du laboratoire de stratégies construit dans la conversation : **recherche d'edge, pas promesse de gains**.

## Démarrage immédiat

Prérequis : Node.js 24.x en production Vercel. Le développement local reste compatible avec Node 22.5+.

```bash
npm start
```

Sans variables Supabase, BetLab utilise SQLite local. En production, il bascule automatiquement sur Supabase quand `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` et `INGEST_TOKEN` sont définis.

## Tests

```bash
npm test
```

## Ce qui fonctionne déjà

- Dashboard responsive smartphone.
- SQLite local via `node:sqlite`.
- Adaptateur Supabase sécurisé pour la production.
- Registre LAB/SHADOW/PRODUCTION prêt.
- 26 stratégies/filtres prioritaires seedés.
- Odds Snapshot Recorder via API.
- Shadow signal ledger append-only.
- Multiplicative de-vig et Power de-vig.
- Shrinkage vers le marché et Robust EV.
- Upload CSV Football-Data et diagnostic Favorite–Longshot.
- Calibration par tranche de cote, ROI, bootstrap CI 95 %, Brier, Log Loss, ECE, drawdown, losing streak, LDR, PCR10.
- Règles France en **default-deny** tant que la liste réglementaire actuelle n'est pas chargée.

## Production Vercel + Supabase

Appliquer dans l'ordre :

1. `supabase/schema.sql`
2. `supabase/production-hardening.sql`
3. `supabase/seed-strategies.sql`

Puis définir :

```text
INGEST_TOKEN=<secret long>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

La production utilise uniquement la clé **publishable** côté application et des RPC PostgreSQL protégées par `INGEST_TOKEN`. Aucune clé `service_role` / secret Supabase n'est nécessaire dans BetLab.

## Pourquoi les stratégies intraday ne sont pas déjà « backtestées »

Bookmaker Lag, Steam, Information Half-Life et le LIVE nécessitent des cotes horodatées pendant la vie du marché. Opening + closing ne suffisent pas. BetLab enregistre donc ces snapshots à partir du moment où un provider est branché.

## Documentation

- `docs/RESEARCH_SPEC.md` — méthodologie et feuille de route.
- `docs/API.md` — endpoints d'ingestion et de backtest.
- `docs/DEPLOYMENT.md` — déploiement Vercel + Supabase.
