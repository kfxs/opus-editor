# The reference duration is DERIVED from the music — the plan

**Status: DECIDED 2026-07-31 — BUILDING the reference fix (§6), ⚠️ but NOT for the reason this plan
was written.** The plan was written before the research on purpose, so the two could be held against
each other; its premise did not survive (§9.2) and §0 states what is being built and why instead.
Corrections are marked in place rather than the document being rewritten to look right.

## 0. ⭐⭐ The decision, and the reason — read this first

> 🚨 **AND FIRST OF ALL: this plan is not the answer to what he reported.** He said so himself, once
> the two were separated (2026-07-31):
>
> > *"in general the big measure looks good, my complaint is for the problem when normal staff lives
> > with small staff… that is the real issue."*
>
> So: **the spacing of ordinary music is fine by him.** What is wrong is a MIXED-SIZE system — a
> normal staff sharing a spine with a small one. That is a different feature with a different rule,
> sketched in `docs/staff-size-plan.md` §6b, and it is the one he is waiting for.
>
> This plan stays worth building for the dense end (§0's table), and it is **lower priority than
> §6b**.

**We are building it.** `shortest` stops being a hard-coded eighth and becomes LilyPond's census:
`min(3/16, the mode over measures of each measure's shortest starter)`, over the whole score.

**⛔ NOT because it fixes the bar he reported.** It does not. Our 3.60 / 2.40 is LilyPond's own answer,
reproduced by MuseScore and Dorico alike — *equal durations are equal only where their neighbourhood
is equally dense*, which is what unfixed time-space MEANS (§9.2). His bar improves as a **side
effect** (2.40 → 3.60 for the second group, 1.50× → 1.33× uneven), and that is all it is.

**✅ Because at the DENSE end we are simply WRONG**, and one constant is why (§9.4):

| the music | today | with the census | |
|---|---|---|---|
| a 32nd-dominated passage | a 32nd earns **1.5** | **2.4** | **25–37% too tight — fixed** |
| nothing shorter than a crotchet | a crotchet earns **3.6** | 2.90 at LilyPond's cap | ⛔ **left alone — see below** |

A score of 32nds is spaced by a rule anchored to an eighth it does not contain. That is the defect
being fixed.

### 0.1 🚨 THE CAP IS OURS, AND IT IS AN EIGHTH — his eye, not LilyPond's number

LilyPond caps the census at `base-shortest-duration` = **3/16** (a dotted eighth), which is what makes
its sparse-music row above read "too loose". **We cap at an EIGHTH instead**, i.e. exactly today's
constant, and the reason is a report, not a theory:

> *"i think right now a measure with just crotchet looks good"* — 2026-07-31, on the current drawing.

He is the arbiter of how it reads, and he reads today's crotchet spacing as good. So:

> **`reference = min(♪, mode over measures)`** — the census may only ever make the reference SHORTER
> than an eighth. Dense music opens up; **nothing anyone already likes gets tighter.**

⭐ That is the whole risk of this change, removed by one number. A cap at 3/16 would have re-spaced
every crotchet bar in every score he has looked at, to satisfy a table rather than an eye. ⚠️ Note it
IS a departure from LilyPond, deliberate and recorded here; `base-shortest-duration` is a settable
property there too, so it is a departure in the value, not in the mechanism. If a sparse score ever
reads too loose, this cap is the first knob — not the law.

**And a second reason, cheaper to state:** the same threading makes the whole `SpacingRule` reach
every place that prices time — which is exactly what the ENGRAVING PRESETS item needs (§7).

⚠️ **What it is NOT allowed to become:** the evenness his bar wants is `proportionalNotationDuration`
— fixed time-space, a different aesthetic, a preset, a separate plan (§9.5).

## 1. The defect, named

Two staves, one bar. The upper staff has 16ths on beats 1 and 2 and nothing after; the lower staff
has four quavers across the whole bar. The lower staff's four quavers are drawn:

| | beat 0→½ | ½→1 | 1→3/2 | 3/2→2 |
|---|---|---|---|---|
| drawn (staff spaces) | 3.60 | 3.60 | **2.40** | **2.40** |

His report: *"the second group can have more space so it looks more even matching with the first
group… it will look more beautiful, and in the small staff we have silence, so musically is not that
important"* — and, of the same bar with the small staff's material changed twice over, *"the big
staff doesn't look beautiful"*.

⚠️ **It is not the ink, and it is not the staff size.** Both were measured and excluded on the day:
scaling the small staff's ink to 0.7 moved those gaps by 0.01 spaces, and forcing the drawing's staff
scale to 0.5 moved them from 3.65 to 3.64. The 16th columns are not ink-floored at all — they are
priced by the RULE.

## 2. The one constant that is wrong

`engine/layout/spacing.ts`:

```ts
export const LILYPOND_SPACING: SpacingRule = { law: 'log', base: 1.2, shortest: 0.5 }
```

and

```ts
const ratio = t / rule.shortest
return (ratio < 1 ? 1 + ratio : 2 + Math.log2(ratio)) * rule.base
```

That IS LilyPond's law, including the linear branch below the reference. What is ours alone is
`shortest: 0.5` — **a hard-coded eighth**. With it, a 16th falls on the linear branch and earns 1.8
while a quaver earns 2.4; the lower staff's quaver that spans two 16th columns therefore earns 3.6
and the one that spans none earns 2.4. **A 1.5× difference between two notes of the same value, in
one line of music.** That is what his eye is reading.

🚨 **And the comment beside that constant IS a rotted repo-fact — confirmed.** It says LilyPond's
`common-shortest-duration` *"is a setting that defaults to an eighth"*. Both halves are wrong:

- it is **computed**, by `Spacing_spanner::calc_common_shortest_duration` (there is no `find_shortest`
  in current LilyPond — that name is historical), and
- the number it is capped at is `base-shortest-duration`, whose shipped default is **3/16 — a dotted
  eighth**, not 1/8 (`scm/define-grobs.scm`). The `1/8` in the C++ is only a fallback for a non-Moment
  property. ⚠️ Even LilyPond's own manual is stale here, saying *"should always be equal to or shorter
  than an 8th note"*.

The comment is what made the constant look justified, so it is corrected in the same commit as
whatever this plan becomes. Exactly the class `reference_repo_fact_comments_need_a_check` exists for.

## 3. What deriving it would give — measured, not guessed

⚠️ **Superseded in part by §9.** The three rows below were computed with `followingSpace(gap)`, which
is NOT LilyPond's spring — see §9.2. The corrected numbers are in §9.3; the conclusion of this
section (deriving improves the unevenness, only uniform removes it) survives.

Same bar, same model, three rules (run through `followingSpace` directly):

| rule | the four quavers | unevenness | bar |
|---|---|---|---|
| today — reference fixed at ♪ | 3.60 3.60 **2.40 2.40** | 1.50× | 16.8 sp |
| **derived** — this bar's shortest is 𝅘𝅥𝅯 | 4.80 4.80 **3.60 3.60** | 1.33× | 22.8 sp |
| uniform — space ∝ time | 1.80 1.80 1.80 1.80 | 1.00× | 14.4 sp |

⭐ **Deriving improves it but does not make it even**, and the plan says so up front rather than
letting the result disappoint: 1.50× → 1.33×. The quaver that spans two columns still has two springs
in it. **Only space-proportional-to-time makes equal durations equal** — that is proportional
notation, it is a different aesthetic, and it belongs to the ENGRAVING PRESETS question (the
`SpacingRule.law` field already has `power` | `log`; uniform is `power` with ratio 2). ⛔ Do not
smuggle it in here.

⭐ **The widening is absorbed by justification.** Every system is justified to the same width, so a
uniform scale factor changes nothing; what changes is the RATIO between bars. Dense bar ÷ sparse bar
goes 1.75 → 1.58, i.e. a dense bar takes relatively LESS of the line than it does today. That is the
real visible effect, and it is the one to look at by eye.

## 4. ⭐⭐ The decision: the SCOPE the reference is derived over

This is the whole plan. Everything else is plumbing.

✅ **The research confirms this section's choice** — LilyPond's scope is the *spacing section*, which
is the whole score unless `\newSpacingSection` splits it, and **never a system**. Sourced in §9.1.

**Per SYSTEM** — ⛔ **Rejected: it is circular**, and LilyPond does not do it either. The reference depends on which
bars land on the system; which bars land on the system depends on their widths; their widths depend
on the reference. Resolving it needs iteration to a fixed point — MuseScore's *"every time a measure
joins the system, if its shortest note is shorter, re-lay out every previous measure"*, which
`spacing-model-plan.md` §1.1 refused on purpose and which this plan refuses again.

**Per BAR** — no feedback, cheapest to compute. ⛔ **Rejected, and this is the interesting one: it
does not fix his complaint, it MOVES it.** One reference per bar makes a bar internally consistent
and makes two neighbouring bars disagree — a quaver in a bar containing 16ths at 3.6, the same
quaver in the next bar at 2.4. He would be looking at the same picture one barline later.

**Per SCORE** — ⭐ **the proposal.** One census over the whole score's durations, one reference for
every bar. No feedback (the census cannot depend on line breaking), consistent everywhere, and it
still adapts to the music — which is the entire point.

⚠️ **What per-score costs, stated plainly:** a bar's width stops being a function of that bar alone.
Typing the first 16th into a piece of quavers re-spaces every bar in the score. That is LilyPond's
behaviour too (per section), and it is visible to the user as *"the whole piece moved"*. §5.1 is how
that is made rare rather than surprising.

## 5. How the cost is paid

### 5.1 The census must ask for the COMMON shortest, not the shortest

⭐ This is the safety of the whole idea. One 32nd flourish in a piece of quavers must not rescale the
score. LilyPond's property is called *common*-shortest-duration for exactly this reason. ✅ **The rule
is now known exactly, and it is a MODE, not a threshold** (`lily/spacing-spanner.cc`):

> *"We want the shortest note that is also 'common' in the piece, so we find the shortest in each
> measure, and take the most frequently found duration."*

- **One vote per MEASURE** — the per-measure shortest starter; a barline closes the bin.
- **Plurality wins, no threshold**, and a **tie goes to the SHORTER** (the loop runs downward with `>=`
  over ascending durations).
- **Capped**: `reference = min(♪, winner)` — ⚠️ **an eighth, ours; LilyPond's is 3/16.** §0.1 has the
  reason and it is his eye, not a table.
- **Grace notes excluded.** **Rests vote exactly like notes** of the same length. **Multi-measure rests
  are excluded.**

🚨 **That last exclusion is LOAD-BEARING FOR US and nearly went unnoticed.** Our editor opens on 64
bars of which 63 are empty. If a bar of silence voted, it would win the plurality outright and every
score would be spaced at the 3/16 cap. Measured on his own bar: with the empty bars voting the
quavers come out **5.80 / 4.10 (1.41× uneven)**; with measure rests excluded, **4.80 / 3.60 (1.33×)**.
⛔ A census that counts empty bars is not a slightly worse census, it is a broken one.

⭐ **Quantise the answer to the duration ladder** (𝅘𝅥𝅰 / 𝅘𝅥𝅯 / ♪ / ♩). Then the census answer is a small
enum: it flips rarely, and when it flips the change is one explainable step rather than continuous
drift. A user who has just typed a 16th can be told what happened.

### 5.2 The three memos, which are blind to it

The same trap as `docs/staff-size-plan.md` §7, and the same fix — proven the same day, when a staff
drawn 0.7 kept the casting-off it had at full size because `layoutStateKey` did not hold the sizes:

- `laneFingerprint` (`MeasureWidthCache`, and `MeasureRedrawKey` re-uses it) — hashes the LANE's own
  slots, so a bar whose content did not change still needs a new width when the census flips.
- `layoutStateKey` — may this render reuse the last casting-off?
- `measureShapeKey` — may this drawn bar be reused verbatim?

One field in each. ⚠️ The danger is forgetting one, and the failure is SILENT: stale widths that look
like a spacing bug and are a cache bug.

### 5.3 The plumbing is already there

`followingSpace(quarters, rule)` and `spaceColumns(columns, target, rule)` **already take the rule**,
defaulting to `DEFAULT_SPACING`. Six call sites pass nothing today: three in `layout/fanRampRoom.ts`,
one each in `rendering/FanPass.ts` and `rendering/FannedBeam.ts`, plus `spacing.ts`'s own
`gapsBetween`. Threading a score-derived rule is passing an argument, the same shape as the
`StaffSizeResolver` threaded on 2026-07-31.

⭐ And it is the SAME plumbing the engraving presets need — one `SpacingRule` reaching every place
that prices time. That convergence is a reason to do it here rather than twice.

## 6. Phases

**P0 — the census, pure and with no caller.** `engine/layout/shortestDuration.ts`: a `Score` in, the
reference duration in QUARTERS out. ✅ The rule is no longer open — it is §5.1's, exactly:

- one vote per MEASURE (that measure's shortest STARTER), plurality, **ties to the shorter**;
- **capped at an EIGHTH = 0.5 quarters**, which is today's constant (§0.1 — ⚠️ deliberately NOT
  LilyPond's 3/16, because he reads today's crotchet spacing as good and this change must not
  tighten it);
- **rests vote**, **measure rests do NOT** (🚨 §5.1 — load-bearing on our 63-empty-bar default score),
  grace notes would not (we have none yet).

Its spec pins: a piece of quavers, a piece of quavers with ONE 32nd bar (**must not move** — that is
the whole point of a mode), a piece of 16ths, a tie between two durations (shorter wins), our own
default score (63 empty bars + one bar of 16ths → the 16th, NOT the cap), and an empty score.

**P1 — thread the rule.** `MeasureLayout` and the renderer resolve one `SpacingRule` per render and
hand it to `measureColumns` / `spaceColumns` / the fan modules. No behaviour change yet: the resolver
returns today's constant.

**P2 — turn it on.** The resolver returns the census's answer. ⚠️ Every pinned number in
`spacing.test.ts`, `spacing.e2e.ts`, `barWidth.e2e.ts` and `kerning.e2e.ts` that involves a score
containing 16ths moves — re-measure them, do not loosen the tolerances.

**P3 — the three keys** (§5.2), each with a test that shrinks/changes the census and asserts the
picture moved. ⛔ Not optional and not "later": P2 without P3 is a spacing feature that works only
until something is cached.

**P4 — by eye, his call.** ⚠️ Judge it on §0's table, not on the reported bar: a 32nd passage (should
open up), a crotchet-only piece (**must not move at all** — §0.1), and a score with ONE fast bar
(should not move either — that is what a mode is for). The reported bar will improve to 1.33× and that is not what is being judged.
The knob to expose if it reads wrong is the override in §5.1, not a new rule.

## 7. Explicitly not in this plan

- **Uniform stretching / proportional notation** — §3. It is the only thing that makes equal
  durations equal; it is a preset, not a bug fix.
- **A per-staff spacing weight** (Dorico's *"scale space for cue notes by"*, default 70%) — a
  different feature answering a different question, and it needs a CUE concept we do not have.
- **Anything about staff SIZE.** That was measured and excluded (§1); the ink work of 2026-07-31
  stands on its own and is documented in `staff-size-plan.md` §6a.

## 8. ⏭️ To contrast with the research

1. Is `common-shortest-duration` computed or a setting? (Our comment says setting. We both doubt it.)
2. The exact `find_shortest` selection rule — shortest anywhere, or shortest occurring often enough,
   and by what weighting/threshold?
3. What scope: score, system, or spacing section?
4. Do RESTS count in the census? Does a silent staff contribute?
5. Is there a documented mechanism for evening out equal durations, and is the unevenness in §1
   considered correct engraving or a known wart?
6. What do Verovio / MuseScore / Dorico use as their reference — derived or fixed?

If the research contradicts §4's choice of scope, the research wins and this section is where the
argument gets written down.

## 9. ⭐⭐ The contrast — what the research actually said

### 9.1 What survived

- **Scope**: whole score by default, never per system (§4) ✅ — LilyPond's `SpacingSpanner` spans the
  score, split only by `\newSpacingSection`.
- **A census, not a minimum** (§5.1) ✅ — and it is a *mode over measures*, with the cap, the tie rule
  and the exclusions now written down exactly.
- **The rotted comment** (§2) ✅ — worse than suspected: computed, and capped at 3/16, not 1/8.
- **Our law** ✅ — `(2 + log₂ ratio) × 1.2` with the linear branch below the reference is character for
  character LilyPond's `Spacing_options::get_duration_space`, Gourlay 1987 and all.

### 9.2 🚨 What did NOT survive: the premise

**Our 3.60 / 2.40 IS LilyPond's own answer, and the hard-coded eighth is not what produces it.**

The spring between two columns is not `space(gap)` — which is what §1 assumed and what
`followingSpace` computes. It is (`lily/spacing-basic.cc`):

```cpp
Real len = options->get_duration_space (shortest_playing_len);
auto fraction = delta_t / shortest_playing_len;
ret = Spring (fraction * len, fraction * min);
```

> **space(gap) = get_duration_space(the shortest note SOUNDING at the left column) × (gap ÷ that
> shortest note).**

Run his bar through it with our own reference: the dense half's columns each have a 16th sounding, so
each earns `space(1/16) = 1.8` and the quaver spanning two of them earns **3.60**; at beat 1 the
shortest sounding is a quaver, so it earns `space(1/8) = 2.40`. **Exactly what we draw.** MuseScore
computes the same shape by the same construction (`durationStretchForTicks(slope, shortestCR) ×
(segTicks / shortestCR)`), and Dorico's own development diary describes *"assigning the rhythmic value
of the shortest sounding note across all the staves to that column"*. Verovio is the odd one out — a
pure power law on elapsed time, hence automatically even, and it pays for that by having no
per-column shortest at all.

⭐ **So the unevenness he is looking at is not a defect. It is what "unfixed time-space" MEANS**, and
it is the shared answer of the three engines that share our model. The rule, stated so it can be
quoted: *equal durations are equal only where their neighbourhood is equally dense.*

⏭️ **One real difference remains to check**: our `space(gap)` and their `space(shortest) × k` agree
whenever a gap equals the shortest note sounding at its left column — which our rest-fill makes the
normal case — and diverge when a gap spans several units of a shorter note still sounding (they give
`k × space(shortest)`, we give the log of the whole gap: 4.8 against 3.6 at k = 2). Worth a spec and a
measurement before assuming it never happens.

### 9.3 The corrected numbers

His bar, under LilyPond's real spring, at three references:

| reference | the four quavers | uneven |
|---|---|---|
| fixed ♪ — today | 3.60 3.60 **2.40 2.40** | 1.50× |
| census → 𝅘𝅥𝅯 (measure rests excluded) | 4.80 4.80 **3.60 3.60** | 1.33× |
| census → 3/16 cap (empty bars voting — the broken census) | 5.80 5.80 **4.10 4.10** | 1.41× |

So deriving the reference DOES give his second group the room he asked for — **2.40 → 3.60, +50%** —
and does make the bar more even, 1.50× → 1.33×. It just does not do it for the reason §1 claimed, and
it does not make them equal.

### 9.4 What the reference fix is actually worth

Not this. It is worth doing for the two ends of the range, where we are simply wrong:

- a 32nd-dominated passage is spaced **25–37% too tight** today (a 32nd earns 1.5 where the census
  would give it 2.4);
- a piece with nothing shorter than a crotchet is **~24% too loose** (3.6 where the 3/16 cap gives
  2.90).

### 9.5 ⭐⭐ And what DOES even them out — his own axis

`proportionalNotationDuration`, and the mechanism is worth reading because it is not a new law
(`lily/spacing-engraver.cc`): it **overwrites every column's `shortest-playing-duration` and
`shortest-starter-duration` with one fixed value**. Then `fraction = delta_t / that` is pure elapsed
time, and a quaver is a quaver everywhere.

That is precisely `docs/…/FIXED vs UNFIXED time-space` — fixed music makes columns, unfixed music
makes demands — and it is the ENGRAVING PRESETS item on the open list, not a bug fix. ⛔ It is a
different aesthetic (proportional notation), not "the same picture, tidier": his bar's four quavers
become 1.80 each, and the bar gets narrower than today, not wider.

### 9.6 So the plan splits in two

1. **The reference** (this plan, P0–P4) — worth building for §9.4, with the census rule of §5.1 and
   the measure-rest exclusion that makes it safe on our own empty scores. Side effect: his bar
   improves to 1.33×.
2. **The evenness** — a PRESET (fixed time-space), his call, and a separate plan. ⛔ Not to be
   smuggled into 1.

⚠️ Gould, Ross and Read: **NOT FOUND**. Nothing citable was obtained on a dense staff against a sparse
one; the agent flagged it rather than paraphrasing, and so does this plan.
