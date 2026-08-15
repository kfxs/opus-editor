import { test, expect } from './fixtures'

/**
 * TIES — WHICH WAY THEY BOW, measured on drawn ink.
 *
 * ⚠️ **The browser half of `rendering/tieDirection.ts`.** The rule itself is pure and unit-tested
 * beside the module; what only a browser can answer is whether the two things it is handed are
 * real — the stems VexFlow actually RESOLVED (beaming forces a whole group, so a note's natural
 * direction and its drawn one differ) and the clef in force (a bare `new StaveNote(...)` reports
 * stem direction `1` for every pitch, so jsdom would agree with itself here whatever the rule said).
 *
 * Both tests below fail against the rule we had until 2026-08-15, which compared every note to
 * TREBLE's middle line and never looked at a stem at all.
 */

interface TieSpec {
  clef?: 'treble' | 'bass' | 'alto' | 'tenor'
  /** Notes into measure 1, in order; `beat` is [numerator, denominator]. */
  notes: { step: string; octave: number; duration: string; beat: [number, number] }[]
  /** Index into `notes` of the note the tie starts from (it ties to the next of that pitch). */
  tieFrom: number
}

/** Build one bar, tie one note, and report the drawn tie's ink against the notehead it springs from. */
async function drawTie(score: import('@playwright/test').Page, spec: TieSpec) {
  return score.evaluate(async (spec: TieSpec) => {
    const h = window.__h
    if (spec.clef) h.engine.setClef(1, spec.clef as 'bass')
    const ids = spec.notes.map(n => h.engine.addNoteAtBeat({
      step: n.step, octave: n.octave, duration: n.duration as 'q',
      measure: 1, beat: h.frac(n.beat[0], n.beat[1]),
    })!.id)
    h.engine.toggleTie(ids[spec.tieFrom])
    await h.render()

    const d = [...document.querySelectorAll('g.vf-tie path')]
      .map(p => p.getAttribute('d') ?? '').join(' ')
    const ys = [...d.matchAll(/-?\d+(?:\.\d+)?\s+(-?\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]))
    const head = h.noteheads()[spec.tieFrom]
    const stem = h.stems()[spec.tieFrom]   // stems come back sorted by x, as the heads do
    return {
      headY: head.y,
      tieMinY: Math.min(...ys),
      tieMaxY: Math.max(...ys),
      // A stem that reaches ABOVE its notehead points up; one that hangs below points down.
      stemPointsDown: stem ? Math.max(stem.y1, stem.y2) > head.y : undefined,
    }
  }, spec)
}

/** UP = the arc bows over the notehead (all its ink above it), DOWN = under. */
const sideOf = (r: { headY: number; tieMinY: number; tieMaxY: number }) =>
  r.tieMaxY < r.headY ? 'UP' : r.tieMinY > r.headY ? 'DOWN' : 'across the notehead'

test('🚨 THE BUG: a tie on a BASS staff bows to the side its own stem left free', async ({ score }) => {
  // G3 sits above bass's middle line (D3), so its stem hangs down and the free side is above. The
  // rule we had measured every note against TREBLE's middle line (B4) — G3 is far below that, so it
  // curved DOWN, onto the same side as its own stem, which is the one thing Gould p.64 forbids ("a
  // tie curves away from the stems"). Every note from D3 to A4 on a bass staff was wrong this way.
  //
  // ⚠️ What ANSWERS here is the stem rule, not the clef constant — a drawn note nearly always has a
  // stem to read, so the clef's middle line now only decides when the two stems DISAGREE. That
  // branch is pinned headless in `tieDirection.test.ts`, where the stems can be withheld. Both
  // halves of the fix are needed to turn this test green, and it fails without either.
  const r = await drawTie(score, {
    clef: 'bass',
    notes: [
      { step: 'G', octave: 3, duration: 'q', beat: [0, 1] },
      { step: 'G', octave: 3, duration: 'q', beat: [1, 1] },
    ],
    tieFrom: 0,
  })
  expect(sideOf(r)).toBe('UP')
})

test('⭐⭐ a BEAM-FORCED stem flips the tie — the note\'s own pitch no longer decides', async ({ score }) => {
  // G4 is below treble's middle line, so on staff position alone its tie went DOWN. Beam it into a
  // group reaching high above the staff and the whole group takes DOWN stems; DOWN is now where its
  // own stem hangs, and the tie must take the other side. Only the *resolved* stem knows this — the
  // model's own per-note direction still says up.
  //
  // Sixteenths, so all four beam as ONE group on one beat (eighths would split 2+2 and the two G4s
  // would keep their own up-stems), and the tie joins the two ADJACENT G4s — `toggleTie` always
  // takes the next SLOT, preferring its same pitch.
  const r = await drawTie(score, {
    notes: [
      { step: 'G', octave: 4, duration: '16', beat: [0, 1] },
      { step: 'G', octave: 4, duration: '16', beat: [1, 4] },
      { step: 'A', octave: 5, duration: '16', beat: [1, 2] },
      { step: 'A', octave: 5, duration: '16', beat: [3, 4] },
    ],
    tieFrom: 0,
  })
  // Pinned first, so this can never pass for the wrong reason: the premise is that the beam really
  // did force the low note's stem down.
  expect(r.stemPointsDown, 'the beam group must have forced DOWN stems').toBe(true)
  expect(sideOf(r)).toBe('UP')
})
