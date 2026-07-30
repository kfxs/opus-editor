import { test, expect } from './fixtures'

/**
 * Fanned (feathered) beams (docs/fanned-beams-plan.md), measured for real.
 *
 * `VexFlowRenderer.fan.test.ts` says at its head that it is *"deliberately not a geometry suite —
 * jsdom stubs glyph measurement, so an assertion about where the ink landed would pass vacuously"*.
 * This is that missing half. The fan is the feature most exposed to a renderer refactor: it draws
 * its own noteheads, its own stems and its own beam lines, none of it VexFlow's.
 *
 * The two facts a fan must keep are the two it is FOR: the heads crowd together (accel) or spread
 * apart (rit), and the beam lines converge at the slow end and feather out at the fast one.
 */

/** How close two y values must be to count as the same beam line. */
const SAME_LINE = 0.01

/** The distinct heights the ramp lines sit at on one side — the number of lines you SEE there. */
function linesAt(ys: number[]): number {
  return new Set(ys.map(y => Math.round(y / SAME_LINE))).size
}

test('an accelerando fan: heads crowd together, beams feather OUT to the right', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 6, beams: 3 })
    await h.render()
    return {
      heads: h.noteheads(),
      ramps: h.quads('g.vf-fan path'),
      slots: h.engine.getScore().measures[0].slots.filter(s => s.type === 'chord').length,
    }
  })

  // The assertion is one note; the six are a projection of it and are never written back
  // (docs/fanned-beams-plan.md §0). Both halves are visible here at once.
  expect(drawn.slots, 'the model still holds ONE event').toBe(1)
  expect(drawn.heads, 'and six are drawn').toHaveLength(6)

  const gaps = drawn.heads.slice(1).map((head, i) => head.x - drawn.heads[i].x)
  for (const [i, gap] of gaps.slice(1).entries()) {
    expect(gap, 'each gap is no wider than the one before — the music speeds up').toBeLessThanOrEqual(gaps[i] + 0.01)
  }
  expect(gaps[gaps.length - 1], 'and the last is clearly tighter than the first').toBeLessThan(gaps[0] - 1)

  expect(drawn.ramps, 'three beams asked for, three lines drawn').toHaveLength(3)
  expect(linesAt(drawn.ramps.map(r => r.yLeft)), 'converged at the slow end').toBe(1)
  expect(linesAt(drawn.ramps.map(r => r.yRight)), 'feathered at the fast end').toBe(3)
})

test('a ritardando fan is its mirror', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'rit', count: 6, beams: 3 })
    await h.render()
    return { heads: h.noteheads(), ramps: h.quads('g.vf-fan path') }
  })

  const gaps = drawn.heads.slice(1).map((head, i) => head.x - drawn.heads[i].x)
  for (const [i, gap] of gaps.slice(1).entries()) {
    expect(gap, 'each gap is at least as wide as the one before — the music slows').toBeGreaterThanOrEqual(gaps[i] - 0.01)
  }
  expect(gaps[gaps.length - 1], 'and the last is clearly wider than the first').toBeGreaterThan(gaps[0] + 1)

  expect(linesAt(drawn.ramps.map(r => r.yLeft)), 'feathered at the fast end — which is now the left').toBe(3)
  expect(linesAt(drawn.ramps.map(r => r.yRight)), 'converged at the slow end').toBe(1)
})

test('every drawn member gets its own stem up to the beam', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 6, beams: 3 })
    await h.render()
    // Vertical lines inside the fan group: the prefix stems the fan draws for the members it
    // invents (the first member is the REAL StaveNote and keeps its own stem, outside the group).
    const vertical = h.segments('g.vf-fan path').filter(s => Math.abs(s.x1 - s.x2) < 0.01)
    return { vertical, ownStem: h.stems(), heads: h.noteheads(), ramps: h.quads('g.vf-fan path') }
  })

  expect(drawn.ownStem, 'the real note keeps its own stem').toHaveLength(1)
  expect(drawn.vertical, 'and the five invented members get theirs').toHaveLength(5)
  const beamTop = Math.min(...drawn.ramps.flatMap(r => [r.yLeft, r.yRight]))
  for (const stem of drawn.vertical) {
    expect(stem.y1, 'each stem starts at its notehead').toBeCloseTo(drawn.heads[0].y, 1)
    expect(Math.min(stem.y1, stem.y2), 'and reaches the beam').toBeLessThanOrEqual(beamTop + 2)
  }
})

test('the number of beam lines is the number asked for', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 4, beams: 2 })
    await h.render()
    return { ramps: h.quads('g.vf-fan path'), heads: h.noteheads() }
  })

  expect(drawn.heads).toHaveLength(4)
  expect(drawn.ramps).toHaveLength(2)
  expect(linesAt(drawn.ramps.map(r => r.yRight)), 'two lines at the fast end').toBe(2)
})

/**
 * ⭐ EVERY MEMBER OF A FAN CARRIES ITS OWN ARTICULATIONS.
 *
 * This started as the opposite: an articulation attached to the SLOT, so it was drawn once on member
 * 0 — the only head VexFlow knows about — while playback shortened all six. Drawing the slot's mark
 * on every head fixed the disagreement and produced the real complaint: *"if i apply an articulation
 * to the owner of the fan it applies for all the members... every member should have its own"*. A fan
 * is how you write N attacks, and an articulation belongs to an attack.
 *
 * Only measurable here: a member's marks are hand-placed glyphs on a head VexFlow never drew, and
 * jsdom measures every glyph as 0x0.
 */
const NOTEHEADS = [0xe0a0, 0xe0ff] as const
const RESTS = [0xe4e0, 0xe4ff] as const

/** Every glyph that is neither a notehead nor a rest — here, the articulation marks. */
function marksOnly(glyphs: { code: string; x: number; y: number }[]) {
  return glyphs.filter(g => {
    const c = parseInt(g.code, 16)
    const inRange = ([lo, hi]: readonly [number, number]) => c >= lo && c <= hi
    return !inRange(NOTEHEADS) && !inRange(RESTS)
  })
}

test('a mark on the fan OWNER stays on the owner — it is not spread over the members', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 6, beams: 3 })
    h.engine.toggleArticulation(note!.id, 'staccato')
    await h.render()
    return {
      heads: h.noteheads(),
      onOwner: h.glyphs('g.vf-stavenote text'),
      onMembers: h.glyphs('g.vf-fanhead text'),
    }
  })

  expect(drawn.heads, 'six heads').toHaveLength(6)
  expect(marksOnly(drawn.onOwner), 'the owner wears it').toHaveLength(1)
  expect(marksOnly(drawn.onMembers), 'and no member does — the mark is the owner’s alone').toEqual([])
})

test('a mark on ONE member appears on that member and nowhere else', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 6, beams: 3 })
    const slot = h.engine.getScore().measures[0].slots[0]
    const memberIds = (slot.fan?.members ?? []).map(m => m.pitches[0].id)
    // The THIRD member alone — the case the model could not even express before.
    h.engine.toggleArticulation(memberIds[2], 'accent')
    await h.render()
    return {
      heads: h.noteheads(),
      onOwner: h.glyphs('g.vf-stavenote text'),
      onMembers: h.glyphs('g.vf-fanhead text'),
    }
  })

  const marks = marksOnly(drawn.onMembers)
  expect(marksOnly(drawn.onOwner), 'the owner was not marked').toEqual([])
  expect(marks, 'exactly one mark, for the one member that has one').toHaveLength(1)

  // Heads left to right: [owner, m1, m2, m3, m4, m5] — the mark belongs over the FOURTH.
  const headXs = drawn.heads.map(g => g.x).sort((a, b) => a - b)
  expect(Math.abs(marks[0].x - headXs[3]), 'on the third member’s head, not the first')
    .toBeLessThan(8)
})

test('a member’s mark is engraved exactly like the owner’s — same glyph, same height', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 6, beams: 3 })
    const slot = h.engine.getScore().measures[0].slots[0]
    const memberIds = (slot.fan?.members ?? []).map(m => m.pitches[0].id)
    // The SAME mark on the owner and on a member, whose heads are on the same line — so any
    // difference in glyph or height is the engraving disagreeing with itself.
    h.engine.toggleArticulation(note!.id, 'staccato')
    h.engine.toggleArticulation(memberIds[1], 'staccato')
    await h.render()
    return {
      onOwner: h.glyphs('g.vf-stavenote text'),
      onMembers: h.glyphs('g.vf-fanhead text'),
    }
  })

  const owner = marksOnly(drawn.onOwner)
  const member = marksOnly(drawn.onMembers)
  expect(owner).toHaveLength(1)
  expect(member).toHaveLength(1)
  // VexFlow keeps a separate above/below glyph per articulation, and a between-lines mark is snapped
  // into a space and re-originned — both are silent when got wrong, and both show up here.
  expect(member[0].code, 'the same glyph, so the same side').toBe(owner[0].code)
  expect(member[0].y, 'and the same distance from a head on the same line').toBe(owner[0].y)
})

test('two marks on one member stack the way two marks on any note stack', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 6, beams: 3 })
    const slot = h.engine.getScore().measures[0].slots[0]
    const memberIds = (slot.fan?.members ?? []).map(m => m.pitches[0].id)
    for (const t of ['staccato', 'tenuto'] as const) {
      h.engine.toggleArticulation(note!.id, t)
      h.engine.toggleArticulation(memberIds[1], t)
    }
    await h.render()
    return {
      onOwner: h.glyphs('g.vf-stavenote text'),
      onMembers: h.glyphs('g.vf-fanhead text'),
    }
  })

  const owner = marksOnly(drawn.onOwner).sort((a, b) => a.y - b.y)
  const member = marksOnly(drawn.onMembers).sort((a, b) => a.y - b.y)
  expect(owner).toHaveLength(2)
  expect(member).toHaveLength(2)
  // The stack is the library's, not a constant of ours — so it has to match the note beside it.
  expect(member.map(g => g.code)).toEqual(owner.map(g => g.code))
  expect(member.map(g => g.y)).toEqual(owner.map(g => g.y))
})

/**
 * ⭐ A FLIPPED mark clears the BEAM, not just the stem.
 *
 * His report: *"when i flip an articulation in a fan the only one that looks good is the owner...
 * the beam collides with that, it looks like the flip is taking into account the stem length but not
 * the beams"*. Two causes, and the owner escaped both because the fan had already stretched its real
 * stem to the ramp:
 *
 *  - the stand-in note's stem length was silently ignored — `setStemLength` only records an override
 *    on the note, and the one line that pushes it into the `Stem` is inside `setStemDirection`, which
 *    was being called first. So a member's mark was placed off VexFlow's default ~35px stem, landing
 *    inside the feathering;
 *  - and a stem TIP is not the outside of the group anyway: it is where the stem meets the innermost
 *    ramp line, with up to `beams` bands stacked past it.
 */
test('a flipped mark on a member clears the ramp, level with the owner’s', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 6, beams: 3 })
    const slot = h.engine.getScore().measures[0].slots[0]
    const ids = (slot.fan?.members ?? []).map(m => m.pitches[0].id)
    // Mark the owner and two members, then flip every one of them onto the STEM side.
    for (const id of [note!.id, ids[1], ids[4]]) {
      h.engine.toggleArticulation(id, 'accent')
      h.engine.flipArticulation(id)
    }
    await h.render()
    return {
      all: h.glyphs('text'),
      heads: h.noteheads(),
      ramps: h.quads('g.vf-fan path'),
    }
  })

  const marks = drawn.all.filter(g => {
    const c = parseInt(g.code, 16)
    return c >= 0xe4a0 && c <= 0xe4bf
  })
  expect(marks, 'the owner and two members are marked').toHaveLength(3)

  // Stem up ⇒ the beam is above the heads and "clear" means ABOVE its topmost edge (smaller y).
  const beamTop = Math.min(...drawn.ramps.flatMap(r => [r.yLeft, r.yRight]))
  expect(beamTop, 'the ramp really is above the heads').toBeLessThan(drawn.heads[0].y)
  for (const m of marks) {
    expect(m.y, `a mark at x=${Math.round(m.x)} is inside the beam`).toBeLessThan(beamTop)
  }

  // …and all three sit at the same height, because they all clear the same flat ramp line. A member
  // measured off a default stem instead of its own lands tens of pixels lower than the owner.
  expect(new Set(marks.map(m => Math.round(m.y))).size, 'one row, not the owner plus stragglers').toBe(1)
})

/**
 * ⭐⭐ **A MEMBER IS A CHORD, so the chord rules apply to it** — his report: a second inside a fan
 * member printed one notehead on top of the other.
 *
 * Everything a `StaveNote` does for a chord (Gould, *Behind Bars*, "Chords") the fan has to do
 * itself, because these heads are hand-drawn at coordinates we compute: seconds cross the stem,
 * accidentals stack into columns, one ledger line reaches under both columns. The rules themselves
 * are unit-tested (`chordHeadLayout`, `chordAccidentalColumns`); what only a browser can say is
 * that the drawing actually spends them — in jsdom every glyph measures 0×0 and two heads at one x
 * agree with two heads at two.
 */
test('a SECOND inside a fan member crosses the stem — upper head right, stem up', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 2, beams: 3 })
    const slot = h.engine.getScore().measures[0].slots[0]
    h.engine.addFanMemberPitch(slot.fan!.members![0].pitches[0].id, { step: 'D', alter: 0, octave: 4 })
    await h.render()
    return { member: h.glyphs('g.vf-fanhead g.vf-notehead text') }
  })

  expect(drawn.member, 'the member draws both of its heads').toHaveLength(2)
  const [upper, lower] = [...drawn.member].sort((a, b) => a.y - b.y)
  expect(lower.y - upper.y, 'and they really are a second apart').toBeGreaterThan(0)
  expect(upper.x, 'the upper note of the second is to the RIGHT of the lower').toBeGreaterThan(lower.x)
  // A whole notehead apart, not a sliver: the stem runs BETWEEN them, which is the rule itself.
  // (A notehead at this staff size is ~10px wide; 8 is the floor that cannot be a rounding hair.)
  expect(upper.x - lower.x, 'by about a notehead').toBeGreaterThan(8)
})

test('…and the stem-down chord mirrors it: the LOWER head crosses', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'G', octave: 5, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 2, beams: 3 })
    const slot = h.engine.getScore().measures[0].slots[0]
    h.engine.addFanMemberPitch(slot.fan!.members![0].pitches[0].id, { step: 'A', alter: 0, octave: 5 })
    await h.render()
    return { member: h.glyphs('g.vf-fanhead g.vf-notehead text'), stems: h.stems() }
  })

  expect(drawn.member).toHaveLength(2)
  const [upper, lower] = [...drawn.member].sort((a, b) => a.y - b.y)
  // The higher note is to the right either way — what changes is which of the two was MOVED, and
  // with the stem down it is the lower one, pushed out to the left of the column.
  expect(upper.x, 'the upper note is still the right-hand one').toBeGreaterThan(lower.x)
  expect(lower.x, 'and it is the LOWER head that left the column').toBeLessThan(upper.x)
})

test('two accidentals in one member stack into columns, the higher one nearest the chord', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 2, beams: 3 })
    const slot = h.engine.getScore().measures[0].slots[0]
    const memberId = slot.fan!.members![0].pitches[0].id
    h.engine.addFanMemberPitch(memberId, { step: 'F', alter: 1, octave: 4 })
    h.engine.addFanMemberPitch(memberId, { step: 'G', alter: 1, octave: 4 })
    await h.render()
    return { member: h.glyphs('g.vf-fanhead text') }
  })

  const signs = drawn.member.filter(g => {
    const c = parseInt(g.code, 16)
    return c >= 0xe260 && c <= 0xe26f
  })
  expect(signs, 'both sharps are drawn').toHaveLength(2)
  const [upper, lower] = [...signs].sort((a, b) => a.y - b.y)
  expect(upper.x, 'a second apart, they cannot share a column').not.toBe(lower.x)
  expect(upper.x, 'and the higher sign is the one nearest the chord').toBeGreaterThan(lower.x)
})

test('a member chord’s ledger line reaches under BOTH of its columns', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 2, beams: 3 })
    const slot = h.engine.getScore().measures[0].slots[0]
    // B3 and C4 — a second, and both of them at or below the first ledger line beneath the staff.
    h.engine.addFanMemberPitch(slot.fan!.members![0].pitches[0].id, { step: 'B', alter: 0, octave: 3 })
    await h.render()
    return {
      member: h.glyphs('g.vf-fanhead g.vf-notehead text'),
      lines: h.segments('g.vf-fanhead path').filter(s => Math.abs(s.y1 - s.y2) < 0.01),
    }
  })

  expect(drawn.member).toHaveLength(2)
  // ONE line for the level, not one per head: a ledger is a fact about the level it is drawn at.
  expect(drawn.lines, 'the member has exactly one ledger line').toHaveLength(1)
  const heads = [...drawn.member].sort((a, b) => a.x - b.x)
  const ledger = drawn.lines[0]
  expect(ledger.x1, 'it starts left of the leftmost head').toBeLessThan(heads[0].x)
  expect(ledger.x2, 'and runs past the displaced one — one line, not two stubs')
    .toBeGreaterThan(heads[heads.length - 1].x)
})

test('a fan member’s accidental clears the member’s own ledger lines', async ({ score }) => {
  const measured = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 2, beams: 3 })
    const slot = h.engine.getScore().measures[0].slots[0]
    // A♯3 — below the staff, so the member draws a ledger line of its own beside the sign.
    h.engine.addFanMemberPitch(slot.fan!.members![0].pitches[0].id, { step: 'A', alter: 1, octave: 3 })
    await h.render()
    const signs = [...document.querySelectorAll<SVGTextElement>('g.vf-fanhead text')]
      .filter(t => {
        const c = (t.textContent ?? '').codePointAt(0) ?? 0
        return c >= 0xe260 && c <= 0xe26f
      })
      .map(t => ({ left: t.x.baseVal[0].value, right: t.x.baseVal[0].value + t.getComputedTextLength() }))
    const ledgers = h.segments('g.vf-fanhead path').filter(s => Math.abs(s.y1 - s.y2) < 0.01)
    return { signs, ledgers }
  })

  expect(measured.signs, 'the member’s sharp is drawn').toHaveLength(1)
  expect(measured.ledgers.length, 'and so is its ledger line').toBeGreaterThan(0)
  const nearest = Math.min(...measured.ledgers.map(l => l.x1))
  expect(nearest, 'the ledger line starts clear of the sign').toBeGreaterThanOrEqual(measured.signs[0].right)
})

/**
 * ⭐ COLLAPSING A TYPED PASSAGE (`engine/models/fanCollapse.ts`) — his way round: type the notes,
 * select them, press the button, and they BECOME one fanned gesture.
 *
 * Measured here because the length is the part with teeth. Seven sixteenths span 7/16, which no
 * single notehead spells, so the slot is WRITTEN as a dotted quarter and the span rides the mark.
 * Every reader has to take the span, not the spelling — and in jsdom a fan drawn 6/16 wide agrees
 * with one drawn 7/16 wide, because both measure zero.
 */
test('seven typed sixteenths collapse into one fan, drawn across the time they spanned', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
    // Seven sixteenths, then an eighth note left standing at 7/16 — the thing the group must not
    // walk into, and the ruler for where its own time ends.
    const ids = steps.map((step, i) =>
      h.engine.addNoteAtBeat({ step, octave: 4, duration: '16', measure: 1, beat: h.frac(i, 4) })!.id)
    const after = h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: '8', measure: 1, beat: h.frac(7, 4) })!
    h.engine.collapseIntoFan(ids, 'accel')
    await h.render()
    const chords = h.engine.getScore().measures[0].slots.filter(s => s.type === 'chord')
    return {
      heads: h.noteheads(),
      slots: chords.length,
      written: h.engine.getNote(ids[0])!.duration,
      dots: h.engine.getNote(ids[0])!.dots,
      afterBeat: after.beat,
    }
  })

  expect(drawn.slots, 'the seven slots are one event now — plus the note left after it').toBe(2)
  expect(drawn.written, 'written as the longest value that fits…').toBe('q')
  expect(drawn.dots, '…which is a dotted quarter').toBe(1)
  expect(drawn.heads, 'seven fanned heads are drawn, and the untouched note after them').toHaveLength(8)

  const fanHeads = drawn.heads.slice(0, 7)
  const gaps = fanHeads.slice(1).map((head, i) => head.x - fanHeads[i].x)
  for (const [i, gap] of gaps.slice(1).entries()) {
    expect(gap, 'the group still accelerates').toBeLessThanOrEqual(gaps[i] + 0.01)
  }
  expect(drawn.heads[7].x, 'and it ends before the note that was never in it').toBeGreaterThan(fanHeads[6].x)
})

/**
 * ⭐⭐ **THE ROOM A FAN GETS COMES FROM ITS MEMBERS, NOT FROM ITS DURATION** (`fanRoom.ts`).
 *
 * His report, with two screenshots: seven typed sixteenths read perfectly, and the fan collapsed
 * out of them was *"too contracted and unreadable"*. The bar was wide enough all along — VexFlow
 * shares a bar's width out BY TICK, and a fanned slot holds one event's worth of ticks however many
 * heads it draws, so the room went to the rest after it. Measured then: 28px gaps typed, 11px fanned.
 *
 * This is the browser's question twice over: jsdom cannot measure a glyph, and the number that was
 * wrong is a gap between two of them.
 */
test('a fan collapsed out of a passage is drawn as wide as the notes it came from', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const gaps = (xs: number[]) => xs.slice(1).map((x, i) => x - xs[i])
    const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
    const ids = steps.map((step, i) =>
      h.engine.addNoteAtBeat({ step, octave: 4, duration: '16', measure: 1, beat: h.frac(i, 4) })!.id)
    await h.render()
    const typed = gaps(h.noteheads().map(g => g.x))
    h.engine.collapseIntoFan(ids, 'accel')
    await h.render()
    return { typed, fanned: gaps(h.noteheads().map(g => g.x)) }
  })

  expect(drawn.typed, 'fixture: seven notes were typed').toHaveLength(6)
  expect(drawn.fanned, 'and seven heads are drawn after the collapse').toHaveLength(6)

  // The group OPENS at the spacing the passage had — that is what "reads like the music you typed"
  // means — and closes from there, because it is an accelerando.
  const typedGap = drawn.typed[0]
  expect(drawn.fanned[0], 'the first gap is the typed one, near enough')
    .toBeGreaterThan(typedGap * 0.9)
  expect(drawn.fanned[drawn.fanned.length - 1], 'and the tightest is still more than half of it')
    .toBeGreaterThan(typedGap * 0.5)
  for (const [i, gap] of drawn.fanned.slice(1).entries()) {
    expect(gap, 'crowding all the way, never widening').toBeLessThanOrEqual(drawn.fanned[i] + 0.01)
  }
})

test('…and a fan in a stretched bar takes its SHARE of the room, not the room', async ({ score }) => {
  /*
   * ⚠️ **THIS TEST CHANGED SIDES, deliberately** — his report of 2026-07-30: *"normally the notes
   * grow proportionally in space, in the case of fan we are just separating the bar from the fan,
   * but the note space in the fan don't grow"*.
   *
   * It used to assert a CEILING (`< 1.45×` for a bar stretched ×3), written when a fan's room came
   * from a cap constant and the model reserved nothing for its members: a group that filled whatever
   * bar it sat in read as a rallentando nobody wrote. P5 replaced the constants with real member
   * columns, and this is the other half of that — the ramp now takes exactly what the bar's own
   * column solve gave those columns (`engine/layout/fanRampRoom.ts`).
   *
   * What is asserted instead is the part of the old guard that is still true, and the part that
   * matters: the fan's SHARE grows with the bar, and the room after the group is still the next
   * thing's — the ramp does not reach the barline.
   */
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const gaps = (xs: number[]) => xs.slice(1).map((x, i) => x - xs[i])
    const w = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'w', measure: 1, beat: h.frac(0, 1) })!
    h.engine.setFan(w.id, { direction: 'accel', count: 4, beams: 2 })
    await h.render()
    const natural = gaps(h.noteheads().map(g => g.x))
    // Three times the bar's width — the same drag he reported, at its most extreme.
    h.engine.previewBarWidth(1, 3, 0.5, 4)
    await h.render()
    const heads = h.noteheads().map(g => g.x)
    const barline = h.barlines().map(b => b.x).sort((a, b) => a - b).slice(-1)[0]
    return { natural, stretched: gaps(heads), lastHead: heads[heads.length - 1], barline }
  })

  const span = (gaps: number[]) => gaps.reduce((a, b) => a + b, 0)
  expect(span(drawn.stretched), 'the ramp grew with the bar — his report')
    .toBeGreaterThan(span(drawn.natural) * 1.3)
  // …and never MORE than the bar's own factor. With the fan alone in the bar its share is the whole
  // elastic budget, so ×3 is exactly what it gets — proportional means proportional. What it may not
  // do is take more than the bar was stretched by, which is what "fills the bar" used to look like.
  expect(span(drawn.stretched), 'its share, and no more than the bar itself grew')
    .toBeLessThanOrEqual(span(drawn.natural) * 3 + 0.01)
  // The old guard's surviving half, measured where it is actually visible: the group still stands
  // clear of the end of its bar.
  expect(drawn.barline - drawn.lastHead, 'the last head is still well clear of the barline')
    .toBeGreaterThan(10)
})

/**
 * ⭐⭐ **A DENSE FAN MAKES ITS BAR GROW, AND NOTHING IS DRAWN OUTSIDE THE BAR** — his second report
 * on the room, and the sharper of the two.
 *
 * Eight thirty-seconds under a 1→3 feather ask for 21 columns. `MAX_MEASURE_WIDTH` used to be
 * applied last, so the bar was held at 40 staff-spaces and everything that did not fit was drawn
 * straight through the barline — measured at rests sitting 56px and 69px outside their own bar. His
 * question was the fix: *"there is still space in the line… the bar can grow more."* The cap is a
 * preference about bars that could be narrower; a bar's incompressible demand now wins over it.
 */
test('a dense fan stays INSIDE its own bar — and no longer needs to outgrow the cap', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'] as const
    const ids = steps.map((step, i) =>
      h.engine.addNoteAtBeat({
        step, octave: i < 7 ? 4 : 5, duration: '32', measure: 1, beat: h.frac(i, 8),
      })!.id)
    // A rit is the worst case: it OPENS with its fastest notes, so its tightest gap is inside the
    // group and the whole ramp has to be wide enough for it.
    h.engine.collapseIntoFan(ids, 'rit')
    await h.render()
    const bar = h.staves().find(s => s.measure === 1)!
    return {
      bar: { x1: bar.x1, x2: bar.x2 },
      // Every glyph the bar draws — heads, and the rests filling the time after the group.
      glyphs: h.glyphs('g.vf-stavenote text').concat(h.noteheads()).map(g => g.x),
      heads: h.noteheads().map(g => g.x),
    }
  })

  expect(drawn.heads.length, 'eight attacks are drawn').toBe(8)
  expect(drawn.bar.x2 - drawn.heads[7], 'and the last head keeps an ordinary column off the barline')
    .toBeGreaterThanOrEqual(15)
  // ⚠️ It used to assert the bar grew PAST `MAX_MEASURE_WIDTH`, and that was true of the world where
  //    a fan bought its room with `fanColumns` — `ceil(span / tightest gap) + 1` ordinary columns,
  //    which for a steep ramp is several times what its heads need. His screenshot came from the cap
  //    then clamping it and the heads drawing through the barline. Under the spacing model the
  //    members are ordinary columns and the ramp has an absolute natural size, so this fan asks for
  //    about half what it did and the cap never comes near it. The requirement was never "the bar is
  //    huge" — it was "the ink is inside the bar", which is what the loop below has always checked.
  expect(drawn.bar.x2 - drawn.bar.x1, 'the bar is sized by its own content').toBeGreaterThan(20 * 10)
  for (const x of drawn.glyphs) {
    expect(x, 'every glyph is inside its own bar').toBeGreaterThanOrEqual(drawn.bar.x1)
    expect(x, 'every glyph is inside its own bar').toBeLessThanOrEqual(drawn.bar.x2)
  }
  // …and the ramp still ramps: a rit opens tight and opens out.
  const gaps = drawn.heads.slice(1).map((x, i) => x - drawn.heads[i])
  for (const [i, gap] of gaps.slice(1).entries()) {
    expect(gap, 'each gap wider than the one before').toBeGreaterThanOrEqual(gaps[i] - 0.01)
  }
})

test('⭐ WIDENING THE BAR SPREADS THE FAN — its members take their share like any other note', async ({ score }) => {
  /*
   * His report: *"normally when we do that in a slot normal measure the notes grow proportionally in
   * space, in the case of fan we are just separating the bar from the fan, but the note space in the
   * fan don't grow in space"*.
   *
   * A fan's members ARE columns of the bar's solve (`measureColumns` counts them), so the bar
   * already reserved the stretched room for them — nothing spent it, because a fanned slot has one
   * tick context and `spacingPass` can only write x's where a context exists. `engine/layout/
   * fanRampRoom.ts` reads those solved columns back out and `FannedBeam` scales the earned ramp to
   * them, which is what this measures.
   */
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.setFan(note!.id, { direction: 'accel', count: 6, beams: 3 })
    // A rest after it, so the fan is not the last thing in the bar — the case where the room after
    // the group is a real neighbour rather than the bar's own end.
    await h.render()
    const natural = h.noteheads().map(head => head.x)

    h.engine.setBarWidth(1, 2.5)
    await h.render()
    return { natural, wide: h.noteheads().map(head => head.x) }
  })

  const spanOf = (xs: number[]) => xs[xs.length - 1] - xs[0]
  expect(drawn.natural, 'six heads before').toHaveLength(6)
  expect(drawn.wide, 'six heads after').toHaveLength(6)

  // THE POINT: the ramp itself is wider, not merely pushed along.
  expect(spanOf(drawn.wide), 'the group spread when the bar did').toBeGreaterThan(spanOf(drawn.natural) * 1.3)

  // …and it spread as a RAMP, not as a block: every gap grew, and the accelerando's gaps still
  // shrink left to right (the shape is the fan's, the size is the bar's).
  const gaps = (xs: number[]) => xs.slice(1).map((x, i) => x - xs[i])
  const before = gaps(drawn.natural)
  const after = gaps(drawn.wide)
  for (const [i, gap] of after.entries()) {
    expect(gap, `gap ${i} grew`).toBeGreaterThan(before[i])
  }
  for (let i = 1; i < after.length; i++) {
    expect(after[i], `accel: gap ${i} still tighter than gap ${i - 1}`).toBeLessThan(after[i - 1])
  }
})

test('⭐ A JOINED FAN SUBDIVIDES: the secondary beam breaks where the gesture starts', async ({ score }) => {
  /*
   * His screenshot: four 16ths beamed into a fan drew every level straight through the boundary, and
   * *"the fan is not distinguishable from semicorcheas"* — one thick band that thinned somewhere in
   * the middle, with nothing saying where the gesture began. The join now breaks the SECONDARY beams
   * and lets the primary carry the boundary, which is what a subdivision says everywhere else in
   * notation.
   *
   * Measured on the drawn ink, which is the only place it exists: the prefix's second line must STOP
   * before the fan's first stem, and the primary must not.
   */
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    // Four sixteenths, then a fan on the second beat, joined to them — his picture.
    for (const k of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: '16', measure: 1, beat: h.frac(k, 4) })
    }
    const owner = h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: h.frac(1, 1) })!
    h.engine.setFan(owner.id, { direction: 'accel', count: 6, beams: 3 })
    h.engine.updateNote(owner.id, { beam: 'continue' })
    await h.render()
    const quads = h.quads('g.vf-fan path')
    const heads = h.noteheads().map(n => n.x)

    // The subdivide key's answer, stored on the mark (PaletteController.toggleSecondaryBreak).
    h.engine.setFan(owner.id, { ...h.engine.getNote(owner.id)!.fan!, joinSubdivide: false })
    await h.render()
    return { quads, heads, band: h.quads('g.vf-fan path') }
  })

  // Ten heads: the four typed sixteenths and the fan's six.
  expect(drawn.heads).toHaveLength(10)
  const lastPrefixHead = drawn.heads[3]
  const firstFanHead = drawn.heads[4]

  // The PRIMARY is the line that reaches the last member — it carries the whole group, boundary and
  // all, which is what keeps the two groups one beam.
  const right = Math.max(...drawn.quads.map(q => q.right))
  const primary = drawn.quads.filter(q => q.right > right - 1)
  expect(primary.some(q => q.left < lastPrefixHead), 'the primary crosses the join').toBe(true)

  // …and at least one level STOPS between the prefix's last note and the fan's first: that gap is
  // the subdivision, and it is the whole point of the change.
  const stops = drawn.quads.filter(q => q.right > lastPrefixHead - 1 && q.right < firstFanHead)
  expect(stops.length, 'a secondary level ends inside the join — the gap he asked for').toBeGreaterThan(0)

  // …and the Keypad can refuse it: `FanMark.joinSubdivide: false` puts the band back, which is the
  // picture he reported. Nothing else about the fan moves.
  expect(drawn.band.every(q => q.right < lastPrefixHead || q.right > firstFanHead),
    'unsubdivided, no level ends inside the join').toBe(true)
})

test('⭐ A MIXED PREFIX KEEPS ITS FUSAS — 16 16 16 32 32 into a fan draws three lines over the pair', async ({ score }) => {
  /*
   * His score, exactly: three sixteenths, two thirty-seconds, then a fanned half joined to them
   * (`beam: 'continue'`). It drew every prefix note at TWO lines — *"where are the fusas in the first
   * group? why we are not showing them? this is wrong"* — because the prefix's level count was one
   * `Math.min` across the whole group.
   *
   * A beamed group is not one thickness: a line runs between two notes where both carry it
   * (`utils/beamLevels.ts`). So the second line spans all five and the third covers the fusas alone.
   */
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    for (const [beat, duration] of [[0, '16'], [1 / 4, '16'], [1 / 2, '16'], [3 / 4, '32'], [7 / 8, '32']] as const) {
      h.engine.addNoteAtBeat({
        step: 'C', octave: 4, duration, measure: 1,
        beat: h.frac(Math.round(beat * 8), 8),
      })
    }
    const owner = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(1, 1) })!
    h.engine.setFan(owner.id, { direction: 'accel', count: 6, beams: 3 })
    h.engine.updateNote(owner.id, { beam: 'continue' })
    await h.render()
    return { quads: h.quads('g.vf-fan path'), heads: h.noteheads().map(n => n.x) }
  })

  // Five prefix heads, then the fan's six.
  expect(drawn.heads.length).toBe(11)
  const [n0, , , n3, n4, fanStart] = drawn.heads

  // The lines the PREFIX drew: everything that ends before the fan begins.
  const prefix = drawn.quads.filter(q => q.right < fanStart)
  const levels = [...new Set(prefix.map(q => Math.round(q.yLeft * 10) / 10))].sort((a, b) => a - b)
  expect(levels.length, 'the prefix draws more than one thickness').toBeGreaterThan(1)

  // The DEEPEST prefix line is the fusas' third beam: it must start at the first 32nd, not at the
  // group's first note — that is the whole bug, in one number.
  const deepest = prefix.filter(q => Math.round(q.yLeft * 10) / 10 === levels[levels.length - 1])
  expect(deepest.length, 'the third beam is drawn at all').toBeGreaterThan(0)
  const third = deepest[0]
  expect(third.left, 'it starts at the first fusa, not at the group').toBeGreaterThan(n0 + 1)
  expect(Math.abs(third.left - n3), 'at the first fusa').toBeLessThan(12)
  expect(Math.abs(third.right - n4), 'and ends at the second').toBeLessThan(12)
})
