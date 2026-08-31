import { describe, it, expect } from 'vitest'
import { restDrawnDuration, restLineForVoice, restLineInStaff, restNeutralLine, restVoiceContext } from './restVoicePlacement'
import { restStaffLine } from './restPlacement'
import { fracCreate } from '@/utils/fraction'
import type { Chord, ChordRest, Fraction, NoteDuration, NotePitch, PitchStep } from '@/types/music'

/**
 * Where a rest sits when its staff carries two voices.
 *
 * ⭐ **Every assertion here is a LINE NUMBER**, which is what lets the whole rule be tested in jsdom
 * at all (`reference_jsdom_cannot_measure_glyphs` — a drawn position measures 0×0 here and agrees
 * with itself). The ONE geometry claim this feature makes — *the drawn rest is above the drawn
 * notehead* — is P2's browser case and ⛔ does not belong in this file.
 *
 * ⚠️ The numbers are asserted as RELATIONS and DIRECTIONS wherever a relation is what the source
 * says. Gould gives ±1 stave-space and an outer staff line; she does not give a clearance constant,
 * and `GAP` is labelled an engine constant precisely because no book states one. So the clearance
 * cases assert *"clear of the other part, and outward"*, ⛔ never a magic total.
 */

const SHORT: NoteDuration[] = ['q', '8', '16', '32']
const ALL: NoteDuration[] = ['w', 'h', 'q', '8', '16', '32']

let nextId = 0
function chord(
  voice: 0 | 1 | 2 | 3,
  beat: Fraction,
  duration: NoteDuration,
  pitches: [PitchStep, number][],
  extra: Partial<Chord> = {},
): Chord {
  const notes: NotePitch[] = pitches.map(([step, octave]) => ({
    id: `p${nextId++}`, step, alter: 0, octave,
  }))
  return { id: `c${nextId++}`, type: 'chord', beat, duration, measure: 1, voice, notes, ...extra }
}

const b = (n: number, d = 1): Fraction => fracCreate(n, d)

describe('the neutral line, on this module’s axis', () => {
  it('is `restStaffLine` and nothing else — the ONE conversion, for all six durations', () => {
    // ⚠️ Two axes are in play and this is the only place they meet: `restPlacement` counts spaces
    //    BELOW the top line, we count VexFlow lines UP from the bottom. A whole rest hangs from the
    //    fourth line (line 4) and everything else is anchored to the middle (line 3).
    expect(restNeutralLine('w')).toBe(4)
    for (const d of ['h', ...SHORT] as NoteDuration[]) expect(restNeutralLine(d)).toBe(3)
    for (const d of ALL) expect(restNeutralLine(d)).toBe(5 - restStaffLine(d))
  })
})

describe('two voices, nothing else in the bar', () => {
  it('⭐ the SHORT rests move exactly ONE space, up for the upper voice and down for the lower', () => {
    // Gould p. 36, measured on the figure that engraves the same music displaced and neutral:
    // ±1 stave-space. MuseScore's `computeVoiceOffset` is the same ±1 space. LilyPond's ±2 is the
    // outlier, and reversing this is one number in `base`.
    for (const duration of SHORT) {
      const neutral = restNeutralLine(duration)
      expect(restLineForVoice({ duration, dir: 1, own: [], others: [] }), `upper ${duration}`)
        .toBe(neutral + 1)
      expect(restLineForVoice({ duration, dir: -1, own: [], others: [] }), `lower ${duration}`)
        .toBe(neutral - 1)
    }
  })

  it('⭐⭐ a WHOLE or HALF rest attaches to the OUTER staff line on its own side', () => {
    // The empty voice-2 bar — the commonest multi-voice rest there is, and the case a `neutral ± 1`
    // base gets wrong: it would put a lower voice's whole rest ON the middle line.
    // Ross p. 173-174, Gerou & Lusk p. 114 and Stone p. 135, all three measured on their own
    // plates: upper whole +1 sp, lower whole −3 sp; upper half +2 sp, lower half −2 sp.
    expect(restLineForVoice({ duration: 'w', dir: 1, own: [], others: [] })).toBe(5)
    expect(restLineForVoice({ duration: 'w', dir: -1, own: [], others: [] })).toBe(1)
    expect(restLineForVoice({ duration: 'h', dir: 1, own: [], others: [] })).toBe(5)
    expect(restLineForVoice({ duration: 'h', dir: -1, own: [], others: [] })).toBe(1)

    expect(restLineForVoice({ duration: 'w', dir: 1, own: [], others: [] }) - restNeutralLine('w')).toBe(1)
    expect(restLineForVoice({ duration: 'w', dir: -1, own: [], others: [] }) - restNeutralLine('w')).toBe(-3)
    expect(restLineForVoice({ duration: 'h', dir: 1, own: [], others: [] }) - restNeutralLine('h')).toBe(2)
    expect(restLineForVoice({ duration: 'h', dir: -1, own: [], others: [] }) - restNeutralLine('h')).toBe(-2)
  })

  it('⛔ NEVER the middle line, either duration, either direction', () => {
    // Gould p. 36: "Semibreve and minim rests must never stray across the centre stave-line" —
    // and sitting ON it is straying onto it.
    for (const duration of ['w', 'h'] as NoteDuration[]) {
      for (const own of [[], [3], [6, 7], [-1]]) {
        for (const others of [[], [3], [6], [-2]]) {
          for (const dir of [1, -1] as (1 | -1)[]) {
            const line = restLineForVoice({ duration, dir, own, others })
            expect(line, `${duration} dir=${dir} own=${own} others=${others}`).not.toBe(3)
            expect(Math.sign(line - 3), `${duration} stays on its own side`).toBe(dir)
          }
        }
      }
    }
  })
})

describe('the rest tracks its own voice, and clears the other one', () => {
  it('⭐ `ownLevel`: a short rest follows its own voice’s pitches upward', () => {
    // Gould p. 37: "The space in which a rest centres … should be on the same level as surrounding
    // pitches." Verovio's same-layer mean is the same term. High own notes ⇒ a higher rest.
    const low = restLineForVoice({ duration: '16', dir: 1, own: [4], others: [] })
    const high = restLineForVoice({ duration: '16', dir: 1, own: [8], others: [] })
    expect(high).toBeGreaterThan(low)
  })

  it('⛔ `ownLevel` may not pull a rest BACK toward the middle — `base` is the floor', () => {
    // An upper voice sitting below the staff must not drag its rest down past the base displacement.
    for (const duration of SHORT) {
      const neutral = restNeutralLine(duration)
      expect(restLineForVoice({ duration, dir: 1, own: [-3, -2], others: [] }), `upper ${duration}`)
        .toBe(neutral + 1)
      expect(restLineForVoice({ duration, dir: -1, own: [8, 9], others: [] }), `lower ${duration}`)
        .toBe(neutral - 1)
    }
  })

  it('⭐⭐ `clearance`: an UPPER voice’s rest ends up ABOVE every note of the other voice', () => {
    // 🚨 The check that catches the clearance written backwards: on this axis the upper voice's
    //    rest line must be LARGER than every number in `others`. Half the wrong version looks right.
    for (const duration of SHORT) {
      for (const top of [2, 4, 6, 9]) {
        const line = restLineForVoice({ duration, dir: 1, own: [], others: [top - 2, top] })
        expect(line, `upper ${duration} over a note on line ${top}`).toBeGreaterThan(top)
      }
    }
  })

  it('⭐⭐ `clearance`: a LOWER voice’s rest ends up BELOW every note of the other voice', () => {
    for (const duration of SHORT) {
      for (const bottom of [-3, 0, 2, 4]) {
        const line = restLineForVoice({ duration, dir: -1, own: [], others: [bottom, bottom + 2] })
        expect(line, `lower ${duration} under a note on line ${bottom}`).toBeLessThan(bottom)
      }
    }
  })

  it('the clearance is the OTHER voice’s extreme, not its mean', () => {
    // One high note in the other part displaces the rest exactly as far as a staff full of them.
    const oneHigh = restLineForVoice({ duration: '16', dir: 1, own: [], others: [1, 1, 8] })
    const allHigh = restLineForVoice({ duration: '16', dir: 1, own: [], others: [8, 8, 8] })
    expect(oneHigh).toBe(allHigh)
  })

  it('⭐ a `w`/`h` rest is pushed FURTHER out by clearance, and never back in', () => {
    // §3.1: the fixed outer line is `base`, so the max/min can only move it outward.
    const upperClear = restLineForVoice({ duration: 'w', dir: 1, own: [], others: [7] })
    expect(upperClear).toBeGreaterThan(7)
    const upperQuiet = restLineForVoice({ duration: 'w', dir: 1, own: [], others: [-2] })
    expect(upperQuiet).toBe(5)
    const lowerQuiet = restLineForVoice({ duration: 'h', dir: -1, own: [], others: [8] })
    expect(lowerQuiet).toBe(1)
  })

  it('⛔ `ownLevel` does not move a `w`/`h` rest at all', () => {
    // "Many editions place all minim and semibreve rests on only the outside stave-lines, to avoid
    // confusion" (Gould p. 37) — a fixed line that tracked its own voice would not be fixed.
    for (const duration of ['w', 'h'] as NoteDuration[]) {
      for (const own of [[], [-2], [3], [9, 10]]) {
        expect(restLineForVoice({ duration, dir: 1, own, others: [] }), `${duration} own=${own}`).toBe(5)
        expect(restLineForVoice({ duration, dir: -1, own, others: [] }), `${duration} own=${own}`).toBe(1)
      }
    }
  })
})

describe('the result is quantised', () => {
  it('⭐ always a WHOLE number of staff spaces from the neutral position', () => {
    // Gould p. 35: "From the centre of the stave, rests move an exact number of stave-spaces up or
    // down", printed with a `not` counter-example.
    for (const duration of ALL) {
      for (const own of [[], [3.5], [6, 7.5], [-1.5]]) {
        for (const others of [[], [2.5], [5.5, 6], [-2.5]]) {
          for (const dir of [1, -1] as (1 | -1)[]) {
            const displacement = restLineForVoice({ duration, dir, own, others }) - restNeutralLine(duration)
            expect(Number.isInteger(displacement), `${duration} dir=${dir} → ${displacement}`).toBe(true)
          }
        }
      }
    }
  })

  it('rounds OUTWARD — a fractional clearance is never rounded back toward the middle', () => {
    for (const duration of SHORT) {
      for (const other of [3.5, 4, 4.5, 5]) {
        const line = restLineForVoice({ duration, dir: 1, own: [], others: [other] })
        expect(line, `upper ${duration} over ${other}`).toBeGreaterThan(other)
      }
    }
  })
})

describe('the context comes from the staff’s own lane', () => {
  it('⭐⭐ counts what SOUNDS, not what STARTS — a held note under a later rest', () => {
    // The prelude's whole problem, and the one thing VexFlow structurally cannot see: its
    // ModifierContext is keyed on the start tick. LilyPond: "Include notes that started any time".
    const held = chord(1, b(0), 'h', [['C', 4]])
    const slots: ChordRest[] = [held]
    // A 16th rest in voice 0, one quarter into the bar — the held note started before it.
    const ctx = restVoiceContext(slots, 0, b(1), b(1, 4), 'bass')
    expect(ctx.dir).toBe(1)
    expect(ctx.others).toEqual([6]) // C4 in bass clef: a ledger line above the staff
    expect(ctx.own).toEqual([])
  })

  it('a note that has STOPPED before the rest begins does not count', () => {
    const early = chord(1, b(0), 'q', [['C', 4]])
    const ctx = restVoiceContext([early], 0, b(1), b(1, 4), 'bass')
    expect(ctx.others).toEqual([])
  })

  it('a note that begins exactly where the rest ends does not count', () => {
    const later = chord(1, b(1, 4), 'q', [['C', 4]])
    const ctx = restVoiceContext([later], 0, b(0), b(1, 4), 'bass')
    expect(ctx.others).toEqual([])
  })

  it('⚠️ the other slot’s span is `slotLength` — a TUPLET member sounds less than it is written', () => {
    // A written quarter inside a triplet sounds 2/3 of one. Read as `writtenLength` it would still
    // be sounding at beat 2/3 and would displace a rest that nothing is under.
    const triplet = chord(1, b(0), 'q', [['C', 4]], {
      tupletId: 't1', actualDuration: fracCreate(2, 3),
    })
    expect(restVoiceContext([triplet], 0, b(2, 3), b(1, 4), 'bass').others).toEqual([])
    expect(restVoiceContext([triplet], 0, b(1, 3), b(1, 4), 'bass').others).toEqual([6])
  })

  it('⚠️ and a MEASURE rest’s partner: a whole note written `w` sounding a 5/4 bar', () => {
    // The mirror of the tuplet: `actualDuration` longer than written. Read as `writtenLength` the
    // note would stop sounding a beat early.
    const stretched = chord(1, b(0), 'w', [['C', 4]], { actualDuration: fracCreate(5, 1) })
    expect(restVoiceContext([stretched], 0, b(9, 2), b(1, 2), 'bass').others).toEqual([6])
  })

  it('`own` is the bar’s notes in this voice, including ones AFTER the rest', () => {
    // §8: a rest at the start of a bar has no preceding note in it. The bar's own notes carry it.
    const after = chord(0, b(1, 4), '8', [['E', 4]])
    const ctx = restVoiceContext([after], 0, b(0), b(1, 4), 'bass')
    expect(ctx.own).toEqual([7]) // E4 in bass clef
    expect(ctx.others).toEqual([])
  })

  it('rests in the other voice are not `others` — only notes displace a rest', () => {
    const otherRest: ChordRest = {
      id: 'r1', type: 'rest', beat: b(0), duration: 'h', measure: 1, voice: 1,
    }
    expect(restVoiceContext([otherRest], 0, b(0), b(1, 4), 'bass').others).toEqual([])
  })

  it('⚠️ `dir` is voice PARITY — V1/V3 both go up, V2/V4 both go down', () => {
    // Matching the stem directions the renderer already forces. ⭐ `dir` is the SIDE and nothing
    // more: what puts V3 outside V1 is the `inner` candidate, tested in its own describe below.
    expect(restVoiceContext([], 0, b(0), b(1), 'treble').dir).toBe(1)
    expect(restVoiceContext([], 2, b(0), b(1), 'treble').dir).toBe(1)
    expect(restVoiceContext([], 1, b(0), b(1), 'treble').dir).toBe(-1)
    expect(restVoiceContext([], 3, b(0), b(1), 'treble').dir).toBe(-1)
  })
})

/**
 * ⭐⭐ HIS LANE ORDER — **V3 / V1 / V2 / V4, top to bottom** (`docs/multi-voice-plan.md` §13, *"the
 * values the user picked"*, 2026-07-23; reaffirmed 2026-08-31 when the derived rule first dropped
 * it). ⛔ Three and four voices are UNKNOWN in every source, so this is a TASTE CALL and it is his —
 * which is exactly why it needs a spec: nothing else in the module would catch its loss.
 */
describe('the lane order — V3 outside V1, V4 outside V2', () => {
  const rest = (voice: 0 | 1 | 2 | 3, beat: Fraction, duration: NoteDuration): ChordRest =>
    ({ id: `r${nextId++}`, type: 'rest', beat, duration, measure: 1, voice })

  it('⭐⭐ V3’s rest sits ABOVE V1’s, and V4’s BELOW V2’s', () => {
    const slots = [rest(0, b(0), 'q'), rest(2, b(0), 'q'), rest(1, b(0), 'q'), rest(3, b(0), 'q')]
    const line = (v: 0 | 1 | 2 | 3) => restLineInStaff(slots, slots.find(s => s.voice === v)!, 'treble')
    expect(line(2)).toBeGreaterThan(line(0)) // V3 above V1
    expect(line(0)).toBeGreaterThan(line(1)) // V1 above V2 (opposite sides of the middle)
    expect(line(1)).toBeGreaterThan(line(3)) // V2 above V4
  })

  it('⭐ the gap between two lanes is their INK, not a constant — 16ths need more room than wholes', () => {
    // ⛔ The old ladder's flat `REST_LINE_STEP = 3` was one number for every duration, and it was
    // the unsourced magnitude this whole rule replaced. Reinstating it as a lane gap would be
    // reinstating the measured mistake; the ORDER survives, the MAGNITUDE does not.
    const shorts = [rest(0, b(0), '16'), rest(2, b(0), '16')]
    const wholes = [rest(0, b(0), 'w'), rest(2, b(0), 'w')]
    const spread = (slots: ChordRest[]) =>
      restLineInStaff(slots, slots[1], 'treble') - restLineInStaff(slots, slots[0], 'treble')
    expect(spread(shorts)).toBeGreaterThan(spread(wholes))
    expect(spread(wholes)).toBeGreaterThanOrEqual(1)
  })

  it('⚠️ it binds only where the order is VISIBLE — an inner voice with a NOTE pushes nothing', () => {
    // A note in V1 is already handled by `clearance`; the lane candidate exists to keep two RESTS
    // from being read as one. ⛔ A lane that separated a rest from silence would be the old fixed
    // ladder again, under a new name.
    // V3 facing a NOTE in V1 lands exactly where V1 would facing that same note in V2 — the lane
    // candidate never fires, `clearance` does all of it.
    const asV3 = [chord(0, b(0), 'q', [['B', 4]]), rest(2, b(0), 'q')]
    const asV1 = [chord(1, b(0), 'q', [['B', 4]]), rest(0, b(0), 'q')]
    expect(restLineInStaff(asV3, asV3[1], 'treble'))
      .toBe(restLineInStaff(asV1, asV1[1], 'treble'))

    // Swap that note for a REST and the lane candidate does fire — further out than the note was.
    const withRest = [rest(0, b(0), 'q'), rest(2, b(0), 'q')]
    expect(restLineInStaff(withRest, withRest[1], 'treble'))
      .toBeGreaterThan(restLineInStaff(asV3, asV3[1], 'treble'))
  })

  it('⚠️ the inner rest must be SOUNDING — one in the next beat does not push', () => {
    const later = [rest(0, b(1), 'q'), rest(2, b(0), 'q')]
    const alone = [rest(2, b(0), 'q')]
    expect(restLineInStaff(later, later[1], 'treble'))
      .toBe(restLineInStaff(alone, alone[0], 'treble'))
  })

  it('⭐ it holds even when content displaces the inner voice — the order is not a base offset', () => {
    // V1's rest is pushed high by a low V2 note; V3's must still clear it. A per-voice base
    // constant would fail here, which is why the candidate reads V1's PLACED line and not its voice.
    const slots: ChordRest[] = [
      rest(0, b(0), 'q'), rest(2, b(0), 'q'), chord(1, b(0), 'q', [['C', 6]]),
    ]
    const v1 = restLineInStaff(slots, slots[0], 'treble')
    const v3 = restLineInStaff(slots, slots[1], 'treble')
    expect(v1).toBeGreaterThan(6) // driven well above the staff by the C6 in voice 2
    expect(v3).toBeGreaterThan(v1)
  })

  it('V1 and V2 have no inner voice — nothing to stand outside of', () => {
    const slots = [rest(0, b(0), 'q'), rest(1, b(0), 'q')]
    expect(restLineInStaff(slots, slots[0], 'treble')).toBe(restNeutralLine('q') + 1)
    expect(restLineInStaff(slots, slots[1], 'treble')).toBe(restNeutralLine('q') - 1)
  })

  it('a MEASURE rest is placed as the whole rest it is drawn as', () => {
    const measureRest: ChordRest = {
      id: 'mr', type: 'rest', beat: b(0), duration: 'w', measure: 1, voice: 1,
      isMeasureRest: true, actualDuration: fracCreate(4, 1),
    }
    expect(restDrawnDuration(measureRest)).toBe('w')
    expect(restLineInStaff([measureRest], measureRest, 'treble')).toBe(1) // the bottom line
  })
})

describe('⭐⭐ the prelude’s bar — the regression his 67 placements are the fixture for', () => {
  // bar 1: voice 0 = a 16th rest, then E4 as an 8th and a quarter; voice 1 = a held C4 half note.
  // Bass clef, so both voices sit on ledger lines ABOVE the staff (C4 = line 6, E4 = line 7).
  const slots = (): ChordRest[] => [
    chord(1, b(0), 'h', [['C', 4]]),
    chord(0, b(1, 4), '8', [['E', 4]]),
    chord(0, b(1, 2), 'q', [['E', 4]]),
  ]

  it('the 16th rest clears the held note it is written over', () => {
    const ctx = restVoiceContext(slots(), 0, b(0), b(1, 4), 'bass')
    expect(ctx.others).toEqual([6])
    expect(ctx.own).toEqual([7, 7])
    const line = restLineForVoice({ duration: '16', ...ctx })
    // Above the held C4 (line 6) with the rest's own ink clear of it, not merely above its line.
    expect(line).toBeGreaterThan(6)
  })

  it('⭐ and lands within a space of what his hand chose, 67 times', () => {
    // His placements fit `steps = round(own_height_in_spaces_above_middle + 2)` — 43 of 67 exactly,
    // 65 of 67 within one space (research §2). ⚠️ A RANGE, not a magic number: the fit is his eye,
    // and the two voices move in parallel throughout this piece, so it cannot separate "track my
    // own voice" from "clear the other one" on statistics alone.
    const ctx = restVoiceContext(slots(), 0, b(0), b(1, 4), 'bass')
    const line = restLineForVoice({ duration: '16', ...ctx })
    const displacement = line - restNeutralLine('16')
    const hisFit = Math.round((7 - 3) + 2) // E4 is 4 spaces above the middle line
    expect(Math.abs(displacement - hisFit)).toBeLessThanOrEqual(1)
  })
})
