# TRILLS — the sign, the line, and the two notes it means

Plan, 2026-08-13. The research is in two places: §1 below (the findings that decide code, with
sources) and `docs/above-staff-ladder.md` (where a trill sits vertically, and why we are NOT
building a ladder for it).

> **Amended 2026-08-13, after reading the plan against the code.** The model, the module placement
> and the rejection of VexFlow's `Ornament`/`VibratoBracket` all survived; every amendment is at a
> SEAM the first draft did not name. The load-bearing four, each marked in place:
> **§2.1** a trill must be CAPTURED and RESTORED across a re-bar, not merely dropped (the first draft
> had it backwards, and the belt alone would delete trills on every meter change);
> **§2.3** it travels in the `Clip`, as slurs and hairpins already do;
> **§4** the y rule is `dynamicsLineBaseline` with two other constants — parameterise it, do not copy
> it — and `VexFlowRenderer.spanAnchors` needs a trill loop or the trill draws detached and vanishes
> on scroll;
> **§7** playback needs a prepass map, and a stated precedence against the fan and the tremolo.

**What we are building:** the trill — `tr` plus its wavy extension line — note-anchored, with a
derived auxiliary pitch, drawn across system breaks, selectable and deletable, and **played**.

**What we are not:** mordents, turns, pralls (his call — those are the articulation family, and only
the trill has a line); the trill sign *without* a line as a separate thing; user-chosen trill steps;
per-trill speed control; drag handles. Every one of those is additive to what is below — §9 says how.

---

## 1. The rules this is built from

Verified, with sources at the end. These are the ones that decide code:

1. **A trill is TWO things** in every format: a SIGN on a note, and a SPAN. MusicXML: `<trill-mark/>`
   + a separate `<wavy-line type="start|stop">`. LilyPond: `\trill` vs `\startTrillSpan`. MuseScore:
   `class Trill final : public SLine` carrying an `Ornament*`.
2. **Above the notes; below only when the staff has multiple voices.**
3. **Outside slurs, and further from the noteheads than articulations.**
   ⚠️ **We do not honour this yet, and that is deliberate.** The ink model holds noteheads, ledgers,
   dots, accidentals, stems and flags — *not* articulations, slurs or tuplet brackets
   (`engine/layout/measureColumns.ts`), so §4's y clears the stems honestly and is blind to an accent
   under it, exactly as the dynamics line below is blind to a staccato dot. `docs/above-staff-ladder.md`
   §"Known and accepted limitation" books this, with its fix: **a row in the ink model**, never a
   private extent computed at the draw site. Read rule 3 as the convention, not as P2's contract.
4. ⭐ **The trill sign LEFT-aligns to the LEFT edge of the notehead** — every *other* ornament centres
   on it. ⛔ Do not reuse the dynamics rule ("a level is CENTRED on its notehead"): the families
   genuinely differ.
5. ~~**A single note needs no wavy line.**~~ **On tied notes the line runs to the last tied note.**
   ⛔⛔ **OVERRULED BY HIM, 2026-08-13, with the drawing in front of him: THE LINE ALWAYS SHOWS.**
   The struck-through half is LilyPond's and Gould's, and it is what P2 first built — a bare `tr` on
   one note. His verdict on seeing it: *"that is wrong, we should always show the line."* A `tr`
   alone leaves the duration implied, and he wants it shown, on one note as much as on twenty.
   ⭐ Note the rule's own stated principle actually argues HIS way — *the line exists exactly when
   the reader must know how long to keep trilling* — and on a semibreve the reader does. The sources
   drew the line at "more than one note"; he draws it at "always", which is the same principle with
   the threshold at zero.
   ⛔ **Do not restore the flag from the sources.** `TrillSpan` carries a permanent note saying so,
   and `e2e/trill.e2e.ts`'s first test asserts the wiggle on a single note. The only thing that can
   suppress the line is having no room left after the sign, which is geometry, not a rule.
6. **At a system break the sign is repeated** on the new system, **parenthesised — `(tr)`**. A
   cross-system trill is NOT a slur in fragments: every fragment gets its own head, and the brackets
   tell the reader the ornament began earlier.
   ⭐ **His decision, 2026-08-13**, taken with the drawing in front of him: *"I like to use the
   `(tr)` convention of Sibelius, is good for the reader."*
   ⭐⭐ **RESEARCHED 2026-08-13, and the answer is worth having exactly.** `(tr)` is a real house
   style with a real citation — and it is **NOT the engraving tradition**:

   - ✅ **The precedent is *G. Schirmer's Manual of Style and Usage*** (Schirmer's own manual for its
     copyists, never publicly published): *"When a trill is tied onto another line, use parentheses:
     **(tr)**. The extension line is not necessary, unless the note is tied for additional
     measures."* So this is a 20th-century AMERICAN PUBLISHER house style. ⛔ Cite that, never
     "everyone does it".
   - ✅ **19th-century engraving does the OPPOSITE.** Beethoven Op. 111, Cotta edition
     (Bülow/Lebert, Schuberth 1892, IMSLP #02023, pp. 142–3), read at 300 dpi: the sign IS repeated,
     **plain, with no parentheses**, placed **above the first note** of the new system — and on the
     BROKEN system the wiggle runs on past the last notehead **to the right margin**, which is the
     "still going" cue. Three instances on one page.
   - ✅ **MuseScore 4 repeats NO sign at all** — only the wiggle continues
     (`TLayout::layoutTrillSegment`: begin/single get `ornamentTrill` + `wiggleTrill`, middle/end get
     `wiggleTrill` as both start and fill). No setting.
   - ✅ **LilyPond restarts a PLAIN `tr`, above the first note** ("a trill spanner crossing a line
     break will restart exactly above the first note on the new line").
   - ✅ **Dorico makes it an option, three ways**: *Engraving Options → Ornaments → Trills → "Label
     for start of new system"* → **Symbol without parentheses / Symbol in parentheses / No symbol**.
     Its parens are **UPRIGHT**, not italic. Default appears to be the plain symbol.
   - ⚠️ **SIBELIUS IS STILL UNVERIFIED — do not repeat the claim as fact.** The sentence circulating
     ("Sibelius automatically puts the letters tr in brackets…") traces to a single user post; it is
     **not in Avid's Reference Guide** (2019.1 and 2023.5 both full-text searched). What IS
     documented: every Sibelius line has an optional *continuation symbol* and the shipped example is
     parenthesised, and Avid lists paren symbols "for placing around symbols (e.g. accidentals, 8va,
     **trills**)". Likely, not established.

   ⭐ **So `(tr)` is a modern refinement, not a lineage** — and it is still his choice, now with a
   citation behind it rather than a rumour.

   ### ⭐⭐ ALL THREE ARE OFFERED — `Trill.continuationLabel` (built 2026-08-13)
   His call, on seeing the research: *"probably we give 3 options: `(tr)` default; no sign just the
   line; and `tr` like LilyPond, and the user can choose."* Since no behaviour is right and three
   real programs disagree, the choice is STORED rather than constant — a `<select>` on the selected
   trill in Properties, publishing through `bus.trillEdit` to `TrillEditController`.

   ⭐ **The DEFAULT is stored as ABSENCE**, never as the string. A score of ordinary trills carries no
   `continuationLabel` at all, so when engraving presets arrive the preset moves the DEFAULT
   score-wide (which is where Dorico puts it) and this field remains the per-trill OVERRIDE. The two
   layer; neither replaces the other.

   ### ⭐⭐ …and WHERE the resumed sign goes depends on WHICH sign it is
   His rule, and a real distinction rather than a tidy-up:
   - **`(tr)` is a REMINDER** that a trill is still running → it belongs at the system's left edge,
     exactly where an `(8)` continuation sits. That is what a bracketed label IS.
   - **a plain `tr` is THE SIGN RESTARTING** → it belongs on its note, which is what both independent
     sources do (LilyPond: "restart exactly above the first note on the new line"; the Cotta plates:
     hard against the first notehead). Under `'plain'` the stretch from margin to note draws nothing.

   ⚠️ **Measured limit, not assumed:** the system's left content edge and the first notehead sit
   within about a bracket's width of each other when a bar opens with its note right after the clef,
   so in the common case the two positions nearly coincide. The rule separates them only when the
   first note is NOT hard against the margin (a bar opening with a rest, a key signature, a pickup).
   `e2e/trill.e2e.ts` says so rather than implying a bigger difference.
7. **The auxiliary is the diatonic step above**, resolved against the key signature and the
   accidentals earlier in the bar. It is *semantic*: it changes playback.
8. **Numbers to start from** (LilyPond's `TrillSpanner`, the way we took `DynamicLineSpanner`'s
   0.6/1.2 for the dynamics line): `padding` **0.5 sp**, `staff-padding` **1.0 sp**, direction up.
9. **Glyphs**: sign `ornamentTrill` **U+E566**; line = repeated `wiggleTrill` **U+EAA4**.
   ⚠️ VexFlow's `Vibrato` defaults to U+EAB0, the *vibrato* wiggle — the wrong glyph, and one of five
   reasons `VibratoBracket` is rejected (§4).

---

## 2. The model — one object, anchored to a note

> *"There is no trill without a note"* — his call, and it is MusicXML's and LilyPond's anchoring too.

`Score.trills?: Trill[]`, top-level beside `slurs` and for the same reason: it crosses barlines and
systems freely.

```ts
interface Trill {
  id: string
  /** The note the sign sits on (a NotePitch id, as selection uses). */
  startNoteId: string
  /** The last trilled note. ABSENT = the start note's own sounding duration, through ties. */
  endNoteId?: string
  /** Voice; both anchors share it. Default 0. (Slur's field, same meaning.) */
  voice?: 0 | 1 | 2 | 3
  /** Vertical side; default 'above'. 'below' is the multi-voice case (rule 2). */
  placement?: 'above' | 'below'
  /** How a CONTINUATION system labels it. ABSENT = '(tr)'. See rule 6. */
  continuationLabel?: 'parenthesised' | 'plain' | 'none'
}
```

⭐ **Absent `endNoteId` is what makes the tied case free**: a trill on one note is the same object as
a trill over five bars, and how far it reaches is answered by the span, not by a flag.

⚠️ It no longer answers "does it get a line?" — since 2026-08-13 the line always draws (rule 5), so
`TrillSpan` has no `hasLine` and a field that would always be true was removed rather than kept.

⛔ **Nothing else.** No length in beats (that is the hairpin's answer to a problem trills do not
have — a trill's ends are notes), no interval (§3), no y, no angle, no wiggle count, no stored break
point (`Hairpin`'s rule, verbatim).

**Ops:** `engine/models/trillOps.ts` — `addTrill` / `removeTrill` / `measureTrills` / `trillSpan`, in
the `hairpinOps` / `slurOps` idiom, with `ScoreModel` keeping thin delegators. ⛔ Not on
`MusicEngine` (DESIGN-PRINCIPLES §5).

### 2.1 ⭐⭐ Re-bar: a trill is CAPTURED and RESTORED, not dropped

⚠️ **"It dangles exactly as a slur does" is false, and believing it would delete the feature in
use.** A slur does not merely dangle: `rebarOps` snapshots every slur with an endpoint inside the
region *before* the ids are re-minted (`captureSlurs`, `rebarOps.ts:1110`) and re-finds each anchor
afterwards by **(absolute onset offset + exact pitch + voice)** (`restoreSlurs`, `:1156`).
`repairDanglingSlurs` is only the **defensive belt** behind that — its own doc comment says so.

A trill is note-anchored on exactly the slur's terms, so it needs exactly the slur's treatment:

- **`captureTrills` / `restoreTrills`**, beside the slur pair and reusing `CapturedSlurEnd`'s key
  shape (one end may be absent — a trill's `endNoteId` is optional, and an end *outside* the region
  keeps its id, which is what `externalId` already means).
- **`dropDanglingTrills`** stays, as the belt — and it joins `repairDanglingSlurs` at **all four**
  places, not one: `ScoreModel.ts:387` (`removeMeasure`), `rebarOps.ts:257` (`rebarRegion`),
  `rebarOps.ts:440` (`pasteEvents`), plus a row in the `RebarDeps` interface (`rebarOps.ts:57`).

⛔ **Belt only is not an option.** Without capture/restore, every meter change and every paste
silently deletes every trill in the region — worse than a slur, and worse than a hairpin, which
survives a re-bar because it is positional (`Hairpin`'s doc comment, `types/music.ts`). The hairpin's
argument against note identity is real; the answer to it is the slur's machinery, not a shrug.

**Voice, after a move.** `voiceOps.resyncSlurVoiceForPitch` (`voiceOps.ts:235`) keeps a slur's stored
`voice` in step when Alt+1/2 moves an anchor. `Trill.voice` is the same field with the same meaning
and goes stale the same way — so that function generalises to "the spans anchored on this pitch", or
gains a twin.

**A single deleted note** leaves a dangling trill exactly as it leaves a dangling slur (nothing
sweeps `deleteNote`). The renderer and `trillAttacks` both resolve-or-skip, which is what
`SlurRenderer` already does; that is the accepted behaviour, not an oversight to fix here.

### 2.2 ⭐ Can a trill anchor to a FANNED MEMBER? — decide, don't look it up

The two comments in the code disagree, so this is a real decision. `ScoreModel.isFanMember`'s doc
names the commands that must **refuse** a member — *"a tie, a slur, an articulation, a duration
change: they attach to the SLOT — the whole gesture — and a member is not one"* — while
`repairDanglingSlurs` includes members precisely so a slur *can* span them (*"member 2 → member 5 is
a span"*).

**Our answer: refuse.** A trill is a sign ON one note plus a duration, i.e. the articulation family's
attachment, not the slur's span-between-two-points. `addTrill` calls `isFanMember` and returns null,
so the stamp's near-miss consumes the click and nothing half-writes. ⏭️ If his ear later wants a
trilled member, it is the same additive change the fan plan made for slurs.

### 2.3 The clipboard — a trill travels with its passage

`utils/clip.ts` already carries `ClipSlur` **and** `ClipHairpin`, and its own comment states why
(DESIGN-PRINCIPLES §2): copying four bars and pasting them *without* their hairpins would be "a
feature operating on part of the music". A trill is no different, so **`ClipTrill` joins them** —
the `ClipSlur` shape (relative staff + voice + onset offset + pitch at each end), **fully enclosed
only**, matching the rule dynamics, slurs and hairpins already share. Restored by the
`restoreClipSlurs` twin at `rebarOps.ts:443`.

⛔ The alternative — "copy/paste drops trills for now" — is not free and is not silent: it is a
principle §2 violation, and it would have to be written into §9 as a known hole rather than left
unsaid.

---

## 3. The auxiliary pitch — derived, through key-signature machinery

His call: build it as if key signatures existed, and let "no key" mean C major.

- **`utils/keySignature.ts`** (new): `keyAt(score, measureNumber, staffId)` → the key in force,
  resolved **positionally** and bottoming out in the constant `C major` — the shape `types/music.ts`
  already wrote down for `Measure.keys?: KeyChange[]` (DESIGN-PRINCIPLES §6). Today it has one
  branch; the day key signatures land it grows a lookup and nothing else changes.
- **`utils/trillPitch.ts`** (new): `trillAuxiliary(main, key, barAccidentals)` → the spelling a step
  above, and **whether an accidental is printed** — printed when the auxiliary's alter differs from
  what the key alone would give. So in C major an F♯ earlier in the bar makes a trill on E print a
  ♯ above the `tr`, which is real, testable, and reachable in v1 with no key signatures at all.
- **Stored: nothing.** The trill carries no interval. When the user gets to choose the step, that is
  an optional override on `Trill`, added then.

---

## 4. Drawing it — `engine/rendering/TrillRenderer.ts`

A score-level pass after the measures, exactly like `SlurRenderer` and `HairpinRenderer`, and for
the same reason: it spans bars, so it cannot live in one bar's group.

**⛔ Not VexFlow's `Ornament` for the sign, and not `VibratoBracket` for the line.**
`Ornament` positions from *the note's own top* — the exact defect the dynamics line exists to fix —
and a note modifier cannot produce a repeated head on each system. `VibratoBracket`: wrong glyph
(U+EAB0), y from `stave.getYForTopText()` (a fixed rung that knows nothing), both ends on ONE stave
(no system break), a length quantised to whole glyph repeats, and `setVibratoWidth` **throws** when
the glyph measures 0 — which is what jsdom does. What we would inherit is one `renderText`.

So we draw both, with `Element` + written-out SMuFL codepoints — the `TempoLayout` idiom (`Glyphs`
is CJS-only and resolves to `undefined` in the browser).

- **x**: sign at the **left edge of the start notehead** (rule 4). Line starts after the sign + a
  small gap, ends at the end of the last trilled note's sounding span (the next column's x, or the
  bar end) — the same "read to the slot's END" the hairpin uses.
- **The wiggle**: repeat the glyph `N = round(span / unit)` times and distribute the ≤ half-unit
  remainder into the spacing BETWEEN repeats, so the glyphs stay unscaled and the line ends exactly
  where it should. (Repeating without that is what makes VexFlow's vibrato overshoot.)
- **System breaks**: fragments from `planSlurSegments` — already ours, already used by
  `HairpinRenderer`, already handles the staff `scale(k)` conversion. **Each fragment draws its own
  sign** (rule 6). Plain, not parenthesised: LilyPond's default; Sibelius's `(tr)` is a one-constant
  change if his eye prefers it.
- **y**: clear the ink band over the trill's own columns by `0.5`, floor at `1.0` from the staff,
  mirrored for `below`. ⚠️ **This is not a baseline** — the trill is not read as a row, so it clears
  its own span and nothing else. See `docs/above-staff-ladder.md` for why that is the whole vertical
  story here.

  ⛔ **NOT a new copy of the arithmetic.** `dynamicsLineBaseline` (`layout/dynamicsLine.ts:177`)
  *already is* that rule — clear the band by `PADDING`, floor at `MIN_FROM_STAFF`, mirrored for
  `above`, which it already takes as a parameter. Only the two CONSTANTS differ (0.6/1.2 against our
  0.5/1.0). A `trillPlacement.ts` holding the same six lines with two other numbers would be a second
  answer to *how far from the staff*, which is the exact thing the dynamics-line plan exists to
  prevent — and no lint can see it, because a duplicated rule imports nothing.

  So: **`engine/layout/inkBand.ts`** (new) takes `staffInkBand` / `columnsUnder` / `columnsBetween` /
  `mergeInkBands` **and the baseline function**, which grows a `{ padding, minFromStaff }` argument.
  `DYNAMICS_LINE` and a new `TRILL_LINE` are its two callers, and the numbers stay where a number
  belongs — in a named constant beside the family that owns it. ⭐ A spec moves with its module:
  `dynamicsLine.test.ts` splits in the same commit.

  ⚠️ **Where the trill's own ink comes from.** The baseline needs `DynamicMarkInk` — how far the
  mark's glyph reaches from its baseline — and that is a FONT measurement the layout module may not
  compute (a glyph measures 0×0 in jsdom, `reference_jsdom_cannot_measure_glyphs`; the dynamics get
  theirs handed in from `rendering/dynamicStyle.ts`). The `tr` needs the same: a proportion of the
  glyph size, stated in the rendering layer, passed in — never measured in `inkBand.ts`.
- **Registration**: each fragment registers a polyline in `ElementRegistry` under `'trill'` with the
  same `points` shape the hairpin uses, and each carries the same trill id.
- ⚠️⚠️ **`VexFlowRenderer.spanAnchors` gets a trill loop** — and getting this wrong is silent.
  A span's far bar is the one question `MEASURE_RENDER_ROLE` cannot ask, so ties (`:1540`), slurs
  (`:1556`), hairpins (`:1568`) and cross-bar beams each pin their bars there. The hairpin's comment
  names both failures: the endpoint bar is **translated** rather than re-engraved, so the span
  renderer reads `StaveNote`s still holding last render's coordinates and the trill draws detached
  from its notes; and under culling that bar's `<g>` is deleted outright, so the trill **vanishes on
  scroll**. A trill names its ends by note id, so it is the slur's two-line form —
  `add(homeOfPitch.get(t.startNoteId), homeOfPitch.get(t.endNoteId ?? t.startNoteId))` — and the
  `measures.add` on each resolvable end protects a half-resolvable trill the same way.

---

## 5. Selecting and deleting

- `interactions/elements/trill.ts` — hit-test against the drawn outline with the hairpin's pad
  (a wavy line's bbox is a wide flat band; selecting inside it would steal presses from the music).
- Row in `ELEMENT_SPECS` (15 → 16) and a position in `ELEMENT_HIT_ORDER` (13 → 14), beside the
  hairpin; `{ kind: 'trill'; id: string }` joins `SelectedElement`.
- Delete in `shortcutWiring`'s switch; a row in `selectionSnapshot` for the Properties window;
  a highlight in `HighlightController` (paint, don't recolour).
- ⭐ **`x` flips `placement`**, joining the branch that already flips a hairpin's type and a
  selected slur's / tie's / tuplet's / articulation's side. Without it `Trill.placement` is a field
  with no way to set it — a dead field, and rule 2's `below` unreachable.

---

### ⭐ The attachment guide (2026-08-17, his call)

A selected trill draws the dashed line to the note it ornaments — the third kind to use the
kind-agnostic guide (`docs/dynamic-offset-plan.md`), and two edits: `drawTrill` captures the
endpoints onto the fragment's registry entry, and the `trill` row in `ELEMENT_SPECS` calls
`applyAnchorGuideLine`.

⭐⭐ **Its anchor is the NOTE, not a place in time** — the distinction kind 2 (tempo) opened, and the
trill lands on the dynamic's side of it for a reason particular to this ornament: the auxiliary is a
step above THAT pitch (§3), so the note is what the trill is computed from. The point is the notehead
facing the sign (topmost for an above-staff trill), at the span's own start x — the notehead's left
edge §1 rule 4 already aligns the sign to, so the guide and the sign cannot disagree about where the
trill begins.

⚠️ **First fragment only**: a split trill registers one entry per system under one id and `getById`
answers with the first, which is the one holding the start note. A continuation `(tr)` is a reminder,
not a second attachment. Measured in `e2e/anchorGuide.e2e.ts`.

---

## 6. Entering one

Mirrors the hairpin exactly, so there is nothing new to learn and nothing new to write — **minus
its key**:

- ⛔ **NO KEYBOARD SHORTCUT — his call, 2026-08-13.** The first draft proposed `Shift+T`; that was
  never Sibelius's (Sibelius has no default trill key at all — its trill line lives in the Notations
  ▸ Lines gallery, which `L` opens), only a free letter picked to sit beside `s` and `h`. A key
  invented for us is not muscle memory, it is a key to remember, and the trill is not frequent
  enough to earn one. The palette row below is the whole of the trill's entry surface.
  ⏭️ If one is ever wanted, `l` is free in `ShortcutConfig.ts` and is the Sibelius-shaped choice.
- **The palette row is the command.** With notes selected, `createTrill(noteIds)` spans them (the
  `createHairpin` / `createSlur` resolution: one voice, one staff, from the anchor note). With
  nothing selected it ARMS the trill stamp — `{ kind: 'trill' }` joins the `MarkingTool` union with
  `false` in `MARKING_TOOL_USES_ARMED_LENGTH` (a trill's length comes from its notes, never from the
  keypad). ⭐ Both behaviours are the row's, not a key's, and that is the slur row's own arrangement
  already (`isEnabled: () => true` — "the press always means something: apply, or arm").
- **`interactions/trillStamp.ts`** — one click on a note trills that note (the `slurStamp` shape: a
  hit-test, idempotent, ADD-only, a near-miss is consumed).
- ⭐⭐ **THE ARMED STAMP DRAWS A `tr` AT THE POINTER — amended 2026-08-17, his call**, and the wrong
  version stays here so it cannot come back. This plan said the trill previews NOTHING (the blue
  place-cursor, like the slur and the hairpin), on the argument that a trill is drawn ABOVE the music
  at a height taken from the ink of notes the click has not picked — so a `tr` at the pointer would
  preview a position nothing had decided. His answer: *"we really want to see a tr ghost; this is
  much better."*
  ⭐ **The argument was about the wrong question.** WHERE the mark lands is the renderer's answer
  after the click; what a cursor has to say is WHAT the click makes — the licence the accidental, dot
  and tie ghosts already take. `engine/rendering/TrillGhost.ts` (its own module + a `GHOST_DRAWERS`
  row) draws the sign through the pass's own `drawTrillSign`, so preview and engraved mark cannot
  drift; plain, never `(tr)`, since the brackets are a fact about a trill on an EARLIER system.
  ⚠️ And the tool LEAVES `scoreCursorClass`'s blue-pointer list in the same edit: that list is exactly
  `toolGhost`'s `null` cases, and a caret on top of the glyph it stood in for is two indicators for
  one tool. The ottava and the pedal followed the same day; see `docs/ottava-plan.md` P5 and
  `docs/pedal-plan.md` §7 for the position rule the three now share.
- A row in `dev/linePalette.ts` — ⚠️ **and an edit to its header, which does not name the trill.**
  That file calls the Lines family *"spanners drawn BETWEEN notes rather than on one: the slur today,
  and (when they exist) the hairpin, the octave line, the glissando, the pedal line"* — a sentence
  the trill contradicts, since its sign sits on ONE note and the line is an optional extension. The
  trill belongs in the palette (it is where Dorico and Sibelius file it), so the header widens to say
  "on one note or between two", with the trill named. ⛔ Leaving a doc comment that the row beneath
  it disproves is the rot `reference_repo_fact_comments_need_a_check` is about.

---

## 7. Playback — now, per his call

`engine/audio/trillAttacks.ts` (new, pure): main note + sounding span + rate → the alternating
attacks. Called from `collectScheduledNotes` beside the tremolo branch, which is the precedent this
follows in every respect — but ⚠️ **a branch alone will not do**:

- **A PREPASS, then the branch.** The tremolo branch reads `chord.tremolo` off the slot already in
  hand; a trill lives in `score.trills`, so the same shape would rescan a list at every slot. The
  collector takes the whole `Score`, so it builds `Map<slotId, Trill>` **once** at the top from
  `trillSpan` — the walk `spanAnchors` does for the same reason, at the other end of the render.
- ⭐ **Precedence, stated.** A fan and a tremolo are mutually exclusive *in the model*
  (`ScoreModel.setFan` clears the tremolo and vice versa) and the collector's order between them is
  a decision it writes down. A trill is a THIRD, and it is not excluded by either: **a note carrying
  a fan or a tremolo does not also trill** — the re-attack pattern is already spoken for, and two
  patterns over one sounding span is not a sound, it is a mess. `trillAttacks` is skipped and the
  existing branch wins, checked where the fan/tremolo order is already decided.

- **The rate is a PHYSICAL speed in seconds, not a note value** — a trill is not measured, the same
  reasoning as `UNMEASURED_PERIOD_SECONDS`. Starting number **0.08 s** (~12 notes/sec), by ear.
- **Starts on the main note** (the modern default; MuseScore's "Baroque" option is the other one) and
  alternates with the auxiliary from §3.
- **Fills what SOUNDS**, through ties — the tremolo's rule, so a trill across tied notes keeps going.
- Velocity and articulation length factors come from the note, unchanged.

---

## 8. Tests

- **Unit**: `trillOps` (add/remove/dangling, and the fan-member refusal of §2.2), `keySignature`
  (C major constant + positional shape), `trillPitch` (auxiliary + when the accidental prints),
  `inkBand` (the parameterised baseline, both constant sets), `trillAttacks` (count, alternation,
  tie fill), `chain.test.ts` (the two tables stay in step).
- ⭐ **The re-bar tests are the ones that matter**, because §2.1 is the amendment most easily lost:
  `rebarOps.spans.test.ts` gains a trill beside its slur cases — **a trill survives a meter change**,
  a trill survives a paste, a trill whose anchor genuinely left is dropped. A test that only asserts
  "dropped" would pass against the wrong implementation.
- **Clipboard**: a copied passage carries its fully-enclosed trills and drops the half-covered one
  (`clipboard.test.ts`'s existing slur/hairpin cases, one row wider).
- **e2e geometry** (`e2e/trill.e2e.ts`) — everything about where ink landed, because jsdom measures
  every glyph as 0×0: sign left-aligned to the notehead, line reaching the span's end, clearance
  above stems and flags, one sign per system fragment.

---

## 9. What this leaves open, and how each lands additively

| later | where it goes |
|---|---|
| contemporary sharp / flat / natural / ½ / whole-tone trill signs | ⭐ mostly §3 already — it IS the interval, printed as an accidental. A genuinely different SIGN is one row in the glyph table + an optional `sign?` on `Trill`, undefined = the ordinary trill (MuseScore's `TrillType`). |
| user chooses the step | an optional interval override on `Trill`; the resolver in §3 already returns what it would replace |
| per-trill speed | an optional field, read by `trillAttacks` where the constant is now |
| ~~lengthen / shorten by dragging the end~~ | ✅ **BUILT 2026-08-18** — the two endpoint squares, `Ctrl+Shift+←/→` and the drag. See §11. |
| ~~the trill sign with no line as its own thing~~ | ✅ **BUILT 2026-08-18, and NOT as a separate mark** — the framing here said the articulation family; what he asked for was one step further left on the END square, which makes it a state of THIS object (`Trill.extension`). See §11. |
| mordents, turns, pralls | the articulation family; VexFlow's `Ornament` table already has 13 glyphs |
| ~~the plain repeated `tr`, or no sign, on continuations~~ | ✅ **BUILT 2026-08-13** — all three are offered as `Trill.continuationLabel`, chosen per trill in Properties. See rule 6. ⏭️ What remains is the score-wide DEFAULT, which is an engraving-preset row, not a trill one. |
| the above-staff ladder | `docs/above-staff-ladder.md` §4 — its trigger is 8va or technique text, not this |

---

## 10. Phases

- **P0 — model. ✅ BUILT 2026-08-13.** `Trill`, `Score.trills`, `trillOps` (with §2.2's refusal),
  `ScoreModel` + four `MusicEngine` delegators, `captureTrills`/`restoreTrills` +
  `repairDanglingTrills` at all four sites (§2.1), `resyncTrillVoiceForPitch`, and `ClipTrill`
  (§2.3). *Done when*: a trill round-trips through JSON, **survives a meter change and a
  copy/paste**, and is dropped only when its anchor is genuinely gone. — 17 specs in
  `trillOps.test.ts`, 4 in `rebarOps.spans.test.ts`, 4 in `clipboard.test.ts`, 1 in
  `voiceOps.test.ts`; the re-bar four were break-tested (disable `restoreTrills` → 3 fail).

  ⭐ **Two rules the build settled, beyond what §2 wrote down.** A dangling **END degrades** to the
  one-note trill rather than dropping the object — the sign's own note is still there, so the mark
  is still true, and `endNoteId` being optional is exactly the state to fall back to. And
  `MusicEngine.addTrill`/`removeTrill` use **`commit`, not the slur's `saveOnly`**: a trill changes
  what PLAYS (§7), so playback is resynced.
- **P1 — the pitch. ✅ BUILT 2026-08-13.** `utils/keySignature.ts` (`KeySignature` as `fifths`,
  `keyAlterOf`, `keyAt` → `C_MAJOR`), `utils/trillPitch.ts` (`trillAuxiliary`), and
  `trillOps.trillAuxiliaryOf` as the score-level address, delegated through `ScoreModel` and
  `MusicEngine`. *Done when*: a trill on E in a bar with F♯ reports F♯ and "print the accidental". —
  14 specs across the two utils, 6 more in `trillOps.test.ts`.

  ⭐ **The two questions came apart, and the split is the whole of §3.** What SOUNDS follows the
  bar's running accidental (`prevailingAlterations` over `measureAccidentalNotes` — the whole bar,
  every voice, fanned members included, the same list `getPrevailingAlter` feeds); what is PRINTED
  is only what the KEY does not already say. They differ in exactly one case — an accidental earlier
  in the bar — and that case is the reason a trill needs a printed sign at all.

  ⚠️ `keyAt`'s parameters are underscore-prefixed: the ADDRESS is real and the call sites are
  already positional, but nothing is read yet. ⛔ `Measure.keys` was **not** added — a field with no
  feature is a field nothing maintains; the trigger is the key-signature feature itself.
- **P2 — drawing. ✅ BUILT 2026-08-13.** `engine/layout/inkBand.ts` (readers **and** the
  parameterised `clearanceBaseline`, §4), `rendering/trillStyle.ts`, `rendering/TrillRenderer.ts`,
  the `'trill'` registry type + `trillGroupMap`, and the `spanAnchors` loop. *Done when*: `tr` +
  wiggle draw over a span, clear the stems, repeat the sign on each system. — 7 specs in
  `e2e/trill.e2e.ts`; the whole browser suite (115) re-run because the extraction touched the
  dynamics line's own arithmetic.

  ⚠️⚠️ **A BUG HE CAUGHT, 2026-08-13 — worth keeping because of HOW it hid.** A trill on a note at
  the end of a system, tied over the break, drew **nothing at all**. Cause: a guard I added to
  `spanX`, `if (endX <= startX) return null`, which `HairpinRenderer.spanX` deliberately does not
  have. Across a system break the two x's are in DIFFERENT systems' coordinates — a span starting
  late on one row and ending early on the next legitimately has `endX < startX` — so the guard threw
  away exactly the case the cross-system machinery exists for. The end-inset clamp had the same
  wrong assumption and is now same-system only.

  ⭐⭐ **And the cross-system e2e test PASSED throughout.** It spanned bars 1→24, where the end lands
  at the LAST system's right margin — numerically greater than bar 1's left edge, so the guard never
  fired. A cross-system test only proves something if the span **starts late on one system and ends
  early on the next**; the regression test now finds the break at runtime and builds exactly that,
  and was break-tested against the restored guard.

  ⭐ **The extraction paid for itself immediately.** `dynamicsLineBaseline` is now three lines
  delegating to `clearanceBaseline(band, side, ink, DYNAMICS_LINE)`, and the trill passes
  `TRILL_LINE` — so the LADDER (docs/above-staff-ladder.md §3: LilyPond's `TrillSpanner` 50 against
  `DynamicLineSpanner` 250) is **exactly those two constant pairs**, with no priority table anywhere.
  `inkBand.test.ts` pins that ordering as a property of the numbers, and the browser suite pins it
  as drawn ink.

  ⚠️ **Two numbers now waiting on his eye**, and they are not the same kind of number. The dynamics'
  2.1 floor is DERIVED (one cleared stem: 1.5 + 0.6), because that family is read as a row and its
  marks must agree with each other. The trill's 1.0 is a TASTE value — a trill is read individually
  at its note, so nothing has to line up and the floor is only a minimum. Same for the sign's ink
  proportions (0.62/0.04 of the glyph), which are a first cut, not a measurement.
- **P3 — editing. ✅ BUILT 2026-08-13.** `interactions/elements/trill.ts` + rows in `ELEMENT_SPECS`
  (16) and `ELEMENT_HIT_ORDER` (14), `{ kind: 'trill'; id }` in `SelectedElement`,
  `applyTrillSelectionHighlight`, the Delete case, the Properties row, and `x` flipping `placement`.
  — 6 specs in `elements/trill.test.ts`, the two pinned tables updated in `chain.test.ts`.

  ⭐ **The union's totality guarantee worked exactly as advertised**: adding the member broke the
  build at three sites (the specs table, the Properties report, the Delete switch) and named each
  one. Nothing had to be searched for.

  ⚠️ **Two places where the trill is NOT the hairpin, and both fail silently if copied:**
  the highlight recolours **`fill` on `<text>`**, not `stroke` on `<path>` — a trill is drawn as
  glyphs, so the hairpin's stroke recolour would simply not show. And the hit-test tests
  **containment first**, proximity second: a wedge is two thin arms, but a trill is a solid run of
  glyphs, so `distToSegment` alone would leave the middle of a tall band cold.

  ⭐ **A third, added 2026-08-19: its COLOUR.** The trill is the one mark in this family that keeps a
  VOICE colour — his reason, *"a trill is always associated to a note, so the trill has the color of
  the note voice it is anchored to"* (its auxiliary is a step above THAT pitch). ⚠️ Read off the
  start NOTE, not `Trill.voice`: the slur's rule, because the field is written at creation and a
  later voice move does not chase it. The hairpin, the 8va and the pedal take the ELEMENT ink
  instead — each governs a region rather than belonging to one voice's notes
  (`utils/selectionColors`).

  ⭐ `InspectedElement` gained a **`derived`** slot for the Properties panel, for the same reason it
  keeps `overrides` separate from `data`: the trill's auxiliary is computed, not stored, so folding
  it into `data` would show a shape the model does not have — and "what does this trill play?" is
  the one question a reader of that panel will have.
- **P4 — entry. ✅ BUILT 2026-08-13.** `MusicEngine.createTrill`, `{ kind: 'trill' }` in the
  `MarkingTool` union (+ `MARKING_TOOL_USES_ARMED_LENGTH`, `toolGhost`, `scoreCursorClass`,
  `promoteStampToNoteEntry`), `interactions/trillStamp.ts` wired into `MouseController`'s dispatch,
  `PaletteController.createTrill`, and the Lines palette row + its corrected header. ⛔ No shortcut.
  — 8 specs in `trillStamp.test.ts`.

  ⭐ **`createTrill([oneNote])` makes a COMPLETE trill with no end anchor**, where `createSlur` has
  to reach forward to the next slot because an arc needs two ends. So a stamped trill never invents
  a span, and the last note of the score can carry one where a slur stamp makes nothing.

  ⭐ **The palette row carries BOTH behaviours** (trill the selection / arm the stamp) because it is
  the trill's only door — there is no key. The Lines palette's own header had to widen too: it
  described a family "drawn BETWEEN notes rather than on one", which the trill disproves.
- **P6 — the continuation label. ✅ BUILT 2026-08-13** (unplanned; it came out of the research).
  `Trill.continuationLabel`, `trillOps.setTrillContinuationLabel`, `bus/trillEditSelection.ts`,
  `interactions/TrillEditController.ts`, and a `<select>` row in `PropertiesWidget`. The renderer
  honours both the label AND its position rule (rule 6). — 2 model specs, 3 browser specs.
  ⭐ A bus seam + a controller + one widget row: no per-kind slice anywhere, and the widget stays a
  dumb publisher that cannot reach the engine.
- **P5 — playback. ✅ BUILT 2026-08-13.** `engine/audio/trillAttacks.ts` (pure), the
  `trilledSlotIds` prepass, `auxiliaryMidiFor`, and the branch in `collectScheduledNotes`. — 9 specs
  in `trillAttacks.test.ts`, 15 in `playbackSchedule.trill.test.ts`.

  ⭐ **The precedence is REACHABILITY, not a condition.** The trill branch sits AFTER the tremolo's,
  which `continue`s, and after the fan's, which branches on the slot even earlier — so a note
  carrying either never reaches the trill. Nothing tests "does this note also have a tremolo", which
  means there is no third rule to keep in step when a fourth re-attack pattern arrives.

  ⭐ **The auxiliary is computed PER PITCH, not once per trill.** A trill covering four different
  notes trills each with its own upper neighbour — the interval is a consequence of where the note
  sits in the scale. `trillOps.trillAuxiliaryOf` answers for the START note and is the renderer's
  and Properties'; playback needs the per-pitch one.

  ⭐ The rate is PHYSICAL (`TRILL_PERIOD_SECONDS` 0.08, ~12 notes/sec, **by ear**) — a trill on a
  semibreve and one on a quaver run at the same speed and differ only in length. Converting seconds
  → beats at the onset is now `physicalPeriodBeats`, **shared with the unmeasured tremolo**, whose
  three identical lines were collapsed into it.

  ⚠️ **A chord trills WHOLE.** Every non-continuation pitch of a covered slot alternates. Engraving
  convention usually means the top note alone, and `Trill` does carry the pitch it was anchored to —
  so narrowing it later is a FILTER in `auxiliaryMidiFor`'s caller, not a model change. Stated
  because it is what the code does, not because it is settled.

---

## 11. The two endpoint squares, and everything they edit — BUILT 2026-08-18

The fifth span to get the family's pair, after the slur, the hairpin, the ottava and the pedal.
Commits `6cd183d` · `97604e5` · `a97a5d6` · `b44567f` (+ the Properties rows).

| gesture | needs | changes | where |
|---|---|---|---|
| click a square, `Tab` / `Shift+Tab` | — | arms that end | `selectedElement.endpoint` |
| `Ctrl+Shift+←/→` | a square armed | which notes are TRILLED (audible) | `setTrillStart` / `setTrillEnd` |
| drag a square | — | the same two writes | `trillDragTargetAt` → `previewTrillAnchor` |
| plain / `Ctrl` arrow, `Ctrl+Backspace` | a square armed | that end's INK | `TrillOffsetOverride` |
| plain / `Ctrl` arrow, `Ctrl+Backspace` | NOTHING armed | the whole ornament's ink | both ends, one delta |
| Properties: `start x` / `end x` / `vertical` | a trill selected | the same three numbers, typed | `bus.trillGeometry` |
| `Ctrl+Shift+←` once past the collapse | the END square | **the bare `tr`, no line** | `Trill.extension` |

### ⭐⭐ THE TRILL IS THE SLUR'S FAMILY, NOT THE PEDAL'S

Its anchors are NOTES, where a hairpin's, an ottava's and a pedal's are positions in TIME. So the
chord that steps those three by a SLOT steps this one by a NOTE (`interactions/trillReanchor.ts`,
`slurReanchor`'s twin), and the drag answers with a note id rather than an address.

### ⭐⭐ …and it has a state none of the other four has: NO END AT ALL

An absent `endNoteId` means *the start note's own sounding duration, through ties* — a finished
ornament. That gives the END square two edges: stepping back onto the start CLEARS it, and stepping
forward from a trill with no end starts from where the LINE stops (`trillSpan`), not from the start
note. 🚨 The second needs a **TIED fixture** to prove: without ties the tie chain's end IS the start
note, and the whole lookup deletes green.

### 🚨 Reaching an end is not passing it

His report: *"i can move the first point (tr) to the left but not to the right"* — on a trill whose
end was the very NEXT note, so every rightward step reached it and the clamp (`>=`) refused. The
start now COLLAPSES the trill onto that note, which is `addTrill`'s own normalisation (*an end equal
to the start is spelled by omitting it*) arriving by a move instead of an add. ⭐ That makes the two
squares mirror each other. ⚠️ Delete the end BEFORE writing the start, or `precedes` refuses.

### ⭐⭐ One step past the collapse is the bare `tr`

His ask: *"there are cases where the user wants `tr` without the line."* It fills a step that was
DEAD — a test asserted the decline. Leftward: end on a later note → … → end on the START (clears) →
**no line**; `→` restores it on the same note. The drag reaches it by dragging the end LEFT PAST the
start, judged by index in the lane, ⛔ not by raw x.

⛔⛔ `extension: 'none'` and an `endNoteId` CONTRADICT: the line is the only thing that says how long
to keep trilling, so turning it off CLEARS the end and setting an end RESTORES the line.

⚠️⚠️ **This is the ONE place `Ctrl+Shift+arrow` writes something COSMETIC.** The chord otherwise
means *move this end through the music*; a plain arrow means *move the ink*. Defensible only because
at that end of the walk the trill covers one note and there is no musical extent left to change.
⛔ Do not generalise it to the other four spans.

### ⭐⭐ The offsets: `outward`, and the rule that settles the family

`TrillOffsetOverride` = `startX` + `endX` + ONE **`outward`**.

> **Store `outward` iff the mark can CHANGE SIDES.** Trill and ottava flip (`x`) ⇒ `outward`, a
> distance from the staff, so a flip cannot invert a nudge the user already made. A pedal never
> flips ⇒ a screen `y`, because `outward` there would be a distinction with no observable
> difference.

⭐ ONE vertical (the sign and the wiggle share a baseline) ⇒ `setTrillOffset` passes **0** on its
second call, or the ornament takes a double step. ⛔⛔ Both x nudges land AFTER every automatic
decision — the `barLeft` clamp and the `TRILL_END_INSET` arithmetic — the bracket's *"i cannot offset
the right side from a limit"* scar.

🚨 **His bug, mid-build: *"the left endpoint does not move with the offset."*** The registry entry was
built from `piece.x0` — the fragment's SPAN start — at BOTH ends, so a `startX` nudge moved the drawn
`tr` and left its hit-box, and the square hanging off it, behind. The END moved all along (`lineEnd`
carries its own nudge), so **exactly one of the two looked broken**, and a test checking only "the box
moved" would have passed. ⭐ **The registry describes the INK**: the box begins where the SIGN is
drawn. That also fixed a pre-existing lie — a continuation `(tr)`'s box never covered the inset it is
drawn back by.

### ⚠️ Every above-staff case passes with the conversion deleted

The `outward`→screen conversion is the IDENTITY for an `above` trill, and almost every trill is one.
The `below` cases — one in `e2e/trill.e2e.ts`, one in `PropertiesWidget.trill.test.ts` — are the only
ones that bite, exactly as the ottava's 8vb did.

### ⏭️ Left open

- The trill/slur COLLISION — its own plan, `docs/trill-slur-clearance-plan.md`.
- A `shortcutWiring.trillOffset` ROUTING spec (the pedal has one; the model, the panel and the
  drawing are all covered).
- ⚠️ The squares ride the registered band's MIDDLE, and that band is lopsided (the `tr`'s ink runs
  1.6 sp up and 0.1 down), so they sit ~0.75 sp above the wiggle's own line. **His eye not yet on
  it**; if it reads high the fix is a measured axis field, the ottava's `ottavaAxis` case.

---

## 12. The keyboard endpoint WALK — BUILT 2026-08-20

His ask: *"lets do now the keyboard endpoint trill walk"*. ←/→ and `Ctrl`+←/→ on an armed square move
that end's **INK**, and once that ink reaches the next note of the lane the **ANCHOR** goes with it.
The trill is the fourth family to get the gesture, after the slur, the dynamic/tempo pair and the
hairpin, and it arrives by the rule the wedge's second square set on 2026-08-20: **a handle that has
BOTH a re-anchor and an offset owes the walk that joins them.**

Modules: `interactions/trillWalk.ts` (the PORT, twice) + `interactions/trillLane.ts` (where each
square would be drawn, per candidate anchor) + `MusicEngine.rebaseTrillEndpointOffset`. The
arithmetic is `interactions/markWalk.ts`'s, **untouched** — `trillOps.trillEndWithoutAnEnd` is the
one new reader in the core.

### The identity, unchanged

```
  offset + step  <  gap   →  keep the anchor, offset += step        (ordinary ink nudge)
  offset + step  ≥  gap   →  anchor := the next note, offset += step − gap
```

Both branches move the drawn ornament by exactly one step, so **the crossing is invisible**. ⭐ The
crossing keeps both ends' nudges *by construction*: `setTrillStart` / `setTrillEnd` touch no override
at all, so unlike the slur there is no `…KeepingEdits` twin to reach for.

### ⭐⭐ What is this family's own — three things

1. **THE STOPS ARE NOTES.** The slur's family, ⛔ not the pedal's — and the candidate rule is
   `trillReanchor.nextTrillAnchorStop`, exported so `Ctrl+Shift+←/→` and a plain arrow cannot land
   the same square on different notes.
2. **THE TWO ENDS MEASURE AGAINST DIFFERENT X'S.** The sign is drawn on its note; the wavy line stops
   at the note **after** the trill (`TrillRenderer.spanX`, the third end rule). So the END's gaps are
   its *successors'* distances — over `x = 0, 100, 300`, an end stepping from the first note to the
   second moves the line by 200 while the noteheads are 100 apart. ⛔ Measuring note-to-note there
   (right for a slur, whose endpoint is drawn ON the head) makes every crossing jump the difference.
   ⭐ **RESTS ARE IN THE LANE** for this reason though they can never be an anchor: the line stops at
   the next SLOT whatever it is. One beat map, two filters.
3. **A STOP THAT CLEARS THE END IS PRICED WHERE THE INK LANDS** — the hairpin's `addressOfAbs` rule,
   and here it bites on any TIED start. Walking the end back onto the start leaves the one-note
   trill, whose line stops at the end of the **tie chain**, not at the start note. Priced at the note
   the step names it would read as a whole tie's worth of gap and the ink would jump it; priced
   honestly the gap is zero, no press can arrive, and `Ctrl+Shift+←` stays the route to the collapse.

### ⛔ What it deliberately does NOT do

- **It will not cross a SYSTEM BREAK** — `slurEndpointWalk`'s refusal: two systems' x's are not one
  ruler. ⛔ The hairpin's WRAP is not copied: a wedge's tip hangs in the margin, while a trill that
  has left its line has left its notes. `Ctrl+Shift+←/→` is the gesture that crosses a break.
- **It does not reach the BARE `tr`.** That state has no gap to measure to, and a crossing that put
  the line back would jump the end square the width of the whole ornament. With no line drawn, an
  arrow on the end square stays the plain ink nudge it has always been.
- **The vertical stays a pure offset**, and on this mark it moves the WHOLE ornament: the sign and the
  wiggle share one baseline.

### ⚠️ The re-base is not a nudge

`rebaseTrillEndpointOffset` is `nudgeTrillEndpoint` **without the page limit**, and the reason is the
hairpin's runaway of 2026-08-20: the crossing's `offset −= gap` leaves the drawn ornament exactly
where it was, so a rule about where INK may go must not judge it. Refused, it leaves the anchor ahead
of the ink and the next press crosses again — all the way to bar 1.

### Tests

`interactions/trillWalk.test.ts` (10) + `interactions/trillLane.test.ts` (6), both break-tested: the
successor rule, the tie pricing and the bare-`tr` guard were each reverted and each took exactly one
assertion red with it. ⚠️ The fixture's lane is deliberately UNEVEN (the last note's successor sits
300 px on, where the noteheads are 100 apart) — evenly spaced, every assertion passes with the
successor rule deleted.

### 🚨🚨 Three corrections from his hand-testing, the same afternoon

**1. A step the model would refuse is a DEAD KEY.** *"it never gets the next target… after the second
trill are other notes that have no trill"* — the sign walked down the lane and stopped forever on a
note carrying another trill. The op was right to refuse it; asking only AFTER the step was the bug.
`trillOps.trillMayAnchorOn` now answers BEFORE the step is offered, so the walk SKIPS such a note
exactly as it has always skipped a rest. ⭐ The two ends differ, and the model is why: a START may not
sit where another trill sits, an END may (spans overlap).

**2. 🚨🚨 The END's successor is scoped to ITS OWN BAR.** `TrillRenderer.spanX` asks
`slotIdAfter(to.view, …)` — the end measure's own view — and falls back to that bar's `noteEndX`. The
first cut of `trillLane` read the next slot ACROSS bars, which invented a whole class of phantom
system crossings (*"i still don't see the cross system extension working"*: the wrap had fired a
system too early, because the "successor" it measured was drawn on the next line). ⭐ A square is
therefore never drawn on a system its anchor is not on.

**3. ⭐⭐ THE FOLD — and it is the OFFSET that crosses a break, ⛔ not the anchor.**

> *"look how the offset works — here all the empty measures; in the case of a system jump, same
> thing: **no anchor to a note but offset in the next system**"*

`TrillRenderer.foldPastSystemEnd`: ink pushed past a line's end is re-expressed in the NEXT line's
coordinates and the pieces are cut to there. A trill's anchors are notes, so a passage of empty bars
offers nothing to re-anchor onto — and a score that runs out in rests could otherwise never have its
line carried onward at all.

- ⚠️ **The END NUDGE moved INTO `trillGeometry`** (it used to be added to the last piece at draw
  time): past a line's end it changes WHICH PIECES THERE ARE.
- ⚠️ **Both passes widen `covered` to the folded lines** — without a placement over there the
  fragment borrows the FIRST system's stave and draws at that height over the new system's x's.
- ⭐ The walk's `inkStaysOnSystem` then refuses only on the LAST drawn line, where the ink genuinely
  has nowhere to go. ⛔ It refuses the write; it never clamps the drawing.
- 🚨 **I first made a REST a legal END anchor, and he corrected me: *"im not overrulling"*.** Reverted.
  ⭐ **The lesson: when he explains a MECHANISM, build that mechanism — do not substitute one that
  merely produces the same picture.**

**…and the regression the fold caused, fixed the same hour.** *"the `tr` disappears, this should not
happen"*, on a trill carrying `endX: -5`. `cutIntoPieces` drops a piece whose end has crossed its own
start — right for a degenerate span — and with the nudge now folded in before the cut, a hand-nudge
dragging the end back past the sign deleted the only piece there was, taking the `tr`, its hit-box and
both squares with it. ⭐ The cut is floored at the sign; `drawsLine` alone decides the wiggle. **Pulling
the end back past the `tr` is a way of asking for a bare sign, ⛔ not for no ornament.** Covered by
`e2e/trill.e2e.ts` (a ONE-NOTE trill — over a three-note span 5 spaces does not reach the sign).

### ⏭️ Left open

- **The DRAG still snaps.** `trillDragTargetAt` picks the nearest note and re-anchors outright, where
  the wedge's and the slur's drags now run the same ports the keys do. That is the next step, and it
  is where `trillLane` earns its extraction.

---

## 13. The MOUSE DRAG, and the RIBBON it walks on — BUILT 2026-08-20

His ask: *"now the walking with the mouse drag… we should be able to go to the next system too,
behaviour of the user interaction similar to hairpins, just using the proper re-anchor for the
trill"*. What came out of the hand-testing that followed is bigger than the drag: **a system break
stopped being a special case at all.**

### ⭐⭐ THE RIBBON — every drawn line laid end to end, as ONE ruler

`interactions/trillLane.trillRibbonX`. The drawing FOLDS ink past a line's end onto the next
(§12), so a trill's ink really does travel ONE continuous distance — down line 1, onto line 2, and
on. Every x the walk's port answers with is now measured along that ribbon, and the consequences are
all deletions:

- **no wrap, no stub landing, no folded-gap crossing** — `crossingTheBreak` and `leaveSystem` are
  gone, with `WRAP_STUB_SS`;
- a note three systems down is simply three systems' worth of gap away. 🚨 The per-line arithmetic
  could only ever count ONE line hop, which is why his trill *"never was re-anchored to the note 3
  systems below"*;
- the ink limit is the **ribbon's** two ends (the last line the render drew), ⛔ not a system's edge:
  *"if there are no notes in the other system the walk just stops… it should not stop, it should go
  as offset"*.

### ⭐⭐ THE FOLD RUNS BOTH WAYS

*"the cross staff is not working in the opposite direction for the begin endpoint"* — on a `tr`
nudged 51 spaces LEFT. Ink pushed past a line's START continues at the END of the previous one, and
it stops at the first line the render drew. ⭐ The two directions are one rule read twice; only the
forward half had been written. ⚠️ `coveredPlacements` takes its window from BOTH folded ends now — a
sign folded backwards lands on a line EARLIER than its span's, and without a placement there the
fragment would borrow the wrong stave.

### ⭐⭐ THE SIGN FOLDS TOO

The START nudge moved into `trillGeometry` beside the end's, so the `tr` walking past the end of a
line continues at the start of the next instead of sliding into the margin until the page limit
froze it. ⚠️ A sign pushed past its own line's end takes the line with it — the ornament is then one
piece on the sign's line, because a wavy line ending on an earlier system than its `tr` is not a
drawing of anything.

### ⭐⭐ THE DRAG IS THE SAME GESTURE WITH A CURSOR IN IT

`trillWalk.dragTrillEndpoint` + `MusicEngine.previewTrillEndpointOffset` / `…Rebase`. The ink follows
the hand and the anchor comes along when the ink reaches a note; the LATCH is on and what it drops is
repaid (`droppedPx`), the wedge's rule. **A drag and N presses over the same distance now land in the
same state.**

- ⛔ **`trillDragTargetAt` IS DELETED** with its spec chapter: nobody asks *which note is the cursor
  nearest* any more. Its cursor-y translation went too — a walk reads a horizontal DELTA, so the
  *"the drag's cursor rides the mark's line"* rule has nothing left to answer for here.
- ⛔ **No wrap ⇒ no gesture to end**, ⚠️ the one place this drag differs from the wedge's: the wedge
  stops at a wrap because its tip re-anchors onto the next system while the hand is left behind;
  nothing re-anchors here that the ink has not already reached.
- ⛔ **Horizontal only.** The trill's vertical is ONE number for the whole ornament and the ladder
  places it; the arrows own it.
- ⏭️ **What went with the snap: the bare `tr` BY MOUSE** (the end dragged left past the start).
  `Ctrl+Shift+←` still reaches it — and the drag now reaches exactly what the keys reach.

### 🚨🚨 A KEY PRESS CROSSES AT MOST ONE STOP

*"the re-anchor is completely broken"* — an ornament whose ink had been nudged 59 spaces ahead of its
note was already PAST every stop in between, so `carryMark`'s loop crossed them all in one keystroke:
the anchor left bar 3 for bar 8, hopping another trill's notehead on the way. ⭐ Nothing moved on
screen (the identity working), which is exactly what made it unreadable.

**So `carryMark` took a `maxCrossings`, and the keyboard passes 1.** The ink still travels its own
step on every press; the anchor walks back up to it a note at a time, visibly. ⚠️ A DRAG keeps the
loop — one frame of a fast drag really can fly over several stops.

### ⭐⭐ THE ANCHOR GUIDE POINTS AT THE NOTE — always, however far the sign has gone

*"I want to see the anchor point of the `tr`, so we should draw it always."* 🚨 His report before that
(*"why do I see the anchor line running even in the empty measures in the first system?"*) was NOT
about the line existing: folding the nudge into `geometry.startX` had made the guide's **target**
travel with the sign, so it pointed at a spot in an empty bar. ⭐ `trilledNoteAnchor` asks the NOTE
for both coordinates now. Suppressing the guide (my first answer) hid the very fact he was asking
about.

### 🚨🚨 A clamp asks WHERE the other end is — ⛔ never where it sits in the STOPS list

His report, on a dragged start: `setTrillStart refused: the start would pass the end`, once per frame,
for ever. The chain, and every link is a rule meeting another:

1. the far end was a note carrying ANOTHER trill, so the candidate filter dropped it from `stops`
   (a START may not sit where another trill sits — §12's fix);
2. the clamp *"the start may never pass the end"* looked that end up **by index in the filtered
   list** → `-1` → it read that as *"there is no end to cross"*;
3. so the walk offered a note far beyond the end, the model refused it, and the drag retried on every
   frame — the ornament never moved.

⭐ Both clamps now compare POSITIONS (measure, beat). ⚠️ The first version of its test passed BOTH
ways, because the model's own refusal hid the bad candidate: the assertion has to be on
`nextTrillAnchorStop` itself, ⛔ not on whether the key returned false.

### Tests

`trillWalk.test.ts` (19, incl. the drag chapter), `trillLane.test.ts` (10, incl. the ribbon),
`TrillRenderer.fold.test.ts` (5), plus `e2e/anchorGuide.e2e.ts`'s nudged-sign regression. The ribbon,
the fold, the sign floor and the guide's target were each break-tested.

### ⏭️ Left open

- The trill's **band limit** (a vertical drag would need it, which is why the drag has no `y`).
- ⚠️ The two conventions `trillLane` mixes — a successor read at its CENTRE, a bar's end an exact
  edge — differ by half a notehead at a bar's last slot. Below a press's quarter space, and recorded.

---

## 14. The VERTICAL drag — the LADDER — BUILT 2026-08-20

His ask: *"now we need to make the mouse drag change the `tr` y offset, and of course we have to be
aware of the system jump in the y, similar to hairpin"*. The rungs are the wedge's, rule for rule
(`interactions/hairpinWalk`), because they are the same two questions asked of any mark that has a
SIDE.

```
   … above staff N, below staff N, above staff N+1, below staff N+1 …
```

### The three steps of a frame, in order

1. **ITS OWN STAFF FIRST** (`flipTrillPlacement`). A trill has a `placement`, so the far side of its
   staff is a place it BELONGS: an `above` ornament whose ink passes the BOTTOM line goes `below`,
   and the mirror. ⭐ That fixes *"it jumps to the upper system too quickly"* by construction and
   with no threshold to tune — once it is on the far side, `markSystemJump` measures its natural
   distance from THAT edge, so the next staff is a whole system away again. The height goes with the
   flip: a distance measured above the staff means nothing below it.
2. **THEN THE SYSTEM JUMP** (`jumpTrillSystems` → `trillLane.trillSystemNoteFor` →
   `interactions/markSystemJump`, the shared port, ⛔ never a copy). ⭐ **The whole ornament goes,
   extent and all** (`trillOps.moveTrillTo`): a trill's extent is counted in the LANE's own notes, so
   a span of N stops arrives as a span of N stops — counted on the interaction side, since the lane
   is not a model question. It lands **on the side it came from** (down ⇒ *above* the staff below),
   and both offsets go.
3. **OTHERWISE, ink**: the horizontal walk as before, plus the height.

### ⚠️ Two things that are the trill's own

- **The height is ONE number for the whole ornament** — the sign and the wiggle sit on one baseline,
  so `TrillOffsetOverride` has a single vertical and the armed square does not matter to it.
- **It is stored OUTWARD from the staff**, so the drag converts screen-down → outward: dragging an
  `above` trill UP grows it. ⛔ A screen-signed number would invert the moment `x` flipped the side.

### 🚨🚨 A rung ends the FRAME, ⛔ not the GESTURE

*"look, I have to release the mouse and click again… but not in one movement"*. I had copied the
wedge's ENDPOINT rule, where a horizontal WRAP really does end the drag — the tip lands on another
system while the hand stays on this one. ⭐ **A vertical rung is the opposite: the hand travels WITH
the ornament**, so the gesture goes on and the next rung comes when the hand reaches it. The wedge's
BODY drag has always done exactly this (`handleHairpinBodyDrag`).

### ⭐ An EMPTY system is not a refusal

*"it does not matter if it cannot anchor in the other staff because it is empty — we can land in an
empty system as offset."* A trill's anchor is a NOTE, so a system of rests has nothing to hang off;
the jump simply does not fire and the ink carries the ornament down, exactly as it does sideways.
⚠️ That decline is LOGGED (`whyNoJump`) with which of its three reads it was — a gesture that looks
like it did nothing is otherwise indistinguishable from one that was refused, which cost an afternoon
on the wedge.

## 15. The WHOLE ORNAMENT walks — BUILT 2026-08-20

His ask: *"now we should do the `tr` shape walking — I mean, trill selected but NOT endpoints"*. The
family's rule, stated on the wedge's body the same day: **something armed → that end; nothing armed →
the whole mark** — and now with the same walk under both, so a nudge and a re-anchor are one gesture
wherever they meet.

`trillWalk.bodyPort` + `walkTrillBody`, a third port beside the two squares'.
`MusicEngine.moveTrill` (commits — AUDIBLE) and `rebaseTrillOffset` (bookkeeping, ⛔ no page limit).

- ⭐ **Its stops are the START's** (`nextTrillAnchorStop`'s new `'body'`): an ornament moved as one is
  moved by its beginning. Its ink is BOTH ends at once (`nudgeTrill`), which is what the arrows have
  always written with nothing armed.
- ⭐⭐ **The EXTENT travels** (`extentFrom` → `trillOps.moveTrillTo`) — counted in the LANE's own
  stops, a trill's only measure of how much music it covers, and counted on the interaction side
  because the lane is not a model question. ⚠️ A span pushed off the end of the lane arrives
  SHORTENED rather than refused, the degradation a lost end has always had.
- ⚠️ **The `'body'` case has no clamp and is rarely observable** — while the extent is carried the far
  end is always a stop ahead of the step, so the start's own clamp would allow the same moves. It
  matters where the extent CANNOT be carried (an end whose note has picked up another trill). ⭐ The
  test says only what it proves: break-testing showed the "no clamp" case passing with the branch
  gone, and a test that claims more than it proves is a false warning.

### ⏭️ Left open

- **The mouse equivalent** — a press on the ornament's own INK dragging the whole thing, the wedge's
  BODY drag. The port is built; only the gesture is missing.
- No BAND limit on the trill's vertical (the wedge has one). The ladder is the limit in practice: any
  height that reaches another staff's neighbourhood becomes a rung. ⏭️ Worth his eye.

---

## Sources

MusicXML [`trill-mark`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/trill-mark/) ·
[`wavy-line`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/wavy-line/) ·
LilyPond [trill spanners](https://lilypond.org/doc/v2.24/Documentation/notation/expressive-marks-as-lines)
+ [`TrillSpanner` internals](https://lilypond.org/doc/v2.24/Documentation/internals/trillspanner) ·
MuseScore [`trill.h`](https://github.com/musescore/MuseScore/blob/master/src/engraving/dom/trill.h)
+ [`ornament.h`](https://github.com/musescore/MuseScore/blob/master/src/engraving/dom/ornament.h) ·
Dorico [ornament placement conventions](https://archive.steinberg.help/dorico/v1/en/dorico/topics/notation_reference/notation_reference_ornaments_general_placement_conventions_c.html),
[trills](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_ornaments/notation_reference_ornaments_trills_c.html),
[trill extension lines](https://archive.steinberg.help/dorico/v1/en/dorico/topics/notation_reference/notation_reference_ornaments_trill_lines_hiding_t.html) ·
[SMuFL multi-segment lines](http://smufl.formats.music/latest/tables/multi-segment-lines.html)
