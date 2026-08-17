# Tempo / metronome marks — PLAN

Companion to `docs/tempo-marks-research.md` (findings, prior art, VexFlow survey, polytempo
analysis). **Read §7 (polytempo) and §8 (decisions) of that doc before touching this one.**

**Scope: INFRASTRUCTURE ONLY.** The word, the metronome mark, both combined, placeable anywhere,
sounding, saved, undoable. **No agogics** (`rit.`/`accel.`), no ranges/approximations
(`c. 108`, `132–144`), no metric modulation (`♩ = ♪`) — all deferred, none foreclosed.

---

## 0. The five rules this plan must not break

1. **`Score.tempo` is deleted.** Tempo is resolved positionally from marks; the fallback is an
   engine constant `DEFAULT_TEMPO = 120`. No global default that is secretly "the value at bar 1"
   (the `score.clef` mistake — see `docs/clef-model-plan.md`).
2. **The number of clocks is a PARAMETER, not 1.** Every resolver / map / beats→seconds conversion
   takes a `scope` from day one, `undefined` = the whole system. v1 always passes `undefined`.
   This is what keeps *Gruppen*-style polytempo reachable (research §7).
3. **A mark always carries a sounding value; `showMetronome` only decides what is printed.**
4. **The word is free text, never an enum**, and `bpm` is stored, never derived from the word.
5. **The beat unit is half the meaning.** `♩ = 60`, `♩. = 60`, `𝅗𝅥 = 60` are three different speeds.
   Store `{ unit, dots, bpm }`; derive quarter-notes-per-minute.

---

## 1. Model (`types/music.ts`)

```ts
/**
 * A tempo mark: a verbal indication ('Allegro'), a metronome mark (♩ = 120), or both.
 * SYSTEM-level — it governs the clock, not a staff — so it has NO staffId and NO voice.
 * Measure-owned + beat-anchored, mirroring `clefs` and `dynamics`.
 */
export interface TempoMark {
  id: string
  /** Beat within the measure, snapped to a slot boundary (like clefs/dynamics). */
  beat: Fraction
  /** Verbal indication. FREE TEXT — palette words are presets, not an enum. */
  text?: string
  /** Metronome beat unit + dots. ♩. = 60 is not ♩ = 60. */
  unit?: Duration
  dots?: number
  /** BPM *of the unit*. Stored, never derived from `text`. */
  bpm?: number
  /** Print the "♩ = 120"? An 'Allegro' can sound 144 without showing the number. */
  showMetronome?: boolean
  /**
   * Which clock this mark governs. ABSENT = the whole system (v1 always absent).
   * Reserved for polytempo: a StaffGroup.id (an "orchestra" — see research §7).
   * Costs one optional field now; retrofitting it later costs a rewrite.
   */
  scopeId?: string
}

// Measure:  tempos?: TempoMark[]      // sorted ascending by beat
// Score:    tempo: number             // ← DELETED
```

**Invariant:** a mark has a sounding value iff it can be resolved to a qpm. A preset gives
`bpm` at insert time. A mark created from arbitrary typed text with no number inherits the
**prevailing** tempo (it prints, it does not change the speed).

---

## 2. Pure layer (`utils/tempoMap.ts` — new, no Vue, no VexFlow)

```ts
export const DEFAULT_TEMPO = 120          // qpm. The ONLY fallback. Not a model field.

/** qpm = bpm × durationToBeats(unit, dots).  ♩.=60 → 90 qpm. */
export function markToQpm(mark: TempoMark): number | undefined

export interface TempoSegment { startBeats: number; qpm: number; startSeconds: number }

/** Sorted, cumulative step function over the score's absolute beat axis. */
export function buildTempoMap(score: Score, scope?: string): TempoSegment[]

export function beatsToSeconds(map: TempoSegment[], beats: number): number
export function secondsToBeats(map: TempoSegment[], seconds: number): number   // the INVERSE
export function totalSeconds(map: TempoSegment[], totalBeats: number): number

/** Walk-back resolver (the `resolveActiveLevel` twin), for UI/"what's the tempo here?". */
export function effectiveTempoAt(score, measureNumber, beat, scope?): number
```

`buildTempoMap` filters `mark.scopeId === undefined || mark.scopeId === scope`, so v1's single
call (`scope = undefined`) yields exactly one map — and the N-clock generalization is already the
same function. A step function is trivially invertible; ramps stay analytically invertible later.

**Tests:** unit conversion (`♩.`, `𝅗𝅥`), empty score → DEFAULT_TEMPO, mid-score change, round-trip
`secondsToBeats(beatsToSeconds(b)) === b`, marks out of order, mark on a beat with no note.

---

## 3. Playback (`PlaybackEngine.ts`, `playbackSchedule.ts`)

`collectScheduledNotes()` is **already tempo-free** (onsets in quarter-beats). Do not touch it.

Replace the scalar `score.tempo / 60` at its **three** sites with the map:

| Site | Today | Becomes |
|---|---|---|
| `calculateTotalDuration()` :99 | `totalBeats / (tempo/60)` | `totalSeconds(map, totalBeats)` |
| `play()` :176 | `now + startBeats / bps` | `now + beatsToSeconds(map, ev.startBeats)`; **duration = `beatsToSeconds(start+dur) − beatsToSeconds(start)`** (a note may straddle a tempo change) |
| `updatePosition()` :121 | `elapsedSec × tempo/60` | `secondsToBeats(map, elapsedSeconds)` ← **the inverse; using the scalar here makes the playhead drift the moment a tempo change exists** |

Those three are the *whole* job. Two things the research doc listed that turn out to be non-tasks
(verified in code):

- **`seekToMeasure()` :254 is a stub.** It only sets `currentMeasure`; `play()` ignores it and always
  schedules from beat 0. There is no beats→seconds conversion in it to rewire. (If seek is ever made
  real, it must take its start offset from `beatsToSeconds(map, …)` — record, don't build.)
- **The progress % needs nothing.** `updatePosition()` :142 and `getPosition()` both compute
  `elapsedSeconds / totalDuration` — seconds over seconds, already tempo-independent. It becomes
  correct for free the moment `totalDuration` goes through the map.

Build the map **once** in `play()` (all onsets are scheduled up-front, so no live re-tempo is needed).

---

## 4. Rebar / time-signature change — MANDATORY, not optional

A tempo mark is beat-anchored, so a TS change would **silently delete it** unless it joins the
existing seam that already carries clef changes + dynamics by absolute offset:
`captureBeatAnchors` / `restoreBeatAnchors` (`ScoreModel.ts:1475, 1498`). Add `tempos` as a third
client of the `CapturedAnchor` union (`kind: 'clef' | 'dynamic' | 'tempo'`). **This is the #1 way
this feature ships broken.** Test: place `♩ = 90` at m2 b2, change the meter, assert it is still at
the same absolute offset.

**Collision policy — decide it, don't inherit it.** `restoreBeatAnchors` already branches per kind:
clefs **dedupe** at a beat (`:1528`, last wins), dynamics **stack** (`:1533`, no dedupe — `p dolce`).
Tempo takes the **clef** rule: **dedupe, last wins**. Two tempo marks at one beat is not a thing.

Copy/paste: tempo marks do **not** travel (system objects; the clipboard is staff-relative musical
material). Explicitly assert this in a test so it is a decision, not an accident.

---

## 5. ScoreModel ops (mirror the `Dynamic` playbook exactly)

`addTempoMark(measure, beat, params)` / `updateTempoMark(id, updates)` / `removeTempoMark(id)` /
`getTempoMarks(measure)`, each followed by `commit()` in `MusicEngine` → undo + JSON for free.
Keep `measure.tempos` sorted by beat; delete the array when it empties (matches `dynamics`).
`toJSON`/`fromJSON` round-trip. **No migration** for old `score.tempo` (project constraint: no
users, no legacy JSON — a stray `tempo` key is harmlessly ignored).

Validation: bpm 20–300 (the old `setTempo` clamp becomes a per-mark guard).

### 5.1 The blast radius of deleting `Score.tempo` (budget it in P1)

Small in `src/`, large in tests. Counted, not estimated:

| Site | Count | What |
|---|---|---|
| `types/music.ts:701` | 1 | the field |
| `ScoreModel.ts:141, 174-178` | 2 | ctor param + `setTempo()` (drop both) |
| `MusicEngine.ts:253` | 1 | `setTempo()` facade — **zero UI callers**, just delete |
| `PlaybackEngine.ts:99, 121, 176` | 3 | §3 |
| `new ScoreModel('X', 120)` in tests | **50** | the ctor's 2nd arg becomes an arity error → sed |
| `tempo: 120` in `Score` fixture literals | **12** | excess-property error in `staffContent` / `dynamics` / `engravingOverrides` / `ScoreModel` tests |
| tempo tests in `ScoreModel.test.ts` | ~6 | `:35, :43, :55-64` (setTempo + clamp) DELETE; `:273, :287` (JSON contains `"tempo": 120`) rewrite |

Mechanical, but it is ~70 edits and P1 is not "done" until they are green. This is exactly the count
the clef plan undershot — do not repeat it.

---

## 6. Rendering (`VexFlowRenderer` + new `TempoLayout.ts`)

Use the library primitive: **`StaveTempo`** (vexflow 5) — it renders `name`, `♩ = bpm`, and
auto-parenthesizes the metronome when both are present: **`Allegro (♩ = 120)`**. Its
`durationToCode` table covers all six of our `Duration` codes (`w h q 8 16 32`) as-is.

**But it is NOT drop-in.** Read `node_modules/vexflow/build/esm/src/stavetempo.js` (110 lines) before
writing `TempoLayout.ts`. Four facts about it drive the design below:

### 6.1 Do not use the stave-modifier path — draw it ourselves, in our own SVG group

`Stave.setTempo()` hardcodes `x = stave.x` (`stave.js:172`), so it can only mark the **start of a
bar**. Worse, two things make the modifier path unusable for us even for bar-start marks:

- **`buildAndDrawStave()` (`VexFlowRenderer.ts:404`) draws the stave BEFORE the notes are
  formatted.** At `stave.draw()` time no note X exists, so a mid-measure anchor is unknowable there.
- **`StaveTempo.draw()` never calls `ctx.openGroup()`.** It emits bare `<text>` nodes into whatever
  group is open — and `Stave.draw()` has them all inside one `openGroup('stave', …)` (`stave.js`).
  So there is **no `<g>` carrying the mark's id**, and `getSVGElement()` (which is just
  `document.getElementById('vf-' + id)`) returns nothing.

  ⚠️ This silently breaks the "register the bbox like `registerDynamics`" plan: `registerDynamics`
  works *only* because `Annotation.draw()` opens a group with the annotation's id. `StaveTempo`
  does not. Hit-testing, highlight-recolor and text-edit suppression all hang off that group.

**Both problems have one fix.** After the voices are formatted (i.e. where the anchor note's absolute
X is known — the same point `DynamicsLayout` reads it), draw the mark by hand inside our own group:

```ts
const ctx = pass.context
ctx.openGroup('tempo', mark.id)            // ← THE fix: gives us '#vf-<id>' for bbox + highlight
new StaveTempo(opts, x, shiftY).setStave(stave).setContext(ctx).draw()
ctx.closeGroup()
```

Then register `group.getBBox()` in `ElementRegistry` under a new `ElementType: 'tempo'` (the rendered
SVG extent, exactly as `registerDynamics` does — never the modifier's reported width).

Compensate the ctor's `setXShift(10)` and the `stave.getModifierXShift()` (clef/TS width) that
`draw()` adds to x.

### 6.2 The metronome print gate misfires — pass `duration` ONLY when showing the number

`draw()` gates the *entire* metronome on `if (duration)`, and prints `bpm` in an `else if` **inside**
that block. Two traps:

| Options passed | What actually renders |
|---|---|
| `{name:'Allegro', duration:'q', bpm: undefined}` ← the naive `showMetronome:false` | **`Allegro (♩ = )`** — open paren, notehead, `=`, *nothing*, close paren |
| `{bpm: 120}` with no `duration` | **nothing at all** |

So the rule is: **`duration`/`dots` are passed if and only if the metronome is printed**, and any mark
that prints a metronome must carry a `unit` (default `'q'` at insert time).

```ts
const showMet = mark.showMetronome && mark.bpm !== undefined
const opts = {
  name: mark.text,
  ...(showMet ? { duration: mark.unit ?? 'q', dots: mark.dots, bpm: mark.bpm } : {}),
}
```

### 6.3 Draw it ONCE — `renderMeasure` runs per staff

`renderMeasure` is called inside `staffList.forEach((staff, staffIndex) => …)`
(`VexFlowRenderer.ts:1310`). Without a gate, a grand staff prints `Allegro` above **every** staff and
registers duplicate ids. Gate on the mark's **scope's top staff** — which in v1 (one scope) resolves
to `staffIndex === 0`, but write the *call* in terms of the scope, per rule 2.

### 6.4 Vertical position

It draws at `stave.getYForTopText(1)` — a fixed line above the staff; collision with high notes/slurs
is possible. Staff-spacing already relieves it, and the ctor's `shiftY` is the seam for an
arrow-nudge later: `engravingOverrides` client #8 (geometry never goes on the mark — principle 3).

---

## 7. Interaction

- **Palette**: a "Tempo" section — preset word buttons (each pre-filling text + a conventional bpm),
  a metronome button with a unit picker (𝅗𝅥 ♩ ♩. ♪) + number field, and a "both" combination.
  Conventional defaults (midpoints, all editable): Grave 35, Largo 50, Lento 52, Adagio 65,
  Andante 90, Moderato 112, Allegretto 120, Allegro 144, Vivace 160, Presto 185.
- **Place**: pick from palette, click the note/beat it attaches to (the dynamics gesture).
- **Select / highlight / Delete**: "same as dynamics" is four concrete edits, not one — name them so
  P4 doesn't sprawl: (a) `ElementType: 'tempo'` in `ElementRegistry`; (b) a `'tempo'` kind on
  `SelectionItem` / `EditorState`; (c) a `HighlightController` branch that recolors the mark's own
  `<g>` (from §6.1 — via DOM `setAttribute('fill', …)`, **never** VexFlow `setStyle`, which leaks
  into the shared draw context and grays the whole score); (d) the Delete-key path in
  `KeyboardController`.
- ⭐ **The ATTACHMENT GUIDE (added 2026-08-17, his call).** A selected mark draws the dashed line to
  what it hangs off, as a selected dynamic does. Two edits, both named by the general rule in
  `docs/dynamic-offset-plan.md`: `drawTempoMarks` captures the endpoints onto the registry entry, and
  the `tempo` row in `ELEMENT_SPECS` calls `applyAnchorGuideLine`. ⭐⭐ **Its anchor is a PLACE IN
  TIME** — the mark's own `anchorX` at the staff's TOP LINE — ⛔ never a notehead: a dynamic's guide
  follows its note's pitch on purpose, and a tempo mark belongs to no pitch. Measured in
  `e2e/anchorGuide.e2e.ts`.
- **Edit the word** (Sibelius-style): double-click → the existing `DomTextEdit` overlay
  (`TextEditController`, `docs/text-editing-plan.md`). Must preserve the mark's id and leave `bpm`
  untouched. *(Ship in P4 — the model already supports it; it is pure reuse.)*

---

## 8. Phases

| P | What | Done when |
|---|---|---|
| **P0** | `TempoMark` type + `measure.tempos` + `utils/tempoMap.ts` (pure, scope param, unit→qpm) | unit tests green; nothing rendered yet |
| **P1** | **Delete `Score.tempo`** (~70 sites — see §5.1); rewire `PlaybackEngine`'s **3** sites to the map (seek + progress need nothing — §3) | a `♩ = 60` at m3 audibly halves the speed; playhead stays glued to the sound; **all ~70 test sites green** |
| **P2** | Rebar/paste: `tempos` joins `captureBeatAnchors`/`restoreBeatAnchors` (dedupe last-wins) | a TS change no longer eats a tempo mark (test) |
| **P3** | `ScoreModel` ops + `commit()` + JSON round-trip | undo/redo + save/load a mark |
| **P4** | Render via `StaveTempo` in our **own SVG group** (§6.1) + `showMetronome` gate (§6.2) + top-staff-only (§6.3) + registry + palette + place/select/delete (§7) | you can write `Allegro (♩ = 120)` on the page and hear it; clicking it selects it |
| **P5** | Double-click text edit (reuse `DomTextEdit`) | rename "Allegro" → "Allegro con brio"; bpm unmoved |

P0–P2 are the infrastructure; P3–P5 are the surface. P4 is the first phase the user can *see*.

**All six phases are BUILT** (P5 also folded in in-place NUMBER editing, which was not originally
scoped: select a mark and the palette's metronome controls become an inspector).

---

## 8b. KNOWN ISSUE — the text-edit overlay's vertical position (open)

**Symptom (user, on screen):** double-clicking a mark opens the edit box slightly **too high**. Two
causes were found and fixed; a residual offset remains, so this is *better, not right*.

**Fixed already (do not regress):**
1. *Wrong font.* The overlay hardcoded a serif italic. VexFlow resolves `StaveTempo.name` from its
   own `Metrics` — **bold**, in its own text font. The overlay now READS the engraved node's
   computed font instead of guessing, and `fontWeight` had to be plumbed through
   `EditableTextSource` / `TextEditMountOptions` / `DomTextEdit` (it did not exist — dynamics only
   ever needed italic).
2. *Wrong box.* The mark's `<g>` holds several `<text>` nodes: the word at ~14, and the metronome's
   ♩ notehead glyph at **25**. The notehead is far taller, so it reaches HIGHER than the word — and
   the group bbox (and the identical `ElementRegistry` bbox) therefore has the NOTEHEAD's top, not
   the word's. `TempoTextSource` now measures the ONE `<text>` node being edited (matched by
   content), not the group. Pinned by a test with a word at y=44 and a glyph at y=30.
   ⚠️ *The registry bbox is correct for hit-testing the whole mark — it is simply the wrong box for
   putting a caret on one word inside it. Do not "fix" this by going back to it.*

**Still open — the likely remaining cause:** SVG text is positioned by its **baseline**; an HTML
element is positioned by the **top of its line box**. Setting `top = inkTop` therefore leaves a
small, roughly constant offset (a few px, scaling with font size), because the browser's line box
adds internal leading above the glyph's ink. `DomTextEdit` sets `line-height: 1`, which shrinks but
does not remove it.

**Fix when picked up:** align by BASELINE rather than by box top — take the edited `<text>` node's
baseline in client coords (its `y` attribute through `getScreenCTM`, or `getBoundingClientRect()`
plus the font's ascent) and offset the overlay's `top` by the HTML font's ascent so the two
baselines coincide. Cleanest is probably to add an optional `baselineY` to `EditableTextSource`'s
rect and let `DomTextEdit` do the ascent correction once, for dynamics and tempo alike.

---

## 9. Deferred (recorded so they stay reachable, not so they get built)

- `rit.` / `accel.` — **spans**, not points; playback ramps instead of stepping. The tempo-map
  segment structure is what leaves room for it.
- `♩ = c. 108`, `♩ = 132–144` — `StaveTempo` prints them free (`bpm` accepts a string), but
  playback needs one number → an extra field.
- Metric modulation `♩ = ♪` — `StaveTempo`'s `duration2`/`dots2` render it free; it is a different
  *statement* (re-notating one clock) and deserves its own design pass.
- **Typed word → a played bpm.** `parseTempoText` today only reads a *metronomic* mark (`♩ = N`); a
  bare word like `Allegro` states no number and inherits the prevailing tempo. A future step: give
  the parser a **word → bpm dictionary** (`Adagio` ≈ 66, `Allegro` ≈ 132, …) so a word alone can
  carry a playable tempo, the way Sibelius does. Constraints — it must stay a *default*, never the
  source of truth (decision D2): an explicit `♩ = N` in the same string always wins, and the number
  a word implies must be user-overridable, not silently authoritative. Not built now; recorded so it
  stays reachable. (When it lands, the same list could seed a framework-agnostic tempo palette's
  preset rows — see `PaletteController.setTempo`.)
- Playback-rate slider (0.25×–4×) — engine-only, never content, never JSON.
- **Polytempo** — the `scopeId` field + the `scope` parameter are the reserved seams. The rest is
  downstream of removing the shared-measure-spine assumption (`multi-staff-plan.md` §11), which is
  a separate project.
