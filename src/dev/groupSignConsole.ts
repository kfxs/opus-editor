/**
 * ⭐ **THE GROUPING SIGNS, FROM THE CONSOLE** — turn a brace or a bracket on and see whether it drew.
 *
 * His ask, 2026-08-29: *"is it possible to give me a console tool so i check that the brackets
 * draw?"*. `docs/braces-brackets-plan.md` P3 has the bracket drawing but **P5 — the authoring — is
 * not built**, so there is no gesture that puts a `symbol` on a group yet. This is the stand-in.
 *
 * ```js
 *   __groups.bracket()   // every group in the score draws a bracket
 *   __groups.brace()     // …or a brace (⏭️ P4b — not drawn yet, so this shows the ROOM only)
 *   __groups.none()      // clear it: back to the systemic barline alone
 *   __groups.dump()      // what is stored, what resolves, what room it took, what actually DREW
 * ```
 *
 * ## ⛔ THIS IS SCAFFOLDING, NOT THE FEATURE — three ways, and each matters
 *
 * - **It writes `symbol` straight onto the score**, ⛔ bypassing `ScoreModel`'s mutators. So there is
 *   **no undo entry** and no model-change notification. ⭐ That is exactly why P5 exists: the real
 *   authoring goes through the model like every other edit
 *   ([[reference_mutators_must_save_undo_state]]).
 * - **It re-engraves by hand** (`engine.renderScore()`, not the controller's gated one) precisely
 *   *because* nothing was marked dirty — `RenderController` would ask `isRenderStale()`, be told no,
 *   and draw nothing. ⚠️ ⛔ Do not read that as a licence to render reflexively
 *   ([[feedback_think_before_rendering]]): it is the honest consequence of writing behind the model.
 * - **It sets EVERY group**, because a score has exactly one today
 *   (`ScoreModel.ensureSingleGroupSpansAllStaves`). ⛔ Not a policy — a stand-in for a selection.
 *
 * ⚠️ **And a group the model wrote has no `symbol`** (the auto-writer never invents one — the plan's
 * §1a). So on a fresh two-staff score `dump()` reports a group and *no sign*, which is correct and is
 * the whole safety of the feature: **`symbol` is what says a sign was asked for.**
 */
import type { MusicEngine } from '@/engine/MusicEngine'
import type { StaffGroup } from '@/types/music'
import { groupsAt } from '@/engine/models/staffGroups'
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
): GroupSignConsole {
  function apply(symbol: StaffGroup['symbol'] | undefined): void {
    const engine = getEngine()
    if (!engine) return
    const groups = engine.getScore().staffGroups
    if (!groups?.length) {
      console.warn('[groups] no staff groups in this score — add a second staff first (the model '
        + 'creates the group itself; this only supplies the symbol).')
      return
    }
    for (const group of groups) {
      if (symbol === undefined) delete group.symbol
      else group.symbol = symbol
    }
    // See the header: nothing marked the model dirty, so the gated path would decline to draw.
    engine.renderScore()
    console.log(`[groups] symbol = ${symbol ?? '(none)'} on ${groups.length} group(s) — redrawn.`)
    dump()
  }

  function dump(): void {
    const engine = getEngine()
    if (!engine) return console.warn('[groups] no engine')
    const score = engine.getScore()
    const staves = score.staves ?? []
    const groups = score.staffGroups ?? []

    console.log(`[groups] ${staves.length} stave(s), ${groups.length} group(s)`)
    if (groups.length === 0) {
      console.log('  (none — a single-staff score has nothing to group)')
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
    if (resolved.some(r => r.symbol === 'brace')) {
      console.log('  ⏭️ NOTE: the BRACE is not drawn yet (plan P4b). Its ROOM is reserved — '
        + 'the staves move right — but no ink lands in it.')
    }
  }

  return { brace: () => apply('brace'), bracket: () => apply('bracket'), none: () => apply(undefined), dump }
}
