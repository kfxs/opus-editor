# Barlines vanish while zooming in Firefox (stale raster)

**Status:** diagnosed, not fixed. Written as a handoff — everything below was measured, not assumed.

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

## Files

- `src/interactions/ViewportHost.ts` — `applyZoom()`, the single writer of the sizer size and the
  layer transform.
- `src/engine/ViewportModel.ts` — `zoomAbout()`, `ZOOM_LADDER`, `getVisibleRect()`.
- `src/App.ts` — `handleZoomWheel()`, `ZOOM_WHEEL_K`.
- `src/engine/rendering/PagePass.ts` — the spread's size (`surfaceSizePx`), i.e. how big the raster is.
- `docs/zoom-plan.md` §3 — why the transform approach was chosen; option 1 revises it.
