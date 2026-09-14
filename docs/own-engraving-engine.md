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

> ⭐⭐ **THE PRIORITY, his call 2026-09-14: GET RID OF VexFlow FIRST. The engine GROWS after that.**
> Anything that is not a step toward removing the dependency waits, however good an idea it is —
> ⏭️ in particular **ONE HOUSE-STYLE OBJECT** (every sourced table — `dotGap`, `accidentalGap`,
> `beamSlope`, the spacing law, the header ladder — gathered into one thing a PRESET loads) is
> agreed as the direction and ⛔ deferred until after removal. ⭐ Take it into account meanwhile:
> a new number is written as a changeable ROW (rule 13), so the gathering later is a move, not a
> rewrite. The research waves (`docs/engraving-number-inventory.md`) run in the background and
> ⛔ never block a removal step.
>
> ⭐⭐ **THE ORDER is `docs/vexflow-removal-map.md` §9 (S0–S14)** — measured with the TypeScript
> compiler, and it supersedes this document's phase order where §10 of the map says they disagree.
> ⭐ **THE GAUGE is `npm run lint:vexflow`** (S0, in `build:check`): 1,449 VexFlow uses outside the
> specs in seven roles, each a ceiling that may only fall.
>
> ✅ **Progress (2026-09-14):** S0 the census · S1a the fonts are ours (`engine/fonts/fontFiles` +
> `rendering/musicFontFaces` — the page no longer depends on VexFlow's import to have Bravura) · S1b the
> inherited numbers are rows (`engine/engrave/inheritedDefaults`) · S1c the faces each category resolved
> are rows (`engine/engrave/inheritedFonts`) · S2a the staff's lines are asked of ONE module
> (`engine/engrave/staff/staffFrame`) · S2b the bar's horizontal frame (`BarFrame`) and ONE stale shift.
> **1,449 → 1,263 uses; R7 50 → 0, R1 175 → 57.**
> ⏭️ S2c, a note's frame (`Note.getStave`).

> 🚨 **CORRECTED AGAIN 2026-09-01: P2 ✅ → P1a–P1d ✅ → P3 (a–d ✅, e ⏳) → P4 ✅ → P5 (a ✅, b ⏳,
> c ✅) → P1e → P6.**
>
> ⏳ **P5b, 2026-09-13: EVERY PIECE OF INK A SCORE STAVE DRAWS IS NOW OURS** — the five lines (P5a),
> the clef (09-02), the meter (09-12) and the **opening BARLINE** (09-13); the key signature never
> was VexFlow's. ⇒ what is left of P5b is the **PLACEMENT ALONE**: every x below is still
> `Stave.format()`'s modifier walk. ⭐ The two-sets-of-numbers pair P5 is named after is the whole of
> the remaining work, ⛔ no longer half of it.
>
> ⭐⭐ **And the barline step deleted a PASS rather than only moving ink** — `barlineInk.inkBarlines`,
> the DOM repair that widened VexFlow's 1 px rect to 0.16 sp on every render. See P5b's third step.
>
> ⭐ **P6 — the RULER — was added 2026-09-01 on his call**, and it is the one piece nothing in this
> plan had ever named: we have been taking the INK one element at a time while every BOX is still
> VexFlow's or the page's. See §5's P6 for the audit.
>
> 🚨🚨 **…and the LETTERS ARE NOT THE WHOLE JOB.** Three pieces are owned by no phase at all — the
> **`Curve`**, the **fan's member group**, and the **HIGHLIGHT** — and they are one knot rather than
> three chores. All three were found by pulling on P1e on 2026-09-01, two of them for the second
> time. ⇒ ⭐ **§5's "THE UNLETTERED WORK" (U1–U3) is where they now live**; read it before assuming
> the lettered sequence is a complete plan.
>
> ✅✅ **U1 IS DONE (2026-09-14) — the curve's INK is ours**, and it is the **first step that moved
> the P1e gate**: `lint:paint` **18 → 9**, where P3, P4 and P5 had each left it at 18. ⇒ ⭐⭐ the only
> VexFlow object still painting its own ink is **the fan's bare `NoteHead`s and `Accidental`s** (U2,
> blocked on U3); the other five uses are the beam's and the stem's `.draw()` plumbing, and four
> `.svg` read-backs that are MEASUREMENTS, ⛔ not painting.
>
> 🚨🚨 **…AND THE SAME DAY, THAT NUMBER WAS SHOWN NOT TO BE A COVERAGE MEASURE.** P3f took the note's
> MODIFIERS — the accidental and the augmentation dot — and **neither had ever been counted by it**:
> `lint:paint` matches the identifier `vexContext`, and a modifier never writes one, because
> `StaveNote.drawModifiers` hands it `checkContext()`. Every accidental and every dot on every page
> was VexFlow ink through all of P3, P4, P5 and U1, invisible to the gauge AND to the scene. ⭐ Found
> by CENSUS — the page's glyphs diffed against the scene's — which is now a test
> (`note-engraving-plan.md` §1f). ⇒ ⭐⭐ **count the INK, not the identifier**; the ceiling measures
> COUPLING and always did.
>
> ✅✅ **…and P3g CLOSED that census the same day — the ARTICULATION's ink is ours**, which §0.1 of
> the P3 plan had refused as *"not ink alone"*. ⭐⭐ **The refusal was about WHERE TO CUT, not about
> the piece**: `Articulation.draw()` is forty lines of placement and one of ink, so cutting at
> `draw()` would have meant transcribing the rule — but `renderText` is public, and cutting THERE
> leaves the rule with its ONE owner. ⇒ **every glyph an ordinary bar draws is now in the SCENE**,
> and the census asserts it. ⛔ The gauge did not move and could not: an articulation never wrote
> `vexContext` either (`note-engraving-plan.md` §1g).

⚠️ The previous order — *P2 → P3 → P1* — was **circular and could not be started**: P3 is gated on a
verification net, the best net is the SCENE (§7.2), the scene ships with P1, and P1 was scheduled
after P3. §5's P1 section carries the argument and the three steps. ⭐ The demotion's reasoning
still stands for P1's *implementation* and never applied to its *interface*, which is where the loop
is cut.

✅ **The hard gate of §6.3 is answered** — the net exists, and it is the scene rather than a pixel
golden (`engine/scene/`, P1d). ⚠️ Half-lifted, not lifted: the scene sees what OUR primitives draw,
and P3 is the work of moving the note into that half — so P3 builds the rest of its own net as it
goes, element by element. ⛔ **P1e** (a painter of ours) stays after P3, for the reason that demoted
P1 originally and still holds: while VexFlow objects paint themselves, a replacement painter must
implement *their* interface too.

🚨 §9 still carries the pre-correction sentence *"the one thing to do now: P1"*. It is marked stale
there — ⚠️ note that its *conclusion* has now come back round to being right, by a different route
than the one it argued; §5 and this section remain the authority on the order.

### 0.3 The RULES, ranked by when they bind

| # | rule | binds | argued in |
|---|---|---|---|
| 1 | ⭐⭐ **A new drawn element draws through OUR context and OUR primitives — never by instantiating a VexFlow class.** ⭐ The one sanctioned way to put a music glyph down is `rendering/glyphPainter.ts` (P1a) — ⛔ not `new Element(...)` in your own file. | **now** — ✅ held through 277 commits, re-checked 2026-09-01 (§2.2) | §9, §5 P1a |
| 2 | **We decide the geometry; we increasingly own the INK.** VexFlow's job shrinks to glyph shapes we do not want to invent. | **now** | §9 |
| 3 | ⭐ **Where we have no engraving opinion: PORT it, attributed — do not invent.** VexFlow is MIT; the notice travels with the code, and you port the ALGORITHM, not the file. | **now** | §6.7 |
| 4 | ⭐ **A new drawn element = a MODULE + a ROW in its table + an EXISTING scene primitive.** A new primitive needs a reason. | **now** (the module+row half is already `CLAUDE.md`) | §8.2 |
| 5 | ⛔ **No inverse mapping written as straight-staff arithmetic.** Ask the placement; never compute `(staffTop − y) / spacing` by hand. | **now** | §7.5.4 |
| 6 | ⛔⛔ **A staff is a SPINE plus a thickness — not "a y and five lines".** One module owns where the lines go. | **now** — and it is the **hardest of all of these to undo** | §7.5.4 |
| 7 | ⭐⭐ **The rigid unit is a FRAGMENT.** A bar and a beamed group must be able to be REAL groups carrying their own transform, composed down the stack — ⛔ never flattened into absolute coordinates at build time. **Measured**: *Bike Ride* bends nothing, not even its beams; it rotates whole beamed groups on arc staff lines. ⛔ And therefore no non-affine WARP on spec. | **now** (it is a shape, not work) | §7.5.5 |
| 8 | ⭐⭐ **A scene primitive carries a PLACEMENT (an affine), not an (x, y).** Identity for every note ever engraved normally; `paint/` composes it down the group stack. | ✅ **LANDED — `paint/Affine.ts` + `DrawGroup.setPlacement`, P1c 2026-09-01.** Every group placement in the engine is now an affine | §7.2, §7.5.4, §5 P1c |
| 9 | ⭐⭐ **The registry records the SPACE an element was drawn in, beside its box.** `withScale(k)` generalises to `withSpace(affine)`; the AABB fast path stays while the space is a translation. | when the scene lands — or sooner, the next time a coordinate field is added to `ElementInfo` | §7.5.2–7.5.4 |
| 10 | ⛔ **Only `engrave/vexflow/` imports `vexflow`, and nothing outside it holds a `StaveNote`.** Its LOC is the migration's progress bar. | **P1** | §8.2 |
| 11 | ⛔ **`layout/` and `engrave/` import no DOM and no `vexflow`** (one named exception). | partly **now** — `engine/layout/` and `engine/fonts/` are already fenced by `lint:boundary` | §8.2, `ARCHITECTURE.md` |
| 12 | ⛔ **`paint/` may not import `models/`.** It knows the scene and nothing else — that is what makes a second painter cost nothing. | **P1** | §8.2 |
| 13 | ⛔⛔ **A NUMBER IS NEVER A BLOCKER.** Every engraving number is one house style's DEFAULT that the user will be able to change, so no default is definitive. When a step needs a number nobody has researched or chosen: **use what runs today** (or the best-sourced option), **build it as a changeable row, not a constant**, record the research as a follow-up, and **keep building**. The research is still wanted — it becomes the preset menu — but ⛔ it never stops a phase. | **now** — his rule, 2026-09-14 | `memory: house style`; `docs/engraving-number-inventory.md` |

⚠️ **Rule 13 supersedes older wording in this document.** Where a phase below says a piece is
*"gated on research"*, *"blocked on his pick"* or *"nothing to build without his pick"* because of a
NUMBER (the stem-shortening slope, the beam slope, the ledger overhang, the flag reach, the stem
thickness…), read it as: *the default is what runs today, and the options are future preset rows*.

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

> 🚨🚨 **RE-MEASURED 2026-09-01 (HEAD `e4ebaba`) — the surface GREW 39% in 16 days, and that is the
> single most important fact this document has gained since it was written.** 277 commits between
> `7b4f5da` and here, none of them on this plan:
>
> | | audit (08-16) | now (09-01) | Δ |
> |---|---|---|---|
> | `engine/rendering/` non-test LOC | 20,053 | **27,813** | **+39%** |
> | files there | 66 | 92 | +26 |
> | non-test files importing `vexflow` | 27 | **41** | +52% |
> | files whose signatures carry a VexFlow type (§2.1's "40") | 31 | **45** | +14 |
> | `ctx: SVGContext` parameters | 21 | 28 | +7 |
> | `ElementRegistry.ts` LOC | 1,490 | 2,013 | +35% |
> | coordinate fields the registry's 3 handlers must translate | 8 | **12** | +4 |
>
> ⭐ **The good news first, and it is real: RULE 1 HELD.** Every one of the 14 new `vexflow`
> importers is an `import type` or VexFlow's `Element` used as a glyph painter — ⛔ not one new file
> instantiates a drawing class to place music. Instantiation is still in the same six files it was.
>
> 🚨 **So the diagnosis is precise: the rules that bind "now" are being kept, and the rules that bind
> "at P1" are violated by default because P1 has not happened** — and their surface is the fastest-
> growing number in the repo, because every new mark family adds one or two `ctx: SVGContext`
> signatures for want of anything else to name. ⭐ That is the argument that moved P1 to the front
> (§5).
>
> 🚨🚨 **Rule 9's stated trigger fired four times, unnoticed.** It binds *"when the scene lands — or
> sooner, **the next time a coordinate field is added to `ElementInfo`**"*. Four were added since the
> audit, one at a time, each under a feature: exactly the *"discovering the ~30 `add` sites and six
> coordinate fields again, later, under a feature"* that the rule exists to prevent. ⛔ It is twelve
> fields now. ⭐ A trigger nobody is scheduled to check is a trigger that does not fire.
>
> ⚠️ The absolute numbers below are the 2026-08-16 ones and are kept as written — the argument they
> support (*the residue is not one lump*) is unchanged, and re-stamping them every fortnight would
> cost the comparison above its baseline.

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
- After `format()` we **re-assert** stem directions, the rest lines we decided, measure-rest centring
  and clear VexFlow's auto x-shift — `StaveNote.format()` rewrites all four for multi-voice.
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

### 3.1 ⭐⭐ …and this is the class of RULE it has no answer to — multi-voice rest placement

2026-08-31, his report: *"we are having an issue with multivoice rest placement… this is because we
don't have a proper mechanism to vertical position rest in the good spot so the user have to do it,
but this must not be… i think the rule we have of the position that is very relative was before we
had real literature."*

⭐ **§3 is the ruler being wrong. This is the ruler having no opinion at all**, and it is the second
canonical example this audit has — worth folding in whole, **question and answer**, because it is
the first time the two halves have been measured on the same page.

**THE QUESTION — what four books and four engines say.** Full evidence in
`docs/multi-voice-rest-position.md`; the shape of it:

| | LilyPond | Verovio | MuseScore 4 | **VexFlow 5** |
|---|---|---|---|---|
| per-voice constant | ±2 sp (`voiced-position`) | none — a 4-D default table | ±1 sp (parity) | **none** |
| content-aware | ✔ notehead **ink** | ✔ note positions, no ink | ✔ **shape**, incl. stem | **✘** |
| sees a *sustaining* note | ✔ | ✔ | ✔ | **✘** |
| consistency pass | ✘ | ✘ | ✔ `alignRests` | ✘ |

And the books are unanimous where the engines differ — Gould pp. 34–37, Ross pp. 173–176, Gerou &
Lusk pp. 114–115, Stone p. 135, agreeing that **the SIGN is positional, the MAGNITUDE is derived
from surrounding content, and the RESULT is quantised to whole staff spaces.**

⛔ **VexFlow's entire contribution is `rest.line += 1`** — one nudge, in `StaveNote.format`, gated on
notes at the **same start tick**; `Formatter.AlignRestsToNotes` is per-voice and default off. ⭐⭐ And
**we already suppress even that**, by re-asserting `intendedRestLine` after `format()` (correctly —
its nudge is wrong for our voice model). So **100% of this rule comes from us, and there is no
library behaviour to fall back on.** What we had instead was a fixed four-lane table
(`REST_LANE × REST_LINE_STEP`) sitting in the paint layer, which can express the sign and nothing
else. The bill arrived as **67 hand-placed `restShift` overrides** in one example file, in a piece
with one repeating texture — the user doing, by hand and 67 times, what no layer of ours had an
opinion about.

**THE ANSWER — `engine/layout/restVoicePlacement.ts`** (plan: `docs/multi-voice-rest-position-plan.md`).
Verovio's shape (the outermost of named candidates) with LilyPond's ink clearance. Four properties
matter to *this* audit, and each is an argument the rest of this document makes in the abstract:

1. ⭐⭐ **The missing input was never precision — it was the MODEL.** The fact the rule needs is
   *what SOUNDS across the rest's span*, not what starts at its tick, and VexFlow's
   `ModifierContext` is keyed on the start tick, so it **structurally cannot represent the
   question**. LilyPond names it in a comment (*"Include notes that started any time"*). ⛔ No
   amount of reaching past the public type fixes that; only owning the layer does. That is a
   sharper version of §2.3's finding: VexFlow is a ruler, and a ruler cannot be told about time.
2. ⭐ **It yields a LINE, not a pixel** — the exact shape §7.2's SCENE wants, and the reason the PDF
   export (`export/scoreSvg.ts`, its own `VexFlowRenderer`) is carried by the same seam with nothing
   added. §0.4's one-line test decides that much: a headless export needs the identical position, so
   the rule cannot live where only the editor's renderer can reach it. ⭐⭐ **But *which stage* it
   belongs to is the sharper question, and it is the best probe this project has yet had for the
   LAYOUT / ENGRAVE line — §7.2.1.**
3. ⭐⭐ **It is ink-aware WITHOUT `getBBox()`**, because P2 gave us a measured extent table
   (`layout/spacingPadding`, held against Bravura by its own font test). LilyPond's and MuseScore's
   clearance can only ever be exercised in a browser; ours is a pure function and its whole spec
   runs in jsdom. ⭐ **That is the P2 dividend, arriving in a feature P2 never anticipated** — and
   the concrete reply to §6.2: this rule is not "newly wrong", it is newly *checkable*.
4. 🚨 **The second owner is the tell.** `SelectionController` held a private copy of the rest-lane
   rule for the voice hop, with a comment claiming the two *"stay in lockstep by construction"*.
   They had not been in lockstep since either was written — one counted staff spaces, the other
   diatonic steps. ⭐ That is §2.4's coupling cost in a place §2.4 does not count: not a cast or a
   monkeypatch, but a **rule with no home**, copied because there was no module to import.

⚠️ **The one place it argues AGAINST us — and the correction it got within the hour.** Three and
four voices are **UNKNOWN in every book and declined in Verovio's own code**, so the derived rule
first gave V1 and V3 the same line where the old ladder separated them. It shipped as a *stated*
regression rather than a discovery on his screen, and he refused it on sight: the V3/V1/V2/V4 order
was **his call, made 2026-07-23**, and a rule that cannot derive something has no standing to delete
a decision that was never derived in the first place.

⭐⭐ **That is the sharpest lesson in this section for the engine project**, because it is the shape
every P3–P5 item will meet: §6.1 says the residue is *"the part with no rules written down"*, and
this is what that residue actually looks like from inside — not a blank to be filled by whichever
engine we last read, but **a place where his taste is already the specification**. ⛔ The failure
mode is not "we have no opinion"; it is *forgetting that he does*. ⭐ And the fix cost nothing
architecturally: the order came back as one more candidate in the same outermost-wins combination,
priced in the same measured ink and the same `GAP` — **no new constant**. ⭐ A taste call that can
be expressed in the rule's own vocabulary is not a compromise of the rule.

⭐⭐ **Read together with §6.1, this is the strongest correction to it in the document.** §6.1 warns
that the residue is the part with no rules written down. Rest placement *looked* like that residue —
a taste constant nobody had questioned — and turned out to have **four books in agreement, three
engines to compare against, and a measurable fit against his own 67 hand-drags**. ⛔ The lesson is
not that §6.1 is wrong; it is that *"we have no opinion"* is a claim about the library shelf, and
this project's shelf is now good enough that the claim has to be **re-checked per feature**, not
assumed. `reference/README.md` is the first stop, and it had no row for this question before
2026-08-31.

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

### P1 — Our own render context ⏭️ **STARTED 2026-09-01 — and it goes FIRST after all, in three steps**
Our renderers already use **20 primitives**: `openGroup`/`closeGroup`, `beginPath`/`moveTo`/
`lineTo`/`closePath`/`stroke`/`fill`/`fillRect`, `setLineWidth`/`setStrokeStyle`/`setFillStyle`/
`setLineDash`, `setFont`/`fillText`/`measureText`, `save`/`restore`, `scale`, `pointerRect`.
VexFlow's `SVGContext` is 394 LOC.

⭐ **Cheapest piece, most leverage, and it is what makes every other piece optional** — after it,
VexFlow objects only have to hand us numbers, never paint. It also closes four standing gotchas at
once: `save`/`restore` being no-ops, the `setStyle` context leak, `openGroup`'s `vf-` prefix, and
`getSVGElement`'s document-wide `getElementById`.

#### 🚨 Why it moved back to the front — the ORDER in §0.2/§5 was CIRCULAR

His question, 2026-09-01: *"what should we do next"* — and the plan could not answer it, because the
three sentences it is built from close a loop:

- §5/§0.2: **P3 next**, hard-gated on the golden-image net (§6.3).
- §7.2: the SCENE makes geometry a jsdom unit test, is *"worth more than the golden-image net of
  §6.3, and it is what makes P3 safe."*
- §8.3: *"The directory that must exist first is `scene/`"* — and `scene/` lands with **P1**.

⭐⭐ **P3 waits on a net; the best net is the scene; the scene ships with P1; P1 is after P3.** So
nothing could start, and 277 commits in 16 days went into `rendering/` instead — see the re-measure
in §2.2.

⭐ **The demotion argument was right about the IMPLEMENTATION and wrong about the INTERFACE.** It
said our context must implement *VexFlow's* `RenderContext` while VexFlow objects still paint
themselves. True — but *declaring our own interface* and letting `SVGContext` satisfy it
structurally inverts the dependency while implementing nothing. That is the reversible end of the
knot, so P1 is cut there.

#### The three steps

| step | what | state |
|---|---|---|
| **P1a** | the **glyph adapter** — one module owns `new Element` | ✅ **DONE 2026-09-01** |
| **P1b** | `DrawContext` — our interface, and the signatures retyped | ✅ **DONE 2026-09-01** |
| **P1c** | the **group handle** — the four things a group is used for | ✅ **DONE 2026-09-01** |
| **P1d** | ⭐⭐ an **implementation of our own — and it is the RECORDER**: `scene/`, the golden net | ✅ **DONE 2026-09-01** |
| **P1e** | the **SVG painter** — `paint/svg/`, closing the four gotchas ⭐ **+ the POINTER RECT question**, deferred here by him 2026-09-01 (`note-engraving-plan.md` §1e: audited, and NOTHING in this repo consumes it — but a painter of ours emits a hit surface only if something asks) | ⛔ **BLOCKED — and by a CONDITION, ⛔ not by a milestone.** See the row below |

🚨🚨 **WHAT ACTUALLY GATES P1e — corrected 2026-09-01, because the old wording misled a reader.**

This row used to say *"BLOCKED until P3"*, and P3 finished on 2026-09-01 without unblocking anything.
⭐ **The gate was never a milestone; it is the condition quoted in P1d's section below:**

> *"while VexFlow objects still paint themselves our context must implement **VexFlow's**
> `RenderContext` anyway — so it re-implements their interface rather than escaping it."*

⭐⭐ **The measurable form of that condition is `npm run lint:paint`'s `vexContext` count, and P3 and
P4 did not move it: 18/18, exactly as when P1d was written.** Taking the note's five drawing calls
and the beam's lines did not reduce it, because the objects still painting themselves were others —
⭐ and **U1 is the step that finally moved it, 18 → 9** (2026-09-14):

| still paints itself | where | which phase takes it |
|---|---|---|
| **`Stave`** — ⛔ no longer for INK, ⭐ but it still PLACES the clef/meter `headerInk` already measures | `VexFlowRenderer` | ✅ **P5 took all of it**: the LINES (2026-09-01), the CLEF's glyph (09-02), the METER's (09-12), the opening BARLINE's (09-13) and the header's PLACEMENT (09-13) |
| ~~**`Curve`** — the tie's and slur's arc~~ | ~~`rendering/curveArc` (4), `TieRenderer` (1)~~ | ✅ **U1, 2026-09-14** — `engine/engrave/curves/curveInk` |
| **`NoteHead` / `Accidental`** painted directly, ⛔ not through an `EngravedNote` | `rendering/FanPass` (2) | ⛔ **unlettered** — ⚠️ and BLOCKED on the highlight, see U2 |

⇒ ⭐⭐ **ONE ROW IS LEFT, and it is the fan's.** The other five code uses are the beam's and the
stem's `.draw()` plumbing (their INK is already ours — P3c/P4a — and what goes through `vexContext`
is the object's own group) and the four `vexContext?.svg` **measurement escapes**, not painting
(`tempoAnchorInk`, `tempoLinePass`, `tempoNudgePass`, `markPreviewPass` reach for the SVG to measure
text). ⛔ A different problem from this table's, and not one a painter of ours solves.

⇒ ⭐ **P1e comes after P5** (§0.2's order), and even then the rows above have to be answered — either
by moving them, or by a deliberate decision that our painter implements enough of `RenderContext` for
them to keep working.

### ⛔⛔ THE UNLETTERED WORK — three pieces nothing owns, and they are ONE KNOT (2026-09-01)

🚨 **All three were found by pulling on P1e in a single sitting, and two of them were rediscovered
because nothing had written them down.** They are recorded here so that stops happening. ⛔ None is
scheduled, none is a defect list, and the order below is the order they UNBLOCK each other in — ⛔ not
a priority.

#### U1 — the `Curve`: ties and slurs ✅ **DONE 2026-09-14**

**5 of the painting uses, the biggest single block.** ⭐ **HIS CALL, 2026-09-01:** *"about the curve
experiment… i want still to leave the answer open so for the curve we should do it too and leave the
experiment open and we can decide after our engine is ready."*

⇒ ⭐⭐ **the P4a/P4b split, applied to the curve**: take the INK, leave the SHAPE open. Exactly as the
beam's quads became ours (P4a) while *which slope rule is right* stayed a live table with a console
knob (P4b), the arc's drawing can move while `__slur`'s experiment keeps running. ⛔ Taking the ink
does NOT close the shape question, and this row exists to say so before somebody assumes it does.

⇒ **`engine/engrave/curves/curveInk.ts`** — a port of `Curve.renderCurve` (MIT, attributed), with
`xShift`/`yShift` folded out (always 0 here) and the `lineDash` branch dropped (nothing dashes a
slur). `rendering/curveArc` keeps the WEIGHT (the outline pin + `curveFillGap`); `TieRenderer`,
`SlurRenderer` ×4, the pending tie and the ghost tie all take `context` now. ⛔ No pixel moved —
6301 unit + 284 e2e green.

**What it found, and none of it was the arc:**

1. ⭐⭐ **`fromNote`/`toNote` were never read.** They existed only to satisfy `new Curve(from, to, …)`
   — `renderCurve` uses its params and `renderOptions` and nothing else — so the ghost tie was
   **building a throwaway `StaveNote`** to have one to hand over. Both parameters are gone from
   `drawCurveArc` and `drawTieArc`, and with them the fake note.
2. ⭐⭐ **The control-point math had TWO owners and now has one.** `curveArcPoints` (the sampler every
   hit-test, obstacle and bbox reads) mirrored VexFlow's control points *from the outside*; its own
   comment worried about *"a second sampler that could drift from this one"* while being exactly
   that. It moved into `curveInk` beside the ink, and both call `curveControlPoints`. ⇒ **the drawn
   arc and the hit geometry cannot disagree** — asserted, in jsdom.
3. 🚨 **A path OUTLIVES the paint, and the recorder had assumed otherwise.** `renderCurve` strokes
   the OPEN figure, then closes it, then fills — and `SVGContext` only clears its path in
   `beginPath`, so the page gets **two `<path>` elements**: a stroke-only outline with no `Z` and a
   fill-only body with one. `SceneRecorder` had been clearing on every paint, which would have
   recorded the body as *a path made of one `closePath` and nothing else*. ⭐ Fixed to the real
   lifetime, with the *"painted twice unchanged ⇒ one primitive marked `both`"* case kept: the two
   cases are different pictures. ⚠️ The old spec had ANTICIPATED the curve and guessed wrong about
   it — *a fixture written for code that does not exist yet is a hypothesis, not a test.*
4. ⭐ **`DrawContext` gained its 20th primitive**, `bezierCurveTo` — the first since the set was
   measured, and the reason is that **a curve is the only thing in this engine not made of straight
   edges**. ⛔ `quadraticCurveTo` and `arc` stayed out.

⭐ **The dividend:** a slur's and a tie's arc are in the SCENE, so *"the tie runs between its
noteheads and bows clear of the stems"* is a jsdom assertion (`VexFlowRenderer.scene.test.ts`), and
the arch's shape is arithmetic on the control points (`curveInk.test.ts`). ⛔ Still not an ink
extent.

#### U2 — the fan's member group, and why the fan's NOTEHEADS are not a ten-line move

`FanPass` builds bare `NoteHead`s for a fanned group's members and paints them on `vexContext`. Its
own comment calls this *"P3's own territory"*, which makes it look like the smallest job on the list.
🚨 **It was attempted on 2026-09-01 and reverted. The measurements, so nobody repeats it:**

1. The fan opens **one group per MEMBER** (`FAN_HEAD_GROUP`) and stores it in the renderer's
   `fanMemberGroupMap` as a **raw `SVGGElement`** — read back by the incremental-redraw capture
   (`captureById`) and by the highlight, which recolours a member by walking that group.
2. ⇒ that group cannot open on a `DrawContext`: getting the element back needs a `svgNode()` escape,
   and `lint:paint` holds those at **10/10, a ceiling that may only FALL**.
3. ⇒ drawing the heads on our surface while the member group stays on VexFlow's puts them under
   `fan` in the SCENE and under `fanhead` in the SVG — ⛔ the *"splitting one member's ink across two
   contexts would nest the scene wrongly"* that `FanPass`'s own header warns about.
4. 🚨 **And it buys nothing**: the pass keeps `vexContext` regardless, because the `Accidental`s and
   the topped-up `Stem`s still paint themselves there. The gate does not move by one.

⇒ ⭐ **the fan's blocker is U3, ⛔ not the notehead.** The ink itself now has a home waiting for it —
`engine/engrave/notes/noteheads.ts`, extracted from `EngravedNote` at the same sitting — so when the
group can move, the heads move with it in one step.

#### U3 — the HIGHLIGHT, and it is the root of the knot

**⛔ Not a bug and ⛔ not a leftover.** The editor highlights a selection by **recolouring ink through
the DOM**: six maps (`hairpinGroupMap` and its five siblings, plus `fanMemberGroupMap` and
`staveNoteMap`) hold the drawn `<g>`, and the controller walks it and rewrites the fill. §P1c already
called it *"a real seam… out of scope here"*, and `DrawGroup`'s own table calls `node()` **"the
escape, and the next number to drive down"**. ⭐ The distinction it rests on is stated in `FanPass`:
*"the 'paint a highlight, don't recolour it' lesson (the barline) is about ink you do NOT own; this
ink is ours."*

⚠️ **A correction worth keeping**: `svgNode` does **not** gate P1e. A painter of ours can implement
`node()` perfectly well. The tension is with the **RECORDER** — §P1c's own note that *"`node()`
answered the scene group while teeing… six highlight maps store what it returns"* — so it constrains
**scene-only** rendering, not the SVG painter. ⛔ An earlier draft of this section said otherwise.

⭐⭐ **Is recolouring still the right approach once we own the ink? — asked by him, 2026-09-01.**
⛔ The problem is NOT efficiency: recolouring is the *cheap* option, because a selection change
re-renders nothing and rewrites an attribute. **The cost is correctness work, and it is all downstream
of mutating ink that was already committed** — every one of these lives in `HighlightController` for
that reason alone:

- *"Raise a group above a coincident sibling so the recoloured glyph is the one that paints"*
- *"Raise this note's group… the recolored head can be hidden behind the other voice"*
- *"Confining the recolor to that group"* / *"Scope the scan to the selected measure's own group"*
- fill-**and**-stroke special-casing, because `fillBeamQuad` fills and a stroke-only recolour is wrong
- the `setStyle` context-leak workaround, *"the rule the whole recolouring family follows"*

⇒ ⭐⭐ **Once the engine owns the ink, a selection becomes an INPUT TO PAINTING rather than a mutation
after it** — the style and the draw ORDER are both decided while emitting, so the whole "raise the
group so the recolour wins" family stops existing. That is the barline's *"PAINT don't RECOLOUR"*
generalised, and it takes `node()` and the six maps to zero with it.

🚨 **The one real caution, so this is not read as "just repaint"**: paint-on-select must NOT mean a
full re-render per selection change — arrow-keying through notes would be far worse than an attribute
write. It needs **repainting the affected SUBTREE**, and ⛔ that capability is not built: the scene
records, but nothing re-emits a branch. ⚠️ And a selection is a PICTURE-ONLY change, so it must reach
`viewStateKey` or the render is judged non-stale and nothing draws at all
(`reference_only_a_stale_render_runs`).

⭐ A cheap complement, already suggested in `docs/barline-selection.md` for its own reasons: an
**OVERLAY** (a box drawn on top) needs neither mutation nor re-render — ⛔ but it can only frame ink,
never recolour a glyph, so it is a complement and not a replacement.

#### ✅ P1a — `engine/rendering/glyphPainter.ts` (2026-09-01)

⚠️ **The first measurement inverted the step order, and it is the useful finding.** A pure signature
retype could not go first: **our own renderers do not draw glyphs through context primitives — they
draw them through VexFlow's `Element`.** 21 `renderText(ctx, x, y)` sites in 14 files, in two
near-identical shapes, so those files need a `ctx` that is a real VexFlow context and cannot be
handed one of ours until the glyph stamping moves.

⭐ **That was never a breach of rule 1** — a glyph shape is precisely what we do not want to invent —
but it was the last **value** import of `vexflow` in nine of those files, and therefore the reason
none of them could be given a context of ours. Nine files wrote the same four lines by hand; they
now call `drawGlyph` / `measureGlyph` / `drawTextRun`. **9 files → 1**, −74 lines, no pixel moved
(5,976 unit + 275 browser tests green; the browser suite is the one that can see a glyph at all).

⭐⭐ **Two facts, measured in vexflow 5.0.0's own source, that the rest of P1 leans on:**

1. **`Element.renderText` is two calls and nothing else** (`element.js:331`):
   `ctx.setFont(this._fontInfo)` then `ctx.fillText(this._text, x…, y…)`. So `Element` is a **font
   resolver** at these sites, not a painter — the drawing half was already ours. ⏭️ That is what
   makes the adapter's own `vexflow` import deletable once `fonts/` can answer *which face, at what
   size*; ⛔ not today, and not as a guess — changing which face a glyph lands in moves engraving.
2. 🚨 **The tag is not a debug label — it selects the FONT.** `new Element(tag)` does
   `Metrics.getFontInfo(tag)` (`element.js:61`). Our tags have no row in VexFlow's table so they all
   resolve to the same default; a tag that IS a VexFlow category resolves differently, which is the
   whole mechanism `TempoLayout.drawTempoText` runs on (`'StaveTempo.glyph'` vs `'StaveTempo.name'`).
   ⛔ So `TempoLayout` and `ScoreTuplet` are **deliberately not ported** — they hold `Element`s across
   layout and draw, and do font-stack surgery per run. They are the only two constructors left.

⭐ **And it collected a rule with no home**: `glyphWidth` existed as **three byte-identical private
copies** in `TrillRenderer`, `PedalRenderer` and `OttavaRenderer` — §3.1's *"the second owner is the
tell"*, found in the wild rather than argued.

#### ✅ P1b — `engine/paint/DrawContext.ts` (2026-09-01)

⭐⭐ **`paint/` now exists, and the engine draws through a type of ours.** 19 primitives (20 since
U1 added `bezierCurveTo`, the only curved one), declared by
us, importing nothing — and **satisfied structurally by VexFlow's `SVGContext`**, which is what makes
this a type change with no pixel in it. ⛔ Nothing is implemented; the object flowing through every
renderer is the same object it was.

⭐ **`RenderPass` carries ONE object under TWO names**, and that is the substance of the step:

| field | what it is | count |
|---|---|---|
| `context: DrawContext` | what a pass **draws** through — our type | everything else |
| `vexContext: SVGContext` | ⛔ what still needs VexFlow **specifically** | **24 uses, 16 files** |

⭐⭐ **The second name is the point.** Before it, that coupling was invisible: every drawing site and
every VexFlow-object site were both spelled `SVGContext`, so *"how much is left"* had no answer.
Now it has one, it is two kinds of thing, and both are work rather than a permanent need:

1. **A VexFlow object painting itself** — `beam.setContext(pass.vexContext).draw()`. P3/P4's
   territory: the ghosts (14), the fan (5), the note, the beams, the stave, `Curve`.
2. ⚠️ **Reaching past the surface into the PAGE** — four `.svg` read-backs and two `state`/
   `attributes` casts. The smaller half, and the more interesting one: these are what would make a
   non-SVG painter impossible.

⭐ **And it is a RATCHET, not a note** — `npm run lint:paint` (in `build:check`): a file not on the
allowlist may not name `SVGContext`/`RenderContext` or use `vexContext`, and the count may not rise.
🚨 That guard exists because of §2.2's re-measure: for 16 days **every stated rule was kept while the
coupling grew 39%**, precisely because no number was being looked at — the same way rule 9's trigger
fired four times unseen. ⭐⭐ **A trigger nobody is scheduled to check is a trigger that does not
fire**, so the ceiling is now checked by the build.

⭐ `paint/` is fenced by `lint:boundary` the way `fonts/` is: ⛔ no DOM, ⛔ no `vexflow`, ⛔ and no
`models/` — §8.2's rules 2, 11 and 12, arriving with the directory they govern rather than after it.
And its spec asserts the load-bearing claim directly: *VexFlow's `SVGContext` is assignable to
`DrawContext`*, plus a runtime check that the real object implements all 19. ⚠️ The first draft of
that break-test spread the context (`{ ...ctx }`) and so found **every** primitive missing —
`SVGContext`'s methods are on its PROTOTYPE. It now shadows one name on a real chain.

⛔ **What P1b does NOT do**: it implements no context, so `save`/`restore` are still VexFlow's
no-ops, `openGroup` still prefixes `vf-`, and the four standing gotchas are still there. Those are
**P1d**.

⚠️ **One question it raises and does not settle — §8's tree says `engrave/vexflow/` is the only
directory importing `vexflow`, and that shape did not survive contact.** P1a found VexFlow doing
**two** distinct jobs here: a **RULER** (`Stave`/`StaveNote` geometry — engrave's) and a **FONT
RENDERER** (`Element` — paint's). `glyphPainter` is the second and has no home in that tree; it was
left in `rendering/` rather than silently rewriting rule 10. ⛔ Open, and his call.

#### ✅ P1c — `engine/paint/DrawGroup.ts` + `paint/Affine.ts` (2026-09-01)

⭐ The question §7.2 warns about (*"a primitive that smuggles a DOM node into the scene defeats the
whole thing"*) arrives here, small: 12 of the 21 sites capture the returned `SVGGElement`, and they
do exactly three things with it.

| use | sites | what it asks the scene for |
|---|---|---|
| `setAttribute('transform', 'scale(k)')` | `VexFlowRenderer.renderMeasure`, `GutterRenderer`, `GroupSignGhost`, `staffScaleGroup.inStaffSpace` (serving 6 passes) | ⭐⭐ **rule 8's PLACEMENT**, already needed today |
| `getBBox()` → `remove()` when empty | 6 ghosts | *"what did this group draw, and drop it if nothing"* |
| `group.lastElementChild.setAttribute('data-half', …)` | `BarlineRenderer`, `barlineGap` | tag the last primitive |

🚨🚨 **The third one is the scene's own argument, and it was already written down twice** — both
sites carry the comment *"a context's drawing calls return the context and not the node"*. In a
scene a primitive is a **value with fields**, so that whole workaround stops existing.

⚠️ **The count above was wrong when it was written, and the correction matters.** It said *12 of 21*,
from a grep for `const group = ctx.openGroup(`. Nine more sites capture through `openGroup?.()` —
every span-mark pass — so it is **22 captures**, and they do a **fourth** thing the first reading
missed: they hand the drawn node to the EDITOR (`hairpinGroupMap` and its five siblings), which
recolours it for a selection highlight. ⭐ That is a real seam, not a leftover, and it is out of
scope here.

⭐⭐ **So a group is now a {@link DrawGroup}** — `setPlacement` · `inkBox` · `discard` · `tag` ·
`tagLast` — **plus one named escape, `node()`**, for the two DOM-level uses (the editor's highlight
maps, and recolouring a ghost's own ink). Three of the five capabilities need no page at all, which
is what makes a recording implementation possible. `npm run lint:paint` now counts the escape too:
**10 uses, ceiling 10, may only fall.**

⭐⭐ **And rule 8 arrives with it: `paint/Affine.ts`.** A placement is a 2×3 matrix, ⛔ not a scale
and ⛔ not an `(x, y)` — *"identity for every note ever engraved normally"*, with `compose` in
Belle's own order (`child.a = parent.a * child.a`) and an `invert` that returns **null** for a
singular placement rather than guessing an identity. It is pure arithmetic, so its whole spec runs
in jsdom — §7.2.1's *"grow the testable half of the engine"*, arriving for free.

🚨 **The one thing that made this more than mechanical: the transform string is OBSERVED.**
`VexFlowRenderer.moveMeasureGroup` re-composes it by text when a bar moves without being
re-engraved, and four specs assert it exactly (`'scale(0.7)'`). So `svgDrawGroup` emits the SVG
**shorthand wherever it is exactly equivalent** and a `matrix(...)` otherwise — which keeps every
byte this renderer used to write. ⚠️ The brace is the one placement with no shorthand (a scale
composed with a translate), so its three specs now read the matrix instead of a `scale(sx, sy)`;
the engraving facts they assert — non-uniform, constant depth, flush foot — are untouched.

⛔ **Left alone deliberately:** `GhostRenderer`'s six inline ghosts still cast. They hold a
`SVGContext` for VexFlow objects that paint themselves and are explicitly P3's territory — §7.2 says
a ghost is *"a scene with a style"* and most of those 1,217 lines are **deletion, not migration**.
⭐ Converting them now would be churn in a file that is going away.

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

### P3 — The note — ⚠️ THE BIG ONE — ⏳ **a ledgers · b flag · c stem INK · d NOTEHEADS · f the ACCIDENTAL + the DOT · g the ARTICULATION ✅**
📄 **`docs/note-engraving-plan.md`** — P3's own plan: the five things `StaveNote.draw()` does, the
order they come back in, what each one costs, and the research per piece.

> ⭐⭐ **The shape, and it is the finding that made P3 startable: KEEP THE OBJECT, EMPTY THE
> DRAWING, one method at a time.** The same `StaveNote` is the RULER seven of our own renderers read
> (§2.3), so it must keep *answering* while it stops *painting* — which rules out a big-bang
> replacement and rules in a subclass whose override list is the progress bar
> (`rendering/EngravedNote.ts`).
>
> ✅ **P3a — the ledger lines (2026-09-01).** Chosen first because it was the only piece with
> **three owners already** — VexFlow's `StaveNote.drawLedgerLines`, `FanPass.drawFanLedgerLines` and
> `VexFlowRenderer.drawRestLedgerLines`, the last two written from VexFlow's source and kept in
> agreement by hand. 🚨 §3.1's *"the second owner is the tell"*, three times inside one element.
> ⭐ `engine/engrave/notes/ledgerLines.ts` now owns the rule **and** the ink; **`engrave/` exists**,
> fenced by `lint:boundary` (rule 11) and arriving on the commit that touched it, ⛔ never as a
> rename move (§8.3). One `renderOptions` poke retired with it (§2.4's list).
>
> ⭐⭐ **And the gate of §6.3 moved for the first time from the inside:** ledger lines draw through a
> `DrawContext`, so they are in the SCENE — *"one ledger line per bar, at this y, marching left to
> right"* is now a jsdom assertion in `VexFlowRenderer.scene.test.ts`. ⛔ No pixel moved: the generic
> rule reproduces VexFlow's `doubleWidth` case exactly, and that equivalence is a spec rather than an
> assumption.
>
> ✅ **P3b — the FLAG (2026-09-01).** Chosen next because it has the **opposite** property to P3a:
> ⛔ **no owner at all** — `vf-flag` is read by nothing, it is not a kind in the `selectedElement`
> union, no anchor or highlight map holds one — 🚨 **and it is §3's bug class sitting in the open.**
> VexFlow places a flag vertically with `getTextMetrics().actualBoundingBoxDescent`, a **runtime
> `measureText`**: the identical mechanism that put every whole rest ~9.7 px off-centre until
> `musicFontReady` gated the first render, and it answers **0 in jsdom**.
>
> 🚨🚨 **AND IT SHIPPED THE PLAN'S FIRST REGRESSION, found 2026-09-14 — read §5's P6b note and
> `docs/note-engraving-plan.md` §1b.5.** VexFlow's `drawFlag` writes the flag's POSITION as a side
> effect of painting (`setX`/`setY`), and `getBoundingBox()` merges that box for any unbeamed flagged
> note. Taking the ink without the write-back left every such note reporting a box merged with the
> ORIGIN for thirteen days. ⛔ **"No pixel moved" was true and not sufficient**: it means no ink
> moved, ⛔ never that no RULER moved.
>
> ⭐⭐ **P3b's real contribution is that the dependency is now a NAMED ARGUMENT** — `flagPlacement`'s
> `glyphReach` — instead of a call buried inside a draw method. ⛔ It did **not** re-source it:
> `fonts/flagDropFromTip` has answered the same question from Bravura since P2, and 🚨 the room a bar
> RESERVES for a flag already comes from that one while the flag is DRAWN from the canvas — the same
> two-sources shape as the ledger overhang, one layer down. ⭐ It is a one-argument swap now. First
> **glyph** of a note in the scene; no pixel moved.
>
> ✅ **AND THE MEASUREMENT IS IN (`e2e/flag.e2e.ts`, 2026-09-01): THEY AGREE.** The canvas says 1 px
> both ways up; Bravura says 0.36 and 0.56. 🚨 Chromium reports `actualBoundingBox*` as **whole
> device pixels**, so its answers are the font's own numbers rounded UP — the table is not merely as
> good, **it is finer**. ⏳ ⛔ Not swapped: it moves every flag ~0.6 px, and moving ink is his call.
> 🚨🚨 **The investigation reproduced §3's own bug by accident**: its first attempt read
> `font-family` off the `<text>`, which has none (the font lives on the GROUP), so `canvas.font` was
> invalid and it measured the **tofu box in 10 px sans-serif** — and reported a confident 0.66 sp
> disagreement. ⭐ *Beating the font bakes in a FALLBACK*, one layer up from where that lesson was
> learnt. The spec now asserts `document.fonts.check(...)` before believing a number.
>
> ⚠️ One rule bent, and both files say so: `engrave/notes/flag.ts` stamps its own glyph rather than
> calling `rendering/glyphPainter`. ⭐ What that module owns is font RESOLUTION, and the flag's face
> is already resolved — so `Element.renderText` is exactly the two primitives we own. It has to be
> that way round: `engrave/` may not import `vexflow`, and a layer needing an `Element` to put a
> glyph down could never be painted to PDF or recorded as a scene.
>
> ⏳ **Two numbers P3a deliberately did NOT decide**, both now one line to flip and both HIS: the
> overhang (we draw 0.3 spaces, the font says 0.4, Gould says the line is *"just over two spaces
> long"* — ⚠️ and the ink table already reserves the font's 0.4, so the two halves of this editor
> disagree today) and the weight (we draw 1.23× a staff line from the font's ratio, Gould says
> *"about twice as thick"*). `note-engraving-plan.md` §3.
>
> 🚨 **And one correction to §6.1 fell out of the research**: *"stem lengths… are places where we
> currently have no opinion"* is **out of date** — Gould's stem-length rules are on her printed
> pp. 16–19 and nobody had looked. ⭐ The parent's own lesson (§3.1): *"we have no opinion" is a claim
> about the library shelf, and this project's shelf has to be re-checked per feature.*

> ✅ **P3c — the STEM'S INK (2026-09-01), ⛔ and NOT its length.** §6.1 lists stem length among the
> places *"where we currently have no opinion"*, and its own rule is that a re-implementation without
> an opinion is **strictly worse than a dependency** — so the length waits on
> `docs/stem-length-research.md` (Gould prints the rules on her pp. 16–19). ⭐ The ink earned the trip
> alone: **three owners again** — `Stem.draw` plus `FanPass` twice, the latter two being the same four
> lines written out in both places.
>
> 🚨 **It is the first piece with a DOWNSTREAM READER, and the seam is an ID.** The editor resolves a
> stem's ink by `getStem().getSVGElement()` → `getElementById(prefix(attrs.id))`, then recolours the
> paths inside. ⭐ `EngravedStem.draw` opens `openGroup('stem', id)` exactly as VexFlow did, so the
> seam needs no change; ⛔ drop the id and stem selection stops painting **silently**. A `Stem`
> SUBCLASS because every field its draw reads is `protected` — VexFlow's expression moved, not
> rewritten.
>
> ⏳ **A third two-sources number, ⛔ not settled**: we stroke at `Stem.WIDTH` 0.15 spaces while the
> font says `stemThickness` 0.12. Ledger overhang, flag reach, stem thickness — the same shape three
> times, and all three are HIS.

> ⭐⭐ **P3d — the NOTEHEADS (2026-09-01), and with them ALL FIVE of `StaveNote.draw()`'s drawing
> calls are ours.** (The pointer rect that follows them is `getBoundingBox` — the RULER, not ink —
> and moves with the registry.) ⭐ It needed **no research**, and that is the test the stem's LENGTH
> fails: *is there a rule here we would have to invent?* The glyph is chosen by duration, the x by
> our own column solve, the y by the staff line — nothing was being decided.
>
> ⚠️ An override of `drawNoteHeads`, ⛔ **not** a `NoteHead` subclass: `buildNoteHeads()`'s
> `new NoteHead(…)` sits at the bottom of forty lines of VexFlow's displacement walk, and §6.7 cuts
> both ways — *port the ALGORITHM, not the FILE*. 🚨 The transcription threw on its first run
> (`NoTickContext`: a `NoteHead` is a `Tickable`, so `getX()` needs a tick context — which is why
> `NoteHead.draw` reads the raw field), and the renderer's per-measure `try/catch` swallowed it into
> a **half-drawn bar**. ⭐ The scene spec caught it as *two stems where four were expected* — an
> argument for asserting COUNTS rather than presence.
>
> ⭐ And the glyph stamp got a home — `engine/engrave/glyph.ts` — because the flag and the notehead
> were two owners of the same `setFont` + `fillText`. ⛔ Not `rendering/glyphPainter`: that one owns
> font RESOLUTION, and here the face arrives as a value.

> ✅✅ **P3f — the ACCIDENTAL and the DOT (2026-09-14), and P3g — the ARTICULATION (same day).**
> ⭐⭐ Together they close the CENSUS: **every glyph an ordinary bar draws is in the scene.** 🚨 None of
> the three had ever been seen by `lint:paint`, which counts `vexContext` — a modifier never writes
> one, because `StaveNote.drawModifiers` hands it `checkContext()`. They were found by diffing the
> page's glyphs against the scene's, and that diff is now a test.
>
> ⭐⭐ **P3g is the one with a lesson in it, and the lesson is WHERE TO CUT.** §0.1 of the P3 plan had
> refused the articulation as *"not ink alone"* because `Articulation.draw()` is a placement RULE —
> true, and the wrong conclusion: cutting at the public **`renderText`** instead leaves all forty
> lines of that rule with their ONE owner and takes only the stamp. ⛔ The piece was never gated on
> research. 🚨 And the alternative had already been priced here: `fanArticulations` hand-rolled a
> spacing rule and landed a staccato 2 px off the identical mark on the next note — §3.1's *"the
> second owner is the tell"*, met before writing the second owner rather than after.
> ⚠️ A mark's CENTRING is `setOrigin` ⇒ `getBoundingBox` ⇒ a runtime `measureText`, so it is **0 in
> jsdom** (§3's bug class again) — one more customer for **P6**'s ruler.
> ⛔ Still VexFlow's: the FAN's marks and the GHOST's, both drawn inside groups opened on its context
> (U2), and both `format` rules above.

Notehead, stem, flag, ledger lines, dots. **We have already built this once:** `FanPass` draws
heads, stems, accidentals and ledger lines by hand today for fan members — including ledger lines,
because `drawLedgerLines` belongs to `StaveNote` and a bare `NoteHead` has none. `chordHeadLayout`,
`chordAccidentalColumns` and `dotPlacement` are the layout half, already ours.

Generalising from "fan members" to "all notes" is the largest single item, and it is the one that
**unblocks `Stave.padding`** — the last item on `vexflow-boundary.md` §3 with no route around it.

> ⚠️ **CORRECTED 2026-09-01, by doing it.** That last clause is **wrong**, and P3a–P3d are the proof:
> all five of `StaveNote.draw()`'s drawing calls are ours and `Stave.padding` is exactly where it
> was. ⭐ It is a **LAYOUT** number — where the note area starts inside the stave — not a drawn one,
> so owning the note's INK cannot reach it. It moves with the STAVE, which is **P5**.
> `docs/note-engraving-plan.md` §0.1 carries the same correction. ⛔ The sentence stays as written so
> the change is visible; ⛔ do not plan work against it.

⛔ **Do not start P3 before the golden-image net exists** (§6.3). ✅ It does: the SCENE, and P3a is
the first element to have crossed into it.

### P4 — Beams
`FannedBeam`, `CrossBarBeams` and `beamInk` already fill beam quads; `docs/beaming.md` already
states our rules; we already borrow VexFlow's `maxSlope`. What is missing is ordinary slope choice
and hooks.

> ⭐⭐ **P4a — the beam's LINES (2026-09-01). 📄 `docs/beam-engraving-plan.md` is P4's own plan.**
> The ink had **four** owners and three already shared ours, so the finding was that VexFlow's copy
> was the only beam here not drawn by our primitive. ⭐ Half of `Beam.draw()` was already ours before
> P4 began — a beamed note's stem is drawn by the BEAM, and P3c had moved that ink.
> ⭐⭐ **P4b — the SLOPE (2026-09-01), and it is a shape worth copying: a TABLE OF RULES, ⛔ not a
> rule.** The research (`docs/beam-slope-research.md`) found all four treatises answering and two of
> them pointing at Ross pp. 104ff; the audit found 85% of our beams steeper than any source allows;
> and then **his eye rejected the sourced answer as too flat and kept the picture we already had**.
> ⇒ five rules (`vexflow` · `musescore` · `interval` · `lilypond` · `verovio`) live in
> `engine/engrave/beams/beamSlope.ts` with a console instrument, the active one is `vexflow`, and
> **no pixel moved**. ⭐ *"We have no opinion"* (§6.1) can be answered by BUILDING THE OPINIONS AND
> LETTING HIM LOOK — a third option beside "invent a rule" and "keep the dependency".
> ⏳ What is left is the hooks (P4c), still ⛔ gated on research the way P3e is.

### P5 — The staff and the header
`engine/layout/headerInk.ts` already **measures** what a clef and a meter cost; `Stave` still
**places** them — the two-sets-of-numbers problem in its last hiding place. Small once P2 exists.

| step | what | state |
|---|---|---|
| **P5a** | the staff's own **FIVE LINES** | ✅ **2026-09-01** — `engrave/staff/staffLines` + `rendering/EngravedStave`. ⭐ The dividend is that **staff-line geometry is now a unit test**: the lines are in the SCENE, where before they were VexFlow's and needed a browser |
| **P5b** | ⏳ the **HEADER RUN** — clef, key, meter, and the gaps between them | ⭐ **the CLEF's INK is ours as of 2026-09-02** (below), and TWO of the run's gaps were decided and built the day before (`docs/header-spacing-research.md` §8): **A** the clef's indentation 0.7 sp, and **D** the header→first-note gap keyed on what ends the header (2½ / 2). ⚠️ Of the nine rows the research raised, **only E and G are genuinely open** — B/C settled by his own earlier reports, F blocked by VexFlow, H unknown in every book, I settled by `key-signature-plan.md` §4.0b. ✅ **the METER's ink followed on 2026-09-12** and ✅ **the opening BARLINE's on 2026-09-13** (both below) ⇒ ⭐⭐ **the INK is COMPLETE**. ⏭️ What is LEFT: every **PLACEMENT** moving off `Stave.format()` |
| **P5c** | the staff line's **THICKNESS** | ✅ **2026-09-01 — HIS call, and he took Gould**: 0.11 sp, what her engraved staves measure, ⛔ not Bravura's 0.13 (which is a FONT's number, not a spec's — `docs/staff-line-research.md` §5.1). `engrave/staff/staffLines.STAVE_LINE_WIDTH_PX`. ⚠️ A **default**, ⛔ not a law: *"the user will be able to change this"* |

#### ✅ P5a — the five lines (2026-09-01)

⭐ Same shape as P4a: the ink that had **two owners** moves to one module, the objects that paint
themselves keep the VexFlow context, and **no pixel moves**.

🚨 **The two owners drew the same line with DIFFERENT PRIMITIVES and agreed by accident.**
`Stave.draw()` strokes a path at `y + 0.5` at whatever width the context carries;
`KeySignaturePass.drawOpenStaffTail` fills a rect at `y`, `STAVE_LINE_WIDTH_PX` tall. Both cover
`[y, y+1]` — ⚠️ **but only because the thickness is 1.** VexFlow's `lineWidthCorrection` is
`lineWidth % 2 === 0 ? 0 : 0.5`, a crispness idiom for odd INTEGER widths that never becomes `w/2`.
⇒ at SMuFL's 1.3 px it would stroke `[y−0.15, y+1.15]` while the tail fills `[y, y+1.3]`. The module
derives the offset from the thickness instead (`y + t/2`), which is identical at 1 and correct above
it — so **P5c cannot silently break P5a**.

⭐ `STAVE_LINE_WIDTH_PX` moved from `rendering/VexFlowRenderer` to the new module, which is exactly
what its own comment had been waiting for (*"when the engine draws its own staves…"*), and the
renderer's `setLineWidth` pin is gone: `drawStaffLines` sets the width from the same constant that
positions the stroke.

⛔ **What P5a did NOT take**: the clef, the meter and the opening barline are stave MODIFIERS and
still paint themselves — that is P5b, and it is the half with the engraving questions in it.

#### ✅ P5b, first step — the CLEF's glyph (2026-09-02)

> *"we still have to do the clef so start with that"* — his call, taken while the clef RESEARCH was
> still running (`docs/clef-research.md`, `docs/clef.md`).

⭐ Same shape as P5a and P3b: **the ink moves to a module of ours and enters the SCENE, and the
numbers that decide WHERE stay exactly where they were, as named inputs.** `engrave/header/clef` +
`rendering/EngravedClef`, substituted onto every score stave by one `EngravedStave.addClef` override.
⛔ **No pixel moved** — 6218 unit tests and all 279 e2e green either side, and `lint:paint` unchanged
at 18/18.

**The rule, and it is the whole of a clef's vertical placement:**

> **A clef stands ON A STAFF LINE — the one its name names — and that line's y is the glyph's
> BASELINE**, ⛔ not its top and ⛔ not its centre.

⭐ SMuFL cuts the glyphs so the ORIGIN sits on the anchor line (`gClef`'s curl encircles it,
`fClef`'s dots straddle it, `cClef` is centred on it), so the rule reduces to *put the origin on the
line* and the font does the rest. ⛔ Which is why nothing in the module nudges.

⭐⭐ **The dividend, and it is the P5a one again: a clef's geometry is a UNIT TEST.**
`VexFlowRenderer.scene.test.ts` now asserts, in jsdom, that the treble clef's baseline lands
**exactly on the second line up** — ⭐ checked against P5a's own staff lines read back out of the same
scene, so it is a statement about the RULE rather than about the number 55. That assertion needed a
browser *and* a font the day before.

⛔ **What it did NOT take, and it is most of P5b:**

| ⛔ still VexFlow's | where | why it was left |
|---|---|---|
| the clef's **x** | `Stave.format()`'s BEGIN-modifier walk, plus `clefIndentPass` and `clefOffsetPass` nudging by `setX`/`setXShift` | this is the *"`headerInk` MEASURES, `Stave` PLACES"* pair P5 is named after — the next step, not this one |
| **which line** each clef names | `Clef.types` | ⏳ question 2 of the clef research |
| the **⅔** a mid-score clef is reduced by | `Clef.getPoint` | ⏳ question 3 of the clef research — ⚠️ and nothing in this repo ever chose it. A spec now says the number out loud so a change cannot be quiet |
| the **inline** clef (a change at `beat > 0`) | `ClefNote`, which builds its own `Clef` | ⏭️ it becomes ours when `ClefNote` does |
| the **METER** and the opening **BARLINE** | stave modifiers | the rest of P5b |

⭐ **Both of the middle two are parameters, deliberately** — P3b's precedent with the flag's font
reach, stated there: *"the reach is a parameter rather than a `getTextMetrics()` call buried in a
draw method… P3b did not change where it comes from."* ⛔ Taking a table or a ratio into `engrave/`
ahead of the research would be inventing a rule that predates it.

⛔⛔ **AND THE CLEF'S ENGRAVING RULES ARE NOT THIS PLAN'S JOB — HIS instruction, 2026-09-02**:
*"in general the clef rules should be reviewed later and applied properly but this is out of the
scope of own engine, just mark this as TODO in the future."* The research that landed the same day
(`docs/clef-research.md`) found real things to fix — ⭐ **a clef change at a bar's start belongs at the
END of the previous bar, before the barline, and all four books agree** (his own example); the small
clef's ratio is unsourced; and Bravura ships a *separate* small-staff clef that is an optical master
rather than a reduction, which nothing here distinguishes. ⇒ **the list is `docs/clef.md` §0**, and it
is a separate pass on his say-so.

⭐ **Why the split is load-bearing rather than bureaucratic:** every item on that list CHANGES THE
PICTURE, and this migration's entire safety argument is that it does not. A rule change folded into a
migration commit destroys the one property that makes the migration checkable — *"the suite is green
and nothing moved"*.

#### ✅ P5b, second step — the METER's glyphs (2026-09-12)

> *"yes"* — his call, taken on the recommendation that the meter's ink was the small, checkable step
> and the PLACEMENT the risky one.

⭐ Same shape as P5a, P3b and the clef: `engrave/header/meter` + `rendering/EngravedTimeSignature`,
substituted onto every score stave by one `EngravedStave.addTimeSignature` override. ⛔ **No pixel
moved** — 6251 unit tests and all 279 e2e green either side, and `lint:paint` unchanged at 18/18
`vexContext` and 10/10 `svgNode`.

**The rule, and it is the CLEF's rule again:**

> **A time signature's numeral is CENTRED ON A STAFF LINE — the upper row on the second line from the
> top, the lower on the fourth — and that line's y is the glyph's BASELINE.**

⭐⭐ **And the premise under it is CHECKED AGAINST THE FONT rather than asserted.** Bravura's
`timeSig0`–`timeSig9` measure **up 0.996–1.036 sp and down 0.996–1.036** about their own origin
(`fonts/bravuraMetrics.GLYPH_BOXES`) — a digit is cut *centred on its baseline*, two staff spaces
tall. ⇒ baselines two lines apart put the upper row across the staff's top half and the lower across
its bottom half, meeting on the middle line: **the pair exactly fills the staff**, which is the only
thing any treatise states about a meter's vertical placement (*"Time-signature numerals should
exactly fill the height of the stave"* — Gould p. 152, read on the scan). `meter.test.ts` asserts
that against the font's table, so a font whose digits are not centred fails a test instead of quietly
making the rule's second half false.

⛔ **The ROW GAP was NOT chosen, and refusing it is the point.** It is ⛔ UNKNOWN in every treatise
(`docs/header-spacing-research.md` row **H**, §2.8) and the engines split — 2.0 sp (LilyPond,
Verovio, VexFlow's lines 1↔3) against a 0.0 clear gap (MuseScore). ⇒ `topLine`, `bottomLine` and
VexFlow's unsourced `lineShift` arrive at the ink as resolved ys, and the module's header says out
loud that nothing may be added there. ⭐ The same call P5b made for `Clef.types`.

⭐⭐ **The dividend, and it is P5a's again: a meter's geometry is a UNIT TEST.**
`VexFlowRenderer.scene.test.ts` now asserts in jsdom that the two numerals land on the 2nd and 4th
staff lines — ⭐ read back out of P5a's own staff lines in the same scene, so it is a statement about
the RULE — and that the pair is symmetric about the middle line as a RATIO of the staff's height,
⛔ not in pixels.

🚨🚨 **AND THE STEP FOUND THE SCENE'S LINE FROM A NEW ANGLE, at the cost of one failing assertion.**
*"The meter stands to the right of the clef"* looks like exactly the kind of claim the scene now
answers. ⛔ **It is not, and it cannot be**: `Stave.format()` advances its begin-modifier walk by each
modifier's `Element.getWidth()` — a runtime `measureText` — and in jsdom every music glyph measures
0×0, so the clef and the meter come out at **the same x**. A `toBeGreaterThan` between them would have
been asserting a bug.

⭐ The stated limit was *"⛔ never an INK EXTENT"*; this is one layer out from it — ⛔ **not an extent
being READ, but a POSITION COMPUTED FROM one.** The notehead comparisons in the same file survive
because our own column solve places those. ⇒ the header's horizontal ORDER stays in the browser suite,
and it comes here when the PLACEMENT does. The spec now carries that as a passing assertion
(*"a zero-width clef advances the walk by nothing"*) rather than as a comment, so the day the
placement becomes ours, it FAILS and says why.

⭐ **One structural addition, and it is `CLAUDE.md`'s rule rather than taste:**
`rendering/inkSurface.ts`. The stave's modifier walk was one `instanceof` away from being a family —
*"a slice too thin to be logic is still a slice"* — so the members (`EngravedClef`,
`EngravedTimeSignature`) now declare an `InkSurfaceAware` interface and the walk asks a membership.
⭐ The opening barline joins by implementing it, ⛔ not by adding a third branch.

⛔ **What it did NOT take:**

| ⛔ still VexFlow's | where | why it was left |
|---|---|---|
| the sign's **x** | `Stave.format()`'s BEGIN-modifier walk | the *"`headerInk` MEASURES, `Stave` PLACES"* pair — the next step |
| the rows' **CENTRING on each other** (`topStartX` / `botStartX`) | `makeTimeSignatureGlyph`, off a runtime `measureText` | a MEASUREMENT, not ink — P6's territory |
| **which lines** the rows name, and `lineShift` | `TimeSignature.topLine` / `bottomLine` | see the row gap above |
| the **opening BARLINE** | a stave modifier | ✅ **taken the next day** — the step below |

⚠️ **`drawAt` was overridden too, and the reason is worth keeping.** It is reachable by a second path
(a `TimeSigNote`'s mid-bar meter change, which this repo does not use today), so overriding `draw`
alone would have left the same placement arithmetic in two bodies — ⛔ *"the second owner is the
tell"*, made rather than found. ⭐⭐ And it takes **our** `DrawContext` while still satisfying
VexFlow's signature, because `DrawContext` is an interface their context satisfies structurally:
**the first place P1b's inversion pays literally rather than in principle** — a VexFlow method
overridden with a signature naming nothing of VexFlow's, so `lint:paint` sees a file that draws only
through us.

#### ✅ P5b, third step — the OPENING BARLINE (2026-09-13)

⭐ Same shape as P5a, the clef and the meter: `engine/engrave/staff/openingBarline` +
`rendering/EngravedBarline`, put on every score stave by the `EngravedStave` **constructor** (⚠️ not
an `addX` override — `Stave`'s own constructor hard-codes `new Barline(...)` into `modifiers[0]` and
`[1]`, and `setBegBarType`/`setEndBarType` write the TYPE into those two slots by index, so the
substitution has to be a replacement in place). ⛔ **No pixel moved** — 6274 unit + 282 e2e green,
`build:check`, `lint:paint` still 18/18 + 10/10.

⭐ **THE RULE, and all three sentences of it were scattered facts before:** the line spans the
staff's full ink (top line's top to bottom line's bottom, so the five lines it closes are inside it);
**`x` IS the boundary and the ink grows RIGHTWARD from it**, ⛔ never centred — because the spacing
model measures the lead-in from that x, the registry's `noteEndX` hit box sits at it and
`barWidth.e2e` asserts a drawn barline stands at the stave's own `x2`; and it is a **filled rect**
rather than a stroked path, because `g.vf-stavebarline rect` is what four readers find a barline by.

⭐⭐ **AND IT DELETED A PASS — the first step of this migration that removed code rather than moving
it.** `barlineInk.inkBarlines` walked every measure's `<g>` after every render and rewrote the
`width` of VexFlow's 1 px rect to the 0.16 sp we actually want. By 2026-09-13 that opening line was
its ONLY target — `BarlineRenderer`, `barlineGap`, `systemStart` and `GutterRenderer` have all drawn
at `THIN_BARLINE_PX` from the start — so taking its ink left the pass with nothing to repair.
⇒ ⭐ *"we already overruled VexFlow on both the WEIGHT and the POSITION of every line on the page;
this draws it right the first time"* (`BarlineRenderer`'s own header, written for the interior lines)
now holds for the one line that pass deliberately left out.

🚨 **And folding the weight in was NOT tidying — a DOM repair is invisible to the SCENE.** Had the ink
moved at VexFlow's literal `1`, `recordScene` would have recorded a 1 px barline while the page
carried a 1.6 px one. ⭐ **A scene that disagrees with the picture is worse than no scene**: every
assertion written against it afterwards asserts the wrong number. ⇒ where a migration step finds a
post-pass repairing the very ink it is taking, the repair comes with it.

⛔ **What it did NOT take:**

| ⛔ still VexFlow's | where | why it was left |
|---|---|---|
| the line's **x** | `Stave.format()`'s BEGIN-modifier walk | the PLACEMENT — what is left of P5b |
| the **HINTING** of that x onto whole device pixels | `barlineInk.hintBarlines` | a page-wide pass over marks four modules drew, ⛔ not this line's business |
| every other **TYPE** — `DOUBLE`, `END`, both repeats | `Barline.draw`, via `super.draw()` | ⭐⭐ **porting them would import a rule we have already replaced.** `BarlineRenderer` exists because those rules are unsayable through `Barline` (the 3 px thick line, the fixed pixel layout, the dots' ≈0.1-space fudge, none of it scaling with its staff). A score stave's BEGIN bar is `SINGLE` or `NONE` and its END bar is always `NONE`, so the fall-through is a guard against a future caller, ⛔ not a case that runs |

🚨 **One finding, reported and ⛔ not fixed in that commit — ✅ and then fixed in the next one, which
is the step below.** `Stave.getBottomLineBottomY()` is `getYForLine(last) + (getStyle().lineWidth ??
1)`; nothing sets a stave style, so it added **1** while **P5c** had made a staff line's ink **1.1
px**. It was pinned as a **passing** assertion in `VexFlowRenderer.scene.test.ts` so that the day the
edge got an owner the spec would fail and say why. ⭐ It did.

#### ✅ P5b, fourth step — WHERE A BARLINE STOPS (2026-09-13), and it is a RULE rather than a repair

🚨 **The 0.1 px was the small half of the finding.** `getBottomLineBottomY()` is read by
`BarlineRenderer` (every line that ends a bar), the opening line, the join (`barlineGap`) and the
key-signature hit box — and `systemStart.drawSystemConnector` had **hand-written a second copy** of
VexFlow's `1`, naming `Tables.STAVE_LINE_THICKNESS`, with `spanTopY`/`spanBottomY` a third. ⇒ every
vertical line in the score, ⛔ not one of them.

⭐⭐ **The rule, and it is not the one we had.** A barline runs between the **CENTRES of the two outer
staff lines**, so it is exactly **four staff spaces** tall — ⛔ not between their outer edges.

| | on the barline's vertical extent |
|---|---|
| **Gould** | ⛔ **UNKNOWN** — nothing in *Behind Bars* states it at this precision. ⛔ Which is ⛔ not "the books are silent": it is the result of a search, recorded so it is not repeated |
| **Ross, p. 151** | *"The lengths of barlines vary with different types of music. 1. For single-line music the barline connects the top and bottom lines of the staff."* ⚠️ Names WHICH LINES, ⛔ not which edge — consistent with the rule, ⛔ does not decide it |
| **LilyPond** | `ly:bar-line::calc-bar-extent` (`scm/bar-line.scm:641`) narrows the staff symbol's own outer-edge extent by **half a line thickness at each end** |
| **MuseScore** | `y1 = spatium × .5 × spanFrom` (0), `y2 = spatium × .5 × (8 + spanTo)` (`tlayout.cpp:1115`) ⇒ 4 spaces |
| **Verovio** | `yStaffTop` → `yStaffTop − 2(lines−1)·unit` (`view_page.cpp:747`) ⇒ 4 spaces |

⭐⭐ **And LilyPond states the reason in its own source, which is what makes it a rule rather than a
tally of three votes:** *"Due to rounding problems, bar lines extending to the outermost edges of the
staff lines appear wrongly in on-screen display (and, to a lesser extent, in print) — they stick out
a pixel. The solution is to extend bar lines only to the middle of the staff line."* ⚠️ That is an
argument about RESAMPLING, and this editor is the case it describes — the same family of reasoning as
`hintBarlines`, which exists because of a measured version of it.

⭐ **Two rules, kept apart on purpose.** `engrave/staff/barlineExtent` (line MIDDLES) is for barlines;
`staffLines.staffLineInkBottomY` (the outer EDGE) is for a mark flush with the staff — the brace and
the bracket's rod (Ross p. 155). ⚠️ They differ by half a staff line at each end, and 🚨 **that split
is LilyPond's too**: a `System_start_delimiter` spans the staff symbol's own extent
(`system-start-delimiter.cc:114`) while `calc-bar-extent` narrows. ⇒ three specs in
`systemStart.test.ts` that had been measuring the brace and the bracket **against the connector's
rect** now measure them against the staff — they had been using the wrong ruler and it only worked
while the two agreed.

⭐ **LilyPond's first rider falls out of the geometry** rather than needing a flag: the piece crossing
the gap between two staves (`barlineGap`) now runs centre to centre as well, so it overlaps the outer
half of both lines and meets the bars exactly — which is what `bar-line::widen-bar-extent-on-span`
does by reverting the narrowing at a span. ⚠️ **Its second rider is NOT implemented and is named in
the module**: a barline in a different colour from its staff should keep the full extent, and this
editor recolours a selected one.

⚠️ It **MOVES INK** — a barline on a five-line staff is **40 px** tall where it was 41, its top edge
0.55 px lower and its bottom 0.45 px higher — ⇒ its own commit. `e2e/barlineJoin` measured the join's height as
*"the space between the staves less two half staff-lines"* and now measures it as exactly the
distance between the two line centres.

#### ⏭️ P5b, what is LEFT — the PLACEMENT, and its FIRST CONCRETE JOB IS DONE (2026-09-12)

🚨 **Found by HIS EYE, then measured**: *"the placement of the meter after the clef seems to be
because of the bbox, not the ink."* ⭐ Right that it is not ink-driven; ⛔ wrong that the bbox is the
cause. Full workings in `docs/header-spacing-research.md` **§4.4**; the conclusion:

- ⛔ **Side bearings are not the problem.** A clef has NO right side bearing — Bravura's `gClef` ink
  `right` **2.684** IS its `advance` — and `headerInkRightX`'s own earlier measurement puts VexFlow's
  modifier box and the font's ink within **0.02 sp** at full size.
- 🚨 **The gap is `TimeSignature`'s `customPadding`, default 15 px = 1.5 sp**, because
  `StaveModifier.getPadding(i)` is 0 for `i < 2` and with no key signature the meter is index 2.
  Less the digit's −0.08 left bearing ⇒ ⭐ **1.42 sp of white, measured identical for all four
  clefs** — and the identity across clefs is itself the proof that it is a constant, not a
  derivation.
- 🚨🚨 **And `headerInk.BETWEEN_PARTS` reserves 1.0 while we draw 1.42.** ⇒ the two-sets-of-numbers
  pair **this phase is named after**, surviving in the one gap of the run nobody ever converted.
  ⭐ `BETWEEN_PARTS` is the only header gap still expressed **box to box**; `CLEF_TO_KEY_INK` and
  `KEY_TO_METER_INK` are both ink to ink.

⭐⭐ **The template already exists and ships**: `VexFlowRenderer.placeMeterAfterKeySignature()` asks
the previous sign where its INK ends, adds a named staff-space constant, converts that ink target to
an ORIGIN through `glyphBox('timeSig4').left`, and `setX`es the modifier — *"PLACED, not shifted…
the number in the style sheets is WHITE SPACE, not an origin distance."* ⇒ 🚨 **the same gap is
engraved two different ways today depending on whether a key signature is present.**

✅✅ **BUILT THE SAME DAY — `engine/layout/clefMeterGap.ts` (commit `8849d2e`).** The research settled
the KIND of number before the value: LilyPond (1.52), MuseScore (1.00) and Verovio (1.00) all space it
**ink to ink**, and 🚨 **the only advance-based engine in the comparison is VexFlow, the dependency we
are removing**. It landed as a **4-row table with a console knob** (`__header.clefMeter(…)`), and
⭐ **HIS EYE armed the row**: `stone` — *"we can start with a value of 1.0 as default but the user in
the future will be able to change it"* — ⚠️ *measured drawn 0.98* at the time, which the fifth step
below shows was the reader's bias over a true **1.16**; it draws 1.0 as of 2026-09-13. The 0.98 is
also Ross's own plate. ⚠️ It MOVED INK (the header is **0.6 sp narrower**) and took its own commit,
as the safety argument requires.

⭐ **It needed no `placeMeterAfterClef` after all**: `EngravedStave.addTimeSignature` computes
VexFlow's `customPadding` itself, because that padding IS the gap — and `headerInk.clefToMeterGap()`
feeds the RESERVATION the same number, so the two sets of numbers became one.

#### ✅ P5b, fifth step — THE PLACEMENT (2026-09-13): the header run is PLACED, not walked

⭐⭐ `rendering/headerPlacementPass` replaces `clefIndentPass`. **A line-opening CLEF is placed from
the staff's own edge** — its INK at `CLEF_INDENT` 0.7 sp, the origin set back by the glyph's left
bearing (`engrave/header/clef.clefOriginX`) — and **the METER is placed from the INK of whatever
precedes it**, the key signature or the clef.

⭐ **"PLACED, not shifted" is the whole of the step.** A shift is an opinion about somebody else's
number: the drawn position stayed VexFlow's 0.5 (*its own opening barline's width*, which nobody
chose) plus our 0.2 correction. ⇒ ⛔ nothing of VexFlow's is inside the answer now, and
`VEXFLOW_CLEF_INDENT` survives only in the WIDTH model, where `CLEF_FULL` was measured at that
baseline.

⭐⭐ **THE DIVIDEND, and it is the one this phase was named for: the header's horizontal ORDER is a
jsdom assertion.** The meter's x came from `Stave.format()`'s walk — `x += clef.getWidth()`, a
runtime `measureText` — plus the gap as `customPadding`. `VexFlowRenderer.scene.test.ts` held that as
a **passing** assertion of the limit (*"a zero-width clef advances the walk by nothing"*, clef and
meter at the same x), written so it would fail the day the placement became ours. ⭐ **It failed in
the run that landed this**, and now states the rule instead: the meter stands right of the clef, at
the armed gap, computed from `glyphBox`. ⇒ `EngravedStave.clefToMeterPadding` is gone with it.

🚨🚨 **UNIFYING THE TWO ARMS FOUND A CONTRADICTION — ✅ SETTLED THE SAME DAY, AND THE INSTRUMENT WAS
THE CULPRIT.** The clef→meter and key→meter gaps converted an ink target to an origin **with opposite
signs** for the digit's 0.08 bearing, and *each measured correct against its own browser spec*. Both
specs were wrong the same way:

⭐⭐ **`getBoundingClientRect` rounds every ink box OUTWARD by up to a device pixel per side**, so a
white gap between two glyphs reads **~0.2 sp too small** at the default staff — larger than the 0.16
the two signs differ by. ⇒ 🚨 **the instrument confirmed whichever form was tried last.** Calibrated
against two glyphs of known width at staff sizes 1 and 8 — the measurement is now a spec of its own
(`e2e/headerGap`'s `readerInflation`) — both converge on the font's numbers as the pixel shrinks:
notehead **1.300 → 1.187** against the font's 1.18, clef **2.900 → 2.687** against 2.684.

✅ **So `+ bearing` is right** — the form all three engines compute (LilyPond's
`extents[RIGHT] + distance − extents[next][LEFT]`, `docs/ink-anchors-and-side-bearings.md`), and the
one the key→meter arm always had. ⇒ ⚠️ **the clef→meter gap had been drawing at ~1.16 since
`8849d2e`, not the 1.0 he armed** — the *"measured drawn 0.98"* that ratified it was reading the bias.
It draws 1.0 now, and the two arms are one conversion again.

⭐⭐ **The lesson outlives the sign**: two expressions of one rule do not disagree loudly — they
disagree by a bearing; and a spec whose tolerance (±0.05) is smaller than its instrument's bias
(0.2 sp) reads as confirmation. ⇒ the gap is now asserted on **the ORIGIN we placed** — an attribute,
exact — with the ink checked only as far as the reader can honestly resolve.

⚠️ What DOES move: a **bass clef by 0.2 px** (its 0.02 sp bearing, now honoured so *"the ink begins at
0.7"* is true rather than true-to-within-a-bearing), and the clef→meter anchor by the 0.02 sp between
the font's clef ink and VexFlow's box.

#### ✅ P5b, sixth step — the BARLINE → METER gap (2026-09-13), and the header run is complete

The last distance still VexFlow's: a **mid-line time-signature change** sat 0.50 sp past its bar's
boundary, which is `Barline.widths[SINGLE] = 5 px` — ⭐ the same unchosen number decision A took off
the clef, arriving by the same route (the begin walk gives the first modifier slot no padding).

⭐⭐ **The books answer this one better than any other gap in the run.** **Stone p. 46** states it in
prose *and draws what he states* — *"changes of time signatures must be placed one staff-line space
after the barline, whether within a line or at the end of it"*, plate 0.83/0.97 — with **Gould p. 43**
measuring 0.94–1.09 and **Ross p. 168** ≈0.9–1.15. The engines sit well below: LilyPond 0.75,
MuseScore 0.63, Verovio 0.50.

⭐ **HIS EYE LANDED BETWEEN THEM, on the one number the two sides share.** He first took the books'
1.0 — *"lets use 1.0 as the books, but again this can be changed in the future by the user"* — then
stood it down: *"1.0 seems to big for me, lets make the default a litle less"*. The armed row is
**`gerouLusk` 0.75**, which is Gerou & Lusk's drawing AND LilyPond's `TimeSignature.space-alist`
constant — ⇒ *"a little less"* had a citation waiting and ⛔ no number had to be invented.
`engine/layout/barlineMeterGap`, four rows, `__header.barlineMeter(…)`.

🚨 **And it moved the WIDTH MODEL, which is the half that would have collided.** `headerExtent` gave
the FIRST header part no gap at all — *"the bar's lead-in is what stands in front of it"* — so a lone
meter reserved **nothing** between the barline and its digits while VexFlow drew 0.5. ⇒ a lone meter
is now the one part that pays a gap while being first, and ⭐ **the exception is real rather than
tidy**: every other opening part is either a clef (whose distance from the edge is its own INDENT) or
stands after a part that already paid. ⚠️ Caught by `e2e/spacing`'s two-digit-meter row moving by
exactly 0.15 = the armed 0.75 less the meter's own 0.6 of air.

⚠️ **Untested until it wasn't**: no `headerExtent` case in the suite had ever had a meter WITHOUT a
clef, so the reservation change passed 6278 tests silently. `layout/barlineMeterGap.test.ts` now pins
the branch, and the drawn side is an ORIGIN assertion in `e2e/headerGap`.

⇒ ⏭️ **What is left of the placement is ONE case, and it is not a gap**: a **mid-line CLEF change**
still sits at that 0.5. ⭐ But the books are unanimous that a clef change belongs **BEFORE** the
barline (Gould p. 8; Ross p. 167 and Gerou & Lusk p. 51 forbid the other arrangement outright) and two
of three engines place it there — so its 0.5 is not a gap to tune but a **SIDE to change**, which is
a model widening and HIS (`docs/clef.md` §0.1a). ⛔ A migration step may not choose it.

### P6 — THE RULER (the bounding box) — ⭐ added 2026-09-01, HIS call

> *"are we planning to manage the bounding box at a certain moment? and do we need the bbox once we
> have our own engine built?"* — his question, and the audit below is the answer to both: **nothing
> planned it, and yes we need it — just not VexFlow's.**

⚠️ **Three different things are called "the bbox" here, and only ONE of them was scheduled.**

| | what | who needs it | after VexFlow |
|---|---|---|---|
| 1 | the **pointer rect** — an invisible `<rect>` per note | ⛔ nobody: audited 2026-09-01, `note-engraving-plan.md` §1e | **dropped**, at P1e |
| 2 | the **hit box** — `ElementRegistry`, pixel → element | ⭐ every click in the editor | ⭐⭐ **P6** |
| 3 | the **ink extent** — how much room a symbol takes | `layout/spacingPadding`, `kerning`, the ladder, a slur's obstacles, a ghost's *"did anything draw?"* | ⭐⭐ **P6** |

⭐ P1e answers (1) and nothing answers (2) or (3): **this section is that gap, named.**

#### ⭐ The audit — measured 2026-09-01

**The ruler today is TWO mechanisms, and neither is ours.**

**(a) VexFlow's object arithmetic — 14 code sites.** `Element.getBoundingBox()` is
`new BoundingBox(x + xShift, y + yShift − textMetrics.ascent, width, height)`; 31 `elementRegistry.add`
sites file hit boxes, and the ones that need a drawn object are fed from there.

🚨 **And we already disagree with it in four places, each with its own workaround** — which is the
real finding, because it means the box is not a dependency we are content with:

| who refuses it | why |
|---|---|
| `rendering/noteInkBox` | `StaveNote.getBoundingBox()` **unions every attached modifier**, so a note's "box" spans its accidentals, dots and articulations — his report |
| `rendering/CenteredTremolo` | *"NOT `Element.getBoundingBox()`… that box is built from `this.x`/`this.y`"* — a mark left at the origin reports the origin |
| `rendering/DynamicsLayout` | reads the **rendered SVG** instead, because the modifier's width is deliberately zeroed |
| `rendering/clefOffsetPass` | depends on the `x + xShift` behaviour, and says so — everything downstream of an offset clef is measured from that box |

**(b) The PAGE, read back — ~24 `getBBox()` code sites in `engine/`** (GhostRenderer ×9,
DynamicsLayout ×5, HairpinRenderer ×2, TempoLayout, dynamicsLinePass, ScoreHeaderPass, FanGhost,
`svgDrawGroup`), plus 5 in `HighlightController`. Every one needs a browser, is absent or throws in
jsdom, and carries a `try/catch` whose fallback means *"nothing measurable was drawn"*.

🚨🚨 **…and this half is a measured PERFORMANCE bill, not just an inconvenience.** `dev/layoutFlushCensus`
exists because `getBBox`/`getCTM`/`getScreenCTM` **force a style+layout flush** — verified against
Blink's `svg_graphics_element.cc`, WebKit's `SVGGraphicsElement::computeBBox` and Gecko's
`GetPrimaryFrame(FlushType::Layout)` (`docs/render-performance-research.md` §7a). ⭐ **A box computed
from the scene costs no reflow at all**, so P6 is the one item on this plan that pays in milliseconds
as well as in independence.

#### ⭐⭐ What P6 is

> **A box is COMPUTED from what was drawn, not measured off the page and not asked of an object.**

`engine/scene/` already holds every primitive as a value, and P2 already holds the font: `GLYPH_BOXES`
gives **71 glyphs** their `left/right/up/down/advance` in staff spaces. So:

- a **path** or a **rect** → arithmetic over its own ops;
- a **text** primitive → the glyph's box, scaled by the drawn size and placed by the group's `Affine`;
- a **group** → the union of its children, ⭐ **with the caller choosing which children count** — the
  one thing VexFlow's box cannot do, and the reason `noteInkBox` had to exist.

⭐⭐ **The payoff is the same shape P1d's was: a hit box becomes a jsdom UNIT test.** Today
`ElementRegistry`'s boxes can only be checked in the browser suite; after P6 *"a click at this pixel
selects that clef"* is arithmetic on a scene. And `DrawGroup.inkBox()` — 2 callers, `getBBox()`
underneath, `null` in jsdom — gets an implementation that answers everywhere, which is why
`SceneRecorder` returns null today rather than guessing (*"a recorder never guesses a box"*).

#### ⛔ Why it is P6 and not sooner

**Because a box may only be derived from ink we actually own.** Half-done, it would answer for the
primitives we draw and need a **fallback** for everything VexFlow still paints — and a guessing
fallback gets believed. ⇒ P6 runs after P4 and P5, when the scene is complete enough that no fallback
is needed. ⭐ The migration's own progress bar says when that is: `lint:paint`'s residue and the
scene's coverage are the same number.

⚠️ **Two things to settle when it starts, ⛔ not now:** whether `ElementRegistry` keeps STORING boxes
or starts QUERYING the scene (storing is a cache; a cache of a derived value is a staleness bug
waiting), and whether an ink extent stays in pixels or becomes staff spaces like the rest of
`fonts/`. ⭐ **P6a did not need either answer** — it computes and proves, and changes no consumer.
✅ **Both were answered on 2026-09-14 by P6b's first kind — STORE, and PIXELS** — and the reasoning is
under *"the two decisions"* below, because each turned on a fact the first real consumer surfaced
rather than on a preference.

#### ✅ P6a — THE BOX ITSELF (2026-09-14): computed, and checked against the page

⭐ **`engine/scene/sceneBox`** — a rect from itself; a path from the EXACT bounds of its ops (⭐ a
cubic's true extrema, ⛔ not its control hull, which would reserve room the ink never reaches); a
glyph from Bravura's own outline; a group as the union of its children, **with the caller choosing
which children count**. ⛔ Nothing is wired in: `ElementRegistry` still stores VexFlow's boxes.

⭐⭐ **It never guesses.** A `text` whose codepoint is not one of our 71 measured glyphs has NO box,
and a union containing one answers **null** rather than a rectangle that is silently too small —
`sceneInkBoxDetail` is the same walk with its workings shown, so a caller can ask *what* stopped it.
*A guessing fallback gets believed*, and a box is the most believable guess of all.

⭐ **…and as of 2026-09-14 the same for a coordinate that is not a NUMBER** (`nonFinite`). 🚨 A NaN
is the most believable wrong answer there is — it LOOKS like a measurement, and one of them spreads
through every `min`/`max` it meets until a whole page's box is NaN with nothing to say which
primitive did it. ⚠️ **Today's only producer is VexFlow, and only in jsdom**: `Articulation.draw`
centres a mark with `setOrigin`, which divides by a glyph width a page-less test measures as 0.
⛔ **The guard is not written for that bug** — his question was the right one (*"we will not use
vexflow in the future, so how should we proceed?"*), and the answer is that this half is a property
of OUR ruler that outlives the dependency: **a box is either honest or absent.** ⭐ The OTHER half —
the cause — is P3b's playbook and belongs on the taste list: the centring should come from
`GLYPH_BOXES` (which holds every articulation glyph) as a NAMED ARGUMENT rather than from a runtime
`measureText`, measured table-vs-canvas in a browser first, ⇒ the FIFTH *"the room and the ink come
from two sources"* number, beside the ledger overhang, the stem thickness, the flag reach and the
notehead glyph. ⚠️ And unlike those four it moves the HIT BOX too, because `getBoundingBox` reads
the same shift.

**Two seams it needed, and both were boundary questions rather than plumbing:**

1. **`GLYPH_CODEPOINTS`** — the generator already knew each glyph's codepoint from SMuFL's own
   `glyphnames.json` and threw it away. A scene records the CHARACTER that was drawn, so the box
   needs the way back; `fonts/glyphNameOf()` is that inversion and answers null off the table.
   ⛔ Read, ⛔ never transcribed — 96 insertions to the generated file and **no measured number moved**.
2. **The pt→px dialect is a PARAMETER** (`SpacePxReader`). A bare `30` handed to `setFont` means
   POINTS — a fact about **VexFlow**, not about the drawing. `scene/` may not know it, and ⛔ nor may
   `fonts/`, which *"must not know who draws with it"*. ⇒ `rendering/sceneInk` speaks that dialect
   and hands it in. ⭐ P3b's flag reach again: **the unit is a named argument.**

##### 🚨 What checking it against a browser FOUND — three, and none of them arithmetic

⛔ *"Our box equals `getBBox()`"* is false in three different ways, and each is worth owning
(`e2e/sceneBox.e2e.ts` asserts all three):

| family | the page | ours | ⇒ |
|---|---|---|---|
| a barline (filled rect) | **2 px** wide | **1.6 px** | ⚠️ the PIXEL HINT — `barlineInk.hintBarlines` snaps the rect onto the device grid AFTER it is drawn. Both true, of different moments |
| a stem / a tie (stroked path) | the GEOMETRY — **0 px wide** for a stem | geometry **+ the pen** | ⭐ a ruler that agreed with the page would report a stem as having no width |
| a notehead (`<text>`) | the FONT'S LINE BOX, >3× the glyph | the glyph's outline | ⚠️ the instrument, not us — and the reason a hit box built from it was never the ink |

🚨 **And a fourth, about the scene itself: `recordScene` on an unchanged score records almost
nothing.** A render that follows no edit REUSES its measures (P5.4) and a reused bar draws nothing —
measured, ONE barline out of a whole page. ⇒ `VexFlowRenderer.forgetReuse()` + the
`MusicEngine.recordFullScene()` pair, and ⭐ **anything that wants "the scene of what is on screen"
must say so explicitly.**

##### ⭐ `__bbox.ink()` — his ask, and why it is a second command

> *"remember we have `__bbox.show()` in the console… in any case this should show OUR bbox and not
> vexflow bbox"* — 2026-09-14

⭐ Right as the END STATE. Today `show()` draws what `ElementRegistry` holds, which is **what a click
actually resolves against** — so while the registry is still VexFlow-derived, that is the honest
thing for it to draw, and `dev/inkBoxOverlay` draws OURS beside it. ⛔ One command showing the other's
numbers would hide the very disagreement P6 exists to close. They become one picture at P6b.
⭐ A group we could not measure is drawn **dashed and red**, labelled with the codepoint that stopped
it: *"the ruler declined"* and *"there was nothing there"* must not look the same.

⏳ **P6b** is the switch: `ElementRegistry` fed from the ink instead of from `Element.getBoundingBox()`
— ✅ **STARTED 2026-09-14, one element kind (the ACCIDENTAL)**, and both open decisions above are
answered below.

##### ⭐⭐ P6b GAINED ITS SEAM ON 2026-09-14, and it came from looking at `__bbox.ink()`

🚨 **A box can only be queried for ink the scene lets you FIND, and three selectable marks could not
be found.** His four reports — no box for the articulation, none for the dot, none for the accidental,
and the notehead's box growing to swallow them — are one fact: **VexFlow's modifiers open no group**,
so their ink lay loose inside the notehead's.

⇒ each now opens a group named for **the kind the REGISTRY files it under** (`accidental`, `dot`,
`articulation`), carrying the drawn sign's own id. ⭐ That is the P6b join: *scene group ↔ hit box*,
by name and by id. And `__bbox.ink()` now draws **a group's OWN ink** — `sceneInkBox`'s *"the caller
chooses which children count"*, used for the first time, which is also the answer to
`noteInkBox`'s complaint arriving from our side of the ruler.
⚠️ ⛔ SELECTION did not change and did not need to: a click resolves against the registry, which has
filed a separate box per mark all along (`docs/note-engraving-plan.md` §1g.6).

##### ✅ P6b, FIRST KIND — THE ACCIDENTAL'S HIT BOX IS OURS (2026-09-14)

⭐⭐ **The registry now files what the sign's ink COVERS**, computed from the stamp that drew it:
`rendering/drawnHitBox.accidentalHitBox` ← `EngravedAccidental.drawnInk()` ← `sceneInk.drawnInkBoxOf`.
⛔ One kind only — the dot, the articulation and the rest still store `Element.getBoundingBox()`.

⭐⭐ **THE PAYOFF, MEASURED: in jsdom VexFlow's ruler answers `0×0` for a sharp and ours answers
9.96 × 27.92 px.** So *"the hit box is the glyph's own outline"* is now **7 unit tests**
(`drawnHitBox.test.ts`), and the accidental's registry spec — whose header used to say *"these
assert the ANCHOR, ⛔ not geometry… whether the box sits under the glyph is the browser suite's
question"* — asserts the box. ⭐ That header is the before-and-after of P6 in one paragraph.

⭐⭐ **`drawnInkBoxOf(draw)` takes the DRAWING, ⛔ not the glyph's four numbers**, and that is the
design decision in the step. A `glyphBox(text, x, y, font)` helper would be a SECOND OWNER of what
the stamp does — the tell this migration has met in the ledger line, the stem, the beam quad and the
curve's control points. Replaying the real call into a forward-less `SceneRecorder` cannot drift from
it: the font normalisation, the baseline convention and the group nesting are the ones that ran.
⚠️ It paints nothing and costs no reflow (which is the point — `getBBox()` forces a layout flush).

##### ⭐⭐ …and the TWO DECISIONS the plan reserved for P6b are answered — by the first real case

1. **STORE, ⛔ do not query.** The objection was *"a cache of a derived value is a staleness bug
   waiting"*, and the answer is that this cache cannot go stale **because the same `draw()` writes
   both**: the ink and its box are one call, and a render that does not redraw a bar does not
   re-register it either. 🚨 The alternative was ruled out by P6a's own finding — a render REUSES its
   measures, and **a reused bar draws nothing**, so a scene to query is exactly what a normal render
   does not have (it is why `recordFullScene()` had to exist).
2. **PIXELS, in the drawing's own (pre-transform) coordinates** — the same space
   `getBoundingBox()` answered in, so `ElementRegistry.add`'s `scale(k)` still applies and a small
   staff needs nothing. ⭐ Staff spaces stay in `fonts/`, where a number means the same at every size;
   a hit box is compared against a mouse event, and that arrives in pixels.

##### 🚨 What the first kind found: the SIZE is ours, the PLACE is still VexFlow's

`accidentalOriginX(start.x, this.getWidth())` hangs the sign left by a width VexFlow measures with a
runtime `measureText` — **0 in jsdom**, so a page-less test stamps the glyph with its left edge on
the modifier-start point (`e2e/accidentalHitBox.e2e.ts` is where the placement is checked, and it is
the half that needs a browser). `fonts/GLYPH_BOXES` holds all five signs' advances and could answer
it instead ⇒ the **SIXTH** *"the room and the ink come from two sources"* number, beside the ledger
overhang, the stem thickness, the flag reach, the notehead glyph and the articulation's centring.
⛔ It MOVES PIXELS, so it is a taste call and not this step's.

##### 🚨🚨 …AND THE NEXT KIND IS THE NOTE'S OWN BOX — reordered 2026-09-14, by a BUG

His report the same day: a slur over five sixteenths *"completely crazy"*, drawn 380 px above a 72 px
span. ⭐ **The slur was innocent**: its obstacle solver was handed `{x: 0, y: −33, w: 258, h: 122}`
for one covered note — the whole system, from the origin — and lifted the arch 361 px to clear it.
The box came from `StaveNote.getBoundingBox()` merging a FLAG that had never been positioned, because
**P3b took the flag's ink and dropped VexFlow's `setX`/`setY` write-back** thirteen days earlier
(`docs/note-engraving-plan.md` §1b.5, where the fix, the family audit and the spec live).

⭐⭐ **Why it belongs in THIS document and not only in P3's:** it is the first time the ruler being
VexFlow's cost a visible defect, and it is a defect **this section's premise makes impossible.**
*A box is COMPUTED from what was drawn, ⛔ not asked of an object* — and a box derived from the scene
has no field for a draw to forget to write. The flag's glyph was in the scene, and on the page, in
the right place, the whole time; what was wrong was a *field*. ⇒ P6 is not only an independence
argument and a reflow argument. **It removes a whole failure class**, and that class has now fired.

⏭️ **So the queue changes.** The NOTE's own box goes ahead of the dot and the articulation: it has
the most consumers, it is the one that failed, and taking it also retires `rendering/noteInkBox`'s
splice hack — lifting the dynamics `Annotation` out of VexFlow's live modifier array, asking
`getBoundingBox()`, and putting it back, because *"a union cannot be un-merged"*. ⭐ `sceneInkBox`
answers that natively (*the caller chooses which children count*), and P3f/P3g's per-mark groups are
what make each child findable.
⚠️ **Check first**: whether anything asks a note for its box BEFORE it is drawn. VexFlow's is
meaningless then too, but it answers a rectangle rather than null — so a caller may be leaning on the
number without knowing it. ⛔ Ours must not learn to guess in order to match that.
✅ **Checked 2026-09-14 — nothing does.** The registry files a note in `registerSlotElements`, after
`voice.draw`; the slur's `noteInkBox` runs in the slur pass; a fan member registers right after its
head draws; `layout/`, `models/` and the registry ask no note for a box.

##### ⭐⭐ …and HIS QUESTION turned it from ONE SWAP into ONE READER AT A TIME (2026-09-14)

🚨 **A note's registry box is not a note's ink.** `StaveNote.getBoundingBox()` unions the heads, the
stem tip, the flag **and every modifier** — accidentals, dots, articulations, the dynamic, a tremolo —
and the readers lean on its EDGES, not its presence:

| reader | reads the box's… | what it actually means |
|---|---|---|
| clicking a note (`hitsNoteOrRestBody`) | ⛔ nothing — pitch + `headX` | already right (`tight-bbox-plan.md` §4a) |
| note entry (`findNotesLeftRight`, `findNearestNoteOrRest`, `pixelToPosition`) | centre | **where the head stands** ✅ |
| a beat-anchored mark (`MouseController.resolveSlotBeat`) | left edge — the ACCIDENTALS | where the slot's ink begins ✅ |
| the bar-width drag (`measuredRoom`, bar-end room) | right edge — the DOTS | where the last ink ends |
| Shift-box select (`getInRect`) | the whole rectangle | does the box touch any of the note's parts |
| a slur's obstacles | `noteInkBox`, its own union | the note's ink minus the dynamic |

⇒ swapping in a box of ours with fewer parts in it would have moved the bar-width floor and note
entry, and a box with ALL the parts falls back to VexFlow's wherever a part is not ours yet (a
tremolo). ⭐ His question — *"why we need a rectangle per note?"* — has a plain answer: **we don't;
`ElementInfo` requires a `bbox` of every kind, so a note got VexFlow's.** So each reader is moved to
the question it means, and when none is left the note's rectangle can shrink to its head.
⛔ *"One union swap"* is not the plan any more.

✅ **Reader 1 — note entry.** `ElementRegistry.headCentreX(el)` = `headX ?? box centre`: the
left/right choice (`NoteEntryCoordinator.resolveClickToBeat`), the nearest column
(`findNearestNoteOrRest`) and `MusicEngine.pixelToPosition`'s *"right on top of it"* check — which has
to agree with the lookup it follows. A rest carries no `headX`, so it answers what it did. ⚠️ Also
switched, for consistency: `findClosestNote` and `findNotesNearX`, which **nothing calls**.
Spec `ElementRegistry.noteEntry.test.ts`, every case built so the box centre gives the other answer.
✅ **Reader 2 — where a beat-anchored mark lands** (`resolveSlotBeat`: clef change, dynamic, tempo…).
`layout/slotBoundary.nearestSlotBoundaryBeat`: a slot begins at the leftmost of each head's left edge
(`headCentreX` − half the font's `noteheadInk` × the staff's line spacing) and its ACCIDENTAL's hit
box, which is ours since P6b's first kind. ⭐ The rule did not change — *"snaps to the nearest slot
boundary"* (`588b817`), and a sharp is still part of its slot; only the ruler did. ⚠️ A rest still
answers VexFlow's glyph box, and a note without `headX` falls back to its union box. Spec
`layout/slotBoundary.test.ts`, whose note fixtures carry a deliberately wrong `bbox.x`.
⏭️ Next readers: `measuredRoom`'s bar-end room (needs the DOT's box first) · `getInRect` · the slur's
`noteInkBox`.

⏭️ **Then** the DOT and the ARTICULATION — both already open a named group with an id, and the
articulation's is the one whose VexFlow box goes NaN in jsdom, so it should follow its own taste call
rather than lead.

### ⛔ Not on this list
**Accidental column stacking** (`Accidental.format`) and **articulation placement**
(`Articulation`). They are the only two places where VexFlow does real engraving thinking we have
never had a complaint about. §6.1 is why that matters more than it sounds.

⚠️ **Read this as PLACEMENT, ⛔ never as the INK** — both marks' glyphs came back to us on
2026-09-14 (P3f, P3g) without either rule being touched, and the two halves are separable precisely
because the placement writes a point and the ink reads it. 🚨 The cost of confusing them is
measured in this repo: `fanArticulations` hand-rolled a spacing rule for a fan's members and put a
staccato **2 px** off the identical mark on the note beside it.

⭐ **But not "never", either — see §6.7.** VexFlow is MIT, so these two sit on a **port-if-needed**
list rather than a build list, and we have already done it once (`chordAccidentalColumns`).

#### ✅ P1d — `engine/scene/` (2026-09-01), and it is the RECORDER, ⛔ not the painter

⚠️ **P1d was written as *"stop calling VexFlow's context"*. That one is still blocked, by this
document's own argument** — the one that demoted P1 in the first place, quoted in §5 above:

> *"while VexFlow objects still paint themselves our context must implement **VexFlow's**
> `RenderContext` anyway — so it re-implements their interface rather than escaping it."*

⭐ That is exactly as true today as when it was written: **18 `vexContext` uses**, every one a
`StaveNote`, a `Beam`, a `Stave` or a `Curve` painting itself. A from-scratch `paint/svg/` would
have to satisfy their interface as well as ours, at the highest blast radius in the plan, in
exchange for four small gotchas. ⛔ So it is **P1e — and after P5, not after P3**: see the corrected
gate under §5's P1 table. The count is unchanged at **18/18**, and the four gotchas stay open.

⭐⭐ **But the OTHER implementation has no such constraint, and it is the one §7.2 has been pointing
at all along:**

> *"Geometry becomes a UNIT test… this is the single most valuable item in this document — it is
> worth more than the golden-image net of §6.3, and it is what makes P3 safe."*

**`SceneRecorder` is a `DrawContext` that writes down what it was told to draw.** `recordScene(fn)`
tees it onto the real painter, so a render paints exactly as before *and* hands back a {@link Scene}
of plain typed values — glyph, text, rect, path, group — with **no DOM and no VexFlow**
(`lint:boundary` fences `scene/` the way it fences `paint/` and `fonts/`).

⭐⭐ **The payoff, demonstrated rather than promised:** `VexFlowRenderer.scene.test.ts` renders a real
four-bar score **in jsdom** and asserts that every bar's barline stands at an ascending x, that each
is taller than it is wide, and that none is at the origin. ⚠️ **Every one of those needed a browser
before this file existed.** §7.2's third promise — the golden becoming a diff that names *which
primitive moved* — is now a `toEqual` on a value.

⚠️ **What the scene does NOT hold, and this is the honest half:** anything a VexFlow object paints
itself. Noteheads, stems, flags, beams, the stave's own lines. ⭐ **That gap is not a defect of the
scene — it is the migration's remaining work, and it is the same number `lint:paint` reports from
the other side.** Every P3/P4 commit that stops a VexFlow object painting itself adds its ink here
for free, so **the scene's coverage and the migration's progress are one measurement.**

🚨 **Two bugs the recorder's own spec caught, both silent, both worth recording:**
1. **The tee forwarded no GROUP operations.** The real painter hands back its raw `SVGGElement`, not
   a handle, so every placement, tag and discard was recorded and **never painted**. ⇒ the recorder
   takes a `wrapGroup` constructor parameter (`rendering/svgDrawGroup`), because `scene/` may not
   import `rendering/`.
2. **`node()` answered the scene group while teeing.** Six highlight maps store what it returns and
   the editor recolours it later — they would have filled with objects no highlight can paint. ⇒ it
   defers to the real painter's node whenever there is one.

⭐ And a third, in the ratchet rather than the code: `lint:paint` counted **comment lines**, so
writing `scene/`'s doc comment "raised" the residue from 24 to 28 and reported two files that draw
nothing as offenders. ⛔ **A ratchet that punishes writing down WHY gets routed around by people not
explaining themselves.** It now measures code only, and the ceiling fell to the honest **18** — the
residue did not shrink, the measurement got honest.

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

> ✅ **ANSWERED 2026-09-01, and by the better of the two candidates** (§7.2's own claim: the scene is
> *"worth more than the golden-image net"*). `engine/scene/` records a render as values, so the net
> for P3 is a **scene diff**, not a pixel diff: stable across browsers and font versions, readable
> in review, and it names which primitive moved. ⚠️ **The gate is only half-lifted**: the scene sees
> what OUR primitives draw, and P3 is precisely the work of moving the NOTE into that half. ⭐ The
> honest reading is that P3 now builds its own net as it goes — each element, once ours, is
> unit-testable the moment it stops being VexFlow's — which is a better position than a pixel
> golden of a picture nobody can diff by eye.

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

### 7.2.1 ⭐⭐ Where does LAYOUT end and ENGRAVE begin? — the rest's line is the sharpest probe yet

The four stages above read cleanly until a real question is put to them. **Multi-voice rest
placement (§3.1) puts it three ways at once**, and gets three different answers:

| what the rule does | which stage that says |
|---|---|
| reads the MODEL and nothing drawn — the other voices' pitches, their **sounding spans**, the clef | `models/` → `layout/` |
| answers with a **STAFF LINE** — a symbol's position, not an amount of room | `engrave/` — *"what SYMBOLS, where"* is its own definition |
| needs measured **INK** — the rest's own extents, half a notehead, a 0.75 sp clearance | reads like `engrave/`, yet the table has lived in `layout/spacingPadding.ts` since the horizontal spacing needed it first |

It landed in `engine/layout/restVoicePlacement.ts`, beside `restPlacement.ts`, for three reasons
that are all the same reason: it is **pure** (no DOM, no VexFlow, no context — so its whole spec runs
in jsdom); the **PDF export needs the identical answer** (§0.4); and its neighbours were already
there.

⚠️ **Notice what that admits about the stage diagram.** `layout/` is not "how much room" alone — it
has been deciding **vertical positions** for months: `restPlacement`, `dynamicsLine`,
`outsideStaffBand`, the above- and below-staff ladders, `staffStride`, and now this. §8.1 already
says as much about `MeasureLayout`/`spacingPass` — *"they are layout and always were — misfiled by
history"*. So the honest reading of today's tree is not the one the arrow diagram suggests:

> ⭐⭐ **`layout/` = every position DERIVABLE FROM THE MODEL PLUS A METRICS TABLE.**
> ⭐⭐ **`engrave/` = every position that needs a DRAWN OBJECT to exist first** — a stem's actual
> tip, a beam's solved slope, a formatted column's x, a glyph's own anchor point.

⭐ That line is worth stating because it is **checkable and it predicts**. Anything answerable from
the score plus a table is a unit test; anything that must interrogate a laid-out object needs the
scene, and until the scene exists it can only be an e2e case. Every current browser-only assertion
sits on the right-hand side of it, and that is not a coincidence.

⭐⭐ **And it is why P2 is the load-bearing piece, in a way §5 does not make obvious: every metric we
can put in a table moves a decision from `engrave/` to `layout/`** — from browser-only to
unit-testable, from "we must draw it to know" to arithmetic. Rest clearance is the **first decision
to have crossed that line**, and it crossed only because P2 had already measured the rest extents
into `spacingPadding`. ⭐ That reframes P2's value: it was scoped as *"stop the font from lying"*
(§3), and it is also *"grow the testable half of the engine"*.

⛔ **What is NOT settled, and it is his call.** Two readings of the boundary are live and this
document contains both:

- **`engrave/` stays SMALL** — only the genuinely drawn-object-dependent decisions — and `layout/`
  keeps growing every position it can derive. That is what §8's tree assumes, and what the code has
  actually been doing.
- **`layout/` stops at horizontal room**, and every vertical position moves to `engrave/`. That is
  what §7.2's arrow diagram reads like.

⚠️ They disagree today. ⛔ Nothing forces the choice until `scene/` exists, and choosing early would
move a dozen working modules for a name — so this is recorded as an **open question with its
evidence**, not as a decision. The one thing that would settle it cheaply: write the rule down as
*"can this be answered without drawing anything?"* and sort the existing modules by it. If the
answer partitions `layout/` and `engrave/` the way they already sit, the first reading wins by
measurement rather than by taste.

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
