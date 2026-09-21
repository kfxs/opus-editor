/**
 * ⭐ **A BENT STAFF, FROM THE CONSOLE** — `docs/plans/bent-staff-plan.md`: a staff is a PATH, its lines
 * are drawn FROM the path, and each note is a rigid block placed ON it by one affine.
 *
 * ⭐⭐ **What the panel shows IS THE OPEN SCORE** (his ask, 2026-09-21): it is drawn from the score model
 * (`engine/rendering/eye/spineScore`) and redrawn whenever the model changes — so a note typed on the
 * score canvas appears on the circle, and the JSON panel shows the same music.
 *
 * ```js
 *   __spine.circle()                 // LOADS a real score — 8 quarter notes a fourth apart — and bends it
 *   __spine.circle({ notes: 16 })
 *   __spine.show()                   // bends the score that is ALREADY open, replacing nothing
 *   __spine.show({ radius: 300 })    // a radius of your own; otherwise it grows with the music
 *   __spine.straight()               // the same panel on a straight spine — the control
 *   __spine.clear()
 * ```
 *
 * Drag the panel anywhere with the mouse.
 *
 * ⚠️ **Its OWN panel and painter, ⛔ not the score canvas**: the real canvas knows nothing of spines yet
 * (plan B), so the panel cannot be clicked into. ⚠️ `circle()` REPLACES the open score, like
 * `__perf.load`. The shape is a view of this console, ⛔ not saved in the JSON.
 *
 * ⛔ **SCAFFOLDING, and it deletes cleanly**: the machinery is the engine's
 * (`engine/engrave/staff/staffSpine` · `spineLines` · `engine/rendering/eye/*`), this is the entry
 * point, and `App.ts` wires it.
 */
import { dbg } from '@/utils/debug'
import type { PitchStep, Score } from '@/types/music'
import { ScoreModel } from '@/engine/models/ScoreModel'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { circleSpine, straightSpine } from '@/engine/engrave/staff/staffSpine'
import { drawScoreOnSpine } from '@/engine/rendering/eye/spineScore'
import { SvgPainter } from '@/engine/rendering/painter/SvgPainter'
import { fracToNumber } from '@/utils/fraction'
import { measureCapacityFrac } from '@/utils/measureCapacity'

const STEPS: PitchStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

/** Diatonic indices (octave × 7 + step): the walk starts on C4 and folds down an octave above G5. */
const FIRST = 4 * 7
const CEILING = 5 * 7 + 4
const A_FOURTH = 3
const NOTES_PER_BAR = 4

/** Room around the spine for what stands outside it — stems, ledger lines. */
const MARGIN_PX = 90

/** How much spine an automatic size gives the header, and each quarter note of music. */
const AUTO_HEADER_PX = 90
const AUTO_PX_PER_QUARTER = 48
const AUTO_MIN_RADIUS = 160

/** How often the panel asks whether the score changed — the JSON panel's own way of keeping up. */
const POLL_MS = 300

/** A real score of `count` quarter notes in 4/4, each a (diatonic) fourth above the last. */
function fourthsScore(count: number): string {
  const model = new ScoreModel(`circle of ${count} fourths`)
  const bars = Math.max(1, Math.ceil(count / NOTES_PER_BAR))
  for (let i = 1; i < bars; i++) model.addMeasure() // the constructor seeds measure 1
  let at = FIRST
  for (let i = 0; i < count; i++) {
    model.addNote({
      step: STEPS[at % 7],
      octave: Math.floor(at / 7),
      duration: 'q',
      measure: Math.floor(i / NOTES_PER_BAR) + 1,
      beat: { num: i % NOTES_PER_BAR, den: 1 },
      staff: 0,
    })
    at += A_FOURTH
    if (at > CEILING) at -= 7
  }
  return model.toJSON()
}

export interface SpineConsoleDeps {
  getScore(): Score | null
  /** The model as text — what the panel compares to know the score changed. */
  exportJSON(): string
  /** Replace the open score and re-render the score canvas. */
  load(json: string): void
}

export interface SpineConsole {
  circle(options?: { notes?: number; radius?: number }): void
  show(options?: { radius?: number }): void
  straight(): void
  clear(): void
}

type Shape = { kind: 'circle'; radius?: number } | { kind: 'straight' }

export function spineConsole(deps: SpineConsoleDeps): SpineConsole {
  let panel: HTMLElement | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let drawn = ''

  const clear = () => {
    clearInterval(timer)
    panel?.remove()
    panel = null
    drawn = ''
  }

  /** The spine for `shape`, sized to the music unless told otherwise, and the panel it needs. */
  const layOut = (score: Score, shape: Shape): { spine: Spine; width: number; height: number } => {
    const quarters = score.measures.reduce((sum, m) => sum + fracToNumber(measureCapacityFrac(m)), 0)
    const length = AUTO_HEADER_PX + quarters * AUTO_PX_PER_QUARTER
    if (shape.kind === 'straight') {
      return { spine: straightSpine(MARGIN_PX, MARGIN_PX, length), width: length + 2 * MARGIN_PX, height: 2 * MARGIN_PX + 40 }
    }
    const radius = shape.radius ?? Math.max(AUTO_MIN_RADIUS, length / (2 * Math.PI))
    const size = 2 * (radius + MARGIN_PX)
    return { spine: circleSpine(size / 2, size / 2, radius), width: size, height: size }
  }

  const draw = (shape: Shape) => {
    const score = deps.getScore()
    if (!panel || !score) return
    const { spine, width, height } = layOut(score, shape)
    panel.replaceChildren()
    const painter = new SvgPainter(panel)
    painter.resize(width, height)
    drawScoreOnSpine(painter, score, spine)
  }

  /** ⭐ The panel follows the pointer from wherever it was pressed — so it can be put where it shows. */
  const makeDraggable = (el: HTMLElement) => {
    el.style.cursor = 'move'
    el.addEventListener('pointerdown', down => {
      const box = el.getBoundingClientRect()
      const dx = down.clientX - box.left
      const dy = down.clientY - box.top
      el.setPointerCapture(down.pointerId)
      const move = (e: PointerEvent) => {
        Object.assign(el.style, { left: `${e.clientX - dx}px`, top: `${e.clientY - dy}px`, right: 'auto', bottom: 'auto' })
      }
      const up = () => {
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerup', up)
        el.removeEventListener('pointercancel', up)
      }
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerup', up)
      el.addEventListener('pointercancel', up)
      down.preventDefault()
    })
  }

  const open = (shape: Shape) => {
    clear()
    panel = document.createElement('div')
    panel.className = 'spine-demo-panel'
    Object.assign(panel.style, {
      position: 'fixed', right: '16px', bottom: '16px', zIndex: '9999', background: 'white',
      border: '1px solid #999', boxShadow: '0 4px 16px rgba(0,0,0,.25)', touchAction: 'none',
    })
    document.body.appendChild(panel)
    makeDraggable(panel)
    // ⭐ Redrawn when the MODEL changed, asked the way the JSON panel asks: compare its text.
    const refresh = () => {
      const now = deps.exportJSON()
      if (now === drawn) return
      drawn = now
      draw(shape)
    }
    refresh()
    timer = setInterval(refresh, POLL_MS)
    dbg('[spine] the panel follows the open score — edit the score and watch it; drag it with the mouse; __spine.clear() removes it')
  }

  return {
    circle: ({ notes = 8, radius } = {}) => {
      deps.load(fourthsScore(notes))
      open({ kind: 'circle', radius })
    },
    show: ({ radius } = {}) => open({ kind: 'circle', radius }),
    straight: () => open({ kind: 'straight' }),
    clear,
  }
}
