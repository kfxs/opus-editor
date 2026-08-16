# Slurs — Implementation Plan

Status: **COMPLETE — Phases 0–9 all DONE & COMMITTED on `main`, user-verified (628 tests green).**
Phases 0–4 = core feature; Phase 5 = VexFlow `Curve` migration + auto-shape ("good default"); Phase 6 =
editable `cps` model; Phase 7 = draggable handles; Phase 8 = nested-slur concentric stacking; Phase 9 =
flip side with `x` + stem-aware endpoints. Deferred (documented, not blockers): endpoint/tip handles &
re-anchoring, dual-thickness taper, collision avoidance, stem-side clearance bump. This
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

### Phase 7 — Draggable control-point handles — DONE & COMMITTED (b735250), user-verified
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

### Phase 8 — Nested / overlapping-slur disambiguation — DONE & COMMITTED (2d248e8)
- [x] **Render-time containment depth, not a create-time counter (deviation from the original sketch).**
      `utils/slurs.slurNestDepths(score)` (pure, unit-tested) returns each slur's nesting *level* in its
      voice: innermost = 0; a slur enclosing nested slurs is `1 + max(level of slurs it strictly
      contains)`. Computed from score-order spans, so it's **order-independent and always correct after
      edits/deletes** — unlike incrementing `Slur.number` on create (which goes stale and conflates the
      MusicXML start/stop id with a height index). `Slur.number` stays reserved for MusicXML export.
- [x] `renderSlurs` lifts each slur's auto bow by `level · SLUR_NEST_GAP` (10px) via the new
      `slurArchCps(..., extraHeight)` param, so outer slurs arch clear of inner ones (Gould). Applied to
      same-line and both cross-system halves. **A manual `cps` shape opts out** of the lift (the user
      controls that height); inner slurs still count toward an outer slur's level regardless of cps.
- [x] Only true **containment** is stacked; partial overlaps (neither span contains the other) stay at
      their own level. Siblings (disjoint inner slurs) lift a container only **one** level, not N.
- [x] Tests: `slurNestDepths` — no slurs / non-overlapping / single nest / triple nest (0/1/2) /
      disjoint-siblings / cross-voice isolation. 627 unit tests + `build:check` green.
- [x] **Manual UI check (user):** draw a long slur over a run, then a shorter slur over notes inside it
      → the outer arc sits clearly above the inner one (concentric, not overlapping).

### Phase 9 — Flip slur side (`x`) + stem-aware endpoints — DONE & COMMITTED (d49b1f7), user-verified
Added post-plan (user request, 2026-06-17): a way to flip a selected slur to the other side.

> **UPDATE 2026-06-25 (commit 8a59444):** `x` is now a **Sibelius-style auto ↔ flipped toggle**, not an
> absolute above↔below setter. An explicit `placement` clears back to the context-aware auto default;
> an auto slur pins the opposite of the last-drawn side (still a visible first flip). Two presses
> round-trip to auto. Same change applied to `flipTie` and `flipTuplet`. Rationale + scope in
> `docs/tuplet-control-plan.md` §4b. The "sets an explicit placement / toggles the explicit side"
> wording below describes the *original* Phase-9 behaviour and is superseded by this toggle.

- [x] **`x` flips a selected slur** above ↔ below. The `x` key already mapped to `flipStemDirection`;
      the `useShortcuts` handler now checks `selectedSlurId` first (flip the slur) and otherwise flips
      the selected note's stem — so `x` is overloaded by selection type (like `deleteSelected`).
- [x] `MusicEngine.flipSlur(id)` sets an **explicit `placement`** (overrides auto stem-based placement).
      For an auto-placed slur the flip targets the opposite of what was **last drawn** — read from the
      registry's `slurDirection` (stored on each slur element by `renderSlurs`), so the first press always
      visibly flips. One undo step ("Flip slur"); `placement` already round-trips in JSON. The registry
      read is guarded (`getElementRegistry?.()?.getByType?.(…)`) so a stubbed/headless renderer falls
      back to "above".
- [x] **Stem-aware endpoints (Gould), `slurEndpointY(staveNote, noteIndex, direction)`:** a slur on the
      **notehead side** (opposite the stems) attaches at the notehead; on the **stem side** it attaches
      at the **stem tip** (`getStemExtents().topY`, which is the tip; `baseY` is the notehead). Each
      endpoint uses its **own** note's `getStemDirection()` (`slurAbove === stemUp` ⇒ stem side). Falls
      back to the notehead for stemless notes (whole notes / NaN extent). Applies to auto slurs too but
      only changes stem-side ones, so normal slurs are unchanged and a flipped slur springs from the
      stem tips instead of crossing the stems.
- [x] Tests: `flipSlur` toggle + one-step undo + unknown-id no-op. 628 unit tests + `build:check` green.
- [ ] **Deferred polish (not built):** bow height is the same on both sides, so a stem-side slur can read
      a touch cramped against the stems — a small stem-side clearance bump is a possible later tweak.

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

⏭️ **§11 (2026-08-15) reopens this with evidence rather than another iteration.** The four attempts
above were tuned by eye against no reference; three engines have since been read at source, and the
one thing they agree on is that #4's *structure* is right (a symmetric arc rotated onto the chord)
while its *numbers* are ours alone. Read §11 before touching a constant here.

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

### 9.4 Our current calibration (the only knobs; `rendering/SlurRenderer.ts`)

⚠️ **This table said `VexFlowRenderer.ts` and listed two constants that no longer exist** — the
slur code moved to its own module and the weight moved again, to `rendering/curveArc.ts`, shared
with ties. Corrected 2026-08-15.

| Constant | Value | in staff spaces | Role |
|---|---|---|---|
| `SLUR_BOW` | 9.3 | 0.93 | base arch height (a cubic's apex is 0.75·H) |
| `SLUR_BOW_PER_PX` | 0.06 | 0.06 /sp | arch height grows with span (Gould: longer → taller) |
| `SLUR_BOW_MAX` | 22 | 2.2 | ceiling so long slurs don't balloon — ⭐ the CAP is Gould's (*"the curve of a long slur is flattened"*, p.109); the GROWTH is not, see §11.7 |
| `SLUR_LIFT` | 10 | 1.0 | gap from notehead to the arc endpoints |
| `SLUR_ARC` | 14 | 1.4 | cross-system half-arc apex rise above its endpoint line |
| `SLUR_NEST_GAP` | 10 | 1.0 | extra bow height per nesting level |
| `CURVE_THICKNESS` | 2.7 | 0.27 | in `curveArc.ts`, **shared with ties** — one weight, only the arch differs |

⚠️ **They are written in PIXELS and behave as staff spaces**, because the drawing runs inside the
staff's own `scale(k)` group where 10 px = 1 space at default size. It works, but they are the only
geometry in the renderer that does not *say* what unit it is in — which is why §11's comparison had
to convert every one of them by hand. Worth restating in spaces regardless of what §11 changes.

Shape math lives in `slurArchCps(p0, p1, direction)` (vertical-above-chord-line + span height) and the
draw/sample in `drawSlurArc(...)` (calls `renderCurve`, then reconstructs the cubic for the bbox +
proximity `points`). See §7.2 for the control-point math we mirror.

### 9.5 Sources
- MuseScore slur rewrite — PR [#12280](https://github.com/musescore/MuseScore/pull/12280)
- Dorico dev diary [part 13](https://blog.dorico.com/2016/03/development-diary-part-13/) ·
  [individual slur thickness](https://steinberg.help/dorico/v1/en/dorico/topics/notation_reference/notation_reference_slurs_thickness_changing_individually_t.html)
- Elaine Gould, *Behind Bars* — [overview](https://en.wikipedia.org/wiki/Behind_Bars_(book))

---

## 10. Multi-voice (2026-06-25, on main, not pushed)
Slurs brought up to the multi-voice standard the notes already had (parallels the tie work the same
session — see `docs/multi-voice-plan.md`):
- **Creation (`s`) is voice-aware** (`a354a4c`): `createSlur` previously filtered the selection to
  voice 0 only and hardcoded `voice: 0`, so `s` did nothing in voice 2. Now it derives the slur's
  voice from the selection's first note, filters to that voice, and stores it; `nextDistinctSlot`
  (the single-note end-anchor resolver) is scoped to the start note's voice so the end anchor stays
  in the same voice.
- **Direction default is voice-aware** (`9b1b46d`): in a multi-voice bar a slur follows its
  **voice's outer side** — V1 above, V2 below — instead of the stem/notehead side. The old
  stem-following default *inverted* the rule under multi-voice (V1 stems forced up → slur below;
  V2 stems forced down → slur above). Single-voice keeps the notehead-side default; `x`/`placement`
  still wins. Voice read from the start note's chord slot (fallback `slur.voice`); multi-voice is
  the shared `new Set(slots.map(voice)).size > 1` test.
- **Selection colour = voice colour** (`27ba657`): a selected slur paints in its voice's colour
  (V1 blue / V2 green) not orange. `Slur.voice` is unreliable (created 0 historically), so the
  highlight derives the voice from the start note. Group-scoped recolor + dual fill+stroke override
  unchanged.

---

## 11. 🔎🔎 THREE ENGINES READ AT SOURCE (2026-08-15) — ⛔ don't redo this

His call, and the reason: *"lets think in the slur and the curve we are selecting as default, i
think we got this number by trial and error… i think sometime the curve should take into acount the
entonation or shape of the melody and it maybe behaive diferent on up or down of the stem."* Three
agents read LilyPond, MuseScore and Verovio C++ in parallel, each blind to the others. A fourth is
reading the published treatises (Gould, Ross, Stone, Read, Chlapik) and **has not reported yet** —
§11.7 lists what is still waiting on it.

### 11.1 ⭐⭐ THE CONTOUR QUESTION — the answer is no, unanimously, and it is not the obvious no

**No engine has a melodic-contour concept.** There is no rising/falling/arch/valley classifier
anywhere in any of the three. Contour reaches the shape by exactly two routes:

1. **The two ENDPOINTS tilt it.** All three place each end at its own note and let the chord between
   them be the axis. Verovio is the clearest: it computes `atan2(p2.y − p1.y, …)`, rotates the curve
   so the chord is horizontal, builds a **symmetric** arc, and rotates back — *a slur is a horizontal
   slur rigidly rotated onto the line between its ends.* LilyPond's `musical_dy_` is literally
   `y(last head) − y(first head)`. ⭐ **So an ARCH and a VALLEY with the same first and last notes get
   identical curves in all three.**
2. **INTERIOR notes push it — but as INK, not as pitch.** They enter only as bounding boxes that
   collide with the drawn ribbon. A contour that happens not to collide gets no response at all.

⭐ **The one exception, and it is worth having**: MuseScore's *"float along the stem"* rule
(`slurtielayout.cpp:683–721`, its comment says `// see for example Gould p. 111`) — when the two
chords have **opposite** stem directions and the slur is on the stem side of one, that endpoint
slides along its stem by **half** the vertical distance between the two slur-side notes, clamped at
the stem end + 1 space. That is a published rule in which the melodic interval directly moves an
endpoint.

**We already do route 1** (`slurArchCps` adds `±0.25·dy` so the arch follows the chord) and **nothing
of route 2** — no interior note can affect our curve. That is the real gap, and it is a large one.

### 11.2 ⭐⭐ THE DIRECTION QUESTION — two separate answers

**(a) Which SIDE: scan every note, and we did not.** All three scan the whole span; ours read the
START note's stem alone.

| engine | rule |
|---|---|
| LilyPond | `Slur::calc_direction` — `d = DOWN`; over every note column, `if (!has_rests(col) && dir(col) == DOWN) { d = UP; break; }` |
| MuseScore | `computeUp` — `setUp(!startCR->up())`, **then** `else if (isDirectionMixture(chord1, chord2, ctx)) setUp(true)`, walking every chord between |
| Verovio | `CalcSlurDirectionFunctor` — `if (system->HasMixedDrawingStemDir(start, end))` force above |

⭐ MuseScore's first line **is** our whole rule, so ours was theirs minus the scan. ✅ **BUILT
2026-08-15** as `rendering/slurDirection.ts` (`slurSideFromStems` + `coveredChordIds`), reading the
stems VexFlow actually DREW (beaming forces a group, so the model's answer differs) and scoped to the
slur's own lane — MuseScore scopes the same scan by `c1->track()`. The voice-parity rule (§10) still
outranks it. ⚠️ The **mixed → above** tie-break is provisional: three implementations agreeing is not
a published rule, and the literature agent is still out. One line, one test.
⚠️ Untouched and still arbitrary: **no stems anywhere** (a slur between two whole notes) returns
above. Verovio answers that from the pitch (`isAboveStaffCenter`); LilyPond would say below.

**(b) Is an above-slur a MIRROR of a below-slur? The arc is; the problem is not** — and both
LilyPond and MuseScore say so independently. The Bézier arithmetic is a pure `±1` sign flip in all
three. What is not mirrored:

- **the attachment**: notehead side vs stem tip depends on whether the slur's side *agrees* with the
  stem, so the same slur attaches at a stem tip on one chord and a notehead on another. MuseScore:
  notehead side is 0.9 sp out, stem side is 0.5 sp **inside** the stem tip;
- **the horizontal stem dodge** lands on the start for stem-up and the end for stem-down (MuseScore
  `672–681` vs `807–819`) — mirrored only under the *combined* up↔down **and** start↔end flip;
- **which note of a CHORD is the anchor** (top for an up-slur, bottom for a down-slur), which changes
  LilyPond's `musical_dy_` itself, so above and below can differ by more than a reflection;
- LilyPond has one scoring rule that is **point**-symmetric rather than mirror-symmetric: an up-slur
  gets a 5× discount for cutting the LEFT edge's stem, a down-slur the RIGHT (`slur-configuration.cc:295–302`).

**We do (b) correctly already** — `slurEndpointY` attaches at the notehead on the notehead side and
the stem tip on the stem side — but with no inset numbers of our own to compare.

### 11.3 ⭐⭐ THE HEIGHT LAW — three serious engines, three different answers

Drawn apex in staff spaces (a cubic's apex is 0.75 × control height in all four, so these are
comparable):

| slur width | LilyPond | Verovio | MuseScore | **ours** |
|---|---|---|---|---|
| 4 sp | 0.64 | 0.60 | 0.75 | **0.88** |
| 8 | 0.96 | 1.13 | 1.06 | **1.06** |
| 16 | 1.21 | 1.13 | 1.50 | **1.42** |
| 32 | 1.35 | 1.13 | 2.12 | **1.65** |
| 64 | 1.42 | 1.13 | 3.00 | **1.65** |

- **LilyPond** — `slur_height(w) = h_inf · (2/π)·atan(π·r₀·w / 2h_inf)` (`bezier-bow.cc:28–38`), with
  `height-limit` **2.0** and `ratio` **0.25**. Linear with slope `ratio` at small widths, asymptotic
  to `height-limit`. The authors state that intent in a comment. (`PhrasingSlur` uses ratio 0.333.)
- **Verovio** — `clamp(dist/5, 1.2, 3.0)` MEI units = `clamp(w/5, 0.6, 1.5)` sp, × `slurCurveFactor`
  (default 1.0). **Saturates at 7.5 sp and never grows again.**
- **MuseScore** — `sqrt(d/4)` spatia, **unclamped**: a 64-space slur arcs 3 spaces high. (Its TIES
  *are* clamped, `tieMinShoulderHeight` 0.3 / `tieMaxShoulderHeight` 2.0 — slurs are not.)
- **ours** — `min(0.93 + 0.06·w, 2.2)`, i.e. a floor plus a slope. We are the only one with a
  non-zero intercept, and we are taller than LilyPond and Verovio at every width.

⏭️ **No decision taken.** There is no consensus to adopt, so this is a taste call and the treatises
may or may not settle it. ⛔ Do not "fix" our numbers to any one engine's on the strength of this
table alone.

### 11.4 The INDENT — a second shape knob we do not have

How far in the control points sit, as a fraction of the span, decides the shoulders independently of
the height:

- **ours**: fixed `w/4` each side (so the inner pair spans half the chord), at every length;
- **LilyPond**: grows and then saturates around 3–4 sp absolute — its comment says a fixed fraction
  *"gives a certain hookiness at the end"* on long slurs (`bezier-bow.cc:78–104`);
- **Verovio**: `dist/6` for short slurs sliding to `dist/3` for long ones, via `baseVal = 8 − log₂(ratio)`;
- **MuseScore**: a four-branch step table on length — 0.60 / 0.5 / 0.6 / 0.7 of the chord.

So all three vary it with length and we do not. On a 32-space slur our control points sit 8 spaces in
where LilyPond's sit ~2.9 — a visible difference in the shoulders at identical height.

### 11.5 ⭐ THE SLANT RULES — the actionable part, and the one place they agree in substance

LilyPond never computes a slant; it enumerates candidate endpoint pairs on a half-space grid out to
`region-size` 4 sp, scores each, and takes the cheapest. But its scoring *states* the rules, and they
are implementable directly against a formula:

| rule | constant | forbids |
|---|---|---|
| `steeper-slope-factor` | 50 | the slur rising **more** than the first-to-last interval does (+0.2 sp) |
| `same-slope-penalty` | 20 | the slur leaning **against** the melody |
| `non-horizontal-penalty` | 15 | a tilted slur when the two end notes are level |
| `max-slope` | 1.1 (≈48°) | a diagonal stroke |

Verovio's equivalent is a single `slurMaxSlope` = **60°**, enforced by *raising the lower endpoint*
rather than rotating (`GetAdjustedSlurAngle`). MuseScore has **no global slant clamp at all** — only a
45° `STEEP_LIMIT` that biases which endpoint moves during collision avoidance.

⚠️ **We have none of these.** `slurArchCps` tilts by `±0.25·dy` with no bound and no relation to the
melodic interval. ⭐ Two small findings worth keeping: LilyPond's `max-slope` term is **added twice**
(lines 495–498 and 509–512 are identical — effectively factor 20, and it looks like a copy-paste
slip); and its manual's descriptions of `non-horizontal-penalty` and `same-slope-penalty` are
**swapped relative to the code** — trust the code.

⭐ And Verovio has a genuine slant→shape coupling we could copy cheaply: `GetMinControlPointAngle`
raises the minimum control angle from 30° by up to +15° in proportion to how steeply the slur is
tilted, scaled by a length factor that is full below 4 sp and zero above 8 — **a short, steeply
tilted slur is deliberately made rounder.** Nothing does the reverse.

### 11.6 INTERIOR NOTES — what "collision avoidance" actually costs

All three have it; we have none. Their shapes differ, which matters if we ever build one:

- **LilyPond** — no repair pass at all: candidates are *scored* against every covered head and stem
  (`head-encompass-penalty` **1000** is a veto; `stem-encompass-penalty` 30 is a strong preference),
  plus a `head-slur-distance-factor` **variance** term that rewards an *even* distance from all
  covered heads. Interior notes can only ever raise the arc, and only symmetrically (`fit_factor`).
- **MuseScore** — an **iterative** solve, up to **30 iterations**, alternating *even iterations
  deform the shape / odd iterations move the endpoints*, with a `balance` per end deciding which
  gives. The slur is sampled as 20 rectangles, collisions localized to left/mid/right thirds, and a
  third-collision moves that shoulder a full step and the other **half** a step — so its arch really
  does become **asymmetric**, which is the one thing LilyPond refuses to do.
- **Verovio** — a **single feed-forward pass**: filter obstacles, maybe switch to a secondary
  endpoint, shift endpoints, offset control points horizontally, then solve a set of linear
  constraints `3(1−t)²t·x + 3(1−t)t²·y ≥ intersection` (the Bézier's own sensitivity to each control
  point) and walk out along the averaged normal. No loop; nothing re-checks an over-correction.

### 11.7 ⭐⭐ WHAT THE BOOKS SAY — Gould, Gedan, Ross (2026-08-15) — ⛔ don't redo

A fourth agent read the published literature. **Obtained**: Gould, *Behind Bars* (full OCR + page
scans, `archive.org/details/behind-bars-by-elaine-gould`); Gedan, *Notenschrift für Fortgeschrittene*
(German, PDF); Byrd, *Music Notation by Computer* (1984); the notat.io engravers' forum; SMuFL/Bravura.
**Not obtainable** (lending-restricted, so *unknown* rather than silent): **Ross**, **Read**, **Stone**,
**Chlapik**, and Boosey & Hawkes' house manual. ❌ **MOLA's guidelines are genuinely silent** — checked
in full, no slur or tie content at all.

**⭐⭐ THE DIRECTION SCAN IS GOULD'S RULE, and so is the tie-break.** Both were built on three
implementations agreeing; the book says both outright.

> p. 112: *"**Take all the notes within the slur into account** when determining whether the slur goes
> above or below the stave — do not swap position between systems."*
> p. 110: *"When all stems within the slur are in the same direction, the slur is usually placed
> between the outer noteheads."* … *"When groups of **mixed stem direction** are encompassed by a
> slur, place the slur **above the stave**, except when a beam may be in the way."*

✅ So §11.2a's provisional flag is **cleared**: mixed → above is published, and the scan is the rule
rather than an implementation detail three engines happened to share. ⏭️ *"except when a beam may be
in the way"* is a further exception none of the three engines implements and we do not either.

**✅ AND THE STEMLESS CASE TURNS OUT TO BE BUILT ALREADY.** p. 110: *"For **stemless notes**, place
the slur as if the notes were stemmed (a). Slurs for **notes on the centre line** … are **usually
treated as if the notes had down-stems** (b)."* Verovio does this explicitly (`isAboveStaffCenter`).
⭐ We get it for free and had not noticed: a whole note draws no stem but `NoteBuilder` still assigns
it a stem **direction** from its pitch, so `getStemDirection()` answers like any other note and the
pitch decides. **Measured through the real render pipeline** (2026-08-15, `e2e/slur.e2e.ts`): two
high whole notes slur ABOVE, two low ones slur BELOW. ⚠️ So the `[]` branch of `slurSideFromStems`
is a defence, NOT our stemless rule — it fires only when a covered chord is missing from
`staveNoteMap` entirely. ⛔ Do not "implement the stemless case"; it is done, and a second rule would
fight the first.

⚠️ A trap worth recording: a bare `new StaveNote(...)` reports stem direction **1 for every pitch**,
so a headless check of this agrees with itself and proves nothing. It had to be measured in the
browser for exactly that reason.

**🚨 GOULD SAYS A LONG SLUR IS FLATTER, NOT TALLER — and §9.4's comment claims the opposite.**

> p. 109: *"**The curve of a long slur is flattened** in order to be as close to the stave as
> possible. In fact, **a long slur may be completely flat in the middle**, since a rounded one
> extends too far from the stave."*

Our `SLUR_BOW_MAX` comment says *"(Gould: longer → taller, capped)"*. The *cap* is hers; the
*growth* is not — she never says a longer slur arcs higher, and MuseScore's unbounded `sqrt(d/4)`
(§11.3) is flatly against her. ⭐ It also means our capped law and LilyPond's asymptote are the two
that agree with the book, and the practitioner table below saturates the same way.

**⚠️ GOULD GIVES NO SLUR ARC HEIGHT AT ALL** — no minimum, no maximum, no ratio, and no slur
thickness either (she specifies thickness for beams, hairpins, tenuto lines, barlines, ledger lines
and rests, but for slurs only *"tapered arc"*). The numbers that exist are a working engraver's
(John Ruggero, notat.io t=107), and they are worth having because they are a *length→height table*:

| span | height | control-point inset |
|---|---|---|
| short | 0.7 sp | 30% |
| medium | 2 sp | 25% |
| long | 3 sp | 20% |
| extra long | 3.25 sp | 18% |

Note both trends: height **saturates** (3 → 3.25) and the inset **falls** with length — which is
§11.4's indent, moving the way LilyPond and Verovio move it and we do not.

**⭐⭐ THE SLANT RULES ARE PUBLISHED — Gedan, not just LilyPond.** §11.5 asked whether they had a
source; they do, and it is explicit about the two failure modes:

> Gedan p. 17: *"Gleichzeitig müssen sie **dem Melodieverlauf folgen**."* (they must follow the
> melodic line), with two labelled faults: *"[c] Die Melodie bewegt sich abwärts, der Bogen aber
> bleibt horizontal"* (the melody descends but the slur stays horizontal) and *"[b] Die Bogenrichtung
> **widerspricht** dem Melodieverlauf"* (the slur's direction contradicts the melodic line).

Those are exactly LilyPond's `non-horizontal-penalty` and `same-slope-penalty`. ✅ Both have an
authority. ❌ **A maximum slant does not** — no source gives one, so LilyPond's `max-slope` 1.1 and
Verovio's 60° are inventions. Gedan's only remedy for extreme cases is qualitative: *"Man bringt die
Spitzen solcher Bögen auf **Distanzposition**"* (move the tips away from the noteheads to soften the
difference), and practitioners report hand engravers shifting a steep slur **half a notehead**
sideways (notat.io t=861, from Cortot's and Mikuli's Chopin).

**⭐ MuseScore's `// see for example Gould p. 111` checks out**, verbatim:

> p. 111: *"When outer notes have opposite stem directions, move the slur at the stem end towards the
> noteheads **so it does not tilt contrary to the direction of the pitches**."*

**⭐⭐ AND THE BROKEN-SLUR RULE SAYS OUR CONSTANT IS WRONG.**

> p. 112: *"**The whole slur should tilt in the direction of the pitches.** A slur starting on the
> last note of a system or finishing on the first note of a system must be **angled in the direction
> of the final pitch** on the new system, so as to look clearly open-ended (this differentiates an
> open-ended slur from an open-ended tie)."*

We use a flat `SLUR_ARC` = 1.4 sp rise for every half-arc, with no reference to pitch. Verovio does
implement this (`ConsiderMelodicDirection`, `pitchDiff × 0.25 sp` per diatonic step); LilyPond
explicitly switches all melodic slope rules **off** for a broken half. ⏭️ Ours is the one that has no
opinion at all, and Gould says it should.

### 11.8 ⭐⭐ TIES ARE A DIFFERENT SHAPE — and ours is far too flat

The books are much more prescriptive about ties than slurs, and the difference is load-bearing:

> p. 60: *"A tie is a **tapered arc, symmetrical in shape**"* … *"**ties tend to have a flatter arc,
> to allow room for slurs and to differentiate the two**"* … *"The tie extends from notehead to
> notehead: **if one or both ends point to a stem, the arc becomes a slur**."*
> p. 68: *"A tie by nature should be **kept as flat as possible**, to distinguish it from a slur."*
> p. 65 (system break): *"the open-ended tie **keeps its symmetrical shape**. This symmetrical curve
> ensures it is not mistaken for a slur nor a glissando line"* — the "not" example is labelled
> **"ties too flat"**.

⭐ So the slur/tie split we already have is the published one: **a slur tilts, a tie stays level and
symmetrical**, and a tie never touches a stem.

🚨🚨 **⛔ THE CLAIM BELOW IS WITHDRAWN — SEE §13.1–13.2.** It was written before any engine's tie code
had been read. Reading all three showed that **none of them draws 1 sp of apex at any ordinary
length**, so *"deep"* is almost certainly the TOTAL REACH (endpoint lift + apex), under which ours is
**1.10 sp — inside her band**. And ⭐ **his call, 2026-08-15: we keep our height.** The paragraph
stays because the quote is right and only the inference from it was wrong.

🚨 **But the one number she gives says our tie is 2.5–3.75× too flat:**

> p. 61: *"The curve of the tie should be sufficiently round to be **conspicuous through a
> stave-line**. Ideally, **a shallow tie is 1–1½ stave-spaces deep**."*

Ours is `TIE_BOW` 0.53 sp of control height → a drawn apex of **0.40 sp**. And a working engraver
independently reports the same failure in Finale's defaults — Knut, notat.io t=107: ties whose curve
spans *"only a single space in height"* are too flat. ⚠️ Our tie also has **no length dependence at
all**, where Gould has three regimes: under a space when very short or when flattened to clear
another part; 1–1½ normally; and *"the curve of a long tie is flattened to prevent excessively
variable curve heights between ties."* ⏭️ Unbuilt; the single most actionable number in this whole
section.

Other tie rules we should check ourselves against, all Gould, all verbatim: *"The tie should almost
touch each notehead"* (p. 61); *"the tie starts and finishes at the centre of the notehead"* where
there is room, aligning with its **edge** when it must come closer (p. 62); *"A tie curves away from
the stems"* and, for consecutive opposite stems, *"**Ties curve away from the middle stave-line**"*
(p. 64); double-stemmed parts take *"the upper part … upward-curving ties, the lower part
downward-curving"* (p. 67); and with a slur present, *"place **ties and slurs in opposite
directions**"* (p. 71).

### 11.9 The other numbers the books gave, against ours

| quantity | published | ours |
|---|---|---|
| slur endpoint ↔ notehead centre, **minimum** | **½ sp** (Gould p. 110) | `SLUR_LIFT` 1.0 sp — above her floor, fine |
| slur endpoint ↔ staff line | ¼ sp, must not touch (Dorico docs, and Gedan states the rule) | ⏭️ we have no such rule |
| slur/tie thickness at the **tip** | **0.10 sp** (Bravura `slurEndpointThickness`) | — |
| slur/tie thickness at the **middle** | **0.22 sp** (Bravura `slurMidpointThickness`) | `CURVE_THICKNESS` 0.27 sp, a **single** value — no taper, and heavier than the published midpoint |
| long slur endpoints | *"Long slurs always start and end over or under the **centre of a notehead**"* (Ross p. 141, via notat.io t=861 — the one sentence recovered from Ross) | we attach at the tie edges |

### 11.10 ⏭️ WHAT IS STILL OPEN AFTER ALL FOUR

- **Arc height**: no consensus and no published number for slurs. Gould says long ⇒ flatter, which
  rules out MuseScore's unbounded law but not much else. Our floor-plus-slope-capped shape is
  defensible; the constants are still ours alone.
- **Interior notes**: §11.6. All three engines have collision avoidance and we have none; the books
  state the *constraints* (*"always remain outside a beam"*, *"must not obscure a ledger line"*,
  *"all notes must appear to be included in a slur"* p. 322) but never say interior notes shape the
  arc. A large, separate project.
- **The tie height number** (§11.8) — small, concrete, and the clearest single improvement available.
- **The broken-slur tilt** (§11.7) — Gould is explicit and we have a constant.
- **Taper** — Bravura's 0.10/0.22 against our single 0.27. §9.3's "dual-thickness taper" gap, now
  with numbers.
- ❌ **Not open, because no authority exists**: a maximum slant.

### 11.11 ⏭️⏭️ THE SHORTLIST — what the research says we could improve, ranked

Everything here is *unbuilt*. Each row names the published rule, the file, and an honest size. ⛔
Nothing in this list was decided; it is the analysis input, not a plan.

| # | what | the rule, and who says it | where | size |
|---|---|---|---|---|
| 1 | ~~**Tie arc height**~~ ⛔ **WITHDRAWN — §13.1–13.2 + his call.** Ours is 0.40 sp constant; LilyPond peaks at 0.75, **Verovio is a constant too**, and only MuseScore climbs past 1. Replaced in §12 by the tie-vs-**staff-line** phase, which is what Gould's sentence is actually about | `TieRenderer.TIE_BOW` | — |
| 2 | **Slant rules** | Gedan p.17 (*must follow the melodic line*; a horizontal slur over a descending melody is a labelled fault) + LilyPond's `same-slope-penalty` / `non-horizontal-penalty` / `steeper-slope-factor`. Ours tilts by `±0.25·dy`, **unbounded and unrelated to the interval** | `slurArchCps` | **small** — three clamps on a number we already compute |
| 3 | **Broken-slur tilt** | Gould p.112: *"must be **angled in the direction of the final pitch** on the new system"*. Verovio: `pitchDiff × 0.25 sp` per diatonic step. Ours: a flat `SLUR_ARC` 1.4 sp, no pitch input | `SlurRenderer` BEGIN/END segments | **small–medium** |
| 4 | **Taper** | Bravura: **0.10 sp** at the tip, **0.22 sp** at the middle. Ours: one `CURVE_THICKNESS` 0.27, heavier than the published *midpoint* and with no taper. ⚠️ VexFlow's `Curve` cannot do it (§9.3) — needs a self-rolled tapered cubic | `curveArc.ts` | **medium** |
| 5 | **Height law + indent** | No consensus: LilyPond `h_inf·(2/π)atan(π·r₀·w/2h_inf)` asymptotic to 2.0; Verovio saturates at 1.5; MuseScore unbounded `sqrt(d/4)`; a working engraver's table saturates at ~3. ⭐ Gould only constrains the *direction*: *"the curve of a long slur is **flattened**"*. Our indent is a fixed `w/4` where **all three vary it with length** | `slurArchCps` | **medium**, and a taste call |
| 6 | **Constants in pixels** | Hygiene, not engraving: `SLUR_*` and `TIE_*` are px that behave as staff spaces because the draw runs inside the staff's scale group. Every comparison in §11 had to convert them by hand | `SlurRenderer`, `TieRenderer` | **small** |
| 7 | **Gould's beam exception** | p.110: mixed stems go above *"**except when a beam may be in the way**"*. No engine implements it; nor do we | `slurDirection` | **small–medium** |
| 8 | **Interior notes** | All three engines have collision avoidance; we have none, so nothing between the endpoints can affect our curve. The books state only *constraints* (*"always remain outside a beam"*, *"must not obscure a ledger line"*, *"all notes must appear to be included"* p.322), never that interior notes shape the arc | new module | **large** — a project |

⚠️ **Tie rules we have NOT checked ourselves against** (all Gould, all verbatim, all in §11.8): *"A
tie curves away from the stems"*; for consecutive opposite stems *"**Ties curve away from the middle
stave-line**"* (p.64); double-stemmed parts take upward ties in the upper voice and downward in the
lower (p.67); with a slur present, *"place **ties and slurs in opposite directions**"* (p.71); *"the
tie starts and finishes at the **centre of the notehead**"*, aligning with its **edge** when it must
come closer (p.62). ⛔ Read `TieRenderer` before assuming any of these is missing *or* present.
✅ **The first two of those are now checked and BUILT — §11.12.**

⭐ **The one thing the research settled outright is already built**: the direction scan (§11.2a,
§11.7). Everything else above is open.

### 11.12 ✅ THE CODE READ BACK (2026-08-15) — and the one thing that was a BUG, not a taste call

§11.11 was written from the literature inwards. Reading our own two renderers outwards against it
turned up what the research had not been looking for. **⛔ Don't re-derive this list; the numbers in
it were measured, not estimated.**

**🚨 BUILT: the tie curved the wrong way on three clefs out of four.** `getTieDirection` decided
from the note's **diatonic distance to the middle line** — and asked for that middle line with a
literal `middleLineDiatonicPos('treble')`, diatonic **34**, inside a function whose `Measure`
argument carried the clefs it needed. Bass's middle line is **22**. So on a bass staff every note
from **D3 to A4** — nearly the whole staff — measured as *below the middle line* and curved **down**,
which above the real middle line is the side its own down-stem already occupies: Gould p. 64
inverted. Alto (28) and tenor (26) were wrong the same way. **There was no spec naming the function
anywhere.** Now `rendering/tieDirection.ts` + `tieDirection.test.ts` + `e2e/tie.e2e.ts`, the twin of
`slurDirection`, with Gould p. 64's two rules in her order: **away from the stems as DRAWN** (both
ends — beaming forces a group, so the model's own direction is not the drawn one), and only when the
two stems **disagree**, away from the **middle line of the clef in force**. The flip override and the
multi-voice parity rule still outrank both. ⚠️ In the live pipeline the clef branch fires *only* for
opposite stems — a drawn note always reports a direction — which is why it is pinned headless.

**⏭️ Still open, found the same way:**

| what | measured | size |
|---|---|---|
| **A broken tie is drawn by a DIFFERENT primitive** — same-line ties go through `drawCurveArc`, the two cross-system halves are raw VexFlow `StaveTie`s: quadratic, apex `cp1/2` = 4px (which *matches* our 0.40 sp), but a belly of `cp2−cp1` = **4px against our `CURVE_THICKNESS` 2.7**, and a `cp1Short/cp2Short` shape that swaps in silently under the short cutoff. Gould p. 65 wants the open-ended tie to keep the **same** shape. ⚠️ So §11.11 #1 has to land in **two** places | 1.5× weight mismatch | small–medium |
| **A tie's hit-target is a padded RECTANGLE** (`elements/tie.ts`), where a slur registers 16 sampled cubic points. The one span element still selectable by the empty air under its arc | — | small |
| **A slur attaches to whichever chord note the user anchored**, not the outer one — `slurEndpointY` uses `ys[noteIndex]`, and §11.2b records that all three engines take the top note for an up-slur and the bottom for a down-slur | — | small |
| ⭐ **The slant faults are reachable only through the STEM-TIP attachment** — and this *replaces* §11.11 #2. `slurArchCps` lifts the arch vertically above the chord line between the endpoints, so the arc always follows the interval between whatever it attaches to: Gedan's [b] and [c] cannot come from the arc math. They come from `slurEndpointY` attaching one end at a stem tip and the other at a notehead, which can tilt a rising melody's slur downwards. That is exactly Gould p. 111 and exactly MuseScore's *float along the stem* (§11.1) — better-sourced and smaller than three clamps on `dy` | — | small |
| **Slurs are outside the above-staff ladder** — `layout/inkBand.ts` says so in words, so a slur and a trill or ottava can share space | — | belongs with #8 |

✅ **And two things turned out to be RIGHT, so ⛔ don't "fix" them**: `TIE_LIFT` 7px is 0.7 sp from
the notehead *centre*, i.e. 0.2 sp clear of its edge — Gould's *"should almost touch each notehead"*;
and the multi-voice parity rule (p. 67's double-stemmed parts) was already there in both renderers.

---

## 12. ⭐⭐ THE CURVE PLAN (2026-08-15) — what to fix, in order

Everything in §11 turned into one ordered list. **⛔ Nothing here is built.** Each phase is
independent and lands on its own; the order is by *how visible the fault is*, not by how easy.

Two of the columns matter more than the numbers. **Rule** says what kind of change it is —
`PUBLISHED` (a book or Bravura gives the number, so it is correctness and my call is enough) or
`TASTE` (nobody publishes one, three engines disagree, so it needs HIS EYE before it lands).
**Measured** means the "ours" figure came off drawn ink in the browser, not off the constants.

| # | fix | rule | size |
|---|---|---|---|
| 1 | The stem-end endpoint — stop the slur contradicting the melody | **PUBLISHED** (Gould p. 111) | small |
| 2 | Short slurs are too tall (and therefore hooky) — **+ the endpoint x: the head's CENTRE, not its edge** (queued here 2026-08-16, §12.1) | **TASTE** + **PUBLISHED** (Ross p. 141; all 3 engines) | small, one constant + one x |
| 3 | ⭐ **A tie must not sit on a staff line** — the majority behaviour, and we have nothing (**§13.4**) | **PUBLISHED** (Gould p. 61) + 2 of 3 engines | ~~medium~~ **small** — §12.0 #3 |
| 3b | A broken tie changes weight at the system break — migrate it off raw `StaveTie` (and **two more** tie primitives, §12.0 #2) | consistency | ~~small~~ **small–medium** |
| 4 | Curve weight — a taste call **inside** a 0.17–0.30 sp range (**§13.6**) | ~~PUBLISHED~~ **TASTE** — see the hairpin note | one constant |
| 5 | A broken slur has no opinion about pitch | **PUBLISHED** (Gould p. 112) | small–medium |
| 6 | A maximum slant — **60°, his call**, and a short steep slur made rounder | **TASTE, no source at all** | small |
| 7 | Three small ones: px→staff-spaces, the chord anchor, Gould's beam exception (the tie's hit-target **moved into 3b**) | mixed | small each |
| 8 | Interior notes — collision avoidance | constraints published, algorithm nobody's | **a project** |
| ⛔ | ~~The tie is 2.5–3.75× too flat~~ — **WITHDRAWN**, his call on the three-engine table (**§13.1–13.2**) | — | — |

### 12.0 ⭐⭐ THE SECOND CODE READ (2026-08-16) — eight things that change how these phases land

§11.12 read the code for *faults*. This pass read it for *where each fix goes*, and turned up eight
corrections. They are folded into the phases below; this is the summary, and the two starred ones
change the plan's shape rather than its numbers.

**⭐⭐ #1 — every phase here is a MODULE, not an edit.** As written, each phase named a site *inside*
`SlurRenderer` / `TieRenderer` ("the change: `slurEndpointY`, `SlurRenderer`"). That is precisely the
growth CLAUDE.md's ⭐ rule exists to stop, and these two files are the likeliest to absorb it. The
rule's own words: *a slice too thin to be logic is still a slice*. So:

| phase | the module it adds | pure? |
|---|---|---|
| 1 | `rendering/slurStemEndpoint.ts` | **yes** — head ys + stem dirs + tips in, adjusted ys out |
| 2 | `rendering/slurArchHeight.ts` (the height law, both ends of the length range) | **yes** — span in, arch height out |
| 3 | `rendering/tieStaffLineClearance.ts` | **yes** — tie y + the stave's line ys in, a shift out |
| 5 | `rendering/brokenSlurTilt.ts` | **yes** — diatonic difference in, half-arc rise out |
| 6 | `rendering/slurSlantLimit.ts` | **yes** — the two endpoints in, the raised one out |

⭐ **And that overturns one line in Phase 1**: *"⛔ Not headless: it is stem geometry"* is true of the
**integration** only. Each rule above is arithmetic over numbers it is *handed*, so it gets a
`*.test.ts` beside it (a spec moves with its module) and the `e2e` pins only the drawn consequence —
the sign of the tilt, the distance to the nearest line. ⚠️ The jsdom trap (`docs/ARCHITECTURE.md`)
bites when a test *measures* glyphs, not when it feeds a pure function known coordinates.

**⭐⭐ #2 — the tie is drawn by FOUR primitives, not the two Phase 3b names.**

| where | primitive | in the plan? |
|---|---|---|
| same-line tie | `TieRenderer.drawFlatTie` → `drawCurveArc` | ✅ |
| the two cross-system halves | raw `StaveTie` (`TieRenderer.ts:167, :195`) | ✅ Phase 3b |
| **the PENDING-tie preview** | raw `StaveTie` (`VexFlowRenderer.ts:4189`) | ❌ **missed** |
| the armed tool's GHOST | `drawCurveArc`, same `TIE_BOW`/`CURVE_THICKNESS` (`GhostRenderer.ts:932`) | ❌ **missed** |

So a tie **changes shape at the moment you commit it** — the pending preview is the same defect as
the broken tie's, and it belongs in the same phase. The ghost is the opposite case: it already
follows Phases 2 and 4 for free, under the invariant its own doc comment states — *arm the tool and
the arc under the cursor IS the arc you get*. ⚠️ **Phase 3 breaks that invariant on purpose**: the
ghost floats at a cursor with no staff under it, so there are no lines to clear. That exemption has
to be written where the ghost lives, or a later reader finds the disagreement and "fixes" it.

**#3 — Phase 3 is smaller than "new machinery", because our tie shape is a CONSTANT.** Worked out
from `TIE_LIFT` 0.70 sp + `TIE_BOW`'s 0.40 sp apex, there are exactly two cases and neither needs a
search — see the phase.

**#4 — Phase 3b is bigger than "small".** `StaveTie` computes its own run-to-the-system-edge x; we
would compute it, and the helpers exist only as `SlurRenderer` exports.

**#5 — Phase 5 must read PITCH, not y.** The two ends are on different systems, and 🚨 cross-system
coordinates are not one ruler (the hairpin taught us this the hard way, `docs/dynamics-line-and-hairpins-plan.md`).

**#6 — Phases 1 and 6 need a stated place in the endpoint order**, ahead of the user's endpoint
offset, or the blue handles disagree with the ink.

**#7 — Phase 1 is silent about FANNED MEMBERS**, which have their own endpoint branch and their own
stem tip (`SlurRenderer.resolveSlurEnd`).

**#8 — Phases 2, 4 and 6 are all TASTE and all change what he sees.** Three separate approval gates
cost three round trips; one rendering with the candidates side by side settles all three. ⭐ And
Phase 7's px→staff-spaces conversion is safe to land *first*: `staffSpacesToPixels` reads
`stave.getSpacingBetweenLines()`, which is the **unscaled** spacing (a small staff is a `<g>`
transform, not a smaller stave), so the conversion preserves `CURVE_THICKNESS`'s ⛔ *never multiply
by the staff size* property — and the taste numbers then get proposed in the units the research
measured them in.

### Phase 1 — the stem-end endpoint (Gould p. 111) — ✅ BUILT 2026-08-16 (not committed)

> ✅ **`rendering/slurStemEndpoint.ts`** + `slurStemEndpoint.test.ts` + four cases in
> `e2e/slur.e2e.ts`. `SlurRenderer` no longer decides an attachment: `slurEndpointY` is gone, and
> `SlurEnd` carries a `SlurAttachment` (head, stem tip, stem direction) for both a real note and a
> fanned member, so the pair goes to one module and comes back as two Ys.
>
> **Measured on drawn ink, and both numbers are the ones predicted below**: the rising step
> `A4 → B4` now **rises 0.25 sp** where it descended 3.0, the rising tenth `C4 → E5` **rises 2.25 sp**
> where it rose 1.0, and a falling step tilts down by 0.25. The control — two same-direction stems —
> is untouched and follows its noteheads exactly (a third = 1.0 sp).
>
> ⭐ **The rule is easier to hold as its effect: the slur tilts at HALF the melodic interval.** Both
> worked examples fall out of that one sentence, and it is what "slide by half the vertical distance
> between the two notes" amounts to.
>
> ✅ **§12.0 #7 answered — fanned members are included**, with no branch of their own: a member's head
> and its stem-meets-beam point mean what a real note's do, which is why the module takes coordinates.
> ✅ **§12.0 #6 honoured** — the slide is computed before the endpoint-offset override is added, so a
> hand nudge is still the last word and the blue squares follow the ink.
> ✅ **§12.0 #1 honoured** — the arithmetic is unit-tested (numbers in, numbers out); the browser only
> pins what VexFlow resolved. ⭐ The four e2e cases were **break-tested against the old attachment**:
> exactly the three tilt cases fail and the control does not, so they measure the change and not the
> geometry they happen to sit in.
>
> 🚨 **ONE BUG THIS PHASE INTRODUCED, found by his eye and fixed the same day: a WHOLE NOTE has no
> stem to float up.** Two whole notes a sixth apart (E4 → C5) are a *mixed* pair by stem DIRECTION —
> which is what places the slur — but neither draws a stem, and the rule floated the first endpoint
> **1.25 sp into empty air** above its notehead. ⚠️ The cause is a VexFlow trap worth remembering:
> **`getStemExtents()` answers for a whole note**, returning the coordinates the stem *would* have
> had, so `stemTipOf`'s "no stem → no tip" guard never fired. `hasStem()` is the question that has
> to be asked first (`durationCodes['1'].stem === false`). ✅ Both engines confirm the fix rather
> than merely permitting it: MuseScore skips its entire stem block when `stem1` is null
> (`slurtielayout.cpp:617`), and Verovio tests `startStemLen == 0` in the **same condition** as a
> stem pointing away (`slur.cpp:677`). ⭐ Break-tested: the e2e case fails at exactly his 1.25 sp
> without the guard.
>
> ✅ **AND ITS SECOND HALF, the same day: the tip no longer TOUCHES THE STEM.** He spotted it the
> moment it drew — the arc left from the notehead's tie edge, which is exactly where an up stem is
> drawn. Three engines read at source (§12.1) say the vertical half of this phase is right and the
> horizontal was the gap: **0.35 sp of sideways clearance**, LilyPond 0.3 / MuseScore 0.35 agreeing
> within 0.05.

### 12.1 ⭐⭐ THE STEM DODGE, READ AT SOURCE (2026-08-16) — ⛔ don't redo this

His question on seeing Phase 1 draw: *"for the whole note is [correct], but for the half note that
have stem looks a little weird… I don't know if the slur should be placed up the stem or maybe the
problem is simply that the slur is touching the stem."* **The second guess is the right one**, and
both engines say so in code. MuseScore `e68a83b4` `slurtielayout.cpp`, Verovio `fb5c4db7`
`src/slur.cpp` — the same commits §11 and §13 were read at.

**✅ FIRST, THE PART THAT CONFIRMS WHAT WE BUILT.** MuseScore's `slurPos` is our Phase 1 line for
line, and reading it settles three things we had taken on trust from the plan's summary:

- **The stem TIP is only used when both stems AGREE.** `sa1 = SlurAnchor::STEM` requires
  `scr->up() == ecr->up() && scr->up() == item->up()` (`:495–501`). With **opposite** stems neither
  end is stem-anchored: both start from the notehead default and the stem-side one is floated. That
  is exactly our `!opposed → stemTipY` branch.
- **The float is from the NOTEHEAD, by half the interval** — `yd = (n2.y − n1.y) × .5`, then
  `po.y + yd` (`:695–710`), from a default of *notehead + 0.9 sp outward* (`:606–611`). Ours floats
  from the notehead and adds `slurLift` 1.0 sp: the same construction, 0.1 sp apart.
- **The clamp is the stem end plus one space**, `max(po.y + yd, downNote.y − stemHeight − 1 sp)` —
  our `slurStemOvershoot`, confirmed. ⚠️ MuseScore measures the stem from the chord's *outer* note,
  which only differs from ours on a CHORD (⏭️ §12 Phase 7's chord-anchor item).
- ⚠️ **Its two one-sided conditions are one rule.** Start floats when `yd < 0`, end when `yd > 0` —
  which both mean *this stem-side end is the LOWER of the two notes* (for an up slur). Ours floats
  whichever end is on the stem side, in the direction of the melody, which comes to the same thing
  in every case a fixed slur side allows. ✅ No change needed.

**⭐⭐ AND THE PART WE ARE MISSING — the horizontal clearance. Neither engine puts the tip on the stem.**

| | where the stem-side tip goes | in staff spaces |
|---|---|---|
| **MuseScore**, unanchored (opposite stems) | `po.x = hw1 + 0.35 sp` (`:672–681`), where the default was `hw1 × 0.5` (the head's **centre**) and the stem stands at `hw1` | **0.35 sp clear of the stem**, min 0.2 (`stemOffsetX = 0.35`, `minOffset = 0.2`, `:398–402`) |
| **MuseScore**, stem-anchored (stems agree) | stem tip `+ (0.35 sp, −0.5 sp)` (`:520–532`) | the **same 0.35 sp** clear, and **0.5 sp INSIDE the tip** (`stemSideInset`) |
| **MuseScore**, down-stem end | `po.x = note2.x − 0.35 sp` (`:807–815`) | mirrored |
| **Verovio**, `d(^)` — *our exact figure* | *"Primary endpoint on the side, move it right"*: `x1 += 2 units`, `y1 = note.y + 3 units` (`:717–720`) | **1.0 sp right of the note's x, 1.5 sp above the head** |
| **Verovio**, same figure on collision | *"Secondary endpoint on top"*: `x1 += radius − stemWidth`, y = the drawn top (`:713–715`) | flush with the stem, at the **tip** |
| **LilyPond** (his ask, read after the other two) | when a candidate endpoint's y falls **inside the stem's y extent** (widened 0.25 sp), `os[d].x = stem_extent[X][−d] − d × 0.3` (`slur-scoring.cc:748–752`) | **0.3 sp clear of the stem** |
| **ours** | `getTieRightX()` — the head's right edge | **0.0 — on the stem** |

⭐⭐ **AND LILYPOND WAS WORTH READING — it converges with MuseScore to within 0.05 sp.** His question
was whether LilyPond even uses this rule; the answer is that it reaches the same place by a different
road, which is the strongest evidence this project accepts:

- **Its base attachment is the NOTEHEAD, not the stem end** — `get_base_attachments()` uses the
  stem's y *only when the note is beamed* (`Stem::get_beaming && Stem::get_beam`, `:550–554`);
  otherwise the head's own extent **+ 0.5 sp** (`:555–558`). MuseScore's equivalent is 0.9, ours 1.0.
  So all three build this figure from the notehead outward, and only we start from a stem tip.
- **Its x is the first notehead's `.center()`** (`:562–566`) — the **third** source for the head's
  CENTRE against our edge, after MuseScore and Ross p. 141.
- **Then, if the endpoint ends up beside the stem, it clears it by 0.3 sp** — and marks that
  candidate `attach_to_stem`. It also *abandons* the stem attachment entirely and returns to the
  head's centre when the result would be too short or steeper than `max_slope` (`:766–775`), which
  is the same instinct as Verovio's collision fallback, pointing the other way.
- ⭐ Bonus for **§12 Phase 3**: `move_away_from_staffline()` (`:640–658`) — if an endpoint lands
  within 0.2 half-spaces of a staff line *and* on one, it is pushed **0.15 sp** further out. LilyPond
  keeps SLUR ends off staff lines too, not just ties.

**⏭️ So the dodge is no longer one engine's constant: LilyPond 0.3 · MuseScore 0.35 · Verovio ~0.4
(under the head-centre reading of its 1.0 sp). ⭐ 0.3–0.35 sp is a convergence, not a taste call.**

⭐⭐ **Verovio's primary answer for a stem-up note under an up slur is a LOW attachment beside the
stem**, and it reaches for the stem tip only when that low one would collide — the opposite of the
instinct that the tip is the "proper" place. And its 1.5 sp above the notehead is, for a third,
**exactly where ours lands** (0.5 float + 1.0 lift).

✅ **Its reference x is the notehead's CENTRE — chased and settled 2026-08-16** (at his question,
*"is this verified just by musescore or also by verovio and lilypond?"*). `x1` reaches
`CalcEndPoints` through `curve->GetCachedX12()`, which `View::CalcInitialSlur` stores from
`View::DrawSlur`'s arguments, which `DrawControlElementConnector` builds under the comment
*"adjust the position according to the radius"*: `drawingX1 += startRadius`
(`view_control.cpp:302–306`). A radius past the head's origin **is** its centre. So its `x1 += 2
units` dodge lands ~0.41 sp past the head's right edge — beside MuseScore's 0.35 and LilyPond's 0.3,
not merely compatible with them.

**✅ BUILT 2026-08-16, his call (*"do you think we should fix it now"* → now, as Phase 1's
completion): `CURVE.slurStemDodge` 0.35 sp, in `slurStemEndpoint.slurAttachments`.** Both halves are
the engines':

- **WHEN** — LilyPond's test: only if the endpoint's y falls inside the stem's own y extent, widened
  by `CURVE.slurStemNearBand` 0.25 sp. ⛔ So the stem-END attachment (agreeing stems) is left exactly
  as it was: the arc's lift already carries it past the tip, where there is nothing to clear.
- **WHICH END** — MuseScore's two conditions, which turn out to be geometry rather than special
  cases: the arc STARTS at the head's right edge, where an **up** stem stands, and ENDS at its left
  edge, where a **down** stem hangs. The other two combinations are a whole notehead clear already.
- **Measured on drawn ink** (`e2e/slur.e2e.ts`): the gap from the stem was **0.075 sp** — the arc
  effectively on the stem — and is now **0.425 sp**, with the endpoint verified to be beside the
  stem rather than above it. ⭐ Break-tested: the case fails at 0.075 with the dodge removed.

Two smaller deviations found in the same read: our
stem-tip attachment sits exactly AT the tip where MuseScore sits 0.5 sp inside it (⏭️ open, his
call), and our notehead-side x is the head's EDGE where all three use its **CENTRE** — ➡️ **QUEUED
INTO PHASE 2 (his call, 2026-08-16)**, because it changes the drawn arc's geometry and belongs in the
same pass as the height law.

**The plan as written (kept for the reasoning):**

**The fault, measured on drawn ink:** a rising step `A4 → B4` across the middle line has mixed stems,
so the slur goes above, attaches at A4's **stem tip** and B4's **notehead** — and **descends 3.0 staff
spaces while the melody rises**. A rising tenth `C4 → E5` rises only **1.0 sp**. Those are Gedan
p. 17's two labelled faults ([b] the slur contradicts the melodic line, [c] it stays horizontal under
a moving one), reachable through ordinary music.

⭐ **The arc math is not at fault and must not be touched.** `slurArchCps` lifts the arch vertically
above the line between the endpoints, so the curve always follows the interval **between whatever it
attaches to**. The stem tip is what substitutes a stem end for a pitch.

> p. 111: *"When outer notes have opposite stem directions, move the slur at the stem end towards the
> noteheads **so it does not tilt contrary to the direction of the pitches**."*

**The change** — ⭐ **a new module, `rendering/slurStemEndpoint.ts`** (§12.0 #1), not a widened
`slurEndpointY`: MuseScore's rule, whose own comment cites this page (`slurtielayout.cpp:683–721`) —
when the two chords have **opposite** stem directions and the slur is on the stem side of one, that
endpoint **slides along its stem by half the vertical distance between the two slur-side notes**,
clamped at the stem end + 1 space. Applied to the two cases above: the A4 end lands 0.25 sp above its
notehead (flat-to-rising), the C4 end 2.25 sp up instead of 3.5 (the tenth rises 2.25 sp instead
of 1).

⚠️ **The signature is the point.** `slurEndpointY(staveNote, noteIndex, direction)` answers for
**one** end — and `SlurEnd.endpointY` is a per-end closure — while this rule needs *both* ends' head
ys and *both* stem directions. That is why it cannot be a line inside the existing function: the
module takes the pair and returns the pair.

⚠️ **Where it lands in the endpoint order** (§12.0 #6): after the stem-tip choice, **before**
`slurEndpointOffsetPx` adds the user's nudge (`SlurRenderer`, the `off.startY`/`off.endY` add). A
hand nudge is the last word — the same rule the nest lift already follows — and `slurTrueEndpoints`
reads the result, so the blue squares follow the ink for free.

⚠️ **Fanned members** (§12.0 #7): `resolveSlurEnd`'s member branch has its own `endpointY` over
`member.tipY`/`headY` and no `StaveNote` at all. A member's stem tip is where its stem meets the
beam, so the rule *can* apply — but the phase must say whether it does. Unstated means it gets found
by a slur that behaves differently over a fan.

✅ **Timing is not a risk:** ties and slurs render at `VexFlowRenderer.ts:3734/3737`, after every
`Beam.draw`, so `getStemExtents().topY` is already the post-format tip of a beamed group.

**Verify:** the *rule* headless — `slurStemEndpoint.test.ts`, fed the four (stem, stem, direction)
combinations with known ys (§12.0 #1: this is arithmetic over given numbers, not a glyph
measurement). The *drawn consequence* in `e2e` — both cases above, asserting the **sign** of the tilt
against the melodic interval.

### Phase 2 — the short-slur height (TASTE — needs his eye) — ✅ BUILT 2026-08-16, option (b)

> ⭐⭐ **HIS CALL on the costed table below: option (b), LilyPond's law adopted whole.**
> `rendering/slurArchHeight.ts` now computes `F0_1(w·r₀/h_inf)·h_inf` with the `Slur` grob's own pair
> — `height-limit` **2.0**, `ratio` **0.25**. The floor + slope + cap it replaced (0.93 / 0.06 / 2.2)
> is gone, and its three constants went with it.
>
> ⚠️ **The formula was VERIFIED AT SOURCE before it was ported, and the plan's transcription was
> right** where my own recollection was not: `static Real F0_1 (Real x) { return 2 / M_PI * atan
> (M_PI * x / 2); }` and `slur_height = F0_1(width · r_0 / h_inf) · h_inf`
> (`lily/bezier-bow.cc:29–38`), with `(height-limit . 2.0) (ratio . 0.25)` on the `Slur` grob
> (`define-grobs.scm:3178, 3181`). ⚠️ 0.333 is the PHRASING slur's and the TIE's — three grobs, three
> pairs, and ⛔ the tie's height is settled separately (§13.1).
>
> ⭐ **Its spec is a cross-check, not a restatement**: the five apexes it asserts are LilyPond's
> column of the table below, computed by an agent reading the C++ *before* this port existed, and the
> port reproduces them to 0.01. And `slurArchHeight(100 sp)` is still short of the limit — a
> saturation where the old law hit its wall at an 18 sp span and drew every longer slur identically.
>
> ✅ **Also built: the queued endpoint x** (the head's **CENTRE**, sub-block below) — measured on
> drawn ink, both ends now land inside their own notehead's extent where they sat beyond it.
> ⭐ The centre anchor and the §12.1 dodge are coupled — the dodge is now stated from the head's
> centre out past the stem — so the e2e break-test fails BOTH cases if either is reverted.
>
> ⏭️ **What it does NOT do: the INDENT.** LilyPond's `get_slur_indent_height` varies the control
> points' horizontal inset with width (`2·h_inf − q²·max_fraction/(w+q)`, `max_fraction 1/3.1`) where
> ours is a fixed 25% — §11.11 #5, still open, and the other half of what makes a short slur round.

Measured drawn apex, ours against all three (a cubic's apex is 0.75 × control height in all four, so
these are comparable). Four of our five rows were measured off real paths; the 4 sp row is the
formula, which the other four confirmed exactly.

| span | **ours** | LilyPond | Verovio | MuseScore |
|---|---|---|---|---|
| 2.4 sp | **0.81** | 0.42 | 0.45 | 0.58 |
| 4 | **0.88** | 0.64 | 0.60 | 0.75 |
| 10.8 | **1.18** | 1.08 | 1.13 | 1.23 |
| 18 | **1.51** | 1.24 | 1.13 | 1.59 |
| 25.2 | **1.65** | 1.31 | 1.13 | 1.88 |

⭐ **From medium spans up we are in the middle of the pack, and our cap agrees with Gould's *"the
curve of a long slur is flattened"* — ⛔ don't touch that end.** The outlier is the **short** slur:
at a two-note step we are **1.9× LilyPond, 1.8× Verovio, 1.4× MuseScore** — and short slurs are the
commonest ones on a page. One constant causes it: the **`0.93` sp intercept**, a floor no other
engine has.

⭐ **It also causes the hookiness**, so this is one change fixing two symptoms. Our control-point
indent is a fixed **25%** at every length (measured: 6/24, 27/108, 45/180, 63/252 px). Combined with
the height that gives a launch angle of **61°** at 2.4 sp — nearly vertical, which is what LilyPond's
own comment calls *"a certain hookiness at the end"* — against **19°** at 25.2 sp, a long flat middle,
which is right. Lower the short height and the angle falls with it (≈49° at 0.7 sp apex).

**His call, three options:** (a) lower the intercept only (~0.55 keeps the shape of our law);
(b) adopt LilyPond's `h_inf·(2/π)·atan(π·r₀·w/2h_inf)`, `height-limit` 2.0 / `ratio` 0.25 — the one
law that behaves at both ends and agrees with Gould's direction; (c) leave it. ⛔ No slur arc height
is published anywhere, by anyone — this cannot be settled by research, only by his eye.

**⭐ The three options costed, in DRAWN APEXES (staff spaces), 2026-08-16:**

| span | **(c) ours today** | **(a)** intercept 0.55 | **(b)** LilyPond's law | MuseScore, for scale |
|---|---|---|---|---|
| 2.4 sp | 0.81 | 0.52 | **0.42** | 0.58 |
| 4 | 0.88 | 0.59 | 0.64 | 0.75 |
| 10.8 | 1.18 | 0.90 | 1.08 | 1.23 |
| 18 | 1.51 | 1.22 | 1.24 | 1.59 |
| 25.2 | 1.65 | 1.55 | **1.31** | 1.88 |
| launch angle at 2.4 sp | **61°** | 49° | 43° | — |

⚠️ **(a) and (b) differ at the LONG end, not the short one** — they are within 0.1 sp of each other
up to a 4 sp span. (a) keeps our shape and simply lowers everything by the same 0.28 sp of apex,
which also drops the long end off its cap (1.65 → 1.55). (b) reproduces LilyPond's column *exactly*
at all five spans (the formula was checked against the measured table and agrees to 0.01), so it
flattens long slurs considerably more — 1.31 against our 1.65 — which is Gould's direction pushed
further than we have ever drawn it.

✅ **The centre anchor does not disturb this question**: it lengthens every arc by ~1.2 sp, which
under our law adds 0.05 sp of apex — inside the rounding of the table.

⭐ **Whichever he picks, it is `rendering/slurArchHeight.ts`** (§12.0 #1) — span in, arch height out,
with a spec that pins the table above at both ends. Option (b) is a *law*, not a constant, and a law
living inline in `slurArchCps` is the slice the ⭐ rule refuses. ✅ The ghost tie follows this and
Phase 4 for free (§12.0 #2); ⚠️ show it to him **together with Phases 4 and 6** (§12.0 #8).

#### ➡️ QUEUED HERE (his call, 2026-08-16): the endpoint x — the head's CENTRE, not its edge

From the §12.1 engine read, and queued into this phase rather than shipped alone **because the two
changes cannot be judged apart**: moving both ends inward lengthens every arc by ~1.2 sp, and our
arch height is span-proportional, so the height he is being asked to judge moves with it.

**The deviation.** Both curves attach at VexFlow's tie edges — `getTieRightX()` is
`absoluteX + glyphWidth + …`, the head's **right** edge, and `getTieLeftX()` its left. So a slur
spans the GAP BETWEEN the noteheads. A notehead is ~1.18 sp wide, so each end sits **~0.6 sp short**
and the arc never overhangs its own notes.

⭐⭐ **Verified in ALL THREE at source, each by a different construction** — his question,
2026-08-16, and the third one had to be chased before the claim was honest:

| | the notehead-side x | where |
|---|---|---|
| MuseScore | `po.rx() = hw1 × 0.5`, under the comment *"default position: horizontal: middle of notehead"* | `slurtielayout.cpp:601–606` |
| LilyPond | `x = first_head->extent(…).center()` | `slur-scoring.cc:562–566` |
| Verovio | `drawingX1 += startRadius`, under *"adjust the position according to the radius"* — a radius past the head's origin is its centre | `view_control.cpp:302–306` |
| Ross p. 141 | *"long slurs always start and end over or under the centre of a notehead"* (§11.9) | the book |
| **ours** | the head's **edge** | `getTieRightX/LeftX` |

⭐ **Only the NOTEHEAD-side ends are affected.** On the stem side, §12.1's dodge already sets the x
past the stem — which is what MuseScore's `hw1 + 0.35` does absolutely — so that end already lands
where theirs does. This is one end of most slurs, not both.

⛔ **SLURS ONLY — do not touch the tie.** §13.3 found the tie field genuinely split: MuseScore uses
the head's optical centre, LilyPond ¾ across, but **Verovio goes 0.25 sp OUTWARD from the edge**, and
Gould's own sentence allows the edge *"when it must come closer"*. Ties share `getTieRightX` with
slurs today, so the change has to be scoped to `SlurRenderer` deliberately rather than to the shared
helper. ✅ The centre is already in hand: `(getNoteHeadBeginX() + getNoteHeadEndX()) / 2`, which
`GhostRenderer` uses for exactly this reason.

**Verify:** `e2e` — the drawn arc's first x sits INSIDE the first notehead's own x extent (and the
last inside the last), where today it is beyond it; plus the existing dodge case, which must still
clear the stem, since the two rules meet on the same end.

### Phase 3 — ⭐ a tie must not sit on a staff line — ✅ BUILT 2026-08-16 (with 3b)

> ✅ **`rendering/tieStaffLineClearance.ts`** — and it took THREE corrections on the way, each from
> reading rather than reasoning. ⛔ Don't re-derive them:
>
> 1. **A rigid shift cannot satisfy both of LilyPond's clearances** (tip 0.225, apex 0.3): clearing
>    the apex brings the tips to 0.1 sp of the line above, clearing both wants half a space and
>    leaves the tie hanging off its notehead. That dead end is why MuseScore DEFORMS and LilyPond
>    NUDGES. I first built MuseScore's fatten-or-flatten repair (`adjustY`, `:2392–2490`) and then
>    dropped it: deforming re-opens the tie height his call settled (§13.1), and ours is LilyPond's
>    shape, not MuseScore's.
> 2. **🚨 The ink swells AWAY from the notehead.** `renderCurve`'s closed lens draws the arc, then
>    returns `thickness` FURTHER OUT — so the band runs from the arc outward, not inward. The first
>    version tested the band on the wrong side, found no line inside it, and **passed its own
>    break-test with the rule removed**. Measured off a real path, not assumed.
> 3. **Only the line on the NOTEHEAD's side matters.** A line on the arc's far side must be left
>    alone: nudging outward drives the tie into it. That is why LilyPond nudges only when the head is
>    on a line and centres otherwise — and, on our geometry, why there is exactly ONE case.
>
> 4. **⭐⭐ HIS EYE OVERTURNED THE REPAIR ITSELF.** It first TRANSLATED the tie outward (LilyPond's
>    0.225 sp nudge). He looked at a tied G4 — a line note — and asked *"isn't the edge of the tie
>    too low?"* It was: moving a tie moves its TIPS, from 0.20 sp clear of the notehead's edge to
>    0.42, and that 0.20 is Gould's *"should almost touch each notehead"* (§13.3). **Two settled
>    things collided and the translation spent the one Gould states outright.** So the repair is
>    MuseScore's after all — grow the ARC, leave the tips alone — and Gould's sentence turns out to
>    describe exactly that: *sufficiently round to be conspicuous through a stave-line*.
>
> **The rule:** if a staff line lies within `CURVE.tieLineClearance` **0.15 sp** (MuseScore's
> `badArcIntersectionLimit`) of the arc's inner edge, grow the apex until it has
> `CURVE.tieLineApexClearance` **0.3 sp** of daylight (LilyPond's `center-staff-line-clearance`),
> capped at `CURVE.tieLineMaxGrowth` **0.75 ×** the arc's own height (MuseScore's
> `maxArcCorrection`). Three sources, four roles: MuseScore says WHEN and CAPS it, LilyPond says HOW
> FAR, Gould says WHAT TO CHANGE. A line-note tie's apex goes **0.40 → 0.60 sp**; a space-note tie is
> untouched; ⛔ the DEFAULT height is still 0.40 (§13.1, settled) — this is a local repair.
>
> **Measured on drawn ink** (`e2e/tie.e2e.ts`, break-tested): a tie on a LINE note had a staff line
> running **0.15 sp** under its flat middle for the tie's whole length — MuseScore's threshold
> exactly — and now clears by **more than 0.3 sp**, with its tips still on their noteheads. A tie on
> a SPACE note is untouched, and its nearest inner line is 0.65 sp away.
>
> ⏭️ **Not done, and now measured:** for a space note the tie's ink passes **0.15 sp** from the line
> on its FAR side. Fixing that is not a nudge — it is a per-case LIFT (LilyPond's
> `center_tie_vertically`), which changes the 0.70 sp his call settled. ⛔ His decision, not mine.

#### The plan as written (kept for the reasoning)

> p. 61: *"The curve of the tie should be sufficiently round to be **conspicuous through a
> stave-line**."*

⛔ **This phase used to be "the tie is 2.5–3.75× too flat". That is withdrawn** — §13.1 (his call on
the three-engine table) and §13.2 (Gould's number may be a total depth, under which ours is already
inside her band). What her sentence is *actually* about is the line, and there we have nothing.

**Two of three engines position a tie against the staff lines**, and it is the only tie behaviour
where an engine majority, the book and our own absence all agree:

- **LilyPond** scores it — `staff-line-collision-penalty` **5**, applied to the apex
  (`center-staff-line-clearance` **0.3 sp**) and again to the tips (`tip-staff-line-clearance`
  **0.225 sp**) — and a short tie inside a space is re-centred bodily by `center_tie_vertically()`.
- **MuseScore** repairs it — an endpoint protruding less than **0.15 sp** through a line moves both
  ends off it; then the arc is fattened or flattened (up to `0.75 × tieHeight`) to lift the apex
  clear; a tie under 2.0 sp long and 0.7 sp tall is translated whole into a space.
- **Verovio** does nothing but thin the arc by the line width.

⭐ **This is new machinery, not a constant.** Our tie's y is one derived number (`TIE_LIFT` off the
notehead) with no candidates and no scoring; LilyPond's warning is that porting a shape law without
the search is exactly how you get ties sitting on lines. Start with the smallest thing that works —
MuseScore's shape, not LilyPond's: test the two endpoints and the apex against the nearest line, and
move the whole tie by the shortfall.

⭐⭐ **REVISED SIZE, 2026-08-16 (§12.0 #3): small, not medium — because our tie's shape is a
CONSTANT.** `TIE_LIFT` is 0.70 sp and the apex is a fixed 0.40 sp above the endpoint line, so the
total reach is always **1.10 sp** and there are exactly **two** cases, both predictable without
measuring anything:

| the notehead | endpoints | apex | verdict |
|---|---|---|---|
| **ON a line** | 0.70 sp off it — clear | **1.10 sp** = 0.10 sp *past* the next line, with 0.20 sp of fill reaching back to 0.90 | 🚨 **the apex straddles that line — every time** |
| **in a space** | 1.20 sp — 0.20 sp past the line, clear | 1.60 sp = the **middle** of the next space | ✅ correct, every time |

So the fault is not diffuse and it is not a search: **it is the on-line notehead, always.** A lift of
≈0.20 sp puts the tip at LilyPond's `tip-staff-line-clearance` 0.225 and the apex 0.25 sp clear of
the line. ⛔ That does **not** make it a magic constant in `TieRenderer`: it is
`rendering/tieStaffLineClearance.ts` (§12.0 #1) — tie y + the stave's line ys in, a shift out — so it
stays honest on the day the shape stops being constant (Phase 2's law, a hand-edited tie, a small
staff). The two-case table is what its spec asserts.

⚠️ **The GHOST is exempt, and that must be written down** (§12.0 #2). `GhostRenderer.drawTieGhost`
draws at the cursor, where there is no stave and no lines to clear, so for the first time it will
*not* match the engraved tie. Its doc comment states the opposite invariant today — *arm the tool and
the arc under the cursor IS the arc you get* — so amend that comment in this phase, or a later reader
"fixes" the disagreement back.

**Verify:** the *rule* headless — the two rows above, fed line ys directly. The *drawn ink* in `e2e`:
a tie whose notehead sits **on** a line, and one in a space, measuring the path's distance to the
nearest staff line (`harness.paths()` + `harness.staves()` give both).

### Phase 3b — the broken tie changes weight, AND SO DOES THE PENDING ONE — ✅ BUILT 2026-08-16

> ⭐⭐ **HIS CALL, on seeing the audit:** *"vexflow draw something and us another? i dont like this
> inconsistence"* — and then the sharper framing that reordered the work: *"aren't we talking control
> of the slur in general? why not talking control of the tie too?"* So 3b landed BEFORE Phase 3, and
> the clearance rule then applied to every tie instead of only same-line ones.
>
> ✅ **One primitive for all four paths.** Same-line, both cross-system halves, the pending preview
> and the ghost now draw through `drawCurveArc`. What VexFlow was drawing, measured: a **quadratic**
> with `cp1: 8 / cp2: 12` — a 4 px belly against our 2.7 — and, under a length cutoff,
> `cp1Short: 2`, an apex of **0.1 sp where ours is 0.4**. The same tie changed shape when it crossed
> a break, and again the moment you committed it.
> ✅ **`rendering/systemEdges.ts`** — `lineLeftEdgeX`/`lineRightEdgeX` extracted from `SlurRenderer`,
> since `TieRenderer` must not import it and a shared answer belongs to neither.
> ✅ **The hit-target** (§12 Phase 7's item, folded in): a tie is hit-tested against its sampled arc
> like the slur, where it was a padded rectangle — the last span element selectable by empty air.
> ✅ **The tie's x is now ours too** — Verovio's, his call: `./tieEndpoints`, the head's centre ± 0.25
> sp, where we used VexFlow's `getTieRightX/LeftX` (the outer edges, plus any modifier shift). 🚨 And
> §13.3 recorded Verovio's rule as *"the outer edge, 0.25 sp OUTWARD"*, which is a **misreading** —
> `startPoint.x += r1 + unit/2` (`src/tie.cpp:381`) moves INWARD from the centre. Reading it again to
> implement it is what caught that.

A same-line tie goes through `drawCurveArc`; the two halves of a tie crossing a **system break** are
raw VexFlow `StaveTie`s — a quadratic with `cp1:8 / cp2:12`, i.e. a 4 px belly against our
`CURVE_THICKNESS` 2.7. So a tie visibly changes weight when it crosses a break. ⚠️ §13.7 corrected
the *shape* half of this: all three engines draw two independent flat arcs and none makes the halves
match, so Gould's *"keeps its symmetrical shape"* is about symmetry **within** each half, which ours
already has. **The migration is worth doing for the weight, not the shape.** The slur did exactly
this in its own Phase 3 and the tie was left behind.

⭐ **A THIRD `StaveTie` was missed, and it is the one the user sees first** (§12.0 #2): the
**pending-tie preview** — the arc hanging off a selected note while the tie is being made
(`VexFlowRenderer.ts:4189`) — is a raw `StaveTie` too. So **a tie changes shape at the moment you
commit it**, which is the same defect as the broken tie's, in the same primitive, and it belongs in
this phase. ✅ The armed tool's ghost is already on `drawCurveArc` and needs nothing.

⚠️ **Why this is no longer "small": `StaveTie` computes its own x.** It runs itself to the system
edge; we would have to say where that edge is, and the two helpers that know
(`lineLeftEdgeX`/`lineRightEdgeX`) are exports of **`SlurRenderer`**. ⛔ `TieRenderer` must not import
`SlurRenderer` — extract them to `rendering/systemEdges.ts` first (one move, both callers), which is
the ⭐ rule's answer here as well.

⭐ **Fold Phase 7's "the tie's hit-target is a padded rectangle" into this phase.** `drawCurveArc`
returns the 17 sampled cubic points as a *by-product* (`curveArc.ts`), which is exactly what
`elements/tie.ts` needs to stop selecting the empty air under the arc — and the registry's `points`
path already exists, because the slur uses it. Doing it here costs one field; doing it in Phase 7
means re-plumbing all four tie sites a second time.

### Phase 4 — the weight (Bravura) — ✅ BUILT 2026-08-16

> ✅ **`CURVE.thickness` is the DRAWN midpoint now, and it is Bravura's 0.22.** It used to be
> `renderCurve`'s fill GAP, so the ink measured `0.75 × gap + outline` — 0.27 authored, **0.30
> drawn**, a third more than the number said. `curveArc.curveFillGap()` derives the gap from the
> nominal, which is Verovio's `GetBezierThicknessCoefficient` (`boundingbox.cpp:945`); the fill gap
> lands at exactly the **1.6 px** this phase predicted. ⛔ One constant: if it reads thin, 0.30 is
> where it was, and MuseScore draws 0.29.
> ⚠️ It moves the curve TOWARD the hairpin's 0.16 stroke, which he set by matching this weight.

### Phase 4 — the plan as written

🚨 **§11.11 #4 is wrong and this phase is not what it says.** It claims we have "one thickness, no
taper" and calls the fix medium, needing a self-rolled tapered cubic. Read off the real emitted path:
`renderCurve` draws a **closed lens** — an outer cubic at `cp.y`, a return at `cp.y + thickness` —
then strokes *and* fills it. So we already taper, and one end is already exact:

| | tip | middle |
|---|---|---|
| **ours (measured)** | **0.10 sp** (the curves meet; ink = the 1 px outline) | **0.30 sp** (fill gap `0.75 × 2.7px` = 0.20, + outline 0.10) |
| Bravura | 0.10 | 0.22 |
| LilyPond | 0.08 | 0.17 |
| Verovio | 0.05 | 0.25 (its **slur** is 0.30) |
| MuseScore | 0.05 | 0.21 nominal, ≈**0.29 drawn** |

`CURVE_THICKNESS` **2.7 → 1.6 px** would put us on Bravura's number at *both* ends. No new primitive.

⚠️ **§13.6 downgraded this from PUBLISHED to TASTE.** The three engines span **0.17 → 0.30 sp** at
the middle and MuseScore's *drawn* value is 0.29, a hair under ours — so we are at the top of a real
range, not outside it. ✅ Our decision to share one weight between tie and slur is *confirmed*:
LilyPond and MuseScore use identical numbers for both, and only Verovio draws its tie thinner.
⭐ Whatever we choose, steal Verovio's `GetBezierThicknessCoefficient`: it **narrows the fill by the
stroke width** so fill + outline equals the nominal exactly, where we simply add the two — which is
why our drawn middle is a third above its own nominal.

✅ **The arithmetic was re-checked against the emitted path (2026-08-16) and it holds exactly**:
drawn middle = `0.75 × fill gap + outline`, i.e. `0.75×2.7px + 1px` = 3.03px = **0.30 sp** today, and
`0.75×1.6px + 1px` = 2.2px = **0.22 sp** = Bravura. The tip is the 1 px outline alone = 0.10 sp,
already exact.

⭐ **So steal Verovio's coefficient as a DERIVATION, not as a second constant.** The two numbers that
make the middle are `CURVE_THICKNESS` and `CURVE_OUTLINE` (`curveArc.ts`), and today they are simply
added — which is why our drawn middle sits a third above its own nominal. Write the nominal
midpoint thickness as the authored number and derive the fill gap as `(nominal − outline) / 0.75`;
then the constant in the file is the one the research tables are written in, and Phase 7's
px→staff-spaces pass has something meaningful to convert. ✅ The armed tool's **ghost tie follows for
free** — it draws through the same primitive with the same constants (§12.0 #2).

⚠️ **Weigh this against the hairpin before touching it.** He set the hairpin stroke by matching this
curve — *"i like the stroke with this size (cause it match better with other elements, for example
the stroke of the slur)"* — and it settled at **0.16 sp**. Thinning the slur's middle to 0.22 moves it
**toward** the hairpin, not away, so it should still hold together; but it is his eye's call.

### Phase 5 — a broken slur must lean toward its own music — ✅ BUILT 2026-08-16

> ✅ **`rendering/brokenSlurTilt.ts`** — the last of the plan's *published* rules to be built. The open
> end of each half moves **0.25 sp per diatonic step** of the interval between the slur's two
> anchored notes (Verovio's `pitchDiff * unit / 2`, `src/slur.cpp:929`, read at source): the BEGIN
> half's open end rises when the music resumes higher, the END half's *falls* by the same amount, so
> the two fragments point at each other across the break and read as one gesture.
>
> 🚨 **PITCH, never the drawn y** (§12.0 #5) — the two ends are on different systems, so `toY − fromY`
> is the distance between two staves plus the cast-off, not a melodic interval. The interval comes
> from the model via `spellingDiatonicPos`; a slur anchored to a rest has none and keeps the flat base.
>
> ⭐ **And the floor turns out to be Gould's own justification, in code.** Verovio's comment reads
> *"Make sure that broken slurs do not look like ties"* — which is her parenthesis, *"so as to look
> clearly open-ended (this differentiates an open-ended slur from an open-ended tie)"*, as a number.
> `CURVE.brokenSlurMinRise` 1.0 sp.
>
> ⛔ **MIDDLE segments stay flat**: a system a slur merely passes over has no pitch of its own.
> **Measured** (`e2e/slur.e2e.ts`, break-tested): an octave up against an octave down now differ by
> more than a space at the open end, where both drew the same flat 1.4 before.
>
> ### ⭐⭐ …and then four faults from his eye, of which three were mine (2026-08-16)
>
> | what he saw | why | what it took |
> |---|---|---|
> | *"the continuation looks too short"* — **0.60 sp** wide with a full space of drop, a comma at 60° (the BEGIN half, for scale: 12.97 sp) | a slur ending on the system's FIRST note has almost no room after the header | ⛔ my answer — start at the bar's left edge — was WRONG; see the rule below. What stayed is **`BROKEN_SLUR_MAX_SLOPE` 0.5**: the rise may not outgrow the fragment's own length, so a cramped one is flat rather than a tick |
> | *"the continuation collides the clef"* | that bar-left-edge start put the arc in the clef's column | reverted, twice over: the x is the header boundary again AND the vertical dodge I built to compensate is gone |
> | *"the split point has much air"* | 🚨 **a real BUG**: the lean ignored WHICH SIDE the slur is on. `rise` runs along the slur's own side, so a rising continuation BELOW the staff was pushed further DOWN, away from its own music | the lean is multiplied by **`-direction`**. Measured on his figure: the open end's drop **2.00 → 1.00 sp** — half of the 2.25 sp he had corrected by hand |
> | a wide interval opening a hole at the margin | the per-step lean is unbounded | **`CURVE.brokenSlurMaxRise` 2.0 sp** (⚠️ ours; Verovio's ceiling is geometric and does nothing outside the staff) |
>
> 🚨🚨 **I TOLD HIM TWICE THAT NO BOOK SAYS WHERE A CONTINUATION BEGINS. GOULD SAYS IT VERBATIM**
> (found by the agent he asked for; ⛔ don't re-derive, and ⛔ never repeat the claim):
>
> > p. 112: *"At the end of a system, the slur finishes just short of the last barline, and not
> > beyond it. **At the beginning of the new system, the slur starts after the clef, key signature
> > and time signature, but before any accidental.**"*
> > p. 65 (ties): *"At the start of a new system the tie begins **after the clef, key signature and
> > time signature**."*
>
> ✅ **Gerou & Lusk agree independently** (*Essential Dictionary of Music Notation*): *"Continue the
> slur in the lower staff immediately after the key signature (or clef), also at an angle."*
> ✅ **And so do all three engines** — ⚠️ including Verovio, which I had misread: its
> `GetLeftBarLineXRel` sounds like the barline, but its alignment enum puts the score-def clef BEFORE
> the left barline, so that x is already past the header. LilyPond unites the extents of grobs marked
> `avoid-slur 'inside` — Clef, KeySignature, TimeSignature **and Accidental**, which is her *"but
> before any accidental"* clause implemented literally; MuseScore uses `firstNoteRestSegmentX`.
> ⛔ **`noteStartX` IS that boundary**, so our original x was right all along.
>
> ⭐⭐ **And the vertical dodge is positively WRONG, not merely unnecessary:** LilyPond EXCLUDES
> Clef/KeySignature/TimeSignature from the code that lifts a slur's endpoint
> (`slur-scoring.cc:302–308`) while still letting them score against the curve. No engine has any
> vertical clef handling for a line-start fragment, and Gould pairs slur with clef nowhere.
>
> ### ⏭️⏭️ WHERE THIS STOPS, AND THE TWO THINGS THE NEXT SESSION SHOULD DO
>
> The fragment is still *"starting at a bad position, too near to the notehead"* (his words). Two
> separate causes, and **his own measurement identified the first**:
>
> **1. ⭐⭐ `noteStartX` IS NOT THE CLEF'S INK — it is a PADDED boundary, and using it steals empty
> space.** His finding, 2026-08-16: *"i checked the bbox of the clef and on the right side it is not
> tight to the clef, so if you are taking that as space it is wrong — it is stealing empty space."*
> Confirmed in code: `noteStartOf(stave) = stave.getNoteStartX() + Metrics.get('Stave.padding')`
> (`VexFlowRenderer.ts:4414`), i.e. VexFlow's modifier-box width plus stave padding — and the clef's
> own registered box is `CLEF_HIT_WIDTH = 4.5 sp` (`layoutConfig.ts:108`), a HIT box, wider still.
> The clef's INK ends well before either. ⭐ Gould's rule is *"after the clef"* — the glyph, not the
> box — so a fragment may legitimately begin where the clef's ink ends, which is the room this figure
> is missing. ⚠️ The ink is NOT measurable with `getBBox()` (it returns the font's ascent/descent:
> it claims the clef reaches 5.05 sp above the staff); use Bravura's published `glyphBBoxes`, the
> way `spacingPadding` and `kerning` already do — `gClef` bBoxNE.x is **2.684 sp** from its origin.
>
> **2. And the sources also say to buy horizontal room when it is still tight.** **Gerou & Lusk**:
> *"Be sure the first note is far enough to the right so that it is very clear that the slur does not
> begin on the note."* A notat.io engraver: *"when the situation is too tight, I use to expand the
> space before first note."* MuseScore encodes it as
> `min(headerRight + Sid::headerToLineStartDistance 1.0 sp, firstNoteX)` — a clamp that, on our
> spacing, collapses onto the note, which IS the measurement of the fault. ⏭️ A slur or tie
> continuing into a system's first note should widen that gap — a SPACING-pass rule, unbuilt.
>
> ⛔ **Nothing else about the continuation should be tuned by eye until those two land.** Everything
> else here is now either verbatim from Gould or measured; the remaining ugliness is a box-vs-ink
> problem and a spacing problem, not a curve problem.
>
> ### ✅ 2026-08-16 (later the same day) — #1 IS BUILT, AND IT PULLED A SECOND FAULT OUT WITH IT
>
> **A. The continuation now starts at the header's INK** (`rendering/systemEdges.ts`'s
> `lineLeftCurveX`, `CURVE.curveFromHeader`). ⭐ **And it needed no glyph measuring at all**: the
> header's ink edge is `noteStartX − HEADER_TO_NOTE × STAFF_SPACE_PX`, because `applyLeadIn` builds
> `noteStartX` as `staveX + (HEADER_TO_NOTE + headerExtent) × STAFF_SPACE_PX` and a line-opening bar
> always draws a clef. Measured on his figure: `20 + 3.2·10 + 2.0·10 = 72`, and the clef's Bravura
> ink ends at 51.84 against the modelled 52.0 — **0.02 sp apart**, the same number two ways.
>
> | | before | after |
> |---|---|---|
> | fragment start x | 72 — *equal to the notehead's own x* | 52 |
> | fragment length | **0.6 sp** | **2.6 sp** |
>
> ⭐ The three engines, read at source, bracket the margin: **MuseScore** `min(headerBox.right +
> Sid::headerToLineStartDistance, firstNoteX)` = **1.0 sp** (`styledef.cpp:621`); **LilyPond**
> `breakable_bound_extent` → `x = ext[RIGHT]`, i.e. **flush, 0**; **Verovio** the left-barline
> alignment, which its enum orders after CLEF → KEYSIG → MENSUR → METERSIG. **His eye took
> LilyPond's 0** — shown MuseScore's 1.0 first he said *"still more space at the right of the clef
> that the continuation can take, it looks too short for me"*.
> ⛔ The clef's `CLEF_HIT_WIDTH` (4.5 sp) is NOT involved and never was: it is the click target and
> the gutter's width, nothing in spacing and nothing in the curve. ⏭️ It is 1.3 sp wider than the
> glyph on the right and could be tightened on its own day.
>
> **B. 🚨 …and then his eye caught the OTHER half: *"now the air in the measure before"*, and
> *"it looks to me like a complete slur and not a cutted slur"*.** The BEGIN half of his figure —
> a slur BELOW a rising `C4 D4 E4 F4` — was anchored at the LOW C4 and pushed its open end
> **2.95 sp below the bottom line** while the music it was leaving had climbed to F4. He corrected it
> by hand by 1.0 sp and asked for *"no black magic, better a robust solution"*.
>
> ⭐⭐ **The cause was `slurArc`: a FIXED 1.4 sp base measured off the ANCHORED note** — a note that
> may be at the far end of the system. **LilyPond does not have such a constant**, and its rule is the
> fix (`slur-scoring.cc`, the broken bound): the open end takes
> `col = (d == LEFT) ? note_columns_[0] : note_columns_.back()` — **the nearest note column on its own
> system** — and sits at `robust_relative_extent(col)[dir_] + dir_ × 0.5 sp`. It hugs the music it is
> leaving. (When that column IS the other end, it falls back to the anchored end's own height: flat.)
>
> ⭐ **And Verovio's anti-tie floor is CONDITIONAL, which I had copied as if it were not**:
> `(abs(y1-y2) < 2*unit) && (abs(x1-x2) < 2*staffSize)` — a fragment under **8 sp**. His was 14.9 sp
> and was being given a space of drop it had no need of. `CURVE.brokenSlurTieLikeSpan` 8.0.
>
> So `brokenSlurOpenRise` is now **`clearance + max(tilt, 0)`**, clamped by the two ceilings:
> LilyPond gives the height, Gould's cross-break lean adds to it, and ⭐ **the lean may only push the
> open end OUTWARD — inward is where the music is**. `slurArc` is **deleted**, not tuned.
>
> | his figure, BEGIN half | before | after |
> |---|---|---|
> | anchored end (over C4) | 1.95 sp below the bottom line | 1.95 (unchanged) |
> | open end (at the margin) | **2.95 sp below** — falling away from the music | **1.05 sp below** — rising with it |
>
> ⚠️ The END half is untouched by this (1.3 sp), because its nearest covered note IS its anchor —
> LilyPond's own flat case — and he had already approved that half.
>
> ⭐ **On the SHAPE question he asked** (*"do we have a source that the half has the real shape? it
> looks like a complete slur"*): **no engine draws a special cut shape.** LilyPond fits a broken half
> with the same bezier scoring as any slur (`is_broken_` only zeroes `musical_dy_`), and Verovio
> builds a symmetric bow between the two endpoints and rotates it by the fragment's own angle
> (`CalcInitialControlPointParams`, both control points on the same side). **The "cut" reading is
> bought entirely by WHERE the open end sits** — which is why fixing its height fixed the look.
>
> ⏭️ Still open, unchanged: #2, buying horizontal room before a system's first note.

**The plan as written:**

> p. 112: *"**The whole slur should tilt in the direction of the pitches.** A slur starting on the
> last note of a system or finishing on the first note of a system must be **angled in the direction
> of the final pitch** on the new system, so as to look clearly open-ended (this differentiates an
> open-ended slur from an open-ended tie)."*

Ours is a flat `SLUR_ARC` = 1.4 sp rise on every half-arc, identical for BEGIN and END, with no pitch
input at all. Verovio implements her rule as `ConsiderMelodicDirection`, **0.25 sp per diatonic step**;
LilyPond switches all melodic slope rules **off** for a broken half. We are the only one of the three
with no opinion, and she says we should have one.

🚨 **The input is PITCH, not y** (§12.0 #5) — and this is the one way to build this phase wrong while
it looks right. The two ends are on **different systems**, so `toY − fromY` is not a melodic
interval; it is the distance between two staves, plus whatever the page cast-off did. Cross-system
coordinates are not one ruler — the hairpin already cost us this bug
(`docs/dynamics-line-and-hairpins-plan.md`, *a late-start wedge's `endX < startX`*). The rise comes
from the **diatonic difference between the two anchored notes in the model**, which the renderer has
in hand (`score` + the two note ids), times Verovio's 0.25 sp per step.

⭐ **The module is `rendering/brokenSlurTilt.ts`** (§12.0 #1): diatonic difference + which half
(BEGIN or END) in, the half-arc's open-end rise out. Pure, so the whole of Gould's sentence — *angled
in the direction of the final pitch* — is one spec beside it.

⛔ **MIDDLE segments stay flat.** A system the slur merely passes over has no pitch of its own; ours
draws it as a symmetric bow at a staff-relative baseline (`SlurRenderer`, the `middle` branch) and
that is right. The rule is about the two *open ends that face music*, not about every half-arc.

### Phase 6 — a maximum slant — ✅ CEILING BUILT 2026-08-16 · ⏭️ the roundness half COSTED, NOT BUILT

> ✅ **`rendering/slurSlantLimit.ts`** — Verovio's `GetAdjustedSlurAngle`: past **60°** the LOWER
> endpoint rises until the tilt is the ceiling, so the arc keeps its shape and only an end moves.
> ⚠️ With a cap Verovio has no equivalent of — `CURVE.slurSlantMaxTravel` 1.0 sp, ⛔ ours and
> provisional, because Gould gives a MINIMUM distance from the notehead and no maximum. It lands
> after Phase 1 and before the endpoint override, exactly as §12.0 #6 requires.
>
> ⏭️⏭️ **The roundness half was built, measured, and taken back out** — and the three reasons are
> worth more than the code was:
> 1. 🚨 **The FRAME.** Verovio rotates the curve flat and measures there; our arch is lifted
>    VERTICALLY above the endpoint line, so a slur tilted by θ deviates perpendicular by `H·cos θ`. A
>    floor written in our frame moved the drawn control angle from 20° to 26° where the rule asks for
>    39.6 — it looked implemented and was not.
> 2. 🚨 **The ASYMMETRY.** Done honestly the requirement is `H ≥ (span/4)·tan(θ + minAngle) −
>    0.25·|dy|`: the tilt eats the angle at one end and adds it at the other. Verovio has two rules
>    (`minSlopeLeft`/`minSlopeRight`); we have one arch.
> 3. 🚨 **The SIZE.** On a real fixture — 3.5 sp span, 38° tilt — it asks for a **2.5 sp apex**, three
>    times the height law. Verovio's escape valve is a `shiftedMidpoint` that stops the rule once the
>    midpoint would rise 3 sp; porting the rule without it draws a semicircle over a leap.
>
> ⛔ So it is a shape decision needing his eye, not an import. The record lives in
> `slurSlantLimit.ts`'s tail, and `SLUR_CONTROL_ANGLE` keeps its numbers.

**The plan as written:**

> *"in this case we beguin with verovio choice… but it should not be a truth.. maybe we tweak it
> later… but for the plan this is a good number i guess"*

⚠️ **This is the ONLY constant in §12 with no published source, and the code must say so where it
lives.** No book gives a maximum slant — LilyPond's slope 1.1 (≈48°, a scoring *penalty*, so steep
still wins if every alternative is worse) and Verovio's 60° (a *hard* correction) are each engine's
own invention, and MuseScore has none at all. We take **60°** because it is the number of the engine
whose shape maths we already resemble. ⛔ The comment beside it names it as ours and provisional —
never as an engraving rule — or the next reader (him or me) will find it in six months and treat it
as one.

⛔ **Land it AFTER Phase 1, never before.** Our worst slants today are not the music's: the stem-tip
attachment invents them, drawing a rising second as a **3 sp descent**. A ceiling put on top of that
would clamp a fault instead of fixing it, and would hide the evidence that the fault is there.

**How to enforce it, and the trade-off.** Verovio's `GetAdjustedSlurAngle` **raises the lower
endpoint** rather than rotating the curve — so the slur leaves its notehead. Gould gives a *minimum*
of ½ sp from the notehead centre and no maximum, and the practitioners' remedy for a steep slur was
to shift the tip **sideways** by half a notehead (notat.io t=861, from Cortot's and Mikuli's Chopin),
not to lift it. So: raise the lower end as Verovio does, but cap how far it may travel from its own
note, and record that this cap is ours too.

⭐ **Same phase, and this half IS Verovio's own and worth copying outright:**
`GetMinControlPointAngle` raises the minimum control angle from 30° by up to **+15°** in proportion
to how steeply the slur is tilted, scaled by a length factor that is full below 4 sp and zero above
8 — **a short, steeply tilted slur is deliberately made rounder.** Nothing in any of the three does
the reverse. It is the only genuine slant→shape coupling anywhere in the research, and it pairs
directly with Phase 2, which is also about the short end.

⭐ **Both halves live in `rendering/slurSlantLimit.ts`** (§12.0 #1) — the two endpoints in, the raised
one plus the minimum control angle out. That module is also where the ⛔ *this number is ours, not an
engraving rule* comment belongs, since it is the file a future reader will open.

⚠️ **Where it lands in the endpoint order** (§12.0 #6): like Phase 1, **before**
`slurEndpointOffsetPx`. A ceiling that fires *after* the user's nudge would silently undo a
deliberate drag — and `slurTrueEndpoints` (the blue squares) reads the same values, so a clamp on the
wrong side of the add puts the handles somewhere the ink is not.

**Verify:** the ceiling and the control-angle rule headless (given endpoints, given angles); `e2e` —
a leap steep enough to trip the ceiling, and a short steep slur measured rounder than a short flat
one of the same span.

⚠️ **Show it with Phases 2 and 4** (§12.0 #8): all three are TASTE, all three change what he sees,
and three separate approval gates cost three round trips where one side-by-side rendering costs one.

### Phase 7 — three small ones, independent of each other

- ⭐ **Constants in pixels — and this one is worth doing FIRST** (§12.0 #8). `SLUR_*` / `TIE_*` are px
  that behave as staff spaces only because the draw runs inside the staff's scale group. Every
  comparison in §11 and §12 had to be converted by hand. Hygiene, not engraving — but it is why the
  research's "ours" column was wrong twice, and doing it before Phases 2/4/6 means the taste numbers
  reach his eye in the units the research measured them in. ✅ **The conversion is safe**:
  `staffSpacesToPixels` reads `stave.getSpacingBetweenLines()`, which is the **unscaled** spacing (a
  small staff is a `<g>` transform, not a smaller stave), so it preserves `CURVE_THICKNESS`'s ⛔
  *never multiply by the staff size here* property — the same route the slur's `cps` overrides
  already take inside the group.
- ✅ **The chord anchor — BUILT 2026-08-16**, ahead of Phase 8 and because of it: it moves the
  ENDPOINTS, and Phase 8 fits a curve between endpoints, so building the expensive consumer first
  would have meant measuring it twice. `SlurAttachment` carries every head y now and
  `./slurStemEndpoint` picks the **top** for an up-slur and the **bottom** for a down one (§11.2b —
  all three engines; in LilyPond it changes `musical_dy_`, the slur's own idea of the interval).
  Break-tested: with the anchored head deciding, the drawn arc starts *inside* the chord.
- ➡️ **Gould's beam exception — MOVED INTO PHASE 8** (his question, 2026-08-16: *"is it better to do
  8 before 5 and 7?"*). p. 110's *"except when a beam may be in the way"* is a collision statement in
  a placement rule's clothing, and *"is a beam in the way"* is exactly what Phase 8's obstacle pass
  answers generically. ⭐ None of the three engines implements her exception — weak evidence that it
  falls out of collision avoidance rather than needing a rule of its own.
- ➡️ **Moved out:** the tie's padded-rectangle hit-target now lands in **Phase 3b**, where
  `drawCurveArc` hands us the sampled points as a by-product (§12.0 #2).

### Phase 8 — interior notes — ⏳ FIRST PASS BUILT 2026-08-16

> ⭐⭐ **His case, and the reason it started:** twelve sixteenths climbing C5 → G6, slurred from the
> first of them to a note in the bar after. Both ends are LOW; the run's middle is an octave above;
> an arc that knows only its endpoints runs straight through its own music. Measured before the fix:
> the curve passed **1.94 sp BELOW** the highest notehead it covered.
>
> ✅ **`rendering/slurObstacles.ts` — Verovio's single feed-forward pass**, solving
> `3(1−t)²·x + 3(1−t)t²·y ≥ intersection` for the control lifts; with our two lifts equal that is
> `3t(1−t)`, so one division answers each obstacle and the worst one wins. No loop, no search.
> ✅ **The obstacles are what VexFlow DREW**: `coveredChordIds` (the same scan `slurDirection` uses)
> → each note's own bounding box, which spans head + stem + beam — so a beam over a run is in the
> list without hunting for `Beam` objects the pass never kept.
> ✅ **A hand-edited shape opts out**, the rule the nest lift already follows, and the lift is folded
> in as extra height so the override path is untouched.
> ⭐ `CURVE.slurObstacleMargin` **0.25 sp** of air — ⚠️ ours: the books state the constraint (*"all
> notes must appear to be included in a slur"*, p. 322) and no engine publishes a distance. LilyPond
> turns it into a 1000-point veto instead.
>
> ⭐⭐ **HIS SECOND LOOK CORRECTED THE SOLVE ITSELF** (*"the top note is slightly too near the edge of
> the slur"*, on the same run with a rest in the last slot, so its peak sits at t ≈ 0.64). The pass
> was solving against a curve we do not draw, in two ways, and **both were assumptions I had written
> into the module as if they were measurements**:
> 1. **The arch LEANS.** `slurArchCps` offsets its controls by `±SLUR_ARCH_TILT · dy`; the solve used
>    a symmetric cubic. The module's comment claimed the difference "shifts the rest by less than the
>    margin" — measured, it is **0.44 sp against a 0.25 sp margin**, and worth **0.13 sp** of air over
>    his peak.
> 2. **x does not run linearly with t.** With controls a quarter of the span in, `x(0.25)` lands at
>    **0.227** of the span, so reading `t` off an obstacle's x misplaces it by ~2% — most of a staff
>    space on a long slur, and worst where the curve is steepest.
>
> Both are gone: the solve samples the real curve (64 points) and matches each obstacle against the
> samples inside its own x range. Measured over his peak: **0.89 sp** of air. ⭐ The constant is
> exported from `curveStyle` rather than duplicated — two readers, one authored number.
>
> ✅ **AND THE TWO LIFTS ARE NOW SOLVED SEPARATELY — his hand-edit is what asked for it.** The first
> pass added ONE lift to both controls, which cleared the music but kept the arch's LEAN, and the
> lean lowers the control on the side the obstacle is usually on. He dragged the curve into the shape
> he wanted and sent the override back:
>
> | | control 1 | control 2 |
> |---|---|---|
> | ours, one lift | 5.67 | 4.67 |
> | **his hand-edit** | **5.674** | **5.40** |
> | ours, two lifts | 4.22 | **5.37** |
>
> He left control 1 **identical to ours to three decimals** and raised control 2 — a diagnosis, not a
> preference. Solving Verovio's constraint for both (`x` on the first control, `y` on the second,
> least total movement) puts the lift where the obstacle is: at his peak, t ≈ 0.64, the second
> control has **1.8×** the say and takes 1.8× the lift. **It lands within 0.03 sp of his hand.**
> ⭐ Two properties make one pass enough: at t = 0.5 the pair collapses to the old symmetric answer,
> and the componentwise MAX across obstacles is safe (if each control has what every obstacle asked,
> every obstacle clears). The module can be fed its own answer back and returns zero — its spec does.
>
> ⏭️ **The remaining fork is TASTE, not correctness:** control 1 is now 4.22 where his hand left 5.67,
> because the left half of the run is low and nothing there needs clearing — a shaped arch rather
> than a dome. Flooring each lift at a fraction of the larger would keep it fuller. ⛔ His call.
> ⏭️ Also open: ledger lines and articulations as obstacles in their own right, and Gould's beam
> exception (moved here from Phase 7).

**The plan as written:**

Nothing between our endpoints can affect our curve; the only thing that reshapes a slur today is
**another slur** (`slurNestDepths`). All three engines have collision avoidance, and their algorithms
are genuinely different — LilyPond scores candidate endpoint pairs on a grid (`head-encompass-penalty`
**1000** is a veto), MuseScore iterates up to **30** times alternating shape and endpoints over 20
sampled rectangles, Verovio does a **single feed-forward pass** solving `3(1−t)²·x + 3(1−t)t²·y ≥
intersection`. See §11.6.

⭐ **The books state the constraints, never the algorithm** — *"always remain outside a beam"*,
*"must not obscure a ledger line"*, *"all notes must appear to be included in a slur"* (p. 322).
LilyPond's 1000-point veto is that last sentence turned into a number.

Two things are already in our favour when we do build it: **the obstacle boxes exist** (`layout/kerning`
already thinks in located ink boxes, `spacingPadding` measures real extents, `ElementRegistry` knows
where everything landed), and **our `cps` model can express asymmetry** — the two control points are
independent `{x,y}` deltas, so MuseScore's lopsided shoulders and Verovio's horizontal offsets are
both sayable in the data we already store and already let the user drag. Two rules it must respect: a
**hand-edited shape opts out** (the rule the nest lift already follows), and it runs post-layout.

⭐ If we build it, copy **Verovio's**: one pass, no loop, and its constraint math is written for
exactly our shape — a cubic driven by two control points. LilyPond's moves the *endpoints*, which
would fight the endpoint-offset override compartment.

### ⚠️ The one thing on this list that research cannot check

**The maximum slant is in the plan by his call (Phase 6), not by evidence** — §11.10 recorded it as
*"not open, because no authority exists"*, and that finding has not changed: the number is ours. It
is here as a **first cut to be tweaked by eye**, exactly like the pedal's §12 numbers, and the same
rule applies to it as to those — ⛔ a taste number never acquires a source by sitting in the codebase
long enough. If a future session wants to defend 60°, the honest citation is *"Verovio's default,
adopted by him 2026-08-15"*, and nothing more.

---

## 13. ⭐⭐ THE TIE, READ AT SOURCE IN THREE ENGINES (2026-08-15) — ⛔ don't redo this

His call: *"do the tie research on the three engines"*. §11's agents were briefed on SLURS, so
everything we knew about how an engine builds a TIE was one incidental line. Three fresh agents read
**LilyPond** (`944f400e`, 2026-08-03), **MuseScore** (`e68a83b4`, 2026-08-14) and **Verovio**
(`fb5c4db7`, 2026-08-02) at source, each blind to the others, ten identical questions.

**⭐ It overturned two things §11.11 and §12 asserted, and it found a bigger gap than either.**

### 13.1 🚨 THE HEIGHT — and HIS CALL, which settles it

Drawn apex above the tie's own endpoint line, in staff spaces. Ours measured off real ink; the other
three computed from the formulae below.

| tie width | **ours** | LilyPond | Verovio | MuseScore |
|---|---|---|---|---|
| 2 sp | **0.40** | 0.39 | 0.54 | 0.45 |
| 4 | **0.40** | 0.54 | 0.54 | 0.62 |
| 8 | **0.40** | 0.64 | 0.54 | 0.82 |
| 16 | **0.40** | 0.69 | 0.54 | 1.10 |
| ceiling | **0.40** | 0.75 | 0.54 | 1.50 (at ≥33 sp) |

- **LilyPond** — the same `slur_shape()` as its slur, with a tie's own constants: `height-limit`
  **1.0**, `ratio` **0.333** (`define-grobs.scm:3880, 3890`) against the slur's 2.0 / 0.25. So its
  tie can never exceed a **0.75 sp** apex, half its slur's ceiling.
- **Verovio** — ⭐ **a CONSTANT**: `height = (1.6 − staffLineWidth) × unit` (`src/tie.cpp:226`),
  = 1.45 units = 0.725 sp of control rise → **0.544 sp apex at every width**. The span is used only
  to place the shoulders at ¼ and ¾. Its comment says the staff-line-width subtraction is there *"to
  make sure that the tie does not overlap with them"*.
- **MuseScore** — `clamp(0.3 + 0.3·√|L−1|, 0.3, 2.0)` spatia of shoulder
  (`slurtielayout.cpp:2701`), the only one that keeps climbing; the cap bites at L ≈ 33 sp.
- **ours** — `TIE_BOW` 5.3 px → **0.40 sp**, constant.

⭐⭐ **HIS CALL, 2026-08-15, on seeing this table:** *"if we are flatter than musescore i can tell you
i already prefer what we have no that"* — **we keep our height. ⛔ Phase 3's height change is
withdrawn; do not re-propose it.** Two facts support it beyond taste: at a short tie we are already
**identical to LilyPond** (0.40 vs 0.39), and **Verovio's tie height is a constant too**, so
"no length dependence at all" — §11.8's and §12's charge — is not a defect but a design two engines
share. MuseScore is the outlier.

### 13.2 ⚠️ AND GOULD'S ONE NUMBER MAY NOT MEAN WHAT WE READ IT TO MEAN

> p. 61: *"a shallow tie is **1–1½ stave-spaces deep**"* — §11.8 called ours "2.5–3.75× too flat"
> against it.

**No engine draws 1 sp of apex at an ordinary length.** LilyPond never exceeds 0.75, Verovio is
fixed at 0.54, MuseScore needs a 14 sp tie to reach 1.0. Either all three are wrong, or *deep* is not
the apex. Measure instead the **total reach from the notehead centre** — endpoint lift plus apex,
which is what a reader actually sees as the tie's depth:

| | endpoint lift | + apex | **total reach** |
|---|---|---|---|
| **ours** | 0.70 sp (`TIE_LIFT`) | 0.40 | **1.10 sp** |
| LilyPond | 0.50 (head position + 1 half-space) | 0.39–0.75 | 0.89–1.25 |
| MuseScore | 0.70 (0.20 beyond the head's edge) | 0.45–1.50 | 1.15–2.20 |
| Verovio | 0.25 (from the head **centre**) | 0.544 | 0.79 |

⭐ Under that reading **ours is 1.10 sp — inside Gould's band**, and so is LilyPond. ⛔ So the
"2.5–3.75× too flat" line in §11.8 and §12 is **withdrawn**: it compared an apex against a figure
that, on the only reading under which any engine complies, is a total depth. We cannot settle her
wording from source code, and both readings are recorded here so nobody re-derives one of them
alone.

### 13.3 THE ENDPOINTS — three different answers to Gould p. 62

> p. 62: *"the tie starts and finishes at the **centre of the notehead**"* where there is room,
> aligning with its **edge** when it must come closer.

| | x attachment | gap |
|---|---|---|
| **ours** | the notehead's **tie edges** (`getTieRightX`/`getTieLeftX`) | ~0.05 sp, incidental |
| MuseScore | the notehead's **optical centre** — the mean of the SMuFL `cutOutNW`/`NE` anchors (`:1746, :1768`) | 0.1 sp inward (0.2 for an inside tie, 0.45 beside a displaced second) |
| LilyPond | a **skyline** of the whole chord; above the top head that resolves to **¾ across the head** (`0.25·L + 0.75·R`, `tie-formatting-problem.cc:251`) | `note-head-gap` **0.2 sp** inward |
| Verovio | the notehead's **outer edge** (`:380, :390`) | **0.25 sp** outward |

So the field runs centre → ¾ → edge, and **we are at the edge with no deliberate gap at all** —
Verovio, our nearest neighbour in law, leaves a quarter space. ⚠️ Verovio also does the opposite of
Gould for a *short* tie: under 1.5 sp of head-to-head clearance it abandons the insets and runs
**centre to centre straight over both heads**, lifting the tie 0.75 sp instead (`:358–360, :218`).

**The y, by contrast, we already have exactly right.** `TIE_LIFT` is 0.70 sp from the head's centre
= **0.20 sp clear of its edge**, which is MuseScore's `yOffset = 0.20 * spatium` from the notehead
bbox edge (`:1761`) to the digit. ✅ §11.12's finding stands; ⛔ don't touch it.

### 13.4 ⭐⭐ THE REAL GAP: STAFF LINES. Two of three engines position a tie against them; we do not

This is what Gould's *"sufficiently round to be **conspicuous through a stave-line**"* is actually
about, and it is a bigger hole than any constant in §12.

- **LilyPond — the tie is a SEARCH, not a formula.** The Bézier is a pure function of width; every
  interesting decision is a discrete search over `(position, direction)` candidates scored by **15
  penalty terms**, two of which are staff lines: `staff-line-collision-penalty` **5** applied to the
  apex (`center-staff-line-clearance` 0.6 half-sp = **0.3 sp**) and again to the tips
  (`tip-staff-line-clearance` 0.45 half-sp = **0.225 sp**). A short tie sitting in a space gets
  `center_tie_vertically()` — the whole arch is translated so the midpoint of (tip, apex) lands on
  the space's centre. ⭐ The agent's own summary of the risk: an implementation that ports the shape
  formula but not the search *"will produce ties that sit on staff lines"*. **That is us.**
- **MuseScore — a three-pass repair.** `adjustY` (`:2392`): if an endpoint protrudes less than
  `badIntersectionLimit` **0.15 sp** through a line, both endpoints move together to clear it; then
  the *arc* is either fattened or flattened (whichever moves less, up to `0.75 × tieHeight`) to keep
  the apex off a line; and a *small* tie (< 2.0 sp long, < 0.7 sp tall) is translated whole into a
  staff space rather than deformed. Ledger lines get their own pass at a **0.4 sp** margin.
- **Verovio — nothing, deliberately.** It subtracts the staff-line width from its height constant
  and stops there.
- **ours — nothing at all.**

⭐ This is the one place where an engine majority, the book, and our own absence line up, and it is
**new work, not a constant**: it wants a small vertical search (our tie's y is a single derived
number today), not a tweak.

### 13.5 DIRECTION — what we shipped, checked against all three

| | single note | multi-voice | **two opposite stems** | chord |
|---|---|---|---|---|
| **ours** | away from the drawn stems, **both ends** | voice parity (upper over, lower under) | ⭐ away from the **clef's middle line** (Gould p. 64) | outward by position |
| LilyPond | opposite the stem; both up → down; both down → falls through | `\voiceOne/\voiceTwo` pin it outright | **UP**, by fall-through to `neutral-direction`, *"And why not return UP if both stems are DOWN?"* says its own source comment | `Tie_column`: bottom DOWN, top UP, seconds pushed apart, then the optimiser |
| MuseScore | `!primaryChord->up()` — the **START** chord only | **with** the stem (`chord->up()`) | **always UP** (`:3082–3083`) | pivot on a second/unison, else count ties above vs below |
| Verovio | opposite the stem — the **START** note only | layer direction, i.e. **with** the stem | **not handled** — the end note's stem is never read | `PositionInChord`: lower half below, upper half above, middle away from the stem |

✅ **Our multi-voice rule matches both engines**: upper voice ties above = its stem side, lower voice
below = its stem side. ✅ **And we read both ends where MuseScore and Verovio read only the start** —
only LilyPond does what we now do.
⚠️ **But nobody implements Gould's middle-line tiebreak.** All three answer the opposite-stem case
with a flat *up*, and LilyPond's source questions its own answer in a comment. Ours follows the book
instead. ⛔ Not a defect and not to be "fixed" — recorded so a future session knows we are alone
there on purpose.
🚨 One thing **not** to copy: Verovio's `isAboveStaffCenter` fallback is **dead code** — it compares
the staff's top line against its centre and is unconditionally true (`src/tie.cpp:194`).

### 13.6 THICKNESS — we are the heaviest, but inside a real range

| | tip | middle |
|---|---|---|
| **ours (measured)** | **0.10** | **0.30** |
| Bravura | 0.10 | 0.22 |
| LilyPond | 0.08 | 0.17 |
| Verovio | 0.05 | 0.25 (its **slur** is 0.30) |
| MuseScore | 0.05 | 0.21 nominal, ≈**0.29 drawn** |

⚠️ **So §12 Phase 4's "one constant → 0.22" is downgraded from PUBLISHED to a taste call inside a
published range.** MuseScore's *drawn* middle is 0.29, within a hair of our 0.30; the field spans
0.17 to 0.30 and we are at its top edge, not outside it. ✅ Our one-weight-for-both decision is
confirmed correct — LilyPond and MuseScore use identical numbers for tie and slur, and only Verovio
draws its tie **thinner** than its slur.

⭐ A technique worth stealing whatever we choose: Verovio's `GetBezierThicknessCoefficient`
(`boundingbox.cpp:945`) **narrows the fill by the stroke width** so that fill + outline equals the
nominal midpoint thickness exactly. Ours simply adds the two (0.20 fill + 0.10 outline = 0.30), which
is why our number is a third above its own nominal.

### 13.7 THE THINGS WE HAD NEVER ASKED

- **A tie can claim horizontal space, and ours claims none.** MuseScore reserves `minTieLength`
  **1.0 sp** (`minHangingTieLength` 1.5) in its spacing pass; Verovio pushes the second note right to
  guarantee `tieMinLength` **1.0 sp**, but only when a chord or a flag is involved. LilyPond
  deliberately does **not** — it has no rod and merely demerits a short tie (weight 26, its largest
  single-tie penalty).
- **The broken tie: all three draw two independent flat arcs**, each shaped from its own length, and
  none makes the halves match. So Gould's *"keeps its symmetrical shape"* is satisfied by symmetry
  *within* each half, which is what ours does too. ✅ Our Phase 3 migration is still worth doing, but
  for the **weight** mismatch (`StaveTie`'s 4px belly against our 2.7), not the shape.
- **Chord ties: we sit at Verovio's level, which is the floor.** LilyPond scores tie-vs-tie
  collisions (penalty 25 within 0.45 sp, monotonicity 100); MuseScore has
  `resolveVerticalTieCollisions` (0.15 sp clearance, snapping the pair's midpoint to a half-line);
  **Verovio has none, and its own comment admits inner ties can overlap.** Ours likewise.
- **Both other engines have l.v. / partial ties as first-class objects** (`LaissezVibrerTie`,
  `LaissezVib`, `PartialTie`, `Lv`). Our `toggleTie` already ties into a rest for let-ring, so we
  have the model without the engraving.
- **MuseScore masks ties**: `maskTies` true — a tie punches a hole in itself where a clef, key or
  time signature crosses it (`masklayout.cpp:371–431`).

### 13.8 ⏭️ WHAT THIS CHANGES IN §12

1. **Phase 3 loses its height half — his call (§13.1).** What remains is real but smaller: migrate
   the broken tie off raw `StaveTie` so it stops changing weight at a system break.
2. **Phase 4 is downgraded** from a published correction to a taste call inside a 0.17–0.30 range
   (§13.6).
3. **A new phase enters, and it outranks both**: staff-line clearance (§13.4) — the majority
   behaviour, the thing Gould's sentence is actually about, and the only one that needs new machinery
   rather than a new number.
4. ⛔ **Three things are now settled and must not be re-opened**: the tie's height (his call), the
   0.20 sp endpoint lift (already correct), and one weight shared with the slur (confirmed by two
   engines and Bravura).
