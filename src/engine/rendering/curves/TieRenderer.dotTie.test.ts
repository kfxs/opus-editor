// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { ScoreModel } from '../../models/ScoreModel'
import { ScoreRenderer } from '../ScoreRenderer'
import { sceneGroups, scenePrimitives } from '@/engine/scene/Scene'
import { resetDotTieRule, setDotTieRule } from '@/engine/layout/dotTie'
import { fracCreate as frac } from '@/utils/fraction'
import { toggleTie } from '../../models/tieOps'

/**
 * Subject: `./TieRenderer` — where a DOTTED note's tie starts, by the armed `layout/dotTie` row
 * (docs/plans/multiple-dots-plan.md P4g). ⚠️ jsdom measures a dot 0 wide, so this asserts ORDER (before the dot
 * or at/after it), ⛔ never a gap — the gaps are `e2e/dots.e2e.ts`'s.
 */
afterEach(() => resetDotTieRule())

function tiedDotted() {
  const model = new ScoreModel()
  const a = model.addNote({ step: 'A', octave: 4, duration: 'q', dots: 1, measure: 1, beat: frac(0, 1) })
  model.addNote({ step: 'A', octave: 4, duration: '8', measure: 1, beat: frac(3, 2) })
  toggleTie(model, a.id)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1200, 800)
  const { scene } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
  const dotX = scenePrimitives(sceneGroups(scene, 'dot')[0]).flatMap(p => (p.kind === 'text' ? [p.x] : []))[0]
  const path = scenePrimitives(sceneGroups(scene, 'tie')[0]).find(p => p.kind === 'path')
  const tieX = path && path.kind === 'path' && path.ops[0] && 'x' in path.ops[0] ? path.ops[0].x : NaN
  return { dotX, tieX }
}

describe('TieRenderer — a dotted note tied', () => {
  it('✅ `gould` (armed): the tie springs from INSIDE the head — left of the dot, which sits within its arc', () => {
    const { dotX, tieX } = tiedDotted()
    expect(tieX).toBeLessThan(dotX)
  })

  it('`gerouLusk`: the tie starts AFTER the dot', () => {
    setDotTieRule('gerouLusk')
    const { dotX, tieX } = tiedDotted()
    expect(tieX).toBeGreaterThanOrEqual(dotX)
  })
})
