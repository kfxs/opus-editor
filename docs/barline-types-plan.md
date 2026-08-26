# Barline types — the final bar, the open repeat, the end repeat

> **Status: DRAFT for review.** All three research reports have landed (§10). Where they agree, this
> document decides; where a claim rests on one unverified source it is marked **⚠️ single-source**;
> where nothing could be established it says **UNKNOWN**, never a plausible number.
>
> **What exists today: a palette that logs.** `src/dev/devToolbar.ts` grew a `Barline:` row of three
> buttons (`Final`, `Open repeat`, `End repeat`); each calls `dbg()` and changes no score. That was
> the whole of the first ask — *"for the moment on clicking the palette we just console log and then
> we will see"* — and it is why this plan could be written before a model field constrained it.

---

## 0. ⭐⭐ SCOPE — three signs ship, the rest is HEADROOM

His, 2026-08-26, and it governs everything below:

> *"What we are going to do now is just final, open repeat and end repeat. It is important to think
> about other bar types so as not to restrict the design — but we will not add them when we execute
> the plan, for the moment."*

**What SHIPS:** the **final barline**, the **open repeat**, the **end repeat**. Nothing else.

**What the design must merely not FORECLOSE:** every other member of the family. ⛔ Thinking about
them is not a licence to build them, and this section exists so that a later reader cannot mistake
the research in §4 and §10 for a work list.

⭐ **Note what §3.2's split does to the count**: of the three signs asked for, **one is a barline
style and two are repeats**. So P1 ships a style union with a **single member** (`final`) plus two
repeat fields — and that is not a sign the union is over-engineered, it is the whole point of it.

### 0.1 The extension test — what each future member would cost

This is how "not restrictive" is *checked* rather than asserted. If the model in §3.2 is right, every
one of these is additive and touches nothing already built:

| future member | what adding it costs | who it touches |
|---|---|---|
| **thin double** `‖` | one union member + one drawing case + one pair-table row | nothing else |
| **invisible** (`none`) | the same three — **plus one UI decision** about whether an invisible line stays selectable (§10.1) | the drag, §6 |
| `heavy`, `dashed`, `dotted`, `tick`, `short` | one union member each | nothing else |
| **back-to-back repeat** `:‖:` | **zero model change** — it is already two facts (bar *N*'s `repeatEnd` + bar *N+1*'s `repeatStart`); only the DRAWING learns to combine them | the renderer only |
| **repeat count** (*"play 3 times"*) | already in the shape — `repeatEnd: { times? }` | playback, when it exists |
| **per-staff scope** | already stored from day one (§2), nothing reads it yet | the renderer, later |
| **voltas / endings** | ⛔ **NOT this model.** Every format makes an ending a *container of measures*, never a barline attribute | its own feature |
| **repeat PLAY ORDER** | ⛔ not this model either (§7) — it READS these fields, it does not live in them | its own feature |

⚠️ Only the last two are "restrictions", and both are deliberate: they are different objects, and
every format we checked agrees they are. A design is not restrictive for refusing to model two things
as one.

---

## 1. What a barline is here today

**It is not an object.** There is no `Barline` type, no id, no field: `score.measures` IS the barline
spine, and a barline is the boundary between bar *n* and bar *n+1*. Three consequences, all
load-bearing:

- **The selection names a boundary** — `{ kind: 'barline', measure: N }`, *the line that ENDS bar N*
  (`interactions/elements/barline.ts`, `docs/barline-selection.md` §1).
- **It is staff-less on purpose** — stated once for the system, drawn once per staff, like a meter.
- **The drawing agrees**: a bar draws only the line that ENDS it (`VexFlowRenderer.ts:2409` turns the
  opening line off except at bar 1 and a line start). That rule is a bug fix — two coincident lines
  cover their shared anti-aliased edge twice, and every interior barline read heavier than the ones
  opening and closing a system (`engine/rendering/barlineInk.ts`).

Two places already point at this feature by name: `selectionSnapshot.ts:355` calls the measure a
barline closes *"the address a barline TYPE would eventually be stored at"*, and
`docs/barline-selection.md`'s "Out of scope" names repeats/double/final bars with the reason to keep
them apart — **the KIND of barline is music, not layout.**

---

## 2. The scope call — system-wide FIRST, per-staff LATER, and ADDITIVE

His, 2026-08-26:

> *"For the beginning we will apply this bar change to all the staves of the system to make it
> practical, but in the future every stave of the system can also handle this separately. Classical
> music notation applies almost always to the whole system but contemporary music can mix individual
> staff and whole system."*

⭐⭐ **Read the last clause as the requirement.** "Per-staff later" alone would be satisfied by a
per-staff field replacing the system-wide one. **"Mix"** is not: a score must be able to say *the
system repeats here* and *staff 3 alone repeats there*, and in the hard case both at once.

Two things make that cheap, and neither is invented:

- **`DESIGN-PRINCIPLES.md` already names barlines as the removable assumption** — `Score.measures`
  stays the shared spine (*"barlines, meter aligned across staves"*), an assumption that **"must
  never be baked into content"**, with per-staff barlines the documented later path
  (`docs/multi-staff-plan.md` §11).
- **"Absent = ALL" is an existing rule here** — `Dynamic.voice`/`Hairpin.voice` absent means *every
  voice of that staff* (`utils/dynamicScope.ts`), the deliberate inverse of `utils/lanes`' "absent =
  the first one". A barline statement with no `staffId` governing the whole system is that rule one
  axis over.

⭐ **And the engines say the same thing structurally**: in all three, barline SPAN is a **staff or
group property, never a barline property** — MuseScore `Staff::barLineSpan`, LilyPond a separate
`SpanBar` grob, Verovio `@bar.thru` (default *off*). So "which staves this line covers" is already,
everywhere, a different question from "what kind of line is it".

**Committed:** what is stored carries an OPTIONAL staff scope from day one, absent = the whole
system. Nothing in P1 reads it. It is one optional field and a doc comment, and it is what keeps the
mix case from being a teardown.

---

## 3. The model

### 3.1 Where it lives — settled

On **`Measure`**, at the measure level (not inside a staff lane, not on `Score`).

- **Not on `Score`** — principle 6. A `Score.barlineStyle` would silently mean "the barline at bar 1",
  the conflation that cost `score.clef`, `score.tempo` and `keySignature` their places.
- **Measure-level, not per-lane** — `staffContent.staffMeasureView` narrows a measure by naming every
  per-staff array and letting the rest ride the spread, so a measure-level field reaches every
  staff's lane unfiltered. That IS the system-wide semantics of §2, for free.
- **Optional, absent = a plain line** — `docs/json-io-plan.md`: *"a new feature lands as an optional
  field whose absence is a legal score."* Old exports keep loading, no migration.

### 3.2 The shape — ⭐⭐ SETTLED, and it is NOT what the palette implies

The palette says three things of one kind. **They are two kinds**, and every format and engine that
revisited the question moved them further apart.

| sign | what it is | whose measure |
|---|---|---|
| **final** (thin + thick) | a barline **STYLE** | the bar it ENDS |
| **end repeat** `:|` | a **REPEAT** | the bar it ENDS |
| **open repeat** `|:` | a **REPEAT** | the bar it OPENS |

**⭐ Decision 1 — the style belongs to the measure the line ENDS.** Unanimous across the standards:
MNX says *"the barline drawn **at the end of this measure**"*; MusicXML's `location` **defaults to
`right`**; MEI calls `@right` *"**structurally important**"* and `@left` *"present here only for
facilitation of translation from legacy encodings… usually, it can be safely **ignored**"*; Finale
keys it to the measure and gives a *left* barline only to a system's first bar.

⭐ That is already our selection identity *and* our drawing rule — **we agree with the standards by
accident**, and the cheapest thing this plan can do is not break that.

**⭐⭐ Decision 2 — A REPEAT IS NOT A BARLINE STYLE.** This is the finding that dissolves the open
repeat's awkwardness, and it is not a preference:

- **MNX's `barline-type` list contains no repeat value** (`regular`, `double`, `final`, `heavy`,
  `heavyHeavy`, `heavyLight`, `dashed`, `dotted`, `short`, `tick`, `noBarline`); repeats are separate
  measure properties, `repeatStart` / `repeatEnd`.
- **SMuFL puts them in different ranges** — barlines U+E030–E039, repeats U+E040–E04D. The same
  statement, made in a font.
- **MusicXML shows the cost of merging**: an end repeat is `<bar-style>light-heavy</bar-style>`
  **and** `<repeat direction="backward"/>` — two fields to keep consistent — and the CG's own issue
  `w3c-cg/mnx#214` records that treating repeats as barline types *"means that it has to use a hack
  to implement mid-measure repeats… confusion about what is and is not a measure."*
- **MEI merged them** and had to invent **`rptboth`** to say "end repeat then start repeat" — a value
  that exists only because one slot could not hold two statements.
- **MuseScore, which is the closest to us in shape, splits them** — ✅ *independently confirmed*:
  the repeat is a **flag on the Measure** (`ElementFlag::REPEAT_START/REPEAT_END/REPEAT_JUMP`, bits in
  the generic element-flags word, read via `Measure::repeatStart()/repeatEnd()`), plus a
  `m_repeatCount`. Applying its combined `END_START_REPEAT` by hand *immediately decomposes into the
  two flags*.

  ⚠️ **One nuance, so the next reader does not think it contradicts §3.1**: in MuseScore the barline
  *style* lives on the **BarLine element** (`m_barLineType`), not on the measure — `Measure` stores
  **no type at all**, and `Measure::endBarLineType()` is **derived** by reading the element. But that
  element is `generated` and rebuilt every layout pass, sitting in a typed segment slot of its
  measure, so the durable statement is still per-measure. We keep the style **on the measure**, which
  is what MusicXML, MEI, MNX and Finale all do; the difference is where the transient drawing object
  lives, not where the fact does.

**⭐⭐ Decision 3 — ONE OWNER PER LINE.** This is the engines report's headline recommendation and the
one that saves the most code:

> Verovio holds `@left` **and** `@right` on every measure (`m_leftBarLine` / `m_rightBarLine` by
> value, `measure.h:434–435`) — and pays for it with `SetDrawingBarLines` (`measure.cpp:644`),
> ~60 lines of pure conflict resolution: merge `rptend`+`rptstart` into `rptboth`, suppress a plain
> line before a start repeat, split `rptboth` at a system break, plus a 6×6 lookup table. **That
> code exists only because two measures can name the same line.**

MuseScore avoids all of it: the start repeat is a flag on the FOLLOWING measure, the end barline
belongs to the PRECEDING one — one owner per line. **We copy MuseScore.**

So the shape:

```ts
// on Measure — the LINE that ends this bar
barline?: BarlineStyle           // 'double' | 'final' | … ; absent = the default RULE (below)
// on Measure — REPEATS: separate statements, not styles
repeatStart?: …                  // this bar OPENS a repeat   ( |: )
repeatEnd?: { times?: number }   // this bar CLOSES one       ( :| )
```

⭐ **What the split buys us specifically:**
- the **open repeat stops being an exception to the model** — it is a property of the bar it opens,
  which is where a reader would look, and the "a bar draws only the line that ends it" rule survives
  untouched *as a rule about barline styles*;
- **back-to-back repeats** (SMuFL `repeatRightLeft`) need no new vocabulary: bar *N* has `repeatEnd`,
  bar *N+1* has `repeatStart`, and the DRAWING combines them — which is exactly how all three
  engines do it (§4);
- a repeat **played but not drawn**, or drawn but not played, stays expressible (§7).

### 3.3 ⛔ NOT a question: there is no automatic final barline

**We do not have one today** — the last bar of a score draws a plain line like every other bar — and
**nothing in the ask changes that.** The three signs are PLACED, by hand, like every other mark in
this editor.

This section exists only so the question is not re-raised by the next person to read §11, because
the research does invite it: MNX resolves an absent barline as `final` on the last measure, and
MuseScore auto-adds one (`blType = nextMeasure ? NORMAL : END`). ⛔ That is those systems' choice,
not a requirement, and the other two decline — Verovio defaults to a plain single line, and LilyPond
adds no automatic bar of any kind, its own comment reasoning that *"the input is possibly not a
finished work"*. Gould agrees on the musical point: a final barline marks *"the actual end of the
piece"* (p. 240), which is a statement a composer makes, not a property of whichever bar happens to
be last in the file.

⚠️ It was raised here as an open decision in an earlier draft. That was scope arriving from the
research rather than from the request — **the plan builds the three signs asked for.**

### 3.4 The compiler will force one answer

Adding a field to `Measure` **stops `engine/rendering/measureRenderRoles.ts` compiling** until it is
classified `width`/`shape`/`identity`/`ignored`, and `measureRenderRoles.test.ts` then perturbs the
field and checks the keys really respond that way — so a *wrong* answer fails too.

**The answer is `width`** for all three fields: a final or repeat sign is wider ink than a plain line
(§5), so it changes how much room the bar needs.

---

## 4. The drawing — what the sources actually say

**Numbers are in staff spaces.** [T] = treatise, [E] = engine/font (an implementation, not an
authority), [M] = measured off a scan at 450 dpi.

### 4.1 The final barline

| | value | source |
|---|---|---|
| thick line | **0.50** — *"of beam thickness"*, and beam thickness is ½ space | Gould p. 39 + p. 17 [T] |
| thin line | **no treatise number exists** — *"thicker than a stave-line"* | Gould p. 38 [T] |
| thin → thick | **0.50 left-edge to left-edge** — her *"½ stave-space before it"* is edge-to-edge, **not** the white gap | Gould p. 39 [T] + five engraved bars pp. 238–239 [M] |
| measured ink | thin 0.15–0.20 · gap 0.30–0.35 · thick 0.45–0.50 · **total ≈ 1.00** | Gould pp. 238–239 [M] |

⭐ **Where it is used**: the end of a **movement**, not only of the piece (Gould p. 39, p. 240; Gerou
& Lusk p. 26). ⛔ **Attacca exception**: two movements running on without a break — the first takes a
**thin double**, not a final (Gould p. 39).

### 4.2 The repeat signs

⭐⭐ **The only numeric decomposition in any treatise we hold is a FOOTNOTE in Ross p. 147** (nothing
in his index points at it): *"the heavy line in the repeat bar is as thick as a beam (**one-half
space**); the white space, and the thin line following the heavy line, are **one-half space**; and
the two dots following the thin line are also **one-half space**; this makes a total of **one and a
half spaces**."* [T]

- **Order**: start repeat = **THICK → gap+thin → dots**; end repeat is its mirror. [T]/[E]
- Gould adds no numbers: *"These use the final double barline design together with repeat dots"*
  (p. 39) — the repeat **inherits** the final barline's geometry. [T]
- ⭐⭐ **Dot positions, 5-line staff**: centres **1.48** and **2.48** above the bottom line = the
  **2nd and 3rd spaces**, 1.0 apart (Gould p. 234 [M]) — and Bravura's precomposed `repeatDots`
  agrees to **0.01** [E]. All three engines compute the same two spaces *from the staff* rather than
  hardcoding them.
- **Dot diameter**: Gould ≈ **0.50** [M] vs Bravura `repeatDot` **0.40** [E]. **No treatise states
  one**, and no engine declares a radius constant — every one takes it from the font glyph.
- **Dots → thin line**: Gould **0.35** [M]; SMuFL `repeatBarlineDotSeparation` **0.16**; MuseScore
  **0.37**. **No treatise number.**
- ⭐ **Bravura's `repeatLeft` glyph is 1.464 wide — within 0.04 of Ross's stated 1½.** Two
  independent sources landing on the same total is the strongest corroboration in this file.

### 4.3 Back-to-back repeats — ⭐⭐ Gould DREW two designs, and both are legal

Gould p. 234: *"To repeat adjacent sections, use repeat barlines back to back. **Either of the
following designs may be used**"* — [M] **(A)** dots · thin · **one shared THICK** · thin · dots;
**(B)** dots · **THICK · THICK** · dots, no thin at the junction. ⛔ **Never two complete separate
repeat signs.**

[E] LilyPond predefines both (`":|.|:"` = A, `":..:"` = B) and **defaults to (B)**; MuseScore's single
combined type draws **(A)**; Verovio merges into one `rptboth`. ⭐ Two independent reports agree on
this row (the treatise agent read LilyPond's table, the engines agent MuseScore's draw path).

⚠️ MuseScore's combined type does not survive being applied: it **decomposes immediately** into
`REPEAT_END` on this bar + `REPEAT_START` on the next (`dom/measure.cpp:1771–1786`) — i.e. the
combined sign is a DRAWING, and the model keeps two flags. That is §3.2's decision, arrived at
independently by the engine closest to our shape.

⭐ **For us this is a DRAWING decision over two model facts** (bar *N*'s `repeatEnd` + bar *N+1*'s
`repeatStart`), which is exactly where §3.2 put it. Pick one design; the other is a later option.

### 4.4 System breaks

- Gould pp. 233–234, 487 [T]: *"Where possible, the beginning of a repeat should coincide with a new
  system."* And *"some editions place a **thin double barline at the end of a previous system** where
  a repeat barline starts the next system."*
- [E] LilyPond states the break behaviour declaratively — every bar type carries three variants
  (mid-line / end-of-line / start-of-line): a **start repeat prints at the beginning of the new line
  and nothing at the end of the previous one**; an **end repeat prints at the line end and is not
  repeated at the next line's start**; a combined sign **splits**. Verovio splits `rptboth` on a
  `SYSTEM_BREAK` flag.
- ⭐ **None of the three redraws a *courtesy* start repeat when a break falls mid-repeat** — ✅ now
  confirmed **by mechanism** rather than by absent grep hits, which is what a negative claim needs:
  MuseScore builds the start-repeat segment only from the measure's own `repeatStart()` flag, and a
  mid-repeat continuation bar does not carry it (✅ **independently confirmed** — a second reader
  found **no continuation-system reprint anywhere** in MuseScore's score-rendering directory, and a
  test in the tree deliberately straddles a newline with a combined repeat); LilyPond's plain `"|"` row has **begin-of-line
  `#f`**, so a plain barline prints nothing at a line start; Verovio's system-break branch splits
  only `rptboth` and otherwise assigns the measure's own encoded left, which is empty mid-repeat.
- ⚠️ **The near-miss that will mislead the next reader**: MuseScore *does* have a feature called
  repeat **courtesies** (`Sid::showCourtesiesRepeats`, and three dedicated segment types). It is
  gated on `repeatEnd()` and adds courtesy **clef / key / time signatures** at a repeat end —
  announcing what the music reverts to on the jump back. ⛔ **Not a barline**, and it does not
  falsify the line above.

### 4.5 Multi-staff — ⭐ the LINES run through the system, the DOTS do not

⭐⭐ **Unanimous, 3 of 3, by three DIFFERENT mechanisms** — which is about as strong as engine
evidence gets, and it has to carry the weight alone because the books say nothing:

- **MuseScore** — the dots are drawn inside each per-staff barline's own draw, off *that* staff's
  line count. (Only the optional bracket wings are span-aware, guarded on top/bottom staff.)
- **LilyPond** — in a SPAN glyph the dots character is a *replacement char* defined as a literal
  space, rendered as an empty stencil *"with the appropriate width"* — so the between-staff segment
  keeps the lines aligned and drops the dots.
- **Verovio** — dots are drawn once per staff in the staff loop; the through-connector between
  staves is a separate call with no dots.

**UNKNOWN in the treatises**: Gould p. 521 covers only the systemic barline; Ross pp. 151–152 says
which staves a barline *connects* and nothing about dots.

⭐ This matters for §2: "the line spans the system, the dots are per staff" is already a per-staff
fact inside a system-wide sign.

### 4.6 What this means for OUR drawing

1. **⚠️ The "no opening line" rule is a bug fix, not a default.** A start repeat is a NARROW
   exception to it — *this bar opens a repeat* — never a relaxation, or every interior barline goes
   back to being drawn twice and reading heavier than its neighbours.
2. **⚠️ The thick line is deliberately left as VexFlow draws it.** `barlineInk.ts` re-inks thin
   barlines and says why it does not touch a thick one: VexFlow draws it 3px where the convention is
   0.5 spaces (~5px here), and widening it is a **layout** change — the thin and thick are placed 2px
   apart inside a box VexFlow's own `layoutMetricsMap` sizes (`xMin: -5`), so a 5px thick line would
   swallow the gap and spill past the reserved room. ⭐ We now know the target number and the
   convergence behind it: **thick 0.50** (Gould [T], SMuFL [E], measured [M]; LilyPond is the outlier
   upward at 0.60, and its own comment admits it — *"we opt for a leaner look"*).
3. **⭐ Our thin line is already right.** `THIN_BARLINE_SPACES` is **0.16**, which is SMuFL's value
   and sits inside Gould's measured 0.15–0.20.
4. **`hintBarlines` hints thin lines only** — a repeat's thick line and dots will not be pixel-hinted.
   Known and accepted, not an oversight to rediscover.
5. ⭐⭐ **AND A CAUTION ABOUT SMuFL ITSELF, which arrived as a late correction.** It is tempting to
   read `engravingDefaults` as "what the font says, so what everyone draws". Neither engine that
   *could* read it actually does, out of the box:
   - **MuseScore** does not load them at render time. The parsing code exists, but its only consumer
     in the whole tree is the Style **dialog**, fired when a user changes the music font *and* ticks
     an "optimize style" box — opt-in and one-shot. Its real barline numbers are its own
     (**0.18 / 0.55 / 0.37**), authored to match its default font rather than pushed in by it. ⚠️ The
     reporting agent asserted the opposite, chased the consumer when an independent reader's silence
     did not match, and **retracted it**.
   - **Verovio** converts `engravingDefaults` only from an explicitly supplied file, and its shipped
     fonts carry none — verified three ways.

   ⇒ **Every engine ships its own numbers.** SMuFL's table is a well-chosen reference point, not a
   standard anybody defers to at runtime, and our taking 0.16/0.50 should be a decision we make on
   the evidence (§4.1's treatise numbers agree with it) — ⛔ never "because the font says so".
6. ⏭️ **A divergence to be aware of, not to act on now.** MuseScore does **not** scale barline widths
   to a staff's size by default — `Sid::scaleBarlines` is `false`, and its widths are style values a
   user can edit per score. Ours DO scale: `barlineInk` writes its px width inside a group that
   carries the staff's own scale, so a small staff gets a proportionally thinner barline. Neither is
   obviously right — a barline divides the SYSTEM, which is an argument for not scaling it, and this
   will matter the day §2's per-staff work meets `docs/small-staff-spacing`. ⛔ Not this plan's
   decision; recorded so it is not discovered as a bug.

---

## 5. Spacing — ⭐⭐ the sign is simply WIDER, and the width does the work

**⛔ There is no "extra space because a barline is final or a repeat".** No such sentence in Gould,
Ross or Gerou & Lusk, and no engine has such a constant: MuseScore's note↔barline padding and
LilyPond's `space-alist` are **identical for every barline type**.

That is the cleanest possible answer for us, because the machinery already exists:

- **The barline IS a column** (`engine/layout/measureColumns.ts`) — it has a position, it carries ink,
  and the gap before it is the same question as every other gap. That is what turned `BARLINE_PADDING`
  from a constant into two rows in the pair table (`note↔barline` 1.2, `rest↔barline` 1.65).
- So the change is **more ink in that column** — a **ROW**, never a constant elsewhere. Standing rule:
  ⛔ *a new drawn element adds a row to the pair table.*

⭐⭐ **The one idea worth stealing, and it is also the answer to §6.** LilyPond's
`NoteSpacing.space-to-barline` measures the distance from the last note to the **LEFT EDGE of the
barline group**, not to the line's position — so *a wide repeat sign does not steal room from the
note before it*. The engines report calls it the subtlest of the three, and it is the rule that keeps
a 1.9-space repeat sign from crushing the bar's last beat.

For us that means: **the wider ink grows to the RIGHT of the bar boundary**, and the note-to-barline
gap keeps measuring to where the plain line would have been.

Treatise corroboration for the gaps we already have: Gould p. 42 — *"allow a stave-space… **on either
side of a barline** before a notational symbol"*; p. 43 — *"stems must never come closer to a barline
than one space"*; Ross p. 143 — *"between the barline and the left side of the first note is one
space"* (1½ to the note's centre).

---

## 6. ⭐⭐ THE DRAG MUST KEEP WORKING — his constraint, and it decides the geometry

> *"Even if we have the different barline we should be able to change measure space by dragging, the
> same way we are doing now."*

This is a requirement on the FEATURE, not a nice-to-have, and it is the reason §5's last paragraph
matters. Three gestures hang off a barline today and all three must survive:

| gesture | what it does | where |
|---|---|---|
| **bar-width drag** (mouse, off the barline) | the bar's whole note space | `MouseController` + `layout/barWidthRoom` |
| **`Ctrl+←/→`** | the same, by keystroke | `shortcutWiring` |
| **`Shift+←/→`** | the **barline gap** — the line alone, music unmoved | `barlineSpaceKey` |

**⭐ THE INVARIANT THAT PROTECTS ALL THREE: `x` IS THE BAR BOUNDARY.** `barlineInk.ts` states it and
four readers depend on it — the spacing model measures the lead-in from it, `ElementRegistry`'s
`noteEndX` hit-box is placed at it, the selection highlight paints from it, and `barWidth.e2e`
asserts a drawn barline sits at the stave's own `x2`. It is also why the ink pass widens a thin line
**to the right only** and never re-centres it.

So the rule this feature adopts:

> **A barline sign of any width still has its LEFT EDGE at the bar boundary.** The extra ink of a
> final bar or a repeat grows to the right, into the next bar's lead-in — never leftward into the
> music, and never by moving `x`.

That is LilyPond's `space-to-barline` rule restated in our coordinates, and it makes the drag
arithmetic *unchanged*: every room calculation still measures to the same `x`.

**What genuinely has to change — three things, all small, all easy to forget:**

1. **The HIT-BOX.** The registered box is 4px wide, padded ±4. A final bar is ~1.0 space of ink and a
   repeat ~1.5–1.9 (≈9–17px at our staff size), so the grab target must grow with the SIGN or the
   drag starts off the ink. ⚠️ There is already a known small version of this bug on record: *"the
   final bar draws a thick end-bar slightly left of where the hit-box assumes the line is."* Widen the
   box from the sign's width, and keep `hitsNoteOrRestBody` — a fatter box must not start stealing
   the bar's last note.
2. **`measuredRoom` / `measuredBarlineGapRoom`.** They measure the drawn distance from the last
   column to the line; with a wider sign, *"the line"* must keep meaning **its left edge**, or every
   press of `Shift+←` silently loses the sign's width.
3. **A ROW in the pair table for the wider ink** (§5), so the bar asks for the room the sign takes.

⚠️ **And an e2e spec, because none of this can be tested in jsdom.** `e2e/barWidth.e2e.ts` already
asserts the barline sits at the stave's `x2`; the new spec is the same assertion **with a final bar
and with a repeat**, plus a drag that still lands where it was asked.

---

## 7. Playback — deliberately NOT in this plan

`engine/audio/playbackSchedule.ts` walks `score.measures` once, straight through. **Drawing `:|` is
ink; playing bars twice is a play ORDER**, and nothing in the model expresses one.

⭐ **All three engines and all three standards keep them apart, and several let them DISAGREE:**

- MuseScore's `RepeatList` is built from the measure flags + volta/jump elements and **never reads
  the barline's type** — ✅ the separation is total: `barLineType` does not appear in that file at
  all. Both the drawing and the playback hang off the same flags; neither derives from the other.
- LilyPond's `\repeat volta` is music-tree structure; the sign is a downstream graphical consequence,
  and `\unfoldRepeats` **rewrites the tree** for layout and MIDI alike.
- Verovio's playback is the MEI `<expansion>` tree — hand-encodable, and `--expand` physically clones
  the music, which changes what is *drawn* too.
- MusicXML has `<sound forward-repeat>`: *"a forward repeat sign is implied but not displayed."*
  MNX has the implied start repeat. Finale states repeat barlines are *"either purely graphical or
  fully functional for playback"*, with a backward repeat carrying its own **target**.
- **MIDI has no repeat event at all** — every application unrolls repeats on export.

⛔ So the sign must not silently change what Play does. A `:|` that alters playback with no way to see
or edit the resulting order is worse than one that only draws. A future play order READS these fields
as one input among several (voltas, jumps, `times`); it is not the same field.

---

## 8. Phases

**P0 — the palette. ✅ DONE.** Three buttons in `dev/devToolbar.ts`, `dbg()` only.

**P1 — the model + the core op.**
- the three `Measure` fields (§3.2), optional, each carrying the staff scope of §2. ⭐ **The style
  union ships with exactly ONE member — `final`** (§0): the other two signs asked for are the repeat
  fields, and no other style value is added until it is asked for;
- `engine/models/barlineOps.ts` — set / clear / read. A score operation: in the core, not on the
  facade (`DESIGN-PRINCIPLES.md` §5);
- a one-line delegator on `ScoreModel`, a one-line delegation on `MusicEngine` (where `saveOnly`
  records the undo entry);
- the `MEASURE_RENDER_ROLE` rows (`width`) and the perturbation test;
- unit tests beside the module: round-trip, absent-is-legal, and **a rebar / measure-insert keeps the
  fields on the right bars** (they are measure-owned, so an insert must not slide a repeat onto its
  neighbour).

**P2 — the drawing.** End style from the model; the start repeat as the narrow exception to the "no
opening line" rule; back-to-back as a drawing decision over two facts (§4.3); the pair-table row.
An `e2e/*.e2e.ts` spec — ⚠️ jsdom measures every glyph as 0×0, so a drawn position asserted in a unit
test agrees with itself and proves nothing.

**P3 — the drag (§6).** The hit-box from the sign's width; `measuredRoom` reading the left edge; the
e2e spec that the three gestures still land where they are asked.

**P4 — the gesture** (select-then-press vs arm-then-click — ⏳ still his call; the Time Signature
window's *APPLIES if selected, else ARMS* is the shipped precedent for having both). The palette's
three buttons stop logging and call `barlineOps`.

**P5 — Properties / Delete.** The type in the selection report; Delete = back to a plain line.

**⏭️ LATER, out of this plan:** the per-staff scope actually being READ (§2 stores it, nothing reads
it); the repeat PLAY ORDER (§7); the **thin double `||`**, which is the family's fourth member — not
asked for, but §4 already carries its rule and its 🚨 (below), so it is a row and not a redesign;
voltas / endings, which every format models as a *container of measures*, never a barline attribute.

---

## 9. 🚨 The finding that will bite whoever engraves the thin double

Recorded now so it is not rediscovered later. **Gould's prose says the thin double's two lines are
about ¾ of a stave-space apart. Her own five engraved thin doubles measure 0.45–0.55 left-edge to
left-edge (a gap of ≈0.30) — the same spacing she gives the final barline's thin↔thick, and about ⅔
of what she wrote.** Ross p. 152 repeats the ¾ in prose. **All three engines draw what she DREW.**

⭐ Third time in this library that the SCAN has beaten the SENTENCE (after the p. 111 slur formula and
the p. 103 hairpin aperture). The standing rule holds: **her drawing beats her formula.**

---

## 10. ⏭️ AWARENESS — contemporary music with NO barline and NO tempo

> His, 2026-08-26: *"in contemporary music there are places that we have no barline and no tempo…
> we have to think (not so much, because this is a future feature, but to be aware) how these things
> can be managed."*

Not built here, and not designed here. But most of it is **already answered**, and the answers change
one small thing about *this* plan — so they are worth stating now rather than rediscovering. Sources
are `docs/20c-notation-survey.md` §4 and our own model.

### 10.0 ⭐⭐ FOUR ABSENCES, NOT ONE — his correction, and it is the right one

> *"One thing is invisible barlines, and another thing is senza misura, no key signature, no music.
> I think at the moment no model in the industry manages this, but we should be able to apply it if
> we want to make real contemporary music."*

⭐ **He is right that they are different things, and that matters more than it sounds**, because the
tempting move — one "free notation" mode that switches them all off together — is exactly the model
error. They are four independent axes, and in our model each already has a **different** mechanism:

| the absence | what it actually is | where it lands here |
|---|---|---|
| **invisible barline** | a barline **STYLE** (`none` / `invis` / `noBarline`) | ⭐ a **ROW in the table this plan creates** (§10.1). The measure spine is untouched |
| **senza misura** | the **METER** axis | `Measure.timeSignature` stays **required** and gains a variant — *"no meter" is a KIND of meter* (§10.2) |
| **no key signature** | ⭐ **already our state** | `types/music.ts:2050` records that there is deliberately **no `keySignature` field**, and the shape one will take when built (`Measure.keys?`, carrying a `staffId`). Nothing to remove — and when keys arrive, ⛔ `fifths` is the *shorthand*, never the storage |
| **no music** | a passage that engraves nothing | `docs/rest-hide-plan.md` — a hidden rest *"is not removed — it is still real musical content (an empty beat must stay filled), it just stops engraving as a normal black glyph"* |

⭐⭐ **The pattern across the whole row is one idea**: in every case what disappears is the **INK**,
never the **CONTENT**. The bar stays, the meter stays, the beat stays filled. That is what keeps all
four cheap for us, and it is the same rule the barline family already follows — *the kind of barline
is music, not layout*.

**On "no model in the industry manages this" — partly true, and worth being exact about**, because
two systems do model pieces of it:

- **MEI** goes furthest: `<staff>` may sit **directly inside `<section>`** — genuinely unmeasured
  music with no `<measure>` at all. The survey's verdict is that this is **the expensive road, and
  nothing requires it of us**.
- **LilyPond** has the closest thing to a free MODE: `\cadenzaOn` / `\cadenzaOff`, where music
  *"does not count toward the length of a measure"* and which disables bar demarcation, numbering,
  accidental reset, auto-beaming **and automatic line breaks** in one switch.
- ⛔ But **no format models the four together as one first-class state**, and MusicXML cannot: its
  `<measure>` is **mandatory**. So his instinct is right about the combination even though two of the
  four have sanctioned encodings.

⚠️ **The honest boundary is §10.4**: these four are widenings we can afford. The step past them —
where **x-position IS duration** — is not, and it is a principle-3 contradiction rather than a
missing feature. If "real contemporary music" eventually means *that*, it is a second document kind,
not a flag on this one.

---


### 10.1 "No barline" is a ROW IN THIS VERY TABLE — not a future feature

Every format models an absent barline as **a kind of barline**, not as a missing one:

| | how "no line" is said |
|---|---|
| **MusicXML** | `<bar-style>none</bar-style>` — *"the barline can vanish"* |
| **MEI** | `invis` — *"Bar line not rendered"* — one of the 15 `data.BARRENDITION` values |
| **MNX** | `noBarline`, a plain member of the `barline-type` list |
| **MuseScore** | not a type at all — the element stays and `visible = false` |

⛔ **Not shipping now** (§0) — `none` is not one of the three signs asked for, and a value in the
union with no drawing behind it would be a lie the compiler cannot catch. ⭐ **What matters today is
only that the shape does not foreclose it**, and §3.2's does not: an invisible barline is a barline
STYLE like any other, so it is one union member, one drawing case (draw nothing) and one pair-table
row — plus the one UI question below, which is the only part that is not mechanical.

⭐⭐ **And what does NOT vanish is the SPINE.** MusicXML's `<measure>` is **mandatory** — *"you can
never escape the bar"* — and our `score.measures` is the same commitment. **A bar with no drawn
barline is still a bar**: the line is invisible, the measure is not gone. That distinction is the
whole of why "no barline" is cheap for us and "no measures" would not be.

⚠️ **The one real question it raises is a UI one, and it belongs to §6**: the selection, the
bar-width drag and the barline gap all hang off *drawn ink*, and our own rule is that **a press may
only reach ink** (`docs/barline-selection.md` §1a — a culled bar's invisible hit-box answering a
press is a bug we already fixed once). An invisible barline is exactly that situation on purpose. Two
honest options — keep it selectable (MuseScore keeps the element) or make it unselectable and move
the bar another way — and the choice is not obvious. ⛔ Do not settle it in passing.

### 10.2 "No tempo" is two different questions, and one of them is already done

- **No tempo MARK** — already how the model works. Tempo is positional (`Measure.tempos`), and an
  absent one resolves to `DEFAULT_TEMPO` **by rule, not by a stored default** — principle 6's own
  requirement that *"the resolution always bottoms out in a constant"*. Nothing to build.
- **No PULSE** — senza misura, unmetered, *cadenza*, free time. ⭐ This is the **METER** axis, not the
  tempo axis, and the survey's finding is the shape to copy: **"no meter" is modelled as A KIND OF
  METER, not as an absent one.** MusicXML puts `<senza-misura>` *inside* `<time>`, and its string
  content **is the symbol to draw** (typically `X`). Dorico's **open meter** is typed `X` and offers
  three display styles that map exactly onto SMuFL — nothing, `timeSigX` (U+E09C),
  `timeSigOpenPenderecki` (U+E09D). LilyPond does it as a mode (`\cadenzaOn` / `\cadenzaOff`:
  music that *"does not count toward the length of a measure"*, disabling bar demarcation, numbering,
  accidental reset, auto-beaming and auto line breaks).

  ⇒ For us: **`Measure.timeSignature` stays REQUIRED and gains a variant.** It does not become
  optional. That is a time-signature feature, not a barline one, and it is recorded here only so the
  two are not confused when someone says "no barline and no tempo" in one breath.

### 10.3 ⭐ The standards already have his MIXING case — and it is a barline fact

§2's "contemporary music can mix individual staff and whole system" has a sanctioned encoding, and
it is worth knowing the name: MusicXML's **`@non-controlling`** — *"the left barline in this measure
does not coincide with the left barline of measures in other parts."* ⚠️ Note the natural guess is
wrong: `<measure implicit="yes">` is **not** a free-measure hook, it only means the measure number
should never appear.

MEI goes further and allows `<staff>` directly inside `<section>` — genuinely unmeasured music with
no `<measure>` at all — and the survey's verdict on that road is that it is **the expensive one, and
nothing requires it of us**.

### 10.4 ⛔ Where this stops being a widening

The survey is blunt about the edge, and it is worth carrying so nobody promises it casually:
**senza misura, unmetered bars and invisible barlines are WIDENINGS** — a variant, a row, a module.
**Proportional / spatial notation is a CONTRADICTION**: its premise is that *x-position IS duration*,
and principle 3 forbids pixels in the model outright. Our `beat` is an exact `Fraction`, and a
`Fraction` cannot hold a centimetre.

⭐ And the related trap, which has caught a major composer: **proportional SPACING** (ordinary note
symbols laid out so distance ∝ duration — a layout policy we effectively already have) and
**proportional NOTATION** (the rhythmic symbol abandoned) are indistinguishable from the graphics
alone. *"Spacing is a rendering choice; freedom is a separate flag; they must never be the same
field."*

---

## 11. Sources — three reports, 2026-08-26

**A. The engraving treatises** (on disk; `reference/README.md` carries the full Q&A table added that
day). Gould *Behind Bars* pp. 38–39, 42–43, 233–235, 238–240, 487, 521; **Ross p. 147 footnote** —
the only numeric decomposition of a repeat sign in the library; Gerou & Lusk pp. 25–28 (prose, no
numbers). Measurements taken off scans at 450 dpi, 1 space = 20 px, ±0.05.

**B. The three engines** (`~/dev/engine-sources`, MuseScore `main`@`929d1e9`, LilyPond
`master`@`beedbfa`, Verovio `develop`@`efff0bc`).

⚠️ **Read this with its provenance, which is unusual and matters.** The reporting agent first
presented single-source greps as though they had been cross-checked, then **retracted that
unprompted** — its own sub-agents never reported, so there was no independent check. It then
re-opened every citation file by file. The outcome:

- **Two real errors found and corrected here**: a wrong path for MuseScore's padding table
  (it is `src/engraving/rendering/paddingtable.cpp`), and **a misattributed Gould quotation** — now
  quoted verbatim and hung on the decision it was actually written about (§3.3).
- **Everything else re-verified against the files**, including the two claims a decision rests on
  (§4.4's absent courtesy repeat, and MuseScore's auto-final — the latter now recorded in §3.3 only as a thing we deliberately do NOT do), each of which was strengthened from an
  absent grep result to a stated mechanism.
- ✅ **All three independent reads arrived** — one per engine, each opening the files itself. (They
  reached this session directly; their delivery back to the agent that spawned them had failed, which
  is why an earlier note in this file says they were outstanding.)
- ⭐⭐ **NO DISAGREEMENTS.** Every number, path and behavioural claim in §3, §4, §5 and §7 was
  confirmed. The independent reads also *sharpened* three things, now folded in: MuseScore's
  `Sid::scaleBarlines` default (§4.6), the fact that MuseScore's `Measure` stores **no barline type at
  all** — only repeat flags, with `endBarLineType()` derived (§3.2) — and that LilyPond predefines
  **five** back-to-back forms, not two, with `":..:"` the default (§4.3).
- ⭐ Verovio's numbers were confirmed with their unit derivation stated in its own source (1 MEI unit
  = **half** a staff space), and the claim that its shipped fonts carry **no `engravingDefaults`** was
  verified three ways — so its option defaults really are what it draws.
- ⚠️ **One conflation to keep watching.** The independent LilyPond reader *also* reached for the Gould
  p. 240 comment as the reason there is no automatic bar at the end. The comment is real and its
  wording supports the argument, but it governs `BarType::SECTION` — the **thin double** — and §3.3
  spells that out deliberately. The structural reason no final bar appears is separate: bars are
  emitted at measure **starts**, and the end of the music is not one.

⭐ Where a claim in this document IS corroborated, it says so — and the strongest cases are the ones
where a treatise and an engine agree without knowing about each other: Ross's 1½-space repeat sign
against Bravura's 1.464-wide glyph (§4.2), and the dots-per-staff finding reached by three different
mechanisms (§4.5).

**C. The online standards.** MusicXML 4.0 (`<barline location|bar-style>`, `<repeat>`, `<ending>`,
`<sound forward-repeat>`), MEI v5 (`@right` structural / `@left` legacy; the 15 `data.BARRENDITION`
values; `<ending>` as a container), MNX (`measure-global`'s `barline` / `repeatStart` / `repeatEnd` /
`ending` / `jump`, and the rationale in `w3c-cg/mnx#214`), SMuFL + Bravura 1.482 `engravingDefaults`.
⚠️ Three routes have MOVED and are now recorded in `reference/README.md`: SMuFL and MNX both left
`w3c.github.io`, and Bravura's metadata is `redist/Bravura.json` — ⛔ `bravura_metadata.json` 404s.

**UNKNOWN, reported honestly and not filled in:** a treatise number for the thin barline's thickness
(nobody states one); repeat-dot diameter and dot↔line distance as treatise numbers; repeat dots on
staves with other line counts (only LilyPond's algorithm); whether the dots repeat per staff on a
grand staff *from a book* (the engines say per-staff); any rule giving extra space *because* a
barline is final or a repeat (there is none); Dorico's internal storage model; Sibelius's
repeat-structure model.
