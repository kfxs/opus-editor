# Slurs by SEARCH — LilyPond's solver as a preset, then the default (2026-09-27)

His ask, 2026-09-27: *"make another preset with real lilypond solution and set it as default (if the
preset we have now has lilypond name we should rename cause is not really lilypond)"* — after the
measurements below, and *"in your opinion lilypond solution can be done in real time?"* (answer: yes,
to be PROVED by P0's benchmark, not argued).

## 1. Why — what was measured (Chromium, his three examples, 2026-09-27)

Slur B4 → G5 over `B4 E(♭)5 | A4 D5 G5`, one staff and then with eighths on a second staff:

| case | flat's left edge from slur start | slur vs flat | arch above chord, middle | peak above staff |
|---|---|---|---|---|
| 1 staff, E♮ | — | — | 1.78 sp | 2.25 sp |
| **1 staff, E♭** | **1.81 sp** | **1.1 sp INTO it** | 1.78 (unchanged) | 2.25 |
| 1 staff, E♭, HIS hand shape | 2.06 | clears by **0.20** | 2.24 | 3.32 |
| 2 staves, E♮ | — | — | 1.45 | 2.02 |
| **2 staves, E♭** | **3.63 sp** | clears by 1.15 | **3.74** | **4.02** |
| 2 staves, E♭, HIS hand shape | 3.63 | clears by **0.20** | 2.05 | 2.76 |

- The second staff changes nothing about the slur itself: its eighth at beat 2½ adds a COLUMN, which
  widens B4 → E♭5 from 3.6 to 5.4 sp and carries the flat across `SLUR_EDGE_DISCOUNT_SPACES` (2.5 sp).
- Inside 2.5 sp the flat is IGNORED (example 1 collides); outside it the solver's only answer is ONE
  factor over the whole arch (`curves/slurObstacles.slurArchFit`) — and a cubic is pinned at its ends,
  so clearing something near an end costs a huge factor (×2.6). A THRESHOLD feeding a ONE-KNOB response:
  that is the abrupt jump.
- ⭐ His two hand shapes do the same two things: **raise the near endpoint** (0.5 / 0.75 sp) and **lean
  the arch toward the obstacle** (left control 3.7–4.2 sp, right 1.8). Our solver can do neither.
- The accidental is measured correctly already (one point at the flat's ascender, full height —
  `curves/slurAccidentalPoint`, LilyPond's own rule). ⛔ The fault is the RESPONSE, not the measuring.

## 2. What LilyPond does (read at source, `~/dev/engine-sources/lilypond`)

It does not solve one curve — it SEARCHES:

1. **Attachment range** — each end from its base attachment outward, up to `region-size` 4
   (`lily/slur-scoring.cc` `get_y_attachment_range`, `:286-328`).
2. **Enumerate** every (left, right) pair in HALF-SPACE steps (`enumerate_attachments`, `:721-800`),
   moving an end onto the stem / head as the pair's slope requires.
3. **One curve per pair** (`Slur_configuration::generate_curve`, `lily/slur-configuration.cc:136-206`):
   the bow of `height-limit` / `ratio`, raised by `fit_factor` over the avoid-points (edge-discounted,
   `:93-132`), capped at `max_h` so a spike cannot be drawn.
4. **Score every candidate** with demerits (`score_encompass`, `score_extra_encompass`, `score_edges`,
   `score_slopes`, `:233-529`): heads under the curve 1000, stems 30, extra objects — ACCIDENTALS 3,
   other objects 50 — graded by distance inside `extra-encompass-free-distance` 0.3 sp (`peak_around`),
   the ends' distance from their notes (`edge-attraction-factor` 4), slope vs the music (`non-horizontal`
   15, `same-slope` 20, `steeper-slope-factor` 50). Defaults: `scm/layout-slur.scm:19-44`.
5. **Pick the cheapest, lazily** — a priority queue; each candidate runs its scorers one at a time and
   the search stops once the best FINISHED candidate beats every partial one (`slur-scoring.cc:435-460`,
   `run_next_scorer` / `done()`).

⭐ So an accidental near an end is never answered by blowing up the arch: a candidate whose end is half
a space higher simply scores lower and wins — his hand shape. And the accidental's demerit grows
SMOOTHLY with nearness, so a small spacing change is a small slur change.

⚠️ **Licence:** LilyPond is GPL-3.0-or-later; this project is AGPL-3.0-or-later (`package.json`,
`LICENSE`) — GPLv3 §13 permits the combination, so this is a PORT (as VexFlow was): each ported function
names the LilyPond function it transcribes, and `NOTICE` gains a LilyPond section. ⛔ Not in P2's commit
without that section.

## 3. The two presets

| preset | what it is |
|---|---|
| **`house`** | ⭐ TODAY'S PIPELINE, renamed — our endpoint rules, arch law, lean, `slurArchFit`'s one factor, the edge discount. ⛔ No pixel moves. |
| **`lilypond`** | ⭐ NEW — §2, the whole search. **The default at P5, his word.** |

⚠️ The existing `__slur.law('lilypond')` is the HEIGHT LAW alone (`curves/slurShapeExperiment`,
`bezier-bow.cc`'s `slur_height`, transcribed and verified to 0.01) — ⭐ it IS LilyPond's formula, so the
row keeps its name (✅ his decision, 2026-09-27, §7 A); it is the `house` PRESET that was never LilyPond.

Both presets are a ROW in one table (`SLUR_SOLVERS`), armed from the console as `__slur.solver('house' |
'lilypond')` beside `__slur.law`, in the render's view key (`slurShapeGeneration`) so a switch redraws.
⛔ Hand edits are untouched by either: a `curveShape` override opts out of the solver, and the endpoint /
whole-curve offsets are applied AFTER it, as today (`SlurRenderer`, the "solved from the engraver's ends"
rule).

## 4. Phases — each its own commit, each stops for his eye

- **P0 — the net and the stopwatch. ⛔ No behaviour change.**
  - `e2e/slurSearch.e2e.ts`: his three examples (one staff ♮/♭, two staves ♮/♭) with today's numbers
    pinned from §1 — the `house` baseline.
  - Per-slur solve time from the render census (`__census`), on his heaviest real score (the 1ère
    Gymnopédie) and a synthetic page of 50 slurs: today's cost, the number P4 is judged against.
  - ✅ **BUILT 2026-09-27** (`e2e/slurSearch.e2e.ts`, `__h.timePart`): all six §1 rows reproduce to
    0.01 sp and are pinned. Today's cost (median of 21 renders, `curves` part with − without slurs, over
    the slurs drawn): **Gymnopédie 0.60 ms/slur** (10 slurs, long, two staves) · **50-slur page
    0.20 ms/slur**. This machine's numbers — logged by the spec, not asserted.
- **P1 — the seam. ⛔ No pixel moves.** `SLUR_SOLVERS` table with `house` = today's code moved behind
  the row; `__slur.solver`; the default stays `house`. P0's net must pass byte-for-byte.
  - ✅ **BUILT 2026-09-27**: `curves/slurSolvers` (the table, the armed row, `slurViewGeneration` in the
    view key — the preset and the shape experiment as ONE number, so the hub gained nothing) +
    `curves/slurHouseSolver` (`slurArchCps` + the fit, moved from `SlurRenderer` unchanged). A solver gets
    the ENGRAVER's ends and may move them; `SlurRenderer` carries a moved end back as a DELTA, so `house`
    adds an exact 0. P0's net + `slur`/`slurAfterMove`/`trill` e2e pass; stopwatch unchanged (0.21 / 0.62).
- **P2 — the search, pure** (`engrave/curves/slurSearch/` — ⛔ no DOM, no renderer; unit-tested in
  jsdom on plain numbers): the state (base attachments, encompass points per head/stem, extra objects —
  accidentals as today's POINT, articulations by their avoid type), `enumerate`, `generateCurve`
  (bow + fit + `max_h`), the four scorers, the lazy queue. Every parameter a ROW in one table
  (`SLUR_SEARCH_DETAILS`, LilyPond's defaults, each citing `layout-slur.scm`) — CLAUDE.md's rule: a
  number is a default, never a constant. + the `NOTICE` section.
  - ✅ **BUILT 2026-09-27** — `engrave/curves/slurSearch/`: `bezier` (LilyPond's Interval/Offset/Bezier + the
    polynomial roots, in Cardano's ORDER — `get_other_coordinate` takes the first) · `searchDetails`
    (`LILYPOND_SLUR_DETAILS`, all 25 details + the grob's height-limit/ratio/minimum-length/thickness +
    line-thickness 0.1) · `searchState` (`fill`, unbroken) · `searchCurve` · `searchScore` · `slurSearch`
    (the lazy queue; ties broken by INDEX). In LilyPond's space — staff spaces, **y UP**, dir +1 above.
    46 specs; ⭐ the lazy queue equals brute force on 5 cases. Pure compute 0.21–0.27 ms/slur (Node).
  - 🔎 **Found while porting, for P3:** LilyPond hands a slur only `avoid-slur: inside` objects (+ ties) —
    `around`/`outside` ones (most ARTICULATIONS) are not obstacles: the OBJECT is moved outside the slur
    (`Slur::auxiliary_acknowledge_extra_object`, `outside_slur_callback`). So P3 must say which of ours
    are `inside` (accidentals, dots, ties, tuplet numbers, header signs) and leave the rest to their own
    passes — ⛔ not feed every articulation to the search.
  - 🔎 **His one-staff E♭ on a hand-measured fixture:** the search keeps the base ends and GRAZES the flat by
    0.26 sp (house: 1.12 into it; his hand: clears by 0.20). LilyPond's own weights: a collision with an
    accidental costs 3, moving the near end the ~1.5 sp that would clear the ascender costs more. ⚠️ A
    fixture, not his page — P4's pictures decide; `accidentalCollision` is a row if his eye disagrees.
- **P3 — wired, single-system slurs** behind `__slur.solver('lilypond')`: the renderer builds the state
  from what it already knows (heads, stems, `slurObstaclesOf`'s objects, the stave lines), the search
  answers the endpoints + control points, then the hand's offsets as today. Broken (multi-system) slurs
  stay `house` in this phase — named in the code.
- **P4 — measure, both ways.** Time: under ~0.5 ms per slur on P0's pages, else add a per-slur cache
  keyed by its inputs before going further. Shape: his three examples + the whole slur e2e suite under
  both presets, side by side — the differences REPORTED, ⛔ not "fixed" toward the old pictures.
  → **his eye.**
- **P5 — the default** (his word at P4): `lilypond` becomes the default; `house` stays selectable.
- **P6 — broken slurs** under the search (LilyPond scores each system's piece; ours are `planSpanSegments`
  fragments). Then the bent staff (`eye/spineCurves`) can ask it too.

## 5. What this does NOT change

The slur's SIDE (`slurDirection`), its thickness and taper, ties (`TieRenderer` has its own formatter —
LilyPond's `tie-formatting-problem.cc` is a different search, a later question), the Properties
controls, the JSON. ⛔ Nothing here re-decides an endpoint rule he has already signed off
(`slurStemEndpoint`, `slurArticulationEndpoint`) for the `house` preset.

## 6. Risks, named

- **Cost on long, dense slurs** — hundreds of objects under one slur. P4's cache, then a cap: score a
  sample first, the full set only for the best few candidates.
- **The search's own taste** — LilyPond's weights are its house style, not a law (no book gives these
  numbers, `docs/research/slur-tie-research.md` §8.4). They are rows; his eye tunes them.
- **Interaction with what we built after LilyPond**: the nest lift, trills above a slur
  (`docs/plans/trill-slur-clearance-plan.md`), slurs to graces and fan members. Each read under the new
  preset in P4.

## 7. Open — his calls, one at a time

- ✅ **A. DECIDED (2026-09-27):** the height-law row keeps its name `'lilypond'` — it is LilyPond's formula.
- **B.** At P5, should an EXISTING score's slurs re-shape under the new default, or should a score keep
  the preset it was made with? (Suggested: re-shape — a preset is a view setting, not stored.)
