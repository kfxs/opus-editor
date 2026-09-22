/**
 * ⭐ **The GRACE stamp's click** (`docs/plans/grace-notes-plan.md` §3 rule 1, D6 — decided 2026-09-22):
 * a click hangs a grace on the NOTE (or REST — D7 reversed) it lands nearest, at the click's PITCH,
 * drawn as the armed value.
 *
 * ⭐ **A hit-test, not a position** — a grace attaches to something that EXISTS, like the
 * articulation stamp and unlike the fan's. The host is the nearest ordinary note of the clicked bar
 * and staff by x (a grace before is placed just LEFT of it, so the click lands in the gap, not on the
 * head); the pitch is the click's y through `pixelToPosition`, the note-entry rule.
 *
 * The tool stays armed (a stamp is used in runs) and every click is ours while it is — a miss is a
 * no-op, never a note entered by accident.
 */
import { dbg } from '@/utils/debug'
import { measureCapacityQuarters } from '@/utils/measureCapacity'
import { staffOf } from '@/utils/lanes'
import { entryAlteration } from '../../engine/models/entryAlteration'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import { armedTool, pendingArticulations, type EditorState } from '../state/EditorState'

/** How far (px) the click may be from its host's head in x — `findClosestNoteOrRest`'s tolerance,
 *  widened by the room a grace takes before its note. */
const HOST_REACH_PX = 45

export function stampGraceAtClick(
  state: EditorState, engine: MusicEngine, registry: ElementRegistry, x: number, y: number, render: () => void,
): boolean {
  const tool = armedTool(state, 'grace')
  if (!tool) return false

  const measureNumber = engine.pixelToMeasure({ x, y })
  const measure = engine.getScore().measures.find(m => m.number === measureNumber)
  const position = engine.pixelToPosition({ x, y }, measure ? measureCapacityQuarters(measure) : 4)
  const host = nearestHost(registry, engine, position.measure, position.staff, x)
  if (!host?.id) {
    dbg('· Grace stamp: no note near the click — no change')
    return true
  }
  // ⭐ A REST is a host too (D7 reversed, his call 2026-09-22): the grace is entered first, the note
  //    after it takes it over. On a whole-bar rest the click's BEAT names where it belongs.
  // ⭐ Spelled EXACTLY as note entry spells a click (his words: *"the grace should behaive like normal
  //    note entry"*): the ARMED accidental wins; none armed = what is in force where the grace sounds —
  //    the bar's running accidental, else the key (`entryAlteration`); an armed ♮ is FORCED, or a
  //    natural that cancels nothing would never show (`NoteEntryCoordinator`'s rule). It stays armed:
  //    a stamp is used in runs.
  const { step, octave } = position.spelling
  const hostBeat = host.type === 'rest' ? position.beat : engine.getNote(host.id)?.beat ?? position.beat
  const alter = entryAlteration(
    engine.getScore(), { measure: position.measure, beat: hostBeat, staff: position.staff }, step, octave, state.selectedAccidental,
  )
  const spelling = { step, octave, alter, ...(state.selectedAccidental === 'n' && { forceAccidental: true }) }
  const grace = engine.grace.addGrace(
    host.id, tool.side, spelling, tool.form, { duration: state.selectedDuration, ...(state.selectedDots && { dots: state.selectedDots }) },
    host.type === 'rest' ? position.beat : undefined,
    pendingArticulations(state),
  )
  if (!grace) {
    dbg(`· Grace stamp: note ${host.id} refused it (see graceOps.addGrace) — no change`)
    return true
  }
  dbg(`✓ Grace stamped | ${tool.form} ${spelling.step}${state.selectedAccidental ?? ''}${spelling.octave} ${state.selectedDuration} before ${host.type} ${host.id}`)
  // PLACING ends keyboard entry, as the rest stamp's click does; the tool stays armed.
  state.selectedNoteId = null
  render()
  return true
}

/** The ordinary note or rest of this bar and staff nearest the click in x — ⛔ never a grace head
 *  (it is registered as a note too, `rendering/GracePass`), and never beyond {@link HOST_REACH_PX}. */
function nearestHost(registry: ElementRegistry, engine: MusicEngine, measure: number, staff: number, x: number): ElementInfo | null {
  let best: ElementInfo | null = null
  let bestDistance = HOST_REACH_PX
  for (const el of [...registry.getByType('note'), ...registry.getByType('rest')]) {
    if (el.measure !== measure || staffOf(el) !== staff || !el.id) continue
    if (el.type === 'note' && engine.isGraceNote(el.id)) continue
    const distance = Math.abs((el.headX ?? el.bbox.x + el.bbox.width / 2) - x)
    if (distance <= bestDistance) {
      best = el
      bestDistance = distance
    }
  }
  return best
}
