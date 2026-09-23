# The parenthesised note — a head in brackets, still a real note: the plan

> **Status (2026-09-23): P0–P4 committed; P4b BUILT** (the stamp, the entry brackets, both ghosts), ⏸️ his UI
> check. Next: P5 (the chord switch). The `paren.` button (dev
> toolbar, `Note:` group) toggles brackets on the selected notes; `layout/headEnclosure` places them and
> reserves their room; `rendering/EnclosurePass` stamps them (called from `GracePass.drawGraceNotes`, the
> lane's one pass over the drawn notes — a call in `ScoreRenderer` itself counts a `clef` word against
> `lint:hubs`). The research is `docs/research/parenthesised-note-research.md` (§0 = the synthesis).
>
> ⚠️ **The UI is the dev shell's** (`src/dev/devToolbar.ts`), his call: a dedicated button first. The
> Keypad's Grace-page key `1` (`parenthesised note`, `docs/research/sibelius-keypad.md` §3b + §6) stays
> a picture until he says otherwise.
>
> ⚠️ **Not the bracketed grace** (`docs/plans/bracketed-grace-plan.md`). That is a stemless head that
> is NOT a note: information beside a target, silent, never counted. A parenthesised note is an
> ordinary note, counted in the bar, with a stem, beam and dots, that also wears brackets. The two can
> share the bracket GLYPHS and the sourced GAPS (`layout/bracketedRoom`), never the model.

---

## 0. The decisions

| # | decision | status | proposed | why (research §0 row) |
|---|---|---|---|---|
| **N1** | **a property of the HEAD, not a new element** | ⏳ proposed | a field on `NotePitch`: the brackets are something a head WEARS, like `forceAccidental` | his instinct (*"parenthesis is like a modifier to the note"*). Per head is what MusicXML (`<notehead parentheses>`), Verovio, MEI's note and Sibelius's F8 store, and what every format round-trips. ⭐ `NotePitch` is what a chord's `notes`, a grace's `pitches` and a fan member's `pitches` are all made of, so normal notes AND graces get it from one field |
| **N2** | **its type: the SHAPE, not a boolean** | ⏳ proposed | `enclosure?: HeadEnclosure`, `type HeadEnclosure = 'round'` today. **Absent = no brackets**, the only spelling of "none" | his point, and all three parts agree: MEI `@enclose` is ONE enum that grew (`paren`, `brack` → `+ box`, `none`), Dorico has Round / Square; MusicXML is the cautionary tale — a new BOOLEAN per shape. `'round'` / `'square'` are Dorico's plain names (MEI says `paren` / `brack`). ⚠️ SMuFL has **no square notehead bracket**: a `'square'` will draw the accidental's E26C/D or a drawn line (Dorico draws it) |
| **N3** | **a chord: one pair per head, OR one pair round the bracketed heads — BOTH** | ✅ 2026-09-23 | ⭐ both drawable, switched in **Properties**; **default: one pair PER HEAD**. His words: *"we should be able to draw both and probably we can change on the properties from one to another: default maybe one per note"*. Storage stays per head (N1); the switch is a CHORD-level row, ⏳ proposed `Chord.enclosureSpan?: 'chord'` (absent = per head, the only spelling of the default) | the research SPLITS: Gould draws BOTH in one figure (p. 634) with no rule; Stone p. 76 per head; Dorico, MuseScore, LilyPond (on request) one pair; Verovio per head |
| **N4** | **what the brackets enclose** | ⏳ proposed | `( ♭●. )`: the **accidental**, the **dots** and the head's **own ledger line** INSIDE; the **stem** and **ties** OUTSIDE | ✅ all three agree (Gould pp. 337, 610, 634, 497 + measured ledgers pp. 308, 337; MuseScore; LilyPond; Sibelius). ⚠️ This REVERSES the draft's "dots outside" |
| **N5** | **which heads may wear it** | ⏳ proposed | a chord's heads, a **grace note's** heads (his ask), a fan member's heads (free, the same `NotePitch`). ⛔ **Not a bracketed grace**: already in brackets, the op refuses. ⛔ **Not a rest** for now: a rest has no `NotePitch` | graces: Sibelius *"including grace notes"*; no book addresses it. Rests: Gould p. 610 brackets them, MEI and LilyPond can — a later phase, a field on `Rest` |
| **N6** | **it SOUNDS, as written** | ✅ 2026-09-23 | playback unchanged. His words: *"for the moment it play normal, i dont know if in the future we change it"*. A later change is a playback ROW, ⛔ never stored on the note | three answers in the research: engines play it (MuseScore adds a `GhostNote` articulation); Dorico and Guitar Pro play it quieter; the books' uses are notes not struck again (Gould pp. 308, 337, 610) |
| **N7** | **it is part of the bar's accidental state** | ⏳ proposed | the running-accidental rule reads it like any note | nothing in the research treats it otherwise; a restated note repeats its sign anyway |
| **N8** | **the glyphs: the accidental pair** | ⏳ proposed | `BRACKET_FORMS.gould` (`layout/bracketedRoom`): `accidentalParensLeft/Right` E26A/E26B at FULL size, centred on the head. Its own armed form, separate from the bracketed grace's | ✅ Gould's measured brackets on a full head are **≈2.0 sp** tall and 0.53–0.55 wide; Bravura's accidental pair is 1.98 × 0.564. Verovio and LilyPond draw this pair; ⛔ no engine draws with the notehead pair E0F5/E0F6 (1.45 sp, sized for one head) — only VexFlow did. ⚠️ REVERSES the draft |
| **N9** | **the gaps: its OWN rows** | ⏳ proposed | `(`→♭ **0.53**, ♭→head as the accidental's own gap, head→`)` **0.53**, `(`→head (no sign) **0.72**, ledger→`)` ≈0.15–0.6 (measured) — rows in `layout/headEnclosure`, ⛔ not the bracketed grace's | ⚠️ the bracketed grace's `parenToAccidental` 0.2 was measured on a SMALL head; Gould's full-size heads (pp. 308, 337) measure 0.53. A grace (P3) may read the bracketed grace's rows — his eye |
| **N10** | **the brackets are SELECTABLE on their own** | ✅ 2026-09-23 ⚠️ **REVERSED** (his ask: *"i want to be able to select just the parenthesis too so i can remove it with delete key"*) | a kind of its own, `headEnclosure` (the head's pitch id): a press on either bracket selects the pair — nearer the HEAD it stays the note's, the dot's rule; Delete takes them off and the note stays selected; one undo step. `interactions/elements/enclosure` (hit + highlight), a row in `ELEMENT_SPECS` and in `ELEMENT_HIT_ORDER` after the accidental. ⚠️ Named `headEnclosure`, not `enclosure`: `lint:hubs` reads every kind name as a word and would count each `engine.enclosure` in `MusicEngine` | the first answer (*one fewer kind before he has used it*) was mine; his use asked for it the same day |
| **N11** | **a tie chain** | ⏸️ 2026-09-23, deferred (*"this can wait … it is not so important"*) | the button brackets exactly the heads selected — nothing follows the tie | Dorico brackets the FIRST head by default, with "until end of tie chain"; Gould and Stone bracket the RESTATED (tied-to) note |

---

## 1. The model: `types/notes.ts`

```ts
/** The brackets a head is drawn in. One member today; `'square'` is the next (N2). */
export type HeadEnclosure = 'round'

// On NotePitch:
//   enclosure?: HeadEnclosure   // absent = none
```

- **Absent, never `undefined`-valued**: `laneFingerprint` (the width-cache key) stringifies the slot,
  so the op DELETES the field to remove the brackets.
- **Flat `Note`** (`noteProjection`) projects it, as it does `forceAccidental`, so the Properties report
  and `getNote` can see it.
- ⚠️ **What travels**: anything that copies a pitch with a spread keeps it for free. The sites that
  copy pitch fields ONE BY ONE must learn it (e.g. `rebarOps` ~1662 copies `displayStaffId` by name;
  `PitchInsert` lists fields). P0 is an audit of every explicit copy of `forceAccidental` /
  `displayStaffId`: the same list is where `enclosure` has to go.
- **JSON**: reported, never repaired: an `enclosure` on a bracketed grace's pitch, or an unknown
  shape, is a problem the load reports.

## 2. Where the code goes (`CLAUDE.md`: a new feature adds a MODULE)

| module | what it answers |
|---|---|
| `engine/models/enclosureOps.ts` | `setEnclosure(score, pitchIds, shape \| null)`: finds each head with `findSlot(…, { fanMembers, graceNotes })`, refuses a bracketed grace's, writes or DELETES the field |
| `engine/commands/enclosureCommands.ts` | the editor's half: the ops call, then ONE `mutate('Parentheses')` for undo. The facade gains one line (`engine.enclosure`) |
| `engine/layout/headEnclosure.ts` | ⭐ **ONE function answers the ROOM and the INK** (the `dotGap` / `accidentalGap` rule): given a head, its drawn sign, its width, its dots → where `(` and `)` stand, where the accidental moves to, how far left and right the ink now reaches. Holds the forms' arming and its own rows |
| `engine/layout/measureColumns.slotInk` + `spacingPadding` | a row, not a constant: the brackets are left ink (outside the accidental) and right ink (outside the dots) — ⚠️ MuseScore makes them take room; LilyPond only when they would collide (research A.3). Proposed: take room, as the accidental does |
| drawing, a normal note | ⏳ either an `EngravedModifier` (`EngravedParenthesis`, attached by `NoteBuilder` like `EngravedAccidental`, formatted in `modifierColumns`, where `'Parenthesis'` already sits in `NO_RULE_KINDS`), or a pass that stamps after the notes, as `BracketedGracePass` does. The modifier fits the accidental column; the pass is simpler and keeps `NoteBuilder` out of it. ⚠️ VexFlow's modifier order files `Parenthesis` BEFORE `Accidental` (brackets INSIDE the accidental), the opposite of N4 — so the modifier route is not a straight port. ⏳ Leaning: the pass |
| drawing, a grace | `GracePass` stamps its heads and accidentals itself, at the group's scale: it stamps the brackets from the same `headEnclosure` answer. `graceRoom` reserves the room |
| `interactions/stamps/enclosureTool.ts` | `pressEnclosure` / `enclosureLit`: what the button does to the selection and when it is lit. `devToolbar` gets ONE `toggle(…)` row, as the grace buttons are wired |

## 3. Phases (each stops for his UI check)

- ✅ **P0: the model.** ⭐ Found on the way: the relay MERGED a tie chain whose heads matched in
  pitch only (`utils/rebar` `pitchesEqual`), so `C` tied to `(C)` came back with one set of brackets
  for every piece. The brackets are now part of the match. Type, field, projection, the ops, the command with undo, the JSON check, the
  audit of the pitch-copy sites. Specs: the op on a chord head, a grace head, a fan member; the refusal
  on a bracketed grace; undo; copy/paste and rebar keep it.
- ✅ **P1: seen on the page** (built 2026-09-23, ⏸️ his eye: the form N8 and gaps N9). The dev button
  (selection → toggle, notes and graces selected alike — a grace's brackets are not DRAWN until P3), and
  the brackets round a chord's heads with their room. Went further than planned, since the layout had
  to know the chord's ink anyway: the accidental, dots and head's own ledger are already INSIDE (N4),
  a chord's pairs stand in two straight columns (they clear the WHOLE chord, MuseScore's rule), and a
  grace before / bracketed grace after a bracketed note clears the brackets. ⚠️ The accidental still
  stands at its OWN gap from the head (the house row), not Gould's 0.53; a stem-down chord's displaced
  second is not counted on the left — both P2.
- ✅ **P2: the rest of a normal note** (built 2026-09-23, ⏸️ his eye). On top of P1's accidental, dots,
  ledger and chord columns:
  - a **stem-down second** pushes `(` out by the displaced head (its head stands LEFT of the anchor,
    `engrave/notes/noteGeometry.displacedHeadRoom`); a stem-up one pushes `)`;
  - ~~an **up-flag** pushes `)` past it by MuseScore's hook padding, 0.3 sp~~ — ⛔ **REVERSED 2026-09-23 by
    his eye** (screenshots: *"notes with flag and dot in parenthesis dont look good … with stem down look
    good but not with stem up"*). The brackets hug the HEAD and the stem leaves through the top of `)`, as
    Gould draws it (p. 308, a stemmed semiquaver). The flag is not counted. 🚨 **And the real bug**, found by
    MEASURING in Chromium when that alone did not fix it (his ask: *"reproduce the error and measure"*): a
    stem-up FLAGGED note draws its DOT past the flag (2.5 sp, against the unflagged 1.7), and `)` had been
    placed for the unflagged dot — ON the dot. The layout now asks the dot rule itself (`layout/noteDotXs`,
    lifted out of `graceRoom.graceDotXs` unchanged); measured after: dot → `)` 0.55 sp flagged, 0.53 not;
  - a **tie** runs OUTSIDE the brackets (Gould p. 610; MuseScore): it leaves 0.2 sp past `)` and lands
    0.2 sp short of `(` (`TIE_BRACKET_CLEARANCE_SP`, ⏳ unsourced, a row). `TieRenderer` asks
    `headEnclosure.chordEnclosure`, the same layout the drawing used;
  - a bar's FIRST note: the lead-in already merges every ink box of the opening column, so the barline
    clears `(` with no change.
  - ⏳ **Left as it is, for his eye:** the accidental keeps the house gap from its head (Gould's p. 337
    measures 0.53 inside brackets); two VOICES in one column each place their own brackets, not against
    each other.
- ✅ **P3: graces** (built 2026-09-23, ⏸️ his eye). `graceRoom.graceEnclosure` runs the NOTE's rule on a
  grace's heads — its own dots (`graceDotXs`), its own flag (none when beamed; a stem-down flag hangs clear)
  — in the grace's own staff spaces, scaled with the grace (D5: *everything* a grace draws is at its size).
  `graceLayout` packs each grace with its brackets as its outermost ink (the `between` gap then runs from
  `)`); `GracePass` stamps them through `EnclosurePass.stampEnclosure` (the one place a pair becomes ink)
  INSIDE the grace's own member group — so the selection highlight already colours a grace's brackets.
  ⏳ His eye: brackets SCALED with the grace (the bracketed grace's `gould` form is full size — a row if he
  wants the same here).
- ✅ **P4: selection ink** (built 2026-09-23, ⏸️ his eye). Each head's pair is its own group,
  `enclosure-<pitchId>` (`EnclosurePass.enclosurePairId`); the selected-NOTE pass calls
  `interactions/elements/enclosure.paintNoteEnclosure`, which finds it in the score's `<svg>` by id (the
  key signature's way) and fills both glyphs in the voice colour — THIS head's pair only. A grace's pairs
  stand loose in its member group (its highlight colours direct children, skipping nested groups), so
  they were lit since P3.
  - ⭐ His report (a screenshot): on a WHOLE note `)` sat on the head — the layout took every head as a
    quarter's. `EnclosedChord.duration` now gives the head its own width (the house quarter row plus what
    this head's glyph adds over a quarter's), so a quarter did not move.
- ✅ **P4b: the STAMP and the ENTRY mark** (built 2026-09-23, ⏸️ his eye) — his rules, 2026-09-23:
  - *"if nothing selected and nothing armed and we chose parenthesis we stamp just parenthesis"* — `paren.`
    ARMS a brackets stamp: each click on a note or a grace brackets it; the stamp stays armed; a re-press
    disarms. ✅ *"clicking an already-bracketed note with the stamp, dont toggle anything is like clicking a
    sharp on a note that already has a sharp"* — the stamp only ever ADDS (the Delete key, or `paren.` with
    the note selected, takes them off).
  - *"if a duration is armed and we chose parenthesis we arm note stamp with parenthesis and other things
    armed"* — in NOTE ENTRY, `paren.` arms an entry value (`selectedEnclosure`, the tremolo's
    `selectedTremolo` twin): every note entered is born in brackets, alongside the armed accidental,
    articulations, dots, tremolo. It persists, like the tremolo.
  - With NOTES selected, `paren.` toggles them, as since P1.
  - ⚠️ `MouseController` sits at its `lint:hubs` line ceiling (1076/1076), and the stamp's dispatch line and
    the entry value's two call sites are lines there. So the TREMOLO stamp's click leaves it first for
    `interactions/stamps/tremoloStamp` — where every newer stamp already lives, no behaviour change — which
    makes the room instead of raising the ceiling. ✅ Net: 1076 → 1057 lines, 277 → 258 kind words; the
    ceilings lowered to match.
  - Built: `stamps/enclosureTool` (the five-way press), `stamps/enclosureStamp` (the click), `selectedEnclosure`
    threaded through `NoteParams` → `ScoreModel.addNote` → the split across a barline (every piece, as the
    tremolo) → `addNoteAtPosition` / the typed note; the stamp's ghost `ghosts/EnclosureGhost` (the pair at
    the pointer) and the NOTE ghost wearing the entry brackets (`GhostNote.enclosure`).
  - 🚨 His reports while it was built: the stamp's ghost LEAKED (one pair left per pointer move — its class
    was missing from `GHOST_GROUP_SELECTOR`; the spec stubs `getBBox`, since jsdom's missing one made every
    sign ghost remove itself and HID the leak), and the entry ghost showed no brackets (now drawn inside the
    note ghost's own group).
- **P5: the chord switch (N3).** `enclosureSpan`, one tall pair round the bracketed heads, and its Properties control.
- **Later, only when asked:** the Keypad `1` key; a Properties control; `'square'`; rests; a playback
  meaning (N6); a tie-chain option (N11); Dorico's per-head "break bracket".

## 4. His calls (2026-09-23)

1. **N3: a chord** — ✅ both, a Properties switch, default one pair per head (P5).
2. **N6: the sound** — ✅ plays as written, for now.
3. **N11: a tie chain** — ⏸️ deferred; the selection decides.
4. **P4b: the stamp on a bracketed head** — ✅ nothing: the stamp only adds (his word, like a sharp on a sharp).
