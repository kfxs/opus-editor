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
| P6 | Virtualization, both axes, zoom-aware | **done** — §8 |
| — | Copy-on-write measures | **not started** — probable end-state, and now the largest cost left |
| **P7** | **The keystroke tax of a GESTURE** — §12 | **not started**, 2026-08-21. ⚠️ P1–P6 measured a RENDER; a walking mark is 20–60 presses, each a full edit-render-snapshot. 🚨 §12.2 is a **quadratic** id lookup that is invisible at demo size and fatal at orchestral size |

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

**The whole-score reflow was what P5 could not fix.** Three causes redrew most of the score, and *all
three were correct to do so* — nothing about them is waste:

| cause | cost after P5 | why it is not a bug |
|---|---:|---|
| clef change | 196 ms, 100% | an alto clef at bar 2 changes the governing clef of **every later bar**; they really do all draw differently |
| view-mode switch, add staff | 134–188 ms | the entire casting-off changes |
| paste | 196 ms, 93% | widening 16 bars **re-wraps** the score, so bars move between systems and their **justified width** changes — a genuinely different picture (§7a) |

None of it could be made cheaper by *reuse*. It gets cheaper only by **drawing fewer bars** — which is
P6, and P6 is now built (§8). "100% of bars" is still 100% of the bars that are *on screen*; what
changed is that the score behind them is no longer one of them. The cost stopped scaling with the
score and started scaling with the screen.

**What is left is no longer a render cost at all.** `UndoRedoManager.pushState` still deep-clones the
whole score on every edit (§9) — 95 ms per edit at 500×25, on the *hot* path, where a clef change is
a once-in-a-while thing. That is now the biggest number in this document.

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

## 8. P6 — Virtualization, on both axes, zoom-aware — **BUILT**

After P5 the census had exactly three expensive causes — a clef change (196 ms, 100% of bars), a
view-mode switch or added staff, and a paste (196 ms, 93%) — and **all three were correct to redraw
what they redrew.** An alto clef at bar 2 really does change how every later bar draws. A paste that
widens 16 bars really does re-wrap the score, and a bar that lands on a different system really does
get a different justified width, which really is a different picture (§7a). None of it was waste;
none of it could be recovered by *reuse*.

So the only remaining lever was to **draw fewer bars**, and that is what P6 does: tier 2 paints only
the measure groups whose tier-1 box intersects the viewport, plus overscan — **on both axes**, since
at 40 staves you cannot see them all and must not draw them.

### 8.1 What it turned out to be

Very little new machinery, because P5 had already done the hard part: tier 1 was complete without
drawing, tier 2 already took its measure set as a parameter, and each measure was individually
addressable. The window replaced the parameter, and four things had to be true around it.

| piece | where |
|---|---|
| **The window.** `ViewportModel.getVisibleRect()` — the one place screen px are divided back into layout px by `zoom`. | `ViewportModel.ts` |
| **The overscan.** `MusicEngine.setVisibleRect()` draws a window *larger* than the viewport and only re-cuts it when the viewport escapes what was already drawn. It **returns whether a render is owed** — and for almost every scroll event the answer is *no*. | `MusicEngine.ts` |
| **The cull.** `VexFlowRenderer.setCullWindow()` + `inCullWindow()`. Gates the draw, the reuse, and the system connectors. | `VexFlowRenderer.ts` |
| **The trigger.** The cull window joins `viewStateKey()`, so `isRenderStale()` answers *yes* when the window moves — scrolling changes no content, and without this the bars newly scrolled into view would never be painted. | `VexFlowRenderer.viewStateKey` |

Culling is a **removal**, not a skipped repaint: a bar that leaves the window is excluded from the
reuse set, which is exactly what makes `clearForRender` take its `<g>` back out of the DOM. Leaving
it standing would be worse than useless — it would still be there, stale, when the score changed
underneath it.

### 8.2 The four costs, and what each actually cost

The plan called these out in advance. Three were paid; one was not, and is still owed.

- **Scrolling was free (pure CSS scroll) and must stay free.** It does — because the overscan is the
  thing that is drawn, and a scroll inside it owes nothing. `setVisibleRect` returning `false` *is*
  that promise, and it is pinned by a test. At `CULL_OVERSCAN = 0.5` you scroll half a screen before
  paying anything, and what you then pay is bounded: crossing the boundary advances the window by
  half a viewport, so the strip actually engraved is half a screen of music, never a score. rAF
  throttling turned out to be unnecessary — the *render* is already gated on the boundary crossing,
  which is a far coarser filter than a frame.
- **Cross-measure spans.** Ties and slurs are drawn in a post-measure pass that asks `staveNoteMap`
  where their endpoint notes are, and only a *drawn* measure populates it. A slur over bars 3–9 with
  only 5–7 on screen would have found neither end and vanished. The fix makes "select by intersection
  with the window" true *by implication* rather than by rewriting every span renderer against tier-1
  geometry:

  > **A span that intersects the window forces its two anchor bars to be drawn**, wherever they are.

  They may land far off-screen; that is harmless (the SVG is scrolled, not clipped). The cost is two
  bars per *crossing* span — a tie into the next bar is inside the overscan and pays nothing.
- **Geometry consumers that read the renderer.** Tier 1 still runs over **every measure in the
  score**, drawn or not, so `getAllMeasureBounds()` still feeds `CoordinateMapper` a complete map and
  pixel↔position keeps working off-screen. The one place that *did* break was
  `scrollSelectedNoteIntoView`, which resolved the selected note's **bbox** — tier-2 geometry, absent
  for a note that has not been drawn. And that is precisely the case where scrolling to it matters:
  the selection jumps somewhere distant, the bbox is missing, and the viewport would simply not move.
  `MusicEngine.getScrollRectForNote` now falls back to the note's **measure** box (tier 1, always
  known). Bar-accurate rather than notehead-accurate for one frame; the alternative was not scrolling
  at all.
- **⚠️ Zoom stops being free too, and inverts the cost curve — STILL OWED.** Zooming out to 25%
  deliberately puts ~16× more music on screen, and all of it is now drawn. The cheapest moment for
  the renderer (note entry at 100%, two systems visible) is the one where you need it least. The
  known way out is **level-of-detail** — draw fewer glyphs per bar when zoomed far out, since an
  articulation dot is invisible at 25% anyway. P6 did not design it out (the window is already
  zoom-aware; `getVisibleRect` divides by zoom, so a 25% window *is* four times as wide), but it did
  not build it. **If anything about this feels slow, this is where to look first.** (Zoom does not
  get its own census row — it moves the visible rect, so it is counted under `onViewChange`.)

### 8.3 What the census said — and the second pass it forced

The first cut of P6 worked, and the census immediately found the cost it had introduced.

Measured in Chrome, 200 bars, an ordinary editing session:

| cause | after P5 | after P6, first cut | bars redrawn |
|---|---:|---:|---:|
| **paste** | 196 ms | **79.7 ms** | 93% → **9.1%** |
| **add staff** | 134–188 ms | **77.3 ms** | → **7%** |
| **`onViewChange`** (scroll + zoom) | *did not exist* | **27 renders, 515 ms — 40% of ALL render time** | 18% |

Culling did what it was for. But the new scroll render cost 19 ms, and **13.3 ms of that was
`calculateMeasureWidths`** — the census times nothing else as "layout". Not the draw. The *widths*,
recomputed on a scroll, where the score had not changed by one note and every width therefore came
back identical.

That is §9's **fingerprint walk**, arriving early. P2 memoizes each measure's intrinsic width, but it
still walks every measure's content to build the key that finds it — the 101 ms measured at 500×25.
Culling had turned a walk that used to happen on edits into one that happened on *scrolls*.

Two things were being re-derived for bars nobody could see and nothing had touched, and **the window
cannot change either of them**:

- **The casting-off.** Cached across renders (`VexFlowRenderer.layoutCache`) and reused when the
  model is unchanged and the *layout-relevant* view state is unchanged. That second half is why
  `viewStateKey` was split: `layoutStateKey` is the same key **minus the cull window**, because the
  window is the one piece of view state that cannot move a barline. Only `MusicEngine` may license
  the reuse (`setLayoutReusable`) — it owns `modelDirty` and is the only thing that knows. The
  default is `false`, which matters: a renderer driven directly, as every test in that directory
  does, has no engine to clear a stale layout.
- **Every culled bar's tier-1 `Stave`.** A bar that was *already* culled last render has an unchanged
  snapshot and no `<g>` at all, so its geometry is replayed instead of rebuilt. The guard is
  `group === null`: it means "culled last time too". A bar only *now* leaving the window still has a
  group standing in the DOM and must fall through to a rebuild — staying out of the reuse set is
  exactly what makes `clearForRender` take that group down.

# Remaining

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

---

## 12. P7 — **THE KEYSTROKE TAX OF A GESTURE**, and the id-lookup cliff (2026-08-21)

His question, during the pedal walk: *"why sometimes is so slow and leggy?"* — and then the reason it
matters: *"I'm worried about performance, and the way we decide to render; if we want to edit
Turangalîla this will be a huge issue."*

Everything in §0–§8 measured a **render**. This section is about what ONE ARROW PRESS costs, which is
a different question with a different answer: a walking gesture is 20–60 presses in a row, each one a
complete edit-render-snapshot cycle. ⚠️ **The accounting below is read off the code, not profiled in
his session** — the numbers that exist are quoted from §9 / the findings doc, and everything else is
marked UNMEASURED. P0's instruments (`__perf.load`, `__census`) are how to close that.

### 12.1 What one press pays for, today

| # | cost | when | size | measured? |
|---|---|---|---|---|
| 1 | **`UndoRedoManager.pushState` deep-clones the whole score** (`JSON.parse(JSON.stringify(score))`) | **every** press — an ink nudge is `saveOnly`, which still snapshots | O(score) | ✅ §9: **95 ms/edit** on a Mahler movement |
| 2 | **`renderScore()`** — fingerprint walk over every (measure, staff), casting-off, then the changed bars redraw | **every** press | O(bars × staves) + O(changed bars) | ✅ §0: layout <2 ms ordinary, **101 ms** at 500×25 |
| 3 | **`playbackEngine.setScore`** on a CROSSING press (`commit`) — stores the reference and re-walks the bars for the total duration | crossings only | O(bars) | ⚠️ UNMEASURED, believed small |
| 4 | **The lane rebuild** — see §12.2 | several times **per press** | **O(drawn × score)** | ⚠️ UNMEASURED |
| 5 | dev `console.log` on the hot path — one line + a `JSON.stringify` per press with DevTools open | every press | small but real | fixed 2026-08-21 (`markBreakWrap.sameSystem` logs only on change). ⚠️ `breakCrossing`'s other declines still build `JSON.stringify` templates eagerly — cheap, same path |
| 6 | **`breakCrossing` added to `dynamicWalk`/`tempoWalk`** (2026-08-21) — those two now run `nextStop`/`anchorX`/`stopX` a second time and two `systemInkAt`s on top of `markWalkCrosses` + `carryMark` | every press | ~2–3× their old per-press cost | ⚠️ UNMEASURED, and a straight regression on gestures that already existed |

⭐ **That table answers his "SOMETIMES".** An ink press pays 1 + 2 + 4; the press that CROSSES pays
1 + 2 + 3 + 4 and opens a `runBatch`. In his logs a crossing lands every 4–24 presses — which is the
rhythm of the hitch he felt.

### 12.2 🚨🚨 The id-lookup cliff — the one that decides Turangalîla

`ScoreModel.getNote(id)` → `slotLookup.findSlot` is a **linear scan of every measure and every slot in
the score**. Nine modules call it once per DRAWN element while building a mark's lane —
`pedalLane`, `ottavaLane`, `hairpinLane`, `dynamicLane`, `trillLane`, `tempoWalk.drawnOnsets`,
`slurEndpointWalk`, `elements/pedalHandles`, `MouseController`:

```
one lane build      = O(drawn notes × all notes)
one arrow press     ≈ 4–6 lane builds   (anchorX, stopX, breakCrossing, markWalkCrosses, carryMark)
```

| score | drawn | notes | slot visits per press |
|---|---:|---:|---:|
| his 64 bars × 2 staves, mostly whole rests | ~40 | ~130 | ~30 k — fine |
| Turangalîla, 25 staves × 500+ bars | ~2 000 | ~50 000 | **~600 000 000** |

It is quadratic in the score and it is **not** what P1–P6 fixed: those made the *render* incremental
and left this untouched, because until the walking gestures arrived nothing called it in a loop.
⚠️ It is invisible at demo size, which is exactly why it is written down here rather than discovered
again at orchestral size.

### 12.3 The fixes, in the order they should be taken

| phase | fix | why it is first / later |
|---|---|---|
| **P7.1** | **An id → slot INDEX on `ScoreModel`** (`Map<string, FoundSlot>`, rebuilt on the writes that add or remove slots), so `getNote` is O(1) | Kills §12.2 outright, touches one module's internals, and every caller in the app gets it. ⛔ The index must be invalidated by the SAME writes that mutate `measure.slots` — an index that can go stale is worse than a scan. |
| **P7.2** | **Memoize the lane for the duration of one press** — the walk asks the same question 4–6 times with nothing changing in between | Cheap and local (`interactions/*Lane`), and it stands even after P7.1. ⚠️ **Correction, 2026-08-21**: the sweep is NOT O(drawn) on its own — `pedalLaneOnsets`/`dynamicLaneHeads` de-duplicate with `onsets.find`/`heads.some` INSIDE the loop, so they are **O(drawn²)** independently of §12.2's id lookup. Both terms have to go. |
| **P7.3** | **An ink nudge must not deep-clone the score.** Either coalesce consecutive nudges of one mark into a single undo entry (they are one gesture), or make the snapshot structural | §9's copy-on-write is the real answer; coalescing is the cheap half and can ship first. A walking gesture currently writes 20–60 undo entries the user thinks of as **one** move. |
| **P7.4** | **A picture-only change should skip the playback resync.** A crossing IS audible for pedal/ottava, so this is per-mark, not blanket | ⚠️ Measure (3) first — it may already be negligible. |
| **P7.6** | **A gesture draws only the thing that is moving** — §12.5, his own proposal | Removes the render term from §12.1 (2) for every walk and drag. ⛔ Not a substitute for P7.1/P7.3, which are paid before any drawing. |
| **P7.5** | Re-check §12.1 (2) for marks that span systems: an offset change on a broken span may invalidate more bars than it should (`MeasureRedrawKey` counts *overrides anchored here*) | UNMEASURED; needs the census on a spanning mark. |

### 12.4 How to measure it (⛔ do this before choosing between P7.3 and P7.4)

⭐ **Step 1 has been run for the DRAG — see §12.6.** The keyboard's own run, and steps 2–3, are still
owed.

1. Open his 64-bar score, `__census.enable()`, arm a pedal square, hold `→` for ~30 presses,
   `__census.dump()` — that gives renders by cause and bars re-engraved per press.
2. Chrome profile the same run. The three shapes to look for are named above; the profile decides
   whether the deep clone or the lane rebuild dominates **at this size**.
3. Repeat at orchestral size (`__perf.load(200)` and the 500×25 fixture from findings §P0.2) — §12.2
   predicts the lane rebuild takes over completely, and that prediction is the thing to falsify.

### 12.5 ⭐⭐ HIS PROPOSAL — a gesture draws only the thing that is moving

*"In the case something is walking: why do we have to render the whole score? Why not have a backup
of the score without the element that is walking and just render that element?"* — 2026-08-21, and
it is the correct shape. It is also **P3/P4's shape one level up**: the selection and the entry ghost
already stopped re-rendering the score by moving onto a layer of their own, and a walking mark is the
same kind of thing — a picture that changes while the music does not.

**The score behind a walking mark does not change.** A pedal's `startX`, an ottava's `endX`, a
dynamic's `x` take no horizontal space: the columns, the barlines, the casting-off and every other
bar's `<g>` are bit-identical from press to press. Today all of that is re-derived 20–60 times per
gesture to move one glyph a quarter of a space.

Two ways to cash it, cheapest first:

- **12.5a — the mark on the OVERLAY for the duration of the gesture** (P4's answer). The score layer
  is drawn ONCE without the moving mark; each press moves a copy of it on the highlight layer, which
  is already re-drawn per frame and costs nothing; the drop renders once, properly, and the overlay
  copy goes. ⭐ No change to the measure groups, and the highlight layer already knows how to draw
  and remove its own nodes. ⚠️ Needs the renderer to be able to draw a score **minus one mark** — a
  suppression the dynamic already has (`setSuppressedDynamicId`, for the text editor), which is the
  proof this is a small change and not a new subsystem.
- **12.5b — a MARK is an addressable group, like a measure** (P5's answer, generalised). Then a press
  re-draws that one `<g>` in place and nothing else, with no overlay and no suppression. Bigger, and
  the honest end-state for drags as well as walks.

⚠️ **Where the approximation shows, and why it is still right.** A mark's position can feed the
below-staff LADDER (`layout/outsideStaffBand`): move a hairpin and a pedal under it may be entitled
to move too. A gesture-time preview that redraws only the mark will not restack the ladder — which is
exactly what a preview is for, and why **the drop must do a full render** (`commitPreviewed`'s
existing rule). ⛔ The one thing it must never do is leave the cheap picture standing as the final
one.

⚠️ **And it does not replace P7.1/P7.3.** The deep clone (§12.1 #1) and the quadratic id lookup
(§12.2) are paid by the WALK itself, before any drawing happens — his *"it is slow on a small score"*
is mostly those two, since at 64 bars the drawing is already culled to the visible systems (§8).
Drawing only the moving mark removes the render term; it does not remove the other two.

### 12.6 ✅ MEASURED — the census of a DRAG, on his own score (2026-08-21)

His report during the pedal drag walk: *"sometimes the movement of the editing freeze… is it possible
to check if is a bug or a performance issue?"* — so §12.4 step 1 was run, on the 64-bar × 2-staff
score he was editing (7 systems), dragging a pedal's `✻` back and forth across several bars and a
system break:

```
__census.enable() → drag → __census.dump()

cause: MouseController.handlePedalEndDrag
198 renders · 1897 ms total · avg 9.6 ms · worst 31.1 ms
layout 1.8 ms avg  ·  measures redrawn 0%  ·  draw 7.8 ms avg
layout breakdown: format (VexFlow Formatter) 157 ms = 44%, laneView 20 ms = 6%
width cache: 0 hits / 0 misses
```

**⭐ The verdict: a PERFORMANCE cost, ⛔ not a stuck gesture.** Every one of the 198 frames wrote and
repainted — none was a refused frame spinning — so the walk itself is healthy. One full render per
mouse frame at ~10 ms leaves a third of a 16.7 ms frame budget, and the 31 ms worst case blows through
it; because the handler renders synchronously inside `mousemove`, the queued moves pile up behind the
slow frames, which is what "freeze" feels like.

**🚨 The number that decides P7.6: `measures redrawn 0%`, and `draw` still 7.8 ms.** P5's
copy-on-write is doing its job — no measure group is being rebuilt, the formatter is only ~0.8 ms per
render — and yet nearly 8 ms per frame goes on drawing everything that is NOT a measure: the marks,
the below-staff ladder, the curves, the highlight layer and the overlay, all repainted to move two
glyphs a few pixels. ⭐ That is exactly the term §12.5 removes, and it is now measured rather than
predicted. ⚠️ The layout term (1.8 ms) is NOT where a drag's money goes at this size — ⛔ so P7.1/P7.2
are not the fix for *this* symptom, however right they are for orchestral size.

⚠️ **Two costs the census cannot see**, both real with DevTools open: the four or five `dbg` lines per
frame (§12.1 #5 — `breakCrossing`'s declines log once per frame during a drag, where the keyboard's
log once per press), and the mouse-event queue itself.

**Where to take it, cheapest first** — recorded here because the pedal work carried on elsewhere:

1. **Quiet the per-frame logs.** Keep the walk/wrap events (they are how these bugs get found); drop
   or rate-limit `breakCrossing`'s per-frame decline line.
2. **Coalesce a drag's renders to one per animation frame.** The model still writes per event; the
   picture paints once. Small, certain, and it caps the worst case at one render per frame.
3. **P7.6 / §12.5 — draw only the mark that is moving.** The real fix for the 7.8 ms, and the census
   above is the evidence for choosing 12.5a (overlay for the gesture) over anything cleverer.

### 12.7 ✅ THE ELEVEN-GESTURE CENSUS — and 🚨🚨 three bugs in the instrument itself (2026-08-22)

He ran the census twice over a long editing session on the same 64-bar × 2-staff score (7 systems,
one bar carrying a hairpin + pedal + ottava + dynamic + tempo + trill at once). ⭐ This is §12.4
step 1 for the KEYBOARD as well as the mouse, which §12.6 still owed.

```
RUN 1 — mark gestures.  818 renders · 9194 ms · avg 11.2 ms · worst 28.5 ms
  layout 1573 ms = 17% of the session (≈1.9 ms/render)
  redrawn %: 0.8 · 0.8 · 0 · 0 · 1.7 · 0 · 0 · 0 · 0 · 0 · 0      ← every row
  draw ms:  9.8 · 10.0 · 8.1 · 8.4 · 11.5 · 8.7 · 9.8 · 8.1 · 8.6 · 8.9 · 10.1

RUN 2 — the WIDTH gestures.  189 renders · 3190 ms
  handleBarWidthDrag   84 · avg 20.6 · worst 42.9 · redrawn 12.8% · draw 18.5
  dragNoteSpacing      21 · avg 23.2 · worst 47.3 · redrawn 13%   · draw 21.1
  handleTrillEndDrag   65 · avg 11.8 · worst 25.3 · redrawn 0%    · draw 10.0
  handleTrillBodyDrag  19 · avg 10.8 · worst 15.6 · redrawn 0%    · draw  8.8
```

**⭐⭐ TWO REGIMES, and only one of them is what §12.5 describes.**

- **A — a mark moves (0% redrawn).** A flat **~9 ms floor that barely varies with what is dragged**
  (slur endpoint 8.1 … tempo 11.5, eleven causes). §12.6 measured this for the pedal alone; it is now
  general, and the flatness is the finding: **the cost does not depend on the edit**. Everything in it
  runs unconditionally over the whole score — `layoutTier1` (128 placements), `measureShapeKey`
  (128 `JSON.stringify`s), `planCrossBarBeams` **twice**, `spanAnchors`, ~128 `replaySnapshot`s, the
  eleven outside-staff passes, `hintBarlines(true)`, a connector per system.
- **B — a WIDTH changes (13% redrawn).** ~20 ms, worst **47 ms — three display frames**, because the
  whole score re-casts-off *per mouse frame*: his log shows bars 5–64 changing system back and forth
  on nearly every frame of one barline drag. ⚠️ **§12.5 does not cover this** — the width genuinely
  changed, so the re-engraving is legitimate. What is not legitimate is doing it at pointer rate, and
  re-wrapping sixty bars *below* the edited system while the gesture is still live.

**⛔ AND THE LAYOUT TERM IS NOT WHERE A DRAG'S MONEY GOES, AT THIS SIZE OR ANY OTHER MEASURED SO
FAR.** 17% of the session, ~1.9 ms/render, and §9's copy-on-write cannot touch the other 83%.

#### 🚨🚨 Three bugs in the census — two of them had already been quoted as findings

Found while reading the dumps above; all fixed 2026-08-22, with `src/dev/renderCensus.test.ts` (new)
pinning the arithmetic. ⭐ **The instrument had never had a spec**, because the only way to read a
number out of it was to look at a console — which is why all three are arithmetic, not timing.

1. **`reset()` cleared the buckets but not the part accumulators.** `enable()` calls `reset()`, so his
   second `enable()` divided a cumulative numerator by a fresh denominator and printed
   **`format … 259%`** of a 367 ms layout total. ⚠️ Everything between the first `dump()` and the
   second `enable()` was in that numerator and counted nowhere else.
2. **`fingerprint` read 0 ms for its whole life, and §9 rests on that walk.** The probe was never
   wired: it sat in the *width* path, which stopped consulting the fingerprint when the formatter left
   (`MeasureLayout.noteSpaceForMeasure`), while `laneFingerprint`'s only live caller moved to
   `measureShapeKey` — **outside** the layout bracket, 128 calls per render. ⛔ A zero from an unwired
   probe and a zero from a free walk are the same number. Now probed at `laneFingerprint` itself.
3. **`width cache: 0 hits / 0 misses` was quoted in §12.6 as if it meant the cache was cold.**
   `layoutCacheProbe` had **no call site anywhere in `engine/`**, and the `MeasureWidthCache` it would
   have measured is *deliberately* not consulted (`MeasureLayout.ts` says so in prose). ⚠️ `cache:` is
   still passed at `VexFlowRenderer.ts:3473` and still never read. The line is deleted; the probe is
   deleted; the seam method is gone from `RenderProbe`.

Two more corrections that came with them:

- **`format` is renamed `columns`.** It has not timed VexFlow's `Formatter` since the spacing rule
  replaced it; the name outlived the thing by long enough for "format (VexFlow Formatter) 661 ms" to
  be read back as evidence about a formatter that never ran.
- **The parts are shares of the WHOLE RENDER, not of the layout term** — one part is spent outside
  that bracket, so against it the number was never a percentage of anything. The `in layout?` column
  now states the fact that used to be smuggled into the denominator. The layout total is also summed
  raw rather than rebuilt as `round(layout/n) × n` per cause, which drifted ~9% on the fixture.

#### ✅ The per-frame decline log (§12.6's item 1, finished 2026-08-22)

`trillWalk`'s *"no rung down there"* fired **~90 times in one gesture** of his census, with the same
message each time — and its argument is not a template literal. `whyNoJump` walks
`getByType('note')` and runs a `find` inside a `some`: **§12.2's quadratic id lookup, hiding inside a
log message.** ⚠️ A suppressed `dbg` still evaluates its arguments (docs/logging.md), so a production
build with every trace switched off was paying for it too.

Now `logNoRung` — `debugEnabled()` first, then dedup on the message, **keyed per trill** so a second
ornament still gets its own line. The same shape `markBreakWrap.sameSystem` already carried; ⛔ the
line is not deleted and not timer-throttled, because a decline that says nothing is a gesture that
"does nothing", and a reason that CHANGES is the interesting case.

⚠️ **Honest scope**: this is *not* where the 9 ms went — the walk runs before `renderScore()`, so the
census never counted it. It removes work from the frame the user feels, and from production.
⛔ `MouseController`'s per-frame `Endpoint drag` trace was left alone: its arguments are `toFixed`
numbers, and its value changes every frame, so neither the guard nor a dedup would fire.

⭐ **The first version of the guard's test PASSED with the guard deleted.** It compared registry
reads across an unsettled run and a settled one, so it was measuring the *path*, not the log. The
fix is in the spec's own comment: settle first, then compare two identical runs.

#### ✅ The residual is now BRACKETED (2026-08-22)

The ~9 ms was attributed by *reading the render path*, not by a probe. Seven contiguous regions of
`renderScore` now report themselves, in the order it runs them:

| region | what it covers |
|---|---|
| `tier1` | `layoutTier1` — one placement per (measure, staff), whole score |
| `plan` | the spans, the cull window, and `planCrossBarBeams` **twice** |
| `shapeKey` | `measureShapeKey` per (measure, staff) — a `JSON.stringify` each. ⊃ `fingerprint` |
| `groups` | the reuse decision, `clearForRender`, the pages, the measure loop, the connectors |
| `curves` | `renderTies` + `renderSlurs` |
| `ladder` | the **nine** outside-staff passes. ⚠️ several read DOM geometry |
| `hint` | `hintBarlines` |

⭐ **They TILE the render rather than sampling it**, so whatever they miss prints as an
`unaccounted` line instead of being absorbed by a neighbour. ⛔ `fingerprint` is deliberately *not*
a region — it is spent inside `shapeKey`, and subtracting it twice would drive the remainder
negative, which is the 259% bug wearing a different hat. A spec pins that.

The dump is now one table, every part as a share of the **whole render**, with the layout bracket's
two members shown as "of which".

#### ✅ What the bracketing then measured — and the first cut (2026-08-22)

```
1227 renders · 12727 ms · avg 10.4 ms · layout 17%
ladder 20% · LAYOUT 17% · plan 16% · groups 14% · tier1 13% · hint 9% · shapeKey 6% · curves 3%
unaccounted 1%          (the regions TILE the render — the accounting is trustworthy)
```

**⭐⭐ THERE IS NO HOTSPOT, AND THAT IS THE FINDING.** Eight regions between 0.3 and 2.1 ms a frame;
the largest is 20%. So the flatness across eleven gestures finally has a cause — it is *seven or
eight whole-score passes*, not one, and none of them depends on what is being dragged. ⛔ Optimising
the single biggest region takes a frame from 10.4 ms to 8.3 ms. **Only removing all of them clears
it**, which is the case for §12.5a stated in numbers rather than in prose.

**🚨 Two hypotheses of mine died here, both named as top suspects earlier in this very section:**

- **`shapeKey` is 6%.** The 128 `JSON.stringify`s were sixth of eight. And with `fingerprint` at 3%,
  **§9's copy-on-write can reach at most ~4% of a render.** ⛔ That thread is finished; do not
  reopen it on the strength of the argument in §9, which was written before any of this was measured.
- **`curves` is 3%.** Ties and slurs are nearly free.

⚠️ **The attribution is ORDER-DEPENDENT and the table cannot say otherwise.** A forced style+layout
flush is paid by whichever region *reads first after a write*. `groups` writes the whole measure
loop; `curves`, `ladder` and `hint` then read. So `ladder`'s 20% may include flush work `groups`
caused. Separating flush from JS needs `PerformanceScriptTiming.forcedStyleAndLayoutDuration`
(docs/render-performance-research.md §7i), which attributes forced layout **by function name**.

##### ✅ `hint` — gated, and it was 9%

`hintBarlines` re-derives every barline's device-pixel position, one `getScreenCTM()` per rect, and
`renderScore` called it with `force: true` **every render** — the one flag that bypasses its own
early-out. ⭐ `force` exists for exactly one reason, which the pass states itself: *"a fresh render
carries brand-new, unhinted rects."* On a mark-drag frame nothing is re-engraved and nothing is
translated, so there are no new rects and the previous stamp is still correct.

Now `force = redrawn > 0 || barlinesMoved`. ⚠️ **The second term is not optional**: a bar that merely
MOVED keeps its shape key (x and y are deliberately out of it, §7a) but its rects land on a different
device pixel. A `redrawn`-only gate would leave a staff-spacing drag mis-hinted — the exact gesture
§7a names as having cost 53% of all render time. Both halves are break-tested in
`VexFlowRenderer.incrementalRedraw.test.ts`.
⛔ Passing `false` is **not** "skip it": the pass keeps its own gate on the measured scale, so a zoom
still re-hints and a first render still hints.

##### ⏭️ `plan` — SPLIT, ⛔ not optimised

`plan` was 16% and covered three different things: the spans, the cull window, and
`planCrossBarBeams` — which runs **twice**, and on this score finds nothing at all, because it has no
cross-bar beams.

⛔ **Not cut, deliberately.** Which half is expensive was never measured, and the two hypotheses
above died the same way. So `beams` is now its own region and the next dump says which. ⭐ The cut
itself is already known to be sound when it comes: `drawn` is read only by `splitIntoRuns`
(`CrossBarBeams.ts:449`), where it *splits* runs — so the blind pass is an upper bound on crossings
and the filtered pass can never find one the blind pass missed.

#### ✅ The second dump — one fix that did nothing, and one hypothesis confirmed (2026-08-22)

```
1063 renders · 12401 ms · avg 11.7 ms
ladder 24% · groups 15% · LAYOUT 16% · beams 14% · tier1 12% · hint 9% · shapeKey 6% · curves 3%
plan 1%  ·  unaccounted 1%
```

**🚨🚨 `hint` did not move — 9% before, 9% after — and the reason is the lesson.** The first attempt
gated the `force` FLAG. But `hintBarlines` reads `svg.getScreenCTM()` to verify its own premise
**before** it looks at `force`, and that read is a forced style+layout flush of the document. In
Blink the CTM is a stored field, so **100% of the cost is the flush**
(`docs/render-performance-research.md` §7a) — the flag was skipping the cheap half and keeping the
expensive one. ⛔ **Never "gate" a pass whose first statement is a layout read; gate the CALL.** Now
`renderScore` does not call it at all unless `redrawn > 0 || barlinesMoved`.

⭐ That also turns `hint`'s 9% into a *measurement of a forced flush*, which is the first direct
evidence in our own numbers for the research's central claim — and a warning about the whole table:
`ladder`'s 24% sits immediately after a pass that writes the DOM, so some of it is very likely the
same flush being paid again.

**⭐ `plan` split settled it: `plan` 1%, `beams` 14%.** The two `planCrossBarBeams` passes really were
the cost — on a score with **no cross-barline beams at all**. The second pass now runs only when the
first reports `crossed`, and `CrossBarBeamPlan.crossed` carries the soundness argument:

- `drawn` is read in exactly two places — `splitIntoRuns`, where an undrawn bar SPLITS a run, and the
  fan-refusal branch, unreachable unless something crossed. Splitting only removes adjacencies, so the
  blind pass is an **upper bound**.
- And when nothing crosses the two passes agree on the *within-bar* groups too, which would otherwise
  be a leap: `computeCrossBarBeamGroups` FLUSHES at every barline unless a `continue` bridges it
  (`utils/beaming.ts:158`), so with no bridge anywhere the accumulator is empty at every boundary and
  each bar is grouped from its own slots alone.

⛔ **`crossed` is NOT `joins.length > 0`**, and the spec break-tests exactly that: a crossing group can
be REFUSED — a joined fan landing on two systems — leaving no join while having crossed. That
predicate would skip a second pass the render needed.

#### ✅ The third dump — both cuts landed, and a swap that is not one (2026-08-22)

⚠️ **Read this table in MS PER RENDER, never in shares**: the three sessions have different gesture
mixes, and a share is a ratio against a total that moved.

| region | run 2 | run 3 | |
|---|---:|---:|---|
| `beams` | 1.64 | **0.85** | ✅ **−48%** — the predicted halving, exactly |
| `hint` | 1.04 | **0.65** | ✅ −37% |
| `plan` | 0.08 | 0.07 | negligible, confirmed twice |
| `tier1` | 1.40 | 1.46 | untouched |
| `shapeKey` | 0.66 | 0.63 | untouched |
| `curves` | 0.33 | 0.34 | untouched |
| LAYOUT | 1.83 | 1.94 | untouched |
| `groups` | 1.78 | **3.05** | ⚠️ see below |
| `ladder` | 2.82 | **1.70** | ⚠️ see below |
| **total** | **11.67** | **10.78** | −7.6% |

`beams` is the clean result: it is whole-score work that does not depend on what is being dragged, so
the mix cannot explain it.

**🚨 `groups` and `ladder` did not change — they SWAPPED.** Their sum is **4.60 → 4.75 ms**,
essentially conserved, while the split between them swung by 1.1 ms. ⛔ Nothing regressed and the
ladder did not get faster: **the forced flush moved between two adjacent regions**, which is the
order-dependence this section already warned about. ⭐ It is also the strongest evidence yet that a
large part of the residual *is* the flush — and that **wall-clock regions structurally cannot say how
much**, because whichever region reads first after a write pays for all of it.

**⭐ Why `hint` did not fall to zero, and why that is CORRECT.** Read the per-cause `redrawn %`:
`handleTrillBodyDrag` 0, `handleSlurBodyDrag` 0, `nudgeArmedOttavaEnd` 0 — but `handleDynamicDrag`
**0.8%**, `nudgeArmedHairpinEnd` **0.8%**, `handleTempoDrag` **1.6%**. On those frames a bar really is
re-engraved, because a dynamic and a tempo mark are VexFlow modifiers living *inside* the measure
group and therefore inside its shape key. New rects must be hinted. So the gate now skips exactly the
frames it should and fires exactly where a bar changed; the remainder only disappears when a mark
stops being part of its bar's shape key — which is §12.5a.

#### ✅ `__flush` — WHO pays the reflow (2026-08-22)

Eight regions of wall clock took this as far as wall clock goes, and the `groups`/`ladder` swap is
where it stopped: a region reports where the bill LANDED, never who ran it up.

🚨 **The obvious instrument was the wrong one.** `PerformanceScriptTiming.forcedStyleAndLayoutDuration`
attributes forced layout by function name — but a LoAF entry is only emitted for a frame longer than
**50 ms**, and ours are 10–17 ms. It would report nothing. (Corrected in
`docs/render-performance-research.md` §7i, where it had been recommended as the top instrument.)

So `src/dev/layoutFlushCensus.ts` instead — `__flush.enable()` … `__flush.dump()`. It patches the
reads that force a style+layout flush (the list is engine-verified: research §7a), times each, and
charges it to the **caller's own stack frame**. No threshold, and it names our modules.

⚠️ **How to read it.** The first read after a batch of writes pays for all of them; the reads behind
it are nearly free, because the document is clean and every engine early-outs. So a large total can
mean "first in line", not "expensive". ⭐ **The actionable shape is MANY reads AND a large total** —
that is interleaving, and batching those reads collapses N flushes into one.

#### ✅ THE FIRST `__flush` DUMP — and ⭐⭐ the flush and the volume are two different problems

```
49,707 forcing reads, 2062 ms inside them

site                          reads    total ms   avg ms   worst ms
hintBarlines                 47,432      1130.7    0.024      1.0
<anonymous, see below>          542       555.7    1.025     10.1
drawTempoMarks                  172       185.9    1.081     10.1
registerDynamics                240        99.2    0.413      1.5
MouseController.clientToSvg   1,131        66.8    0.059      0.3
markInkX                        190        23.8    0.125      0.4
```

⭐⭐ **They are not the same problem and they are not in the same place:**

- **THE FLUSH** is `drawTempoMarks` and the anonymous row — ~714 reads, ~742 ms, **~1 ms each with a
  10.1 ms worst**. That is the classic first-read-after-a-batch-of-writes, and it is what §7a of the
  research describes.
- **THE VOLUME** is `hintBarlines`: **47,432 reads, 95% of every forcing read in the app**, at
  **0.024 ms each**. ⭐ Its batching is *working* — each read is cheap precisely because the document
  is already clean — it simply does an enormous number of them, one `rect.getScreenCTM()` per
  barline rect, ~250 a call. That is the ~4 ms per call the render census implied, and it never pays
  a big flush (worst single read: 1.0 ms).

⛔ **So "batch the reads" is the wrong prescription for the biggest row.** They are batched. The fix
is to stop reading per rect: `getScreenCTM()` returns the matrix for an element's *user space*, and
an untransformed rect shares its parent's — every barline rect in one measure group has an identical
CTM.

🚨 **And three predictions of mine died here.** `registerDynamics` and the ghost drawers were named as
the top suspects: `registerDynamics` is **5%** and the ghost drawers do not appear at all.
`clientToSvg` was called "trivially cacheable" — it is 1,131 reads for 67 ms, about **3%**.

##### 🚨🚨 The instrument reported a quarter of its own data under a row called `http`

`callerFrame` matched `at (?:async )?([\w$.<>]+)`, which is right for `at Foo.bar (…)` and
catastrophic for an **anonymous** frame, whose entire line is
`    at http://localhost:5199/src/…/TempoLayout.ts:123:45`. There is no function name there, so it
captured the URL scheme — and 542 reads and 555.7 ms, **the most expensive reads in the table**, were
filed under `http`.

⭐ The parser is now structural rather than lexical, which is what makes it safe: V8 writes a named
frame as `at NAME (LOCATION)` and an anonymous one as `at LOCATION`, so **the parenthesised tail is
what says whether a name exists** — never the shape of the first token. An anonymous frame now
reports `TempoLayout.ts:123`, which is a better answer than a function name would have been. Its spec
is literal V8 lines, because the frames a test can *synthesise* are exactly the well-behaved ones
that never broke.

#### ⭐⭐ THE SECOND `__flush` DUMP — the flush is FIRST IN LINE, and cannot be optimised away

With the parser fixed, the anonymous quarter has a name.

```
15,626 forcing reads, 1034 ms inside them

site                          reads   total ms   avg ms   worst ms
dynamicsLinePass.ts:72          379      527.5    1.392      7.4
hintBarlines                 13,141      299.8    0.023      1.4
MouseController.clientToSvg   1,613      106.7    0.066      0.3
markInkX                        379       49.8    0.131      0.4
registerDynamics                 76       44.9    0.591     25.0
drawTempoMarks                   38        5.1    0.134      0.4
```

⚠️ The line number is the **served** file's, not the source's (source: `dynamicsLinePass.ts:136`,
`text.getBBox()`). With one read per file that is unambiguous; in a file with several it would
mislead, and a future reader should check the source rather than trust the number.

**⭐⭐ `dynamicsLinePass` and `markInkX` both show exactly 379 reads** — the fixture has one dynamic
and both read once per dynamic per render, so this is ~379 renders at **one read each**. There is no
loop to batch. That single read costs **1.39 ms** because it is the frame's FIRST geometry read after
the measure loop wrote the DOM, so it pays the whole accumulated flush.

⛔ **So "batch the reads" is the wrong prescription, and this section proposed it.** Moving or merging
that read only hands the bill to whoever reads next — the `groups`/`ladder` swap again, one level
down. **The flush is ~1.4 ms per frame, paid once, by whoever reads first, and the only way not to
pay it is not to write the DOM in that frame.** That is §12.5a, now measured rather than argued.

⭐ `hintBarlines` is the mirror image: **84% of all reads, 29% of the time, 0.023 ms each** — no flush
at all, because by the time it runs the document is clean again. Pure volume, ~35 reads a frame
(which is the visible barline count under culling), ≈0.8 ms.

🚨 `registerDynamics` worst = **25 ms**. One read, 25 ms — a catastrophic flush after a full re-wrap
(the same gesture logs *"Severe measure compression"* repeatedly). Rare, and visible when it happens.

##### ⛔ The `hintBarlines` CTM memo is DEAD — measured, not argued

The plan was to memoize `getScreenCTM()` per parent, since an untransformed rect shares its parent's
user space. A probe against a real 12-bar render says:

```
rects 14 · distinctParents 14 · rectsPerParent 1.00 · histogram {1: 14} · withOwnTransform 0
```

**Every barline rect is the only rect in its parent group**, so that memo saves exactly zero reads.
⭐ The inference that there were "several rects per group" came from dividing read counts, and was
never checked — the fourth prediction in this section to die that way.

What remains, with honest sizes: memoizing by *measure group* instead (the `vf-stavebarline` groups
carry no transform, so those rects do share a CTM) is ~1.2 rects per group ≈ **0.15 ms/frame**;
composing the CTM from `transform` attributes — which are not layout reads — collapses 35 reads to 1
for the full ≈0.8 ms, but hand-multiplies matrices inside the one pass whose whole job is landing ink
on exact device pixels (⚠️ `reference_e2e_geometry_net` already records COMPOSE THE CTM as a trap).
⛔ Neither is worth taking before §12.5a, which is 1.4 ms and structural. The question it settles: does the residual sit in `shapeKey` + `tier1`
(pure JS — memoize it) or in `ladder` + `curves` (which is where every `getBBox()` lives — batch the
reads)? ⭐ `docs/render-performance-research.md` §7 says the same split decides the fix, from the
other direction, and gives a second instrument (`PerformanceScriptTiming.forcedStyleAndLayoutDuration`)
that attributes forced layout **by function name**. ⛔ Do not choose between 12.5a and 12.5b before
this number exists.

---

## ✅ 12.5a — A GESTURE DRAWS ONLY THE FAMILY THAT IS MOVING (BUILT 2026-08-22)

His own proposal: *"why do we have to render the whole score? Why not just render that element?"*

`engine/rendering/markPreviewPass.ts` + `MusicEngine.previewMarks` + `RenderController.previewMarks`.
A mark drag redraws ONE family against the last full render instead of re-deriving the score. The
census is the whole argument: eight whole-score regions, the largest 20%, and `measuresRedrawn` at
**0%** for the entire gesture — the music never changed, so ~11 ms went on re-deriving what was
already on screen. ⛔ Optimising the biggest region caps out at a fifth; the only thing that removes
all eight is not running them.

**Wired to**: the ottava, pedal, hairpin, trill and slur BODY drags, and — differently — the TEMPO
drag (below). ⛔ Not the dynamic or expression families yet.

### ⭐⭐ REDRAWN families and the one MOVED family

The five above are drawn as their own top-level `<g>`s, so a preview takes the ink down and draws it
again. **A tempo mark is not**: its glyph is drawn *inside its bar's* `<g class="vf-measure">` by
`TempoLayout.drawTempoMarks`, and two later passes reposition it through one composed, idempotent
transform whose components live on the element (`tempoMarkTransform`). So its row in
`MARK_PREVIEW_FAMILIES` has **no `redrawn`** — nothing to remove, and its registry box is MOVED by
the writer rather than re-added; take it down and nothing puts it back.

Its `draw` is two calls `renderScore` already makes, in the same order: `tempoNudgePass`
(⭐ new — the composer's nudge, whose only other writer is inside the bar draw a preview skips) then
`tempoLinePass` (the ladder, which already re-runs over every measure *drawn or reused* on every
render — that property stated as a requirement).

### 🚨🚨 …and the tempo HORIZONTAL cannot be previewed at all

Measured on his own gesture, 2026-08-22: *"while dragging tempo refuses to move and after mouse
release it lands in the cursor"*. A tempo drag's horizontal is a **re-anchor** — the trace is
`[Tempo] walked onto its next stop` on every frame, with the latch dropping the offset back to ~0 —
and **no transform can carry a glyph into another bar's group**. The frame moved it by an offset of
nothing and left it where it was; the drop's full render put it where it belonged.

⭐ So the row's `placed` asks whether the glyph is drawn for the ANCHOR the mark now has, and a
changed anchor **refuses** into a real render. That is not a workaround: the bar genuinely has to be
re-engraved, which is exactly what `MeasureRedrawKey` folding a mark's overrides into its shape key
is for.

🚨🚨 **The first cut asked about the BAR, and that was too LOOSE** — his report the same day: *"while
dragging the tempo gets stuck at certain points and doesn't offset smoothly"*, with the ink jumping
~39 px BACKWARDS on every `[Tempo] walked onto its next stop`. Every crossing *within* a bar passed
that test, so the frame wrote the latch's offset of 0 against a base still measured from the previous
onset — a sawtooth, once per stop. The identity a walk rests on is `drawn = base(anchor) + offset`
and a crossing moves **both** halves, while a preview may only write the offset. `drawTempoMarks` now
stamps the address it drew for (`data-tempo-anchor="<bar>:<beat>"`) and the vouch compares it.

⚠️ **The honest consequence**: only the tempo drag's VERTICAL takes the cheap path. Its horizontal
pays a full render per frame, as it did before. Making that cheap means drawing the mark outside its
bar's group — the arrangement the other five have — which is a real change to
`TempoLayout`/`MeasureRedrawKey` and is ⏭️ not taken.

⛔ **And the same is true of the dynamic and expression families**, whose drags re-anchor the same
way. Their `view.dynamics` lane read is still the stale-lane trap below; the bar question is the
larger one and comes first.

### The three take-downs, and why a preview is not just a redraw

`renderScore` is a sequential accumulation, so re-running one pass in the middle of it is not
idempotent. Every frame: the family's `<g>`s out of the DOM, its rows out of the element registry
(`removeByType`), the append-only collections and **the drawing context's ambient state** rewound to
that pass's entry point — measured as `stroke-width="1.6"` where the render had produced `1.3`, on a
bracket nothing had changed. ⚠️ The collections rewind to the family's PLAN moment and the context to
its DRAW moment; those are different points in `renderScore` and taking one for the other redrew the
ottava in the trill's ink.

### ⛔ THE DROP RENDERS FOR REAL, and it is not optional

A preview does not restack the ladder — a pedal that ought to move out of a rising bracket's way has
not. Its whole licence is that the picture is temporary. `commitPreviewed` deliberately paints
nothing, so every `end*BodyDrag` now calls `renderScore()`. ⚠️ Nothing rendered there before, because
the last frame's own full render happened to be the final picture. A preview frame is not.

### 🚨🚨 THE TRAP: a placement's `view` is a FROZEN LANE COPY

`MeasurePlacement.view` is built by `staffMeasureView` **during** the render — a fresh filtered
object, not a live reference. So `placement.view.hairpins` answers *"whose staff is this on?"* as of
the last full render. Harmless while every frame was a full render; a bug the day a gesture previews
off a snapshot.

⭐ **The rule: a score-level pass resolves its mark from the SCORE** — `for (const measure of
score.measures) for (const mark of measure.marks)` + `staffIndexOfId(score, mark.staffId)`. That is
what `OttavaRenderer` and `PedalRenderer` always did, and why neither ever had it. Fixed in
`renderHairpins` and `planDynamicsLines`; ⏭️ the latter still reads the *letters* off
`placement.view.dynamics`, so a previewed DYNAMIC family would hit the same thing.

⚠️ For a full render the two spellings are identical — lane membership IS `matchesStaff(h.staffId, …)`
— so the fix is a no-op there and a fix only where the placements are older than the score.

### ⏭️ Left open

- `planDynamicsLines`'s letters (above), before the dynamic/expression families are ever previewed.
- Drawing a tempo/dynamic/expression mark OUTSIDE its bar's group, which is what would make their
  horizontal previewable. ⛔ Not taken — it moves a mark out of the arrangement `MeasureRedrawKey`
  was built around, and the win is one gesture's horizontal.
- The `[Hairpin frame]` / `[Trill frame]` traces in the walks are marked ⏱ TEMPORARY and are still in.
