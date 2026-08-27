import { describe, it, expect } from 'vitest'
import type { Score } from '@/types/music'
import { SCORE_TEXT_FIELDS, clearScoreText, scoreText, setScoreText } from './scoreTextOps'

/**
 * The score's own text — its title and its composer, as one table (`./scoreTextOps`; ⛔ scaffolding,
 * see `engine/rendering/ScoreHeaderPass`).
 *
 * ⭐ The one rule worth pinning: **blank means absent, in both directions.** A blank write deletes
 * the key and a blank field reads as nothing, so the model never holds two representations of "there
 * is none" — which is what makes the exported JSON honest and what lets the dialog have no Clear
 * button.
 */

const score = (fields: Partial<Score> = {}): Score => ({ id: 's', measures: [], ...fields }) as Score

describe('scoreText — reading', () => {
  it('answers what is there, trimmed', () => {
    expect(scoreText(score({ title: '  Sonata  ' }), 'title')).toBe('Sonata')
  })

  it('⭐ answers undefined for absent AND for blank — one "there is none"', () => {
    expect(scoreText(score(), 'title')).toBeUndefined()
    expect(scoreText(score({ title: '   ' }), 'title')).toBeUndefined()
  })
})

describe('setScoreText', () => {
  it('writes the trimmed value and reports the change', () => {
    const s = score()
    expect(setScoreText(s, 'composer', '  Brahms ')).toBe(true)
    expect(s.composer).toBe('Brahms')
  })

  it('reports NO change when the words are the same — the caller skips the undo entry', () => {
    const s = score({ title: 'Sonata' })
    expect(setScoreText(s, 'title', 'Sonata')).toBe(false)
    expect(setScoreText(s, 'title', '  Sonata  ')).toBe(false)
  })

  it('⭐ a BLANK write DELETES the key — there is no Clear operation to forget to call', () => {
    const s = score({ title: 'Sonata' })
    expect(setScoreText(s, 'title', '   ')).toBe(true)
    expect('title' in s).toBe(false)
  })

  it('writing blank over nothing changes nothing', () => {
    const s = score()
    expect(setScoreText(s, 'title', '')).toBe(false)
  })
})

describe('clearScoreText', () => {
  it('⭐ DELETES the key rather than blanking it — the export then has no such field', () => {
    const s = score({ title: 'Sonata', composer: 'Brahms' })
    expect(clearScoreText(s, 'title')).toBe(true)
    expect('title' in s).toBe(false)
    expect(JSON.stringify(s)).not.toContain('title')
    // …and only the one asked for.
    expect(s.composer).toBe('Brahms')
  })

  it('reports no change when there was nothing there', () => {
    expect(clearScoreText(score(), 'composer')).toBe(false)
  })
})

describe('SCORE_TEXT_FIELDS', () => {
  it('⭐ is the family, in DRAWN order — title above, composer under it', () => {
    expect([...SCORE_TEXT_FIELDS]).toEqual(['title', 'composer'])
  })
})
