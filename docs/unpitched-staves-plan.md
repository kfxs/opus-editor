# Unpitched staves & the percussion clef — FUTURE (not started)

Recorded 2026-07-20, when the Clef window (`src/windows/clefWindow.ts`) shipped with
**four** rows and Sibelius's fifth — percussion — deliberately left out.

## 0. The ask

Sibelius's Clef dialog offers a percussion clef (SMuFL `unpitchedPercussionClef1`,
U+E069). Ours does not. This doc says why that is a model gap and not a missing row,
so the day it is built it is built once, properly.

## 1. Why the row was dropped rather than wired up

Drawing it is nearly free — VexFlow already renders a `percussion` clef, and the
picker draws its own staves anyway. Every real cost is downstream of one line,
`src/utils/clefUtils.ts`:

```ts
export const CLEF_MIDDLE_LINE_DIATONIC: Record<Clef, number> = {
  treble: 34, bass: 22, alto: 28, tenor: 26,
}
```

Widening `Clef` to include `'percussion'` makes that `Record` demand a **diatonic pitch
for the middle line of a percussion staff**, and there isn't one. Whatever number were
written there would be a fiction, and it is not a local one: the table is the single
source for natural stem direction and the default tie/slur side, and the same
assumption runs deeper still — `pixelToPosition` derives a *spelling* from the clef, so
a click on a percussion staff would mint a pitch (C4, or whatever the fiction implied)
and store it. The staff would look right and the model would be lying, silently.

**The shallow version is therefore explicitly REJECTED**: render the clef, keep
deriving pitches underneath. It puts a wrong pitch in the model on every click and
nothing reports it.

## 2. The actual shape of the feature

Percussion is not a fifth clef. It is a staff **whose lines are not pitches** — and
the clef is merely how such a staff is drawn. So the concept to add is the unpitched
staff, and the percussion clef falls out of it:

- a staff declares whether its lines carry pitch;
- an unpitched staff maps line → **instrument** (snare, kick, hi-hat…), not line → pitch;
- pitch-derived behaviour (spelling, accidentals, transposition, stem direction by
  middle line) is answered by the staff, not assumed by the clef;
- playback binds a line to a percussion sound rather than a MIDI note derived from a
  spelling.

That places it with the instruments work (`docs/instruments-plan.md` — sound binds to a
LANE, not a staff) and with the "keep the measures spine removable" thread in
`docs/DESIGN-PRINCIPLES.md`: both are about not baking "a staff position means a pitch"
into everything.

## 3. When it is worth doing

Not before there is a reason to notate drums. It is a staff-model change, and taking it
early would spread `if (unpitched)` through code that has no other need of it. Until
then the honest state is the current one: four clefs, and a picker that offers exactly
what the model can express.

## 4. When it IS done

The Clef window gets its fifth row back for free — `CLEF_CHOICES` in
`src/windows/clefWindow.ts` is one line, the glyph is `\uE069`, and it sits on the
middle line. That is the *last* step, not the first.
