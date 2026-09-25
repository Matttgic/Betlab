# BetLab Research Engine

Laboratoire quantitatif de stratégies : **recherche d'edge, pas promesse de gains**.

## Production

- Site : https://betlab-sandy.vercel.app
- Backend : Supabase/PostgreSQL, schéma isolé `betlab`.
- Interface publique : lecture seule.
- Écritures : uniquement via moteurs privés Supabase / service role.
- Politique réglementaire France : allowlist conservatrice + **default-deny** pour tout élément non réconcilié.

## Automatisation active

- Collecte Football-Data : toutes les 6 h (`betlab_football_refresh_6h`).
- Moteur SHADOW / anti-fausse-value : toutes les 6 h, après le refresh (`betlab_shadow_engine_6h`).
- Backtests historiques : chaque lundi (`betlab_backtest_refresh_weekly`).
- Les données sont persistées dans Supabase.

## Données et recherche actuellement actives

- 26 stratégies/filtres enregistrés.
- Snapshot recorder persistant.
- Prix Football-Data H2H / totals / Asian Handicap quand disponibles.
- Backtests historiques favori vs longshot sur Angleterre, France, Allemagne, Italie, Espagne.
- ROI, P/L à 10 € par pari, Brier, Log Loss, ECE, drawdown, série de pertes et intervalle 95 %.
- Moteur anti-fausse-value : probabilité marché dé-viggée vs meilleur prix observé, avec pénalité d'incertitude croissante avec la cote.
- Un signal peut être classé `NO_BET`, `SHADOW_BET`, `CANARY` ou `PRODUCTION` ; actuellement seul le niveau SHADOW peut être généré automatiquement.
- Aucun modèle n'est promu sur la seule base d'un ROI positif isolé.

## Démarrage local

Prérequis : Node.js 22.5+ en local, Node 24.x en production Vercel.

```bash
npm start
```

Sans variables Supabase, BetLab utilise SQLite local et autorise les écritures locales.

Avec :

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

le serveur local utilise la production Supabase en **lecture seule**. Les écritures distantes ne sont jamais accessibles via une clé publique.

## Tests

```bash
npm test
```

## API publique Vercel

- `/api/health`
- `/api/dashboard`
- `/api/strategies`
- `/api/regulatory/status`
- `/api/feed/status`
- `/api/events/current`
- `/api/snapshots`
- `/api/backtests`
- `/api/signals`

Toutes ces routes sont en lecture seule.

## Sécurité

Le bundle Vercel ne contient qu'une clé Supabase **publishable**, jamais de `service_role` ni de secret d'ingestion.

Les anciennes RPC d'écriture accessibles avec un token ont été retirées de l'accès `anon`. Les moteurs de collecte, backtest et SHADOW fonctionnent côté Supabase avec des fonctions privées.

Les tables du schéma `betlab` restent privées et RLS est activé. Les RPC publiques sont limitées à des projections de lecture dédiées avec `search_path` verrouillé.

## Réglementaire France

BetLab conserve une allowlist versionnée et refuse par défaut les compétitions/marchés non explicitement couverts. La dernière décision détectée est suivie séparément afin d'éviter de transformer une donnée réglementaire incomplète en autorisation implicite.

## Pourquoi les stratégies intraday restent en LAB

Bookmaker Lag, Steam, Information Half-Life et le LIVE nécessitent des cotes réellement horodatées pendant la vie du marché. Les données opening/closing ou batch ne suffisent pas. BetLab les garde donc en LAB jusqu'à disposer d'un historique intraday suffisant.

## Documentation

- `docs/RESEARCH_SPEC.md` — méthodologie et feuille de route.
- `docs/API.md` — endpoints et schémas.
- `docs/DEPLOYMENT.md` — déploiement Vercel + Supabase.
- `supabase/functions/` — collecteurs et backtests déployés.
