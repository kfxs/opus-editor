# An accidental must clear the ledger line beside it

His report, off the page (2026-07-28): *"the accidental for notes with ledger lines down are two
close, it would be nice to place it a tiny bit at left… for me is clear that there is a collision
with the ledger line"*.

He was right, and it is not a near miss — it is arithmetic, and it happened to **every** accidental
on a ledger-line note, in every clef.

## The measurement

Measured on the page, C♯4 in treble (never inferred — in jsdom every glyph measures 0×0):

| | x |
|---|---|
| notehead | 114 |
| sharp glyph | 101 → **111** |
| its ledger line | **111** → 129 |

The sign's right arm and the line's left end are the same pixel. Why they always are:

- an accidental stands **3px** off its notehead — 1px of `Accidental.noteheadAccidentalPadding`
  **plus a flat 2px** that `StaveNote.getModifierStartXY` gives every LEFT modifier (`x = -1 * 2`, a
  literal in VexFlow's source, not a metric);
- a ledger line overhangs the head by **3px** (`StaveNote.LEDGER_LINE_OFFSET`).

⚠️ Reading the metric alone says the standoff is 1px and describes a 2px *overlap*. It is a *touch*.
The first version of this fix corrected by 3px on that reading and opened a 3px gap — twice what was
wanted. **Measure the drawn glyph.**

## What the engraving sources say

The traditional answer is the opposite of "move the sign": *"an expert engraver will shorten a ledger
line to allow closer spacing with accidentals"* ([LilyPond's engraving
essay](https://lilypond.org/doc/v2.25/Documentation/essay/ledger-lines)) — shortening only the line
nearest the head, and only when a sign is horizontally close. Gould's own priority is keeping an
accidental **as close to its notehead as possible**, so the line gives way first.

We split it: the line gives up a third of its overhang (3 → 2px) and the sign steps out 1px, for 2px
of air. The sign stays within half a staff space of its head, which is what "a tiny bit at left"
should mean.

## Why it is a DRAW-time pass, and why the shift is 1px

Two measurements closed the other options:

1. ⛔ **The room may not be RESERVED.** Padding the accidental's width and letting the formatter buy
   the space is the natural fix — and it makes a bar's width depend on the CLEF, because ledger
   lines do. This editor proved bar width clef-independent and took `clef` out of the width-cache
   key (`MeasureLayout.clefWidthIndependence.test.ts`, `docs/render-performance-plan.md` §9); that
   key was worth **47% of layout time** on a score with one clef change. The spec caught the
   attempt, which is exactly what it is for. ⚠️ `NoteBuilder.createStaveNotesFromSlots` is the WIDTH
   path as well as the draw path — nothing that reads where a note *sits* may go in it.
2. ⛔ **…so the sign moves at draw time, and it cannot move far.** Measured in a minimum-width bar
   (sixteen 16ths, every one signed): the gap between the previous notehead and the next accidental
   is exactly **3px**. Spend it all and dense music trades a collision with a ledger line for a
   collision with a notehead. 1px spends a third of it.

## The shape

`engine/rendering/ledgerAccidentalClearance.ts` — pure arithmetic plus one VexFlow-facing pass:

- `accidentalMeetsLedger(line, headLines)` — does a sign on this line stand beside any of the note's
  ledger lines? An accidental glyph reaches ~1.4 lines either side of its own, so a sign hanging in
  the space *under* the first ledger meets it too.
- `ledgerAccidentalClearance(line, headLines, overhang, standoff)` — how far the sign moves:
  `overhang + gap - standoff`, or 0 when it meets nothing. Both numbers are the caller's, because a
  fan member's hand-drawn sign and ledger have their own.
- `clearLedgersForAccidentals(notes)` — spent on real notes in `VexFlowRenderer`, **after
  `formatter.format` and before the draw** (the window the multi-voice re-assert and the note
  offsets already use). It trims that note's `renderOptions.strokePx` and shifts every one of its
  signs by the same amount — they are a column, and a per-sign shift would rake it.

`FanPass` spends the same rule on hand-drawn members: the clearance goes into the accidental
column's width (a fan reserves its room out of its own span, so it can), and `fanLedgerOverhang`
trims the member's ledger lines the same 3 → 2. A fan member and an ordinary note therefore look
alike on a page that has both.

⚠️ **VexFlow gives no per-side control**: `strokePx` is one symmetric number per note, so the trim
shortens both ends of that note's ledger lines. LilyPond trims the left end only, and that needs the
lines to be ours to draw. If they ever are, the module should change its mind — trim the left, and
leave the sign where Gould wants it.

## Two VexFlow traps paid for here

- `Accidental.setWidth()` **before** `addModifier` is silently lost: `addModifier` → `setNote` →
  `reset()` sets the glyph's text, which invalidates the measurement. After, it sticks.
- `Modifier.setXShift(x)` **negates** for a LEFT modifier (stores `-x`), so adding to an existing
  shift is `setXShift(-getXShift() + delta)`.

## Tested

- `ledgerAccidentalClearance.test.ts` — the arithmetic, both callers' numbers.
- `e2e/notes.e2e.ts` and `e2e/fan.e2e.ts` — the geometry, measured in a browser: every ledger line
  that starts to the right of a sign starts clear of it. The sign's width is a font measurement, so
  in jsdom this assertion would pass vacuously. Both were break-tested (disable the pass ⇒ fail).
