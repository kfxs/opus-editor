/**
 * ⭐⭐ **PARENTHESISED NOTES, drawn** (`docs/plans/parenthesised-note-plan.md` P1) — the brackets a head
 * wears (`NotePitch.enclosure`), stamped round the notes just drawn: free functions over the passed-in
 * {@link RenderPass}, like `GracePass`, inside the bar's measure group.
 *
 * WHERE each bracket stands is `layout/headEnclosure.enclosureLayout` — the same call
 * `measureColumns.slotInk` reserved the room with. The head, its accidental, its dots and its stem are the
 * note's own, drawn by the note; this pass adds only the brackets.
 *
 * ⏳ P1: a chord's heads. A grace's brackets are P3; the selection colouring them is P4.
 */
import type { ChordRest, Clef, Fraction, KeySignature } from '@/types/music'
import type { RenderPass } from './RenderPass'
import type { EngravedNote } from './engraved/EngravedNote'
import { maybeStaveOf, staveFrame } from './staff/staveFrame'
import { noteLineY } from '@/engine/engrave/staff/staffFrame'
import { stampGlyph } from '@/engine/engrave/glyph'
import { musicGlyphFont } from '@/engine/engrave/inheritedFonts'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import { ENCLOSURE_GLYPHS, enclosureLayout } from '@/engine/layout/headEnclosure'
import { displayedAccidentals } from '@/utils/accidentalState'
import { C_MAJOR } from '@/utils/keySignature'

/** The group class — one per chord whose heads wear brackets. */
export const ENCLOSURE_GROUP = 'enclosure'

/**
 * Draw the brackets of every parenthesised head in one lane of one bar. `slots` / `staveNotes` are the
 * lane's, index for index (the grace and fan passes' contract).
 */
export function drawEnclosures(
  pass: RenderPass,
  slots: ChordRest[],
  staveNotes: EngravedNote[],
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
    const layout = enclosureLayout({ notes: slot.notes, dots: slot.dots, stemDown, upFlag }, id => signs.get(id), clefForBeat(slot.beat))
    if (!layout) continue
    const stave = maybeStaveOf(staveNotes[i])
    if (!stave) continue
    const frame = staveFrame(stave)
    const hostX = staveNotes[i].getNoteHeadBeginX()
    const x = (sp: number): number => hostX + sp * frame.spacePx
    ctx.openGroup(ENCLOSURE_GROUP, `${ENCLOSURE_GROUP}-${slot.id}`)
    try {
      for (const pair of layout.pairs) {
        const glyphs = ENCLOSURE_GLYPHS[pair.shape]
        const y = noteLineY(frame, pair.line)
        stampGlyph(ctx, String.fromCodePoint(GLYPH_CODEPOINTS[glyphs.left]), x(pair.leftParenX), y, font)
        stampGlyph(ctx, String.fromCodePoint(GLYPH_CODEPOINTS[glyphs.right]), x(pair.rightParenX), y, font)
      }
    } finally {
      ctx.closeGroup()
    }
  }
}
