/**
 * ⭐⭐ **REACHING A MARK FROM THE MUSIC INSTEAD OF FROM ITS INK** — what is attached to the selected
 * note, as things that can be SELECTED.
 *
 * His report, 2026-08-18, and it is a real bug rather than a nicety: a slur endpoint dragged far
 * enough takes the whole repair kit off screen with it. Every affordance for undoing a displacement
 * lives ON the ink — both endpoint squares, both arc dots, and the arc itself as a hit target — so
 * once the ink leaves the viewport there is no way back to it with the mouse. What survives is
 * `Ctrl+Z`, `Ctrl+Backspace` while the end is still ARMED, and the Properties reset while the slur is
 * still SELECTED; ⚠️ so the bottleneck is SELECTION, and clicking away is what strands you.
 *
 * ⭐ **A vertical limit does not fix this** (`engine/layout/systemBand`, the same day): a limit stops
 * NEW cases and gives no route into a file that already carries one. And no cleverer handle can fix it
 * either — with a free offset, *any* on-ink affordance can leave the screen. The only thing that
 * cannot is the anchor: a note is always where the music is.
 *
 * ## The rule
 *
 * Select a note; this answers with the marks hanging off it, each already shaped as the
 * `SelectedElement` a click on its ink would have produced — so nothing downstream learns a second way
 * to be selected, and every existing repair (the squares, the arrows, `Ctrl+Backspace`, the Properties
 * reset) works on the result unchanged.
 *
 * ⚠️ **Note-anchored kinds are exact; beat-anchored ones are "starts in this bar, at or before this
 * note".** A slur and a trill name their notes, so those are certain. A hairpin, an octave line, a
 * pedal, a dynamic and a tempo mark are positional, and a span may run past the barline — resolving
 * "covers this note" would need absolute time across measures, which this deliberately does not do.
 * The consequence, stated so nobody reports it as a bug: to reach a span, select a note in the bar it
 * STARTS in.
 *
 * ⚠️ A mark that carries a VOICE is only offered to a note in that voice; a mark without one belongs
 * to the staff and is offered to any of its notes.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { SelectedElement } from './EditorState'
import { fracCompare } from '../utils/fraction'
import { voiceOf } from '../utils/lanes'

/** What the query needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type MarkQueryEngine = Pick<MusicEngine, 'getNote' | 'getScore'>

/** One reachable mark: what to call it, and the selection that reaches it. */
export interface AttachedMark {
  /** For a menu row. Carries the END for a span whose two ends are separately armable, and the TEXT
   *  for a mark that has one, since several dynamics in a bar are otherwise indistinguishable. */
  label: string
  /** ⭐ The very same value the mark's own hit-test produces (`interactions/elements/*`), so the
   *  caller only has to assign it. */
  element: SelectedElement
}

/**
 * The marks attached to `noteId`, in a fixed order (slur, trill, then the beat-anchored family) so a
 * menu built from it does not reshuffle between openings.
 *
 * Returns an empty list for a missing note, and for a note nothing hangs off — the caller shows no
 * rows rather than an empty submenu.
 */
export function attachedMarksOf(engine: MarkQueryEngine, noteId: string): AttachedMark[] {
  const note = engine.getNote(noteId)
  if (!note) return []
  const score = engine.getScore()
  const voice = voiceOf(note)
  const marks: AttachedMark[] = []

  // ⭐ Note-anchored, so exact — and BOTH ends are offered, because which end is armed is the whole
  // point of reaching a slur this way: the arrows and `Ctrl+Backspace` act on the armed one.
  for (const slur of score.slurs ?? []) {
    if (slur.startNoteId === noteId) marks.push({ label: 'Slur (start)', element: { kind: 'slur', id: slur.id, endpoint: 'start' } })
    if (slur.endNoteId === noteId) marks.push({ label: 'Slur (end)', element: { kind: 'slur', id: slur.id, endpoint: 'end' } })
  }
  for (const trill of score.trills ?? []) {
    if (trill.startNoteId === noteId) marks.push({ label: 'Trill', element: { kind: 'trill', id: trill.id } })
  }

  const measure = score.measures.find(m => m.number === note.measure)
  if (!measure) return marks

  // ⚠️ At or BEFORE the note's beat (see the header): a span is reachable from any note after its
  // start in the same bar, a point mark only from its own beat — which the same comparison gives,
  // since a point mark's start IS its position.
  const startsAtOrBefore = (beat: Parameters<typeof fracCompare>[0]) => fracCompare(beat, note.beat) <= 0

  for (const hairpin of measure.hairpins ?? []) {
    if (startsAtOrBefore(hairpin.beat) && (hairpin.voice ?? 0) === voice) {
      marks.push({ label: `Hairpin (${hairpin.type})`, element: { kind: 'hairpin', id: hairpin.id } })
    }
  }
  for (const ottava of measure.ottavas ?? []) {
    if (startsAtOrBefore(ottava.beat)) {
      marks.push({ label: 'Octave line', element: { kind: 'ottava', id: ottava.id } })
    }
  }
  for (const pedal of measure.pedals ?? []) {
    if (startsAtOrBefore(pedal.beat)) {
      marks.push({ label: 'Pedal', element: { kind: 'pedal', id: pedal.id } })
    }
  }
  for (const dynamic of measure.dynamics ?? []) {
    if (fracCompare(dynamic.beat, note.beat) === 0 && (dynamic.voice ?? 0) === voice) {
      marks.push({ label: `Dynamic${dynamic.text ? ` (${dynamic.text})` : ''}`, element: { kind: 'dynamic', id: dynamic.id } })
    }
  }
  for (const tempo of measure.tempos ?? []) {
    if (fracCompare(tempo.beat, note.beat) === 0) {
      marks.push({ label: `Tempo${tempo.text ? ` (${tempo.text})` : ''}`, element: { kind: 'tempo', id: tempo.id } })
    }
  }
  return marks
}
