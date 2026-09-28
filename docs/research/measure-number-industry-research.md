# Measure (bar) numbers — the standards and the commercial editors

> **Findings only**. ⛔ Nothing here is a decision (`docs/plans/measure-number-plan.md` makes them).
> ⚠️ A research file does not know what was DECIDED.
>
> Written 2026-09-28 from the web (MusicXML 4.0, MEI, the Dorico v5 help archive, the Sibelius 8 Reference,
> the Finale manual, the MuseScore handbook) plus two sources on disk: MuseScore's `styledef.cpp` and the
> `musxdom` Finale reader (`~/dev/engine-sources/musxdom/src/musx/dom/Others.h`). Every claim carries its
> source. **UNKNOWN** marks what could not be verified; it does NOT mean silent.

## 0. Synthesis

- ⭐ **Every standard and editor keeps the bar's IDENTITY apart from the number PRINTED on it**, and the
  printed value is TEXT, not an integer (MusicXML `number` token + `text`; MEI `@n` string + `<mNum>`).
- **The usual default:** a number at the start of every system, **bar 1 not shown**, above the top staff,
  aligned with the system's initial barline (Dorico, Sibelius, MuseScore).
- **Custom numbering, as the editors expose it**, needs at least: a RESTART at a new number · "don't count
  this bar" · a suffix / format ("12a", "2a 2b 2c") · added text · "follow previous" (re-derived when bars
  move) vs a fixed number.

| | Which systems | Bar 1 shown? | Position | Font | Size | Style |
|---|---|---|---|---|---|---|
| Dorico | start of every system | UNKNOWN | above the top staff, at the initial barline | Academico (presumed) | 9 pt (one forum user) | UNKNOWN |
| Sibelius | every system | **no** (off by default) | above the top staff, left-aligned with the initial barline | UNKNOWN | UNKNOWN | UNKNOWN |
| Finale | per region | "hide first" option | top staff | UNKNOWN | UNKNOWN | UNKNOWN |
| MuseScore | every system | **no** | above the system, 2 sp up, left at the barline | Edwin | 8 pt, fixed | **italic** |
| MusicXML | a `system` value exists | `implicit` bars never shown | `staff` / `system` attributes | in the file | in the file | in the file |

## 1. MusicXML 4.0

- `<measure number>` is a required **token**: *"The attribute that identifies the measure. Going from
  partwise to timewise, measures are grouped via this attribute."* — a KEY, not a count.
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/measure-partwise/
- `text` (type `measure-text`, a token of ≥ 1 character): *"allows specification of displayed measure numbers
  that are different than what is used in the number attribute."*
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/measure-text/ (version that added it: **UNKNOWN**)
- `implicit="yes"`: *"for measures where the measure number should never appear, such as pickup measures and
  the last half of mid-measure repeats."* `non-controlling="yes"`: *"the left barline in this measure does not
  coincide with the left barline of measures in other parts"* (multimetric music).
- `<measure-numbering>` in `<print>`: `none` / `measure` / `system`
  (https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/measure-numbering-value/), with font,
  position, `halign`/`valign`, and — new in 4.0 — `staff` (which staff sets the vertical position, default 1),
  `system` (`only-top`, `only-bottom`, `also-top`, `also-bottom`, `none`), `multiple-rest-always`,
  `multiple-rest-range`. https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/measure-numbering/ ·
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/system-relation-number/ ·
  https://www.w3.org/2021/06/musicxml40/version-history/40/

## 2. MEI

- `@n` on a measure: *"Often, this is an integer, but not always… incomplete measures or those under an
  ending mark, may have labels that contain an integer plus a suffix, such as '12a'… entirely non-numeric
  strings… an explicit measure number should restart numbering with the given value."* (citing Read, p. 445).
  https://music-encoding.org/guidelines/v4/elements/measure.html
- `@label` is a general label / tooltip, ⛔ not the measure-number mechanism.
  https://music-encoding.org/guidelines/v5/elements/measure.html
- `<mNum>`: *"Use this element when the n attribute on measure does not adequately capture the appearance or
  placement of the measure number/label."* `@metcon="false"` marks an irregular bar such as a pickup.
- MEI's MuseScore mapping: a bar excluded from the count gets no `@n`; text numbers like "3a" are
  *"currently not exported"*. https://music-encoding.org/musescore-doc/docs/features/measures.html

## 3. Dorico

- Default: *"a bar number at the start of each system in all layouts by default"*, *"above the staff, and
  aligned with the initial barline."*
  https://archive.steinberg.help/dorico_pro/v5/en/dorico/topics/notation_reference/notation_reference_bar_numbers/notation_reference_bar_numbers_c.html
- Frequency: Every system / Every n bars (Interval) / Every bar / None.
  https://archive.steinberg.help/dorico_pro/v5/en/dorico/topics/notation_reference/notation_reference_bar_numbers/notation_reference_bar_numbers_hiding_showing_frequency_changing_t.html
- Placement Above / Below; "Show above specific players"; one bar-number position per system.
  https://archive.steinberg.help/dorico_pro/v5/en/dorico/topics/notation_reference/notation_reference_bar_numbers/notation_reference_bar_numbers_position_vertical_changing_t.html ·
  https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_bar_numbers_positions_c.html
- ⭐ Bar number changes: **Primary / Subordinate / Don't Include / Continue Primary**.
  https://archive.steinberg.help/dorico_pro/v5/en/dorico/topics/notation_reference/notation_reference_bar_numbers/notation_reference_bar_numbers_sequence_changes_adding_t.html
  Subordinate: four bars added after bar 10 become *"10a to 10d"*, lower-case by default, *"useful for
  numbering repeat endings"*.
  https://archive.steinberg.help/dorico_pro/v5/en/dorico/topics/notation_reference/notation_reference_bar_numbers/notation_reference_bar_numbers_subordinate_c.html
  Repeats typically do not increase the count.
- Font: paragraph styles "Bar numbers (score)" and "Bar numbers (parts)", *"Initially, both paragraph styles
  have the same settings"* — no values given. **9 pt** is one forum user's word (2019), unconfirmed:
  https://forums.steinberg.net/t/how-to-change-bar-number-size/123403. Style, distance above the staff, and
  whether bar 1 shows: **UNKNOWN**.

## 4. Sibelius (Sibelius 8 Reference, pp. 490–496, https://resources.avid.com/SupportFiles/Sibelius/8.0/reference.pdf)

- Default Every system; also Every n bars (*"typical values… 1, 5 and 10"*) and No bar numbers.
- ⭐ *"Show on first bar of sections, which is switched off by default"* ⇒ bar 1 is not numbered. Count repeats off.
- First number of a system *"Left-align with initial barline"*; other numbers centred above their barlines.
  Vertical: Above top / Above middle / Below middle / Below bottom of staff. *"Normally bar numbers go above the
  top staff… and above one or more other instrumental families"* — up to 5 staves, incl. "Below bottom staff".
- ⭐ Bar Number Change dialog: **New bar number** · **Follow previous bar numbers** · **No bar number (and don't
  count bar)** · **Add text** before or after · **Change format** 1,2,3 / 1a,1b / 1A,1B / a,b / A,B — bars
  inserted after bar 2 become *"2a, 2b, 2c, 2d, and the next bar would still be numbered 3."*
- A pickup bar is numbered **0**.
- Text styles "Bar numbers" and "Bar numbers (parts)"; font, size and italic defaults: **UNKNOWN**.
- 2004 Hints PDF: *"at the beginning of each system"*, top staff, *"bar number in the first bar (bar number
  1), which by default does not exist."* http://www.sibelius.com/helpcenter/hintsandtips/HintsTips-ManagingBarNum.pdf

## 5. Finale

- **Measure Number Regions**: a measure range + Starting Number; numeric, alphabetic (doubled aa, bb) or time
  code; prefix and suffix; "Show on Start of Staff System", "Show Every n beginning with"; "Hide First
  Measure Number in Region"; Top staff / Bottom staff / Exclude others; separate fonts and enclosures for
  start-of-system and mid-system numbers; independent score and part settings. Per bar, "Include in Measure
  Numbering" (`noMeasNum`). https://usermanuals.finalemusic.com/FinaleMac/Content/Finale/MNDLG.htm ·
  `~/dev/engine-sources/musxdom/src/musx/dom/Others.h`
- Default font and size: **UNKNOWN**.

## 6. MuseScore 4 (handbook + `styledef.cpp`)

- Format → Style → Measure numbers: start of each system (default) or an interval; Above system / Below system
  / On all staves. "Show initial measure number" off by default.
  https://handbook.musescore.org/notation/rhythm-meter-and-measures/measure-numbering
- Per measure: "Exclude from measure count", "Add to measure number" (an offset), "Always show / hide".
- Source defaults: Edwin **8.0 pt italic**, fixed size (`SpatiumDependent=false`); −2 sp above (+2 below),
  left at the barline, no frame. Text numbers like "3a" exist only as text; MEI export drops them.

## 7. Staff labels (instrument names) — filling `staff-label-industry-research.md`'s UNKNOWNs

- **MuseScore:** long and short names Edwin **10.0 pt, upright**, right-aligned, **scaled with the staff**
  (`longInstrumentFontSpatiumDependent=true`, `styledef.cpp:1109-1139`) — verified.
- **Dorico:** the staff-label paragraph styles; a forum post shows 10.0 pt for one label, not a stated
  default. https://forums.steinberg.net/t/change-size-of-percussion-instrument-staff-label/844796 — defaults **UNKNOWN**.
- **Sibelius:** the "Instrument names" text style; traditionally centred, right-aligned also common; size /
  style **UNKNOWN**.
- **Finale:** Document Options → Fonts → Staff Names; defaults **UNKNOWN**.
