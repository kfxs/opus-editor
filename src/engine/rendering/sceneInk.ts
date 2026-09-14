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
 * ⚠️ **Nothing is wired into the editor yet.** P6a computes and PROVES (`sceneBox.test.ts`, and
 * `e2e/sceneBox.e2e.ts` against the real page); `ElementRegistry` still stores VexFlow's own boxes.
 */
import { drawnFontPx } from './drawnFontSize'
import type { Scene, SceneFont, SceneNode } from '@/engine/scene/Scene'
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
