import { describe, it, expect, afterEach } from 'vitest'
import {
  BRACKETED_ROWS, BRACKET_FORMS, beforeSideLayout, bracketedGeneration, bracketedLayout, bracketedScale,
  bracketedSettings, resetBracketed, setBracketForm, setBracketedSize,
} from './bracketedRoom'
import { GRACE_ROWS, graceLayout } from './graceRoom'
import { glyphBox, noteheadInk } from '@/engine/fonts/fontMetrics'
import { fracCreate } from '@/utils/fraction'
import type { BracketedGrace, Chord, NotePitch } from '@/types/music'

/**
 * Subject: `./bracketedRoom` — where a bracketed grace's head, sign and brackets stand, and the room
 * the before side takes (docs/plans/bracketed-grace-plan.md P1). Pure arithmetic on the metric tables.
 */
const pitch = (id: string, step: NotePitch['step'], octave: number, alter: NotePitch['alter'] = 0): NotePitch => ({ id, step, alter, octave })
const one = (p: NotePitch): BracketedGrace => ({ pitches: [p], duration: 'q' })
const none = () => null

afterEach(() => resetBracketed())

describe('bracketedLayout', () => {
  it('⭐ the head\'s right bracket clears the host by `toMain`, the head at the armed size', () => {
    setBracketForm('notehead')
    const { places, reach } = bracketedLayout([one(pitch('a', 'D', 5))], none, 'treble', 0)
    const k = bracketedScale()
    const R = glyphBox(BRACKET_FORMS.notehead.right)
    expect(places[0].headWidth).toBeCloseTo(noteheadInk('q') * k, 9)
    expect(places[0].right).toBeCloseTo(-BRACKETED_ROWS.toMain.value, 9)
    // The right bracket's ink starts at the head's right edge (the notehead form's gap is 0)…
    expect(places[0].heads[0].rightParenX - R.left * k).toBeCloseTo(places[0].headX + places[0].headWidth, 9)
    // …and the whole thing reaches as far left as its left bracket's ink.
    expect(reach).toBeCloseTo(-places[0].left, 9)
    expect(places[0].left).toBeLessThan(places[0].headX)
  })

  it('⭐ the host\'s own left ink pushes it further off', () => {
    const bare = bracketedLayout([one(pitch('a', 'D', 5))], none, 'treble', 0)
    const pushed = bracketedLayout([one(pitch('a', 'D', 5))], none, 'treble', 1.5)
    expect(bare.places[0].headX - pushed.places[0].headX).toBeCloseTo(1.5, 9)
  })

  it('⭐ B8: a sign stands INSIDE — the left bracket clears the accidental by `parenToAccidental`', () => {
    setBracketForm('notehead')
    const { places } = bracketedLayout([one(pitch('b', 'B', 4, -1))], () => 'b', 'treble', 0)
    const head = places[0].heads[0]
    const L = glyphBox(BRACKET_FORMS.notehead.left)
    const k = bracketedScale()
    expect(head.sign).toBe('b')
    expect(head.accidentalX!).toBeLessThan(places[0].headX)
    expect(head.accidentalX! - (head.leftParenX + L.right * k)).toBeCloseTo(BRACKETED_ROWS.parenToAccidental.value, 9)
  })

  it('B3: a LIST stands left to right, each clearing the next by `between`', () => {
    const { places } = bracketedLayout([one(pitch('a', 'D', 5)), one(pitch('b', 'F', 5))], none, 'treble', 0)
    expect(places.map(p => p.bracketed.pitches[0].id)).toEqual(['a', 'b'])
    expect(places[1].left - places[0].right).toBeCloseTo(BRACKETED_ROWS.between.value, 9)
  })

  it('a head on a LEDGER reaches at least the ledger\'s overhang', () => {
    const inStaff = bracketedLayout([one(pitch('a', 'D', 5))], none, 'treble', 0).places[0]
    const ledger = bracketedLayout([one(pitch('a', 'A', 3))], none, 'treble', 0).places[0]
    expect(ledger.headX - ledger.left).toBeGreaterThanOrEqual(inStaff.headX - inStaff.left - 1e-9)
  })

  it('⭐ B9: `gould` is ARMED (his call) — full-size accidental brackets, a head gap, a taller band than `notehead`', () => {
    expect(bracketedSettings().form).toBe('gould')
    setBracketForm('notehead')
    const plain = bracketedLayout([one(pitch('a', 'D', 5))], none, 'treble', 0)
    setBracketForm('gould')
    const gould = bracketedLayout([one(pitch('a', 'D', 5))], none, 'treble', 0)
    expect(gould.up).toBeCloseTo(glyphBox('accidentalParensLeft').up, 9)
    expect(gould.up).toBeGreaterThan(plain.up)
    expect(gould.reach).toBeGreaterThan(plain.reach)
  })
})

describe('the rows', () => {
  it('a size row, a free number, and a refusal — every change bumps the width generation', () => {
    const g0 = bracketedGeneration()
    expect(setBracketedSize('gouldTrill')).toBe(true)
    expect(bracketedScale()).toBe(0.75)
    expect(setBracketedSize(0.5)).toBe(true)
    expect(bracketedSettings()).toMatchObject({ size: 'custom', scale: 0.5 })
    expect(setBracketedSize(2)).toBe(false)
    expect(setBracketForm('nope' as never)).toBe(false)
    expect(bracketedGeneration()).toBe(g0 + 2)
  })
})

describe('beforeSideLayout — [grace group] [bracketed] main', () => {
  const chord = (over: Partial<Chord>): Chord => ({
    id: 'c', type: 'chord', beat: fracCreate(0, 1), duration: 'q', measure: 1, notes: [pitch('n', 'E', 5)], ...over,
  })
  const group = { notes: [{ pitches: [pitch('g', 'G', 4)], duration: '8' as const }] }

  it('graces alone: exactly the grace layout, as before brackets existed', () => {
    const side = beforeSideLayout(chord({ graceBefore: group }), none, 'treble', 0)
    expect(side.bracketed).toBeNull()
    expect(side.graces).toEqual(graceLayout(group, none, 'treble', 0))
    expect(side.reach).toBe(side.graces!.reach)
  })

  it('⭐ with brackets: the group clears THEIR ink by `toGrace`, and the side reaches as far as the group', () => {
    const side = beforeSideLayout(chord({ graceBefore: group, bracketedBefore: [one(pitch('b', 'D', 5))] }), none, 'treble', 0)
    const lastGrace = side.graces!.places[side.graces!.places.length - 1]
    expect(side.bracketed!.places[0].left - (lastGrace.headX + lastGrace.rightInk)).toBeCloseTo(BRACKETED_ROWS.toGrace.value, 9)
    expect(side.reach).toBe(side.graces!.reach)
    expect(side.reach).toBeGreaterThan(graceLayout(group, none, 'treble', 0).reach)
  })

  it('brackets alone: the side is theirs; a rest has none', () => {
    const side = beforeSideLayout(chord({ bracketedBefore: [one(pitch('b', 'D', 5))] }), none, 'treble', 0)
    expect(side.graces).toBeNull()
    expect(side.reach).toBe(side.bracketed!.reach)
    expect(GRACE_ROWS.toMain.value).toBeGreaterThan(0)
  })

describe('beforeSideLayout — P3: a bracketed grace bent INTO a grace splits the group', () => {
  const pitchOf = (id: string, step: NotePitch['step']) => pitch(id, step, 5)
  const splitChord = (): Chord => ({
    id: 'c', type: 'chord', beat: fracCreate(0, 1), duration: 'q', measure: 1, notes: [pitchOf('n', 'E')],
    graceBefore: {
      notes: [
        { pitches: [pitchOf('g1', 'C')], duration: '8' },
        { pitches: [pitchOf('g2', 'D')], duration: '8', bracketedBefore: [one(pitch('b', 'B', 4))] },
        { pitches: [pitchOf('g3', 'F')], duration: '8' },
      ],
    },
  })

  it('⭐ [g1] (●) [g2 g3] M — the bracket stands between g1 and g2, clearing each by its row', () => {
    const side = beforeSideLayout(splitChord(), none, 'treble', 0)
    const [g1, g2] = side.graces!.places
    const bracket = side.graceBracketed[0].layout.places[0]
    expect(side.graceBracketed.map(g => g.grace.pitches[0].id)).toEqual(['g2'])
    expect(bracket.right).toBeLessThan(g2.headX)
    expect(g2.headX - bracket.right).toBeCloseTo(BRACKETED_ROWS.toMain.value, 9) // the bracket clears its TARGET
    expect(bracket.left - (g1.headX + g1.rightInk)).toBeCloseTo(BRACKETED_ROWS.toGrace.value, 9)
  })

  it('the places stay in the GROUP\'s order — one layout, however many runs', () => {
    const side = beforeSideLayout(splitChord(), none, 'treble', 0)
    expect(side.graces!.places.map(p => p.note.pitches[0].id)).toEqual(['g1', 'g2', 'g3'])
    const xs = side.graces!.places.map(p => p.headX)
    expect(xs[0]).toBeLessThan(xs[1])
    expect(xs[1]).toBeLessThan(xs[2])
    expect(side.reach).toBeCloseTo(side.graces!.reach, 9)
  })

  it('…and the split costs room: the side reaches further than the unsplit group', () => {
    const plain = splitChord()
    delete plain.graceBefore!.notes[1].bracketedBefore
    expect(beforeSideLayout(splitChord(), none, 'treble', 0).reach).toBeGreaterThan(beforeSideLayout(plain, none, 'treble', 0).reach)
  })
})
})
