/**
 * ⭐⭐ **BRACKETED GRACES, drawn** (`docs/plans/bracketed-grace-plan.md` P1) — a black head in round
 * brackets, no stem, no flag, before its chord: free functions over the passed-in {@link RenderPass},
 * like `GracePass` — which calls this, being the pass of a chord's before side — inside the bar's
 * measure group, after the notes they stand beside.
 *
 * WHERE each head, sign and bracket stands is `layout/bracketedRoom.beforeSideLayout` — the same call
 * `measureColumns.slotInk` reserved the room with. The head, its accidental and its ledger lines are
 * drawn in its own `scaling(k)` group at the armed size (B7), composed from a normal note's parts as a
 * grace is; the brackets at the head's size or at FULL size (stamped at 1 / k), as the armed form says (B9).
 *
 * ⛔ It SOUNDS nothing (B6). ⭐ Since P2b each head is a NOTE in the registry under its pitch id, and its
 * group is filed in the member map — so a click selects it, the arrows re-pitch it, Delete removes it,
 * all through the lookups' `{ bracketed: true }` opt-in (`models/slotLookup`).
 */
import type { ChordRest, Clef, Fraction, KeySignature } from '@/types/music'
import type { RenderPass } from './RenderPass'
import type { EngravedNote } from './engraved/EngravedNote'
import type { EngravedStave } from './engraved/EngravedStave'
import { EngravedAccidental } from './engraved/EngravedAccidental'
import { maybeStaveOf, staveFrame } from './staff/staveFrame'
import { openMemberGroup } from './memberGroup'
import { noteOffsetOverrideOf } from '@/engine/models/engravingOverrides'
import { spellingToMidi } from '@/utils/pitchSpelling'
import { scaling } from '@/engine/paint/Affine'
import { noteLineY, type StaffFrame } from '@/engine/engrave/staff/staffFrame'
import { headGlyph } from '@/engine/engrave/notes/keyLines'
import { drawNoteHead } from '@/engine/engrave/notes/noteheads'
import { drawLedgerLines, ledgerLineRuns } from '@/engine/engrave/notes/ledgerLines'
import { stampGlyph } from '@/engine/engrave/glyph'
import { MUSIC_FONT_SIZE_PT, accidentalFont, musicFont, musicGlyphFont, noteFont } from '@/engine/engrave/inheritedFonts'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import { BRACKET_FORMS, bracketForm, bracketedAfterLayout, bracketedScale, beforeSideLayout, hostRightReach, type BracketedPlace } from '@/engine/layout/bracketedRoom'
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
 * Draw every slot's BRACKETED graces before it — a chord's, or a rest's — for one lane of one bar. `slots` / `staveNotes` are
 * the lane's, index for index (the fan and grace passes' contract).
 */
export function drawBracketedGraces(
  pass: RenderPass,
  slots: ChordRest[],
  staveNotes: EngravedNote[],
  measureNumber: number,
  staffIndex: number,
  clefForBeat: (beat: Fraction) => Clef,
  /** The key governing this lane's bar — a bracketed sign is read against it and the bar (B6). */
  key: KeySignature = C_MAJOR,
): void {
  const after = (s: ChordRest) => s.type === 'chord' && !!s.bracketedAfter?.length
  if (!slots.some(s => after(s) || s.bracketedBefore?.length || s.graceBefore?.notes.some(g => g.bracketedBefore?.length))) return
  const signs = displayedAccidentals(slots, key)
  const signOf: SignOf = id => signs.get(id)
  for (let i = 0; i < slots.length && i < staveNotes.length; i++) {
    const slot = slots[i]
    // A chord's — or a REST's (B10 reversed: entered first, on an empty bar) — its graces' (P3), and
    // those AFTER a chord (P5).
    if (!after(slot) && !slot.bracketedBefore?.length && !slot.graceBefore?.notes.some(g => g.bracketedBefore?.length)) continue
    const stave = maybeStaveOf(staveNotes[i])
    if (!stave) continue
    const clef = clefForBeat(slot.beat)
    const side = beforeSideLayout(slot, signOf, clef, hostLeftReach(slot.type === 'chord' ? slot.notes : [], signOf, clef))
    // ⭐ P5 — the AFTER side, from the host's RIGHT ink (`bracketedAfterLayout`, the room's own call).
    const afterLayout = slot.type === 'chord' && slot.bracketedAfter?.length
      ? bracketedAfterLayout(slot.bracketedAfter, signOf, clef,
        hostRightReach(slot, clef, staveNotes[i].hasFlag() && staveNotes[i].getStemDirection() === 1))
      : null
    const layouts = [...side.graceBracketed.map(g => g.layout), ...(side.bracketed ? [side.bracketed] : []), ...(afterLayout ? [afterLayout] : [])]
    if (!layouts.length) continue
    const hostX = staveNotes[i].getNoteHeadBeginX()
    const ctx = pass.context
    ctx.openGroup(BRACKETED_GROUP, `${BRACKETED_GROUP}-${slot.id}`)
    try {
      for (const layout of layouts) for (const place of layout.places) drawOne(pass, place, hostX, stave, measureNumber, staffIndex)
    } finally {
      ctx.closeGroup()
    }
  }
}

function drawOne(
  pass: RenderPass, place: BracketedPlace, hostX: number, stave: EngravedStave, measureNumber: number, staffIndex: number,
): void {
  const ctx = pass.context
  const frame: StaffFrame = staveFrame(stave)
  const space = frame.spacePx
  const k = bracketedScale()
  const form = BRACKET_FORMS[bracketForm()]
  /** Staff px → the head's own px (inside its `scaling(k)` group). */
  const local = (v: number): number => v / k
  // ⭐ + its hand OFFSET (keyed by its first pitch id, `slotLookup.offsetTargetOf` — the grace's way): ink
  //    only — the room `beforeSideLayout` reserved stays, as a grace's offset leaves the bar's width alone.
  const offset = noteOffsetOverrideOf(pass.score, place.bracketed.pitches[0]?.id ?? '')?.x ?? 0
  const x = (sp: number): number => hostX + (sp + offset) * space // staff px
  const glyphWidth = (place.headWidth / k) * space // the head's own px: the transform scales it
  const leftParen = String.fromCodePoint(GLYPH_CODEPOINTS[form.left])
  const rightParen = String.fromCodePoint(GLYPH_CODEPOINTS[form.right])
  const ledgerStyle = stave.getDefaultLedgerLineStyle()

  // ⭐ Its own group, filed in the member map under each pitch (P2b), and ⭐ SCALED ITSELF: every piece of
  //    its ink — head, accidental, ledger lines, brackets — is a DIRECT child, which is what the selection
  //    highlight walks (his report, 2026-09-23: a selected bracket's accidental was not lit — it sat in
  //    a nested scaled group the highlight never enters). A FULL-size bracket is stamped at 1 / k in it.
  const group = openMemberGroup(ctx, BRACKETED_NOTE_GROUP, `${BRACKETED_NOTE_GROUP}-${place.bracketed.pitches[0]?.id}`, scaling(k))
  try {
    place.heads.forEach((head, h) => {
      const y = noteLineY(frame, head.line)
      const left = x(place.headX)
      const width = place.headWidth * space
      // ⭐ A NOTE under its pitch id, so a click selects it and the arrows re-pitch it — ⚠️ WITHOUT a
      //    `beat`, the grace's reason: it stands left of the beat's own head (`GracePass`).
      pass.elementRegistry.add({
        type: 'note',
        id: head.pitch.id,
        measure: measureNumber,
        staff: staffIndex,
        pitch: spellingToMidi(head.pitch.step, head.pitch.alter, head.pitch.octave),
        duration: place.bracketed.duration,
        headX: left + width / 2,
        bbox: { x: left, y: y - (space * k) / 2, width, height: space * k },
      })
      if (group) pass.fanMemberGroupMap.set(head.pitch.id, { group, noteIndex: h })
    })
    drawLedgerLines(
      ctx,
      ledgerLineRuns(place.heads.map(h => ({ line: h.line, x: local(x(place.headX)) })), glyphWidth, LEDGER_OVERHANG),
      line => local(noteLineY(frame, line)),
      { ...ledgerStyle, lineWidth: (ledgerStyle.lineWidth ?? 1) / k },
    )
    const parenFont = form.fullSize ? musicFont(MUSIC_FONT_SIZE_PT / k) : musicGlyphFont()
    for (const head of place.heads) {
      const y = local(noteLineY(frame, head.line))
      // ⭐ Its OWN written value's head (B7 revised: a half is hollow, a quarter black).
      drawNoteHead(ctx, { glyph: headGlyph(place.bracketed.duration, false), x: local(x(place.headX)), y, font: noteFont() })
      if (head.sign && head.accidentalX !== null) {
        const glyph = new EngravedAccidental(head.sign).getText()
        stampGlyph(ctx, glyph, local(x(head.accidentalX)), y, accidentalFont(glyph))
      }
      stampGlyph(ctx, leftParen, local(x(head.leftParenX)), y, parenFont)
      stampGlyph(ctx, rightParen, local(x(head.rightParenX)), y, parenFont)
    }
  } finally {
    ctx.closeGroup()
  }
}
