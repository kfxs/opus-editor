/**
 * ⭐ **DRAGGING A GROUP OF MARKS** — several Ctrl-clicked hairpins, dynamics, slurs, trills, ottavas,
 * pedals or tempo marks follow the hand TOGETHER. The mouse's half of `../elements/groupKeys`.
 *
 * 🚨 His report, 2026-09-21: *"i select the two hairpin and drag but only drag the first one"*. A
 * plain press on a mark PICKS it — which clears the group — and arms that one mark's own drag; the
 * controller holds exactly one gesture. So a group needs a press that does not collapse it, and a
 * gesture that moves several marks.
 *
 * ## ⭐ What a group drag IS — his decision, 2026-09-21: **the INK moves, the music does not**
 *
 * A single mark's body drag is a WALK (`./bodyDrag`): its ink follows the hand and the mark
 * RE-ANCHORS at each note its ink reaches, and jumps to another staff or system vertically. A group
 * does none of that. Every member shifts by the SAME offset the hand travelled, in both axes — its
 * family's undo-free whole-mark offset (`preview…Offset`), the very write the arrows make.
 * ⛔ Not "every member runs its own walk": each walk decides from its own drawn ink and the cursor,
 * so two wedges would reach their next notes at different moments, one could jump systems while the
 * other stayed, and a refused frame on one would desynchronise the group. "Move these together" is
 * a request about ink; re-attaching a mark to other notes is a precise, single-mark act.
 *
 * ## The rules it keeps (they are `./bodyDrag`'s)
 *
 * - The delta is measured from the last ACCEPTED frame — a frame is accepted when ANY member moved.
 *   A member its family refuses (the page limit, the band) stays while the others go on.
 * - A frame redraws only the families in the group (`previewMarks`); ⛔ the drop renders for real.
 * - ONE undo entry per gesture, and none when the press never became a drag.
 * - ⭐ A press that never became a drag is a CLICK, and only then does it do what a click does:
 *   select that one mark, collapsing the group — on the RELEASE instead of on the press.
 *
 * ⚠️ Pixels become staff spaces by the PRESSED mark's own staff (a small staff's space is smaller),
 * and that one number serves the whole group: the members move as one picture.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { MarkPreviewKind } from '../../engine/rendering/marks/markPreviewPass'
import { dbg } from '../../utils/debug'
import { markItems, type MarkKind } from '../clipboard/enclosedMarks'
import { ELEMENT_HIT_ORDER, type ElementChainDeps, type MouseDownCtx } from '../elements/chain'
import type { EditorState } from '../state/EditorState'
import { markAtPress } from '../state/markGroupSelect'
import { SPAN_MARK_TOOLS } from '../stamps/spanMarkTools'
import { DRAG_TIME_THRESHOLD_MS, type DragHost, type Gesture } from './gesture'

type Member = { kind: MarkKind; id: string }

/** One family's whole-mark INK move: a frame (undo-free), and the drop's undo entry. `dx` / `dy` are
 *  SCREEN staff spaces; a family that stores "outward" converts here, as its arrows do. */
const GROUP_MOVE: { [K in MarkKind]: {
  frame(engine: MusicEngine, id: string, dx: number, dy: number): boolean
  commit(engine: MusicEngine): void
} } = {
  hairpin: { frame: (e, id, dx, dy) => e.hairpin.previewHairpinOffset(id, dx, dy), commit: e => e.hairpin.commitHairpinOffsetDrag() },
  slur: { frame: (e, id, dx, dy) => e.slur.previewSlurOffset(id, dx, dy), commit: e => e.slur.commitSlurOffsetDrag() },
  dynamic: { frame: (e, id, dx, dy) => e.dynamic.previewDynamicOffset(id, dx, dy), commit: e => e.dynamic.commitDynamicDrag() },
  tempo: { frame: (e, id, dx, dy) => e.tempo.previewTempoOffset(id, dx, dy), commit: e => e.tempo.commitTempoDrag() },
  pedal: { frame: (e, id, dx, dy) => e.pedal.previewPedalOffset(id, dx, dy), commit: e => SPAN_MARK_TOOLS.pedal.commitWhole(e) },
  ottava: {
    frame: (e, id, dx, dy) => e.ottava.previewOttavaOffset(id, dx, SPAN_MARK_TOOLS.ottava.verticalSign(e, id) * dy),
    commit: e => SPAN_MARK_TOOLS.ottava.commitWhole(e),
  },
  trill: {
    frame: (e, id, dx, dy) => e.trill.previewTrillOffset(id, dx, SPAN_MARK_TOOLS.trill.verticalSign(e, id) * dy),
    commit: e => SPAN_MARK_TOOLS.trill.commitWhole(e),
  },
}

/** The group a plain press may drag: two or more marks, and ⛔ no note among the selection — a boxed
 *  passage (notes with the marks that ride along) is not this gesture's. */
export function draggableMarkGroup(state: EditorState): Member[] | null {
  const items = [...state.selectedItems.values()]
  if (items.some(item => item.kind === 'note')) return null
  const marks = markItems(items)
  return marks.length >= 2 ? marks : null
}

/**
 * ⭐ THE PRESS — asked BEFORE the element chain, because the chain's first act on a mark is to pick
 * it and collapse the group. Arms the group gesture and consumes the press when a PLAIN press lands
 * on a member of a group of marks; declines otherwise, and the chain runs as it always did.
 */
export function armMarkGroupDrag(ctx: MouseDownCtx, state: EditorState, deps: ElementChainDeps, host: DragHost): boolean {
  const { event } = ctx
  if (event.ctrlKey || event.metaKey || event.shiftKey) return false
  const group = draggableMarkGroup(state)
  if (!group) return false
  const pressed = markAtPress(ctx)
  if (!pressed || !group.some(m => m.kind === pressed.kind && m.id === pressed.id)) return false

  /** What the press would have done had there been no group: the chain, with every drag door shut. */
  const click = () => {
    const shut: ElementChainDeps = { ...deps, arm: () => {} }
    for (const element of ELEMENT_HIT_ORDER) if (element.hit(ctx, shut)) return
  }
  deps.arm(() => beginMarkGroupDrag(host, group, pressed, { x: ctx.x, y: ctx.y }, click), event)
  return true
}

export function beginMarkGroupDrag(
  host: DragHost, group: readonly Member[], pressed: Member, press: { x: number; y: number }, click: () => void,
): Gesture {
  let last = press
  let changed = false
  const pressedAt = Date.now()
  const families = [...new Set(group.map(m => m.kind))]

  return {
    kind: 'markGroup',

    move(engine, mx, my) {
      if (Date.now() - pressedAt < DRAG_TIME_THRESHOLD_MS) return
      const space = staffSpacePx(engine, pressed)
      const dx = (mx - last.x) / space
      const dy = (my - last.y) / space
      if (dx === 0 && dy === 0) return
      let moved = false
      for (const member of group) moved = GROUP_MOVE[member.kind].frame(engine, member.id, dx, dy) || moved
      if (!moved) return
      last = { x: mx, y: my }
      changed = true
      // A frame draws its own families and nothing else. `previewMarks` redraws a FAMILY, so one
      // call per kind is enough however many members it has.
      for (const kind of families) host.render.previewMarks(kind as MarkPreviewKind, group.find(m => m.kind === kind)!.id)
    },

    end() {
      const engine = host.getEngine()
      if (engine && changed) {
        // ⭐ ONE undo entry: each family's commit asks for one, and the batch around them pushes once.
        engine.runBatch(`Move ${group.length} marks`, () => { for (const kind of families) GROUP_MOVE[kind].commit(engine) })
        host.render.renderScore()
        dbg(`Mark group moved | ${group.length} mark(s)`)
      }
      host.release()
      // ⭐ Never a drag ⇒ it was a click, and a click on one mark selects that mark.
      if (!changed) click()
    },
  }
}

/** One staff space of the pressed mark's own staff, in SVG px — 10 when it cannot be read. */
function staffSpacePx(engine: MusicEngine, mark: Member): number {
  const registry = engine.getElementRegistry()
  // ⚠️ `?.`: a headless registry (a spec's stub) has no such reader, and 10 is the honest fallback.
  const drawn = registry.getByType?.(mark.kind)?.find(el => el.id === mark.id)
  const geometry = drawn?.measure !== undefined ? registry.getStaffGeometry(drawn.measure, drawn.staff ?? 0) : undefined
  return geometry?.lineSpacing || 10
}
