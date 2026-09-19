# Multi-voice rest placement — the research

> ⭐⭐ **The question this answers** (his, 2026-08-31): *"we are having an issue with multivoice rest
> placement… in staff 2 the rests of the voice 1 is override by hand… this is because we don't have a
> proper mechanism to vertical position rest in the good spot so the user have to do it, but this must
> not be… i think the rule we have of the position that is very relative was before we had real
> literature."*
>
> He is right on both counts. The rule we ship (`REST_LANE`, `REST_LINE_STEP`) predates the engraving
> library, is a taste constant sitting in the paint layer, and is **blind to the other voice** — which
> is the one input every serious engine uses.
>
> ⛔ **This document is RESEARCH, not a work list.** It records what the books say, what four engines
> do, and what his own hand did 67 times. It deliberately does **not** choose between the two
> documented systems (§3.2) — that is a taste call and it is his (`feedback_an_open_question_is_not_a_decision`).
>
> 📄 Sources: `reference/` (Gould, Ross, Gerou & Lusk, Stone) and `~/dev/engine-sources` +
> `node_modules/vexflow`. Two parallel agents, 2026-08-31. The `reference/README.md` manifest has the
> Q&A row for the literature half — ⭐ **nothing on this question was in the manifest before; it is new
> ground in a library that had already answered slurs, hairpins, pedal, barlines and braces.**

---

## ⚠️ 1. UNITS — read this before quoting any number below

Three vertical units are in play and two of them are called "step" by somebody. Everything in this
document is labelled; ⛔ do not copy a number across a row without converting it.

| unit | what it is | who speaks it |
|---|---|---|
| **staff position** | half a staff space = one diatonic step = line→adjacent space | Gould, LilyPond (`staff-position`), Verovio (`loc`) |
| **staff space** | line→adjacent line = 2 staff positions | Ross, Gerou & Lusk, MuseScore (`line`) |
| ⭐ **our `restShift.steps`** | a **key-line** (VexFlow's unit, kept by our `EngravedNote` since the removal), added in `NoteBuilder` — **= 1 staff SPACE = 2 staff positions** | `types/music.ts`, `docs/rest-shift-plan.md` |

⭐ **Our unit was verified empirically, not read off a comment** (VexFlow 5, `getKeyLine`):

```
g/4=2   a/4=2.5   b/4=3   c/5=3.5   d/5=4   e/5=4.5      → 0.5 per diatonic step
```

🚨 **The trap this immediately set.** The engine research reported that *"the user's hand-drag of 6
staff positions up is precisely what Gould engraves"* (Gould's measured figure is **+3 sp = +6 staff
positions**). It is a **coincidence of the digit 6**, not a match: his stored `steps: 6` is **6 staff
spaces = 12 staff positions**, i.e. **double** Gould's displacement. ⚠️ `docs/rest-shift-plan.md`
calls the unit "staff-steps" throughout, which is what made the confusion available — the plan's
prose and the code's arithmetic have never agreed.

---

## ⭐⭐ 2. The evidence in our own file — 67 hand placements, and they are DATA

`public/examples/prelude-bwv846.json` carried **67 `restShift` overrides**, all on staff 2, all on
model voice 0 (= voice 1, the upper part), all at `b0/1` and `b2/1` — the two half-note beats. They
were cleared on 2026-08-31 so the derived rule can be tested against a clean file; the original is
kept as a measurement, not as data to restore.

The texture is identical in every bar: voice 1 = 16th rest + an 8th + a quarter; voice 2 = a held
half note underneath.

```
bar 1   R16(v0)   C4(v1,h)   E4(v0,8)   E4(v0,q)
bar 2   R16(v0)   C4(v1,h)   D4(v0,8)   D4(v0,q)
bar 3   R16(v0)   B3(v1,h)   D4(v0,8)   D4(v0,q)
```

**Fitting his 67 placements against each voice's height** (heights in staff spaces above the middle
line, so the same unit as `steps`):

| regressed against | fit | R² |
|---|---|---|
| **voice 1's own note** | `steps = 1.07·x + 2.15` | 0.863 |
| voice 2's held note | `steps = 0.75·x + 3.86` | 0.889 |

⭐ **A slope of ~1.0 with an offset of ~+2 against his own voice's note** — "put the rest about two
spaces above the notes it belongs to". The blunt form `steps = round(voice1_height + 2)` reproduces
**43 of 67 exactly and 65 of 67 within one space**.

⚠️ **What this CANNOT establish, and it matters.** The two voices move in parallel throughout this
piece, so their heights are collinear: the fit cannot separate *"track my own voice"* from *"clear
the other voice"* on statistics alone. Voice 2's fit is marginally tighter, and its slope of 0.75 is
the signature of a *collinear proxy*, not of a better model. ⭐ What breaks the tie is not the
arithmetic but Gould p. 37 (§3.3), which says it is the **surrounding pitches** — i.e. voice 1's own.
His eye and her sentence agreeing is worth more than either alone.

⚠️ **One property of this file to know before testing against it.** The bass staff's material sits on
**ledger lines above the staff** (C4/E4 against a bass clef, whose middle line is D3). That is why
his hand values had to be so large — voice 1's rest must clear material that is already outside the
staff. ⛔ Whether that octave matches a printed edition of BWV 846 is **UNVERIFIED and was withdrawn**
after being asserted once in conversation; his screen and his playback both read correct, and both
derive from the same stored octave. It does not touch the rule, which reads staff positions.

---

## 3. The literature

### 3.1 The neutral position — settled, and already ours

> *"The semibreve hangs from the second line down; the minim rest sits on the centre stave-line."*
> — **Gould, p. 34**

p. 35 continues the family: the crotchet *"starts in the top stave-space and finishes in the bottom
space"*; the quaver *"sits above the middle stave-line and extends down to the second stave-line from
the bottom"*; *"each hook is in a separate stave-space"* — so 16th = the middle two spaces, 32nd = the
top three, 64th = all four. Measured, her crotchet rest is **3.02 sp** tall and centred on the middle
line to **0.08 sp**.

And for one voice, explicitly: *"Rests remain centred within the stave regardless of the pitches of
surrounding notes."*

⭐ This is already implemented — `engine/layout/restPlacement.ts` owns it, cites p. 34, and
cross-checks the three engines. **Nothing in this research changes the single-voice case.**

🚨 **Ross p. 173's prose says the whole rest is *"placed beneath the third staff line"* — his own
p. 174 engraving hangs it from the second line from the top** (measured). Treat the prose as an
error. ⭐ That is the **fifth** time in this library that a book's drawing has beaten its own
sentence (cf. Gould's thin double, her slur formula, her brace scaling, Ross's wedge).

### 3.2 ⭐⭐ Two voices — TWO documented systems, and no source adjudicates

**System A — Gould: minimum displacement, quantised.**

> *"From the centre of the stave, rests move an exact number of stave-spaces up or down"* — **p. 35**
> (printed with a `not` counter-example)
>
> *"upper-part rests are usually placed above the centre stave-line, lower-part rests below the
> centre line"* · *"A rest moves further from the centre of the stave or to outside the stave should
> parts otherwise collide"* · *"Semibreve and minim rests must never stray across the centre
> stave-line"* — **p. 36**

**Measured** on her p. 36 figure — which engraves the *same* 3/4 music twice, displaced and neutral,
so the comparison is exact: **±1 stave-space = ±2 staff positions** (upper crotchet centred on the
2nd line from the top, lower on the 4th, neutral on the middle; quaver rest 0.96 sp up). Her
"back to the centre" figure returns them to **Δ = 0**.

**System B — Ross / Gerou & Lusk / Stone: a fixed outer line, whole and half rests only.**

> *"the whole rest for the upper voice goes below the top staff line, and the whole rest for the
> lower voice is placed beneath the bottom staff line"* — **Ross p. 173**; p. 174 half rests
> *"sit on the top staff line"* / *"the bottom staff line"*
>
> *"the fifth line for the top part and the first line for the bottom"* — **Gerou & Lusk p. 114**
>
> *"whole rests for the upper part should hang from the top staff-line; those for the lower part …
> the bottom staff-line"* — **Stone p. 135**, with an `Incorrect` pair

All three **measured and confirmed on their own engravings**: upper whole **+1 sp**, lower whole
**−3 sp**; upper half **+2 sp**, lower half **−2 sp**.

⭐⭐ **Gould knows about System B and reports it as somebody else's** (p. 37): *"Many editions place
all minim and semibreve rests on only the outside stave-lines, to avoid confusion."* **And then she
engraves it herself** in p. 312's *Whole-bar rests for extended part-writing*. ⛔ So this is not
"Gould vs the others" — it is one practice with a stricter and a looser reading, and **no source in
the library adjudicates.** That choice is a taste call, and it is his.

### 3.3 ⭐⭐ Context-dependence — all four books, unanimously

> *"The space in which a rest centres, or its distance from the stave, should be on the same level as
> surrounding pitches."* · *"When the position of a rest is displaced by a note of the other part, the
> rest moves further away from the stave."* · *"When a note is on a ledger line, place the rests above
> the top stave-space."* — **Gould p. 37**
>
> when the other part is on ledger lines the shorter rests *"may move back to the centre of the
> stave"* — **Gould p. 36**
>
> the 8th rest may *"skip up and down"*, but *"the dot at the end of the hook falls in a space, never
> on a staff line"* — **Ross p. 176**
>
> *"moved up or down… The relationship of the rest to lines and spaces must be the same as in normal
> position. The rest may be completely outside the staff."* — **Gerou & Lusk p. 115**

⭐⭐ **The rule in one line, and it is the finding of this whole document:**

> **The SIGN is positional (upper up, lower down), the MAGNITUDE is DERIVED from surrounding
> content, and the RESULT is QUANTISED to whole staff spaces.**

⛔ A fixed per-voice table — which is exactly what we ship — can express the sign and nothing else.

### 3.4 A constant height per voice? — No, and the constraint is horizontal instead

> *"the semibreve rests in the following example move lines to reflect the changing position of
> surrounding pitches."* — **Gould p. 37**

Measured in that 12/8 figure: rests at **six different heights**, including a simultaneous pair at
one x, the upper hanging from the top line and the lower from the bottom. But where the context does
*not* change, the height does not either — p. 312's rests measure identical to the pixel across bars
1 and 3.

⭐ The alignment that *is* required is the other axis: *"Rests that are part of a beat should align
horizontally"* (p. 37).

### 3.5 ⭐⭐ The Bach texture is IN GOULD — p. 312, and it is measurable

*Whole-bar rests for extended part-writing* prints a grand staff whose **bass staff has an upper
voice of held minims over a lower voice of 8th-note/8th-rest pairs**, and whose treble has an upper
voice resting over a running lower voice. That is our prelude's texture, engraved by her.

| | displacement from neutral |
|---|---|
| upper voice's crotchet rest (lower voice running through the staff) | **+3 sp = +6 staff positions**, wholly above the top line |
| upper voice's whole-bar rest | hangs from the **top** line (+1 sp) |
| lower voice's crotchet + quaver rests (upper voice on mid-staff minims) | **−2 sp = −4 staff positions** (exact to the pixel) |
| lower voice's whole-bar rest | hangs from the **bottom** line (−3 sp) |

⚠️ Her upper-voice crotchet at **+3 sp** is **half** his hand-placed 6 (§1) — expected, since her
lower voice runs *through* the staff while ours sits on ledger lines *above* it, and p. 37 says
explicitly that a rest displaced by a note on a ledger line goes further still.

---

## 4. The four engines

⚠️ **Two things we believed going in were wrong**, both corrected by reading the clones:

- ⛔ **LilyPond's `\voiceOne`…`\voiceFour` do NOT set a rest's `staff-position`** — they set
  `direction` (`ly/property-init.ly:1000-1004` → `scm/music-functions.scm:704-712`, over
  `direction-polyphonic-grobs` at `:655-672`, which contains `Rest` and `MultiMeasureRest`). The
  vertical constant is **one** grob property: **`voiced-position = 4`** half-spaces
  (`scm/define-grobs.scm:2970`). ⭐⭐ **V3/V4 are vertically identical to V1/V2** — they differ only
  in `NoteColumn.horizontal-shift`. Our four-lane ladder has no counterpart in LilyPond.
- ⛔ **MuseScore 4 has no `computeLineOffset` / `checkVoices` / `_gap`** — split into
  `computeNaturalLine` + `computeVoiceOffset` + `computeWholeOrBreveRestOffset`
  (`restlayout.h:57-59`).

| | LilyPond | Verovio | MuseScore 4 | VexFlow 5 |
|---|---|---|---|---|
| unit | half-sp from middle, +up | `loc`: half-sp from bottom, +up | **whole** sp from top, **+down** | whole sp, 1 = bottom, +up |
| 1-voice default | whole +2, rest 0 | loc 6 / 4 | line 1 / 2 | line 4 / 3 |
| mechanism | fixed **direction** + ink collision | small default + **table on the other layer's `loc`** + same-layer mean + margin, combined by max/min | fixed **parity** + shape collision + **alignment pass** | ±1 nudge, same tick only |
| per-voice constant | **±4 half-sp** (±2 sp), duration-independent | none — the 4-D `g_defaultRests` | **±1 whole sp**, duration-independent | none |
| content-aware | ✔ note-head **ink** | ✔ note **`loc` integers, no ink** | ✔ **shape**, incl. stem | ✘ |
| sees a *sustaining* note | ✔ | ✔ | ✔ | ✘ |
| consistent per voice | ✘ | ✘ | ⭐ ✔ `alignRests` | ✘ |
| merges coincident rests | ✘ (TODO at `rest-collision.cc:128-130`) | ✘ | opt-in, overprints, default off | ⭐ hides the lower one |
| whole-bar rest | direction only, no collision | `MRest`: other layer's extreme **+4/−3**, floor loc 6/4 | voice offset + its own measure-wide pass (0.75 sp) | no concept |

⭐ **All four agree on the single-voice default**, in four different notations — the table already in
`restPlacement.ts`.

### 4.1 LilyPond — direction, then ink

`Rest::staff_position_internal` (`lily/rest.cc:47-145`): `pos = dir × voiced-position`, and
`if (duration_log > 1) return pos;` (`:79-81`) — so quarter/8th/16th/32nd are **literally ±4
half-spaces**, duration-independent; whole and half then snap to a staff line (`:99-129`).

Then `Rest_collision::calc_positioning_done` (`lily/rest-collision.cc:99-292`):

```cpp
Real y = dir * std::max (0.0, -dir * restdim[-dir] + dir * notedim[dir] + minimum_dist);  // :270
int discrete_y = dir * int (ceil (y / (0.5 * dir * staff_space)));                        // :275
if (staff_span.contains (get_position (rest) + discrete_y))                               // :280
  discrete_y = dir * int (ceil (dir * discrete_y / 2.0) * 2.0);                           // :283
```

`minimum-distance = 0.75` sp (`define-grobs.scm:2987`). It reads the other voice's **note-head ink**,
skipping the stem when the column points the other way (`:246-252`). ⭐ `rest-collision-engraver.cc:75`
— *"Include notes that started any time"* — **a sustaining note counts**, which is exactly our prelude's
case. ⭐⭐ A rest with an explicit `staff-position` is **skipped** (`:230-231`) — the same
override-wins seam our `restShift` already has.

### 4.2 ⭐⭐ Verovio — the outermost of four candidates, in pure integers

`Rest::GetOptimalLayerLocation` (`src/rest.cpp:387-422`) takes
`isTopLayer ? max{other, same, default, margin} : min{…}`. **No ink is measured at any point.**

- `g_defaultRests` (`:36-153`) — a 4-D table keyed layer × accidental × top/bottom × on-line/in-space
  × duration. Other-layer / `RA_none` / top / on-line: whole **+2**, half **+4**, quarter **+6**,
  8th **+4**, 16th **+6**, 32nd **+6**; bottom: −6, −6, −6, −4, −4, −6.
- margin floor `GetMarginLayerLocation` (`:586-601`) = 6/2, → **8** for a 16th on top.
- same-layer term = the mean of the voice's own neighbouring notes, clamped `loc ≤ 10 / ≥ −2`
  (`:503-509`). ⭐ **This is the "track your own voice" term his 67 placements fit.**
- ⚠️ **only 2 layers**; 3+ returns the default (`:366-367`).

### 4.3 MuseScore 4 — parity, shape, then the alignment pass

`finalLine = naturalLine + voiceOffset + wholeRestOffset` (`restlayout.cpp:128-135`), in whole spaces,
0 = top line, **+ down**. `computeVoiceOffset` (`:757-766`) is
`upSign = (voice==0||voice==2) ? -1 : 1`, `× (multiVoiceRestTwoSpaceOffset ? 2 : 1)` → **±1 space**,
the two-space style defaulting to `false` (`styledef.cpp:560`). Then
`resolveVerticalRestConflicts` (`:174-281`) works on the **Chord `shape()`** (noteheads **and** stem),
`minRestToChordClearance = 0.35 sp` (0.55 for whole/half), quantised to a whole space inside the staff
and a half space once clear (`:262-272`).

⭐⭐ Then `alignRests` (`:417-451`) snaps a per-(staff, measure, voice) group to its outermost y —
**the only real consistency pass in any of the four engines**, and the one that matters for a piece
like the prelude that repeats one figure for 35 bars.

### 4.4 VexFlow — effectively nothing, which is the gap we live in

Its default table is two rows and is normally bypassed: `if (props.key === 'R') { props.line =
(duration==='1'||'w') ? 4 : 3 }` (`:19620-19628`) — and **only** for the literal key `'R'`, so the
canonical `keys:['b/4']` gets its line from a fake pitch instead. Multi-voice is one ±1 nudge:

```js
else if (noteU.minLine <= noteL.maxLine + lineSpacing) {
    if (noteU.isrest) shiftRestVertical(noteU, noteL, 1);      // :19305-19307
```

`shiftRestVertical` is `rest.line += 1` (`:19188-19194`). `Formatter.AlignRestsToNotes` (`:6109`) is
**per-voice** (`:6182`) and **default off** (`:6707`). Coincident same-duration rests get
`noteL.note.renderOptions.draw = false` (`:19303`) — the only merge rule found anywhere.

⭐ **And we suppress even that ±1**, by re-asserting `intendedRestLine` after `format()`
(`VexFlowRenderer.ts:1979-1990`) — correctly, for our voice model. ⛔ **The consequence is that 100%
of this rule has to come from us. There is no library behaviour to fall back on.**
(⚠️ 2026-09-19: VexFlow is removed — the ±1 nudge is now our transcription, `engrave/notes/voiceStack`,
and the re-assert still overrides it.)

### 4.5 musxdom (Finale) — mechanism named, constants UNKNOWN

`LayerAttributes::restOffset` (*"Adjust Floating Rests by" staff steps*, `Others.h:928`), gated by
`onlyIfOtherLayersHaveNotes` (`:930`) / `useRestOffset` (`:931`), applied at `Entries.cpp:1021-1045`.
Every field is `{}` → 0, filled only from XML, so **no default constants are recoverable from the
source**. `NoteRestOptions::drop8thRest…drop128thRest` (`Options.h:968-972`) are declared and
**never read in `src/`**.

---

## 5. Where the sources agree, and where they genuinely differ

**Unanimous** (books and engines together):

1. The single-voice neutral position, in four notations.
2. Upper voice up, lower voice down — the **sign** is positional.
3. The magnitude responds to **surrounding content**, including a *sustaining* note from the other
   voice.
4. The result is **quantised** — nobody places a rest at an arbitrary height.

**Real disagreements, recorded rather than resolved:**

- ⚠️ **System A vs System B** (§3.2) — minimum displacement, or a fixed outer line for whole/half
  rests. Both documented, both engraved by Gould, neither adjudicated.
- ⚠️ **Ink or integers.** LilyPond and MuseScore measure drawn ink; Verovio measures nothing and
  works on diatonic positions alone. ⭐ This one has a consequence beyond taste — see §7.
- ⚠️ **Consistency across a bar.** MuseScore aligns per voice; nobody else does; Gould's p. 37 figure
  shows six different heights on one page.

---

## 6. What our code does today, measured against the above

`VexFlowRenderer.ts:1972-1998`:

```ts
const REST_LINE_STEP = 3
const REST_LANE = [0, -1, 1, -2]   // × 3, indexed by 0-based model voice
```

Three specific gaps, in order of how visible they are:

1. 🚨 **Voice 1 gets no lift at all** — `REST_LANE[0] = 0` leaves it on the middle line, while every
   engine with a fixed default puts the upper voice **above** it (LilyPond +2 sp, MuseScore +1 sp)
   and every book says *"above the centre stave-line"*. **This alone is the visible fault**, and it
   is what the 67 overrides were paying for.
2. 🚨 **Nothing reads the other voice.** `restShiftFor(slot)` sees `voiceOf(slot)` and the manual
   override, and nothing else — no pitch, no ink, no other lane. Three of four engines are
   content-aware; we are the fourth.
3. ⚠️ **The magnitudes are unsourced and large.** `REST_LINE_STEP = 3` is 3 staff spaces = 6 staff
   positions, against LilyPond's ±2 sp and MuseScore's ±1 sp; the comment says it is *"the one knob to
   retune the spread by eye"*. And the four-lane ladder has no counterpart in any engine —
   LilyPond's V3/V4 are vertically identical to V1/V2.

---

## 7. What the research constrains — ⛔ and what it does NOT decide

**Constrained by the evidence:**

- ⭐⭐ **The rule is LAYOUT, not paint.** It yields a line number, so it belongs beside
  `restStaffLine()` in `engine/layout/restPlacement.ts` — not as a third constant in the renderer.
  Principle 5's test decides it: a headless PDF export needs the identical positions, so the rule
  cannot live where only the editor's renderer can reach it. Principle 3 adds that the result is a
  derived view and ⛔ **must never be written back into the score or its JSON** — including as a
  one-off "materialise the computed shifts as overrides" for the prelude.
- ⭐⭐ **Verovio's shape is the only one that is unit-testable.** Integer arithmetic over diatonic
  positions and durations is a pure function of the model, checkable in jsdom; LilyPond's and
  MuseScore's `ceil()` over measured ink can only ever be exercised in the browser suite, because
  jsdom measures every glyph 0×0 (`reference_jsdom_cannot_measure_glyphs` — and the same trap sits in
  VexFlow's own `getTextMetrics()` at `:19229-19233`).
- ⭐ **The manual override survives, and has a precedent.** LilyPond skips collision entirely for a
  rest with an explicit `staff-position` (`rest-collision.cc:230-231`) — the same seam as our
  `restShift`, which stays a deviation from the computed position.
- ⛔ **A new MODULE, not a slice.** `CLAUDE.md`'s standing rule, and `restPlacement.ts` is already
  the module.

**⛔ NOT decided here — these are his:**

- Which system: **A** (minimum displacement, quantised) or **B** (fixed outer lines for whole/half)?
  Both are documented practice.
- Whether to add MuseScore's `alignRests` consistency pass. It is the only such pass in any engine,
  and the prelude is exactly the repeating texture that would show its absence — but Gould's p. 37
  figure is evidence *against* enforcing it in general.
  ⭐ **ANSWERED 2026-08-31: NO.** His call, after seeing the derived rule on his own score — *"i
  think we should not do p3, it makes no sense for me at the moment and i still dont see how it
  brings value"*. ⛔ The research stands as written; this line records that the question stopped
  being open, so nobody re-opens it as a finding.
- ⚠️ **What happens to `restShift` values already saved.** Moving the base changes the meaning of
  every stored `steps`: a saved `+6` currently means "+6 from centred" and would become "+6 from
  wherever the rule now puts it", i.e. doubled displacement. The prelude is cleared, so our test file
  is safe; any other file is not. ⭐ This is `feedback_a_shared_rule_changed_is_five_families_changed`
  in its exact form, and it needs a decision before the rule ships, not after.

---

## 8. ⛔ UNKNOWN — checked, not found

- **Crossing voices.** No source in the library addresses a rest when the voices cross.
- **Three and four voices.** No rest-height rule anywhere. Gould p. 313 handles four parts as
  **2 + 2 on two staves** (*"usually two voices are allocated to each stave, rests placed above or
  below the middle line"*); her *Three parts on a stave* section covers stems and horizontal
  displacement only. Gerou & Lusk p. 118: *"avoid combining three instruments on one staff."*
  ⚠️ Verovio declines the same question in code (`rest.cpp:366-367`).
- **Any stated NUMBER for rest-to-other-part clearance.** The books say "further away"; only the
  engines put a number on it (LilyPond 0.75 sp, MuseScore 0.35/0.55 sp), and those are
  implementation choices, not citations.
- **Which of System A / System B is correct.** Both documented; **no source adjudicates**.
- **Finale's rest-offset defaults** — the mechanism is in `musxdom`, the constants are not.
- **Stone** on anything but whole rests.
- **What Ross meant by "third staff line"** on p. 173, given his own plate contradicts it.
- **A real Bach edition.** ⛔ Not consulted — no web search was made, per the ordering rule in
  `reference/README.md`. So *"what does a published BWV 846 actually draw here"* is open, and it is
  the single most direct piece of evidence still missing.
