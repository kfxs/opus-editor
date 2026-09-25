import { dotInkWidth } from './dotSize'
import { flagPushedFirstDot, resetDotFlagRule, setDotFlagRule } from './dotFlag'
import { describe, it, expect, afterEach } from 'vitest'
import type { GraceGroup, Measure, NotePitch } from '@/types/music'
import { GRACE_ROWS, graceDotXs, graceLayout, graceScale, graceSizeGeneration, graceStemSpaces, graceSizeSettings, hostLeftReach, resetGraceSize, setGraceSize } from './graceRoom'
import { laneFingerprint } from './MeasureWidthCache'
import { INK, accidentalExtent } from './spacingPadding'
import { armedDotGap } from './dotGap'
import { glyphBox, noteheadInk } from '@/engine/fonts/fontMetrics'
import { MODIFIER_RIGHT_GAP_PX } from '@/engine/engrave/inheritedDefaults'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

const p = (id: string, step: NotePitch['step'], octave = 5, alter: NotePitch['alter'] = 0): NotePitch =>
  ({ id, step, alter, octave })
const group = (...notes: NotePitch[][]): GraceGroup => ({ notes: notes.map(pitches => ({ pitches, duration: '8' as const })) })
const none = () => null

describe('graceLayout — right to left from the host', () => {
  it('⭐ one grace: its head clears the host’s ink by `toMain`, at the grace size', () => {
    const { places, reach } = graceLayout(group([p('g', 'D')]), none, 'treble', 0)
    const k = graceScale()
    expect(places).toHaveLength(1)
    expect(places[0].headWidth).toBeCloseTo(INK.notehead * k, 9)
    expect(places[0].headX + places[0].headWidth).toBeCloseTo(-GRACE_ROWS.toMain.value, 9)
    expect(reach).toBeCloseTo(GRACE_ROWS.toMain.value + INK.notehead * k, 9)
  })

  it('⭐ …and clears the host’s ACCIDENTAL, not its bare head', () => {
    const host = [p('h', 'E', 5, 1)]
    const hostReach = hostLeftReach(host, id => (id === 'h' ? '#' : null), 'treble')
    expect(hostReach).toBeCloseTo(accidentalExtent([{ position: 0, sign: '#' }]), 9)
    const bare = graceLayout(group([p('g', 'D')]), none, 'treble', 0)
    const signed = graceLayout(group([p('g', 'D')]), none, 'treble', hostReach)
    expect(signed.places[0].headX).toBeCloseTo(bare.places[0].headX - hostReach, 9)
  })

  it('a grace’s own accidental widens the reach, scaled with the grace', () => {
    const plain = graceLayout(group([p('g', 'D')]), none, 'treble', 0).reach
    const sharp = graceLayout(group([p('g', 'D', 5, 1)]), () => '#', 'treble', 0).reach
    expect(sharp - plain).toBeCloseTo(accidentalExtent([{ position: 0, sign: '#' }]) * graceScale(), 9)
  })

  it('two graces keep their order, `between` apart edge to edge', () => {
    const { places } = graceLayout(group([p('a', 'C')], [p('b', 'D')]), none, 'treble', 0)
    expect(places.map(pl => pl.note.pitches[0].id)).toEqual(['a', 'b'])
    expect(places[1].headX - (places[0].headX + places[0].headWidth)).toBeCloseTo(GRACE_ROWS.between.value, 9)
  })
})

describe('the grace SIZE knob — `__grace.size(…)`', () => {
  afterEach(() => resetGraceSize())

  it('⭐ arms a row by name or a number, and the layout follows it', () => {
    const at = () => graceLayout(group([p('g', 'D')]), none, 'treble', 0).places[0].headWidth
    const house = at()
    expect(setGraceSize('dorico')).toBe(true)
    expect(graceScale()).toBe(0.6)
    expect(at()).toBeCloseTo(house * (0.6 / (2 / 3)), 9)
    expect(setGraceSize(0.62)).toBe(true)
    expect(graceSizeSettings()).toEqual({ rule: 'custom', value: 0.62 })
  })

  it('⛔ refuses a typo or a size out of range — and moves nothing', () => {
    const before = graceSizeGeneration()
    expect(setGraceSize('dorco' as never)).toBe(false)
    expect(setGraceSize(2)).toBe(false)
    expect(graceSizeGeneration()).toBe(before)
    expect(graceScale()).toBeCloseTo(2 / 3, 9)
  })

  it('🚨 re-arming changes the WIDTH fingerprint — or a memoised bar would not move', () => {
    const measure: Measure = { id: 'm', number: 1, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [] } as unknown as Measure
    const before = laneFingerprint(measure)
    setGraceSize('musescore')
    expect(laneFingerprint(measure)).not.toBe(before)
  })
})

describe('graceStemSpaces — Gould p. 126: a grace on ledger lines gets a stem long enough', () => {
  // Lines as `staffLineForSpelling` counts them in treble: E4 = 1 (bottom line), C4 = 0 (1st ledger).
  it('in or above the staff, the plain 2½', () => {
    expect(graceStemSpaces([2.5])).toBe(GRACE_ROWS.stem.value) // D5
    expect(graceStemSpaces([7])).toBe(GRACE_ROWS.stem.value)   // A5 on a ledger ABOVE — its ledger is on the far side
    expect(graceStemSpaces()).toBe(GRACE_ROWS.stem.value)
  })

  it('⭐ below the staff on ledgers, the tip reaches 1.8 sp beyond the C4 ledger — Gould\'s own drawings', () => {
    expect(graceStemSpaces([-1.5])).toBeCloseTo(3.3, 9) // G3 — her correct one measures 3.25
    expect(graceStemSpaces([-2])).toBeCloseTo(3.8, 9)   // F3 — 3.77
    expect(graceStemSpaces([-0.5])).toBe(GRACE_ROWS.stem.value) // B3 — 2.3 < 2½; she drew 2.68
  })

  it('a chord measures from its HIGHEST head', () => {
    expect(graceStemSpaces([-1.5, 1])).toBe(GRACE_ROWS.stem.value) // the E4 head already reaches
  })

  it('⭐ stems DOWN (P6): the MIRROR — a grace ABOVE the staff on ledgers grows; below it never does', () => {
    expect(graceStemSpaces([7.5], true)).toBeCloseTo(3.3, 9) // mirror of G3's 3.3
    expect(graceStemSpaces([8], true)).toBeCloseTo(3.8, 9)
    expect(graceStemSpaces([-1.5], true)).toBe(GRACE_ROWS.stem.value) // below: its ledgers are on the far side
    expect(graceStemSpaces([7.5, 5], true)).toBe(GRACE_ROWS.stem.value) // measured from the LOWEST head
  })
})

describe('graceLayout — a DOTTED grace: the NORMAL note\'s dot rule, at the grace\'s size', () => {
  it('⭐ a stem-DOWN grace\'s flag hangs under its head — nothing for the dot to clear (P6)', () => {
    const [up] = graceDotXs({ duration: '8', dots: 1 })
    const [down] = graceDotXs({ duration: '8', dots: 1 }, false, true)
    expect(down).toBeLessThan(up)
    expect(down).toBeCloseTo(graceDotXs({ duration: '8', dots: 1 }, true)[0], 9) // as a beamed one
  })

  const px = (sp: number) => sp * STAFF_SPACE_PX
  it('⭐ a flagged (stem-up) grace: the armed FLAG row, as a normal dotted 8th — `vexflow` was head + 2 px + the flag\'s width', () => {
    setDotFlagRule('vexflow')
    expect(px(graceDotXs({ duration: '8', dots: 1 })[0])).toBeCloseTo(px(noteheadInk('8')) + MODIFIER_RIGHT_GAP_PX + px(glyphBox('flag8thUp').right), 9)
    resetDotFlagRule()
    // `gould` (armed): past the flag's ink by 0.30 — a grace cannot say where its dot stands, so it is LEVEL.
    expect(graceDotXs({ duration: '8', dots: 1 })[0]).toBeCloseTo(flagPushedFirstDot('8')!, 9)
  })
  it('⭐ an unflagged grace: head + the ARMED dot gap (never under the 2 px) — as a normal dotted quarter', () => {
    const [first] = graceDotXs({ duration: 'q', dots: 1 })
    expect(px(first)).toBeCloseTo(px(noteheadInk('q')) + Math.max(MODIFIER_RIGHT_GAP_PX, px(armedDotGap().head)), 9)
  })
  it('each further dot: one dot + the armed dot→dot gap', () => {
    const [a, b] = graceDotXs({ duration: 'q', dots: 2 })
    expect(b - a).toBeCloseTo(dotInkWidth() + armedDotGap().dot, 9)
  })
  it('its dot stands between it and the host: the gap is measured to the DOT, so the head moves left', () => {
    const plain = graceLayout({ notes: [{ pitches: [p('g', 'D')], duration: 'q' }] }, none, 'treble', 0)
    const dotted = graceLayout({ notes: [{ pitches: [p('g', 'D')], duration: 'q', dots: 1 }] }, none, 'treble', 0)
    const reach = graceDotXs({ duration: 'q', dots: 1 })[0] + dotInkWidth()
    expect(dotted.places[0].rightInk).toBeCloseTo(reach * graceScale(), 9)
    expect(dotted.places[0].headX).toBeLessThan(plain.places[0].headX)
  })
})
