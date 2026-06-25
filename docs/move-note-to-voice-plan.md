# Move selected note(s) to another voice

**Goal.** With a note (or several notes) selected in *selection* mode, pressing a
voice — the palette button or the `Alt+1` / `Alt+2` shortcut — **moves** the
selected note(s) into that voice, instead of just arming entry. The source voice
closes the gap with rests; the target voice opens up to receive the note
(removing the rest there, or creating the voice/tuplet if it doesn't exist yet).

This is Sibelius behaviour ("swap voice" / `Alt+1/2` on a selection).

> Status: **PLAN ONLY — nothing built yet.** Behaviour below is fully agreed
> with the user. Build in the phase order given; verify each phase before the
> next. Do **not** start coding the tuplet phases until the plain-note phases are
> solid.

---

## 0. Agreed behaviour (the contract)

These were settled question-by-question with the user. They are the spec.

1. **Which note moves.** Move **just the selected pitch**. If it is one note of a
   chord (e.g. the top G of a C–E–G triad), only the G leaves; C–E stay behind as
   a two-note chord in the source voice.
2. **Collision in the target voice (plain notes).** If the target voice already
   has a note at that beat, **combine into a chord**. If the two slots have
   different durations, the **shorter** duration wins (the merged chord takes the
   smaller duration; the freed time fills with rests). User fixes by hand if they
   wanted otherwise.
3. **Multi-select.** If several notes are selected, **move all of them** in one
   atomic, single-undo action.
4. **Tuplets.** Tuplet notes **do** move. The move **creates a matching tuplet in
   the target voice** over the same span / horizontal position, and the moved note
   keeps its **relative slot** inside the group. See §4 for the full rule — it is
   the subtle part.

### The tuplet "ordinal fill" rule (the heart of §4)

Worked from the user's own examples. Source voice 1 has triplet **A·B·C** (three
eighth-triplets in beat 1). User selects **B** (slot 2 of 3) and presses voice 2.

- A triplet is created in **voice 2** over the **same beat-1 span** (same
  horizontal position on the page), same `numNotes`/`baseDuration` as the source.
- **B lands in its own slot** — it was 2nd of 3, so slot index 1 (0-based).
- Whatever voice 2 already had in that span is **poured into the remaining slots,
  in order, left-to-right**:
  - voice 2 **empty** → slots 0 and 2 stay triplet **rests** → `rest · B · rest`.
  - voice 2 had eighths **d, e** → d→slot 0, e→slot 2 → `d · B · e`. Both d and e
    are re-expressed as **triplet** eighths ("the tuplet wins for duration").
- **Overflow** (more incoming voice-2 notes than free slots): fill free slots in
  order, **drop the extras**. Predictable beats clever; user can re-add.
- A slot that the moved note already occupies → an incoming note **chords** with
  it rather than being dropped.

---

## 1. Where it hooks in (the seam already exists)

`PaletteController.setActiveVoice(voice)` (`PaletteController.ts:364`) is the
single entry point for **both** triggers:

- palette buttons — `App.vue:51` / `App.vue:63` → `palette.setActiveVoice(1|2)`
- shortcuts — `useShortcuts.ts:51-52` (`Alt+1` / `Alt+2`) → same.

It already carries the exact seam, with a comment marking this work:

```ts
// PaletteController.ts:370
if (this.state.selectedTool === 'selection' && !this.state.selectedNoteId) {
  this.state.selectedTool = 'entry'
}
```

**New branch (added first thing):**

```
setActiveVoice(voice):
  this.state.activeVoice = voice          // keep: ghost/preview still want it
  const target = activeVoiceToModel(voice)  // UI 1/2 → model 0/1  (EditorState.ts:139)
  if selection-mode AND there IS a selection:
     engine.moveSelectionToVoice(selectedPitchIds, target) → render → return
  ...existing entry-arming behaviour unchanged...
```

- Selection set: prefer `state.selectedItems` (the multi-select Map,
  `EditorState.ts:28`), via the existing `selectedNoteIds(items)` helper
  (`selection.ts:67`, extracts `kind === 'note'` ids); fall back to
  `selectedNoteId` when the Map is empty. Note that `kind: 'note'` covers **both
  notes and rests** (`selection.ts:18`) — rests are filtered out later by the
  per-note `findSlot` bail (a rest's id resolves to a `type:'rest'` slot, which
  the mover skips), so no extra rest filtering is needed here. Moving a rest's
  silence between voices is meaningless.
- If after filtering there's nothing to move, fall through to today's behaviour.
- "No-op move" (note already in `target`): skip it silently (don't churn rests /
  undo). Detect per-note before mutating.

> The mapping is model-voice 0/1 today (`activeVoiceToModel` returns `0|1`). The
> model itself allows 0–3; nothing here hard-codes "two voices only" beyond that
> helper, so 3rd/4th voice later is just a wider mapping.

---

## 2. The model operation — design choice

Two ways to reassign a note's voice:

- **(A) delete + re-add** via `deleteNote` + `addNote({voice})`. Reuses rest
  logic but **mints a new id**, breaking ties/slurs/selection/undo-text anchored
  to the old id. Rejected — too fragile, especially after the recent ties/slurs
  voice work.
- **(B) mutate the slot's `voice` in place, then run the existing cleanups.**
  Keeps the note id, so ties, slurs, articulations and the live selection all
  survive. **Chosen.**

Note `ScoreModel.updateNote` currently **ignores** `updates.voice` (chord branch,
`ScoreModel.ts:1816+` never reads it). So (B) is a small deliberate extension, not
something half-wired already.

The machinery the cleanups reuse (all already voice-scoped). Note `tupletOps`
lives at **`src/engine/models/tupletOps.ts`** (not `utils/`, despite what
CLAUDE.md's tree says):

| Need | Existing function |
|------|-------------------|
| remove same-voice overlapping rests + refill | `replaceRestsWithChord` (`ScoreModel.ts:1379`) |
| fill gaps **per voice** (incl. a brand-new voice) | `fillGapsWithRests` (`ScoreModel.ts:1486`) |
| drop a secondary voice left with only rests | `collapseEmptyVoices` (`ScoreModel.ts:1932`) |
| create a tuplet, clearing only its own voice's slots | `tupletOps.createTuplet` (`engine/models/tupletOps.ts:44`) |
| refill a tuplet's leftover slots with tuplet rests | `refillTupletRemainder` (`engine/models/tupletOps.ts:190`) |
| one atomic undo for the whole selection | `MusicEngine.runBatch` (`MusicEngine.ts:118`) |

---

## 3. Phase plan — PLAIN notes first

### Phase 1 — move a single plain note into an empty/rest spot

New: `ScoreModel.moveNoteToVoice(pitchId, targetVoice): boolean` (model) and
`MusicEngine.moveNoteToVoice(pitchId, targetVoice)` (facade; sets score on
playback + undo). Non-tuplet, single pitch.

Algorithm (model):

1. `findSlot(pitchId)` → `{ chord, pitch }`. If not a chord, bail (rests ignored).
2. `from = chord.voice ?? 0`. If `from === targetVoice` → return false (no-op).
3. **Guard:** if `chord.tupletId` is set → defer to the tuplet path (Phase 4); in
   Phases 1–3 just `return false` so plain-note work can't touch tuplets.
4. **Capture** the pitch payload: `{ step, alter, octave, forceAccidental,
   tiedTo, tiedFrom }`, plus `chord.duration`, `chord.dots`, `chord.beat`,
   `chord.measure`, and the **same `pitch.id`** (we reuse it — see §2).
5. **Remove the pitch from the source:**
   - if `chord.notes.length > 1` → drop just this pitch (`chord.notes =
     chord.notes.filter(...)`). Source chord stays; **no source rest needed** (the
     other pitches still hold that beat).
   - else (single-note chord) → remove the whole chord slot; the source voice now
     has a gap.
6. **Insert into the target voice** as a chord built with the **reused id**, at
   the same `beat/measure/duration/dots`, `voice = targetVoice`. Behaviour:
   - merges into an existing **same-beat, same-target-voice** chord, or
   - creates a new chord and calls `replaceRestsWithChord` (removes the
     target-voice rest there, fills target-voice gaps).
   - **`addNote` cannot be reused here.** It mints a fresh `uuidv4()` in **both**
     branches — the merge branch (`ScoreModel.ts:1314`) and the new-chord branch
     (`ScoreModel.ts:1343`). To preserve `pitch.id` we need a dedicated internal
     `insertPitch(measure, {…, id})` helper that **reproduces both paths**: find a
     same-beat/same-voice `Chord` → `notes.push` the pitch carrying the reused id
     and tie fields; else build a `Chord` and call `replaceRestsWithChord`. Do
     **not** overload the public `addNote`.
   - Preserving `pitch.id` + the tie fields is what keeps anchored ties/slurs,
     articulations and the live selection pointing at the moved note (§2, §5).
7. **Drop ties that would now cross voices** (must happen in Phase 1, not a
   follow-up — see §5). After step 4 captured `tiedTo`/`tiedFrom`: if a captured
   tie partner is **not** also moving into `targetVoice`, the tie would span two
   voices the instant we re-apply it — exactly the silent corruption §5 warns
   about. So before re-applying, check each endpoint: if the partner stays in the
   source voice, **clear both sides** of that tie (the moved note's field *and*
   the partner's reciprocal field). Only ties whose partner ends up in the same
   target voice survive. (Colour/direction follow-on for surviving ties stays
   deferred.)
8. **Repair the source voice** if step 5 removed a whole slot:
   `fillGapsWithRests(sourceMeasure)` (fills *all* voices' gaps, source included),
   **then** `collapseEmptyVoices(measure)` (if the source was a secondary voice now
   holding only rests, it disappears — Sibelius collapse).
   - **Order matters:** fill *then* collapse. `fillGapsWithRests` repairs the gap;
     `collapseEmptyVoices` keys off "voice has no chord" (`ScoreModel.ts:1943`) and
     then drops that secondary voice's rests. Voice 0 is never collapsed. Don't
     reverse this order.
9. Sort slots by beat; return true.

Facade (`MusicEngine.moveNoteToVoice`): after the model call, `commit("Move note
to voice N")` (`MusicEngine.ts:149` — does `playbackEngine.setScore` +
`saveUndoState`; self-suppresses inside a `runBatch`), mark dirty, render. The
render loop already repairs/regroups, so we lean on it.

**Verify P1:** voice-1 note over voice-2 rest → note jumps to voice 2 (green,
stem down), voice 1 leaves a correct rest, voice 2's remaining beats are rests.
Tie/slur on the moved note stays attached. Undo restores in one step.

### Phase 2 — collision: combine into a chord, shorter duration wins

This falls out of the merge path in the new `insertPitch` helper (step 6). What's
left is the **duration rule**:

- On merge, if the moved note's duration ≠ the target chord's duration, set the
  chord to the **shorter** of the two (`min` by `durationToFraction`), recompute
  `actualDuration`, and let `fillGapsWithRests` reclaim any freed time in the
  target voice.
- **No flag needed.** `addNote`'s merge branch adopts the *incoming* duration
  unconditionally (`ScoreModel.ts:1325-1332`), but we are **not** reusing
  `addNote` — `insertPitch` is a dedicated helper (Phase 1 step 6), so implement
  "shorter wins" directly inside it. `addNote` and normal chord-building entry
  stay untouched.

**Verify P2:** voice-2 has a quarter on beat 1; move a voice-1 **half** note onto
it → chord with **quarter** duration, beat 3–4 of voice 2 becomes a rest. Move a
voice-1 **eighth** onto a voice-2 quarter → chord becomes an **eighth**, rest
fills the gap.

### Phase 3 — multi-select, atomic undo

Wrap the whole thing in `runBatch`:

```
engine.moveSelectionToVoice(ids[], target):
  runBatch("Move N notes to voice X", () => {
    for id of ids: model.moveNoteToVoice(id, target)   // skips no-ops itself
  })
```

- Process in a **stable order** (e.g. by measure then beat) so chord merges within
  the selection are deterministic. When two *selected* notes of different
  durations land on the **same** target beat, the result is order-dependent: each
  successive merge applies "shorter wins" against the chord built so far, so the
  final chord duration is the running-min of all notes that land there. State this
  in the test so the assertion is intentional (it satisfies the "predictable
  beats clever" principle from §0).
- Watch the **id-reuse** invariant: because Phase 1 reuses the pitch id, a later
  iteration can still find an earlier-moved note by id. (If we'd gone with
  delete+re-add this would be a minefield — another reason for choice B.)
- Re-sync the selection highlight after: the ids are unchanged, so
  `selectedItems` stays valid; just re-render. Optionally flip
  `state.activeVoice` to the target so the palette reflects where the notes now
  live.

**Verify P3:** select 4 notes across a bar, press voice 2 → all four move, one
Ctrl-Z brings them all back.

---

## 4. Phase plan — TUPLET notes (the ordinal-fill rule)

Only start once Phases 1–3 are solid. Two sub-phases mirror the two user examples.

### Phase 4a — move a tuplet note into an empty target span (`rest · B · rest`)

When `chord.tupletId` is set (the guard from step 3 routes here):

1. Read the source tuplet: `{ startBeat, baseDuration, numNotes, notesOccupied }`
   and its `measure`.
2. **Relative slot index** of the moved note. ⚠️ **Beats are stored in *actual*
   time, and tuplet slots are spaced by the *actual* slot duration, not the
   written `baseDuration`.** The slot spacing is
   `getTupletNoteDurationFrac(baseDuration, numNotes, notesOccupied)`
   (`utils/musicUtils.ts:255` = `durationToFraction(baseDuration) ×
   notesOccupied/numNotes`). So:

   ```
   slot = getTupletNoteDurationFrac(baseDuration, numNotes, notesOccupied)
   idx  = (note.beat − tuplet.startBeat) / slot          // exact Fraction math
   ```

   Tuplet slots sit at `startBeat + k·slot` for `k` in `0…numNotes-1`. Dividing
   by the *written* `baseDuration` (as an earlier draft did) is wrong by the
   `notesOccupied/numNotes` factor — e.g. for an eighth-triplet (written 1/8,
   actual slot 1/12) slot 1 would mis-compute as 2/3 instead of 1.
3. Remove the moved pitch from the source tuplet slot (same split-vs-whole logic
   as Phase 1 step 5). If a whole slot was removed,
   `refillTupletRemainder(measure, sourceTuplet, fromVoice)` closes the source
   triplet's gap with a triplet rest; if the source tuplet ends up all-rests, let
   `collapseEmptyVoices` (or a tuplet-aware variant) drop it.
4. **Create the matching tuplet in the target voice:**
   `createTuplet(measure, startBeat, baseDuration, numNotes, notesOccupied,
   targetVoice)`. `createTuplet` clears overlapping slots **only in the target
   voice** (`tupletOps.ts:71-78`) — this *is* the "tuplet wins for duration"
   mechanism, and it leaves other voices untouched.
5. **Place the moved note** at slot `idx`:
   `beat = startBeat + idx·slot` (same `slot` = actual spacing from step 2 — **not**
   `idx·baseDuration`), `voice = targetVoice`, reused id, `tupletId =` new tuplet's
   id, `duration = baseDuration`, and **`actualDuration = slot`** (member slots
   carry the written `baseDuration` *and* the scaled `actualDuration` — see how
   `refillTupletRemainder` sets `actualDur` for its rests, `tupletOps.ts:213`;
   omitting it breaks render/width math).
6. **Fill the other slots with triplet rests:** `refillTupletRemainder(measure,
   targetTuplet, targetVoice)` — it walks the tuplet slot grid and fills every
   non-occupied position with a correctly-sized tuplet rest.

**Verify 4a:** voice-1 triplet A·B·C, voice 2 empty in that beat → select B,
voice 2 → voice 2 shows triplet `rest · B · rest` at the same x; voice 1 shows
`A · rest · C`. Stems/colours per voice. Undo restores.

### Phase 4b — pour existing target-voice notes into the open slots (`d · B · e`)

Extends 4a for when the target voice **already has notes** in that span.

**Before** calling `createTuplet` (which would wipe them), **capture** the target
voice's existing slots within `[startBeat, startBeat + tupletSpan)` as an ordered
list of pitch payloads (`existing[]`, sorted by beat). Then:

1. Create the target tuplet (clears the span in the target voice — step 4 above).
2. Build the **slot assignment**: an array of `numNotes` (well, `notesOccupied`
   grid positions — use the tuplet's slot count) entries.
   - Put the **moved note** at its `idx`.
   - Walk the **free** slot indices in order; pour `existing[]` into them in order
     (`d → first free, e → next free, …`).
   - **Overflow:** when `existing[]` outruns the free slots, **drop the rest**.
   - **Collision with the moved note's slot:** if an incoming note maps onto
     `idx`, **chord** it with the moved note instead of dropping.
3. Materialise: for each grid position with a pitch → insert that chord (reused
   ids where we have them — the moved note keeps its id; the poured-in existing
   notes keep theirs too, so *their* ties/slurs survive); empty positions →
   triplet rest via `refillTupletRemainder` (or explicit rest insert).
4. All inserted notes take `duration = baseDuration` (triplet eighths) — the
   tuplet's grid, by construction.

**Verify 4b:** voice-1 triplet A·B·C, voice-2 eighths d,e on beat 1 → select B,
voice 2 → voice 2 = triplet `d · B · e`, all triplet-eighths; voice 1 =
`A · rest · C`. Then an overflow case (voice 2 had 4 sixteenths) → only the first
two free slots fill, the rest are dropped, no crash, bar still sums correctly.

> ⚠️ **VexFlow guardrail.** A half-formed tuplet (negative/zero bracket width, a
> filler rest from another voice straddling the span) has crashed VexFlow before
> (see memory: the v0-filler-rest-in-v1-tuplet straddle). After every tuplet move,
> the bar must be **complete per voice** (each voice's slots sum to bar length)
> before render. Add a dev-only `validateMeasure` assert (slots-per-voice sum ==
> capacity, no overlapping spans, tuplet slot count correct) and run it at the end
> of each move in tests.

---

## 5. Edge cases & invariants to hold

- **Id preservation is the spine.** Moved note keeps its `pitch.id`; ties
  (`tiedTo`/`tiedFrom`), slurs (`Score.slurs[].voice` + anchor ids),
  articulations, and the selection Map all key off it. Never re-mint on a move.
  - **Cross-voice ties are dropped at move time (Phase 1, step 7), NOT deferred.**
    Because the move re-applies the captured `tiedTo`/`tiedFrom`, a tie whose
    partner stays behind would span two voices immediately — silent corruption.
    The mover clears both sides of any such tie. Only ties whose both endpoints
    land in the same target voice survive.
  - **Deferred (follow-up only):** for a tie/slur that survives intact (both ends
    moved together), update its own `voice` field so default direction/colour
    follow the new voice (the recent voice-aware span work). This is cosmetic and
    safe to leave for the follow-up phase — it does not corrupt anything.
- **Source-voice collapse.** Moving the *last* note out of a secondary voice must
  collapse it (`collapseEmptyVoices`) so the bar reverts to one stream of rests,
  not a ghost empty voice. Already handled by the existing call — just ensure we
  call it.
- **Voice 0 is never collapsed** (primary stream); a bar emptied to voice 0 keeps
  one voice of rests. Existing `collapseEmptyVoices` already encodes this.
- **No-op moves** (note already in target voice) skip mutation and undo.
- **Rests in the selection** are ignored by the mover.
- **Cross-measure / cross-system** selections: each note moves within its own
  measure; nothing crosses barlines. The mover is per-note, so this is automatic.
- **Tuplet `notesOccupied` vs `numNotes`** — use the **slot count** (`numNotes`,
  e.g. 3 for a triplet) for the grid, and reuse the source tuplet's
  `baseDuration`/`notesOccupied` so the new tuplet renders identically.

---

## 6. Testing strategy (unit-first; user does manual UI)

Co-located model tests (`ScoreModel.test.ts`) — the engine is framework-agnostic,
so the whole feature is unit-testable without the UI:

- P1: move over rest; tie/slur survival (assert anchor ids unchanged); source
  rest correctness; single-note-chord vs pitch-out-of-chord.
- P2: shorter-wins for each duration pairing; freed-time rest fill.
- P3: multi-note batch = one undo snapshot (`runBatch` returns true once); stable
  order; moving an already-moved id in the same batch.
- P4a/4b: relative-slot placement; empty → `rest·B·rest`; pour → `d·B·e`;
  overflow drop; `validateMeasure` passes after every case.
- A regression test that the **plain-note guard** (step 3) refuses to touch
  tuplet notes until Phase 4 exists (so Phases 1–3 can't half-break a tuplet).

Then hand to the user for manual UI verification (per project convention — the
user drives the app, we don't launch browsers).

---

## 7. Build order checklist

1. [x] Phase 1 — `moveNoteToVoice` (model + facade), `insertPitch` id-preserving
       helper, plain note over rest. Tests. **DONE (uncommitted), pending user
       verify.** Added `ScoreModel.moveNoteToVoice` + private `insertPitch` +
       private `dropCrossVoiceTies` (after `collapseEmptyVoices`); facade
       `MusicEngine.moveNoteToVoice` = model call + `commit` only (NO render in
       facade — follows the deleteNote/updateNote convention; caller renders, to
       be wired in P3). 8 model tests + 2 facade tests; 742 tests + build:check +
       boundary lint green. NOT YET WIRED to any trigger (Phase 3 does that).
2. [x] Phase 2 — shorter-wins merge rule. Tests. **DONE (uncommitted), pending
       user verify.** Implemented directly in `insertPitch`'s merge branch:
       guarded by `!existingChord.tupletId`, compares `durationToFraction` of
       incoming vs existing, takes the shorter, recomputes `actualDuration`, then
       `fillGapsWithRests` reclaims freed time. 3 model tests (existing-shorter
       kept, incoming-shorter adopted + rest-fill, equal-dur). Still engine-only,
       not wired to a trigger.
3. [x] Phase 3 — `moveSelectionToVoice` + `runBatch`; wire `setActiveVoice`
       branch + both triggers. Tests. **DONE (uncommitted) — NOW USER-TESTABLE.**
       `MusicEngine.moveSelectionToVoice(ids, target)` sorts by `compareByPosition`
       (measure,beat) then `runBatch`-loops `this.moveNoteToVoice` (facade, so
       playback syncs; runBatch batches undo). `setActiveVoice`: in selection mode
       with a selection (`selectedNoteIds(selectedItems.values())`, fallback
       `selectedNoteId`) → `moveSelectionToVoice(activeVoiceToModel(voice))` +
       renderScore + return; else existing entry-arming. Both triggers
       (palette buttons App.vue:51/63, Alt+1/2 shortcuts) already route through
       `setActiveVoice` with NO mode gating. Tests: 3 facade (atomic undo, all-
       no-op, rest-skip) + 4 PaletteController (move vs arm, fallback, empty-sel
       arms entry, entry-mode no-move). 752 green + build + boundary clean.
4. [ ] Phase 4a — tuplet move into empty span. `validateMeasure` dev assert.
       Tests. **User verify.**
5. [ ] Phase 4b — ordinal pour-in + overflow drop. Tests. **User verify.**
6. [ ] Follow-up (separate) — **cosmetic** span (tie/slur) `voice`-field
       reassignment for surviving spans (direction/colour only; the cross-voice
       *drop* is already done in Phase 1); 3rd/4th voice mapping.

Nothing is committed without explicit user say-so (project rule).
