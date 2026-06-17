# Slurs — Implementation Plan

Status: **Phases 0–4 COMMITTED; Phase 5 (Curve migration + auto-shape) DONE & user-verified
"good default"; Phases 6–8 (editable handles) PLANNED.** This
document is the authoritative plan and cross-session checklist. The create-vs-delete correction (no
`s` toggle) is **resolved** as of Phase 2. The core feature is complete and shipped; what remains is
**migrating the hand-drawn arc to VexFlow's `Curve` primitive** (Phase 5) so we inherit its
control-point (`cps`) model, then building **editable/draggable slurs** on that foundation (Phases
6–8). See §7 for the VexFlow code references and §8 for the migration phases.

Slurs are a **phrasing** mark and are a fundamentally different kind of data from **ties** (which
are a *duration* mark). The two must stay separate — the same separation every major program and
the MusicXML standard enforce. This plan adds slurs as a **first-class span object**, anchored to a
start note and an end note, **voice-scoped from day one** (only voice 0 exists today, but the data
and code paths are correct when voices arrive).

Goal of this first pass is to **build the infrastructure** and the core UX, not the full set of
slur-editing niceties (draggable control-point handles, nesting numbers, etc. are deferred).

---

## 1. Goal

Let the user draw a slur over a run of notes/chords in a single voice:

- **`s`, single note selected** → slur from the current note to the **next slot** (note *or* rest),
  reusing the same "next slot" logic `MusicEngine.toggleTie` already uses (`MusicEngine.ts:838`).
- **`s`, range selected** → slur from the **first** to the **last** element in **score order**
  (`measure`, then `beat`) — *not* selection order.
- **`s` is create-only and idempotent** (user decision, 2026-06-13): pressing it again on a span that
  already carries a slur returns the existing slur and adds nothing — it does **not** toggle off. (This
  replaced the original "toggle off on repeat" plan; see the resolved correction note under Phase 1.)
- A slur is **selectable** (click its arc in selection mode) and **deletable** (Delete) — removal lives
  **only** in the select+Delete path, not on `s` — with a scoped highlight, just like ties.
- Undo/redo + JSON round-trip throughout.

`s` is lowercase and is **not** a note-entry letter (only `a`–`g` are), so it is safe; it operates on
the current selection (a selection-mode action).

### Voice rule
A slur lives **within a single voice** — you never slur from one voice to another. The `Slur`
carries an explicit `voice` field (mirroring `Dynamic.voice` / `Note.voice`). **When a range
selection spans more than one voice, only the primary voice (`voice 0`, musician's "voice 1") is
slurred; notes in other voices are ignored.** Both anchors must be in the same voice.

### Non-goals (this pass)
- Playback effect — a slur is **notational only** for now (no legato re-articulation change). May add
  legato interpretation later.
- Draggable control-point handles / manual curve shaping (the Sibelius "six handles").
- Nested/overlapping slur disambiguation numbers (the field is reserved; see §4).

---

## 2. Industry research (MusicXML / MuseScore / Sibelius / Gould)

Sources:
[MusicXML `<slur>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/slur/),
[MusicXML `<tied>` vs `<tie>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/tied/),
[Behind Bars (Elaine Gould) — Wikipedia](https://en.wikipedia.org/wiki/Behind_Bars_(book)),
[Entering Slurs in Sibelius](https://makingthemostofnotationsoftware.blog/2013/05/06/entering-slurs-in-sibelius/),
[Better Sibelius slurs / control handles — Scoring Notes](https://www.scoringnotes.com/tips/better-sibelius-slurs-for-opposite-stem-direction-on-outer-notes/),
[VexFlow Curve](https://github.com/0xfe/vexflow/wiki).

### 2.1 Tie vs slur — universally separate
|              | Tie                              | Slur                                       |
|--------------|----------------------------------|--------------------------------------------|
| Connects     | 2 heads, **same pitch**          | a **range** of N events, any pitch         |
| Meaning      | one sustained sound (duration)   | phrasing / legato (articulation)           |
| Spans        | adjacent slots                   | arbitrary; may **nest / overlap**          |
| Anchors to   | individual pitch (notehead)      | the **note event / chord** as a whole      |
| Playback     | merges durations                 | at most legato; usually notational only    |

- **MusicXML:** tie = `<tie type="start"/>` (sound) + `<tied>` (notation). Slur = `<slur
  type="start" number="N"/>` … `<slur type="stop" number="N"/>` attached to the start/end notes, with
  a **`number` (1–6)** to disambiguate overlapping/nested slurs and optional `placement="above|below"`.
- **MuseScore:** `Slur` is a **Spanner** with `startElement` / `endElement` (anchored to Chord/Note);
  ties are a different class on `Note`. Not the same code path.
- **Sibelius:** slurs are **Lines** (a span between two rhythmic positions); ties are note
  properties. Matches the user's mental model.

**Takeaway:** model a slur as a **span object referencing a start anchor and an end anchor**, with
`placement` + a reserved `number`. Do **not** model it as note attributes (that's correct for ties).

### 2.2 System-break behavior (Gould / Sibelius)
When a slur crosses a **system break** (the music wraps to the next row), it is **never** stretched
as one arc. It is drawn as **two half-arcs**: the first **trails off** the right end of the upper
system; the second begins at the **left** of the next system and curves into the end note. This is
exactly the convention — and exactly the two-partial mechanism the tie renderer already implements
for cross-line ties (`VexFlowRenderer.ts:2094`). Sibelius creates this by selecting the run and
pressing **`s`** (same gesture we're adopting) and exposes six draggable handles afterward (deferred).

---

## 3. Codebase findings (why this slots in cleanly)

- **Ties are the structural anti-pattern to avoid copying, but the right *rendering/selection*
  precedent.** Ties live on the note (`tiedTo`/`tiedFrom`, `types/music.ts:174`) because they connect
  same-pitch heads. Slurs must **not** copy that — they get a dedicated object. But the *machinery*
  around ties is reusable verbatim:
  - **Rendering:** `VexFlowRenderer.renderTies` (`:2032`) is called once after all measures draw
    (`:1703`); it walks the score, looks up endpoints in `staveNoteMap` (keyed by **NotePitch id and
    rest id** — so a head id resolves straight to its chord's StaveNote), draws arcs, and **registers**
    each in the `ElementRegistry` as a `'tie'` element with a bbox. `renderSlurs` mirrors the *walk +
    register* structure. **Caveat — don't assume the `Curve` path:** the same-line case is **not**
    drawn with `StaveTie`; it is hand-drawn on the canvas context by `drawFlatTie` (`:1991`), which
    returns a *computed* bbox. `StaveTie` is used only for the cross-line partials. **VexFlow ships a
    `Curve` class** (confirmed present in our build, `Curve extends Element`, takes `from`/`to` Notes
    + control points + an `openingDirection`), but two gaps make a hand-drawn `drawFlatSlur` the
    safer default (see Phase 1):
    1. **Bbox reliability** — the registry needs a bbox for hit-testing. `Element.getBoundingBox()`
       exists, but it is **not confirmed** that `Curve.draw()` populates it; must be verified or the
       bbox derived from the two notes' pixel extents.
    2. **Two different Ys** — slurs span *different pitches*, so endpoints have different Y. `drawFlatTie`
       hardcodes a single Y (`:2000–2001`); a slur arc must take both endpoint Ys.
  - **Selection:** `SelectionItem` already reserves `{ kind: 'tie'; fromNoteId }`
    (`selection.ts:21`); add `{ kind: 'slur'; id }`. `EditorState.selectedTieFromNoteId`
    (`EditorState.ts:54`) → add `selectedSlurId`.
  - **Highlight (do NOT reuse `colorTieArc` verbatim):** `HighlightController.applyTieHighlight` +
    `colorTieArc` (`:259`, `:302`) recolor by scanning **every `<path>` whose center falls inside the
    registered bbox**. That is safe for a tiny tie arc, but a slur bbox spanning several notes is a
    large rectangle — the scan would recolor beams (which are paths), other arcs, and ties inside the
    span. This is exactly the highlight-bleed class already fixed elsewhere by scoping recolor to an
    element's own SVG group (see docs/note-selection-hit-detection.md). `applySlurHighlight` must
    therefore color the slur's **own `Curve`/SVG group/element**, not do a bbox path-scan.
  - **ElementRegistry:** `ElementType` union (`ElementRegistry.ts:18`) add `'slur'`; reuse the
    tie-style fields (`fromNoteId`, `toNoteId`, `fromMeasure`, `toMeasure`, `isPartial`, `partialType`).
- **Voice-readiness already exists:** `Note.voice` / `Chord.voice` / `Rest.voice` default 0; the
  `Dynamic.voice` field (`types/music.ts:119`) is the idiom a `Slur.voice` follows. No-op today.
- **Score-order sort already exists:** `toggleTie` sorts all slots by `(measure, beat)`
  (`MusicEngine.ts:838`) — reuse for first/last endpoint resolution and for filtering to voice 0.
- **Multi-select set is in place:** `EditorState.selectedItems: Map<string, SelectionItem>`
  (`EditorState.ts:28`) + `selectedNoteIds` (`selection.ts:59`) give the range the `s` handler reads.
- **Shortcut plumbing:** `SHORTCUTS` (`ShortcutConfig.ts`) maps keys → action names; `'s'` is unused.
  Add `'s' → 'toggleSlur'`, handler in the controller layer (`PaletteController.toggleTie` at `:148`
  is the precedent), routed through `useShortcuts`.
- **Serialization:** `Score.schemaVersion === 2`; new top-level `slurs?` array is optional → old JSON
  loads with no slurs. No breaking migration.

### Storage decision
Slurs are stored as a **top-level `Score.slurs: Slur[]`** (not measure-owned). Rationale: slurs cross
barlines and systems freely; ties already dodge measure-ownership (they live on notes) precisely
*because* they span measures. A flat score-level array is the simplest thing that handles
cross-measure spans, and `renderSlurs` walks it the same way `renderTies` walks the whole score.
(Measure-owned, like `dynamics`/`clefs`, was considered and rejected — ownership of a span that
leaves its measure is awkward for rebar/paste.)

---

## 4. Data model

```ts
/** A phrasing slur spanning a run of note events within one voice. */
export interface Slur {
  id: string
  /** Anchor: the start note's head id (a NotePitch id, as used by selection). */
  startNoteId: string
  /** Anchor: the end note's head id. */
  endNoteId: string
  /** Voice this slur belongs to; both anchors share it. Default 0. */
  voice?: 0 | 1 | 2 | 3
  /** Vertical placement; default auto (derived from stem direction). */
  placement?: 'above' | 'below'
  /**
   * Reserved for future nested/overlapping-slur disambiguation (MusicXML `number`).
   * Unused in this pass.
   */
  number?: number
}
```

- Add `slurs?: Slur[]` to `Score` (`types/music.ts`). Optional/absent = no slurs.
- **Anchor granularity:** anchors are **head ids (NotePitch ids)** — the id the selection system
  hands us, and the key `staveNoteMap` uses — but at render time each is resolved to its **containing
  chord's StaveNote**, since a slur arcs over the whole event, not one pitch of a chord.
- **Anchor fragility (head id vs. event).** A slur is an *event-level* mark, but we store a *head* id.
  The model does carry a stable event id (`Chord.id` / `Rest.id`), but `staveNoteMap` is keyed by head
  id, not chord id — so head-id anchors are the pragmatic choice. The cost is two cleanup obligations
  (handled in Phase 2, not the type):
  - **Chord-sibling deletion:** deleting one head of a multi-note chord (chord survives) orphans a slur
    anchored to that head → **re-anchor to a surviving sibling head of the same chord**.
  - **Single-note deletion:** `deleteNote` replaces a deleted single note with a **brand-new rest id**
    (`MusicEngine.ts:893`) and re-points the *tie* to it (`:902–905`). A slur anchored there must do the
    same re-point, or be dropped — it will **not** survive automatically.
  - **Rebar/paste:** these mostly *preserve* note ids, so slurs survive bar reflow on their own. The real
    hazards are delete / overwrite-paste / tie-merge (above), not rebar movement.

---

## 5. Phases

Each phase is independently shippable and ends green (unit tests + manual check by the user).

### Phase 0 — Types & serialization (no behavior) — DONE (not committed)
- [x] Add `Slur` interface + `Score.slurs?: Slur[]` (`types/music.ts`).
- [x] `'slur'` added to `ElementType` (`ElementRegistry.ts`) and `SelectionItem`
      (`selection.ts`, `itemKey` — folded into the `id`-keyed case group).
- [x] `EditorState.selectedSlurId: string | null` (`EditorState.ts`), default null. (Clear-sites
      deferred to Phase 2 — nothing sets it until then, so it stays null.)
- [x] JSON export/import round-trips `slurs` automatically (top-level field on `Score`; `toJSON`/
      `fromJSON` stringify/parse the whole score — no migration; old JSON → `slurs` undefined, treated
      as `[]` by consumers).
- [x] Unit tests for the round-trip + legacy backward-compat (`ScoreModel.test.ts`).
- 605 unit tests green; `npm run build:check` passes.

### Phase 1 — Create / toggle via `s` (same-line only) — DONE & COMMITTED (d629a64)

> **✅ POST-IMPLEMENTATION CORRECTION (user, 2026-06-13) — RESOLVED in Phase 2.**
> The user does **not** want toggle semantics on `s`. Phase 1 shipped the interim toggle-off; Phase 2
> replaced it with **create vs. delete as distinct operations**: `toggleSlur` → **`createSlur`**
> (create-only, idempotent — returns the existing slur on a repeat, never removes); removal lives only
> in the select-the-arc + Delete path (`removeSlur`). The toggle-off test was replaced by an
> idempotency test. No remaining action.

- [x] `MusicEngine.createSlur(noteIds: string[])` — resolves endpoints:
  - single note → current note → next slot (note or rest), via `nextDistinctSlot` which **dedupes to
    distinct `(measure, beat)` slots** (skips sibling chord heads at the same beat).
  - range → first/last in score order, **filtered to voice 0**.
  - if a slur with the same endpoints exists → returns it unchanged (**idempotent, create-only**).
- [x] One atomic undo step ("Add slur"), `saveUndoState`. (Removal's "Remove slur" undo step lives in
      `removeSlur`, Phase 2.)
- [x] `'s' → 'createSlur'` in `ShortcutConfig`; `PaletteController.createSlur` handler +
      `useShortcuts` wiring (reads `selectedItems`, falls back to scalar `selectedNoteId`).
- [x] `renderSlurs` (called after `renderTies` in the post-measure pass), registered in
      `ElementRegistry` as `'slur'` with a bbox + sampled arc `points`. Used a hand-drawn
      **`drawFlatSlur`** (both endpoint Ys, computed bbox) — `Curve` avoided. Same-line only;
      cross-system spans are skipped (Phase 3).
- [x] Unit tests: endpoint resolution (single / range / score-order / chord next-slot dedupe /
      no-next-slot → null), idempotency, undo+redo. `build:check` passes.

### Phase 2 — Select / highlight / delete — DONE & COMMITTED (adcfaaf)
- [x] Hit-test the slur in selection mode → set `selectedSlurId`. Used **arc-proximity** (min distance
      to the sampled `points` ≤ 7px), not bbox containment — so clicking the curve selects it without
      the coarse rectangle swallowing clicks on the spanned notes. (`MouseController`, after the tie
      hit-test.) Note: routed through the scalar `selectedSlurId`, not `selectedItems`, matching the
      other non-note marks (ties/dynamics/clefs) — multi-select migration is a later phase.
- [x] `HighlightController.applySlurSelectionHighlight` — colors **the slur's own `<g class="vf-slur">`
      group** (via `getSlurSVGGroup`), not a bbox path-scan, so no bleed onto beams/arcs in the span.
      Wired into `RenderController.applyHighlights`.
- [x] Delete removes the `Slur` object (not the notes) via `removeSlur`; one undo step. Wired into
      `useShortcuts` `deleteSelected` (after the tie branch).
- [x] Anchored-note hazards (`MusicEngine.deleteNote` → `reanchorSlurs`): (a) multi-note chord survives
      → re-anchor to a surviving sibling head; (b) single note → re-point onto the replacement rest's
      **new id**; (c) rest deleted / span collapses → drop the slur.
- [x] Unit tests: create-only idempotency, removeSlur+undo, anchor-deletion cleanup (both
      chord-sibling and replacement-rest re-point). 613 tests green.

### Phase 3 — System-break (two-half) rendering — DONE & COMMITTED (2263374)
- [x] When endpoints land on different systems, draw **two partial curves**: first trails off the
      start system's right edge (`fromStave.getNoteEndX()`), second leads in from the end system's left
      edge (`toStave.getNoteStartX()`). `drawFlatSlur` was generalized into `strokeSlurCrescent(p0, cp,
      p1, dir)`; `renderSlurs` computes same-line vs cross-line geometry and calls it once (full) or
      twice (halves). Both partials registered as `'slur'` with `isPartial`/`partialType`.
- [x] Highlight + hit-test both halves as one logical slur: both halves are drawn inside the **same**
      `<g class="vf-slur">` group (recolored together) and each carries arc `points` under the same
      slur `id` (clicking either half selects the slur; Delete removes the one `Slur`).
- [ ] Visual check with a wrapped phrase (manual — renderer geometry isn't unit-testable; 613 unit
      tests + `build:check` green).

### Phase 4 (deferred, not a blocker)
- [x] Auto `placement` from stem direction (DONE & COMMITTED 175c52b): default follows the stems
      notehead-side — stems up → slur below, stems down → slur above (`renderSlurs` reads
      `getStemDirection()` of the start note; explicit `placement` override still wins). Uses the start
      note's stem for the whole slur (incl. both cross-system halves); a full-run vote is a later nicety.
- [x] Optional legato playback interpretation (DONE & COMMITTED 6f1bb23): **zero-regression / additive** —
      `utils/slurs.legatoChordIds(score)` marks chords that connect forward under a slur (start..end-1,
      chords only); `PlaybackEngine` extends those notes by a small overlap (`LEGATO_OVERLAP_BEATS`
      0.12, capped at half the base duration) so they bind to the next onset. Notes outside any slur
      are untouched. Pure util unit-tested (4 cases); the audio path itself isn't unit-testable.
      (Subtle by design — the synth is already near-gapless. If a stronger legato/detached contrast is
      wanted later, introduce a default detachment for non-slurred notes — a global feel change, so
      left as an opt-in.)
- [ ] Draggable control-point handles; nested-slur `number` disambiguation. **Re-scoped 2026-06-17**
      into Phases 5–8: these depend on first migrating the hand-drawn arc to VexFlow's `Curve`
      (whose `cps` control points *are* the handle data). See §7 (VexFlow refs) and §8 (phases).

---

## 6. Decisions locked (from user)
1. **Key:** lowercase **`s`**.
2. **Single note + `s`:** slur current note → next slot (note or rest).
3. **Range + `s`:** first → last in **score order**. `s` is **create-only / idempotent** (no toggle-off
   — revised 2026-06-13); removal is select-the-arc + Delete.
4. **Multi-voice range:** slur **only voice 0** ("voice 1"), ignore others.
5. **System break:** draw as **two half-arcs** (Gould / Sibelius convention).
6. **Storage:** top-level `Score.slurs[]`.
7. **Playback:** notational only for now (no audio change).
8. **Rendering primitive (added 2026-06-17):** migrate the hand-drawn arc to VexFlow's `Curve`, but
   **keep our endpoint geometry** (call `renderCurve` directly, not `Curve.draw()`) so we retain the
   exact same control we have today **plus** the editable `cps` control-point model. See §7–§8.

---

## 7. VexFlow `Curve` — the rendering primitive we migrate to

We currently hand-draw the arc with raw canvas calls in `strokeSlurCrescent`
(`VexFlowRenderer.ts:2295`): a single-control-point **quadratic** Bézier (`ctx.quadraticCurveTo`)
with the bow height baked into the `SLUR_ARC = 14` constant — **no per-slur shape data anywhere**.
That is the thing blocking draggable/editable slurs.

VexFlow 5.0.0 ships a purpose-built `Curve` class that draws a **cubic** Bézier with two
**fine-tunable control points**. Source/types in the installed build:

- **`node_modules/vexflow/build/esm/src/curve.js`** — implementation.
- **`node_modules/vexflow/build/types/src/curve.d.ts`** — types (`CurveOptions`, `Curve`).

### 7.1 The bits we use

| VexFlow symbol | Location | What it gives us |
|---|---|---|
| `interface CurveOptions` | `curve.d.ts:3–16` | `cps: {x,y}[]` (the **two control-point offsets** = our editable handles), `thickness`, `xShift`, `yShift`, `position`/`positionEnd` (`NEAR_HEAD`/`NEAR_TOP`), `invert`, `openingDirection` (`'up'|'down'|'auto'`). |
| `new Curve(from, to, options)` | `curve.js:21–28` | Constructor. Throws if **both** `from` and `to` are undefined. Defaults: `thickness:2, xShift:0, yShift:10, position/positionEnd:NEAR_HEAD, invert:false, cps:[{x:0,y:10},{x:0,y:10}], openingDirection:'auto'`. |
| **`renderCurve(params)`** | `curve.js:40–63` | **The primitive we call directly.** `params = { firstX, firstY, lastX, lastY, direction }`. We feed it **our** endpoint geometry, bypassing `draw()`. |
| `draw()` | `curve.js:64–125` | **We do NOT use this.** It recomputes endpoints from `getStemExtents()[baseY|topY]` + `getTieRightX()/getTieLeftX()` (and stave edges for partials). Using it would throw away our per-chord-head Y precision and system-break geometry. |
| `isPartial()` | `curve.js:37–39` | `true` when `from` **or** `to` is undefined (VexFlow's native cross-system mode). **We do NOT rely on it** — we keep our own two-half split (§8, Phase 5c) for full control of the half geometry. |
| `CurvePosition` enum | `curve.js:3–7` | `NEAR_HEAD=1, NEAR_TOP=2`. Only relevant to `draw()`; irrelevant when we drive `renderCurve` ourselves. |

### 7.2 How `renderCurve` builds the curve (so we can mirror it for hit-testing)

From `curve.js:40–63`, given `params` and `options.cps = [cp0, cp1]`:

```
controlPointSpacing = (lastX - firstX) / (cps.length + 2)
P0 = (firstX, firstY)
C0 = (firstX + controlPointSpacing + cp0.x, firstY + cp0.y * direction)
C1 = (lastX  - controlPointSpacing + cp1.x, lastY  + cp1.y * direction)
P3 = (lastX, lastY)
ctx.bezierCurveTo(C0, C1, P3)          // forward pass
ctx.bezierCurveTo(C1', C0', P0)        // return pass offset by `thickness` → fill body
```

Two consequences that make this the right primitive:

1. **`cps` are deltas, not absolutes.** `cp.x/cp.y` are added *on top of* the spacing-based base
   control points. So a user's stored shape edit **rides along** when the anchor notes move — exactly
   the behavior we want for draggable handles that survive rebar/edits.
2. **Different endpoint Ys are first-class** (`firstY` vs `lastY` are independent). The plan's old
   "two different Ys" worry was about the *tie* renderer (`drawFlatTie`), **not** `Curve`.

### 7.3 The things `Curve` does NOT give us

`renderCurve()`/`draw()` stroke+fill to the canvas but **do not populate** `Element.getBoundingBox()`.
Our `ElementRegistry` needs a bbox + sampled `points` for arc-proximity hit-testing
(`MouseController.ts:359`). So **hit-test geometry stays ours**: we sample the *cubic* B(t) using the
P0/C0/C1/P3 from §7.2 (replacing the current quadratic sampling in `strokeSlurCrescent:2308–2317`),
and we keep wrapping the `renderCurve` call in our `<g class="vf-slur">` group (`openGroup`/
`closeGroup`, `VexFlowRenderer.ts:2242`,`2279`) so `applySlurSelectionHighlight` still recolors
exactly one slur.

Three gaps to handle when we migrate (verified against `curve.js` + the current renderer):

1. **`renderCurve` strokes AND fills — our `strokeSlurCrescent` only fills.** It calls `ctx.stroke()`
   *then* `ctx.fill()` (`curve.js:60–62`), so each emitted `<path>` carries **both** a `stroke` and a
   `fill`. Two follow-ons:
   - **Highlight (`HighlightController.applySlurSelectionHighlight:471–474`) only overrides `fill`.**
     A selected slur would show an orange body with a **dark outline**. The migration must also set
     `el.setAttribute('stroke', SELECTION_COLOR)` (and clear it on deselect). There is **no** CSS rule
     for `.selected-slur` — the inline `fill` attr does all the work today, so the stroke won't be
     caught by any stylesheet either.
   - **Visual weight differs** from the current fill-only crescent (return offset `cp.y + 3*direction`,
     `:2304`). Fold this into the calibration pass (§8, Phase 5).
   - (Aside: `renderCurve` *skips* the return-pass + fill when `this.style.lineDash` is set —
     `curve.js:58,61`. Never set a dashed style on these Curves or the body goes hollow.)
2. **Bbox must be computed from the cubic's four points.** The current bbox is `min/max` of `{p0, cp,
   p1}` (three points, `:2319–2322`); a cubic has four control points, so use `min/max` of
   `{P0, C0, C1, P3}` (a valid convex-hull bound) — or just derive the bbox from the 16 sampled
   `points` (tighter and simpler).
3. **Sampling + future handles must use the *post-shift* endpoints.** `renderCurve` applies
   `firstX += xShift`, `firstY += yShift*direction` (etc.) **before** computing `controlPointSpacing`
   and the control points (`curve.js:44–48`). We set `xShift:0`/`yShift:0` so today it's a no-op and
   our raw endpoints are exact — but the cubic sampling (`points`) **and** the Phase-7 handle dots must
   be derived from the *same* endpoints `renderCurve` uses internally, so a future `xShift`/`yShift`
   tweak doesn't silently desync hit-testing/handles from the drawn curve.

### 7.4 Rendering primitive — DECIDED: VexFlow `Curve` via `renderCurve` (user, 2026-06-17)

**Decision: drive VexFlow's `Curve.renderCurve` with our own coordinates.** VexFlow owns the curve
drawing; we keep control of the things that matter musically — start point, end point, direction/angle,
and the two `cps` control points (the user's reshape handles).

**Why (and why the old hand-drawn approach was a workaround, not a requirement):** the slur was
hand-drawn only because it *mirrored the tie*, and the tie was hand-drawn because an earlier attempt
"couldn't get good control" out of VexFlow. That conclusion came from trying the **high-level `draw()`
path**, which auto-derives endpoints from the notes' stems (`Curve.draw()` → `getStemExtents()` +
`getTieRightX/LeftX`; likewise `StaveTie.draw()`) and so *takes control away*. But both classes expose
a **low-level twin** — `Curve.renderCurve({ firstX, firstY, lastX, lastY, direction })` and
`StaveTie.renderTie({ firstX, lastX, firstYs[], lastYs[], direction })` — where **we pass the pixel
coordinates and VexFlow just strokes the path**. That low-level door gives exactly the control the
hand-drawn code was reaching for. The library could always do this; we'd used the wrong entry point.

**Strategic consequence:** ties will migrate the same way later — `StaveTie.renderTie` with our own
coordinates — so slurs-via-`Curve` keeps **ties and slurs on one coherent strategy**: *feed VexFlow our
own geometry through its low-level `render*` methods.* Self-rolling the slur cubic would diverge from
that, which is the main reason we're **not** doing it.

**The one cost, true regardless of this choice (so it didn't sway it):** neither `renderCurve` nor
`renderTie` hands back the curve's on-screen geometry, so **click-detection stays our code** — we
re-derive the cubic (§7.2) to know where the arc is for hit-testing (`points` + bbox). That's not a
control limitation; the `render*` methods *draw* but don't *return geometry*. Handle the §7.3 gotchas
(stroke+fill highlight, 4-point bbox, post-shift sampling) and this is clean.

(Rejected alternative — self-rolled `drawCubicSlur(p0, cps, p1, direction)`: one source of truth for
draw+sample and no stroke/fill/shift quirks, but it entrenches the very hand-drawn workaround we now
understand was unnecessary, and diverges from the tie strategy. The **cubic + `cps` data model is
identical either way** — Phases 6–8 are unaffected by this decision.)

---

## 8. Migration & editable-slur phases (5–8)

Guiding constraint (user, 2026-06-17): **the migration must preserve the exact control we have with
our own Bézier** — same endpoints, same above/below logic, same two-half system-break behavior — and
*additionally* expose the `cps` control points for editing. We achieve this by driving
`renderCurve(params)` ourselves, never `Curve.draw()`.

### Phase 5 — Migrate `strokeSlurCrescent` → VexFlow `Curve.renderCurve` + auto-shape — DONE & user-verified

> **Primitive DECIDED (§7.4): VexFlow `Curve` via `renderCurve`** — we drive it with our own
> coordinates; we do **not** use `Curve.draw()`/`isPartial()`. Ties will later migrate the same way via
> `StaveTie.renderTie`.

- [x] In `renderSlurs` (`VexFlowRenderer.ts:2195`), replaced `strokeSlurCrescent` with `drawSlurArc`,
      which instantiates a `Curve(fromNote, toNote, { cps, thickness, xShift:0, yShift:0 })` and calls
      `curve.setContext(ctx).renderCurve({ firstX, firstY, lastX, lastY, direction })` with the
      endpoints we already compute (`getTieRightX()`/`getTieLeftX()`, per-chord-head `getYs()` + `LIFT`).
      `yShift:0` so `LIFT` isn't double-applied (we fold `LIFT` into firstY/lastY).
- [x] **Calibrated** the bow via `SLUR_BOW = 9.3`, reproducing the old quadratic peak
      (`LIFT + ARC/2 = 17px`; cubic flat peak `LIFT + 0.75·H`, so `0.75·9.3 ≈ 7`).
      `thickness = SLUR_THICKNESS = 2`.
- [x] **Bow shape, settled on perpendicular (2026-06-17):** two earlier cuts both had failure modes —
      (a) offsetting each control point from *its own* endpoint tilted/hooked the arc on steep runs;
      (b) leveling both control points to the higher endpoint's height fixed gentle runs but left a
      lopsided "air gap" over wide leaps. Final: `perpendicularSlurCps(p0, p1, direction)` bows the arc
      **perpendicular to the endpoint line** by a constant `SLUR_BOW`, giving even clearance at any
      slope. **Superseded same day:** perpendicular shifted the control points sideways by `∝ dy/len`,
      which blew up for closely-spaced steps — seconds went flat-and-skewed and near-unisons looked
      uneven/tilted (user-reported, the MuseScore "avoid forced tilt" failure). Final is `slurArchCps`:
      bow `SLUR_BOW` **vertically above the chord line**, control points horizontally centered (no
      sideways shift), following the slope — `[{0,BOW},{0,BOW}]` for flat/unison, gentle un-skewed lean
      for seconds, clean parallel arch for leaps. **Final tweak — span-proportional height:** a constant
      `SLUR_BOW` left long slurs reading as thin floating lines; arch height now grows with horizontal
      span (`SLUR_BOW + span·0.06`, capped at `SLUR_BOW_MAX = 22`), per Gould/MuseScore (longer → taller,
      capped). This is **not** a tradeoff — short slurs stay short because their span is short. **Auto-
      shape declared "good default" and frozen here:** four formula iterations confirmed the research's
      point that no global formula is beautiful in every context (why every pro app ships drag handles +
      MuseScore an iterative optimizer). Remaining per-slur perfection is Phase 7's job, not more
      constants. Tips were
      blunt/heavy because `renderCurve` strokes with the context's *inherited* (thick) line width — fixed
      by pinning `SLUR_OUTLINE = 1` in a save/restore around the draw, letting the fill's natural taper
      show; `SLUR_THICKNESS` 2 → 1.5. **User-verified "much better"; further pixel-perfection deferred to
      the draggable handles (Phase 7) — no auto-shape nails every slur, which is why every pro app ships
      manual handles.**
- [x] **Hit-test:** `drawSlurArc` samples the cubic B(t) (§7.2) with 16 steps and derives the bbox from
      the sampled `points` (tighter than the 4-point hull). Registry `add({ type:'slur', …, points })`
      unchanged.
- [x] **System break (5c):** kept our two-half split (`fromStave.getNoteEndX()` /
      `toStave.getNoteStartX()`); calls `drawSlurArc` twice with each half's endpoints. Did **not** switch
      to `Curve.isPartial()` native partials.
- [x] Kept the `<g class="vf-slur">` group wrap + `slurGroupMap`. Updated
      `applySlurSelectionHighlight` to override **both `fill` and `stroke`** (renderCurve strokes+fills),
      so a selected slur is fully orange (no dark outline). Re-render resets to black on deselect.
- [x] Deleted the quadratic `strokeSlurCrescent`; replaced by `drawSlurArc(p0, p1, cps, direction,
      fromNote, toNote)` returning `{ bbox, points }`.
- [x] 617 unit tests + `build:check` green. No model/JSON change in this phase.
- [x] **Manual visual check (user, 2026-06-17):** after iterating the auto-shape (see below) the user
      confirmed the result is a "good default" — full clean arcs on leaps, even unisons, un-skewed
      seconds, sharp tips, fully-orange selection. Renderer geometry isn't unit-testable.

### Phase 6 — Editable-shape model (`cps` on `Slur`) — DONE (not committed)
- [x] Added optional `cps?: [{ x: number; y: number }, { x: number; y: number }]` to `Slur`
      (`types/music.ts`). **Absent = the auto arch** (`slurArchCps`) → backward-compatible, JSON
      round-trips for free.
- [x] `renderSlurs` same-line case reads `slur.cps ?? this.slurArchCps(p0, p1, direction)`. (Cross-
      system halves stay auto — a split slur shares one `cps`, so per-half override is a Phase 7
      non-goal; the override applies once handles land.)
- [x] Model setter `ScoreModel.setSlurShape(id, cps | null)` (null clears the override → reverts to
      auto, deletes the key) + engine wrapper `MusicEngine.setSlurShape` with one undo step
      ("Reshape slur" / "Reset slur shape").
- [x] Tests: `cps` JSON round-trip + `setSlurShape` set/clear (ScoreModel), and engine
      set/clear/undo/redo + unknown-id no-op. 620 unit tests + `build:check` green. No UI yet.

### Phase 7 — Draggable control-point handles — DONE (not committed; pending manual UI test)
- [x] When a slur is selected, two handle dots are drawn at C0/C1 and registered as
      `ElementType 'slur-handle'` with their own hit bboxes + `slurId`/`cpIndex`. Drawn as an SVG
      overlay in `HighlightController.applySlurHandles` (wired into `RenderController.applyHighlights`,
      after the slur highlight) — the registry is post-render, so the next render clears the handles.
      The renderer stores the on-screen `controlPoints` + `slurEndpoints` on the same-line slur element
      (`drawSlurArc` now returns `c0`/`c1`); the highlight reads them.
- [x] Drag state in `MouseController` mirroring the **clef-drag state machine**: `handleMouseDown` arms
      the drag if a handle dot is hit (checked **before** the selection clears, so the slur stays
      selected) → `handleMouseMove` converts the cursor pixel into a `cps` delta via
      `cpsFromControlPoints` (inverts `renderCurve`'s control-point math), holds the other control point
      fixed, and live-updates via `engine.previewSlurShape` (NO undo) → `handleMouseUp`/`MouseLeave`
      → `endSlurHandleDrag` calls `engine.commitSlurShape()` for **one** undo entry if the shape changed.
- [x] First slice: the **two main control handles** (C0/C1). Endpoint handles / the full six-handle set
      remain a later nicety.
- [x] **Cross-system handled by omission:** only same-line slurs carry `controlPoints`/`slurEndpoints`
      in the registry, so a split slur shows **no** handles (per the one-shared-`cps` non-goal).
- [x] Tests: `previewSlurShape` (no undo) + `commitSlurShape` (one undo) = single reshape step
      (undo→auto, redo→final). The pixel drag itself is integration (not unit-tested). 621 unit tests +
      `build:check` green.
- [ ] **Manual UI test (user):** select a slur → two orange dots appear at the control points; drag a
      dot to reshape the curve; release → one undo step (Ctrl+Z reverts to auto). Split (cross-system)
      slurs show no handles. Deselecting clears the dots.

### Phase 8 — Nested / overlapping-slur `number` disambiguation — PLANNED (small)
- [ ] The `Slur.number` field already exists (reserved). On create, detect an overlapping slur in the
      same voice and assign an incrementing `number`; in `renderSlurs`, offset the inner slur's bow
      height by `number` so concentric slurs don't collide. Mostly a render tweak; no drag UI.

---

## 9. The slur-beauty problem & industry standards (research notes, 2026-06-17)

This section captures *why* a slur never looks quite "perfect" from an auto-formula, what the three
major editors and Elaine Gould actually do, what VexFlow's `Curve` can and cannot give us, and the
exact knobs in our build. It exists so a future session does **not** restart the four-iteration
shape-tuning treadmill we already ran.

### 9.1 The core problem: no single formula is beautiful in every context

A slur's *ideal* shape depends on context a constant cannot see: the pitch contour under it, the
horizontal span, collisions with noteheads/stems/beams/articulations/staff lines, whether outer notes
share stem direction, and aesthetic "non-ugliness" judgement. We empirically confirmed this by
cycling through four auto-formulas, each fixing one case and worsening another:

| # | Approach | Good at | Failure mode |
|---|----------|---------|--------------|
| 1 | Control points offset vertically from **their own endpoint** (`[{0,H},{0,H}]`) | flat/gentle runs | **hooked** on steep leaps (curve sagged below the steep chord line) |
| 2 | **Leveled** — both control points at a common height (top endpoint + H) | gentle runs | lopsided **air-gap** over wide leaps |
| 3 | **Perpendicular** bow (offset ⟂ to the endpoint line) | wide leaps | **skewed seconds** — sideways shift `∝ dy/len` blows up for close steps; near-unisons looked tilted (the MuseScore "avoid forced tilt" failure) |
| 4 | **Vertical above the chord line** (`slurArchCps`, current) + span-proportional height | flat/unison even, seconds un-skewed, leaps clean & full | still not Gould-grade: constant-along-length thickness, no endpoint angling, no collision avoidance |

**Conclusion (decision):** #4 is frozen as the **"good default."** Further per-slur perfection is the
job of **draggable handles (Phase 7)**, not more constants — this is exactly the lesson the industry
already learned (see 9.2). Do not re-litigate the formula; improve it only via genuinely
context-free best-practices (like span-scaling) or move the work into handles/collision passes.

### 9.2 What the industry does

All three editors model a slur as a **cubic Bézier with editable control points** — the same `cps`
model we adopted by migrating to `Curve.renderCurve` (Phase 5). The differences are in the *auto*
shaping and the *thickness*:

- **MuseScore** (slur-rewrite PR [#12280](https://github.com/musescore/MuseScore/pull/12280)):
  - Optimizes **both height and width** of the arc, adjusting Bézier points and endpoints together.
  - *"The arc is allowed to become slightly asymmetrical if the contour of the music is asymmetrical"*
    but *"unnecessary asymmetries in end point height (making the slurs look **tilted**) are avoided."*
    → our #4 (follow contour, no sideways tilt) matches this; #3 (perpendicular) violated it.
  - Explicit **"non-ugliness" rules** + an **iterative collision-avoidance** loop: *"one step I adjust
    the shape; next step I adjust the end points; … until there are no collisions."*
- **Dorico** (dev diary [part 13](https://blog.dorico.com/2016/03/development-diary-part-13/);
  [thickness docs](https://steinberg.help/dorico/v1/en/dorico/topics/notation_reference/notation_reference_slurs_thickness_changing_individually_t.html)):
  - Drag Bézier control points in Engrave mode; endpoints keep their distance to the stem tip when
    notes move (our `cps`-as-deltas gives the same "shape rides along" behavior for free).
  - **Separate `endpoint thickness` and `midpoint thickness`** engraving options → the slur **tapers**
    (thin at the ends, thicker in the middle), and the amount is tunable at each end vs. the middle.
  - Chains two cubics for **S-shaped / flat-middle** slurs (future nicety).
- **Sibelius:** slurs are Lines with the classic **six draggable handles**; same gesture (`s`) we use.
- **Gould, *Behind Bars*:** arc height **proportional to length** (capped); slurs **taper** — fine at
  the tips, fuller in the middle (SMuFL/standard ≈ 0.1 staff-space ends → ~0.2 middle); endpoints sit
  a small gap off the notehead, angled into it.

### 9.3 VexFlow `Curve` — what it gives and what it can't (the taper ceiling)

`Curve.renderCurve` (driven by our own coords, §7) gives a **single** `thickness`: the body pinches to
a point at each endpoint and stays ~constant in the middle — a *basic* taper. It does **not** support
Dorico/Gould's **dual** endpoint-vs-midpoint thickness, nor asymmetric upper/lower edges, nor
collision avoidance. So:

- **Taper heaviness was an artifact, now fixed:** `renderCurve` strokes **and** fills, using the
  context's *inherited* line width (left thick by the preceding beam/stem passes). That blunt, heavy
  outline hid the taper. Fixed by pinning `SLUR_OUTLINE = 1` in a `save`/`restore` around the draw and
  dropping `SLUR_THICKNESS` 2 → 1.5, letting the fill's natural taper read.
- **The remaining beauty gap = dual-thickness taper.** Closing it needs a **self-rolled tapered
  cubic** (vary stroke width along `t`), which is a *later beauty pass*. Crucially it costs nothing
  strategically: the `cps` data model is identical, so handles (Phases 6–8) are unaffected. Defer it
  until after handles — handles deliver more value per effort.
- **Collision avoidance** (MuseScore-style iterative nudging around noteheads/beams/articulations) is a
  large, separate future project; explicitly out of scope.

### 9.4 Our current calibration (the only knobs; `VexFlowRenderer.ts`)

| Constant | Value | Role |
|---|---|---|
| `SLUR_BOW` | 9.3 | base arch height; short slurs ≈ the old quadratic peak (`LIFT + 0.75·H ≈ 17px`) |
| `SLUR_BOW_PER_PX` | 0.06 | arch height grows with horizontal span (Gould: longer → taller) |
| `SLUR_BOW_MAX` | 22 | ceiling so long slurs don't balloon |
| `SLUR_THICKNESS` | 1.5 | `renderCurve` return-pass offset = mid-body swell |
| `SLUR_OUTLINE` | 1 | pinned stroke width around the curve (sharp tips, not inherited-thick) |
| `SLUR_LIFT` | 10 | gap from notehead to the arc endpoints |
| `SLUR_ARC` | 14 | cross-system half-arc apex rise above its endpoint line |

Shape math lives in `slurArchCps(p0, p1, direction)` (vertical-above-chord-line + span height) and the
draw/sample in `drawSlurArc(...)` (calls `renderCurve`, then reconstructs the cubic for the bbox +
proximity `points`). See §7.2 for the control-point math we mirror.

### 9.5 Sources
- MuseScore slur rewrite — PR [#12280](https://github.com/musescore/MuseScore/pull/12280)
- Dorico dev diary [part 13](https://blog.dorico.com/2016/03/development-diary-part-13/) ·
  [individual slur thickness](https://steinberg.help/dorico/v1/en/dorico/topics/notation_reference/notation_reference_slurs_thickness_changing_individually_t.html)
- Elaine Gould, *Behind Bars* — [overview](https://en.wikipedia.org/wiki/Behind_Bars_(book))
