/**
 * ⭐⭐ **GRACE NOTES, drawn** (`docs/plans/grace-notes-plan.md` §5) — free functions over the passed-in
 * {@link RenderPass}, like {@link FanPass}: the groups BEFORE each chord of one lane of one bar,
 * inside that bar's measure group, after the notes they hang on have been drawn.
 *
 * ⭐ **A grace is COMPOSED from a normal note's parts at a scale, placed by ONE affine** — ⛔ never
 * SMuFL's precomposed grace glyphs (SMuFL says so itself; Leipzig has none; a glyph cannot take an
 * accidental, a ledger or a beam). One `<g class="grace">` per group carries `scaling(k)`, so every
 * piece inside is drawn in the grace's own coordinates (the staff's ÷ k) and comes out k× smaller —
 * head, flag, accidental, and the ledger lines *"shorter … in proportion"* (Gould p. 26).
 * ⚠️ Except the STROKES the rows keep at the SYSTEM's weight: the stem (Gould's grace plate does not
 * thin it) and the ledger lines (G&L p. 75) are drawn at `weight ÷ k`, which the transform brings
 * back to the full note's.
 *
 * WHERE each head stands is `layout/graceRoom.graceLayout` — the same call `measureColumns.slotInk`
 * reserved the room with, so the drawing cannot stand anywhere the width did not pay for.
 *
 * ⭐ A grace head is registered as a NOTE under its pitch id (the fan member's terms,
 * `docs/plans/fanned-beam-pitches-plan.md` §2), so a click selects it and the arrows re-pitch it —
 * ⚠️ WITHOUT a `beat`: `ElementRegistry.pixelXToBeat` keeps the LEFTMOST head of a beat as its
 * anchor, and a grace stands left of its principal. Its group joins `fanMemberGroupMap` — the map of
 * pitches drawn outside their `StaveNote` — which is what the selection highlight reads.
 */
import type { ChordRest, Clef, Fraction, GraceGroup, GraceNote, KeySignature, NoteDuration } from '@/types/music'
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { GracePassContext } from './RenderPass'
import type { EngravedNote } from './engraved/EngravedNote'
import type { EngravedStave } from './engraved/EngravedStave'
import { EngravedAccidental } from './engraved/EngravedAccidental'
import { drawGroupOf } from './painter/svgDrawGroup'
import { fanArticulationPosition, placeMemberArticulations } from './beams/fanArticulations'
import { openMemberGroup } from './memberGroup'
import { maybeStaveOf, staveFrame } from './staff/staveFrame'
import { chordHeadDisplacement } from './format/chordHeadLayout'
import { scaling } from '@/engine/paint/Affine'
import { noteLineY } from '@/engine/engrave/staff/staffFrame'
import { headGlyph } from '@/engine/engrave/notes/keyLines'
import { drawNoteHead } from '@/engine/engrave/notes/noteheads'
import { drawStem } from '@/engine/engrave/notes/stem'
import { flagPlacement } from '@/engine/engrave/notes/flag'
import { drawLedgerLines, ledgerLineRuns } from '@/engine/engrave/notes/ledgerLines'
import { GRACE_SLASH, graceSlash, graceSlashDownOrigin, graceSlashOnBeam, graceSlashUnflagged, mirrorSegment } from '@/engine/engrave/notes/graceGroup'
import { graceBeam, graceBeamRuns } from '@/engine/engrave/notes/graceBeam'
import { drawBeamLines } from '@/engine/engrave/beams/beamLines'
import { armedBeamSlopeRule } from './beams/beamSlopeExperiment'
import { crossSystemBeamWidth } from './beams/beamInk'
import { BEAM_END_OVERSHOOT } from './engraved/EngravedBeam'
import { stampGlyph } from '@/engine/engrave/glyph'
import { accidentalFont, musicGlyphFont, noteFont } from '@/engine/engrave/inheritedFonts'
import { NOTE_DURATION_ROWS, stemThicknessPx } from '@/engine/engrave/inheritedDefaults'
import { flagGlyph, glyphBox, noteheadInk } from '@/engine/fonts/fontMetrics'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import { accidentalExtent } from '@/engine/layout/spacingPadding'
import { dotSizeScale } from '@/engine/layout/dotSize'
import { graceDotXs, graceEnclosure, graceLayout, graceScale, withGraceGroupScale, graceStemSpaces, hostLeftReach, type SignOf } from '@/engine/layout/graceRoom'
import { displayedAccidentals } from '@/utils/accidentalState'
import { beforeSideLayout } from '@/engine/layout/bracketedRoom'
import { drawBracketedGraces } from './BracketedGracePass'
import { drawEnclosures, registerEnclosure, stampEnclosure } from './EnclosurePass'
import { staffLineForSpelling } from '@/utils/clefUtils'
import { spellingDiatonicPos, spellingToMidi, spellingToNoteKey } from '@/utils/pitchSpelling'
import { C_MAJOR } from '@/utils/keySignature'
import { noteOffsetOverrideOf } from '@/engine/models/engravingOverrides'

/** The group class — one per grace group, carrying the scale. */
export const GRACE_GROUP = 'grace'
/** One grace note (or chord) inside it — the unit the selection highlight recolours. */
export const GRACE_NOTE_GROUP = 'gracenote'
/** A beam across a run of graces (P2b) — inside the group, outside every {@link GRACE_NOTE_GROUP}. */
export const GRACE_BEAM_GROUP = 'gracebeam'
/** How far a grace's ledger line runs past its head, in the GRACE's own px — the fan's 3 px, which
 *  the group's scale shortens in proportion. */
export const GRACE_LEDGER_OVERHANG = 3

/**
 * Draw every grace group BEFORE a chord of this lane. `slots` / `staveNotes` are the lane's, index
 * for index (the fan pass's contract).
 */
export function drawGraceNotes(
  pass: GracePassContext,
  slots: ChordRest[],
  staveNotes: EngravedNote[],
  measureNumber: number,
  staffIndex: number,
  clefForBeat: (beat: Fraction) => Clef,
  /** The key governing this lane's bar — the graces' signs are decided with the notes' (one walk). */
  key: KeySignature = C_MAJOR,
  /**
   * Which of the lane's notes to draw for — every one when absent (the page). The bent staff draws each
   * note in a block of its own, so it asks for one at a time; the SIGNS are still read over the whole lane.
   */
  only?: (index: number) => boolean,
): void {
  // ⭐ The brackets of the lane's PARENTHESISED heads (`./EnclosurePass`) — drawn from here, the lane's
  //    one pass over the notes just drawn, so the renderer's loop stays one call wide.
  drawEnclosures(pass, slots, staveNotes, measureNumber, staffIndex, clefForBeat, key, only)
  // ⭐ The chord's BRACKETED graces first — the rest of its before side (`./BracketedGracePass`).
  drawBracketedGraces(pass, slots, staveNotes, measureNumber, staffIndex, clefForBeat, key, only)
  if (!slots.some(s => s.graceBefore)) return
  const signs = displayedAccidentals(slots, key)
  const signOf: SignOf = id => signs.get(id)
  for (let i = 0; i < slots.length && i < staveNotes.length; i++) {
    const slot = slots[i]
    if (!slot.graceBefore || (only && !only(i))) continue
    const stave = maybeStaveOf(staveNotes[i])
    if (!stave) continue
    // ⭐ At the group's OWN size — a group of cue graces is the cue-grace size (cue-size-plan C4): every
    //   helper the draw reaches asks `graceScale()`, which answers this group's inside the scope.
    const group = slot.graceBefore
    withGraceGroupScale(group, () =>
      drawGraceGroup(pass, slot, group, staveNotes[i], stave, clefForBeat(slot.beat), signOf, measureNumber, staffIndex))
  }
}

function drawGraceGroup(
  pass: GracePassContext,
  /** A chord — or a REST (D7 reversed), whose notes are none. */
  host: ChordRest,
  group: GraceGroup,
  hostNote: EngravedNote,
  stave: EngravedStave,
  clef: Clef,
  signOf: SignOf,
  measureNumber: number,
  staffIndex: number,
): void {
  const ctx = pass.context
  const frame = staveFrame(stave)
  const space = frame.spacePx
  const k = graceScale()
  /** Staff px → the grace's own px (inside the `scaling(k)` group). */
  const local = (v: number): number => v / k
  const lineOf = (p: { step: Parameters<typeof staffLineForSpelling>[0]; octave: number }) =>
    staffLineForSpelling(p.step, p.octave, clef)

  const hostX = hostNote.getNoteHeadBeginX()
  const hostPitches = host.type === 'chord' ? host.notes : []
  // ⭐ The before side's ONE layout: a chord's BRACKETED graces stand between the group and it
  //    (`layout/bracketedRoom`, which the room was reserved with too).
  const layout = beforeSideLayout(host, signOf, clef, hostLeftReach(hostPitches, signOf, clef)).graces
    ?? graceLayout(group, signOf, clef, hostLeftReach(hostPitches, signOf, clef))
  const ledgerStyle = stave.getDefaultLedgerLineStyle()
  /** ⭐ The group's stems — up by default, DOWN when flipped (P6, `X`): `1` / `-1`, VexFlow's sign. */
  const dir = group.stemDirection === 'down' ? -1 : 1
  const down = dir === -1

  // ⭐ Every grace's geometry FIRST, so a beam (P2b) can be solved over its run before a stem is drawn.
  const drawn = layout.places.map(place => {
    const { note } = place
    // ⭐ + its hand OFFSET (keyed like a fan member's, `ScoreModel.offsetTargetOf`): ink only — the
    //    room `graceLayout` reserved stays, as a note offset leaves its bar's width alone.
    const offset = noteOffsetOverrideOf(pass.score, note.pitches[0]?.id ?? '')?.x ?? 0
    const headLeft = hostX + (place.headX + offset) * space // staff px
    const lines = note.pitches.map(lineOf)
    const ys = lines.map(line => noteLineY(frame, line))
    const stem = graceStemLine({
      headLeft: local(headLeft), highY: local(Math.min(...ys)), lowY: local(Math.max(...ys)),
      duration: note.duration, space, stemSpaces: graceStemSpaces(lines, down), stemDirection: dir,
    })
    return { note, headLeft, lines, ys, stem }
  })
  // ⭐ The BEAMS — runs of flagged graces, each solved by the page's own beam rule (`graceBeam`).
  const beamTips = new Map<number, number>()
  const beams = graceBeamRuns(group.notes).map(run => {
    const beam = graceBeam({
      notes: run.map(i => ({
        duration: drawn[i].note.duration, dots: drawn[i].note.dots,
        stemX: drawn[i].stem.stemX, tipY: drawn[i].stem.tipY,
        beamSideLine: down ? Math.min(...drawn[i].lines) : Math.max(...drawn[i].lines),
      })),
      space, rule: armedBeamSlopeRule(), beamWidth: crossSystemBeamWidth(), stemWidth: drawn[run[0]].stem.stemWeight,
      endOvershoot: BEAM_END_OVERSHOOT, stemDirection: dir,
    })
    run.forEach((i, r) => beamTips.set(i, beam.tipYs[r]))
    const lead = drawn[run[0]]
    // The head the stem grows FROM — the far end from the beam.
    return { beam, first: { ...lead.stem, headY: local(down ? Math.min(...lead.ys) : Math.max(...lead.ys)), duration: lead.note.duration } }
  })

  const opened = drawGroupOf(ctx.openGroup(GRACE_GROUP, `${GRACE_GROUP}-${host.id}-before`))
  opened?.setPlacement(scaling(k))
  try {
    for (const [index, { note, headLeft, lines, ys }] of drawn.entries()) {
      const glyphWidth = noteheadInk(note.duration) * space // the grace's own px: the transform scales it
      const displaced = chordHeadDisplacement(lines, dir)
      // A displaced head goes to the OTHER side of the stem: right of it stems up, left stems down.
      const headXs = displaced.map(d => local(headLeft) + (d ? dir * glyphWidth : 0)) // grace px
      const beamTipY = beamTips.get(index)

      const noteGroup = openMemberGroup(ctx, GRACE_NOTE_GROUP, `${GRACE_NOTE_GROUP}-${note.pitches[0]?.id}`)
      try {
        drawLedgerLines(
          ctx,
          ledgerLineRuns(lines.map((line, h) => ({ line, x: headXs[h] })), glyphWidth, GRACE_LEDGER_OVERHANG),
          line => local(noteLineY(frame, line)),
          { ...ledgerStyle, lineWidth: (ledgerStyle.lineWidth ?? 1) / k },
        )

        for (let h = 0; h < note.pitches.length; h++) {
          const pitch = note.pitches[h]
          drawNoteHead(ctx, { glyph: headGlyph(note.duration, false), x: headXs[h], y: local(ys[h]), font: noteFont() })
          const sign = signOf(pitch.id)
          if (typeof sign === 'string') {
            // One column: the sign's own extent left of the head (`layout/graceRoom` reserved the same).
            const reach = accidentalExtent([{ position: spellingDiatonicPos(pitch.step, pitch.octave), sign }]) * space
            const glyph = new EngravedAccidental(sign).getText()
            stampGlyph(ctx, glyph, local(headLeft) - reach, local(ys[h]), accidentalFont(glyph))
          }
          // ⭐ Registered in STAFF px (the measure's own `withScale` takes it to the page) — and with
          //    no `beat`, see the header.
          const headWidthPx = glyphWidth * k
          const x = headXs[h] * k
          pass.elementRegistry.add({
            type: 'note',
            id: pitch.id,
            measure: measureNumber,
            staff: staffIndex,
            pitch: spellingToMidi(pitch.step, pitch.alter, pitch.octave),
            duration: note.duration,
            headX: x + headWidthPx / 2,
            bbox: { x, y: ys[h] - (space * k) / 2, width: headWidthPx, height: space * k },
          })
          if (noteGroup) pass.fanMemberGroupMap.set(pitch.id, { group: noteGroup, noteIndex: h })
          // ⭐ …and its GEOMETRY, on the fan member's terms, so a REAL slur (the user's — a grace draws
          //    none of its own) can spring from or land on it: `SlurRenderer` resolves an end here first.
          pass.fanMemberAnchorMap.set(pitch.id, {
            staveNote: hostNote, leftX: x, rightX: x + headWidthPx, headY: ys[h],
            tipY: beamTipY !== undefined ? beamTipY * k
              : NOTE_DURATION_ROWS[note.duration].stem
                ? (down ? Math.max(...ys) + graceStemSpaces(lines, true) * space : Math.min(...ys) - graceStemSpaces(lines) * space)
                : ys[h],
            stemDirection: dir,
          })
        }

        drawGraceDots(ctx, local(headLeft), ys.map(local), lines, note, space, beamTipY !== undefined, down)
        // ⭐ Its BRACKETS, when parenthesised — the grace's own layout (`graceRoom.graceEnclosure`, which
        //    reserved the room), at the grace's size, inside its own member group so the highlight reaches them.
        const brackets = graceEnclosure(note, beamTipY !== undefined, down, signOf, clef)
        if (brackets) {
          stampEnclosure(ctx, brackets, sp => local(headLeft) + sp * space, line => local(noteLineY(frame, line)), musicGlyphFont())
          // …and its boxes, in STAFF px (the registry's), at the grace's size.
          registerEnclosure(pass, brackets, sp => headLeft + sp * space * k, line => noteLineY(frame, line), space * k, measureNumber, staffIndex)
        }
        drawGraceArticulations(pass, {
          note, stave, clef, headLeft, glyphWidth, stemPx: graceStemSpaces(lines, down) * space, measureNumber, staffIndex,
          stemDirection: dir,
        })
        drawGraceStem(ctx, {
          headLeft: local(headLeft), highY: local(Math.min(...ys)), lowY: local(Math.max(...ys)),
          duration: note.duration, slash: !!group.slash, space, stemSpaces: graceStemSpaces(lines, down),
          stemDirection: dir,
          ...(beamTipY !== undefined && { beamTipY }),
        })
      } finally {
        ctx.closeGroup()
      }
    }
    // ⭐ Each beam in its OWN group, outside every `gracenote` group — the fan's rule: a selected grace
    //    lights its head and stem, never the beam it shares.
    beams.forEach(({ beam, first }) => {
      ctx.openGroup(GRACE_BEAM_GROUP)
      try {
        drawBeamLines(ctx, beam.lines, beam.thickness)
        // ⭐ P2c — an acciaccatura's ONE slash, across the FIRST stem and its beam: the ARMED preset's
        //    (`graceGroup.GRACE_BEAM_SLASH_RULES` — MuseScore's, his call; `none` draws nothing).
        const slash = group.slash ? graceSlashOnBeam({
          stemX: first.stemX, stemWeight: first.stemWeight, tipY: beam.tipYs[0], headY: first.headY,
          slope: beam.slope, headWidth: noteheadInk(first.duration) * space, space, k, stemDirection: dir,
        }) : null
        if (slash?.kind === 'glyph') {
          stampGlyph(ctx, String.fromCodePoint(GLYPH_CODEPOINTS[slash.glyph]), slash.x, slash.y, noteFont())
        } else if (slash) {
          ctx.beginPath()
          ctx.setLineWidth(slash.thickness)
          ctx.moveTo(slash.segment.x1, slash.segment.y1)
          ctx.lineTo(slash.segment.x2, slash.segment.y2)
          ctx.stroke()
        }
      } finally {
        ctx.closeGroup()
      }
    })
  } finally {
    ctx.closeGroup()
  }
}

/**
 * ⭐ A grace's augmentation DOTS, in the grace's own px — at {@link graceDotXs} past the head's anchor
 * (the room's own numbers), one row per head: a head on a LINE moves its dot up into the space above
 * (the real notes' rule, `engrave/notes/dotStack`). Shared with the tool's ghost.
 */
export function drawGraceDots(
  ctx: DrawContext, headLeft: number, headYs: readonly number[], lines: readonly number[],
  note: Pick<GraceNote, 'duration' | 'dots'>, space: number,
  /** A BEAMED grace has no flag for its dot to clear (P2b) — nor has a stem-DOWN one (P6). */
  beamed = false,
  down = false,
): void {
  const xs = graceDotXs(note, beamed, down)
  if (xs.length === 0) return
  const glyph = String.fromCodePoint(GLYPH_CODEPOINTS.augmentationDot)
  const rows = new Set<number>()
  lines.forEach((line, h) => rows.add(Number.isInteger(line) ? headYs[h] - space / 2 : headYs[h]))
  for (const y of rows) {
    // At the armed dot SIZE (`layout/dotSize`, P4f), as a note's.
    for (const x of xs) stampGlyph(ctx, glyph, headLeft + x * space, y, musicGlyphFont(dotSizeScale()))
  }
}

/** One grace's stem, flag and slash, in the GRACE's own px (inside its `scaling(k)` group). */
export interface GraceStemInk {
  /** The head's left edge. */
  headLeft: number
  /** The highest and lowest head's y. */
  highY: number
  lowY: number
  duration: NoteDuration
  slash: boolean
  /** The STAFF's space, px — the rows are staff spaces of the page, not of the grace. */
  space: number
  /** How long the stem is, highest head → tip, staff spaces — `graceStemSpaces`, which grows it for
   *  a grace on ledger lines (Gould p. 126). */
  stemSpaces: number
  /** ⭐ A BEAMED grace's tip, ON its beam (P2b, `engrave/notes/graceBeam`) — the stem runs to it and
   *  draws NO flag and no slash of its own: a beamed group's ONE slash is drawn with its beam (P2c). */
  beamTipY?: number
  /** The group's stems: `1` up (the default), `-1` down — P6's flip (`GraceGroup.stemDirection`). */
  stemDirection?: number
}

/** Where a grace's stem stands and where its free end is before any beam — grace px. Stems UP: on
 *  the head's right edge, past the highest head; stems DOWN (P6): on its left edge, past the lowest. */
export function graceStemLine(
  ink: Pick<GraceStemInk, 'headLeft' | 'highY' | 'lowY' | 'duration' | 'space' | 'stemSpaces' | 'stemDirection'>,
): { stemX: number; tipY: number; stemWeight: number } {
  const k = graceScale()
  const stemWeight = stemThicknessPx() / k
  const glyphWidth = noteheadInk(ink.duration) * ink.space
  const reach = (ink.stemSpaces * ink.space) / k
  return ink.stemDirection === -1
    ? { stemX: ink.headLeft + stemWeight / 2, tipY: ink.lowY + reach, stemWeight }
    : { stemX: ink.headLeft + glyphWidth - stemWeight / 2, tipY: ink.highY - reach, stemWeight }
}

/**
 * ⭐ **A grace's stem, flag and slash** — shared by the page and the tool's ghost, so the preview is the
 * picture. UP by default (research §0.4), from the lowest head to `stemSpaces` past the highest — or
 * DOWN when the group is flipped (P6), the mirror; the stem and the slash keep the SYSTEM's weight
 * (÷ k here, × k by the group).
 */
export function drawGraceStem(ctx: DrawContext, ink: GraceStemInk): void {
  // ⭐ What the note HAS — a stem, a flag — asked of the ONE table the real notes read
  //    (`NOTE_DURATION_ROWS`), ⛔ never a list of today's durations: a new value brings its row.
  const row = NOTE_DURATION_ROWS[ink.duration]
  if (!row.stem) return // no stem, no slash either
  const { space } = ink
  const up = ink.stemDirection !== -1
  const { stemX, tipY: freeTip, stemWeight } = graceStemLine(ink)
  const tipY = ink.beamTipY ?? freeTip
  drawStem(ctx, { x: stemX, fromY: up ? ink.lowY : ink.highY, toY: tipY }, stemWeight)
  if (ink.beamTipY !== undefined) return // beamed: the beam is its flag, and the group's slash is the beam's
  const flag = row.flag ? flagGlyph(ink.duration, up) : null
  // Where the flag glyph stands — its origin is also where the slash's anchors are measured from.
  const reach = flag ? (up ? glyphBox(flag).up : glyphBox(flag).down) * space : 0
  const at = flagPlacement({ x: stemX, tipY, up }, stemWeight, reach)
  if (flag) stampGlyph(ctx, String.fromCodePoint(GLYPH_CODEPOINTS[flag]), at.x, at.baselineY, noteFont())
  if (ink.slash) {
    // In the grace's own px, where the flag glyph is full size — the font's anchors are in its units.
    // ⭐ A FLAG's slash is the FONT's GLYPH, E564, its lower-left corner on the flag's `graceNoteSlashSW`
    //    anchor — what SMuFL made the anchors for (his call, 2026-09-22: the single grace's slash must
    //    MATCH the group's, which is the glyph). A stem with none (a quarter, a half) keeps its own drawn
    //    position, at the glyph's WEIGHT.
    //    Stems DOWN (P6): E565, its upper-left corner on the down flag's `graceNoteSlashNW` — the mirror.
    if (row.flag) {
      const origin = { x: at.x, y: at.baselineY }
      if (up) {
        const sw = graceSlash(origin, flag, space)
        stampGlyph(ctx, String.fromCodePoint(GLYPH_CODEPOINTS.graceNoteSlashStemUp), sw.x1, sw.y1, noteFont())
      } else {
        const nw = graceSlashDownOrigin(origin, flag, space)
        stampGlyph(ctx, String.fromCodePoint(GLYPH_CODEPOINTS.graceNoteSlashStemDown), nw.x, nw.y, noteFont())
      }
      return
    }
    const drawn = graceSlashUnflagged(stemX, tipY, space)
    const slash = up ? drawn : mirrorSegment(drawn, tipY)
    ctx.beginPath()
    ctx.setLineWidth(GRACE_SLASH.thickness.value * space)
    ctx.moveTo(slash.x1, slash.y1)
    ctx.lineTo(slash.x2, slash.y2)
    ctx.stroke()
  }
}

/**
 * ⭐ **A grace's ARTICULATIONS** (his call, 2026-09-22: *"we should have articulation in the grace"*;
 * Gould p. 125 — *"Tails, beams, articulation and accidentals are also scaled down proportionally"*).
 *
 * PLACED by the real notes' rule — the fan members' stand-in (`beams/fanArticulations`
 * `placeMemberArticulations`: the same column, `articulationStack` + `articulationPlacement`), standing
 * on the REAL staff so a mark inside it still snaps off a line into a space — centred on the grace's
 * own head, its step OUT from the head scaled by the grace's size (`outwardScale`: proportional, as the
 * dots are). Then each glyph is stamped at the GRACE's size about the point the rule chose.
 * The side: the notehead's (a grace's stem is always up ⇒ below), unless the grace was flipped.
 * Registered like a fan member's mark, keyed on the grace's first pitch, so it can be clicked.
 */
function drawGraceArticulations(
  pass: GracePassContext,
  a: {
    note: GraceNote; stave: EngravedStave; clef: Clef
    /** The head's left edge and the head glyph's FULL-size width, staff px. */
    headLeft: number; glyphWidth: number
    stemPx: number; measureNumber: number; staffIndex: number
    /** The group's stems (P6): `1` up, `-1` down — the auto side is the notehead's, so it flips too. */
    stemDirection: number
  },
): void {
  const types = a.note.articulations ?? []
  if (!types.length) return
  const k = graceScale()
  const ctx = pass.context
  // The stand-in is a FULL-size note: stand it so its head's CENTRE is the grace head's.
  const centreX = a.headLeft + (a.glyphWidth * k) / 2
  const placed = placeMemberArticulations(a.stave, {
    types,
    keys: a.note.pitches.map(p => spellingToNoteKey(p.step, p.alter, p.octave)),
    clef: a.clef,
    headX: centreX - a.glyphWidth / 2,
    stemLengthPx: a.stemPx,
    placement: a.note.articulationPlacement,
  }, { position: fanArticulationPosition(a.stemDirection), stemDirection: a.stemDirection, outwardScale: k })
  for (const { type, ink, box } of placed) {
    // Scale the mark about its own centre: the point the rule chose stays, the glyph shrinks to k.
    const cx = box ? box.x + box.w / 2 : ink.x
    const cy = box ? box.y + box.h / 2 : ink.y
    const sx = cx + (ink.x - cx) * k
    const sy = cy + (ink.y - cy) * k
    stampGlyph(ctx, ink.glyph, sx / k, sy / k, ink.font)
    if (box) {
      pass.elementRegistry.add({
        type: 'articulation',
        noteId: a.note.pitches[0].id,
        articulationType: type,
        measure: a.measureNumber,
        staff: a.staffIndex,
        bbox: { x: cx - (box.w * k) / 2, y: cy - (box.h * k) / 2, width: box.w * k, height: box.h * k },
      })
    }
  }
}
