# BetLab Research Engine

MVP autonome du laboratoire de stratégies construit dans la conversation : **recherche d'edge, pas promesse de gains**.

## Production

- Site : https://betlab-sandy.vercel.app
- Backend : Supabase/PostgreSQL, schéma isolé `betlab`.
- Interface publique : lecture seule (dashboard, stratégies, statut réglementaire).
- Écritures : RPC privées protégées par token, non exposées dans le code public.
- Politique réglementaire France : **default-deny** tant que la liste ANJ courante n'est pas chargée.

## Démarrage local

Prérequis : Node.js 24.x en production Vercel. Le développement local reste compatible avec Node 22.5+.

```bash
npm start
```

Sans variables Supabase, BetLab utilise SQLite local. Le serveur local complet peut utiliser Supabase avec `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` et `INGEST_TOKEN`.

## Tests

```bash
npm test
```

## Ce qui fonctionne déjà

- Dashboard responsive smartphone.
- Production Vercel opérationnelle.
- Backend Supabase isolé des autres tables du projet hôte.
- SQLite local via `node:sqlite`.
- Registre LAB/SHADOW/PRODUCTION prêt.
- 26 stratégies/filtres prioritaires seedés.
- Odds Snapshot Recorder côté backend privé.
- Shadow signal ledger append-only.
- Multiplicative de-vig et Power de-vig.
- Shrinkage vers le marché et Robust EV.
- Upload CSV Football-Data et diagnostic Favorite–Longshot en local/API complète.
- Calibration par tranche de cote, ROI, bootstrap CI 95 %, Brier, Log Loss, ECE, drawdown, losing streak, LDR, PCR10.
- Règles France en **default-deny** tant que la liste réglementaire actuelle n'est pas chargée.

## Architecture sécurité production

Le dashboard Vercel n'utilise que l'URL Supabase et une clé **publishable**. Il appelle uniquement trois RPC publiques et strictement en lecture :

- `betlab_public_dashboard()`
- `betlab_public_strategies()`
- `betlab_public_regulatory_status()`

Les tables du schéma `betlab` restent privées. Les RPC d'ingestion et de signaux restent protégées par token côté base et ne sont pas exposées dans le bundle public.

## Pourquoi les stratégies intraday ne sont pas déjà « backtestées »

Bookmaker Lag, Steam, Information Half-Life et le LIVE nécessitent des cotes horodatées pendant la vie du marché. Opening + closing ne suffisent pas. BetLab enregistre donc ces snapshots à partir du moment où un provider est branché.

## Documentation

- `docs/RESEARCH_SPEC.md` — méthodologie et feuille de route.
- `docs/API.md` — endpoints d'ingestion et de backtest.
- `docs/DEPLOYMENT.md` — déploiement Vercel + Supabase.
