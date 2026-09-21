/**
 * ⭐ **A BENT STAFF, FROM THE CONSOLE** — the first look at the machinery of
 * `docs/plans/bent-staff-plan.md` (A4): a staff is a PATH, its lines are drawn FROM the path, and
 * each note is a rigid block placed ON it by one affine.
 *
 * ```js
 *   __spine.circle()                          // 8 quarter notes a fourth apart, on a circle
 *   __spine.circle({ notes: 12, radius: 260 })
 *   __spine.straight()                        // the SAME blocks on a straight spine — the control
 *   __spine.clear()
 * ```
 *
 * ⚠️ **It draws in its OWN panel with its OWN painter, ⛔ not on the score**: the real score knows
 * nothing of spines yet (plan B), so nothing here reads the `Score`, survives in the JSON, or can be
 * clicked. A re-render of the score does not touch it.
 *
 * ⛔ **SCAFFOLDING, and it deletes cleanly**: the machinery is the engine's
 * (`engine/engrave/staff/staffSpine` · `spineLines` · `engine/rendering/eye/spineStaff`), this is the
 * entry point, and `App.ts` wires it.
 */
import { dbg } from '@/utils/debug'
import type { PitchStep } from '@/types/music'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { circleSpine, straightSpine } from '@/engine/engrave/staff/staffSpine'
import {
  drawSpineHeader, drawSpineNote, drawSpineStaffLines, type SpineNote,
} from '@/engine/rendering/eye/spineStaff'
import { SvgPainter } from '@/engine/rendering/painter/SvgPainter'

const STEPS: PitchStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

/** Diatonic indices (octave × 7 + step): the walk starts on C4 and folds down an octave above G5. */
const FIRST = 4 * 7
const CEILING = 5 * 7 + 4
const A_FOURTH = 3

/** Room around the spine for what stands outside it — stems, ledger lines. */
const MARGIN_PX = 90

/** Clear spine between the header's end and the first notehead's centre. A changeable default. */
const HEADER_TO_NOTE_PX = 30

/**
 * `count` quarter notes, each a (diatonic) fourth above the last, evenly spread from `from` to the
 * spine's end.
 */
function fourths(count: number, from: number, length: number): SpineNote[] {
  const notes: SpineNote[] = []
  let at = FIRST
  for (let i = 0; i < count; i++) {
    // N notes share the run in N parts, each standing at the START of its part — so the last one
    // keeps a part clear before the spine's end (or, on a closed spine, before the clef).
    const s = from + ((length - from) * i) / count
    notes.push({ step: STEPS[at % 7], alter: 0, octave: Math.floor(at / 7), duration: 'q', s })
    at += A_FOURTH
    if (at > CEILING) at -= 7
  }
  return notes
}

export interface SpineConsole {
  circle(options?: { notes?: number; radius?: number }): void
  straight(options?: { notes?: number; length?: number }): void
  clear(): void
}

export function spineConsole(): SpineConsole {
  let panel: HTMLElement | null = null

  const clear = () => {
    panel?.remove()
    panel = null
  }

  const show = (width: number, height: number, spine: Spine, count: number) => {
    clear()
    panel = document.createElement('div')
    panel.className = 'spine-demo-panel'
    Object.assign(panel.style, {
      position: 'fixed', right: '16px', bottom: '16px', zIndex: '9999', background: 'white',
      border: '1px solid #999', boxShadow: '0 4px 16px rgba(0,0,0,.25)',
      maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto',
    })
    document.body.appendChild(panel)
    const painter = new SvgPainter(panel)
    painter.resize(width, height)
    drawSpineStaffLines(painter, spine)
    const headerEnd = drawSpineHeader(painter, spine, 0, { clef: 'treble', meter: { numerator: 4, denominator: 4 } })
    for (const note of fourths(count, headerEnd + HEADER_TO_NOTE_PX, spine.length)) {
      drawSpineNote(painter, spine, note, 'treble')
    }
    dbg(`[spine] drew ${count} notes on a ${spine.closed ? 'closed' : 'open'} spine ${Math.round(spine.length)} px long — __spine.clear() to remove`)
  }

  return {
    circle: ({ notes = 8, radius = 200 } = {}) => {
      const size = 2 * (radius + MARGIN_PX)
      show(size, size, circleSpine(size / 2, size / 2, radius), notes)
    },
    straight: ({ notes = 8, length = 600 } = {}) => {
      show(length + 2 * MARGIN_PX, 2 * MARGIN_PX + 40, straightSpine(MARGIN_PX, MARGIN_PX, length), notes)
    },
    clear,
  }
}
