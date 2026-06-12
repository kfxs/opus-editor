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
 * NOTE (Phase 1): the union covers every selectable element so the container is
 * future-proof, but only `note` is currently routed through the set (see
 * SelectionController / MouseController). The other kinds remain single-select
 * via their scalar fields on EditorState until later phases migrate them here.
 */
export type SelectionItem =
  | { kind: 'note'; id: string } // notes and rests
  | { kind: 'dynamic'; id: string }
  | { kind: 'tuplet'; id: string }
  | { kind: 'tie'; fromNoteId: string }
  | { kind: 'articulation'; noteId: string; type: string }
  | { kind: 'accidental'; noteId: string; type: string }
  | { kind: 'clef'; measure: number; beat: number }
  | { kind: 'timeSignature'; measure: number }

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
      return `${item.kind}:${item.id}`
    case 'tie':
      return `tie:${item.fromNoteId}`
    case 'articulation':
    case 'accidental':
      return `${item.kind}:${item.noteId}:${item.type}`
    case 'clef':
      return `clef:${item.measure}:${item.beat}`
    case 'timeSignature':
      return `timeSignature:${item.measure}`
  }
}

/** The distinct kinds present in a selection. */
export function selectionKinds(items: Iterable<SelectionItem>): Set<SelectionKind> {
  const kinds = new Set<SelectionKind>()
  for (const item of items) kinds.add(item.kind)
  return kinds
}

/** The ids of every `note` item in the selection, in insertion order. */
export function selectedNoteIds(items: Iterable<SelectionItem>): string[] {
  const ids: string[] = []
  for (const item of items) if (item.kind === 'note') ids.push(item.id)
  return ids
}
