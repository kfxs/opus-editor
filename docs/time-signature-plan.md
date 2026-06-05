# Time Signature — Implementation Plan

Status: **Phases 0–8 complete.** The full engine (Phases 0–5) is user-reachable via the
time-signature palette (Phase 6) + custom-meter dialog with additive grouping (Phase 6b); the
data/model layer is per-voice-ready (Phase 7 — the multi-voice *render loop* is still deferred to a
future voice phase, with the extension point documented); and a meter change now **re-bars** the
following music with ties + forward overflow by default (Phase 8 — `utils/rebar.ts`). Remaining:
**Phase 9** (pickup / anacrusis bars) is the deferred follow-up. This document is the authoritative
plan and cross-session checklist.

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

### Phase 8 — Rebar-with-ties (DONE) — default rewrite on meter change
**Goal:** the Sibelius/Finale/MuseScore default — a meter change rewrites the following music
across moved barlines, splitting straddling notes with **ties** and flowing overflow forward
(bounded to the next TS change / end). Rebar is the **default**; the old keep-crowded behaviour
is the `rewrite: 'none'` fallback. Built per-voice-stream (voice 0 only today). Three sub-phases:
- **8a** — extracted `decomposeSpan(start, end, meter)` from `fillRests` (`utils/restFill.ts`):
  the `Fraction`-exact, syncopation-free decomposer shared by rest-fill and note-splitting (no
  measure-rest shortcut for notes). **Deliberately does NOT use** the float
  `splitBeatsIntoDurations` / `beatsToDuration` (`musicUtils.ts`).
- **8b** — new pure `utils/rebar.ts`: `flattenRegion(measures, voice)` (region → absolute event
  stream; collapses tie chains, tuplets are atomic events captured from `measure.tuplets`, plain
  rests become gaps) + `relayEvents(events, meter, {targetBars, bounded})` (re-lay into new-length
  bars, split straddling notes via `decomposeSpan` with fresh tie topology, rest-fill gaps).
  Unbounded regions grow / keep trailing rest bars; bounded fold overflow into the last bar (SOFT).
- **8c** — `ScoreModel.setTimeSignature` gains `rewrite?: 'rebar' | 'none'` (default `'rebar'`);
  `rebarRegion` flattens the region (old meter) before re-meter, relays, materialises pieces into
  slots/tuplets with real `tiedTo`/`tiedFrom`, appends grown bars. Undo works via the snapshot.
- **Limitations (documented):** tuplets stay atomic (a straddling tuplet renders crowded, never
  tie-split); mid-bar clef changes anchored to a moved beat are dropped (`measure.clefs` cleared
  on a rebar'd bar) — full remap is future; multi-voice render still deferred; pickup → Phase 9.
- **Tie integrity:** re-barring regenerates the region's slot ids, which would orphan a tie that
  *crosses the region boundary* (a note before/after pointing in). `rebarRegion` now **preserves**
  such ties: `captureBoundaryTies` records them before the rebar, `restoreBoundaryTies` re-attaches
  each to the rebar'd note at the same boundary position/pitch (`boundaryPitchId` + `linkTieById`).
  Anything genuinely unrestorable (pitch no longer present) is then **severed** by
  `repairDanglingTies` so no pointer dangles — a dangling `tiedTo`/`tiedFrom` otherwise crashed tie
  editing (`updateNote` throws on a missing id). `MusicEngine.toggleTie` is also hardened to skip a
  missing tie target.

### Phase 9 — (Deferred) Pickup / anacrusis bars
**Goal (future):** bars whose **actual length < nominal** (`Measure.actualDurationOverride?:
Fraction`), renderable thanks to Phase 3's non-STRICT mode. Honour the override in rest-fill,
rebar (`relayEvents` bar length), coordinate mapping, and a UI affordance to create a pickup bar.
Split out of Phase 8 per the user.

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
- [x] Phase 2b — `utils/restFill.ts` meter-aware fill
  - New pure `src/utils/restFill.ts`: `fillRests(start, end, meter) → RestSlot[]`
    ({beat, duration, dots, isMeasureRest?}). Greedy longest-first; a rest may span
    `[p,q)` only when `maxInteriorStrength(p,q) ≤ min(strength(p), strength(q))` (end-of-bar
    treated as `STRENGTH.bar`). Candidate shapes = every NoteDuration × {0,1} dots that lands
    on the 32nd grid (dotted-32nd excluded). Verified to reproduce the 4/4 baselines AND give
    correct compound (6/8 dotted-quarter, 12/8 dotted-half split at mid) and irregular (5/8,
    7/8) decompositions.
  - **Measure rest:** a whole empty bar (start 0, end barQuarters) returns ONE
    `{duration:'w', isMeasureRest:true}` in *every* meter (deviation from the plan's
    "shortcut only when ≤4 / decompose otherwise" — a whole empty bar is always a measure
    rest conceptually; cleaner and forward-correct, Phase 3 renders it centred). For 4/4 this
    is duration 'w' = identical render today. New `Rest.isMeasureRest?` field added
    (`types/music.ts`); measure rests store the true bar length as `actualDuration`.
  - **Wiring (`ScoreModel`):** deleted float `createMusicalRests`/`getBeatUnit`/
    `getMeasureTotalBeats` + the `WHOLE_NOTE_IN_QUARTERS` const. `fillMeasureWithRests` and
    `fillGapsWithRests` now use `getMeterInfo` + `fillRests` via a `pushRestSlot` helper.
    `fillGapsWithRests` is now **per-voice** (groups slots by `voice ?? 0`, gap-fills each
    independently, records `voice` only when ≠ 0). Tuplet-gap skip/trim logic kept in the
    caller (fillRests stays tuplet-unaware).
  - **Second filler migrated:** `VexFlowRenderer.beatsToRestDurations` deleted; the ghost-note
    preview now builds its surrounding rests via `fillRests` (and correctly accounts for the
    ghost note's dots — a latent 4/4 over-fill on dotted-note previews is now fixed).
  - Tests: `restFill.test.ts` — measure rest per meter, 4/4 no-cross-middle, off-beat realign,
    6/8/12/8 compound, 5/8/7/8 irregular, sum-to-gap invariant. 393 unit tests pass (+19);
    `build:check` clean. 4/4 baseline unchanged (no regression in the only reachable meter).
- [x] Phase 3 — Rendering mode + measure-rest + TS-glyph gating
  - **Spike done:** VexFlow 5 `NoteStruct` exposes `alignCenter?: boolean` (and
    `durationOverride?: Fraction`). Measure rest = `new StaveNote({ keys:['b/4'],
    duration:'wr', alignCenter:true })`; drawn in a SOFT voice so the whole rest's fixed tick
    value never clashes with the bar capacity. `durationOverride` was not needed.
  - **Voice mode off STRICT:** new pure `pickVoiceMode(slots, barQuarters) → 'soft'|'full'` in
    `restFill.ts` — SOFT when a measure rest is present or the bar is over-full (keep notes,
    render crowded), else FULL (normal + under-full/pickup render; a true over-tick still
    surfaces). Applied at BOTH render voices (width-calc ~:701 and draw ~:944) via a thin
    `VexFlowRenderer.chooseVoiceMode` wrapper. STRICT (the old default that silently swallowed
    irregular bars into the MIN_MEASURE_WIDTH fallback) is no longer used.
  - **Measure rest rendered:** `createStaveNotesFromSlots` emits the centred whole rest for an
    `isMeasureRest` slot. (Visible 4/4 change: an empty bar's whole rest is now centred.)
  - **TS-glyph gating** already correct: `addTimeSignature` is drawn only at `measure.number
    === 1`. Extending to per-measure change bars + reserving mid-score TS-glyph width (reuse
    the inline-clef width path) is deferred to Phase 5, when the change marker exists — nothing
    to reserve width for yet. Shared per-measure VoiceTime (TickMismatch guard) is a Phase 7
    multi-voice concern.
  - Tests: `pickVoiceMode` cases (full / under-full / over-full / measure-rest) in
    `restFill.test.ts`. 397 unit tests pass (+4); `build:check` clean. (Render correctness for
    irregular/over-full bars is visual — manual-tested once meters are reachable in Phase 6.)
- [x] Phase 4 — Meter-aware beaming
  - New pure `src/utils/beaming.ts` (depends only on `fraction.ts` + `meter.ts` + types).
    Exports `getBeatGroup(beat, MeterInfo)`, `isBeamableDuration(duration)`, and
    `computeBeamGroups(slots, meter) → number[][]` (slot-index groups, ≥2 members each).
  - `getBeatGroup` replaces the old `Math.floor(beat)`: partitions the bar by the cumulative
    starts of `meter.groups` (`groupStart[i] ≤ beat < groupStart[i+1]`), so 4/4 still beams per
    quarter (identical to before), 6/8 → 3+3, 9/8 → 3+3+3, 12/8 → 4×3, 7/8 → 2+2+3. Over-full
    beats past the bar end get one distinct index per overflow quarter (crowded SOFT bars don't
    merge overflow notes into the last in-bar group). Exact (Fraction-based, no float epsilon).
  - `computeBeamGroups` lifts the full grouping logic out of the renderer verbatim (rest break,
    non-beamable break, explicit `BeamMode` begin/continue/end/single overrides, auto
    beat-boundary grouping) — now pure and unit-testable. `VexFlowRenderer.createBeamGroups` is a
    thin wrapper that maps the returned indices back onto its parallel `StaveNote[]`;
    `buildBeams`/`createBeamGroups` now thread `MeterInfo` (built once per measure, shared with
    `chooseVoiceMode`) instead of `numBeats`. Deleted the renderer's private `getBeatGroup` +
    `isBeamableDuration`.
  - **Clef-beam decision preserved:** grouping is purely metric — `computeBeamGroups` takes no
    clef, so a beam group cannot split at a mid-measure clef change (clef still only sets stem
    direction in `buildBeams`). Anchored by a regression test.
  - Tests: `beaming.test.ts` — getBeatGroup (4/4, 6/8, overflow), default partitions (4/4 per
    quarter + four-16ths, 3/4, 6/8, 9/8, 7/8 2+2+3, 12/8), breaks (rest, quarter, lone eighth),
    explicit overrides (single, begin/end + begin/continue/end bridge), and the clef-change
    regression. 416 unit tests pass (+19); `build:check` clean. 4/4 beaming unchanged.
- [x] Phase 5 — `setTimeSignature` engine API
  - **Model marker:** added `Measure.timeSignatureChange?: boolean` (types/music.ts). `addMeasure`
    sets it true for measure 1; `measure.timeSignature` stays "TS in effect" (propagated).
    Helpers in `utils/meter.ts`: `isTimeSignatureChange(measure)`, `effectiveTimeSignature(score,
    n)` (walks back to the nearest explicit change → that change's TS, else default — change
    markers are authoritative), `sameTimeSignature(a,b)`.
  - **`ScoreModel.setTimeSignature(measureNumber, ts, options?)`:** validates dyadic (throws
    otherwise); no-ops when re-applying the same signature+marker; marks the change, sets the TS
    (measure 1 also updates `score.defaultTimeSignature`), reconciles rests, then propagates
    forward to each later measure until the next explicit change (`propagateTimeSignature`).
    `options.extent` = `'toNextChange'` (default) | `'measure'`. `removeTimeSignatureChange(n)`
    reverts a change (and its region) to the inherited signature; measure 1 can't be removed.
  - **Rest reconcile (`reconcileMeasureRests`):** drops plain (non-tuplet) rests, keeps chords +
    tuplet-owned rests, re-runs the per-voice meter-aware `fillGapsWithRests`. Under-full bars
    gain trailing rests; **over-full bars keep every note** (no truncation; SOFT render handles
    the crowding). True rebar-with-ties stays Phase 8.
  - **JSON v1→v2 (`fromJSON`):** bumped `schemaVersion` to 2; `validateMeters` rejects non-dyadic
    default/per-measure signatures at the load boundary (the only place a bad meter can enter);
    v1 migration derives change markers (measure 1 + any measure whose TS differs from the prior
    one). `computeActualDurationForSlot` is now measure-rest-aware (whole-bar length in every
    meter, not the nominal `'w'`), fixing non-4/4 measure-rest round-trips everywhere (not just on
    load).
  - **`MusicEngine` wrappers:** `setTimeSignature` / `removeTimeSignatureChange` → model call +
    `playbackEngine.setScore` + `saveUndoState`; undo/redo is snapshot-based so it works
    automatically.
  - **Deferred to Phase 6 (visual, not eyeball-testable until meters are reachable):** drawing the
    TS glyph at mid-score change measures + reserving its width (reuse the inline-clef width path).
    Phase 3 had tentatively parked this "in Phase 5"; moved to Phase 6 to keep Phase 5 a clean,
    test-verified engine layer.
  - Tests: `ScoreModel.test.ts` (+ empty-bar resize, reject non-dyadic, no-op, 3/4→6/8
    propagation, propagation stops at next change, under-full trailing rests, over-full keeps
    notes; removeTimeSignatureChange revert/guard; v1→v2 marker derivation, load validation ×2,
    non-4/4 measure-rest round-trip) and `MusicEngine.test.ts` (set + undo/redo + remove).
    433 unit tests pass (+17); `build:check` clean.
- [x] Phase 6 — Palette UI + interaction (first user-reachable meters)
  - **Renderer (the piece deferred from Phase 3/5):** new `drawsTimeSignature(measure)` =
    `measure.number === 1 || measure.timeSignatureChange === true`. Wired into all four TS-glyph
    sites — width reservation (`calculateMinimumMeasureWidth` adds `TIME_SIG_WIDTH`), the real
    draw (`renderMeasureStave`), the element-registry bbox (positioned after the measure's clef
    glyph via a clef-width offset), and the ghost-note preview temp stave (keeps note alignment on
    change measures). Mid-score TS changes now render their glyph and reserve space.
  - **State:** `EditorState.selectedTimeSignature: TimeSignature | null` (armed meter; suppresses
    the ghost note when set, mirroring `selectedClef`).
  - **PaletteController.setTimeSignature(ts):** arm/disarm toggle (re-click same meter disarms, via
    `sameTimeSignature`), switches to the entry tool, clears the note selection, and is mutually
    exclusive with the clef tool. Cleared in `setDuration` + `resetToDefaults` alongside
    `selectedClef`.
  - **MouseController:** armed + click → `engine.setTimeSignature(measureNum, ts)` (always beat 0;
    propagation + rest reconcile handled by the engine), wrapped in try/catch (a rejected meter
    logs, never throws to the UI); re-renders.
  - **Ghost TS preview** (parity with the clef tool): `renderScoreWithTimeSignatureGhost` draws the
    TS glyph on a 0-line stave wrapped in `.ghost-timesig-group` (CSS-tinted translucent blue),
    centred on the cursor; threaded MusicEngine → RenderController → MouseController hover path,
    which hides the keyboard cursor while armed. (Initially skipped as "optional"; added after the
    plain-cursor showed instead of a preview.)
  - **App.vue:** a "Time:" palette section with presets 4/4 3/4 2/4 6/8 9/8 5/8 7/8 (simple /
    compound / irregular for testing), cyan active-state like the clef buttons; `timeSignaturePresets`
    + `isTimeSignatureArmed` helpers in script setup. Presets are shortcuts — the engine accepts any
    dyadic meter (custom-entry dialog = Phase 6b).
  - **Measure-rest bugfixes (latent Phase 2b bugs, only reachable now):**
    1. *Editing a measure rest* (`ScoreModel.updateNote`): giving a measure rest a specific
       duration/dots/beat now clears `isMeasureRest`, so it stops rendering as a centred whole rest
       and stops claiming the whole bar length. (Before: the flag persisted, the new value was drawn
       as the old centred whole rest, and the bar stayed over-full.)
    2. *Refill after shortening a rest* (`MusicEngine.updateNonTupletNote`): a shortened **rest**
       now refills the bar via the meter-aware `ScoreModel.fillMeasureGaps` (new public wrapper over
       `fillGapsWithRests`) instead of the legacy float `splitBeatsIntoDurations`. Fixes the bar
       **size** (a measure rest's nominal `'w'` is 4 quarters, not the real bar length → non-4/4
       bars were over/under-filled) **and** rest grouping in compound/irregular meters. Note
       shortening still uses the legacy path (Phase 8).
  - Tests: `PaletteController.test.ts` (arm/toggle/replace/clef-exclusion/duration-disarm/reset);
    `ScoreModel.test.ts` + `MusicEngine.test.ts` measure-rest regressions (flag cleared, resized,
    no leftover whole rest, non-4/4 bar sums to the true length). 443 unit tests pass (+10);
    `build:check` clean. UI/visual = manual (user-tested: presets apply, compound beaming/rest-fill
    correct, propagation, over-full keeps notes, undo/redo).
- [x] Phase 6b — Custom time-signature dialog (full generality exposed)
  - **Grouping is now stored on the meter:** added `TimeSignature.grouping?: number[]` (additive
    group sizes in denominator units, e.g. `[2,2,3]` for 2+2+3 / 8). `getMeterInfo(ts, grouping =
    ts.grouping)` defaults to the stored grouping, so all 6 existing call sites honour it with **no
    change** — beaming + rest-fill follow a custom grouping automatically.
  - **meter.ts helpers:** `isValidGrouping(grouping, numerator)` (positive ints summing to the
    numerator; undefined/empty = use default) and `isValidTimeSignature(ts)` (dyadic AND valid
    grouping). `sameTimeSignature` now also compares grouping (so changing only the grouping isn't
    a no-op, and the palette toggle distinguishes variants).
  - **Model:** `setTimeSignature` validates with `isValidTimeSignature` (throws on bad grouping);
    a new `copyTimeSignature` helper deep-copies the grouping array at every store/propagate site;
    `validateMeters` (load boundary) rejects an invalid grouping too.
  - **UI (App.vue):** a "Custom…" button opens a modal with numerator field, denominator dropdown
    (1–32), and an optional grouping text field (`2+2+3` / `2,2,3` / `2 2 3`). Live validation
    (`tsDialogError`) disables Arm on a bad meter; Arm calls `palette.setTimeSignature(ts)` to arm
    the custom meter (then click a measure to apply, same flow + ghost preview as presets). The
    Custom button shows armed (cyan) when a non-preset meter is armed.
  - **Known limitation (documented):** the rendered TS glyph shows `numerator/denominator` only;
    the additive grouping is reflected in beaming/rest-fill, not in the glyph (no `2+2+3` numerator
    display). Acceptable for now.
  - Tests: meter.test.ts (isValidGrouping / isValidTimeSignature / sameTimeSignature-with-grouping
    / getMeterInfo honours ts.grouping / rejects bad sum); beaming.test.ts (8/8 [3,3,2] → 3+3+2);
    ScoreModel.test.ts (stores + deep-copies grouping, rejects invalid, grouping-only change is not
    a no-op). 453 unit tests pass (+8); `build:check` clean. UI/visual = manual.
- [x] Phase 7 — Voice-awareness scaffolding (data/model layer; render loop deferred)
  - **Scope:** voices are NOT implemented (no multi-voice editing) — this makes the data/model
    layer per-voice-*ready* so a future voice phase can't silently corrupt cross-voice streams.
    Only voice 0 is ever populated today, so every change below is a no-op (`0 === 0`) for the
    current single-voice path.
  - **Types:** added `voice?: 0|1|2|3` to the flat `Note` and to `NoteParams` (the model `Chord`/
    `Rest` already had it). `toFlatNote`/`restToFlatNote` now carry `voice` through.
  - **CollisionDetector is voice-scoped:** `checkNoteCollision` and `getAffectedNotes` skip notes
    in a different voice (`(n.voice ?? 0) !== newVoice`) — independent streams never collide.
  - **addNote is voice-scoped:** the existing-chord lookup matches same beat AND voice; the new
    chord/rest carry `params.voice`; `replaceRestsWithChord` only removes overlapping rests **in
    the same voice** (other voices' rests are preserved).
  - **Rest-fill already per-voice** (Phase 2b's `fillGapsWithRests` groups by `voice ?? 0`);
    confirmed + tested (a voice-1 note fills voice 1 independently without touching voice 0).
  - **Renderer per-voice loop DEFERRED** (display-only, untestable without real voice data, and
    risky to the well-tested single-voice render). The shared-capacity foundation is already
    there (the VexFlow `Voice` uses `numBeats/beatValue` from the TS); a code comment at the voice
    site documents the exact extension point (group slots by `voice ?? 0`, one Voice per group
    sharing capacity, `joinVoices` to avoid `TickMismatch`). Build this with the voice phase.
  - Tests: `CollisionDetector.test.ts` (cross-voice no-collision, same-voice duplicate, undefined=0,
    getAffectedNotes voice filter); `ScoreModel.test.ts` (per-voice independent fill; adding a
    voice-1 note doesn't disturb voice 0). 459 unit tests pass (+6); `build:check` clean.
- [x] Phase 8 — Rebar-with-ties (default rewrite on meter change)
  - **8a** — `decomposeSpan(start, end, meter)` extracted from `fillRests` in `utils/restFill.ts`
    (shared `Fraction`-exact, meter-aware decomposer; no measure-rest shortcut for notes). Rests
    unchanged (baselines locked). Tests: `restFill.test.ts` "decomposeSpan — note-oriented" block.
  - **8b** — new pure `utils/rebar.ts`. `flattenRegion(measures, voice=0)`: region measures →
    ordered absolute event stream — plain rests dropped (gaps), tie chains collapsed into one
    logical note, tuplets captured atomically from `measure.tuplets` (robust to empty/partial
    tuplets), offsets advance by `max(nominal, occupied)`; events sorted by offset before collapse.
    `relayEvents(events, meter, {targetBars, bounded})`: re-lay into new-length bars, split at
    barlines + via `decomposeSpan`, generate `tieFromPrev`/`tieToNext` topology, rest-fill gaps;
    unbounded → `max(needed, target)` bars (grow / trailing measure rests), bounded → exactly
    `target` (overflow folded into last bar, crowded/SOFT). Tests: `rebar.test.ts` (relay +
    flatten).
  - **8c** — `ScoreModel.setTimeSignature` adds `rewrite?: 'rebar' | 'none'` (default `'rebar'`);
    `rebarRegion` resolves region via the propagate boundary + `bounded` flag, flattens (old
    meter) BEFORE re-meter, relays, then `materializeBar` / `materializeAtomicPiece` build slots +
    tuplets (fresh ids, `structuredClone` for atomic payload) and `linkRebarTies` wires per-pitch
    `tiedTo`/`tiedFrom`; grown bars appended via `addMeasure`. `MusicEngine.setTimeSignature`
    threads the option; undo/redo works via the existing snapshot. The MouseController/UI now
    re-bars by default. Tests: `ScoreModel.test.ts` (rebar moves overflow, tie split, `'none'`
    crowded, tuplet intact) + `MusicEngine.test.ts` (undo of a rebar). 485 tests pass; build clean.
  - **Limitations:** tuplets atomic (straddling tuplet not tie-split); mid-bar clefs on a rebar'd
    bar dropped (`measure.clefs` cleared); multi-voice render deferred; pickup = Phase 9.
- [ ] Phase 9 — (Deferred) Pickup / anacrusis (`Measure.actualDurationOverride`)
