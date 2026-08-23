# Scheduler Algorithms

`packages/scheduler` is framework-free TypeScript with its own test suite: no Fastify or React
types leak into it. Both algorithms implement the same interface, so the API layer never needs to
know which one it's talking to:

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

`internal` is opaque, algorithm-specific state (SM-2's ease factor/interval/repetitions vs. HLR's
half-life): only the scheduler implementation ever inspects it. `dueAt` is the one thing every
scheduler must produce, since the due-card query needs it regardless of algorithm.

## Rating a card

Every review is one of four ratings, fed straight into whichever scheduler is active:

- **Again**: didn't recall it → resets, shown again soon.
- **Hard**: recalled, but it was a struggle → next interval grows slower than normal.
- **Good**: recalled with normal effort → the standard growth curve.
- **Easy**: recalled effortlessly → next interval jumps further ahead.

## SM-2 (`sm2.ts`)

Anki's algorithm, faithfully implemented: an ease factor per card, fixed graduation steps (1 day,
then 6 days), then ease-factor-driven interval growth after that, with a floor on the ease factor
so a card can't spiral down to near-zero intervals forever, and interval rounding to whole days.
Conservative by design: it under-spaces easy cards but rarely over-spaces anything.

## HLR-style (`hlr.ts`)

A simplified half-life-regression-style model. Recall is treated as exponential decay,
`p(t) = 2^(-t / halfLife)`, and the next interval is whichever elapsed time keeps predicted recall
at a target retention rate. A hand-tuned multiplicative half-life update (per-rating growth/decay
multipliers) stands in for real HLR's trained log-linear regression, since there's no per-user
training data at this scale; see [SM-2 vs. HLR Comparison](comparison.md) for exactly what that
simplification costs in practice.

## Simulating both (`src/comparison/`)

A `simulate(scheduler, syntheticHistory)` harness feeds a fixed rating sequence through a scheduler
and returns the resulting state after each step. The actual comparison goes further: a synthetic
"virtual learner" with its own true forgetting curve, independent of either scheduler, generates
realistic rating sequences so SM-2 and HLR can be scored against the same ground truth. Full
methodology and results: [SM-2 vs. HLR Comparison](comparison.md).

## Level gating is separate from scheduling

Decks also have a gated level-progression path (`apps/api/src/levels.ts`): cards are chunked into
fixed-size levels by creation order, and a level unlocks once every card in it has been recalled
successfully at least once. This is deliberately **not** part of the scheduler: it only reads
`rating` off the append-only `review_log`, never a scheduler's opaque `internal` state, and it only
ever gates the introduction of brand-new cards. Once a card has been reviewed for the first time, it
follows the normal scheduler-driven due date forever, regardless of level.
