# Fanned (feathered) beams — plan

A fanned beam is a group whose notes speed up or slow down **within a fixed total duration** — Gould:
it "indicates free accelerando or rallentando *within the duration*" of the group; the beams converge
at the slowest point and are fully feathered at the fastest. It is not a tempo change: nothing after
the group is affected, the clock never moves.

## 0. The decision this plan is built on

**You enter the time first.** The user types one ordinary note — a blanca, a redonda — which already
fills the bar correctly. Selecting it and pressing `accel.` turns that ONE note into a fanned group
whose members sound across exactly that note's duration. Nothing else in the bar moves, because
nothing else in the bar changed.

So the model stores **the assertion, not its consequence**:

```ts
// on Chord (src/types/music.ts) — beside `tremolo` / `tremoloPair`
fan?: {
  direction: 'accel' | 'rit'
  /** How many notes the group is played/drawn as. */
  count: number
  /** Beam lines at the WIDE end. The narrow end is always 1 (Dorico's model, and its limit). */
  beams: number
}
```

That is the whole model change. `duration` stays `'h'`, `beat` stays put, and every pipeline that
walks slots — rebar, rest-fill, meter change, collision, clipboard, undo, JSON — keeps seeing one
event of a known length. It is the `tremoloPair` trick again: *the model is not rewritten, only the
drawing and the playback expand it.* Removing the field therefore **is** "go back to the note I
typed" — no recombine, no remembered original.

⚠️ **"One event of a known length" is a statement about the LENGTH, never about the field.** The
relay carries what it lists and drops the rest: `RebarEvent` has a `tremolo` field for exactly this
reason (`utils/rebar.ts` — "carried through the relay so a meter change or a paste does not silently
drop it"), and `tremoloPair` is off it on purpose because a relation cannot survive a split. A fan is
slot-local like the tremolo, so it rides the relay like the tremolo — with one rule the tremolo does
not need, in P0 below.

The six real notes MusicXML wants are a **projection** of this, produced by one pure function
(§2). Assertion → consequence is a function; the reverse is not. Storing the assertion keeps the
other door open without walking through it.

## 1. ⚠️ PROVISIONAL — every number here is a placeholder

**None of the values below is a considered engraving or performance decision.** They exist so the
feature is usable today; they are expected to be wrong, and tuning them is ongoing hand work, NOT a
phase of this plan. Each lives in exactly one named constant so changing it is a one-line edit:

| What | Provisional value | Where it will live |
|---|---|---|
| Default member count | `6` | `DEFAULT_FAN_COUNT` |
| Default beam lines | `3` | `DEFAULT_FAN_BEAMS` |
| Speed ratio from beams | `2 ** (beams - 1)` — a beam *is* a halving, so 1→3 beams = 4× | `fanSpeedRatio()` |
| Ramp shape | **linear** | `rampWeights(n, ratio, curve)`, `curve = 'linear'` |

**The linear ramp is explicitly temporary.** A real accelerando is not linear, and the ratio read off
the beam count is a first guess. The `curve` parameter exists from day one *so that swapping in a
geometric/eased ramp later touches one function and no callers* — that is the only thing this plan
promises about it.

## 2. The expander — one function, three consumers

```ts
// utils/fannedBeam.ts (pure, unit-tested — no VexFlow, no DOM)
fanMembers(fan, totalQuarters): Array<{ index, quarters: Fraction, startFraction: number }>
```

`startFraction` is where the member begins **along the group's span, 0…1** — the drawing multiplies
it by the x-span, the playback multiplies it by the time. It is deliberately NOT a per-member beam
count: a feathered beam is `fan.beams` straight lines converging at the narrow end, so the drawing
needs the stem positions and the level count at each END, and per-member counts would only mean
something if the lines broke at stems, which is not the notation.

Weights `w_k = lerp(1, 1/ratio, k/(n-1))` (reversed for `rit`), normalized so `Σ quarters` is
**exactly** the total — an exact `Fraction` sum via `fracMul`/`fracDiv`, per the Fraction/float
invariant (the weights are rational because `ratio` is `2 ** (beams - 1)`). Used by:

1. **drawing** (P1) — where the stems go,
2. **playback** (P3) — when each note sounds,
3. **MusicXML export** (P5, later) — the N `<note>`s with `fan="accel"` on the first beam.

Written once so the three can never disagree.

## 3. Phases

**P0 — model + expander.** The `fan` field, the constants, `fanMembers`, unit tests (sum is exact,
direction reverses, n=2 and n=1 degenerate cleanly). No UI, nothing renders. Plus the four places a
new slot field has to be *told about*, none of which the field gets for free:

- **The relay.** `fan` on `RebarEvent` (`utils/rebar.ts`), beside `tremolo` — otherwise a meter
  change or a paste silently eats it. ⚠️ **But NOT copied onto every piece of a tie-split, which is
  what `tremolo` does.** A tremolo interrupted at a barline is still being played across it; a fan
  split at a barline is the cross-barline fan §4 excludes, manufactured behind your back. **The fan
  stays on the first piece and the others lose it** — the split already destroyed the group the
  assertion was about.
- **The beam grouper.** A fanned slot is excluded from `utils/beaming.ts`'s groups the way a pair is
  (it draws its own beam), or a fanned eighth is dragged into its neighbour's group and two beams
  argue over one stem.
- **The other two expansions.** `tremolo` and `fan` on one slot are two contradictory answers to
  "how many attacks?", and `playbackSchedule` `continue`s the whole chord after the tremolo fill, so
  whichever is checked first silently wins. One clears the other, the way `setTremoloPair` takes the
  whole mark off (`ScoreModel.setTremoloPair`). Same for `tremoloPair` + `fan`.
- **What refuses it.** A rest refuses a fan outright, for the reason it refuses a tremolo: you
  cannot accelerate silence. A tuplet member refuses it too for now — the ramp inside a ratio is a
  second normalization and nobody has asked for it.
- **The voice move.** A fifth list, found while building: `moveNoteToVoice` re-applies a hand-written
  payload at both `insertPitch` branches, and drops anything not named in it (the hole `beamOver`
  fell into). The fan travels — it is a property, so unlike a pair there is no partner to be torn
  from — and stands down in front of a tremolo the destination chord already carries.

**P1 — drawing (the important one).** ⭐ **The slot's own `StaveNote` IS member 1 — it is not
suppressed.** Everything the outside world knows about this event hangs off that object: the
ElementRegistry's hit-test, `staveNoteMap`, the selection recolour's SVG group, the tie and slur
anchors, the articulations, the dynamic's anchor. Suppress it and each of those has to be answered
again, one at a time, silently — and "a stemless note has extents but no ink" is the lesson the
two-note tremolo paid for twice. So the renderer keeps VexFlow's note, suppresses only its FLAG (a
`Beam` already does exactly that) and re-tips its stem to meet the fanned line, then paints across
the slot's x-span:
- `count - 1` further stems and noteheads, all at the slot's own pitch (P1 does not have per-note
  pitch — §4), placed at `startFraction × span`,
- the primary beam as one straight line,
- the fanned secondary lines as quads via `fillBeamQuad`, converging at the narrow end and stepping
  to `beams` at the wide end.

⭐ **The written value is not the drawn one — the note is built as a plain QUARTER.** A member of a
beamed group is a filled head with a stem and no flag, and that is what all six of them must be;
drawing the written blanca would put one hollow head among five filled companions, a picture that
contradicts its own beam. So `NoteBuilder` substitutes the drawn value and corrects the ticks
(`applyTickMultiplier`, the slot's length in quarters) — exactly the trick the two-note tremolo's
doubling already makes, in the same function and for the same reason: the WIDTH path builds its
notes through there too, so a substitution made only at the draw site would leave the two
disagreeing about what is in the bar. The dots go with the written value and are not drawn either;
their length is in the multiplier and in the span.

⚠️ **What P1 does NOT do: the extra members are ink, not elements.** Only member 0 — the real
`StaveNote` — is in the registry, so clicking a drawn companion head selects nothing. The fan's ink
is registered as one `beam`-type box so it is not a hole in the page, but per-member hit-testing is
not part of this phase and would be the first thing to add if the fan is ever to be edited by
clicking one of its notes.

VexFlow cannot do this — `Beam.drawBeamLines` steps every level by a constant `beamWidth * 1.5` on
one shared slope, and the line count comes from the note's written duration. The precedent for
drawing beam lines ourselves is `drawCrossBarSideBeam` (the cross-system overhang) and
`TwoNoteTremolo` (a stroke stack at VexFlow's own thickness and step).

🚨 **The width — and it is the COMPUTATION, not the key.** The key is free: `laneFingerprint`
(`MeasureWidthCache.ts`) `JSON.stringify`s `lane.slots` wholesale, so a new field on `Chord` reaches
the width key *and* the shape key by construction — the same freebie `Chord.tremolo`'s comment
records ("`slots` puts it in the WIDTH key too — which is the safe direction"). What does NOT come
free is the number: bar width floors at `slots.length × MIN_NOTE_SPACING` (18px, `MeasureLayout.ts`
— "the floor is what actually spaces music"), and one fanned slot is one slot, so six noteheads are
asked to live in one note's 18px.

So a fanned slot counts as `slotColumns(slot)` columns, used in **both** places the columns are
counted: `noteSpaceForLane`'s `minSpacingWidth`, and `calculateMinimumMeasureWidth`'s
`widestSpacingFloor`. ⚠️ Both, not one — the second's own comment says it counts the same way the
width was built *precisely because* a floor larger than the width it floors makes the bar
incompressible.

⭐ **And the count is NOT `fan.count` — it is what the RAMP needs** (`fanColumns`). Reported from use
after the first version shipped: a `rit.` on a blanca drew its first noteheads on top of one another.
The heads are placed proportionally, so the group's tightest gap is its shortest note, and for that
gap to be one ordinary column the whole span must be `Σw / w_tightest` columns — far more than
`count`. A rallentando is the worst case because it OPENS with its fastest notes, so its tightest gap
falls *inside* the group; an accelerando's shortest note is its last and needs no gap after it, only
its own glyph's room (the `+ 1`). At the default 6×3 that is 11 columns (~198px) for an `accel.` and
16 (~288px) for a `rit.`

The drawing spends exactly what that asks for: gaps are proportional **with a floor** of
`FAN_MIN_HEAD_GAP_RATIO × the notehead's measured width`, and if the bar could not give the room
(a crowded bar, or `MAX_MEASURE_WIDTH` clamping at 400px, which a 12×4 fan blows through) the group
compresses **evenly** rather than piling up at one end. Two heads never overlap; at worst the fan
stops being proportional. One test pins the contract between the halves — *given the width
`fanColumns` asks for, no gap is ever clamped* — because that is what breaks if either number moves
alone.

⚠️ Even so, the width buys room for the **bar**, not for the fan: inside the bar VexFlow's formatter
distributes by tick, so how much of it lands under the fanned slot is not something this controls.
A fan sharing a busy bar is still the case to look at by eye.

**P2 — apply / remove.** Wire the two **Effect** buttons (`accel.` / `rit.`, currently deliberately
unwired in `dev/devToolbar.ts`): with a note selected, set `fan` with the default count and beams;
pressing the lit one again clears the field. Goes through `runBatch` + `saveUndoState` like every
other mutator, and the button's lit state is read from the selection, not pushed — the toolbar
already holds `state`, `palette`, `getEngine` and `onStateChange`, so that is a `keypadSync`-style
predicate and no new plumbing. Two things it needs first:

- **`fan` in the flat `Note` projection** (`noteProjection.ts`, beside `tremolo`/`tremoloPair`), or
  the button cannot see the selection it is supposed to light up for.
- **The engine wrapper commits, it does not `saveOnly`.** A fan changes what SOUNDS, so it belongs
  with the edits that resync playback — the same call `setTremolo` documents itself making, and the
  seam that would otherwise be silently wrong the day P3 lands.

Two things the press decided that the plan had left open:

- **It applies ACROSS THE SELECTION**, unlike the two-note tremolo's one-note press. A fan is a
  property of one event, not a relation between two, so "fan these five notes" reads perfectly well
  (five fanned groups) — and the direction is decided for the selection AS A WHOLE, the rule
  `applyTremoloToSelection` already follows. Rests and tuplet members are skipped, not refused.
- **The two buttons are ONE axis.** A note cannot be accelerating and slowing at once, so
  `fanHighlight` reports the *direction* rather than a boolean: `rit.` lighting darks `accel.`, and
  pressing the other one turns the fan round instead of clearing it. Only the same one clears it.

⚠️ **The Effect palette is the DEV SHELL, and that is temporary** — the same status as everything in
`dev/`: scaffolding around the viewport, not a decided feature surface. It is where the two buttons
live *while the feature is being built and tuned*, because that is the cheapest place to put them and
because the action has to be reachable before its real home is chosen. Nothing in the viewport knows
the palette exists; the buttons call the same `PaletteController` method any later surface would, so
moving them costs one call site. (The Keypad's Beams/Tremolos page is the obvious candidate — it is
where the beam and tremolo clusters ended up, and it is where Sibelius puts its feathered-beam
buttons — but that is a decision for after the numbers settle, not part of this plan.)

**P3 — playback.** `playbackSchedule` expands a `fan` slot into `count` events at the ramped offsets
from `fanMembers`, same pitch, same velocity. The group's total time is unchanged, so nothing after
it moves — and that is not an extra rule to enforce: the offsets are PROPORTIONS of the note's own
sounding length, so they cannot add up to anything else.

⭐ **The same `startFraction` the drawing uses**, which is the whole reason §2 is a pure function: a
notehead 40% along the group is a note at 40% of its time *by construction*, not because two
implementations agree. It expands the SOUNDING length rather than the written one — so a fanned note
tied forward accelerates across the chain, "fill what sounds", the rule the tremolo follows — and
each member takes **its own** articulation's length factor and velocity.

⭐ That last clause used to read "the articulation's", singular and the slot's — and it was the last
place the sound still disagreed with the picture. Members carry their own marks
(`FanMemberChord.articulations`, docs/fanned-beam-pitches-plan.md §3) and the engraving had followed
them for a commit while this had not, so an accent on member 3 was drawn and never heard, and a
staccato on the owner was heard on all six and drawn on one. Member 0 reads `Chord.articulations`
because member 0 **is** the slot's chord — the same rule the drawing follows, which is why neither
needs a special case for it.

⚠️ The **dynamic** is still the whole gesture's, and that is a different question rather than the same
oversight: a dynamic attaches to a POSITION in the bar and every member sounds inside one position.
Only the articulation is per attack.

⚠️ It runs BEFORE the tremolo expansion, and the order is a decision rather than an accident: the
two are mutually exclusive in the model, so a slot carrying both is ill-formed — imported JSON is
reported, never repaired — and something has to win predictably. The fan does.

**P4 — editable count and beams.** Two number inputs in the Properties window, shown only on a note
that HAS a fan. The numbers ARE the model (`FanMark`), so nothing here computes a consequence — it
says what the assertion is, and the drawing and the playback both re-read it at once.

⭐ **It CHANGES a fan and never MAKES one.** A note without one is a no-op: creating and removing
them is the `accel.` / `rit.` press, which is also where the direction lives — offering it here too
would give one fact two owners, and an edit box that could conjure a notation out of a typed number
is a worse door than a button. The window stays a dumb publisher (`fanEditSelection` →
`FanEditController`), the same boundary the note-offset input defends: a content widget never holds
the engine.

The typed number is CLAMPED rather than refused (`clampFanCount`/`clampFanBeams`) — ⚠️ sanity
guards, not engraving claims. Nothing says a 20-note fan is wrong; the ceilings only stop a typo
asking the renderer for a thousand noteheads or a speed ratio of 2^99.

## 3b. The beam row on a fanned slot (his call, after using it)

A fan **owns its beam**: the ramp is one self-contained feathered group, and the grouper flushes at a
fan (§3 P0) so it can never join a neighbour's. So the four beam MODES and the subdivide have nothing
left to say there, and both are now **refused** — `PaletteController.setBeam` and
`toggleSecondaryBreak` skip a fanned slot beside the rests. Not merely unbuilt: a written `begin`
would be inert under the fan and come ALIVE the moment the mark came off, the same resurrection trap
`routeBeamToTremoloPairStyle` avoids by writing `tremoloPairStyle` instead of `beam`.

⭐ **What the row still shows is the ROLE, and on a fan it reads `begin`, never `single`.**
`beamRoleAtRef` answers for a fanned slot itself, exactly as it already does for a two-note tremolo
pair and for the same reason: the grouper cannot see a beam it excluded, so it reported `single`
about a note plainly carrying one. `begin` because the group STARTS there and everything it covers is
inside that one slot — read the other way, on a fan `begin` simply MEANS what `single` means
elsewhere (one self-contained group), so there is no second fact for `single` to report. The reading
survives; the setting is gone.

## 3c. Turning a fan round KEEPS it (his report, after using it)

`rit.` on an `accel.` fan used to build a **default** mark and hand it to `setFan`, throwing away
everything the group had become: *"I create a fan with different notes, accidental alteration and
everything… now if I change to rit I lose all the fan data, it just makes a plain fan with plain
notes, same as the first."* The count, the beams, the spread, the ramp range, the collapsed span —
and, since members carry their own pitches, accidentals and articulations, **the music itself**.

⭐ **Direction is one field of the mark, so the press writes one field of the mark**: `{...current,
direction}`. The spread keeps the member ARRAYS by identity through `normalizeFan`, which is what
keeps every pitch id alive — a selection, a slur anchored on a member and an authored offset all
survive the turn. Only a note with NO fan gets the default shape; that press is a creation, not an
edit. (`FanEditController` had already learned the same lesson the same way: it rebuilt its mark
field-by-field and silently dropped the members on every typed count.)

⚠️ **And the collapse press had to learn about it too.** A multi-note selection means "make one
group" (docs/fan-collapse-plan.md), but a selection *containing a fan* cannot be collapsed — a fan
into a fan is refused — so reading it that way made "turn these two round" do nothing at all. The
collapse is offered only when NOTHING selected is a fan already.

## 4. Deliberately NOT in this plan

- **Per-note pitch** — ⏭️ now planned in **docs/fanned-beam-pitches-plan.md**. ⚠️ And the guess made
  here was WRONG: it says giving members individual pitches is "the point where one slot must become
  N real slots". It is not. Pitch identity and rhythmic identity are separable — the members' pitches
  ride the fan, the slot keeps its one duration, and no pipeline that walks slots sees anything new.
  Dissolving the group into N slots would have handed every re-tile a way to break it (his catch).
- **Making a fan out of notes you already typed** — ✅ now BUILT, in **docs/fan-collapse-plan.md**.
  §0 above says "you enter the time first"; that is one of two ways in, not the only one. Select a
  passage and the press collapses it into ONE fanned slot with an attack per note. ⚠️ It also
  overturns half a sentence here: a fanned slot's total is no longer always its written value, since
  seven sixteenths span a length no notehead spells. The span rides `FanMark.length`, and everything
  downstream was already asking `slotLength`.
- **How much room a fan is GIVEN** — ✅ now BUILT, in `engine/rendering/fanRoom.ts`. §3 (P1) widens
  the BAR by `fanColumns`, and that turned out not to be the same thing as giving the room to the
  FAN: VexFlow shares a bar's width out by TICK, and a fanned slot holds one event's worth of ticks
  however many heads it draws. Reported on a collapsed group of seven sixteenths — *"too contracted
  and unreadable… maybe because we are using just the space of that slot in time?"* — and measured
  at 11px gaps against the 28px the same seven notes had when typed. The fan now asks the FORMATTER
  for `fanColumns × MIN_NOTE_SPACING` (a `StaveNote` subclass that re-asserts its width inside
  `preFormat`, because `TickContext.addTickable` clears the note's `preFormatted` latch and anything
  set from outside is recomputed away), and the DRAWING caps its span at the same number × 1.5, so a
  short fan on a long note stops sprawling to the barline. ⭐ One answer to "how much room does this
  gesture want", read as a floor by the formatter and a ceiling by the drawing.
  - 🚨 **…and an ask must never exceed the bar.** Reserved verbatim, a fan of eight thirty-seconds
    (21 columns = 378px) inside a bar the cap held at 400 pushed the rests after it 56px and 69px
    OUTSIDE their own barline — his screenshot. Two answers, both needed. **`shareFanRoom`**: a fan
    asks for its share of the room the bar actually has, `noteArea × fanColumns / laneColumns`, and
    shares sum to one, so nothing can be pushed out by construction. ⭐ That IS the fix in one line —
    *the room is divided by what is DRAWN, not by what is counted in ticks.*
  - ⭐⭐ **THE LAST MEMBER'S OWN DURATION IS NOT WHITE SPACE** — his third report, and the sharpest
    observation of the three: *"a lot of space between the end of the fan and the rest… interesting
    that it happens with rit but not with accel."* `fanColumns` summed EVERY weight and divided by
    the tightest, so the room reserved included the last member's own duration as air after its last
    head; `fannedBeamGeometry` then left exactly that air, because `startFraction` runs over the
    whole group. On an accel the last member is the SHORTEST — 0.9 of a column, invisible. On a
    `rit` it is the LONGEST — four columns of white, and the room came out of the notes sharing the
    bar. Both ends fixed together: the reservation counts the GAPS (`Σ w_k, k < n-1`) plus one
    ordinary column, and the drawing re-normalizes the shares onto those gaps so the heads fill the
    span. ⚠️ Every gap keeps its proportion, so the picture still says what the sound does — what
    changed is only where the group's space stops and the next note's begins.
    - …and the other half of that boundary: **the group stands off the next note by an ORDINARY
      column** (`FanGeometryOptions.trailingGap`), not by the `minHeadGap` its own heads crowd to.
      Filling the span down to the head gap put the last head 12px from the note after it where an
      ordinary note stands 18px away — *"the last note is almost touching the barline… here it is
      almost touching the rest."* Inside the group the heads crowd; that is the notation. The group
      as a whole is a note like any other.

      🚨 **STILL WRONG, AND LEFT THAT WAY ON PURPOSE — see the open item below.** His verdict after
      the change: *"not fixed… after the fan the space is too close of the next element."*
  - ⭐⭐ **THE CAP IS A PREFERENCE; THE FLOOR IS THE MUSIC** (his question: *"there is still space in
    the line… the bar can grow more"*). `MAX_MEASURE_WIDTH` — "one measure must not dominate" — was
    applied LAST in `calculateMinimumMeasureWidth`, so it also clamped bars that could not compress.
    A bar's incompressible demand (every lane's columns + the clefs and meter it must draw) is now
    the floor under the cap, and a bar that genuinely needs the room takes it; the line then carries
    fewer bars, which is what casting-off is for. Not fan-specific — any dense bar was clamped the
    same way — and it is why the fan fits in the FIRST place rather than merely fitting inside a
    squeeze.
- **MusicXML export** — we have no exporter yet; §2 is the half that would be needed.
- **Tuning the numbers and the ramp** — hand work, by ear, ongoing. See §1.
- **Per-member horizontal spacing** — ✅ now BUILT, in **docs/note-spacing-plan.md §7**. Spacing a
  member used to move the whole fan: a member reports the SLOT's beat, and the group's heads are ink
  between `headX` and `spanEndX` rather than columns a TickContext shift can reach. Both halves are
  fixed there — the member's own beat is the address, and the ramp shares the span that is left
  after the authored gaps come off the top.
- **Per-member horizontal OFFSET** — P0–P1 DONE, in **docs/note-offset-plan.md** ("Inside a FAN").
  Same report as the spacing one and the same two causes: the offset is slot-keyed, so a member's id
  resolves to the owner, and the apply is `setXShift` on a `StaveNote` a member does not have. Keyed
  by the member's first pitch id, applied as an extra x on `stems[k]` *after* the ramp layout — a
  space has width and comes off the top, an offset has none and must not touch the span.
- **Ties into or out of a fanned note.** The tie is drawn from the slot, which now has `count`
  noteheads in it, and the sounding length a tie hands over is the whole group's. Deferred, and
  named here because ties are the pipeline that most reliably surprises this model (the tremolo plan
  deferred them too, and for the same reason).
- **How far the wedge OPENS** — ✅ now BUILT, in **docs/fan-beam-spread.md**. The lines step apart by
  VexFlow's own `beamWidth × 1.5`, which is the tightest they can sit, so the angle drawn here was the
  minimum; `FanMark.spread` multiplies it. ⭐ The first fan control that does NOT move the sound — what
  a reader counts is lines, and spreading them does not change how many there are.
- Fans that don't end in a single beam (2→4), direction changes mid-group, fans crossing a barline
  or a system break, and headless-stem notation (Wikipedia's "approximate number of headless stems").

## 5. ⏭️ OPEN — the space after a fan

**NOT SOLVED, and knowingly left as it is.** Three rounds of his reports moved the room a fan gets
in the right direction — the group is no longer crammed into its tick share, its bar can grow past
the cap, and the last member's duration is no longer drawn as white space — but the last one stands:
*"after the fan the space is too close of the next element… it is wrong."*

⛔ **Do not add a sixth constant.** Five already negotiate that one boundary, each tuned against one
screenshot. This is a symptom of the editor having no spacing rule at all, and it is now tracked as
a whole-editor priority: **`docs/spacing-model-plan.md`** (evidence in
`docs/spacing-model-research.md`). ⭐ It ends this specific symptom by construction: a fan's members
become **ordinary columns** at the beats `fanMemberBeats` already gives them, so the gap after a
group is decided by the same rule as every other gap, and all five constants above go with it.
