import { readFileSync } from 'node:fs'
import { test, expect, type Download } from './fixtures'

/**
 * PDF export (docs/pdf-export.md), end to end — and the FIRST automated check this path has ever
 * had. It cannot be unit-tested at all: it re-renders the score to an off-screen SVG, outlines
 * every music glyph against the real Bravura file, and hands the result to jsPDF. jsdom has no
 * layout for the render, no `document.fonts` for the outlining, and no download for the save.
 */

async function exportedBytes(score: import('@playwright/test').Page): Promise<{ bytes: Buffer; name: string }> {
  const [download]: [Download, void] = await Promise.all([
    score.waitForEvent('download'),
    score.evaluate(() => window.__h.exportPdf()),
  ])
  return { bytes: readFileSync(await download.path()), name: download.suggestedFilename() }
}

test('exports a real PDF, with the music actually in it', async ({ score }) => {
  await score.evaluate(async () => {
    window.__h.engine.setTitle('Geometry net')
    await window.__h.render()
  })
  const empty = await exportedBytes(score)

  await score.evaluate(async () => {
    const h = window.__h
    while (h.engine.getScore().measures.length < 12) h.engine.addMeasure()
    for (let measure = 1; measure <= 12; measure++) {
      for (const beat of [0, 1, 2, 3]) {
        h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure, beat: h.frac(beat, 1) })
      }
    }
    await h.render()
  })
  const music = await exportedBytes(score)

  for (const pdf of [empty, music]) {
    expect(pdf.bytes.subarray(0, 5).toString('latin1'), 'a real PDF header').toBe('%PDF-')
    expect(pdf.bytes.subarray(-8).toString('latin1'), 'and a complete trailer').toContain('%%EOF')
    // The score's title is the one piece of document metadata the export invents.
    expect(pdf.name, 'named after the score').toBe('Geometry net.pdf')
  }

  // Measured against the SAME export of an empty score rather than a constant, so the check stays
  // about the music being there and not about how well jsPDF happens to compress this month. Every
  // notehead, stem and beam is an outlined path, so 48 notes are worth kilobytes.
  expect(music.bytes.length - empty.bytes.length, 'twelve bars of music made the file grow')
    .toBeGreaterThan(4_000)
})
