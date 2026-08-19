/**
 * The selection model for the score editor.
 *
 * A selection is an ordered set of {@link SelectionItem}s. Each item carries a
 * `kind` discriminator plus whatever locator identifies that element (a string
 * id for notes/dynamics/tuplets, a composite key for ties/articulations/clefs/…).
 * The `kind` is what lets a command ask "which of the selected things do I apply
 * to?" — not every edit applies to every kind.
 *
 * Framework-agnostic: no Vue/React/Angular imports.
 *
 * NOTE: the union covers every selectable element so the container is future-proof,
 * but only `note` and `articulation` are routed through the set by a click (plus the
 * `dynamic`/`slur`/`hairpin`/`trill`/`ottava`/`pedal` items a box drags along — see SelectionController /
 * MouseController). Every other kind is SINGLE-select and lives in
 * `EditorState.selectedElement`, its own discriminated union; migrating one here means
 * giving it a real multi-selection, which none of them has yet.
 */
export type SelectionItem =
  | { kind: 'note'; id: string } // notes and rests
  | { kind: 'dynamic'; id: string }
  | { kind: 'tuplet'; id: string }
  | { kind: 'tie'; fromNoteId: string }
  | { kind: 'slur'; id: string }
  /** ⭐ The four SPANS a passage box drags along with its notes (2026-08-19). They were always
   *  taken by the copy (`clipboard`'s `*InWindow` builders) and never shown as selected, which is
   *  the gap `enclosedMarks.marksInBox` closes: the highlight is a promise about what travels. */
  | { kind: 'hairpin'; id: string }
  | { kind: 'trill'; id: string }
  | { kind: 'ottava'; id: string }
  | { kind: 'pedal'; id: string }
  | { kind: 'articulation'; noteId: string; type: string }
  | { kind: 'accidental'; noteId: string; type: string }
  | { kind: 'clef'; measure: number; beat: number }
  | { kind: 'timeSignature'; measure: number }
  /** The line that ENDS this measure — a boundary, not an object (see `SelectedElement`'s `barline`). */
  | { kind: 'barline'; measure: number }

export type SelectionKind = SelectionItem['kind']

/**
 * A stable string key for set membership / dedup. Two items refer to the same
 * element iff their keys are equal.
 */
export function itemKey(item: SelectionItem): string {
  switch (item.kind) {
    case 'note':
    case 'dynamic':
    case 'tuplet':
    case 'slur':
    case 'hairpin':
    case 'trill':
    case 'ottava':
    case 'pedal':
      return `${item.kind}:${item.id}`
    case 'tie':
      return `tie:${item.fromNoteId}`
    case 'articulation':
      // Group selection: one item per note covers ALL its articulations (the `type`
      // field is carried for context but does not participate in identity), so toggling
      // any articulation on a note toggles that note's whole group.
      return `articulation:${item.noteId}`
    case 'accidental':
      return `${item.kind}:${item.noteId}:${item.type}`
    case 'clef':
      return `clef:${item.measure}:${item.beat}`
    case 'timeSignature':
      return `timeSignature:${item.measure}`
    case 'barline':
      return `barline:${item.measure}`
  }
}

/** The ids of every `note` item in the selection, in insertion order. */
export function selectedNoteIds(items: Iterable<SelectionItem>): string[] {
  const ids: string[] = []
  for (const item of items) if (item.kind === 'note') ids.push(item.id)
  return ids
}

/**
 * True when more than one NOTE is selected. The Keypad reflects a SINGLE selected note (its duration,
 * accidental, dot, articulations, tie, rest) — a multi-note selection can't stand for any one note's
 * value, so those keys light nothing rather than showing the anchor note's and misleading. Counts
 * notes, not items: a note plus a non-note (e.g. a dynamic) still reflects that one note.
 */
export function multipleNotesSelected(items: Iterable<SelectionItem>): boolean {
  let count = 0
  for (const item of items) if (item.kind === 'note' && ++count > 1) return true
  return false
}

/** The note ids of every selected articulation GROUP, in insertion order. */
export function selectedArticulationNoteIds(items: Iterable<SelectionItem>): string[] {
  const ids: string[] = []
  for (const item of items) if (item.kind === 'articulation') ids.push(item.noteId)
  return ids
}
