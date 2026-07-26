# Where a fan's mark starts and ends — plan

## 0. The decision

A fan's feathering covers the whole group today: the wedge's narrow end is member 0 and its wide end
is member `count-1`, hard-wired. His ask is to choose **which member the mark starts on and which it
ends on**, in the fan owner's Properties.

Two rules, his, and everything below is their consequence:

- ⭐ **THE SOUND FOLLOWS THE DRAWING.** The range is not a decoration on top of an unchanged ramp —
  it *is* the ramp. Notes outside the mark sound at the steady base speed; only the ones under the
  wedge accelerate or slow. This keeps the one thing this feature has always been: picture and
  playback are the same function (docs/fanned-beams-plan.md §2), never two.
- ⭐ **A NOTE OUTSIDE THE MARK CARRIES ONE BEAM.** One beam is the base — the same note value the
  wedge's narrow end converges to. So the narrow end joins its neighbours *seamlessly* (both one
  line, both base speed) and the only edge in the picture is at the WIDE end, where the extra levels
  stop at their own stem. That is what a partial beam looks like everywhere else in this renderer.

Because a note outside the mark is a one-beam note at base speed, the **spacing follows for free**:
the heads are placed proportionally to the ramp weights, so a steady stretch draws evenly spaced and
the feathered stretch crowds. "The default space between the notes follows the shape of the mark" is
not a second mechanism — it is the same weights, read by the layout.

⚠️ **"Base speed" is EVEN, not CONSTANT** — and this is the one consequence to hear before believing
the feature works. The weights are normalized so `Σ quarters` is the slot's total (that is the whole
point of a fan: nothing after the group moves), so shrinking the ramp redistributes time to the notes
*outside* it as well. Six notes in a quarter at 3 beams: the first note is `0.267 × total` under the
full ramp, `0.205` with the range at `[3,5]`, against `0.167` for a plain sextuplet. The steady
stretch is genuinely even at every setting; it simply speeds up as the ramp shrinks. That is the price
of "the group's total never moves", not a bug — but it is audible while dragging a boundary, so it is
recorded here rather than discovered.

Default is the whole group (`0 … count-1`), which reproduces today's page exactly.

## 1. The model

Two optional numbers on `FanMark`, 0-based member indices, **inclusive**:

```ts
/** The member the wedge starts on. Absent = 0, the fan's owner. */
rampFrom?: number
/** The member it ends on. Absent = count-1, the last member. */
rampTo?: number
```

Named for the RAMP, not for the beam lines, because after §0 they govern both — the sounding
weights, the head spacing and the drawn levels are one fact with three readers.

- **Absent means the whole group.** No migration, no repair pass: an older file and a fan that has
  never seen this control read identically (docs/project no-JSON-migration rule).
- **`normalizeFan` is the one place they are WRITTEN**, exactly as it is the one place allowed to know
  `members.length === count - 1`. `0 ≤ rampFrom < rampTo ≤ count-1`; a count edit that strands them
  pulls them back in.
- ⭐ **ABSENT IS THE ONLY SPELLING OF THE DEFAULT** — `normalizeFan` drops both fields when they come
  out equal to `0`/`count-1`, and drops them outright when `count ≤ 1`, where the inequality above
  cannot be satisfied at all. Two reasons, and the second is not cosmetic: `laneFingerprint` (the
  width key) stringifies `lane.slots` whole, so `{rampFrom: 0, rampTo: 5}` and absence would mint two
  different cache keys for one piece of music. ⚠️ It returns `{...fan, count, members}`, so the spread
  carries a stale range through unless it is deleted on purpose.
- ⚠️ **`fanWeights` clamps AGAIN, and that is not belt-and-braces.** `normalizeFan` runs from exactly
  one place (`ScoreModel.setFan`); `fromJSON` and the undo restore do not, which is precisely why
  every other fan reader is already total — `fanMemberPitches` falls back to the slot's pitches,
  `fanColumns` and `fanMembers` each re-do `Math.max(1, Math.round(count))`. A range read past the end
  of its own ramp is the one failure mode here, it costs one line to make impossible, and clamping
  inside the builder is what makes §2's "one owner" true rather than merely intended.

## 2. One owner for the weight shape

`rampWeights(n, ratio)` returns the accel shape and **each caller reverses it for a `rit`** —
`fanColumns` and `fanMembers` both do it, separately. That must stop before the range lands:
reversing the whole array with an inset range mirrors the mark to the other end of the group. The
direction has to live inside the builder.

P0 introduces **`fanWeights(fan)`** — the one function that owns count, ratio, direction *and*
range — and deletes both caller-side `reverse()`es:

- outside `[rampFrom, rampTo]`: weight `1` (the base, one beam);
- inside: the linear ramp between `1` and `1/ratio` across `rampTo - rampFrom + 1` members,
  descending for `accel`, ascending for `rit`.

⚠️ **`fan` alone, never `(fan, n)`.** `Math.max(1, Math.round(fan.count))` is spelled out today in
`fanColumns`, `fanMembers`, `fanMemberPitches` and `fanMemberOffsetsPx`; handing the count in as a
second argument re-opens the exact disagreement the function exists to close. It reads the count, it
clamps the range against it (§1), and the callers stop knowing either number.

Everything downstream is already wired to it: `fanMembers` → playback (`playbackSchedule`), member
beats, the accidental walk and arrow navigation, and `startFraction` → head spacing; `fanColumns` →
the bar width, through `slotColumns` and both of `MeasureLayout`'s counts. None of those files needs
to learn what a range is.

**Both render keys are free, by construction.** `rampFrom`/`rampTo` live on `slot.fan`, and
`laneFingerprint` stringifies `lane.slots` whole — which is why `measureRenderRoles` says a field
*inside* a slot needs no entry of its own. The width key gets them, the shape key embeds the width
key, and there is nothing to register. Recorded because that is the one question every engraved
element has to answer and every wrong answer to it is silent.

**Travel is free too**: `cloneFanFresh` and `rebar`'s event copy both spread `{...fan}`, so a range
survives copy/paste and a tie-split's first piece without an edit.

## 3. The drawing

In `fannedBeamGeometry`, the primary (`k = 0`) is unchanged — every member is beamed, so it still
runs the whole group (and back over the prefix when joined). Only the extra levels move:

- level `k ≥ 1` spans `stems[rampFrom].stemX → stems[rampTo].stemX` instead of the group's two ends,
  sitting on the primary at the narrow end and at `k × beamWidth × 1.5` at the wide one. It is the
  same expression with two different x's, plus `lineAt()` at both ends rather than the last stem's
  cached tip (the line may slope on an unjoined fan).
- **`startLevels` / `endLevels` change**, and this is the trap: they say what a neighbour meets
  across a join, and an inset end now carries ONE line whichever direction the fan runs. So
  `startLevels = rampFrom > 0 ? 1 : …` and `endLevels = rampTo < count-1 ? 1 : …`. `fanJoinQuads`
  takes the min of the two sides and needs no change — it just gets the right numbers.

Nothing else in the geometry moves: the line height, the floor pass, `stemLift`, the prefix stems
and the flat-when-joined rule are all about the primary, which still covers everybody. `minStemLength`
keeps reserving `fanStemExtension(fan.beams, …)` for every member even where only one line reaches
it — the line is one straight edge, so the room the thickest part needs is the room the whole group
gets, and an inset range does not change that.

## 4. Phases

- **P0 — weights.** `rampFrom`/`rampTo` on `FanMark`; `normalizeFan` writes, clamps and drops them
  (§1); `fanWeights(fan)` owns direction + range and clamps again; `fanColumns` and `fanMembers` read
  it and stop reversing. Sound, head spacing and bar width all follow with no further edits. Unit
  tests: default = today's numbers exactly, an inset range holds the outside members at equal weight,
  `Σ quarters` still the slot's total, a range past the end of a hand-written `count` reads as the
  whole group instead of throwing, and a range equal to the default comes back out absent.
- **P1 — the wedge.** The level loop spans the range; `startLevels`/`endLevels` report an inset end
  as 1. Tests in `FannedBeam.test.ts` (quad x's) and `VexFlowRenderer.fan.test.ts`.
- **P2 — Properties.** Two more inputs on the fan row (`from`/`to`), two more optional fields on
  `FanEditRequest`, merged in `FanEditController` beside `count`/`beams`. Displayed **1-based** —
  "note 1" is the note he typed — and converted at the widget, so the seam and the model stay 0-based
  like everything else.
  - 🚨 **The controller's no-op guard swallows a range-only edit** as it stands:
    `if (next.count === current.count && next.beams === current.beams) return` fires before `setFan`
    on every press that changed nothing else. It must grow to the two new fields, or the whole
    feature ships dead with nothing red to show for it.
  - **Merged, not clamped, here.** The range clamp needs `count`, and `setFan` → `normalizeFan`
    already holds it. `clampFanCount`/`clampFanBeams` stay; nothing joins them.
- **P3 — by eye** (his): accel and rit, both ends inset, a count edit that strands the range, a fan
  joined to a prefix and a fan chained to another, undo. Two cases worth aiming at:
  - **an inset `rampFrom` on a fan joined to a 16th prefix** — the prefix's second beam stops at the
    owner's stem and the fan's own levels do not start until `rampFrom`, so a one-line stretch sits
    between two thick ones. That is the partial beam §0 predicts, and it is its ugliest instance.
  - **an authored member SPACE, then a range edit.** A space is addressed by the member's own beat
    (exact rational, `fanMemberSpacesPx`) and a range moves every member's beat, so an authored space
    inside the group silently falls back to 0. Member OFFSETS are keyed by pitch id and survive
    untouched. A `count` edit already does exactly this, so it is not new — it is just now reachable
    by a second control, and worth seeing once.

## 5. Deliberately NOT here

- **A narrow end wider than one beam** ("even 16ths, then feather out to 32nds"). Still the deferred
  2→4 item (docs/fanned-beams-plan.md §4) — it needs a second beam count on the mark, not a range.
  His answer in this round was the opposite: outside the mark is one beam.
- **Dragging the wedge's ends on the score.** Properties only, as asked.
- **A range that reaches across a join** into the fan or prefix beside it. A range addresses this
  fan's own members; the join keeps meeting it at whatever levels its ends report.
