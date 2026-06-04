# Time Signature — Implementation Plan

Status: **in progress** — Phases 0–2 complete (duration layer; coordinate/beat correctness;
`utils/meter.ts` metric-hierarchy generator); Phase 2b next. This document is the authoritative
plan and cross-session checklist for adding full time-signature support to the editor.

---

## 1. Goal

Let users set a time signature at the start of the score and change it at any measure.
A small palette covers common meters for testing (4/4, 3/4, 5/8 to start), but the
**engine must support every dyadic musical meter the user could enter** — the presets are
just shortcuts, not the limit.

This touches four hard problems:

1. **Rest-fill** — VexFlow throws if a measure isn't filled to its tick total, so empty
   space must be filled with engraving-correct rests. The current logic is 4/4-biased.
2. **Changing the meter of a bar that already has notes** — needs a defined policy.
3. **Multiple voices** — not implemented yet, but all meter math (rest-fill, reconcile)
   must be written per-voice from the start so retrofitting later isn't painful.
4. **Generality** — no hardcoded meter tables anywhere; everything derived algorithmically.

---

## 2. Industry research (Sibelius / MuseScore / Finale / Dorico + engraving rules)

Sources: [MuseScore Handbook — Time signatures](https://handbook.musescore.org/notation/rhythm-meter-and-measures/time-signatures),
[MuseScore Handbook — Beams](https://handbook.musescore.org/notation/rhythm-meter-and-measures/beams),
[Dorico — Insert mode & time signatures](https://blog.dorico.com/2018/04/tip-use-insert-mode-when-adding-time-signatures-to-avoid-irregular-bars/),
[Finale — Rebarring music](http://usermanuals.finalemusic.com/Finale2012Win/Content/Finale/Rebarring_music.htm),
[Finale — Rebar Options](https://usermanuals.finalemusic.com/Finale2014Win/Content/Finale/REBAROPT.htm),
[OpenLearn — Grouping rests in compound time](https://www.open.edu/openlearn/history-the-arts/music/an-introduction-music-theory/content-section-4.3),
[MyMusicTheory — Adding rests & beaming in groups](https://www.mymusictheory.com/for-students/grade-3/273-8-adding-rests-a-beaming-notes-in-groups).

### 2.1 Creating / changing a time signature
- Time signature changes can only occur **at the start of a measure** (universal).
- UI = **palette of presets + a custom dialog** for compound/additive/custom meters.
  MuseScore "Create Time Signature"; Dorico popover (`[2+2+3]/8`); Finale Time Signature
  dialog; Sibelius keypad/dialog. Displayed signature can differ from actual length.

### 2.2 What happens to existing music when the meter changes (the hard one)
- **Dominant model — rewrite/rebar (Sibelius, Finale, MuseScore):** re-bar everything from
  the change to the next TS change (or end of score). Notes keep content/order; **barlines
  move**; notes straddling a new barline are **split with ties**; overflow **flows forward**;
  underfull bars get **rest-filled**; bars are created as needed.
  - MuseScore warns: *"changing a time signature will cause any existing music that follows
    to be re-barred, and some items may be lost in this process."*
  - Finale: **"Rebar Music"** checkbox + **Rebar Options** controlling *how far* (region /
    next time-or-key change / end) and whether to **rebeam**.
  - Sibelius: prompts *"rewrite the following bars up to the next time signature?"* — Yes =
    rebar; No = leave irregular.
- **Continuous-timeline model (Dorico):** notes keep absolute positions, barlines move,
  grouping updates (a quarter that now crosses a barline becomes two tied eighths).
  Without Insert mode it **allows incomplete/irregular bars**; with Insert mode it pushes
  music later and pads time so nothing truncates.
- **Takeaways:** the pro default is rebar-with-ties + forward overflow; **nobody deletes
  notes by design**; irregular bars are a legitimate intermediate state.

### 2.3 Rest-fill conventions (engraving rules)
- Governing principle (simple and compound): **"show each beat"** — start a new rest group
  on each main beat; never let a rest obscure a stronger beat boundary.
- **A whole bar of silence uses a whole rest, centered — in every meter** (the one universal
  exception to "show each beat").
- **Simple time (4/4): do not cross the middle of the bar.** A 2-beat rest mid-bar = two
  rests. Two beat-rests at the start/end may combine within a half-bar.
- **Compound time (6/8, 9/8, 12/8): beat unit is the dotted note.** One empty beat = a
  dotted-quarter rest (or quarter+eighth). Rests group within each dotted beat; 12/8 (four
  beats, like 4/4) may combine two adjacent beat-rests at the start/end into a dotted-half.
- **Irregular meters (5/8, 7/8):** fill per additive grouping (5/8 = 2+3 or 3+2; 7/8 =
  2+2+3) — so grouping is **data attached to the meter**, not derived from denominator alone.

### 2.4 Beat grouping / beaming
- *"Default beaming is determined by properties of the time signature."* Beam in complete
  beats; start a new group on each main beat. 3/4→3 groups; 6/8→two groups of three eighths;
  7/8→2+2+3. In 4/4, four eighths may beam as a half-group only if it doesn't cross the
  mid-bar (weaker→stronger) boundary. Every app exposes a **per-meter beam-group editor**.
- **Architectural echo:** rest-fill and beaming are driven by the **same beat-group
  structure** — one descriptor per meter feeds both.

### 2.5 Voices & pickups
- A time signature is a **property of the bar**, applying across all voices; each voice must
  independently sum to the bar length (each gets its own rest-fill).
- Pickup (anacrusis) bars = a bar whose **actual length < nominal TS length**; irregular bars
  are explicitly supported as a real state.

---

## 3. Codebase findings

### 3.1 Already modeled
- `Measure.timeSignature` exists on every measure; `Score.defaultTimeSignature` exists
  (`src/types/music.ts`). Default is hardcoded `{4,4}` (`ScoreModel.ts:14`).
- **No API to change a TS** — `addMeasure(ts?)` only sets it at creation
  (`ScoreModel.ts:89`). No `setTimeSignature` anywhere.

### 3.2 ⚠️ Biggest landmine: two conflicting "beats per measure"
- **Internal positions are in quarter-note beats.** `getMeasureDuration`/`getMeasureTotalBeats`
  correctly compute `numerator × (4/denominator)` (`musicUtils.ts:53`, `ScoreModel.ts:111`).
- **But many callers shortcut `beatsInMeasure = timeSignature.numerator`** — wrong for any
  non-`/4` meter. The correct quantity (`getMeasureDuration`) is already used in
  `CollisionDetector` and `PlaybackEngine`. The `numerator` shortcut is the bug. VexFlow
  `Voice({numBeats: numerator, beatValue: denominator})` is correct as-is (VexFlow wants the
  literal signature).
- **⚠️ Do not trust an enumerated line list here — line numbers drift and the list below was
  already both stale and incomplete on audit.** Phase 1 is **audit-driven** (grep, fix at
  assignment sites). For orientation only, the bug *assignment* sites at time of writing:
  - `NoteEntryCoordinator:161`, `:418` (each assigns `= numerator`; `:439/:604/:623` are
    *downstream uses* of that variable, not independent bugs — fix at the assignment).
  - `MusicEngine:749`, `:914` (assign `= numerator`); `:1014/:1026/:1071` thread the value.
  - `MouseController:476` (assigns `= numerator`). **`MouseController:371` is already CORRECT**
    (`(4/denominator)*numerator`) — do **not** "fix" it.
  - **`VexFlowRenderer:1688`** — the ghost-note **preview** path: `totalBeats =
    timeSignature.numerator`. Missed by earlier drafts; real bug in non-`/4` preview rest-fill.
  - `CoordinateMapper.beatToPixelX/noteToPixel/pixelXToBeat/pixelToPosition` (param-threaded).
  - `KeyboardController:208` duplicates the *correct* inline `numerator × 4/denominator`; not a
    bug but should be centralized onto `getMeasureDuration` for consistency.

### 3.3 Rest-fill is float-based and 4/4-biased
- `createMusicalRests` (`ScoreModel.ts:649`) and `fillMeasureWithRests` (`:128`) walk in
  quarter units using **floats + epsilon**, while the rest of the system uses exact
  `Fraction`. Special-cases 4/4. **No compound-meter grouping**, no "don't cross the 4/4
  middle" rule, no proper 5/8/7/8 handling. `fillGapsWithRests:573` builds the bar length via
  a hacky `fracCreate(Math.round(totalBeats*8), 8)`. `createMusicalRests` also has **dead
  unreachable branches** (the trailing `q`/`8`/`16` cases after the `else` chain can never
  fire) — they vanish when this is replaced.
- **⚠️ There is a SECOND float-based 4/4-biased rest filler:** `VexFlowRenderer.beatsToRestDurations`
  (`~:400`), used by the ghost-note **preview** path. It is fully parallel to
  `createMusicalRests` and is **not** in `ScoreModel`, so deleting the model's float filler
  leaves it alive — previews would still be wrong in non-`/4`. It must also be migrated onto
  the new `fillRests` (see Phase 2b/3).

### 3.4 No re-flow / re-bar logic
- Changing a TS over notes is completely unhandled. `CollisionDetector` *detects* overflow
  (`:108`) but nothing rewrites.

### 3.5 Voices: field exists, unused
- `Chord` and `Rest` carry `voice?: 0|1|2|3` (`music.ts:198/215`) but **no code reads it**.
  All fill/collision/render treat `measure.slots` as one flat stream.

### 3.6 Beaming hardcoded to quarter beats
- `getBeatGroup` is `Math.floor(beat)` (`VexFlowRenderer.ts:428`) with a comment that it
  should become meter-aware.

### 3.7 Clef feature is the UI template
- "Arm palette item → ghost on hover → click measure to apply" already exists for clefs:
  `PaletteController.setClef`/`selectedClef` → `MouseController:349` → `engine.setClefAt`.
  A TS palette mirrors this; TS is simpler positionally (always beat 0) but harder in
  consequence (reflow). TS is drawn via `stave.addTimeSignature(...)` (`:1042/:1630`).

---

## 4. VexFlow 5 constraints (from installed `vexflow@5.0.0` source)

`Voice` has three modes (`build/types/src/voice.d.ts`):

| Mode | Rule | Over-full | Under-full |
|---|---|---|---|
| **STRICT** (default) | ticks must fill the voice exactly | throws | throws |
| **FULL** | may be short, can't exceed capacity | throws | allowed |
| **SOFT** | no restrictions | allowed | allowed |

Three throw points:
1. **`addTickable`** (`voice.js:124-133`): STRICT or FULL, when `ticksUsed > totalTicks` →
   `RuntimeError('BadArgument', 'Too many ticks.')`. SOFT never throws.
2. **`Formatter.format` completeness** (`formatter.js:257`): STRICT + not complete →
   `RuntimeError('IncompleteVoice', 'Voice does not have enough notes.')` (the under-full trap).
3. **`Formatter.format` cross-voice** (`formatter.js:254`): all joined voices must share the
   same `getTotalTicks()` (nominal capacity) or `RuntimeError('TickMismatch', …)`.

Current code: both real render voices (`VexFlowRenderer.ts:738` width-calc, `:981` draw) use
**default STRICT**, wrapped in `try/catch` that just warns and falls back to
`MIN_MEASURE_WIDTH`. So today over/under-full bars **don't render**. The drag-preview path
already uses `.setMode(Voice.Mode.SOFT)` (`:1710`).

**Implications:** irregular bars and pickup bars cannot render under STRICT. Switch the two
real render voices off STRICT. Use **`FULL`** for normal/under-full bars (keeps the over-full
guard as a corruption tripwire) and **`SOFT`** only for the over-full case (so crowded
irregular bars still draw every note). VexFlow does **not** auto-fill — the model's rest-fill
is what makes a bar complete. Multiple voices later must share `numBeats/beatValue`.

---

## 5. Design invariants (non-negotiable)

1. **No enumerated meter tables.** Everything derived algorithmically from
   `(numerator, denominator, grouping?)`. The 3 test meters are fixtures, not special cases.
2. **Internal unit stays quarter-notes** (`Fraction`). The felt beat (dotted in compound) is
   display/grouping only — never changes stored positions.
3. **Generality contract:** accept any `numerator ≥ 1` and any **dyadic** denominator we can
   represent (`{1,2,4,8,16,32}` now). **Non-dyadic / irrational meters are rejected** with a
   clear error. Default grouping is algorithmic; user-overridable.
   - *Extending to `64`/`128`/breve is NOT literally "one table."* The **`NoteDuration` union
     type** (`music.ts:11`) is the source of truth and must be edited first; then every map
     keyed by it (`DURATION_FRACTIONS` in `fraction.ts`, the float `durationToBeats` map in
     `musicUtils.ts`, the VexFlow duration-string map in the renderer). Phase 0's job is to
     make those maps **exhaustive over the union** so a missing entry is a *compile error*,
     turning the extension into a guided multi-edit rather than a silent gap.
4. **Never lose notes.** Over-full bars render crowded (`Voice.Mode.SOFT`); normal/under-full
   use `Voice.Mode.FULL`. True rebar-with-ties is deferred to Phase 8.
5. **Voice-aware from day one** — the `voice` field exists; fill/reconcile/render iterate
   per voice (`voice ?? 0`), even though only voice 0 is populated today.
6. **Long empty bars** use a **measure-rest** (centered whole-measure rest at any bar length),
   not multiple rest glyphs.

### Decisions made during planning
- Over-full bars on TS change → **render crowded, keep notes** (SOFT), not trim/refuse.
- Irregular-meter grouping → **fixed algorithmic defaults** (5/8 = 2+3, 7/8 = 2+2+3),
  overridable via the `grouping` argument; no per-grouping palette buttons in phase 1.
- Denominator range → **up to /32 now** (current `NoteDuration` ceiling), extensible later.
- Long empty bars → **measure-rest concept**.
- Irrational meters → **out of scope** (reject non-power-of-two denominators).

---

## 6. Phased plan

Each phase is independently shippable; run `npm run test` + `npm run build:check` at every
boundary. The feature is engine-correct for arbitrary meters by end of Phase 5, user-reachable
for presets at Phase 6, and fully open-ended at Phase 6b.

### Phase 0 — Guardrails + duration centralization
**Goal:** lock current 4/4 behavior and prepare the duration layer; purely additive.
- `utils/musicUtils.ts`: add `getMeasureDurationFrac(ts): Fraction` =
  `fracMul(fracCreate(numerator,1), fracCreate(4, denominator))` (reduced). Replaces the inline
  `fracCreate(Math.round(totalBeats*8), 8)` in `ScoreModel.fillGapsWithRests`.
- Centralize the `NoteDuration ↔ Fraction ↔ VexFlow-string ↔ beats` maps into one module,
  **all keyed exhaustively off the `NoteDuration` union** (`Record<NoteDuration, …>`, no
  `Partial`) so adding `'64'`/`'128'`/breve later is type-checked: edit the union, fix the
  resulting compile errors. The union — not any single map — is the source of truth.
- **Tests/baselines:** `getMeasureDuration(Frac)` for 4/4, 3/4, 2/4, 2/2, 6/8, 9/8, 12/8, 5/8,
  7/8; snapshot current rest-fill for empty + partial 4/4 bars; snapshot 4/4 coordinate mapping.
- Risk: none.

### Phase 1 — Coordinate/beat correctness (the `numerator`-as-beats bug)
**Goal:** every coordinate/entry site uses bar length in quarter beats; no 4/4 change.
- Replace the `numerator` argument with `getMeasureDuration(ts)`; rename param
  `beatsInMeasure → barQuarters`. Clamp bounds become `barQuarters − noteDur`.
- **Audit-driven, not line-list-driven** (the old hardcoded line list was stale + incomplete).
  Procedure: `grep -rn 'numerator' src` and `grep -rn '4 *[/] *.*denominator' src`, then at
  **each assignment site** decide correct-or-bug:
  - **Fix** (assigns `= numerator` as a beat count): `NoteEntryCoordinator` (×2, the `:161`/
    `:418`-style assignments — their downstream `beatsInMeasure` uses come along for free),
    `MusicEngine` (the `= numerator` assignments feeding `noteToPixel`/`getPositionFromPixels`),
    `MouseController` (the `= numerator` site), and **`VexFlowRenderer` ghost-preview** (the
    `totalBeats = numerator` at the preview voice — easy to miss; wrong for non-`/4`).
  - **Centralize but already correct** (computes `numerator × 4/denominator` inline):
    `MouseController` other site, `KeyboardController`. Swap to `getMeasureDuration` for
    consistency; behavior unchanged. **Do not "fix" these as if buggy.**
  - **Param-threaded:** `CoordinateMapper.beatToPixelX/noteToPixel/pixelXToBeat/pixelToPosition`
    — rename the param; the real value is decided by callers above.
- **Not changed:** VexFlow `Voice` args; the ghost-preview `Voice({numBeats,beatValue})` literal
  signature (only its rest-fill `totalBeats` math); `buildBeams` (reworked in Phase 4).
- **Tests:** click-to-beat / `noteToPixel` round-trips for 3/4, 6/8, 2/2 (bar-center maps to
  correct quarter-beat); 4/4 snapshots unchanged.
- Risk: medium, mechanical (rename makes review safe).

### Phase 2 — `utils/meter.ts`: procedural metric-hierarchy generator
**Goal:** the central data structure; pure, no tables, fully general.
```ts
interface MeterInfo {
  numerator: number
  denominator: number
  barQuarters: Fraction          // exact bar length in quarter units
  isCompound: boolean            // num % 3 === 0 && num > 3 && denom >= 8
  beatUnit: Fraction             // felt beat in quarter units (1, 1.5, 2, …)
  groups: Fraction[]             // primary beat-group lengths, summing to barQuarters
  boundaries: { at: Fraction; strength: number }[]  // depth-based strengths
}
function getMeterInfo(ts: TimeSignature, grouping?: number[]): MeterInfo
```
- **Algorithmic** compound detection; build a subdivision **tree** (ternary at compound level,
  binary below) down to the smallest representable value; assign boundary **strength by depth**
  (bar start strongest, then group starts, then the even-meter mid-bar boundary elevated so
  rests/beams won't cross it, then subdivisions).
- **Default grouping rule** for any meter: compound → groups of 3; simple `denom ≤ 4` → one per
  beat; simple `denom ≥ 8` → quarter-note pulses where the numerator divides, else 2s, odd
  remainder as a short final group. Additive = non-uniform `grouping`.
- **Validation:** reject non-dyadic denominators / denominators finer than smallest note.
- **Known simplification (document, don't fix):** compound detection is gated at `denom ≥ 8`,
  so `6/4`, `9/4`, `12/4` render as *simple* (one beat per quarter), not compound dotted-half
  beats. This is a deliberate, defensible cut — but it means the "every dyadic meter" claim has
  one asterisk. A future report of "6/4 isn't beaming in twos" is expected behavior, not a
  regression. (The generality matrix's `16/4`, `7/4` are all `/4` and thus simple by design.)
- **Tests:** `groups`/`beatUnit`/`isCompound`/strengths for 4/4, 3/4, 2/2, 6/8, 9/8, 12/8,
  5/8, 7/8, **32/16, 16/4, 15/8, 13/16, 7/4**, additive `3+2+2/8`, a generated-fallback meter,
  and a rejected `4/3`.
- Risk: low (pure).

### Phase 2b — `utils/restFill.ts`: meter-aware, exact, per-voice fill
**Goal:** replace float 4/4-biased filler with hierarchy-driven exact decomposition.
```ts
function fillRests(start: Fraction, end: Fraction, meter: MeterInfo):
  Array<{ beat: Fraction; duration: NoteDuration; dots: number }>
```
- Syncopation-free decomposition: from `current`, pick the **longest** (possibly dotted) rest
  whose span doesn't cross any boundary **stronger** than the one at `current`; emit; advance.
- Whole-bar shortcut **only when `barQuarters ≤ 4`**; otherwise decompose. Add a **measure-rest
  slot flag** ("fills the bar") for long empty bars.
- Compound: full felt-beat silence → dotted rest; 12/8 adjacent beats at a group edge →
  dotted-half.
- **Wiring (`ScoreModel.ts`):** `fillMeasureWithRests`/`fillGapsWithRests` call `fillRests`;
  add `voice` param (group `slots` by `voice ?? 0`, gap-fill each voice independently); delete
  float `createMusicalRests`/`getBeatUnit` (and its dead trailing branches). Emitted rests set
  `dots` + `actualDuration`.
- **Tuplet-gap-splitting stays in the caller.** `fillRests(start, end, meter)` is meter-aware
  but **tuplet-unaware** by design. The existing `fillGapsWithRests` logic that trims gaps to
  tuplet spans and splits a gap at a tuplet boundary (`ScoreModel.ts:600-624`) **must be kept**;
  `fillRests` is only ever called on spans already free of tuplets. Do not move tuplet logic
  into `fillRests`.
- **Second filler:** migrate `VexFlowRenderer.beatsToRestDurations` (the ghost-preview filler,
  §3.3) onto `fillRests` too, or the preview stays float/4-4-biased after the model is fixed.
- **Tests (heaviest):** every meter — empty bar, off-beat gap, gap crossing the 4/4 middle, gap
  across a compound beat boundary, 5/8 & 7/8 partials, gaps adjacent to tuplets, measure-rest
  for `32/16`. Update the (incorrect) 4/4 baseline snapshots where the old output was wrong.
- Risk: med-high (algorithmic crux; isolated, table-driven tests).

### Phase 3 — Rendering: mode select + measure-rest + TS-glyph gating
**Goal:** render irregular/under/over-full bars; never silently swallow.
- Per-measure mode in width-calc (`:738`) and draw (`:981`) voices: `SOFT` if
  `ticksUsed > capacity`, else `FULL` (drop STRICT). Keep `try/catch` but log loudly (over-full
  under FULL now means real corruption).
- Render the measure-rest (VexFlow center/measure rest). **Spike first:** a whole-bar-centered
  rest in an *arbitrary-length* bar is not automatic in VexFlow 5 — validate the exact API
  (`StaveNote` `'wr'` + center alignment vs. a dedicated glyph) in ~30 min before sizing this.
- Gate `addTimeSignature` to measure 1 + change measures (engraving standard).
- **Mid-score TS glyph widens its measure** — reserve space exactly like the existing
  inline-clef width reservation, so `CoordinateMapper` bounds stay correct and click-to-beat
  isn't offset on the changed bar. Reuse the clef-change width path; don't invent a new one.
- Build the per-measure `VoiceTime` once (shared capacity) to avoid future `TickMismatch`.
- **Tests:** under-full bar renders without throwing under FULL; pickup-style short bar renders.
- Risk: low (measure-rest API is the only unknown — de-risked by the spike).

### Phase 4 — Meter-aware beaming
**Goal:** beams follow the meter's beat groups.
- `getBeatGroup(beat, MeterInfo)` returns the group index from `groups`/`boundaries`; thread
  `MeterInfo` through `createBeamGroups`/`buildBeams` (from `:989`). Honors 4/4 mid-bar rule and
  compound 3-groups generically. Explicit `BeamMode` overrides still win.
- **Do not regress the clef-beam decision:** beams stay beamed *across* mid-measure clef
  changes (see project memory / `docs/note-selection-hit-detection.md` companion decision).
  `buildBeams` already threads `clefForBeat`; switching grouping to `MeterInfo` must not start
  splitting beam groups at clef boundaries. Add a regression test for a beam spanning a clef
  change inside one beat group.
- **Tests:** beam-group partitions for 6/8, 9/8, 7/8 (2+2+3), 3/4, 4/4 mid-bar.
- Risk: low-med (visual; manual-tested).

### Phase 5 — `setTimeSignature` engine API
**Goal:** set a measure's TS with correct propagation and irregular-bar semantics. No UI.
- **Model:** add `Measure.timeSignatureChange?: boolean` (explicit-change marker; always true
  for measure 1). `measure.timeSignature` stays "TS in effect." Helpers
  `effectiveTimeSignature(score, n)`, `isTimeSignatureChange(measure)` in `utils/meter.ts`.
  Bump `schemaVersion` to 2; `fromJSON` migration marks measure 1 + any TS-difference measure.
  **Validate denominators on load:** `fromJSON` must reject (or clearly coerce) non-dyadic /
  out-of-range `TimeSignature`s — otherwise a corrupt file bypasses the Phase 2/Phase 5
  guards and detonates in the renderer. The `TimeSignature` type permits any integers, so the
  load boundary is the only place a bad meter can enter; guard it.
- **`ScoreModel.setTimeSignature(measureNumber, ts, options?)`:**
  1. mark change + set TS;
  2. **propagate forward** to each later measure until the next explicit change;
  3. per affected bar, per voice: rest-fill underflow; **keep overflow** (over-full →
     SOFT-rendered crowded bar, never trimmed);
  4. `options` reserved: `{ rewrite?: 'none'|'rebar'; extent?: 'measure'|'toNextChange'|'toEnd' }`,
     default `'none'`/`'toNextChange'`.
- `removeTimeSignatureChange(measureNumber)`; changing measure 1 / `defaultTimeSignature`.
  Reject non-dyadic. `MusicEngine.setTimeSignature` wrapper + `UndoRedoManager` integration.
- **Tests:** empty-bar set (3/4→6/8 propagation), set over notes (irregular over/under),
  propagation stops at next explicit change, JSON v1→v2 migration, undo/redo.
- Risk: medium.

### Phase 6 — Palette UI + arm/click interaction
**Goal:** preset time-signature palette mirroring the clef flow.
- `EditorState`: `selectedTimeSignature: TimeSignature | null` (+ optional armed preview).
- `PaletteController`/`usePalette`: `setTimeSignature(ts)` arm/disarm toggle (mirror
  `setClef:217`).
- `App.vue`: a Time Signature palette section (presets 4/4 3/4 2/4 2/2 6/8 9/8 12/8 5/8 7/8;
  start small with 4/4 3/4 5/8). Active-state styling like clef buttons.
- `MouseController`: armed + click → resolve measure (reuse `:349/505`) →
  `engine.setTimeSignature(measureNum, ts)`; optional ghost preview (mirror `renderClefGhost`);
  status feedback. TS always applies at beat 0.
- **Tests:** controller-level arm/click/disarm. UI visual = manual testing.
- Risk: low.

### Phase 6b — Custom time-signature dialog
**Goal:** the UI that exposes full generality (presets are just shortcuts).
- Numerator field, denominator dropdown (representable values), optional grouping (`2+2+3`).
  Validates via the engine contract (rejects non-dyadic). MuseScore/Dorico "Create Time
  Signature" pattern.
- Risk: low-med.

### Phase 7 — Voice-awareness scaffolding
**Goal:** ensure all new machinery is per-voice-ready (no multi-voice editing yet).
- Confirm fill/reconcile/render iterate `voice ?? 0`, each voice an independent stream summing
  to bar length. Render: one VexFlow voice per voice, shared capacity (avoid `TickMismatch`).
  `CollisionDetector` gains a `voice` param.
- **Tests:** synthetic two-voice measure fills each voice independently; renders without
  `TickMismatch`.
- Risk: low-med.

### Phase 8 — (Deferred) Rebar-with-ties + pickup/anacrusis
**Goal (future):** the Sibelius/Finale/MuseScore default — rewrite following music across new
barlines with tie-splitting + forward overflow, bounded to next TS change / end; plus
anacrusis (nominal-vs-actual bar length via `Measure.actualDurationOverride?: Fraction`,
renderable thanks to Phase 3's non-strict mode). Large, self-contained follow-up.
- **Heads-up for the implementer:** tie-splitting will lean on `splitBeatsIntoDurations` /
  `beatsToDuration` (`musicUtils.ts`), which are **float + epsilon and meter-agnostic** (greedy
  largest-first, no syncopation rules) — they violate the "internal unit stays `Fraction`"
  invariant. Plan to replace them with a `Fraction`-exact, `MeterInfo`-aware splitter here;
  don't inherit their float rounding into rebar.

---

## 7. Generality test matrix

Beyond the 3 preset test meters, Phases 2/2b must pass: `32/16`, `16/4`, `15/8`, `13/16`,
`7/4`, `2/2`, additive `3+2+2/8`, a generated-fallback meter, and a rejected non-dyadic `4/3`
— proving the algorithm, not a lookup table.

---

## 8. Cross-cutting notes
- **Playback** (`PlaybackEngine.ts`) already uses `getMeasureDuration` — verify it stays
  consistent (quarter = tempo unit) through phases 1–7; no change expected.
- **No commits/pushes** without explicit permission. Run `npm run test` + `npm run build:check`
  at each phase boundary.
- **Sequencing rationale:** 0–4 are non-UI correctness (verifiable via tests); 5–7 add the
  feature; 8 is the heavy follow-up. Each phase leaves the app working.

---

## 9. Progress

- [x] Phase 0 — Guardrails + duration centralization
  - New `src/utils/durations.ts` is the single source of truth: one exhaustive
    `Record<NoteDuration, {beats, fraction, vex}>` (`DURATION_INFO`) feeding
    `durationToBeats`/`durationToFraction`/`durationToVexflow`/`beatsToDuration`/
    `splitBeatsIntoDurations`/`tupletNoteDurationFraction` + `DURATIONS_DESC`.
  - `fraction.ts` is now pure rational arithmetic (duration maps moved out;
    importers in CollisionDetector/MusicEngine/NoteEntryCoordinator/ScoreModel
    repointed). `musicUtils.ts` re-exports the duration helpers for back-compat
    and gains `getMeasureDurationFrac(ts): Fraction`.
  - `VexFlowRenderer.convertDuration` → `durationToVexflow`; its private float
    `durationToBeats` map removed. `beatsToRestDurations` left for Phase 2b.
  - `ScoreModel.fillGapsWithRests` uses `getMeasureDurationFrac` (was the lossy
    `Math.round(totalBeats*8)/8`).
  - Verified: adding a member to `NoteDuration` is now a single compile error at
    `DURATION_INFO`. Tests: `durations.test.ts` (table consistency + bar-length
    matrix incl. 9/8→9/2, 5/8→5/2, 13/16, 32/16) and `restFill.baseline.test.ts`
    (4/4 rest-fill snapshots to be updated by Phase 2b). 335 unit tests pass;
    `build:check` clean.
- [x] Phase 1 — Coordinate correctness
  - Audit-driven (`grep -rn numerator src`). Replaced every `beatsInMeasure =
    timeSignature.numerator` *assignment* with `getMeasureDuration(ts)` (quarter-beat
    bar length) and renamed the threaded param `beatsInMeasure → barQuarters`.
  - **Fixed (were bugs for non-/4):** `NoteEntryCoordinator` ×2 (addNoteAtPosition,
    createTupletAtPosition), `MusicEngine` ×2 (`getNoteAtPosition`, ghost-preview
    `previewNoteAtPosition`) + its `pixelToPosition`/`getPositionFromPixels`/`noteToPixel`
    param rename, `MouseController` drag-pitch site, and **`VexFlowRenderer` ghost-preview**
    rest-fill (`totalBeats → barQuarters`; the VexFlow `Voice` keeps the literal
    `numBeats: numerator`/`beatValue: denominator` signature — only the rest math is quarters).
  - **Centralized (were already correct inline):** `MusicEngine.updateNote` overflow check,
    `MouseController` tuplet-mode site, `KeyboardController` — all now call `getMeasureDuration`.
  - **Param-threaded rename only:** `CoordinateMapper.beatToPixelX/noteToPixel/pixelXToBeat/
    pixelToPosition` (`beatsInMeasure → barQuarters`, JSDoc updated to "quarter-note beats").
  - **Untouched (correctly):** real-render `Voice` `numBeats: numerator` (`:720/:963`),
    `addTimeSignature` glyph strings, and `buildBeams(..., numerator, ...)` (Phase 4 rework).
  - Tests: new `CoordinateMapper.test.ts` "barQuarters (non-4/4 meters)" block — 3/4, 6/8, 2/2
    round-trips (bar-center → correct quarter-beat) + clamp-to-barQuarters. 344 unit tests pass
    (+9); `build:check` clean. No 4/4 behavior change (numerator === barQuarters there).
- [x] Phase 2 — `utils/meter.ts` metric-hierarchy generator
  - New `src/utils/meter.ts` (pure; depends only on `fraction.ts` + types). Exports
    `getMeterInfo(ts, grouping?) → MeterInfo` ({numerator, denominator, barQuarters,
    isCompound, beatUnit, groups: Fraction[], boundaries: {at,strength}[]}), `isDyadicMeter(ts)`,
    `meterBarQuarters(ts)`, and the `STRENGTH` constants (bar 6 > halfBar 5 > group 4 > …).
  - **No tables.** `isCompound = num%3===0 && num>3 && denom>=8`. Default grouping (denominator
    units): compound → 3s; simple denom≤4 → 1s; simple denom≥8 → quarter-pulses when the
    numerator divides, else 2s with the odd leftover merged into a final 3 (5/8→2+3, 7/8→2+2+3,
    13/16→2+2+2+2+2+3). Additive override via `grouping` arg (validated to sum to numerator).
    beatUnit = group length when groups are uniform, else the bare denominator unit.
  - **Boundaries** built by walking groups then subdividing (ternary at a 3-unit compound beat,
    binary below) down to the 32nd grid; a group boundary on the bar midpoint is elevated to
    `halfBar` (so 4/4, 2/2, 12/8 won't let rests/beams cross the metric centre). Strengths are
    relative, not absolute.
  - **Documented cut (not a bug):** compound gated at denom≥8, so 6/4, 9/4, 12/4 are *simple*.
  - Validation: non-dyadic (4/3) and finer-than-32nd (denom 64) and non-positive/non-integer
    numerators are rejected (`getMeterInfo` throws; `isDyadicMeter` returns false).
  - Tests: `meter.test.ts` — full generality matrix (4/4, 3/4, 2/2, 6/8, 9/8, 12/8, 5/8, 7/8,
    32/16, 16/4, 15/8, 13/16, 7/4, additive 3+2+2/8, fallback 11/8, rejected 4/3) + strength
    hierarchy + groups-sum-to-bar. 374 unit tests pass (+30); `build:check` clean. Not yet
    imported anywhere (Phase 2b/4 consume it) → no user-facing change.
- [ ] Phase 2b — `utils/restFill.ts` meter-aware fill
- [ ] Phase 3 — Rendering mode + measure-rest + TS-glyph gating
- [ ] Phase 4 — Meter-aware beaming
- [ ] Phase 5 — `setTimeSignature` engine API
- [ ] Phase 6 — Palette UI + interaction
- [ ] Phase 6b — Custom time-signature dialog
- [ ] Phase 7 — Voice-awareness scaffolding
- [ ] Phase 8 — (Deferred) Rebar-with-ties + pickup
