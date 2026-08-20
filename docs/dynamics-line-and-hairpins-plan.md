# The Dynamics Line, and Hairpins — Plan

Status: **ALL PHASES BUILT — P0, P1, P2, P3, P4** (2026-08-12). The line exists, every dynamic is on
it, and the hairpin is drawn, selectable, resizable and deletable: `H` / `Shift+H`, two Lines-palette
rows, a stamp, `Ctrl+Shift+←/→` to resize (see the 2026-08-17 note below), Delete to remove.

**Beside this:** `docs/dynamic-voice-scope-plan.md` — which voices a wedge governs (absent = ALL of
its staff), the Keypad voice row, and `Alt+1…5`. ⛔ It does NOT give the hairpin a velocity ramp;
scope says which voices it *will* govern.

🔎 **Two rules HIS TESTING added after P4, both now built** (2026-08-12):

- ⭐⭐ **THINGS THAT TOUCH SHARE A LINE — the CHAIN** (`engine/layout/dynamicsChain.ts`). A `< >` pair
  over a low C came out stepped: each wedge cleared its own ink and they were one gesture drawn at
  two heights. *"The hairpins are not aligned… there must be a way in which this should be
  adjusted."* He asked whether the unit should be the MEASURE; it should not — a bar is a spelling
  convenience, so it breaks both ways (a hairpin crossing a barline belongs to no bar, and two
  unrelated marks sharing one would be yoked). The unit both reference engines use is CONNECTIVITY:
  MuseScore's `alignItemsWithTheirSnappingChain` moves a snapped chain to a single OUTERMOST y,
  LilyPond covers a connected run with one `DynamicLineSpanner`. Built that way, **chaining across
  barlines** (his call over a bar-bounded variant). Marks that touch nothing keep P1's local rule
  untouched.
  ⚠️ It forced a real restructure: the answer cannot be reached inside either drawing pass, because
  what a wedge's baseline is depends on a mark at its far end. `rendering/dynamicsLinePlan.ts` now
  decides every mark's y ONCE per render and both passes look it up.
- ⭐⭐ **A WEDGE ALWAYS SITS A LITTLE INSIDE ITS SPAN** (`HAIRPIN.END_INSET`, 0.25 sp per end). Two
  abutting wedges met at a point and read as one diamond: *"here both should not touch… normally in
  music there is a tiny space."* The first build asked the model whether a neighbour abutted and
  inset only then. ⭐ **He rejected the conditional and he was right**: *"maybe instead of an IF
  statement it is better to hardcode the air… since we will give the user the faculty of modifying,
  making logic will make things too complicated."* An unconditional inset needs no rule about
  neighbours, gives two abutting wedges twice the air for free, and is what LilyPond does —
  `bound-padding` applies at a hairpin's bounds always. The `hairpinNeighbours` machinery the
  conditional needed was deleted.

🔎 **The research is done and recorded: four ENGINES at source (§2.4b) and the published
AUTHORITIES after them (§2.4c).** They back what was built — Gould p. 104 on where a wedge starts
and ends, a published rule that short hairpins take a smaller opening (which is our angle cap), and
1.33 sp as the practitioners' aperture. ⛔ Don't redo either survey.

**How to read the rest of this document.** It was written as a plan, then checked against the code,
then amended by his testing as each phase landed. 🔎 marks every place a later pass corrected or
extended what the analysis had first written — those marks are the most valuable thing here, because
each one is a place the reasoning was wrong in a way that looked right. §11's decisions are all
settled except .10; §13 says what is left.

Two features, deliberately in one document and one order: **the dynamics line first, the hairpin
second.** The hairpin is the small half. The line is the half that changes something already on
screen — and building the hairpin first would give it a private vertical rule that the line then
takes away.

---

## 1. Goal

**The line.** Every dynamic-family mark on a staff sits on one horizontal line per system — the
letters (`p`, `ff`), the expression words (`dolce`), and the hairpins. It is what LilyPond calls a
`DynamicLineSpanner`, and Dorico, Finale and Sibelius all behave the same way.

**The hairpin.** An open (crescendo) and a close (diminuendo) wedge spanning a range of the music,
created from the Lines palette or the keyboard, selectable and deletable like a slur, drawn on the
line, surviving a system break. A simple first pass: one wedge shape, no `cresc.`-with-dashes, no
playback ramp.

---

## 2. What the research found

Recorded so nobody repeats it.

### 2.1 VexFlow has `StaveHairpin`, and we should not take it

`node_modules/vexflow/build/esm/src/stavehairpin.js` — about 40 lines, three `lineTo`s. What it
decides for us, and why each one is wrong here:

- **y** = `stave.getY() + stave.getHeight() + 20` — a fixed **20 px** below the staff bottom. Not
  staff-space aware (breaks under a small staff's `scale(k)` group), and it knows nothing about the
  dynamics on that same line.
- **mouth** = `height: 10` px, fixed, same problem.
- **x** comes from `getModifierStartXY`, which **throws pre-draw** (see
  `reference_spacing_rules_must_be_clef_independent`) — a draw-time-only geometry source.
- Both ends must be real `StaveNote`s **on one stave**: no system break. No niente, no dashed
  `cresc.` form, no awareness of a dynamic it runs into.

Against the boundary test (*take VexFlow's decision only when the rule is unsayable* —
`docs/vexflow-boundary` in the memory index): every rule a hairpin needs is sayable and ours. What
we would inherit is three `lineTo`s. **Draw it ourselves**, in a score-level pass like
`renderSlurs(pass, score)` (`VexFlowRenderer.ts:3612`).

### 2.2 Our dynamics do not sit on a line today, and it is a defect

VexFlow 5's `annotation.js:181` places a `below` annotation from `note.getYs()` — **the note's own
lowest point**:

```js
y  = ys.reduce((a, b) => (a > b ? a : b))          // the note's LOWEST head
y += (this.textLine + 1) * STAVE_LINE_DISTANCE + textHeight
if (hasStem && stemDirection === DOWN) y = Math.max(y, stemExt.topY + textHeight + spacing * textLine)
```

So two `p`s in one bar sit at different heights whenever their notes differ in pitch, and a passage
that dips below the staff drags its dynamic down while its neighbour stays put.

🔎 **And it is worse than "wobble": there is NO stave-bottom clamp in that branch at all.** The
analysis first wrote this as "a branch that snaps it to the stave bottom when the note is high
enough"; the code has no such branch — the only conditional is the *stem* one above, which pushes a
down-stem note's mark below its stem tip. A high note therefore gets its dynamic a fixed ~24 px below
its own head, which can be **inside the staff**. What P1 changes is consequently bigger than tidying
a ragged line: on high passages the marks move out of the staff entirely. Say so before the
hand-testing, so the change is read as the fix rather than as a regression.

This is already true with no hairpins in the score. The hairpin is what makes it impossible to
ignore: a wedge is a long horizontal object, so any disagreement between it and the letters at
either end is visible across the whole span.

### 2.3 Every standard models a hairpin POSITIONALLY, never by note identity

| | model | how the END is addressed |
|---|---|---|
| MusicXML | `<wedge type="crescendo"\|"diminuendo"\|"stop">` in a `<direction>`, paired by `number`; carries `spread` (mouth, in tenths) and `niente` | a separate **stop** element, owned by whatever measure it lands in |
| MEI | `<hairpin form="cres" place staff>` | `@tstamp2="0m+3"` — **relative** measures + beat (or `@startid`/`@endid`) |
| MuseScore | `Hairpin` is an `SLine` spanner on ticks | tick + **duration** |
| Dorico | a *gradual dynamic* | rhythmic position + **duration** |
| LilyPond | `\<` … `\!`, a spanner bounded by note columns | terminated by `\!` or the next dynamic |

Not one anchors to note identity the way our `Slur` does. That matters for us beyond fidelity:
`rebar` regenerates slot ids, which is why `repairDanglingSlurs()` exists (`ScoreModel.rebarDeps`).
A slur severed by a re-bar is tolerable; a dynamic-family mark severed by one is not — dynamics ride
their measure at their beat and simply survive, and a hairpin must too.

🔎 **"Simply survive" is a description of the OUTCOME, not of the mechanism — and the mechanism is
not free.** A rebar does not leave a dynamic alone: `clearMeasureForRebar` (`rebarOps.ts:1231`)
deletes the whole `dynamics` array, and `captureBeatAnchors` / `restoreBeatAnchors` re-create every
mark at its absolute offset **with a fresh `uuidv4()` id**. The positional address is what survives;
the object and its id do not. Two consequences the hairpin inherits, both spelled out in §5 and §6.

### 2.4 Engraving rules (Gould, *Behind Bars*, dynamics)

- Below the staff for instrumental music; **above** for vocal (words live below); **between the
  staves** for keyboard, where one mark serves both hands.
- Letters, words and wedges share one line; the wedge's mouth centres on the letters' optical centre.
- A hairpin running into a dynamic **stops short of it**, about a space.
- Mouth roughly 1–1.5 spaces (LilyPond's default `height` is 0.67 sp per side ≈ 1.33 total). ⚠️ A
  number to settle **by eye**, like the spacing model's — not to be taken from this document.
- A minimum length, so a short wedge still reads as one (LilyPond: 2 sp).

### 2.4a 🔎 THE ANGLE, and the numbers behind it

Researched 2026-08-12, on his question; the first draft had the mouth and the minimum length but
nothing about the angle.

⭐⭐ **No engine stores an angle, because in every one of them the angle is DERIVED.** The authored
quantity is the **aperture** (the mouth); the length comes from the music; the opening angle is just
`atan((aperture/2) / length)` and nobody keeps it. Build it the other way round — an angle constant
that the length is fitted to — and a long crescendo would open into a funnel.

⚠️ **"Angle" means a SECOND thing in Dorico, and it is not that one.** There, *aperture* is the mouth
(min/max settable project-wide) and *angle* is the **vertical slant of the whole wedge** — its axis
tilting off horizontal. **By default hairpins are horizontal**, and the slant is authored per-hairpin
by moving the two end handles' Y independently (`Start offset Y` / `End offset Y`); changing only the
start does nothing, which tells you it is genuinely a two-endpoint quantity and not one "angle"
field. So the two words name the *derived* opening and the *authored* tilt, and this plan should use
them that way.

The measured defaults, so the by-eye tuning starts somewhere real:

| quantity | value | source |
|---|---|---|
| **stroke width** | **0.16 staff spaces** | SMuFL `engravingDefaults.hairpinThickness`, Bravura |
| stroke width, the other convention | 1.0 × staff-line thickness (≈0.1 sp) | LilyPond `Hairpin.thickness` |
| mouth (total) | 1.33 sp (`height` 0.6666 per side) | LilyPond `Hairpin.height` |
| minimum length | 2 sp / 3 sp | LilyPond `minimum-length` / Dorico's default |
| gap to a bounding dynamic | 1 sp | LilyPond `Hairpin.bound-padding` |
| axis | **horizontal by default** | Dorico, LilyPond, MuseScore |

⭐ **0.16 sp is a number we already draw with.** It is Bravura's `thinBarlineThickness`,
`legerLineThickness`, `octaveLineThickness` and `tupletBracketThickness` too — the whole thin-line
family is one weight — and it is the same 0.16 our barline ink already uses
(`rendering/barlineInk.ts`, and the PDF keeps the true 0.16 where the editor hints it to the pixel
grid). So the hairpin's stroke is not a new constant to invent: it is that one, and it should be
*named* as the shared thin-line weight rather than re-typed. (LilyPond's 1.0 × staff-line is the same
idea expressed relatively; Bravura's staff line is 0.13, so its hairpin is ~1.2× a staff line. Either
convention lands in the same place, and ours already picked 0.16.)

### 2.4b 🔎🔎 DOES A LONGER HAIRPIN OPEN WIDER? — four engines read AT SOURCE

His question, 2026-08-12: *"I remember Sibelius makes the mouth wider in relation with the length…
look on internet for it."* Two research agents read the actual C++ of LilyPond, Verovio and GUIDO.
⛔ **Don't redo this.** The findings changed the code twice.

| engine | full aperture | grows with length? | split at a system break |
|---|---|---|---|
| **LilyPond** | `height` 0.6666 **per side** → **1.333 sp** | **NO.** `Hairpin::print` computes `width` and the arm heights independently; length is only the endpoints' x | first **0 → ⅔**, continuation **⅓ → 1**, middle **⅓ → ⅔** — hard-coded |
| **Verovio** | `hairpinSize` 3 MEI units → **1.5 sp** | **DOWNWARD ONLY** — caps the included angle at **16°**, shrinking the aperture below ≈5.3 sp | the SAME thirds, independently |
| **GUIDO** | `deltaY` 3 half-spaces → **1.5 sp** | **NO** — no `atan`, no ratio, no cap anywhere | 0 → 0.588, then 0.25 → 1 |
| **MuseScore** | `hairpinHeight` **1.15 sp** (the FULL mouth) | **NO** — `len` is only the far endpoint's x; the arm heights are `±h1` regardless | first 0 → **FULL**, continuation `hairpinContHeight` **0.5 sp** → full |
| Dorico / Sibelius / Finale | Dorico **1.0 → 1.5 sp** | 🚨 **YES — all three, and it is ON by default in Dorico.** ⚠️ This row said "no documented formula" until 2026-08-15; see §2.4d for Spreadbury's own statement of Dorico's ramp (1.0→1.5 sp over lengths 8→36 sp) and Sibelius's/Finale's two-step threshold settings | Dorico's docs mention apertures *"across system and page breaks"*; its closed end keeps *"a small gap so that the hairpin is not misread as two separate hairpins"* |

🔎 **MuseScore, read at source 2026-08-12** (`src/engraving/rendering/score/tlayout.cpp`
`layoutHairpinSegment`, `style/styledef.cpp`), and it is the fourth independent "no":
`double h1 = hairpinHeight().val() * _spatium * .5;` with the arms at `±h1` — length enters only as
`l1.setLine(x1, 0.0, len, h1)`. Three further facts worth keeping:
- ⭐ **Its minimum is on the LENGTH, not the mouth**: `if (x < _spatium) x = _spatium;` — a wedge
  shorter than one staff space is *drawn* one space long at the FULL aperture. So MuseScore, like
  LilyPond, would rather stretch than narrow. Verovio's angle cap remains the only rule available to
  an engine that can do neither.
- ⚠️ **Its split convention is a THIRD one, and the opposite of the others**: a broken crescendo's
  first fragment reaches the FULL 1.15 sp at the system edge and the continuation restarts at
  `hairpinContHeight` = 0.5 sp. LilyPond and Verovio stop the first at ⅔ and resume at ⅓. All three
  agree only on this: **the continuation is narrower than where the first fragment ended.** That
  agreement is what we built to.
- ⭐ **No angle field, and no per-hairpin slant** — vertical resize is gated on `line()->diagonal()`,
  which is `false` for a hairpin and set by nothing. Its wedge is always symmetric about one
  horizontal axis. Confirms §2.4a from a fourth engine.
- 🔎 A note for §3: MuseScore's "dynamics line" is a **snapping chain** aligned to the OUTERMOST y
  (`AlignmentLayout::alignItemsWithTheirSnappingChain`), not a per-system rule — and a wedge gets no
  optical-centre correction there, because its axis IS its optical centre. Ours reaches the same
  place from the letters' ink, which is what lets a lone wedge land on the same line as a lone `p`.

⭐⭐ **So "longer opens wider" is NOT standard**, and in LilyPond it is a deliberate omission rather
than an oversight: that engine implements length-dependent geometry where it wants it and documents
it — `Slur.height-limit`, *"the longer the slur, the closer it is to this height"*, consumed in
`slur-scoring.cc`. Slurs asymptote with length; hairpins were not given the same treatment. If we
ever want it, a slur-style asymptote is the shape to copy, and `resolveHairpinShape` is the one line
that changes.

⭐⭐ **What IS real is the ANGLE CAP, and it is the rule for an engine in our position.** Everyone
agrees a short wedge must not become an arrowhead; they differ in how they fix it. LilyPond states
it as `minimum-length` 2.0 and enforces it by handing the spacer a **`Rod`** that pushes the two
columns apart — *the hairpin gets longer and its mouth is untouched*. ⛔ **We cannot do that**: our
length is musical, not cosmetic (§4), so the columns are not ours to move. Verovio, which also
cannot, caps the included angle at 16° and shrinks the aperture instead
(`Hairpin::CalcHeight`: *"if the angle is too big, restrict endY"*). **That is what P3 built.**

⭐⭐ **And the split STEPS, in every engine read.** LilyPond and Verovio arrive at the identical
thirds independently; GUIDO does the same shape with different constants. In all three the
continuation starts NARROWER than the first fragment ended, and the fractions ignore where the break
actually fell. Once seen it is obvious why: each fragment has to read as a wedge in its own right,
and a continuation resuming at exactly the width it left off would begin as a near-parallel pair of
lines. (Gould's *"keep the same angle either side"* is about a hairpin broken for an interim
DYNAMIC — a different case, and not this one.)

⚠️ **The aperture number itself is now a by-eye call with a split vote**: LilyPond 1.33, Verovio and
GUIDO 1.5. We took LilyPond's; two of three say 1.5, so this is the first thing to try if it reads
thin. `HAIRPIN.APERTURE` is the one place it lives.

⚠️ Two stroke-weight notes from the same read, since they do NOT agree with our 0.16: Verovio draws
hairpins at 0.1 sp, GUIDO at 0.08 sp. Ours is SMuFL's `hairpinThickness` (Bravura, 0.16), which is
the same weight as our barlines and ledger lines — a house decision, now knowingly heavier than two
other engines'.

### 2.4c 🔎 THE PUBLISHED AUTHORITIES — what the BOOKS say (2026-08-12)

The engine survey above is about implementations; this is the other half. ⛔ Don't redo it.

- ✅ **Gould, *Behind Bars* p. 104, verbatim**: *"Good practice is to start the hairpin on the
  left-hand edge of the note and to finish it on the right-hand edge of a note."* Exactly what P3
  built.
- ⭐⭐ ✅ **AN AUTHORITY DOES TIE APERTURE TO LENGTH — and it is the NARROWING direction we built.**
  Jürgen Gedan, *Notenschrift für Fortgeschrittene* pp. 18–19: *"Die Form der Gabeln hängt immer
  auch von ihrer Länge ab, denn kurze Gabeln müssen eine geringere Öffnung erhalten"* (the shape
  always depends on the length: **short hairpins must get a smaller opening**), and *"Zwar verträgt
  die lange Gabel eine Verengung, die kurze aber keine Weitung"* (a long wedge tolerates being
  narrowed; a short one tolerates no widening). So his instinct that length matters was right, the
  direction is DOWNWARD only, and Verovio's 16° cap now has a published rule behind it rather than
  just one engine's code. 🚨 ~~No authority says a long hairpin opens WIDER.~~ **FALSE, corrected
  2026-08-15**: Avid's own Sibelius manual says *"in some published music… the aperture of the
  hairpin widens slightly the longer the hairpin is"*, and Dorico ships that behaviour on by
  default. See §2.4d — Gedan's downward rule and this upward one are both real, and we now do both.
- ⭐ ⚠️ **1.33 sp is the practitioners' number too.** notat.io thread 55 (Ruggero, Knut, West):
  Finale's 1.5 sp is *too wide*, 1.25 felt narrow, **1.33 "has a more natural feel"**; house values
  quoted there are 0.8 (Durand/Salabert), 1.2 (Boosey & Hawkes), 1.3 (Music Sales). Their stroke is
  **0.125–0.15 sp**; ours is SMuFL's 0.16, knowingly at the heavy end.
  ⚠️ **We went to 1.5 anyway on 2026-08-15, by his eye** (§2.4d) — 1.5 at 15.5 spaces is the one he
  called *"very good"*. So this paragraph is the field's number, not ours; the disagreement is
  recorded rather than resolved.
- ✅ **The dynamics line is a published rule.** Sydney Symphony *Guidelines for Student Composers*
  §4.4 (hosted by MOLA): *"Hairpins should begin and end about half-way up the x-height of the
  dynamics."* And Gedan pp. 18–19 shows a hairpin *"ohne Grund auf anderer Höhe als die
  Lautstärke-Bezeichnungen"* — at a different height from the letters for no reason — as **wrong**.
  Both back the optical-centre axis (§3) and the chaining.
- ⚠️ **Dorico's abutting-hairpin gap is a NOTEHEAD WIDTH** (5.1.20 notes: one ends at the note's
  left side, the next starts at its right). Ours is `END_INSET`×2 = 0.5 sp, where a notehead is
  ~1.18 sp. ⏭️ So our air may be too tight — a by-eye call, and the constant is one line.
- ⚠️ **Minimum length**: Dorico's default is **3 spaces**, because *"when hairpins are shorter than
  this, they can sometimes be confused with the accent articulation mark"* — a better reason than
  any given for LilyPond's 2.0.
- ✅ **§11.7 has an answer**: SSO §4.4 — *"Hairpins are preferred for no more than a couple of bars;
  for a crescendo lasting more than a few bars, use `cresc.` or `dim.` … an extended hairpin can be
  visually confusing because it is almost, but not quite, parallel to the staff lines."*
- ✅ **A hairpin does NOT break at a barline**: Gerou, *Essentials of Music Notation* — *"For
  crescendo and diminuendo signs, the barline is left intact"*, unlike other spanners. Also
  *"Horizontal placement is preferred… although an angled placement is acceptable"* — the horizontal
  default plus the authored slant, from a fifth source.
- ✅ **Placement**, MPA *Standard Music Notation Practice* p. 9: below for single-staff instrumental,
  between the staves for keyboard/harp, **above for vocal** (to clear the text). Confirms §3's
  "what is on the line" split from a published standard.
- ❌ **MOLA's own guidelines say nothing about hairpins** (full text extracted; dynamics appear once,
  about language). It cites Gould/Ross/Stone rather than restating them.
- ❌ **Ross (1970) and Stone (1980)**: not obtainable — Archive copies are lending-only. Their
  hairpin geometry, if any, remains unread.

**Gould's own rules about the gradient**, which are consequences of the above rather than extra
numbers: start the hairpin at the **left-hand edge** of its first note and finish at the
**right-hand edge** of its last (*Behind Bars* p.104 — which is the same "read to the SLOT'S END"
that §5 needs for the x); **avoid steep gradients**, i.e. lengthen rather than open wider, which is
what the minimum-length rule is protecting; and when a hairpin is **broken for an interim dynamic**,
**keep the same angle either side** so it still reads as one gradual change.
- Very long spans take `cresc.` + dashes instead of a wedge.
- 🚨 ~~At a system break the wedge splits; the continuation resumes at the width it left off.~~
  **WRONG, corrected 2026-08-12 by reading three engines' source — see §2.4b.** It splits, but the
  continuation resumes NARROWER: LilyPond and Verovio both cut it at hard-coded thirds.

### 2.4d 🔎🔎 THE LONG-HAIRPIN PROBLEM — and the rule we shipped (2026-08-15)

His report: a crescendo over nine whole notes *"is not exactly bad… but graphically i see too much
black (the lines are overlapped) in the beguening"*. ⛔ Don't redo this; it went four rounds against
his eye and two research agents.

**THE ARITHMETIC, and it is the whole thing.** Two arms opening by `aperture` over `length` are
closer together than their own stroke for the first **`thickness ÷ aperture`** of the wedge — a
FRACTION, with the length divided out. At 0.16 and 1.5 that is 10.7% of *every hairpin ever drawn*.
On a one-bar wedge it is one staff space and invisible; on his nine-bar one it was 9.1 spaces of ink
laid down twice, which reads as a solid black bar under the staff. The wedge is scale-invariant, so
its defect scales with it — **and therefore any fix must break that scale-invariance.** Exactly two
things can: open the mouth on long wedges, or bend the arms so they leave the tip faster.

⛔ **BENT ARMS REJECTED, and it was his call.** `(x/L)^p` opens a `√` arm to 32% a tenth of the way
along where a straight one is at 10%, and essentially eliminates the black. But all four engines and
every printed edition draw two STRAIGHT lines. *"hairpin are straight line… maybe is a good
possibiliti for the future as a feature for contemporary custom graphic score, but in any case the
user should be able to draw classic hairpin and this is priority now."* ⏭️ So it is a candidate
authored `shape`, alongside the aperture and slant in `HairpinShapeOverrideLike` (§6) — never a
default.

⛔ **A LIGHTER STROKE REJECTED, twice, by eye.** The other half of the fraction. All four engines
draw a hairpin at roughly half a barline's weight against SMuFL's own `hairpinThickness: 0.16`
(LilyPond `thickness 1.0` vs `hair-thickness 1.9`; MuseScore `0.12_sp` vs `barWidth 0.18_sp`;
Verovio 0.1; GUIDO 0.08). Verovio's 0.10 drew *"now the line is too thin"*; MuseScore's 0.12 drew
*"make the line stroke at the size of the beguining"*. Stays at **0.16**, and `thinLineWeight.ts`
records the verdict so it is not attempted a third time. His reason is worth keeping: *"it match
better with other elements, for example the stroke of the slur."*

⚠️⚠️ **PROVISIONAL, in his own words** (2026-08-15): *"so im not sure if this is the definite rule
we should apply but it is much better than before, and i guess for the moment is ok."* So the SHAPE
below is accepted and the numbers are a resting point, not a conclusion — the ceiling excepted, which
is Gould's. Anyone re-opening it should start from the arithmetic above and his seven cases below,
not from a blank sheet.

**THE RULE — an affine RAMP, not an angle**, in `rendering/hairpinShape.ts`:

```
aperture = min(MAX_APERTURE, APERTURE + GROWTH_PER_SPACE × max(0, lengthSpaces − GROWTH_FROM_SPACES))
        = min(2.0,          1.5      + 0.012            × max(0, lengthSpaces − 36))
```

…then the steepness cap (now **11.5°**, not Verovio's 16) applies on top, narrowing very short
wedges. Four straight pieces in all: a ramp through the origin below ≈7.4 spaces, flat 1.5 through
the ordinary range, this ramp, then flat 2.0 from ≈78 spaces on.

⭐⭐ **WHY A RAMP AND NOT AN ANGLE — the one structural lesson.** It was a minimum ANGLE first,
mirroring the cap: `2·length·tan(θmin/2)`, clamped. That is a line **through the origin**, so it has
ONE degree of freedom, and *where growth starts* and *how fast it climbs* are the same number. His
verdicts need them separate — a 45-space wedge *"can be a little more wider"* while a 65-space one at
2.29 was *"definitely too wide"*. Two constraints, one parameter: unsatisfiable at any θ. ⚠️ The
angle form had one virtue the ramp gives up: it made the black a CONSTANT (`thickness ÷ 2·tan(θ/2)`,
no length in it). The ramp does not — above ≈78 spaces the black grows with length again.

**HIS SEVEN VERDICTS**, measured in the browser suite (whole notes, one wedge each):

| length | he saw | he said | shipped |
|---|---|---|---|
| 5.5 sp | 1.50, then 1.25 | *"too wide… a little less"*, then *"also here can be less wider"* | **1.11** (the cap) |
| 15.5 | 1.50 | ***"very good"*** | 1.50 |
| 35.5 | 1.50 | *"good"* | 1.50 |
| 45.5 | 1.50 | *"can be a little more wider"* | **1.61** |
| 65.5 | 2.29 | *"definitely too wide… this should be the end case"* | **1.85** |
| 85.5 | 2.50, then 2.24 | *"ok… if the aperture before is less wide we can try to go for it"* | **2.00** |

⚠️ **`lengthSpaces` is DRAWN INK, never bars** — his correction: *"4 bars with whole note is
different that 4 bars with 16th."* Four bars of sixteenths earn far more room from the spacing model,
so they are a much longer wedge. For a split wedge it is the sum of the fragments drawn.

**🚨 A CORRECTION TO §2.4c.** That section ends *"❌ No authority says a long hairpin opens WIDER."*
**That is now false**, from Avid's own Sibelius Reference Guide 2024.3 §4.7: *"By default, Sibelius
makes the aperture… the same, regardless of the length of the hairpin. **In some published music,
however, the aperture of the hairpin widens slightly the longer the hairpin is**, and Sibelius lets
you reproduce this appearance."* His memory from 2026-08-12 — *"sibelius solve this jumping the mouth
height from one value to another in certain length"* — was **exactly right**: the settings are
literally *"Small aperture"*, *"Large aperture"* and *"Large aperture if wider than n spaces"*.
Finale has the same three (*"Short span opening width"* / *"Maximum short span length"* / *"Long span
opening width"*).

⭐⭐ **AND THE STRUCTURE IS DORICO'S, verbatim — found AFTER ours was built.** Daniel Spreadbury
(Dorico's product manager), Steinberg forum: *"The aperture of a hairpin is scaled between the value
of 'Minimum hairpin aperture' (1 space by default) and 'Maximum hairpin aperture' (1½ spaces by
default) **for hairpins between 8 and 36 spaces in length**."* Two clamps and a linear ramp keyed to
staff spaces — the same shape, arrived at independently, and ON by default there.
⛔ **We do not take their numbers**: their ramp is over 8→36 spaces, so 15.5 would give ≈1.13, and
1.5 at 15.5 is the one he called *"very good"*. Their ramp ends where ours begins; the two answer
different halves of the range, and only ours reaches a system-long wedge. ⚠️ Engravers on both
forums call length-varying apertures *"not standard practice"* and advise turning it off; the one
Dorico thread about it is a user asking how to disable it.

⭐⭐ **THE CEILING IS GOULD'S, and 2.5 and 2.3 were both over it.** *Behind Bars* p.103, verbatim:
**"Hairpins are the thickness of a stave-line. The open end should not be more than two stave-spaces
wide."** A ceiling, not a value — she gives no preferred aperture and no floor, and adds that the
mouth *"maintains the same width regardless of dynamic"*. `MAX_APERTURE` is now 2.0 because a book
says so. His eye had been walking it down independently.

⚠️ **NOBODY HAS PUBLICLY DIAGNOSED THIS DEFECT.** Searched: notat.io, the Steinberg/MuseScore/Finale/
Sibelius forums, music.stackexchange, Scoring Notes. The nearest anyone gets is Gould's own *"long
hairpins confuse the eye, as the long lines are virtually parallel to the stave"* and SSO's *"almost,
but not quite, parallel to the staff lines"* — the whole shape, not the tip. So the rule above
contradicts no convention, and implements none either: **every constant in it is a taste number
except the 2.0.**

⏭️ **What the books actually prescribe is still §11.7**, and he has ruled it out as *automatic*
behaviour (*"the user must write the music however they want"*). Gould p.106: *"Instead, use the
terms crescendo (abbrev. cresc.), diminuendo (abbrev. dim.)… Widely spaced dashes or dots following
on from these indications may be used to identify the duration… A reminder in brackets (cresc.) is
useful at the beginning of a new system."* As a form the USER can choose it remains the documented
answer, and MuseScore models it as the same `Hairpin` with a line style (`isLineType()`) rather than
a new element — the shape to copy when it is built.

### 2.5 Creation gestures in the field

Sibelius **`H` = crescendo, `Shift+H` = diminuendo** over the selection, then Space extends it note
by note. MuseScore `<` / `>`. Dorico Shift+D popover, `<` / `>`. Finale drags a Smart Shape from
start to end. The dominant gesture is **select a passage → one key**, which is exactly the routing
`createSlur` already has. `h` and `Shift+H` are free in `ShortcutConfig` (only `Ctrl+Shift+H` is
taken — the rest hide/show, `ShortcutConfig.ts:448`).

---

## 3. The dynamics line

**One line per `(system, staff, placement)`** — LilyPond's scope too, since the spanner breaks at
every line break.

**Its y is a BASELINE, not a top edge.** A 30 px Bravura glyph and 14 px Georgia italic look aligned
only when they share a baseline — which is how print sets `p dolce`. We are already set up for it:
`DYNAMIC_GLYPH_INK_ABOVE` / `_BELOW` (`rendering/dynamicStyle.ts`) are defined *from the text
baseline*, so the line states one baseline and each mark derives its ink extent from it. The
hairpin's mouth then centres not on the baseline but on the glyphs' optical centre — about a quarter
of the glyph size above it, from those same two constants.

**The rule:** ~~the lowest ink of that system+staff~~ the ink UNDER THE MARK, plus a padding, floored
at a minimum distance below the bottom line — all in staff-spaces, so a small staff scales with it.

🔎 **AMENDED 2026-08-12, his call after seeing P1: the deviation is LOCAL — LilyPond's default, not
Dorico's.** The line is stated from the STAFF, so every mark over ordinary music lands on the same y
and they read as one line; a mark standing over a genuine dip clears that dip and *only that mark*
moves. The rejected alternative — clearing the lowest ink anywhere in the system — is level but
generous: one low note in bar 3 drops bar 1's `p`, and by eye the local rule reads better. *"By
default it is better to have a line and a deviation of the line for notes that are too low."*

⭐ **What "its own music" means: the mark's own COLUMN** (`columnsUnder`) — the same scope LilyPond's
`DynamicLineSpanner` covers for a lone dynamic. Not its bar (a dip three beats later is not under the
mark), not the system. A hairpin will hand in the columns it SPANS: same function, wider slice.

⭐⭐ **And the floor is what makes it a line, so it is derived, not chosen.** A note on the middle line
stems down 1.5 spaces below the staff — the deepest ink single-voice music inside the staff makes —
so the floor is that plus the padding: **2.1 spaces**. Every mark over staff-resident music, stem up
or stem down, then comes out at exactly the floor. Set it to LilyPond's own `minimum-space` of 1.2
instead and a down-stemmed note beats the floor by 0.9, so a bar of ordinary notes steps its dynamics
as the stems flip — the drunk line, arrived at from the other direction.

**What is ON the line:** dynamic letters, expression words, hairpins. In our model these are the
same object already — an expression word IS a `Dynamic` (text-as-truth); `dolce` differs from `p`
only in that `isInterpreted()` is false (so `resolveChordLevels` skips it) and `splitDynamicRuns`
sends it to the serif italic face. So the line covers expression text with no second rule, and
`p dolce` is already laid out left-to-right by `layoutCoLocatedDynamics` — that becomes a
line-local concern instead of a special case.

🔎 **One half of `layoutCoLocatedDynamics` must then GO, not be kept** — P1 keeps its horizontal half
(the left-to-right row and the `GAP`) and drops its vertical `dy`, because the line is the y for both
marks. Why that is a fix and not just a simplification: §3a.

**What is NOT on it:** technique text (`pizz.`, `con sord.` — the open Alt+T item). Gould's split is
dynamics and *qualifying* expression below, playing technique above. Saying so now is what stops the
line quietly becoming "everything drawn below the staff".

**What expression text needs beyond that: almost nothing, and two named things.** Because a word is
a `Dynamic`, P1 must simply read the line for *every* dynamic, not only the interpreted ones — the
letters and the words move together or the pairing `p dolce` breaks. Then:

- ⭐ **The inline editor follows for free.** `TextEditController` positions the DOM overlay from
  `source.getScreenRect()`, and `DynamicTextSource` builds that from the mark's **registry bbox**
  mapped through the SVG's CTM — so as long as `registerDynamics` keeps taking the bbox from the
  *rendered* SVG, moving the glyph moves the editor with it.

  🔎 **"For free" was wrong, and P1 had to pay for it (2026-08-12).** `DomTextEdit` aligns on a
  `baselineY` — but only `TempoTextSource` supplied one; the dynamics overlay was TOP-aligned on the
  registry box, and a box's top only means the same thing while everything in it is the same height.
  It is not: a glyph chip is 2.14× the words. Three symptoms, one cause — **the overlay's line box is
  sized by its tallest content, so its baseline moves whenever the content's height changes**:
  the mark dropped ~20px when a glyph went in, the box lurched when the text was deleted, and the
  caret took the line box's height (twice the text's) and the wrong line after a chip was removed.
  The fixes are the cause removed, and all four are in `interactions/`:
  **(i)** `DynamicTextSource.getBaselineY()`, measured off the engraved `<text>`'s own CTM — the
  quantity §3 makes the line, so the two now agree by construction; **(ii)** the overlay's
  `line-height` set to a MEASURED PIXEL value (the CSS had a unitless `1`, which inherits as a
  *factor*, so a 2.14em chip got a 2.14em line box); **(iii)** `line-height: 0` on the chip itself,
  because an inline box's *position* about the baseline still derives from its own font's ascent —
  pinning the box alone left 5px of growth and 2.7px of baseline drop; **(iv)** the drawn caret takes
  its height and line from the box (one pinned line, one answer) and only its x from the range or a
  neighbour, and it syncs on `input` as well as `selectionchange`, because the caret's place depends
  on the CONTENT and not only on the selection.
- ⚠️ **The suppressed-while-editing trap.** A mark being edited is dropped from the engraving
  (`pass.suppressedDynamicId`) and drawn by the overlay instead. If the hairpin's end stops against
  that word's skyline, the word vanishing mid-edit would make the wedge grow and shrink as you type.
  The skyline must include a suppressed mark's box, not the drawn ink.

  🔎 **…and there is no such box today, which is the part that needs deciding.** A suppressed mark is
  never drawn, so it has no SVG element and `registerDynamics` never registers it — the skyline has
  nothing to read. Three sources, in order of preference: **(i)** keep the mark's LAST registered
  bbox (it is already in the previous render's `MeasureSnapshot.elements`, and a mark being typed
  into has not moved); **(ii)** map the overlay's own client rect back through the SVG's *inverse*
  CTM, the mirror of `DynamicTextSource.computeScreenRect`; **(iii)** freeze the wedge's end while an
  edit is open. (i) is cheapest and needs no new plumbing; (iii) is the honest fallback if the
  skyline turns out not to want a stale box.

**It also owns a horizontal skyline**, not just a y. "The hairpin stops short of the dynamic it runs
into" is easy against a glyph and awkward against a *word*: `dolce` is wide, and our dynamics
deliberately have zero layout width (`setWidth(0)`) so text never pushes notes apart. Once the line
owns everything on it, it owns their x-extents, and the wedge can stop against a word as easily as
against an `f`.

### 3a. 🔎 "So is our expression text CORRECTED by this?"

His question, 2026-08-12. Three answers, because it is three questions.

**✅ Vertically, yes — and TWICE, not once.**

1. Every word stops taking its y from its own note's lowest point (§2.2) and takes the system's
   baseline, so words line up with each other and with the letters. One rule, no second family.
2. ⭐ **`p dolce` stops being CENTRE-aligned**, which is a defect nobody had named. Two marks on one
   note are laid into a row by `layoutCoLocatedDynamics`, aligned on the first mark's vertical
   *centre* (`DynamicsLayout.ts:111`) — so a 14 px italic word is centred against a 30 px glyph's box
   instead of sitting on its baseline. ⚠️ Within a SINGLE mark the baseline is already right (every
   mark is drawn at the TEXT size and its glyph runs grown UPWARD by `applyMixedDynamicRuns` — that
   is what `buildDynamicAnnotation`'s comment is protecting, so do not "fix" it there); it is only
   the co-located pair that is wrong. Dropping that `dy` in P1 is the fix, because the line is then
   the y for both.

🔎 **AMENDED 2026-08-12 — horizontally, SOMETHING changed after all: a LEVEL is now centred on its
notehead** (`rendering/dynamicMarkAnchor.ts`). His report while testing P1: *"the text is entered
more to the right of the anchored note… for me the initial position should be before the note in
x."* He is right and every source agrees — Gould (*centrally below the note*), LilyPond's
`DynamicText self-alignment-X = CENTER`, MuseScore and Dorico both centred by default. The rule
built is the simple half: **all-glyph centres, anything containing prose stays anchored**, because a
word centred on a notehead reaches back over the previous beat. Mixed `p dolce` counts as prose —
strictly its `p` should straddle, which needs the leading run measured alone; ⏭️ that is the first
thing to revisit. Two facts the build turned up: VexFlow's own `CENTER` justification is unusable
(it subtracts `getWidth()`, which we deliberately zero), and a Bravura dynamic has a **negative left
side bearing** — its ink starts ~5 px left of its origin — so the shift is the ink's own centre, not
half its width. The paragraph below stands for everything else:

**⛔ Otherwise horizontally NO — and it is worth saying out loud.** A mark is left-justified
from its note and has `setWidth(0)`, so a long word overflows freely to the right and can still run
into whatever is next. The line's horizontal **skyline** (above) teaches the *wedge* where the word
is — it does **not** move the word. Word-vs-word collisions, and the convention question of whether a
bare dynamic should be centred under its notehead rather than left-anchored, are both untouched and
out of scope here.

**A nudged mark moves with its origin, and that is the design, not an event.** `applyDynamicOffsets`
adds a stored staff-space delta to the mark's automatic placement, so changing the placement moves
the nudged mark with it — which is exactly what anchor-relative means, and §4's argument arriving
(the origin stops being a side effect and becomes a rule). ⛔ Nothing to migrate and nothing to
rebase: there are no users and no files in the wild, and this repo does not build migrations
(`docs/no-json-migration.md`). Worth a line only so a hand-nudged mark sitting somewhere new in the
test score after P1 reads as the rule landing rather than a regression.

**⛔ Not corrected here at all:** technique text (`pizz.` — Gould puts it above), tempo marks (their
own rule in `TempoLayout.ts`, §12's ladder), and per-voice lines.

---

## 4. How free placement rides the line

We already have per-mark freedom in the small: `nudgeDynamicOffset(id, dx, dy)` →
`DynamicOffsetOverride`, id-keyed, in staff-spaces, anchor-relative, surviving copy/paste
(`clipboard.ts:280`). The line does not compete with it — **it gives it an origin.**

Today that origin is "wherever VexFlow dropped the annotation", computed from the note's own lowest
point. So the same stored delta means a different place after the note under it is re-pitched, and
"reset position" cannot be stated precisely, because the default is a side effect rather than a
rule. Every program stores a delta from a computed default for exactly this reason (Sibelius's
*Reset Position*, Dorico's Engrave-mode offsets, LilyPond's `extra-offset`); none of them abandon
the baseline in order to allow dragging.

**Two levels of freedom, both wanted:**

1. **Move one mark** — a delta from the line. Exists.
2. **Move the line** — per system / staff / score. Only expressible once a line exists, and it is
   the remedy for the "one low note pushed the whole system down" case. LilyPond exposes it as
   `DynamicLineSpanner.staff-padding`; Dorico as a dynamics baseline.

**⭐ THE RULE: an offset moves INK, not LAYOUT.** A dragged mark keeps its layout position for
everyone else's purposes — it does not drag the line down, does not push its neighbours, and a
hairpin still stops short of where that `p` *belongs*, not where it was dragged. This is
`extra-offset`'s behaviour, it is what the overrides compartment already says about itself
(weightless: in the shape key, absent from the width key), and the alternative is a feedback loop in
which moving a mark moves the line the mark is measured from. Nothing is capped or snapped: the
delta is unbounded, and reset brings the mark home.

**⚠️ Vertical and horizontal freedom are different kinds of thing.** Vertical is engraving — a delta
from the line. Horizontal is usually *musical*: a dynamic's x is its `beat`; a hairpin's extent is
its start and length. Dragging a hairpin's end is Sibelius's Space and Dorico's Write-mode drag —
it changes what the mark covers, i.e. the model. Let a horizontal drag write a cosmetic offset
instead and we get two ways to say "this hairpin is three beats long" that can disagree, with
playback believing the one the eye does not. Time comes from the address; engraving comes from the
compartment. (A small cosmetic x stays legitimate — `DynamicOffsetOverride` already carries one —
but it is a nudge, never how length is expressed.)

---

## 5. The data model

`docs/dynamics-plan.md` §8 already reserved the shape: *"a separate `Hairpin` array on `Measure`,
reusing the beat-anchor + voice + placement conventions"*. That still looks right; what needed
deciding is **how the end is addressed**.

**Recommended — start address + LENGTH, on the start measure** (Dorico's and MuseScore's shape):

```
Measure.hairpins?: Hairpin[]
Hairpin = {
  id: string
  type: 'cresc' | 'dim'
  beat: Fraction          // start, on the measure it lives in — a Dynamic's address
  length: Fraction        // how much music it covers, in the same units as a beat
  voice?: 0 | 1 | 2 | 3   // as Dynamic
  staffId?: string        // as Dynamic
  placement?: 'above' | 'below'
}
```

**No foreign key at all.** Nothing names another bar, so inserting or deleting a measure needs no
*renumbering* fix-up and the hairpin travels with its measure exactly as a `Dynamic` does.

🔎 **Two honest costs, both restated after the code check — the first one was written down wrong.**

- **Deleting a bar inside the span does NOT shorten what it covers.** `length` is a count of music,
  so removing music from the middle leaves the count unchanged and the *end* lands on different
  music — or past the end of the score. (The original text claimed it "silently shortens… arguably
  right"; it does not shorten, and the clamp `restoreBeatAnchors` already uses for an over-running
  offset is the model to copy.)
- **Finding the end's x means walking forward from the start measure at render time** — see the
  geometry note below, which names what to walk.

🔎 **⚠️ THE X'S NEED A NAMED SOURCE, and the obvious one is wrong.** `CoordinateMapper.beatToPixelX`
(`CoordinateMapper.ts:130`) divides the bar's usable width by `barQuarters` — a **linear**
interpolation that has nothing to do with where the spacing solve actually put the columns. A wedge
drawn from it would visibly disagree with the notes it spans. Use instead the resolution
`attachDynamicsToSlots` already implements: the slot at `(voice, beat)`, else fall forward to the
next slot in that voice, and take its x from the render. Two sources for that x, and the second is
better: `pass.staveNoteMap` (fresh only for a bar that was re-engraved) or the **`ElementRegistry`
entry**, which `replaySnapshot` shifts by `dx/dy` and is therefore correct for a bar that merely
MOVED. ⚠️ And the END address means the **end of that slot** — the next column's x, else the bar's
`noteEndX` — not the start of the next column (`project_fixed_vs_unfixed_time_space`).

🔎 **⚠️⚠️ IT MUST JOIN THE REBAR SEAM, and the failure if it does not is SILENT and worse than
deletion.** `clearMeasureForRebar` (`rebarOps.ts:1231`) wipes the measure **by naming four fields**:
`slots`, `tuplets`, `clefs`, `dynamics`, `tempos`. A new `hairpins` array is not in that list, so it
**survives the wipe holding its old `beat` and `length`** while the bar's music is re-tiled around
it — a hairpin left pointing at music that moved, with no error and with "it's still there" passing
any test that only counts them. So:

- capture it in `captureBeatAnchors` by absolute offset from the region start, exactly as a dynamic
  is, and re-create it in `restoreBeatAnchors` (`length` is invariant under a rebar — the region's
  total music is unchanged — so only the START needs re-anchoring, with the same clamp);
- **add `hairpins` to `clearMeasureForRebar`'s delete list**, so the capture/restore pair is the only
  road back and a missed capture is a visible loss rather than a silent lie;
- ⚠️ **the id is regenerated** (`id: uuidv4()`), so §6's hairpin-id-keyed vertical override must ride
  the same capture-and-re-stamp trick `DynamicOffsetOverride` already does (`rebarOps.ts:628`), and
  a `selectedElement` naming a hairpin by id goes stale across a rebar exactly as a dynamic's does.

🔎 **The per-staff lane will not filter it either.** `staffLaneOf` (`staffContent.ts:143`) builds a
staff's view as `{ ...measure, slots, clefs, dynamics, tuplets }` — four arrays named, everything
else riding the spread. `hairpins` would land unfiltered on EVERY staff's lane. Add a
`staffHairpins(measure, staffId, score)` beside `staffDynamics` and name it in that object.

**Rejected: note-id anchored (`startNoteId` / `endNoteId`, like `Slur`).** Maximum machinery reuse,
but wrong on two counts — it is not what a hairpin is in any standard (§2.3), and in our engine note
ids are not stable across a re-bar (§2.3, `repairDanglingSlurs`).

**Rejected for now: `Score.hairpins[]` with two addresses.** Symmetric with slurs and a single
repair site, but it reintroduces the foreign key (`endMeasure` by number breaks on insert; by
measure id survives) and puts a dynamics-family object in a different home from every other dynamic.

Resolution at render time is already solved in shape: `attachDynamicsToSlots` turns a `(voice, beat)`
address into a slot with a fall-forward rule, which is what both ends need. ⚠️ The end address means
the **end of that slot**, not the start of the next column — the trap recorded in
`project_fixed_vs_unfixed_time_space` ("read the room to the SLOT'S END").

---

## 6. Geometry vs semantics (Principle 3)

`docs/DESIGN-PRINCIPLES.md` §3: *the model holds neither pixels nor layout; layout results are
derived views, never stored back.* Its resolved boundary case is the one this plan must not repeat —
**`Slur.cps` used to keep the hand-edited arc on the content model**, and it moved to the
engraving-overrides compartment: id-keyed, anchor-relative, in **staff-spaces**. The same entry
blesses the other side of the split explicitly: *"semantic side/direction flips (`placement`,
`stemDirection`, `tieDirection`) deliberately stay on the content model — they are notational
meaning, not geometry."*

Sorted against that, the line elements land like this.

**On the content model (semantics).** Every field in §5's `Hairpin` and nothing more: `type` (which
wedge it is), `beat` + `length` (which music it covers), `voice` / `staffId` (which lane it governs),
`placement` (a notational statement, blessed above). ⭐ **`length` as a `Fraction` is this principle
doing the work**: what is stored is *how much music*, and the wedge's drawn length in pixels is
derived from it every render. That is also why §4's rule — horizontal is the model, vertical is an
override — is not merely a UX preference: a hairpin's extent is musical, its height is not.

**In the overrides compartment (authored geometry).** Anything the user hand-tunes about how it
*looks*: a vertical nudge off the line (keyed by the hairpin's id, exactly as `DynamicOffsetOverride`
is — 🔎 and therefore, exactly as that one does, it must be captured and re-stamped across a rebar,
because the id it is keyed by does not survive one: §5), and — if we ever want it — a custom mouth. ⛔ **The mouth does not go on the model.** MusicXML
carries it as `spread` in tenths, which is a page measurement; ours would be a staff-space override,
one client of the compartment, and absent by default.

🔎 **⭐ NOT BUILT NOW, BUT NOT PRECLUDED: the aperture and the slant as user controls** (his note,
2026-08-12 — *"probably in the future the user will be able to change the angle; just take it into
account so it is easy to add"*). Both are already sorted by this section — authored geometry, so:
compartment, id-keyed, staff-spaces, absent by default. So the only thing P3 must get right is **not
hard-coding either one at the drawing site**, and the house pattern for exactly that is the slur's,
one family over:

- `resolveCps(override, stave, p0, p1, …)` (`SlurRenderer.ts:286`) — *a hand-edited shape converted
  to pixels against the live stave, **else** the auto arch*. One function, so the staff-space→pixel
  step lives in one place and the automatic shape is a fallback rather than the only path;
- `slurEndpointOffsetPx(offset, fromStave, toStave)` — per-END deltas that yield 0 for a missing
  offset, so the caller adds them unconditionally without a branch.

Copy that: a `resolveHairpinShape(...)` answering `{ aperture, startY, endY }` from an absent
override plus §2.4a's defaults. The day the aperture or the slant becomes a control it is then a
compartment client plus a drag — no geometry rewritten, because the drawing already asks a resolver
instead of reading a constant. ⚠️ And copy **Dorico's shape for the slant: two independent endpoint Y
deltas, not an `angle` field.** An angle would have to name a pivot; the two ends are what the user
actually grabs, and it is why changing only the start does nothing there.

**Derived, stored nowhere (layout).** The line's y itself, the wedge's pixel endpoints, where it
splits at a system break, and the gap it leaves before a neighbouring mark. This is why P0 is a
**pure function** whose output nobody persists and which never reaches JSON: the line is a view over
the last render, in the same family as `measureColumns` and `pageCastOff`.

**⚠️ The one that needs care: "move the line" (§4, level 2).** That *is* authored presentation, so it
belongs in the compartment — but it must not be keyed by *system*, because which bars share a system
is itself a layout result that changes on every edit and resize. That is the exact dependency the
open boundary case in DESIGN-PRINCIPLES warns about. ⭐ **The house pattern already exists**: the
per-system staff-spacing override (client #7) keys on `staffSystemSpacingKey(staffId,
openingMeasureId)` — the staff's durable id joined to the durable id of the measure that **opens**
the system. An entry whose anchor measure no longer opens a system is simply never looked up
(self-healing, no stored layout index). A dynamics-line offset copies that key, plus `placement`.

**⛔ What none of this may become:** a `y` on `Hairpin` or `Dynamic`, a stored break point, or a
"the line is at 42px" cached in the score. If a value cannot be re-derived from the content plus the
current render, it is either an override with a durable anchor or it does not exist.

### 6a. 🔎 Sorted against all six principles, not only §3

The section above answered principle 3 thoroughly and left the other five unasked. Read against
`docs/DESIGN-PRINCIPLES.md`, two of them change what gets built and one BLOCKS a piece of §4.

**1 — a score is a value, not a singleton.** ⛔ The line module holds no state between renders: no
module-level `Map` memoising a system's y, no "the current line". It is a pure function called with
the render's own inputs, thrown away after. (Any lookup table it wants — a padding table keyed by
what sits on the line — is SCREAMING_SNAKE, or `scripts/check-singletons.mjs` reads it as new mutable
state and fails `build:check`.)

**2 — position-independent material is first-class.** ⭐ **This makes the clip work mandatory, not
optional.** A hairpin is part of a passage; `Clip` (`utils/clip.ts`) already carries `ClipDynamic[]`
for exactly that reason. Copying four bars and pasting them without their hairpins would be a feature
that operates on bar-anchored data while conceptually operating on a run of music — the *forbidden*
clause of principle 2, word for word. So `ClipHairpin` travels with the clip, offset-relative like a
clip dynamic; the only thing left open (§11.9) is what a hairpin STRADDLING the window does.

**3 — content and presentation are separate.** Answered above. Held.

**4 — staves are composable (1..N).** `staffId` on the model, `staffHairpins` in the lane (§5), one
line per `(system, STAFF, placement)`, and the keyboard-between-staves case a deferred *value* of
that key rather than a special case bolted on. ⛔ Nothing may assume staff 0.

**5 — the score is independent of the editor.** ⭐⭐ **The plan's P2 says "the engine ops (add /
remove / set length)", and "the engine" must not mean `MusicEngine`.** Adding, removing and
re-lengthening a hairpin are SCORE operations — they belong in the score layer
(`engine/models/hairpinOps.ts`, in the style of `clefOps` / `markOps` / `voiceOps`), reachable with
no renderer and no DOM, with at most a one-line delegation on `MusicEngine`. Principle 5 names this
exact failure as the mundane one: *someone adds it to `MusicEngine` because that is where the menu
action lands. It works, ships, and is invisible.* CLAUDE.md's rule says the same thing from the other
side.

🔎 A pleasant consequence of dropping the ghost (§8): with no `ToolGhost` member and no
`GHOST_DRAWERS` row, this feature never touches the engine↔editor vocabulary seam
(`engine/rendering/ghostTypes.ts` ⇄ `interactions/toolGhost.ts`) at all. One fewer arrow to get
backwards.

**6 — a statement that can change mid-score is positional.** The hairpin is positional by
construction (§2.3, §5), and "move the line" per system is keyed by the durable
`staffSystemSpacingKey`-shaped anchor rather than by a layout index (§6).

⛔ **But §4's third flavour — "move the line … per SCORE" — is BLOCKED, and not by this plan.** A
document-wide dynamics-line padding is a document-wide *engraving* setting, which is DESIGN-PRINCIPLES'
still-OPEN boundary case #1. That entry has two members already (the surface, and `justifyLastLine`)
and says in as many words: *"Do not add a second document-wide look setting without settling this;
two of them arriving by different routes is how the compartment stops meaning anything"* — with a ⛔
noting the warning stands unchanged for a THIRD. So: per-system and per-staff are ours to build when
wanted; **score-wide waits for the engraving object**, and this plan must not quietly become the
third route.

## 7. Rendering

`docs/ARCHITECTURE.md` §"Adding a new engraved element" asks a new drawn thing **three** questions,
and warns that every wrong answer is silent. 🔎 The first draft of this section answered two.

- **1. Does it take horizontal space? No.** That section answers it outright: *"An accidental does. A
  hairpin does not."*
- **2. Does it change how the bar LOOKS?** 🔎 **This is not optional and not skippable.** The section
  above first said an own pass "keeps hairpins out of `MeasureRedrawKey` entirely — they never need a
  shape-key row". The compiler disagrees: `MEASURE_RENDER_ROLE` is a `Record<keyof Measure, …>`
  (`measureRenderRoles.ts`), so adding `Measure.hairpins` **stops that file compiling** until it is
  classified, stops `measureRenderRoles.test.ts`'s `PERTURB` record compiling until it is perturbed,
  and the test then checks the claim is TRUE. The `dynamics` row reads, verbatim: *"Drawn, weightless.
  The canonical 'shape only' element — **copy this row for a hairpin**."* `'ignored'` is defensible
  ONLY if nothing hairpin-related is ever drawn inside a measure's `<g>`; the house rule when unsure
  is the one that file states — *include it; correct-and-slow is recoverable, a stale picture is
  not.* Decide it in §11.8, do not inherit it by omission.
- **3. Does it SPAN bars? YES — so it must be a span anchor.** 🔎 Missing entirely from the first
  draft, and `measureRenderRoles.ts:32` is explicit that **the compiler cannot catch this one**
  (spans live on `Score`, hairpins will not). Both endpoint bars must be added to
  `VexFlowRenderer.spanAnchors`, or two things break: a bar that merely MOVED is translated rather
  than re-engraved and its VexFlow objects keep their stale drawn coordinates
  (`VexFlowRenderer.replaySnapshot`), and under culling the endpoint bar's `<g>` is deleted outright
  so the wedge draws detached or vanishes on scroll. Ties and slurs are already in there for exactly
  this. (⚠️ It also feeds `forcedSpanGroups`, which is what drags an off-screen anchor back into the
  drawn set for a span crossing the window.)
- **Its own pass**, after the measures, like `renderSlurs(pass, score)`.
- 🔎 **The stroke is 0.16 staff spaces — the thin-line weight we already draw with** (§2.4a), not a
  new constant. ⚠️ In *staff spaces*, so it scales inside a small staff's `scale(k)` group like
  everything else drawn there, and ⚠️ it is a hairline: the half-pixel rule applies
  (`reference_thin_lines_need_half_pixel_offset` — a hairline straddling two pixel rows looks fat),
  which is the same defence `barlineInk` already runs for the editor audience and skips for print.
- **System breaks.** `SlurRenderer` already owns a segment planner and the system-margin helpers
  (`planSlurSegments`, the left/right margin lookups); a hairpin wants the same idea, with the mouth
  continuing at the width it left off. A four-bar crescendo *will* cross a break in ordinary use, so
  this is not a deferrable nicety for long spans — see the phasing in §10.
- **Selection.** A fifteenth `SelectedElement` kind, one module in `interactions/elements/`, a row in
  `ELEMENT_SPECS` and a position in `ELEMENT_HIT_ORDER`, plus registry `points` for a proximity hit
  test — the slur's pattern exactly (`elements/slur.ts`, `distToSegment`).

**⚠️ THE OPEN FORK (§11.1).** Once dynamics read the line, a mark's y becomes a fact about its
**system**, not about its bar: a low note in bar 3 moves bar 1's `p`. Today dynamics are drawn inside
the measure group and `MeasureRedrawKey` answers "does this bar still look the same" from the bar's
own content. So either

- **(a)** the line's y goes **into the shape key** of every measure in the system, or
- **(b)** dynamics move **out of the measure group** into a system-level pass, as slurs already are, or
- **(c)** 🔎 **the marks stay exactly where they are and a post-measure system pass TRANSLATES them
  onto the line.**

🔎 **(c) was missing, and it is the cheap one — because it is what the code already does twice.**
`layoutCoLocatedDynamics` and `applyDynamicOffsets` (`DynamicsLayout.ts:93`, `:242`) both move a
rendered mark by writing a `translate(...)` on its `<g>` and calling `elementRegistry.shiftById` so
hit-testing follows. A line pass is the same move with a different number, run once per
`(system, staff, placement)` after every bar is standing. Everything downstream keeps working
unchanged: the mark is still a VexFlow `Annotation`, still registered from its rendered SVG, so the
text-edit overlay (§3), the selection hit-box and the dashed anchor line all follow for free.

⚠️ **Its one condition:** the transform must be recomputed **absolutely** each render — composed from
(co-location + offset + line) into one `translate` — not PREPENDED to whatever is already on the
element. Prepending is safe today only because those two passes run on a freshly drawn group; a
REUSED measure's mark still carries last render's transform, and prepending to it accumulates.

🔎 **And (b) has a cost the first draft did not price.** With dynamics out of the measure group their
x must come from the anchor `StaveNote` — whose coordinates are stale for any bar that was
*translated* rather than re-engraved. That makes **every dynamic-bearing bar a span anchor**, i.e. no
longer translatable: the exact optimisation that measured at 53% of all render time. (b) is still the
cleaner end state and the same shape the hairpin wants; it is not the cheap first step, and P1 does
not have to be the phase that pays for it. **Recommended: (c) for P1, with (b) left open as the end
state** — the hairpin's own pass is system-level from day one either way.

---

## 8. UX

⭐ **The ATTACHMENT GUIDE (added 2026-08-17, his call).** A selected wedge draws the dashed line to
where it is anchored — the fourth kind on the kind-agnostic guide (`docs/dynamic-offset-plan.md`),
and the first SPAN, which is what turned that mechanism's single point-pair into a list of lines.
Two edits, as the rule promises: `drawHairpins` registers the guide on the FIRST fragment, and the
`hairpin` row in `ELEMENT_SPECS` calls `applyAnchorGuideLine`.

⛔ **At the BEGINNING only — his call**, where MuseScore draws one line per END of a spanner
(`LineSegment::gripAnchorLines`). A wedge's extent is already visible as ink; what the guide adds is
where the gesture is ANCHORED. ⚠️ Its far end is a PLACE (the staff's bottom line at the start beat),
not a note — a hairpin governs a region, exactly as the tempo mark does and unlike the trill, whose
auxiliary is computed from its note's pitch.

Following the slur, which is already routed this way (`PaletteController.createSlur`, `171b1bb`):

- **Two rows in the Lines palette** — open (cresc.) and close (dim.). It is a TABLE whose own header
  already names the hairpin as its next row (`dev/linePalette.ts`), so this is two rows and no
  `devToolbar` slice. Each row's `press` calls a `PaletteController` method that the key also calls,
  so the palette reimplements nothing.
- **THE KEYS, Sibelius's, and they are free.** 🔎 Written out so there is nothing to infer:

  | key | in `ShortcutConfig` | action | means |
  |---|---|---|---|
  | `H` | `'h'` | `createCrescendo` | the OPEN wedge (cresc.) |
  | `Shift+H` | `'Shift+h'` | `createDiminuendo` | the CLOSE wedge (dim.) |

  ⚠️ Lowercase in the table on purpose: the shortcut manager lowercases single keys, which is why the
  rest-hide entry is spelled `'Ctrl+Shift+h'` (`ShortcutConfig.ts:449`). Checked against the whole
  config — `Ctrl+Shift+h` is the **only** `h` binding that exists; `a`–`g` and `Shift+a`–`g` are note
  and chord entry, and `h` sits just outside that block.
- **Each key routes three ways, `createSlur`'s split exactly** (`PaletteController.createSlur`): a
  re-press of the armed stamp **disarms**; notes selected → **create** over that range (start = the
  first selected note's address, length = to the end of the last one's slot); nothing selected →
  **arm the stamp**. Two methods, not one with a flag, so each palette row and each key is one call.
- 🔎 **NO GHOST — the blue pointer, like the slur.** (His call, 2026-08-12; the first draft argued for
  a real wedge preview because a hairpin, unlike a slur, has a previewable shape.) So there is **no**
  `ToolGhost` member and **no** `GHOST_DRAWERS` row, and the hairpin **joins** `scoreCursorClass`'s
  ghostless list beside `slur` / `dynamicEntry` / `tempoEntry`. It also fits their stated reason: a
  wedge is drawn BETWEEN two points and the click has only picked one, so a ghost wedge at the
  pointer would be previewing a length the click is not going to make. `MARKING_TOOL_USES_ARMED_LENGTH`
  still gets its row — `false`, for the slur's reason.
- **The stamp's click** — open, see §11.4.
- 🔎 **EXTENDING is IN, in P4** (his call, 2026-08-12 — the first draft deferred it). It is what makes
  the stamp usable at all: one click can only make a one-slot wedge, which is shorter than the
  minimum length a wedge reads at (§2.4), so a stamp with no way to lengthen what it placed is a door
  that opens onto nothing. **`Ctrl+→` lengthens the selected hairpin by one slot, `Ctrl+←` shortens
  it** — Sibelius spells this Space, but we already have the gesture: `ctrlArrowRight` /
  `ctrlArrowLeft` are SINGLE actions routed by what is selected (`ShortcutConfig.ts:154`), which the
  slur endpoint, the dynamic and the bar width already share. So a selected hairpin joins that
  dispatch and needs no key of its own.

  ⚠️ **On a hairpin that key changes `length` ON THE MODEL** — it does not write a cosmetic offset,
  which is what the same key does on a slur endpoint one branch over. That is §4's rule (time comes
  from the address, engraving from the compartment), and one key carrying both categories is exactly
  where it would get broken. `Ctrl+Backspace` (`resetMove`) therefore does **not** apply to a
  hairpin's length: there is nothing to reset, because nothing cosmetic was written.

---

## 9. Playback

**Out of scope for v1** — notation only, the precedent slurs set.

What it would take, recorded so the shape is known: `resolveChordLevels()` (`utils/dynamics.ts`)
returns `Map<chordId, DynamicLevel>` — an **enum**, so there is no room in it for a ramp. A real
crescendo means that map becoming a numeric value and interpolating from the level at the start
to the dynamic that follows the end (or one step up when nothing follows). That is a genuine change
to the resolution pass, not a slice on top of it.

📄 **And what the ramp should be a ramp OF is now written down: `docs/playback-semantics-plan.md`**
(2026-08-19, ⛔ recorded, not scheduled). Two things from it that bound this section:

- ⭐ The number is a **musical dynamic value in [0, 1]** (0 = niente, 1 = the loudest possible), not a
  synth velocity — the conversion belongs to an INTERPRET step after the schedule. So §9's "numeric
  velocity" is half the change; the other half is where the number stops being the music's.
- ⭐⭐ **A crescendo is not one sound.** On a sustaining instrument it is a ramp DURING each note; on a
  decaying one (piano, harp, pizz) it can only be each successive ATTACK louder, and over a single
  long note it is unplayable — ⛔ which the renderer must not fake. Which of the two applies is the
  interpret step's to know, not this pass's.

---

## 10. Phases

Each is separately visible and separately testable.

- **P0 — the line as a pure function. ✅ BUILT.** Its own module — `engine/layout/dynamicsLine.ts`, beside the
  other derived-view arithmetic. In, the system's ink + the staff's ratio; out, one baseline y per
  `(system, staff, placement)`. Unit-testable without a renderer, and 🔎 **its input already exists,
  which the first draft did not know**: `MeasurePlacement.system.columns` is `measureColumns(...)`
  (`VexFlowRenderer.ts:1409`), a per-column list of located `InkBox`es carrying `top`/`bottom` **in
  staff spaces below the top stave line, tagged per staff** — noteheads, ledgers, dots, accidentals,
  stems and flags. The line is `max(bottom)` over the boxes of one `(line, staffIndex)`, plus padding,
  floored at a minimum. Pure, pre-draw, already on the right axis for a small staff, and no new
  measurement. (⚠️ It does not cover articulations, beams or tuplet brackets; if those need to push
  the line, they are ROWS in that ink model — not a second extent computed here.) The *ink heights of
  the letters* still need the browser and stay in the e2e suite. Nothing reads it yet.

  🔎 **Two things the build found.** (i) ⭐ **The staff's RATIO is NOT an input** — this bullet asked
  for one and it would be a bug: an `InkBox`'s band is deliberately unscaled (`kerning.ts`) and the
  mark is drawn *inside* the staff's `scale(k)` group, so everything is already in one staff's own
  spaces and a ratio would land a small staff's line twice-scaled. (ii) ⚠️⚠️ **A box's `staff` is
  `undefined` for the FIRST staff even when the score has staff ids** — `slotInk` copies
  `slot.staffId`, and adding a staff *below* does not stamp the existing music (only a prepend does,
  `solidifyFirstStaffContent`). So both sides are normalised through the first staff's id, exactly as
  `models/staffContent.matchesStaff` does; comparing strictly — as `kerning.sameBand` does — hands
  the upper staff of a grand staff an empty band and its dynamics the floor.
- **P1 — dynamics read the line. ✅ BUILT** — `rendering/dynamicsLinePass.ts` (the system pass) +
  `rendering/dynamicMarkTransform.ts` (who owns the mark's `translate`), specs for both, and
  `e2e/dynamicsLine.e2e.ts` for the drawn geometry. §11.1 answered **(c)**.

  🔎 **The one thing the build added to the plan: a transform OWNER.** (c) makes three passes move
  the same `<g>` — the co-located row, the hand nudge and now the line — and the line pass is the
  first that runs over bars it did not draw. `applyDynamicOffsets` used to PREPEND to whatever
  attribute it found, which is safe only on a freshly drawn group; on a reused one it would add a
  line's worth of drop per render and drag the registry box with it. So the components are kept
  (on the element, the one thing that survives a render it took no part in) and the transform is
  recomposed from them — which is the plan's ⚠️ in §7, and it makes the pass idempotent.

  🔎 **Two more things his testing changed** (both above): the deviation became **LOCAL** (§3), and
  the **x** rule arrived — a level is centred on its notehead (§3a). Plus the four editor-overlay
  fixes the line's y exposed (§3).

  Visible change: letters and words line up per system — and 🔎 on
  high passages they move OUT of the staff, which is the §2.2 defect being fixed, not a regression.
  This is where §11.1 is decided (recommendation now **(c)**, §7) and where the hand-testing matters,
  because it touches something that already works. Offsets keep working, now measured from the line
  (§3a). 🔎 Also here: drop `layoutCoLocatedDynamics`' vertical centring, which is what makes
  `p dolce` share a baseline instead of a centre (§3a).
- **P2 — the model. ✅ BUILT.** `Measure.hairpins`, the ops (add / remove / set length / toggle /
  update) in the SCORE layer — `engine/models/hairpinOps.ts` + its spec, with thin delegators on
  `ScoreModel` and a commit-only facade on `MusicEngine` (§6a, principle 5). All four seams joined:
  `MEASURE_RENDER_ROLE` + `PERTURB` + the shape key itself, `staffHairpins` in `staffContent` **and
  named in `staffMeasureView`**, `clearMeasureForRebar` + `captureBeatAnchors`/`restoreBeatAnchors`,
  and `ClipHairpin` + copy/paste. JSON round-trips for free (a `Fraction` is `{num,den}`). Nothing
  is drawn.

  🔎 **Five things the build settled or turned up.**
  (i) **§11.2 as recommended** — start + `length` on the start measure, which is also how he
  described it unprompted (*"the point where the hairpin starts is where that note is… the extension
  is to the next note"*), i.e. a position plus an amount of music. That his description and the
  recommendation are the same object is the useful fact: the alternative (two note ids, like a slur)
  is the one nobody reaches for by instinct.
  (ii) **§11.8 `'shape'`**, and it is now enforced twice — the role row AND a real entry in
  `measureShapeKey` (`view.hairpins`), because the role table only *claims* a classification and the
  `PERTURB` test checks the claim is true.
  (iii) **§11.9 dropped, with an edge the question did not have**: enclosure is `start >= spanStart`
  AND `end <= spanEnd` — the END test is INCLUSIVE where the start's is half-open. A wedge finishing
  exactly on the last copied beat is enclosed; a *mark* at `spanEnd` sits on the first beat not
  copied. Same asymmetry, two different right answers.
  (iv) ⭐ **A non-positive `length` is REFUSED, never clamped and never destructive.** `addHairpin`
  returns null; `setHairpinLength` returns false and leaves the wedge as it was. Shortening past
  nothing must not delete the thing being shortened — that is `removeHairpin`'s job, and P4's
  `Ctrl+←` inherits the guarantee rather than having to implement it.
  (v) ⛔ **No hairpin-keyed override TYPE was added** — the plan's P2 bullet said "incl. the id-keyed
  override", but nothing writes one yet and a field with no writer is a field that gets believed.
  What IS built is the two sites it needs: `removeHairpin` clears the whole id (so an override can
  never orphan), and `restoreBeatAnchors` carries a ⚠️ naming itself as the re-stamp site, next to
  the dynamic's, for the day the aperture or the vertical nudge arrives (§6).
- **P3 — draw it. ✅ BUILT.** `rendering/HairpinRenderer.ts` (the pass) + `rendering/hairpinShape.ts`
  (the resolver) + `rendering/thinLineWeight.ts` (the shared 0.16) + `models/hairpinOps.hairpinSpan`
  (beat+length → two addresses) + `layout/dynamicsLine.columnsBetween`/`mergeInkBands` (the
  spanner's wider slice), specs for each, and `e2e/hairpin.e2e.ts` for the drawn geometry. Both
  endpoint bars are in `spanAnchors`.

  🔎 **Five things the build settled or corrected.**
  (i) ⭐⭐ **The plan was WRONG about the system break** — it said the continuation resumes at the
  width it left off; three engines say it STEPS. Built to LilyPond's and Verovio's identical thirds
  (§2.4b), and the e2e pins the step rather than the continuity.
  (ii) ⭐⭐ **The short-wedge rule is Verovio's 16° ANGLE CAP**, not a gradient invented here — and
  the reason we need one at all is that LilyPond's answer (lengthen the wedge with a spacing `Rod`)
  is unavailable to us: our length is musical (§2.4b).
  (iii) ⚠️ **The x source is `staveNoteMap`, not the registry** — the plan recommended the registry
  because a translated bar's `StaveNote`s hold stale coordinates. Being a `spanAnchor` already
  forbids translating those bars, so the slur's own road works and there is no second one to
  maintain. The plan's warning about `CoordinateMapper.beatToPixelX` stands and is obeyed.
  (iv) ⭐ **A fragment's stave, line and staff-space size are facts about ITS system, not about
  where the wedge began.** Drawing every piece against the start bar's stave put the continuation on
  top of the first system — caught by the browser suite, invisible to every unit test, and the
  reason `WedgePiece` carries a `line`.
  (v) ⭐ `planSlurSegments` is REUSED verbatim: nothing in it is about slurs, and its four segment
  types map one-to-one onto a fragment's role. No second planner to drift out of step.
  (vi) 🚨🚨 **TWO X'S FROM TWO SYSTEMS ARE NOT ONE RULER** — his report, fixed 2026-08-15. A wedge
  from the last bar of one system to the first bar of the next has `endX < startX`, because every
  system restarts at the left margin. The "never past each other" rescue (`if (endX <= startX)`,
  which keeps a wedge squeezed by its neighbours from turning inside out) fired on that perfectly
  well-formed span and replaced the end with a number from the START system. The continuation was
  then drawn from the left margin out to that foreign x — most of the second system — and, with the
  two ends left ~1 space apart, the angle cap crushed the aperture to nothing, so **both** fragments
  drew as flat lines. One cause, two symptoms. The rescue now asks `from.line === to.line` first,
  each end insets against its OWN stave, and the length feeding the aperture rule is the **sum of
  the fragments actually drawn** rather than a subtraction across a break — which is why the pieces
  are cut *before* the shape is resolved. ⚠️ The browser suite already crossed a break and passed
  through this for weeks: its fixture starts in bar 1, where `startX` is the smaller number anyway.
  **Luck of geometry** — the regression test starts in the LAST bar of a system and was break-tested
  against the old code.
- **P4 — the UX. ✅ BUILT.** Two Lines-palette rows (Cresc./Dim.), `H` / `Shift+H`,
  selection→create, the stamp (`interactions/hairpinStamp.ts`, **no ghost** — the blue pointer),
  `Ctrl+←/→` resize (**moved to `Ctrl+Shift+←/→` on 2026-08-17** — see the end of this file),
  selection + highlight + Delete, the Properties report, and 🔎 **`x` to flip
  cresc. ↔ dim.** (his call, 2026-08-12 — added after the phase, when `toggleHairpinType` turned out
  to be model API with no way to reach it). ⚠️ It is the one branch of that key that changes what a
  mark MEANS rather than which SIDE of the staff it sits on; a hairpin's side is `placement`, shared
  with every dynamic on its line, and `<` vs `>` is the only thing about a wedge worth one key. The fifteenth
  `SelectedElement` kind, `interactions/elements/hairpin.ts`, rows in `ELEMENT_SPECS` and
  `ELEMENT_HIT_ORDER`, a `MARKING_TOOL_USES_ARMED_LENGTH` row, `hairpinGroupMap` +
  `getHairpinSVGGroup`, and `PaletteController.hairpin.test.ts` for the routing.

  🔎 **⭐⭐ §11.4 IS SETTLED — but NOT the way the plan sketched it, and HIS TESTING is why.** The
  plan said one click makes "this note → the end of the next slot". Built literally, selecting a
  whole-note E and pressing `H` drew a wedge running to the far edge of the F after it. His report:
  *"the hairpin extends till the end of F… what is expected for me is that it end when the F
  starts."* **The rule is now: a wedge covers EXACTLY the music selected — never a note more.** One
  note → that note, ending where the next begins. It is what a hairpin means: the wedge is the
  approach, and the note you arrive on is where the new level is reached, not part of the climb.
  ⛔ The plan's version was reasoned from minimum-length (a wedge over one quarter is short) — but
  the answer to a short wedge is the ANGLE CAP (§2.4b), never silently covering music nobody
  selected. `Ctrl+→` is how a wedge grows, and it should be the only thing that does.

  🔎 **Three smaller build notes.** (i) The stamp carries its TYPE (`{ kind:'hairpin'; type }`)
  where the slur's carries nothing — two keys, two palette rows that must light independently, and
  pressing `H` with the dim. stamp armed must SWITCH rather than disarm. That is why
  `createCrescendo`/`createDiminuendo` are two methods and not one with a flag. (ii) the resize
  (`Ctrl+←/→` then, `Ctrl+Shift+←/→` now) steps by a SLOT of the hairpin's own lane, so the end always lands on a notehead; it DECLINES
  rather than deleting when it cannot shrink further. (iii) Arming needs no engine, so the engine is
  fetched in the create branch only — guarding at the top made the tool unarmable in any context
  without one, and said wrongly that arming depends on a score.

**Later, not in this plan:** move-the-line as a user control (§4 — and its score-wide flavour is
BLOCKED, §6a), 🔎 **the aperture and the slant as user controls** (§6 — not built, but the resolver
in P3 is what keeps them a small addition), the `cresc.`-with-dashes style, niente, the playback ramp, per-voice lines, and the
vocal-above / keyboard-between-staves placement variants.

---

## 11. Open decisions

Nothing is built until these have his word. 🔎 **5 and the ghost are SETTLED** (2026-08-12) and kept
here struck through, so the answer travels with the question; 1 and 4 have moved on.

1. ~~**§7's fork**~~ — 🔎 **SETTLED by P1 (2026-08-12): (c)**, built as recommended. **(b)** stays the
   end state and is still unpaid for; the hairpin's own pass is system-level from day one either way.
   The question as it stood: 🔎 now a THREE-way, and the recommendation changed: **(c)** a post-measure system
   pass that TRANSLATES the existing annotations onto the line (cheap, reuses what
   `layoutCoLocatedDynamics` / `applyDynamicOffsets` already do, keeps the overlay + hit-testing
   working), with **(b)** — dynamics become ink in a system-level pass — left open as the end state.
   **(a)** the line's y in every measure's shape key is still available and still the blunt one.
2. ~~**The model** — start + length on the measure (recommended, §5), or the score-level spanner?~~
   🔎 **SETTLED by P2 (2026-08-12): start + length**, as recommended and as he described it in his
   own words. See P2's note (i).
3. ~~**v1 scope** — notation only, no playback ramp (recommended)?~~ 🔎 **SETTLED: notation only.**
   Nothing in P2 touches `resolveChordLevels`; §9 still records what a ramp would cost.
4. ~~**The stamp's click** — a hairpin needs a span, so what does one click mean?~~ 🔎 **SETTLED by
   P4 and HIS TESTING (2026-08-12): the clicked note, and nothing more.** The recommendation here
   (*"this note → the end of the next slot"*) was BUILT and REJECTED on sight — see P4's note. Two
   clicks or a drag remain available and are still unneeded.
5. ~~**Keys** — `h` / `Shift+H` as Sibelius, and two rows in the Lines palette?~~ 🔎 **YES, both**
   (2026-08-12) — spelled out in §8's table, and verified free in `ShortcutConfig`.
   ~~**The ghost** — a real wedge at the pointer?~~ 🔎 **NO** (2026-08-12) — the blue pointer, like
   the slur. No `ToolGhost` member, no `GHOST_DRAWERS` row.
6. ~~**Default placement** — always `below` with a flip, or infer per staff kind?~~ 🔎 **SETTLED by
   P2: `below` by default**, exactly as `Dynamic` — absent means below, and `above` is a legal value
   from day one. Inferring per staff kind (vocal above, keyboard between) stays a later *value* of
   the same field, not a new rule.
7. **`cresc.` as text.** Musically it is the same object as the wedge, and every model treats the
   dashed-word form as an *appearance* of the gradual dynamic rather than free text. Do we want
   `style: 'wedge' | 'text'` on the hairpin later? ⛔ Either way, do **not** retro-interpret
   expression text that is already typed in a score — report, never repair; no migration.

🔎 Three the code check opened:

8. ~~**The `MEASURE_RENDER_ROLE` row** (§7) — `'shape'` or `'ignored'`?~~ 🔎 **SETTLED by P2:
   `'shape'`**, plus the matching `view.hairpins` entry in `measureShapeKey` — the role table only
   states a claim, and the `PERTURB` test then checks the claim is TRUE, so the row alone would have
   failed. ⚠️ It covers only the bar the wedge STARTS in; the far end is `spanAnchors`' job in P3.
9. ~~**A hairpin STRADDLING a copy window** — dropped or truncated?~~ 🔎 **SETTLED by P2: dropped**,
   matching dynamics and slurs. See P2's note (iii) for the inclusive-end edge the question missed.
10. **The suppressed-mark skyline source** (§3) — the last registered bbox (recommended), the
    overlay's rect through the inverse CTM, or freeze the wedge's end while an edit is open?
    🔎 **Still open after P3, and now it has a visible symptom to weigh it against**: the skyline is
    built from the letters as DRAWN, and a mark being text-edited is not drawn — so the wedge grows
    by one glyph's width while you type into the mark it stops against, and snaps back when you
    finish. Recorded in `HairpinRenderer.markInkX`. It is a small, self-correcting wobble, which is
    an argument for leaving it until someone is annoyed by it.

---

## 12. Later: the line is one rung of a LADDER (not in this plan)

His question, and the answer is yes — worth reconsidering once the bottom line exists.

The dynamics line is the **below-staff** rung. Above the staff every program keeps an equivalent
structure, but it is a **stack of rungs in a fixed order**, not one line — because far more kinds of
thing live up there. LilyPond states it as a number: every outside-staff grob carries an
`outside-staff-priority`, and they are placed outward in priority order, each pushed clear of what is
already there. Its own ordering, from the staff outward, is roughly: ornament/trill spanners →
octave (8va) brackets → text spanners → technique and expression text → volta brackets → metronome
marks → rehearsal marks. Dorico exposes the same thing as a configurable *vertical order of items
above the staff*; Sibelius as per-type default positions plus magnetic layout; **Finale calls them
baselines outright** — per staff, per system, one for lyrics, one for expressions, one for chords.

So the general shape is: **for a `(system, staff, side)` there is an ordered ladder of rows, and each
family occupies one rung.** The dynamics line is that structure with one rung and one member.

⚠️ **We already have a second family placed above the staff with no shared rule: tempo marks**
(`rendering/TempoLayout.ts`). Rehearsal marks, 8va brackets, technique text (the open Alt+T item) and
trill spanners would each add another, and each one placed on its own is another private vertical
rule to reconcile later — the "two settings arriving by two routes" failure that
`DESIGN-PRINCIPLES.md` warns about in its open boundary case.

**What that means for this plan: nothing to build, one thing to not preclude.** The line is already
keyed by `(system, staff, placement)`, so *above* is a legal value of the key on day one — a vocal
score's dynamics use the same rung machinery flipped. What is missing, and stays missing
deliberately, is the **ordering among families** on a side. Do not fold tempo marks into this work;
do keep the line's module free of the assumption that its side has exactly one rung, so the ladder is
a generalisation of it rather than a replacement for it.

---

## 13. Where this stands, and what is left

**Parked here deliberately** (his call, 2026-08-12): *"we can leave the hairpin like this for now —
more things will be added in the future but we don't need to think about it now."* Nothing below is
blocking; this section exists so none of it has to be re-derived.

### 13.1 The numbers, and which of them his eye has now settled

All are constants in `rendering/hairpinShape.ts`. **Most of this table was settled on 2026-08-15**
(§2.4d) — recorded so nobody re-opens a decision he already made against a screen.

| what | ours | status |
|---|---|---|
| stroke | **0.16 sp**, the shared thin-line weight (`thinLineWeight.ts`) | ✅ **SETTLED, against all four engines.** 0.10 → *"too thin"*; 0.12 → *"the size of the beguining"*. ⛔ Do not retry |
| aperture, ordinary | **1.5 sp** | ✅ **SETTLED** — *"very good"* at 15.5 spaces, *"good"* at 35.5. The field says 1.33; we knowingly differ |
| aperture, long wedges | ramp from **36 sp** at **0.012/sp** | ⚠️ **PROVISIONAL** — *"not sure if this is the definite rule… much better than before, and for the moment is ok"*. Taste numbers fitted to seven cases he judged; no source for either |
| aperture, ceiling | **2.0 sp** | ✅ **PUBLISHED** — Gould p.103, *"should not be more than two stave-spaces wide"*. The only number here an authority states |
| steepness cap | **11.5°** | ⚠️ Was Verovio's 16°; his eye twice. Lands on Dorico's 1-space minimum by a different route |
| air between two abutting wedges | `END_INSET` 0.25 sp per end → **0.5 sp** total | ⏭️ **STILL OPEN.** Dorico leaves a **notehead width** (~1.18 sp) — so ours may be too tight (§2.4c) |

### 13.2 Paths NOT hand-tested

Everything in the list has unit or browser coverage; what none of it has is his eye. Recorded
because the automated suites cannot see a bad-looking result, only a changed one:

- a hairpin on the **second staff**, and one in **voice 2**
- **copy/paste** of a passage containing one (the clip carries it; the enclosure rule is
  fully-inside-only)
- a **meter change** over one (the rebar seam re-anchors it and re-mints its id)
- **undo/redo** of create / resize / flip / delete
- **PDF export** — the wedge is stroked in the render pass, and print takes a different audience
  path (it keeps the true 0.16 where the editor hints its barlines)

### 13.3 The one open decision

**§11.10, the suppressed-mark skyline.** A wedge stops short of the letter it runs into by reading
that letter's DRAWN ink — and a mark being text-edited is not drawn, so the wedge grows by about a
glyph's width while you type into it and snaps back when you finish. Small and self-correcting. The
fix is the recommended one: keep the mark's last registered bbox, which needs the previous render's
snapshot threaded into the pass.

### 13.4 Deferred, with what is now known about each

- **The aperture and the slant as user controls** — the resolver (`resolveHairpinShape`) exists
  precisely so this is a compartment client plus a drag, with no geometry rewritten (§6). Two
  endpoint deltas, never an `angle` field.
- **Move the line** per system / per staff — the key shape is `staffSystemSpacingKey`'s (§6). ⛔ Its
  score-wide flavour stays BLOCKED by DESIGN-PRINCIPLES' open boundary case, not by this plan.
- **`cresc.` / `dim.` as dashed text** (§11.7) — and §2.4c now gives the rule for WHEN: wedges for no
  more than a couple of bars, text beyond, *"because an extended hairpin is almost, but not quite,
  parallel to the staff lines."*
- **Niente** (the circled tip) — Gould p. 108 per MEI's citation.
- **The playback ramp** (§9) — needs `resolveChordLevels` to return a number rather than an enum;
  a genuine change to the resolution pass, not a slice on it. 📄 What KIND of number, and why a piano
  and a violin cannot share one realisation: `docs/playback-semantics-plan.md`.
- **Per-voice lines**, and the **vocal-above / keyboard-between** placements — both are values of the
  line's existing `(system, staff, placement)` key rather than new machinery (§12).

### 13.5 The research gap that remains

**Ted Ross (1970) and Kurt Stone (1980) were not obtained** — the Internet Archive copies are
lending-only. Everything else in §2.4b and §2.4c was read. ⛔ Nothing built depends on them: every
number in the code carries a source.


## 2026-08-17 — the wedge grows two ends, and the resize moves off `Ctrl+←/→`

Two of his asks, and the second follows from the first.

**The ends.** A selected hairpin now draws a blue square at each end of the wedge, stepped outward
along the span so the shape reads between them, and either one can be picked — by clicking it or with
Tab / Shift+Tab, which walks the handles of whatever is selected (a slur's, or these). One module
owns all of it: `interactions/elements/hairpinHandles.ts` — where they sit (the fragment's edge at
the midpoint between the two arms, ⚠️ the two ends coming from DIFFERENT registry entries on a split
wedge), what a press on one does, and the walk order. The press is a PRE-STEP in `MouseController`
rather than a row in `ELEMENT_HIT_ORDER`, because a square can land inside the box of the dynamic at
the wedge's mouth and `DYNAMIC_ELEMENT` runs ahead of `HAIRPIN_ELEMENT`: a handle you can see must win
the press over the glyph it happens to sit on.

⛔ An armed end still edits NOTHING by itself. The selection (`selectedElement.hairpin.endpoint`) is
what exists; §4's rule stands, so there is no cosmetic offset behind it.

**The resize.** It rides **`Ctrl+Shift+←/→`**, and only while the RIGHT-HAND square is armed.

- The CHORD comes from the slur, where `Ctrl+Shift+←/→` already means "stop nudging, move the
  anchor" (`interactions/slurReanchor.ts`). Resizing a wedge is the same sentence about the other
  kind of spanner, so it is the same key — the widest step on the horizontal, above the ¼-space plain
  arrows and the 1-space `Ctrl` pair.
- The GATE is what the two new squares make possible, and it fixes something that was wrong before
  them: on the bare `Ctrl+←/→` with no gate, a selected wedge ate that chord outright. Now the key
  edits the end you are POINTING AT, and declines otherwise.
- The PEDAL's resize stays on `Ctrl+←/→`: it has no endpoint handles to arm, so there is nothing to
  gate on. The two spanners' keys differ now, and that is the reason.

**…and the LEFT square moves the START, holding the end** (same day, same chord). So the pair is one
claim: ONE CHORD, and the armed square decides which end of the span it moves. `←` reaches the start
back a slot (the wedge grows at the front), `→` steps it in (it shrinks from the front), and in both
the right-hand end stays exactly where it was.

### ⭐⭐ Why that did NOT change the model, though it looks like it should

*"i don't know if the model that i think just have position and duration is good for this"* — his
question, and the answer is that `{beat, length}` and `{start, end}` are the same information:
holding the end still is `length' = end − start'`, written in ONE operation
(`hairpinOps.moveHairpinStartBySlot`). Storing two addresses would not buy the gesture; it would move
the two-field write to the OTHER one — dragging the whole wedge, which today is a single `beat`.

What decided the stored shape is a different axis, and it is untouched: **survival**. After a re-bar
only the START needs re-finding, because the extent is invariant — the music inside the span did not
change when the barlines moved ({@link Hairpin}, and the same argument verbatim on `Ottava`, `Pedal`
and `Trill`, which all copy this shape). Two addresses would need both re-found, and a
half-succeeding re-anchor leaves a span whose end precedes its start.

⚠️ **So what the model gained is an invariant about EDITS, not a new shape: an edit that holds one
end fixed writes `beat` and `length` together, atomically.** Split them and the wedge visibly jumps
between the two writes — and an undo entry taken in between stores a span nobody asked for.

⭐ A start reaching back across a barline **re-files the hairpin under the bar it now begins in** (the
list it lives in *is* "the wedges that start here"), keeping the same object and the same id — the id
is what the selection holds, and a re-created hairpin would deselect itself mid-gesture.


## 2026-08-17 (later) — the squares DRAG, and the snap rule that makes them land where you point

*"i want to be able to do the last two operations with the endpoints dragging with the mouse, similar
to what we do in slur… take into account the current x position of the mouse and the target anchor to
make the jump so it match the movement."* So each square now drags: the RIGHT one re-lengths the
wedge, the LEFT one moves its start and holds the end — the same two model writes `Ctrl+Shift+←/→`
makes, so the mouse and the keyboard cannot land on different wedges. One undo per drop
(`previewHairpinEnd` / `commitHairpinDrag`, the `previewSlurEndpoint` pair's arrangement).

### ⭐⭐ Snap to the BOUNDARY the renderer draws, not to the notehead

The first cut copied the slur's rule — nearest notehead by distance — and he found it twice wrong:
*"sometimes it jumps before x mouse reach the target"* (the right square), then *"with the left point
is not that accurate either"*, and *"i tried the slur and in the slur is much more accurate"*. That
last one is the diagnosis. **The slur's rule is right FOR THE SLUR because a slur's endpoint is drawn
ON the notehead it snaps to**, so the ink follows the cursor. A wedge's tips are not:

    spanX():  startX = noteLeftX(first COVERED note)
              endX   = noteLeftX(first UNCOVERED note)   // …or the bar's end

Both tips sit on a note's **left edge**, and the end's is the edge of the note it does *not* cover. So
snapping to notehead CENTRES was wrong twice over: half a notehead early on both ends, and a whole
note late on the tip — the wedge grew past the pointer, which is exactly what "jumps before the mouse
reaches the target" looks like.

The fix is to snap to what is actually drawn. The candidates are the lane's **onsets** (each the left
edge of a note), and the answer is read differently by the two squares:

| grabbed square | nearest boundary → | model write |
|---|---|---|
| left  | that onset is the wedge's new START | `setHairpinStartAtSlot` |
| right | the tip lands on that onset, so the note there is NOT covered | `setHairpinEndBeforeSlot` |
| right, dragged past the last note | there is no onset after the music | `setHairpinEndAtSlot` (covers it) |

⭐ That third row is why "cover this slot" and "end before this slot" are two ops rather than one:
every boundary but the last is an onset, and the final note could otherwise never be included.

⚠️ The distance is measured in BOTH axes even though only x carries the answer within a system — the
y term is what stops a drag on system 2 snapping to a similar x on system 1 (cross-system x's are not
one ruler). The radius is generous, because the cursor rides the wedge's line several spaces BELOW
the noteheads it is choosing between.

⚠️ A CHORD is ONE boundary — its leftmost head, the edge the wedge is drawn against — though it
registers an element per notehead.

⛔ And a drag still cannot put an end between two notes: the cursor picks a slot, the slot decides the
geometry. A wedge's extent is musical, and the model has nowhere to store "two thirds of the way to
the next quaver".


## 2026-08-17 (later still) — the wedge gets an OVERRIDE, and §4 gains its other half

*"when an endpoint is selected and i ctrl+arrow i want to be able to offset, so is an override, and
that means the user is able to reshape the hairpin"*, then: *"ctrl+arrow and arrow, similar to slur
offset"*. So the armed square now nudges the wedge's DRAWN end — plain arrow ¼ space, `Ctrl`+arrow
one space, `Ctrl+Backspace` back to the engraver's position — stored as a
`HairpinEndpointOffsetOverride` (staff-spaces, per end) in the engraving-overrides compartment.

### ⭐⭐ Two chords, two categories, one pair of handles

§4 said a hairpin's extent is musical and its height is not, and used that to explain why the resize
writes the MODEL. What it could not say, while the extent owned the only horizontal gesture, was what
the cosmetic half would look like. Now both exist on the same two squares, told apart by the chord:

| gesture | changes | where it lives |
|---|---|---|
| `Ctrl+Shift+←/→`, and a drag of the square | WHICH NOTES get louder | `beat` / `length` on the model |
| arrow (fine) / `Ctrl`+arrow (coarse) | where the INK is drawn | `hairpinEndpointOffset` override |

⭐ `x` moves that end along the wedge (± its reach), `y` moves it off the dynamics line — so a `y` on
ONE end is what TILTS the wedge and a `y` on both lifts it whole. Playback cannot tell the difference,
which is precisely the test of whether an edit belongs here or on the model.

⚠️ **The offset is applied where the engraver's own decisions end** — after the dynamic skyline and
the `END_INSET` air, before the pieces are cut. So a nudged end carries through the cut, through the
aperture (sized from the DRAWN width) and through the registered outline — and therefore through the
handles, which are read off that outline. Applied per piece afterwards, the ink would move and the
squares would stay behind. On a split wedge the vertical nudge belongs to the TRUE ends: the start's
on the first fragment, the end's on the last, or the wedge would bend at every system break.

⚠️ **It SURVIVES a resize or a drag**, unlike the slur's endpoint nudge, and the difference is the
reason: a slur's was tuned against one notehead's ink, so a re-anchor makes it unwanted; a wedge's
says "this far out from wherever this end lands", which stays true when the extent moves.
`Ctrl+Backspace` now has something to reset on a hairpin after all — the line in P4 saying it does not
is superseded by this section.


## 2026-08-17 (last) — Properties types the wedge's drawing, mouth included

*"these two offsets i want to be able to do it from property"*, then *"i also want to control the
mouth aperture (another override)"*. So a selected hairpin's panel now carries its whole COSMETIC
half: a row per end (x/y, staff-spaces) and one for the mouth.

```
HAIRPIN
  start (sp)   x [    ] y [    ] [reset]
  end   (sp)   x [1.5 ] y [-1  ] [reset]
  mouth (sp)     [2.5 ]          [reset]
```

Wiring is the note-offset arrangement: the window publishes to `bus.hairpinGeometry` and holds no
engine; `HairpinGeometryController` applies. The two shapes on that one seam differ in a way worth
naming — an END is **absolute in, relative out** (`nudgeHairpinEndpoint` accumulates, so
`delta = wanted − current`, read from the compartment rather than from the panel, and re-typing the
same number is a no-op), while the MOUTH is stored as asked: it REPLACES the automatic aperture, so
there is nothing to accumulate onto.

### The mouth is a third override, and its own kind

`HairpinApertureOverride` — one number for the whole wedge, which is why it is not a third field on
`HairpinEndpointOffsetOverride`: a split wedge divides one aperture among its fragments
(`fragmentOpening`) rather than each piece carrying one.

- ⛔ It carries no `startY`/`endY`, though `HairpinShapeOverrideLike` in the renderer has room for
  them. The vertical belongs to the endpoint offsets, which are per END and also carry x — two ways
  to say "this end sits half a space lower" is the disagreement the compartment exists to prevent.
- ⚠️ The **steepness cap still applies over it** (`resolveHairpinShape`), so a short wedge cannot be
  authored into an arrowhead; Verovio caps an authored aperture too. The min-angle FLOOR does not
  apply — an authored mouth is a human fixing that very problem by eye.
- ⛔ A non-positive mouth is REFUSED at the model, because the renderer draws nothing at all for one
  (`shape.aperture > 0`) and the wedge would vanish with nothing on screen to explain why.
### ⭐⭐ The mouth control shows what is DRAWN, and its bounds come from this file's own constants

Two corrections of his, both of which the first cut got wrong:

**1. *"if i'm in auto and increase i don't start from 0, i start from current value and increase."***
A blank box meant the first press of the spinner jumped to the minimum, which is the opposite of a
nudge. So the row shows the EFFECTIVE aperture — authored or automatic — and `reset` is what says
"back to automatic"; the model's own distinction (absent vs authored) is reported in the row's title
and in the overrides dump, not by an empty box. The effective number and the wedge's drawn length both
ride the registry from the last render (`apertureSpaces`, `hairpinLengthSpaces`), because neither is in
the model: the automatic aperture is a function of how long the wedge came out.

**2. *"0.25 for min mouth aperture? this is not right, it does not look like an hairpin… it should be
in our hairpin formula."*** It was an invented number, and the file's own physics says why it fails:
the arms are inside their own stroke for `thickness ÷ aperture` OF THE WEDGE, so 0.25 at 0.16
thickness is solid ink for 64% of its length. `authoredApertureRange(lengthSpaces)` now derives both
ends from constants that already exist:

| bound | value | why |
|---|---|---|
| max | `MAX_APERTURE` 2.0 | the end of the growth ramp; the widest he accepted at 85 spaces |
| min | `AUTHORED_MIN_APERTURE` 1.0 | *"lets try 1 for our properties"* — and it is **Dorico's own "Minimum hairpin aperture" default**, quoted in this file already |
| both | ↓ pulled down by `2·L·tan(MAX_ANGLE/2)` | the steepness cap, the length-dependent part |

So a 45-space wedge offers 1–2, a 5.5-space one 1–1.11, and under ~5 spaces the cap is the whole
answer and the range collapses to it. ⚠️ The panel CLAMPS a typed value into the range before
publishing: `min`/`max` on a number input only constrain its spinner, and publishing a value the
renderer would cap stores a shape the score never draws.

### ⭐⭐ …and `Shift+↑/↓` opens the mouth from the square that HAS one

His rule and, after one revision, his chord: *"the endpoint that control the mouth is the one who has
the mouth (right for cresc, left for dim)"*, with *"shift backspace for reset"*.

**⚠️ It shipped on `Shift+←/→` first and he changed it within the hour** — *"i test it and is not
intuitive, lets try arrow up down instead"*. The argument for the horizontal pair was not bad: the
mouth is a SYMMETRIC spread about the axis, so pressing ↑ moves the top arm up and the bottom arm
*down* and no vertical direction really means "open"; grow / shrink on a modified `←/→` is this
editor's idiom for size (bar width, note spacing, the extent, a pedal's length). What it missed is
that you do not reach for "the pair" — you reach for the ARM under the cursor, and the mouth's square
sits at the open end, where ↑ = wider is immediate. **Recorded because the reasoning was sound and
lost to a test anyway**, which is the only way that argument could have been settled.

⚠️ The cost, accepted: the mouth now shares an axis with the plain and `Ctrl` arrows, which move that
same square's OFFSET. The modifier is what separates "move this end" from "open the wedge".

**Which square** — the OPEN end, so `hairpinMouthEnd(type)`: right on a crescendo, left on a
diminuendo. On the closed end the keys DECLINE, because a tip has no aperture — and then `Shift+↑/↓`
falls through to the fine staff-spacing nudge (which needs a selected measure box) and
`Shift+Backspace` to the barline gap's reset (which needs a selected barline), so no pair can ever
both apply.

**Where a step starts** — from the mouth as DRAWN, authored or automatic, clamped into
`authoredApertureRange`, so the keys and the Properties input cannot reach different values. At a bound
it declines rather than re-writing the same number. Step: 0.05 space, the panel's own.

So one pair of squares now carries THREE categories of edit, each on its own chord:

| chord | changes | category |
|---|---|---|
| `Ctrl+Shift+←/→`, drag | which notes get louder | the model (`beat`/`length`) |
| arrow, `Ctrl`+arrow | where that end's ink sits | override (`hairpinEndpointOffset`) |
| `Shift+↑/↓` | how far the wedge opens | override (`hairpinAperture`) |

…and each has its matching backspace: `Ctrl+Backspace` for the end nudge, `Shift+Backspace` for the
mouth.

### ⭐⭐ …and with NOTHING armed, the arrows move the WHOLE wedge

His ask, the same afternoon: *"when the hairpin is selected but no endpoint is selected and i use the
arrow or control arrow i want to offset the whole hairpin"*. Plain arrow fine, `Ctrl`+arrow coarse —
the same pair that moves ONE end when a square is armed, and `Ctrl+Backspace` resets both ends.

⭐ **So the armed square is the whole of the difference: something armed → that end moves; nothing
armed → the wedge does.** One chord read by what you picked, which is what lets both gestures share the
plain arrows at all.

⚠️ **It writes the two END offsets by the same delta, not a field of its own.** What is drawn is
`automatic + offset` at each end, so moving the pair equally IS moving the wedge — while a separate
"whole-hairpin offset" would be a second place the same pixels come from, i.e. two numbers that can
disagree about where the wedge is. Two consequences, both wanted: the gestures COMPOSE (nudge the whole
thing, then open one end, and the model holds exactly that), and a whole-wedge move shows up per END in
Properties afterwards — honest rather than lossy, since there was never a "whole wedge" quantity to
preserve.

### The whole surface, once

| gesture | needs | changes | where it lives |
|---|---|---|---|
| `Ctrl+Shift+←/→`, drag a square | a square armed | which notes get louder | model (`beat`/`length`) |
| arrow / `Ctrl`+arrow · `Ctrl+Backspace` | a square armed | that end's ink | `hairpinEndpointOffset` |
| arrow / `Ctrl`+arrow · `Ctrl+Backspace` | nothing armed | the whole wedge's ink | both ends of the same |
| `Shift+↑/↓` · `Shift+Backspace` | the MOUTH's square armed | how far it opens | `hairpinAperture` |
| Properties rows | a hairpin selected | ends + mouth, by number | the two overrides |

⏭️ Not built: a DRAG of the mouth — it would want a third square, on the mouth rather than at an end.

## 2026-08-18 — the wedge is BROKEN for an interim dynamic, and it keeps its angle

His report: a `cresc.` spanning beats 0→3 with a dynamic at beat 1 drew straight through the letter.
Four agents read the treatises on disk and all three engines before a line was written; the whole
write-up, with page numbers and measurements, is `reference/README.md` §"third question" and
§"THE THREE ENGINE SOURCES". ⛔ **Do not redo that research.**

### The rule, and it is a quotation

**Gould, *Behind Bars*, printed p. 107** (*Qualifying dynamic change → Interim dynamics*):

> "A hairpin may be broken for an interim dynamic. **Maintain the same angle for the hairpin either
> side of the interim dynamic**, so that the hairpin is clearly one gradual dynamic change. It is
> unnecessary in this case to enclose the interim dynamic in brackets since it is clear that the
> dynamic change continues:"

⭐⭐ And her drawing was **measured** (450 dpi, 1 sp = 19.9 px): extrapolating the first half's two
edges straight across the `mf` lands within **0.14 sp** of where the second half's edges begin. So
the correct picture is **ONE wedge with a slice cut out of it**, not two wedges — and her `not`
drawing is exactly the failure where the aperture restarts and the two angles differ.

Three corroborations for the surrounding decisions, each from a second book:

- **one horizontal plane** — Gould p. 105 (*"keep such markings on the same horizontal plane… The eye
  most easily follows a progression of dynamics running parallel to the stave"*), with the displaced
  version DRAWN and labelled `incorrect`; Ross p. 188 rule 3, *"A mark should be aligned horizontally
  with a sign."* ⛔ **So the answer is never vertical displacement**;
- **the wedge yields, the dynamic keeps its notehead** — Gould p. 104, *"(If a dynamic symbol is
  present, the hairpin starts later and finishes earlier, so that the dynamic centres on the notehead
  or chord.)"*;
- **the shared datum is the glyph's x-height centre, not its baseline** — measured to 0.08 sp on
  p. 105. MuseScore independently agrees (`0.46 × spatium`); Verovio fudges `+0.5 sp`.

### ⛔ No engine does this, and that is why the case is ours

- **LilyPond** makes it unrepresentable: an absolute dynamic *terminates* an open hairpin
  (`lily/dynamic-engraver.cc:102`). Its shortening is a POINTER — the `DynamicText` *is* the wedge's
  bound — not a proximity test.
- **MuseScore** lets them overlap, and forbids the question:
  `Autoplace::itemsShouldIgnoreEachOther` (`autoplace.cpp:406`) returns true unconditionally for any
  DYNAMIC × HAIRPIN_SEGMENT pair. Its snapping matches on exact tick, endpoints only.
- **Verovio** pushes the wedge to a second line at full length — the picture Gould labels incorrect.

⭐⭐ All three link by *identity at the endpoints*. Our `{beat, length}` + `Fraction` model can ask
`hp.beat < d.beat < hp.beat + hp.length` — the containment relation none of them can express.

### What was built

`engine/rendering/hairpinBreaks.ts` (new module, pure) + `interiorMarkGaps` in `HairpinRenderer`:

1. every dynamic **strictly inside** the span and in the wedge's **own voice** contributes its DRAWN
   ink, padded by `HAIRPIN.BREAK_PADDING`, as a gap — a mark ON an end stays the endpoint skyline's
   business (§7), or the padding would come off twice;
2. `breakWedgeAtGaps` cuts the system fragments around those slices, merging co-located marks
   (`p dolce` is one obstacle) and matching gaps to fragments **by system**, since two systems' x's
   are not one ruler;
3. ⭐⭐ each surviving segment carries `t0`/`t1` — its share of the piece it was cut from, measured
   against that piece's FULL extent, **gap included**. The renderer interpolates both the mouth's
   opening and the slant across it. That is the collinearity, and it has two nice consequences: an
   uncut piece comes back `0→1` and is drawn by exactly the arithmetic that was there before, so the
   system-break thirds (`fragmentOpening`) are untouched;
4. ⚠️ the ramp is still sized from the whole drawn width **before** the cuts. Closing it over the
   remaining ink would draw two wedges whose angles differ — her `incorrect`.

⚠️ **A remnant under `HAIRPIN.MIN_FRAGMENT` (1.0 sp) is DROPPED.** The threshold is Verovio's
(`view_control.cpp:688`); its fallback is not — Verovio abandons the whole adjustment there and draws
the wedge through the letter's ink, reproducible in the ordinary `p < mf > p` figure. A sliver says
nothing; a wedge through a glyph says something false.

⚠️ **Browser-only**, exactly as the endpoint skyline already is: the cut is made from `getBBox()` on
the letter's `<text>`, and jsdom measures every glyph 0×0, so without a browser there are no gaps and
the wedge draws whole. The arithmetic is unit-tested alone (`hairpinBreaks.test.ts`, 13 cases); the
drawing is checked in `e2e/hairpin.e2e.ts` — two tests, one for the break and one that extrapolates
each arm of the first half across the gap and lands it on the second's, both verified to fail without
the code.

⏭️ Still open, inherited rather than added: a mark being TEXT-EDITED is not drawn
(`suppressedDynamicId`), so the wedge un-breaks while you type and snaps back on commit — §11.10's
existing gap, now with one more symptom.


### 2026-08-18 (later) — the white, measured off her drawing rather than borrowed

Two corrections from his eye on the real thing, both worth recording because each was a *class* of
mistake rather than a slip.

**1. The gap was `BOUND_PADDING` (1.0 sp), and it is not the same question.** *"The white in this
case is too much… it will be good that the white is just a small padding near to the ink."* At an END
the padding separates two independent objects; INSIDE, the white is a window cut in something
continuous, and a space either side reads as two wedges that happen to line up — the very thing
p. 107's *same angle* rule exists to prevent. It is now its own constant, `HAIRPIN.BREAK_PADDING`.

⭐⭐ **And the number is MEASURED, after he pushed back a second time** (*"the drawing in p107 of
Gould does not have that much white, fyi"* — the first cut was 0.25 sp, borrowed from Verovio).
Printed p. 107 rendered at 450 dpi, ink-run profile across the correct figure: `pp` **1.01 sp** wedge
A **0.50 sp** `mf` **0.50 sp** wedge B **0.75 sp** `ff`. So the interim gap is **0.5 sp, half what she
leaves at the ends, and EVEN on both sides** — and, incidentally, exactly MuseScore's
`autoplaceHairpinDynamicsDistance`. The ruler was checked on that figure rather than borrowed from a
staved page (`pp` = 39 px against her *"the p two spaces"*, `ff` = 53 px against *"the ƒ is two and a
half spaces"* ⇒ ~20 px/sp).

**2. 🚨🚨 The hole was cut around the mark's UNMOVED box.** *"The white is not even, there is more
white on the right side"*, and then the clincher: *"with text it is not a problem, the problem is
with the dynamic glyphs."* `markInkX` read `getBBox()` on the `<text>`, which measures BEFORE the
`translate` on the mark's group — and a LEVEL carries a big one, because it is pulled back half its
own width to straddle its notehead (`dynamicMarkAnchor`), where prose is anchored where it was drawn
and shifts by nothing. Measured in the browser: the ink box sat at 137.5–158.5 and the wedge stopped
at 139.5 and restarted at 165.5 — *overlapping* the letter on the left, 0.7 sp of white on the right.
Fixed by adding `dynamicMarkTransform.dynamicMarkTranslate(el).x`, which is that module's business
since it owns the attribute.

⚠️⚠️ **And the reason the suite did not catch it: every fixture used an ASCII letter.**
`addDynamic(…, { text: 'mf' })` is PROSE under the text-as-truth rule — a serif `mf`, no centring
translate, no bug. The three break tests now use `'\ue522'` (`dynamicForte`), i.e. the case that
actually breaks. ⭐ **A fixture that cannot express the defect is not a test of it**, and this one had
been green all along.

### 2026-08-18 (last) — a nudged wedge that is also broken

His screenshot: with `hairpinEndpointOffset` on both ends and a mark cutting the wedge in two, *"the
drawing is completely crazy"* — a zigzag.

🚨🚨 **The nudge was applied per DRAWN SEGMENT.** The first half took `startY` at its left and nothing
at its right; the second took nothing at its left and `endY` at its right. That rule was written for
SYSTEM BREAKS, where each fragment is a piece of its own and the middles legitimately take neither —
and it survived the break work because the question it asks, *"is this the first/last piece?"*, could
still be answered from the segment array **right up until a piece could be cut in two**. After a cut,
one piece is both the first and the last, and `segments[0]` is only half of it.

Fixed in two parts:

- `WedgeSegment` now carries **`piece`**, the index of the piece it came from, so the ends stay a
  property of the PIECES;
- the nudge is a **ramp** across the piece, like the slant and the opening beside it —
  `rampAt(startNudge, endNudge, t)`. Equal nudges therefore move the whole wedge and change nothing
  about its shape, which is the case he hit.

⭐ Uncut pieces are unaffected: `t0 = 0, t1 = 1` gives back exactly `startY` and `endY`.

Guarded in the browser (`e2e/hairpin.e2e.ts`): a wedge that is nudged **and** broken keeps its halves
collinear, and every arm's left edge moves by the same three spaces. Verified to fail with the
per-segment rule restored.

### 2026-08-18 — the break is now conditional on the two inks actually CLASHING

His rule: *"if the hairpin is offset vertical or the dynamic is offset vertical, so none of them touch
each other (if and only if) then we should draw the normal hairpin."*

⭐ **The house principle, one family further out.** `layout/kerning` already says *two inks only clash
where they share a vertical BAND*; this is that sentence applied to the wedge and the letters on its
own line. Gould breaks a hairpin **to let a letter through** — so a letter that has been lifted clear,
or a wedge nudged clear of it, is not in the way, and the hole would be cut for nothing.

`interiorMarkGaps` now takes a `wedgeBandAt(line, x)` lookup and drops any mark whose ink does not
overlap the wedge's there. Two measurements it needs, and each had a trap:

- **the wedge's band at that x** has to be a LOOKUP, not a number: the wedge slants, its mouth opens
  along its length, and either end may be hand-nudged — so it is `axis + slant(t) ± aperture(t)/2`
  with the nudge ramp included, i.e. the same arithmetic the draw loop runs, hoisted;
- **the mark's band** comes from the FONT TABLE (`dynamicMarkInk.dynamicInkReachSpaces`), ⛔ never the
  box: `getBBox()` on a `<text>` holding a SMuFL glyph reports the font's line metrics — **160 px for
  a 10 px staff space**, sixteen times the ink. Prose falls back to the box, which is honest for a
  serif face and is why nothing ever looked wrong for `dolce`.

⚠️ **Touching counts as clashing, and there is no tolerance beyond that** — *"if and only if"* was the
ask, so a hair's breadth of daylight makes the wedge whole again. If that ever reads cramped, the
place to add clearance is `inksClash`, not the caller.

Guarded by three browser tests: lift the WEDGE clear → one fragment; lift the MARK clear → one
fragment; nudge the mark a quarter space, still through the arms → still broken (the test is CLASH,
not "was nudged"). ⚠️ The zigzag fixture had to shrink its nudge to half a space for the same reason:
at three spaces the wedge now clears the letter and there is nothing left to zigzag.

### 2026-08-18 — the hole survives the TEXT EDITOR, and grows with what is typed

His report: double-click a dynamic and *"the hairpin draw completely so it is very messy to work
here"* — then, when the first fix landed, *"the size of what is written changes during editing"*.

**Why it happened.** A mark being edited is SUPPRESSED (`suppressedDynamicId`) so the DOM input is
not sitting on a doubled glyph — and a suppressed mark is not drawn, so it MEASURES NOTHING. Every
reader concluded the space was free: the endpoint skyline collapsed (§11.10, open since P3) and, once
the break existed, the hole closed straight through the editor.

**The fix, in three parts:**

1. **The renderer remembers.** `RenderPass.markInkMemory` (owned by `VexFlowRenderer`, so it lives
   ACROSS renders) keeps each mark's last measured ink; `HairpinRenderer.suppressedInk` answers from
   it for the mark that is hidden. ⛔ No white background, no colour, nothing that breaks the day the
   page is cream or textured — the engine simply stops throwing away what it knew.
2. **The editor reports its live width**, so the hole tracks the typing: `DomTextEdit` measures on
   `input` → `TextEditController` → `EditableTextSource.onTextResized` → `DynamicTextSource` divides
   by the ZOOM and calls `setSuppressedDynamicId(id, widthInScorePixels)`. ⭐ A WIDTH and not a box,
   deliberately: the overlay is `position: fixed` at the mark's own left edge and grows RIGHTWARD, so
   the only thing that moves is the reach — and a scalar needs no DOM→staff-space conversion.
   ⚠️ Reported only on a whole-pixel change; a render is a re-engrave.
3. 🚨🚨 **…and the width had to go in `viewStateKey`, which is where the bug actually was.**
   `RenderController.renderScore` re-engraves only `if (engine.isRenderStale())`, and that is
   `modelDirty || viewStateKey changed`. Typing changes NO model state, so before this the width
   arrived at the renderer on every keystroke and **no render ever read it** — the console showed
   `[Dynamic] liveInk: 19.9 … 68.5` climbing while `[Hairpin]` printed once and never again. ⛔ Not
   in `layoutStateKey`: a dynamic takes no width, so the casting-off cannot depend on it and putting
   it there would throw the layout cache away per keystroke.

⚠️ **The browser suite could not have caught part 3**, and that is worth knowing: `e2e/harness.ts`
drives the ENGINE and re-renders by hand, so it never runs the staleness check that skipped the
render. The guard for it is therefore a unit test on `viewStateKey`
(`VexFlowRenderer.incrementalRedraw.test.ts`), not an e2e.

⚠️ Known limits, both inherited: a long enough word makes the hole swallow a whole fragment (correct
— the editor really is covering that much wedge), and programmatic insertions (glyph chips, the word
menu) go through `insertNodeAtCaret` and fire no `input`, so they do not report a width until the
next ordinary keystroke.

### 2026-08-18 — the wedge's STROKE: a hairpin is the thickness of a stave-line

His report, comparing our render with her page: *"why her hairpin looks better? maybe because of the
stroke of my hairpin that is too thick"*.

⭐⭐ **He was right, and it turned out to be a RULE with a source rather than a taste number.**
**Gould, printed p. 103**, the opening line of the hairpin section: *"Hairpins are the thickness of a
stave-line. The open end should not be more than two stave-spaces wide."* **Ross, printed p. 187**,
independently: *"Each of the lines that form the wedge shape is no thicker than a staff line."*
Measured across **11 wedges on three of her figures**, the ratio of arm to her own staff line is
**1.00** (0.97–1.03 at every anti-aliasing threshold — the absolute swings by 2×, the ratio does not).

So the wedge takes `HAIRPIN_LINE_SPACES = engravingDefault('staffLineThickness')` = **0.13**, and
leaves `THIN_LINE_SPACES` (0.16) to the barlines, ledger lines, octave lines and tuplet brackets it
actually belongs to. ⚠️ This REVERSES the 2026-08-15 note that said *"do not try again without new
evidence"* after his eye rejected 0.10 and 0.12 — that round had only the engines' numbers, and he
was on the wrong number because it was the wrong FAMILY.

🚨 **What made ours read heavy is the row nobody had looked at: our staff line is not the font's.**
VexFlow never sets a stroke width for a stave, so a staff line is the SVG default **1 px** while the
hairpin converted 0.16 spaces against the stave — **1.6 px**. A drawn ratio of **1.60**, where Gould
is 1.00 and the widest engine (Verovio) is 1.33. ⭐ The LEDGER LINE hit the identical trap and solved
it with a RATIO (`layoutConfig.ts`); nobody applied that reading to the wedge. ⏭️ The real fix is his
(*"take control of the staff line width, so everything looks neat"*) and is now written into
docs/font-metrics-plan.md under P5 — draw staves at the font's 0.13 and the hairpin's 0.13 IS the
staff line, at Gould's 1.00, with no compensation anywhere.

⚠️ It also explains the earlier rejections: a staff line is pixel-HINTED onto the device grid and
stays solid black, while a DIAGONAL hairpin cannot be and smears into grey — so 0.10 read thin beside
a crisp 1 px line. Same cause, opposite symptom.

## 2026-08-20 — BOTH squares WALK: the ink carries the wedge

His ask, in two steps. First *"lets try now to do the walk for arrow/ctrl arrow on the left endpoint
of the hairpin"*, then, once it shipped: *"we are using reanchor also for the duration endpoint, and
offset, that means that the duration endpoint should walk too"* — which is the better rule, and the
reason is his: a square that has BOTH a re-anchor and an offset owes the gesture that joins them.

The gesture itself is the dynamics line's, arriving here third (`docs/dynamic-offset-plan.md`, the
tempo mark's tail section): ←/→ and `Ctrl`+←/→ nudge the armed end's INK, and the press on which that
ink ARRIVES at the next boundary spends its step on the MODEL instead — `offset += step − gap` — so
the crossing is invisible. Arithmetic: `interactions/markWalk.ts`, untouched. New modules:
`interactions/hairpinWalk.ts` (the two PORTS) and `interactions/hairpinLane.ts` (where the lane was
DRAWN, extracted from the drag so all three routes measure one geometry).

- ⭐⭐ **The stops are BOUNDARIES, not noteheads** — a wedge's tips are drawn at a note's LEFT EDGE
  (`spanX`), so every gap here is edge-to-edge. ⛔ The dynamic's head-to-head rule would cross half a
  notehead early; this is the same correction the DRAG needed on 2026-08-17.
- ⭐⭐ **A crossing HOLDS THE OTHER END STILL**, which is what makes the two squares one gesture
  rather than a wedge that slides: the start writes `beat`+`length` together, the tip writes `length`
  alone. ⚠️ So a walking press is AUDIBLE exactly at the crossing; every press either side is ink.
- ⭐ **Both candidate rules were SPLIT OUT of the model ops the `Ctrl+Shift` chord already used**
  (`nextHairpinStartSlot`, `nextHairpinEndStop`) — two rules would mean the two keys landing an end
  on different notes depending on how far it had been nudged. The tip's is named in the DRAG's
  vocabulary (`HairpinDragWrite`), since past the last note the only stop left is COVERING it.
- ⭐ **Neither crossing touches an override**, so both ends' nudges survive by construction — no
  `…KeepingOffset` twin was needed, unlike the dynamic's.
- ⚠️ **A tip standing on a BARLINE has no onset to measure from**, so `hairpinTipX` reads the DRAWN
  tip and takes that end's own nudge back out. ⛔ The last note's right edge — what the drag snaps to
  — sits well left of the barline and would let the ink sail past its target before the wedge moved.
- 🚨🚨 **CROSSING A SYSTEM BREAK — the ink WRAPS at the barline.** His rule, after four rounds of
  hand-testing in one afternoon: *"after the barline, all the distance we are drawing in the old
  system should be drawing in the beginning of the next system"*. The four attempts, each of which
  taught the next: (1) it would not cross at all — two systems' x's are not one ruler; (2) a trigger
  of *"has the ink passed the last barline"* fired on the FIRST press, because a tip parked at the
  line's end is already at the edge — *"is not symmetrical"*; (3) that press was spent on a stop that
  leaves the wedge ending ON the barline, drawn where it already was — *"it is never reaching the
  next system"*; (4) pricing the crossing at the whole folded distance dragged the wedge eleven
  spaces into the margin — *"look how much is drawing wrong before jumping"*.
  ⭐⭐ **The answer is two different numbers for two different questions:**
  `arrives when offset + step passes (this line's end − the tip)`, and
  `re-bases by gap = (this line's end − the tip) + (the stop − that line's start)`.
  So the press that leaves the line lands the tip just past the NEXT system's start, by exactly the
  ink that would have hung in the margin, and every further press walks it on until the offset
  reaches zero at its anchor. Symmetric by construction: backwards the edge is the line's START and
  the far side is the previous line's END.
  ⭐ **And a stop is priced where the TIP lands, never at the note it names** (`hairpinOps.addressOfAbs`)
  — the fix behind (3), and the one that makes "fill this bar to its barline" a step of its own.
  ⛔ Whether two addresses share a system is asked of the SYSTEMS (the staff's top-line y), never of
  their x's: a later line's x may be larger, smaller or equal.
- 🚨 **Where there is nothing to extend onto** (the end of the lane, or an undrawn stop) the ink gets
  a LIMIT instead — `hairpinSystemInkLimit`, the system's own `noteStartX`/`noteEndX` — or the arrow
  goes on pushing the drawing into the margin with the music standing still. It REFUSES the write;
  ⛔ it never clamps the drawing, and ink already outside may always come back.
- 🚨🚨 **AND THE WEDGE WAS NOT REPAINTING AT ALL — the shape-key trap, on the third client.** His
  report: *"the offset is growing but not drawing"*. A hairpin's three overrides (two end nudges, the
  mouth) are **id-keyed**, so `overridesFor` never saw them and `view.hairpins` is unchanged by a
  nudge — the bar read clean, kept its cached group, and the wedge sat still while the model moved.
  ⚠️ **This shipped broken with the reshape in 2026-08-17** and looked to work for three days,
  because any OTHER change in the bar redrew it; only an ink-only press exposes it. One line in
  `MeasureRedrawKey` (`view.hairpins?.map(h => overrides[h.id])`), guarded by a test broken on
  purpose. See `reference_render_width_key_vs_shape_key`: when unsure, INCLUDE — wrong answers are
  SILENT.
- ⭐⭐ **…AND THE MOUSE, the same day** (*"now lets do the walk for the mouse"*). The squares' drag ran
  the same two ports with a PREVIEW writer (`dragHairpinEndpoint`), so a drag and the presses covering
  the same distance leave ONE state. What it replaces: `hairpinDragTargetAt`, the cursor→nearest-slot
  snap (deleted with its spec chapter — a second answer to "where may an end land" is exactly what
  this family keeps out). The tip can now be parked BETWEEN two boundaries, which the snap could not.
  ⭐ **THE LATCH is ON** (⛔ unlike the dynamic's drag): the ink stops dead at offset zero of the
  boundary it is nearest in the direction of travel, because a wedge's tip is AIMED at a note's edge
  and that alignment must be reachable exactly rather than by luck. A `p` is a label placed by eye; a
  hairpin's end is not. ⛔ Horizontal only, as on the keys.
  ⭐⭐ **A WRAP ENDS THE DRAG** (his call): the tip is a line below and the hand is not, so every
  further pixel would move it by a distance measured against a system it has left. The frame reports
  it and `MouseController` drops the gesture — the wedge keeps its small new piece over there, the
  square stays ARMED (so the arrows can carry on), and continuing with the mouse means going to the
  next system to grab it. ⭐ The keys of course do not stop: they have no cursor to be in the wrong
  place.
  🚨🚨 **WHERE THE INK IS, IS `anchor + offset` — ⛔ never the drawn fragment.** His report: the left
  square walked back over a break and then FROZE, every press refused. A wedge whose start has just
  wrapped begins at the very end of the previous line, so the piece drawn there is a point and is not
  registered at all — and "read the first fragment" then returned the piece on the OTHER system, a
  small x judged against the previous system's edges, which the limit refuses for ever. The identity
  is always available and always agrees with the address being reasoned about; a fragment is not.
  (`hairpinLane.hairpinInkX` is gone with it.)
  🚨🚨 **A PAGE LIMIT MAY NOT JUDGE THE CROSSING'S SECOND HALF.** His report: a start wrapped onto the
  previous line and then *"jumps in a point to the first measure without going to the others"* — a
  RUNAWAY, one stop per press. The re-base (`offset −= gap`) does not move the drawn mark at all; it
  is the other half of an identity. But it was written through the same call as a hand nudge, so
  `nudgeStaysOnPage` measured it against the LAST RENDER — where the anchor has not moved yet — read
  it as "shove the wedge ten spaces towards the margin", and refused. The anchor had already moved,
  the offset had not, so the next press crossed again, and again. ⭐ Fixed with a `rebase` writer on
  the port (`markWalk.MarkWalkPort.rebase`, optional): bookkeeping goes through it and is never
  refused. ⏭️ **The dynamic and the tempo mark still re-base through their nudge** — the same trap is
  latent there, and each needs the same two-line writer.
  ⏭️ **The latch's one debt, not yet paid**: the latch DROPS the travel it swallows and the caller advances
  its cursor anchor anyway, so a fast flick leaves the ink behind the hand for good — snap-and-go's
  own "never repays" defect, which the slur avoids by charging the drop to its catch-up. The fix is
  bookkeeping (don't advance the anchor on a latched frame, so the cursor re-travels it); the
  alternative is to drop the latch and let the drag be pure ink. His call, not yet made.
- 🚨🚨 **AND A DRAG MUST END ON A RELEASE THE CANVAS NEVER SEES.** His report while testing this one:
  *"i click release outside the viewport, and then when i went back with no mouse pressed the system
  think i'm still pressing the mouse and is drawing"*. Nothing to do with the wedge — a preview-based
  drag left armed keeps writing under a pointer with no button held, and there are TWO ways to miss
  the release: outside the VIEWPORT (the canvas's `mouseup` never fires → the document-level handler
  now runs the same `handleMouseUp` chain, where it used to settle only the bar-width drag) and
  outside the WINDOW (no `mouseup` fires at all → the next move's `buttons === 0` is the only
  evidence). ⭐ Fixed in the CHAIN, ⛔ never per gesture: that list was one short the moment a
  fourteenth drag was added. Spec: `MouseController.dragRelease.test.ts`, both seams break-tested.
