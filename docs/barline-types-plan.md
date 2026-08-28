# Barline types — the final bar, the open repeat, the end repeat

> **🏁 Status: BUILT (2026-08-26).** P0–P6 and §7 are shipped; what is left is listed at the end of
> §8. Where the research agreed, this document decided; where a claim rested on one unverified source
> it is marked **⚠️ single-source**; where nothing could be established it says **UNKNOWN**, never a
> plausible number.
>
> **WHERE THE FEATURE LIVES, for a reader arriving cold:**
> `engine/models/barlineOps.ts` (the score ops) · `engine/layout/barlineSign.ts` (⭐ what a sign is
> MADE OF — and the `SignHalf` rule three other things read) · `engine/rendering/BarlineRenderer.ts`
> (we draw every barline) · `engine/audio/repeatPlan.ts` (the PLAY ORDER) ·
> `interactions/barlineStamp.ts` (the gesture) · `interactions/elements/barline.ts` +
> `./repeatStart.ts` (the two selections) · **Insert ▸ Barline** and the Properties chooser (the
> doors) · **Play ▸ Play Repeats** + the dev shell's 🔁 (the performance).
>
> <details><summary>How it started: a palette that logs</summary>
>
> `src/dev/devToolbar.ts` grew a `Barline:` row of three buttons (`Final`, `Open repeat`, `End
> repeat`); each called `dbg()` and changed no score. That was the whole of the first ask — *"for the
> moment on clicking the palette we just console log and then we will see"* — and it is why this plan
> could be written before a model field constrained it. ⚠️ **Those buttons no longer exist**: they
> grew to five and were deleted on 2026-08-26 when Insert ▸ Barline arrived (P4's note, P6f).
>
> </details>
>
> **⭐⭐ REVISED 2026-08-26, after his question *"are we using VexFlow to draw? shouldn't we draw
> ourself following the own engine strategy?"*** — §4.6, §5, §6 and P2 are rewritten around the
> answer: **we draw it.** §4.6 is now the case for taking the barline from VexFlow (it passes
> `vexflow-boundary.md`'s test on four counts and is already half ours); §5 corrects a mechanism error
> (a pair-table row cannot reserve the sign's width — `naturalWidth` sums the gaps *between* columns,
> and the barline is the last one); §6 corrects the geometry (the sign grows **into its own bar**, not
> rightward). ⚠️ **The scope consequence is real and is §4.6.7: this takes ALL barlines, plain ones
> included.**

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

⭐ **And the engines say the same thing structurally**: barline SPAN is a **different question from
what kind of line it is** — MuseScore `Staff::barLineSpan`, LilyPond a separate `SpanBar` grob,
Verovio `@bar.thru` (default *off*). So "which staves this line covers" is already, everywhere, asked
apart from "what sign is this".

> 🚨 **CORRECTED 2026-08-28, from the source.** This paragraph used to say span is *"a staff or group
> property, **never** a barline property"*. Two agents reading the clones (`~/dev/engine-sources`,
> MuseScore `929d1e9` · LilyPond `beedbfa` · Verovio `efff0bc`) contradict the absolute, and it is the
> half a reader would quote:
>
> - **MuseScore keeps BOTH.** `Staff::m_barLineSpan` is the default, and **every `BarLine` item carries
>   a per-instance copy** (`dom/barline.h:178`) that layout re-seeds from the staff *while the item is
>   `generated()`* — the moment the user touches one it becomes a **local override** and layout stops
>   overwriting it (`barline.cpp:901`). It serializes as `<span>`. ⭐ That mechanism is worth more than
>   the correction: the exception EXISTS ONLY ONCE AUTHORED, and until then the default is live.
> - **LilyPond** is owned by the CONTEXT TYPE (`\consists Span_bar_engraver`, `ly/engraver-init.ly:474`
>   — inherited by GrandStaff/PianoStaff, `\remove`d by ChoirStaff), but carries a **positional
>   per-boundary veto**: `\once \override Staff.BarLine.allow-span-bar = ##f`, re-read every timestep.
> - **Verovio** is the only one where the absolute holds — `<staffGrp @bar.thru>`, read in one place
>   (`barline.cpp:87`), granularity per `<score>`, no mid-score change. ⚠️ It is a RENDERER of MEI and
>   not an editor, which is the likeliest reason.
>
> ⭐⭐ **The conclusion §2 drew survives, and is strengthened**: two of the three engines that can be
> EDITED implement exactly *default from the group/staff, exception at a boundary* — which is the
> "mix" requirement above, already shipped twice.

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

⚠️ **But note exactly what the compiler CAN force, because it is less than it looks.**
`MEASURE_RENDER_ROLE` is `Record<keyof Measure, …>` — per-measure, own-fields-only — so it asks *"what
does bar N's own field do to bar N's keys?"* and nothing else. A start repeat also changes the
**neighbour's** picture (bar *N* must not draw a line into it), and no answer in this table can say
so: classify all three `width`, the file compiles, the perturbation test passes, and bar *N* still
reuses a stale `<g>`. ⭐ §4.6.3 removes the question rather than answering it — with the drawing in a
score-level pass there is no cached measure group holding a barline to go stale. ⛔ That is a
dependency between §3.4 and P2, not a coincidence: revert P2 and this table needs a companion entry
in `ShapeKeyInputs`, the seam `crossBarBeams` and `cautionaryEndClef` already use for exactly this
kind of neighbour-decided picture.

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

### 4.6 ⭐⭐ WE DRAW IT — the barline is the next piece taken from VexFlow

His, 2026-08-26, on reading the first draft of this section: *"are we using VexFlow to draw? shouldn't
we draw ourself following the own engine strategy?"*

**Yes.** The first draft of §4.6 was a list of things VexFlow gets wrong and how we would live with
each one. Every item on it was an artefact of letting VexFlow draw, and the repo already has two
rules that decide this — pointing the same way.

#### 4.6.1 The boundary test, and this passes it

`docs/vexflow-boundary.md`: *take a decision from VexFlow when there is a **RULE we want to state and
cannot** — never because the decision is theirs.* Four rules this plan states are unsayable through
`Barline` (measured against `node_modules/vexflow/build/esm/src/stavebarline.js`):

| the rule §4 states | what VexFlow does |
|---|---|
| thick line = **0.50 spaces** (§4.1 [T][M]) | `fillRect(x-2, …, 3, …)` — **3 px, a literal** |
| the sign's ink stays **inside its own bar** (§6) | `END` inks x−5…x+1, `REPEAT_END` x−10…x+1, `REPEAT_BEGIN` x−2…x+10 — a fixed pixel layout we cannot address |
| dot centres **1.48 / 2.48** (§4.2, Gould [M] + Bravura [E] agreeing to 0.01) | ≈1.40 / 2.40 — a `dotRadius / 2` fudge in `drawRepeatBar`, ~0.1 space low |
| a sign scales with its staff, and its ink lands on whole device pixels | neither — and only because *we* post-process the one rect it draws |

And `docs/own-engraving-engine.md` states the rule directly, as the one to add beside the boundary
test:

> **A new drawn element draws through OUR context and OUR primitives — never by instantiating a
> VexFlow class.**

A final bar and a repeat are new drawn elements. Trills, ottava, pedal, hairpins, ties, slurs, fans
and the dynamics line already obey it.

#### 4.6.2 ⭐ This is FINISHING a piece, not opening a front

The barline is already half ours, and the half we still take from VexFlow is one `fillRect`. One
plain barline currently costs three passes:

1. VexFlow `fillRect(x, topY, 1, height)` — 1 px, a literal, inside the measure's `<g>`;
2. `inkBarlines(group)` (`VexFlowRenderer.ts:1863`) rewrites that rect's width to `THIN_BARLINE_PX`;
3. `hintBarlines(svg)` (gated at `VexFlowRenderer.ts:4001`) rewrites its `x` onto the device grid.

We already overrule VexFlow on both the **weight** and the **position** of every barline on the page.
⛔ And the usual argument against taking a piece — `vexflow-boundary.md` §4's *"years of accumulated
correctness about glyphs, stems and fonts"* — has no purchase here: a barline is rectangles and two
dots. There is no accumulated correctness in `fillRect(x, topY, 1, height)`.

#### 4.6.3 ⭐⭐ The pass, and what it DISSOLVES

`engine/rendering/BarlineRenderer.ts` — a **score-level pass**, taking the shape the four beside it
already take (`VexFlowRenderer.ts:3922–3954`):

```ts
renderBarlines(pass, score, placements, staffIds)   // beside renderHairpins / renderTrills /
                                                    //   renderOttavas / renderPedals
```

Every stave gets `setEndBarType(Barline.type.NONE)` alongside the `setBegBarType` already at
`VexFlowRenderer.ts:2409`, and the pass draws every barline in the score — plain ones included.

⭐⭐ **Rebuilt from scratch each render, it dissolves the hardest problem in this plan.** §3.2's *ONE
OWNER PER LINE* settles the model; it does **not** settle the picture, because bar *N* draws a line
at the same x where bar *N+1* would open a repeat. Delegated to VexFlow that is a genuine
cross-measure dependency — bar *N*'s picture decided by bar *N+1*'s field — and `MEASURE_RENDER_ROLE`
**cannot express it**: that table is `Record<keyof Measure, …>`, per-measure and own-fields-only, so
classifying the three fields would compile, pass the perturbation test, and still leave bar *N*
reusing a stale `<g>`. That is exactly the silent failure `measureRenderRoles.ts`'s header opens with.

A score-level pass ends it the way the ottava's does: **no measure's cached group can hold a stale
barline, because none of them holds one at all** (`MEASURE_RENDER_ROLE.ottavas: 'ignored'`, and its
comment is the argument verbatim). The suppression is then a local read in one place that sees both
bars *and* the casting-off:

> **Bar *N* draws no end line when bar *N+1* opens a repeat AND SITS ON THE SAME SYSTEM.**

⚠️ **The system condition is not decoration.** Drop it and a bar whose successor opens a repeat on
the *next* line ends its system with no barline at all. `placements` carries `system`, so the pass
can ask; a per-measure key cannot. This is also what §4.4's engines do — LilyPond prints the start
repeat at the beginning of the new line and nothing at the end of the previous one.

#### 4.6.4 What the pass absorbs, and what follows it

- **`inkBarlines` and `hintBarlines` fold into it.** Three passes become one: we draw the rect at the
  width and the device-aligned x we want, first time. ⭐ The hinting *rule* survives intact and is
  worth keeping — `barlineInk.ts`'s measured phase table is the reason it exists — but it stops being
  a DOM rewrite of somebody else's rect. ⚠️ It also removes a defect the delegated version would have
  had: hinting moves a thin rect by up to half a device pixel and leaves an unhinted thick one alone,
  so a two-line sign's own white gap would wobble from bar to bar.
- **The numbers come from the seam we already have.** `engravingDefault('thickBarlineThickness')` is
  **0.50** and `engravingDefault('barlineSeparation')` **0.40** in `engine/fonts/bravuraMetrics.ts`,
  beside the `thinBarlineThickness` **0.16** that `thinLineWeight.ts` already reads.
- ⚠️ **Three followers, all mechanical, none optional:** `e2e/harness.ts:314`'s `barlines()` reader
  selects `g.vf-stavebarline rect` and returns one row per rect — it must move to the pass's own group
  and cope with a sign being 2–3 rects plus dots; `e2e/barWidth.e2e.ts` reads it; and the
  `__barlines` census in `App.ts:827`.
- ⏭️ **The selection highlight becomes answerable.** `HighlightController.applyBarlineSelectionHighlight`
  paints a 2 px rect and says so: *"3 for a thick end bar, which this deliberately does not fully
  cover"*. Once we own the sign's extent, the highlight can cover the whole sign instead of
  apologising for it. §8 P5.

#### 4.6.5 ⭐⭐ A caution about SMuFL that survives the move — and is now sharper

It is tempting to read `engravingDefaults` as "what the font says, so what everyone draws". Neither
engine that *could* read it actually does, out of the box:

- **MuseScore** does not load them at render time. The parsing code exists, but its only consumer in
  the whole tree is the Style **dialog**, fired when a user changes the music font *and* ticks an
  "optimize style" box — opt-in and one-shot. Its real barline numbers are its own
  (**0.18 / 0.55 / 0.37**), authored to match its default font rather than pushed in by it. ⚠️ The
  reporting agent asserted the opposite, chased the consumer when an independent reader's silence did
  not match, and **retracted it**.
- **Verovio** converts `engravingDefaults` only from an explicitly supplied file, and its shipped
  fonts carry none — verified three ways.

⇒ **Every engine ships its own numbers**, and now so do we. ⭐ Note this is *not* an argument against
reading `bravuraMetrics.ts`: it is an argument against reading it **instead of deciding**. The right
position on 0.50 is the strong one — Gould's *"of beam thickness"* [T], five engraved bars measured at
450 dpi [M] and Bravura [E] agree, *and* the number is already wired. ⛔ Never "because the font says
so"; ⭐ always "because three independent sources agree, and here is the seam".

⚠️ **And one number where they do NOT agree, recorded because we now own the choice.** SMuFL's
`barlineSeparation` is **0.40** (a white gap); Gould's own engraved finals measure **0.30–0.35**
(§4.1). Her drawing beats her formula (§9) — and it should beat the font here too. **Use 0.32.**

#### 4.6.6 ⭐ The scaling divergence stops being a side effect

MuseScore does **not** scale barline widths to a staff's size by default (`Sid::scaleBarlines` is
`false`); its widths are style values a user can edit per score. Ours DO scale — but only because
`inkBarlines` writes its px width inside a group that happens to carry the staff's scale. That is an
accident of which `<g>` the rect landed in, not a decision.

Drawing it ourselves makes it a decision, and the pass must state it: a score-level pass draws
outside the measure group, so it scales explicitly (`inStaffSpace` / `staffSpacesToPixels`, the seam
`PedalRenderer` already uses). ⛔ **Still not this plan's call which way** — a barline divides the
SYSTEM, which is an argument for not scaling it — but P2 must now write one line saying which it did,
where §2's per-staff work and `docs/small-staff-spacing` will find it.

#### 4.6.7 ⏳ The scope consequence, stated plainly

⚠️ **This takes ALL barlines, not only the three signs**, and that is a real widening of the ask.
A half-take does not work: to suppress bar *N*'s plain line before a start repeat you must tell
*VexFlow* not to draw it, which is a per-bar decision needing the neighbour — straight back into the
shape key and back to §4.6.3's silent bug. The plain single line has to move with them.

What it is NOT: it does not touch `Stave`, which stays what `own-engraving-engine.md` says it is —
**a coordinate system** (`lineYPositions`, `noteEndX`, `getYForLine`). We stop asking it to paint one
kind of mark, and nothing else changes.

---

## 5. Spacing — ⭐⭐ the sign is simply WIDER, and the width does the work

**⛔ There is no "extra space because a barline is final or a repeat".** No such sentence in Gould,
Ross or Gerou & Lusk, and no engine has such a constant: MuseScore's note↔barline padding and
LilyPond's `space-alist` are **identical for every barline type**.

That is the cleanest possible answer for us, because half the machinery already exists:

- **The barline IS a column** (`engine/layout/measureColumns.ts:491`) — it has a position, it carries
  ink, and the gap before it is the same question as every other gap. That is what turned
  `BARLINE_PADDING` from a constant into two rows in the pair table (`note↔barline` 1.2,
  `rest↔barline` 1.65).
- Those rows stand unchanged. ⛔ **No new pair-table row is needed, and one would not help** — see
  the correction below.

### 5.1 🚨 A PAIR-TABLE ROW CANNOT RESERVE THE SIGN'S WIDTH

An earlier draft said the change was *"more ink in that column — a ROW, never a constant elsewhere"*.
That conflates two different mechanisms, and the plan has to be exact about which one is missing:

- `pairPadding(left, right)` is the **blank BETWEEN two inks**. It governs the gap before the
  barline, and it is already right.
- The sign's own width is an **ink extent**. And `naturalWidth` is the sum of the gaps *between*
  columns (`engine/layout/spacing.ts:288`); the barline is the **LAST** column, its ink is
  `{ left: 0, right: 0 }`, and there is no column after it — **so its right extent is summed into no
  gap at all.**

⭐ This is the exact symmetric twin of a bug this codebase has already found and fixed on the other
side. `measureLeadIn`'s own doc comment (`measureColumns.ts`) records it:

> *"**⚠️ The FIRST column's own left extent, which the width never counted at all.** `naturalWidth`
> sums the gaps BETWEEN columns, so `columns[0].extent.left` appears in no gap: an accidental on a
> bar's first note bought exactly no room, and the drawing made room for it anyway out of everything
> else in the bar."*

Read that sentence with *last* and *right* substituted and it is this section. ⇒ **Two terms are
owed, and neither is a pair-table row:**

| term | who pays | reachable? |
|---|---|---|
| **trailing** — the width of the sign that ENDS this bar (`final`, `repeatEnd`) | bar *N*, as a trailing extent beside `LeadIn` | ✅ it is bar *N*'s own field |
| **leading** — the width of a start repeat, which sits inside the bar it opens | bar *N+1*, folded into `measureLeadIn` | ✅ it is bar *N+1*'s own field |

⭐⭐ **§3.2's ONE OWNER PER LINE is what makes both of those local.** Each sign's room is owed by the
bar that *stores* it, so neither term needs to read a neighbour — which is why the model decision
pays off here and not only in the drawing. (Contrast the *suppression* rule of §4.6.3, which is a
picture question and genuinely does read the neighbour. Room and ink are different questions; only
one of them crosses the barline.)

⚠️ `measureLeadIn(measure, clefFor, sizeFor)` takes one measure and no score. The leading term stays
inside that signature; ⛔ do not widen it to take the previous bar — that would re-introduce the
cross-bar read the model just eliminated.

### 5.2 ⭐⭐ LilyPond's `space-to-barline`, which is also the answer to §6

`NoteSpacing.space-to-barline` measures the distance from the last note to the **LEFT EDGE of the
barline group**, not to the line's position — so *a wide repeat sign does not steal room from the
note before it*. The engines report calls it the subtlest of the three, and it is the rule that keeps
a 1.9-space repeat sign from crushing the bar's last beat.

With §5.1's trailing term that is exactly what we get: the bar reserves the sign's width, so the last
note is pushed left by it and the drawn gap between ink and ink stays the 1.2 / 1.65 the pair table
already asks for. **The room is reserved by the bar; the gap keeps measuring to ink.**

Treatise corroboration for the gaps we already have: Gould p. 42 — *"allow a stave-space… **on either
side of a barline** before a notational symbol"*; p. 43 — *"stems must never come closer to a barline
than one space"*; Ross p. 143 — *"between the barline and the left side of the first note is one
space"* (1½ to the note's centre).

---

## 6. ⭐⭐ THE DRAG MUST KEEP WORKING — his constraint, and it decides the geometry

> *"Even if we have the different barline we should be able to change measure space by dragging, the
> same way we are doing now."*

This is a requirement on the FEATURE, not a nice-to-have, and it is the reason §5.2 matters. Three
gestures hang off a barline today and all three must survive:

| gesture | what it does | where |
|---|---|---|
| **bar-width drag** (mouse, off the barline) | the bar's whole note space | `MouseController` + `layout/barWidthRoom` |
| **`Ctrl+←/→`** | the same, by keystroke | `shortcutWiring` |
| **`Shift+←/→`** | the **barline gap** — the line alone, music unmoved | `barlineSpaceKey` |

**⭐ THE INVARIANT THAT PROTECTS ALL THREE: `x` IS THE BAR BOUNDARY.** `barlineInk.ts` states it and
four readers depend on it — the spacing model measures the lead-in from it, `ElementRegistry`'s
`noteEndX` hit-box is placed at it, the selection highlight paints from it, and `barWidth.e2e`
asserts a drawn barline sits at the stave's own `x2`.

### 6.1 ⭐⭐ THE RULE: the sign grows INTO ITS OWN BAR; the DIVIDING LINE stays on the boundary

⚠️ An earlier draft of this section said *"a sign of any width keeps its LEFT EDGE at the bar boundary
and grows RIGHTWARD"*. **That is wrong for two of the three signs**, and it is worth recording why,
because the reasoning behind it was sound and only the conclusion was not.

Two facts kill it:

- **The staff lines END at `x2`.** A sign growing rightward from the last bar's boundary would hang
  its thick line and its dots past the end of the drawn staff lines, attached to nothing.
- **The dots of `:|` belong to the bar being repeated.** §4.2 has the reading order: a start repeat is
  THICK → gap+thin → dots, and *an end repeat is its mirror* — dots · thin · **thick**. The thick line
  IS the divider; everything else in the sign precedes it. Same for the final bar: thin then thick
  (§4.1), so its ~1.0 space of ink sits to the LEFT of the line that ends the piece.

So:

| sign | whose bar | where the ink goes |
|---|---|---|
| **final** | the bar it ends | thick line's **right edge at `x`**; thin + gap grow **left**, ≈1.0 space |
| **end repeat** `:‖` | the bar it ends | thick line's **right edge at `x`**; thin + dots grow **left**, ≈1.5 |
| **open repeat** `‖:` | the bar it opens | thick line's **left edge at `x`**; thin + dots grow **right**, ≈1.5 |

> **A sign's ink occupies room INSIDE the bar that stores it. The dividing line never leaves the
> boundary.**

⭐ **His constraint is satisfied just as fully, and by a better route.** He asked that *"even if we
have the different barline we should be able to change measure space by dragging, the same way we are
doing now"* — a requirement on the **drag**, not on which way ink grows. Under this rule `x` never
moves, so the drag arithmetic is **unchanged**: every room calculation still measures to the same `x`,
`barWidthRoom`'s slopes are untouched, and `barWidth.e2e`'s "the barline sits at the stave's `x2`"
still holds — of the dividing line, which is the one anybody points at. What changes is only that the
bar now **reserves** the sign's width (§5.1), which is LilyPond's `space-to-barline` exactly.

⛔ Note this rule is only available to us because §4.6 takes the drawing. VexFlow's `END` inks
x−5…x+1 and its `REPEAT_BEGIN` x−2…x+10 on a fixed pixel layout; the direction is not addressable
from outside.

### 6.2 What genuinely has to change — four things, all small, all easy to forget

1. **⭐ ONE OWNER FOR THE SIGN'S EXTENT.** A pure `barlineSignExtent(score, measureNumber)` in
   `engine/layout/` returning the ink's reach either side of `x`, read by **all four** consumers: the
   trailing/leading width terms (§5.1), the hit-box (3), the pass that draws it (§4.6.3), and the
   selection highlight. ⚠️ It must be a pure function of the score and **not** a lookup into the pass:
   `ElementRegistry` registers a barline box for **every bar in the score, painted or not**
   (`ElementRegistry.ts:692`), so registration happens for bars the pass never draws.
2. **The HIT-BOX.** `VexFlowRenderer.ts:3317` registers `{ x: x + width - 2, width: 4 }`, padded ±4
   by `interactions/elements/barline.ts`. A final bar is ~1.0 space of ink and a repeat ~1.5
   (≈9–14 px at our staff size), so the grab target must grow with the SIGN — leftward now, per §6.1
   — or the drag starts off the ink. ⚠️ Keep `hitsNoteOrRestBody`: a fatter box must not start
   stealing the bar's last note, and it now reaches further into that note's column than the ±4 pad
   ever did.
3. **`measuredBarlineGapRoom`** (`engine/layout/measuredRoom.ts:150`) measures the drawn distance from
   the last column to the bar's `noteEndX` and floors it at `pairPadding(note|rest, 'barline')`. With
   a leftward-growing sign that floor must become **`keep + signExtent.left`**, or `Shift+←` will
   happily squeeze the bar's last note into the repeat dots. ⭐ `noteEndX` itself keeps meaning what
   it means — the boundary — which is the whole point of §6.1.
4. **The two width terms of §5.1**, so the bar asks for the room the sign takes in the first place.

⚠️ **And an e2e spec, because none of this can be tested in jsdom.** `e2e/barWidth.e2e.ts` already
asserts the barline sits at the stave's `x2`; the new spec is the same assertion **with a final bar
and with a repeat**, plus a drag that still lands where it was asked, plus the §6.1 direction claim
(*the dividing line is at `x2`; the sign's other ink is to its left*). ⚠️ `e2e/harness.ts:314`'s
`barlines()` reader returns one row per `<rect>` and must be taught the pass's group and the fact
that one sign is several rects — see §4.6.4.

⛔ **One stale citation removed.** An earlier draft cited a known bug — *"the final bar draws a thick
end-bar slightly left of where the hit-box assumes the line is"* — as precedent for (2). It is not
observable: no score bar sets an end barline type today (the only `Barline.type` write in the
renderer is the `NONE` at `VexFlowRenderer.ts:2409`; every other `setEndBarType` is a ghost's temp
stave). The hit-box still has to grow; it just has no prior offence on record.

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

**P0 — the palette. ✅ DONE, and since DELETED.** Three buttons in `dev/devToolbar.ts`, `dbg()` only —
the scaffolding this plan was written against. They grew to five (P6c) and went out on 2026-08-26
when Insert ▸ Barline gave the family a real door (P4's note, P6f).

**P1 — the model + the core op. ✅ DONE** (`types/music.ts`, `engine/models/barlineOps.ts` + its spec,
the `ScoreModel` / `MusicEngine` delegators, `measureRenderRoles` + `MeasureWidthCache`,
`ScoreModel.validateBarlines`). ⚠️ **Two things it deliberately left standing, both recorded here so
they are not found as bugs:** (a) the staff scope is STORED and read by nobody — `staffMeasureView`
carries a barline statement to every lane unfiltered, which IS the system-wide semantics of §3.1, and
its comment now names the spot the scope filter goes; (b) a REBAR that grows its region leaves each
sign on the bar that stored it — a barline is a boundary fact with no beat to re-anchor, so it does
not ride `captureBeatAnchors` — which means a `repeatEnd` on the last bar of a region can end up
mid-passage after a meter change. ⏳ Whether it should follow the region's new END boundary is a
question for the gesture (P4), when there is a user putting one there.
- the three `Measure` fields (§3.2), optional, each carrying the staff scope of §2. ⭐ **The style
  union ships with exactly ONE member — `final`** (§0): the other two signs asked for are the repeat
  fields, and no other style value is added until it is asked for;
- `engine/models/barlineOps.ts` — set / clear / read. A score operation: in the core, not on the
  facade (`DESIGN-PRINCIPLES.md` §5);
- a one-line delegator on `ScoreModel`, a one-line delegation on `MusicEngine` (where `saveOnly`
  records the undo entry);
- the `MEASURE_RENDER_ROLE` rows (`width`) and the perturbation test — ⚠️ reading §3.4's caveat about
  what that table can and cannot force;
- ⭐ **a `validateBarlines` at the load boundary.** `ScoreModel.fromJSON` is a bare `JSON.parse`
  assigned onto `model.score` (`ScoreModel.ts:3425`), so these fields survive a round-trip with no
  work — and an unknown style string or a `repeatEnd: { times: 0 }` enters just as freely. `fromJSON`
  is the ONE door such a value can take (`barlineOps` refuses it), and it already guards exactly this
  way twice: `validateMeters` and `validateStaffSizes`, both of which **throw** rather than repair.
  ⛔ Report, never repair — silently clamping a hand-written 0 would make the file and the picture
  disagree (`docs/json-io-plan.md`);
- unit tests beside the module: round-trip, absent-is-legal, the load rejection, and **a rebar /
  measure-insert keeps the fields on the right bars** (they are measure-owned, so an insert must not
  slide a repeat onto its neighbour).

**P2 — ⭐⭐ THE DRAWING, and we draw it (§4.6). ✅ DONE** — `engine/layout/barlineSign.ts` (the pure
sign: its strokes, its dots, its extent, and which sign a boundary carries) + `engine/rendering/
BarlineRenderer.ts` (the pass) + `e2e/barlineTypes.e2e.ts`. 5178 unit + 232 e2e green.

⭐⭐ **THE DOTS ARE A GLYPH, and that was HIS catch** — *"i think we are using bravura glyph,
correct?… what are the other engines doing, especially musescore? is it best practice not to use the
glyph?"* The first version drew them as `ctx.arc` circles. Read in source, **3 of 3 engines draw the
SMuFL code point** `repeatDot` U+E044: MuseScore `drawSymbol(SymId::repeatDot, …)`, Verovio
`DrawSmuflCode(…, SMUFL_E044_repeatDot, …)`, LilyPond `ly:font-get-glyph … "dots.dot"` — and both C++
engines size the sign from the glyph's *measured* width (`symBbox(…).width()`,
`GetGlyphWidth(…)`) rather than from a constant. In Bravura the dot happens to be a perfect
0.4-space circle, so the arc looked identical **in this font** and would have been wrong in the first
one whose repeat dot is a hand-drawn blob. ⇒ `repeatDot` is now a row in `bravuraMetrics` (measured
off our own `public/fonts/Bravura.otf`, cross-check passed) and the pass draws the glyph.

⭐ **And the same reading settles the LINES the other way, permanently:** all three draw those as
plain strokes off their own style numbers (`painter->drawLine` + `Sid::barWidth`,
`DrawVerticalSegmentedLine` + `m_barLineWidth`, `bar-line::draw-filled-box` + `hair-thickness`).
⛔ Nobody stamps `barlineFinal`, and the font says why: that glyph's box is 1.06 × **4.0** and
`repeatLeft`'s is 1.464 × **4.0**. Four staff spaces is a five-line staff and nothing else, while a
barline must span whatever it is drawn on. That SMuFL publishes `thinBarlineThickness` /
`thickBarlineThickness` / `barlineSeparation` at all is the corroboration: a font does not tell you
how thick to draw a glyph you are meant to stamp. ⇒ **the split is the best practice — strokes drawn,
dots stamped** — and it is not a preference to revisit.

⚠️ **Two places the build diverged from this section, both deliberate and neither hidden:**

1. **The line at a system's LEFT EDGE stays VexFlow's** (`setBegBarType` + `inkBarlines` inside the
   measure group). §4.6.7's argument for taking *all* barlines is about END lines — bar *N*'s plain
   line must move with the signs because suppressing it needs the neighbour — and a system's opening
   edge has no neighbour to agree with. The one exception is a first-in-line bar that OPENS a repeat:
   there the boundary's sign is `|:`, the begin bar is turned off and the pass draws it.
2. **`hintBarlines` did NOT fold into the pass.** It cannot: it reads the *measured* screen CTM to
   verify its own premise, and that scale does not exist at draw time (the transform above the SVG is
   written after the first render — the bug its own header records). `inkBarlines`' rewrite is gone,
   which was the real cost; hinting stays a post-pass. ⭐ A composite sign now **opts out of hinting
   entirely** (`data-no-hint`), which is §4.6.4's defect answered rather than inherited: aligning the
   thin stroke of a two-stroke sign while leaving the thick one puts the sign's own 0.32-space gap out
   of agreement with itself in every bar that has one.
   ⚠️ **And the hint GATE is spent.** `redrawn > 0 || barlinesMoved` is gone: a pass rebuilt every
   render makes every barline rect new, so the answer is always yes. That is §12.7's 9% back on the
   table, and `VexFlowRenderer.incrementalRedraw.test.ts` now asserts the new truth. ⏭️ Buying it back
   means hinting at draw time, which needs a device scale the pass would have to be handed.

⭐⭐ **AND A SECOND CATCH OF HIS, which fixed a bug P2 shipped with:** *"what about the first bar open
repeat, what if I deliberately want to apply it? what does the literature say about this?"*

Two treatises answer, independently and in the same direction:

- **Gould p. 234**, *Placing changes of clef, key signature and time signature*: *"When there is a new
  clef, key signature or time signature at the beginning of a repeated section, place the repeat marks
  **afterwards**."*
- **Ross p. 147** gives the same order as three numbered spacings — a repeat bar after a **clef** is
  5½ spaces from the clef's left side to the repeat's left; after a **key signature** 3½ from the last
  accidental; after a **time signature** 3½ from its left side.

⇒ **header first, then `|:`.** The first build drew the sign on the bar's own left boundary, which on
any bar with a header draws it straight through the clef. Fixed: `BarlineRenderer.displacedRepeatX`
puts a displaced sign one space before the first note, and **a displaced repeat suppresses nothing** —
it never stands on the boundary, so the line that opens the system (or the previous section's own
end repeat) keeps its place. ⚠️ That last clause is the second half of the bug: without it a mid-line
bar carrying both a clef change and a `repeatStart` would have ended up with **no line at its
boundary at all**.

⭐ **And on the question as he asked it:** Gould p. 233 — *"Repeat barlines frame a section to be
repeated, **except where the repeat is from the beginning of a piece, in which case no initial repeat
barline is needed**"* — and p. 234's parenthesis, *"(If the example above were the opening of a piece,
the initial repeat barline would be unnecessary.)"* ⛔ That is advice to the COMPOSER, not a
constraint on the editor: an initial `|:` is conventionally omitted because a repeat returns to the
beginning by default, but if it is asked for it is drawn. `e2e/barlineTypes.e2e.ts` pins bar 1's case.

⭐⭐ **And his follow-up settled that it is not just permissible but WANTED** — *"i also remember that
sibelius allow to place it if the user want… it will be good to allow the user place the barline at
the beginning of the piece if he explicitly decides to"*. Checked in source, **all three engines allow
it**, and the two that differ differ only in the DEFAULT:

- **MuseScore** — no first-measure exception exists anywhere: `measurelayout.cpp:315` is
  `if (measure->repeatStart())` → create the segment. Placed is drawn.
- **LilyPond** — off by default, on by an explicit property (`bar-engraver.cc:448`:
  `if (!first_time_ || printInitialRepeatBar)`), and its manual gives the musical reason: *"By
  default, a starting bar line is not automatically printed at the beginning of a piece, in
  accordance with classical engraving conventions. However, in some contexts, these bar lines are
  **traditionally added, such as in lead sheets for jazz standards**."*
- **VexFlow** — `setBegBarType(REPEAT_BEGIN)` on any stave; it has no notion of a first measure.
- ⛔ **Sibelius — UNKNOWN**, no source to read. His recollection is recorded as his.

⭐⭐ **Why we need no `printInitialRepeatBar` of our own, and it is §3.3's decision paying off twice.**
LilyPond derives the sign from `\repeat volta` STRUCTURE, so it has to decide whether to *infer* one
at the start of a piece — which is what the property overrides. We never infer: the three signs are
PLACED, like every other mark in this editor. There is nothing to suppress, so there is nothing to
switch back on, and the permissive behaviour he asked for is what the model already gives.

⏭️ **What P2 did NOT do, on purpose:** the two width terms of §5.1 (a bar does not yet RESERVE the
sign's room — the ink is drawn inside its own bar and may crowd the last note there), the hit-box,
and `measuredBarlineGapRoom`'s floor. All three are P3, and `barlineSignExtent` — the one owner they
all read — is already built and unit-tested.

<details><summary>The original P2 plan, as written</summary>

The single largest step, and the one that decides
whether §4.6.3's silent stale-picture bug can exist at all.

- `engine/rendering/BarlineRenderer.ts` — a **score-level pass**, `renderBarlines(pass, score,
  placements, staffIds)`, beside `renderHairpins` / `renderTrills` / `renderOttavas` /
  `renderPedals` (`VexFlowRenderer.ts:3922–3954`). ⛔ Not a VexFlow `Barline`; our context, our
  primitives (`own-engraving-engine.md`'s rule).
- `setEndBarType(Barline.type.NONE)` on every stave, beside the `setBegBarType` at
  `VexFlowRenderer.ts:2409` — ⚠️ **and every barline moves, plain ones included** (§4.6.7). The pass
  absorbs `inkBarlines` and `hintBarlines`; `barlineInk.ts`'s hinting *rule* survives, its DOM
  rewrite does not (§4.6.4).
  - ⚠️ **One thing to VERIFY, not assume, when that line lands.** `Stave.format()` ends with
    `endX = endModifiers.length === 1 ? x + width : x`, so `getNoteEndX()` — read at ten sites,
    including the registered `noteEndX` and `spacingPass` — is immune to the end barline's type in
    the common case, **but not when the bar carries a cautionary clef or meter** (`addEndClef` /
    `addEndTimeSignature`, i.e. exactly the last-of-line bars §6 already calls the hard ones). There
    `endModifiers.length > 1` and `endX` is walked back through each modifier's layout metrics, where
    `NONE` and `SINGLE` differ. `barWidth.e2e` is the instrument; ⛔ do not reason about it in jsdom.
- The geometry of §6.1: the dividing line on the boundary, the rest of the sign inside its own bar.
  Numbers from `engravingDefault()` — thin **0.16**, thick **0.50**, separation **0.32** (⚠️ §4.6.5:
  the scan beats the font on that last one), dots at **1.48 / 2.48**.
- **The suppression rule**, which is the reason this is a pass and not a per-measure draw: *bar N
  draws no end line when bar N+1 opens a repeat **and sits on the same system*** (§4.6.3). ⚠️ Drop
  the system clause and a bar whose successor opens a repeat on the next line ends its system with no
  barline at all.
- **Back-to-back** as a drawing decision over two model facts (§4.3) — bar *N*'s `repeatEnd` plus bar
  *N+1*'s `repeatStart`, combined here and nowhere else. Pick one of Gould's two designs; the other
  is a later option.
- ⭐ One line stating whether the sign scales with its staff (§4.6.6) — the pass draws outside the
  measure group, so it now has to say.
- **Followers:** `e2e/harness.ts:314`'s `barlines()` reader (one sign is several rects), the
  `__barlines` census (`App.ts:827`).
- An `e2e/*.e2e.ts` spec — ⚠️ jsdom measures every glyph as 0×0, so a drawn position asserted in a
  unit test agrees with itself and proves nothing.

⭐ **What P2 does NOT need, and this is the payoff.** No entry in `ShapeKeyInputs` for the neighbour's
`repeatStart`, and no cross-measure term in any render key: a pass rebuilt from scratch each render
cannot hold a stale barline, because no measure group holds one (`MEASURE_RENDER_ROLE.ottavas`'
reasoning verbatim). ⛔ If P2 is ever descoped back to letting VexFlow draw, that entry becomes
mandatory and §4.6.3 is the bug report waiting to be written.

</details>

**P3 — the drag (§6.2). ✅ DONE** — all four items, plus `e2e/barlineSignRoom.e2e.ts`.

- **The trailing width term cost NOTHING, and that is §6.1 paying off a second time.** §5.1 predicted
  a new term "beside `LeadIn`"; it is not needed. That section was written while the sign still grew
  RIGHTWARD, where its ink would have fallen past the last column into no gap at all — the symmetric
  twin of `measureLeadIn`'s own bug. §6.1 reversed the direction, so the ink now lands in the gap
  BEFORE the barline column, which `naturalWidth` already sums. ⇒ one line in `measureColumns`: the
  barline column's ink box takes `barlineSignExtent(ownEndSignKind(measure)).left`.
- **The LEADING term is real**, because a start repeat's ink is inside the bar that BEGINS at the
  boundary, where no gap covers it: `repeatStartRoom(measure)`, added by BOTH readers of the lead-in
  — `MeasureLayout`'s `sharedOverhead` and `applyLeadIn` — so the room and the drawing agree.
- **The hit-box** grows leftward with the sign (`registerStaffAndGeometry`). ⏭️ It does **not** cover
  the NEIGHBOUR's `|:`, whose ink is right of the boundary; that needs the next measure's fields and
  the function is handed a lane, so it is owed together with P5's highlight.
- **`measuredBarlineGapRoom`'s floor** is now `pairPadding + signExtent.left`, so `Shift+←` cannot
  squeeze the last note into the dots. It takes the `Measure` for that.

⭐ **What the browser measured, and it corrected a wrong assumption of §5.1's.** The bar does not
push its last note left; it either absorbs the sign inside the gap's existing SPRING (a quarter earns
~3.5 spaces, a final bar's 0.98 fits inside it and costs nothing) or, when the sign is wider than the
spring, raises the gap's FLOOR and asks the line for more room. Both are correct; what may never
happen is the ink closing on the note, and that is what the e2e asserts.

🚨🚨 **AND A BUG HIS TESTING FOUND, which P2 shipped and P3 fixed** — *"the final bar and one of the
simple bar that are in the second stave [have] been stolen from the first stave"*, then *"the bug
occurs when i add another staff"*, with a screenshot of barlines floating in blank space below a
system. **A bar whose SHAPE has not changed is REUSED**: the renderer keeps the old `Stave` and moves
the drawn group with a `transform` (`replaySnapshot`), so that stave reports where the bar was LAST
PAINTED. Ink inside the group rides the transform; a score-level pass draws outside it and does not.
Adding a staff pushes every bar down without changing one shape, so every barline drew at the
previous render's y. ⇒ `BarlineRenderer.staleShift` takes the position from the PLACEMENT.

⭐ **Why no other score-level pass shows it:** the reuse decision refuses to translate a bar holding a
span endpoint (`if (anchors.has(plan.measureNumber)) return`), so hairpins, slurs, ties, ottavas and
pedals always get fresh staves. ⛔ A barline is on EVERY bar and can never be protected that way.
⚠️ Third time reused coordinates have bitten this feature — the selection highlight was the first
(docs/barline-selection.md, *"the coordinates LIE"*). Pinned by an e2e that nudges staff spacing and
asserts **no barline rect sits at a y where no staff was drawn**.

<details><summary>The original P3 plan, as written</summary>
 `barlineSignExtent` as the one owner of the number; the hit-box grown from
it (leftward, per §6.1); `measuredBarlineGapRoom`'s floor raised by the sign's left reach; the e2e
spec that the three gestures still land where they are asked.

</details>

**P4 — the gesture. ✅ DONE 2026-08-26** — `interactions/barlineStamp.ts` (+ spec),
`PaletteController.pressBarline`, the `barline` member of `MarkingTool`, one row in
`MouseController`'s dispatch chain, `engine/rendering/BarlineGhost.ts` (+ spec), and the dev
palette's three buttons wired to it.

> ⚠️ **Those buttons are GONE (2026-08-26).** They grew to five (P6c) and were deleted the same day
> Insert ▸ Barline arrived — *"just delete the barline palette in the shell dev"* — on the rule the
> Lines row went out under: *"a dev-shell palette earns its place while a feature has no real door;
> this one now has one."* ⭐ The gesture is untouched; only the door moved. What decided it was the
> thin double `||`, whose sixth row would have to be added to an array **nothing checks**, where
> `lint:tables` holds `BARLINE_SIGNS` total and `insertMenu.test.ts` pins the menu's rows.

⭐⭐ **HIS ANSWER TO THE QUESTION BELOW — and it was "both, obviously"**: *"isn't it on a palette?
same behaviour of any palette: if nothing selected stamp, if a barline is selected apply to the
barline, if a whole measure is selected apply in relationship with the semantic: an endbar is always
on the right, an open is on the left side of the measure"*. So the table's two options were never
alternatives; the cost of arm-then-click is paid, and select-then-press comes free on top of it.

⭐ **The whole rule is ONE table**, `BARLINE_SIGNS` (total over `PlacedBarlineSign`,
`npm run lint:tables`): each sign carries the **SIDE** of a measure it stands on — `final` and
`repeatEnd` right, `repeatStart` left — plus the one line that writes it. The three gestures are then
the same sentence read three ways:

| what is selected | where the sign lands |
|---|---|
| nothing (or notes) | the tool ARMS; the clicked BAR gets it, on the sign's own side |
| a barline (`ends measure N`) | the same line read as a side: right → bar *N*, left → bar *N+1* |
| a measure range | right → its LAST bar, left → its FIRST bar |

⭐ It is also what makes an initial `|:` reachable: bar 1's LEFT side is a bar that exists, so no
boundary before bar 1 has to be selectable (and none is). ⚠️ A NOTE selection deliberately names no
bar — his three cases are a barline, a measure, or nothing — so a press with notes selected arms.

⭐⭐ **THE GHOST USES THE PRECOMPOSED GLYPH, and that was his call twice over.** It shipped ghostless
(blue cursor) on the argument that a barline stands on a boundary and never at the pointer — the
pedal's argument, already overturned once: *"where is the ghost? i see you are using the blue cursor,
but we need ghosts for every case using the glyph"*. Then, on the first build drawing the sign out of
the pass's own strokes: *"why the only thing is blue in the ghost is the dots?"* — because the shared
recolour paints `text, path` and `ctx.fillRect` makes `<rect>`s. ⇒ *"isn't it easy to use the bravura
glyphs for ghost?"* It is, and here it is also RIGHT: `barlineFinal` U+E032, `repeatLeft` U+E040,
`repeatRight` U+E041, one `<text>` each. ⛔ The PASS still strokes its lines — a precomposed glyph's
box is a fixed 4 staff spaces and an engraved barline spans whatever staff it is on — but a ghost has
no staff, which is the one case the glyph is correct by construction.

⭐⭐ **AND THE DISPLACED REPEAT'S DISTANCE WAS WRONG** — *"look how close is initial repeat barline
from time signature"*. Measured: the sign's thick stroke began at x 84 where the meter's ink ends at
86 — a 2 px OVERLAP — with 2.4 spaces of air between the sign and the first note. The cause was the
anchor: `displacedRepeatX` measured back from `getNoteStartX()`, which is not where the note's ink
lands (109.4 against a notehead at 123.4). It now measures FORWARD from the header's own ink, which
is what the rule is about ("place the repeat marks afterwards"), at **{@link HEADER_TO_REPEAT} = 1.0
staff space**:

| source | what it says |
|---|---|
| **Ross p. 147** | 3½ spaces from the **left side of the time signature** to the repeat's left (5½ after a clef, 3½ after a key signature's last accidental) — plate distances with plate glyph widths; with Bravura's 1.9-space `4` it leaves 0.6 before the first note, under his own p. 143 minimum |
| **LilyPond** | `TimeSignature.space-alist (staff-bar . (extra-space . 1.0))` — Clef 0.7, KeySignature 1.1 |
| **MuseScore** | `timesigBarlineDistance` **0.5 sp** (clef 0.5, keysig 1.0) |
| **Verovio** | `leftMarginBarLine` default **0.0** |
| **Gould** | the ORDER only (p. 234). ⛔ No distance — UNKNOWN, not "silent" |

1.0 is LilyPond's, and it is exactly half of `HEADER_TO_NOTE`, so the sign lands with a space either
side of it by construction rather than by luck.

### ⭐⭐ P4a — A BAR THAT CARRIES A SIGN RESERVES ROOM FOR IT (2026-08-26)

**His report, two screenshots of the same empty score:** without repeats it *"does not look so
bad"*; with a `|:` on bar 1 it *"looks completely incorrect"*. Measured, 64 empty bars, staff spaces:

| | bars on the line | bar 1 total | bar 1's silence | the others' |
|---|---|---|---|---|
| no `\|:` | 9 | 14.7 | 6.1 | 9.0 |
| with `\|:` | 8 | 17.0 | 6.9 | **10.1** |

⚠️ **The repeat does not cause the disparity** — the ratio is 68% either way. `MIN_MEASURE_WIDTH`
floors the bar AS SEEN, so a mid-line empty bar is lifted from 7.65 to 10 and the lift lands in its
silence, while a bar carrying a clef and meter is already past the floor and keeps the rule's 6.0.
⭐ What the sign changes is what the EYE reads as the bar: a repeat sign IS a barline, so the measure
visibly begins at it, and the span after it is read as a whole measure drawn two-thirds the size of
its fellows. (It also costs the line a bar, which widens the neighbours and sharpens the contrast.)

⇒ **The rule, stated once:** *the floor measures the bar's MUSIC, and any barline sign the bar
carries is added to it.* Leading side = everything before the first note a plain bar does not have
(header + `HEADER_TO_REPEAT` + the sign); trailing side = `barlineSignExtent(...).left` (0.98 for a
final, 1.54 for an end repeat, 0 for the plain line). ⭐ **Both ends, and at every position — his
correction**: *"if you are going to do that then you should compensate also all end repeat"*.

⚠️ Added to the **floor**, never to the natural width, so it moves only the bars the floor decides —
the empty and near-empty ones, which are exactly the bars whose spring would otherwise swallow the
sign. A bar with no sign is untouched: his second screenshot is byte-identical (14.71 / 6.11 / 8.96).

⛔ **TWO WIDER FIXES WERE TRIED AND BOTH REPORTED THE SAME HOUR** — do not re-propose either without
re-reading this: flooring every empty bar's *silence* (*"why is empty measure so big now?"*, and it
also flattened the meter ordering `e2e/spacing.e2e.ts:479` pins), and dropping the floor for empty
bars altogether — LilyPond's own model, since it has no per-measure minimum at all — (*"first bar
width grew a lot… this is not wanted"*, and mid-line bars shrank from 10 spaces to 7.4). The general
asymmetry they were aimed at is still there and is **`docs/bar-width-plan.md` "Known issues" #1's
neighbour**: bar 1's silence is 68% of a mid-line bar's whenever the floor decides both. He has seen
the numbers and left it standing.

<details><summary>The original P4 question, as written</summary>

**P4 — the gesture** (⏳ still his call; the Time Signature window's *APPLIES if selected, else ARMS*
is the shipped precedent for having both). The palette's three buttons stop logging and call
`barlineOps`.

⚠️ **The two options do NOT cost the same, and the earlier one-line version of this phase hid that.**

| gesture | what it costs |
|---|---|
| **select-then-press** (a barline is already selectable, and `←`/`→` already walk barlines) | `barlineOps` + one `PaletteController` method. Nothing else. |
| **arm-then-click** | a member in the `selectedMarkingTool` union (`interactions/EditorState.ts`), a row in **`MARKING_TOOL_USES_ARMED_LENGTH`** — ⚠️ one of the four tables `npm run lint:tables` holds TOTAL, so this is enforced, not optional — and, if the armed tool previews, a `GHOST_DRAWERS` row + a `ToolGhost` member (`engine/rendering/ghostTypes.ts` + `interactions/toolGhost.ts`, since the engine may not import the editor's vocabulary) |

⭐ That asymmetry is an argument, not a verdict: *"a barline is already a thing you select"* is the
cheapest route **and** the one that reuses a gesture the user already has. ⛔ But arm-then-click is
what every other stamp in this editor does, and consistency is a real reason. ⏳ **His call; this
table is so the price is on the table when he makes it.**


</details>

**P5 — Properties / Delete / the highlight. ✅ BUILT (2026-08-26).** Three of his reports in one
sitting, and the second of them turned the phase from a highlight tweak into a new selectable KIND.

**P5a — the recolour.** The selection recolours the sign's own ink instead of painting a 2 px rect
beside it, and grows any stroke thinner than 2 px to 2 px. Why this does not retract *PAINT, don't
RECOLOUR* is `docs/barline-selection.md` §3a.

**P5b — ⭐⭐ THE OPEN REPEAT IS ITS OWN SELECTION** (`{ kind: 'repeatStart'; measure }`,
`interactions/elements/repeatStart.ts`). 🚨 *"I can not highlight open repeat on the beginning of the
score"*. The `barline` kind names *the line that ENDS bar N*, which cannot reach two signs, and the
first is not a missing hit-box but a missing identity:

- **the `|:` opening bar 1** — there is no bar 0 to name it by, and the sign is not even AT a
  boundary: a bar with a header displaces its repeat past the clef/meter (§4.6.4, Gould p. 234), and
  bar 1 always has one;
- **the right half of a `:||:`** — *"when we have open+end and I choose it, it highlights everything
  but it should highlight just the part that was clicked"*. Two statements, one drawn sign.

⭐ So the model's *ONE OWNER PER LINE* became a selection rule: the sign is owned by the bar it
OPENS. The hit-box is registered **by the drawing pass** (`BarlineRenderer.registerRepeatStart`),
which closes the ⏭️ note left in `VexFlowRenderer`'s tier-1 registration — that function is handed a
lane and no score, and cannot know either where a displaced sign went or whose it is. ⚠️ It sits
AFTER the barline in `ELEMENT_HIT_ORDER`: the two boxes grow away from the boundary and overlap only
where the barline's ±4 px pad crosses it, and that ink is the shared divider — the line itself, and
where the bar-width drag is grabbed.

**P5c — ⭐⭐ WHICH HALF OF A SIGN LIGHTS UP** (`SignHalf`, `barlineSign.ts`). Every stroke and dot the
pass draws now carries `data-half`, and the rule is read off §6.1's geometry rather than tabulated
per kind: **the divider is `shared`, everything left of it is the ending bar's, everything right the
opening bar's.** A selection lights `half` **plus `shared`**, so each half of a `:||:` is a COMPLETE
repeat sign — its dots, its thin stroke, and the thick line Gould's design (A) has the two share.

> 🚨🚨 **AND NEVER A FRAGMENT — his correction, from the running app.** The first build could light a
> bare thick line, in the one case where a bar owns no ink at the boundary it ends: bar *N+1*'s `|:`
> REPLACES bar *N*'s plain line, so the divider was all bar *N* had. *"Here we highlight just the
> thick… this is incorrect, we should always highlight the music semantic and no part of it."*
> ⭐ **So a selection with no ink of its own lights the WHOLE sign standing on its line.** It changes
> nothing in the other three cases: a sign nobody shares is entirely its owner's.

**P5d — Delete.** ⚠️ It **overturns a stated non-behaviour**: `shortcutWiring` reasoned that a
barline is a BOUNDARY with nothing to delete. Right about the identity, wrong about the consequence —
since P1 that boundary can carry a STATEMENT, and that is the thing Delete takes. ⛔ It still never
merges two bars. Each selection takes its own: `clearBarline(N)` for the line ending bar *N*,
`setRepeatStart(M, false)` for the `|:` opening bar *M*.

> ⛔ **`clearBarline` no longer clears `repeatStart`, and the change is the point.** Its first draft
> did, defended as *"the gesture treats both of a bar's boundaries as one target"*. The gesture no
> longer does — that is what P5b bought.

**P5e — the report.** `selectionSnapshot` carries the barline's `style` + `repeatEnd` in `data`, and
the DRAWN sign (`signAtBoundary`) in `derived` — the latter because it is a fact about TWO bars and
is stored nowhere. The `repeatStart` kind reports its own row.

---

## 8a. P6 — the PROPERTIES chooser, the eraser, the invisible line, and the WINGS ✅ BUILT (2026-08-26)

Everything below came from him in one sitting, mostly as reports from the running app.

**P6a — ⭐⭐ A BUTTON PLACES A SIGN ON A LINE.** 🚨 *"I'm clicking normal in the third barline but it's
changing the fourth"*, then the rule: *"somehow the change should be in the one most near to the
pointer — this is important."* ⛔ **This overturns §8 P4's "deliberately NOT the nearest boundary".**
The mechanism was `pixelToMeasure`, which puts a press landing ON a boundary in the bar to its RIGHT —
so a user aiming at a line got the bar past it. It turned out to be FEWER rules, not more: a barline
sign is a statement about a LINE, so `side` survives only in the measure-range gesture, the one that
genuinely names bars.

**P6b — ⭐⭐ ONE SIGN PER LINE, EXCEPT THAT THE TWO REPEATS COMBINE.** Two reports, one hour apart, and
together they are the whole policy — his words: *"if the barline is the repeat it should just check if
what is clicking on it is a repeat and contrary to its sign — in that case they make the double
repetition; if not, just override."*

| he wrote | what was wrong |
|---|---|
| *"end repeat overwrote the open repeat… completely wrong"* | the collapse into one `setBoundarySign` — that pair IS `:||:` |
| *"I click a final here and it just made disappear the end repeat, but I don't see it writing the final"* | the opposite: a style and a repeat are alternatives, and NOT overriding was the bug |

⭐ **His exception, stated by him:** *"the only exception is the first measure of the composition — I
mean if they have explicit open repeat."* That sign stands at the score's opening edge
(`endsMeasure: null`), where no bar ends, so it is the one `|:` alone on its line — nothing to
combine with, nothing to override.

**P6c — the PALETTE's fourth and fifth buttons.**
- **Normal** — the ERASER. *"Another way to rewrite the open, final and end repeat."*
- **Invisible** — *"what we do on screen we use the same colour of hidden we are using for rest, and
  not printing it on PDF export."* ⭐ Which is `rendering/hiddenElements` arriving at its second
  client, unchanged: tinted for the `editor` audience, OMITTED for `print`. ⛔ **Not "no barline"** —
  the bar still ends, the spine is untouched, the room is unchanged (§10.0's whole point). 🚨 And it
  **wins the boundary outright** — *"why can I not override a repeat line with an invisible?"* — because
  it is not a fourth sign competing but a statement ABOUT whatever sign would stand there.
- Both ghosts are `barlineSingle`; his call: *"the invisible ghost I guess will be like the normal
  ghost, so is simple."*

**P6d — the PROPERTIES chooser.** *"I was expecting to change the type there"*, then the shape of it:
*"since we can just select one barline, there should be an option for close+open case."* ⭐ That second
sentence is the design: it names a **LINE**, so it can say `:||:` — which no per-bar control could,
since each side owns only its own half. ⚠️ It is deliberately a different sentence from a palette
button: a button says *"add this sign"*, the dropdown says *"the sign is this"*.

**P6e — ⭐⭐ WINGS.** *"I remember Sibelius had barline wings for repeats, and Finale something similar
that was not as pretty as Sibelius"*, and the shape: *"similar to Bravura `\uE002`"* — which is
`bracket`, so the wing is the **staff bracket's own flared tip**. Two agents checked; §11 records what
they found. His rule for the control: *"a checkbox, but the important thing is it should only be
checkable when wings are allowed — this is for open repeat, for end repeat and for final; other
barlines do not allow wings."* ⚠️ Note the FINAL: MuseScore wings the two repeats and never the final
bar. His call.

⭐ **The geometry falls out of the halves table** (`SignHalf`, P5c) with no new rule: ink LEFT of the
divider is an ending sign, so its tips flare left off the divider's right edge; ink RIGHT is an
opening sign, so its tips flare right off its left edge. A `:||:` is both. ⛔ Not MuseScore's
arrangement, and it cannot be — it draws the junction with TWO thick lines (Gould's design (B)) and
puts a pair on each, where we draw her (A).

🚨 **Drawn on EVERY staff, and that is his call against both engines:** *"outer stave? no, it should be
drawn in any case — we still have separate barlines for every stave… in the case we make the barlines
between the staves continuous then we have to take care in what end we place it, but now we don't have
that, that's a future case."* Exactly right: MuseScore's `isTop()`/`isBottom()` and LilyPond's
`has-span-bar` both follow from a barline that SPANS. ⏭️ The day span bars arrive, that is the line to
revisit, and the two engines already agree on what it becomes.

---

## 10.5 §7 — THE PLAY ORDER ✅ BUILT (2026-08-26)

🚨 *"What about the playback? …by default playback should repeat, and I guess we can have a checkmark
on the dev shell near dev sound to not repeat if the user wants."* Default ON; the dev shell's
🔁 checkbox turns it off.

⭐⭐ **The performance is a list of LEGS, not a re-ordered score** (`engine/audio/repeatPlan.ts`). A
repeat cannot be "the notes in a different order": the same bar sounds more than once, so bar↔time
stops being one-to-one and every consumer of that mapping breaks — the schedule, the auto-stop, the
progress bar, the playhead. Each leg is a contiguous run of bars carrying **where in SCORE beats** it
comes from and **when in PERFORMANCE seconds** it happens. ⚠️ Keeping those two clocks apart is the
whole of the care; a leg's duration is the DIFFERENCE of two `beatsToSeconds` lookups, never a
beat-length times one rate (a repeated passage may straddle a tempo change).

⭐ **A score with no repeats is ONE leg**, and every arithmetic downstream collapses to exactly what
it was — which is the claim `playbackSchedule.repeats.test.ts` opens with.

⛔ **The §3.2 boundary still holds:** `barlineOps` gained no caller and no knowledge of this. The
signs are the MUSIC; the order is one performance of them, which is why a checkbox can switch it
without touching a score and why it is not a `Score` field.

**Readings, each the standard one:** an `:|` with no `|:` before it repeats **the piece** (Gould, and
every engine); `times` is the number of PLAYINGS in total, absent = 2; **"play from bar N" is the
FIRST time it comes round** (Sibelius, Dorico and MuseScore all answer that way, and it is the reading
a user can predict). Nested repeats are *played, not resolved* — an inner counter clears once taken in
full, so an enclosing repeat replays it, which is what a player does.

⏭️ **NOT built:** voltas (1st/2nd-time endings), D.C./D.S., codas, jumps. None is in the model, and
every format holds a volta as a *container of measures* rather than a barline attribute. When they
arrive they are inputs to that same walk — which is why it is a module and not a loop inside
`PlaybackEngine`, MuseScore's `RepeatList` being the same shape.

**P6f — the two menu doors (2026-08-26).** Both are rows running a command that already existed, which
is the menu bar's whole rule (`src/menus/`: *"deleting the bar deletes a list of LABELS"*).

- **Insert ▸ Barline ▸ …** — his ask, from a screenshot of Sibelius's own submenu. Five rows in its
  grouping: *Start Repeat · End Repeat · Final* — rule — *Invisible · Normal*. ⭐ Each runs
  `PaletteController.pressBarline`, so a row APPLIES to a selected line and ARMS the stamp when
  nothing is selected, exactly as the palette button does. ⚠️ **The words are the menu's** (*Start /
  End Repeat*, what Sibelius and MuseScore both say) while `BARLINE_SIGNS`' labels stay log prose; the
  SIGN each row names is the engine's type, so a rename fails to build. `insertMenu.test.ts` pins that
  every placeable sign has a row.
- **Play ▸ Play Repeats** — *"we need to add the checkmark also in the Play menu, saying something
  like Allow repetition or whatever it spells correct in English."* ⭐ **"Play Repeats"** is the
  phrase: MuseScore's toolbar toggle and Sibelius's playback option are both called that. ⚠️ It and
  the dev shell's 🔁 checkbox stay in step through `bus.playRepeats` — the `Score Sound` arrangement
  one store over, and it fixes a real bug: the checkbox syncs on the editor's STATE notification, and
  toggling repeats writes no state, so the menu could have turned them off and left the box ticked.

---

## 11. Barline WINGS — what the sources actually say (researched 2026-08-26)

⭐ **A style option, not a convention.** Recorded so it is not re-researched.

**Every treatise we hold is SILENT — checked, not assumed.** Gould pp. 38–39 and 233–235, Ross p. 147
and pp. 151–152, Gerou & Lusk pp. 110–111 all decompose the repeat sign in detail; none names or draws
a tip, `\bwing` returns zero hits across all four, and every engraved repeat on those plates is
plain-ended.

**⛔ SMuFL declares no wing glyph.** The shape is the staff bracket's tip: `bracketTop` U+E003 /
`bracketBottom` U+E004 (flaring right), `reversedBracketTop` U+E005 / `reversedBracketBottom` U+E006
(flaring left) — 1.876 × 1.18 spaces each in Bravura. ⭐ The corroboration that this is the right
identification is that **Sibelius names its own two symbols "End Bracket Top / Bottom"**.

**Every program has it, off by default:** Finale (*"Wing Styles: None / Curved / Single / Double"*),
Sibelius (Engraving Rules ▸ Barlines), Dorico (*"Wings on repeat barlines"*, 1.2.10), MuseScore
(*"Show repeat barline tips"*, `Sid::repeatBarTips = false`). LilyPond has no switch — separate
bar-line glyphs. Verovio does not draw them at all and ignores MusicXML's attribute.

**⭐ MusicXML is the one place it is specified**, and its vocabulary is what to steal if this is ever
extended: `winged` = `none | straight | curved | double-straight | double-curved`. Ours is a boolean
meaning the curved single, which is what MuseScore exports as `winged="curved"`. ⛔ A second flag
(`doubleWinged`) would be the wrong move; the field becomes MusicXML's union.

**⛔ UNKNOWN: where the convention comes from.** The "common in hymnals" line traces to one forum
thread whose host is gone (`forums.makemusic.com` — DNS failure; a dead route). No citable publisher,
period or tradition. ⛔ And **no source says Finale's are uglier** — what IS documented is that Finale
exposes the shape while the others pick it for you.

**⏭️ LATER, out of this plan:** the per-staff scope actually being READ (§2 stores it, nothing reads
it); the repeat PLAY ORDER (§7); the **thin double `||`**, which is the family's fourth member — not
asked for, but §4 already carries its rule and its 🚨 (below), so it is a row and not a redesign;
voltas / endings, which every format models as a *container of measures*, never a barline attribute.

⭐ **AND THE JOIN — a barline running unbroken through the gap between two staves — LEFT THIS PLAN
ENTIRELY on 2026-08-28: `docs/barline-join-plan.md`, with `docs/barline-join-research.md` under it.**
⚠️ ⛔ **It is not this plan's §2.** They are two different questions and the words for them are close
enough to fuse by accident: §2's scope is **which staves a SIGN applies to** (this bar repeats on
staff 3 alone); the join is **where the drawn LINE runs** (staff 3's line continues into the gap
below it). A system-wide final bar can still be drawn as separate per-staff lines — which is exactly
what we draw today — and a joined line can carry a per-staff sign.

⭐ **And one thing that gets CHEAPER after P2, worth knowing when it is asked for.** Once the barline
draws through our own pass, every remaining member of §0.1's table costs a union member and a case in
one file — including `none`, whose "draw nothing" is a one-liner there and was a `layoutMetricsMap`
argument while VexFlow held the pen. ⛔ Still not a licence to build them (§0); the extension test
just got easier to pass.

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
