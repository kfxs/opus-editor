/**
 * ⭐⭐ **THE FIRST IMPLEMENTATION OF `DrawContext` THAT IS OURS** — and it records instead of
 * painting (`docs/plans/own-engraving-engine.md` P1d).
 *
 * ## ⚠️ Why the RECORDER and not the painter — the plan's own objection, applied honestly
 *
 * P1's last step was written as *"an implementation of our own — `paint/svg/`, and stop calling
 * VexFlow's context"*. ⛔ **That one is still blocked, by the argument that demoted P1 in the first
 * place:** while VexFlow objects paint themselves — 24 `vexContext` uses, every one a `StaveNote`,
 * a `Beam`, a `Stave` or a `Curve` — a replacement painter has to implement **VexFlow's**
 * `RenderContext` as well, *"so it re-implements their interface rather than escaping it"*, at the
 * highest blast radius in the plan, in exchange for four small gotchas (`save`/`restore` being
 * no-ops, the `setStyle` leak, the `vf-` prefix, `getSVGElement`'s document-wide lookup).
 *
 * ⭐⭐ **The recorder has no such constraint, and it is what the whole plan was pointing at.** §7.2:
 * *"Geometry becomes a UNIT test… this is the single most valuable item in this document — it is
 * worth more than the golden-image net of §6.3, and it is what makes P3 safe."* ⭐ It is the same
 * interface/implementation distinction that unlocked P1b: what VexFlow constrains is a painter, and
 * this is not one.
 *
 * ## How it is used
 *
 * `new SceneRecorder(realContext)` **tees**: every call is recorded *and* forwarded, so a real
 * render paints exactly as before and hands back a {@link Scene} as well. Constructed with no
 * argument it records and draws nothing, which is what a pure geometry test wants.
 *
 * ⛔ **It is not a second renderer.** It has no opinion about music, no layout, no font — it writes
 * down what it was told to draw. Everything that decides *what* to draw stays exactly where it is.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { DrawBox, DrawGroup, OpenedGroup } from '@/engine/paint/DrawGroup'
import type { Affine } from '@/engine/paint/Affine'
import { IDENTITY } from '@/engine/paint/Affine'
import type {
  Scene, SceneFont, SceneGroup, SceneNode, ScenePathOp, ScenePrimitive, SceneStyle,
} from './Scene'

/** The style state a context carries, and what `save`/`restore` push and pop. */
interface StyleState {
  fill?: string
  stroke?: string
  lineWidth?: number
  lineDash?: readonly number[]
  font?: SceneFont
}

/** A recorded group's handle. ⚠️ Its `node()` answers the {@link SceneGroup} itself — a scene has no
 *  DOM element, and a caller that needs one is asking the wrong painter. */
class RecordedGroup implements DrawGroup {
  constructor(
    private readonly group: SceneGroup,
    /** The real painter's handle, when this recorder is teeing onto one. */
    private readonly forward: DrawGroup | null,
  ) {}

  setPlacement(placement: Affine): void {
    this.group.placement = placement
    this.forward?.setPlacement(placement)
  }

  /**
   * ⚠️ **A recorder cannot measure ink.** Answering a box would mean knowing how wide a glyph is
   * drawn, which is the font's business and not the recorder's — so when teeing it asks the real
   * painter, and standalone it answers **null**, the same *"nothing measurable was drawn"* every
   * caller already handles (`reference: jsdom cannot measure glyphs`).
   *
   * ⛔ Never a guessed box: a ghost believes this answer and parks itself by it.
   */
  inkBox(): DrawBox | null {
    return this.forward?.inkBox() ?? null
  }

  discard(): void {
    // ⭐ Marked, ⛔ not deleted — *"it drew and was thrown away"* is a different fact from *"it never
    // drew"*, and a scene diff that conflated them would hide a ghost that stopped appearing.
    this.group.discarded = true
    this.forward?.discard()
  }

  tag(name: string, value: string): void {
    this.group.tags[name] = value
    this.forward?.tag(name, value)
  }

  tagLast(name: string, value: string): void {
    const last = this.group.children[this.group.children.length - 1]
    // ⚠️ A no-op on an empty group, exactly as the SVG handle is: a stroke list can be empty.
    if (last) {
      const tags = (last as { tags?: Record<string, string> }).tags ?? {}
      tags[name] = value
      ;(last as { tags?: Record<string, string> }).tags = tags
    }
    this.forward?.tagLast(name, value)
  }

  /**
   * 🚨 **THE FORWARDED node when teeing, the scene group when standalone.**
   *
   * {@link DrawGroup.node} is *"the group as the painter's own object"*, and while teeing the
   * painter is the real one — the six highlight maps store what comes back here and the editor
   * later recolours it. ⛔ Handing them a `SceneGroup` would fill those maps with objects no
   * highlight can paint, silently, on every recorded render.
   */
  node(): OpenedGroup {
    return this.forward ? this.forward.node() : this.group
  }
}

export class SceneRecorder implements DrawContext {
  private readonly root: SceneGroup =
    { kind: 'group', placement: IDENTITY, tags: {}, children: [] }

  /** The open groups, innermost last. Emitting appends to the innermost. */
  private readonly open: SceneGroup[] = [this.root]
  private readonly handles: (DrawGroup | null)[] = []

  private state: StyleState = {}
  private readonly stack: StyleState[] = []

  /**
   * The path being built by `beginPath`/`moveTo`/`lineTo`/`bezierCurveTo`.
   *
   * ⚠️ **It lives until the next `beginPath`, ⛔ not until it is painted** — that is the real
   * context's lifetime (`SVGContext` only clears `this.path` in `beginPath`), and a curve is what
   * proves it matters: `renderCurve` strokes the open outline, THEN closes the figure, THEN fills
   * it. Clearing on paint would have recorded the fill as a path made of one `closePath` and
   * nothing else — a scene that disagrees with the picture, which is worse than no scene.
   */
  private path: ScenePathOp[] = []

  /** The primitive the current path was last emitted as, while it is still unchanged — so a second
   *  paint of the SAME ops upgrades it to `'both'` instead of emitting a duplicate. Cleared by any
   *  op, and by anything that changes where a primitive would land. */
  private paintedAs: (ScenePrimitive & { kind: 'path' }) | null = null

  /**
   * @param forward the real painter to tee onto. ⭐ Omit it and this records without drawing —
   *   what a geometry unit test wants.
   * @param wrapGroup how to turn what `forward.openGroup` hands back into a {@link DrawGroup}, so
   *   placements, tags and discards reach the real page as well as the scene.
   *
   *   🚨 **It is a parameter because `scene/` may not import `rendering/`.** The wrapper for the SVG
   *   painter is `rendering/painter/svgDrawGroup`, which knows the DOM; this module must not. ⚠️ Omitting it
   *   while teeing is a real (and silent) failure mode — group operations would be recorded and
   *   never painted — which is why {@link SceneRecorder.forward} and this travel together.
   */
  constructor(
    private readonly forward?: DrawContext,
    private readonly wrapGroup?: (opened: OpenedGroup) => DrawGroup | null,
  ) {}

  /** Everything recorded so far. ⚠️ Live: the arrays are the recorder's own, ⛔ not a copy. */
  get scene(): Scene {
    return { children: this.root.children }
  }

  private get here(): SceneGroup {
    return this.open[this.open.length - 1]
  }

  private emit(primitive: ScenePrimitive): void {
    this.here.children.push(primitive as SceneNode)
  }

  /** The style a primitive is emitted with — a SNAPSHOT, because the state keeps changing after it. */
  private styleNow(): SceneStyle {
    const { fill, stroke, lineWidth, lineDash } = this.state
    return { fill, stroke, lineWidth, lineDash }
  }

  // ── Paths ──────────────────────────────────────────────────────────────────────────────────────

  beginPath(): void {
    this.path = []
    this.paintedAs = null
    this.forward?.beginPath()
  }

  moveTo(x: number, y: number): void {
    this.pushOp({ op: 'moveTo', x, y })
    this.forward?.moveTo(x, y)
  }

  lineTo(x: number, y: number): void {
    this.pushOp({ op: 'lineTo', x, y })
    this.forward?.lineTo(x, y)
  }

  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
    this.pushOp({ op: 'bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y })
    this.forward?.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y)
  }

  closePath(): void {
    this.pushOp({ op: 'closePath' })
    this.forward?.closePath()
  }

  private pushOp(op: ScenePathOp): void {
    this.path.push(op)
    // The path has changed since it was last painted, so the next paint is a new primitive.
    this.paintedAs = null
  }

  stroke(): void {
    this.finishPath('stroke')
    this.forward?.stroke()
  }

  fill(): void {
    this.finishPath('fill')
    this.forward?.fill()
  }

  /**
   * ⚠️ **A path can be painted TWICE, and the two cases are different pictures.**
   *
   * - Painted twice **unchanged** — `stroke()` then `fill()` with nothing between — is ONE shape
   *   wearing both, so the primitive is upgraded to `'both'` rather than duplicated. The selection
   *   highlight has to override both, and a reader counting ink must not see two.
   * - Painted twice with the path **grown between** — which is exactly what a curve does, closing
   *   the figure after stroking it — is two `<path>` elements on the page, one stroke-only and one
   *   fill-only. ⭐ So it is two primitives here, each carrying the ops it was actually painted with.
   */
  private finishPath(painted: 'stroke' | 'fill'): void {
    if (this.path.length === 0) return
    if (this.paintedAs) {
      if (this.paintedAs.painted !== painted) this.paintedAs.painted = 'both'
      return
    }
    // ⚠️ A COPY: the path outlives the paint (see {@link SceneRecorder.path}) and may still grow.
    const primitive: ScenePrimitive & { kind: 'path' } =
      { kind: 'path', ops: [...this.path], painted, style: this.styleNow() }
    this.emit(primitive)
    this.paintedAs = primitive
  }

  // ── Rectangles ─────────────────────────────────────────────────────────────────────────────────

  fillRect(x: number, y: number, width: number, height: number): void {
    this.emit({ kind: 'rect', x, y, width, height, style: this.styleNow() })
    this.forward?.fillRect(x, y, width, height)
  }

  pointerRect(x: number, y: number, width: number, height: number): void {
    this.emit({ kind: 'pointerRect', x, y, width, height })
    this.forward?.pointerRect(x, y, width, height)
  }

  // ── Text ───────────────────────────────────────────────────────────────────────────────────────

  setFont(font?: string | object, size?: string | number, weight?: string | number, style?: string): void {
    // ⚠️ Two shapes, both VexFlow's: a `FontInfo` object (what `Element.renderText` passes) or a
    // family plus three loose arguments. Recorded as one shape so an assertion never has to ask.
    this.state.font = typeof font === 'object' && font !== null
      ? { ...(font as SceneFont) }
      : { family: font, size, weight, style }
    this.forward?.setFont(font, size, weight, style)
  }

  fillText(text: string, x: number, y: number): void {
    this.emit({ kind: 'text', text, x, y, font: { ...this.state.font }, style: this.styleNow() })
    this.forward?.fillText(text, x, y)
  }

  // ── Style ──────────────────────────────────────────────────────────────────────────────────────

  setFillStyle(style: string): void {
    this.state.fill = style
    this.forward?.setFillStyle(style)
  }

  setStrokeStyle(style: string): void {
    this.state.stroke = style
    this.forward?.setStrokeStyle(style)
  }

  setLineWidth(width: number): void {
    this.state.lineWidth = width
    this.forward?.setLineWidth(width)
  }

  setLineDash(dashPattern: number[]): void {
    this.state.lineDash = [...dashPattern]
    this.forward?.setLineDash(dashPattern)
  }

  // ── State stack ────────────────────────────────────────────────────────────────────────────────

  /**
   * ⭐ **Here `save`/`restore` mean what they say**, which is one of the four gotchas P1 was meant to
   * close — VexFlow's SVG context has been unreliable about them. ⚠️ ⛔ That does NOT fix the real
   * render, which still paints through VexFlow's: it means the recorded scene is right about which
   * style each primitive carried, and a future painter inherits the correct behaviour for free.
   */
  save(): void {
    this.stack.push({ ...this.state })
    this.forward?.save()
  }

  restore(): void {
    this.state = this.stack.pop() ?? {}
    this.forward?.restore()
  }

  /**
   * ⛔ Recorded as a placement on a wrapper group, ⛔ not folded into every following coordinate.
   * A scene keeps transforms as transforms — that is rule 8, and it is what lets a scene be
   * re-placed without being rebuilt.
   */
  scale(x: number, y: number): void {
    this.paintedAs = null
    const group: SceneGroup = {
      kind: 'group', cls: 'ctx-scale', placement: { a: x, b: 0, c: 0, d: y, e: 0, f: 0 },
      tags: {}, children: [],
    }
    this.here.children.push(group)
    this.open.push(group)
    this.handles.push(null)
    this.forward?.scale(x, y)
  }

  // ── Grouping ───────────────────────────────────────────────────────────────────────────────────

  openGroup(cls?: string, id?: string): OpenedGroup {
    // ⚠️ A primitive in the group we are LEAVING can no longer be upgraded in place: the next paint
    // would land in a different container, so it is a new primitive there.
    this.paintedAs = null
    const group: SceneGroup = { kind: 'group', cls, id, placement: IDENTITY, tags: {}, children: [] }
    this.here.children.push(group)
    this.open.push(group)

    // ⚠️ The real painter hands back its own RAW object (an `SVGGElement`), not a handle — wrapping
    //    it is the caller's adapter's job, which is what `wrapGroup` is for.
    const forwarded = this.forward?.openGroup(cls, id)
    const handle = forwarded !== undefined ? (this.wrapGroup?.(forwarded) ?? null) : null
    this.handles.push(handle)
    return new RecordedGroup(group, handle)
  }

  closeGroup(): void {
    this.paintedAs = null
    // ⚠️ Never pop the root: an unbalanced `closeGroup` is a caller bug that must not corrupt the
    // scene into having no container at all.
    if (this.open.length > 1) this.open.pop()
    this.handles.pop()
    this.forward?.closeGroup()
  }
}
