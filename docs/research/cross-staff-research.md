# Cross-staff notation — research (2026-09-21)

**Question.** A note that belongs to one staff of a keyboard system but is *written* on the other —
and the hard case that started it, Satie's *Gymnopédie No. 1*: a left-hand half-note chord whose
lowest head (B2) sits on the bass staff and whose upper heads (D4, F♯4) sit on the treble staff, on
**one stem** crossing the gap.

Four lines of enquiry, run the same day: VexFlow's source, the notation programs' UI, three engines'
source, and the engraving library (`reference/README.md`). ⛔ What could not be reached is marked
**UNKNOWN** — it is not "the books are silent". The plan this feeds is
`docs/plans/cross-staff-plan.md`.

---

## 1. What everything agrees on

| Question | Answer | Who |
|---|---|---|
| Who owns rhythm, voice, rests, playback | The **home** staff + voice. The cross is *where it is written*, nothing else | Sibelius, Dorico, Finale, MuseScore, Verovio, MusicXML, MEI |
| Legality | Adjacent staff of the **same instrument** only | all four programs, MuseScore source |
| How the crossed head is laid out | Filed under the **destination** staff: its clef, its ledger lines, its collisions | Verovio, MuseScore |
| Cross-staff stems/beams and the skyline | They do **not** push the staves apart | Verovio, MuseScore, LilyPond |

**Where they split — the unit of crossing.** Per *note*: MusicXML, MEI, Verovio, Dorico, Finale.
Per *chord*: MuseScore, Sibelius. A *stream switch*: LilyPond. ⭐ Only the per-note ones can write
the Satie bar; the others fake it with two voices and overlapped stems.

---

## 2. VexFlow (`~/dev/engine-sources/vexflow`)

Cross-staff **beams only**. `tests/crossbeam_tests.ts`: a note stays in its voice and is pointed at
another stave with `note.setStave(stavemap[…])`; stem directions are set by hand per note.
`src/beam.ts` `applyStemExtensions` lengthens a stem whose direction differs from the beam's
(`crossStemExtension = (1 + (beamCount − 1) × 1.5) × beamWidth`). A `StaveNote` has ONE stave
(`setStave` also sets every notehead's), so a chord split across staves does not exist there.
Nothing to port for the chord; the beam extension is the one reusable idea.

---

## 3. The programs

### Sibelius — Reference Guide 2024.3, §4.16 "Beam Positions", pp. 393–394
(<https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf>, read from the PDF)

- **Shortcut:** `Ctrl+Shift+↓/↑` (`Cmd+Shift+↓/↑`). Sibelius Ultimate only.
- **Ribbon:** `Note Input > Cross-Staff Notes > Below / Above / Reset`. ("Move to original staff" is
  not a Sibelius term.) The Sibelius 6 menu path: **UNKNOWN** (no v6 guide reached).
- Workflow: input everything on one staff, select, cross.
- *"Notes are in many respects treated as being on the original staff"* (they transpose with it);
  *"Notes crossing onto another staff do not affect that staff's voices at all."* *"You can even
  cross rests over."*
- *"Notes can only cross over to another staff in the same instrument"*, adjacent only.
- Beams: *"always horizontal by default (assuming Optical beam positions is on), and go in between
  two staves"*; flip stems with `X`. Engraving Rule: "Adjust for cross-staff and between-note beams".
- Rough edges it admits: redundant accidentals appear after crossing (hide them); magnetic slurs do
  not attach to crossed notes.
- ⚠️ **The Satie chord is not supported.** The guide's own section "Chords split between staves" is
  a manual recipe: two voices on two staves, flip the lower stems (`X`), then *"drag the end of each
  stem in the right hand downwards so that it meets the stem of the left-hand note"*. Two stems
  overlapped by hand.

### The others

| | Shortcut / menu | One head of a chord? | Source |
|---|---|---|---|
| Dorico | `N` / `M`; `Edit > Cross Staff > Cross to Staff Above / Below / Reset to Original Staff` (menu names from a search summary, page not opened) | **Yes** — the tutorial crosses a chord's top note alone; *"does not change the staff to which the notes belong"* | <https://archive.steinberg.help/dorico_first_steps/v3.5/en/dorico_first_steps/topics/first_steps_writing/first_steps_notes_crossing_to_other_staff_t.html> |
| Finale | Note Mover > Cross Staff; TGTools plug-in `Shift+Alt+↑/↓` | **Yes** — *"You can select a single note by clicking its handle"*; playback stays on the source staff | <https://usermanuals.finalemusic.com/FinaleWin/Content/Finale/Cross_staff_notes.htm> |
| MuseScore | `Ctrl+Shift+↑/↓`; menu name UNKNOWN | **No** — *"if you move one note, the whole chord will move"* | <https://handbook.musescore.org/idiomatic-notation/keyboard/cross-staff-notation> |

---

## 4. The engines (local checkouts, `~/dev/engine-sources`: Verovio `efff0bc`, MuseScore `929d1e9`, LilyPond `beedbfa`)

### Verovio — the only one with the split chord native
- **Model:** MEI `@staff` on note / chord / rest / beam. `PrepareCrossStaffFunctor::VisitLayerElement`
  (`src/preparedatafunctor.cpp:277-351`) resolves it to `LayerElement::m_crossStaff` /
  `m_crossLayer`; a child without `@staff` inherits its parent's. A note inside a chord may carry its
  own. `Chord::GetCrossStaffExtremes` (`src/chord.cpp:327-351`) looks only at the bottom and top
  note — *"We assume that we have a cross-staff chord we cannot have further cross-staffed notes"*.
- **Ownership:** the element stays in its encoded `<layer>`; `m_crossStaff` is display only. Layout
  asks `GetAncestorStaff(RESOLVE_CROSS_STAFF)` — ledger lines (`calcledgerlinesfunctor.cpp:74`), dots
  (`calcdotsfunctor.cpp:71,140`), head clusters (`calcchordnoteheadsfunctor.cpp:33,54`), layer
  collisions (`adjustlayersfunctor.cpp:50`). Seconds cluster only between heads on the SAME staff
  (`chord.cpp:160`). For horizontal alignment the element is filed under the destination staff with
  a negative layer number (`horizontalaligner.cpp:628-637`).
- **Stem:** `GetYExtremes` spans both staves, so the split chord's stem length contains the gap.
- **The staff distance is handled by REDOING the work:** `AdjustCrossStaffYPosFunctor`
  (`src/adjustyposfunctor.cpp:74-86`) re-runs pitch position + `CalcStem` after vertical layout, and
  `JustifyYAdjustCrossStaffFunctor::VisitChord` (`src/justifyfunctor.cpp:194+`) patches the stem
  after justification.
- **Beams:** `BEAMPLACE_mixed` whenever a beam has cross-staff content (`beam.cpp:1138`);
  `CalcMixedBeamPlace` (l.1371-1412) sets each stem's direction by its staff; `RequestStaffSpace`
  (l.1562-1595) asks the staves for room when the minimum stem is not met.
  `calcbboxoverflowsfunctor.cpp:97-115` keeps cross content out of the overflow.
- `@beam.with` / `@stem.with` are parsed and never read; `@stem.sameas` (one stem shared across
  layers) is implemented.

### MuseScore — the chord is the unit
- `ChordRest::m_staffMove` ∈ {−1, 0, +1} (`dom/chordrest.h:231`), `vStaffIdx() = staffIdx() +
  m_staffMove`, serialized `<staffMove>`. `Note` has no such field ⇒ the split chord is not
  expressible. (The community two-voice workaround was not traced in source — UNKNOWN.)
- `editing/editcrossstaff.cpp` restricts the move to the part / staff group.
  `checkStaffMoveValidity` (`chordrest.cpp:1315-1350`) resets an invalid move and remembers it in
  `m_storedStaffMove`.
- Track/voice/rests/playback stay home. y from `system->staffYpage(vStaffIdx())`
  (`dom/chord.cpp:1258`); shapes go to the visual staff (`chordlayout.cpp:1165`).
- Unbeamed moved chord: `ldata->up = staffMove() > 0` (`chordlayout.cpp:1590-1593`) — the stem
  points back toward home.
- **Two passes for beams:** `SystemLayout::updateCrossBeams` (`systemlayout.cpp:2054-2115`) runs
  after `layout2` has set staff distances; staff distance reads the beam's needs back
  (`minVertSpaceForCrossStaffBeams`, l.2300, 2326-2395). Beam position ABOVE / BELOW / BETWEEN
  (`beamtremololayout.cpp:667-676`). `skyline.cpp:45-75` keeps cross-beam stems from forcing the
  staves apart.

### LilyPond — nothing stored
- `\change Staff = "up"` re-parents the Voice (`lily/change-iterator.cc`). `\autoChange`: *"Chords
  will not be split across the staves"* (`Documentation/en/notation/keyboards.itely:364`).
- The split chord is two voices + `\crossStaff` (`ly/music-functions-init.ly:544-560`) +
  `Span_stem_engraver` (`scm/music-functions.scm:2566-2578`, not in PianoStaff by default): at
  stencil time it draws ONE box over the union of the stems that share an x, and hides the originals.
- The `cross-staff` grob property = "Y-extent depends on inter-staff spacing"; such grobs are left
  out of the skylines (`axis-group-interface.cc:850-858`: *"this could mean that staves are placed so
  close together that there is no room for the cross-staff grob"*).
- Accidental/dot collisions across the two `\crossStaff` voices: UNKNOWN (not traced).

### Interchange
- **MusicXML:** `<staff>` is a child of `<note>`; crossing = a `<staff>` differing from the voice's
  usual one, `<voice>` unchanged. A split chord = each `<chord/>` note with its own `<staff>`. No
  single-stem construct. Whether importers honour it: UNKNOWN.
  (<https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/staff/>)
- **MEI:** `@staff` (att.staffIdent) on note/chord/rest/beam — *"the staff on which a notated event
  occurs"*; on a note inside a chord it is the split-chord encoding Verovio reads.

---

## 5. The books

⚠️ **How each was read.** Gould pp. **305, 314, 315, 317, 488** from the SCAN (the PDF in
`reference/`, PDF page = printed + 20). Gould pp. 303–304, 306–308, 311–312, 318–319, 321–324 are
**OCR** (`reference/gould-behind-bars-fulltext.txt`) — ⛔ re-read the scan before building a rule on
one. Stone, Gerou & Lusk, Ross: full-text grep. **Gardner Read: UNKNOWN** — not on disk;
archive.org's copies are lending-gated (401).

### The split chord
- Gould p. 305 (scan), *Hands moving to the opposite stave*: *"To avoid ledger lines in the middle
  of the system, a stem may extend from one stave to the other to take advantage of the other clef.
  This notation can look confusing for more than the occasional chord."* Her second figure draws it:
  lower heads on the bass staff, upper heads on the treble, ONE continuous stem, every head on its
  normal side. ⚠️ No name, no stem-length rule — the length is whatever the gap makes it.
- Gould p. 317 (scan): *"it is acceptable to join notes for both hands with a single stem. It is
  better not to have notes attached to different sides of the stem; this is visually disconcerting
  because the noteheads do not align."*
- Gould p. 304 (OCR): *"It is not standard practice to use a common stem to indicate both hands
  playing at the same time — but see Both hands playing simultaneously, p. 317."*

### When to cross
- Gould p. 303 (OCR): *"The overriding principle of keyboard notation is to indicate how a player
  should distribute the notes between the hands."*
- Gould p. 304 (OCR): *"it is better to retain the occasional ledger line so as to keep clef changes
  to a minimum."*
- Gould p. 307 (OCR): a migrating middle part's *"stems point into the centre of the system"*; a
  dotted diagonal line may trace it.
- Stone p. 283: notes out of a hand's reach *"should be moved to the other staff… Thin, slanted
  lines should indicate the change from staff to staff."*

### Rests
- Gould p. 305 (scan): *"Do not allocate rests to the empty stave, since this would imply that a
  hand is resting."*
- Gould p. 306 (OCR): the crossing hand's rests *"are placed on the same stave as neighbouring notes
  that make up the beat or bar. Do not add rests to the vacated stave."*
- Gould p. 312 (OCR): *"When there are two rhythmically independent parts on a stave, rests should
  make up the value of the bar for each part."*
- Reading of the Satie bar (inference, not a quotation): the treble's whole-bar rest is the right
  hand really resting; the beat-1 quarter rest makes up the bar for the left hand's second part.
  Which stave that rest belongs on is not settled by her text.

### Beams (phase 2's material)
- Gould p. 314 (scan): *"Join the stems of a beat to a common beam, either between the staves (a),
  or above or below the system (b)."*
- Gould p. 315 (scan): *"To use a double-stemmed beam, the staves must be far enough apart to give
  adequate length (at least 2½ stave-spaces) to all stems."* (OCR prints `2%`; the scan says 2½ —
  the ONE number in this topic.) *"Position a beam so that the shortest stems in both directions are
  of equal length. For clarity, keep beams clear of the staves where possible."* *"If in doubt use a
  horizontal beam."*
- Stone p. 12 §D: *"the notes of a beamed group may be placed in the upper and lower staff, with the
  beam between the staves."*
- Gerou & Lusk p. 43: *"The slant of the beam is determined by the amount of space between the two
  staves, the length of the stems, and by avoiding exaggerated angles."*

### Ties, slurs, dynamics, staff distance
- Gould p. 308 (OCR): a tie across staves *"must connect the noteheads"*; *"When a pitch with an
  accidental is tied over to the other stave, it is useful to add the accidental in brackets."*
- Gould pp. 321–324 (OCR): a slur should not intersect a beam; *"A hairpin should never intersect a
  beam."*
- Gould p. 488 (scan): *"Adjust the distance between staves from system to system, according to the
  demands of the notation."*

### UNKNOWN / not found
- Gardner Read — unreachable.
- A name for the split-chord stem; any stem-length or attachment geometry for it.
- Accidental, dot and notehead collision rules at a crossing — in none of Gould's keyboard chapter,
  Stone, Ross, Gerou & Lusk.
- Ross on cross-staff notation at all (grepped; no section found).
