# Deployment

## Local

Without Supabase variables, BetLab automatically uses SQLite:

```bash
npm start
```

## Vercel + Supabase

Production uses Supabase through its Data REST API and authenticated database RPC functions. No database password or service-role key is required by the application.

Required environment variables:

```text
INGEST_TOKEN=<long random secret>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Apply in this order:

1. `supabase/schema.sql`
2. `supabase/production-hardening.sql`
3. `supabase/seed-strategies.sql`
4. Store the same `INGEST_TOKEN` in `betlab_private.settings` under key `ingest_token`.

The hardening migration:

- enables RLS on exposed tables;
- exposes no direct table reads/writes to `anon`;
- exposes only a small RPC surface;
- requires the same `INGEST_TOKEN` inside every RPC;
- keeps the token in a private, non-exposed schema.

Vercel supports zero-config Node servers via a root `server.ts`; BetLab includes that entrypoint and keeps the existing `server.mjs` for local use.

## Production checklist

- Run Supabase security and performance advisors.
- Add the three environment variables to Vercel.
- Deploy and verify `/api/health`, `/api/dashboard`, `/api/strategies` and the home page.
- Confirm `/api/health` reports `store: SUPABASE`.
- Load a current ANJ ruleset before enabling any regulatory-approved production signal; default-deny remains active otherwise.
