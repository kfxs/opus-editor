/**
 * 🔧 **SPINE PROPERTIES — a READ-ONLY window, for now** (`docs/plans/bent-staff-plan.md` §9, his word 2026-09-27:
 * *"just make the window to see the elements selected, for the moment we dont really know what goes in the
 * properties and what will be adjustable and what not"*).
 *
 * It SHOWS the element the editor has selected — a note, a rest or a barline, picked in the spine panel or on the
 * page (one shared selection, §9.1) — as JSON, dressed like the Properties window (his ask, 2026-09-28), in two parts:
 *
 * - **what it is**, read from the score: its pitches or rest, its length, bar, beat, voice and staff;
 * - **where it stands on the spine**, read from the panel's LAST drawing (`eye/spineScore.SpinePlacedReport`):
 *   its distance along its staff's path, and how far the path has turned there.
 *
 * ⭐ **One knob: a BARLINE's STRETCH** (his ask, 2026-09-28) — the bar the selected barline ENDS takes ×n the room
 * its music asks for on the spine (`eye/spineBarStretch`), in the Properties window's own number row. ⛔ Only the spine; ⛔ never the page.
 *
 * ⛔ **Nothing is stored** — the stretch lives in the panel for the session (where spine adjustments would be kept,
 * plan §9.3 C, is undecided). Everything else here only reports. Toggled from the dev shell (`🔧 Spine props`).
 *
 * ⚠️ SCAFFOLDING in `dev/`: the engine never knows it exists.
 */
import type { Window } from '@/windows/Window'
import type { WindowLayer } from '@/windows/WindowLayer'
import type { Widget } from '@/windows/content/Widget'
import { findSlot } from '@/engine/models/slotLookup'
import { SPINE_STRETCH_MAX, SPINE_STRETCH_MIN, SPINE_STRETCH_STEP } from '@/engine/rendering/eye/spineBarStretch'
import { AMBER, PHOSPHOR, buildNumberRow } from '@/windows/properties/rows'
import { staffIndexOfId } from '@/engine/models/staffContent'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { spineBarlineKey, type SpinePlacedReport } from '@/engine/rendering/eye/spineScore'
import type { Score } from '@/types/music'
import { DURATION_INFO } from '@/utils/durations'
import { fracToNumber } from '@/utils/fraction'
import { voiceOf } from '@/utils/lanes'

export interface SpinePropertiesDeps {
  windows: WindowLayer
  getScore(): Score | null
  /** What the editor has selected — its notes' ids (the anchor first) and the barline, if one is. */
  selected(): { ids: readonly string[]; barline: number | null }
  onSelectionChange(fn: () => void): () => void
  /** The spine panel's last drawing, and its redraws (`./spineConsole`). */
  placed(): SpinePlacedReport
  onRedraw(fn: () => void): () => void
  /** A bar's stretch on the spine — read and set for the SESSION (`./spineConsole`). */
  stretch: { of(measure: number): number; set(measure: number, value: number): void }
}

export interface SpineProperties {
  toggle(): void
  isOpen(): boolean
}

const WIDTH = 280
const HEIGHT = 300
/** How solid the window's background is, 0–1 (`WindowOptions.opacity`). A changeable default. */
const WINDOW_OPACITY = 0.8

export function spinePropertiesWindow(deps: SpinePropertiesDeps): SpineProperties {
  let win: Window | null = null
  const isOpen = () => win !== null && deps.windows.manager.list().includes(win)
  return {
    isOpen,
    toggle: () => {
      if (isOpen()) {
        win!.close()
        win = null
        return
      }
      win = deps.windows.open({
        title: 'Spine Properties',
        width: WIDTH,
        height: HEIGHT,
        content: new SpinePropertiesWidget(deps),
        // A little see-through (his ask, 2026-09-27) — the window's BACKGROUND; its text stays solid.
        opacity: WINDOW_OPACITY,
      })
    },
  }
}

/**
 * The window's content, dressed as the Properties window's (his ask, 2026-09-28): the KIND in amber, the
 * kind's control right under it — at the TOP — then its JSON in the readout's green monospace, and the spine's
 * own answer under its own amber label, as Properties shows its "engraving overrides". Rebuilt whenever the
 * selection or the drawing changes.
 */
export class SpinePropertiesWidget implements Widget {
  private el: HTMLElement | null = null
  private unsubscribe: (() => void)[] = []

  constructor(private readonly deps: SpinePropertiesDeps) {}

  mount(host: HTMLElement): void {
    host.style.overflow = 'hidden'
    const el = document.createElement('div')
    el.className = 'spine-properties'
    // The Properties window's readout: monospace, because this is DATA (`windows/properties/PropertiesWidget`).
    Object.assign(el.style, {
      flex: '1', minHeight: '0', overflow: 'auto', font: '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      lineHeight: '1.45', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: PHOSPHOR, textAlign: 'left', alignSelf: 'stretch',
    })
    host.appendChild(el)
    this.el = el
    this.unsubscribe = [this.deps.onSelectionChange(() => this.render()), this.deps.onRedraw(() => this.render())]
    this.render()
  }

  destroy(): void {
    for (const off of this.unsubscribe) off()
    this.unsubscribe = []
    this.el = null
  }

  private render(): void {
    const el = this.el
    if (!el) return
    el.replaceChildren()
    const report = describe(this.deps)
    if (typeof report === 'string') {
      el.appendChild(text(report))
      return
    }
    el.appendChild(label(report.kind, true))
    if (report.barline !== undefined) el.appendChild(stretchControl(report.barline, this.deps.stretch))
    el.appendChild(text(JSON.stringify(report.data, null, 2)))
    el.appendChild(label('on the spine', false))
    el.appendChild(text(typeof report.spine === 'string' ? report.spine : JSON.stringify(report.spine, null, 2)))
  }
}

function text(content: string): HTMLElement {
  const div = document.createElement('div')
  div.textContent = content
  return div
}

/** An amber label — the KIND (uppercase, as Properties heads an element) or a section under it. */
function label(content: string, kind: boolean): HTMLElement {
  const div = document.createElement('div')
  div.textContent = content
  Object.assign(div.style, { color: AMBER, margin: kind ? '0 0 4px' : '6px 0 2px', letterSpacing: '0.06em' })
  if (kind) div.style.textTransform = 'uppercase'
  return div
}

/** ⭐ What the window reports — the kind, its JSON, and where the spine drew it. A string when there is nothing to show. */
export interface SpineReport {
  kind: string
  /** The bar a selected barline ENDS — the one its stretch acts on. */
  barline?: number
  data: Record<string, unknown>
  spine: Record<string, unknown> | string
}

/** ⭐ What the window reports — exported for its spec. */
export function describe(
  deps: Pick<SpinePropertiesDeps, 'getScore' | 'selected' | 'placed'> & { stretch?: Pick<SpinePropertiesDeps['stretch'], 'of'> },
): SpineReport | string {
  const score = deps.getScore()
  const { ids, barline } = deps.selected()
  const placed = deps.placed()
  if (!score) return 'No score'
  const onSpine = (key: string, extra: Record<string, unknown> = {}): SpineReport['spine'] => {
    const at = placed.get(key)
    if (!at) return placed.size ? 'not drawn on the spine' : 'the spine panel is closed — __spine.show()'
    const turn = (at.spine.at(at.s).angle * 180) / Math.PI
    return {
      staff: at.staff + 1,
      alongPathSp: round(at.s / STAFF_SPACE_PX),
      pathTurnedDeg: round(((turn % 360) + 360) % 360),
      ...extra,
    }
  }

  if (barline !== null) {
    const stretch = deps.stretch?.of(barline)
    return {
      kind: 'barline',
      barline,
      data: { endsBar: barline },
      spine: onSpine(spineBarlineKey(barline), stretch === undefined ? {} : { stretch }),
    }
  }
  const id = ids[0]
  const found = id ? findSlot(score, id) : undefined
  if (!id || !found) return 'Nothing selected — click a note, a rest or a barline, in the spine panel or on the page'
  const slot = found.type === 'chord' ? found.chord : found.rest
  const data: Record<string, unknown> = {}
  if (found.type === 'chord') data.pitch = found.chord.notes.map(p => spell(p.step, p.alter, p.octave))
  Object.assign(data, {
    duration: slot.duration,
    ...(slot.dots ? { dots: slot.dots } : {}),
    quarters: DURATION_INFO[slot.duration].beats,
    bar: slot.measure,
    beat: fracToNumber(slot.beat) + 1,
    voice: voiceOf(slot) + 1,
    staff: staffIndexOfId(score, slot.staffId) + 1,
  })
  if (ids.length > 1) data.selected = `${ids.length} — showing the first`
  const kind = found.type === 'chord' ? (found.chord.notes.length > 1 ? 'chord' : 'note') : 'rest'
  return { kind, data, spine: onSpine(id) }
}

const round = (n: number): number => Math.round(n * 100) / 100

/**
 * ⭐ The BARLINE's knob: the stretch of the bar it ENDS — the Properties window's own number row
 * (`windows/properties/rows.buildNumberRow`: a caption, a number box whose arrows step it, `reset`), ⛔ not a
 * control of our own (his report, 2026-09-28: blank white squares nobody could read). `reset` = ×1.
 * Worn in {@link CONTROL_COLOUR} — his ask the same day: the row's own violet was too dark to see on the glass.
 */
function stretchControl(measure: number, stretch: SpinePropertiesDeps['stretch']): HTMLElement {
  const row = buildNumberRow(
    'stretch ×', stretch.of(measure), SPINE_STRETCH_STEP, SPINE_STRETCH_MIN, SPINE_STRETCH_MAX,
    value => stretch.set(measure, value ?? 1),
    `How much room bar ${measure} takes on the spine — ×1 is as engraved. This session only; the page is not changed.`,
  )
  row.classList.add('spine-properties-stretch')
  row.style.margin = '0 0 6px'
  for (const el of [row, ...row.querySelectorAll<HTMLElement>('input, button')]) {
    el.style.color = CONTROL_COLOUR
    if (el !== row) el.style.borderColor = CONTROL_COLOUR
  }
  return row
}

/**
 * A bright violet — the Properties control's colour family ("this is a live control"), lifted so it reads on the
 * window's dark glass. A local literal and a changeable default, like the Properties window's own.
 */
const CONTROL_COLOUR = '#c9a7ff'

const ALTER_SIGN: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' }

function spell(step: string, alter: number | undefined, octave: number): string {
  return `${step}${ALTER_SIGN[alter ?? 0] ?? ''}${octave}`
}
