# Tempo word menu — full Sibelius replication (WIP)

`src/menus/tempoMenu.ts` (`buildTempoMenu`) replicates Sibelius's tempo popup — the menu you get
right-clicking (or the Menu key) while the tempo text cursor is blinking. It is the sibling of the
expression word menu; the mechanism is identical (the DOM layer hands in the caret via
`TempoMenuInsert`, the builder names the rows). Every row places a **string** at the caret, because
the mark IS its text (a note glyph, a word, an accent, an arrow are all just characters in it).

## The five columns

1. **Italian tempo vocabulary** — `WORDS`, set bold (the score engraves tempo text bold).
2. **Jazz feels** (`JAZZ_WORDS`, incl. `CODA` as a word) → segno / coda glyphs → the short note
   values (half…32nd, Ctrl+1…5) → `=`.
3. **Long note values** (longa, cuadrada, whole/Ctrl+6) → augmentation dot → the modulation arrows
   and the `← ♩ = ♪ →` equation → its beamed building blocks → the triplet-with-bracket and the tie
   → the a/e accents.
4. **Accented vowels** (`ACCENTS_IOU`).
5. **Uppercase accents, eszett, curly quotes, em dash** (`ACCENTS_UPPER`).

## Glyphs are REAL Bravura SMuFL, not ASCII

The palette places actual SMuFL codepoints from the notation font, so a row **is** the mark the
score engraves. Codepoints are written out as `\uXXXX` literals in the `GLYPH` table (VexFlow's
`Glyphs` enum is CJS-only → `undefined` in the browser, so it can't be imported — same convention
`DURATIONS`/`TempoLayout` already keep). **The authoritative name→codepoint table lives in
`node_modules/vexflow/build/esm/src/glyphs.js`** — grep it before inventing anything.

Key finds (SMuFL's `text…` family, U+E1F0–E203, exists specifically for note values inside running
tempo/rehearsal text):

| element | glyph | codepoint |
|---|---|---|
| modulation arrow ← / → | `metricModulationArrowLeft` / `Right` | `EC63` / `EC64` |
| low tie | `textTie` | `E1FD` |
| triplet bracket | `textTupletBracketStart` + `textTuplet3` + `textTupletBracketEnd` | `E1FE E1FF E200` |
| augmentation dot | `textAugmentationDot` | `E1FC` |
| stemmed note (no beam) | `textBlackNoteShortStem` / `LongStem` | `E1F0` / `E1F1` |
| note WITH its own frac 8th beam | `textBlackNoteFrac8thShortStem` | `E1F2` |
| continuation beam (beam only!) | `textCont8thBeam…` / `16th` / `32nd` | `E1F7` / `E1F9` / `E1FB` |
| segno / coda | `segno` / `coda` | `E047` / `E048` |
| double whole / square breve | `metNoteDoubleWhole` / `…Square` | `ECA0` / `ECA1` |

## Beamed note groups — the gotcha

Two beamed eighths are **three** glyphs: `textBlackNoteShortStem` + `textCont8thBeamShortStem` +
`textBlackNoteFrac8thShortStem` (note, **beam-only** connector, then a note carrying its **own**
fractional beam). A plain note as the third glyph has no beam → visible gap. And the beams only
overlap the stems when the font's **kerning pairs** are applied, so the menu's music label sets
`font-kerning: normal` + `font-feature-settings: "kern" 1` (`MenuLayer.ts`). This is the SMuFL
["beamed groups of notes"](https://w3c-cg.github.io/smufl/latest/tables/beamed-groups-of-notes.html)
spec, not a workaround.

## The equation label vs. insert

The `← ♩ = ♪ →` row shows in Bravura (`MODULATION_LABEL`, metNote glyphs + en-spaces ` `,
because Bravura's plain space is ~zero-width and would collapse) but **inserts** `MODULATION_TEXT`
— which keeps ♩/♪ as `UNIT_GLYPH` so the notes still engrave and parse, with the Bravura arrows
either side. Drawing those arrows in the engraved mark (and playing the modulation) is still future
work — see `metric-modulation-plan.md`.

## Still to fix (open)

- **longa** — Bravura has no metronome/text longa; currently `mensuralBlackLonga` (`E951`) as a
  stand-in, may look mensural/wrong.
- The plain **note+beam** rows (beam8/16/32) may be redundant now that the beamed pair exists — the
  user is still deciding the exact set/order after the equation.
- The menu **test** (`tempoMenu.test.ts`) still asserts the old two-column shape.
- Whether the beamed/tie/tuplet/arrow glyphs engrave correctly **in the mark** (TempoLayout only
  maps `UNIT_GLYPH` note chars today; everything else is a text run) is unverified.
