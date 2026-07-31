# Barlines vanish while zooming in Firefox (stale raster)

**Status:** the *stale raster* is diagnosed, not fixed. A SECOND, separate defect was found and
**fixed** on 2026-07-31 — the barlines themselves were drawn wrongly, and that was what made them
look uneven in Firefox even when nothing was moving. See §"The barline ink" below before reading
the rest: some of the symptom this document was written about belonged to that, not to the raster.

Everything below was measured, not assumed.

---

## The barline ink — FIXED 2026-07-31 (`src/engine/rendering/barlineInk.ts`)

Reported as *"in Firefox the thickness of the barlines is uneven; in Chrome it is not"*, at rest,
with no zooming involved. Three defects, each measured, each fixed:

**1. Every interior barline was drawn TWICE.** VexFlow gives every stave both a begin and an end
barline, so bar N's end and bar N+1's begin were painted on top of each other at the same x. Two
coincident lines are not invisible: the partially-covered pixels along their edges are covered
twice. Measured at the default zoom, an interior line read **84%/78% black across two columns where
the same line drawn once reads 60%/53%** — so interior barlines came out heavier than the one
opening or closing a system, which is drawn once. Fixed by `setBegBarType(NONE)` for any bar that is
not first on its line: *a barline belongs to the END of a bar*. The rule reads off the bar alone, so
it survives culling and group reuse.

**2. A barline was 1 px** — the same weight as a staff line, lighter than a stem (`STEM_WIDTH` 1.5),
where the convention (SMuFL/Bravura `thinBarlineThickness`) is 0.16 staff spaces = 1.6 px. The
heaviest of the three structural lines was our lightest. VexFlow writes the `1` as a literal in
`Barline.drawVerticalBar` and offers no seam, so we re-ink the rects it leaves behind.

**3. ⭐ The barlines did not land on whole pixels — this was the visible one.** Bar-to-bar spacing is
a musical distance, so on screen it is almost never a whole number of pixels (~71.1 device px at 70%
zoom). Every barline therefore sat at a different phase *within* a pixel. One row of real screenshot
pixels, three barlines of identical ink:

```
[  0 100  26   0]   phase .02 — one solid column: thin and crisp
[  0  52  61   0]   phase .48 — two half-columns: fat and pale
[  0  13 100   0]   phase .87 — crisp again
```

Staff lines escape this by accident: their spacing is exactly 7.0 device px at 70%, so all five
share one phase and agree with each other. Fixed by **hinting** — a post-render DOM pass that rounds
each barline's ink onto the device-pixel grid with a whole number of pixels of width, floored at
one. The ink moves by up to half a pixel; the barline's *position* does not.

- **Not browser-specific.** The pass reads the scale it is actually drawn at (`getScreenCTM()` ×
  `devicePixelRatio`) and rounds. Verified identical in real Firefox and real Chromium at 0.875:
  device-left `18, 145, 233, 320, 408, 495`, width `1`, to the digit. **⛔ No UA branch, ever.**
- **⛔ Not `shape-rendering: crispEdges`** (already recorded below as tried and reverted). Measured:
  at 25% zoom it erases **9 of 12 barlines** — it rounds a 0.4-pixel line down to nothing. The
  one-pixel floor is exactly the part it gets wrong.
- **⚠️ The pass gates itself on the MEASURED scale, not on the model's zoom.** On the first render
  the SVG exists before the zoom transform is written to the layer above it, so a hint taken then is
  a hint for 1:1. A guard on the model's zoom number then blocks the corrective pass, and the score
  stays wrong *until the user zooms* — which is exactly how the bug presented. `App.onViewChange`
  calls it unconditionally; the pass costs one matrix read when nothing has moved.
- Print keeps the true 0.16 spaces: hinting is a defence against a screen's pixel grid, and a PDF
  has no such grid (`audience === 'editor'` only).

**Debugging it: `__barlines.dump()`** (dev builds, `src/dev/barlineCensus.ts`) reports where every
barline lands on the device-pixel grid and how many are landing between pixels. It exists because
**no automated check can see this** — see the verification trap below — so the instrument has to run
in the window a person is actually looking at.

---

## The symptom

Zooming with the mouse wheel in Firefox (Chrome is fine):

- Barlines **disappear**, and come back "after a while, by themselves".
- While they are missing, the music also sits slightly wrong — a small but visible **vertical
  mismatch** between what is drawn and where it belongs.
- The repair is slow enough to be obviously noticeable. *"This is not nice UX."*
- It is worse with more music on screen (a multi-page spread).

## What it is NOT — measured, so do not re-investigate

**The renderer is innocent. Nothing is dropped, mis-placed or culled by our code.**

1. **Every barline is in the DOM the whole time.** A zoom sweep from 25% to 300% (`e2e`-style probe
   driving `__perf.load(40)`) found the end-of-system barline present at **every** level: 40 staves,
   80 barlines, 0 rows missing one.
2. **The DOM does not change while it "repairs".** Sampling immediately after a `Ctrl+wheel` event
   and again 2.5s later returns **byte-identical** results — same layer transform, same
   `getBoundingClientRect()` for staves and barlines, same 60 barlines. Whatever changes between
   "broken" and "repaired", it is not the document.
3. It is not the virtualization window. It is not `getVisibleRect`. It is not the pasteboard.

## The diagnosis

Zoom is a CSS `transform: scale(z)` on `.score-zoom-layer`, which wraps one **very large** SVG — a
three-page spread is 3648 × 1697 px at 100% (`docs/zoom-plan.md` §3: scale without re-rendering,
deliberately).

When that transform changes, Firefox composites the **previous rasterisation, scaled**, and
re-rasterises the vector content asynchronously. Until the new raster lands you are looking at old
pixels stretched to a new size: everything is slightly displaced (the vertical mismatch) and
one-pixel features drop out. "It repairs itself" *is* the re-raster landing, and the bigger the SVG,
the longer that takes — which is why more pages feel worse.

**Why barlines specifically.** One wheel notch lands on a *fractional* zoom — measured
`scale(1.00333)` from a single notch, because the wheel curve is continuous
(`ZOOM_WHEEL_K`, `exp(-deltaY·k)`). A 1px barline then straddles two device-pixel columns at ~50%
coverage each. Stems survive because they are thicker; staff lines survive because there are five of
them and losing one is not obvious. A barline is a lone hairline, so it is the first thing to go.

## ⚠️ The verification trap

**`page.screenshot()` forces a synchronous repaint, so headless screenshots CANNOT see this bug.**
Screenshots taken immediately after the wheel event and after settling are identical and both
correct. Any "fix" that is verified by screenshot is unverified. The only reliable check is a human
zooming in a real Firefox window.

Confirmed again on 2026-07-31, and it is stronger than "the transient is invisible": the same score
was screenshotted in **real Firefox and real Chromium**, transform-scaled and SVG-sized, and all
four came out **byte-identical**. A screenshot shows what the browser can draw when forced, never
what it is currently showing. This is why the barline work above needed an in-page instrument
(`__barlines.dump()`) that reports device-pixel geometry rather than pictures.

## Options

### 1. Scale the SVG itself, not the wrapper — the real fix
Set the SVG's `width`/`height` attributes and a `viewBox` instead of a CSS transform. There is then
no cached bitmap to scale: the browser draws vectors at the final resolution, so there is nothing to
repair and nothing to be stale.

- **Cost:** per wheel notch, the SVG is invalidated and re-rasterised on the main thread. No
  engraving work (no VexFlow, no layout, no spacing solve) — rasterisation only.
- **⭐ The pivotal unknown:** is that raster bounded by the **viewport** or by the **whole spread**?
  If viewport-bounded (as browsers normally do), cost is roughly constant no matter how many pages
  exist and this is cheap. If not, wheel-zoom will stutter on big scores. Firefox pays this cost
  today anyway — just late, which is the bug. **Measure before building.**
- **Knock-ons:** the play cursor lives inside the scaled layer and would need screen-space coords
  (`GutterController` already does this by hand — copy that). `scoreContent`'s `p-4` padding would
  stop scaling, and `ViewportHost.readNaturalSize` currently folds that padding into the natural
  size, so the two would have to be separated. VexFlow rewrites `width`/`height` on every render, so
  the scaled values must be re-applied after each one (the existing `MutationObserver` is the hook).
- Hit-testing needs **nothing**: `MouseController.clientToSvg` goes through
  `getScreenCTM().inverse()`, so it reads wherever the SVG actually is.

### 2. Force a repaint when the gesture settles — the cheap mitigation
Debounce ~150ms after the last wheel event, then re-render. Turns "takes long" into "a blink".

- **Cost:** zero while zooming, then one full `renderScore()` — the *expensive* path, VexFlow
  re-engraving and redrawing. Once per gesture rather than per notch, and it lands when the user has
  stopped moving.
- **Does not stop the transient**, only shortens it. The flicker remains on every gesture.

### 3. Clamp wheel-zoom to `ZOOM_LADDER` — nearly free, partial
Snap to `[0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]` instead of the continuous `exp()` curve, so scales stay
device-pixel friendly and fewer hairlines fall in the cracks. Costs nothing and fixes nothing about
the stale raster; it changes how zooming *feels* (steppy, not continuous). A taste decision.

## Do this first

Measure, do not guess. Zoom N notches in Firefox and record frame times, transform-scaled versus
viewBox-scaled, and settle the pivotal unknown in option 1. `__census` (dev only) measures render
cost; the raster cost needs `performance` timings around the zoom step.

## ⛔ Already tried and reverted — do not repeat

**`shape-rendering: crispEdges` on `svg rect`.** It does stop hairlines dissolving, but it snaps
*every* straight edge to whole pixels, so staff-line spacing goes uneven — the user's verdict was
*"really bad and worse than before"*. Any fix must leave the staff lines alone.

> Two measurements since (2026-07-31), because the barline hinting above had to decide whether to
> use it. **A staff is five `<path>`s and a barline is a `<rect>`** — so a rule scoped to
> `g.vf-stavebarline rect` cannot reach a staff line at all, and the recorded unevenness must have
> come from something wider than the selector as written. It was rejected anyway, for a reason that
> has nothing to do with staff lines: **at 25% zoom it erases 9 of 12 barlines**, because it rounds
> a sub-pixel line down to nothing. Hinting in our own code can floor the width at one pixel;
> `crispEdges` cannot be told to.

## Files

- `src/engine/rendering/barlineInk.ts` — the barline's thickness AND its hinting onto the pixel
  grid; `src/dev/barlineCensus.ts` (`__barlines.dump()`) is the instrument for both.
- `src/interactions/ViewportHost.ts` — `applyZoom()`, the single writer of the sizer size and the
  layer transform.
- `src/engine/ViewportModel.ts` — `zoomAbout()`, `ZOOM_LADDER`, `getVisibleRect()`.
- `src/App.ts` — `handleZoomWheel()`, `ZOOM_WHEEL_K`.
- `src/engine/rendering/PagePass.ts` — the spread's size (`surfaceSizePx`), i.e. how big the raster is.
- `docs/zoom-plan.md` §3 — why the transform approach was chosen; option 1 revises it.
