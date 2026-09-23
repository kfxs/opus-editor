# The parenthesised note — a head in brackets, still a real note: the plan

> **Status (2026-09-23): P0 BUILT** (the model — `NotePitch.enclosure`, `models/enclosureOps`,
> `commands/enclosureCommands` as `engine.enclosure`, the load report, the copy sites). Nothing is DRAWN
> yet: P1 is next. The research is `docs/research/parenthesised-note-research.md` (§0 = the synthesis). ⛔ This plan is where the decisions get made: §0 marks each one
> ✅ DECIDED (his word, with the date) or ⏳ PROPOSED. A proposed row is a default, not a decision.
> N3 · N6 · N11 were his calls, made 2026-09-23 (§4).
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
| **N10** | **not selectable on its own** | ⏳ proposed | clicking the brackets selects the NOTE; Delete deletes the note; the button toggles them off. No new `SelectedElement` kind | one fewer kind before he has used it; it can become an element later (Properties, a drag) if use asks |
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
- **P1: seen on the page.** The dev button (selection → toggle), and a single full-size head with no
  accidental and no dots drawn in brackets, with its room. ⏸️ His eye: the form (N8) and gaps (N9).
- **P2: the rest of a normal note.** Accidental and dots inside (N4), a chord's pair per head (N3), a
  second's displaced head, ledger lines, both stem directions, a bar's first note (the barline gap).
- **P3: graces.** `GracePass` + `graceRoom`, at the grace's scale.
- **P4: selection ink.** The highlight colours the brackets with their note.
- **P5: the chord switch (N3).** `enclosureSpan`, one tall pair round the bracketed heads, and its Properties control.
- **Later, only when asked:** the Keypad `1` key; a Properties control; `'square'`; rests; a playback
  meaning (N6); a tie-chain option (N11); Dorico's per-head "break bracket".

## 4. His calls (2026-09-23)

1. **N3: a chord** — ✅ both, a Properties switch, default one pair per head (P5).
2. **N6: the sound** — ✅ plays as written, for now.
3. **N11: a tie chain** — ⏸️ deferred; the selection decides.
