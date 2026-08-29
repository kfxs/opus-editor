/**
 * ⭐⭐ **A PASSAGE — a rectangle of music: a run of BARS × a run of STAVES.**
 *
 * 🚨 **HIS REPORT, 2026-08-29** (console log, two staves): click a bar on staff 0, then shift-click
 * the same bar on staff 1 expecting *"the measure but in both staves"* — and instead the press fell
 * through to the note-range path (`✓ Range extended to Rest … size:2`). ⛔ **Not a dispatch bug: it
 * was not REPRESENTABLE.** `SelectedElement`'s `measureRange` carried `staff: number` — ONE staff —
 * so a measure selection spanning two staves had nowhere to be put.
 *
 * ⭐ **`selectedElement` now carries a staff SPAN** (`staff` = the anchor, `focusStaff` = where the
 * shift-click landed), and this module is the arithmetic over it: normalise the two axes, and answer
 * *what is inside*.
 *
 * ## ⭐⭐ WHY THIS IS A MODULE AND NOT THREE LINES IN `MouseController`
 *
 * The gathering had exactly one caller and lived inline. It now has three — the plain click, the
 * shift extension, and the highlight that has to paint the same rectangle — and *"the HIGHLIGHT
 * PROMISES THE COPY"* ([[project_passage_selection_marks]]): the box a user sees and the ids a Delete
 * or a Copy acts on must be **one answer**, not two that agree by inspection. ⛔ Two call sites
 * filtering `staffOf` by hand is exactly how they drift.
 *
 * ## ⚠️ `staff` STAYS THE ANCHOR, and that is deliberate
 *
 * 21 sites read `measureRange`, most of them asking *"which staff is this about?"* for a per-staff
 * operation (the size toggle, the add-staff-above/below reference, the key/barline stamps). Making
 * `staff` mean *the anchor* keeps every one of them correct for the single-staff case they were
 * written for, and ⛔ avoids a 21-file change to fix a two-staff selection. ⏭️ Each can grow to the
 * whole span when its own feature wants it — the span is there to read.
 */
import type { Score } from '@/types/music'
import { measureSelectableNotes } from '@/utils/musicUtils'
import { staffOf } from '@/utils/lanes'

/** A run of bars × a run of staves, both normalised low→high. */
export interface MeasurePassage {
  fromMeasure: number
  toMeasure: number
  fromStaff: number
  toStaff: number
}

/** What a `measureRange` selection needs to describe a passage — declared structurally so this
 *  module does not import `EditorState` back. */
export interface PassageSpan {
  anchor: number
  focus: number
  staff: number
  focusStaff: number
}

/**
 * ⭐ **Normalise a selection's two axes.** The anchor may be after the focus on either — a user may
 * drag a passage upward, or leftward, or both — and everything downstream wants low→high.
 */
export function passageOf(span: PassageSpan): MeasurePassage {
  return {
    fromMeasure: Math.min(span.anchor, span.focus),
    toMeasure: Math.max(span.anchor, span.focus),
    fromStaff: Math.min(span.staff, span.focusStaff),
    toStaff: Math.max(span.staff, span.focusStaff),
  }
}

/** Does this passage reach more than one staff? (What tells a grand-staff selection from a
 *  one-staff one, without every caller re-deriving the comparison.) */
export function spansStaves(passage: MeasurePassage): boolean {
  return passage.toStaff > passage.fromStaff
}

/**
 * ⭐⭐ **Every selectable note and rest inside the passage**, in score order.
 *
 * ⚠️ **Rests included, and every FANNED MEMBER** — the reason `measureSelectableNotes` exists rather
 * than `getMeasureNotes`: a bar always has content, and a member is a head with an id like any
 * other. Selecting a bar holding a fan used to take one note out of six, so the Delete or Copy that
 * followed took one note out of six.
 *
 * Ordered bar-by-bar and, within a bar, by beat — so the LAST id is genuinely the passage's last
 * event, which is what the selection anchor wants.
 */
export function passageNoteIds(score: Score, passage: MeasurePassage): string[] {
  const ids: string[] = []
  for (const measure of score.measures) {
    if (measure.number < passage.fromMeasure || measure.number > passage.toMeasure) continue
    for (const note of measureSelectableNotes(measure, score)) {
      const staff = staffOf(note)
      if (staff < passage.fromStaff || staff > passage.toStaff) continue
      ids.push(note.id)
    }
  }
  return ids
}
