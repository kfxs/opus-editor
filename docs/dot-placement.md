# How far an augmentation dot stands from its notehead

His report, off the page (2026-07-28): *"the dot is too close to the notehead… for notes with flags
looks ok but not for notes with no flags"*, then *"in notes with ledger lines the dot seems odd in
the position"*, then — when I started measuring the ledger case — *"dont measure just on ledger
lines please, the issue i see is general"*. He was right on all three counts: it is one number, it
is general, and the flag/no-flag split is exactly where it shows.

## What we were drawing

Measured on the page (staff space 10px, notehead 12px, dot 4px):

| case | gap after the notehead |
|---|---|
| dotted quarter, no flag | **2px** |
| dotted eighth, stem **down** (its flag is not in the way) | **2px** |
| dotted quarter on a ledger line | **2px** — and the ledger's tip ended 1px *past* the dot's left edge |
| dotted eighth, stem **up** with a flag | 2px + the flag's width ≈ 7px |
| dot → dot (double-dotted) | 1px edge gap |

The 2px is a literal in VexFlow's `StaveNote.getModifierStartXY` (`x = glyphWidth + xShift + 2`).
Only stem-up flagged notes escape it, because their dot is pushed past the flag — which is why those
were the ones that looked right to him.

## The rule

⭐ **Half a staff space, edge to edge — and the same gap twice.** Gould gives half a space between
the dots of a double-dotted note, measured from the dot's *edge* rather than its centre; and the
standing engraving principle is that *the notehead-to-first-dot distance equals the dot-to-dot
distance* ([MuseScore, on dots and
spacing](https://musescore.org/en/node/18672)). One number therefore settles both gaps, and at 10px
per space it is **5px**.

⭐ It settles the ledger case with nothing ledger-specific in it: a ledger line overhangs the
notehead by 3px, so a dot standing 5px off the head clears its tip by 2. That is not just tidy — a
rule that *read* the ledger lines would make bar width clef-dependent, which is forbidden here (see
`docs/accidental-ledger-clearance.md` for the invariant and what it cost to learn).

Result:

| case | before | after |
|---|---|---|
| no flag / stem-down flagged / on a ledger line | 2px | **5px** (and 2px clear of the ledger tip) |
| dot → dot | 1px | **5px** — the same gap as the notehead's |
| stem-up flagged | ~7px | unchanged |

## Why it takes two steps

VexFlow sets a dot's drawn x and its reserved WIDTH in different places, so the fix is in two:

- **`reserveDotRoom`** runs in `NoteBuilder` — the draw path *and* the width path — and buys the
  room. Uniform per dot, never a function of where the note sits, so bar width stays
  clef-independent. It also opens the dot-to-dot gap to the same half space for free, because
  `Dot.format` steps each dot along by `width + dotSpacing`.
- **`placeDots`** runs after `formatter.format` and moves the ink. It must be after: `Dot.format`
  assigns every dot's `xShift` from scratch.

⚠️ The gap VexFlow already leaves is **re-stated as a constant, not measured** — `getModifierStartXY`
throws `NoYValues` until the note has been drawn (the same rule as `getNoteHeadBeginX`: geometry is
not real until the draw), and by then the dot is on the page. The first attempt asked VexFlow and
took down the whole measure's render.

The cost is real and worth stating: a bar grows ~4px per dot.

## Deliberately left alone

- **Rests.** A dotted rest keeps VexFlow's placement — the dot follows a glyph of a different shape,
  and the convention gives it a *smaller* distance than a note's (MuseScore keeps `dotRestDistance`
  below `dotNoteDistance`). He reported notes.
- **Beamed eighths.** VexFlow applies its flag shift by DURATION, so a beamed eighth gets it too and
  its dot stands ~7px out with no flag to clear. The rule only ever *opens* a gap, never closes one,
  so those are untouched — wider than the rule wants, narrower than a fault, and pulling them in
  would move ink nobody reported.
- **The vertical.** Already correct and unchanged: a note on a line puts its dot in the space above,
  a note in a space keeps its own. That convention is VexFlow's `Dot.format`, and it is Gould's.

## Tested

- `dotPlacement.test.ts` — the numbers, and that the reservation widens every dot of the note.
- `e2e/notes.e2e.ts` — the geometry in a browser: 5px after the notehead for a plain quarter and for
  one on a ledger line, the ledger ending before the dot begins, the second dot half a space past
  the first, and the dot still half a space above a note that sits on a line. Break-tested (disable
  the pass ⇒ `Received: 2`).
