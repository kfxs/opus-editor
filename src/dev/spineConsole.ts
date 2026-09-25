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
 *   __spine.show({ size: 0.5 })      // ⭐ the MUSIC's size — 1 = the page's staff — on the SAME circle
 *   __spine.show({ radius: 300, size: 0.6 })
 *   __spine.show({ zoom: 2 })        // ⭐ the CANVAS's size — the whole picture, circle and all
 *   __spine.show({ radius: 'auto' }) // back to the circle the music asks for
 *   __spine.straight({ size: 0.5 })  // the same panel on a straight spine — the control
 *   __spine.dump()                   // what is armed
 * ```
 * ⭐ **Every call KEEPS what the last one set** (his report, 2026-09-25: *"if I change first the size and then
 * the zoom it just forgets my previous size"*): `show({ size: 0.5 })` then `show({ zoom: 2 })` is half-size
 * music at double zoom. Only `clear()` forgets. `circle()` loads a new score and keeps the sizes too.
 * ```js
 *   __spine.clear()
 * ```
 *
 * Drag the panel anywhere with the mouse.
 * ⭐ **`size` and `zoom` are two different measures** (his report, 2026-09-25: *"the size is like a zoom … what
 * I want is a staff size, a different measure from the radius"*). `zoom` scales the CANVAS — circle, music,
 * margins, everything. `size` scales the MUSIC ONLY: the circle keeps its radius — the one you gave, or the
 * one sized from the music at the PAGE's size — and the music is drawn bigger or smaller round it, as a
 * small staff is drawn on the same page. ⚠️ So at size 2 the music may not FIT the circle (one line, no
 * casting-off): the console says so, and the radius it would need.
 * Both are the page's own small-staff mechanism (docs/plans/staff-size-plan.md §4.1): the whole picture
 * is drawn inside ONE group placed by `scaling(zoom · size)`, so every rule runs in the music's own units
 * and nothing is re-derived; a radius in canvas px is `radius / size` inside the group.
 *
 * ⚠️ **Its OWN panel and painter, ⛔ not the score canvas**: the real canvas knows nothing of spines yet
 * (plan B), so the panel cannot be clicked into. ⚠️ `circle()` REPLACES the open score, like
 * `__perf.load`. The shape is a view of this console, ⛔ not saved in the JSON.
 *
 * ⛔ **SCAFFOLDING, and it deletes cleanly**: the machinery is the engine's
 * (`engine/engrave/staff/staffSpine` · `spineLines` · `engine/rendering/eye/*`), this is the entry
 * point, and `App.ts` wires it.
 */
import { deepestInkPx, naturalSpineLength } from '../engine/rendering/eye/spineSpacing'
import { musicFontGeneration } from '../engine/fonts/musicFont'
import { textFontGeneration } from '../engine/fonts/textFont'
import { dbg } from '@/utils/debug'
import type { PitchStep, Score } from '@/types/music'
import { ScoreModel } from '@/engine/models/ScoreModel'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { circleSpine, straightSpine } from '@/engine/engrave/staff/staffSpine'
import { drawScoreOnSpine } from '@/engine/rendering/eye/spineScore'
import { SvgPainter } from '@/engine/rendering/painter/SvgPainter'
import { drawGroupOf } from '@/engine/rendering/painter/svgDrawGroup'
import { scaling } from '@/engine/paint/Affine'

const STEPS: PitchStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

/** Diatonic indices (octave × 7 + step): the walk starts on C4 and folds down an octave above G5. */
const FIRST = 4 * 7
const CEILING = 5 * 7 + 4
const A_FOURTH = 3
const NOTES_PER_BAR = 4

/** Room around the spine for what stands outside it — stems, ledger lines. */
const MARGIN_PX = 90

/** How much looser than its natural width the music is laid out when the spine is sized for it. */
const AUTO_BREATHING = 1.15
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

/** The two sizes: the MUSIC's (1 = the page's staff space, a ratio like a staff's own `size`) and the CANVAS's. */
export interface SpineSizes { size?: number; zoom?: number }
/** A radius in canvas px — or `'auto'`, the circle the music asks for at the page's size. */
export type SpineRadius = number | 'auto'

export interface SpineConsole {
  circle(options?: { notes?: number; radius?: SpineRadius } & SpineSizes): void
  show(options?: { radius?: SpineRadius } & SpineSizes): void
  straight(options?: SpineSizes): void
  /** What is armed — the shape, its radius (or `'auto'`), size and zoom. */
  dump(): { kind: 'circle' | 'straight'; radius: SpineRadius; size: number; zoom: number }
  clear(): void
}

/** What is armed. `radius` is remembered through a `straight()` too (which ignores it), so a `show()` after it
 *  gets the circle back as it was. */
type Shape = { kind: 'circle' | 'straight'; radius?: number; size: number; zoom: number }

/** ⛔ A factor that is not a positive number is REFUSED — the armed one KEPT: `scale(0)` would draw nothing and
 *  `scale(NaN)` a broken transform — a knob that looked like it worked would be the worst instrument. */
function factorOf(name: 'size' | 'zoom', value: number | undefined, last: number): number {
  if (value === undefined) return last
  if (!Number.isFinite(value) || value <= 0) {
    dbg(`[spine] ⛔ ${name} must be a positive number (1 = ${name === 'size' ? "the page's staff" : 'as drawn'}); got ${value} — keeping ${last}`)
    return last
  }
  return value
}
/** The options a call gave, over the ones REMEMBERED: an absent option keeps its last value. */
function mergedShape(last: Shape, kind: Shape['kind'], options: { radius?: SpineRadius } & SpineSizes): Shape {
  return {
    kind,
    radius: options.radius === undefined ? last.radius : options.radius === 'auto' ? undefined : options.radius,
    size: factorOf('size', options.size, last.size),
    zoom: factorOf('zoom', options.zoom, last.zoom),
  }
}

const FRESH: Shape = { kind: 'circle', size: 1, zoom: 1 }

export function spineConsole(deps: SpineConsoleDeps): SpineConsole {
  let panel: HTMLElement | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let drawn = ''
  /** ⭐ What the last call armed — the next call builds on it; only `clear()` forgets. */
  let shape: Shape = FRESH

  const clear = () => {
    clearInterval(timer)
    panel?.remove()
    panel = null
    drawn = ''
    shape = FRESH
  }

  /**
   * The spine for `shape` and the panel it needs — the spine in the MUSIC's units (the page's staff space,
   * what `drawScoreOnSpine` draws in), the panel in CANVAS px (before `zoom`).
   *
   * ⭐ The circle's radius is a CANVAS measure and does not follow `size`: given, it is yours; sized from
   * the music, it is what the music asks at the PAGE's size (`eye/spineSpacing`, one endless line) — so
   * `size` draws the music bigger or smaller on the SAME circle, ⛔ never a zoom. Inside the group the
   * radius is `/ size`; the margin (stems, ledgers — music) is in music units.
   */
  const layOut = (score: Score, shape: Shape): { spine: Spine; width: number; height: number } => {
    const k = shape.size
    // ⭐ The header's room is IN that length: each bar's lead-in carries the signs it draws (`eye/spineHeader`).
    const length = naturalSpineLength(score) * AUTO_BREATHING
    if (shape.kind === 'straight') {
      // A straight spine the length the music asks at the page's size — in canvas px, so `size` fills it.
      const canvasLength = length
      return { spine: straightSpine(MARGIN_PX, MARGIN_PX, canvasLength / k), width: canvasLength + 2 * MARGIN_PX * k, height: (2 * MARGIN_PX + 40) * k }
    }
    // ⭐ `length` is what the music asks where its DEEPEST ink stands — the inner arc — so the spine
    //    itself is that much further out (`eye/spineSpacing.deepestInkPx`).
    const deepest = deepestInkPx(score)
    const canvasRadius = shape.radius ?? Math.max(AUTO_MIN_RADIUS, length / (2 * Math.PI) + deepest)
    const radius = canvasRadius / k
    // ⚠️ One line, no casting-off: bigger music on the same circle may not fit. Say so, with the radius it needs.
    const needed = k * (length / (2 * Math.PI) + deepest)
    if (canvasRadius < needed - 0.5) {
      dbg(`[spine] ⚠️ at size ${k} the music needs a radius of ≈${Math.ceil(needed)} px; the circle has ${Math.round(canvasRadius)} — it will be squeezed. __spine.show({ radius: ${Math.ceil(needed)}, size: ${k} })`)
    }
    const canvasSize = 2 * (canvasRadius + MARGIN_PX * k)
    return { spine: circleSpine(canvasSize / (2 * k), canvasSize / (2 * k), radius), width: canvasSize, height: canvasSize }
  }

  const draw = (shape: Shape) => {
    const score = deps.getScore()
    if (!panel || !score) return
    const { spine, width, height } = layOut(score, shape)
    panel.replaceChildren()
    const painter = new SvgPainter(panel)
    const { zoom } = shape
    painter.resize(width * zoom, height * zoom)
    // ⭐ The music at its SIZE, the canvas at its ZOOM: one group placed by `scaling(zoom · size)` (the page's
    //    small staff, §4.1) — at 1 · 1 the picture is byte-identical to what it was, wrapper and all.
    // ⚠️ Skipped only when BOTH are 1 — `zoom: 2, size: 0.5` composes to scale(1) and still needs its group:
    //    the radius was divided by `size` for it.
    const k = zoom * shape.size
    if (zoom === 1 && shape.size === 1) {
      drawScoreOnSpine(painter, score, spine)
      return
    }
    const group = drawGroupOf(painter.openGroup('spine-size', 'spine-size'))
    try {
      group?.setPlacement(scaling(k))
      drawScoreOnSpine(painter, score, spine)
    } finally {
      painter.closeGroup()
    }
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

  const report = () => {
    const radius = shape.radius ?? 'auto'
    dbg(`[spine] armed: ${shape.kind} · radius ${radius} · size ${shape.size} · zoom ${shape.zoom} — each call keeps what the last set; __spine.clear() forgets`)
  }

  const open = (next: Shape) => {
    clear()
    shape = next
    panel = document.createElement('div')
    panel.className = 'spine-demo-panel'
    Object.assign(panel.style, {
      position: 'fixed', right: '16px', bottom: '16px', zIndex: '9999', background: 'white',
      border: '1px solid #999', boxShadow: '0 4px 16px rgba(0,0,0,.25)', touchAction: 'none',
    })
    document.body.appendChild(panel)
    makeDraggable(panel)
    // ⭐ Redrawn when the MODEL changed, asked the way the JSON panel asks: compare its text.
    // ⚠️ …AND when a FACE changed (`fonts/musicFont`, `fonts/textFont`): a font switch redraws the
    //    picture without touching the model, so the JSON alone left the circle in the old face
    //    (his report, 2026-09-21).
    const refresh = () => {
      const now = `${musicFontGeneration()}|${textFontGeneration()}|${deps.exportJSON()}`
      if (now === drawn) return
      drawn = now
      draw(shape)
    }
    refresh()
    timer = setInterval(refresh, POLL_MS)
    dbg('[spine] the panel follows the open score — edit the score and watch it; drag it with the mouse; __spine.clear() removes it')
    report()
  }

  return {
    circle: ({ notes = 8, ...options } = {}) => {
      // ⚠️ Remembered BEFORE `clear()` runs inside `open` — a new score keeps the sizes.
      const next = mergedShape(shape, 'circle', options)
      deps.load(fourthsScore(notes))
      open(next)
    },
    show: (options = {}) => open(mergedShape(shape, 'circle', options)),
    straight: (options = {}) => open(mergedShape(shape, 'straight', options)),
    dump: () => {
      report()
      return { kind: shape.kind, radius: shape.radius ?? 'auto', size: shape.size, zoom: shape.zoom }
    },
    clear,
  }
}
