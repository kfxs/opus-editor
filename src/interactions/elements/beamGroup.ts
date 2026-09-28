/**
 * A BEAM — the whole beam of a beamed group, every line of it (his ask, 2026-09-28: *"if I have a beamed group I
 * cannot select a beam like individual element, I should be able to do this"*). ↑/↓ push it up or down (`Ctrl`
 * coarser — `./beamGroupKeys`, the same day); Delete declines.
 *
 * Its ink is filed by `engine/rendering/beams/beamHitInk` — one `'beamGroup'` entry per drawn LINE, its slanted
 * band as `points`, anchored on the group's first NOTE — so a press is tested against the beam's own ink, and
 * the heads and stems under a slanted beam keep theirs.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import type { HighlightContext } from './highlightContext'
import { selectedOf } from '../state/EditorState'
import { voiceFillColor } from '@/utils/voiceColors'
import type { ElementInfo, ElementRegistry } from '@/engine/ElementRegistry'
import { BEAM_GROUP_KEYS } from './beamGroupKeys'
import { handleHitBox, paintHandleSquare } from './handleSquare'
import { beginBeamEndDrag } from '../drags/beamEnd'
import { beginBeamBodyDrag } from '../drags/beamBody'
import { beamGroupStems, beamStandsAbove } from '@/engine/layout/beamStemFloor'

/** How far past its ink a beam line still takes a press, px — a beam is half a space thick. A changeable default. */
const BEAM_CLICK_PAD = 2

export const BEAM_GROUP_ELEMENT: ClickableElementSpec = {
  kind: 'beamGroup',
  /**
   * Select a BEAM. THE NOTE COMES FIRST, as for every sub-element: a press the notehead owns stays the note's.
   * Then containment in one of the beam's LINES (its slanted band, padded a little) — never its box.
   */
  hit({ event, registry, x, y, closestElement }, deps) {
    // ⭐ A press on a SQUARE of the selected beam PICKS that end (the arrows then move it — the angle) and arms its
    //    drag (his asks, 2026-09-28) — first, because a handle you can SEE wins the press. The squares are registered
    //    only while the beam is selected (by its highlight, below), so finding one IS "this beam is selected".
    const square = beamHandleAt(registry, x, y)
    if (square?.noteId && square.endpoint) {
      const { noteId, endpoint } = square
      return deps.pick(
        { kind: 'beamGroup', noteId, endpoint },
        () => deps.arm(door => beginBeamEndDrag(door.host, noteId, endpoint, y), event),
      )
    }
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false
    const noteId = beamGroupAt(registry, x, y)
    if (!noteId) return false
    dbg(`✓ Beam selected | anchor noteId:${noteId}`)
    // The shared tail clears the whole note selection, so only the beam shows selected — as the stem. A press on the
    // beam itself picks NO end: the arrows move the whole beam — and so does a DRAG from it (his ask, 2026-09-28).
    return deps.pick(
      { kind: 'beamGroup', noteId },
      () => deps.arm(door => beginBeamBodyDrag(door.host, noteId, y), event),
    )
  },

  highlight: ctx => {
    paintSelectedBeamGroup(ctx)
    paintBeamHandles(ctx)
  },
  // ↑/↓ push the beam, `Ctrl` coarser; `Ctrl+Backspace` puts it back (his ask, 2026-09-28).
  keys: BEAM_GROUP_KEYS,
}

/**
 * Whether (x, y) is on one beam LINE — between its top edge and that edge moved by the thickness, at that x, and
 * within its run, each padded by {@link BEAM_CLICK_PAD}. The band is `points` (`beamHitInk.beamLineBand`): top
 * edge start, top edge end, then the far edge back.
 */
export function onBeamLine(el: ElementInfo, x: number, y: number): boolean {
  const band = el.points
  if (!band || band.length !== 4) return false
  const [start, end, , startFar] = band
  if (x < Math.min(start.x, end.x) - BEAM_CLICK_PAD || x > Math.max(start.x, end.x) + BEAM_CLICK_PAD) return false
  const t = end.x === start.x ? 0 : (x - start.x) / (end.x - start.x)
  const edgeY = start.y + Math.min(1, Math.max(0, t)) * (end.y - start.y)
  const farY = edgeY + (startFar.y - start.y)
  return y >= Math.min(edgeY, farY) - BEAM_CLICK_PAD && y <= Math.max(edgeY, farY) + BEAM_CLICK_PAD
}

/** The anchor note of the beam under (x, y), or null. */
export function beamGroupAt(registry: ElementRegistry, x: number, y: number): string | null {
  for (const el of registry.getByType('beamGroup')) {
    if (el.noteId && onBeamLine(el, x, y)) return el.noteId
  }
  return null
}

/**
 * Highlight the selected BEAM — the LINES of its drawn `g.beam`, in the anchor's voice colour. ⭐ Found THROUGH the
 * anchor's stem: a beamed stem is drawn inside its beam's group, and the stem is resolved by identity
 * (`getStaveNoteSVGGroup`), so no render-local id is needed. ⛔ Not the stems the same group draws: a stem is its
 * own element, and a beam selected is not its notes. A beam line is a filled band, so FILLED.
 */
export function paintSelectedBeamGroup(ctx: HighlightContext): void {
  const engine = ctx.engine
  const noteId = selectedOf(ctx.state, 'beamGroup')?.noteId
  if (!noteId) return
  const group = engine.getStaveNoteSVGGroup(noteId)?.stem?.closest('g.beam')
  if (!group) return
  const color = voiceFillColor(engine.getNote(noteId)?.voice ?? 0)
  for (const el of group.children) {
    if (el.tagName !== 'path') continue // the stems are drawn in their own `g.stem` inside the beam's group
    const svgEl = el as SVGElement
    ctx.setAttr(svgEl, 'fill', color)
    ctx.setStyleProp(svgEl, 'fill', color)
    ctx.addClass(svgEl, 'selected-beam')
  }
}

/**
 * ⭐ How far a square's CENTRE stands off the beam's outer edge, px — the 10 the hairpin's, the pedal's, the barline
 * join's and the grouping sign's squares use: one family, one distance. His ask, 2026-09-28: on the line's middle the
 * square covered the beam.
 */
export const BEAM_HANDLE_GAP_PX = 10

/**
 * ⭐ **THE TWO SQUARES OF A SELECTED BEAM** — one at each end of its PRIMARY line, standing {@link BEAM_HANDLE_GAP_PX}
 * off its OUTER edge (away from the heads — the primary line is the outermost, so the square clears every line).
 * Grab one and drag, or pick it and use the arrows: that end moves, the other stays — the ANGLE changes
 * (`../drags/beamEnd`). Each is registered as a `'beam-group-handle'` with the beam's anchor and which end it is.
 *
 * @param above whether the beam stands above its stems (stems up) — its outer edge is then the TOP one.
 */
export function beamHandles(
  lines: readonly ElementInfo[], above = true,
): { endpoint: 'start' | 'end'; x: number; y: number }[] {
  const primary = lines[0]?.points
  if (!primary || primary.length !== 4) return []
  const [start, end, endFar, startFar] = primary
  const outer = (a: number, b: number) => (above ? Math.min(a, b) - BEAM_HANDLE_GAP_PX : Math.max(a, b) + BEAM_HANDLE_GAP_PX)
  return [
    { endpoint: 'start', x: start.x, y: outer(start.y, startFar.y) },
    { endpoint: 'end', x: end.x, y: outer(end.y, endFar.y) },
  ]
}

/** Paint the selected beam's two squares — the PICKED one armed (larger, darker, a thicker ring: the slur's look). */
export function paintBeamHandles(ctx: HighlightContext): void {
  const selected = selectedOf(ctx.state, 'beamGroup')
  if (!selected) return
  const { noteId } = selected
  const registry = ctx.engine.getElementRegistry()
  const lines = registry.getByType('beamGroup').filter(el => el.noteId === noteId)
  const above = beamStandsAbove(lines, beamGroupStems(lines, registry.getByType('stem')))
  for (const handle of beamHandles(lines, above)) {
    paintHandleSquare(ctx, handle, {
      className: `beam-group-handle beam-group-handle--${handle.endpoint}`,
      cursor: 'ns-resize',
      armed: selected.endpoint === handle.endpoint,
    })
    ctx.registry.add({
      type: 'beam-group-handle', noteId, endpoint: handle.endpoint,
      measure: lines[0].measure, staff: lines[0].staff, bbox: handleHitBox(handle),
    })
  }
}

/** The square of a selected beam under (x, y), or null. */
export function beamHandleAt(registry: ElementRegistry, x: number, y: number): ElementInfo | null {
  return registry.getByType('beam-group-handle').find(el => {
    const b = el.bbox
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
  }) ?? null
}
