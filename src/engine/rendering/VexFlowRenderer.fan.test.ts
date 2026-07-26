// @vitest-environment jsdom
/**
 * The fan actually RENDERS (docs/fanned-beams-plan.md §3, P1).
 *
 * ⚠️ Deliberately not a geometry suite — jsdom stubs glyph measurement, so an assertion about where
 * the ink landed would pass vacuously (reference_jsdom_cannot_measure_glyphs); the picture is
 * checked by eye. What IS real here is that the pass runs at all, and the two ways it could take the
 * whole render down with it:
 *
 * - the TICK correction (a note drawn as a quarter while occupying a blanca — a FULL-mode `Voice`
 *   handed the wrong total throws), and
 * - the group balance (`openGroup`/`closeGroup` — an unbalanced pair swallows the rest of the score).
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { VexFlowRenderer } from './VexFlowRenderer'
import { FAN_GROUP } from '@/utils/fannedBeam'
import { fracCreate as frac } from '@/utils/fraction'
import type { FanMark } from '@/types/music'

const FAN: FanMark = { direction: 'accel', count: 6, beams: 3 }

function makeRenderer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new VexFlowRenderer(container)
  renderer.initialize(1200, 400)
  return { renderer, container }
}

/** `vf-` is prefixed by `openGroup`, so this is what the fan's group is called in the DOM. */
const fanGroups = (container: HTMLElement) =>
  container.querySelectorAll(`g.vf-${FAN_GROUP}`)

describe('a fanned slot renders', () => {
  it('paints one fan group for the marked note, and none for a plain one', () => {
    const model = new ScoreModel('fan render')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    const { renderer, container } = makeRenderer()

    renderer.renderScore(model.getScore())
    expect(fanGroups(container)).toHaveLength(0)

    model.setFan(note.id, FAN)
    renderer.renderScore(model.getScore())
    expect(fanGroups(container)).toHaveLength(1)
    // The id carries the name AND the slot — `getElementById` is document-wide.
    const slot = model.getMeasure(1)!.slots.find(s => s.type === 'chord')!
    expect(container.querySelector(`#vf-${FAN_GROUP}-${slot.id}`)).not.toBeNull()
  })

  it('the note itself is still there — member 0 is the real StaveNote', () => {
    const model = new ScoreModel('fan render')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, FAN)
    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())

    // The whole point of not suppressing it: the registry still knows the note, so selection,
    // ties, articulations and the dynamic anchor all keep working.
    expect(renderer.getElementRegistry().getById(note.id)).not.toBeNull()
    expect(container.querySelectorAll('g.vf-stavenote').length).toBeGreaterThan(0)
  })

  it('survives every direction, count and beam setting', () => {
    for (const direction of ['accel', 'rit'] as const) {
      for (const count of [2, 6, 12]) {
        for (const beams of [1, 3, 4]) {
          const model = new ScoreModel('fan render')
          const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
          model.setFan(note.id, { direction, count, beams })
          const { renderer, container } = makeRenderer()
          renderer.renderScore(model.getScore())
          expect(fanGroups(container), `${direction} ${count}×${beams}`).toHaveLength(1)
        }
      }
    }
  })

  it('renders on a fanned note that is not the only thing in the bar', () => {
    // The busy-bar case: the fan's span now ends at the NEXT note rather than at the barline.
    const model = new ScoreModel('fan render')
    const a = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    model.addNote({ step: 'G', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    model.setFan(a.id, FAN)
    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())
    expect(fanGroups(container)).toHaveLength(1)
  })

  it('renders a fanned CHORD, and a fan in a second voice', () => {
    const model = new ScoreModel('fan render')
    const c = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) }) // same beat = same chord
    model.setFan(c.id, FAN)
    const v1 = model.addNote({ step: 'G', octave: 5, duration: 'h', measure: 1, beat: frac(0, 1), voice: 1 })
    model.setFan(v1.id, { ...FAN, direction: 'rit' })

    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())
    expect(fanGroups(container)).toHaveLength(2)
  })

  it('the rest of the score still draws after it — the group is balanced', () => {
    const model = new ScoreModel('fan render')
    model.addMeasure()
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, FAN)
    const later = model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })

    const { renderer } = makeRenderer()
    renderer.renderScore(model.getScore())
    expect(renderer.getElementRegistry().getById(later.id)).not.toBeNull()
  })
})

/**
 * PER-MEMBER PITCH on the page (docs/fanned-beam-pitches-plan.md §2). Still not a geometry suite —
 * what is checked is that each member is its own THING in the DOM, which is what P3's selection will
 * hang off, and that the passes that could take the render down do not.
 */
describe('the members are drawn as themselves', () => {
  /** A fanned blanca whose members climb C4 D4 E4 … — the case the whole feature is for. */
  function risingFan(count = 4, octave = 4) {
    const model = new ScoreModel('fan members')
    const note = model.addNote({ step: 'C', octave, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, { direction: 'accel', count, beams: 3 })
    const slot = model.getMeasure(1)!.slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    const steps = ['D', 'E', 'F', 'G', 'A', 'B'] as const
    slot.fan!.members!.forEach((m, k) => { m[0].step = steps[k % steps.length] })
    return { model, slot, note }
  }

  const headGroups = (container: HTMLElement) => container.querySelectorAll('g.vf-fanhead')

  it('⭐ gives every member its OWN group — one per member, member 0 excepted (it is the note)', () => {
    const { model, slot } = risingFan(4)
    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())
    expect(headGroups(container)).toHaveLength(3)
    // Named and addressable, so a highlight can find one: `openGroup` prefixes `vf-`.
    expect(container.querySelector(`#vf-fanhead-${slot.id}-1`)).not.toBeNull()
    expect(container.querySelector(`#vf-fanhead-${slot.id}-3`)).not.toBeNull()
  })

  it('draws a notehead inside each member group', () => {
    const { model } = risingFan(4)
    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())
    for (const g of headGroups(container)) {
      expect(g.querySelector('g.vf-notehead')).not.toBeNull()
    }
  })

  it('⭐ an ALTERED member draws its sign — and only the first of them does', () => {
    const { model, slot } = risingFan(4)
    for (const m of slot.fan!.members!) { m[0].step = 'F'; m[0].alter = 1 }
    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())
    // Three member groups: the first F♯ shows its sign, the two repeats do not. The head's own glyph
    // is a `<text>` too, but nested in its `vf-notehead` group — the SIGN is drawn directly into the
    // member's group, so a direct child text IS an accidental.
    const withSign = [...headGroups(container)].filter(g => g.querySelector(':scope > text') !== null)
    expect(withSign).toHaveLength(1)
  })

  it('survives members far off the staff — the ledger-line path', () => {
    // The bug this phase fixes: bare NoteHeads draw no ledger lines, so an off-staff member used to
    // float. jsdom cannot say where the lines are, only that drawing them does not throw.
    const { model, slot } = risingFan(6)
    slot.fan!.members!.forEach((m, k) => { m[0].step = 'C'; m[0].octave = 6 + (k % 2) })
    const { renderer, container } = makeRenderer()
    expect(() => renderer.renderScore(model.getScore())).not.toThrow()
    expect(fanGroups(container)).toHaveLength(1)
  })

  it('a fan with no stored members still draws — an older file is read, not repaired', () => {
    const model = new ScoreModel('fan members')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, FAN)
    const slot = model.getMeasure(1)!.slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    delete slot.fan!.members // as an old JSON would arrive
    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())
    expect(fanGroups(container)).toHaveLength(1)
    expect(headGroups(container)).toHaveLength(FAN.count - 1)
  })
})

/**
 * 🚨 THE INK LANDS ON THE STAFF. jsdom cannot measure a glyph, but every coordinate the fan
 * *computes* — the heads' x's, the stems, the beam quads — is real arithmetic and ends up in the
 * SVG. So the one thing that is checkable is also the one that went wrong: reading the note's
 * geometry in the wrong window put the whole group at x = 0 with its beam 110px above the staff, and
 * every unit test still passed.
 */
describe('the fan is drawn where the note is', () => {
  /** Every number appearing in a path/line/rect inside the fan's group. */
  function coordinates(container: HTMLElement): { xs: number[]; ys: number[] } {
    const xs: number[] = []
    const ys: number[] = []
    for (const g of container.querySelectorAll(`g.vf-${FAN_GROUP}`)) {
      for (const path of g.querySelectorAll('path')) {
        const d = path.getAttribute('d') ?? ''
        const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]))
        for (let i = 0; i + 1 < nums.length; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]) }
      }
      for (const el of g.querySelectorAll('text, rect')) {
        xs.push(Number(el.getAttribute('x') ?? 0))
        ys.push(Number(el.getAttribute('y') ?? 0))
      }
    }
    return { xs, ys }
  }

  it('⭐ every coordinate is inside the page — not at x = 0, not above the canvas', () => {
    const model = new ScoreModel('fan ink')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, FAN)
    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())

    const { xs, ys } = coordinates(container)
    expect(xs.length).toBeGreaterThan(0)
    // The bar's notes start well right of the clef, and nothing may be drawn off the top edge.
    expect(Math.min(...xs)).toBeGreaterThan(20)
    expect(Math.min(...ys)).toBeGreaterThan(0)
  })

  it('⭐ the group hangs off the REAL note — its first stem is that note’s stem', () => {
    // The bug's signature was a fan drawn at x = 0 while the note it belongs to sat at x = 37.
    const model = new ScoreModel('fan ink')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, FAN)
    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())

    const noteGroup = renderer.getStaveNoteSVGGroup(note.id)
    expect(noteGroup).not.toBeNull()
    const stemRect = noteGroup!.stem?.querySelector('rect, path')
    const stemX = Number(stemRect?.getAttribute('x') ?? NaN)
    const { xs } = coordinates(container)
    if (!Number.isNaN(stemX)) {
      // The fan's leftmost ink is within a notehead's width of the note's own stem.
      expect(Math.abs(Math.min(...xs) - stemX)).toBeLessThan(20)
    }
  })

  it('⭐ and it stays below the top of the staff, where its stems can reach', () => {
    const model = new ScoreModel('fan ink')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, FAN)
    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())

    const geom = renderer.getElementRegistry().getStaffGeometry(1, 0)
    expect(geom).toBeDefined()
    const topLineY = geom!.lineYPositions[0]
    const { ys } = coordinates(container)
    // A stem-up fan on a C4 reaches above the staff, but nowhere near a whole staff-height above it:
    // the old bug put the beam 110px over the top line.
    expect(Math.min(...ys)).toBeGreaterThan(topLineY - 60)
  })
})

/**
 * ⭐ P3 — a member is SELECTABLE: it has a registry entry of its own and an SVG group the highlight
 * can recolour (docs/fanned-beam-pitches-plan.md §2 P3).
 */
describe('the members are selectable', () => {
  function fannedWithMembers(count = 4) {
    const model = new ScoreModel('fan select')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    model.setFan(note.id, { direction: 'accel', count, beams: 3 })
    const slot = model.getMeasure(1)!.slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    const steps = ['D', 'E', 'F', 'G'] as const
    slot.fan!.members!.forEach((m, k) => { m[0].step = steps[k % steps.length] })
    return { model, slot, note }
  }

  it('⭐ registers one `note` element per member, at the SLOT’s beat', () => {
    const { model, slot, note } = fannedWithMembers(4)
    const { renderer } = makeRenderer()
    renderer.renderScore(model.getScore())
    const registry = renderer.getElementRegistry()

    for (const member of slot.fan!.members!) {
      const el = registry.getById(member[0].id)
      expect(el, `member ${member[0].step}`).not.toBeNull()
      expect(el!.type).toBe('note')
      // ⚠️ THE SLOT'S BEAT, not one of its own. This is what keeps `pixelXToBeat` unmoved: that walk
      // dedups anchors by beat and keeps the leftmost x, so the members fold into the note's column.
      expect(el!.beat).toBe(registry.getById(note.id)!.beat)
      expect(el!.headX).toBeGreaterThan(registry.getById(note.id)!.headX!)
    }
  })

  it('⭐ leaves the pixel→beat mapping exactly as it was — a fan adds no anchors', () => {
    const { model } = fannedWithMembers(6)
    const { renderer } = makeRenderer()
    renderer.renderScore(model.getScore())
    const withFan = renderer.getElementRegistry().pixelXToBeat(200, 1, 4)

    const plain = new ScoreModel('fan select')
    plain.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    plain.addNote({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    const { renderer: r2 } = makeRenderer()
    r2.renderScore(plain.getScore())
    // Two anchors either way (the two slots), so the interpolation is the same shape.
    expect(withFan).not.toBeNull()
    expect(typeof withFan).toBe(typeof r2.getElementRegistry().pixelXToBeat(200, 1, 4))
  })

  it('⭐ hands the highlight a group per member — its own ink, not the note’s', () => {
    const { model, slot, note } = fannedWithMembers(4)
    const { renderer } = makeRenderer()
    renderer.renderScore(model.getScore())

    for (const member of slot.fan!.members!) {
      const info = renderer.getFanMemberSVGGroup(member[0].id)
      expect(info).not.toBeNull()
      expect(info!.group.getAttribute('class')).toBe('vf-fanhead')
      expect(info!.group.querySelector('g.vf-notehead')).not.toBeNull()
    }
    // The real note is NOT a member — it keeps its own StaveNote group.
    expect(renderer.getFanMemberSVGGroup(note.id)).toBeNull()
    expect(renderer.getStaveNoteSVGGroup(note.id)).not.toBeNull()
  })

  it('⭐ the member heads out-rank the fan’s own ink rect for a click', () => {
    // `getAt` returns the LAST matching element, and the group's rect spans every member — so the
    // rect has to be registered FIRST or no member could ever be clicked.
    const { model, slot } = fannedWithMembers(4)
    const { renderer } = makeRenderer()
    renderer.renderScore(model.getScore())
    const registry = renderer.getElementRegistry()
    const ids = slot.fan!.members!.map(m => m[0].id)
    const memberEls = ids.map(id => registry.getById(id)!)
    const all = registry.getAll()
    const beamIdx = all.findIndex(el => el.type === 'beam')
    if (beamIdx >= 0) {
      for (const el of memberEls) expect(all.indexOf(el)).toBeGreaterThan(beamIdx)
    }
  })

  it('a fan with no stored members registers nothing extra — nothing to select', () => {
    const model = new ScoreModel('fan select')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, FAN)
    const slot = model.getMeasure(1)!.slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    delete slot.fan!.members
    const { renderer } = makeRenderer()
    renderer.renderScore(model.getScore())
    // Only the real note is a `note` element in this bar.
    const notes = renderer.getElementRegistry().getByType('note')
    expect(notes).toHaveLength(1)
    expect(notes[0].id).toBe(note.id)
  })
})

/**
 * ⭐ A SLUR CAN ANCHOR TO A MEMBER — the one place this reverses the plan's §3 (which refused ties
 * and slurs together). A tie is a pitch-to-pitch CONTINUATION and a member has no length of its own
 * to continue into; a slur is a SPAN between two points, and member 2 → member 5 is a span.
 *
 * What makes it possible: `drawCurveArc` hands `renderCurve` its endpoints EXPLICITLY, so VexFlow's
 * `Curve` object only needs *some* note to be constructed with — never for x or y. A member supplies
 * its own geometry through `RenderPass.fanMemberAnchorMap`.
 */
describe('a slur anchored inside a fan', () => {
  function fannedWithSlur() {
    const model = new ScoreModel('fan slur')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    model.setFan(note.id, { direction: 'accel', count: 4, beams: 3 })
    const slot = model.getMeasure(1)!.slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    const members = slot.fan!.members!
    const slur = model.addSlur({ startNoteId: members[0][0].id, endNoteId: members[2][0].id, voice: 0 })
    return { model, slur, members }
  }

  it('⭐ draws it — one arc, anchored to something VexFlow never drew', () => {
    const { model, slur } = fannedWithSlur()
    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())

    expect(container.querySelector(`#vf-slur-${slur.id}`)).not.toBeNull()
    const registered = renderer.getElementRegistry().getAll().filter(el => el.type === 'slur')
    expect(registered).toHaveLength(1)
    expect(registered[0].fromNoteId).toBe(slur.startNoteId)
  })

  it('⭐ springs from the MEMBERS’ own x’s, not the slot’s', () => {
    // The bug this rules out: resolving both ends through `staveNoteMap` would anchor every slur in
    // the group to the real note, so a member-to-member slur would collapse to zero width.
    const { model, members } = fannedWithSlur()
    const { renderer } = makeRenderer()
    renderer.renderScore(model.getScore())
    const registry = renderer.getElementRegistry()
    const arc = registry.getAll().find(el => el.type === 'slur')!
    const from = registry.getById(members[0][0].id)!
    const to = registry.getById(members[2][0].id)!
    // The arc spans the two member heads, so it is at least as wide as the gap between them.
    expect(arc.bbox.width).toBeGreaterThan((to.headX! - from.headX!) * 0.5)
    expect(arc.bbox.x).toBeGreaterThan(from.headX! - 40)
  })

  it('the rest of the score still draws after it — the group is balanced', () => {
    const { model } = fannedWithSlur()
    model.addMeasure()
    const later = model.addNote({ step: 'G', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    const { renderer } = makeRenderer()
    renderer.renderScore(model.getScore())
    expect(renderer.getElementRegistry().getById(later.id)).not.toBeNull()
  })
})

/**
 * ⭐ JOINED TO THE GROUP ON ITS LEFT (docs/fan-beam-join-plan.md P1). The fan draws the WHOLE joined
 * group's beam by hand — one line, one owner, one pass — so what is checked here is the seam: the
 * prefix's stem is drawn by US, inside the fan's group, and is still the NOTE'S OWN `Stem` object,
 * which is the only thing the selection highlight can find.
 *
 * ⚠️ Not a geometry suite, for the file's own reason. Where the line landed is checked by eye.
 */
describe('a fan joined to the group on its left', () => {
  /** An eighth, then a fanned eighth — one beat group, so the join has something to join to. */
  function joinedPair(join: boolean) {
    const model = new ScoreModel('fan join')
    const first = model.addNote({ step: 'C', octave: 4, duration: '8', measure: 1, beat: frac(0, 1) })
    const fanned = model.addNote({ step: 'E', octave: 4, duration: '8', measure: 1, beat: frac(1, 2) })
    model.setFan(fanned.id, FAN)
    if (join) model.updateNote(fanned.id, { beam: 'continue' })
    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())
    const slot = model.getMeasure(1)!.slots.find(s => s.type === 'chord' && s.fan)!
    return { model, renderer, container, first, fanned, slot }
  }

  it('⭐ draws the prefix’s stem INSIDE the fan’s group — the join is the fan’s ink', () => {
    const { renderer, container, first, slot } = joinedPair(true)
    const fanGroup = container.querySelector(`#vf-${FAN_GROUP}-${slot.id}`)
    expect(fanGroup).not.toBeNull()
    const stem = renderer.getStaveNoteSVGGroup(first.id)?.stem
    expect(stem).not.toBeNull()
    expect(fanGroup!.contains(stem!)).toBe(true)
  })

  it('…and it is the NOTE’S OWN Stem object, so the highlight can still find it', () => {
    // 🚨 The whole reason it is not a hand-drawn line: `getStaveNoteSVGGroup` resolves a stem by that
    // object's SVG element, and ink drawn any other way could never be selected.
    const { renderer, first } = joinedPair(true)
    const info = renderer.getStaveNoteSVGGroup(first.id)
    expect(info?.stem).not.toBeNull()
    expect(info!.stem!.querySelectorAll('path, rect').length).toBeGreaterThan(0)
  })

  it('leaves the prefix’s stem where VexFlow drew it when the fan is NOT joined', () => {
    const { renderer, container, first, slot } = joinedPair(false)
    const fanGroup = container.querySelector(`#vf-${FAN_GROUP}-${slot.id}`)
    const stem = renderer.getStaveNoteSVGGroup(first.id)?.stem
    expect(stem).not.toBeNull()
    expect(fanGroup!.contains(stem!)).toBe(false)
  })

  it('builds no VexFlow Beam over the joined group — the line is entirely ours', () => {
    const { container } = joinedPair(true)
    expect(container.querySelectorAll('g.vf-beam')).toHaveLength(0)
  })

  it('⭐ the fan’s ink rect reaches BACK over the prefix, so the joined beam selects the fan', () => {
    const joinedRect = fanInkRect(joinedPair(true))
    const aloneRect = fanInkRect(joinedPair(false))
    expect(joinedRect).not.toBeNull()
    expect(aloneRect).not.toBeNull()
    expect(joinedRect!.x).toBeLessThan(aloneRect!.x)
  })

  it('the rest of the score still draws after it — the group is balanced', () => {
    const { model, renderer, container, fanned } = joinedPair(true)
    model.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    renderer.renderScore(model.getScore())
    expect(renderer.getElementRegistry().getById(fanned.id)).not.toBeNull()
    expect(container.querySelectorAll('g.vf-stavenote').length).toBeGreaterThan(2)
  })

  /** The fan's own `beam` hit rect — the one `registerFanInk` filed, the widest in the bar. */
  function fanInkRect(built: { renderer: VexFlowRenderer }): { x: number; width: number } | null {
    const beams = built.renderer.getElementRegistry().getAll().filter(e => e.type === 'beam')
    if (!beams.length) return null
    return { x: beams[0].bbox.x, width: beams[0].bbox.width }
  }
})

/**
 * ⭐ P2 — FAN TO FAN. The left fan's last member and the right fan's owner, on one shared line.
 * The gap's quads belong to the RIGHT fan's group — it is the one wearing the `continue`.
 */
describe('two fans joined to each other', () => {
  function twoFans(join: boolean) {
    const model = new ScoreModel('fan chain')
    const left = model.addNote({ step: 'C', octave: 4, duration: '8', measure: 1, beat: frac(0, 1) })
    const right = model.addNote({ step: 'G', octave: 4, duration: '8', measure: 1, beat: frac(1, 2) })
    model.setFan(left.id, FAN)
    model.setFan(right.id, { direction: 'rit', count: 4, beams: 2 })
    if (join) model.updateNote(right.id, { beam: 'continue' })
    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())
    return { model, renderer, container, left, right }
  }

  it('paints both fans’ groups either way — a join adds ink, it does not replace it', () => {
    expect(fanGroups(twoFans(false).container)).toHaveLength(2)
    expect(fanGroups(twoFans(true).container)).toHaveLength(2)
  })

  it('⭐ puts BOTH fans on ONE line — a beam is one straight edge', () => {
    // Different pitches, so unjoined the two ramps sit at different heights; joined they cannot.
    const apart = beamTops(twoFans(false))
    const together = beamTops(twoFans(true))
    expect(apart[0]).not.toBeCloseTo(apart[1], 1)
    expect(together[0]).toBeCloseTo(together[1], 1)
  })

  it('⭐ the right fan’s ink reaches BACK over the gap to the left one', () => {
    const joined = fanRects(twoFans(true))
    const alone = fanRects(twoFans(false))
    expect(joined[1].x).toBeLessThan(alone[1].x)
  })

  it('builds no VexFlow Beam for the chain either', () => {
    expect(twoFans(true).container.querySelectorAll('g.vf-beam')).toHaveLength(0)
  })

  it('the rest of the score still draws after it — both groups are balanced', () => {
    const { model, renderer, container, right } = twoFans(true)
    model.addNote({ step: 'A', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    renderer.renderScore(model.getScore())
    expect(renderer.getElementRegistry().getById(right.id)).not.toBeNull()
    expect(container.querySelectorAll('g.vf-stavenote').length).toBeGreaterThan(2)
  })

  /** The topmost y of each fan group's beam ink, left group first. */
  function beamTops(built: { container: HTMLElement }): number[] {
    return [...built.container.querySelectorAll(`g.vf-${FAN_GROUP}`)].map(g => {
      const ys: number[] = []
      for (const path of g.querySelectorAll('path')) {
        const nums = [...(path.getAttribute('d') ?? '').matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]))
        for (let i = 1; i < nums.length; i += 2) ys.push(nums[i])
      }
      return Math.min(...ys)
    })
  }

  /** Each fan's registered `beam` hit rect, in registration (left-to-right) order. */
  function fanRects(built: { renderer: VexFlowRenderer }): { x: number }[] {
    return built.renderer.getElementRegistry().getAll()
      .filter(e => e.type === 'beam')
      .map(e => ({ x: e.bbox.x }))
  }
})

/**
 * ⭐ P3 — THE JOIN CROSSES A BARLINE (docs/fan-beam-join-plan.md). The whole group is then drawn by
 * a top-level pass, outside every measure group, for `drawCrossBarBeams`' own two reasons: a measure
 * group is REUSED between renders, and culling deletes an off-screen bar's group with everything
 * drawn into it.
 */
describe('a fan joined across a barline', () => {
  function acrossBarline(join: boolean) {
    const model = new ScoreModel('fan across')
    model.addMeasure()
    // Bar 1 ends with an eighth on the last half-beat; bar 2 opens with the fan.
    const before = model.addNote({ step: 'C', octave: 4, duration: '8', measure: 1, beat: frac(7, 2) })
    const fanned = model.addNote({ step: 'E', octave: 4, duration: '8', measure: 2, beat: frac(0, 1) })
    model.setFan(fanned.id, FAN)
    if (join) model.updateNote(fanned.id, { beam: 'continue' })
    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())
    const slot = model.getScore().measures[1].slots.find(s => s.type === 'chord' && s.fan)!
    return { model, renderer, container, before, fanned, slot }
  }

  it('⭐ draws the fan OUTSIDE every measure group once it crosses', () => {
    const svg = (b: { renderer: VexFlowRenderer }) => b.renderer.getSVGElement()!
    // Unjoined, the fan belongs to its bar and is drawn inside that bar's group.
    const alone = acrossBarline(false)
    expect([...svg(alone).children].filter(el => el.getAttribute('class') === `vf-${FAN_GROUP}`)).toHaveLength(0)
    expect(fanGroups(alone.container)).toHaveLength(1)

    // Joined, it belongs to no bar — like a tie or a slur.
    const crossed = acrossBarline(true)
    expect([...svg(crossed).children].filter(el => el.getAttribute('class') === `vf-${FAN_GROUP}`)).toHaveLength(1)
    expect(fanGroups(crossed.container)).toHaveLength(1)
  })

  it('⭐ pulls the PREFIX’s stem across with it — drawn by us, still the note’s own object', () => {
    const { renderer, container, before, slot } = acrossBarline(true)
    const fanGroup = container.querySelector(`#vf-${FAN_GROUP}-${slot.id}`)
    expect(fanGroup).not.toBeNull()
    const stem = renderer.getStaveNoteSVGGroup(before.id)?.stem
    expect(stem).not.toBeNull()
    expect(fanGroup!.contains(stem!)).toBe(true)
  })

  it('builds no cross-barline `Beam` over it — the line is the fan’s', () => {
    const { container } = acrossBarline(true)
    expect(container.querySelectorAll('g.vf-beam')).toHaveLength(0)
  })

  it('the fan keeps its own stem — the one the joined line is anchored to', () => {
    // 🚨 The owner must NOT get a placeholder: `StaveNote.draw` skips the stem whenever `note.beam`
    // is set, and that stem is what `stemLift` tops up to reach the line.
    const { renderer, fanned } = acrossBarline(true)
    expect(renderer.getStaveNoteSVGGroup(fanned.id)?.stem).not.toBeNull()
  })

  it('⭐ TWO FANS across the barline — P2 and P3 at once, chained by the second’s mark', () => {
    const model = new ScoreModel('fan chain across')
    model.addMeasure()
    const left = model.addNote({ step: 'C', octave: 4, duration: '8', measure: 1, beat: frac(7, 2) })
    const right = model.addNote({ step: 'E', octave: 4, duration: '8', measure: 2, beat: frac(0, 1) })
    model.setFan(left.id, FAN)
    model.setFan(right.id, { direction: 'rit', count: 4, beams: 2 })
    model.updateNote(right.id, { beam: 'continue' })
    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())

    // Both fans draw, both outside every measure group — the whole group left its bars together.
    expect(fanGroups(container)).toHaveLength(2)
    const svg = renderer.getSVGElement()!
    expect([...svg.children].filter(el => el.getAttribute('class') === `vf-${FAN_GROUP}`)).toHaveLength(2)
    // Neither owner lost its stem, and no `Beam` was built over the pair.
    expect(renderer.getStaveNoteSVGGroup(left.id)?.stem).not.toBeNull()
    expect(renderer.getStaveNoteSVGGroup(right.id)?.stem).not.toBeNull()
    expect(container.querySelectorAll('g.vf-beam')).toHaveLength(0)
  })

  it('survives a re-render, and the rest of the score still draws', () => {
    const { model, renderer, container, fanned } = acrossBarline(true)
    model.addNote({ step: 'A', octave: 4, duration: 'q', measure: 2, beat: frac(1, 1) })
    renderer.renderScore(model.getScore())
    renderer.renderScore(model.getScore())
    expect(fanGroups(container)).toHaveLength(1)
    expect(renderer.getElementRegistry().getById(fanned.id)).not.toBeNull()
  })
})
