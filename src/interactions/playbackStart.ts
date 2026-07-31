import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'

/**
 * **Where playback begins: at what you are looking at.**
 *
 * Sibelius's behaviour, and the reason `p` is the play key here at all (docs: the play shortcut was
 * taken from Sibelius, where it plays *from the selection*). Select a note in bar 40, press `p`, and
 * you hear bar 40 — not four minutes of music you have already heard.
 *
 * The rules, in the order they are asked:
 *
 *  1. **A selected element** plays from the bar it belongs to. ⭐ Except a BARLINE, which plays from
 *     the bar that STARTS after it: a barline is a boundary, and the thing you point at a boundary
 *     for is what comes next (`{ kind: 'barline', measure: N }` means "the line that ENDS bar N").
 *  2. **A selection of notes** plays from the EARLIEST of them — by position, not by the order they
 *     were clicked, since ctrl-clicking backwards through a phrase is ordinary.
 *  3. **Nothing selected** plays from the top.
 *
 * ⚠️ It answers a measure and nothing else. Starting mid-bar would need the playback engine to seek
 * to a beat, which it cannot ({@link MusicEngine.seekToMeasure} is the only seek), and a bar is the
 * unit a musician thinks in anyway — "from bar 40", not "from bar 40 beat 3".
 */
export function playbackStartMeasure(state: EditorState, engine: MusicEngine): number {
  const last = engine.getScore().measures.length
  const clamp = (m: number) => Math.min(Math.max(Math.round(m), 1), Math.max(1, last))

  const fromElement = selectedElementMeasure(state, engine)
  if (fromElement !== null) return clamp(fromElement)

  const fromNotes = earliestSelectedNoteMeasure(state, engine)
  if (fromNotes !== null) return clamp(fromNotes)

  return 1
}

/**
 * The bar a selected element sits in, or null when nothing is selected (or the element cannot be
 * located — see below).
 *
 * ⭐ **Not a fifteen-way switch.** Four kinds carry a `measure` in the union itself and are answered
 * from it, which works even for music scrolled off-screen. Every other kind is named by an ID, and
 * an id is an id: the ElementRegistry knows which bar it drew each one in, so ONE lookup covers
 * dynamics, tempo marks, slurs, tuplets, ties, articulations, accidentals, dots, stems and
 * tremolos, and a fifteenth kind needs nothing added here.
 *
 * ⚠️ The registry only holds what was DRAWN, so an element culled off-screen resolves to null and
 * playback falls through to the note selection, then to the top. Stated rather than papered over:
 * the alternative is a per-kind walk of the model to find an id's bar, which is a lot of code for a
 * case that needs the user to select something and then scroll it out of the window before pressing
 * play. If that ever bites, the fix is `MusicEngine.measureOfElement(id)`, not a guess here.
 */
function selectedElementMeasure(state: EditorState, engine: MusicEngine): number | null {
  const el = state.selectedElement
  if (!el) return null

  switch (el.kind) {
    // ⭐ The boundary case: the line that ENDS bar N, so playing "from here" means bar N+1.
    case 'barline': return el.measure + 1
    case 'clef':
    case 'timeSignature': return el.measure
    // A range of bars plays from its first, whichever end the box was dragged from.
    case 'measureRange': return Math.min(el.anchor, el.focus)
    default: return measureOfId(engine, idOf(el))
  }
}

/** The id an id-addressed selection names — the note for the marks that hang off one, its own id
 *  otherwise. Every kind not answered from the union above has exactly one. */
function idOf(el: NonNullable<EditorState['selectedElement']>): string | undefined {
  if ('noteId' in el) return el.noteId
  if ('fromNoteId' in el) return el.fromNoteId
  if ('id' in el) return el.id
  return undefined
}

/** Which bar the renderer drew this element in, if it drew it at all. */
function measureOfId(engine: MusicEngine, id: string | undefined): number | null {
  if (!id) return null
  // A note answers from the MODEL first: it is the common case, and unlike the registry the model
  // knows about notes nobody can currently see.
  const note = engine.getNote(id)
  if (note) return note.measure
  return engine.getElementRegistry().getById(id)?.measure ?? null
}

/**
 * The earliest selected note's bar — by POSITION (bar, then beat), not by click order.
 *
 * `selectedItems` is a Map, so its iteration order is the order things were added to the selection;
 * shift-clicking backwards through a phrase, or ctrl-clicking a chord's notes out of order, would
 * otherwise start playback in the middle of what you picked.
 *
 * ⚠️ **Read the VALUES, never the keys.** A key is `itemKey(item)` — `"note:abc-123"`, a dedup
 * string — and the ids that go to the engine are on the items themselves. Reading the keys is why
 * this shipped broken: every `getNote` lookup missed, the whole branch fell through, and playback
 * started at bar 1 for any note selection. My own test passed because it built the Map by hand with
 * bare ids, so it asserted the bug rather than the behaviour.
 *
 * ⚠️ And the Map is not only notes: a passage selection sweeps in the dynamics and slurs the box
 * covered. Those are not where the music starts — the notes are.
 */
function earliestSelectedNoteMeasure(state: EditorState, engine: MusicEngine): number | null {
  const ids: string[] = []
  for (const item of state.selectedItems.values()) {
    if (item.kind === 'note') ids.push(item.id)
  }
  if (ids.length === 0 && state.selectedNoteId) ids.push(state.selectedNoteId)

  let best: { measure: number; beat: number } | null = null
  for (const id of ids) {
    const note = engine.getNote(id)
    if (!note) continue
    const beat = note.beat.num / note.beat.den
    if (!best || note.measure < best.measure || (note.measure === best.measure && beat < best.beat)) {
      best = { measure: note.measure, beat }
    }
  }
  return best?.measure ?? null
}
