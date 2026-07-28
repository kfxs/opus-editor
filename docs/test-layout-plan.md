# Test layout plan

`src/` holds **113 test files against 159 source files** — tests are 41% of the
tree, and in `src/engine/rendering/` they *outnumber* source (29 vs 22). The
directory listings have become hard to scan.

The fix is **not** a wholesale move to a `tests/` tree. Most of these tests are
correctly placed and the layout only looks wrong because of a naming drift
described below. This plan renames the majority in place, moves a minority, and
adds a check so the drift cannot recur.

## The finding: source splits by structure, specs split by topic

`ScoreModel.ts` has been split several times and will be split again. **Splitting
a source file does not split its spec** — `ScoreModel.test.ts` keeps importing
`ScoreModel` and keeps passing, which is exactly what makes it valuable during a
split (unchanged tests still green is the evidence behaviour survived).

What grows instead is the *spec*. `ScoreModel.test.ts` is now 2,515 lines, and it
has already been split — **by topic**, into `barWidth.test.ts`,
`noteSpacing.test.ts`, `fan.test.ts`, `tremolo.test.ts`, `cautionary.test.ts`,
`tremoloPair.test.ts`, `restFill.baseline.test.ts`. Every one of those imports
`./ScoreModel` as its subject. They are `ScoreModel.test.ts` chapters 2–8.

Because they are named after a *topic* and not their *subject*, no module in the
directory matches their name, so they read as homeless. They are not. This is the
drift: source splits by structure, specs split by topic, and the two namings stop
lining up.

The codebase already has the right convention in five places —
`MenuLayer.columns.test.ts`, `MenuLayer.keyboard.test.ts`,
`EditorState.observable.test.ts`, `DomTextEdit.menu.test.ts`,
`App.smoke.test.ts`. **`Subject.topic.test.ts`**, subject sitting beside it. The
plan is to apply it everywhere rather than invent anything. (Those five, plus
`restFill.baseline.test.ts`, are the *only* dotted names in the tree — the
convention exists but covers 5 of 113 files.)

### How this repo actually splits

Splitting is not a `ScoreModel` event — it is standing practice: any file that
grows past comfort and can be made more modular gets divided. So the layout has
to survive splits indefinitely, not absorb one migration.

The decisive detail is the *shape*. Every split so far has **extracted a piece and
kept the parent**:

```
50301e3  Tier A file-split: extract clef/tuplet/projection ops from ScoreModel
666f458  Phase 5: split the rebar/paste machinery out of ScoreModel
```

`ScoreModel.ts` survived both and is still 3,590 lines. What the extractions
produced:

| extracted module | lines | spec named after it |
|---|---|---|
| `rebarOps.ts` | 1390 | none |
| `tupletOps.ts` | 343 | none |
| `clefOps.ts` | 152 | none |
| `noteProjection.ts` | 68 | none |

1,953 lines of score-layer logic, still specced only under `ScoreModel.test.ts`'s
name. That is the unfinished split this plan wants surfaced, and it shapes
Phase 3 — see there.

**The convention taxes every split.** Extract the bar-width logic out of
`ScoreModel` and `ScoreModel.barWidth.test.ts` has to be renamed too. The plan's
position is that this rename *is* the signal the split finished, so the tax is the
feature — but it is a recurring per-split step, not a one-off migration, and it is
priced here rather than discovered later.

### Measured size of the drift

46 of the 113 test files have no sibling module matching their name up to the
first dot:

| directory | homeless | of |
|---|---|---|
| `engine/rendering/` | 18 | 29 |
| `interactions/` | 14 | 30 |
| `engine/models/` | 7 | 11 |
| `engine/` | 4 | 8 |
| `engine/audio/`, `shortcuts/`, `windows/keypad/` | 1 each | |
| `utils/`, `menus/`, `windows/`, `dev/` | 0 | 24 |

So the rename set is roughly **25–30 files**, not a dozen, and the genuine-orphan
set is smaller than the raw 46 — many of the `interactions/` and `rendering/`
entries do have a subject sitting beside them, just not in their name
(`barWidthDrag`/`stemSelection`/`noteSpacingDrag` → `MouseController`;
`barlineHighlight` → `HighlightController`; `tier1Geometry`/`culling`/`fanRender`
→ `VexFlowRenderer`).

## Settled decisions

1. **Co-located specs stay co-located.** A spec that names its subject moves when
   its subject moves, in one gesture. That property is worth most during churn,
   and more churn is coming — so a restructure argues *for* co-location.
2. **No top-level `tests/` mirror.** A mirror tree is a second copy of the
   directory structure, i.e. a duplicate of the thing that is going to change.
   Every future split would become two moves instead of one, with the mirror
   wrong in between. This is the one layout the coming package extraction rules
   out.
3. **Genuine feature tests go in a per-directory `__tests__/`**, not a central
   one. The folder rides along with its parent when the parent moves — the same
   restructure-proof property as co-location, with no second tree to sync.
   Staying under `src/` also keeps them inside `tsc --noEmit` and
   `lint:boundary`, both of which glob `src/**` recursively.
4. **Classification is by what a test asserts on — never by filename, and never
   by import count.** Both shortcuts have been measured and both are wrong:
   - *Filename* produced at least twelve false positives (see decision 4a).
   - *Dominant import* fails the same way one level up. `rendering/barWidthLayout.test.ts`
     imports and constructs `ScoreModel` throughout, but every assertion is on
     `calculateMeasureWidths` from `./MeasureLayout`. **ScoreModel is the fixture,
     not the subject.** Same for `fanWidth`, `noteSpacingLayout` and
     `clefWidthIndependence` — all four are `MeasureLayout` specs. An
     import-counting audit renames all four after `ScoreModel`, across a directory
     boundary, and Phase 3b's ratchet then rejects every one.

   The usable signal is the identifier inside `expect(...)` and the function
   called under test. 46 files is small enough to read.

   4a. **The two `utils`-named files in `engine/models/` are ScoreModel chapters,
   not misplaced utils specs.** `models/tremoloPair.test.ts` imports
   `./ScoreModel`, `@/types/music`, `@/utils/fraction` and
   `@/interactions/clipboard` — it never imports `@/utils/tremoloPair`.
   `models/restFill.baseline.test.ts` imports `./ScoreModel` and `fraction`,
   nothing else. `utils/tremoloPair.test.ts` and `utils/restFill.test.ts` already
   exist and test the real utils modules. Moving the models pair into `utils/`
   would be classifying by filename — these two *are* two of the twelve false
   positives. They are Phase 2 renames: `ScoreModel.tremoloPair.test.ts`,
   `ScoreModel.restFill.test.ts`.
5. **A `MusicEngine` test is a spec only if `MusicEngine` is all it drives.**
   `MusicEngine` is both a module with a sibling *and* the thing feature tests
   drive, so decisions 3 and 4 fire in opposite directions for ~20 files
   (`engine/barWidthNudge`, `engine/noteSpacingNudge`, `engine/fanMemberCommands`,
   `rendering/ghostContextLeak`, `rendering/ledgerLineStyle`,
   `rendering/dotRegistration`, `rendering/noteSpacingRender`, and most of
   `interactions/`). The tie-break:
   - imports only `MusicEngine` + `types`/`utils` ⇒ **spec**, rename in place;
   - also imports controllers, `clipboard`, `shortcutWiring`, `keypadSync` ⇒
     **feature test**, move to `__tests__/`.
6. **Ambiguous files get surfaced, not guessed at.** At least one is already
   known: `rendering/staveGeometry.test.ts` imports `vexflow` and nothing else —
   it is a probe of VexFlow's own behaviour and has no subject in this repo.
7. **No test *contents* are touched.** This is a layout change only. No
   production code changes, so `dist/` is byte-identical throughout.

## What the tooling already permits (verified)

- `.eslintrc.boundary.json` sets `excludedFiles: ["**/*.test.ts"]` on the
  score-layer override, so **no test move can break `lint:boundary`**.
- `vite.config.ts` sets no `test.include`, so vitest's default glob picks up
  `__tests__/` with no config change.
- `git mv` with no content change preserves history through rename detection.

## Why this matters for the future npm package

The realistic package is not the whole editor — it is the score layer
`lint:boundary` already carves out (`engine/models` + `utils` + `types`, forbidden
from touching DOM, VexFlow, audio, or `MusicEngine`). Co-located specs travel with
their modules when that subtree is extracted.

Note what this argument does *and does not* support. It supports keeping the
`models/` and `utils/` specs co-located — which is already the status quo, and is
what Phase 2 preserves. It does **not** support Phase 4: no feature test lives in
the score layer, so sorting `interactions/` buys the extraction nothing. Phase 4
has to justify itself on legibility alone.

Publishing itself is unaffected by test placement — what ships is decided by
`package.json` `files` and the build's `exclude`, not by folder layout. Two
one-line facts to note when that day comes: there is currently no `files` field
and no `.npmignore` (so `npm publish` today would ship everything), and
`tsconfig.json` includes `src/**/*.ts` with no test exclude, which matters only
once `.d.ts` emit is turned on.

## Phases

Ordered by value per unit of risk. Phase 4 is last because it is the only one
that touches import paths, and the only one whose failure mode is silent.

### Phase 0 — Audit table (no file changes)

A node script that, for every `*.test.ts`, prints three columns: its imports, the
top identifiers appearing inside `expect(...)`, and whether a sibling module
matches its name. It **proposes** a bucket — **spec** (sibling subject present),
**topic-split spec** (subject present but not in the name), **feature test**
(decision 5) — but the sort is settled by reading the table, per decision 4.
Nothing moves until the sort is approved.

### Phase 1 — Rename the `engine/models/` chapters

The 7 files that unambiguously import `./ScoreModel`: `barWidth`, `cautionary`,
`fan`, `noteSpacing`, `tremolo`, `tremoloPair`, `restFill.baseline` →
`ScoreModel.<topic>.test.ts`. Same directory, therefore **zero import rewrites and
zero `vi.mock` rewrites** — a pure `git mv` per file. This is the case the finding
was written about and the one with no judgement calls left in it.

*Verify:* `npm run test`.

### Phase 2 — Rename the remaining topic-split specs in place

The ~18 elsewhere, using the Phase 0 table: `rendering/barWidthLayout` →
`MeasureLayout.barWidth`, `rendering/tier1Geometry` → `VexFlowRenderer.tier1Geometry`,
`interactions/stemSelection` → `MouseController.stemSelection`, and so on. Still
same-directory `git mv`, still zero import rewrites — but each name is a judgement
made in Phase 0 rather than a mechanical transform.

*Verify:* `npm run test`.

### Phase 3 — Two checks, pointing in opposite directions

An earlier draft had one rule here and claimed it "fails exactly when a split has
left a spec pointing at a module that no longer owns it." That is only true when a
split *deletes* the parent, and this repo's splits don't (see "How this repo
actually splits"). **That rule would have been green through every split done so
far.** The check has to point the other way to see anything.

**3a — the report (the one with signal): a source module with no spec naming it.**

This is the check that fires on extraction, which is the split shape actually in
use. Run today it lists `rebarOps.ts`, `tupletOps.ts`, `clefOps.ts`,
`noteProjection.ts` — exactly the unfinished splits — and that is the output
wanted.

It **cannot be a hard `build:check` gate**, for two honest reasons:

- `rebarOps` *is* tested, through `ScoreModel.test.ts`. That is legitimate — this
  plan's own opening defends unchanged parent tests as the evidence behaviour
  survived. The report says "this module's spec still lives under its parent's
  name", which is a to-do, not a defect.
- Plenty of modules should never have a spec: `voiceColors.ts`, `chromeColors.ts`,
  `selectionColors.ts`, `debug.ts`, `fontStack.ts`, `layoutConfig.ts`.

Run today it is red with ~24 entries across `models/`, `utils/`, `engine/` and
`rendering/`. So: ship it as a **report** (`npm run audit:tests`), or as a gate
with an allowlist that gets shrunk deliberately, one module at a time, when
someone chooses to finish that split. Never as a wall that everyone learns to
ignore.

**3b — the cheap ratchet: a `*.test.ts` outside `__tests__/` must have a sibling
module matching its name up to the first dot.**

Same shape and spirit as `lint:boundary`, and it can be a real `build:check` gate.
Keep it, but bill it honestly: it catches only the *delete*-shaped split, where a
module is dissolved or renamed and its specs are left pointing nowhere. That has
not happened yet here. It is cheap insurance, not the payoff.

It earns its place for a second reason: it is what *identifies* the true orphans.
Whatever still fails after Phases 1–2 is Phase 4's move set, computed rather than
guessed. Land it with those orphans allowlisted, and empty the allowlist in
Phase 4.

Consequence to accept deliberately: a test whose subject lives one directory up
(`rendering/ghostContextLeak.test.ts` → `MusicEngine`) can never satisfy 3b by
renaming, so it pushes that file into `__tests__/`. That is the intended answer
under decision 5 — recorded here so it reads as a choice and not as a side effect
of the rule.

### Phase 4 — Move genuine feature tests to `__tests__/` *(deferred)*

The real orphans only — the `interactions/` scenario tests that build a
`MusicEngine` and drive controllers (`fanTravel`, `fanPress`, `tremoloEntry`,
`tremoloTravel`, `tremoloDelete`, `noteOffsetTravel`, `noteSpacingTravel`), plus
the four `rendering/` tests that import nothing but `../MusicEngine`. This is the
phase with cost:

- static relative imports go one level deeper (`@/` imports are unaffected);
- **the relative `vi.mock()` calls must move with them.** There are 28 across 14
  files — every single `vi.mock` in the repo is a relative path — and 10 of those
  files are in the candidate move set. A missed one does not error: vitest
  silently stops mocking, and the test either fails confusingly or passes for the
  wrong reason. This is the only real hazard in the plan.

**De-risk it in a separate step first:** rewrite the relative `vi.mock()` paths to
`@/` *before* moving anything. Vitest resolves the alias in `vi.mock`, so the mock
becomes path-neutral and the move cannot break it — confirm on one file, then it
is mechanical, and `grep -rn "vi.mock('\." src` returning zero over the move set
is the proof. That step is independently shippable and leaves the tree greener
even if the move never happens.

*Verify:* `tsc --noEmit`, `npm run test`, plus the grep above.

**Why deferred:** it touches the most, risks the most, and buys the least — a
shorter directory listing in `interactions/`. The extraction argument does not
support it (see above), and Phases 1–3 are expected to fix the navigation
annoyance on their own. Do this only when the listing is still annoying
afterwards, or when the score layer is actually being extracted.

Standing splits argue mildly *for* it: a feature test names no module, so it never
pays the per-split rename tax. Segregating them keeps that tax confined to the
spec set. Mildly — not enough to promote the phase.

## Status (executed 2026-07-26)

Phases 0–3 done; 2436 tests green and unchanged at every step, `build:check` clean.

- **Phase 0** — the audit confirmed the plan's own numbers exactly: 46 of 113 files homeless,
  split across the directories as tabulated above.
- **Phase 1** — 7 `engine/models/` chapters → `ScoreModel.<topic>.test.ts`.
- **Phase 2** — 27 renames, each after the module its `expect(...)` identifiers name:
  `MeasureLayout` ×6, `VexFlowRenderer` ×5, `MusicEngine` ×3, `MouseController` ×3, and one each
  for `ElementRegistry`, `playbackSchedule`, `NoteBuilder`, `HighlightController`,
  `SelectionController`, `FanEditController`, `keypadSync`, `ShortcutConfig`, `keypadPress`.
  `rendering/crossBarBeams.test.ts` turned out not to be homeless at all — its subject
  `CrossBarBeams.ts` sat beside it the whole time, differing only in case.
- **Phase 3a** — `npm run audit:tests`. Lists 23 modules in `engine/`+`utils/`+`types/` with no
  spec naming them (the predicted ~24), `rebarOps`/`tupletOps`/`clefOps`/`noteProjection` among
  them. The 51 UI-layer entries are counted, not listed — mostly one-line selector modules —
  and `--all` shows them.
- **Phase 3b** — `npm run lint:testnames`, now in `build:check` beside `lint:boundary`. It also
  fails on a *stale* allowlist entry, so the list cannot quietly stop shrinking.
- **Phase 4** — deferred, as planned. Its move set is now computed rather than guessed: the 12
  files in the 3b allowlist.

Two judgement calls to note:

- `rendering/clefWidthIndependence.test.ts` went to `MeasureLayout` per decision 4, but reading it
  it is genuinely two-subject — 7 assertions on `calculateMeasureWidths`, 7 on `laneFingerprint`
  (`MeasureWidthCache`) and the shape key. It asks one question at two layers. `MeasureWidthCache`
  is an equally defensible name.
- `rendering/staveGeometry.test.ts` stays unresolved, per decision 6: it imports `vexflow` and
  nothing else, so it has no subject in this repo to be named after. Allowlisted, not decided.

One stale pointer left deliberately: `docs/time-signature-plan.md` §Phase 0 names
`restFill.baseline.test.ts`, now `ScoreModel.restFill.test.ts`. It sits inside a dated
completion record, so it reads as history rather than as a path to follow.

## Phase 5 — a spec moves with its module (2026-07-28)

Added by `docs/modularity-plan-2026-07-28.md` Phase 0, which re-opens the stop point below on
purpose and for a different reason. Phases 1–4 were about **layout** — where a spec sits and what it
is called. This one is about **contracts**: §5 of that plan measures that the extractions moved the
*code* out and left the *tests* in the parent, so the parent spec never shrinks, still knows
everything the parent used to do, and the extracted module has no local contract at all. That is a
reason splits grow back which no amount of renaming fixes.

> **The rule: when a module is extracted, its tests are extracted with it, in the same commit.**
> A split that leaves its assertions in the parent has not finished.

The two existing scripts already point at both halves of it and neither changes: `lint:testnames`
(a spec sits beside its subject) and `audit:tests` (a module with no spec naming it). What was
missing was the rule saying whose job it is.

**Done in the first pass** — the three largest offenders `audit:tests` named, 3,150 lines of module
with no local contract between them:

| module | now specced by | how |
|---|---|---|
| `models/rebarOps.ts` (1,387) | `rebarOps.anchors` / `.spans` / `.voices` / `.timeSignature.test.ts` | 28 `it`s moved out of `ScoreModel.test.ts` (2,518 → 1,967 lines) |
| `rendering/GhostRenderer.ts` (1,017) | `GhostRenderer.contextLeak.test.ts` | renamed from `ghostContextLeak.test.ts`, and off the `lint:testnames` allowlist |
| `rendering/FanPass.ts` (746) | `FanPass.test.ts` | renamed from `VexFlowRenderer.fan.test.ts` |

Both renames are decision 4 applied one level further in: the file builds a `MusicEngine` / a
`VexFlowRenderer` because that is the only way to reach the code, but every assertion is on ink the
*extracted* module draws. The engine is the fixture. Note this shrinks the 3b allowlist by one —
`ghostContextLeak` was listed there as unable to satisfy the rule by renaming, because its subject
was read as `MusicEngine` one directory up. Its subject was sitting beside it the whole time.

What the four `rebarOps` chapters took is the relay's own contract — beat-anchored annotations
surviving a re-bar, spans re-attaching in their own voice, secondary voices not being erased, and
the re-barring itself (split-and-tie, atomic tuplets, `rewrite: 'none'`). What stayed in
`ScoreModel.test.ts` is the meter API's own: validation, propagation, the no-op, the pickup
override. Test *contents* are unchanged, per decision 7 — the blocks moved verbatim, with the
imports and the two describe wrappers they need.

Still owed a spec, largest first (`npm run audit:tests` for the current list): `PlaybackEngine`
(347), `tupletOps` (345), `DynamicsLayout` (320), `TieRenderer` (277), `outlineText` (258),
`beatMap` (249), `MeasureRedrawKey` (213), `ScoreTuplet` (193) — 26 in the logic layers. Work it
largest first, one module per commit; `types/music.ts` is not on this list in spirit (it is a
vocabulary file, and the modularity plan rules out splitting it).

## Stop point

Phase 3. Phase 4 on demand. No further test reorganisation, no changes to test
contents, no new test infrastructure.

Each phase is independently shippable and independently revertable.

## Rejected

- **Top-level `tests/` mirror** — decision 2 above.
- **Moving the co-located specs** — pays the cost twice (now, and again at the
  next restructure) and discards the property that makes them useful during a
  split.
- **Classifying by filename** — measured, and wrong at least twelve times.
- **Classifying by dominant import** — measured, and wrong on all four
  `MeasureLayout` specs in `rendering/`; see decision 4.
- **"A spec with no sibling module" as the split-completion detector** — checked
  against the history and green through every split this repo has done, because
  the parent always survives. Kept as a cheap gate (3b), demoted as a signal; the
  detector that works points the other way (3a).
- **Moving `models/tremoloPair.test.ts` and `models/restFill.baseline.test.ts`
  into `utils/`** — an earlier draft of this plan proposed exactly that. Their
  imports say `ScoreModel`; only their filenames say `utils`. See decision 4a.
- **VS Code file-nesting as the whole answer** — worth trying first as a
  zero-cost experiment (it collapses matching specs out of the sidebar), but it
  is editor-local, invisible to anyone else, and does nothing for the names that
  point nowhere.
