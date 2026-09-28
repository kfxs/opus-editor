/**
 * A BEAM — the whole beam of a beamed group, every line of it (his ask, 2026-09-28: *"if I have a beamed group I
 * cannot select a beam like individual element, I should be able to do this"*). Selection only, as the stem and
 * the flag: nothing acts on a selected beam yet, and Delete declines.
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

/** How far past its ink a beam line still takes a press, px — a beam is half a space thick. A changeable default. */
const BEAM_CLICK_PAD = 2

export const BEAM_GROUP_ELEMENT: ClickableElementSpec = {
  kind: 'beamGroup',
  /**
   * Select a BEAM. THE NOTE COMES FIRST, as for every sub-element: a press the notehead owns stays the note's.
   * Then containment in one of the beam's LINES (its slanted band, padded a little) — never its box.
   */
  hit({ registry, x, y, closestElement }, deps) {
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false
    const noteId = beamGroupAt(registry, x, y)
    if (!noteId) return false
    dbg(`✓ Beam selected | anchor noteId:${noteId}`)
    // The shared tail clears the whole note selection, so only the beam shows selected — as the stem.
    return deps.pick({ kind: 'beamGroup', noteId })
  },

  highlight: paintSelectedBeamGroup,
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
