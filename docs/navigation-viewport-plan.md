# Navigation / Viewport — Implementation Plan

Status: **Phase 1 DONE & user-verified 2026-06-18** (two-div viewport/content split + fixed ≈2-line
height; `scoreCanvas` ref kept on the outer scroll viewport, new `scoreContent` inner div is the engine
container; `VIEWPORT_TWO_LINE_HEIGHT` derived from `LAYOUT_CONFIG`). **Phase 2 DONE 2026-06-18** (pure
`src/engine/ViewportModel.ts` + 12 co-located tests; size/scroll/clamp/`ensureVisible`, zoom+viewMode
reserved; no wiring). **Phase 3 DONE 2026-06-18** (`src/composables/useViewport.ts` binds the model to
the outer scroll box + inner content surface: scroll listener + two `ResizeObserver`s DOM→model,
`scrollTo`/`ensureVisible` model→DOM with an echo guard; sizes read from `client*`/`scroll*`; wired in
`App.vue` as `useViewport(scoreCanvas, scoreContent)`, return intentionally unused until Phase 4).
**Phase 4 selection-migration DONE 2026-06-18** (`scrollSelectedNoteIntoView` now resolves the element
bbox engine-side and forwards it to `viewport.ensureVisible`; `SelectionController`/`useSelection` take
an injected `ensureVisible` instead of `getScoreCanvas`; +3 forwarding tests, suite 643). **Playback-
follow DEFERRED** — `PlaybackEngine.onNotePlay` is declared but never fired, so there is no live
per-note signal; following would need a measure/beat→bbox lookup off `onPositionChange` plus throttling,
and is a UX change (scroll-follow can be jarring) — left for an opt-in pass. **Superseded: Phase 5
implemented playback-follow at measure granularity 2026-06-18** (see below). Plan written
2026-06-18, corrected against code 2026-06-18 (ref-split / `innerHTML` / padding / existing
scroll-into-view). This document is the
authoritative plan and cross-session checklist for separating the score *viewport* (the fixed-size
window you look through) from the score *content surface* (the SVG the renderer draws), so the score
scrolls inside a fixed window in **both** axes instead of growing the page vertically.

The first pass is **infrastructure + the bug fix**, not view modes. Pages / continuous-scroll / zoom
are explicitly deferred (see §6) but the design below is shaped so they slot in without touching the
renderer.

---

## 1. Goal

Give the score a **fixed-size window**:

- **Width** already behaves correctly — the score wraps at `CONTAINER_WIDTH = 1000` and a horizontal
  scrollbar appears when the window is narrower. Leave this as-is.
- **Height** is the bug: today the content SVG grows vertically without bound and pushes the whole
  page down, so the JSON panel below gets shoved off-screen. **Fix the window height to roughly two
  staff lines** so the JSON panel stays visible, and let the score scroll *vertically inside that
  window* when it has more than two lines.

Net result: one fixed window, scrollbars on whichever axis overflows, JSON always visible underneath.

---

## 2. Root-cause diagnosis (why height runs away today)

One `<div>` currently does two jobs at once:

`App.vue:365` — the `scoreCanvas` div — is **both**:

1. the **scroll viewport** (`class="... overflow-auto"`), and
2. the **VexFlow mount target** — it is passed straight into
   `new MusicEngine({ container: scoreCanvas.value })` (`App.vue:687`), which hands it to
   `VexFlowRenderer` as `svgContainer` (`VexFlowRenderer.ts:152-153`).

So VexFlow's `<svg>` is a **direct child of the scroll box**. The SVG size is set in `renderScore`
(`VexFlowRenderer.ts:1663-1678`):

- **Width** is hard-pinned to `LAYOUT_CONFIG.CONTAINER_WIDTH = 1000`; the score wraps to a new line
  at 1000px and never gets wider → fixed horizontal extent, horizontal scrollbar when needed. ✅
- **Height** = `numLines * (STAVE_HEIGHT + VERTICAL_SPACING) + MARGIN*2`
  = `numLines * (120 + 30) + 40` → grows with every wrapped line. ❌

And the div has `min-h-[300px]` but **no max height**, so the SVG pushes the div, the div pushes the
page, and the document grows forever instead of scrolling inside a window. That asymmetry —
width boxed, height unbounded — is the whole bug.

### Two staff lines = how many pixels

Per-line content height = `STAVE_HEIGHT + VERTICAL_SPACING = 120 + 30 = 150`.
Full-score height for N lines = `N * 150 + MARGIN*2 (=40)`.

So **two lines ≈ `2 * 150 + 40 = 340px`**. We'll express this as a derived constant
(`≈ 2 * (STAVE_HEIGHT + VERTICAL_SPACING) + MARGIN*2`) rather than a magic `340`, so it tracks the
layout config if those change.

---

## 3. What is already correct (do not break it)

- **Mouse → music coordinate mapping is already scroll- and zoom-proof.**
  `MouseController.clientToSvg` (`MouseController.ts:100-108`) uses
  `svg.getScreenCTM().inverse()`, **not** manual `getBoundingClientRect` + `scrollLeft` math.
  `getScreenCTM` already accounts for the SVG's real on-screen position, including any ancestor's
  scroll offset. **Introducing a real scroll viewport will not break hit-testing, note entry, slur
  drags, clef drags, or text-edit placement.** This is the single biggest risk in a viewport
  refactor and the codebase already sidesteps it.
- **Text-edit overlay — verified safe (no longer a caveat).** The in-canvas text-edit overlay
  (`DomTextEdit.ts`) uses `position: fixed` + `rect.x/y`, and that rect comes from
  `DynamicTextSource.computeScreenRect` (`DynamicTextSource.ts:43-59`), which derives **client**
  coordinates via `svg.getScreenCTM()`. Because `fixed` positioning is viewport-relative and the rect
  is already in client space, the overlay tracks the glyph correctly under scroll — there's even an
  in-code comment reasoning about exactly this `overflow-auto` case. Nothing to do here in Phase 1.

- **`ensureVisible` already exists and is already wired — Phase 1 must not regress it.**
  `SelectionController.scrollSelectedNoteIntoView()` (`SelectionController.ts:347-380`) already
  implements both-axis scroll-into-view with padding, reading `scoreCanvas.scrollLeft/scrollTop` and
  `getBoundingClientRect()`, and it is already called on selection change (`SelectionController.ts:232`).
  This is the *same capability* Phase 4 proposes to build on `ViewportModel`. Two consequences:
  (1) Phase 4 is a **migration** of working logic into the model, not a new feature (see §5).
  (2) The split in Phase 1 can silently break it unless the `scoreCanvas` ref stays on the scroll
  element — see the Phase 1 notes below.

---

## 4. Design — separate *viewport* from *content surface*

The fix, and the foundation for view modes later, is to split the one div into two layers:

```
┌─ viewport (fixed W × ~340px H, overflow:auto, owns scroll) ─┐
│  ┌─ content surface (sized to full score extent) ──────────┐│
│  │   <svg>  (later: N page <svg>s, or one tall surface)    ││  ← scrolls in
│  │                                                         ││    both axes
│  └──────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────┘
```

- The **viewport** has a fixed size and owns scrolling. When content exceeds it in *either* axis it
  scrolls — symmetric by construction.
- The **content surface** is whatever the renderer produces; it does **not** know scrolling exists.
- **Critical boundary:** the engine's `container` must become the **inner content surface**, not the
  outer viewport. Today `engine.container === scoreCanvas` (the scroll box). After the split the
  renderer mounts into the inner surface and stays completely ignorant of scrolling. That ignorance
  is what lets pages / continuous-scroll / zoom drop in later without touching renderer core.

### Framework-agnostic shape (honors the port rule: logic in engine/interactions, Vue is thin glue)

1. **`ViewportModel` — plain class, engine layer, zero DOM, zero Vue.**
   Holds `viewportSize {w,h}`, `contentSize {w,h}`, `scroll {x,y}`, and (reserved for later)
   `zoom` and `viewMode`. Methods: `setViewportSize`, `setContentSize`, `scrollTo`, `scrollBy`,
   `ensureVisible(rect)` (used later for "scroll selection into view" and playback-follow). Pure
   data + math; survives a framework port verbatim; unit-testable with no DOM.

2. **Thin host adapter (Vue composable `useViewport`).** The *only* DOM-aware piece. Two
   responsibilities: (a) write `model.scroll` onto the real scroll element (`scrollTo`), and
   (b) report user scroll back into the model (scroll listener). ~30 lines. A React/Svelte port
   reimplements only this.

3. **Keep `CONTAINER_WIDTH` as-is for now**, but note it for a future "viewport-driven width"
   parameter (§6). Not in scope for the first pass.

For the first pass, the `ViewportModel` is *optional polish* — the bug fix itself is just the
two-div split + a fixed height (Phase 1). The model earns its keep when `ensureVisible` /
playback-follow / view modes arrive. Phases 2+ add it so later work is cheap, but Phase 1 alone
fixes the visible problem.

---

## 5. Phases

### Phase 1 — Two-div split + fixed height (the actual bug fix)
- In `App.vue`, wrap the score area in an **outer viewport div** (fixed height ≈ 340px, `overflow:auto`,
  the scrollbar styling currently on `.score-container`) containing an **inner content-surface div**.
- **Ref split — this is the load-bearing detail:**
  - Keep the existing **`scoreCanvas` ref on the OUTER viewport div.** Scrolling now lives on the
    outer div, and `scrollSelectedNoteIntoView` reads `scoreCanvas.scrollLeft/scrollTop`, so the ref
    must point at the scroll element. Every controller that does `scoreCanvas.querySelector('svg')`
    (`HighlightController`, `DynamicTextSource`, the engine) still works from the outer div because
    the svg remains a *descendant* — querySelector traverses descendants. So the outer div satisfies
    **both** the scroll consumers and the querySelector consumers; that's why the ref goes there.
  - Add a **new `scoreContent` ref on the INNER div** and pass *that* to `MusicEngine` as `container`
    (`App.vue:684-690`), not the outer one, and not `scoreCanvas`.
- **`innerHTML = ''` footgun — do not get the container backwards.** `VexFlowRenderer` calls
  `this.svgContainer.innerHTML = ''` on every render (`VexFlowRenderer.ts:184`). The engine container
  must be the **inner** div so it only wipes itself. If the outer viewport were ever passed as
  container, every render would nuke the inner content-surface div.
- **Padding stays on the inner surface, not the outer viewport.** `scrollSelectedNoteIntoView`
  compares `bbox.x` (SVG-internal coords) against `scrollLeft` (viewport scroll); these stay aligned
  only if the inner surface sits at (0,0) inside the outer viewport with no offset between them.
  Moving the current `p-4` to the outer div would introduce exactly such an offset and make
  scroll-into-view land slightly wrong. Keep padding on the inner surface (or fold it into SVG
  margins); the outer viewport has none.
- Move the `@click/@mousedown/@mousemove/@mouseup/@mouseleave` handlers to whichever element keeps
  events working with the CTM mapping (they bubble, so the outer viewport is fine; confirm).
  **Confirmed + caveat (resolved in Phase 4):** handlers stay on the outer viewport, but because that
  div now owns the scrollbar, a scrollbar *press* fires `handleMouseDown`/`handleClick` on the scroll
  container and (mapping to empty space) cleared the selection / planted a stray note. Fixed by
  ignoring presses whose `event.target` is the scroll container itself (`MouseController`).
- **Height must be an inline `:style`, not a Tailwind class.** Express it as a derived value
  (`≈ 2 * (STAVE_HEIGHT + VERTICAL_SPACING) + MARGIN*2`), but note that `LAYOUT_CONFIG` lives in the
  engine (`VexFlowRenderer.ts`) and a Tailwind utility class can't read a JS constant — bind it via
  `:style="{ height: ... }"` to an exported constant or a renderer getter.
- **Verify:** vertical scroll appears past 2 lines; horizontal scroll still works; JSON panel stays
  put; clicking/note-entry still lands on the right note (CTM makes this free, but confirm);
  **`scrollSelectedNoteIntoView` still scrolls the selected note into view** (don't regress it);
  text-edit overlay still aligns (already verified safe per §3).

### Phase 2 — `ViewportModel` (plain, tested) ✅ DONE 2026-06-18
- Added `src/engine/ViewportModel.ts` + `ViewportModel.test.ts` (12 tests). Pure model, no wiring.
- API: `setViewportSize`/`setContentSize`, `getViewportSize`/`getContentSize`/`getScroll`/`getMaxScroll`,
  `scrollTo`/`scrollBy`, `ensureVisible(rect, padding=ENSURE_VISIBLE_PADDING=50)`. Every scroll path
  funnels through `scrollTo`, the single clamp point (keeps scroll in `[0, maxScroll]`); size setters
  re-clamp. `ensureVisible` mirrors the both-axis, leading-edge logic of the existing
  `scrollSelectedNoteIntoView`. `zoom` and `viewMode` fields are reserved (§6), read by nothing yet.

### Phase 3 — `useViewport` composable wiring ✅ DONE 2026-06-18
- Added `src/composables/useViewport.ts`; wired in `App.vue` as `useViewport(scoreCanvas, scoreContent)`.
- DOM→model: `scroll` listener mirrors user scroll; **two `ResizeObserver`s** (outer box + inner content
  surface) keep sizes current. **Deviation from the original note:** instead of feeding `contentSize`
  from the renderer's SVG attrs after each `renderScore` (which would mean threading a call through
  every render/ghost site), the content `ResizeObserver` fires precisely when the SVG grows/shrinks and
  reads `scoreCanvas.scrollWidth/Height` — same result, no render-callsite coupling, and it also catches
  layout/window resizes for free. Sizes come from `client*` (viewport) / `scroll*` (content) so
  `maxScroll` matches the browser exactly.
- model→DOM: `scrollTo`/`ensureVisible` write the clamped model scroll onto the element, guarded by an
  `applying` flag so the programmatic scroll's echo event isn't mirrored back.
- The returned `ViewportHost` is intentionally unused this phase (`noUnusedLocals` ⇒ called without
  binding); Phase 4 binds it and routes `scrollSelectedNoteIntoView` through `ensureVisible`.

### Phase 4 — Migrate existing scroll-into-view into the model (refactor, not new feature)
**Selection migration ✅ DONE 2026-06-18.** Playback-follow ⏸ DEFERRED (see below).
- `SelectionController.scrollSelectedNoteIntoView()` now resolves the selected element's bbox
  engine-side (`engine.getElementById(...).bbox`, no DOM) and forwards it to an injected
  `ensureVisible(rect)`; `ViewportModel.ensureVisible` owns the both-axis math and the `useViewport`
  host applies the clamped scroll to the element. Behavior is preserved (the bbox is still in
  SVG-internal coords, same as the old inline `scrollLeft/Top` comparison; the ~50px padding absorbs
  the content-surface inset).
- Plumbing: `SelectionController` and `useSelection` now take `ensureVisible: (rect: Rect) => void`
  in place of `getScoreCanvas` (which had no other use). `App.vue` creates `useViewport` *before*
  `useSelection` and passes `rect => viewport.ensureVisible(rect)`. +3 forwarding tests.
- **Playback-follow — DEFERRED, needs a deliberate pass.** `PlaybackEngine.onNotePlay(note)` is
  declared but never invoked, so there is no live per-note id to scroll to. Following the playhead
  would mean mapping `onPositionChange`'s `{measure, beat}` to an element bbox and throttling
  `ensureVisible` (don't call it every animation tick), and scroll-follow during playback is a UX
  change that's usually opt-in. Out of scope until explicitly requested. **→ Done in Phase 5.**

### Phase 5 — Playback-follow (measure granularity) ✅ DONE 2026-06-18
- Sidestepped the dead `onNotePlay` hook: follow at **measure** granularity off the live
  `onPositionChange` measure number instead of per-note. Added `MusicEngine.getMeasureRect(n)`
  (delegates to `renderer.getMeasureBounds`, height = `LAYOUT_CONFIG.STAVE_HEIGHT`); measure key is
  `measure.number`, which matches the playback position (verified both sides).
- `App.vue` position callback reacts **only when the measure number changes** (not every tick) and
  calls `viewport.ensureVisible(rect)`. `ensureVisible` already self-gates (no scroll while the
  measure is comfortably visible), so this pages along by ~a line with no continuous jitter and no
  extra throttle. `lastFollowedMeasure` resets on (re)start (`onStateChange === 'playing'`) so replay
  re-follows from the top.
- Intentionally **not** built: smooth-scroll animation and an opt-in toggle — ship the jump-to-measure
  (same jump selection uses) first; revisit only if it feels abrupt in real use.

---

## 6. Deferred (documented, not blockers)

- **View modes** — `galley` (today), `pages`, `continuous-scroll`. All three become different
  *content-surface layouts* presenting the identical `ViewportModel` interface. The renderer keeps
  drawing a surface of size N×M and never thinks about visibility.
- **Zoom** — add `zoom` to the model; apply as a CSS/SVG transform on the content surface. CTM-based
  hit-testing already survives it.
- **Viewport-driven width** — make layout width a parameter (viewport width minus gutter) instead of
  the `CONTAINER_WIDTH = 1000` literal, so the score reflows to the window instead of fixed 1000.
- **Minimap / page thumbnails** — read-only consumers of the same model.

The one decision that makes all of the above cheap — and is painful to retrofit later — is the
Phase 1 separation of viewport from content surface. That is the point of doing it now.

---

## 7. Code references

- `App.vue:365-373` — the dual-role `scoreCanvas` div (the thing to split). Keep this ref on the
  OUTER viewport; add a new `scoreContent` ref for the inner div.
- `App.vue:684-690` — `onMounted`: engine construction + `container` wiring (pass the inner div here).
- `App.vue:749-779` — `.score-container` scrollbar styling (moves to the outer viewport).
- `VexFlowRenderer.ts:60-83` — `LAYOUT_CONFIG` (STAVE_HEIGHT 120, VERTICAL_SPACING 30, MARGIN 20,
  CONTAINER_WIDTH 1000). Engine-side constant → height must be an inline `:style`, not a class.
- `VexFlowRenderer.ts:184` — `this.svgContainer.innerHTML = ''` on every render (the `innerHTML`
  footgun: container must be the inner div).
- `VexFlowRenderer.ts:1663-1678` — where SVG width (fixed 1000) and height (unbounded) are set.
- `MouseController.ts:100-108` — `clientToSvg` via `getScreenCTM().inverse()` (scroll/zoom-proof).
- `SelectionController.ts:347-380` — `scrollSelectedNoteIntoView` (existing both-axis scroll-into-view;
  Phase 4 migrates this into `ViewportModel.ensureVisible`). Called at `SelectionController.ts:232`.
- `DomTextEdit.ts` + `DynamicTextSource.ts:43-59` — text-edit overlay: `position: fixed` + client-coord
  rect via `getScreenCTM()`; verified scroll-safe (§3), no work needed.
- `MusicEngine.ts:1363-1366` — `resizeCanvas` / renderer re-init.
