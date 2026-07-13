# Render performance — what a keystroke actually costs

**This is a findings doc, not a plan.** It records what was measured on 2026-07-13, what the
numbers mean, and what is still unknown. The fixes are named only far enough to say *why the
measurement points at them*; choosing and sequencing them is a separate exercise.

The question it answers: **you can add measures without limit — at what size does the editor stop
being usable, and which part of the render is to blame?**

---

## 1. Method

A throwaway Vitest benchmark (jsdom), since deleted. For each score size:

- **Score:** N measures, single staff, **4 quarter notes per bar** — an ordinary density, not empty
  bars (empty bars would flatter the layout numbers, since the formatter has nothing to format).
- **Layout** = `calculateMeasureWidths(score, clefs, mode)` alone. Median of 5.
- **Full render** = `VexFlowRenderer.renderScore(score)`, after one warm-up render so glyph/font
  caches are primed. Median of 3.
- **Draw only** = full render − layout.
- **SVG nodes** = every element under the render container.

## 2. The numbers

| bars | layout (wrapped) | layout (linear) | draw only | SVG nodes |
|---:|---:|---:|---:|---:|
| 50 | 71 ms | 48 ms | 141 ms | 1,744 |
| 100 | 113 ms | 98 ms | 316 ms | 3,484 |
| 200 | 212 ms | 191 ms | 608 ms | 6,963 |
| 400 | 472 ms | 380 ms | 1,190 ms | 13,922 |
| 800 | 956 ms | 861 ms | 3,008 ms | 27,838 |

Both costs are **dead linear in bar count**: ≈ **1.2 ms of layout per bar**, ≈ **35 SVG nodes per
bar**. Every render pays both, over the **whole score**, regardless of what changed or what is
on screen.

**How much of this to trust.** The *layout* column is pure JavaScript — VexFlow's `Formatter`,
building throwaway voices and calling `preCalculateMinTotalWidth` per measure. No DOM. So it costs
the same in Chrome as it does in Node, and those numbers can be taken at face value. The *draw*
column cannot: jsdom's DOM is substantially slower than a real browser's, so Chrome's draw is
probably meaningfully cheaper than shown — which would make layout a **larger** share of the real
total than the table suggests, not a smaller one. **Only the split is uncertain; that both terms
are O(N) per keystroke is not.**

## 3. What it means

**This is already bad today, in wrapped view, at sizes that are ordinary music.** Layout alone is
~110 ms at 100 bars and ~210 ms at 200. A 200-bar movement therefore spends a fifth of a second in
the formatter **on every keypress**, before a single pixel is drawn. A 400-bar piece is past half a
second of layout, plus draw.

Three consequences worth stating plainly:

1. **It is not a linear-view problem.** Linear view creates the same number of DOM nodes as wrapped,
   merely arranged wide instead of tall (measured above: the layout columns track each other, and
   linear is in fact slightly *cheaper*, having no justification pass). Linear view only made the
   existing waste easier to notice.

2. **The work is almost entirely redundant.** A measure's intrinsic width depends on its own
   contents. Edit bar 7 of a 400-bar score and bars 1–6 and 8–400 have exactly the widths they had a
   moment ago — yet the formatter re-derives all 400. The same is true of the draw.

3. **The worst case is not even an edit.** `RenderController.renderScore()` runs the *full* pipeline
   for **selection** changes too. Clicking a note in a 400-bar score pays the entire layout + draw
   just to move a highlight. That is likely the most infuriating case in practice, and it is not a
   layout problem at all — it is a "we re-render when nothing changed" problem.

## 4. Where the costs actually live

- **Layout** — `MeasureLayout.calculateMeasureWidths` → `calculateMinimumMeasureWidth` per measure:
  builds VexFlow `Voice`s and `StaveNote`s and calls `Formatter.preCalculateMinTotalWidth`. This is
  the ~1.2 ms/bar. It is recomputed from scratch on every render. Nothing is memoized.
  - Note: **linear view makes caching trivially correct** — widths there are purely intrinsic (no
    line fitting, no justification). Wrapped view has one wrinkle: a measure that lands *first in
    line* pays for a full clef, so its final width depends on where the break falls. That is a
    cheap correction on top of a cached intrinsic width, not a reason the intrinsic width can't be
    cached.
- **Draw** — the full VexFlow draw of every measure, which is also what populates `ElementRegistry`
  (the authoritative hit-test map) **as a side effect**.
- **Not measured, and it should be:** what fraction of real-world renders are pure selection /
  highlight repaints rather than edits. If it is most of them, that is the cheapest large win
  available and it is independent of everything else here.

## 5. Why virtualization is *not* the first answer

Virtualization (drawing only the bars in view — see linear-view-plan.md §P4) attacks the **draw**
term only. It cannot help the layout term: you need every bar's width in order to know where the
*visible* bars are, so the formatter still walks all N measures. At 200 bars that leaves ~210 ms of
untouched cost per keystroke.

It is also the **expensive** change of the three, precisely because `ElementRegistry` is populated
by drawing: culling a measure erases its geometry, so selection, scroll-into-view and
playback-follow would break for anything off-screen. Doing it properly means splitting geometry into
a cheap measure-level tier (all measures) and an expensive element-level tier (drawn measures only).

The two candidates the measurement actually points at — **memoizing measure widths**, and **not
re-rendering the score when only the selection changed** — are ordinary caching, touch no
architecture, and help **both** views.

## 6. Open questions (answer before choosing a fix)

1. **The real browser split.** Profile one keystroke in Chrome at 200 and 400 bars. jsdom's draw is
   pessimistic; the true layout:draw ratio decides how much is left after caching.
2. **Render-call census.** Count what actually triggers `renderScore()` in a normal editing session
   — edits vs selection vs scroll vs playback cursor. §3.3 predicts most are not edits.
3. **The realistic ceiling.** At what bar count does a keystroke exceed ~16 ms (one frame) / ~100 ms
   (perceptible)? From the layout column alone, 100 ms of *layout* arrives around 90 bars.
4. **Does an incremental cache hold under rebar?** Time-signature changes, paste and rebar rewrite
   many measures at once. A width cache must invalidate correctly there — this is the one place a
   naive memo could go quietly wrong.

---

# P0 — the numbers the plan asked for

Measured 2026-07-13 on the same jsdom harness (`perf/p0.test.ts`, run with `PERF=1`), same density
(4 quarter notes per bar per staff). Layout is pure JS, so these transfer to Chrome. Two P0 items
remain open at the bottom — they need a real browser.

## P0.1 Layout is linear in **staff count**, not just bar count

100 bars, growing the staff axis:

| staves | layout | per bar |
|---:|---:|---:|
| 1 | 102 ms | 1.02 ms |
| 2 | 214 ms | 2.14 ms |
| 4 | 527 ms | 5.27 ms |
| 8 | 1,056 ms | 10.6 ms |
| 16 | 2,083 ms | 20.8 ms |
| 25 | 3,291 ms | **32.9 ms** |

Dead linear: **1.3 ms per bar per staff.** This is the plan's §3 claim, confirmed — the formatter is
being fed every staff's notes interleaved into one voice set, so cost scales with the staff axis
exactly as if the staves were bars. It is also *why* P1 is the first phase: it is the term that turns
an already-bad number into an impossible one.

**And the layout is an allocation storm, not just a slow loop.** 100 bars × 25 staves transiently
allocates **~1.3 GB** of VexFlow objects; 500 × 25 exhausts a 2 GB default Node heap outright. At the
real target, the uncached layout is not merely slow — it is a memory event, on every keystroke.

## P0.2 The orchestral target, measured (500 bars × 25 staves, 50,000 notes)

| term | cost per render/edit |
|---|---:|
| **layout, uncached (today)** | **16,521 ms** |
| P2's fingerprint walk (the steady state *after* P2) | 63 ms |
| undo: `runBatch`'s 2× `JSON.stringify` | 114 ms |
| undo: `pushState`'s `JSON.parse(JSON.stringify(…))` | 107 ms |
| **undo total, per batched edit** | **221 ms** |

Sixteen and a half seconds of layout per render. The plan said "seconds"; it is worse than that.

## P0.3 What these numbers *decide*

- **§5a's flag-vs-fingerprint fork → take the flag.** A whole-score fingerprint would cost the 63 ms
  walk on *every selection click* at orchestral scale — it would make P3 pay, per click, the very
  cost P3 exists to avoid. `modelDirty` (O(1), one facade choke point, three known leaks to fix) is
  the right signal. This was a recommendation in the plan; it is now a measured decision.
- **§7 copy-on-write is confirmed as the end-state, not an escape hatch.** After P1+P2 the *steady
  state* per render at the target is the 63 ms fingerprint walk — i.e. P2 trades a 16.5 s term for a
  63 ms one, which is a 260× win and still four frames. Object identity (a `WeakMap` keyed on the
  measure) is what takes that 63 ms to zero. It is not urgent; it is inevitable.
- **The undo term is real and it is next in line.** 221 ms per edit at the target — today invisible
  behind 16.5 s of layout, but after P1+P2 it is *the* largest remaining term. Even at ordinary size
  (400 bars × 1 staff) it is 6.7 ms per edit, which is noise against 476 ms of layout today and the
  dominant CPU cost once layout is cached. The §7 note's "one slice needn't wait" (killing
  `runBatch`'s double-stringify via the already-fired `markModelDirty`) removes ~2/3 of it for ~5
  lines.
- **P1 alone is not a speed-up.** Measured directly (100 bars × 25 staves): one interleaved voice set
  = 3,450 ms; 25 per-staff passes = 2,723 ms. A 21% improvement — worth having, but P1's value is
  that it is *correct* and that it makes each per-staff width **cacheable**. The speed comes from P2
  standing on it.

## P0.4 The real browser: the layout:draw split, and the census by cause

Chrome, 200-bar synthetic score, one ordinary editing session (~51 renders): clicking notes,
arrow-key navigation, a pitch drag, two slurs, three accidentals, two measure clears, some panning,
a little hovering.

**51 renders. 8,320 ms of render time.** An average render costs **163 ms**; the worst was 224 ms.
Every click, every arrow key, every pan release spends a sixth of a second in the renderer.

**The split, measured in Chrome (not jsdom):** layout ≈ **45 ms**, draw ≈ **110 ms** per render.
So the real ratio is roughly **28% layout / 72% draw** — which happens to be almost exactly what
jsdom reported, so §2's suspicion that jsdom exaggerated the draw was *wrong*: the ratio holds, and
only the absolute numbers shrink (Chrome's whole render is ~5× faster than the jsdom bench).
Implication: **P1+P2 remove only ~28% of a render.** The draw is the bigger half and always was.

### The census, by cause

| cause | renders | avg ms | changed content? |
|---|---:|---:|---|
| `ghost:note` (hover preview) | 10 | 189 | no |
| `navigateSelection` (arrow keys) | 10 | 152 | no |
| `handleDocPanUp` (pan release) | 6 | 162 | **no — a pan re-renders the whole score** |
| `handleNoteOrEmptyMouseDown` (click-select) | 4 | 151 | no |
| `beginBoxSelectOrPan` | 3 | 156 | no |
| `setAccidental` | 3 | 151 | yes |
| `handleStaffSpacingDrag` | 2 | 174 | view state |
| `setViewMode` | 2 | 171 | view state |
| `deleteSelected` | 2 | 158 | yes |
| `handleNoteDrag` | 2 | 157 | yes |
| `createSlur` | 2 | 156 | yes |
| `handleMouseLeave` | 2 | 155 | **no — a full render to erase a ghost** |
| `handleModifierMouseDown` | 2 | 150 | no |
| `setSelectionMode` | 1 | 164 | no |

**Only 9 of 51 renders (18%) changed any content.** The other 82% redrew a 200-bar score to move a
highlight, follow the cursor, or erase a ghost. §3.3 predicted this; it is now measured, and it is
worse than predicted, because two costs nobody listed showed up:

- **Panning re-renders the score.** `handleDocPanUp` fired 6 full renders (~1 second) for a gesture
  that moves the viewport and changes nothing. Scroll was supposed to be free CSS; the *pan tool* is
  not on that path.
- **`handleMouseLeave` renders to erase.** Exactly the "no ghost here" branch §5b called out — a full
  layout + draw whose only job is to remove a translucent notehead.

### What this reorders

**P3 and P4 jump the queue, and P3 goes first.** The plan (§8) guessed P4 would lead because hover
fires continuously; the data says otherwise — hover was 10 renders, while *selection-shaped* causes
(navigate, click-select, box-select, modifier-click, mouse-leave, pan, selection-mode) total **34 of
51**. P3's skip test kills all of those, plus the two surprises above, for free — the pan and
mouse-leave renders both fail "content unchanged + view state unchanged → skip" and simply never run.
P4 still matters (it makes the ghost O(1) and lets the throttle go), but P3 is the bigger fish here.

**And P1+P2 are no longer the headline at ordinary size.** They cut the 45 ms layout term, not the
110 ms draw. What makes the editor *feel* fixed today is not rendering at all when nothing changed.
P1+P2 remain unconditional — they are what the orchestral target and virtualization stand on, and P1
is a correctness bug regardless — but at 200 bars, on one staff, they are the smaller half.

## P0.5 Still open — needs a real browser (dev instrument shipped)

`src/dev/renderCensus.ts` + `window.__perf` / `window.__census` (dev builds only, temporary):

```
__perf.load(200)     // synthetic 200-bar score, same density as the bench
__census.enable()    // record every render, tagged by cause
…edit, click, hover, drag…
__census.dump()      // renders per cause + the layout:draw split, in Chrome
```

- **§6.1 the real layout:draw split.** jsdom's draw is pessimistic; Chrome's is not.
- **§6.2 the render census by cause.** Which call sites actually fire, how often. §8 predicts hover
  and selection dominate, and that **P4 jumps ahead of P3** (hover fires continuously, selection per
  click). The instrument recovers the cause from the call stack, so it reports the truth rather than
  a guess.
