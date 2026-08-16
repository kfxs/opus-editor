# Should we build our own engraving engine? — the audit

> ⭐⭐ **The question this answers** (his, 2026-08-16): *"we have been rewriting some of the VexFlow
> things in this editor and we also have been not using VexFlow for other features. I wonder if we
> should not start thinking in build our own render engine so we don't depend on VexFlow; suppose
> VexFlow tomorrow makes another version, our workaround can not work anymore… of course we don't
> want to get rid of VexFlow tomorrow, we can do this little by little but it should be with a goal
> and future features should have this in mind."*
>
> **Short answer: yes to the goal, no to the project.** We are already ~70% of the way there, the
> remaining 30% is five separable pieces rather than one rewrite, and the reason to do them is not
> independence — it is that two of them fix bug *classes* we keep paying for. The stated risk
> (a new VexFlow breaking us) is the one risk that does **not** exist.
>
> ⭐⭐ **§7–§8 are the target shape** — three stages with a typed **SCENE** between engraving and
> painting, and one adapter directory that is the only thing importing `vexflow`. ⭐⭐ **§6.7 is the
> finding that makes the whole thing finishable**: VexFlow is **MIT**, so where we have no engraving
> opinion of our own we *port, attributed*, rather than invent — which is what
> `chordAccidentalColumns` already did once.
>
> 📄 Read with `docs/vexflow-boundary.md`, which inventories who decides what today. This document
> is the second question: not *which decision to take next* but *whether the DRAWING should move
> too*. It also corrects one premise in that doc's §4 — see §4 below.

---

## 1. The stated risk is not the real one

**A new VexFlow release cannot break us.** It is a build-time dependency pinned in `package.json`
(`"vexflow": "^5.0.0"`, resolved 5.0.0). We choose when to upgrade, and we may choose never.

The release history says the pressure is not there either:

| version | released |
|---|---|
| 4.2.0 | 2023-06-21 |
| 4.2.5 | 2024-07-09 |
| 5.0.0-beta.1 | 2025-02-25 |
| **5.0.0** | **2025-03-05** |
| — nothing since — | **17 months as of 2026-08-16** |

Majors are ~21 months apart and there has been no release at all in a year and a half. So the case
for our own engine has to stand on something else. It does — and the honest version is more
interesting than the one in the question.

⚠️ **The real risks, both real:**

1. **We are already writing an engraving engine and not saying so.** The boundary has moved in one
   direction for a year (`vexflow-boundary.md` §1), feature by feature, with no stated end state —
   so every new feature re-litigates where the line is.
2. **VexFlow is a geometry oracle we cannot fix.** When it is wrong our only tool is to undo it
   after the fact, and the undo has to know exactly *how* it was wrong.

---

## 2. The measurements

Taken 2026-08-16 against the tree at `7b4f5da`.

### 2.1 Containment — the best news in this document

**All 38 files importing `vexflow` sit in `src/engine/rendering/`.** Zero in `interactions/`,
`utils/`, `models/`, `types/`, `windows/`, `menus/`, `bus/`, `dev/`. `npm run lint:boundary` already
holds that line.

⭐ **The blast radius of this entire question is ONE directory.** That is the single most important
feasibility fact, and it is true by construction rather than by luck — it is what the
framework-agnostic port bought.

⚠️ The one qualifier: **40 exported signatures inside that directory carry a VexFlow type**
(`StaveNote`, `Stave`, `SVGContext`, `RenderContext`). Those are the seam, and they are the work.

### 2.2 Size — the residue is smaller than it looks

| | LOC |
|---|---|
| `src/engine/rendering/` (ours) | **20,053** |
| `src/engine/layout/` (ours) | 3,300 |
| VexFlow's entire engine, fonts excluded | **18,060** |
| …the VexFlow modules we actually import from | 11,781 |
| …of which **pure data** (`glyphs.js` codepoint map, `tables.js`) | 3,600 |
| …of which **we already have our own** (`music`, `fraction`, `util`, `boundingbox`, `typeguard`) | 645 |

So the algorithmic residue is **~7,500 LOC**, and it is not one lump:

| cluster | LOC | status |
|---|---|---|
| The NOTE — `stavenote`, `note`, `stemmablenote`, `notehead`, `stem`, `flag`, `dot`, `accidental` | **2,103** | built ONCE already, for fan members |
| Formatter + tickable infrastructure | 1,813 | we call `format()` and then **overwrite every x** |
| `beam` | 642 | we already fill beam quads in three places |
| `stave` | 577 | used as a coordinate system, not a drawer |
| The render CONTEXT — `svgcontext`, `renderer`, `rendercontext` | **526** | 20 primitives |
| `articulation` | 281 | ⛔ no complaint — leave it |
| `annotation`, `tuplet`, `timesignature`, `clef`, `stavebarline`, `curve`, `tremolo` | ~1,050 | mixed; `curve` already reimplemented |

### 2.3 What VexFlow has BECOME here — the call profile

| `Stave` | calls | | `StaveNote` | calls |
|---|---|---|---|---|
| `getYForLine` | 22 | | `getStemDirection` | 20 |
| `getNoteStartX` | 9 | | `getStemExtents` | 9 |
| `getNoteEndX` | 8 | | `getAbsoluteX` | 9 |
| `getSpacingBetweenLines` | 5 | | `getNoteHeadBeginX` | 7 |
| `getYForTopText` / `getYForNote` | 8 | | `getStemX` | 6 |
| **`addClef`** | **4** | | `getNoteHeadEndX` | 6 |
| **`addTimeSignature`** | **2** | | `getYs` | 5 |

⭐⭐ **`Stave` is a coordinate system and `StaveNote` is a ruler.** Six of the seven most-called
`Stave` methods ask *where is a line / where does the note area start*; two place a glyph. Every
top `StaveNote` call is a geometry read, and the readers are **our own renderers** — `SlurRenderer`,
`TieRenderer`, `TrillRenderer`, `OttavaRenderer`, `PedalRenderer`, `HairpinRenderer`, `FanPass` —
asking where to anchor ink they draw themselves.

**VexFlow is already, in this codebase, a glyph painter and a ruler. Everything that decides where
music goes is above it.**

### 2.4 What the coupling costs

| | count |
|---|---|
| Comments naming VexFlow in `engine/rendering/` | **381** |
| …of those, in the "it does X and we need Y" register | **72** |
| Casts through `as unknown as` (reaching past the public type) | **26** |
| Live monkeypatches of a VexFlow method | **1** |
| Distinct drawing primitives our own renderers use | **20** |

The monkeypatch is worth naming because it is the shape of the whole problem.
`VexFlowRenderer.applyNoteOffsets` **replaces `sn.getModifierStartXY` per note at render time**,
because `Articulation.draw()` re-centres any within-staff mark with `setOrigin(0.5, 0.5)` and
`Element.setOriginX` **overwrites** `xShift` — so a manual shift is silently discarded. The fix had
to reach the one value both the placement and the re-centring read. None of that is public
contract; all of it is load-bearing.

Beside it, the standing repairs:

- `renderOptions` written as a field, not an API: un-setting `draw = false` on rests VexFlow merged
  away, `strokePx` for ledger overhang, reading `beamWidth` for beam thickness.
- After `format()` we **re-assert** stem directions, rest lane lines, measure-rest centring and
  clear VexFlow's auto x-shift — `StaveNote.format()` rewrites all four for multi-voice.
- `Stave.padding` = 12px with **no setter** is why `barline↔note` is 1.2 staff spaces and not the
  1.0 the model wants (LilyPond: 0.9). ⭐ **A stated rule we cannot express**, open since July, and
  the only item on `vexflow-boundary.md` §3 that survived every other fix.

---

## 3. ⭐⭐ And this is the class of bug it produces

2026-08-16, his report: *"the rests are not centered in relation to the measure… particularly when
opening the app for the first time."*

**VexFlow carries no metrics table.** `Element.measureText()` sets `context.font` and asks a canvas
for `measureText(glyph)` at render time. Bravura ships as a base64 woff2 loaded on import, so it
arrives asynchronously — and the editor's first render beat it. Measured in Chromium, whole-rest
U+E4E3 is **30.3px** wide in the fallback face and **11.0px** in Bravura, so every empty bar's rest
landed ~9.7px — about a staff space — left of its own centre.

Three things make it the canonical example:

- **Nothing in our layer could see it.** Our ink table is constants, our spacing is arithmetic, our
  centring pass is correct. The ruler was wrong.
- **The ink repairs itself and the geometry does not.** The browser repaints every `<text>` in
  Bravura the moment the face lands, so it *looks* like a proper whole rest at a wrong coordinate.
- **Re-rendering cannot fix it** — a measure whose `MeasureRedrawKey` is unchanged is moved by
  transform, and the font is not in that key. It needed a gate
  (`engine/rendering/musicFontReady.ts`), not a retry.

⭐ A font-metrics layer of our own would have made this unrepresentable.

---

## 4. ⚠️ A correction to `vexflow-boundary.md` §4

That document argues, and it is the load-bearing sentence of its recommendation:

> *"VexFlow is years of accumulated correctness about glyphs, stems, beams and fonts. Taking a
> decision we have no opinion about buys nothing and costs us that correctness."*

**For glyphs and fonts specifically, that is not true, and it was worth checking.** VexFlow 5's
`MetricsDefaults` is a table of style constants and pixel paddings — `Stave.padding: 12`,
`Accidental.leftPadding: 2`, `Accidental.accidentalSpacing: 3`, `NoteHead.minPadding: 2`. There is
**no SMuFL anchor data at all**: no `stemUpSE` / `stemDownNW` attachment points, no glyph bounding
boxes, no cut-outs. Everything is derived from runtime `measureText` plus those constants.

Bravura **ships** `bravura_metadata.json` with all of it, under SIL OFL — the same licence as the
font we already load.

⭐⭐ **So on font metrics our own layer could be MORE correct than VexFlow, not less.** That is the
strongest single argument in this audit, and it is the opposite of what the boundary doc assumes.
The sentence stays true of *stems, beams and articulation placement* — see §6.

---

## 5. ⭐ The five pieces, in order

Not one project. Five, each standalone, each leaving the editor working.

> ✅ **P2 is DONE (2026-08-16).** ⏭️ **P3 is next** — the note itself, and the big one.
>
> 🚨 **THE ORDER BELOW WAS WRONG, corrected 2026-08-16 — see `docs/font-metrics-plan.md` §0.**
> **P2 goes first, and P1 moves to after P3.** P1's claim was that it *"makes everything else
> optional"*; it does not, because while VexFlow objects still paint themselves our context has to
> implement **VexFlow's** `RenderContext` interface anyway — so it re-implements their interface
> rather than escaping it, *and* it swaps the whole paint layer in one commit. It is the
> **highest**-blast-radius of the five, not the lowest. P2 is additive, risk-free, jsdom-testable
> and a prerequisite for P3. P1's real job — *stop calling `.draw()` on VexFlow objects* — only
> becomes available after P3.

### P1 — Our own render context ⏭️ AFTER P3
Our renderers already use **20 primitives**: `openGroup`/`closeGroup`, `beginPath`/`moveTo`/
`lineTo`/`closePath`/`stroke`/`fill`/`fillRect`, `setLineWidth`/`setStrokeStyle`/`setFillStyle`/
`setLineDash`, `setFont`/`fillText`/`measureText`, `save`/`restore`, `scale`, `pointerRect`.
VexFlow's `SVGContext` is 394 LOC.

⭐ **Cheapest piece, most leverage, and it is what makes every other piece optional** — after it,
VexFlow objects only have to hand us numbers, never paint. It also closes four standing gotchas at
once: `save`/`restore` being no-ops, the `setStyle` context leak, `openGroup`'s `vf-` prefix, and
`getSVGElement`'s document-wide `getElementById`.

### P2 — Glyphs and font metrics ✅ **DONE 2026-08-16 (F1–F4)**
📄 **`docs/font-metrics-plan.md`** — the decision record, and the log of what each phase found.

> `engine/fonts/` holds Bravura's metrics for the 60 glyphs we draw, generated from the OTF we
> already ship. The ink table keeps its literals and is **held against the font** in jsdom, with
> every deliberate difference an override carrying its reason; the browser check was re-pointed so
> its subject is now **the dependency** — and it says the woff2 VexFlow draws with is the same
> Bravura we measure. The weights derive from `engravingDefaults` outright. The ink half is fenced
> off from the DOM by `lint:boundary`, so *"our numbers do not wait for a font"* is checked rather
> than claimed.
>
> ⭐⭐ **And it changed the picture once, which was the argument for doing it at all.** Asking which
> line a rest is drawn on — a question the font cannot answer — found that every rest was keyed to
> the middle line, leaving the **whole rest a staff space too low in every empty bar**. Researched
> (Gould p. 34, Byrd 1984, and all three reference engines), then fixed: `layout/restPlacement.ts`
> owns the rule and the model *and* the drawing both read it.
>
> ⏭️ **What P2 leaves for his eye**: six taste calls batched in that plan's §3.6 — none of them
> blocking, and each one line to flip.

Ship Bravura's SMuFL metadata ourselves (`Bravura.json`: 3,434 glyph boxes, 643 anchor sets, 30
engraving defaults). Kills the §3 bug class for our own numbers. Turns `spacingPadding.ts` from a
hand-measured table into a **checked** one.

⭐⭐ **Revised: the glyph BOXES need no download** — `public/fonts/Bravura.otf` is already in the
repo under `OFL.txt` and already parsed by `opentype.js` for the PDF export, so the generation
script measures the font *we ship and outline*. Only `engravingDefaults` and the anchors need the
JSON. See that plan's §1.1.

⭐ **Our table is already right** — dot 0.40/±0.20 and sharp ±1.4 match the font exactly — so this is
not re-litigating taste, it is re-sourcing agreed numbers from something that cannot drift.
⚠️ But the rows mean **three different quantities** today (ink extent, advance, a behavioural
distance we measured off VexFlow), and 🚨 **the existing e2e silently changes subject** when they are
re-sourced. Both are why that plan exists.

### P3 — The note — ⚠️ THE BIG ONE
Notehead, stem, flag, ledger lines, dots. **We have already built this once:** `FanPass` draws
heads, stems, accidentals and ledger lines by hand today for fan members — including ledger lines,
because `drawLedgerLines` belongs to `StaveNote` and a bare `NoteHead` has none. `chordHeadLayout`,
`chordAccidentalColumns` and `dotPlacement` are the layout half, already ours.

Generalising from "fan members" to "all notes" is the largest single item, and it is the one that
**unblocks `Stave.padding`** — the last item on `vexflow-boundary.md` §3 with no route around it.

⛔ **Do not start P3 before the golden-image net exists** (§6.3).

### P4 — Beams
`FannedBeam`, `CrossBarBeams` and `beamInk` already fill beam quads; `docs/beaming.md` already
states our rules; we already borrow VexFlow's `maxSlope`. What is missing is ordinary slope choice
and hooks.

### P5 — The staff and the header
`engine/layout/headerInk.ts` already **measures** what a clef and a meter cost; `Stave` still
**places** them — the two-sets-of-numbers problem in its last hiding place. Small once P2 exists.

### ⛔ Not on this list
**Accidental column stacking** (`Accidental.format`) and **articulation placement**
(`Articulation`). They are the only two places where VexFlow does real engraving thinking we have
never had a complaint about. §6.1 is why that matters more than it sounds.

⭐ **But not "never", either — see §6.7.** VexFlow is MIT, so these two sit on a **port-if-needed**
list rather than a build list, and we have already done it once (`chordAccidentalColumns`).

---

## 6. The honest risks

### 6.1 ⚠️ The remaining 30% is the part with no rules written down
Every module we have taken so far, we took because we could **name the rule**: Gould's chord-cluster
rule, her accidental-column zig-zag, LilyPond's `space-alist`, the log law, MuseScore's
`minHorizontalDistance`. Stem lengths, beam hooks and accidental columns are places where **we
currently have no opinion**, and a re-implementation without an opinion is strictly worse than a
dependency. This is `vexflow-boundary.md` §4's test, and it still binds — it is why P3 and P4 need
research committed *before* code, the way the slur and spacing work did.

⭐ **…and §6.7 is why this is much less binding than it looks.** Read them together.

### 6.2 ⚠️ Consistently wrong beats newly wrong
VexFlow being wrong is at least wrong the same way every time, and we have learned its shapes. Our
own bug would be new each time, and — as §3 shows — a geometry bug can look like correct ink.

### 6.3 🚨 The e2e net is good and it is NOT a golden
**177 browser tests, 616 assertions, 216 unit spec files, 3,581 unit tests.** But
`playwright.config.ts` says in as many words that it is *"a SMALL net — enough to catch a
code-motion regression in the renderer, not a picture-perfect golden of every feature."*

⭐ **Replacing note drawing needs image-diff goldens, and we do not have them.** That is the one
piece of infrastructure to build before P3 — not after, and not "as we go".

### 6.4 ⚠️ jsdom sees none of this
Every geometry assertion in the unit suite measures zeros
(`reference_jsdom_cannot_measure_glyphs`). Every step of this migration is browser-verified or it
is unverified.

### 6.5 The ghost still runs its own formatter
`vexflow-boundary.md` §5 P3, still open: the preview ghost formats its own temporary stave and does
not run the spacing pass. It is the last VexFlow-formatted thing in the app and it moves with
whichever piece reaches it first.

### 6.6 ⚠️ The reference sources are gone
`/tmp` was cleared: the LilyPond / MuseScore / Verovio checkout an earlier session downloaded no
longer exists. P3 and P4 need it re-fetched. (Network is open; 🚨 MuseScore's default branch is
`main`.)

### 6.7 ⭐⭐ …but MIT changes the fallback — PORT, don't invent

> His question (2026-08-16): *"isn't VexFlow MIT license… that means if the accidental is the tricky
> part we can always reuse but not get the whole dependency (i think we did something related with
> accidental in the fan)."*

**Both halves are right, and it is the most important correction to this document.**

Confirmed at `node_modules/vexflow/LICENSE`: **MIT.** *"Permission is hereby granted, free of
charge… to deal in the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies."* © 2010–2022 Mohit
Muthanna Cheppudira; © 2023–present VexFlow contributors.

And **we have already done exactly this once** — `rendering/chordAccidentalColumns.ts`, which is
careful to say what it is and is not:

> ⛔ *Not a re-implementation of VexFlow's `Accidental.format`. That one needs `Accidental`s attached
> to `Note`s inside a formatter's `state`, and a fan member has neither — it is a head at a
> coordinate.* **The ORDER is the same rule; the packing is the simplest thing that obeys it.**

⭐⭐ **This materially weakens §6.1, which is the strongest argument in this document against
finishing.** That risk was: *stem lengths, beam hooks and accidental columns are places where we
have no opinion, and re-implementing without an opinion is worse than depending.* MIT means the
choice was never "invent it, or keep the dependency". It is:

> ⭐ **Port the algorithm, attributed — and form an opinion later, when he reports something.**

That is a better position than either alternative: VexFlow's accumulated behaviour **without** the
18,060-LOC dependency, the runtime coupling, the `renderOptions` pokes or the monkeypatch.

⚠️ **Four conditions. All easy, none optional.**

1. ⛔ **The notice travels with the code.** MIT's one condition is that the copyright and permission
   notice be included in copies and substantial portions. In practice: `LICENSES/vexflow-MIT.txt` at
   the repo root, plus a header on every ported module naming it. Not a courtesy — the condition.
2. ⚠️ **Port the ALGORITHM, not the FILE.** `Accidental.format` needs `Accidental`s attached to
   `Note`s inside a `Formatter`'s `state`; copying it verbatim drags in `Modifier`,
   `ModifierContext`, `Note` and `Tickable` — **1,813 LOC of infrastructure (§2.2) to avoid writing
   330**. Copying the file re-imports the dependency under another name. `chordAccidentalColumns` is
   the model: take the rule, write the packing.
3. 🚨 **The FONTS are a SEPARATE licence.** VexFlow's `LICENSE` covers the *code*. Bravura,
   Academico, Petaluma and Gonville come from separate `@vexflow-fonts/*` packages on their own
   terms — Bravura and Academico are SIL OFL; ⛔ **check Gonville's specifically before vendoring,
   do not assume.** This matters directly for P2, which is exactly "ship the font ourselves".
4. **MIT constrains nothing we plan.** It is permissive, so it does not affect the editor's own
   licence or the npm-package goal — provided (1) holds.

⏭️ **The revision to §5's ⛔ list:** accidental stacking and articulation placement stay off the
*build* list and move onto a **port-if-needed** list. Nothing changes today. What changes is that
finishing no longer requires having an opinion about everything first — which was the main reason to
suspect this might not be finishable at all.

---

## 7. ⭐⭐ The architecture it should land in — three stages and one seam

> His follow-up: *"can you think also how the new architecture should be, and also the folder
> structure (since we want to be clean and organized)."*

### 7.1 What today's shape actually costs

`VexFlowRenderer.renderScore()` walks the score and, **in one pass**, decides which symbols there
are, asks VexFlow where they go, and emits SVG. So **the geometry exists only as SVG**, and there is
no artefact between "the music" and "the DOM".

Four known costs, none of them small, all of them the same cost:

| symptom | size | why |
|---|---|---|
| ⚠️ A drawn position is not a unit test | the whole 177-test browser net exists to compensate | geometry has no representation jsdom can read |
| PDF export builds a **second renderer** and re-renders the score | `export/scoreSvg.ts` + `outlineText.ts` | the only way to get the picture again is to draw it again |
| The ghost is a **third drawing path** with its own `Stave` | `GhostRenderer` **1,099** + `FanGhost` 118 | same reason |
| Incremental redraw reasons about **DOM groups + snapshots** | `MeasureSnapshot`, `MeasureRedrawKey`, `clearForRender` | the only record of "what was drawn" is the DOM — 🚨 which is exactly why the font bug in §3 could not be repaired by re-rendering |

⭐ **Every one of those is the same missing thing.**

### 7.2 The missing thing: a SCENE

```
   models/            layout/              engrave/              paint/
 what the music  →  how much room,   →  what SYMBOLS, where  →  ink on a surface
      IS            and where it goes        = THE SCENE
```

> ⭐⭐ **The engrave stage produces a SCENE: a plain typed array of primitives** — glyph, line,
> quad, curve, text, group — **in score coordinates, with no DOM and no VexFlow.** Paint turns a
> scene into SVG. Or canvas. Or PDF.

That is one new artefact and it pays for all four rows above:

1. ⭐⭐ **Geometry becomes a UNIT test.** *"the whole-bar rest is centred in its bar"* becomes an
   assertion on a scene, in jsdom, in milliseconds. This is the single most valuable item in this
   document — it is worth more than the golden-image net of §6.3, and **it is what makes P3 safe**.
   The browser suite stays, but as a check that paint agrees with the scene, not as the only place
   geometry can be seen at all.
2. **The golden becomes a SCENE diff, not a pixel diff** — stable across browsers and font versions,
   readable in review, and it names *which primitive moved* instead of showing a red blob.
3. **PDF stops being a second renderer.** Same scene, different painter.
4. **The ghost stops being a third path.** ⭐ A ghost is *the same scene with a style* — most of
   those 1,217 lines are deletion, not migration.
5. **Incremental redraw gets an honest key**: diff scenes, not DOM groups. `MeasureRedrawKey`'s
   *"the font is not in that key, and cannot be"* problem simply stops existing, because the scene
   **is** the geometry.
6. **VexFlow becomes swappable one element at a time**, because the adapter's output type is a
   scene primitive rather than a DOM node.

⚠️ **The honest costs.** One extra allocation per render — real, and the perf census
(`docs/render-performance-findings.md`) is how we would answer it rather than guess. And a
discipline problem: **a primitive that smuggles a DOM node into the scene defeats the whole thing.**
That is `lint:boundary`'s job, not review's.

### 7.3 The seam

> ⭐ **`engrave/vexflow/` is an ADAPTER that returns SCENE primitives.** It is the only directory
> importing `vexflow`, and **nothing outside it may hold a `StaveNote`.**

That rule ends the 40-signature problem in §2.1, it is checkable by the ratchet we already have, and
it gives the migration **one number to watch**: the LOC of that directory, falling.

### 7.4 Two more pieces the architecture needs

- ⭐ **`fonts/` owns the music font** — Bravura plus its SMuFL metadata — and answers exactly two
  questions: *how big is this glyph* and *where is its anchor*. `layout/spacingPadding.ts`'s
  hand-measured constants become **derived** from it, with `e2e/kerning.e2e.ts` staying as the
  check. This is P2, and it is what makes §3's bug class unrepresentable.
- **`MusicEngine` stays the editor's facade** and gains nothing but a delegation: `engrave(score,
  layout) → scene`, then `paint(scene, surface)`. That is the one-line delegation CLAUDE.md asks
  for, and it keeps a SCORE operation out of the editor's facade.

---

## 8. ⭐ The folder structure

```
src/engine/
  models/        # unchanged — what the music IS
  layout/        # unchanged, GROWS — how much room, and where. Pure arithmetic.
  fonts/         # NEW — Bravura + SMuFL metadata. The ONE answer to "how big is this glyph".
  scene/         # NEW — the primitive types, the builder, the diff. ⛔ no DOM, ⛔ no vexflow.
  engrave/       # NEW — music → scene. THE DECISIONS.
    notes/       #   noteheads, stems, flags, ledger lines, dots, accidentals
    beams/       #   beams, fans, tremolos
    curves/      #   slurs, ties
    lines/       #   hairpins, ottava, pedal, trills, the above-staff ladder
    text/        #   dynamics, tempo, expression
    staff/       #   staff lines, clefs, meters, barlines
    vexflow/     #   ⏳ THE ADAPTER — the only 'vexflow' import in the repo. Shrinks to zero.
  paint/         # NEW — scene → ink
    svg/         #   the editor's painter
    pdf/         #   absorbs most of today's export/
  export/        # STAYS, and thins to "which surface, which audience"
  ElementRegistry.ts / CoordinateMapper.ts   # STAY at the root — the editor's hit-testing seam
```

### 8.1 Where today's flat `rendering/` goes

60+ files, 20,053 LOC, in one directory. It is not disorganised — it is **unsorted**, because there
has never been a second place to put anything.

| today | goes to | note |
|---|---|---|
| `VexFlowRenderer.ts` (**4,467**) | splits across `engrave/*`, `paint/svg/`, `engrave/vexflow/` | ⭐ this split IS the project |
| `NoteBuilder`, `chordHeadLayout`, `chordAccidentalColumns`, `dotPlacement`, `ledgerAccidentalClearance` | `engrave/notes/` | P3's home; three of the five are already ours |
| `FanPass`, `FannedBeam`, `CrossBarBeams`, `beamInk`, `CenteredTremolo`, `TwoNoteTremolo` | `engrave/beams/` | already ours outright |
| `SlurRenderer`, `TieRenderer`, `curveArc`, `curveStyle`, `slur*`, `tie*`, `brokenSlurTilt` | `engrave/curves/` | already ours outright |
| `HairpinRenderer`, `OttavaRenderer`, `PedalRenderer`, `TrillRenderer`, `*Style`, `dynamicsLine*`, `tempoLinePass` | `engrave/lines/` | already ours outright |
| `TempoLayout`, `DynamicsLayout`, `drawnText` | `engrave/text/` | |
| `PagePass`, `GutterRenderer`, `barlineInk`, `staveGeometry`, `staffSpace`, `systemEdges` | `engrave/staff/` | |
| `GhostRenderer` + `FanGhost` (**1,217**) | ⛔ **mostly deleted** | a ghost is a scene with a style |
| `MeasureLayout`, `spacingPass`, `MeasureWidthCache`, `measureRenderRoles` | `layout/` | ⚠️ they are layout and always were — misfiled by history, not by design |
| `MeasureRedrawKey`, `RenderPass`, `MeasureSnapshot` | `scene/` | becomes a scene diff |
| `hiddenElements`, the colour modules | `paint/` | ⭐ audience (screen vs print) is a PAINT concern, not an engraving one |
| `ScoreTuplet`, `fanArticulations`, `NoteBuilder`'s VexFlow half | `engrave/vexflow/` | the shrinking pile |

### 8.2 The rules that keep it clean

All four are lint-checkable, in the spirit of the ratchet that already holds the framework boundary.

1. ⛔ **`layout/` and `engrave/` may not import the DOM, and may not import `vexflow`** — except
   `engrave/vexflow/`, the one exception, named in the check.
2. ⛔ **`paint/` may not import `models/`.** It knows the scene and nothing else. That is what makes
   a second painter (PDF, canvas) cost nothing.
3. ⭐ **Only `engrave/vexflow/` imports `vexflow`, and nothing outside it holds a `StaveNote`.**
   ⏭️ Its LOC is the migration's progress bar.
4. ⭐ **A new drawn element = a MODULE in the right `engrave/` folder + a ROW in its table + an
   EXISTING scene primitive.** A new primitive needs a reason — that is the guard against the scene
   growing into a second DOM.

### 8.3 ⚠️ How NOT to do it

⛔ **Not as a big move.** A rename-only commit across 60 files destroys the `git log -p`
archaeology that this codebase's comments lean on constantly (*"his report"*, *"measured
2026-07-30"*, *"the old bug"*), and it buys nothing until there is a scene to move **into**.

⭐ The order is the one the pieces already imply: `scene/` + `paint/svg/` land with **P1**, `fonts/`
with **P2**, and a file migrates into its `engrave/` folder **on the commit that touches it anyway**.
The directory that must exist first is `scene/` — everything else is where things end up, not where
to start.

---

## 9. ⭐⭐ My opinion, and the rule I would add

**Adopt the goal, reject the deadline, and add one rule.**

`vexflow-boundary.md` §4's test — *take a decision only when there is a rule we want to state and
can't* — has been right every time and stays. But it is a rule about **decisions**, and it has no
answer for **drawing**. That is exactly why the drawing stayed VexFlow's while everything around it
left: no feature ever had to argue about it. I would put a second rule beside it:

> ⭐⭐ **We decide the geometry; we increasingly own the INK; VexFlow's job shrinks to glyph shapes
> we do not want to invent.**

And the concrete form, for every future feature:

> ⭐ **A new drawn element draws through OUR context and OUR primitives — never by instantiating a
> VexFlow class.**

That is not a new practice, it is the existing one written down. Every drawn feature of the last six
months already did it: trills, ottava, pedal, hairpins, the dynamics line, the above-staff ladder,
the page pass, both tremolos, both curve families. The rule just stops the exceptions.

**And the one thing to do now: P1, the context seam.** Small, independently valuable, reversible —
and until it exists, every other piece has to be done twice.

Then P2 → P3 → P4 → P5. Stop after P2 and we have still killed a bug class. Stop after P3 and
`Stave.padding` is gone. **There is no point in this sequence where we are committed to finishing**,
which is the property that makes it worth starting.

⏭️ **Timeline, honestly:** P1 and P2 are weeks. P3 is the big one — the same work `FanPass` cost,
over a much wider surface, plus the golden net first. P4 is weeks with `beaming.md` already written.
⛔ I would not put a date on the whole thing and I would distrust any plan that does.

⚠️ **What would change this answer:** if VexFlow 6 ships and it is good, P3–P5 stop being worth it
and we should upgrade instead. **Nothing about P1–P2 changes either way** — which is a third reason
to start there.

⭐⭐ **And the licence is why I now think this is finishable** (§6.7). The one argument I could not
answer was §6.1 — that the last 30% is the part where we have no opinion, and that a
re-implementation without an opinion is worse than a dependency. MIT retires it: where we have no
opinion we **port, attributed**, exactly as `chordAccidentalColumns` already did. Having an opinion
becomes an improvement we make when he reports something, rather than a precondition for starting.
