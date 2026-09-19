import type { MusicEngine } from '../engine/MusicEngine'
import type { SpanMarkKind } from '../engine/models/spanMarkModel'
import { selectedOf, type EditorState, type SelectedElement } from './EditorState'
import { SPAN_MARK_TOOLS } from './spanMarkTools'
import type { ElementKeys } from './elements/keys'

/**
 * ⭐⭐ **THE KEYS THAT MOVE A SELECTED SPAN MARK** — the arrows, `Ctrl+Backspace` and `Tab`, for the
 * whole family through one set of verbs reading {@link SPAN_MARK_TOOLS}.
 *
 * `shortcutWiring` held FIVE of these per kind, each a five-line closure differing only in the noun
 * inside it — `nudgeArmedPedalEnd` / `nudgeArmedOttavaEnd` / `nudgeArmedTrillEnd` / … — which is the
 * "⭐ *a slice too thin to be logic is still a slice*" shape CLAUDE.md forbids, in a function the
 * plan already names for its size (1,648 lines). A kind now writes a table row and the wiring keeps
 * one line per key.
 *
 * ⭐⭐ **THE CHORD IS READ BY WHAT YOU PICKED: something armed → that end moves; nothing armed → the
 * whole mark does.** That is one sentence for the family, and it is why each verb here comes in a
 * pair that declines when the other's case holds — `endpoint` set, or `endpoint` absent. The pair
 * never both fire, so the caller can chain them in either order.
 *
 * ⭐⭐ **THE HORIZONTAL WALKS; THE VERTICAL IS A PLAIN LIFT.** A sideways press moves the INK, and
 * hands the mark's anchor along when the ink reaches the next stop (`./markDrive`) — so N presses and
 * a drag covering the same distance land in ONE state rather than two that merely look alike. ⚠️ That
 * means a horizontal key can end in a MODEL write, which is the crossing and nothing else. A vertical
 * press never crosses anything: it is an offset, and the mark's SYSTEM JUMP is a mouse gesture,
 * needing a hand to say which staff.
 *
 * ⭐⭐ **AND THIS IS THE ONE PLACE THAT CONVERTS SCREEN → THE MODEL'S OWN SIGNING**, because a KEY is
 * a screen direction: `↑` must lift the mark on whichever side of the staff it is drawn, while an
 * `outward`-spelled number means "further from the staff" so that flipping 8va↔8vb cannot invert a
 * nudge the user already made. The row answers which it is ({@link SpanMarkToolSpec.verticalSign});
 * a kind drawn on one side permanently answers `1` and nothing is flipped.
 *
 * ⚠️ Every verb DECLINES (false) rather than repainting when nothing was written — no mark of that
 * kind selected, the wrong half of the armed/unarmed pair, or the model refusing the step (the end of
 * the lane, the page limit, a shortening that would leave the mark holding no music). The caller
 * chains on a false, which is what lets several kinds share one key.
 */

/**
 * ⭐ **ONE ARROW PRESS ON AN ARMED SQUARE** — nudge that end's ink (¼ space plain, 1 space with
 * `Ctrl`), and hand the mark along if the ink has arrived at the next stop of its lane.
 */
export function nudgeArmedSpanMarkEnd(
  kind: SpanMarkKind,
  state: EditorState,
  engine: MusicEngine | null,
  dx: number,
  dy: number,
): boolean {
  const mark = selectedOf(state, kind)
  if (!engine || !mark?.endpoint) return false
  const tools = SPAN_MARK_TOOLS[kind]
  return dy === 0 && dx !== 0
    ? tools.walkEnd(engine, mark.id, mark.endpoint, dx)
    : tools.nudgeEnd(engine, mark.id, mark.endpoint, dx, tools.verticalSign(engine, mark.id) * dy)
}

/**
 * ⭐ **THE ARROWS MOVE THE WHOLE MARK when no square is armed** — the same two chords, read by what
 * you picked. ⚠️ The far end is NOT held: that is the whole difference between MOVING a mark and
 * RESHAPING it, and it is why a horizontal press here carries the length along unchanged.
 */
export function nudgeSelectedSpanMark(
  kind: SpanMarkKind,
  state: EditorState,
  engine: MusicEngine | null,
  dx: number,
  dy: number,
): boolean {
  const mark = selectedOf(state, kind)
  if (!engine || !mark || mark.endpoint) return false
  const tools = SPAN_MARK_TOOLS[kind]
  return dy === 0 && dx !== 0
    ? tools.walkWhole(engine, mark.id, dx)
    : tools.nudgeWhole(engine, mark.id, dx, tools.verticalSign(engine, mark.id) * dy)
}

/** `Ctrl+Backspace` on an ARMED square: that end's horizontal and the mark's shared vertical back to
 *  the engraver's own. DECLINEs when it was never nudged, so the key falls through. */
export function resetArmedSpanMarkEnd(
  kind: SpanMarkKind,
  state: EditorState,
  engine: MusicEngine | null,
): boolean {
  const mark = selectedOf(state, kind)
  if (!engine || !mark?.endpoint) return false
  return SPAN_MARK_TOOLS[kind].resetEnd(engine, mark.id, mark.endpoint)
}

/** `Ctrl+Backspace` with a mark selected and NOTHING armed: every nudge it carries dropped.
 *  ⚠️ DECLINEs when it carries none — which is the ordinary case, since a span's EXTENT edits are
 *  model writes rather than offsets and there is nothing for this key to take back. */
export function resetSelectedSpanMark(
  kind: SpanMarkKind,
  state: EditorState,
  engine: MusicEngine | null,
): boolean {
  const mark = selectedOf(state, kind)
  if (!engine || !mark || mark.endpoint) return false
  return SPAN_MARK_TOOLS[kind].resetWhole(engine, mark.id)
}

/**
 * `Tab` / `Shift+Tab`: arm the selected mark's next drawn square.
 *
 * ⚠️ The REGISTRY is the list, so this declines wherever the squares are not drawn — no mark of this
 * kind selected, or linear view. ⭐ A mark can have ONE stop rather than two (a pedalling whose
 * release was not drawn), which each kind's own cycle answers.
 */
export function cycleSpanMarkEnd(
  kind: SpanMarkKind,
  state: EditorState,
  engine: MusicEngine | null,
  step: 1 | -1,
): boolean {
  if (!engine) return false
  return SPAN_MARK_TOOLS[kind].cycleEnd(state, engine.getElementRegistry(), step)
}

/**
 * ⭐ **A span mark's row of the `keys` column** (`./elements/keys`) — the verbs above, asked by the
 * arrows through the selected element's own spec. One factory for the family: what a kind adds is
 * its row of {@link SPAN_MARK_TOOLS}, ⛔ not a module of its own.
 *
 * A HORIZONTAL press that landed is a key RUN — previewed, settled once with the row's commit
 * (`KeysCtx.afterMarkPress`); a vertical one renders at once.
 */
export function spanMarkKeys(kind: SpanMarkKind): ElementKeys<Extract<SelectedElement, { kind: SpanMarkKind }>> {
  const tools = SPAN_MARK_TOOLS[kind]
  return {
    nudge({ engine, state, afterMarkPress }, { id, endpoint }, dx, dy) {
      const moved = endpoint
        ? nudgeArmedSpanMarkEnd(kind, state, engine, dx, dy)
        : nudgeSelectedSpanMark(kind, state, engine, dx, dy)
      if (moved) {
        afterMarkPress(kind, id, dx, dy, () => (endpoint ? tools.commitEnd(engine, endpoint) : tools.commitWhole(engine)))
      }
      return moved
    },
    reset({ engine, state, render }, { endpoint }) {
      const was = endpoint ? resetArmedSpanMarkEnd(kind, state, engine) : resetSelectedSpanMark(kind, state, engine)
      if (was) render()
      return was
    },
  }
}
