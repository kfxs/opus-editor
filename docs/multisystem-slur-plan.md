# Multi-system slur plan

**Goal:** Draw a slur correctly when its two endpoints fall on different lines
(systems), for **any** number of crossed systems — and fix the existing 2-line
bug as a side effect.

Status: PLANNED. Touches only `src/engine/rendering/SlurRenderer.ts` (+ a one-line
type widening in `ElementRegistry.ts`). No model/JSON/interaction changes.

---

## 1. The two problems (one root cause)

The cross-system branch in `renderSlurs` (`SlurRenderer.ts:216–243`) draws exactly
**two** half-arcs and anchors each to the **endpoint note's own measure**, not to
the **system** the note sits on:

```ts
const fromStave = fromNote.getStave()        // start note's MEASURE
const toStave   = toNote.getStave()          // end note's MEASURE
const rightEdge = fromStave.getNoteEndX()    // → right edge of that ONE measure
const leftEdge  = toStave.getNoteStartX()    // → left edge of that ONE measure
```

Consequences:

- **2-line bug (reported):** the leading half on the end line runs from the *end
  note's measure* left edge — not the system's left margin. If the end note isn't
  in the first measure of its line, the arc only covers that one measure ("it only
  shows in the last measure"). The trailing half looked fine only by luck (the
  start note happened to sit in the last measure of its line, so its measure's
  right edge equalled the system's right edge).
- **3+ line gap:** the code emits only a BEGIN piece and an END piece. Any **full
  system the slur merely passes over gets nothing** — the slur visually vanishes on
  middle lines.

Both are the same mistake: *measure* edges instead of *system* edges, and a hard
assumption of exactly two pieces.

## 2. Target model — one segment per system (industry standard)

MuseScore / Dorico / LilyPond model a slur as one logical span sliced into **one
segment per system**, each tagged `SINGLE / BEGIN / MIDDLE / END`:

| Segment | When | Geometry |
|---|---|---|
| `SINGLE` | start & end on the same line | start note → end note (today's same-line path — **unchanged**, keeps override + drag handles) |
| `BEGIN`  | first crossed line | start note → **right edge of that system**, open/flat right end |
| `MIDDLE` | every full line in between | **left edge → right edge of that system**, both ends open — a full-width bow |
| `END`    | last crossed line | **left edge of that system** → end note, open/flat left end |

A slur crossing N systems draws `BEGIN` + (N−2)×`MIDDLE` + `END`.

**Gould rule (`Behind Bars`):** each open end must read clearly open-ended (run
out roughly flat / angled away from the staff), "or each side of the system break
will appear to take a separate slur." Perfect apex-height matching across the break
is *not* required for v1 (MuseScore itself only added contour controls later — see
§6).

## 3. Data already available on `RenderPass`

No new plumbing needed:

- `pass.measureLayoutInfo: Map<measureNumber, { lineNumber, … }>` — which line a
  measure landed on.
- `pass.measureBounds: Map<measureNumber, { measureY, noteStartX, noteEndX, … }>` —
  each measure's rendered edges + stave Y.
- `pass.staveNoteMap` — to fetch a representative `StaveNote` (hence a live
  `Stave`) on a middle line for its vertical reference.

Helpers to derive **system** edges from these:

```ts
// last measure on `line` → its noteEndX  (system right margin)
function lineRightEdgeX(pass, line): number | undefined
// first measure on `line` → its noteStartX (system left margin)
function lineLeftEdgeX(pass, line): number | undefined
// any rendered StaveNote on `line` → its Stave (for middle-segment Y + staffSpace)
function representativeStaveOnLine(pass, score, line): Stave | undefined
```

(Each scans `measureLayoutInfo` for measures with the matching `lineNumber`, then
reads `measureBounds` / `staveNoteMap`.)

## 4. Implementation (Phase 1 — the fix)

Refactor `renderSlurs` so the cross-system branch loops over `line = fromLine …
toLine`, building one segment per line via the pure `planSlurSegments` helper (§5)
and drawing each with the shared `drawCurveArc(...)`. Keep the existing
`fromLine === toLine` branch verbatim (SINGLE — it owns the override + handle
registration; multi-system gets neither, exactly as today).

**Curve ctor note:** `Curve.renderCurve` uses only the explicit
`firstX/firstY/lastX/lastY/direction` it's handed — it never reads the `from`/`to`
notes passed to the `Curve` constructor (those are used only by `Curve.draw()`,
which `drawCurveArc` never calls). So every segment can pass the slur's own
`fromNote`/`toNote` to `drawCurveArc`; no per-line "representative note" is needed
for the draw. (A representative stave is still useful for the MIDDLE baseline Y —
or derive that Y from `measureBounds.measureY` of any measure on the line, in
staff-spaces, which avoids the `staveNoteMap` lookup entirely.)

Per line, build a segment with explicit endpoint geometry, draw it with the shared
`drawCurveArc(...)`, and register it as a partial:

- **BEGIN** (`line === fromLine`):
  - `firstX = fromNote.getTieRightX()`, `startY = fromY + LIFT*dir`
  - `rightX = lineRightEdgeX(fromLine)`, apex `= startY + ARC*dir`
  - draw `(firstX,startY) → (rightX,apex)`; register `partialType: 'end'`.
  - (This is today's "trailing half" but anchored to the **system** edge.)
- **MIDDLE** (`fromLine < line < toLine`):
  - baseline Y = `measureBounds.measureY` of any measure on `line`, offset on the
    slur's side (`dir`) by a fixed staff-space amount (resolution-stable, matching
    the engraving-overrides staff-space convention) — or read it off
    `representativeStaveOnLine(line)` if a real `Stave` reference is handier.
  - `leftX = lineLeftEdgeX(line)`, `rightX = lineRightEdgeX(line)`, both ends at the
    baseline Y → a symmetric full-width bow via `slurArchCps`.
  - register `partialType: 'middle'`.
  - pass the slur's own `fromNote`/`toNote` to `drawCurveArc` (see the Curve ctor
    note above — `renderCurve` ignores them; geometry comes from the explicit X/Y).
- **END** (`line === toLine`):
  - `leftX = lineLeftEdgeX(toLine)`, apex `= endY + ARC*dir`
  - `lastX = toNote.getTieLeftX()`, `endY = toY + LIFT*dir`
  - draw `(leftX,apex) → (lastX,endY)`; register `partialType: 'start'`.
  - (Today's "leading half", anchored to the **system** edge.)

All segments stay inside the one `openGroup('vf-slur', …)` wrapper (scoped
highlight) — unchanged. `direction`, voice logic, `nestLift`, stem-aware endpoint
Y (`slurEndpointY`) all stay as-is.

### Type change
`ElementRegistry.ts:161` — widen `partialType?: 'start' | 'end'` to
`'start' | 'end' | 'middle'`. (Grep confirms `partialType` is currently only
*written*, never switched on, so this is safe; `'middle'` is informational for
hit-testing/debug parity.)

## 5. Tests

> ⚠ **There are no existing `renderSlurs` render-level tests** — slur coverage today
> lives in `utils/slurs.test.ts`, `engravingOverrides.test.ts`,
> `MouseController.test.ts`, and `MusicEngine.test.ts`, none of which drive the
> renderer. And testing the rendered output directly is heavy: `drawCurveArc`
> constructs a VexFlow `Curve` and drives many `ctx` calls, so a render test needs a
> mocked context **plus** `StaveNote` stubs (`getTieRightX/getTieLeftX/getStave/
> getYs/getStemDirection/getStemExtents`). So we test the **decision**, not the draw.

**Extract the segment planning into a pure function** (do this as part of Phase 1, not
just for tests — it also keeps `renderSlurs` readable and matches the engine's
free-function idiom):

```ts
// Pure over RenderPass lookup data — no VexFlow, no ctx, no StaveNote.
type SlurSegment =
  | { type: 'single' }                                  // same-line; draw note→note
  | { type: 'begin';  firstX: number; rightX: number }  // start note → system right edge
  | { type: 'middle'; leftX: number;  rightX: number; line: number } // full-width bow
  | { type: 'end';    leftX: number;  lastX: number }   // system left edge → end note

function planSlurSegments(
  pass: RenderPass, fromLine: number, toLine: number,
  firstX: number, lastX: number,
): SlurSegment[]
```

`renderSlurs` then loops the returned descriptors and draws each with `drawCurveArc`
(passing the slur's own `fromNote`/`toNote` to the `Curve` ctor — `renderCurve`
ignores them, see §4). The descriptor X coords come from the §3 edge helpers, which
stay pure too.

Tests:

- **Edge helpers** — `lineLeftEdgeX` / `lineRightEdgeX` against a fabricated
  `measureLayoutInfo` + `measureBounds` (e.g. 3 measures on line 0, 2 on line 1 →
  left edge = first measure's `noteStartX`, right edge = last measure's `noteEndX`).
- **`planSlurSegments`** — the heart of the fix, fully testable with no render:
  - `fromLine===toLine` → `[{single}]`.
  - `fromLine=0,toLine=1` → `[{begin}, {end}]` (the reported 2-line bug); assert the
    `end` segment's `leftX` is the **first** measure of line 1's `noteStartX`, not the
    end note's measure edge (this is the regression guard for the original bug).
  - `fromLine=0,toLine=2` → `[{begin}, {middle line:1}, {end}]`; assert the `middle`
    spans line 1's full `leftX→rightX`.
  - `fromLine=0,toLine=3` → `begin + 2×middle + end` (N-system generality).
- Re-run all existing slur tests unchanged (util/overrides/mouse/engine paths must
  not regress; the SINGLE branch is preserved verbatim).
- `npm run test` + `npm run build:check` + `npm run lint:boundary` green.

**Manual check (no code change):** click a **middle-line** bow of a 3+ system slur and
confirm it selects the whole slur and highlights all segments. The design already
supports it — every segment registers under the same `slur.id` and lives in one
`slurGroupMap` `<g class="vf-slur">` group — but middle segments are new, so it's
worth eyeballing once.

## 6. Deferred (Phase 2, optional polish)

Not needed to fix the bug; mirrors features pro tools added *after* the basic split:

- **Open-end slant modes** — MuseScore's "Follow contour of notes" vs "Angle away
  from staff." v1 uses the simple apex-from-pitch end; this would compute the open
  end's slant from the notes on that line.
- **Matched apex heights** across the break so the pieces read as one continuous
  arc (MuseScore's known rough edge — open ends currently depend only on the first/
  last note pitch).
- **Per-segment drag handles** (double-click one piece, edit just it). Today only
  SINGLE slurs get handles; multi-system get none, which Phase 1 preserves.

## 7. Sources
- Gould, *Behind Bars* — open-ended slurs at system breaks (via NOTATIO forum:
  https://www.notat.io/viewtopic.php?p=6790).
- MuseScore handbook — partial slurs across breaks (contour vs angle-away):
  https://handbook.musescore.org/notation/expressive-markings/slurs-and-ties
- MuseScore — slurs span systems/pages as per-system segments:
  https://musescore.org/en/node/85 · behaviour at line breaks:
  https://musescore.org/en/node/166071
- LilyPond internals — Slur (per-system spanner pieces):
  https://lilypond.org/doc/v2.23/Documentation/internals/slur
