# Linear view — one endless system, and the override rule it forces

**Status (2026-07-13): SHIPPED — P0–P3 and the §4.2b view knob.** Toggle in the palette or
Ctrl+Shift+L. Only **P4 (virtualization) is left, and it is parked on purpose** (see §P4 — linear
view creates the same number of DOM nodes as wrapped, so it is no worse than what already ships).
The phase sections below are kept as written, since they are the reasoning, not just the recipe;
where the build taught us something the phase didn't know, it says so inline.

A second way to *look at* a fragment: a single, endless horizontal system instead of
music wrapped into stacked systems. Sibelius calls it Panorama, Finale calls it Scroll
View, Dorico calls it Galley View, MuseScore calls it Continuous View (horizontal).
Same thing everywhere: you compose left-to-right and forget about layout.

The feature is small. What makes it worth a doc is what it *exposes*: our engraving
overrides are keyed to two different kinds of thing, and only one of them survives a
change of view. Linear view is the first thing that has ever asked the question, and
the answer is Design Principle 3 with a sharper edge on it.

---

## 1. The naming — we already got it backwards

`ViewportModel.ts` currently reserves:

```ts
export type ViewMode = 'galley' | 'pages' | 'continuous-scroll'   // ← wrong, all three
```

with `galley` as the default, i.e. **today's wrapped view is called "galley"**. But galley
view, everywhere in the industry, means precisely the *unwrapped single-line* view we are
about to build. The default is labelled with the name of the thing we don't have.

`pages` is wrong too, and for a better reason: **we don't have pages, and we don't want
them yet.** You work in fragments, not in engraved final scores. But you do want the
wrapped multi-system view. So "pages" isn't the opposite of linear — it's an orthogonal
question we haven't asked.

There are two independent axes hiding in that one enum:

1. **Does the music wrap into systems?** — `linear` vs `wrapped`
2. **If it wraps, is the flow cut into pages?** — scroll vs paged

MuseScore models it exactly this way (*Page view* / *Continuous vertical* / *Continuous
horizontal*), and their "continuous vertical" — systems wrapping, no page boundaries —
**is literally what we ship today**.

**Decision:** the type becomes

```ts
export type ViewMode = 'wrapped' | 'linear'
```

Pagination, if it ever comes, is a **property of `wrapped`** (a casting-off), not a third
sibling. Nothing about pages enters the model until there are pages.

---

## 2. What the industry actually does

Consistent across all four apps, and worth copying wholesale:

- **One system, infinitely wide.** Sibelius: "a single, infinitely-wide strip instead of
  being chopped up into systems and pages" — the view slides left-to-right with no
  disorienting jumps between systems.
- **No justification.** Measures take their intrinsic width. Nothing stretches to fill a
  line, because there is no line to fill.
- **A frozen left gutter.** MuseScore: "even if the starting point is not in view, measure
  numbers, instrument names, clefs, time and key signatures will always be displayed on
  the left of the window." This is the feature that makes the view usable at bar 400.
- **Layout tweaks do not exist here.** Sibelius: "dragging staves in Panorama won't affect
  the layout of the real score." Dorico skips collision avoidance in galley view entirely.
  In both, graphical formatting is a page-view activity, full stop.

That last one is not a limitation they tolerated. It is the correct design, and §4 is why.

## 3. What VexFlow gives us: nothing — and that's fine

VexFlow 5 has no line-breaking, no pagination, no viewport, no culling. `System` merely
stacks staves into one system; it does not wrap. All wrapping is ours, which is why
`MeasureLayout.ts` exists.

The one useful primitive: **`Formatter.format(voices, justifyWidth?)` takes the justify
width as optional.** We always pass one today (`VexFlowRenderer.ts:495`) because we are
justifying to a line. Omit it and VexFlow gives natural, unjustified spacing — exactly
linear-view spacing. And `Formatter.preCalculateMinTotalWidth`, which `MeasureLayout.ts:88`
already calls, *is* the intrinsic width we want to lay out at. The primitive we need is
already in the code, being used for the other purpose.

---

## 4. The override rule (the heart of this doc)

### 4.1 The one real danger is a *write*, not a read

First, the good news, verified in the code: `reconcileSegmentShape`
(`engravingOverrides.ts:73`) and `reconcileSegmentEndpointOffset` (`:119`) are **pure and
read-only**. Staleness is re-decided fresh on every render and never written back — the
doc comments say so on purpose. So rendering at `spanCount = 1` (which is what linear view
is) *ignores* stale middle-segment cps without erasing them. Switch back to wrapped and
every slur shape is still there. That was designed for this, and it holds.

The danger is elsewhere, and it is precise:

> `staffSystemSpacingKey(staffId, openingMeasureId)` is **already keyed to a layout
> artifact**. In linear view there is one system, and it opens at measure 1 — so a staff
> drag in linear view would resolve to `staffId@m1` and **silently overwrite the spacing of
> wrapped view's first system**.

One write path. That is the entire risk surface, and gating it is the entire fix.

### 4.2 The rule

Not "linear view ignores overrides" — too blunt; that would discard rest shifts and hidden
rests, which are *musical* facts that already travel through the clipboard. The rule falls
out of how each key is shaped:

> **Linear view reads every override keyed to MUSIC, ignores every override keyed to a
> SYSTEM, and writes nothing view-scoped.**

"View-scoped" earns its place in that sentence. Linear view changes exactly one thing
about how music is drawn: **horizontal spacing**. So an override is safe to *write* from
linear view iff its meaning is independent of horizontal spacing — and the existing
clients split cleanly on that test:

- `restShift` / `restHidden` are position-keyed and **vertical-only**. They mean the same
  thing at any measure width, so their gestures (↑/↓ nudge, Ctrl+Shift+H) stay live in
  linear view. Writing them there is not a leak; it is editing the notation.
- Slur `curveShape` / `endpointOffset` are **2-D shapes relative to endpoints whose
  horizontal span differs between the views**. A shape tuned against unjustified linear
  spacing looks wrong once the line is justified. That — not deference to Sibelius — is
  why slur geometry is read-only here.
- Per-system staff spacing is keyed to a layout artifact outright (§4.1): never read,
  never written.

Sorting the existing compartment by that rule:

| Override | Key | In linear view |
|---|---|---|
| `restShift`, `restHidden` | `measureId : voice : beat` | **honour, gestures stay live** — vertical-only, view-independent |
| `curveShape`, `endpointOffset` | slur id, note-anchored | **honour**, read-only — the shape depends on horizontal spacing |
| `segmentCurveShape` / `segmentEndpointOffset` *middles* | slur id + segment (= a system) | **already self-suppress** at `spanCount 1` — free, no code |
| per-system staff spacing | `staffId @ openingMeasureId` | **suppress** on read; **never written** — the key names a system, and linear view has none |

(Suppressing it leaves linear view with *no* way to move a staff vertically at all. §4.2b is the
missing category that fixes that: the gesture stays, and writes a **view knob** instead.)

This is a restatement of **Design Principle 3** one level up: the model holds no layout —
*and an override keyed to a layout artifact is not a model fact either.* It is a fact about
one particular casting-off. It has meaning only inside the view that produced it.

### 4.2b The third category: a *view knob* is not an override at all — **SHIPPED**

The table above sorts everything into "musical fact" or "layout artifact", and staff spacing
lands in the second bucket — so linear view forbids the gesture, and you end up unable to move
a staff there at all. That is too strict, and it is too strict because the table is missing a
category.

Wanting the staves closer together while you work is not an engraving decision. It is a
**viewing** decision, in the same family as scroll and zoom: "let me see these two staves near
each other right now." It engraves nothing, and it should persist nothing.

> **A view knob lives on the engine, beside `viewMode` — not in `score`, not in
> `engravingOverrides`, never in `toJSON`.** It is ephemeral: gone on reload, and invisible to
> wrapped view.

This does **not** breach §4.4. That ban is on a second set of *persisted overrides* sitting
beside the wrapped ones — which is a hand-rolled second layout. A transient knob is not that;
it is the same category as `zoom`, which nobody would call an override.

The line to hold: **the moment anyone wants it to survive a reload, it stops being a view knob**
and must go into a real layout scope (§7) — never into a `score.linearStaffSpacing` field. That
wish is precisely the trap §4.4 exists to catch, and it will arrive dressed as a convenience.

Note what this is *not*: it is not the global (`staffId`-keyed) staff-spacing override. That one
is a real, persisted engraving decision that happens to pass §4.2's test (it is vertical-only,
so it means the same thing at any measure width). Writing *that* from linear view is a separate,
defensible option — but it is a different feature, and it is not what a convenience knob is for.

**As built.** `MusicEngine.linearStaffSpacing: Map<staffId, number>`, pushed down to the renderer
exactly like `viewMode`. The gestures are **unchanged** — the same staff drag and Shift/Alt+↑↓ — and
the *engine* decides what they write, so `staffSpacingTarget` still returns `null` in linear view
and §4.1's system-keyed write stays impossible. No undo entry: `commitStaffSpacing` is a no-op
here, because nothing about the score changed. The global (`staffId`-keyed) value remains the
baseline the knob starts from.

The four tests in `MusicEngine.test.ts` are a **tripwire, not coverage**: they assert that the
score, its JSON and the undo stack are all untouched. If one of them ever has to be relaxed, the
knob has stopped being a view knob — go to §7, not to a field on `Score`.

### 4.3 Read-only is permanent, not a phase-1 shortcut

For spacing-dependent geometry, read-only is the correct end state, not a deferral —
§4.2's test can never pass for a shape whose look depends on the casting-off. Sibelius
and Dorico ship exactly this split.

### 4.4 Forbidden

**Never add a parallel override field** — no `score.linearStaffSpacing`, no
`linearSlurShapes`, nothing. The moment linear view gets its own flat overrides sitting
beside the wrapped ones, we have hand-rolled a second layout without admitting it, and the
eventual merge into a real `layouts[]` becomes a reconciliation of two incompatible ad-hoc
scopes instead of a clean split of one.

Linear view **stores nothing view-scoped**. That is what keeps the door open in §7.

---

## 5. Phases

### P0 — Name the axis
- `ViewMode` → `'wrapped' | 'linear'`, and the dead `ViewportModel.viewMode` field is
  **deleted**, not retyped in place. Nothing reads it today (verified — declared at
  `ViewportModel.ts:72`, zero readers), and leaving it there would create a second home
  for the mode the moment the real one exists. `ViewportModel` was also the wrong home
  on the merits: zoom lives there because it never touches layout (a CSS transform);
  wrapped-vs-linear is *precisely* a layout decision, which is engine work.
- **The mode lives on `MusicEngine`** (`setViewMode` / `getViewMode`, forwarded to the
  renderer). Not `EditorState`, and not a `renderScore` parameter: the engine re-renders
  *itself* from five internal call sites that never pass through `RenderController`, so
  a mode held anywhere else goes stale exactly there. Engine ownership is also what
  makes the P2 write guards possible *inside* the engine. It is view state, not score
  data — it must never reach `toJSON`; per-engine (not global) keeps Principle 1 intact.
- Palette toggle + shortcut call `engine.setViewMode(...)` and re-render; the toggle
  also clears any armed slur-handle state (see P2). Default `wrapped`. Not persisted (a
  later, separate choice).

### P1 — The break policy
This is the whole layout change, and it is one function.

- `calculateMeasureWidths(score, effectiveClefs, mode)`:
  - **linear** → *never break* (`lineNumber = 0` for every measure) and *never justify*
    (`finalWidth = minWidth`; skip `distributeLineWidths` entirely).
- Content width becomes `2·margin + Σ minWidth` instead of the hard-coded
  `LAYOUT_CONFIG.CONTAINER_WIDTH: 1000`; `renderScore` resizes the SVG to it.
- Everything downstream already reads `lineNumber` and `finalWidth`, so ties, slurs, staff
  stacking, dynamics and tuplets need **no changes**.
- Cautionary clefs and time signatures self-disable — they are drawn at line breaks, and
  there are none.
- Multi-staff still stacks: linear view is *one system of N staves*.
- The viewport needs **nothing**: the scroll container is already `overflow-auto`
  (App.vue), `ViewportModel` is fully two-axis, and `ensureVisible` — hence
  scroll-into-view and playback-follow — already works on x. Verified, not hoped.

**P1 alone yields a working, scrollable single-line score.**

### P2 — The override policy (§4)
- **Suppress the system-keyed staff-spacing read — it is a one-liner.**
  `staffSpacingLayout` passes `openingMeasureId: undefined` in linear mode, and
  `resolveStaffSpacingAbove` already falls back to the **global** per-staff value. Nice
  consequence: global staff spacing (keyed by `staffId` alone — a content entity, not a
  system) stays honoured in linear view, exactly as §4.2 prescribes.
- **Guard the write inside the engine**, not only at the gestures. It collapsed to ONE line:
  every staff-spacing path (nudge / reset / preview / the drag's baseline read) resolves its
  key through the private `staffSpacingTarget`, so that resolver returns `null` in linear
  mode and refuses all four at the source. This is the defense in depth P0's engine-owned
  mode buys — the one dangerous write path (§4.1) cannot be reached even if a gesture site
  is missed.
- Gate the gestures on top (UX, not the safety layer): no slur handles rendered — which, since
  handles enter the hit-test registry *as a side effect of being drawn*, is also what makes
  them ungrabbable.
  *(P2 also forbade the staff drag outright, leaving linear view unable to move a staff at all.
  §4.2b is the missing category that fixed it: the gesture is back, and now writes an ephemeral
  view knob instead of a system-keyed override.)*
- **The view toggle clears armed slur-handle state** (`selectedSlurEndpoint`,
  `selectedSlurSegmentEndpoint` + `selectedSlurSegmentSpanCount`). Otherwise: arm an
  orange join in wrapped view, switch to linear, press an arrow — and a segment override
  is written from inside linear view with a wrapped-captured span count. Not rendering
  handles only stops *new* arming; it does not disarm.
- `restShift` / `restHidden` gestures stay live — vertical-only, position-keyed,
  view-independent (§4.2).

### P3 — The frozen gutter
Clef, key, meter and instrument name **in force at the current scroll-x**, pinned to the
left edge.

- Draw it into a **second, DOM-pinned SVG**, not into the score SVG at `scrollX` — so
  scrolling never triggers a score re-render.
- The parts already exist: `getEffectiveClef(measure, staffId)` and the meter in effect.
  The gutter is a note-less VexFlow `Stave`.
- Zoom is a CSS transform on the score surface; the pinned gutter SVG sits **outside**
  that layer, so it must apply the zoom scalar itself.

**As built** — and the four things the plan above did not know:

- **No meter.** The music draws its own wherever it changes; repeating it in the gutter is noise.
  It shows the **clef**, the **system connector** (with >1 staff — once the system's opening has
  scrolled away, that line is the only thing still saying "these staves are one system"), and the
  **bar number** (the clef says *what* you are reading; the number says *where you are*, which is
  the harder question in an endless system).
- ⚠️ **Read the music at the gutter's RIGHT edge, not the viewport's left edge.** The gutter is
  opaque and covers the leftmost `GUTTER_WIDTH` of music, so the layout-x under the viewport's left
  edge is music you *cannot see*: a barline slides under the gutter and hides there while the
  gutter still names the bar before it. The clef and bar number lag by a gutter's width of
  scrolling. The first **visible** music is the honest answer.
- ⚠️ **`StaveConnector` draws at the stave's own x.** A gutter stave at x=0 puts the system line
  half outside the viewBox, where it is clipped to nothing — hence `GUTTER_INSET`. (The score never
  hits this: its staves start at the margin.)
- The screen↔layout mapping lives in **`interactions/GutterController`**, not in the Vue
  composable. It is the one real piece of logic in the feature — the mapping CSS gives the score
  for free (`layoutX = scrollX/zoom − padX + GUTTER_WIDTH`, `screenY = (padY + layoutY)·zoom −
  scrollY`) — and a framework port must not have to rewrite it.

Look: the divider is **white**, because a dark rule across a staff reads as a *barline* — an
engraved mark where the music has none. The ink is blue (`#1D4ED8`), Sibelius-style, and
deliberately **darker than voice 1's `#3B82F6`** so a gutter clef can never be misread as
voice-coloured notation. The gutter's white tracks the score SVG's own vertical bounds, so the two
whites read as one sheet of paper.

### P4 — Virtualization — **deliberately out of scope**

*Virtualization = draw only the bars you can actually see.* Today every keystroke re-lays-out and
re-draws the **whole** score: at 1000 bars, 992 of them are SVG nodes sitting off-screen that the
browser still has to carry. Virtualizing means drawing the screenful in view, discarding the rest,
and re-drawing as you scroll — the score behaves as if it is all there, but only a windowful ever
exists. (Same trick as a long chat list or a big spreadsheet.)

We already pay that full re-layout and full-score draw on *every keystroke*, in wrapped view.
Linear view creates the **same number of DOM nodes**, merely arranged wide instead of tall — so it
is **not worse than what ships today**. It only makes the existing waste more *visible*.

Virtualization is real work and a **separate** piece: `ElementRegistry` — our authoritative
hit-test map — is populated *as a side effect of drawing*, so culling a measure would erase
its geometry. Doing it properly means splitting geometry into two tiers:

1. **measure-level** geometry (x/width/y for *all* measures — in linear view just a prefix
   sum over intrinsic widths, and cheap), and
2. **element-level** geometry (noteheads, accidentals, handles) only for *drawn* measures.

Almost everything that needs offscreen geometry (selection, scroll-into-view,
playback-follow) needs only tier 1. When we do it, it speeds up **both** views — which is
exactly why it should not be tangled into "make it linear".

**Accepted limit until then:** at ~150px/bar a 1000-bar score is a ~150,000px-wide SVG.
Fine for fragments. Hitting that wall is the forcing function for P4.

---

## 6. What we are NOT building

- No pages, no casting-off, no page breaks (§1).
- No parallel override fields (§4.4).
- No virtualization (§P4).
- No note-spacing stretch knob in P1 — measures use bare intrinsic width. Sibelius and
  MuseScore both have such a knob because bare intrinsic spacing reads as cramped; add it
  **only if it actually looks tight**, and then as a view setting, never as score data.

## 7. Why this doesn't paint us into a corner

The Dorico model is `content → N layouts`, each layout owning its own casting-off *and its
own graphical overrides*. We will need that anyway the moment we extract **parts** — and
`instruments-plan.md` has already established instruments/staves as two axes joined by a
positional lane map. Layouts are simply the third axis.

Today, `score.engravingOverrides` **already means** "the wrapped layout's overrides" — it
just doesn't say so. That is the same unnamed-implicit-scope bug as the late `Score.keySignature`.
Migrating to the Dorico model is therefore mostly the act of *naming a scope that already
exists*: thread a `layoutId` through the ~8 accessors in `engravingOverrides.ts` (every key
is minted by a pure, named function, so the compiler finds every call site), and the
override *values* and *anchors* never change. There is no data migration — no users, no
legacy JSON.

Under that model, **linear view is just "a layout with no casting-off"** and needs no
special-casing at all.

That stays true **only** while linear view writes nothing view-scoped (§4.4). Break that
and the rename becomes a reconciliation.
