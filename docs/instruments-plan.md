# Instruments — the lane→instrument map (and what a score *is*)

Status: **PLANNED — nothing built.** Self-contained: written to survive a context reset.
This is the unbuilt half of **DESIGN-PRINCIPLES §4** ("instruments and staves are
composable 1..N"). It supersedes the sketch in `docs/soundfont-plan.md` §"Phase 2:
per-staff instrument" — **do not build a per-staff sound dropdown**; §7 below says what to
build instead.

Origin: a design conversation (2026-07-13), immediately after the score-globals cleanup
(`clef` / `tempo` / `keySignature` / `defaultTimeSignature` — see §2, the same lesson
applies here *before* the code exists rather than after).

**The one-paragraph version.** *Staves* and *instruments* are two independent axes joined by
**positional maps over lanes** — a lane being `(staff, voice)` — because a piano is one
instrument on two staves while a condensed score is many instruments on one staff, and
either can change at bar 40. There are **two such maps**: `applySound` (playback, silent,
the **primitive** — a composer auditioning a timbre has no player in mind) and
`applyInstrument` (content, **printed**, the wrapper carrying range + transposition + a
**default** sound). An instrument's sound is *derived* from it, never copied into the
playback map. Build the sound layer first; instruments land on top.

---

## 1. What we are actually editing — and what to CALL it

### Vocabulary (settled 2026-07-13; the words matter, so fix them once)

| Word | Means |
|---|---|
| **Fragment** | **Musical content.** Staves, bars, notes, instruments. No page, no margins, no print size. **This is what `ScoreModel` holds today**, and what the JSON is. |
| **Score** | The **finished, engraved result** — a fragment PLUS the engraving concerns: page size, margins, staff size, system/page breaks, the title block. |

> **The score wraps the fragment. The fragment never knows a score exists.**

So the content having *no* pages is correct, not an omission (Principle 3: the model holds
neither pixels nor layout), and the default title of a fresh model is **"Fragment 1"**, not
"Untitled Score" — because a score is the *output*, not the thing you are sketching in.

The payoff of that containment direction is **parts**. A violinist's part is not a copy —
it is *another wrapper over the same fragment*, with a different page size, a different
staff subset, different breaks. Put page setup inside the content and parts become
duplicated content that drifts. Keep it outside and a part is just a second wrapper.

**Not built now.** Nothing paginates, so the wrapper has nothing to hold. What this section
buys today is the *prohibition* — no page/print/margin field may enter the content model or
its JSON — plus the vocabulary.

### The TS type is still called `Score`

`types/music.ts` names the content type `Score`, which under the vocabulary above is now the
**wrong word for it** — it is a `Fragment`. Renaming it is a **large, purely mechanical
churn** across the whole codebase for zero behavior change, so it is **deliberately deferred**,
not forgotten. Until then: **`Score` in code == fragment (content)**. When the engraving
wrapper is actually built, do the rename in the same pass and let the new wrapper take the
name `Score`.

**And there is still only ONE content type.** A "fragment" is not a reduced special case of a
score — it is the same thing, unwrapped. Two types would mean two code paths, and Principle
4's whole force is that the small case is the general case at N=1.

### Numbering ("Fragment 1", "Fragment 2"…)

The `1` is part of a **default label**, not a live counter. Numbering fragments means asking
*"how many exist?"* — ambient global state, which **Principle 1 forbids** (a score is a
value, never a singleton; nothing reaches for "the" score through module-level state). When
several fragments can be open at once, **whoever opens one supplies the number** via the
`title` argument (`new ScoreModel('Fragment 3')`). The model must never invent it.
See `DEFAULT_FRAGMENT_TITLE` in `ScoreModel.ts`.

## 2. Why timbre is NOT a field on a staff (read this first)

The obvious move is `staff.instrument` (or `staff.program`) plus a dropdown. **It is the
same mistake we just removed four times.**

`score.clef`, `score.tempo`, `score.defaultTimeSignature` each modeled *a statement that
can change mid-score* as *a global property of the document*, so writing bar 1 secretly
rewrote the global and reading the global leaked it where it didn't belong (see
`docs/clef-model-plan.md`, and the note on the `Score` interface in `types/music.ts`).
`staff.instrument` is that shape exactly, one level down: it is really "the instrument
sounding this staff **at bar 1**", and it cannot express an instrument change at bar 40.

The rule now written on `Score`:

> *A notational statement that can change mid-score is never a field on the thing it
> describes. It is a positional event, resolved against a constant default.*

An instrument change **is** such a statement — and a *printed* one (*muta in piccolo*).
So it resolves positionally, like a clef change, a dynamic, or a tempo mark.

## 3. The relation is many-to-many, and it varies with time

Two real cases, pulling in opposite directions:

- **A piano** is *one instrument* written on *two staves*. One instrument → N staves.
- **A condensed score** (a *particella*: the composer's short score) puts *several
  instruments* on *one staff*, one per voice — flute in voice 1, oboe in voice 2. N
  instruments → one staff.

Both are ordinary. Together they kill any containment tree: an instrument cannot *own* its
staves while a staff simultaneously *owns* its instruments. And an instrument change means
the relation is not even fixed in time.

> **Decision: instruments and staves are two independent axes, related by a positional
> map — not by containment.** (This is the Dorico model — players are distinct from the
> staves they are written on — and it is exactly why Dorico can automate condensed scores
> and instrument changes.)

An earlier draft of this idea said "an instrument owns 1..N staves". The condensed-score
case refutes it. Recorded here so it is not re-proposed.

## 4. `applySound` is the primitive; `applyInstrument` is the rich thing on top

**An instrument is not a sound.** It is the *wrapper* — name, range, transposition, staff
conventions, **and** a default sound — and applying one is a statement **about a player**,
which is why it prints (*muta in Violin*).

But a composer sketching does not always have a player in mind. Sketching an
electroacoustic piece, you are thinking in **timbre**, not in performers: *"let me hear this
voice as an oboe"* — with no oboist, no printed instruction, and possibly no instrument
anyone can hold. That is **not** `applyInstrument`. It is `applySound`.

> **The flaw this replaces (recorded, do not reintroduce).** An earlier draft of this
> document keyed the sound binding by `instrumentId` — sound was reachable *only through*
> an instrument. That forces you to **declare a player, and print it on the page, in order
> to audition a timbre**. It makes a *playback* fact depend on a *content* fact, and the
> electroacoustic case cannot be expressed at all. The user caught it (2026-07-13).

So there are **two distinct operations over the same lanes**:

| Operation | Assigns | Kind | Printed? | Means |
|---|---|---|---|---|
| **`applySound(lane, sound)`** | a `SoundRef` | **PLAYBACK** | never | "this line *sounds* like that" |
| **`applyInstrument(lane, instrument)`** | an `Instrument` | **CONTENT** | yes (*muta in…*) | "a *player* takes this line" — brings range, transposition, **and a default sound** |

Both are **positional** (they can change at bar 40), and both address the same **lane**
`(staff, voice)`. So the model holds **two parallel positional maps over one lane space** —
one in content, one in playback. Same addressing, same walk-back resolution, different
compartments.

**How a note gets its sound** — an override chain, resolved at its position:

1. the explicit **sound** assignment in effect on its lane, else
2. the sound **implied by the instrument** in effect on its lane, else
3. the constant `DEFAULT_SOUND`.

**`applyInstrument` must NOT write a sound assignment.** The instrument's sound is
*derived* (rule 2), never copied. Copying it would create a second source of truth for the
timbre, and changing the instrument later would leave a **stale sound** behind — that is
exactly the `setTimeSignature` → `defaultTimeSignature` mirror write we deleted on
2026-07-13. Derive within the document; only *copy* across the external boundary (the
catalogue — see §6).

This is also why a **`SoundRef` must be opaque**, not a bare GM `program: number`: an
electroacoustic sketch's sound may be a sample or a synth patch. GM is *one kind* of
`SoundRef`, resolved behind the `InstrumentPlayer` seam. Baking in `program: number` would
foreclose the north star ([[project_longterm_notation_vision]]).

Keeping the two operations apart makes every case fall out:

- **Electroacoustic / timbre sketch** — `applySound` on a voice. No instrument, nothing
  printed, no player implied. *This is the primitive, and it must work with the instrument
  concept entirely absent.*
- **Piano** — both staves take the same instrument → one derived sound; the two halves of a
  piano *cannot* disagree about their timbre (an impossible state, not a guarded one).
- **Condensed sketch** — voice 1 → flute, voice 2 → oboe on one staff, by either operation:
  `applySound` while sketching, `applyInstrument` once the players are real.
- **Instrument change** — `applyInstrument` at bar 40. Prints. The sound follows, derived.
- **Sound change with no instrument change** — `applySound` at bar 40. Does *not* print.
  (An electroacoustic timbral shift is not an instruction to anybody.)
- **Plain single-staff sketch** — nothing assigned; everything resolves to the constant
  default. Neither concept is visible in the UI or the JSON at all.

This also completes the project's three-compartment shape, generalizing what the codebase
already does:

> **Content** = what the music is (notes, staves, **instruments**, transposition).
> **Presentation** = how it looks (document/pages, brackets, `score.engravingOverrides`).
> **Playback** = how it sounds (**sound** assignments on lanes).

## 5. Model sketch

Nothing here is final API; it is the *shape* the phases must honor.

**Content — the instrument list (a value, not a library lookup):**

```ts
interface Instrument {
  id: string
  name: string                 // "Flute", "Violin I"   (printed)
  abbreviation?: string        // "Fl."                 (printed on later systems)
  transposition?: number       // written→sounding semitones (B♭ clarinet = -2)
  range?: { lowMidi: number; highMidi: number }   // for out-of-range warnings
  templateId?: string          // BREADCRUMB ONLY — never resolved through (see §6)
}
// Score.instruments?: Instrument[]   — absent = a sketch with no instrument statements
```

**A lane, and the two maps over it.** Both maps are positional, both address the same lane,
both resolve by the same walk-back — they differ only in compartment and in whether they
print.

```ts
interface Lane {
  staffId?: string     // absent = staff 0 (the existing convention)
  voice?: number       // absent = the whole staff (any voice not assigned its own)
}
```

**CONTENT — instrument assignments.** Same convention as `Measure.clefs` / `dynamics` /
`tempos`: a per-measure array, sorted by beat. Prints (*muta in…*).

```ts
interface InstrumentAssignment extends Lane {
  beat: Fraction
  instrumentId: string
}
// Measure.instrumentChanges?: InstrumentAssignment[]
```

**PLAYBACK — sound assignments.** A separate compartment (sibling of `engravingOverrides`),
never printed, but positional and lane-addressed in exactly the same way.

```ts
type SoundRef =
  | { kind: 'gm'; program: number }            // General MIDI — one kind, not THE kind
  | { kind: 'sample'; url: string }            // …the electroacoustic future
  | { kind: 'synth'; patch: string }
// resolved behind the InstrumentPlayer seam — the model never knows what a program IS

interface SoundAssignment extends Lane {
  measure: number
  beat: Fraction
  sound: SoundRef
  volume?: number
}
// Score.playback?: { sounds: SoundAssignment[] }
```

It serializes with the file (the user expects their sound choices to persist) **without
being content** — the same status `engravingOverrides` already has. Content ≠ presentation
≠ playback; all three may be saved.

**Resolution — how a note in (staff `s`, voice `v`) at position `p` gets its sound:**

1. the most recent **sound** assignment at or before `p` matching **(s, v)**, else matching
   **(s, —)**; else
2. the sound **implied by** the most recent **instrument** assignment at or before `p`
   matching **(s, v)**, else **(s, —)**; else
3. **`DEFAULT_SOUND`** — a module **constant** (an implicit piano), never
   `score.instruments[0]`'s sound. "The first instrument" would be a global that is secretly
   the value at bar 1 — the very bug this document exists to avoid.

Step 2 is a **derivation, not a copy**: `applyInstrument` writes *only* the content
assignment. See §4.

When the user *does* pick an instrument (or a sound) for a staff, we **write a real
assignment at measure 1 beat 0**. A trivial positional statement is still a positional
statement; what is forbidden is a *global* one. (Exactly as measure 1 now carries its meter
explicitly rather than leaning on a `defaultTimeSignature`.)

**⚠️ OPEN — precedence when both change (decide before P4).** A sound override at m1 and an
instrument change at m40: does the override survive the *muta*, or does the instrument's
sound take over? Recommended: **the most recent statement of *either* kind wins** — so an
instrument change resets the sound unless a *later* `applySound` says otherwise. It is the
rule a user can predict without reading a manual. The alternative (an override is sticky per
lane until explicitly cleared) protects a timbral experiment across an instrument change, at
the cost of a state you can't see on the page. Confirm against a real sketch.

## 6. Templates are a factory, not a live link

An instrument **template** ("Violin: 1 staff, treble, range G3–A7, no transposition, GM
40") is **reference data that lives outside any score** — a catalogue, e.g.
`src/instruments/catalog.ts`.

> **Applying a template COPIES its values into the score.** The score is never *resolved
> through* the catalogue at read time.

Otherwise a file would not mean the same thing on another machine, and a user's tweak to
one violin's range would either be lost or would silently edit the library for every score.
`templateId` may be stored as a breadcrumb, but nothing may *read* through it. This is the
same rule as §2 — no ambient value the score secretly depends on — and it is why
[[project_no_json_migration]] stays easy: the file is self-describing.

## 7. What this means for `soundfont-plan.md` Phase 2 (the live decision)

Soundfont Phase 2 is currently written as **"per-staff instrument switching"**. **Build the
lane→instrument assignment instead.** The UI may well look identical on day one — a
dropdown next to a staff — but what it *writes* must be an `InstrumentAssignment` at
(staff, m1, b0), resolved through an `Instrument`, **not** a `program` stored on the staff.

That single choice is what makes per-voice timbre (§3) and mid-score instrument changes
additive later instead of a retrofit. It costs nothing extra now.

Also note what already exists and what it becomes:

- The **⚠️TEMPORARY dev sound dropdown** (`PlaybackEngine.program` /
  `setInstrumentProgram`, engine-only, absent from score/JSON/undo) is *replaced* by this.
  It was explicitly labelled temporary; deleting it is expected, not a regression.
- `PlaybackEngine` currently loads **one** program and plays the whole score with it
  (`instrument.load(this.program)` before the schedule loop). Multi-timbral playback means
  the **`InstrumentPlayer` seam changes**: load a *set* of programs, and `noteOn` names the
  program it sounds. That is a change to the seam's signature, not to any
  scheduling/tie/dynamics logic (which is the point of having the seam).
- `collectScheduledNotes` must therefore carry each note's **lane** (staff, voice) and
  position through to the engine so hop 1 can be resolved per note.
- Audio stays one global resource (Principle 1's stated exception): one `AudioContext`, N
  programs mixed on it.

## 8. What it buys: explode/implode, and the sketch→score path

Explode/implode is already an open item on the multi-voice list, with no principled
definition. This gives it one:

> **Explode** = re-lane content from *(staff s, voice v)* to *(staff s′, voice 0)* — and the
> instrument assignment is exactly what says *which voice goes to which staff*.

Without the map, explode is a guess. With it, it is mechanical. And because the
position-independent event stream (**Principle 2** — `flattenRegion` → `relayEvents`)
already threads staff and voice, the re-laning is a map over that stream, which is what
Principle 2 exists for.

So the composer's condensed sketch and the eventual full score stop being two documents.
They are the **same content**, condensed or exploded — a *view* decision.

## 9. Brackets are not instruments

`Score.staffGroups` (`StaffGroup`, `symbol: 'brace' | 'bracket'`, rendering DEFERRED) must
**not** be repurposed as the instrument container. They are different axes:

- A **piano's brace** is drawn *because one instrument spans two staves* — derivable from
  the map, not authored.
- A **string section's bracket** groups *several instruments*, each on its own staff — and
  it **nests** (strings inside the whole orchestra).

So `StaffGroup` stays what it is: a **presentational**, nestable grouping overlay. (This is
also the MusicXML split: a piano is *one part with two staves*, while a section bracket is a
*part-group* spanning parts.)

## 10. Phases

**Sound comes first, because it is the primitive** (§4) — and because it is what the
composer sketching actually wants, what the ⚠️TEMPORARY dev dropdown already fakes, and the
only half that needs *no* decision on written-vs-sounding pitch (§11). Instruments-as-content
land on top of a working sound layer, not the reverse.

| Phase | Scope |
|---|---|
| **P0** | *This document.* Decisions locked: two axes joined by positional maps (§3), `applySound` is the primitive (§4), templates as factory (§6), document wraps score (§1). |
| **P1** | **Sound model + playback, no instruments.** `Lane`, `SoundRef`, `SoundAssignment`, the walk-back resolver + `DEFAULT_SOUND`, the `Score.playback` compartment, JSON round-trip, undo. Multi-timbral `InstrumentPlayer` (load a *set* of sounds; `noteOn` names its sound); `collectScheduledNotes` carries each note's lane. Tests. |
| **P2** | **`applySound` UI — on a staff, and on a voice.** Replaces the dev dropdown. This alone delivers the condensed/electroacoustic sketch (voice 1 = flute sound, voice 2 = oboe sound) with **no instrument concept in the model at all**. |
| **P3** | **Instruments as content.** `Instrument`, `InstrumentAssignment`, `applyInstrument`; the sound *derived* from the instrument (§4/§5 rule 2 — never copied); catalogue `src/instruments/catalog.ts` (§6). Range warnings. Printed instrument name. |
| **P4** | **Instrument change mid-score** — the same assignment at a later measure, *printed* (*muta in piccolo*). Settle the §5 precedence question first. |
| **Later** | Explode/implode via the map (§8); the document/pages/parts wrapper (§1); written-vs-sounding pitch + transposing key signatures (§11). |

N=1 invariant, every phase: a plain single-staff sketch with nothing assigned must stay
**byte-identical** in JSON — no new keys, no `instruments: []`, no `playback: {}`.

## 11. Open questions (decide before the phase that needs them)

- **Written vs sounding pitch.** The moment `Instrument.transposition` is real, the model
  must say which one it *stores* and which it *derives*. MusicXML stores **written** pitch
  plus a transpose element. This also decides what a transposing instrument's key signature
  is — the per-staff, positional key signature sketched in
  [[project_score_globals_should_be_positional]]. **Not decided.** Needed by P2 at the
  latest (a B♭ instrument in the catalogue forces it).
- **MusicXML export.** MusicXML *can* express per-note instrument (a part declares several
  `score-instrument`s and a note points at one), but it is mostly used for percussion kits —
  a lightly-trodden path. An export problem, not a modeling problem; the north star is
  contemporary music, where the format strains anyway.
- **Does an unassigned voice inherit the staff's instrument, or the default?** §5 rule 2
  says the staff's. Confirm against a real condensed sketch before P4.

## Forbidden

- `staff.instrument`, `staff.program`, or any per-staff sound field (§2).
- **Sound reachable only *through* an instrument** — auditioning a timbre must never require
  declaring a player, or printing anything (§4). `applySound` stands alone.
- **`applyInstrument` copying a sound into the playback compartment** — it is derived, never
  mirrored (§4). That is the `defaultTimeSignature` mirror write, reborn.
- A bare GM `program: number` in the model — the sound reference is opaque (§4).
- Any global "the score's instrument" / `instruments[0]`-as-fallback (§5).
- Resolving through the template catalogue at read time (§6).
- Page/margin/print state anywhere in `Score` or its JSON (§1, Principle 3).
- Reusing `StaffGroup` as the instrument container (§9).
