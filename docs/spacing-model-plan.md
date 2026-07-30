# A real spacing model (Gould) — the plan

> ⭐⭐ **PRIORITY FOR THE WHOLE EDITOR** (his call, 2026-07-29; scope confirmed 2026-07-30: *"we do
> it all, we need good default spacing, following the tradition and best engraving practices"*).
> Horizontal space is what a reader reads, and this editor has no rule for it.
>
> 📄 The evidence this plan rests on — Gould's table verbatim, the four engines' formulas side by
> side, and the six measurements taken in our own code — is **`docs/spacing-model-research.md`**.
> This document does not repeat it; it decides what we build.
>
> ⚠️ **Reviewed against the codebase and against VexFlow 5.0.0's source on 2026-07-30**, and amended
> in place. What the review changed is flagged inline (⚠️/⭐ REVIEW); the numbers it re-measured are
> in §5. Nothing about the shape of the model changed — the two facts, the `max`, the springs and
> the phase order all survived. What changed is one formula, one claim about the fit, where the
> module lives, and four things the plan did not own.

## 0. Why (kept from the original notes)

This editor decides horizontal space with **two mechanisms and a pile of constants**:

1. **VexFlow's formatter**, which distributes a bar's width by `softmax(ticks / voice.totalTicks)`;
2. **a floor per event** (`LAYOUT_CONFIG.MIN_NOTE_SPACING`, 1.8 staff spaces), which is what
   *actually* spaces most bars, because the formatter's own minimum is far too tight to read.

Neither asks the question engraving asks: **how much room does THIS event need, given what it
draws?** A note with a sharp, a note with a ledger line, a note with a dot and a plain note get the
same column; a fanned group of eight heads gets one event's column; a two-note tremolo's strokes and
a member's accidental buy their own room out of whatever slack happens to be lying around.

**Every feature that draws its own ink has had to re-derive the answer by hand, and each one did it
differently.** The fan alone carries five constants that negotiate one boundary:

| number | where | what it claims |
|---|---|---|
| `MIN_NOTE_SPACING` (1.8 spaces) | `layoutConfig` | what one ordinary event's column is |
| `FAN_MIN_HEAD_GAP_RATIO` (1.25) | `FannedBeam` | the closest two fanned heads may come |
| `trailingGap` (= `MIN_NOTE_SPACING`) | `FanPass` → `FannedBeam` | what the group leaves after itself |
| `fanColumns(...) + 1` | `utils/fannedBeam` | the room the bar is asked for |
| `FAN_MAX_SPAN_STRETCH` (1.5) | `fanRoom` | how far a justified bar may stretch it |

Each is right on the screenshot it was measured against and silently wrong on the next one. ⛔ **The
answer is not a sixth number.**

And two defects that were *measured* while researching this (research doc §5), because they set the
size of the prize:

- **our bar width is duration-blind** — the flat floor wins almost always, so a bar's width is ∝ its
  **event count**. A bar of four 16ths and a bar of four quarters come out the same width; against
  Gould, dense bars are ~2× too wide relative to sparse ones. That is why `MAX_MEASURE_WIDTH` had to
  exist, and then had to be overridden by an `incompressible` floor.
- **VexFlow's law is meter-dependent** — the exponent is the event's *fraction of the bar*, so a
  quarter is spaced 1.33× an eighth in 4/4 and 1.78× in 2/4. No engraver's rule has that shape.

---

## 1. The model — two facts, decided

Gould states it as two independent facts about every event, and Dorico, MuseScore, LilyPond and
Verovio are all built the same way:

- **its own extent** — the ink either side of its notehead column: accidentals, arpeggio signs and
  articulations to the left; dots, displaced heads and ledger overhang to the right;
- **the space that FOLLOWS it** — a function of its DURATION, non-linear and strongly compressed.

The two are **added, never conflated**, and combined with a `max`: the duration gives the *ideal*
gap, the ink gives the *minimum* one, and the wider of the two wins.

### 1.0 ⭐⭐ THE CURVE THAT SHIPS IS **LILYPOND'S** — changed 2026-07-30, his call

Everything in §1.1 below is the √2 power law the model was built on, and it is still in the code as
`GOULD_SPACING`. It is no longer the default. Reported by eye once P4 landed: *"dense passages seem
too tight to me, LilyPond numbers sound better"*, and then the standing preference — *"in general we
should approximate to LilyPond as much as possible."*

**LilyPond's law is a different SHAPE, not a different constant** (research §2, `lily/spacing-options.cc`):

```
s = (2 + log₂(t / ♪)) × 1.2 spaces        …for t ≥ an eighth
s = (1 + t / ♪) × 1.2 spaces              …below it — a LINEAR branch, not a floor
```

Each doubling **adds** 1.2 staff spaces where a power law **multiplies**. That is the whole
difference, and it is what he was reading:

| | 𝅘𝅥𝅰 | 𝅘𝅥𝅯 | ♪ | ♩ | 𝅗𝅥 | 𝅝 | 𝅝 ÷ 𝅘𝅥𝅰 |
|---|---|---|---|---|---|---|---|
| Gould | – | 2 | 2¼ | 3½ | 5 | 7 | – |
| power, √2 | 1.24 | 1.75 | 2.47 | 3.50 | 4.95 | 7.00 | **5.6** |
| **log (ships)** | **1.50** | **1.80** | **2.40** | **3.60** | **4.80** | **6.00** | **4.0** |

⭐ The **dynamic range** — longest ÷ shortest — falls from 5.6 to 4.0, so dense music keeps a far
larger share of a line. And the ink floor stops binding at the 32nd (the curve now gives it 1.50
against the notehead's 1.43); it takes over at the 64th, which is a better place for it.

⚠️ **It is FURTHER from Gould overall, and that is worth saying plainly** since she is what the model
was anchored on: mean absolute error over her eight values goes from **4.1% to 7.0%**. LilyPond is
the closer of the two on the 16th and the 8th — the values he was looking at — and worse on the
dotted half (−8.3%) and the whole (−14.3%). Both are defensible houses. ⛔ Neither the shape of the
model nor anything else in this plan changed: it is one field, `SpacingRule`, now a union of two
laws, and `spacing.test.ts` holds both to their own published tables.

⭐ **`shortest` stays an ABSOLUTE reference** (a fixed eighth, LilyPond's own default for
`common-shortest-duration`), so §1.1's argument against a relative anchor still holds in full — we
never write MuseScore's *"re-lay out every previous measure"* loop.

### 1.1 The curve the model was built on: `space = 3.5 spaces × √(duration / quarter)`

Anchored on Gould's own number (3½ spaces per quarter), with the ratio √2 ≈ **1.4142 per doubling**.
Justified in the research doc: it is Dorico's published default read as what it actually is, it is
the curve MuseScore's own author independently fitted to her points, and it lands on four of her
eight values within 1%.

```ts
// engine/layout/spacing.ts — pure, Fraction-exact, no VexFlow, no DOM
export interface SpacingRule {
  /** Staff spaces an ordinary quarter earns. Gould's 3½. */
  quarterSpace: number
  /** How much more space a doubled duration earns. √2 — Gould's table, Dorico's default. */
  ratio: number
}
export function followingSpace(quarters: Fraction, rule: SpacingRule): number
// = quarterSpace * quarters ** log2(ratio)
```

⚠️ **REVIEW — `quarters` is ALREADY in quarters.** This line first read `(quarters / ¼) ** …`, which
is `4t`: a quarter would have earned `3.5 × √4 = 7` spaces, a whole note 14, and every assertion in
P1 would have been written against the doubled curve. There is no `/ quarter` term to write, because
the unit of the argument *is* the quarter. The prose name of the rule (`√(duration / quarter)`) is
right; the code is `quarters ** log2(ratio)`.

⚠️ **REVIEW — how it actually fits Gould, measured.** The earlier claim ("within 1% everywhere
except the short end") is false, and the error is not where it was said to be:

| | 𝅘𝅥𝅯 | ♪ | ♪. | **♩** | ♩. | 𝅗𝅥 | 𝅗𝅥. | 𝅝 |
|---|---|---|---|---|---|---|---|---|
| Gould | 2 | 2¼ | 3 | **3½** | 4 | 5 | 6 | 7 |
| `3.5·√t` | 1.75 | 2.47 | 3.03 | **3.5** | 4.29 | 4.95 | 6.06 | 7.00 |
| error | **−12.5%** | **+10.0%** | +1.0% | 0 | **+7.2%** | −1.0% | +1.0% | 0 |

⚠️ **"Within 1%" is the ROUNDED reading — corrected by P1's test, 2026-07-30.** The worst of the five
is **1.04%**: the dotted 8th at +1.037%, the dotted half at +1.036%, the half at −1.005%. Only the
quarter and the whole are exact. `spacing.test.ts` pins the real number rather than the rounded one,
because a spec that rounds is a spec that can drift.

⭐ **Only the 16th is the floor talking.** A floor can push a value UP and never down, so it explains
the 16th (curve narrower than Gould) and explains *nothing* about the 8th, where the curve is 10%
**wider** than she is. The dotted quarter (+7.2%) was not mentioned at all. So the honest statement
is: the curve agrees with Gould on the undotted long values and the dotted 8th (five of eight, within
1%), is generous at the 8th and the dotted quarter, and is tight at the 16th. That is still the best
of the five laws in research §2 — but it is a **fit, not a reproduction**, and P1's tolerance must
say so rather than swallow it.

Four decisions inside that one line:

- ⭐ **The anchor is ABSOLUTE — the quarter — not the shortest note in the system.** LilyPond's
  `common-shortest-duration` and MuseScore's `minSysTicks` exist to stop dense music exploding, which
  a compressed curve already does (sixteen 16ths = 28 spaces against four quarters at 14 — twice the
  width for four times the events). A relative anchor also forced MuseScore into *"every time a
  measure joins the system, if its shortest note is shorter, re-lay out every previous measure"*, plus
  an undo of that when the measure then does not fit. We get consistency across the whole score for
  free and never write that loop.
- ⭐ **No floor in the curve.** Gould's table flattens at the bottom and the temptation is a
  `minFollowing` constant. It is not needed: at the very short end the flattening **is the notehead
  showing through**. A notehead is ~1.18 spaces plus a note↔note padding of ~0.25 gives ~1.43 — which
  is Sibelius's 32nd (1.41) and LilyPond's (1.5) to two decimals. Model the ink and the bottom of the
  table arrives on its own. (⚠️ Consequence: **P2 cannot ship without a provisional floor**, because
  the ink half does not exist until P3. `MIN_NOTE_SPACING` stays exactly that long, and deleting it
  is P3's definition of done.)

  ⚠️ **REVIEW — the floor binds at the 32nd and SHORTER, and nowhere else.** 1.43 against a curve
  that gives the 32nd 1.24 and the 16th **1.75**: the 16th is already above the floor, so the ink
  does *not* lift it to Gould's 2, and at the 8th the curve is 10% wider than she is, where a floor
  cannot act at all. The reason is in her own numbers rather than in ours — her 16th→8th step is
  ×1.125 and her 8th→♩ step is ×1.556, so **no single ratio fits both**, and √2 splits the difference.
  Two things follow, and both are already scheduled: the real floor is a **measurement**, taken in
  P3, and it may land above 1.43 (MuseScore's note↔note padding is only the last resort in a table of
  pairs); and the ratio is the knob for the rest, looked at by eye once P2 lands (§4).
- **Rests are notes.** One curve, no rest branch. What differs is a rest's *extent* and its padding
  to a barline, which is the other half's business.
- ⭐ **And a FAN's members are notes too — decided 2026-07-30 (his call).** One curve, everywhere. See
  §4, where this was the open question: a fanned group is metrical notation with a ramp drawn over
  it, *"not symmetrical or even"*, so Gould's literal-time-space exception does not reach it. There
  is no per-context `SpacingRule`, and the interface above stays a single value for the whole score.

### 1.2 The unit is a COLUMN, and a column spans the SYSTEM

A column is a rhythmic position at which something starts, holding every event that starts there —
across all voices **and all staves**. One x per column, shared by every staff in the system.

This is the part that is not just a formula change. Today each staff formats in its **own**
`Formatter` (`drawMeasureContent` runs per placement), so staff 1's `♩♩♩♩` and staff 2's `𝅗𝅥𝅗𝅥` are
positioned independently and line up only by accident of the softmax law. In a grand staff that is
wrong: a note at beat 2 on both staves must be at the same x. The note-spacing feature already ran
into exactly this and solved it by shifting *ticks, not slots*
(`docs/note-spacing-plan.md` §4.3) — the model makes it structural instead.

```ts
export interface Column {
  beat: Fraction            // in quarters from the bar's start
  duration: Fraction        // to the NEXT column — what earns the following space
  extent: EventExtent       // the widest ink at this column, over every staff and voice
  authored: number          // client #10's leading space, staff spaces (0 for most)
}
export interface EventExtent { left: number; right: number }   // staff spaces from the head column
export function spaceColumns(cols: Column[], targetWidth: number, rule: SpacingRule): number[]
```

⭐ **REVIEW — VexFlow ALREADY makes a column span the staves, and we are not using it.** One
`Formatter`, `joinVoices` called once **per staff's** voice group, then `format(allVoices, w)`:
`createModifierContexts` keys its map by `tickable.getStave()` (formatter.js:270) so each staff keeps
its own accidental/modifier stacking, while `createTickContexts` is stave-blind — so the **TickContexts
are shared across staves by construction** and every staff's beat 2 is one object with one x. The
per-staff `Formatter` is a property of `drawMeasureContent` running per (measure, staff) placement,
not of the library. So P4 evaluates the primitive FIRST, before building a parallel column list
(`docs/DESIGN-PRINCIPLES.md`, and the standing "check whether VexFlow already does it" rule). It also
retires `applyLeadingSpaces`'s "**the anchor is a TICK, not a slot**" workaround
(`VexFlowRenderer.ts:82-89`), which exists only because a staff with no event at the anchor beat has
no context of its own to shift. What it costs is real and must be priced in P4: culling, the
per-staff scale groups and `openGroup` identity are all per-placement today.

⚠️ **REVIEW — "one x per column" is FALSE once staves have different SIZES.** A small staff draws
inside a `<g transform="scale(k)">` and `localPlacement` (`VexFlowRenderer.ts:174`) divides x by that
scale, so one column is one x **in each staff's own drawing space**: the pass writes `x / sizeₛ` per
staff or every small staff drifts sideways from the system. Same fact on the width side — extents and
the padding table are in staff spaces, so a small staff's are `× sizeₛ` at width time. This is the
documented bug class (*visual coords inside a scaled scope*, `docs/staff-size-plan.md`), and
`layoutConfig.ts:34-40` already carries it as that plan's open P3 for the four width constants. The
spacing model adds a fifth family to the same open question; P3 answers it for all of them or for
none.

⭐ **REVIEW — a FAN occupies a RANGE of columns, and this is the sentence that deletes `fanRoom.ts`.**
§2 says a fan's members become ordinary columns, which is true for the width half — but a fanned slot
is **one** `StaveNote` whose members are drawn by `FanPass`, so there is no tick context to hand a
member's x to. The rule, stated so P5 has a mechanism: a fan **claims** columns `[first … last]` from
the model, its tick context takes the **first** member's x, and its drawn span is `(x of the last
member's column) − (x of the first)`. The ramp then *is* the spacing rule applied to the member
durations — which is what makes `fanRoomPx`, `fanMaxSpanPx`, `FAN_MAX_SPAN_STRETCH` and `trailingGap`
all redundant at once, rather than one at a time.

⚠️ `duration` is **the distance to the next column, not the event's own written value.** In `♩ ♪ ♪`
the quarter's column is followed by an eighth's, so it earns a quarter's space; but in a bar where
voice 2 has an eighth under voice 1's quarter, the quarter's *column* is followed 0.5 beats later and
earns an eighth's space — the note is still a quarter, drawn as one. That is Gould's rule read
correctly (space belongs to the gap, not to the notehead) and it is how MuseScore's
`computeSegmentDurationStretch` handles polyrhythm.

### 1.3 Justification inside the bar: springs

Once we own the x's we must decide how a bar's surplus is shared across its columns. The answer is
Gourlay's spring solve — TeX's glue, and what LilyPond and MuseScore both do:

- each gap has a **natural length** (`followingSpace`) and an **incompressible minimum** (the ink:
  `prev.extent.right + padding + next.extent.left`, and the authored space, which is reserved and
  never squeezed);
- one force is solved for the whole bar; gaps already at their minimum do not move, the rest absorb
  the difference in proportion to their natural length.

⭐ The authored overrides fall out in the new vocabulary rather than needing special cases: client
#10's leading space is *an incompressible addition to one gap* (= "the gap you drag is the gap you
get"), and client #11's bar stretch is *a bigger target width* (= "hand the formatter a bigger box").

⛔ **Justification BETWEEN bars is not touched.** `distributeLineWidths`'s tiered transfer — a bar of
music pays nothing while an empty bar still has slack — is a rule he reported into existence, and
springs do not express it. Springs go *inside* a bar; the tiers stay *between* bars.

### 1.4 ⚠️ REVIEW — where the module lives: `engine/layout/`, not `utils/`

The plan said `utils/spacing.ts`. That is the wrong side of the fence, and the repo says so twice:
`docs/DESIGN-PRINCIPLES.md` §3 names **spacing** as presentation ("pixels, layout, system/page
breaks, spacing… live in the render/viewport layer"), and `CLAUDE.md` puts `utils/**` in the **core**
beside `engine/models/**` and `types/**`, where a score operation goes. A rule measured in staff
spaces is the *editor's* engraving, not the music — `Measure.slots` does not know what a staff space
is and must not learn.

`engine/layout/` is exactly where the derived-view arithmetic already is — `barWidthRoom.ts` (the
gesture's closed form) and `measuredRoom.ts`, whose header states this rule in as many words. So:

- `engine/layout/spacing.ts` + `spacing.test.ts` — the pure rule and the spring solve (P1);
- `engine/layout/spacingPadding.ts` — the pair table (P3), beside it: it is **width-time data**,
  which is why it does not belong under `rendering/` either.

Purity is unaffected — no VexFlow, no DOM, `Fraction` in — and `lint:boundary` is satisfied by both
homes, which is precisely why this had to be decided by hand.

---

## 2. What it deletes

The honest measure of whether it is worth doing. Every one of these exists only because there is no
spacing model:

- `fanColumns` / `slotColumns` / `laneColumns`, `fanRoom.ts` entire (`FanStaveNote` + `shareFanRoom` —
  a module whose only job is to fight the tick-proportional formatter), `FAN_MAX_SPAN_STRETCH`,
  `FAN_MIN_HEAD_GAP_RATIO`, `trailingGap`, `fanTrailingSpacePx`. ⭐ A fan's members become **ordinary
  columns** — `fanMemberBeats` already gives each an exact rational, which the note-spacing §7 work
  proved is a usable address — each with a notehead's extent, and the ramp's shape becomes the
  spacing rule applied to the member durations. The gap after a fan then needs no rule of its own.
- `MIN_NOTE_SPACING` as *the* spacing rule, the `× 1.15` safety buffer (it was compensating for the
  ink sum being the whole answer), `EMPTY_LANE_NOTE_SPACE`'s 40px (✅ deleted 2026-07-30 — a 4/4 bar
  of silence is `followingSpace(whole)`, 7 spaces under Gould's curve and **6.0** under LilyPond's,
  which is the one that ships), and
  `MAX_MEASURE_WIDTH` as a bar's ceiling — the compressed curve is what bounds a bar's ask, so the
  cap goes back to being the preference it always claimed to be.
- `ledgerAccidentalClearance` and `dotPlacement`'s room reservations: extents by another name,
  computed at draw time because nothing asked for them at width time.
- The two-note tremolo's stroke clearance, and every future element that draws its own ink.

⚠️ **REVIEW — but `MIN_NOTE_SPACING` has two readers this list never named, and they are the two
DRAGS.** Deleting it is not three call sites in the width path; it is also the pair of modules that
**invert** the layout so a gesture can follow the pointer:

| site | what it floors |
|---|---|
| `measuredRoom.ts:84` (`measuredShrinkRoom`) | how far a column may still be pulled left — client #10's clamp |
| `measuredRoom.ts:158` (`measuredBarShrinkPx`) | how many px a drawn bar can give back — client #11's shrink |
| `barWidthRoom.ts:350` (`layoutFloor`) | where an empty bar's stretch stops moving the picture |

Each is "the engraver's own floor, measured on the picture instead of predicted", and each must gain
the **ink** minimum in the same commit that removes the constant — a floor that stops matching the
layout does not fail loudly, it lets a barline slide out from under the mouse (the failure
`barWidthRoom`'s §4 exists to prevent). `e2e/barWidth.e2e.ts` is the gate. ⭐ This is scope P3 owns,
not a follow-up: the phase's definition of done is the deletion, so it is also these three.

---

## 3. Phases

Each phase leaves the app working and is separately hand-testable. **P0 first** — nothing can be
called an improvement without a before.

### P0 — measure the present ✅ DONE 2026-07-30
A census of the drawn gaps, **in the browser** (headless every glyph measures 0 — research §5.4, so
this cannot be a unit test). Four fixtures: a dense bar, a sparse bar, a bar of accidentals, a bar
with a fan. Report each column's gap in staff spaces plus the bar's width, so P2 and P4 can be
diffed against it rather than argued about.

- `src/dev/spacingCensus.ts` — the arithmetic (pure, unit-tested on fixtures) plus a DOM reader and
  `__spacing.dump()`, the console table for the score on screen, because he reads by eye.
- `e2e/spacing.e2e.ts` + `harness.columnGaps()`, which feeds the SAME arithmetic from the readers
  the harness already had, so the number a spec pins and the number he reads cannot drift apart.
- 📄 **The numbers are `docs/spacing-model-research.md` §6.** The 12 px inset needed no subtracting
  in the end: a gap is a difference between two columns, so the inset cancels; it survives only in
  the census's `lead`, which is documented as not being a spacing number.

🚨 **What P0 changed in this plan.** The measurement contradicts §0 on the mechanism, and agrees
with it on the diagnosis — twice over:

- **`MIN_NOTE_SPACING` decided none of the five fixtures.** §0's *"a floor per event … is what
  actually spaces most bars"* was read off the code and is false on the page. The ink term wins
  wherever a note carries any ink, and `MIN_MEASURE_WIDTH` (10 spaces) / `MAX_MEASURE_WIDTH` (40)
  win at the two ends. ⭐ Consequence for §3: **the sparse and dense fixtures cannot judge P2** —
  both bars are pinned at a constant, so nothing the duration rule says can show through until
  §4's "how much may a bar compress" question is answered. Pick a mid-density bar to judge P2 on.
- **The order is INVERTED, not flat.** An eighth is drawn 3.36 spaces and a quarter 1.94, because
  the width pass builds `StaveNote`s with **no beams**, so every eighth reserves room for a flag
  that the drawing then never emits. ⭐ P2 inherits this: the columns it builds must be measured
  the way the music is *drawn*, or the ink half arrives in P3 already wrong. ⚠️ It is also the
  cleanest reading yet of why §1's `max` is the right shape — today the ink either replaces the
  rule outright (a sharpened quarter gets 3.75, overshooting Gould's 3½) or takes no part in it
  (a bare quarter gets 1.94), and it is never the *minimum under* a duration.

### P1 — the rule, pure, with no caller ✅ DONE 2026-07-30
`engine/layout/spacing.ts` (⚠️ §1.4, not `utils/`): `followingSpace`, `spaceColumns` (the spring
solve), `SpacingRule` with the defaults from §1.1. No VexFlow, no DOM, `Fraction` in.

- `engine/layout/spacing.test.ts` — **Gould's eight values are the spec**: `2 · 2¼ · 3 · 3½ · 4 · 5 ·
  6 · 7` over `1 : 2 : 3 : 4 : 6 : 8 : 12 : 16`. ⚠️ **REVIEW — assert them at ±1% for five of the
  eight and pin the other THREE at their measured error** (16th −12.5%, 8th +10.0%, dotted quarter
  +7.2% — §1.1's table). Naming them as "the ink floor" would be a fiction: the floor binds only at
  the 32nd and shorter, and the 8th misses in the direction a floor cannot move. A pinned number that
  says *this is where our curve leaves Gould* is a test; a tolerance loose enough to swallow 12.5% is
  not. Plus the invariants: monotonic, compressed (`s(2t) < 2·s(t)`), **meter-independent** (the same
  duration gets the same space in 2/4 and 4/4 — the defect in §0), and the spring solve holding a
  rigid minimum while sharing a surplus.

**As built** — 31 tests, and three things the plan left for the writing:

- ⭐ **A gap is THREE numbers, not two.** `spring` (the rule, elastic, shares the surplus in
  proportion), `floor` (`prev.extent.right + padding + next.extent.left` — the ink, never yields) and
  `rigid` (authored space, held out of the negotiation altogether, so *the gap you drag is the gap
  you get* survives both a squeeze and a stretch). §1.3 named all three; separating them is what lets
  one solver do compression and justification with no branch.
- ⚠️ **Padding is a field on `Column`**, not a term the rule can compute: P3's table is keyed by the
  **pair** of things, which is a caller's question. `Column` is therefore
  `{ beat, duration, extent, padding, authored }` — the §1.2 shape plus that one.
- ⭐ **`naturalWidth(columns)` is exported beside `spaceColumns`** — the bar's own ask, and literally
  what P2 hands the casting-off in place of `max(vexflowInk × 1.15, columns × MIN_NOTE_SPACING)`.
- ⚠️ **The freeze loop is ITERATIVE and the test says why**: paying for one gap's floor raises the
  force on the rest, which can drive a second onto its own. A single pass compresses straight
  through it.
- ⚠️ **An impossible target comes back OVERFULL, never collided.** A floor is not negotiable, so ask
  for less room than the ink needs and the last x exceeds `targetWidth` — the bar width is the thing
  that should have asked for enough, and a bar that reports its told width while drawing notes on
  top of each other is the failure this model exists to end.

### P2 — the WIDTH pass asks the rule ✅ DONE 2026-07-30
`MeasureLayout.noteSpaceForLane` sums the rule over the bar's columns instead of
`max(vexflowInk × 1.15, laneColumns × MIN_NOTE_SPACING)`. Duration enters bar width for the first
time. Columns are built once per measure across staves (§1.2), so the max-over-staves in
`calculateMinimumMeasureWidth` becomes a *merge* over staves.

- ⚠️ Keep the provisional ink floor (§1.1) — no extents exist yet.
- ⚠️ `MeasureWidthCache`'s `laneFingerprint` memoizes on `Measure` content; the column merge is
  per-measure and still content-derived, so the memo survives — but it must key on **the merged
  columns**, not one lane, or two staves with different rhythms collide.
- `MeasureLayout.spacing.test.ts` — the headline assertion works headless because it is duration-only:
  a bar of sixteen 16ths is **2×** a bar of four quarters, not 4×.
- Compare against P0. ⭐ Nothing should move much for ordinary **single-voice** quarter-note music;
  dense bars should narrow and long-note bars widen.

⚠️ **REVIEW — two things WILL move at P2 that the sentence above hides, and both are hand-tests.**

- **Multi-voice bars narrow, a lot.** Today's floor counts **slots**, not columns: `laneColumns` sums
  per slot and `MeasureLayout.ts:163-169` says so and says why (a floor counted differently from the
  width it floors makes the bar incompressible). A two-voice bar of `♩♩♩♩` over `♩♩♩♩` claims **8**
  columns today and **4** under §1.2. That is almost certainly right — one x per beat is the whole
  point — but it is a visible change on every piano score, and it is the P2 by-eye test.
- **Empty bars get WIDER, into an open complaint.** `EMPTY_LANE_NOTE_SPACE` is 40 px;
  `followingSpace(𝅝)` is 7 spaces = **70 px**. §2 files that as adopting Gould's number instead of
  ours, which it is — but `MeasureLayout.ts:321` carries a 🔴 KNOWN-INCOMPLETE saying empty bars
  already do not shrink as far as he has asked, reported three times. P2 pushes the wrong way on
  that. Decide it deliberately: either the empty-bar floor stops being the duration rule (an empty
  bar's width is a *default*, not music — which is the argument `measureWidthParts` already makes for
  treating its stretch differently), or `docs/bar-width-plan.md` "Known issues" #1 is answered first.

**As built** — `engine/layout/measureColumns.ts` (the merge) + `noteSpaceForMeasure` in
`MeasureLayout`, 13 + 5 tests, and the e2e census inverted. Measured on the page, in staff spaces:

| fixture | room before | room after | Gould |
|---|---|---|---|
| 16 × 𝅘𝅥𝅯 | 32.2 — `MAX_MEASURE_WIDTH`, to the pixel | **30.5** | 2× the quarters |
| 8 × ♪ | 26.1 — the ink, counting flags never drawn | **20.1** | 1.41× the quarters |
| 4 × ♩ | 8.3 — `MIN_MEASURE_WIDTH`, to the pixel | **14.3** | — |

⭐ 30.5 / 14.3 = **2.13** where Gould says 2 (it was 3.9, i.e. ∝ event count), and 20.1 / 14.3 =
**1.41**, the ratio to three figures. A drawn quarter went 1.94 → **3.81** spaces and a drawn eighth
3.36 → **2.52**: the inversion P0 found is gone, and both ends stopped being a constant.

Six decisions the writing forced:

- ⭐ **An EMPTY bar keeps `EMPTY_LANE_NOTE_SPACE`, and the rule does not govern it** — the open
  question above, decided. Under the curve a bar of silence would go 40 px → 70; he has reported
  three times that empty bars *already* do not shrink far enough, so widening them pushes the wrong
  way on a live complaint. An empty bar's width is a default, not music, which is the argument
  `measureWidthParts` already makes about its stretch. ⚠️ A bar of AUTHORED rests is not empty and is
  spaced by the rule like anything else.

  🚨 **REVERSED, 2026-07-30, and it was the right question with the wrong answer.** The complaint this
  protected is about empty bars MID-LINE, and the flat default was never what decided those — the
  `MIN_MEASURE_WIDTH` floor was, and still is (the rule asks 7.65 spaces for a bar-long silence in
  4/4, under the 10-space floor). What the default *did* decide was the one bar the floor could not
  reach: a system-opening empty bar, whose header ate the whole floor, leaving **3.78** spaces of
  music against a mid-line bar's 8.85 — reported, and correctly. `EMPTY_LANE_NOTE_SPACE` is deleted:
  a bar of silence is one column and the rule prices it like any other duration (6.0 spaces in 4/4,
  4.8 in 2/4, 6.7 in 12/8), which is also what LilyPond does with a full-bar rest
  (`MultiMeasureRest.space-increment`). Mid-line bars come out UNCHANGED, so the live complaint is
  not pushed on. `docs/spacing-model-research.md` §6c has the measurements, the sources, and the
  wrong fix that came first.
- 🚨 **The VexFlow ink term is GONE, and could not be kept even as a floor.** P0 measured why: for 8
  eighths the ink term (with flags the drawing never emits) comes to more than the rule, so keeping
  it as a `max` would have preserved the inversion exactly. Deleting it also makes `MeasureLayout`
  **framework-agnostic again** — no `Voice`, no `Formatter`, no `NoteBuilder` in the width path.
- ⚠️ **`MeasureWidthCache` is no longer consulted**, and that is a measurement not a guess: it
  memoized the formatter, and `laneFingerprint` (a `JSON.stringify` of the measure) now costs more
  than the arithmetic it would save. The option stays on the API because P3 puts it back.
- ⚠️ **A fan still takes the OLD `fanColumns` claim** while `fanRoom.ts` buys its drawn span that
  way. The model gives a fan's heads what they need; `fanColumns` asks for `ceil(span/tightest)+1`,
  several times more, and a bar narrower than the span the drawing insists on is his reported
  screenshot — heads through the barline. ⛔ Deleted **with** `fanRoom.ts` at P5, not before.
- ⭐ **`minimumWidth()` joined `spacing.ts`** — the incompressible sum. The floor and the width MUST
  come from one column list: the old pair counted slots in both deliberately, and a floor counted
  any other way than the width it floors makes a bar incompressible.
- ⚠️ **Three tests were pinning things that were not true.** `barWidth`'s "the stretcher pays part of
  its own stretch" passed on a 14th-digit float accident and contradicts `distributeLineWidths`'s own
  *"a grown bar never pays"* — now asserted as equality. `barWidthNudge`'s "the room goes to the bar
  with music" holds for two presses and then the freed room admits an eighth bar onto the line, which
  is casting-off working; and its sibling asserted a fraction of a starting width where the claim is
  the floor. All three are re-pinned on what the code actually promises.

⏭️ **Not done here, and owed to P4:** the gaps INSIDE a bar are still VexFlow's softmax. P2 decides
how much room a bar asks for; sharing it out among the columns is P4's, which is why the e2e
assertions moved to a bar's ROOM and to RATIOS BETWEEN bars.

### P3 — the ink half: extents and a padding table ✅ DONE 2026-07-30
- `EventExtent` per column, collected from `Note.getMetrics()` — VexFlow already decomposes exactly
  Gould's extent (`modLeftPx / leftDisplacedHeadPx / notePx / rightDisplacedHeadPx / modRightPx`,
  research §5.3). ⭐ **No new font machinery**: the width pass already builds throwaway `StaveNote`s,
  and in the browser those metrics are real. (Bravura via the already-vendored `opentype.js`, or
  SMuFL's `bravura_metadata.json`, stay an escape hatch if we ever need extents headless — not now.)
  ⚠️ **REVIEW — the width pass's notes have NO STAVE**, and that changes one extent. `noteSpaceForLane`
  never calls `setStave`, and `Accidental.format` has a no-stave branch (accidental.js:38-55) that
  stacks on `props.line` instead of the stave's y — so a chord's accidental column can measure
  differently at width time than it draws. Either give the width pass a throwaway `Stave` (it already
  builds throwaway everything else) or accept the difference and pin it in `e2e/`. ⛔ What is not an
  option is measuring one and drawing the other silently.
  ⚠️ And a **small staff's** extents are `× sizeₛ` — §1.2's second REVIEW note; the same open P3 of
  `docs/staff-size-plan.md`.
- `engine/layout/spacingPadding.ts` (⚠️ §1.4, not `rendering/`) — **a table keyed by the pair of things**, in staff spaces, in
  the style of `ELEMENT_SPECS`: note↔note, note↔accidental, note↔ledger, note↔rest, dot↔note,
  rest↔barline, note↔barline, flag↔barline… Seeded from MuseScore's published table (research §3),
  then corrected by eye. ⛔ A new element that draws ink adds a **row**, never a constant elsewhere.
- ⭐ The **barline is a column** with its own extent, so the gap before it stops being
  `BARLINE_PADDING` and becomes note↔barline / rest↔barline — which is what keeps the last 16th of a
  dense bar from sitting 0.6 spaces from the line.
- Now `MIN_NOTE_SPACING` can be deleted, and its deletion is the phase's definition of done.
- Unit tests take extents as **fixtures** (they must: research §5.4); the real numbers are pinned in
  `e2e/`.

**As built** — `engine/layout/spacingPadding.ts` (the table) + real extents in `measureColumns`,
33 unit tests and 4 new browser ones. Five decisions, and the first is a deviation from the plan:

- 🚨 **The extents are a MEASURED TABLE, not `Note.getMetrics()`.** The plan's mechanism assumed the
  width pass still builds throwaway `StaveNote`s — **P2 deleted that**, and with it the coupling to
  VexFlow. Bringing it back would have cost three things at once: `MeasureLayout` stops being
  framework-agnostic, the width cache has to come back, and — the one that decides it — **every
  extent measures 0 in jsdom**, so the drag floors below would be floored at *nothing* in every unit
  test that guards them. So the numbers were measured in Chrome, one glyph at a time, and written
  down: notehead 1.13, sharp 1.40, flat 1.30, natural 1.10, double-flat 2.10, each further accidental
  column +1.30, first dot 1.70, each further dot +0.90. ⭐ The plan's ⛔ is honoured by the other
  half: `e2e/spacing.e2e.ts` **re-measures all of them in a browser and fails if the drawing has
  moved**, so the table cannot silently stop describing the ink. (Measured against it today:
  notehead 1.125 vs 1.13, sharps and dots exact.)
- ⭐ **Accidentals share a column at a SEVENTH, and stack at a sixth** — measured one interval at a
  time rather than assumed, and it is the engraver's own rule, so the drawing and the tradition
  agree. `accidentalExtent` stacks greedily from the top down, which is what VexFlow does.
- ⭐ **Which accidentals are DRAWN comes from `displayedAccidentals`, not from `alter`** — the same
  pure walk `NoteBuilder` uses, at the same (staff, voice) scope. Four C♯s in a bar draw one sign;
  reading `alter` would have reserved room for four.
- ⚠️ **`MIN_NOTE_SPACING` is not deleted, and cannot be until P5.** It has exactly one owner left —
  `fanColumns`, which counts a fan's claim in units of "one ordinary event's column", and which
  `fanRoom.ts`, `FanPass` and `MeasureLayout`'s interim floor all read. Its four *spacing* readers
  are gone: `measuredRoom` ×2, `barWidthRoom` and the empty-bar clamp now use `MIN_COLUMN_GAP`
  (**1.43** spaces — a notehead plus note↔note padding) and `EMPTY_BAR_FLOOR_PX`. ⭐ Two things fell
  out: the drag floors are now in STAFF SPACES, so a small staff floors at its own smaller number
  instead of an absolute pixel count; and the old constant's own doc gave the game away — it called
  itself *"minimum space between notes for **clickability**"* while being used as the engraving rule,
  which `layoutConfig`'s INK-vs-FINGER rule says is two different things.
- 🚨 **A real bug the lower floor exposed, and `e2e/barWidth.e2e.ts` caught exactly as §2 predicted.**
  `distributeLineWidths` shares a line out in proportion to `naturalWidth` and only ever *takes* down
  to `floorWidth` — so a claim that was already **under** its floor was never put back. One −500 px
  press on a bar of four quarters bottomed out at `BAR_STRETCH_MIN` and drew five staff spaces of
  music into four, with the last notehead on the barline. `measureWidthParts` now clamps the shrink
  at the bar's own ink. The clamp was always owed; 1.8 was just generous enough to hide it.

### P3.1 — the ink the table was missing ✅ DONE 2026-07-30
Reported by eye on two of his own fragments, measured, and fixed. *"We should do everything industry
standards do unless there is a really sound reason not to"* — his call, and it is the rule that
settles the invariant below.

- ⭐⭐ **LEDGER LINES were not in the ink model at all**, and `note↔ledger 0.35` is in the very
  MuseScore table research §3 quotes. Measured on our own drawing: a ledger runs **−0.30 to +1.50**
  of the notehead's anchor — **1.80 spaces against a bare head's 1.13**, overhanging on both sides,
  and the same length at every pitch. A run of ledgered 32nds was drawing its gaps at 1.64 spaces, so
  consecutive ledgers **overlapped by 0.16** and read as one long line through the notes. Now 0.03,
  i.e. touching by a quarter-pixel; P4 makes it a hard zero (the bar is wide enough, the split inside
  it is still VexFlow's).
- ⭐ **Rest widths are per DURATION, and the SHORT rests are the WIDE ones** — 16th 1.30 and 32nd
  1.50 against a quarter's 1.10 and an eighth's 1.00, because each flag leans further right. P3
  shipped one flat 1.2, which was generous for an eighth and 20% tight for a 32nd: backwards exactly
  where it matters.
- 🚨 **THE CLEF IS AN INPUT TO THE WIDTH NOW, reversing `reference_spacing_rules_must_be_clef_independent`
  and inverting `MeasureLayout.clefWidthIndependence.test.ts`.** That invariant rested on two claims
  and both had expired: the **cost** (the clef in the width-cache key re-ran the formatter on 260
  bars — 293 ms, 47% of layout; there is no formatter and no memo in this path since P2), and **"a
  clef cannot change the answer"** (true while the ink was a notehead and an accidental; false the
  moment ledger lines are in it, since whether a note has one is a fact about where it SITS). The
  test now asserts the reversal in both directions: a clef changes a width **through ledgers**, and a
  clef that changes no note's ledgers changes no width. ⚠️ The SHAPE key already carried the clef
  (`MeasureRedrawKey`), so incremental redraw was never at risk.
- ⚠️ **Test fixtures on C4 were measuring ledger ink without knowing it.** Middle C is a ledger note
  in treble *and* in bass — it is on the staff only in alto. Every "a plain note reaches exactly one
  notehead" fixture moved to **B4, the middle line**.

⏭️ **Still owed from the same family** (his fragments, in his priority order): the space AFTER a
barline (two constants stack — our `BARLINE_PADDING` and VexFlow's 12 px `Stave.padding` — and
nothing owns it; belongs with §4's "header as columns"), the first column's LEFT extent (never
counted: `naturalWidth` sums the gaps *between* columns, so an accidental on a bar's first note buys
no room), and vertical clearance / kerning. ✅ The line's surplus is fixed — it is shared by
`naturalWidth − overhead` now, so the same duration is drawn the same width across a system
(`docs/vexflow-boundary.md` §6).

### P3.2 — the bar's LEAD-IN, taken back from VexFlow ✅ DONE 2026-07-30
His report: *"in bar 2 I don't know why there is such a huge empty space between the barline and the
accidental… it is completely useless."* Measured at **1.9 staff spaces** of blank, and none of it
was ours: VexFlow starts a headerless bar's notes 1.7 spaces in (5 px of `Stave.startX` plus a 12 px
`Stave.padding` that `Note.getAbsoluteX` adds to every note), whatever the bar opens with.

⭐ Answered with his own rule — *"if on some occasions we can take control over VexFlow's decisions
and this is an improvement, we should do it."*

- ⭐⭐ **The lead-in is a pair now**: `barline↔note` (or ↔accidental, ↔rest) **plus the first
  column's own left ink** — and that second half was reserved by nobody. `naturalWidth` sums the gaps
  BETWEEN columns, so `columns[0].extent.left` appeared in no gap: an accidental on a bar's first
  note bought **no room at all**, and the drawing took it out of everything else in the bar. That is
  the second half of his *"the accidentals are stealing space from the notes"*.
- ⭐ **The drawing honours it** — `applyLeadIn` sets `stave.setNoteStartX`, for bars that draw no
  header. His bar 2's sharp moved from **1.9 → 1.4** spaces after the barline; a plain bar's lead-in
  went **1.7 → 1.2**. ⛔ Where there IS a clef or meter, `getNoteStartX` is the sum of those glyphs
  and stays VexFlow's until the header becomes columns (§4).
- ⚠️ **The two halves go to different readers.** The WIDTH reserves `padding + extent`; the DRAWING
  positions on `padding` alone, because VexFlow's formatter already shifts the first tick context by
  that column's ink. Paying both in the renderer makes the blank WIDER — measured, on the first try.
- ⚠️ **`BARLINE_PADDING × 2` was DOUBLE-COUNTING since P3.** The trailing side became the barline
  COLUMN's gap, so every bar was reserving three spaces of barline padding where it owes two.
- ⚠️ **`barline↔note` is 1.2 against the trailing 1.0, and the odd number is honest.** VexFlow's
  12 px `Stave.padding` has no public setter, and a lead-in under 1.2 spaces can only be drawn by
  pushing the note-start left of the barline — which puts a bar's clickable area outside the bar
  (`tier1Geometry.test.ts` pins that it may not). 1.2 is the tightest the drawing and the model can
  BOTH say, and saying the same thing is the property worth having.
- 🚨 **`getNoteStartX()` has always been 12 px short of where the ink begins**, because
  `Note.getAbsoluteX` adds `Stave.padding` and the stave does not. Everything that read it — hit
  testing, pixel↔beat, `measuredBarShrinkPx`, the measure-rest centring — was reading a number 1.2
  staff spaces left of the truth. It cancelled out of most comparisons while every bar had the same
  error; it stops cancelling the moment the lead-in is ours. `noteStartOf(stave)` is the corrected
  reader, and `centerMeasureRests` had to move with it or every measure rest sat 6 px off-centre.

⏭️ Still owed from his reports: vertical clearance / kerning. ✅ The line's surplus is fixed — see
`docs/vexflow-boundary.md` §6, and `e2e/spacing.e2e.ts`'s *"the SAME DURATION is drawn the same
width across a system"*.

### P4 — the renderer takes over x ✅ DONE 2026-07-30
Format at minimum width, then write our x's onto the tick contexts. The seam exists and is proven:
`applyLeadingSpaces` (`VexFlowRenderer.ts:96`) already walks `formatter.getTickContexts()` and calls
`setX`, and `getAbsoluteX()` reads the context lazily at draw — so beams, ties, tuplets, accidentals
and the `ElementRegistry` all follow. `applyLeadingSpaces` stops being a feature and becomes one term
in the pass.

⚠️ **REVIEW — the seam is real but its stated REASON was wrong, and the true one is stronger.**
`postFormat()` does **not** run inside our `format()`: `Formatter.format` calls it only
`if (opts.stave)` (formatter.js:600) and we format without a stave (`VexFlowRenderer.ts:1781` — the
renderer's own comment at `:725` already knew this, while `applyLeadingSpaces`'s doc-comment at `:72`
and research §5.5 say the opposite. Research §5.5 is corrected; ⏭️ **the code comment at `:72` is
still wrong and is owed a one-line fix** — a repo fact that rotted, cf.
`reference_repo_fact_comments_need_a_check`). It would not matter if it did:
`TickContext.postFormat` is a no-op latch. The load-bearing fact is simply that **nothing between
`format()` and `draw()` reads or rewrites `TickContext.x`** — so the last `setX` wins, full stop.

⚠️ **REVIEW — three arithmetic facts the pass needs, from the source:**
- `getAbsoluteX() = tickContext.getX() + stave.getNoteStartX() + Metrics.get('Stave.padding')`, and
  `Stave.padding` is **12** (metrics.js:132). Every note carries that inset. It is also what the
  unexplained `− 15` at `VexFlowRenderer.ts:1774` has been approximating.
- `format(voices, 0)` is the "minimum width" call: `preFormat` returns straight after laying the
  contexts at their minimums when `justifyWidth <= 0` (formatter.js:338) — cheaper than formatting to
  a width we are about to overwrite. ⚠️ It also skips `shiftToIdealDistances`, which is where VexFlow
  sets `centerXShift`; we already centre measure rests ourselves (`centerMeasureRests`, `:2182`), so
  that is a wash — but it must be checked, not assumed.
- `TickContext.setX` resets `xBase` and zeroes `xOffset`. Anything that sets an *offset* must
  therefore run after the pass, never before it.

- `engine/rendering/spacingPass.ts` — the adapter: collect extents from the built notes, call
  `spaceColumns`, write the x's. The **one** caller of the pure rule from the renderer. (⭐ The
  adapter is the renderer's; the *rule* stays in `engine/layout/` — §1.4.)
- ⚠️ Ordering inside `drawMeasureContent`: the pass replaces `shareFanRoom` (pre-format) and absorbs
  `applyLeadingSpaces` (post-format), and must land **before** `centerMeasureRests`, the multi-voice
  re-assert and `applyNoteOffsets` (`:1783-1818`) — all three read or rewrite positions.
- VexFlow's softmax stops mattering. The per-staff formatters keep formatting (they still lay out
  accidentals, beams and stems) but no longer decide horizontal position.
- ⚠️ The **preview ghost** formats its own temporary stave and must run the same pass, or a ghost sits
  where the note will not (already a known gap — `docs/note-spacing-plan.md` §4).
- ⚠️ `CoordinateMapper`/`ElementRegistry.pixelXToBeat` interpolate through drawn columns; they get
  *more* correct here, but the geometry suite must be re-run either side.
- A **temporary** `dev/` toggle to A/B the old and new spacing, so he can compare by eye on real
  scores. Removal condition stated in the code: it goes when P5 lands.

**As built** — `engine/rendering/spacingPass.ts`, ~40 lines, called between `format()` and
`centerMeasureRests`. **Measured on the page, and the rule is now what is drawn:**

| | before the model | after P2/P3 | after P4 | the rule |
|---|---|---|---|---|
| a quarter | 1.94 | 3.72 | **3.60** | 3.6 |
| an eighth | 3.36 | 2.48 | **2.40** | 2.4 |
| a 16th | 1.99 | 1.75 | **1.80** | 1.8 |
| a 32nd | – | 1.43 (the ink) | **1.50** | 1.5 |
| quarter ÷ eighth | 0.58 | 1.51 | **1.50** | 1.5 |

⚠️ The "after P4" column is against **LilyPond's** curve — §1.0. P4 landed on the √2 law and the
curve changed the same day; what P4 itself proved is that the drawn gap is the RULE's, whichever
rule is in force.

⭐ On his own fragments: bar 2's quarter:16th ratio went **1.54 → 2.005** (Gould's 2.0); a half rest
after sixteen 32nds went from **2.68 → 5.67** spaces (the rule owes it 4.95); and in a ledgered run
the ledgered gaps now come out at **2.15** and the on-staff ones at **1.43** — each gap taking its
own ink, which is the thing no single formatter law can do.

Four decisions:

- ⭐ **The staves align WITHOUT one shared `Formatter`.** §1.2's review said to try VexFlow's own
  primitive first (`createTickContexts` is stave-blind). It is not needed: every staff is handed the
  **same merged column list** and writes the same x's, so they agree by construction — and
  `drawMeasureContent` keeps running per (measure, staff), which culling, the per-staff scale groups
  and `openGroup` identity all depend on.

  🚨 **AS SHIPPED IT DID NOT DO THIS, and the bug lasted until 2026-07-30.** `drawMeasureContent`
  destructures `view` — the staff's LANE — as `measure`, so both the column list and the lead-in were
  resolved per staff and each staff spaced itself as though alone on the page. Reported on a grand
  staff (*"vertically the second stave doesn't match with the first, this is wrong notation"*) and
  measured at **1.0 / 1.7 / 2.4 staff spaces** of drift across one bar — a shift plus a scale. ⭐ The
  lesson is about the SENTENCE, not the arithmetic: "every staff is handed the same merged column
  list" was written here, in `spacingPass`'s own doc, and in `ARCHITECTURE.md`, and was true in the
  WIDTH path only. A claim that one number is shared needs a test that two readers get the same
  number — `e2e/systems.e2e.ts` has it now, and the second half of the same rule with it (a clef
  change on one staff must not move that staff's music out of line: the note start is the widest
  header on the SYSTEM, which is what the width path always reserved).
- ⚠️ **`firstX` is the first column's left ink, not zero.** VexFlow's formatter shifts the first tick
  context right by that column's ink; writing x's ourselves throws that shift away, and without
  putting it back an accidental on a bar's first note draws to the LEFT of its own barline.
- ⛔ **The pass does not run on a bar holding a FAN.** Its members are drawn across a span `fanRoom`
  buys from the formatter, and moving the group's tick context out from under that span is P5 — the
  phase that replaces the span with the members' own columns.
- ⚠️ `applyLeadingSpaces` still runs, **after** the pass rather than absorbed into it: it adds a
  delta on top of an absolute x, which composes correctly. Folding it into `Column.authored` is
  tidying, not behaviour.

⏭️ Owed: the **preview ghost** formats its own temporary stave and does not run this pass, so a
ghost can sit where the note will not (the plan named it; `e2e/ghosts.e2e.ts` is still green because
a cursor ghost is positioned at the pointer).

### P5 — delete the workarounds ✅ THE FAN DONE 2026-07-30
§2's list, one feature at a time, each with its geometry spec still green: the fan first (five
constants and a module), then the tremolo, then the two draw-time clearance passes.

**The fan, as built.** All five constants and the module are gone, and `MIN_NOTE_SPACING` with them:

| deleted | what it claimed |
|---|---|
| `fanRoom.ts` entire — `FanStaveNote`, `shareFanRoom`, `fanRoomPx`, `fanMaxSpanPx` | the room a fan buys from the formatter, and the ceiling on its drawn span |
| `FAN_MAX_SPAN_STRETCH` (1.5) | how far a justified bar may stretch the ramp |
| `FAN_MIN_HEAD_GAP_RATIO` (1.25) | the closest two fanned heads may come |
| `trailingGap` (= `MIN_NOTE_SPACING`) | what the group leaves after itself |
| `fanColumns` / `slotColumns` / `laneColumns` | the room the bar is asked for |
| ⭐ **`LAYOUT_CONFIG.MIN_NOTE_SPACING`** | the editor's whole spacing rule, once |

⭐ **One line did it.** `fannedBeamGeometry` computed each gap as *that member's proportional share
of whatever room the bar gave*; it now computes `followingSpace(member.quarters)` — the same rule
that spaces every other note, asked of an arbitrary rational. A ramp with a natural size does not
sprawl into a bar that happens to be wide, so the cap goes; and `measureColumns` already gives every
member a real column, so the bar asks for exactly their room and the proxy goes. The five constants
were five answers to one question that now has a rule.

### 3a. ⭐ …and the ramp SPENDS the room its columns were granted (2026-07-30)

**His report, the same day:** *"normally when we do that in a slot normal measure the notes grow
proportionally in space, in the case of fan we are just separating the bar from the fan, but the note
space in the fan don't grow in space"* — drag a barline to widen a bar and everything in it spreads
**except** a fan, whose share opens up as air between the group and whatever follows it.

**The half that was missing.** The reservation was already right: `measureColumns` counts a member
like any other column, so the spring solve stretches those gaps by the same force it applies to the
whole bar. Nothing SPENT the answer. A fanned slot is one `StaveNote`, so there is no tick context at
member beat *k* and `spacingPass` cannot write those x's (`if (!context) continue`); the only thing
the solve moved was the *next* real column, which the fan reads as `spanEndX` — a clamp. So the ramp
built itself from its members' own durations alone, in a bar that had just been told to be 3.2× as
wide.

| | before | now |
|---|---|---|
| what the bar reserves for the members | the solved (stretched) column gaps | unchanged |
| what the ramp draws | `followingSpace(member)`, absolute | that, scaled to the room its own columns were granted |
| a bar stretched ×3, fan alone in it | the group unchanged, ×3 of air after it | the group ×3, air after it unchanged |

⭐ **The seam is the solve's own answer, not a second rule.** `applySpacingPass` now RETURNS its
solved columns (`SpacedColumns`), the renderer keeps them on the pass (`RenderPass.solvedColumns`),
and `engine/layout/fanRampRoom.ts` reads back one number: the distance between the fan's first and
last member column. `FannedBeam` scales the earned ramp to it. The ratio between "what the members
earn" and "what their columns were given" **is** the force the solve applied to every other gap in
that bar, so the fan stretches with the music around it by construction.

⚠️ **What did NOT change, and both are his calls:** the authored space still comes off the top
unscaled (a nudge is a width, not a share), and `spanEndX` is still the hard clamp — the room bought
by dragging the note AFTER a fan still opens between the group and that note
(`FanPass.fanTrailingSpacePx`), which is what he asked for on 2026-07-29 and called "normal" again
here.

⚠️ **A guard changed sides.** `e2e/fan.e2e.ts`'s *"a fan given far more room than it needs does not
sprawl into it"* (from `534dcc4`, ten commits BEFORE the rule above) capped a stretched bar's effect
on the ramp at 1.6×. It was written when a fan's room came from a cap constant and the model reserved
nothing for its members. It now asserts the rule: the ramp grows with the bar, never by more than the
bar itself grew, and the group still stands clear of the barline.

Also gone: the `fanFloor` interim in `MeasureLayout`, and `spacingPass`'s "skip any bar with a fan".
A fanned bar is an ordinary bar now — its slot's tick context takes the first member's column like
any other note.

⚠️ **The visible change, and the thing to look at by eye.** A fan of six over a half note used to
draw its gaps at **4.63 → 1.85** staff spaces (ratio 2.5, span 16.2); it now draws **2.51 → 1.71**
(ratio 1.47, span 10.5), and its bar went 28.8 → 25.5 spaces. **The heads fan less than the beam
does.** That is the rule talking and it was his call in advance — *"it does not have to be linear, it
is not symmetrical or even, we should follow Gould's rule"* — but it is exactly what §4 said to watch.
⭐ If it reads too flat the knob is the SPACING RULE's own shape, one field for the whole score, and
LilyPond's log law (the default) is the flatter of the two we have: it was chosen for a NARROW
dynamic range, which is what dense music wants and what a gesture built on contrast does not.

---

## 4. ⏭️ Open decisions (musician's calls)

- ✅ **Does a FAN space linearly? — NO. Decided 2026-07-30 (his call).** The question was whether a
  fan's members want **ratio 2.0** (truly proportional) while the music around them uses √2, on the
  reading that Gould's "exact mathematical ratio **only** when metrical notation is superseded by
  literal time-space notation" makes a fanned beam time-space notation. It does not: **a fan is not
  symmetrical or even** — its members are written values with a ramp drawn over them, and the ramp is
  the sign of the accelerando, not a claim that the page is a clock. So Gould's ordinary rule applies
  inside a fan exactly as outside it, on each member's own duration.

  ⭐ **The consequence is one rule for the whole score**, and the per-context `SpacingRule` dies
  before it is built (§1.1). What to watch by eye at P5: the heads now fan **less** than the beam
  does — a 32nd→8th ramp spaces its members 1.50 → 2.40 (×1.6 under LilyPond's curve; it was ×2
  under √2) where a linear rule would give ×4. If
  that reads wrong, it is the *ratio* that is wrong, and it is one field for the whole score rather
  than a second rule for one gesture. ⚠️ It also leaves `docs/note-spacing-plan.md` §7.3's worry —
  the picture drifting from the sound inside a long ramp — open rather than settled; it belongs to
  the fan, not to the spacing model.
- **How much may a bar compress before it takes a whole line?** MuseScore does not clamp: it squeezes
  in steps (paddings by 0.2, duration stretch by 0.33) and only then allows collisions. Our
  `MAX_MEASURE_WIDTH` is a hard number nobody chose musically. A ladder is better; how many rungs is
  taste.
- ✅ **The exact curve — DECIDED 2026-07-30 (his call, by eye): LilyPond's.** This entry asked which
  ratio, assuming a power law; the answer turned out to be a different *shape*. See §1.0. The knob
  that remains is `LILYPOND_SPACING.base` (1.2 staff spaces per doubling) and its `shortest`
  reference (an eighth), either of which is one field.
- **The header as columns** (clef, key, meter with real extents, deleting `CLEF_WIDTH`,
  `CLEF_CHANGE_WIDTH`, `TIME_SIG_WIDTH`) — the same idea one step further, deliberately left out of
  the phases above to keep P3 finishable.

---

## 5. Verified against VexFlow 5.0.0 (2026-07-30)

Read in `node_modules/vexflow/build/esm/src`, so the plan rests on the source rather than on the
docs. ✅ = the plan's claim held; ⚠️ = corrected above (and in the research doc).

| claim | verdict |
|---|---|
| `preCalculateMinTotalWidth` is ink + a variance padding, **no duration term** | ✅ formatter.js:199-238 |
| `Tables.SOFTMAX_FACTOR = 10`; ideal distance is `softmax(ticks) × width` | ✅ tables.js:594, formatter.js:378 |
| The softmax exponent is the event's **fraction of the bar** — so a quarter:8th ratio is 1.33 in 4/4 and 1.78 in 2/4 | ✅ voice.js:115-123 |
| …normalized by the voice's **nominal** total, so a part-filled bar shifts again | ⚠️ it is `ticksUsed`, the voice's own content. The meter-dependence stands; the part-filled sentence does not |
| `Note.getMetrics()` decomposes exactly Gould's extent | ✅ note.js:315 — `modLeftPx` is the ModifierContext's `leftShift`, so accidentals are in it |
| `TickContext.getMetrics()` aggregates to `totalLeftPx/totalRightPx` | ✅ tickcontext.js — a `max` over the column's tickables |
| `postFormat()` runs inside `format()`, which is why a late `setX` wins | ⚠️ only `if (opts.stave)`, and we pass none. `TickContext.postFormat` is a no-op latch; the real reason is that nothing re-reads `x` before draw |
| `getAbsoluteX() = tickContext.getX() + stave.getNoteStartX()` | ⚠️ **+ `Metrics.get('Stave.padding')` = 12 px** |
| A `Formatter` can share TickContexts across staves while keeping per-stave modifier contexts | ✅ formatter.js:270 (keyed by `getStave()`) vs `createTickContexts` (stave-blind) — §1.2 |
| Headless, every glyph measures 0 and a note falls back to a 2 px stub | ✅ (research §5.4, unchanged) |
| `Bravura.otf` + `opentype.js` vendored as the headless escape hatch | ✅ `public/fonts/Bravura.otf`, dependency in `package.json` |
| `bravura_metadata.json` sits beside the three files in `public/smufl/` | ⚠️ it does **not** — only `classes/glyphnames/ranges`. The otf route is the real one |
