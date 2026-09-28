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
 * Drag the panel anywhere with the mouse. ⭐ Drag a CORNER to make the canvas bigger or smaller — the drawing keeps its
 * size and its place (⛔ not a zoom, ⛔ not re-centred; `clear()` forgets the canvas you chose). ⭐ RIGHT-drag pans the
 * drawing inside the canvas — to see what falls outside it. ⭐ CTRL + WHEEL zooms the drawing about the pointer — the preview
 * only, ⛔ never the score (the event stops at the panel).
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
 * ⭐ **A bar's STRETCH** (`eye/spineBarStretch`, his ask 2026-09-28) — set on a selected barline — and **a note's
 * SPACE** (`eye/spineColumnSpace`, the same day) — set on a selected note or rest — come from the Spine Properties
 * window, and are kept HERE for the session (⛔ not in the JSON — undecided, plan §9.3 C); `clear()` forgets it.
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
import { clampSpineStretch, measureIdOfNumber, spineStretchOf } from '@/engine/rendering/eye/spineBarStretch'
import { spineColumnKeyOf } from '@/engine/rendering/eye/spineColumnSpace'
import type { SpineAdjustments } from '@/engine/rendering/eye/spineAdjustments'
import { spineStaffTops } from '../engine/rendering/eye/spineStaves'
import { musicFontGeneration } from '../engine/fonts/musicFont'
import { textFontGeneration } from '../engine/fonts/textFont'
import { dbg } from '@/utils/debug'
import type { PitchStep, Score } from '@/types/music'
import { ScoreModel } from '@/engine/models/ScoreModel'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { circleSpine, straightSpine } from '@/engine/engrave/staff/staffSpine'
import { SPINE_IDS_ATTR, SPINE_VOICE_ATTR, type SpinePlacedReport, drawScoreOnSpine } from '@/engine/rendering/eye/spineScore'
import { voiceFillColor } from '@/utils/voiceColors'
import { ELEMENT_SELECTION_FILL } from '@/utils/selectionColors'
import { SPINE_BARLINE_ATTR } from '@/engine/rendering/eye/spineSystem'
import { SvgPainter } from '@/engine/rendering/painter/SvgPainter'
import { drawGroupOf } from '@/engine/rendering/painter/svgDrawGroup'
import { compose, scaling, translation } from '@/engine/paint/Affine'

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

/** How solid the panel's white background is, 0–1, until `show({ opacity })` says otherwise — see-through enough to
 *  show what it covers. A changeable default. */
const PANEL_OPACITY = 0.8

/** How far a press may travel and still be a CLICK rather than the start of a panel drag, px. */
const CLICK_SLOP_PX = 4

/** How far past the staves and their ink the MUSIC's band reaches, for the cursor — staff spaces. A changeable default. */
const MUSIC_REACH_SPACES = 3

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

/** What a click in the panel can pick: a note or rest (by the id the editor selects it by), or a barline (the bar it ENDS). */
export type SpinePick = { kind: 'note'; id: string } | { kind: 'barline'; measure: number }

export interface SpineConsoleDeps {
  getScore(): Score | null
  /** The model as text — what the panel compares to know the score changed. */
  exportJSON(): string
  /** Replace the open score and re-render the score canvas. */
  load(json: string): void
  /**
   * ⭐ Select ONE note (a pitch id, or a rest's slot id) or ONE barline in the EDITOR — or clear with `null`: the spine shares
   * the editor's selection (docs/plans/bent-staff-plan.md §9.1, *"share selection"*), ⛔ no second one.
   */
  select(pick: SpinePick | null): void
  /** What the editor has selected right now: its notes' ids, and the barline (the bar it ENDS), if one is. */
  selected(): { ids: ReadonlySet<string>; barline: number | null }
  /** Called when the editor's selection changes; answers an unsubscribe. */
  onSelectionChange(fn: () => void): () => void
}

/** The two sizes: the MUSIC's (1 = the page's staff space, a ratio like a staff's own `size`) and the CANVAS's. */
export interface SpineSizes {
  size?: number
  zoom?: number
  /** How solid the panel's white background is, 0–1 (his ask, 2026-09-27: set from the console). The music stays solid. */
  opacity?: number
}
/** A radius in canvas px — or `'auto'`, the circle the music asks for at the page's size. */
export type SpineRadius = number | 'auto'

export interface SpineConsole {
  circle(options?: { notes?: number; radius?: SpineRadius } & SpineSizes): void
  show(options?: { radius?: SpineRadius } & SpineSizes): void
  straight(options?: SpineSizes): void
  /** What is armed — the shape, its radius (or `'auto'`), size and zoom. */
  dump(): { kind: 'circle' | 'straight'; radius: SpineRadius; size: number; zoom: number; opacity: number }
  clear(): void
  /**
   * Where the LAST drawing put each selectable thing (`eye/spineScore.SpinePlacedReport`) — empty while the panel
   * is down. Read by the Spine Properties window (`./spinePropertiesWindow`).
   */
  placed(): SpinePlacedReport
  /** Called after every redraw of the panel, and when it closes; answers an unsubscribe. */
  onRedraw(fn: () => void): () => void
  /** The stretch of the bar numbered `measure` on the spine (`eye/spineBarStretch`) — ×1 when none was set. */
  stretchOf(measure: number): number
  /** Set that bar's stretch for the SESSION and redraw; ×1 removes the row. A value that is not a number is refused. */
  setStretch(measure: number, value: number): void
  /** The space before the column a note or rest (by the id the editor selects it by) stands in, in staff spaces. */
  spaceOf(id: string): number
  /** Set that column's space for the SESSION and redraw; 0 removes the row. A value that is not a number is refused. */
  setSpace(id: string, value: number): void
}

/** What is armed. `radius` is remembered through a `straight()` too (which ignores it), so a `show()` after it
 *  gets the circle back as it was. */
type Shape = { kind: 'circle' | 'straight'; radius?: number; size: number; zoom: number; opacity: number }

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
    opacity: opacityOf(options.opacity, last.opacity),
  }
}

/** ⛔ An opacity outside 0–1 (or not a number) is REFUSED — the armed one kept, as a bad factor is. */
function opacityOf(value: number | undefined, last: number): number {
  if (value === undefined) return last
  if (typeof value === 'number' && value >= 0 && value <= 1) return value
  dbg(`[spine] ⛔ opacity ${value} refused — a number from 0 (clear) to 1 (solid); kept ${last}`)
  return last
}

const FRESH: Shape = { kind: 'circle', size: 1, zoom: 1, opacity: PANEL_OPACITY }

export function spineConsole(deps: SpineConsoleDeps): SpineConsole {
  let panel: HTMLElement | null = null
  /** Where the drawing goes, INSIDE the panel — the corner handles live beside it, so a redraw keeps them. */
  let host: HTMLElement | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let drawn = ''
  /** ⭐ What the last call armed — the next call builds on it; only `clear()` forgets. */
  let shape: Shape = FRESH
  /**
   * ⭐ The CANVAS's own size, once a corner has been dragged (his ask, 2026-09-26: *"enlarge the spine preview by
   * dragging the corners … making the canvas big but the size of the drawing remains"*) — ⛔ not a zoom: the
   * music keeps its size, and ⛔ is not re-centred (his word): it stays where it was on screen — `x`/`y` is how
   * far a left or top corner has pushed the canvas out past it. Absent: the canvas the music asks for. Kept
   * across calls like the sizes; only `clear()` forgets.
   */
  let canvas: { width: number; height: number; x: number; y: number } | undefined

  /** Where the last drawing put each selectable thing — see {@link SpineConsole.placed}. */
  let lastPlaced: SpinePlacedReport = new Map()
  /** ⭐ Each bar's stretch on the spine, by measure id — the SESSION's (⛔ not stored); only `clear()` forgets. */
  let stretches = new Map<string, number>()
  /** ⭐ Each column's space on the spine, by the page's column key — the SESSION's; only `clear()` forgets. */
  let spaces = new Map<string, number>()
  const adjustments = (): SpineAdjustments => ({ barStretch: stretches, columnSpace: spaces })
  let redrawListeners: (() => void)[] = []

  /** Stops following the editor's selection — set while the panel is up. */
  let unfollowSelection: (() => void) | null = null

  /** The last drawing's path and placement — what the CURSOR asks where the music is. */
  let drawnMusic: { spine: Spine; k: number; x: number; y: number; deepest: number } | null = null

  /**
   * ⭐ Is this point (client px) inside the MUSIC — the band the staves and their ink occupy along the path, a
   * RING round a circle? His ask, 2026-09-27: the pointer there (a click selects), the move cursor elsewhere.
   * Asked of the spine itself (`locate`): the canvas is `music × k + offset`, so a point is un-placed first.
   */
  const overMusic = (clientX: number, clientY: number): boolean => {
    const svg = host?.querySelector('svg')
    if (!svg || !drawnMusic) return false
    const box = svg.getBoundingClientRect()
    const { spine, k, x, y, deepest } = drawnMusic
    const at = spine.locate((clientX - box.left - x) / k, (clientY - box.top - y) / k)
    if (!at) return false
    const reach = MUSIC_REACH_SPACES * STAFF_SPACE_PX
    const along = spine.closed || (at.s >= -reach && at.s <= spine.length + reach)
    return along && at.offset >= -reach && at.offset <= deepest + reach
  }

  /** Take the panel down, keeping what is armed. */
  const teardown = () => {
    lastPlaced = new Map()
    for (const fn of redrawListeners) fn()
    clearInterval(timer)
    unfollowSelection?.()
    unfollowSelection = null
    panel?.remove()
    panel = null
    host = null
    drawn = ''
  }
  const clear = () => {
    teardown()
    shape = FRESH
    canvas = undefined
    stretches = new Map()
    spaces = new Map()
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
    const length = naturalSpineLength(score, adjustments()) * AUTO_BREATHING
    if (shape.kind === 'straight') {
      // A straight spine the length the music asks at the page's size — in canvas px, so `size` fills it.
      const canvasLength = length
      // …and as tall as the system: the lowest staff's top, then its own staff (port map #12).
      const lowestTop = Math.max(...spineStaffTops(score).values())
      return { spine: straightSpine(MARGIN_PX, MARGIN_PX, canvasLength / k), width: canvasLength + 2 * MARGIN_PX * k, height: (2 * MARGIN_PX + 40 + lowestTop) * k }
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

  /** Draw the picture, then wear the editor's selection on it — and tell whoever reads the drawing. */
  const draw = (shape: Shape) => {
    drawPicture(shape)
    paintSelection()
    for (const fn of redrawListeners) fn()
  }

  const drawPicture = (shape: Shape) => {
    const score = deps.getScore()
    if (!host || !score) return
    const { spine, width, height } = layOut(score, shape)
    drawnMusic = { spine, k: shape.zoom * shape.size, x: canvas?.x ?? 0, y: canvas?.y ?? 0, deepest: deepestInkPx(score) }
    host.replaceChildren()
    const painter = new SvgPainter(host)
    const { zoom } = shape
    // ⭐ The canvas the corners chose, or the one the music asks for; the drawing at its size, where it was.
    const natural = { width: width * zoom, height: height * zoom }
    const view = canvas ?? natural
    painter.resize(view.width, view.height)
    const offsetX = canvas?.x ?? 0
    const offsetY = canvas?.y ?? 0
    // ⭐ The music at its SIZE, the canvas at its ZOOM: one group placed by `scaling(zoom · size)` (the page's
    //    small staff, §4.1) — at 1 · 1 the picture is byte-identical to what it was, wrapper and all.
    // ⚠️ Skipped only when BOTH are 1 and the canvas is the music's own — `zoom: 2, size: 0.5` composes to
    //    scale(1) and still needs its group: the radius was divided by `size` for it.
    const k = zoom * shape.size
    lastPlaced = new Map()
    if (zoom === 1 && shape.size === 1 && offsetX === 0 && offsetY === 0) {
      drawScoreOnSpine(painter, score, spine, lastPlaced, adjustments())
      return
    }
    const group = drawGroupOf(painter.openGroup('spine-size', 'spine-size'))
    try {
      group?.setPlacement(compose(scaling(k), translation(offsetX, offsetY)))
      drawScoreOnSpine(painter, score, spine, lastPlaced, adjustments())
    } finally {
      painter.closeGroup()
    }
  }

  /**
   * ⭐ A CLICK in the panel selects the note under it in the EDITOR (plan §9): the drawing tags each note's group
   * with the ids the editor selects it by (`eye/spineScore.SPINE_IDS_ATTR`) — the first one is taken (a chord's
   * first head, as a plain click on the page selects one note) — and each barline's blocks with the bar the line
   * ENDS (`eye/spineSystem.SPINE_BARLINE_ATTR`), the editor's barline. A click on nothing clears, as a tap does.
   */
  const clickAt = (target: EventTarget | null) => {
    const hit = target instanceof Element ? target.closest(`[${SPINE_IDS_ATTR}], [${SPINE_BARLINE_ATTR}]`) : null
    const id = hit?.getAttribute(SPINE_IDS_ATTR)?.split(' ')[0]
    const measure = hit?.getAttribute(SPINE_BARLINE_ATTR)
    deps.select(id ? { kind: 'note', id } : measure ? { kind: 'barline', measure: Number(measure) } : null)
  }

  /**
   * ⭐ The selection's HIGHLIGHT in the panel — each selected note's ink in its VOICE's colour (`utils/voiceColors`,
   * the page's rule). Painted on the drawn nodes after every draw and whenever the selection changes; ⛔ the
   * drawing itself never knows (the engine may not read the editor).
   */
  const paintSelection = () => {
    if (!host) return
    const { ids: selected, barline } = deps.selected()
    for (const group of host.querySelectorAll<SVGGElement>(`[${SPINE_IDS_ATTR}]`)) {
      const ids = group.getAttribute(SPINE_IDS_ATTR)?.split(' ') ?? []
      const colour = voiceFillColor(Number(group.getAttribute(SPINE_VOICE_ATTR) ?? 0))
      wear(group, ids.some(id => selected.has(id)) ? colour : null)
    }
    // ⭐ A barline wears the page's ELEMENT selection colour (`interactions/elements/barlineInk`), on every staff and
    //    in every joined gap — the page's highlight lights the whole system's line.
    for (const group of host.querySelectorAll<SVGGElement>(`[${SPINE_BARLINE_ATTR}]`)) {
      wear(group, Number(group.getAttribute(SPINE_BARLINE_ATTR)) === barline ? ELEMENT_SELECTION_FILL : null)
    }
  }

  /** Paint a group's ink in `colour` — or give it back what it had, when `colour` is null. */
  const wear = (group: SVGGElement, colour: string | null) => {
    for (const node of group.querySelectorAll<SVGElement>('path, rect, text')) {
      if (colour) {
        if (node.dataset.spineInk === undefined) node.dataset.spineInk = `${node.getAttribute('fill') ?? ''}|${node.getAttribute('stroke') ?? ''}`
        // ⚠️ What the node is PAINTED with, inherited or its own — a stem is a stroke whose colour comes from its
        //    group, so its own attribute alone left it black (seen 2026-09-27). A glyph (`text`) is only filled.
        const style = getComputedStyle(node)
        const fill = node.getAttribute('fill') ?? style.fill
        const stroke = node.getAttribute('stroke') ?? style.stroke
        if (fill !== 'none') node.setAttribute('fill', colour)
        if (node.tagName !== 'text' && stroke && stroke !== 'none') node.setAttribute('stroke', colour)
      } else if (node.dataset.spineInk !== undefined) {
        const [fill, stroke] = node.dataset.spineInk.split('|')
        if (fill) node.setAttribute('fill', fill); else node.removeAttribute('fill')
        if (stroke) node.setAttribute('stroke', stroke); else node.removeAttribute('stroke')
        delete node.dataset.spineInk
      }
    }
  }

  /** ⭐ The panel follows the pointer from wherever it was pressed — so it can be put where it shows. */
  const makeDraggable = (el: HTMLElement) => {
    el.style.cursor = 'move'
    // ⭐ The POINTER over the music (a click there selects), the MOVE cursor everywhere else — his ask, 2026-09-27.
    //    Not while a button is held: a drag keeps the cursor it started with.
    el.addEventListener('pointermove', e => {
      if (e.buttons !== 0 || e.target !== el && !host?.contains(e.target as Node)) return
      el.style.cursor = overMusic(e.clientX, e.clientY) ? 'pointer' : 'move'
    })
    // The right button pans the drawing (below) — the browser's own menu would take it otherwise.
    el.addEventListener('contextmenu', e => e.preventDefault())
    el.addEventListener('pointerdown', down => {
      if (down.button === 2) { panDrawing(el, down); return }
      const box = el.getBoundingClientRect()
      const dx = down.clientX - box.left
      const dy = down.clientY - box.top
      el.setPointerCapture?.(down.pointerId)
      // ⭐ A press that does not MOVE is a CLICK — it selects what is under it (plan §9, question D answered the
      //    simplest way: no handle; the panel still drags the moment the pointer travels).
      let moved = false
      const move = (e: PointerEvent) => {
        if (!moved && Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) < CLICK_SLOP_PX) return
        moved = true
        Object.assign(el.style, { left: `${e.clientX - dx}px`, top: `${e.clientY - dy}px`, right: 'auto', bottom: 'auto' })
      }
      const up = (e: PointerEvent) => {
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerup', up)
        el.removeEventListener('pointercancel', up)
        if (!moved && e.type === 'pointerup') clickAt(down.target)
      }
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerup', up)
      el.addEventListener('pointercancel', up)
      down.preventDefault()
    })
  }

  /**
   * ⭐ RIGHT-DRAG PANS THE DRAWING inside the canvas (his ask, 2026-09-26: *"so i can visualize if it is outside of
   * the preview area"*) — the panel stays where it is; only the drawing's offset in the canvas moves, the
   * same `x`/`y` a corner pushes, kept until `clear()`. The canvas keeps its size (the music's own, until a
   * corner is dragged).
   */
  const panDrawing = (el: HTMLElement, down: PointerEvent) => {
    down.preventDefault()
    const svg = host?.querySelector('svg')
    const start = canvas ?? {
      width: Number(svg?.getAttribute('width') ?? 0),
      height: Number(svg?.getAttribute('height') ?? 0),
      x: 0,
      y: 0,
    }
    el.setPointerCapture?.(down.pointerId)
    let frame = 0
    const move = (e: PointerEvent) => {
      canvas = { ...start, x: start.x + e.clientX - down.clientX, y: start.y + e.clientY - down.clientY }
      if (typeof requestAnimationFrame !== 'function') { draw(shape); return }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => draw(shape))
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  /**
   * ⭐ CTRL + WHEEL ZOOMS THE DRAWING, about the pointer (his ask, 2026-09-26) — the same `zoom` `show({ zoom })`
   * arms, and the canvas keeps its size: the point under the pointer stays where it is. ⛔ The page never sees
   * a wheel over the panel: the page's zoom and wheel gestures listen on `window` (`App.handleZoomWheel`), and
   * the event stops HERE — so Ctrl + wheel over the score still zooms the score, and over the preview only the
   * preview. A plain wheel keeps the browser's own scrolling.
   */
  const MIN_ZOOM = 0.1
  const MAX_ZOOM = 10
  const ZOOM_PER_WHEEL_PX = 0.0015
  const zoomAtPointer = (e: WheelEvent) => {
    const svg = host?.querySelector('svg')
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    // The canvas is pinned where it is — a zoom must not grow the preview.
    const start = canvas ?? { width: Number(svg.getAttribute('width') ?? 0), height: Number(svg.getAttribute('height') ?? 0), x: 0, y: 0 }
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, shape.zoom * Math.exp(-e.deltaY * ZOOM_PER_WHEEL_PX)))
    if (zoom === shape.zoom) return
    // The drawing is `k · p + offset` on the canvas: keep the point under the pointer where it is.
    const k = shape.zoom * shape.size
    const kNext = zoom * shape.size
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    canvas = { ...start, x: cx - (kNext / k) * (cx - start.x), y: cy - (kNext / k) * (cy - start.y) }
    shape = { ...shape, zoom }
    draw(shape)
  }

  /** Where the panel is on screen — left/top from now on, so a corner can move it while it resizes. */
  const pinToCorner = (el: HTMLElement) => {
    const box = el.getBoundingClientRect()
    Object.assign(el.style, { left: `${box.left}px`, top: `${box.top}px`, right: 'auto', bottom: 'auto' })
    return box
  }

  /**
   * ⭐ A handle on each CORNER — invisible, a grab area with its resize cursor (his word: no grey squares) —
   * dragging it resizes the CANVAS (`canvas`): the corner follows the pointer, the opposite one stays put, and
   * the drawing keeps its size AND its place on screen. ⛔ The press never reaches the panel's own drag
   * (`makeDraggable`), which would move the whole panel instead.
   */
  const MIN_CANVAS = 120
  /**
   * ⭐ A little × at the top right that CLOSES the panel (his ask, 2026-09-27) — beside the corner's resize handle,
   * ⛔ not on it. Closing keeps what is armed (size, zoom, radius, the canvas), so `__spine.show()` brings it back
   * as it was; only `clear()` forgets.
   */
  const addCloseButton = (el: HTMLElement) => {
    const button = document.createElement('div')
    button.className = 'spine-demo-close'
    button.textContent = '×'
    button.title = 'Close — __spine.show() reopens it'
    Object.assign(button.style, {
      position: 'absolute', top: '2px', right: '16px', width: '16px', height: '16px', zIndex: '2',
      font: '16px/16px sans-serif', textAlign: 'center', color: '#666', cursor: 'pointer', userSelect: 'none',
    })
    button.addEventListener('pointerenter', () => { button.style.color = '#000' })
    button.addEventListener('pointerleave', () => { button.style.color = '#666' })
    // ⛔ Never the panel's own press: that would start a drag (or, unmoved, a click that selects).
    button.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault() })
    button.addEventListener('click', e => {
      e.stopPropagation()
      teardown()
      dbg('[spine] closed — __spine.show() reopens it as it was; __spine.clear() forgets the settings too')
    })
    el.appendChild(button)
  }

  const addCornerHandles = (el: HTMLElement) => {
    const corners = [
      { key: 'nw', left: true, top: true, cursor: 'nwse-resize' },
      { key: 'ne', left: false, top: true, cursor: 'nesw-resize' },
      { key: 'sw', left: true, top: false, cursor: 'nesw-resize' },
      { key: 'se', left: false, top: false, cursor: 'nwse-resize' },
    ]
    for (const corner of corners) {
      const handle = document.createElement('div')
      handle.className = `spine-demo-corner spine-demo-corner-${corner.key}`
      Object.assign(handle.style, {
        position: 'absolute', width: '12px', height: '12px', zIndex: '1', cursor: corner.cursor,
        [corner.left ? 'left' : 'right']: '-1px', [corner.top ? 'top' : 'bottom']: '-1px',
      })
      handle.addEventListener('pointerdown', down => {
        down.stopPropagation()
        down.preventDefault()
        const box = pinToCorner(el)
        const svg = host?.querySelector('svg')
        const start = {
          width: canvas?.width ?? Number(svg?.getAttribute('width') ?? box.width),
          height: canvas?.height ?? Number(svg?.getAttribute('height') ?? box.height),
          x: canvas?.x ?? 0,
          y: canvas?.y ?? 0,
        }
        handle.setPointerCapture?.(down.pointerId)
        let frame = 0
        const move = (e: PointerEvent) => {
          const dx = e.clientX - down.clientX
          const dy = e.clientY - down.clientY
          const width = Math.max(MIN_CANVAS, start.width + (corner.left ? -dx : dx))
          const height = Math.max(MIN_CANVAS, start.height + (corner.top ? -dy : dy))
          // The OPPOSITE corner stays where it was: a left or top handle moves the panel by what it grew.
          if (corner.left) el.style.left = `${box.left + start.width - width}px`
          if (corner.top) el.style.top = `${box.top + start.height - height}px`
          // A left or top corner grows the canvas on THAT side: the drawing is pushed in by the same amount, so
          // on screen it stays where it was (⛔ never re-centred).
          canvas = {
            width, height,
            x: corner.left ? start.x + (width - start.width) : start.x,
            y: corner.top ? start.y + (height - start.height) : start.y,
          }
          // One redraw per frame while dragging; at once where there are no frames (a test's jsdom).
          if (typeof requestAnimationFrame !== 'function') { draw(shape); return }
          cancelAnimationFrame(frame)
          frame = requestAnimationFrame(() => draw(shape))
        }
        const up = () => {
          handle.removeEventListener('pointermove', move)
          handle.removeEventListener('pointerup', up)
          handle.removeEventListener('pointercancel', up)
        }
        handle.addEventListener('pointermove', move)
        handle.addEventListener('pointerup', up)
        handle.addEventListener('pointercancel', up)
      })
      el.appendChild(handle)
    }
  }

  const report = () => {
    const radius = shape.radius ?? 'auto'
    const view = canvas ? ` · canvas ${Math.round(canvas.width)}×${Math.round(canvas.height)} (dragged corners)` : ''
    dbg(`[spine] armed: ${shape.kind} · radius ${radius} · size ${shape.size} · zoom ${shape.zoom} · opacity ${shape.opacity}${view} — each call keeps what the last set; __spine.clear() forgets`)
  }

  const open = (next: Shape) => {
    teardown()
    shape = next
    panel = document.createElement('div')
    panel.className = 'spine-demo-panel'
    Object.assign(panel.style, {
      // ⭐ A little see-through (his ask, 2026-09-27) — the BACKGROUND only: the music on it stays solid.
      position: 'fixed', right: '16px', bottom: '16px', zIndex: '9999', background: `rgba(255, 255, 255, ${next.opacity})`,
      border: '1px solid #999', boxShadow: '0 4px 16px rgba(0,0,0,.25)', touchAction: 'none',
    })
    document.body.appendChild(panel)
    host = document.createElement('div')
    panel.appendChild(host)
    makeDraggable(panel)
    addCornerHandles(panel)
    addCloseButton(panel)
    panel.addEventListener('wheel', e => {
      e.stopPropagation() // ⛔ never the page's: its zoom and wheel gestures listen on `window`
      if (!e.ctrlKey) return
      e.preventDefault() // …nor the browser's own page zoom
      zoomAtPointer(e)
    }, { passive: false })
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
    // ⭐ The editor's selection, worn in the panel the moment it changes — a click on the PAGE lights the spine too.
    unfollowSelection = deps.onSelectionChange(paintSelection)
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
      return { kind: shape.kind, radius: shape.radius ?? 'auto', size: shape.size, zoom: shape.zoom, opacity: shape.opacity }
    },
    clear,
    placed: () => lastPlaced,
    stretchOf: measure => {
      const score = deps.getScore()
      const id = score && measureIdOfNumber(score, measure)
      return id ? spineStretchOf(stretches, id) : 1
    },
    setStretch: (measure, value) => {
      const score = deps.getScore()
      const id = score && measureIdOfNumber(score, measure)
      const stretch = clampSpineStretch(value)
      if (!id || stretch === null) {
        dbg(`[spine] ⛔ stretch ${value} for bar ${measure} refused`)
        return
      }
      const next = new Map(stretches)
      if (stretch === 1) next.delete(id)
      else next.set(id, stretch)
      stretches = next
      dbg(`[spine] bar ${measure} stretch ×${stretch} (this session only)`)
      if (host) draw(shape)
    },
    spaceOf: id => {
      const score = deps.getScore()
      const key = score && spineColumnKeyOf(score, id)
      return key ? spaces.get(key) ?? 0 : 0
    },
    setSpace: (id, value) => {
      const score = deps.getScore()
      const key = score && spineColumnKeyOf(score, id)
      if (!key || !Number.isFinite(value)) {
        dbg(`[spine] ⛔ space ${value} for ${id} refused`)
        return
      }
      const next = new Map(spaces)
      if (value === 0) next.delete(key)
      else next.set(key, value)
      spaces = next
      dbg(`[spine] column ${key} space ${value} sp (this session only)`)
      if (host) draw(shape)
    },
    onRedraw: fn => {
      redrawListeners.push(fn)
      return () => { redrawListeners = redrawListeners.filter(f => f !== fn) }
    },
  }
}
