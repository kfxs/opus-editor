/**
 * 🔧 **SPINE PROPERTIES — a READ-ONLY window, for now** (`docs/plans/bent-staff-plan.md` §9, his word 2026-09-27:
 * *"just make the window to see the elements selected, for the moment we dont really know what goes in the
 * properties and what will be adjustable and what not"*).
 *
 * It SHOWS the element the editor has selected — a note, a rest or a barline, picked in the spine panel or on the
 * page (one shared selection, §9.1) — as two parts:
 *
 * - **what it is**, read from the score: its pitches or rest, its length, bar, beat, voice and staff;
 * - **where it stands on the spine**, read from the panel's LAST drawing (`eye/spineScore.SpinePlacedReport`):
 *   its distance along its staff's path, and how far the path has turned there.
 *
 * ⛔ **Nothing is adjustable and nothing is stored** — what goes here, what may be changed and where it would be
 * kept (plan §9.3 B / C) are undecided; this window only reports. Toggled from the dev shell (`🔧 Spine props`).
 *
 * ⚠️ SCAFFOLDING in `dev/`: the engine never knows it exists.
 */
import type { Window } from '@/windows/Window'
import type { WindowLayer } from '@/windows/WindowLayer'
import type { Widget } from '@/windows/content/Widget'
import { findSlot } from '@/engine/models/slotLookup'
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

/** The window's content: the report, rebuilt whenever the selection or the drawing changes. */
class SpinePropertiesWidget implements Widget {
  private el: HTMLElement | null = null
  private unsubscribe: (() => void)[] = []

  constructor(private readonly deps: SpinePropertiesDeps) {}

  mount(host: HTMLElement): void {
    const el = document.createElement('div')
    el.className = 'spine-properties'
    Object.assign(el.style, { font: '13px/1.5 sans-serif', overflowY: 'auto', flex: '1' })
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
    if (!this.el) return
    this.el.replaceChildren(...describe(this.deps).map(section))
  }
}

/** One titled block of `label: value` rows. */
interface Section { title: string; rows: [string, string][] }

function section({ title, rows }: Section): HTMLElement {
  const box = document.createElement('div')
  box.style.marginBottom = '10px'
  const head = document.createElement('div')
  head.textContent = title
  head.style.fontWeight = '600'
  box.appendChild(head)
  for (const [label, value] of rows) {
    const row = document.createElement('div')
    row.style.display = 'flex'
    row.style.gap = '8px'
    const v = document.createElement('span')
    v.textContent = value
    // A row with no label is a sentence — it takes the whole width.
    if (label) {
      const l = document.createElement('span')
      l.textContent = label
      Object.assign(l.style, { width: '110px', flex: 'none', opacity: '0.7' })
      row.append(l)
    }
    row.append(v)
    box.appendChild(row)
  }
  return box
}

/** ⭐ What the window reports — exported for its spec. */
export function describe(deps: Pick<SpinePropertiesDeps, 'getScore' | 'selected' | 'placed'>): Section[] {
  const score = deps.getScore()
  const { ids, barline } = deps.selected()
  const placed = deps.placed()
  if (!score) return [{ title: 'No score', rows: [] }]
  const onSpine = (key: string): Section => {
    const at = placed.get(key)
    if (!at) return { title: 'On the spine', rows: [['—', placed.size ? 'not drawn on the spine' : 'the spine panel is closed — __spine.show()']] }
    const turn = (at.spine.at(at.s).angle * 180) / Math.PI
    return {
      title: 'On the spine',
      rows: [
        ['staff', String(at.staff + 1)],
        ['along the path', `${(at.s / STAFF_SPACE_PX).toFixed(2)} sp`],
        ['path turned', `${(((turn % 360) + 360) % 360).toFixed(1)}°`],
      ],
    }
  }

  if (barline !== null) {
    return [{ title: 'Barline', rows: [['ends bar', String(barline)]] }, onSpine(spineBarlineKey(barline))]
  }
  const id = ids[0]
  const found = id ? findSlot(score, id) : undefined
  if (!id || !found) {
    return [{ title: 'Nothing selected', rows: [['', 'click a note, a rest or a barline — in the spine panel or on the page']] }]
  }
  const slot = found.type === 'chord' ? found.chord : found.rest
  const rows: [string, string][] = []
  if (found.type === 'chord') {
    rows.push(['pitch', found.chord.notes.map(p => spell(p.step, p.alter, p.octave)).join(', ')])
  }
  const dots = '.'.repeat(slot.dots ?? 0)
  rows.push(
    ['length', `${slot.duration}${dots} = ${DURATION_INFO[slot.duration].beats} ♩`],
    ['bar', String(slot.measure)],
    ['beat', String(fracToNumber(slot.beat) + 1)],
    ['voice', String(voiceOf(slot) + 1)],
    ['staff', String(staffIndexOfId(score, slot.staffId) + 1)],
  )
  const title = found.type === 'chord' ? (found.chord.notes.length > 1 ? 'Chord' : 'Note') : 'Rest'
  const more = ids.length > 1 ? [{ title: `${ids.length} selected — showing the first`, rows: [] }] : []
  return [...more, { title, rows }, onSpine(id)]
}

const ALTER_SIGN: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' }

function spell(step: string, alter: number | undefined, octave: number): string {
  return `${step}${ALTER_SIGN[alter ?? 0] ?? ''}${octave}`
}
