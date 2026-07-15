# Articulation stamp tool

A Sibelius-style "stamp" for articulations: arm one or more articulations, then click
existing notes to add them. It is a **marking tool** (like the clef / time-signature /
dynamic tools) — but unlike those, which *place a new object at a slot*, the stamp
*attaches an articulation to the note you click*. No note is entered.

## Behaviour

Trigger: **selection mode, with no note or group of notes selected**, press an articulation
key (accent / staccato / tenuto) on the Keypad.

- Arms that articulation and switches to entry mode. A **ghost articulation** follows the
  cursor (translucent blue, floated a few px above the pointer so the lowest glyph clears it).
- Click a note that **lacks** the articulation → adds it. Click a note that already has it,
  or empty space / a rest / any non-note → **nothing** (the click is still consumed).
- **Additive**: press another articulation key → it joins the armed set (all get stamped
  together, drawn stacked in the ghost). Press an armed one → it drops out. Empty the set →
  disarm back to selection mode.
- Press the Select arrow / Esc / an arrow-key → disarm (the tool is entry-only, so it clears
  with the other positional tools in `disarmPositionalTools`).
- While stamping, the Keypad lights **only** the armed articulations — duration / accidental /
  dot stay dark (this isn't note entry).

**Promote to note entry**: press a **duration** key while the stamp is armed → the armed
articulations become the arm-for-next-note flags and the stamp set clears. The ghost turns
into a *ghost note wearing those articulations*, and clicks now **place new notes** carrying
them — the ordinary "articulation + duration" note-entry mode. Nothing is lost in the handoff.

## Where the three articulation behaviours diverge

One Keypad press (`articulationSelection.press` → `PaletteController.toggle{Accent,Staccato,
Tenuto}` → `pressArticulation`) routes to one of three behaviours by context:

1. **Selection mode, a real selection** → toggle the articulation across the selection
   (`applyArticulationToSelection`). Unchanged, pre-existing behaviour.
2. **Selection mode, nothing to apply to** → arm the stamp tool. "Nothing to apply to" is
   decided by `applyArticulationToSelection` returning false, **not** by `selectedNoteId`:
   after note entry, Select/Esc leaves the *cursor note* in `selectedNoteId` while the
   multi-select set is empty, which reads as "nothing selected" to the user.
3. **Entry mode (note entry)** → arm/disarm the articulation for the next note entered
   (the `accent`/`staccato`/`tenuto` flags). Unchanged, pre-existing behaviour.

## State & data flow

- `EditorState.selectedArticulationTools: ArticulationType[]` — the armed set (empty = not
  active). Always **reassigned**, never mutated in place, so the observable state emits.
- `stampArticulationAtClick` (MouseController) adds the missing articulations to the clicked
  note in one `runBatch` → one undo entry. Same note-body hit-test as selection clicks
  (`hitsNoteOrRestBody`), so a near-miss does nothing.
- Ghost: `renderToolGhost` → `RenderController.renderArticulationGhost` →
  `MusicEngine` → `VexFlowRenderer.renderScoreWithArticulationGhost`. The articulation is
  drawn **standalone into its own `openGroup`** (no note drawn) — `setStave` gives it its Y and
  `Formatter.format` its X, which is everything `Articulation.draw()` reads. It does **not**
  reuse the dynamic-ghost's `getSVGElement()` trick, because `Articulation.draw()` opens no
  group of its own. Multiple armed articulations are stacked with an explicit `textLine` each.
- Keypad highlight: `PaletteController.noteHas{Accent,Staccato,Tenuto}` — **while the stamp is
  armed, only the armed set lights**; the note-entry flags are ignored there (they can be stale
  from an earlier note-entry session, and would otherwise leak into the highlight).

The whole feature lives in `interactions/` + `engine/` (framework-agnostic); the Keypad drives
it through the existing `articulationSelection` press/highlight channels, so no Vue-side code
was needed.
