# Staff labels — the standards and the commercial editors

> **Findings only**, in the manner of `docs/research/glissando-industry-research.md`. ⛔ Nothing here is a
> decision (`docs/plans/staff-label-plan.md` makes them). ⚠️ A research file does not know what was DECIDED.
>
> Written 2026-09-28 from the web: the MusicXML 4.0 and MEI 5 specifications, the Dorico help archives
> and blog, Scoring Notes on Sibelius, the Finale user manuals and the MuseScore Studio handbook. Every
> claim carries its URL. **UNKNOWN** marks what could not be verified; it does NOT mean silent.

## 0. Synthesis

- ⭐ **Every standard and every editor keeps a DISPLAYED name (long + short) apart from the playback /
  instrument identity.** MusicXML and MEI hold them as different elements. Dorico and MuseScore DERIVE the
  label from the instrument; Sibelius and Finale treat it as editable text.
- ⛔ **None of the commercial editors lets a staff exist without an instrument** (Dorico: every staff
  belongs to an instrument; MuseScore: to a Part, which has one). ⇒ a labelled staff with NO instrument —
  the sketch's case — is something they cannot say. Only MEI (a `label` with no `instrDef`) can.
- **A per-STAFF label inside a multi-staff unit**: MEI (`staffDef`, even `layerDef`) and Sibelius 2022.9
  (staff names). MusicXML cannot (a staff has only a number); Finale uses group names instead.
- **The common default:** full name on the first system, short on later ones, full again at a new
  section / flow. **Dorico** exposes it as a table — first system / subsequent systems, each **Full /
  Abbreviated / None**, per flow and layout, with overrides at positions.
- **Hiding keeps the text** (MusicXML `print-object`, Finale's display toggle, MuseScore's style setting) —
  it never deletes it.

## 1. MusicXML 4.0

- `<score-part>` requires `<part-name>`; `<part-name-display>`, `<part-abbreviation>`,
  `<part-abbreviation-display>`, `<score-instrument>` (0+) and `<player>` (0+) are optional.
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/score-part/
- `<part-name>` / `<part-abbreviation>` *"describe the name and abbreviation of a <score-part> element"*;
  their formatting attributes were *"deprecated in Version 2.0 in favor of the <part-name-display> and
  <part-abbreviation-display> elements"*; they carry `print-object` (default yes).
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/part-name/
- `<part-name-display>` is *"used for exact formatting of multi-font text in part names to the left of the
  system"* and overrides `<part-name>`'s formatting ⇒ identity (`part-name`, required even when not
  printed) is split from what is drawn.
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/part-name-display/
- **Mid-score change:** inside `<print>`, *"The <part-name-display> and <part-abbreviation-display>
  elements may also be used here to change how a part name or abbreviation is displayed over the course
  of a piece"* — at a new system.
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/print/
- **Instrument identity is another layer:** `<instrument-name>` *"is typically used within a software
  application, rather than appearing on the printed page of a score"*; a `<score-instrument>` has *"a
  required ID attribute, a name, and an optional abbreviation"*, several per part (Clarinet 1, Clarinet 2).
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/instrument-name/ ·
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/score-instrument/
- **Groups:** `<group-name>`, `<group-abbreviation>` and their `-display` forms, formatted text *"to the left
  of the system"*, with `print-object`.
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/group-name-display/
- ⛔ **No staff-level name:** `<staff-details>` has no name child; a staff is only its `number`.
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/staff-details/

## 2. MEI 5

- *"The label and labelAbbr subelements may be used for providing staff labels for the first and
  subsequent systems."* On `staffGrp` they give *"a shared label to the group"*.
  https://music-encoding.org/guidelines/v5/content/cmn.html
- `labelAbbr` is *"A label on the pages following the first"*, allowed in `staffDef`, `staffGrp`,
  `layerDef`, `grpSym` and `verse` ⇒ a single staff — even a layer — can be labelled.
  https://music-encoding.org/guidelines/v5/elements/labelAbbr.html
- The `<label>` ELEMENT is the rendered text; the `@label` ATTRIBUTE is for *"a 'tool tip' or other
  generated label"*. https://music-encoding.org/guidelines/v5/content/cmn.html
- `instrDef` is only a *"MIDI instrument declaration"* ⇒ label and instrument are fully independent.
  https://music-encoding.org/guidelines/v5/elements/instrDef.html

## 3. Dorico

- *"Staff labels are used to identify staves in music containing multiple players, and are positioned to
  the left of systems, before the initial barline."* They show INSTRUMENT names; for a player holding
  several instruments, the one currently playing; a mid-system change is written above the staff and the
  label updates at the next system.
  https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_staff_labels/notation_reference_staff_labels_c.html
- ⭐ **Layout Options → Staves and Systems:** "Staff labels on first system" and "Staff labels on subsequent
  systems", each **Full / Abbreviated / None**, *"These settings apply to each flow in the layout."*
  Default: full scores full-then-abbreviated, parts none. The length can be overridden at specific positions.
  https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_staff_labels/notation_reference_staff_labels_hiding_showing_length_changing_t.html
- Full and short names are edited per instrument ("Edit Instrument Names"), apart from the layout name;
  instrument numbers are added automatically.
  https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_staff_labels_instrument_names_c.html ·
  https://blog.dorico.com/2019/08/tip-edit-staff-labels/
- **"Show player names"** (per player; on all systems or first only) takes the label from the PLAYER
  instead — a percussion staff called simply "Percussion", opera characters.
  https://blog.dorico.com/2022/06/tip-show-player-names-instead-of-instrument-names/ ·
  https://forums.steinberg.net/t/where-did-show-player-names-option-in-layout-options-go/852936 —
  the version that introduced it: **UNKNOWN**.
- ⛔ **A staff with no instrument: not possible** as far as found; users fake custom labels by renaming
  instruments, or with divisi / condensing. https://forums.steinberg.net/t/custom-staff-labelling/881523
- Engraving Options → Staff Labels: the gap to the systemic barline, Arabic / Roman numbering, grouping of
  adjacent identical instruments, vocal labels in capitals, ossia and condensed-staff labels.
  https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_staff_labels/notation_reference_staff_labels_project_wide_engraving_options_c.html —
  the default VALUES: **UNKNOWN** (the page lists none).

## 4. Sibelius and Finale

- **Sibelius.** Engraving Rules → Instruments: full names at the start, short names on later systems;
  short may be None *"if instrumentation is obvious"*; double-click to edit, and editing a short name
  affects all later systems. Renaming is separate from Instruments → Change (sound and transposition).
  https://www.scoringnotes.com/tips/working-with-instrument-names-in-sibelius/ · a setting for names "at new
  sections": https://www.sibeliusforum.com/viewtopic.php?t=5106 (exact wording **UNKNOWN**). ⭐ **Staff
  names (2022.9):** full and short names PER STAFF of an instrument, in their own text style, beside the
  instrument name (which stays centred between the staves). https://www.scoringnotes.com/news/sibelius-2022-9/
- **Finale.** *"Each staff … can have a full name … which appears in the first system … and a second name
  (often abbreviated) … on all subsequent systems."* Multi-staff instruments *"do not have individual staff
  names, but rather use group names"*. Names can be hidden but kept (Staff Attributes → Items to Display).
  https://usermanuals.finalemusic.com/Finale2014Mac/Content/Finale/Staff_names.htm · Staff Styles can override
  the full or abbreviated name for a SECTION of the staff.
  https://usermanuals.finalemusic.com/Finale2012Win/Content/Finale/STAFFSTYLEDLG.htm

## 5. MuseScore 4 (user-facing)

- Long and short instrument names *"are the labels which can be shown to the left of the staves"*; long on
  the first system of the score or of a section, short after; visibility in Format → Style → Score, not by
  deleting the names; both are instrument/part properties.
  https://handbook.musescore.org/notation/instruments-staves-and-systems/staff-part-properties
- Per-staff names within a part (user-facing): **UNKNOWN** (the source-level answer is in
  `staff-label-engines-research.md` §2 — a `StaffType` label).

## 5b. Fonts, sizes, styles (added 2026-09-28)

MuseScore: Edwin 10.0 pt, upright, staff-scaled (verified from source). Dorico, Sibelius, Finale: defaults
**UNKNOWN** — see `measure-number-industry-research.md` §7.

## 6. Accessibility and semantics

- MusicXML makes `part-name` required even when not printed (`print-object="no"`), keeping an identity name
  for parts lists and tools apart from what is printed.
  https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/part-name/
- MuseScore supports NVDA, VoiceOver and a live braille view (https://handbook.musescore.org/navigation/accessibility);
  whether it announces the staff label: **UNKNOWN**. A formal convention for screen readers or part
  extraction built on staff labels: **UNKNOWN** — none found.
