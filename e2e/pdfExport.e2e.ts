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

/** Every `/MediaBox [0 0 w h]` in the file, in points — one per page. */
function mediaBoxes(bytes: Buffer): { widthPt: number; heightPt: number }[] {
  return [...bytes.toString('latin1').matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)]
    .map(m => ({ widthPt: Number(m[1]), heightPt: Number(m[2]) }))
}

test('under a layout the PDF is real A4 pages; without one it is the tall column it always was', async ({ score }) => {
  // 45 bars of eighths — the same score `pages.e2e.ts` uses, and for the same reason: fewer would
  // fit on a single page and every claim about pagination would pass vacuously.
  await score.evaluate(async () => {
    const h = window.__h
    while (h.engine.getScore().measures.length < 45) h.engine.addMeasure()
    for (let measure = 1; measure <= 45; measure++) {
      for (let eighth = 0; eighth < 8; eighth++) {
        h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: '8', measure, beat: h.frac(eighth, 2) })
      }
    }
    await h.render()
  })

  // ---- Layout off: unchanged. One page, as tall as the music came out, and NOT any paper size.
  const canvas = mediaBoxes((await exportedBytes(score)).bytes)
  expect(canvas, 'the canvas prints as one page').toHaveLength(1)
  // 15 systems' worth: 1717 pt, twice an A4 page and no paper size at all — which is the point.
  expect(canvas[0].heightPt, 'as tall as the whole column').toBeGreaterThan(1500)
  expect(canvas[0].heightPt).not.toBeCloseTo(841.9, 0)

  // ---- Layout on: one sheet per page, at A4's real size.
  const drawnPages = await score.evaluate(async () => {
    window.__h.useLayout(true)
    await window.__h.render()
    return window.__h.pages().length
  })
  const paged = mediaBoxes((await exportedBytes(score)).bytes)

  expect(paged.length, 'one PDF page per page the render cast off').toBe(drawnPages)
  expect(paged.length).toBeGreaterThan(1)
  for (const box of paged) {
    // A4 is 210 × 297 mm = 595.3 × 841.9 pt. Not a coincidence to be found here: it is 210 mm
    // because the surface said millimetres, where the canvas could only ever say pixels.
    expect(box.widthPt).toBeCloseTo(595.3, 0)
    expect(box.heightPt).toBeCloseTo(841.9, 0)
  }
})
