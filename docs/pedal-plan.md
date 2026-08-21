# THE SUSTAIN PEDAL — `Ped.` and its release

The fifth line, after the slur, the hairpin, the trill and the ottava. **Sustain only, drawn
`Ped. … ✻`, sounding from day one** — his calls, 2026-08-14.

> ⭐ **The style is not the feature.** Today the span is drawn as two glyphs with nothing between
> them; tomorrow the same span grows a bracket, a hook and a retake notch. Every decision below is
> made so that swap is a change in **one renderer**, not in the model, the ops, the re-bar, the
> clipboard or the playback.

> ⚠️ **Read against the code, 2026-08-14 — this plan is the AMENDED one.** Six sites it never named
> were added (`spanAnchors` §5.5, `staffContent` §5.6, two more re-bar rows §8, `pedalGroupMap` and
> the highlight method §6.1, three tool-union rows §7); three claims it made were WRONG and are
> corrected in place, each keeping the wrong version visible so it cannot come back: the redraw key
> is `'ignored'` and not `'shape'` (§5.4), `Ctrl+←/→` is BUILT here and not inherited from an ottava
> that never had it (§6.3), and the stamp draws NO ghost (§7 — ⚠️ itself amended 2026-08-17: the
> stamp DOES draw one, and that amendment carries the position rule every sign ghost now shares).
> Three decisions it left open are now decided: the overlap split (§3.3), the lift's x (§5.2) and the glyphs' alignment (§5.1a).

---

## 1. The engraving rules

### Verified, with a source

1. **All pedal lines go BELOW the bottom staff — and outside EVERYTHING.** Outside slurs,
   articulations, dynamics, octave lines. The pedal is the furthest family from the music, on the
   underneath side. (Dorico, *Positions of pedal lines*.)

   ⚠️ **Two halves of this rule are not achievable today, and both are stated rather than quietly
   dropped.** *"Below the BOTTOM staff"* is a fact about the INSTRUMENT, and we have no instrument
   object — the pedal is drawn under the staff it is attached to (§3.2's second seam), which on a
   two-staff score puts it BETWEEN the staves until the piano exists. And *"outside slurs and
   articulations"* cannot be expressed by the ladder: only the dynamics line, the trill, the ottava
   and the tempo row file claims in `layout/outsideStaffBand` — `renderSlurs` files none, and
   articulations are not in the ink model at all (`layout/inkBand.ts`'s own "⛔ It does not know
   about articulations, slurs or tuplet brackets"). So a below-staff slur will be crossed. That is
   the whole family's limitation, inherited, ⛔ not a pedal bug to fix here.
2. **A pedal and its own release must align on ONE level.** Consecutive pedal-and-release *pairs*
   need not align with each other; align them when there is room. The overriding consideration:
   **no sign so far below the staff that it goes unnoticed.** (Gould, *Behind Bars* p. 333.)
3. **The release lands at or before the barline** — never after it. (Gould; the rule this plan takes
   as its default, against MuseScore, which anchors the end to the *next* bar's first note.)
4. **The three styles mean the same thing.** `Ped. … ✻`, the bare bracket, and mixed
   (`Ped.` + line + hook) are one statement in three dresses. What differs is *exactness*: the line
   is infallible about where the lift happens, `Ped.`/`✻` is not — engravers disagree about whether
   the `P` or the `e` marks the depression point. (NOTATIO; MuseScore handbook.)
5. **Simultaneous pedals stack, never merge**: sustain closest to the staff, sostenuto below it,
   una corda furthest away. (Dorico.) ⛔ Two pedals of the SAME kind can never overlap — one damper,
   one foot.
6. **Habitual dress per pedal**: sustain `Ped. … ✻`, sostenuto `Sost. Ped.` with a line, una corda
   plain text (`una corda … tre corde`) with no bracket. So overlapping pedals are told apart by
   their words, not only by their row.

### Owed to the book, not yet read

Gould pp. 333–337 covers the pedalling chapter and the sostenuto pages; we have p. 333's alignment
rule second-hand and pp. 336–337 by reference only. Three things are missing, and two of them decide
code:

- **the numbers** — how far below the staff the first sign sits, and the gap between stacked pedal
  rows (§12's taste constants);
- ⭐ **what she says about a pedal crossing a system break** — the continuation question (§5.3). Her
  rule for the *ottava* is verified (restate the sign at each system, usually parenthesised); ⛔ we
  have **no verified statement of hers about pedals**, only a second-hand forum reading;
- her table 2 on p. 333, which MusicXML's own issue #102 cites as the catalogue of pedal signs — the
  authority for the styles we are deferring.

---

## 2. VexFlow 5.0.0 — `PedalMarking` exists. ⛔ Reject it.

`node_modules/vexflow/build/esm/src/pedalmarking.js` — `createSustain/createSostenuto/createUnaCorda`,
types `TEXT | BRACKET | MIXED`, `drawText()` / `drawBracketed()`. Five reasons, four of them the ones
that already killed `TextBracket` (ottava) and `VibratoBracket` (trill):

1. **y is a fixed rung** — `note.checkStave().getYForBottomText(this.line + 3)`. Blind to stems,
   ledgers, and to the dynamics line the pedal must clear. That is the exact defect
   `layout/dynamicsLine.ts` exists to fix.
2. **One stave, one system** — `note.getAbsoluteX()` off a single stave. No system break, no
   fragments.
3. **Hardcoded pixels** — `bracketHeight: 10`, `textMarginRight: 6`. Not staff spaces
   (`reference_engraving_text_sizes`: ⛔ never px).
4. **A note-array API** — it takes *pairs of `StaveNote`s* (down, up, down, up…), and a retake is
   "pass the same note twice". Our span is positional; we would be minting notes to feed it.
5. **It calls `Glyphs.keyboardPedalPed`** — and `Glyphs` is CJS-only, **undefined in our browser
   build** (`reference_vexflow_glyphs_esm_vs_cjs`).

✅ **What we take: the codepoints, written out.** `Ped.` = `U+E650` (`keyboardPedalPed`), the release
✻ = `U+E655` (`keyboardPedalUp`), and the continuation parens `U+E676` / `U+E677`
(`keyboardPedalParensLeft`/`Right` — "left/right parenthesis for pedal marking", §5.3). Reserved for
later: `U+E657` up-notch, `U+E656` half, `U+E658` hyphen, `U+E672`/`U+E673` hook start/end,
`U+E659` Sost., `U+E651` short `P`.

Drawing is our own pass, in the `HairpinRenderer` / `OttavaRenderer` shape — which brings the
system-break fragments and the staff `scale(k)` handling with it.

---

## 3. The model — POSITIONAL, and as small as the ottava's

⭐ **A pedal is a CLEF-shaped statement, like the ottava**: it governs a REGION — every voice, every
note in it, including notes typed into it afterwards. So it takes the `Hairpin`'s address, not the
`Trill`'s: measure-owned, beat-anchored, carrying its own extent, stored on the bar its START lands
in.

```ts
/** Measure.pedals?: Pedal[] — stored on the bar its START lands in. */
interface Pedal {
  id: string
  /** Start beat within the owning measure (a slot boundary, like clefs/dynamics/hairpins). */
  beat: Fraction
  /** How much music it holds, in quarter beats. Always > 0. The LIFT is `beat + length`. */
  length: Fraction
  /** Staff it is ATTACHED to (a StaffInfo id); absent = staff 0. ⚠️ Attached ≠ governs — §3.2. */
  staffId?: string
}
```

### 3.1 ⛔ What is deliberately NOT a field

- **No `type`.** Sustain is the only pedal we build. When sostenuto and una corda arrive they add
  ONE optional field (`type?: 'sostenuto' | 'unaCorda'`, absent = sustain) — additive, no migration
  (no migration, ever — `docs/json-io-plan.md`), and no JSON written today becomes wrong.
- **No `style`.** `Ped.✻` vs bracket vs mixed is presentation (DESIGN-PRINCIPLES §3) — the
  renderer's default now, an engraving preset later. ⭐ This is the field that would have made the
  promised swap a model change.
- **No `placement`.** A pedal is always below. Nothing to store, nothing to flip (⛔ no `x` key).
- **No `voice`.** The ottava's exception, harder: one damper serves the whole instrument.
- **No retake / break points.** §3.3.
- **No y, no hook height, no stored `✻` position.** The render's, or the engraving-overrides
  compartment's — §6.3.
- **No `endNoteId`.** The lift is a point in TIME, not a note. §5.2.

### 3.2 ⭐⭐ The scope seam — `pedalStavesAt`, and it is the whole future-proofing

A real piano pedal sustains **every staff of the instrument**, not the staff the sign is drawn under.
We have no instrument object, and `Score.staffGroups` (*"a piano = one group of two staff ids"*) is
content but unrendered — so **the answer is not knowable today, and must not be baked in**.

```ts
/** utils/pedalScope.ts — WHICH STAVES THIS PEDAL SUSTAINS. */
pedalStavesAt(score: Score, pedal: Pedal): string[]   // today: [pedal.staffId ?? staff 0]

/** ⭐ …and WHICH STAFF IT IS DRAWN UNDER — §1 rule 1's other half. */
pedalDrawStaff(score: Score, pedal: Pedal): string | undefined   // today: pedal.staffId
```

⭐ One function, one caller (playback), one file to change the day the piano exists — `soundingShiftAt`'s
arrangement exactly, and for its reason: a rule that will change belongs at a seam, not spread across
every site that needs it. ⛔ Never inline `pedal.staffId` at a playback site.

⭐⭐ **TWO seams, because §1 rule 1 asks TWO questions and their answers diverge the day the piano
exists.** *Which staves does it sustain* is the whole instrument; *which staff is it drawn under* is
the BOTTOM one of that instrument. Today both answers are the attached staff, which is exactly why
they must be written as two functions now: fused into one they would be indistinguishable, and the
day `staffGroups` is rendered one of them changes and the other does not. The renderer calls
`pedalDrawStaff`, playback calls `pedalStavesAt`, and ⛔ neither reads `pedal.staffId` directly.

### 3.3 ⭐ Overlap is illegal, and a retake is DERIVED

Two sustain pedals overlapping on one staff is not a stack, it is a contradiction — one damper.

⭐⭐ **DECIDED, and the decision is a SPLIT — the model and the entry door answer different
questions.** The first draft of this section said "truncates the existing one … or is rejected" and
left it open; read against `models/ottavaOps.ts` it is not one question:

- **`addPedal` (the model) takes the CLEF's rule and nothing more**: at most one per `(beat, staff)`,
  last wins — an upsert, `addOttava`'s rule verbatim, repeated in the re-bar restore branch (§8),
  ⛔ never the dynamics'/hairpin's stack-freely rule. **It does NOT police overlap.** That is
  `ottavaOps`' stated principle and it holds here: *the model refuses only what it can call wrong on
  its own terms*. Two pedals whose spans overlap without sharing a start beat arrive from a re-bar,
  a paste and a length edit as well as from a create, and a model that deleted one of them would
  destroy a span the user never named, in a call that was not about it.
- **The ENTRY door truncates** — `addPedalOverNotes`, the one function both palette doors go through
  (§7): a new pedal starting inside an existing one on the same staff shortens that one to end at the
  new start. That is the pianist's real gesture (lift, re-press), it is a statement about a GESTURE,
  and a gesture is exactly what the entry phase knows about and the model does not.
- **The READER survives the rest.** Playback resolves positionally (§9) and so must pick one when the
  stored spans still overlap: the LATEST press at or before the event wins, and its lift ends the
  sustain — `soundingShiftAt`'s arrangement, one rule at one seam.

⭐ A **retake is then two adjacent spans**, and nothing in the model says so — MuseScore's rule,
where two abutting pedal lines join into `‑^‑`. Today, in `Ped.✻` dress, adjacency simply prints
`✻ Ped.` side by side, which is what the old editions do. When the bracket style arrives, the notch
is drawn where `previous.lift === next.beat` — a render-time test, ⛔ never a stored break point
(`Hairpin`'s rule, verbatim).

---

## 4. The ladder — the outermost rung, below

`layout/outsideStaffBand.ts` is already side-generic (`StaffSide`), so a *below*-staff rung costs no
new mechanism. Two consequences, both from §1 rule 1:

- ⭐⭐ **The pedal pass runs LAST among the below-staff passes** — after dynamics, hairpins and any
  below-side slur/ottava. The ladder's order **is the pass order** (`outsideStaffBand`'s stated
  rule: ⛔ there is no priority-number table and there must never be one), so "outside everything"
  is expressed by *when* the pass runs, and by nothing else.
- ⭐ **The claim covers the SPAN, and both signs share ONE baseline** — §1 rule 2, for free. The
  band is read once over the fragment's beats (`bandOver` + `staffInkBand`), one `clearanceBaseline`
  call, and both glyphs are drawn on that y. ⛔ Not a baseline per glyph: that is precisely the pair
  Gould says must align.

  ⚠️ **PER FRAGMENT, not per span** — the correction the family has already made twice
  (`TrillRenderer.baselineFor`, `OttavaRenderer.baselineFor`: *a low note on the second system must
  not push the first system's sign up for no visible reason*). For an UNBROKEN pedal — every pedal
  that has a `✻` next to its `Ped.` at all — the fragment IS the span, so Gould's pair rule is
  satisfied exactly. A pedal broken over a system break has two baselines because it has two
  pictures, and the pair rule has nothing to say about signs on different systems.

- ⛔ **What the ladder does NOT do: level consecutive pedals with each other.** Gould's p. 333 says
  consecutive pairs *need not* align but should when there is room; ours simply take their own
  baseline from their own local ink, so two pedals in one system can sit at two heights. The
  dynamics family solved the identical problem with a second, later pass
  (`layout/dynamicsChain.ts` — every mark levelled with whatever it touches), and that is the shape
  the fix would take. **Deferred, deliberately** (§12): it is a second module, it is only visible on
  a passage with several short pedals, and the rule it implements is permissive in the book.

Its two constants live in `rendering/pedalStyle.ts` as a `Clearance`, beside `DYNAMICS_LINE` and the
trill's — ⛔ no new placement rule, only new numbers (§12).

---

## 5. Drawing — `engine/rendering/PedalRenderer.ts` + `pedalStyle.ts`

### 5.1 What is drawn

`Ped.` (`U+E650`) at the start x, `✻` (`U+E655`) at the lift x, both on the span's baseline, both
sized in **staff spaces** (`reference_engraving_text_sizes`, band 2.02–2.42 sp), both inside the
staff's `scale(k)` group. Nothing between them.

### 5.1a ⚠️ The two glyphs have WIDTH, and that is three decisions the drawing cannot dodge

Both signs are wide — `Ped.` is three glyph-widths of ink and `✻` is round — so "at the x" is not yet
an instruction. `OttavaRenderer.drawNumeral` is the apparatus to copy: each glyph placed from the
MEASURED width of the one before it (`Element.getWidth()`), ⛔ never from a guessed advance.

1. **`Ped.` is LEFT-aligned on the start x** — its `P` begins where the note's ink does. (Engravers
   disagree about whether the `P` or the `e` marks the depression point, §1 rule 4; the disagreement
   is the reason the text style is called the inexact one, and left-aligning is the reading that
   needs no third opinion.)
2. **`✻` is RIGHT-aligned on the lift x** — it is drawn ending there, not beginning there. This is
   what makes §5.2's barline rule true as *drawn* rather than only as *computed*: a left-aligned `✻`
   at a lift x that sits just inside the barline would put its ink straight through the line.
3. **`PEDAL_MIN_SPAN`** — a floor on `lift x − start x`, below which the two glyphs would overlap and
   the pedal would read as one smudge. `OTTAVA_MIN_LINE` is the precedent (a `(8)` wider than the
   single notehead it covers), including its honesty: this is the one place the drawing knowingly
   overruns the span's true extent, and it says so at the site. Its value is his eye's (§12).

⚠️ **All three measure 0 in jsdom** (`reference_jsdom_cannot_measure_glyphs`), so every assertion
about them belongs in the browser suite (§10) and none of them may be unit-tested.

### 5.2 ⭐ Where each sign lands — a THIRD end rule

We now have three, and they are genuinely different — ⛔ do not copy one to another:

| family | its ink ends at |
|---|---|
| trill | the end of the note's DURATION |
| ottava | the last NOTEHEAD inside the span |
| **pedal** | **the LIFT — a point in time** |

`Ped.` sits at the start column's x. `✻` sits at the column x of `beat + length` — **except** when
that lands on a barline, where Gould's rule puts it **just inside, before the barline**
(§1 rule 3). ⭐ That exception is the whole of the difference from MuseScore.

⭐⭐ **And the exception costs NOTHING, because the trill's fallback already is it.**
`TrillRenderer.spanX` reads its end as *the next slot's left x, else the bar's `noteEndX`* — and
`measureBounds.noteEndX` is precisely "the last x the music reaches before the line". So the lift x
is one expression with no clamp in it:

```
liftX = leftX(first slot on the STAFF at or after the lift beat)      // an ordinary lift
      ?? measureBounds.get(lastCoveredBar)!.noteEndX / scale          // a lift on the barline
```

Three things about that first line, each a real difference from the trill's version:

- ⚠️ **"on the STAFF", not "in the voice".** `slotIdAfter` takes a voice because a trill has one; a
  pedal does not (§3.1), so the search is over every voice of the staff and takes the earliest.
- ⚠️ **"at or after", not "after".** The lift is a point in time that a slot may land exactly on —
  which is the ordinary case, since a lift is normally the next note's onset — where the trill is
  asking a different question (where does the note I decorate stop).
- ⚠️ **A beat with no slot at all on that staff is normal** and must fall through to the bar end
  rather than draw nothing: a whole note in this staff while the lift is at beat 3 leaves nothing to
  measure, and a `Ctrl+←/→` or a re-bar can produce it at any time.

⛔ Not `CoordinateMapper.beatToPixelX` — it interpolates a bar's width linearly and knows nothing
about where the spacing solve put the columns (`OttavaRenderer.spanX`'s note).

### 5.3 System breaks

A span crossing a break registers **one entry per drawn GLYPH** in `ElementRegistry`, each carrying
the same pedal id (the ottava's and trill's arrangement, one grain finer — it is what makes any piece
clickable, and a `find` over `getByType('pedal')` returns the id whichever box was hit).

⭐ **Per glyph, not per fragment, and that is §6.2's rule arriving early**: a fragment's two signs
have empty space between them and a single box spanning both would claim presses over the music. So
an unbroken pedal is TWO entries (`Ped.`, `✻`), a two-system one is three (`Ped.` · `(Ped.)` + `✻`),
and the day the bracket style arrives the line becomes ink and the entries merge back into one box
per fragment — in `PedalRenderer` and `interactions/elements/pedal.ts`, nowhere else.
⭐⭐ **A CONTINUATION RESTATES, in parentheses — `(Ped.)` — and the ottava already decided this.**
The first fragment shows `Ped.`, the last shows `✻`, and **every fragment in between opens with a
parenthesised `(Ped.)`**, exactly as an ottava opens a new system with `(8)`
(`rendering/ottavaStyle.ts`, inset `OTTAVA_CONTINUATION_INSET` = 2.0 sp, his eye 2026-08-13). Three
sources agree and none dissents:

- **Dorico** always shows text or a symbol at the start of subsequent systems (only the *hook-only*
  appearance omits it), there is no global option to switch it off, and the parenthesised form is a
  **named setting**: *Engraving Options ▸ Pedal Lines ▸ Design ▸ Continuation ▸ With parentheses*;
- **SMuFL** ships parentheses **drawn for this job** — `keyboardPedalParensLeft` **U+E676** /
  `ParensRight` **U+E677**, "left/right parenthesis for pedal marking". A glyph exists because the
  practice does;
- and **MusicXML** names the state directly: `resume` = "the start of a pedal line that does not
  include the downstroke", i.e. this fragment.

⚠️ **What we do NOT have is Gould on the pedal's continuation.** Her verified rule 6 for the
**ottava** — *the sign is restated at the start of each system as a reminder, usually parenthesised*
(`docs/ottava-plan.md` §1) — is about octave lines, and the only report of her saying the same for
pedals is second-hand (a Steinberg forum reading of *Behind Bars*: suggested, not required). ⛔ Do
not write "Gould says" against this rule until the book is read. What carries it is Dorico's shipped
default plus the house precedent, and both point the same way.

⚠️ Without it, a `Ped.✻` pedal broken over a break shows `Ped.` on one system and a bare `✻` on the
next, with **nothing at all** on any system between them — a reader turning the page finds a release
sign for a pedal they cannot see. That is worse for the text style than for the bracket style, not
better: there is no line to carry the meaning across.

⚠️ **One thing owed to his eye** (§12): whether those parens are the SMuFL pair (E676/E677) or the
*italic text* parens the ottava ended up preferring — that swap was his call, made by eye, on a pair
of glyphs sized for a numeral rather than for `Ped.`. Start with E676/E677, since they are drawn to
match this glyph, and let the screen decide.

### 5.4 The redraw key — ⭐ `'ignored'`, the OTTAVA's row, not the dynamics'

`MEASURE_RENDER_ROLE` is a `Record<keyof Measure, …>`, so `Measure.pedals` **cannot compile without an
answer here** — and the answer is the one row in that table that says "neither", verbatim the
ottava's reasoning (`rendering/measureRenderRoles.ts`):

- **NOT in the width key.** A pedal costs no horizontal room — `reference_render_width_key_vs_shape_key`,
  and the mistake `MeasureRedrawKey` calls the classic one.
- **NOT in the shape key either.** ⚠️ An earlier draft of this section said *"same row as dynamics"*;
  that is wrong, and the difference is what §5 already decided: the pedal is drawn by a **score-level
  pass outside every measure group** (`PedalRenderer`, like the hairpin's, slur's, trill's and
  ottava's ink), and that pass is rebuilt from scratch on every render. No measure's cached `<g>` can
  hold a stale `Ped.`, because none of them ever holds one at all. (A dynamic IS drawn inside the
  group, which is why its row differs.)

⚠️ **Both halves are conditional and this is where the condition is checked** — if any part of the
pedal is ever drawn inside a measure group, this becomes `'shape'`.

### 5.5 ⚠️⚠️ SPAN ANCHORS — the third question, and the one nothing checks

`measureRenderRoles`' own header names it: a per-measure key only ever sees one bar, so a thing that
SPANS bars must ALSO be listed in `VexFlowRenderer.spanAnchors`. A pedal spans bars. Without a block
there — beside the hairpin's and the ottava's, positional in the same way, walking the capacities via
`pedalSpan` rather than looking up note ids — there are **two silent failures, and neither throws**:

- the endpoint bar is TRANSLATED rather than re-engraved, so `PedalRenderer` reads `StaveNote`s still
  holding last render's coordinates and the pedal draws detached from the music it governs;
- under culling that bar's `<g>` is deleted outright, so the pedal **vanishes on scroll**.

⭐ It pins BOTH endpoint bars, and — unlike the ottava, whose ink stops at the last notehead — the
pedal genuinely needs the end bar: §5.2 reads its `noteEndX`.

### 5.6 ⚠️ `staffContent` — the array that rides the spread

`models/staffContent.ts` gains `staffPedals()` and a `pedals` field on `StaffContentView`, and then
**`staffMeasureView` must NAME it** in the object it returns. That file's own warning is the reason:
*"EVERY per-staff array must be named here. What is not named rides the spread"* — a measure-level
list the filters don't know about lands UNFILTERED on every staff's lane, silently, since nothing
imports differently and nothing throws. On a two-staff score that is one pedal drawn twice.

---

## 6. Selecting, editing, deleting

### 6.1 The 18th `SelectedElement`

`{ kind: 'pedal', id }`, one module `interactions/elements/pedal.ts`, one row in `ELEMENT_SPECS`
(17 entries → 18, and the count is compiler-enforced), one position in `ELEMENT_HIT_ORDER`
(15 → 16), plus the two switches `assertNeverElement` names: Delete (`shortcutWiring`) and the
Properties report (`selectionSnapshot`).

⚠️ **And the two things a selectable SPAN needs that the union does not mention**, both copied from
the ottava:

⭐ **The selection colour (2026-08-19):** the ELEMENT ink, not a voice's — a pedal has no voice
(one damper serves the staff, whose music may be in any of them), and the wedge/8va/pedal trio moved
off voice colours together. See `utils/selectionColors` for the rule and `docs/ottava-plan.md` for
the same note.

- **`pedalGroupMap`** — six sites, because a highlight recolours a drawn `<g>` and something has to
  remember which one: the field on `RenderPass`, the private map + the `pass` literal + the `clear()`
  + the `getPedalSVGGroup` accessor in `VexFlowRenderer`, and the one-line delegation on
  `MusicEngine`. `PedalRenderer` opens ONE group per pedal (outside the fragment loop, so a split
  pedal is one group), exactly as `renderOttavas` does — ⚠️ and `openGroup` prefixes with `vf-`
  itself, so the name passed is `'pedal'`, never `'vf-pedal'`.
- **`HighlightController.applyPedalSelectionHighlight()`** — what the `ELEMENT_SPECS` row's
  `highlight` calls. ⭐ PAINT, don't RECOLOUR (`docs/barline-selection.md`).

### 6.2 ⚠️ The hit-test is the TWO GLYPHS, not the band

The ottava hit-tests its whole drawn band because a dashed bracket is *mostly* empty and the reader
cannot see where the gaps are. A `Ped.✻` pedal is different: there is **no ink at all** between the
signs, and *a press may only reach INK* (`docs/barline-selection.md`). So: the two glyph
boxes, each with the family's `PAD` of 7 px — which §5.3 has already provided, since each glyph is
its own registry entry. The module is then the ottava's `find` with the proximity half dropped: pure
containment, because every box here is solid ink. ⭐ When the bracket style arrives, the line becomes
ink and the band test becomes right — a change in this module and `PedalRenderer`, nowhere else.

### 6.3 Editing

- `Delete` removes it.
- `Ctrl+←/→` shortens/lengthens, which **moves the ✻** — the lift is what `length` says.

  ⚠️ **This is BUILT here, not inherited.** An earlier draft called it "the hairpin's and ottava's
  key"; read against the code, **only the hairpin has it** — `resizeHairpinBySlot` (`hairpinOps`) with
  its `ScoreModel` / `MusicEngine` delegators and a `resizeSelectedHairpin` branch in
  `shortcutWiring`. The ottava is not resizable from the keyboard at all; `shortcutWiring` knows it
  only for Delete. So P3 owes a `resizePedalBySlot` and the same four-step wiring.

  ⭐ **And the step is a slot of the STAFF, not of a voice** — `resizeHairpinBySlot` steps by the
  duration of the note the wedge ends on *in its own voice*, and a pedal has no voice (§3.1). Same
  lane question §5.2 answers for the lift x, and it must be answered the same way in both places or
  the key will move the `✻` somewhere the render does not draw it.
- ⛔ No flip (`x`): a pedal is always below.
- A hand-moved `✻` is **future**, and lands in the **engraving-overrides compartment**
  (anchor-relative, keyed by the pedal's id) — ⛔ not a field. ⚠️ Its id is regenerated by a re-bar,
  so a nudge dies across one, exactly as a hairpin's or a dynamic's does.

---

## 7. Entering one — the palette we already have

⛔ **No keyboard shortcut** — his call, the Trill's and 8va's. Sibelius's pedal key is `P`, and ours
is taken: `p` is PLAY (`src/shortcuts/`).

One **row in `dev/linePalette.ts`** (whose doc comment already names the pedal as a future row),
running a `PaletteController.createPedal()` that already means two things:

- **with notes selected** → a pedal over them (start = first slot's beat, lift = end of the last);
- **with nothing selected** → ARM the stamp — the blue pointer — and a click places one running
  through the next slot. Press again to disarm.

⭐ Both doors go through ONE model function, `addPedalOverNotes` — `addOttavaOverNotes`' split
verbatim (*the caller says which notes; the ops say how much music that is*), which is also where
§3.3's truncation lives, so the two doors cannot drift apart on either question.

Costs: a member on the `selectedMarkingTool` union (VALUELESS — there is only one pedal, so it
carries nothing, like the trill and unlike the hairpin), `interactions/pedalStamp.ts`, and three
rows in tables that are exhaustive over that union:

- `MARKING_TOOL_USES_ARMED_LENGTH` → **`false`**. The pedal's length is the MUSIC's, not the
  note-entry duration.
- `scoreCursorClass` → **`cursor-place`**, the blue pointer. ⚠️ **No longer true after §7's
  2026-08-17 amendment** — a tool that draws a ghost does not also take the caret.
- `promoteStampToNoteEntry` → the valueless case beside `slur` / `hairpin` / `ottava` / `trill`:
  a span is not a property of a note, so a duration press disarms it and promotes nothing.

⛔ **NO GHOST** — an earlier draft asked for a `ToolGhost` member and a `GHOST_DRAWERS` row drawing a
grey `Ped.`; that contradicts every other line tool. The slur, both hairpins, the trill and the
ottava all preview nothing and say why in the same words: *the mark is drawn between/over music the
click has not picked yet, so a ghost at the pointer would preview a position the click is not going
to make*. It is truer of the pedal than of any of them — the `Ped.` does not even go where the
pointer is, it goes on the ladder rung below the staff. The blue pointer is the whole preview, and
two table rows are saved by not being wrong.

### ⭐⭐ AMENDED 2026-08-17 — the ghost IS built, and the first draft was right

> *"now the pedal, we should see the ghost ped for stamping."* — his call, after the trill's and the
> ottava's the same day. The paragraph above stays because being wrong in a specific way is what
> makes the correction usable: what it argues about is WHERE the finished mark goes, which is the
> renderer's answer AFTER the click. What a cursor has to answer is WHAT the click makes, and a blue
> caret does that no better under this tool than under any other.

`engine/rendering/PedalGhost.ts` — its own module, a `GHOST_DRAWERS` row, `{ kind: 'pedal' }` on
`ToolGhost`, and the sign drawn through the pass's own (now exported) `drawPedalSign`, so the preview
cannot become a different glyph from the engraved mark. The tool also leaves `scoreCursorClass`'s
blue-pointer list, since a caret on top of the glyph it stood in for is two indicators for one tool.

⛔ **Only `Ped.` — never the lift (`✻`) and never the span.** A pedalling has a LENGTH the click has
not picked, so drawing both signs would promise a release the click is not going to make. (The
ottava's bracket is left out for the same reason.)

### ⭐ The attachment guide (2026-08-17, his call)

A selected pedal draws the dashed line to where it is anchored — the sixth and last kind on the
kind-agnostic guide (`docs/dynamic-offset-plan.md`). Two edits: `drawPedal` registers it on the FIRST
fragment's `Ped.`, and the `pedal` row in `ELEMENT_SPECS` calls `applyAnchorGuideLine`.

⭐ **Its far end is a PLACE** — the staff's BOTTOM line at the start beat — because a pedal governs a
REGION: every voice on the staff, every note struck while the damper is down. ⛔ Not a notehead; that
rule belongs to the dynamic and the trill, whose marks are computed from a particular pitch.

⚠️ **It rides the `Ped.` and never the lift**, and it goes on the first fragment only: a `(Ped.)` on
a later system says the damper is still down, which is a reminder rather than a second attachment.
⚠️ Remember this family registers **one entry per GLYPH** rather than one per fragment (§6.2), so the
`✻` and every resumed sign carry no guide at all — the drawer reads every entry under the id, so
that is exactly right. Measured in `e2e/anchorGuide.e2e.ts`.

### 🚨 THE POSITION RULE THIS FEATURE PRODUCED — one place for all sign ghosts

The first build parked `Ped.` BELOW the pointer, reasoning that a pedal is engraved below the staff.
That put the glyph under the arrow:

> *"the position of the ghost ped is wrong, the pointer covers [it]; the position should be normal
> ghost position like tr and 8va and 8vb — this is a sign for the user, of course a ghost [does] not
> take into account the position of the real sign in the score."* …and then, on which position that
> is: *"maybe you should take the position of the ghost accidental as reference."*

⭐⭐ So a ghost's offset may **never** be derived from where its mark is engraved. Two bugs in one day
came from doing exactly that: this one (covered by the pointer) and the ottava's (`8va` above,
`8vb` below, so the eye had to re-find it on every switch). The accidental ghost's position — just
LEFT of the pointer, centred on its line — is the reference, and it now lives in
`engine/rendering/ghostCursor.ts` as ONE definition that the accidental, the `tr`, the octave
numerals and `Ped.` all draw through. ⛔ The dot ghost's mirror (parking RIGHT) is not an exception:
that pair says which side of a NOTEHEAD the gesture works on, which is about the gesture, not about
a rung above or below the staff.

---

## 8. Re-bar and the clipboard — SIX rows in tables that exist

The ottava's bill, verbatim (`docs/ottava-plan.md` §4). ⚠️ An earlier draft counted four; reading
`rebarOps` there are six, and the two it missed are the two that fail quietly:

1. `{ kind: 'pedal'; absBeat; pedal }` in `rebarOps`' beat-anchor union, + a **capture** branch;
2. a **restore** branch, using the clef's rule (§3.3);
3. `pedals?: ClipPedal[]` on `Clip` (`utils/clip.ts`) + the paste re-anchor beside the hairpin's,
   and only pedals lying FULLY inside the window travel (the ottava's rule);
4. ⚠️ **`survivingAnchors`' overwrite filter** — the list `a.kind !== 'dynamic' && a.kind !== 'hairpin'
   && a.kind !== 'ottava'` that decides what a paste REPLACES rather than stacks on. The pedal joins
   it on the ottava's terms, **with the voice test dropped**: a destination pedal starting inside the
   paste window on a destination STAFF is replaced by the clip's, whichever voices the paste landed
   in. Left out, a paste leaves a stale `Ped.` governing the notes it just overwrote.
5. ⚠️⚠️ **`clearMeasureForRebar` must `delete measure.pedals`**, and that line carries the file's own
   warning: an array that is NOT deleted there does not vanish — it SURVIVES the wipe holding its old
   beat while the bar's music is re-tiled around it, i.e. a pedal pointing at music that moved, with
   no error and with "it's still there" passing any test that counts them. Deleting it makes
   capture/restore the only road back, so a missed capture is a visible loss instead of a silent lie.
6. ⚠️ and the note the hairpin already carries: **the id is regenerated by a re-bar**.

⭐ Six rows, no module. That is the positional shape paying for itself.

---

## 9. Playback — the damper, from day one

⭐ **The pedal's seam is DURATION, not pitch** (contrast the ottava's `soundingShiftAt`). WebAudioFont
has no CC64, so "damper up" means exactly one thing: **the note's release moves to the lift**.

```
for every scheduled event whose onset lies in [from, to) on a staff the window covers:
    durationBeats = max(durationBeats, to - startBeats)
```

Five things this must get right, and each is a trap:

- ⚠️⚠️ **It is a POST-PASS over the emitted events, not a change to the slot's sounding length.**
  The repeat families (trill, tremolo, fan) *generate their subdivisions from* that length — extend
  it upstream and a pedalled trill grows more alternations. Extend the emitted events instead and
  each alternation simply rings on, which is what a real damper does.
- ⭐ **The windows are built ONCE per score, in ABSOLUTE beats** — `pedalWindows(score)` in
  `utils/pedalScope.ts` beside `pedalStavesAt`, returning `{ from, to, staves }[]`. That is
  `soundingShiftBySlot`'s arrangement and its reason: the collector walks bars accumulating a clock,
  and a span whose extent is a count of music has to be turned into that clock's axis by walking the
  capacities — once, not per event. ⛔ The post-pass must not re-derive it, and ⛔ must not read
  `pedal.staffId`: `pedalStavesAt` is what `staves` is filled from (§3.2).
- ⚠️ **The event needs its staff, and there is ONE place to put it.** `ScheduledNote` gains
  `staffId?` (an internal audio type; the public API is untouched) — but there are **six push sites**
  in the collector (the plain note, the tremolo fill, the trill attacks, plus `collectFanAttacks` and
  two inside `collectPairAttacks`), and threading a staff through two helper signatures to reach them
  is five chances to miss one. ⭐ Instead **stamp the tail**: the per-slot loop knows `chord.staffId`,
  so record `events.length` before the slot's branches and stamp every event appended after it. One
  site, no signature changes, and a new emit path inherits it by construction.
- **The pedal beats the articulation.** A staccato note under the pedal rings: the damper is up.
  So the clamp runs *after* `artic.durationFactor`, and `max` is the right operator — a pedal never
  shortens anything.
- ⚠️ **ONSET-membership, not overlap** — and it is only safe because a pedal's ends snap to slot
  boundaries. A note struck *before* the press is not caught, which is right (its key is up by then,
  since our durations end where the next onset begins) and is what the notation means: legato
  "syncopated" pedalling is written with the `Ped.` at the beat whose chord it is to catch. ⚠️ The
  one place the two readings differ is a tie-extended or legato-overlapped tail that reaches past the
  press: it is NOT caught. Stated rather than fixed — catching it would need a key-down model we do
  not have, and the audible difference is one note's release.

⛔ Not in this plan: half-pedal / levels, `sim.`, CC64 export.

---

## 10. Tests

**Unit** (`*.test.ts`, jsdom — ⛔ never a drawn coordinate):

- `pedalOps.test.ts` — create/resize/delete, `beat + length` arithmetic, and §3.3's split: the model
  UPSERTS on a shared `(beat, staff)` and leaves a merely-overlapping pair alone, while
  `addPedalOverNotes` truncates.
- `pedalScope.test.ts` — one staff today; **both** seams return exactly what they are given, and
  `pedalWindows` puts a two-bar pedal on the absolute clock the collector uses.
- `rebarOps.anchors.test.ts` (+ `clipboard.test.ts`) — a pedal survives a meter change and a paste,
  two pedals landing on one beat leave one, and ⭐ a paste over a bar holding a pedal REPLACES it
  (§8 row 4).
- `staffContent.test.ts` — a pedal on staff 1 is absent from staff 0's `staffMeasureView` (§5.6; the
  failure it guards is one pedal drawn on every staff).
- `measureRenderRoles.test.ts` — perturbing `pedals` moves NEITHER key (§5.4). The table's test
  checks the claim, not just its presence.
- `playbackSchedule.pedal.test.ts` — the clamp, staccato-under-pedal, and ⭐ the break-test that
  matters: **a trill under a pedal has the same number of attacks as without it**.
- `outsideStaffBand` — the pedal's claim covers its span, and clears a dynamic under it.

**Browser** (`e2e/*.e2e.ts`, `npm run test:e2e`) — every geometric claim:

- `Ped.` and `✻` share one y (Gould's pair rule);
- the pedal sits **below** a `p` and below a hairpin in the same bars;
- the `✻` of a bar-length pedal falls *inside* the barline — ⭐ its RIGHT edge does, which is the
  assertion §5.1a's right-alignment exists for;
- a pedal shorter than `PEDAL_MIN_SPAN` still draws two separated glyphs (§5.1a);
- a broken pedal draws `Ped.` on one system, `(Ped.)` on each system between, and `✻` on the last;
- ⚠️ and the one that catches §5.5: **scroll a broken pedal's first system out of the window and the
  pedal is still drawn** — the span-anchor test, and the only cheap way to see that failure.

---

## 11. Phases

- **P0 — model + ops + the six rows. ✅ BUILT 2026-08-14.** `Pedal`, `Measure.pedals`, `pedalOps` (incl.
  `addPedalOverNotes`), `pedalScope`'s two seams, `staffContent`'s filter (§5.6), the re-bar/clip
  rows (§8), unit tests. Nothing draws yet. ⚠️ `MEASURE_RENDER_ROLE` stops compiling the moment
  `Measure.pedals` exists, so §5.4's row lands here whether or not anything draws.
- **P1 — it sounds. ✅ BUILT 2026-08-14.** `pedalWindows` + `pedalWindowCovers`, the one-site staff
  stamp (`staffMarks` → `stampStaffIds`), `holdUnderPedals`, and `playbackSchedule.pedal.test.ts`
  incl. both break-tests. Testable through JSON alone — and that path has its own test, since
  nothing enters a pedal by hand until P4.
- **P2 — it draws. ✅ BUILT 2026-08-14.** `pedalStyle` + `PedalRenderer` (+ its ladder-claim spec) +
  the rung (the `renderPedals` call after `renderOttavas`) + the continuation `(Ped.)` + the
  per-GLYPH `ElementRegistry` entries + `pedalGroupMap` + **`spanAnchors` (§5.5)** + `MusicEngine`'s
  low-level doors (`addPedal`/`removePedal`/`setPedalLength`/`getPedals`, the ottava block's
  arrangement — ⛔ still no `createPedal`, which is P4's); `e2e/pedal.e2e.ts`, 10 geometry tests.
  ⚠️ **Every §12 number in it is a FIRST CUT awaiting his eye**, and one more was found by building:
  `PEDAL_BARLINE_AIR` (§12.4 turned out to be load-bearing rather than cosmetic — right-aligning the
  `✻` on `noteEndX` put its ink exactly ON the barline, measured 250 against 250).
- **P3 — it is editable. ✅ BUILT 2026-08-14.** The 18th `SelectedElement` kind,
  `interactions/elements/pedal.ts` + spec (⭐ its star test is the ottava's INVERTED — a press
  between the signs must MISS), the `ELEMENT_SPECS` / `ELEMENT_HIT_ORDER` rows (17→18, 15→16),
  `applyPedalSelectionHighlight` (text only — the pedal draws no `path`), Delete + the Properties
  report, and `resizePedalBySlot` + its four-step wiring (§6.3 — built, not inherited).
  ⭐ Found by building: a pedal GROWS THROUGH A REST, because `restFill` means no bar is empty — and
  that is correct pianism rather than a leak (the notes struck before it keep ringing).
- **P4 — it is enterable. ✅ BUILT 2026-08-14.** The `Ped.` row in `dev/linePalette.ts`,
  `PaletteController.createPedal()`, `MusicEngine.createPedal()` (the one door both ways in, which
  is where the §3.3 truncation reaches the user), `interactions/pedalStamp.ts` + its dispatch line in
  `MouseController`, and the four tool-union rows (the valueless member,
  `MARKING_TOOL_USES_ARMED_LENGTH` `false`, `scoreCursorClass` → `cursor-place`, `toolGhost` → null,
  `promoteStampToNoteEntry`). ⛔ No ghost, ⛔ no shortcut. ⚠️ **Two of those five rows changed on
  2026-08-17** (§7's amendment): `toolGhost` returns a `{ kind: 'pedal' }` ghost and the tool is no
  longer in `scoreCursorClass`. No shortcut still stands. Specs: `pedalStamp.test.ts`,
  `PaletteController.pedal.test.ts`, `MusicEngine.createPedal.test.ts`.
  ⭐ Stamping along a run leaves a CHAIN of abutting pedals rather than a stack — the re-take,
  arriving as a consequence of the truncation rule rather than as a feature.

Each phase ends green and useful on its own; ⛔ none of them is "and also start the bracket style".

✅ **ALL FIVE PHASES BUILT, 2026-08-14** — `build:check` green, 3480 unit tests, 150 browser tests
(10 of them the pedal's), and confirmed by hand in the running editor. What is left is his eye on
§12's numbers, and the deferrals below.

---

## 12. Owed to his eye, and deliberately not in this plan

**Numbers to settle by eye** (start where the family already sits, then adjust):

1. `PEDAL_LINE.minFromStaff` — the floor below the staff. Must be *further out than the dynamics
   line's* 2.1 sp, since the pedal is outside everything. **Built at 4.0 sp.**
2. `PEDAL_LINE.padding` — clearance over whatever it must clear. **Built at 0.6**, the dynamics
   line's own.
3. The glyph size, in staff spaces (`reference_engraving_text_sizes`' 2.02–2.42 sp band).
   **Built at 26 px**, the ottava's and trill's — which at `STAFF_SPACE_PX` 10 is 2.6 sp, i.e. a
   touch ABOVE the band, and `Ped.` is a wider mark than either, so this is the first one to try
   moving DOWN.
4. `PEDAL_BARLINE_AIR` — how far *inside* the barline the `✻` sits when the lift is the bar end.
   **Now 0.4 sp.** ⚠️ Building P2 promoted this from cosmetic to load-bearing: right-aligning the
   release on `noteEndX` puts its ink exactly ON the line (measured, 250 against 250), so the air is
   what makes §1 rule 3 true as *drawn*. It is applied only on the barline fallback path, never to a
   mid-bar release.
5. The continuation `(Ped.)` (§5.3): SMuFL's pedal parens (U+E676/E677) or the *italic text* parens
   the ottava ended on — and its inset from the system's left edge (the ottava's is 2.0 sp).
6. `PEDAL_MIN_SPAN` (§5.1a) — the shortest pedal that still reads as two signs rather than one
   smudge. **Now 3.4 sp**, with `PEDAL_SIGN_GAP` 0.5 sp of air after the `Ped.`'s own ink.
   `OTTAVA_MIN_LINE` is the precedent for the mechanism, not for the number: this one is two wide
   glyphs side by side, not a numeral and a line.

**Deferred, and each lands additively:**

- the bracket / mixed styles, the end hook, and the retake notch (§3.3) — a renderer change;
- ⭐ **levelling consecutive pedal pairs with each other** (§4, Gould p. 333's *"align them when
  there is room"*) — a second pass in `layout/dynamicsChain.ts`'s shape, and the one deferral here
  that is a visible engraving compromise rather than a missing feature;
- sostenuto and una corda — one optional field (§3.1) and two more ladder rungs, in the fixed order
  sustain → sostenuto → una corda (§1 rule 5);
- half-pedal and pedal levels (Dorico's 0–1) — a field on the span, and a different glyph;
- the piano's real scope — `pedalStavesAt` **and `pedalDrawStaff`** (§3.2), the two functions that
  have to change, and the second of them is what makes §1 rule 1's *"below the BOTTOM staff"* true;
- **the ladder reaching slurs and articulations** (§1 rule 1) — not a pedal job: it is a claim the
  slur pass and the ink model would have to file, and every outside-staff family would gain from it;
- a hand-nudged `✻` (§6.3). ⭐ The continuation `(Ped.)` is **no longer deferred** — it is in P2
  (§5.3), because without it a broken pedal is unreadable.

---

## Sources

- Elaine Gould, *Behind Bars*, p. 333 (pedal alignment), pp. 336–337 (sostenuto) — second-hand via
  [NOTATIO, *E. Gould and Piano Pedaling*](https://notat.io/viewtopic.php?t=75) and
  [*Piano pedal retakes*](https://notat.io/viewtopic.php?t=755).
- [Dorico — Pedal lines](https://www.steinberg.help/r/dorico-pro/5.1/en/dorico/topics/notation_reference/notation_reference_pedal_lines/notation_reference_pedal_lines_piano_c.html),
  [Positions of pedal lines](https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_pedal_lines_piano_positions_c.html),
  [retakes and level changes](https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_pedal_lines_piano_level_changes_retakes_types_c.html).
- [MuseScore handbook — Pedal](https://handbook.musescore.org/idiomatic-notation/keyboard/pedal)
  (the end-anchor types, and the `‑^‑` join).
- [MusicXML `<pedal>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/pedal) +
  [`pedal-type`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/pedal-type) +
  [issue #102, *Add more comprehensive piano pedal indications*](https://github.com/w3c/musicxml/issues/102)
  (which cites Gould's table 2, p. 333 as the catalogue of pedal signs).
- [SMuFL — Keyboard techniques](https://w3c.github.io/smufl/latest/tables/keyboard-techniques.html):
  `keyboardPedalParensLeft` U+E676 / `ParensRight` U+E677, "left/right parenthesis for pedal marking".
- Dorico's parenthesised continuation as a shipped setting —
  [*How to get (Ped.) at start of new system*](https://forums.steinberg.net/t/how-to-get-ped-at-start-of-new-system-when-there-are-retakes/1038914)
  and [*Omit cautionary Ped*](https://forums.steinberg.net/t/omit-cautionary-ped/865533).
- [LilyPond `PianoPedalBracket`](https://lilypond.org/doc/v2.25/Documentation/internals/pianopedalbracket)
  (`edge-height '(1.0 . 1.0)` — the hook is one staff space).
- `vexflow@5.0.0` `build/esm/src/pedalmarking.js` + `glyphs.js` (read at source, 2026-08-14).

---

## ✅⭐⭐ P5 — THE TWO SQUARES, THE INK, AND THE PROPERTIES ROWS (2026-08-18, recorded late)

Built the day after the five phases above and left out of this file until 2026-08-21 — recorded here
so the plan and the code agree. `interactions/elements/pedalHandles.ts` (geometry, the arming press,
Tab, the drag target), `pedalOps.movePedalStartBySlot` / `setPedalStartAtSlot` / `setPedalEndAtSlot`
/ `applyPedalDrag`, `HighlightController.applyPedalHandles`, `PedalOffsetOverride` (`startX`, `endX`
and ONE shared `y` — Gould p. 333: a pedal and its own release share a baseline), and
`PedalGeometryController` + the three Properties rows.

- ⭐⭐ **The grain is the GLYPH**, so the two squares come from two different MARKS — `ElementInfo.pedalSign`,
  ⛔ never "the first entry and the last one" (a `(Ped.)` resumption is registered too).
- 🚨 `Ctrl+←/→` stopped moving the LIFT that day: an audible model write had been sitting on the
  chord this editor reserves for nudging ink. It became `Ctrl+Shift+←/→`, gated by the armed square.
- ⭐⭐ **A third end rule shows up in the drag as an extra address** — `setPedalEndAtSlot(…, after)`:
  a lift is a moment in TIME, so the last note of a passage can be cut off as it is struck or left
  ringing.

## ✅⭐⭐ P6 — THE INTERPOLATING WALK on both squares (2026-08-21, BUILT)

His ask: *"lets do the pedal endpoint keyboard walk now"*. The pedal is the sixth family to get the
gesture, and it arrives by the rule the wedge's second square set: **a handle that has BOTH a
re-anchor and an offset owes the walk that joins them.** `interactions/pedalWalk.ts` +
`interactions/pedalLane.ts`, both PORTS — the arithmetic is `markWalk`'s and the cross-system rule is
`markBreakWrap`'s, ⛔ copied from neither.

### ⭐⭐ The END is a MOMENT, so it needed model ops the family did not have

Every sibling's end is a NOTE (the bracket's hook closes around one, the trill's line ends at a
duration). A pedal's is a point in time, which is why `pedalOps` gained a **`PedalLiftTarget`** —
`{measure, beat}` whose beat MAY equal the bar's capacity — and the three ops that speak it:
`nextPedalLift` (the pure read `resizePedalBySlot` now steps with), `pedalLiftSlot` (where the `✻`
stands today) and `setPedalLiftAt`. ⭐ Two facts fall out of that and nothing else: growing reaches
THROUGH a slot rather than onto it, and **a lift can stand on the BARLINE, where no onset is** —
priced by `pedalLane.pedalLiftX`, which mirrors `PedalRenderer.spanX` (the first column at or after
the lift, else `noteEndX` less {@link PEDAL_BARLINE_AIR}). ⚠️ Those two must not drift: the walk
prices its gaps where the INK lands.

### 🚨 THE PRESS PUSHES THE LIFT — the refusal was killing the gesture

`setPedalStartAtSlot` used to refuse when the press reached the lift. That is the octave bracket's
scar arriving one lane over: the walk stops at the first stop the model declines, so a press parked
against its own lift turned every further arrow into pure ink and the square walked off the page.
Now the pedal keeps the ONE slot it is standing on and walks on. ⚠️ Audible — a pushed lift shortens
the ring — and that is the honest reading of *"put the foot down here"* when here is past where it
came up.

### 🚨🚨 THE TWO SIGNS MAY NOT PRINT OVER EACH OTHER — and the walk must survive the wall

His rule, with the score attached: *"the right endpoint never should go before the left endpoint"*
(an `endX` of **−67 staff-spaces**, the `✻` far left of its own `Ped.`). What produced it is worth
keeping: the pedal covered a bar of whole-bar RESTS, so its lane held ONE onset, the walk had no stop
to hand the foot to, and free ink with nothing in front of it runs as far as the hand presses.

- The limit is `MusicEngine.pedalSignsStayInOrder` — the two glyphs' **INK**, ⛔ not their anchors: a
  middle cut measured against the other sign's NOTE and he rejected the picture at once (*"the `✻`
  overlaps `Ped.`, before was better"*). It refuses the step that makes a crossing WORSE and always
  allows the one that mends it, so a score already saved crossed is walkable back.
- 🚨 It also **broke the walk** until the other half landed (*"i'm not able to walk here"*, forty
  refusals in a row): the ink has to travel a whole gap before the foot can be handed along, so a
  rule that stops the travel stops the gesture. `markWalk.crossWithoutArrival` is the answer, shared
  with every family — **a press whose ink is refused steps the ANCHOR instead**, and the offset goes
  HOME rather than being re-based by the gap (his *"the pedal is jumping inconsistent"*, with a
  `Ped.` glued to its `✻` and the offset at −57).
- ⛔ **No BAND rule and no "inside its own bar"** — the ink is FREE (his 2026-08-21 rule for the
  bracket); the only other stop is the PAGE's edge, judged per MOVING SIGN.

### ✅ The two signs may not print over each other — a FLOOR, ⛔ never a refused write

His observation, 2026-08-21, and it is the whole design: *"the hook of the ottava never crosses the 8,
so there must be a prevention mechanism that should be applied to the pedal"*.

`OttavaRenderer` puts the end nudge **inside** its floor —
`Math.max(piece.x1 + nudge.endX, lineStart + OTTAVA_MIN_LINE)` — so the hook cannot cross the numeral
however far it is pushed, and no write is ever refused. `PedalRenderer` added the same nudge **after**
its `Math.max`, where it escapes every floor: that is how a `✻` reached an `endX` of −67 staff-spaces
and printed to the LEFT of its own `Ped.` Moved inside (`PedalRenderer.upX`), and because the first
floor is measured from `signX`, a press nudged rightward carries the `✻` ahead of it — the pair can
close up and can never overlap.

🚨🚨 **A write-time rule was tried first and it broke the GESTURE.** `pedalSignsStayInOrder` refused
the crossing step; a refused ink step then makes every press hand the anchor a WHOLE STOP along
(`markWalk.crossWithoutArrival`), so the walk went from 1 space per press to **24.28** in one
keystroke where the bar below held sixteenths — his *"look how the pedal walk accelerates a lot in
certain spots"*. ⭐ Drawn floors refuse nothing, so the pace never changes; the rule was removed and
its spec with it. *"The behaviour of the pedal should be similar to the behaviour of the ottava."*

### ✅ …and an offset the drawing would ignore is not written

His report the same day: *"the `✻` goes back a lot and then we have to re-establish this till I can go
in the other direction"* — `endX` at **−39 staff-spaces** after one held keypress, forty presses owed
to walk it back. Once the floor binds, a further leftward press moves nothing and stores something.

`MusicEngine.pedalLiftInkWouldMove` asks the floor BEFORE the write: a leftward press on the release
is refused only when the drawing has no air left to give. ⭐ It refuses a step that makes it worse,
never one that mends it, so a file already carrying a bad `endX` walks out on the first arrow. ⛔ The
START needs no such rule — its floor is measured FROM the `Ped.`, so that ink always shows.

⚠️ **The OTTAVA has the same fault, hidden**: `OTTAVA_MIN_LINE` floors its hook the same way, so
pushing an 8va's end past it stores an offset nobody can see. Not fixed there.

### ✅ The dashed TETHER — a selection hint, not engraving

His ask: *"draw dots line when pedal is selected between Ped. and ✻ so we know which ✻ belongs to
which"*, then the look: *"discontinuing lines similar to ottava"*, then the air: *"more spaced"*.
`interactions/elements/pedalTether.ts` — the octave bracket's dash LENGTH with its own wider
`TETHER_DASH_GAP` (1.0 sp), drawn on the highlight layer while the pedal is selected and gone with it.

- ⭐⭐ One segment per ROW, between NEIGHBOURING signs — ⛔ not "the first and the last": a resumed
  `(Ped.)` and its release are as much a pair as the original press and its own.
- ⭐⭐ **A row that carries on to the next system runs its dashes to the line's edge** (his
  screenshot). 🚨 Finding that row exposed a trap worth keeping: `PedalRenderer.registerGlyph` stamps
  EVERY glyph with the FIRST fragment's measure, so a resumption on the third system still says
  *"measure 3"*. The row is therefore found from the sign's own `y` — the last staff above it — and
  measured with the shared `markBreakWrap.systemInkAt`.
- ⛔ It stops being needed the day a bracket-style pedal draws a real line (his own note).

## ✅⭐⭐ P8 — THE SQUARE DRAG WALKS TOO (2026-08-21, BUILT)

His ask: *"i think we should do the pedal drag walking"*. `pedalWalk.dragPedalEndpoint` — the same
ports over `markWalk` the arrows use, so a drag and N presses covering one distance leave ONE state
rather than two that merely look alike. The writes became injectable to do it (`PedalWrite`, with
`previewPedalStartAtSlot` / `previewPedalLiftAt` / `previewPedalEndpointOffset` / `…Rebase`, and
`commitPedalDrag` taking the gesture once on the drop). The two devices differ in three things only:
no undo entry per frame; the LATCH is on (both signs are aimed at a column's left edge) and the frame
REPORTS what it dropped so the caller repays it; and the HAND decides where the line ends, a wrap
ending the gesture with the square still armed.

- ⭐⭐ **The `y` comes along**, on both signs at once (one shared baseline), ⛔ with no screen→outward
  conversion: a pedal has one side.
- ⭐⭐ **The whole y-TRANSLATION of the snap is GONE** (`pedalDragTargetAt`, deleted with its spec
  chapter, and `applyPedalDrag` / `setPedalEndAtSlot` / `PedalDragWrite` with it — the model door that
  existed only for that frame). A walk reads no `y` to decide where it is: the ink travels along its
  own line and the SYSTEM is decided by the wrap. ⭐ The pedal's third end rule survives in
  `PedalLiftTarget`, reached one step at a time by `nextPedalLift`.

### ✅⭐⭐ …and the SHAPE walks on the keyboard (2026-08-21)

His ask: *"lets do the pedal shape walking with keyboards"*. `pedalWalk.walkPedalBody` +
`pedalOps.setPedalAtSlot` + `MusicEngine.movePedalToSlot` / `rebasePedalOffset` — `walkOttavaBody`'s
port, wired into `shortcutWiring.nudgeSelectedPedal` so the arrows with a pedal selected and NO square
armed nudge the pair's ink and hand the WHOLE pedal along when the ink reaches the press's next onset.

- ⭐ **Its stops are the PRESS's, and the LIFT is not held**: the span is an amount of music and
  travels with it. That is the whole difference between MOVING a mark and RESHAPING it — the same ten
  presses through the START square hold the lift and shorten the pedal, which the spec asserts side by
  side as a break-test.
- ⚠️ **AUDIBLE at the crossing and only there**: it changes which notes ring.
- 🚨 It wraps across a system break by the same rule as the squares, measured from the press's system.
- ⛔ The body port has no LIFT door at all (`lift: () => false`) — a stop of the lift's own would
  reshape the pedal, which is the squares' job.

### ✅⭐⭐ …and the SHAPE DRAGS, jumping systems (2026-08-21)

His ask: *"lets do the pedal shape drag walking, taking into account the y so we jump system"*.
`pedalWalk.dragPedalBody` + `pedalLane.pedalSystemSlotFor` + `MusicEngine.previewPedalSlot` /
`previewPedalOffset` / `previewPedalOffsetRebase` / `commitPedalOffsetDrag`, armed from a press on
either SIGN (`elements/pedal` → `armPedalOffsetDrag`, the bracket's seam). `ottavaWalk.dragOttavaBody`
ported.

- ⭐⭐ **TWO KINDS OF VERTICAL**: inside its own staff's room the `y` is plain INK (bounded by the page
  and the band); past halfway to the neighbouring staff it is a JUMP (`markSystemJump`), ⛔ decided at
  the halfway line and never at the pentagram (his rule, 2026-08-19). The lift comes back OUT before
  the measurement, or the pedal's "home" follows it down for ever and the switch never arrives.
- ⭐ **A jump ENDS THE FRAME, ⛔ not the gesture** — the pedal has landed where the hand is, so the hand
  carries on down there. (A SQUARE's cross-system wrap is the one that ends the drag.)
- ⛔ **The side cannot flip, and here it cannot even be asked**: a pedal is always drawn below its
  staff, where the bracket derives its side from `shift` and the wedge from `placement`.
- ⛔ No latch: a whole pedal is placed by eye, not aimed at one column's edge.

⏭️ **OPEN — the drag's cost, measured and parked**: his *"sometimes the movement of the editing
freeze… is it a bug or a performance issue?"* was answered with the census, and it is COST, not a
stuck gesture: one full render per mouse frame, ~9.6 ms average and 31 ms worst, with **0% of measures
redrawn** and nearly 8 ms of it spent repainting everything that is not a measure. The numbers, what
they rule out, and the three next steps are in `docs/render-performance-plan.md` §12.6 — ⛔ nothing
about it is fixed yet.

### 🚨🚨 Two rules the drag broke on the day, both his reports

- **The BAND was asking the wrong question, TWICE** — *"the band rule have a problem… look how the
  pedal is limit before the pedal lane, rethink the band limit in general"*, and then, minutes after
  the halving went, *"now the pedal limit is too extreme"*. ⭐ The answer is one rule with two gaps:
  the space INSIDE a system is that system's own furniture, so a mark may use ALL of it and stops at
  the partner staff's EDGE; the space BETWEEN systems is shared, so it is halved as it always was. A
  pedal's lane in a grand staff lies between the two staves — past halfway to the one below, which is
  why the first question refused the mark its engraved home, and short of the next system, which is
  why the second let it sail across the partner. `MusicEngine.systemBandsAt` +
  `neighbourBandOf(…, roommates)` + `layout/systemBand`'s rewritten header — the rule for every
  family, not the pedal's own.
- **One axis's refusal was vetoing the other** — *"get stuck somehow"*, with a log of dozens of
  consecutive latches moving nothing. A mouse gesture always carries both axes, so a vertical at its
  limit took the horizontal down with it, the caller (rightly) held its cursor anchor back, and every
  further frame presented a bigger delta at the same wall. `pedalEndpointStepAllowed` now answers per
  AXIS. ⚠️ The bracket's `ottavaEndpointOffsetAllowed` still answers for both at once — same fault,
  not yet fixed there.
