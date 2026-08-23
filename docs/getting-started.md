# Getting Started

## Prerequisites

- Node.js >= 20
- [pnpm](https://pnpm.io/) (this repo uses pnpm workspaces)

## Install

```
pnpm install
```

Installs every workspace package (`apps/web`, `apps/api`, `packages/scheduler`,
`packages/domain-shared`) in one go.

## Run it locally

Two servers, in two terminals:

```
pnpm dev:api   # Fastify dev server (tsx watch), http://localhost:3001
pnpm dev:web   # Vite dev server, http://localhost:5173
```

Open **http://localhost:5173**: that's the app. `apps/api` talks to a local SQLite file
(`apps/api/data/dev.db`, created automatically) rather than a real Turso/libSQL server; see
[Architecture](architecture.md#local-development) for how the pieces connect. Sign up for an
account first (decks are per-account); with no `SMTP_HOST` set, the verification link is just
logged to the `pnpm dev:api` console instead of emailed. Want the sample decks? Run
`SEED_USER_EMAIL=you@example.com pnpm --filter @kingofcards/api run seed:samples` afterward; see
[Adding Decks](adding-decks.md) for the larger topic decks (kanji, kana, HSK, ...).

Prefer containers? See [Docker](docker.md).

## Everyday commands

```
pnpm build                  # builds every workspace package
pnpm test                   # runs every workspace package's tests
pnpm lint / pnpm lint:fix   # Biome check / check --write, whole repo
```

## Windows/WSL

If this repo lives on a WSL filesystem mounted from Windows (`\\wsl.localhost\...`), run pnpm/Node
commands from inside WSL (a native WSL terminal, or `wsl.exe -e bash -lc '...'`), not through the
Windows-side UNC path: some tools that shell out (`pnpm dlx`, scaffolding CLIs) silently fail or
write to the wrong place against a UNC working directory.
