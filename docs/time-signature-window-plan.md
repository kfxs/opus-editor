# Time Signature window — the unfinished business (PLANNED)

The window shipped LOOK-FIRST (`4c0d346`, `dd86c2c`): `src/windows/timeSignatureWindow.ts` draws
Sibelius's dialog and touches no score. This records what each remaining control needs, so the
wiring is a series of decisions already made rather than a series taken in a hurry.

## 0. Where the controls belong (the sorting that drove the design)

A dialog's options are not all the same KIND of thing, and confusing the three is how a checkbox
ends up as a score field:

| Control | Kind | Where it lives |
|---|---|---|
| the meter | score DATA | `Measure.timeSignature` + `timeSignatureChange` — exists |
| Pickup (Upbeat) | score DATA | `Measure.actualDurationOverride` — exists |
| Beam and Rest Groups… | score DATA | `TimeSignature.grouping` — exists but too shallow (§2) |
| Allow cautionary | ENGRAVING decision | nowhere yet (§1) |
| ~~Rewrite bars up to next TS~~ | parameter of the EDIT | **nowhere, ever** — removed (§3) |

## 1. Allow cautionary — OPEN FORK, decide before building

Today a cautionary meter is drawn with no say in the matter: `MeasureLayout` (~line 290) sets
`cautionaryEndTimeSig` on the last measure of a line whenever the next line opens a meter change.
There is no way to suppress one.

The value is a display decision — the meter is identical either way, only the courtesy glyph at the
previous system's end appears or does not — so it does NOT belong on the content model beside the
meter itself. Two candidate homes:

**(a) The engraving-overrides compartment, position-keyed.** Precedent: rest hide/show is already a
BOOLEAN in the compartment, so it holds more than geometry. Keyed like `restPositionKey` — a meter
change has no id.

**(b) A sibling field to the existing `Measure.timeSignatureHidden`.** Keeps both "is a time
signature's glyph drawn" questions in one place.

**Recommendation: (a).** A cautionary exists only because of where the LINE BREAK falls — it is a
layout-time courtesy, not a property of the bar — and the compartment is where authored display
decisions go. The counter-argument is real though: two neighbouring booleans about the same glyph
living apart is its own kind of confusion. **Not decided; do not build until it is.**

Note the polarity: Sibelius's checkbox is *Allow* cautionary, default ON. Whatever is stored should
therefore be the SUPPRESSION (absent = drawn), so an untouched score carries no entries at all.

## 2. Beam and Rest Groups… — PARTLY BUILT

`src/windows/beamGroupsWindow.ts` opens from the button with ONE control: the beat grouping, in
denominator units, judged as you type. The rule moved out of App.vue's Vue computeds into
`src/utils/groupingInput.ts` (pure, tested) so the plain-TS window and the surviving Vue dialog
cannot drift apart on what a legal grouping is.

### TODO — what is deliberately NOT in it

1. **REST GROUPING — not modelled at all.** How rests coalesce within a beat group has no field, no
   rule and no renderer support. The window is named for what it will be, not what it is; nothing in
   it stands in for the rest half, because a control that did nothing would be worse than its
   absence. This is the first thing to design when the feature is picked up.
2. **PER-NOTE-VALUE GROUPING.** `TimeSignature.grouping` is ONE array, so it states *a* grouping and
   cannot state two levels: "eighths as 3+3+2 but sixteenths as 4+4+4" — a secondary-beam-break
   decision with nowhere to live. Not a stub over a missing field: a stub over a field one level too
   shallow. Deciding it reaches `utils/beaming` and `utils/restFill`.
3. **Sibelius's actual dialog is unverified.** The shape above is from memory. **Get a screenshot
   before building further** — a proper one was promised and this paragraph is not a substitute.
4. **Nothing commits.** The grouping is held by the Time Signature window (`grouping`, a local) and
   goes nowhere until §4 wires OK.

## 3. Rewrite bars up to next time signature — REMOVED, and staying removed

Unchecked, Sibelius changes only the meter's LABEL and leaves the notes in their bars, so the bars
stop adding up. It permits that; we do not — a bar's capacity is a fact here, relied on by rest-fill,
playback and coordinate mapping. `setTimeSignature` → `rebarRegion` always rewrites, so the checkbox
had exactly one reachable state, and a control that teaches a choice which does not exist is worse
than no control.

It returns only if bars are allowed not to add up — a MODEL decision, and the same one freely-notated
music will need (`docs/DESIGN-PRINCIPLES.md`, "keep the measures spine removable"). Not a checkbox.

## 4. OK — what commits

Not built. When it is: the meter through `setTimeSignature` (which rebars), the pickup through
`actualDurationOverride`, the cautionary through §1. The window should ARM nothing — unlike the Clef
window, a meter change has a target bar, so OK applies to the selection rather than waiting for a
click. That asymmetry is worth stating out loud when it is built.
