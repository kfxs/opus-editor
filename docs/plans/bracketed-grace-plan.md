# The bracketed grace — a black head in round brackets, no stem, no flag: the plan

> **Status: PLANNED (2026-09-23), nothing built.** The only code is the dev toolbar's `bracket.` button,
> which logs and does nothing else, and the Keypad's Grace-page key `-` (`bracketed grace`), which is
> drawn but not wired (`docs/research/sibelius-keypad.md`).
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
| **B7** | **what is drawn** | ⏳ proposed, every number a row | a **black** head whatever its target's value (Gould 418), so **no written value is stored**; ⛔ no stem, flag, dot, beam or slash. **Size** is its own row, `BRACKETED_SIZE_RULES`, defaulting to the grace's `house` 2/3 (presets: Gould trill ≈0.75 · Gould bend ≈0.65 · MuseScore 0.7 · LilyPond 0.63 · Sibelius 0.6) | Gould disagrees with herself (0.75 vs 0.65, §G.4), which is why this is a row of its own: choosing Gould's trill must not resize every grace |
| **B8** | **the accidental: inside the brackets** | ⏳ proposed default, a row | `( ♭● )` (books: all; MuseScore, LilyPond). The other row is `♭( ● )` (Verovio, VexFlow) | the one real split among the engines (§H.0). MusicXML cannot tell the two apart |
| **B9** | **the brackets: the font's glyphs** | ⏳ proposed | one pair per HEAD (Stone 76: a chord is stacked pairs), `noteheadParenthesisLeft/Right` E0F5/E0F6, which all three shipped faces carry (§H.6) | MuseScore draws a bezier sized from the heads so it can grow around ledger lines (Gould 388). That is the upgrade if the glyph looks wrong on a ledger note, found in use (his rule above) |
| **B10** | **no bracket on a REST** | ⏳ proposed | a rest is never a target | there is nothing to bend into or trill. (A grace group may sit on a rest, D7 of the grace plan. A bracket on that group's grace is fine, because its target is the grace) |

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
| the commands (undo labels, one `mutate`) | `engine/commands/bracketedGraceCommands.ts`, reached as `engine.bracketed.…` |
| the pure reads (lists of a slot, of a grace) | `utils/bracketedGraces.ts` (in `utils/` for the relay, `graceNotes`' reason) |
| its ROOM, in staff spaces | `layout/bracketedRoom.ts`, asked by `layout/graceRoom` for the before side |
| its geometry (head, accidental, the two glyphs) | `engrave/notes/bracketedGrace.ts`, pure |
| its drawing | `rendering/BracketedGracePass.ts`, inside the grace's `scaling(k)` idea (its own k, B7) |
| the stamp and its button's light | `interactions/stamps/bracketedGraceTool.ts`; a `{ kind: 'bracketedGrace', side }` joins `MarkingTool` |
| the split | ONE rule in `engrave/notes/graceBeam`'s `graceBeamRuns`: a grace with `bracketedBefore` starts a run |

**Selection** is nothing new: its pitches have ids, so a click selects it as a note and the arrows
re-pitch it through the same path a grace uses (`slotLookup` learns to find the ids).

## 3. Phases, one at a time, his UI check between each

- **P0: model + ops + JSON.** The types, `bracketedGraceOps`, the relay, the problems check, specs.
  Nothing drawn. Poked from the console (`__grace`-style) to prove the round trip.
- **P1: drawn BEFORE a main note.** Black head at its size row, accidental inside, the glyph pair,
  ledger lines at its scale. Room reserved: the before side's ink is `[grace group] [brackets] M`.
  Silent (B6). ⏸️ His eye on a ledger note decides glyph vs drawn bracket (B9).
- **P2: entry.** The `bracket.` button arms the stamp; a click on a note puts one before it at the
  click's pitch. Selection, arrows, Delete. ⏳ What a press does with a NOTE selected is found by trying
  it, as D6 was for the graces.
- **P3: on a GRACE, and the split.** A click on a grace targets it. `graceBeamRuns` breaks, and the
  slash is drawn per run. Deleting the bracket re-joins the beam (B4, the merge for free).
- **P4: the conversions.** What a target becoming a rest, a grace becoming a note (and back), or a
  chord losing the head does to its brackets. ⏳ Each is his call when reached. The first default is
  that the bracket goes with its target where the target survives, and is dropped (logged) where it
  does not.
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
