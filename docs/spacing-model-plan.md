# A real spacing model (Gould) — notes

> ⭐⭐ **PRIORITY FOR THE WHOLE EDITOR** (his call, 2026-07-29). Horizontal space is what a reader
> reads, and this editor has no rule for it.
>
> ⚠️ **THIS IS NOT A PLAN.** Nothing here is agreed, ordered or scheduled — it needs to be thought
> through properly first. What follows is everything we already know from the features that had to
> work around the model's absence, written down so none of it has to be re-derived when the thinking
> does happen.

## 0. Why this is a priority

This editor decides horizontal space with **two mechanisms and a pile of constants**:

1. **VexFlow's formatter**, which distributes a bar's width by TICK — a note gets room in proportion
   to how long it lasts;
2. **a floor per event** (`LAYOUT_CONFIG.MIN_NOTE_SPACING`, 1.8 staff spaces), which is what
   *actually* spaces most bars, because the formatter's own minimum is far too tight to read.

Neither asks the question engraving asks: **how much room does THIS event need, given what it
draws?** A note with a sharp, a note with a ledger line, a note with a dot and a plain note get the
same column; a fanned group of eight heads gets one event's column; a two-note tremolo's strokes and
a member's accidental buy their own room out of whatever slack happens to be lying around.

**Every feature that draws its own ink has had to re-derive the answer by hand, and each one did it
differently.** The fan alone now carries five constants that negotiate one boundary:

| number | where | what it claims |
|---|---|---|
| `MIN_NOTE_SPACING` (1.8 spaces) | `layoutConfig` | what one ordinary event's column is |
| `FAN_MIN_HEAD_GAP_RATIO` (1.25) | `FannedBeam` | the closest two fanned heads may come |
| `trailingGap` (= `MIN_NOTE_SPACING`) | `FanPass` → `FannedBeam` | what the group leaves after itself |
| `fanColumns(...) + 1` | `utils/fannedBeam` | the room the bar is asked for |
| `FAN_MAX_SPAN_STRETCH` (1.5) | `fanRoom` | how far a justified bar may stretch it |

Each is right on the screenshot it was measured against and silently wrong on the next one — the
definition of a magic number. Three rounds of his reports moved them and the last one still stands:
*"after the fan the space is too close of the next element… it is wrong… for this we need a proper
solution, a robust one, and not use magic numbers."* ⛔ **The answer is not a sixth number, and not
another per-feature workaround.**

## 1. The model — Gould's question, asked once

Elaine Gould (*Behind Bars*, "Horizontal spacing") states it as two independent facts about every
event, and Dorico's engine is built the same way:

- **its own extent** — the ink it occupies, left and right of its notehead column: accidentals,
  arpeggio signs and articulations to the left; dots, displaced heads and ledger overhang to the
  right;
- **the space that FOLLOWS it** — a function of its DURATION, non-linear (a note twice as long gets
  noticeably less than twice the space), modified by context: the meter's beat structure, the bar's
  density, whether the next event is a barline.

The two are added, never conflated. Today this editor only has the second, and only as a floor.

A shape it might take — sketch, not a commitment:

```ts
// utils/spacing.ts (pure — no VexFlow, no DOM)
interface EventExtent { left: number; right: number }             // ink either side of the head column
interface EventSpace  { extent: EventExtent; following: number }  // + the room its duration earns
spaceEvents(events, meter, options): number[]                     // x per event, in one pass
```

- **PURE and testable**, like `utils/beaming.ts` and `utils/measureCapacity.ts` — the spacing rule is
  a fact about music, not about a renderer, so it belongs in the core with a spec that reads like
  Gould's own tables.
- **Measured, not guessed**: the extents come from real glyph widths, which means a MEASUREMENT seam
  (jsdom answers 0 — see `docs/ARCHITECTURE.md` §"The browser suite"; the numbers get pinned in
  `e2e/`).
- **One caller**: `MeasureLayout` asks it for the bar's width and `VexFlowRenderer` asks it for the
  x's, instead of both negotiating with VexFlow's formatter separately.

## 2. What it would delete

The honest measure of whether it is worth doing — every one of these exists only because there is no
spacing model:

- `fanColumns` / `slotColumns` / `laneColumns` and the fan's five constants above: a fanned group's
  members would ask for their extents like any other events, and the gap after the group would be
  decided by the same rule as any other gap.
- `FanStaveNote` + `shareFanRoom` (`engine/rendering/fanRoom.ts`) — a whole module whose only job is
  to fight the tick-proportional formatter for room.
- The `MIN_NOTE_SPACING` floor as *the* spacing rule, and `MAX_MEASURE_WIDTH` as a bar's ceiling
  (the cap only had to become a preference because the floor was doing the model's job).
- `ledgerAccidentalClearance` and `dotPlacement`'s room reservations, which are extents by another
  name, computed at draw time because nothing asks for them at width time.
- The two-note tremolo's stroke clearance, and every future element that draws its own ink and would
  otherwise repeat the pattern a sixth time.

## 3. The shape the work might take

⚠️ **Sketch only** — the order below is what looks sane from here, not an agreed sequence:

1. **Measure what we have.** Screenshot a dense bar, a sparse bar, a bar of accidentals and a fan;
   record the gaps. Nothing can be called an improvement without a before.
2. **The pure module + spec**, against Gould's tables, with no caller — the rule stated on its own.
3. **The measurement seam**: glyph extents, cached per font, with `e2e/` pinning the numbers.
4. **`MeasureLayout` asks it for bar width** (the floor becomes the model's answer). Compare against
   step 1; nothing should move much for ordinary music.
5. **The renderer asks it for x's**, replacing the formatter's distribution.
6. **Delete the workarounds** in §2, one feature at a time, each with its geometry spec still green.

It touches `MeasureLayout`, `NoteBuilder`, `VexFlowRenderer`, the fan, the tremolo and the
engraving-override compartment. It is the biggest single piece of work this editor has left, and it
is worth it: **spacing is the thing a reader sees first.**

## 4. ⏭️ Open questions for him (a musician's calls, not mine)

- Which spacing table to follow — Gould's is descriptive rather than numeric; Dorico and Sibelius
  publish spacing ratios that could be started from.
- How much a bar may compress before it is allowed to take a whole line (the current
  `MAX_MEASURE_WIDTH` is a number nobody chose musically).
- Whether justification stretches everything proportionally or protects the intrinsic extents (his
  bar-width work already says a growth is a TRANSFER — `docs/bar-width-plan.md` — and the same
  question arises here one level down).
- Whether the fan's inner crowding stays its own rule (it is notation, not spacing) once the group's
  outer room comes from the model.
