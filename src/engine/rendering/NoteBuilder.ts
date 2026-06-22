import { StaveNote, Voice, Accidental, Articulation, Modifier, Dot, Tuplet as VexFlowTuplet } from 'vexflow'
import type { Measure, NoteDuration, Clef, ArticulationType, ChordRest, Fraction, PitchAlter } from '@/types/music'
import { fracCompare, fracLte } from '@/utils/fraction'
import { middleLineDiatonicPos } from '@/utils/clefUtils'
import { durationToVexflow } from '@/utils/durations'
import { pickVoiceMode } from '@/utils/restFill'
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
 * Create StaveNotes directly from ChordRest slots.
 * One slot → one StaveNote. Rests → rest StaveNote; Chords → multi-key StaveNote.
 * @param slots - Slots already sorted by beat position
 * @param clefForBeat - Resolves the clef in effect at a given beat (for note
 *   positioning and stem direction). A single Clef is accepted for convenience.
 * @param forcedStemDirection - Multi-voice default stem (1 = up, -1 = down) applied
 *   to every chord that has no explicit `stemDirection` override. Used to engrave
 *   V1 up / V2 down; omit (undefined) for the single-voice pitch-based default.
 * @param restLineShift - Vertical line offset for rests (multi-voice rest separation:
 *   +up for V1, -down for V2). 0 = centred (single-voice, unchanged).
 */
export function createStaveNotesFromSlots(
  slots: ChordRest[],
  clefForBeat: ((beat: Fraction) => Clef) | Clef = 'treble',
  forcedStemDirection?: number,
  restLineShift: number = 0,
): StaveNote[] {
  const resolveClef: (beat: Fraction) => Clef =
    typeof clefForBeat === 'function' ? clefForBeat : () => clefForBeat
  const staveNotes: StaveNote[] = []

  // Track the currently active alteration per diatonic staff position within this measure.
  // Key = spellingDiatonicPos(step, octave). Value = active PitchAlter (0 = natural).
  // A position absent from the map has not yet appeared in this measure.
  const activeMeasureAlterations = new Map<number, PitchAlter>()

  for (const slot of slots) {
    if (slot.type === 'rest') {
      if (slot.isMeasureRest) {
        // Whole-bar (measure) rest: a centred whole rest, drawn the same way at
        // any bar length. Its voice runs in SOFT mode (see chooseVoiceMode) so
        // the whole rest's fixed tick value never clashes with the bar capacity.
        const measureRest = new StaveNote({ keys: ['b/4'], duration: 'wr', alignCenter: true })
        if (restLineShift) measureRest.setKeyLine(0, measureRest.getLineForRest() + restLineShift)
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
      if (restLineShift) staveNote.setKeyLine(0, staveNote.getLineForRest() + restLineShift)
      staveNotes.push(staveNote)
      continue
    }

    // Chord slot — decide which accidental sign (if any) to display for each pitch.
    // displayAccidentals: noteId → VexFlow accidental string, or null if suppressed.
    const displayAccidentals = new Map<string, string | null>()
    for (const p of slot.notes) {
      if (p.tiedFrom) {
        // Tied continuation: never re-show the accidental
        displayAccidentals.set(p.id, null)
        continue
      }
      const dPos = spellingDiatonicPos(p.step, p.octave)
      const activeAlter = activeMeasureAlterations.get(dPos)  // undefined = not seen yet

      if (p.alter !== 0) {
        // Non-natural pitch — show sign unless the same alteration is already active
        if (!p.forceAccidental && activeAlter === p.alter) {
          displayAccidentals.set(p.id, null)  // suppress: redundant
        } else {
          const sign = p.alter === 2 ? '##' : p.alter === 1 ? '#' : p.alter === -1 ? 'b' : 'bb'
          displayAccidentals.set(p.id, sign)
          activeMeasureAlterations.set(dPos, p.alter)
        }
      } else {
        // Natural pitch (alter === 0)
        if (activeAlter !== undefined && activeAlter !== 0) {
          // A previous note on this staff position was altered — show ♮ to cancel it
          displayAccidentals.set(p.id, 'n')
          activeMeasureAlterations.set(dPos, 0)
        } else if (p.forceAccidental) {
          // Caller explicitly wants a courtesy natural sign
          displayAccidentals.set(p.id, 'n')
          activeMeasureAlterations.set(dPos, 0)
        } else {
          displayAccidentals.set(p.id, null)  // no sign needed
        }
      }
    }

    // Sort pitches low→high by MIDI value (VexFlow requires ascending key order for chords)
    const sortedPitches = [...slot.notes].sort(
      (a, b) => spellingToMidi(a.step, a.alter, a.octave) - spellingToMidi(b.step, b.alter, b.octave)
    )
    // Build VexFlow key strings directly from spelling — no MIDI lookup table needed
    const keys = sortedPitches.map(p => spellingToVexflowKey(p.step, p.alter, p.octave))

    // Clef in effect at this slot's beat (mid-measure changes move notes).
    const slotClef = resolveClef(slot.beat)

    // Stem direction — compare diatonic staff position against clef's middle line
    let stemDirection: number
    if (slot.stemDirection === 'up') {
      stemDirection = 1
    } else if (slot.stemDirection === 'down') {
      stemDirection = -1
    } else if (forcedStemDirection !== undefined) {
      // Multi-voice default (V1 up / V2 down); an explicit override above still wins.
      stemDirection = forcedStemDirection
    } else {
      const middleDiatonic = middleLineDiatonicPos(slotClef)
      let maxDist = 0
      stemDirection = -1  // default down; middle-line notes follow this convention
      for (const p of slot.notes) {
        const dPos = spellingDiatonicPos(p.step, p.octave)
        const dist = Math.abs(dPos - middleDiatonic)
        if (dist > maxDist) {
          maxDist = dist
          stemDirection = dPos >= middleDiatonic ? -1 : 1
        }
      }
    }

    const vexDuration = convertDuration(slot.duration, slot.dots || 0)
    const staveNote = new StaveNote({ keys, duration: vexDuration, clef: slotClef, autoStem: false })
    staveNote.setStemDirection(stemDirection)

    // Add accidental modifiers — VexFlow accepts '#', 'b', 'n', '##', 'bb'
    sortedPitches.forEach((p, idx) => {
      const acc = displayAccidentals.get(p.id) ?? null
      if (acc) staveNote.addModifier(new Accidental(acc), idx)
    })

    // Dots
    for (let d = 0; d < (slot.dots || 0); d++) {
      Dot.buildAndAttach([staveNote], { all: true })
    }

    // Articulations are per-chord (stored on slot, not per pitch).
    // Sorted by ARTICULATION_RENDER_ORDER so the first added sits closest to the note head.
    const articulationVexCodes: Record<ArticulationType, string> = { accent: 'a>', staccato: 'a.', tenuto: 'a-' }
    // Auto side = opposite the stem (notehead side); an explicit slot override flips it.
    const autoArticulationPosition = stemDirection === 1 ? Modifier.Position.BELOW : Modifier.Position.ABOVE
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
      } catch (e) {
        // Ignore tuplet creation errors
      }
    }
  }

  return vexTuplets
}
