# The thin double barline `‖` — plan

> His ask, 2026-09-29: *"the single double barline, we dont have it but we need it"* — and, on the
> numbers: *"make the numbers as presets and gould is default"*. Scope, his: *"we dont need any new
> session [section], just drawing the barline and it should be in the barline menu after normal"* —
> ⭐ a DRAWN sign, nothing more: no section meaning, no rule that places it for you.

The family's fourth member. `docs/plans/barline-types-plan.md` §0.1 priced it in advance — *one union
member + one drawing case + one pair-table row, touching nothing else* — and §9 recorded the trap
waiting for it. This plan is that price, paid, plus the preset table he asked for.

## 1. The numbers — ONE preset table, Gould default

⭐ **Only the WHITE GAP between the two lines is a preset.** Each line is the plain barline's own thin
stroke (`thinLineSpaces()`, 0.16 sp today): Gould p. 39 says the thin double is *"of ordinary barline
thickness"*, and every engine draws its double with its own plain-barline width. A second thickness
knob would let a double's lines disagree with the plain line beside them, which no source does.

| row | white gap (sp) | source |
|---|---|---|
| ✅ **`gould`** — DEFAULT | **0.30** | Gould pp. 238–239: five engraved thin doubles, MEASURED 0.45–0.55 left edge to left edge (`reference/README.md`, barline-family Q&A). ⭐ Her drawing beats her sentence — the fourth time in this library |
| `prose` | 0.59 | Gould p. 39 *"about ¾ stave-space apart"* and Ross p. 152 *"approximately three-quarters of a space apart"* — ⚠️ read as line CENTRE to centre (0.75 − 0.16). Neither says which; the other reading (0.75 of white) is wider still, and no plate of either draws it |
| `gerouLusk` | ≈0.22 | G&L p. 29 plate: 0.38 left edge to left edge, measured (− our 0.16 stroke — their stroke width was not measured) |
| `finalBar` | 0.32 | our `barlineSign.SEPARATION` — the white between a final bar's thin and thick lines today. What we would draw with no table |
| `lilypond` | 0.30 | `BarLine.kern` (`scm/define-grobs.scm`) |
| `musescore` | 0.37 | `doubleBarDistance` (`style/styledef.cpp`) |
| `verovio` | 0.40 | `barlineSeparation` = SMuFL / Bravura `engravingDefaults` |
| `bravuraGlyph` | 0.288 | Bravura's precomposed `barlineDouble` glyph (0.576 wide) |

⛔ A row is a SOURCE, never an invention. Total width at the default: 0.16 + 0.30 + 0.16 = **0.62 sp**.

## 2. The geometry

The RIGHT line stands exactly where the plain line stands today (`x: 0`, the divider, `shared`); the
left line is the new ink, `x: −(gap + thin)`, half `end`. ⇒ Stamping `‖` never moves the music AFTER
the line, only claims room before it — the `final` bar's arrangement. No thick line ⇒ no wings.

## 3. Phases

**P0 — the preset row.** `engine/layout/doubleBarlineGap.ts`: `DOUBLE_BARLINE_GAP_RULES` (the table
above), armed `gould`, set/reset/settings, and its generation in `layout/widthRowGenerations` (it
changes a WIDTH — `reference_render_width_key_vs_shape_key`). Console: `__barlines.double('gould'|…)` /
`.doubleDump()` / `.doubleReset()` on the existing `__barlines` object. Spec beside it.

**P1 — the model.** `BarlineStyle` gains `'double'` (`types/signs.ts`); `BarlineSignKind` gains
`'double'` (`models/boundarySign`) with its precedence — **below the repeats, like `final`** (a repeat
at the same line subsumes it) and below `invisible`; `HAS_THICK_LINE.double = false`;
`barlineOps.setBoundarySign` accepts it. JSON is additive (absent = plain, as now). Specs.

**P2 — the drawing.** One case in `barlineSignParts`; `ownEndSignKind` answers `double` (else the bar
reserves a plain line's room and the new left stroke hits the last note). The extent, hit box,
halves, highlight, hinting and the join all read the parts, so they follow. A SCENE test: two strokes,
the armed gap between them, the right one where the plain line was.

**P3 — the UI.** ⭐ **Right after Normal** in every barline list (his placement): the barline stamp's
row table + its ghost (`interactions/stamps/barlineStamp`, `PlacedBarlineSign`), the Insert menu's
Barline rows (`menus/insertMenu.ts` — Normal is last there today, so Double follows it), the Properties
chooser (`windows/properties/panels/barline.ts`, after `none |`). Select / delete / the `plain` eraser
need nothing new. ⚠️ The chooser labels `final` as `‖` today — that glyph is the thin double's; `final`
becomes `final  |▌` (or similar) in the same step, else two rows read alike.

**P4 — the browser.** `e2e/`: the gap measured in Chromium at each row; two staves (the join's default
is NOT joined — `docs/plans/barline-join-plan.md`); a double at a system's end.

## 4. Later — his call, ⛔ not a queue

- The gap AFTER a double before a mid-line meter: Ross's plate (p. 168) draws **1.46 sp** there against
  ≈1.0 after a plain line. Today it takes the plain line's 0.75 (`layout/barlineMeterGap`).
- A keyboard shortcut; the rest of the family (`heavy`, `dashed`, `dotted`, `tick`, `short`).
- ⛔ Out of scope by his word: any SECTION meaning — an automatic double at a key/meter change, before a
  repeat at a system break (Gould p. 234), or before a courtesy sign. The user stamps it; that is all.
