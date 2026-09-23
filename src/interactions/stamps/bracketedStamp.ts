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
 * ⏭️ P3: a click on a GRACE targets that grace (the pre-bend into it).
 */
import { dbg } from '@/utils/debug'
import { measureCapacityQuarters } from '@/utils/measureCapacity'
import { entryAlteration } from '../../engine/models/entryAlteration'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { ElementRegistry } from '../../engine/ElementRegistry'
import { bracketedGhostHead } from '../../engine/rendering/ghosts/BracketedGhost'
import { armedTool, type EditorState } from '../state/EditorState'
import { nearestHost } from './graceTarget'

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
  const host = nearestHost(engine, registry, position.measure, position.staff, (head.left + head.right) / 2)
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
  // ⭐ Drawn as the ARMED value, as a grace is (B7 revised: a half's head is hollow).
  const made = engine.bracketed.add(host.id, tool.side, spelling, undefined, host.type === 'rest' ? position.beat : undefined, state.selectedDuration)
  if (!made) {
    dbg(`· Bracketed stamp: note ${host.id} refused it (see bracketedGraceOps.addBracketed) — no change`)
    return true
  }
  dbg(`✓ Bracketed grace stamped | ${step}${state.selectedAccidental ?? ''}${octave} ${tool.side} ${host.id}`)
  render()
  return true
}
