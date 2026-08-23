# Docker

```
docker compose up --build
```

Copy `.env.example` to `.env` first: it includes `SMTP_*`/`WEB_BASE_URL` for verification/reset emails;
leave `SMTP_HOST` unset and the api container just logs the link instead of sending it. For
day-to-day development, `pnpm dev:api`/`pnpm dev:web` directly on the host (see
[Getting Started](getting-started.md)) is faster than the container loop; Compose here is for a
consistent local libSQL server and a one-command demo.

## Services

Three services (see [Architecture → Docker Compose](architecture.md#docker-compose) for the
diagram):

- **`db`**: local libSQL server (`ghcr.io/tursodatabase/libsql-server`), published on `:8080`.
- **`api`**: Fastify/tRPC. No fixed host port, internal-only, which is what makes scaling
  possible (below). Rate-limited (`@fastify/rate-limit`) and gzip/brotli-compressed
  (`@fastify/compress`).
- **`web`**: nginx, the only service published to the host, at `:8081`. Serves `apps/web`'s static
  build and reverse-proxies `/trpc`/`/healthz` to `api`.

Decks are owned by an account now, so nothing auto-seeds at boot: sign up first, then run
`SEED_USER_EMAIL=you@example.com pnpm --filter @kingofcards/api run seed:samples` to attach the 5
sample decks to that account (a no-op once the account already has decks, so re-running never
duplicates content). The larger topic decks (kanji, kana, HSK, periodic table, countries) have
their own `seed:*` scripts too, but the scripts that generate their content are gitignored and not
in this repo; see [Adding Decks](adding-decks.md).

## Scaling `api`

```
docker compose up --scale api=3
```

Works because `api` has no fixed host port. `web`'s nginx config re-resolves `api`'s DNS per
request (rather than once at nginx startup), so it can round-robin traffic across however many
replicas are running via Docker's embedded DNS.

Every replica is stateless and reads/writes the same `db`, so no sticky sessions are needed, since a
session cookie is validated by a shared-DB lookup, not in-process memory. The one thing that *was*
in-process (the auth-endpoint rate limiter) is now backed by a `rate_limit_attempt` table for the
same reason: an in-memory counter would only throttle whichever replica happened to answer. The
migration step (`migrate.ts`) is also safe under N replicas booting concurrently: every statement is
either `CREATE ... IF NOT EXISTS` or an `ALTER TABLE` that swallows its own "already applied" error,
so a race between replicas never crashes a boot.
