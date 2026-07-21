import { describe, it, expect } from 'vitest'
import { pdfFilename } from './pdfExport'
import type { Score } from '@/types/music'

/** A score is only ever asked for its title here, so that is all these fixtures carry. */
const scoreTitled = (title?: string) => ({ title, measures: [] }) as unknown as Score

describe('pdfFilename', () => {
  it('names the file after the score', () => {
    expect(pdfFilename(scoreTitled('Prelude'))).toBe('Prelude.pdf')
  })

  it('falls back when there is no usable title', () => {
    expect(pdfFilename(scoreTitled(undefined))).toBe('score.pdf')
    expect(pdfFilename(scoreTitled('   '))).toBe('score.pdf')
  })

  it('strips the characters a file system refuses', () => {
    expect(pdfFilename(scoreTitled('No. 3: Andante / "slow"'))).toBe('No. 3- Andante - -slow-.pdf')
  })
})
