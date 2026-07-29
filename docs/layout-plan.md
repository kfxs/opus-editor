# Layout — the surface the music is drawn on

**Status: P0 BUILT (2026-07-29); P1–P2 planned.** Infrastructure first. The layout object is expected
to grow for a long time; this doc builds the *seam* it grows in, and the smallest possible first
occupant (an A4 page). The seam exists and is a no-op — `SKETCH_CANVAS` draws exactly what the editor
always drew. Nothing yet offers a page: `A4_NORMAL` resolves correctly and nothing sets it.

---

## 1. What we have today, named honestly

`LAYOUT_CONFIG` (`engine/rendering/layoutConfig.ts`) is eleven numbers, and they are **two different
kinds of thing**:

| | | kind |
|---|---|---|
| `CONTAINER_WIDTH` 1000, `MARGIN` 20 | | ⚠️ **a surface** — a page in all but name |
| `MIN_NOTE_SPACING` 18, `MIN/MAX_MEASURE_WIDTH` 100/400 | | engraving |
| `CLEF_WIDTH` 45, `CLEF_CHANGE_WIDTH` 30, `TIME_SIG_WIDTH` 30, `BARLINE_PADDING` 10 | | engraving |
| `STAVE_HEIGHT` 120, `VERTICAL_SPACING` 30 | | staff size + system gap |

The other nine exist whether or not there is a page — they are how music is engraved *on a line*, and
this plan does not touch them. Only the top two are a surface, and they are read from **ten sites in
five modules** (named by symbol, not line — line numbers rot):

| module | site | reads |
|---|---|---|
| `MeasureLayout` | `calculateMeasureWidths` | `margin` + `availableWidth` — **the casting-off** |
| `engine/layout/barWidthRoom` | ×3 (`lineFills`, the alone/can't-pay branch, `authoredScales`) | the justified line's total |
| `VexFlowRenderer` | `renderScore`'s `contentWidth` (×2 — the linear floor and the wrapped width) | the surface width |
| `VexFlowRenderer` | `renderScore`'s `margin`, `staffSpacingLayout`'s `margin` | left/top origin, total height |
| `GhostRenderer` | `drawNoteGhost` | the ghost's origin (the **only** ghost drawer that reads one) |
| `engine/export/scoreSvg` | `renderScoreSvg` ×2 (host style, `initialize`) | the export's surface |

⚠️ And **four readers that do not import `LAYOUT_CONFIG` at all**, which is the same disease one stage
worse — a page width nothing owns, written out as a literal:

- `layoutConfig.ts`'s own **`VIEWPORT_HEIGHT`**, derived as `VIEWPORT_LINES × stride + MARGIN × 2`.
- `MusicEngine`'s `config.width || 1000`, `App.ts`'s `new MusicEngine({ width: 1000 })`, and
  `e2e/harness.ts`'s ditto — the SVG element's *initial* size, overwritten by the first render.

`VIEWPORT_LINES` / `VIEWPORT_HEIGHT` are meant to be a third thing again — the size of the **scroll
box you look through**, independent of all of this. That is exactly why the `MARGIN` in that formula
is wrong and P0 cuts it: how much padding a *page* has is no business of how tall the scroll box is.

**So the app is already half-paginated.** Horizontally it casts off against a width; vertically it
stacks systems forever. Today = *an endless roll of paper 1000 px wide.* That is a perfectly good
mode — it just isn't "no layout", and 1000 px isn't any paper size.

## 2. The distinction: a CANVAS is not a PAGE

Two kinds of surface, and the toggle picks one.

**Canvas — for sketching.** A width to wrap at, and nothing else. It is not paper: you are working on
the music, not on how it will be published.

**Page — for publication.** A physical sheet: size and margins in millimetres, cast off into pages.

⭐ **The invariant that keeps them apart: a canvas has no physical size.** *"How many mm wide is the
canvas?"* must have **no answer**. Everything publication-shaped — page numbers, title block,
odd/even margins, staff size in mm, vertical justification — is reachable only through the page kind.
This is the rule whose absence caused the mess above: a "container width" that nothing owned and
nothing forbade quietly became a page width.

|  | **canvas** (today) | **page** |
|---|---|---|
| width | a number, meaning nothing physical | A4 210 mm − margins |
| height | **none** — stack forever | 297 mm, cast off into pages |
| what you see | one endless column | page rectangles, one after another |
| PDF | unchanged: one tall page at 72/96 | N real A4 pages at real size |

**Linear view is already a canvas** — `renderScore` sets `contentWidth = max(CONTAINER_WIDTH,
Σ widths)`, i.e. a canvas whose width policy is *"as wide as the music"*. Structurally it is already
outside this plan in the one place that counts: `calculateMeasureWidths` returns early into
`calculateLinearMeasureWidths` **before** it reads the surface at all, so no linear bar's width or
line is cast off against one.

⚠️ But that `max(…)` **floor** is a surface read, and it is where "ignored in linear view" can leak: a
page surface would quietly raise the floor from 1000 to 1029 px on a toggle that is supposed to do
nothing here. So the rule is *resolve, then read* — see P1.5. That is why
`linear-view-plan.md` §1's rule ("pagination is a property of `wrapped`, never a sibling") stops being
a rule to remember and becomes structural: a page is a *surface kind*, linear is a *canvas width*, and
"linear + pages" is unsayable rather than merely discouraged. P0 does **not** unify linear into the
union — it only makes sure the shape can hold it later.

## 3. Where it lives: nowhere. It is a PAIRING, not a containment

`PageLayout` is a **value**, of the same species as `Clip` (`utils/clip.ts`): first-class, in the
core, naming nothing outside itself. `pasteEvents(clip, target)` pairs a clip with a score at the
moment of use and the pairing evaporates; a surface is used the same way — the render *receives* it.

- **Not in `Score`/JSON.** Principle 3 forbids page layout in the data model.
- **Not in a document object that owns both.** No `Document { score, layout }`, no root that rules
  the workflow. Many objects may exist later; none of them should have to be unwound.
- `MusicEngine` **holds** the surface currently in use, exactly as it holds `viewMode` — a session
  convenience and one replaceable field, not an ownership edge.

⛔ **Forbidden shapes**, each of which is the hierarchy sneaking back: `score.layout`,
`layout.scoreId`, `Document { score, layout }` — and the *phrase* **"the layout of the score"**. The
possessive is the bug. It is *"the surface this render is using"*.

**What this consciously gives up:** nothing remembers which layout a score was seen through, so page
settings do not survive a reload. That is the tension `DESIGN-PRINCIPLES.md` boundary case 1 holds
open (LilyPond and MuseScore both *save* their layout with the document). We take **"no home yet"
over "the wrong home"** — the wrong home being the hierarchy. When the pairing must persist, a layout
serializes as *itself* and whatever holds both decides how to record the pair.

### 3a. The debt boundary case 1 asks us to pay first

That entry does not merely hold the tension open, it gives an instruction: *"Do not add a second
document-wide look setting without settling this; two of them arriving by different routes is how the
compartment stops meaning anything."* Page size and margins **are** that second setting, and they
arrive by the *same* route the first one took (`justifyLastLine`: renderer field + `EditorState`
mirror + `layoutStateKey`). The entry's own list of what the future engraving object would hold —
*"page size, margins, staff size, ragged-last"* — is this plan's §7 and `justifyLastLine` in one
breath. So they are not two things arriving by two routes; they are members of one object, and one of
them is being built.

**Settled, and P0 writes it down:** `Surface` **is** that engraving object's first member. It stays
session-only for the same reason ragged-last does (no home yet, not the wrong home), and
`justifyLastLine` folds into it the day either one has to persist — not before, since folding it now
would buy nothing and change a shipped toggle. P0 amends boundary case 1 to say exactly this, so the
entry records that the second setting arrived deliberately and where it will land. ⛔ What is *not*
allowed is a third arriving quietly; that is what the entry is for.

## 4. Units — millimetres, resolved to pixels once

The whole industry measures layout in staff spaces and converts once: MusicXML carries every distance
in *tenths* (1/10 staff space) plus one `<scaling>` element mapping them to mm; MuseScore's unit is
`sp` at 1.75 mm; Verovio takes pages in 1/10 mm.

We never override VexFlow's `STAVE_LINE_DISTANCE`, so **1 staff space = 10 px** everywhere. With
MuseScore's 1.75 mm/sp that is one constant:

```
PX_PER_MM = 10 / 1.75 ≈ 5.714
```

A4 at 15 mm margins then lands at **1029 px** of content width against today's 960 — 7.1%, so
turning layout on does **not** re-flow the score into something unrecognisable. Page height 1697 px,
text block 1526 px, ≈ **10 systems per page** at the current 150 px system stride. Sane on all counts,
which is what makes a first version cheap.

⚠️ Canvas width and **zoom** are both "size" and are not the same knob: canvas width re-casts the
music (bars move between systems), zoom is a CSS transform on the layer and re-casts nothing.

## 5. The seam

One union in, one flat shape out. The union is what you author and toggle; the flat shape is what the
ten call sites consume, so **no call site branches on the kind**.

```ts
// engine/layout/surface.ts  — core, no DOM, no renderer
type Surface =
  | { kind: 'canvas'; widthPx: number; marginPx: number }
  | { kind: 'page'; layout: PageLayout }

interface PageLayout {
  page:    { widthMm: number; heightMm: number }      // A4 = 210 × 297
  margins: { topMm; bottomMm; leftMm; rightMm }       // "normal" = 15
}

interface SurfaceMetrics {
  widthPx: number                                       // the SVG's width; the sheet, if it is one
  /** ⭐ `null` IS "no page": never break vertically — and "is this paper?" is this and only this. */
  heightPx: number | null
  marginTopPx, marginBottomPx, marginLeftPx, marginRightPx: number
  contentWidthPx: number                                // widthPx − left − right
  /** The room BEFORE a break — what the page cast-off works in. */
  contentHeightPx: number | null
}

resolveSurface(surface: Surface): SurfaceMetrics
```

Two exported defaults: `SKETCH_CANVAS` = `{ kind: 'canvas', widthPx: 1000, marginPx: 20 }` — today's
numbers verbatim — and `A4_NORMAL`.

⚠️ **Why the metrics carry `contentHeightPx`, and why margins are named per edge.** Both are the same
mistake avoided twice. A `PageLayout` has *four* margins; a single `marginPx` is only ever right by
coincidence (`A4_NORMAL` is 15 mm all round), and the coincidence would hold right through P0 and
break the moment anything asks for a wider inner margin. And the cast-off does not ask "how tall is
the page" — it asks **"how much music fits before I break"**, which is the page minus its top and
bottom margins. Publish the height alone and `pageCastOff` has to subtract them itself, i.e. reach
back into `PageLayout` and branch on the kind — the one thing the flat shape exists to stop.

⭐ There is no separate `pageWidthPx`/`pageHeightPx`: **`widthPx`/`heightPx` ARE the sheet when there
is one**, which is what `PagePass` draws (P1.2) and what PDF asks in mm (P2). Two more fields holding
the same numbers would only invite the question "which of these is the real one?".

A canvas resolves to `heightPx: null` and `contentHeightPx: null` — the invariant of §2 expressed as a
type. *"How many mm wide is the canvas?"* has no answer because there is no field holding one.

## 6. Phases

### P0 — the seam, with nothing visible changed — ✅ **DONE**

The whole infrastructure, and provably a no-op: the canvas resolves to the numbers we ship today.

**Built as written.** 2660 unit tests and all 35 browser-geometry tests green with no expectation
changed — including `pdfExport.e2e`, which draws the export's own render through the new surface
argument. Two things the build corrected on the plan: the A4/canvas content widths differ by **7.1%**,
not "within 7%" (the `surface.test.ts` bound says 7.2 and shows the measured figure), and
`SurfaceMetrics` publishes `widthPx`/`heightPx` rather than a second `pageWidthPx`/`pageHeightPx`
pair (§5). One pre-existing failure is untouched and unrelated: `lint:testnames` has been rejecting
`interactions/beamTravel.test.ts` (no sibling module of that name) since before this phase.

1. Add `engine/layout/surface.ts` (+ `surface.test.ts`) as above. ⚠️ `engine/layout/`'s charter today
   is *"derived-view arithmetic, off the LAST RENDER"* — both existing members are. A surface is
   authored **input**, not derived, so the same commit widens that line in `ARCHITECTURE.md` and
   `CLAUDE.md`. It still belongs here over `rendering/`: it is core, DOM-free, and the width math that
   consumes it is already next door.
2. `MusicEngine` holds a `Surface` (default `SKETCH_CANVAS`) and pushes it to the renderer, exactly
   as `setViewMode`/`setJustifyLastLine` do. The renderer resolves it once per render and threads
   `SurfaceMetrics` to the ten call sites, which stop importing `LAYOUT_CONFIG`. Two of the three
   receiving signatures already take an options object (`barWidthRoom`, called from `MusicEngine`
   which holds the surface; `drawNoteGhost` gains one parameter beside `StaffSpacingLayout`).
   `calculateMeasureWidths` does not, and would reach **six positional parameters** — it takes an
   options object in this phase rather than a sixth `, metrics`. (Built: `MeasureWidthOptions`
   `{ mode, cache, justifyLastLine, surface }`, ~60 call sites across 8 specs converted
   mechanically. `staffSpacingLayout` reads the renderer's own surface rather than growing a third
   parameter — the ghost path calls it independently.)
3. **The export gets the surface as an argument, not by threading.** `renderScoreSvg` builds its
   *own* `VexFlowRenderer` and hard-codes `initialize(CONTAINER_WIDTH, …)`, so it is not downstream
   of the engine's renderer and P2 has no way in unless P0 makes the surface a parameter of it.
   It passes `SKETCH_CANVAS` today, which is the no-op.
4. `CONTAINER_WIDTH` and `MARGIN` leave `LAYOUT_CONFIG` for `surface.ts`, so nobody can read a page
   dimension out of the engraving constants again. Two consequences, both to be done and not worked
   around:
   - **`VIEWPORT_HEIGHT` gets its own constant** for the scroll box's padding. ⛔ It must NOT import
     `SKETCH_CANVAS.marginPx` — that would re-tie the viewport to the surface by the back door,
     one import after we cut it (§1).
   - The three literal `1000`s (`MusicEngine`'s `config.width` default, `App.ts`, `e2e/harness.ts`)
     read `SKETCH_CANVAS.widthPx`, or the doc comment beside them says plainly that they size the
     **SVG element** before the first render and are not a surface. (Built: `MusicEngine` defaults
     from `SKETCH_CANVAS.widthPx`; `App.ts` and `e2e/harness.ts` simply stop passing a width, so the
     literal exists once in the codebase. `SKETCH_CANVAS` is `as const satisfies Surface` so its
     members stay readable without narrowing the union.)
5. **The surface joins `layoutStateKey()`** — flipping it must re-cast the score. The renderer already
   asks for this in a comment on `layoutStateKey` ("add it here the day it becomes settable, along
   with page dimensions"). The per-lane `MeasureWidthCache` needs nothing: it memoises intrinsic note
   space, which no surface can change.
6. Amend `DESIGN-PRINCIPLES.md` boundary case 1 per §3a.

**Done when:** the full suite and the E2E geometry suite are green with no expectation changed.
⚠️ *No expectation* changed, but files do: five specs compute `AVAILABLE = CONTAINER_WIDTH − MARGIN*2`
(`MeasureLayout.barWidth` / `.raggedLastLine` / `.noteSpacing`, `barWidthRoom.test`,
`MusicEngine.barWidthNudge`) and move their import to `surface.ts`. Same numbers, same assertions.

### P1 — the page kind

1. `engine/layout/pageCastOff.ts` (+ spec) — takes the per-system heights `staffSpacingLayout`
   already computes (`lineHeightPx[]`, declared on `StaffSpacingLayout`, so the function is pure and
   needs no renderer) plus `contentHeightPx`, and returns `{ pageOfLine[], lineTopPx[] }`.
   `contentHeightPx === null` returns today's single strip. This is the entire vertical algorithm —
   it never reads `heightPx`, which is the sheet `PagePass` draws, not the room the music has.
   ⚠️ One degenerate case to answer in the spec rather than at 3 a.m.: a system taller than a page
   (many staves, or a big staff-spacing override). It takes a page of its own and overflows it —
   never an infinite loop, never a page with no system on it.
2. `engine/rendering/PagePass.ts` — draws the page rectangles behind the music; SVG grows to
   `pages × (pageHeight + gap)`. `ViewportHost` reads the SVG's size to build its scroller, so
   scrolling through pages costs nothing new.
3. A bar that changes page has **moved**, not changed shape — it rides the renderer's existing
   `MOVED` path (translate the group), never `REDRAW`.
4. **`Use layout`** toggle in the dev toolbar's `View:` group, mirrored on `EditorState` as
   `useLayout`, swapping `SKETCH_CANVAS` ↔ `A4_NORMAL`. Same shape as `Justify last`, and the same
   four hops: `devToolbar` → `PaletteController.setUseLayout` → `MusicEngine` → renderer field +
   `layoutStateKey`.
   ⚠️ That makes **three** hand-rolled view toggles on that path (`viewMode`, `justifyLastLine`,
   `useLayout`). By the repo's own rule — *a slice too thin to be logic is still a slice* — the third
   is where a row-in-a-table would normally be due. Called out as a decision rather than left as
   drift: build it as the third toggle, and the fourth one is the table.
5. **Ignored in linear view — resolved, not filtered.** The renderer resolves `SKETCH_CANVAS`
   whenever `viewMode === 'linear'`, before anything reads the metrics, so linear's `max(…)` width
   floor cannot pick up the page width (§2). Filtering downstream instead means every future reader
   has to remember to ask.

### P2 — PDF

- **Layout off: unchanged.** One tall page at 72/96, as today. The canvas has no physical size, so
  the scale is arbitrary and the doc says so plainly.
- **Layout on:** jsPDF at real A4 (`widthPx`/`heightPx` ÷ `PX_PER_MM`), one `addPage()` per
  page, each page a y-translate of the same engraved SVG at `1 / PX_PER_MM` mm per px.
  `pdf-export.md` "### 3. One page, on purpose" already promised this is arithmetic — the systems'
  y-bands come straight from the render, and P0.3 already gave `renderScoreSvg` the surface to render
  through. Its 14400 pt / 200 in refusal stops being reachable under a layout: pages are A4.

One real win falls out: today a staff prints at ~10.6 mm. Under a layout it prints at 7 mm, which is
what an engraver expects.

## 7. Deliberately NOT in this plan

Each is a later iteration on the object, not a gap in it: vertical justification of systems on the
page (pages stay ragged-bottom, LilyPond's default) · a staff-size / scaling control · landscape ·
odd/even mirrored margins · headers, footers, page numbers, title block · manual page breaks (those
are the *positional* half of principle 6 — a break belongs to the measure it happens before) ·
persistence of any of it · more than one layout at a time · pages in linear view.
