# Trill vs slur — the clearance plan

*Written 2026-08-18, after his report: a `tr` on a note inside a slur's span collides with the arc.*

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
3651  planOttavaBands       ← same
3654  planDynamicsLines     ← same
        … the measure loop draws the notes …
3753  renderSlurs           ← the ARC exists only from here
3766  renderTrills          ← reads the band decided at 3650
3775  renderOttavas    3787 renderPedals    3795 placeTempoMarksOnLine
```

⭐ The pixel-freeness is not an accident — it is what let the ladder's planning be hoisted above the
measure loop (`docs/ottava-plan.md`; *"an ottava's VERTICAL is PIXEL-FREE, so no hoist"*), and that
split is what makes the below-staff order come out right at all.

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
   ⛔ Rejected.

---

## 4. What gets built

### P1 — the slur becomes an obstacle the ladder can see

`renderSlurs` (3753) already registers, per drawn slur half/segment, a `points` array of **sampled
cubic points** (`curveArc.ts` computes them for arc-proximity hit-testing). ⭐ **The obstacle data
therefore already exists** — nothing new is measured, and the sample is the drawn curve, which is
what MuseScore (20 rects) and Verovio (a thickened bezier) both use rather than a bounding box.

New: `engine/layout/slurObstacleBand.ts` — given the registry's slur entries and an x-window on one
system, the arc's extreme y on the trill's side. ⛔ Not the bbox: a slur's box spans its whole arch,
so a `tr` near an endpoint would be pushed by ink that is nowhere near it.

⚠️ **To verify before coding:** which coordinate space the slur's registered `points` are in. The
pedal and the ottava register inside `inStaffSpace` (the staff's own `scale(k)` group); if the slur's
are in SVG space they must be divided by the scale, the conversion `planSlurSegments` already makes.
A small staff is where this would show.

### P2 — the trill's baseline clears it, ON EITHER SIDE

🚨 **BOTH SIDES, in the same commit — his call, and it is not thoroughness for its own sake.** A trill
is drawn `below` exactly when the staff carries more than one voice, which is exactly when slurs are
drawn below too (the lower voice's stems go down). The mirrored collision is therefore *guaranteed*
by ordinary two-voice writing, not a corner case — and `x` flips a trill's placement by hand on any
staff at all.

⚠️ **And deferring it is what would make it expensive.** A lift written with an implicit "up" in it
is GREEN and wrong on the other side. That is [[project_ottava]] P8's recorded scar verbatim: the
bracket's vertical was built and tested entirely on 8va, where the conversion is the identity, and
every one of those tests passed with the conversion DELETED. Write the lift as *toward the side* from
the first line; `baselineFor` already takes a `side` and already mirrors, and the slur's extreme is
the same sampled points read for their lowest y instead of their highest.



`renderTrills` gains a lift: after reading its planned baseline, take the max of that and
*(slur extreme on this fragment's x-window) + `TRILL_SLUR_CLEARANCE`*. ⭐ Per FRAGMENT, in that
fragment's own staff spaces — the family's rule everywhere else.

🚨 **The lift CASCADES — §6, answered by all three engines.** The ladder entries above this trill on
this fragment's x-window are translated by the same Δ, so an `8va` placed against the un-lifted band
does not end up inside the lifted `tr`.

⚠️ **Do not reach for `HairpinRenderer`'s and `OttavaRenderer`'s "the claim stays on the UN-nudged
baseline" rule here.** That rule is about a HAND nudge — the engraver overruling placement, which
must not shove its neighbours. This is automatic avoidance, which is the case every engine cascades.
⭐ The field splits on exactly that line and agrees with us about the nudge: LilyPond's `extra-offset`
is applied at stencil-emit time, *"the typesetting engine is completely oblivious to it"*.

### P3 — the drawn `tr` moves, and so does its square

The endpoint handles read the registry (`trillEndpointHandles`), so they follow the drawing for free.
⚠️ Confirm the guide line (`applyAnchorGuideLine`) and the ghost are still right.

---

## 5. The numbers

| constant | value | source |
|---|---|---|
| `TRILL_SLUR_CLEARANCE` | **0.5 sp** | MuseScore `Sid::trillMinDistance` 0.5 · Verovio margin 0.5 · LilyPond default outside-staff padding 0.46. Three independent agreements. |

⚠️ First cut, his eye owed — like every other number in this family.

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

### So the decision

**Do it as §4 says (draw, then translate), AND translate the ladder entries above by the same Δ.**
That is MuseScore's `SystemLayout::updateSkylineForElement` (`systemlayout.cpp:2546`), which walks
the recorded skyline elements and translates the matching one when an articulation moves after being
recorded — ⚠️ **their REPAIR path, not their main road**, and this plan should say so out loud.

⏭️ The main road — get the arc's height into the plan *before* the ladder is computed — stays open
and is what the field actually does. It requires the arch height to be derivable without drawing.
⚠️ **Unknown whether it can be**: our arch is a function of the drawn span and the endpoint ys, and a
`curveShape` override or a nudged endpoint can move the real arc afterwards. Worth a spike before
choosing it, ⛔ not worth guessing at.

### ⚠️ One caution against over-simplifying either road

LilyPond and Verovio both keep the accumulator as a **list of boxes with pairwise padding**, never a
single scalar band height — LilyPond decides `pad = max(padding, other_padding[j])` per PAIR. Our
one-number-per-rung ladder cannot express that, and a case that needs it will look like a tuning
problem rather than a modelling one.

### Still open

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

- **Unit** — `slurObstacleBand`: the extreme over an x-window, the window that misses the arc
  entirely, the bbox-vs-arc discriminator (a `tr` near an endpoint must NOT be pushed by the apex).
- **Browser (`e2e/`)** — the picture is the point, and jsdom measures every glyph as 0×0:
  - 🚨 **the fixture must be LOPSIDED**, the ladder's own recorded lesson: over staff-resident music
    the trill's floor and the slur's arch come out in order *whether anything reads anything*. It
    needs a slur whose arch genuinely rises into the trill's band — a wide leap under a short slur.
  - the endpoint case (Gould p. 138 (d)): a slur STARTING on the trilled note, trill still outside.
  - 🚨 **the `below` MIRROR** — two voices, the lower one carrying both the slur and the trill. ⛔ Not
    optional: a one-sided implementation passes every above-staff case with the side term deleted.
- **Break-tests** — delete the read, and the lopsided fixture must go red; replace the sampled arc
  with the bbox, and the near-endpoint case must go red.
