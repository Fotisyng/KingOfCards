# Adding Decks

## Your own

Decks page → **New deck** → add cards one at a time. The normal path for personal content.

## The 5 bundled sample decks

`pnpm --filter @kingofcards/api run seed:samples` (see [Getting Started](getting-started.md)):
these are small, hand-authored decks (`apps/api/src/db/seed.ts`), tracked in the repo like any
other source file. Works out of the box on a fresh clone.

## The larger topic decks (HSK, JLPT kanji, periodic table, countries, kana)

These five were generated from public third-party datasets rather than hand-typed. Their
generation/seed scripts live in `apps/api/scripts/` (**gitignored, not part of the public repo**).
That's deliberate: this repo is public, and those scripts pull down (and would otherwise commit)
someone else's licensed dataset (HSK vocabulary, KANJIDIC2/JMDict, etc.), so keeping them local means
forking this repo doesn't redistribute that content, and it can be regenerated fresh instead of
aging in git history. A fresh clone won't have `apps/api/scripts/` at all.

If you have it locally, each topic follows the same two-script shape:

1. **`fetch-data.ts`** (or `build-data.ts` for kana, which is authored directly rather than
   fetched): run once, hits a public API/dataset, shapes the result into `{ frontMd, backMd }`
   cards, and writes `./content/*.json` next to itself.
2. **`seed-<topic>.ts`**: reads that JSON and creates/fills a deck per topic (JLPT level, HSK
   level, region, ...) for one account. Idempotent by deck name, like `seed:samples`.

```
pnpm --filter @kingofcards/api run build:kanji-data       # fetch once, needs outbound internet
SEED_USER_EMAIL=you@example.com pnpm --filter @kingofcards/api run seed:kanji
```

Same pattern for `hsk`, `kana`, `periodic-table`, and `countries`. `build:*` only needs to run
once; after that `seed:*` alone attaches the already-generated decks to any account.

## Adding a new topic deck

Follow the two-script shape above under a new `apps/api/scripts/<topic>/` folder.
`apps/api/scripts/kanji-jlpt/seed-types.ts`'s `SeedCard { frontMd, backMd }` is the only interface
the seed half needs; `fetch-data.ts` can shape its source however it wants as long as it writes
that shape to `./content/*.json`. Wire the two new `tsx scripts/<topic>/...` commands into
`apps/api/package.json`.
