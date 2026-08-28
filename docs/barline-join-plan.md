# Continuous barlines — joining the staves of a system

**Status: PLANNED, nothing built.** The research is `docs/barline-join-research.md` (three agents,
2026-08-28, sourced) — ⛔ read it before re-asking any question below; do not re-run it.

---

## 0. What this is, in one line

**A barline that runs unbroken through the gap between two staves, and the square you drag to say
so.** His ask, 2026-08-28: *"the case we want to make continuous barlines between two or more
staves"*, and the gesture is his: *"we can follow Sibelius idea"*, with our blue.

**The decision record, his words, in order:**

- *"default join is join all barlines"* — a fresh multi-staff score is joined everywhere, and the
  drag says so for the whole score. ⛔ NOT per boundary in this plan.
- *"later we will see in the future how we manage the contemporary cases, we just have to take care
  not restrict the model for that"* — §2's whole job.
- *"on the first stave the square is just in the bottom, in the last stave the square is in the top,
  the intermediate staves the square is both"*, and *"if just one staff in the system, we don't show
  the square"*.
- *"I like how we are doing today the barline space and we should keep it"* — ⛔ the bar-width drag is
  untouched by this plan. Not one line of it changes.

---

## 1. The gesture

⭐⭐ **A SQUARE EXISTS EXACTLY WHERE A GAP EXISTS.** That is the whole rule, and everything else falls
out of it as arithmetic:

| staff | squares |
|---|---|
| first of a system | bottom only |
| intermediate | top and bottom |
| last | top only |
| the only staff | **none** |

**So the count is `staves − 1` per system, per side, and a single staff produces zero because the loop
has nothing to iterate** — ⛔ never an `if (staves.length === 1) return`. Each square OWNS ONE GAP,
which is the same thing the model stores (§2): the affordance and the stored fact are 1:1, so there
is no square a user can grab that the model cannot express.

- **Drag AWAY from the staff (down from a bottom square, up from a top square) = JOIN that gap.**
- **Drag BACK TOWARD the staff = DISJOIN it.** ⭐ His requirement, stated when the gesture was:
  *"important disjoint should be also managed here"* — one square, both directions, no second control.
- The squares appear **only while the barline is selected**, like every other handle here.

**⛔ THE BAR-WIDTH DRAG IS UNCHANGED.** Drag the LINE sideways → bar width, exactly as today. Drag the
SQUARE → the join. Two targets, so there is no threshold to tune, no axis lock, no modifier, and no
way for a width edit to join two staves by accident. ⚠️ That separation is the reason for the square:
the two gestures author **different categories** — width is INK (an engraving override), a join is a
MUSICAL statement about the ensemble — and a mis-swipe must not cross that line.

**The style is one we already own**, not a new one: the hairpin / ottava / trill endpoint squares are
`#2563EB` with a white stroke, `#1D4ED8` (`INDICATOR_INK`) when armed, half-side 6 px
(`HighlightController.SLUR_HANDLE_R`). ⭐ Sibelius's is purple; ours is the blue every non-note
selection in this editor already uses.

---

## 2. The model — ⭐⭐ THE PART THAT MUST NOT RESTRICT THE FUTURE

### 2.1 The join is a fact about a GAP at a BOUNDARY

Not about a staff, not about a group, not about a barline sign. *"Between staff 2 and staff 3, at the
line ending bar 12, is there ink in the gap?"* Everything asked for falls out of that one question —
the default (every gap, every boundary), the contemporary mix (one gap, one boundary), and the
partial case a group-wide boolean **cannot say at all**: staves 2–3 joined while staff 1 stands alone.

### 2.2 What P1 stores

**`StaffInfo.barlineJoinBelow?: boolean`** — *"my barlines continue into the gap below me"*.

- ⭐ **Gap-keyed by the upper staff**, which is 1:1 with the square and with MuseScore's own field
  (`Staff::m_barLineSpan`, a bool meaning exactly this — research Part 2).
- **Absent = the default** (§2.3), so a fresh score stores nothing and old JSON keeps loading:
  `docs/json-io-plan.md`'s *"a new feature lands as an optional field whose absence is a legal score"*.
- ⛔ **Not on `Score`** — principle 6: a `Score.barlineJoin` would silently mean "the join at bar 1".
- ⛔ **Not a boolean on `StaffGroup`** — it cannot express §2.1's partial case, and the research kills
  the assumption it rests on: **the bracket does not own the join.** LilyPond proves it structurally
  (`GrandStaff` differs from `StaffGroup` in the delimiter only, `ChoirStaff` in the span bar only —
  two independent knobs); Sibelius says the two coincide *"often, but by no means always"*.

### 2.3 The default, and where it comes from

**Joined, for every gap inside a staff group** — which is his *"join all barlines"* for free, because
`ScoreModel.ensureSingleGroupSpansAllStaves` already keeps one group over every staff and clears it
below N=2. A single staff has no gaps, so the default is silent there too.

⏭️ The refinement the research names but this plan does not build: **vocal staves are NOT joined** by
default in every program surveyed (piano joined, orchestral joined per family, choir not). That is an
INSTRUMENT question and we have no instrument object — `docs/instruments-plan.md` is where it lands.

### 2.4 ⭐⭐ HOW THE FUTURE STAYS OPEN — the resolver carries the boundary from day one

**One function, and every reader asks it:**

```ts
barlineJoinsBelow(score, staffIndex, measureNumber): boolean
```

`measureNumber` is in the signature **from the first commit, although nothing varies by it yet.** That
is the entire trick, and it is what he asked for when he said not to restrict the model:

- ⛔ **We do NOT add a positional field now.** A field with no feature is a field nothing maintains —
  the reason `Measure.keys` was deliberately left out of key signatures P1. §2 of
  `docs/barline-types-plan.md` did the opposite (it stores a staff scope nothing reads) and §10 lists
  that as a smell. This plan takes the first road.
- ⭐ **What forecloses a future is a READER THAT ASSUMES, never a field that is missing.** With the
  boundary already in the signature, the day the mix arrives the storage lookup changes inside this
  one function and **not one caller moves**. Same shape as `keyAt` / `resolveStaffKeys` /
  `resolveStaffSize` / `alterInForce`: readers ask the function, ⛔ never the shape of the storage.
- ⭐ Two of the three engines that can be EDITED already implement exactly *default + exception at a
  boundary* — MuseScore's per-instance `spanStaff` (which layout re-seeds from the staff **until the
  user touches it**, `barline.cpp:901`), LilyPond's positional `\once \override
  Staff.BarLine.allow-span-bar = ##f`. So the future this leaves open is one two engines shipped.

### 2.5 The return type is where Mensurstrich will grow

P1 answers a boolean. ⚠️ The honest primitive is **per SEGMENT of the vertical run** — joined = every
segment inked, normal = staff segments only, **Mensurstrich = gap segments only** — which is how
LilyPond and Verovio both draw it (each draws the gap as its own thing). ⛔ Not built, not stored, and
the note is here so the boolean is understood as a NARROWING and not as the shape of the world.
🚨 **Mensurstrich is absent from all four treatises we hold** (grepped: Gould, Ross, Stone, Gerou &
Lusk — three hits, none about barlines), so its rules would have to come from the engines.

---

## 3. The drawing

- ⭐⭐ **THE LINES RUN THROUGH, THE DOTS DO NOT.** Already ours (`barline-types-plan.md` §4.5, 3 of 3
  engines) and now **confirmed in the source**: LilyPond makes the `:` a literal-space replacement in
  the span glyph (`scm/bar-line.scm:1312`), Verovio's `DrawBarLineDots` sits only inside the per-staff
  branch. So a repeat's dots stay on each staff and only the strokes cross the gap.
- 🚨🚨 **THE GAP SEGMENT MAY NOT BE DRAWN INSIDE `inStaffSpace`.** `BarlineRenderer.drawSign` paints
  within a per-staff SCALE group, and a line crossing two staves belongs to neither — a 0.7 small
  staff breaks it immediately (`docs/small-staff-spacing.md`'s rule: a gap inside `scale(k)` must be
  ÷ k). The gap segment is drawn in SCORE space.
- 🚨🚨 **ITS y COMES FROM THE PLACEMENTS, NEVER FROM THE STAVES.** A reused bar's `Stave` reports where
  it was last PAINTED (`BarlinePlacement.x`'s header, and the report that produced it: *"the final bar
  … stolen from the first stave"*). Top of the gap = the upper placement's bottom line, bottom = the
  lower placement's top line, both shifted by `staleShift`.
- **Where it goes:** a module of its own, not a branch in `drawSign` — the extent is already a
  parameter there (`SignStaff.topY/botY`), so the per-staff paint is untouched and the new module owns
  only the segment between two staves. ⭐ MuseScore takes the other road (the upper barline simply
  draws longer, `barline.cpp:284`); LilyPond and Verovio both draw the gap separately, and so do we —
  because of the scale-group rule above, which neither of them has.
- ⏭️ **The WINGS rule needs revisiting when this lands.** They are drawn on every staff today on his
  call — *"we still have separate barlines for every stave"* — and `BarlineRenderer.renderBarlines`
  already carries the note that this is the line to revisit *"the day span bars arrive"*. Both other
  engines show one pair, top and bottom, once the line is continuous.

---

## 4. Selection, hit-testing, undo, JSON

- **The squares are a MODULE** — `interactions/elements/barlineJoinHandles.ts`, plus its row in
  `ELEMENT_SPECS` and its position in `ELEMENT_HIT_ORDER`, exactly as `hairpinHandles` /
  `ottavaHandles` / `pedalHandles` did. ⛔ Not a per-kind slice inside `HighlightController`.
- The `barline` element keeps its current meaning (one system-wide selection per boundary); ⛔ nothing
  about `interactions/elements/barline.ts` changes in P1.
- 🚨 **The drag must end on a release it cannot see** (pointer capture / window listener) — the trap is
  written down and has bitten this repo before.
- **Undo:** one entry per drag (`saveUndoState`, or no undo AND no repaint), and the write must go
  through a mutator like every other.
- **JSON:** one optional field, absence legal, ⛔ no migration — `docs/no-json-migration.md`.
- **Geometry is not a unit test.** The gap ink is browser geometry: `e2e/*.e2e.ts` asserts the strokes
  cross the gap and the dots do not; jsdom asserts the resolver and the handle POSITIONS' arithmetic.

---

## 5. Phases (each independently green)

| | what | done when |
|---|---|---|
| **P1** | The resolver (§2.4) + the gap segment DRAWN. No editing, no squares. | A two-staff score shows continuous barlines; a repeat's dots stay per staff; a small staff's join is not distorted; e2e pins both. |
| **P2** | The squares, PAINTED per gap on a selected barline. No drag. | Bottom-only on the first staff, top-only on the last, both on the middle, none at N=1. |
| **P3** | The DRAG — join and disjoin, writing `barlineJoinBelow` for the whole score, one undo entry, a preview while dragging (`GhostRenderer`). | Dragging the bottom square down joins; dragging it back disjoins; the width drag still behaves identically. |
| **P4** | ⏭️ **NOT THIS PLAN** — the contemporary mix (per-boundary exceptions), Mensurstrich, the vocal default, the wings rule. | — |

---

## 6. What the research settled — and what it could not

Full record + citations: `docs/barline-join-research.md`. The five findings this plan rests on:

1. **Sibelius does drag, and does show a square** (Reference 2022.3 §4.5 p. 343: *"a purple square
   'handle' will appear… Drag the handle up or down the system"*), and MuseScore 4 has the identical
   gesture — `BarLine::gripsPositions` returns exactly one grip, at the bottom.
2. **Dorico, Finale and LilyPond do NOT treat it as a barline property**: Dorico derives it from the
   ensemble (override: Formatting ▸ Change barline joins), Finale's Group Attributes has a three-way
   *Only on Staves / Through Staves / Only Between Staves (Mensurstriche)*, LilyPond swaps engravers.
3. **Nobody makes a plain drag a purely local edit** — MuseScore's plain drag writes the STAFF's span
   (whole score) with **Ctrl** for the single barline (`barline.cpp:675`); Sibelius cannot vary it at
   all (*"This affects every system in the score simultaneously"*), nor can MusicXML.
4. **The bracket does not own the join** (§2.2).
5. **Defaults**: piano joined, orchestral joined per family, **vocal not joined**.

⛔ **UNKNOWN, with the routes that failed** (research §9, 25 entries): Sibelius's and Dorico's ORGAN
defaults; Finale's per-ensemble defaults (*not stated anywhere in its manual*); MuseScore's
`instruments.xml` values (unfetchable, 786 KB, every route); Mensurstrich in the treatises (absent).
⚠️ Also found: MuseScore's MusicXML importer silently collapses `Mensurstrich` to `yes` and never
exports it, so it does not round-trip.

---

## 7. Not in this plan

Brackets and braces (still unrendered — and per §2.2 the join does not wait for them), instrument-aware
defaults, the per-boundary mix, Mensurstrich, per-staff barline SCOPE (`barline-types-plan.md` §2,
stored and unread — a different question: which staves a SIGN applies to, not where the line runs).
