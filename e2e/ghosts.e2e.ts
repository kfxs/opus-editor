import { test, expect } from './fixtures'

/**
 * THE GHOSTS — the translucent previews that follow the cursor, measured in a real browser.
 *
 * They are here because Phase 6a moved ~900 lines of them out of `VexFlowRenderer` into
 * `GhostRenderer`, and Phase 5's net did not cover a single one: every ghost had been verified by
 * eye only. They are also the one family that jsdom cannot check even in principle — most of them
 * decide whether to draw at all by asking `getBBox()` for their own size, which answers `undefined`
 * there, so in a unit test the ghost silently removes itself and returns false.
 *
 * Two things are asserted throughout, and they are the whole contract:
 *  1. the ghost is ON THE PAGE, in its own class-tagged group (a group whose class is not in
 *     `GHOST_GROUP_SELECTOR` is never taken down again);
 *  2. it lands NEAR THE CURSOR — each one parks itself deliberately (left for an accidental, right
 *     for a dot, up for a rest), so the assertion is a bounded distance, not a golden pixel.
 */

/** How far from the cursor a ghost is allowed to sit. Every one of them offsets itself on purpose —
 *  see the "park it clear of the pointer" comments — so this is generous by design. */
const NEAR = 40

/** A cursor position over the first bar, clear of the clef. */
const CURSOR = { x: 200, y: 100 }

test('a cursor ghost is one overlay group, and arming another REPLACES it', async ({ score }) => {
  const seen = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    await h.render()

    h.engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'clef', clef: 'bass' })
    const clef = h.ghosts()
    // The second ghost must take the first down — the reason `ghostOverlay` clears BEFORE it draws.
    h.engine.renderScoreWithToolGhost({ x: 260, y: 100 }, { kind: 'timeSignature', timeSignature: { numerator: 3, denominator: 4 } })
    const timeSig = h.ghosts()
    h.engine.clearGhosts()
    return { clef, timeSig, cleared: h.ghosts() }
  })

  expect(seen.clef, 'the clef ghost, alone').toEqual(['ghost-clef-group'])
  expect(seen.timeSig, 'replaced by the time signature ghost, alone').toEqual(['ghost-timesig-group'])
  expect(seen.cleared, 'and clearGhosts takes it down').toEqual([])
})

test('the NOTE ghost is engraved in the bar it will land in, at the pitch under the cursor', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    await h.render()
    const real = h.noteheads()

    // Hover the third beat's neighbourhood, on the same line as the real note.
    h.engine.renderScoreWithPreview({ x: real[0].x + 80, y: real[0].y }, 'q')
    return {
      real,
      groups: h.ghosts(),
      heads: h.placed('.ghost-note-group text'),
      stems: h.segments('.ghost-note-group g.vf-stem path'),
    }
  })

  expect(drawn.groups, 'the note ghost is its own overlay').toEqual(['ghost-note-group'])
  // Unlike the cursor ghosts, this one is ENGRAVED: it is a real StaveNote on a real stave, so it
  // comes with a stem, and it sits on the staff line the cursor is over rather than at the cursor.
  expect(drawn.heads.length, 'a notehead (plus the rests filling the bar around it)').toBeGreaterThan(0)
  expect(drawn.stems, 'and a stem, because it is a quarter').toHaveLength(1)

  // The ghost head is on the hovered line, and to the RIGHT of the note already in the bar — i.e.
  // it previews where the click will actually put the note, not where the cursor happens to be.
  const head = drawn.heads.find(g => Math.abs(g.y - drawn.real[0].y) < 1)
  expect(head, 'a ghost head on the hovered line').toBeTruthy()
  expect(head!.x, 'later in the bar than the note already there').toBeGreaterThan(drawn.real[0].x)
})

test('the CLEF and REST ghosts draw their glyph at the cursor', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    await h.render()

    h.engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'clef', clef: 'bass' })
    const clef = h.placed('.ghost-clef-group text')
    h.engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'rest', duration: 'h', dots: 0 })
    const rest = h.placed('.ghost-rest-group text')
    return { clef, rest }
  })

  // U+E062 is SMuFL's F clef — the ghost draws the clef it was ARMED with, not the score's.
  expect(drawn.clef.map(g => g.code), 'the bass clef glyph').toEqual(['e062'])
  // A half rest: U+E4E4. A whole rest is the same rectangle at U+E4E3, so this also pins that the
  // ghost answers "how long?" — the one thing a rest IS.
  expect(drawn.rest.map(g => g.code), 'the half rest glyph').toEqual(['e4e4'])

  // Both land at the pointer — read through the group's own transform, which is what moves them.
  for (const glyph of [...drawn.clef, ...drawn.rest]) {
    expect(Math.abs(glyph.x - CURSOR.x)).toBeLessThan(NEAR)
    expect(Math.abs(glyph.y - CURSOR.y)).toBeLessThan(NEAR)
  }
})

test('the ACCIDENTAL, DOT and ARTICULATION ghosts each park clear of the pointer', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    await h.render()

    const at = { x: 200, y: 100 }
    h.engine.renderScoreWithToolGhost(at, { kind: 'accidental', accidental: '#' })
    const accidental = { groups: h.ghosts(), glyphs: h.placed('.vf-ghost-accidental text') }
    h.engine.renderScoreWithToolGhost(at, { kind: 'dot' })
    const dot = { groups: h.ghosts(), glyphs: h.placed('.vf-ghost-dot text') }
    h.engine.renderScoreWithToolGhost(at, { kind: 'articulation', types: ['accent'] })
    const articulation = { groups: h.ghosts(), glyphs: h.placed('.vf-ghost-articulation text') }
    return { accidental, dot, articulation }
  })

  expect(drawn.accidental.groups).toEqual(['vf-ghost-accidental'])
  expect(drawn.dot.groups).toEqual(['vf-ghost-dot'])
  expect(drawn.articulation.groups).toEqual(['vf-ghost-articulation'])

  for (const [name, ghost] of Object.entries(drawn)) {
    expect(ghost.glyphs.length, `${name}: something was drawn`).toBeGreaterThan(0)
    for (const glyph of ghost.glyphs) {
      expect(Math.abs(glyph.x - CURSOR.x), `${name}: near the cursor in x`).toBeLessThan(NEAR)
      expect(Math.abs(glyph.y - CURSOR.y), `${name}: near the cursor in y`).toBeLessThan(NEAR)
    }
  }

  // An accidental is engraved to the LEFT of its notehead and a dot to the RIGHT, and each ghost
  // parks on that side — so the preview reads as where the mark will land. This RELATION is the
  // assertion; the offsets themselves are tunable.
  expect(drawn.accidental.glyphs[0].x, 'the accidental parks left of the pointer')
    .toBeLessThan(drawn.dot.glyphs[0].x)
})

test('the TIE ghost draws a real arc, and the TEMPO ghost its own words', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    await h.render()

    h.engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'tie' })
    const tie = { groups: h.ghosts(), curves: h.paths('.vf-ghost-tie path') }
    h.engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'tempo', mark: { id: 't1', measure: 1, beat: h.frac(0, 1), text: 'Allegro' } })
    const tempo = { groups: h.ghosts(), texts: h.texts('.vf-ghost-tempo text') }
    return { tie, tempo }
  })

  expect(drawn.tie.groups).toEqual(['vf-ghost-tie'])
  expect(drawn.tie.curves.length, 'the tie ghost is a filled curve, not a glyph').toBeGreaterThan(0)
  // A tie is a CURVE: its path has to carry a bezier, or what is drawn is a straight line.
  expect(drawn.tie.curves.some(d => d.includes('C')), 'and it bows').toBe(true)

  expect(drawn.tempo.groups).toEqual(['vf-ghost-tempo'])
  expect(drawn.tempo.texts.join(''), 'the tempo ghost previews the mark’s own text').toContain('Allegro')
})

test('the FEATHER ghost is a bare notehead — dot included, stem and flag dropped', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    await h.render()

    const at = (duration: 'h' | '8', dots: number) => {
      h.engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'fan', duration, dots })
      return {
        groups: h.ghosts(),
        glyphs: h.placed('.ghost-fan-group text'),
        stems: h.segments('.ghost-fan-group g.vf-stem path'),
      }
    }
    return { plain: at('h', 0), dotted: at('h', 1), eighth: at('8', 0) }
  })

  expect(drawn.plain.groups).toEqual(['ghost-fan-group'])
  // ONE glyph and one only: the head. A stem would be a path (asserted empty), a flag a second text.
  expect(drawn.plain.glyphs.length, 'the head, alone').toBe(1)
  expect(drawn.plain.stems, 'no stem travels with it').toHaveLength(0)
  expect(drawn.eighth.glyphs.length, 'an eighth is still one glyph — the flag is dropped too').toBe(1)

  // The dotted value draws the SAME head plus its augmentation dot, to the RIGHT of it.
  expect(drawn.dotted.glyphs.length, 'head + dot').toBe(2)
  expect(drawn.dotted.glyphs[0].code, 'the head is the same glyph as the undotted one')
    .toBe(drawn.plain.glyphs[0].code)
  expect(drawn.dotted.glyphs[1].x).toBeGreaterThan(drawn.dotted.glyphs[0].x)

  // ⭐ THE HEAD is what has to sit at the pointer — it is the pitch the click will place. A dot
  // riding along must not push it away.
  for (const [name, ghost] of Object.entries(drawn)) {
    const head = ghost.glyphs[0]
    expect(Math.abs(head.x - CURSOR.x), `${name}: the head is near the cursor in x`).toBeLessThan(NEAR)
    expect(Math.abs(head.y - CURSOR.y), `${name}: the head is near the cursor in y`).toBeLessThan(NEAR)
  }
})

test('⭐ the FEATHER ghost keeps its SIZE across a stamp — it is a notehead, not a speck', async ({ score }) => {
  /*
   * The regression this pins, in his words: *"the note was so tiny that it seems a dot"*.
   *
   * A glyph's `<text>` states only the attributes its enclosing `<g>` does not already state
   * (`SVGContext.fillText` dedupes against `openGroup`'s stamped attributes), so after a score
   * render has left the context at glyph size the head's own node carries NO `font-size` and
   * inherits it from the group VexFlow drew it in. The ghost therefore has to PRUNE that group
   * rather than lift the head out of it — lifting dropped the head to the SVG root's 10pt, a
   * quarter of the size, which beside its augmentation dot read as a lone dot.
   */
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const ghost = () => {
      h.engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'fan', duration: 'h', dots: 1 })
      return {
        groups: h.ghosts(),
        glyphs: h.placed('.ghost-fan-group text'),
        head: h.inkSizes('.ghost-fan-group .vf-notehead text')[0],
      }
    }
    const before = ghost()

    // What the stamp writes: a note of the dialog's value carrying the fan. The RENDER is the part
    // that matters — it is what leaves the draw context at glyph size for the next ghost.
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', dots: 1, measure: 1, beat: h.frac(0, 1) })!
    h.engine.setFan(note.id, { direction: 'accel', count: 6, beams: 3 })
    await h.render()
    const scoreHead = h.inkSizes('.vf-stavenote .vf-notehead text')[0]

    return { before, after: ghost(), scoreHead }
  })

  expect(drawn.after.groups, 'still one fan-ghost group').toEqual(['ghost-fan-group'])
  expect(drawn.after.glyphs.length, 'still head + dot').toBe(2)
  expect(drawn.after.glyphs.map(g => g.code), 'the same two glyphs as before the stamp')
    .toEqual(drawn.before.glyphs.map(g => g.code))

  // THE SIZE, which is what broke: the same before and after, and the same as the score's own head.
  expect(drawn.after.head.width, 'the head did not shrink across the stamp')
    .toBeCloseTo(drawn.before.head.width, 0)
  expect(drawn.after.head.width, 'and it is a notehead, the size the score draws one')
    .toBeGreaterThan(drawn.scoreHead.width * 0.8)
})
