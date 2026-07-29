import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'
import type { Score } from '@/types/music'
import { PX_PER_MM, resolveSurface, SKETCH_CANVAS, type Surface } from '@/engine/layout/surface'
import { pageOriginPx } from '@/engine/rendering/PagePass'
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
 *                                selection), onto the surface it is given.
 *   2. {@link outlineSvgText}  — turn the music glyphs into outlines, since the shipped fonts are
 *                                woff2 and a PDF cannot take those.
 *   3. svg2pdf + jsPDF         — walk that SVG into PDF drawing operators and save the file.
 *
 * ## The surface decides whether this is paper
 *
 * Both branches below draw the SAME engraved SVG; what differs is what a page *means*.
 *
 * - **A canvas has no physical size**, so there is no true scale to print it at and none is
 *   invented: the PDF is that column at 1:1, one tall page, px → pt at 72/96 because that is the
 *   conventional reading of a CSS pixel and not because the music is 10.6 mm tall on purpose.
 * - **A page IS millimetres**, so the PDF is those millimetres: A4 at A4, one `addPage()` per page,
 *   and a staff prints at the 7 mm an engraver expects.
 */
export async function exportScorePdf(score: Score, surface: Surface = SKETCH_CANVAS): Promise<void> {
  const { svg, pageCount, dispose } = await renderScoreSvg(score, surface)
  try {
    await outlineSvgText(svg)

    const { width, height } = svgPixelSize(svg)
    if (!(width > 0 && height > 0)) throw new Error('Export render produced an empty surface')

    const metrics = resolveSurface(surface)
    const doc = metrics.heightPx === null
      ? await writeOneTallPage(svg, width, height)
      : await writePages(svg, width, height, metrics, pageCount)

    doc.save(pdfFilename(score))
  } finally {
    dispose()
  }
}

/** The canvas: the engraved column, whole, on a single page as tall as it came out. */
async function writeOneTallPage(svg: SVGSVGElement, widthPx: number, heightPx: number): Promise<jsPDF> {
  const widthPt = widthPx * PX_TO_PT
  const heightPt = heightPx * PX_TO_PT
  // Only reachable here. Under a page surface every page is A4 (842 pt), so the limit stops
  // existing rather than being handled — which is the honest thing to tell someone who hits it.
  if (heightPt > MAX_PAGE_PT) {
    throw new Error(
      `The score is ${Math.round(heightPt)}pt tall and a PDF page stops at ${MAX_PAGE_PT}pt. ` +
      'Turn on "Use layout" to cast it off into real pages.',
    )
  }

  const doc = new jsPDF({
    unit: 'pt',
    format: [widthPt, heightPt],
    orientation: widthPt > heightPt ? 'landscape' : 'portrait',
    compress: true,
  })
  await svg2pdf(svg, doc, { x: 0, y: 0, width: widthPt, height: heightPt })
  dbg('export', `PDF written: ${Math.round(widthPt)}×${Math.round(heightPt)}pt`)
  return doc
}

/**
 * A page surface: one real sheet per page, at its real size in millimetres.
 *
 * The whole SVG is placed on **every** page, shifted by that page's own origin — so page 3 shows the
 * sheet that was engraved 3 along. Everything outside the page box is simply not displayed (PDF
 * shows only what is inside the MediaBox), so the cut lands exactly on the sheet edges the render
 * already cast off against. No slicing, no second render, and no chance of the cut disagreeing with
 * the layout: it IS the layout. Which way the sheets run is `PagePass`'s business and not read
 * here — {@link pageOriginPx} answers for both axes, so a vertical spread would need no change.
 *
 * ⚠️ The cost, stated because it is real: each page carries the whole score's drawing operators, so
 * the file grows with pages × content rather than with content. Compressed, and small in absolute
 * terms for the scores this editor makes; if it ever bites, the fix is to prune the SVG per page,
 * not to re-derive the cut.
 */
async function writePages(
  svg: SVGSVGElement,
  widthPx: number,
  heightPx: number,
  metrics: ReturnType<typeof resolveSurface>,
  pageCount: number,
): Promise<jsPDF> {
  const mm = (px: number) => px / PX_PER_MM
  const pageWidthMm = mm(metrics.widthPx)
  const pageHeightMm = mm(metrics.heightPx!)

  const doc = new jsPDF({
    unit: 'mm',
    format: [pageWidthMm, pageHeightMm],
    orientation: pageWidthMm > pageHeightMm ? 'landscape' : 'portrait',
    compress: true,
  })

  for (let page = 0; page < pageCount; page++) {
    if (page > 0) doc.addPage([pageWidthMm, pageHeightMm])
    const at = pageOriginPx(metrics, page)
    await svg2pdf(svg, doc, {
      x: -mm(at.x),
      y: -mm(at.y),
      width: mm(widthPx),
      height: mm(heightPx),
    })
  }

  dbg('export', `PDF written: ${pageCount} × ${Math.round(pageWidthMm)}×${Math.round(pageHeightMm)}mm`)
  return doc
}

/** The score's title as a filename — or `score.pdf` when it has none worth using. */
export function pdfFilename(score: Score): string {
  const stem = (score.title ?? '').trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)
  return `${stem || 'score'}.pdf`
}
