import { describe, it, expect } from 'vitest'
import { apply, isTranslation } from '@/engine/paint/Affine'
import { circleSpine } from '@/engine/engrave/staff/staffSpine'
import { keySignatureExtent } from '@/engine/layout/keySignatureLayout'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { sceneGroups } from '@/engine/scene/Scene'
import type { KeySignature } from '@/types/music'
import { resolveStaffClefs } from '@/utils/clefUtils'
import { resolveStaffKeys } from '@/utils/keySignature'
import { drawSpineBarHeader, spineBarHeader, spineHeaderWidth } from './spineHeader'
import { SPINE_BLOCK_CLASS } from './spineStaff'

/**
 * ⭐ WHICH signs a bar draws on a spine, and that each is a placed BLOCK.
 * ⚠️ jsdom glyphs are 0 wide: a clef's and a meter's width are 0 here, so the ROOM is asserted on the
 * key signature (priced from the font's table) and on counts — ⛔ never on a glyph's ink.
 */

const D_MAJOR: KeySignature = { alterations: [{ step: 'F', alter: 1 }, { step: 'C', alter: 1 }], mode: 'major' }

function model(bars: number): ScoreModel {
  const m = new ScoreModel('header')
  for (let i = 1; i < bars; i++) m.addMeasure()
  return m
}

const headerOf = (m: ScoreModel, index: number) => {
  const score = m.getScore()
  return spineBarHeader(score, resolveStaffClefs(score), resolveStaffKeys(score), index)
}

describe('spineBarHeader — the PAGE\'s answer, for one system', () => {
  it('bar 1 is the staff\'s head: a FULL clef and the meter; a plain later bar draws nothing', () => {
    const m = model(2)
    expect(headerOf(m, 0)).toMatchObject({ clef: { clef: 'treble', small: false }, meter: { numerator: 4, denominator: 4 } })
    expect(headerOf(m, 0)?.key).toBeUndefined() // 🚨 absent, never empty: C major has no ink
    expect(headerOf(m, 1)).toBeUndefined()
  })

  it('⭐ the head carries the KEY SIGNATURE, between the clef and the meter', () => {
    const m = model(1)
    m.setKeyAt(1, D_MAJOR)
    expect(headerOf(m, 0)?.key?.alterations).toHaveLength(2)
  })

  it('⭐ a CHANGE draws only what changed — a SMALL clef, the new key, the new meter', () => {
    const m = model(4)
    m.setClef(2, 'bass')
    m.setKeyAt(3, D_MAJOR)
    m.setTimeSignature(4, { numerator: 3, denominator: 4 })
    expect(headerOf(m, 1)).toEqual({ readingClef: 'bass', clef: { clef: 'bass', small: true } })
    expect(headerOf(m, 2)).toMatchObject({ readingClef: 'bass', key: D_MAJOR })
    expect(headerOf(m, 2)?.clef).toBeUndefined()
    expect(headerOf(m, 3)).toMatchObject({ meter: { numerator: 3, denominator: 4 } })
    expect(headerOf(m, 3)?.key).toBeUndefined() // the key did not change AGAIN
  })
})

describe('drawSpineBarHeader — every sign is a rigid block, and the room is the drawing\'s', () => {
  const spine = circleSpine(400, 400, 250)
  const record = (m: ScoreModel, index: number, s = 0) => {
    const recorder = new SceneRecorder()
    const end = drawSpineBarHeader(recorder, spine, s, headerOf(m, index)!)
    return { blocks: sceneGroups(recorder.scene, SPINE_BLOCK_CLASS), end }
  }

  it('one placed block per sign: clef · key · meter', () => {
    const m = model(1)
    expect(record(m, 0).blocks).toHaveLength(2)
    m.setKeyAt(1, D_MAJOR)
    expect(record(m, 0).blocks).toHaveLength(3)
  })

  it('⭐ it ENDS where the room says — ONE list prices and draws', () => {
    const m = model(1)
    m.setKeyAt(1, D_MAJOR)
    const header = headerOf(m, 0)!
    expect(record(m, 0, 100).end).toBeCloseTo(100 + spineHeaderWidth(header), 9)
    expect(spineHeaderWidth(header)).toBeGreaterThan(keySignatureExtent(D_MAJOR) * STAFF_SPACE_PX)
  })

  it('a sign is turned, never deformed', () => {
    const { blocks } = record(model(1), 0, spine.length / 4)
    const o = apply(blocks[0].placement, 0, 0)
    const p = apply(blocks[0].placement, 30, 40)
    expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeCloseTo(50, 9)
    expect(isTranslation(blocks[0].placement)).toBe(false)
  })
})
