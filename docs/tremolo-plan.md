# Tremolo: stamp, render, playback

A single-note tremolo — the strokes that ride a note's stem and say "repeat this note, this
finely". Six marks in the palette: one to five strokes, and the **Penderecki** sign.

It is the sibling of the accidental stamp (`docs/accidental-stamp-plan.md`) — read that first;
this doc records only where a tremolo differs. It differs a lot in two places: VexFlow draws no
Penderecki sign and places its strokes wrong for us, and nothing in the playback schedule can express
a speed that is *physical* rather than metrical — see §4 and §5.

**Status: ALL TEN PHASES ARE SHIPPED** (§7) — the six marks exist, engrave, arm from the palette,
survive a meter change / paste / voice move / tie-split, play all three readings (measured as a real
subdivision, unmeasured at a physical rate that ignores the tempo, Penderecki irregular on top of
that), **can be clicked, selected, deleted, and read back off a selected note** (§9), can be armed for NOTE ENTRY so the notes you write are born wearing one, and can be added / changed / removed across a SELECTION from the palette (§10). Three things
this plan did not foresee, each recorded where it belongs: the stem became a registered element (§2, the stamp accepts a click on it — and P5
made it selectable in its own right), VexFlow's stroke placement had to be replaced rather than
configured (§4), and the Penderecki sign turned out to be the same modifier with a different glyph
rather than a draw of our own (§4).

**What is left is what §8 defers plus two open decisions** — the two playback numbers are still
constants rather than options, and Gould's "strokes stay within the stave" is unimplemented. Neither
is structural. (Decision 4, removal, is closed: §9.)

## 0. Three performances, not two

The mark has **three** readings, and conflating any two of them is how this feature goes wrong:

| reading | what the player does | how it is written |
|---|---|---|
| **measured** | repeats at a stated subdivision, in tempo | strokes, few enough to still mean a note value |
| **unmeasured** | as fast as the technique allows, **even**, out of time | *the same strokes*, once there are enough of them |
| **Penderecki** | as fast as possible and **irregular** — the speed itself varies | its own glyph (E22B) |

Two consequences run through everything below. First, **unmeasured has no glyph of its own here**:
it is written with ordinary strokes, so nothing in the model distinguishes it and the reading has
to be *derived* (§5). Second, **Penderecki is not just "unmeasured with a special sign"** — even
spacing is what an unmeasured tremolo has and a Penderecki one does not, which is why they need
separate playback rules and only one of them needs a random number generator.

### The SMuFL inventory, and our three names for one glyph — ✅ FIXED (P2)

```
E220–E224  tremolo1…tremolo5          combining strokes
E22A       buzzRoll                   buzz roll
E22B       pendereckiTremolo          "Penderecki unmeasured tremolo"
E22C/E22D  unmeasuredTremolo          "Wieniawski unmeasured tremolo" (+ a simpler form)
```

We used to draw E22B in two places and call it three things: the dev palette titled it "Penderecki
tremolo", while the Keypad named the same glyph `buzzRoll` — with E22A, the actual buzz roll, and
E22C, the actual dedicated unmeasured sign, both unused.

Now all three agree on **`penderecki`**: the `TremoloMark` value, the dev palette's id, and the
Keypad's key-6 name. Each is named for what it DRAWS.

⚠️ Sibelius calls its own key 6 a buzz roll. If that is the key we want, **the glyph changes (E22A),
not the name** — which is decision 3 below, still open. E22A and E22C remain unused.

## The decisions still open

1. ~~**The unmeasured threshold.**~~ **ANSWERED: 4** — one higher than Gould's and Dorico's 3, so
   three total beams stays measured. See §5.
2. ~~**The unmeasured rate.**~~ **ANSWERED: 0.05 s (~20/sec)** — faster than Dorico's 0.1 and
   NotePerformer's 1/8, *because* the threshold is 4. See §5: the two are one decision.
   ⏭️ Both are wanted as **user options** eventually — §8.
3. **The sixth button's glyph** (§0) — E22B as now, or a plain unmeasured sign (E22C) with Penderecki
   as a seventh, or Sibelius's buzz roll (E22A). P2 made all three names agree on E22B; changing the
   answer is now a one-glyph edit in three places, not a rename.
4. ~~**Removal**~~ **ANSWERED (P6 + P9): Delete, or a re-press of the mark on the palette** — the
   first of §2's three options, arrived at in steps. P5 made the mark a registered `ElementType` a
   click selects; P6 wired Delete to `setTremolo(id, null)`; P9 made a palette re-press the toggle-off
   over a selection, which is the accidental's habit. See §9 and §10.
5. **Stroke placement, small tweaks.** §4's corrections got it to "much better". What is still
   unimplemented there is Gould's rule 3 (strokes stay within the stave). The two chosen proportions
   (¼ of the stem for a flag, ¼ space of clearance for the fit) are the tuning knobs. None of this is
   testable — it is an eye-only surface.

## 1. The model

One field on the slot:

```typescript
// on Chord (src/types/music.ts)
tremolo?: 1 | 2 | 3 | 4 | 5 | 'penderecki'
```

One field, one value. ⚠️ **But the measured/unmeasured split is NOT `typeof === 'number'`** — four
and five strokes are numbers and are never measured, and even three usually is not. The number is
*how the mark is written*; the reading is derived from it plus the note it rides (§5). Nothing is
stored for it, because nothing about the notation says it.

**Why the slot and not the pitch:** a tremolo is a property of the *event*, like `dots` and
`articulations`. A chord tremolos as a chord; "tremolo one notehead" has no representation, the
same call `dots` makes.

**Why the slot and not `Measure`:** fields *inside* a slot need no `MEASURE_RENDER_ROLE` entry —
`laneFingerprint` stringifies `lane.slots` whole (`MeasureWidthCache.ts:106`) and `measureShapeKey`
reuses that string verbatim (`MeasureRedrawKey.ts:136`), so redraw is correct for free. A
`Measure`-level field would have stopped the build until classified, and every wrong answer there
is silent (`reference_render_width_key_vs_shape_key`). Note this is *conservative*, not exact: the
mark costs no horizontal space, but riding in `slots` puts it in the WIDTH key too, so stamping one
recomputes a width that cannot have changed. Cheap, and the safe direction.

**Rests refuse it.** You cannot tremolo silence, the same way `setBeam` refuses a rest.

**Not in `Score`.** Nothing global — a tremolo is positional by construction.

## 2. The stamp

A marking tool exactly like the accidental stamp: **single-valued and idempotent**.

```typescript
| { kind: 'tremolo'; tremolo: TremoloMark }   // MarkingTool, src/interactions/EditorState.ts:46
```

- **Single-valued**, so pressing a different tremolo button **swaps** the armed mark rather than
  stacking it (articulations are the additive one; a note has one tremolo).
- **Idempotent**: stamping the mark a note already carries does nothing.
- **Refused targets**: rests, empty space, non-notes. A no-op that still consumes the click,
  because the tool is armed.
- **No ceiling, and none is needed.** An earlier draft refused a stamp whose total beams were
  unplayable (five strokes on a 32nd). The threshold in §5 makes that unreachable: past it nothing
  is scheduled as a subdivision at all, so there is no absurd note value to guard against. The
  refusal was also unenforceable — shortening the note afterwards re-creates the same combination
  with no stamp in sight.

Six seams. ⚠️ **Only two of them are named by the compiler**, so the other four are the ones that
get forgotten:

| # | seam | compiler? |
|---|---|---|
| 1 | `MarkingTool` + `MARKING_TOOL_USES_ARMED_LENGTH.tremolo = false` — `EditorState.ts:46,110` | ✅ the Record is exhaustive over kinds |
| 2 | `RenderController.renderToolGhost()` — one `case` — `RenderController.ts:265` | ✅ `assertNeverTool` (`:298`) — the ONLY site it guards |
| 3 | `ScoreModel.setTremolo` + the `MusicEngine` facade method | ❌ |
| 4 | `PaletteController.pressTremolo()` (was `armTremolo`, until it stopped only arming — §10) — **reassign** the field, never mutate (the Proxy traps the SET) | ❌ |
| 5 | `MouseController.stampTremoloAtClick()` — a near-copy of `stampAccidentalAtClick` (`:1903`): same note-body test, one `runBatch` = one undo entry. **Plus the stem** — see below | ❌ |
| 6 | `GHOST_GROUP_SELECTOR` (`VexFlowRenderer.ts:449`) — see §3 | ❌ |

### ⭐ The one stamp with TWO targets — and the `'stem'` element it needed

Every other stamp accepts the notehead alone, because that is where its mark lands. A tremolo's
strokes ride the **stem**, so that is where the pointer goes; insisting on the head would mean aiming
at one place to put ink in another. The head test runs first and unchanged; the stem is the second
chance.

That required the stem to become a **fact** rather than a guess. A note registers a box that spans
head + stem + beam on purpose (`tight-bbox-plan.md` §4a), so from outside "which side is the stem on,
how far does it reach" is only *inferable* — and inference gets the beamed and multi-voice cases
wrong. VexFlow knows exactly, so it is now written down: `'stem'` is an `ElementType`, registered by
`VexFlowRenderer.registerStem` from `getStemX()` + `getStemExtents()`.

- **One per slot**, anchored on the chord's lowest pitch — the convention its articulations and dots
  already use. A chord has one stem.
- ⚠️ **It carries `noteId`, never `id`.** `getById` returns the FIRST element with a given id, so a
  stem sharing its notehead's id would answer a lookup for the NOTE with a tall rect — silently, and
  only sometimes, depending on registration order.
- The rect stores the **ink** (`Stem.WIDTH`, ~1.5px); the click pad lives in the hit-test
  (`STEM_CLICK_PAD`). A stemless note registers nothing.
- ⚠️ `findStemAt` is **containment, not nearest** — which is the whole reason to register it. A click
  at the top of a stem is a stem-length from its own notehead, so `findClosestNoteOrRest` hands back
  a denser neighbour. Pinned by a test that asserts exactly that disagreement.
- Registered AFTER the beams are drawn, so a beamed stem's extension is in the rect.
- Free bonus: the stem's click target grows with the flag stretch of §4, because both read
  `getStemExtents()`.

`MARKING_TOOL_USES_ARMED_LENGTH.tremolo = false`: it marks notes that already have their length.

The dev palette's ids are `'one'…'five' | 'penderecki'` (`devToolbar.ts`); wiring **maps** them to
`1…5`, it does not rename them — the Keypad borrows the same drawings by those names.

### ⚠️ P0 can stamp a mark it cannot remove — SHIPPED THAT WAY, ✅ CLOSED BY P5+P6

"Removal is the Delete key" is the accidental stamp's rule and it works there because `'accidental'`
is an `ElementType` (`ElementRegistry.ts:18`) — the glyph is selectable, so Delete has something to
delete. §8 defers `'tremolo'` from `ElementType` *and* defers the Keypad, which leaves Ctrl+Z as the
only way to undo a stamp. The three options were:

- **register the `ElementType`** (the mark becomes clickable, Delete works, consistent with every
  other stamp) — still the recommendation;
- or **wire the Keypad key first** and let it toggle off a selected note's mark;
- or **accept it** and say so here, out loud.

**P0 shipped on the third**, deliberately and not by omission: Ctrl+Z removes a stamp and nothing
else does. `ScoreModel.setTremolo(id, null)` already exists and is unused, so whichever of the first
two lands has its model half waiting for it.

✅ **P5 + P6 took the first option, whole** (§9): `'tremolo'` is an `ElementType`, a click selects the
mark, and Delete removes it through `setTremolo(id, null)` — the call that sat written and unused
since P0. In two steps because they are two different problems: P5 was a hit-test (what did I click,
given the mark sits on the stem), P6 a keybinding on a selection that by then existed.

## 3. The ghost

`renderScoreWithArticulationGhost` (`VexFlowRenderer.ts:3890`) is the recipe, verbatim: a
throwaway `Stave` + `StaveNote`, `setStave` then `Formatter.format` (the modifier's `draw()` reads
both), draw **only** the modifier into an `openGroup`, measure the bbox, translate to the cursor,
paint it ghost blue at 0.7.

The ghost is the **real mark**, not the palette's picture — the palette draws a note wearing its
strokes because a button needs to be recognisable; the ghost draws what the click will actually
add. Since P2 it takes the {@link TremoloMark} rather than a stroke count, so strokes and the
Penderecki sign go through one modifier and the preview cannot disagree with what gets engraved.

⚠️ **Add the group to `GHOST_GROUP_SELECTOR`** (`VexFlowRenderer.ts:449`). `clearGhosts()` removes
only what is listed there; a group that is missing is never taken down, and the ghost smears a
trail of strokes across the score as the pointer moves.

⚠️ **Where it differs from every other stamp ghost:** `Articulation` positions itself off the
notehead, a tremolo off the stem. The mark therefore lands far from the group origin the other ghosts
assume — and further still now that the placement is ours (§4) rather than VexFlow's tip anchor. The
bbox-translate step absorbs that on purpose: it measures where the glyphs ACTUALLY landed and moves
the whole group from there, so the offset never has to be known.

⚠️ `openGroup` silently prefixes `vf-` (pass the bare name), and `closeGroup()` goes in a
`finally`.

## 4. Render

**The strokes** — `CenteredTremolo`, our subclass of VexFlow's `Tremolo`, attached in `NoteBuilder`
beside the articulations (`NoteBuilder.ts:269`). Read
`node_modules/vexflow/build/esm/src/tremolo.js` before touching this; it is fifteen lines and three
of them matter:

- It draws **N copies of `tremolo1` (E220)**. It never uses E221–E224. `CenteredTremolo(2)` *is* the
  two-stroke mark — the multi-stroke SMuFL glyphs are for the palette only.
- It anchors the stack to `getStemExtents().topY` — the stem **TIP** — and steps toward the notehead
  at a fixed 7px. There is no centring in it, and it **does not lengthen the stem**.
- ⚠️ **Whole and half notes.** A `StaveNote` always carries a `stem` object even when `hasStem()`
  is false, so a whole note will not throw — the strokes simply draw where an invisible stem would
  be. That is roughly the convention, and it is the first thing that will look wrong: check it by
  eye before assuming VexFlow got it right, because §5's table puts tremolos on whole notes.

Nothing here depends on the measured/unmeasured reading — the strokes are the strokes. That split
exists only in playback.

### ⚠️ Where the strokes actually go — four corrections, every one found by eye

None of these is visible in a test: jsdom cannot measure glyphs, so a placement assertion passes
vacuously. (The one thing here that *is* testable is the bounding box — see the trap below.)

The tip anchor leaves one or two strokes clinging to the top of the stem, which is what the subclass
exists to fix. Each step below was a separate wrong-looking render, in this order:

1. **Centre on the stem, not the tip.** Lay the stack symmetrically about the stem's middle. Only the
   vertical anchor is ours; the step between strokes, the x, the font size and the glyph stay
   VexFlow's.
2. **`renderText` positions the BASELINE, not the glyph.** So centring the baselines is not centring
   the ink — E220's baseline→ink offset shifts the whole stack down. Measured from `textMetrics`
   (`setFontSize` FIRST: it is what invalidates the cached metrics, where VexFlow's own
   `this.fontInfo.size = …` mutates the object behind the getter and does not). When the text canvas
   is unavailable the metrics come back zeroed and the correction is 0 — i.e. the failure mode is
   exactly what a hardcoded 0 would have done, which is why measuring beats a tuned constant.
3. **`getStemExtents().baseY` is the notehead's CENTRE, not its edge** — it comes from the note's key
   lines, and a key line runs through the middle of a head. Centring on it counts the head's top half
   as if it were stem and sits half-a-half-notehead low. The free stem starts at
   `baseY − stemDirection · staffSpace/2`, and the stave's own `getSpacingBetweenLines()` IS that
   measurement (a notehead is one staff space tall), so it holds at any staff size.
4. **The stem is sometimes too short for the strokes at all** — and it takes two different stretches
   to fix, one for a flag in the way and one for a stack that simply does not fit. Both are Gould's
   rule 2; see the table below, which is where the numbers live.

⚠️ **Neither stretch can be applied at build time.** `hasFlag()` reads `!this.beam`, and the Beam
objects do not exist when `NoteBuilder` attaches the modifier — so every note *about to be beamed*
still claims a flag there; the fit check needs formatted stem extents for the same reason. Both run in
the post-format/pre-draw window beside `applyNoteOffsets`, which
is also after the multi-voice stem re-assert (that calls `setStemDirection`, which resets the
extension). And it bumps the **Stem's own extension**, not `setStemLength`: that one writes
`stemExtensionOverride`, which `StaveNote.getStemExtension()` re-reads and then adds its
octave-distance term to — double-counting for a note far from the middle line. Adding to what the
Stem already resolved composes with VexFlow's flag-height, beam and octave rules instead of replacing
them, so a 32nd gets ¼ on top of the longer stem VexFlow already gave its taller flag.

### The conventions, and which of them we follow

⚠️ **Centring is OUR rule, not Gould's** — do not let it read as convention. *Behind Bars* (the
tremolo section, ~p.224–226) says three things about placement:

| | Gould | us |
|---|---|---|
| 1 | with **one or two strokes** it is clearest if they **centre on stave lines** | approximated — centring lands near a line without snapping to one. Note she singles out exactly the counts the tip anchor got worst |
| 2 | **extend the stem** so the strokes are clear of tails and beams | done, in the TWO shapes below. She gives no number for either |
| 3 | the strokes stay **within the stave** | ⛔ not implemented — a high stem-up note can put them outside |

### The two stem stretches (Gould's rule 2)

Separate rules with **opposite** treatments of the strokes, which is why they are separate numbers:

| | when | how much | do the strokes follow? |
|---|---|---|---|
| **FIT** | the stack is taller than the usable stem | exactly the shortfall, plus `TREMOLO_STROKE_CLEARANCE` (¼ space) at each end | **yes** — the stem grew *because they did not fit*, so they spread into the new room |
| **FLAG** | a flag hangs into the stack | `TREMOLO_FLAG_STEM_STRETCH` (¼ of the stem) | **no** — they stay, which is what turns the whole stretch into clearance |

FIT is where the numbers come from measurement and only the clearance is chosen: `strokeStackHeight`
measures the glyph, `usableStemSpan` the stem. It fires on notes with **no flag and no beam** — a
plain quarter offers ~30px from notehead edge to tip and four or five strokes need ~33, so the
overflow is not a flag problem at all. FLAG fires on a lone eighth/16th/32nd. A flagged note that
also overflows gets both, and the strokes compensate for only the flag half.

⚠️ A BEAMED note is included and **the beam follows**: `Beam.postFormat` has not run at that point
(`Formatter.postFormat` is skipped — we format without a `stave` option, so beams post-format inside
`Beam.draw`), so `calculateSlope` reads the lengthened tip, shifts the whole beam out, and
`applyStemExtensions` lands every stem in the group on the new line. Moving the beam for the whole
group is correct: a beam is one line.

### 🚨 A modifier that draws at explicit coordinates corrupts its NOTE's bounding box

The one bug in P0 that reached the user, and the only part of this render that a test can hold.

`StaveNote.getBoundingBox()` **merges every modifier's box**, and `Element.getBoundingBox()` is built
from `this.x`/`this.y`. `Articulation`, `Accidental` and `Dot` all do:

```js
this.x = x; this.y = y; this.renderText(ctx, 0, 0)
```

VexFlow's `Tremolo` is the one that does **not** — it calls `renderText(ctx, x, y)` and leaves `x`/`y`
at zero. So a tremolo note's box got dragged back to **x = 0**, and that is the box
`registerSlotElements` stored for the note.

⚠️ **What it broke, and why it was invisible.** Nearly every hit-test uses `headX`, which stayed
correct — plain selection, `findClosestNoteOrRest`, `hitsNoteOrRestBody`. But
`handleModifierMouseDown` measures from `bbox.x + bbox.width / 2` (`MouseController.ts:662`), so
**Ctrl/Shift-click on a tremolo note** measured to a point halfway across the system, failed its
`distance < 30` check, and returned `true` — consuming the click and doing nothing. Multi-select
simply stopped working on tremolo notes, silently, with no console trace.

The fix is to follow the house pattern; `renderText` adds `x`/`y` back, so the drawn pixels are
identical. `CenteredTremolo.test.ts` pins it, and those tests were checked by reverting the fix.

⚠️ **Still a live trap for whatever comes next.** P2 dodged it by accident rather than by care: the
Penderecki sign went through this same class, which by then already set `x`/`y`. Any NEW modifier that
draws itself at explicit coordinates inherits the bug — set `x`/`y` and render at the origin, and
check the note's registered bbox rather than just the pixels.

**Penderecki** — ✅ DONE (P2), and *not* the way this plan expected. It guessed we would draw E22B
ourselves at coordinates we computed, the way ties and slurs are drawn
(`reference_vexflow_lowlevel_render_methods`). By the time P2 arrived, `CenteredTremolo` had already
earned four placement corrections, two stem-stretch rules, a ghost and a bounding-box fix — so a
second drawing path would have had to remember all of them.

Instead it is **one glyph in a stack of one**: the same modifier, constructed from the
{@link TremoloMark} itself, with `num = 1` and the text swapped for E22B:

```ts
constructor(mark: TremoloMark) {
  super(typeof mark === 'number' ? mark : 1)
  if (mark === 'penderecki') this.text = PENDERECKI_TREMOLO
}
```

Everything downstream reads "the stack" and gets the right answer with no special case — including
`strokeStackHeight`, which measures whatever glyph is set, so the taller sign asks for its own stem
room by itself. The `typeof === 'number'` guards in `NoteBuilder`, `applyTremoloStemStretch` and
`RenderController` existed only to keep an undrawable mark off the screen, and are gone.

⚠️ The codepoint is written out and pinned by a test. VexFlow's `Glyphs` map is not re-exported, so a
lookup resolves under Vitest and is `undefined` in the browser — silently.

⏭️ Worth an eye: E22B renders at the same `Tremolo.fontSize` as a stroke, and it is an intrinsically
taller sign, so it may want its own scale.

No new `ElementType` in P0 unless §2's removal decision says otherwise. (P5 added one — §9.)

## 5. Playback — ✅ DONE (P3), except rule 3's jitter

`collectScheduledNotes` (`src/engine/audio/playbackSchedule.ts`) is pure, Tone-free and
unit-tested. It is the right seam: one `ScheduledNote` becomes N.

**The two numbers, as chosen.** Both were open decisions, and the second is not independent of the
first:

| | value | why |
|---|---|---|
| `UNMEASURED_THRESHOLD` | **4** | one higher than Gould's and Dorico's 3, so THREE total beams stays measured and the classic readings are played literally — three strokes on a quarter, two on an eighth, one on a sixteenth are all real 32nds, in tempo |
| `UNMEASURED_PERIOD_SECONDS` | **0.05** (~20/sec) | faster than Dorico's 0.1 and NotePerformer's 1/8, because it MUST beat the fastest measured reading |

⚠️ **They are ONE decision.** With the threshold at 4 the fastest measured reading is a 32nd — 16
attacks/sec at 120 qpm — so a physical rate at or below that would mean **adding a stroke makes the
note repeat more slowly**. A test asserts the relation, not just the numbers. Move the threshold down
to 3 and the constraint loosens; move it up and it tightens.

⚠️ Above roughly 150 qpm a written 32nd is itself faster than 0.05 s, so a measured tremolo out-runs
an unmeasured one there. That is a statement about the music, not a bug: taking a `min` with the
measured rate would put the tempo back into rule 2 and undo the whole point of it.

**One number decides which of the three rules applies:**

```
totalBeams = flags(duration) + strokes        // Penderecki has no strokes; it is always rule 3
```

`flags` = 0 for `w`/`h`/`q`, 1 for `'8'`, 2 for `'16'`, 3 for `'32'` — `durationFlags` in
`utils/durations.ts`, DERIVED from `DURATION_INFO` rather than tabulated (a flag is exactly "how many
halvings below a quarter"), so a `'64'` added to the table gets its 4 for free. Not
`CrossBarBeams.beamCountOf`, which computes a similar-looking thing but is private, answers 1 (not 0)
for a quarter because a beam group cannot have zero levels, and takes a slot rather than a duration.

This is the standard reading, not an invention: one total beam = eighths, two = 16ths, three =
32nds — which is why the Sibelius rule of thumb says *three* strokes on a quarter, *two* on an
eighth and *one* on a sixteenth all give 32nds. Dorico compares the same sum ("strokes + beam
lines") against its unmeasured threshold.

### Rule 1 — measured (`totalBeams < UNMEASURED_THRESHOLD`)

**Beams of the repeated note = the written note's own flags + the stroke count.** The mark says
how finely to subdivide, not how many notes to play.

| written | flags | + 1 stroke → | attacks |
|---|---|---|---|
| whole | 0 | eighths | 8 |
| half | 0 | eighths | 4 |
| quarter | 0 | eighths | 2 |
| eighth | 1 | sixteenths | 2 |
| sixteenth | 2 | 32nds | 2 |

A quarter and an eighth with one stroke both get two attacks — but the eighth's are **twice as
fast**, because the same two attacks fill half the time.

⚠️ **Compute a period, not a count**, and take the period from the **written** duration while
filling the **sounding** one:

```
period = soundingBeats(slot) / (writtenBeats(duration, dots) × 2^totalBeams)
```

Then lay attacks at that period across the note's full sounding length. This is not a refinement,
it is what makes the arithmetic exact in the three cases a count gets wrong:

- **Tuplets.** A triplet eighth with one stroke is 2 attacks over 1/3 of a beat — the musically
  right answer. Counting from the sounding duration gives 4/3 of an attack and forces an invented
  rounding rule. Read `actualDuration` for the sounding side; the written duration keeps its own
  flags.
- **Dots.** A dotted quarter with one stroke is exactly 3 eighths, and falls out for free.
- **Ties.** `collectScheduledNotes` suppresses a same-pitch tied continuation and extends the
  head's `durationBeats` (`playbackSchedule.ts:88-105`). The head's mark must therefore fill the
  whole extended length at its own period, and the continuation must not re-attack — which is
  exactly what "fill the sounding length" does, and is why §6 keeps the mark on both halves.

### Rule 2 — unmeasured (`totalBeams >= UNMEASURED_THRESHOLD`)

Even, fast, and **not a subdivision of anything**. A fixed *physical* repetition period, filled
across the note the same way rule 1 fills it — only the period comes from a constant instead of
from the note value.

⚠️ **Tempo independence is structural.** The collector works entirely in *beats*, and
`PlaybackEngine.play` converts to seconds through the tempo map (`PlaybackEngine.ts:211-215`). A
measured tremolo is correct in beats and *should* track the tempo. An unmeasured one must not: it
is as fast as the player can move, whatever the conductor is doing. Sibelius's well-known failing
is exactly this — it plays three strokes as measured 32nds, which sounds wrong the slower the music
gets.

It does **not** need a seconds-based escape hatch on `ScheduledNote`. `utils/tempoMap.ts` is pure
(`buildTempoMap:88`, `beatsToSeconds:149`, `secondsToBeats`), so the collector can take the map (or
build it) and convert a physical rate into beat onsets locally, staying Tone-free and testable —
one time base in the struct, as now.

### Rule 3 — Penderecki — ✅ DONE (P4)

Rule 2, plus the thing that makes it Penderecki: **the speed varies**. Irregular by definition, so
the onset spacing is jittered — and the velocity with it, since an even attack at a wobbling tempo
still reads as a machine. Rule 2 must stay strictly even; the jitter is what separates them.

The two rules therefore differ in **evenness, not speed**: `tremoloPeriodBeats` returns the same
number for both, and the caller jitters around it.

| | value | why |
|---|---|---|
| `PENDERECKI_ONSET_JITTER` | **±30%** of the period | audibly uneven without reading as a different rhythm — small enough that nobody hears a subdivision, large enough that nobody hears a machine |
| `PENDERECKI_VELOCITY_JITTER` | **±15%** of the dynamic | smaller on purpose: felt, not heard as an accent pattern |

The wobble is applied to the **step**, not as a nudge on fixed onsets — the gaps are what a listener
hears as irregular, and stepping by them cannot drift out of the note.

**Determinism.** `playbackSchedule.ts` is pure and its tests depend on that. A bare `Math.random()`
inside it gives a green suite that proves nothing about what you hear. It takes an injected
`rng: () => number` defaulting to `Math.random`; tests pass a seeded stub. Re-rolled per playback
(two performances of a Penderecki tremolo are not identical) — deliberate, not incidental, and it
falls out of `PlaybackEngine.play` calling the collector afresh.

⚠️ **A cycling seeded stub can alias against the draw order.** Each attack draws TWICE (spacing, then
velocity), so a stub cycling an even number of values hands every *step* the same draw and the
schedule comes out perfectly regular — which looks exactly like the jitter being broken. Use a small
LCG for "is it uneven?" and keep fixed cycles for pinning the extremes. The tests say so where it
matters.

## 6. What travels — and what silently does not — ✅ DONE (P1)

**JSON is free.** A slot field is serialized directly by `getScore()` / `exportJSON`. No
migration, ever.

**Everything else is an explicit field list, and there are three of them.** Anything not named is
dropped in silence — the hole `beamOver` fell into.

**Rebar + clipboard — five edits, not two.** Clipboard lanes *are* `RebarEvent[]`
(`interactions/clipboard.ts:40`), so paste rides along with rebar; a time-signature change uses the
same relay. Miss any one link and the mark vanishes:

| | |
|---|---|
| `rebar.ts:92` | `RebarEvent.tremolo` field |
| `rebar.ts:208` | slot → event |
| `rebar.ts:116` | `RebarPiece.tremolo` field |
| `rebar.ts:343` | event → piece |
| `rebarOps.ts:1179` | piece → `Chord` |

Confirmed rather than assumed: `clipboard.ts:433` and `rebarOps.ts:218` both go through the same
`flattenRegion`, so copy/paste really does ride the slot→event link with no separate edit.

**The voice move** (Alt+1/2). `ScoreModel.moveNoteToVoice` builds its own payload naming
`articulations`, `articulationStemAlign`, `beam`, `secondaryBreak`, and `insertPitch` re-applies each
one by hand at both the merge and the new-chord branch. Same hole, different file. ⚠️ At the MERGE
branch the destination chord keeps its **own** mark — a note has one tremolo, exactly the rule the
beam statement follows there.

**Tie-split across a barline**: both halves keep the mark — a tremolo interrupted at the barline is
still being played across it. ⚠️ **Not free.** `placeSpanningNote` builds every continuation from
`{step, alter, octave, voice, staff}` only; articulations are dropped there today. The head survives
because it is reused via `updateNote` (checked: it mutates the slot in place), and the tail is stamped
explicitly per piece. Only the duration-change caller can have a mark to carry — you cannot *enter* a
note with a tremolo, so a fresh head has nothing.

### ⭐ Every link is pinned, and each was proved load-bearing

`src/interactions/tremoloTravel.test.ts` — 8 tests. Unlike §4, this whole surface is testable, and it
is the one that fails **silently**: nothing throws, nothing logs, the mark is simply gone the next
time the bar is re-tiled. So each link was verified by removing it and watching the suite go red:

| link removed | tests failing |
|---|---|
| slot → event | 5 of 8 |
| event → piece | 5 of 8 |
| piece → `Chord` | 5 of 8 |
| voice-move new-chord branch | 1 of 8 |
| tie-split continuation | 1 of 8 |

⚠️ Do that check with an **inverse edit**, never `git checkout` — the edits under test are uncommitted,
and a checkout silently reverts all of them, which makes every later measurement in the run a
meaningless empty baseline.

## 7. Phases

- **P0 — model + stamp + stroke render. ✅ DONE.** `Chord.tremolo`, the `MarkingTool` kind, the six
  seams, the ghost, `CenteredTremolo` in `NoteBuilder`, and the dev palette wired to arm. End state
  reached: you can put one to five strokes on a note and see them. Two things it grew on the way that
  were not planned — the `'stem'` element the stamp's second target needed (§2), and the four
  placement corrections (§4). Two things it did NOT do: §2's removal decision (accepted as
  undo-only; P5+P6 closed it) and the Penderecki button, which shipped DISABLED because arming it
  would have stamped a mark that stores and never appears — P2 drew the sign and enabled it.
- **P1 — travel. ✅ DONE.** The five rebar links, the voice move, the tie-split (§6). Early, and on
  purpose: before P0's marks started silently disappearing on a meter change. 29 lines of code and 8
  tests, every link proved load-bearing by removing it.
- **P2 — Penderecki render. ✅ DONE.** E22B through the SAME modifier as the strokes (§4) rather than
  a second draw of our own, plus §0's naming fix. The dev palette's sixth button arms again.
- **P3 — measured + unmeasured playback. ✅ DONE.** `durationFlags`, the threshold, rule 1's period
  arithmetic, rule 2's physical rate and the tempo-map conversion. Both rules together, as planned:
  they share the fill and differ only in where the period comes from. 31 tests in
  `playbackSchedule.test.ts` — the whole of §5 is checkable because the collector is pure.
- **P4 — Penderecki playback. ✅ DONE.** The injected RNG and the jitter on onset *and* velocity.
  Nothing structural was left by then, as predicted: two constants, a variable step in the fill loop,
  and one extra optional argument.
- **P5 — selecting the mark (and the stem). ✅ DONE.** §9. Two `ElementType`s, two mouse handlers
  and two highlights; no model change at all, because selection is not a fact about the score. Went
  in stem-first on purpose: the stem is the surface the tremolo sits on, so getting *it* selectable
  is what makes the overlap rule between the two expressible.
- **P6 — Delete. ✅ DONE.** §9. One branch in `deleteSelected` calling the `setTremolo(id, null)` that
  had been sitting unused since P0 — decision 4, closed. Seven tests, driven through the real key
  wiring rather than the handler, because the risk was the branch ORDER and not the removal.
- **P7 — reporting the mark. ✅ DONE.** §9. A selected note lights its tremolo (the shared
  `colorNoteTremolo` pass), and the palette row reports the mark that is THERE rather than only the
  one that is armed (`tremoloHighlight`, three sources in a fixed order).
- **P8 — note entry armed with a tremolo. ✅ DONE.** §10. The mark's second gesture: the same palette
  buttons arm for ENTRY in entry mode and for STAMPING in selection mode, and the armed mark persists
  until deliberately changed. The engine half is one `NoteParams` field, so the note is born with the
  mark instead of being stamped a moment later — one undo entry, and the barline split carries it.
- **P9 — editing a selection. ✅ DONE.** §10. The last gap: a press over selected notes marks,
  changes or clears them (and over a selected MARK, changes or removes it) instead of arming a stamp
  for a note that is already right there. `armTremolo` became `pressTremolo` when it stopped only
  arming — five branches, the accidental's router.

## 8. Deferred, deliberately

- **Two-note (between-notes) tremolo.** A different notation with a different model — it belongs
  to a *pair* of slots, not one. VexFlow does not draw it either. (SMuFL's `tremoloFingered1–5`,
  E225–E229, are for that reading — and are NOT what it is drawn with; see the plan.)
  → **Planned: `docs/two-note-tremolo-plan.md`.**
- ~~**Selecting the mark.**~~ **✅ DONE (P5) — see §9.** `'tremolo'` is an `ElementType`, and so is
  the stem it rides. What is still deferred is *acting* on the selection (Delete, a Properties edit).
- **Both playback numbers as user options** (⏭️ wanted, not built). The threshold and the unmeasured
  rate should both become settable. Nothing blocks it: they are two named exports read in ONE place
  (`tremoloPeriodBeats`), and `collectScheduledNotes` already takes an optional second argument, so
  threading an options object through is a local change plus one call site in `PlaybackEngine`. Two
  things to decide when it happens, neither urgent:
    - **Where it lives.** Playback *interpretation*, not notation — so not a `Score` field by the
      positional rule (`project_score_globals_should_be_positional`) unless it is genuinely meant to
      travel with the file. Dorico keeps its equivalent in per-project Playback Options; our nearest
      precedent is `viewMode`, which the engine owns and never persists.
    - ⚠️ **They must stay COUPLED.** A UI that lets the rate be set at or below the fastest measured
      reading (a 32nd, at the current threshold) creates a score where ADDING a stroke slows the note
      down. Validate the pair, or derive the rate from the threshold — do not expose two free numbers.
- **Keypad wiring.** The page-2 tremolo keys are still `momentary` (`docs/keypad.md`). They arm
  the same `PaletteController.pressTremolo` when they are wired — nothing here blocks it, and since P2
  their names match the marks they draw, so the wiring is a lookup rather than a translation.
- **Properties.** Same shape as the beaming reset gap: worth a home, not worth one now.
- **Naming.** The palette says "second/third order"; this doc counts strokes, which is
  unambiguous. If the labels should read "two-stroke / three-stroke" instead, that is a one-line
  change in `devToolbar.ts`.

## 9. Selection — ✅ DONE (P5) — Delete — ✅ DONE (P6) — reporting the mark — ✅ DONE (P7)

Clicking a tremolo selects it; **Delete then removes it**; a selected note **lights** its mark and the
palette **says which one it is**. Clicking the stem it rides selects the **stem**, and nothing acts on
that yet. The mark became a thing the pointer can name, which is what
Delete, a stroke-count edit and a stem-length drag each need first.

### Stem first, on purpose

The tremolo is drawn ON the stem — the two overlap by construction, so "what did I just click" is the
only interesting question here, and it cannot even be *asked* until the stem is selectable. Hence the
order: stem (P5a), then mark (P5b).

The stem was already a registered `ElementType` (§2 — the stamp needed somewhere to aim), but pressing
it selected nothing: `hitsNoteOrRestBody` ignores the stem deliberately (its tall box is what made
selection feel over-eager), so the press fell through to empty-space handling and armed a
box-select/pan. P5 is the pointer half of a registration that already existed.

⚠️ **A press that used to pan from a stem now selects.** The only behaviour this took away.

### The rule: BOTH are ink, and the mark wins only inside its own boundaries

```
handleTremoloMouseDown  →  handleStemMouseDown  →  handleBarlineMouseDown  →  note / empty space
```

- Each handler stands down for a press the **notehead** owns (`hitsNoteOrRestBody` first), so neither
  can steal a click on the note. The head and the stem's lower end genuinely overlap; the head keeps
  that ground.
- The tremolo is asked **first**, and its hit-test is bare containment with **no click pad**
  (`findTremoloAt`). That is the rule, not an oversight: a pad would push the border out past the
  visible ink, so a click on bare stem *beside* the strokes would select the mark. Unlike a 1.5px
  stem, a stroke stack is already a target — a notehead wide, several staff-spaces tall.
- So the border between the two IS the edge of the strokes. On a two-stroke tremolo, which covers a
  fraction of the stem, everything above and below the strokes still selects the stem.
- The stem keeps its `STEM_CLICK_PAD` everywhere the mark is not, and stays **containment, not
  nearest** (§2): a click at a stem's tip is a stem-length from its own notehead.

Both are registered as **ink** rather than as targets, which is what makes the above expressible at
all — a stored click-target could not tell the two apart.

### ⚠️ The tremolo's rect is MEASURED, not `getBoundingBox()`

Every other modifier registers through `Element.getBoundingBox()`. For a tremolo that box is wrong
twice over: it describes **one glyph** (not the stack), anchored at `this.x` and extending one
**advance width** to its right — while a stroke's ink *straddles* the stem it is centred on. The box
would sit half a stroke to the right of what you see, and a click on the left half of the strokes
would fall through to the stem.

So `CenteredTremolo` records its own rect during `draw()` (`inkRect()`), from the ink extents either
side of the anchor (`actualBoundingBoxLeft/Right`) stretched over the `num − 1` steps the stack
marches through. During the draw because that is the one moment every input — stem extents, the flag
stretch it must not follow, the font scale — is settled; the same reason the placement arithmetic
lives there (§4).

⚠️ jsdom measures no text, so the rect is degenerate under test
(`reference_jsdom_cannot_measure_glyphs`). What the tests pin is the arithmetic that survives that:
it is null until drawn, it is centred on the stem, and it grows with the stroke count.

### The rest of the seams

| seam | note |
|---|---|
| `ElementType` `'tremolo'` + `registerTremolo` | one per slot, anchored on the chord's lowest pitch — like the stem, the dots and the articulations. ⚠️ carries `noteId`, never `id` (§2's reason) |
| `EditorState.selectedStemNoteId` / `selectedTremoloNoteId` | scalars beside the accidental/dot ones, cleared by `clearScalarSubSelections`, so every selection stays mutually exclusive |
| `HighlightController.applyStemHighlight` / `applyTremoloHighlight` | voice colour, like every other sub-element highlight |
| `utils/tremoloGlyphs.ts` | E220/E22B moved out of `CenteredTremolo`: the highlight finds the strokes **by glyph character** inside the note's group, and that side of the app has no VexFlow. Nearest-glyph matching would be wrong — the stack sits where a chord's upper noteheads are, and it is one rect over N glyphs |
| `selectionSnapshot` | `kind: 'stem'` / `'tremolo'`, locator + note, like the dot |

### Delete (P6)

One branch in `shortcutWiring.deleteSelected`, in the run of note sub-elements (accidental → dot →
**tremolo** → tie), calling `MusicEngine.setTremolo(id, null)` — written at P0 and unused until now.

- **The whole mark goes, whatever it was.** A tremolo is ONE value on the slot, so there is no
  "remove a stroke": changing 5 strokes to 4 is a different edit (stamp a different mark) and belongs
  to the palette, not to Delete. The Penderecki sign takes the same path, with no per-mark branch.
- **The note survives, and stays selected** — like the accidental and the dot above it, so stamping a
  different mark is one press away.
- **One undo entry.** `setTremolo` already committed (`'Remove tremolo'`); nothing new was needed.
- ⚠️ Tested through the REAL key wiring (`tremoloDelete.test.ts` dispatches a `keydown`), not by
  calling the handler: the removal is one engine call and cannot really break, while the branch ORDER
  can — a new arm of that chain is only reached if nothing above it claims the press. One test asserts
  the reverse direction too (a selected NOTE still deletes the note).

### Reporting the mark (P7)

Two halves of one idea — *the editor should show you the tremolo that is there*, not only the one you
are about to stamp:

- **A selected NOTE lights its tremolo.** `highlightNote` already lit head + stem + accidental +
  articulations + dots + tie; the mark joins that list, through the same `colorNoteTremolo` pass the
  selected-MARK highlight uses. One pass, two callers — the shape `colorNoteDots` and
  `colorNoteArticulations` already have.
- **The Tremolo palette reports it.** The row used to light only the ARMED mark, so it answered
  "what will the next click stamp?" and nothing else. `tremoloHighlight(state, engine)` in
  `interactions/keypadSync` — beside `durationHighlight`, single-sourced for whoever reads it next —
  answers from three sources in this order:
    1. a marking tool is armed → the armed tremolo if it IS the tremolo stamp, else null (under a
       clef tool no tremolo is in play);
    2. the MARK is selected on the score → that note's mark. Clicking the strokes clears the note
       selection, so without this the row would go dark on exactly the click that selected it;
    3. otherwise the single selected note's own mark.
  Live-read from the engine like the articulation / tie / beam-role highlights: a stamp, a Delete or
  an undo all change the mark without going near the palette.

### ⏭️ What P5/P6/P7 deliberately did not do

- **The Keypad's page-2 tremolo keys.** Still `momentary` (§8) — they neither arm, report, nor
  remove. Reporting is `tremoloHighlight` behind a `PaletteSelection`, and removing is the same
  `setTremolo(id, null)` from a different seam; both are wiring, not design.
- **Anything on a selected STEM.** Delete does nothing to one — there is no such edit — and a
  stem-length drag is the gesture that rect was really registered for.
- **The flag.** Still reserved as its own future element (`highlightNote` says so out loud).

## 10. What a tremolo-palette press does — ✅ DONE (P8, P9)

**The mark is FOUR gestures on one button.** It shipped as one — the stamp, which marks a note that
already exists — and the other three arrived as the flows that were missing: writing notes that
already have one, editing a selection, and editing the selected mark. `PaletteController.pressTremolo`
routes them, in this order:

| # | when | the press… |
|---|---|---|
| 0 | a marking tool is armed | swaps the armed mark / disarms on a re-press (a different tool → switch to the tremolo stamp) |
| 1 | a MARK is selected in the score | changes it — or removes it, on a press of the mark it already is |
| 2 | selection mode, notes selected | **adds / changes / removes** across the whole selection, one undo entry |
| 3 | selection mode, nothing to apply to | arms the STAMP, whose next click marks the note clicked |
| 4 | note entry | arms `EditorState.selectedTremolo` — every note you write is born wearing the mark, ghost included |

That is `setAccidental`'s router, branch for branch, and deliberately so: a note carries one tremolo
exactly as it carries one accidental, so the two should not need different habits. It is also why the
entry value is NOT a marking tool — a tool arms into entry mode and enters *no note*, the opposite of
what this does.

**One key adds, changes and removes.** Over plain notes, press 3 to mark them; press 5 to change
them; press 5 again to clear them. The toggle direction is decided for the selection AS A WHOLE (if
every selected note already carries this exact mark it is removed from all, else it is set on all), so
a MIXED selection levels up rather than half-clearing — `applyArticulationToSelection`'s rule, and the
same reasoning. Rests in the passage are skipped rather than refusing it: a passage is a mixture, and
you meant the notes in it.

### ⚠️ It persists

Entering a note does not clear it. Neither does a **duration press** — which does clear the accidental
and the dots, because those are decisions about one note, while "everything I write from here is
tremolo" is a mode you are in. Writing five tremolo notes is five clicks, not five clicks and five
re-arms. **Esc** (and the Select arrow) drops it, with the armed articulations it sits beside —
`clearArmedArticulations` owns that, and the argument in its doc comment applies unchanged.

The two orders arrive at the same place:

- *length, then mark* — pick a duration, press a tremolo → armed for entry (the table above);
- *mark, then length* — press a tremolo in selection mode (stamp armed), then pick a duration →
  `promoteStampToNoteEntry` carries the mark over, exactly as it already did for the accidental and
  the dot. The tremolo case there used to read "no entry-mode home"; it has one now.

### The seams

| seam | note |
|---|---|
| `EditorState.selectedTremolo` | the armed ENTRY mark; null = none. A note-entry value, beside `selectedAccidental`/`selectedDots` |
| `PaletteController.pressTremolo` | the router above. Single-valued in every branch: a re-press is always the toggle-OFF, a different mark always swaps |
| `PaletteController.applyTremoloToSelection` / `editSelectedTremolo` | the two selection-editing branches — twins of the accidental's, including what stays selected afterwards (a change keeps the mark selected, a removal leaves nothing) |
| `NoteParams.tremolo` → `ScoreModel.addNote` | the note is BORN with the mark: ONE undo entry, not entry-then-stamp. A pitch joining an existing chord marks that chord (the mark is a slot property, like the articulations beside it) |
| `placeSpanningNote` | an entered mark reaches EVERY piece of a cross-barline split, the same rule the head's mark already followed. Its "only the duration-change caller can have one" note is now false and says so |
| `GhostNote.tremolo` → the ghost draw | through the SAME `CenteredTremolo` the engraved mark uses, so the preview cannot disagree with what lands |
| `tremoloHighlight` | gained the armed entry mark as source 2 of 4 — gated on entry mode, since the mark outlives a trip into selection, where the row should answer about the SCORE |

⚠️ **A rest ignores it.** You cannot tremolo silence — the rest branch of `addNote` never reads the
field, and `Rest` has nowhere to put one.

## Sources

The notation and playback conventions above are not house rules:
[SMuFL Tremolos range](https://www.w3.org/2021/03/smufl14/tables/tremolos.html) ·
[Dorico: tremolos in playback](https://archive.steinberg.help/dorico/v1/en/dorico/topics/notation_reference/notation_reference_tremolos_playback_r.html) ·
[Dorico: tremolo playback duration](https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_tremolos_playback_duration_changing_t.html) ·
[Gould, *Behind Bars* p.224, via RPM Seattle on Sibelius tremolo playback](https://www.rpmseattle.com/of_note/improving-tremolo-playback-in-sibelius-6-7/) ·
[NotePerformer / Dorico settings](https://www.noteperformer.com/?page=support_dorico)
