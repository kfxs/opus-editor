/**
 * ⭐⭐ **WHERE A BRACE OR BRACKET LANDS — APPLIES, else ARMS.** P5 of docs/plans/braces-brackets-plan.md.
 *
 * **His rule, 2026-08-29**, and it is the bargain this editor already makes for the Time Signature
 * window, the Clef window and the key/barline stamps:
 *
 * > *"For applying the brace or bracket we check the measure selection: if multiple staves are
 * > selected we apply to those staves; if just one staff is selected we apply just to that staff; if
 * > no staff is selected we arm a stamp and apply to the staff we click."*
 *
 * ## ⭐ HIS FIRST TWO CASES ARE ONE CASE
 *
 * *"Multiple staves"* and *"just one staff"* need no branch: a `measureRange` carries a staff SPAN
 * since the passage work of the same day (`interactions/measurePassage`), so a one-staff selection
 * is simply `fromStaff === toStaff`. ⛔ Writing them as two rules would be two places to keep in
 * step for one sentence of behaviour.
 *
 * ## ⚠️ WHAT DOES *NOT* NAME STAVES
 *
 * A **note** selection deliberately does not, and that is the stamp bargain learned everywhere else
 * (`keySignatureStamp.keyTargetFromSelection` says the same in its own words): it would be easy to
 * read the notes' staves, but nobody stated that rule — so a press with notes selected **arms**,
 * and the next click says where. Same for a selected clef, barline or dynamic: they name a bar or a
 * line, ⛔ never a run of staves.
 */
import type { EditorState } from './EditorState'
import type { StaffGroup } from '@/types/music'
import { selectedOf } from './EditorState'
import { passageOf } from './measurePassage'

/** The staves a sign will span — 0-based indices, low→high, inclusive. */
export interface GroupTarget {
  fromStaff: number
  toStaff: number
}

/**
 * **Which staves the current selection names**, or `null` when it names none — in which case the
 * caller ARMS the stamp and the next click decides.
 *
 * ⚠️ Only while the SELECTION tool is active, like every other target-from-selection: with another
 * tool armed the palette press is about that tool, not about what happens to be highlighted.
 */
export function groupTargetFromSelection(state: EditorState): GroupTarget | null {
  if (state.selectedTool !== 'selection') return null

  const range = selectedOf(state, 'measureRange')
  if (!range) return null
  const passage = passageOf(range)
  return { fromStaff: passage.fromStaff, toStaff: passage.toStaff }
}

/**
 * The staff ids a target names, in score order.
 *
 * ⭐ Ids and ⛔ never indices past this point: `StaffGroup.staffIds` is keyed by identity, and an
 * ordinal is one staff insertion away from naming a different staff — the same reason
 * `barlineJoin` insists on an id.
 */
export function targetStaffIds(target: GroupTarget, staffIds: readonly string[]): string[] {
  const lo = Math.max(0, target.fromStaff)
  const hi = Math.min(staffIds.length - 1, target.toStaff)
  const out: string[] = []
  for (let i = lo; i <= hi; i++) out.push(staffIds[i])
  return out
}

/**
 * ⭐⭐ **THE ARMED CLICK — his third case**: *"if no staff is selected we arm a stamp and apply to
 * the staff we click."*
 *
 * ⭐ ONE staff, which is the whole difference from the APPLY path: a click names a point, and a
 * point is on one staff. A run of staves is what a SELECTION says, and a selection never reaches
 * here (`groupTargetFromSelection` returns non-null, so the palette wrote and armed nothing).
 *
 * ⚠️ **A one-staff group is legal engraving for the BRACKET** — *"a score system of only one stave
 * takes a square bracket as well as a systemic barline"* (Gould p. 516). ⏭️ A one-staff BRACE is not
 * something any source draws; that refusal, if his eye ever wants it, belongs here.
 *
 * @returns whether the click was consumed.
 */
export function stampGroupAtClick(
  state: EditorState,
  engine: {
    applyGroupSymbol(from: number, to: number, symbol: StaffGroup['symbol'] | undefined): boolean
    getElementRegistry(): { staffIndexAtY(measure: number, y: number): number }
  },
  y: number,
  measureNum: number,
  render: () => void,
): boolean {
  const tool = state.selectedMarkingTool
  if (tool?.kind !== 'group') return false

  const staff = engine.getElementRegistry().staffIndexAtY(measureNum, y)
  engine.applyGroupSymbol(staff, staff, tool.symbol)
  // Repaint even when nothing changed: the click consumed a placement, and the tool has nothing else
  // to show for it — `stampKeySignatureAtClick`'s rule, and for its reason.
  render()
  return true
}
