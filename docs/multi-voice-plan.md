# Multi-Voice (Second Voice) — Implementation Plan

Status: **PLANNED (not started). Settled 2026-06-22.**

Add a **second voice** to the editor: independent rhythmic streams within a bar, Sibelius-style.
Scope this first pass to **2 voices** (the data model already supports 4 — see below — but UI, colors,
stem-defaults and the renderer caveat all favour proving it with two first; 3–4 is a later extension).

The headline finding from the code dig: **the model layer is already voice-ready.** Types, note entry,
collision, rest-fill, rebar, dynamics and playback all key on `voice ?? 0` today. What was deliberately
**deferred** is the **multi-voice render loop** — there is a scaffolding comment marking the exact spot
(`VexFlowRenderer.renderMeasure`). This document is the authoritative plan and cross-session checklist.

---

## 1. Goal & behaviour (Sibelius parity)

- A **voice selector** (palette panel buttons "1 / 2") plus **Alt+1 / Alt+2** shortcuts choose the
  **active voice**. Voice 1 is always the default; the active voice **resets to 1** on selection-clear /
  fresh entry.
- Notes entered go into the active voice. Two voices in one bar render as two aligned, independent
  streams that don't collide.
- **A bar with only one voice looks normal** (single stream, centred rests). Per-voice rests appear
  **only when a bar actually has more than one voice** — exactly what `fillGapsWithRests` already does.
- **Stems**: when a bar has >1 voice, **voice 1 stems up, voice 2 stems down** by default (engraving
  rule). The user can still flip a selected note's stem (existing `stemDirection` override / `x`), and
  the override always wins.
- **Tuplet brackets** (added 2026-06-25): when a bar has >1 voice, a tuplet's bracket follows the
  voice's stem side — **voice 1 → above, lower voices → below** — so the voices' brackets spread to the
  outer edges instead of colliding in the middle (single-voice keeps the stem-derived default). A
  bracket flipped to the *inner* side is nudged next to its own notes (out of VexFlow's staff-edge
  clamp). Full design in `docs/tuplet-control-plan.md`.
- **Colours** (Sibelius): **voice 1 = blue, voice 2 = green**. The **selection highlight colour *is* the
  voice colour** (a selected V1 note shows blue, a selected V2 note shows green — not the old uniform
  orange). The **ghost note** and the **keyboard cursor** paint in the **active voice's** colour.
- **Navigation** (entry-mode step/arrow): stay **within the active voice**, *unless* the measure we land
  on has no slot for that voice — then fall back to **voice 1** (which always exists in every bar).

---

## 2. What the dig found — the model is already voice-ready

Confirmed by reading the code (do **not** redo this work):

| Concern | Where | Status |
|---|---|---|
| `voice?: 0\|1\|2\|3` field | `types/music.ts` — `Note`, `Chord`, `Rest`, `Dynamic`, `Slur`, `NoteParams` | ✅ exists |
| Chord merge is per-voice | `ScoreModel.addNote` (`ScoreModel.ts:1279-1282`) — finds/merges chord at same beat **AND** voice | ✅ |
| Rest-fill is per-voice | `ScoreModel.fillGapsWithRests` (`ScoreModel.ts:1455`) — loops per voice; only fills voices that have a slot (plus voice 0) | ✅ |
| Collision / overflow per-voice | `CollisionDetector` skips other voices (`:55-56`, `:169`) | ✅ |
| Rebar per-voice | `rebar.ts:149` `flattenRegion(measures, voice)` | ✅ |
| Dynamics per-voice | `utils/dynamics.ts`, `DynamicsLayout.ts`, `PlaybackEngine` step-function | ✅ |
| Playback | `PlaybackEngine` iterates **all** slots and schedules by beat — overlapping voices already play | ✅ no change |

### Voice-blind spots that MUST be fixed (Phase 1)

The note-entry coordinator deletes/finds overlapping notes **without filtering by voice** — entering
voice 2 would clobber voice 1:

- `NoteEntryCoordinator.addNoteAtBeat` — the overlap-deletion loop at `NoteEntryCoordinator.ts:110-127`
  (`getNotesInMeasure(...).filter(...)`) is voice-blind.
- `NoteEntryCoordinator.addNoteAtPosition` — its "rest at beat / notes at beat / nearest rest" logic
  (`:213-238`) is voice-blind.

Both must be scoped to the active voice. `CollisionDetector` itself is fine.

---

## 3. VexFlow 5.0.0 — verified API (read from `node_modules/vexflow`)

The render approach is idiomatic VexFlow and matches our current single-voice calls almost exactly:

- **One `Voice` per voice group**: `new Voice({ numBeats, beatValue }).setMode(Voice.Mode.SOFT|FULL)`
  (we already build it this way; `VoiceMode` = STRICT 1 / SOFT 2 / FULL 3).
- **Format together**:
  `new Formatter().joinVoices([v1, v2]).format([v1, v2], width, { alignRests: true })`, then
  `voices.forEach(v => v.draw(ctx, stave))`. The formatter "can align multiple voices within a stave."
- **Width math takes an array**: `Formatter.preCalculateMinTotalWidth([v1, v2])` (after `joinVoices`) —
  `MeasureLayout` already calls these for one voice.
- **Stems are ours to set**: `Stem.UP` (1) / `Stem.DOWN` (-1) via `staveNote.setStemDirection(dir)` — the
  exact call `NoteBuilder`/`buildBeams` already make. "V1 up / V2 down" = choosing the default per group
  instead of deriving from pitch.
- **Rest vertical offset has first-class API**: `FormatParams.alignRests` (camelCase in v5 — our current
  single-voice `format()` does **not** pass it), the `formatter.alignRests(voices, alignAllNotes)` method,
  and `StaveNote.setKeyLine(index, line)` / `getLineForRest()` to nudge V1 rests up / V2 rests down.
- **Caveat (scope justification)**: VexFlow's own docs warn the modifier-context formatting "does not
  support more than two voices per stave and should be used with care." → start with 2.

---

## 4. Phased plan

### Phase 0 — State, panel, switching (foundation; no notation change) — ✅ DONE 2026-06-22
- `EditorState`: add `activeVoice: 1 | 2` (default `1`); reset to `1` on selection-clear / entry reset
  (`createEditorState`, plus the deselect paths). ✅ — field added; `createEditorState` defaults `1`;
  reset in `SelectionController.deselectAll` (Esc clear) **and** `PaletteController.resetToDefaults`
  (fresh `n` entry).
- `PaletteController.setActiveVoice(v)`. ✅ — sets state, logs `[Voice]`, refreshes the ghost preview
  (no-op if voice unchanged); colours/notation deferred to later phases.
- `App.vue`: colored "Voices 1 / 2" panel in the palette (blue / green chips). ✅ — "Voice:" panel after
  the Entry/Select tool divider; active V1 = `bg-blue-500`, active V2 = `bg-emerald-500`.
- `ShortcutConfig` + `useShortcuts`: **Alt+1 / Alt+2** → `setActiveVoice`. ✅ — `Alt+1`→`setActiveVoice1`,
  `Alt+2`→`setActiveVoice2`.

Verified: `build:check` + 699 tests + `lint:boundary` all green. Not committed.

### Phase 1 — Entry into voice 2 (model already supports it) — ✅ DONE 2026-06-22
- Thread `voice` through entry. ✅ — **voice numbering:** UI `activeVoice` is 1-based (1|2) but the model
  is 0-based (`voice ?? 0`, every existing note = voice 0). Added `activeVoiceToModel(1|2) → 0|1` in
  `EditorState.ts`; UI "Voice 1" = model 0, "Voice 2" = model 1. Threaded via `KeyboardController`
  (`enterNoteAtCursorPosition` + `enterRestAtCursorPosition`; joining an existing tuplet stays voice 0)
  and `MouseController` (plain entry only — tuplet-add path stays voice 0). Added a `voice` param to
  `MusicEngine.addNoteAtPosition` → `NoteEntryCoordinator.addNoteAtPosition`; `addNoteAtBeat` already takes
  `NoteParams.voice`.
- **Fixed the voice-blind spots** (more than the two originally named — all scoped to the entry voice):
  `addNoteAtBeat` overlap-delete loop; `addNoteAtPosition` coord-calc rest/chord/nearest-rest find +
  `existingChordNotes` duration-sync; `applyEntryOverwrites`/`findNotesToOverwrite`; `placeSplitNote`
  chord-split filter; overflow tie-split now carries voice (`placeSpanningNote` pitch + `erodeOverflowZone`
  + eroded tail-chain). In `MusicEngine.deleteNote`: `getChordNotesAt` scoped to voice (so a same-beat note
  in the OTHER voice isn't mistaken for a chord sibling), and the replacement rest keeps the note's voice.
  (`ScoreModel.addNote`/`replaceRestsWithChord`/`fillGapsWithRests` were already per-voice — confirmed.)
- **Collapse rule** ✅ — new `ScoreModel.collapseEmptyVoices(measure)` drops any secondary voice (model
  voice ≠ 0) that has no chords left (only rests), reverting the bar to one stream; voice 0 never collapses.
  Called from `MusicEngine.deleteNote` after the delete-handling chain.

Verified: `build:check` + `lint:boundary` green; **702 tests** (699 + 3 new multi-voice cases in
`MusicEngine.test.ts`: voice-2 entry doesn't clobber voice 1; delete-last-voice-2 collapses;
delete-one-of-many keeps the voice). Not committed. **Nav caveat:** keyboard cursor still uses a
voice-blind `buildBeatMap` (mouse is the reliable voice-2 entry path) — nav refinement is Phase 5.
**Still invisible** until Phase 2 renders the second stream.

### Phase 2 — Multi-voice render loop (headline — `VexFlowRenderer.renderMeasure`) — ✅ DONE 2026-06-22
- Group sorted slots by `voice ?? 0`; one `Voice` per group; `joinVoices(all)`, `format(all, width)`, draw
  each. ✅ — combined parallel arrays (group order) feed the once-per-measure passes that already key on
  voice/tupletId internally (`attachDynamicsToSlots`, `buildVexTuplets`, `registerSlotElements`,
  `registerDynamics`, `layoutCoLocatedDynamics`); beams + the `Voice` + mid-measure clef interleaving run
  per group. **Mid-measure clef glyphs ride the primary voice only** (they're tickless, so voices still
  share a tick total and `joinVoices` won't mismatch). Used **manual rest offset, not `alignRests`** (more
  deterministic — see below).
- **Stem defaults** ✅ — `multiVoice` → forced V1 (voice 0) = up / V2 (voice 1) = down, threaded into
  `createStaveNotesFromSlots(…, forcedStemDirection)` (unbeamed) and `buildBeams` →
  `calculateBeamGroupStemDirection(…, forcedStemDirection)` (beamed). Explicit `stemDirection` override
  still wins; single-voice bars pass `undefined` → unchanged pitch-based default.
- **Per-voice rest offset** ✅ — `createStaveNotesFromSlots(…, restLineShift)`: V1 rests `+2` lines (up),
  V2 rests `-2` (down) only when `multiVoice`, via `setKeyLine(0, getLineForRest()+shift)` (VexFlow line
  numbering: higher = up). Single-voice → shift 0 → centred `b/4` as before.

### Phase 3 — Width math (`MeasureLayout.calculateMinimumMeasureWidth`) — ✅ DONE 2026-06-22 (folded in with P2)
- Same grouping: one temp `Voice` per model voice, `joinVoices(voices)` then
  `preCalculateMinTotalWidth(voices)`, so a two-voice bar reserves room for both interleaved streams
  (without it, different-beat voices render cramped). Stem/rest offsets omitted (don't affect width).

### Phase 4 — Voice colours (selection + ghost + cursor) — ✅ DONE 2026-06-22
- New shared `utils/voiceColors.ts` (`voiceFillColor`/`voiceStrokeColor`, indexed by 0-based model voice:
  V1 blue `#3B82F6`/`#2563EB`, V2 green `#10B981`/`#059669`; framework-agnostic, importable by both layers).
- `HighlightController.applySelectionHighlight`: colours each selected note by **its** voice (looked up via
  `engine.getNote().voice` — no registry change needed) instead of the fixed orange. Other element kinds
  (clef/TS/tuplet/slur/tie/accidental/articulation) still highlight orange.
- Ghost colour threaded through to the **active voice's** colour: `RenderController.renderPreview` →
  `MusicEngine.renderScoreWithPreview(…, ghostColor)` → `GhostNote.fillColor/strokeColor` (new optional
  fields) → `renderGhostNoteWithDynamicWidths` `applyGhostStyle` (replaces the hardcoded `#3B82F6`/`#2563EB`;
  defaults to blue when omitted).
- Keyboard-cursor colour (`HighlightController.applyKeyboardCursor`) → active voice's colour.

Verified: `build:check` + 702 tests + `lint:boundary` green. Not committed.

### Phase 5 — Polish / deferred
- **Per-voice keyboard navigation — ✅ DONE 2026-06-22.** `buildBeatMap(score, voice?)` now takes an optional
  0-based model voice and filters the flat stream to it; new `navBeatMap(score, currentNoteId, voice)` returns
  the active voice's map when the cursor note is in it, else falls back to all voices (covers the moment just
  after switching voices, before the new voice has a slot). Wired into `KeyboardController` (note + rest entry),
  `HighlightController.applyKeyboardCursor` (cursor matches the active voice's stream), and
  `SelectionController.navigateSelection` (arrow keys stay within the SELECTED note's own voice).
  **Bug fixed:** `getMeasureNotes` (musicUtils) didn't project the `voice` field, so a voice-scoped beat map
  came back empty — now projects `voice` on both rests and chord notes. 704 tests (2 new) + build + boundary green.
- Voice-coloured selection for dynamics/slurs that belong to a voice (kept orange in this pass).
- 3rd / 4th voice (orange / purple), and the `> 2 voices` formatter caveat.
- "Paste into voice"; explode/implode.

**No change needed**: `PlaybackEngine`, dynamics resolution, rebar.

---

## 5. Colours

Sibelius/MuseScore convention — V1 blue, V2 green, V3 orange, V4 purple. We use the first two now.
V1 blue is already the app's ghost/cursor blue (`#3B82F6`), so the active-voice-1 experience is
unchanged in feel. Pick a matching green for V2 (e.g. `#10B981`, already used for the paste caret). The
**selection** highlight becomes the voice colour (replacing the uniform orange `#F59E0B` for notes/rests
only; clefs, time-sigs, tuplets stay orange this pass).

---

## 6. Sub-decisions settled
- **Navigation scope**: stay within the active voice; if the landing measure lacks that voice, fall back
  to voice 1 (always present). (§1)
- **Selection colour = voice colour** for notes/rests, **ties and slurs** (Sibelius). A selected
  tie/slur paints in its voice's colour (V1 blue / V2 green); the colour is derived from the start
  note's voice (the span's own `voice` field is unreliable for slurs — created as 0). Other element
  kinds (dynamics, clef, time-sig, tuplet, articulation) — articulation is already voice-coloured;
  the rest stay orange for now.
- **Switching**: palette panel **and** Alt+1 / Alt+2.

### Session 2026-06-25 — ties & slurs made fully voice-aware (7 commits, on main, NOT pushed)
Span elements (ties, slurs) brought up to the same multi-voice standard the notes already had:
- **Tie/slur selection colour = voice colour** (`3a7f832` tie, `27ba657` slur). Curve.renderCurve
  strokes **and** fills, so the highlight must override **both** fill and stroke or the arc reads
  black with a hint of colour.
- **Tie highlight no longer bleeds onto staff lines** (`d7a9d88`). Root cause: ties (unlike slurs)
  weren't wrapped in an SVG group, so the highlight did a document-wide `<path>` bbox-scan that
  caught staff-line segments. Fix mirrors the slur group approach: wrap each tie's arc (both
  cross-line partials) in its own `<g class="vf-tie">` (`tieGroupMap` → `getTieSVGGroup`) and
  recolor only inside it.
- **Multi-voice tie direction** (`85e30da`) and **slur direction** (`9b1b46d`): default now follows
  the **voice's outer side** (V1 above, V2 below) instead of the single-voice pitch/stem rule, so
  the two voices' arcs don't collide (Gould). KEY tie bug fixed along the way: in a multi-voice bar
  both voices share a beat, so resolving the tie's voice by `fracEq(beat)` returned the *wrong*
  voice's slot — resolve it by the slot that **contains the pitch id** instead. The `x` flip
  override still wins everywhere.
- **Slur creation (`s`) is voice-aware** (`a354a4c`): was filtered to voice 0 only, so `s` did
  nothing in voice 2; now derives the slur's voice from the selection and scopes `nextDistinctSlot`
  (the single-note end-anchor) to that voice.
- **Letter-entry octave guess scoped to the selected note's voice** (`6c66d89`): `getContextPitch`
  scanned all voices flattened by beat, so editing a v2 rest grabbed a v1/v0 note stacked at the
  same beat as the octave reference and landed an octave off (typing A on a v2 rest beside a v0 F4
  gave A4 not A3). Filter the scan to the selected note's own voice.

---

## 7. References
- VexFlow 5.0.0 source: `node_modules/vexflow/build/types/src/{voice,formatter,stem,stavenote}.d.ts`.
- VexFlow [Tutorial](https://github.com/0xfe/vexflow/wiki/Tutorial),
  [How Formatting Works](https://github.com/0xfe/vexflow/wiki/How-Formatting-Works),
  [grand-staff voices #332](https://github.com/0xfe/vexflow/issues/332).
- Sibelius / MuseScore voice conventions: V1 blue / V2 green, V1&3 up / V2&4 down, per-voice rests only
  with multiple voices, Alt+number / Ctrl+Alt+number to assign.
</content>
</invoke>
