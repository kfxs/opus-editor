# Measure (bar) numbers — how LilyPond, MuseScore and Verovio model and draw them

> **Findings only**. ⛔ Nothing here is a decision (`docs/plans/measure-number-plan.md` makes them).
> ⚠️ A research file does not know what was DECIDED.
>
> Written 2026-09-28 from the SOURCE on disk, `~/dev/engine-sources/{lilypond,MuseScore,verovio}` (MuseScore
> commit `929d1e9`, 2026-08-18); no web docs were needed. Paths are relative to each repo.
> **UNKNOWN** marks what could not be verified.

## 0. Synthesis

| | LilyPond | MuseScore | Verovio |
|---|---|---|---|
| Model | a running COUNTER, reset by `\set` | the bar's INDEX + a stored offset (`noOffset`); `irregular` skips a bar | stored `@n` / `<mNum>` TEXT |
| Pickup | shares number 1 (first full bar = 1) | excluded (first full bar = 1) | as the source says; "0"/"1" hidden |
| Which bars (default) | each system start except the first | each system start, bar 1 hidden | each system start, "0"/"1" hidden |
| Staves | top | top (`ABOVE_SYSTEM`) | top visible |
| Horizontal | right edge AT the system's left edge (before the clef); mid-line: left at the barline | left edge at the bar's barline | CENTRED on the bar's left x |
| Vertical | 1.0 sp padding, outside-staff skyline | baseline 2.0 sp above the top line; min distance 0.5 sp | baseline ≈ 1.35 sp above, fixed |
| Size | ≈ 8.7 pt ≈ 1.75 sp | 8 pt, FIXED (not staff-scaled) ≈ 1.6 sp | 1.8 sp em |
| Style | serif, **upright** | Edwin, **italic** | Times, **italic** |
| Frame | none | none (box / circle available) | none |
| Multi-bar rest range | none (a bar COUNT instead) | off by default; "a–b" in brackets, 8 pt italic, below | UNKNOWN |
| **Staff label** (instrument name) | 11 pt ≈ 2.2 sp, upright | Edwin 10 pt ≈ 2.0 sp, upright, staff-scaled | 2.25 sp, upright |

⇒ All three default to his rule — **a number at the start of each system except the first, on the top staff**.
⇒ The displayed number is never the bar's identity: a counter, an index + offset, or stored text.

## 1. LilyPond

- **Model — a counter in `Timing`, not stored per bar.** `lily/timing-translator.cc:426-430` sets
  `currentBarNumber` to 1 (plus `internalBarNumber`, which the user cannot change); `:553-565` adds one each
  time `measurePosition` reaches `measureLength`. `\set Score.currentBarNumber = #50` overwrites it mid-piece
  (`Documentation/en/notation/rhythms.itely:4067-4079`).
- **Pickup:** `\partial` sets `measurePosition` to minus the pickup length (`timing-translator.cc:175`); the
  counter advances only at the bar length ⇒ the pickup SHARES number 1 with the first full bar.
- **Endings:** `alternativeNumberingStyle` (`scm/define-context-properties.scm:68`) unset ⇒ numbering continues
  through them; `numbers` resets at each later ending (`timing-translator.cc:326-342`); `numbers-with-letters`
  adds a letter (`bar-number-engraver.cc:228`) via `robust-bar-number-function`
  (`scm/translation-functions.scm:1011`). A number falling mid-bar (a bar broken by `\bar ""`) is printed in
  parentheses by the same formatter.
- **Which bars — two filters, both must pass:** `barNumberVisibility =
  #first-bar-number-invisible-and-no-parenthesized-bar-numbers` (`ly/engraver-init.ly:858`, defined
  `translation-functions.scm:1005`: > 1 and at a bar's start) AND `BarNumber.break-visibility =
  begin-of-line-visible` (`scm/define-grobs.scm:325`) ⇒ every system start except the first. Alternatives:
  `every-nth-bar-number-visible n`, `modulo-bar-number-visible n m`, `all-bar-numbers-visible`
  (`translation-functions.scm:987-1034`). One per score — a Score-level engraver.
- **Position (`define-grobs.scm:319-351`):** anchored at the system's left edge (`break-align-symbols (left-edge
  staff-bar)`, `X-extent (0 . 0)`, `:2106`); `self-alignment-X (break-alignment-list LEFT LEFT RIGHT)`
  (`scm/output-lib.scm:506`) ⇒ at a line start RIGHT-aligned to the system's left edge — before the clef,
  sticking out left of the staff (the grob's comment: "want the bar number before the clef at line start");
  mid-line left-aligned to the barline. Vertically `direction UP`, `padding 1.0` sp, `outside-staff-priority
  100`, placed by the skyline; `move-to-extremal-staff` puts it on the top staff.
- **Font:** `font-size -2` = 2^(−2/6) ≈ 0.794 × the 11 pt text (`scm/paper.scm:78`) ≈ 8.7 pt at a 20 pt staff
  ≈ 1.75 sp; "LilyPond Serif" (`ly/paper-defaults-init.ly:170`), upright; no frame.
- **Multi-bar rests:** no range text; `MultiMeasureRestNumber` shows the COUNT. Collisions: the skyline,
  `horizon-padding 0.05`.
- **Instrument name:** no `font-size` ⇒ 11 pt ≈ 2.2 sp, upright serif, padding 0.3, centred
  (`define-grobs.scm:1852-1860`).

## 2. MuseScore

- **Model — derived from the index, with two stored adjustments.** `MeasureLayout::adjustMeasureNumber`
  (`src/engraving/rendering/score/measurelayout.cpp:443-457`): `m_measureNumber = running +
  m_measureNumberOffset`, counting one more only if the bar is not excluded. A section break can restart at 1
  (`startWithMeasureOne`). The per-bar fields are `m_measureNumberOffset` (saved `noOffset`) and
  `EXCLUDE_FROM_NUMBERING` (saved `irregular`) (`dom/measure.h:207-213`, `dom/property.cpp:256-257`); per-bar
  show / hide `MeasureNumberMode` AUTO / SHOW / HIDE (`measure.h:74`).
- ⚠️ The drawn text is `measureNumber()+1`, REWRITTEN by `setXmlText` on every layout
  (`measurelayout.cpp:584,601`) ⇒ a typed text override does not survive; the offset is the only way to change
  a number. `MeasureNumber` is a generated text element (`dom/measurenumber.cpp`).
- **Pickup:** the new-score dialog excludes it from numbering (`notation/internal/masternotation.cpp:247`) ⇒
  the first full bar is 1.
- **Which bars (`dom/measure.cpp:559-597`, style `style/styledef.cpp:510-514`):** `showMeasureNumber=true`,
  `showMeasureNumberOne=false`, `measureNumberSystem=true` ⇒ each system start, bar 1 hidden;
  `measureNumberInterval=5` applies only when `measureNumberSystem` is off.
- **Position:** `measureNumberPlacementMode=ABOVE_SYSTEM` = top staff only (`dom/staff.cpp:239`; alternatives
  BELOW_SYSTEM, ON_SYSTEM_OBJECT_STAVES, ON_ALL_STAVES); `measureNumberHPlacement=LEFT`,
  `measureNumberAlignToBarline=true` ⇒ left-aligned at the bar's opening barline, or x = 0 with none
  (`rendering/score/measurenumberlayout.cpp:47-90`); `measureNumberPosAbove=(0,−2)` sp ⇒ baseline 2 sp above the
  top line (`PosBelow (0,+2)`); LEFT / BASELINE.
- **Font (`styledef.cpp:1270-1289`):** Edwin 8 pt, FIXED (not scaled with the staff) ≈ 1.6 sp at the default
  1.75 mm space; `measureNumberFontStyle=2` = **italic** (`FontStyle::Italic = 1<<1`, `types/types.h:965`); no
  frame by default (rectangle / circle available, 0.2 sp padding, 0.1 sp line).
- **Multi-bar rests:** the range is off by default (`mmRestShowMeasureNumberRange=false`, `styledef.cpp:1311`);
  on, it reads "a–b" with an en dash, bracketed (`rendering/score/mmrestlayout.cpp:797-801`), Edwin 8 pt italic,
  below, centred, `PosBelow (0,1)` (`styledef.cpp:1311-1333`). Collisions: autoplace with
  `measureNumberMinDistance` 0.5 sp plus a barline check (`measurenumberlayout.cpp:99`).
- **Instrument name:** Edwin 10 pt, staff-scaled ≈ 2.0 sp, **upright** (`FontStyle::Normal`), right-aligned,
  baseline (`styledef.cpp:1109-1123`); `instrumentNameOffset` 1.0 sp (`:56`).

## 3. Verovio

- **Model — stored.** MEI `measure/@n` is a STRING. `Doc::GenerateMeasureNumbers` (`src/doc.cpp:303-330`)
  makes a generated `<mNum>` from `@n` when the measure has none; a hand-written `<mNum>` is the text override
  and is always drawn. `@label` is not used (only `GetN()`). MusicXML `implicit="yes"` ⇒ an empty `<mNum>`,
  drawn blank (`src/iomusxml.cpp:1884-1889`). Pickup: whatever the source numbers it; the automatic mode hides
  "0" and "1".
- **Which bars:** `mnumInterval` default 0 (`src/options.cpp:1423-1425`) ⇒ the first bar of each system unless
  its `@n` is "0" or "1" (`src/view_page.cpp:1021-1026`); N ≥ 1 ⇒ every bar whose `@n` divides by N;
  `scoreDef@mnum.visible=false` hides all; skipped when a rehearsal mark stands at the bar's start.
- **Position (`view_page.cpp:1027-1036, 1125-1156`):** top visible staff; x = the measure's left edge,
  **centred**; baseline max(0.5 sp, 60 % of the lyric size) = 1.35 sp above the top line; raised by the
  bracket-top glyph's height + 1/12 sp under a bracket. Hard-coded, no collision avoidance.
- **Font:** Times (Liberation if set), **italic**, 80 % of the lyric size = 0.8 × 2.25 = 1.8 sp em; `@fontsize`
  overrides; `DrawTextEnclosure` boxes or circles on `<rend>` request.
- **Multi-bar rest ranges: UNKNOWN** (not checked).
- **Instrument label:** lyric size at staff size, 2.25 sp, Times, **upright**, right-aligned (`view_page.cpp:511-525`).

**UNKNOWN:** Verovio's multi-bar rest range; LilyPond's exact rendered x at a line start (read from the
alignment rules, not rendered).
