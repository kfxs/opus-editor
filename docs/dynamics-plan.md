# Dynamics — Implementation Plan

Status: **ALL PHASES (0–7) DONE.** Dynamics are placeable (arm p/mp/mf/f or Text → click a beat), render under the staff (level glyph or italic serif text), drive playback (per-voice velocity step function), and are selectable + deletable (click in selection mode → Delete) with a scoped highlight; undo/redo + JSON round-trip throughout; voice-ready end-to-end (only voice 0 populated, single hardcoded seam at placement). **Deferred by user (not blockers):** (1) in-place editing of a placed dynamic — custom text drops a literal "Text" placeholder for now; (2) finer-beat placement — target is option C (slot-snap-else-grid); both are cheap + migration-free later. This document is the authoritative plan and cross-session checklist.

Goal of this first pass is to **build the infrastructure**, not a complete dynamics vocabulary.
Scope: `p`, `mp`, `mf`, `f` as interpreted (playback-affecting) dynamics, plus a **custom italic
text** dynamic that the user can type/edit and that is *not* interpreted by the audio engine. The
design must (a) let new standard dynamics (`ppp`…`fff`, `sf`, `sfz`, hairpins later) be added with
near-zero churn, and (b) be **voice-ready** from day one even though only voice 0 exists today.

---

## 1. Goal

Let the user place a dynamic marking under the staff at a rhythmic position. Standard marks
(`p/mp/mf/f`) drive **playback loudness**; a custom mark renders as **editable italic text** and is
silent (carries the previous level). The three concerns are kept on **independent axes** so the
feature scales:

1. **Symbol (glyph)** — what is drawn.
2. **Meaning (velocity)** — how loud it plays, via a standalone lookup table.
3. **Scope (voice)** — which rhythmic stream it governs, until the next dynamic in that stream.

Adding a future dynamic = one union member + one velocity-table row + (optionally) one palette
button. Adding voices later = no rework, because resolution is written per-voice from the start.

---

## 2. Industry research (MusicXML / MuseScore / Dorico / Finale / Sibelius)

Sources:
[MusicXML `<dynamics>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/dynamics/),
[MusicXML `<direction-type>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/direction-type/),
[MusicXML directions/dynamics tutorial](https://davidmatthew.ie/a-musicxml-tutorial-part-2-voices-staves-directions-and-dynamics/),
[MuseScore dynamics handbook](https://musescore.org/en/handbook/3/dynamics),
[MuseScore 4 dynamic velocity](https://musescore.org/en/node/340461),
[VexFlow TextDynamics](http://www.vexflow.com/build/docs/textdynamics.html),
[VexFlow Annotation](http://www.vexflow.com/build/docs/annotation.html).

### 2.1 Two attachment models (both supported everywhere)
- **Direction model (dominant):** MusicXML `<direction><direction-type><dynamics>` — anchored to a
  **rhythmic position in a measure**, carries `placement` (above/below) and a **`<voice>`/`<staff>`**
  so it knows which stream it governs. Dynamics, crescendo/dim *wedges* (`<wedge>`), and tempo
  *words* are all siblings under `<direction>` — one family of time-spanning, staff-adjacent marks.
- **Notation model:** `<notations><dynamics>` glued to a single note (placement attrs ignored there).

### 2.2 Naming convention
- MusicXML uses **the letters themselves** as enum names (`p`, `mp`, `mf`, `f`, `ff`…), plus a
  catch-all **`other-dynamics`** for free text, and notes that marks can be **combined** (`sfmp`).
  That is exactly the "escalate well + custom slot" shape we want.

### 2.3 Playback / velocity ("the sound engine understands it")
- A dynamic is a **step function over time, per voice/instrument**: it governs notes from where it
  appears **until the next dynamic in that voice** (or an all-voices dynamic).
- **MuseScore 3:** editable velocity 0–127 per dynamic. **MuseScore 4:** fixed internal
  symbol→velocity table (and CC2 for swells); user no longer edits per-mark velocity.
- **Custom text** dynamics contribute **no** loudness change — they carry the previous level.

**Takeaways for us:** model dynamics as **beat-anchored, voice-scoped directions**; keep a
**separate symbol→velocity table**; treat custom text as a non-interpreted glyph.

---

## 3. Codebase findings (why this slots in cleanly)

- **Perfect precedent: `Measure.clefs: ClefChange[]`** (`types/music.ts`). A `ClefChange` is
  `{ id, beat: Fraction, clef }` — a beat-anchored, measure-owned, selectable/deletable marking with
  resolution helpers in `utils/clefUtils`. A `Dynamic` is the same shape; **mirror it** rather than
  invent a new pattern. (`Measure.tuplets` and `clefs` show the array-on-measure idiom.)
- **Voice-readiness already exists:** `Note.voice` / `Chord.voice` / `Rest.voice` (default 0), and
  `ScoreModel.fillMeasureGaps` iterates per voice. A `Dynamic.voice` field follows the same idiom and
  is a no-op today.
- **Articulations are the rendering precedent:** stored per-chord on the slot, added as VexFlow
  **modifiers** to the `StaveNote` (`VexFlowRenderer.ts:309-318`), and **registered** into the
  `ElementRegistry` with a bbox (`VexFlowRenderer.ts:1219-1240`). Dynamics can follow the same
  modifier + registry path.
- **Selection/delete precedent: Phase 11 of the time-signature work** — the TS glyph is a registered
  `ElementType`, hit-tested, selectable, and `Delete`-able via `useShortcuts.ts` + `state.selected…`.
  Dynamics reuse this machinery (`ElementRegistry.ts:17` union; `useShortcuts.ts:77-91` pattern).
- **Playback has a free velocity slot:** `PlaybackEngine.play()` calls
  `synth.triggerAttackRelease(noteName, durationInSeconds, time)` (`PlaybackEngine.ts:231`) with **no
  velocity**; Tone.js's 4th arg is velocity 0–1. Wiring dynamics is additive.
- **UI idiom: arm-then-click palette.** `usePalette.ts` + `useMouseInteraction.ts` already implement
  "arm a tool (clef / time signature), click on the score to place it." Dynamics add one more armed
  tool. (`App.vue` clef/TS buttons at lines ~280–310.)
- **Serialization:** `Score.schemaVersion === 2`; arrays are optional → old JSON loads with no
  dynamics. No breaking migration required.

---

## 4. VexFlow constraints

*Verified against the installed **VexFlow 5.0.0** source (`node_modules/vexflow/build/esm/src`), not docs.*

- **`TextDynamics`** (`textdynamics.js`) is, in v5, just a thin `Note` subclass that maps the letters
  `p/m/f/s/z/r` to SMuFL codepoints via a static table `TextDynamics.GLYPHS` (`{ f: dynamicForte,
  p: dynamicPiano, m: dynamicMezzo, s: dynamicSforzando, z: dynamicZ, r: dynamicRinforzando }`) and
  renders them in the music font. **It is a tickable `Note`, NOT a `Modifier`** — you cannot
  `staveNote.addModifier(new TextDynamics(...))`, and putting it in the music voice would disturb the
  strict tick-sum formatting the render loop depends on. **Do not use `TextDynamics` for the modifier
  path** — but **do reuse its glyph mapping** (or `Glyphs.*` directly) as the level→codepoint source.
- **The dynamics glyphs already exist as codepoints** in `glyphs.js`, including **precomposed**
  combinations — `dynamicMP` (), `dynamicMF` (), `dynamicPF`, `dynamicFF`…`dynamicFFFFFF`,
  `dynamicPP`…`dynamicPPPPPP`, plus the `sf`/`sfz` family (`dynamicSforzando`, `dynamicSforzato`,
  `dynamicSforzatoFF`, `dynamicForzando`, `dynamicRinforzando`…) and even `dynamicCrescendoHairpin` /
  `dynamicDiminuendoHairpin`. **So escalating the union to `ppp…fff`, `sf`, `sfz` is literally one
  codepoint per member** — concrete proof of the "near-zero churn" claim. Prefer the precomposed
  `dynamicMP`/`dynamicMF` glyphs over concatenating `m`+`p`.
- **`Annotation`** (`annotation.js`) is a `Modifier` and is the right vehicle for both kinds. Verified
  capabilities that matter here:
  - **It opens its own SVG group:** `draw()` calls `ctx.openGroup('annotation', this.getAttribute('id'))`,
    producing `<g class="vf-annotation" id="vf-<id>">`. Because every VexFlow `Element` exposes
    `getSVGElement()` (→ `document.getElementById('vf-'+id)`), a dynamic **is individually addressable
    by group** — exactly like notes/tuplets. This supersedes the bbox-scan highlight idea (see Phase 6).
  - **It participates in `ModifierContext` formatting** (`Annotation.format`): it reserves text lines
    and stacks below the staff alongside articulations, so dynamics + articulations **auto-avoid each
    other vertically** for free. A hand-rolled free-floating text element would lose this.
  - **`setVerticalJustification('below')`** places it under the staff (the default placement we want).
  - **It honours `setXShift`** (`draw()` renders at `this.x + this.xShift`; `format` doesn't clobber
    it), so a *relative* horizontal nudge is possible **within** the modifier path — relevant to the
    future X-drag (see §8).
  - **Font — and why this is font-agnostic.** The `Glyphs.*` codepoints are **SMuFL standard**
    (`dynamicPiano` = U+E520 in *every* SMuFL font), and VexFlow 5 resolves glyphs through a single
    **global font stack** (`MetricsDefaults.fontFamily`, default `'Bravura,Academico'`; the codebase
    currently sets nothing, so it uses this default). So a level dynamic stored as a codepoint renders
    in **whatever engraving font the score uses** — clefs, noteheads, and dynamics all follow the same
    global setting. **Do not hardcode `'Bravura'`** on the annotation; use the score's engraving
    font (inherit the global stack, or read it from one place if/when a font setting is added).
    Custom-text marks use the text-font fallback (also globally configurable). See §8 for the
    user-selectable-font implication. `getBoundingBox()` is available for registration.
- **Decision (Phase 4):** render dynamics as an **`Annotation` modifier attached to the
  `StaveNote`/rest at the anchor beat** (exactly like articulations). **Both kinds use `Annotation`** —
  level marks set the dynamics/music font + the letter glyph string (`p`/`mp`/…), custom marks set an
  italic text font. There is no second tickable and no tick accounting. A separate non-formatted
  dynamics voice is a *possible later refinement* if precise X-alignment under bare beats is needed —
  documented, not built.

---

## 5. Design invariants (non-negotiable)

1. **Three independent axes:** glyph (`Dynamic.kind/level/text`), meaning
   (`utils/dynamics.ts` velocity table), scope (`Dynamic.voice`). No axis hardcodes another.
2. **No hardcoded dynamic list outside the type + the velocity table.** Renderer, playback, and
   palette derive from those two sources.
3. **Per-voice from the start.** Every resolution/iteration keys on `voice ?? 0`. Single-voice today
   collapses to one global timeline — correct now, correct later.
4. **Custom text is never interpreted** by playback (velocity = inherit). It is the only editable
   text field.
5. **Beat-anchored within a measure** (like clefs), not glued to a note id — so a dynamic can sit
   under a rest/empty beat. **Caveat:** "survives the engine's note moves the same way clefs do"
   includes the clef *limitation* — `ScoreModel.materializeBar` does `delete measure.clefs` on any
   rebar (`ScoreModel.ts:687`), so beat anchors do **not** survive a re-bar. Dynamics inherit the
   same policy; see Phase 1 for the explicit rebar rule.
6. **Backward-compatible JSON.** `Measure.dynamics?` optional; absence = no dynamics.

---

## 6. Data model (target shape)

In `types/music.ts`, mirroring `ClefChange`:

```typescript
/** Interpreted dynamic levels. EXTEND THIS UNION to add ppp…fff, sf, sfz, … */
export type DynamicLevel = 'p' | 'mp' | 'mf' | 'f'

export interface Dynamic {
  id: string
  beat: Fraction                 // slot-boundary beat within the measure
  kind: 'level' | 'text'         // 'level' = interpreted; 'text' = custom italic
  level?: DynamicLevel           // when kind==='level'
  text?: string                  // when kind==='text' (user-editable, silent)
  voice?: 0 | 1 | 2 | 3          // governed stream; default 0
  placement?: 'above' | 'below'  // default 'below'
}
```

On `Measure`, alongside `clefs?: ClefChange[]`:

```typescript
dynamics?: Dynamic[]   // sorted ascending by beat (per the clefs convention)
```

In `utils/dynamics.ts` (the single source of meaning):

```typescript
export const DYNAMIC_VELOCITY: Record<DynamicLevel, number> = {
  p: 0.40, mp: 0.55, mf: 0.70, f: 0.85,   // Tone.js normalized velocity 0..1 (4th arg of triggerAttackRelease)
}
export const DEFAULT_DYNAMIC: DynamicLevel = 'mf'   // before any mark
```

---

## 7. Phased plan

The cut line: the model/engine is correct and serialized by **Phase 2**, audible by **Phase 3**,
visible by **Phase 4**, user-placeable by **Phase 5**, and editable/deletable by **Phase 6**.

### Phase 0 — Types + velocity table (foundation, no behavior)
- Add `DynamicLevel`, `Dynamic` to `types/music.ts`; add `dynamics?: Dynamic[]` to `Measure`.
- Create `utils/dynamics.ts` with `DYNAMIC_VELOCITY`, `DEFAULT_DYNAMIC`, and helpers:
  - `dynamicLabel(d: Dynamic): string` — glyph/text to display.
  - `isInterpreted(d: Dynamic): d is Dynamic & { level: DynamicLevel }`.
- No consumers yet → no user-facing change. Unit-test the helpers.

### Phase 1 — ScoreModel CRUD + per-voice resolution
- `ScoreModel` methods (mirroring `setClefAt` / `removeClefAt`):
  - `addDynamic(measureNumber, dynamic): Dynamic` — insert into `measure.dynamics`, keep sorted,
    one dynamic per (beat, voice) (replace if present).
  - `updateDynamic(id, updates): Dynamic` — edit level/text/placement.
  - `removeDynamic(id): boolean`.
  - `getDynamics(measureNumber): Dynamic[]`.
- **Resolution helper** (the voice-ready core), in `utils/dynamics.ts`:
  - `resolveActiveLevel(score, measureNumber, beat, voice): DynamicLevel` — last interpreted dynamic
    at-or-before (measure,beat) in that voice, else `DEFAULT_DYNAMIC`. Text dynamics are skipped
    (they don't change level). Walk-back across earlier measures mirrors `clefUtils.inheritedClef`
    (`clefUtils.ts:21`). This is the *correctness* reference; playback uses an incremental scan
    instead (Phase 3) to avoid per-chord walk-back.
- **Rebar policy (must decide here, mirroring clefs):** `ScoreModel.materializeBar` rebuilds a
  measure's `slots` and does `delete measure.clefs` (`ScoreModel.ts:687`) on every meter change /
  rebar-with-ties. It does **not** currently touch `measure.dynamics`, so stale dynamics would be
  left anchored to beats that no longer match any slot (the renderer would then silently drop or
  misattach them). **Add `delete measure.dynamics` alongside the `delete measure.clefs` line** so
  dynamics share the clef limitation rather than rotting. (Preserving/remapping beat anchors across a
  rebar is future work for both families.)
- Unit-test resolution across measures and (synthetic) voices, **and** that a rebar clears
  `measure.dynamics` (regression guard for the line above).

### Phase 2 — MusicEngine API + undo + serialization
- `MusicEngine`: `addDynamic / updateDynamic / removeDynamic` delegating to `ScoreModel`, each
  calling `playbackEngine.setScore(...)` + `saveUndoState(...)` (mirror `setClefAt` at
  `MusicEngine.ts:230`).
- Confirm `toJSON`/`fromJSON` round-trip `dynamics` (optional array → free with current serializer;
  add a test). Old JSON (no `dynamics`) loads unchanged. **No schemaVersion bump required**; optional
  bump to 3 as a marker only.

### Phase 3 — Playback velocity (per-voice step function)
- `PlaybackEngine.play()` already iterates measures→slots **in order** (`PlaybackEngine.ts:180-183`).
  Rather than call `resolveActiveLevel` per chord (correct, but O(measures × chords) — it walks back
  every time), maintain a running **`Map<voice, DynamicLevel>`** across that single pass: as each
  measure's interpreted dynamics are encountered at/under a beat, update the map for that voice; for
  each chord look up `map.get(chord.voice ?? 0) ?? DEFAULT_DYNAMIC`. Same result, O(n), and it matches
  the existing single-pass loop. (`resolveActiveLevel` stays as the unit-tested reference + the query
  used by any non-sequential caller.)
- Pass the level's `DYNAMIC_VELOCITY[...]` as the **4th arg** (Tone.js normalized **velocity** 0–1,
  not dB) to `triggerAttackRelease(name, dur, time, velocity)` (`PlaybackEngine.ts:231`).
- Default before any mark = `DEFAULT_DYNAMIC`. Text dynamics never update the map (no loudness change).
- Manual check: place `p` then `f`, confirm audible step. (Single-note dynamics/CC and hairpin
  ramps are explicitly out of scope here.)

### Phase 4 — Rendering (modifier path)
- Add `'dynamic'` to the `ElementType` union (`ElementRegistry.ts:17`) **here** — registration in this
  phase needs it (the Phase 5 palette work also references it, but the type must exist first).
- In the slot loop (`VexFlowRenderer.ts:~309`), for each dynamic whose beat matches the slot beat and
  voice, attach an **`Annotation` modifier** to that `StaveNote`/rest (see §4 — **not** `TextDynamics`,
  which isn't a modifier):
  - `kind==='level'` → `Annotation` whose text is the SMuFL codepoint(s) from `TextDynamics.GLYPHS` /
    `Glyphs.*` (prefer precomposed `dynamicMP`/`dynamicMF`), with the **music (Bravura) font** set and
    `setVerticalJustification('below')`.
  - `kind==='text'` → `Annotation` with an **italic text font** and the user's text, also `'below'`.
  - Set the annotation's id to the `Dynamic.id` (`annotation.setAttribute('id', dynamic.id)`) so its
    SVG group is addressable, and stash the object in a `dynamicObjectMap: Map<id, Annotation>`
    (mirror `tupletObjectMap`) for the highlight lookup in Phase 6.
- If a dynamic's beat has no slot (rare with auto rest-fill), attach to the nearest following slot in
  that voice (document the rule). Avoid adding a tickable to the music voice.
- **Register** each rendered dynamic into `ElementRegistry` with `type:'dynamic'`, the `Dynamic.id`,
  and the `Annotation`'s `getBoundingBox()` — mirror the articulation registration at
  `VexFlowRenderer.ts:1219-1240`. The bbox is for **hit-testing** (Phase 6 selection); highlight uses
  the SVG group, not the bbox. **Do not duplicate `kind`/`level`/`text` onto `ElementInfo`**; the
  registry entry carries `id` + bbox, and edit/highlight look the rest up from the model. (If a
  dynamic-specific field is unavoidable later, add it to `ElementInfo` then — `ElementRegistry.ts:122`.)
- **Register under rests too.** The articulation registration at `:1219-1240` lives **only** in the
  note/chord branch; the rest-registration branch (`~:1180`) iterates no modifiers. Since invariant #5
  allows a dynamic under a rest/empty beat, add the dynamic registration to **both** branches (or do it
  in a small dedicated post-pass over the rendered slot's modifiers). Don't assume the existing
  articulation site covers rests — it doesn't.
- Ghost preview (optional, nice-to-have): render a translucent dynamic at the armed cursor, like the
  clef/TS ghost (`renderScoreWithClefGhost`). Can defer to a polish pass.
  - **DONE.** Implemented as `renderScoreWithDynamicGhost` (engine → renderer), wired through
    `RenderController.renderDynamicGhost` and the dynamics branch in `MouseController.handleMouseMove`;
    styled via global class `.ghost-dynamic-group` in `App.vue`.
  - **GOTCHA worth remembering** (cost a debugging session): unlike the clef/TS ghosts, the dynamic
    ghost *extracts just the annotation's `<g>`* and re-parents it to the SVG root. A level glyph's
    `<text>` is emitted with **no explicit `font-size`** — VexFlow relies on it **inheriting** the size
    from ancestors in the score tree. Re-parenting breaks that chain, so the glyph collapses to the
    browser default (~16px) and renders tiny next to a placed mark (custom *text* was fine because it
    sets its own size). Fix: re-apply the annotation's resolved font (`annotation.fontInfo`) on the
    wrapper group. This is pure SVG/VexFlow behaviour — **not** framework-related; it would reproduce in
    React/Svelte/vanilla identically.
  - **DONE (cross-cutting, framework-agnostic): notation CSS extracted out of `App.vue`.** The ghost +
    selection styling now lives in `src/engine/rendering/notation.css`, imported by `VexFlowRenderer.ts`
    so it travels with the engine — any host (Vue/React/Svelte/vanilla) gets it for free, with no
    `<style>` wiring. Previously these rules sat in `App.vue`'s **global** `<style>` block and only worked
    because it wasn't `scoped` (making it `scoped` would have silently broken every ghost/highlight, since
    Vue rewrites selectors with a `data-v-*` attribute the engine-created SVG nodes don't carry). Note:
    the dead `.ghost-note-preview` rules were dropped — the ghost *note* is styled inline in code
    (`VexFlowRenderer.applyGhostStyle`), not via a class, so it has no stylesheet dependency.

### Phase 5 — Palette UI + arm/click placement
- (`ElementType` union already added in Phase 4.)
- `PaletteController`: add an **armed "dynamic" tool** with a current selection
  (`p|mp|mf|f|customText`), mirroring `setClef`/`setTimeSignature` (`PaletteController.ts:219,239`) —
  including the **mutual-exclusion** they do (arming dynamic must null `selectedClef` /
  `selectedTimeSignature` and vice-versa). Buttons in `App.vue` next to articulations/clef/TS.
- `MouseController`: when the dynamic tool is armed and the user clicks a valid staff position,
  **reuse the slot-boundary snapping already written for clefs** — `resolveClefBeat`
  (`MouseController.ts:76-99`) maps a click X to the nearest slot's exact `Fraction` beat. Generalize/
  rename it (e.g. `resolveSlotBeat`) rather than reinvent snapping; then call `engine.addDynamic(...)`
  with (measure, beat, voice=0). For the custom mark, open a tiny inline text input (reuse the
  title-edit / TS-dialog idiom) to capture the italic text before placing.
- Default placement `'below'`.

### Phase 6 — Selection / edit / delete
- Hit-test `'dynamic'` elements in the mouse controller; set `state.selectedDynamicId` (new field,
  mirroring `selectedClefMeasure` / `selectedTimeSignature`).
- `useShortcuts.ts`: `Delete` on a selected dynamic → `engine.removeDynamic(id)` (mirror the clef/TS
  delete at `useShortcuts.ts:77-91`).
- Double-click a **custom text** dynamic → inline edit (re-open the text input bound to
  `updateDynamic`). Double-click a level dynamic → cycle/choose level (or just re-arm + replace).
  (Recover `kind`/`level`/`text` from the model by the registered `id` — they're not on `ElementInfo`.)
- **Highlight via the annotation's own SVG group** — the robust path, confirmed against VexFlow 5.
  `Annotation.draw()` wraps its glyphs in `<g class="vf-annotation" id="vf-<id>">`, so add a
  `getDynamicSVGGroup(id)` that returns `annotation.getSVGElement()` from the `dynamicObjectMap`
  (mirror `getTupletSVGGroup` at `VexFlowRenderer.ts:2060`), then recolor that group's `text`/`path`
  children. **This supersedes the bbox-coordinate scan** that clef/TS use (`HighlightController.ts:288`)
  — that scan exists only because those glyphs aren't individually grouped; a dynamic *is*, so the
  fragile `width > 40` heuristic and document-wide scan are unnecessary. (Hit-testing for *selection*
  still uses the registry bbox; only the recolor uses the group.)

### Phase 7 — Voice-awareness scaffolding (mostly free; document the seam) — DONE
**Audit result (verified):** every dynamic path already keys on `voice ?? 0`. Confirmed sites:
- **Model storage** — `ScoreModel.addDynamic` derives `voice = dynamic.voice ?? 0` and the
  one-per-(beat, voice) replace check uses `(d.voice ?? 0) === voice`.
- **Resolution** — `utils/dynamics`: `dynamicVoice(d) = d.voice ?? 0`; `resolveActiveLevel` filters
  on it walking back; `resolveChordLevels` keys its running map on `slot.voice ?? 0` / `d.voice ?? 0`.
- **Render matching** — `VexFlowRenderer.attachDynamicsToSlots` matches `dyn.voice ?? 0` against
  `slot.voice ?? 0` (exact-beat → nearest-following → last, all within the voice).
- **Playback** — consumes `resolveChordLevels` (per-voice), so it inherits the same keying.

**The single seam:** the *only* hardcoded voice is at placement — `MouseController` passes `voice: 0`
to `engine.addDynamic` (correct today; only voice 0 is populated). A `VOICE SEAM` comment marks it.

**Extension point (when multi-voice editing lands):** the only additions are (a) source the placement
voice from a UI selector / the active voice instead of the literal `0`, and (b) optionally add an
"applies to all voices" semantics (MuseScore's model). The timeline math needs **no** rework —
per-voice resolution is already in place end-to-end.

---

## 8. Out of scope (future phases, noted so the model doesn't preclude them)
- **Hairpins / wedges** (cresc., dim.) — these are *spanners* (start beat → end beat), a sibling
  family. The `<direction>` framing means they'd be a separate `Hairpin` array on `Measure`, reusing
  the beat-anchor + voice + placement conventions. Not built now; the data model leaves room.
- **Editable per-mark velocity** (MuseScore-3 style) — could add an optional `velocity?: number`
  override on `Dynamic` later; `resolveActiveLevel` would prefer it over the table.
- **`sf`/`sfz`/accent-linked dynamics**, single-note dynamics, MIDI CC ramps — all additive.
- **User-selectable music font.** Fully compatible, and **not a dynamics concern** — it's a global
  render-layer setting. Because level dynamics are stored as SMuFL codepoints (font-agnostic across the
  ~20 SMuFL fonts VexFlow ships/loads — Bravura, Petaluma, Leland, Gonville, Gootville, Finale*,
  MuseJazz…) and VexFlow resolves all glyphs through one global font stack, switching the score's
  engraving font makes clefs, noteheads, **and** dynamics change together automatically. The `Dynamic`
  model stores only the *semantic* `level`; the level→codepoint map lives in the render layer, so
  there is **zero font coupling in the data**. **Prerequisite for this to "just work": Phase 4 must use
  the global/score engraving font, never a hardcoded `'Bravura'`** (already called out in §4).
  *Constraint:* a chosen font must be **SMuFL-compliant** to carry the dynamics glyphs — but a
  non-SMuFL font wouldn't have clefs/noteheads either, so this is a whole-score limitation, not a
  dynamics-specific one.
- **Manual horizontal placement (X-drag).** Two gestures, two answers:
  - *Coarse re-anchor* (drag to a different beat, snapped) is **already compatible** — it just edits
    `Dynamic.beat`, mirroring the clef drag (`draggedClefBeat` in `MouseController`) and reusing the
    same slot-boundary snapping. Could land any time without model changes.
  - *Engraving nudge* (a horizontal offset for visual polish) is **achievable within the
    `Annotation`-modifier path**, contrary to the earlier worry. Verified in VexFlow 5: `Annotation`
    inherits `Modifier.setXShift`, `Annotation.draw()` renders at `this.x + this.xShift`, and
    `Annotation.format` does not clobber it. So add an additive, visual-only optional
    `xOffset?: number` on `Dynamic` (mirroring the tuplet `yOffset`) and apply it via
    `annotation.setXShift(xOffset)`. The offset is **relative to the anchor note**, which is exactly
    the engraving gesture you want (and it re-flows correctly when the note moves). The only thing the
    modifier path *cannot* do is place a dynamic at an absolute X fully decoupled from any note — that
    rarer case needs the independently-positioned text renderer noted in §4, which is a **renderer swap
    only** (beat anchor, voice scope, and velocity table all stay put). `xOffset?` is
    backward-compatible either way. The model does not preclude any of this.

---

## 9. Progress

- [x] Phase 0 — Types + velocity table
- [x] Phase 1 — ScoreModel CRUD + per-voice resolution
- [x] Phase 2 — MusicEngine API + undo + serialization round-trip
- [x] Phase 3 — Playback velocity
- [x] Phase 4 — Rendering (modifier path) + ElementRegistry registration
- [x] Phase 5 — Palette UI + arm/click placement (incl. custom text input)
- [x] Phase 6 — Selection / delete / highlight (inline EDIT deferred — see note)
- [x] Phase 7 — Voice-awareness scaffolding + documented seam
