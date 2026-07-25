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
- either slot carries an **authored beam role** (`single`/`begin`/`continue`/`end`) — the pair owns
  its own beam or none (§2), so the two are competing answers to the same question. Take the mark
  off, or take the pair elsewhere.

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
   and must hand `tremoloPair` to none of them: adjacency is not a property of the event. Same for
   the clipboard — copying the first note of a pair copies a note, not half a mark. Otherwise a dead
   flag sits in the JSON and silently comes back to life the day a note of the right length lands
   next to it.

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
| redonda (from blancas) | — | horizontal, floating **between the two noteheads** (no stems exist) |
| blanca (from negras) | — | floating between the two stems |
| negra (from corcheas) | — | floating between the two stems |
| corchea or shorter | **yes**, a real `Beam` over the pair | **all N**, floating under the beam |

⚠️ **The beam does not eat into the count — beams and strokes ADD.** N strokes means N strokes drawn,
whatever the drawn value's own beams are, and the total is what says how fine the repetition is: a
pair of semicorcheas with 2 strokes draws one beam plus two strokes, and 1 + 2 = 32nds. That is the
same `totalBeams` arithmetic §3 plays back, and the same reading the single-note mark already uses
(`flags + strokes`), so the button's number means one thing in all three places.

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
- stems **stretch when the strokes do not fit**, Gould's rule 2 — the same rule the single-note mark
  follows, in a **sibling pass**, not the same one (see the traps);
- both stems point the **same direction**;
- Gould's clearance still applies: ≥1 staff space clear of the noteheads, strokes inside the staff.

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

An **authored** beam role (`single`/`begin`/`continue`/`end`) on either slot is a second answer to
the same question, so the pair refuses it — it joins the §0 list rather than silently winning.

⚠️ **The stem stretch is a SIBLING pass.** `applyTremoloStemStretch` keys off the note's
`CenteredTremolo` modifier and measures *its* stack — and a pair has no modifier, by the rule below.
Only `usableStemSpan` is genuinely shared. The pair's pass runs in the same window (post-format,
post-stem-re-assert, pre-draw, next to the existing call) and stretches **both** stems by the same
amount: unlike a beamed group there is no `Beam` to carry one note's extension to the other.

⚠️ **No `CenteredTremolo`.** The first note's stem strokes are **not** added when `tremoloPair` is
set: the strokes moved off the stem, and drawing both would say two different things.

## 3. Playback

`totalBeams = flags(the DRAWN note) + strokes` — §5's rule, unchanged, read off the doubled value.
It lands right at every case: two blancas + 3 strokes → drawn as redondas, 0 + 3 = 32nds over a
whole-note span; two semicorcheas + 2 strokes → drawn as corcheas, 1 + 2 = 32nds over an eighth.

`collectScheduledNotes` already turns one `ScheduledNote` into N, but **not where the pair needs
it**. Today the expansion sits *inside the per-pitch loop*, beside the tie-chase and the legato
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

Reuses the seams P5–P7 built for the single-note mark: the stroke stack registers as
`ElementRegistry` type `'tremolo'` with its **measured** ink rect (never `getBoundingBox()` — §9),
Delete removes the mark, and a selected note lights it and the palette says which it is. Deleting
clears **both** `tremoloPair` and `tremolo`: the pair is one mark, and half of it is not a notation.
The rect is the quads' own extent, measured as they are drawn, for the same reason
`CenteredTremolo.inkRect` is — the code that placed them is the only honest source.

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
| **P1** | `tremoloPair` + `pairIsValid` (§1, the ONE predicate) + the **dev-shell palette** button (one undo batch) + the relay/clipboard DROP + drawing for the **stemmed, unbeamed** cases: blanca and negra, floating strokes, doubled noteheads |
| **P2** | corchea and shorter — real `Beam` over the pair + the remaining strokes |
| **P3** | redonda — no stems, horizontal strokes between the noteheads |
| **P4** | playback (alternating attacks) |
| **P5** | selection / Delete / reporting |
| **P6** | the `'joined'` blanca style + the toggle on the selected mark (needs P5's selection) |

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
