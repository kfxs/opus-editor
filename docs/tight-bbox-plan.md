# Plan: General fix for inflated hit-boxes (registry bbox ≠ visible glyph)

> **Status:** proposal / for review, **rev 3**. No code written yet.
> Rev 2 corrects rev 1's root-cause diagnosis after reading VexFlow 5's source:
> the original plan blamed "metrical" VexFlow bounding boxes across the board; the
> real mechanisms are narrower (and cheaper to fix) — see §3.
> **Rev 3** answers the "how is this general for *future* elements we can't measure
> yet?" question: the fix is no longer a one-line rest patch guarded by a written
> convention — it **encodes the rule in the registration path** so a glyph element
> *cannot* be registered from a container-union box, plus a dev tripwire that fires
> when a future glyph box looks like a container union. See §6a and Phase 1.
> **Audience:** written to be read cold by anyone picking this up later. Sections 1–4 are
> background + evidence; Section 5 onward is the proposal and the decisions behind it.

---

## 0. TL;DR

When the user clicks the score, the wrong element is sometimes selected, or a
selection highlight bleeds onto a neighbour. Root cause: some registered clickable
boxes are much larger than the visible ink of their glyph. The flagship case: a bar
containing a whole rest with a forte (`f`) dynamic below the staff registers a
**77px-tall** box for the ~10px rest glyph, and that box swallows clicks aimed at the
dynamic (and at visibly empty space).

**Rev 1 diagnosed this as "VexFlow's `getBoundingBox()` is a metrical layout box, not
ink, for almost every element." That is true of VexFlow 4 but NOT of VexFlow 5**, which
we use. In VF5, `Element.getBoundingBox()` is an *ink* box (canvas `measureText` with
`actualBoundingBox*` metrics). The inflation we observe has three distinct, verified
mechanisms (§3):

1. **Modifier union** — `StaveNote.getBoundingBox()` merges the boxes of every
   *attached modifier* into the note/rest's own box. Our dynamics are attached to
   their anchor StaveNote as `Annotation` modifiers, so **a rest carrying a dynamic
   registers a box that reaches down to the dynamic's ink**. This is the 77px rest.
2. **Hand-built region-sized boxes** — the line-start clef and the time signature are
   registered with *our own* full-stave-height rectangles (`CLEF_WIDTH × STAVE_HEIGHT`),
   not with any VexFlow box. Fine as click targets; wrong as highlight regions.
3. **DOM `getBBox()` pointer-rect union** — reading a rendered group's `getBBox()`
   unions VexFlow's transparent pointer-rects (already bit dynamics; already fixed
   there by rebuilding from the `<text>` ink).

The fix is correspondingly smaller than rev 1 proposed: **register each element by its
OWN glyph's native VexFlow ink box, never by its container StaveNote's modifier
union** (for the rest: `staveNote.noteHeads[0].getBoundingBox()`), and scope the two
remaining region-based highlights to the glyph's own SVG group (the pattern every other
highlight already uses). No DOM reads at registration, no transparent-rect stripping, no
new helper with per-type DOM knowledge.

**The durable rule this plan installs: an element's registered bbox comes from its own
glyph, never from a container that unions separately-selectable children.** Rev 3 makes
that rule *structural, not merely documented* (§6a): glyph-type registrations go through
one **rendering-layer choke point** that reads the glyph object's own ink box, so the
tempting `staveNote.getBoundingBox()` disappears from every glyph site; and the (pure,
VexFlow-free) registry gains a **dev-only tripwire** that warns when any glyph-type box
is implausibly tall for its staff — the forever-audit that catches a *future* element
reintroducing the bug in the browser, where jsdom's zero metrics never could.

---

## 1. What this app is (one paragraph)

A music-score editor: **Vue 3 + Pinia** UI on top of a framework-agnostic **TypeScript
engine**, rendering notation with **VexFlow 5** to an **SVG** canvas. The user clicks
on the rendered score to select notes, rests, accidentals, dynamics, clefs, etc.
Selection, dragging, and highlighting are all **pixel hit-tests** against a registry of
element bounding boxes that is rebuilt on every render.

Layering (dependencies point rightward): `App.vue → composables → interactions →
engine`. The relevant players:

- **`engine/rendering/VexFlowRenderer.ts`** — draws the score with VexFlow and, as it
  draws, **registers** each element's pixel box into the registry.
- **`engine/ElementRegistry.ts`** — the authoritative store of "what is where."
  Every rendered element becomes an `ElementInfo { type, id, bbox, … }`. Hit-testing
  lives here (`findClosestNoteOrRest`, `hitsNoteOrRestBody`, `getByType`, …).
- **`interactions/MouseController.ts`** — turns a raw mouse event into a selection. On
  mousedown it runs a **priority-ordered list of per-type hit-tests** against the
  registry (clef, timeSignature, tempo, dynamic, tie, slur, accidental, articulation,
  dot, then note/rest) and selects the first that claims the click.
- **`interactions/HighlightController.ts`** — recolours the selected element's SVG.

Key invariant: **the registry is the single source of truth for hit geometry.** If a
box in it is wrong, *everything* downstream (selection, distance, highlight, caret
position, text-overlay placement) is wrong in the same way.

---

## 2. How a click becomes a selection (the data flow)

1. `MouseController.handleMouseDown` maps the event to SVG coords `(x, y)` and builds a
   `ctx` that includes `closestElement = registry.findClosestNoteOrRest(x, y)`.
2. It runs the per-type handlers in priority order (`MouseController.ts:458-470`). Each
   does a **padded box-containment test** against that element type's registered
   `bbox`, e.g. the dynamic handler (`MouseController.ts:945`):

   ```ts
   const dynPad = 6
   const dynamicAt = registry.getByType('dynamic').find(el => {
     const b = el.bbox
     return x >= b.x - dynPad && x <= b.x + b.width + dynPad
         && y >= b.y - dynPad && y <= b.y + b.height + dynPad
   })
   ```

3. If nothing else claims it, `handleNoteOrEmptyMouseDown` selects the closest
   note/rest **iff** the click lands on its "body" — `registry.hitsNoteOrRestBody(el,
   x, y)` (`ElementRegistry.ts:877`). Otherwise the click is treated as empty space
   (pan / box-select).

So a click's fate is decided by **box-containment against registered `bbox`es** (plus,
for notes, a smarter test described in §4).

---

## 3. The bug, with measured evidence — and the verified mechanism

### 3a. The evidence

We instrumented `registerDynamics` and the dynamic selection handler and reproduced the
reported case: a bar containing a **whole rest**, with a **forte (`f`) dynamic** placed
below the staff at the same beat. Console output:

```
[DynBBox] f | group 21.0x160.0@(347.7,70.0) → final 21.0x25.8@(347.7,129.6)
          | textEl:true textBox:21.0x160.0 baseline:150.0 children:[text]
[DynSel]  click(359,143) | dynAt:21x26@(348,130)
          | closest:rest#3b68 bbox 11x77@(348,79) | hitsBody:true
```

- The **dynamic**'s final registered box is tight: `21 × 25.8` at `(347.7, 129.6)`,
  i.e. ink from y 129.6 to **155.4** — dynamics already get the ink-rebuild treatment (§4b).
- The **rest**'s registered box is `11 × 77` at `(348, 79)` — y **79 → 156**. The rest
  *glyph* is ~10px of ink near the top (~y 82–92).
- Result: a click anywhere in that 77px band — including visibly empty space between
  the rest and the `f` — returns `hitsBody: true` for the rest and steals the click.

### 3b. The mechanism (read from VexFlow 5's source — this corrects rev 1)

VexFlow 5's base `Element.getBoundingBox()` is an **ink box**, not a metrical one
(`vexflow/build/esm/src/element.js:186`, paired with `measureText()` at 339-351):

```js
getBoundingBox() {
  return new BoundingBox(this.x + this.xShift,
    this.y + this.yShift - this.textMetrics.actualBoundingBoxAscent,
    this.width, this.height);       // height = actualAscent + actualDescent
}
```

`NoteHead`, `Accidental`, `Articulation`, `Dot`, `Annotation` and `Clef` all inherit
this unchanged (`ClefNote` delegates to its `Clef`). None of them are metrically
inflated in VF5. The per-glyph boxes are *already tight* — the plan's job is to stop
throwing that away.

The rest's 77px comes from `StaveNote.getBoundingBox()` (`stavenote.js`):

```js
const boundingBox = new BoundingBox(this.getAbsoluteX(), this.ys[0], 0, 0);
this._noteHeads.forEach(nh => boundingBox.mergeWith(nh.getBoundingBox()));
// …stem/flag for non-rests…
for (let i = 0; i < this.modifiers.length; i++) {
  boundingBox.mergeWith(this.modifiers[i].getBoundingBox());   // ← the culprit
}
```

**It unions every attached modifier — and our dynamics ARE modifiers.**
`attachDynamicsToSlots` (`DynamicsLayout.ts`) attaches each dynamic to its anchor
StaveNote as an `Annotation` (which is also why the dynamic's glyph renders *nested
inside* the rest's `vf-stavenote` SVG group). The arithmetic confirms it to the pixel:

| quantity | value |
|---|---|
| dynamic ink bottom (tight box) | 129.6 + 25.8 = **155.4** |
| rest registered box bottom | 79 + 77 = **156** |

The rest's box bottom IS the dynamic's ink bottom. The registered box is
*rest glyph ∪ attached dynamic*. A **bare** rest (no modifiers; rests have no stem and
no flag) should register ≈ tight already (~10–13px) — Phase 0 verifies this
prediction, because rev 1 generalized from this single measurement and got the
mechanism wrong; we won't repeat that.

Two further, separate mechanisms complete the picture:

- **Hand-built region boxes**: the line-start clef and time signature are registered
  with our own `CLEF_WIDTH × STAVE_HEIGHT` / clamped `TIME_SIG_WIDTH × STAVE_HEIGHT`
  rectangles (`VexFlowRenderer.ts:1649-1696`) — no VexFlow box involved. As *click
  targets* these are arguably fine (a clef is a tall glyph and a generous target is
  friendly); as *highlight regions* they misfire (§5b).
- **DOM `getBBox()` pointer-rect union**: every VexFlow-drawn group also contains an
  opacity-0 `pointer-events:auto` rect sized by (at least) the element's
  `getBoundingBox()` — for a StaveNote, the *modifier-unioned* box; for an Annotation,
  a much taller rect still (see `dynamicStyle.ts`). So a rendered group's `getBBox()`
  is **always ≥ the native box** and can never be tighter without stripping. This is
  why rev 1's "read the DOM" strategy is the wrong default (§6).

### Note on the two symptoms already patched (context, not part of this plan)
Two narrower fixes already landed in the working tree while diagnosing this:
1. **Selection tie-break** (`MouseController.ts`, `handleDynamicMouseDown`): a click
   *inside the dynamic's own tight box* now selects the dynamic even though the rest's
   oversized box also covers the point. (A local compensator for the inflated rest box.)
2. **Highlight bleed** (`HighlightController.ts`, `highlightNote` rest branch): a rest's
   recolor now skips `.vf-annotation` children, because the attached dynamic's glyph is
   rendered *nested inside* the rest's `vf-stavenote` SVG group.

Both are band-aids over the same root cause (the dynamic riding inside the rest's
container — as bbox in #1, as DOM in #2). This plan removes the root cause; #1 then
becomes retirable (§7 Phase 3). #2 stays: it guards the DOM nesting, which the bbox
fix does not change.

---

## 4. What already works — and why (the proven approaches)

The codebase already distrusts container-level boxes in two places, via **two different
strategies**:

### 4a. Notes — *semantic* hit geometry (ignore the bbox at hit time)
Notes still **register** the StaveNote union box (`VexFlowRenderer.ts:1495`), but
hit-testing does **not** use it. `hitsNoteOrRestBody` for a note rebuilds a tight box
around the **notehead**, from the note's **pitch → pixel-Y** (`pitchToPixelY`) and a
true notehead-center X (`headX`, captured from VexFlow's notehead span, excluding a
left-hanging accidental). See `ElementRegistry.ts:881`:

```ts
if (el.type === 'note' && el.pitch !== undefined) {
  const pitchY = this.pitchToPixelY(el.pitch, el.measure, centerX, el.staff)
  const sp = this.getStaffGeometry(el.measure, el.staff)?.lineSpacing ?? 10
  const halfW = sp * 1.1, halfH = sp * 0.9        // ~one staff-space around the head
  return Math.abs(x - centerX) <= halfW && Math.abs(y - pitchY) <= halfH
}
```

This is the **best** approach where it applies: a semantic point + tolerance is exact,
resolution-independent, needs no DOM read, and deliberately ignores the tall stem. Its
limitation: it only works for things with a computable geometric anchor (a note has a
pitch → a staff line). A rest has no pitch; a clef is a free glyph. **Notes keep this;
nothing in this plan touches them.**

### 4b. Dynamics — *ink* box at registration (rebuild the stored box)
Dynamics **register a tight box** by reading the rendered SVG. `registerDynamics`
(`DynamicsLayout.ts`) takes the annotation's `<text>` element, uses its `getBBox()` for
width, and its **baseline** (`<text y=…>`) ± tuned ink offsets for height — ignoring the
group's own `getBBox`, because of the pointer-rect union (§3b). Result: the stored box
matches the ink. This exists because the annotation's *modifier width is zeroed* (so
the formatter reserves no space for it), which breaks its native `getBoundingBox()`
width — dynamics are a special case and **stay as they are**.

### 4c. NEW (rev 2): VexFlow-native ink boxes — the missing third strategy
For everything else, VF5 already computes a tight ink box per glyph (§3b). The general
fix is simply to **ask the right object**: the rest's `NoteHead` instead of its
StaveNote container. No DOM, no stripping, no metrics table, no new coupling — the
box is computed from font metrics VexFlow already measured for layout.

### The corrected census

| | Registered box source | Tight? | Why / what to do |
|---|---|---|---|
| **note / chord** | StaveNote union (`:1495`) | ❌ (stem + modifiers) | irrelevant — hit-test is semantic (§4a); **leave** |
| **rest** | StaveNote union (`:1441`) | ❌ **when decorated** (attached dynamic/etc.) | **fix: register `noteHeads[0]` box** |
| **dynamic** | ink rebuild (§4b) | ✅ | leave |
| **accidental** | `Accidental.getBoundingBox()` (`:1552`) | ✅ expected (Element ink) | audit confirms; leave |
| **articulation** | `modifier.getBoundingBox()` (`:1515`) | ✅ expected | audit confirms; leave |
| **dot** | `modifier.getBoundingBox()` (`registerDots`, `:452`) | ✅ expected | audit confirms; leave |
| **mid-measure clef** | `clefNote.getBoundingBox()` (`:522`) | ✅ expected (delegates to Clef ink) | audit confirms; leave |
| **line-start clef** | hand-built `CLEF_WIDTH × STAVE_HEIGHT` (`:1649`) | ❌ by design (region-sized) | keep as click target; fix the **highlight** (§7 P2) |
| **timeSignature** | hand-built, clamped (`:1669`) | ❌ by design | same as clef |
| **tempo** | own group `getBBox()` (`TempoLayout.ts:233`) | ✅ (group is ours, text only, no pointer-rect) | leave |
| **tuplet** | hand-computed bracket geometry (`:1409`) | ✅ bespoke | leave |
| **stave / barline / measure bands** | layout rects (`:1617`, `:1698`) | region **on purpose** | leave |
| **beam** | `beam.getBoundingBox()` (`:1583`) | rarely hit-tested | leave |

The expected outcome (audit to confirm): **the migration is the rest, and only the
rest.** Everything else is either already tight, deliberately regional, or bypassed.

---

## 5. Every place a bbox is consumed (blast radius)

Grep of `interactions/` + `engine/` shows `.bbox` read for five purposes, all of which
are *improved or unaffected* by a tight rest box:

- **Hit-test (padded containment):** every per-type handler in `MouseController`
  (clef, timeSig, tempo, dynamic, tie, accidental, articulation, dot, note/rest).
  These are the wrong-selection bugs. The rest's `hitsNoteOrRestBody` branch
  (`ElementRegistry.ts:890`: bbox + 4px pad) is the flagship consumer.
- **Distance / "closest" tie-break:** `findClosestNoteOrRest` /
  `noteOrRestHitDistance` use the **bbox center** for rests
  (`ElementRegistry.ts:803/852`) — the 77px box moves the rest's "center" into empty
  air (y≈117, well below the glyph), skewing every proximity comparison against it.
- **Rect queries:** `getInRect` (Shift-box multi-select, `ElementRegistry.ts:490`)
  over-grabs with a fat box; `getAt` (`:454`, used by the Ctrl+Shift empty-space
  check) reports "not empty" beside a rest, blocking the measure box-select.
- **Highlight region:** `highlightGlyphsInBBox(clefEl.bbox …)` / `(tsEl.bbox …)`
  (`HighlightController.ts:644/694`) recolour every narrow glyph whose center falls
  inside the box — and those boxes are the full-stave-height hand-built ones (§3b),
  so the recolor can catch neighbours. Fixed by scoping, not by box surgery (§7 P2).
- **Positioning:** caret X (`HighlightController.ts:124/129`), the dynamic
  attachment-line corner (`:815`), and the **text-edit overlay** rectangles
  (`DynamicTextSource.ts:46`, `TempoTextSource.ts`) read `bbox` to place UI on the
  glyph. Dynamic/tempo boxes are already tight; the caret reads note/rest boxes only
  for X, where the union is harmless (modifier widths don't extend X materially —
  the dynamic's width is zeroed).

**Crucial distinction preserved from rev 1:** the **region** elements (stave, barline,
measure bands — and, per §4c, the line-start clef/TS *click targets*) *want* a large
box. **The bbox fix applies to the rest only; the clef/TS problem is a highlight-scoping
fix, not a box fix.**

---

## 6. Design decision (updated — rev 1's open question is now answerable)

Rev 1 left this open: *register a tight box up front (Option A via DOM `getBBox`),
tighten at hit time per type (Option B), or store both boxes (Option C)?* Reading the
VF5 source resolves it:

- **Option A-DOM (rev 1's lean) is a trap for the flagship case.** The proposed
  `tightGlyphBBox(group, {glyphSelector: 'text, path'})` would strip the transparent
  pointer-rect but **still union the dynamic's `<text>` ink**, because the annotation
  renders *nested inside the rest's own group* (§3b). The "tight" rest box would still
  reach the dynamic. Making it correct requires excluding nested modifier sub-groups
  per type (`.vf-annotation`; and articulation/accidental/dot glyphs render inside
  `vf-notehead`, not as siblings) — exactly the fragile DOM-shape knowledge rev 1
  worried about, now confirmed as unavoidable on this path. Additionally, a group's
  `getBBox()` is *always ≥ the native box* (pointer-rects), so the DOM can never beat
  the native metrics it was drawn from.
- **Option B (per-type hit-time geometry) is unnecessary.** Its sole advantage was
  avoiding DOM reads; the native box does that too, AND fixes the non-hit-test
  consumers (distance, rect queries) that Option B admits it leaves wrong.
- **Option C (store `inkBox` + `layoutBox`) remains over-engineered.** The region/glyph
  split is already encoded in `ElementType`; after this plan the only "layout-sized"
  boxes left are on types that want them.

**Decision: Option A, VexFlow-native source.** Register the rest by its own notehead's
`getBoundingBox()` (`staveNote.noteHeads` is a public accessor). Properties:

- One choke point; every downstream consumer corrected for free (same promise rev 1
  wanted from Option A, now without its cons).
- No DOM read at render; zero added cost (the metrics are already computed for layout).
- No coupling to VexFlow's SVG structure; nothing to strip.
- Same environment caveat as everything else (honesty item): VF5 measures ink via a
  canvas `measureText`; in jsdom `canvas.getContext('2d')` is null, so metrics are
  zero and the geometry is **invisible to the unit suite** — exactly as it is today
  and exactly as it would be under the DOM approach. The hand-test matrix is the net
  either way (§7 P4).

**Open questions — now resolved in-house (no outside review; Phase 0 settled them):**
1. *Is the modifier-union the real account of the 77px box, and is `noteHeads[0]` the
   right accessor?* — **Yes, confirmed** in Phase 0 (§7): the visualizer showed a rest's
   box reaching down to its attached dynamic and a bare rest hugging its glyph.
   `staveNote.noteHeads[0]` is a public accessor (`stavenote.d.ts:129`) returning a
   `NoteHead` whose `getBoundingBox()` is the glyph's own ink box.
2. *Any case where a container box is genuinely the right hit target?* — Yes, and they're
   already the carve-outs (§6a-i): notes (semantic hit-test) and the region types. Nothing
   else wants a union box.
3. *Playwright geometry test as the automated net?* — **No** (for now). The user does
   manual UI testing; the §6a-ii dev tripwire is the always-on regression signal, and the
   Phase 4 hand-test matrix is the acceptance net. Revisit only if regressions recur.

---

## 6a. Making the rule structural, not just documented (rev 3)

The one-line rest patch fixes *today*. It does nothing for *tomorrow*: the next
developer who adds a modifier-shaped element (a fingering, an ornament, a second
articulation family) and registers its anchor **StaveNote**'s box reintroduces this
exact bug, and Phase 0's audit — retrospective by nature — cannot have measured an
element that does not yet exist. A written rule ("register by own glyph") is only as
strong as the reviewer who remembers it. Rev 3 turns the convention into two enforced
halves. They are belt-and-suspenders: the first makes the *right* thing the only easy
path; the second makes the *wrong* thing loud.

### 6a-i. The SOURCE choke point (rendering layer)

Deciding *which VexFlow object is an element's own glyph* is inherently a VexFlow
concern, and **`ElementRegistry` is framework-agnostic — it imports no VexFlow and must
stay that way** (`lint:boundary` enforces this). So the choke point lives in the
rendering layer, next to the VexFlow calls, not in the registry.

Introduce one helper in `VexFlowRenderer` (or a small sibling in `engine/rendering/`):

```ts
// Register a GLYPH element by its OWN VexFlow object's ink box. Pass the leaf glyph
// (NoteHead, Accidental, Articulation, Dot, Clef…) — never a StaveNote container,
// whose getBoundingBox() unions attached modifiers (docs/tight-bbox-plan.md §3).
private addGlyphElement(glyph: VexElement, info: Omit<ElementInfo, 'bbox'>): void {
  const b = glyph.getBoundingBox()
  if (!b) return
  this.elementRegistry.add({ ...info, bbox: { x: b.x, y: b.y, width: b.w, height: b.h } })
}
```

Every glyph-type registration site (rest → `noteHeads[0]`, accidental, articulation,
dot, mid-measure clef) routes through this. The consequence that matters: after the
migration **`staveNote.getBoundingBox()` no longer appears at any glyph registration
site** — the container-union box is simply not in reach of the helper, because the
helper reads whatever *leaf* object you hand it. The wrong box stops being one typo away.

Two deliberate carve-outs, unchanged from rev 2, stay *off* this path (they don't take a
single VexFlow glyph box, so forcing them through it would be a lie):

- **note / chord** — keeps registering the StaveNote union box **plus `headX`**; its
  hit-test is *semantic* (§4a), not box-based. Untouched.
- **region types** (line-start clef, timeSignature, stave, barline, measure bands) —
  keep their hand-built rects via a plainly-named `addRegion(...)` / the existing
  `add(...)`. These *want* a large box; the split is already encoded in `ElementType`.
- **dynamic / tempo** — keep their existing ink-rebuild / own-group `getBBox` (§4b);
  they're already tight and have their own reasons (zeroed modifier width).

So `elementRegistry.add` does not disappear — it stays the low-level sink that `addGlyph
Element`, `addRegion`, and the note/dynamic/tempo specials all call. What changes is that
**glyph sites stop calling it directly with a self-computed box.**

### 6a-ii. The RESULT tripwire (registry, framework-agnostic)

The source choke point still trusts the caller to hand it a *leaf* glyph. To catch a
future caller who hands it the wrong object anyway — the case Phase 0 can't foresee —
the registry gets a cheap dev-only guard. It needs no VexFlow: it already holds
`staffGeometries` with each staff's `lineSpacing`, so it can reason about scale.

```ts
// dev-only; silent in prod (dbg-gated). Fires when a GLYPH-type box is implausibly
// tall for its staff — the signature of an accidental container-union (a dynamic/etc.
// merged in). Region types are exempt (they are large by design).
```

- Applies only to glyph types (an allowlist of the region types is exempt).
- Threshold expressed in **staff-spaces**, not pixels (resolution-independent): a single
  glyph is at most a few staff-spaces tall; a StaveNote unioned with a below-staff
  dynamic is ~7–8. A conservative bound (e.g. `> ~6 × lineSpacing`) has wide daylight
  from any legitimate glyph. **The exact multiple is a Phase 0 output** — the audit
  measures real glyph heights (incl. the tall mid-measure clef and a measure rest) so
  the threshold is set from data, not guessed. Named here as a proposal, not a baked
  magic number (per the project's "don't invent a rule" discipline).
- It is the **forever version of the Phase 0 audit**: jsdom sees zero metrics, so this
  never fires (or false-fires) in unit tests; in a real browser dev session it fires the
  instant a future element reintroduces a container-union box. That is the concrete
  answer to "how is this general for elements we can't measure now" — we don't measure
  them; we make the registry complain when one is mis-registered.

### 6a-iii. What this costs

One helper (~6 lines) + one dev guard (~6 lines) + rerouting ~4 existing call sites that
already compute a box — they change *which object* they read, not their structure. No new
stored fields, no registry↔VexFlow coupling (the guard reasons only about numbers), no
change to any consumer. It is strictly smaller than rev 1's DOM-helper proposal and,
unlike the bare one-liner, it survives the next contributor.

---

## 7. Proposed plan

### Phase 0 — Audit / verify the mechanism ✅ DONE
Before changing anything, **confirm the §3b mechanism directly** rather than trust the
diagnosis. The original plan called for numeric console instrumentation; in practice a
**visual** check was faster and is stronger proof (the claim is geometric, not a number).

**Method (kept as a dev tool):** `__bbox.show()` — a dev-only visualizer (`App.vue`,
`window.__bbox`) that draws every *registered* hit-box as a coloured SVG rectangle right
on the score, read straight from `ElementRegistry.getAll()` (always current — no
re-render games, which is why the earlier console-measurement attempts kept reading zero:
the P5.4 reuse path replays cached boxes into the registry without re-running
registration). `__bbox.show('rest')` filters to one type; `__bbox.hide()` clears. **This
tool is kept**, not deleted with the plan — it is a general hit-geometry debugging aid.

**Result — the prediction held, confirmed by eye (hand-test, real browser):**

| case | registered box | matches §3b? |
|---|---|---|
| whole rest **with** an `f` dynamic below | tall — red box reaches **down to the `f`** | ✅ union of rest glyph + attached dynamic |
| whole rest **with no** dynamic | **tight** — hugs the ~10px rest glyph | ✅ bare rest is already tight |

So the mechanism is exactly "`StaveNote.getBoundingBox()` unions its attached modifiers,"
and **only decorated rests are inflated** — bare rests, and (spot-checked via `__bbox.show()`)
the other glyph types, look tight/regional as the §4c census predicted. The fix
(`noteHeads[0]`'s own box) is validated. **Green light for Phase 1.**

> Tripwire calibration note: the §6a-ii threshold no longer needs a precise measured
> table. The visual labels (`type W×H`) plus staff-geometry give ample separation — a bare
> rest ≈ 1 staff-space, a mid-measure clef ≈ 4, the decorated union ≈ 7–8 — so a bound of
> ~6 staff-spaces clears every legit glyph with daylight. Set it there; revisit only if a
> real glyph ever trips it.

### Phase 1 — Route glyph registration through the choke point (§6a)
Rev 3 replaces the bare one-line rest patch with the enforced version. Two small,
independently-committable steps:

**1a — Introduce the SOURCE choke point + rerouting (rendering layer).** Add
`addGlyphElement(glyph, info)` (§6a-i) and route the rest and every other audit-confirmed
glyph type through it. For the rest (`VexFlowRenderer.ts:1441`, `registerSlotElements`):

```ts
// Register the rest by its OWN glyph's ink box, not the StaveNote container box:
// StaveNote.getBoundingBox() unions every attached modifier, and a dynamic is an
// attached Annotation — so a rest carrying a dynamic would register a box reaching
// down to the dynamic's ink and steal its clicks (docs/tight-bbox-plan.md §3).
const glyph = staveNote.noteHeads[0] ?? staveNote      // leaf glyph; fallback = unchanged behaviour
this.addGlyphElement(glyph, { type: 'rest', id: slot.id, measure: measure.number, /* …*/ })
```

(Keep the try/catch already there.) Dots are unaffected — a dotted rest's dot is its own
registered `dot` element, and excluding the Dot modifier from the rest's box is correct:
the dot has its own hit-box. Accidental / articulation / mid-measure-clef sites move to
`addGlyphElement` too **if the audit confirms they're already tight** (a pure refactor
that removes the direct-`add` temptation); if any turns out fat, this is where its
native-source fix lands. Note/chord, region types, and dynamic/tempo stay on their
carve-out paths (§6a-i).

**1b — Add the RESULT tripwire (registry).** Add the dev-only staff-space guard (§6a-ii)
using the Phase 0 threshold. Framework-agnostic, `dbg`-gated, silent in jsdom and prod.

Verify the unit suite stays green after each step (it runs on zero metrics either way —
this confirms no *logic* regression, not the geometry).

### Phase 2 — Scope the clef/TS highlight to the glyph's group
`highlightGlyphsInBBox` (`HighlightController.ts:653`) recolors by region because the
clef/TS boxes are region-sized (§3b). Rather than shrinking those boxes (they're
friendly click targets, and no glyph-accurate box exists for them at registration —
they're hand-built), recolor **inside the glyph's own SVG group**, the established
pattern used by tempo, dynamic, tuplet, tie and slur highlights. This needs the
clef/TS glyphs to be addressable (an `openGroup` with an id at draw time, as
`TempoLayout` does). If addressability turns out expensive for stave-begin modifiers,
this phase can fall back to keeping the region scan but intersecting with a
vertical band — decide when the code is open.

This phase is independent of Phase 1 and can land before or after it.

### Phase 3 — Retire the compensators
Tight rest boxes make existing hacks unnecessary or re-tunable — revisit, don't
blind-delete:
- the `inDynamicCore` tie-break in `handleDynamicMouseDown` (rest box tight ⇒ the
  dynamic handler's earlier position in the priority chain suffices again);
- the rest branch pad in `hitsNoteOrRestBody` (`pad = 4`): a tight whole-rest glyph is
  only ~11×10px, so the click target becomes ~19×18px — consider scaling the pad to
  the staff's line spacing (~one staff-space) so rests stay easy to hit;
- re-check `findClosestNoteOrRest`'s rest center: with a tight box the center lands on
  the glyph and the proximity tie-breaks (articulation-vs-rest, dot-vs-rest) shift
  slightly — hand-test those.
- the `.vf-annotation` highlight skip **stays** (it guards DOM nesting, not the bbox).

### Phase 4 — Verify (hand-test matrix)
Because neither jsdom path exercises real metrics, the **manual** matrix is the net:
- click each glyph type; click visibly empty space beside each (must NOT select);
- the flagship: whole rest + below-staff dynamic — click the dynamic (selects
  dynamic), the rest glyph (selects rest), the space between (selects NOTHING /
  box-select);
- rest with dynamic ABOVE the staff (placement: 'above' — same mechanism, other side);
- highlight each type (no bleed); caret position after entry; double-click text
  overlays (dynamic, tempo) land on the glyph;
- multi-staff + multi-voice spot check (below-staff dynamic under a rest in staff 2);
- Shift-box select near rests (no over-grab); Ctrl+Shift empty-space measure box
  beside a rest (must trigger).
Plus the full unit suite (green on zero metrics — logic net only).

---

## 8. Rollout & risk

**Rollout:** Phase 1 is now two small commits — 1a (choke point + reroute, incl. the
flagship rest, hand-verified) and 1b (dev tripwire). Phase 2 is separate. Phase 3 items
are individually small and each hand-verifiable. Stop-anywhere property preserved from
rev 1: 1a alone fixes the reported bug; 1b and Phase 2 add future-proofing and can land
later.

**Risks / honest caveats:**
1. **Tests can't guard the geometry** (jsdom: no canvas 2D context → VF5 metrics are
   zero; no SVG `getBBox` either). True for every strategy considered; the audit table
   + hand-test matrix are the substitute. Called out so it's a conscious trade.
2. **`noteHeads[0]` coverage** — a rest StaveNote has exactly one notehead (the rest
   glyph), so index 0 is safe; the fallback keeps behaviour unchanged if a future
   VexFlow changes that.
3. **Behavioral shifts from a smaller box** — anything that *benefited* from the fat
   rest box gets stricter: clicks that used to select the rest from afar now
   box-select/pan. That is the intent, but it changes feel — hence the pad
   recalibration in Phase 3.
4. **Whole-measure rests** — our renderer centers these; confirm in Phase 0 that the
   notehead box is where the drawn glyph is (same object, so it should be — measure it).
5. **Scope creep** — the discipline stands: rest only (plus anything the audit flags),
   notes untouched, dynamics untouched, region boxes untouched. The choke point (§6a) is
   a *refactor of how the same boxes are registered*, not a widening of what migrates —
   glyph sites that were already tight change which object they read, nothing more.
6. **Tripwire false alarms** — a dev-only threshold set too low would cry wolf on a
   legitimately tall glyph. Mitigated by calibrating the bound from Phase 0's measured
   staff-space heights with daylight (§6a-ii); it is `dbg`-gated, so worst case is noise
   in a dev console, never a user-facing effect.

---

## 9. Decisions
1. **Strategy — native ink box for the rest (Option A-native, §6): ✅ confirmed.** Phase 0
   validated the mechanism.
2. **Lever #1 (§6a) — SOURCE choke point (`addGlyphElement`) + dev-only RESULT tripwire:
   ✅ adopt.** Make the rule structural, not a bare one-liner + written convention.
3. **Phase 2 approach — still open:** glyph-group recolor (preferred) vs banded region
   scan for clef/TS highlights. Decide when the code is open.
4. **Automated geometry test — no.** Hand-test matrix (Phase 4) is the acceptance net; the
   §6a-ii dev tripwire is the always-on signal. A Playwright/real-canvas CI test is not
   worth it now; revisit only if regressions recur.

---

## Appendix A — Key file/line references
- Registry data model: `engine/ElementRegistry.ts` — `ElementType` (17),
  `ElementInfo` (131), `getAt` (454), `getInRect` (490), `findClosestNoteOrRest` (803),
  `noteOrRestHitDistance` (852), `hitsNoteOrRestBody` (877), `pitchToPixelY` (597).
- Registration: `engine/rendering/VexFlowRenderer.ts` — registerDots (452),
  mid-measure clef (515), rest (1441), note (1467/1495), articulation (1515),
  accidental (1552), beam (1583), stave (1617), line-start clef (1649),
  timeSignature (1669), barline (1698), tuplet (1409).
- Dynamics (attach + ink rebuild): `engine/rendering/DynamicsLayout.ts`
  (`attachDynamicsToSlots`, `registerDynamics`), `engine/rendering/dynamicStyle.ts`
  (the pointer-rect write-up). Tempo: `engine/rendering/TempoLayout.ts:233`.
- Consumers: `interactions/MouseController.ts` (per-type handlers, chain at 458),
  `interactions/HighlightController.ts` (`highlightGlyphsInBBox` 653, caret 124/129,
  attachment line 815, rest-branch annotation skip 321),
  `interactions/DynamicTextSource.ts:46` / `TempoTextSource.ts` (text overlays).
- VexFlow 5 (read, not modified): `element.js:186` (`getBoundingBox` = ink),
  `element.js:339` (`measureText` → `actualBoundingBox*`), `stavenote.js`
  (`getBoundingBox` modifier union; pointer-rect drawn from it),
  `stavenote.d.ts:129` (`get noteHeads(): NoteHead[]`), `clefnote.js:32`
  (delegates to `Clef`). `NoteHead`/`Annotation`/`Accidental`/`Articulation`/`Dot`
  do **not** override `getBoundingBox`.

## Appendix B — Measured evidence (live instrumentation, whole rest + f dynamic)
```
[DynBBox] f | group 21.0x160.0@(347.7,70.0) → final 21.0x25.8@(347.7,129.6)
[DynSel]  click(359,143) | dynAt:21x26@(348,130) | closest:rest#3b68 bbox 11x77@(348,79) | hitsBody:true
```
Rest glyph ink ≈ 10px tall; registered box 77px (y 79→156). Dynamic ink bottom
= 129.6 + 25.8 = **155.4** ≈ the rest box's bottom (**156**) — the registered rest box
is the union of the rest glyph and its attached dynamic Annotation (§3b), not a
font-metric box. Phase 0 re-measures a bare rest to lock this in.
