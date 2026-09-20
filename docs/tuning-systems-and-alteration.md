# Tuning systems, and what `alter` really is

**Status: RECORDED, ⛔ not scheduled** (his call, 2026-08-13: *"microtonal is not priority yet, but
make the sound engine think in pitch and not midi IS priority"*). This file is the rule the audio and
pitch code cite; there is no task behind it. The scheduled half — pitch, not MIDI, all the way to the
instrument — is `docs/playback-semantics-plan.md`, and ⛔ it must not wait for this nor grow to
include it.

## The diagnosis: `alter` is two things in one field, and they coincide only in 12-TET

```ts
export type PitchAlter = -2 | -1 | 0 | 1 | 2   // -2 = 𝄫   -1 = ♭   0 = ♮   1 = ♯   2 = 𝄪
```

The TYPE is an enumeration of **symbols**. `spellingToMidi` (`… + STEP_SEMITONES[step] + alter`) reads
it as a **count of semitones**. In 12-TET those are the same number. Outside it they are not: a ♯ need
not be 100 cents, and in several systems ♯ and ♭ are not mirror images.

⭐ **`spellingToMidi` destroys the enharmonic, and the enharmonic is a tuning system's only input.**
G♯4 and A♭4 both become one integer. In meantone G♯ sounds *lower* than A♭; in Pythagorean, *higher*.
So whatever carries integers has thrown away what a tuning layer would need — which is why the
schedule carries the SPELLING and the MIDI number is minted last, by the instrument
(`engine/audio/InstrumentPlayer`).

⚠️ The same conflation one level up: an octave line or a transposition is a **SPELLING**
transposition, not a number of semitones (`utils/soundingShift.ts`).

## The shape that follows — the ottava's split, one level down

`alter` stays the **WRITTEN accidental**; a TUNING SYSTEM says what it is worth. Written pitch in the
model, interpretation at the sound boundary — the same seam where written becomes sounding.

The interface is NOT `alter → semitones`. It is closer to
`(step, alter, octave) → cents (or a ratio) from a reference` — the shape **Scala `.scl`** files use,
the de facto interchange format for tunings and the place to read from when the time comes.

## The field is split, and which side we copy matters

| | how it stores an accidental |
|---|---|
| **MusicXML** | `<alter>` = a NUMBER of semitones, decimals for microtones (`0.5` = quarter-tone sharp) — the conflation, standardised, and what our field is a copy of |
| **MEI** | `@accid` = the WRITTEN accidental (a symbolic enumeration, quarter-tones included) and `@accid.ges` = the GESTURAL one, what sounds |

⭐ MEI's is the one that survives a tuning system.
⛔ Widening `PitchAlter` to fractional semitones would be choosing MusicXML's side by accident. If
microtonal accidentals arrive before the tuning object, they are new SYMBOLS in the enumeration.

## Where it lives — decided 2026-08-13

> *"in the score model we have the accidental, and the tuning system is the interpreter, so both
> things should be different, the symbolic and the sound or mathematical ratio, as we are separating
> geometry and symbolic."*

⭐⭐ **The tuning system is a LAYER, not score content** — neither a `Score` field nor positional
content. The score states the NOTATION; an interpreter says what it is WORTH. It is the third
instance of one rule this codebase keeps choosing:

| the model states | a separate reader interprets | where |
|---|---|---|
| written pitch | sounding pitch | `utils/soundingShift.ts` |
| symbolic content | geometry / pixels | the renderer (`DESIGN-PRINCIPLES.md` §3) |
| the accidental | its ratio / cents | ⏭️ the tuning system |

⏭️ One nuance kept open: a score may still *reference* the tuning it was conceived in — the way it
references an instrument — without the ratios living in it.

Related: `docs/key-signature-plan.md` — *`fifths` is the shorthand, never the storage*; the same
disease, collapsing notation into a number that cannot express what notation can.
