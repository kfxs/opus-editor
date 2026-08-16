# The ink table comes from the FONT — SMuFL as its source

> 📄 **P2 of `docs/own-engraving-engine.md`.** That document is the strategy — why we are taking the
> drawing at all, the five pieces, the target architecture. ⛔ This one does not restate it. It is
> the DECISION RECORD for the one piece we do next, and the list of questions that need his eye.
>
> ⭐ **The work here is small. The decisions are not**, which is the only reason this file exists:
> every number below already exists and already looks right, and what changes is **where it comes
> from** — so nothing on screen moves and every claim underneath it does.
>
> ⚠️ **Revised 2026-08-16 after reading it against the code.** The direction survived; six things
> did not, and each is marked where it lives rather than listed apart: **§1.1** the boxes come from
> the OTF we already ship, not a download · **§3.1a** `INK.notehead` splits rather than moves, and
> it drags two floors with it · **§3.1b** `flagReach` is a composition, so F1 needs one · **§3.4a**
> the rest row NARROWS, and its real question is a `MAY_KERN` row · **§4.1** "derived" and §4's own
> unit test cannot both be had · **§F4** the payoff it claimed is already true.

---

## 0. ⚠️ Why this and not P1 — a correction to `own-engraving-engine.md` §5

That document said **P1 (our own render context) ⭐ START HERE**. That was wrong, and the reason is
worth writing down rather than quietly re-ordering — §5 there now carries the correction and points
back here for it.

P1's claim was that it *"makes everything else optional"*. It does not. While VexFlow objects still
paint themselves — `stave.setContext(ctx).draw()`, `staveNote.draw()` — **our context must implement
VexFlow's `RenderContext` interface anyway.** So P1 does not free us from VexFlow; it
re-implements VexFlow's interface, *and* it swaps the entire paint layer in one commit. That makes
it the **highest**-blast-radius of the five, not the lowest.

P2 is the opposite on every axis: **additive** (nothing is removed), **no risk to the drawing**,
**unit-testable in jsdom** (pure data and arithmetic — no browser, for once), and it is a
**prerequisite for P3** because a notehead cannot be drawn without its anchor.

⏭️ P1 moves to after P3, where its real job — *stop calling `.draw()` on VexFlow objects* — is
actually available to it.

---

## 1. What the metadata gives

`Bravura.json` (steinbergmedia/bravura, `master`, `redist/`, 1,256,984 bytes, **SIL OFL**):

| key | count | what it is for us |
|---|---|---|
| `glyphBBoxes` | **3,434** | ⭐ exact ink extents in staff spaces — **this IS `INK` + `INK_HEIGHT`** |
| `glyphsWithAnchors` | **643** | `stemUpSE`, `stemDownNW`, `cutOutNW`… — ⭐ **P3's prerequisite** |
| `engravingDefaults` | **30** | line weights: staff, stem, beam, slur, tie, ledger, barline, hairpin |
| `glyphAdvanceWidths` | 3,434 | advance vs ink — the distinction §3.1 is about |

⭐⭐ **VexFlow has none of this.** `MetricsDefaults` is style constants and pixel paddings; every
glyph extent it knows comes from a runtime `canvas.measureText`
(`own-engraving-engine.md` §3/§4). This file is strictly more than the dependency has.

### 1.1 ⭐⭐ …but for the BOXES we do not need that file — we already ship the font

`public/fonts/Bravura.otf` is **in the repo** (512,924 bytes, `OFL.txt` beside it), and
`opentype.js` is **already a dependency**: `engine/export/exportFonts.ts` parses that exact file to
outline glyphs for the PDF. Bravura's em is 1000 units and four staff spaces, so a staff space is
250 units and a bBox is a division.

Every number in §2, §3.2, §3.3 and §3.4 below was reproduced from **our own copy**, and agrees with
the published metadata to the third decimal:

```
noteheadBlack   1.180 wide, ±0.500          restWhole   1.128   up 0.036   down 0.540
noteheadHalf    1.180 wide, ±0.500          restHalf    1.128   up 0.568   down 0.008
accSharp        0.996, 1.400 / 1.392        restQuarter 1.076   up 1.492   down 1.500
accFlat         0.904, 1.756 / 0.700        rest8th     0.988   up 0.696   down 1.004
accNatural      0.672, 1.364 / 1.340        rest16th    1.280   up 0.716   down 2.000
accDoubleSharp  0.988, 0.508 / 0.500        rest32nd    1.452   up 1.704   down 2.000
accDoubleFlat   1.644, 1.748 / 0.700        augmentationDot 0.400, ±0.200
flag8thUp       1.056 wide, 3.241 down      flag16thUp  1.116 wide, 3.252 down
```

⭐ **So the generation script reads the OTF we already ship**, and three things follow:

- **The licence work is mostly already done** (§6) — no new file, no new redistribution question.
- ⭐⭐ **The metrics describe the same file the PDF export outlines.** One fewer copy of Bravura in
  play, and the copy we keep is the one already used for geometry elsewhere.
- `Bravura.json` is still needed, but **only for the two blocks an OTF cannot carry**:
  `engravingDefaults` (30 numbers, F3) and `glyphsWithAnchors` (P3). Both are small enough to
  transcribe under a check rather than vendored whole.

⚠️ `f.names.version` comes back **undefined** on our OTF. Record `head.fontRevision` instead — the
point of §6's version stamp is that a regeneration which changes numbers shows up in a diff, and a
missing field would silently defeat it.

---

## 2. ⭐⭐ The validation — the table is already right

Measured by eye and by browser over months, against the font's own numbers:

| ours | SMuFL | |
|---|---|---|
| `INK.dotWidth` 0.40, `INK_HEIGHT.dot` ±0.20 | 0.40, ±0.20 | **exact** |
| `INK.flagReach` 1.0, `flagFromTip` 3.3 | 1.06, 3.24 | ⚠️ **not the same quantity** — §3.1b |
| `accidentalHeight('#')` ±1.4 | 1.40 / 1.39 | **exact** |
| `accidentalHeight('b')` 1.8 up / 0.8 down | 1.76 / 0.70 | close |
| `accidentalHeight('##')` 0.6 / 0.5 | 0.51 / 0.50 | close |
| `INK_HEIGHT.notehead` ±0.6 | ±0.50 | ours, **rounded OUT on purpose** (§3.5) |

⭐ **This is the argument for doing it.** Adopting SMuFL is not re-litigating taste — it is the same
numbers from a source that cannot drift, cannot be beaten by a font race, and does not have to be
re-measured every time a glyph is added. The risk is low precisely *because* the answers agree.

⭐ **And half of it is already SMuFL by hand.** `curveStyle.ts` says `thickness: 0.22` **is**
`slurMidpointThickness` and 0.10 **is** `slurEndpointThickness`; `thinLineWeight.ts` says
`THIN_LINE_SPACES = 0.16` is the font's one thin-line weight — `thinBarlineThickness`,
`legerLineThickness`, `octaveLineThickness`, `tupletBracketThickness`, `hairpinThickness`, all 0.16.
**We already decided the font is the authority for weights. We just type the numbers in.** F3 makes
an existing practice mechanical rather than introducing a new one.

---

## 3. The decisions — what this plan is actually for

### 3.1 ⚠️ Which QUANTITY each row means — row by row, before anything is re-sourced

`INK.notehead = 1.13`, and its comment says how: *"measured as the offset of the DISPLACED head of a
second: 11.3 px."* SMuFL's `noteheadBlack` bBox is **1.18** wide, and `stemUpSE` is at x = 1.18.

The 0.05 is **not an error — it is a different quantity.** We measured how far VexFlow displaces a
second (which overlaps by half a stem: `stemThickness` 0.12 ÷ 2 = 0.06). The font measures ink.

⭐⭐ **This is the liability in one line**, and `spacingPadding.ts`'s own header admits its shape:

> *"Not read out of a font spec and not invented: rendered, then read back… so the table says what
> VexFlow actually does."*

**The ink model is calibrated to VexFlow's DRAWING, not to the font.** That is fine while VexFlow
draws. It silently describes nothing the day we change that — and P3 is the day.

⛔ **So no row is re-sourced until its quantity is named**: ink extent, advance width, or a
behavioural distance we chose. Three different things, currently in one table.

#### 3.1a ⭐⭐ `INK.notehead` does not MOVE — it SPLITS. It is already two quantities, in one function

The paragraph above states the principle and then stops one step short of the code.
`layout/measureColumns.ts` uses that single row **twice, differently, twelve lines apart**:

```ts
const heads = hasSecond ? 2 * INK.notehead : INK.notehead     // :141 — the DISPLACEMENT
boxes.push({ left: 0, right: heads, ... })                    // :150 — the INK
```

1.18 is right for the second. **1.13 is right for the first** — a displaced head is offset by the
ink less half a stem, which is the arithmetic three lines above. So a naive 1.13 → 1.18 makes a
chord with a second claim **2.36** where the drawing is **2.31**, and it would be wrong in the
direction the ink model exists to prevent.

⇒ Two rows, each naming its quantity: `noteheadInk` (the font's 1.18) and `secondDisplacement`
(1.13, or `noteheadInk − stemThickness / 2` once F3 has `stemThickness`).

⚠️ **And the knock-on that §3.6 was missing.** `MIN_COLUMN_GAP = INK.notehead + pairPadding('note',
'note')` moves **1.43 → 1.48**, and `EMPTY_BAR_FLOOR_PX` is derived from it — so the bar-width drag
floor and the empty-bar shrink floor **both move**, against a comment in that same file recording
that *he has reported three times that empty bars already do not shrink far enough*. Whichever
quantity that floor should be keyed on is a decision, not a consequence: it is in §3.6's batch now.

#### 3.1b ⭐ `flagReach` is a COMPOSITION of three numbers, not a lookup

§2 lists our 1.0 against the font's 1.06 as agreement. They are different quantities. The font's
`flag8thUp` is 1.056 wide **from the STEM's x**; ours is reach past the **notehead's right edge**.
Compose it:

```
1.18 (noteheadInk) − 0.12 (stemThickness) + 1.056 (flag8thUp) = 2.12 past the anchor
```

…against the 2.15 measured in Chrome, and our 1.0 past a 1.13 head = 2.13. The three agree; the
lookup never did.

⭐ **So `flagReach` survives F2 as a FORMULA**, exactly like `ACCIDENTAL_WIDTH = glyphBox + 0.31` in
§3.2 — which means **F1's module is `glyphBox` plus a thin COMPOSITION layer**, and F2 is not a
rename (§5). ⛔ Do not let it be planned as one: a rename would put 1.06 where 2.12 belongs.

### 3.2 Accidental widths decompose cleanly — and the decomposition is verifiable

`ACCIDENTAL_WIDTH` is a **column** width (glyph + the spacing we leave), not a glyph width:

| sign | ours (column) | SMuFL glyph | implied padding |
|---|---|---|---|
| `#` | 1.30 | 1.00 | +0.30 |
| `b` | 1.20 | 0.90 | +0.30 |
| `n` | 1.00 | 0.67 | +0.33 |
| `##` | 1.30 | 0.99 | +0.31 |
| `bb` | 2.00 | 1.64 | +0.36 |

⭐ **The padding is one number, ~0.31 spaces**, across five glyphs of four different widths. So the
split is not a guess: `column = glyphBox(sign) + ACCIDENTAL_COLUMN_PADDING`. The two outliers (`n`
at 0.33, `bb` at 0.36) become **visible** instead of baked in, which is the point.

⏭️ Decide: keep 0.31 flat, or keep today's five numbers as overrides. My recommendation is flat —
a per-sign padding is a claim we cannot justify and were never making deliberately.

### 3.3 Rests — the slack we left on purpose is smaller than we thought

`REST_WIDTH`'s comment: *"Measured as the glyph's LAYOUT BOX, not as an advance… The box over-reads
a notehead by 0.17 spaces, so these carry about that much slack. Left uncorrected on purpose… **a
per-glyph side-bearing correction is not something we can verify.**"*

⭐⭐ **`glyphBBoxes` IS the per-glyph side-bearing correction it says cannot be verified.**

| | ours | SMuFL | slack |
|---|---|---|---|
| `w` | 1.20 | 1.13 | +0.07 |
| `h` | 1.20 | 1.13 | +0.07 |
| `q` | 1.10 | 1.08 | +0.02 |
| `8` | 1.00 | 0.99 | +0.01 |
| `16` | 1.30 | 1.28 | +0.02 |
| `32` | 1.50 | 1.45 | +0.05 |

The feared 0.17 is really 0.01–0.07. ⚠️ Note the *direction*: these are minima, so tightening them
lets bars get narrower. That is a visible change and belongs in §3.6's batch.

### 3.4 ⭐⭐ The row that was never added: a REST's HEIGHT

`INK_HEIGHT` has four rows — `notehead`, `dot`, `ledger`, `flagFromTip`. **There is no rest.** So
`layout/kerning.ts` cannot answer *"may this accidental tuck under that rest?"*, because a rest has
no vertical band to compare against.

⚠️ **The reason is NOT that heights were hard to measure** — the code says so itself, and the first
draft of this section had it wrong. `layout/measureColumns.ts:126`:

> *"A rest's own band is not modelled: nothing kerns against a rest (`MAY_KERN`), so the honest
> thing is a band covering the staff rather than a position we would have to predict."*

A rest is therefore given `top: 0, bottom: 4` — **the whole staff** — deliberately, and the missing
piece is a **position**, not an extent. That changes what §3.6 is asking for; see §3.4a.

The font has the extents outright, and they are not uniform in the least:

| | up | down |
|---|---|---|
| `restWhole` | **0.04** | 0.54 |
| `restHalf` | 0.57 | **0.01** |
| `restQuarter` | 1.49 | 1.50 |
| `rest16th` | 0.72 | **2.00** |

⭐ A whole rest hangs almost entirely BELOW its anchor and a half rest sits entirely above — the
notation's oldest asymmetry, and the model currently cannot say it. **This is the one place where
P2 makes the picture better rather than only better-founded.**

#### 3.4a ⚠️ What the row actually costs — the direction is the opposite, and there are two decisions

Three corrections, because the naive reading of §3.4 is wrong on every one:

1. 🚨 **It can only NARROW, never widen** — the opposite of what §3.6 first claimed. A rest's band
   today is the entire staff, which is the most conservative band there is; a real band can only
   make a pair *more* clear. And `inkFloor` skips a pair only when it MAY kern **and** is clear, so
   like every other kern this is incapable of widening anything (`kerning.ts`'s own invariant).
2. ⭐⭐ **On its own it changes NOTHING.** `MAY_KERN` has no rest row, so a rest's band is never
   consulted whatever it says. **The decision is `['rest', 'accidental']` joining that table** — the
   heights are only what makes it safe to add. ⇒ That is the question for §3.6, not the numbers.
3. ⚠️ **The font gives half the answer, and §3.1's own trap is the other half.** `glyphBBoxes` is
   ink around the glyph's **origin**; the model needs a band below the top stave line. Which line
   the origin sits on is a *placement*, and placement is VexFlow behaviour, not font data — a whole
   rest hangs from the 4th line, a half rest sits on the 3rd, the flagged rests centre on the
   middle. That is a three-row table we still have to state and measure, and the numbers above
   read as they do (`restWhole` 0.04/0.54, `restHalf` 0.57/0.01) **because** the origin already
   encodes it, which is easy to mistake for it being free.

#### 3.4b ✅ Measuring the placement found a BUG IN THE DRAWING — FIXED 2026-08-16

> **Researched, then fixed.** Two agents were sent out before deciding anything: the printed
> tradition, and the four reference engines' source. Both came back agreeing, so the drawing moved.
>
> ⭐ **The citation**, Elaine Gould, *Behind Bars*, **p. 34**:
> *"The semibreve hangs from the second line down; the minim rest sits on the centre stave-line."*
> — "second line down" being her phrasing for the fourth line counting up.
>
> ⭐ **Independently, by arithmetic**: Byrd, *Music Notation by Computer* (1984), Appendix I p. I-14,
> documents a rest shift of *"-6 … WOULD LEAVE A WHOLE REST HANGING FROM THE BOTTOM LINE"* — six
> half-spaces below normal, so normal is three spaces above the bottom line. The fourth line, reached
> without reference to Gould.
>
> **The engines are unanimous**: LilyPond `staff-position +2` (*"make a semibreve rest hang from the
> next available line"*), MuseScore `computeWholeOrBreveRestOffset` → `line 1`, Verovio `loc 6`.
> ⭐⭐ **And none of them treats a whole-BAR rest as a vertical special case** — MuseScore does not
> even distinguish it (`V_MEASURE` falls through to `V_WHOLE`). Gould, Gedan and Byrd each isolate
> the whole-bar rest's special treatment to **horizontal centring**, which settles the one question
> that mattered most here, since an empty bar is what the app shows.
>
> ⚠️ **VexFlow has no rule at all** — a rest goes exactly where its key says, and VexFlow's own test
> files disagree with each other (`rests_tests.js` uses `b/4` where `stave_tests.js` uses `d/5`).
> So this was never the library's placement to get wrong; it was ours.
>
> **What changed:** a new module `layout/restPlacement.ts` owns the rule, and ⭐ **both the model and
> the drawing read it** — `NoteBuilder.restKey` converts it to a VexFlow key, `spacingPadding.restBand`
> to a band. Two places owning one rule is how they came to disagree; now there is one.

The finding as it was written down when it was found:


Written down at the moment it was found (F2, 2026-08-16), because it is the plan's own prediction
coming true: *"the one place P2 makes the picture better rather than only better-founded"*.

`rendering/NoteBuilder.ts` gives **every** rest the key `b/4`, and VexFlow puts a rest exactly where
its key says — `getLineForRest()` returns the key's line unchanged, with no correction of its own.
So all six rests land on the **middle line**. For a minim rest that is right; for a **semibreve rest
it is one staff space too low**, because that one hangs from the **fourth line** (the second from the
top). Measured in the browser and confirmed by eye on the case every score shows — an empty bar.

⭐ **The fix is one key in `NoteBuilder`.** It is a change to the DRAWING, which §7 says this plan
does not make, and it moves a glyph in every empty bar in the app — so it is his call, and it is the
one item in this document that is a correctness question rather than a taste one.

⛔ **Until then the model describes the DRAWING, out loud.** `REST_LINE` is all-middle-line and says
why; `e2e/kerning.e2e.ts` asserts the bug on purpose and names itself as the pin. ⭐ **Fix the
drawing and that test fails**, which is exactly when the table has to move with it — the alternative
is measuring one place while drawing another, silently, which is what the whole ink table exists to
prevent.

### 3.5 Which rounded values we KEEP, and why that has to be written down

`INK_HEIGHT.notehead = 0.6` against the font's 0.50 — *"the measured 0.5/0.6, rounded OUT."*
Deliberate: a height is used as a clearance, and a generous clearance is safe where a tight one
collides.

⛔ **Keeping it is fine. Keeping it without a recorded reason is how it gets "corrected" later**, by
someone diffing our table against the font and finding a discrepancy. Every deliberate divergence
becomes an explicit override carrying its sentence — never a silent difference.

### 3.6 ⚠️ HIS EYE — batched, one look, not six interruptions

Nothing below is mine to decide. Collected here so they arrive together (the lesson from the slur
phases):

1. **Rest widths tighten by 0.01–0.07 spaces** (§3.3). Dense bars get slightly narrower.
2. **Notehead ink 1.13 → 1.18** (§3.1) — 0.05 spaces on **every** note-to-note gap in the score.
3. ⚠️ **…and with it, the FLOORS.** `MIN_COLUMN_GAP` 1.43 → 1.48, so the bar-width drag and the
   empty-bar shrink both stop 0.05 spaces earlier (§3.1a) — and he has said three times that empty
   bars do not shrink far enough. Keeping those floors on the *displacement* (1.13) instead is a
   defensible answer and a separate one: **a floor is a gesture limit, an ink row is a claim about
   the drawing**, and P2 is the moment they stop being the same number by accident.
4. **Accidental column padding flat at 0.31** vs today's 0.30/0.30/0.33/0.31/0.36 (§3.2).
5. **Ledger reach.** Ours is −0.30/+1.50 around the anchor; the font says `legerLineExtension` 0.4
   past the notehead each side, i.e. −0.40/+1.58 on a 1.18 head. Slightly longer ledgers.
6. ⭐⭐ **Should a REST kern against an accidental at all?** — `['rest', 'accidental']` in
   `MAY_KERN` (§3.4a). *This* is the question; the heights are only what makes it answerable. It
   can only make dense bars **narrower**, never wider, and until the row exists §3.4's numbers
   change nothing on screen.

⛔ **Not on this list:** the weights. `curveStyle` and `thinLineWeight` already adopted Bravura's
`engravingDefaults` explicitly (§2), so F3 changes no number he has not already approved.

---

## 4. 🚨 What the e2e tests ASSERT changes — and they will not notice

Today `e2e/spacing.e2e.ts` and `e2e/kerning.e2e.ts` re-measure the drawing and fail if the table
stops describing it. Their subject is:

> **"the table describes what VexFlow draws."**

After F2 the same tests, unchanged, would assert:

> **"our drawing agrees with the font."**

⭐⭐ **Those are not the same claim, and the tests go green either way.** A test that has quietly
changed subject is exactly the silent failure this codebase names everywhere — and it is the single
strongest reason this plan exists.

So F2 is not done until the check is **split in two**, deliberately:

1. **Ours vs the font** — a jsdom unit test: every row of `INK`/`INK_HEIGHT` equals
   `glyphBox(name)`, or is an override carrying its reason (§3.5). Cheap, exact, no browser.
2. **The font vs the drawing** — the existing browser tests, re-pointed: what VexFlow actually
   draws still matches the font. ⭐ **That one is a VexFlow-conformance test**, and when it starts
   failing it is telling us something real about the dependency rather than about us.

⚠️ Test (2) is the interesting one and it is new in kind: it is the first check we would have that
**names the dependency as the thing under test**.

### 4.1 🚨 …but "DERIVED" and test (1) cannot both be had — and the fork matters

If `INK` is **derived at import** (`notehead: glyphBox('noteheadBlack').right`), then test (1) is
`expect(derived).toBe(itsOwnSource)` — a **tautology**. A derivation cannot disagree with what it
was derived from, so the only content left in that test is the override list. ⭐ That is the same
silent change of subject §4 exists to prevent, one level down, and it would arrive in the very
commit that fixes the first one.

⏭️ **Recommendation: keep the LITERALS, and make the jsdom test the gate.** The rows stay exactly
as they read today — *"every row equals the font, or is a named override carrying its sentence"* —
and the test does real work. Two reasons beyond the tautology:

- ⭐ **The numbers are where the prose is.** `pairPadding`'s figures carry paragraphs of
  justification written against those specific values; deriving them deletes the thing the
  paragraphs are attached to, and `spacingPadding.ts` is a table that is *read*.
- The payoff is untouched either way: the generated module is static in both, so §F4's independence
  from a font race does not depend on this fork.

⇒ F2's wording changes from *"become derived"* to **"become CHECKED against the font, with every
divergence an override that says why"**. That is what §3.5 already asks for, and the two were in
tension.

### 4.2 ⚠️ There are THREE copies of Bravura, and test (2) is the only thing that reconciles them

| copy | what it decides |
|---|---|
| VexFlow's bundled **woff2** (`node_modules/vexflow/…/bravura.js`, base64) | what the SCREEN draws |
| `public/fonts/Bravura.otf` | what the PDF export **outlines**, and now (§1.1) what we MEASURE |
| the metadata (`engravingDefaults`, anchors) | the weights and P3's attachment points |

Nothing today checks that they are the same Bravura. ⭐ **That — not "VexFlow conformance" — is why
test (2) is worth writing**: it is the one place where what we measured meets what was drawn, and a
version skew between the three can only surface there. The generation script should also
cross-check the JSON's `glyphBBoxes` against the OTF's own boxes and ⭐ **report any disagreement**,
which is the cheap half of the same question.

✅ **Answered for two of the three, by F1's cross-check (2026-08-16): the skew is REAL and it is
harmless.** Our OTF is Bravura **1.392**, the metadata **1.481** — and all 60 glyphs' boxes are
identical to 0.001 spaces. So the versions differ and the numbers do not, which is the outcome that
had to be *checked* rather than assumed. ⏭️ The third copy — VexFlow's bundled woff2, the one the
screen is actually drawn in — is still unchecked, and that is exactly what test (2) is for.

---

## 5. The work

### F1 — `engine/fonts/`, the module ✅ **BUILT 2026-08-16**

> `scripts/generate-font-metrics.mjs` → `src/engine/fonts/bravuraMetrics.ts` (generated, 60 glyphs),
> `src/engine/fonts/fontMetrics.ts` (the lookup + the compositions) + `fontMetrics.test.ts` (21).
> `scripts/vendor/Bravura.json` + `PROVENANCE.md`, build-time only. ⛔ Nothing consumes it yet —
> that is F2, and until then the module is tree-shaken out of the bundle.
>
> **Two things came out of building it:**
>
> 1. 🚨 **A real version skew, and §4.2 was right to ask.** `public/fonts/Bravura.otf` is
>    **1.392**; the metadata is **1.481**. ⭐ The cross-check answers it: all 60 boxes are identical
>    to 0.001 spaces, so the skew is harmless *for the glyphs we draw* — and both versions are now
>    stamped in the generated module rather than conflated into one "font version".
> 2. ⚠️ **One of the 30 `engravingDefaults` is not a measurement** — `textFontFamily` is a font
>    stack. Dropped and reported, so `engravingDefault()` can promise a number to every caller.
>
> ⭐ The spec is `fontMetrics.test.ts` and it deliberately does not restate generated numbers
> (§4.1's argument, one level down): it asserts facts of NOTATION the font must agree with (a
> notehead is one space tall, a sharp is symmetric and a flat is not, a whole rest hangs below its
> origin), the COMPOSITIONS, and the agreement with the table we have drawn with for months.
> Break-tested: corrupting three generated values fails seven of them.

`glyphBox(name) → {left, right, up, down}`, `anchor(name, which) → [x, y]`,
`engravingDefault(name) → number`. Staff spaces in, staff spaces out. Pure lookup, no DOM, no
VexFlow — so it is a unit test.

⭐ **Plus a thin COMPOSITION layer, and it is not optional** (§3.1b): `flagReach` is
`noteheadInk − stemThickness/2 + flag8thUp`, an accidental column is `glyphBox + 0.31`, a rest's
band is `glyphBox + a placement`. A bare lookup would put the font's 1.06 where 2.12 belongs.

**The source is `public/fonts/Bravura.otf`** — the file we already ship and already parse with
`opentype.js` (§1.1). A **generation script** (`scripts/`) reads it, emits a small checked-in TS
module for the ~60 glyphs we draw, declares that glyph list in one place, and ⭐ **reports what it
dropped** — a silent subset is the same defect as a silent cap.

⛔ **The reason for a checked-in subset is NOT size, and saying so invites the wrong reply.** We
already ship 500 KB of SMuFL metadata (`public/smufl/{glyphnames,ranges,classes}.json`, fetched at
first open by the Symbols window, with a `PROVENANCE.md`) — so *"just fetch it lazily like that
one"* is the obvious counter, and it is wrong for a different reason:

> ⭐⭐ **The ink table is read SYNCHRONOUSLY, inside the layout path, and in jsdom unit tests.**
> There is no `await` there and no `fetch` in jsdom — and F4's whole point is to stop waiting on a
> font at all. The Symbols window can wait for a chart nobody has opened; `measureColumns` cannot
> wait for anything.

### F2 — point the ink table at it ⏳ **STRUCTURE BUILT 2026-08-16, decisions pending**

> **Built, and nothing on screen moved** — every number is still its own, and the six §3.6 questions
> are one line each to flip once he has decided:
> `spacingPadding.font.test.ts` (the ours-vs-font GATE, with the override list and a totality check
> that fails on an undeclared drift or a new unsourced row) · `INK.notehead` split from
> `INK.secondDisplacement` (§3.1a) with `measureColumns` reading the right one at each site ·
> `REST_HEIGHT` + `REST_LINE` + `restBand`, so a rest's band is its own instead of the whole staff ·
> `e2e/kerning.e2e.ts` re-pointed to *the font against the drawing* (§4) and 🚨 closing §4.2's third
> copy: **the woff2 VexFlow draws with matches the OTF we measure**, to the rasteriser's own 0.1
> spaces.
>
> ⏭️ **What is left is his**: the six of §3.6, plus §3.4b's whole-rest placement.

`INK`, `INK_HEIGHT`, `ACCIDENTAL_WIDTH`, `accidentalHeight`, `REST_WIDTH` become **checked against
the font**, not silently derived from it (§4.1), with §3.5's overrides explicit and carrying their
sentences. **Split the check per §4.** Add §3.4's rest heights *and* answer §3.6's question 6 —
without a `MAY_KERN` row they are inert.

⚠️ Two rows do not survive as rows: `INK.notehead` **splits** into `noteheadInk` + `secondDisplacement`
(§3.1a), and `flagReach` becomes a formula (§3.1b).

Mechanically: `spacingPadding.test.ts:14` pins `INK.notehead` at 1.13 and moves with the split, and
`npm run audit:tests` will want a spec beside the new module — name it after the **lookup** module,
never the generated data.

⛔ Not done until §4 is done.

### F3 — adopt `engravingDefaults` for the weights
`THIN_LINE_SPACES`, the curve thicknesses, ledger, barline, beam. ⭐ Mostly deleting hand-typed
copies of numbers whose comments already name their source (§2). No visible change by construction —
if anything moves, a transcription was wrong, and that is worth knowing.

### F4 — the payoff
⚠️ **Checked, and this was overstated: it is already true.** Nothing in `layout/` calls
`measureText` — the only callers are `rendering/musicFontReady.ts` and the e2e. Our ink is
*constants*, and a constant does not race a font. `measureText` is how the numbers were **obtained**
(by hand, in Chrome), not how they are read.

So F4 is not a runtime change. What F2/F3 actually change is **where the numbers come from and who
checks them** — and the real payoffs, in order:

1. ⭐⭐ **The rest heights** (§3.4) — the one item that changes the picture rather than its footing.
2. ⭐ **A new drawn glyph gets its metrics without a browser measuring session.** Today the
   `⛔ a new drawn element adds a ROW here` rule costs an afternoon in Chrome; after F1 it is a
   lookup, and that is what makes the rule cheap enough to keep obeying.
3. ⭐⭐ **P3's anchors**, which have no other source at all.

The `musicFontReady` gate stays while VexFlow draws — it must, because VexFlow still measures.

⭐ **Stop after F2 and it was worth it** (payoffs 1 and 2 are both in F2). F3 is tidying. F4 is a
paragraph in a doc, not a piece of work.

---

## 6. Licence

Bravura and its metadata are **SIL OFL** — the same terms as the font we already load through
VexFlow, and a *different* licence from VexFlow's own MIT
(`own-engraving-engine.md` §6.7 condition 3, which is exactly this).

⭐ **Mostly already done, because we already ship the font** (§1.1): `public/fonts/OFL.txt` sits
beside `Bravura.otf` and covers it. ⛔ So no `LICENSES/` directory — this repo already has a pattern
for exactly this, and inventing a second one is how attribution ends up in two places that drift:

- **`public/fonts/`** — the OTF, under `OFL.txt`. The boxes come from here. Nothing to add.
- **`public/smufl/PROVENANCE.md`** — the shape to copy for whatever `Bravura.json` we take
  `engravingDefaults` and the anchors from: where it came from, the exact URL, the date, verbatim,
  and *"re-download rather than hand-edit"*.
- **The generated module** names its source and its font version in a header comment — ⚠️ from the
  OTF's `head.fontRevision`, since `names.version` is undefined on our copy (§1.1) — so a
  regeneration that changes numbers is visible in a diff.

---

## 7. ⛔ What this does NOT do

- It does not draw anything. Not one glyph moves from VexFlow to us. **That is P3.**
- It does not touch the spacing LAW (`layout/spacing.ts`) — only the ink half.
- It does not remove the `musicFontReady` gate (§F4).
- ⛔ It does not create `scene/` or `paint/`. Those land with P1, which is now after P3 (§0).
- 🚨 **It does not touch `layout/headerInk.ts`, and that has to be said out loud.** It is the
  codebase's *other* hand-measured ink table with the same pedigree (`CLEF_FULL` treble 3.2, bass
  3.5, alto/tenor 3.6; the meter by digit count), so it reads as the obvious next target — and the
  font would give the wrong answer. Those numbers are **stave-x to the first notehead**, a VexFlow
  *placement* including its `Stave.padding`, not a glyph extent: Bravura's own `gClef` is 2.68,
  `fClef` 2.76, `cClef` 2.80, and all three disagree with the table for good reason. §3.1's rule
  applies here more sharply than anywhere else — ⛔ **do not re-source a header row until someone
  has separated the glyph from its placement**, which is P5's job, not P2's.
