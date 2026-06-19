# Zoom — Implementation Plan

Status: **Phases 1–4 DONE & COMMITTED 2026-06-19 (26133bb); only Phase 5 polish (optional) remains.**
Settled 2026-06-19. Score zoom via a single layout→screen scalar
held on `ViewportModel`, applied to the DOM as a `transform: scale()` on a layer above the content
surface (a `sizer` + `zoomLayer` pair) — **not** a re-render and **not** a CSS hack on the lone SVG.
Range **25%–400%**; **Ctrl+wheel** zooms toward the cursor (continuous, multiplicative), **Ctrl+=/Ctrl+-**
snap to a round-number ladder toward the viewport center, **Ctrl+0** resets to 100%; the browser's own
page-zoom is always suppressed. This document is the authoritative plan and cross-session checklist.

> **Correction (post-review):** an earlier draft of §6 claimed `transform: scale()` "doesn't scale
> padding". That is **false** — a CSS transform scales the element's *entire* rendered subtree
> (padding, borders, text, descendants). Because `scoreContent` (the `p-4` host) lives **inside** the
> zoom layer, its 16px padding renders at `16·zoom`. This corrected plan keeps overlays that must scale
> *inside* the zoom layer (the play-cursor) and only applies an explicit `×zoom` to things that live
> *outside* it in fixed/screen space (the text-edit font). See §5, §6.

The design is shaped so the deferred view modes (Sibelius-style **Pages** and **continuous scroll**) and
the future "render only what's in the viewport" optimization slot in **without touching the zoom or scroll
code** — see §3 and §8. That is the whole point of doing zoom as a clean scalar now.

---

## 1. Goal

Let the user scale the rendered score in place, like Sibelius:

- **Crisp at any zoom.** VexFlow draws vector SVG, so a CSS transform scales without blur — no
  re-render, no recompute, GPU-cheap.
- **Zoom is a *view* operation, never a *layout* operation.** Zooming must **not** reflow the music
  (line breaks / page breaks are layout, owned by the view mode, independent of zoom).
- **Inputs:** Ctrl+wheel (= trackpad pinch), Ctrl+= / Ctrl+- , Ctrl+0 reset. The browser's native
  page-zoom is suppressed in every case, whether or not the pointer is over the viewport.
- **Hit-testing, note entry, drags, and the text overlay keep working** with zero changes (see §4).

---

## 2. The three-space model (the load-bearing idea)

Stop thinking "zoom = scale the SVG." Think in three coordinate spaces:

1. **Layout space** — where the renderer *places* things ("this notehead's bbox is at (x,y)";
   later: "page 2 starts at y=1450"). Defined by the **view mode**, independent of zoom. Element
   bounding boxes from the registry live here.
2. **Zoom** — a single scalar. `screenPx = layoutPx × zoom`. Nothing more.
3. **Viewport + scroll** — a window in *screen-pixel* space (the real DOM scroll box).

`ViewportModel` already owns #2 and #3 and reserves `zoom` / `viewMode` fields
(`ViewportModel.ts:44-47`). The discipline that makes everything else cheap: **`zoom` is the one
layout→screen scalar, owned by the model — not a property of any particular SVG.** The model then
never needs to know whether the content behind it is one galley SVG or a grid of page SVGs; it only
knows `contentSize` (in screen px) and `scroll`.

### Coordinate convention (pick one, centralize the bridge)

Real DOM scroll is in **rendered (scaled) pixels**; registry bboxes are in **unscaled layout
coords**. Anything that mixes them breaks under zoom. The rule:

- **`ViewportModel` works entirely in scaled (screen) pixel space** — `viewportSize`, `contentSize`,
  `scroll`, `maxScroll` all match the DOM exactly.
- **`zoom` is the single bridge.** Any input arriving in layout coords (a bbox `Rect` for
  `ensureVisible`, a measure rect for the play-cursor) is multiplied by `this.zoom` **inside the
  model**, so the scale conversion lives in exactly one place.

---

## 3. DOM structure — the one structural choice to bake in now

Apply the transform to a **layer above the content surface**, not to the SVG itself:

```
scoreCanvas      ← viewport, overflow-auto, owns scroll (UNCHANGED)
  sizer          ← explicit width/height = layoutSize × zoom  → gives the scrollbars their range
    zoomLayer    ← transform: scale(z); transform-origin: 0 0  → scales the visuals
      <svg>      ← today: one galley SVG (the current scoreContent target)
                   later: page1.svg, page2.svg … tiled — and NOTHING above <svg> changes
```

Why a `sizer` **and** a `zoomLayer` (and not just `transform` on the SVG):

- **`transform: scale()` does not change `scrollWidth`/`scrollHeight`.** The browser computes scroll
  extent from the *untransformed* layout box, so a scaled SVG would never extend the scrollbars and
  `useViewport.syncSizes()` (which reads `el.scrollWidth/Height`, `useViewport.ts:45-51`) would think
  the content is still 1×. The **`sizer`** with explicit dimensions `= layoutSize × zoom` is what the
  scroll box actually measures.
- The **`zoomLayer`** carries the visual scale. Sizer and zoomLayer agree because both derive from
  the same `zoom`.

Today the zoom layer wraps one SVG; the day Pages view arrives it wraps a grid of page SVGs and **no
zoom or scroll code changes**. This mirrors the Phase-1 viewport/content split from
docs/navigation-viewport-plan.md: a tiny structural decision now turns a future feature from rework
into a drop-in. **Introduce the sizer/zoomLayer pair now, even though the first pass only draws one
SVG.**

> Note: `scoreContent` (the current engine container with `p-4`) becomes the `<svg>`'s host inside
> the `zoomLayer`. The renderer still wipes only its own container (`innerHTML=''`,
> `VexFlowRenderer.ts:193`); the `sizer`/`zoomLayer` are siblings/ancestors it never touches.
>
> **Move the play-cursor inside `zoomLayer`** — as a *sibling of* `scoreContent`, not a child of it
> (the `innerHTML=''` wipe only clears `scoreContent`, so a sibling survives). Today the cursor is a
> child of the scroll box (`App.vue:390-394`); relocating it into the scaled layer makes it scale and
> scroll with the music for free, in pure layout coords — which dissolves the per-frame `×zoom` math
> the old §5.1 needed. Because the cursor now sits in the same scaled space as the staves, its
> translate is just `rect.x + CONTENT_PADDING` (no scaling, and the scaled padding lines up
> automatically). See §5.1.

---

## 4. What is already zoom-proof (do not break it)

- **Hit-testing.** `MouseController.clientToSvg` (`MouseController.ts:209-217`) maps with
  `svg.getScreenCTM().inverse()`. A transform on an ancestor changes the screen CTM, so the inverse
  cancels the scale automatically — clicks, note entry, ghost preview, slur/clef drags all keep
  landing correctly with **no changes**. All engine coordinate math (`pixelToMeasure`,
  `pixelToPosition`, `pitchToPixelY`) runs on the unscaled svg coords `clientToSvg` returns, so it is
  untouched too.
- **Text-edit overlay — *positioning only*.** `DynamicTextSource.computeScreenRect`
  (`DynamicTextSource.ts:48-59`) maps **both** bbox corners through `getScreenCTM()`, so the overlay
  box's x/y *and* width/height scale correctly under any ancestor transform, and `DomTextEdit` is
  `position: fixed` — the box tracks the glyph at any zoom with no change. **But the font size does
  not** — see §5.4.

---

## 5. Things that DO need touching under zoom

1. **The play-cursor — by *relocation*, not by scaling.** The green bar (`App.vue:390-394`) is today
   an absolutely-positioned child of the scroll box, *outside* the zoom layer, positioned from
   `getMeasureRect` layout coords + `CONTENT_PADDING` (`App.vue:542-546`). **Move it inside
   `zoomLayer`** (sibling of `scoreContent`, see §3) so it scales and scrolls with the music
   automatically; its translate then stays pure layout coords (`rect.x + CONTENT_PADDING`) with **no**
   `×zoom`. (If you instead leave it outside the layer, the correct math is
   `(rect.x + CONTENT_PADDING) × zoom` — *both* terms scale, because the padding is inside the scaled
   layer too; see §6. Relocation avoids the trap entirely and is preferred.) Grep for any other
   scroll-box-level absolute positioning before committing.
2. **`ensureVisible` rects.** `SelectionController.scrollSelectedNoteIntoView` and the playback-follow
   path (`App.vue:565`, `App.vue:765`) forward unscaled bboxes. With the §2 convention,
   `ViewportModel.ensureVisible` (`ViewportModel.ts:107-148`) multiplies the incoming rect by
   `this.zoom` before the both-axis math.
3. **Content-size feed.** `useViewport.syncSizes` must set `contentSize = naturalSvgSize × zoom`
   (via the `sizer`), not raw `scrollWidth` — see §7 Phase 2. Keep `contentSize` **single-sourced**
   in `useViewport` (don't also recompute it from natural size inside the model): `model.setZoom`
   touches only the `zoom` scalar and the `scroll` rescale; `useViewport` owns `contentSize` on every
   size *or* zoom change.
4. **Text-edit overlay font size.** `DynamicTextSource.getFontCSS` (`DynamicTextSource.ts:67-72`)
   returns a **fixed** `${DYNAMIC_TEXT_SIZE}pt`. The overlay *box* scales (§4) but the font inside it
   does not, so an edited dynamic renders at 1× point size against a zoomed score — visibly wrong.
   Multiply `fontSize` by `model.zoom` in `getFontCSS` (the overlay is `position: fixed`, in screen
   space, so this is the one place the font must be scaled by hand).

---

## 6. The `p-4` padding DOES scale (and that's fine)

`scoreContent` has 16px padding and the play-cursor compensates with `CONTENT_PADDING = 16`.
**Correction to an earlier draft:** `transform: scale(z)` scales the element's entire rendered
subtree, padding included — because `scoreContent` lives *inside* `zoomLayer`, its 16px padding
renders at `16·z` and the SVG's on-screen left edge sits at `16·z` from the layer origin.

This is fine, and arguably correct (the music's left margin scales together with the music). The trap
is the cursor offset, and there are exactly two consistent choices:

- **Cursor inside `zoomLayer` (preferred, §3/§5.1):** the cursor shares the scaled space, so its
  translate is the raw layout value `rect.x + CONTENT_PADDING` and the scaled padding lines up for
  free. No `×zoom` anywhere.
- **Cursor outside the layer:** then *both* terms scale — `(rect.x + CONTENT_PADDING) × zoom` —
  because the padding it must line up against is itself scaled. Multiplying only `rect.x` and leaving
  the 16px fixed (the old §6 advice) drifts by `16·(z−1)` px: 48px off at 4×.

Sizer/`contentSize` use the SVG's natural extent (§7 Phase 2); the right/bottom padding contributes a
constant `16·z` of non-scrollable margin, which is negligible and harmless.

---

## 7. Phases

### Phase 1 — `ViewportModel` zoom (pure, tested) — **DONE 2026-06-19 (committed 26133bb), 659 tests green**
- `getZoom()` / `setZoom(z)` (clamp to `[ZOOM_MIN=0.25, ZOOM_MAX=4]`). `setZoom` rescales `scroll`
  and `contentSize` consistently and re-clamps via the existing single clamp point.
- **`zoomAt(factor, focal: Point)`** — multiply zoom by `factor`, clamp, and adjust `scroll` so the
  content point under `focal` (a viewport-relative screen point) stays put:
  `newScroll = (focal + oldScroll) × (newZoom / oldZoom) − focal`, then clamp. Pure math; the focal
  point for keys is the viewport center, for the wheel it's the cursor.
- `ensureVisible(rect)` multiplies `rect` by `this.zoom` (§5.2).
- Co-located unit tests: clamping, focal-point invariance (the focal content point is stationary
  across a zoom), scroll rescale, ladder snapping helper. No DOM.
- **Resolution of the Phase-1↔Phase-2 `contentSize` tension (decided in impl):** the zoom methods
  **do** rescale the model's screen-space `contentSize` by the zoom *ratio* (`× newZoom/oldZoom`).
  This is required for the model to be self-consistent and unit-testable without DOM — without it the
  scroll rescale clamps against a stale `contentSize` and focal-invariance can't hold. It does **not**
  violate the "single source" rule: the model never reads *natural* size, it just scales its own
  mirror by the ratio, which equals `natural × newZoom`, so it agrees with `useViewport`'s feed rather
  than fighting it. Phase 2's `applyZoom` therefore does not need to re-set `contentSize` after a
  zoom; `useViewport` writes `contentSize` only from the natural-size observer (render/score growth).
- Implemented as `getZoom`/`setZoom`/`zoomAt(factor, focal)`/`zoomToStop(dir, focal)` + exported
  `ZOOM_MIN`/`ZOOM_MAX`/`ZOOM_LADDER`/`nextLadderStop`; `ensureVisible` now scales the layout rect by
  `this.zoom`. All routed through the private `zoomAbout(z, focal)` (single clamp + scroll/content
  rescale). See `ViewportModel.ts`, `ViewportModel.test.ts`.

### Phase 2 — `useViewport` applies zoom to the DOM — **DONE 2026-06-19 (committed 26133bb)**
- Build the `sizer` + `zoomLayer` DOM (§3). Expose `setZoom(z)` / `zoomAt(factor, focal)` on the
  `ViewportHost`.
- A shared `applyZoom()`: set `sizer` size = `naturalSvgSize × zoom`, set `zoomLayer.style.transform
  = scale(zoom)` + `transform-origin: 0 0`, and `model.setContentSize(naturalSvgSize × zoom)`.
  **`contentSize` is single-sourced here** — `applyZoom` (and the size observer) are the only writers;
  `model.setZoom` must *not* also recompute `contentSize` (it only updates the `zoom` scalar and
  rescales `scroll`). After a zoom: `applyZoom` writes `natural×newZoom`. After a render that grows the
  score: the observer writes `newNatural×zoom`. The two paths never fight because neither derives the
  base from the other.
- **Track the natural (unscaled) SVG size — base = the SVG's own box, NOT `scoreContent`'s.** Do not
  reuse the existing `contentRO` (it observes `scoreContent`, `useViewport.ts:82-84`): `scoreContent`
  is a block element whose `offsetWidth` is *clamped to the container width*, so it would miss any
  horizontal SVG overflow. Use the SVG's true extent instead:
  - **Option A (preferred):** a `ResizeObserver` on the `<svg>` reports its *untransformed* border
    box (RO ignores ancestor transforms) = the SVG's `width`/`height` attributes, giving the base
    size for free on both score growth and layout changes, with no render-callsite coupling (keeps the
    Phase-3 nav philosophy). The `<svg>` node is recreated on renderer `initialize()`
    (`VexFlowRenderer.ts:191-198`), so the observer must **re-bind** when the SVG element changes
    (observe the stable host and re-resolve the child, or re-attach on render).
  - **Option B (fallback):** read the SVG `width`/`height` attributes directly (the renderer sets
    them unscaled at `VexFlowRenderer.ts:1686`) in the size observer + on `setZoom`.

### Phase 3 — Input handling (and suppressing the browser) — **DONE 2026-06-19 (committed 26133bb)**
- **Ctrl+wheel** (also trackpad pinch): a `window` listener registered `{ passive: false }` so
  `preventDefault()` actually kills browser page-zoom. Normalize across devices with a continuous,
  multiplicative factor `factor = exp(-deltaY × k)` (tune `k` so one mouse notch ≈ one 10% step while
  a trackpad pinch stays smooth); call `zoomAt(factor, cursorPoint)`. Always `preventDefault` when
  `ctrlKey` is set, regardless of whether the pointer is over the viewport ("zoom is always score
  zoom" — user's call).
- **Ctrl+= / Ctrl+-** : snap to the next/prev stop on the ladder
  `[0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]`, focal = viewport center. **Ctrl+0** : reset to 1.
  **These can go straight through `ShortcutManager`** — it already calls `event.preventDefault()`
  before dispatching (`ShortcutManager.ts:123`) and matches `Ctrl+`-prefixed combos
  (`ShortcutManager.ts:90-93`), so `Ctrl+=`/`Ctrl+-`/`Ctrl+0` are ordinary `SHORTCUTS` entries and
  the browser's own `+`/`-`/`0` zoom is suppressed for free. Focal = viewport center needs no event
  data. (An earlier draft said these needed raw-event handling outside `ShortcutManager`; that's
  unnecessary. Only the **wheel** truly needs a bespoke `window` listener, because `wheel` isn't a
  keydown and needs `{ passive: false }`.)

### Phase 4 — Fix zoom-aware overlays — **DONE 2026-06-19 (committed 26133bb)**
- **Play-cursor:** relocate it into `zoomLayer` (sibling of `scoreContent`) so it scales/scrolls for
  free; its translate stays `rect.x + CONTENT_PADDING` with no `×zoom` (§5.1, §6). No other
  scroll-box-level absolutely-positioned overlay should remain outside the layer — grep to confirm.
- **Text-edit font:** multiply `DynamicTextSource.getFontCSS` `fontSize` by `model.zoom` (§5.4); the
  overlay box already scales via `getScreenCTM`.
- **Pan is already zoom-safe** (no work): the hand tool feeds `viewport.scrollBy(dx, dy)` client-pixel
  deltas (`App.vue:592`) and `scroll` lives in screen space, so panning stays 1:1 at any zoom.
- Re-verify the deferred-but-present pieces: selection scroll-into-view and playback-follow land
  correctly at non-1 zoom (Phase 1 already scales their rects).

### Implementation notes — Phases 2–4 as built (2026-06-19, uncommitted)
- **DOM:** `App.vue` template now nests `scoreCanvas > scoreSizer > scoreZoomLayer > scoreContent`,
  with the play-cursor a sibling of `scoreContent` *inside* `scoreZoomLayer`. New refs `scoreSizer` /
  `scoreZoomLayer` are passed to `useViewport(scoreCanvas, scoreContent, scoreSizer, scoreZoomLayer)`.
  CSS: `.score-sizer{position:relative}` (containing block + explicit JS-set size), `.score-zoom-layer
  {position:absolute;top:0;left:0}` (transform/origin set in JS).
- **`useViewport`:** tracks `naturalSize` from the `<svg>`'s `width`/`height` attributes via a
  `ResizeObserver` on the svg, re-bound by a `MutationObserver(childList)` on `scoreContent` (the svg
  node is recreated on renderer re-init). `applyZoom()` is the single writer of screen content size:
  sets `sizer` px = `naturalSize × zoom`, `zoomLayer.transform = scale(zoom)` (origin `0 0`), and
  `model.setContentSize(naturalSize × zoom)`. `syncSizes` was split — viewport size still from
  `clientWidth/Height`; contentSize no longer read from `scrollWidth`. Host gained `setZoom` /
  `zoomAt` / `zoomToStop`. **Note:** sizer uses the svg's *natural* extent and ignores the `p-4`
  padding, so a constant `~32·zoom` px of right/bottom padding is non-scrollable (accepted per §6).
- **Input:** Ctrl+wheel = a `window` `wheel` listener `{passive:false}` in `App.vue`
  (`handleZoomWheel`), `preventDefault` whenever `ctrlKey`, focal = cursor clamped into the viewport,
  `factor = exp(-deltaY · ZOOM_WHEEL_K)` with `ZOOM_WHEEL_K = 0.0015`. Keys = `SHORTCUTS` entries
  `Ctrl+=` / `Ctrl++` / `Ctrl+Shift++` → `zoomIn`, `Ctrl+-` → `zoomOut`, `Ctrl+0` → `zoomReset`,
  handled in `useShortcuts` (focal = viewport center; reset uses `zoomAt(1/zoom, center)`). Browser
  page-zoom suppressed via `ShortcutManager`'s existing `preventDefault`.
- **Overlays:** play-cursor relocated (no math change — still `rect.x + CONTENT_PADDING`). Text-edit
  font: `DynamicTextSource` gained a `getZoom` ctor arg (default `()=>1`), `getFontCSS` multiplies
  `DYNAMIC_TEXT_SIZE × getZoom()`; threaded `App.vue → useMouseInteraction → MouseController →
  DynamicTextSource` as `() => viewport.model.getZoom()`.

### Phase 5 — Polish (optional)
- Min/max clamp UX (no over-scroll past the stops), a small zoom-% readout, optional "center the
  content when it fits the viewport" at low zoom. Persist zoom to `localStorage` is **deferred** —
  trivial later, noise during development.

---

## 8. How this enables the deferred view modes (§6 of the nav plan)

The content surface is **opaque** to both zoom and the viewport:

- **Galley (today):** content surface = one SVG strip.
- **Pages (later):** content surface = a grid of page SVGs at their layout offsets; natural size =
  the page-grid extent. Zoom out → `contentSize × z` drops below the viewport → **several whole
  pages tile in the window**, exactly like Sibelius — with **zero** extra zoom code. Scroll pans
  across pages.
- **Continuous scroll (later):** pages stacked vertically; same story.

The seam for **"render only what's in the viewport"**: `ViewportModel.getVisibleContentRect()` returns
the on-screen slice in **layout** coords (`scroll / zoom` to `(scroll + viewport) / zoom`). The
renderer is then handed a layout rect and culls to it ("draw pages 3–5"), still ignorant of zoom and
scroll. Designing zoom as a clean scalar *now* is precisely what makes that culling math trivial; a
re-render-at-scale approach would fight it.

**The one thing that genuinely gets harder in a multi-page world is hit-testing across several SVGs**
(`getScreenCTM()` is per-element, so a click must first resolve which page it is over). That is a
*Pages* concern, not a *zoom* concern — the per-SVG CTM approach still works and zoom doesn't make it
worse.

---

## 9. Framework-agnostic boundaries (honors the port rule)

- **`ViewportModel`** (pure, ports verbatim): owns `zoom`, `zoomAt`, scroll/sizes, ladder snapping,
  and later `getVisibleContentRect()`. Zero DOM, unit-tested.
- **`useViewport`** (the *only* DOM/Vue piece, reimplemented per framework): builds `sizer`/`zoomLayer`,
  applies transform + sizer dimensions, observes natural SVG size. ~20 extra lines.
- **Input adapter** (Vue glue): `window` wheel + `keydown`, translates events into `zoomAt`/`setZoom`.
- **Renderer**: emits a content surface at natural layout size, ignorant of zoom and scroll — already
  true, stays true.

---

## 10. Decisions (settled 2026-06-19)

- Range **25%–400%**; ladder `[25, 50, 75, 100, 150, 200, 300, 400]` for the keys.
- Wheel: **continuous + multiplicative** (`exp(-deltaY·k)`), focal = cursor.
- Keys: **Ctrl+= / Ctrl+-** snap along the ladder, focal = viewport center; **Ctrl+0** = 100%.
- Always suppress browser page-zoom: Ctrl+=/-/0 via `ShortcutManager` (already `preventDefault`s);
  Ctrl+wheel via a `window` `{ passive: false }` listener (window-level, pointer location irrelevant).
- Transform-on-a-layer (sizer + zoomLayer), **not** re-render, **not** scale-the-lone-SVG.
- The `p-4` padding scales with the layer (it's inside it); the play-cursor lives **inside** the zoom
  layer so it needs no `×zoom`; the text-edit font (outside, `position: fixed`) is scaled by hand.
- `contentSize` single-sourced in `useViewport`; natural size read from the SVG box, not `scoreContent`.
- Persist-to-localStorage: deferred.

---

## 11. Code references

- `App.vue:372-395` — score area (outer `scoreCanvas` scroll box + inner `scoreContent`); the
  sizer/zoomLayer go between them. `App.vue:390-394` — play-cursor (**relocate into `zoomLayer`**, §5.1).
- `App.vue:534` — `viewportHeight` (fixed 2-line window; unaffected by zoom). `App.vue:542-546` —
  play-cursor state + `CONTENT_PADDING`. `App.vue:558` — `useViewport(...)`. `App.vue:592` —
  hand-pan `scrollBy` (zoom-safe, no change). `App.vue:565`, `App.vue:765` — `ensureVisible` callers
  (selection + playback-follow).
- `DynamicTextSource.ts:48-59` — `computeScreenRect` (box scales via `getScreenCTM`, no change).
  `:67-72` — `getFontCSS` (multiply `fontSize` by zoom, §5.4).
- `ViewportModel.ts:44-47` — reserved `zoom`/`viewMode`. `:80-85` — `getMaxScroll`. `:89-99` —
  `scrollTo`/`scrollBy` (single clamp point). `:107-148` — `ensureVisible`/`ensureAxis` (scale rect
  by zoom here).
- `useViewport.ts:45-57` — `syncSizes`/`syncScrollFromElement` (content size must become
  natural×zoom). `:59-69` — `applyScrollToElement`. `:75-87` — `attach` + the two `ResizeObserver`s
  (add the natural-SVG observer here).
- `MouseController.ts:209-217` — `clientToSvg` via `getScreenCTM().inverse()` (zoom-proof, do not
  change).
- `VexFlowRenderer.ts:59-82` — `LAYOUT_CONFIG`. `:191-198` — `initialize` (SVG (re)created here →
  observer re-bind). `:1672-1687` — natural SVG width/height set (the base size to scale).
- `ShortcutManager.ts:90-93` (Ctrl-combo matching) + `:123` (`preventDefault` before dispatch) —
  Ctrl+=/-/0 can be plain `SHORTCUTS` entries handled fully inside `ShortcutManager`; only the wheel
  needs a bespoke `window` `{ passive: false }` listener.
</content>
</invoke>
