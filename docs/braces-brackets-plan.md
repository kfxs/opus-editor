# Braces and brackets — the plan

> **Status: DRAFT, nothing agreed.** Written 2026-08-28. ⭐ **The treatises landed while it was
> being written and CHANGED IT — see §2 P3/P4 and the ⛔ notes**; Finale's report landed after and
> **confirmed** the change (§2.4). All seven reports are in. The evidence is
> `docs/braces-brackets-research.md` — ⛔ read PART 7 there before this, it is the codebase reading
> this plan sits on. ⏭️ **Anything the last two reports contradict gets changed here when they land.**
>
> ⭐ The sign at the left edge of a system that joins staves into a group: the piano **brace** `{`,
> the orchestral **bracket** `[`, and later the **sub-bracket**.

---

## 0. The three things already settled — ⛔ do not re-open

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
   for any of it**). This is `docs/vexflow-boundary.md`'s test met exactly: *the rule is unsayable*.
3. ⭐ **Staff spacing needs nothing.** `STAFF_GAP_SPACES = 6.5` already came from Gould's braced
   piano pair. ⛔ This feature does not move a staff.

## 1. ⏳ The decisions this plan is WAITING ON

⛔ **P0 is not code.** Each of these changes the TYPE, so none may be settled by writing a renderer
first.

⭐⭐ **HIS CALL, 2026-08-28 — decisions 1 and 2 are DEFERRED, not answered**: *"we don't have to
define this now… when the basic machinery for making the brace is done, i will tell you how the user
should apply it"*, and before that: *"brace and bracket will not be automatically — at the moment it
is a decision of the user that will draw it, similar to Sibelius"*.
⇒ **NO AUTOMATIC GROUPING** (⛔ no ensemble-type defaults — that whole question leaves this feature),
and **P1–P4 need none of the table below**: they read `staffGroups` as it stands today and draw
nothing when it is absent. **The open decisions are all about AUTHORING, which is P5.**

| # | question | where the answer comes from |
|---|---|---|
| 1 | ⭐⭐ **Can grouping change MID-SCORE?** (principle 6 — a `Score.staffGroups` silently means *"the grouping at bar 1"*, the `score.clef` shape exactly) | **HIS CALL.** MEI, Dorico and Finale are all positional; MusicXML is header-only, like ours today |
| 2 | **Content or presentation?** `instruments-plan.md:350-362` says *"presentational"*; `types/music.ts:2303` says *"genuine content"* — ⛔ they cannot both stand | **HIS CALL**, and it decides whether `symbol` lives in the score or in `engravingOverrides` |
| 3 | **Nesting: a level, a tree, or nothing?** We have `staffIds: string[]` and no depth — nested input **flattens**, and is *ambiguous* when genuinely overlapping | ⏭️ deferrable: P1–P4 need no nesting |
| ~~4~~ | ~~**The nesting ORDER**~~ | ✅ **ANSWERED — research §3.2.** ⭐⭐ **The SMALLER the group, the FURTHER LEFT its sign** — Gould p. 509 / p. 518, Ross pp. 155–6, Stone p. 6, all measured, unanimous. LilyPond and Verovio already do this; **MuseScore is the odd one out.** |
| ~~5~~ | ~~**How wide is a brace of height H?**~~ | ✅ **ANSWERED FOUR TIMES — research §3.4 / §2.4.** 🚨 **The depth is CONSTANT: 0.89 / 0.89 / 0.84 sp for 2 / 3 / 4 staves** (Gould p. 331, measured), flat 1.0 sp in Verovio, **1.00 sp across 99 real Finale files**. ⛔ It does NOT widen. |
| 6 | ⏳ **GLYPH or CURVE for the brace?** — the only open mechanism question | ⏳ **his eye** on a rendered ladder. Bravura's five variants vs Finale's tapered two-curve fill (centre 0.15 sp, tip 0.30 sp) |

⭐ **The conservative landing, and it is available:** keep `staffGroups` exactly as it is and draw
what it already says. An absent `staffGroups` is a sketch, so **P1–P4 move no existing test, no
spacing and no picture** for every score in the repo today — the same shape that made the barline
join's P1 safe.

---

## 2. The phases

### P1 — THE OWNER (a refactor; no picture change)

`VexFlowRenderer.drawSystemConnector` (`:4390`) is 12 lines inline in the facade, and it is the
**first member of the left-edge family**. Move it to `engine/rendering/systemStart.ts`, called from
the same site (`:4046-4062`).

- ⭐ Why first: CLAUDE.md's rule — the family gets **ONE OWNER**, the way the barlines did
  (`docs/barline-types-plan.md` §4.6). ⛔ Otherwise the brace becomes a second slice in the facade.
- ⭐ **The spec moves with it** — `npm run audit:tests` is the check.
- ⚠️ Keep its two comments verbatim: *"a system bracket belongs to the system, not to either staff's
  ink"*, and why it is drawn inside a `stavebarline` group (`hintBarlines` collects it).
- **Done when**: the picture is byte-identical and the e2e suite is unchanged.

### P2 — THE ROOM (the one genuinely new idea)

`engine/layout/systemStartColumn.ts` — **what the signs of a system take at its left edge, in staff
spaces**, and the indent that implies.

- ⭐⭐ **There is no constant to copy: NO ENGINE HAS A NESTING-INDENT CONSTANT** (three codebases,
  three routes — research §2.1/§2.2/§2.3). The indent is **the sum of what the signs actually take**.
- Structurally the below-staff LADDER turned ninety degrees (`layout/outsideStaffBand.ts`), so it
  follows that module's shape: **pure, ordered, unit-testable**, and the ORDER is the pass order.
- Consumers: `lineLeftPx` (`VexFlowRenderer.ts:3694`) and the per-line content width.
- ⚠️ ⛔ **Never into the margin** — print is the reason (`docs/pdf-export.md`'s audience rule).
- **Done when**: a score with no groups indents by **zero** and every existing test still passes.

### P3 — THE BRACKET (nearly free, and now fully specified)

`bracketTop` + a `fillRect` rod + `bracketBottom`, in **SCORE space** — ⛔ never inside
`inStaffSpace`, `barlineGap.ts`'s rule and for its reason (a 0.7 staff's `scale(k)` breaks a line
crossing two staves).

- ⭐ **We already stamp both terminals in production** — they are the winged repeat tips. Boxes
  measured (`bravuraMetrics.ts:137-140`), sizing solved (`BarlineRenderer.drawWing`, `3 × space`,
  reasoning in `drawnFontSize.ts`), and `ENGRAVING_DEFAULTS.bracketThickness = 0.5` is already there.
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

### P4 — THE BRACE

**P4a — measure the glyph we actually ship.** 🚨 U+E000 is **not** in our metrics table, and it is
**0.320 sp** wide in `public/fonts/Bravura.otf` (1.392) versus **0.277 sp** in the metadata we vendor
(1.481) — ~13% apart. `bravuraMetrics.ts:20-33`'s *"agree to 0.001 spaces"* covers only its 65-glyph
table and ⛔ **not this glyph**. Add `brace` and the four alternates.

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

### P5 — AUTHORING (only once P1–P4 draw)

- The dev shell's `Group:` row already exists and **logs** (`src/dev/devToolbar.ts`) — that is the
  door, and it is where the first real call lands.
- If the sign is selectable: a `SelectedElement` kind, ONE module in `interactions/elements/`, a row
  in `ELEMENT_SPECS` and a place in `ELEMENT_HIT_ORDER`. Standard shape, nothing new.
- ⏭️ Dorico's **signpost** is the model for a positional group with no ink (research §5.3), and it is
  the same successor already named for the dev shell's inkless-key `✕`.

### P6 — LEFTOVERS, each its own question

- **Sub-bracket** — ⛔ there is **no SMuFL glyph**. ⭐ Gould draws it as a **hairline OUTLINE: a
  0.10 sp stroke, 0.60 sp wide, with NO serifs** (§3.3, measured) — ⛔ not merely a thinner rod.
  ⚠️ **Gould + all three engines (~0.10–0.11 sp) against Ross (0.63, full thickness) and against
  Bravura's `subBracketThickness` 0.16.** `symbol` has no member for it. ⛔ And the term
  *"sub-brace"* appears in **no source**.
- **Nesting** (decision 3), **`none`** (load-bearing in both file formats, unrepresentable for us),
  and `group-name` / `group-abbreviation` / `group-time`, which have nowhere to land.
- **MusicXML import/export** — the known lossiness is §5.4's: *joined across two groups* needs an
  invented enclosing group, and a non-contiguous join is inexpressible. ⭐ Report, never repair
  (`docs/json-io-plan.md`).

---

## 3. What would make this plan wrong

⭐ Written down so the next reader can check it rather than trust it:

- If **decision 1 says positional**, `Score.staffGroups` is the wrong home and P1–P4 still stand —
  only the *reader* changes, because the renderer asks a resolver, not a field.
- ~~If the treatises put the **deeper sign nearer the staves**, P2's ordering flips.~~ ✅ **Settled:
  smaller group further left (§3.2).** P2's ordering is fixed and MuseScore is not the model for it.
- ~~If Finale's brace turns out to be a **parametric shape** rather than a glyph…~~ ⭐ **This
  prediction FIRED, and it half-landed**: Finale is parametric (§2.4), which weakens *"use the ink a
  designer drew"* as an argument — while its measured **1.00 sp constant width** independently
  **strengthened** P4b's rule. ⇒ the mechanism (glyph vs curve) is the live question; the rule is
  not.
