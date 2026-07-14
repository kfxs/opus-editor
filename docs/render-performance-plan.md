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
| — | `runBatch`'s double-stringify | **done** — `a114cd3` |
| P5.1 | Split the Stave BUILD from the DRAW | **done** |
| P5.2 | Measures as addressable `<g>`s | **done** |
| P5.3 | Two-tier geometry — tier 1 without drawing | **done** |
| P5.4 | Incremental redraw: only changed bars re-engrave | **done** |
| P5.4b | A bar that only MOVED is translated, not re-engraved | **done** |
| P6 | Virtualization, both axes, zoom-aware | **not started** |
| — | Copy-on-write measures | **not started** — probable end-state |

**What is finished: the render count, the layout term, AND the draw — for everything except a
whole-score reflow.**

- Selection, arrow-key navigation, panning, hover ghosts, mouse-leave and drag-releases produce
  **zero renders** (P3/P4). Before, 82% of the renders in an ordinary session changed no content.
- Layout is **under 2 ms per render** at ordinary sizes (was 50–80 ms), and **10.5 s → 101 ms** at
  500 bars × 25 staves (P1/P2).
- A render now re-engraves **only the bars whose picture actually changed** (P5.4), and a bar that
  merely *moved* is **translated, not redrawn** (P5.4b).

Measured in Chrome at 200 bars, before P5 → after:

| gesture | before | after | bars re-engraved |
|---|---:|---:|---:|
| **slur curve drag** (§7's loudest case) | ~104 ms/frame | **2.6 ms** | **0%** |
| **staff-spacing drag** | 87.5 ms/frame | **14.6 ms** | **5.8%** |
| note entry, accidental, stem flip, dynamic… | 80–170 ms | **4–8 ms** | ~0.3% |

**What is left: the whole-score reflow.** Three causes still redraw most of the score, and *all
three are correct to do so* — nothing about them is waste:

| cause | cost | why it is not a bug |
|---|---:|---|
| clef change | 196 ms, 100% | an alto clef at bar 2 changes the governing clef of **every later bar**; they really do all draw differently |
| view-mode switch, add staff | 134–188 ms | the entire casting-off changes |
| paste | 196 ms, 93% | widening 16 bars **re-wraps** the score, so bars move between systems and their **justified width** changes — a genuinely different picture (§7a) |

Those cannot be made cheaper by *reuse*. They get cheaper only by **drawing fewer bars** — which is
P6. There is no low-hanging fruit left in P5.

### Where the plan was wrong

Worth stating, because each was confidently argued in an earlier draft:

1. **"jsdom's draw is pessimistic, so layout is a larger share than it looks."** No. In Chrome the
   split was ~28% layout / 72% draw — almost exactly what jsdom reported. Only the absolute numbers
   shrank. The draw was always the bigger half, which is why P1+P2 (a 175× win on layout) still
   left a 120 ms render.
2. **"Expect P4 to jump ahead of P3, since hover fires continuously and selection fires per
   click."** No. The census found hover at 10 renders and selection-shaped causes at 34 of 51. P3
   was the bigger fish, and P3 came first.
3. **"The transform-only case is a nice-to-have; identity-reuse gets the wins."** ⚠️ **The most
   costly of the three.** P5.4 shipped with `x`/`y` in the redraw key, so a bar that had merely
   *slid* was treated as a bar that had *changed*. The census then showed a staff-spacing drag
   re-engraving **66% of the score per frame** and consuming **53% of all render time in an ordinary
   session** — to change nothing but a y-offset. Every other remaining cost in that census was the
   same bug wearing a different hat (paste, delete, duration change: all downstream bars *shifted*,
   none *changed*). P5.4b was not a polish pass; it was most of the win. **Measure before deciding
   what is a nice-to-have.**

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
| 3 | **Draw + registry population** | the casting-off + content | O(N) DOM, ~35 nodes/bar/staff | split in two — geometry without drawing (tier 1), and a per-measure draw that runs **only for bars whose picture changed** (P5) |
| 4 | **Highlight paint** | the *selection*, nothing else | ran the whole pipeline above | its own path (P3) |

The whole plan was one sentence: **give each of these its own trigger.** Nothing required a new
field on the model. Design Principle 3 already blessed the direction — *"layout results (positions,
breaks, spacing) are derived/cached views over content."* We had simply never cached them.

All four now have their own trigger. What is left is not a *derivation* that is too slow — it is
drawing bars nobody is looking at (§8).

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

## 7. P5 — Two tiers of geometry; measures as addressable groups ✅

**The largest phase, and the one that took the draw apart.** It stands on a codebase where the layout
was already cheap — which was the whole point of doing P1–P4 first.

The blocker `linear-view-plan.md` named was real: `ElementRegistry` — the authoritative hit-test map —
was populated **as a side effect of drawing**, so culling a measure erased its geometry and broke
selection, scroll-into-view and playback-follow for anything off-screen. It is now split:

- **Tier 1 — every measure.** The measure's box, its five staff-line Y positions, its note start/end
  X, and the hit-boxes for the staff, opening clef, meter and barline. Built from a `Stave` that is
  **never drawn**, so it is correct for a measure nobody paints.
- **Tier 2 — drawn measures only.** Noteheads, accidentals, beams, tuplets, dynamics, and the inline
  clef segments — everything whose position only exists once the voice is *formatted and drawn*, each
  measure inside its own addressable `<g id="vf-m7-s2">`.

The rule the split runs on, and the one that settled every judgement call:

> **Tier 1 is what a measure you cannot see must still know. Tier 2 is what only a measure you can
> see needs.**

That is what put `clefSegments` in tier 2 — they answer "which clef governs this *pixel*?", and
pixels only exist where you can look. A culled measure is never under the mouse.

**The whole design rests on one property of VexFlow, not of our code:** a `Stave`'s geometry
(`getNoteStartX`, `getYForLine`, `getBoundingBox`) is valid **without ever calling `draw()`**. It is
true, and it is asserted in `staveGeometry.test.ts` rather than assumed — because if a VexFlow upgrade
ever broke it, culling would return stale boxes and hit-testing would fail *silently, only
off-screen*, which is about the worst failure shape available.

### 7.0 What each step did

| step | what | proof |
|---|---|---|
| **P5.1** | `buildStave` (construct, no context) split from `drawStave`. Tier-1 geometry recorded *before* the draw, so its independence is structural rather than merely true. | `staveGeometry.test.ts` |
| **P5.2** | Every (measure, staff) draws into its own `<g>`, via VexFlow's own `openGroup`. Keyed by **staff too** — P6 must cull vertically, so a bar of the piccolo must be droppable without the same bar of the cellos. | `measureGroups.test.ts` |
| **P5.3** | Tier 1 runs for the whole score without drawing; which measures tier 2 paints is a **parameter** (§7's `draw(measures, surface)`), not an assumption. | `tier1Geometry.test.ts` — renders with **every measure culled** and asserts the tier-1 registry is byte-identical to a full render |
| **P5.4** | Per-measure **shape key**; a bar whose key is unchanged keeps its `<g>` and its registry entries. | `incrementalRedraw.test.ts` |
| **P5.4b** | A bar whose key is unchanged but whose **position** moved is **translated**, not re-engraved. | ditto — including a *shifted* render compared to a fresh one **field for field** |

Reuse needed no test-only API to observe: **a reused measure is the same DOM node; a redrawn one is a
new node.**

### 7a. Two keys, and they are not the same key

The single easiest way to build P5 wrong is to reuse P2's width fingerprint as the "is this group
still good?" test. It is the wrong key, in both directions.

**The move-vs-redraw invariant:**

> A measure group can be moved by **transform alone** only if its **justified width** is unchanged.
> Otherwise it must be **redrawn**.

Payoff 2 above states this too loosely, and the loose version would ship a wrong picture. It is
exactly true in **linear** view (no justification — a bar's drawn shape is independent of its
neighbours, so a shift really is a transform). In **wrapped** view, justification stretches every bar
on a line to fill the width, so a bar's internal note positions depend on *how many bars share its
line*. Concretely:

| edit | what redraws |
|---|---|
| note added to bar 7, no re-wrap | **the one system bar 7 is on** — its bars re-share the stretch. Everything below is untouched: not even a transform, since nothing moved. |
| a line break inserted (§10c) | the two lines either side of it; every line below gets a new Y **transform** and is never redrawn |
| a global casting-off change (bars-per-system, container resize) | in principle everything — see §8 |

That first row is the common case, and it is the prize: **an ordinary edit redraws one system.**

**The SHAPE key is a superset of the width key.** P2's key is deliberately *narrow* — only content
that takes horizontal space (§4b even excludes dynamics). The shape key must be *wide* — everything
that paints — and it must contain **no position at all**:

```
shapeKey(measure, staff) = widthKey                       // P2's fingerprint
                         + justifiedWidth                 // the stretch its line gives it — NOT x, NOT y
                         + linePosition                   // first-in-line clef? cautionary end clef?
                         + every engravingOverride anchored in it   // §10c
                         + dynamics, and anything else drawn but weightless
```

Both halves of that are load-bearing, and each was got wrong once:

- **Too narrow** (reuse P2's width key): a dynamic added, or a rest hidden, changes no width — the
  memo says *clean*, the group is reused, and the `mf` **never appears**. The picture silently rots
  while every test about widths stays green.
- **Too wide** (leave `x`/`y` in): a bar that merely *slid* is treated as a bar that *changed*. This
  shipped in P5.4 and cost **53% of all render time** — see §0's "where the plan was wrong" #3.

### 7b. What P5.4b had to get right to make a translation safe

Three things, all of which produce *silent* wrongness rather than a crash:

1. **Every coordinate-bearing field must be offset**, not just `bbox`: `headX`, sampled arc `points`,
   slur `controlPoints` and `slurEndpoints`, `tupletGeometry`, the staff's line Y positions,
   `noteStartX`/`noteEndX`, the measure bounds. Miss one and the **hit-box drifts away from the
   glyph** — clicks land on the wrong thing, only for bars that moved, only by how far they moved.
   Guarded by comparing a *shifted* incremental render to a fresh one **field for field**, so a
   forgotten field goes red rather than shipping.
2. **`systemHeight` comes from the fresh plan, never the snapshot.** A staff-spacing drag changes the
   system's height but not any bar's *shape*, so every bar reuses its group — and a stale height
   would leave `pixelToMeasure`'s vertical band describing the layout as it used to be.
3. **A bar holding a span anchor is redrawn when it moves, never translated.** Ties and slurs live
   outside the measure groups and are redrawn every render from their endpoint notes' `StaveNote`s —
   and a translated bar keeps the `StaveNote`s it was *drawn* with, which still report the old
   coordinates. Rather than teach every span renderer to add an offset (many call sites, one miss is
   a detached slur), the rule is blunt and provably safe. The cost is bounded to the two *endpoint*
   bars: a slur over bars 4–15 redraws 4 and 15; 5–14 still translate.

Offsets are measured from where the group was **painted**, never from where it was last seen, so a bar
dragged across a hundred frames carries one exact transform rather than a hundred compounding ones.

### 7c. The groups must not clip

A ledger line, a beam, a slur, and (§10c) a nudged notehead all legitimately paint **outside** their
measure's box. The addressable `<g>`s position by transform; they must never `clip-path` to their
tier-1 rect. This costs nothing to honour and silently breaks note offsets later.

**The loudest case this was built for was the slur drag** — the top cost in the post-P2 census, 626 ms
across 6 frames at 200 bars, re-engraving the whole score per mousemove to move one Bézier control
point. **It now costs 2.6 ms a frame and re-engraves zero bars.**

### 7d. Two shape constraints, so that §10b stays possible

Both were free to honour and would have been invasive to retrofit:

- **Tier 2 takes the measure set and the target surface as parameters** — `draw(measures, surface)`,
  never an implicit "the visible window of the main canvas". Then culling is
  `draw(visibleMeasures, liveSvg)` and printing is `draw(everyMeasure, offscreenSvg)`: the same code,
  two call sites.
- **Level of detail is a parameter too**, not a global read off the zoom level. Print is always full
  detail, however "zoomed out" the page happens to be.

### 7e. What P5 broke, and what it merely revealed

All four were found by **manual testing in the browser**, none by the suite — and three of them live
in code paths jsdom physically cannot execute (`getBBox` does not exist there). Worth remembering the
next time the unit tests are green and that feels like evidence.

**P5 broke one thing:**

- **The ghost note vanished in entry mode.** `measureLayoutInfo` is *assigned* during a render, so it
  and `measureWidths` are the same object. The old `clear()` ran *before* that assignment; the new
  incremental teardown ran *after* it — and emptied the layout it had just computed. `drawGhostNote`
  bails on an empty layout, so entry mode silently showed no ghost while every test stayed green.
  **The overlays (ghost, ties, slurs, tuplet brackets) draw against the LAST render's layout — they
  are what a partial render can starve without anyone noticing.**

**P5 revealed three that were already committed:**

- **Hiding a rest (Ctrl+Shift+H) did nothing until some other edit forced a redraw** — and was not
  undoable either. `runBatch` (since `a114cd3`) decides whether anything happened by *counting
  `saveUndoState` requests*, while `toggleRestHidden` deliberately made none ("the batch owns the
  snapshot"). A circle: each waited for the other. Since `saveUndoState` is the only caller of
  `markModelDirty()`, the model was flagged clean and the render was skipped. **Rule, now in
  `runBatch`'s docblock: every mutator must call `saveUndoState`, batched or not** — inside a batch it
  is free (it marks dirty and counts, and returns without pushing).
- **Tempo ghosts smeared across the score.** `openGroup('ghost-tempo')` — VexFlow prefixes the class
  with `vf-` — so the real class is `vf-ghost-tempo`, while `clearGhosts()` looked for `.ghost-tempo`.
  It matched nothing, so no tempo ghost was ever taken down. Broken since P4 made ghosts overlays:
  before that, hovering forced a full render that swept the leak away. *The optimization did not cause
  the leak; it stopped hiding it.*
- **`vf-vf-slur`.** Same trap, opposite direction: `SlurRenderer` passed `'vf-slur'` to `openGroup`,
  which prefixes again. Latent only because every consumer holds the node reference `openGroup`
  returns — but six comments in the codebase invite `querySelector('.vf-slur')`, which would have
  matched nothing.

**⚠️ VexFlow's `openGroup(cls, id)` prefixes BOTH with `vf-`.** Three bugs from one misunderstanding.

**A latent bug fixed on the way:** `measureBounds` was never cleared, so a deleted measure's bounds
lingered for the life of the renderer — a click in empty space could still resolve to a bar that no
longer existed.

# Remaining

## 8. P6 — Virtualization, on both axes, zoom-aware

**The only phase left, and now the only thing that can help.** After P5 the census has exactly three
expensive causes — a clef change (196 ms, 100% of bars), a view-mode switch or added staff, and a
paste (196 ms, 93%) — and **all three are correct to redraw what they redraw.** An alto clef at bar 2
really does change how every later bar draws. A paste that widens 16 bars really does re-wrap the
score, and a bar that lands on a different system really does get a different justified width, which
really is a different picture (§7a). None of it is waste; none of it can be recovered by *reuse*.

The only remaining lever is to **draw fewer bars**.

Only draw the measure groups whose tier-1 box intersects the viewport, plus overscan. At 40 staves
this must cull **vertically** as well as horizontally — you cannot see 40 staves at once, so do not
draw them.

Everything P6 needs is now in place: tier 1 is complete without drawing (§7, proven by rendering with
every measure culled), tier 2 already takes its measure set as a **parameter** (`setDrawFilter`), and
each measure is individually addressable. ⚠️ But `drawFilter` is **not yet a culling switch** — see
the cross-measure-span bullet below; that is the work P6 actually has to do.

**It is also what bounds the worst case P5 cannot.** A *global* casting-off change — locking N bars
per system, resizing the container — re-wraps the whole document, so by §7a's invariant every bar's
justified width changes and P5's incremental redraw degenerates to a full one. That is not a flaw in
P5; **every engraver re-wraps on a global re-wrap.** The way out is not to redraw less per bar, it is
to draw fewer bars: under P6 the cost becomes a full **tier-1** recompute (cheap arithmetic over the
cached widths) plus a redraw of **only the visible window**. The cost stops scaling with the score and
starts scaling with the screen.

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

## 10b. Printing — the one constraint P6 must respect

There is no print path today (no `window.print`, no `@media print`, no SVG serialization; the only
export is JSON). This note exists so that P6 does not quietly make one hard.

**P5 helps printing.** Addressable measure groups positioned by transform are exactly what a page
surface wants — see §10.

**P6 sets the rule**, and it is one line:

> **Printing must never read the live DOM.** It renders its own full-score pass — every measure,
> unculled, at page geometry — into an offscreen surface.

Under virtualization the on-screen SVG is *deliberately incomplete*: it holds the visible window plus
overscan. Serializing it would print two systems and a lot of nothing.

But note that this is **not a cost P6 imposes** — it is a requirement that already exists and that
culling merely makes non-optional. Print geometry is not screen geometry under any regime: the screen
is `wrapped` at container width, the page is paginated at paper width with vertical justification. You
could never have printed the on-screen SVG. So printing was always going to be a fresh full pass over
the cached widths, which — thanks to P1+P2 — is now the cheap part (101 ms of layout for a Mahler
movement, once, for a job the user waits on anyway).

The §7 constraints are what keep that fresh pass a *reuse* rather than a second renderer.

## 10c. Engraving features, later — where they land

Also not a phase. Several features are on the horizon — a **custom note offset**, a **manual bar
break**, a **custom measure count per system**, and (§10d) a **custom measure width** — and the useful
thing to say now is that **they do not land in the same row of §1's table**, so they do not cost the
same thing and must not be reasoned about as one feature:

| feature | row | cost |
|---|---|---|
| manual bar break | 2 — casting-off | free; two lines redraw (§7a) |
| bars per system | 2 — casting-off | free; a global re-wrap, bounded by §8 |
| custom note offset | 3 — draw | one system redraws; **must not touch the width** |
| custom measure width | 1 — **the width** | still zero formatter calls — **§10d** |
| note-spacing inside a bar | 1 — **the width** | one formatter call, on one bar — §10d |
| ragged-last | 2 — casting-off | free — but it proves §7a's ordering rule — **§10e** |

**Bar break and bars-per-system are casting-off (row 2) — the row that was never the problem.** Both
are *break policies*: "break here because I said so" and "break every N bars", instead of "break when
the width runs out". They consume the cached widths and emit different line assignments. Microseconds.

They are free **by construction, not by luck**: §4a caches the note-space and *not* the total width
precisely so that a measure moving to a new line keeps its cached width and merely pays different
overhead (a full clef when it lands first-in-line, a cautionary clef when it lands last). That was
designed for *automatic* re-wrapping — and a manual break is the same event with a different cause.
The width cache is already correct for both. Their cost is §7a's table: a local break redraws two
lines, a global bars-per-system lock re-wraps everything and is bounded by §8.

**A custom note offset is draw-only (row 3), and the rule that keeps it there:**

> **A cosmetic offset must never feed back into the width.** It moves the glyph within the space
> already allotted to it; it does not re-space the bar.

Otherwise: the offset widens the bar → the score re-wraps → the bar lands somewhere else → the anchor
the offset is measured against has moved. Sibelius and Dorico both keep the nudge cosmetic for exactly
this reason. Kept cosmetic, the offset never enters the width fingerprint — the same reason §4b
already excludes dynamics — and it is **§7a and §7b that make it work**: it must enter the *redraw*
key, and its glyph must be allowed to paint outside the measure box.

**One thing they will want that P5 hands over for free.** Force ten bars onto one system and they may
not fit at their minimum widths. The engraving answer is to **scale the system down**, not to squeeze
below the intrinsic minimum (which is not a thing). A system-level scale factor is one attribute on an
addressable group.

**Where they live in the model.** A bar break and a bars-per-system lock are *authored layout
instructions that must survive save/load* — so by the standing rule (a notational statement that can
change mid-score is never a `Score` field) they are **position-keyed entries in
`score.engravingOverrides`**, alongside the rest-shift and the slur curve shape, and they inherit
auto-reset-on-broken-anchor for free: delete the bar carrying the break and the break goes with it.
Contrast the linear staff-spacing knob, which stayed *out* of the model because it is an ephemeral
view knob, not an authored statement. Both are "layout", and they still go to different places.

## 10d. Custom measure width — the one that touches the width

Sibelius lets you drag a barline to widen or narrow a bar. Of the features on the horizon it is the
**only one that lands in row 1** — the width itself, the expensive row — so it deserves its own note.

**It still costs zero formatter calls.** §4a caches the **note-space**; the total width also carries
*overhead*, computed outside the cache (`sharedOverhead` in `MeasureLayout`). A user's width delta is
overhead-shaped: it is added on top. So the width cache sails straight through a barline drag
untouched.

> **The user's width delta is overhead, not content. It rides on top of the cached note-space; it
> never enters the fingerprint.**

That is also the trap, stated as a rule because getting it backwards is not obviously wrong at the
call site: put the delta in the *fingerprint* and every mousemove mints a new key, so every frame
re-runs the formatter over the bar. A drag gesture built on a formatter call per frame is the disease
P2 just cured.

**The sibling feature that goes the other way.** Sibelius *also* lets you drag individual notes
horizontally — note-spacing overrides *inside* a bar. Those genuinely change the note-space; they are
the formatter's own business, so they **must** enter the fingerprint and **will** re-run the formatter
for that bar. That is fine — it is one bar — but it is a different feature with a different cost, and
calling both "custom spacing" would hide exactly the distinction that matters.

**Store a delta, not an absolute width.** `+3.5 staff-spaces`, not `width = 240px`. An absolute width
is fragile: add a note and the intrinsic minimum grows past the stored width, and the glyphs collide.
A delta rides on a recomputed intrinsic, so a content edit and the override compose — and staff-space,
anchor-relative is already the compartment's convention (§10c). Clamp it:

```
finalWidth = max(minWidth, minWidth + delta)
```

which is also what stops the user dragging a barline through the notes. `MeasureWidthInfo` already
carries `minWidth` and `finalWidth` separately, so the distinction the clamp needs is in the code
today.

**Cost per drag frame, given P5.** The cache is untouched, casting-off is microseconds, so the frame
is pure draw — and by §7a only the bar's own system redraws. **One system per frame.** Without P5 it
is the slur drag all over again: a full re-engrave per mousemove (§7's 626 ms census entry). This
feature is a *reason for* P5, not a thing P5 endangers.

**Two open decisions, deliberately not settled here** — they are engraving taste, not performance:

1. **Where the delta applies relative to justification.** Applied to `minWidth`, justification then
   stretches everything proportionally and the bar does *not* end up at the width you dragged it to.
   Applied *after* justification, the bar gets exactly the dragged width and the rest of the system
   absorbs the difference — which is what Sibelius does. P5 is indifferent (either way the system
   redraws); the *feel* is completely different.
2. **Keying.** A measure's width is shared by every staff — one barline down the system — so the
   override keys by **measure**, not by (measure, staff), mirroring `sharedOverhead`. If the shared
   measures spine ever dissolves (the polymeter vision), the key follows the barline.

## 10e. Ragged-last — and the ordering rule it exposes

**A live bug, not a hypothetical.** `calculateMeasureWidths`'s "finalize last line" branch calls
`distributeLineWidths(currentLineMeasures, availableWidth)` — the same justification every other line
gets. So a **one-measure score** is one line, which is the last line, which is stretched edge to edge
across the container. Every short final system in a longer piece is disfigured the same way.

The convention, separating the settled part from the taste part:

- **LilyPond** names it: `ragged-last` / `ragged-right`, and a score of a **single system is
  ragged-right by default** — precisely so a short example is not stretched across the page.
- **Sibelius** makes it a threshold: *justify the last system when it is at least N% full*, so a
  nearly-complete final system still justifies and a stub does not.

The **rule** (do not stretch a short final system) is settled. The **threshold** is taste, and is the
author's to pick — not a number to invent.

**Cost: row 2, casting-off. Free.** A justification policy over the same cached widths; §4a's
note-space does not care whether anyone stretches it afterwards. The unjustified machinery already
exists — linear view simply never calls `distributeLineWidths`. The fix is to not call it for the last
line, behind a fill-ratio test. *Not done — deliberately parked; it wants a threshold and a human
looking at it, and it is an engraving change, not a perf one.*

**What it teaches P5**, which is why it is in this doc at all. The last system's justification depends
on **how full it is** — a *global* property, decided by where the final break landed, which depends on
every bar before it. So:

> Type a note into bar 3 → the re-wrap pushes one bar down onto the last system → its fill crosses the
> threshold → it flips from ragged to justified → **every bar on the last system changes its drawn
> width, with no change to its content at all.**

§7a's key already covers this, via `justifiedWidth` — but only under an ordering constraint that is
easy to violate and worth stating outright:

> **The redraw key is computed on the casting-off's *output*, not on the model.** A key derived from
> the model alone cannot see a system re-justify.

"Hash the measure" is the natural thing to reach for, and it is wrong here. This is the cheapest
available proof that **content unchanged ≠ picture unchanged**.

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
