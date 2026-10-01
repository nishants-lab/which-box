# Everything Fits

A 3D packing puzzle with Daily and Free play. The creative version described below is a local release candidate, not a claim that it has been published or deployed.

## Play the creative build

Choose Daily for the shared UTC-day puzzle, or Free play for Standard, Hard or Expert. Rotate connected L, step, T and other voxel parcels, choose a position on the always-visible grid, then place the parcel. Pieces descend vertically and every exposed bottom cell needs support. Fill the rectangular, L-shaped or raised-floor container, then seal it. Undo is free.

There are 90 distinct puzzles, 30 per difficulty. All have verified playable arrangements. Expert has 29 puzzles with exactly two distinct playable solutions and one with exactly one. Counts identify identical physical-piece swaps and gravity-preserving container rotations, never reflections. Difficulty labels are provisional pending human playtests.

Free play supports repeated sessions from a finite catalogue. Next puzzle and Skip select unseen puzzles at the chosen difficulty, excluding today's Daily. When that pool is exhausted, choose an explicit replay cycle or another difficulty. This is not an endless supply of unique puzzles.

Daily and Free play have separate saved attempts. Switching modes pauses the active attempt's personal timer. Each new attempt has two optional hints, adding 20 seconds each, and a one-off help offer. Resetting an attempt preserves hint penalties and whether help was already offered. Completion records are separate from unfinished attempts. Times are personal and unverified, with no leaderboard. Sharing creates a spoiler-free result card and never posts automatically.

## Rules and catalogue stability

Creative puzzles use `voxel-1`. The catalogue-v1 order and date mapping must remain immutable once published: appending or reordering that list would change Daily selection. Future catalogues need a separately versioned schedule. The legacy `dd-1` engine and prior result reader remain for compatibility; creative play does not redefine old daily seeds.

`tools/generate-catalogue.mjs` deterministically generates candidates and verifies them offline. Certification requires exhaustive search; capped searches have an unknown solution count. Do not regenerate or reorder an already published catalogue in place.

## Privacy and saved progress

Web progress is stored only in this browser's local storage. It includes Daily and Free play attempts, seen-puzzle IDs and up to 100 creative completion records. There is no application account, analytics service or server-side score verification. Clearing site data removes browser progress. Separate browsers and devices do not synchronize. Hosting providers may retain infrastructure logs. Reddit has separate opt-in, community-scoped server storage; these web privacy statements do not describe Reddit's platform behavior.

## Development

Requires Node 24+.

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The active unit tests cover the legacy engine, voxel rules, catalogue and saved progress. Creative browser tests are in `tests/creative.spec.ts`. The old UI play test is archived as `tests/legacy-play.scenario.ts`, outside automatic Playwright discovery; legacy engine tests remain active in `tests/game.test.ts`.

The Pages workflow tests and deploys main when triggered. That workflow configuration does not establish that this local candidate is live. Dependencies are public React, Three.js and Vite; no proprietary runtime or credentials are required.

## Release 1.4.1

The visible name is Everything Fits, formerly Which Box?. Existing saved progress, puzzle identities and technical app identifiers are unchanged.

## Historical releases

### Release 1.1.0

First public browser release, with spoiler-free PNG result sharing and responsive 3D gameplay. Native image sharing and clipboard access depended on browser support and permissions; PNG download was the fallback.

### Release 1.2.0

Introduced a count-up timer, two hints costing 20 seconds each, free undo, reduced-motion behavior and scored-time share cards. Timing was session-only and reload cleared attempt time. These historical persistence rules do not describe the creative build above.

### Single-box redesign

The earlier local redesign used one fixed Compact cuboid box, an always-visible placement grid, automatic next-parcel selection and a one-shot help offer. It preceded the creative voxel catalogue and separate saved modes.
