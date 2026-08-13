# OTTAVA — 8va / 8vb, the numeral and its bracket

Research, 2026-08-13. **Nothing built.** This file is the reading, the model proposal and the open
decisions; it is not a plan he has agreed to.

Two things came out of the research that are bigger than the feature, and **he has decided both**:

- ⭐⭐ **WRITTEN pitch.** The field is split on it — Dorico, LilyPond and MusicXML store the sounding
  pitch under an octave line; Sibelius and MuseScore store the written one. **His call, 2026-08-13:
  written**, matching the answer `docs/octave-clefs-plan.md` already gave. §2.
- ⭐⭐ **The LADDER GOES FIRST.** `docs/above-staff-ladder.md` §4 named the 8va bracket as one of the
  two families that would force the priority question, and it does — and it drags `TempoLayout`'s
  fixed rung in with it. **His call, 2026-08-13: build the ladder phase before the ottava, and it
  fixes tempo on the way.** §5, and P0 in §8 — where the codebase pass below split it into **P0a**
  (the machinery, no visible change) and **P0b** (tempo moves, and his eye is owed).

## 0. Checked against the code, 2026-08-13

The research above was written from the sources; this pass read the repo. ⚠️ Line numbers are repo
facts and rot — they are the state on 2026-08-13, kept because each one is a claim this plan rests on.

**Confirmed exactly as written:** `TempoLayout.ts:245` is `stave.getYForTopText(1)` · the five
`spellingToMidi` calls in `engine/audio/playbackSchedule.ts` at **324 / 485 / 541 / 726 / 742**, and a
sweep of the rest of `src/` finds **no other site where a pitch becomes sound** (there is no
note-entry preview audio), so §6's seam really is the whole of it · `engine/layout/inkBand.ts` holds
`Clearance` / `clearanceBaseline` with `DYNAMICS_LINE` and `TRILL_LINE` as its two rows · a new
`SelectedElement` kind is the **17th** · `dev/linePalette.ts`'s header already lists *"the octave
line"* as a future row · `planSlurSegments(pass, fromLine, toLine, firstX, lastX, scale)` is reusable
as claimed.

**⭐⭐ §5's ordering inversion is REAL, and here is the proof**: `drawTempoMarks` is called from
`VexFlowRenderer.ts:2065`, inside the measure loop; `planDynamicsLines` runs at `:3666` and
`renderTrills` at `:3686`. The outermost family is placed first, before either inner family exists.

**Four things the research got wrong or left short**, each now folded into the section it belongs to:
§5's "a row of ink" (it is an accumulator, not `measureColumns`' ink — that array is the WIDTH's) ·
§5's silence about the measure SHAPE KEY, which is P0's real decision · §5's list of producers, which
omits the trill · §4/P1's "no capture/restore code", which is false as stated and true once narrowed.

---

## 1. The engraving rules

⚠️ **What I have and what I do not.** *Behind Bars* pp. 28–34 is ~28 numbered points on octave signs;
I have its **contents listing** (what each point covers) and **four of the rules quoted at second
hand**. The rest is marked as owed to the book — ⛔ do not treat an unmarked-source rule below as
Gould's.

### Verified, with a source

1. ⭐ **Gould recommends the BARE NUMERAL** — `8` and `15`, no suffix. Her examples for ottava bassa
   use only `8`, `8va`, `8va bassa`, `8ba`. **`8vb` is not among them**, though it is universally
   understood. Her argument: *the position of the line relative to the staff, and the direction of
   the closing hook, already say which way it goes* — the suffix is redundant.
   ⭐⭐ **SMuFL agrees, and the correspondence is exact**: `ottava` (8), `ottavaAlta` (8va),
   `ottavaBassa` (8va bassa), `ottavaBassaBa` (8ba) are U+E510–E513 — Gould's four, in her order —
   and `8vb` was added later at **U+E51C**, out of the block, as `ottavaBassaVb`.
2. ⭐⭐ **The line ends AT THE LAST NOTE, not at the end of its duration.** Gould: continuing an
   octave sign for the value of a long note is found in *some editions* and is **incorrect** — with
   one exception, **a trill**, where she does want the continuation. Dorico has no option for it;
   Daniel Spreadbury: *"No, there's no option for this."*
   ⚠️ **This is the opposite of our trill's and hairpin's x rule** ("read to the slot's END",
   `docs/trill-plan.md` §4). An ottava that reused it would be wrong by the book.
3. ⭐ **Never a dangling hook.** Every hook belongs to a squared-off bracket; a hook with no
   horizontal line above it does not occur in Gould's examples.
4. **Direction decides the side.** Up → above the staff; down → below. (Dorico states it as a rule,
   and it follows from rule 1: the side is half of what tells the reader the direction.)
5. **Octave lines are placed OUTSIDE all other notations** — with one exception: they may sit
   *inside* a slur or a tuplet bracket **when the slur or bracket is longer than the octave line**.
6. ⭐ **They continue across system and page breaks, and the numeral is shown again at the start of
   each system as a reminder.** Dorico's own words: *"Cautionary numerals at breaks are usually
   parenthesized and the suffix is optional."*
   ⭐⭐ **So `(8)` is the DOCUMENTED convention, not a house style** — unlike the trill's `(tr)`,
   which turned out to be G. Schirmer's manual and nobody else's (`docs/trill-plan.md` rule 6). His
   request for Sibelius-style parentheses here is the mainstream answer, and SMuFL ships the parens
   as **dedicated glyphs**: `octaveParensLeft` **U+E51A**, `octaveParensRight` **U+E51B**.
7. **`loco`** cancels an octave sign — redundant with the end of the bracket, used for clarity.
8. **The line is dashed or dotted**, horizontal, with an italic numeral at the start.

### Covered by Gould, NOT yet read — owed to the book

From the pp. 28–34 contents: height of the `8` in stave spaces · placement of the optional `va` ·
2- and 3-octave signs (and **avoiding French `16`**) · horizontal placement of the numeral **relative
to notes and accidentals**, and the exception when space is tight · where the extension line goes
relative to other symbols · **when an extension line may deviate from the horizontal** · octave signs
over a WHOLE SYSTEM · exactly where the sign goes across a system break · optional parentheses.

⭐ **Three of those decide code and are worth reading before P2**: the numeral's height in stave
spaces (our y constant), its horizontal placement against an accidental (our x rule), and the
system-break placement (which we are about to choose from Dorico's docs instead).

---

## 2. ⭐⭐ WRITTEN, not sounding — DECIDED

> **His call, 2026-08-13: "lets go with written pitch."** The research below is why the question was
> worth asking at all — three of the five reference programs answer the other way — and it stays here
> so the decision cannot be re-litigated from a half-memory of what Dorico does.

Under an 8va, does `octave: 5` in our JSON mean the notehead's position or the sound? **The notehead.**

| | stores | adding an 8va to an existing passage |
|---|---|---|
| **Dorico** | **SOUNDING** | **the noteheads MOVE DOWN**; the pitch you entered is preserved |
| **LilyPond** | **SOUNDING** | `\ottava 1` sets `middleCPosition` — you write the sound, it prints shifted |
| **MusicXML** | **SOUNDING** | `<octave-shift>` "indicates where notes are shifted **from their performed values** because of printing difficulty"; an 8va is stored as a shift *down* |
| **Sibelius** | **WRITTEN** | notes stay put; only playback moves |
| **MuseScore** | **WRITTEN** | notes stay put; `Note::pitch` is the written one, playback adds the shift |

Dorico is explicit: *"The octave line will always change the notated position of notes in Dorico, in
order to preserve the pitch which you entered"* — and it added an opt-out property (*Automatic
sounding pitches only*, 6.2) because people kept wanting the other behaviour.

### ⭐ Why WRITTEN — we already decided this once, for octave CLEFS

`docs/octave-clefs-plan.md` §1: *"the model keeps storing WRITTEN pitch — what the notehead says. The
octave lives in exactly one place, at the point where written pitch becomes sound."* Its rejection of
the other side is still the right argument: storing sound means every note must be shifted back
before it reaches VexFlow, and **a missed site draws silently an octave wrong**.

⭐ **The ottava is the same question, so it must get the same answer**, or one score has two rules for
where an octave lives — the exact conflation `docs/DESIGN-PRINCIPLES.md` exists to prevent. Our
whole editor compares written pitch to written pitch: stem direction, ledger lines, selection,
navigation, collision, copy/paste.

### …and the UX Dorico is buying is still available, as an EDIT

The reason Dorico stores sound is a real one: select a passage sitting on five ledger lines, press
8va, and you want the noteheads to **come down** and the music to sound the same.

⭐ **That is a command, not a model semantic.** `createOttava(selection, +1)` = *one batch* that
(a) writes the span and (b) subtracts an octave from every covered note's written pitch. Sound is
invariant, the noteheads move, undo is one step — Dorico's behaviour exactly, with none of Dorico's
model. And the *other* behaviour (Sibelius's: leave the notes, change the sound) is the same command
without step (b).

⛔ Do not make that a stored flag on the object. It is what the command did once, not what the object
means.

---

## 3. VexFlow 5.0.0 — what is there, and the verdict

`vexflow@5.0.0`. Relevant classes: **`TextBracket`** (`textbracket.d.ts`), plus `Clef`'s `'8va'` /
`'8vb'` annotation (that one belongs to `docs/octave-clefs-plan.md`, not here).

`TextBracket` is genuinely the right *shape* — `{ start: Note, stop: Note, text: '8', superscript:
'va', position: TOP|BOTTOM }`, dashed line, `showBracket`, `bracketHeight`, `setDashed(dashed, dash)`,
`setLine(n)`.

**⛔ Reject it. Four of the five reasons are the ones that killed `VibratoBracket` for the trill:**

1. **y is a fixed rung** — `this.start.checkStave().getYForTopText(this.line)`. Blind to ledger lines,
   stems, flags, anything. Under an 8va the notes are *by definition* high, so this is wrong exactly
   where the feature is used. This is the defect `dynamicsLine.ts` and `TrillRenderer` both exist
   to fix.
2. **Both ends on ONE stave** — `start.checkStave()`, `stop.getAbsoluteX()`. No system break. An
   ottava crosses systems constantly, and a repeated `(8)` per fragment is impossible here.
3. **No SMuFL** — it renders `text` + a 0.714× `superscript` in the ordinary font stack. The octave
   glyphs (U+E510–E51F) and the continuation parens (U+E51A/B) exist and are the `TempoLayout`
   idiom we already use.
4. **The hook is `bracketHeight * position`** with `position` ∈ {TOP, BOTTOM}, so it is tied to
   VexFlow's fixed rung, not to our band.
5. ✅ **One thing it gets RIGHT, and we should copy**: it ends at
   `stop.getAbsoluteX() + stop.getGlyphWidth()` — the last **notehead**, not the end of its
   duration. That is §1 rule 2, for free, and it is worth noting that VexFlow is on Gould's side
   here while our own trill is not.

**What we would inherit is one `drawDashedLine` call.** So: our own pass, the `TrillRenderer` /
`HairpinRenderer` shape — which also means the `planSlurSegments` fragments and the staff `scale(k)`
handling come for free.

---

## 4. The model — POSITIONAL, and ONE signed field

⭐ **An ottava is not a slur or a trill. It is a CLEF-shaped statement.** It governs a REGION of a
STAFF — every voice, every note in it, including notes typed *after* it exists. That last clause is
decisive: a note-anchored span (`startNoteId`/`endNoteId`, the trill's shape) cannot say "and
whatever else lands in here", so it would have to derive membership from position anyway.

⭐ Dorico files it the same way: its octave line popover is **Shift+C — the *clefs and octave lines*
popover**, not the lines one.

So it takes the **`Hairpin`'s** shape, not the `Trill`'s: measure-owned, beat-anchored, carrying its
own extent. It rides the measure spine, so re-bar and paste handle it with the machinery that
already exists — ⭐ **no `captureOttavas`/`restoreOttavas` MODULE**, which is the whole cost the trill
had to pay (`docs/trill-plan.md` §2.1).

### ⚠️ …but "the machinery that already exists" is a TABLE, and it wants four rows

The first draft of this section said re-bar and paste come free. They do not, and the correction is
worth having in writing because it is the difference between "no code" and "no *bespoke* code":

`rebarOps.ts`'s beat-anchor seam is a discriminated union with **one branch per family** — the
hairpin's member is at `:74`, its capture at `:696`, its restore at `:738`. Copy/paste is a second
table: `Clip` (`utils/clip.ts:176`) carries `dynamics` / `slurs` / `trills` / `hairpins` / `spaces`,
and the clip hairpins are re-anchored at `rebarOps.ts:495`. So an ottava costs:

1. `{ kind: 'ottava'; absBeat; ottava }` in the anchor union, + a capture branch,
2. a restore branch — ⚠️ **which has to choose a rule**: the clef's (at most one per beat, last wins)
   or the dynamics'/hairpin's (they may stack, no dedupe). ⭐ **The clef's**, and for the clef's
   reason: two ottavas governing the same staff from the same beat is not a stack, it is a
   contradiction. That is the one genuine decision in P1.
3. `ottavas?: ClipOttava[]` on `Clip` + the paste re-anchor beside the hairpin's,
4. ⚠️ and the note `Hairpin.id` already carries: **the id is regenerated by a re-bar**, so anything
   keyed by an ottava's id (an engraving override, later) dies across one exactly as a hairpin's does.

⭐ Four rows in tables that already exist is precisely CLAUDE.md's rule working. What the positional
shape actually buys is that none of it is a *module*, and none of it has to reason about note ids.

```ts
/** Measure.ottavas?: Ottava[] — stored on the bar its START lands in. */
interface Ottava {
  id: string
  /** Start beat within the owning measure (a slot boundary, like clefs/dynamics/hairpins). */
  beat: Fraction
  /** How much music it covers, in quarter beats. Always > 0. */
  length: Fraction
  /** ⭐ THE WHOLE STATEMENT: octaves of shift. +1 = 8va, -1 = 8vb, +2 = 15ma, -3 = 22mb. */
  shift: -3 | -2 | -1 | 1 | 2 | 3
  /** Staff this ottava governs (a StaffInfo id); absent = staff 0. */
  staffId?: string
}
```

### ⛔ What is deliberately NOT a field, and why

- **No `placement`.** Derived: `shift > 0` → above. §1 rule 4 — the side is half of what tells the
  reader the direction, so a stored side could contradict the stored shift. (Contrast `Trill.placement`,
  which is genuinely free: a trill above or below means the same trill.)
- **No `size` / `type: '8va'|'15ma'`.** `|shift|` → 8 / 15 / 22. Two fields for one fact is the
  `score.clef` mistake in miniature.
- **No `voice`.** An ottava governs the staff. This is the one span in our model that does not carry
  one, and it is not an oversight — `Hairpin`, `Slur` and `Trill` all do.
- **No endNoteId.** §1 rule 2 makes the drawn end derived: *the last notehead inside the span*. The
  span says what is affected; the render says where the ink stops.
- **No y, no dash length, no hook height, no stored break point.** `Hairpin`'s rule, verbatim —
  those are the render's or the engraving-overrides compartment's.
- **No label style.** §7.

---

## 5. ⭐⭐ THE LADDER — its trigger, and it is BUILT FIRST

> **His call, 2026-08-13: "do the ladder phase first, that should fix the tempo too."** So §5 is not
> a warning attached to the ottava; it is **P0**, landed and green before an `Ottava` type exists.
> ⭐ That order is also what makes it testable on its own: the ladder's proof is that *today's*
> families — the trill, the dynamics line and the tempo mark — come out in the right order over
> music that has no ottava in it at all.

`docs/above-staff-ladder.md` §4 wrote the trigger down in advance: *"the first family that is
**neither innermost nor on a baseline** — that is the 8va bracket or technique text."* This is it.

**LilyPond's numbers** (lower = nearer the staff): TrillSpanner **50** · DynamicLineSpanner **250** ·
**OttavaBracket 400** · TextScript 450 · MetronomeMark **1300**.

⭐ **Two independent sources agree on the ottava's rung**: LilyPond puts it outside dynamics (400 vs
250), and Gould says octave lines sit *outside all other notations* (§1 rule 5). So the order is
real, and it is settled.

### The good news: it is STILL ink, not a priority table

The ladder doc's §2 argument holds — *"for any two families where the inner one is drawn (or
measured) before the outer one is placed, priority order and contributing a row of ink are the same
statement."* The ottava is outside the dynamics line, the dynamics line is computed first, so the
ottava reads a band that already includes what the dynamics line occupies and takes its rung.

Shape: `OTTAVA_LINE: Clearance` beside `DYNAMICS_LINE` and `TRILL_LINE` in the existing
`engine/layout/inkBand.ts`, and the ladder *is* the ordered list of those constant pairs. No numbers
table anywhere. `clearanceBaseline(band, side, ink, OTTAVA_LINE)` is the whole placement.

### ⛔⛔ …but NOT a row in `measureColumns`' ink. That array is the WIDTH's.

The first draft wrote this as *"the dynamics line becomes a row in the ink model"*, quoting the
ladder doc. **Taken literally that is wrong, and it breaks two things at once.** `Column.ink` is
consumed by `engine/layout/spacing.ts:266` (`inkFloor`) — it is the **horizontal kerning** input, the
thing that decides how wide a bar is. Put a placed dynamic in it and:

- ⛔ **bar widths change**, because a mark that costs no horizontal room starts claiming some — which
  is exactly the distinction `MeasureRedrawKey`'s header calls "the classic way to get this wrong"
  (`laneFingerprint` *pointedly excludes dynamics, because a `mf` costs no width*);
- ⛔ **it is circular**: `dynamicsLineAt` derives the line's y from `staffInkBand` over those same
  columns, so the line would be clearing itself.

⭐ **What P0 actually needs is a SECOND, LATER accumulator** — one occupied band per
`(system, staff, side)` that *starts* as the music's ink band (`staffInkBand`, unchanged) and to
which each family **adds its own placed extent as it is placed**, in ladder order. The outer family
then asks that accumulator instead of asking the columns. It is still not a priority-number table —
the order is the order the producers run in, and the constants stay `Clearance` pairs — but it is a
new module (`engine/layout/outsideStaffBand.ts`, pure, derived, stored nowhere) and P0 must budget it
as one rather than as an edit to `measureColumns`.

⚠️ The accumulator is per SYSTEM and per SIDE, not per bar: that is the scope every producer already
works in (`dynamicsLinePlan` keys hairpin fragments `id@line`), and a per-bar band would let an
ottava dip between two bars of one system.

### ⭐ And the TRILL publishes too — not just the dynamics line

LilyPond puts TrillSpanner at **50** and OttavaBracket at **400**, so an 8va over a trilled passage
must clear the `tr` and its wavy line. Today the trill contributes an extent to nothing: `renderTrills`
(`VexFlowRenderer.ts:3686`) computes its own baseline, draws, and tells no one.

So P0 has **two producers, not one** — the dynamics line *and* the trill — and the ottava is the
first consumer. ⭐ This does not contradict `docs/above-staff-ladder.md` §3's "the trill is the
innermost family and never has to know what is above it": it still doesn't. Being innermost means it
never *reads* the accumulator; it does not excuse it from *writing* to it.

### ⭐⭐ …and TEMPO is the family that has to change — his question, answered

`TempoLayout.ts:245` is `const y = stave.getYForTopText(1)`. **A constant.** It knows nothing about
ledger lines, the dynamics line, a trill, or an 8va bracket.

**Is it OK today?** Only by luck, and thin luck: tempo is the outermost family and usually sits at
bar 1 beat 0, where there is little above-staff ink. But it can already collide — a dynamic above the
staff at bar 1, or a high passage with three ledger lines, will run into it now.

**Is it OK after the ottava?** ⛔ **No.** An 8va bracket is drawn at the exact height a tempo mark
occupies, over exactly the passage that forces it highest. `Allegro` and `8` will overlap on the
first bar of any high opening.

**The fix is one more caller, not a rewrite** — but it has an ORDERING consequence that is the real
work:

- Tempo becomes `clearanceBaseline(band, 'above', markInk, TEMPO_LINE)` with the largest
  `minFromStaff` of the four. One row in the same table.
- ⚠️ **But tempo is drawn INSIDE the measure pass, and the ottava is a score-level pass after it** —
  so today the outermost family is placed FIRST. ✅ **Verified**: `drawTempoMarks` at
  `VexFlowRenderer.ts:2065` (in the measure loop), `planDynamicsLines` at `:3666`, `renderTrills` at
  `:3686`. That inversion is what actually has to be fixed: either the above-staff band becomes a
  **layout** answer computed before the measure pass (it nearly is already — `staffInkBand` is a
  layout module), or tempo moves out to a score-level pass beside
  `SlurRenderer`/`HairpinRenderer`/`TrillRenderer`.
- ⭐ **Decided: compute the bands in layout.** Every family then reads one answer to "how high does
  this bar reach", which is the rule `dynamicsLine.ts` already states about itself, and the renderers
  stay dumb.
- ⚠️ **What that decision costs, stated honestly.** The *music's* band is already pre-measure — it
  comes from `measureColumns`, so `drawTempoMarks` could read it today with no reordering at all. The
  part that is NOT pre-measure is the **placed dynamics baselines**: `planDynamicsLines` needs the
  cast-off `placements` and levels chains across systems. Two of its three inputs exist before the
  measure loop, so **the work item is "hoist `planDynamicsLines` above the measure loop"** — name it
  that, or P0 quietly collapses back into the second option (move tempo out) that this bullet
  discards.

### ⭐⭐ …and the REAL decision in P0: tempo's y and the measure SHAPE KEY

⚠️ **This is the trap, and it is already documented in our own code.** `dynamicsLinePass.ts`'s header
says why the dynamics line is applied as a post-hoc TRANSLATE rather than a placement: *"putting the
line in every measure's shape key redraws a whole system whenever one note moves"* — the alternative
measured at **53% of render time**. And `MeasureRedrawKey.ts` lists **tempo marks as being in the
shape key today** ("dynamics, tempo marks, the meter glyph — drawn, but weightless").

So the moment tempo's y stops being a constant and starts depending on a band, one of two things must
happen, and **P0 must choose before it starts**:

- **(a)** the band joins `measureShapeKey` — correct, and it pays the cost the dynamics line refused;
- **(b)** ⭐ **tempo gets the dynamics treatment**: drawn where it is drawn now, inside its measure
  group, and MOVED afterwards by a pass that reads the plan. `dynamicsLinePass` +
  `dynamicMarkTransform` are the working precedent, including the "already on the line, leave it
  alone" rule that makes it safe over a bar nobody re-engraved.

**Recommendation: (b).** It is the shape the codebase already proved, it keeps tempo out of the
redraw key, and it makes tempo's y a system-scope fact — which is what the ladder doc's §3 table
already says it is (*"yes, across systems"*).

⚠️ Note this makes tempo's scope a genuine question rather than a copy of the dynamics rule: a
metronome mark is read **as a row across systems**, so its floor is likelier to want the system's
band than the local `columnsUnder` slice. That is taste, and it is one of the numbers owed to his eye.

⛔ This is real work and it is not the ottava's — it is the ladder's, and the ottava is what makes it
due. **It is P0** (§8).

### ⚠️ What P0 must NOT turn into

- ⛔ **Not a priority-NUMBER table.** `docs/above-staff-ladder.md` §2 is still right: while the inner
  family is measured before the outer one is placed, "priority" and "a row of ink" are the same
  statement. The ladder is the **ordered list of `Clearance` constant pairs** that `inkBand.ts`
  already holds two of. A number table would be a second answer to the same question.
- ⛔ **Not a per-family method on the renderer.** One module, one row per family (CLAUDE.md's rule);
  `TRILL_LINE`, `DYNAMICS_LINE`, `TEMPO_LINE`, later `OTTAVA_LINE`.
- ⚠️ **Tempo's move is a BEHAVIOUR change to shipped output**, not a refactor: every score with a
  tempo mark repositions slightly. That is the point (the constant was wrong), but it means the
  browser suite's tempo geometry expectations move with it, and it wants his eye before it counts as
  done — `TEMPO_LINE`'s two numbers are taste, exactly as the trill's 0.5/1.0 were.
- ⭐ **The dynamics line (and the trill) become PRODUCERS of the occupied band** — not rows in
  `measureColumns`' ink, which is the width's (see the ⛔⛔ block above). That is the single largest
  piece of P0, and it is a near relative of the fix `docs/above-staff-ladder.md`'s "Known and
  accepted limitation" booked — near, not identical, and the difference is the whole of that block.
- ⛔ **Not a widening of `Column.ink`.** If a change makes a bar wider, it is in the wrong module.
  P0's own regression test: **no bar's width may move.** Every visible change belongs to a `y`.

---

## 6. Where the octave becomes sound — ONE seam, and it is shared

`spellingToMidi` is called at **five** places in `engine/audio/playbackSchedule.ts` (`:324` chord,
`:485`, `:541` fan/tremolo attacks, `:726` the trill auxiliary, `:742` a comparison). ⚠️ **Shifting
one of them is a silent octave bug in the others** — a trill under an 8va would trill in the wrong
octave and nothing would fail.

⭐ **So the shift must be resolved ONCE per slot, in a prepass** — the `trilledSlotIds` shape
(`docs/trill-plan.md` §7), and applied where the midi is derived, not where each caller feels like it.

⚠️ **But "the one place the midi is derived" does not exist, and pretending it does is how a site
gets missed.** The five calls are **three independent emit paths plus one comparison**:

| site | what it is | shifted? |
|---|---|---|
| `:324` | a chord's notes | **yes** |
| `:485`, `:541` | the fan / tremolo attack paths | **yes** — two separate paths, both |
| `:726` | the trill's AUXILIARY note | **yes**, and it is the trap |
| `:742` | `spellingToMidi(a) === spellingToMidi(b)` | ⛔ **no** — shift-invariant; touching it is noise |

So P2 is **one resolver and four call sites**, three of which must change. ⭐ Write it as "every
`spellingToMidi` in this file takes the slot's shift, except the comparison" — a rule a reader can
check by grep — rather than as a single seam that isn't there.

⭐ **Where `soundingShiftAt` lives**: it answers a question about the SCORE, so `utils/` (beside
`utils/tempoMap.ts`, whose `effectiveTempoAt` is the same positional-resolution shape) — ⛔ never a
method on `MusicEngine`, which is the *editor's* facade (CLAUDE.md; DESIGN-PRINCIPLES §5).

⭐⭐ **And it is the same seam `docs/octave-clefs-plan.md` §2.4 needs.** That plan's one genuinely new
coupling is "resolve the effective clef at this (measure, beat, staff) and subtract 12 under an 8vb
clef". Both features want the same function:

```
soundingShiftAt(score, measureNumber, beat, staffId) → semitones
```

…summing the octave clef's shift and the ottava's. ⭐ **That single function is also where the
octave-clefs plan's stated TRAP lives** (§3: an 8vb clef *and* an octave-transposing instrument = two
octaves down, and nothing objects). One place that answers "how far from written to sounding" is
where that can be checked at all. Building the ottava builds it.

---

## 7. Decisions — his, and what is still open

1. ✅ ⭐⭐ **WRITTEN pitch (§2). Decided 2026-08-13.**
2. ✅ ⭐⭐ **The ladder phase goes FIRST (§5), and fixes tempo. Decided 2026-08-13.**
3. ⏭️ **Does `createOttava` re-spell the selection?** The one sub-question written pitch leaves open,
   and it is a behaviour question, not a model one (§2's tail). Selecting a high passage and pressing
   8va can either (a) drop the noteheads an octave so the sound is unchanged — Dorico's behaviour,
   reached as one batch edit — or (b) leave them and let the passage sound an octave higher —
   Sibelius's. ⭐ Both are one line apart; neither is a stored flag. ⚠️ Worth deciding **by hand on
   real music**, not in advance: it is exactly the kind of call his testing has overruled before.
4. ⭐ **The numeral: `8` or `8va`?** Gould says bare `8`; Sibelius/MuseScore default to `8va`/`8vb`.
   This smells like an **engraving preset** (score-wide), not a per-object field — the same place the
   trill's continuation default is headed. Constant for now, and which constant is his taste.
   ⚠️ If he wants `8vb`, note that is the one form Gould's list excludes.
5. ✅ **The continuation label** — he has already asked for parenthesised, and §1 rule 6 says that is
   the documented convention (and SMuFL ships U+E51A/E51B for it). ⭐ The trill's rule about *where*
   a parenthesised reminder goes transfers verbatim: **at the system's left edge**, because that is
   what a bracketed reminder IS — and `docs/trill-plan.md` rule 6 literally cites "where an `(8)`
   continuation sits" as its model. So the two will agree by construction.
   Open only: do we offer the trill's three-way choice, or is parenthesised simply the behaviour?
   My recommendation: **behaviour, not a field** — three programs disagreed about `(tr)`, but they do
   not disagree here.
6. ✅ **The ladder phase (§5) is P0 — settled by his call above.** The alternative it beat was drawing
   the ottava on a fixed rung and fixing tempo later; ⛔ that would have been a third private vertical
   rule, which is exactly what the ladder doc forbids.
7. ⭐⭐ **NEW, and it is P0's load-bearing choice: tempo's y vs the measure SHAPE KEY** (§5's last
   block). Either the band joins `measureShapeKey`, or tempo is drawn where it is now and MOVED by a
   pass, as the dynamics line already is. **Recommendation: the second** — the first pays the redraw
   cost that was measured at 53% of render time and deliberately refused once already. ⏭️ Not his to
   decide unless he wants it; it is an internal consequence, and it is flagged here so P0 does not
   discover it halfway.
8. ⭐ **NEW: two ottavas at one (staff, beat) — dedupe or stack?** ✅ **The clef's rule: dedupe, last
   wins** (§4's table-rows block). A hairpin may stack because two wedges at a beat are two readable
   marks; two octave shifts governing the same staff are a contradiction, not a stack.
9. ✅ **Entry — decided.** Palette row in `dev/linePalette.ts` (its header already lists *"the octave
   line"* as a future member of the Lines family). Selection → apply; nothing selected → arm a stamp.
   ⛔ **NO KEYBOARD SHORTCUT — his call, 2026-08-13**, on the same reasoning as the trill's: Sibelius
   has none (its octave lines live in the Notations ▸ Lines gallery, which `L` opens), so there is no
   muscle memory to honour. Nor is there one to borrow elsewhere: Dorico uses a popover (Shift+C) and
   MuseScore's ottava shortcuts are a broken chord (`Ctrl+Y, Ctrl+O, Ctrl+A` — `Ctrl+Y` is Redo).
   The palette row is the whole entry surface.
10. **`x` on a selected ottava** — flip `shift`'s sign (8va ↔ 8vb)? It changes what sounds, but so
   does flipping a hairpin's `cresc`↔`dim`, and that is already what `x` does there. Or nothing.
11. **15ma / 22ma in v1?** Free in the model (`shift` is already signed and ranged); it is two more
   glyph rows. ⭐ Gould's warning about the French `16` is a reason to name the constants by
   `|shift|`, never by a printed string.

---

## 8. Phases

⚠️ **P0 is not part of the ottava** — it is the ladder, it lands and goes green on today's music, and
only then does anything below start. That is his call and it is also the only order in which P0 can
be proved: an ottava-free score with a trill, a dynamic above and a tempo mark is the whole test.

⭐ **P0 is SPLIT in two, because its risk is concentrated entirely in the second half.** P0a changes
no picture at all; P0b moves every tempo mark in every existing score. Landing them together means
the one review that matters — his eye on the tempo — is done against a diff that also rewrote the
band machinery.

- ✅ **P0a — THE OCCUPIED BAND, with no visible change. BUILT 2026-08-13.**
  `engine/layout/outsideStaffBand.ts`: `OccupiedSpan`, `measureStartOffsets` (moved here from
  `dynamicsLinePlan`, so the ladder's horizontal axis has one owner), `markBand` and `bandOver`.
  Carried per render on `RenderPass.occupiedBands` — a fresh array, `solvedColumns`' arrangement,
  ⛔ never module state. **Two producers write, nothing reads**: `planDynamicsLines` files one claim
  per letter/word/wedge-fragment from the **levelled** baseline, and `TrillRenderer`'s
  `trillFragmentClaim` files one per fragment over the same bar slice `baselineFor` measured. ⛔ No
  priority numbers, no `Column.ink` row, no new constants.
  ⭐ **The hoist landed too**: `planDynamicsLines` now runs *above* the measure loop, on `plans`
  rather than `placements` — `DynamicsPlanPlacement` never wanted a `stave`, and `placements[i]` is
  `plans[i]` plus one. P0b's tempo can therefore read the plan from inside the measure pass.
  *Proved by*: 35 new unit assertions (`outsideStaffBand.test.ts`,
  `dynamicsLinePlan.test.ts`, `TrillRenderer.ladder.test.ts`), the full unit suite at 3246 green —
  and **the browser suite 120/120**, which is the phase's real claim: every drawn position,
  dynamics and trills included, is exactly where it was.
  ⚠️ Three of the new specs were **break-tested** (wrong bar offset, strict staff comparison,
  pre-levelling baseline). The levelling one passed under the bug first time — the fixture was too
  flat for the chain to move anything — and was rewritten until it failed. ⭐ Worth remembering: a
  claim written before `levelDynamicsChains` is invisible to every test that does not force a chain.
- ✅ **P0b — TEMPO JOINS THE LADDER. BUILT 2026-08-13** — ⚠️ **but not signed off: his eye is owed.**
  ✅ **§7.7 settled the way it was recommended: a TRANSLATE pass.** `engine/rendering/tempoLinePass.ts`
  is `dynamicsLinePass`' twin — the mark stays where `drawTempoMarks` put it, inside its measure
  group, and is moved afterwards, so a system-scope y never enters `measureShapeKey` and the 53%
  redraw cost is not paid. `TempoLayout`'s `getYForTopText(1)` survives as a drawing ORIGIN only,
  documented as such; `engine/rendering/tempoStyle.ts` holds `TEMPO_LINE` (padding **0.8**,
  minFromStaff **3.0**) and `TEMPO_MARK_INK`. Wired in **after `renderTrills`**, because the ladder's
  order IS the pass order.
  *Proved by*: `e2e/ladder.e2e.ts` (5 tests, new file — there was no tempo geometry spec at all),
  full browser suite **125/125**, unit 3255.
  ⚠️⚠️ **Break-testing found the first fixture worthless**: with the ladder read deleted the ordering
  test still passed, because over staff-resident music the three floors (1.0 / 2.1 / 3.0) come out in
  order whether or not anything reads anything. The fixture is now a note four ledger lines up, where
  only actually clearing the claims can produce the order. ⭐ Any later family added to this ladder
  must be tested the same way, or its test proves the constants and not the mechanism.
  ⚠️ **Owed to his eye — the two numbers, and the SCOPE.** `TEMPO_LINE`'s pair is taste exactly as the
  trill's 0.5/1.0 were, and every score with a tempo mark repositions. Separately, `tempoScope` clears
  from the mark's beat to the END of its bar — wider than a dynamic's single column because a tempo
  mark is a sentence, narrower than the truth because the honest scope is the mark's measured WIDTH
  (LilyPond's skyline) and that is not available where it would be needed. It errs by clearing too
  much, which is never a collision. See that function for what to change first if his eye disagrees.

  ✅ **His testing, 2026-08-13 — two findings, both fixed, both PRE-EXISTING rather than the ladder's:**
  - ⭐⭐ *"clicking on the `tr`, the Allegretto is highlighted."* `TempoLayout` registered
    `group.getBBox()` as the mark's hit-box, and a mark carrying a metronome glyph has a MUSIC-FONT
    run whose em box measures **86 px — 8.6 staff spaces** — reaching from above the mark down past
    the staff's top line. The trill's box sat entirely inside it and `ELEMENT_HIT_ORDER` asks tempo
    (3rd) before the trill (8th). Fixed the way `DynamicsLayout` already does it: horizontal from the
    group, vertical rebuilt from the baseline + `tempoStyle`'s tight ink. **86 px → 15 px.** ✅ He
    confirms the trill selects. ⭐ Generalised rule now in the reference memory: *never register
    `getBBox()` vertical for anything containing a music-font glyph.*
  - ⭐ *"the tempo font and glyph look too small."* Measured: the words were **14 pt = 1.87 staff
    spaces**, and the size was never ours — it was whatever VexFlow's `StaveTempo` metric said.
    ⭐⭐ Replaced with DERIVED numbers, and the research generalised into
    `reference_engraving_text_sizes` because every future text family will want it. **Nothing here
    is in px: every program states points against a REFERENCE STAFF HEIGHT**, so the portable unit
    is the STAFF SPACE. Verified: LilyPond & Dorico reference a **20 pt** staff, Sibelius & MuseScore
    **7.0 mm**, Finale **24 pt**; LilyPond's default text is `staff-height / 20 * 11` = **2.2
    spaces**; MuseScore's `styledef.cpp` gives `tempoFontSize` 12 pt and `expressionFontSize` /
    `staffTextFontSize` / `dynamicsFontSize` 10 pt against `spatium` 24.8 (= 1.75 mm), i.e. **2.42**
    and **2.02 spaces**. Our staff space is 7.5 pt.
    → **tempo 14 → 18 pt** (2.4 spaces, on MuseScore's number), glyph tracking it at 1.11× (**20**);
    → **expression/prose `DYNAMIC_TEXT_SIZE` 14 → 16 pt** (2.13 spaces) — it was below *every*
    reference too. ⭐ Raising it moves neither the dynamics line nor the glyph size: the glyph runs
    are grown by the RATIO `DYNAMIC_GLYPH_SIZE / DYNAMIC_TEXT_SIZE`, and the line is stated off the
    glyph ink alone. ✅ *"tempo looks much better now"*, then *"looks better now"*.

  ⭐ **A pre-existing defect was found and fixed on the way, and it is worth its own note.** Three
  render passes read a drawn mark's baseline back with `parseFloat(el.getAttribute('y') ?? '')`.
  **VexFlow's SVG context omits the attribute when the value is 0, and SVG defines a missing one AS
  0** — so an ordinary mark that lands on 0 read back as `NaN` and every one of those sites treated
  it as *nothing drew here*. In `dynamicsLinePass` that meant the mark was **silently never placed on
  the dynamics line** (found with a `p` above a B6); in `DynamicsLayout` it meant the tight hit-box
  silently fell back to the ballooned group box it exists to replace. ⭐ Fixed as a MODULE, not three
  patches — `engine/rendering/drawnText.ts` owns the rule and keeps "no element" and "no attribute"
  as different answers. ⛔ Do not read those attributes off drawn ink anywhere else.
- **P1 — the model.** `Ottava` (§4), `Measure.ottavas`, `engine/models/ottavaOps.ts` in the
  `hairpinOps` idiom, thin `ScoreModel` delegators, **plus the four table rows §4 lists** — the
  `rebarOps` anchor member + capture + restore (dedupe rule, §7.8) and `Clip.ottavas` + its paste
  re-anchor. *Done when*: an ottava round-trips through JSON and survives a meter change and a
  copy/paste with **no capture/restore MODULE and no note ids anywhere in it** — that is the claim
  the positional shape actually buys, and it is the narrowed version of the one this plan first made.
- **P2 — sound.** `soundingShiftAt` in `utils/` (§6) + the per-slot prepass. *Done when*: a passage
  under 8va plays an octave up **and so does a trill inside it** — `playbackSchedule.ts:726`, the
  site that fails silently, tested rather than assumed. ⚠️ Three of the file's five
  `spellingToMidi` calls change; the comparison at `:742` must not (§6's table).
- **P3 — drawing.** `OTTAVA_LINE` (one row in P0's table), `engine/rendering/OttavaRenderer.ts` on
  the `TrillRenderer` pattern: `planSlurSegments` fragments, SMuFL numeral, dashed line, hook, and
  the parenthesised `(8)` at each continuation system's left edge (§1 rule 6). *Done when*: the line
  ends at the **last notehead** (§1 rule 2 — ⚠️ not the trill's rule), the hook is never dangling,
  and the numeral repeats parenthesised across a break. e2e, because it is all geometry.
  ⭐ **The width/shape-key question, answered out loud** because
  `reference_render_width_key_vs_shape_key` requires it of every engraved element: **neither key
  gains a row.** The ottava draws in a score-level pass *outside* the measure groups, exactly as the
  hairpin, slur and trill do, so it is rebuilt from scratch every render and no measure's cached `<g>`
  can hold a stale one; and written pitch means no notehead moves, so no bar gets wider. ⚠️ If P3
  ever draws any part of the bracket *inside* a measure group, that sentence stops being true.
- **P4 — editing.** `{ kind: 'ottava'; id }` in `SelectedElement` (17 — confirmed: 16 kinds today),
  rows in `ELEMENT_SPECS` and `ELEMENT_HIT_ORDER`, highlight, Delete (`shortcutWiring`'s switch),
  the Properties row (`selectionSnapshot`'s switch) — the two sites `assertNeverElement` names.
- **P5 — entry.** `createOttava`, `{ kind: 'ottava' }` in the `MarkingTool` union + its row in
  `MARKING_TOOL_USES_ARMED_LENGTH` (⭐ **`false`** — its extent is the MUSIC's, the hairpin's and
  trill's answer verbatim), `ottavaStamp.ts`, the `dev/linePalette.ts` row. ⭐ **No `GHOST_DRAWERS`
  row and no `ToolGhost` member**: the slur, hairpin and trill have none either — a span tool's
  press needs a selection or a note under it, not a floating preview. ⛔ No shortcut (§7.9).
  ⏭️ §7.3 (does it re-spell?) is answered here, by hand, on real music.

---

## Sources

Gould, *Behind Bars* pp. 28–34 (contents + second-hand quotations via
[Scoring Notes, "Better octave lines in Sibelius"](https://www.scoringnotes.com/tips/better-octave-lines-in-sibelius/)
and [Steinberg forum, "Ending of 8va extension lines"](https://forums.steinberg.net/t/ending-of-8va-extension-lines/773683)) ·
MusicXML [`<octave-shift>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/octave-shift/) ·
LilyPond [Displaying pitches / `\ottava`](https://lilypond.org/doc/v2.22/Documentation/notation/displaying-pitches)
+ [OttavaBracket internals](http://lilypond.org/doc/v2.26/Documentation/internals/ottavabracket)
+ [outside-staff-priority defaults](https://lilypond.org/doc/v2.24/Documentation/notation/default-values-for-outside_002dstaff_002dpriority) ·
Dorico [Octave lines](https://archive.steinberg.help/dorico/v1/en/dorico/topics/notation_reference/notation_reference_clefs_octave_lines_octave_lines_c.html)
+ [8va without changing the notes](https://forums.steinberg.net/t/8va-without-changing-the-notes/1001838)
+ [Clefs and octave lines popover](https://archive.steinberg.help/dorico/v3/en/dorico/topics/write_mode/write_mode_notations_input/write_mode_clefs_octave_lines_popover_r.html) ·
MuseScore [Octave lines](https://handbook.musescore.org/notation/pitch/octave-lines)
+ [ottava shortcuts issue #13321](https://github.com/musescore/MuseScore/issues/13321) ·
Sibelius: [octave lines affect playback only](https://vi-control.net/community/threads/sibelius-7-5-8va-symbol-not-lowering-the-notes-an-octave.48859/) ·
[SMuFL Octaves range U+E510–E51F](http://smufl.formats.music/latest/tables/octaves.html) ·
VexFlow 5.0.0 `textbracket.d.ts` + bundle source (read locally)
