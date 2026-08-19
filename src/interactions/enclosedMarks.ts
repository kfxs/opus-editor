/**
 * ⭐⭐ **WHAT A SELECTION BOX DRAGS ALONG** — every mark enclosed by a passage selection, as
 * {@link SelectionItem}s. His report, 2026-08-19: *"if i select a measure that have hairpin or
 * trill, i can paste on other measure with hairpin and trill too, however in the selection of the
 * measure the hairpin either the trill is [not] highlighted… we need to highlight them so the user
 * understand"*.
 *
 * ⭐ **THE HIGHLIGHT IS A PROMISE ABOUT THE COPY.** A box already took the hairpins, trills, octave
 * lines, pedals and tempo marks inside it (`./clipboard`'s `*InWindow` builders) — it just never said so, and a
 * selection you cannot see is a selection you cannot trust. So this answers ONE question, with the
 * SAME rule the clip uses, and everything downstream of `selectedItems` (the highlight, and Delete)
 * reads its answer rather than restating the rule.
 *
 * ⭐ **A mark belongs to where it BEGINS** — the model's own filing rule, and the copy's (2026-08-19,
 * amending the older fully-enclosed one). A dynamic and a trill are taken on their point / their
 * SIGN; a hairpin, an octave line and a pedal on their START, with their extent travelling verbatim
 * however far past the box it reaches. ⛔ Nothing is ever truncated, and ⚠️ a span that starts BEFORE
 * the box is not in it — its home is that earlier bar.
 *
 * ⚠️ The rule lives in two places — here, keyed by id, and in `./clipboard`, keyed by offset — and
 * `enclosedMarks.test.ts` pins them against each other: what a box highlights and what its copy
 * carries are asserted to be the same marks, so the two cannot drift apart in silence.
 */
import type { Fraction, Measure, Score } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import type { SelectionItem } from './selection'
import { dynamicsInBox, slursInBox } from '../utils/beatMap'
import { getMeasureNotes } from '../utils/musicUtils'
import { measureCapacityFrac } from '../utils/measureCapacity'
import { slotLength } from '../utils/durations'
import { staffOf } from '../utils/lanes'
import { staffIndexOfId } from '../engine/models/staffContent'
import { fracAdd, fracCompare, fracCreate, fracGte, fracLt } from '../utils/fraction'

/** The box, in absolute quarter beats plus the staff band its notes cover. */
interface BoxWindow {
  start: Fraction
  end: Fraction
  topStaff: number
  maxStaff: number
}

/** Where every note sits and where each bar starts, in absolute quarter beats — ONE walk of the
 *  score, read by the window (notes), the three spans (bars) and the trills (notes). */
function scorePositions(score: Score): {
  notes: Map<string, { abs: Fraction; end: Fraction; staff: number }>
  measureStart: Map<number, Fraction>
} {
  const notes = new Map<string, { abs: Fraction; end: Fraction; staff: number }>()
  const measureStart = new Map<number, Fraction>()
  let base = fracCreate(0, 1)
  for (const m of [...score.measures].sort((a, b) => a.number - b.number)) {
    measureStart.set(m.number, base)
    for (const n of getMeasureNotes(m, score)) {
      const abs = fracAdd(base, n.beat)
      notes.set(n.id, { abs, end: fracAdd(abs, slotLength(n)), staff: staffOf(n) })
    }
    base = fracAdd(base, measureCapacityFrac(m))
  }
  return { notes, measureStart }
}

/** The window `noteIds` spans: first onset → last note's END, over the staves they cover. */
function boxWindow(
  notes: Map<string, { abs: Fraction; end: Fraction; staff: number }>,
  noteIds: string[],
): BoxWindow | null {
  let start: Fraction | null = null
  let end: Fraction | null = null
  let topStaff = Infinity
  let maxStaff = -Infinity
  for (const id of noteIds) {
    const at = notes.get(id)
    if (!at) continue
    if (!start || fracCompare(at.abs, start) < 0) start = at.abs
    if (!end || fracCompare(at.end, end) > 0) end = at.end
    topStaff = Math.min(topStaff, at.staff)
    maxStaff = Math.max(maxStaff, at.staff)
  }
  return start && end ? { start, end, topStaff, maxStaff } : null
}

/**
 * ⭐⭐ **A SPAN BELONGS TO WHERE IT BEGINS** — in the box when its START is inside it, on a covered
 * staff, however far past the box it runs. His call, 2026-08-19: *"when we select the measure we
 * should select ottava and pedal too"*, having watched a 6-beat 8va and a 5-beat pedal sit out a
 * copy of the 4-beat bar they start in.
 *
 * ⭐ It is the MODEL's own filing rule: a hairpin, an octave line and a pedal are each stored on the
 * bar their start lands in, *carrying their own extent* (`types/music.ts`), precisely so they may run
 * past that bar's end. Selecting by enclosure asked a question the model does not answer.
 *
 * ⛔ It is NOT truncation — the length travels verbatim — so the old fully-enclosed rule's reason
 * (a cut 8va would transpose music the copy never covered) does not apply: nothing is cut.
 * ⚠️ A span that STARTS before the box is not in it, whatever it covers: its home is that earlier
 * bar, and a clip has no offset to file it under.
 */
function spanBelongs(w: BoxWindow, abs: Fraction, staff: number): boolean {
  if (staff < w.topStaff || staff > w.maxStaff) return false
  return fracGte(abs, w.start) && fracLt(abs, w.end)
}

/** The three measure-owned spans, by the `SelectionItem` kind each becomes. One shape — a start
 *  beat plus an amount of music — so they are read by one loop, not three. */
function measureSpans(measure: Measure): { kind: 'hairpin' | 'ottava' | 'pedal'; id: string; beat: Fraction; length: Fraction; staffId?: string }[] {
  return [
    ...(measure.hairpins ?? []).map(h => ({ kind: 'hairpin' as const, id: h.id, beat: h.beat, length: h.length, staffId: h.staffId })),
    ...(measure.ottavas ?? []).map(o => ({ kind: 'ottava' as const, id: o.id, beat: o.beat, length: o.length, staffId: o.staffId })),
    ...(measure.pedals ?? []).map(p => ({ kind: 'pedal' as const, id: p.id, beat: p.beat, length: p.length, staffId: p.staffId })),
  ]
}

/**
 * Every mark a note-selection box encloses, ready to go into `selectedItems`. The notes themselves
 * are the caller's — this answers only "what else came with them".
 */
export function marksInBox(score: Score, noteIds: string[]): SelectionItem[] {
  if (!noteIds.length) return []
  const items: SelectionItem[] = []
  // The two that predate this module, by their own rules (`utils/beatMap`): a dynamic is a POINT,
  // so it is in when its position is; a slur is in when BOTH its endpoints are selected notes.
  for (const id of dynamicsInBox(score, noteIds)) items.push({ kind: 'dynamic', id })
  for (const id of slursInBox(score, noteIds)) items.push({ kind: 'slur', id })

  const { notes, measureStart } = scorePositions(score)
  const window = boxWindow(notes, noteIds)
  if (!window) return items

  for (const measure of score.measures) {
    const base = measureStart.get(measure.number)
    if (!base) continue
    for (const span of measureSpans(measure)) {
      const abs = fracAdd(base, span.beat)
      if (spanBelongs(window, abs, staffIndexOfId(score, span.staffId))) {
        items.push({ kind: span.kind, id: span.id })
      }
    }
  }

  // ⭐ The TEMPO mark: a POINT like a dynamic, but SYSTEM-level — it has no staff and no voice, so
  // the staff band says nothing about it and its position is the whole test. ⚠️ That means a box on
  // ONE staff of a grand staff still takes the system's tempo mark; the mark governs that staff as
  // much as any other, and Sibelius's separate "system passage" is a refinement we have not made.
  for (const measure of score.measures) {
    const base = measureStart.get(measure.number)
    if (!base) continue
    for (const tempo of measure.tempos ?? []) {
      const abs = fracAdd(base, tempo.beat)
      if (fracGte(abs, window.start) && fracLt(abs, window.end)) items.push({ kind: 'tempo', id: tempo.id })
    }
  }

  // ⚠️ The TRILL is taken on its SIGN alone — the clip's own rule (`trillsInWindow`), because its
  // wavy extension is allowed to run past the window while the `tr` it belongs to is inside.
  for (const trill of score.trills ?? []) {
    const at = notes.get(trill.startNoteId)
    if (!at) continue
    if (at.staff < window.topStaff || at.staff > window.maxStaff) continue
    if (fracGte(at.abs, window.start) && fracLt(at.abs, window.end)) items.push({ kind: 'trill', id: trill.id })
  }

  return items
}

/** The seven kinds a box can drag along — every non-note thing `selectedItems` may hold by id. */
export type MarkKind = 'dynamic' | 'slur' | 'hairpin' | 'trill' | 'ottava' | 'pedal' | 'tempo'

/** The marks in a selection, in a stable order (the order {@link marksInBox} put them in). */
export function markItems(items: Iterable<SelectionItem>): { kind: MarkKind; id: string }[] {
  const out: { kind: MarkKind; id: string }[] = []
  for (const item of items) {
    switch (item.kind) {
      case 'dynamic': case 'slur': case 'hairpin': case 'trill': case 'ottava': case 'pedal': case 'tempo':
        out.push({ kind: item.kind, id: item.id })
        break
      default:
        break
    }
  }
  return out
}

/** What each kind's removal is called on the engine — the one place the six are mapped. */
export type MarkRemover = Pick<MusicEngine,
  'removeDynamic' | 'removeSlur' | 'removeHairpin' | 'removeTrill' | 'removeOttava' | 'removePedal' | 'removeTempoMark'>

/**
 * ⭐ **DELETE TAKES WHAT THE HIGHLIGHT SHOWED.** A box that paints a hairpin as selected must
 * remove it on Delete, or the highlight is a promise the editor does not keep — which is the same
 * argument that put these kinds in the selection at all. ⚠️ Call inside the caller's `runBatch`:
 * clearing a bar is ONE undo step, not one per mark.
 */
export function removeMarks(engine: MarkRemover, marks: { kind: MarkKind; id: string }[]): void {
  for (const mark of marks) {
    switch (mark.kind) {
      case 'dynamic': engine.removeDynamic(mark.id); break
      case 'slur': engine.removeSlur(mark.id); break
      case 'hairpin': engine.removeHairpin(mark.id); break
      case 'trill': engine.removeTrill(mark.id); break
      case 'ottava': engine.removeOttava(mark.id); break
      case 'pedal': engine.removePedal(mark.id); break
      case 'tempo': engine.removeTempoMark(mark.id); break
    }
  }
}

/** `2 dynamic(s) + 1 hairpin(s)` — the undo label's tail, empty when nothing came along. */
export function marksLabel(marks: { kind: MarkKind; id: string }[]): string {
  const counts = new Map<MarkKind, number>()
  for (const mark of marks) counts.set(mark.kind, (counts.get(mark.kind) ?? 0) + 1)
  return [...counts].map(([kind, n]) => `${n} ${kind}(s)`).join(' + ')
}
