# Two-note tremolo (the "trino" between two pitches)

Extends `docs/tremolo-plan.md`, which deferred this in §8: *"a different notation with a different
model — it belongs to a **pair** of slots, not one."* This is that pair.

## 0. The gesture

**One button in the tremolo palette, pressed on the FIRST note.** It takes that note and the one
after it, and they alternate. The 1–5 stroke buttons are unchanged: they say **how many strokes**,
here as everywhere.

⚠️ **THE PALETTE IS THE DEV SHELL'S — `src/dev/devToolbar.ts`, a seventh button beside the six
`TREMOLOS`.** That is the whole UI for this feature, in every phase. The press goes through
`PaletteController` beside `pressTremolo`, which is where the routing (§4) already lives. The
Keypad's Beams/Tremolos page has the picture for it already drawn and deliberately unbound
(`TREMOLO.tremoloWithNext`, Sibelius's Enter key, `windows/keypad/keypadLayouts.ts` — still
`momentary`); **wiring that key is NOT in this plan** and stays where the other tremolo keys are,
waiting. Nothing here is reachable from the keypad, and nothing here needs it.

**The count comes from the note; with none there, the press sets THREE.** The pair is a separate
field from the stroke count (§1), so pressing it on a note that carries no `tremolo` would otherwise
be a mark with nothing to draw. Three strokes is the ordinary two-note tremolo and the one number
chosen here. Refusing instead would make the button dead on exactly the note you pressed it on —
the trap the tie stamp already had and fixed (docs/tie-stamp-plan.md §1.3).

⚠️ **The Penderecki sign takes no pair.** It is the unmeasured mark; "alternate between two pitches
as fast as possible, unmeasured" is a different notation again, and not one we are drawing. A pair
needs a stroke COUNT.

**The pair lasts `this note + the next note`, and both noteheads are drawn at DOUBLE their written
value.** Two blancas → two redondas holding the bar; two negras → two blancas; two corcheas → two
negras. That is the standing convention (Wikipedia, MusicXML's 2:1 `time-modification`, LilyPond,
and the input behaviour of Sibelius / Dorico / MuseScore all agree): **each note is written with the
full value of the whole tremolo**, so the written pair reads twice as long as it sounds.

**Refused — the press does nothing — when:**
- the next slot is a **rest**, or there is no next slot;
- the next slot's duration (incl. dots) is **not the same** — and "the same" includes **tuplet
  membership**: a triplet eighth and a plain eighth are not the same value, and one note in a tuplet
  with its partner outside it is not a pair;
- the two are in **different measures** (P1 scope), voices or staves;
- the value **cannot double**: `'w'` is the top of `NoteDuration`, so two redondas have no notation;
- either slot is **already in a pair** — this one as a second note, or the next one as a first. A
  pair is two notes and they alternate; a chain of them (A–B, B–C) is not a longer tremolo, it is B
  belonging to two marks at once, which has no reading and no drawing;
~~- either slot carries an **authored beam role**~~ — **struck out (2026-07-25, by eye).** It is not
a competing answer to the same question, it is **the answer**: a pair whose drawn value is beamable
can be written beamed *or* apart with flags, both are the mark, and the note's own `single` is what
chooses between them (§2). Refusing instead un-drew the mark on a keypress and left a dead flag in
the data.

The single-note mark and the pair are **mutually exclusive on a slot**: pressing the pair on a note
wearing stem strokes keeps the count and moves the strokes between the stems (that is the same mark
re-read, not a second one), and §2 says the `CenteredTremolo` is not added when `tremoloPair` is set.

## 1. The model — ONE field, on the first slot

```typescript
// on Chord (src/types/music.ts), beside the existing tremolo?: TremoloMark
tremoloPair?: true   // this slot's tremolo alternates with the NEXT slot
```

The stroke count stays in `tremolo`, and how the strokes meet the stems is the optional
`tremoloPairStyle` (§2 — absent everywhere until P6). The second slot carries **nothing** — "mark just the first
note" is true in the data too, and the renderer looks ahead. One less thing to keep in step, and
deleting the second note cannot leave a dangling half-mark: the pair simply stops being one.

**Durations are NOT rewritten.** The model keeps two blancas; only the *drawing* doubles them (§2).
This is the whole reason the feature is cheap: rebar, rest-fill, meter changes, clipboard, JSON,
collision and undo never see a note claiming a length it does not have. The alternative — storing
`duration: 'w'` + `actualDuration` = a half, MusicXML's encoding — would put a 2:1 lie inside every
one of those pipelines to buy nothing the eye can see.

Inside `slots`, so it needs no `MEASURE_RENDER_ROLE` entry, for the reason §1 of the tremolo plan
gives (`laneFingerprint` stringifies the lane whole — `rendering/MeasureWidthCache.ts`). A pair
lives inside ONE bar (§0), so the partner slot is inside the same fingerprint and the same redraw
key; a cross-barline pair would need what the cross-barline beams needed, and that is the reason it
is out of scope rather than a size judgement.

### ⚠️ A pair can go STALE — the one thing the single-note mark could not do

`tremolo` rides one slot and is true whatever happens around it. `tremoloPair` is a **relation**,
and every pipeline that reorders slots can break it after the fact: deleting the second note (the
rest-fill puts a rest there), inserting between the two, changing either duration, a meter change or
a paste that re-bars them apart — and `rebarOps` copies a split event's mark to **every** piece on
purpose (`utils/rebar.ts` "EVERY piece, not just the head"), which for a pair would mint a flag on
each half.

So the flag alone is not the notation. Two rules, and they are P1 work, not later polish:

1. **ONE validity predicate, used everywhere.** A pure `pairIsValid(slots, i)` — the §0 refusal list,
   read off a lane — is what the button asks before applying, what the renderer asks before drawing,
   what playback asks before alternating, and what the reporting in §4 asks. Two copies of this rule
   would drift, and the drift is silent: a bar that draws a pair and plays two separate notes.
2. **A broken pair is DROPPED, not carried.** The relay hands `tremolo` to every piece of a split
   and must hand `tremoloPair` to none of them: adjacency is not a property of the event. Otherwise a
   dead flag sits in the JSON and silently comes back to life the day a note of the right length
   lands next to it.

   ⭐ **BUT "dropped" is about what BREAKS, not about what MOVES INTACT** (his call, 2026-07-25: *"I
   should be able to paste what I copied… same for voices"*). A re-bar may genuinely tear a pair
   apart, so the relay must stay clean — but a COPY that carries both notes, or a voice move that
   takes both, can simply reproduce the mark, and refusing to would be losing the user's notation
   rather than protecting it. So:
   - **The relation travels by POSITION, never on the event** — captured before a re-tile, re-found
     after it, re-applied only where `pairIsValid` still holds. That is what makes it safe where a
     field on `RebarEvent` would not be: the relay hands a split event's marks to *every* piece, so a
     `tremoloPair` riding the event would mint a bogus pair between two halves of one tie-split note.
     A position key cannot do that, because it re-asks the question at the destination.
   - **Copy/paste** carries the pair in a lane channel of its own, `ClipboardLane.tremoloPairs`,
     exactly as `restShifts` / `restHidden` / `noteOffsets` are carried — *because nothing in
     `events` can drag it along*. Only pairs whose **partner is also in the window** travel (copying
     the first note alone still copies a note, not half a mark).
   - 🚨 **AND THE DESTINATION'S OWN PAIRS MUST BE CAPTURED TOO** — `captureTremoloPairs` /
     `restoreTremoloPairs` in `rebarOps`, on BOTH the rebar and the paste paths, the clip's stamped
     after so it wins a collision. Missing this was a real bug, reported: *"last paste broke the
     already correct things."* Every slot in the rebuilt region goes through the relay, so a paste
     into bar 4 quietly un-paired a mark at bar 4 beat 0 **and** one in bar 5 — neither of them
     touched by the paste. Carrying only the CLIP's pairs fixes what you pasted and breaks what was
     already there.
   - The same capture is why a **meter change now KEEPS** a pair whose two notes stay adjacent, and
     drops one it tears apart. Both fall out of re-validating on landing; neither is a special case.
   - **Move to voice** carries `tremoloPair`/`tremoloPairStyle` in the move payload, so a pair whose
     two notes both move lands whole. What the move genuinely tore is severed by
     `ScoreModel.dropStaleTremoloPairs` — ⚠️ run once the move (or the whole BATCH) has settled,
     never per note: the notes move one at a time, so between the two the pair is legitimately
     invalid, and pruning there would kill a mark about to be whole again.

   That pruner is also the general answer to rule 2 outside the relay: draw-time validation alone
   keeps a stale flag from being drawn, and this is what keeps it from sitting in the JSON.

Draw-time validation alone would leave that resurrection; dropping alone would leave the window
between the edit and the next render. Both.

## 2. Drawing — what the engraved examples actually do

Read off Wikipedia's `Tremolo_notation_two_notes.svg` and the LilyPond manual's `\repeat tremolo`
output, zoomed. SMuFL is explicit that this is **not** a glyph: *"scoring applications should draw
two-note tremolos using the same primitives used for drawing beams, rather than using these
glyphs"* — so `tremoloFingered1–5` (E225–E229) are never used here.

**The doubled value decides the case:**

| drawn value | real beam | the strokes |
|---|---|---|
| redonda (from blancas) | — | **all N**, hanging from the two IMAGINARY stems — see the correction below |
| blanca (from negras) | — | **all N**, hanging from the two stem tips |
| negra (from corcheas) | — | **all N**, hanging from the two stem tips |
| corchea or shorter | **yes** by default, a real `Beam` over the pair | **N − beam lines**, just past the beam |
| corchea or shorter, authored `single` | no — each note keeps its FLAG | **all N**, started at the same height the beam would have put them |

⚠️ **"Floating between the two stems" was wrong about the HEIGHT, twice over** (both reported by eye,
2026-07-25): the stack does not float in the middle of the stems, it hangs **flush from the two stem
TIPS** and marches toward the noteheads — where a beam over the pair would sit, which for a beamed
pair it literally is. And a redonda is **not** a separate case: `hasStem()` is false but VexFlow
still built the `Stem`, so `getStemExtents()` gives the imaginary stem to hang from. Only its
horizontal **span** parts company — with no stem ink at the stem's x, `getStemX()` puts both ends on
the right edge of each notehead and the bar reads shoved right, so a stemless pair runs notehead to
notehead (first's right edge → second's left edge).

⚠️ **THE BEAM COUNTS — it SPENDS one of the strokes, it does not add to them.** *(Corrected
2026-07-25; this section previously said the opposite.)* For a two-note tremolo the beam and the
strokes are the same kind of line, and what says the speed is the **total number of lines between the
two notes** — Wikipedia states them as alternatives of one notation: *"either connecting them with
beams, or else interpolating strokes, with the number of beams **or** strokes corresponding to the
speed of the tremolo — a tremolo in thirty-second notes lasting a half-note would be written either
as two open noteheads connected by three beams, or as two half-notes with three strokes
interpolated."* So a 3-mark on a pair of semicorcheas draws **one beam plus two strokes** = 3 lines =
32nds; on a pair of negras, drawn as blancas with no beam, it draws all three.

⚠️ **This is NOT the single-note rule, and the difference is geometric.** There (docs/tremolo-plan.md
§5) `totalBeams = flags + strokes`: a flag hangs off the **outside** of the stem, so it is not a line
*between* anything and cannot stand in for a stroke. Same reason the flags of a pair drawn APART do
not count either — only a beam does. `pairStrokesDrawn` (utils/tremoloPair) owns the arithmetic.

### Beamed, or apart with flags — the note's own `single` chooses

A pair is never in an automatic group, so the meter has no opinion here and the only thing that can
speak is what was authored on the two notes. `single` on either — "do not beam me" — draws them
apart, flags and all, with the strokes still between the stems; anything else (`auto`, absent, or a
`begin`/`continue`/`end` with nothing to join) leaves the pair to beam itself. `pairDrawing` owns it,
and `beamRoleAtRef` reports it, so the Keypad's beam keys tell the truth about a pair and pressing
`single` is how you switch. ⚠️ `beam: 'auto'` still has **no key** on the Keypad (a standing TODO —
`PaletteController.setBeam`), so switching *back* to beamed has no home yet.

**Floating means detached at both ends** — short, centred in the gap, a clear gap to each stem. That
is what the quarter-note picture shows, and it is not decoration: a stroke touching two *filled*
noteheads' stems reads as two beamed corcheas. It is exactly why MuseScore only offers a style
choice for half-note tremolos, "as beaming tremolos of shorter duration may introduce rhythmic
ambiguity".

### Joined or open — the user chooses, on the blanca

The engraved blanca example draws the strokes **joined to both stem tips**, like a beam; LilyPond
does the same. Both readings are in use, so **this is a setting, not a house rule we pick for
him** — Dorico ships exactly this choice (Engrave ▸ Engraving Options ▸ Tremolos, "multi-note half
note tremolos"), and MuseScore offers the same styles in Properties.

```typescript
// on Chord, only read when tremoloPair is set
tremoloPairStyle?: 'joined' | 'open'   // absent = the default
```

✅ **BUILT.** `joined` is simply "no end clearance" — the strokes reach both stems and touch them,
which is what makes them read as a beam. Everything else about the stack (anchor, slope, step) is the
open style's, which is why it is ONE boolean and not a second drawing path. The write is **refused**
where the style is not on offer (`pairAcceptsJoined`), because a joined drawn NEGRA would say a
different rhythm.

⭐ **THE KEYPAD'S BEAM KEYS SET IT — there is no control of its own** (his call, so two controls
cannot disagree; the dev shell's `Joined` button was built and then removed). On a pair those keys
have never been about *which notes beam together* — a pair is never in an automatic group — so they
say how the pair's own lines are DRAWN, and this is the other end of a question `single` already
answered:

| drawn value | `single` | `begin` |
|---|---|---|
| blanca (from quarters) | strokes **open**, floating clear | strokes **joined** to both stem tips |
| corchea or shorter | drawn **apart**, each note keeping its flag | (nothing — it beams itself) |

`beamRoleAtRef` reports `begin`/`end` for a joined pair exactly as it does for a beamed one — one
line joining two notes either way — so the pad reads back what its keys write.

⚠️ The router writes `tremoloPairStyle`, **never `beam`**: an authored beam role is inert on a paired
slot but would come alive the moment the mark came off, leaving a note silently carrying `begin` from
a tremolo it no longer has. And `tremoloPairStyle` **is cleared with the mark** (`setTremolo(null)`
and `setTremoloPair(false)`, both in `ScoreModel` — his catch): a style left on a plain note is the
same resurrection trap the flag itself is, re-joining the strokes the day that note is paired again.

⚠️ **It is offered on the drawn BLANCA and nowhere else** — the same restriction MuseScore states.
On a drawn negra, strokes touching two filled stems read as two beamed corcheas; on corchea and
shorter the joining line is a **real beam** and not ours to style; a redonda has no stems to join.
So the field is read in one case and ignored in the rest — refusing the choice where it would
change the rhythm is the point of restricting it, not an omission.

**Default: `'open'`** (floating). It is the one drawing that is right in every case, so it is also
what P1 builds; `'joined'` is the second path, added deliberately.

⏭️ **Per mark now, project-wide later.** The field rides the slot, so the toggle acts on the
selected tremolo (§4) — a global default has no home yet, and inventing one would collide with the
positional rule (`project_score_globals_should_be_positional`) unless it lands in a real engraving
-options compartment beside `Score.engravingOverrides`. When that compartment exists, this becomes
the default and the slot field stays as the per-mark override — which is Dorico's shape too.

**Geometry**, all of it beam arithmetic we already own:
- slope = the line between the two stem ends (Dorico: "determined by the height of the stems");
- thickness and the ×1.5 step between strokes = VexFlow's `beamWidth`, via
  `VexFlowRenderer.fillBeamQuad()` — written for the cross-system half-beams, one quad per stroke;
- ⛔ **stems do NOT stretch.** Gould's rule 2 was built here as a sibling pass and then REMOVED
  (2026-07-25, by eye): *"this is not a tremolo on stem but in between the notes, so we should skip
  the rule here."* That rule is about a mark riding a stem; a pair's strokes ride the gap, so a
  longer stem buys them nothing and visibly retunes notes nobody asked to retune;
- both stems point the **same direction**, decided ONCE over both slots' pitches (the rule a beam
  group follows) rather than per note;
- Gould's clearance still applies: ≥1 staff space clear of the noteheads, strokes inside the staff.

**The end clearance — everything RELATIVE, nothing in pixels.** "Floating" means detached at both
ends, and how far is three rules stacked, none of them a pixel count (his constraint: *"it should be
a relation, not a fixed pixel, because if we change scale in the future the pixel fails"*):

1. a **staff space** at each end (`PAIR_STROKE_CLEARANCE_SPACES`), capped at a **quarter of the gap**
   (`PAIR_STROKE_CLEARANCE_RATIO`) so a narrow pair keeps a real stroke;
2. a **floor** when the pair is drawn APART: a flag hangs off a stem tip straight into the gap where
   the strokes end, and rule 1 knows nothing about it. The floor is the note's own
   `getGlyphWidth()` — MEASURED from VexFlow's glyph metrics, so it follows the staff size. Applied
   at **both** ends, because which end a flag intrudes on flips with the stem direction (stem-up puts
   the first note's flag inside the span, stem-down puts the second's at the far end), and symmetric
   also keeps the strokes centred;
3. a **ceiling** of `PAIR_STROKE_MAX_CLEARANCE_RATIO` of the gap, so a mark can never shorten itself
   to nothing keeping clear of something.

**Where the drawing runs.** In the bar's own render, after the voices and their beams are drawn and
before `registerSlotElements` (`VexFlowRenderer.drawMeasureContent`) — the strokes read stem geometry
that is only settled once the beams have applied their extensions, and they belong to the measure
group (both notes are in one bar), unlike the cross-barline fragments which have no bar to live in.

### The four traps

⚠️ **Ticks — and the doubling lives in `createStaveNotesFromSlots`, with them.** The StaveNote is
built at the doubled duration, so it carries twice the ticks its slot has.
`Tickable.applyTickMultiplier(1, 2)` halves them back — the same call VexFlow's own `Tuplet` makes
(`setTuplet` → `applyTickMultiplier(notesOccupied, noteCount)`), which is why the formatter then
spaces the pair over its real length and `pickVoiceMode` still answers FULL.

Both halves belong in `rendering/NoteBuilder.createStaveNotesFromSlots`, side by side, because the
**width** path builds its notes through that same function (`MeasureLayout.noteSpaceForLane` →
formatter → the cached lane width). Double on the draw side only and the two disagree about what is
in the bar; double without the multiplier and a FULL-mode voice is handed twice the bar's ticks and
throws. There is no `doubleDuration()` in `utils/durations` yet — `'w'` has no double, which is the
§0 refusal, so it returns null and the caller draws the note as written.

⚠️ **Beam grouping — the exclusion goes in the PURE grouper, not in `buildBeams`.**
`computeBeamGroups` is a one-bar call into `computeCrossBarBeamGroups` (`utils/beaming.ts`), and the
cross-barline planner feeds the renderer its own `inBarGroups` — so a pair excluded only in
`VexFlowRenderer.buildBeams` would still be dragged into a group *across a barline* by the plan. The
break belongs beside the rest/`beamOver` rules in `computeCrossBarBeamGroups`: a paired slot and its
partner are never members of an automatic group. The pair owns its own `Beam` (P2) or none.

An **authored** `single` on either slot is not refused — it is what says the pair is drawn apart, with
each note keeping its flag (see above). The break in the grouper stands either way: what `single`
chooses is whether the pair builds its **own** `Beam`, never whether the meter may sweep it into one.

⛔ ~~**The stem stretch is a SIBLING pass.**~~ **There is no pair stem stretch** — see the geometry
list above. `applyTremoloStemStretch` stays exactly as it was, for the single-note mark only: it keys
off the note's `CenteredTremolo` modifier, and a pair has no modifier by the rule below, so it never
sees one. The pair simply does not stretch anything.

⚠️ **No `CenteredTremolo`.** The first note's stem strokes are **not** added when `tremoloPair` is
set: the strokes moved off the stem, and drawing both would say two different things.

## 3. Playback

⚠️ **`totalBeams` IS THE MARK'S OWN NUMBER** — *not* `flags + strokes`. *(Corrected 2026-07-25 with
§2.)* The count on the button is already the total number of lines between the two notes, however
they are spelled: a 3-mark is 32nds whether it draws as three floating strokes (a pair of blancas,
drawn as redondas) or as one beam plus two strokes (a pair of semicorcheas, drawn as corcheas). So
playback reads the stored `tremolo` and stops — it must NOT add the drawn value's flags, or the same
mark would sound at two speeds depending on how it was written.

✅ **BUILT.** `collectScheduledNotes` already turns one `ScheduledNote` into N, but **not where the
pair needs it**. Today the expansion sits *inside the per-pitch loop*, beside the tie-chase and the legato
overlap: one pitch at a time, each filling its own length. A pair alternates whole **pitch sets**, so
it is a branch on the SLOT, before that loop:

- take the pair's two chords, fill their **combined** duration, and emit attack *i* from the first
  chord's pitches when *i* is even, the second's when odd;
- then **skip the second slot** when the outer loop reaches it — otherwise the pair plays and the
  second note plays again underneath it. This is the only place in the collector where one slot's
  work consumes another, so it is worth a test of its own;
- `tremoloPeriodBeats` reads `chord.duration` for both `durationFlags` and the `written` length —
  both must be the **DRAWN** (doubled) value, over the combined span. Same function, one argument's
  worth of difference, so pass the doubled length in rather than teaching it about pairs.

The threshold and the unmeasured period are the same two numbers. Ties into or out of a pair are
deferred with the rest of §5's list: the tie-chase is per pitch and the pair is not.

## 4. Selection, Delete, reporting

✅ **BUILT.** Reuses the seams P5–P7 built for the single-note mark: the stroke stack registers as
`ElementRegistry` type `'tremolo'` with its **measured** ink rect (never `getBoundingBox()` — §9), so
the existing `findTremoloAt` hit-test selects it with no new code; Delete removes the mark, and a
selected note lights it and the palette says which it is. The rect is the quads' own extent, measured
as they are drawn, for the same reason `CenteredTremolo.inkRect` is — the code that placed them is the
only honest source.

⭐ **Deleting clears BOTH fields, and the rule lives in `ScoreModel.setTremolo`** rather than in
Delete: **removing the COUNT removes the pair**, because a pair needs one (§0), so `tremoloPair` with
no `tremolo` would be a mark with nothing to draw. One place, so Delete, the palette's re-press and
anything added later agree for free. *Changing* the count leaves the pair alone — that is the same
mark re-read.

⚠️ **The HIGHLIGHT does not come free — it is the one seam that does not transfer.**
`HighlightController.colorNoteTremolo` finds `<text>` nodes *inside the note's `vf-stavenote` group*
whose content is the tremolo codepoint. A pair's strokes are our own quads, drawn outside every note
group and made of paths, not text: that lookup finds nothing. So the pair paints through its own
named group — `openGroup` at draw time (⚠️ it PREFIXES with `vf-`; pass the bare name and
`closeGroup()` in a `finally`), then colour that group. It is the barline lesson again: paint the
highlight, do not go hunting for glyphs to recolour.

The palette's lit state (`interactions/keypadSync.tremoloHighlight`) answers with a `TremoloMark`
today; the pair is a second axis, so it reports separately — the count lights as it always did, and
the pair button lights beside it.

## 5. Phases

Each is hand-testable on its own.

| | |
|---|---|
| **P1** ✅ `9bb3ce3` | `tremoloPair` + `pairIsValid` (§1, the ONE predicate) + the **dev-shell palette** button (one undo batch) + the relay/clipboard DROP + drawing for the **stemmed, unbeamed** cases: blanca and negra, floating strokes, doubled noteheads |
| **P2** ✅ `9bb3ce3` | corchea and shorter — real `Beam` over the pair + the remaining strokes. ⚠️ The pair's beam is authorable: `single` draws them APART with flags instead (§2) |
| **P3** ✅ `9bb3ce3` | redonda — ⚠️ NOT between the noteheads: a stemless note still has stem EXTENTS, so the strokes hang from its IMAGINARY stem. Only the horizontal SPAN is notehead-to-notehead (§2) |
| **P4** ✅ | playback (alternating attacks) |
| **P5** ✅ | selection / Delete / reporting |
| **P6** ✅ | the `'joined'` blanca style + the toggle on the selected mark (needs P5's selection). REFUSED off the blanca rather than written-and-ignored — `pairAcceptsJoined` |

Deferred on purpose: note entry armed with a pair (the mark applies to notes that already exist),
cross-barline pairs, tremolo between two **chords** of different sizes, ties into or out of a pair
(§3), a project-wide default for the style, and **the Keypad key** — the picture is drawn and stays
`momentary`; every phase above is driven from the dev shell's tremolo palette and nothing else.

## Sources

- Wikipedia, *Tremolo* — "both notes receive the full value of the passage and the bars are drawn
  between them"; the engraved four-case figure read here.
- SMuFL 1.4, *Tremolos* (U+E220–U+E23F) — the "draw with beam primitives" instruction.
- MusicXML 4.0, `<tremolo>` — double-note tremolo = half the notated type + `time-modification` 2:1.
- MuseScore Studio handbook, *Tremolos and rolls* — enter at half the value, values double on
  apply; style settable for half-note tremolos only.
- LilyPond 2.24, *Short repeats* — `\repeat tremolo 8 { c16 d }` renders as two whole notes.
- Dorico, *General placement conventions for tremolos* — strokes between the stems, angle from the
  stem heights, ≥1 staff space clear of noteheads.
- Gould, *Behind Bars*, the tremolo section — stem extension and staff clearance (the rules already
  followed by the single-note mark).
