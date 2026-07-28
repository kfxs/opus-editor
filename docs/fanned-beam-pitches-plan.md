# Per-note pitch in a fanned beam — plan

Today every member of a fan is drawn at the slot's own pitch. This gives each one its own, and lets
you edit it: click a member, arrow it up or down, retype it with `a`–`g`, add a chord note with
`Shift`+a letter. Continues docs/fanned-beams-plan.md, which deferred exactly this.

## 0. The slot does not move

**One fanned group is ONE event, of one written duration, and that does not change.** The blanca you
typed still fills two beats, the bar still subtracts two beats to know what is left, and `fan.count`
is still the assertion "played as six".

Not bookkeeping — the reason is structural. As six real slots the bar would still sum correctly, but
the group would become six things that any re-tile can break: a meter change cutting it at a
barline, a paste landing in its middle, a rebar splitting it in half. That is the two-note tremolo's
relation problem, and it cost two sessions. One event cannot have it: it is indivisible by
construction, and removing the field still leaves exactly the note that was typed, because that note
was never moved or copied.

So only PITCH identity changes. Rhythmic identity is untouched, and no pipeline that walks slots —
rebar, rest-fill, meter change, collision, clipboard, undo, JSON — sees anything new.

## 1. The model

```ts
// on FanMark (src/types/music.ts)
members: NotePitch[][]   // the pitches of members 1…count-1; member 0 IS the slot's own `notes`
```

**Member 0 is the note you typed.** It is not copied into the list, it stays the slot's own chord —
which is what makes "delete the fan and the typed note survives" literally true rather than
reconstructed. The invariant is therefore `members.length === count - 1`, written out because it is
an off-by-one that only one function is allowed to get right.

**Real elements, not data hanging off the mark.** A fan is an event scoped in time, and what is
inside it are elements — so a member's pitches are `NotePitch`es with ids, the same thing a pitch is
everywhere else. Storing bare spellings addressed by index was considered and rejected: it is
cheaper plumbing (no second home for a pitch id, nothing to re-mint) but it makes a member not a
thing, which is not what a fan contains.

**Dense, not sparse**, for the same reason. Click-select needs an id per member head, and a member
with no stored pitch has none — it would need a synthetic locator that materialises on first edit,
so half the heads would carry real pitch ids and half synthetic ones, changing as you work. Every
command that resolves an id would need both paths. Dense gives every member a real `NotePitch` id
the moment the fan is applied, so selection, `getNote`, the arrows and `a`–`g` all see the kind of id
they already handle. (The sparse shape's one attraction — editing the first note carries the
un-edited members with it — is as often surprising as helpful once you are assigning pitches.)

**`count` and `members.length` must not drift**, so exactly one function keeps them in step
(`normalizeFan`, called by `ScoreModel.setFan`): materialise on apply as copies of the typed note,
append copies of the LAST member when the count grows (a rising line continues; jumping back to the
first is never what was meant), drop from the end when it shrinks. One invariant, one place —
readers never repair.

⚠️ **`normalizeFan` is PURE — it returns a fresh `members` array and never mutates the one it was
handed.** `toFlatNote` hands out the LIVE `chord.fan` (`engine/models/noteProjection.ts:43`, the
`getDynamicById`-is-live trap), and `FanEditController` builds its next mark by spreading it
(`{...current, count}`) — so a normalize that edited in place would reach through the spread and
write into the model behind the mutator's back. Undo is safe either way (`UndoRedoManager` snapshots
by JSON round-trip), which is exactly what would make this silent.

## 1b. Copy and paste: a fan is all or nothing

**Select the whole fan and you copy the whole fan** — the mark, its count and beams, and every
member's pitches. It pastes as what it is: one event, played as N.

**Select anything less and the clipboard gets an ordinary note** — the slot's written duration and
one member's pitch(es), with no fan mark. Not a truncated fan, not the members you happened to
touch. Nothing is invented and nothing is half-copied.

The rule is the indivisibility of §0 seen from the clipboard: half a fan is not a smaller fan, the
same way `fannedBeamGeometry` says a fan with no room is not a narrower fan. It also keeps the
member-level clipboard question (§3) closed — you can never end up holding a piece of a fan.

⚠️ **None of this falls out — it is three edits, and the default behaviour is wrong in both
directions.** Checked against the code:

- `selectedSpans` resolves ids through `getMeasureNotes`, i.e. `slot.notes` only
  (`interactions/clipboard.ts:165`). A member id produces NO span, so copying a member is a **silent
  no-op** today, not "an ordinary note". It has to resolve a member to its slot.
- The capture is by WINDOW, not by id: `flattenRegion` puts `fan` on the event for any slot inside
  the span (`utils/rebar.ts:217`). So a partial selection pastes a WHOLE fan unless `fan` is
  actively stripped at capture.
- The payload would carry `NotePitch` ids, against its own stated invariant ("No model ids are
  stored" — `interactions/clipboard.ts` header). Strip the ids at capture; they are minted at
  materialisation anyway (`engine/models/rebarOps.ts:1262-1275`, the one place a relay piece becomes
  a chord — and the one line P1 owes for fresh ids, since two copies sharing a pitch id means the
  first in tree order silently wins).

**Which pitch a partial copy yields: the FIRST — member 0's, exactly the note that was typed.**
Decided, and decided as PROVISIONAL: the alternative (the member you actually clicked, so what you
selected is what you copied) is the one to revisit once member editing is real work rather than a
new capability. Nothing else in this plan depends on which way it goes.

## 2. Phases

**P1 — model. ✅ DONE.** `members` on `FanMark`, `normalizeFan` (pure), materialise/grow/shrink. The relay
already carries `fan`, so travel is free apart from the fresh ids at materialisation. JSON is free.
No drawing, no playback — the fan still draws and sounds at the slot's pitch after this phase.

> Two things it owed that the plan did not name, both about a fan being an OBJECT where every other
> slot field is a primitive: `FanEditController` rebuilt its next mark field-by-field, which silently
> dropped the members on every typed count (it SPREADS now); and `flattenRegion` put the slot's LIVE
> `fan` on the event, so the clipboard held a reference into the model. `cloneFanFresh` re-mints the
> member ids wherever a fan lands on a new slot (the relay, the voice move, the capture).

**P2 — drawing. ✅ DONE.** Each member draws at its own pitch. Five jobs, and only the first was in view when
this plan was written:

- **Its own head per pitch, and an accidental where the spelling asks for one.** The hand-drawn
  heads carry no modifiers today.
- 🚨 **LEDGER LINES, which is an EXISTING BUG this phase makes routine.** The members are bare
  `NoteHead`s (`engine/rendering/VexFlowRenderer.ts:969-977`) and `drawLedgerLines()` belongs to
  `StaveNote` (`vexflow/build/esm/src/stavenote.js:686`) — `NoteHead` only swaps to the ledger glyph
  code. So a fan on a note above or below the staff **already draws floating heads**, and per-note
  pitch makes off-staff members the normal case rather than the exception. The same hand-drawn path
  has no displaced heads for a chord second, either.
- **The beam gains a slope.** Flat was correct only while every member sat on one line. Slope from
  the first member's stem tip to the last's, clamped — `FannedBeam.ts` says in its own comment that
  this is the day it grows one. ⚠️ The cap is only half of it: each member also needs a MINIMUM stem
  length, or a member far from the beam line gets a stem that inverts past its own head.
- **Stem direction becomes the GROUP's** — decided from the extreme pitch across all members and
  applied to the real note too, because a beam is one line. ⚠️ Single voice only: in a multi-voice
  lane `createStaveNotesFromSlots`'s `forcedStemDirection` already answers this (V1 up, V2 down) and
  the group follows the voice, not its own pitches.
- ⭐ **One SVG group per member** (`openGroup('fanhead', …)` — the bare name, `vf-` is prefixed).
  Cheap here, and it is what turns P3's highlight from a painted rectangle into an ordinary
  recolour: the barline's "paint, don't recolour" lesson is about ink you do not own, and this ink
  is ours. The accidental and the ledger lines come along for free.

🚨 **The trap this phase actually fell into — WHEN the page may be measured.** The sloped beam needs
the real note's stem to reach it, and a stem can only be lengthened BEFORE it is drawn; so the
geometry pass was moved pre-draw, where the numbers are not yet real. Measured on a plain fanned
blanca: `getNoteHeadBeginX()` answers **0** where it will answer 37, and the stem extents put the tip
at **−50** where it lands at 60. The whole group drew at the left edge with its beam above the staff,
the bar still asked for its fanned width, and every later bar jumped a system — and **every unit test
still passed**.

The rule, now stated in the code: `applyFanStemStretch` (pre-draw) **writes and never reads** — the
one number it needs comes from the mark, not the page — and everything that MEASURES waits for
`drawFannedBeams`, after the draw. The stem the real note is missing is simply **drawn by hand**,
from the tip VexFlow gave it to the beam line, which needs no feedback into VexFlow at all. Nothing
is cached between the passes.

⭐ And the guard that was missing: jsdom cannot measure a glyph, but every coordinate the fan
*computes* is real arithmetic that reaches the SVG. `fanRender.test.ts` now asserts the ink is inside
the page, within a notehead of the note's own stem, and near the staff; `NoteBuilder.test.ts` pins
`staffLineForSpelling` against VexFlow's own `getKeyProps().line` in all four clefs. Both fail on the
broken build.

⚠️ **Two things about ACCIDENTALS that are not drawing:**

- ⭐ **A member's accidental HOLDS FOR THE REST OF THE BAR** — his decision, and the ordinary
  common-practice rule: a member is a note in the bar, so it alters its diatonic position like any
  other. It is not free, because the running-accidental state is a walk over `slot.notes` and
  nothing else: incrementally in `NoteBuilder.createStaveNotesFromSlots` (`:163-190`), and as a
  query in `utils/accidentalState.ts`, which `MusicEngine.getPrevailingAlter` (`:2348`) and
  `SelectionController`'s displayed-sign (`:39`) both build on. Left alone, a member F♯ followed by
  an ordinary F later in the bar draws **no natural**. Three consequences:
  - **Members enter the walk at `slot.beat + Σ member quarters`** — `fanMembers` already returns
    those as exact Fractions, and `prevailingAlterations` only ever compares beats, so an
    un-notatable rational is a perfectly good position to walk past.
  - ⛔ **NOT by teaching `getMeasureNotes` to emit them.** It has 23 callers — spans, counts,
    navigation, the clipboard's own `selectedSpans` — and every one of them would silently gain six
    notes per fan. The two query callers take an `AccidentalNote[]` that the CALLER chooses (the
    scope seam `accidentalState.ts` documents in its header), so the new list is one small helper
    beside them and nothing else changes.
  - **The drawing READS the decision, it does not make one.** The walk already decides each pitch's
    displayed sign in slot order; folding the members in immediately after their own slot (where
    they lie) and exposing the decision per pitch id is what keeps the member heads and the
    `StaveNote`s obeying ONE rule. A second accidental rule inside the fan renderer is the drift
    this feature cannot afford.
- **They need horizontal room the width does not know about.** `fanColumns` counts head columns
  (`utils/fannedBeam.ts:98`) and the gap floor is `FAN_MIN_HEAD_GAP_RATIO ×` the notehead's width
  (`FannedBeam.ts:49`); an accidental hangs to the LEFT of its head, so in a dense fan it lands on
  the previous head. The width pass cannot measure glyphs (reference: glyphs don't move the width),
  so the choice is to widen the gap floor where a member carries a sign and accept that the bar was
  not asked for it, or to accept the squeeze. Provisional either way, like every other number here.

**P3 — selection, resolution and the audit. ONE phase. ✅ DONE.** Splitting "you can click it" from "an id
resolves to it" ships a window where the member is selectable and nothing downstream can answer for
it: `updateNote` **throws** `Note ... not found` (`ScoreModel.ts:2290`), and `highlightNote` returns
early because `getStaveNoteSVGGroup` is null (`HighlightController.ts:302`) so a selected member
shows no highlight at all.

- **`ScoreModel.findSlot` resolves a pitch living in `slot.fan.members`.** That is what makes the
  existing keys work unchanged: `ArrowUp`/`ArrowDown`, `Ctrl+Arrow`, `a`–`g` and `Shift`+letter all
  route through it, and `updateNote`'s chord case already writes the spelling onto whichever `pitch`
  it was handed (`ScoreModel.ts:2391-2394`).
- **A registry entry per member head** (`type: 'note'`, its own id, its own `headX`, and the SLOT's
  beat). ⚠️ Not "the same call the ink box already makes" — that one is a deliberately inert `beam`.
  N−1 extra `note` entries at one `(measure, staff, beat)` are read by `pixelXToBeat`
  (`ElementRegistry.ts:858`, which dedups by beat and keeps the leftmost x — harmless *only* if they
  carry the slot's beat), `findNearestNoteOrRest` (`:810`), `findClosestNoteOrRest` (`:959`),
  measure-note selection (`:905`) and the tuplet lookups (`:1239`), plus box-select and note
  navigation on top of those.
- ⚠️ **The audit is the real work, and it covers READERS as well as writers.** Every command that
  resolves a pitch id assuming it lives in `slot.notes` gets read, not trusted — and the failure mode
  is silence, not an error: the delete paths are `chord.notes.filter(n => n.id !== pitch.id)`
  (`ScoreModel.ts:2579, 2686, 2994`), which no-op on a member and report success.
- **The refusals in §3 have to be REFUSALS, not absences.** Once `findSlot` answers for a member,
  the tie command writes `tiedTo` onto that member pitch (`MusicEngine.ts:975-1010`) while
  `TieRenderer` looks the id up in `slot.notes` (`TieRenderer.ts:47`) — stored, never drawn, and
  invisible until someone exports. Same shape for slurs, articulations and a duration change.
- Deleting a pitch from a member with several removes that pitch. Deleting a member's LAST pitch is
  refused: a member is a note, an empty one is not a notation, and the number of members is
  `fan.count` — edited in Properties, not by deleting heads.

> **Built the other way up: `findSlot` finds a member only when ASKED (`{ fanMembers: true }`).** The
> plan had it resolve members outright, with an audit adding the refusals — but then a mutator
> written next year half-writes by default. Failing CLOSED makes every unaudited command refuse by
> not finding it, and five callers opt in by name (`getNote`, `getNotePitch`, `slotIdForNote`,
> `updateNote`, `deleteNote`). `updateNote` writes a member's SPELLING and nothing else; the commands
> that attach to the gesture (tie, articulation, stem flip, convert-to-rest) refuse up front via
> `MusicEngine.refusesFanMember`, so no undo entry is minted for an edit that did not happen.
>
> ⭐ **The bug that came back FIVE times, each in a different disguise: `getMeasureNotes(...).find(...)`
> as "resolve the selected id".** That walk reads `slot.notes`, so it is blind to a member — and every
> piece of the selection machinery was built on it. The palette went stale, arrow navigation was a
> dead end, the pitch DRAG did nothing, `Shift`+letter stacked onto the group's FIRST head, and
> Alt+↑/↓ inside a fan did nothing. The rule now: **resolve a selected id through the ENGINE**
> (`getNote`), and where the question is "what else is stacked here?", ask `fanMemberPitches` —
> because inside a fan **the chord is the MEMBER, not the slot**.
>
> Two more that were invisible rather than wrong:
> - 🚨 **An edit must be COMMITTED, not just written.** The member branch skipped `onCommit`, so
>   `runBatch` counted no undo request, concluded nothing happened, and its caller SKIPPED THE
>   REPAINT — the pitch moved everywhere except on the page (`MusicEngine.runBatch` documents this
>   exact trap; it cost the undo entry too).
> - 🚨 **A per-render map has THREE sites, not one.** Cleared, captured into `MeasureSnapshot`,
>   restored on reuse. The member groups had only the first, so a bar that was REUSED (edit any other
>   bar) lost every member's highlight target while selection kept working — the registry slice is
>   restored, the map was not.
>
> Also built here, beyond the plan's list: arrow ←/→ **walks the members** (each is a stop at the beat
> it sounds on, in `buildVoiceNavBeatMap` only — never in `buildBeatMap`, which drives note ENTRY,
> where a member is not a position you can type at). The member beats have one owner, `fanMemberEntries`.

**P4 — playback. ✅ DONE.** Each member sounds its OWN pitch. ⚠️ **Not three lines — a restructure.** The fan
expansion sits INSIDE the `for np of chord.notes` loop (`engine/audio/playbackSchedule.ts:246`), so
today each chord pitch emits its own run of the whole ramp, which is right while every member shares
the slot's pitches and wrong the moment they don't. It moves OUT of that loop: member 0 sounds
`chord.notes`, member k sounds `fan.members[k-1]`, each pitch its own midi. The tie-chain extension
and the `tiedFrom` suppression above it (`:200-216`) are computed per `np` and only mean anything for
member 0.

The offsets do not change: they are still `fanMembers`'s, still proportions of the slot's own
sounding length, so the group's total time is unchanged by construction.

> Built as `collectFanAttacks`, beside `collectPairAttacks` and for the same reason — both are
> decisions about the SLOT, not about one of its pitches. The tie machinery came out of the loop as
> two named helpers (`isContinuation`, `soundingBeatsOf`) so the fan and the ordinary path read ONE
> rule; member 0 is the slot's chord minus any suppressed continuation, and the pitch projection is
> `fanMemberPitches` — the same one the renderer draws from, fallback included, so a mark with no
> stored members sounds exactly as it draws.
>
> **The one decision the plan left open: what span does the group ramp across when the slot is a
> CHORD whose pitches are tied differently?** Per-pitch lengths were fine while each pitch ran its own
> ramp; one ramp needs one number. It is the LONGEST tie-extended pitch — the event sounds until its
> last-held pitch ends. Single-pitch fans (every fan anyone has made) are unaffected.

## 3. Deliberately NOT in this plan

- **Per-member duration.** The members' lengths come from the ramp; giving one its own written value
  is a different feature and would put the rhythm back into the group.
- **Ties and dynamics on a member.** Refused — actively, per P3 — not merely unbuilt. They attach to
  the SLOT (the whole gesture), which is what they already do.
- ⭐ **ARTICULATIONS ARE THE SECOND EXCEPTION** (2026-07-28, his ask after using it — the same shape
  as the slur one below, and it arrived the same way). This list was wrong to group them with ties.
  A fan is how you write **N attacks** with one written note, and an articulation is exactly the
  thing that belongs to an attack — so the sixth note of an accelerando can be the accented one, and
  marking it is the ordinary `toggleArticulation` on the member's own id.
  - It was found from the other end. The mark lived on the slot, so it was drawn on member 0 alone
    while playback shortened all six — one dot claiming the first note was short and the other five
    were not. Drawing the slot's mark on **every** head fixed that disagreement and produced the real
    report: *"if i apply an articulation to the owner of the fan it applies for all the members...
    this is not wanted"*.
  - What made it possible: `FanMark.members` stopped being `NotePitch[][]` and became
    `FanMemberChord[]` — `{ pitches, articulations? }`. The prose had already said *"inside a fan the
    chord is the MEMBER, not the slot"*; a bare array could only ever hold pitches, so the type now
    says what the feature meant. Member 0 keeps its marks on `Chord.articulations`, because member 0
    **is** the slot's chord and needs no second home.
  - Drawn by `engine/rendering/fanArticulations.ts`: a stand-in `StaveNote` at the member's own
    pitches, clef, stem direction and stem length, formatted by the library, then translated to the
    member's head. ⛔ Not by a hand-rolled "one staff space per mark" rule — that puts a staccato 2px
    off the identical mark on the note beside it, because a between-lines glyph is snapped into a
    space and re-originned.
- ⭐ **SLURS ARE THE EXCEPTION, and this list was wrong to group them with ties** (his ask, after
  using it). A tie is a pitch-to-pitch CONTINUATION, and a member has no length of its own to
  continue into — that refusal stands. A slur is not an attachment to the event's rhythm: it is a
  SPAN between two points, and member 2 → member 5 is a span. So a member CAN anchor one, and the
  dangling-slur sweep counts member ids as live.
  - What made it possible without a `StaveNote`: `drawCurveArc` hands `renderCurve` its endpoints
    EXPLICITLY, so VexFlow's `Curve` only needs *some* note to be constructed with. A member supplies
    its own geometry through `RenderPass.fanMemberAnchorMap`, recorded where its head was drawn.
  - ⭐ **`s` on ONE note inside a fan slurs to the NEXT MEMBER — including from the note you TYPED,
    which IS member 0.** I first restricted that to members proper, reasoning that the typed note
    means "the whole event"; it does not, once you are working member by member (his correction).
    From the LAST member it slurs out of the fan; to slur a fan to something outside it, select both
    ends — that path never asks the question.
  - ⚠️ **Ordering is not free.** Every member reports the SLOT's beat (which is what keeps
    `pixelXToBeat` seeing one column), so `compareByPosition` calls them simultaneous and a span
    built from a selection keeps the CLICK order — a slur drawn backwards, and only when you
    selected the later member first. `compareForSpan` breaks the tie by member index.
- ⭐ **The SLOT'S OWN MARKS, on a member — every surface that shows one belongs to the OWNER** (his
  ask, after using P3; the fan first, then the beam). `getNote` answered for a member with the whole
  slot, so selecting any member lit the Keypad's `accel.`/`rit.`, lit a beam key and the subdivide
  key, and opened the Properties window's `notes`/`beams` row — all offering edits the model then
  refused (`setFan` and `updateNote`'s member branch both resolve WITHOUT `fanMembers`, so nothing is
  written). The refusals were right; the invitation was the bug. `getNote` now drops `fan`, `beam`
  and `secondaryBreak` on a member: the RHYTHM is shared (the member really is that long, at that
  beat — the palette shows its duration for that reason), a MARK is not. It is a statement about the
  whole event, and "which note owns this?" has one answer, member 0.
  - `pressFan` filters members out of the selection as well, next to rests. Left in, a member VOTES
    in the all-or-nothing direction read: owner + its own member would answer "not everything has
    one", and the press that should have cleared the fan would re-set it at the default shape.
  - `beamHighlight` needs its own gate on top of the projection, and it asks **`getBeamRole(id) ===
    null`** — which is the rest rule it replaces, widened by one word. That row reports the ARMED
    beam, so a press on a member (which writes nothing) would otherwise light a key for an edit that
    did not happen. The role is null for a rest, a member and a stale id, and non-null for every real
    note, so one read is the whole rule.
- ⭐ **DELETE ON A MEMBER TAKES IT OUT OF THE FAN** (his ask) — §2 P3 refused it, reasoning that
  `fan.count` in Properties should be the only thing that changes the group's size. That made Delete
  dead on exactly the note you had selected, and "take this one out" has no other way to be asked.
  The last pitch of a member takes the member with it and `count` comes down by one (the two stay in
  step, the invariant `normalizeFan` exists to hold); down to one member the mark comes off entirely,
  leaving the note you typed — what `pressFan` leaves when it clears one. A pitch of a member CHORD
  that has others is still just that pitch.
  - ⚠️ It short-circuits in `MusicEngine.deleteNote` **before** the slot bookkeeping. A member
    reports the SLOT's beat, so `getChordNotesAt` answers for the owner's chord and the "single note
    becomes a rest" branch would have dropped a rest into a bar that still has its event. A slur
    anchored to the removed member is dropped — but only when the whole member went.
- **Copying or pasting a single member.** §1b decides this by making it impossible: a partial
  selection yields the plain note, never a piece of a fan. P3's selection is for editing the pitch
  in place, nothing more.
- Cross-barline fans, MusicXML, and the standing list in docs/fanned-beams-plan.md §4.

**Left standing after P2, and known:** a member CHORD whose pitches are a second apart draws its heads
on top of each other, and two signs in one member stack at one x — the hand-drawn path has no
displaced heads, which is the same gap the slot's own chord never had (VexFlow displaces those). And
`fanColumns` still cannot see an accidental, so a signed member buys its room out of the group's own
span rather than out of the bar's; a dense fan with many signs compresses instead of widening.

## 4. The numbers

Unchanged from docs/fanned-beams-plan.md §1: every number here is provisional and expected to be
wrong. This plan adds two — the beam's maximum slope and the minimum stem length a member keeps
under it — and both live in named constants with the others.
