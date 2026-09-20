import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { keySignatureStavesAt } from './keySignatureScope'
import { keyFromFifths } from '@/utils/keySignature'

/**
 * How many staves one selected signature speaks for.
 *
 * Subject: {@link keySignatureScope}, sitting beside this file. The `MusicEngine` is real, because the
 * whole question is one of ITS answers — what key is in force on each staff at that bar.
 *
 * ⚠️ The case that must never regress is the LAST one: two staves in genuinely different keys — modern
 * polytonal writing, ⛔ not a transposing score — are TWO statements, and neither the highlight nor
 * Delete may reach across to the other (his warning, 2026-08-28).
 */
vi.mock('../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('keySignatureStavesAt', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    for (let i = 0; i < 5; i++) engine.addMeasure()
    engine.addStaffBelow(0)
  })

  it('a ONE-STAFF score answers with its one staff', () => {
    const solo = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    solo.setKeyAt(1, keyFromFifths(-3))
    expect(keySignatureStavesAt(solo, 1, 0)).toEqual([0])
  })

  it('⭐ a key placed on ALL staves is ONE statement — every staff is in scope', () => {
    engine.setKeyAt(3, keyFromFifths(2), 0)
    engine.setKeyAt(3, keyFromFifths(2), 1)
    expect(keySignatureStavesAt(engine, 3, 0)).toEqual([0, 1])
    // …and it answers the same from either staff's ink, which is what makes the two clicks agree.
    expect(keySignatureStavesAt(engine, 3, 1)).toEqual([0, 1])
  })

  it('⭐ C major counts too — two staves with no key at all are still one statement', () => {
    expect(keySignatureStavesAt(engine, 2, 0)).toEqual([0, 1])
  })

  it('🚨 TWO DIFFERENT KEYS ARE TWO STATEMENTS — neither staff reaches the other', () => {
    // Modern polytonal writing: four sharps against three flats. ⛔ Not transposition.
    engine.setKeyAt(3, keyFromFifths(4), 0)
    engine.setKeyAt(3, keyFromFifths(-3), 1)
    expect(keySignatureStavesAt(engine, 3, 0)).toEqual([0])
    expect(keySignatureStavesAt(engine, 3, 1)).toEqual([1])
  })

  it('🚨 …including when only ONE staff has a key (a `Ctrl` drop) — the other is in C', () => {
    engine.setKeyAt(3, keyFromFifths(2), 0)
    expect(keySignatureStavesAt(engine, 3, 0)).toEqual([0])
    expect(keySignatureStavesAt(engine, 3, 1)).toEqual([1])
  })

  it('⭐ reads what is IN FORCE, not what the bar stores — a reprint bar still speaks for both', () => {
    // The key is written at bar 3; bar 5 stores nothing and inherits it on both staves.
    engine.setKeyAt(3, keyFromFifths(2), 0)
    engine.setKeyAt(3, keyFromFifths(2), 1)
    expect(engine.getScore().measures.find(m => m.number === 5)?.keys).toBeUndefined()
    expect(keySignatureStavesAt(engine, 5, 0)).toEqual([0, 1])
  })
})
