# Design Decisions

Status: **v1 complete, plus accounts & auth (phase 9) and community decks (phase 10)**: all 10
roadmap phases done (see the [roadmap](#roadmap) below). This page is the deeper "why" reference;
for a quick visual overview of what runs where, see [Architecture](architecture.md) instead.

## Concept

A flashcard app where the scheduling algorithm is the product, not the CRUD around it. Decks and
cards are the minimum scaffolding needed to generate real review data; the actual deliverable is:

1. A faithful **SM-2** implementation (Anki's algorithm) as a correctness baseline.
2. A **differentiator algorithm** built on top: a half-life-regression-style model, difficulty-drift
   detection, and/or due-queue load balancing.
3. A **written comparison** of the two, backed by simulation: see [SM-2 vs. HLR Comparison](comparison.md).

v1 was single-user, no auth, single-tenant; accounts (public signup, email+password, per-user data)
were added as phase 9, and clone-on-copy deck sharing (phase 10) after that: a deck owner can flip
a "public" flag, other accounts can browse and clone one into their own account as a fully
independent copy. Non-goals throughout: native mobile apps, a content marketplace, real-time
multi-user features, and **live** collaborative editing: cloning makes a disconnected copy on
purpose, specifically to avoid the concurrent-edit/shared-scheduling problems a real shared-editing
deck would need to solve.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite, Tailwind CSS, shadcn/ui, Motion | Widest interview/portfolio recognition; shadcn/ui gets a clean review-session UI fast without hand-rolling components. |
| Delivery | Installable PWA (service worker, manifest) | Zero-install demo story: a link, not an app-store submission. |
| Database | Turso (managed libSQL) | Single source of truth, server-side. GA, mature Node SDK. |
| Backend API | Node.js + Fastify | Thin layer over Turso: review submission, due-card queries, session-cookie auth (phase 9). |
| Local dev DB | local `libsql-server` (via Docker) | Full Turso-compatible server, no cloud account needed day-to-day. |
| Lint/format | Biome | One tool, minimal config, fast. |
| Deployment | Docker Compose (api + web + local libSQL) | See [Docker](docker.md) for the full container setup, including horizontal scaling. |

**Offline strategy:** the Fastify API is server-authoritative and the only thing that talks to Turso.
The PWA is online-first for deck/card management (service worker only caches the app shell/static
assets for installability). The review loop specifically gets a narrow offline allowance: ratings
submitted while offline queue in IndexedDB and flush to the API on reconnect, safe to hand-roll
because the source of truth is an append-only log (see below), so a queued rating is just a future
insert, never a conflicting edit.

## Data model

- `user (id, email, password_hash, email_verified_at, created_at)`
- `session (token_hash, user_id, expires_at, created_at)`: `token_hash` is a SHA-256 of the cookie's
  random token, never the token itself.
- `auth_token (token_hash, user_id, purpose, expires_at, created_at)`: shared by email-verification
  and password-reset links (`purpose`), single-use (deleted on consumption).
- `deck (id, user_id, name, description, is_public, created_at)`: `user_id` is the only ownership
  column; every other table below scopes to it transitively through `deck_id`/`card_id`, not by
  duplicating `user_id` onto each one. `is_public` gates `decks.listPublic`/`decks.clone`: cloning a
  public deck copies its `card` rows into a brand-new `deck` under the cloning account (fresh ids,
  no reference back to the source); it never touches `review_log`/`card_scheduler_state`, since the
  copy starts with no review history of its own.
- `card (id, deck_id, front_md, back_md, created_at)`
- `review_log (id, card_id, rated_at, rating, algorithm, resulting_interval_days)`: **append-only,
  the actual source of truth.** Never updated or deleted.
- `card_scheduler_state (card_id, algorithm, state_json, due_at)`: a derived/cached projection,
  one row per (card, algorithm). Rebuildable at any time by replaying `review_log` through a given
  scheduler implementation.

Keeping `review_log` append-only and authoritative is what makes the "compare SM-2 vs. our own
algorithm" story possible: replay the same historical ratings through a different scheduler and get
a different set of intervals, with no risk of corrupting real data. It's also what makes the offline
outbox above safe, and what let a gated level-progression system (grouping a deck's cards into
sequential unlock stages) be added later without touching the scheduler at all: it only reads
`rating` off this log, never scheduler-internal state.

## Scheduler module (`packages/scheduler`)

The part that actually matters, kept as a small, pure, framework-free TypeScript package with its own
test suite: no Fastify or React types leak into it. See [Scheduler Algorithms](scheduler.md) for
what SM-2 and the HLR-style model actually do, and [SM-2 vs. HLR Comparison](comparison.md) for the
simulation results comparing them.

```ts
interface SchedulerState<TInternal = unknown> {
  readonly dueAt: Date;
  readonly internal: TInternal; // opaque (the API/DB layer never inspects this)
}

interface Scheduler<TInternal = unknown> {
  readonly id: string; // "sm2", "hlr"
  next(state: SchedulerState<TInternal> | null, rating: Rating, now: Date): SchedulerState<TInternal>;
}
```

`internal` is opaque per-algorithm JSON (SM-2's ease factor/interval/repetitions vs. HLR's half-life
are shaped completely differently): the API and DB never inspect its shape, only the scheduler
implementation does. `dueAt` is the one thing every scheduler must produce, since the due-card query
needs it regardless of algorithm. Adding a third scheduler means writing a new file in
`packages/scheduler` and nowhere else touching a concrete field name like `easeFactor` or
`halfLifeDays`.

HLR is fully implemented and unit-tested but deliberately not wired into the API: `due.ts`'s
`ALGORITHM` constant and every router that uses it (`reviews.ts`, `stats.ts`, `levels.ts`) hardcode
`Sm2Scheduler` rather than iterating `AllSchedulers`. Per [SM-2 vs. HLR Comparison](comparison.md)'s
own results, HLR's hand-picked half-life multipliers underperform SM-2 today (lower retention for
fewer reviews), worth revisiting once those multipliers are fit to real review data instead of
hand-picked, not before.

## Repo layout

See [Architecture → Repo layout](architecture.md#repo-layout) for the current tree.

## Roadmap

| Phase | Delivers | Status |
|---|---|---|
| 0 | Repo scaffold: pnpm workspace, Vite/Fastify skeletons, Docker Compose + local Turso dev, CI | Done |
| 1 | `packages/scheduler`: SM-2 + simulation harness, fully unit-tested | Done |
| 2 | Data model + Fastify/tRPC API (decks, cards, review submission, due-cards query) | Done |
| 3 | Review UI: deck management, keyboard-driven review session, PWA installability | Done |
| 4 | Basic stats: due today, retention rate, streak | Done |
| 5 | Offline review queue: IndexedDB outbox + reconnect flush | Done |
| 6 | Differentiator algorithm: HLR-style half-life scheduler | Done |
| 7 | Simulation-backed comparison write-up: SM-2 vs. HLR | Done |
| 8 | Polish (CI, docs, Dockerfile review), containerized deployment (api + web + db, horizontally scalable), gated level-progression per deck | Done |
| 9 | Accounts & auth: public signup (email+password), session cookies, blocking email verification, password reset, per-user data scoping | Done |
| 10 | Community decks: publish/unpublish, browse public decks, clone-on-copy into your own account | Done |
