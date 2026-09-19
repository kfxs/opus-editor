# THE CLEF — its home in this repo

> ⭐ **Open this before touching a clef.** It gathers what a clef IS here, where each half of it
> lives, what has already been DECIDED (and by whom, and when), and what is still open —
> with **pointers to the code, ⛔ not copies of it**.
>
> ⛔ **This is a REFERENCE, not a plan and not a work list.** Nothing below is scheduled. Where a
> question is open it says so; where it is closed it names its closer.
>
> 📄 The EVIDENCE for every engraving number here is `docs/clef-research.md` (the books and the three
> engine clones, question by question) and its predecessor `docs/clef-spacing-research.md` (the
> 2026-08-29 treatise pass: position, spacing and the mid-score change). ⛔ Do not re-run either.
>
> ⏭️ **§0 is a TODO LIST and the only part of this file that is one** — his instruction, 2026-09-02:
> the clef's engraving RULES are owed a review, later, and ⛔ **not as part of the own-engine work**.
>
> Written 2026-09-02.

---

## 0. ⏭️⏭️ TODO — **THE CLEF'S ENGRAVING RULES ARE OWED A REVIEW, and it is NOT the engine migration's job**

> **HIS instruction, 2026-09-02:** *"in general the clef rules should be reviewed later and applied
> properly but this is out of the scope of own engine, just mark this as TODO in the future… change
> clef at beguining of bar it should be i guess in the last bar not in the beguining, in general
> cleff should be review in the future."*

⛔⛔ **READ THIS BEFORE OPENING A CLEF TICKET.** There are **two different jobs** with the word *clef*
in them and they must not be run together:

| | what it is | status |
|---|---|---|
| **owning the clef's INK** | moving the glyph off VexFlow into `engrave/header/clef` — P5b of `docs/own-engraving-engine.md` | ✅ done — VexFlow is removed (2026-09-19); it moved **no pixel** by design |
| ⏭️ **reviewing the clef's RULES** | where a change is drawn, how small it is, which glyph it uses | ⛔ **NOT SCHEDULED, and explicitly out of scope of the engine work** |

⭐ **Why the split matters:** every item below CHANGES THE PICTURE. The migration's whole safety
argument is that it does not. Folding a rule change into a migration commit destroys the one property
that makes the migration checkable — *"the suite is green and nothing moved"*.

⇒ ⛔ **Do not fix any of these while taking a piece of the clef's drawing.** They are a separate pass,
on his say-so, one at a time, with his eye on each — the way decisions A, D and E were taken.

### ⏭️ 0.1 The list, as it stands on 2026-09-02

| # | what | the evidence | why it is not done |
|---|---|---|---|
| ⭐⭐ **1** | **A clef change at a bar's start belongs at the END of the PREVIOUS bar — BEFORE the barline. We draw it after.** ⭐ **This is his own example**, and the books were already unanimous before he raised it. | Gould p. 8 *"The clef always goes before the barline"* · Ross p. 166 · Stone pp. 46/57 · Gerou & Lusk p. 27 — **four books, no dissent**; three add that only a *systemic* barline may precede a clef. §5 below, and `clef-spacing-research.md` PART 7 (first recorded 2026-08-29) | It is a real engraving defect, ⛔ not a taste call — but fixing it moves the glyph into the **previous bar's** width, which is a layout change, not a drawing one. ⚠️ And the bar that OWNS the change is not the bar that DRAWS it, which is the *"a span belongs to where it BEGINS"* problem one element over |
| ⭐⭐ **2** | **A SMALL-STAFF clef and a CHANGE clef are different reductions, and we conflate them.** See §0.2 — the font itself says so. | `clef-research.md` §9.1; Bravura `ss01`; LilyPond states the principle in prose | Nobody has asked for it, and it needs the small-clef ratio (row 3) decided first |
| **3** | **The small-clef RATIO** — what fraction a mid-score change is drawn at | ⚠️ the literature contradicts itself: Gould *writes* ⅔ and *draws* ¾ six times; Gerou & Lusk *state* 75%; Ross *draws* 0.65–0.68; the engines span 0.65–0.88; VexFlow uses exactly ⅔, which is what we inherit | ⛔ **No single sourced answer to adopt** ⇒ a house-style choice, and HIS. The table-of-rows pattern (`__header.rule(…)`, `__beams.rule(…)`) is the shape it would take |
| **4** | **WHICH LINE each clef names** — the anchor table | `clef-research.md` §2; the books state it | Still VexFlow's `Clef.types` — transcribed as our row `CLEF_LINES` (`engrave/header/clefSign`) since the removal, same lines, ⛔ unchosen. ⛔ Parked as a named parameter in `engrave/header/clef`, deliberately |
| **5** | **The cramped floor around a clef** — Gould's ½ stave-space | `clef-research.md` §5.2; stated three times by one author | The same question as `header-spacing-research.md` §8 **G**, which is the one row of the header run still open. ⛔ Answer it once, not twice |
| 🚨 **7** | **A MID-BAR clef COLLIDES with the note it precedes — no room is reserved for it.** HIS report, 2026-09-13, with a score: bar 3 = quarter rest, chord A3 at beat 1, half rest at beat 2, alto clef change at beat 1 ⇒ *"the glyph sometime is over the note"*. ⭐ **The RULE is not missing** — `clef-spacing-research.md` §4.3 has it MEASURED off Gould p. 8: **0.75 sp before the clef, 0.80 sp after** (her *recommended* version; her *"rather than"* version draws 1.25 / 0.55), with Ross p. 167 and Gerou & Lusk pp. 51–52 on WHERE it goes and ⛔ Stone p. 46 refusing to give one (*"there are no specific rules for clef changes within a measure"*) | ⚠️ Diagnosed by reading (§2.3) — ✅ **MEASURED in Chromium 2026-09-19** (§2.3a): a change at beat 1 stands **0.36 sp** of white from the note it precedes (Gould 0.80) and **3.69 sp** after the note before it; the same clef at beat 0 (a bar's opening sign) stands **2.84 sp** from its note — ⚠️ the beat-0 side is ROW 1's (header spacing for a clef that belongs before the barline), see §2.3a; beat 1 is this row's (tight, under half of Gould) | ⏭️ Not built. It is a SPACING fix, ⛔ not a drawing one, and it widens the bar |
| ⏸️ **8** | **A clef change AFTER a bar's last onset is placed by VexFlow's SOFTMAX — the only x the softmax still decides.** It is appended past the last note (the bar's END tick); our spacing (`layout/spacing` via `rendering/spacingPass`) has no column there, and the room the bar reserves for an inline clef (`headerInk.inlineClefExtent`) is not placed between the last note and the barline. Measured in Chromium 2026-09-18: in a bar of quarters it lands between the last note and the barline (254 of 237…282); in a bar of eighths it **crowds the last eighth** (512 against a head at 509). ⛔ No column-derived x fits: the barline column puts it ON the barline, 3.6 sp before it puts it before the last eighth | ⭐ HIS call, 2026-09-18 (S9h-b of `vexflow-removal-map.md`): *keep the picture exactly, review it later* — so VexFlow's softmax was PORTED (`layout/softmaxSpacing`) just for this. ⚠️ Likely the same question as row 1 (Gould p. 8, *"the clef always goes before the barline"*): a change written after the last onset belongs before the NEXT bar's barline, with its room reserved there | ⏭️ A clef RULE, out of the migration. ⭐ **When it is decided, `layout/softmaxSpacing` is DELETED** — nothing else reads its x's (`vexflow-removal-map.md` §9.4 #5) |
| **6** | **Octave clefs** — the `8`/`15` numeral, and the model behind it | `clef-research.md` §8 | ⏳ unbuilt entirely (`docs/octave-clefs-plan.md`). ⭐ And the research found the model needs widening before it is built — see §0.3 |

### ✅ 0.1a **HIS DECISION on row 1, 2026-09-13 — and it is TWO statements, not one**

> *"yes, the rule should be that the sign is before, but anyway i think we should make the user able
> to place it after if the user want, we should not reduce editing options to the user"*

1. ⭐⭐ **The RULE: a clef change goes BEFORE the barline.** Settled — four books unanimous (row 1
   above) and now two of the three engines measured as well: LilyPond puts it before by default
   (`Clef.space-alist (staff-bar . (extra-space . 0.7))`, ordering in `break-align-orders`) and so
   does MuseScore (`clefBarlineDistance 0.5_sp`, with a per-clef `AUTO/BEFORE/AFTER` property).
   Only Verovio puts it after. See `docs/mid-bar-sign-spacing-research.md`.
2. ⭐⭐ **…and the user may put it AFTER.** *"We should not reduce editing options to the user."*
   ⇒ the side is **AUTHORED**, with the rule as its default.

🚨🚨 **THAT SECOND HALF CHANGES WHAT THIS IS.** Row 1 alone would be a renderer fix — draw the glyph
on the other side of a line. A per-change OVERRIDE is a **MODEL** widening: the side has to be stored
on the clef change, survive save/load, be selectable, and be editable. ⇒ it lands in the shape this
repo already has for authored-not-derived facts, ⛔ not as a flag in a pass:

| | where |
|---|---|
| the stored side | the `ClefChange` itself (`engine/models/**`) — ⚠️ ⛔ **not** a `Score` global: *what changes mid-score is never a `Score` field* |
| the default | the RULE — before. ⭐ Absent means "the rule", exactly as an absent `voice`/`staff` means the first one |
| selecting it | the `selectedElement` union already carries `clef`; the side is a property of that selection |
| editing it | the Properties window's clef row |
| ⚠️ the LAYOUT | 🚨 **a clef drawn BEFORE the barline is paid for by the PREVIOUS bar** — its width, its casting-off, its `headerInk` reservation. That is the hard half, and it is the *"a span belongs to where it BEGINS"* problem again: the bar that OWNS the change is not the bar that DRAWS it |

#### ⭐⭐ …and the INTERACTION he wants for it (2026-09-13)

> *"the user introduce the clef, by default it goes before the barline, then the user can drag
> similar to what we do and it can be moved to after the barline, and after that the normal drag we
> already have"*

⇒ **one gesture, two stages**: insert → the RULE places it (before) → dragging it across the barline
flips the stored side to *after* → from there it is the ordinary hand nudge this repo already has
(`clefOffsetPass`). ⭐ The two stages edit two different things — a **discrete stored side** and a
**continuous offset** — which is what makes the seam between them the whole design.

🚨🚨 **The two rules that make or break it, both already settled here for other marks:**

| | |
|---|---|
| ⭐ **Crossing the barline is a RE-ANCHOR, so it CLEARS the nudge** | the slur endpoint's rule (`docs/slur-endpoint-offset-plan.md`). ⛔ Without it the glyph JUMPS at the switch: the same offset means something different measured from the other side of the line |
| 🚨 **The switch reads the CURSOR, ⛔ never the drawn ink** | *a drag decision cannot read its own outcome*. If *"which side am I on"* is answered from where the glyph ENDED UP, and the answer moves the glyph, it can flip back and forth across the boundary. ⭐ The ink is a GATE, ⛔ never the chooser |

⚠️ **Two things deliberately NOT decided**: where exactly the switch fires and whether it has FRICTION
(a bare threshold at the barline will jitter when the cursor sits on it — ⭐ this repo already holds
the two papers for that, `snap-and-go` and `Oh Snap`, used by the slur endpoint drag); and whether the
drag is the ONLY way to set the side (a Properties row costs nothing once the field exists, and is
discoverable in a way a drag is not).

⚠️ Because the side is STORED, the drag is a **model mutation** — it saves undo state and re-renders
like any other edit (`reference: mutators must save undo state`), ⛔ not a view-only tweak.

⛔ **Still not scheduled by this note.** It is recorded here so the decision is not re-litigated, and
so that whoever builds it knows it is a model change with a layout consequence — ⛔ not a one-line
flip of a sign. ⚠️ And the same question exists for a **METER** change (all three engines and the
books put that one AFTER the barline — Gould p. 152, already fixed in `336b1c0`); whether the
override is one shared "which side" property for both, or the clef's alone, is ⛔ **not decided**.

### ⭐⭐ 0.2 Bravura ships a SEPARATE small clef, and it is not a scaled-down big one

**The finding, and it is the one most likely to be got wrong by anyone who reads only the ratio:**

> Bravura contains a stylistic set, **`ss01`**, whose `gClefSmall` / `fClefSmall` / `cClefSmall` are
> the **same HEIGHT as the full-size glyph and up to 10% WIDER** — while its `*Change` glyphs are the
> ones drawn at **0.65–0.72**.

⭐ **They answer two different questions, and the font names both:**

| | what it is for | what it does |
|---|---|---|
| `*Change` | a clef CHANGE inside the music — a smaller symbol, because it is a reminder rather than a heading | **reduced** to ~0.65–0.72 |
| `ss01` (`*Small`) | a clef on a **SMALL STAFF** — a cue staff, an ossia, a reduced part | ⭐ **an OPTICAL MASTER: not reduced at all.** The whole staff is already being scaled down, so the glyph is redrawn *heavier and wider* so it does not go thin and spidery at the smaller size |

🚨 **We conflate them, and so does every engine surveyed.** We draw ONE clef glyph, scaled twice —
once by the staff group's own `scale(k)` (`docs/staff-size-plan.md`) and again by VexFlow's ⅔ when the
clef is a change. ⛔ Nothing anywhere reaches for `ss01`. ⚠️ **This is not a bug report**: our small
staves look acceptable, and no one has complained. It is a *named opportunity*, and the reason it is
written down is that *"the small clef is ⅔"* is a sentence that hides two independent decisions.

⭐ **LilyPond states the same principle in prose** — a reduced-size glyph is redrawn, not merely
scaled — which is why its font ships optical masters per staff size at all.

### ✅ 0.2a **HIS DECISION, 2026-09-13 — ASK THE FONT FIRST, and keep what we do now as the FALLBACK**

> *"the small clef that bravura have glyph for that so we can use it, but of course probably other
> fonts dont have glyph for that so the solution we do now should persist, and only use it when the
> font of the user don't have glyph for that"*

⇒ ⭐⭐ **A CAPABILITY RULE, not a constant**: if the font ships a dedicated change clef, draw **that
glyph at its natural size**; if it does not, keep today's behaviour — the full-size glyph reduced by a
ratio. ⛔ The fallback is not deleted, and ⭐ that matters more the moment the user can change the font
(`docs/smufl-fonts-research.md`).

**⭐ MEASURED across every free SMuFL font on 2026-09-13** (`opentype.js` over the OTFs; the ratio is
`gClefChange`'s bbox height ÷ `gClef`'s — ⚠️ my measurement, ⛔ not a number the font states):

| font | `gClefChange` / `cClefChange` / `fClefChange` | drawn ratio | stylistic sets |
|---|---|---|---|
| **Bravura** | ✅ all three | **0.662** | `ss01`–`ss10` |
| **Sebastian** | ✅ | 0.654 | `ss01`,`ss02`,`ss05`,`ss09` |
| **Petaluma** | ✅ | 0.667 | — |
| **Leland** | ✅ | 0.750 | `ss03` only |
| **Finale Maestro** | ✅ | 0.756 | — |
| **Leipzig** | ✅ | 0.777 | — |
| **Gonville** | ✅ | 0.800 | — |
| **MuseJazz** | ✅ | 0.805 | — |
| ⛔ **Finale Ash / Broadway / Jazz**, **Gootville** | ⛔ **none** | — | — |

🚨🚨 **THIS ANSWERS ROW 3 OF §0.1 — "what fraction is a mid-score change drawn at?" — by DISSOLVING
it.** The free fonts disagree from **0.65 to 0.81**, and each disagreement is the type designer's own
optical judgement about their own outlines. ⇒ ⭐ **there is no ratio to pick while the font has the
glyph: asking the font IS the answer**, and a single house number would override eight designers at
once. The ratio only becomes a house-style choice for the four fonts that ship nothing — and ⛔ it is
still HIS.

⭐⭐ **Two glyph families, and only ONE of them is portable** — the distinction §0.2 draws, now with
its consequence:

| | how it is addressed | portable? |
|---|---|---|
| `*Change` (the clef CHANGE) | **standard SMuFL codepoints** `U+E07A` / `U+E07B` / `U+E07C` | ✅ **yes** — any font may have them, and presence is a one-line test |
| `ss01` (`*Small`, the small-STAFF optical master) | ⛔ **NOT a SMuFL name at all** — an OpenType *stylistic set* mapping the ordinary codepoint to an alternate | ⚠️ **no** — it needs the GSUB feature, and only Bravura (and partly Sebastian) has it |

⇒ ⚠️ **The capability test is different for the two**, and a design that treats them as one thing will
work for the change clef and silently do nothing for the small staff.

### ⏭️ 0.3 …and one MODEL widening the research asked for

⭐ **The octave numeral's slot is not an octave slot.** Stone p. 57 puts a **5** and a **4** in it for
the horn's bass clef, and LilyPond — the one engine that draws the numeral as *text* rather than as a
ligature — can draw exactly that (`\clef "alto_2"`). ⇒ `docs/octave-clefs-plan.md`'s `(clef, ±octave)`
model **cannot express it**; `(clef, numeral, side)` gets it, and `15` for free. ⛔ Unbuilt, and this
is a note for whoever builds it, ⛔ not a decision to build it now.

---

## 1. What a clef IS here

### 1.1 Four types, and why exactly four

```ts
export type Clef = 'treble' | 'bass' | 'alto' | 'tenor'   // src/types/music.ts:454
```

⭐ **`alto` and `tenor` are the same GLYPH on different lines** — `fontMetrics.clefGlyph` maps both to
`cClef` (`src/engine/fonts/fontMetrics.ts:164`), and only the anchor line differs. That is the C
clef's whole nature (`docs/clef-research.md` §7.2), and it is the reason a fifth C-clef position would
be a row in the tables rather than a new glyph.

⛔ **There is NO percussion row, and that is a decision, not an omission.** A percussion staff is not
a fifth clef but *a staff whose lines are not pitches* — see `docs/unpitched-staves-plan.md`. Adding
it to this union would make every `Record<Clef, …>` table below claim a pitch mapping that does not
exist. (Closer: the Clef window's own design note, 2026-07-20.)

⏳ **Octave clefs (`treble8vb`, `bass8vb`) are PLANNED and unbuilt** — `docs/octave-clefs-plan.md`,
whose §1 decision is the load-bearing one: **the model keeps storing WRITTEN pitch**, and the octave
is applied once, at playback. ⚠️ That plan's §4 open question (what MusicXML's
`clef-octave-change` means for `<pitch>`) is still open.

⭐⭐ **Two things the 2026-09-02 research says about that plan** (`docs/clef-research.md` §8.7),
recorded here because they would be found late otherwise — ⛔ neither is a proposed change:

1. 🚨 **The numeral's slot is not an OCTAVE slot.** Stone p. 57 puts a **`5`** and a **`4`** in it, for
   the horn's bass clef (*"sounds a fifth lower"* / *"sounds a fourth higher"*). ⇒ the drawn thing is
   **(clef, numeral, side)**, not `(clef, ±octave)` — and modelled that way, `15` and the horn clefs
   fall out for free.
2. The plan calls bass-8vb *"rarer"*. **Gould p. 506 and Stone p. 57 both treat it as the PRIMARY
   case** — contrabass clarinet, contrabassoon, double bass.

### 1.2 Where a clef is STORED — positionally, and never on the `Score`

A clef change lives on the measure it happens in:

```ts
ClefChange { id; beat: Fraction; clef: Clef; staffId? }   // src/types/music.ts:464
Measure.clefs?: ClefChange[]                              // sorted ascending by beat
```

- **`beat === 0`** is the measure's *opening* clef. **`beat > 0`** is a mid-measure (inline) change.
  The two are drawn by completely different machinery — §3.1.
- **`staffId` absent means staff 0** — the `utils/lanes` write convention, and `sameStaff` in
  `clefOps.ts:23` relies on it exactly.
- 🚨🚨 **There is no `Score.clef` field and there must never be one.** It existed, it conflated *"the
  document default"* with *"staff 0's opening clef"*, and at N > 1 staves it bled: changing the top
  staff's clef changed every staff that had not set its own. `docs/clef-model-plan.md` is the whole
  autopsy; `src/types/music.ts` records the rule on `tempo`, `keySignature` and
  `defaultTimeSignature` in the same words. ✅ **Removed** — `setClefAt` no longer mirrors anything
  (`clefOps.ts:46`), and the resolution falls back to a universal constant `'treble'`, which cannot
  bleed because it is the same value for every staff.

### 1.3 Where the OPERATIONS live — the split every kind here has

| half | module | what it owns |
|---|---|---|
| **writes** | `src/engine/models/clefOps.ts` | `setClefAt` · `removeClefAt` · `clefChangeAt` · `moveClef` · `moveClefWithinMeasure` · `normalizeClefAt`. Free functions over a `Score`, the `rebar`/`restFill` idiom |
| **reads** | `src/utils/clefUtils.ts` | `effectiveClefAt` · `effectiveClefBefore` · `measureOpeningClef` · `measureEndingClef` · `resolveStaffClefs` · `middleLineDiatonicPos` · `staffLineForSpelling` / `diatonicPosForStaffLine` |
| **facade** | `MusicEngine.setClefAt` / `setClef` / `removeClefAt` | thin delegators — ⛔ no clef logic |

Two behaviours in `setClefAt` are worth knowing before you debug one:

1. ⭐ **A redundant change is not stored, it is REMOVED.** Setting the clef already in effect
   immediately before that beat deletes any change there. So *"set treble at bar 1 beat 0"* on a
   fresh score stores **nothing** and still renders treble, via the default.
2. ⛔ **The m1 b0 opening clef cannot be deleted, on ANY staff** — `removeClefAt`'s guard, decision
   **(b)** of `docs/clef-model-plan.md` §4, HIS choice, *"for symmetry"*. It can only be changed.

### 1.4 The two tables that make a clef mean a pitch

Both are keyed by `Clef` and both are **single sources of truth** — ⛔ do not re-inline either:

- `CLEF_MIDDLE_LINE_DIATONIC` (`clefUtils.ts:19`) — the diatonic position of each clef's **middle
  (3rd) line**: treble = B4, bass = D3, alto = C4, tenor = A3. Everything else is derived from it —
  `staffLineForSpelling`, its inverse `diatonicPosForStaffLine`, and `naturalStemDirection`.
- `ElementRegistry.CLEF_REFERENCES` — the registry's own pixel↔pitch reference.

⭐ A clef added later needs **one row** in the first table and nothing in the derivations. That is why
they are derivations.

### 1.5 Selection, hit-testing and the hand nudge

- A clef is one kind in the `SelectedElement` union, with its own module
  `src/interactions/elements/clef.ts` (hit-test + how it paints) and its row in `ELEMENT_SPECS` /
  `ELEMENT_HIT_ORDER`.
- ⚠️ **The hit boxes are CONSTANTS, not ink**: `LAYOUT_CONFIG.CLEF_HIT_WIDTH` = 4.5 sp and
  `CLEF_CHANGE_HIT_WIDTH` = 3 sp (`rendering/layoutConfig.ts:110,112`). ⛔ Neither is a spacing
  number and neither may be used as one — the ink extents are §2.1's, and the standing trap is
  `reference: a hit box written from a constant drifts off its glyph`.
- **The hand offset** is client #14 of the overrides compartment: `ClefOffsetOverride { x }` in staff
  spaces, keyed by the **`ClefChange` id** so an upsert keeps it and a MOVE drops it.
  `docs/clef-offset*`, `rendering/clefOffsetPass.ts`. ⭐⭐ *"Is this a header clef?"* is answered by
  **the INK** — `MusicEngine.clefIsOffsettable` asks the registry for a drawn, non-`immovable` box —
  ⛔ never by the model, because whether a clef is engraved in a system's header is a casting-off
  fact.

---

## 2. How a clef is LAID OUT

### 2.1 The numbers, and what each one actually is

All in `src/engine/layout/headerInk.ts`, all in staff spaces:

| constant | value | what it is |
|---|---|---|
| `CLEF_INDENT` | **0.7** | ⭐ **a CHOSEN engraving number** — decision A, §4.1 |
| `CLEF_INDENT_SHIFT` | 0.7 − 0.5 = **0.2** | the DIFFERENCE from where VexFlow leaves the clef. ⛔ Not a second copy of the indent |
| `CLEF_FULL` | treble **3.2** · bass **3.5** · alto/tenor **3.6** | ⚠️ **a MEASUREMENT of VexFlow's drawing written down**, from the stave's own x past the clef. The old indent (0.5) is INSIDE these numbers |
| `CLEF_SMALL` | treble/bass **2.6** · alto/tenor **2.7** | the same, for the reduced clef VexFlow draws at ⅔ |
| `lineOpeningClefPremium` | `FULL − SMALL` ⇒ **0.6 / 0.9 / 0.9 / 0.9** | what a bar pays the moment it becomes line-opening |
| `inlineClefExtent` | `CLEF_SMALL + 1.0` | a mid-BAR change: it buys room the same way but adds nothing to the lead-in |
| `cautionaryExtent({clef})` | `CLEF_SMALL + 1.0` | a courtesy clef is **cue size** — Gerou & Lusk p. 52, and the key signature and meter take the full-size branch beside it |

🚨 **A checkable oddity in `CLEF_FULL`, recorded and ⛔ not acted on.** Bravura's clef advances are in
this repo already (`src/engine/fonts/bravuraMetrics.ts:154–156`: gClef 2.684, fClef 2.736,
cClef 2.796). Against `0.5 + advance`, every row of `CLEF_FULL`/`CLEF_SMALL` sits a consistent
**≈ +0.3** — **except `CLEF_FULL.treble`, which sits +0.02**. The same asymmetry shows in the premium:
0.9 for bass/alto/tenor (which is ⅓ of each advance, exactly what a ⅔ small clef implies) against
**0.6** for treble. First noticed 2026-08-29 (`docs/clef-spacing-research.md` §A.7). ⚠️
`e2e/spacing.e2e.ts` pins 3.2 against the current drawing, so nothing is silently wrong today.

### 2.2 The header run, and where the clef sits in it

```
[system left edge] →0.7→ CLEF →0.82→ KEY SIGNATURE →1.15→ TIME SIGNATURE →2.5 or 2.0→ FIRST NOTE
```

The gaps either side of the clef are **not** this file's to re-decide — `docs/header-spacing-research.md`
§8 owns them, and rows **B** (clef → key, 0.82) and **C** (key → meter, 1.15) are ⛔ **CLOSED by his
own reports**. The last gap is keyed on what ENDS the header (`headerToNoteGap`): **2.5** after a clef
or key signature, **2.0** after a time signature — decision D.

⭐ **A clef is provably width-independent**, and there is a spec that says so:
`MeasureLayout.clefWidthIndependence.test.ts` — a bar's *note-space* width does not depend on its
clef, which is why `clef` was removable from the width cache's key. ⚠️ It is still a `ShapeKeyInputs`
row, because the PICTURE depends on it.

---

### 🚨 2.3 A MID-BAR clef takes NO ROOM — the collision of row 7, and where it comes from

⚠️ **This section is a DIAGNOSIS from reading the code, ⛔ not a measurement.** It is written down so
the next person starts from a hypothesis with an address rather than from a screenshot. ⭐ The
instrument to confirm it is the browser suite (`e2e/`, `h.inkSizes` on `g.clef text` against the
notehead). ⭐ Since S12j-e (2026-09-19) the mid-bar clef is ours (`rendering/EngravedClefChange`, which
replaced VexFlow's `ClefNote`) and stamps through the pass's surface, so its POSITION is in the scene; its
ink EXTENT still needs a font (the browser).

**The chain, as far as reading gets it:**

1. a mid-bar change is emitted as a `ClefNote` tickable (our `EngravedClefChange` since S12j-e), interleaved into the voice immediately
   before the note at or after its beat (`ScoreRenderer.interleaveClefNotes`);
2. ~~at `beat > 0` that `ClefNote` and the note it precedes are **at the same tick**, so they share a
   tick context~~ — 🚨 **corrected 2026-09-19 (S12j-e), measured:** they do NOT. A `ClefNote` is a
   256th (`duration: 'b'`) whose ticks the VOICE ignores but the column walk ADDS, so the clef takes
   the key of its beat and the note it precedes files **64 ticks later**, in a column of its own
   (voice 1 `q, clef, q` against voice 2 `q, q` → keys `0, 4096, 4160`; the clef shares 4096 with
   voice 2's note). `vexflow-removal-map.md` §9.4 #6. Point 3 stands either way: the column model
   prices neither;
3. ⭐⭐ **but the COLUMN model never hears about it.** `layout/measureColumns` builds each column's ink
   from the SLOTS — noteheads, accidentals, dots, ledgers, flags — and reads the clef only to decide
   *where a note sits* (stem direction, ledger lines). ⇒ a column whose tick also carries a clef is
   priced as if it did not, so the solve grants it no extra width;
4. our own `spacingPass` then places that column at the model's x. ⛔ **Whatever room VexFlow's
   formatter (ours now, `rendering/columnFormat`) would have made for the extra tickable is not what decides the picture** — we overwrite
   it — so the clef lands on top of the notehead.

⇒ ⭐ **If the diagnosis holds, the fix belongs in the COLUMN INK, not in the renderer**: the clef's
ink plus Gould's two gaps become part of the LEAD-IN of the column it precedes — the same shape an
accidental already has, which is ink standing to the left of the notehead inside its own column
(`measureLeadIn`, and `spacingPadding`'s pair table). ⚠️ It **widens the bar**, so it is a layout
change with a casting-off consequence, ⛔ not a nudge.

⚠️ **What is NOT known**: whether the same defect hits a mid-bar clef at a beat where the note is
absent (Ross p. 167 and Gerou & Lusk put the clef before the REST in that case), and whether a
cautionary clef at a line end is priced correctly — ⛔ neither has been looked at.

### 📏 2.3a MEASURED, 2026-09-19 — the gap after a clef, at beat 0 against beat 1

⭐ **His report, with two scores** (2026-09-19): *"when the clef is in first position there is more
space between clef and note than when is in other position"* — ⛔ *"we dont have to fix it now, just
measure and documented"*. Both scores: 4/4, bar 3 = quarters C4 E4 F4 G4, one staff, an **alto** change
in bar 3 (mid-line); the only difference is the change's beat.

**How it was measured** (a throwaway Chromium probe through `e2e/harness`): the clef's and the heads'
`<text>` ORIGINS, exact (`headerGap.e2e.ts`'s rule — ⛔ not a rounded `getBoundingClientRect`), plus the
font's own bearings from `fonts/bravuraMetrics`: the small `cClef` inks 0 → 2.796 sp × ⅔ (drawn at
26.67 px against the notes' 40 px), a black head from 0. One staff space = 10 px.

| the change | what draws it | white, clef ink → the head AFTER | white, the head BEFORE → clef ink |
|---|---|---|---|
| **beat 0** (the bar's opening sign) | a stave SIGN (`EngravedClef`, walked by `signWalk`) | **2.84 sp** | — (the barline) |
| **beat 1** (mid-bar) | a TICKABLE (`EngravedClefChange`) | **0.36 sp** (before E4) | **3.69 sp** (after C4) |
| Gould p. 8, measured (`clef-spacing-research.md` §4.3) | — | **0.80** | **0.75** |

🚨 **What he SEES is the beat-0 side: TOO MUCH room there** (his correction, 2026-09-19 — *"i see too much
room while i think the other problem was that was colliding"*; a first reading here blamed row 7 alone,
which was wrong). The two positions are off in OPPOSITE directions:

- ⭐⭐ **beat 0 — too roomy, and it is ROW 1.** The 2.84 sp is the **HEADER's** clef → first-note gap
  (Gould p. 42's table: 2½ after a clef; decision D's 2.5) applied to a bar that is **not a system
  opening**. For a change at a bar's start, four books put the clef **BEFORE the barline** (row 1,
  his decision 0.1a), and the note then follows the barline at Ross p. 145's barline → note **1 sp**
  (origin-to-origin — ⚠️ not converted to a gap here). ⇒ against the rule, the note sits ≈ 2 sp further
  right than it should, and the clef is on the wrong side of the barline. Even as a header gap it is
  ≈ 0.34 sp over Gould's 2½ — ⛔ **not explained**; possibly §2.1's +0.3 `CLEF_SMALL` oddity, unverified.
- **beat 1 — on the tight side, and it is ROW 7.** 0.36 sp before the note against Gould p. 8's
  0.80 (under half). No overlap in this score; row 7's report (a chord with a lower note, rests either
  side) did overlap — ⚠️ not re-measured here.

⭐ **Not a regression of the VexFlow removal**: S12j-e's A/B proved the mid-bar clef draws exactly where
VexFlow's `ClefNote` drew it, and the beat-0 clef is the stave sign S4 already ported exact. ⏭️ Both
fixes belong to the clef review, ⛔ not to the migration: **row 1** (the side of the barline, AUTHORED
with BEFORE as the default — a model + layout change; the previous bar pays for the clef) and **row 7**
(a SPACING change: the clef's ink plus Gould's two gaps become part of the LEAD-IN of the column it
precedes — it widens the bar).

## 3. How a clef is DRAWN, and by whom

### 3.1 ⭐⭐ THE DISTINCTION THAT CATCHES PEOPLE: a modifier or a tickable

**These are two different objects, laid out by two different mechanisms, and a change that only
touches one of them draws nothing for the other.** It has already cost one round trip
(*"i am offseting in the properties but i dont see anything changing in the score"*).

| the clef | when | how it is drawn | placed by |
|---|---|---|---|
| **header clef** | first bar of a system (`measure.number === 1 \|\| isFirstInLine`) | `stave.addClef(clef)` — a **stave MODIFIER**, full size | `Stave.format()` |
| **a bar's opening change** | `beat === 0`, mid-line, clef differs from the previous bar's ending clef | `stave.addClef(clef, 'small')` — also a **stave MODIFIER** | `Stave.format()` |
| **a mid-measure change** | `beat > 0` | `new EngravedClefChange(clef)` (ours since S12j-e; VexFlow's `new ClefNote(clef, 'small')` before), interleaved into the voice immediately **before** the note at or after its beat (`interleaveClefNotes`) | the FORMATTER, as a tickable |
| **a cautionary clef** | at a line end, when the next line's opening clef differs — **and only if allowed** | `stave.addEndClef(clef, 'small')`, before the closing barline | `Stave` |

⚠️ `clefOffsetPass` has **two entry points for exactly this reason** — `applyClefOffsets` for the
tickables and `applyStaveClefOffset` for the bar-opening modifier — and
`reference: vexflow ClefNote setXShift is inert` is the trap that made it three bugs instead of one.

### 3.2 The cautionary clef is OPT-IN, per change

`cautionaryClefAllowedOf(score, measureId, staffId)` — a payloadless override, **presence = allowed**
(`models/engravingOverrides.ts:475`). Absent ⇒ no courtesy clef is drawn at all.

⭐ **That is HIS decision twice over**: first as a deferral (2026-06-01 — *"courtesy clef at the end
of the previous measure for beat-0 changes"*, explicitly not wanted unless asked), then as the *Allow
cautionary* control in the Clef window (`1b4a656`, `69d2755`). ⚠️ It **diverges from the key
signature**, whose courtesy at a break is always on because there it *is* the engraving
(`docs/key-signature-plan.md` §4.2). ⛔ Do not "fix" the divergence — it is two different decisions
about two different symbols.

The override is keyed by **the measure the change starts at**, not by the bar that happens to end the
system: which bar ends a system moves on every reflow, and the author's decision must not.
Width is charged **once** per measure even when several staves warn (`MeasureLayout.ts:750–782`).

### 3.3 ⏳ The seam as of 2026-09-02 — the ink is moving, the placement is not

**P5b of `docs/own-engraving-engine.md`** is under way. Read the seam as it is:

> ⚠️ **2026-09-19: VexFlow is removed**, so this seam is history. The placement is our `signWalk`
> (`engrave/staff/signWalk`, `Stave.format()` transcribed); which line a clef names is the row
> `CLEF_LINES` and its size the rows in `engrave/header/clefSign` + `SMALL_CLEF_RATIO`
> (`engrave/inheritedFonts`) — ⛔ same values, unchosen. The `g.clef` group id stands (`engrave/header/clef`).

- ⭐ **The INK is becoming ours** — `src/engine/engrave/header/clef.ts` (+ its adapter
  `rendering/EngravedClef.ts`): `clefPlacement()` states the one vertical rule and `drawClef()`
  stamps the glyph into the SCENE. ⛔ No DOM, ⛔ no vexflow.
- ⛔ **The PLACEMENT is still `Stave.format()`**, plus two nudge passes that run **before** the stave
  draws: `clefIndentPass.applyClefIndent` (the engraved indentation, line-opening bars only) and
  `clefOffsetPass` (a hand offset). ⭐ The two compose — a bar can carry both, and they add.
- ⛔ **WHICH LINE each clef names is still VexFlow's `Clef.types` table**, arriving as
  `ClefAnchor.lineY` already resolved. ⛔ **How big a clef is drawn** — including the **⅔** reduction
  for a change clef (`Clef.getPoint`) — is still VexFlow's, arriving as a resolved font.
- 🚨 **The group id `g.clef` is load-bearing** — `clefIndentPass.test.ts` and `e2e/slur.e2e.ts`
  both find clefs by it, and the registry's box resolves back to that ink.

⚠️ **A drawn POSITION is not a unit test** — jsdom measures every glyph at 0×0. Clef geometry belongs
in `e2e/` or, where our own primitives draw it, in the SCENE.

### 3.4 The other places a clef glyph appears

| where | what it draws |
|---|---|
| `rendering/GutterRenderer.ts:118` | the frozen gutter clef — `stave.addClef(staff.clef)`, full size |
| `rendering/GhostRenderer.ts` `drawClefGhost` | the armed-clef preview: one glyph on a **0-line stave**, following the cursor |
| `windows/clefWindow.ts` | the picker's four rows — 5 lines + a Bravura glyph, `font-size = 4 × SPACE` because **SMuFL's em square IS the staff height** |

⭐ **A small STAFF scales its clef for free.** A staff is drawn inside a `<g transform="scale(k)">`
group, so the clef shrinks with everything else — there is no clef magnification of our own, and
⛔ there must not be one. (`docs/small-staff-spacing.md`; the standing trap is visual coordinates
inside a scaled scope.)

---

## 4. The decisions already taken

| # | decision | value | who / when | where it lives |
|---|---|---|---|---|
| **A** | **the clef's INDENTATION** — how far its ink sits inside the staff's left edge | **0.7 sp** | HIS, **2026-09-01** (`docs/header-spacing-research.md` §8 A) | `headerInk.CLEF_INDENT` + `rendering/clefIndentPass` |
| **B** | clef → key signature | **0.82 sp** | HIS, by rejecting 1.5 — *"isn't the first accidental too far from the clef?"* | `keySignatureLayout.CLEF_TO_KEY_INK` |
| **D** | header → first note, keyed on what ends the header | **2.5** after a clef, **2.0** after a meter | HIS, 2026-09-01 | `headerInk.headerToNoteGap` |
| — | **no `Score.clef`** — clef is per-staff content, resolved positionally | — | `docs/clef-model-plan.md`; the hot fix was **explicitly rejected** by him | `clefOps` + `clefUtils` |
| — | the **m1 b0 opening clef is undeletable on every staff** | — | HIS, decision (b), `clef-model-plan.md` §4 | `clefOps.removeClefAt` |
| — | **the courtesy clef is OPT-IN**, per change | — | HIS: deferred 2026-06-01, then built as *Allow cautionary* | `cautionaryClefAllowedOf` |
| — | **beams stay beamed across a mid-measure clef change** | — | HIS, 2026-06-01 — *"I want the groups remain beamed"* | `createBeamGroups` groups by beat only |
| — | **the model stores WRITTEN pitch** under an octave clef | — | `docs/octave-clefs-plan.md` §1 (sounding pitch explicitly rejected) | ⏳ unbuilt |
| — | **no percussion clef** in the `Clef` union | — | Clef window design, 2026-07-20 | `docs/unpitched-staves-plan.md` |

⛔ **A** is CLOSED. ⛔ Do not re-open it by re-quoting Gould's drawing — she is one of the three
sources that produced 0.7, and the row is settled.

---

## 5. What the research settled, and what it left open

⭐ Evidence: **`docs/clef-research.md`** (2026-09-02, general) and **`docs/clef-spacing-research.md`**
(2026-08-29, position and spacing). This section is the index; ⛔ the numbers live there.

### ✅ Settled in the literature, and we agree

- **The order is clef → key → meter → note.** Four books, no dissent.
- **The clef is indented, by less than a whole space** — 0.6–0.8 sp across three books. ⇒ decision A.
- **A courtesy clef is CUE size; a courtesy key signature and meter are FULL size** — Gerou & Lusk
  p. 52, stated outright. ✅ `cautionaryExtent` implements exactly this.
- **A mid-measure change is drawn immediately before the note it affects** — Ross p. 167, Gerou &
  Lusk pp. 51–52. ✅ `interleaveClefNotes` does this.
- **A cautionary clef goes before the closing barline, and the next system's clef is full size** —
  all four books. ✅ We draw this (when allowed).
- **A key signature after a clef change is written in the NEW clef** — Gould p. 93. ✅
  `keySignatureLayout.cancelledOctave` resolves cancelling naturals against the new clef.

### 🚨 Where the literature and our drawing disagree

- ⭐⭐ **A clef change at a barline belongs BEFORE the barline. We draw it AFTER.** Gould p. 8
  (*"The clef always goes before the barline"*), Ross p. 166, Stone pp. 46/57, Gerou & Lusk p. 27 —
  and three of them add that only a *systemic* barline may precede a clef. Our bar-opening change is
  `stave.addClef(clef, 'small')` at the head of the new bar. First recorded 2026-08-29
  (`clef-spacing-research.md` PART 7); ⛔ **it is a drawing question and nothing here says how to fix
  it, or that it should be fixed.**

### ⏳ Open, and named as open by the code itself

`engine/engrave/header/clef.ts` parks two things as parameters rather than inventing a rule:

1. **WHICH LINE each clef names** — still VexFlow's `Clef.types` (transcribed as the row `CLEF_LINES`,
   `engrave/header/clefSign`, since the removal). The books state the rule
   (`clef-research.md` §2); nobody here has yet chosen to own the table.
2. **The small-clef RATIO.** ⚠️ The literature does **not** agree with itself: Gould *writes*
   two-thirds and *draws* three-quarters, six times; Gerou & Lusk *state* 75%; Ross *draws* 0.65–0.68;
   the engines span 0.65–0.88 and VexFlow uses exactly ⅔. ⛔ There is no single sourced answer to
   adopt — this is a house-style choice, and it is HIS.

⭐⭐ **And a third thing, which the research turned up and no code here distinguishes: a SMALL-STAFF
clef and a CHANGE clef are different reductions.** Bravura ships a stylistic set (`ss01`) whose
`gClefSmall`/`fClefSmall`/`cClefSmall` are the **same height and up to 10% WIDER** — an optical master
for a glyph already being scaled down — against `*Change` at 0.65–0.72. LilyPond states the same
principle in prose. ⛔ No engine surveyed uses `ss01`, and neither do we: we draw one glyph, scaled by
the staff group and again by VexFlow's ⅔. `docs/clef-research.md` §9.1.

### ⛔ UNKNOWN in every source that was read

⭐ Each of these was **looked for and not found**, with the pages read recorded in the research docs —
⛔ none of them is "the books are silent" standing in for not having looked:

- **The clef's ink extent above and below the stave as a STATED rule.** Every number we have is
  measured off a plate or read out of the font.
- **Why the treble clef's vertical split differs between engravers** (Gould draws it ≈0.3 sp higher
  on the stave than Ross and Gerou & Lusk, at the same total height).
- **Optical centring of a clef.** The word `optical` appears **nowhere** in Gould's whole book, and
  none of the three engines has a horizontal optical-centre rule for a clef.
- **A clef change WITHIN a measure, as a general rule** — ⭐ and Stone p. 46 *refuses* it in words:
  *"There are no specific rules for clef changes within a measure."* A stated non-rule is not a
  silence.
- **The FRENCH VIOLIN clef (G on line 1) and the BARITONE F clef (F on line 3)** — in **none** of the
  four books; a grep for *"French violin"* across all four returns 0 hits. ⛔ Absent, ⛔ not rejected.
  (All four engines support both.)
- **A stated SIZE or DISTANCE for an octave clef's numeral.** Every number is measured. ⚠️ Ross's
  *"the 8 being approximately 1½ spaces in height"* is the **ottava sign's** 8, ⛔ not a clef's.
- **Gardner Read**, *Music Notation*, and **Chlapik** — still not on disk.

---

## 6. Traps, in one place

1. 🚨 **`ClefNote.setXShift` is INERT** — shift the inner `Clef` element. (⭐ S12j-e: that shift is
   now `EngravedClefChange.glyphShift`; the change's own `getXShift()` still answers 0.)
   `reference: vexflow ClefNote setXShift is inert`.
2. 🚨 **A bar's opening clef is a stave MODIFIER, not a `ClefNote`** — §3.1. A pass that walks
   tickables will miss it entirely.
3. 🚨 **Never measure a clef from `getX()` alone** — a hand-nudged clef reports its position through
   `xShift`, and `firstSignX` measuring the unshifted origin left a key signature behind the clef
   the user had moved (fixed 2026-09-01).
4. 🚨 **A reused bar's stave reports where it WAS** — take x from the PLACEMENT, and apply
   `staleShift` when asking a modifier where it is.
5. ⚠️ **The indent moves the WHOLE header run** — ⛔ except the barline, which it is measured *from*.
   Moving the clef alone opened a gap only when a key signature was present.
6. ⚠️ **A modifier's `getWidth()` is a layout box, not ink** (`fontMetrics.clefGlyph`'s own note).
   Every spacing decision here is made in INK.
7. ⚠️ **The override compartment is uuid-keyed, so nothing in the redraw key moves** — a bar carrying
   only a clef-offset change is reused and the pass never runs.
   `reference: render width key vs shape key`.

---

## 7. Where to look next

| you are… | read |
|---|---|
| choosing an engraving number | `docs/clef-research.md` (general) · `docs/clef-spacing-research.md` (position & spacing) · `docs/header-spacing-research.md` (the run) |
| moving the drawing off VexFlow (✅ done, 2026-09-19) | `docs/own-engraving-engine.md` §P5 · `src/engine/engrave/header/clef.ts` |
| changing the model | `docs/clef-model-plan.md` · `docs/octave-clefs-plan.md` |
| touching the header's other symbol | `docs/key-signature-plan.md` — the closest sibling in every respect |
| adding a clef TYPE | `clefUtils.CLEF_MIDDLE_LINE_DIATONIC` + `ElementRegistry.CLEF_REFERENCES` + `fontMetrics.CLEF_GLYPHS` + `CLEF_CHOICES` in the window, and nothing else |
