import { test } from './fixtures'
test('probe', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    // HIS score's shape: TWO staves, 64 bars, notes only in bars 3-8, a pedal at bar 3 of length 20
    // (its lift therefore lands on bar 7's barline).
    h.engine.addStaffBelow(0)
    for (let m = 2; m <= 64; m++) h.engine.addMeasure()
    for (const m of [3, 4, 6, 7, 8]) {
      for (const beat of [0, 1, 2, 3]) {
        h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: m, beat: h.frac(beat, 1) })
      }
    }
    const pedal = h.engine.addPedal(3, { beat: h.frac(0, 1), length: h.frac(16, 1) })!
    await h.render()

    const registry = h.engine.getElementRegistry()
    const top = (m: number) => registry.getStaffGeometry(m, 0)?.lineYPositions[0] ?? null
    const systems: Record<string, number[]> = {}
    for (let m = 1; m <= 12; m++) {
      const t = String(top(m))
      ;(systems[t] ??= []).push(m)
    }

    // Replicate `pedalLane.pedalLiftX` + `markBreakWrap.breakCrossing`'s arithmetic with engine reads.
    const liftX = (m: number, beat: number) => {
      const onsets: number[] = []
      for (const el of [...registry.getByType('note'), ...registry.getByType('rest')]) {
        if (!el.id) continue
        const note = h.engine.getNote(el.id)
        if (!note || (note.staff ?? 0) !== 0 || note.measure !== m) continue
        if (note.beat.num / note.beat.den >= beat) onsets.push(el.bbox.x)
      }
      if (onsets.length) return Math.min(...onsets)
      const g = registry.getStaffGeometry(m, 0)
      return g ? g.noteEndX - 0.4 * g.lineSpacing : null
    }

    const lift = h.engine.pedalLiftSlot(pedal.id)
    const next = h.engine.nextPedalLift(pedal.id, 1)
    return {
      systems,
      lift: lift && { m: lift.measure, b: `${lift.beat.num}/${lift.beat.den}` },
      next: next && { m: next.measure, b: `${next.beat.num}/${next.beat.den}` },
      topHere: lift ? top(lift.measure) : null,
      topThere: next ? top(next.measure) : null,
      geomHere: lift ? registry.getStaffGeometry(lift.measure, 0) : null,
      geomThere: next ? registry.getStaffGeometry(next.measure, 0) : null,
      pedalBoxes: registry.getByType('pedal').filter(e => e.id === pedal.id)
        .map(e => ({ sign: e.pedalSign, m: e.measure, x: Math.round(e.bbox.x) })),
      anchorX: lift ? liftX(lift.measure, lift.beat.num / lift.beat.den) : null,
      stopX: next ? liftX(next.measure, next.beat.num / next.beat.den) : null,
    }
  })
  console.log(JSON.stringify({
    systems: out.systems, lift: out.lift, next: out.next,
    topHere: out.topHere, topThere: out.topThere,
    hereEndX: out.geomHere?.noteEndX, thereStartX: out.geomThere?.noteStartX,
    boxes: out.pedalBoxes,
    anchorX: out.anchorX, stopX: out.stopX,
    ss: out.geomHere?.lineSpacing,
    toEdgeSs: out.anchorX != null && out.geomHere
      ? ((out.geomHere.noteEndX - out.anchorX) / out.geomHere.lineSpacing).toFixed(2) : null,
  }, null, 1))
})
