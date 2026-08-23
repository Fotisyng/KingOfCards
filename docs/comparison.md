# SM-2 vs. HLR-style: a simulation-backed comparison

A real comparison between the two scheduling algorithms in `packages/scheduler`, backed by an actual
simulation run rather than intuition. Reproduce it with:

```
pnpm --filter @kingofcards/scheduler compare
```

## Methodology

Neither algorithm can be graded against real user data (this project has none at meaningful scale),
so the comparison uses a **synthetic virtual learner** with its own "true" forgetting curve, in
`packages/scheduler/src/comparison/virtual-learner.ts`:

- Each synthetic card has a true half-life that starts at 1 day and evolves after every review:
  it doubles on a successful recall, and shrinks to 60% of its value on a failure (floored at 1
  day; see "Why the half-life floor matters" below).
- Recall probability at review time is modeled the same way `HlrScheduler` models it,
  `p(t) = 2^(-t / halfLife)`, but this *true* half-life is completely independent of whatever
  either scheduler under test believes about the card. Neither scheduler can see it directly.
- Whether the synthetic learner "recalls" the card is a random draw against that true probability,
  using a seeded PRNG (`comparison/prng.ts`) so every run is reproducible.
- The recall outcome is mapped onto the 4-button rating scale (`again`/`hard`/`good`/`easy`) based
  on how comfortable the recall was, then fed into whichever scheduler is under test to pick the
  next review date.

Both schedulers face **the same synthetic cards**: each card gets its own RNG stream seeded from
`seed + cardIndex`, so scheduler A and scheduler B see identical underlying "luck" for card *N*
regardless of how many times each has reviewed it so far. Whatever differs in the results is
attributable to the scheduling algorithm, not to different random draws.

### Why the half-life floor matters

An early version of this simulation had no floor on the true half-life and produced single-digit
retention rates for both algorithms, which was obviously wrong. The cause: once a card's true half-life
dropped below both schedulers' 1-day minimum interval, every subsequent review was guaranteed to
land *after* the card was already forgotten, shrinking the half-life further and making recovery
mathematically impossible. Flooring the true half-life at 1 day (matching the schedulers' own
minimum granularity) removes that unrecoverable spiral. A second bug, modeling a brand-new card's
first exposure as "zero elapsed time since last review," which works out to guaranteed recall
(`2^0 = 1`), was fixed by treating first exposure as elapsed time equal to one initial half-life
(a coin flip, `p = 0.5`), which is what "you've never seen this before" should actually mean.

## Results

500 synthetic cards per seed, 3 seeds, two time horizons:

| Horizon | Scheduler | Avg. reviews/card | Empirical retention |
|---|---|---|---|
| 90 days  | SM-2 | 15.3 | 73.3% |
| 90 days  | HLR  | 12.2 | 67.6% |
| 365 days | SM-2 | 19.4 | 78.5% |
| 365 days | HLR  | 15.2 | 68.0% |

(Numbers are averages across seeds 1–3; the spread between seeds was under 0.1 percentage points
at this sample size, so the pattern isn't a fluke of one random run.)

## What this actually shows

**HLR needs consistently fewer reviews (~20% less) but achieves lower retention (~10 points
lower) than SM-2, at both horizons.** SM-2's fixed graduation steps (1 day, then always 6 days,
*then* ease-factor growth) are conservative early on: they under-space easy cards but rarely
over-space anything, which is exactly why they show up as more total reviews for higher retention.

HLR's exponential model targets 90% retention by construction (the same target-retention formula
used in `hlr.ts`), but in practice it converged to ~68%, not 90%. That gap is the interesting
finding, not a bug: `HlrScheduler`'s internal half-life update uses **hand-picked** growth/decay
multipliers (1.6/2.8/4.4 for hard/good/easy, 0.5 for a lapse). The *true* synthetic learner's memory
follows a *different* set of multipliers (2.0 growth, 0.6 decay). Real Half-Life Regression
(Duolingo's actual system) doesn't hand-pick these constants: it fits them via regression against
observed recall data, which is precisely how it closes this kind of calibration gap. This
lightweight, per-card implementation is a deliberate simplification (see
[Design Decisions](design-decisions.md)); the retention shortfall here is the concrete, measurable
cost of that simplification, not a flaw in the exponential forgetting-curve premise itself.

## Caveats

- The "true learner" model is itself synthetic and hand-tuned: it's a controlled way to compare
  two algorithms fairly, not a validated model of real human memory.
- Real usage would let cards vary in initial difficulty; every synthetic card here starts at the
  same 1-day true half-life.
- `ratingFromRecall`'s thresholds (which recall probability counts as "easy" vs "good" vs "hard")
  are also hand-picked, and shape how much signal each scheduler gets to work with.

## Takeaway

Neither algorithm is strictly better: they sit at different points on a review-time/retention
tradeoff. SM-2 is the safer default (higher retention, well-understood, more total review time).
HLR-style scheduling is the one worth reaching for when review time is the scarcer resource and
~68% empirical retention (against a 90% target) is an acceptable cost, or, more realistically, once
its multipliers are fit to real data instead of hand-picked, which is the natural next step this
comparison motivates rather than one this project attempts.
