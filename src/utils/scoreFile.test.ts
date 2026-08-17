import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  readScoreFile,
  scoreFilename,
  wrapScoreJson,
  SCORE_FILE_FORMAT,
  SCORE_FILE_VERSION,
} from './scoreFile'

/** The smallest thing that counts as a score: an id, a title and a measures array. */
const MINIMAL = {
  id: 'score-1',
  title: 'Test',
  measures: [{ id: 'm1', number: 1, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [] }],
}

describe('scoreFile', () => {
  let errors: unknown[][]
  let warns: unknown[][]

  beforeEach(() => {
    errors = []
    warns = []
    vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a) })
    vi.spyOn(console, 'warn').mockImplementation((...a) => { warns.push(a) })
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  describe('wrapScoreJson', () => {
    it('nests the model under an envelope that names the format and version', () => {
      const file = JSON.parse(wrapScoreJson(JSON.stringify(MINIMAL), '2026-07-22T00:00:00.000Z'))
      expect(file.format).toBe(SCORE_FILE_FORMAT)
      expect(file.version).toBe(SCORE_FILE_VERSION)
      expect(file.savedAt).toBe('2026-07-22T00:00:00.000Z')
      expect(file.score).toEqual(MINIMAL)
    })
  })

  describe('readScoreFile', () => {
    it('round-trips a wrapped score with no warnings', () => {
      const text = wrapScoreJson(JSON.stringify(MINIMAL), '2026-07-22T00:00:00.000Z')
      const { scoreJson, summary } = readScoreFile(text)
      expect(JSON.parse(scoreJson!)).toEqual(MINIMAL)
      expect(summary).toBe('loaded 1 bars')
      expect(warns).toHaveLength(0)
      expect(errors).toHaveLength(0)
    })

    // Every export taken before the envelope existed, plus all hand-written test JSON.
    it('reads a bare Score that has no envelope', () => {
      const { scoreJson } = readScoreFile(JSON.stringify(MINIMAL))
      expect(JSON.parse(scoreJson!)).toEqual(MINIMAL)
      expect(errors).toHaveLength(0)
    })

    it('loads a file from a newer build, but warns', () => {
      const text = JSON.stringify({
        format: SCORE_FILE_FORMAT, version: SCORE_FILE_VERSION + 1, savedAt: '', score: MINIMAL,
      })
      const { scoreJson, summary } = readScoreFile(text)
      expect(scoreJson).not.toBeNull()
      expect(summary).toContain('newer build')
      expect(warns).toHaveLength(1)
    })

    // The signal this module exists to give: a newer build wrote a field we do not model. It is
    // not fatal, and — crucially — the field SURVIVES the read rather than being stripped.
    it('warns about an unknown top-level field but preserves it', () => {
      const withFuture = { ...MINIMAL, hairpins: [{ id: 'h1' }] }
      const { scoreJson, summary } = readScoreFile(JSON.stringify(withFuture))
      expect(JSON.parse(scoreJson!).hairpins).toEqual([{ id: 'h1' }])
      expect(summary).toContain('unknown field')
      expect(warns[0]?.[0]).toContain('hairpins')
    })

    // ⭐⭐ The other half of that signal, and the one that had rotted: a field this build DOES model
    // must not be reported. `trills` landed on `Score` and never landed in the known-keys table, so
    // every score with an ornament in it warned about a field the build understands perfectly (his
    // report, 2026-08-17) — and a warning that cries wolf is worse than none, because it teaches the
    // reader to skip the real ones. The list is now the keys of a `Record<keyof Score, true>`, so
    // the next omission fails to COMPILE; this pins the behaviour that table buys.
    it('⭐ says NOTHING about a top-level field this build models — every one of them', () => {
      const full = {
        ...MINIMAL,
        composer: 'x', staves: [], staffGroups: [], slurs: [], trills: [], engravingOverrides: {},
      }
      const { scoreJson, summary } = readScoreFile(JSON.stringify(full))
      expect(scoreJson).not.toBeNull()
      expect(warns, 'no warning at all').toHaveLength(0)
      expect(summary).not.toContain('unknown field')
    })

    it('refuses a file whose format is not ours', () => {
      const text = JSON.stringify({ format: 'musicxml-ish', version: 1, score: MINIMAL })
      expect(readScoreFile(text).scoreJson).toBeNull()
      expect(errors).toHaveLength(1)
    })

    it('refuses invalid JSON', () => {
      expect(readScoreFile('{ not json').scoreJson).toBeNull()
      expect(errors).toHaveLength(1)
    })

    it('refuses an object that is neither an envelope nor a score', () => {
      expect(readScoreFile(JSON.stringify({ hello: 'world' })).scoreJson).toBeNull()
      expect(errors).toHaveLength(1)
    })

    it('refuses an envelope whose score has no measures array', () => {
      const text = JSON.stringify({ format: SCORE_FILE_FORMAT, version: 1, score: { id: 'x' } })
      expect(readScoreFile(text).scoreJson).toBeNull()
      expect(errors).toHaveLength(1)
    })

    it('refuses a top-level array', () => {
      expect(readScoreFile('[]').scoreJson).toBeNull()
    })
  })

  describe('scoreFilename', () => {
    it('slugifies the title', () => {
      expect(scoreFilename('String Quartet no. 2')).toBe('string-quartet-no-2.json')
    })
    it('falls back when the title is empty, missing, or all punctuation', () => {
      expect(scoreFilename('')).toBe('score.json')
      expect(scoreFilename(undefined)).toBe('score.json')
      expect(scoreFilename('!!!')).toBe('score.json')
    })
  })
})
