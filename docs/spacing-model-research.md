# Horizontal spacing — what the tradition and the other engines actually do

> Research for `docs/spacing-model-plan.md` (⭐⭐ the standing priority: *this editor has no spacing
> rule*). **Findings only** — nothing here is a decision. Every number is sourced; where a number
> was measured in this repo today it says so.

## 1. Gould's table, verbatim

*Behind Bars*, p. 39, "Rhythmic spacing" — the paragraph and the figure, quoted in full because
everything below is measured against it:

> Musicians rely heavily on good spacing to read rhythm. Poor horizontal spacing is often the main
> problem of badly presented music and hinders the reading of it.
>
> **Durations should be spaced in relative proportion to each other, each value taking only a little
> more space than the next shortest value** (units of relative measurement are given as a guide to
> the spacing proportions):

The figure's "number of units per note-value" is a run of eight values, `2 · 2¼ · 3 · 3½ · 4 · 5 ·
6 · 7`, over durations in the ratio `1 : 2 : 3 : 4 : 6 : 8 : 12 : 16` — i.e. **the dotted values are
in the table too**:

| note value | Gould units |
|---|---|
| 𝅘𝅥𝅯 16th | 2 |
| ♪ 8th | 2¼ |
| ♪. dotted 8th | 3 |
| ♩ **quarter** | **3½** |
| ♩. dotted quarter | 4 |
| 𝅗𝅥 half | 5 |
| 𝅗𝅥. dotted half | 6 |
| 𝅝 whole | 7 |

⭐ **The unit is the staff space.** Three independent confirmations: the quarter's 3½ is the number
Sibelius ships as its *reference* width, it is the number MuseScore 4 hard-codes
(`DEFAULT_QUARTER_NOTE_SPACE = 3.5_sp`), and Ross's engraving manual is cited for the same 3½ for a
quarter — which is also ~3½ × ¹⁄₁₆ inch, the traditional engraver's unit.

She then adds the sentence that kills any literal proportional reading:

> Note-values and rests are spaced in exact mathematical ratio **only** when metrical notation is
> superseded by literal time-space notation.

So: **spacing is monotonic in duration and strongly compressed.** Twice the duration is nowhere near
twice the space (quarter → half is ×1.43, not ×2), and at the short end the table nearly flattens
(16th → 8th is only ×1.125) because a notehead plus a legible gap is a hard floor.

## 2. The four engines, reduced to one formula each

Every mature engine computes **space-following-an-event as a function of its duration alone**, then
takes a **maximum against a collision-driven minimum**. They differ only in the curve.

| engine | law | per-doubling ratio |
|---|---|---|
| **Dorico** | power: `s ∝ t^0.5` (its "spacing ratio" default is **1.41** = √2) | 1.41 |
| **MuseScore 4** | power: `s = 3.5sp × slope^log2(t / quarter)`, `slope = Sid::measureSpacing` (ships **1.5**) | 1.5 |
| **Verovio** | power: `s = (t_wholes × 1024)^nonLinear × linear × 10`, defaults `nonLinear 0.6`, `linear 0.25` | 1.52 |
| **LilyPond** | log: `s = (2.0 + log₂(t / shortest)) × 1.2sp`, and a *linear* branch `(2.0 + ratio − 1) × 1.2sp` below the shortest | 1.5 → 1.25 (falls) |
| **Sibelius** | a hand-tuned **lookup table**, quarter = 3.5sp reference | ~1.31–1.38 |
| **Finale** | power with the golden ratio (measured 1.6179) | 1.618 |

Sibelius's shipped table, for calibration (spaces): 32nd 1.41 · 16th 1.94 · 8th 2.53 · **quarter
3.5** · half 5.94 · whole 8.19 · breve 10.56. Its origin is reported as a mathematical ratio that
was then *fine-tuned by eye against classic European engravings* — which is the honest account of
where any of these numbers come from.

### ⭐ The one that reproduces Gould is `s = 3.5sp × √(t / quarter)` — but LilyPond's is the one we SHIP

🚨 **Decided by eye, 2026-07-30, after the model was drawing:** *"dense passages seem too tight to
me, LilyPond numbers sound better"*, and the standing preference *"in general we should approximate
to LilyPond as much as possible."* The square root below is still the closer fit to **Gould's**
table and is still in the code (`GOULD_SPACING`); what ships is the **log** law in the row beneath
it. The reason is the last column of the comparison table further down: a power law's spread between
the longest and shortest note on a page grows without bound, a log law's does not
(5.6 → **4.0**), and that spread is what a reader of dense music feels. See
`docs/spacing-model-plan.md` §1.0.

Put the five side by side, in staff spaces, all anchored so the quarter is 3½:

| | Gould | Sibelius | LilyPond | MuseScore 4 (1.5) | **√2 (Dorico)** |
|---|---|---|---|---|---|
| 32nd | – | 1.41 | 1.5 | 1.03 | 1.24 |
| 16th | 2 | 1.94 | 1.8 | 1.55 | 1.75 |
| 8th | 2¼ | 2.53 | 2.4 | 2.33 | 2.47 |
| **quarter** | **3½** | 3.5 | 3.6 | 3.5 | **3.5** |
| half | 5 | 5.94 | 4.8 | 5.25 | 4.95 |
| whole | 7 | 8.19 | 6.0 | 7.88 | **7.0** |

The square root lands on Gould's whole note exactly, on her half within 1%, and on her quarter by
construction.

⚠️ **Corrected 2026-07-30 (review).** The next sentence used to read "it diverges only where her own
table flattens (16th, 8th) — the short-note floor talking". Measured, the divergences are 16th
**−12.5%**, 8th **+10.0%**, dotted quarter **+7.2%**, everything else within 1%. A floor can only
push a value *up*, so it explains neither the 8th (where the curve is already wider than Gould) nor
the dotted quarter, and — at ~1.43 spaces of notehead-plus-padding — it does not even reach the
curve's 16th at 1.75. The cause is in her own numbers: her 16th→8th step is ×1.125 while her
8th→♩ step is ×1.556, so **no single ratio fits both**. √2 splits the difference and remains the best
of the five laws above; the short-note floor is a real and separate mechanism (Dorico and MuseScore
ship it as "Minimum space for short notes", LilyPond as the linear branch below the common shortest
duration) but it binds at the **32nd and shorter**, not at the 16th. See `docs/spacing-model-plan.md`
§1.1 for the table.

MuseScore's spacing paper reached the same conclusion from the other end: fitting a curve to Gould's
points, the best fit is `s = 1 − 0.777 + 0.777·√t`, and its author noticed that Dorico's published
1.41 *is* √2 and therefore a square-root law. Two independent readings of the same table.

## 3. The second half nobody skips: extents and minimum distances

Duration gives the **ideal** space. What an event *draws* gives the **minimum**, and the two are
combined as a max, never conflated (Gould's two facts, §1 of the plan doc).

- **MuseScore 4** gives every segment a `Shape` (the union of its items' rects, per staff) and
  computes `minHorizontalDistance(shapeA, shapeB)` as a max over item pairs of
  `a.right − b.left + padding(typeA, typeB)`, where `padding` comes from a **table keyed by the two
  element types** and is skipped when the two do not overlap *vertically* (`computeVerticalClearance`).
  A `KerningType` per pair lets ink legitimately interleave — `KERN_UNTIL_LEFT_EDGE / _CENTER /
  _RIGHT_EDGE` — which is how a flag can sit over a neighbour's space without a collision.
  A sample of the table, in staff spaces: note↔note `0.1` (a floor, not the note distance) ·
  note↔ledger `0.35` · note↔accidental `max(accidentalNoteDistance, 0.35)` · note↔rest `0.5` ·
  note↔clef `0.8` · dot↔note `dotNoteDistance` · rest↔barline `1.65` · flag↔barline `1.0` ·
  barline↔barline `1.35`.
- **LilyPond** does it with **skylines** plus optical corrections: `stem-spacing-correction` when two
  adjacent stems face opposite ways, `knee-spacing-correction` for a knee'd beam,
  `same-direction-correction` for parallel stems — i.e. *the same rhythm is spaced differently
  depending on where the stems are*, which is real engraving practice and beyond anything we have.
- Both then **stretch with springs** (Gourlay 1987, itself TeX's boxes-and-glue): each event is a
  spring with a natural length (the duration space) and a stiffness; justification solves for one
  force across the system, so events that are already at their minimum do not move while the
  compressible ones absorb the difference. MuseScore's `stretchSegmentsToWidth` is the textbook
  version: sort by pre-tension, accumulate `1/springConst`, `force = width / Σ(1/k)`, then
  `newWidth = force / k` for every spring whose pre-tension the force exceeds.
- And when a system will *not* fit, MuseScore does not clamp: it **squeezes in steps**
  (`squeezeFactor` reduces paddings by 0.2 at a time, `stretchReduction` reduces the duration
  stretch by 0.33) and only then allows collisions. A graceful ladder where we have a hard
  `MAX_MEASURE_WIDTH`.

## 4. Consistency, and the one thing every engine had to fix

The bug MuseScore 4's rewrite existed to fix is worth naming because **we have it too, by a different
route**: *notes of the same duration must be spaced the same across a whole system.* MuseScore 3 laid
out measure by measure, so a bar whose shortest note was a 16th spaced its quarters differently from
the next bar whose shortest was an 8th. Their fix was to compute the spacing unit from the shortest
note **of the system** (`minSysTicks`) — which then forced step 4 of their algorithm: *every time a
measure joins the system, if its shortest note is shorter than the current one, re-lay out all the
previous measures* (and undo it if the measure then does not fit).

✅ **And we now have that consistency, by a different route — 2026-07-30.** Ours never depended on
the shortest note in the system, so MuseScore's re-layout loop was never a risk; what DID break the
rule was the justifier, which shared a line's surplus in proportion to each bar's whole width while
only its music could absorb it. A quarter came out 4.28 staff spaces in a system-opening bar and 3.96
two bars later. Sharing by `naturalWidth − overhead` fixed it: five bars of identical music on one
line now draw the quarter at 4.130, four times over. See `docs/vexflow-boundary.md` §6.

⭐ **A rule anchored on an absolute duration (Dorico's, MuseScore 4's shipped `3.5sp × slope^log2(t/quarter)`)
does not need any of that** — the space for a quarter is the same in every bar of every score, so
consistency is free and no re-layout loop exists. LilyPond's `common-shortest-duration` and
MuseScore's `minSysTicks` are both there to keep *dense* music from becoming enormous, which is a
problem a compressed curve already solves: under √2 a bar of sixteen 16ths is 28sp against a bar of
four quarters at 14sp — twice as wide for four times the events, which is exactly the point.

## 5. What we have, measured

### 5.1 Our width rule is duration-blind

`MeasureLayout.noteSpaceForLane` (`:111`):

```ts
noteSpace = max( formatter.preCalculateMinTotalWidth(voices) × 1.15,
                 laneColumns(slots) × LAYOUT_CONFIG.MIN_NOTE_SPACING,   // 1.8 staff spaces per column
                 silenceFloor )
```

- `preCalculateMinTotalWidth` is **Σ of the tick-context widths plus a variance-based padding
  heuristic** — pure ink, *no duration term at all* (read at `vexflow/build/esm/src/formatter.js:201`).
- so the second term — a flat 1.8 spaces per **column** — is what decides almost every bar. Our bar
  width is therefore **∝ the number of events**, and a bar of four 16ths and a bar of four quarters
  come out identical. Against Gould: a bar of sixteen 16ths should be 2× a bar of four quarters and
  we make it 4×. Dense bars are roughly twice too wide relative to sparse ones, which is why
  `MAX_MEASURE_WIDTH` had to exist and why it then had to be overridden by an `incompressible` floor.

🚨 **CORRECTED by P0's measurement — see §6.** *"The flat floor decides almost every bar"* was read
off the code, not off the page, and the page disagrees: on all five fixtures the floor decided
**nothing**. The `max` is won by the ink term wherever a note carries any (a flag, an accidental) and
by `MIN_MEASURE_WIDTH`/`MAX_MEASURE_WIDTH` at the two ends. The conclusion the paragraph draws —
duration enters nowhere — is not just intact but stronger; the mechanism named is wrong.

### 5.2 Inside a bar, VexFlow's law is *bar-length dependent*

`Formatter.preFormat` distributes the justified width by `Voice.softmax`:

```
ideal(event) ∝ softmaxFactor ^ (ticks / voice.totalTicks)      // Tables.SOFTMAX_FACTOR = 10
```

The exponent is the event's **fraction of the bar**, not its duration, so the ratio between a
quarter and an 8th is `10^0.25 / 10^0.125` = **1.33 in 4/4** but `10^0.5 / 10^0.25` = **1.78 in 2/4**
(measured: `Voice.softmax` in `voice.js:115`). The same rhythm is spaced differently depending on the
meter — no engraver's rule has that shape, and it is invisible to `MeasureLayout`, which never asked.

⚠️ **Corrected 2026-07-30 (review).** This used to add "`totalTicks` is the voice's *nominal* total,
so a partly-filled bar shifts the ratios again". It is `this.ticksUsed` — the voice's own content
(voice.js:119) — so a partly-filled bar normalizes by what is in it. The meter-dependence above is
unaffected: in a full bar the two coincide, which is the case the ratios were measured in.

### 5.3 …but VexFlow already computes the extents

`Note.getMetrics()` (`note.js:315`) returns exactly Gould's extent, decomposed:

```
{ modLeftPx, leftDisplacedHeadPx, notePx, rightDisplacedHeadPx, modRightPx }
```

and `TickContext.getMetrics()` aggregates them into `totalLeftPx / totalRightPx`. Accidentals,
displaced heads and dots are all in there. **We have never read them for spacing** — we take their
sum, multiply by 1.15, and then usually discard it under the flat floor.

### 5.4 🚨 Headless, every glyph measures ZERO

Measured today, node (our unit tests run `environment: 'node'`, not even jsdom):

```
4 quarters:            minTotalWidth = 16.00   (each note w=2.00, glyphWidth=0)
16 sixteenths:         minTotalWidth = 64.00   (each note w=2.00)
4 quarters + sharps:   minTotalWidth = 32.00   (w=6.00: modLeftPx=6, notePx=0)
```

VexFlow 5 ships Bravura as a base64 WOFF2 and measures glyphs by **canvas text measurement**
(`Element: No context for txtCanvas. Returning empty text metrics.`), so with no DOM every glyph is
0 wide and a note falls back to a 2px stub. Consequences, both load-bearing:

- ⚠️ the existing width path is **vacuous in unit tests** — the flat floor always wins there, so no
  unit test can currently detect a change to the ink half of the width;
- ⛔ an extent-based rule therefore **cannot** read VexFlow's metrics inside a unit test. It has to
  take extents as *arguments* (pure function over injected numbers, unit-tested with fixtures) and
  the real numbers get pinned in `e2e/` — the same rule as `docs/ARCHITECTURE.md` §"The browser suite".
- ⭐ the **duration half needs no measurement at all** — it is a function of a `Fraction`, so it is
  fully unit-testable against Gould's table in node.

A headless source of glyph extents does exist if we want one: `public/fonts/Bravura.otf` is already
vendored and **opentype.js is already a dependency** (PDF export outlines glyphs with it), so advance
widths and bounding boxes are readable in node. ⚠️ **Corrected 2026-07-30 (review):** the stated
alternative — SMuFL's `bravura_metadata.json` (`glyphBBoxes`, already in staff spaces) — is **not**
in `public/smufl/`, which holds only `classes.json`, `glyphnames.json` and `ranges.json`. It would
have to be vendored; the otf route needs nothing.

### 5.5 The seam that takes over x already exists and is proven

`applyLeadingSpaces` (`VexFlowRenderer.ts:96`) walks `formatter.getTickContexts().array` **after**
`format()` and rewrites `context.setX(...)`. It works because `note.getAbsoluteX()` reads its tick
context lazily at draw time — so beams, ties, tuplets, accidentals and the `ElementRegistry` all
follow with no extra work. That is exactly the mechanism a "the model decides the x's" step needs,
already built, already tested (client #10).

⚠️ **Corrected 2026-07-30 (review).** This used to credit "`postFormat()` runs *inside* `format()`".
It does not: `Formatter.format` calls it only `if (opts.stave)` (formatter.js:600) and we format
without a stave — the renderer's own comment at `VexFlowRenderer.ts:725` already said so. Nor would
it matter, since `TickContext.postFormat` is a no-op latch. The load-bearing fact is that **nothing
between `format()` and `draw()` reads or rewrites `TickContext.x`**, so the last `setX` wins. Two
further numbers the same read turned up: `getAbsoluteX()` adds `Metrics.get('Stave.padding')` = **12
px** on top of `stave.getNoteStartX()`, and `TickContext.setX` resets `xBase` and zeroes `xOffset`.

### 5.6 The fan is already doing extent-thinking, with invented numbers

`FanStaveNote.preFormat` (`fanRoom.ts:95`) calls `setWidth(fanRoom − modifierWidth)` — i.e. it buys
room by declaring an extent, which is the right mechanism. The number is
`fanColumns(fan) × MIN_NOTE_SPACING`, read as a floor by the formatter and as a ceiling by the
drawing, plus `FAN_MAX_SPAN_STRETCH`, `FAN_MIN_HEAD_GAP_RATIO`, `trailingGap` and `fanColumns`'s
`+1`. Five constants negotiating one boundary, each measured against one screenshot — the pattern
the model exists to end (plan doc §0).

## 6. ⭐⭐ THE BEFORE — the drawn gaps, censused (P0, 2026-07-30)

Plan §3 P0: *"nothing can be called an improvement without a before"*. Taken in Chrome with real
Bravura metrics — `npm run test:e2e -- spacing.e2e.ts`, which prints every line below and asserts
each finding, so P2 and P4 turn this file red on purpose rather than by argument. The instrument is
`src/dev/spacingCensus.ts`; `__spacing.dump()` prints the same table for a real score on screen.

All numbers in **staff spaces**. `room` = the bar less its header (only the first bar of a system
pays one). `gap` = column to column, i.e. the distance Gould's table is a statement about.

| fixture | room | gap between notes | what actually decided it | Gould |
|---|---|---|---|---|
| 16 × 𝅘𝅥𝅯 | 32.20 | **1.99** | `MAX_MEASURE_WIDTH` — the bar is 40.00 to the pixel | 2 |
| 8 × ♪ (unbeamed at width time) | 26.06 | **3.36** | the ink term, `preCalculateMinTotalWidth × 1.15` | 2¼ |
| 4 × ♩ | 8.30 | **1.94** | `MIN_MEASURE_WIDTH` — the bar is 10.00 to the pixel | 3½ |
| 4 × ♩, every one sharpened | 13.90 | **3.75** | the ink term | 3½ |
| accel fan ×6 over a 𝅗𝅥 | 26.35 | 4.63 · 3.93 · 3.24 · 2.55 · 1.85 | the fan's own five constants | — |

Four findings, and the first three are worse than the plan predicted:

1. ⭐⭐ **The order is INVERTED, not merely flat.** An eighth is drawn **3.36** and a quarter
   **1.94** — the *shorter* note gets the wider gap, by 1.73×. Gould has the quarter 1.56× the
   eighth. The cause is that ink is the only quantity in this path that varies, and an eighth
   carries a **flag** at width time (the width pass builds `StaveNote`s and no beams) while a
   quarter carries nothing. So a beamed bar reserves room for flags it never draws.
2. ⭐⭐ **One duration, two answers, neither of them a quarter's.** The same four quarters come out
   at **1.94** plain and **3.75** with a sharp in front of each — 1.93× apart. That is plan §1's
   *"added, never conflated"* stated as a defect: the ink either **replaces** the rule (and
   overshoots Gould's 3½) or plays no part in it, and is never a minimum under it.
3. ⚠️ **`MIN_NOTE_SPACING` won nothing.** The constant §5.1 calls "what decides almost every bar"
   decided none of the five fixtures — §5.1 is corrected in place. The ends are set by
   `MIN_MEASURE_WIDTH` (10) and `MAX_MEASURE_WIDTH` (40), *"a hard number nobody chose musically"*
   (plan §4), and the middle by VexFlow's ink. ⭐ This does not weaken plan §2's deletion list; it
   moves the weight inside it, and it means **P2 cannot be judged by the sparse or dense fixture
   until the two clamps are looked at** — both bars are pinned at a constant, so nothing the
   duration rule says can show through there.
4. **The gap after a fan is open, and it is huge.** The half rest filling beats 2–4 sits **1.80**
   after the last member and then **8.35** runs out empty to the barline — the boundary plan §1.2's
   *"a fan claims a RANGE of columns"* exists to close.

Not measured here, deliberately: multi-voice bars (plan §P2 predicts they narrow, a lot — the floor
counts slots and the model counts columns) and a grand staff's cross-staff columns. Both want the
column merge to exist before there is anything to compare.

## 6b. …AND THE AFTER (P0–P4 built, 2026-07-30)

Same instrument, same fixtures, once the model decides both the bar's width **and** where each
column lands inside it. All in staff spaces, against **LilyPond's** curve — the one that ships
(§2, and `docs/spacing-model-plan.md` §1.0).

| | before | after | LilyPond's rule |
|---|---|---|---|
| a quarter | 1.94 | **3.60** | 3.6 |
| an eighth | 3.36 | **2.40** | 2.4 |
| a 16th | 1.99 | **1.80** | 1.8 |
| a 32nd | – | **1.50** | 1.5 |
| **quarter ÷ eighth** | **0.58** | **1.50** | 1.5 |
| 16 × 𝅘𝅥𝅯 vs 4 × ♩, room | ×3.9 | **×2.1** | ×2 |

The three findings of §6 are each answered: the ordering is no longer inverted (the flag that never
gets drawn is out of the width path entirely); one duration gets one answer, with the ink as a
minimum *under* the rule rather than instead of it; and neither end is pinned at a constant.

Two more, from his own scores rather than from fixtures:

- **Ledger lines** were absent from the ink model — `note↔ledger 0.35` sits in the very MuseScore
  table §3 quotes. A ledger measures **1.80 spaces against a bare notehead's 1.13**, and a run of
  ledgered 32nds was drawing its gaps at 1.64, so consecutive ledgers **overlapped**. They now come
  out at **2.15** where the on-staff ones get **1.43** — each gap taking its own ink, which is the
  thing no single formatter law can do.
- **Silence** got 9% of a bar's width for 50% of its time. A half rest after sixteen 32nds now takes
  **4.84** spaces against the rule's 4.8. ⚠️ Gould's curve is compressed on purpose and does NOT
  make space proportional to duration — the notes are still the bulk of the bar, and should be.

## 6c. ⭐⭐ THE BAR THAT OPENS A SYSTEM — what the sources actually say (2026-07-30)

His report, on empty bars: *"the empty measure at the beginning of a line is too small… probably it is
the same size as a normal empty measure, but in the first line we have the clef, and if we have also a
time signature that is more space stolen. For the size we have to take into account **where the
measure actively begins and not where it geometrically begins**."*

Measured, before anything was changed (staff spaces, empty bars on one justified system):

| empty bar | total | header it carries | the MUSIC got |
|---|---|---|---|
| line start, treble + 4/4 | 12.03 | 8.25 | **3.78** |
| line start, clef only | 10.00 | 4.85 | **5.15** |
| mid-line | 10.50 | 1.65 | **8.85** |

### The wrong fix, and how it was caught

Move `MIN_MEASURE_WIDTH` (10 spaces) so it floors the bar's MUSIC instead of its total, and every bar
gets the same music room wherever it sits — 8.35 spaces. Built, and reported back by eye the same
hour: *"now I have the sensation that it is too big… the first measure that has no time signature
looks also larger; it's a visual effect, so it needs to be compensated."* Drawn, the line-opening bar
had gone 12.03 → **17.77** and a clef-only line opener 10.00 → 13.20.

⭐ **Both reports are right, and they are not in conflict: the minimum is about the bar as SEEN.** A
reader judges a bar by its whole extent, and a clef standing in it is part of that extent — so a
line-opening bar handed the same *music* as its neighbours genuinely is wider than them. What was
wrong was never the floor's scope.

### What the sources say

**The header's gaps are not padded — ours are already tighter than LilyPond's.** His first hypothesis
was that we reserve the clef's bounding box, which has slack on its right. Measured in Chrome, in
staff spaces from the barline: the clef's ink runs 0.4→3.3, the `4/4` digits 4.7→6.6, the first
notehead starts at 7.7. `headerExtent` reserves **6.6** — the meter's ink end, to the hundredth. The
blank is *between* the glyphs, and LilyPond's own `space-alist` says that is where it belongs:

| gap | LilyPond's default | we draw |
|---|---|---|
| clef → time signature | `(time-signature extra-space . 1.52)` | **1.4** |
| time signature → first note | `(first-note fixed-space . 2.0)`, plus `extra-spacing-width '(0.0 . 0.8)` | **1.1** |
| clef → first note (no meter) | `(first-note minimum-fixed-space . 5.0)`, counted from the clef's LEFT | **4.0** |

⛔ So the clef↔meter gap must NOT be taken away — it is 1.4 against LilyPond's 1.52, and every other
header gap we draw is already *under* the standard. (`extra-space` is measured right-edge to
left-edge, `minimum-space` from the left edge of the first object — LilyPond, *Spacing between
adjacent non-musical items*.)

**A bar of silence is spaced by its DURATION, in every engine.** LilyPond's `MultiMeasureRest`:
*"Multi-measure rests have a length according to their total duration, which is under the control of
the `space-increment` property"*, default 2.0 — *"each doubling of the duration adds `space-increment`
to the length of the bar"*. MuseScore's *Minimum measure width* is documented for exactly our case —
*"in measures containing very little content (e.g. a single whole note or whole measure rest), the
measure will only shrink as far as this minimum"* — and its default is **4 sp**, where ours is 10.

⭐⭐ **And the compensation he asked for is a documented LilyPond override, for full-bar rests
specifically.** `MultiMeasureRest.spacing-pair` defaults to `'(break-alignment . break-alignment)` —
the rest is measured from *after* the prefatory matter, so the bar grows by its clef and meter — and
the Internals Reference gives the alternative in as many words: a MultiMeasureRest *"will ignore
prefatory items at its bounds (i.e., clefs, key signatures and time signatures)"* with
`\override MultiMeasureRest.spacing-pair = #'(staff-bar . staff-bar)`. So both looks are known, and
the one he is asking for is the standard tweak for bars of rest — not a fudge.

### What was actually wrong, and the fix

**The last flat default in the width path.** `EMPTY_LANE_NOTE_SPACE` gave an empty bar 4 staff spaces
of note area *whatever meter it was in and whatever else it carried*, so `MIN_MEASURE_WIDTH` was the
only thing deciding an empty bar's width — and on a system's first bar the whole of that floor went on
the header. Deleted: a bar-long silence is one column and the rule prices it like any other duration
(6.0 spaces in 4/4, 4.8 in 2/4, 6.7 in 12/8), with `MIN_MEASURE_WIDTH` left exactly where it was, a
floor on the bar as seen.

| empty bar, drawn | before | min-on-the-music | **the rule sizes the silence** |
|---|---|---|---|
| line start, treble + 4/4 | 12.03 | 17.77 | **13.97** |
| line start, clef only | 10.00 | 13.20 | **10.40** |
| mid-line | 10.50 | 11.18 | **10.25** |
| line start: 12/8 · 4/4 · 2/4 | 12.03 for all three | — | **15.73 · 13.97 · 12.82** |

⚠️ Mid-line empty bars are unchanged, and that is deliberate: the rule leaves a bar-long silence
*under* the floor, so there the floor still answers. He has reported three times that empty bars do
not shrink far enough (`docs/bar-width-plan.md` "Known issues" #1), and a fix at the line start must
not widen the ones in the middle.

### The floor itself: three values, drawn and compared

Our 10 spaces against MuseScore's 4 is why a mid-line empty bar is padded from the 7.65 the rule asks
up to 10 — so once the model prices the silence, the floor is *all* that is left of "empty bars are too
wide". All three were drawn on his own score:

| value | where it comes from | verdict |
|---|---|---|
| **10** | what it has always been | ✅ **kept** — *"I think 10 was nicer… as an initial setup I think it looks clear and nicely spaced"* |
| 7.65 | ⭐ the RULE's own ask for a 4/4 bar of silence (6.0 + the 1.65 lead-in): the value at which this floor decides nothing an empty 4/4 bar does | *"it does not look bad, but…"* |
| 4 | MuseScore's *Minimum measure width* default, documented for exactly this case | too tight to START from |

⭐ **A DEFAULT and a SHRINK FLOOR are different questions**, and this is where the difference got
stated: *"of course empty bars can shrink more (depending on the context, probably to 4?) but as an
initial setup…"*. 4 spaces is a reasonable place for a bar of silence to *end up* when the line needs
the room — which is already what happens, via `EMPTY_BAR_FLOOR_PX` and the transfer in
`docs/bar-width-plan.md` §1.5 — and not where an untouched page should start.

⚠️ **The one number in the width path that is taste rather than ink, so it has to stay cheap to
revisit.** Trying 7.65 broke two specs, both because they *stated* how many empty bars a system holds
instead of asking (`MeasureLayout.raggedLastLine.test.ts`, `MusicEngine.barWidthNudge.test.ts`). Both
count now, so the next by-eye trial costs one constant.

## 6d. ⭐⭐ THE FRONT OF A BAR — a rest is not special, and the gap is LilyPond's (2026-07-30)

His question, after being told our table had a `barline↔rest` row that never fired: *"the question is about
rest placement — are we following the Gould rule? It will be good to contrast this, and to know what is the
rule in LilyPond and in other industry standards like Verovio, Sibelius or Dorico."*

### The answer is unanimous: **after a barline, a rest gets a NOTE's gap**

| source | the gap after a barline | rest treated differently? |
|---|---|---|
| **MuseScore** — `rendering/paddingtable.cpp` | `barNoteDistance`, default **1.25 sp** | **No**, and explicitly: `table[BAR_LINE][REST] = style.styleAbsolute(Sid::barNoteDistance)` — the note's own value, assigned to the rest row |
| **LilyPond** — `BarLine.space-alist` | `(first-note semi-shrink-space . 1.3)` at a system start, `(next-note semi-fixed-space . 0.9)` mid-line | **No** — the keys name the next musical COLUMN; there is no rest entry anywhere in the alist |
| **Sibelius** — Note Spacing Rule | one control: *"the gap before the first note/rest in a bar"* | **No** — one setting for both |
| **Dorico** — Note Spacing | *"the positions of notes **and rests** relative to each other… are known as note spacing"*; the Spacing Gaps barline options are for clefs, time and key signatures | **No** |
| **Verovio** — `horizontalaligner.cpp` | a rest takes `ALIGNMENT_DEFAULT`, the same alignment type as a note | **No** |
| **Gould** | her table is by DURATION, and a rest has one | no statement found either way — ⛔ not invented here |

⭐ **So where did 1.65 come from?** MuseScore's `table[REST][BAR_LINE] = 1.65 * spatium` — a rest *before* a
barline, against a note's `noteBarDistance` = 1.5. That direction is real: a rest does get a shade more room
before a barline. Ours had been copied onto the LEADING row as well, where MuseScore uses the note's number.
**The row was wrong, not merely unreachable** — so it was deleted rather than made to fire, and the drawing
(which had been giving a note's 1.2 by accident) did not move.

### ⭐⭐ And the air he asked for, taken from LilyPond: `HEADER_TO_NOTE` = 2.0

*"It is better to have air also in the beginning in comparison to what we have now."* Not a rest-specific
number, then — a bigger gap for everything after a header. Two rows of LilyPond's `space-alist` decide it and
they agree:

| LilyPond | what it says | ours, measured before |
|---|---|---|
| `TimeSignature.space-alist (first-note fixed-space . 2.0)` | 2.0 spaces after the meter | **1.1** |
| `Clef.space-alist (first-note minimum-fixed-space . 5.0)` | ≥ 5.0 from the clef's LEFT edge | **4.0** |

Our clef's ink runs 0.4 → 3.3 spaces past the stave, so the clef row puts the note at 5.4 — **2.1 past the
clef's ink**, i.e. the meter row's 2.0 to within a rounding. One constant reproduces both.

**Drawn after**: the first note of a bar with clef + `4/4` moved from **7.80** to **8.60** spaces past the
barline; a two-digit meter from 4.80 to 5.60; a bar with no header is **unchanged**.

⛔ **What we did NOT take from LilyPond, with the reason:** its `BarLine` gap for a bar with no header is
**0.9** mid-line (1.3 at a system start) against our 1.2 — i.e. LilyPond is TIGHTER there and we cannot
follow. 1.2 is VexFlow's `Stave.padding` showing through: below it the note area would begin left of the
barline, which the geometry forbids (`pairPadding` states it, `tier1Geometry.test.ts` pins it).

### ⭐⭐ And the END of a bar: LilyPond has NO number, on purpose

Asked next: *"what about the space on the end? Does LilyPond say anything about it?"* Checked at the source,
and the answer is that it says something **structural** rather than a padding:

| | space before a barline |
|---|---|
| **LilyPond** | **no constant exists** — `BarLine.space-alist` has no note-facing entry and `BarLine` has no `extra-spacing-width`. Instead `NoteSpacing.space-to-barline` (default `#t`): *"the distance between a note and the following non-musical column will be measured **to the bar line** instead of to the beginning of the non-musical column. If there is a clef change followed by a bar line… we will try to space the non-musical column as though the clef is not there."* So the last note's DURATION space runs out to the line, and only ink stops it |
| **MuseScore** | the only engine with a constant here: `noteBarDistance` = **1.5 sp** |
| **ours** | the barline IS a column, so the last gap is `followingSpace(the last duration)` max'd against ink — **LilyPond's rule already, including the subtlety**: a cautionary clef cannot push the last note away from the line, because the clef is not a column |

Measured, which is what made it decidable: in a sparse bar the last note sits **3.6** spaces from the barline
(the quarter's own space — our ink floor never enters), and in a bar of 16ths the floor binds at **2.13**
(notehead 1.13 + `note↔barline` 1.0). MuseScore's constant would make that 2.63.

✅ **Decided by eye: left at 1.0** — *"i think is ok now"*. So the only number in the model that differs from
MuseScore at a barline is a floor that binds on dense bars alone, and it has been looked at.

## 6e. ⭐⭐ MUSIC THAT IS NOT FIXED IN THE SCORE'S TIME-SPACE — what the field calls it (2026-07-30)

Asked after his grand-staff report (a fan's members, as columns, bending the metrical staff below —
docs/spacing-model-plan.md §3b): *"maybe you can research how contemporary music engravers deal with
this without faking it… maybe there is a known solution"*, and then *"not just industry standard,
maybe some academic research or niche project"*, and *"not just with fan but also with non-temporal
notation in general"*.

⭐⭐ **THE MECHANISM WE BUILT HAS A NAME: A ROD.** Renz's GUIDO spacing model (ICMC 2002; TU Darmstadt
dissertation, 2002) is explicit — springs carry the duration-based stretch, and *"rods are introduced,
which determine the minimum stretch for one or more springs"*. LilyPond ships the same pair:
`Separation_item` *"compute[s] widths to generate spacing rods"*, exposed as `springs-and-rods`. A
minimum width **spanning several columns** is the published primitive for material that occupies room
without owning a grid position. `Column.rod` is named for it.

⭐ **AND THE OTHER HALF HAS A PRECEDENT TOO.** LilyPond's `SpacingSpanner.strict-grace-spacing`:
*"main notes are spaced normally, then grace notes are put left of the musical columns for the main
notes."* Structurally our rule — a sub-group kept OUT of the main solve and fitted into room the grid
has already decided. So "excluded from the columns, then fitted" is not an invention either.

**The vocabulary to use, all of it borrowed:**

| term | whose | what it names |
|---|---|---|
| **spacing column** | Dorico | the shared grid position — one x across every staff |
| **rod** | Renz / GUIDO, LilyPond | a minimum width over one or more springs |
| **spacing section** | LilyPond | a REGION with its own spacing law (`\newSpacingSection`, `proportionalNotationDuration`, `uniform-stretching`) |
| **time-space / proportional notation** | Gould | x IS duration |
| **"placing material freely within a defined time-span"** | Gould, *Behind Bars* ch. 20 | ⭐ the best existing name for our exact case |

⭐ **Gould ch. 20 "Freedom and Choice" is the taxonomy to build against**, and it is bigger than the
fan: cadenzas and solo ad libitum passages · unmeasured bars (music without metre) · independent parts
within an ensemble · indicating synchronisation · independent repetition · **placing material freely
within a defined time-span** · proportional spacing. Her rule for a feathered beam is the one we
implement: a free accelerando or rallentando **within the duration of the group**, whose notes *may*
be spaced according to their speed — the group owns its written value, and the inner spacing is a
graphic option, not a rhythmic claim.

**Formats — none of them can say it, which is worth knowing before any import/export work:**

- **MusicXML** cannot express it at all. Every note needs a `<duration>`; a feathered beam is only a
  graphic flag (`beam@fan="accel|rit"`) over notes with ordinary written values, and the only
  horizontal freedom is `default-x` — a pure override with no model behind it.
- **MEI** is closer but not there: `@dur` is optional in places and `@dur.ges` separates performed from
  written duration, but a "space = duration" primitive, or an encoding for aleatoric boxes and duration
  lines, is **not confirmed** to exist.
- **INScore** (Fober/Orlarey, GRAME) is the one published model where *duration = spatial extent* is
  first-class: heterogeneous objects (symbolic score, graphics, bitmaps, audio) each carry a time
  segment, and synchronisation is done by mapping and STRETCHING GRAPHIC SPACE via segment relations.
  ⭐ The thing to read when the boxed cells and graphic gestures arrive.
- **Verovio** offers proportional spacing as a global switch (`--spacing-non-linear`), not a per-passage
  region.

⚠️ **What nobody was found to have done:** a solver formalised over a MIXTURE of grid-pinned and
grid-free events. TENOR's proceedings were searched specifically; the nearest is Fournier-S'niehotta,
*Is There a Data Model in Music Notation?* (TENOR 2016). Reported as **not found**, not as absent.

Lineage, if any of this is ever cited: Gourlay, *Spacing a Line of Music* (OSU-CISRC-10/87-TR35, 1987)
· Haken & Blostein, *A New Algorithm for Horizontal Spacing of Printed Music* (ICMC 1995, the Lime
editor) · Byrd, *Extremes of Conventional Music Notation* (2003), which catalogues exactly these
boundary cases.

---

## 7. Sources

- Elaine Gould, *Behind Bars* (Faber 2011), p. 39 "Rhythmic spacing" — table quoted in §1, via the
  facsimile in MuseScore's spacing paper below.
- Michele Spagnolo, *An improved horizontal spacing algorithm for MuseScore (v1.0)*, Nov 2021 —
  [PDF](https://github.com/musescore/MuseScore/files/7625701/An.improved.horizontal.spacing.algorithm.for.Musescore.pdf),
  [PR #9928](https://github.com/musescore/MuseScore/pull/9928),
  [forum post](https://musescore.org/en/node/326965).
- MuseScore source: `src/engraving/rendering/score/horizontalspacing.cpp` (`durationStretchForTicks`,
  `chordRestSegmentNaturalWidth`, `minHorizontalDistance`, `stretchSegmentsToWidth`,
  `squeezeSystemToFit`) and `src/engraving/rendering/paddingtable.cpp`.
- LilyPond: [Horizontal spacing overview](https://lilypond.org/doc/v2.24/Documentation/notation/horizontal-spacing-overview),
  [SpacingSpanner](https://lilypond.org/doc/v2.24/Documentation/internals/spacingspanner), and source
  `lily/spacing-options.cc` (`get_duration_space`), `lily/spacing-basic.cc`, `lily/note-spacing.cc`.
- Verovio: `src/horizontalaligner.cpp` → `Alignment::HorizontalSpaceForDuration`;
  [toolkit options](https://book.verovio.org/toolkit-reference/toolkit-options.html) for
  `spacingLinear` / `spacingNonLinear`.
- Dorico: [Note Spacing page in Layout Options](https://archive.steinberg.help/dorico/v5/en/dorico/topics/engrave_mode/engrave_mode_note_spacing_page_layout_options_r.html)
  (default space for quarter, minimum space for short notes, custom spacing ratio, actual vs ideal
  widths).
- Sibelius/Finale defaults and their history: Scoring Notes / Robert Puff,
  [Understanding & improving music spacing in Finale and Sibelius](https://www.scoringnotes.com/of-note/understanding-improving-music-spacing-in-finale-and-sibelius/).
- J. S. Gourlay, *Spacing a Line of Music*, OSU-CISRC-10/87-TR35 (1987) — the spring/rod model every
  engine's justifier descends from; see also LilyPond's
  [essay on automated engraving](https://lilypond.org/doc/v2.24/Documentation/essay-big-page.html).
- Ted Ross, *The Art of Music Engraving and Processing* (1970) — the pre-computer tradition, and the
  source usually cited for 3½ spaces per quarter.
- LilyPond's prefatory-matter distances: [Clef grob](https://lilypond.org/doc/v2.25/Documentation/internals/clef)
  and [TimeSignature grob](https://lilypond.org/doc/v2.23/Documentation/internals/timesignature)
  (`space-alist`, `extra-spacing-width`),
  [Spacing between adjacent non-musical items](https://lilypond.org/doc/v2.23/Documentation/notation/spacing-between-adjacent-non_002dmusical-items)
  (what `extra-space` / `minimum-space` are measured from).
- Full-bar rests: [MultiMeasureRest grob](https://lilypond.org/doc/v2.25/Documentation/internals/multimeasurerest)
  (`space-increment`, and `spacing-pair` — the documented override that makes a full-bar rest ignore
  the clef and time signature) and [Writing rests](https://lilypond.org/doc/v2.25/Documentation/notation/writing-rests).
- The empty-bar floor: MuseScore's *Minimum measure width* (default 4 sp),
  [Score size and spacing](https://musescore.org/en/handbook/4/score-size-and-spacing) and
  [Systems and horizontal spacing](https://handbook.musescore.org/formatting/systems-and-horizontal-spacing).
- The FRONT of a bar, contrasted across five engines (§6d): MuseScore
  [`rendering/paddingtable.cpp`](https://raw.githubusercontent.com/musescore/MuseScore/main/src/engraving/rendering/paddingtable.cpp)
  and [`style/styledef.cpp`](https://raw.githubusercontent.com/musescore/MuseScore/main/src/engraving/style/styledef.cpp)
  (`barNoteDistance` 1.25, `noteBarDistance` 1.5); MuseScore's kerning types in
  [`rendering/score/horizontalspacing.cpp`](https://raw.githubusercontent.com/musescore/MuseScore/main/src/engraving/rendering/score/horizontalspacing.cpp)
  (`isNeverKernable` lists `BAR_LINE`, which is the same rule as our barline band);
  [LilyPond BarLine grob](https://lilypond.org/doc/v2.25/Documentation/internals/barline);
  [Sibelius 8.3 Note spacing](https://manualzz.com/doc/o/2r7imf/sibelius-2021.2-reference-guide-8.3-note-spacing)
  (one gap for "the first note/rest", and an empty bar defaulting to the space a bar-filling note would get —
  which independently matches §6c); [Dorico note spacing](https://www.steinberg.help/r/dorico-pro/6.1/en/dorico/topics/engrave_mode/engrave_mode_note_spacing_c.html);
  Verovio [`src/horizontalaligner.cpp`](https://raw.githubusercontent.com/rism-digital/verovio/develop/src/horizontalaligner.cpp).
