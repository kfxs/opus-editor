import { describe, it, expect } from 'vitest'
import {
  DYNAMIC_VELOCITY,
  DEFAULT_DYNAMIC,
  isInterpreted,
  dynamicLevelOf,
  dynamicLabel,
  levelToGlyphString,
  glyphsToLetters,
  parseDynamicText,
  composeDynamicGlyphs,
  PRECOMPOSED,
  measureDynamics,
  resolveActiveLevel,
  resolveChordLevels,
} from './dynamics'
import { fracCreate } from './fraction'
import type { Chord, Dynamic, DynamicLevel, Measure, Score, TimeSignature } from '@/types/music'

/** Quietest → loudest. Mirrors the DynamicLevel union's order; the ladder must rise along it. */
const ALL_LEVELS: DynamicLevel[] = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff']

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
  }
}

function dyn(beatNum: number, level: DynamicLevel, voice: 0 | 1 | 2 | 3 = 0): Dynamic {
  return { id: `d${beatNum}-${level}-${voice}`, beat: fracCreate(beatNum, 1), text: levelToGlyphString(level), voice }
}

function dynText(beatNum: number, txt: string, voice: 0 | 1 | 2 | 3 = 0): Dynamic {
  return { id: `t${beatNum}`, beat: fracCreate(beatNum, 1), text: txt, voice }
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
    id: 's', title: 't', measures: ms,
  }
}

function level(l: DynamicLevel, voice: 0 | 1 | 2 | 3 = 0): Dynamic {
  return { id: `d-${l}`, beat: fracCreate(0, 1), text: levelToGlyphString(l), voice }
}

function text(t: string): Dynamic {
  return { id: 'd-text', beat: fracCreate(0, 1), text: t }
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

  it('increases monotonically along the whole ladder', () => {
    for (let i = 1; i < ALL_LEVELS.length; i++) {
      const [prev, cur] = [ALL_LEVELS[i - 1], ALL_LEVELS[i]]
      expect(DYNAMIC_VELOCITY[prev], `${prev} < ${cur}`).toBeLessThan(DYNAMIC_VELOCITY[cur])
    }
  })

  it('leaves headroom above f so an articulation can still bite', () => {
    // playbackSchedule does Math.min(1, velocity * velocityScale); accent is 1.3. With f at 1.0
    // that clamped to 1.0 and an accented forte was inaudible — the bug this ladder fixes.
    const ACCENT = 1.3
    expect(DYNAMIC_VELOCITY.f * ACCENT).toBeGreaterThan(DYNAMIC_VELOCITY.f)
    expect(DYNAMIC_VELOCITY.f * ACCENT).toBeLessThanOrEqual(1)
    // Only the very top of the ladder is allowed to clamp.
    expect(DYNAMIC_VELOCITY.fff).toBe(1.0)
  })

  // Deliberately NOT evenly spaced: even velocity steps do not read as even loudness steps, and
  // the outer marks should land as events while p..f is the ordinary working range.
  it('widens the gaps toward the extremes', () => {
    const gap = (lo: DynamicLevel, hi: DynamicLevel) => DYNAMIC_VELOCITY[hi] - DYNAMIC_VELOCITY[lo]
    // The two the user called out by ear.
    expect(gap('pp', 'p')).toBeGreaterThan(gap('p', 'mp'))
    expect(gap('f', 'ff')).toBeGreaterThan(gap('mf', 'f'))
    // …and the same shape at the far ends.
    expect(gap('ppp', 'pp')).toBeGreaterThan(gap('mp', 'mf'))
    expect(gap('ff', 'fff')).toBeGreaterThan(gap('mf', 'f'))
    // The middle stays the tight, even part of the ladder.
    expect(gap('p', 'mp')).toBeCloseTo(gap('mp', 'mf'), 2)
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

  it('is false for a mark whose text names no level (empty / plain text)', () => {
    expect(isInterpreted({ id: 'x', beat: fracCreate(0, 1), text: '' })).toBe(false)
    // A plain-text letter that only LOOKS like a dynamic is NOT one — it must be the glyph.
    expect(isInterpreted({ id: 'y', beat: fracCreate(0, 1), text: 'p' })).toBe(false)
  })

  it('exposes the derived level for an interpreted mark', () => {
    const d: Dynamic = level('mp')
    expect(isInterpreted(d)).toBe(true)
    const lvl = dynamicLevelOf(d)
    expect(lvl).toBe('mp')
    expect(DYNAMIC_VELOCITY[lvl!]).toBe(DYNAMIC_VELOCITY.mp)
  })
})

// ---------------------------------------------------------------------------
// dynamicLabel — semantic display string
// ---------------------------------------------------------------------------

describe('dynamicLabel', () => {
  it('returns the text verbatim — the SMuFL glyphs for a level', () => {
    expect(dynamicLabel(level('mf'))).toBe(levelToGlyphString('mf'))
    expect(dynamicLabel(level('p'))).toBe(levelToGlyphString('p'))
  })

  it('returns the user text for custom marks', () => {
    expect(dynamicLabel(text('dolce'))).toBe('dolce')
  })

  it('returns empty string for a mark with no text', () => {
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

describe('the extended ladder, end to end from what the editor stores', () => {
  // What Ctrl+F Ctrl+F actually puts in the model: two glyph chars, not the string 'ff'.
  const typed = (letters: string) => levelToGlyphString(letters)

  it.each(['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'])('%s round-trips to an audible level', letters => {
    const parsed = parseDynamicText(typed(letters))
    expect(parsed.level).toBe(letters)
    expect(isInterpreted({ id: 'd', beat: fracCreate(0, 1), text: typed(letters) })).toBe(true)
  })

  it('ff and fff are now LOUDER than f (they used to be silent)', () => {
    expect(DYNAMIC_VELOCITY[parseDynamicText(typed('ff')).level!])
      .toBeGreaterThan(DYNAMIC_VELOCITY[parseDynamicText(typed('f')).level!])
    expect(DYNAMIC_VELOCITY[parseDynamicText(typed('fff')).level!])
      .toBeGreaterThan(DYNAMIC_VELOCITY[parseDynamicText(typed('ff')).level!])
  })

  it('accents stay NOT levels — sfz/fp/sf/rf name none and carry the previous level', () => {
    // A whole-run match, so adding 'ff' to the table must not make 'sffz' or 'fz' interpretable.
    for (const accent of ['sf', 'sfz', 'sffz', 'fp', 'fz', 'rf', 'rfz']) {
      expect(parseDynamicText(typed(accent)).level, accent).toBeUndefined()
    }
  })
})

describe('composeDynamicGlyphs (the draw-time ligature)', () => {
  const G = (name: string) => levelToGlyphString(name) // per-letter, the STORED form

  it('collapses a multi-letter run to ONE character', () => {
    // The whole point: three stored chars draw as a single precomposed glyph, because Bravura's
    // per-letter advances only suit a letter standing alone.
    expect(G('fff')).toHaveLength(3)
    expect(composeDynamicGlyphs(G('fff'))).toHaveLength(1)
    expect(composeDynamicGlyphs(G('ff'))).toHaveLength(1)
    expect(composeDynamicGlyphs(G('mp'))).toHaveLength(1)
    expect(composeDynamicGlyphs(G('fp'))).toHaveLength(1)
  })

  it('prefers the LONGEST match — sfz is one glyph, not sf + z', () => {
    expect(composeDynamicGlyphs(G('sfz'))).toHaveLength(1)
    expect(composeDynamicGlyphs(G('sfz'))).not.toBe(composeDynamicGlyphs(G('sf')) + G('z'))
    // …and each length is its own glyph, so sf and sfz never collide.
    expect(composeDynamicGlyphs(G('sf'))).not.toBe(composeDynamicGlyphs(G('sfz')))
  })

  it('leaves a lone letter and any unknown combination alone', () => {
    expect(composeDynamicGlyphs(G('f'))).toBe(G('f'))
    expect(composeDynamicGlyphs(G('p'))).toBe(G('p'))
    // No precomposed glyph for 'zz' → falls back to concatenation (today's behaviour), never tofu.
    expect(composeDynamicGlyphs(G('zz'))).toBe(G('zz'))
    expect(composeDynamicGlyphs('')).toBe('')
  })

  // Was previously looked up from VexFlow's `Glyphs`, which is exported by its CJS build but NOT
  // its ESM one — so the table filled up under Vitest and was EMPTY in the browser, and this test
  // passed while the app silently drew loose glyphs. The codepoints are now ours; this pins them.
  it('covers every combination, each a single char in the SMuFL dynamics block', () => {
    const EXPECTED = [
      'pp', 'ppp', 'pppp', 'ppppp', 'pppppp',
      'ff', 'fff', 'ffff', 'fffff', 'ffffff',
      'mp', 'mf', 'pf', 'fp', 'fz',
      'sf', 'sfp', 'sfpp', 'sfz', 'sfzp', 'sffz', 'rf', 'rfz',
    ]
    const resolved = new Set(PRECOMPOSED.map(([letters]) => letters))
    expect([...EXPECTED].filter(l => !resolved.has(l))).toEqual([])
    for (const [letters, glyph] of PRECOMPOSED) {
      expect(glyph, letters).toHaveLength(1)
      const cp = glyph.codePointAt(0)!
      expect(cp, letters).toBeGreaterThanOrEqual(0xe520) // SMuFL dynamics block
      expect(cp, letters).toBeLessThanOrEqual(0xe53d)
    }
    // Distinct glyphs — a copy-paste slip would otherwise draw the wrong dynamic silently.
    expect(new Set(PRECOMPOSED.map(([, g]) => g)).size).toBe(PRECOMPOSED.length)
  })

  // Guards the real-world regression: sfz must not come out as the sf glyph followed by a bare z.
  it('draws sfz as ONE glyph — the bug that shipped loose', () => {
    expect(composeDynamicGlyphs(G('sfz'))).toBe('\uE539')
    expect(composeDynamicGlyphs(G('fff'))).toBe('\uE530')
    expect(composeDynamicGlyphs(G('fp'))).toBe('\uE534')
  })

  it('is DRAW-only: it never changes what a stored run means', () => {
    // The stored form still decomposes to its letters, so playback interpretation is untouched.
    expect(glyphsToLetters(G('mf'))).toBe('mf')
    expect(parseDynamicText(G('mf')).level).toBe('mf')
    // Composing is not applied to storage — the composed char is NOT what parseDynamicText reads.
    expect(composeDynamicGlyphs(G('mf'))).not.toBe(G('mf'))
  })
})
