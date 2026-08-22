# Render performance — what the other engines actually do

Sibling to `docs/render-performance-plan.md`, in the same relation as
`docs/spacing-model-research.md` is to its plan: **the plan is what we decided, this is what we
read.** Every claim here carries a `file:line` from a checkout on disk, or it is marked UNKNOWN.

⭐ **Read this before designing P7.6 (§12.5 of the plan).** It exists because two independent
codebases turned out to implement the same rule (§1), and we had been about to invent a third version
of it from scratch — and because §7 then found that rule has a **browser-level proof** (§7d), not
just two precedents.

⛔ **The one thing this document does not tell you** is whether our residual is forced layout or
plain JS. §7j and plan §12.7 agree: measure that first, then choose.

## 0. The question we went in with

Our own census (plan §12.6, §12.7) had already split the problem in two, and the research was
briefed on that split rather than on "make it fast":

- **Regime A — a mark moves and the music does not.** 0% of measures re-engraved, and still ~9 ms
  per mouse frame, flat across eleven different gestures.
- **Regime B — a width changes.** 13% re-engraved, ~20 ms average, **47 ms worst**, because the
  whole score re-casts-off on every frame.

| source | on disk | status |
|---|---|---|
| **MuseScore 4** | `~/dev/engine-sources/MuseScore` `main` @ `929d1e9` | ✅ read, §2 |
| **Inkscape** | `~/dev/engine-sources/inkscape` `e1e8684` (cloned 2026-08-22) | ✅ read, §3 |
| Illustrator / CorelDRAW / Figma / Affinity — and ⭐ **tldraw / Excalidraw**, which mattered far more | published architecture + open source read on the web | ✅ read, §4 |
| **Browser SVG rendering** — ⭐ the only one about OUR platform | Blink/Gecko/WebKit source, specs, WPT, measured | ✅ read, §7 |

---

## 1. ⭐⭐ THE CONVERGENCE — the one rule both engines implement, independently

**A gesture that moves ink must not be able to reach the code that decides where things go.**
Neither engine achieves this by making the layout fast. Both achieve it by making the layout
**unreachable** for the duration of the gesture, and then running it **once**, on release.

They arrive at it by different routes, which is what makes the agreement worth something:

- **MuseScore — the offset is not a layout input.** A user offset is added when position is *read*:
  ```cpp
  // src/engraving/dom/engravingitem.h:702
  virtual const PointF pos() const { return ldata()->pos() + m_offset; }
  ```
  so `EngravingItem::drag` (`engravingitem.cpp:2248`) sets `m_offset`, returns a damage rect, and
  **never calls `triggerLayout()`**. The frame raises `UpdateMode::Update` (`score.cpp:4779`), which
  sits *below* `Layout` on a monotone four-value ladder (`types.h:1389`, `cmd.cpp:254`), and
  `Score::update()` only calls `doLayoutRange` when the mode reached `Layout` (`cmd.cpp:381`).
  The layout code is not skipped by an `if` — it is **unreachable by construction**.
  Layout runs once, from `SingleElementGroup::endDrag` (`elementgroup.cpp:37`).

- **Inkscape — the model is not written at all.** `SelTrans` captures `_items_affines` (the affines
  at grab time) and each motion recomputes `original × delta` from scratch (`seltrans.cpp:365`),
  bottoming out in one field plus one dirty bit:
  ```cpp
  // src/object/sp-item.cpp:1780
  if (!Geom::are_near(transform_matrix, transform, 1e-18)) {
      transform = transform_matrix;
      requestDisplayUpdate(SP_OBJECT_MODIFIED_FLAG | SP_OBJECT_USER_MODIFIED_FLAG_B);
  }
  ```
  **No XML write, no undo entry, no re-layout.** The XML write and the single undo record happen at
  `ungrab()` (`seltrans.cpp:448`, `:482`), reached from button-release (`select-tool.cpp:632`).

⚠️ **Both accept a visibly wrong picture during the gesture, deliberately.** MuseScore does not
re-autoplace while dragging, so a dragged mark can overlap its neighbours until release, when
`setOffsetChanged(true)` lets autoplace rebase against the new skyline (`autoplace.cpp:43`). That is
the same trade the plan's §12.5 already names — *"the drop must do a full render"* — and it is
apparently the standard one, not a compromise we invented.

⛔ **This is the answer to Regime A, and it is structural, not a micro-optimisation.** Our ~9 ms is
a pipeline with no gate between "a mark moved" and "re-derive the whole score".

---

## 2. MuseScore 4 — `main` @ `929d1e9`

⚠️ The `muse/` submodule is **not checked out**, so `TRACEFUNC`, `muse::Profiler`,
`OBJECT_ALLOCATOR`'s body and the `muse::draw` painter are physically absent. Everything about them
below is UNKNOWN.

### 2a. ⭐⭐ The relayout range, and the stopping rule that bounds it

The unit of incremental layout is the **system**. The range is a monotone tick window accumulated on
`CmdState` (`cmd.cpp:151`) by each mutator's own `triggerLayout()` override — a spanner declares its
whole span and both staves (`spanner.cpp:1458`), a plain item one tick (`engravingitem.cpp:2186`).
Whole-score layout is not a separate path, just a maximal window (`masterscore.cpp:345`), and the
source labels it a hazard:

```cpp
// src/engraving/dom/engravingitem.cpp:2193
//   *************************** CAUTION *******************************
//   This causes a layout of the entire score: extremely expensive and
//   likely unnecessary! Consider overriding triggerLayout() instead.
```

⭐⭐ **And the cast-off does not run to the end of the score — it runs until the break pattern
RECONVERGES.** Two nested stability tests, and this is the single most valuable idea for us:

```cpp
// src/engraving/rendering/score/systemlayout.cpp:338
if (ctx.state().prevMeasure() == ctx.state().systemOldMeasure() && !curMeasureMayHaveJoinedBeams) {
    // this system ends in the same place as the previous layout
    // ok to stop
    ctx.mutState().setRangeDone(true);
```
```cpp
// src/engraving/rendering/score/scorepageviewlayout.cpp:208
//    c) this page ends with the same measure as the previous layout
} while (state.curSystem() && !(state.rangeDone() && lmb == state.pageOldMeasure()));
```

Systems from the edit onward go into a **reuse pool** rather than being deleted
(`scorepageviewlayout.cpp:137`); once `rangeDone`, the remainder is *taken unchanged*
(`pagelayout.cpp:231`), repositioned vertically only, and spliced back on
(`scorepageviewlayout.cpp:255`). Even the layout-data reset pass is range-scoped
(`passresetlayoutdata.cpp:42`).

**So: drag a hairpin one pixel and MuseScore relays out that hairpin's system, plus however many
following systems it takes for the break pattern to line up again — usually zero or one.**

⚠️ **Honest limit: MuseScore has no continuous bar-width drag.** `Pid::USER_STRETCH` is a discrete
command (`{`/`}`, `editstretch.cpp:52`), so it never faces our per-frame case. **The mechanism
transfers; the precedent does not.**

### 2b. Spacing is NOT memoized — and does not need to be

⛔ **Do not go looking for a width cache here.** There is no `Measure::computeWidth`; spacing is a
system-wide solve (`horizontalspacing.cpp:49`) that `squeezeSystemToFit` deliberately re-runs up to
five times in a loop (`horizontalspacing.cpp:145`). Segment shapes are rebuilt from scratch every
time (`segment.cpp:2584`), with no dirty flag. The only per-measure flag, `needLayout`
(`measurelayout.cpp:190`), is a **within-run idempotence guard** — set for every measure the walk
visits (`:399`), cleared at `:202` — not a cross-edit cache.

What *is* cached: the **padding table**, once per score, rebuilt only on style/spatium change
(`score.cpp:5131`, from `styleChanged()` `:1247` and `spatiumChanged()` `:1217`) — the same cadence
our `spacingPadding` table should use. Plus `Shape`'s bbox, `mutable` with explicit
`invalidateBBox()` (`shape.h:183,187`).

The only spacing incrementality is local: while collecting a system, appending a measure re-spaces
**only the last two** (`horizontalspacing.cpp:92,126`), with the full-system solve run once when the
system closes (`systemlayout.cpp:440`). And continuous view shows the complementary trick — measures
outside the range are **translated, not re-engraved**:

```cpp
// src/engraving/rendering/score/scorehorizontalviewlayout.cpp:370
// for measures not in range, use existing layout
```

### 2c. The ladder is scoped to the SYSTEM, and spans are found by interval tree

`SystemLayout::layoutSystemElements` (`systemlayout.cpp:1223`) is our eleven passes: same shape, same
accumulating skyline, same order — skylines → ties → articulations → tuplets → slurs → **trills** →
sticking → fermatas → figured bass → **dynamics/hairpins** → other spanners (pedal, ottava) → measure
numbers (`:1275-1343`). ⭐ **It runs once per system**, over an `ElementsToLayout` collected from that
system's measures only (`:1233-1250`).

The skyline is per (system, staff), lives on `SysStaff` (`system.h:84`), and is cleared and rebuilt
only when that system is laid out (`systemlayout.cpp:130`, `:1672`). Each item is placed against the
skyline built *so far* and then added to it (`autoplace.cpp:83`) — the ladder, accumulating.

⭐ **Which spans a system even looks at is an interval-tree query, not a scan:**
```cpp
// src/engraving/rendering/score/systemlayout.cpp:1597
auto spanners = ctx.dom().spannerMap().findOverlapping(stick.ticks(), etick.ticks());
```
backed by a real tree with a lazy dirty rebuild (`spannermap.h:70`, `spannermap.cpp:85`).

⭐ Two incremental skyline mutators exist, so moving one item does not force a rebuild:
`removeElementFromSkyline` and `updateSkylineForElement(item, system, yMove)`
(`systemlayout.cpp:2545`). And `getFilteredCopy(pred)` (`autoplace.cpp:85`) is how "these two inks
ignore each other" is said without a per-pair special case in the placement loop.

⚠️ Continuous view is their acknowledged weak spot, and they gave up rather than pay:
```cpp
// src/engraving/dom/system.cpp:887
// in continuous view, we only build a partial skyline for performance reasons
// so just give up on autoplace for spanners in continuous view
```

### 2d. Undo is ONE entry, snapshotted at gesture START

`startDrag` captures the before-values (`engravingitem.cpp:2228` → `elementeditdata.h:60`), the
per-frame body uses the **raw setter** `setOffset()` and pushes nothing, and `endDrag` creates the
single record (`engravingitem.cpp:2319`). An empty transaction is discarded rather than pushed
(`transaction.cpp:215`). Gestures that genuinely change the model mid-drag (a hairpin endpoint
crossing segments) push into the *same open transaction* (`line.cpp:557`), so they still collapse to
one entry.

⭐ Directly relevant to plan §12.1 #1: our deep clone per press is the thing this design deletes.
`runBatch` is already the right primitive — it needs to stay open **across the frames of a drag**.

### 2e. Negative findings, and they matter

- **No multithreading in layout.** A repo-wide search over `src/engraving/` and `src/notation/`
  finds threads only in **file saving** (`mscsaver.cpp:121`). No pass is parallel.
- **No built-in layout timing.** `TRACEFUNC`'s body is in the missing submodule;
  `MUE_ENABLE_ENGRAVING_RENDER_DEBUG` is OFF and `LAYOUT_CALL` references a `::dev` namespace that no
  longer exists, so **that build option does not compile**. `DumpLayoutData`'s only call site is
  commented out (`scorelayout.cpp:98`).
- **No documented perf notes.** Zero markdown files in the repo mention performance; every useful
  remark is an inline comment.
- **Painting is worse than ours.** `MuseScoreView::dataChanged` is a `NOT_IMPLEMENTED` stub
  (`scorecallbacks.cpp:31`), and nearly every producer sends an *invalid* rect, which means the whole
  visible canvas (`abstractnotationpaintview.cpp:1197`). ⛔ Do not copy the repaint policy.
  ⭐ Do copy the **layering**: all editor chrome — grips, anchor lines, ghosts, drag cursor — is a
  separate overlay pass that never touches layout (`notationinteraction.cpp:427`), and the playback
  cursor is a separate QML item moved on a 23 ms timer so playback never repaints the canvas
  (`abstractnotationpaintview.cpp:1658-1666`).
- **Lazy layout of closed parts** is their single biggest explicit optimisation: `Score::update`
  skips any score with `!isOpen()` (`cmd.cpp:383`), and `autoLayoutEnabled()` is literally
  `return isOpen();` (`score.cpp:5075`).

---

## 3. Inkscape — `e1e8684` (2026-08-22)

Two independent trees, and it matters throughout: the **object tree** (`src/object/`,
`SPObject`/`SPItem`) is the document; the **drawing tree** (`src/display/`, `DrawingItem`) is the
render tree that mirrors it. A third small tree (`src/display/control/`, `CanvasItem`) holds handles
and rubber bands.

### 3a. ⭐⭐ Dirty flags that PRUNE the walk — the pattern we are missing

The mechanism is documented in the source itself:

```cpp
// src/display/drawing-item.cpp:1155
/**
 * Marks the item as needing a recomputation of internal data.
 *
 * This mechanism avoids traversing the entire rendering tree (which could be vast)
 * on every trivial state changed in any item. Only items marked as needing
 * an update (having some bits in their _state unset) will be traversed
 * during the update call.
 */
```

Two halves, both worth copying verbatim:

1. **Propagation stops at the first already-dirty ancestor** — `requestDisplayUpdate`'s
   `already_propagated` test (`sp-object.cpp:1436`) and `_markForUpdate`'s
   *"If nothing changed, it means our ancestors are already invalidated up to the root. Do not bother
   recursing"* (`drawing-item.cpp:1155`).
2. **Every clean node returns in O(1)** — one line, and it is the whole optimisation:
   ```cpp
   // src/display/drawing-item.cpp:474
   if ((~_state & flags) == 0) return;  // nothing to do
   ```

So the update walk costs **O(siblings along the dirty path)**, not O(document). ⚠️ Note the
asymmetry: a leaf's own change walks only its ancestor chain, but a **parent transform** sets
`SP_OBJECT_PARENT_MODIFIED_FLAG` (`sp-item-group.cpp:143-145`) and forces the walk into every
descendant.

### 3b. ⭐ "Geometry is stale" and "pixels are stale" are TWO different calls

`_markForUpdate` and `_markForRendering` are distinct, and several setters — opacity, visibility,
blend mode, antialias — call **only the second** (`drawing-item.cpp:193-247`).

⭐ Our analogue: a colour change (selection highlight, voice colour) must not be able to trigger a
spacing solve. We already have the seam (`viewStateKey`, and
`reference_only_a_stale_render_runs`); the lesson is that the **picture key and the geometry key
should be two keys**, and most edits should bump only the first. It is MuseScore's `UpdateMode`
ladder again, arrived at from the other side.

### 3c. Damage: two rects, not a union — and a complexity collapse

A move dirties the **old** box before changing anything and the **new** box after
(`drawing-item.cpp:180`, `:664`) — never their union. Each ancestor filter grows the rect and each
ancestor cache is punched in the same upward walk (`drawing-item.cpp:1107`).

⭐ **The collapse heuristic is the clever part.** A moved subtree that is "complex enough" declares
itself totally-invalidating; its descendants then skip their individual damage calls and the whole
subtree emits **one** rect:
```cpp
// src/display/drawing-item.cpp:535
bool const totally_invalidate = _update_complexity >= 20 && affine_changed;
```
⭐ Our analogue: when one gesture dirties many measures (a passage selection, a system-wide change),
mark the *system* and stop descending, rather than emitting per-note invalidations.

### 3d. ⭐⭐ An integer translation SHIFTS a cache instead of dropping it

A cache is a surface **plus a clean region**, not a boolean (`drawing-surface.cpp:149`), so a partial
change invalidates only part of it. And a transform does not invalidate it at all:

```cpp
// src/display/drawing-surface.cpp:172  (DrawingCache::prepare)
if (!is_identity && _pending_transform.isTranslation()) {
    Geom::IntPoint t = _pending_transform.translation().round();
    if (Geom::are_near(Geom::Point(t), _pending_transform.translation())) {
        is_integer_translation = true;
        cairo_region_translate(_clean_region, t.x(), t.y());
```
**Pixel-aligned translation = free. Rotation/scale/sub-pixel = full re-raster.**

⭐ Our analogue is not the raster — it is the *discipline*: a mark that moves by a whole-pixel
translation should rewrite a `transform` and **not** re-derive its ink box or re-run the ladder.

### 3e. Off-screen work is worth nothing

The cache score is computed over `_drawbox ∩ cacheLimit` (`drawing-item.cpp:1227`), so anything
outside the backing store scores ≤ 0 and is never cached (`drawing-item.cpp:1192`, threshold
`CACHE_SCORE_THRESHOLD = 50000.0` at `:34`). ⚠️ `setCacheLimit` is re-set every time the store moves
(`canvas.cpp:818`) — **the limit tracks the viewport; it is not a constant.**

And the store is deliberately larger than the viewport — `prerender = 100`, `padding = 350` px
(`prefs.h:39-40`, `stores.cpp:90`) — so ordinary scrolling triggers nothing. ⭐ If we ever virtualise
the SVG by system, keep a generous margin for the same reason.

### 3f. Negative findings

- 🚨 **Inkscape does NOT degrade quality during a drag.** The agent went looking. Outline mode
  (`SHOW_OUTLINE`, `seltrans.h:206`) is a **user preference** (`inkscape-preferences.cpp:977`), and
  `Canvas::is_dragging()` is used only to block undo/redo (`actions-undo-document.cpp:41,60`), never
  to lower quality. ⛔ **"Draw a cheaper score while dragging" cannot be justified by citing
  Inkscape.** The only automatic degradation is compositing a stale store during zoom
  (`stores.cpp:262`, `cairographics.cpp:286`).
- **Its motion-event coalescer is a dead stub.** `gobble_motion_events` is now `inline void … {}`
  (`tool-base.h:248`); GTK4 removed the mechanism. The throttle that actually exists is the
  **decoupling**: motion sets flags and posts an idle, the idle dedupes (`canvas.cpp:591`), and the
  render is time-boxed to **80 ms** (`prefs.h:37`, `canvas.cpp:2353`).
- ⭐ **A real speed-gated deferral does exist — for snapping.** The expensive part of a drag is
  postponed while the pointer moves fast, with a watchdog so it always eventually runs:
  ```cpp
  // src/ui/tools/tool-base.cpp:1586
  // Snap when speed drops below e.g. 0.02 px/msec, or when no motion events have occurred for some period.
  if (speed > 0.02) { ... _schedule_delayed_snap_event(); }
  ```
  ⚠️ Default `/options/snapdelay/value` is **0 = disabled** (`tool-base.cpp:1565-1568`).
- **The final GTK invalidation is whole-widget anyway**, with a TODO
  (`canvas.cpp:1636`) — all the region precision buys less *re-rasterisation*, not a smaller blit.

### 3g. ⛔ What is NOT applicable — the browser already does it

Dirty-region computation, `coarsen()`, `bisect()` tiling, the thread pool, backing stores, the
snapshot/decoupled compositing, per-item raster caches and the 64 MiB budget
(`canvas.cpp:2045,2148,2179`, `stores.cpp`, `drawing.cpp:286`) **all exist because Inkscape draws
into a raw pixel surface.** We hand the browser a retained-mode SVG DOM; it owns dirty rects, tiling,
off-main-thread rasterisation and GPU compositing.

⭐⭐ **The corollary, stated plainly: our per-frame cost is never rasterisation. It is our own
JavaScript, before the DOM is touched.** Every millisecond we can find is in §1–§3f, none in the
machinery above.

---

## 4. The vector editors — and ⭐⭐ the two WEB ones that turned out to matter

⚠️ **The named targets published almost nothing usable.** Illustrator and CorelDRAW are closed, and
Affinity's "Serif Engine" material is **marketing only** — the agent searched their forums for a
developer statement on tiling or threading and found none. ⛔ **Treat every Affinity performance
claim as unsubstantiated for engineering purposes.** The value came from elsewhere.

### 4a. ⭐⭐ tldraw — the closest published analogue we have, because it renders to DOM/SVG

tldraw draws shapes as **DOM/SVG nodes**, not canvas, so it is the one production editor facing our
exact platform constraints. Its design comment states our problem and its answer in one sentence
(`packages/editor/src/lib/components/Shape.tsx`):

> *"Rendering the 'inside' of a shape is more expensive than positioning it or changing its color, so
> we use memo to wrap the inner shape and **only re-render it when the shape's props change**."*

And the positioning path writes **straight to `.style`, bypassing the framework**, guarded against
the previous value:

```ts
useQuickReactor('set shape stuff', () => {
  const transform = Mat.toCssString(editor.getShapePageTransform(id))
  if (transform !== prev.transform) {            // only when it actually changed
    setStyleProperty(containerRef.current, 'transform', transform)
    prev.transform = transform
  }
}, [editor])
```

Each shape sits in its own container element, so the browser gets per-shape paint scope for free.
Their docs (https://tldraw.dev/sdk-features/performance) add: a spatial index that hides off-screen
shapes with `display: none`; a geometry cache *"invalidated only when a shape's props change"*;
level-of-detail at low zoom (shadows dropped, strokes → solid paths, patterns → solid colours); and a
**stable `getEfficientZoomLevel()`** instead of the continuously-changing value, specifically to
avoid jank during drag and zoom.

🚨 **And the direction of their 2025 migration is a warning worth keeping:** tldraw is moving
high-frequency *overlays* (selection indicators) **off SVG onto a 2D canvas**, claiming up to 25×
(https://github.com/tldraw/tldraw/issues/8314). ⭐ Note which half moved: **the overlay left SVG, the
shapes stayed.** Chrome that changes every frame is what hurts; the document body is fine.

### 4b. ⭐⭐ Excalidraw — the complete, copyable "cheap during the gesture, accurate after" pattern

Three separate canvases (`StaticCanvas.tsx`, `InteractiveCanvas.tsx`, `NewElementCanvas.tsx`). The
static one is memoized against an explicit **whitelist** of props — which contains a flag literally
named `selectedElementsAreBeingDragged` — so the document layer does not repaint while only
interaction state changes.

⭐ **The throttle is on the RENDER, not the event** (`renderer/staticScene.ts`):
```ts
/** throttled to animation framerate */
export const renderStaticSceneThrottled = throttleRAF(...)
```
Handlers still run per event and keep state exact; the paint happens once per frame. ⚠️ That ordering
matters — throttling the *event* would drop input and make hit-testing lie.

⭐⭐ **Gesture-scoped degradation with a debounced restore**, which is the pattern the plan's §12.5
needs and which ⛔ **Inkscape cannot be cited for** (§3f): during a zoom gesture `shouldCacheIgnoreZoom`
suppresses per-element re-rasterisation, so the old-resolution bitmap is simply scaled — a visibly
cheaper picture. Then:
```ts
private resetShouldCacheIgnoreZoomDebounced = debounce(() => {
  this.setState({ shouldCacheIgnoreZoom: false })
}, 300)
```
**300 ms after the gesture settles, the accurate picture comes back. The cheap picture is never left
standing.** Their per-element cache is a `WeakMap` keyed on the element object, so *replacing the
element object is the invalidation* — no bookkeeping, no stale sweep.

### 4c. Figma — the real lesson is NOT a rendering trick

⚠️ Figma has published a great deal of *reasoning* and very little of the drag/invalidation mechanics
we wanted. **UNKNOWN**: what invalidates a tile, whether a dragged object is promoted out of the tile
cache, whether they composite a dragged object over cached static tiles. It is *architecturally
implied* by "tile-based" — ⛔ but they never said so, and inference is not evidence.

⭐⭐ What they *did* publish maps exactly onto our ~9 ms of unchanged-document bookkeeping, and they
have now shipped it **twice for two different derived structures**:
- Component instances: *"The old system updated entire instances whenever anything changed… recursive
  cascades of work that locked up the editor"* → **push-based invalidation with dependency tracking**
  (*"When a source changes, we mark its dependents as dirty and recompute them later"*), 40–50% on the
  affected operations.
- The accessibility tree: built once on load, then *"surgical updates rather than rebuilding from
  scratch as edits are made."*

**The generalisable rule: every structure derived from the document is built once and patched
incrementally; nothing derived is ever rebuilt wholesale on an edit.**

🚨 **And do NOT read "Figma rejected SVG" as advice to us.** Their objection was *"HTML and SVG
contain a lot of baggage and are often much slower than the 2D canvas API **due to DOM access**"* —
i.e. the cost is *JS touching the DOM*, not the DOM existing. They also rejected 2D canvas for being
immediate-mode. They wrote their own DOM at a scale we are nowhere near.

### 4d. Illustrator — the SDK headers leak more architecture than the marketing

⭐ **An explicit overlay layer, with independent invalidation** (`AIAnnotator.h`): annotations are
*"drawn on top after all artwork has been drawn"*, invalidated by their own `InvalAnnotationRect`,
and — the important sentence — ***"Illustrator erases annotations only from the invalidated
region."*** The artwork underneath is not re-erased when only the overlay changes.

⭐ **Art drawing is interruptible and resumable** (`AIDrawArt.h`): *"a lengthy drawing operation can
be interrupted in response to user activity… returns `kDrawArtInterruptedErr` and the `interruptedArt`
member… is set to the object where drawing stopped"*, resumed by `kAIDrawArtPreviewContinue`.
Progressive rendering with input priority, object by object.

Dirty rectangles are explicit (`AIDocumentView.h`: `Get/SetDocumentViewInvalidRect`). And a
documented automatic fallback: **Real-Time Drawing and Editing — *"If there is a lag, the experience
changes to non-real-time."*** ⚠️ helpx.adobe.com timed out on five fetch attempts; that wording is
from search snippets of the official page, so treat it as near-verbatim.

⛔ **Mercury Performance System is co-marketing with no architecture behind it.** Build nothing on it.

### 4e. InDesign — Adobe conceding the point in a shipping product

**Live Screen Drawing**, a user preference with three values: **Immediate** (every step of every
transformation live), **Delayed** (live preview only after a brief click-and-hold), **Never** (the
object is redrawn only on mouse release). Exposed to scripting as `LiveDrawingOptions`.

⭐ That is Adobe admitting **full live redraw during a drag is not always affordable, and that the
fallback is to not redraw the document at all until release.** (Preference existence: official docs.
Behavioural descriptions: practitioner sources.)

### 4f. The rest, briefly

- **CorelDRAW** — only *user-selectable* quality levels: Wireframe / Normal / Enhanced, plus
  *"Rasterize Complex Effects"* (a documented vector→raster substitution for transparencies, bevels
  and drop shadows). ⛔ Scene-graph retention, dirty rects, tiling, caching: **nothing public
  whatsoever. UNKNOWN.**
- **Qt Graphics View** — worth knowing because it *names every knob* you would otherwise invent:
  `ViewportUpdateMode` (minimal region / bounding rect / smart / full / none), and
  `QGraphicsItem::CacheMode` — `DeviceCoordinateCache` is precisely "cache a moving object's raster
  and blit it at the new position". A whole toolkit shipped that as an enum value.
- **Penpot** — the one design tool that publicly migrated **away from an SVG DOM**, to Rust/WASM +
  Skia with tile rendering. ⚠️ Honest counterpoint from their own tracker: an issue titled *"WebGL
  rendering is not an improvement"*. And even their shipped tile index cuts a corner —
  `TileHashMap.invalidate()` is `grid.clear(); index.clear()`, all-or-nothing.
- **Sketch** — the *opposite* lesson, and a good one: their win was not caching or dirty rects but
  **eliminating speculative off-screen buffers** (allocated whenever a group needed opacity < 100%, a
  mask or a blur). The fix was *knowing more before drawing*, not drawing less often.

### 4g. 🚨 The one thing to MEASURE rather than believe

Two bodies of evidence disagree about whether an SVG `transform` is cheap:

- **2021 promise:** Chromium 89+ hardware-accelerates SVG animations; WebKit's layer-based SVG engine
  *"finally unlocks hardware acceleration for SVG"* and *"cheap transform animations"*.
  ⚠️ **Both statements are about *declarative* animations** (CSS / Web Animations). A per-frame
  scripted attribute write is a different code path.
- **2014 measurement:** Khan Academy measured that *"applying linear transformations to SVG elements
  does trigger re-layout and re-painting"*, and got **12 fps → 52–60 fps** by wrapping SVG elements
  in HTML `<div>`s and transforming the divs instead.
- **2025 evidence the old finding has not fully evaporated:** tldraw still moving overlays off SVG
  (§4a).

⛔ **Do not design around either number.** This is exactly what the pending browser-SVG research (§7)
and a DevTools session have to settle for *our* Chrome and *our* node counts.

### 4h. Event coalescing — settled, and it is a platform fact

Since **Chrome 60**, `pointermove`/`mousemove`/`wheel`/`touchmove` are already delayed and dispatched
*"right before the `requestAnimationFrame()` callback occurs"*. `getCoalescedEvents()` returns the
merged path if we ever need it (freehand drawing — probably never, for a score).
`pointerrawupdate` fires *before* coalescing, which is the wrong direction for us: **our problem is
doing too much per frame, not receiving too few events.**

⭐ So the plan's item 2 is not "add a throttle to the mousemove handler". It is Excalidraw's shape:
**handler per event, render once per frame** (§4b).

---

## 5. What transfers, ranked, per regime

### Regime A — a mark moves (the flat ~9 ms floor)

1. ⭐⭐ **Make an offset a paint-time addend, not a layout input**, and add a gate that makes the
   layout code unreachable for a picture-only change (§1). This is *the* fix, and both engines have
   it. Our analogue: consume `engravingOverrides` offsets when computing the SVG transform, not when
   computing the placement; a mark drag becomes one `transform` rewrite.
2. ⭐⭐ **Scope the eleven passes to the SYSTEM** and index spans in an interval tree (§2c). Then
   "0% redrawn" genuinely costs zero, because the passes live inside the per-system work.
3. ⭐ **Two keys, not one** — picture-stale vs geometry-stale (§3b, §2a).
4. ⭐ **Dirty bits that prune the walk**, with propagation stopping at the first dirty ancestor
   (§3a) — `if ((~_state & flags) == 0) return;` is the whole idea.
5. **Skyline `remove(item)` / `translateItem(item, dy)`** instead of a rebuild (§2c).
6. **A whole-pixel translation must not re-derive ink or re-run the ladder** (§3d).
7. ⭐⭐ **Separate the CHEAP transform from the EXPENSIVE content** (§4a). tldraw's rule, from the one
   production editor on our platform: a dragged mark's *ink* does not change while it is dragged —
   only its placement does. If a drag frame re-derives the drawing, that is the 9 ms.
8. ⭐⭐ **Never rebuild a derived structure on an edit** (§4c). Figma shipped this twice. Anything we
   recompute per frame that is a function of *unchanged* document state — ink boxes, hit indexes,
   bounds, the spacing of untouched bars — should be dependency-invalidated, not rebuilt.

### Regime B — a width changes (20–47 ms, whole-score re-wrap)

1. ⭐⭐ **Bound the cast-off with a reconvergence test** (§2a). Keep the previous run's last measure
   per system and per page; stop the moment a re-collected system ends on the same measure; splice
   the untouched tail back in. We already have `pageCastOff`; the missing pieces are the reuse pool
   and the `systemOldMeasure`/`pageOldMeasure` comparison.
2. **Shift, don't re-engrave**, for measures downstream of the edit within a system (§2b).
3. **Re-space only the two measures around a change** while collecting (§2b).
4. **Speed-gated deferral** of the ladder/kerning re-plan during a drag, with a watchdog (§3f) —
   composes with Regime A #1, since nothing is committed until release either way.
5. **Time-box and yield** if a full re-layout exceeds a budget (§3f's 80 ms) — `pageCastOff` is the
   natural unit. Illustrator does the same at object granularity, resuming from `interruptedArt`
   (§4d).
6. ⭐ **Gesture-scoped degradation with a DEBOUNCED restore** (§4b) — Excalidraw's 300 ms, and the
   complete pattern the plan's §12.5 needs. ⚠️ For a *score* the honest framing is a taste question
   as much as an engineering one: seeing the reflow is half the point of engraving feedback. So
   reflow the system under the pointer live, and defer the rest.

### Independent of both

- **One undo entry per gesture, snapshotted at gesture start** (§2d). Small, and it deletes plan
  §12.1 #1.
- **Editor chrome on its own overlay layer** (§2e, §4a, §4d) — three independent confirmations, and
  Illustrator's is the sharpest: *"Illustrator erases annotations only from the invalidated region."*
  We largely do this; the lesson is to be strict about it, and ⭐ tldraw's 2025 move suggests the
  highest-frequency chrome may eventually want a `<canvas>` rather than SVG.
- ⭐ **Throttle the RENDER, not the event** (§4h) — the shape of the plan's item 2.

---

## 6. UNKNOWN — do not fill these in from memory

- MuseScore's `muse/` submodule internals: `TRACEFUNC`/`muse::Profiler` semantics,
  `OBJECT_ALLOCATOR`'s body, whether the custom allocator is on in release, glyph/path caching in
  `muse::draw::Painter`.
- Qt-level behaviour under MuseScore: mouse-event compression, `QQuickPaintedItem`'s backing store.
- Whether Inkscape's constants (the ≥20 complexity threshold, `CACHE_SCORE_THRESHOLD = 50000`, the
  80 ms render limit) were empirically tuned — **the source carries no rationale for any of them**,
  and `stores.cpp:312` flags its own thresholds as `// Todo: Un-hard-code these thresholds.`
- **Actual measured frame costs in either engine.** Neither agent built or profiled anything. Every
  statement here is about *which code runs*, never about how long it takes.
- MuseScore's vertical layout cost (`SystemLayout::minDistance`, `centerElementsBetweenStaves`), and
  whether repeated `undoChangeProperty` calls in one gesture are coalesced *within* the single entry.
- **Figma**: what invalidates a tile; whether a dragged object is promoted out of the tile cache;
  whether the static scene is composited from cached tiles during a drag. Architecturally implied,
  ⛔ never stated.
- **Illustrator / CorelDRAW / Affinity**: whether any of them holds the unchanged scene as a cached
  bitmap during a drag; Illustrator's art-object invalidation granularity; whether the composited
  result stays GPU-resident across frames. CorelDRAW has **nothing public at all**, and Affinity's
  entire architecture is UNKNOWN — marketing only.
- ⭐ Whether a per-frame *scripted* SVG `transform` write is composited or triggers layout **on
  today's Chrome, at our node count** (§4g). Two bodies of evidence disagree and neither is about
  our case.

---

## 7. ⭐⭐ THE BROWSER — read from Blink, Gecko and WebKit source

The one section about **our** platform rather than someone else's. ⭐ Every claim below was read from
an engine's own source, a spec, or a measurement with numbers; where it is advice, it says so.

### 7a. 🚨🚨 `getBBox()` costs NOTHING to measure and EVERYTHING to call

The suspicion was right and the mechanism is worse than "getBBox is slow". In Blink the bounding box
is a **stored field** — `LayoutSVGShape::ObjectBoundingBox()` is `return fill_bounding_box_;`. So
**100% of the cost is the flush**, and every one of these opens with a lifecycle update:

```cpp
// third_party/blink/renderer/core/svg/svg_graphics_element.cc
GetDocument().UpdateStyleAndLayoutForNode(this, DocumentUpdateReason::kJavaScript);
```
in `getBBoxFromJavascript()`, `getCTM()` and `getScreenCTM()` — and the same line in **eight**
methods of `svg_text_content_element.cc` (`getComputedTextLength`, `getExtentOfChar`, …). WebKit
(`SVGGraphicsElement::computeBBox` → `updateLayoutIgnorePendingStylesheets`) and Gecko
(`GetBBox()` → `GetPrimaryFrame(FlushType::Layout)`) do the same.

🚨 **And `…ForNode` is a lie about scope.** The node argument is used *only* to force display-locked
ancestors open; it then calls the ordinary document-wide `UpdateStyleAndLayout`.

⭐ **Why batching works, in two early-outs:** a read on a **clean** document early-outs of both style
and layout (`if (!needs_layout_tree_update) { advance_to_style_clean(); return; }`); a write dirties
it again. So read→write→read→write costs N flushes and read-read-read costs one.

⭐⭐ **But an `<svg>` element is a RELAYOUT ROOT** — `ObjectIsRelayoutBoundary`: *"SVG roots are
sufficiently self-contained to be a relayout boundary, even if their size is non-fixed."* So dirt in
one `<svg>` does not relayout another. ⚠️ It must not be a flex/grid item to qualify — ours sits
inside block boxes and does, ⛔ so do not "simplify" that nesting.

**Where we do exactly the wrong thing**, read off our own code: `GhostRenderer` removes children,
appends a group, appends to the SVG (**writes**), then `group.getBBox()` (**read**), then
`setAttribute('transform', …)` (**write**) — once per ghost kind. `DynamicsLayout.registerDynamics`
reads two `getBBox()`es **per dynamic**, and `layoutCoLocatedDynamics` reads then writes a transform
— inside the draw loop. `MouseController.clientToSvg` calls `getScreenCTM()` from the mousemove path
(trivially cacheable for a gesture).

⚠️ **Calibration, `[measured]`:** Firefox bug 1579181 — `getBBox` interleaved with writes over a
document with `<use>` elements: **4,647 ms vs Chrome's 18 ms**. Chrome flags a forced reflow at 30 ms.

### 7b. 🚨🚨 A `transform` on a `<g>` is a LAYOUT operation — SVG is excluded from HTML's fast path

Not folklore; two lines of Blink:

```cpp
// LayoutObject::AdjustStyleDifference
if (diff.transform_changed && IsSVG()) {
  if (!IsSVGRoot()) diff.SetNeedsFullLayout();
}
// PaintPropertyTreeBuilder::CanDoDeferredTransformNodeUpdate
if (object.IsSVGChild()) return false;
```

⭐ **Note the exemption — `if (!IsSVGRoot())`.** Transforming the **outer `<svg>`**, or an HTML
wrapper, is an ordinary compositable HTML transform. That is the single most actionable sentence in
the whole research, and it is what makes §7d work.

⭐ Our "move a measure group by rewriting its transform" is still much cheaper than re-engraving,
because `TransformHelper::ComputeChange` returns **`kScaleInvariant`** when the scale is unchanged —
only the group re-lays-out, not its descendants. ⛔ Change the **scale** component and it returns
`kFull`, which `SetNeedsLayout`s every descendant. Never touch scale during a gesture. (We already do
the right thing: zoom is a CSS transform on an HTML div, outside the SVG. ⛔ Keep it there.)

⛔ **`style="transform:…"` is not a cheaper spelling.** In SVG2 `transform` is a presentation
attribute — `SVGTransformableElement::SvgAttributeChanged` calls `UpdatePresentationAttributeStyle`,
so both land in the same `ComputedStyle` diff. Gecko agrees. And the one measurement available had
the attribute repainting **less** (36k px² vs 139k px²).

The ranking that follows: `fill`/`stroke`/`visibility` → paint only. `opacity` → compositable.
`transform` on the outer `<svg>` → no layout. **`transform` on a `<g>`, `x`/`y`/`d`/`points`,
`stroke-width`, add/remove → layout.**

### 7c. Layer promotion — it works in Chrome, and it will not save a JS drag

`[measured, Chromium 141]` `will-change: transform` on one `<g>` creates a real layer, and moving
that group goes from 1 paint / ~36k px² to **0 paints**. 128 of them → 132 layers.

🚨 **But promotion does not remove the layout.** A *declarative* animation is composited; a
**JavaScript write** still goes through `AdjustStyleDifference` → `SetNeedsFullLayout` (§7b) and is
excluded from the deferred fast path by name. It is a raster fix for a main-thread problem.

⛔ **And it is Chrome-only.** Firefox removed it deliberately (bug 1930674: *"we don't rasterize
locally unless actually animating"*). Safari **cannot** — `LegacyRenderSVGModelObject` is not a
`RenderLayerModelObject`, and WebKit compositing is built entirely on `RenderLayer`; the layer-based
SVG engine is still `defaultValue: false`.

🚨🚨 **Two costs that would land on us specifically**: it disables LCD subpixel text antialiasing on
the layer, and it **pins raster scale** — Blink's own comment names *"SVG apps that use large integer
geometries in elements under a very small overall scale"*, which is crbug 40753139, *"Some SVG
rendering heavily pixelated in Chrome 89+"*. **Since we zoom by CSS transform, a permanent
`will-change` would make the score blurry.** Transient only: add on pointerdown, remove on pointerup.

### 7d. ⭐⭐ The overlay, justified from the engine rather than asserted

§1's convergence — MuseScore and Inkscape both refusing to touch the document during a gesture —
turns out to have a *browser-level* proof:

> Each `<svg>` is a relayout root (§7a), and a clean document early-outs of style **and** layout
> (§7a). So if the gesture never writes to the score `<svg>`, it is never dirty, and a `getBBox()` on
> the overlay flushes only the overlay.

That makes the per-frame cost **O(dragged object)** by construction, not by tuning. ⭐ It is also the
only technique here that behaves identically in all three engines — unlike §7c, where they disagree
completely. Gecko rewards it independently: its blob-image cache unit is one `<svg>` element.
⭐ And per §7b the overlay itself should be moved by a transform on the **outer `<svg>`** or an HTML
wrapper, which is exempt from the full-layout rule.

⚠️ Pitfalls, and one is ours already: coordinate space (reproduce the composed CTM — capture
`getScreenCTM()` once at pointerdown); `pointer-events: none` or the overlay eats the moves driving
it; `setPointerCapture`; and **a single teardown path**, because
[[reference_a_drag_must_end_on_a_release_it_cannot_see]] gets *worse* here — an aborted gesture now
leaves a visible ghost **and** a hidden original.

### 7e. ⛔ Containment does not apply inside an `<svg>` — spec, three engines, and WPT

`[spec]` CSS Containment 2: *"in the case of [SVG2], the `contain` property only applies to `svg`
elements that have an associated CSS layout box."* Blink's `IsEligibleForPaintOrLayoutContainment`
returns true only on `LayoutBox` (a `<g>` is not one); Gecko adds `SupportsContainLayoutAndPaint`
back only to `SVGOuterSVGFrame`; WebKit filters on `display`.

`[measured]` WPT `content-visibility-on-g.html`: **Chrome FAILS**, Firefox and Safari pass — and
Blink's own `TestExpectations` carries the bug. ⛔ Do not build on it.

⭐ What *is* measured to help: `content-visibility: auto` on a **wrapper box** per `<svg>` —
**−17% Chromium, −11% Firefox** on initial render of ~19k nodes. Since we already have pages, giving
each page its own `<svg>` would stack with §7a's relayout islands. ⚠️ But WebKit's `getBBox` passes
`TreatContentVisibilityAutoAsVisible`, so **containment and measurement passes fight each other**.

### 7f. 🚨 `<use>` is the wrong tool for repeated glyphs

`SVGUseElement::CreateInstanceTree` **clones the whole target subtree into a shadow root** —
`CloneOption::kIncludeDescendants`. Node count is not reduced, it is duplicated plus shadow-tree
machinery. It is on the layout-forcing list, it disqualifies composited animation, and it was the
cause of the 250× Firefox regression above. ⛔ It saves authored bytes, not style/layout/hit-test
cost.

### 7g. Node count — we are not near the wall

`[measured]` *Journal of Imaging*, Jan 2026, eight rendering approaches at 10–10,000 objects: DOM
approaches (including SVG) *"remain stable at 100 objects but exhibit notable degradation by 500"*,
with fragmentation at 5,000+. ⚠️ The authors call it *"intentionally a stress-test workload"* — worst
case, not typical UI. Our score is ~4,500 nodes and renders in ~163 ms.

⭐ **So the problem is not DOM size — it is our per-frame JS and forced layout**, which is exactly
what our own census says. ⛔ Moving to `<canvas>` on node-count grounds is not justified. A *hybrid*
(rasterise static systems, keep the interactive layer live) is the version worth revisiting, and
tldraw measured 25× doing it for overlays (§4a) — but only after the cheaper items.

### 7h. Input — plain `pointermove`, and ⛔ none of the ink APIs

Chrome has aligned `pointermove` to rAF since **Chrome 60** — dispatched immediately before the rAF
callbacks. ⚠️ There is a known bug where it *behaves differently with DevTools open*, so **part of the
measured per-frame cost may be a DevTools artefact — re-measure with the console closed.**

⛔ `getCoalescedEvents()`, `pointerrawupdate` and `getPredictedEvents()` are all **ink** features and
all three make an expensive drag worse: we want the *last* event, not every sample. MDN warns
explicitly about `pointerrawupdate`, and Safari does not support it at all.

⭐ The correct pattern is last-event-wins rAF coalescing, and rAF runs *before* this frame's
style+layout and *after* the last one's — so **one rAF callback structured read-all → compute →
write-all is already a clean-document read**, with no `requestPostAnimationFrame` polyfill needed.

### 7i. ⭐⭐ The instrument we do not yet have

`PerformanceScriptTiming` (Long Animation Frames) exposes **`forcedStyleAndLayoutDuration`** *per
script* alongside `sourceFunctionName`, `sourceURL` and `sourceCharPosition`:

```js
new PerformanceObserver(list => {
  for (const frame of list.getEntries())
    for (const s of frame.scripts)
      if (s.forcedStyleAndLayoutDuration > 0)
        console.log(s.sourceFunctionName, s.forcedStyleAndLayoutDuration)
}).observe({ type: 'long-animation-frame', buffered: true })
```

⭐ It attributes forced-layout milliseconds **by function name**, which drops straight into
`src/dev/renderCensus.ts` and `e2e/harness.ts` and would turn "is it the flush or the JS?" into a
regression test rather than a one-off profile. ⚠️ Experimental, Chromium-only, not Baseline.

⭐ In DevTools: the Performance panel's **Forced reflow** insight (flagged above 30 ms), the
red/purple triangle on synchronous `Layout` entries, and the **"First Invalidated"** section naming
the JS stack. The `Layout` trace event records its `layout_roots` — ⭐⭐ **that is how we would VERIFY
an overlay actually isolates**: the roots must name the overlay `<svg>`, never `LayoutView`.

### 7j. UNKNOWN

- ⭐⭐ **Whether our residual is dominated by forced reflow or by the 128 hashes and nine passes.**
  Both this section and our own §12.7 bracketing say the same thing: ⛔ *do not choose a fix before
  that number exists.*
- Whether Gecko's `<g>`-transform change recurses the whole subtree
  (`SVGUtils::NotifyChildrenOfSVGChange` does; whether the mapped-attribute path reaches it is
  unverified). **Our `<g>`-move optimisation may not transfer to Firefox.**
- Any measured layer-count tipping point or per-layer memory figure, from any vendor — none
  published. ⚠️ The familiar "don't create too many layers" advice is unquantified, predates
  CompositeAfterPaint, and does not mention SVG.
- Published performance notes from Verovio, OpenSheetMusicDisplay, Flat.io, Soundslice or Noteflight:
  **none found.**
