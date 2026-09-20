# Braces and brackets — the plan

> **Status: DRAFT, nothing agreed.** Written 2026-08-28. ⭐ **The treatises landed while it was
> being written and CHANGED IT — see §2 P3/P4 and the ⛔ notes**; Finale's report landed after and
> **confirmed** the change (§2.4). All seven reports are in. The evidence is
> `docs/research/braces-brackets-research.md` — ⛔ read PART 7 there before this, it is the codebase reading
> this plan sits on. ⏭️ **Anything the last two reports contradict gets changed here when they land.**
>
> 🔎 **READ AGAINST THE TREE, 2026-08-29 — every claim below was checked and the findings are folded
> in, each marked 🔎.** ⭐ **The research was sound; the PLAN was not yet read against the code it
> lands in.** One finding was fatal to the plan's own safety argument (§1's "conservative landing" —
> **auto-grouping already exists**), three phases were under-scoped (P1's pass, P2's consumers, P3's
> group), and §0.3 mis-cited its own source. ⛔ Nothing in PART 3's engraving numbers moved.
>
> ⭐ The sign at the left edge of a system that joins staves into a group: the piano **brace** `{`,
> the orchestral **bracket** `[`, and later the **sub-bracket**.

---

## 0. The FOUR things already settled — ⛔ do not re-open

> 🔎 **VERIFIED AGAINST THE TREE 2026-08-29 — ⛔ do not re-check these, they hold as written:**
> `drawSystemConnector` at `ScoreRenderer.ts:4390`, called from `:4061`, and it runs on
> `staffList.length > 1` — **staff COUNT, never `staffGroups`**, so §0.0's *"the bracket is added
> beside the systemic barline"* is already how the code is shaped · `StaffInfo.barlineJoinBelow`
> per-gap at `types/music.ts:2295` with the ⛔-no-flag-on-`StaffGroup` reasoning at `:2287` ·
> `bracketTop`/`bracketBottom` boxes and `bracketThickness: 0.5` present in the font table ·
> `BarlineRenderer.drawWing`'s `3 × space` · `staffGroups: true` already in `utils/scoreFile.ts:60`,
> so **serialization needs nothing** · the dev shell's `Group:` row logs and only logs.
> ⭐ **What did NOT hold is folded in below and marked 🔎.**

0. ⭐ **THE SYSTEMIC BARLINE IS A SEPARATE SIGN, AND THE BRACKET NEVER REPLACES IT** — *"A score
   system of only one stave takes a square bracket **as well as** a systemic barline"* (Gould p. 516);
   *"A single-stave part does not have this barline. (A single stave in a full score does, however)"*
   (Gould p. 38). ⚠️ One drawn exception: hymnals, where *"the bracket replaces the systemic
   barline"* (Ross p. 157). ⇒ **P1's connector keeps its own life; the bracket is added beside it.**
1. 🚨 **THE BRACKET DOES NOT OWN THE JOIN.** `StaffInfo.barlineJoinBelow` stays per-gap, per-measure.
   ⛔ **No join flag on `StaffGroup`**, whatever MusicXML's `<group-barline>` and MEI's `@bar.thru`
   do. Confirmed four ways: our own `types/music.ts:2287`; LilyPond's `Span_bar_engraver` varying
   independently of the delimiter; **Dorico shipping the two as separate commands**; and the finding
   that our per-gap boolean is **strictly more expressive than any file format** (research §5.4).
2. ⭐ **We draw it OURSELVES.** Not a preference — VexFlow's `StaveConnector` cannot express the rule
   (a brace 12 px wide at every height, a bracket rod at 0.30 sp where Bravura says 0.5, **no setter
   for any of it**). This is `docs/history/vexflow-boundary.md`'s test met exactly: *the rule is unsayable*.
3. ⭐ **Staff spacing needs nothing. ⛔ This feature does not move a staff.**

   🔎 **The REASON given here was wrong and is replaced.** The draft said *"`STAFF_GAP_SPACES = 6.5`
   already came from Gould's braced piano pair"*. It did not. `layout/staffStride.ts:60-79` says the
   6.5 is a **compromise between Gould's SMALL-ENSEMBLE Table 4** (string quartet 6.01–6.16, brass
   quintet 5.96–6.16) **and his own hand** (he dragged a staff and sent back 6.86), *"the measured
   top, rounded up to the nearest half space"* — and it **explicitly declines** the braced-piano
   number, Gould's *recommended* **13.27 sp**, because that gap is ink-laden. ⚠️ In a plan whose
   culture is *every space needs a quotation* ([[feedback_every_space_needs_a_quotation]]), citing a
   constant to the one source it was written to refuse is the mistake to catch.

   ⭐ **The real reason is stronger:** the brace is a HORIZONTAL sign and the staff gap is a
   VERTICAL distance set by the ink in the gap (`staffStride.ts`'s own ⏭️, `docs/plans/layout-plan.md` §8).
   Nothing the brace does is an input to it. The conclusion stands; only the citation changes.

4. 🔎 ⭐⭐ **THE READER IS GATED ON `symbol`, NOT ON `staffGroups` BEING ABSENT** — and this is the
   whole of the feature's safety. See §1a: an absent overlay is *not* the net the draft believed it
   was, because the model already writes one. `symbol` is.

## 1. ⏳ The decisions this plan is WAITING ON

⛔ **P0 is not code.** Each of these changes the TYPE, so none may be settled by writing a renderer
first.

> 🚨🚨 **HIS PUSHBACK, 2026-08-29 — P0 IS CLOSED, AND ⛔ DO NOT REOPEN IT**: *"why we have to answer
> now… indeed you are asking things that at the moment this project is not touching and there is no
> clear decision yet… **we just need to draw the braces**"*.
>
> ⛔ **He is right, and this plan had already said so** — decision 3 was marked *"⏭️ deferrable: P1–P4
> need no nesting"* and the preamble says *"P1–P4 need none of the table below"*. Asking it anyway
> was asking a question **this document had already answered as non-blocking**.
>
> ⭐ **THE RULE: a decision is only asked when the work in hand is blocked on it.** The table below
> is a record of what is *open*, ⛔ **not a queue to be worked through** — the same trap as
> *"⛔ research is not a WORK LIST"*. Decisions 1–3 are answered; **6 needs his eye on a drawn
> ladder, which means it is answered by BUILDING, not by asking.** ⇒ **go to P1.**

⭐⭐ **HIS CALL, 2026-08-28**: *"brace and bracket will not be automatically — at the moment it is a
decision of the user that will draw it, similar to Sibelius"*, and *"we don't have to define this
now… when the basic machinery for making the brace is done, i will tell you how the user should
apply it"* — which deferred decisions 1 and 2.

⭐⭐ **HE REOPENED P0 ON 2026-08-29 AND ANSWERED DECISION 1: POSITIONAL.** See §1b for what that
settles, including most of decision 2.
⇒ **NO AUTOMATIC GROUPING** (⛔ no ensemble-type defaults — that whole question leaves this feature),
and **P1–P4 need none of the table below**: they read `staffGroups` as it stands today and draw
nothing until a **`symbol`** says to. 🔎 ⛔ **That last clause used to read *"draw nothing when it is
absent"*, meaning the overlay — and it was FALSE. Read §1a before building anything: the model
already writes an overlay, and `symbol` is the only thing that does not lie.**
**The open decisions are all about AUTHORING, which is P5.**

| # | question | where the answer comes from |
|---|---|---|
| ~~1~~ | ~~⭐⭐ **Can grouping change MID-SCORE?**~~ | ✅ **ANSWERED — HIS CALL, 2026-08-29: POSITIONAL** (*"b"*). ⭐⭐ **Grouping can change at a bar**, so it is a notational statement and principle 6 applies to it like tempo, meter and clef. ⇒ a group carries a **measure range** (Finale's shape), and the renderer asks *"which groups are active at bar N?"* — ⛔ never reads a field. See §1b |
| 2 | **Content or presentation?** `instruments-plan.md:350-362` says *"presentational"*; `types/music.ts:2303` says *"genuine content"* — ⛔ they cannot both stand. 🔎 **And it is a THREE-way split, not two**: the *same* `instruments-plan.md` §9 also says a piano's brace is *"derivable from the map, **not authored**"* — which contradicts his 2026-08-28 call **and** the auto-writer in §1a | **HIS CALL**, and it decides whether `symbol` lives in the score or in `engravingOverrides` |
| ~~3~~ | ~~**Nesting: a level, a tree, or nothing?**~~ | ✅ **ANSWERED — HIS CALL, 2026-08-29: NESTING ALLOWED.** ⭐ **No new field**: because *smaller group = further left* (decision 4), a group whose `staffIds` are a **subset** of another's IS the inner one, so depth is derivable and the order is a sort by size. ⛔ MuseScore's column integer exists only because it stacks outer-first. The one rule owed: groups **nest cleanly or do not touch** — a 1–3 overlapping a 2–4 is not engravable |
| ~~4~~ | ~~**The nesting ORDER**~~ | ✅ **ANSWERED — research §3.2.** ⭐⭐ **The SMALLER the group, the FURTHER LEFT its sign** — Gould p. 509 / p. 518, Ross pp. 155–6, Stone p. 6, all measured, unanimous. LilyPond and Verovio already do this; **MuseScore is the odd one out.** |
| ~~5~~ | ~~**How wide is a brace of height H?**~~ | ✅ **ANSWERED FOUR TIMES — research §3.4 / §2.4.** 🚨 **The depth is CONSTANT: 0.89 / 0.89 / 0.84 sp for 2 / 3 / 4 staves** (Gould p. 331, measured), flat 1.0 sp in Verovio, **1.00 sp across 99 real Finale files**. ⛔ It does NOT widen. |
| ~~6~~ | ~~⏳ **GLYPH or CURVE, and which variant?**~~ | ✅ **GLYPH, `braceLarge` — ANSWERED BY MEASUREMENT, ⛔ not by taste.** All five rendered at our span and measured against Gould p. 331's scan; `braceLarge` matches her stroke profile best (mean err 0.026 sp) and fixes the cusp from 35% over to 10%. See P4. ⏳ **His eye is still unsatisfied** — the SHAPE remains open even though every number is now measured |

---

## 1a. 🔎🚨🚨 THE MODEL IS ALREADY WRITING GROUPS NOBODY AUTHORED

⛔ **This falsifies the draft's own safety argument, and it is the most important finding of the
2026-08-29 read.** The paragraph it replaces said:

> ~~⭐ **The conservative landing, and it is available:** keep `staffGroups` exactly as it is and draw
> what it already says. **An absent `staffGroups` is a sketch**, so **P1–P4 move no existing test, no
> spacing and no picture** for every score in the repo today — the same shape that made the barline
> join's P1 safe.~~

`ScoreModel.ts:282-295`, called from `addStaff` (`:231`):

```ts
private ensureSingleGroupSpansAllStaves(): void {
  const staves = this.score.staves ?? []
  if (staves.length < 2) { this.score.staffGroups = undefined; return }
  const existing = this.score.staffGroups?.[0]
  this.score.staffGroups = [{
    id: existing?.id ?? uuidv4(),
    staffIds: staves.map(s => s.id),
    ...(existing?.symbol ? { symbol: existing.symbol } : {}),
  }]
}
```

🚨 **EVERY score with two or more staves ALREADY CARRIES a group spanning all of them.** 40 test
files call `addStaff`. So a reader that draws "what `staffGroups` already says" puts a sign on every
grand staff in the suite — a picture change, and through P2 a **spacing** change. The absence the
draft leaned on is not available: it exists only below N=2, where there is nothing to group anyway.

It collides with two more things:

- ⛔ **HIS CALL — *"brace and bracket will not be automatically"*.** The model is automating it
  already, silently, and on the wrong axis: **staff COUNT**, not the user's intent.
- ⚠️ **P5's authoring.** `ensureSingleGroupSpansAllStaves` **overwrites `staffIds` on every staff
  add** and **clears the whole overlay below N=2**. A group the user authored is destroyed by adding
  a staff. ⇒ P5 cannot just write `staffGroups`; it has to reckon with a writer that owns it.

### ⭐⭐ THE NET THAT IS ACTUALLY THERE: `symbol`

The auto-writer **never invents a `symbol`** — it only carries an existing one forward
(`...(existing?.symbol ? … : {})`). And `StaffGroup.symbol` is optional. So:

> ⭐⭐ **THE READER RULE: draw a sign ⇔ `symbol` is PRESENT. An absent `symbol` draws NOTHING.**

That restores the conservative landing **exactly** — P1–P4 move no existing test, no spacing and no
picture, because no score in the repo has ever set a `symbol` (the dev shell's `Group:` row only
**logs**, `dev/devToolbar.ts:305-319`). It is the same shape that made the barline join's P1 safe,
and it is the honest one: *absent means nobody asked for a sign*, which is precisely what is true.

⚠️ **`types/music.ts:2308` currently says the OPPOSITE and must change in P3's commit:**

```ts
/** Bracket/brace symbol; rendering DEFERRED, default 'brace' when drawn. */
symbol?: 'brace' | 'bracket'
```

⛔ That documented **"default 'brace' when drawn"** is the one line that would fire the sign on every
existing two-staff score. It becomes *"absent = no sign was asked for; ⛔ there is no default"*.

---

## 1b. ✅ DECISION 1 — **POSITIONAL** (his call, 2026-08-29)

⭐⭐ **Grouping can change mid-score.** The case that decided it: sopranos on one staff for bars
1–39, splitting onto two bracketed staves at bar 40. A group with no position cannot say that — the
bracket would have to stand from bar 1 around a staff that is empty for 39 bars.

⇒ **principle 6 now governs `StaffGroup`**, exactly as it governs tempo, meter and clef: *"if a
statement about the music can differ at two points in the score, it is stored **at a position** and
resolved by looking backward from the point that asks — never as a field on `Score`"*
(`docs/DESIGN-PRINCIPLES.md` §6). ⭐ `staffGroups` was the **last** field on `Score` still breaking
that rule, with the comment explaining the rule sitting a few lines above it.

**The shape** — Finale's, and it keeps the overlay on `Score` rather than scattering it into
`Measure`: each group carries the measure range it is live for.

⭐ **Why the drawing does not care** (and this is what made it cheap): the sign is drawn once per
system, **at that system's opening bar** (`ScoreRenderer.ts:4048-4063`), so the renderer already
has a measure number in its hand. `groupsAt(score, measureNumber)` costs the same as reading a field.
⇒ **P1–P4 are unaffected — only the READER changes**, which is what §3's first bullet predicted.

⚠️ ⛔ **The resolution bottoms out in a RULE, not stored state** (§6's third bullet): *no groups at
bar N* is the answer when nothing covers it, and it is answered by the absence of a live range — ⛔
never by a stored "default grouping".

### ⭐⭐ AND IT CARRIES MOST OF DECISION 2 WITH IT

Decision 2 asked whether the group is **content** or **presentation** — `types/music.ts:2303` says
*"genuine content"*, `instruments-plan.md` §9 says *"presentational"*, and ⛔ they cannot both stand.
🔎 **Principle 3 states the discriminator itself, and decision 1 just fed it:**

> *"What keeps that from becoming a licence is the discriminator in the boundary case below — a
> **positional** statement belongs to the score, a document-wide *look* setting does not."*
> — `DESIGN-PRINCIPLES.md` §3

And §6's branch test: *can it vary at a point in the score?* → notation. *Is it true of the whole
document?* → engraving (page size, margins, ragged-last). **He answered the first branch.**

⇒ **the grouping is CONTENT.** ⛔ It does not go in `score.engravingOverrides` — which is
*"authored, anchor-relative, in staff spaces"*, i.e. a compartment of **offsets**, a shape a `symbol`
does not have in the first place. ⇒ `instruments-plan.md` §9's *"presentational"* is the wording that
gives way, along with its *"derivable from the map, not authored"*, which his 2026-08-28 call had
already overruled.

⏳ **The residue still owed to him**: whether the *choice of glyph* (`brace` vs `bracket`) is likewise
content. See the question put on 2026-08-29.

---

## 2. The phases

### P1 — THE OWNER (a refactor; no picture change) — ✅ **BUILT 2026-08-29**

> ✅ `engine/rendering/staff/systemStart.ts` + `systemStart.test.ts` (11 specs, all four mutations caught).
> The **pass** moved, not just the method — `renderSystemStarts(pass, placements, staffCount,
> drawnKeys)`, with `drawnKeys: null` meaning culling is off. `ScoreRenderer` keeps a four-line
> call and lost `drawSystemConnector`, `systemIsDrawn` and its `THIN_BARLINE_PX` import.
> The `barlineGap.ts:101` reuse exemption is now stated in `systemStart.ts`'s header, on both sides.
> **Green: 5627 unit + 265 e2e, `build:check` clean, picture unchanged.**

`ScoreRenderer.drawSystemConnector` (`:4390`) is the **first member of the left-edge family**.
Move it to `engine/rendering/staff/systemStart.ts`.

- ⭐ Why first: CLAUDE.md's rule — the family gets **ONE OWNER**, the way the barlines did
  (`docs/plans/barline-types-plan.md` §4.6). ⛔ Otherwise the brace becomes a second slice in the facade.
- ⭐ **The spec moves with it** — `npm run audit:tests` is the check.
- ⚠️ Keep its two comments verbatim: *"a system bracket belongs to the system, not to either staff's
  ink"*, and why it is drawn inside a `stavebarline` group (`hintBarlines` collects it). 🔎 And see
  P3's 🔎 note — that second comment is about to stop being the whole truth.
- **Done when**: the picture is byte-identical and the e2e suite is unchanged.

#### 🔎 ⚠️ MOVE THE **PASS**, NOT THE METHOD — the draft under-scoped this

The draft called it *"12 lines inline in the facade"*. The **method** is 19 lines (`:4390-4409`);
the **PASS** is the loop above it at `:4048-4063` — the `byKey` map, the
`isFirstInLine && staffIndex === 0` filter, and the cull-window `systemIsDrawn` guard:

```ts
if (staffList.length > 1) {                       // ⚠️ staff COUNT, not staffGroups
  const byKey = new Map(placements.map(p => [measureGroupKey(p.measureNumber, p.staffIndex), p]))
  for (const p of placements) {
    if (!p.isFirstInLine || p.staffIndex !== 0) continue
    …
    if (this.cullWindow && !this.systemIsDrawn(…)) continue
    this.drawSystemConnector(p, bottom)
  }
}
```

⭐ **That loop IS the family's selection rule** — *which* system edges get a sign, and *when* under
culling — and it is exactly what `BarlineRenderer` (the precedent P1 cites) owns for its own family.
Move the method alone and the selection rule stays in the facade, which is the slice CLAUDE.md
forbids: the brace would then need its own copy of the same four lines.

#### 🔎 🚨🚨 THE LOAD-BEARING COMMENT IS IN ANOTHER FILE — `barlineGap.ts:101`

⛔ **It is not one of the two the draft says to keep**, and it is the one that matters:

> *"⚠️ **`drawSystemConnector` reads the stave directly and is still correct — ⛔ do not conclude that
> this may.** Its exemption is a guard in the reuse decision: `if (multiStaff && plan.isFirstInLine)
> return` sends a system's OPENING bar down the rebuild path, so a connector's two staves are always
> freshly built."*

This is [[reference_a_reused_bars_stave_reports_where_it_WAS]] — a reused bar keeps its old `Stave`
and is moved by transform, so `stave.getYForLine(…)` reports where it **was** last painted.

⭐ **It is GOOD NEWS: the brace and the bracket are drawn at the same site** (a system's opening bar,
staff 0), **so they inherit the same exemption** and may read the stave directly exactly as the
connector does. ⚠️ But the invariant is held together by a guard in a **third** file, and P1 is the
commit that gives it a home. ⇒ **the exemption's reasoning moves into `systemStart.ts`'s header**,
and `barlineGap.ts:101` gets a `{@link}` to it — otherwise the next reader of `systemStart.ts` has a
landmine that says nothing about itself.

### P2 — THE ROOM (the one genuinely new idea) — ✅ **BUILT 2026-08-29**

> ✅ `engine/layout/systemStartColumn.ts` (+ 14 specs) and the wiring, with a **feature test** at
> `engine/rendering/__tests__/systemStartIndent.test.ts` (5 specs) — because the whole 5657-test
> suite passing proves **nothing** about a wire nobody's score crosses. All three wires
> break-tested: unwire the widths → 2 fail; unwire `lineLeftPx` → 2 fail; break the `symbol` gate →
> 3 fail. **Green: 5657 unit + 265 e2e, `build:check` clean.**
>
> **⭐⭐ THE SHAPE THAT SETTLED IT: the PAGE's surface vs the MUSIC's surface.** The paper does not
> shrink when a brace is added; what shrinks is the room the *music* is cast off into. So
> `musicSurface(surface, score)` is the page minus the indent — margin gaining exactly what the
> content width loses, so the right edge never moves and nothing reaches the margin — and the table
> of who reads which lives in its doc comment. `ScoreRenderer.surfaceMetrics()` stays the PAGE's,
> which is what keeps `ScoreHeaderPass` centring the title on the sheet.
>
> **🚨🚨 AND THE INDENT IS A MAXIMUM OVER BARS, because per-system is CIRCULAR** — this was not in
> the draft and it is the one real discovery of the phase. The indent shrinks the width the
> casting-off gets; the casting-off decides which bars OPEN systems; which bars open systems would
> decide the indent. ⇒ the question is asked of **every bar in the score** (a set that exists before
> any casting-off) and the widest answer wins. ⭐ It is also the right picture: the systems of a score
> share one left edge — a grouping that changes at bar 40 changes the signs, not the margin.
>
> ⭐ **Zero-cost when nothing is authored**: `musicSurface` returns the **same object** at indent 0.

`engine/layout/systemStartColumn.ts` — **what the signs of a system take at its left edge, in staff
spaces**, and the indent that implies.

- ⭐⭐ **There is no constant to copy: NO ENGINE HAS A NESTING-INDENT CONSTANT** (three codebases,
  three routes — research §2.1/§2.2/§2.3). The indent is **the sum of what the signs actually take**.
- Structurally the below-staff LADDER turned ninety degrees (`layout/outsideStaffBand.ts`), so it
  follows that module's shape: **pure, ordered, unit-testable**, and the ORDER is the pass order.
- ⚠️ ⛔ **Never into the margin** — print is the reason (`docs/how-it-works/pdf-export.md`'s audience rule).
- ✅ **Done**: a score with **no `symbol`** indents by **zero** (§1a — ⛔ *not* "no groups", which is
  not a case that exists) and every existing test still passes.

#### 🔎 🚨 THE CONSUMER LIST WAS SHORT, AND IT POINTED AT THE WRONG PLACE

The draft said *"Consumers: `lineLeftPx` (`ScoreRenderer.ts:3694`) and the per-line content
width."* `lineLeftPx` is downstream **cosmetics**. The number that decides the layout is
`MeasureLayout.ts:1023`:

```ts
const availableWidth = surface.contentWidthPx
```

— read **twice**, for two different jobs: the **casting-off** (`fits = currentLineNatural +
naturalWidth <= availableWidth`) and the **justification** (`distributeLineWidths(…,
availableWidth)`). ⚠️ An indent that does not reach here shifts the staves left and leaves the music
justified to the un-indented width: every system overflows its own right margin by the indent.

| site | needs the indent? |
|---|---|
| `MeasureLayout.ts:1023` `availableWidth` | ✅ **YES — and it is the one the draft missed.** Casting-off *and* justification |
| `ScoreRenderer.ts:3694` `lineLeftPx` | ✅ yes — where the staves start |
| `layout/barWidthRoom.ts:155` `lineTotal = surface.contentWidthPx` | ✅ yes — or the DERIVED VIEW disagrees with the layout it describes |
| `GhostRenderer.ts:116` `?? surface.marginLeftPx` fallback | ✅ yes |
| `ScoreHeaderPass.ts:199` centring on `contentWidthPx` | ⛔ **NO** — the title centres on the PAGE, not on the music |

⭐ That last row is why *"the per-line content width"* was too vague to build from: it reads as *all
five*, and one of the five must not move.

#### 🔎 ⚠️ P2 IS THEREFORE A RE-LAYOUT, NOT AN ADD-ON

Because the indent reaches `availableWidth`, it changes **which bars fit on a system** ⇒ **the system
count** ⇒ **the vertical casting-off** (`pageCastOff`) ⇒ which page each system lands on. ⛔ There is
no version of this that only moves x. That is *fine* — it is what indenting means — but it has to be
said, because it is the difference between *"P2 is a pure function nobody sees"* and *"the first
score to carry a `symbol` is re-cast-off, horizontally and vertically"*, and only the second is true.
⭐ **§1a's `symbol` gate is what keeps that off every score in the repo today** — ⛔ it does not make
P2 additive, it makes P2 **dormant until the first sign is authored**, which is a different promise
and the honest one.

⭐ **The cleanest injection is a DERIVED SURFACE** — one `SurfaceMetrics` with `contentWidthPx`
reduced and `marginLeftPx` raised — because it threads to four of the five sites through the value
they already read, and the fifth (`ScoreHeaderPass`) keeps the raw one.

⚠️ **And name the render keys, which the draft never does.** `ScoreRenderer.layoutStateKey`
(`:678`) stamps `this.surface` — the **raw** one. A group's `symbol` is score *content*, so
`MusicEngine.modelDirty` already covers staleness today and nothing is broken; but
`docs/history/render-performance-plan.md` §7a's width-key-vs-shape-key split is exactly the trap here, and
[[reference_render_width_key_vs_shape_key]] says ⚠️ **READ BEFORE ADDING AN ELEMENT**. ⇒ P2 states in
its own header which key owns the indent, so the next element in this family does not have to guess.

### P3 — THE BRACKET — ✅ **BUILT 2026-08-29**, and its geometry took SIX passes

> ✅ `engine/rendering/staff/systemStart.ts` (+ unit specs) with **6 e2e** measuring the ink
> (`e2e/systemStart.e2e.ts`). **Green: 5668 unit + 271 e2e, `build:check` clean.**
>
> #### ✅ The numbers, as drawn, each with its source
>
> | | value | source |
> |---|---|---|
> | rod thickness | **0.50 sp** | Gould p. 516 + p. 21, Ross p. 155, = Bravura `bracketThickness` |
> | **rod exceeds each outer staff line** | **`staffLineThickness + ½ rod` = 0.38 sp** | ⭐ **Verovio's formula, read from its source**, re-derived with OUR font |
> | **wing stamped INSIDE the rod's end** | **`½ staffLineThickness` = 0.065 sp** | Verovio's `offset` — the wing overlaps the corner, ⛔ does not perch on it |
> | wing size | **natural** (1.876 × 1.18) | the glyph Verovio stamps unscaled |
> | total ink past the staff line | **≈1.50 sp** | ⚠️ above the treatises' measured 0.90–1.05 — see below |
> | **gap to the systemic barline** | **0.45 sp** | §3.3 measured **0.35–0.45**, at its top; = MuseScore's `bracketDistance`. ⏳ Verovio uses 0.50 |
> | air before the page margin | **0.40 sp** | ⭐ the module's own separation rule applied to its outer edge |
>
> #### ⭐⭐ VEROVIO'S SOURCE IS THE ANSWER FOR THE VERTICAL, AND THE TREATISES CANNOT BE
>
> 🚨 **The treatises measured only the SUM** (§3.3: Gould **0.99/1.05**, Ross **0.90/1.04**) and ⛔
> never split it into *rod overshoot* + *wing*. §3.8 confirms no book states any of it in words. **It
> is the split that decides what the end looks like**, so the split can only come from an engine —
> and Verovio is the one that builds this sign exactly as we do, *a filled rectangle plus
> `bracketTop`/`bracketBottom`, ⛔ not a path* (`src/view_page.cpp`, `View::DrawBracket`).
>
> ⭐ **`bracketThickness / 2` — half the rod's own thickness, so its CORNER lands on the line.** ⚠️
> This was dismissed once as *"MuseScore's implementation detail, not a measurement"*. **It is not a
> MuseScore quirk: Verovio does the same thing.** It is the shared rule of both engines that draw
> this sign, and discarding it was the error.
>
> #### 🚨 SIX PASSES, AND WHAT EACH ONE GOT WRONG — the record, so it is not repeated
>
> 1. ⛔ **Natural wing, no overshoot** (1.18 sp) — the font's default, chosen by not choosing.
>    His report: *"the bracket height maybe is too short"*.
> 2. ⛔ **Moved the CLEF** to clear the serif. Reverted: **engravers do not move a clef because a
>    bracket is present** — Gould's own tip reaches ≈0.85 sp past the barline and her clefs sit
>    normally. What looked like a collision was a **bounding-box** overlap; the inks are at different
>    heights and interleave (`layout/kerning.ts`'s rule). His: *"i dont think the position of the
>    cleff is correct"*.
> 3. ⛔ **0.25 sp overshoot from MuseScore** — right rule, dismissed for the wrong reason (see above).
>    His: *"you should not make an arbitrary solution… look the research and find the solution there,
>    we don't want to invent things."*
> 4. ⛔ **Gould's 1.75 sp wing, no overshoot** (1.10) — **1.75 is the smallest figure in the whole
>    research**, so reaching for it made the thing he called short shorter still.
> 5. ⛔ **Ross's 2.3 sp wing, no overshoot** (1.45) — the right total by the **wrong construction**:
>    the largest wing in the research and no rod overshoot at all, the reverse of how it is drawn.
> 6. ✅ **Verovio's split, derived from our font.**
>
> ⭐⭐ **THE TWO LESSONS.** *"Are you just measuring the bracket in general? That makes no sense, it
> depends on the distance between the staves — what you have to look is how much the WINGS are from
> the top or bottom of the pentagram"* — ⛔ **the bracket's total height is not a quantity**, it is the
> staff span. And: **a composed measurement must be composed the way it is DRAWN** — matching a total
> while distributing it differently gives the same number and a different picture.
>
> #### ✅ THE GROUP: its own `systemsign`, ⛔ not `stavebarline`
>
> 🚨 `stavebarline` is a **collector** — `hintBarlines` snaps every rect in it onto whole device
> pixels, which would round the sourced **0.50 sp** rod at every zoom. ⭐ Hinting earns its keep on
> **hairlines**, where sub-pixel phase makes 1.6 px lines look different; a 5 px rod has no such
> problem. The connector STAYS in `stavebarline` — it *is* barline-weight and must read continuous
> with the lines it joins.
>
> #### 🚨🚨 AND IT UNCOVERED A PRE-EXISTING DEFECT: THE LEFT EDGE HAD THREE OWNERS
>
> **His report (screenshot): *"what about the thin lines i see sometimes"*.** Measured at a system's
> left edge — **four rects, three of them the same line**:
>
> ```
> x=34 w=2 y=60  h=41   inside a measure group   ← VexFlow's begin barline, staff 0
> x=34 w=2 y=165 h=41   inside a measure group   ← VexFlow's begin barline, staff 1
> x=34 w=2 y=60  h=146  top level                ← the systemic connector, spanning both
> ```
>
> ⇒ **over each staff the ink was laid down TWICE, and in the gap only ONCE** — so the segment
> crossing the gap read thinner and lighter than the same line over the staves. ⭐ **The same defect
> `BarlineRenderer` records for interior boundaries** (*"drawn TWICE… materially darker"*), which it
> fixed with `setEndBarType(NONE)`; **the system's LEFT edge was the one it left out.** ✅ Fixed: a
> multi-staff system's opening bar suppresses VexFlow's begin barline, and `systemStart` is the ONE
> OWNER of that line. ⛔ A single-staff score keeps VexFlow's — it has no connector.
> (⚠️ 2026-09-19: VexFlow is removed — that stave-opening line is ours now,
> `rendering/engraved/EngravedBarline` + `engrave/staff/openingBarline`; the ownership rule is unchanged.)
>
> #### 🔧 A CONSOLE TOOL, because P5 does not exist yet
>
> `src/dev/groupSignConsole.ts` — `__groups.bracket()` / `.brace()` / `.none()` / `.dump()`. ⛔
> Scaffolding: it writes `symbol` **behind the model** (no undo), therefore **re-engraves by hand**,
> and sets **every** group because a selection does not exist.

- ⭐ **We already stamp both terminals in production** — they are the winged repeat tips. Boxes
  measured (`bravuraMetrics.ts:137-140`), sizing solved (`BarlineRenderer.drawWing`, `3 × space`,
  reasoning in `drawnFontSize.ts`), and `ENGRAVING_DEFAULTS.bracketThickness = 0.5` is already there.
  🔎 ⚠️ **`bracketThickness` COLLIDES, and grep will find both**: `ENGRAVING_DEFAULTS.bracketThickness`
  (`fonts/bravuraMetrics.ts:229`) is **0.5 STAFF SPACES**, the system bracket's; `ElementRegistry.ts:322`
  `bracketThickness` is **PIXELS**, and it is the **TUPLET** bracket's (`ScoreRenderer.ts:3166` sets
  it to 1). Different modules, different units, no shared reader — but P3 reads one of them and the
  wrong hit costs a debugging session, so name the unit at the use site.
- ✅ **The numbers are now settled** (research §3.3, measured off Gould and Ross):
  **thickness 0.50 sp** — *stated identically* by Gould p. 516 + p. 21 and Ross p. 155, and it is
  **Bravura's `bracketThickness` exactly**, already in `ENGRAVING_DEFAULTS`;
  **projection ≈1.0 sp past each outer staff line** (Gould 0.99 / 1.05, Ross 0.90 / 1.04) — ⛔ not
  LilyPond's 1.593, not Verovio's 1.47, not MuseScore's 0.25;
  **clearance to the systemic barline 0.35–0.45 sp**.
- ⚠️ **The serif hooks RIGHT, over the barline** (up-right at the top, down-right at the bottom), so
  the bracket's ink crosses the line it stands beside — the room it needs on the LEFT is the rod's,
  not the tip's.
- ⏳ ⚠️ **One open taste call**: Gould draws curved ends unconditionally, Ross says *"sometimes
  omitted entirely"*, and **Gould's own p. 518 figures draw a TOP SERIF ONLY** (§3.7).
- **Done when**: an e2e test measures the drawn rod against the staves it spans.

#### 🔎 🚨 WHICH GROUP THE ROD GOES IN IS A DECISION, AND THE DRAFT DIDN'T MAKE IT

`stavebarline` is not a label, it is a **COLLECTOR**. Put a `fillRect` in it — which is where
`drawSystemConnector` puts the connector, for hinting — and **three** existing readers pick the rod up
(⚠️ a fourth, `barlineInk.inkBarlines`, widened **any** thin rect in the group until P5b deleted it on
2026-09-13):

| reader | what it does to a bracket rod |
|---|---|
| `barlineInk.ts` `hintBarlines` | 🚨 **snaps every rect in the group onto whole DEVICE PIXELS** |
| `e2e/harness.ts:320` `barlines()` | the rod becomes **a barline** to the whole browser suite |
| `e2e/staffSize.e2e.ts:236-241` | finds the connector as `rects.find(r => r.h > 50)` — 🚨 **a bracket rod is also tall**, so this existing test breaks, or worse, silently asserts against the wrong rect |

🚨 **The second row is the engraving one.** P3 spends §3.3 establishing **0.50 sp** from four sources
that state it identically — and `hintBarlines` would then round it to a whole number of device pixels
at every zoom, so the number would not survive to the screen. ⚠️ The tension is real and does not
resolve itself: a crisp vertical rod *wants* hinting ([[project_barline_ink_and_hinting]] is right
about why), and a sourced 0.50 sp thickness *does not want rounding*.

⇒ **P3 states the choice explicitly — its own group, or joining the hinting family — and says which
of the two it is paying for.** ⛔ Do not let it be settled by which group the `fillRect` happens to
be written inside. ⭐ And whichever wins, `e2e/staffSize.e2e.ts:236-241` needs a narrower selector in
the same commit: it identifies the connector by *being tall*, and it is about to have company.

### P4 — THE BRACE — ✅ **BUILT 2026-08-29**, and decision 6 was ANSWERED BY MEASUREMENT

> ✅ Drawn in `engine/rendering/staff/systemStart.ts` (+ unit specs). **Green: 5672 unit + 271 e2e,
> `build:check` clean.** ⏳ **HIS EYE IS NOT SATISFIED YET** — *"i'm still not sure about how the
> brace looks"* (2026-08-29). ⛔ Do not read what follows as closed; the numbers below are each
> measured, and it is the SHAPE he is still weighing.
>
> #### ⭐⭐ GOULD p. 331 TABLE 1, MEASURED OFF THE SCAN — the primary evidence, so nobody re-measures
>
> 450 dpi render, **20.25 px per staff space**, her three-staff brace (span 23.70 sp):
>
> | | measured | ours |
> |---|---|---|
> | **depth** | **0.889 sp** | 0.887 |
> | **above the top staff line** | **+0.000 sp** | flush |
> | **below the bottom staff line** | **+0.099 sp** | flush |
> | **clear gap, brace → systemic barline** | **0.444 sp** | 0.45 |
> | stroke: tip / belly / **cusp** / belly / tip | 0.148 / 0.444 / **0.148** / 0.494 / 0.148 | 0.175 / 0.475 / **0.163** / 0.463 / 0.175 |
>
> ⭐ **Her cusp, 0.148, is exactly Finale's published centre thickness of 0.15** (§2.4) — two
> independent sources on one number. ⭐ And her staff gap works out at **5.85 sp** where ours is 6.5,
> so **our brace is already LONGER than hers** (14.50 sp against her 13.83 for two staves).
>
> #### ⭐⭐ ALL FOUR ENGINES, READ FROM SOURCE — and they are unanimous on the length
>
> | | depth at a grand staff | widens? | overshoot | gap to barline |
> |---|---|---|---|---|
> | LilyPond | ≈0.93 (`mf/feta-braces.mf`: `x = 2pt + 18pt·(y/575)`) | ✅ | **zero** (binary-searches the glyph whose height IS the span; no scaling) | `padding` **0.30** |
> | Verovio | **1.00** (`braceWidth = 2 units`, *"always"*) | ⛔ | **zero** (spans `y1..y2`) | `basicDist` **0.50** |
> | Finale | **1.00** across 99 files | ⛔ | — | — |
> | MuseScore | **1.19** (`symWidth × magx`, `magx = v + 1.625(v−1)`) | ✅ | **zero** (`RectF(0,0,w,h)`) | `akkoladeBarDistance` **0.35** |
>
> 🚨 **Six sources, no dissent, on the vertical: the brace is FLUSH.** Every engine reaches zero
> overshoot by a *different mechanism*, plus Ross's words and Gould's plate. ⛔ **Do not re-open it.**
> ⚠️ MuseScore's `magx` comment names *"akkoladeDistance/4.0 (default 6.5)"* — **the same staff gap we
> use** — so its 1.19 is the one directly comparable figure, and we are the narrowest of everything.
>
> #### ⭐⭐ DECISION 6 — SETTLED BY MEASURING, ⛔ NOT BY HIS EYE ON A LADDER
>
> The plan expected to settle *"which of the five variants"* by taste. **It did not have to be.** All
> five were drawn at our own grand-staff span and their stroke profiles measured against her scan:
>
> | variant | drawn depth | tip | belly 25% | **cusp** | belly 75% | mean err |
> |---|---|---|---|---|---|---|
> | `brace` | 0.850 | 0.175 | 0.487 | **0.200** | 0.475 | 0.0337 |
> | `braceSmall` | 0.887 | 0.163 | 0.537 | 0.312 | 0.537 | 0.0661 |
> | ✅ **`braceLarge`** | **0.887** | 0.175 | 0.475 | **0.163** | 0.463 | **0.0262** |
> | `braceLarger` | 0.875 | 0.188 | 0.388 | 0.125 | 0.375 | 0.0530 |
> | `braceFlat` | 0.875 | 0.138 | 0.175 | 0.087 | 0.175 | 0.1322 |
>
> 🚨 **His question was *"is the thickness of the brace correct?"* and it was NOT** — plain `brace` put
> the **cusp 35% over** her weight and the tips 27% over, while the bellies matched. ⭐ **Exactly the
> distortion this plan predicted before the code existed** (*"the cusp and the tips, where the curve
> runs horizontally, thicken with the stretch"*), and the five variants are what SMuFL provides to
> absorb it.
>
> ⭐ **The choice is SPAN-INDEPENDENT**, which falls out of the constant-depth rule: `sx` is always
> `0.89 ÷ the glyph's ink width`, so the horizontal profile never moves with height. ⛔ Unlike
> MuseScore, which picks by staff count (2 → `brace`, 3 → `braceLarge`) — its mapping is paired with
> its own widening `magx`, a different construction.
>
> #### 🚨🚨 THE DEPTH IS RIGHT BY THIS GLYPH'S PROPERTY, ⛔ NOT BY CONSTRUCTION
>
> `sx = BRACE_DEPTH_SPACES ÷ (box.right − box.left)` assumes the reported ink box is what the font
> renders. **For `brace` it is not**: asking 0.89 drew **0.85**, and that shortfall is **stable across
> ink thresholds <100…<250**, so ⛔ not an artifact. `braceLarge`'s box is honest and lands on 0.887.
> ⇒ **a future variant change silently moves the DEPTH too**, while the constant still reads 0.89.
> **Re-measure the drawn ink after any change here.**
>
> #### ⚠️ THE MECHANISM, and what it costs
>
> A y-only stretch at constant depth is `scale(sx, sy)` with **sx ≠ sy** (≈`scale(3.3, 3.7)`) — the
> only non-uniform transform in this renderer. 🚨 **`ElementRegistry.withScale` takes ONE number**, so
> a hit-box has no representation under it. ⏭️ **P5's "selectable" is NOT the free `ELEMENT_SPECS` row
> the plan assumes** for the brace: its box must be computed in SVG space, outside the transform.
>
> ⛔ **No e2e, and that is measured rather than skipped**: a stretched `<text>` returns Bravura's EM
> BOX × `sy` from `getBoundingClientRect` — a 145 px brace reported 589 px. Two tests written against
> it were deleted rather than tuned. The contract lives on the **transform** in the unit spec.

### P4 — THE BRACE (original notes)

**P4a — measure the glyph we actually ship. ✅ BUILT 2026-08-29.**

> ✅ **All five measured, off `public/fonts/Bravura.otf`** (`groupings` in
> `scripts/generate-font-metrics.mjs`; 70 glyphs now). ⭐ **The naming is counter-intuitive and it
> matters**: `braceSmall` is the **WIDEST** and `braceFlat` the **NARROWEST** — the name says which
> SPAN it is for, not how big the drawing is. ⇒ the ladder P4b wants runs **short span → `braceSmall`,
> tall span → `braceFlat`**, which is exactly *"a taller brace picks a narrower variant"*.
>
> | glyph | width (sp) | height (sp) |
> |---|---|---|
> | `braceSmall` | **0.412** | 3.988 |
> | `brace` | **0.328** | 3.988 |
> | `braceLarge` | **0.268** | 3.992 |
> | `braceLarger` | **0.240** | 3.988 |
> | `braceFlat` | **0.224** | 4.000 |
>
> ⭐ **Research §4.5's "all five are exactly 4 sp tall" is CONFIRMED** — 3.988–4.000 measured.
> 🚨 **And the version skew is `brace` ALONE**: it is the only glyph of the 70 that disagrees with the
> vendored metadata (0.328 vs 0.277, **off by 0.051 spaces**); the four alternates agree exactly. The
> research read the skew as a property of the brace family — it is a property of **one glyph**.
>
> 🔎 ⚠️ **Two generator changes it forced, both worth keeping:** SMuFL's stylistic alternates are
> **not in `glyphnames.json`** (they live in the metadata's `optionalGlyphs`), so name→codepoint now
> reads both maps rather than hardcoding U+F400–F403 back into the script. And the emitted header
> **used to assert *"identical to 0.001 spaces for all N glyphs"* unconditionally** — the first real
> disagreement would have left the file stating the opposite of its own run, so it now prints what the
> check found ([[reference_a_false_warning_teaches_readers_to_skip]]). Both branches break-tested.

⏭️ **The original P4a note, kept for its numbers:** 🚨 U+E000 is **not** in our metrics table, and it is
**0.320 sp** wide in `public/fonts/Bravura.otf` (1.392) versus **0.277 sp** in the metadata we vendor
(1.481) — ~13% apart. `engine/fonts/bravuraMetrics.ts:18-27`'s *"agree to 0.001 spaces"* covers only
its 65-glyph table and ⛔ **not this glyph**. Add `brace` and the four alternates.

> 🔎 ⚠️ **AND IT IS A GENERATOR CHANGE, NOT A HAND-EDIT.** `GlyphName` (`:38`) is a **closed union**
> — *"so a typo is a compile error and `glyphBox` never has to answer for a name that does not
> exist"* — backed by a **stamped** table whose whole contract is *"stamped so a regeneration that
> moves numbers is visible in a diff"*, plus the metadata cross-check that produced the 0.001 claim.
> ⛔ Appending five rows by hand defeats all three. P4a runs the generator and commits the diff.

> 🔎 ⚠️ Path drift in the draft: the file is **`src/engine/fonts/bravuraMetrics.ts`**, not
> `rendering/`, and the wing boxes cited as `:137-140` are at **`:136-139`**. The claims themselves
> all check out — `bracketTop`/`bracketBottom` boxes present, `ENGRAVING_DEFAULTS.bracketThickness =
> 0.5` at `:229`, and 🚨 `subBracketThickness: 0.16` at `:246`, so **P6's disagreement with Gould's
> 0.10 sp hairline is already live in our own table**.

**P4b — stretch VERTICALLY at a CONSTANT DEPTH.**

> ⛔⛔ **THIS REVERSES THE FIRST DRAFT OF THIS PLAN, and the reversal is the treatises' (§3.4).**
> The draft said *pick a variant and scale UNIFORMLY*, on SMuFL's instruction that a brace *"should
> be scaled proportionally (i.e. in both dimensions, not only in the vertical dimension)"*.
> 🚨 **Gould's engraved braces are not scaled proportionally**: measured off p. 331 Table 1, the
> depth is **0.89 / 0.89 / 0.84 sp for 2 / 3 / 4 staves** — **flat**, where a proportional scale
> would have widened it by half again. ⭐ **The scan beats the sentence**, for the fourth time in
> this repo.

⇒ **The rule: a brace stretches only in y, at a depth of ≈0.85–1.00 sp, cusp at the exact vertical
midpoint, running FLUSH from the top staff-line to the bottom staff-line with no overshoot** (stated
by Ross p. 155, measured in all six examples to within 0.15 sp).

⭐⭐ **FOUR independent confirmations** (research §3.4): **Gould** 0.89/0.89/0.84 sp measured for
2/3/4 staves · **Ross** flush, stated · **Verovio** a flat 1.0 sp in code · **Finale** exactly
**1.00 sp** across **99 real files**, with **no per-group width field to vary it**. ⛔ Against: only
MuseScore and LilyPond, the two that widen.

⭐ **Verovio and Finale both already do this.** MuseScore's `magx` and LilyPond's 576-glyph ladder
widen with height and are ⛔ **not** what to copy. (The `magx == y-scale at a 6.5 sp gap` arithmetic
in research §4.4 stays TRUE and stays INTERESTING — it just describes the behaviour we are declining.)

### ⚠️ THE MECHANISM IS STILL OPEN — and Finale is a serious counterexample

⭐ **Finale's brace is GENERATED VECTOR ART, not type**: *"Finale creates a piano brace by drawing
two sets of curves, then filling the space in between with black to produce a smoothly tapered
brace"* (MakeMusic's manual, §2.4). It kept that for the program's whole life, its engravers defend
it against Dorico (*"making the piano brace a glyph was a huge mistake"*), and it publishes the
taper: **centre thickness 0.15 sp, tip thickness 0.30 sp**.

⛔ **This does not overturn the RULE** — Finale's width is constant, which is the rule above. It
overturns the confidence that a **glyph** is the only defensible mechanism. **Rule and mechanism are
separate questions**, and only the mechanism is open.

⚠️ **The specific risk a y-only stretch of a glyph carries**: stroke weight measured *horizontally*
(the arms) survives untouched, which is what we want — but the cusp and the tips, where the curve
runs horizontally, **thicken with the stretch**. That is exactly the distortion the variant ladder
would exist to manage, and exactly what a rendered ladder would show at a glance.

**Mechanically**: all five Bravura variants are **exactly 4 sp tall** and differ **only in width**,
and the four alternates are reachable at plain codepoints **U+F400–F403** — ⛔ no OpenType `salt`
feature needed. So the variant choice is now doing a **different job** from MuseScore's: not "how
wide should it be" but **"which drawing holds its weight when stretched this far"** — i.e. a taller
brace picks a *narrower* variant so that the x-scale back to ~0.89 sp thins the stroke less.
⏳ That mapping is the remaining taste call, and it wants **his eye** on a rendered ladder.

⛔ **Not a computed Bézier.** Verovio's and VexFlow's curve constants are bare literals with no
citation; a glyph is ink a type designer drew.

### 🔎 🚨 THE STRETCH NEEDS A TRANSFORM WE HAVE NEVER DRAWN — and it costs the hit-box

⛔ **P4 has no mechanism step for the one thing P4b requires.** *"Stretches only in y, at a depth of
≈0.85–1.00 sp"* off a glyph that is **4 sp tall and 0.320 sp wide** means a **NON-UNIFORM**
`scale(sx, sy)` — roughly `scale(2.78, 4)` for a two-staff brace. **Nothing in this renderer does
that.** `Element.setFontSize` scales uniformly, and `rendering/staff/staffScaleGroup.ts` — the one module
that transforms a group at all — is deliberately uniform-only.

🚨 **And its second line is the problem:**

```ts
if (k !== 1 && group) group.setAttribute('transform', `scale(${k})`)
return pass.elementRegistry.withScale(k, draw)          // ← ONE scale
```

`ElementRegistry.withScale` takes a **single number**. Under a `scale(sx, sy)` group **a hit-box has
no representation** — the registry cannot say what the ink's box is, because it has one factor and
the drawing has two.

⇒ ⛔ **P5's *"if the sign is selectable"* is NOT the standard `ELEMENT_SPECS` row the draft says it
is** — not for free. The brace's box has to be computed in **SVG space** and registered **outside**
the transform, the way `barlineGap` already handles ink that no single scale describes. ⭐ Naming it
here because it **constrains P4's drawing**: a mechanism that cannot be hit-tested is not a
mechanism, and this is the second reason (after the cusp-thickening in the section above) that the
glyph-vs-curve question is genuinely open rather than a formality.

### P5 — AUTHORING — ✅ **BUILT 2026-08-29**

> ✅ **HIS RULE, and it is the APPLIES-else-ARMS bargain this editor already makes** (the Time
> Signature window, the Clef window, the key and barline stamps):
>
> > *"For applying the brace or bracket we check the measure selection: if multiple staves are
> > selected we apply to those staves; if just one staff is selected we apply just to that staff; if
> > no staff is selected we arm a stamp and apply to the staff we click."*
>
> **Green: 5712 unit + 271 e2e, `build:check` clean.**
>
> #### ⭐⭐ HIS FIRST TWO CASES ARE ONE CASE
>
> *"Multiple staves"* and *"just one staff"* need no branch — a `measureRange` carries a staff SPAN
> since the same day's passage work (`interactions/measurePassage`), so a one-staff selection is
> simply `fromStaff === toStaff`. ⛔ Two rules would have been two places to keep in step for one
> sentence of behaviour.
>
> #### 🚨🚨 IT FORCED THE AUTO-WRITER OUT, AND THAT IS THE REAL CHANGE
>
> `ScoreModel.ensureSingleGroupSpansAllStaves` rebuilt `staffGroups` as **one group over every
> staff** on each `addStaff`. Invisible while nothing drew, and ⛔ **incompatible with authoring**: it
> would have overwritten `staffIds` and destroyed an authored group the moment a staff was added, and
> it deleted the whole overlay below two staves.
>
> ⭐ Replaced by `staffGroupOps.pruneStaffGroups` — the honest division: **the user owns MEMBERSHIP,
> the model owns REFERENTIAL INTEGRITY** (no group may name a staff the score does not have).
> ⛔ The model no longer invents a group at all.
>
> #### ⭐ A ONE-STAFF GROUP IS NOW LEGAL, and a source says so
>
> `groupsAt` skipped groups of fewer than two staves — **a guard of mine, not a source's**. His rule
> produces one-staff groups directly, and it is real engraving: *"A score system of only one stave
> takes a square bracket **as well as** a systemic barline"* (Gould p. 516; Ross pp. 151–2).
> ⏭️ A one-staff **BRACE** is not something any source draws; the asymmetry is noted, ⛔ not enforced.
>
> #### 🚨🚨 THE ID TRAP — a group is a LIST OF MEMBERS, not staff-anchored content
>
> The first write used `MusicEngine.staffIdForIndex`, which returns **`undefined` for staff 0 BY
> DESIGN** — the CONTENT convention (absent = staff 0, keeping single-staff JSON byte-identical).
> ⇒ **staff 0 was dropped from every group** and the sign drew over staff 1 alone. ⛔ Nothing in the
> model complained; the **browser suite** caught it as a rod starting 10 staff spaces too low. ⭐ Use
> `staffIdAtIndex`. Two specs pin it.
>
> #### What landed
>
> | | |
> |---|---|
> | `engine/models/staffGroupOps.ts` | the SCORE op — `applyGroupSymbol` (⭐ `undefined` REMOVES) + `pruneStaffGroups`. 17 specs |
> | `MusicEngine.applyGroupSymbol` | the one **undoable** write, indices → ids |
> | `interactions/groupStamp.ts` | `groupTargetFromSelection` (APPLIES-else-ARMS) + `stampGroupAtClick`. 11 specs |
> | `MarkingTool` `{ kind: 'group', symbol }` | + its three tables — `MARKING_TOOL_USES_ARMED_LENGTH`, `promoteStampToNoteEntry`, `toolGhost` |
> | the dev shell's `Group:` row | ⭐ **live** — it logged and drew nothing before |
> | `dev/groupSignConsole` | rewired through the model, so `__groups.*` is undoable too |
>
> ✅ **THE GHOST — BUILT** (`engine/rendering/ghosts/GroupSignGhost.ts`). ⛔ The objection recorded here was
> the BARLINE's objection verbatim and wrong for its reason: *"its preview needs the staff span the
> click will make."* The ARMED click applies to **ONE staff**, so there is no span to know — and the
> cursor says WHAT the click makes, not where the engraver puts it.
> ⭐ **Precomposed glyphs, and here that is REQUIRED, not merely convenient**: `drawSignGhost`
> recolours `text, path`, so a `fillRect` rod would ghost **BLACK** (his 2026-08-26 report of the
> barline: *"why the only thing is blue in the ghost is the dots?"*). Both signs have one — `brace`
> U+E000 and **`bracket` U+E002**, the whole sign in one glyph.
> 🚨 **It smeared on the first build** — his screenshot, blue trails across four systems. The class
> was exported and never added to `GHOST_GROUP_SELECTOR`, so `clearGhosts` never swept it. **The
> SECOND ghost to hit that exact trap**, so `GroupSignGhost.test.ts` now asserts the whole family's
> classes, not just its own. ⏭️ The real fix is for `GHOST_DRAWERS` and the selector to share a table.
> 🚨 **Sizing, both his**: *"make the bracket glyph the same size as the brace"* — the bracket is
> **6.556 sp** tall against the brace's **3.988**, so both are now scaled to **one staff**; and *"the
> brace is not thick enough"* — the ghost stamped it at the glyph's natural **0.268 sp** while we
> ENGRAVE it at **0.89**, so the ghost now takes the same non-uniform scale the drawing does.
>
> ✅ **SELECTABLE — BUILT.** His report: *"i'm not able to select bracket or brace… i should be able to
> click on it and select."* ⭐ The obstacle was real but had a way round: the box is computed **in SVG
> space at the point of drawing** (`systemStart.registerSignBox`), where the corners are already
> known — so it never goes through `ElementRegistry.withScale` and never needs unscaling.
> `staffGroup` joins the union (22 kinds), gets its module, a row in `ELEMENT_SPECS`, a place in
> `ELEMENT_HIT_ORDER` (⭐ **first**, and free: nothing else has ink in the indent), a highlight that
> recolours the sign's own `systemsign` group **on every system**, and **Delete** →
> `MusicEngine.removeStaffGroup`.
> 🚨 *"It's a little difficult to select, i have to click very accurate"* ⇒ **`GROUP_SIGN_PRESS_PAD_PX`
> = 8**, on both axes — the barline's *"six pixels of forgiveness"* scaled to a taller target, and
> affordable because **nothing competes for those pixels**.

### P7 — THE HANDLES: resize a group by dragging its ends — ✅ **BUILT 2026-08-29**

> **His ask**: *"when a brace or bracket is selected we should be able to see the two squares up and
> down so we can enlarge or shrink the groups… the only case we don't show the squares is in a
> single staff system."*
>
> ✅ `interactions/elements/staffGroupHandles.ts` (geometry, 12 specs) + `staffGroupOps.setGroupSpan`
> (6 specs) + the drag in `MouseController`, in the barline join's shape: arm, preview each frame
> without undo, **ONE undo entry on the drop** — and only if the span ended up different from how it
> started, so a wandering gesture files nothing.
>
> ⭐ **The drag resolves to a STAFF, ⛔ never a pixel delta**: a group spans whole staves, so those are
> the only positions reachable. `staffAtPointer` answers by **BAND** — ⛔ not `round(y / stride)`,
> because staves may be drawn at different sizes.
>
> ⭐ **`setGroupSpan` edits the group IN PLACE**, ⛔ not `applyGroupSymbol` with new ids: that keys on
> MEMBERSHIP, so it would make a SECOND group and the selection (which names the ID) would go stale
> mid-drag.
>
> ⭐ **His single-staff rule falls out of the geometry rather than being written as an `if`**: a handle
> offers a staff to move an end TO, and a one-staff score has none, so the loop produces nothing —
> `barlineJoinHandles`' own argument about gaps.
>
> #### 🚨🚨 IT EXPOSED THE HIT-BOX BEING THE *SPAN* AND NOT THE *INK*
>
> **His report**: *"in the brace the squares are good in position but in the brackets the squares
> vertically are too close."* ⭐ The box stopped at the staff lines, so a square hanging off it sat
> **inside** a bracket's serif — which reaches ~1.5 sp further out — while a brace, being FLUSH,
> looked right. ⇒ `signOutwardReachSpaces` (a total over `symbol`) and the box now covers the ink.
> ⭐ **It fixed a second bug wearing the same hat**: a press on a bracket's serif was outside the box
> and selected nothing.
>
> Then: *"the squares in the bracket look better but i think now it can be tiny closer."* ⭐ Both signs
> sat 10 px from their OWN ink, but a bracket's ink already projects — so the projection was doing
> part of the separating. A projecting sign gets **6 px**, a flush one keeps **10**. ⛔ Not a smaller
> shared constant, which would have moved the brace's squares too.

### 🚨🚨 P7a — AND THE ORDER WAS STILL WRONG: **A BRACE IS ALWAYS OUTERMOST**

> **His report**, with a screenshot: *"the problem with the order is not fixed either (brace is still
> inside)"* — a bracket over staves 1–2 and a brace over 2–3.
>
> ⛔ **`smaller-further-left` CANNOT DECIDE EQUAL SPANS**, and both of his groups spanned two staves.
> ⭐ §3.2 carries a **second rule, stated rather than measured**, which I had quoted at him one round
> earlier and not implemented: *"A brace should only ever be used as the **outermost** bracket"*
> (**Gould p. 516**, verified on the scan).
>
> ✅ `groupsAt` now sorts **braces first** (= outermost), then by ascending span, then stably by top
> staff. ⚠️ He had asked *"are you sure the brace must go inside the bracket?"* the round before —
> **the answer was no**, and this is why.

### P6 — LEFTOVERS — ⭐ **TWO OF THE FIVE WERE DISSOLVED BY P5**

> ✅ ~~**Nesting** (decision 3)~~ — he answered it (allowed), and P5 made it **expressible with no new
> field**: groups are arbitrary staff runs, so a group whose staves are a SUBSET of another's simply
> IS the inner one, and `groupsAt` already sorts by span. ⛔ Nothing left to build.
>
> ✅ ~~**`none`**~~ — recorded as *"load-bearing in both file formats, unrepresentable for us"*. It is
> representable now: **a group with `symbol` absent**. That is the same gate that keeps every
> unsigned score unchanged, and it maps MusicXML's `<group-symbol>none</group-symbol>` directly.

**What is genuinely left:**

- ✅ **A ONE-STAFF SCORE CAN CARRY A SIGN** — his report: *"why the bracket and the brace not working
  on single staff score… it should work too."* ⛔ Two guards of mine, both wrong: `groupsAt` returned
  `[]` below two staves, and `renderSystemStarts` returned early. ⭐ Gould p. 516 contradicts both:
  *"A score system of only one stave takes a square bracket **as well as** a systemic barline."*
  ⇒ the CONNECTOR still needs two staves (it joins them); the SIGNS do not.

- 🚨🚨 **THE STACKING IS A SKYLINE, ⛔ NOT FIXED COLUMNS.** His report, with a screenshot: a bracket on
  staff 1 and a brace on staff 2 — *"the brace somehow is displacing the position of the bracket but
  there is no reason for this… both are independent, applied to independent groups."* ⭐ Dead right,
  and **the research had already named the fix** (§2.2, LilyPond): *"Stacking is a SKYLINE, not fixed
  columns (`side-position-interface.cc:263-322`), so **vertically disjoint signs can share an x**."*
  ⇒ a sign now clears only the placed signs whose STAFF SPAN overlaps its own.
  ⚠️ And he asked whether the ORDER was right — it is, and it is §3.2's: **Gould / Ross / Stone all
  measured, LilyPond and Verovio agreeing, MuseScore the odd one out**; plus Gould p. 516 stated,
  *"a brace should only ever be used as the OUTERMOST bracket."*

- ✅ **THE SUB-BRACKET — BUILT 2026-08-29**, and ⭐ **CONSOLE-ONLY BY HIS CALL**: *"i don't need a
  palette with sub-bracket… i will not test sub-bracket either, since we don't need it now but in the
  future — just make the console for it, and when this is needed we will go back to it."*
  ⇒ `__groups.subBracket()`; ⛔ no palette row. The model, the layout and the drawing are done.

  | | value | source |
  |---|---|---|
  | width | **0.60 sp** | Gould, measured (§3.3). ⏳ Verovio uses 0.5 |
  | vertical stroke | **0.10 sp** | Gould measured, **= Verovio's `subBracketThickness` default (0.20 unit)** |
  | arms | a staff line thick, and they ARE the terminals | Verovio's `View::DrawSquareBracket` passes `staffLineWidth` |
  | serifs | ⛔ **none** | measured |

  ⭐ **Three rectangles, ⛔ not a glyph and not a closed outline** — SMuFL has none, and Verovio's
  `DrawSquareBracket` is a vertical plus two arms. ⚠️ It reads as a closed rectangle on Gould's plate
  because **its open side abuts the main bracket**.
  🚨 **A four-way disagreement, and the font loses**: Gould + all three engines (~0.10–0.11 sp)
  against **Ross 0.63** (full thickness) and against **Bravura's own `subBracketThickness` 0.16**.
  ⚠️ **Gould p. 509 Table 2 could NOT re-confirm the weight** — a miniature schematic at **9.0 px per
  staff space**, where 0.10 sp is under one pixel. It confirms the SHAPE only. ⛔ *"Sub-brace"*
  appears in **no source**.

- 🚨🚨 **AND IT EXPOSED A REAL BUG IN P2's WALK — the NESTING ORDER WAS BACKWARDS.**
  `systemStartColumn` walked `groupsAt`'s innermost-first list and placed the FIRST sign nearest the
  staves ⇒ **the sub-bracket drew INSIDE its own section bracket.** ⛔ Invisible until two signs could
  coexist; a three-staff render showed it at once. ⭐ The rule is §3.2's, measured in Gould p. 509/518,
  Ross pp. 155–6 and Stone p. 6, and stated outright by LilyPond (*"a piano context included within a
  staff group should cause the piano brace to be drawn **to the left of** the staff angle bracket"*):
  **the WIDEST group's sign sits next to the staves and the narrowest goes outermost.** ✅ The walk now
  runs the list backwards; `signs` still comes back innermost-first, so no caller moved.
- **`group-name` / `group-abbreviation` / `group-time`** — the instrument name beside the bracket, and
  whether a group shares one time signature. Nowhere in our model to land.
- **MusicXML import/export** — the known lossiness is §5.4's: *joined across two groups* needs an
  invented enclosing group, and a non-contiguous join is inexpressible. ⭐ Report, never repair
  (`docs/plans/json-io-plan.md`).

---

## 3. What would make this plan wrong

⭐ Written down so the next reader can check it rather than trust it:

- ~~If **decision 1 says positional**, `Score.staffGroups` is the wrong home and P1–P4 still stand —
  only the *reader* changes, because the renderer asks a resolver, not a field.~~ ✅ **IT FIRED, and
  it landed exactly as written — 2026-08-29, positional (§1b).** P1–P4 are unaffected; the reader
  becomes `groupsAt(score, measureNumber)`. ⭐ **This is the prediction working as intended**: it was
  written down so the answer would not be a surprise, and it wasn't.
- ~~If the treatises put the **deeper sign nearer the staves**, P2's ordering flips.~~ ✅ **Settled:
  smaller group further left (§3.2).** P2's ordering is fixed and MuseScore is not the model for it.
- ~~If Finale's brace turns out to be a **parametric shape** rather than a glyph…~~ ⭐ **This
  prediction FIRED, and it half-landed**: Finale is parametric (§2.4), which weakens *"use the ink a
  designer drew"* as an argument — while its measured **1.00 sp constant width** independently
  **strengthened** P4b's rule. ⇒ the mechanism (glyph vs curve) is the live question; the rule is
  not.
- ~~If the model is **already writing groups nobody authored**, "absent = a sketch" is not the safety
  net this plan leans on.~~ 🔎 🚨 **THIS ONE FIRED TOO, and it was the plan's own blind spot rather
  than a prediction it made** — `ensureSingleGroupSpansAllStaves` gives every two-staff score a
  group (§1a). The net that is really there is **`symbol`**, and the plan now says so. ⭐ **The
  lesson generalises past this feature:** *"the field is absent so nothing draws"* is a claim about
  the **WRITERS**, not about the type — and it has to be checked against them, not read off the
  optional `?`.
- 🔎 If the **hinting family** turns out to own the bracket rod (P3), the sourced **0.50 sp**
  thickness is not what reaches the screen — it is whatever whole number of device pixels the zoom
  rounds to. ⇒ then the number in §3.3 is a *model* value with a known drawn deviation, and this
  plan must say that out loud rather than quote 0.50 as if it survived.

---

## 4. ⏭️ LATER — a PARAMETRIC brace, and the engraving question under it

⭐ **Not needed for P4b, and ⛔ not a work item.** The RULE is settled four times over (constant
depth); this is about the MECHANISM, and it is written down because it is the road to **different
brace shapes** — an expressiveness a single stamped glyph cannot give us.

### ⭐⭐ The glyph-vs-curve split is PARTLY FALSE

LilyPond's 576 braces are ⛔ **not 576 drawings**. `mf/feta-braces.mf` is a **MetaFont PROGRAM** — a
parametric loop generating 9 sub-fonts × 64, the stroke stepping as `width/10` (research §2.2). So
LilyPond draws the same kind of curve Finale draws; it just draws it at **font-build time** instead
of **render time**, and freezes the output.

⇒ the division that actually matters is not *glyph vs curve*, it is:

| | who |
|---|---|
| **the shape is PARAMETERISED by height** | **Finale** (at draw time) · **LilyPond** (at build time) |
| **ONE fixed drawing, transformed** | MuseScore · Verovio · Dorico — all stamping Bravura's U+E000 |

**Three of five parameterise.** ⛔ That is a different picture from *"Finale versus everyone"*, and it
is the honest frame for the choice.

### What a parametric brace would BUY

Finale exposes **four handles** — Outer Tip, Inner Tip, Outer Body, Inner Body — plus a Width handle
at the cusp, and publishes its taper (**centre 0.15 sp, tip 0.30 sp**, §2.4). That is a brace whose
*character* is editable: fatter body, sharper tips, a flatter or more curled hook. ⭐ A stamped glyph
can only be scaled; **a parameterised one can be a different brace**, which is the thing to weigh if
the engine is ever meant to have its own voice rather than Bravura's.

⚠️ It is also what Finale's users defend it for, against Dorico — *"making the piano brace a glyph
was a huge mistake"* — while Finale's own Brace Designer is called *"really clunky"* by the same
engravers. ⇒ the mechanism being right does not make the interface right.

### ⛔ THE OPEN QUESTION, and it is an ENGRAVING one — **UNKNOWN**

**His question, 2026-08-28: *"what of that is more loyal to the tradition of hand engraving?"***

⛔ **We do not know, and it has NOT been researched.** ⛔ Do not answer it from the spacing evidence —
that is inference, and it points both ways:

- ⭐ **For "drawn"**: a brace of arbitrary height **cannot come from a single punch**, so the engraver
  had to do something variable. And Gould's **constant depth** across 2/3/4 staves behaves like a
  shape *drawn to fit*, not one stamped — which is exactly where Finale and Verovio land.
- ⭐ **For "punched"**: a graduated SET of brace punches would also give a constant depth, and
  LilyPond — whose whole font is modelled on historical punchwork — ships a graduated set.

⭐⭐ **THE ROUTE TO THE ANSWER IS ALREADY ON DISK: ROSS.** *The Art of Music Engraving and
Processing* is the one book in `reference/` that documents **the craft itself** — the plates, the
punches, which marks were struck and which were cut with a graver. **Was the brace punched or cut,
and with what?** ⭐ Bonus: it is his own book, so the same read would likely settle the **sub-bracket
weight** disagreement (Gould's 0.10 sp hairline versus Ross's full-thickness 0.63 second bracket,
research §3.7).

⛔ **Until that is read, the honest answer is UNKNOWN** — never a plausible story about engravers.
