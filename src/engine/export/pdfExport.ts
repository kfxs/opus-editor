import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'
import type { Score } from '@/types/music'
import { renderScoreSvg, svgPixelSize } from './scoreSvg'
import { outlineSvgText } from './outlineText'
import { dbg } from '@/utils/debug'

/** CSS pixels are 96 per inch; PDF units are points, 72 per inch. */
const PX_TO_PT = 72 / 96

/** PDF's own limit on a page dimension: 200 inches. Past it, a viewer rejects the page. */
const MAX_PAGE_PT = 14400

/**
 * Export the score as a **vector** PDF: real paths and real text, resolution-independent, no
 * screenshot anywhere in the pipeline. Three steps, each in its own module:
 *
 *   1. {@link renderScoreSvg}  — engrave the WHOLE score afresh, clean (no cull, no ghost, no
 *                                selection). The editor's own SVG is never touched.
 *   2. {@link outlineSvgText}  — turn the music glyphs into outlines, since the shipped fonts are
 *                                woff2 and a PDF cannot take those.
 *   3. svg2pdf + jsPDF         — walk that SVG into PDF drawing operators and save the file.
 *
 * ## One page, on purpose
 *
 * There is no document model yet — no page size, no margins, no title block, no casting-off to
 * pages — so this invents none of that. The page IS the engraved surface: wrapped view is already
 * a fixed-width column of justified systems, and the PDF is that column at 1:1, however tall it
 * comes out. When a document/layout model arrives, pagination belongs to IT (the systems' y-bands
 * are already known from the render), not here.
 */
export async function exportScorePdf(score: Score): Promise<void> {
  const { svg, dispose } = await renderScoreSvg(score)
  try {
    await outlineSvgText(svg)

    const { width, height } = svgPixelSize(svg)
    if (!(width > 0 && height > 0)) throw new Error('Export render produced an empty surface')

    const widthPt = width * PX_TO_PT
    const heightPt = height * PX_TO_PT
    if (heightPt > MAX_PAGE_PT) {
      throw new Error(
        `The score is ${Math.round(heightPt)}pt tall and a PDF page stops at ${MAX_PAGE_PT}pt. ` +
        'Splitting it across pages needs a page/layout model, which the editor does not have yet.',
      )
    }

    const doc = new jsPDF({
      unit: 'pt',
      format: [widthPt, heightPt],
      orientation: widthPt > heightPt ? 'landscape' : 'portrait',
      compress: true,
    })
    await svg2pdf(svg, doc, { x: 0, y: 0, width: widthPt, height: heightPt })
    doc.save(pdfFilename(score))
    dbg('export', `PDF written: ${Math.round(widthPt)}×${Math.round(heightPt)}pt`)
  } finally {
    dispose()
  }
}

/** The score's title as a filename — or `score.pdf` when it has none worth using. */
export function pdfFilename(score: Score): string {
  const stem = (score.title ?? '').trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)
  return `${stem || 'score'}.pdf`
}
