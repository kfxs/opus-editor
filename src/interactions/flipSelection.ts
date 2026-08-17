/**
 * ⭐ **WHAT `x` FLIPS** — the whole answer to one key, in one table.
 *
 * A module of its own, not a seventh `if` in `shortcutWiring`, per CLAUDE.md's rule: what was there
 * had grown to a chain of six per-kind branches (slur, hairpin, trill, tie, tuplet, articulation)
 * ending in the note-stem fallback, and the ottava would have been the seventh. **A slice too thin
 * to be logic is still a slice** — so the family gets a table ({@link FLIP_ELEMENT}) and a ROW,
 * and the controller keeps one delegating line.
 *
 * ⭐⭐ **The chain was never a chain.** `selectedElement` holds exactly ONE element
 * (`interactions/EditorState.ts` — "selecting IS clearing"), so six ordered `selectedOf(state, …)`
 * questions could only ever have one yes. Written as a lookup on `.kind` there is no order left to
 * get wrong, which is what {@link EditorState.selectedOf}'s own doc-comment recommends for a
 * dispatch. ⚠️ What DOES stay ordered is the tail: the articulation branch reads the multi-select
 * (`selectedItems`, which rides alongside a selected element) and the stem is the fallback for
 * "nothing else answered", so those two must be tried after the table and in that order.
 *
 * ## What "flip" means is not the same thing in every row, deliberately
 *
 *  - a SIDE (slur, trill, tie, tuplet, articulation, stem): which side of the staff the mark sits,
 *    nothing about what it means;
 *  - a MEANING (hairpin `cresc` ↔ `dim`, ottava `8va` ↔ `8vb`): the mark says something else
 *    afterwards, and the ottava's row is the only one that changes what the music SOUNDS.
 *
 * ⛔ That is not an inconsistency to tidy into two keys. `x` is "turn the selected thing around",
 * and for a wedge or an octave line there is only one thing anyone would ever want one key for
 * (his call for the hairpin, 2026-08-12; for the ottava, 2026-08-17).
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState, SelectedElement } from './EditorState'
import { selectedArticulationNoteIds } from './selection'

/** The kinds `x` answers for — every other member of {@link SelectedElement} has no two sides. */
type FlippableKind = 'slur' | 'hairpin' | 'trill' | 'ottava' | 'tie' | 'tuplet'

/**
 * ONE ROW PER FLIPPABLE ELEMENT. A new kind that can be turned around adds a row here and nothing
 * else; a kind that cannot is simply absent, which is why this is a partial map and not a total one
 * over {@link SelectedElement} (a `measureRange` has no other side).
 *
 * ⚠️ Each row calls a MusicEngine method that already exists and already records its own undo entry
 * — nothing about flipping is invented here.
 */
const FLIP_ELEMENT: {
  [K in FlippableKind]: (engine: MusicEngine, element: Extract<SelectedElement, { kind: K }>) => void
} = {
  // A slur flips SIDE — above ↔ below.
  slur: (engine, el) => engine.flipSlur(el.id),
  // ⚠️ A hairpin flips its TYPE — crescendo ↔ diminuendo — the one row that changes what a mark
  // MEANS rather than which side of the staff it sits on (his call, 2026-08-12). It is not an
  // inconsistency to tidy away later: a wedge's side is `placement`, shared with every dynamic on
  // its line and impossible to move alone, while `<` vs `>` is the only thing about a wedge you
  // would ever want one key for. A CONTENT edit, hence the undo entry `toggleHairpinType` commits.
  hairpin: (engine, el) => engine.toggleHairpinType(el.id),
  // ⭐ A trill flips its SIDE, and unlike the hairpin above it really is a side: `placement` is the
  // trill's own field and it shares no line with anything (a trill is not a baseline family), so
  // moving it moves nothing else. `below` is the multi-voice case (docs/trill-plan.md §1 rule 2),
  // which is exactly when a user reaches for this key.
  trill: (engine, el) => engine.toggleTrillPlacement(el.id),
  // ⭐⭐ An OTTAVA flips its DIRECTION — 8va ↔ 8vb, 15ma ↔ 15mb (his request, 2026-08-17: *"we should
  // use shortcut x to switch 8va to 8vb when selected"*). The hairpin's kind of flip, one degree
  // stronger: `shift` is what the covered notes SOUND, so this is the only row on the table that
  // moves the music rather than the ink. The sign is NEGATED, so the distance survives the flip.
  ottava: (engine, el) => engine.toggleOttavaDirection(el.id),
  // A tie flips its curve direction (up ↔ below), staying notehead-anchored. ⚠️ Keyed by the note it
  // comes FROM, not by an id of its own — a tie is a relation between two notes.
  tie: (engine, el) => engine.flipTie(el.fromNoteId),
  // A tuplet flips its bracket/number side (above ↔ below).
  tuplet: (engine, el) => engine.flipTuplet(el.id),
}

/**
 * Flip whatever is selected: the element in {@link FLIP_ELEMENT}, else every selected articulation,
 * else the selected note's stem.
 *
 * ⚠️ DECLINES — returns false without touching the score — when nothing selected has two sides. The
 * caller must not repaint on a false: `x` with an empty selection is a key that did nothing, and a
 * render to show no change is the reflex `feedback_think_before_rendering` names.
 *
 * @returns true if something was flipped (the caller then re-renders).
 */
export function flipSelection(state: EditorState, engine: MusicEngine): boolean {
  const element = state.selectedElement
  if (element && element.kind in FLIP_ELEMENT) {
    const flip = FLIP_ELEMENT[element.kind as FlippableKind] as (e: MusicEngine, el: SelectedElement) => void
    flip(engine, element)
    return true
  }

  // The MULTI-select tail: articulations live in `selectedItems`, not in `selectedElement`, so they
  // are asked after the table rather than in it — and every selected group flips as ONE undoable
  // action, because "flip these" is one gesture however many notes it lands on.
  const articulationNoteIds = selectedArticulationNoteIds(state.selectedItems.values())
  if (articulationNoteIds.length) {
    engine.runBatch(`Flip articulations on ${articulationNoteIds.length} note(s)`, () => {
      for (const noteId of articulationNoteIds) engine.flipArticulation(noteId)
    })
    return true
  }

  // …and the fallback that gives the key its name: with a plain note selected, `x` flips its stem.
  if (!state.selectedNoteId) return false
  engine.flipStemDirection(state.selectedNoteId)
  return true
}
