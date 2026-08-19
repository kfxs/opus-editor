import { describe, it, expect } from 'vitest'
import { voiceScopeOf, scopeCoversVoice, governsSlot, sameScope, staffScopeKey } from './dynamicScope'
import type { Score, StaffInfo } from '@/types/music'

/** A score with `n` staves, so the absent-id rule has a real first staff to resolve against. */
function scoreWithStaves(...ids: string[]): Score {
  const staves: StaffInfo[] = ids.map((id, i) => ({ id, index: i, clef: 'treble' }))
  return { id: 's', title: 't', measures: [], ...(ids.length ? { staves } : {}) }
}

describe('voiceScopeOf — absent means ALL', () => {
  it('answers ALL for a mark with no voice', () => {
    expect(voiceScopeOf({})).toBe('all')
  })

  it('answers the voice for a mark that names one — including voice 0', () => {
    expect(voiceScopeOf({ voice: 0 })).toBe(0)
    expect(voiceScopeOf({ voice: 2 })).toBe(2)
  })

  // ⭐ The whole point of the module: this is the OPPOSITE of `voiceOf`, which answers 0 here.
  it('does NOT read an absent voice as voice 0', () => {
    expect(voiceScopeOf({})).not.toBe(0)
  })
})

describe('scopeCoversVoice', () => {
  it('ALL reaches every voice', () => {
    for (const v of [0, 1, 2, 3] as const) expect(scopeCoversVoice('all', v)).toBe(true)
  })

  it('a scoped mark reaches only its own', () => {
    expect(scopeCoversVoice(1, 1)).toBe(true)
    expect(scopeCoversVoice(1, 0)).toBe(false)
  })
})

describe('governsSlot — the voice half AND the staff half', () => {
  const score = scoreWithStaves('sA', 'sB')

  it('an ALL mark governs every voice of its OWN staff', () => {
    const mark = { staffId: 'sA' }
    expect(governsSlot(score, mark, { voice: 0, staffId: 'sA' })).toBe(true)
    expect(governsSlot(score, mark, { voice: 3, staffId: 'sA' })).toBe(true)
  })

  // 🚨 The bleed this module exists to stop: `resolveChordLevels` never compared staves, so absent
  // = ALL would have made every dynamic govern the whole score.
  it('…and NOT the other staff, in any voice', () => {
    const mark = { staffId: 'sA' }
    expect(governsSlot(score, mark, { voice: 0, staffId: 'sB' })).toBe(false)
    expect(governsSlot(score, mark, { voice: 2, staffId: 'sB' })).toBe(false)
  })

  it('a scoped mark governs one lane only', () => {
    const mark = { voice: 1 as const, staffId: 'sA' }
    expect(governsSlot(score, mark, { voice: 1, staffId: 'sA' })).toBe(true)
    expect(governsSlot(score, mark, { voice: 0, staffId: 'sA' })).toBe(false)
    expect(governsSlot(score, mark, { voice: 1, staffId: 'sB' })).toBe(false)
  })

  // ⚠️ An absent staffId IS the first staff's id, on either side — normalising it away (or keying
  // on the raw field) would give one staff two identities.
  it('an absent staffId means the FIRST staff, on either side', () => {
    expect(governsSlot(score, {}, { voice: 0, staffId: 'sA' })).toBe(true)
    expect(governsSlot(score, { staffId: 'sA' }, { voice: 0 })).toBe(true)
    expect(governsSlot(score, {}, { voice: 0, staffId: 'sB' })).toBe(false)
  })

  it('everything matches on a score with no staves at all (the single-staff default)', () => {
    const bare = scoreWithStaves()
    expect(governsSlot(bare, {}, { voice: 2 })).toBe(true)
  })
})

describe('staffScopeKey', () => {
  it('resolves absent to the first staff, so one staff has one key', () => {
    const score = scoreWithStaves('sA', 'sB')
    expect(staffScopeKey(score, undefined)).toBe(staffScopeKey(score, 'sA'))
    expect(staffScopeKey(score, 'sB')).not.toBe(staffScopeKey(score, 'sA'))
  })
})

describe('sameScope — what makes two marks duplicates', () => {
  it('ALL is not the same scope as voice 0', () => {
    expect(sameScope({}, { voice: 0 })).toBe(false)
  })

  it('two ALL marks share a scope, and so do two marks on one voice', () => {
    expect(sameScope({}, {})).toBe(true)
    expect(sameScope({ voice: 2 }, { voice: 2 })).toBe(true)
    expect(sameScope({ voice: 2 }, { voice: 3 })).toBe(false)
  })
})
