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

⛔ **Nothing is built except the dev-shell stubs (§6).** P1 has not started.

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

✅ **DECIDED: one constant, `KEY_ACCIDENTAL_GAP = 0.25`**, not a per-glyph table. ⭐ The whole reason
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

⚠️ And "one new row" is one row plus **three call sites** (`MeasureLayout`, and `VexFlowRenderer`
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

✅ **BUILT 2026-08-27, as STUBS** — before P1, so the door exists before there is anything behind it:

- **`Key:` group in `dev/devToolbar.ts`** — five buttons, C · G · F · D · E♭. ⭐ Each row is
  `{ label, fifths, title }`, and **the `fifths` column is the payload**: when P1 lands, each becomes
  one `keyFromFifths(n)` argument and the table stops being a placeholder. Today the click only
  `dbg()`s. ⚠️ **C is in the list on purpose** — it is the row that catches the two rules an empty
  signature must obey (prints nothing where in force; prints cancelling naturals at a change *to*
  it), and a palette of only keys-with-ink would never ask.
- **`dev/keySignatureSketchWindow.ts`** — 🚧 a SKETCH of the picker, opened by `⇅ Stepper…` in the
  same group. ▲ sharpwards / ▼ flatwards along the circle of fifths, clamped at ±7 (⛔ no wrap: C♯
  major stepping round to C♭ major is a 14-semitone jump dressed as one click), the key name over its
  count and letters, and a Major/Minor radio. ⭐ It shows **letters, not glyphs on a staff** — the
  placement table existed nowhere when it was written, and drawing one from memory would have been
  inventing a rule. It logs and closes; it arms nothing.

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
| **P2** | `keyOps` writes + `MusicEngine` delegators + undo | a key can be set/removed in a test, still nothing drawn |
| **P3** | `keysByStaff` prepass (§2.1) + `headerInk` key row + `KeySignaturePass` — draws at system starts and at changes, **and registers its own hit boxes** (§5) | e2e measures the room; **run `test:e2e` either side**; ⚠️ a C-major score's header width is UNCHANGED (§4.1) |
| **P4** | the accidental ripple (§3) — one rule, read by every pass — **plus entry (§3.1) and the governing-key `ShapeKeyInputs` row (§1.3)** | the F♯ in G major loses its sign; the F♮ gains one; **a note typed in G major is an F♯ with no sign**; setting the key at bar 1 repaints bar 40 |
| **P5** | marking tool + element kind + Delete + dev palette | he can place a key and click it |
| **P6** | cancellation naturals + cautionary at a break (**+ `cautionaryEndKey` in `ShapeKeyInputs`**) | ⏳ policy from the research |

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
- ⏭️ **P2 owes `clearMeasureForRebar` a decision** (`rebarOps`). Its comment is explicit that a new
  measure-level array which is NOT deleted there *survives a re-tile holding its old beat* — a mark
  pointing at music that moved, with nothing thrown. A beat-0 signature is a boundary fact and should
  ride its measure like the meter; a beat > 0 one needs capture/restore. ⛔ Do not land the writes
  without answering this; it is recorded on `Measure.keys` itself too.

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
