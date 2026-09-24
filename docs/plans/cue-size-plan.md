# Cue-size notes — a real note, drawn small: the plan

> **Status (2026-09-24): P0 committed (`c289873`); P1 committed (`3d9dbe8`); P2 committed (`b2c0da7`); P3 BUILT, awaiting his UI check.** His calls are in (§4). The research is `docs/research/cue-size-research.md`
> (all three chapters are in; §0 is the synthesis). ⛔ A number never blocks a phase (`CLAUDE.md`).
>
> ⚠️ **The UI is the dev shell's** (`src/dev/devToolbar.ts`): one `cue` button, like `paren.`.
>
> ⚠️ **Not a small staff** (`docs/plans/staff-size-plan.md`). There, the whole staff is drawn in a
> `scale(k)` group. Here the staff is full size and ONE chord in it is small. That chord keeps its place
> in time, and its voice's beams, ties, slurs and tuplets still reach it.
> ⚠️ **Not a grace.** A grace is extra ink beside its host, composed by `GracePass` at a scale. A cue note
> IS the host: it is counted in the bar.

---

## 0. The decisions

| # | decision | status | proposed | why (research) |
|---|---|---|---|---|
| **C1** | **where it lives: the SLOT** | ⏳ proposed | `cue?: true` on `Chord` and `Rest`. The same field goes on `GraceNote` and `BracketedGrace` (C4). A fan member follows its slot. **Absent = full size**, the only spelling of it | MuseScore's "Cue size" always writes to the CHORD (A.1). Sibelius and Dorico cannot shrink one head of a chord (C.2). The stem, flag and beam belong to the chord, so a per-head flag cannot say what they do |
| **C2** | **a FLAG on the note; the SIZE is a PRESET** | ✅ 2026-09-23, his call (*"lets do gould but also this should be done in a preset so gould-ross 0.75 is default"*) | a boolean on the note, and `CUE_SIZE_RULES` in `layout/cueSize`, armed from the console like `GRACE_SIZE_RULES`, and a free number is accepted too: **`gouldRoss` 0.75 (default)**, what Gould p. 569 and Ross p. 189 WRITE; also Dorico, Sibelius and Verovio · `gouldDrawn` 0.62, what Gould's plates DRAW (pp. 570–571) · `musescore` 0.7 (also IMSLP) · `gerouLusk` 0.65, the low end of G&L's 65–75% · `lilypond` 0.63 | cue is a boolean in MEI, MusicXML, MuseScore and Verovio; the ratio is a style setting everywhere (A.5, C.1). At 0.75 the cue stays above our grace (2/3), which is the order every book writes (§0.2). ⚠️ `gouldDrawn` and `lilypond` put the cue BELOW our grace |
| **C3** | **it SOUNDS** | ⏳ proposed | playback unchanged. A SILENT note is a separate flag, later, ⛔ not this feature | every engine plays cue notes by default (MuseScore `play`, Verovio `midiNoCue` off). MusicXML's `<cue/>` means *silent*, and a cue-SIZED note that plays is `<type size="cue">` (C.1): two facts, two fields |
| **C4** | **a grace that is also cue: its OWN size, chosen from PRESETS** | ✅ 2026-09-23, his call (*"b but probably a also"*, then *"can we make this changeable so we have presets?"*) | `GRACE_CUE_SIZE_RULES` in `layout/cueSize`, armed from the console like `GRACE_SIZE_RULES`, and a free number is accepted too. Two presets are RULES that follow the other two sizes when those change; the rest are the sources' fixed numbers: **`multiply` (default)** = grace × cue (2/3 × 0.75 = **0.5** today) · `graceWins` = the grace size (Verovio) · `musescore` 0.49 · `sibelius` 0.45 · `lilypond` ≈0.445 | the books say nothing (research §B.4). MuseScore multiplies everything (0.7 × 0.7); Sibelius multiplies (75 × 60, from a plugin author); LilyPond multiplies the glyphs but keeps the grace's stem and beam; MusicXML (`grace-cue`) and Dorico ("Cue grace") give it its own size (§0.4). ⏳ LilyPond's split (glyphs multiplied, stem not) is a later option if his eye asks for it |
| **C5** | **what shrinks** | ⏳ proposed | heads, flag, dots, accidentals, articulations, the stem's LENGTH, the ledger's LENGTH, rests, a head's brackets. A tuplet's number shrinks only when every note under it is cue (MuseScore) | all three engines scale these (A.5). The brackets follow the head in MuseScore, Verovio and LilyPond |
| **C6** | **what stays full: stem, tie and slur THICKNESS; the LEDGERS' thickness is a preset** | ✅ ledgers 2026-09-23, his call (*"c) and default is gould"*); the rest ⏳ proposed | the THICKNESS of stems, ties and slurs, and the tuplet bracket, stays full. `CUE_LEDGER_RULES` in `layout/cueSize`: **`gould` (default)**, thinner, × the note's size, as MuseScore and Verovio thin them (Gould gives no number) · `full`, the system's weight, our grace's rule (`GracePass`, G&L p. 75) and LilyPond's. The ledgers' SPACING is full in every source: the head sits on the full staff's lines | Gould p. 569: *"Ledger lines for cue notes should be the same vertical distance apart as full-sized ledger lines (although they are thinner)."* LilyPond states full stems, slurs and ties as a rule (*"NOT allowed to shrink below default size"*), and Verovio keeps them full; MuseScore thins them |
| **C7** | **a beam: small only when ALL its notes are cue** | ⏳ proposed | an all-cue beam has its thickness and its gap × k. A mixed beam is full, and a cue note's stem reaches it | MuseScore takes the max, and Verovio requires all notes to be cue (A.5): the two agree |
| **C8** | **spacing: the INK shrinks first; a closed-up cue is a ROW after it** | ⏳ proposed | `slotInk` shrinks a cue slot's boxes around each head (P1). Closing up the duration stretch when a whole column is cue is P6, a row | ⭐ Gould p. 569: *"Note spacing should be closed up within a cue: space characters in proportion to the reduced note size."* MuseScore 4 (× 0.7, whole column) and Dorico (70%) agree; MuseScore 3, Verovio and LilyPond only shrink the ink |
| **C9** | **one head of a chord** | ⏸️ later | not now. The field would be `NotePitch.cue`, MuseScore's "Small notehead" | MuseScore and Verovio can do this; Sibelius and Dorico cannot |
| **C10** | **a CUE PASSAGE's conventions: left OPEN** | ⏸️ 2026-09-23, his call (*"this is not important for the moment... we are drawing music... cue can be used however the user wants... lets leave this opened"*) | the button makes notes SMALL and nothing else. Reversed stems, the player's full-size rests and a small clef are the user's to write with the tools that exist (stem direction, rests, a clef change). ⛔ Nothing automatic is built, and ⛔ nothing is ruled out | the books' rules are about music QUOTED from another part (research §0.7). Gould's "cue-sized" also covers ossias, alternatives and hummed notes (§B.5). A cue CLEF, if ever: Gould ⅔ (= a mid-system clef), G&L 75% |
| **C11** | **a cue head's BRACKETS: a preset** | ✅ 2026-09-23, his call (*"c"*: a preset holding both; *"gould is default"*) | `CUE_BRACKET_RULES` in `layout/cueSize`: **`gould` (default)**, the brackets at FULL size round the small head · `shrink`, the brackets at the head's size (MuseScore, Verovio, LilyPond). `gould`: the brackets at full size round the small head (Gould's plates, pp. 139 and 378, ≈2 sp; the `gould` form's own rule) | the sources split (research §0.3). Gould once draws them ≈0.85 (p. 497), which a free number can reach |

---

## 1. The model: `types/notes.ts`

```ts
// On Chord, Rest, GraceNote, BracketedGrace:
//   cue?: true   // absent = full size
```

- **Absent, never `false`.** `laneFingerprint` (the width-cache key) stringifies the slot, so the op
  DELETES the field. That also means a cue slot gets its own width key for free.
- **Flat `Note`** (`noteProjection`) projects it, so the Properties report and `getNote` can see it.
- **What travels:** a slot field copied BY NAME must learn it. That means `slotFieldTravel` (carried
  through a re-lay, onto every piece of a split, as `enclosureSpan` is), the clipboard, and
  `convertToRest` (a cue note turned into a rest is a cue rest). ✅ P0 audited them — see §3 P0 for the list, and
  his two rules (only a DELETE clears it; ENTRY takes what the palette arms, EDITING keeps it).
- **JSON:** reported, never repaired. The load reports a `cue` that is not `true`.

## 2. How it is DRAWN: the note learns its own size

⭐ **The core question.** A cue note is read by everything that reads a normal note: the beam (its stem
tip), ties and slurs (its head edges), the tuplet, articulation placement, hit boxes, the spacing. There
are two ways to make it small, and only one of them keeps those readers honest:

- ⛔ **Compose it at a scale, as `GracePass` does** (parts in a `scaling(k)` group). The `EngravedNote`
  would still answer at full size while its ink is small, so every reader would be wrong in a different
  way: the ruler must say what was drawn (the standing rule at the head of `EngravedNote.ts`).
- ⭐ **`EngravedNote` carries its own glyph scale.** This is VexFlow's own shape (`GraceNote extends
  StaveNote`, `fontScale` 2/3). Our port kept that scale only as a constant, `NOTE_GLYPH_SCALE = 1`
  (`engrave/inheritedDefaults.ts:148`: *"a grace note would be a second row"*). Everything the note
  answers then follows its size, and the readers stay right because they ask the note:
  - its face: `noteFont()` → the heads (`EngravedHead` already takes `options.font`) and the flag;
  - the stem length: `STEM_LENGTH_PX` in `engrave/notes/stemLength` and in `EngravedNote`;
  - the ledger overhang: `LEDGER_OVERHANG_PX`, and its thickness by the C6 preset;
  - its modifiers: `EngravedDot`, `EngravedAccidental` and `EngravedArticulation` read
    `musicGlyphFont()` today, and would ask their note's scale instead.

  How far this reaches, from a grep of the non-test files: `noteFont()` has 8 readers,
  `musicGlyphFont()` 11, `STEM_LENGTH_PX` 3. The stem THICKNESS readers (10) do not change.
- **The width side** is `measureColumns.slotInk`. It shrinks a cue slot's boxes around each HEAD'S y.
  ⚠️ This is not `sized()`: that one scales widths for a whole small staff, and a cue head still stands
  on the full staff's lines.
- **Where the size comes from:** `layout/cueSize` answers `slotScale(slot)` (1 for a full note, `cueScale()` for a cue note, and for a
  cue grace the armed C4 preset). The size rows re-arm through `widthRowGenerations`, as
  `graceSizeGeneration` does.

### Where the code goes (`CLAUDE.md`: a new feature adds a MODULE)

| module | what it answers |
|---|---|
| `engine/models/cueOps.ts` | ✅ P0: `setCue` / `toggleCue` / `isCue` (an id → the chord, rest, grace or bracketed grace it sizes; writes or DELETES the field), `cueProblems`, and `keepCueSilence` (his rule: only a delete clears it) |
| `engine/commands/cueCommands.ts` | ✅ P0: the ops call, then ONE `mutate('Cue size' / 'Full size')`. The facade gained one line (`engine.cue`) |
| `engine/layout/cueSize.ts` | `CUE_SIZE_RULES` (C2) + `GRACE_CUE_SIZE_RULES` (C4) + arming, `slotScale(slot)` |
| `EngravedNote` + its modifiers | a `glyphScale` read from the note's options. `NoteBuilder` passes `slotScale(slot)` |
| `measureColumns.slotInk` | the cue slot's boxes, shrunk around their heads |
| `interactions/stamps/cueTool.ts` | the button's press and lit state. `devToolbar` gets ONE `toggle(…)` row |
| `dev/cueConsole.ts` | `__cue.size('musescore' \| 0.7 …)`, for his eye (like `__grace.size`) |

## 3. Phases (each stops for his UI check)

- **P0: the model.** Type, field, projection, the op, the command with undo, the JSON check, and the
  audit of the slot-field copies. Specs: set and clear on a chord, a rest and a grace; undo; a split
  keeps it; copy and paste keep it.
  - ✅ **Built 2026-09-24.** `cue?: true` on `Chord`, `Rest`, `GraceNote`, `BracketedGrace`, the flat `Note` and
    `PitchInsert`; `engine/models/cueOps` (`isCue` · `setCue` · `toggleCue` · `cueProblems`) and
    `engine/commands/cueCommands` (`engine.cue`, one `mutate`: *Cue size* / *Full size*). An id names what it is the
    size OF: a head or a fan member → its chord, a rest → itself, a grace or bracketed grace → itself (⛔ never its host).
  - **The audit — what carries it:** `slotFieldTravel` (`cue: 'carried'`) + the relay (event, piece, materialiser — a
    chord's and a rest's), `cloneGraceFresh` / `cloneBracketedFresh`, a voice move (a merge keeps the destination's),
    `convertToRest` (a cue rest), and the conversions note ↔ grace, note → bracketed, grace ↔ bracketed.
  - ⭐⭐ **His rules (2026-09-24).** (1) *"if a user mark a rest as cue it should carry the cue flag unless the user
    change it, what only can clean the cue without explicit user intervention is delete"*. (2) *"for note editing the
    cue value persist, for note entry what is important is what is armed on the pallette"*.
    - A cue REST travels through a re-bar as content (⛔ not regenerated as a gap; a cue measure rest too).
    - The model's own rest churn keeps cue SILENCE cue: `cueOps.keepCueSilence` wraps the placement evictions
      (`replaceRestsWithChord` · `evictRestsOverlappingChord` · `addRestSlot`), a duration change (`changeNote`), a
      grace's beat rest (`beatRestAt`), a paste (`pasteEvents`) and a tuplet's entry (`buildTupletWithFirstNote`):
      a REST that afterwards starts inside a stretch a cue rest held is cue.
    - ⛔ A NOTE ENTERED there (typed, pasted, a tuplet's first note) is sized by what the palette has ARMED; nothing
      arms cue yet, so it is full. A pasted note keeps the clip's own size.
    - EDITING keeps it: a note's duration or pitch changed; a rest turned into a note IN PLACE (the same slot);
      a tuplet note moved to another voice (and the target voice's re-poured notes); a grace or bracketed grace
      turned into the note of its slot (never takes the note's or the rest's cue off).
    - ⛔ Delete (`deleteNotes` → `clearOps`) does not wrap: it clears.
  - ✅ A secondary voice left holding only rests is removed (`collapseEmptyVoices`), cue rests and all: that rule
    stands as it is (his call, 2026-09-24).
  - ⏳ **Open:** ARMING cue for entry (his rule 2) — the entry value this plan had filed under *Later* — now has a
    reader: when to build it.
- **P1: one cue note on the page.** The button (selection → toggle). `EngravedNote` learns its scale:
  heads, stem length, flag, dots, accidentals, ledgers; the spacing ink. An unbeamed note or chord only.
  ⭐ Proved by a SCENE test (head sizes, stem length) and a Chromium measurement of the ink (the flag,
  the accidental), because jsdom's glyphs are 0 wide.
  - ✅ **Built 2026-09-24, awaiting his check.** `layout/cueSize` (`CUE_SIZE_RULES` C2, `gouldRoss` ¾ armed ·
    `CUE_LEDGER_RULES` C6, `gould` armed · `slotScale` · a width generation). `EngravedNoteStruct.glyphScale`, handed
    by `NoteBuilder` from `slotScale(slot)`: the heads' and flag's face (so the measured head width, the stem x and
    the modifiers' start follow), the stem LENGTH as a negative extension (VexFlow's `GraceNote` shape), the ledger
    overhang and weight; `EngravedModifier.noteScale()` sizes the dot and the accidental. `measureColumns.shrinkCueInk`:
    the note's own boxes at its size, each about where it stands. The `cue` button (`interactions/stamps/cueTool`,
    beside `paren.` in the dev toolbar's Note group) and `__cue` (`dev/cueConsole`).
    Proved: `EngravedNote.cue.test.ts` (scene: fonts ¾, stem 8.75 px shorter, ledger ¾ long and thin),
    `e2e/cueSize.e2e.ts` (Chromium: head, sign, dot, flag ¾ within a whole pixel; the stem at the small head's edge),
    `measureColumns.cue.test.ts`. ⏭️ The press in NOTE ENTRY (arming cue) is not built: it logs and does nothing.
- **P2: beams, articulations, tuplets.** An all-cue beam at k (thickness and gap); a mixed beam full,
  with the cue stems reaching it; articulations at the note's size; the tuplet-number rule (C5); the
  one-note tremolo strokes (they read `NOTE_GLYPH_SCALE` today).
  - ✅ **Built 2026-09-24, awaiting his check.** `EngravedNote.sharedGlyphScale(notes)`: a group's size when EVERY
    note that votes is cue, else 1 (rests do not vote until P3). A BEAM (`EngravedBeam.beamWidth`, the fractional
    stub's length) takes it; a beamed note's natural stem is the BEAM's size, ⛔ not its own — so a mixed beam lies
    where the pitches put it (a cue note's short tip had tilted a beam over a repeated pitch: caught in the scene)
    and the beam brings every stem to its line. An ARTICULATION and the TREMOLO strokes ask their note
    (`noteScale()`); a TUPLET's number is `sharedGlyphScale` of its notes (`layoutTupletMark(runs, scale)`), its
    bracket full (C6). Proved: `EngravedBeam.cue.test.ts`, `EngravedArticulation.cue.test.ts` (scene),
    `e2e/cueMarks.e2e.ts` (tuplet number, tremolo — drawn outside the scene).
- **P3: rests.** A cue rest: the same `EngravedNote` route. ⏳ Where it sits vertically is a question
  for his eye (the books may say).
  - ✅ **Built 2026-09-24, awaiting his check.** A cue rest (and a cue whole-bar rest) takes the note's route:
    the same key line as a full rest, the glyph smaller from the same origin — MuseScore's (`restlayout.cpp:135`
    places the line, `mag` scales the glyph). Its dot follows; its room is ¾ (`measureColumns`). Rests VOTE in
    `sharedGlyphScale` now (MuseScore: a tuplet is small only when every chord AND rest is, `tupletlayout.cpp:204`).
  - 🚨 **His report (2026-09-24, screenshot): a small head in a SPACE touches the line above, with a gap below.**
    Measured at 5×: every small head (cue AND grace) has 0 px above, 8–10 px below. ⭐ Not the scaling: the heads
    are centred on the note's y (Bravura heads are ±0.5 sp about the baseline; MuseScore, Verovio and LilyPond
    place a note at the full staff's pitch position and scale the glyph about it — Gould p. 569). ⭐ The STAFF
    LINES are off: they hang DOWN from their y (`engrave/staff/staffLines.staffLineStrokeY` = `y + t/2`,
    VexFlow's crispness idiom), while notes and ledgers are centred on it — so every note stands ½ a line's
    thickness (≈0.55 px) above the middle of its line or space. A full head hides it; a small one shows it. All
    three engines CENTRE the line on its position (LilyPond `Lookup::horizontal_line` ±th/2; MuseScore and
    Verovio stroke it). ✅ **FIXED 2026-09-24, his call ("a")**: `staffLines` now centres the line on its y
    (`staffLineStrokeY` = `y`; edges `staffLineInkTopY`/`InkBottomY` = y ∓ t/2); barline ends (line middles) and
    the brace/bracket span (outer edges) follow through the module. Measured at 5× after: a cue head 3 px above /
    5 px below, a grace head 5 / 7 (was 0 / 8–10). `e2e/cueSize.e2e.ts` now checks each head against the page's
    lines (it breaks by 0.55 px with the old rule). One e2e (`tie.e2e.ts`, the line-note tie) had passed on the
    half pixel: it now measures the repair's exact 0.3 sp target — the assertion became ≥.
- **P4: graces and brackets.** A cue grace or bracketed grace at the C4 size. A cue head's brackets
  follow the head: `headEnclosure` takes the head's scale. ⚠️ The armed `gould` form is drawn FULL size
  by design (N8 of `parenthesised-note-plan.md`). Whether a cue head's brackets shrink is the C11 preset.
- **P5: what reads it.** Ties and slurs (their endpoints should come free from the note; check them),
  hit boxes and the selection highlight, the entry ghost, the Properties report.
- **P6: a closed-up cue (C8).** When a whole column is cue, its duration stretch × a row (Gould p. 569;
  MuseScore 0.7, Dorico 70%).
- **Later, only when asked:** one head of a chord (C9); a SILENT flag (C3); a cue clef (C10);
  a cue stamp or an entry value (the `paren.` P4b five-way press); the Keypad; MusicXML
  `size="cue"` / `<cue/>`.

## 4. His calls (2026-09-23)

1. ~~**C4:** does a cue grace multiply (≈ 0.5), have its own size, or stay a grace?~~ ✅ Its own size, from presets; the default preset multiplies.
2. ~~**C2:** the cue size~~ ✅ Presets; `gouldRoss` 0.75 is the default, `gouldDrawn` 0.62 beside it.
3. ~~**P4:** do a cue head's brackets shrink?~~ ✅ A preset (C11); `gould` (full size) is the default.
4. ~~**C6:** a cue's ledger thickness~~ ✅ A preset; `gould` (thinner, × the note's size) is the default.
5. ~~**C10:** the passage conventions~~ ⏸️ Left open: the button only makes notes small.
