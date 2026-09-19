# Key signatures — the classical case, built so the custom case is not blocked

**Status: PLAN, written 2026-08-27. ✅ All five research passes are IN** (Gould · Ross/Gerou &
Lusk/Stone · MuseScore/LilyPond/Verovio · MusicXML/MEI/SMuFL/the four apps · the UI survey) — their
evidence is digested in **`docs/key-signature-research.md`**, which is this plan's companion —
this file is the BUILD, that one is the WHY.

✅ **And the four open decisions were taken the same day** (§10): an open/atonal key is a distinct
value carried by `mode`; the cautionary at a system break is ON and is *the engraving*, not a
warning; **no double bar is generated — Gould's rule, so it is the author's edit** (§4.2b, reversed
later the same day); a zero-glyph signature is reachable through a **signpost**; and the accidental
gap is **one constant, 0.25 sp**.

✅ **P1, P2 and P3 are BUILT (2026-08-27)** — the model, the writes, and the drawing. A key
signature is engraved, at system heads and at mid-score changes. ⏭️ **P4 next: the accidental ripple**
(§3) and NOTE ENTRY (§3.1). See §8's phase table and §8.1–8.3 for what each one actually landed.

> ### ⚠️ AMENDED 2026-08-27, after reading the plan against the code
>
> Every claim below was checked at the call site. The model half (§1, §2, §5) held up; the numbers in
> §4.0 are exact. **Eight things did not**, and they are marked ⚠️/🚨 **AMENDED** where they belong
> rather than in a list here — the two that change the SIZE of the work:
>
> 1. 🚨 **§1.3 — the INHERITED key is invisible to the shape key.** `MEASURE_RENDER_ROLE` is
>    own-fields-only, so a key set in bar 1 leaves bar 40's cached picture — and its old accidentals —
>    in place. It needs a `ShapeKeyInputs` row, exactly as the governing clef has one.
> 2. 🚨 **§3.1 — NOTE ENTRY was not in the plan at all.** Entry spells the natural letter, so under
>    §3's display rule every note typed in G major would draw a spurious ♮.
>
> The others: §2's call-site count (two, not one) and its specs; §2.1's missing `keysByStaff` prepass;
> §3's missing `measureColumns` (which is what makes this a *width* change); §4.1's empty-signature
> trap; §4.3's wrong table; §5's unregistered hit boxes. One dead reference removed
> (`docs/render-width-key-vs-shape-key.md` does not exist).

## 0. What we are building, and what we are not

**Building now:** the classical circle-of-fifths signature — the model, the resolution, the drawing,
the accidental consequences, mid-score changes, and a throwaway palette in the dev shell (C, G, F, D,
E♭ … ) so the thing can be exercised.

**Not building now:** the real UI. He said so outright — the dev palette is a temporary door, exactly
what `dev/`'s barline palette was before it was deleted the day the real one existed.

**⭐⭐ The constraint that governs every decision below:** the model must not block a CUSTOM signature
(mixed sharps and flats, authored order). That is a stated requirement from 2026-08-13, recorded in
`src/utils/keySignature.ts`'s own doc comment, and it is why §1 stores a list rather than an integer
**in this first pass** rather than promising to convert one later.

---

## 1. The model — `Measure.keys`, and the list IS the storage

### 1.1 The signature itself

`utils/keySignature.ts` already argues this at length and the argument is not reopened here. The
short form:

⚠️ **AMENDED AT BUILD (P1): the TYPES live in `types/music.ts`, the resolution stays in
`utils/keySignature.ts`.** A `KeySignature` is now stored model data — it serializes into
`Measure.keys` — so it belongs beside `Clef`, `TimeSignature` and `ClefChange`, which is the split
every other kind already has (`Clef` in types, `clefUtils` resolving it). ⭐ `utils/keySignature.ts`
**re-exports** all three names, so `trillPitch`'s import did not change, and it keeps the whole
argument below in its header. ⛔ The alternative — `types/music.ts` importing a non-primitive from
`utils/` — would have inverted the one arrow this repo is careful about.

```ts
export interface KeyAlteration { step: PitchStep; alter: PitchAlter; octave?: number }
export interface KeySignature { alterations: KeyAlteration[]; mode?: 'major' | 'minor' | 'open' }
```

- **The ORDER of `alterations` is authored data**, defaulted from the cycle of fifths at creation.
- `fifths` stops being a field and becomes `fifthsOf(key): number | null` — `null` meaning "this
  signature has no traditional name", which is the honest answer for a Bartók signature.
- `keyFromFifths(n, mode?)` builds the traditional list. **The dev palette's five buttons are five
  calls to it**, which is the whole of "we do classical first" — the classical case is a
  *constructor*, not a second model.
- C major is `alterations: []`. ⭐ Not a special case anywhere: it draws nothing because the list is
  empty, and every rule below reads the same.
- ✅⭐⭐ **OPEN / ATONAL IS NOT C MAJOR, and `mode` carries the difference — HIS DECISION, 2026-08-27:**
  *"we need to have the atonal key, so probably (a) is the best choice."* So `mode` is
  `'major' | 'minor' | 'open'`, and ⛔ **not** a second `open?: boolean` beside it — one question,
  one answer, in the field that already asks it.

  Both are `alterations: []`, so the list alone cannot tell them apart, and three applications say
  independently that they must be: an open key is **exempt from transposition** (Stone p. 174: *"In
  nontonal music there are no key signatures, regardless of whether the score is transposed or in
  C"*), and a change *to C major* draws cancelling naturals where a change to *no key* arguably
  should not. ⭐ MuseScore disables deleting bar 1's key over exactly this ambiguity, in its own
  words: *"it is impossible to know whether you want a C major/A minor key signature, or an
  'open/atonal' one."*

  ⚠️ **Decided now, but nothing in P1–P5 depends on it** — the dev palette cannot produce an atonal
  key and transposition is future work (§7). It is in the type from the start so that scores saved
  before the distinction matters do not need retrofitting, which is the whole reason not to defer it.
  ⛔ `mode` is now three-valued: any `switch` over it must stay total.

⚠️ **Change `KeySignature` in the same commit as the rest of P1, not before and not after.** It has
exactly one reader today (`utils/trillPitch`, via `keyAlterOf`), so the change is one function body
plus the type and `trillPitch` does not change a character. That property expires the moment a second
reader appears — it is the reason the module's doc says to do it this way.

### 1.2 Where a key change lives

Mirrors `ClefChange` field for field, because it is the same kind of thing:

```ts
export interface KeyChange { id: string; beat: Fraction; key: KeySignature; staffId?: string }
// on Measure:  keys?: KeyChange[]   (sorted ascending by beat)
```

- **Per-staff by construction** (`staffId`, absent = staff 0 — the `utils/lanes` convention). Bartók
  writes four sharps in one hand against four flats in the other, and `keyAt` already takes a
  `staffId` in anticipation.
- **No `Score.keySignature` field, ever.** `types/music.ts` records why on `clef`, `tempo` and
  `keySignature` alike: a global silently means "the value at bar 1 beat 0", which is the conflation
  that made the old `score.clef` bleed across staves.
- ✅ **`beat` may be non-zero — MuseScore allows it** (`tlayout.cpp:3627` treats a non-zero `rtick`
  as courtesy-like; the UI reaches it *"via list selections"*). So the field earns its place, and the
  write path need not refuse it. ⏳ Whether the dev palette should ever WRITE one — *no*, on current
  evidence; a click places at beat 0.

### 1.3 The compiler asks ONE of the questions — and it is not the dangerous one

Adding `keys` to `Measure` makes **`engine/rendering/measureRenderRoles.ts` stop compiling** until it
is classified, and **`measureRenderRoles.test.ts`'s `PERTURB` table** (also `Record<keyof Measure, …>`)
until the classification is *exercised*. The answer is **`'width'`**.

🚨🚨 **AMENDED 2026-08-27, read against the code — the original text of this section said this closed
"one whole class of silent staleness for free", and that is FALSE for the case that matters.**
`MEASURE_RENDER_ROLE` is **own-fields-only**: it asks what bar *N*'s field does to bar *N*'s keys. Its
own `barline` row says so in as many words. But a key signature is **INHERITED**, and §3's rule means
the key set in bar 1 decides which accidentals are DRAWN in bar 40. Bar 40's own fields never change,
so `measureShapeKey` is unchanged, so P5 replays its cached `<g>` — **the new signature on the stave
and the old accidentals underneath it, forever.**

⭐⭐ **That is the GOVERNING-CLEF bug verbatim, and the code already carries both the fix and the
warning.** `clef` is an explicit row in `MeasureRedrawKey.ts`'s `ShapeKeyInputs` for exactly this
reason, with the comment *"an alto clef at bar 40 would leave every later bar's key unchanged… the
old noteheads underneath it, at the wrong pitches, forever."* So:

- ⛔ **`Measure.keys: 'width'` is necessary and NOT sufficient.** The feature also owes a
  **governing `key` row in `ShapeKeyInputs`** — the same seam `clef`, `crossBarBeams` and
  `cautionaryEndClef` already use for a fact no `Measure` field can express.
- …and a **`cautionaryEndKey`** row beside `cautionaryEndClef` / `cautionaryEndTimeSig` when §4.2
  lands, on the same terms: a neighbour-decided picture.

⚠️ **And the `'width'` answer is right for a reason the first draft got wrong.** It is NOT "a
signature takes horizontal room" — `timeSignatureChange` is classified **`'shape'`** for precisely
that shape of glyph, because header overhead is priced outside the note-space path
(`measureRenderRoles.ts`, the `timeSignatureChange` row). The real reason is §3: a key changes which
**accidental glyphs** the notes draw, and `measureColumns` prices accidental ink through
`displayedAccidentals`. ⭐ Which also means the clef's exemption does **not** transfer: a clef is
provably width-independent (`clefWidthIndependence.test.ts`), a key is not.

⚠️ The required read before this line is written is **`measureRenderRoles.ts`'s header and
`MeasureRedrawKey.ts`'s header** — `docs/render-width-key-vs-shape-key.md`, cited here in the first
draft, **does not exist** (the name is a memory index entry, not a file).

**JSON:** additive and optional, so import/export is untouched and there is **no migration** (that is
policy, not laziness — `docs/no-json-migration.md`).

---

## 2. The reads — `keyAt` grows its walk, and nothing else moves

`keyAt(score, measureNumber, staffId)` returns `C_MAJOR` today from underscore-prefixed parameters.
It becomes a walk back over `measure.keys` filtered by staff, exactly the shape of
`effectiveClefBefore`. **Making the parameters honest is the whole of the change** — its call sites
do not move.

⚠️ **AMENDED 2026-08-27: there are TWO call sites, not one** — `trillOps.ts` *and*
`playbackSchedule.ts` (`auxiliaryPitchFor`). Both reach it through `trillPitch`, so the claim that
survives is the one that matters: **neither reads `key.fifths`**, so the change really is one function
body plus the type. ⛔ But the count was wrong, and the count is what "nothing else moves" was resting
on.

⚠️ **The SPECS do move, and they move in the same commit** (⭐ *a spec moves with its module*):
`keySignature.test.ts` and `trillPitch.test.ts` both build `{ fifths: n }` object literals as
fixtures. "`trillPitch` does not change a character" is true of the **source** only.

New reads, all in `utils/keySignature.ts` beside `keyAlterOf`:

| function | answers |
|---|---|
| `keyAlterOf(key, step)` | what a letter is altered to — **already exists**, becomes a list lookup |
| `fifthsOf(key)` | the traditional name, or `null` |
| `keyFromFifths(n, mode?)` | the classical constructor |
| `keyChangedAt(score, m, staffId)` | is there a change here, and what was in force before it |

⭐ **The last row is what cancellation and cautionary rendering both ask**, and it is a set difference
between two lists — arithmetic that would be fiddly in the fifths model and is trivial here.

### 2.1 ⚠️ AMENDED 2026-08-27 — the walk is the ANSWER, not the LAYOUT'S read

🚨 **`keyAt` alone is a per-bar walk-back, and the layout asks it per bar PER STAFF, every render.**
That is the shape whose clef version cost **47% of all layout time** — and the clef's answer is
already written down: layout does not walk. It resolves **once** into a
`clefsByStaff: Map<staffId, StaffClefs>` with an `opening` and an `ending` map keyed by measure
number (`resolveStaffClefs`, threaded through `MeasureLayout` as a parameter), and the per-bar
question is then a `Map.get`.

⭐ So P3 owes the **same prepass** — `keysByStaff`, `opening` + `ending` — and both halves earn their
place: `opening` is what the header draws at a system start, `ending` is what §4.2's cautionary
compares against. ⛔ Do not thread `keyAt(score, …)` into `MeasureLayout` and call it per bar; that is
the census's most expensive lesson, re-learned.

⚠️ `keyAt` itself stays exactly as §2 describes — it is the **model's** answer, and the one the trill
and playback ask. The prepass is the **layout's** cache of it, not a second source of truth.

---

## 3. ⚠️⚠️ The accidental ripple — the widest part of this feature, and it is not the drawing

`utils/accidentalState.ts` says, in its header, *"Key signatures are NOT folded in here."* Notes are
stored as **spelling** (`step` + `alter`), so today an F♯ carries `alter: 1` and draws a ♯. In G major
it must draw nothing — and a later F♮ must draw a natural it does not draw today.

**The design point, stated now because it is the one that is easy to get wrong:**

> The running-accidental map is keyed by **diatonic position** (octave-specific: F4 and F5 are two
> entries). A key signature governs a **letter, in all octaves** (Gould pp. 93–94, and it is what
> makes a key signature a key signature). So the key is **NOT a pre-fill of that map** — it is the
> **fallback consulted when a position is absent from it**. Pre-filling would need seven entries per
> octave and would be wrong at the edges.

Touched, and this list is the honest measure of the feature's size:

- `accidentalState.displayedAccidentals(slots, key)` — the sign each pitch shows
- `accidentalState.prevailingAlterAt(...)` — the fallback above
- `MusicEngine.getPrevailingAlter` and `SelectionController.computeDisplayedAccidental`
- `NoteBuilder`'s render pass, which implements the same rule incrementally
- `FanPass`, which must keep reading the SAME map — its header warns that a second accidental rule
  inside the fan renderer is the one thing that feature cannot afford
- ⚠️ **AMENDED 2026-08-27 — `layout/measureColumns.ts`, which the first draft of this list MISSED**,
  and it is the one that makes this a *width* change rather than a picture change: it resolves the
  signs through `displayedAccidentals` and prices the accidental's INK into the column. **A key
  signature therefore changes how wide a bar is** (§1.3's amendment, and the reason the clef's
  width-independence proof does not transfer).
- ⚠️ …and `CrossBarBeams`, which reads a member's **own bar's** lane for the same walk.

🚨 **`displayedAccidentals` has FIVE call sites, and the key each one needs is ITS OWN BAR'S.** A fan
member and a cross-bar beam member can live in a different bar from the slot being drawn — so the
parameter is *the key in force where these slots are*, resolved per lane, ⛔ never "the key the caller
happened to have".

🚨🚨 **THE TRAP, and it is Gould's own sentence (printed p. 81):** *"This practice holds good even
when a key signature corrects the accidental"* — with a figure in E♭ major where an explicit ♭ is
still written in bar 2. **A courtesy accidental must NOT be suppressed because the key signature
agrees with it.** That is the exact simplification this feature invites ("the key already says B♭,
so drop the sign"), it would be wrong, and it would look right.

⚠️ **Whether a key CHANGE resets the in-bar accidental state is UNKNOWN in all three treatises** —
checked, not skipped: they say only that a BARLINE resets accidentals and never the signature (Stone
p. 53, Ross p. 130). ⛔ So the rule below is taken from the engines, and it is recorded here that no
treatise backs it.

✅ **All three engines RESET the running-accidental state at a key change**, and Verovio settles the
octave question outright: its map is keyed `pname + oct*7` **over octaves 0–9**, i.e. a signature
applies in every octave — which is the fallback design above, arrived at independently.

⭐ **Playback is nearly free**: `playbackSchedule` already imports `keyAt`, and pitch is spelled, so
the alteration is already on the note. A key signature changes what is *drawn*, not what is *stored*.
✅ **And the behavioural question is answered: applying a key signature does NOT transpose existing
notes.** MuseScore touches pitches only when the *instrument's* transposition changed
(`editing/editkeysig.cpp:85-143`). So a key signature changes what is drawn, never what is stored —
which is the answer our spelling-based model wanted anyway.

### 3.1 🚨🚨 AMENDED 2026-08-27 — NOTE ENTRY, which the plan did not mention at all

**The rule above is only half of it, and the missing half is the half the user meets first.**

`NoteEntryCoordinator` takes *"natural pitch spelling from Y coordinate (that staff's clef), then
apply accidental"* — the click gives a diatonic position, the entered pitch is that letter with
`alter: 0`, and the armed accidental is the only thing that changes it. Combine that with §3's display
rule and **G major breaks on the first click**: the entered F carries `alter: 0`, the key says F♯, the
signs disagree, so the renderer draws a **natural**. Every note typed in a sharp or flat key gets a
spurious ♮, and the score is unusable in any key but C.

⭐ **So the key is the DEFAULT ALTERATION AT ENTRY, and the armed accidental overrides it.** That is
what every editor does and it is the other face of the same fallback: the running map first, the key
underneath it, `alter: 0` only when the key is silent there.

⚠️ Three sites ask the same question and must give the same answer — ⛔ this is a rule, not three
patches:
- `NoteEntryCoordinator` (click entry and keyboard entry),
- the arrow-key pitch moves (a step up from F♮ in G major is G♮, but the F it left must not have been
  an F♮ to begin with),
- `midiToSpelling` on **paste** — where the incoming note already carries its own spelling, so the
  question is whether we respell it. ⏳ *No: paste keeps its spelling* (a pasted F♯ stays F♯ and simply
  stops drawing its sign), which is the same "changes what is drawn, never what is stored" the
  paragraph above just decided. Recorded so it is decided once.

⚠️ **`forceAccidental` already exists on the model** and is the courtesy's home: it is what makes an
explicit sign survive a rule that would suppress it. 🚨 It is therefore also where Gould's p. 81 trap
gets its teeth — ⛔ do not re-derive "was this sign explicit?" from `alter` in the drawing.

⏭️ **Phase:** this is P4's, and it doubles P4's size. §8's row is amended to say so.

---

## 4. The drawing — ⭐⭐ ours, not VexFlow's, and the route is already open

His instinct, and the repo's own test agrees. `BarlineRenderer`'s header answers this exact question
in his exact words (*"shouldn't we draw ourself following the own engine strategy?"*), and
`docs/own-engraving-engine.md` **P5 is literally "The staff and the header"** — where `headerInk.ts`
already *measures* what a clef and a meter cost while `Stave` still *places* them, which that
document calls the two-sets-of-numbers problem in its last hiding place.

`vexflow-boundary.md` §4's test — *take a decision from VexFlow only when there is a rule we want to
state and cannot* — is passed easily: a key signature is a **table** (letter + clef → staff position)
and a **spacing row**. Those are rules we can state outright. ⏳ *The tables themselves are what
agents 1–3 are fetching.*

### 4.0 ⭐⭐ SMuFL gives us the glyphs and NOT the gap — which is the good news

Checked against Bravura 1.482 directly: **SMuFL defines no key-signature glyphs** (a signature is
drawn with the ordinary `accidentalSharp` / `accidentalFlat` / `accidentalNatural`; the `…Small`
variants are for small staves, not for signatures) and **no `engravingDefaults` key mentions a key
signature at all**. So the accidental-to-accidental distance is a rule we MUST state — nobody hands
it to us — which is `vexflow-boundary.md` §4's test passed a second way.

What the font does give us, in staff spaces, is the advance widths — and P2 already ships them
(`engine/fonts/`):

| glyph | advance | anchors |
|---|---|---|
| `accidentalSharp` | **0.996** | all four `cutOut`s |
| `accidentalFlat` | **0.904** | `cutOutNE`, `cutOutSE` |
| `accidentalNatural` | **0.672** | — |
| `accidentalDoubleFlat` | 1.652 | — |

### 4.0b ✅⭐⭐ THE GAP IS ONE NUMBER: **0.25 staff spaces** — decided 2026-08-27

The three sources give three flat pitches and two sharp pitches:

| | flat → flat | sharp → sharp |
|---|---|---|
| Ross (stated *and* engraved) | 1.00 | **1.25** |
| Gerou & Lusk (measured) | 1.08 | 1.08 |
| Gould (measured, 450 dpi) | 1.12 | **1.25** |

⭐⭐ **But subtract the font's advances and a single number appears.** Gould's pair implies gaps of
**0.216** (flat) and **0.254** (sharp); Ross's implies 0.096 and 0.254. So **one gap of 0.25 applied
to both advances** gives **flat 1.15 / sharp 1.25** — it reproduces the twice-confirmed sharp
*exactly* and Gould's measured flat to within **0.03 sp**.

✅ **DECIDED: one constant, `KEY_ACCIDENTAL_GAP = 0.25`**, not a per-glyph table.

> 🚨 **RE-CONFIRMED 2026-09-01, and the re-confirming is the lesson.** `docs/header-spacing-research.md`
> — a fresh survey of the literature — listed this gap as an open row with three models, two of which
> §4.0b had already weighed and rejected. It was put to him as a live choice and he caught it:
> *"didnt we made the keysignature plan already with research included?"* ⇒ ⛔ **a research document
> surveys the books; it does not know what this repo has decided.** The MODEL is closed here; only the
> value's look is outstanding (below).

 ⭐ The whole reason
is that it makes the flat/sharp difference **fall out of the glyph** instead of being two hand-set
numbers — which is exactly the cause Ross names: sharps *"expand until the bar-ends align rather than
overlap"*. A rule, not a pair of constants.

⚠️ **It is a PREDICTION, and it is owed his eye.** Ross would call these flats loose by a sixth of a
space. When P3 draws it, this is a taste call to put in front of him — **one line to flip** to
Gould's measured 1.12 or Ross's 1.00 — the same way `font-metrics-plan.md` §3.6 batched its six.
⛔ Until then, nobody "corrects" it from a treatise number alone; the arithmetic above is why it is
0.25.

⚠️ The **natural** gap is NOT settled by this: Gould measures naturals at 1.13 pitch (gap ≈0.46 over
a 0.672 advance), and MuseScore and Verovio both give naturals their own larger constant. ⏳ Start at
the same 0.25 and expect it to need more; the cancellation group is where it shows.

⭐ **So the `headerInk` row is computed, not measured**: `Σ advance + gaps + BETWEEN_PARTS`, with the
gap the one number above (the research record's §9.2 is the evidence). ⚠️ That makes it the FIRST header part
whose extent is derived from the font rather than measured off VexFlow's drawing — which is the
direction `font-metrics-plan.md` wants, but it means the e2e check is confirming *our arithmetic*,
not re-measuring someone else's. Say so where it is written.

### 4.1 ⭐ Why this is cheap: we already own where the notes start

`applyLeadIn` ends with `stave.setNoteStartX(staveX + leadIn)`, and `leadIn` is computed from **our**
`headerExtent()`, not from VexFlow's own header layout. So:

- **one new row in `engine/layout/headerInk.ts`** — a `key` part beside `clef` and `meter`, priced
  the way they are (extent + `BETWEEN_PARTS`) — reserves the room, in the width model AND in the
  drawing, by construction;
- **one new score-level pass**, `engine/rendering/KeySignaturePass.ts`, draws the glyphs into that
  room through our own primitives and the Bravura metrics P2 already landed (`engine/fonts/`);
- **`stave.addKeySignature` is never called.**

⚠️ `headerInk`'s numbers are measurements-written-down and therefore predictions: every row is
re-measured in the browser by `e2e/spacing.e2e.ts`. A `key` row owes an e2e assertion in the same
commit. ⛔ And a drawn position is not a unit test — jsdom measures every glyph as 0×0 and will agree
with whatever it is told.

🚨 **AMENDED 2026-08-27 — an EMPTY signature must add NOTHING, and `headerExtent`'s shape makes that a
real trap.** It collects the drawn parts into an array and returns
`Σ parts + BETWEEN_PARTS × (parts.length − 1)`. Push a `key` part for C major and the bar pays a whole
`BETWEEN_PARTS` (1.0 sp) for ink that does not exist — **on every bar of a C-major score**, which is
every score today. ⭐ The rule is `alterations.length === 0 ⇒ push nothing`, and §6 already guarantees
it gets exercised: **C is in the dev palette on purpose.**

⚠️ And "one new row" is one row plus **three call sites** (`MeasureLayout`, and `ScoreRenderer`
twice — the second reading a per-system cached `headerExtent`), plus `cautionaryExtent`'s union. The
`Header` interface is where the compiler will start asking.

### 4.2 What has to be drawn, not just what is in force

- at the **start of every system**, restated (⏳ agents confirm the exception list)
- at a **mid-score change**, after the barline (⏳ which barline, and cancellation order)
- ✅⭐⭐ as a **cautionary at the end of the previous system — ON BY DEFAULT. HIS DECISION,
  2026-08-27**, after asking what best practice and Gould actually say.

  ⚠️⚠️ **AND THE QUESTION WAS SLIGHTLY WRONG AS I FIRST PUT IT.** This is not an optional warning the
  way a courtesy clef arguably is — **it is where a key change that lands on a break IS ENGRAVED.**
  Gould, printed p. 93, verbatim: *"When a key change coincides with a system break, **the cancelling
  naturals and the new key signature go at the end of the first system. The new system takes only the
  new key signature.**"* No option to omit is offered, and her drawing does not parenthesise it.
  Gerou & Lusk p. 28 give it as numbered rules (*"a **courtesy key signature** is placed [at the end
  of the previous staff]"*, *"the **staff is left open** after the courtesy key signature"*), Ross
  agrees, and **MOLA requires** the end-of-line cautionary. All three engines and all four
  applications default to it; Dorico cannot switch it off at all.

  ⭐ **Two details from G&L p. 52 that decide implementation, not taste:**
  - **A courtesy clef is cue size; the key signature and time signature are NORMAL size.** ✅ So a key
    signature joins `cautionaryExtent`'s **meter** branch, not the clef's.
  - **A courtesy clef goes BEFORE the last barline; a courtesy key signature and time signature go
    AFTER it** — the same split as the simultaneous clef-and-key change rule (§9.4.3 of the research).

  ⛔ **UNKNOWN, and recorded as such:** a courtesy key signature at a system end when *nothing
  changes* is never stated or drawn by Gould. Almost certainly there is nothing to warn about — the
  signature is restated at every system head regardless — but we do not assert it.

  ⚠️ **This diverges from our clef and meter, whose courtesies are opt-in per change** (an override
  must be present). That divergence is now deliberate and sourced: theirs are warnings, this is the
  engraving. ⛔ Do not "fix" the other two to match; that is a question about *them*.

  ⏭️ **Hideable later, not now — his words: *"everything can be tuned by the user so the cautionary
  can be hidden … but this is not priority now, just FYI."*** So the suppression control is a future
  row, and ⛔ it must NOT be built by inverting the existing override table (presence meaning
  "allowed" for two kinds and "suppressed" for a third, with nothing in the code saying so).

  The machinery **already exists twice**: `MeasureLayout`'s `cautionaryEndClefs` /
  `cautionaryEndTimeSig`, whose width is paid through `cautionaryExtent`. A cautionary key signature
  is the **third row of that pattern** — the same drawing, without the opt-in gate.
- ⭐⭐ **cancellation naturals** — render policy, not model, and the *vocabulary* is settled. **MEI 5's
  `data.CANCELACCID` is the best-named enumeration anywhere** and we should adopt its names outright:

  | value | what it draws | its house name |
  |---|---|---|
  | `none` | the new signature only | Dorico calls this **"Common practice"** |
  | `before` | naturals, then the new signature | "Traditional" |
  | `after` | the new signature, then naturals | **"Old style" / "French"** |
  | `before-bar` | naturals before the barline | **"Russian"** |

  ⭐ It replaced MEI 4's boolean `@sig.showchange` precisely because a boolean cannot say *where*,
  and it cross-walks 1:1 with MusicXML's `<cancel location="left|right|before-barline">` and with
  Dorico's three options. ⛔ So this is an enum from the start, never a boolean.

  ✅ **And the default has converged across five implementations**: naturals *only* when the new key
  has none of its own. MusicXML states the same rule as a spec sentence — *"This will always happen
  when changing to C major or A minor and need not be specified then"* — so a change to C major
  draws naturals **without anyone asking for it**, which is why C is in the dev palette.
  ✅ **Gould's drawn 5♭ → 1♭ example settles the SET, and it is not "cancel the old signature":** she
  prints **four naturals (E♮ A♮ D♮ G♮) and does NOT cancel the B♭ that survives**, then states the
  new B♭. So the traditional cancellation is **`outgoing letters − incoming letters`, in the
  OUTGOING signature's order** — which is the set difference §2's `keyChangedAt` was built to
  answer, and the engines' rule stated from the drawing rather than from code.
  ✅ Her contemporary practice is the converged default: the new signature only, naturals **required
  only when the new section has no signature**.

  ✅ **DECIDED: `none` is our default** — the practice flipped between Ross (1970) and Gerou & Lusk
  (1996), and 1996's is where five modern implementations landed. ⛔ Settled; do not reopen (the
  quotations are in the research record). ⭐ The cancellation group owes **≈1 sp extra** before the
  new signature — Ross's "half a space or more", measured, and MuseScore's constant exactly.

### 4.2b The double barline before a key change is the AUTHOR's, not ours

🚨🚨 **REVERSED 2026-08-27, later the same day, by him — and this is the standing decision.
⛔ WE GENERATE NO DOUBLE BAR.** His words: *"i decided before that double bar for cautionary is
default, but i didnt remember that the cautionary goes always after the bar, in that case i think
following Gould rule is better as a default and the double bar is just an edit the user can change."*

⭐⭐ **What moved was the EVIDENCE, not the taste.** Gerou & Lusk's *"add double bar"* was read here as
a rule about the system-break courtesy — but it sits inside their numbered rules for **where the
courtesy goes**, and where it goes is *after the last barline* **in every case**, cautionary or not.
So "after the barline" was never the double bar's reason; it is just where a key signature is. Strip
that away and G&L stop contradicting Gould at all, and only Gould is left holding a rule:

> **Gould p. 92** — *"A double barline precedes the new key signature **only if the key change
> coincides with a new musical section**."*

⭐ **A new musical section is an AUTHORED fact only the composer knows.** So the double bar is a thing
the user WRITES on the bar before, exactly like any other barline — and *ONE OWNER PER LINE* is
satisfied by there being nothing to own: **`BarlineRenderer` gets no new rule from this feature at
all.** This is the cheapest possible answer, and it is the one the sources actually support.

🚨 **DEPENDENCY, and it is not optional: the thin double `||` DOES NOT EXIST YET.** `BarlineStyle` is
`'final' | 'invisible'` today, and the plain double is the type `barline-types-plan.md` lists as still
unbuilt. ⛔ So "the user can change it" is a promise resting on an unbuilt type: until `'double'`
joins `BarlineStyle` (its own row in the barline plan's tables, ⛔ not a slice added here), the
default is correct and **unreachable by hand**. Say so to him rather than quietly generating one.

⏭️ **An automatic double bar may come back later as a per-change OPTION** — but if it does it is a
WRITE the user's click makes, ⛔ never a sign the renderer invents. MuseScore's `DOUBLE_BEFORE_COURTESY`
stays in the research record as *what an engine does*, no longer as our rule.

---

⚠️ **The record of how this was decided, kept because it reversed twice in one day** — the two
treatises looked like they disagreed, and they were answering *different questions*:

- **Gould p. 92** — about a key change ANYWHERE: *"A double barline precedes the new key signature
  **only if the key change coincides with a new musical section**."* A new section is an AUTHORED
  fact only the composer knows.
- **Gerou & Lusk p. 28** — about the SYSTEM-BREAK courtesy specifically: the courtesy key signature
  is placed after the last barline, ***"add double bar"***.

**And MuseScore implements G&L's rule exactly** — its default is literally `DOUBLE_BEFORE_COURTESY`:
a double bar **only where a courtesy key signature actually prints**, never at every mid-line change.
Dorico and Sibelius generate one too (Sibelius unconditionally; Finale not at all). ⛔ Recorded as
*what four engines do*, no longer as an argument for doing it — and note Finale, which does not.

~~**So the rule we take is MuseScore's/G&L's**: a double bar at the cautionary.~~ ⛔ **SUPERSEDED by
the block at the top of this section** — the G&L sentence was about placement, not about the sign,
and once that is seen there is no second rule to weigh against Gould's.

⭐ **What survives from that reading, and it is worth keeping:** had we generated one, it could
**never** have become a written `barline` field. An engraving default written into the model is
indistinguishable from an authored one, and *ONE OWNER PER LINE* (`barline-types-plan.md` §3.2) is
what keeps them apart. ⚠️ That argument now points the other way and finishes the case: since the
double bar IS authored, it belongs in the model — where the user put it — and nowhere else.

### 4.3 A new drawn element owes rows, not constants — ⚠️ AMENDED: which table, though?

The standing rule stands. **But the first draft of this section named the wrong table**, and it named
it because the rule was pasted in without checking what the clef and the meter actually did:

- 🚨 **`spacingPadding.ts` is NOT the key signature's table.** Its `InkKind` is
  `note | rest | accidental | dot | ledger | stem | flag | barline` — **neither the clef nor the meter
  is in it**, because header ink is not a column against another column. A key signature is header
  ink, and header ink is priced in **`headerInk.ts`** by `BETWEEN_PARTS`, which is what §4.1 already
  says. ⭐ So the row this feature owes is §4.1's, and §4.3 was contradicting it.
- ⏳ A `spacingPadding` row becomes right only if a **mid-bar (beat > 0)** key change is ever drawn as
  a column — and note the inline CLEF is not one either (`inlineClefExtent`), so that would be a new
  decision, not a precedent.
- 🚨 **`kerning.ts`: the signature is ONE atomic ink box, and that is load-bearing.** Gould p. 92 —
  *"keep the key signature evenly spaced … Do not overlap the flats"* — **forbids** kerning the signs
  against each other, so ⛔ the glyphs must never be handed to the band test individually. What may
  kern is the signature's box against what stands beside it (the meter, the first note's accidental),
  and even that only where they share a vertical band.

---

## 5. Editing — the union, the element, the delete

Three tables, one row each, following the standing rule that a new feature adds a MODULE and a row:

1. **`engine/models/keyOps.ts`** — the writes (`setKeyAt` / `removeKeyAt` / normalize), free
   functions over a `Score`, the `clefOps` idiom exactly. ⛔ Not methods on `ScoreModel`; the facade
   gets thin delegators.
2. **`MarkingTool` gains `{ kind: 'keySignature'; key: KeySignature; cautionary?: boolean }`** —
   `cautionary` rides along for the reason the clef's and the meter's do: the target bar is not known
   until the click. Plus a row in `MARKING_TOOL_USES_ARMED_LENGTH` (`false`) and a ghost decision
   (⏳ — the clef ghosts, the slur shows a blue caret; a signature is a fixed row of glyphs, so it
   probably ghosts).
3. **`interactions/elements/keySignature.ts`** — hit-test + highlight, a row in `ELEMENT_SPECS`
   (which is total over the union, so it fails to BUILD until written) and a position in
   `ELEMENT_HIT_ORDER` (⭐ that array's order is the answer to "who wins a press two glyphs both
   cover" — beside `CLEF_ELEMENT` and `TIME_SIGNATURE_ELEMENT`, and after them: the same big-glyph
   argument, resolved left to right).
4. `SelectedElement` gains a `keySignature` kind; `assertNeverElement` then names the two sites that
   stay switches — Delete (`shortcutWiring`) and the Properties report (`selectionSnapshot`).

⚠️ **AMENDED 2026-08-27 — the list above says who HIT-TESTS and never says who REGISTERS.** A hit-test
resolves a press against `ElementRegistry` boxes, and a score-level pass has to put them there itself:
the `|:` is *"registered from the pen … the only place both facts are known"* (`BarlineRenderer`), and
the ordinary barline box is registered per bar and filtered by `registry.isPainted` at press time. So
**`KeySignaturePass` registers its own boxes as it draws** (P3's commit, not P5's) — otherwise P5
arrives to find the hit-test has nothing to hit. ⭐ It is also the answer to the signpost's geometry
below: the signpost's drawing owns its box, like every other kind.

🚨🚨 **A KEY SIGNATURE IS THE FIRST ELEMENT WHOSE VALID STATE IS ZERO GLYPHS**, and our whole
selection design rests on ink: `ELEMENT_HIT_ORDER` resolves a press against drawn boxes, and
`ElementRegistry.painted` exists so *"a press may only reach ink"*. C major has no ink. So a
C-major key change is **selectable by no gesture we own**, and Delete cannot reach it.

✅⭐⭐ **DECIDED 2026-08-27 — a SIGNPOST**, Dorico's term and Dorico's answer: a non-printing marker
for *"items that cannot be seen in the score, such as key signatures with no accidentals"*. Without
one you can place an empty key change and never remove it: "revert this bar to the key the previous
bar had" becomes inexpressible.

⭐⭐ **And it is not a new idea here — it is a second user of one we already have.** `docs/pdf-export.md`'s
rule is that **a render has an AUDIENCE**: a hidden element draws grey on screen and is **OMITTED in
print**. A signpost is exactly that, so it reuses an established treatment rather than inventing a
category. ⚠️ Which means the signpost MUST go through that same audience seam — ⛔ a marker that
reaches the PDF is the bug this rule exists to prevent, and `e2e`/export is where it would be caught,
not jsdom.

⛔ **Do not implement it as a bare zero-width hit box** — an invisible target that steals presses from
the barline beside it is worse than no target. The signpost is *drawn* (on screen), and the hit box
is that drawing's own, which is how every other kind in `ELEMENT_HIT_ORDER` works.

⏳ Its GEOMETRY is a taste call for when it is drawn: Dorico's sits above the staff at the change's x.
⚠️ Whatever it is, it takes **no horizontal room** — it is not a `spacingPadding` row, because the
music must space identically whether the signpost is shown or not (that is what makes it a signpost
and not an element).

⭐ **And two apps independently make the FIRST bar's key undeletable**, MuseScore stating the reason
outright: *"it is impossible to know whether you want a C major/A minor key signature, or an
'open/atonal' one."* ⚠️ That is the §1.1 question arriving from a second direction — the ambiguity is
not theoretical, it is what forces a real product to disable a control. Our clef has the same
protection at m1 b0 already (`elements/clef.ts`: *"measure 1 opening: change only, cannot remove"*),
so the shape exists.

⚠️ Every mutator saves an undo entry — skipping it costs the undo *and* the repaint.

### 5.1 ✅ What MuseScore's editing model settles for us

- **Propagation is FREE and must stay so.** A key list is a tick-keyed map read as "the last entry at
  or before this tick"; nothing rewrites the following bars. That is `effectiveClefBefore`'s shape,
  which we already have — ⛔ so a key change never edits its neighbours.
- **Plain drop = ALL staves; `Ctrl` = this staff only** (`dom/keysig.cpp:82-104`). ⚠️ Note the
  polarity: the modifier NARROWS. Worth copying, and worth checking against the apps agent.
- ⭐ **Applying to a RANGE restores the previously-effective key just after the range end**
  (`notationinteraction.cpp:2460-2545`). A small, genuinely good idea — the passage-selection box
  already exists here, so it is reachable later. ✅ Finale makes the same idea an explicit choice
  (*Through End of Piece* / *To Next Key Change*).
- ✅ **All four apps default to ALL STAVES**, confirming MuseScore's polarity: the modifier NARROWS.
  (Dorico `Alt+Return`, MuseScore `Ctrl`/`Cmd`, Sibelius a *One staff only* checkbox, Finale a staff
  attribute.)
- ⚠️ **Finale is the one app that asks about transposition on apply** — a three-way choice
  (*Transpose Notes* / *Hold Notes to Original Pitches* / *Hold Notes to Same Staff Lines
  (Modally)*). Everyone else just leaves the notes alone. ⏭️ Not this pass, but it is the shape the
  question will come back in.

---

## 6. The dev palette (throwaway, on purpose)

🏁 **DELETED 2026-08-28, all but the `✕` — the fate written below arrived.** His call: *"now that the
key signature menu is ready i think we can get rid of the key pallete in the dev shell"*. The five
preset buttons and the `⇅ Stepper…` button are gone; **Insert ▸ Key Signature / `K`** reaches all
fifteen circle-of-fifths signatures (a superset of the presets) through the same
`pressKeySignature`, so nothing moved but the door — the rule the barline and lines rows went out
under.

⛔ **`✕` stays, and not out of sentiment.** Delete on a selected signature is the real removal, and it
needs INK to click; a stored key change can have none — **atonal at bar 1** (nothing before it to
cancel), or **atonal / C major after a key with no accidentals** (a cancellation is a set difference).
⚠️ The Atonal row shipped the same day, so the editor can now AUTHOR both, which makes this button
*more* necessary than it was that morning. ⏭️ Its successor is the **SIGNPOST** (§5); the day that
exists, the `Key:` group goes with it.

The record of what it was, kept because the argument still applies to the next scaffolded palette:

✅ **BUILT 2026-08-27, as STUBS** — before P1, so the door exists before there is anything behind it:

- **`Key:` group in `dev/devToolbar.ts`** — five buttons, C · G · F · D · E♭. ⭐ Each row is
  `{ label, fifths, title }`, and **the `fifths` column is the payload**: when P1 lands, each becomes
  one `keyFromFifths(n)` argument and the table stops being a placeholder. Today the click only
  `dbg()`s. ⚠️ **C is in the list on purpose** — it is the row that catches the two rules an empty
  signature must obey (prints nothing where in force; prints cancelling naturals at a change *to*
  it), and a palette of only keys-with-ink would never ask.
- **`⇅ Stepper…`** in the same group — 🏁 **PROMOTED 2026-08-28: it is `windows/keySignatureWindow.ts`
  now, titled *Key Signature*, and it is the real dialog.** His call: *"the idea is turn this sketch
  in the real thing"*. It was `dev/keySignatureSketchWindow.ts` from 2026-08-27, built explicitly to
  be thrown away while the survey below was out; the survey came back saying the gesture is Finale's
  verbatim and Dorico ships one too, so what was thrown away is the SKETCH FRAMING, not the window.
  What moved with it, unchanged: ▲ sharpwards / ▼ flatwards along the circle of fifths, clamped at ±7
  (⛔ no wrap: C♯ major stepping round to C♭ major is a 14-semitone jump dressed as one click), the
  key name over its count and letters, and a Major/Minor radio.
  - ⭐ **The injected `arm` callback is gone, replaced by a bus seam** — `bus.keySignature`
    (highlight + press, `clefSelection`'s shape), because a window in `windows/` may not reach a
    controller and the injection existed only to keep `dev/` clean. `keypadSync` routes the press to
    `palette.pressKeySignature`, the same door the five buttons use, so the two cannot drift. ⭐ The
    highlight channel buys one thing the sketch never had: **re-opening steps from the ARMED key**
    (`fifthsOf`, null for a mixed or open signature → the axis starts at C).
  - ✅ **Its real door, same day: `Insert ▸ Key Signature`, shortcut `K`** (his ask). K joins Q/T/L/U
    as the bare-letter Insert dialogs and was free; the row is a display echo of `ShortcutConfig`'s
    `'k'`, and both reach `openKeySignatureWindow(windows)` — ⛔ a row is not a second implementation
    of its key. ⏭️ The dev strip's `⇅ Stepper…` is now kept only while the dialog is being iterated
    on; by the rule the barline and lines rows went out under, it goes with the `Key:` group.
  - ✅ **The mode radio is THREE-valued: Major · Minor · Atonal** (his ask, same day —
    *"in the mode we have to add atonal (this should be choisable just in the case of no alteration in
    the key)"*). ⭐ It is `KeySignature.mode`'s own third value, `'open'`, reaching the UI for the
    first time: an empty alteration list with `mode: 'open'`, which `keyFromFifths` deliberately
    cannot build (its argument is a position on the circle, and an open key has none). **Atonal greys
    the moment the axis leaves 0**, and stepping off 0 while it is chosen steps the mode back to
    Major — ⛔ freezing the arrows instead would make the axis a dead end. The readout says *"no key
    signature — not C major"*, which is the distinction `keyOps` already stores (an open key at bar 1
    is a real change; C major there is nothing).
    - The widget grew one generic capability for it — `RadioGroup.setOptionDisabled` (greyed, ⛔ never
      hidden: a row that vanishes takes its own existence with it). ⚠️ It does not move the dot; that
      is the dialog's question and the dialog answers it.
    - 🚨 `keySignatureStamp.keyLabel` had an UNREACHABLE `'open/atonal'` branch — `fifthsOf` answers
      `null` for an open key, so the `null` test above it called one a *custom signature*. Nothing
      could author one until now. Fixed by asking the mode first.
  - 🏁 **THE SIGNATURE IS DRAWN — a staff with a treble clef, restated on every step**
    (`windows/keySignaturePicture.ts`, his ask: *"insert the staff with a treble clef so the user can
    see the key while is adding the accidentals"*). This is what the sketch could not do: the letters
    `F♯ C♯` were a stand-in for a placement table that did not exist when it was written, and P1–P6
    built one.
    - ⭐⭐ **It invents no placement and no space.** Rows from {@link keySignatureLines} (the 56-sign
      table: Gerou & Lusk, Gould p. 91, MuseScore's `ClefInfo::m_lines`), clef ink → first sign from
      `CLEF_TO_KEY_INK` (0.82), sign → sign from `KEY_ACCIDENTAL_GAP` plus each glyph's own advance,
      glyphs from the pass's own `SIGN_CHARS` and `clefGlyph`. ⛔ **So a placement question is
      answered by changing the ENGINE and the dialog follows** — a second table "just for the
      thumbnail" is `keySignatureInkRight`'s two-sets-of-numbers problem in a window nobody audits.
      Sharps therefore space wider than flats here without either number being hand-set.
    - ⚠️ ITS OWN, marked as such in the file: the staff-space size, the air left of the clef, the
      reserved height (worst-case, so the dialog cannot resize under the pointer while you step).
      ⭐ The size is the **Clef window's 7px**, his reference — two dialogs drawing the same kind of
      thing at one size.
    - ⚠️ **Treble is fixed for now.** The signs sit differently under each clef and the picture already
      takes the argument; ⏭️ WHICH clef a picker should show — the one at the bar you will click, or
      one you choose — is an open question, not an oversight.
    - The spec asserts every row **by naming the pitch** (F♯ the top line, B♭ the middle line), which
      is `keySignatureLayout`'s own warning obeyed: its first draft was mirrored through the middle
      line and passed every test written against its own arithmetic.
  - **The layout, settled by eye over four rounds** (his calls, all 2026-08-28): the caption *"Step ▲
    for sharps, ▼ for flats."* is GONE — the picture demonstrates the sentence; the arrows moved
    BESIDE the staff (⚠️ still stacked ▲ over ▼: a left/right pair would not mean "up the circle of
    fifths"); the staff is as short as the widest signature allows (14 spaces); the ▲▼ buttons take a
    new generic `Button` option **`compact`** — tighter padding and no leading, ⛔ the label's own size
    untouched (*"the size of the label of the buttons are ok"*); and the body and the Cancel/OK row
    are TWO nested stacks, so the air before the buttons widened without widening every gap above it.
    - The window toolkit gained the two generic widgets this needed and nothing key-specific:
      **`Picture`** (a block of SVG the dialog can redraw — {@link ChoiceList}'s idea where the
      picture is the ANSWER rather than a row you pick) and `Button`'s `compact`.
  - ⛔ **The stepper reaches the fifteen circle-of-fifths signatures and nothing else** — that is all
    an AXIS can reach. The mixed/custom editor is a separate room (§7); do not grow it out of this one.

✅ **WIRED PROVISIONALLY 2026-08-27 (P2)** — the five buttons stopped logging and now call
`engine.setKeyAt`, with a `✕` beside them for `removeKeyAt`. **Target: the selected measure box
(`Ctrl+Shift+click`), else bar 1.** ⛔ That targeting is NOT a design and must not become one — the
real gesture is §5's armed tool placed by a click on the score. It exists because P2's done-when is
*"still nothing drawn"*, and the **Score-JSON panel** (which polls the live model) is the only test
surface a phase like that has. ⭐ The `fifths` column became five `keyFromFifths(n)` arguments,
exactly as the stub promised it would.

  ⭐⭐ **What the sketch ARGUES**, and it is his point standing up: changing Major↔Minor changes the
  NAME and nothing else. One degree of freedom plus a mode toggle, against Sibelius's 31 cells for 15
  distinct pictures. ✅ The survey later confirmed this is Finale's actual gesture, verbatim, and that
  Dorico ships one too — see §7.

⛔ **All of it is scaffolding with a fate**, written down here so the next agent does not grow it: the
barline palette lived in `dev/` exactly like this and was **deleted** the day the real door existed.
This goes the same way. ⛔ Do not add a minor-key row, a custom editor, or a staff preview — the real
picker is §7, and it is not being designed yet.

---

## 7. ⏭️ Future, explicitly NOT this pass

- **The real key picker.** ✅ **Surveyed 2026-08-27** — full report in the scratchpad
  (`key-signature-ui-survey.md`, 72 sourced URLs). ⛔ Still research only; no UI is being designed.
  What it found, because it changes the starting point rather than the schedule:

  - ⭐⭐ **His memory of Finale is right, verbatim** — and the stepper is not nostalgia: **Dorico
    ships one too**, alongside its `Shift+K` popover. The redundancy he objects to is real and
    measurable (Sibelius: 31 cells for 15 distinct pictures, the empty signature three times).
  - 🚨 **Sibelius cannot author a custom signature at all, and the cause is the TYPE, not the UI** —
    one signed integer plus a `Major` flag, read-only. ⭐⭐ **This plan's §1 argument, proven on a
    shipped product.**
  - The rest — the four-app comparison, the custom-editor fork, the mode caution — is in the research
    record. ⛔ Read it before designing anything.
- **The custom/mixed signature editor.** Permitted by §1 from day one, built later. ⭐ The survey
  found the real fork: Finale puts the door *inside* the picker (a 4th dropdown item) but the room is
  11 steps of numeric entry with **no preview**; Dorico puts the door *elsewhere* (Library) but the
  room is visual, stepped, named and **reusable**. MuseScore got both from one widget, with a boolean
  hiding the picker half depending on the entry point.
- **Transposing instruments** — a written key differing from concert pitch. `keyAt` takes a staff, so
  the address exists; nothing else does.
- **Per-octave scope.** ⛔ Not required by any sourced repertoire. Gould's rule is per-letter, all
  octaves; `octave?` in §1.1 is about PLACEMENT, not scope, and conflating those two is a mistake
  this repo has already made once and written down.

---

## 8. Phases (each independently green)

| # | what | done when |
|---|---|---|
| ✅ **P1** | **BUILT 2026-08-27.** `KeySignature` → list; `fifthsOf` / `keyFromFifths`; `Measure.keys` + `KeyChange`; `keyAt` walks; `measureRenderRoles` row + its `PERTURB` row | ✅ 5358 unit green, `build:check` clean, nothing drawn, `trillPitch`'s source untouched |
| ✅ **P2** | **BUILT 2026-08-27.** `keyOps` writes + `ScoreModel`/`MusicEngine` delegators + undo, **and the dev palette wired provisionally** | ✅ 5377 unit green; a key can be set/removed **by hand**, watched in the Score-JSON panel, and undone — still nothing drawn |
| ✅ **P3** | **BUILT 2026-08-27.** `keysByStaff` prepass (§2.1) + `keySignatureLayout` (the placement table + the gaps) + `headerInk` key row + `KeySignaturePass` | ✅ 5403 unit, **249 e2e** (8 new), `build:check` clean — and it is DRAWN. ⏭️ Hit boxes are P5's after all: nothing selects a signature yet |
| ✅ **P4** | **BUILT 2026-08-27.** the accidental ripple (§3) — one rule, read by every pass — **plus entry (§3.1) and the governing-key `ShapeKeyInputs` row (§1.3)** | ✅ 5438 unit, **252 e2e** (3 new), `build:check` clean. The F♯ in G major loses its sign; the F♮ gains one; a note typed/clicked/dragged in G major is an F♯ with no sign; setting the key at bar 1 repaints bar 12. ⏭️ See §8.4 |
| ✅ **P5** | **BUILT 2026-08-28.** hit boxes (registered by the pass) + `keySignature` element kind + marking tool + its GHOST + `keySignatureStamp` + Delete + the Properties report + the dev palette now ARMS | ✅ 5466 unit, **254 e2e**, `build:check` clean. He can arm a key, click a bar, select the signs, and Delete them. ⏭️ See §8.5 |
| ✅ **P6** | **BUILT 2026-08-28.** cancelling naturals + the cautionary at a break + the OPEN STAFF TAIL under it + an authorable trailing gap (Properties). ⛔ **NO `cautionaryEndKey` in `ShapeKeyInputs` — measured, it is not needed** (§8.6) | ✅ 5496 unit, **257 e2e**, `build:check` clean. A change to C major draws naturals where the old signs stood; a change on a break is engraved at the end of the previous line, staff left open |

### ✅ 8.1 What P1 actually landed — including two rows this plan did not list

- The type moved to `types/music.ts` (§1.1's amendment); `utils/keySignature.ts` re-exports it.
- ⭐ **`engine/models/staffContent.ts` gained `staffKeys` + a `keys` field in `StaffContentView` and
  in `staffMeasureView`.** ⚠️ Not optional and not a nicety: that function's own header warns that a
  measure-level array it does not NAME rides the object spread and lands **unfiltered on every
  staff's lane, silently**. Bartók's two hands would have shown each other's signature — and
  `laneFingerprint` reads the lane, so the width key would have been wrong on every staff but one.
  Its spec asserts the negative (the top staff does NOT see the bottom's key), the file's own idiom.
- ⭐ **`keyAt` gained an optional `beat`**, defaulting to the bar's start. §1.2 permits a mid-bar key
  change, and a function that cannot express one would have had to guess. ⛔ The two call sites
  (`trillOps`, `playbackSchedule`) were left passing no beat — correct while nothing writes a
  non-zero one, and a one-line change each when something does.
- ✅ **P2 ANSWERED the `clearMeasureForRebar` question, and the answer was to REMOVE the risk rather
  than handle it: `keyOps` has NO `beat` parameter.** The write API places at the head of a bar,
  full stop. So the two halves are:
  - a **beat-0** signature is a BOUNDARY fact — "this bar is in E♭" — like `timeSignature`, `barline`
    and `repeatStart`, none of which `clearMeasureForRebar` deletes either. It rides its measure
    through a re-tile. **Correct, and zero code.**
  - a **beat > 0** signature would need a `CapturedAnchor` kind, and ⛔ is not built, because nothing
    writes one (only an import could). ⏭️ The day a mid-bar key change becomes a feature it needs the
    capture/restore pair IN THE SAME COMMIT, and `keys` must join `clearMeasureForRebar`. Written at
    the top of `keyOps.ts`, which is the module that would break it.

### ✅ 8.6 What P6 landed — the cancellation, the courtesy, and a tail nobody owned

**1. CANCELLING NATURALS.** `keyChangeRow(opening, previousEnding, clef)` is the one owner of *what a
key change draws*, and both the bar's head (`headerKeyAt`) and the cautionary read it — ⭐ because
Gould p. 93 makes them one question. Naturals only when the new key has none of its own (G&L p. 79:
*"Cancellations are no longer considered necessary, unless the new key is C major or A minor"*;
MusicXML says it as a spec sentence). The set is outgoing − incoming in the OUTGOING order.

⭐⭐ **The naturals ride as `alter: 0` alterations carrying the cancelled sign's own OCTAVE**, so the
extent model, the placement table, the drawing pass and `keySignatureInkRight` handle a cancellation
with no new type. 🚨 The octave is what makes it correct: `keySignatureLines` reads
`alter >= 0 ? SHARP_STEPS : FLAT_STEPS`, and a natural is 0 — without it, cancelling three flats would
draw three naturals in the SHARP positions.

🚨🚨 **`alterToString(0)` IS THE EMPTY STRING**, which cost the first build a silent nothing: every
natural resolved to `null` and was skipped by both the extent (0 advance) and the pass
(`if (!glyph) return`), with no error anywhere. ⭐ `signGlyph` now owns that question and the pass and
the ghost both read it. ⛔ Do not simplify it back to `accidentalGlyph(alterToString(alter))`.

**2. THE CAUTIONARY AT A BREAK** — `engine/layout/cautionaryKey.ts`, its own module rather than a third
copy of `MeasureLayout`'s loop, and it differs from the clef's and the meter's in three ways (no
opt-in gate; the room comes off the LINE; per staff). Drawn by `KeySignaturePass`, 0.75 sp after the
last barline, staff left open, and the new system takes only the new signature.

⚠️ **The room comes off the LINE, not the bar** — a bar's own barline is drawn at its right edge, so
room added to `minWidth` would put the courtesy on the wrong side of it. `distributeLineWidths` gets a
narrower width and the leftover is the courtesy's.

🚨 **His report: *"look, the key cautionary is there, but where is the pentagram?"*** The signs were
floating past the staff's end — a bar draws staff lines only across its own span, and the courtesy
zone belongs to no bar. ⭐ It belongs to the SYSTEM, so the pass that puts ink there draws its five
lines (`drawOpenStaffTail`). ⭐ Its thickness is `STAVE_LINE_WIDTH_PX`, the one constant `drawStave`
pins — **his challenge**: *"vexflow? shouldnt the solution follow the rules of own engine md?"* So it
is *the tail of a line is as thick as the line*, asked of the place that decides it, and that constant
carries the note that SMuFL says 0.13 sp and why moving every staff line is not this phase's to do.

**3. ⛔ NO `ShapeKeyInputs` ROW — the plan predicted one and it is not needed.** Measured: a change to
the OUTGOING key that leaves the row's width identical (three flats → three sharps) still repaints,
because the signature is drawn by a SCORE-LEVEL pass and is not inside any measure group. ⭐ That is
the same property that makes `KeySignaturePass` immune to a stale cached picture (its own header).

#### ⭐⭐ 8.6a THE TRAILING GAP — three answers, his choice, and now a control

His question of the bare staff after the courtesy — *"is this the space in the cautionary key
correct… what does the literature say? what the 3 engines say?"* — sent to two agents, and they
disagree by almost a space and a half:

| source | trailing gap | how it was established |
|---|---|---|
| **Gould p. 93** | **≈1.9 sp** (1.89 / 1.85 / 2.08) | measured at 600 dpi, three instances. ⚠️ Her staff ends far short of the text measure — a free-length EXCERPT |
| **Gerou & Lusk pp. 78, 52** | **0.42 / 0.53 sp** | the library's only MATCHED PAIR: the courtesy staff and the staff below it drawn to the same right edge |
| **MuseScore** | **0.5 sp** | `Sid::systemTrailerRightMargin`, `style/styledef.cpp:228` |
| **LilyPond** | **0.5 sp** | `KeySignature.space-alist (right-edge . (extra-space . 0.5))`, and the same on `KeyCancellation` |
| **Verovio** | **0.5 sp** | `rightMarginKeySig` = 1.0 MEI unit, and a unit is *"1⁄2 of the distance between the staff lines"* |
| ⭐ **OURS** | **0.75 sp** | **HIS choice** — *"i liked it, it was a good compromise between gould and what the engines say"* |

⭐⭐ **AND NO SOURCE STATES A DISTANCE AT ALL.** G&L p. 78 rule 3 says only *"The staff is left open
after the courtesy key signature"*; Ross p. 148 the same. The drawn numbers differ because Gould's is
a LEFTOVER on a free-length excerpt and G&L's is a MARGIN on a fixed-width figure — which is also what
ours is (the line gives up `0.75 + ink + tail`, so the staff runs to the margin, exactly as G&L's
matched pair does).

⭐ **So it is authorable** (his ask: *"give the user the freedom to change the number in properties"*):
`CautionaryKeyGapOverride`, keyed by the CHANGE's measure and staff (`cautionaryKeyGapKey`), written
through `keyOps.setCautionaryKeyGap` → `bus.cautionaryKeyGap` → `CautionaryKeyGapController`, and shown
as the Properties panel's **courtesy tail (sp)** row. `null` resets; ⛔ **0 is a real value**, not
"absent".

🚨 **His report while testing it: *"i'm changing the courtesy tail but i dont see change in real
time"*** — a genuine bug, and the oldest kind in this repo: the WRITE goes through
`MusicEngine.staffIdForIndex`, which returns **undefined for staff 0** (the absent-`staffId`
convention), while the layout's lookup used the staff's **real id**. Stored under `cautionKeyGap:<m>`,
read under `cautionKeyGap:<m>:s<id>` — a silent miss with the write returning true. ⭐ Fixed by
`keyStaffId(staffIndex, staffId)`, the adapter the clef's cautionary one loop up already used. ⛔ Any
override key built from an ORDINAL needs it.

#### ⏭️ 8.6b What P6 did NOT do, deliberately

- **The `after` / `before-bar` cancellation placements** (MEI's `data.CANCELACCID`). The vocabulary is
  settled (§4.2) and `none`/`before` are what the rule needs today; ⛔ an enum with two members
  nothing can reach would be a table that lies about being total.
- **A double barline before the courtesy.** ⚠️ **MuseScore draws one by default**
  (`CourtesyBarlineMode::DOUBLE_BEFORE_COURTESY`), and Ross p. 148 and G&L p. 78 both engrave a thin
  double before it — while Gould p. 93 draws a single. ⛔ We generate none: **his standing decision**
  (§4.2b), reversed by him the same day he first made it. Recorded here because three of five sources
  disagree with us, so this WILL come up again.
- **The courtesy CLEF's side.** The literature is unanimous that a clef goes BEFORE the last barline
  and is CLOSED by it, where the key and meter go after and stay open (Gould p. 7, Stone p. 57, G&L
  p. 52 — measured: clef→barline 0.52 sp, then a full-height line). ⚠️ Our courtesy METER is drawn on
  the wrong side of the line (VexFlow's END modifier sits inside the bar) — ⏭️ the meter's own change,
  not bundled here. (✅ Fixed 2026-09-12 — `docs/barline-types-plan.md` §4.4a.)
- **Suppressing a cautionary.** ⏭️ His *"everything can be tuned… but this is not priority now"*, and
  ⛔ it must not be built by inverting the other two kinds' override table.

### ✅ 8.5 What P5 landed — and the two reports his eye made the same hour

**The phase itself**, one row per table the standing rule asks for:

- **The hit boxes**, registered by `KeySignaturePass` as it draws — ONE box per signature (the row from the
  first sign's ink to the last's, five lines tall), because the signature is what you select and delete.
  ⚠️ No `isPainted` filter, unlike the clef and meter beside it in the chain: this box is written by the
  PEN, so its existence is proof it was painted (`repeatStart`'s position exactly).
- **`interactions/elements/keySignature.ts`** + its rows in `ELEMENT_HIT_ORDER` (with the clef and the
  meter — the three header glyphs sit in their own columns, so their order among themselves decides
  nothing) and `ELEMENT_SPECS` (now 21 kinds).
- **`SelectedElement` gains `keySignature`** — positional and per-STAFF, the clef's shape, because that
  is how the model stores it. The compiler then named FIVE sites, not the two the plan predicted: Delete
  (`shortcutWiring`), the Properties report (`selectionSnapshot`), the paint table, **`pasteAnchor`**
  (a third `assertNeverElement` switch nobody had listed) and **`PaletteController.promoteStampToNoteEntry`**.
- **`MarkingTool` gains `keySignature`** + its `MARKING_TOOL_USES_ARMED_LENGTH` row + `toolGhost` case +
  `GHOST_CAUSE` label. ⛔ **No `cautionary` field** — the clef's and the meter's ride along because a
  DIALOG decided it; nothing decides a key's courtesy today, and P6 is the engraving's own answer.
- **`engine/rendering/KeySignatureGhost.ts`** — the row of signs at the pointer, drawn on their real
  staff LINES (`keySignatureLines`) so G major and F major are told apart by their picture. It shares
  `SIGN_CHARS` and `SIGN_FONT_SIZE` with the pass, so a preview cannot show a glyph the click will not
  engrave. ⛔ An empty signature previews NOTHING and says so — the signpost's hole, not papered over.
- **`interactions/keySignatureStamp.ts`** — a click places at the HEAD of the bar it lands in (⛔ not the
  barline stamp's nearest-LINE rule: a key is a statement about a BAR, which is why `keyOps` takes no
  beat). ⭐ **Plain drop = ALL staves, `Ctrl`/`Cmd` = the clicked staff** — MuseScore's polarity, all four
  apps' default (§5.1), and ONE undo batch for the whole gesture.
- **Delete** reverts the bar to the inherited key, bar 1 refused (`keyOps.removeKeyAt`'s guard).
- **The dev palette's five buttons now ARM** instead of writing at "the selected bar, else bar 1" — the
  provisional targeting §6 warned against is gone. ⚠️ The `✕` STAYS: a C-major change has no ink, so
  until the signpost is drawn that button is the only way to take one back.

#### 🚨🚨 8.5a HIS REPORT: *"the empty rest is not centered… is more to the right"*

An empty score with a mid-line E♭ change. Measured, that bar kept **6.0** spaces of silence against its
neighbours' **8.8**, because the signature and its gaps took 5.2 of an 11.2-space bar.

⭐⭐ **The FREE-SPACE rule was confirmed in all three engines before anything was touched, and it stands** —
⛔ so do not move the rest's left bound back to the barline: MuseScore centres in *"free space"* whose left
edge is the previous enabled segment (`measurelayout.cpp`); LilyPond's `MultiMeasureRest.spacing-pair`
defaults to `break-alignment` and its property doc offers `(staff-bar . staff-bar)` as the override *"to
ignore prefatory items"*; Verovio's `Measure::GetInnerCenterX()` measures from `GetLeftBarLineRight()`.

⭐⭐ **What was wrong was the SPAN, and the fix is that the two bounds are not the same kind of ink.** A rest
may stand much nearer a sign than a barline, and `pairPadding` already said so: `('accidental','rest')`
= 0.5 sp, `('rest','barline')` = 1.65 sp (MuseScore's `table[REST][BAR_LINE]`). So the rest is centred in
`[signature ink + 0.5, barline − 1.65]` — the room it may OCCUPY. That is 0.575 sp left of the bare-gap
answer, and he had already placed it there by hand, twice (`noteOffset` −0.5 and −0.75) on two different
bars. ⚠️ SCOPED to a bar whose header ENDS in a signature; a clef or meter would need `InkKind` rows of
their own, and a new padding row needs his eye.

⛔ **TWO fixes were built, measured and thrown away — do not re-derive them:**

| what | the source that supports it | why it is out |
|---|---|---|
| grow the bar until its silence matches its neighbours' | MuseScore `computeMinMeasureWidth` adds the header span; Verovio floors the header-EXCLUDED inner width and makes the header non-justifiable | *"I dont think in this case of an empty measure the bar have to grow so much in comparison with the others"* — it came out 150 px against 110 |
| centre between the BARLINES (clamped off the signature) | LilyPond's documented `spacing-pair` override | *"wrong again… the rest should be center in the empty space of the measure, not in the whole measure"* |

⭐ **And his rule that killed the first two attempts, worth keeping:** *"dont apply a magic number, cause
with different keys will be different."* Nothing is added to the ANSWER — the left bound is measured INK,
so seven sharps move it right and one flat moves it left on their own.

#### 🚨🚨 8.5c FOUR MORE OF HIS REPORTS — the SCOPE of a selection, and a hit box that was never on its glyph

**1. *"the key is for all the staves … however when i selected it only select the first stave"*, and an
hour later *"and if i remove i remove the first stave only."*** Both were one bug: the selection was
scoped to the staff whose ink was clicked.

⭐⭐ **`interactions/keySignatureScope.ts` — the scope is READ FROM THE MODEL, not decided.** Every staff
whose signature at that bar IS the selected one (`getKeyAt` + `keysEqual`, so a system-head REPRINT
that stores nothing still counts). Two staves in one key light and delete together, because they are
one statement; ⭐ **two staves in genuinely different keys stay separate** — his own warning the same
hour: *"be carefull here case the case change if there is different key signature in staves (not for
transposition, but in modern scores)"*. ⚠️ The highlight and Delete call the SAME function; that is
what makes the lit ink a promise rather than a coincidence.

**2. *"here the key signature is not been selected or at least not highlited"*, then *"here the time
signature is not selected or highlited either."*** One bug again, and it was the METER's box:
`x + CLEF_HIT_WIDTH` with a constant width — a bar's left edge plus a guess, written when nothing
could stand between the clef and the meter. Measured at bar 1 with two sharps: clef **20→65**, meter
**65→95**, signature **60→82**, digits drawn from **93**. The meter's box covered the signature and
missed its own glyph.

⭐ Fixed at the source: the box is now the modifier's own x plus `glyphBox('timeSig4')`'s ink, with the
reused-bar `staleShift` correction — **94→111**, disjoint from the key's 60→82. And the KEY moved to
the FRONT of the three header glyphs in `ELEMENT_HIT_ORDER`, because its box is real ink where the
clef's and the meter's are padded regions (the `|:`-before-barline lesson). ⏭️ The clef's box is still
a 45 px region for a ~27 px glyph; narrowing it would make that order free rather than load-bearing.

**3. *"here i remove the key but nothing hapend i still see the key on screen"*** — Delete at bar 1.
⭐⭐ **The measure-1 protection is GONE, and the citation that justified it was sound while the premise
was not.** MuseScore disables it because *"it is impossible to know whether you want a C major/A minor
key signature, or an 'open/atonal' one"* — but §1.1 decided open/atonal is a distinct value carried by
`mode`, so OUR model can tell them apart and "nothing stored at bar 1" means C major, full stop.
⛔ Do not restore the guard by citing MuseScore again. ⚠️ Nor is it the CLEF's case: a staff must be
read in some clef, so removal there is meaningless; every bar is in some key, and C major is one.

**4. *"i selected barline before measure 3 and clicked D … expected is that we make a D major key
change in measure 3."*** ⭐ A selected BARLINE now names the bar it OPENS (`keyTargetFromSelection`),
and a `|:` names its own — the same sentence from either side of the line. System-wide, because a
barline selection has no staff of its own.

**5. *"i open in the palette the stepper, arm for A major, hit ok but the key is not armed."*** The
sketch dialog was written before P1 and its own comment said it armed nothing — true for four phases.
Its OK now calls `palette.pressKeySignature`, the same door the five buttons use, with the function
INJECTED by `devToolbar` so `dev/` still reaches no controller of its own.

#### ⏭️ 8.5d THE TIME SIGNATURE ACROSS STAVES — asked, answered, NOT yet built

His question, from the grand-staff screenshot: where two staves' headers differ in width, where does
each staff's meter go? Two agents were sent at it — the literature, and the three engines' sources —
and they agree.

⭐⭐ **THE METER IS ALIGNED ACROSS THE SYSTEM, AND IT CLEARS THE WIDEST HEADER. The key signatures are
LEFT-aligned with each other.**

| source | what it says |
|---|---|
| **Gould p. 326** (the Cowell *Tides of Manaunaun* extract, MEASURED off the 450 dpi scan) | grand staff, **6 flats over 1 flat**, both printing `4/2`: the two meters' ink is **513–543 on both staves — Δ = 0.00 sp**. Both key signatures BEGIN at x = 380. The one-flat staff's meter is not placed after its own key; it waits **5.80 sp**. |
| **Gould p. 94** | *"An instrument on two (or more) staves can take an individual key signature for each stave. (Bartók employs this frequently … see also Cowell extract, p. 326.)"* — the sentence that licenses the case, and its pointer IS that engraving |
| **MuseScore** | one `Segment` = one x for every staff (`dom/segment.h:98`: *"A segment holds all vertical aligned staff elements"*); `horizontalspacing.cpp:1328`: *"first chordrest of a staff should clear the widest header for any staff"* |
| **LilyPond** | `BreakAlignGroup` (`scm/define-grobs.scm:625`): *"An auxiliary grob to group several breakable items of the same type (clefs, time signatures, etc.) across staves so that they will be aligned horizontally"* — and `Break_align_engraver` is consisted in **Score**, so one group per column |
| **Verovio** | one `Alignment` per (time, type), shared by every staff (`horizontalaligner.h:425`); `view_page.cpp:140`: *"longest key signature of the staffDefs"* → one `SetDrawingWidth` for the system |

⚠️ **UNKNOWN in prose:** no treatise on disk STATES the rule — Gould pp. 41–43/91–94/233–235, Ross
pp. 143–152, Stone pp. 44–45 and G&L pp. 78–81 were read. It rests on that one measured engraving plus
three engines agreeing. ⛔ So quote the measurement, not an invented sentence.

⏭️ **NOT BUILT.** `placeMeterAfterKeySignature` is per-STAVE, so two staves in genuinely different keys
would still put their meters at different x. `keyOps.copyStaffKeys` hides it in the common case (both
staves get the same key), which is why the screenshot that raised it no longer reproduces. The fix is
to place every staff's meter at the SYSTEM's widest signature ink — the machinery is already there
(`MeasurePlacement.system.headerExtent` maxes over staves, and `spreadHeaderToSystem` exists for
exactly this class of problem). ⛔ Do not start it without saying so: it moves every meter in every
grand staff.

#### ⏳ 8.5e A KEY CHANGE INSIDE A BAR — research commissioned 2026-08-28, literature only

The model already permits one (`KeyChange.beat`, and `keyAt` takes a beat — §1.2, on MuseScore's
evidence), nothing writes one, and `keyOps` deliberately offers no `beat` parameter (§8.1: it is what
keeps `rebarOps` correct). His question is what we would have to obey IF it is ever built. ⏳ An agent
is reading the treatises; ⛔ nothing is decided here until it reports, and a mid-bar change stays
unwritable meanwhile.

#### 🚨 8.5b HIS REPORT: *"the new stave has no key signature"*

Three flats at bar 1, then a staff added below — and the new staff read as C major. The per-staff model
showing through: a key change is stored per staff, so a staff that did not exist when the key was written
carries none.

⭐ **`keyOps.copyStaffKeys`** — a new staff adopts the REFERENCE staff's signatures, bar for bar, cloned.
⭐ **Why a key is not a CLEF here:** a fresh staff deliberately keeps the universal `'treble'` default,
because which clef it wants is a fact about the INSTRUMENT and the user must say. A signature is a fact
about the MUSIC, one statement for the system — which is why a plain drop writes all staves.

⚠️ **And a second bug found beside it:** `ScoreModel.solidifyFirstStaffContent` did not stamp `keys`, so
PREPENDING a staff would have silently re-pointed the outgoing first staff's signatures at the new top
staff — the exact re-pointing that pass exists to prevent. Fixed in the same commit.

⏭️ **OPEN, his ask:** where two staves' headers differ in width (one has a key, the other none — or two
different keys), is the TIME SIGNATURE aligned across the system or placed per staff? Two agents were sent
at it (the literature; the three engines' sources). ⚠️ With `copyStaffKeys` in place the common case no
longer diverges, so what is left is the Bartók case — do not treat it as settled until those answers land.

### ✅ 8.4 What P4 landed — and the door his eye found the same day

⭐⭐ **The whole phase is ONE function, and naming it is what made the five call sites agree:**
`accidentalState.alterInForce(barAlterations, key, step, octave)` — *the bar's running accidental at
this position, else what the key says about the letter.* It was already written out inside
`trillPitch` (`inForce ?? fromKey`); extracting it is what stopped the drawing, note entry, "remove
accidental" and the trill's auxiliary from each having their own version.

🚨 **`??`, never `||`.** An explicit natural earlier in the bar is `0`, and it must WIN over a sharp
in the key. That one line is the difference between "the bar said nothing" and "the bar said
natural", and it is the only place a signature could silently overrule a written sign.

**The DISPLAY half** — `displayedAccidentals(slots, key)`, with the key threaded to five call sites,
each taking ITS OWN bar's: `measureColumns.displayedSigns` (per lane, through a new
`keyResolverFor` — `clefResolverFor`'s twin), `NoteBuilder`, `FanPass` in-bar, `FanPass` cross-bar
(per member, off a new `CrossBarBar.key`), and `SelectionController`'s report.

**The ENTRY half** — `engine/models/entryAlteration.ts`, a new module. ⭐ *The key is the default
alteration at entry, and the armed accidental overrides it.* **Six** sites, not the three §3.1 listed:
the click (`NoteEntryCoordinator`), typing a letter and stacking a chord note and re-typing over a
selected note (`KeyboardController` ×3), the arrow-key diatonic step (`SelectionController`) — and
⭐ **the vertical DRAG** (`MouseController.handleNoteDrag`), which §3.1 missed and is the mouse twin
of the arrow keys: it writes a pitch from a Y coordinate, so without it every drag in G major minted
a spurious ♮.

⚠️ **`movePitchDiatonically` stopped carrying `alter`.** It returns the next LETTER and nothing else;
the alteration is `entryAlteration`'s answer at the position it lands on. Before, a step up from F♯
in G major came out **G♯**, because the sharp belonged to the F it left behind.

**The CACHE half** — `ShapeKeyInputs.key`, fed from a new `MeasurePlacement.key` (the GOVERNING
signature, ⛔ not `headerKey`, which is what a bar *prints*). Break-tested: remove the row and
"setting the key at bar 1 changes bar 40's shape key" goes red while bar 40's own `laneFingerprint`
is byte-for-byte unchanged — which is the whole point, and why `measureRenderRoles.test.ts` cannot
catch it.

⚠️ **A KEY IS A WIDTH CHANGE**, and it is `measureColumns` that makes it one: the signs are ink, and
the ink is priced into the column. ⛔ The clef's width-independence proof does not transfer. Also
break-tested (drop the resolver → two width assertions go red).

### 🚨🚨 8.4b HIS REPORT, same day: *"I added ♯ to the F that is already ♯ — I expect to see the accidental written"*

Gould p. 81 arriving from the user's side, on a score in D major. **The rule was already right** —
`forceAccidental` beats the suppression, and it was tested. What refused him was a door one layer
above it: **`MusicEngine.noteDisplaysAccidental` matched on `alter` alone**, so an F carrying
`alter: 1` answered *"already there"* about a sign that was **not on the page**, and the stamp's
idempotency check swallowed the click. Both the stamp (`MouseController`) and the palette's group
toggle (`PaletteController.applyAccidentalToSelection`) go through it, so both were dead.

⭐ **Every branch now asks the same question — is a sign actually DRAWN?** — the alteration matches
AND it is not silently in force, unless it was forced. The natural branch had always read this way;
the sharp and the flat now do too. The behaviour he asked for then falls out with **no new state**:
the click reaches `setNoteAccidental`, which already sets `forceAccidental` when the alteration is
the one there, and the sign appears. Press again → it now displays → revert to the prevailing
alteration → it goes. A clean toggle either way.

⭐⭐ **The lesson, and it is the phase's: a RULE being right is not the same as its DOOR being open.**
`displayedAccidentals` had the courtesy case covered from the first commit; nothing drew it, because
a guard several modules away was still asking the pre-key question. ⛔ When a feature changes what a
predicate MEANS, grep for everyone who computes it a second way.

⏭️ **Parentheses around such a courtesy** are his next want, and are a separate authored property —
not this pass.

⏭️ **Not P4's, recorded so it is not mistaken for a regression:** the ENTRY GHOST draws its sign
from `alter` alone, so an armed ♯ hovered over an F in G major previews a sharp the committed note
will not draw. That divergence predates this phase (the same happens in C major after an F♯ earlier
in the bar) and no new case was created by it — the common case, nothing armed, previews correctly.

### ✅ 8.3 What P3 landed — and the four numbers HIS EYE corrected

⭐⭐ **Every one of these was caught by looking at the screen, and every one of them had a published
answer nobody had read.** That is the section's lesson, not a list of fixes.

| what | wrong | right | why |
|---|---|---|---|
| the sign's SIZE | 38 pt, invented | **30 pt** | Gould p. 78: an accidental is scaled down *"only"* before a grace or cue note — research §9.4.3, written before this pass existed. 30 is VexFlow's `MetricsDefaults.fontSize`, which its `Accidental` inherits |
| clef ink → 1st sign | 1.02, then 1.5 | **0.82** | LilyPond `Clef.space-alist (key-signature . 0.82)`; MuseScore `clefKeyDistance 0.75`; Ross's engraved 3½ origins − Bravura's gClef ink = 0.82 |
| last sign → meter | ≈1.6 (VexFlow's leftover) | **1.15** | LilyPond `KeySignature.space-alist (time-signature . 1.15)`; MuseScore `keyTimesigDistance 1.0` |
| a line-opening whole-bar rest | ½ space right | **centred in the free space** | MuseScore `measurelayout.cpp`: *"centered in free space — x1 [the] left measure position of free space"* |

🚨🚨 **THE RULE THAT WOULD HAVE PREVENTED THREE OF THE FOUR: a space is decided in INK, and it needs a
QUOTATION.** His words. The 1.5 came from a treatise LABEL plus an inference; the 1.6 was never chosen
at all (it was whatever VexFlow's own header layout left between clef and meter); the rest's bound was
`getNoteStartX()`, which is the header's ink PLUS the 2.0 sp the music needs. ⛔ And a bbox is not
ink: `modifier.getWidth()` is a layout box carrying someone else's padding, and the meter's carries
0.6 sp of it.

⭐ **…and a centre is a PROPORTION of measured geometry, never a nudge** — his words again. The rest
is `left + (right − left) / 2` over the span actually measured, so it follows a key gaining a sharp or
a meter gaining a digit without anyone touching it.

**Also landed:** `engine/layout/keySignatureLayout.ts` (the 56-sign placement table, three sources
agreeing, plus the gaps) · `resolveStaffKeys` · the `key` part in `headerExtent`, **pair-keyed** now
that its two neighbours have their own numbers · `KeySignaturePass`, which OWNS where the ink is
(`keySignatureInkRight`) so the meter is **placed** after it rather than shifted by the reservation —
they had drifted 0.08 sp apart · `clefGlyph` in `fontMetrics`.

⚠️ **`keySignatureLines` shipped INVERTED and every test agreed with it** — the table's numbers came
out mirrored through the middle line, and the only assertion that caught it was the one going through
`staffLineForSpelling`, where two conventions had to agree. ⛔ Do not test a placement table against
its own arithmetic: name the PITCH each line is.

### ✅ 8.2 What P2 landed

- **`engine/models/keyOps.ts`** — `setKeyAt` / `removeKeyAt`, free functions over a `Score`, the
  `clefOps` idiom. ⭐ **The rule that makes them more than setters is `clefOps`' normalization:** a
  signature equal to the one already in force stores NOTHING (and clears any change stored there), so
  a `keys` entry always means *"the signature changes here"* — never *"someone clicked a button
  here"*. ⛔ Measure 1 refuses removal (change-only), the clef's protection and MuseScore's reason.
- ⭐ **`setKeyAt(1, C_MAJOR)` stores nothing; `setKeyAt(1, open)` stores a change** — because
  `keysEqual` compares `mode`. The ambiguity MuseScore refuses to guess at is one we can record.
- **`utils/keySignature.ts` gained `keysEqual` and `keyBefore`** — both with a caller: the
  normalization above. `keyBefore` is `effectiveClefBefore`'s twin at bar granularity, and it is the
  read cancellation will want for its outgoing signature.
- ⛔ **`normalizeKeyAt` was NOT built.** The plan listed it because `clefOps` has one — but that one
  exists for the clef DRAG (redundant positions are allowed transiently mid-drag). There is no key
  drag, so it would be an export with no caller. ⏭️ It arrives with the gesture that needs it.
- **`MusicEngine.setKeyAt` commits WITH a playback resync**, which looks wrong for something that
  changes no stored pitch. It is right: the trill's auxiliary resolves against the key
  (`playbackSchedule.auxiliaryPitchFor` → `keyAt`), so a key change alters what a trill sounds.
- **The dev palette now WRITES** (§6) — provisionally, at the selected measure box else bar 1, plus a
  `✕` to remove. ⛔ Not the gesture; P5's armed tool is. It exists so a phase whose done-when is
  "still nothing drawn" can be tested by hand at all.
- ⚠️ **Both new specs were break-tested**: dropping the engine's `commit` turns the two undo tests
  red. A green test nobody has seen fail proves nothing.

⚠️ **P4 is the one that can go quietly wrong**, and it is the one with no drawn evidence in jsdom.
⚠️ **AMENDED: P4 is now the biggest phase, not the subtlest one** — the amendments moved two whole
jobs into it (note entry, and the cache row that decides whether any of it repaints). ⭐ Splitting it
is fine and probably right — **P4a display, P4b entry** — but ⛔ they cannot ship in either order
without the other being *known*: P4a alone puts a natural on every note the user types.

## 9. The research that decided all of this

📄 **`docs/key-signature-research.md`** — the evidence, digested from five passes run on 2026-08-27:
Gould; Ross / Gerou & Lusk / Stone; the MuseScore, LilyPond and Verovio sources; MusicXML, MEI, SMuFL
and the four applications; and the UI survey.

⭐ **Go there before changing a number in this plan.** Every figure below the line — the placement
table, the 1.25 sp sharp pitch, the `none` cancellation default, the no-kerning rule — has a page
number, a measurement or a `path:LINE` behind it, and several were decided by a source disagreeing
with another. ⛔ Re-deciding one without reading why costs more than reading it.

## 10. ⛔ The decisions — research is finished

**Research is finished. What is left are DECISIONS.**

| # | decision | who |
|---|---|---|
| ~~l~~ | ~~is an open/atonal key a distinct value~~ | ✅ **decided 2026-08-27: YES, and `mode` carries it** (§1.1) — *"we need to have the atonal key"* |
| ~~d~~ | ~~cautionary at a system break: ON or opt-in~~ | ✅ **decided 2026-08-27: ON, and it is the ENGRAVING, not a warning** (§4.2) |
| ~~o~~ | ~~double bar at that cautionary~~ | ✅ **decided 2026-08-27: NO — we generate NONE. Gould's rule; the double bar is the AUTHOR's edit** (§4.2b). ⚠️⚠️ This reversed TWICE in one day (no → yes → no); the second reversal is HIS and is the standing one. 🚨 It depends on the thin double `||`, which `BarlineStyle` does not have yet |
| ⏭️ p | user controls to HIDE the cautionary and to force a single bar | ⛔ **explicitly not this pass** — his FYI |
| ~~m~~ | ~~how a zero-glyph key change is SELECTED~~ | ✅ **decided 2026-08-27: a SIGNPOST** (§5), riding the existing hidden-ink/audience seam |
| ~~n~~ | ~~flat→flat pitch: 1.00 / 1.08 / 1.12~~ | ✅ **decided 2026-08-27: ONE gap of 0.25** → flat 1.15 / sharp 1.25 (§4.0b) — ⚠️ a prediction, owed his eye at P3 |
| ⏭️ q | the NATURAL's gap (Gould ≈0.46; two engines give it its own constant) | ours, when cancellation is drawn |
| ~~c~~ | ~~cancellation default~~ | ✅ **decided: `none`** — the 1970→1996 shift, §4.2 |
| ~~i~~ | ~~open/atonal in the treatises~~ | ✅ Stone p. 174: *"In nontonal music there are no key signatures, regardless of whether the score is transposed or in C"* |
| ~~j~~ | ~~an engraver's spacing numbers~~ | ✅ research §9.4.2 / §9.4.2b |
| ~~k~~ | ~~the real picker's UI~~ | ✅ surveyed — ⛔ still future (§7) |

### 10.1 Traps recorded now, so they are not rediscovered

- ⚠️ **Hidden ≠ absent.** MusicXML's `print-object="no"` draws nothing but the key still governs
  spelling. Our `timeSignatureHidden` precedent already says this; a key needs the same reading.
- ⚠️ **`octave?` is an OVERRIDE, and the clef table is the default.** The tenor clef's ascending sharp
  pattern differs — but it is *derived from the clef*, and all three engines bake it into their
  placement table. ⛔ Do not store the tenor exception per alteration; that would put the rule in the
  data.
- ⏭️ **If we ever export MusicXML**, a classical signature must go out as `<fifths>`: Sibelius's
  importer silently ignores `<key-step>`/`<key-alter>`. Irrelevant today (we export JSON only), and
  recorded so it is not discovered by a user.
- ⏭️ **Repeats and jumps across a key change** are real and documented (a courtesy that itself needs
  cancelling; a single parenthesis pair enclosing clef+key+meter together). ⛔ Out of scope, but
  §7's play-order work already exists, so it will meet this.
