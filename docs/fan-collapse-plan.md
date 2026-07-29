# Collapsing a typed passage into one fanned gesture — plan

## 0. The decision

docs/fanned-beams-plan.md §0 opens *"you enter the time first"*: you type one ordinary note that
already fills the bar, select it, and the press turns that ONE note into a group. This is the other
way round, and it is his:

> *"suppose I enter a group of notes, let's say 7 semicorcheas… then I select the 7 and apply the
> fan… count the total duration of the 7, create a fan with that duration, set the number of attacks
> to 7 and replace the pitch for the original pitch of the selection."*

Type the passage you want, select it, press `accel.` — and the seven slots become **one fanned slot,
spanning exactly the time they spanned, with seven attacks at the pitches you typed.** The same
feature, entered by ear instead of by description. Nothing about the model in §0 changes: what comes
out is an ordinary `FanMark` on an ordinary slot, and taking it off leaves one note.

⭐ **THE TOTAL IS A LENGTH IN TIME, AND IT NEED NOT BE ONE NOTEHEAD.** Seven sixteenths span 7/16 —
a dotted quarter tied to a sixteenth — and there is no single symbol for it. That was raised as an
obstacle and it is not one, because **a fanned slot's written symbol is never seen**: `NoteBuilder`
already draws a fanned slot as a plain quarter head whatever the slot says (§0's "the drawn value ≠
the written one"), and hands VexFlow the slot's REAL length as a tick multiplier. His answer settled
it — *"that's a duration in time or it isn't"* — and it is. Only the model had to be told.

## 1. The model: the span rides the MARK

One optional field on `FanMark`:

```ts
/** How long the gesture lasts, when that is not the slot's own written value.
 *  Absent = exactly this note's duration — what every fan before this said. */
length?: Fraction
```

⭐ **On the mark, not on the slot, and that is the load-bearing choice.** A slot's sounding length is
cached in `ChordRest.actualDuration`, which is *derived*: `ScoreModel.computeActualDurationForSlot`
recomputes it at a dozen sites, and `fromJSON` deliberately recomputes **every** slot's rather than
trust the wire ("actualDuration is derived state"). A span stored there would be erased by its own
load. Stored on the mark it is authored data like `count`; the recompute reads it —

```ts
if ('fan' in slot && slot.fan?.length) return slot.fan.length
```

— beside the measure-rest and tuplet cases it already has, and three things follow for free:

- **JSON round-trips**, because the load recomputes *from* the mark instead of over it;
- **undo works**, for the same reason (`UndoRedoManager` snapshots by JSON round trip);
- **removing the fan needs no cleanup at all** — the mark goes, the span goes with it, and the slot
  is its written value again. There is no second field to forget.

⚠️ **Absent is the only spelling of the default**, the rule `rampFrom` and `spread` already follow,
and for the same hard reason: `laneFingerprint` stringifies the whole slot for the width-cache key,
so a length that merely restated the written value would mint a second key for one piece of music.
Six sixteenths ARE a dotted quarter, so collapsing six is indistinguishable from marking one — which
is exactly right.

⚠️ **What the slot IS is `duration` + `dots`; what it LASTS is `slotLength`.** Those can now differ
on a fanned slot, and the note on `Chord.fan` that said they never would has been rewritten. Every
existing fan reader already asks `slotLength` — playback, `FanPass`, `fanMemberBeats`, the accidental
walk, `rebarOps.columnExistsAt` — which is why the span reached the sound, the drawing and the bar
width with no further edit. A NEW reader must not reach for `duration` and call it the answer.

## 2. The operation

`engine/models/fanCollapse.ts` — a score operation, so it lives in the core with a thin `ScoreModel`
delegator and a thin `MusicEngine` one (CLAUDE.md's rule; `markOps.setFan` is its sibling).

1. resolve the selected ids to distinct chords, **deliberately without `fanMembers`** so an id inside
   a fan resolves to nothing and the press is refused rather than quietly collapsing its owner;
2. check they are ONE contiguous run of one lane (§2.1);
3. `total = Σ slotLength`, and the written value becomes the **carrier**: the longest single value
   that fits, which `splitBeatsIntoLengths(total)[0]` already answers (it is greedy longest-first);
4. the tail slots become `FanMemberChord`s — pitches plus the marks they were struck with — and leave
   the bar;
5. `setFan(owner, {direction, count, beams, length?, members})`, so `normalizeFan` holds
   `count ↔ members.length` here exactly as it does everywhere else.

`beams` comes from what was typed — sixteenths feather to two lines, thirty-seconds to three, floor
two — read BEFORE the owner is rewritten as the carrier, because the owner is one of the slots and
the fastest note of an accelerando is often the one you typed first.

⭐ **The member pitches keep their ids.** The tail slots are deleted, so the ids are free, and a slur
anchored on one of those notes still resolves — to the MEMBER it became, which the fan supports
(docs/fanned-beam-pitches-plan.md, the slur reversal). **Ties are the opposite case and are cut**:
a tie is a pitch-to-pitch continuation and a member has no length of its own to continue into. A tie
*into* the group survives — member 0 IS the slot's own chord, a real note with a real duration.

Marks travel, events do not: a swallowed slot's articulations ride its member (the `Attack` type),
its beam settings and its tremolo do not. Both of those are statements about an EVENT — how it joins
its neighbours, how it is subdivided — and inside the group there are no neighbours and there is one
subdivision, the ramp.

### 2.1 What is not a passage

Each refusal is the notation talking, not a guard, and each is a **no-op**: fewer than two slots
(one note is what `setFan` is for), a rest or a gap inside the run, two measures, two voices, two
staves, a tuplet member, and a slot that is already fanned (collapsing a fan into a fan would throw
its members away silently).

Contiguity is checked against the LANE, not against the selection: the question is not "are these
next to each other" but "is there anything between them", and walking the lane's own slots from the
first to the last answers both at once — a slot in another voice or on another staff is simply not
in that lane and fails the same test.

⚠️ **A refused press does NOTHING.** `PaletteController.pressFan` used to mark each selected note
separately — five notes, five fans — and **that reading is gone rather than kept beside this one**:
a gesture means one thing, and "fan these seven" is much more plainly a request for one group than
for seven. Falling back to it on a refusal would answer a question nobody asked, in the shape of the
meaning that was just replaced. CLEARING stays per-note (taking a mark off several notes does not
need them to be a passage), which is what keeps the all-or-nothing direction rule intact.

## 3. What it cost elsewhere

- **`markOps.setFan`** keeps the cached `chord.actualDuration` in step on both branches — the mark's
  span when setting, the written length when clearing.
- **`ScoreModel.setFan`** rest-fills the measure after a removal. Removing a collapsed fan hands time
  back to the bar (7/16 sounded, `q.` written), and closing that gap is the bar's rule, not the
  mark's — the same rest-fill every other shortening edit ends with. A no-op for a fan that never
  had a span.
- ⚠️ **The relay re-tiles time, so a collapsed span cannot survive it.** `flattenRegion` emits
  `slotLength`, the relay splits 7/16 into a dotted quarter tied to a sixteenth, and the fan rides
  the FIRST piece (the tie-split rule fans have always had). Left standing, `fan.length` would claim
  time the piece beside it now holds and two slots would sound over each other — so `rebarOps` drops
  the field when it does not match the piece it landed on. The fan reverts to spanning that piece;
  the music keeps its total length, with the tied piece holding what the ramp gave up.
- **The selection** after a collapse is the survivor alone: the other ids name slots the bar no
  longer has.
- ⭐ **The ROOM** — his first report on the finished feature, and the fix is not in this file:
  `engine/rendering/fanRoom.ts` (see the entry in docs/fanned-beams-plan.md §4). The collapse is
  what made it visible — the same seven notes, drawn twice, once at 28px gaps and once at 11px —
  but the cause is older than this feature and applies to every fan: the bar was widened by
  `fanColumns` and VexFlow then shared that width out by TICK, so a slot holding one event's worth
  of ticks got one event's worth of room. A fan asks the formatter for its own width now, and the
  drawing caps it at the same number, which is the other half of what he asked for: *"no matter
  what is the total duration of the fan, the visualisation always looks good."*
  🚨 **The gap AFTER a fan is still wrong** and is left that way deliberately — five tuned constants
  are negotiating one question, and the answer is a real spacing model, not a sixth. See
  docs/fanned-beams-plan.md §5.

## 4. Deliberately NOT here

- **Collapsing across a barline.** A fan cut at a barline is the cross-barline fan §0 refuses.
- **A passage containing rests.** Silence is not an attack. A fan whose interior includes a gap would
  need a member that does not sound, which the ramp has no way to express.
- **Keeping a collapsed span through a meter change** (§3). It would need the relay to treat a fanned
  event as atomic, the way a tuplet is.
- **Un-collapsing** — "give me my seven notes back". Removing the mark leaves the one carrier note,
  as it always has: assertion → consequence is a function, and the reverse is not
  (docs/fanned-beam-pitches-plan.md, the same answer given to dissolving a fan into N slots).
