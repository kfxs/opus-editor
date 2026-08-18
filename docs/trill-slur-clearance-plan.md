# Trill vs slur — the clearance plan

*Written 2026-08-18, after his report: a `tr` on a note inside a slur's span collides with the arc.*

> 🚨 **AMENDED 2026-08-18, after reading the plan back against the source.** §1's research stands
> untouched; the ENGINEERING did not. Seven corrections, marked in place: the cascade §4/§6 promised
> cannot reach three of the five families (§2's new table), the "main road" §6 left UNKNOWN is much
> cheaper than it says (§6, re-costed), the new constant §5 wanted **already exists**
> (`TRILL_LINE.padding`), P1's coordinate question is answered and has a second half the plan missed,
> P2's `below` justification was wrong about our own code, **ties** belong in the obstacle set
> (Gould p. 139), and the lift leaves the filed ladder claim stale.

---

## 1. The rule, and where it comes from

⭐⭐ **The TRILL is further from the staff than the slur.** Not the other way round.

| source | what it says |
|---|---|
| **Gould p. 135**, *Trills → Design and placing* (the PDF in `reference/`) | *"Place the sign flush with the left-hand edge of the notehead, **further from the note than any articulation marks. Only a long slur, a pause or octave sign goes further from the stave.**"* |
| **Gould p. 138 ex. (d)**, MEASURED at 450 dpi | A slur **starting on the trilled note** — the endpoint case — with the trill **0.55–1.35 sp outside** the arc. |
| **Gould p. 381**, MEASURED at 300 dpi | A dotted *ligado* slur ≈1.5–2.5 sp **inside** the wavy line. |
| **Gould p. 135** double-trills figure, MEASURED | accent 4.0–4.5 sp · `tr〜〜〜` 5.9–6.4 sp · dynamics 8.3–9.9 sp. |
| **LilyPond** (source read) | `Slur` has vertical-skylines and **no** `outside-staff-priority`, so it is an *inside-staff* skyline contributor; `TrillSpanner`'s priority **50** stacks above it. A bare `\trill` Script takes a different road to the same place: `avoid-slur = outside`. |
| **MuseScore** (source read) | `processLines(slurs)` → the slur segment's shape enters the **staff skyline** → `processLines(trills)` autoplaces off it. `Sid::trillMinDistance` = **0.5 sp**. |
| **Verovio** (source read) | Hard-coded positioner order `… SLUR … TRILL …`; `Slur::CollectSpannedElements` deliberately omits `TRILL`/`ORNAM`. Margin **0.5**. |

⛔ **An ornament does NOT follow the articulation rule**, and this is the trap this plan exists to
record. Gould pp. 121–122 (confirming Gerou & Lusk) says articulation goes *inside* a slur mid-span
and *outside* at its endpoints — and the trill obeys neither half: it has its **own rung**, one step
outside every articulation, and it does not flip at the endpoints. Reasoning from the articulation
rule is what produced the wrong answer first time round.

⛔ **UNKNOWN, and deliberately not built** (§7): what a *long* slur does. Gould's sentence exempts
one, but she never defines "long", **no engraving of a long slur over a trill exists in the book**,
and none of the three engines implements the exemption.

---

## 2. Why this is not a one-liner

The above-staff ladder is planned **before anything is drawn**, and a slur's arc does not exist until
after. That is the whole difficulty:

```
3650  planTrillBands        ← PIXEL-FREE: layout columns and beats only
3651  planOttavaBands       ← same (reads occupiedBands, FILES its claim here)
3654  planDynamicsLines     ← same (reads occupiedBands)
        … the measure loop draws the notes …
3747  placeDynamicsOnLine   ← the letters are DRAWN here
3753  renderSlurs           ← the ARC exists only from here
3759  renderHairpins        ← the wedges are DRAWN here
3766  renderTrills          ← reads the band decided at 3650
3775  renderOttavas    3787 renderPedals    3795 placeTempoMarksOnLine
```

⭐ The pixel-freeness is not an accident — it is what let the ladder's planning be hoisted above the
measure loop (`docs/ottava-plan.md`; *"an ottava's VERTICAL is PIXEL-FREE, so no hoist"*), and that
split is what makes the below-staff order come out right at all.

🚨🚨 **AND THE SPLIT IS UNEVEN — this is the table the whole plan turns on** (verified against
`VexFlowRenderer.renderScore`, 2026-08-18). Two families read the ladder at DRAW time and can still
be told; three cannot, and two of those three are already ink by 3766:

| family | its y is DECIDED at | it is DRAWN at | can it see a lift applied at 3766? |
|---|---|---|---|
| dynamics letters | 3654 (pixel-free plan) | **3747** | ⛔ no — drawn before the arc exists |
| hairpins | 3654 (same plan) | **3759** | ⛔ no |
| ottava | **3651** — baseline AND its `occupiedBands` claim | 3775 | ⛔ not without rewriting both |
| pedal | draw time (`PedalRenderer.ts:214` reads `occupiedBands`) | 3787 | ⭐ yes, for free |
| tempo | draw time (`tempoLinePass.ts:141`) | 3795 | ⭐ yes, for free |

⚠️ §4 P2 and §6 were written as if all five could be translated. They cannot — see §6's amended
decision for what the cascade actually covers and what it deliberately leaves.

⭐⭐ **And the hole is bigger than the trill.** A slur is not a ladder member *at all* — it neither
claims a band nor reads one. So nothing above the staff clears a slur today; the trill is simply
where it shows first, being innermost. ⚠️ `inkBand.ts` already says so in its header: *"⛔ It does
not know about articulations, slurs or tuplet brackets"*.

---

## 3. The three designs, and the choice

1. **Predict the arc** inside the pixel-free plan — compute the arch height from the spacing model
   without drawing it. ⛔ Rejected: a second answer to a height the drawing already computes, and the
   two would disagree the moment a hand-nudged endpoint or a `curveShape` override moved the real arc.
2. **⭐ Draw, then TRANSLATE** — trills draw where they always did; a later pass lifts them off the
   slur arcs that are by then on screen. **Chosen.** Precedent: `tempoLinePass` and `dynamicsLinePass`
   are exactly this shape, built for exactly this reason (a system-scope y must not enter
   `measureShapeKey`, which cost 53% of render time when it did).
3. **Hoist the ladder** to after the measure loop — undoes the split and its render-time win.
   ⛔ Rejected — ⚠️ **and that rejection was measured wrong; see §6's "the main road, re-costed".**
   The render-time win (53%) is about a system-scope y entering `measureShapeKey`, which is a fact
   about where the dynamics are *drawn*, not about where the three plans are *computed*. Nothing
   inside the measure loop reads any of the three plans today (`grep dynamicsPlan`: two consumers,
   both after the loop), so moving them is not the loss this line claims.

---

## 4. What gets built

### P1 — the slur becomes an obstacle the ladder can see

`renderSlurs` (3753) already registers, per drawn slur half/segment, a `points` array of **sampled
cubic points** (`curveArc.ts` computes them for arc-proximity hit-testing). ⭐ **The obstacle data
therefore already exists** — nothing new is measured, and the sample is the drawn curve, which is
what MuseScore (20 rects) and Verovio (a thickened bezier) both use rather than a bounding box.

New: `engine/layout/curveObstacleBand.ts` — given the drawn curves and an x-window on one system, the
arc's extreme y on the trill's side. ⛔ Not the bbox: a slur's box spans its whole arch, so a `tr`
near an endpoint would be pushed by ink that is nowhere near it. ⚠️ **Named for the CURVE, not the
slur** — `engine/rendering/slurObstacles.ts` already exists next door (the arch clearance that lifts
a slur over the notes it covers), and two files a letter apart answering opposite questions is a trap
for the next reader. `engine/layout/` is the right home: `measuredRoom.ts` already imports
`ElementRegistry`, so a derived-view module reading the last render has precedent.

⭐⭐ **TIES ARE OBSTACLES TOO, and the case is commoner than the slur's.** A trill's span runs
*through ties* (`Trill.endNoteId` absent = the start note's own sounding duration, through ties), so a
tie under a wavy line is ordinary writing — and it is drawn in the book: Gould **p. 139**, *Change of
trilling note*, *"ties hugging the noteheads with the wavy line above them"* (`reference/README.md`,
third Q&A table). `TieRenderer.ts:182-194` registers the same sampled `points` from the same
`drawCurveArc`, so it is one more type in the same query and no new measurement.

### ✅ The coordinate question, ANSWERED — and it had a second half

**The registered points are in SVG space, not staff space.** `inStaffSpace` wraps the drawing in
`elementRegistry.withScale(k, …)` (`staffScaleGroup.ts:71-77`) and `scaleElement` scales `points`
(`ElementRegistry.ts:582`), while `TrillRenderer`'s own arithmetic is in the staff's scaled space. So
divide by `k` on the way in — the conversion `planSlurSegments` already makes.

🚨 **And the registry cannot tell you WHICH staff or WHICH system an arc is on.** `registerPartial`
stamps every partial of a cross-system slur with the whole slur's `fromMeasure`/`toMeasure`
(`SlurRenderer.ts:580-585`) and no `staff` at all. An x-window alone will therefore happily select an
arc from another system (x's repeat down the page) or from the staff below. Two ways out:

- add `staff` and the segment's own `line` to the slur registration (cheap, explicit); or
- ⭐ **preferred** — have `renderSlurs`/`renderTies` push their arcs onto a `RenderPass` collector
  carrying `(staffIndex, line, points)`, exactly as `pass.occupiedBands` collects claims. The
  registry is the HIT-TESTING list; overloading it with a layout question is what makes the two
  drift.

### P2 — the trill's baseline clears it, ON EITHER SIDE

🚨 **BOTH SIDES, in the same commit — his call, and it is not thoroughness for its own sake.**

⛔ **The reason first given here was WRONG about our own code, and is corrected:** it said *"a trill is
drawn `below` exactly when the staff carries more than one voice"*. It is not. A trill's side is
STORED and flipped only by hand — `side = trill.placement ?? 'above'` (`TrillRenderer.ts:422`),
flipped by `x` through `trillOps.ts:334`. It is the **slur** whose direction is voice-derived
(`SlurRenderer.ts:543-545`: upper voice above, lower voices below). So the mirrored case is not
produced automatically by two-voice writing — it is produced by the engraver pressing `x`, on any
staff at all, which is a thing he can do to any trill in the score at any time. ⚠️ Getting this
backwards twice in one plan is the reason the rule at the top of §1 exists.

⚠️ **And deferring it is what would make it expensive.** A lift written with an implicit "up" in it
is GREEN and wrong on the other side. That is [[project_ottava]] P8's recorded scar verbatim: the
bracket's vertical was built and tested entirely on 8va, where the conversion is the identity, and
every one of those tests passed with the conversion DELETED. Write the lift as *toward the side* from
the first line; `baselineFor` already takes a `side` and already mirrors, and the slur's extreme is
the same sampled points read for their lowest y instead of their highest.

`renderTrills` gains a lift: after reading its planned baseline, take the OUTERMOST of that and the
baseline the slur band earns on its own. ⭐ Per FRAGMENT, in that fragment's own staff spaces — the
family's rule everywhere else.

⛔⛔ **NOT `max(baseline, extreme + TRILL_SLUR_CLEARANCE)`, and NOT a new constant.** Convert the arc's
extreme into an `InkBand` on `InkBox`'s axis — `(arcY − stave.getYForLine(0)) / spacingBetweenLines` —
and put it through the machinery that already exists:

```ts
const fromSlur = clearanceBaseline(slurBand, side, TRILL_MARK_INK, TRILL_LINE)
const y = side === 'above' ? Math.min(planned, fromSlur) : Math.max(planned, fromSlur)
```

⭐ That is **exactly** the merge form — `clearanceBaseline` is monotone in its band and
`mergeInkBands` is a min/max, so `clearanceBaseline(merge(music, slur))` and the outermost of the two
separate answers are the same number. It buys three things the `max` form does not: the mirroring
comes from `clearanceBaseline` (P2's whole point), the floor still applies, and there is **no second
copy of the rule** — `inkBand.ts:11-16` forbids one in as many words: *"a new outside-staff family
calls `clearanceBaseline` with its own two numbers. It does NOT copy these six lines."*

⚠️ The hand nudge (`nudge.outward`) still lands last, on top of the auto-lifted baseline — the
existing line at `TrillRenderer.ts:476`. The engraver's instruction is never clamped by a machine's
guess (that scar is recorded at `TrillRenderer.ts:449-453`).

🚨 **The lift makes the FILED CLAIM stale, and the claim is what the ladder reads.**
`planTrillBands` pushes the trill's `OccupiedSpan` at `TrillRenderer.ts:352` with the **un-lifted**
baseline, and returns only `Map<string, number>`. A lift must rewrite that entry's `band`
(`markBand(liftedBaseline, TRILL_MARK_INK)`) or the pedal and the tempo mark — the two families that
*can* still see it — will clear a `tr` that is no longer there. So `planTrillBands` must hand back the
claim objects alongside the baselines, keyed by `trillBandKey`.

🚨 **And the cascade reaches only two of the five families — §2's table, and §6's amended decision.**

⚠️ **Do not reach for `HairpinRenderer`'s and `OttavaRenderer`'s "the claim stays on the UN-nudged
baseline" rule here.** That rule is about a HAND nudge — the engraver overruling placement, which
must not shove its neighbours. This is automatic avoidance, which is the case every engine cascades.
⭐ The field splits on exactly that line and agrees with us about the nudge: LilyPond's `extra-offset`
is applied at stencil-emit time, *"the typesetting engine is completely oblivious to it"*.

### P3 — the drawn `tr` moves, and so does its square

The endpoint handles read the registry (`trillEndpointHandles`), so they follow the drawing for free.
✅ **Confirmed 2026-08-18, all three:** the handles are derived from what the last render drew
(`interactions/elements/trillHandles.ts` — *"the registry is the list"*, and both squares sit on the
band's middle, so a moved band moves them); the registry entry's box and the guide's near end are
both built from the same drawn `y` inside the fragment loop (`TrillRenderer.ts:542-582`), so a lift
carries the box, the squares and the guide together; and the **ghost is unaffected** — `TrillGhost`
draws the plain sign at the pointer through `drawTrillSign`, with no baseline of its own to lift.

---

## 5. The numbers

⛔ **THERE IS NO NEW NUMBER, and that is the finding.** The plan proposed
`TRILL_SLUR_CLEARANCE = 0.5 sp` from MuseScore's `Sid::trillMinDistance` 0.5, Verovio's margin 0.5 and
LilyPond's default outside-staff padding 0.46 — three independent agreements, and **we already hold
that number**:

| constant | value | where | source |
|---|---|---|---|
| `TRILL_LINE.padding` | **0.5 sp** | `rendering/trillStyle.ts:155-158` | LilyPond's `TrillSpanner` defaults, taken when the trill family was built |

So the three engines agree with the constant the family already uses to clear a notehead, and the
slur is cleared by the same 0.5 for free once P2 goes through `clearanceBaseline`. ⚠️ A second
constant of the same value, tuned separately, is two answers to one question — and the one place it
would show is a taste session where he moves one and the other stays.

⚠️ `TRILL_LINE.minFromStaff` (1.0) keeps floors as they are: an arc that dips inside the floor cannot
pull the `tr` *toward* the staff, because the outermost-wins rule above never moves it inward.

---

## 6. The cascade — ANSWERED BY THE FIELD, 2026-08-18

The open question was: *if a trill is lifted off a slur, do the ottava, the dynamics line and the
tempo mark above it — all planned against the un-lifted band — move too?*

⭐⭐ **All three engines cascade, and none of them places a later object against a snapshot of an
earlier one's pre-push position.** Read in code:

| engine | the merge |
|---|---|
| **LilyPond** | `add_grobs_of_one_priority` (`lily/axis-group-interface.cc:699`) pushes the grob's **raised** skyline into the accumulator right after moving it — `avoid_outside_staff_collisions` raises the local copy by the same `move` it translates the grob by. It cascades *within* one priority too. |
| **MuseScore** | `Autoplace::autoplaceSegmentElement` translates the shape and calls `staffSkyline.add(shape)` immediately. ⚠️ Spanner segments are the exception — a whole family lands as a block at the end of `processLines`, so SIBLING trills don't see each other, but the next FAMILY does. |
| **Verovio** | `AdjustFloatingPositionersFunctor` stores the positioner **by live pointer** in `m_overflowAboveBBoxes` with its `yRel` already updated; every later class reads moved geometry. |

⭐⭐ **And the deeper agreement: all three lay the SLUR OUT BEFORE the ladder.** LilyPond seeds the
accumulator with `inside_staff_skylines`, which is where a slur lives; MuseScore runs
`processLines(slurs)` before `processLines(trills)` — and its ottava and pedal passes come *after*
trills, so they read the lifted one; Verovio orders `SLUR` before `TRILL`. **Nobody plans the band
stack first and lifts afterwards**, which is exactly what §2 describes us doing.

### So the decision — 🚨 AMENDED 2026-08-18, after reading the pass order

The decision as first written was: **do it as §4 says (draw, then translate), AND translate the
ladder entries above by the same Δ** — MuseScore's `SystemLayout::updateSkylineForElement`
(`systemlayout.cpp:2546`), which walks the recorded skyline elements and translates the matching one
when an articulation moves after being recorded. ⚠️ **Their REPAIR path, not their main road**, and
this plan should say so out loud.

⛔ **But "translate the ladder entries above" is not a thing this pass order can do.** §2's table is
the correction: by the time a lift is known at 3766, the dynamics letters (3747) and the hairpins
(3759) are already **ink**, and the ottava's baseline *and* its filed claim were fixed at **3651**.
Only the pedal and the tempo mark still read `occupiedBands` at draw time. So the cascade, honestly
scoped, is:

| family | what the cascade does | cost |
|---|---|---|
| **pedal** (3787), **tempo** (3795) | ✅ rewrite the trill's `OccupiedSpan.band` in place; they read it | one line, once P2 returns the claims |
| **ottava** (3775) | ⚠️ possible but two writes: the `ottavaBands` map entry AND its own already-filed claim, or re-run `planOttavaBands` after the lift — which then invalidates the dynamics plan that read the ottava's claim at 3654 | a chain, not a line |
| **dynamics letters** (3747) | ⚠️ possible in principle: `placeDynamicsOnLine` is idempotent by construction (`dynamicMarkTransform`: *"SET, never add"*, keeping components rather than the sum), so it can be re-applied with an amended plan | a second placement pass |
| **hairpins** (3759) | ⛔ drawn paths, not a transform — re-running duplicates ink | would have to move after 3766 |

⭐ **Build the first row, document the rest as the known hole.** The visible failure of the hole is a
gap that is too SMALL between the `tr` and an `8va`/dynamic above it — never the collision he actually
reported, which is the trill through the slur, and which the lift fixes outright.

### ⏭️ The main road, RE-COSTED — it is cheaper than this plan believed

The main road is *get the arc laid out before the ladder is computed*, which is what all three engines
do (above). This plan said it *"requires the arch height to be derivable without drawing"* and left it
UNKNOWN. ⭐ **That is the wrong requirement.** It requires only that the ladder's three plan calls run
**after the slurs are drawn** — and nothing prevents that today:

- `dynamicsPlan` has exactly **two** consumers, `placeDynamicsOnLine` (3747) and `renderHairpins`
  (3759), both after the measure loop. The comment at `VexFlowRenderer.ts:3631-3636` justifying the
  hoist — *"early enough for a family drawn INSIDE the loop to read it (P0b: the tempo mark)"* —
  describes a capability with **no live client**;
- the three plan calls take `plans`; `placements` is `plans` + a stave pushed one-for-one in the same
  order (that renderer comment says so), so they compute the same answer after the loop;
- `renderSlurs` needs only `staveNoteMap`, so it can run immediately after the loop.

The order would become: *measure loop → `renderSlurs` → `planTrillBands` / `planOttavaBands` /
`planDynamicsLines` → `placeDynamicsOnLine` → `renderTies` → `renderHairpins` → `renderTrills` →
ottava → pedal → tempo.* ⭐⭐ Then the **whole** ladder clears the real arc by construction, the
cascade problem does not exist to be repaired, and we are doing what §6 says the field does instead
of its repair path.

⚠️ **What it costs, and why it is a SPIKE and not a decision:** the three plans stop being pixel-free,
which is the property `docs/ottava-plan.md` chose deliberately; the hoist comment must be checked
against what the tempo mark actually does rather than against what it says; and the render-reuse path
(`replaySnapshot`) has to be re-read for whether a REUSED measure can reach this. ⛔ Do not reorder
those five calls on the strength of this paragraph — `VexFlowRenderer` says *"move this call and you
change the engraving"* over three of them, and it is right.

### ⚠️ One caution against over-simplifying either road

LilyPond and Verovio both keep the accumulator as a **list of boxes with pairwise padding**, never a
single scalar band height — LilyPond decides `pad = max(padding, other_padding[j])` per PAIR. Our
one-number-per-rung ladder cannot express that, and a case that needs it will look like a tuning
problem rather than a modelling one.

### Still open

0. 🚨 **The three families the cascade cannot reach** — see the amended decision above. Either they
   stay a documented hole, or the main road is spiked and the hole closes by construction.
1. **The long slur.** §7.
2. ⭐ **Does a HAND nudge cascade?** Ours does not, deliberately. The field splits: an explicit
   opt-out silences the object entirely (LilyPond's `extra-offset`, applied at stencil-emit time so
   *"the typesetting engine is completely oblivious to it"*; MuseScore's `NO_AUTOPLACE`, which also
   drops it from the skyline) — but a MuseScore hand DRAG with autoplace still on **does** cascade.
   So "a hand nudge shoves nobody" is right only for the opt-out case, and ours is closer to a drag.

---

## 7. Deliberately NOT in this plan

- **The long-slur exemption** (Gould p. 135). No engraving of it exists in the book, she never
  defines "long", and no engine implements it. Building it would mean inventing a length threshold —
  the kind of invented rule this repo has been caught by before.
- **Mordents, turns and other ornaments.** UNKNOWN: only the trill gets a rung in Gould, and Gerou &
  Lusk are silent. When one arrives it inherits this pass, not a new one.
- **The slur moving.** MuseScore's slur *does* arch over an ornament **articulation** (a
  chord-anchored glyph, 0.20 sp) mid-span — and even there refuses at its own endpoints. Our trill is
  a laddered band, not a glyph on a chord, so that vote does not apply.

---

## 8. Proving it

- **Unit** — `curveObstacleBand`: the extreme over an x-window, the window that misses the arc
  entirely, the bbox-vs-arc discriminator (a `tr` near an endpoint must NOT be pushed by the apex),
  and 🚨 **an arc on ANOTHER SYSTEM / ANOTHER STAFF sharing the x-window is not an obstacle** — the
  registry cannot distinguish them (§4 P1), so this is the test that fails if the discriminator is
  dropped.
- **Browser (`e2e/`)** — the picture is the point, and jsdom measures every glyph as 0×0:
  - 🚨 **the fixture must be LOPSIDED**, the ladder's own recorded lesson: over staff-resident music
    the trill's floor and the slur's arch come out in order *whether anything reads anything*. It
    needs a slur whose arch genuinely rises into the trill's band — a wide leap under a short slur.
  - 🚨 **and the lopsided fixture must also carry a DYNAMIC** — `e2e/ladder.e2e.ts:54` already asserts
    trill → dynamic → tempo on a fixture with **no slur**, so it stays green straight through the
    cascade hole. A fixture with both is the only thing that measures whether the hole is where the
    plan says it is.
  - the endpoint case (Gould p. 138 (d)): a slur STARTING on the trilled note, trill still outside.
  - ⭐ **the TIE case** (Gould p. 139): a trill whose span runs through a tie, the tie hugging the
    noteheads and the wavy line above it.
  - 🚨 **the `below` MIRROR** — the trill flipped with `x` (⛔ not "a second voice": a trill's side is
    stored, not voice-derived — see P2). ⛔ Not optional: a one-sided implementation passes every
    above-staff case with the side term deleted.
- **Break-tests** — delete the read, and the lopsided fixture must go red; replace the sampled arc
  with the bbox, and the near-endpoint case must go red; ⭐ delete the claim rewrite (P2), and a
  fixture with a `Ped.` or a tempo mark under the lifted `tr` must go red.
