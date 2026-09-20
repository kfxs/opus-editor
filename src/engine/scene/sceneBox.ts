/**
 * ⭐⭐ **A BOX, COMPUTED FROM WHAT WAS DRAWN** — P6 step a (`docs/plans/own-engraving-engine.md` §5 P6).
 *
 * > *"A box is COMPUTED from what was drawn, not measured off the page and not asked of an object."*
 *
 * ## ⚠️ Why the ruler needed replacing at all, and it is not a tidiness argument
 *
 * The editor has **two** rulers today and neither is ours:
 *
 * 1. **VexFlow's object arithmetic.** `Element.getBoundingBox()` is built from an object's `x`/`y`
 *    fields — so a mark left at the origin reports the origin, and a `StaveNote`'s box unions every
 *    modifier hanging off it. ⭐ This repo already refuses that answer in four places, each with its
 *    own workaround (`noteInkBox`, `CenteredTremolo`, `DynamicsLayout`, `clefOffsetPass`).
 * 2. **The PAGE, read back** — ~24 `getBBox()` sites, every one browser-only, each with a
 *    `try/catch` whose fallback means *"nothing measurable was drawn"*. 🚨 And a measured
 *    performance bill: `getBBox`/`getCTM` force a style+layout FLUSH (`dev/layoutFlushCensus`,
 *    verified in Blink, WebKit and Gecko).
 *
 * ⭐⭐ **Two bugs on 2026-09-14 were the same bug, and it was this one**: an accidental filed under
 * the wrong pitch by a positional guess, and a chord's five pitches sharing ONE head centre because
 * the registry asked the note for a column instead of asking the ink where it landed. Both reached
 * the screen rather than a spec, because a hit box can only be checked in a browser today.
 *
 * ## ⭐ What this module does
 *
 * | primitive | its box |
 * |---|---|
 * | `rect` | itself |
 * | `path` | the exact bounds of its ops — ⭐ including a cubic's true extrema, ⛔ not its control hull |
 * | `text` | the glyph's measured ink (`fonts/GLYPH_BOXES`), scaled by the drawn size |
 * | `group` | the union of its children, **placed by its `Affine`** — with the CALLER choosing which children count |
 *
 * ⭐ That last column is the thing VexFlow's box cannot do, and the reason `noteInkBox` had to exist.
 *
 * ## ⛔ What it refuses to do
 *
 * **It never guesses.** A `text` whose codepoint is not one of the 71 glyphs we measured has NO box,
 * and a union containing one is INCOMPLETE — {@link sceneInkBox} answers `null` rather than a
 * rectangle that is silently too small. ⭐ **And the same for a coordinate that is not a NUMBER**
 * ({@link SceneBoxDetail.nonFinite}): a NaN spreads through every `min`/`max` it meets while still
 * looking like a measurement. ⭐ *"A guessing fallback gets believed"* is the rule this
 * whole plan is written around, and a box is the most believable guess of all: nothing downstream
 * can tell a measured rectangle from an invented one.
 * ⇒ {@link sceneInkBoxDetail} is the same walk with its workings shown, so a caller (or a spec) can
 * ask *what* could not be measured rather than only *that* something could not.
 *
 * ⛔ **Nothing here is wired into the editor yet** — P6a computes and proves; the registry still
 * stores VexFlow's boxes. Whether it keeps STORING them or starts QUERYING a scene, and whether a
 * box is in pixels or staff spaces, are the two decisions the plan says to settle AT P6.
 */
import type { Affine } from '@/engine/paint/Affine'
import { apply } from '@/engine/paint/Affine'
import { glyphBox, glyphNameOf } from '@/engine/fonts/fontMetrics'
import type { Scene, SceneFont, SceneGroup, SceneNode, ScenePrimitive } from './Scene'

/** A rectangle in the same coordinates the scene was recorded in. */
export interface SceneBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The walk's full answer: the box, and everything it could NOT measure.
 *
 * ⚠️ `box` may be non-null while `unmeasured` is non-empty — that is a box over SOME of the ink, and
 * it is exactly the value a caller must not mistake for the whole. {@link sceneInkBox} is the strict
 * reading; this one is for diagnosis.
 */
export interface SceneBoxDetail {
  box: SceneBox | null
  /** The drawn strings whose glyph we have no measurement for, in draw order. */
  unmeasured: string[]
  /**
   * ⭐⭐ **The primitives whose own coordinates were NOT NUMBERS**, by kind, in draw order — a
   * `NaN` or an ∞ that arrived from whoever computed the drawing.
   *
   * 🚨 It is the same situation as an unmeasured glyph and it is kept apart for one reason: a
   * caller can say WHICH. *"I have no measurement for U+E4A1"* and *"this text was stamped at NaN"*
   * are different faults with different owners.
   *
   * ⚠️ **Today's only producer is VexFlow, and only in jsdom**: `Articulation.draw` centres a mark
   * with `setOrigin`, which divides by a glyph width that a page-less test measures as 0. ⛔ This
   * guard is NOT written for that bug — it is written because **a box is either honest or absent**,
   * and a NaN rectangle is the most believable wrong answer of all: it LOOKS like a number to
   * everything downstream, and `min`/`max` spread it silently through every union it touches.
   * ⭐ Our own painter will not produce one; this stays true when it doesn't.
   *
   * ⚠️ A GROUP can appear here too, and it means its PLACEMENT was not a finite matrix — a
   * different fault from any one child's, which is why the kind is recorded rather than a count.
   */
  nonFinite: SceneNode['kind'][]
}

/** Which nodes count toward a box. Defaults to *every ink primitive* — see {@link INK_ONLY}. */
export type NodeFilter = (node: SceneNode) => boolean

/**
 * ⭐⭐ **HOW BIG ONE OF THE FONT'S STAFF SPACES IS, at the size a run was drawn** — and it is a
 * PARAMETER, which is the whole boundary argument in one line.
 *
 * A scene records **what the drawing call said**: `setFont(family, 30)`. What that 30 MEANS is the
 * painter's dialect — VexFlow reads a bare number as POINTS (`Font.scaleToPxFrom.pt` = 4/3), which
 * is a fact about VexFlow and ⛔ not about the drawing. `scene/` may not know it (it knows `paint/`
 * and `fonts/`), and ⛔ `fonts/` may not either: it *"is the FONT AS DATA and must not know who draws
 * with it"*.
 *
 * ⇒ the caller supplies the reader, and `rendering/painter/sceneInk` is the one that speaks VexFlow.
 * ⭐ Same shape as P3b's flag reach: **the unit is a NAMED ARGUMENT, ⛔ not a hidden constant.**
 *
 * @returns null when the size is in a form the reader cannot interpret — the text is then
 *   UNMEASURED rather than measured wrongly.
 */
export type SpacePxReader = (font: SceneFont) => number | null

/**
 * ⭐ The default: ink only.
 *
 * ⛔ A `pointerRect` is **not ink** — it is an invisible hit surface, usually much larger than the
 * glyph it covers, and unioning one would make every note's "ink box" the size of its click target.
 * ⚠️ A DISCARDED group is not ink either: it drew and was thrown away.
 */
export const INK_ONLY: NodeFilter = node =>
  node.kind !== 'pointerRect' && !(node.kind === 'group' && node.discarded === true)

/**
 * ⭐⭐ **The box of everything drawn under `node`** — null when any included part could not be
 * measured, so an incomplete answer is never mistaken for a complete one.
 *
 * @param include which children count. Composed with {@link INK_ONLY}, which is never optional: a
 *   hit surface is not ink no matter what the caller asks for.
 */
export function sceneInkBox(
  node: SceneNode | Scene,
  spacePx: SpacePxReader,
  include?: NodeFilter,
): SceneBox | null {
  const detail = sceneInkBoxDetail(node, spacePx, include)
  return detail.unmeasured.length === 0 && detail.nonFinite.length === 0 ? detail.box : null
}

/** {@link sceneInkBox}, with what it could not measure. */
export function sceneInkBoxDetail(
  node: SceneNode | Scene,
  spacePx: SpacePxReader,
  include?: NodeFilter,
): SceneBoxDetail {
  const walk: Walk = {
    spacePx,
    keep: n => INK_ONLY(n) && (include?.(n) ?? true),
    unmeasured: [],
    nonFinite: [],
  }
  const box = 'kind' in node ? boxOf(node, walk) : unionOf(node.children, walk)
  return { box, unmeasured: walk.unmeasured, nonFinite: walk.nonFinite }
}

/** One traversal's state: what counts, how to read a size, and what it could not measure. */
interface Walk {
  spacePx: SpacePxReader
  keep: NodeFilter
  unmeasured: string[]
  nonFinite: SceneNode['kind'][]
}

function boxOf(node: SceneNode, walk: Walk): SceneBox | null {
  if (!walk.keep(node)) return null
  const box = node.kind === 'group' ? groupBox(node, walk) : primitiveBox(node, walk)
  // ⭐⭐ **A coordinate that is not a number is not a measurement** — see {@link SceneBoxDetail.nonFinite}.
  // ⚠️ Checked HERE, on the way out, so it catches every source at once: a primitive stamped at NaN,
  // a path whose pen went there, and a group whose PLACEMENT was singular or infinite.
  if (box && !isFinite(box.x + box.y + box.width + box.height)) {
    walk.nonFinite.push(node.kind)
    return null
  }
  return box
}

/**
 * ⭐⭐ **A GROUP CARRIES A PLACEMENT** (rule 8), so its children are measured in their own
 * coordinates and the result is mapped out through the matrix — ⛔ never the other way round, which
 * would fold a transform into coordinates and lose it.
 *
 * ⚠️ All four corners are mapped, not two: a rotation or a skew would turn a rectangle into a
 * diamond, and the box of a diamond is not the box of its opposite corners. Nothing we draw today
 * rotates — and this is what keeps that a fact about today rather than an assumption.
 */
function groupBox(group: SceneGroup, walk: Walk): SceneBox | null {
  const inner = unionOf(group.children, walk)
  return inner && placeBox(inner, group.placement)
}

function unionOf(nodes: readonly SceneNode[], walk: Walk): SceneBox | null {
  let box: SceneBox | null = null
  for (const child of nodes) box = union(box, boxOf(child, walk))
  return box
}

function primitiveBox(primitive: ScenePrimitive, walk: Walk): SceneBox | null {
  switch (primitive.kind) {
    case 'rect':
      return normalise(primitive.x, primitive.y, primitive.x + primitive.width, primitive.y + primitive.height)
    case 'path':
      return pathBox(primitive)
    case 'text': {
      const box = textBox(primitive, walk.spacePx)
      if (!box) walk.unmeasured.push(primitive.text)
      return box
    }
    // ⚠️ Unreachable through `boxOf` (INK_ONLY drops it) and kept total on purpose.
    case 'pointerRect':
      return null
  }
}

/**
 * ⭐ **A glyph's ink, from the font** — `left/right/up/down` in staff spaces, scaled by the size it
 * was actually drawn at and hung on the stamp's origin (which is the glyph's BASELINE, see
 * `engrave/glyph`).
 *
 * ⛔ Answers null rather than guessing when the codepoint is unmeasured, or when the size is not a
 * form we can read. ⚠️ A run of more than one glyph answers null too — that is a string, not a
 * symbol, and its width is a text-layout question this table cannot answer.
 */
function textBox(text: ScenePrimitive & { kind: 'text' }, spacePxOf: SpacePxReader): SceneBox | null {
  const name = glyphNameOf(text.text)
  if (!name) return null
  const spacePx = spacePxOf(text.font)
  if (spacePx === null) return null
  const ink = glyphBox(name)
  return normalise(
    text.x - ink.left * spacePx,
    text.y - ink.up * spacePx,
    text.x + ink.right * spacePx,
    text.y + ink.down * spacePx,
  )
}

/**
 * ⭐ **THE EXACT BOUNDS OF A PATH**, cubics included — ⛔ not the control hull, which is a superset
 * and would report ink where there is none. A Bézier's extrema are the roots of its derivative, so
 * each axis is a quadratic; {@link cubicBounds} solves it.
 *
 * ⚠️ **A STROKED path is wider than its geometry by half its pen**, on every side. `stroke` and
 * `both` therefore grow by `lineWidth / 2` — and where the scene recorded no width, the context's
 * own default of 1 is used, which is SVG's. ⭐ A FILLED path has no such margin, which is why the
 * two are told apart here rather than padded uniformly.
 */
function pathBox(path: ScenePrimitive & { kind: 'path' }): SceneBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  let penX = 0, penY = 0
  let drew = false

  const at = (x: number, y: number) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    drew = true
  }

  for (const op of path.ops) {
    switch (op.op) {
      case 'moveTo':
        // ⚠️ A `moveTo` is a PEN MOVE, not ink — but every path here starts with one and draws from
        // it, so it counts as the start of the run that follows.
        penX = op.x; penY = op.y
        at(op.x, op.y)
        break
      case 'lineTo':
        penX = op.x; penY = op.y
        at(op.x, op.y)
        break
      case 'bezierCurveTo': {
        const xs = cubicBounds(penX, op.cp1x, op.cp2x, op.x)
        const ys = cubicBounds(penY, op.cp1y, op.cp2y, op.y)
        at(xs.min, ys.min)
        at(xs.max, ys.max)
        penX = op.x; penY = op.y
        break
      }
      case 'closePath':
        break
    }
  }
  if (!drew) return null

  const pen = path.painted === 'fill' ? 0 : (path.style.lineWidth ?? 1) / 2
  return normalise(minX - pen, minY - pen, maxX + pen, maxY + pen)
}

/**
 * ⭐ The min and max a cubic Bézier actually reaches on one axis: its endpoints, plus any root of
 * `B'(t) = 0` that falls inside the curve.
 *
 * ⚠️ The `a === 0` branch is not defensive — a cubic whose control points are symmetric about its
 * ends degenerates to a quadratic, and that is the ordinary case for a TIE (both control deltas
 * equal). Solving it as a quadratic would divide by zero.
 */
function cubicBounds(p0: number, c1: number, c2: number, p3: number): { min: number; max: number } {
  let min = Math.min(p0, p3)
  let max = Math.max(p0, p3)

  const consider = (t: number) => {
    if (t <= 0 || t >= 1) return
    const mt = 1 - t
    const value = mt * mt * mt * p0 + 3 * mt * mt * t * c1 + 3 * mt * t * t * c2 + t * t * t * p3
    min = Math.min(min, value)
    max = Math.max(max, value)
  }

  // B'(t) = 3[(-p0 + 3c1 - 3c2 + p3)t² + 2(p0 - 2c1 + c2)t + (c1 - p0)]
  const a = -p0 + 3 * c1 - 3 * c2 + p3
  const b = 2 * (p0 - 2 * c1 + c2)
  const c = c1 - p0

  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) consider(-c / b)
  } else {
    const disc = b * b - 4 * a * c
    if (disc >= 0) {
      const root = Math.sqrt(disc)
      consider((-b + root) / (2 * a))
      consider((-b - root) / (2 * a))
    }
  }
  return { min, max }
}

/** Map a box out through a placement — all four corners (see {@link groupBox}). */
function placeBox(box: SceneBox, placement: Affine): SceneBox {
  const corners = [
    apply(placement, box.x, box.y),
    apply(placement, box.x + box.width, box.y),
    apply(placement, box.x, box.y + box.height),
    apply(placement, box.x + box.width, box.y + box.height),
  ]
  const xs = corners.map(p => p.x)
  const ys = corners.map(p => p.y)
  return normalise(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys))
}

function union(a: SceneBox | null, b: SceneBox | null): SceneBox | null {
  if (!a) return b
  if (!b) return a
  return normalise(
    Math.min(a.x, b.x),
    Math.min(a.y, b.y),
    Math.max(a.x + a.width, b.x + b.width),
    Math.max(a.y + a.height, b.y + b.height),
  )
}

/** A box from two corners, in either order — a rect drawn with a negative width is still a box. */
function normalise(x1: number, y1: number, x2: number, y2: number): SceneBox {
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  return { x, y, width: Math.max(x1, x2) - x, height: Math.max(y1, y2) - y }
}
