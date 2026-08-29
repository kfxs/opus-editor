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
> ⭐⭐ **§0 is the short version, and it is the one to read before touching a drawn feature** — the
> goal order, the build order, the twelve standing rules with *when each binds*, and the one-line
> test that keeps eye music possible without anyone working on it.
>
> 📄 Read with `docs/vexflow-boundary.md`, which inventories who decides what today. This document
> is the second question: not *which decision to take next* but *whether the DRAWING should move
> too*. It also corrects one premise in that doc's §4 — see §4 below.

---

## ⭐⭐ 0. THE STANDING RULES — what binds while we develop

**Added 2026-08-29**, at his request: *"make clear what are the priorities and rules in the future
while we develop to make sure we will not close the door."* ⭐ **If you read one section of this
document before touching a drawn feature, read this one.** Everything here is argued somewhere
below; the **statement** is canonical here, the **argument** is canonical in the section named.
⚠️ Change one and change both — a rule list that drifts from its argument teaches readers to skip it.

### 0.1 The GOAL ORDER — his, and it settles every trade-off below

1. ⭐⭐ **Professional engraving.** The plate is the judge. When a rule and a convenience disagree,
   the rule wins; when a source and our taste disagree, we go and measure (`reference/README.md`).
2. ⭐ **Contemporary notation.** A first-class user of the engine, not an extension bolted on later —
   the survey of what it will ask for is already written (`docs/20c-notation-survey.md`).
3. **Eye music and graphic scores.** ⛔ **Never designed for. Never foreclosed.** The author decides
   what transformation their score wants; our only job is to not have made it impossible.

⭐⭐ **The practical reading, and it is the whole point: NONE of the rules below is work on eye
music.** Every one is a shape that costs nothing today and cannot be retrofitted cheaply after P3.
⛔ This section is not a licence to build graphic-notation features, and not an argument for
delaying engraving work by one day.

### 0.2 The BUILD ORDER

> **P2 ✅ done (2026-08-16) → P3 → P1 → P4 → P5.**

⚠️ This is §5's corrected order — P2 first, **P1 after P3** — not the original one. 🚨 §9 still
carries the pre-correction sentence *"the one thing to do now: P1"*; it is marked there, and §5 is
the authority. ⛔ **The one hard gate: do not start P3 before the golden-image net exists** (§6.3).

### 0.3 The RULES, ranked by when they bind

| # | rule | binds | argued in |
|---|---|---|---|
| 1 | ⭐⭐ **A new drawn element draws through OUR context and OUR primitives — never by instantiating a VexFlow class.** | **now** | §9 |
| 2 | **We decide the geometry; we increasingly own the INK.** VexFlow's job shrinks to glyph shapes we do not want to invent. | **now** | §9 |
| 3 | ⭐ **Where we have no engraving opinion: PORT it, attributed — do not invent.** VexFlow is MIT; the notice travels with the code, and you port the ALGORITHM, not the file. | **now** | §6.7 |
| 4 | ⭐ **A new drawn element = a MODULE + a ROW in its table + an EXISTING scene primitive.** A new primitive needs a reason. | **now** (the module+row half is already `CLAUDE.md`) | §8.2 |
| 5 | ⛔ **No inverse mapping written as straight-staff arithmetic.** Ask the placement; never compute `(staffTop − y) / spacing` by hand. | **now** | §7.5.4 |
| 6 | ⛔⛔ **A staff is a SPINE plus a thickness — not "a y and five lines".** One module owns where the lines go. | **now** — and it is the **hardest of all of these to undo** | §7.5.4 |
| 7 | ⭐⭐ **The rigid unit is a FRAGMENT.** A bar and a beamed group must be able to be REAL groups carrying their own transform, composed down the stack — ⛔ never flattened into absolute coordinates at build time. **Measured**: *Bike Ride* bends nothing, not even its beams; it rotates whole beamed groups on arc staff lines. ⛔ And therefore no non-affine WARP on spec. | **now** (it is a shape, not work) | §7.5.5 |
| 8 | ⭐⭐ **A scene primitive carries a PLACEMENT (an affine), not an (x, y).** Identity for every note ever engraved normally; `paint/` composes it down the group stack. | the day `scene/` is typed (**P1**) | §7.2, §7.5.4 |
| 9 | ⭐⭐ **The registry records the SPACE an element was drawn in, beside its box.** `withScale(k)` generalises to `withSpace(affine)`; the AABB fast path stays while the space is a translation. | when the scene lands — or sooner, the next time a coordinate field is added to `ElementInfo` | §7.5.2–7.5.4 |
| 10 | ⛔ **Only `engrave/vexflow/` imports `vexflow`, and nothing outside it holds a `StaveNote`.** Its LOC is the migration's progress bar. | **P1** | §8.2 |
| 11 | ⛔ **`layout/` and `engrave/` import no DOM and no `vexflow`** (one named exception). | partly **now** — `engine/layout/` and `engine/fonts/` are already fenced by `lint:boundary` | §8.2, `ARCHITECTURE.md` |
| 12 | ⛔ **`paint/` may not import `models/`.** It knows the scene and nothing else — that is what makes a second painter cost nothing. | **P1** | §8.2 |

### 0.4 ⭐⭐ The one-line test, for any drawn feature

> **"If the staff were a circle, how many files would have to change?"**
> The only acceptable answer is **two** — the module that draws the staff, and the one that places
> music on it. **Every other file that would have to change is a reader that assumes**, and
> `ARCHITECTURE.md` already states the general form of this: *what forecloses a future is a READER
> THAT ASSUMES, never a field that is missing.*

⭐ It is a cheap test because it needs no eye-music feature to exist: it is answerable by reading the
diff you are about to write. ⚠️ And it is the *whole* obligation — ⛔ nobody is being asked to make
the circle work, only to not be the reason it can't.

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
| `annotation`, `tuplet`, `timesignature`, `clef`, `stavebarline`, `curve`, `tremolo` | ~1,050 | mixed; `curve` already reimplemented, and ✅ **`stavebarline` is now ours for every line that ENDS a bar** (`rendering/BarlineRenderer`, 2026-08-26) — only the line that opens a system is still drawn from it |

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

### 7.5 ⭐⭐ The scene must not assume the staff is STRAIGHT — read out of *Belle, Bonne, Sage*'s source

> His brief (2026-08-29): *"main goal primary of our project is make really beautiful and well
> engraved music very professional, but the goal of the engine is also to do contemporary music and
> graphic scores… with our own engine we will be able to do other eye music scores, so doing
> transformations like bending a staff or a spiral staff for example — it is just an example, we
> should do any number of transformations, the author of the score should decide… eye music is not
> the main goal, the main goal is professional engraving and contemporary music, however we should
> have all this into account cause we should not limit our engine to not make eye music."*

**The order is: professional engraving first, contemporary notation with it, eye music never
*designed for* but never made IMPOSSIBLE.** That is not a feature request; it is a constraint on
§7.2's scene, it costs nothing today, and every part of it gets expensive after P3.

⭐⭐ **The precedent is on disk and it was READ, not guessed** — `~/dev/engine-sources/belle`
(BSD-2-Clause, one commit; papers and manifest in `reference/belle/` + `reference/README.md`).
*Belle, Bonne, Sage* exists because William Andrew Burnson needed to engrave one piece of eye music
— *Bike Ride* (2007/2009, solo piano, the staves are the two wheels of a bicycle) — and no tool
would do it; it then grew into a conventional engraver that *"strives to conform to typesetting
guidelines set forth in Behind Bars"*. ⛔⛔ **It is still NOT a source for traditional engraving**
(`reference/README.md`): conventions stay with the treatises and Verovio / LilyPond / MuseScore.
It is read for one thing only — **what shape lets a score be a wheel.**

#### 7.5.1 ⭐⭐ What Belle actually does — and the surprise is that the ENGRAVER is translate-only

Four files answer it (`belle-graphic.h`, `belle-stamp.h`, `belle-abstracts.h`, `belle-placement.h`):

1. ⭐ **A `Graphic` is a path + an affine + a colour + a back-reference.** Verbatim: *"Persistent
   graphical object containing path, affine transform, and color. It can also link back to a node on
   the graph, which is useful for tracking where the graphic object originated from."* Fields:
   `Pointer<const Path> p`, `Affine a`, `Color c`, `number w` (*"if non-zero, strokes the path with
   this width instead of filling it"*), `Music::ConstNode Context`, `bool Spans`. **That is §7.2's
   scene primitive, already built, in 182 lines** — and its `Context` is our element id.
2. ⭐⭐ **A `Stamp` is an array of `Graphic`s plus ONE affine** — *"the transformation (in system
   space) to be applied to the stamp"* — hung off one island of the music graph. `Paint()` is
   `Painter.Transform(a)` → paint each graphic → `Revert()`. Nesting composes:
   `AccumulateGraphics` sets `child.a = parent.a * child.a`.
3. **The `Painter` is a device-independent affine STACK**: `Translate` / `Scale` / `Rotate` /
   `Transform` / `Revert` / `CurrentSpace()`, and every device (PDF, SVG, CoreGraphics, JUCE)
   implements exactly one primitive — `virtual void Draw(const Path&, const Affine&) = 0`.
4. 🚨🚨 **And yet every engraving module writes only a TRANSLATION.** Grepped across all 200 headers:
   every `->a =` site — accidentals, flags, articulations, dots, key signatures, ledger lines, octave
   signs, pedal, rests, notes, measure rests, time signatures — is `Affine::Translate(...)`; the clef
   alone adds a `Scale`. `Affine::Rotate` appears in the whole engraver **once**, in
   `belle-optics.h`, and it is angle arithmetic for a slur anchor, not a placement.

⭐⭐ **So the eye music is not in the engraver. It is in the SEAM, and the seam is ONE LINE.**
`belle-placement.h` paints a system as: `PaintStaffLines(...)` → `PaintStaffBrackets(...)` → for each
island, `s->a = Affine::Translate(Vector(in["TypesetX"], y)); s->Paint(Painter);`. **That is the only
place in the library where a musical position becomes a page position.** Bend the staff lines in
`PaintStaffLines` and replace that one affine with a point-and-angle on the curve, and every module
that draws a notehead, a flag, a dot or an accidental is untouched, because all of them draw in
**stamp space** — relative to their island's origin — and none of them ever asks where the page is.

⚠️ **The honest caveat, so nobody quotes this as more than it is.** Belle 1.0.2 *does not* engrave
*Bike Ride*: the piece was drawn in 2010 against the vector-graphics layer directly, years before
this engraver existed, and nothing in the shipped code places music on a curve. The claim is only —
and it is the useful claim — that **its architecture leaves exactly one line to change**, and ours
today leaves none.

#### 7.5.2 ⚠️ Where WE would close the door — three places, all measurable today

- 🚨 **There is no stamp space. VexFlow objects place *and* paint themselves in page coordinates.**
  `new Stave(x, y, width)` then `.draw()`; every pass computes absolute y from `getYForLine`. There
  is nothing between "which staff line" and "which pixel" that could be given a transform. **This is
  what P1 + `scene/` fix anyway** — §7.5 asks for one extra field while it happens, not for a
  different project.
- 🚨🚨 **`ElementRegistry`'s vocabulary is AABB + TRANSLATION, and it is the source of truth for
  geometry** (`ARCHITECTURE.md` §"The renderer is the source of truth for geometry"). Every entry is
  `bbox {x, y, width, height}`; `offsetElement(dx, dy)` and `shiftById(dx, dy)` translate the box
  **and** each per-kind coordinate field one by one — `points`, `controlPoints`, `slurEndpoints`,
  `segmentEndpoints`, `ottavaAxis`, `guideLine`. Under a rotation every one of those is wrong, and
  an axis-aligned box around rotated ink is not the ink. ⭐ **Belle already solved this and the fix
  is one field**: `Graphic` caches `PaintedSpace` (*"the affine space of the graphic as painted"*)
  **beside** `PaintedBounds`, both *"generated after the paint because that is when the final
  position is known"* — which is our registry's own timing exactly.
- ⭐ **We have already built a transform scope once, and its comment is the argument.**
  `ElementRegistry.withScale(k)` exists because a small staff is drawn inside
  `<g transform="scale(k)">`: *"one seam, so no call site changes… it is scoped state rather than a
  parameter for the same reason a graphics context has a transform: the code in between does not
  want to know"* — ~30 `add` sites across seven modules, none of which learned anything. That is
  Belle's `AffineStack` with one coefficient instead of six. 🚨 It is also, per
  `docs/staff-size-plan.md`, **THE bug class** (visual coordinates inside a scaled scope), which is
  the reason to generalise the seam *once*, deliberately, rather than to grow a second one by hand.

#### 7.5.3 Where it fits in ARCHITECTURE and DESIGN-PRINCIPLES — it already fits, in ONE compartment

- ⭐⭐ **`DESIGN-PRINCIPLES.md` §3 settles the model question outright.** A bent staff is *how it is
  shown*, so ⛔ it is **not** music: no `Score` field, no measure property, nothing in the JSON's
  content half. But §3 also names **three** compartments, and the third is *authored presentation* —
  the reason `engravingOverrides` is allowed to live in the score value at all: *"a user expects a
  choice they made to still be there tomorrow"*. **An author-chosen transformation is that
  compartment's kind of thing, not layout's** — it is a decision, not a derived view, and a layout
  pass must never write one.
- ⚠️ **But it is not `engravingOverrides` as built**, and for the reason already written down there:
  that compartment is **id-keyed, element → adjustment, anchor-relative**. A staff transformation has
  no single element to anchor to — its key is a **staff × range**, the same shape as
  `staffSpacing`'s `staffId@openingMeasureId`. ⭐ So it lands on the **already-parked boundary case**
  *"Where do document-wide ENGRAVING settings live?"*, whose stated resolution is a document-level
  compartment beside content. ⛔ **Nothing to decide now** — the entry exists to hold the question
  open, and this is a third stakeholder for it, recorded in that file.
- **Contemporary notation needs none of this and is not blocked by it.** `docs/20c-notation-survey.md`
  §7 is staff-and-clef departures, and Belle makes the same point without meaning to: its staff line
  **count** is per-staff state (`"Lines"`, and `<= 0` draws none), which is all a 1-line percussion
  staff or a staffless passage ever needed. ⭐ That half is a *model* question, already surveyed, and
  independent of any transform.
- ⭐ **`ARCHITECTURE.md`'s existing rule covers the rest**: *"what forecloses a future is a READER
  THAT ASSUMES, never a field that is missing"* (the `barlineJoinsBelow` entry). Every item below is
  a reader, not a field.

#### 7.5.4 ⭐⭐ What to change in the plan — four decisions, ZERO work now (a fifth arrives in §7.5.5)

None of these builds eye music; each stops one door from shutting. Three are decided when `scene/`
is written (P1), one is a rule.

1. ⭐⭐ **A scene primitive carries a PLACEMENT, not an (x, y).** One field — a 2×3 affine, identity
   for every note ever engraved normally — and `paint/` composes it down the group stack, exactly as
   `Stamp::Paint` does. ⛔ The alternative (bake page coordinates into each primitive at build time)
   makes eye music a second renderer, and it also costs us the cheap version of the ghost, the PDF
   painter and the scene diff, all of which want a primitive to be movable without being rebuilt.
2. ⭐⭐ **The registry records the SPACE an element was drawn in, beside its box.** Generalise
   `withScale(k)` → `withSpace(affine)` on the same seam that already works, and store the local box
   **plus** the space (Belle's `PaintedSpace` + `PaintedBounds`). Hit-testing keeps its fast AABB
   path when the space is a translation — i.e. always, today — and stays *correct* rather than
   silently wrong the first time it is not. ⚠️ The alternative is discovering the ~30 `add` sites and
   six coordinate fields again, later, under a feature.
3. ⛔ **No inverse mapping may be arithmetic on a straight staff.** `pixelToPosition`-shaped code
   asks the placement (invert its affine), it does not compute `(staffTop − y) / spacing`. ⭐ Cheap
   to hold now because `CoordinateMapper` is already documented as the *fallback* and the registry is
   the truth.
4. ⛔ **A staff is a SPINE plus a thickness, not "a y and five lines".** One module owns where the
   lines go — Belle's whole staff drawing is one function, `PaintStaffLines` — so that bending them
   is an edit in one file rather than a search across the engraver. This is the one item that is
   genuinely hard to undo, because it is the assumption every other pass reads.

⚠️ **On the limit — an earlier draft of this section overstated it, and §7.5.5 below is the
correction.** It said a curved staff would eventually need a **non-affine warp** of the paths. ⛔ It
does not: the plate was then measured, and *Bike Ride* warps nothing at all. Read §7.5.5 before
designing anything here.

#### 7.5.5 ⭐⭐ …and the PLATE says NOTHING IS WARPED — measured on *Bike Ride* itself, 2026-08-29

> His pushback, thinking out loud: *"no the glyphs are not bended, they are rotated, but the beams
> can bend and probably other elements… i'm not sure if what i say make sense."*

**It makes sense, he is right about the glyphs, and the engraving goes one step further than his
guess — the beams do not bend either.** Rendered from the ICMC PDF at 600 and 1200 dpi and read
(`reference/belle/bike-ride-rim-detail-600dpi.png`, `bike-ride-beamgroup-detail-1200dpi.png`):

| ink | what *Bike Ride* actually does |
|---|---|
| staff lines | ⭐ **true concentric ARCS** — the only genuinely curved ink in the picture |
| noteheads, accidentals, clefs, rests | **rotated, never deformed** — the ovals tilt with the local angle. ✅ exactly his point |
| **beams** | 🚨 **STRAIGHT.** Every triplet group's beam is a straight chord *crossing* the arcs beneath it. ⛔ Not an arc, not a wedge |
| stems inside a group | **parallel to each other**, tilted as a unit — not radially splayed |
| tuplet numerals, `Molto accelerando!!!`, `pp` / `p` | rotated with their group |
| the `pp` line, the long lead line | drawn **straight**; the score does not insist that spans follow the rim |

⭐⭐ **So the rigid unit is the BEAMED GROUP, and the whole group is placed by ONE affine.** The
curvature is absorbed *between* fragments, never inside one — a polygon of straight groups laid on a
circle of staff lines, and at reading size the eye accepts it completely. **There is no warp
anywhere in the one piece of eye music we hold.**

⭐⭐ **Which retires the "warp" question and replaces it with a much cheaper one.** The design
requirement is not a non-affine deformation. It is:

> ⭐⭐ **The scene's unit of placement must be able to be a FRAGMENT — a bar, a beamed group, a
> single stemmed note — not only a whole system.** §7.2 already lists `group` among the primitives;
> the rule this adds is that the natural rigid units must be REAL groups carrying their own
> transform, composed down the stack (Belle: `child.a = parent.a * child.a`), rather than flattened
> into absolute coordinates at build time.

Three kinds of ink, and each has an answer that already exists:

1. **POINT ink** (every glyph) — one affine: translate + rotate. ⛔ Never deformed.
2. **RIGID FRAGMENT** (a beamed group, a stem + head, a bar) — one affine for the whole group. This
   is what the plate does, beams included.
3. **SPINE ink** (staff lines; and any span an author *chooses* to make follow the curve — slur,
   hairpin, ottava) — ⛔ not a transform at all: **re-solved from the spine**. Same primitive (arc,
   Bézier, quad), different control points. ⭐ And we have already built exactly this reasoning once,
   for a different reason: a **multi-system span re-solves per segment** (`docs/multisystem-slur-plan.md`,
   the span-mark family). A curved staff is that problem with a curved spine instead of a line break.

⚠️ **What would still need a warp**, so the limit is not lost: insisting that a *single* beam bend
within its own group, or that a notehead squash to the local curvature. **No source we hold does
either**, and Solomon's LP (ICMC 2011, `docs/spacing-model-research.md` §6f) warps a *graphic*, not a
staff. ⛔ Still nothing to build on spec — but the honest statement is now *"a warp is a taste
upgrade nobody has taken"*, not *"the hard part we cannot do"*.


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

Then P2 → P3 → P4 → P5.

> 🚨 **STALE — corrected 2026-08-16, in §5, and left standing here so the change is visible.** The
> order is **P2 → P3 → P1 → P4 → P5**: P1 is the *highest*-blast-radius piece, not the lowest,
> because while VexFlow objects still paint themselves our context must implement **VexFlow's**
> `RenderContext` anyway. P2 is done. **P3 is next** (⛔ after the golden net). The two sentences
> above keep their reasoning — a context seam really is what stops work being done twice — but
> ⛔ **do not read them as the running order.** §5 and §0.2 are the authority. Stop after P2 and we have still killed a bug class. Stop after P3 and
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
