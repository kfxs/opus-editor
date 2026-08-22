# OTTAVA — 8va / 8vb, the numeral and its bracket

Research 2026-08-13, and **ALL SIX PHASES BUILT the same day** — P0a/P0b (the above-staff ladder),
P1 (the model), P2 (sound), P3 (drawing), P4 (editing), P5 (entry). §8 carries what each one landed
and what it found; the section after it carries the five calls his eye made once an ottava was
reachable. ⛔ The research below is not to be redone.

Since then: **P7** the two endpoint squares, **P8** the offsets in Properties, **P9** the ladder
reordered, and **P10** the INTERPOLATING WALK on both squares (2026-08-21) — with the cross-system
WRAP, the *left anchor pushes the right* rule, and the page limit re-asked at the SQUARE. Each has its
own ✅ section at the end.

⏭️ **What is still open:** §7.3 (does `createOttava` re-spell the selection down an octave?) — only
real music answers that — and a handful of taste constants listed at the end of §8.

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
5. 🚨🚨 **CORRECTED 2026-08-17, from the book itself — this rule was cited from the wrong sentence
   and it is the wrong way round against DYNAMICS.**

   What Gould p. 29 actually says, opening the octave-signs section, is *"Usually the octave sign will
   be outside all other notation. It must never cut through other symbols"* — a **don't-collide**
   rule, not a ranking. The ranking against dynamics is elsewhere and goes the other way:

   - ⭐⭐ **p. 101** (*Placing dynamics relative to the stave*): *"other markings — such as those for
     articulation, slurs, **octave signs** and tuplet brackets — are **required to be closer to
     notes**, so add these markings to the music **before positioning dynamics**"*.
   - ⭐⭐ **p. 102, top figure — DRAWN, and it is exactly our case**: an ottava bassa under a treble
     staff with hairpins, as a correct/incorrect pair. **Correct** = staff → slurs → the `8` bracket
     and tuplet bracket → dynamics furthest out. The one marked *"but not"* is the dynamics tucked
     under the staff with the `8` pushed outside them — **which is the drawing our renderer produces
     today.** Measured off her engraving at 450 dpi (1 sp = 20 px): `8` line 4.0 sp below the bottom
     staff-line, dynamic ink from ≈5.5 sp, so ≈1.5 sp of clearance.
   - ⭐ **The one exception, p. 29**: an extension line running **for a whole system** goes outside
     everything after all — *"only tempo markings and piano pedal indications remain outside"* it —
     because a dotted line across the whole width visually cuts off anything beyond it. We implement
     nothing like this today.

   ⚠️ **The slur/tuplet exception below is unaffected**: they may sit *inside* a slur or tuplet bracket
   when that bracket is longer than the octave line.

   ✅ **BUILT 2026-08-17** — see §5, and P9 at the end of this file for how.
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
250), and Gould was read as saying octave lines sit *outside all other notations* (§1 rule 5).

🚨🚨 **THAT SECOND SOURCE HAS BEEN WITHDRAWN, 2026-08-17.** The sentence quoted is p. 29's
don't-collide rule; Gould's actual ranking against dynamics is p. 101–102 and puts the octave bracket
**INSIDE** them (see the corrected §1 rule 5). So the two sources DISAGREE, and what is built follows
LilyPond alone:

| pair | Gould | LilyPond `outside-staff-priority` |
|---|---|---|
| ottava vs dynamics | ottava **INSIDE** (p. 101–102), unless it runs a whole system (p. 29) | ottava **OUTSIDE** — 400 vs 250 |
| pedal vs both | pedal **OUTSIDE** both (p. 332) | agrees — pedal spanners 1000 |

⭐ **The pedal half is confirmed twice over** and needs no change: Gould p. 332 — *"place these
beneath the lowest stave of the system, **below all other notation including an 8va bassa sign**"* —
and, independently, Gerou & Lusk p. 105: damper markings are *"usually placed below all other musical
elements"*. p. 337 draws the stack: `8` at 3.25 sp, `Ped.` at 7.25, `Sost. Ped.` at 10.5.
⛔ **UNKNOWN**: no figure in Gould shows a pedal and a dynamic on the same side of one staff (her pedal
figures are piano, where dynamics sit *between* the staves), so that half rests on prose, not a
picture.

✅ **DECIDED AND BUILT, 2026-08-17 — we follow GOULD, not LilyPond.** And it did NOT need the hoist
this section feared: see **P9** below. The trill moved with it, because leaving it outside the
dynamics while the bracket went inside would have matched neither source.

So the order as BUILT is
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
- ✅ **P1 — THE MODEL. BUILT 2026-08-13.** `Ottava` (§4 verbatim — id, beat, length, signed `shift`,
  optional `staffId`, and no voice), `Measure.ottavas`, `engine/models/ottavaOps.ts` in the
  `hairpinOps` idiom, thin `ScoreModel` delegators. **The claim held**: no capture/restore module,
  no note id anywhere in it, and every re-bar/paste behaviour is a row in a table that already
  existed.
  ⭐ **§4 said four rows; there are SIX, and the two it missed are the interesting ones.**
  - `rebarOps`: the `CapturedAnchor` member, the capture loop, the restore branch, the
    `clearMeasureForRebar` delete, the paste overwrite filter, the clip re-anchor.
  - `utils/clip.ts` `ClipOttava` + `Clip.ottavas`, and — a row §4 did not name — the COPY side
    (`clipboard.ts`'s `ottavasInWindow`), without which nothing would ever fill the field. It is
    OMITTED when empty, so `ClipboardPayload.version` stays **4**: a payload from an ottava-free
    score is byte-identical to what it was.
  - ⚠️ **`staffContent.ts`, the row nothing in the plan predicted** — and its own header says why it
    was compulsory: *"EVERY per-staff array must be named here. What is not named rides the spread"*,
    i.e. an unfiltered `ottavas` would land on every staff's lane, silently.
  - ⚠️ **`measureRenderRoles.ts` — the compiler asked P3's question during P1**, because
    `Record<keyof Measure, …>` stops compiling until a new field is classified. Answered **`'ignored'`**
    with §8 P3's reasoning written into the row, plus the two conditions that would change it. That
    file's standing advice is *when unsure, include it*, so "neither key" is a claim, and
    `measureRenderRoles.test.ts` perturbs the field and checks it.
  - ⭐ **The one genuine decision (§7.8) is now in TWO places, deliberately**: `addOttava` upserts per
    (beat, staff) and so does `restoreBeatAnchors`. They are different doors — the model's own write,
    and a re-bar re-landing anchors — and a state the first refuses can still arrive through JSON.
  *Proved by*: `ottavaOps.test.ts` (19) + an `rebarOps.anchors.test.ts` chapter (8) + a
  `clipboard.test.ts` chapter (4) + the `measureRenderRoles` row; unit **3288** green, browser
  **126/126** (nothing draws yet, so that number is the "no bar moved" claim).
  ⚠️ **Break-tested, seven of them** — `matchesStaff` → `===`, the staff test dropped entirely, the
  span's `<=` → `<`, the paste filter reverted to the hairpin's voice rule, the restore dedupe
  removed, `delete measure.ottavas` commented out, the clip's fully-enclosed test dropped. Each
  failed exactly the assertion written for it and nothing else.
  ⏭️ **Deliberately NOT in P1, so the next phase does not think it is owed them**: no `MusicEngine`
  delegators (nothing can create an ottava yet — that door is P5), no `addOttavaOverNotes` (§P5's
  `createOttava`), no resize-by-slot (P4), and ⚠️ **OVERLAP is unpoliced** — `addOttava` refuses a
  contradiction *at one beat*, but two lines on one staff whose spans merely overlap are storable.
  Truncate-or-refuse is an entry-time question about a gesture that does not exist yet, and `ottavaOps`'
  header says so; **P2's `soundingShiftAt` is the reader that will have to pick one**, so it is P2 that
  decides what "the effective shift" means when two claim the beat.
- ✅ **P2 — SOUND. BUILT 2026-08-13.** `utils/soundingShift.ts`: `soundingShiftAt(score, measure,
  beat, staffId?) → semitones` (the shared seam, `effectiveTempoAt`'s shape) + `soundingShiftBySlot`,
  the `trilledSlotIds`-style prepass. **Semitones, not octaves**, because it is a sum waiting to
  happen — the octave clef becomes a second TERM in that function, never a second resolver.
  ⭐ **§6's table held exactly**: FOUR of the five `spellingToMidi` calls now take their slot's shift
  and the comparison (`sameMidi`) does not, with the reason written at each. The three emit paths
  each take it differently, and the difference is the point: the chord loop and the fan take a
  SCALAR (one slot), `collectPairAttacks` takes the MAP — a pair is two slots and an octave line may
  start between them, so each side reads its own exactly as it already reads its own dynamic.
  ⭐⭐ **P2 settled the question P1 left open — what OVERLAPPING ottavas mean.** `ottavaOps` refuses
  two lines that *start* on one (beat, staff); two that merely overlap are storable, so the reader
  had to choose. **The latest-starting line that still covers the position wins**, which is
  `effectiveClefAt`'s rule — and it follows from §4's whole argument, that an ottava is a
  clef-shaped statement. A 15ma opening inside an 8va takes over; when it ends, the 8va **resumes**,
  because the question is *what covers this note*, not *what was declared last*. ⛔ Never a sum: two
  lines over one note is a contradiction, and adding them would turn the least reliable input into
  the loudest wrong answer.
  *Proved by*: `soundingShift.test.ts` (15) + `playbackSchedule.ottava.test.ts` (11); unit **3314**,
  browser 126/126, `build:check` clean.
  ⚠️ **Break-tested nine ways**, and the four that matter most are one per emit path — the shift
  removed from the chord loop, from `collectFanAttacks`, from the pair's `midis`, and from
  `auxiliaryMidiFor` — each failing **only** its own test. That last one is §6's named trap and it
  behaves exactly as advertised: with the auxiliary unshifted the trill still trills, still fills
  the note, still sounds musical, and is a ninth wide. Also broken: the half-open end test, the
  latest-start tie-break, and the per-staff filter.
  ⏭️ Nothing here is audible yet — no ottava can be created (P5). The tests write one through
  `ottavaOps` directly, which is also what makes them a real contract rather than a UI check.
- ✅ **P3 — DRAWING. BUILT 2026-08-13.** `engine/rendering/ottavaStyle.ts` + `OttavaRenderer.ts`, on
  the `TrillRenderer` pattern: `planSlurSegments` fragments, SMuFL numeral, dashed line, hook, and
  the parenthesised `(8)` at each continuation system's left edge. Wired in **after `renderTrills`
  and before `placeTempoMarksOnLine`** — the ladder's order IS the pass order — plus the two rows
  outside the renderer: `spanAnchors` (positional, `ottavaSpan`, the hairpin's road) and
  `ElementType`/`RenderPass.ottavaGroupMap`.
  ⭐⭐ **It is the ladder's first MIDDLE rung**, and that is what makes it different from the trill it
  copies: it READS `occupiedBands` (what the dynamics line and the trill took) *and* writes its own
  claim, because tempo is outside it. `tempoLinePass` is where the read came from.
  ⭐ **§1 rule 2 is built and TESTED as the opposite of its neighbours**: the bracket stops at the
  last NOTEHEAD's right edge, not at the end of that note's duration — so `spanX` searches the
  covered bars BACKWARDS for the last drawn head, and the e2e says out loud that it exists to fail
  the day someone makes the three families consistent.
  ⭐ **Verified, not remembered**: every SMuFL codepoint was read out of the table VexFlow itself
  ships (`build/esm/src/glyphs.js`) — `ottava` E510, `quindicesima` E514, `ventiduesima` E517,
  `octaveParensLeft/Right` E51A/E51B. ⭐ Unlike the trill's `(tr)`, the parens here are the glyphs the
  spec provides *for this*, so none of `trillStyle`'s second-font / italic / raise apparatus is needed.
  ⚠️ **One rule had to be added that the plan did not foresee: `OTTAVA_MIN_LINE`.** A continuation
  fragment carrying `(8)` is wider than the single notehead it may cover on that system, so rule 2 put
  the line's end LEFT of the numeral — and the bracket drew a numeral, no horizontal and (under rule
  3) no hook, leaving the reader nothing saying where the displacement stops. A fragment carrying the
  span's END is now never shorter than one space past its numeral. ⭐ It is the one place the drawing
  knowingly overruns rule 2, and only where obeying it exactly would leave the statement unclosed.
  *Proved by*: `e2e/ottava.e2e.ts` (11) + `OttavaRenderer.ladder.test.ts` (10); unit **3324**, browser
  **137/137**, `build:check` clean.
  ⚠️ **Break-tested five ways**, each failing only its own assertion: the `bandOver` read deleted (the
  8va lands on the trill), rule 2 reduced to the notehead's LEFT edge, the hook drawn on every
  fragment, the continuation flag forced false, and the side hard-coded to `above`. ⚠️ The ladder test
  uses a note four ledger lines up for `e2e/ladder.e2e.ts`'s reason — over staff-resident music the
  floors alone produce the right order and the test would prove the constants, not the mechanism.
  ⭐ **The width/shape-key question, answered out loud** because
  `reference_render_width_key_vs_shape_key` requires it of every engraved element: **neither key
  gained a row** — settled in P1 as `MEASURE_RENDER_ROLE.ottavas = 'ignored'`, and the e2e checks the
  half that could rot (adding an 8va moves no notehead). ⚠️ If any part of the bracket is ever drawn
  *inside* a measure group, that stops being true.
  ⚠️ **Owed to his eye, all taste**: `OTTAVA_LINE` (0.5 / 2.5), `OTTAVA_GLYPH_SIZE` 26,
  `OTTAVA_DASH_LENGTH`/`GAP` (0.5 / 0.4), `OTTAVA_HOOK` 0.8, `OTTAVA_MIN_LINE` 1.0 — and **§7.4, the
  bare numeral**: Gould's `8` is drawn, where Sibelius and MuseScore default to `8va`/`8vb`. One row
  of `OTTAVA_NUMERAL_GLYPHS` to change.
  ⭐ `MusicEngine.addOttava` / `removeOttava` / `getOttavas` landed here as one-line delegations,
  because the drawing needed a door to be testable at all. ⛔ Still NO `createOttava` — *which notes
  did the user mean* is P5's question, and answering it early would give the palette and the stamp
  two different answers.
- ✅ **P4 — EDITING. BUILT 2026-08-13.** `{ kind: 'ottava'; id }` is the **17th** `SelectedElement`
  (as predicted), `interactions/elements/ottava.ts` is its module, and both tables gained their row.
  ⭐ **The two `assertNeverElement` sites did their job**: adding the union member broke
  `selectionSnapshot` and `shortcutWiring` at compile time, which is exactly the guarantee they are
  there for — neither was found by reading.
  ⭐⭐ **The `ELEMENT_HIT_ORDER` position is load-bearing here in a way no other row's is.** Every
  other pair in that array is a tie-break that may never fire; this one overlaps by CONSTRUCTION —
  the ladder draws the 8va directly above the trill it clears, so their bands are stacked and a press
  near the `tr` is inside the ottava's padded band. The inner mark wins (the slur's standing rule),
  and `ottava.test.ts` asserts the adjacency itself rather than trusting `chain.test.ts`'s list.
  ⭐ **Two differences from the trill it copies, each a rule rather than a preference:**
  - **The hit-test must answer on CONTAINMENT, not proximity.** The bracket's ink is a numeral and a
    *dashed* line, so most of its band is empty — a distance-to-ink rule would make the gaps between
    dashes cold, and nothing tells the reader where those are.
  - **The highlight paints BOTH kinds of ink.** It is the only selected element that does: the
    numeral and its continuation parens are `<text>` that must be FILLED, the dashes and the hook are
    `<path>`s that must be STROKED. The trill recolours text only; the hairpin stroke only.
    ⭐ **Amended 2026-08-19:** it paints in the ELEMENT ink (`selectionColors.ELEMENT_SELECTION_FILL`,
    the dynamic's and the tempo mark's), ⛔ no longer voice 0's. An ottava has no voice, and voice 0's
    blue was still a VOICE colour — it said "this belongs to voice 1" about a mark that transposes
    every note under it. The rule: a voice colour is for ink that BELONGS to one voice's notes, which
    the trill is (its auxiliary is a step above THAT pitch) and a region-governing mark is not.
  ⚠️ **Delete has the biggest audible consequence of any kind in that switch**, and it is written at
  the site: removing the bracket leaves the written pitch alone, so the passage drops back an octave.
  That is what storing written pitch MEANS, not a surprise to guard against.
  ⭐ The Properties report carries the derived SPAN and the shift in SEMITONES beside the stored
  object, for the trill's reason: `shift` alone answers neither "which music" nor "how far".
  *Proved by*: `interactions/elements/ottava.test.ts` (7, incl. the chain-adjacency assertion) +
  the updated `chain.test.ts`; unit **3331**, browser 137/137, `build:check` clean.
  ⚠️ **Break-tested two ways**: the ottava moved BEFORE the trill in the chain (both specs go red),
  and the containment test dropped so only proximity answers (the gap-between-dashes press goes cold).
- ✅ **P5 — ENTRY. BUILT 2026-08-13.** `MusicEngine.createOttava` + `ottavaOps.addOttavaOverNotes`,
  `{ kind: 'ottava'; shift }` in the `MarkingTool` union + its `false` row in
  `MARKING_TOOL_USES_ARMED_LENGTH`, `interactions/ottavaStamp.ts`, and **two** `dev/linePalette.ts`
  rows (`8va` / `8vb` — the cresc./dim. pair's arrangement, so they light and swap independently).
  ⛔ No `GHOST_DRAWERS` row, no `ToolGhost` member, no shortcut (§7.9) — all three as planned.
  ⭐⭐ **AMENDED 2026-08-17, TWICE, both his calls — the ghost row and the shortcut are now BUILT**,
  with the planned version kept above so it cannot creep back:
  - **A NUMERAL GHOST** (*"now the 8va and 8vb, same thing, we should show the ghost for stamp"*).
    `engine/rendering/OttavaGhost.ts` + a `GHOST_DRAWERS` row + `{ kind: 'ottava'; shift }` on
    `ToolGhost`, drawn through the pass's own (now exported) `drawOttavaNumeral`. ⭐ **This is the
    tool a ghost helps most**: `8va` and `8vb` are two palette rows differing in ONE signed number,
    so behind a blue caret they armed identically and the only way to tell was which button was lit.
    The SHIFT therefore travels — E511 and E513 are different glyphs. ⛔ The BRACKET is never
    previewed: a dashed line has a length the click has not picked. The tool also leaves
    `scoreCursorClass`'s blue-pointer list.
  - 🚨 **…and the ghost's POSITION must not come from the mark's.** The first build parked `8va`
    above the pointer and `8vb` below it, mirroring where each line is engraved: *"the position of
    the ghost 8vb in relation with the pointer is different than the position of ghost 8va — this is
    not good."* A cursor ghost is ONE indicator and its position is how the eye finds it; the
    direction is the GLYPH's to state. Both now park through `engine/rendering/ghostCursor.ts`, the
    accidental ghost's position, which is his stated reference for the whole family
    (`docs/pedal-plan.md` §7 carries the rule in full).
  - ⭐ **THE ATTACHMENT GUIDE** — a selected bracket draws the dashed line to where it is anchored
    (the fifth kind on the kind-agnostic guide, `docs/dynamic-offset-plan.md`). Two edits:
    `drawOttava` registers it on the FIRST fragment, and the `ottava` row in `ELEMENT_SPECS` calls
    `applyAnchorGuideLine`. ⭐⭐ **Its far end is a PLACE, not a note** — an octave line governs a
    REGION (§4's clef-shaped statement), so it belongs to no single pitch, unlike a trill whose
    auxiliary is computed from one. ⭐ **And the SIDE follows the shift**: an 8va's guide runs down to
    the staff's TOP line, an 8vb's up to the BOTTOM one, each leaving the numeral's ink on the side
    facing it. ⛔ At the BEGINNING only (the hairpin's rule): a bracket's extent is already ink, and a
    continuation `(8va)` is a reminder rather than a second attachment. Measured in
    `e2e/anchorGuide.e2e.ts`.
  - **`x` FLIPS A SELECTED OTTAVA'S DIRECTION** (*"we should use shortcut x to switch 8va to 8vb when
    selected"*) — `ottavaOps.toggleOttavaDirection` NEGATES the shift, so a `15ma` flips to `15mb`
    and never to `8vb`: the signed number is the whole statement. ⚠️ It COMMITS (audible: an ottava's
    shift is what the covered notes sound) where the trill's branch of the same key only records
    undo. ⭐ The key's handler became a TABLE at the same time — `interactions/flipSelection.ts`,
    six branches in `shortcutWiring` having been one `if` away from seven. ⛔ Still no shortcut that
    ARMS the tool; §7.9 stands.
  ⭐⭐ **The one thing P5 found that the plan had not said out loud: THE LANE IS A STAFF.**
  `createSlur` / `createHairpin` / `createTrill` all narrow a selection to the first note's
  `(staff, voice)` and drop the rest. `createOttava` must not — a selection across two voices of one
  staff is ONE line covering both, or half the selected music stays where it was under a bracket
  drawn over all of it. ⚠️ **Found by break-test, not by reading**: the voice filter could be added
  and the entire suite stayed green, which is why `MusicEngine.createOttava.test.ts` exists.
  ⚠️ A second break-test found the same hole in the palette rows (the two-row switch-not-disarm rule),
  hence `PaletteController.ottava.test.ts`.
  ⭐ `createOttava` also fetches the engine in the CREATE branch, not up front — `createHairpin`'s
  rule, whose comment explains it: arming and disarming touch no score, so an up-front guard makes
  the tool unarmable without one. (⏭️ `createTrill` still guards up front; harmless in the app,
  untestable outside it.)
  *Proved by*: `ottavaStamp.test.ts` (10), `MusicEngine.createOttava.test.ts` (9),
  `PaletteController.ottava.test.ts` (7), + `addOttavaOverNotes` in `ottavaOps.test.ts`.

## ✅ HIS EYE, 2026-08-13 — the taste that was owed, and what it changed

The numbers P3 shipped as first cuts went to his eye the moment P5 made an ottava reachable. Five
calls, each recorded at the constant it set:

1. ⭐⭐ **§7.4 ANSWERED — `8va` / `8ba`, not the bare numeral.** *"unicode for ottava alta should be
   `\uE511`… for bassa should be `\uE513`."* SMuFL `ottavaAlta` / `ottavaBassaBa`. ⛔ This overrules
   Gould, deliberately: her argument is that the suffix is redundant because the side and the hook
   already say the direction. He wants it, and Sibelius/MuseScore agree. ⭐ `8ba` is still one of her
   own four forms — the bare numeral was rejected, not the vocabulary — and it is ⛔ NOT `8vb`
   (E51C), the one form her list excludes.
   ⚠️ **It made `OTTAVA_NUMERAL_GLYPHS` SIGNED**: alta and bassa are different glyphs, so the sign
   is now part of the lookup. The ±2/±3 rows are extrapolated from his two picks, not his call.
2. ⭐ **AIR BEFORE THE HOOK** (`OTTAVA_END_AIR`) — *"we should add air after the end of the note…
   im talking about the hook."* The hook is a vertical stroke turning toward the staff at the span's
   end; flush against the notehead it puts a line beside the note it is meant to enclose. ⭐ It
   SOFTENS §1 rule 2 rather than breaking it — half a space is still "at the last note"; what stays
   refused is running on to the barline.
3. ⭐ **ITALIC continuation parens** — *"lets try the parenthesis of the continuation in italic."*
   ⚠️ **This forced the glyphs to change and the trade is real**: `font-style: italic` on a music
   font does nothing (no italic face — `trillStyle`'s recorded lesson from his *"no italic"*
   report), so the parens are now TEXT in the serif stack. That gives up SMuFL's `octaveParensLeft`/
   `Right`, which aligned with the numerals BY CONSTRUCTION; `OTTAVA_PAREN_SCALE`/`_RAISE` now do by
   hand what the font did for free. ⏭️ Reverting is three constants.
4. ⭐⭐ **THE LINE'S Y IS PER SIDE** — two reports, and the second corrected the first. Mirrored
   (`baseline + raise`) it was *"too low"*, which was a REAL BUG: a glyph grows the same way from its
   baseline on either side (`markBand` says so), so the 8vb's line hung under its own numeral.
   Un-mirrored, both sides became identical — **measured: 8.06 px above the baseline, 0.442 of the
   ink box, on both** — and then *"now the line for ottava bassa is too up."*
   ⭐ So it is not mirroring at all: **the bracket closes TOWARD the staff**, so an 8va's hook turns
   down and its horizontal runs along the numeral's TOP, while an 8vb's turns up and its horizontal
   runs along the numeral's FOOT. `OTTAVA_LINE_RAISE_ABOVE` / `_BELOW`.
5. ⭐ **THE CONTINUATION SITS FURTHER LEFT** (`OTTAVA_CONTINUATION_INSET`) — *"the x position of the
   continuation is more to the right than i expected."* ⚠️ Cause: `planSlurSegments`' left edge is
   `noteStartX`, i.e. after the clef and meter — right for a SLUR (an arc resumes where the music
   does) and wrong for a REMINDER, which is read before the first note. Now shifted left of the
   music and clamped at the bar's own left edge so it can never reach the clef.
   ⏭️ **The TRILL's `(tr)` has the identical defect** — `trillStyle` claims its label sits "at the
   system's left edge" and it is really at `noteStartX` too. Not touched; worth carrying over.

⏭️ **Still open after his pass**: `OTTAVA_PAREN_SCALE`/`_RAISE` (0.52 / 0.22, borrowed from the
trill and not yet tuned against `8va`, which is a wider mark than a `tr`), `OTTAVA_CONTINUATION_INSET`
(2.0), `OTTAVA_LINE` (0.5 / 2.5), the glyph size, the dash pattern, the hook, the min line — and
⭐⭐ **§7.3, which only real music can answer**: pressing 8va over a high passage currently leaves the
noteheads and lets it sound higher (Sibelius's). Dropping them an octave so the sound is unchanged
(Dorico's) is one loop inside the same `runBatch`, and `MusicEngine.createOttava.test.ts` carries the
assertion that would have to change.

---

## ✅⭐⭐ P7 — THE TWO ENDPOINT SQUARES (2026-08-17, BUILT)

Four asks in one afternoon, and the shape is the HAIRPIN's (`docs/dynamics-line-and-hairpins-plan.md`,
the 2026-08-17 sections): **one pair of squares, and the ARMED SQUARE decides.** Same blue, same sizes,
same Tab walk, same registry-is-the-list rule.

| gesture | needs | changes | where |
|---|---|---|---|
| `Ctrl+Shift+←/→`, drag the RIGHT square | that square armed | which notes are displaced | MODEL (`length`) |
| `Ctrl+Shift+←/→`, drag the LEFT square | that square armed | ditto, holding the end | MODEL (`beat` + `length`, one write) |
| `←/→` fine, `Ctrl+←/→` coarse | a square armed | that end's ink, horizontally | `ottavaOffset.startX` / `.endX` |
| `↑/↓` fine, `Ctrl+↑/↓` coarse | **either** square armed | the WHOLE bracket's height | `ottavaOffset.y` — ⭐ ONE number |
| `Ctrl+Backspace` | a square armed | that end's `x` **and** the shared `y` | — |

### ⭐⭐ 1. The handle's y is a MEASURED field, not the band's midpoint

`ElementInfo.ottavaAxis {y, startX, endX}`, written by the renderer. A wedge's square is the midpoint of
its two arms, so its drawn outline suffices; the ottava's `points` are the **numeral's ink box**, and the
dashed line does not run down its middle — it rides the numeral's TOP under an 8va and its FOOT under an
8vb (`OTTAVA_LINE_RAISE_ABOVE`/`_BELOW`). Band-midpoint is **dead right above the staff and 0.75sp wrong
below it**: a bug that reads as one-sided and is really a missing measurement. The spec's first case is
an 8vb whose band is byte-identical to an 8va's.

### ⭐⭐ 2. Three offset numbers, not two pairs — because the bracket is a straight line

> *"take into consideration that ottava is a straight line, so offset in y should result in offset the
> two points in y."*

`OttavaOffsetOverride` has `startX`, `endX` and **one** `y`. ↑ from either square lifts the numeral, the
dashes and the hook together — not because the writer keeps two numbers in step, but because **there is
nowhere to put a second**. ⛔ The hairpin's per-end `{x, y}` is right THERE precisely because tilting a
wedge is a legitimate shape; copying it here would be two numbers able to disagree about a quantity the
notation only has one of.

⚠️ Zeros are **pruned on write** (a divergence from `setHairpinEndpointOffset`, forced by the shared `y`):
a purely horizontal nudge computes `y = 0`, and storing that zero makes the OTHER square report a nudge
of its own, so `Ctrl+Backspace` there would answer instead of falling through.

### ⭐⭐ 3. The two ends snap to DIFFERENT EDGES

`spanX` draws the numeral at the first covered notehead's **left** edge and the hook at the last one's
**right** edge (§1 rule 2 — the opposite of the wedge, whose tips are both left edges). So the drag
measures the start against left edges and the end against right ones. One edge for both would track the
cursor at one end and lag it by a notehead at the other — the hairpin's *"it jumps before x mouse reach
the target"* arriving by a new route.

⚠️ The drag has **two** cases where the wedge needs three: a bracket ends ON its last notehead, so every
address a drag can name is a covered slot. ⛔ Do not port `setHairpinEndBeforeSlot`.

### 🚨 4. The bug his hand found within the hour — and the rule it produced

> *"I cannot offset the right side from a limit"* — with a log showing `numeralX` frozen at 350.0 while
> the ask ran on to −45 spaces.

Cause: `Math.max(piece.x0 − inset, barLeft)`, a clamp that exists to stop the **automatic** continuation
inset reaching back onto the clef, was applied to the hand's nudge as well.

⭐⭐ **A machine's guess is worth clamping; the engraver's own instruction is not.** Both x nudges now land
AFTER every automatic decision — and after the CUT, so a cosmetic pixel cannot re-fragment a bracket by
moving which system it begins on. The one floor that still overrules the hand is `OTTAVA_MIN_LINE`,
because a bracket too short to close is not a drawing.

⚠️ **The e2e case for it is mostly FIXTURE**, and the first version proved nothing: an 8va in bar 1 starts
nine spaces right of the barline (the clef and meter push the first note along), so a six-space nudge
never reached the clamp and the test passed against the broken code. His score had the bracket on a later
bar, two pixels off the barline.

⚠️ The outer limit — off the **page** — is not this file's: see `docs/engraving-overrides-plan.md` §8, the
family-wide rule that refuses the write rather than clamping the drawing.

### 5. The rest of it, briefly

- The lane for every extent edit is the **STAFF, every voice** (the pedal's rule, ⛔ not the hairpin's):
  an octave line has no voice, so stepping one voice's onsets would displace notes the key never passed.
- The press on a square is a **PRE-STEP** in `MouseController`, not a row in `ELEMENT_HIT_ORDER`: the
  bracket sits on the ladder directly above what it clears, so a square lands inside a trill's or a
  tempo mark's box — both ahead of `OTTAVA_ELEMENT`.
- The ladder claim stays on the **un-nudged** baseline (`HairpinRenderer` files its own the same way): a
  hand nudge is the engraver overruling automatic placement, and making it shove the tempo mark would
  turn one deliberate move into a cascade nobody asked for.
- ⏭️ **Not built:** Properties rows for the three offsets, and a whole-bracket move with nothing armed.

---

## ✅⭐⭐ P8 — THE OFFSETS IN PROPERTIES, and the VERTICAL's two meanings (2026-08-17, BUILT)

His ask: *"now we need to be able to edit the offset of the two points in properties."* Modules:
`bus/ottavaGeometrySelection.ts` + `interactions/OttavaGeometryController.ts` +
`PropertiesWidget.buildOttavaOffsetRows` — the hairpin end rows' arrangement exactly.

### ⭐⭐ THREE rows, not two points

`start x (sp)` · `end x (sp)` · `vertical (sp)`. ⛔ Copying the wedge's `start (x, y)` / `end (x, y)`
would offer two verticals for a mark that has ONE, and the two boxes could then disagree about it. The
panel's shape is the model's, and that is how a reader learns the rule.

⭐ **0 is the automatic position**, so the boxes show `0` rather than a blank *auto* — unlike the
wedge's MOUTH, whose automatic is a computed width no single number stands for. `reset` therefore
publishes 0 and the model's zero-pruning drops the entry; there is no `null` case on this seam.

### ⭐⭐ The vertical is stored one way and shown another — both on purpose

Two of his corrections landed on the same number and pulled in opposite directions. Both are right,
and the conversion between them is one negation.

| | meaning | why |
|---|---|---|
| **stored** (`OttavaOffsetOverride.outward`) | distance **FROM THE STAFF**; `+` = further out | ⭐⭐ `x` flips an ottava's direction, and the side is DERIVED from `shift`. With a screen-signed field, flipping an 8va you had nudged clear of the music turns that nudge into a shove **toward** it. Stated as a distance, the intent survives the flip. |
| **shown** (the `vertical` box) | screen; `+` = **UP**, always | ⭐⭐ *"For me, increasing the number is go up and decreasing go down always… the arrow of the properties should reflect the movement on screen."* A typed box has no arrow on it to say which side of the staff you are on. |

⚠️ So the displayed number **flips sign when the bracket is flipped**, which is honest: the ink really
did move to the other side of the staff.

⚠️ **Exactly three places convert, and each is an edge that genuinely speaks screen** — the RENDERER
(negates above the staff), the PAGE LIMIT (needs a screen delta to predict where ink lands), and the
KEYBOARD (`↑` must lift on both sides). Everything else — seam, controller, model, JSON — reads
`outward` as written.

🚨 **Every pre-existing test used an 8va, where the conversion is the identity**, so all of them passed
with it deleted. The 8vb cases in `PropertiesWidget.ottava.test.ts` and `e2e/ottava.e2e.ts` are the
ones that bite.

### The rest

- ⭐ The typed value goes through **`nudgeOttavaEndpoint`** (absolute → `next − current`), never
  straight to the compartment — that is what puts the panel behind the same PAGE LIMIT as the arrows
  (`docs/engraving-overrides-plan.md` §8). ⛔ A controller writing the override itself would be a
  second door past that gate.
- ⚠️ Both branches (an end, and the vertical) are two `return`s, so they need **two** refusal cases: a
  break-test that dropped only the vertical branch's guard passed the end's case untouched.
- ✅ **The whole-bracket move landed too** — see below. ⏭️ Still not built: a Properties row for the
  EXTENT (deliberately — it is measured in notes, and a staff-space box would be a second, lossy way
  to say it).

### ✅⭐⭐ Nothing armed, and the arrows move the whole bracket

His last ask of 2026-08-17, and the wedge's arrangement verbatim: **something armed → that end moves;
nothing armed → the whole bracket does.** One chord, read by what you picked. `Ctrl+Backspace` with
nothing armed drops every nudge.

🚨🚨 **It is NOT `setHairpinOffset` with a different name, and this is the trap.** The wedge's
whole-move calls its per-end setter twice with the SAME `{dx, dy}` — right there, because each of its
ends owns a separate `y`. Here the vertical is ONE shared field, so passing it to both calls applies it
**twice**: the bracket jumps a double step while the horizontal beside it, which really is per end,
looks perfectly correct. `setOttavaOffset` passes 0 on the second call, and a spec case pins exactly
that.

⭐ The gestures COMPOSE, like the wedge's: nudge one end, then move the whole thing, and the model
holds exactly that (pinned).

⚠️ **The `!ottava.endpoint` gate has exactly one observable case**, and it took a break-test to find:
while the armed branch answers, the chain short-circuits and the gate is never consulted. It matters
when the armed branch **DECLINES** — which the page limit makes it do at the edge of the paper.
Without the gate, pressing into that edge would stop moving the end and silently start moving the
whole bracket instead.

---

## ✅⭐⭐ P9 — THE LADDER REORDERED, below the staff (2026-08-17, BUILT)

The research correction in §1 rule 5 / §5, acted on. Order below the staff is now
**trill → ottava → dynamics → pedal → tempo**; above it, unchanged.

### ⭐⭐ It was NOT the hoist this plan predicted

§5 said the fix meant hoisting the renderer above the measure loop, because `planDynamicsLines` runs
there. Wrong, and the reason is worth keeping: **an octave bracket's VERTICAL is pixel-free.**
`baselineFor` and `ottavaFragmentClaim` read the layout's columns and absolute beats — never
`staveNoteMap`, never `measureBounds`, never a `stave`. Only `spanX`, i.e. the DRAWING, needs pixels.

So the height splits off cleanly and the drawing stays where it was. `OttavaBandPlacement` and
`TrillBandPlacement` are named for what they LACK, and they are `DynamicsPlanPlacement`'s shape
exactly — the three passes ask the same question of the same data, one rung apart.

- `planTrillBands` → `planOttavaBands` → `planDynamicsLines`, all above the measure loop. **Those three
  lines ARE the ladder.**
- `planDynamicsLines` gained the READ it was always given the argument for. Its own comment used to
  say *"Nothing reads it yet."*
- ⛔ `renderTrills` / `renderOttavas` now **read a plan and file no claim**. Recomputing would read the
  dynamics' fresh claims and push the mark back outside — the exact bug being fixed.

### ⚠️ The trill had a hole nobody had noticed

The trill is innermost and reads nothing, so its claim's TIMING never mattered — it filed while
drawing, long after the dynamics were planned. Harmless while the dynamics read nothing; the moment
they did, it meant **the dynamics did not clear trills at all**. So the trill's split is not tidying:
it is what makes that true for the first time.

### ⭐⭐ The fixture is most of the work, and the first one proved nothing

⚠️ **An 8va is ABOVE the staff and dynamics default BELOW it — the two never compete.** Every existing
ottava and ladder case stayed green through the reorder for that reason alone. Gould's own p. 102
figure is an ottava *bassa*, and so is the new test.

⚠️ **And it must be LOPSIDED.** The first version used uniformly low notes: both families then compute
the same big ink band, and the dynamic lands outside because its own clearance is larger — it passed
with the dynamics' read DELETED. The fixture is now one very low note at the start of the bar, which
only the bracket spans, and the dynamic on staff-resident music at the end, where its own ink would
leave it near its 2.1 floor.

### The two things I expected to break and which did NOT

Recorded because a tidy story here would be a lie, and both are traps for the next person:

- **`OTTAVA_LINE.minFromStaff`** (2.5 → 1.5). Predicted to go silently backwards with the rung.
  Break-tested with 2.5 restored: **the order still comes out right**, because the dynamics now read
  the bracket wherever its floor puts it. The floor stopped deciding the order on the day it stopped
  needing to. 1.5 is kept as the coherent value for the new rung — taste, owed to his eye.
- **A double claim from `drawOttava`.** Predicted to push everything outward. It cannot: it runs after
  `planDynamicsLines`, and a duplicate is the same band, which merges to itself. ⚠️ So that `⛔` in the
  code has **no test behind it** — the suite will not stop someone re-adding it.

⏭️ **Still not built: Gould's whole-system exception (p. 29)** — an extension line spanning a full
system goes outside everything after all, with only tempo and pedal beyond it, because a dotted line
across the whole width visually cuts off what is past it.

---

## ✅⭐⭐ P10 — THE INTERPOLATING WALK on both squares (2026-08-21, BUILT)

His ask: *"so i suppose now we have to do the ottava keyboard walking"*. `←`/`→` (¼ space) and
`Ctrl`+`←`/`→` (1 space) on an armed square now move that end's INK, and once the ink reaches the next
onset of the lane THAT END OF THE BRACKET goes with it. The fifth family to get the gesture, after
the slur, the dynamic/tempo pair, the hairpin and the trill, and it arrives by the wedge's own rule:
**a handle that has BOTH a re-anchor and an offset owes the walk that joins them.**

The arithmetic is `interactions/markWalk`'s, untouched. New modules, ⛔ no per-kind slice anywhere:

- **`interactions/ottavaLane.ts`** — where the bracket's lane was DRAWN, extracted from
  `elements/ottavaHandles.ottavaDragTargetAt` so the mouse and the keyboard measure ONE list.
  ⭐⭐ The two ends read DIFFERENT EDGES of an onset (numeral left, hook right — §1 rule 2).
- **`interactions/ottavaWalk.ts`** — the port, twice.
- **`interactions/markBreakWrap.ts`** — the wedge's cross-system WRAP, **extracted** from
  `hairpinWalk` (its four rejected cuts and all) so the bracket could port into it rather than copy
  it. Hairpin and ottava both go through it; its 48 wedge tests were the safety net and never moved.
- **Model:** `ottavaOps.nextOttavaEndSlot` / `nextOttavaStartSlot` / `ottavaEndSlot`, split out of the
  two stepping ops so the plain arrow walks onto the slot `Ctrl+Shift+←/→` jumps to.
  ⭐⭐ `ottavaEndSlot` is the LAST COVERED slot — where the hook is drawn — ⛔ never `beat + length`,
  which overshoots it by that note's own duration.

### 🚨 THE LEFT ANCHOR PUSHES THE RIGHT, and the right RE-ANCHORS

His rule, and his diagnosis: *"probably the problem is a conflict between left anchor and right
anchor; when the left anchor push the right anchor then the right anchor should reanchor"* — **only
where they meet**, never otherwise.

What it replaced was a REFUSAL inherited from the wedge (*a beginning may not reach its own end*), and
the refusal did not merely stop the gesture, it **killed it**: `markWalk.carryMark` stops at the first
stop the model declines, so every further press became pure ink. His score: the bracket parked on one
note at `beat 1, length 1` with `startX` run out to **63 staff-spaces**, the square off the page — and
the cross-system wrap dead with it, because the stop being refused is on THIS system and the wrap is
only ever asked about the next one. One refusal, three symptoms.

### 🚨🚨 THE PAGE LIMIT WAS BEING ASKED THE WRONG QUESTION

Two reports, both fixed in `engine/layout/pageBounds` + `MusicEngine.spanEndStaysOnPage`, and now
shared by **ottava, hairpin and trill**:

1. **A DEADLOCK.** *"im traying to go back and is not possible"* — `nudgeFitsOnPage` judges EVERY drawn
   box of the element and translates them ALL by the step, so a span hanging off the left AND the
   right refuses `←` (the left-hanging piece grows) and `→` (the right-hanging one). An endpoint press
   moves ONE EDGE; judging that edge (`edgeStepFitsOnPage`) ends the deadlock with no new rule.
2. **AN UNREACHABLE HANDLE.** *"the issue was the endpoint that was out of the page"* — ink stopping
   exactly at the sheet's edge leaves its SQUARE beyond it. The step is now measured where the square
   is: `SPAN_HANDLE_ROOM_PX` (16 = the 10 px of daylight + the square's half-side).

### ⛔ And NO ink limit of its own

⭐⭐ **The offset is FREE.** A system-ink limit was tried and rejected in one line: *"you are restricted
the ottava offset to the measure, the user should be able to offset it at will"*. The only stop is the
page's edge, above. ⚠️ The same limit was removed from the WEDGE and the TRILL on the same day
(*"the trill and the hairpin offset left endpoint is also limited to the first measure after the time
signature, the user should not have that limit"*) — their rightward stop stays, since a trill's ink
folds and there has to be a line left to fold onto.

### ✅ …and the DRAG walks too (2026-08-21, same day)

*"now lets do the drag walking"*. `dragOttavaEndpoint` — the same ports over `markWalk`, with the
drag's own three differences and nothing else:

- **No undo per frame** (`previewOttavaEndpointOffset` / `…Rebase` + `commitOttavaDrag` on the drop),
  so a drag and N presses over the same distance leave ONE state rather than two that look alike.
- ⭐⭐ **The LATCH is ON** — the ink stops dead at offset zero of the onset it is nearest in the
  direction of travel, because a bracket's ends are AIMED at a notehead's edge. 🚨 And the frame
  REPORTS what the latch dropped, in pixels: the caller holds its cursor anchor back by that much, or
  the ink falls behind the hand a little at every stop and never catches up.
- ⭐⭐ **The HAND decides where the line ends** (`markBreakWrap`'s cursor arrival), and a WRAP ENDS THE
  GESTURE — the end is a line away and the hand is not.

⭐⭐ **BOTH AXES** (*"now for the drag we have to make the y offset"*, same day) — and they are
different kinds of move, which is the point of making them in one gesture: the horizontal walks that
end through the MUSIC, the vertical is plain ink. ⚠️ **The `y` moves the WHOLE bracket** whichever
square is under the hand — a wedge's square tilts its wedge, an octave line is a straight rule with
ONE stored vertical, and nothing in the code enforces that: `OttavaOffsetOverride`'s shape does.
⚠️ `dragOttavaEndpoint` is where SCREEN becomes OUTWARD-from-the-staff, the drag's twin of the
conversion `shortcutWiring` makes for the keys, and for the same reason (§P8: a stored screen `y`
inverts itself when 8va↔8vb flips). ⭐ The lift survives a crossing; a frame that WRAPS spends itself
on the wrap and drops its `dy`, as the wedge's does.

🚨 **AND THE VERTICAL IS LIMITED BY THE BAND** — his report the moment it worked: *"we should not go
crazy, we have to limit the user somehow here in the y so the ottava is on the system it belongs
to"*. ⛔ Not a new rule: that is the sentence that produced `layout/systemBand` for the SLUR and then
the WEDGE, and the bracket simply had no vertical drag to be judged until now
(`MusicEngine.ottavaEndpointOffsetAllowed`). The switch falls **halfway to the neighbouring staff**,
⛔ never at its lines, and ink already outside may always come back. ⚠️ Each FRAGMENT is judged
against its OWN system's band — a bracket cut by a break has pieces on two staves, and one staff's
neighbours say nothing about the other's. ⚠️ The keyboard's `↑`/`↓` and the whole-bracket move go
through the same gate, so the two devices cannot disagree about what is allowed.

⛔ `ottavaDragTargetAt` and its y-translation are **DELETED** — the snap the walk replaced, the wedge's
own having gone the same way a day earlier. Its spec chapter went with it (its claims live in
`ottavaLane.test.ts` and `ottavaWalk.test.ts`). ⚠️ The PEDAL still snaps and still carries that
y-translation; `pedalHandles` now names the walk as the other way out.

### ✅⭐⭐ …and the BODY walks (2026-08-21) — the arrows with NO square armed

*"now we have to do the shape key walking (when no endpoint is selected)"*. `walkOttavaBody`, the
third port in the file, and it differs from the two squares in exactly one thing that matters:

⭐⭐ **THE FAR END IS NOT HELD.** A square RESHAPES the bracket — the other end stands still and the
extent changes; the body MOVES it — the extent travels with it (`ottavaOps.setOttavaAtSlot`, which
⛔ does not touch `length` at all). That is the whole difference between the two gestures, and the
break-test for it is to give the body a square's write and watch the length collapse.

- ⭐ Its stops are the BEGINNING's, because a bracket moved as one is moved by its beginning.
- ⭐ Its ink is BOTH ends at once (`nudgeOttava`), and the offset it reads back is the start's, since
  the pair carry the same number while the bracket is moved as one.
- ⚠️ AUDIBLE at the crossing and only there; every press either side of it is ink.
- 🚨 It crosses a system break by the same WRAP (`markBreakWrap`), measured from the beginning's own
  system.

### ✅⭐⭐ …and the BODY is DRAGGED, which is how it changes SYSTEM (2026-08-21)

*"now we have to do the shape drag walking… we also have to take into account the y, that means that
we can jump system vertically"*. A press on the numeral or the dashed line now drags the whole
bracket (`dragOttavaBody`; the bracket had no body drag at all before, only its two squares).

⭐⭐ **TWO KINDS OF VERTICAL, and that is the design.** Within its own staff's room the `y` is plain
INK — the shared height, bounded by the band. Past halfway to the neighbouring staff there is nothing
continuous to travel through, so coming down onto the staff below is a **JUMP**
(`interactions/markSystemJump`, the dynamic's, the tempo mark's and the wedge's rule). ⭐ The two meet
exactly: the band refuses the ink at the same halfway line the jump fires on.

- ⛔ **A jump ENDS THE FRAME** (not the gesture): the anchor has moved, so this frame's `dx` would be
  spent against a slot the hand was never near. The hand may carry straight on down there.
- ⭐ It arrives where the ENGRAVER would put it — both axes of the offset go, the height because on
  that gesture it was never a lift but the distance travelled to reach the other staff.
- ⛔ **THE SIDE NEVER FLIPS.** A wedge dragged off its staff belongs above it: it has a `placement`.
  An octave bracket's side is DERIVED from its `shift`, so turning an 8va into an 8vb is a change to
  the MUSIC (`toggleOttavaDirection`, audible) and a drag may not make it by accident. ⚠️ This is the
  one place the bracket's drag deliberately does LESS than the wedge's.
- ⛔ No latch: a whole bracket is placed by eye, not aimed at one note's edge.

⚠️ `ELEMENT_SPECS`' ottava row gained the arm callback (`armOttavaOffsetDrag`), the wedge's and the
trill's twin — a press is *click = select, drag = move*, decided by the chain on the first move.

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

## ✅🚨🚨 P11 — THE CROSS-SYSTEM WRAP WAS MEASURING THE WRONG SYSTEM (2026-08-21, FIXED)

P10's wrap was hand-confirmed on a single-staff score and then failed on a real one. His report, on a
TWO-STAFF, sixty-four-bar file: *"cross system doesn't work at all"* — for the bracket, the wedge AND
the pedal at once, while the trill (which folds its ink instead of wrapping) was fine. His own
diagnosis was right about the trigger: *"maybe because in this score we have multi staves"*.

### ⛔⛔ A staff's TOP LINE y does not name a system

`ottavaSystemInkLimit` (and its two copies) answered *"where does this system's music end"* by
unioning the x-extent of **every bar in the score whose staff-0 top line matched**. Every bar of one
system shares that y — true — but **so does the first system of every page**, and a two-staff score
fills pages fast. So:

- `here.max` came back with a bar on another sheet. His log wrapped with a gap of **128 staff-spaces**
  and landed the bracket at **−117**, which is the *"the ottava is jumping and not walking"* he saw.
- two systems on different pages compared EQUAL, so the press that should have wrapped went on
  nudging ink — the *"doesn't work at all"* half.

### ⭐⭐ A system is the CONTIGUOUS RUN of bars that share the row

`markBreakWrap.systemInkAt` — ONE function, and the three lanes (`ottavaLane`, `hairpinLane`,
`pedalLane`) now delegate to it instead of each carrying a copy of the bug. It grows outward from the
bar asked about while the row matches, and **names the system by the first bar of that run**
(`SystemInk.key`, replacing `top`). Contiguity is exactly what the y alone cannot say: the bars
between two same-y systems belong to lines in between, so the walk outward stops at the break.
⚠️ An undrawn bar ends the run — conservative in the safe direction.

### ⭐ Two more things the same report produced

- **A blocked press still crosses** (`markWalk.crossWithoutArrival`). The wrap's arrival test asks the
  ink to reach the line's last ink, and the PAGE limit refuses it a space or so before that — a
  system's music ends within a space of the sheet's margin — so the gesture died exactly where it
  should have wrapped. Now the press spends itself on the anchor: the wrap where the stop is on
  another system, the ordinary hand-over where it is on this one.
- **The one silent decline in `markBreakWrap` says itself** — *"the stop is on THIS system"* with the
  system's name. It was the only one of six that logged nothing, and *"cross system doesn't work at
  all"* could not be told apart from a wrap that fired and did nothing. ⚠️ It de-duplicates: it is on
  the hot path, and a `dbg` is a real `console.log` in dev (see render-performance-plan §12.1).

---

## ✅ The `8va` on the FIRST system can be lifted again (2026-08-21)

His report: *"why am I not able to move the 8va up?"*, on the top system of a two-staff score, with
`"outward": 1.5714` already stored and every further press refused.

⛔ Not the bracket's own rule — the BAND limit (`layout/systemBand`), which on a side with no staff
used to invent an allowance instead of asking the page. Measured: ceiling y 40, the bracket's ink
already at y 27.84, so it began outside its own limit and every step outward "made the overhang
worse". `ottava.e2e.ts`'s two vertical-nudge cases had been red since that rule arrived.

⭐ The fix and its reasoning live in `docs/slur-endpoint-offset-plan.md` §"The rule
(`engine/layout/systemBand.ts`)" — one question per side, *staff or the edge of the sheet* — since
that is the document the band rule belongs to. What is worth recording HERE is why the bracket found
it: the above-staff ladder draws an `8va` further from the staff than the invented allowance reached,
so this family hit the wall first and hardest.

🚨 **Still true, and it is a spacing question**: `MIN_SPACING_ABOVE_AT_PAGE_TOP = 0` presses the first
system against the top margin, so an `8va` there has ~2.8 staff-spaces of lift before it is off the
paper. Two browser cases (`ladder.e2e.ts` a tempo lift, `slur.e2e.ts` a rigid curve move) ask for more
than that and are red for that reason — the limit is telling the truth about the air that exists.

## ✅⭐⭐ THE OTHER HAND OF A GRAND STAFF IS A LANDING (2026-08-21, BUILT) — the LAST of the five

His ask, closing the family: the dynamic, the wedge, the trill, the pedal and now the bracket. Same
report throughout — `markSystemJump.systemStopFor` has always chosen between **painted staves**, so
the other hand was in the running and simply had no candidate on it: the mark won the vertical
question there, lost the horizontal one for want of anything to anchor to, and carried on to the
system below.

- `ottavaLane.ottavaStaffLaneOnsets` — every onset of **every** painted staff, each naming its staff.
  `ottavaSystemSlotFor` hands the shared rule this instead of the bracket's own lane. ⛔ The sideways
  walk is untouched.
- `ottavaOps.setOttavaAtStaffSlot` — `setOttavaAtSlot` plus the `staffId`, looking the landing onset
  up on the TARGET staff (`staffOnsets` with that id). `MusicEngine.previewOttavaStaffSlot` is its own
  method: `previewOttavaSlot` is also the body walk's re-anchor, which has no staff to say.

### ⚠️⚠️ It is the most AUDIBLE of the five landings

A dynamic changes loudness, a pedal changes what rings — an octave line **transposes**. Every note
under the bracket sounds an octave away (`Ottava.shift`, written-vs-sounding), so moving it to the
left hand moves which notes are displaced. That is exactly what a user dragging it there is saying,
but it is not a cosmetic landing and the write says so.

### ⭐ The SHIFT does not change, so neither does the side

An 8va stays an 8va above whatever staff it lands on — the family's standing rule (*the side never
flips*; turning an 8va into an 8vb is `toggleOttavaDirection`, a change to the MUSIC the user asks
for by name). The wedge flips on a jump because it has a `placement`; this one derives its side from
`shift`, so there is nothing to flip.

### Settled decisions (the wedge's and the pedal's, verbatim)

- ⚠️ **The LENGTH rides along**; a span running past what the target staff carries is clamped where it
  is READ (`ottavaSpan`), never in the write.
- ⚠️ The first staff is stored ABSENT whichever spelling reaches the op, and a frame that changes
  neither staff nor address is refused.
- 🚨 **A candidate's band is its STAFF's, not its notehead's.** ⚠️ This exposed the same LIE in
  `ottavaWalk.test.ts`'s registry stub the wedge's spec had — `lineYPositions` was
  `[systemTop, 250, 260, 270, 280]`, a per-system top line with system 1's bottom under it, which is
  not a staff.

**The family is now complete**: all five outside-staff marks can be dragged onto the other hand.

---

## ✅ THE SQUARES GET THE SLUR'S HOLD (2026-08-22)

Two reports on one gesture, and they turned out to be two different things.

### 1. The lag was the RENDER, not the latch

Every SQUARE drag was still doing a full `renderScore()` inside `mousemove` — §12.5a had wired only
the BODY drags. All four (hairpin, ottava, trill, pedal) now call `previewMarks(family, id)`, and the
drop renders for real. See docs/render-performance-plan.md §12.5a for the measurement and for why it
read as the latch.

### 2. …and with the lag gone, the latch was too WEAK

*"i almost dont feel the latch now with the preview"* → *"we should make the latch stronger"*. A
latch pins the ink for exactly ONE frame (the next frame's `offset === 0` releases it by design), so
without the render lag masking it, it is nearly invisible.

⭐ **So the squares get the gesture the SLUR ENDPOINT already has** — extracted to
`interactions/dragHold.ts` rather than invented a second time: the hold absorbs cursor travel while
the anchor has the ink, and the catch-up hands every absorbed pixel back at the derived gain, so the
hand and the mark are level again by the next stop. The ratio (**0.8**), the cap (**30 px**), the
jitter guard and `G = 1/(1 − r)` are all his, tuned by hand on the slur in 2026-08-18;
docs/slur-endpoint-offset-plan.md §"The mouse" carries the sources and the reasoning, and ⛔ the whole
tuning sweep is recorded above the constant so nobody rounds it.

- ⭐ `carryMark` now reports `gapAhead`, measured AFTER the latch — ⛔ never the gap just crossed,
  which is the ratchet the slur already paid for once.
- ⚠️ What the latch dropped goes on the DEBT now, ⛔ not on the caller's cursor anchor: the catch-up
  hands it back, and doing both would pay it out twice. (That replaces the `lastX = x - droppedPx`
  repayment the four handlers used to do.)
- ⛔ **One ledger, reset when a square arms** — only one drag runs at a time, and a hold left over
  from the last gesture would swallow the next one's first pixels on a mark it was never taken for.
- ⛔ **The BODY drags take no hold**: they do not latch (`carryMark(…, latching = false)`). Stickiness
  belongs to a square, which is aimed at a note; a body drag is the whole mark being carried.
- ⏭️ The TEMPO mark's drag latches too and is NOT on the ledger — it is also the one latching drag
  that still swallows what the latch dropped instead of repaying it. Left alone deliberately.

### Tests

`dragHold.test.ts` — the ledger's conservation claim: a whole gap of cursor travel moves the ink a
whole gap and the debt closes at zero (the ratchet, pinned); mid-hold the ink has not moved at all;
turning back releases; a sub-pixel wobble does not; and no room to repay means no amplification rather
than a division by zero.
