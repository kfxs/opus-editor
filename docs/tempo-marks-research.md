# Tempo / metronome marks — RESEARCH (no implementation)

Status: research only, 2026-07-12. Written to be argued with, then turned into a plan.
Question asked: *"tempo palette with Allegro / Adagio / Lento, and separately ♩ = 120;
placeable anywhere in the score; and — do we even want the current default tempo?"*

---

## 1. What we have today (facts, verified in code)

| Fact | Where |
|---|---|
| Tempo is **one global scalar**, `Score.tempo: number` | `types/music.ts:700` |
| Default 120, set in the constructor | `ScoreModel.ts:141` |
| `setTempo()` validates 20–300 and commits (undoable) | `ScoreModel.ts:174`, `MusicEngine.ts:253` |
| **Nothing in the UI ever calls it** — zero callers in `App.vue` / composables | grep |
| Playback converts beats→seconds with a **single scalar**, in 3 places | `PlaybackEngine.ts:99, 121, 176` |
| The pure scheduling layer is already **tempo-free** (onsets in quarter-note beats) | `playbackSchedule.ts:24` |

Two consequences worth naming:

1. **Tempo is currently a constant 120 in practice.** There is no BPM box. So we are not
   "changing" a feature, we are building the first one — which means we are free to model it right.
2. **`Score.tempo` has exactly the smell we just deleted from `Score.clef`.** It is a *global
   default* that is also, implicitly, *the opening value at bar 1 beat 0*. That conflation is what
   made the clef bleed across staves (`docs/clef-model-plan.md`). The fix there was: delete the
   global, resolve positionally, fall back to a constant. The same fix applies here.

The good news: `collectScheduledNotes()` already returns **tempo-independent** onsets in beats.
Only the beats→seconds conversion knows about tempo, and it is a single multiply. That is the
whole surface we have to generalize.

---

## 2. What the profession actually models

### 2.1 It is two different objects that usually print as one

- **Tempo text (verbal indication)**: `Allegro`, `Adagio`, `Lento`, `Andante con moto`.
- **Metronome mark**: a *note value* = a *number* — `♩ = 120`.
- Standard engraving (Gould, *Behind Bars*) prints them combined, metronome in parentheses:
  `Allegro (♩ = 120)`. Also common: `♩. = 60`, `♩ = c. 108`, `♩ = 132–144`, and metric
  modulation `♩ = ♪`.

So the model is **one mark with two optional faces** (a word, a metronome value), at least one
present. That single type gives all three of the notations you asked for — word only, metronome
only, or both — with no branching in the palette.

### 2.2 The beat unit is not decoration — it is half the meaning

`♩ = 60`, `𝅗𝅥 = 60` and `♩. = 60` are three different speeds. A model that stores only a BPM
number is wrong. Store `{ unit, dots, bpm }` and derive the engine's clock rate:

```
quarterNotesPerMinute = bpm × durationToBeats(unit, dots)      // ♩.=60 → 60 × 1.5 = 90 qpm
```

We already have `durationToBeats()` in `utils/durations.ts`. MusicXML models it identically —
`<metronome><beat-unit>quarter</beat-unit><beat-unit-dot/><per-minute>120</per-minute></metronome>`
— and then carries the *sounding* value separately in `<sound tempo="…">` (in quarter-BPM).

### 2.3 What is printed and what sounds are separate layers

Dorico, Sibelius and MuseScore all agree here: a tempo item **always carries a playback value**,
and a **flag decides whether the `♩ = N` is printed**. That is why "Allegro" alone still plays
faster in every real program — the word carries a value even when no number is shown.

This dissolves the obvious trap ("does the word Allegro do anything?"): the mark always has a
sounding value; `showMetronome` is just notation. Note this is *not* the same as our `Dynamic`'s
`kind: 'level' | 'text'` split (interpreted vs silent) — and I think tempo should **not** copy
that split (see the open questions).

### 2.4 Tempo is a SYSTEM-level object, not staff content

This is the biggest structural difference from dynamics and clefs. A tempo mark applies to the
whole score at that point in time — there is one clock. It is printed above the **top staff**
(and, in big scores, duplicated above other instrument groups — a *presentation* choice, not a
second object). It is not per-staff and not per-voice.

Our `Score.measures` is exactly the "shared horizontal spine, aligned across all staves"
(`multi-staff-plan.md` §4). So a **measure-owned tempo list with no `staffId`** is *structurally*
system-level, for free. That is the right container.

### 2.5 Point marks vs gradual changes

- **Point** (step change): `Allegro`, `♩ = 120`, `Tempo I`, `a tempo`.
- **Gradual** (ramp over a span): `rit.`, `accel.` — these are spans with a start and an end,
  the tempo analogue of a hairpin.

v1 should be point marks only. But the *playback* structure must be a **tempo map** (a list of
segments), not a per-note lookup, so that adding ramps later is "add a segment type", not a
rewrite. This is how every DAW and notation app does it.

### 2.6 The playback tempo slider is not content

"Play this at 0.8×" is a performance control, never part of the score. If we want it, it lives on
`PlaybackEngine` as engine state — like the dev sound picker — and never touches JSON or undo.

---

## 3. VexFlow already does the rendering (checked in vexflow 5.0.0)

`StaveTempo` (`node_modules/vexflow/build/esm/src/stavetempo.js`) takes:

```ts
StaveTempoOptions = {
  name?: string          // 'Allegro'
  duration?: string      // 'q' | 'h' | 'w' | '8' | … (our Duration codes work as-is)
  dots?: number          // ♩.
  bpm?: number | string  // 120, or 'c. 108', or '132-144'
  duration2?, dots2?     // ♩ = ♪  (metric modulation — free)
  parenthesis?: boolean
}
```

`draw()` renders `name`, then automatically wraps the metronome in parentheses when a name is
present: **`Allegro (♩ = 120)`** out of the box. It uses the SMuFL `metNote*` glyphs. This is
precisely the feature set requested, from the library primitive — matching the project preference
for "check if VexFlow already does it before writing custom code".

> **Superseded by the plan.** A later code read (`stavetempo.js`, 110 lines) found two more caveats
> beyond the two below — `StaveTempo.draw()` opens **no SVG group** (so there is nothing to hit-test
> or highlight), and its metronome print is gated on `duration`, so `showMetronome:false` with a unit
> set renders a broken `Allegro (♩ = )`. See **plan §6**, which is the authority on rendering.

**Two caveats, both cheap:**

1. `Stave.setTempo(t, y)` hardcodes `x = stave.x` (`stave.js:172`) — i.e. it can only put a mark
   at the **start of a bar**. For a mid-measure mark we must construct `new StaveTempo(t, x, y)`
   ourselves (the ctor *does* take an x) and add it as a stave modifier, taking x from the anchor
   note's absolute X, the way `DynamicsLayout` anchors dynamics to a note. Watch two nudges in the
   VexFlow code: the ctor does `setXShift(10)`, and `draw()` adds `stave.getModifierXShift()`
   (the clef/TS width) to x. Both are compensable.
2. It draws at `stave.getYForTopText(1)` — a fixed line above the staff, so it can collide with
   high notes/slurs. We already have staff-spacing to relieve that, and a later arrow-nudge would
   be an `engravingOverrides` client (#8), consistent with the existing compartment.

The alternative (an `Annotation` above the note, reusing the dynamics path) would mean composing
the ♩ glyph by hand — `Glyphs` is not exported by the package (`DynamicsLayout.ts:23` already hit
this). Not worth it. **Use `StaveTempo`.**

---

## 4. The one piece of real work: a tempo map for playback

Today: `seconds = beats / (score.tempo / 60)` — three sites. With marks anywhere in the score
this becomes piecewise. Proposal (a new pure module, `utils/tempoMap.ts`, no Vue/VexFlow):

```
buildTempoMap(score) → [{ startBeats, qpm, startSeconds }, …]   // sorted, cumulative
beatsToSeconds(map, beats)      // play(): schedule onsets
secondsToBeats(map, seconds)    // updatePosition(): playhead + progress (the INVERSE — needed!)
totalSeconds(map)               // calculateTotalDuration()
```

A step function is trivially invertible, and stays analytically invertible when ramps arrive.
`collectScheduledNotes()` stays untouched and tempo-free — it already speaks beats.

**Failure modes to avoid** (each is a real bug if missed):
- `updatePosition()` needs the *inverse* map; using the scalar there makes the playhead drift away
  from the sound as soon as a tempo change exists.
- `seekToMeasure()` and the progress % must both go through the map.
- Onsets are all scheduled up-front at `play()`, so the map must be built before scheduling —
  no live re-tempo needed. Good.
- **Rebar/time-signature change must re-anchor tempo marks**, or a TS change silently deletes them.
  There is already a proven seam for exactly this: `captureBeatAnchors` / `restoreBeatAnchors`
  (`ScoreModel.ts:1475, 1498`) which carries *clef changes + dynamics* by absolute offset through
  rebar and paste. A tempo mark is a third client of it. Missing this is the #1 way this feature
  ships broken.

---

## 5. Where it fits our design principles

| Principle | Consequence for tempo |
|---|---|
| **1. Score is a value** | Tempo map is *derived* from the score, never global engine state. Playback rate (the slider) is the explicit exception — engine-only, like the sound picker. |
| **2. Position-independent stream** | Tempo marks are **not** part of the note stream (`RebarEvent`). They are beat-anchored annotations → they ride the `captureBeatAnchors` seam, exactly like clefs/dynamics. |
| **3. Content ≠ presentation** | The mark (word, unit, bpm, "show the number?") is content. Any hand-nudge of its y-position is geometry → `score.engravingOverrides`, not the mark. |
| **4. Staves are composable 1..N** | Tempo is system-level: it lives on the shared `Measure` spine with **no `staffId`**, and rendering *chooses* to draw it above the top staff. |

And the lesson from the clef work, applied: **delete the global default.** Effective tempo at a
position = last mark at/before it, else a constant `DEFAULT_TEMPO = 120`. One truth, no hidden
"score tempo" that only bar 1 can express.

---

## 6. Sketch of the shape (to argue with, not final)

```ts
// Measure-owned, beat-anchored, sorted — mirrors `clefs` and `dynamics` exactly.
interface TempoMark {
  id: string
  beat: Fraction          // slot-boundary snapped, like clefs/dynamics
  text?: string           // 'Allegro'  (at least one of text/bpm present)
  unit?: Duration         // 'q' | 'h' | '8' …  the metronome beat unit
  dots?: number           // ♩.
  bpm?: number            // the number attached to the unit
  showMetronome?: boolean // print "♩ = 120"?  (an 'Allegro' can sound 144 without printing it)
  parenthesis?: boolean
  // NO staffId — tempo is system-level. NO voice.
}
// Measure: tempos?: TempoMark[]
// Score:   tempo: number  →  DELETED (constant DEFAULT_TEMPO fallback instead)
```

Everything else is a straight re-use of the `Dynamic` playbook: `ScoreModel` add/update/remove +
`commit()` (undo/JSON free), a resolver in `utils/`, `ElementRegistry` type `'tempo'`, highlight,
Delete, and double-click text editing via the existing `DomTextEdit` overlay.

### Palette (proposal)

A "Tempo" section: word buttons pre-filled with a conventional BPM, plus a metronome button with a
unit picker (𝅗𝅥 ♩ ♩. ♪) and a number field. Conventional ranges (approximate; the value is editable,
we just need a sane default — midpoint):

| Grave | Largo | Lento | Adagio | Andante | Moderato | Allegretto | Allegro | Vivace | Presto |
|---|---|---|---|---|---|---|---|---|---|
| 25–45 | 40–60 | 45–60 | 55–75 | 75–105 | 105–120 | 110–130 | 120–165 | 140–175 | 165–200 |

---

## 7. POLYTEMPO — the assumption we must not weld shut

Raised by the user (2026-07-12), and correct: **Stockhausen, *Gruppen* (1955–57)** — three
orchestras, three conductors, **different tempi sounding simultaneously**. Ives (Fourth Symphony),
Nancarrow and Ferneyhough live in the same territory. The user does **not** need this now, but a
design decision must not make it unreachable. This is the north-star vision in
`project_longterm_notation_vision` / `multi-staff-plan.md` §11, applied to the time axis.

**Distinguish two things.** *Metric modulation* (`♩ = ♪`, Carter) is ONE clock re-notated — VexFlow's
`duration2` renders it for free, no structural cost. *Polytempo* is genuinely **N clocks at once** —
that is the one that can be foreclosed.

**What forecloses it is never the mark — it is the clock.** A `beatsToSeconds(beats)` with no
parameter saying *for whom* is the trap. So:

> **Design rule: the number of clocks is a PARAMETER, not 1.**
> `buildTempoMap(score, scope?)` and a per-scope beats→seconds conversion, with `scope` **absent =
> the whole system** — the identical convention to absent `staffId` = staff 0 on slots/clefs/
> dynamics/tuplets. v1 has exactly one scope; the cost of the insurance is one optional field and
> one function parameter.

**The container for "an orchestra" already exists**: `Score.staffGroups` (`music.ts:655`, the
brace/bracket grouping overlay). *Gruppen* = three staff groups. `TempoMark.scopeId?: string`
referencing a `StaffGroup.id`, absent = system-wide. **No new concept is needed.**

Consequences to honour in the plan (cheap now, expensive to retrofit):
- `Score.tempo` (a true global) is deleted — see §1. A global scalar is the single worst offender.
- Every tempo resolver / map / playback conversion takes a scope from day one, even when v1 always
  passes `undefined`.
- The renderer draws a mark above **its scope's top staff**, not a hardcoded staff 0.
- Playback mixes N streams at **absolute seconds**; do not deepen the singleton
  `currentMeasure`/`currentBeat` playhead (with N clocks there is no single "current beat").

**Honest limit.** Per-scope clocks reach a lot on their own (each group's beats convert at its own
rate = tempo canon). But *fully* independent orchestras also need independent barlines/meters, and
`Score.measures` is still the shared spine. That is the **deliberately removable** assumption already
documented in DESIGN-PRINCIPLES ("Known boundary cases") and `multi-staff-plan.md` §11. Polytempo is
**downstream of that same door**, not a separate axis. The promise this feature makes: *it adds no
new dependency on the single-clock or single-spine assumption.*

---

## 8. Decisions (agreed with the user, 2026-07-12)

**D1 — A tempo mark ALWAYS carries a sounding value; display is a separate flag. AGREED.**
Placing the word "Allegro" *does* change playback (≈144). `showMetronome` decides only whether the
`♩ = 144` is *printed*. So "Allegro", "♩ = 144" and "Allegro (♩ = 144)" are ONE object with three
display settings. We deliberately do **not** copy `Dynamic`'s interpreted/silent (`kind`) split —
a score of tempo words that all play at 120 is what no real program does.

**D2 — The word is FREE TEXT; the sounding value is STORED, never derived from the word. AGREED.**
Driven by the Sibelius-style requirement that the user will later edit the word freely
("Allegro con brio", "Schnell", "Tempo di valse"):
- `text: string` — a plain string, **never an enum**. The palette words are *presets that pre-fill
  it*, not the set of legal values. (An enum would make the future text-edit a migration.)
- `bpm` is set by the preset at insert time and is then **independent of the word**: renaming the
  text never moves the tempo; changing the number never rewrites the text. Playback must NOT look
  the word up in a table at play time (that would need a dictionary of every phrase a human types).
- Reuse the existing `DomTextEdit` / `TextEditController` double-click overlay
  (`docs/text-editing-plan.md`). The edit must preserve the mark's id and leave `bpm` untouched.
- A mark created from *arbitrary typed text* (not a preset) inherits the **prevailing tempo** at
  that point — the word appears, the speed does not change until a number is given.
- *Later, optional:* recognize known words on typing and **suggest** a value ("typed Presto → 185?").
  A suggestion layered on top — never the source of truth.

**D3 — A fresh score has NO tempo mark and NO tempo field; the engine falls back to a constant.
AGREED (Option A).** `Score.tempo` is deleted. An empty score prints nothing above bar 1, plays at
`DEFAULT_TEMPO = 120` (an engine constant, absent from the model and from JSON), and the first mark
the user places is the score's only tempo statement. One way to express tempo, not two — the
`score.clef` lesson. (Rejected Option B: born-with-a-visible-`♩ = 120`-mark — it prints notation the
user did not ask for and must be deleted to get a score with no marking.)

## 9. Still open (decide before planning)

1. **v1 scope**: point marks only — no `rit.`/`accel.` spans, no `c. 108` / `132–144` strings, no
   metric modulation? (All reachable later without redesign; `StaveTempo` renders the last two for
   free.)
2. **Do tempo marks travel with copy/paste?** Recommend **no** for v1 (they are system objects; the
   clipboard is staff-relative musical material).
3. **Playback rate slider** (0.25×–4×, engine-only, never content) — want it, or leave it out?
4. **Anchoring UX**: how the user places a mark (click a note/beat like dynamics? a selected note?).
