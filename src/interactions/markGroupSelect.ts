/**
 * ⭐⭐ **CTRL-CLICK BUILDS A GROUP OUT OF MARKS TOO** — his ask, 2026-08-19: *"with ctr click we are
 * just able to group select and deselect notes and rest… however we should be able to also do it
 * with all elements that we are now handling group selection (tril, hairpin, slur, dynamic).. so we
 * can also use the real selection for filtering or add in copy and paste"*.
 *
 * A box already puts those six kinds in `selectedItems` (`./enclosedMarks`); this is the same set
 * built BY HAND, one press at a time — the toggle a note has always had.
 *
 * ⭐ **IT RE-RUNS THE PRESS CHAIN, IT DOES NOT RE-ASK WHERE THINGS ARE.** Which mark a press lands
 * on is a question `interactions/elements/*` already answers — with the padding, the note-body
 * guards and the ORDER that decides who wins a press two glyphs both cover (`ELEMENT_HIT_ORDER`).
 * Writing a second hit-test here would be a second answer that can disagree with the first, on
 * exactly the presses that are hardest to reproduce. So the chain runs again with a different TAIL:
 * `pick` toggles instead of replacing, and every drag/editor door is a no-op, because a modified
 * press is building a selection rather than starting a gesture.
 *
 * ⚠️ **Only the six kinds the SET can hold take part** — the chain is filtered to them, so a
 * Ctrl-click on a clef, an accidental, a dot or a barline falls through to exactly what it did
 * before (the note toggle under the pointer). ⛔ A kind whose ink is INSIDE a note's (accidental,
 * dot, articulation, stem) must not join without deciding that question first: the note fallback
 * has a 30px reach and would lose presses to it.
 */
import type { MouseDownCtx, ElementChainDeps } from './elements/chain'
import { ELEMENT_HIT_ORDER } from './elements/chain'
import type { MarkKind } from './enclosedMarks'

/** The six kinds `selectedItems` can hold by id — {@link MarkKind}, as a runtime set. */
const MARK_KINDS = new Set<string>(['dynamic', 'slur', 'hairpin', 'trill', 'ottava', 'pedal'])

/**
 * The press chain, filtered to the kinds a group can hold — in `ELEMENT_HIT_ORDER`'s own order, so
 * a hairpin under a slur resolves the same way it does on a plain click.
 */
const MARK_HIT_ORDER = ELEMENT_HIT_ORDER.filter(spec => MARK_KINDS.has(spec.kind))

/** Which mark a modified press landed on, or null — nothing is selected, armed or opened. */
export function markAtPress(ctx: MouseDownCtx): { kind: MarkKind; id: string } | null {
  const found: { at: { kind: MarkKind; id: string } | null } = { at: null }
  const deps: ElementChainDeps = {
    pick: (element) => {
      if (MARK_KINDS.has(element.kind) && 'id' in element) {
        found.at = { kind: element.kind as MarkKind, id: element.id }
      }
      return true
    },
    // The tail's other doors, all shut: a Ctrl-press picks membership, never a gesture.
    pickArticulationGroup: () => true,
    armClefDrag: () => {},
    armBarWidthDrag: () => {},
    armDynamicDrag: () => {},
    armTempoDrag: () => {},
    armHairpinOffsetDrag: () => {},
    armSlurOffsetDrag: () => {},
    // ⚠️ Never a double click: two Ctrl-presses on one mark are "in, then out", not "open the text
    // editor on it". The plain double-click still opens it.
    isDoubleClick: () => false,
    openEditor: () => {},
  }
  for (const spec of MARK_HIT_ORDER) {
    if (spec.hit(ctx, deps)) return found.at
  }
  return null
}
