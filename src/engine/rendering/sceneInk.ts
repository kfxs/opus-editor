/**
 * ⭐ **THE SCENE'S BOX, READ IN VexFlow's DIALECT** — the adapter half of P6a
 * (`engine/scene/sceneBox` is the arithmetic; `docs/own-engraving-engine.md` §5 P6).
 *
 * ## ⭐⭐ Why this file exists at all, and it is one sentence
 *
 * A scene records **what the drawing call said** — `setFont(family, 30)` — and computing a glyph's
 * ink needs to know what that 30 MEANS. ⭐ **It means POINTS, and that is a fact about VexFlow**
 * (`Font.scaleToPxFrom.pt` = 4/3, `./drawnFontSize`), ⛔ not about the drawing:
 *
 * - `engine/scene/` may not know it — it knows `paint/` and `fonts/`, and a renderer's unit
 *   convention is neither;
 * - ⛔ `engine/fonts/` may not know it either — it *"is the FONT AS DATA and must not know who draws
 *   with it"*, which is the boundary's own sentence.
 *
 * ⇒ the dialect lives HERE, with the painter whose dialect it is, and the box arithmetic takes it as
 * a named argument. ⭐ When P1e's own painter writes sizes, this is the one file that changes.
 *
 * ⚠️ **ONE consumer so far** (P6b, 2026-09-14): the ACCIDENTAL's hit box, through
 * {@link drawnInkBoxOf} — `rendering/EngravedAccidental` measures what it stamped and the registry
 * files that. ⛔ Every other element still stores VexFlow's own box; this file's job is to make the
 * switch one kind at a time, ⛔ never a flag day.
 */
import { drawnFontPx } from './drawnFontSize'
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Scene, SceneFont, SceneNode } from '@/engine/scene/Scene'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import type { NodeFilter, SceneBox, SceneBoxDetail, SpacePxReader } from '@/engine/scene/sceneBox'
import { sceneInkBox, sceneInkBoxDetail } from '@/engine/scene/sceneBox'

/**
 * ⭐ How many pixels one of the FONT's staff spaces is, at the size a run was drawn — VexFlow's
 * three spellings, and ⛔ no fourth.
 *
 * A SMuFL em is FOUR staff spaces, so the glyph table's units scale by `em / 4`.
 *
 * | what the scene holds | what it means | why it appears |
 * |---|---|---|
 * | `30` | 30 **points** | a bare number handed to `setFont` — VexFlow's own reading |
 * | `'30pt'` | 30 points | what `Element.setFontSize(30)` writes back |
 * | `'40px'` | 40 pixels | a size authored in pixels |
 *
 * 🚨 The points case is the one that matters: reading a bare 30 as PIXELS is a clean ×4/3 error, and
 * it is exactly the bug that once made five outside-staff families a quarter too tight
 * (`./drawnFontSize`). ⛔ Anything else answers null — the text is then UNMEASURED, never measured
 * wrongly.
 */
export const vexFontSpacePx: SpacePxReader = (font: SceneFont) => {
  const size = font.size
  if (typeof size === 'number') return drawnFontPx(size) / 4
  if (typeof size !== 'string') return null
  const pt = /^\s*([\d.]+)\s*pt\s*$/.exec(size)
  if (pt) return drawnFontPx(parseFloat(pt[1])) / 4
  const px = /^\s*([\d.]+)\s*px\s*$/.exec(size)
  if (px) return parseFloat(px[1]) / 4
  return null
}

/**
 * ⭐ The box of everything drawn under `node`, in page pixels — ⛔ **null when any part of it could
 * not be measured**, so an incomplete box is never mistaken for a complete one.
 */
export function drawnInkBox(node: SceneNode | Scene, include?: NodeFilter): SceneBox | null {
  return sceneInkBox(node, vexFontSpacePx, include)
}

/** {@link drawnInkBox}, with the list of drawn strings it had no measurement for. */
export function drawnInkBoxDetail(node: SceneNode | Scene, include?: NodeFilter): SceneBoxDetail {
  return sceneInkBoxDetail(node, vexFontSpacePx, include)
}

/**
 * ⭐⭐ **THE BOX OF WHAT A DRAWING DRAWS** — hand it the same call that paints, get back what that
 * call covers. This is P6b's seam: a hit box computed from the ink, ⛔ not asked of a VexFlow object
 * and ⛔ not measured off the page.
 *
 * ```ts
 * drawAccidental(surface, ink)                        // the paint
 * const box = drawnInkBoxOf(ctx => drawAccidental(ctx, ink))   // its measure
 * ```
 *
 * ⭐⭐ **Why it takes the DRAWING and not the glyph's four numbers**, which is the whole reason this
 * exists rather than a `glyphBox(text, x, y, font)` helper: a mirror of the stamp would be a SECOND
 * OWNER of what the stamp does, and *"the second owner is the tell"* has been this migration's
 * finding in the ledger line, the stem, the beam quad and the curve's control points. Replaying the
 * real call into a recorder cannot drift from it — the font normalisation, the origin convention and
 * the group nesting are all the ones that actually ran.
 *
 * ⚠️ The recorder has **no forward**, so this paints nothing: it is a measurement, and calling it
 * must never be able to put a mark on the page. ⇒ the caller draws once for the page and once for
 * the ruler; the second is a handful of plain objects and ⛔ no DOM, no reflow (which is the point —
 * `getBBox()` forces a style+layout flush, `dev/layoutFlushCensus`).
 *
 * @returns null when any part of what was drawn could not be measured — see {@link drawnInkBox}.
 */
export function drawnInkBoxOf(draw: (ctx: DrawContext) => void): SceneBox | null {
  const recorder = new SceneRecorder()
  draw(recorder)
  return drawnInkBox(recorder.scene)
}
