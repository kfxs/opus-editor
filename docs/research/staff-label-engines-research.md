# Staff labels — how LilyPond, MuseScore and Verovio model and draw them

> **Findings only**, in the manner of `docs/research/glissando-engines-research.md`. ⛔ Nothing here is a
> decision (`docs/plans/staff-label-plan.md` makes them). ⚠️ A research file does not know what was DECIDED.
>
> Written 2026-09-28 from the SOURCE on disk, `~/dev/engine-sources/` — LilyPond, MuseScore (commit
> `929d1e9`, 2026-08-18) and Verovio; no web search. Paths are relative to each repo.
> **UNKNOWN** marks what could not be verified.

## 0. Synthesis

| | LilyPond | MuseScore | Verovio / MEI |
|---|---|---|---|
| Where the name lives | a context property (Staff, or a group context) | the Instrument (of a Part) + a StaffType label + a BracketItem label | `<label>` / `<labelAbbr>` on staffGrp / staffDef / layerDef |
| ⭐ Independent of the instrument? | **Yes** — separate from `midiInstrument` | **No** — built from the instrument; custom text overrides it | **Yes** — `instrDef` is MIDI only |
| Long / short | two properties | long / short everywhere | label / labelAbbr |
| Rich text | full markup | XML rich text | `lb` / `rend` |
| Change mid-score | short yes; a later LONG name is ignored | yes, via an instrument change (from the next system) | only at a section restart (else UNKNOWN) |
| Group name | the same property on a group context, centred on its staves | automatic from same-instrument parts, + a bracket label | staffGrp label, centred |
| Gap to staff / brackets | 0.3 sp padding | 1.0 sp | 1 sp |
| Horizontal alignment | centred in the indent | right-aligned | right-aligned |
| Indent | FIXED: 15 mm first system, 0 after | GROWS to fit; ≥ 5 sp on the first system | GROWS to fit |
| Font | the default text font, 11 pt ≈ 2.2 sp, upright | Edwin 10 pt ≈ 2.0 sp, upright, staff-scaled | Times, lyric size 2.25 sp, upright |

⇒ Two of three keep the label apart from the instrument. The one that does not (MuseScore) still bolts a
staff-level label (`StaffType`) and a custom-name override on top — i.e. it needed the independent label too.

## 1. LilyPond — the name is plain text on a context

- **Model.** Two markup properties: `instrumentName` (the long name, first system) and
  `shortInstrumentName` (every later system) (`scm/define-context-properties.scm:472-474, 700`);
  `vocalName` / `shortVocalName` are fallbacks (`lily/instrument-name-engraver.cc:76-84`). `midiInstrument`
  is separate and unrelated (`define-context-properties.scm:552`) ⇒ any Staff can carry a name with no
  instrument at all. The only thing that ever bundled the two — `\addInstrumentDefinition` /
  `\instrumentSwitch` — is deprecated (`ly/music-functions-init.ly:54-61, 902-925`).
- **Rich text.** Full markup: `\column` for several lines, `\flat`, `\center-column`
  (`Documentation/en/notation/staff.itely:1180-1210`).
- **Change mid-score.** `\set Staff.shortInstrumentName = …` works: the engraver ends the old name and
  starts a new one when either property changes (`instrument-name-engraver.cc:86-98`). The LONG text is
  printed only when the name begins at moment 0 (`scm/output-lib.scm:2121-2132`), so a later
  `instrumentName` change is ignored — documented (`staff.itely:1256-1260`).
- **Groups.** `Instrument_name_engraver` is also in StaffGroup, PianoStaff, GrandStaff, ChoirStaff
  (`staff.itely:1160-1165`, `ly/engraver-init.ly:473`). A group's name is centred on the span between its
  live staves' middle lines (`calc-y-offset`, `output-lib.scm:2170-2202`).
- **Engraving.** `InstrumentName`, a Spanner on the system (`scm/define-grobs.scm:1852-1867`):
  `direction LEFT`, `padding 0.3` sp, `self-alignment-X CENTER`, `self-alignment-Y CENTER`. It sits left
  of the leftmost brace/bracket, centred within the indent when narrower (`output-lib.scm:2134-2168`).
  Indents are paper settings, `indent-default = 15mm`, `short-indent-default = 0mm`
  (`ly/paper-defaults-init.ly:110-111`); the indent does NOT grow — the docs say raise `indent` /
  `short-indent` by hand (`staff.itely:1212-1218`). **UNKNOWN:** what a name wider than the indent does
  (the code suggests it runs into the left margin; not rendered). Font: the default text font.

## 2. MuseScore — the name belongs to the Instrument, with overrides

- **Model.** `Instrument` holds an `InstrumentLabel` (`dom/instrument.h:330-380`), which extends
  `StaffLabel {longName, shortName}` with number, transposition, show-flags, `useCustomName` + custom
  long/short, and custom group and individual names (`dom/stafflabel.h:27-125`). `Part::longName(tick)`
  returns `instrument(tick)->longName()` (`dom/part.cpp:510-530`).
- **A staff-level name:** `StaffType` has its own `StaffLabel` (`dom/stafftype.h:185-190`), read by
  `Staff::individualStaffNameLong/Short(tick)` (`dom/staff.cpp:270-286`) and drawn in its own role.
- **Drawn object:** `InstrumentName`, a TextBase (XML rich text), in four roles — `STAFF`, `SHARED_STAFF`,
  `PART`, `GROUP` (`dom/instrumentname.h:32-34`).
- **The printed name is BUILT** from the instrument: name + "in" + transposition + number, in one of four
  formats (`rendering/score/systemheaderlayout.cpp:1017-1085`); a custom name replaces it (1040-1042).
- **Change mid-score:** an instrument change sets a new Instrument at a tick (`Part::setInstrument(…,
  Fraction)`, `part.h:144`); names are read at each system's first measure (`systemheaderlayout.cpp:1339,
  1379`) ⇒ the new name shows from the next system.
- ⛔ **A staff cannot have a name with no instrument**: every staff belongs to a Part, and a Part has an
  Instrument. The StaffType label is an addition on top.
- **Groups.** Consecutive parts with the same instrument id get one automatic `GROUP` name, e.g. "Horn in
  F" with 1 and 2 on the staves (`systemheaderlayout.cpp:1453-1510, 1026-1037`). Separately a `BracketItem`
  of type `GROUP` carries a `StaffLabel` (default "GROUP" / "GR.", `dom/bracketitem.h:59-82`), drawn beside
  the bracket, centred on its height, optionally vertical (`rendering/score/tlayout.cpp:1524-1590`). A
  part's name is centred on its visible staves (`systemheaderlayout.cpp:655-666`); a single staff's on
  its box (625-631).
- **Engraving** (`style/styledef.cpp`): `instrumentNameOffset 1.0sp` (56), scaled UP with the font size,
  never down (`systemheaderlayout.cpp:341-367`) · `RIGHT_RIGHT` for long and short (69-70) · Edwin 10 pt,
  scaling with the staff space, right/baseline (1109-1131) · first system indented, `firstSystemIndentationValue
  5.0sp` (582-583) · long on the first system, short after (587-588) · hidden when there is only ONE
  instrument (586) · indent = `max(names width + offset, 5sp − bracket width)` ⇒ it GROWS to fit on every
  system (`systemheaderlayout.cpp:1569-1574`).

## 3. Verovio / MEI — the label is independent of `<instrDef>`

- **Model.** `<label>` / `<labelAbbr>` child elements on `staffGrp`, `staffDef` and `layerDef`
  (`src/view_page.cpp:488-496`); they may contain `lb`, `rend` and text (`src/label.cpp:41-44`), several
  lines centred by the `<lb>` count (`view_page.cpp:512-515`). `<instrDef>` is used ONLY for MIDI
  (`src/doc.cpp:528-621`) ⇒ a label needs no instrDef. The drawing reads the child elements, not `@label`.
- **Full vs abbreviated.** The full label at the start and after a section restart; `labelAbbr` everywhere
  else (`view_page.cpp:273`, `src/setscoredeffunctor.cpp:285, 303-310`). A plain `<scoreDef>` change carries
  only clef, key and meter into the drawing (`setscoredeffunctor.cpp:298-303`) ⇒ a label changed mid-score
  seems to show only after a restart — **UNKNOWN** end to end.
- **Groups.** A staffGrp label at the group symbol's x − 1 sp, vertically at the group's middle − ½ sp
  (`view_page.cpp:350-356`).
- **Engraving** (1 sp = 18 units, `include/vrv/vrvdef.h:455`): right-aligned at the system's x − 1 sp, or
  3 sp further left when the staff also has layerDef labels (`view_page.cpp:390-398, 529`); baseline
  2.5 sp below the top line — ½ sp below the middle line (391); the text font at lyric size, `lyricSize 4.5`
  units = 2.25 sp (`src/options.cpp:1403-1405`, `doc.cpp:2400`); the widest label + 1 sp is added before the
  system (`view_page.cpp:539`, `src/scoredef.cpp:569-574`, `src/alignfunctor.cpp:551, 574`) ⇒ the indent
  GROWS to fit; no fixed first-system indent found.
