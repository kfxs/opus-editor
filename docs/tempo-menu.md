# Tempo word menu

`src/menus/tempoMenu.ts` (`buildTempoMenu`) is the menu you get right-clicking (or pressing the Menu
key) while the tempo text cursor is blinking — the sibling of the expression word menu. The DOM
layer hands in the caret via `TempoMenuInsert`; the builder names the rows. **Every row places a
string at the caret**, because the mark IS its text (a note glyph, a word, an arrow are all just
characters in it).

It began as a full replication of Sibelius's tempo popup (five columns: Italian words, jazz feels,
segno/coda, the note values, metric-modulation, and a big accented-character bank) and was then
**trimmed hard** to what a tempo mark is actually made of.

## The two columns

1. **Italian tempo vocabulary** — `WORDS`, set bold (the score engraves tempo text bold).
2. **Everything a metronome / modulation is built from:**
   - the **note-value ladder**, shortest → longest: 32nd … whole, then the two double-whole variants
     (round `metNoteDoubleWhole` + square "cuadrada" `metNoteDoubleWholeSquare`). Each carries its
     **numeric-keypad** shortcut label — `Ctrl+Num 1` (fusa) … `Ctrl+Num 6` (redonda). Display-only
     for now; wiring needs `event.code === 'Numpad1'` detection (top-row `Ctrl+1…6` is the browser's
     tab-switch and can't be suppressed);
   - a divider, then the **augmentation dot** (`Ctrl+Num .`), the **← / →** arrows, the whole
     **`← ♩ = ♪ →`** equation, the **beamed note groups**, the **triplet-with-bracket** and the **tie**;
   - a divider, then the bold German **eszett `ß`** — the one accented character kept (the OS keyboard
     reaches the rest).

## Glyphs are REAL Bravura SMuFL, not ASCII

Every symbol is an actual SMuFL codepoint from the notation font, written out as a `\uXXXX` literal in
the `GLYPH` table (VexFlow's `Glyphs` enum is CJS-only → `undefined` in the browser, so it can't be
imported — same convention `DURATIONS`/`TempoLayout` keep). **The authoritative name→codepoint table
is `node_modules/vexflow/build/esm/src/glyphs.js`** — grep it before inventing anything.

| element | glyph | codepoint |
|---|---|---|
| modulation arrow ← / → | `metricModulationArrowLeft` / `Right` | `EC63` / `EC64` |
| low tie | `textTie` | `E1FD` |
| triplet bracket | `textTupletBracketStart` + `textTuplet3` + `textTupletBracketEnd` | `E1FE E1FF E200` |
| augmentation dot | `metAugmentationDot` (matches what TempoLayout engraves) | `ECB7` |
| stemmed note (no beam) | `textBlackNoteShortStem` / `LongStem` | `E1F0` / `E1F1` |
| note WITH its own frac 8th beam | `textBlackNoteFrac8thShortStem` | `E1F2` |
| continuation beam (beam only!) | `textCont8thBeam…` / `16th` / `32nd` | `E1F7` / `E1F9` / `E1FB` |
| double whole / square breve | `metNoteDoubleWhole` / `…Square` | `ECA0` / `ECA1` |
| metronome note ♩ etc. | `metNoteWhole`…`metNote32ndUp` | `ECA2`–`ECAB` |

## Beamed note groups — the gotcha

Two beamed eighths are **three** glyphs: `textBlackNoteShortStem` + `textCont8thBeamShortStem` +
`textBlackNoteFrac8thShortStem` (note, **beam-only** connector, then a note carrying its **own**
fractional beam — `E1F0 E1F7 E1F2`). A plain note as the third glyph has no beam → visible gap. And
the beams only overlap the stems when the font's **kerning pairs** are applied, so the note label
sets `font-kerning: normal` + `font-feature-settings: "kern" 1`. Per the SMuFL
["beamed groups of notes"](https://w3c-cg.github.io/smufl/latest/tables/beamed-groups-of-notes.html)
spec, not a workaround.

## Two label styles: `note` vs `music`

Note-value glyphs (metNote/text-note family) are drawn to sit **inline in tempo text**, so they are
smaller than a **dynamic** and carry all their ink above the baseline. Sizing them like a dynamic
left the tall ones (the 32nd's three flags) towering above the row. So `MenuItem.LabelFont` has a
distinct **`note`** value (`MenuLayer` `.menu-row-label-note`: ~1.35em, nudged down to seat the
notehead on the row's centre, kerning on) separate from **`music`** (dynamics, 1.7em). The tempo
menu uses `note` throughout; the expression menu keeps `music`.

## The equation label vs. insert

The `← ♩ = ♪ →` row shows in Bravura (`MODULATION_LABEL`, metNote glyphs + en-spaces ` `, because
Bravura's plain space is ~zero-width and collapses) but **inserts** `MODULATION_TEXT` — which keeps
♩/♪ as `UNIT_GLYPH` so the notes still engrave and parse, with the Bravura arrows either side.

## These glyphs engrave IN the mark

`TempoLayout.splitRuns` treats any inserted SMuFL private-use char (`U+E000–F8FF`: beams, tie, tuplet
brackets, modulation arrows, double-whole) as a **glyph run** — drawn in the music font at glyph
size, not as small text — and groups consecutive ones into one run so kerning can join the beams.
Note chars (`♩` = U+2669) sit outside the PUA, so the paths don't collide. **Caveat:** kerning in the
engraved SVG relies on the browser's default on the grouped `<text>`; if a beam gaps in the actual
mark, add an explicit kerning rule for the score's tempo `<text>`.

## Shortcuts, and how a tempo mark is entered now

The menu's shortcuts are wired for real (they were labels only until then): `TempoTextSource.getInsertions()`
binds the note ladder to the **numeric keypad** (`Ctrl+Num 1…6`, matched by `KeyboardEvent.code`
because the top-row twins are the browser's tab-switch), the augmentation dot to `Ctrl+Num .`, and
the arrows to `Ctrl+'` / `Ctrl+¡`. The keypad numbers come from the shared `NOTE_KEYPAD` (and `GLYPH`),
exported from `tempoMenu.ts`, so the labels and the bindings can't drift. `TextEditInsertion` gained a
`code` field for the keypad matching. The triplet's `Ctrl+3` is deliberately unbound (top-row, un-suppressable).

The **Vue tempo palette was deleted** — the plain-TS editor is the only entry now: **Ctrl+Alt+T**
places a mark (at a selected note, or arm click-to-type on an empty beat), then you type it with the
word menu + these shortcuts; double-click edits an existing one. The palette's one-click *preset stamp*
and bpm/unit/dots spinners are gone (no replacement); the arming seam survives as
`PaletteController.setTempo`, kept for a future framework-agnostic tempo palette (see its doc comment).

## Still open

- Metric modulation still doesn't **play** (the equation states no number → inherits the prevailing
  tempo). See `metric-modulation-plan.md`.
- A future **word→bpm dictionary** would let a bare word (`Allegro`) carry a played tempo — recorded
  in `tempo-marks-plan.md` §9, not built.
