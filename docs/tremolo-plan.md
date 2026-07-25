# Tremolo: stamp, render, playback

A single-note tremolo — the strokes that ride a note's stem and say "repeat this note, this
finely". Six marks in the palette: one to five strokes, and the **Penderecki** sign.

It is the sibling of the accidental stamp (`docs/accidental-stamp-plan.md`) — read that first;
this doc records only where a tremolo differs. It differs a lot in two places: nothing in
VexFlow draws the Penderecki sign, and nothing in the playback schedule can express a speed that
is *physical* rather than metrical — see §4 and §5.

The dev-shell palette (`src/dev/devToolbar.ts`) already exists and arms nothing. Wiring it is P0.

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

### The SMuFL inventory, and our three names for one glyph

```
E220–E224  tremolo1…tremolo5          combining strokes
E22A       buzzRoll                   buzz roll
E22B       pendereckiTremolo          "Penderecki unmeasured tremolo"
E22C/E22D  unmeasuredTremolo          "Wieniawski unmeasured tremolo" (+ a simpler form)
```

⚠️ We draw E22B in two places and call it three things: the dev palette titles it "Penderecki
tremolo — unmeasured, as fast as possible" (`devToolbar.ts`), and the Keypad names the same glyph
`buzzRoll` (`windows/keypad/keypadLayouts.ts:287`) — while E22A, the actual buzz roll, and E22C,
the actual dedicated unmeasured sign, are unused. Whatever the sixth button turns out to be, the
two files must agree on which glyph it draws and what it is called.

## The decisions still open

1. **The unmeasured threshold.** How many total beams (strokes + the note's own flags) stop being
   a subdivision and start being "as fast as possible"? Gould reports players assume unmeasured at
   **three**; Dorico's default minimum is **3** and it is a user preference. Ours starts as one
   named constant. Set it to 4 instead and three strokes stay measured — that is the whole of the
   old "three strokes on a half note" question, now a number rather than a special case.
2. **The unmeasured rate.** A physical speed needs a number. Dorico expresses it as a fraction of a
   quarter at 120 qpm — default **1/5** (0.1 s, ~10 attacks/sec); NotePerformer suggests 1/8
   (~16/sec). Nothing before P3 depends on it.
3. **The sixth button's glyph** (§0) — E22B as now, or a plain unmeasured sign with Penderecki as a
   seventh.
4. **Removal** — see §2. P0 as written can stamp a mark it cannot take off.

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
| 5 | `MouseController.stampTremoloAtClick()` — a near-copy of `stampAccidentalAtClick` (`:1903`): same `hitsNoteOrRestBody` test, one `runBatch` = one undo entry | ❌ |
| 6 | `GHOST_GROUP_SELECTOR` (`VexFlowRenderer.ts:449`) — see §3 | ❌ |

`MARKING_TOOL_USES_ARMED_LENGTH.tremolo = false`: it marks notes that already have their length.

The dev palette's ids are `'one'…'five' | 'penderecki'` (`devToolbar.ts`); wiring **maps** them to
`1…5`, it does not rename them — the Keypad borrows the same drawings by those names.

### ⚠️ P0 can stamp a mark it cannot remove

"Removal is the Delete key" is the accidental stamp's rule and it works there because `'accidental'`
is an `ElementType` (`ElementRegistry.ts:18`) — the glyph is selectable, so Delete has something to
delete. §8 defers `'tremolo'` from `ElementType` *and* defers the Keypad, which leaves Ctrl+Z as the
only way to undo a stamp. Pick one before P0 ships:

- **register the `ElementType` in P0** (the mark becomes clickable, Delete works, consistent with
  every other stamp) — recommended;
- or **wire the Keypad key first** and let it toggle off a selected note's mark;
- or **accept it** and say so here, out loud.

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

**The strokes** — VexFlow's `Tremolo` modifier, attached in `NoteBuilder` beside the articulations
(`NoteBuilder.ts:265`). Read `node_modules/vexflow/build/esm/src/tremolo.js` before touching this;
it is fifteen lines and three of them matter:

- It draws **N copies of `tremolo1` (E220)**. It never uses E221–E224. `new Tremolo(2)` *is* the
  two-stroke mark — the multi-stroke SMuFL glyphs are for the palette only.
- It reads `getStemExtents().topY` and **does not lengthen the stem**. Four and five strokes on a
  short stem will run into the notehead or past the beam. VexFlow has no opinion; if we want one,
  it is ours to add.
- ⚠️ **Whole and half notes.** A `StaveNote` always carries a `stem` object even when `hasStem()`
  is false, so a whole note will not throw — the strokes simply draw where an invisible stem would
  be. That is roughly the convention, and it is the first thing that will look wrong: check it by
  eye before assuming VexFlow got it right, because §5's table puts tremolos on whole notes.

Nothing here depends on the measured/unmeasured reading — the strokes are the strokes. That split
exists only in playback.

**Penderecki** — VexFlow has nothing. E22B is drawn by us at the stem, the way we already draw ties
and slurs with our own coordinates (`reference_vexflow_lowlevel_render_methods`). Write the
codepoint out: VexFlow's `Glyphs` map is CJS-only and is `undefined` in the browser, silently.

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

## 6. What travels — and what silently does not

**JSON is free.** A slot field is serialized directly by `getScore()` / `exportJSON`. No
migration, ever.

**Everything else is an explicit field list, and there are three of them.** Anything not named is
dropped in silence — the hole `beamOver` fell into.

**Rebar + clipboard — five edits, not two.** Clipboard lanes *are* `RebarEvent[]`
(`interactions/clipboard.ts:40`), so paste rides along with rebar; a time-signature change uses the
same relay. Miss any one link and the mark vanishes:

| | |
|---|---|
| `rebar.ts:86` | `RebarEvent.tremolo` field |
| `rebar.ts:199` | slot → event |
| `rebar.ts:108` | `RebarPiece.tremolo` field |
| `rebar.ts:331` | event → piece |
| `rebarOps.ts:1177` | piece → `Chord` |

**The voice move** (Alt+1/2). `ScoreModel.moveNoteToVoice` builds its own payload naming
`articulations`, `articulationStemAlign`, `beam`, `secondaryBreak` (`ScoreModel.ts:2469`), and
`insertPitch` re-applies each one by hand at both the merge and the new-chord branch (`:2604`,
`:2636`). Same hole, different file.

**Tie-split across a barline**: both halves keep the mark — a tremolo interrupted at the barline is
still being played across it. ⚠️ **Not free.** `placeSpanningNote` builds every continuation from
`{step, alter, octave, voice, staff}` only (`NoteEntryCoordinator.ts:1313`); articulations are
dropped there today. The head survives because it is reused via `updateNote`; the tail needs the
mark carried explicitly.

## 7. Phases

- **P0 — model + stamp + stroke render.** `Chord.tremolo`, the `MarkingTool` kind, the six seams,
  the ghost, `Tremolo` in `NoteBuilder`, and the dev palette wired to arm. Plus §2's removal
  decision. End state: you can put one to five strokes on a note and see them.
- **P1 — travel.** The five rebar links, the voice move, the tie-split (§6). Early, and on purpose:
  before P0's marks start silently disappearing on a meter change.
- **P2 — Penderecki render.** Our own E22B draw at the stem, and §0's naming fix.
- **P3 — measured + unmeasured playback.** The `totalBeams` helper, the threshold constant, rule 1's
  period arithmetic, rule 2's physical rate and the tempo-map conversion. Both rules, together —
  they share the fill and differ only in where the period comes from.
- **P4 — Penderecki playback.** The injected RNG and the jitter on onset *and* velocity. Nothing
  structural left by then.

## 8. Deferred, deliberately

- **Two-note (between-notes) tremolo.** A different notation with a different model — it belongs
  to a *pair* of slots, not one. VexFlow does not draw it either. (SMuFL's `tremoloFingered1–5`,
  E225–E229, are for that reading.)
- **Selecting the mark** — unless §2's removal decision pulls it into P0. `ElementType` has no
  `'tremolo'`; clicking one to select or delete it needs registry entries the way articulations
  have them.
- **The threshold as a preference.** Dorico exposes it; ours is a constant until someone asks.
- **Keypad wiring.** The page-2 tremolo keys are still `momentary` (`docs/keypad.md`). They arm
  the same `PaletteController` method when they are wired — nothing here blocks it.
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
