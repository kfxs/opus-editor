# Hand / Grab-to-Pan Tool — Implementation Plan

Status: **PLANNED, not started.** Design fully settled with the user 2026-06-19. Builds directly on the
navigation/viewport work (see `docs/navigation-viewport-plan.md`) — that work already gives us a real
scroll viewport (`ViewportModel` + `useViewport`) with a clamped `scrollBy`, which is the entire scroll
mechanic this feature needs.

Goal: Sibelius-style hand tool. Press on **empty space** and drag → the score follows the pointer
(grab-the-paper panning) on **both axes**. While actively panning the mouse pointer **disappears** so the
user knows they're in hand mode. It's a pure navigation gesture — it never changes the selected tool or
palette and works in every tool.

---

## 1. Settled design decisions (with the user, one by one)

1. **Activation — decide on *release*, not press.** We do **not** act on mousedown. A press on empty space
   *arms* a possible pan but changes nothing yet (in particular it does **not** clear the **note**
   selection — see the scope caveat below). On release we look back:
   - **Tap** (released without moving past the threshold) → the tool's normal empty-space action runs:
     in the **selection tool** that means *clear the selection*; in **entry/clef/dynamic/TS tools** that
     means the normal click action (place a note, drop a clef, etc.).
   - **Drag** (moved past the threshold) → it was a pan; the selection is left **untouched**.
   - **Why deferred, not clear-on-press:** the user spotted that clearing on press makes it impossible to
     start a pan without losing the current selection — which kills the "I have something selected, I just
     want to scroll the view (maybe then shift-click to extend)" case. Deferring fixes it.
   - **Tap-vs-drag discriminator = movement distance (~4–5px), NOT time.** Distance is the reliable signal
     of "did the user actually drag the view." Example: press, pause a second thinking, release without
     moving → a *time* rule would wrongly call that a drag; a *distance* rule correctly calls it a tap and
     clears the selection. (A combined "moved past N px **or** held a while" is a possible refinement, but
     plain distance handles every case we care about.)

2. **Cursor — pointer fully disappears (not a hand icon), and only once a real pan begins.** Hide the OS
   pointer the moment we cross the movement threshold (real panning started), restore it on release. We do
   **not** hide on press: a plain click-to-deselect would otherwise make the cursor blink out and back for
   no reason. Waiting for movement keeps simple clicks looking normal.

3. **Tool-agnostic navigation gesture.** Panning sits *on top of* everything and touches **nothing** in the
   palette: the selected tool stays selected, the chosen duration/accidental/etc. are unchanged. In any
   tool, a drag on empty space pans; a tap does that tool's normal action. Zero side effects on editing.

4. **Both axes.** Drag any direction; the score follows. Each axis clamps independently in
   `ViewportModel.scrollBy`, so a sideways drag with nothing to scroll horizontally simply does nothing —
   no special-casing needed.

5. **Selection-preservation is scoped to the NOTE selection (v1 caveat).** The "press-to-pan keeps the
   selection" promise holds for the multi-note selection (`selectedItems` / `selectedNoteId`) — which is
   the case the user cares about ("keep my selection, scroll, then shift-click to extend"). It does **not**
   hold for the other single-select kinds (slur / clef / time-signature / dynamic): `handleMouseDown`
   clears those **unconditionally** on press at `MouseController.ts:303-309`, *before* the empty
   fall-through paths we defer. So pressing empty space to pan still wipes a selected slur/clef/TS/dynamic.
   Deferring those clears too would mean re-shaping the unconditional reset block — out of scope for v1
   (see §6). Only `selection.selectNote(null)` is the deferred call this feature handles.

---

## 2. Mechanics

- **Scroll is already built.** `ViewportModel.scrollBy(dx, dy)` exists and is the single clamped scroll
  path (`src/engine/ViewportModel.ts:97`). Panning = feed it the pointer's frame-to-frame movement.
- **Use raw screen-pixel deltas (`event.clientX/clientY`), NOT SVG coords.** SVG coordinates are derived
  through `getScreenCTM()` and shift as the view scrolls, so using them would feed the scroll back on
  itself. Track `clientX/clientY` between moves and call `scrollBy(-dx, -dy)` (content follows the hand →
  scroll moves opposite to pointer motion).
- All gesture logic lives in `MouseController` (`src/interactions/MouseController.ts`) — the single place
  every mouse event funnels through. The existing note-drag / clef-drag / slur-handle drags are checked
  **first** in `handleMouseMove`, so grabbing those still behaves exactly as today.

---

## 3. Files to touch

- **`src/engine/ViewportModel.ts`** — no change; `scrollBy` already exists and clamps both axes.
- **`src/composables/useViewport.ts`** — expose `scrollBy(dx, dy)` on the `ViewportHost` (wrap
  `model.scrollBy` + `applyScrollToElement`, mirroring the existing `scrollTo`/`ensureVisible`). ~5 lines.
- **`src/composables/useMouseInteraction.ts`** — thread a `panBy: (dx, dy) => void` param into the
  `MouseController` constructor.
- **`src/interactions/MouseController.ts`** — the real work (see §4).
- **`src/interactions/EditorState.ts`** — add a reactive `isPanning` boolean (template binds to it for the
  cursor). Note: the existing `showCursor` flag controls the in-score keyboard *caret*, NOT the OS mouse
  pointer — hiding the actual pointer needs CSS `cursor: none`, hence a separate flag.
- **`src/App.vue`** — (a) pass `(dx, dy) => viewport.scrollBy(dx, dy)` into `useMouseInteraction`
  (`viewport` is created before `mouse`, so ordering is fine); (b) on the score-container element
  (`ref="scoreCanvas"`, currently `class="... cursor-default"`, ~`App.vue:373`) bind `cursor: none` while
  `state.isPanning` — e.g. `:class="[..., state.isPanning ? 'cursor-none' : 'cursor-default']"`.

---

## 4. MouseController changes (detail)

New ephemeral state (not in EditorState — no reactivity needed, same pattern as the other drag flags):
`isPanArmed`, `isPanning`, `panStartClient {x,y}`, `panLastClient {x,y}`, `pendingTapClearsSelection`
(true only when armed in the selection tool), and a `suppressNextClick` flag. Constant
`PAN_THRESHOLD_PX ≈ 4`.

- **`handleMouseDown`** — after the existing guards (`editingText`, `pastePlacementArmed`, and the
  scrollbar guard `event.target === scoreCanvas`), **first defensively reset the ephemeral pan flags**
  (`isPanArmed = false`, `isPanning = false`, `suppressNextClick = false`, `pendingTapClearsSelection =
  false`) so a flag can never outlive the gesture that set it (see the stale-`suppressNextClick` note
  below). Then arm the pan **only in the genuinely-empty paths**:
  - **Entry / clef / dynamic / TS tools:** at the current early return `if (selectedTool !== 'selection')
    return` (~`MouseController.ts:185`), arm the pan first (record `panStartClient/Last` from
    `event.clientX/Y`, `isPanArmed = true`, `pendingTapClearsSelection = false`) then return. The actual
    note/clef placement still happens in `handleClick` on a tap; on a pan we suppress that click.
  - **Selection tool empty fall-through:** the two branches that today call `selectNote(null)` +
    "Selection cleared" (the "too far from element" else ~`:499` and the final else ~`:504`) must **defer**
    the clear: instead arm the pan (`isPanArmed = true`, `pendingTapClearsSelection = true`) and do
    nothing else. The clear now happens on a tap-release in `handleMouseUp`.
  - **CRITICAL — scope arming to empty presses only.** Do **not** arm globally at the top of mousedown: if
    we did, tapping a note would also run the "tap clears selection" path on release and wipe the note
    selection. Only the empty paths arm. (Element-claim paths — note/clef/slur/dynamic/tie/etc. — keep
    returning as they do today and leave `isPanArmed` false.)
  - Minor edge, acceptable: a **modifier** press on empty space (Ctrl/Shift) returns early at the
    multi-select block (~`:235`) without arming → that specific press won't pan. Fine for v1; can arm there
    later if wanted.

- **`handleMouseMove`** — add a pan branch. Place it **after** the existing `isDraggingNote` /
  `isDraggingClef` / `isDraggingSlurHandle` / `isDraggingSlurEndpoint` branches (so those keep priority)
  and **before** the `if (selectedTool === 'selection') return` / ghost-preview logic. Use **client
  coords**, not the computed svg coords:
  - If `isPanArmed`: compute `dx/dy` from `panLastClient`. If not yet `isPanning`, check distance from
    `panStartClient`; once it exceeds `PAN_THRESHOLD_PX`, set `isPanning = true` and `state.isPanning =
    true` (hides the pointer via the CSS binding). While `isPanning`, call `panBy(-dx, -dy)` and update
    `panLastClient`. `return` (skip ghost/preview).

- **`handleMouseUp`** — resolve the gesture (in addition to the existing note/clef/slur drag-end blocks):
  - If `isPanning`: set `suppressNextClick = true`, restore the cursor (`state.isPanning = false`), reset
    the pan state, and **do not** clear the selection. Return.
  - Else if `isPanArmed` (a tap): if `pendingTapClearsSelection`, clear the selection now
    (`selection.selectNote(null)` + `render.renderScore()`). In entry mode `pendingTapClearsSelection` is
    false, so nothing happens here and the normal `handleClick` places the note. Reset pan state either way.

- **`handleClick`** — at the very top, if `suppressNextClick` is set, consume it (`= false`) and `return`,
  so a pan in entry mode doesn't drop a stray note on release.
  - **Stale-flag hazard:** browsers do **not** reliably fire a `click` after a movement-heavy
    mousedown→mouseup, so a `suppressNextClick` set in `handleMouseUp` may never be consumed here and would
    then swallow the *next* legitimate click. The defensive reset at the top of `handleMouseDown` (above)
    is what guarantees the flag can't survive into a later gesture — keep both halves.

- **`handleMouseLeave`** — must **NOT** end the pan. The pan is driven by document-level listeners (see
  below), so it has to survive the pointer leaving the viewport; `handleMouseLeave` bails early when
  `isPanArmed`/`isPanning` so it neither tears the gesture down nor re-renders underneath it.

- **Document-level drivers (the off-viewport fix).** The mouse handlers are bound to the `scoreCanvas`
  element, so its `mousemove`/`mouseup` stop firing the instant the pointer exits — which would freeze the
  pan mid-drag. To fix it, `armPan` attaches `mousemove`+`mouseup` listeners on `document` (capture phase,
  mirroring the existing `onDocMouseDown`/`onDocMouseUp` at `MouseController.ts`), and `resetPanState`/
  release detach them. `handleDocPanMove` does the threshold check + `panBy(-dx,-dy)`; `handleDocPanUp`
  resolves drag-vs-tap and tears down. The element's own `handleMouseMove` keeps only a `if (isPanArmed)
  return` guard (so no ghost note is drawn under the gesture) — it no longer drives the pan, and
  `handleMouseUp` no longer resolves it. Because release is handled on `document`, it fires wherever the
  pointer is when the button comes up, inside the viewport or not.
  - **Cursor stays hidden off-viewport too:** `cursor: none` on `scoreCanvas` only hides the pointer over
    the score, so a watch in `App.vue` also toggles `document.body.style.cursor = 'none'` while
    `state.isPanning`, keeping it hidden when the drag crosses the edge.

---

## 5. Verification (user does manual UI testing)

- Selection tool: tap empty space still clears selection; press-drag empty space pans and **keeps** the
  **note** selection; after panning, shift-click still extends from the kept selection. (A selected
  slur/clef/TS/dynamic is still cleared on press — known v1 caveat, §1.5.)
- Pointer disappears only once the drag actually starts, reappears on release; a plain click never flickers
  the cursor.
- Entry/clef/dynamic/TS tools: tap places the thing as before; drag pans and does **not** place anything.
- Pressing on a note/clef/slur-handle still does the existing pitch-drag / clef-drag / reshape (pan never
  hijacks them).
- Both axes pan; a sideways drag with nothing to scroll horizontally is a no-op (no glitch).
- Scrollbar press still ignored (existing `event.target === scoreCanvas` guard untouched).

---

## 6. Deferred / not in scope

- Modifier+empty-space drag panning (see §4 minor edge).
- **Preserving non-note selections during a pan** (slur/clef/TS/dynamic) — needs deferring the
  unconditional clear block at `MouseController.ts:303-309`; see §1.5.
- ~~Robust off-viewport panning~~ — **DONE** (not deferred): document-level move/up drivers keep the pan
  alive when the pointer crosses the viewport edge; see the document-drivers note in §4.
- **Zoom-aware pan deltas.** Today client-px deltas map 1:1 to scroll px, so `scrollBy(-dx, -dy)` is
  exact. Once the deferred zoom work applies a scale transform to the content surface
  (`ViewportModel.zoom`, currently unused), pan deltas will need dividing by `zoom` or the grab will feel
  too fast/slow when zoomed. Not a v1 concern — just a breadcrumb so it isn't a surprise.
- Inertial/smooth "flick" momentum scrolling — ship the direct 1:1 grab first.
- A spacebar-hold pan mode (Photoshop style) for power users — only if requested later.
