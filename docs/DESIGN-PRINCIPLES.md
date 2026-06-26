# DESIGN PRINCIPLES

Forward-looking design constraints that keep the project flexible as it grows.

Where `ARCHITECTURE.md` describes how the code fits together **today**, this file
states what must stay **true** so future directions stay open. Treat these like
`lint:boundary`: check new code against them before it lands.

They are deliberately phrased as *what not to assume*. Each is cheap to honor
while the code is small and expensive to retrofit once features depend on it.

---

## 1. A score is a value, not a singleton

The score is an instantiable, serializable, cloneable object — never global,
ambient, or assumed-unique.

- `ScoreModel` can be `new`-ed freely and round-trips through `toJSON` / `fromJSON`.
- Nothing reaches for "the" score through module-level / global state, and nothing
  assumes there is exactly one model / renderer / viewport.
- The code stays able to hold and operate on more than one score at once
  (multiple documents, embedding, side-by-side comparison, fixtures, tests).

**Exception — audio is a single global resource.** Tone.js owns one audio context,
so playback is realistically singular. Keep "what plays" a *parameter* pointed at a
score (`PlaybackEngine.setScore`), never an identity baked into the engine. Data
may be plural; sound output is one.

**Forbidden:** module-level mutable score/engine state; helpers that resolve "the
current score" implicitly; APIs that only work if exactly one document exists.

## 2. Musical material has a position-independent representation, and it is first-class

Music must be expressible **detached from bars, barlines, and absolute position** —
as an ordered stream of events with relative offsets and durations.

- This already exists: the `RebarEvent[]` stream (`flattenRegion` →
  `relayEvents` / `pasteEvents`). Treat it as the canonical currency for *portable
  musical material*, not a private detail of re-barring.
- Any operation on "a run of music" — copy/paste, transposition, augmentation,
  reuse, transformation, merging two passages — should be expressible as a
  map/concat over this stream, then re-laid into bars.

**Forbidden:** features that can only operate on bar-anchored data when they
conceptually operate on "a passage of music"; reimplementing flatten/relay instead
of routing through it.

## 3. Content and presentation are separate; the model holds neither pixels nor layout

The data model describes *what the music is*. Pixels, layout, system/page breaks,
spacing, scroll, and zoom describe *how it is shown* and live in the
render/viewport layer.

- The same content is renderable in multiple contexts and sizes without changing
  the model.
- Layout results (positions, breaks, spacing) are derived/cached **views** over
  content — never stored back into `ScoreModel` or its JSON.

This is the existing `ScoreModel` ↔ `VexFlowRenderer` / `ViewportModel` /
`CoordinateMapper` split; the constraint is to **hold the line** as engraving grows.

**Forbidden:** pixel coordinates, viewport, or page-layout state in the data model
or its JSON; render logic mutating musical content.

## 4. Instruments and staves are composable (1..N), not a fixed global ensemble

A score *contains* an ordered set of instruments/staves. A single-staff fragment
and a full multi-instrument score are the **same type** — they differ only in how
many staves they hold and how much music is in them.

- "Place this material into *(instrument, measure, beat)*" must be expressible —
  the multi-staff generalization of today's single-staff
  `pasteEvents(measure, beat, …)`.
- "The full ensemble" never becomes a global assumption baked into entry,
  rendering, or playback such that a small or single-staff score is a special case.

**Forbidden:** a hardcoded/global instrument list; rendering or playback that
assumes a fixed number of staves; entry paths that only work for the "main" staff.

---

## Known boundary cases

Places where today's code touches one of these principles and the decision should
be made *consciously* before more code piles onto it.

- **`Slur.cps` stores geometry in the model (re: principle 3).** The two Bézier
  control-point deltas `{x, y}` on `Score.slurs` are pixel-space and round-trip in
  JSON. This is a *deliberate exception*, not a leak: it is a user-authored manual
  shape override (composer intent that must persist), mirroring MusicXML's bezier
  offsets. It is currently the **only** place content and geometry touch. Before
  adding more drag-shaped/hand-positioned objects, decide whether such geometry
  overrides belong in the model or in a separate "engraving overrides" side-layer —
  don't let `cps` become an unexamined precedent.

- **`measures` lives directly on `Score`, and "measure N" is a global key (re:
  principle 4).** `getMeasure(n)`, `measure.number`, and renumber-on-insert all
  assume one linear measure list — i.e. one staff. The multi-staff/instrument layer
  must generalize this addressing (a measure number becomes staff-relative) and the
  linear `score.measures` playback walk (it becomes N parallel streams mixed).
  Design the composable instrument/staff layer **before** much more code hardcodes
  `getMeasure(n)`, and keep single-staff as the N=1 case, not a special default.

## How to use this

When adding a feature, ask: *does this make one of the four assumptions above?* If
it does, find the version that doesn't. See `ARCHITECTURE.md` → "Key invariants"
for the lower-level rules (Fraction beats, renderer-as-geometry-source,
commit-resyncs-playback) that these sit above.
