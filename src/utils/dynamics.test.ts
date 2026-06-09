import { describe, it, expect } from 'vitest'
import {
  DYNAMIC_VELOCITY,
  DEFAULT_DYNAMIC,
  isInterpreted,
  dynamicLabel,
  measureDynamics,
  resolveActiveLevel,
  resolveChordLevels,
} from './dynamics'
import { fracCreate } from './fraction'
import type { Chord, Dynamic, DynamicLevel, Measure, Score, TimeSignature } from '@/types/music'

const ALL_LEVELS: DynamicLevel[] = ['p', 'mp', 'mf', 'f']

const TS: TimeSignature = { numerator: 4, denominator: 4 }

/** Build a minimal Score whose measures carry the given dynamics. */
function scoreOf(...measureDyns: Dynamic[][]): Score {
  const measures: Measure[] = measureDyns.map((dynamics, i) => ({
    id: `m${i + 1}`,
    number: i + 1,
    slots: [],
    timeSignature: TS,
    tuplets: [],
    dynamics: dynamics.length ? dynamics : undefined,
  }))
  return {
    id: 's',
    title: 't',
    measures,
    tempo: 120,
    keySignature: { key: 'C', accidentals: 0 },
    defaultTimeSignature: TS,
  }
}

function dyn(beatNum: number, level: DynamicLevel, voice: 0 | 1 | 2 | 3 = 0): Dynamic {
  return { id: `d${beatNum}-${level}-${voice}`, beat: fracCreate(beatNum, 1), kind: 'level', level, voice }
}

function dynText(beatNum: number, txt: string, voice: 0 | 1 | 2 | 3 = 0): Dynamic {
  return { id: `t${beatNum}`, beat: fracCreate(beatNum, 1), kind: 'text', text: txt, voice }
}

/** A minimal one-pitch chord at a beat (id encodes measure+beat+voice for lookup). */
function chord(id: string, beatNum: number, voice: 0 | 1 | 2 | 3 = 0): Chord {
  return {
    id,
    type: 'chord',
    beat: fracCreate(beatNum, 1),
    duration: 'q',
    measure: 0,
    voice,
    notes: [{ id: `${id}-p`, step: 'C', alter: 0, octave: 4 }],
  }
}

/** Build a Score from measures described as { dynamics, chords }. */
function scoreWithChords(...measures: { dynamics?: Dynamic[]; chords?: Chord[] }[]): Score {
  const ms: Measure[] = measures.map((m, i) => ({
    id: `m${i + 1}`,
    number: i + 1,
    slots: m.chords ?? [],
    timeSignature: TS,
    tuplets: [],
    dynamics: m.dynamics,
  }))
  return {
    id: 's', title: 't', measures: ms, tempo: 120,
    keySignature: { key: 'C', accidentals: 0 }, defaultTimeSignature: TS,
  }
}

function level(l: DynamicLevel, voice: 0 | 1 | 2 | 3 = 0): Dynamic {
  return { id: `d-${l}`, beat: fracCreate(0, 1), kind: 'level', level: l, voice }
}

function text(t: string): Dynamic {
  return { id: 'd-text', beat: fracCreate(0, 1), kind: 'text', text: t }
}

// ---------------------------------------------------------------------------
// Velocity table — meaning axis integrity
// ---------------------------------------------------------------------------

describe('DYNAMIC_VELOCITY', () => {
  it('has a row for every DynamicLevel', () => {
    for (const l of ALL_LEVELS) {
      expect(DYNAMIC_VELOCITY[l]).toBeTypeOf('number')
    }
  })

  it('keeps every velocity in Tone.js normalized range 0..1', () => {
    for (const l of ALL_LEVELS) {
      expect(DYNAMIC_VELOCITY[l]).toBeGreaterThan(0)
      expect(DYNAMIC_VELOCITY[l]).toBeLessThanOrEqual(1)
    }
  })

  it('increases monotonically from p to f', () => {
    expect(DYNAMIC_VELOCITY.p).toBeLessThan(DYNAMIC_VELOCITY.mp)
    expect(DYNAMIC_VELOCITY.mp).toBeLessThan(DYNAMIC_VELOCITY.mf)
    expect(DYNAMIC_VELOCITY.mf).toBeLessThan(DYNAMIC_VELOCITY.f)
  })

  it('DEFAULT_DYNAMIC is a valid level', () => {
    expect(DYNAMIC_VELOCITY[DEFAULT_DYNAMIC]).toBeTypeOf('number')
  })
})

// ---------------------------------------------------------------------------
// isInterpreted — only level marks (with a level) drive playback
// ---------------------------------------------------------------------------

describe('isInterpreted', () => {
  it('is true for a well-formed level dynamic', () => {
    expect(isInterpreted(level('f'))).toBe(true)
  })

  it('is false for a text dynamic', () => {
    expect(isInterpreted(text('dolce'))).toBe(false)
  })

  it('is false for a level dynamic missing its level', () => {
    const malformed: Dynamic = { id: 'x', beat: fracCreate(0, 1), kind: 'level' }
    expect(isInterpreted(malformed)).toBe(false)
  })

  it('narrows the type so .level is defined', () => {
    const d: Dynamic = level('mp')
    if (isInterpreted(d)) {
      // type-level assertion: d.level is DynamicLevel here
      expect(DYNAMIC_VELOCITY[d.level]).toBe(DYNAMIC_VELOCITY.mp)
    } else {
      throw new Error('expected interpreted')
    }
  })
})

// ---------------------------------------------------------------------------
// dynamicLabel — semantic display string
// ---------------------------------------------------------------------------

describe('dynamicLabel', () => {
  it('returns the level letters for interpreted marks', () => {
    expect(dynamicLabel(level('mf'))).toBe('mf')
    expect(dynamicLabel(level('p'))).toBe('p')
  })

  it('returns the user text for custom marks', () => {
    expect(dynamicLabel(text('dolce'))).toBe('dolce')
  })

  it('returns empty string for a text mark with no text', () => {
    expect(dynamicLabel(text(''))).toBe('')
  })
})

// ---------------------------------------------------------------------------
// measureDynamics — sorted, copy, empty-safe
// ---------------------------------------------------------------------------

describe('measureDynamics', () => {
  it('returns dynamics sorted ascending by beat', () => {
    const score = scoreOf([dyn(2, 'f'), dyn(0, 'p'), dyn(1, 'mf')])
    expect(measureDynamics(score, 1).map(d => d.beat.num)).toEqual([0, 1, 2])
  })

  it('returns an empty array when a measure has no dynamics', () => {
    const score = scoreOf([])
    expect(measureDynamics(score, 1)).toEqual([])
  })

  it('returns an empty array for a missing measure', () => {
    const score = scoreOf([dyn(0, 'p')])
    expect(measureDynamics(score, 99)).toEqual([])
  })

  it('does not mutate the stored array (returns a copy)', () => {
    const score = scoreOf([dyn(2, 'f'), dyn(0, 'p')])
    measureDynamics(score, 1).sort((a, b) => b.beat.num - a.beat.num)
    expect(score.measures[0].dynamics!.map(d => d.id)).toEqual(['d2-f-0', 'd0-p-0'])
  })
})

// ---------------------------------------------------------------------------
// resolveActiveLevel — the voice-ready step function
// ---------------------------------------------------------------------------

describe('resolveActiveLevel', () => {
  it('returns DEFAULT_DYNAMIC before any mark', () => {
    const score = scoreOf([])
    expect(resolveActiveLevel(score, 1, fracCreate(0, 1))).toBe(DEFAULT_DYNAMIC)
  })

  it('applies a mark from its beat onward within a measure', () => {
    const score = scoreOf([dyn(2, 'p')])
    expect(resolveActiveLevel(score, 1, fracCreate(1, 1))).toBe(DEFAULT_DYNAMIC)
    expect(resolveActiveLevel(score, 1, fracCreate(2, 1))).toBe('p')
    expect(resolveActiveLevel(score, 1, fracCreate(3, 1))).toBe('p')
  })

  it('takes the latest mark at-or-before the beat', () => {
    const score = scoreOf([dyn(0, 'p'), dyn(2, 'f')])
    expect(resolveActiveLevel(score, 1, fracCreate(1, 1))).toBe('p')
    expect(resolveActiveLevel(score, 1, fracCreate(2, 1))).toBe('f')
  })

  it('walks back across earlier measures', () => {
    const score = scoreOf([dyn(0, 'p')], [], [])
    expect(resolveActiveLevel(score, 3, fracCreate(0, 1))).toBe('p')
  })

  it('uses the nearest preceding measure when several carry marks', () => {
    const score = scoreOf([dyn(0, 'p')], [dyn(0, 'f')], [])
    expect(resolveActiveLevel(score, 3, fracCreate(0, 1))).toBe('f')
  })

  it('skips text dynamics (they carry the previous level)', () => {
    const score = scoreOf([dyn(0, 'p'), dynText(2, 'dolce')])
    expect(resolveActiveLevel(score, 1, fracCreate(3, 1))).toBe('p')
  })

  it('returns DEFAULT_DYNAMIC when only text dynamics precede', () => {
    const score = scoreOf([dynText(0, 'espr.')])
    expect(resolveActiveLevel(score, 1, fracCreate(2, 1))).toBe(DEFAULT_DYNAMIC)
  })

  it('resolves per voice — a mark in one voice does not affect another', () => {
    const score = scoreOf([dyn(0, 'p', 0), dyn(0, 'f', 1)])
    expect(resolveActiveLevel(score, 1, fracCreate(2, 1), 0)).toBe('p')
    expect(resolveActiveLevel(score, 1, fracCreate(2, 1), 1)).toBe('f')
    // a voice with no marks falls back to the default
    expect(resolveActiveLevel(score, 1, fracCreate(2, 1), 2)).toBe(DEFAULT_DYNAMIC)
  })
})

// ---------------------------------------------------------------------------
// resolveChordLevels — the single-pass playback step function
// ---------------------------------------------------------------------------

describe('resolveChordLevels', () => {
  it('defaults chords with no preceding dynamic to DEFAULT_DYNAMIC', () => {
    const score = scoreWithChords({ chords: [chord('c1', 0), chord('c2', 1)] })
    const levels = resolveChordLevels(score)
    expect(levels.get('c1')).toBe(DEFAULT_DYNAMIC)
    expect(levels.get('c2')).toBe(DEFAULT_DYNAMIC)
  })

  it('applies a mid-measure dynamic from its beat onward', () => {
    const score = scoreWithChords({
      dynamics: [dyn(2, 'f')],
      chords: [chord('c0', 0), chord('c2', 2), chord('c3', 3)],
    })
    const levels = resolveChordLevels(score)
    expect(levels.get('c0')).toBe(DEFAULT_DYNAMIC)
    expect(levels.get('c2')).toBe('f')
    expect(levels.get('c3')).toBe('f')
  })

  it('carries the level forward into later measures', () => {
    const score = scoreWithChords(
      { dynamics: [dyn(0, 'p')], chords: [chord('a', 0)] },
      { chords: [chord('b', 0)] },
    )
    const levels = resolveChordLevels(score)
    expect(levels.get('a')).toBe('p')
    expect(levels.get('b')).toBe('p')
  })

  it('keeps voices independent', () => {
    const score = scoreWithChords({
      dynamics: [dyn(0, 'p', 0), dyn(0, 'f', 1)],
      chords: [chord('v0', 0, 0), chord('v1', 0, 1), chord('v2', 0, 2)],
    })
    const levels = resolveChordLevels(score)
    expect(levels.get('v0')).toBe('p')
    expect(levels.get('v1')).toBe('f')
    expect(levels.get('v2')).toBe(DEFAULT_DYNAMIC)
  })

  it('ignores text dynamics (no loudness change)', () => {
    const score = scoreWithChords({
      dynamics: [dyn(0, 'p'), dynText(2, 'dolce')],
      chords: [chord('c0', 0), chord('c3', 3)],
    })
    expect(resolveChordLevels(score).get('c3')).toBe('p')
  })

  it('matches resolveActiveLevel for every chord (single-pass == walk-back)', () => {
    const score = scoreWithChords(
      { dynamics: [dyn(0, 'p'), dyn(2, 'f')], chords: [chord('m1b0', 0), chord('m1b2', 2), chord('m1b3', 3)] },
      { chords: [chord('m2b0', 0), chord('m2b1', 1)] },
      { dynamics: [dyn(1, 'mp')], chords: [chord('m3b0', 0), chord('m3b1', 1)] },
    )
    const levels = resolveChordLevels(score)
    for (const measure of score.measures) {
      for (const slot of measure.slots) {
        if (slot.type !== 'chord') continue
        const expected = resolveActiveLevel(score, measure.number, slot.beat, slot.voice ?? 0)
        expect(levels.get(slot.id)).toBe(expected)
      }
    }
  })
})
