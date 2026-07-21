# Time Signature window — what shipped, and what is left

Built LOOK-FIRST (`4c0d346`, `dd86c2c`), then wired (`abacdac`, `4d3d6d3`, `8d25561`, `75b918c`).
`src/windows/timeSignatureWindow.ts`. The Vue time palette it replaced is deleted (`e5af4b6`).

**Working:** the meter (presets, `Other`, C and ¢), its grouping, *Allow cautionary*, the pickup —
all armed by OK and applied to the bar you click next.

**Left:** rest grouping is not modelled at all (§2), and Sibelius's real Beam and Rest Groups dialog
has never been seen (§2).

## 0. Where the controls belong (the sorting that drove the design)

A dialog's options are not all the same KIND of thing, and confusing the three is how a checkbox
ends up as a score field:

| Control | Kind | Where it lives |
|---|---|---|
| the meter | score DATA | `Measure.timeSignature` + `timeSignatureChange` — exists |
| Pickup (Upbeat) | score DATA | `Measure.actualDurationOverride` — exists |
| Beam and Rest Groups… | score DATA | `TimeSignature.grouping` — exists but too shallow (§2) |
| C / ¢ | score DATA (its SPELLING) | `TimeSignature.symbol` — the meter's own, like a pitch's enharmonic |
| Allow cautionary | ENGRAVING decision | the overrides compartment, keyed to the CHANGE (§1) |
| ~~Rewrite bars up to next TS~~ | parameter of the EDIT | **nowhere, ever** — removed (§3) |

## 1. Allow cautionary — SHIPPED (`abacdac` meters, `1b4a656`+`69d2755` clefs)

**The fork below was resolved by the user, and the resolution reframed it.** Storing a
*suppression* was wrong, because it implies a score-wide default to suppress FROM. There is none: a
courtesy can only exist where a meter (or clef) CHANGES, so it is a property of the change, and the
rule is one condition in two halves — the flag, and whether that change opens a system. Nothing is
drawn and then hidden; a courtesy that is not allowed is never produced.

Shipped as a payloadless `cautionary` override, **presence = allowed**, keyed by the id of the
measure the change STARTS at — not the bar the glyph lands on, which moves on every reflow. The clef
twin is `cautionaryClef`, keyed per (measure, staff), and its courtesy is now computed PER STAFF
(`cautionaryEndClefs`), so a change on the lower staff of a piano score warns there and nowhere else.

⚠️ Consequence, and it is the model's rather than a preference: **a change with no flag draws no
courtesy** — pasted and loaded changes included.

⚠️ It shipped broken once: three sites built the compartment key three ways (the first staff is
ABSENT from a key, never named). `keyStaffId` is now the one place that rule lives.

### The original fork, kept for the reasoning

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

**Chosen: (a).** A cautionary exists only because of where the LINE BREAK falls — it is a
layout-time courtesy, not a property of the bar — and the compartment is where authored display
decisions go.

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

## 4. OK — BUILT

OK **applies to the selected bar when there is one, and otherwise arms** — the next click on the
score then says which bar.

Arming answers "WHERE?", so a bar that is already boxed has answered it: making the user click that
same bar a second time is the dialog ignoring what it was handed. Either box counts — the
Ctrl+Shift+click double box and the plain-click single one differ in what they select *inside* the
bars, and a meter change does not care. A SPAN applies at its lowest bar, because a meter change is
a point event that runs to the next change; writing it into every bar of the span would be three
changes saying the same thing.

The box stays up afterwards: you are looking at the bar you just changed.

Both paths go through **`MusicEngine.applyTimeSignatureChange`** — the meter, its cautionary and its
pickup are three mutators and ONE act, wrapped in a `runBatch` so a dialog costs one Ctrl+Z rather
than three. Sharing it is the point: the click path and the selection path cannot drift, and neither
can grow a step the other forgets.

(⏭️ The **Clef** window still always arms. It should learn the same rule — the argument is identical
— but a clef is anchored to a beat and a staff, not just a bar, so "the selected bar" is not the
whole of its answer.)

Three things travel with the armed meter, all of them properties of the change about to be made,
none of which has anywhere else to wait until the target bar is known:

| carried | applied as |
|---|---|
| the `TimeSignature` (grouping and `symbol` included) | `setTimeSignature` — which rebars |
| *Allow cautionary* | the `cautionary` override on the same measure (§1) |
| the pickup length | `setMeasureActualDuration` on the same measure |

The pickup lands on the bar the meter opens, so there is no second target to choose — and unticking
the box is an ANSWER (`null`, clear any pickup there), not a silence (`undefined`, the old palette
path having no opinion). That distinction is what lets the older arming path leave these flags
exactly as it found them.
