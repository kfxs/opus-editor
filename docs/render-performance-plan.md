# Render performance — the plan, and what it turned into

Companion to `docs/render-performance-findings.md`, which measured what a keystroke costs. This doc
chose the fix, sequenced it, and — now that P0–P4 are built — records what actually happened,
including the places the plan was wrong.

The findings doc asked "at what size does the editor stop being usable?" and answered it for a
**single staff**. The target that actually matters is a **full orchestral score** — Mahler 5,
Turangalîla — at any zoom, scrolled anywhere, with no "edit only these staves" mode to hide behind.
That target moves the problem by two orders of magnitude and changed which fix came first.

---

## 0. Status

| | phase | state |
|---|---|---|
| P0 | Measure: Chrome profile + render census | **done** — findings §P0 |
| P1 | Width per (measure, staff) | **done** — `f607f4b` |
| P2 | Memoize the intrinsic width | **done** — `9de2de2` |
| P3 | Selection must not redraw | **done** — `c62f0f0` |
| P4 | Ghost/caret as an overlay group | **done** — `c62f0f0` |
| — | `runBatch`'s double-stringify (the §7 slice) | **done** — `a114cd3` |
| P5 | Two-tier geometry; measures as addressable groups | **not started** |
| P6 | Virtualization, both axes, zoom-aware | **not started** |
| — | Copy-on-write measures | **not started** — probable end-state |

**What is finished: the render count, and the layout term.**

- Selection, arrow-key navigation, panning, hover ghosts, mouse-leave and drag-releases now
  produce **zero renders**. Before, 82% of the renders in an ordinary editing session changed no
  content at all.
- Layout is **under 2 ms per render** at ordinary sizes (was 50–80 ms), and **10.5 s → 101 ms** at
  500 bars × 25 staves.

**What is left: the draw.** It is now ~100% of what a render costs (~105–170 ms at 200 bars), and
it is what P5 and P6 exist for.

### Where the plan was wrong

Worth stating, because both errors were confidently argued in the original draft:

1. **"jsdom's draw is pessimistic, so layout is a larger share than it looks."** No. In Chrome the
   split was ~28% layout / 72% draw — almost exactly what jsdom reported. Only the absolute numbers
   shrank. The draw was always the bigger half, which is why P1+P2 (a 175× win on layout) still
   leave a 120 ms render.
2. **"Expect P4 to jump ahead of P3, since hover fires continuously and selection fires per
   click."** No. The census found hover at 10 renders and selection-shaped causes at 34 of 51. P3
   was the bigger fish, and P3 came first.

One thing the plan got right and should be kept in mind: **P1 alone is not a speed-up** (−21%). Its
value is that the width is *correct* and that each per-staff width becomes cacheable. All the speed
came from P2 standing on it.

---

## 1. The shape of the problem

`renderScore()` is called from ~116 sites (tests excluded). Every one of them means the same thing —
*make the picture right again* — and every one of them ran the same full pipeline. That pipeline
welded together four derivations with four completely different invalidation keys:

| # | derivation | depends on | then | now |
|---|---|---|---|---|
| 1 | **Intrinsic measure width** | one measure's contents + its clef | VexFlow `Formatter`, ~1.2 ms/bar, not memoized | memoized (P2) |
| 2 | **Casting-off** — line breaks, justification, staff-spacing Y | the widths + container width + view mode | O(N) arithmetic, microseconds | unchanged; never was the problem |
| 3 | **Draw + registry population** | the casting-off + content | O(N) DOM, ~35 nodes/bar/staff | **unchanged — this is what's left** |
| 4 | **Highlight paint** | the *selection*, nothing else | ran the whole pipeline above | its own path (P3) |

The whole plan was one sentence: **give each of these its own trigger.** Nothing required a new
field on the model. Design Principle 3 already blessed the direction — *"layout results (positions,
breaks, spacing) are derived/cached views over content."* We had simply never cached them.

## 2. The real target, in numbers

A Mahler 5 movement is roughly **500 measures at ~25 staves**. Turangalîla is worse. Feeding the
measured constants through:

| | 400 bars, 1 staff | 500 bars × 25 staves |
|---|---:|---:|
| layout, before | 470 ms | **16.5 s** (measured, not extrapolated) |
| layout, after P1+P2 | 2.4 ms | 101 ms |
| SVG nodes | 14,000 | **~440,000** |

The node count is the row that ends the argument. Four hundred thousand SVG nodes is not a slow
keystroke; it is a document the browser cannot hold at all. **At the real target, virtualization is
not an optimization; it is what makes the score representable.**

But it could not come first:

> **Layout is not virtualizable.** To know which bars are on screen you must know where every bar
> is, which is a running sum of every bar's width, which is the formatter over the entire score.
> Culling the *draw* leaves the *layout* term untouched.

So the width cache was never an alternative to virtualization — it is the thing without which
virtualization buys nothing. It came first, and it is now done.

### 2a. Measures are shared across staves

`score.measures[]` is one flat list; each `Measure.slots[]` holds every staff's notes, tagged with
`staffId`. A 25-staff Mahler movement therefore has **500 measures**, each with a fat slot array —
not 12,500 measures. An O(number-of-measures) walk per render stays cheap at orchestral scale. It is
only the *per-measure* work that had to shrink.

---

# Done

## 3. P1 — Width is per **(measure, staff)** ✅ `f607f4b`

**A bug fix that happened to be the performance prerequisite.**

`calculateMinimumMeasureWidth` grouped a measure's slots by **voice** and never filtered by
**staff**. A bar with four notes on each of two staves was handed to the formatter as if it held
eight notes in one lane. That was:

- **wrong** — a measure's width should be the width of its *widest staff*, not of all staves'
  notes interleaved into one imaginary voice. It errs wide, which is why nobody noticed at two
  staves; and
- **why cost scaled with the staff axis** — the formatter was fed N× the notes: 1.0 ms/bar at one
  staff, **33 ms/bar at 25**.

Width is now:

```
minWidth(measure) = max over staves of ( noteSpace(measure, staff) + clefOverhead(measure, staff) )
                    + sharedOverhead(measure)     // TS glyph, barline padding — same for all staves
```

The clef terms sit **inside** the max because a clef is per-staff (staff 1 may change clef where
staff 2 does not); `MeasureLayout` takes the per-staff clef maps the renderer already computed and
hands each staff its own `staffMeasureView` lane. At N=1 the lane *is* the measure, so the filter is
skipped rather than copying four arrays per measure to arrive back at what it was given.

The cautionary end-clef at a line break stays a primary-staff concern (`applyCautionaryClefs`
resolves `measureEndingClef` with no staffId, mirroring the renderer's own note). Left as-is; it is
not this bug.

**Result: 100 bars × 25 staves, 3,291 ms → 2,612 ms (−21%).** Single staff unchanged. Still linear
in staff count, because each staff still gets its own formatter call. That is expected: P1 is not
the speed-up. It is the correctness fix that makes each per-staff width a self-contained thing that
can be memoized.

## 4. P2 — Memoize the intrinsic width ✅ `9de2de2`

### 4a. Cache the note-space, not the total width

`calculateMinimumMeasureWidth` is two things bolted together: the **formatter call** (expensive,
depends on the staff's slots and the clef in effect) and the **overhead** (pure arithmetic on
flags). Only the first is cached.

This dissolves the wrinkle the findings doc worried about: a measure that lands first-in-line pays a
full clef, so its *total* width depends on where the line break falls — but its *note-space* does
not. A measure pushed to a new line keeps its cached intrinsic width and simply pays different
overhead. **The cache is never invalidated by re-wrapping.**

### 4b. Keyed by a content fingerprint, not a dirty flag

The key is the whole `staffMeasureView` lane plus effective clef plus TS: the slots **including**
tie fields and `forceAccidental` (accidental glyphs take width, and `tiedFrom` suppresses one), dots,
voice; the staff's tuplets (they adjust tick values *before* the formatter runs); the staff's
mid-measure clefs. Dynamics are excluded — they don't affect width.

**The memo is sound measure-locally** — verified, not assumed: accidental display state is
measure-scoped (`activeMeasureAlterations` in `NoteBuilder` starts fresh per measure) and
tie-continuation suppression reads `p.tiedFrom` off the slot's own pitch, which is rewritten *in this
measure* if the tie partner changes. An edit next door cannot poison the entry.

A version counter bumped by `ScoreModel` was considered and **rejected**. `ScoreModel` is 3,500 lines
with dozens of write sites, and **one missed bump is a silently wrong picture** — a measure that
renders at a stale width forever. A fingerprint cannot go stale, because it does not care *how* the
measure changed: rebar, paste, undo, meter change, staff-copy all just work. It answers the findings
doc's §6.4 ("does an incremental cache hold under rebar?") **by construction rather than by
discipline.** The browser census confirms it: the only causes that still pay real layout cost are
clef placement, meter change, add-staff and paste — exactly the operations that rewrite many bars.

### 4c. Where the cache lives

A `MeasureWidthCache` owned by `VexFlowRenderer` and passed *into* `calculateMeasureWidths` as a
parameter — not a module singleton (Principle 1: no ambient state; it would break multi-document and
leak between tests), not on `ScoreModel` (Principle 3: no layout in the model). `MeasureLayout` stays
pure over its inputs; tests can pass no cache at all. The map is capped (clear-when-full) because a
fingerprint-keyed map grows monotonically — every edit mints a new key and nothing deletes the old.

### 4d. The bug P2 exposed: clef resolution was cubic

With the formatter cached, 400 bars × 1 staff should have collapsed to ~2 ms. It measured **74 ms**.

`measureEndingClef` inherits its clef by scanning **backwards over every earlier measure**, and each
step of that scan does its own `measures.find`. So resolving one measure's clef is O(N²) — and the
layout *and* the draw loop each did it per measure, per staff. Cubic over the score, with no early
exit on the common case of a score with **no clef changes at all**. It was invisible while the
formatter dominated; with the formatter gone it *was* the cost.

Clef inheritance is a fold, so `resolveStaffClefs` (in `utils/clefUtils`) makes it one: carry the
clef forward, read off each measure's opening and ending clef, O(measures). Tests assert it is
*equivalent* to the per-measure helpers it replaces, including the edge that matters — **a change at
beat 0 IS its measure's opening clef, while a mid-measure change is not** (but is still carried out
of it).

**Result:**

| | uncached | warm cache |
|---|---:|---:|
| 400 bars × 1 staff | 424 ms | **2.4 ms** (175×) |
| 100 bars × 25 staves | 1,879 ms | **20 ms** (93×) |
| 500 bars × 25 staves | 10,465 ms | **101 ms** (104×) |

At the orchestral target the remaining 101 ms **is the fingerprint walk itself** — precisely the
steady state §7 predicted. That is what copy-on-write would take to zero.

## 5. P3 — A selection change must not redraw ✅ `c62f0f0`

The census settled the design question the plan left open (flag vs whole-score fingerprint): the
fingerprint walk costs 63 ms at orchestral scale, so using it as P3's *whole-score* "did anything
change" test would charge 63 ms to every selection click — the exact cost P3 exists to avoid. **The
flag won**, on measurement rather than argument.

`MusicEngine.isRenderStale()` asks two questions, and **the selection is neither**:

1. **Content** — `modelDirty`. Every edit funnels through `commit`/`saveUndoState`, which sets it.
2. **View state** — view mode, the linear staff-spacing knob, a suppressed (being-text-edited)
   dynamic/tempo, a frozen layout, a dragged clef.

Failure mode accepted: a direct write to `scoreModel` bypassing the facade would skip a needed
repaint — but the ARCHITECTURE invariant says that write is already a bug.

**Three leaks had to be fixed.** `previewSlurShape`, `previewSlurEndpoint` and `previewStaffSpacing`
mutate the model during a live drag but defer their undo entry, so they never passed through
`saveUndoState` — the one place that sets the flag. Without flagging them, a slur drag would silently
stop updating.

**The real work was making highlights removable.** They used to reset themselves by being wiped along
with the SVG — the code said so out loud, twice: *"Safe: the next render rebuilds the SVG."* That is
false the moment a render is skipped. Every highlight mutation now goes through a recording helper in
`HighlightController`, and `clearHighlights()` is an exact inverse of all three kinds:

1. **Recolours** — restore the **previous value**, not remove the attribute. Voice 2 renders green by
   default, so a naive `removeAttribute('fill')` would blacken it.
2. **Added nodes** — measure boxes, keyboard cursor, paste caret, slur handles: removed by class.
   The slur handles also *register hit-boxes*, which a skipped render no longer clears — so the
   highlight pass drops its own registry entries (`ElementRegistry.removeByType`).
3. **DOM reordering** — `highlightNote` raises a selected note above a unison neighbour; the original
   sibling position is restored, so a long session doesn't slowly permute the SVG.

## 6. P4 — The ghost is an overlay ✅ `c62f0f0`

The five preview ghosts (note, clef, time-sig, dynamic, tempo) already drew into their own
class-tagged `<g>`. They just insisted on re-engraving the whole score underneath first. They now
draw against the last render's layout (`measureLayoutInfo`, still sitting on the renderer), and
erasing one is `clearGhosts()` — a DOM removal.

That also kills the **"no ghost here" branches** the plan flagged: hovering an invalid element (clef,
TS, barline), leaving the canvas, or pressing Esc used to do a full `renderScore()` whose only
purpose was to *erase* a translucent notehead.

One real bug fixed on the way: the ghost note's elements were only wrapped in their removable group
*when a cursor shift happened to be computed*. Unwrapped, they could never have been taken down —
harmless when every render rebuilt the SVG, fatal for an overlay. They always wrap now.

`PREVIEW_THROTTLE_MS` (50 ms) is **gone**. It existed only to ration the old cost, and capped the
preview at 20 fps.

## 6b. The drop of a live drag ✅ `9de01ac`

Found by the census after P4 (`handleMouseLeave` was still rendering). `commitSlurShape`,
`commitSlurEndpoint` and `commitStaffSpacing` change **no content** — the matching `preview*` already
applied the change *and* rendered it, frame by frame. They exist only to push one undo snapshot on
release. Flagging the model dirty there re-engraved the whole score to paint a picture already on
screen. They now use `commitPreviewed`, which records history without claiming a content change.

`commitClefMove` deliberately still flags dirty: it calls `normalizeClefAt`, which genuinely mutates
(removing a clef the drag made redundant). Making the rule uniform there would have made it wrong.

## 6c. The undo slice ✅ `a114cd3`

`runBatch` answered "did `fn` change anything?" by stringifying the **entire score** before and after
and comparing — two full serializations per batched edit, on top of the deep clone `pushState`
already does. Three walks of the whole document to record one Ctrl-Z.

Unnecessary: every mutation that wants an undo entry calls `saveUndoState`, which fires *even when
suppressed inside a batch* (it must, so the model still gets flagged dirty). The answer was already
there. It now counts requests instead of comparing strings.

Per batched edit: **6.7 ms → 3.5 ms** (400 bars × 1), **190 ms → 95 ms** (500 × 25).

The trade, stated plainly: this is "did anything *ask* to be saved", where the stringify-compare was
"did the content actually differ". They diverge for an operation that saves without changing anything
— that now pushes a no-op undo step, costing one wasted Ctrl-Z rather than a wrong picture.

`pushState`'s deep clone remains. Removing it is §7, not a five-line change.

---

# Remaining

## 7. P5 — Two tiers of geometry; measures as addressable groups

**This is the next phase, and it is the largest.** Everything below stands on a codebase where the
layout is already cheap — which was the whole point of doing P1–P4 first.

The blocker `linear-view-plan.md` names is real: `ElementRegistry` — the authoritative hit-test map —
is populated **as a side effect of drawing**, so culling a measure erases its geometry and breaks
selection, scroll-into-view and playback-follow for anything off-screen. Split it:

- **Tier 1 — every measure.** Measure boxes (x, y, width, line), computed from the cached widths
  without drawing anything. Pure arithmetic over P2's output. *Almost everything that needs offscreen
  geometry needs only this tier.*
- **Tier 2 — drawn measures only.** Element bounding boxes (noteheads, accidentals, handles),
  produced by drawing that measure into its **own addressable `<g>`**, positioned by a transform.

Two payoffs, not one:

1. It is the prerequisite for culling (P6); and
2. it makes **incremental redraw** possible. In linear view, adding a note to bar 7 shifts bars
   8–400 to the right — so a naive "only redraw what changed" degenerates instantly to a full
   redraw. With addressable groups, those unchanged bars get a new `transform` and are **never
   redrawn at all**.

**The loudest case waiting for this is the slur drag.** Post-P2 it is the top cost in the census
(626 ms across 6 frames at 200 bars) and it is now *pure draw*: 200 bars of SVG re-engraved per
mousemove to move one Bézier control point. A cheap partial fix exists — the `frozenLayout` mechanism
already used during clef drags would remove the (now small) layout term — but the real fix is here:
redraw the slur's own group, not the score.

## 8. P6 — Virtualization, on both axes, zoom-aware

Only draw the measure groups whose tier-1 box intersects the viewport, plus overscan. At 40 staves
this must cull **vertically** as well as horizontally — you cannot see 40 staves at once, so do not
draw them.

Four costs to be honest about:

- **Scrolling is free today** (pure CSS scroll; zoom is a CSS transform, no re-render). Under
  virtualization it becomes a redraw. It needs rAF throttling and generous overscan or it will feel
  *worse* than what ships now.
- **Zoom stops being free too, and inverts the cost curve.** Zooming out to 25% to copy a passage
  deliberately puts ~16× more music on screen, and all of it must be drawn. The cheapest moment for
  the renderer (note entry at 100%, two systems visible) is the one where you need it least. The
  known way out is **level-of-detail** — draw fewer glyphs per bar when zoomed far out, since an
  articulation dot is invisible at 25% anyway. Do not design it in now; just do not design it *out*.
- **Cross-measure spans.** Ties, slurs and beams are drawn in a post-measure pass from
  `staveNoteMap`, which will only exist for *drawn* measures. A slur spanning bars 3–9 with only 5–7
  on screen must still draw, clipped — so spans must be selected by **intersection with the window**,
  not by whether their anchors happen to be drawn.
- **Geometry consumers that read the renderer.** `syncCoordinateMapperBounds` feeds
  `CoordinateMapper` from `getAllMeasureBounds()` after every render. Under culling, bounds for
  undrawn measures must come from **tier 1**, not from the drawn set — otherwise pixel↔position
  breaks off-screen exactly the way the registry would have.

## 9. Copy-on-write measures — the probable end-state

Not a phase, but no longer an "escape hatch" either. **Measured, not predicted:** after P2 the
steady-state layout cost at 500×25 is 101 ms, and that *is* the fingerprint walk. It sits last
because it is invasive, not because it is improbable.

Today `ScoreModel` mutates measures in place (`measure.slots.push(...)`) and `getScore()` hands out
the live reference. If a write instead **replaced** the measure it touched, leaving the others'
identities intact, then:

- the width cache becomes a `WeakMap` keyed on the measure object. Invalidation is free, and it
  **cannot go stale** — unlike a version counter, there is no bump to forget;
- an edit touches one measure, so exactly one cache entry is recomputed and the other 499 cost
  nothing at all.

And it pays a **second, unrelated debt on the same refactor.** `UndoRedoManager.pushState` still does
`JSON.parse(JSON.stringify(score))` on every edit — 95 ms per edit on a Mahler movement, and now the
largest remaining non-draw cost. Copy-on-write makes an undo snapshot a shallow structural share
instead of a deep clone.

It is invasive (3,500 lines, dozens of write sites), which is why it is here and not in §4. But it is
the *correct* long-term shape.

## 10. Pages, later — this plan doesn't block them

Not a phase; a compatibility note. There is no page system today, and `layoutConfig.ts` already
decided what one would be: **a property of `wrapped` — a casting-off — not a third view mode.**
Nothing here fights that:

- **P2 is indifferent to pagination by construction.** §4a caches the *note-space* width precisely
  because it doesn't depend on where breaks fall; pages are just one more break policy consuming the
  same cached widths. Vertical justification (spreading systems down a page) is more casting-off
  arithmetic — microseconds, never cached, never invalidating anything.
- **Page dimensions join P3's view-state key** (they change how content is shown, not what it is —
  Principle 3 keeps them out of the model exactly as it keeps the staff-spacing knob out).
- **P5's addressable groups are how pages get cheap.** A measure group positioned by transform can be
  assigned to any page surface without redrawing; P6's culling generalizes to "draw the visible
  pages" — which is what the big engraving apps do.

---

## 11. The instrument

`src/dev/renderCensus.ts` + `window.__census` / `window.__perf` (dev builds only) and
`perf/p0.test.ts` (skipped unless `PERF=1`) are **temporary**, built for P0. They are what told us
P4 should not jump the queue and what caught the drag-drop re-render, and they are what will tell you
whether P5 worked. **Keep them until P5/P6 land, then delete them.**

```
__perf.load(200)     // synthetic 200-bar score (destructive)
__census.enable()    // record every render, tagged by cause (recovered from the call stack)
__census.dump()      // renders per cause + the layout:draw split
```
