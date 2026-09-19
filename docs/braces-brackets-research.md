# Braces and brackets — the research record (six agent reports, 2026-08-28)

> ⭐ **Kept because the scratchpad dies with the session and this cost six agents.** There is no
> plan under it yet — ⛔ **this document is EVIDENCE, not a work list**, and nothing here has been
> agreed as a feature.
>
> The question: the signs at the **left edge of a system** that join staves into a group — the
> piano **brace** `{`, the orchestral **bracket** `[`, the thin **sub-bracket** for divisi — and the
> **systemic (initial) barline** that stands with them.
>
> ⛔ **Do not re-run this research.** Every UNKNOWN is marked as one, with the route that failed;
> that list is the part that saves the next agent.
>
> ⚠️ **Read `docs/barline-join-research.md` beside this one.** It already settled the neighbouring
> question and its §5.1–§5.2 (*the join follows the bracket*; *the systemic barline is a separate
> thing*) and §4 (the file formats) are the direct upstream of everything here. 🚨 Its headline
> finding stands and is **not** re-opened by this document: **THE BRACKET DOES NOT OWN THE JOIN** —
> our join is a per-staff, per-measure fact (`StaffInfo.barlineJoinBelow`), and a bracket arriving
> later must not take it over.
>
> Revisions read: MuseScore `929d1e9` (⚠️ **5.0-dev**, shallow — see §2.1) · LilyPond `beedbfa` ·
> Verovio `efff0bc` (`~/dev/engine-sources`). Treatises: `reference/README.md`.

---

## 0. What was asked, and of whom

⭐ **The user's steer, mid-research** — *"the important thing for the online research is basically
the datamodel so we have to know how it match with ours"*. So **PART 1 is the point of this
document** and the geometry is secondary.

| # | agent | scope | landed |
|---|---|---|---|
| 1 | treatises | Gould · Ross · Gerou & Lusk · Stone, on disk — which sign when, nesting, geometry **measured off the scans** | ✅ PART 3 |
| 2 | font + engine metrics | SMuFL glyph inventory · Bravura `engravingDefaults` · **what VexFlow 5 already gives us** · what our own model already commits to | ✅ PART 4 |
| 3 | LilyPond | `SystemStart*` grobs · `systemStartDelimiterHierarchy` · `collapse-height` · the brace-glyph size search | ✅ §2.2 |
| 4 | MuseScore | `BracketItem` · columns · style defaults · the brace magnification | ✅ §2.1 |
| 5 | Verovio | MEI `<staffGrp>` · `GrpSym` · the SMuFL keys it honours | ✅ §2.3 |
| 7 | ⭐ Finale's brace (his ask) | what it mechanically is · the shape list · the sizing rule · the `.musx` fields | ✅ §2.4 |
| 6 | industry / online | ⭐ **MusicXML `<part-group>`** · MEI spec · Dorico/Sibelius/Finale · house styles | ✅ PART 5 (re-steered to the data model) |

---

# PART 1 — THE DATA MODEL, and how each one matches OURS

## 1.1 What WE have today

`src/types/music.ts`:

```
Score.staffGroups?: StaffGroup[]      // absent = a sketch: no groups at all
StaffGroup { … }                       // ~line 2305
```

- The grouping **SYMBOL is deliberately deferred** (`docs/multi-staff-plan.md` §0, §1): the model
  exists, the drawing does not. `ScoreRenderer.ts:4046` says so at the draw site.
- 🚨 `types/music.ts` ~line 2287 states outright that **the bracket does not own the join** — ⛔ not
  a boolean on `StaffGroup`.
- ⭐ **Everything that can change mid-score is POSITIONAL in this codebase**, never a `Score` field
  (`types/music.ts`'s note on the absent `tempo`/`keySignature`/`clef`;
  [[project_score_globals_should_be_positional]]). Whether a *group* can change mid-score is
  therefore the sharpest question to ask of every format below.

## 1.2 The comparison

⏳ *Filled as the reports land — the axes, fixed now so every row answers the same questions:*

| | owning object | how NESTING is expressed | may groups OVERLAP? | mid-score change? | groups PARTS or STAVES? | carries the barline join? |
|---|---|---|---|---|---|---|
| **ours** | `Score.staffGroups[]` | ⏳ | ⏳ | ⛔ **must be positional** if it can | STAVES (staff ids) | 🚨 **NO** — separate per-staff fact |
| MusicXML | `<part-group>` span in `<part-list>` | start/stop pair matched by `number` (⛔ **not** a depth) | ✅ **YES, legal and named** | ⛔ **NO — header only** | **PARTS** | `<group-barline>` — ON the group |
| MEI | `<staffGrp>` (container) | **containment**, unlimited depth (+ `<grpSym>` span with an explicit `level`) | ⛔ **NO** — unrepresentable | ✅ **YES** — `scoreDef` is a milestone | `staffDef` descendants ⇒ STAVES | `@bar.thru` — ON the group, INHERITED |
| MuseScore | `BracketItem` on `Score` | **a column integer** | ✅ yes, unenforced | ⏳ | STAVES (`startStaffIdx` + count) | ⛔ no (one narrow clause, §2.1) |
| LilyPond | a CONTEXT (grob per node of a nesting tree) | a **tree** — nested contexts or `systemStartDelimiterHierarchy` | ⛔ no — a tree | ⛔ no (a context is structural) | STAVES (contexts) | ⛔ no — `Span_bar_engraver` varies independently |
| Verovio | MEI's `<staffGrp>` + a synthetic `GrpSym` | containment (walk, no depth limit) | ⛔ no — `<grpSym>` spans **cannot cross a group** | ✅ (MEI's milestone) | STAVES | ⛔ separate: systemic line ≠ `@bar.thru` |
| ⭐ **Dorico** | a **change on a timeline**, per layout | sub-bracket / sub-sub-bracket levels | ⛔ **no** — *"cannot overlap"*, existing groups adjusted | ✅ **YES** — signposted, *"until the next change"* | instruments | ⭐⭐ **NO — a SEPARATE command** (*Change barline joins*) |
| Sibelius | declared by INSTRUMENT (*"Bracket with"*) | bracket / sub-bracket / brace | ⏳ | a per-**bar** draw flag only | instruments | ⛔ no — *"**normally** also joined"* (a convention word) |
| Finale | (top staff, bottom staff) × a MEASURE RANGE | — | ✅ **YES** — *"staves can belong to more than one group"* | ✅ **YES** — a measure range | STAVES | ON the group (3-way incl. Mensurstrich) |

---

# PART 2 — THE ENGINES, read first-hand

## 2.1 MuseScore — a SPAN model with a COLUMN integer for nesting

> Source: `~/dev/engine-sources/MuseScore` @ `929d1e9`.
> ⚠️⚠️ **CAVEAT, and it limits everything below.** `version.cmake:24` says **MuseScore 5.0 dev**,
> not a released 4.x, and the clone is **shallow** (`.git/shallow`, `rev-list --count` = 1) — there
> is no history, so **MS3-vs-MS4 questions are unanswerable from it** and some of what follows may
> be unreleased.

### The model — who owns the span

Two classes, and the split matters:

- **`BracketItem`** (`src/engraving/dom/bracketitem.h:38`) — the **saved** document object.
- **`Bracket`** (`dom/bracket.h:38`) — the **drawn**, per-system object. `setGenerated(true)` with
  the comment *"brackets are not saved"* (`bracket.cpp:53`); its property edits delegate to the item
  because the Bracket *"does not survive layout()"*.

⭐ `BracketItem` owns the span **outright** — there is **no group object at all**:

```
m_startStaffIdx + m_bracketSpan (a STAFF COUNT) + m_column + m_bracketType   // bracketitem.h:77-84
```

The list lives on **`Score`**: `std::vector<std::vector<BracketItem*>> m_brackets` (`dom/score.h:965`),
outer index = staff, inner index = column. ⚠️ In MuseScore 4 this lived on `Staff`; `staff.h` now
only forward-declares the type. Part scores get theirs **rebuilt**, not copied —
`Score::remapBracketsAndBarlines()` (`score.cpp:3530`). Instrument templates carry a seed
(`instrtemplate.h:118-120`).

**File format**: `<BracketItem>` inside `<Staff>` inside `<Part>` (`rw/write/twrite.cpp:2936-2972`),
with `<type>` / `<bracketSpan>` / `<level>` / `<visible>`. 🚨 `Pid::BRACKET_COLUMN`'s XML tag is
literally **`level`** (`dom/property.cpp:327`) — the column is what a reader sees as "level". The
legacy form `<bracket type="0" span="4" col="0"/>` is still read (`read500/tread.cpp:4212`).

**Types**: `NORMAL, BRACE, SQUARE, LINE, GROUP, NO_BRACKET = -1` (`types/types.h:1176`). `GROUP` is
the newer named margin bracket.

### Nesting is a COLUMN, ⛔ not a hierarchy

Column 0 = innermost; each higher column stacks further **left**.
`setBracketsXPosition` (`rendering/score/systemheaderlayout.cpp:271-295`) accumulates `xOffset` from
every bracket with a **lower column that it intersects** — so disjoint ranges do not push each other
apart. On creation, `EditStaffBrackets::undoAddBracket` (`editing/editstaffbrackets.cpp:33-77`) bumps
existing colliding brackets outward to `column+1`. ⭐⭐ **Nothing enforces proper nesting after
that** — overlapping, non-nested groups are representable in the model.

⚠️ **There is no column-gap style**: the gap between columns is each bracket's own trailing distance,
baked into `ldata->bracketWidth`.

### Style defaults (all in spatia — `_sp` = `Spatium`, `types/spatium.h:128`)

`style/styledef.cpp:57,177,189-199,277`:

| key | default |
|---|---|
| `bracketWidth` | **0.45** |
| `bracketDistance` | **0.45** |
| `akkoladeWidth` (the brace) | **1.5** |
| `akkoladeBarDistance` | **0.35** |
| `akkoladeDistance` | **6.5** |
| `groupBracketLineWidth` | **0.11** |
| `groupBracketHookLen` | **1.0** |
| `groupBracketDistanceToGroupBracket` | **1.0** |
| `staffLineWidth` | 0.11 |
| `barWidth` | 0.18 |

**Projection beyond the staff lines** (`tdraw.cpp:1099-1186`):

- **NORMAL** — overshoots **0.25sp** (Leland: **0.5sp**), plus half the 0.45 stroke, plus the
  `bracketTop`/`bracketBottom` SMuFL tips beyond that.
- ⭐⭐ **BRACE, SQUARE and GROUP — ZERO overshoot.**
- **LINE** — 0.055sp. Its thickness is a bare literal `0.67 × bracketWidth` = 0.3015 (⛔ UNKNOWN why 0.67).
- **SQUARE** — thickness is `staffLineWidth` (0.11), hooks **0.555sp**.

None of the four size keys appear in any `.qml` ⇒ not UI-exposed (**inference from absence**).

### The brace's width — a magnification, computed BEFORE the height is known

Two paths:

1. **Emmentaler / Gonville** — a hand-coded **18-cubic bezier** on a 700×7100 grid, width fixed at
   `akkoladeWidth` (`tlayout.cpp:1438-1463`).
2. **Otherwise a SMuFL glyph scaled ANISOTROPICALLY.** `Bracket::setStaffSpan`
   (`dom/bracket.cpp:76-109`): `v` = visible staves spanned (hidden inner staves decrement it; Leland
   clamps `v = min(4, v)`), then

   ```
   magx = v + (v − 1) × 1.625
   ```

   with the source comment *"1.625 is a 'magic' number based on akkoladeDistance/4.0 (default value
   6.5)"*. Glyph by count: 1 → `braceSmall`, 2 → `brace`, 3 → `braceLarge`, else `braceLarger`. At
   draw time `painter->scale(magx, bracketHeight/symHeight)` (`tdraw.cpp:1116-1119`).

   ⭐ **Agent's arithmetic on that comment** (marked as inference): a `v`-staff brace is
   `4sp × (v + (v−1)×1.625)` tall, so `magx` is the height in units of one 4-sp staff *under default
   spacing* — i.e. **the aspect ratio is preserved only while `akkoladeDistance` is 6.5**. Change the
   staff distance and the brace distorts.

### When it is drawn

- On **every system** — no first-system-only option exists.
- A genuinely 1-staff bracket **IS** drawn.
- A bracket **reduced** to one staff by hidden staves is **suppressed** — the gate is
  `bi->bracketSpan() == span` (`systemheaderlayout.cpp:110-115`), overridable by
  `alwaysShowBracketsWhenEmptyStavesAreHidden` / `...SquareBrackets...`, both default **false**.
- With hidden staves the bracket **shrinks to the visible run** (`layoutBracketsVertical`, `:297-329`),
  and the brace's `v` shrinks with it.

### The initial barline — ⭐ the ONE place the bracket touches the join

`MeasureLayout::createSystemBeginBarLine` (`measurelayout.cpp:2059-2100`). Drawn when:

- visible staves `n > 1` **and** `startBarlineMultiple` (default **true**), **or**
- `n == 1` **and** (`startBarlineSingle`, default **false**, **or the system has any bracket**).

⭐⭐ **That last clause is the only bracket↔barline coupling in MuseScore** — a single bracketed staff
gets an initial barline it would not otherwise have. Otherwise the two are independent, which agrees
with our decision. Per-staff opt-out: `Staff::hideSystemBarLine()` → `isSkipDraw`
(`tlayout.cpp:1074-1082`).

### ⛔ No engraving authority anywhere in it

Grepping all of `src/engraving` for Gould / Ross / *Behind Bars* finds citations only in
`slurtielayout.cpp:694,832` and `chordlayout.cpp:834` — **nothing in the bracket code**. Every
bracket number above is an **unattributed house value**. ⭐ Worth remembering before any of them is
copied as if it were a rule.

### MuseScore UNKNOWNs

- MuseScore 3's numbers. Only the *fact* that `bracketDistance` was deliberately discarded at 4.0 is
  verifiable (`style/style.cpp:421-428`, *"Using the new defaults instead"*).
- When brackets moved `Staff` → `Score`; whether `GROUP` exists in 4.x. **Shallow clone, no history.**
- All SMuFL brace/tip glyph metrics — read from the font at runtime, so a NORMAL bracket's *total*
  projection is **not a constant in this source**.
- Why `0.67`.
- Whether the four size keys are UI-exposed (inferred **no**, from absence in the `.qml`).

## 2.2 LilyPond — ONE class, four styles, and nesting by SKYLINE

> Source: `~/dev/engine-sources/lilypond` @ `beedbfa`.

### The model — one class, four grob names

`System_start_delimiter` (`lily/system-start-delimiter.cc:97-147`) dispatches on a `style` property:
`bracket` / `brace` / `bar-line` / `line-bracket`. ⭐ **The four signs are one thing with a style**,
which is a shape worth noting against MuseScore's five-member enum.

Context defaults (`ly/engraver-init.ly`): **Score → `SystemStartBar`** (:815), **StaffGroup →
`SystemStartBracket`** (:481), **GrandStaff → `SystemStartBrace`** (:526). PianoStaff inherits
GrandStaff; ChoirStaff inherits StaffGroup **minus `Span_bar_engraver`** — which is
`docs/barline-join-research.md`'s finding restated: the delimiter and the span bar vary
**independently**.

⭐ **No context defaults to `SystemStartSquare`** — the divisi sub-sign is opt-in, and it is a
**square bracket**, ⛔ not a thin bracket. The engraver
(`lily/system-start-delimiter-engraver.cc`) builds a `Bracket_nesting_group` **tree**, one spanner
per node.

### Nesting — a TREE, and ⭐⭐ the DEEPER sign goes FURTHER LEFT

Two routes, same rule: `systemStartDelimiterHierarchy` (a nested list within one context) and nested
contexts. `set_nesting_support` (:107-115) makes the parent a **side-support of the child**, and
announcements only travel upward (`lily/engraver-group.cc:100-113`), so the outer context
acknowledges the inner grob.

🚨 **LilyPond states the order itself**, in `input/regression/system-start-bracket.ly:15-17`: *"a
piano context included within a staff group should cause the piano brace to be drawn **to the left
of** the staff angle bracket"*. ⇒ Score's bar sits **innermost**.

⭐⭐ **THIS AGREES WITH VEROVIO** (§2.3) and **DISAGREES WITH MUSESCORE** (§2.1, column 0 innermost
nearest the staves). Two of three engines put the deeper sign further out. ⚠️ The LilyPond agent adds
that this is *"the reverse of Gould for sub-grouping"* — ⛔ **so do not settle the order from code**;
PART 3 is measuring what she draws.

⭐ **Stacking is a SKYLINE**, not fixed columns (`side-position-interface.cc:263-322`), so vertically
disjoint signs can share an x. ⭐ Same conclusion as §2.3 and §2.1 by three different routes:
**no engine has a nesting-indent CONSTANT.**

### Numbers (staff-spaces; `line-thickness` = 0.5 pt = **0.1 ss** at a 20 pt staff, `scm/paper.scm:52`)

`scm/define-grobs.scm:3659-3720`:

| grob | `collapse-height` | `padding` (gap to the sign on its right) | thickness |
|---|---|---|---|
| `SystemStartBar` | 5.0 | **−0.1** (*"must cover rounded ending of staff line"*) | 1.6 × lt ≈ 0.16 |
| `SystemStartBrace` | 5.0 | 0.3 | — (the glyph carries it) |
| `SystemStartBracket` | 5.0 | **0.8** | **0.45 raw ss** (⛔ not × lt) |
| `SystemStartSquare` | 5.0 | 0 (unset) | 1.0 × lt ≈ 0.1 |

**Bracket overshoot**: the tips are font glyphs `brackettips.up/down`
(`mf/feta-brackettips.mf:91-98`) — stem 0.45 ss, reach 1.9 ss, `flattening = 0.72` ⇒ flare 1.368 ss.
The tip's foot lands **exactly on the outer staff line**, so the bracket **projects ≈ 1.593 ss past
each outer line** (the rod itself overshoots only 0.045 ss). ⭐⭐ **The brace and the square have ZERO
overshoot** — the same answer MuseScore gives (§2.1), from a different codebase.

⚠️ The square's 0.8 ss arms are **hard-coded** (`system-start-delimiter.cc:73`), not a property, and
tip thickness is baked into the font — so **overriding `thickness` desyncs the rod from its tip**.

### The brace — 576 PRE-DRAWN GLYPHS, binary-searched, ⛔ never stretched

**576** glyphs, `brace0`…`brace575`, 9 sub-fonts × 64 (`mf/feta-braces.mf:26,92`). Heights ≈10.5 pt →
384.9 pt; widths 2.33 → 14.05 pt; thin stroke 0.219 → 0.903 pt, the step growing as width/10.
Selection (`scm/define-markup-commands.scm:5196-5240`): convert the span to points, then a **binary
search** (`scm/lily-library.scm:1484`, mode `last-less-than-or-equal`) for the **largest glyph ≤ the
span**. Out of range ⇒ a warning (*"no brace found for point size …"*, *"defaulting to … pt"*) and
the clamped glyph — an oversized span simply gets `brace575`, **too short**.

⭐⭐ **A third answer to the brace-width question**, and the most expensive: no scaling at all,
576 drawings. See §4.7 — the three ladders disagree by up to 36%.

### Collapse — ⭐ a ONE-STAFF group prints NOTHING

`collapse-height >= len / staffspace` ⇒ `suicide()` (`system-start-delimiter.cc:126-133`); the unit
is **staff-spaces**, guarded by its own regression. Default **5.0**, and a 5-line staff spans 4 ss ⇒
**a one-staff group prints nothing at all, the bar included.**

🚨 **Three engines, three answers** to the same question: LilyPond suppresses a one-staff group
outright; Verovio never suppresses (§2.3); MuseScore draws a genuine one-staff bracket but suppresses
one *reduced* to a single staff by hiding (§2.1).

Drawn on **every system** (a plain spanner, no `break-visibility`), re-measured per system from only
the staves whose LEFT bound matches. Hara-kiri suicides the `StaffSymbol` too, so hidden staves drop
out automatically; `\RemoveEmptyStaves` leaves `remove-first` false, so **the first system keeps its
empty staves**.

### The initial barline

Just another member of the family and **independent of bracket/brace** — a `StaffGroup` inside a
`Score` gets **both**. It is ⛔ not a `BarLine` item at moment 0. At 1.6 × lt it is **thinner than a
normal thin barline** (`BarLine.hair-thickness = 1.9`), ≈ 84%.

### ⭐ The only engine that cites an authority — and it says where it DEPARTS

- `scm/define-grobs.scm:264-268` cites **Ross p. 151** for barline weights and says LilyPond
  deliberately departs (*"we opt for a leaner look"*).
- `lily/bar-engraver.cc:411-413` cites **Gould, *Behind Bars* p. 497** on initial barlines through
  cue staves.

⛔ **But nothing sources the bracket's 0.45, the 1.9/0.72 tip proportions, the paddings, the 5.0
collapse height, or the brace ladder.** ⇒ **all three engines: not one cited number for a bracket.**

### LilyPond UNKNOWNs

- No LilyPond binary and no built doc images on disk ⇒ the nesting order is **code-read +
  regression texidoc, not rendered**.
- The composed final x of each sign (e.g. *"tips overhang the left column by ≈0.65 ss"*) is the
  agent's derivation through `aligned_side` + `Skyline::distance`, **stated nowhere in the source** —
  flagged unverified.
- Whether `ly:otf-glyph-count` returns 576 or 577 after the FontForge merge — unverifiable without
  building the font.
- The brace height table was computed by re-running the MetaFont loop; the generated artefacts are
  not committed.

## 2.3 Verovio — a CONTAINER model, unlimited nesting, and the x-order that may be BACKWARDS

> Source: `~/dev/engine-sources/verovio` @ `efff0bc`. ⭐ The most relevant of the three to us: an SVG
> engraver driven by a document model, drawing SMuFL glyphs directly.

### ⚠️ Read every number through the unit system

`unit` = **half a staff space** (`src/options.cpp:1202`), default 9.0. A staff is 8 units tall, and
the music font's point size is `unit * 8` (`Doc::CalcMusicFontSize`) ⇒ **1 em = 4 staff spaces**,
SMuFL-style. Internal y is up.

### The model — CONTAINMENT, ⛔ not a span

`StaffGrp` (`include/vrv/staffgrp.h:29`) mixes `AttStaffGroupingSym` (`@symbol`) and `AttBarring`
(`@bar.thru`). ⭐⭐ **Nesting is containment, confirmed three ways**: `IsSupportedChild` admits
`STAFFGRP` among its own children (`src/staffgrp.cpp:70`), the reader recurses
(`src/iomei.cpp:5376`), and the drawing walk recurses with **no depth limit**
(`src/view_page.cpp:342-349`). The only structural requirement is that every `staffGrp` holds ≥1
`staffDef` (`src/iomei.cpp:5393`). A group's staves are the **flattened `staffDef` descendants**
(`FilterList`, `src/staffgrp.cpp:88`).

⭐⭐ **Which is the sharp contrast with MuseScore's span+column** (§2.1): a container model makes
overlapping non-nested groups *unrepresentable*, where MuseScore's columns make them representable
and simply unenforced.

**`GrpSym` exists separately** for three evidenced reasons:
1. Verovio normalizes `staffGrp/@symbol` into a synthetic `GrpSym` child flagged `IsAttribute(true)`,
   so both MEI spellings share one render path (`src/iomei.cpp:5334-5341`).
2. A `<grpSym>` under `<scoreDef>` can span an **arbitrary run** via `@startid`/`@endid` + `@level`
   (used as *search depth*) — refused when the endpoints have different parents, with the message
   *"we cannot draw cross-group grpSym"* (`src/setscoredeffunctor.cpp:583-632`). ⭐ i.e. the escape
   hatch from containment exists, and it explicitly **cannot cross a group boundary**.
3. It is a drawable with its own SVG id, while `GetDrawingX/Y()` both return 0 (`src/grpsym.cpp:64`)
   — position comes **entirely from the walk**.

### X placement — ⭐⭐ and the order looks INVERTED against MuseScore

One running `x` starts at `system->GetDrawingX()` and marches **left**. Per level: draw this group's
symbol, decrement `x`, recurse into the children with the decremented value — passed **by value**, so
siblings do not stack.

🚨 **Consequence, as reported: the OUTERMOST group sits nearest the barline and each nested level is
drawn further left** — the opposite of MuseScore, where column 0 (innermost) sits nearest.

✅⭐⭐ **RESOLVED — VEROVIO IS RIGHT.** This was flagged here as *"may be backwards, do not copy"*
until PART 3 landed. **Gould, Ross and Stone all put the SMALLER group's sign further LEFT** (§3.2,
measured), LilyPond does the same, and **MuseScore is the odd one out**. ⛔ The flag stood only
because three code-reads disagreed; one measurement of what she drew settled it.

There is **no single inter-level constant** — the advance is per symbol
(`src/view_page.cpp:434-458`): `line` → 2×lineWidth (1 sp); `brace` → 2.5 units (1.25 sp);
`bracket` → `unit·(1+bracketThickness)` (1 sp); `bracketsq` → 1 unit (0.5 sp).

⚠️ **Horizontal room is reserved only via LABELS**: `SetDrawingLabelsWidth` is called solely in
`DrawLabels` and folds `grpSymSpace` into it (`src/view_page.cpp:352-356`, `:539`); the system then
shifts by it (`src/alignfunctor.cpp:574`). **With no labels, nothing is reserved for the brace at
all.**

### Numbers (defaults, converted to staff spaces)

- **Bracket** = a filled **rectangle + `bracketTop`/`bracketBottom` glyphs**, ⛔ not a path
  (`src/view_page.cpp:557-576`). Thickness `bracketThickness` **1.0 unit = 0.5 sp**; gap to the
  barline 1 unit = 0.5 sp; the rectangle projects **0.65 unit (0.325 sp)** past each outer staff
  line, and the serif glyph adds Bravura's 295/1000 em = **1.18 sp** ⇒ **total ink projection ≈
  1.47 sp**. The serif is 1.88 sp wide and curls **right, past the barline**.
- **Sub-bracket** (`bracketsq`) = **three rectangles** (`DrawSquareBracket`, `src/view_graph.cpp:233`).
  Vertical stroke `subBracketThickness` **0.20 unit = 0.10 sp**; arms are staff-line width
  (0.075 sp), 0.5 sp long; projects only **0.0375 sp**.
- **Systemic barline** `barLineWidth` 0.30 unit = **0.15 sp**, left edge on the system x.
- **Vertical**: `spacingBraceGroup` / `spacingBracketGroup` both default **12 units = 6 sp** — a
  MINIMUM inter-staff space *inside* a group (`src/options.cpp:1494-1502`) — plus a serif-clearance
  overlap for `bracket` only (`src/verticalaligner.cpp:703-717`). ⭐ Note this is a group affecting
  STAFF SPACING, which our model has no equivalent of.

### The brace — TWO implementations, and the glyph is not the default

`useBraceGlyph` **defaults to false** (`src/options.cpp:1206`).

- **Glyph mode**: scales `E000` uniformly by `scale = (y1−y2) / (8·unit)` — the natural height is
  **hardcoded at 8 units**, which the agent measured as 0.2–1% off for every shipped font — then
  applies an x-only `widthToHeightRatio = braceWidth / (naturalWidth·scale)`, so the drawn width is
  **always exactly 2 units = 1 staff space regardless of height**
  (`// We want the brace width always to be 2 units`, `src/view_page.cpp:603`; honoured as an
  anisotropic `scale()` in `src/svgdevicecontext.cpp:1204`).
- **Default mode**: a **computed pair of cubic Béziers per half**, filled between them — tip at x,
  control 1 at (x−4u, 6u inward), control 2 at (x+1u, 2u from mid), cusp endpoint at (x−2u, mid); the
  second curve offsets both controls by `xdec = beamWhiteWidth + stemWidth = 0.7u`, which **is** the
  brace's thickness; pen 0.2u, round caps. **All literals, no options, no citation.**

⭐⭐ **Both modes are height-independent in x** — the brace's horizontal reach never changes with the
group's height. ⚠️ That is the exact opposite of MuseScore's anisotropic `magx` (§2.1), which widens
the brace as the group grows. **A real disagreement between two shipping engines**, and a decision we
would have to make ourselves.

### When it is drawn

Once per system (`src/view_page.cpp:207`), and again after a label-drawing `scoreDef` change
(`:1718`). ⭐ **A single-staff group is NOT suppressed** — no such check exists anywhere (the agent
looked). A fully hidden group returns early; when *some* staves are hidden the symbol **shrinks to
the visible span** (`GetFirstLastStaffDef` skips hidden defs, and `ScoreDefOptimizeDoc` re-runs
`ScoreDefSetGrpSymDoc()` afterwards — `src/doc.cpp:1024-1038`).

### The initial barline — independent, and drawn FIRST

Drawn independently of, and *before*, the symbol; only for the **top** group; spanning the whole group
through the gaps **regardless of `@bar.thru`** (`src/view_page.cpp:327-333`).
`HasSystemStartLine()` (`src/scoredef.cpp:616`): >1 `staffDef` **or** a direct `<grpSym>` ⇒ drawn,
unless `@system.leftline="false"`; otherwise **a single staff gets none** unless
`@system.leftline="true"`.

⭐⭐ **Ordinary barlines are a separate mechanism**, and this is the direct confirmation of our own
decision: `IsDrawnThrough` walks up the `staffGrp` chain and is **false when `@bar.thru` is absent
anywhere**, and only then is the across-the-gap segment drawn (`src/barline.cpp:87`,
`src/view_page.cpp:775`). So even in a format where the join hangs on the group, the *systemic* line
and the *joined barline* are two different things — `docs/barline-join-research.md` §5.2.

### What it consumes of SMuFL

Honours `bracketThickness` and `subBracketThickness` (plus 22 others) in `Options::Sync`, converting
**staff spaces → MEI units by ×2** (`src/options.cpp:2101-2146`).
🚨 **It does NOT read the font's `metadata.json`** — `Sync` returns unless the user passed the
`engravingDefaults` string or `engravingDefaultsFile` option, and the shipped `data/*.xml` font
descriptors carry bounding boxes and anchors only. ⇒ its `subBracketThickness` default (0.10 sp)
**differs from Bravura's published 0.16 sp**. Glyphs consumed: **only** `E000 brace`,
`E003 bracketTop`, `E004 bracketBottom` — `bracketsq` and `line` use no glyphs at all.

### Verovio UNKNOWNs

1. ⭐ **Whether the leftward nesting order is intentional** — no comment, no fixture, not rendered.
2. Provenance of the brace's Bézier constants — bare literals, no citation.
3. Whether *"brace natural height = 8 units"* was measured or assumed.
4. Any deliberate one-staff suppression — **none found**.
5. The true leftmost ink of the default brace (only the cusp, 2u, is reported).
6. Non-SVG back ends.

⛔ **No Gould/Ross citation exists in the brace/bracket code.** The only one in the whole source is
about horizontal spacing (`include/vrv/horizontalaligner.h:221`). ⭐ Same finding as MuseScore: two
engines, no cited authority for a single bracket number.

## 2.4 ⭐⭐ Finale — the brace is GENERATED VECTOR ART, and its width is 1.00 sp FLAT

> His question, 2026-08-28: *"i remember finale had a special brace"*. He was right, and it is the
> most different answer of the five.
> Sources: MakeMusic's own manuals (`usermanuals.finalemusic.com`, versioned trees — **images
> included**, which is what settled the shape list) and **`rpatters1/musxdom`** (MIT, a C++17 DOM for
> Finale's `.musx`/ENIGMA format **with 99 real Finale 27.4 fixtures**), now cloned to
> `~/dev/engine-sources/musxdom`. ⚠️ Finale was discontinued in 2024; the manuals are still served.

### What it mechanically IS — ⛔ not a font glyph

MakeMusic's manual, verbatim (*Document Options — Piano Braces and Brackets*):

> *"Finale creates a piano brace by **drawing two sets of curves, then filling the space in between
> with black** to produce a smoothly tapered brace. By tugging on handles that control the curves,
> you can make different sections of the brace thicker or thinner."*

⭐ **Four handles — Outer Tip, Inner Tip, Outer Body, Inner Body**, each H+V — plus a **Width** handle
at the centre cusp. The labelled diagram shows handles on the upper half only (mirrored below —
*the agent's inference*).

Confirmed independently by **notat.io** (*"Finale draws the piano brace from curves, whereas Dorico
uses font glyphs"*) and **musescore.org** (*"Finale did not use braces from a font"*). ⚠️ The Finale
Maestro font **does** carry a brace at U+E000 — **Finale never used it.** ⛔ Nor is it a Shape
Designer object: that tool's `bracket` opcode *"does not actually draw the bracket… it indicates the
start of automatically created instructions"*.

### The shape list — nine shapes, one document-wide brace design

`FCGroup::FCGROUP_BRACKETS` (`pdk.finalelua.com`): **None, Plain, Chorus, Piano brace, Reversed
chorus, Reversed piano brace, Curved chorus, Reversed curved chorus, Desk** (*"thin line with 90
degrees angle"*)**, Reversed desk.**

⛔ **There is no "Bracket Designer".** Per group you pick a shape plus three offsets; **the brace's
SHAPE is one document-wide setting**. Engravers on notat.io: *"the Brace Designer is really clunky,
and the developers haven't touched it in over a decade."*

### ⭐⭐ THE NUMBERS — measured across 99 REAL FINALE FILES

`.musx` record **`pianoBraceBracketOptions`** (12 fractional-EVPU fields); the per-group record is
**`brackSpec`** = `<id>` shape + `<bracPos>` / `<bracTop>` / `<bracBot>` / `<onSingle>` — **and that
is the whole of it**. At 1 sp = 24 EVPU:

| | EVPU | staff spaces |
|---|---|---|
| ⭐⭐ **width** | **24** | **exactly 1.00 sp** |
| centre thickness | 3.6 | 0.15 sp |
| tip thickness | 7.2 | 0.30 sp |
| default distance | −12 | −0.5 sp |
| outerTip | (−12, 48) | — |
| innerTip | (24, 24) | — |
| outerBody | (6, 24) | — |
| innerBody | (0, −12) | — |

⚠️ A second, sparser set (**width 12 = 0.5 sp**) appears in 10 of the 99 files and matches the 2010
manual screenshot exactly. ⭐ Bonus, from MuseScore's own Finale importer:
`Sid::bracketWidth 0.5  // Hard-coded in Finale`.

### ⭐⭐ Sizing — a FOURTH confirmation that the depth is CONSTANT

Height is automatic (*"each bracket is automatically sized to match its corresponding group"*) and
hand-stretchable. ⛔ **No source states the sizing rule** — that is the report's one real UNKNOWN.
But **all shape parameters are absolute lengths held ONCE per document, and the per-group record has
no height, width or thickness field at all** ⇒ the width is fixed and the middle stretches. *(The
agent labels this an inference; the file-format evidence for it is strong.)*

⇒ 🚨 **Same answer as Verovio, by a completely different route** — and it makes **four independent
confirmations of the constant depth** (§3.4):

| source | brace depth | kind of evidence |
|---|---|---|
| **Gould p. 331** | 0.89 / 0.89 / 0.84 sp for 2/3/4 staves | measured off the engraving |
| **Ross p. 155** | flush, no overshoot (stated) | prose |
| **Verovio** | flat 1.0 sp at every height | source code |
| **Finale** | **1.00 sp**, no per-group width field | **99 real files** |

⛔ Against: MuseScore's `magx` and LilyPond's 576-glyph ladder, both of which widen with height.

⛔ **And no evidence was found that Finale's brace distorts when TALL** — the recorded complaint is
the opposite end, *small* staff distances (musescore.org). The comparative complaint runs the other
way: *"making the piano brace a glyph was a huge mistake"* (against Dorico).

### ⚠️ What this costs the "use a glyph" argument

Finale is a serious counterexample to *"a glyph is ink a type designer drew"*: it drew **parametric
curves with a tapered fill**, kept it for the program's whole life, and its engravers defend it
against Dorico's glyph. ⭐ But note what it does **not** overturn — its width is **constant**, which
is the rule §3.4 settled. **Mechanism and rule are separate questions**, and only the mechanism is
still open.

### Finale UNKNOWNs and dead routes

- ⛔ **The sizing rule itself** — stated nowhere; the constant-width reading is an inference from the
  absence of per-group fields.
- Whether the four handles are mirrored below the cusp — inferred from the diagram.
- ⛔ **`www.finaletips.nu` is DNS-DEAD** — use `pdk.finalelua.com`.
- 🚨 **musescore.org and notat.io are CLOUDFLARE-GATED**: WebFetch 403, curl with a browser UA 403,
  and **`r.jina.ai` returns HTTP 200 carrying the *"Just a moment…"* interstitial — a SILENT
  failure**. ⛔ Only WebSearch surfaces their prose. (⚠️ This supersedes `reference/README.md`'s note
  that notat.io merely needs a browser User-Agent.)
- ✅ `usermanuals.finalemusic.com` versioned trees serve fine, **images included**.

---

# PART 3 — THE TREATISES

> Gould, Ross, Gerou & Lusk, Stone — all four on disk. ⭐⭐ **Almost every NUMBER below is a
> MEASUREMENT off the scans, not a quotation**, because the books state almost none of them (§3.7).
> 450 dpi, 1 stave-space = 20 px (`reference/README.md`).

## 3.1 WHICH SIGN

- **Brace** = **one instrument / one performer** on several staves — keyboard, harp, marimba, organ
  manuals. Gould **p. 514**, Ross **p. 155**, Gerou & Lusk **p. 43**.
- **Square bracket** = a **section / family / group of SEPARATE players**. Gould **p. 516**, Gerou
  **pp. 43–44**.
- **Thin secondary bracket** = a **sub-group inside a section** — like woodwinds, one percussionist's
  staves, like voices, a divided string line. Gould **p. 518**.
- **Organ**: manuals braced, and ⛔ **the pedal stave never takes a brace** (Gould **pp. 342–3**); a
  single-stave manual takes a *compressed* brace.
- **A single-stave section still takes a bracket**; ⛔ **timpani, single percussion, soloists and solo
  vocal lines take none** (Gould **p. 516**).

## 3.2 ⭐⭐ NESTING — the order is UNANIMOUS, MEASURED, and it settles §2.3's flag

Left → right:

```
[innermost group's sign]  [outer group's sign]  [section bracket]  [systemic barline = staff's left edge]
```

⭐⭐ **THE SMALLER THE GROUP, THE FURTHER LEFT THE SIGN.** Confirmed in **Gould p. 509 Table 2 (a)
and (c)**, **Gould p. 518** (all three figures), and **Ross pp. 155 and 156** — measured, not
inferred.

Stated outright: *"A brace should only ever be used as the **outermost** bracket"* (Gould **p. 516**,
verified on the scan). And independently, **Stone p. 6** on organ: *"the curly brace covers the two
manual staves only, while **the straight line that follows** must always connect all three"* — *follows*
= to its right. Gould's *"but not"* figure rejects only **a brace inside a brace**.

### 🚨 THE CORRECTION THIS FORCES

| source | deeper/smaller sign goes… | agrees with Gould? |
|---|---|---|
| **Gould / Ross / Stone** | **further LEFT** | — |
| **LilyPond** (§2.2) | further LEFT | ✅ **yes** |
| **Verovio** (§2.3) | further LEFT | ✅ **yes** |
| **MuseScore** (§2.1) | column 0 = innermost **nearest the staves** | ❌ **no — the odd one out** |

⛔⛔ **Two earlier notes in this document were WRONG and are corrected here:**
1. §2.3 flagged Verovio's leftward order as *"may be BACKWARDS… do not copy without checking"*. **It
   is correct.** The treatises confirm it.
2. §2.2 relayed the LilyPond agent's claim that LilyPond's order is *"the reverse of Gould for
   sub-grouping"*. **It is not** — LilyPond's piano brace left of the enclosing staff-group bracket is
   exactly Gould's rule, since the piano is the *smaller* group.

⭐ **The lesson, and it is the repo's own**: the question *"who is further left"* was answered by
three code-reads that disagreed, and settled in one measurement of what she DREW.

## 3.3 BRACKET geometry

| | value | source |
|---|---|---|
| **thickness** | **0.50 sp** — *stated identically* | Gould **p. 516** (*"the square bracket is beam thickness"*) + **p. 21** (*"beam thickness is ½ stave-space"*); Ross **p. 155** (*"a vertical line half a space thick (the same as a beam)"*) |
| thickness, **as drawn** | Gould **0.50** ✅ · Ross **0.52–0.62** 🚨 | measured |
| ⭐ **vertical projection past each outer staff line** | **≈ 1.0 sp** | measured: Gould Table 2 woodwind **0.99 / 1.05**; Ross p. 155 **0.90 / 1.04** (up to 1.35 in Ross's larger schematics) |
| serif / hook | up-**right** at the top, down-**right** at the bottom; tip reaches **1.75 sp** (Gould) to **2.3–2.7 sp** (Ross) right of the stroke's left edge, **overhanging the barline** | measured |
| clearance to the systemic barline | **0.35–0.45 sp** | measured |
| **sub-bracket** | a **hairline OUTLINE**: 0.10 sp stroke, **0.60 sp wide**, ⛔ no serifs | Gould, measured |

⭐⭐ **0.50 sp is Bravura's `bracketThickness` exactly** (§4.3) — the one number where the font, both
treatises and (nearly) every engine agree. ⛔ VexFlow's 0.30 is the outlier.

⭐ **And ≈1.0 sp settles the projection**, which no font specifies and no two engines agree on:
LilyPond ≈1.593 · Verovio ≈1.47 · MuseScore 0.25 + tips. **The books say ≈1.0.**

## 3.4 ⭐⭐ BRACE geometry — THE FINDING THAT OVERTURNS §4.4

- **Flush**: it runs **from the top staff-line to the bottom staff-line, with NO overshoot** —
  *stated* (Ross **p. 155**: *"from the top line of one staff to the bottom line of the staff
  below"*) and measured in **all six examples to within 0.15 sp**. ✅ Agrees with MuseScore and
  LilyPond, both of which give the brace **zero** overshoot (§2.1, §2.2).
- 🚨🚨 **HORIZONTAL DEPTH IS CONSTANT — ≈0.85–1.15 sp REGARDLESS OF 2, 3 OR 4 STAVES.** Gould
  **p. 331 Table 1**, measured: **0.89 / 0.89 / 0.84 sp**. ⭐ **It stretches ONLY vertically.**
- Cusp at the **exact vertical midpoint**.
- Clearance to the barline **0.24–0.49 sp**.

### ⛔ What this overturns

**SMuFL says *"should be scaled proportionally (i.e. in both dimensions, not only in the vertical
dimension)"* (§4.2) — and Gould's engraved braces do NOT.** Her depth is flat across 2, 3 and 4
staves; a proportional scale would have widened it by half again from two staves to four.

⇒ ⭐⭐ **VEROVIO IS THE ENGINE THAT MATCHES THE BOOK.** Its *"we want the brace width always to be
2 units"* — a flat **1.0 staff space at every height** (§2.3) — lands just above Gould's measured
0.84–0.89 sp band, while MuseScore's `magx` and LilyPond's 576-glyph ladder both widen with height.

⇒ ⭐⭐ **AND FINALE IS THE FOURTH CONFIRMATION** (§2.4), from 99 real files: **width 24 EVPU =
exactly 1.00 sp**, with **no per-group width field to vary it**. Two books and two programs, by four
unrelated routes, all say the depth does not change with the height.

⇒ 🚨 **And it retires the arithmetic in §4.4 as a RECOMMENDATION.** That `magx = v + 1.625(v−1)`
equals the y-scale exactly at our 6.5 sp gap remains **true and worth knowing** — it means MuseScore
scales *proportionally* for a nominal group — but proportional is **the thing Gould does not do**.
⭐ The scan beats the sentence, for the fourth time in this repo (`reference/README.md`).

## 3.5 The SYSTEMIC barline

> *"A barline connects all staves at the beginning of a system… **A single-stave part does not have
> this barline. (A single stave in a full score does, however)**"* — **Gould p. 38**, verbatim.

⭐ It **ACCOMPANIES** the bracket and is ⛔ **never replaced by it**: *"A score system of only one
stave takes a square bracket **as well as** a systemic barline"* (p. 516); *"the only barline joining
the whole system"* (p. 521). **Ross pp. 151–2** gives the fullest seven-case list.

⚠️ **One exception, drawn**: *"In most modern typographically printed hymnals, the bracket replaces
the systemic barline"* (**Ross p. 157**).

## 3.6 On WHICH systems — every one

⭐ **Gould's Table 2 column (c) is headed *"Subsequent page"* and carries identical brackets,
sub-brackets and braces** (measured). **Stone p. 6**: *"the brace at the beginning of each line"*.
**Gould p. 239**: *"restate margin brackets… restate the curly brace"*. ✅ All four engines agree.

## 3.7 The DISAGREEMENTS

1. **A brace for Vln I + II**: Ross **p. 155** lists it as a *main use*; Gould **p. 516** calls it
   *"now rarely used"* and **p. 518**: *"1st and 2nd violins… are not joined by a secondary
   bracket"*. **Gerou & Lusk p. 120** sides with Gould: *"In all cases a bracket should be used, not
   a brace."*
2. **Sub-bracket weight**: Gould *"thin"* — a **0.10 sp** hairline — versus Ross's *"second bracket"*
   at **0.63 sp, identical to his main bracket**. ⭐⭐ **All three engines draw ~0.10–0.11 sp**
   (§4.4) ⇒ **Gould + 3 engines vs Ross**, and all four **against Bravura's `subBracketThickness`
   0.16**.
3. **The stated ½ sp vs Ross's own engraving at ~0.6 sp** — the drawing-beats-the-sentence pattern
   already in the README.
4. **"Curved ends"**: unconditional in Gould **p. 516**; *"sometimes omitted entirely"* in Ross
   **p. 156** (two square-armed examples) — and ⚠️ **Gould's own p. 518 figures draw a TOP SERIF
   ONLY**.

## 3.8 ⛔ UNKNOWN — checked, and genuinely absent

**No book states in WORDS**: the bracket's projection past the staves · the serif's size or shape ·
the bracket-to-barline distance · the brace's depth · whether a brace widens for 3–4 staves · the
sub-bracket's thickness as a number. ⭐ **Every figure in §3.3 and §3.4 is a measurement.**

- ⛔ **Nothing anywhere on how an INDENTED FIRST SYSTEM affects bracket geometry** (checked Gould
  pp. 486–7, 507; Gerou p. 117). ⚠️ The standards agent found the same silence (§5.6) — **two
  independent searches, no source.**
- ⛔ Nothing on a secondary bracket whose group drops to one stave.
- ❌ **Stone has essentially nothing**: **no index entry for brace or bracket**; only pp. 6–7
  (barlines), pp. 257–8 and 274 (figures, no geometry), and **p. 217 refusing outright**: *"The
  lengths of vertical brackets at the beginning of the lines… must be decided from case to case."*
- ❌ **Gerou & Lusk: definitions only, no geometry.**
- ❌ The term **"sub-brace" appears in no source.**

---

# PART 4 — THE FONT: SMuFL, Bravura, and what VexFlow already gives us

## 4.1 The glyph inventory (U+E000–E00F)

`brace` **E000** · `reversedBrace` E001 · `bracket` E002 · `bracketTop` **E003** ·
`bracketBottom` **E004** · `reversedBracketTop` E005 · `reversedBracketBottom` E006, plus the
system/staff dividers E007–E00D. Stylistic alternates `braceSmall` / `braceLarge` / `braceLarger` /
`braceFlat` = `uniE000.salt01–04`.

⛔⛔ **THERE IS NO SUB-BRACKET GLYPH ANYWHERE IN SMuFL.** A sub-bracket is the same two terminals with
a **thinner rod** — the *only* thing that distinguishes it is `subBracketThickness`.

## 4.2 How each is ASSEMBLED — the spec, verbatim

- ⭐⭐ **Brace = ONE glyph, scaled UNIFORMLY** — *"should be scaled proportionally (i.e. in both
  dimensions, not only in the vertical dimension)"*. The alternates exist *"to avoid the standard
  brace glyph becoming too wide and bold at larger sizes."*
- ⭐⭐ **Bracket = `bracketTop` + a DRAWN ROD + `bracketBottom`.** The single `bracket` E002 is
  explicitly for **text**, not for scoring.

🚨 **Note what that means against §2.1 and §2.3**: the spec says *scale the brace proportionally*, and
**MuseScore scales it anisotropically while Verovio pins its width flat**. Neither shipping engine
does what the spec says.

## 4.3 Bravura's numbers

`engravingDefaults` (identical across all three copies on disk): **`bracketThickness` 0.5 sp**,
**`subBracketThickness` 0.16**, `staffLineThickness` 0.13, `thinBarlineThickness` 0.16,
`thickBarlineThickness` 0.5. ⛔ **There is no `braceThickness` key** — the brace is a scaled glyph, so
its weight is not a parameter at all.

⭐ **Measured from the OTF we actually ship** (`public/fonts/Bravura.otf`, rev 1.392, via the repo's
own opentype.js): every brace variant is **exactly 4 sp tall** (1 em = one five-line staff) and they
differ only in **width** —

| variant | width (sp) |
|---|---|
| `braceSmall` | 0.412 |
| `brace` | 0.320 |
| `braceLarge` | 0.268 |
| `braceLarger` | 0.240 |
| `braceFlat` | 0.224 |

`bracketTop` / `bracketBottom` are **1.876 × 1.180 sp**. All four alternates are reachable by plain
codepoint **U+F400–F403** — ⭐ no OpenType `salt` feature needed.

### 🚨🚨 A VERSION SKEW THAT HITS EXACTLY THIS GLYPH

`brace` is **0.320 sp** wide in the OTF we engrave with (**1.392**) but **0.277 sp** in the metadata we
vendor (**1.481**) — it got **~13% thinner** between versions. ⚠️ `bravuraMetrics.ts:20-33` claims the
two Bravuras agree *"to 0.001 spaces"*, but that check covers only the **65 glyphs in the table**, and
`brace` is **not one of them**. ⛔ So that reassurance does not cover the glyph this feature needs.

## 4.4 What the four engines actually draw

**Bracket — four implementations, one shape, and the shape is the spec's.** Rod thickness:

| | rod (sp) |
|---|---|
| Verovio | 0.5 ✅ |
| MuseScore | 0.45 (overridden to 0.5 from the font) |
| LilyPond | 0.45 |
| **VexFlow** | **0.30** ❌ |

⭐ **Overshoot is the one number nobody agrees on and no font specifies.**

**Brace — no two engines alike.**

- **LilyPond**: **576 pre-drawn glyphs**, binary-searched, rounding **down**, with **no scaling at
  all**.
- **MuseScore**: picks a Bravura variant by **staff count** (1→`braceSmall`, 2→`brace`,
  3→`braceLarge`, 4+→`braceLarger`) and scales **anisotropically**.
- **Verovio**: glyph path **off by default**; pins width to a flat 1.0 sp.

⭐⭐ **The one insight worth carrying**: MuseScore's x-scale `magx = v + 1.625(v−1)` **is exactly the
uniform scale a nominally-spaced group would need** — `(4v + 6.5(v−1))/4`, since `akkoladeDistance`
is 6.5. So **x follows the spec against the NOMINAL layout while y follows the MEASURED one**, and
widening a gap therefore does not fatten the brace. That reconciles §2.1's "anisotropic" with §4.2's
"scale proportionally": it is proportional to the layout it was designed for.

⚠️ **A flagged disagreement**: all three engines draw a sub-bracket at **~0.10–0.11 sp — a third
thinner than Bravura's `subBracketThickness` 0.16**. They agree with each other and disagree with the
font.

## 4.5 ⭐⭐ VexFlow: what we get free, and what we do not

> ⚠️ **2026-09-19: VexFlow is removed** (`docs/vexflow-removal-map.md`) — nothing below comes free any
> more; it stands as what the library offered, read at source.

- **Nothing usable for the brace.** `StaveConnector` type `BRACE` is a hand-rolled **4-bezier path**
  (`staveconnector.js:81-114`) — it **never touches U+E000**, is **12 px wide at every height and
  every staff size**, and does not thin as it grows.
- **For the bracket it gets the SHAPE right** (terminals + rod) **and every number wrong**: 3 px rod
  (0.30 sp vs 0.5), 6 px overshoot, 5 px offset, terminals at a hard-coded `fontSize 30` that is
  correct only at the default 10 px staff space. **No setter exists for any of them.**

⭐ Same finding, same shape, as the barline work already recorded — see
[[project_vexflow_boundary]]: *decide only when a RULE is unsayable*.

## 4.6 What the repo ALREADY commits to

- `StaffGroup { id, staffIds, symbol?: 'brace' | 'bracket' }` — grouping is **content**, brace pixels
  are **presentation**, rendering deferred.
- ⛔ **"The bracket does not own the join" is settled AND BUILT**: `barlineJoinBelow` is per-gap on
  `StaffInfo`, explicitly *not* a flag on `StaffGroup`. **A brace/bracket feature must not acquire
  one.**
- ⭐⭐ **We already stamp `bracketTop` / `bracketBottom` in production** — they are the **winged-repeat
  tips**. Measured boxes sit in `bravuraMetrics.ts:137-140`, and `BarlineRenderer.drawWing` already
  stamps them at the correct staff-relative size (`3 × space`, with the pt→px reasoning documented in
  `drawnFontSize.ts`). **Both thickness constants are already in `ENGRAVING_DEFAULTS`.**

**Two gaps found:**
1. `brace` U+E000 is **not** in the metrics table (and see §4.3's version skew).
2. `symbol` has no sub-bracket member, and `staffGroups` has **no nesting**.
   ⚠️ **A live contradiction in our own comments**: `instruments-plan.md:350-362` calls the group
   *"nestable"* and *"presentational"*, while `types/music.ts:2303` calls it **"genuine content"**.
   ⛔ Those two disagree and one of them will have to give.

## 4.7 Font UNKNOWNs

- ⭐ **A brace width for a given height AS A RULE** — the three ladders disagree by up to **36%**
  (LilyPond's 1-staff brace is 27% fatter than MuseScore's; its 6-staff one 36% thinner).
- **Bracket overshoot** — no font specifies it, no two engines agree.
- **The sign-to-staff gap.**
- **Any nesting-indent constant** — ⛔ *neither engine has one* (each advance is per-symbol, §2.3).
- What **`braceFlat`** is for — no engine on disk uses it.

---

# PART 5 — THE STANDARDS: MusicXML, MEI, and the shipping programs

> ⚠️ Every MusicXML quotation here comes from the **normative XSD**, curl'd — ⛔ not from the
> generated doc pages, which caused a summarizer to invent per-value glosses.

## 5.1 MusicXML 4.0 — a SPAN over PARTS, and HEADER-ONLY

`<part-group type="start|stop" number>` inside `<part-list>`. The spec's own wording (XSD
`complexType part-group`, line 10035):

> *"The number attribute is used to distinguish **overlapping and nested** part-groups, **not the
> sequence** of groups."*

- ⭐⭐ **`number` is a MATCHING CHANNEL, not a depth.** The spec explicitly denies it is a sequence.
  Default `1`. Nesting is expressed by a start/stop **pair** matched on it.
- ⭐⭐ **OVERLAP IS LEGAL.** *"overlapping"* and *"nested"* are named as **distinct cases**, and
  `part-list`'s content model permits any interleaving — `start#1 … start#2 … stop#1 … stop#2`
  validates. ⛔ **No sentence forbidding overlap was found.**
- A group over a **single part** is legal. What the spec says is that one is *"not needed for a
  single multi-staff part. By default, multi-staff parts include a brace symbol and (if appropriate
  given the bar-style) common barlines."*
- Children: `<group-symbol>` (`brace|line|bracket|square|none`; ⚠️ **only `none` is documented in the
  XSD** — what `square` means vs `bracket` is **UNKNOWN**), `<group-barline>`
  (`yes|no|Mensurstrich`), `<group-name>` / `<group-abbreviation>` (+ `-display` with
  `print-object`), `<group-time>` (stretched time signatures). `group-symbol` takes
  `default-x/y`, `relative-x/y`, `color`, with a special origin: *"the same change of origin [start
  of the first measure on the system] is used for the `<group-symbol>` element."*
- ⛔⛔ **NOT POSITIONAL.** `<part-list>` is the score **header**, declared once. The only positional
  relative is `<part-symbol>` — verified inside `<attributes>` (XSD line 5089 within
  `complexType attributes` at 5054), i.e. per-measure — but it applies only **within one multi-staff
  part**, and its `top-staff`/`bottom-staff` shortening *"also indicates a corresponding change in
  the common barlines within a part"* ⇒ **symbol and join coupled, with no way to separate them.**

## 5.2 MEI v5 — CONTAINER, POSITIONAL, with a span escape hatch

- `<staffGrp @symbol>` (`brace|bracket|bracketsq|line|none`) nests **literally**: *"Bracketed staff
  groups may contain other bracketed or braced staff groups or single staves."*
  ⭐ **MEI is the one standard that DEFINES the shapes** — `bracketsq` is a named value.
- `@bar.thru` = *"whether bar lines go across the space between staves (true) or are only drawn
  across the lines of each staff (false)"* — ⭐ **on `staffGrp` ONLY**; `staffDef`'s attribute list
  has `bar.len` / `bar.method` / `bar.place` but **no `bar.thru`**.
- ⭐ **`<grpSym>` is MEI's SPAN overlay**: inside `scoreDef` it *must* carry `startid`, `endid` **and
  `level`** (an explicit nesting **depth**); inside `staffGrp` it must carry none of them.
  *"provides an alternative to the staffGrp element's symbol attribute … when exact placement or
  editorial details … must be recorded."*
- ⭐⭐ **POSITIONAL.** `<scoreDef>` is a **milestone** — *"they affect all subsequent material until a
  following redefinition"* — and §4.2.4 allows a `scoreDef` inside/between sections. Since a
  content-bearing `scoreDef` must contain a `staffGrp`, **a mid-score `scoreDef` re-declares the
  whole group tree.**

## 5.3 The programs

### ⭐⭐ Dorico — the closest to us, and it SPLITS the two commands

Bracket groups and barline joins are **two separate commands on one change timeline**: *Insert
bracket / sub-bracket / sub-sub-bracket / brace* versus ***Change barline joins***, each applying
*"until the next existing bracket and barline change or the end of the flow"*, per **layout**, and
**signposted at the start of a system**.

🚨 **That is our decision, shipping in a major program**: the symbol and the join are independent
positional facts. ⭐ And it is the direct precedent for the **signpost** idea already noted as the
successor to the dev shell's inkless-key `✕` button.

Constraints it states: *"brackets/braces cannot overlap"* (existing groups are **adjusted**), and
*"staves cannot be bracketed and braced simultaneously"*. Defaults by **ensemble type**; *"there must
be at least two adjacent instruments to show a bracket"*; ⭐ *"**Vocal staves are never joined by
barlines, even when bracketed together.**"* (a fourth independent source for
`docs/barline-join-research.md` §5.5).

### Sibelius — grouping by INSTRUMENT, and *"normally"* is the operative word

Reference 2024.3 §4.19, pp. 402–403. Grouping is declared by instrument (*"Bracket with"*) and edited
by **dragging bracket ends**. ⭐ *"Instruments bracketed, sub-bracketed or braced together
**normally** also have their staves joined by barlines"* — **a convention word, ⛔ not a coupling**.
Divisi → sub-bracket; keyboard → brace, but the **organ pedal is not braced to the manuals**;
solo/percussion/small groups not bracketed. Hidden staff: brackets/braces **auto-hide** when no
barline opens the system. ⭐ A per-**bar** *Brackets* switch lives in the Inspector's Bars panel —
**a draw flag, not a re-grouping.**

### Finale — a measure RANGE, and staves in MORE THAN ONE group

A group is **(Top staff, Bottom staff) × (All Measures | Measures _ Through _)** ⇒ **positional**.
Barlines are **on the group**: *Only on Staves* / *Through Staves* / *Only Between Staves
(Mensurstriche)*. ⭐⭐ *"Staves can belong to more than one group"* ⇒ **arbitrary overlap**.

## 5.4 ⭐⭐ THE CONCRETE IMPORT/EXPORT RISK

**MusicXML, MEI and Finale all put the join ON THE GROUP; Dorico and we do not.**

| the case | round-trips? |
|---|---|
| bracketed but **not** joined | ✅ fine everywhere (`group-symbol=none` / `bar.thru=false`) |
| joined but **no** bracket | ✅ fine everywhere |
| **joined ACROSS two bracketed groups** | ⚠️ only by **manufacturing an extra enclosing group** — `<part-group>` with symbol `none`, barline `yes`; MEI `<staffGrp symbol="none" bar.thru="true">`. **An exporter must invent groups our model does not hold.** |
| a join pattern that is **not a contiguous run of a group** | ⛔ **inexpressible in all three** — one boolean per group |

⭐⭐ **Our per-gap `StaffInfo.barlineJoinBelow` is strictly MORE expressive than any file format
here, and equal to Dorico.** That is the strongest vindication yet of *the bracket does not own the
join* — ⛔ and it means the lossiness is on **export**, which `docs/json-io-plan.md`'s
**report-never-repair** rule already knows how to handle.

## 5.5 Other seams with our model

- **Members**: MusicXML groups **PARTS** (a part owns staves); ours are **staff ids**. Brace
  information can therefore arrive from **two unrelated places** — `part-group` in the header, and
  `part-symbol` inside `attributes`.
- **Depth**: we have **no `level` / parent** on `StaffGroup`, so nested or sub-bracket input
  **flattens to overlapping sets** — re-derivable when properly nested, ⛔ **ambiguous when genuinely
  overlapping**, which MusicXML and Finale both allow.
- ⭐ **Vocabulary**: **`none` is load-bearing in both formats** (*a group for barline/naming purposes
  that draws nothing*) and **we cannot represent it** — `symbol?: 'brace' | 'bracket'` has no such
  member, and *absent* already means something else.
- **Nowhere to land**: `group-name` / `group-abbreviation` / `group-time`, and MEI's
  `label` / `labelAbbr`.
- **Positionality**: our `staffGroups` is header-level **like MusicXML's**. ⇒ the formats that would
  force more are **MEI, Dorico and Finale**.

## 5.6 Standards UNKNOWNs and DEAD ROUTES

- ⛔ **No normative number exists in MusicXML or MEI** for thickness/width/projection — only authored
  offsets. The one example value is `default-x="-5"` tenths on `group-symbol` = **half a staff
  space**.
- ⛔ **Sibelius's Reference explicitly declines** to list its Brackets engraving-rule numbers
  (*"These options are self-explanatory"*).
- Dorico's and Finale's numeric defaults: **not retrieved**.
- ⛔ **Behaviour on an INDENTED FIRST SYSTEM: no statement found anywhere**, in any source.
- What any of the three programs **persists internally**: proprietary, **UNKNOWN** — the model claims
  in §5.3 are inferred from documented behaviour.

**Dead routes** (⛔ do not repeat):
- `music-encoding.org/guidelines/v5/elements/staffgrp.html` and `grpsym.html` → **404**. The URLs are
  **case-sensitive camelCase**: `staffGrp.html`, `grpSym.html`.
- `steinberg.help/r/dorico-se/6.1/…` deep links → **301 to a bare 6.2 landing page**. Use
  `archive.steinberg.help/dorico/v3/…` instead.
- notat.io / scoringnotes house-style numbers: **nothing quotable surfaced**, so the browser-UA
  workaround was never needed.
- `archive.org`: **not touched**, as instructed.

**Sources**: [MusicXML part-group](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/part-group/) ·
[MusicXML XSD](https://raw.githubusercontent.com/w3c/musicxml/gh-pages/schema/musicxml.xsd) ·
[MEI staffGrp](https://music-encoding.org/guidelines/v5/elements/staffGrp.html) ·
[MEI grpSym](https://music-encoding.org/guidelines/v5/elements/grpSym.html) ·
[MEI CMN §4.2](https://music-encoding.org/guidelines/v5/content/cmn.html) ·
[Dorico custom bracket groups](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_brackets_braces/notation_reference_brackets_braces_custom_grouping_inputting_t.html) ·
[Dorico custom barline joins](https://archive.steinberg.help/dorico_pro/v2/en/dorico/topics/notation_reference/notation_reference_barlines_custom_joins_inputting_t.html) ·
[Dorico ensemble types](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_brackets_braces/notation_reference_brackets_braces_ensemble_type_r.html) ·
[Sibelius Reference 2024.3](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) ·
[Finale Group Attributes](http://usermanuals.finalemusic.com/Finale2014Win/Content/Finale/GROUPDLG.htm) ·
[Finale Brackets: Staves](https://usermanuals.finalemusic.com/FinaleMac/Content/Finale/Brackets_Staves.htm)

---

# PART 7 — ⭐⭐ WHAT IT MEANS FOR US — a codebase reading, 2026-08-28

> His ask: *"check our codebase, taking into account the design principles to see how we can do the
> brace in our system, take into consideration that according to our own engine, we should render
> ourselves and not VexFlow"*. ⛔ **This is a reading, not a plan** — no phases, nothing agreed.
> Read `docs/DESIGN-PRINCIPLES.md` §3 / §4 / §6 and
> `docs/own-engraving-engine.md` beside it.

## 7.1 The DRAWING is the easy half, and precedented TWICE

`ScoreRenderer.drawSystemConnector` (`:4390`) already draws the vertical line joining a system's
staves, and its own comment states the rule this feature needs: *"a system bracket belongs to the
system, not to either staff's ink"*. `engine/rendering/barlineGap.ts` then made that rule a **module**,
with the sharper reason:

> 🚨🚨 **Ink crossing two staves may NOT be drawn inside `inStaffSpace`** — a 0.7 small staff's
> `scale(k)` group breaks it immediately (`docs/small-staff-spacing.md`: a gap inside `scale(k)` must
> be ÷ k). So it draws in **SCORE space**, at the score's staff-space.

⭐ A brace or bracket spanning staves has **exactly** that property, so the answer is already written
down. Both existing left-edge signs are drawn at the **SVG's top level** and torn down every render
(the connector already is, `ScoreRenderer.ts:4046-4062`).

⭐⭐ **And by CLAUDE.md's rule this is a MODULE, not a method on `ScoreRenderer`.** The honest first
act is to **move the existing connector into that module**, so the left-edge family — the systemic
line, the brace, the bracket, the sub-bracket — has **ONE OWNER**, the same rule
`docs/barline-types-plan.md` §4.6 landed for the barlines.

## 7.2 Drawing it OURSELVES is not a deviation here — it is FORCED

`docs/own-engraving-engine.md`'s rule: *"a new drawn element draws through OUR context and OUR
primitives — never by instantiating a VexFlow class"*, and `docs/vexflow-boundary.md`'s test: **decide
only when a RULE is unsayable**. It is unsayable (§4.5):

- `StaveConnector`'s `BRACE` is a hand-rolled 4-bezier that **never touches U+E000** and is
  **12 px wide at every height and every staff size** ⇒ it cannot express *"scale the brace
  proportionally"*, which is what SMuFL actually mandates (§4.2).
- Its bracket has the right SHAPE and **every number wrong** — 3 px rod (0.30 sp) where Bravura says
  **0.5** — **with no setter for any of them**.

⭐⭐ **And we are most of the way there already** (§4.6): **we stamp `bracketTop`/`bracketBottom` in
production today** — they are the **winged repeat tips**. Their boxes are measured
(`bravuraMetrics.ts:137-140`), `BarlineRenderer.drawWing` already sizes them correctly
(`3 × space`, the pt→px reasoning in `drawnFontSize.ts`), and `ENGRAVING_DEFAULTS.bracketThickness =
0.5` is already in the table (`bravuraMetrics.ts:229`). **A bracket is those two glyphs plus a
`fillRect` rod** — which is what the spec says a bracket IS (§4.2), and what `drawSystemConnector`
already does for the rod. ⇒ **the BRACKET is nearly free.**

🚨 **The BRACE is not, and there is a trap** (§4.3): **U+E000 is not in our metrics table**, and it is
**0.320 sp** wide in the Bravura OTF we engrave with versus **0.277 sp** in the metadata we vendor —
~13% thinner. `bravuraMetrics.ts:20-33` says the two Bravuras agree *"to 0.001 spaces"*, but that
check covers only its **65-glyph table** and `brace` is not one of them. ⇒ **the brace's first step is
measuring the glyph we actually ship.**

## 7.3 ⭐⭐ THE HARD PART IS HORIZONTAL ROOM, and it is genuinely new

```
const lineLeftPx = origins.map(at => at.x + surface.marginLeftPx)   // ScoreRenderer.ts:3694
```

**Every system starts at the left margin, and nothing reserves a pixel to the LEFT of a staff.** A
brace must either hang into the margin (⛔ wrong for print — `docs/pdf-export.md`'s audience rule and
`layout/pageBounds`) or **the system INDENTS**, which shrinks the width the spring solve gets per
line.

⭐⭐ **And there is no number to copy: NO ENGINE HAS A NESTING-INDENT CONSTANT.** Three codebases,
three routes to the same answer — LilyPond computes a **skyline** (§2.2), Verovio advances **per
symbol** (§2.3), MuseScore bakes the gap into **each bracket's own width** (§2.1). ⇒ the indent is
**the sum of what the signs actually take**.

⭐ That makes this a **LEFT-EDGE COLUMN** — structurally the same idea as the below-staff LADDER
(`engine/layout/outsideStaffBand.ts`, and [[project_above_staff_ladder]]'s *ORDER = the PASS ORDER*),
turned ninety degrees. **It is the one genuinely new layout concept in the feature**, and it is where
the design work is.

## 7.4 The MODEL questions — and they come FIRST

What we have today (`src/types/music.ts:2305`, `:2354`):

```ts
StaffGroup { id, staffIds: string[], symbol?: 'brace' | 'bracket' }
Score.staffGroups?: StaffGroup[]        // absent = a sketch, no groups
```

1. ⭐⭐ **PRINCIPLE 6 — can grouping change MID-SCORE?** `staffGroups` is a `Score` field with **no
   position**. If a divisi can appear at bar 40, or an instrument change regroup the staves, then
   this is **precisely the `score.clef` shape** the principle exists to prevent: a global that
   silently means *"the grouping at bar 1"*, indistinguishable from correct until the second value
   appears. ⛔ **This is the first question, and it is a MODEL question, not a drawing one.**
2. 🚨 **A LIVE CONTRADICTION IN OUR OWN COMMENTS** (found by the metrics agent, §4.6):
   `docs/instruments-plan.md:350-362` calls the group *"nestable"* and ***"presentational"***, while
   `types/music.ts:2303` calls it ***"genuine content"***. Those decide whether `symbol` lives in
   **content** or in **`score.engravingOverrides`** (principle 3's three compartments), and ⛔ they
   cannot both stand.
3. **SPAN or CONTAINER?** MuseScore: a span + a **column integer** — overlaps representable,
   unenforced (§2.1). MEI/Verovio: **containment** — overlaps *unrepresentable* (§2.3). LilyPond: a
   **tree** (§2.2). ⭐ **Ours is none of the three**: an explicit `staffIds: string[]`, which can
   express overlap **and non-adjacency** — *a group of staves 1 and 3 is not engravable*. **Feature
   or hole?** ⛔ Not yet decided, and the answer changes the type.
4. **NESTING ORDER — the engines DISAGREE.** LilyPond and Verovio both put the **deeper** sign
   further **LEFT** (LilyPond says so outright in a regression, §2.2); MuseScore stacks the **outer**
   one further left (§2.1). The LilyPond agent notes their order is *"the reverse of Gould for
   sub-grouping"*. ⛔ **Do not settle this from code** — PART 3 measures what she draws.
5. **SUB-BRACKET.** ⛔ **There is no SMuFL glyph for one** (§4.1) — it is the same two terminals with
   a thinner rod, and `symbol` has **no member** for it. LilyPond's is a **square**, not a thin
   bracket (§2.2).

## 7.5 What is NOT open, and what we already have

- 🚨 **THE JOIN STAYS WHERE IT IS.** `StaffInfo.barlineJoinBelow`, per-gap, built and confirmed in
  the app. ⛔ **The bracket does not own the join** — `types/music.ts:2287`,
  `docs/barline-join-research.md` §5.1, and LilyPond's `Span_bar_engraver` varying independently of
  the delimiter (§2.2). ⛔ **No join flag on `StaffGroup`**, whatever MusicXML's `<group-barline>`
  and MEI's `@bar.thru` do.
- ⭐ **Staff spacing needs nothing on day one.** `STAFF_GAP_SPACES = 6.5`
  (`engine/layout/staffStride.ts:94`) was already derived from **Gould's braced piano pair** (4.79 sp
  measured, Table 4). Verovio's `spacingBraceGroup` minimum is 6 sp (§2.3) — ⇒ our constant is
  already the braced number, and a group symbol does not force a spacing change.
- ⭐ **Selection, if the sign is grabbable**, is the standard shape and nothing new: a
  `SelectedElement` kind, ONE module in `interactions/elements/`, a row in `ELEMENT_SPECS` and a
  position in `ELEMENT_HIT_ORDER` (CLAUDE.md, [[project_selected_element_union]]).
- ⚠️ **Geometry is the BROWSER suite's**, never jsdom — `e2e/harness.ts` already has `staves()` and
  `barlines()` readers to hang a brace assertion off ([[reference_jsdom_cannot_measure_glyphs]]).

## 7.6 ⛔ The one TASTE CALL that has no answer anywhere

**A brace's WIDTH for a given HEIGHT.** Three engines, three ladders, disagreeing by up to **36%**
(§4.7): LilyPond's 1-staff brace is 27% fatter than MuseScore's, its 6-staff one 36% thinner; Verovio
pins a flat 1.0 sp. SMuFL says *scale proportionally* and **neither shipping engine does**.
⭐ MuseScore's `magx = v + 1.625(v−1)` is the closest thing to a reasoned answer (§4.4) — it is
proportional to the **nominal** layout — but it is a house value with no authority behind it.
⇒ **his eye**, like the six taste calls already owed from [[project_font_metrics_from_smufl]].

---

# PART 6 — UNKNOWNS and DEAD ROUTES

⏳ *collected as the reports land.* ⛔ `archive.org` is dead for Gould and Ross
(`reference/README.md`) — that is already known and was not re-tried.
