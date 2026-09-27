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
  - ✅ **BUILT 2026-09-27** — `curves/slurSearchProblem` (the adapter: drawn heads/stems/beams → columns;
    accidentals, dots and articulations → objects, by `ARTICULATION_AVOID`: staccato + tenuto `inside`,
    ⚠️ accent `around` — OURS, LilyPond moves an accent instead) + `curves/slurLilypondSolver` (the row; the
    winning cubic back as our ends + cps; ⛔ never nothing — `house` when the slur cannot be stated: a
    fanned member at an end). ⏭️ Not handed over yet: tie ends, tuplet numbers, NESTED slurs (no nest lift
    under this preset), a column's flag. Measured (Chromium, `e2e/slurSearch.e2e.ts`): 1 staff ♭ arch 2.53 /
    grazes −0.17 (house −1.12) · 2 staves ♭ arch **1.87** (house 3.74) / −0.02. Cost 0.50 ms/slur (50-slur
    page) · 0.78 (Gymnopédie) vs house 0.21 / 0.69. ⭐ Deterministic: save → load draws the same `d`.
- **P4 — measure, both ways.** Time: under ~0.5 ms per slur on P0's pages, else add a per-slur cache
  keyed by its inputs before going further. Shape: his three examples + the whole slur e2e suite under
  both presets, side by side — the differences REPORTED, ⛔ not "fixed" toward the old pictures.
  → **his eye.**
  - ✅ **MEASURED 2026-09-27.** ⏱ Time: uncached 0.50 ms/slur (50-slur page) · 0.78 (Gymnopédie) > 0.5 ⇒ the
    cache was added (`slurLilypondSolver.cachedSlurSearch`, keyed by the whole stated problem + the details
    table): **0.29 · 0.65**, level with house's 0.21 · 0.63. A miss (a slur whose notes moved) still pays the
    uncached cost. ⭐ `PW_SLUR_SOLVER=lilypond npm run test:e2e` runs the net under the preset.
    Shape — under `lilypond`, 122 of 127 slur/ladder/trill/tie/ottava/fan/cue/staff-size specs pass; the 5
    that differ are `house`'s ENDPOINT rules, which this preset does not run:

    | `e2e/slur.e2e.ts` case | house | lilypond | why |
    |---|---|---|---|
    | rising step A4→B4 | +0.25 sp | +0.65 | Gould p. 111's half-interval tilt is house's |
    | falling step B4→A4 | −0.25 | −0.65 | same |
    | rising tenth C4→E5 | +2.25 | **+4.35** | LilyPond allows the music's own rise (+0.2) |
    | two whole notes, a sixth | 2.5 | 2.35 | LilyPond's 0.15 sp nudge off a staff line |
    | two whole notes, a second | 0.5 | 0.35 | same |

    Pictures (12 cases side by side): ⭐ the WIDE arch (G4→G6 over two bars) — house's giant arch, lilypond a
    long low one that clears; his 2-staff E♭ much flatter; ⚠️ NESTED slurs touch (no nest lift yet — §6);
    ⚠️ the curve runs close to an accent and to a staccato at an end. → **his eye.**
  - ⭐ **HIS VERDICT (2026-09-27):** *"good to have lilypond, I'm not convinced yet, for somethings i like more
    house for other i like more lilypond we should try to find a compromise in the future"* — and `lilypond`
    becomes the default **for a while**, to see it on more of his examples. ⏭️ The COMPROMISE is open, his
    call; ⛔ neither preset is to be tuned toward the other until he says what he liked in each.
- **P5 — the default** (his word at P4): `lilypond` becomes the default; `house` stays selectable.
  - ✅ **DONE 2026-09-27** — `DEFAULT_SLUR_SOLVER = 'lilypond'`, *"for a while to check more examples"*. The
    `house` baseline (P0) and the tilt specs in `e2e/slur.e2e.ts` arm `house` themselves; the whole e2e net
    passes under the new default (350). `__slur.solver('house')` brings the old picture back.
- **P6 — broken slurs** under the search (LilyPond scores each system's piece; ours are `planSpanSegments`
  fragments). Then the bent staff (`eye/spineCurves`) can ask it too.
  - ✅ **BUILT 2026-09-27.** Each preset row has a `piece` solver beside `whole`; the pure search takes
    `brokenX` (the no-column branch of `get_base_attachments`, the full region at a break, `musical_dy_` 0 and
    the three slope demerits off, no staff-line nudge). The hand's moves (`hands`) are added back to the ends
    the search picks. ⭐ **HIS ASK:** a broken slur has its OWN preset — `__slur.brokenSolver(…)`, default
    **`house`** (he saw `lilypond` get the Gymnopédie's broken slurs wrong). Found: `lilypond` does not lean an
    open end toward the next system's pitch (Gould p. 112 is house's `brokenSlurTilt`; its spec arms `house`).
    Also fixed in the adapter audit: a stemless note is handed over with an INVISIBLE stem, as LilyPond has one
    (it was read as a rest, half a head to the left).
  - 🔎 **For the COMPROMISE (his screenshots, 2026-09-27):** (a) D5 → G5 dotted half, both stems up, slur above:
    `lilypond` ends at the HEADS (each space an end moves costs 4, ÷5 with a stem pointing its way, and
    nothing between the notes forces it up) where house goes to the stem (Gould p. 111). (b) the same kind of
    end lands BESIDE THE STEM on one system and OVER THE HEAD on another — `enumerate_attachments` moves an end
    beside the stem only while its y is within ¼ sp of the stem, so a small height difference is a sideways
    jump. ⏳ The source audit is checking both against LilyPond itself.
- **P7 — hand the search what the adapter still leaves out** (`curves/slurSearchProblem`; the pure search
  already handles each — only the READING is missing). ⭐ Ties first: his Gymnopédie slurs cross tied notes.
  1. **Ties** — each drawn tie under the slur as an `inside` OBJECT (the arch clears it; 50 within 0.3 sp),
     and its two ends as `tieEnds` (a slur end within 0.2 sp of one costs 2 — `score_extra_encompass`).
     Read from the ties this render already drew (they are drawn before the slurs).
  2. **Nested slurs** — an inner slur's drawn curve as a `nestedSlurs` entry (its middle raises the outer arch
     by `free-slur-distance` 0.8; its shared ends are scored). ⚠️ Needs the inner slur drawn FIRST.
  3. **Tuplet numbers** — `inside` objects (LilyPond's `TupletNumber` is `avoid-slur: inside`).
  4. **A note's FLAG** — united into its end stem's extent (`Bound_info.stem_extent_`).
  5. **What the source audit (2026-09-27) finds** — each divergence from LilyPond fixed or recorded here.
  ⭐ **AS A NEW PRESET, `lilypondFull`** (his word, 2026-09-27: *"as new presets in every case so we dont lose
  what we have now"*) — selectable for both `__slur.solver` and `__slur.brokenSolver`; ⛔ `lilypond` keeps
  drawing exactly what it draws now. ⛔ No weight is tuned here — that is the compromise, his call.

  **The source audit (2026-09-27, read-only, against LilyPond 2.27.3):** ✅ the PURE port
  (`engrave/curves/slurSearch/`) matches line by line — no semantic divergence. ⭐ Both of his dislikes are
  LilyPond's OWN behaviour, traced through its code: (a) two unbeamed stems-up notes, slur above → the ends
  stay at the HEADS (the stem tip is used only when a beam leaves it inward, `slur-scoring.cc:549-554`; the
  head candidate scores 0, the stem-tip one ~5.0 in edge demerits); (b) the end lands beside the STEM on one
  system and over the HEAD on another — `enumerate_attachments`' four x regimes (`:742-791`: within the stem
  ±¼ sp → the stem's edge ∓0.3; above the tip → the stem's centre; span < 1.5 or slope > 1.1 → head centres;
  else the tilt shift), so spacing flips an end between them. ⇒ P7 will NOT change either; they are the
  COMPROMISE's. Every real gap is in the ADAPTER — so P7's list, from the audit:
  6. **The FLAG** (= item 4) — without it a slur from a flagged stem-up note starts ~1 sp too far LEFT
     (`:751` attaches past the flag's right edge).
  7. **Also not handed over:** fingerings, text, and a clef / key / meter change inside the slur (LilyPond's
     `inside` objects; `headerSign` is never set).
  8. **The end head's own x** — ours is the chord's head span; LilyPond uses the extremal head's extent and
     `first_head` — off by up to a head width on a chord with a displaced second. And its y is ±½ sp, not the
     glyph's extent.
  9. **Rests** — a rest column is handed over like a note; LilyPond reads a rest column with no stem. Check.
  10. **The ink** — LilyPond CENTRES the slur's ink on the solved curve (`lookup.cc:403-415`); ours bows the
      fill outward from it, ~0.06 sp further from the notes. Low impact.

- **P8 — a SWITCH PER CASE: the compromise, one row at a time** (his word, 2026-09-27: *"so we should have a
  preset for every case"*). Each behaviour he has compared becomes its own row with its own `__slur` switch,
  so the compromise is a choice per row, not a whole preset. The two presets stay as shortcuts. ⭐ Each row's
  DEFAULT is what draws today; ⛔ no row changes a picture until he arms it. P7's items become rows (G) instead
  of a separate `lilypondFull` preset.

  | row | case | `house` does | `lilypond` does |
  |---|---|---|---|
  | **A** | an unbeamed end on the STEM side (his D → G) | the stem end (Gould p. 111) | stays at the head (`slur-scoring.cc:549-554`) |
  | **B** | where that end stands in x | one rule | four regimes (`:742-791`) — can jump stem ↔ head |
  | **C** | how much the slur tilts with the melody | half the interval (Gould p. 111) | the whole (music's rise + 0.2) |
  | **D** | a broken slur's OPEN end | leans toward the next pitch (Gould p. 112) | level |
  | **E** | an accidental near an end | one arch factor | a different pair of ends |
  | **F** | articulations at the ends | clears every mark on the end note | per `avoid-slur` (+ his T1 rule) |
  | **G** | ties, nested slurs, tuplet numbers, flags, fingerings/text, header signs | not avoided | P7's list — on / off |

  ⚠️ A row is a choice INSIDE the search (`engrave/curves/slurSearch`, `SlurSearchRules`) — ⭐ it acts wherever
  the search runs (the `lilypond` preset, whole and broken). `house` is the fixed reference its `house` column
  describes; ⏭️ making `house` read the rows too is a later question.

  - ✅ **Row A BUILT 2026-09-27** — `SlurSearchRules.stemSideEnd: 'head' | 'stem'` (`searchDetails`), armed by
    `__slur.rule('stemSideEnd', 'stem')` (`curves/slurRules`; `__slur.rule()` lists the rows). `'stem'` moves
    where an end is ATTRACTED (`edgeTargets`, read by `score_edges`) to ½ sp past the tip of a stem pointing the
    slur's way; ⭐ the candidates are unchanged, so the other demerits can still pull an end down its stem.
    His D → G draws to the stem ends under `'stem'`, to the heads under `'head'` (the default). The cache key
    carries the rows. ⚠️ A cue/grace note's stem is read as drawn.
  - ✅ **Row B BUILT 2026-09-27** — `SlurSearchRules.endX: 'lilypond' | 'house'`, `__slur.rule('endX', 'house')`.
    `'house'` = `slurStemEndpoint.stemDodge` inside the search: every candidate end at its head's CENTRE, stepped
    `houseStemClearance` (0.35, a detail row) past the head's edge only when it is alongside a stem on the
    slur's INNER side (an up stem at the start, a down stem at the end) — no stem-centre regime, no short/steep
    fallback, no tilt shift, so an end cannot jump with spacing. Default `'lilypond'`.
  - ✅ **Row C BUILT 2026-09-27** — `SlurSearchRules.tilt: 'lilypond' | 'house'`, `__slur.rule('tilt', 'house')`.
    `'house'` (Gould p. 111): over OPPOSITE end stems, `score_slopes`' allowance is half the music's rise + 0.2
    instead of the whole — the same 50-a-space demerit pulls the slur down; agreeing stems keep LilyPond's.
    Chromium: rising step 0.65 → **0.15** sp (house 0.25), rising tenth 4.35 → **2.35** (house 2.25).
  - ✅ **Row D BUILT 2026-09-27** — `SlurSearchRules.openEnd: 'lilypond' | 'house'`, `__slur.rule('openEnd', 'house')`
    (acts when broken slurs run the search: `__slur.brokenSolver('lilypond')`). The renderer hands the search
    `house`'s lean of each open end (`brokenSlurTilt`, via `openRise`); under `'house'` the open end is ATTRACTED
    there (`edgeTargets`), outward from the note end's base. Chromium (whole notes, the break between):
    `'lilypond'` rises 0 whether the music goes up or down; `'house'` **2.0 / 0.5** sp (the house preset: 2.0 /
    1.0 — the search's other demerits settle the low one lower). A middle piece has no note end — unchanged.
  - ✅ **Row E BUILT 2026-09-27 — REFRAMED:** `SlurSearchRules.accidental: 'lilypond' | 'clear'`,
    `__slur.rule('accidental', 'clear')`. ⚠️ Not `house`'s answer (one arch factor — the search's `fit_factor`
    already is that, and it drew the giant arch he rejected). The real difference from his hand shapes is the
    PRICE: LilyPond charges an accidental 3, so a graze is cheaper than moving an end; `'clear'` charges it
    `extra-object-collision-penalty` 50 like any object. Chromium, his E♭: 1 staff −0.17 → **+0.60** sp (arch
    2.53 → 1.19), 2 staves −0.02 → **+0.52** (arch 1.87 → 1.23); his hand shapes +0.20 / arch 2.24 · 2.05.
    ⚠️ On one staff the near end rises more than his hand did (0.75) — for his eye.
  - ⏭️ **Row F SKIPPED — his call, 2026-09-27:** *"we skip articulation, we will do the articulation plan that is
    correct"*. Articulations at a slur's ends belong to `docs/plans/articulation-plan.md` (T1 + L2: the marks
    themselves move), ⛔ not to a slur row.
  - ✅ **Row G, TIES, BUILT 2026-09-27** — `SlurSearchRules.ties: 'off' | 'on'`, `__slur.rule('ties', 'on')`. Each
    drawn curve on `RenderPass.drawnCurves` now carries its `kind` (`'tie'` / `'slur'`); the adapter hands the
    search the ties on the slur's staff and system whose RIGHT end falls within the slur (LilyPond
    END-acknowledges ties); under `'on'` each is an `inside` object (the arch clears it, 50 within 0.3 sp) and its
    ends are forbidden attachments. Chromium, a slur over a tie: closest approach 0.11 → **0.46** sp.
  - ✅ **Row G, NESTED SLURS, BUILT 2026-09-27** — `SlurSearchRules.nested: 'off' | 'on'`,
    `__slur.rule('nested', 'on')`. A drawn slur files its CUBIC and its two notes on `drawnCurves`; under
    `'on'` the renderer draws slurs innermost first (by `slurNestDepths`; ⛔ `'off'` keeps the score's order),
    and the adapter hands each slur the drawn slurs lying inside its span, with whether they share its end
    notes → LilyPond's `nestedSlurs` (the middle + 0.8 sp raises the arch; the curve is scored). Chromium, C5 …
    G5 over D5 → E5: closest approach 0.29 → **0.65** sp.
  - ✅ **Row G, FLAGS, BUILT 2026-09-27** — `SlurSearchRules.flags: 'off' | 'on'`, `__slur.rule('flags', 'on')`. The
    adapter hands each flagged note its flag (`getFlagWidthPx`, right of the stem, along it); under `'on'` it is
    united into the end's stem extent (LilyPond's `Bound_info`). Chromium, a flagged stem-up eighth starting a
    slur above: the start moves **1.02 sp** right, past the flag (the audit's "~1 sp").
  - ✅ **Row G, TUPLET NUMBERS, BUILT 2026-09-27** — `SlurSearchRules.tupletNumbers: 'off' | 'on'`,
    `__slur.rule('tupletNumbers', 'on')`. `ScoreTuplet` now keeps the MARK's box it drew (`markBox()`, the text's
    box on its baseline) with its notes; the adapter hands the search each mark over the slur's notes, and under
    `'on'` it is an `inside` object. Chromium, a slur over an eighth triplet: `'off'` ran THROUGH the '3' (0.46 sp
    below its baseline) → **1.81 sp above** it. ⚠️ A reused bar that the render shifted keeps its old drawn box —
    the same caveat the notes under a slur already have.
  - ✅ **Row G, CLEF / KEY / METER CHANGES, BUILT 2026-09-27** — `SlurSearchRules.headerSigns: 'off' | 'on'`,
    `__slur.rule('headerSigns', 'on')`. The renderer hands the adapter the registry boxes of the clef, key and
    meter signs on the slur's staff and system; those standing INSIDE the slur's span (the system's own opening
    signs fall left of a break edge) go to the search as `inside` objects marked `headerSign` — scored and raising
    the arch, ⛔ never widening an end's range (`fill`'s exclusion). Chromium, G4 → A4 across a 3/4, slur above:
    through the digits by 0.54 → **clears by 0.46** sp. ⚠️ A SMALL staff's slur asks for none (the registry's
    boxes are in SVG space — named, not guessed).
  - ⛔ **Row G, FINGERINGS / TEXT — dropped, with the reason:** LilyPond's `Fingering` and `TextScript` are
    `avoid-slur: around` — it MOVES them outside the slur, they are never the slur's obstacles (the audit listed
    them wrongly). The editor has no fingerings; text marks are placed by the outside-staff ladder, which already
    reads the drawn slurs. Moving a mark for a slur is the articulation plan's L2, not a slur row.
  - ✅ **`midAccent` BUILT 2026-09-27 — his T1 rule for a MIDDLE accent**, default `'inside'` (not LilyPond's
    `'lilypond'`); see `docs/plans/articulation-plan.md` T1 for the sweep that found it.

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
  the preset it was made with? ✅ Re-shape, as built — a preset is a view setting, not stored; his *"make
  lilypond default for a while"* (2026-09-27).
- ⏭️ **Articulations at a slur's ENDS** — his rule (staccato/tenuto inside, an accent outside at the ends) is
  a TODO in `docs/plans/articulation-plan.md` T1; it touches both presets.
