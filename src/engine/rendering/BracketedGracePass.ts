/**
 * ⭐⭐ **BRACKETED GRACES, drawn** (`docs/plans/bracketed-grace-plan.md` P1) — a black head in round
 * brackets, no stem, no flag, before its chord: free functions over the passed-in {@link RenderPass},
 * like `GracePass` — which calls this, being the pass of a chord's before side — inside the bar's
 * measure group, after the notes they stand beside.
 *
 * WHERE each head, sign and bracket stands is `layout/bracketedRoom.beforeSideLayout` — the same call
 * `measureColumns.slotInk` reserved the room with. The head, its accidental and its ledger lines are
 * drawn in a `scaling(k)` group at the armed size (B7), composed from a normal note's parts as a grace
 * is; the brackets are drawn at the head's size or at FULL size, as the armed form says (B9).
 *
 * ⛔ It SOUNDS nothing (B6) and — until P2 — registers no hit box: a click cannot select one yet, so no
 * selection can hold an id the lookups do not know.
 */
import type { ChordRest, Clef, Fraction, KeySignature } from '@/types/music'
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { RenderPass } from './RenderPass'
import type { EngravedNote } from './engraved/EngravedNote'
import type { EngravedStave } from './engraved/EngravedStave'
import { EngravedAccidental } from './engraved/EngravedAccidental'
import { drawGroupOf } from './painter/svgDrawGroup'
import { maybeStaveOf, staveFrame } from './staff/staveFrame'
import { scaling } from '@/engine/paint/Affine'
import { noteLineY, type StaffFrame } from '@/engine/engrave/staff/staffFrame'
import { headGlyph } from '@/engine/engrave/notes/keyLines'
import { drawNoteHead } from '@/engine/engrave/notes/noteheads'
import { drawLedgerLines, ledgerLineRuns } from '@/engine/engrave/notes/ledgerLines'
import { stampGlyph } from '@/engine/engrave/glyph'
import { accidentalFont, musicGlyphFont, noteFont } from '@/engine/engrave/inheritedFonts'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import { BRACKET_FORMS, bracketForm, bracketedScale, beforeSideLayout, type BracketedPlace } from '@/engine/layout/bracketedRoom'
import { hostLeftReach, type SignOf } from '@/engine/layout/graceRoom'
import { displayedAccidentals } from '@/utils/accidentalState'
import { C_MAJOR } from '@/utils/keySignature'

/** The group class — one per chord's list, before it. */
export const BRACKETED_GROUP = 'bracketed'
/** One bracketed grace inside it — the unit P2's selection highlight will recolour. */
export const BRACKETED_NOTE_GROUP = 'bracketednote'
/** How far its ledger line runs past the head, in the head's own px — the grace's (and the fan's) 3 px. */
const LEDGER_OVERHANG = 3

/**
 * Draw every chord's BRACKETED graces before it, for one lane of one bar. `slots` / `staveNotes` are
 * the lane's, index for index (the fan and grace passes' contract).
 */
export function drawBracketedGraces(
  pass: RenderPass,
  slots: ChordRest[],
  staveNotes: EngravedNote[],
  clefForBeat: (beat: Fraction) => Clef,
  /** The key governing this lane's bar — a bracketed sign is read against it and the bar (B6). */
  key: KeySignature = C_MAJOR,
): void {
  if (!slots.some(s => s.type === 'chord' && s.bracketedBefore?.length)) return
  const signs = displayedAccidentals(slots, key)
  const signOf: SignOf = id => signs.get(id)
  for (let i = 0; i < slots.length && i < staveNotes.length; i++) {
    const slot = slots[i]
    if (slot.type !== 'chord' || !slot.bracketedBefore?.length) continue
    const stave = maybeStaveOf(staveNotes[i])
    if (!stave) continue
    const clef = clefForBeat(slot.beat)
    const side = beforeSideLayout(slot, signOf, clef, hostLeftReach(slot.notes, signOf, clef))
    if (!side.bracketed) continue
    const hostX = staveNotes[i].getNoteHeadBeginX()
    const ctx = pass.context
    ctx.openGroup(BRACKETED_GROUP, `${BRACKETED_GROUP}-${slot.id}-before`)
    try {
      for (const place of side.bracketed.places) drawOne(ctx, place, hostX, stave)
    } finally {
      ctx.closeGroup()
    }
  }
}

function drawOne(ctx: DrawContext, place: BracketedPlace, hostX: number, stave: EngravedStave): void {
  const frame: StaffFrame = staveFrame(stave)
  const space = frame.spacePx
  const k = bracketedScale()
  const form = BRACKET_FORMS[bracketForm()]
  /** Staff px → the head's own px (inside its `scaling(k)` group). */
  const local = (v: number): number => v / k
  const x = (sp: number): number => hostX + sp * space // staff px
  const glyphWidth = (place.headWidth / k) * space // the head's own px: the transform scales it
  const leftParen = String.fromCodePoint(GLYPH_CODEPOINTS[form.left])
  const rightParen = String.fromCodePoint(GLYPH_CODEPOINTS[form.right])
  const ledgerStyle = stave.getDefaultLedgerLineStyle()

  ctx.openGroup(BRACKETED_NOTE_GROUP, `${BRACKETED_NOTE_GROUP}-${place.bracketed.pitches[0]?.id}`)
  try {
    const scaled = drawGroupOf(ctx.openGroup('bracketedhead'))
    scaled?.setPlacement(scaling(k))
    try {
      drawLedgerLines(
        ctx,
        ledgerLineRuns(place.heads.map(h => ({ line: h.line, x: local(x(place.headX)) })), glyphWidth, LEDGER_OVERHANG),
        line => local(noteLineY(frame, line)),
        { ...ledgerStyle, lineWidth: (ledgerStyle.lineWidth ?? 1) / k },
      )
      for (const head of place.heads) {
        const y = local(noteLineY(frame, head.line))
        // ⭐ BLACK whatever its target's value (Gould p. 418, B7): a quarter's head.
        drawNoteHead(ctx, { glyph: headGlyph('q', false), x: local(x(place.headX)), y, font: noteFont() })
        if (head.sign && head.accidentalX !== null) {
          const glyph = new EngravedAccidental(head.sign).getText()
          stampGlyph(ctx, glyph, local(x(head.accidentalX)), y, accidentalFont(glyph))
        }
        if (!form.fullSize) {
          stampGlyph(ctx, leftParen, local(x(head.leftParenX)), y, musicGlyphFont())
          stampGlyph(ctx, rightParen, local(x(head.rightParenX)), y, musicGlyphFont())
        }
      }
    } finally {
      ctx.closeGroup()
    }
    // A FULL-size pair (Gould's measured brackets) stands outside the head's scale.
    if (form.fullSize) {
      for (const head of place.heads) {
        const y = noteLineY(frame, head.line)
        stampGlyph(ctx, leftParen, x(head.leftParenX), y, musicGlyphFont())
        stampGlyph(ctx, rightParen, x(head.rightParenX), y, musicGlyphFont())
      }
    }
  } finally {
    ctx.closeGroup()
  }
}
