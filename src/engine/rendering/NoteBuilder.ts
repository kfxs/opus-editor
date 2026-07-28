import { StaveNote, Voice, Accidental, Articulation, Modifier, Dot, Tuplet as VexFlowTuplet } from 'vexflow'
import { CenteredTremolo } from './CenteredTremolo'
import { reserveDotRoom } from './dotPlacement'
import type { Measure, NoteDuration, Clef, ArticulationType, Chord, ChordRest, Fraction } from '@/types/music'
import { fracCompare, fracLte } from '@/utils/fraction'
import { middleLineDiatonicPos } from '@/utils/clefUtils'
import { doubleDuration, durationToVexflow, slotLength } from '@/utils/durations'
import { pairRoleAt } from '@/utils/tremoloPair'
import { pickVoiceMode } from '@/utils/restFill'
import { displayedAccidentals } from '@/utils/accidentalState'
import { spellingToMidi, spellingToVexflowKey, spellingDiatonicPos } from '@/utils/pitchSpelling'

/**
 * Note/measure building helpers shared by the renderer and the measure-width math.
 *
 * These are (near-)pure functions over a measure's slots — they build VexFlow
 * StaveNotes/Tuplets and resolve clef/voice-mode/time-signature decisions, but hold
 * no renderer state and write none of the per-render lookup maps. They are the
 * multi-voice-critical seam: both `renderMeasure` (draw side) and
 * `calculateMinimumMeasureWidth` (width side) call them, and the future per-voice
 * render loop will call them once per voice group.
 */

/**
 * Articulation render order — from note outward (first = closest to note head).
 * Staccato always hugs the note, tenuto sits next, accent is outermost.
 * This applies whether the group is above or below the staff.
 * To change the order in the future, edit this array.
 */
export const ARTICULATION_RENDER_ORDER: ArticulationType[] = ['staccato', 'tenuto', 'accent']

export function convertDuration(duration: NoteDuration, dots: number = 0): string {
  return durationToVexflow(duration, dots)
}

/**
 * Map the pure {@link pickVoiceMode} policy onto VexFlow's Voice.Mode enum.
 * `capacity` is the measure's actual playable length (override or nominal), so
 * a pickup bar is judged against its true length.
 */
export function chooseVoiceMode(slots: ChordRest[], capacity: Fraction): number {
  return pickVoiceMode(slots, capacity) === 'soft' ? Voice.Mode.SOFT : Voice.Mode.FULL
}

/**
 * Whether a time-signature glyph is drawn at the start of this measure:
 * measure 1 always, plus any measure that begins an explicit TS change
 * (engraving standard) — UNLESS the glyph has been explicitly hidden
 * (`timeSignatureHidden`, e.g. the deleted default on measure 1; the meter
 * still applies, only the glyph is suppressed). Drives the drawing, its width
 * reservation, AND the clickable registry element.
 */
export function drawsTimeSignature(measure: Measure): boolean {
  if (measure.timeSignatureHidden === true) return false
  return measure.number === 1 || measure.timeSignatureChange === true
}

/**
 * Build a resolver for the clef in effect at any beat within a measure.
 * Starts from the measure's opening clef and applies each clef change whose
 * beat is at/before the queried beat.
 */
export function makeClefResolver(measure: Measure, openingClef: Clef): (beat: Fraction) => Clef {
  const changes = (measure.clefs ?? []).slice().sort((a, b) => fracCompare(a.beat, b.beat))
  return (beat: Fraction): Clef => {
    let current = openingClef
    for (const ch of changes) {
      if (fracLte(ch.beat, beat)) current = ch.clef
      else break
    }
    return current
  }
}

/**
 * The SINGLE supporting ledger line for a rest forced off the staff, or `null` if none is
 * needed. Only WHOLE and HALF rests (incl. dotted, and whole-measure rests) are
 * **line-attached** — a whole rest *hangs from* a line, a half rest *sits on* one — so when a
 * manual shift pushes them outside the staff they get **one** supporting ledger at their key
 * line, the line they attach to. This is unlike a notehead (which gets the full stack of
 * ledgers out to its position) and unlike shorter rests (quarter/eighth/… are not
 * line-attached, so they get none). Staff lines are 1–5 in VexFlow's line system, so a rest
 * is off the staff when its line is ≥ 6 (above) or ≤ 0 (below). See docs/rest-shift-plan.md
 * §10 (convention: Wikipedia "Ledger line" — half/whole rest support in multi-voice). Pure &
 * VexFlow-free for isolated testing.
 */
export function restSupportingLedgerLine(
  duration: NoteDuration,
  isMeasureRest: boolean,
  restLine: number,
): number | null {
  const lineAttached = isMeasureRest || duration === 'w' || duration === 'h'
  if (!lineAttached) return null
  return restLine >= 6 || restLine <= 0 ? restLine : null
}

/**
 * Create StaveNotes directly from ChordRest slots.
 * One slot → one StaveNote. Rests → rest StaveNote; Chords → multi-key StaveNote.
 * @param slots - Slots already sorted by beat position
 * @param clefForBeat - Resolves the clef in effect at a given beat (for note
 *   positioning and stem direction). A single Clef is accepted for convenience.
 * @param forcedStemDirection - Multi-voice default stem (1 = up, -1 = down) applied
 *   to every chord that has no explicit `stemDirection` override. Used to engrave
 *   V1 up / V2 down; omit (undefined) for the single-voice pitch-based default.
 * @param restLineShift - Vertical line offset for rests (multi-voice rest separation:
 *   +up for V1, -down for V2). 0 = centred (single-voice, unchanged). A resolver
 *   `(slot) => number` is accepted so the caller can add a per-rest manual shift on top of
 *   the voice base (see docs/rest-shift-plan.md §6.8) — mirroring the `clefForBeat` overload.
 */
export function createStaveNotesFromSlots(
  slots: ChordRest[],
  clefForBeat: ((beat: Fraction) => Clef) | Clef = 'treble',
  forcedStemDirection?: number,
  restLineShift: number | ((slot: ChordRest) => number) = 0,
): StaveNote[] {
  const resolveClef: (beat: Fraction) => Clef =
    typeof clefForBeat === 'function' ? clefForBeat : () => clefForBeat
  const resolveRestShift: (slot: ChordRest) => number =
    typeof restLineShift === 'function' ? restLineShift : () => restLineShift
  const staveNotes: StaveNote[] = []

  // Which sign each pitch of this lane displays, decided ONCE by the forward walk in
  // utils/accidentalState (`displayedAccidentals`) — the same rule `prevailingAlterations` states
  // as a query, and the same map the FAN renderer reads for its hand-drawn member heads. It lived
  // inline here until the members needed it; the extraction is what keeps the two from drifting
  // (docs/fanned-beam-pitches-plan.md §2).
  const displayAccidentals = displayedAccidentals(slots)

  for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
    const slot = slots[slotIndex]
    if (slot.type === 'rest') {
      // Voice base (multi-voice separation) + any per-rest manual shift, resolved per slot.
      const shift = resolveRestShift(slot)
      if (slot.isMeasureRest) {
        // Whole-bar (measure) rest: a centred whole rest, drawn the same way at
        // any bar length. Its voice runs in SOFT mode (see chooseVoiceMode) so
        // the whole rest's fixed tick value never clashes with the bar capacity.
        const measureRest = new StaveNote({ keys: ['b/4'], duration: 'wr', alignCenter: true })
        if (shift) measureRest.setKeyLine(0, measureRest.getLineForRest() + shift)
        staveNotes.push(measureRest)
        continue
      }
      const vexDuration = convertDuration(slot.duration, slot.dots || 0)
      // Rests are positioned at fixed staff positions independent of clef.
      // The 'b/4' key anchors the rest to the middle line under the default
      // (treble) clef — passing a clef would shift it (e.g. high in bass clef).
      const staveNote = new StaveNote({ keys: ['b/4'], duration: vexDuration + 'r' })
      for (let d = 0; d < (slot.dots || 0); d++) {
        Dot.buildAndAttach([staveNote], { all: true })
      }
      // Multi-voice: lift V1 rests / drop V2 rests so the two streams don't collide.
      if (shift) staveNote.setKeyLine(0, staveNote.getLineForRest() + shift)
      staveNotes.push(staveNote)
      continue
    }

    // Sort pitches low→high by MIDI value (VexFlow requires ascending key order for chords)
    const sortedPitches = [...slot.notes].sort(
      (a, b) => spellingToMidi(a.step, a.alter, a.octave) - spellingToMidi(b.step, b.alter, b.octave)
    )
    // Build VexFlow key strings directly from spelling — no MIDI lookup table needed
    const keys = sortedPitches.map(p => spellingToVexflowKey(p.step, p.alter, p.octave))

    // Clef in effect at this slot's beat (mid-measure changes move notes).
    const slotClef = resolveClef(slot.beat)

    /**
     * ⭐ TWO-NOTE TREMOLO — is this slot in a pair, and if so which end?
     *
     * `slots` is ONE LANE here (both callers filter by voice before calling), which is exactly what
     * {@link pairRoleAt} needs. Two things follow from a non-null role, and BOTH belong in this
     * function rather than at the draw site: the width path builds its notes through here too
     * (`MeasureLayout.noteSpaceForLane`), so doubling on the draw side alone would leave the two
     * disagreeing about what is in the bar.
     */
    const pairRole = pairRoleAt(slots, slotIndex)
    const pairSlots: Chord[] = pairRole === 'first'
      ? [slot, slots[slotIndex + 1] as Chord]
      : pairRole === 'second' ? [slots[slotIndex - 1] as Chord, slot] : [slot]

    // Stem direction — compare diatonic staff position against clef's middle line.
    // BOTH stems of a pair point the same way, so the pair decides ONCE, over both slots' pitches
    // and honouring an explicit override on either end — the rule a beam group already follows.
    const explicitStem = pairSlots.find(s => s.stemDirection)?.stemDirection
    let stemDirection: number
    if (explicitStem === 'up') {
      stemDirection = 1
    } else if (explicitStem === 'down') {
      stemDirection = -1
    } else if (forcedStemDirection !== undefined) {
      // Multi-voice default (V1 up / V2 down); an explicit override above still wins.
      stemDirection = forcedStemDirection
    } else {
      const middleDiatonic = middleLineDiatonicPos(slotClef)
      let maxDist = 0
      stemDirection = -1  // default down; middle-line notes follow this convention
      // ⭐ A FAN's stem direction is the GROUP's, decided over every member's pitches — because the
      // members hang off ONE beam line and a beam has one side. Single voice only: with a
      // `forcedStemDirection` the lane has already answered (V1 up, V2 down) and the group follows
      // its voice, not its own pitches (docs/fanned-beam-pitches-plan.md §2).
      for (const p of pairSlots.flatMap(s => [...s.notes, ...(s.fan?.members ?? []).flatMap(m => m.pitches)])) {
        const dPos = spellingDiatonicPos(p.step, p.octave)
        const dist = Math.abs(dPos - middleDiatonic)
        if (dist > maxDist) {
          maxDist = dist
          stemDirection = dPos >= middleDiatonic ? -1 : 1
        }
      }
    }

    // A pair is WRITTEN at double its value — two quarters draw as two halves — because each note
    // carries the full value of the whole tremolo (docs/two-note-tremolo-plan.md §0). `pairIsValid`
    // has already refused the one duration with no double, so the `?? slot.duration` is only the
    // no-pair case.
    const drawnDuration = pairRole ? (doubleDuration(slot.duration) ?? slot.duration) : slot.duration

    /**
     * ⭐ A FANNED slot is written as ONE blanca and DRAWN as its members — filled heads under a
     * feathered beam (docs/fanned-beams-plan.md §0). So the note VexFlow builds here is a plain
     * QUARTER whatever the slot says: a filled head, a stem, and no flag to suppress, which is
     * exactly what a beamed member looks like. Drawing the written value instead would put one
     * hollow half-note head among five filled companions — a picture that contradicts its own beam.
     *
     * The same trick as the pair's doubling two lines up, and it belongs here for the same reason:
     * the WIDTH path builds its notes through this function too, so a substitution made only at the
     * draw site would leave the two disagreeing about what is in the bar.
     *
     * ⚠️ And no DOTS. The dot belongs to the written value; the members are not it. The length the
     * dot bought is not lost — it is in the tick multiplier below, and in the span the fan ramps
     * across.
     */
    const fanned = !!slot.fan
    const vexDuration = fanned
      ? convertDuration('q', 0)
      : convertDuration(drawnDuration, slot.dots || 0)
    const staveNote = new StaveNote({ keys, duration: vexDuration, clef: slotClef, autoStem: false })
    // ⚠️ TICKS. The StaveNote now carries TWICE the ticks its slot has, and a FULL-mode voice handed
    // twice the bar's ticks throws. `applyTickMultiplier(1, 2)` halves them back — the same call
    // VexFlow's own `Tuplet` makes (`setTuplet` → `applyTickMultiplier(notesOccupied, noteCount)`) —
    // so the formatter spaces the pair over its REAL length and `pickVoiceMode` still answers FULL.
    if (pairRole) staveNote.applyTickMultiplier(1, 2)
    // ⚠️ The same TICK correction the pair needs, the other way up: the note is drawn as a quarter
    // but OCCUPIES its written length, so the formatter must be told the real number or a FULL-mode
    // voice sees a half-empty bar. `applyTickMultiplier(a, b)` scales by a/b — VexFlow's own
    // `Tuplet` call — so the slot's length in quarters IS the multiplier.
    if (fanned) {
      const real = slotLength(slot)
      staveNote.applyTickMultiplier(real.num, real.den)
    }
    staveNote.setStemDirection(stemDirection)

    // Add accidental modifiers — VexFlow accepts '#', 'b', 'n', '##', 'bb'
    // ⚠️ Nothing here may depend on where the notes SIT on the staff — see
    // `ledgerAccidentalClearance`: this builder is the WIDTH path too, and a bar's width is
    // deliberately clef-independent (`MeasureLayout.clefWidthIndependence.test.ts`). Clearing a
    // ledger line is therefore a DRAW-time pass, not a wider accidental here.
    sortedPitches.forEach((p, idx) => {
      const acc = displayAccidentals.get(p.id) ?? null
      if (acc) staveNote.addModifier(new Accidental(acc), idx)
    })

    // Dots — none on a fanned slot; see the drawn-value note above.
    if (!fanned) {
      for (let d = 0; d < (slot.dots || 0); d++) {
        Dot.buildAndAttach([staveNote], { all: true })
      }
      // ⭐ …and each one buys the room to stand half a staff space off the notehead, which is
      // where a dot belongs (`dotPlacement`). Uniform per dot, never a function of where the note
      // sits, so a bar's width stays clef-independent — the invariant this path must not break.
      reserveDotRoom(staveNote)
    }

    // Articulations are per-chord (stored on slot, not per pitch).
    // Sorted by ARTICULATION_RENDER_ORDER so the first added sits closest to the note head.
    const articulationVexCodes: Record<ArticulationType, string> = { accent: 'a>', staccato: 'a.', tenuto: 'a-' }
    // Auto side:
    //  - Single voice: opposite the stem (the note-head side), the usual convention.
    //  - Multi-voice (forcedStemDirection set): the voice's OUTER side regardless of
    //    the individual note's stem — upper voice (V1, forced up) ABOVE, lower voice
    //    (V2, forced down) BELOW — so the two voices' marks never collide in the
    //    middle. This matches standard engraving (Gould). An explicit slot
    //    placement override (the `x` flip) still wins below.
    const autoArticulationPosition = forcedStemDirection !== undefined
      ? (forcedStemDirection === 1 ? Modifier.Position.ABOVE : Modifier.Position.BELOW)
      : (stemDirection === 1 ? Modifier.Position.BELOW : Modifier.Position.ABOVE)
    const articulationPosition = slot.articulationPlacement === 'above'
      ? Modifier.Position.ABOVE
      : slot.articulationPlacement === 'below'
        ? Modifier.Position.BELOW
        : autoArticulationPosition
    const sortedArticulations = (slot.articulations ?? []).slice().sort(
      (a, b) => ARTICULATION_RENDER_ORDER.indexOf(a) - ARTICULATION_RENDER_ORDER.indexOf(b)
    )
    for (const art of sortedArticulations) {
      staveNote.addModifier(new Articulation(articulationVexCodes[art]).setPosition(articulationPosition), 0)
    }

    // Single-note tremolo — per-chord like the articulations, and for the same reason (the mark
    // belongs to the event, not to a notehead).
    //
    // ⚠️ N copies of `tremolo1` (E220), never E221–E224: `CenteredTremolo(2)` IS the two-stroke
    // mark. The multi-stroke SMuFL glyphs exist for the palette's pictures only.
    //
    // {@link CenteredTremolo}, not VexFlow's `Tremolo`: that one anchors the stack to the stem TIP,
    // which leaves one or two strokes clinging to the top of the stem instead of riding its middle.
    // Ours centres them; everything else about the mark is still the library's.
    //
    // Neither lengthens the stem, so four and five strokes on a short stem crowd the notehead —
    // VexFlow has no opinion there and neither do we yet.
    //
    // The Penderecki sign goes through the SAME modifier: it is one glyph (E22B, which VexFlow does
    // not draw) in a stack of one, so it inherits the centring, both stem stretches, the ghost and
    // the bounding-box fix rather than being a second drawing path that must remember all four.
    //
    // ⚠️ NOT in a PAIR. A two-note tremolo's strokes moved off the stem and into the gap between the
    // two (docs/two-note-tremolo-plan.md §2) — drawing both would say two different things. That
    // covers the second slot too: it carries no `tremoloPair`, but a single-note mark left on it
    // from before is part of the same pair now and is not drawn twice.
    if (slot.tremolo && !pairRole) {
      staveNote.addModifier(new CenteredTremolo(slot.tremolo), 0)
    }

    staveNotes.push(staveNote)
  }

  return staveNotes
}

/**
 * Create VexFlow Tuplet objects for a measure (adjusts tick values on notes).
 * Must be called BEFORE voice.addTickables() for correct tick calculation.
 * @param measure - The measure containing tuplet definitions
 * @param slots - ChordRest slots sorted by beat (parallel to staveNotes)
 * @param staveNotes - The VexFlow StaveNotes array
 * @returns Map of tupletId to VexFlow Tuplet objects
 */
export function createTupletsForMeasure(
  measure: Measure,
  slots: ChordRest[],
  staveNotes: StaveNote[]
): Map<string, VexFlowTuplet> {
  const vexTuplets = new Map<string, VexFlowTuplet>()

  if (!measure.tuplets || measure.tuplets.length === 0) {
    return vexTuplets
  }

  // Build mapping from tupletId to StaveNotes (one slot → one StaveNote)
  const tupletStaveNoteMap = new Map<string, StaveNote[]>()

  for (let i = 0; i < slots.length && i < staveNotes.length; i++) {
    const slot = slots[i]
    if (slot.tupletId) {
      if (!tupletStaveNoteMap.has(slot.tupletId)) {
        tupletStaveNoteMap.set(slot.tupletId, [])
      }
      tupletStaveNoteMap.get(slot.tupletId)!.push(staveNotes[i])
    }
  }

  // Create VexFlow Tuplet objects
  for (const [tupletId, tupletStaveNotes] of tupletStaveNoteMap) {
    const tupletData = measure.tuplets.find(t => t.id === tupletId)
    if (tupletData && tupletStaveNotes.length >= 2) {
      try {
        const vexTuplet = new VexFlowTuplet(tupletStaveNotes, {
          numNotes: tupletData.numNotes,
          notesOccupied: tupletData.notesOccupied,
        })
        vexTuplets.set(tupletId, vexTuplet)
      } catch (_e) {
        // Ignore tuplet creation errors
      }
    }
  }

  return vexTuplets
}

/** VexFlow tuplet bracket side: above the staff. */
export const TUPLET_LOCATION_ABOVE = 1
/** VexFlow tuplet bracket side: below the staff. */
export const TUPLET_LOCATION_BELOW = -1

/**
 * Decide which side (above / below) a tuplet's bracket and number sit on.
 *
 * Precedence:
 *   1. An explicit `placement` override (e.g. set by the `x` flip) always wins.
 *   2. With multiple voices, the bracket follows the voice's stem side so the
 *      voices' brackets spread to the outer edges instead of colliding in the
 *      middle: stems-up voices (V1/V3, model 0/2) → above, stems-down voices
 *      (V2/V4, model 1/3) → below.
 *   3. With a single voice, fall back to the stem-derived default.
 *
 * @param placement - Explicit override, or undefined for auto
 * @param multiVoice - Whether the measure has more than one voice
 * @param voice - The tuplet's model voice (0 = primary)
 * @param singleVoiceFallback - Stem-derived location to use when single-voice
 * @returns TUPLET_LOCATION_ABOVE (1) or TUPLET_LOCATION_BELOW (-1)
 */
export function resolveTupletLocation(
  placement: 'above' | 'below' | undefined,
  multiVoice: boolean,
  voice: number,
  singleVoiceFallback: number
): number {
  if (placement === 'above') return TUPLET_LOCATION_ABOVE
  if (placement === 'below') return TUPLET_LOCATION_BELOW
  if (multiVoice) return voice % 2 === 0 ? TUPLET_LOCATION_ABOVE : TUPLET_LOCATION_BELOW
  return singleVoiceFallback
}

/**
 * The "outer" bracket side for a voice in a multi-voice measure: stems-up voices
 * (V1/V3, model 0/2) bracket outward above, stems-down voices (V2/V4, model 1/3)
 * outward below (mirrors the forced stem directions).
 */
export function outerTupletLocation(voice: number): number {
  return voice % 2 === 0 ? TUPLET_LOCATION_ABOVE : TUPLET_LOCATION_BELOW
}

/** Per-note stem geometry needed to place a tuplet bracket next to its own notes. */
export interface TupletNoteStem {
  /** True if the note's stem points up. */
  stemUp: boolean
  /** Y of the stem tip (top end). */
  topY: number
  /** Y of the stem base (notehead end). */
  baseY: number
}

/**
 * Vertical offset (in px, +down) to nudge a *flipped inner* multi-voice tuplet bracket
 * out of VexFlow's staff-edge clamp and place it adjacent to its own notes (in the gap
 * between the voices) instead of overshooting past the other voice.
 *
 * Why this exists: VexFlow's `getYPosition()` clamps an *above* bracket to ≥1.5 lines
 * above the TOP staff line and a *below* bracket to ≥2 lines below the BOTTOM staff line.
 * That is right for an OUTER bracket, but when the user flips a bracket to the INNER side
 * (a lower voice placed above, or voice 0 placed below) the clamp shoves it to the far
 * edge of the system — above the upper voice / below the lower voice — which reads wrong
 * and can perfectly overlap the other voice's outer bracket.
 *
 * We recompute the bracket Y from the tuplet's OWN notes using the same per-note term
 * VexFlow uses, but WITHOUT the staff-line ceiling/floor, then return the delta from the
 * clamped Y. Returns 0 when this isn't a flipped inner bracket, or when the correction
 * would push the bracket further toward the edge rather than inward (never make it worse).
 *
 * @param notes - Per-note stem geometry for the tuplet's notes
 * @param location - Resolved bracket side (1 = above, -1 = below)
 * @param voice - The tuplet's model voice (0 = primary)
 * @param multiVoice - Whether the measure has more than one voice
 * @param clampedY - VexFlow's `getYPosition()` result (with yOffset 0)
 * @param lineDistance - Staff line spacing in px (VexFlow STAVE_LINE_DISTANCE = 10)
 */
export function innerFlipTupletYOffset(
  notes: TupletNoteStem[],
  location: number,
  voice: number,
  multiVoice: boolean,
  clampedY: number,
  lineDistance = 10
): number {
  if (!multiVoice || notes.length === 0) return 0
  // Only correct a bracket flipped to the INNER side (toward the other voice).
  const isInner = location !== outerTupletLocation(voice)
  if (!isInner) return 0

  let desiredY: number
  if (location === TUPLET_LOCATION_ABOVE) {
    // Highest point just past the notes, mirroring VexFlow's per-note term minus ceiling.
    desiredY = Math.min(
      ...notes.map(n => (n.stemUp ? n.topY - lineDistance : n.baseY - 2 * lineDistance))
    )
    // Only nudge DOWNWARD (inward); never push further above the system.
    return Math.max(0, desiredY - clampedY)
  } else {
    desiredY = Math.max(
      ...notes.map(n => (n.stemUp ? n.baseY + 2 * lineDistance : n.topY + lineDistance))
    )
    // Only nudge UPWARD (inward); never push further below the system.
    return Math.min(0, desiredY - clampedY)
  }
}
