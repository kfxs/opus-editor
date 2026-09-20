/**
 * ⭐⭐ **THE SCENE — what was drawn, as VALUES** (`docs/plans/own-engraving-engine.md` §7.2).
 *
 * > *"The engrave stage produces a SCENE: a plain typed array of primitives — glyph, line, quad,
 * > curve, text, group — in score coordinates, with no DOM and no VexFlow."*
 *
 * That is the single most valuable artefact in the migration plan, and §7.2 says why in one line:
 * ⭐⭐ **geometry becomes a UNIT test.** *"The whole-bar rest is centred in its bar"* stops being a
 * browser assertion and becomes arithmetic on a value, in jsdom, in milliseconds. Everything else
 * the scene buys — the golden becoming a diff that names *which primitive moved*, the PDF exporter
 * stopping being a second renderer, a ghost becoming the same scene with a style — follows from the
 * same fact: **the drawing exists somewhere other than the page.**
 *
 * ## ⭐ Why this could be built now, and could not be built before
 *
 * A scene is what a recording implementation of {@link DrawContext} produces. Until P1b every
 * drawing site named VexFlow's `SVGContext`, so there was nothing to implement; until P1c a group
 * was an `SVGGElement` that 22 sites cast, so a group could not be recorded either. ⭐ With both
 * done, the recorder is ~200 lines and needs no page at all — see `./SceneRecorder`.
 *
 * ## ⚠️ What is NOT in a scene today, and it is the honest half
 *
 * ⛔ **Anything a VexFlow object paints itself.** ⭐ That list is now SHORT — P3, P4, P5 and U1 took
 * the note's five drawing calls, its ACCIDENTALS, DOTS and ARTICULATIONS, the beam's lines, the
 * staff's own lines, the header run and both curves ⇒ ⭐⭐ **every glyph an ordinary bar draws is in
 * here**, and what is left of the list is the FAN's own heads and marks and the ghosts built from
 * `StaveNote`s.
 *
 * 🚨🚨 **⛔ And `lint:paint`'s count does NOT tell you which — that claim was wrong and it cost a
 * step.** The check counts the identifier `vexContext`; a MODIFIER never writes one, because
 * `StaveNote.drawModifiers` hands it `checkContext()`. So every accidental and every dot sat outside
 * this scene through four migration steps while that number fell 24 → 9, and nothing said so
 * (`docs/plans/note-engraving-plan.md` §1f). ⇒ ⭐ **the honest measure of what is missing is a CENSUS**
 * against the page — `ScoreRenderer.scene.test.ts` — and `lint:paint` measures COUPLING.
 *
 * ✅ What IS in it today: barlines and their joins, key signatures, the grouping signs and the
 * systemic barline, the staff's own five lines and the whole header run (clef, meter, opening
 * barline), **every slur and tie arc** (U1), hairpins, trills, octave lines, pedals, the dynamics
 * line, tempo lines, the staff-scale groups, the page sheets, and every cursor ghost that draws
 * through our own primitives.
 */
import type { Affine } from '@/engine/paint/Affine'

/** How ink was styled when a primitive was emitted — the context's state at that moment, captured. */
export interface SceneStyle {
  fill?: string
  stroke?: string
  lineWidth?: number
  lineDash?: readonly number[]
}

/** One step of a path, in the order it was issued.
 *
 * ⚠️ A `bezierCurveTo` keeps its two control points, so a reader can re-evaluate the cubic rather
 * than only see where it ended — which is what makes a slur's or a tie's arch measurable here. */
export type ScenePathOp =
  | { op: 'moveTo'; x: number; y: number }
  | { op: 'lineTo'; x: number; y: number }
  | { op: 'bezierCurveTo'; cp1x: number; cp1y: number; cp2x: number; cp2y: number; x: number; y: number }
  | { op: 'closePath' }

/** The face a run of text was drawn in. ⚠️ `size` is whatever the caller handed the context —
 *  points for a bare number, per `rendering/painter/drawnFontSize`. */
export interface SceneFont {
  family?: string
  size?: string | number
  weight?: string | number
  style?: string
}

/**
 * ⭐ **A drawn thing.** ⛔ No node, no element, no handle — a primitive is data, which is the whole
 * point: it can be compared, diffed, re-placed and painted again without being rebuilt.
 */
export type ScenePrimitive =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; style: SceneStyle }
  | { kind: 'path'; ops: ScenePathOp[]; painted: 'stroke' | 'fill' | 'both'; style: SceneStyle }
  | { kind: 'text'; text: string; x: number; y: number; font: SceneFont; style: SceneStyle }
  /** ⚠️ Not ink — an invisible rect that exists only to be hit. Recorded because it is part of what
   *  a render produced, and because a hit surface silently going missing is a real bug. */
  | { kind: 'pointerRect'; x: number; y: number; width: number; height: number }

/**
 * ⭐⭐ **A GROUP CARRIES A PLACEMENT** — rule 8, and the reason a scene can be re-placed rather than
 * re-drawn. `IDENTITY` for everything engraved normally; `paint/` composes down the stack.
 *
 * `tags` are the marks a pass put on the group itself (`data-no-hint`); a primitive's own tag lands
 * in {@link SceneGroup.lastTags} — see the recorder for why that is separate.
 */
export interface SceneGroup {
  kind: 'group'
  /** The class the pass asked for — the same name the SVG painter writes (since S15c). */
  cls?: string
  id?: string
  placement: Affine
  tags: Record<string, string>
  children: SceneNode[]
  /** Whether this group was discarded after being drawn — a ghost that measured to nothing.
   *  ⭐ Kept rather than deleted: *"it drew and was thrown away"* is a different fact from
   *  *"it never drew"*, and a diff that conflated them would hide a ghost that stopped appearing. */
  discarded?: boolean
}

export type SceneNode = ScenePrimitive | SceneGroup

/** Everything one render drew, in the order it drew it. */
export interface Scene {
  children: SceneNode[]
}

/** Depth-first walk over every node in a scene, groups included, parents before children. */
export function* walkScene(scene: Scene | SceneGroup): Generator<SceneNode> {
  for (const child of scene.children) {
    yield child
    if (child.kind === 'group') yield* walkScene(child)
  }
}

/** Every primitive in the scene, in draw order — the flat reading most assertions want. */
export function scenePrimitives(scene: Scene | SceneGroup): ScenePrimitive[] {
  return [...walkScene(scene)].filter((n): n is ScenePrimitive => n.kind !== 'group')
}

/** Every group with this class, in draw order — e.g. `'stavebarline'`. */
export function sceneGroups(scene: Scene | SceneGroup, cls: string): SceneGroup[] {
  return [...walkScene(scene)].filter((n): n is SceneGroup => n.kind === 'group' && n.cls === cls)
}
