# The parenthesised note — research (engines · books · industry)

> **2026-09-23.** For `docs/plans/parenthesised-note-plan.md`. Three parts, researched in parallel:
> **A** the engines' source (`~/dev/engine-sources/`: Verovio, MuseScore, LilyPond) · **B** the books
> (`reference/`) · **C** the formats and commercial apps (online). ⭐ §0 is the synthesis and records
> where the parts CONTRADICT each other or the plan.
>
> ⚠️ **Read with** `docs/research/grace-notes-research.md` **Part H** (lines ~3602–3990). A bracketed
> grace is *brackets on a head* + *no stem* + a role, so Part H already holds the general mechanism in
> all three engines: MuseScore's bezier and its 0.3 / 0.15 sp paddings (§H.1.3), Verovio's E26A/E26B at
> `x−r` / `x+2r` (§H.2.2), LilyPond's `Parentheses` grob (§H.3.1), the SMuFL glyph measurements (§H.6),
> the MusicXML import (§H.1.5, §H.2.3). This document does not repeat those; it adds what Part H did not
> ask. And `docs/research/sibelius-keypad.md` §3b: Sibelius's F8 `1` brackets any notehead, grace
> notes included, and the accidental goes inside.
>
> Citations to MuseScore are under `MuseScore/src/engraving/` unless they begin `importexport/` or
> `notation/`. "Derived" = an inference from the code, not stated by it. `sp` = staff space.

---

## 0. Synthesis

| question | engines (A) | books (B) | formats + apps (C) | ⇒ for the plan |
|---|---|---|---|---|
| **where it lives** | MuseScore: a bool on the note + a chord-owned group; Verovio: `head.mod` per note; LilyPond: per grob, or one id per chord | per head, or per chord — both drawn | MusicXML per note; MEI `@enclose` on note OR chord; Dorico per head, merged into one bracket per chord | ✅ agree: stored PER HEAD (round-trips to MusicXML); a whole-chord pair is a DRAWING rule over it |
| **its type** | MuseScore: no shape (round only); Verovio / MEI: an enum; LilyPond: stencils as data | round for notes; square only on accidentals (editorial) | MEI `paren/brack/box/none` (grew v4 → v5); Dorico Round / Square; MusicXML a boolean per shape | ✅ agree: an enumerated SHAPE, ⛔ not a boolean. ⚠️ SMuFL has no square NOTEHEAD bracket |
| **accidental** | inside (LilyPond, MuseScore) | **inside** (Gould 337, 634) | inside (Sibelius); Dorico UNKNOWN | ✅ agree: inside |
| **dots** | inside (MuseScore, LilyPond) | **inside** (Gould 610, 497) | Finale plug-in counts them | ✅ agree: inside |
| **ledger line** | — | the head's OWN ledger inside (measured) | Finale plug-in counts them | inside |
| **stem, ties** | stem unchanged; MuseScore's tie leaves after `)` | stem OUTSIDE; ties OUTSIDE (Gould 610, 337) | — | ✅ agree |
| **a chord** | MuseScore: one pair for a contiguous run; LilyPond: one per chord if asked; Verovio: per head | ⚠️ **both**, in the SAME figure (Gould 634) — no rule | Dorico + MuseScore docs: one tall pair, split at gaps | ⚠️ open — **his call**. Engines and apps lean to one pair; the books show both |
| **size** | Verovio's accidental parens ≈2 sp; LilyPond fixed glyphs; MuseScore grows | **≈2.0 sp** tall on a full head, 0.53–0.55 wide, centred on the head; grows round a chord (≈5.3) | Bravura: notehead pair 1.45 sp, accidental pair 1.98 sp | ✅ the ACCIDENTAL pair (≈1.98) matches Gould's measured 2.0 — the `gould` form. ⛔ No engine draws with E0F5/E0F6 |
| **gaps** | MuseScore 0.3 / 0.15 inner (§H.1.3); LilyPond 0.2 | full size: `(`→♭ 0.53, ♭→head 0.53, head→`)` 0.53, `(`→head 0.72 | — | ⚠️ **contradicts reusing** the bracketed grace's `parenToAccidental` 0.2 (measured on a SMALL head): a full-size head wants its own rows |
| **sound** | MuseScore: `GhostNote` articulation (effect UNKNOWN); Verovio / LilyPond: plays | ⚠️ **every use is information, NOT a new attack**: a held / restated / other-hand note is not struck again | Dorico: quieter (partly verified); Guitar Pro ghost: quieter | ⚠️ **three answers** — plays / quieter / not struck. **His call**; a playback row, ⛔ never stored on the note |
| **tie chains** | MuseScore's tie clears the brackets | the brackets go on the RESTATED (tied-to) note | Dorico: the FIRST head by default, "until end of tie chain" optional | ⚠️ opposite defaults — but ours brackets the head the user picks, so it is only a question for a "whole chain" option |
| **rests** | LilyPond yes; Verovio via `@enclose`; MuseScore no | **yes** (Gould 610) | MEI yes; MusicXML no | later phase |
| **accidental-only brackets** | a separate feature everywhere | a separate feature (Gould 83, Stone 55, G&L 4–5) | separate everywhere | ⛔ out of scope — a different field on a different thing |


---

## Part A — The engines (source read, 2026-09-23)

### A.1 The data model

**MuseScore: the brackets are elements owned by the CHORD, grouped by notes.**
- One generic `Parenthesis : EngravingItem`, with only a `direction` (LEFT / RIGHT). **No shape enum**:
  a note's brackets can only be round (`dom/parenthesis.h:27-68`).
- Round vs square exists only on the **accidental**: `AccidentalBracket { NONE, PARENTHESIS, BRACKET,
  BRACE(deprecated) }` (`dom/accidental.h:219-224`). "Add brackets" / "Add braces" act on accidentals
  only (`notation/internal/notationinteraction.cpp:5400-5410`).
- On the note: a `bool m_hasParens`, read and written through `ParenthesesMode`, BOTH or NONE only
  (`dom/note.cpp:3137-3138`, `:3245-3249`, `:4029-4033`).
- The drawn pair lives on the chord: `NoteParenthesisInfo { leftParen, rightParen, vector<Note*> notes }`
  (`dom/chord.h:119-133`), saved as `<NoteParenGroup>` holding note EIDs (`rw/write/twrite.cpp:1148-1165`).
- **Chords:** several selected notes of one chord get ONE tall pair, filled as a *contiguous run*:
  "Include all notes between highest and lowest in each chord" (`editing/editparentheses.cpp:59-93`,
  `:117-133`). A note selected alone gets its own pair.
- The same `Parenthesis` element also serves chord symbols (`rendering/score/harmonylayout.cpp:76`),
  courtesy time and key signatures (`rendering/score/measurelayout.cpp:1438-1500`) and figured bass.
- **Rests: UNKNOWN / unsupported.** The generic toggle sets `HAS_PARENTHESES` on any item
  (`editparentheses.cpp:175-189`), but no layout path draws them for a rest.

**Verovio: an MEI attribute on the note.**
- `note@head.mod`, an enum: `slash, backslash, vline, hline, centerdot, paren, brack, box, circle,
  fences` (`libmei/dist/atttypes.h:1406-1417`).
- ⚠️ Only `paren` is drawn. `slash/…` is a TODO; `brack`, `box`, `circle` are silently ignored
  (`src/view_element.cpp:1588-1609`); `fences` swaps the head for a double-whole (`src/note.cpp:720-721`).
- Per note: a chord is one pair per head, never a shared one.
- Other elements use **`@enclose` = `paren | brack | box | none`** (`atttypes.h:630-635`): accid, rest,
  artic, dynam, fermata, mordent, trill, turn, drawn with E26A/B (`paren`) and E26C/D (`brack`)
  (e.g. `src/rest.cpp:332-333`, `src/accid.cpp:321-330`). So in MEI a REST can be bracketed, and a
  NOTE uses `head.mod`, not `@enclose`.

**LilyPond: a generic grob property.**
- `parenthesized` (boolean) + an optional `parenthesis-id` (`scm/define-grob-properties.scm:978-985`).
- `\parenthesize` on a whole chord gives it one id ⇒ **one pair**; inside a chord, `<c \parenthesize e g>`
  brackets that note alone (`ly/music-functions-init.ly:1657-1668`; `lily/parenthesis-engraver.cc:72-94`;
  regression `input/regression/parenthesize-chords.ly`).
- Any grob: notes, rests, articulations, dynamics, markup, breathe marks, spanners
  (`input/regression/parenthesize-singlenotes-chords-rests.ly`, `parenthesize-spanners.ly`,
  `parenthesize-breakable.ly`).
- **The shape is DATA**: `stencils` is a (left right) pair, by default Feta's
  `accidentals.leftparen/rightparen` (`scm/output-lib.scm:1222-1227`; `define-grobs.scm:2779`); any shape
  can be put there. No named enum.
- Accidentals are left out of the generic engraver and handle `parenthesized` themselves
  (`parenthesis-engraver.cc:61-70`; `lily/accidental.cc:61-67`, `:145`).

**Finale (musx):** no notehead-parenthesis field in `musxdom/src/musx/dom/*.h`; only the accidental's
`parenAcci` (grace research §H.5). **UNKNOWN.**

**MusicXML schema** (`MuseScore/src/importexport/musicxml/schema/musicxml.xsd`):
- `<notehead parentheses="yes|no">` per note (`:5257-5262`). **No bracket option for a notehead.**
- `<accidental>` has the `level-display` group: `parentheses`, `bracket`, `size` (`:2042-2049`, `:4553-4561`).
- ⇒ A head can say only *round, one note at a time*, and cannot say whether the accidental is inside.

### A.2 Import / export

- **MuseScore export:** a bracketed note is `<notehead parentheses="yes">normal`
  (`importexport/musicxml/internal/export/exportmusicxml.cpp:3893-3896`); an accidental's BRACKET →
  `bracket="yes"` (+`editorial`), PARENTHESIS → `parentheses="yes"` (+`cautionary`) (`:2858-2872`).
- **MuseScore import:** each note `setParenthesesMode(BOTH)` (`import/importmusicxmlpass2.cpp:7314-7316`)
  ⇒ one group PER NOTE (`dom/note.cpp:4029-4060`). Derived: a chord-wide pair exported and re-imported
  comes back as one pair per note.
- **Verovio** (MusicXML import only): `parentheses` → `head.mod=paren` (`src/iomusxml.cpp:3248`); an
  accidental's `bracket` / `parentheses` → `accid@enclose` brack / paren (`:4081-4082`).
- **LilyPond:** musicxml2ly turns `parentheses="yes"` into `ParenthesizeEvent`
  (`python/musicxml.py:940-942`). No MusicXML export.

### A.3 Layout and drawing (beyond §H)

- **Horizontal extent in a chord.**
  - **MuseScore** pads each group's pair against the whole CHORD's shape, less stem, hook, arpeggio,
    chord bracket and l.v. (`rendering/score/parenthesislayout.cpp:65-87`, `:545-561`). So even ONE
    bracketed head of a chord stands outside the whole chord's accidentals, displaced seconds and dots.
    Vertically the pair covers only its group's heads ±0.25 sp (`:416-475`). Derived: with the stem
    removed from the shape, a stem-up note's right bracket stands 0.3 sp from the head and CROSSES the stem.
  - **LilyPond** takes the X extent of the bracketed heads and their friends only
    (`output-lib.scm:1229-1256`): for `<c \parenthesize des>` with des on the other side of the stem, the
    pair wraps des and its accidental alone (regression `parenthesize-horizontal-placement.ly`).
  - **Verovio** is head-only.
- **Height.** MuseScore's path grows with the group. LilyPond's glyphs are FIXED
  (`output-lib.scm:1285-1293`), so a chord pair is a small pair centred on the chord (its own regression
  tweaks `font-size 0` for chords). Verovio's accidental-paren glyphs are ≈2 sp per head.
- **Spacing.**
  - **MuseScore:** the parens join the chord's shape (`rendering/score/chordlayout.cpp:3464-3474`, in
    `fillShape` at `:3399`), which feeds the segment: they take room and push neighbours. Laid out AFTER
    notes, accidentals and l.v. (`:333-337`, `:695-699`), so they stand OUTSIDE the accidental without
    pushing it. "Always kernable" (`horizontalspacing.cpp:1701`), vertical clearance 0.1 sp (`:1650-1660`).
  - **LilyPond:** minimum distances between columns only, no space unless they would collide
    (`parenthesize-horizontal-spacing-cosy.ly`, `-tight.ly`); the engraver's TODO: "enlarge victim to allow
    for parentheses space?" (`parenthesis-engraver.cc:100-104`).
  - **Verovio:** UNKNOWN whether the accidental column avoids the left bracket; nothing outside `DrawNote`
    reads `head.mod`.
- **Grace / cue.** MuseScore `intrinsicMag`; LilyPond adds the host's `font-size` (a grace's pair −9,
  ≈0.354); Verovio `drawingCueSize` (all in §H).
- **Glyphs.** None of the three DRAWS with `noteheadParenthesisLeft/Right` (E0F5/E0F6) or E0CE.
  MuseScore reads those only as legacy symbols and converts them (`rw/read206/read206.cpp:1179-1183`,
  `rw/read410/tread.cpp:3302-3306`). MuseScore: a bezier; Verovio: E26A/E26B; LilyPond: Feta's accidental
  parens. Only VexFlow uses E0F5/E0F6.

### A.4 Interactions

- **Playback.** MuseScore: a parenthesised note SOUNDS, but gets the **`GhostNote` articulation**
  (`playback/metaparsers/notearticulationsparser.cpp:172-179`); what that does in the MPE framework is
  **UNKNOWN** (not in the tree). The old MIDI path's ghost velocity ×0.6 (`dom/noteevent.h:40`) is for
  `ghost()` only, not brackets. Verovio and LilyPond: display only, plays normally.
- **Ties.** MuseScore: a tie's start clears the chord shape, parens included, so the tie begins after
  `)`; only a laissez-vibrer start ignores the paren (`rendering/score/slurtielayout.cpp:2270-2310`,
  `ignoreParen`). LilyPond: l.v. / repeat-tie regressions, no special rule found. Verovio: nothing (derived).
- **Stems.** No engine changes a stem for brackets (MuseScore's pre-bend aside, §H.1.2).
- **Editing (MuseScore).** "Add parentheses to element" (`notationscene/internal/notationuiactions.cpp:996-1001`)
  in the Accidentals and Noteheads palettes (`palette/internal/palettecreator.cpp:352`, `:689`); dropped on a
  note it ADDS (`dom/note.cpp:1977-1979`), on a selection it adds to every note
  (`notationinteraction.cpp:2346-2350`, `:2598-2600`). The toggle (`toggleParentheses`,
  `editparentheses.cpp:163-189`): notes — if ANY selected lacks brackets, all get them, else all lose
  them; an accidental → `PARENTHESIS`; a time signature → `setLargeParentheses`; other items flip their
  own parens. Removing also sets `HIDE_GENERATED_PARENTHESES`, so the user's removal beats a ghost note's
  generated brackets (`:125-127`, `:147-151`).

### A.5 Numbers (not already in §H.8)

- MuseScore paren-to-paren minimum 1.0 sp; a narrower item is centred between them
  (`parenthesislayout.cpp:136-156`, `:251-253`).
- MuseScore internal padding: hook 0.3; keysig 0.35 / 0.25; timesig, clef 0.2 / 0.25; harmony 0.2;
  default 0.1 (`:237-259`), all × the mean mag.
- `Parenthesis::PARENTHESIS_END_WIDTH` = 0.1 (`dom/parenthesis.h:33`), 0.05 for chords.
- LilyPond `padding`: 0.1 when unset (`output-lib.scm:1244`), grob default 0.2.

### A.6 What it means for the model

Three meanings of "one pair": **MuseScore** — a chord-owned group over a contiguous run, round only;
**LilyPond** — per grob, or one shared id per chord, the shape swappable stencils; **Verovio / MEI** — per
note, an enum (`paren`, `brack`, `box`, `circle`) only partly drawn. MusicXML carries per-note, round,
yes/no. ⇒ A per-note shape (`round | square | …`) round-trips to MusicXML for round only; a chord-wide
pair is a grouping ON TOP of it and becomes per-note on re-import.

---

## Part B — The books (`reference/`, 2026-09-23)

> Started from `reference/README.md`. Gould: PDF page = printed + 20 on every page rendered; Stone and
> Gerou & Lusk (G&L) are 2-up PDFs; Ross: PDF = printed + 12. ⭐ Gould's quotes were READ OFF RENDERED
> SCANS (the OCR only located them). Builds on `grace-notes-research.md` Part G / §0.9 and
> `sibelius-keypad.md` §3b; the small stemless bracketed head (trill note, bend target, glissando end,
> harmonic) is covered there and not repeated. Scratch crops: the session scratchpad `paren/` (not kept).

### B.1 Uses — ⭐ one idea: the pitch is INFORMATION, not a new attack

| use | source | quote |
|---|---|---|
| a note held in the sostenuto pedal, restated at a new system | **Gould p. 337** | *"It is useful to indicate notes that are held in the sostenuto pedal … in brackets at the beginning of a new system – or, if useful, at the beginning of each bar … Placing the sustained notes in brackets shows that the hand is released from the keys"* (full-size bracketed half notes) |
| the same written note in both hands | **Gould p. 308** | *"The player will choose the appropriate hand … Bracket the other note"* (a full-size stemmed semiquaver, bracketed) |
| a tied note or rest restated at a system break (ad lib.) | **Gould p. 610** | *"restate the note-values of accompanying parts on successive systems as tied notes. Rests may also be restated. Place these restated notes and rests in brackets to indicate that in an instrumental part a single note or rest will represent them"* |
| a note reiterated after a system break (proportional notation) | **Gould p. 634** | *"Notes may be reiterated in brackets as a reminder."* |
| a held note at the start of a new line (spatial notation) | **Stone p. 140** | the next line begins *"a little before the held note, whose note-head should be placed in parentheses"* |
| vocal notes an alternative text omits | **Gould p. 469** | *"Bracket the notes of a syllable that an alternative text omits. Notate with bracketed cue-sized notes an additional syllable in an alternative text that would otherwise be a rest"* |
| ossia | **Gould p. 497** | *"An ossia note is given as a small note in brackets and placed on the same stem as the preferred pitch. Consecutive ossia notes need only one set of brackets"* |
| random-order tremolo pitches; the total duration of an indeterminate group | **Stone pp. 232, 141**, and p. 77 PDF | *"a small, bracketed note should be used to show the total duration of the group"* |
| tied notes on a TAB staff | **G&L p. 141** | *"tied notes are in parentheses"* (tab only) |

- **Against:** Gould p. 146 (glissandos): *"Avoid replacing glissando durations with rests or bracketed
  rests as these are disconcerting"*.
- **Square brackets: accidentals only.** Gould p. 83: *"Square brackets around accidentals should be used
  only to indicate editorial additions in practical or scholarly editions. Editorial additions may,
  alternatively, be given as small-sized accidentals above their notes."* Round brackets on a cautionary
  accidental are *"traditional practice"* (same page). A square-bracketed NOTE appears in none of the four
  books: **UNKNOWN**.
- **Not found in any of the four** (UNKNOWN): ghost notes (percussion, guitar); a general "optional, may
  be omitted" note; a note bracketed only as a cautionary pitch reminder.

### B.2 What is enclosed

- **The accidental: INSIDE.** Gould p. 337 draws `(♭𝅗𝅥)`; p. 634 `(♭●)` in both forms. (Sibelius §3b agrees.)
- **The ledger line: INSIDE** — measured, Gould pp. 308 and 337: the bracket encloses the ledger through
  the head; on p. 337 a higher ledger above the bracket's top stays outside. ⇒ Sized to the head's OWN
  ledger, not to every ledger line.
- **The stem: OUTSIDE** — it leaves through the bracket's top or bottom (pp. 308, 337, 469, 634 stemmed).
  Exception: the cue-size ossia / omitted note, where p. 469 encloses the small head AND stem.
- **The dots: INSIDE.** Gould p. 610 `(chord with dots)`; p. 497 ends an ossia `𝅗𝅥.)`.
- **A fermata:** Gould p. 610 brackets rest + fermata as one unit (≈5.5 sp tall).
- **A chord — BOTH, and no rule.** One pair round the whole chord: Gould p. 610 (a tied whole-note chord),
  p. 469 (two voices), p. 634's stemless form `(♭●/●)`. One pair PER HEAD: p. 634's stemmed form
  `(♭●)` over `(●)`, in the same figure, and Stone p. 76.
- **Horizontally:** one pair may run across CONSECUTIVE notes (the ossia, p. 497).

### B.3 Shape, size, position — measured (no book states a number)

600 dpi, sp = 26.5 px, ink columns read off the rendered scans:

| | Gould p. 308 (full-size semiquaver on a ledger) | Gould p. 337 (full-size ♭ half note) |
|---|---|---|
| bracket height | ≈2.0 sp (53 px) | ≈1.96 sp (52 px) |
| vertical centre | on the head's centre (0 px off) | on the head's centre (≤1 px) |
| bracket width, each | ≈0.55 sp | ≈0.53 sp |
| `(` → ledger / head | 0.38 sp / 0.72 sp | `(` → ♭ 0.53 sp; ♭ → head 0.53 sp |
| head (or ledger) → `)` | ledger 0.6 sp | head 0.53 sp; ledger ≈0.15 sp |

- A font-style round paren, thickest at mid-height.
- On a chord, or rest + fermata, the pair GROWS round the group: ≈5.3 sp (chord), ≈5.5 sp (rest + fermata),
  p. 610 (that system's sp ≈19 px).
- The small / grace form (Part G): ≈2.0–2.1 sp tall, ≈0.6 sp wide — the SAME height as for a full-size
  head: the bracket is not scaled down with the head.
- Ross pp. 130–131, 146 (bracketed ACCIDENTALS only): plate engravers use *"a tool one size smaller"*, and
  *"extra space is given as needed"*.

### B.4 A bracketed ACCIDENTAL is a different feature

It brackets the accidental ALONE; the head stays bare.
- Gould p. 83: *"such accidentals are placed in brackets, to confirm that they are not strictly essential …
  On a chord, each accidental takes a separate pair of brackets. Brackets force extra horizontal space
  between the accidental and the surrounding notes"*.
- Stone p. 55: *"Accidentals and naturals which have no primary function but serve only to clarify
  possible ambiguities are the only ones to be placed in parentheses."*
- G&L pp. 4–5: *"Courtesy accidentals may or may not be enclosed in parentheses … each accidental gets its
  own pair of parentheses."*
- A tied accidental at a system break: Gould p. 80 — *"may be enclosed in brackets, although brackets may
  decrease the legibility"*; Stone p. 54 — *"No parentheses should be used because they crowd the image."*
  ⚠️ **The two books disagree.**
- Sibelius splits them the same way: F12 brackets the accidental, F8 the note (§3b).

### B.5 Rests and ties

- **Rests: yes.** Gould p. 610 (*"restated notes and rests in brackets"*, the fermata inside). Gould p. 146
  rejects bracketed rests standing in for glissando time.
- **Ties:** the brackets go on the RESTATED / tied-TO note at a new system (Gould p. 610, Stone p. 140), or
  on the sustained note (Gould p. 337). The tie runs OUTSIDE: on p. 610 the tie to the next bar leaves
  after `)` and the incoming tie ends at `(`; on p. 337 the l.v. ties hang outside both brackets. (Part G:
  Gould p. 139, *"A tie should not run through a trilling note."*)

### B.6 UNKNOWN

Ghost notes · square-bracketed (editorial) notes · a RULE choosing one pair per chord or per head · any
STATED gap or height · brackets on normal-form grace notes (Sibelius says yes, *"including grace notes"*;
no book addresses it).

---

## Part C — Formats and apps (online, 2026-09-23)

### C.1 MusicXML 4.0

- **`<notehead parentheses="yes|no">`**: *"If yes, the notehead is parenthesized. It is no if not
  specified."* A yes/no, so ROUND ONLY; a square bracket on a head cannot be written. Per `<note>`, so
  in a chord each note carries its own; no chord-level flag, no "one pair round the chord". Graces carry
  `<notehead>` like any note. https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/notehead/
- **Rests:** `<rest>` has no parentheses attribute (only `measure`); a `<notehead>` after a `<rest>` is not
  forbidden but has no stated meaning ⇒ **UNKNOWN / not really supported**.
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/rest/
- **`<accidental>`**: two independent booleans, `parentheses` (*"Specifies whether or not parentheses are
  put around a symbol for an editorial indication."*) and `bracket`, plus `size`, `cautionary`,
  `editorial`. Independent of the notehead's flag.
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/accidental/
- **`<level>`** (editorial): the same `parentheses` / `bracket`, plus `reference` (*"editorial information
  that is for display only and should not affect playback"*) and `type` start/stop/single (a bracket over
  several symbols). https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/level/
- **`enclosure-shape`** (15 values: rectangle, square, oval, circle, bracket, inverted-bracket, triangle,
  diamond, pentagon … decagon, none) is for TEXT-like elements only, ⛔ not notes; its `bracket` is *"a
  rectangle with the bottom line missing, as is common in jazz notation"*, not `[ ]`.
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/enclosure-shape/
- **`<notehead-text>`**: text INSIDE a head (education) — unrelated.
- ⚠️ The lesson: MusicXML grew one BOOLEAN per shape (`parentheses`, then `bracket`) — the trap a
  boolean field walks into.

### C.2 MEI

- **`att.enclosingChars/@enclose`**, type `data.ENCLOSURE`: *"Attributes that capture characters used to
  enclose symbols having a cautionary or editorial function."* Members: note, **chord**, **rest**, accid,
  artic, clef, meterSig, meterSigGrp, keyAccid, fermata, trill, mordent, turn, ornam, arpeg, ambNote, neume
  elements. ⛔ `dot` is not a member.
  https://music-encoding.org/guidelines/v5/attribute-classes/att.enclosingChars.html
- **v5 values:** `paren` (*"Parentheses: ( and )."*), `brack` (*"Square brackets: [ and ]."*), `box`,
  `none`. v4 had only `paren`, `brack`.
  https://music-encoding.org/guidelines/v5/data-types/data.ENCLOSURE.html ·
  https://music-encoding.org/guidelines/v4/data-types/data.enclosure.html
- ⭐ ONE enum that has GROWN across versions, and it may sit on the NOTE or the CHORD — "a pair per head"
  and "one pair round the chord" are two different statements. (⚠️ Part A: Verovio draws a NOTE's
  brackets from `@head.mod`, not `@enclose` — the guidelines and the renderer disagree on the note.)

### C.3 SMuFL (codepoints checked in `public/smufl/glyphnames.json`)

- Noteheads: `noteheadParenthesis` E0CE, `noteheadParenthesisLeft` E0F5, `noteheadParenthesisRight`
  E0F6. ⛔ **No `noteheadBracketLeft/Right`** — SMuFL has no square notehead bracket.
- Accidentals: `accidentalParensLeft/Right` E26A/E26B, `accidentalBracketLeft/Right` E26C/E26D.
- Taller: `csymParensLeftTall/RightTall` E875/E876, `csymParensLeftVeryTall/RightVeryTall` E879/E87A,
  `csymBracketLeftTall/RightTall` E877/E878 (chord-symbol glyphs; a candidate for a chord-high pair).
- Many families have their own pair (time signature, fingering, figured bass, octave, pedal, hairpin;
  `gClef8vbParens` E057).
- ⛔ **No placement or sizing rule** in the spec (https://smufl.formats.music/latest/tables/noteheads.html,
  …/standard-accidentals-12-edo.html); no font has anchors on these glyphs. Bravura's metadata defines
  LIGATURES: `noteheadBlackParens` / `HalfParens` / `WholeParens` / `DoubleWholeParens` (F5DC–F5DF, =
  E0F5 + head + E0F6) and the five parenthesised accidentals (F5E0–F5E4).
- **Bravura sizes (sp):** notehead parens ≈1.45 tall (±0.724), advance 0.292 (the right's bbox starts at
  −0.144); accidental parens ≈1.98 tall (±0.99), advance 0.564; accidental brackets ≈1.5 tall. E0CE is
  one glyph 1.76 wide enclosing a head-sized gap. ⇒ The notehead pair is sized for ONE HEAD; a chord or
  a head with its accidental needs a taller glyph, scaling, or a drawn curve.

### C.4 Applications

**Dorico** (the fullest).
- **Round and Square**, the "Bracket style" property. Round = font glyphs on notation staves, drawn curves
  on tab; Square = drawn, *"a straight vertical line with horizontal hooks at the top and bottom"*, length
  adjusted so they do not end on staff lines.
- Scope: *"individual noteheads, … single notes within chords, and … whole chords"*. Several bracketed
  heads of one chord ⇒ **ONE tall bracket**, split automatically at big gaps (Engraving Options >
  Bracketed Noteheads > Vertical Extent); a per-note **Break bracket** property forces a split.
- Ties: only the FIRST head of a tie chain by default; **"Bracket until end of tie chain"** encloses the chain.
- Brackets avoid accidentals, dots, flags, back notes, other voices (the 3.1 blog's collision list). Whether
  the accidental is INSIDE the notehead bracket: **UNKNOWN** from the docs.
- Accidentals have their own round / square brackets (square since 3.1).
- Uses: optional, editorial, not played on every repeat, keys pressed but not struck.
- Engrave mode: handles for height, position, curvature; 40+ engraving options.
- **Playback:** *"By default, bracketed notes have reduced velocity, causing them to sound quieter in
  playback."* — ⚠️ PARTLY VERIFIED: seen only in a search extract of the Dorico SE 5.1 help; the page would
  not render.
- https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_notes/notation_reference_notes_bracketed_c.html
  · https://blog.dorico.com/2020/01/dorico-3-1-update-released/ · https://www.scoringnotes.com/reviews/dorico-3-1/

**Sibelius.** F8 `1` (`sibelius-keypad.md` §3b). Scoring Notes: drawn as CURVES, not glyphs; *"the only
thing you can't do with these parentheses is move or adjust them"*
(https://www.scoringnotes.com/tips/parenthesize-notes-in-sibelius/). F12's button brackets the accidental
alone. No square bracket on a note. Chords and playback: **UNKNOWN** (sibeliusforum.com: 403).

**Finale** (discontinued 2024). No notehead-bracket property: the brackets are ARTICULATIONS (#38 / #39),
one note each, placed by hand; for a passage, `(` on the first note and `)` on the last. Speedy Entry `P`
parenthesises an accidental. Patterson's "Parenthesize Trill-To Notes" plug-in places them around
*"accidentals, augmentation dots, ledger lines, and chords"*.
http://usermanuals.finalemusic.com/Finale2010Win/Content/Finale/Parentheses.htm ·
https://robertgpatterson.com/-fininfo/-partrillto/partrillto.html

**Guitar Pro** (GP7 guide, read directly): *"A ghost note is a faint note. The dynamic of a ghost note is
automatically decreased. The note is displayed between round brackets on the tablature."* — on tab the
brackets MEAN a playback effect. https://static.guitar-pro.com/gp7/manual/GuitarPro7-user-guide.pdf

**MuseScore** (user docs only). Properties > Note > Head > **"Notehead parentheses"**, one or several
heads; with *"a chord … selected a single set of parentheses will be drawn across the entire chord"*;
broken by setting "Normal notehead" on one note. Shift+X brackets tab fret numbers. Accidentals: their own
parentheses / brackets. Shortcut `(` = "Add parentheses to element" (element scope **UNKNOWN**).
https://handbook.musescore.org/notation/pitch/noteheads · https://handbook.musescore.org/appendix/all-keyboard-shortcuts
· https://musescore.org/en/4.6

### C.5 Playback

Dorico: sounds, quieter by default (partly verified). Guitar Pro: ghost notes quieter (verified).
MusicXML: no playback meaning (`<level reference="yes">` is its only display-only flag). MEI: none.
Sibelius, MuseScore (docs), Finale (graphic only): **UNKNOWN**. ⇒ The meaning is overloaded — optional,
editorial, ghost (soft), not on every repeat, silently depressed key — so the SHAPE is one fact and any
playback MEANING another.

### C.6 Unreachable

steinberg.help's reader redirects (the archive v3 pages were used); sibeliusforum.com and musescore.org
forum pages: 403; music-encoding.org's lowercase v5 URL: 404 (the right one is `data.ENCLOSURE.html`).
