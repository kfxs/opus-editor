# Render performance — the plan

Companion to `docs/render-performance-findings.md`, which measured what a keystroke costs and
deliberately stopped short of prescribing a fix. This doc chooses the fix and sequences it.

The findings doc asked "at what size does the editor stop being usable?" and answered it for a
**single staff**. The target that actually matters is a **full orchestral score** — Mahler 5,
Turangalîla — at any zoom, scrolled anywhere, with no "edit only these staves" mode to hide behind.
That target moves the problem by two orders of magnitude and changes which fix comes first.

---

## 1. The shape of the problem

`renderScore()` is called from ~116 sites (tests excluded). Every one of them means the same thing — *make the
picture right again* — and every one of them runs the same full pipeline. That pipeline welds
together four derivations that have four completely different invalidation keys:

| # | derivation | depends on | cost today |
|---|---|---|---|
| 1 | **Intrinsic measure width** | one measure's contents + its clef | VexFlow `Formatter`, ~1.2 ms/bar. Not memoized. |
| 2 | **Casting-off** — line breaks, justification, staff-spacing Y | all the widths + container width + view mode | O(N) arithmetic. Microseconds. Not a problem. |
| 3 | **Draw + registry population** | the casting-off + content | O(N) DOM, ~35 nodes/bar/staff. |
| 4 | **Highlight paint** | the *selection*, nothing else | a DOM recolour pass over the already-drawn SVG. |

The entire plan is one sentence: **give each of these its own trigger.** Nothing below requires a new
field on the model. Design Principle 3 already blesses the whole direction — *"layout results
(positions, breaks, spacing) are derived/cached views over content."* We have simply never cached
them.

## 2. The real target, in numbers

A Mahler 5 movement is roughly **500 measures at ~25 staves**. Turangalîla is worse — comparable bar
counts at 40+ staves. Feeding the measured constants through:

| | 400 bars, 1 staff | 500 bars × 25 staves |
|---|---:|---:|
| layout, uncached | 470 ms | seconds |
| SVG nodes | 14,000 | **~440,000** |

The node count is the row that ends the argument. Four hundred thousand SVG nodes is not a slow
keystroke; it is a document the browser cannot hold at all — memory, scrolling and the browser's own
paint give out long before typing does. **At the real target, virtualization is not an optimization;
it is what makes the score representable.**

But it cannot come first, for a reason worth stating precisely:

> **Layout is not virtualizable.** To know which bars are on screen you must know where every bar
> is, which is a running sum of every bar's width, which is the formatter over the entire score.
> Culling the *draw* leaves the *layout* term untouched.

So the width cache is not an alternative to virtualization — it is the thing without which
virtualization buys nothing. It comes first regardless.

### 2a. A correction to an earlier estimate

An earlier sketch of this plan reasoned in "bar × staff" units and concluded there would be ~12,000
of them to walk per render. That is wrong, and the code says why: **measures are shared across
staves.** `score.measures[]` is one flat list; each `Measure.slots[]` holds every staff's notes,
tagged with `staffId`. A 25-staff Mahler movement therefore has **500 measures**, each with a fat
slot array — not 12,500 measures.

This matters: an O(number-of-measures) walk per render stays cheap at orchestral scale. It is only
the *per-measure work* that must shrink. Which is exactly what §3 and §4 do.

## 3. P1 — Width is per **(measure, staff)**, not per measure

**This is a bug fix that happens to be the performance fix.** Do it first.

`MeasureLayout.calculateMinimumMeasureWidth` receives the whole `Measure` and does this:

```ts
const sortedAll = [...measure.slots].sort((a, b) => fracCompare(a.beat, b.beat))
// ...
const voiceIds = [...new Set(sortedAll.map(s => s.voice ?? 0))].sort()
```

It groups by **voice** and never filters by **staff**. On a 25-staff score, every staff's notes are
poured into the same one or two VexFlow `Voice`s and handed to `preCalculateMinTotalWidth`. That is:

- **wrong** — a measure's width should be the width of its *widest staff*, not the width of all
  staves' notes interleaved into one imaginary voice. It errs wide, which is why nobody has noticed
  it at two staves, but it is not a width anyone asked for; and
- **the reason cost scales with staff count** — the formatter is being fed 25× the notes.

**And the bug has a second half: the clefs.** The renderer already computes `effectiveClefsByStaff`
— one map per staff — but hands `calculateMeasureWidths` only the primary staff's map; the comment
above the call admits it ("the width calc below uses the primary staff's map"). The overhead terms
inside the width calc — `hasClefChange` at a measure start, the mid-measure clef count — are
per-staff facts, currently computed from staff 0's clefs for everybody. P1 threads
`effectiveClefsByStaff` into the layout alongside the per-staff slot slices.

The render loop already knows how to do this correctly: it calls `staffMeasureView(measure, staff.id,
score)` to slice a measure down to one staff. The layout must use the same slice — and the per-staff
part of the overhead moves *inside* the max:

```
minWidth(measure) = max over staves of ( noteSpace(measure, staff) + clefOverhead(measure, staff) )
                    + sharedOverhead(measure)     // TS glyph, barline padding — same for all staves
```

Correct, and it turns one enormous formatter call into N small ones — which are individually
cacheable, whereas the enormous one was not. This phase is a prerequisite for P2 in the same way
P2 is a prerequisite for virtualization.

(Pre-existing and deliberately unchanged: the cautionary end-clef at a line break stays a
primary-staff concern — `applyCautionaryClefs` resolves `measureEndingClef` with no staffId,
mirroring the renderer's own "cautionary clef width isn't per-staff" note. Leave it; it is not this
bug.)

**Caveat to verify before landing:** widths will change on existing multi-staff scores (they should
get *narrower*, since we stop over-reserving). Confirm two-staff scores still engrave correctly.

## 4. P2 — Memoize the intrinsic width

Cache the expensive half only, and key it by content.

### 4a. Cache the note-space width, not the total width

`calculateMinimumMeasureWidth` is two things bolted together:

- the **formatter call** — depends on the staff's slots and the clef in effect. Expensive.
- the **overhead** — clef width, time-signature width, first-in-line, mid-measure clef changes,
  cautionary clef/TS at a line break. Pure arithmetic on flags.

Cache only the first, and add the overhead on top. This dissolves the wrinkle the findings doc
worried about in §4: a measure that lands first-in-line pays a full clef, so its *total* width
depends on where the line break falls — but its *note-space* width does not. A measure that gets
pushed to a new line keeps its cached intrinsic width and simply pays different overhead. **The
cache is never invalidated by re-wrapping.**

### 4b. Key it by a content fingerprint, not a dirty flag

The key is a fingerprint derived from the same data the layout reads — which is more than "the
slots plus the clef." Width depends on: the staff's slots **including** tie fields and
`forceAccidental` (accidental glyphs take width, and `tiedFrom` suppresses one), dots, voice; the
staff's tuplets (`createTupletsForMeasure` adjusts tick values before the formatter runs); the
staff's mid-measure clefs; the effective clef; and the time signature (it feeds the `Voice` and
`chooseVoiceMode`). Practical spec: fingerprint the whole `staffMeasureView` lane plus effective
clef plus TS. Dynamics don't affect width and could be excluded, but including them costs only
false invalidations — cheap insurance.

**The memo is sound measure-locally — verified, not assumed.** A measure's width cannot depend on a
*neighboring* measure: accidental display state is measure-scoped (`activeMeasureAlterations` in
`NoteBuilder` starts fresh per measure) and tie-continuation suppression reads `p.tiedFrom` off the
slot's own pitch, which is rewritten *in this measure* if the tie partner changes. So the cache
cannot be poisoned by an edit next door.

The alternative (a version counter bumped by `ScoreModel` on every write) is tempting and should be
rejected. `ScoreModel` is 3,500 lines with dozens of write sites, and **one missed bump is a
silently wrong picture** — a measure that renders at a stale width forever. That is precisely the
failure mode the findings doc is nervous about in its §6.4 ("does an incremental cache hold under
rebar?"). A fingerprint cannot go stale, because it does not care *how* the measure changed: rebar,
paste, undo, meter change, staff-copy all just work. **It answers §6.4 by construction rather than by
discipline.**

**Cost, honestly.** "One small string per (measure, staff) per render, a hundredth of what the
formatter costs" is true — against the *uncached* formatter. But once P2 lands, the formatter mostly
doesn't run, and the steady-state per-render cost **becomes the fingerprint walk itself**. At the
real target that is ~12,500 lane serializations per render — materially the same work as
`JSON.stringify(score)`, plausibly tens of ms on a Mahler movement, not sub-ms. At the sizes where
most editing happens it is noise; at the orchestral target it is exactly the cost §7 exists to kill.
That doesn't change the design — the fingerprint is still right, and §7 is the answer — but it does
change §7's status (see there), and P0 must time this walk at synthetic 500×25 scale so it's a
number, not a prediction.

### 4c. Where the cache lives

Not module-level (Principle 1 forbids ambient singletons — it would break multi-document and tests).
Not on `ScoreModel` (Principle 3 forbids layout in the model). So: a `MeasureWidthCache` object,
owned by `VexFlowRenderer`, passed *into* `calculateMeasureWidths` as a parameter. `MeasureLayout`
stays pure over its inputs; tests can pass no cache at all.

One housekeeping rule the cache needs: a fingerprint-keyed map **grows monotonically** — every edit
mints a new key and nothing ever deletes the old one, so a long editing session accumulates dead
entries. Cap it (LRU, or simply clear-when-over-size — at ~one number per entry either is fine).

**Expected after P1+P2:** the layout term stops being the story. Single staff, 400 bars: ~470 ms →
single-digit ms.

## 5. P3 and P4 — stop redrawing when nothing was drawn differently

These two are ordinary caching, touch no architecture, and help both views. They are also what makes
the editor feel fixed *today*, before the big structural work lands.

### 5a. P3 — a selection change must not redraw the score

`RenderController.renderScore()` runs the full pipeline for selection changes. Clicking a note in a
400-bar score pays the entire layout and draw just to move a highlight.

**The signal — a real fork, to be decided consciously.** Two candidates:

1. **The facade flag.** `MusicEngine` already has `modelDirty`, which does exactly this shape of
   job for gap repair. It is untrustworthy today for precisely three reasons: `previewSlurShape`,
   `previewSlurEndpoint` and `previewStaffSpacing` mutate the model deliberately without setting it
   (the live-drag paths that defer their undo entry) — all three in one file, at the facade. Every
   *other* mutation already funnels through `commit`/`saveUndoState` (the ARCHITECTURE invariant:
   every edit resyncs playback and snapshots undo), which is where `modelDirty` is set. Teach those
   three paths to set it and "did content change" is **O(1) per render**. Note §4b's argument
   against flags does *not* apply here: that was about `ScoreModel`'s dozens of internal write
   sites; this is a facade choke point that already exists and already works.
2. **The whole-score fingerprint** — the per-measure fingerprints plus the score-level content
   (slurs, tempo marks, engraving overrides). Cannot go stale by construction — but it must be
   *computed* before deciding to skip, so every selection click pays the O(N) walk §4b costs out.
   Trivial today; at the orchestral target it is the same tens-of-ms §7 exists to kill.

**Recommendation: the flag.** P3's question is whole-score yes/no, and the choke point for it
exists; fingerprints stay what they are — P2's *per-measure* invalidation, where no choke point
exists. Failure mode accepted with the flag: a direct write to `scoreModel` that bypasses the
facade would skip a needed repaint — but the invariant says that write is already a bug.

Either way, content is only half the key: the skip test must also compare the **view state** (mode,
container width, staff-spacing knob, suppressed ids, frozen layout, dragged clef). **Content
unchanged + view state unchanged → the SVG on screen is already correct → skip clear, layout and
draw, and run only the highlight pass.**

**The actual work.** Highlights currently use *the redraw itself* as their reset mechanism. The code
says so out loud, twice, in `HighlightController.highlightNote`:

> `// Safe: the next render rebuilds the SVG.`

Those comments become false the moment we skip the render. `applyHighlights()` mutates the DOM two
ways, and both need an inverse:

1. **Recolours** — `setAttribute('fill'|'stroke')`, `style.fill`, `classList.add('selected-note')`.
   Record `(element, attribute, previousValue)` before each mutation and restore it on clear.
   ⚠️ It must restore the **previous value**, not remove the attribute: voice 2 renders green by
   default, so a naive `removeAttribute('fill')` would blacken it.
2. **Added nodes** — `.measure-box`, `.keyboard-cursor`, `.paste-caret`, the slur handles. These are
   already class-tagged; remove them by class.
3. **DOM reordering** — `highlightNote` does `group.parentNode?.appendChild(group)` to raise a
   selected note above a unison neighbour. Either record and restore the original sibling position,
   or accept the reorder as permanent (it is visually harmless — it only decides which of two
   coincident noteheads paints on top).

### 5b. P4 — the ghost is an overlay, so stop redrawing the score under it

Every mousemove with a tool armed calls `renderScoreWithPreview`, which does a full clear + layout +
draw of the entire score in order to move **one translucent notehead**. It does not need to: the
ghost only needs `measureLayoutInfo` from the last render, which is still sitting on the renderer.

Draw the ghost into its own removable `<g class="overlay">`: remove the group, redraw the group,
done. Same for the clef, time-signature, dynamic and tempo ghosts, and the paste caret. Mousemove
goes from O(N) to O(1).

**The "no ghost here" branch is part of this.** Hovering an *invalid* element (clef, TS, barline)
today does a full `renderScore()` whose only purpose is to **erase** the previous ghost. Under the
overlay it is "remove the group", nothing else — don't leave that branch on the old path.

Note the existing `PREVIEW_THROTTLE_MS` in `MouseController` is a symptom of this cost. Once the
ghost is O(1), the throttle can probably go — the preview should follow the cursor at frame rate.

## 6. P5 and P6 — the measure becomes the unit of drawing, then we cull

After P1–P4, the only remaining O(N) term is **the draw on a genuine edit** — and at orchestral
scale, the standing DOM node count regardless of edits. This is where the two-tier split that
`linear-view-plan.md` §P4 already identified earns its keep.

### 6a. P5 — two tiers of geometry; measures as addressable groups

The blocker `linear-view-plan.md` names is real: `ElementRegistry` — the authoritative hit-test map —
is populated **as a side effect of drawing**, so culling a measure erases its geometry and breaks
selection, scroll-into-view and playback-follow for anything off-screen. Split it:

- **Tier 1 — every measure.** Measure boxes (x, y, width, line), computed from the cached widths
  without drawing anything. Pure arithmetic over P2's output. *Almost everything that needs offscreen
  geometry needs only this tier.*
- **Tier 2 — drawn measures only.** Element bounding boxes (noteheads, accidentals, handles),
  produced by drawing that measure into its **own addressable `<g>`**, positioned by a transform.

Frame P5 as a structural change with **two** payoffs, not as "virtualization prep":

1. It is the prerequisite for culling (P6); and
2. it makes **incremental redraw** possible. In linear view, adding a note to bar 7 shifts bars
   8–400 to the right — so a naive "only redraw what changed" degenerates instantly to a full
   redraw. With addressable groups, those unchanged bars get a new `transform` and are **never
   redrawn at all**.

### 6b. P6 — virtualization, on both axes, zoom-aware

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

### 6c. Pages, later — this plan doesn't block them

Not a phase; a compatibility note. There is no page system today, and `layoutConfig.ts` already
decided what one would be: **a property of `wrapped` — a casting-off — not a third view mode.**
Nothing here fights that:

- **P2 is indifferent to pagination by construction.** §4a caches the *note-space* width precisely
  because it doesn't depend on where breaks fall; pages are just one more break policy consuming
  the same cached widths. Vertical justification (spreading systems down a page) is more of the
  casting-off arithmetic — microseconds, never cached, never invalidating anything.
- **Page dimensions join the P3 view-state key** (they change how content is shown, not what it is
  — Principle 3 keeps them out of the model exactly as it keeps the staff-spacing knob out).
- **P5's addressable groups are how pages get cheap.** A measure group positioned by transform can
  be assigned to any page surface without redrawing; P6's culling generalizes to "draw the visible
  pages" — which is what the big engraving apps do.

## 7. The probable end-state: copy-on-write measures

Not a phase — but no longer quite an "escape hatch" either. §4b's honest arithmetic says the
fingerprint walk is the *steady-state* render cost once P2 lands, and at the orchestral target that
is tens of ms, not noise. So expect to end up here; it sits last **because it is invasive, not
because it is improbable.** P0's timing of the walk decides how soon.

P2 walks every measure on every render to fingerprint it. §2a argues that is cheap enough at ~500
measures for the sizes most editing happens at. When profiling says otherwise, the answer is not a
hand-maintained version counter (§4b) — it is to make **object identity** the invalidation check.

Today `ScoreModel` mutates measures in place (`measure.slots.push(...)`, `measure.slots = ...`) and
`getScore()` hands out the live reference. If a write instead **replaced** the measure it touched,
leaving the others' identities intact, then:

- the width cache becomes a `WeakMap` keyed on the measure object. Invalidation is free, and it
  **cannot go stale** — unlike a version counter, there is no bump to forget;
- an edit touches one measure, so exactly one cache entry is recomputed and the other 499 cost
  nothing at all.

And it pays a **second, unrelated debt on the same refactor.** `UndoRedoManager.pushState` does
`JSON.parse(JSON.stringify(score))` on **every edit**, and `runBatch` stringifies the whole score
*twice more* just to detect whether anything changed. On a Mahler movement that is a full
serialization of an entire orchestral score, per keystroke — a third O(N) term the findings doc never
measured, because it only timed rendering. Copy-on-write makes an undo snapshot a shallow structural
share instead of a deep clone, and makes `runBatch`'s change detection a pointer comparison.

It is invasive (3,500 lines, dozens of write sites), which is why it is here and not in §4. But it is
the *correct* long-term shape, and when P2's fingerprint walk shows up in a Chrome profile, this is
the answer — not a version counter.

**One slice of the undo debt needn't wait for it.** `runBatch`'s changed-detection double-stringify
is replaceable today: inner `saveUndoState` calls fire `markModelDirty` *even when suppressed*, so
"did anything inside the batch attempt a save" is already known — a ~5-line change that kills two of
the three O(N) serializations per batched edit. Caveat, honestly: it is approximate where the
stringify-compare is exact — an operation that saves without actually changing anything would push a
no-op undo step. Decide whether that trade is acceptable when taking it; it is independent of
everything else in this section.

## 8. P0 — measure first

Before any of it. The findings doc's §6 lists three open questions; two are now answered and the
third is worth an hour:

- **§6.1 the real browser split** — still open. Profile one keystroke in Chrome at 200 and 400 bars.
  jsdom's draw is pessimistic, so the true layout:draw ratio decides how much is left after P1+P2.
- **§6.2 render-call census** — count what actually triggers `renderScore()` in a real editing
  session, tagged by cause. Three suspects are **already exonerated by the code**: the playback
  cursor is an absolutely-positioned Vue `<div>` (no render), scroll is CSS scroll, zoom is a CSS
  transform. So the buckets are: edits, selection, hover preview, armed-tool ghosts, paste caret,
  view toggles. If hover + selection dominate — the likely outcome — P3 and P4 are the cheapest
  large win available and jump the queue; and since hover fires continuously while selection fires
  per click, expect **P4 to jump ahead of P3**.
- **§6.3 the realistic ceiling** — largely answered by §2 above.
- **The unmeasured third term** — time `pushState`'s deep clone and `runBatch`'s two stringifies.
  They are invisible next to 470 ms of layout; they will not be invisible after P1+P2.
- **The fingerprint walk at target scale** — synthetic 500 measures × 25 staves, fingerprint every
  lane once per render, time it. This number decides §5a's flag-vs-fingerprint fork and how soon
  §7 arrives.

## 9. Summary — the order, and why

| | phase | attacks | cost | note |
|---|---|---|---|---|
| P0 | Measure in Chrome; render census | — | an hour | decides whether P3/P4 jump the queue |
| P1 | Width per (measure, staff) | layout | small | **a correctness fix that happens to be the perf fix** |
| P2 | Memoize intrinsic width, keyed by content fingerprint | layout | small | prerequisite for *everything*, incl. virtualization |
| P3 | Selection must not redraw | both | medium | the work is making highlights *undoable* |
| P4 | Ghost/caret as an overlay group | both | small | mousemove goes O(N) → O(1) |
| P5 | Two-tier geometry; measures as addressable groups | draw | **large** | unlocks culling *and* incremental redraw |
| P6 | Virtualization, both axes, zoom-aware | draw + node count | large | the only thing that makes 440k nodes representable |
| — | Copy-on-write measures | layout + undo | large | **probable end-state at orchestral scale** — last because invasive, not improbable |

The through-line: **P1 and P2 are unconditional** — every later phase depends on them, and
virtualization without them saves nothing. **P3 and P4 are cheap and immediate** and probably make
the editor feel fixed at the sizes most work happens at. **P5 and P6 are the real architecture** and
are what the orchestral target ultimately requires; they should be taken slowly, on top of a codebase
where layout is already cheap — not under pressure.
