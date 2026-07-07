# Multi-Staff (Staff Axis) — Implementation Plan

Status: **PLANNED (not started). Settled 2026-07-03.**

Add a **staff axis** to the editor: more than one staff stacked vertically, sharing
barlines — the grand-staff case (a piano's two staves, an organ gaining a pedal
staff). Today the editor is single-staff all the way down; this pass builds the
infrastructure for N staves and keeps single-staff as the **N = 1 default**, not a
special case.

This is the sanctioned moment for this work: `docs/DESIGN-PRINCIPLES.md` §4
("Instruments and staves are composable (1..N)") and its "Known boundary cases"
note *explicitly* call for designing the composable staff layer **before** more code
hardcodes `getMeasure(n)`.

---

## 0. Scope & non-goals

**In scope (this pass):**

- A **staff axis** in the data model — N staves, single-staff = N = 1.
- **Grow the existing group**: "add staff above / below" adds a staff *into the one
  existing group* (organ/piano growth). New staves default to **treble clef**; the
  user changes the clef manually afterward (clefs are already per-measure editable).
- Render N staves **stacked vertically, sharing barlines**.
- Staff-aware coordinate mapping / hit-testing.
- An **active staff** for note entry (mirrors the existing active *voice*).
- Playback of N parallel staves on a shared per-measure clock.
- A **"Staff:" toolbar group** mirroring the existing "Measure:" group
  (+ Above / + Below), enabled off a box-selected measure.

**Explicitly deferred (modeled so it stays possible, not built):**

- **Braces / brackets** — no `StaveConnector` rendering yet. The *grouping* is in the
  model (see §1); drawing it is later.
- **Adding a new group** ("put a violin on top of the organ") — the model holds a
  *list* of groups (length 1 for now); the operation is additive later.
- **Cross-staff notation** (a beam/voice crossing between a piano's two staves).
- **Multi-staff copy/paste** — copy/paste stays **active-staff-scoped** this whole pass;
  the clipboard payload gains a staff axis later (§4 rebar/paste note, §11).
- **Per-staff independent meters / key / transposition.**
- **Instrument identity, name, and timbre** — timbre is a *playback* concern, never
  content (see §1); no heavy `Instrument` entity is built.
- **Staff reordering**, staff-spacing engraving override.

Each deferred item has a landing spot called out in §10 so it is additive, never a
teardown.

---

## 1. The design-principle boundary (the named constraint)

This feature lives right on the content/presentation line, so state it up front and
hold it (`DESIGN-PRINCIPLES.md` §1, §3, §4):

- **In the model (content — serializes into JSON):** the staff axis (how many staves,
  their order top→bottom, per-staff clef), and an **optional grouping overlay** (which
  staves form one unit). The grouping is genuine content — it is what will later gate
  *cross-staff* legality (allowed within a group, never between groups) and drive the
  brace. A 2-staff piano round-trips through JSON with **zero pixels** in it.
- **Not in the model (presentation — derived at render, thrown away/recomputed):**
  every staff y-position, inter-staff gap, inter-system gap, line/page break, and the
  (future) brace geometry.
- **The only home for authored geometry:** if a composer ever hand-nudges staff
  spacing or a brace, that goes into the existing **engraving-overrides compartment**
  (staff-spaces, anchor-relative) — never raw pixels in the content model. Same pattern
  as slur `curveShape`.

Litmus test already in the codebase: **clef** *looks* visual but is musical meaning, so
it lives in the model. By the same logic the **grouping fact** is content; the **brace
pixels** are presentation.

The payoff (why this matters beyond piano): because content stays separate from layout,
the model is a **musical value renderable many ways**, not a frozen final-page document.
A single-staff sketch and a multi-staff score are the *same type* — they differ only in
how many staves they hold.

---

## 2. Terminology

The codebase already overloads "system"/"line" to mean **one horizontal row of measures
with a single staff** (e.g. "cross-system slur" = a slur that wraps to the next line).
Multi-staff introduces a genuinely new vertical dimension, so fix vocabulary now:

| Term | Meaning |
|---|---|
| **staff** (pl. **staves**) | One lane of five lines. The concrete thing "+ Above/Below" adds. |
| **staff axis** | The new *vertical* dimension staves stack along — distinct from the horizontal **time axis** (measures) and the within-staff **voice** sub-dimension. |
| **system** | One horizontal row **now containing N stacked staves**, all sharing barlines. (Was: one row, one staff.) |
| **group** | An ordered set of staves forming one unit (a piano = 1 group of 2 staves). Optional overlay; a sketch has none. Gates future cross-staff + brace. |
| **active staff** | The staff note entry currently targets (mirrors active *voice*). |

Note the axis distinction from **voice**: two staves share barlines/meter but have
independent clefs and vertical position; two voices share *everything* and only differ
in stem stream. Voices are not staves.

---

## 3. What the code dig found (single-staff coupling map)

Confirmed by reading the code — do **not** redo this. (Verified & corrected
2026-07-03; the corrections below are folded in — trust this version, not any earlier
draft.)

**The model has no staff dimension at all.** `Score.measures` is a flat `Measure[]`
(`types/music.ts:604`); a `Measure` holds `slots: ChordRest[]` (`:534`); vertical
multiplicity exists only as `voice: 0|1|2|3` on each slot. Nothing keys on staff/part.

**Model (`ScoreModel.ts`, ~3005 lines; helpers `clefOps.ts`, `tupletOps.ts`,
`noteProjection.ts`, `utils/rebar.ts`):**

- Addressing funnels through `getMeasure` — a linear `.find(m => m.number === n)`
  (`ScoreModel.ts:234-236`; the same `.find`/`findIndex(m => m.number === n)` is
  duplicated in **five** more spots: `tupletOps.ts:33`, `clefOps.ts:17`, and inline in
  `removeMeasure` `:242`, `insertMeasureAfter` `:181`, `rebarRegion` `:937`,
  `pasteEvents` `:1062`). `getMeasure` is the single choke point that yields the measure
  handle, so a `staffContent(measure, staffId)` helper slots in right after each of these.
- Renumber-on-insert/remove loops rewrite `measure.number` **and** every
  `slot.measure` back-pointer (`insertMeasureAfter` `:181-191`, `removeMeasure`
  `:247-253`).
- **30** `this.score.measures` scans (32 counting the two load-path `.measures`
  iterations) across ~20 methods — dynamics (`:374/:389/:408`), TS propagation (`:898`),
  tie/slur repair (`:1371/:1441/:1447/:1567/:1739/:1935`), `deleteNote` (`:2380/:2405`),
  `getAllNotes` (`:2842`), `fromJSON` recompute (`:2967`), `validateMeters` (`:2987`), …
  Confirmed count is **~157 `.slots/.clefs/.dynamics/.tuplets` member-access sites** to
  route through the staff helper (ScoreModel ~110, tupletOps 20, clefOps 24, rebar 3).
  **Scope caveat:** `voice` is threaded **243×** in ScoreModel and **79×** in
  `NoteEntryCoordinator`; staff is *orthogonal* to voice (it multiplies the per-voice
  rest-fill / tuplet / capacity paths, `(staff × voice)`), not a 1:1 parallel of it, so
  "staff mirrors voice" holds only for the ~10-file interaction layer — the ScoreModel /
  NoteEntryCoordinator rest-fill+tuplet layer is the real heavy lift.
- **Good news:** the rebar *engine* is already list-parameterized —
  `flattenRegion(measures, voice)` (`rebar.ts:149`) / `relayEvents` take an arbitrary
  measure list. Only the ScoreModel *wrappers* that build the region reach for
  `this.score.measures` (`rebarRegion` `:936`, `pasteEvents` `:1061`).
- Flat `Note` carries `measure: number` + `voice` but **no staff** (`music.ts:391`);
  `toFlatNote`/`restToFlatNote` (`noteProjection.ts:13,38`) copy no staff.
- `toJSON`/`fromJSON` mirror `Score` verbatim (`ScoreModel.ts:2944,2951`).

**Renderer (`VexFlowRenderer.ts`, `MeasureLayout.ts`, `CoordinateMapper.ts`,
`ElementRegistry.ts`):**

- Exactly one `Stave` per measure (`buildAndDrawStave` `:585-633`, `new Stave` `:596`).
- The forward vertical formula is one scalar:
  `y = margin + currentLine * (staveHeight + verticalSpacing)`
  (`VexFlowRenderer.ts:1163`; height/`resize` math `:1129/:1143`; ghost-note **dup of the
  same formula** `:1240`). **But it is NOT a single choke point** (earlier drafts said so —
  wrong): there is a **second, independent encoding of the per-line stride** that must also
  become staff-aware —
  - `CoordinateMapper.ts` reconstructs line index from Y **in reverse**
    (`Math.floor((y - startY) / staffHeight)` at `:187/:192`, hit-band `:179-180`), and
  - it is seeded by a **hardcoded stride** `staffHeight: 120 + 30` in `MusicEngine.ts:61-63`.
  Both encode `staveHeight + verticalSpacing` separately; both change for multi-staff.
  **Good news:** everything *downstream of the `Stave` object* auto-follows once its `y` is
  right — ledger lines, beams, ties (`TieRenderer`), slurs (`SlurRenderer`,
  `getTopLineTopY`), dynamics, and `ElementRegistry` pitch↔y (reads `stave.getYForLine()`);
  none need per-element touching.
- Bounds are keyed **by measure number only** — `MeasureBounds` map (`:67`),
  `ElementRegistry.staffGeometries` (`:243`), and `ElementInfo` has **no** staff field.
- `ElementRegistry` pitch↔y is **already clef-aware** (`:346-427`, uses stored
  `lineYPositions` + `CLEF_REFERENCES` for treble/bass/alto/tenor) — a bass staff Just
  Works once geometry is staff-keyed. `CoordinateMapper`'s pitch↔y is treble-hardcoded
  (`:143-153`) but is only the fallback.
- VexFlow 5 ships `StaveConnector` (`'brace'|'bracket'|…`) and `System` — **not imported
  today**. (Used later for the deferred brace.)

**Playback (`PlaybackEngine.ts`):** **four** flat passes over `score.measures`
(`calculateTotalDuration` `:87`, `updatePosition` `:106`, a tie-scan pre-pass `:175-184`,
and `play` `:149-287`). Scheduling is **absolute-time** (`now + noteTimeInSeconds`), so
multi-staff is "run the inner loop once per staff against a **shared** per-measure clock" —
`currentTimeInBeats += measureCapacityQuarters` (`:264`) must become a per-measure value
reused across staves, not accumulated per-staff. The **same hazard applies to the
`scanTime` accumulator** (`:174/:183`) in the tie-scan pre-pass. (The `pitchInfo` map's
`measureStartBeats` field is stored but **unread** — dead; don't build on it.) Ties are
**safe** across parallel staves: the chase is both id-keyed *and* pitch-guarded (`:219/:231`),
so a cross-staff id can't be mismatched.

**UI (`App.vue`, `interactions/`):** the "Measure:" group is a small labeled `<div>` of
two buttons in the one toolbar (`App.vue:381-396`), gated by
`hasMeasureContext = computed(() => state.selectedMeasureRange !== null)` (`:759`).
Box-select sets `state.selectedMeasureRange` (`MouseController.selectMeasureBox`
`:522-557`; field defined `EditorState.ts:122`; drawn by
`HighlightController.applyMeasureBox` `:116-168`). (The field is `selectedMeasureRange`,
**not** `selectedMeasureBox` — the latter is only a stale comment at
`HighlightController.ts:112`.) This is the exact
pattern the "Staff:" group mirrors.

---

## 4. Proposed data-model shape

Shared measure spine + per-staff content inside each measure (the MuseScore-style
model). Single-staff is the N = 1 default. *Proposed* shapes — open to refinement during
Phase 0.

> **Phase 0 decision to make consciously — nested container vs. `staffId` discriminator.**
> The shapes below **nest** per-staff content (`Measure.staves: StaffContent[]`). The
> alternative is the pattern this codebase *already uses for the other vertical axis,
> voice*: a per-slot **discriminator field** — give each `Chord`/`Rest`/`ClefChange`/
> `Dynamic`/`Tuplet` an optional `staffId` (absent = staff 0, exactly like absent
> `voice` = voice 0), and keep `Measure.slots` flat.
>
> Since there is **no legacy JSON to migrate** (no users yet — see the round-trip note at
> the end of this section), *both* shapes are equally cheap on the serialization axis, so
> decide on **consistency + Phase-0 blast radius**, not migration:
> - **Flat `staffId`** (mild recommendation): one mental model for both vertical axes;
>   smaller structural change (add a field, don't restructure the container); the clean
>   `StaffContent → Stave` render mapping is still recoverable as a **`staffContent()`
>   view** (`groupBy(staffId)` at render/rebar time).
> - **Nested `Measure.staves[]`**: groups clefs/dynamics/tuplets per staff naturally and
>   maps 1:1 to a `Stave` in storage — a legitimate choice; its edge is purely the
>   container clarity, now that migration no longer counts against it.
>
> Whichever wins, `staffContent(measure, staffId)` is the addressing primitive; the rest
> of this section is written against the nested shape but reads the same for a flat store
> where `staffContent` is a filtering view.

```ts
interface Score {
  // ...existing (tempo, keySignature, defaultTimeSignature, slurs, engravingOverrides)
  measures: Measure[]          // UNCHANGED: the shared horizontal spine (barlines, meter)
  staves: StaffInfo[]          // NEW: the staff axis, ordered top→bottom. Length 1 default.
  staffGroups?: StaffGroup[]   // NEW: optional grouping overlay (modeled now, drawn later)
}

interface StaffInfo {
  id: string                   // stable identity (back-pointers use this, not an index)
  // name/transposition/timbre: DEFERRED — not here. Timbre is a playback concern.
}

interface StaffGroup {
  id: string
  staffIds: string[]           // ordered members of one unit (piano = its 2 staff ids)
  symbol?: 'brace' | 'bracket' // rendering DEFERRED; default 'brace' when drawn
}

interface Measure {
  // SHARED barline/grid facts stay here (all staves aligned):
  id; number; timeSignature; timeSignatureChange?; timeSignatureHidden?
  actualDurationOverride?; keySignature?   // key stays shared for now (see §10)
  staves: StaffContent[]       // NEW: per-staff content, parallel to Score.staves order
}

interface StaffContent {
  staffId: string              // which staff this lane belongs to
  slots: ChordRest[]           // MOVED from Measure.slots
  clefs?: ClefChange[]         // MOVED from Measure.clefs — clef is per-staff
  dynamics?: Dynamic[]         // MOVED from Measure.dynamics
  tuplets: Tuplet[]            // MOVED from Measure.tuplets
}
```

- **Internal `Chord`/`Rest`** gain `staffId: string` alongside their `measure: number`
  back-pointer.
- **Flat `Note`** gains `staff?: number` — the 0-based index of its staff in
  `Score.staves` (default 0), for positional addressing (mirrors `measure` being an
  ordinal). Projection resolves index ↔ `staffId`. Note-**id** lookups
  (`findSlot`/`getNote`) stay global and are unaffected.
- **Why staffId internally, index in the flat view:** stable ids mean "add staff above"
  *prepends to `Score.staves`* with **no** mass renumber of note back-pointers (unlike
  measure insert). The index is derived from `Score.staves` order at projection time.
- **`keySignature` stays shared** on `Measure` for now (all staves same key). Per-staff
  key/transposition is a §10 future-open point.

**Serialization — round-trip alignment only, no migration.** There is **no legacy score
JSON in the wild** (no users), so `fromJSON` does **not** need a forward-migration branch.
The only requirement is that `toJSON`/`fromJSON` **round-trip the new shape**: change the
model shape and its serialization together, and make the round-trip test pass. (Contrast
`migrateLegacySlurCps`, which existed to rescue already-persisted documents — nothing here
is already persisted.) If the flat-`staffId` shape is chosen, this is automatic anyway:
absent `staffId` reads as staff 0, exactly like absent `voice`.

**Rebar & paste across the shared spine (invariant to hold).** The rebar *engine* is
list-parameterized (confirmed — `rebar.ts` has zero `score.measures`); only the wrappers
`rebarRegion` (`:936`) / `pasteEvents` (`:1061`) reach for the score. Because all staves
share one barline spine, a meter change must **rebar every staff of the region in lockstep**
against the one new bar length — the wrapper loops `(staff × voice)`, not just `voice`.
**Paste stays active-staff-scoped for this whole pass** (a deferral, like braces): copying
a region grabs the active staff only, and the clipboard payload gains a staff axis later
(§11). This keeps Principle 4's "place material into *(staff, measure, beat)*" reachable
without building it now.

---

## 5. Rendering changes

Stack N staves per system, sharing barlines. **No brace yet.**

- The forward scalar becomes a function of `(line, staffIndex)`:
  `y = systemTop(line) + Σ(staffHeight + interStaffGap for staves above this one)`
  — at both `VexFlowRenderer.ts:1163` and its ghost-note dup `:1240`.
- **The reverse map must change too (not just the forward one).** `CoordinateMapper.ts`
  turns a click-Y back into a line (`:187/:192`, hit-band `:179-180`) using a stride that
  is **hardcoded** as `staffHeight: 120 + 30` in `MusicEngine.ts:61-63`. Multi-staff makes
  Y→line into Y→`(line, staff)`; feed CoordinateMapper the real per-staff geometry instead
  of the single constant (see §6). Downstream-of-`Stave` geometry (notes, ledgers, beams,
  ties, slurs, dynamics, `ElementRegistry` pitch↔y) auto-follows and needs no per-element
  change.
- `buildAndDrawStave` loops per staff within each measure; each `(measure, staff)` draws
  its own `Stave` at its computed `y` with **that staff's** clef/slots/voices/tuplets.
- Per-system height becomes `Σ staffHeights + Σ interStaffGaps + interSystemGap`; the
  canvas height / `renderer.resize` math (`VexFlowRenderer.ts:1128-1129`) and the
  ghost-note vertical paths (`:1240`, `:1201-1270`) follow.
- Barlines: each staff draws its own; shared `x` aligns them into one visual barline.
  (A single joined barline via `StaveConnector` is deferred with the brace.)
- `MeasureBounds` and `ElementRegistry` geometry are written per `(measure, staffId)`
  (see §6).
- All vertical numbers (heights, gaps) are **render-layer constants/derived** — none
  written back to the model (§1).

## 6. Coordinate + hit-test changes

- `ElementRegistry.staffGeometries` and `MeasureBounds` keyed by `(measure, staffId)`;
  `ElementInfo` gains a `staff` field so hit results carry it.
- **Click → which staff:** disambiguate by the y-band of each staff within a system
  (today the code leans on staves being a full system-height apart — that safety margin
  shrinks to `interStaffGap`, so make it explicit).
- Pitch↔y resolves against **that staff's own clef** — `ElementRegistry` is already
  clef-aware (`:346-427`); just feed it the per-staff geometry. `CoordinateMapper`'s
  treble-only pitch↔y fallback (`:143-153`) is secondary; make it staff-aware
  opportunistically.
- **Replace the hardcoded stride.** `MusicEngine.ts:61-63` seeds CoordinateMapper with a
  single `staffHeight: 120 + 30`; the reverse Y→line math (`:187/:192`, band `:179-180`)
  depends on it. Multi-staff needs per-staff stride here, so this constant becomes
  derived/per-staff, not a literal.

## 7. Active staff + note entry

- `EditorState` gains `activeStaff: number` (index, default 0), mirroring active voice.
- Note entry targets the active staff; clicking within a staff sets it active; a
  box-selected measure carries its staff as the reference (see §9).
- `KeyboardController` / `NoteEntryCoordinator` thread a staff (default `activeStaff`).
  **Correction to an earlier draft:** the loops at `NoteEntryCoordinator.ts:110-127` /
  `:213-238` are **already voice-scoped** (`entryVoice` filter at `:114/:118`, `:224-225`)
  — and `:213-238` is a coordinate-resolution block, not a delete loop. They just need an
  added `&& (n.staff ?? 0) === entryStaff` clause. The real overwrite/erode sites that
  gain the same clause are `findNotesToOverwrite` (`:1338`), `erodeOverflowZone` (`:1229`),
  and the duration lengthen/shorten loops (`:509`, `:648`). `CollisionDetector` filters by
  measure+voice only (`:53/:56`, `:168/:169`) and needs the staff clause too.
- Selection / keyboard nav stays within the active staff, with the same
  fall-back-to-a-valid-lane behavior the voice nav already uses.

## 8. Playback changes

- Compute `measureStartBeats[]` **once** per measure (shared clock), then loop staves
  inside each measure — staff 1 bar 3 and staff 2 bar 3 share the same absolute onset.
  This replaces the running `currentTimeInBeats += …` accumulator (`:264`) **and** the
  twin `scanTime` accumulator in the tie-scan pre-pass (`:174/:183`) — both currently
  advance as a side effect of walking the flat list, which would push staff 2 *after*
  staff 1 instead of parallel.
- The `pitchInfo` tie-chase map (`PlaybackEngine.ts:173`) stays id-keyed and is safe for
  parallel staves (id- *and* pitch-guarded); feed it the shared per-measure start, not a
  per-staff accumulation. (Its stored `measureStartBeats` value is dead today — don't
  rely on it.)
- `calculateTotalDuration` reads capacity from any one staff (bars are aligned).
- One shared `PolySynth` for now — **timbre is out of scope** (§1). Per-staff synths are
  a later, playback-only change.

## 9. UI — the "Staff:" toolbar group

Mirror the "Measure:" pattern exactly (`App.vue:381-396`):

- Engine methods `addStaffAbove(refStaff)` / `addStaffBelow(refStaff)`: append a
  `StaffInfo` to `Score.staves` at the right position and give **every** measure a new
  rest-filled `StaffContent` (treble clef). `removeStaff` mirrors it (add-only is
  acceptable for the first cut; removal is a small follow-on).
- **Group-creation transition (spec gap to close):** a single-staff sketch has **no**
  `StaffGroup` (§4: `staffGroups` absent). So the *first* `addStaff*` must **create** the
  first group (0 groups → one group of 2), not "grow" an existing one; subsequent adds
  grow that group. Make this 0→1 transition explicit in `addStaffBelow/Above`.
- `PaletteController.addStaffAbove/Below` gated by a `staffContext()` helper reading the
  box-selected measure's staff (Ctrl+Shift+click a bar → reference staff).
- `App.vue`: `hasStaffContext` computed near `:759`; a labeled `<div>` button group
  ("Staff: + Above / + Below") next to the "Measure:" group.

---

## 10. Phasing (checklist)

- [x] **Phase 0 — Model scaffolding, N = 1, behavior identical.** **DONE 2026-07-03.**
      Decision settled: **flat `staffId` discriminator (Option A)**, not nested — the
      contemporary/independent-barline future is carried by Principle 2 (the position-
      independent event stream), which is orthogonal to the container; A wins on symmetry
      with the existing `voice` discriminator + far lower risk to the mature editor.
      Shipped: `StaffInfo`, `StaffGroup`, `Score.staves`/`staffGroups?` (types);
      `staffId?` on `Chord`/`Rest`/`ClefChange`/`Dynamic`/`Tuplet`; flat `Note.staff`
      (absent = 0, mirrors `voice`). Constructor seeds one staff; `fromJSON` defaults it
      when absent (defaulting, **not** migration); `toJSON` round-trips it. New pure module
      `engine/models/staffContent.ts` = the addressing seam (`staffContent`/`staffSlots`/
      `staffIndexOfId`/`matchesStaff`), unit-tested under N>1. Projection carries the
      staff index. **900 unit tests green; N=1 byte-identical; boundary lint + build clean.**
      **Scoping note (deliberate):** the blind ~157-site `.slots/.clefs/.dynamics/.tuplets`
      routing is **NOT** done here. At N=1 every site is correct (absent `staffId` = staff
      0), and the staffId each *write* site should stamp is a per-site decision that only
      has meaning — and only becomes testable — once N>1 exists. So each site is routed in
      the later phase that introduces its staff (render/coord/entry), against a real 2-staff
      score, rather than guessed blind now. `staffContent()` is the single seam they route
      through.
- [x] **Phase 1 — Render N staves stacked, shared barlines.** **DONE (UNCOMMITTED)
      2026-07-03.** Render loop now loops `staffList` per measure: `y = systemTop(line) +
      staffIndex * staffStride`, `systemTop = margin + line * numStaves * staffStride`,
      `staffStride = STAVE_HEIGHT + VERTICAL_SPACING` (uniform inter-staff = inter-system
      gap — simplest, provably N=1-identical; distinct/brace spacing is later). Per-system
      height = `numLines * numStaves * staffStride + margin*2`. Each `(measure, staff)` draws
      its own `Stave` from a **`staffMeasureView(measure, staffId, score)`** (new seam in
      `staffContent.ts`: shallow Measure with `slots/clefs/dynamics/tuplets` filtered to the
      staff) — so the ~20 helpers inside `renderMeasure` stay untouched (they read the
      narrowed view). Clef is per-staff: `clefUtils` (`measureClefChanges`/`inheritedClef`/
      `effectiveClefAt`/`effectiveClefBefore`/`measureOpeningClef`/`measureEndingClef`/
      `midMeasureClefChanges`) gained an optional trailing `staffId?` (absent = staff 0, so
      all pre-existing callers unchanged); `computeEffectiveClefs(score, staffId?)` builds one
      map per staff. Ghost-note vertical path updated for the N-staff stride (previews on
      staff 0). **Scope split (deliberate, matches Phase-2 line):** per-measure GEOMETRY
      (`measureBounds`, `staffGeometry`, `'staff'`/`'clef'` `ElementInfo`) is still keyed by
      `measure.number`, so only staff 0 (index 0) writes it — a lower staff would clobber the
      first. The `(measure, staffId)` geometry rekey + click→staff disambiguation + per-staff
      pitch↔y are **Phase 2**. Per-slot content (notes/rests/dynamics/tuplets/beams) IS
      registered for every staff (keyed on global slot/pitch ids, collision-free). **N=1
      byte-identical** (staff loop runs once at index 0, all guards no-op); 903 unit tests
      green (+3: `staffMeasureView`, staff-aware clef); build + boundary lint clean.
      **TEMP hook to make N>1 visible before Phase 4:** `ScoreModel.addTempSecondStaff()` →
      `MusicEngine.addTempSecondStaff()` → `PaletteController.addTempSecondStaff()` → purple
      "+ Staff (temp)" toolbar button; seeds a 2nd staff (bass clef + two half notes at
      beats 0 & 2 in bar 1). **DELETE all four when Phase 4's real "+ Staff" panel lands.**
      **Two fixes pulled in when the temp hook exposed real bugs (both durable, N=1-identical):**
      (a) **`fillGapsWithRests` is now staff-aware** — it partitioned by voice only, so a
      note on staff 2 suppressed staff 1's rest-fill and filler rests (created with no
      `staffId`) leaked onto staff 0. Now it partitions by **(staff, voice)**: the first
      staff stamps an absent `staffId` (N=1 convention), other staves stamp their id via
      `pushRestSlot(measure, rest, voice, staffId?)`. This is a Phase-3-adjacent site done
      early out of necessity (render runs `repairAllMeasureGaps`). (b) **System-left
      `StaveConnector('singleLeft')`** joins the stacked staves into one system at each
      line's first measure (`renderMeasure` now returns its `Stave`); a plain line only —
      the brace/bracket (`StaffGroup`) stays deferred. 904 tests green (+1 staff-aware fill).
- [x] **Phase 2 — Coordinate + hit-test staff-aware.** **DONE (UNCOMMITTED) 2026-07-04.**
      `ElementRegistry.staffGeometries` rekeyed from `measure` → composite `(measure, staff)`
      string (`geomKey`); `StaffGeometry` gained `staff: number` (the 0-based index — the
      projection of `staffId`, consistent with flat `Note.staff`) and `ElementInfo` gained an
      optional `staff`. Every stacked staff now registers its own geometry + `staff`-stamped
      `staff`/`clef`/`timeSignature`/`barline`/`note`/`rest`/`accidental`/`articulation`
      ElementInfo (the Phase-1 `staffIndex === 0` geometry guard is gone; `registerStaffAndGeometry`
      + `registerSlotElements` take `staffIndex`). New `ElementRegistry.staffIndexAtY(measure, y)`
      resolves a click to a staff by nearest line-band (gap → closer staff; ledger notes → own
      staff). `pixelYToPitch`/`pitchToPixelY` gained a trailing `staff = 0` arg and look up the
      per-staff geometry; `findClosestNote`/`findClosestNoteOrRest`/`noteOrRestHitDistance`/
      `hitsNoteOrRestBody` thread `el.staff`, so a bass 2nd staff resolves pitch against its OWN
      clef. `MusicEngine.getPositionFromPixels` resolves `staff = staffIndexAtY(...)`, feeds it to
      `pixelYToPitch`, and returns it; `pixelToPosition` now returns `staff` (consumers wire it in
      Phase 3). Hardcoded stride replaced: `CoordinateMapper` config gained `numStaves` +
      private `systemHeight() = staffHeight * numStaves`; `pixelToMeasure`/`getMeasurePosition`
      Y-band math spans the whole system (a click on staff 2 lands in the right measure). New
      `MusicEngine.syncCoordinateMapperBounds()` pushes bounds AND syncs `numStaves` from the
      model on every render path (replaced the 5 bare `setMeasureBounds` calls). **`measureBounds`
      stays keyed by `measure.number`** (deliberate — X shared across staves, `measureY` = system
      top; per-staff Y lives in `staffGeometries`). **N=1 byte-identical** (staff always 0,
      `numStaves=1` → `systemHeight===staffHeight`); 912 unit tests green (+8: `staffIndexAtY`,
      per-staff keying + clef-aware pitch↔y); build + boundary lint clean. **OPEN (deferred,
      matches plan's "opportunistic"):** `CoordinateMapper`'s own treble-only pitch↔y fallback
      (`:143`) is left treble/staff-0 — it only fires when a rendered staff has NO registry
      geometry (≈never), so the staff-aware registry path covers real clicks.
- [x] **Phase 3 — Active staff + entry.** **DONE (UNCOMMITTED) 2026-07-04.** `EditorState.activeStaff`
      (0-based index, default 0; the multi-staff analogue of `activeVoice` but a raw model index).
      **Model (ScoreModel):** new `staffIdForParams(staff)` (index→staffId, absent for staff 0 =
      byte-identical convention); `addNote` stamps `staffId` on rest+chord AND scopes the
      same-beat chord-merge lookup + `replaceRestsWithChord` rest-removal by `matchesStaff` — this
      is the fix for the cross-staff merge bug (a treble note was joining the bass staff's
      same-beat/voice chord). `addRest`/`fillGapWithRests` gained a trailing `staff` index arg.
      **NoteEntryCoordinator:** mouse entry resolves `entryStaff = staffIndexAtY(measure, y)` from
      the click (like pitch); keyboard entry takes `params.staff`. Added `&& (n.staff??0)===entryStaff`
      to every voice-scoped `getNotesInMeasure` filter and threaded staff through `applyEntryOverwrites`/
      `findNotesToOverwrite`/`getChordNotesAt`/`resolveClickToBeat`/`placeSplitNote`/`placeSpanningNote`/
      `splitExistingNoteWithTie`/`addSplitNoteWithTie`/`erodeOverflowZone`/`erodeNoteAtBoundary`/
      `isValidEntryClick`/`updateNote`+`updateNonTupletNote` (editStaff → per-staff gap-fill).
      **ElementRegistry:** `findNotesLeftRight`/`findNearestNoteOrRest` gained an optional `staff`
      filter (used by beat resolution). **beatMap:** `buildBeatMap`/`buildVoiceNavBeatMap`/`navBeatMap`
      gained an optional `staff` (a HARD boundary — no per-measure fallback like voice). **Interaction:**
      `SelectionController` syncs `activeStaff` on select + resets on deselect; `navigateSelection`/
      `navigateChord`/`navigateVoice` staff-scoped. `KeyboardController` entry/rest continue the cursor
      note's staff. `HighlightController` cursor uses active-staff nav map + geometry. Esc resets
      `activeStaff=0`. **N=1 byte-identical** (staff always 0, absent staffId); **915 unit tests green**
      (+3: no cross-staff merge, staffId stamping, staff-0 stays absent); build + boundary lint clean.
      **DEFERRED (documented limitations, not regressions):** tuplet creation still lands on staff 0
      (`createTuplet` not staff-aware); copy/paste stays active-staff-scoped (plan §4/§11);
      `getEffectiveClefAt` in voice-hop isn't per-staff (relative ordering still correct).
- [x] **Phase 4 — "Staff:" panel + add.** `addStaffAbove/Below` (treble default,
      rest-filled every bar) + toolbar group gated by box-selected measure. DONE (8a251d3):
      single staff group create(0→1)/grow; prepend solidifies absent-staffId content; box-select
      captures + re-anchors the reference staff by id across the index shift.
- [x] **Phase 5 — Playback multi-staff.** Shared per-measure clock; loop staves; one
      shared synth. DONE (uncommitted): the flat model already schedules all staves against a
      per-measure clock (measure.slots interleaves staves). Extracted a pure, tested
      `collectScheduledNotes()` to verify it. Per-staff dynamics loudness + timbre stay deferred.

## 11. Future-open points (not built — landing spots kept open)

Each is *additive*, never a teardown, because of the choices above:

- **Brace / bracket rendering** — `StaffGroup.symbol` + a `StaveConnector` pass. The
  grouping data already exists after Phase 0.
- **A new group** ("add a violin on top of the organ") — append a `StaffGroup` + its
  staves. `staffGroups` is a list (length 1 now).
- **Cross-staff notation** — a per-note "display on adjacent staff" move, **offered only
  when the target staff is in the same `StaffGroup`** (the grouping is exactly the
  legality gate). Each note already owns a `staffId`.
- **Per-staff independent meters** — each `StaffContent` is already its own container; a
  later per-staff meter/barline override loosens the shared spine additively (same
  "additive, never teardown" spirit as engraving-overrides). Modern non-aligned notation
  becomes reachable.
- **Per-staff key / transposition** — move `keySignature` into `StaffContent` + a
  written-vs-sounding transposition field.
- **Instrument identity + per-staff timbre** — an optional attachment mapping a staff to
  a name/sound in the **playback** layer; never content. A sketch (no such mapping) can
  be merged into an instrument later.
- **Staff reorder / staff-spacing engraving override** — reorder `Score.staves`
  (stable `staffId` back-pointers survive it); spacing tweak → engraving-overrides
  compartment in staff-spaces.
```
