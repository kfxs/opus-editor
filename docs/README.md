# docs/ — what is here, and which of it is live

147 files. ⚠️ **Nothing here is archived by moving it**: the code's comments cite these files by
path and section — 1,774 mentions of 118 of them, and the BUILT plans are the most cited of all
(`vexflow-removal-map` 122, `own-engraving-engine` 75, `render-performance-plan` 69, `pedal-plan` 66). A
finished plan is the record of WHY the code is the way it is, so it stays where the comments point. What
says whether a file is live is its own **Status** header — and this page.

⭐ **`npm run lint:doclinks`** (in `build:check`) holds every `docs/….md` a comment or a doc cites to a
file that exists — so a doc can be renamed or moved with its paths rewritten, and a missed one is named.

## The rules — read these first

- [ARCHITECTURE.md](ARCHITECTURE.md) — the layer map, the boundary lints, "where does X live?", the glossary
- [DESIGN-PRINCIPLES.md](DESIGN-PRINCIPLES.md) — the six principles and their boundary cases
- [test-layout-plan.md](test-layout-plan.md) — where a spec goes and what it is named
- [logging.md](logging.md) — `dbg()` — and why a suppressed log still costs its arguments
- [reference/README.md](../reference/README.md) — ⭐ the engraving LIBRARY's manifest — an engraving question starts here, before any web search
- [CLAUDE.md](../CLAUDE.md) — the rules an agent is held to

## Live — open work and open decisions

- [own-engraving-engine](own-engraving-engine.md) — ⭐ the engine — §0.5 is the DECISION list (⛔ not a queue) everything open is folded into
- [code-shape-plan-2026-09-19](code-shape-plan-2026-09-19.md) — the code-shape pass — Phases 1–5 done, Phase 6 (folders + docs) open
- [mark-drag-and-reanchor](mark-drag-and-reanchor.md) — OPEN — dragging a mark, and what re-anchors it
- [braces-brackets-plan](braces-brackets-plan.md) — DRAFT — braces and brackets
- [instruments-plan](instruments-plan.md) — the lane→instrument map — P1a built, P1b / P2 open
- [score-header-sketch](score-header-sketch.md) — 🚧 a SKETCH, to be thrown away — read before touching `ScoreHeaderPass`
- [json-io-plan](json-io-plan.md) — a sketch, on purpose — import / export reports, never repairs
- [span-mark-family-plan-2026-08-24](span-mark-family-plan-2026-08-24.md) — the span-mark family's tables — what a fifth line would be a row of

## Planned, not started

[20c-notation-survey](20c-notation-survey.md) · [hand-pan-tool-plan](hand-pan-tool-plan.md) · [metric-modulation-plan](metric-modulation-plan.md) · [multi-font-research](multi-font-research.md) · [octave-clefs-plan](octave-clefs-plan.md) · [unpitched-staves-plan](unpitched-staves-plan.md) · [tuning-systems-and-alteration](tuning-systems-and-alteration.md)

## How a part of the editor works (descriptions, not plans)

[above-staff-ladder](above-staff-ladder.md) · [articulation-stem-align](articulation-stem-align.md) · [barline-selection](barline-selection.md) · [beaming](beaming.md) · [clef](clef.md) · [copy-paste-spelling](copy-paste-spelling.md) · [firefox-zoom-repaint](firefox-zoom-repaint.md) · [keypad](keypad.md) · [marking-tools](marking-tools.md) · [menus-design](menus-design.md) · [note-selection-hit-detection](note-selection-hit-detection.md) · [passage-selection-marks](passage-selection-marks.md) · [pdf-export](pdf-export.md) · [ragged-last-system](ragged-last-system.md) · [tempo-menu](tempo-menu.md) · [windows-design](windows-design.md)

## Research — the sourced options behind an engraving number

⭐ Every number is one house style's DEFAULT (`own-engraving-engine.md` §0.3 rule 13); these are the
preset menu. ⚠️ A research file does not know what was DECIDED — the feature's own module does.

[accidental-dot-engines](accidental-dot-engines.md) · [accidental-dot-research](accidental-dot-research.md) · [accidental-ledger-clearance](accidental-ledger-clearance.md) · [barline-join-research](barline-join-research.md) · [beam-hook-research](beam-hook-research.md) · [beam-slope-research](beam-slope-research.md) · [braces-brackets-research](braces-brackets-research.md) · [clef-research](clef-research.md) · [clef-spacing-research](clef-spacing-research.md) · [dot-placement](dot-placement.md) · [engraving-number-inventory](engraving-number-inventory.md) · [fan-beam-spread](fan-beam-spread.md) · [header-spacing-research](header-spacing-research.md) · [ink-anchors-and-side-bearings](ink-anchors-and-side-bearings.md) · [key-signature-research](key-signature-research.md) · [ledger-line-length-research](ledger-line-length-research.md) · [line-marks-shape-research](line-marks-shape-research.md) · [mid-bar-sign-spacing-research](mid-bar-sign-spacing-research.md) · [multi-voice-rest-position](multi-voice-rest-position.md) · [note-level-gaps-research](note-level-gaps-research.md) · [outside-staff-marks-research](outside-staff-marks-research.md) · [page-system-frame-research](page-system-frame-research.md) · [rest-accidental-kerning-research](rest-accidental-kerning-research.md) · [score-text-fonts-research](score-text-fonts-research.md) · [slur-residue-research](slur-residue-research.md) · [slur-tie-research](slur-tie-research.md) · [smufl-fonts-research](smufl-fonts-research.md) · [spacing-model-research](spacing-model-research.md) · [staff-line-research](staff-line-research.md) · [stem-length-research](stem-length-research.md) · [stem-thickness-research](stem-thickness-research.md) · [tempo-marks-research](tempo-marks-research.md) · [tremolo-tuplet-research](tremolo-tuplet-research.md) · [vertical-spacing-research](vertical-spacing-research.md)

## Feature plans — how each feature was built, and why

The record the code's comments cite. Each file's header says what shipped and what is left.

[accidental-stamp-plan](accidental-stamp-plan.md) · [articulation-stamp-plan](articulation-stamp-plan.md) · [bar-width-plan](bar-width-plan.md) · [barline-join-plan](barline-join-plan.md) · [barline-types-plan](barline-types-plan.md) · [beam-engraving-plan](beam-engraving-plan.md) · [clear-range-plan](clear-range-plan.md) · [clef-model-plan](clef-model-plan.md) · [copy-paste-staff-plan](copy-paste-staff-plan.md) · [cross-barline-beaming-plan](cross-barline-beaming-plan.md) · [dynamic-offset-plan](dynamic-offset-plan.md) · [dynamic-voice-scope-plan](dynamic-voice-scope-plan.md) · [dynamics-line-and-hairpins-plan](dynamics-line-and-hairpins-plan.md) · [dynamics-plan](dynamics-plan.md) · [dynamics-text-as-truth-plan](dynamics-text-as-truth-plan.md) · [element-copy-paste-plan](element-copy-paste-plan.md) · [engraving-overrides-plan](engraving-overrides-plan.md) · [fan-beam-join-plan](fan-beam-join-plan.md) · [fan-collapse-plan](fan-collapse-plan.md) · [fan-ramp-range-plan](fan-ramp-range-plan.md) · [fanned-beam-pitches-plan](fanned-beam-pitches-plan.md) · [fanned-beams-plan](fanned-beams-plan.md) · [font-metrics-plan](font-metrics-plan.md) · [key-signature-plan](key-signature-plan.md) · [layout-plan](layout-plan.md) · [linear-view-plan](linear-view-plan.md) · [move-note-to-voice-plan](move-note-to-voice-plan.md) · [multi-staff-plan](multi-staff-plan.md) · [multi-voice-plan](multi-voice-plan.md) · [multi-voice-rest-position-plan](multi-voice-rest-position-plan.md) · [multisystem-slur-endpoint-plan](multisystem-slur-endpoint-plan.md) · [multisystem-slur-plan](multisystem-slur-plan.md) · [multisystem-slur-segment-endpoint-offset-plan](multisystem-slur-segment-endpoint-offset-plan.md) · [multisystem-slur-segment-shape-plan](multisystem-slur-segment-shape-plan.md) · [multivoice-rebar-plan](multivoice-rebar-plan.md) · [navigation-viewport-plan](navigation-viewport-plan.md) · [note-engraving-plan](note-engraving-plan.md) · [note-offset-plan](note-offset-plan.md) · [note-spacing-plan](note-spacing-plan.md) · [ottava-plan](ottava-plan.md) · [pedal-plan](pedal-plan.md) · [playback-semantics-plan](playback-semantics-plan.md) · [rebar-push-forward-plan](rebar-push-forward-plan.md) · [rest-hide-plan](rest-hide-plan.md) · [rest-shift-plan](rest-shift-plan.md) · [shortest-duration-plan](shortest-duration-plan.md) · [slur-endpoint-offset-plan](slur-endpoint-offset-plan.md) · [slur-plan](slur-plan.md) · [soundfont-plan](soundfont-plan.md) · [spacing-model-plan](spacing-model-plan.md) · [staff-size-plan](staff-size-plan.md) · [staff-spacing-plan](staff-spacing-plan.md) · [symbols-window-plan](symbols-window-plan.md) · [tempo-marks-plan](tempo-marks-plan.md) · [text-editing-plan](text-editing-plan.md) · [tie-stamp-plan](tie-stamp-plan.md) · [time-signature-plan](time-signature-plan.md) · [time-signature-window-plan](time-signature-window-plan.md) · [tremolo-plan](tremolo-plan.md) · [trill-plan](trill-plan.md) · [trill-slur-clearance-plan](trill-slur-clearance-plan.md) · [tuplet-control-plan](tuplet-control-plan.md) · [tuplet-extension-plan](tuplet-extension-plan.md) · [two-note-tremolo-plan](two-note-tremolo-plan.md) · [zoom-plan](zoom-plan.md)

## History — how the codebase got its shape

[caret-is-not-a-selection-plan](caret-is-not-a-selection-plan.md) · [modularity-plan-2026-07-28](modularity-plan-2026-07-28.md) · [observable-editorstate-plan](observable-editorstate-plan.md) · [refactor-plan-2026-07-27](refactor-plan-2026-07-27.md) · [refactor-plan](refactor-plan.md) · [remove-vue-plan](remove-vue-plan.md) · [render-performance-findings](render-performance-findings.md) · [render-performance-plan](render-performance-plan.md) · [render-performance-research](render-performance-research.md) · [split-plan-2026-06-22](split-plan-2026-06-22.md) · [tight-bbox-plan](tight-bbox-plan.md) · [vexflow-boundary](vexflow-boundary.md) · [vexflow-removal-map](vexflow-removal-map.md)
