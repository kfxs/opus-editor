# The ink table comes from the FONT — SMuFL as its source

> 📄 **P2 of `docs/own-engraving-engine.md`.** That document is the strategy — why we are taking the
> drawing at all, the five pieces, the target architecture. ⛔ This one does not restate it. It is
> the DECISION RECORD for the one piece we do next, and the list of questions that need his eye.
>
> ⭐ **The work here is small. The decisions are not**, which is the only reason this file exists:
> every number below already exists and already looks right, and what changes is **where it comes
> from** — so nothing on screen moves and every claim underneath it does.

---

## 0. ⚠️ Why this and not P1 — a correction to `own-engraving-engine.md` §5

That document says **P1 (our own render context) ⭐ START HERE**. That was wrong, and the reason is
worth writing down rather than quietly re-ordering.

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

---

## 2. ⭐⭐ The validation — the table is already right

Measured by eye and by browser over months, against the font's own numbers:

| ours | SMuFL | |
|---|---|---|
| `INK.dotWidth` 0.40, `INK_HEIGHT.dot` ±0.20 | 0.40, ±0.20 | **exact** |
| `INK.flagReach` 1.0, `flagFromTip` 3.3 | 1.06, 3.24 | spot on |
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

That is a `⛔ a new drawn element adds a ROW here` row that was never added, and the reason is in the
kerning notes: heights are hard to measure and needed canvas `actualBoundingBox*`. The font has them
outright, and they are not uniform in the least:

| | up | down |
|---|---|---|
| `restWhole` | **0.04** | 0.54 |
| `restHalf` | 0.57 | **0.01** |
| `restQuarter` | 1.49 | 1.50 |
| `rest16th` | 0.72 | **2.00** |

⭐ A whole rest hangs almost entirely BELOW its anchor and a half rest sits entirely above — the
notation's oldest asymmetry, and the model currently cannot say it. **This is the one place where
P2 makes the picture better rather than only better-founded.**

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
3. **Accidental column padding flat at 0.31** vs today's 0.30/0.30/0.33/0.31/0.36 (§3.2).
4. **Ledger reach.** Ours is −0.30/+1.50 around the anchor; the font says `legerLineExtension` 0.4
   past the notehead each side, i.e. −0.40/+1.58 on a 1.18 head. Slightly longer ledgers.
5. **Rest heights enter kerning for the first time** (§3.4) — can only widen, never narrow.

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

---

## 5. The work

### F1 — `engine/fonts/`, the module
`glyphBox(name) → {left, right, up, down}`, `anchor(name, which) → [x, y]`,
`engravingDefault(name) → number`. Staff spaces in, staff spaces out. Pure lookup, no DOM, no
VexFlow — so it is a unit test.

⚠️ **1.26 MB cannot ship.** We need ~60 glyphs. So: a **generation script** (`scripts/`) that reads
the full metadata and emits a small checked-in TS module, with the glyph list declared in one place
and ⭐ **a report of what it dropped** — a silent subset is the same defect as a silent cap.

### F2 — point the ink table at it
`INK`, `INK_HEIGHT`, `ACCIDENTAL_WIDTH`, `accidentalHeight`, `REST_WIDTH` become derived, with §3.5's
overrides explicit. **Split the check per §4.** Add §3.4's rest heights.
⛔ Not done until §4 is done.

### F3 — adopt `engravingDefaults` for the weights
`THIN_LINE_SPACES`, the curve thicknesses, ledger, barline, beam. ⭐ Mostly deleting hand-typed
copies of numbers whose comments already name their source (§2). No visible change by construction —
if anything moves, a transcription was wrong, and that is worth knowing.

### F4 — the payoff
Our ink stops needing `measureText`. The `musicFontReady` gate stays while VexFlow draws (it must —
VexFlow still measures), but **our layer's numbers no longer depend on a font race.**

⭐ Stop after F2 and it was worth it. F3 is tidying. F4 is the reason.

---

## 6. Licence

Bravura and its metadata are **SIL OFL** — the same terms as the font we already load through
VexFlow, and a *different* licence from VexFlow's own MIT
(`own-engraving-engine.md` §6.7 condition 3, which is exactly this).

Needed: `LICENSES/` carrying the OFL text and the attribution, and the generated module naming its
source and font version (`fontVersion` is in the JSON — record it, so a regeneration that changes
numbers is visible in a diff).

---

## 7. ⛔ What this does NOT do

- It does not draw anything. Not one glyph moves from VexFlow to us. **That is P3.**
- It does not touch the spacing LAW (`layout/spacing.ts`) — only the ink half.
- It does not remove the `musicFontReady` gate (§F4).
- ⛔ It does not create `scene/` or `paint/`. Those land with P1, which is now after P3 (§0).
