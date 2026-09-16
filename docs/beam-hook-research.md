# The FRACTIONAL BEAM (the "hook") — which SIDE it points, and how LONG it is

> 📄 Research for **P4c** of `docs/beam-engraving-plan.md` (itself P4 of
> `docs/own-engraving-engine.md`). ⛔ **This document decides nothing.** It is the thing §3 of the
> beam plan said had to exist before the hooks could move: *"Until the rule is written down,
> changing it is inventing one."* §7 is the decision list and it is HIS.
>
> **Done 2026-09-01.** Four treatises, three engines, VexFlow's source, and two measured plates.
> ⭐⭐ Unlike the slope (`docs/beam-slope-research.md`), **this one is not a taste call**: the books
> agree with each other, they agree with the engines, and they state the rule in prose *and* draw it.
> 🚨 **We disagree with all of them on two counts, and both are measured below.**

---

## 0. The question

`Beam.getBeamLines` decides, for every note that carries a beam level its neighbours do not, whether
that stub of beam points **left** or **right**. `own-engraving-engine.md` §6.1 lists beam hooks among
the places *"where we currently have no opinion"*. This asks what the opinion should be.

⚠️ **The term of art is "fractional beam"**, not "hook" — and it is the entry every one of the four
books has. (Ross also allows *broken beam*; LilyPond's source calls it a **beamlet**; Verovio a
**partial flag**; MuseScore a **beamlet**; VexFlow a **partial beam**. Six names, one object.)
⛔ Searching these books for "hook" finds the **rest** chapters instead — a quaver rest has hooks.

## 1. The sources, and how to reach each page again

| source | where | page |
|---|---|---|
| **Gould, *Behind Bars*** | `reference/…(Elaine Gould)….pdf`, PDF = printed **+20** | *Fractional beams* **pp. 157–158**; *design* **p. 17** |
| **Ross, *Art of Music Engraving*** | `reference/…(ted ross)….pdf`, PDF = printed **+12** | **p. 124**, *section 9: FRACTIONAL BEAM* |
| **Gerou & Lusk, *Essential Dictionary*** | `reference/gerou-lusk-….pdf` — ⚠️ **2-up**, PDF 17 = printed **30/31** | **p. 31**, *FRACTIONAL BEAMS* |
| **Stone, *Notation in the 20th Century*** | `reference/…(Kurt Stone)….pdf` — ⚠️ **2-up** | **pp. 12–13**, *3. FRACTIONAL BEAMS* |
| LilyPond | `~/dev/engine-sources/lilypond` | `lily/beaming-pattern.cc`, `scm/define-grobs.scm` |
| MuseScore | `~/dev/engine-sources/MuseScore` | `rendering/score/beamlayout.cpp`, `style/styledef.cpp` |
| Verovio | `~/dev/engine-sources/verovio` | `src/view_beam.cpp` |
| VexFlow 5.0.0 | `node_modules/vexflow/build/esm/src/beam.js` | `lookupBeamDirection` / `getBeamLines` |

## 2. What each book says

### 2.1 ⭐⭐ Gould, p. 157 — the rule, in one sentence

> *"A note-value that is only a fraction of a beat takes a fractional beam. **This beam points in the
> direction of the beat or division of the beat to which it belongs**"*

and the special case immediately after it:

> *"In ⅜ and in compound-time dotted-crotchet metres (e.g. ⁶⁄₈), a fractional beam that is part of a
> second quaver **must point in the direction of the second quaver**"* … *"Reversing the beam
> indicates that the semiquaver belongs to a dotted-quaver beat"*

⭐ Note what the rule is **made of**: the *beat*, and the note's position in it. ⛔ Not the durations
of the neighbours. That distinction is the whole of §5 below.

### 2.2 Gould, p. 158 — rests, and ⭐ SHE GIVES TWO OPTIONS

> *"Fractional beams point away from a rest so as to stay inside the main beam. They should remain
> separate from their neighbouring inner beams in order to show that they are a fraction of a beat
> only"*
>
> …then, with a second engraved example: *"**It is equally acceptable to point beams towards the
> rests**, to clarify the metrical grouping"*

⭐⭐ **This is the only genuinely open choice in the whole topic, and it is open because she says so.**
Everything else in this document is unanimous. (A third alternative, *"beams may be extended across
rests, to occupy whole beats"*, is p. 165 and is a **beaming** question, not a hook question.)

### 2.3 Ross, p. 124 — the same rule, plus the length

> *"A fractional beam (also known as a broken beam) is one that is attached to only one note and
> placed just as a normal secondary beam. **It is always inside a group** of two or more notes
> connected by a primary beam **pointing in the direction of the note to which it is a fraction**.
> **The length of the fractional beam is the exact width of the notehead.**"*

### 2.4 Gerou & Lusk, p. 31

> *"A fractional beam is also a secondary beam. Fractional beams are associated with only one note.
> **The length of a fractional beam is the same as the width of a notehead.** … Place exactly the same
> as a full-length secondary beam would be placed. **The beam is always inside the grouping**, and it
> usually follows or precedes a beamed dotted note."*

### 2.5 Stone, pp. 12–13 — ⭐ and he gives the metre-dependence its own example

> *"Fractional beams are used for the individual shorter notes within a beamed group. **They should be
> as long as the note-head is wide** and **must point toward the note of which they are a fraction**,
> usually a dotted note."*
>
> *"In cases of syncopation, fractional beams **must point in the direction of the syncopated note**"*

⭐⭐ …and then, on a drawn *Correct / Incorrect* pair:

> *"This last parenthetical notation is wrong in [¾] because the incorrectly placed first fractional
> beam suggests that the sixteenth is rhythmically grouped with the preceding eighth, whereas it is
> not. **It would be correct if the time signature were binary (⁶⁄₈).**"*

🚨 **That is a second, independent statement that the SAME note sequence takes OPPOSITE hook
directions in different metres** — the exact fact measured in §4. Stone is the only book that says it
about a *metre*; Gould says it about a *beat*; they are the same claim.

## 3. ⭐⭐ Gould's PLATES, MEASURED — ⛔ not read off the prose

A scan beats an OCR when the question is *what did they draw* (`reference/README.md`). p. 157
rendered at 600 dpi, ink-profiled per row; x-ranges in px of the 3× crops in the scratch dir.

**Figure 1 — `♪. ♬ ♪. ♬` under a crotchet beat, the *correct* / *and not* pair:**

| | note 2's stem | its stub | note 4's stem | its stub |
|---|---|---|---|---|
| **correct** | 1706–1713 | **1616–1718** ⇒ **LEFT** | 2317–2325 | **2226–2326** ⇒ **LEFT** |
| **"and not"** | 3611–3618 | **3610–3709** ⇒ **RIGHT** | 4222–4228 | **4217–4317** ⇒ **RIGHT** |

Each semiquaver is the *second half of its own crotchet beat*, so each stub points **back** into it.
⭐ In the rejected version the last stub points right, **out of the group entirely** — which is also
what Ross and Gerou & Lusk forbid with *"always inside the grouping"*.

**Figure 2 — the ⅜ pair, and this is the one that matters:**

| bar | rhythm | note 2's stem | its stub | direction |
|---|---|---|---|---|
| 1 | `♪. ♬ ♪` | 1380–1387 | 1288–**1389** | ⬅ **LEFT** |
| 2 | `♪ ♬ ♪.` | 2341–2347 | **2336**–2438 | ➡ **RIGHT** |

⭐⭐ **Two bars, the same three note-values, opposite hooks.** In bar 1 the semiquaver *completes* the
second quaver (it is the 4th semiquaver, the 3rd being inside the dotted quaver); in bar 2 it *starts*
the second quaver (the dotted quaver runs on past it). Both obey *"point in the direction of the
second quaver"*.

### 3.1 ⭐ …and the LENGTH, from the same plate

The six noteheads in Figure 2 measure **105–106 px**. The two stubs measure **102** and **103 px** —
**0.97 of a notehead**, within 3%. ⭐ Her drawing confirms her own p. 17 sentence (*"These inner beams
are the length of a notehead"*) and Ross's, Gerou & Lusk's and Stone's identical claims.

## 4. 🚨 WHAT WE DRAW TODAY — measured through the SCENE, ⛔ not read

P4a made the beam's quads ours, so the stub x's are real numbers in jsdom. Gould's ⅜ pair, rendered
through `VexFlowRenderer` and read back off the beam group's filled paths:

| bar | rhythm | stems (x) | primary | stub | ours | **Gould** |
|---|---|---|---|---|---|---|
| 1 | `♪. ♬ ♪` | 106.8, 137.8, 155.8 | 106→156 | **128→137** | ⬅ LEFT | ⬅ LEFT ✅ |
| 2 | `♪ ♬ ♪.` | 106.8, 130.8, 148.8 | 106→149 | **121→130** | ⬅ LEFT | ➡ RIGHT ❌ |

🚨 **We draw the same hook in both bars, because we cannot tell them apart.** The signature is the
whole explanation:

```js
lookupBeamDirection(duration, prevTick, tick, nextTick, noteIndex)   // beam.js:472
```

⛔ **There is no beat in it, and no metre.** Its inputs are the *durations of the neighbours*, which
in Gould's two bars are the same multiset. The information her rule is made of never reaches the
function. ⚠️ Her ⅜ example is not an exotic case — it is the plain dotted rhythm of a ⁶⁄₈ jig.

⭐ What VexFlow *does* get right: every branch keeps the stub **inside** the group (a first note or a
note after a break points right; everything else, including the final fallback
`lastBeam.end = lastBeam.start - partialBeamLength`, points left), which is Ross's and Gerou & Lusk's
*"always inside"*. So the failure is precise: **the containment rule is honoured, the beat rule is
absent.**

### 4.1 …and the LENGTH is wrong too, independently of the side

`partialBeamLength: 10` (`beam.js:323`), and the drawn stub measures **9.0 px** against
`STAFF_SPACE_PX = 10` ⇒ **0.9 staff spaces**.

| | fractional beam length |
|---|---|
| Gould p. 17 / Ross p. 124 / Gerou & Lusk p. 31 / Stone p. 12 | **a notehead's width** |
| Gould's own plate, measured (§3.1) | **0.97 notehead** |
| Bravura `noteheadBlack` bbox | **1.18 sp** |
| MuseScore `Sid::beamMinLen` | **1.1 sp** |
| LilyPond `beamlet-default-length` | **1.1** (with `beamlet-max-length-proportion 0.75`) |
| Verovio `fractBeamWidth` | `GetGlyphWidth(SMUFL_E0A4_noteheadBlack, …)` — ⭐ the glyph itself |
| **ours** | **0.9 sp** |

⭐ This one needs no rule-writing: it is a number four books state, two engines round to 1.1, and the
third reads off the font. We are ~24% short of the glyph.

## 5. What the three engines do — ⭐⭐ and LilyPond has BOTH rules and a SWITCH

**LilyPond** (`beaming-pattern.cc`, `Beaming_pattern::beamify`) is the one that implements the books:

```cpp
if (!options.strict_beat_beaming_ && left_count != right_count)
  point_right = right_count > left_count;                       // ← the NEIGHBOUR-COUNT rule
else if ((infos_[i].start_moment_ == cur_beat) != (end_moment (i) == next_beat))
  point_right = infos_[i].start_moment_ == cur_beat;            // ← ⭐⭐ the BEAT rule
else
  point_right = infos_[i].rhythmic_importance_ < infos_[i + 1].rhythmic_importance_;
```

⭐⭐ **Read the first two branches against each other.** Branch 1 is *exactly VexFlow's rule* — which
neighbour has more beams. Branch 2 is *exactly Gould's* — does this note start on the beat, or end on
it. `strict-beat-beaming` is a user-settable property that chooses between them, and the tie-break is
a third notion, "rhythmic importance". ⚠️ So the rule VexFlow implements is not made up; it is
LilyPond's **non-default fallback**, promoted to the only rule and cut off from the beat that
qualifies it.

**MuseScore** (`BeamLayout::calcIsBeamletBefore`) is ordered as: first note ⇒ right; last note ⇒ left;
tuplet edges the same; then beam breaks; then *"if previous or next chord has more beams, point in
that direction"*. ⭐ Structural and neighbour-based like VexFlow's, but it consults **beam breaks**
(`calcBeamBreaks`), which are themselves computed from the time signature's beat groups — so the beat
reaches the decision indirectly.

**Verovio** (`view_beam.cpp`) is purely structural: start-of-beam ⇒ `PARTIAL_RIGHT`; otherwise mostly
`PARTIAL_LEFT`, with a lookdown at the level beneath (*"if the previous level underneath was a partial
through, put it left"*) and one rest special case — *previous element is a rest* ⇒ `PARTIAL_LEFT`,
i.e. pointing back over the rest, staying inside the beam. ⭐ That is Gould's p. 158 first option.

## 6. ⭐ Where they all agree — the part that is NOT a taste call

1. **A fractional beam is one notehead long.** Four books, two engines at 1.1 sp, one reading the
   glyph, and Gould's plate at 0.97. ⇒ we are wrong at 0.9 sp.
2. **It never leaves its group.** Ross and Gerou & Lusk say it outright; every engine enforces it;
   Gould's *"and not"* figure is rejected partly for breaking it. ⇒ we already honour this.
3. **It points at the beat it belongs to** — Gould, Ross, Gerou & Lusk and Stone in four different
   wordings. ⇒ **we do not implement this at all** (§4).
4. **It stays clear of the neighbouring inner beams**, so it reads as a fraction (Gould p. 158). ⛔ Not
   audited here — that is a level/gap question, not a direction one.

## 7. ⚠️ Where they diverge — one place only

**A fractional beam next to a rest.** Gould gives both directions as *"equally acceptable"* (p. 158);
Verovio picks *away from the rest, staying inside the beam*, which is her first. Nothing else in this
topic is contested by any source.

## 8. ⏳ THE DECISIONS

### ✅ WHAT ACTUALLY HAPPENED, 2026-09-01 — ⛔ read this before the table below it

He said *"lets do p4c"*, and **decision B was taken and built**: the `beat` rule is armed, so
fractional beams now point at the beat they belong to. ⭐ Unlike P4b this needed no console knob and
was not left open, because the books do not disagree — the `neighbours` row stays in the table only so
the change is one word to undo.

⭐⭐ **And then he added a requirement the research had not anticipated** — *"on fractional beams we
should be able the user decide the direction… it is good the default like it is but it will be good
also have it on properties"*. So the metric rule is the DEFAULT rather than the law:
`Chord.fractionalBeamSide` overrides it per note, absent = auto, and Properties carries a
`fractional beam direction` select (auto / left / right). ⚠️ Its `auto` row genuinely means *"ask the
metre again"* — clearing an override restores the engraved default rather than freezing the picture,
which is asserted in `EngravedBeam.fractionalBeam.test.ts`.

⏳ **A and C below are still open and still his.**

### The table

⛔ **A and C are not scheduled.**

⛔ **Nothing below is scheduled, and none of it is a defect list.** Presented the way P4b's were —
as rules on a shelf, with the one we draw today named honestly.

| # | question | the options | what we do now |
|---|---|---|---|
| **A** | **the LENGTH** | (i) Bravura's `noteheadBlack` **1.18 sp**, read from the font like Verovio · (ii) the engines' **1.1 sp** · (iii) keep **0.9** | **0.9 sp** — ⛔ agreeing with nobody |
| **B** | **the SIDE** | (i) **the beat rule** (Gould/Ross/Stone; LilyPond's `strict_beat_beaming_`) · (ii) **neighbour counts** (VexFlow's) · (iii) beat rule with neighbour-count as tie-break | ✅ **DECIDED — (i), built.** ⭐ (iii) is what actually ships, since the rule abstains on a tuplet and VexFlow decides those |
| **C** | **next to a REST** | (i) point **away** (Gould's first, Verovio's) · (ii) point **towards**, to clarify the metre (Gould's *"equally acceptable"*) | falls out of (B); never asked |

### 8.1 ⭐ One implementation note, so the cost of **B** is not overestimated

`Beam.setPartialBeamSideAt(noteIndex, side)` is **public API** (`beam.js:340`), and
`lookupBeamDirection` checks `forcedPartialDirections` **first**. So the beat rule can be supplied
from our side — the meter is ours, `utils/measureCapacity` and the beaming code already know the beat
groups — without reimplementing `getBeamLines`.

⚠️ **But the hatch is partial, and this is the trap.** `lookupBeamDirection` is only consulted on the
`beamAlone` branch (a note alone at its level *between two notes that both lack that level*). The
`!nextNoteGetsBeam` branch and the trailing `lastBeam` fallback ignore forced directions entirely.
⭐ Gould's failing ⅜ bar **is** a `beamAlone` case, so the hatch covers the measured defect — but it
does not cover a run of two semiquavers, or the last note of a group. A complete **B** means owning
`getBeamLines`, which is P4c proper.

⭐ **`getBeamLines` IS OURS since S7d** (`engine/engrave/beams/beamLineSpans`, VexFlow's walk transcribed
exactly — the two branches above still ignore the forced side, on purpose, so no stub moved). ⇒
completing **B**, and deciding **A** (`FRACTIONAL_BEAM_LENGTH_PX`), are now edits to that module
rather than a port.

## 9. What this document does NOT answer — ⛔ UNKNOWN, not "silent"

- **Where a fractional beam sits when the group's stems are MIXED** (some up, some down). Verovio has
  a whole `CalcPartialFlagPlace` for it; no book we hold discusses it. ⛔ Unresearched.
- **The gap to the neighbouring inner beams** (Gould p. 158's second sentence) — not measured.
- **Ross's *"placed just as a normal secondary beam"*** presumes his triple/quadruple-beam
  stave-line rules (p. 124–126), which are the same unimplemented family the slope research flagged:
  *a beam end must sit on / hang from / straddle a stave-line*. ⛔ Still not implemented, and it is a
  **slope/level** question, not a hook one.
