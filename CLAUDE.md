# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project overview

KingOfCards is a flashcard app where the spaced-repetition scheduler is the point, not the CRUD
around it; see `docs/design-decisions.md` for the full rationale behind every stack decision (or
`mkdocs serve` for the rendered docs site, `docs/architecture.md` especially for diagrams of what
runs where). v1 was a single-user PWA with no auth; accounts (email+password, session cookies,
per-user data) were added post-v1, then clone-on-copy deck sharing on top of that; see "Accounts &
auth" and "Community decks" below. Stack: React frontend, Fastify/tRPC API, Turso (libSQL) as the
only datastore.

- **`apps/web`**: React + TypeScript + Vite PWA. Tailwind CSS v4, shadcn/ui (Base UI primitives,
  Nova preset; its default grayscale palette was deliberately replaced, see "Code conventions"
  below), Motion, react-router, react-markdown (+ rehype-highlight for code blocks in cards),
  lucide-react icons. tRPC client via `@trpc/tanstack-react-query` (`src/lib/trpc.ts`).
- **`apps/api`**: Fastify + tRPC, talks to Turso via `@libsql/client`.
- **`packages/scheduler`**: pure scheduling algorithms (SM-2, HLR-style), framework-free, with its
  own test suite. This is the part that actually matters. `src/comparison/` holds the simulation
  used to compare them; see `docs/comparison.md` for the actual results.
- **`packages/domain-shared`**: shared Zod schemas/types (e.g. `Rating`) used by both the API and
  the scheduler.

## Setup and commands

pnpm workspaces, Node >=20.

```
pnpm install               # installs the whole workspace
pnpm dev:api                # Fastify dev server (tsx watch), http://localhost:3001
pnpm dev:web                # Vite dev server, http://localhost:5173
pnpm build                  # builds every workspace package
pnpm test                   # runs every workspace package's tests
pnpm lint / pnpm lint:fix   # Biome check / check --write, whole repo
```

### Docs site

`docs/` + `mkdocs.yml` is a separate, Python-based mkdocs site (not part of the pnpm workspace):
architecture diagrams, setup, Docker, and the scheduler write-ups live there now instead of root
`DESIGN.md`/`COMPARISON.md` (migrated, not duplicated; those root files no longer exist).

```
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # once
.venv/bin/mkdocs serve                                                # http://localhost:8000
```

### Docker

```
docker compose up --build   # local libSQL server + api (scalable) + web (nginx: static + reverse proxy)
```

Copy `.env.example` to `.env` first. `pnpm dev:api`/`pnpm dev:web` on the host is still faster for
day-to-day work; Compose is for a consistent local libSQL server and a one-command demo.

- Three services: `db` (local libSQL), `api` (Fastify/tRPC, no fixed host port so `--scale api=N`
  works), `web` (nginx, the only one published, on `:8081`, serving the static build and
  reverse-proxying `/trpc`/`/healthz` to `api`, re-resolving DNS per request so it round-robins
  across scaled replicas).
- `apps/api/src/db/seed.ts` seeds 5 sample decks into a brand-new database; no-op once any deck
  exists, so restarts never duplicate.
- `packages/scheduler`/`domain-shared` keep `"main": "./src/index.ts"` for the dev/test loop (tsx/
  vitest/vite resolve it; plain `node` can't). `apps/api/Dockerfile`'s build stage works around this
  without touching the checked-in `package.json`: `pnpm pkg set main=./dist/index.js
  types=./dist/index.d.ts` on just those two packages, plus copying root `tsconfig.base.json`
  alongside them (every workspace tsconfig extends it; missing it surfaces as unrelated
  `@types/node` errors, not a clean failure). `apps/web/Dockerfile` copies the whole repo instead of
  a subset, since its `tsc -b` type-checks a devDependency import of `@kingofcards/api`'s
  `AppRouter` type.
- `apps/api/src/index.ts` sets `trustProxy: (_address, hop) => hop === 0` (trust exactly one hop,
  nginx) so rate-limiting keys off the real caller's IP, not nginx's. Not the numeric `trustProxy: 1`
  shorthand: fastify 5.12+ removed it, since a bare hop count can't validate the immediate peer, so
  it now always returns false instead. This function reimplements the identical single-hop decision.

### Windows/WSL

This repo lives on a WSL filesystem, mounted from Windows as `\\wsl.localhost\kali-linux\...`.

- Node CLIs that shell out to scaffold files (`create-vite`, `pnpm dlx` subshells) fail against that
  UNC path: `cmd.exe` silently writes into `C:\Windows` instead. Run Node/pnpm tooling from inside
  WSL (`wsl.exe -e bash -lc '...'` or a native WSL terminal), not the Windows-side path.
- Long-running dev servers need to be the top-level backgrounded command, not `nohup ... &` inside a
  nested `bash -lc` one-liner, since the nested shell's own teardown kills the `nohup`'d child too.
- Network reachability differs by shell: Windows-side can reach the internet (`curl`, `WebFetch`)
  but fails resolving `node_modules` over the UNC path; WSL resolves `node_modules`/`pnpm` fine but
  may have no outbound internet route. A script needing both (e.g. a `fetch-data.ts` that also runs
  `tsx`) has to split those steps across the two shells.

## Code conventions

- TypeScript everywhere, `strict` + `noUncheckedIndexedAccess` (`tsconfig.base.json`).
- **Biome is the only lint/format tool**: not ESLint/Prettier, and `biome.json` is the single
  source of truth for style (2-space indent, 120-char lines, double quotes, semicolons, trailing
  commas). Run `pnpm lint:fix` rather than hand-formatting or hand-fixing style nits.
  `organizeImports` sorts every file's imports into one flat alphabetical block, with no manual
  grouping/blank lines between node builtins, packages, and relative imports; that's not a gap,
  it's what the installed Biome version (1.9) does (grouped imports need Biome 2.x). Biome's
  120-char limit only reflows code; it never wraps comment text, so keep single-line comments
  under 120 chars by hand.
- **No em dashes, anywhere**: not in code comments, not in this file, not in `docs/*.md`. Use a
  comma, colon, semicolon, parenthetical, or a new sentence instead.
- **Comments use the language's own single-line syntax, kept short**: `//` in TypeScript/TSX, `#`
  in YAML/Dockerfiles/shell/Python; never mix within one file type. Outside a TSDoc block, a
  multi-line explanation is a short stack of single-line comments, not a `/* */` block. If a
  comment needs more than two or three lines to make its point, shorten it rather than writing a
  small essay.
- **Every function whose body isn't a one-liner gets a TSDoc comment**: exported or not, React
  components/hooks included, across `apps/api`, `apps/web`, and `packages/*` (test files are the
  one exception, since their `it()`/`describe()` names already say what they do). A one-line
  summary; an optional plain-prose paragraph directly below it (no `@remarks` tag, since this
  codebase doesn't use one) for non-obvious behavior, edge cases, or side effects; `@param`/
  `@returns` only where the name+types don't already say it; `@throws {@link ErrorType}` for
  non-obvious thrown errors; and `@example` for non-obvious call patterns. Blank `*` line between
  each section. See `packages/scheduler/src/hlr.ts` or `apps/api/src/repositories/decks.ts` for the
  pattern. Every comment should be self-contained: explain the *why* inline rather than naming
  another file or function and pointing there for it, since a later rename or move leaves that
  pointer stale with nothing to catch it.
- **Cross-cutting duration constants live in `apps/api/src/constants.ts`**, not inline at each call
  site: `SESSION_TTL_MS`, `VERIFY_EMAIL_TTL_MS`, `RESET_PASSWORD_TTL_MS`,
  `UNVERIFIED_ACCOUNT_GRACE_MS`, `UNVERIFIED_SWEEP_INTERVAL_MS`, and `HOUR_MS` used to be scattered
  across `auth.ts`/`index.ts`/`rateLimits.ts`. A constant that's genuinely local to one file (e.g. a
  magic batch-chunk size) still belongs next to its usage; this is specifically for time durations
  shared or conceptually grouped across files.
- `packages/scheduler` stays framework-free: no Fastify or React types, no I/O. It's the one package
  with a real unit-test obligation; SM-2 edge cases (lapses, the ease-factor floor, interval
  rounding) need explicit coverage, not just the happy path.
- `review_log` is append-only: never issue an `UPDATE`/`DELETE` against it from application code.
  Being append-only is what makes replaying different schedulers over the same review history
  possible later (see `docs/design-decisions.md`).
- **Tests are parametrized and assert whole objects.** A named data-provider constant (an array of
  `{ name, ...inputs, expected }` rows) feeds a single `it.each`, and the assertion is one
  `expect(actual).toEqual(expectedWholeObject)`, not several narrow `expect(actual.field).toBe(...)`
  calls, and not one `it()` per case. See `packages/scheduler/src/sm2.test.ts` or
  `apps/api/src/router.test.ts` for the pattern. Use `expect.closeTo(x, n)` inside the expected
  object for fields that are inherently floating-point (e.g. ease factor, half-life) rather than
  dropping to a narrow numeric assertion for just that field.
- **UI palette/type is deliberate, not shadcn's defaults.** `apps/web/src/index.css` overrides
  every shadcn color token with a warm-cream/royal-violet/gold theme (all-grayscale `oklch(_, 0, _)`
  was the literal "blunt 2010 web app" the redesign was fixing) and adds `font-heading` (Fraunces, a
  serif) for headings and card fronts; body text and all numeric figures (stat-tile values) stay in
  `font-sans` (Geist). Match this instead of falling back to a freshly-`shadcn add`ed component's
  default gray classes.
- **Rating buttons are a fixed traffic-light convention**, not shadcn variants: again=red-500,
  hard=amber-500, good=emerald-500, easy=sky-500, applied via direct Tailwind `className` overrides
  on `Button` (see `ReviewPage.tsx`) because shadcn's own variants have no amber/green/blue slots.
  Keep any new rating-adjacent UI consistent with these four colors rather than inventing new ones.
- **Stat tiles follow the dataviz skill's contract**: a colored icon in a tinted circle carries the
  identity, the numeric value stays in plain ink (never colored, never the serif heading font); see
  `StatsPage.tsx`. Reload that skill before adding a new stat tile, meter, or any chart.

## Architecture notes

Full rationale lives in `docs/design-decisions.md`; read it before changing the stack (database,
sync strategy, API style) rather than re-deriving from scratch. Short version: Turso/libSQL is the
only datastore (no Postgres/Redis), the API is tRPC (not REST), and the browser stays online-first
for CRUD. Only review-rating submission is queued offline, since Turso's own browser-native offline
sync was still beta when that was decided.

- **`pathFilter()`, not `queryFilter()`, for router-level cache invalidation.** `queryFilter()`
  exists per-procedure (`trpc.due.list.queryFilter()`); the router-level "invalidate everything
  under this path" helper is `pathFilter()` (`trpc.due.pathFilter()`). Some docs for the installed
  `@trpc/tanstack-react-query` (11.18.0) show `queryFilter()` at the router level, which doesn't
  compile against it.
- **`httpBatchLink` has no `fetchOptions`** (`@trpc/client` 11.18.0), only a `fetch` override.
  Cross-origin cookies go through a custom `fetch` injecting `credentials: "include"`
  (`apps/web/src/lib/trpc.ts`).
- **`Scheduler<TInternal>` is generic**: never reintroduce an SM-2-specific field to the shared
  shape. `SchedulerState<TInternal> = { dueAt: Date; internal: TInternal }`: `dueAt` is the one
  thing every scheduler must produce, `internal` is opaque per-algorithm state the API only
  `JSON.stringify`s/reads `dueAt` back out of. Adding a scheduler means a new file in
  `packages/scheduler`, never a shared field like `easeFactor` or `halfLifeDays`. Only
  `Sm2Scheduler` is currently wired into the routers (`due.ts`/`reviews.ts`/`stats.ts`), a
  deliberate choice, not an oversight to "fix"; see `docs/design-decisions.md` for why.
- **Auth is session-cookie, not JWT** (`apps/api/src/routers/auth.ts`, `auth.ts`, `trpc.ts`): a
  random 256-bit token in an httpOnly cookie, only its SHA-256 hash stored (`session.token_hash`),
  so a DB read can't be replayed as a live cookie and a session is instantly revocable.
  `verifiedProcedure` (session + verified email) gates every deck/card/review/stats procedure;
  `protectedProcedure` (session only) covers `logout`/`me`/`resendVerification`.
  - `@fastify/cookie`'s `FastifyReply.setCookie` augmentation only applies in files that import it;
    needs the side-effect `import type {} from "@fastify/cookie"` in `trpc.ts`.
  - CORS is an explicit origin allow-list, never `origin: true` + `credentials: true` (that combo
    lets any site read another origin's authenticated responses).
  - `login` always runs `bcrypt.compare`, even for an unknown email (against a precomputed dummy
    hash), since otherwise response timing alone enumerates registered emails.
  - Auth-endpoint rate limiting (`rateLimiter.ts`) and single-use token consumption
    (`authTokens.ts`) are single-statement atomic writes (`INSERT ... WHERE (SELECT COUNT...) <
    ?` and `DELETE ... RETURNING`), not SELECT-then-act. DB-backed for replica-safety (`api` scales
    horizontally behind nginx), and atomic so a concurrent burst can't exceed the limit or
    double-consume a token.
  - Pre-auth decks (no `user_id`) just stop appearing once every query filters `WHERE user_id = ?`;
    nothing deletes them. The backfilling `ALTER TABLE` in `migrate.ts` swallows only "duplicate
    column" errors rather than check-then-act, since N replicas can race the same migration on boot.
- **Community decks clone-on-copy, not live sharing** (`decksRepo.cloneDeck`/`listPublicDecks`):
  cloning copies `card` rows into a new deck under the caller, never touching
  `review_log`/`card_scheduler_state` (the copies are independent from the start, so there's no
  shared-scheduling problem). `listPublicDecks` computes `isOwn` server-side and never returns the
  raw owner id. Large clones batch inserts in chunks of ~500 (some decks run to 2,500 cards).
  `listPublicDecks` and the deck-detail card list are both cursor-paginated
  (`repositories/pagination.ts`'s shared `Page<T>`, keyset on `(created_at, id)`); `listCardsByDeck`
  itself stays unpaged since `levels.ts`'s level-chunking needs a deck's full ordered list at once.
- **Offline review queue** (`offlineQueue.ts` + `useOfflineSync.ts`): a rating posts immediately or,
  if offline/failed, queues in IndexedDB and flushes in order on reconnect (safe because
  `review_log` is append-only, so a queued rating is just a future insert). A flush failure is
  classified transient (network blip, retry next flush) vs. permanent (`UNAUTHORIZED`/`NOT_FOUND`,
  expired session or a since-deleted card; dropped instead of retried forever).
- **shadcn's `CardHeader` is `grid`, not `flex`**: `flex-row` alone changes nothing (it's a
  direction utility, not a `display` one). Use `flex flex-1 items-center gap-3` explicitly.
- **Card flip is a real 3D transform, not a `key`-swap**: `AnimatePresence` won't cross-fade two
  states of one boolean via a key swap. Both faces stay mounted, absolutely positioned,
  `backfaceVisibility: hidden`, animating `rotateY` inside a `perspective`-wrapped wrapper. Needs a
  genuine `h-*` (not `min-h-*`) for a `size-full` child to resolve a percentage height against.

## Next steps

- **Configure real email delivery.** Verification/password-reset emails currently only log to the
  API console (no `SMTP_HOST` set): fine for local dev, but needed before anyone besides you can
  actually receive one. Recommended: **Resend** (resend.com), no card required for its free tier,
  3,000 emails/month; `email.ts` is already generic nodemailer SMTP so this needs zero code
  changes, just real values for `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` in `.env`.
- **Configure real error tracking**, same shape as email above: `SENTRY_DSN` is unset today, so
  `errorTracking.ts` just logs to stdout. Create a free Sentry project and set `SENTRY_DSN` in
  `.env` (and in `render.yaml`'s synced env vars once deployed) before relying on it in production.
- **Deploy to Render.** `render.yaml` + `docs/deployment.md` cover a free-tier deploy (Turso cloud +
  a Render Blueprint); creating the Turso database/token and connecting the Render Blueprint are
  the two steps left to actually do, both one-time and account-owning so left for you to run.
- **Minor, no urgency:** a composite `(algorithm, due_at)` index on `card_scheduler_state` if a
  second scheduler's row count grows, and collapsing `reviews.submit`'s `getCard` + `isDeckOwner`
  reads into one join.
