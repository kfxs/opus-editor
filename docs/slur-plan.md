# Slurs — Implementation Plan

Status: **Phase 0 COMMITTED; Phase 1 DONE (not committed); Phases 2–4 pending.** This document is the
authoritative plan and cross-session checklist.

> **Open correction (see Phase 1):** drop slur *toggling* — the user wants explicit **create** vs.
> **delete**, not press-`s`-again-to-remove. Deferred until after implementation; details in Phase 1.

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
- **`s` again** on a span whose endpoints already carry a slur → **toggle it off** (remove), matching
  `toggleTie`'s toggle semantics.
- A slur is **selectable** (click its arc in selection mode) and **deletable** (Delete), with a
  scoped highlight, just like ties.
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

### Phase 1 — Create / toggle via `s` (same-line only) — DONE (not committed)

> **⚠ POST-IMPLEMENTATION CORRECTION (user, 2026-06-13) — do not act on yet.**
> The user does **not** want toggle semantics on `s`. The desired model is **create vs. delete as
> distinct operations**, not "press `s` again to remove". Phase 1 currently ships the toggle-off
> behavior (mirroring `toggleTie`) to keep momentum; **revisit after implementation** to split into an
> explicit create (`s` only ever *adds*) and a separate delete path (Phase 2's Delete-key / arc
> selection removes). When corrected: drop the "same endpoints exist → remove" branch from
> `toggleSlur` (likely rename to `addSlur`/`createSlur`), keep removal in the select+Delete flow, and
> revise the toggle-off unit test. Tracked here so it isn't lost.

- [x] `MusicEngine.toggleSlur(noteIds: string[])` — resolves endpoints:
  - single note → current note → next slot (note or rest), via `nextDistinctSlot` which **dedupes to
    distinct `(measure, beat)` slots** (skips sibling chord heads at the same beat).
  - range → first/last in score order, **filtered to voice 0**.
  - if a slur with the same endpoints exists → removes it (toggle off — *see correction above*).
- [x] One atomic undo step ("Add slur" / "Remove slur"), `saveUndoState`.
- [x] `'s' → 'toggleSlur'` in `ShortcutConfig`; `PaletteController.toggleSlur` handler +
      `useShortcuts` wiring (reads `selectedItems`, falls back to scalar `selectedNoteId`).
- [x] `renderSlurs` (called after `renderTies` in the post-measure pass), registered in
      `ElementRegistry` as `'slur'` with a bbox. Used a hand-drawn **`drawFlatSlur`** (both endpoint
      Ys, computed bbox) — `Curve` avoided. Same-line only; cross-system spans are skipped (Phase 3).
- [x] Unit tests: endpoint resolution (single / range / score-order / chord next-slot dedupe /
      no-next-slot → null), toggle off, undo+redo. 611 tests green; `build:check` passes.

### Phase 2 — Select / highlight / delete
- [ ] Hit-test the slur in selection mode → set `selectedSlurId` + `selectedItems`. **Bbox
      containment is coarse for a long slur** (the rectangle sits on top of the spanned notes), so
      prefer arc-proximity (distance to the drawn curve) over plain rectangle containment, or at least
      note the trade-off if shipping bbox-only first.
- [ ] `HighlightController.applySlurHighlight` — **color the slur's own `Curve`/SVG group/element, not
      a bbox path-scan** (see §3: a verbatim `colorTieArc` would bleed onto beams/arcs inside the span).
- [ ] Delete removes the `Slur` object (not the notes); undo step.
- [ ] Anchored-note hazards (mirror the tie handling in `deleteNote` `MusicEngine.ts:886`): when an
      anchor head is deleted, **re-anchor or drop** the dependent slur, per the two cases in §4 —
      (a) multi-note chord survives → re-anchor to a sibling head; (b) single note → the replacement
      rest has a **new id**, so re-point the slur to it (like the tie re-link at `:902–905`) or drop it.
- [ ] Unit tests: select, delete, anchor-deletion cleanup (**both chord-sibling and replacement-rest
      re-point cases**).

### Phase 3 — System-break (two-half) rendering
- [ ] When endpoints land on different systems, draw **two partial curves** (trailing half off the
      first system, leading half into the next). The tie precedent (`VexFlowRenderer.ts:2094`) uses
      `StaveTie` with only `firstNote` / only `lastNote`; if Phase 1 went with a hand-drawn
      `drawFlatSlur`, extend it to take a synthetic trailing/leading endpoint X instead. Register both
      partials.
- [ ] Highlight + hit-test both halves as one logical slur.
- [ ] Unit/visual check with a wrapped phrase.

### Phase 4 (deferred, not a blocker)
- [ ] Auto `placement` from stem direction (above for stems-down runs, below for stems-up), with
      override.
- [ ] Optional legato playback interpretation.
- [ ] Draggable control-point handles; nested-slur `number` disambiguation.

---

## 6. Decisions locked (from user)
1. **Key:** lowercase **`s`**.
2. **Single note + `s`:** slur current note → next slot (note or rest).
3. **Range + `s`:** first → last in **score order**, toggle off on repeat.
4. **Multi-voice range:** slur **only voice 0** ("voice 1"), ignore others.
5. **System break:** draw as **two half-arcs** (Gould / Sibelius convention).
6. **Storage:** top-level `Score.slurs[]`.
7. **Playback:** notational only for now (no audio change).
