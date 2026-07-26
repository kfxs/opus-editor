# Joining a fan to the beam on its left — plan

## 0. The decision

**A fan can be joined to the group on its LEFT, never on its right, and only at its owner.**

The owner is the only slot the grouper can see — members are pitches inside one event, not slots —
so the left end is the only end that *can* join. Nothing is added to the model to say so: the join is
`beam: 'continue'` authored on the owner, the field and the key that already exist.

⭐ **`continue` is the exact word, not a spare key.** The grouper's own definition (`beaming.ts`) is
"a beam coming in and a beam going out" — and on a fan the outgoing beam is its own feathered one. So
the two states are the two readings:

| the fan | role | means |
|---|---|---|
| alone | `begin` | a beam goes out (into the ramp) — shipped in `3106847` |
| joined left | `continue` | a beam comes in AND goes out |

`end` and `single` stay impossible — a fan always has an outgoing beam — and the subdivide stays
refused. So the beam row keeps exactly one live key on a fanned slot, and it is `continue`.

**The fan renderer draws the WHOLE joined group by hand** (his call). Not "VexFlow's beam meets our
ramp at the shared stem": that would be a polyline of three slopes where a beam group must be one
straight edge, and it would put two owners on one stem tip (VexFlow's beam sets it, the fan's
`stemLift` moves it). One line, one owner, one pass.

⚠️ "By hand" is about the BEAM LINES, and only them. Every stem in the joined group stays the note's
own `Stem` object, re-aimed and drawn — see P1.

## 1. Phases

**P0 — the model and the reading. Nothing on the page changes.** ✅ DONE.
- `computeCrossBarBeamGroups`: the fan branch stops flushing unconditionally. With
  `slot.beam === 'continue'` **and a group already open**, push the fan in and flush immediately —
  joined behind, never bridging in front. With nothing open the mark is inert (a fan is not a group
  of one).
  ⚠️ **The barline does NOT flush by itself.** `opened` already counts a leading `continue` as
  opening the boundary — "across a barline there is nowhere else it could come from" — and a fan
  carrying one satisfies that test word for word. The group would cross, `planCrossBarBeams` would
  build a `CrossBarJoin` over it, and the placeholder would take the fan's own stem away while a real
  `Beam` was built over its quarter-note `StaveNote`. So P0 adds `&& !first.fan` to that test, and P3
  is what removes it again.
- `beamRoleAtRef`: a fanned slot answers `continue` when it sits in a group, `begin` otherwise. Never
  `end` — ⭐ although the generic rule below would say exactly that, since the fan is always the LAST
  member of its group (pushed, then flushed immediately). That also makes "at index > 0" and "in a
  group at all" the same sentence, and it is why the fan still answers for itself rather than falling
  through to the loop.
- `PaletteController.setBeam`: `continue` is allowed through on a fanned slot; the other three and
  the subdivide stay filtered. ⚠️ It must **toggle** (`continue` → `auto`), because `auto` has no key
  on the pad — without that there is no way to unjoin.
  ⚠️ And `beamHighlight` darkens the whole AUTHORED row on a fanned selection (`selectionIsFanned`),
  so the key would never light what it just wrote — the same gate has to let `continue` through. Left
  as it is, the only feedback is the ROLE, which reads `begin` while the field says `continue` on an
  inert mark: the press that did nothing and the press that unjoins then look identical.
- `VexFlowRenderer.buildBeams`: strip a fanned slot out of any group before handing it to `new Beam`
  — **before `calculateBeamGroupStemDirection`**, or the prefix takes a direction the fan helped
  decide and P0 stops being invisible — and **drop what is left if it is under two notes**. A lone
  eighth in front of a fan now forms a group of 2, and `new Beam` of one throws; the throw is caught
  and warned, but only after the loop has already forced that note's stem, so it flips a stem and
  keeps its flag. The strip is a tail-drop (the fan is always last), so `secondaryBreakIndices` needs
  no re-basing.
  P0 leaves the prefix beamed by VexFlow exactly as today, so the page is unchanged and the only
  visible difference is the `continue` key lighting.

**P1 — the drawing.** The joined group's beam becomes ours, end to end. ✅ DONE.
- *Pre-format*: every **prefix** note gets the group's shared stem direction and `PLACEHOLDER_BEAM` —
  the flag-and-stem suppression `applyCrossBarPlaceholders` already uses. No `Beam` is built for the
  group.
  ⚠️ **The OWNER is left alone**, and that is not a shortcut. `StaveNote.draw` skips the stem whenever
  `note.beam` is set (`shouldRenderStem = this.hasStem() && !this.beam`), so a placeholder there would
  delete the one stem this whole feature anchors its line to; and `getStemExtension()` answers
  `stemBeamExtension` once `beam` is set, which MOVES `topY` and would make a joined fan sit at a
  different height from an unjoined one — the "members at one pitch reproduce the note's own stem
  exactly" property, gone. Nothing is bought by it either way: `NoteBuilder` already builds a fanned
  slot as a plain quarter, so there is no flag to suppress.
- ⚠️ **The shared stem direction has to reach the owner twice.** The prefix picks it up from the
  placeholder pass; the owner has no beam, so the post-format multi-voice re-assert — which refreshes
  `intendedStemDir` only for notes where `hasBeam()` — drags it back to the voice's own side and
  leaves it disagreeing with the beam it is joined to. Its entry must be updated with the others.
  ⏭️ Open: whether the fan's MEMBER pitches vote on that direction at all. They are not in
  `slot.notes`, so `calculateBeamGroupStemDirection` cannot see them today.
- *Post-draw*, inside `drawFannedBeams` (where every x and head y is finally real):
  `fannedBeamGeometry` gains a **prefix** — one entry per preceding note, each with its stem x and
  head ys, positions FIXED by the formatter rather than by the ramp.
- ⭐ **The joined line is HORIZONTAL in v1** (his call — the third answer, and the cheapest of the
  three). Flat means there is no angle to argue about: the line sits at the height the outermost note
  in the group asks for and every stem stretches to meet it, which is precisely the floor pass that
  already exists ("largest ask wins, the whole line moves") with the slope forced to zero. Less code
  than either alternative, and ordinary engraving besides — a beam goes horizontal when its notes do
  not move consistently one way.
  ⚠️ **The thing to look at by eye:** a fan ALONE leans, because its members have their own pitches,
  so joining one visibly straightens its own beam. If that reads as a snap rather than as a beam, the
  alternative is to slope the line over the WHOLE group — first prefix stem to last member, VexFlow's
  own rule — at the cost of the anchor: the line would then pass through neither the prefix's natural
  tip nor the owner's, `stemLift` would stop being the exception, and both ends would need re-aiming.
  Recorded, not built.
- Each prefix stem is re-aimed onto the line with `stem.setExtension` and drawn as the note's **OWN
  `Stem` object** — `stem.adjustHeightForBeam()`, then `setContext(ctx).drawWithStyle()`, the pattern
  `drawCrossBarLoneFragment` spells out. 🚨 NEVER a hand-drawn line, whatever it costs: the selection
  highlight resolves a stem BY THAT OBJECT'S SVG element (`getStaveNoteSVGGroup`), so ink drawn any
  other way can never be selected. Then the prefix's beam quads, then the ramp as today.
- **Prefix beam levels** = the beam count the prefix's own duration asks for, taken as the MINIMUM
  across the prefix (uniform in every ordinary case; mixed values are P3). Extra levels step inward
  by `beamWidth × 1.5`, the same step the fan uses. ⚠️ They eat into the stems exactly as the fan's
  do, so `minStemLength` takes the LARGER of the two extensions — a 32nd prefix joined to a one-beam
  fan is the case that under-reserves otherwise.
- The fan's registered ink rect grows to cover what is now drawn — LEFT to the first prefix stem, not
  merely taller — so clicking the joined beam still selects the fan. Its ORDER is already right:
  `drawFannedBeams` runs before `registerSlotElements` and `getAt` returns the last match, so the
  prefix noteheads still win their own clicks.

**P2 — fan to fan.** The left fan's last member and the right fan's owner. Both stems are already
ours, so this is one more quad and a line that spans two slots' geometry — but it needs the two
ramps' end/start levels reconciled, which is why it is its own phase.

**P3 — across a barline, and across a system.** His "we will have to tweak for multi bar". The
grouper gives the crossing away for free (a leading `continue` already speaks for the boundary); the
drawing does not — a joined group spanning two bars belongs to the **top-level** post-measure pass
like `drawCrossBarBeams`, not to a measure group that gets reused.

## 2. Decisions taken, and where they will show

- **A `rit.` joined leftward shows a thickness change at the owner's stem** — its wide end is on the
  left, so 1 line arrives and `fan.beams` leave. v1 simply starts the extra levels at the stem, which
  is what a partial beam looks like anywhere else. ⚠️ His eye, not a rule I can verify.
- **An `accel.` is the clean case**: narrow end (1 line) on the left, meeting an eighth-note group
  exactly.
- **The prefix's own beat grouping is untouched.** The join only removes the break in front of the
  prefix's last note; where that group started is still the meter's business.
- **A rest between kills the join** (it flushes), unless it is `beamOver` — which already means
  "silent continue" and so carries the group up to the fan; the fan still needs its own mark.
- **A fanned HALF or QUARTER note may be joined too**, and that is deliberate. The fan branch sits
  ahead of the `isBeamableDuration` break, and a fanned half note already reads `begin` today: the
  fan draws a beam whatever the written value says, so there is nothing incoherent about one arriving
  at it from the left.
- **Nothing about rhythm changes.** Playback, ticks, width and `fanColumns` are all untouched: the
  fan already bought its own span, and the prefix is ordinary notes.

## 3. Traps to check as it is built

- **The shape key.** `laneFingerprint` stringifies `lane.slots` whole, so `beam: 'continue'` reaches
  both keys by construction — but P1 changes how the PREFIX notes draw, and they are in the same lane
  and bar, so the existing key still covers it. Re-check the moment P3 crosses a bar. It moves the
  WIDTH key with it, which is also right: P1 suppresses the prefix's flags, and a flag is width.
- **Geometry is only real after draw.** The line cannot be computed before the format pass; every
  number it needs (`getStemX`, head ys, the next note's ink) answers 0 or 110px wrong beforehand.
- **`setStemDirection` clears `note.beam`** — and resets the stem's extension with it. The placeholder
  goes on AFTER the direction, the order `applyCrossBarPlaceholders` already keeps; and the prefix's
  `setExtension` waits for the post-draw pass, after the last `setStemDirection` anyone will run.
- **The multi-voice re-assert** runs over notes that "have a beam", so a placeholder-beamed prefix
  note is safe by construction — and the fan's OWNER is not, because it has none. See P1.
- **`fillBeamQuad` and `openGroup`**: the join's ink belongs inside the fan's own `vf-fan` group, and
  `closeGroup` stays in a `finally`.

## 4. Deliberately not here

Joining on the RIGHT (his rule — the last member is not a slot, so nothing can address it); a fan
inside a tuplet; mixed beam counts in the prefix; and any change to what a fan sounds like.
