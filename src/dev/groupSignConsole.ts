/**
 * ⭐ **THE GROUPING SIGNS, FROM THE CONSOLE** — author a brace or a bracket and see whether it drew.
 *
 * His ask, 2026-08-29: *"is it possible to give me a console tool so i check that the brackets
 * draw?"*, when P5 did not exist and nothing could put a `symbol` on a score.
 *
 * ```js
 *   __groups.bracket()   // apply to the SELECTED staves, or the whole score if none are selected
 *   __groups.brace()
 *   __groups.none()      // remove the sign from those staves
 *   __groups.dump()      // what is stored, what resolves, what room it took, what actually DREW
 * ```
 *
 * ## ⭐ IT GOES THROUGH THE MODEL NOW — so it is UNDOABLE
 *
 * ⚠️ It used to write `symbol` **straight onto the score** and re-engrave by hand, which meant no
 * undo entry and no model notification ([[reference_mutators_must_save_undo_state]]). ⛔ That hack is
 * gone: P5 built the real write (`MusicEngine.applyGroupSymbol` → `models/staffGroupOps`), and this
 * calls it like any other caller.
 *
 * ## ⭐⭐ AND IT HONOURS THE SAME SELECTION RULE THE PALETTE WILL
 *
 * His rule of 2026-08-29 — *"if multiple staves are selected we apply to those staves; if just one
 * staff, just that staff; if none, arm a stamp"* — lives in `interactions/groupStamp`, and this tool
 * asks **that** function rather than a copy of it. ⚠️ The one thing it cannot do is ARM: a console
 * call has no click to follow it, so where the palette would arm, this falls back to the whole
 * score and says so.
 *
 * ⛔ **Still scaffolding** in one respect: it is a console entry point, not a gesture. The palette
 * and menu rows are P5's remaining half.
 */
import type { MusicEngine } from '@/engine/MusicEngine'
import type { StaffGroup } from '@/types/music'
import { groupsAt } from '@/engine/models/staffGroups'
import { groupTargetFromSelection } from '@/interactions/groupStamp'
import type { EditorState } from '@/interactions/EditorState'
import { systemStartColumn, scoreSystemStartIndentSpaces, scoreSystemStartIndentPx } from '@/engine/layout/systemStartColumn'

/** The class `systemStart` draws its signs into, once VexFlow's `openGroup` has prefixed it. */
const SIGN_SELECTOR = 'g.vf-systemsign'

export interface GroupSignConsole {
  brace(): void
  bracket(): void
  none(): void
  dump(): void
}

export function groupSignConsole(
  getEngine: () => MusicEngine | null,
  container: () => ParentNode,
  /** The editor's state, so the console honours the SAME selection rule the palette will. */
  getState?: () => EditorState,
  /** Re-engrave. ⭐ Needed because `applyGroupSymbol` records undo but this is a dev call outside
   *  the controller's own render cycle. */
  render: () => void = () => getEngine()?.renderScore(),
): GroupSignConsole {
  function apply(symbol: StaffGroup['symbol'] | undefined): void {
    const engine = getEngine()
    if (!engine) return
    const staves = engine.getScore().staves ?? []
    if (staves.length === 0) { console.warn('[groups] no staves'); return }

    // ⭐⭐ **THROUGH THE MODEL, so it is UNDOABLE** — since P5 landed there is a real write
    // (`MusicEngine.applyGroupSymbol` → `models/staffGroupOps`). ⚠️ This used to set `symbol`
    // straight on the score and re-engrave by hand, which meant no undo and no model notification.
    // ⛔ That hack is gone; what is left here is only the *targeting*, which the real gesture takes
    // from the selection (`interactions/groupStamp`).
    const target = targetFromSelection() ?? { fromStaff: 0, toStaff: staves.length - 1 }
    const changed = engine.applyGroupSymbol(target.fromStaff, target.toStaff, symbol)
    console.log(
      `[groups] ${symbol ?? '(none)'} on staves ${target.fromStaff + 1}–${target.toStaff + 1}` +
      ` — ${changed ? 'applied (undoable)' : 'no change'}`,
    )
    if (changed) render()
    dump()
  }

  /** ⭐ The SAME rule the palette will use — his APPLIES-else-ARMS of 2026-08-29. Null here means
   *  "nothing named the staves", and this console tool falls back to the whole score rather than
   *  arming, because a console call has no click to follow it. */
  function targetFromSelection(): { fromStaff: number; toStaff: number } | null {
    return getState ? groupTargetFromSelection(getState()) : null
  }

  function dump(): void {
    const engine = getEngine()
    if (!engine) return console.warn('[groups] no engine')
    const score = engine.getScore()
    const staves = score.staves ?? []
    const groups = score.staffGroups ?? []

    console.log(`[groups] ${staves.length} stave(s), ${groups.length} group(s)`)
    if (groups.length === 0) {
      console.log('  (none — nobody has applied a sign; the model no longer invents one)')
    } else {
      console.table(groups.map(g => ({
        id: g.id.slice(0, 8),
        staves: g.staffIds.map(id => staves.findIndex(s => s.id === id)).join(','),
        symbol: g.symbol ?? '— (absent: no sign was asked for)',
      })))
    }

    // What the RESOLVER makes of it — the gate, and the innermost-first order.
    const resolved = groupsAt(score, 1)
    const column = systemStartColumn(resolved)
    if (resolved.length === 0) {
      console.log('  resolves to NO SIGNS. ⭐ That is the `symbol` gate, not a bug — '
        + 'run __groups.bracket() to author one.')
    } else {
      console.table(column.signs.map(s => ({
        symbol: s.group.symbol,
        staves: `${s.group.topStaffIndex}..${s.group.bottomStaffIndex}`,
        'depth (sp)': s.depthSpaces,
        'left of staves (sp)': Number(s.leftSpaces.toFixed(3)),
      })))
    }
    console.log(`  indent: ${scoreSystemStartIndentSpaces(score).toFixed(3)} staff spaces `
      + `= ${scoreSystemStartIndentPx(score).toFixed(1)} px`)

    // ⭐ And the thing he actually asked: did it DRAW? Counted off the live SVG, not inferred.
    const drawn = [...container().querySelectorAll(SIGN_SELECTOR)]
    const rects = drawn.reduce((n, g) => n + g.querySelectorAll('rect').length, 0)
    const glyphs = drawn.reduce((n, g) => n + g.querySelectorAll('text').length, 0)
    console.log(`  DRAWN: ${drawn.length} sign group(s) in the SVG — ${rects} rod(s), ${glyphs} serif(s).`)
    if (resolved.length > 0 && drawn.length === 0) {
      console.warn('  🚨 resolved a sign but drew none — that is a real bug, not a missing symbol.')
    }
  }

  return { brace: () => apply('brace'), bracket: () => apply('bracket'), none: () => apply(undefined), dump }
}
