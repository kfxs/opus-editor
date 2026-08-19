# What the Sound Engine Should Think In — pitch, and a dynamic value

Status: **RECORDED 2026-08-19, ⛔ NOT PLANNED AND NOT NEXT.** His own framing: *"this is not for now,
is for the future, sound is still not the most important thing of the editor"*. It is written down
because it is **a statement about the DATA MODEL's semantics**, not about audio quality — and the
model is what everything else is built on, so the shape has to be right before anything leans on it.

## The ask (from the user, verbatim)

> *"regarding the idea that the sound engine should think in pitch and not in midi, it should also
> think in dynamic values (probably something between 0 and 1; where 0 is niente and 1 the loudest
> sound possible) and the other thing for the records is that the hairpin should be able to sound…
> so after the schedule an interpret just convert that into midi or whatever the next synth or the
> synth we have will use"*

## The shape

Three stages, and the boundary between the second and the third is the whole idea:

| Stage | Speaks in |
|---|---|
| **Score** | spelling (`step`/`alter`/`octave`), a `Dynamic`'s text, a hairpin's span |
| **Schedule** | ⭐ **PITCH and a DYNAMIC VALUE** — the musical statement, on a clock |
| **Interpret** | MIDI note numbers, velocities, CC — whatever *this* synth wants |

⭐⭐ **A synth's vocabulary is not the music's.** MIDI is one renderer of sound the way VexFlow is one
renderer of ink; the same argument the editor already makes about `Score` having no `tempo` field and
about the engraving engine having a typed SCENE between engraving and painting. A schedule that
carries MIDI has already thrown away the thing a different synth would have needed.

- **Pitch, not MIDI** — 12-EDO is baked in the moment a spelling becomes an integer. The score is
  already right (`utils/pitchSpelling`, and `docs/tuning-systems-and-alteration.md`); it is the
  SCHEDULE that mints too early.
- **A dynamic value in [0, 1]** — ⭐ `0` = *niente*, `1` = the loudest sound possible. A musical
  quantity, not a MIDI velocity: the interpret step decides what 0.5 means for the instrument it is
  driving.
- ⭐ **The hairpin must be able to sound.** That is the one requirement here with teeth: a wedge is a
  RAMP, so the dynamic value is **a function over time**, not a constant stamped on each note. Any
  design that keeps it a per-note number has already made the hairpin unsayable.

## ⚠️ What is true today, so nobody re-derives it

- `ScheduledNote.midi` **mints MIDI inside the schedule** (`engine/audio/playbackSchedule.ts`) —
  the early conversion, and the reason this note exists.
- `ScheduledNote.velocity` is *already* normalised 0–1, so the range is not the work. The work is
  that it is (a) named for MIDI, (b) **a per-note constant**, and (c) calibrated for our sampled
  synth rather than being an abstract musical quantity.
- `DYNAMIC_VELOCITY` (`utils/dynamics.ts`) maps the eight levels onto that range — `ppp` 0.05 …
  `fff` 1.0, with the gaps deliberately widening toward the extremes. ⚠️ It is a *tuned playback
  table*, so its numbers answer "how loud through WebAudioFont", not "how loud in the abstract".
  Under this plan that table becomes the **interpret** step's, and the schedule carries the musical
  value the score states.
- **There is no niente.** No mark means it, nothing produces 0, and `DEFAULT_DYNAMIC` floors an
  unmarked score at `mf`. `0 = niente` is a new statement, not a re-labelling.
- **A hairpin makes no sound at all** — `grep hairpin src/engine/audio/` is empty. Its SCOPE is
  built (`docs/dynamic-voice-scope-plan.md`: which voices it governs, honoured for layout, colour
  and the walk), but nothing reads the wedge for loudness.

## ⭐⭐ A hairpin is not ONE sound — the instrument's envelope decides how it is realised

His, the same day:

> *"a crescendo in a sound that holds the note is different than in a sound where the note dies after
> attack… maybe we make a simple hairpin reproduction first, but at the end it will be good to have
> real crescendo"*

⭐ **Two realisations of the same notation, and the instrument picks:**

| The sound | What a crescendo IS there | How it is played |
|---|---|---|
| **Sustaining** — violin, winds, organ, bowed anything | the note itself gets louder while it lasts | a continuous ramp DURING each note (gain/expression automation) |
| **Decaying** — piano, harp, pizzicato, mallets | ⭐ each successive attack is louder; a note already struck can only die | scale the ATTACK of each note under the wedge |

⚠️ **On a decaying instrument a crescendo over ONE long note is unplayable**, and that is not a bug
to solve: composers write it (the pianist redistributes, or it stands as intent). ⛔ So the renderer
must not "fix" it by faking a swell the instrument cannot make — the honest realisation of a wedge
over a single piano note is *nothing*, and it is the notation that carries the meaning.

⭐⭐ **This is an argument FOR the three-stage split above, and the best one.** The score says
*crescendo*; the schedule says *the dynamic value rises from a to b across this span*; only the
INTERPRET step knows what is playing it and therefore which of the two realisations applies. Put the
envelope class anywhere earlier and the same score would have to be re-scheduled to change
instrument.

⏭️ **Staged, deliberately: the simple one first.** Per-attack scaling is the cheap realisation, it is
correct for the piano we ship with today, and it is audible — so a wedge stops being silent long
before the continuous ramp exists. ⚠️ But only if the schedule already carries the ramp as a FUNCTION
(see above): "simple first" must mean a simpler INTERPRET, never a simpler schedule.

⚠️ **Which instrument is playing is not answerable yet.** `InstrumentPlayer.load(program)` makes ONE
GM program current for the whole score, and the lane→instrument map that would say otherwise is
planned, not built (`docs/instruments-plan.md`, `docs/soundfont-plan.md` — sound binds to a LANE).
⇒ The envelope class hangs off that map when it lands; ⛔ do not invent a second place to say what
instrument a staff is.

## ⛔ Not now, and not by halves

The ordering matters: **the ramp is what forces the shape**, so building "a dynamic value" as another
per-note constant would spend the change and leave the hairpin exactly as mute as it is. When this is
picked up, the first question is what the value is a function OF, not what its type is.

See also `docs/dynamics-plan.md` (the velocity ladder as built),
`docs/dynamics-line-and-hairpins-plan.md` (the wedge as drawn), and
`docs/dynamic-voice-scope-plan.md` (which voices a mark governs).
