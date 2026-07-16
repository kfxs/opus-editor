# Accidental stamp tool + selectable-accidental editing

Two related additions to how accidentals are worked with, plus three bug fixes found
alongside. The **stamp** is the sibling of the articulation stamp
(`docs/articulation-stamp-plan.md`) — read that first; this doc records only where accidentals
differ.

## 1. Accidental stamp tool

A Sibelius-style marking tool: arm an accidental, then click existing notes to set it.

Trigger: **selection mode, with no note or group selected**, press ♯ / ♭ / ♮ on the Keypad.

- Arms that accidental and switches to entry mode. A **ghost accidental** follows the cursor.
- Click a note → **sets** that accidental on it, changing its pitch (existing notes only; a
  rest / empty space / non-note is a no-op, the click still consumed).
- **Stays armed** so you can mark a whole passage. Esc / Select arrow / an armed-key re-press
  disarms.

### Two ways it differs from the articulation stamp

1. **Single-valued, not additive.** A note has exactly *one* accidental state, so there is no
   armed *set* — `EditorState.selectedAccidentalTool: Accidental | null`. Pressing a *different*
   accidental key **swaps** which one is armed; pressing the armed one disarms. No stacking.
2. **Idempotent apply, and it changes pitch.** Stamping the sign a note already shows does
   **nothing** (per the user — removal stays on the Delete key, so a stray double-click can't
   silently re-spell a note). Applying an accidental is not cosmetic like an articulation: it
   re-spells the note via the shared engine path.

### Promote to note entry ("accidental + duration")

Press a **duration** key while the stamp is armed → `promoteAccidentalStampToNoteEntry` moves the
armed accidental into `selectedAccidental` (the note-entry armed value) and clears the tool. The
ghost becomes a *ghost note carrying that accidental* and clicks place new notes — the old
duration-attached workflow, preserved.

## 2. Selectable accidental → Keypad editing

Clicking a standalone accidental glyph already set `selectedAccidentalNoteId` +
`selectedAccidentalType` (an accStr `'#' | 'b' | 'n' | '##' | 'bb'`) and highlighted it in the
score. Now:

- **Keypad reflects it.** `keypadSync` lights the matching key via `accidentalTypeToKey`
  (`utils/pitchSpelling`); double accidentals map to `null` (the numpad has no ♯♯/♭♭ key).
- **Keypad edits it.** A press routes to `editSelectedAccidental` (ahead of the apply/arm-stamp
  branches, so it never arms the stamp): the **same** accidental (or a null "remove") deletes it —
  reverting the note to the measure's prevailing alteration, like the Delete key — and a
  **different** accidental changes it, keeping the new sign selected.
- **Switch-off clears the selection.** Unlike the Delete key (which keeps the note selected to keep
  editing), the Keypad remove calls `selectNote(null)`, so nothing stays selected. Otherwise the
  Keypad would light a stray duration: `SelectionController.selectNote` sets state without
  rendering, so selecting the note *after* `renderScore()` left `selectedNoteId` set with no visible
  highlight, and `keypadSync` lit its duration.

Selecting a **note** now also highlights its accidental (`HighlightController.highlightNoteAccidental`),
so a selected note reads as fully selected (head + stem + sign). It matches the registered accidental
element by bbox on **both** axes (an X-only match would grab a chord neighbour's accidental or a
notehead in the column), scoped to the note's own `vf-stavenote` group, via the logged `setAttr` so
`clearHighlights` reverts it.

## 4. Same for articulations (they're additive)

The articulation equivalent of §2, differing because articulations **stack** (a note carries a set,
not one sign):

- **Keypad edits a selected articulation group.** Clicking an articulation glyph already selects the
  whole group on that note (`selectedArticulationNoteId`) and lights its Keypad keys (the highlight
  was already wired — `selectedNoteHasArticulation` reads `selectedArticulationNoteId ?? selectedNoteId`).
  Now a Keypad press routes to `editSelectedArticulation` (ahead of the apply/arm-stamp branch, so it
  never arms the stamp): **additively toggle** that articulation on the group — add if missing, remove
  if present — with the group-toggle semantics of `applyArticulationToSelection` (works across a
  Ctrl-click multi-group selection too). Toggling off the **last** articulation clears the selection
  (`selectNote(null)`), mirroring the accidental switch-off; Del still clears a whole group.
- **Selected note highlights its articulations.** `highlightNote` now also colours the note's
  articulation glyphs, so a selected note reads as fully selected (head + stem + accidental +
  articulations). The glyph-finding is shared with the group highlight via
  `HighlightController.colorNoteArticulations(noteId, color)` — find each registered articulation
  element, colour the closest glyph inside the note's own `vf-notehead` group (skip the notehead at
  index 0). `applyArticulationHighlight` was refactored to call it too.

## 5. Keypad Select arrow clears the whole selection

`PaletteController.enterSelectionMode` (the Keypad arrow) used to be a no-op when already in selection
mode. Now it runs the full Esc-path deselect (`SelectionController.deselectAll` — notes, all scalar
sub-selections, dynamics, tuplets) via an injected `deselectAll` callback, then ensures selection mode.
So pressing the arrow with anything selected clears it. Only the Keypad arrow calls this path.

## 3. Fixes found alongside

- **Natural was invisible in the note-entry ghost.** A ♮ is `alter 0`, and the ghost only drew an
  accidental when `alter !== 0`. `GhostNote.forceAccidental` now flags an armed natural, drawn as
  `new Accidental('n')`. (The stamp ghost was already fine — it draws `new Accidental(sign)` directly.)
- **A fresh duration press carried a stale accidental.** After entering a sharp note and Esc-ing to
  nothing selected, pressing a duration kept the sharp armed. Fixed in `setDuration`: the
  fresh-entry branch clears `selectedAccidental`. Safe because an *intentionally* armed accidental
  arms the stamp (→ entry mode) and so lands in the entry branch, never the fresh-entry branch.

## Shared engine seam

`MusicEngine.setNoteAccidental(noteId, accidental)` and `noteDisplaysAccidental(noteId, accidental)`
are used by **both** the palette apply-path and the mouse stamp, so they re-spell / test identically.
Removal semantics (revert to the prevailing alteration) reuse `getPrevailingAlter` from the earlier
accidental-UX work.

The whole feature lives in `interactions/` + `engine/` (framework-agnostic); the Keypad drives it
through the existing `accidentalSelection` press/highlight channels — no Vue-side code needed.
