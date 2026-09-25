# Deployment

## Local / persistent VM
The zero-dependency MVP runs directly on Node.js 22.5+:

```bash
npm start
```

SQLite is appropriate for local research and a single persistent server.

## Serverless hosting
Do **not** rely on the local SQLite file for a recorder deployed to an ephemeral/serverless filesystem. Use a persistent database first. `supabase/schema.sql` mirrors the MVP schema for PostgreSQL/Supabase.

## Production checklist
- Dedicated persistent database.
- Server-side `INGEST_TOKEN` or stronger authentication.
- Rate limit snapshot/signal ingestion.
- Provider adapter that normalizes odds timestamps without fabricating missing values.
- Current ANJ rule import; keep default-deny if unavailable/stale.
- Immutable backups of SHADOW signals and research trials.
- Monitoring for stale feeds and timestamp drift.
