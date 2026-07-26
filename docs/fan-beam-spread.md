# How far a fan's wedge opens — the spread

## 0. The decision

The wedge's lines step apart by `beamWidth × 1.5` — VexFlow's own step for stacked beams, which is
the tightest they can sit without overlapping. So the angle every fan has been drawn at is the
**minimum**, and his ask is to open it: more air between the lines, a wedge that reads as a wedge
across a room.

One rule, and everything below is its consequence:

- ⭐ **THE SPREAD IS THE DRAWING'S ALONE.** It is the first fan control that does not move the sound,
  and the exception is deliberate rather than a lapse. Count, beams, direction and range are all read
  by `fanWeights` because a reader hears what they see; the spread is not, because what a reader
  *counts* is LINES — one at the narrow end, `beams` at the wide one — and that count is the same
  whether the lines touch or stand apart. It is an engraving dial, like a note offset
  (docs/note-offset-plan.md), not a claim about speed.

Bar width does not move either: this is entirely vertical. Nothing in `fanWeights`, `fanColumns` or
`fanMembers` may ever read it, and there is a test that pins all three at spread 3.

## 1. The model

One optional number on `FanMark`:

```ts
/** The gap at the WIDE end, as a MULTIPLE of the ordinary beam gap. Absent = 1 = that gap exactly. */
spread?: number
```

- **A multiple, not a pixel count and not a staff-space count.** The thing being scaled is a gap the
  renderer already computes from `beamWidth`, so the number stays right when the staff size changes —
  the same reason `minHeadGap` is measured from the notehead rather than pinned.
- **1 is both the default and the FLOOR** — below it the lines overlap, so `clampFanSpread` holds it
  at `[1, MAX_FAN_SPREAD]`. Fractions are real answers (`1.75` is air, not a count); the clamp rounds
  to two decimals, because `laneFingerprint` stringifies the slot and a `1.7000000000000002` off an
  input's step would mint its own width-cache key for the same picture.
- ⭐ **ABSENT IS THE ONLY SPELLING OF 1**, deleted in `normalizeFan`, for `rampFrom`'s reason exactly.
  Unlike the range there is nothing to settle against the count: a spread is about the lines, not
  about the members.
- ⚠️ **Readers clamp rather than trust** (`fanSpread`): `normalizeFan` runs from `ScoreModel.setFan`
  alone, and `fromJSON` and the undo restore do not go near it. A spread of 0 would stack every line
  on the primary and a negative one would draw the wedge inside out.

Both render keys are free by construction and travel is free: `slot.fan` is stringified whole, and
`cloneFanFresh` / `rebar`'s event copy both spread `{...fan}`.

## 2. Three readers must agree, and the fourth must NOT

The gap is drawn in three places, and a spread that reaches only some of them is silent:

1. **the wedge** (`fannedBeamGeometry`'s level loop) — the picture itself;
2. **`fanStemExtension`** — the room the inward lines eat out of every stem. The room asked for has to
   be the room the lines take, or a wedge pulled twice as far open draws its innermost line straight
   through the noteheads;
3. **`fanJoinQuads`** — the lines crossing to a joined neighbour.

…and the fourth is the **PREFIX**: its own extra levels (`prefixBeams`) and its own stem extension
keep the ordinary gap. A 16th group joined to a fan is an ordinary beamed group, and spreading its
lines stops it being one.

## 3. The seam

`FanEditRequest.spread`, merged in `FanEditController` beside `count` / `beams` / the range, and
shown as `wide` on the Properties fan row (step `0.25`, max `MAX_FAN_SPREAD`).

🚨 **The controller's no-op guard is where a new fan field ships dead.** It returns before `setFan` on
every press that changed nothing it knows about — so a field it does not know about changes nothing,
ever, with nothing red to show for it. It compares the spread RESOLVED (`fanSpread`), because absence
and `1` are one assertion spelled two ways and the window always publishes a number.

## 4. By eye

- **A wide spread pushes the beam away from the staff** (that is what §2's stem room means), so a fan
  under a tight system can reach into the staff above. Nothing reserves that room; the staff-spacing
  override is the fix, as it is everywhere else.
- **Two JOINED fans with different spreads step where they meet** — a crossing line leaves the left
  fan at one height and arrives at the right fan's gap. The quads follow the RIGHT fan, whose `lineY`
  they are built from and whose stems they land on. Same class of edge P1 already accepts at a prefix
  (1 line in, `fan.beams` out); the fix is to match them.
- A spread on top of an **inset range** (docs/fan-ramp-range-plan.md): the range says where the wedge
  is, the spread says how far it opens. They compose, and neither knows about the other.

## 5. Deliberately NOT here

- **Dragging the wedge open on the score.** Properties only, as the range is.
- **A spread that changes the SPEED.** That would be the other feature entirely — see §0. The ratio
  is still `2^(beams-1)`, read off the beam count, which is what the reader counts.
- **Spreading an ordinary beam group's lines.** This is a fan's field; an ordinary beam is VexFlow's
  to draw.
