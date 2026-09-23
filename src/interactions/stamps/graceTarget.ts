/**
 * ⭐⭐ **WHERE A GRACE CLICK LANDS** — `docs/plans/grace-notes-plan.md` P2a, his rule of 2026-09-22:
 * *"it should behave like note entry"*. Note entry reads a click's **x as a COLUMN** and its **y as a
 * PITCH** (`NoteEntryCoordinator.addNoteAtPosition`); a grace group is read the same way, its graces as
 * small columns:
 *
 * - x in a grace's COLUMN → the click's pitch joins THAT grace (`chordWith`) — a grace chord;
 * - x in a GAP → a new grace stands there (`index`): before the first grace, between two, or between
 *   the last and the main note.
 *
 * ⚠️ The GHOST does not snap to this answer: its x follows the pointer smoothly, as the note ghost's
 * does (his call, 2026-09-22 — a ghost snapped to the column it would hit jumped, *"not smooth"*).
 *
 * Read off the LAST RENDER (the registry's grace heads) and the model (which grace each head is): a
 * group is where it was DRAWN, offsets included.
 */
import { staffOf } from '@/utils/lanes'
import { measureCapacityQuarters } from '@/utils/measureCapacity'
import { GRACE_SIDES, graceGroupOf } from '@/utils/graceNotes'
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import type { MusicEngine } from '../../engine/MusicEngine'
import { graceGhostHead } from '../../engine/rendering/ghosts/GraceGhost'
import type { NoteDuration } from '@/types/music'

/**
 * ⭐ The click's reach, in the staff's spaces — ROWS, his eye (⛔ not a blocker). Graces stand ~0.8 sp
 * apart edge to edge, so a column is exactly its head(s) and the air between is the gap.
 */
export const GRACE_CLICK = {
  /** How far past a grace's head(s) a click still joins it. */
  columnMargin: 0,
  /** How far LEFT of a group's first head a click still belongs to that group (a new first grace). */
  groupReach: 1.5,
  /** How far (px) a click may be from a note's head in x to start a group on it — the stamp's old reach. */
  hostReachPx: 45,
}

export interface GraceTarget {
  /** The note or rest the grace hangs on. */
  host: ElementInfo
  /** Where a NEW grace stands in the group, left to right. */
  index: number
  /** The first pitch of the grace the click joins, when it is in that grace's column. */
  chordWith?: string
}

/** One drawn grace: its place in the group and the x's its head(s) span. */
interface GraceColumn {
  index: number
  firstPitchId: string
  left: number
  right: number
}

interface DrawnGroup {
  host: ElementInfo
  columns: GraceColumn[]
}

/**
 * ⭐ The click at (x, y): its bar, staff, beat and pitch — note entry's reading — and where in the grace
 * groups it lands. ⭐ **Judged at the GHOST's HEAD, not the pointer** (his rule, 2026-09-22): the ghost
 * parks its head left of the arrow (`GraceGhost.graceGhostHead`), and what the user aims is that head.
 */
export function graceClickAt(
  engine: MusicEngine, registry: ElementRegistry, x: number, y: number, duration: NoteDuration,
): { position: ReturnType<MusicEngine['pixelToPosition']>; target: GraceTarget | null } {
  const measureNumber = engine.pixelToMeasure({ x, y })
  const measure = engine.getScore().measures.find(m => m.number === measureNumber)
  const position = engine.pixelToPosition({ x, y }, measure ? measureCapacityQuarters(measure) : 4)
  const space = registry.getStaffGeometry(position.measure, position.staff)?.lineSpacing
  const head = graceGhostHead(x, duration, space)
  return { position, target: graceTargetAt(engine, registry, position.measure, position.staff, (head.left + head.right) / 2) }
}

export function graceTargetAt(
  engine: MusicEngine, registry: ElementRegistry, measure: number, staff: number, x: number,
): GraceTarget | null {
  const space = registry.getStaffGeometry(measure, staff)?.lineSpacing ?? 10
  const groups = drawnGroups(engine, registry, measure, staff)
  // ⭐ A click inside a group's drawn extent belongs to THAT group first — a long group reaches past the
  //    stamp's old 45 px, and a click left of its first grace would otherwise go to the previous note.
  const inside = groups.filter(g => x >= g.columns[0].left - GRACE_CLICK.groupReach * space && x <= hostX(g.host))
  const group = inside.sort((a, b) => Math.abs(hostX(a.host) - x) - Math.abs(hostX(b.host) - x))[0]
  if (group) return targetIn(group, x, space)

  const host = nearestHost(engine, registry, measure, staff, x)
  if (!host) return null
  const drawn = groups.find(g => g.host.id === host.id)
  return drawn ? targetIn(drawn, x, space) : { host, index: 0 }
}

/** Column or gap, inside one group. */
function targetIn(group: DrawnGroup, x: number, space: number): GraceTarget {
  const margin = GRACE_CLICK.columnMargin * space
  const { columns, host } = group
  const hit = columns.find(c => x >= c.left - margin && x <= c.right + margin)
  if (hit) return { host, index: hit.index, chordWith: hit.firstPitchId }
  return { host, index: columns.filter(c => c.right < x).length }
}

/** The graces drawn before each note/rest of this bar and staff, by their registered heads. */
function drawnGroups(engine: MusicEngine, registry: ElementRegistry, measure: number, staff: number): DrawnGroup[] {
  const here = [...registry.getByType('note'), ...registry.getByType('rest')]
    .filter(el => el.measure === measure && staffOf(el) === staff && el.id)
  const byId = new Map(here.map(el => [el.id!, el]))
  const bar = engine.getScore().measures.find(m => m.number === measure)
  const out: DrawnGroup[] = []
  for (const slot of bar?.slots ?? []) {
    const host = byId.get(slot.type === 'chord' ? slot.notes[0]?.id ?? '' : slot.id)
    if (!host) continue
    for (const side of GRACE_SIDES) {
      const columns: GraceColumn[] = []
      graceGroupOf(slot, side)?.notes.forEach((note, index) => {
        const heads = note.pitches.map(p => byId.get(p.id)).filter((e): e is ElementInfo => !!e)
        if (!heads.length) return
        columns.push({
          index,
          firstPitchId: note.pitches[0].id,
          left: Math.min(...heads.map(h => h.bbox.x)),
          right: Math.max(...heads.map(h => h.bbox.x + h.bbox.width)),
        })
      })
      // ⏭️ Only a group BEFORE is drawn today (P5 draws the after side) — an undrawn group has no columns.
      if (columns.length && side === 'before') out.push({ host, columns })
    }
  }
  return out
}

/** The ordinary note or rest of this bar and staff nearest the click in x — ⛔ never a grace head
 *  (it is registered as a note too, `rendering/GracePass`), and never beyond {@link GRACE_CLICK}.
 *  ⭐ Also the BRACKETED stamp's target (`./bracketedStamp`). */
export function nearestHost(engine: MusicEngine, registry: ElementRegistry, measure: number, staff: number, x: number): ElementInfo | null {
  let best: ElementInfo | null = null
  let bestDistance = GRACE_CLICK.hostReachPx
  for (const el of [...registry.getByType('note'), ...registry.getByType('rest')]) {
    if (el.measure !== measure || staffOf(el) !== staff || !el.id) continue
    if (el.type === 'note' && engine.isGraceNote(el.id)) continue
    const distance = Math.abs(hostX(el) - x)
    if (distance <= bestDistance) {
      best = el
      bestDistance = distance
    }
  }
  return best
}

function hostX(el: ElementInfo): number {
  return el.headX ?? el.bbox.x + el.bbox.width / 2
}
