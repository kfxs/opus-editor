/**
 * ⭐ **The BRACKETED grace stamp's click** (`docs/plans/bracketed-grace-plan.md` P2): a click puts a
 * bracketed grace BEFORE the note (or REST) it lands nearest, at the click's PITCH — note entry's reading: x a
 * column, y a pitch (`pixelToPosition`), judged at the GHOST's head, ⛔ not the pointer (the grace
 * stamp's rule: the ghost parks left of the arrow, and what the user aims is the ghost).
 *
 * Called by the grace stamp's click (`./graceStamp`), which is the before side's door — ⛔ not by
 * `MouseController`, whose hub ceiling is full (`CLAUDE.md`: a new feature adds a MODULE).
 *
 * The tool stays armed (a stamp is used in runs) and every click is ours while it is — a miss is a
 * no-op, never a note entered by accident.
 * ⭐ P3: in a GRACE group the click targets a GRACE — the pre-bend into it — and the group's beam
 * breaks there (B4, drawn not stored).
 */
import { dbg } from '@/utils/debug'
import { measureCapacityQuarters } from '@/utils/measureCapacity'
import { entryAlteration } from '../../engine/models/entryAlteration'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { ElementRegistry } from '../../engine/ElementRegistry'
import { bracketedGhostHead } from '../../engine/rendering/ghosts/BracketedGhost'
import { armedTool, type EditorState } from '../state/EditorState'
import { graceTargetAt, nearestHost } from './graceTarget'
import { graceGroupOf } from '@/utils/graceNotes'

export function stampBracketedAtClick(
  state: EditorState, engine: MusicEngine, registry: ElementRegistry, x: number, y: number, render: () => void,
): boolean {
  const tool = armedTool(state, 'bracketedGrace')
  if (!tool) return false

  const measureNumber = engine.pixelToMeasure({ x, y })
  const measure = engine.getScore().measures.find(m => m.number === measureNumber)
  const position = engine.pixelToPosition({ x, y }, measure ? measureCapacityQuarters(measure) : 4)
  const space = registry.getStaffGeometry(position.measure, position.staff)?.lineSpacing
  const head = bracketedGhostHead(x, state.selectedDuration, state.selectedAccidental, space)
  const aimX = (head.left + head.right) / 2
  // ⭐ P3 — read the grace groups as the GRACE stamp reads them (`graceTargetAt`: x a column or a gap):
  //    in a group, the bracket goes before the grace to the RIGHT of the gap (or the grace clicked) —
  //    the pre-bend into it; past the group's last grace, before the note itself.
  const inGroup = graceTargetAt(engine, registry, position.measure, position.staff, aimX)
  const host = inGroup?.host ?? nearestHost(engine, registry, position.measure, position.staff, aimX)
  if (!host?.id) {
    dbg('· Bracketed stamp: no note near the click — no change')
    return true
  }
  // ⭐ A REST is a target too (B10 reversed, his report 2026-09-23: *"this should work similar to grace
  //    stamp on empty measure"*): entered first, handed to the note that takes the rest's place. On a
  //    whole-bar rest the click's BEAT names where it belongs (`restGraceOps.beatRestAt`).
  // ⭐ Spelled as note entry spells a click: the ARMED accidental wins; none armed = what is in force
  //    where it stands (`entryAlteration`); an armed ♮ is FORCED, or a natural cancelling nothing would
  //    never show. It stays armed: a stamp is used in runs.
  const { step, octave } = position.spelling
  const hostBeat = host.type === 'rest' ? position.beat : engine.getNote(host.id)?.beat ?? position.beat
  const alter = entryAlteration(
    engine.getScore(), { measure: position.measure, beat: hostBeat, staff: position.staff }, step, octave, state.selectedAccidental,
  )
  const spelling = { step, octave, alter, ...(state.selectedAccidental === 'n' && { forceAccidental: true }) }
  const graceTarget = inGroup ? graceAt(engine, host.id, inGroup.chordWith, inGroup.index) : null
  // ⭐ Drawn as the ARMED value, as a grace is (B7 revised: a half's head is hollow).
  const made = engine.bracketed.add(
    graceTarget ?? host.id, tool.side, spelling, undefined,
    !graceTarget && host.type === 'rest' ? position.beat : undefined, state.selectedDuration,
  )
  if (!made) {
    dbg(`· Bracketed stamp: note ${host.id} refused it (see bracketedGraceOps.addBracketed) — no change`)
    return true
  }
  dbg(`✓ Bracketed grace stamped | ${step}${state.selectedAccidental ?? ''}${octave} ${tool.side} ${graceTarget ? `grace ${graceTarget} of` : ''} ${host.id}`)
  render()
  return true
}

/**
 * The GRACE a click in a group names — the one clicked (`chordWith`), or the one to the RIGHT of the gap
 * (`index`) — by its first pitch id; null when the gap is past the last grace (the target is the note).
 */
function graceAt(engine: MusicEngine, hostId: string, chordWith: string | undefined, index: number): string | null {
  if (chordWith) return chordWith
  for (const measure of engine.getScore().measures) {
    for (const slot of measure.slots) {
      const named = slot.type === 'rest' ? slot.id === hostId : slot.notes.some(p => p.id === hostId)
      if (!named) continue
      return graceGroupOf(slot, 'before')?.notes[index]?.pitches[0]?.id ?? null
    }
  }
  return null
}
