/**
 * ⭐⭐ **PARENTHESISED NOTES, drawn** (`docs/plans/parenthesised-note-plan.md` P1) — the brackets a head
 * wears (`NotePitch.enclosure`), stamped round the notes just drawn: free functions over the passed-in
 * {@link RenderPass}, like `GracePass`, inside the bar's measure group.
 *
 * WHERE each bracket stands is `layout/headEnclosure.enclosureLayout` — the same call
 * `measureColumns.slotInk` reserved the room with. The head, its accidental, its dots and its stem are the
 * note's own, drawn by the note; this pass adds only the brackets.
 *
 * A GRACE's brackets are stamped by `GracePass`, inside the grace's own scaled group, through
 * {@link stampEnclosure} — the one place a pair becomes ink.
 */
import type { ChordRest, Clef, Fraction, KeySignature } from '@/types/music'
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { GlyphFont } from '@/engine/engrave/glyph'
import type { RenderPass } from './RenderPass'
import type { EngravedNote } from './engraved/EngravedNote'
import { maybeStaveOf, staveFrame } from './staff/staveFrame'
import { noteLineY } from '@/engine/engrave/staff/staffFrame'
import { stampGlyph } from '@/engine/engrave/glyph'
import { musicGlyphFont } from '@/engine/engrave/inheritedFonts'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import { glyphBox } from '@/engine/fonts/fontMetrics'
import { ENCLOSURE_GLYPHS, enclosureLayout, type EnclosureLayout } from '@/engine/layout/headEnclosure'
import { displayedAccidentals } from '@/utils/accidentalState'
import { C_MAJOR } from '@/utils/keySignature'

/** The group class — one per chord whose heads wear brackets. */
export const ENCLOSURE_GROUP = 'enclosure'
/** One head's pair inside it — the unit the selection highlight recolours (P4). */
export const ENCLOSURE_PAIR_GROUP = 'enclosurepair'

/** The DOM id of a head's pair group — what `interactions/elements/enclosure` finds it by. */
export function enclosurePairId(pitchId: string): string {
  return `${ENCLOSURE_GROUP}-${pitchId}`
}

/**
 * Draw the brackets of every parenthesised head in one lane of one bar. `slots` / `staveNotes` are the
 * lane's, index for index (the grace and fan passes' contract).
 */
export function drawEnclosures(
  pass: RenderPass,
  slots: ChordRest[],
  staveNotes: EngravedNote[],
  measureNumber: number,
  staffIndex: number,
  clefForBeat: (beat: Fraction) => Clef,
  /** The key governing this lane's bar — the drawn signs (which the brackets clear) are read against it. */
  key: KeySignature = C_MAJOR,
): void {
  if (!slots.some(s => s.type === 'chord' && s.notes.some(p => p.enclosure))) return
  const signs = displayedAccidentals(slots, key)
  const font = musicGlyphFont()
  const ctx = pass.context
  for (let i = 0; i < slots.length && i < staveNotes.length; i++) {
    const slot = slots[i]
    if (slot.type !== 'chord') continue
    const stemDown = staveNotes[i].getStemDirection() === -1
    const upFlag = !stemDown && staveNotes[i].hasFlag()
    const layout = enclosureLayout({ notes: slot.notes, duration: slot.duration, dots: slot.dots, stemDown, upFlag }, id => signs.get(id), clefForBeat(slot.beat))
    if (!layout) continue
    const stave = maybeStaveOf(staveNotes[i])
    if (!stave) continue
    const frame = staveFrame(stave)
    const hostX = staveNotes[i].getNoteHeadBeginX()
    const x = (sp: number): number => hostX + sp * frame.spacePx
    ctx.openGroup(ENCLOSURE_GROUP, `${ENCLOSURE_GROUP}-${slot.id}`)
    try {
      stampEnclosure(ctx, layout, x, line => noteLineY(frame, line), font, true)
      registerEnclosure(pass, layout, x, line => noteLineY(frame, line), frame.spacePx, measureNumber, staffIndex)
    } finally {
      ctx.closeGroup()
    }
  }
}

/**
 * ⭐ Stamp every pair of a layout — THE one place a bracket becomes ink, for a note and a grace alike.
 * @param x staff spaces from the head's anchor → the drawing's px.
 * @param y a staff line → the drawing's px.
 * @param grouped each pair in its OWN group ({@link enclosurePairId}), so the selected NOTE's highlight
 *   finds it (`interactions/elements/enclosure`). ⛔ Not for a GRACE: its highlight colours its member
 *   group's DIRECT children and skips nested groups, so a grace's pairs stand loose in its member group.
 */
export function stampEnclosure(
  ctx: DrawContext, layout: EnclosureLayout, x: (sp: number) => number, y: (line: number) => number, font: GlyphFont,
  grouped = false,
): void {
  for (const pair of layout.pairs) {
    const glyphs = ENCLOSURE_GLYPHS[pair.shape]
    if (grouped) ctx.openGroup(ENCLOSURE_PAIR_GROUP, enclosurePairId(pair.pitch.id))
    try {
      stampGlyph(ctx, String.fromCodePoint(GLYPH_CODEPOINTS[glyphs.left]), x(pair.leftParenX), y(pair.line), font)
      stampGlyph(ctx, String.fromCodePoint(GLYPH_CODEPOINTS[glyphs.right]), x(pair.rightParenX), y(pair.line), font)
    } finally {
      if (grouped) ctx.closeGroup()
    }
  }
}

/**
 * ⭐ Register each bracket's GLYPH box (`headEnclosure`, keyed by the head's pitch id) so a press can land
 * on it — `(` and `)` each their own box, from the metric table, where {@link stampEnclosure} stood them.
 * @param x / y the stamps' own mapping, in the registry's STAFF px (a grace passes its scaled one).
 * @param spacePx one of the brackets' staff spaces, in those px (a grace's is its scale's).
 */
export function registerEnclosure(
  pass: RenderPass, layout: EnclosureLayout, x: (sp: number) => number, y: (line: number) => number,
  spacePx: number, measureNumber: number, staffIndex: number,
): void {
  for (const pair of layout.pairs) {
    const glyphs = ENCLOSURE_GLYPHS[pair.shape]
    for (const [name, origin] of [[glyphs.left, pair.leftParenX], [glyphs.right, pair.rightParenX]] as const) {
      const box = glyphBox(name)
      const left = x(origin - box.left)
      pass.elementRegistry.add({
        type: 'headEnclosure',
        noteId: pair.pitch.id,
        measure: measureNumber,
        staff: staffIndex,
        bbox: { x: left, y: y(pair.line) - box.up * spacePx, width: x(origin + box.right) - left, height: (box.up + box.down) * spacePx },
      })
    }
  }
}
