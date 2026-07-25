# Tremolo: stamp, render, playback

A single-note tremolo — the strokes that ride a note's stem and say "repeat this note, this
finely". Six marks in the palette: one to five strokes, and the **Penderecki** sign.

It is the sibling of the accidental stamp (`docs/accidental-stamp-plan.md`) — read that first;
this doc records only where a tremolo differs. It differs a lot in two places: VexFlow draws no
Penderecki sign and places its strokes wrong for us, and nothing in the playback schedule can express
a speed that is *physical* rather than metrical — see §4 and §5.

**Status: P0, P1 and P2 are shipped** (§7) — all six marks exist, engrave and arm from the palette,
and they survive a meter change, a paste, a voice move and a tie-split. Three things this plan did not
foresee, each recorded where it belongs: the stem became a registered element (§2, the stamp accepts a
click on it), VexFlow's stroke placement had to be replaced rather than configured (§4), and the
Penderecki sign turned out to be the same modifier with a different glyph rather than a draw of our
own (§4).

**Next is P3 — playback. A tremolo is silent today**, which is now the only thing about it that is
plainly unfinished.

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

1. **The unmeasured threshold.** How many total beams (strokes + the note's own flags) stop being
   a subdivision and start being "as fast as possible"? Gould reports players assume unmeasured at
   **three**; Dorico's default minimum is **3** and it is a user preference. Ours starts as one
   named constant. Set it to 4 instead and three strokes stay measured — that is the whole of the
   old "three strokes on a half note" question, now a number rather than a special case.
2. **The unmeasured rate.** A physical speed needs a number. Dorico expresses it as a fraction of a
   quarter at 120 qpm — default **1/5** (0.1 s, ~10 attacks/sec); NotePerformer suggests 1/8
   (~16/sec). Nothing before P3 depends on it.
3. **The sixth button's glyph** (§0) — E22B as now, or a plain unmeasured sign (E22C) with Penderecki
   as a seventh, or Sibelius's buzz roll (E22A). P2 made all three names agree on E22B; changing the
   answer is now a one-glyph edit in three places, not a rename.
4. **Removal** — see §2. P0 shipped able to stamp a mark it cannot take off: Ctrl+Z only.
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
| 4 | `PaletteController.armTremolo()` — **reassign** the field, never mutate (the Proxy traps the SET) | ❌ |
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

### ⚠️ P0 can stamp a mark it cannot remove — SHIPPED THAT WAY, still open

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

## 3. The ghost

`renderScoreWithArticulationGhost` (`VexFlowRenderer.ts:3890`) is the recipe, verbatim: a
throwaway `Stave` + `StaveNote`, `setStave` then `Formatter.format` (the modifier's `draw()` reads
both), draw **only** the modifier into an `openGroup`, measure the bbox, translate to the cursor,
paint it ghost blue at 0.7.

The ghost is the **real mark**, not the palette's picture — the palette draws a note wearing its
strokes because a button needs to be recognisable; the ghost draws what the click will actually
add.

⚠️ **Add the group to `GHOST_GROUP_SELECTOR`** (`VexFlowRenderer.ts:449`). `clearGhosts()` removes
only what is listed there; a group that is missing is never taken down, and the ghost smears a
trail of strokes across the score as the pointer moves.

⚠️ **Where it differs from every other stamp ghost:** `Articulation` positions itself off the
notehead, `Tremolo` positions itself off `note.getStemExtents().topY`. The strokes therefore land
where the throwaway note's *stem top* is — far from the group origin the other ghosts assume. The
bbox-translate step has to absorb that offset, and it is the thing most likely to look wrong
first.

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

⚠️ **This is a live trap for P2.** Whatever draws E22B, if it is a `Modifier` rendering at explicit
coordinates, it inherits the same bug. Set `x`/`y`.

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

No new `ElementType` in P0 unless §2's removal decision says otherwise.

## 5. Playback

`collectScheduledNotes` (`src/engine/audio/playbackSchedule.ts`) is pure, Tone-free and
unit-tested. It is the right seam: one `ScheduledNote` becomes N.

**One number decides which of the three rules applies:**

```
totalBeams = flags(duration) + strokes        // Penderecki has no strokes; it is always rule 3
```

`flags` = 0 for `w`/`h`/`q`, 1 for `'8'`, 2 for `'16'`, 3 for `'32'` — a small helper next to
`DURATION_INFO` (`utils/durations.ts:50`). `CrossBarBeams.beamCountOf` (`:149`) computes the same
idea but is private, hardcodes a default of 1 and only handles chords, so it is not reusable as-is.

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

### Rule 3 — Penderecki

Rule 2, plus the thing that makes it Penderecki: **the speed varies**. Irregular by definition, so
the onset spacing is jittered — and the velocity with it, since an even attack at a wobbling tempo
still reads as a machine. Rule 2 must stay strictly even; the jitter is what separates them.

**Determinism.** `playbackSchedule.ts` is pure and its tests depend on that. A bare `Math.random()`
inside it gives a green suite that proves nothing about what you hear. It takes an injected
`rng: () => number` defaulting to `Math.random`; tests pass a seeded stub. Re-rolled per playback
(two performances of a Penderecki tremolo are not identical) — deliberate, not incidental.

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
  undo-only) and the Penderecki button, which is DISABLED because arming it would stamp a mark that
  stores and never appears until P2.
- **P1 — travel. ✅ DONE.** The five rebar links, the voice move, the tie-split (§6). Early, and on
  purpose: before P0's marks started silently disappearing on a meter change. 29 lines of code and 8
  tests, every link proved load-bearing by removing it.
- **P2 — Penderecki render. ✅ DONE.** E22B through the SAME modifier as the strokes (§4) rather than
  a second draw of our own, plus §0's naming fix. The dev palette's sixth button arms again.
- **P3 — measured + unmeasured playback.** The `totalBeams` helper, the threshold constant, rule 1's
  period arithmetic, rule 2's physical rate and the tempo-map conversion. Both rules, together —
  they share the fill and differ only in where the period comes from.
- **P4 — Penderecki playback.** The injected RNG and the jitter on onset *and* velocity. Nothing
  structural left by then.

## 8. Deferred, deliberately

- **Two-note (between-notes) tremolo.** A different notation with a different model — it belongs
  to a *pair* of slots, not one. VexFlow does not draw it either. (SMuFL's `tremoloFingered1–5`,
  E225–E229, are for that reading.)
- **Selecting the mark.** Still deferred after P0 — `ElementType` has no `'tremolo'` (it does now
  have `'stem'`, which is a different thing: the stem is a click TARGET for the stamp, not the mark).
  Clicking a stroke to select or delete it needs registry entries the way articulations have them,
  and that is what §2's removal decision would buy.
- **The threshold as a preference.** Dorico exposes it; ours is a constant until someone asks.
- **Keypad wiring.** The page-2 tremolo keys are still `momentary` (`docs/keypad.md`). They arm
  the same `PaletteController.armTremolo` when they are wired — nothing here blocks it, and since P2
  their names match the marks they draw, so the wiring is a lookup rather than a translation.
- **Properties.** Same shape as the beaming reset gap: worth a home, not worth one now.
- **Naming.** The palette says "second/third order"; this doc counts strokes, which is
  unambiguous. If the labels should read "two-stroke / three-stroke" instead, that is a one-line
  change in `devToolbar.ts`.

## Sources

The notation and playback conventions above are not house rules:
[SMuFL Tremolos range](https://www.w3.org/2021/03/smufl14/tables/tremolos.html) ·
[Dorico: tremolos in playback](https://archive.steinberg.help/dorico/v1/en/dorico/topics/notation_reference/notation_reference_tremolos_playback_r.html) ·
[Dorico: tremolo playback duration](https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_tremolos_playback_duration_changing_t.html) ·
[Gould, *Behind Bars* p.224, via RPM Seattle on Sibelius tremolo playback](https://www.rpmseattle.com/of_note/improving-tremolo-playback-in-sibelius-6-7/) ·
[NotePerformer / Dorico settings](https://www.noteperformer.com/?page=support_dorico)
