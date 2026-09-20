# docs/ — what is here, and which of it is live

147 files. ⭐ **Sorted by KIND, in four folders** (2026-09-20) — `plans/` · `research/` · `how-it-works/` · `history/` —
with the rules at the top level. ⚠️ By kind and ⛔ not by status: a BUILT plan stays in `plans/`, because the
code's comments cite these files by path and section — 1,774 mentions of 118 of them, and the BUILT plans are the most cited of all
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

- [own-engraving-engine](plans/own-engraving-engine.md) — ⭐ the engine — §0.5 is the DECISION list (⛔ not a queue) everything open is folded into
- [code-shape-plan-2026-09-19](plans/code-shape-plan-2026-09-19.md) — the code-shape pass — Phases 1–5 done, Phase 6 (folders + docs) open
- [mark-drag-and-reanchor](plans/mark-drag-and-reanchor.md) — OPEN — dragging a mark, and what re-anchors it
- [braces-brackets-plan](plans/braces-brackets-plan.md) — DRAFT — braces and brackets
- [instruments-plan](plans/instruments-plan.md) — the lane→instrument map — P1a built, P1b / P2 open
- [score-header-sketch](plans/score-header-sketch.md) — 🚧 a SKETCH, to be thrown away — read before touching `ScoreHeaderPass`
- [json-io-plan](plans/json-io-plan.md) — a sketch, on purpose — import / export reports, never repairs
- [span-mark-family-plan-2026-08-24](plans/span-mark-family-plan-2026-08-24.md) — the span-mark family's tables — what a fifth line would be a row of

## Planned, not started

[20c-notation-survey](research/20c-notation-survey.md) · [hand-pan-tool-plan](plans/hand-pan-tool-plan.md) · [metric-modulation-plan](plans/metric-modulation-plan.md) · [multi-font-research](research/multi-font-research.md) · [octave-clefs-plan](plans/octave-clefs-plan.md) · [unpitched-staves-plan](plans/unpitched-staves-plan.md) · [tuning-systems-and-alteration](how-it-works/tuning-systems-and-alteration.md)

## How a part of the editor works (descriptions, not plans)

[above-staff-ladder](how-it-works/above-staff-ladder.md) · [articulation-stem-align](how-it-works/articulation-stem-align.md) · [barline-selection](how-it-works/barline-selection.md) · [beaming](how-it-works/beaming.md) · [clef](how-it-works/clef.md) · [copy-paste-spelling](how-it-works/copy-paste-spelling.md) · [firefox-zoom-repaint](how-it-works/firefox-zoom-repaint.md) · [keypad](how-it-works/keypad.md) · [marking-tools](how-it-works/marking-tools.md) · [menus-design](how-it-works/menus-design.md) · [note-selection-hit-detection](how-it-works/note-selection-hit-detection.md) · [passage-selection-marks](how-it-works/passage-selection-marks.md) · [pdf-export](how-it-works/pdf-export.md) · [ragged-last-system](how-it-works/ragged-last-system.md) · [tempo-menu](how-it-works/tempo-menu.md) · [windows-design](how-it-works/windows-design.md)

## Research — the sourced options behind an engraving number

⭐ Every number is one house style's DEFAULT (`own-engraving-engine.md` §0.3 rule 13); these are the
preset menu. ⚠️ A research file does not know what was DECIDED — the feature's own module does.

[accidental-dot-engines](research/accidental-dot-engines.md) · [accidental-dot-research](research/accidental-dot-research.md) · [accidental-ledger-clearance](research/accidental-ledger-clearance.md) · [barline-join-research](research/barline-join-research.md) · [beam-hook-research](research/beam-hook-research.md) · [beam-slope-research](research/beam-slope-research.md) · [braces-brackets-research](research/braces-brackets-research.md) · [clef-research](research/clef-research.md) · [clef-spacing-research](research/clef-spacing-research.md) · [dot-placement](research/dot-placement.md) · [engraving-number-inventory](research/engraving-number-inventory.md) · [fan-beam-spread](research/fan-beam-spread.md) · [header-spacing-research](research/header-spacing-research.md) · [ink-anchors-and-side-bearings](research/ink-anchors-and-side-bearings.md) · [key-signature-research](research/key-signature-research.md) · [ledger-line-length-research](research/ledger-line-length-research.md) · [line-marks-shape-research](research/line-marks-shape-research.md) · [mid-bar-sign-spacing-research](research/mid-bar-sign-spacing-research.md) · [multi-voice-rest-position](research/multi-voice-rest-position.md) · [note-level-gaps-research](research/note-level-gaps-research.md) · [outside-staff-marks-research](research/outside-staff-marks-research.md) · [page-system-frame-research](research/page-system-frame-research.md) · [rest-accidental-kerning-research](research/rest-accidental-kerning-research.md) · [score-text-fonts-research](research/score-text-fonts-research.md) · [slur-residue-research](research/slur-residue-research.md) · [slur-tie-research](research/slur-tie-research.md) · [smufl-fonts-research](research/smufl-fonts-research.md) · [spacing-model-research](research/spacing-model-research.md) · [staff-line-research](research/staff-line-research.md) · [stem-length-research](research/stem-length-research.md) · [stem-thickness-research](research/stem-thickness-research.md) · [tempo-marks-research](research/tempo-marks-research.md) · [tremolo-tuplet-research](research/tremolo-tuplet-research.md) · [vertical-spacing-research](research/vertical-spacing-research.md)

## Feature plans — how each feature was built, and why

The record the code's comments cite. Each file's header says what shipped and what is left.

[accidental-stamp-plan](plans/accidental-stamp-plan.md) · [articulation-stamp-plan](plans/articulation-stamp-plan.md) · [bar-width-plan](plans/bar-width-plan.md) · [barline-join-plan](plans/barline-join-plan.md) · [barline-types-plan](plans/barline-types-plan.md) · [beam-engraving-plan](plans/beam-engraving-plan.md) · [clear-range-plan](plans/clear-range-plan.md) · [clef-model-plan](plans/clef-model-plan.md) · [copy-paste-staff-plan](plans/copy-paste-staff-plan.md) · [cross-barline-beaming-plan](plans/cross-barline-beaming-plan.md) · [dynamic-offset-plan](plans/dynamic-offset-plan.md) · [dynamic-voice-scope-plan](plans/dynamic-voice-scope-plan.md) · [dynamics-line-and-hairpins-plan](plans/dynamics-line-and-hairpins-plan.md) · [dynamics-plan](plans/dynamics-plan.md) · [dynamics-text-as-truth-plan](plans/dynamics-text-as-truth-plan.md) · [element-copy-paste-plan](plans/element-copy-paste-plan.md) · [engraving-overrides-plan](plans/engraving-overrides-plan.md) · [fan-beam-join-plan](plans/fan-beam-join-plan.md) · [fan-collapse-plan](plans/fan-collapse-plan.md) · [fan-ramp-range-plan](plans/fan-ramp-range-plan.md) · [fanned-beam-pitches-plan](plans/fanned-beam-pitches-plan.md) · [fanned-beams-plan](plans/fanned-beams-plan.md) · [font-metrics-plan](plans/font-metrics-plan.md) · [key-signature-plan](plans/key-signature-plan.md) · [layout-plan](plans/layout-plan.md) · [linear-view-plan](plans/linear-view-plan.md) · [move-note-to-voice-plan](plans/move-note-to-voice-plan.md) · [multi-staff-plan](plans/multi-staff-plan.md) · [multi-voice-plan](plans/multi-voice-plan.md) · [multi-voice-rest-position-plan](plans/multi-voice-rest-position-plan.md) · [multisystem-slur-endpoint-plan](plans/multisystem-slur-endpoint-plan.md) · [multisystem-slur-plan](plans/multisystem-slur-plan.md) · [multisystem-slur-segment-endpoint-offset-plan](plans/multisystem-slur-segment-endpoint-offset-plan.md) · [multisystem-slur-segment-shape-plan](plans/multisystem-slur-segment-shape-plan.md) · [multivoice-rebar-plan](plans/multivoice-rebar-plan.md) · [navigation-viewport-plan](plans/navigation-viewport-plan.md) · [note-engraving-plan](plans/note-engraving-plan.md) · [note-offset-plan](plans/note-offset-plan.md) · [note-spacing-plan](plans/note-spacing-plan.md) · [ottava-plan](plans/ottava-plan.md) · [pedal-plan](plans/pedal-plan.md) · [playback-semantics-plan](plans/playback-semantics-plan.md) · [rebar-push-forward-plan](plans/rebar-push-forward-plan.md) · [rest-hide-plan](plans/rest-hide-plan.md) · [rest-shift-plan](plans/rest-shift-plan.md) · [shortest-duration-plan](plans/shortest-duration-plan.md) · [slur-endpoint-offset-plan](plans/slur-endpoint-offset-plan.md) · [slur-plan](plans/slur-plan.md) · [soundfont-plan](plans/soundfont-plan.md) · [spacing-model-plan](plans/spacing-model-plan.md) · [staff-size-plan](plans/staff-size-plan.md) · [staff-spacing-plan](plans/staff-spacing-plan.md) · [symbols-window-plan](plans/symbols-window-plan.md) · [tempo-marks-plan](plans/tempo-marks-plan.md) · [text-editing-plan](plans/text-editing-plan.md) · [tie-stamp-plan](plans/tie-stamp-plan.md) · [time-signature-plan](plans/time-signature-plan.md) · [time-signature-window-plan](plans/time-signature-window-plan.md) · [tremolo-plan](plans/tremolo-plan.md) · [trill-plan](plans/trill-plan.md) · [trill-slur-clearance-plan](plans/trill-slur-clearance-plan.md) · [tuplet-control-plan](plans/tuplet-control-plan.md) · [tuplet-extension-plan](plans/tuplet-extension-plan.md) · [two-note-tremolo-plan](plans/two-note-tremolo-plan.md) · [zoom-plan](plans/zoom-plan.md)

## History — how the codebase got its shape

[caret-is-not-a-selection-plan](history/caret-is-not-a-selection-plan.md) · [modularity-plan-2026-07-28](history/modularity-plan-2026-07-28.md) · [observable-editorstate-plan](history/observable-editorstate-plan.md) · [refactor-plan-2026-07-27](history/refactor-plan-2026-07-27.md) · [refactor-plan](history/refactor-plan.md) · [remove-vue-plan](history/remove-vue-plan.md) · [render-performance-findings](history/render-performance-findings.md) · [render-performance-plan](history/render-performance-plan.md) · [render-performance-research](history/render-performance-research.md) · [split-plan-2026-06-22](history/split-plan-2026-06-22.md) · [tight-bbox-plan](history/tight-bbox-plan.md) · [vexflow-boundary](history/vexflow-boundary.md) · [vexflow-removal-map](history/vexflow-removal-map.md)
