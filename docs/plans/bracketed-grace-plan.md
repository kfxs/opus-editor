# The bracketed grace — a head in round brackets, no stem, no flag: the plan

> **Status (2026-09-23): P0 · P1 · P2a · P2b committed — the model, drawn before its target with its
> room (`gould` brackets, his call), the `bracket.` stamp (notes, rests, graces), selection, arrows,
> Delete, and a written value for its head. P3 (on a grace, the beam split) built, ⏸️ his UI check.**
> The Keypad's Grace-page key `-` (`bracketed grace`) is drawn but still not wired
> (`docs/research/sibelius-keypad.md`).
> 📄 The research is `docs/research/grace-notes-research.md` **§0.9** (the synthesis) and **Parts G · H · I**
> (the books · the engines · the apps and formats). ⛔ This plan is where the decisions get made. §0 marks
> each one ✅ DECIDED (his word, with the date) or ⏳ PROPOSED. A proposed row is a default, not a decision.
>
> ⚠️ **HIS RULE FOR THIS FEATURE (2026-09-23):** the open edges (the merge, two groups side by side,
> the beaming) *"are things we have to see in practice not in theory and we will really know testing the
> feature"*. So each phase builds the least that can be tried, and stops for his UI check.
>
> ⚠️ **The UI is the dev shell's** (`src/dev/devToolbar.ts`, next to `acciacc.` / `appogg.`), as for
> the graces. The Keypad key stays unwired until he says otherwise.

---

## 0. The decisions

| # | decision | status | chosen | why |
|---|---|---|---|---|
| **B1** | **its own kind, not a grace form** | ✅ 2026-09-23 | a **`BracketedGrace`**, a sibling of `GraceNote`, ⛔ never a member of a `GraceGroup`. His words: *"the bracket is a different grace type and it is not part of the regular grace group … we can have a group of beamed apogg and after that a prebend bracet"* | a grace form would need an exception in every grace rule: the one slash, the group's stems, the beam, the sound, the side. Gould p. 139: *"Do not use a grace note for the trilling pitch"*. No engine has the kind: each one combines brackets + no stem + a role, and MuseScore's split (the pre-bend is a grace, the trill note belongs to the ornament) loses information at import and export (§0.9) |
| **B2** | **it belongs to its TARGET** | ✅ 2026-09-23 (*"ok so the bracket is asociate to the target good"*) | a child of the attack it leads into: a **main chord**, or a **grace note** (the pre-bend into the first appoggiatura) | a pre-bend bends INTO its target and a trill note says what its note trills TO. Dorico makes both properties of the target (§I.2) |
| **B3** | **the order is not stored** | ⏳ proposed | each attack's bracketed graces stand **immediately beside it**. Several on one target are a **list** on that target, left to right, the array order being the only stored order (the grace group's rule). So: `G (●) M` → on M · `(●) G M` → on G's first grace · `(●) G (●) M` → one each · `(●)(●) M` → two on M | a list rather than a chain (a bracket owning a bracket): no cycles, and it matches "information, not an attack". A playback reader that wants a chain can read it off the order |
| **B4** | **a bracket inside a group SPLITS it** | ✅ 2026-09-23 (*"the bracket break the group so now there are two groups … it makes sense that we have diferent beaming"*) | ⭐ proposed shape: **the split is DRAWN, not stored.** The group stays ONE `GraceGroup`. A grace carrying a bracket before it starts a new BEAM RUN (`graceBeamRuns`) and a new slash. So removing the bracket **merges** the group back with no operation at all (✅ *"yes i guess"*), and both halves keep the group's one type (✅ *"the group is one type so the split will be the same"*). A merge of two groups cannot happen, because there is only ever one | the alternative, `graceBefore` becoming a LIST of groups, touches every grace reader (≈70 sites, 18 files: room, ink, playback, rest carry, conversions, relay). ⏳ Two groups with nothing between them is a beaming question he set aside (*"for the moment i think is not important"*); this shape cannot express it, and that is deliberate until he asks |
| **B5** | **the sides** | ⏳ proposed | **before** (the pre-bend; his case) and **after** (every book's case: trill note, bend target, glissando end, harmonic, §0.9). A chord carries both; a grace carries **before only** | ⚠️ no book draws one BEFORE its note (G.8). Sibelius and every app's pre-bend do. After is its own phase (P5) |
| **B6** | **it does not sound** | ⏳ proposed | silent: no scheduled event, and ⛔ it never changes the bar's accidental state | every source: *"not separately articulated"* (Gould 144); no engine and no app plays the head itself (§0.9). What it MEANS (bend from, trill to) is for the reader of a later phase |
| **B7** | **what is drawn** | ✅ 2026-09-23 ⚠️ **REVISED the same day** | ⭐ **it HAS a written value — what its HEAD is drawn as** (his call: *"it should have case a half notehead is different than a quater notehead (in this sense the grace do it write)"*): `BracketedGrace.duration`, read off the LIT duration keys as the grace's is (`MARKING_TOOL_USES_ARMED_LENGTH`), a quarter's black head when none is lit; a duration key with one selected changes it. ⛔ Never counted; ⛔ no stem, flag, dot, beam or slash. **Size** is its own row, `BRACKETED_SIZE_RULES`, defaulting to the grace's `house` 2/3 (presets: Gould trill ≈0.75 · Gould bend ≈0.65 · MuseScore 0.7 · LilyPond 0.63 · Sibelius 0.6) | the first answer (*black whatever its target's*, Gould p. 418) was one book's open-string picture; the head IS the value, as a grace's is. Gould disagrees with herself on the size (0.75 vs 0.65, §G.4), which is why it is a row of its own |
| **B8** | **the accidental: inside the brackets** | ⏳ proposed default, a row | `( ♭● )` (books: all; MuseScore, LilyPond). The other row is `♭( ● )` (Verovio, VexFlow) | the one real split among the engines (§H.0). MusicXML cannot tell the two apart |
| **B9** | **the brackets: the font's glyphs** | ✅ 2026-09-23 **`gould`** — his call after both on the page: the ACCIDENTAL brackets E26A/E26B at FULL size (Gould's measure ≈2.07 sp); `notehead` stays a row | one pair per HEAD (Stone 76: a chord is stacked pairs), `noteheadParenthesisLeft/Right` E0F5/E0F6, which all three shipped faces carry (§H.6) | MuseScore draws a bezier sized from the heads so it can grow around ledger lines (Gould 388). That is the upgrade if the glyph looks wrong on a ledger note, found in use (his rule above) |
| **B10** | **a bracket on a REST** | ✅ 2026-09-23 ⚠️ **REVERSED the same day** | ⭐ **a rest IS a target, BEFORE only** — his report on the stamp: *"this should work similar to grace stamp on empty measure"*. It rides the graces' hand-over exactly (`restGraceOps`): a whole-bar rest first becomes a one-beat rest at the clicked beat; the note that takes the rest's place at that beat TAKES its bracketed graces; silencing a note keeps its `bracketedBefore` on the rest (`bracketedAfter` goes with the note, logged) | the first answer (*nothing to bend into or trill*) was the model's; entry is the user's — they write the bracket first, on an empty bar, and the note after, as D7 found for the graces |

---

## 1. The model — `types/notes.ts`

```ts
/** A pitch shown as information, not an attack: a black head in round brackets (B1, B7). */
export interface BracketedGrace {
  /** Real NotePitches with ids: one head, or several (a double-stop pre-bend). */
  pitches: NotePitch[]
}

// On Chord:      bracketedBefore?: BracketedGrace[]   bracketedAfter?: BracketedGrace[]
// On GraceNote:  bracketedBefore?: BracketedGrace[]   (B5: before only)
```

- **Absent, never `[]`**: the width-cache key stringifies the slot (`laneFingerprint`), the grace's rule.
- ⛔ Not on `Attack`, so not on a fan member: nothing asks for it there.
- **What travels:** the relay (`utils/rebar`, `utils/slotFieldTravel`) carries the chord's lists with
  their chord. `cloneGraceFresh` (`utils/graceNotes`) copies a grace's list with FRESH ids, as it
  does for the grace's own pitches.
- **JSON:** reported, never repaired. A `graceProblems`-style check reports an empty list, an empty
  `pitches`, and a bracketed grace on a rest.

## 2. Where the code goes (`CLAUDE.md`: a new feature adds a MODULE)

| what | module |
|---|---|
| the operations: add, remove, re-pitch, find by pitch id | `engine/models/bracketedGraceOps.ts` |
| the commands (undo labels, one `mutate`) | `engine/commands/bracketedCommands.ts`, reached as `engine.bracketed.…` |
| the pure reads (lists of a slot, of a grace) | `utils/bracketedGraces.ts` (in `utils/` for the relay, `graceNotes`' reason) |
| its ROOM **and** where each head, sign and bracket stands (one answer, `graceRoom`'s rule) | `layout/bracketedRoom.ts` — `beforeSideLayout` is the whole before side, read by `measureColumns.slotInk`, `GracePass` and the pass below |
| its drawing | `rendering/BracketedGracePass.ts`, called by `GracePass` (the before side's pass — ⛔ not `ScoreRenderer`, whose hub ceiling refused the line) |
| its sign | `utils/accidentalState.displayedAccidentals` — walked where it STANDS, ⭐ read-only (B6) |
| the stamp and its button's light | `interactions/stamps/bracketedGraceTool.ts`; a `{ kind: 'bracketedGrace', side }` joins `MarkingTool` |
| the split | ONE rule in `engrave/notes/graceBeam`'s `graceBeamRuns`: a grace with `bracketedBefore` starts a run |

**Selection** is nothing new: its pitches have ids, so a click selects it as a note and the arrows
re-pitch it through the same path a grace uses (`slotLookup` learns to find the ids).

## 3. Phases, one at a time, his UI check between each

- ✅ **P0: model + ops + JSON** (2026-09-23). The types; `utils/bracketedGraces` (reads + the fresh-id copy,
  which `cloneGraceFresh` now also runs on a grace's list); `models/bracketedGraceOps` (add · second head ·
  remove · re-spell · find · `bracketedProblems`, warned by `loadJSON`); `commands/bracketedCommands`; the
  relay (`slotFieldTravel` rows, `rebar` before → first piece / after → last, the tie-collapse's ends,
  `rebarOps`, `slotPlacementOps`, `voiceOps`). ⭐ `findSlot` does NOT know a bracketed pitch, so every
  existing mutator refuses one (fail closed). A chord silenced to a rest drops its own (logged, B10).
  Poke it with `__bracketed.add('before', 'Bb3')` on a selected note, `.list()`, `.roundTrip()`.
  ⏭️ Left for P2, on purpose: a paste's "what landed" selection does not include bracketed ids yet — the
  selection cannot resolve them until `slotLookup` learns them.
- ✅ **P1: drawn BEFORE a main note** (2026-09-23). Black head at `BRACKETED_SIZE_RULES`
  (house 2/3), accidental inside, ledger lines at its scale, the brackets in either FORM (`BRACKET_FORMS`):
  `notehead` (SMuFL E0F5/E0F6 at the head's size) or ✅ `gould`, ARMED by his call (E26A/E26B at FULL size: her
  brackets measure ≈2.07 sp, §G.4, which is THIS pair, not the notehead pair at her head's size). The
  room: the before side is ONE `'grace'` ink box, `[grace group] [brackets] M`. Its sign is read against
  the bar at its place and ⛔ puts nothing in force (a bracketed F after an F♯ shows ♮; a B♭ after a
  bracketed B♭ still shows its flat). Silent; no hit box yet (P2). Rows for his eye:
  `__bracketed.size('gouldTrill')` · `__bracketed.form('gould')` · `__bracketed.reset()`.
  ⚠️ Gaps `toMain` 0.9 (Gould p. 139, the after side mirrored) · `between` 0.4 and `toGrace` 0.8
  (UNSOURCED) · `parenToAccidental` 0.2 (Gould). A chord's heads share one column with no
  second-displacement and unstacked signs — his eye in use. ⏸️ Glyph vs drawn bracket on a ledger note (B9).
- ✅ **P2a: entry** (2026-09-23). The `bracket.` button arms a `bracketedGrace`
  stamp (`stamps/bracketedGraceTool`); a click puts one before the note — ⭐ or the REST (B10 reversed; a
  whole-bar rest becomes a one-beat rest first) — nearest the GHOST, at the click's pitch, spelled as note
  entry spells it (`stamps/bracketedStamp`). The click reaches it through the grace stamp's door
  (`graceStamp`), ⛔ not a new line in `MouseController` (its hub ceiling is full). A ghost of the head in
  its brackets, the armed sign inside (`ghosts/BracketedGhost`, reading `bracketedLayout`). ⏳ A press
  arms the stamp whatever is selected — what it does with a NOTE selected is found by trying it (D6).
- ✅ **P2b: selection, arrows, Delete** (2026-09-23) — his pick of the two shapes:
  a `{ bracketed: true }` opt-in on `slotLookup.findSlot` (⛔ `attackOf` is NULL for one: no mark is struck
  with information), the projection in `noteProjection.projectBracketedNote`, and ONE admitting line each in
  `ScoreModel.getNote` / `getNotePitch` / `updateNote` (pitch-only, the grace's branch). Each head is a NOTE
  in the registry under its pitch id (no beat, the grace's reason) and its group is in the member map (the
  highlight; a replayed bar files it through `fanMemberIdsOf`). Delete removes it as itself — alone
  (`deleteNoteOps`) or in a range, IN PLACE (`clearOps`: it leaves no hole). A duration key changes its HEAD
  (`NoteEntryCoordinator`, `selectionWrittenValue`), ⛔ never the bar. A paste hands its ids back.
- 🔨 **P3: on a GRACE, and the split** (built 2026-09-23, ⏸️ his UI check). The stamp reads a grace group as
  the grace stamp does (`graceTargetAt`): a click in a gap puts the bracket before the grace to its RIGHT
  (the pre-bend into it), a click on a grace before THAT grace, a click past the last grace before the
  note. `graceBeamRuns` breaks at a grace carrying one; the slash was already drawn per beam, so each
  run keeps the group's one form. `beforeSideLayout` lays the group out RUN BY RUN from the right —
  `[run] (●) [run] (●) M` — as ONE grace layout in the group's order, so `GracePass` is unchanged.
  Deleting the bracket joins the beam again: nothing but the bracket was stored (B4).
- ✅ **A selected NOTE becomes a bracketed grace** (2026-09-23, his rule: *"if a note is selected and we
  press the bracket this note becomes a bracket and we fill the note slot with a rest of it duration,
  similar to grace"*). The `bracket.` press with notes selected arms nothing: each note's slot becomes a
  rest of its length and its pitches (ids kept, a chord → a bracketed chord) a bracketed grace before it,
  written at the note's value; its dots and articulations go, logged (`models/noteToBracketedOps`). ONE
  undo entry; what was made is the selection.
- ✅ **A selected GRACE becomes a bracketed grace** (2026-09-23, his rule: *"when a grace note is selected and i
  hit bracket button we convert that into a bracket and the target is what we have to the right, other
  members of the grace group remains"*). Its target is the NEXT grace of its group — so the beam splits
  there (B4) — or, for the last, the slot itself. It keeps its pitches (ids) and written value; ⛔ its dots
  and articulations go, logged. It stands FIRST in its target's list, where it stood, with the brackets bent
  into it still in front; a slur on it moves to the target (one collapsing to a single note goes). ⛔ The
  last grace of a group AFTER is refused — nothing of its own stands to its right
  (`noteToBracketedOps.graceToBracketed`).
- ✅ **A selected bracketed grace becomes a GRACE** (2026-09-23, his rule: *"if a bracket is selected and we
  press any grace button we convert the bracket into a grace maintaining it targets: if the target is a grace
  we just make the bracket part of the grace group at that position"*). Target a grace → it joins that group
  just before it; target the note (or rest) → the note's group, last; AFTER → the after group, first. ⭐ The
  group it joins takes the PRESSED form (his follow-up: *"when the bracket joins the group also transfomr it
  type"*). The picture keeps its order: brackets left of it bend into the new grace, those right of it stay
  on the target (`noteToBracketedOps.bracketedToGrace`, routed from `stamps/graceTool`).
- ✅ **…and the way BACK** (2026-09-23, his rule: *"when a bracket is selected and I toggle of the button then
  we get the target maintain the duration but repitch it (similar to grace) and then of course the bracket
  is gone"*). With nothing armed, a SELECTED bracketed grace lights `bracket.` (his report: *"i dont see the
  state in the bracket pallete button"*); pressed, its TARGET takes its pitch and keeps its value — a rest
  becomes the note (so note → bracketed → off is the note back), a note is re-pitched (duration and marks
  kept), a grace is re-pitched (its value kept) — and the bracketed grace goes; others on the target stay
  (`noteToBracketedOps.bracketedToNote`).
- **P4: the conversions.** What a target becoming a rest, a grace becoming a note (and back), or a
  chord losing the head does to its brackets. ⏳ Each is his call when reached. The first default is
  that the bracket goes with its target where the target survives, and is dropped (logged) where it
  does not. (✅ already decided: a note silenced keeps its `bracketedBefore` on the rest, and a note
  taking a rest's place takes the rest's — B10 reversed, `restGraceOps`.)
- 🔨 **Its horizontal OFFSET** (built 2026-09-23, ⏸️ his UI check — his ask: *"horizontal offset to the bracket
  similar to [grace] on drag horizontal, ctr arrow and in the properties … (we need also ctr backspace)"*).
  The grace's offset exactly: keyed by its FIRST pitch id (`slotLookup.offsetTargetOf`), ink only — the room
  stays; its hit box moves with it; its own row in the redraw key. A horizontal DRAG offsets it
  (`bracketedCommands.previewOffset` / `commitOffset`, one undo entry on the drop); it has no column, so
  Ctrl+←/→ offset it and Ctrl+Backspace resets it (`noteOffsetKeys`); the Properties window reports it as
  `bracketed`, with the offset row. Removed or toggled off, its offset goes with it.
- ⏭️ **FUTURE — the side in PROPERTIES** (his proposal, 2026-09-23 — ⛔ not built, recorded here so it is
  not lost): *"in the properties we will have a way to place the bracket before or after the target,
  default is before as now and the user can change it in properties"*. So the stamp keeps entering it
  BEFORE (today's default), and the Properties window moves a selected bracketed grace to the other side
  of the same target — an op that takes it off one list and onto the other (`bracketedBefore` ↔
  `bracketedAfter`), refused where the target has no after side (a grace, a rest — B5). It needs P2b's
  selection and P5's drawing of the after side first.
- **P5: AFTER** (the trill note, the bend target). The chord's right ink and its room. ⚠️ Gould p. 139
  puts it *"where there is more room"* and moves it to a tied second note rather than cramp a short one.
  That is a placement rule for later, ⛔ not this phase.

## 4. Deliberately NOT in this plan

- **What it means to playback.** A trill reading its interval from a bracket, or a bend from it, is
  the reader's own feature. B6 only says the head is silent.
- **MusicXML.** A pre-bend exports as `<bend><pre-bend/>` on its target and a trill note as the trill's
  interval (§0.9). Import has to rebuild the bracket. That belongs with the importer.
- **Two grace groups with nothing between them** (B4), and any beaming beyond the split.
- **The Keypad key**, the menus, the Properties window.
- **Brackets around an ordinary note** (a ghost or optional note). If it comes, it reuses the geometry
  module in `engrave/notes/bracketedGrace.ts`, not this model.
