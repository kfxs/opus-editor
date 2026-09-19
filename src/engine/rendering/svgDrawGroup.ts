/**
 * ⭐ **THE SVG PAINTER'S GROUP HANDLE** — what `paint/DrawGroup` means when the surface is an SVG
 * document (`docs/own-engraving-engine.md` P1c).
 *
 * ⛔ This file knows the DOM; `paint/` does not, and `lint:boundary` holds that line. It is the
 * whole of the adapter for groups, the way `./glyphPainter` is the whole of it for glyphs. ⏭️ A
 * recording implementation (the SCENE) is a second file beside this one, and it needs no page.
 */
import type { Affine } from '@/engine/paint/Affine'
import { isIdentity, isScaling, isTranslation } from '@/engine/paint/Affine'
import type { DrawBox, DrawGroup, OpenedGroup } from '@/engine/paint/DrawGroup'

/**
 * ⭐⭐ **THE SHORTHAND IS REQUIRED, NOT COSMETIC.**
 *
 * `matrix(k 0 0 k 0 0)` and `scale(k)` place ink identically, and the browser does not care — but
 * two things in this repo read the attribute as TEXT:
 *
 * 1. 🚨 **`ScoreRenderer.moveMeasureGroup` re-composes it by string**: a bar that moves without
 *    being re-engraved gets `translate(dx, dy) scale(k)` written over whatever was there. Emitting a
 *    matrix here and a shorthand there would leave one bar's transform in each dialect.
 * 2. **Specs assert it exactly** — `GutterRenderer.staffSize.test.ts` expects `'scale(0.7)'`,
 *    `ScoreRenderer.staffSize.test.ts` and `systemStart.test.ts` the same shape.
 *
 * ⭐ So: emit the shorthand wherever it is *exactly* equivalent, and a matrix otherwise. That keeps
 * every byte this renderer used to write, while the CALLERS have moved to speaking in placements.
 * ⚠️ ⛔ Do not "simplify" this to always-matrix without changing (1) in the same commit.
 */
function transformAttr(m: Affine): string | null {
  if (isIdentity(m)) return null
  if (isScaling(m)) return m.a === m.d ? `scale(${m.a})` : `scale(${m.a}, ${m.d})`
  if (isTranslation(m)) return `translate(${m.e}, ${m.f})`
  return `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, ${m.e}, ${m.f})`
}

/** The SVG group handle. ⚠️ Its `node()` is the `SVGGElement` — see {@link DrawGroup.node}. */
class SvgDrawGroup implements DrawGroup {
  constructor(private readonly g: SVGGElement) {}

  setPlacement(placement: Affine): void {
    const attr = transformAttr(placement)
    // ⭐ An identity placement REMOVES the attribute rather than writing an identity one: a bar back
    // at its drawn position should carry no transform at all, which is `moveMeasureGroup`'s own rule
    // ("drop any stale transform rather than leaving an identity one behind").
    if (attr === null) this.g.removeAttribute('transform')
    else this.g.setAttribute('transform', attr)
  }

  inkBox(): DrawBox | null {
    // ⚠️ `getBBox` is absent in jsdom and throws in some SVG states before layout — both mean the
    // same thing here, and it is not an error: nothing measurable was drawn.
    let box: DOMRect | undefined
    try {
      box = (this.g as SVGGraphicsElement).getBBox?.()
    } catch {
      return null
    }
    if (!box || box.width === 0) return null
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  }

  discard(): void {
    this.g.remove()
  }

  tag(name: string, value: string): void {
    this.g.setAttribute(name, value)
  }

  tagLast(name: string, value: string): void {
    // ⚠️ The LAST CHILD, because a context's drawing calls return the context and not the node:
    // `fillRect` and `fillText` both append onto the open group. A group with nothing in it yet is
    // not an error — see {@link DrawGroup.tagLast}.
    this.g.lastElementChild?.setAttribute(name, value)
  }

  node(): OpenedGroup {
    return this.g
  }
}

/**
 * ⭐⭐ **THE HANDLE FOR WHATEVER `openGroup` HANDED BACK** — and a call site must not care which
 * painter is installed.
 *
 * `OpenedGroup` is deliberately painter-specific: the SVG painter returns its `SVGGElement`, and a
 * recording one (`engine/scene/SceneRecorder`) returns a handle it made itself. ⭐ Normalising here,
 * once, is what lets every pass write `drawGroupOf(ctx.openGroup(...))` and keep working when a
 * scene is being recorded — 🚨 the alternative, tried first, was a `painter === theRealOne`
 * conditional at the one call site that needed the node, which is a reader that assumes.
 *
 * ⚠️ **Answers null for a group that was never opened.** Several passes call `openGroup?.()`, which
 * is `undefined` on a context that does not group — and `inStaffSpace` has always taken a
 * possibly-absent group, because a staff at full scale needs no group at all.
 */
export function drawGroupOf(opened: OpenedGroup): DrawGroup | null {
  if (!opened) return null
  // Already a handle — a recording painter's, which knows how to forward to the real page.
  if (typeof (opened as DrawGroup).setPlacement === 'function') return opened as DrawGroup
  return new SvgDrawGroup(opened as SVGGElement)
}

/** The `SVGGElement` behind a handle this renderer made — for the maps the EDITOR reads back.
 *  ⛔ See {@link DrawGroup.node}: this is the counted escape, not a general accessor. */
export function svgNode(group: DrawGroup | null | undefined): SVGGElement | undefined {
  return (group?.node() as SVGGElement | undefined) ?? undefined
}
