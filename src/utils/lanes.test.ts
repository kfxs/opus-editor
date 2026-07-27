import { describe, it, expect } from 'vitest'
import { voiceOf, staffOf } from './lanes'

// The whole module is one rule per axis: absent means the FIRST lane. These tests exist so the
// rule has a stated home rather than 219 remembered `?? 0`s.

describe('voiceOf', () => {
  it('reads an explicit voice', () => {
    expect(voiceOf({ voice: 2 })).toBe(2)
  })

  it('resolves an absent voice to 0', () => {
    expect(voiceOf({})).toBe(0)
    expect(voiceOf({ voice: undefined })).toBe(0)
  })

  it('keeps voice 0 distinguishable from absent — both ARE voice 0', () => {
    expect(voiceOf({ voice: 0 })).toBe(voiceOf({}))
  })
})

describe('staffOf', () => {
  it('reads an explicit staff index', () => {
    expect(staffOf({ staff: 1 })).toBe(1)
  })

  it('resolves an absent staff to 0', () => {
    expect(staffOf({})).toBe(0)
    expect(staffOf({ staff: undefined })).toBe(0)
  })
})
