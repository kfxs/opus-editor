import { test } from './fixtures'
test('probe', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    // HIS score: four quarters, a cresc from beat 0 covering 3, the mark at beat 1.
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(0, 1), length: h.frac(3, 1) })
    const dyn = h.engine.addDynamic(1, { beat: h.frac(1, 1), text: '' })!
    await h.render()
    const drawn = () => h.segments('g.vf-hairpin path').map(a => [Math.round(a.x1), Math.round(a.x2)])
    const before = drawn()
    h.engine.setSuppressedDynamicId(dyn.id)
    await h.render()
    const held = drawn()
    h.engine.setSuppressedDynamicId(dyn.id, 68.5)
    await h.render()
    const typed = drawn()
    const st = h.staves()[0]
    return { before, held, typed, sp: (st.bottom - st.top) / 4 }
  })
  console.log(JSON.stringify(out))
})
