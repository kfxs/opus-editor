# Metric modulation — future plan

Status: **DEFERRED.** The menu ships the *building-block glyphs* now (the two arrows, alongside the
note values); the *meaning* — a modulation that actually changes playback — is written up here and
built later. Read `docs/tempo-marks-plan.md` and `docs/tempo-marks-research.md` first; this extends
that model, it does not replace it.

## What it is

A metric (a.k.a. tempo) modulation states a tempo as a **note-value equation**, not a number:

```
←  ♩  =  ♪  →
```

Read **old on the left, new on the right**: the quarter as it was felt *before* now lasts exactly
as long as an eighth *from here on*. The two notes name the **same physical duration**; the notation
around it changes. The arrows are direction cues — `←` "was", `→` "becomes". Modulations **chain**:
each one is read against whatever tempo was in force just before it ("and so on").

Standard engraving; the user (a musician) confirmed the reading. Bar-to-bar it is how a composer
renotates a pulse — Carter, late Stravinsky, most post-war rhythmic writing.

## Why it does NOT fit the current model as-is

Every tempo mark we have today **carries its own number** — `♩ = 120` says 120, and text-as-truth
means the number you see is the number that plays. A metric modulation carries **no number**. Its
speed is *derived* from two things:

1. the **ratio** of the two note values, and
2. the **tempo already in force** immediately before it.

So it is our **first *relative* tempo mark** — a cousin of `a tempo` and `Tempo primo`, which also
state no number and refer back to an earlier speed. It is a different species from `Allegro (♩ = 120)`,
and the text-as-truth rule has to bend for it: the truth is an *equation*, and the number is computed.

## The arithmetic

Let the equation be **left = right**, with each note measured in quarter-note units
(`durationToBeats(unit, dots)` — quarter = 1, eighth = 0.5, dotted-quarter = 1.5, …):

```
qpm_new  =  qpm_prevailing  ×  ( rightQuarters / leftQuarters )
```

Worked example — `← ♩ = ♪ →` coming out of a passage at ♩ = 120:
`right = ♪ = 0.5`, `left = ♩ = 1.0` → `qpm_new = 120 × (0.5 / 1.0) = 60`. The eighth now lasts what
the quarter used to (0.5 s → 1.0 s per quarter). Chained modulations feed `qpm_new` back in as the
next `qpm_prevailing`.

(Sanity check on the invariant: the count of *right* notes per minute at the new tempo equals the
count of *left* notes per minute at the old tempo — same rate ⇒ same duration.)

## The work, in three parts (only one is hard)

1. **Render — nearly free.** `← ♩ = ♪ →` is two music-glyph runs, an `=`, and two arrow glyphs.
   `TempoLayout.splitRuns` already draws note chars as SMuFL and everything else as text, so a
   modulation string **already engraves correctly today** (see "Current behaviour" below). The
   arrows draw as text runs.
2. **Parse — new.** `parseTempoText` currently matches `<unit><dots> = <number>`. It must also match
   `<unit><dots> = <unit><dots>` (a note on **both** sides) and represent it as a *ratio*, not a bpm.
   The `METRONOME` regex's right-hand `\d+` becomes "a number **or** a unit".
3. **Resolve / play — the real work.** The tempo engine must, at a modulation, read the **prevailing**
   qpm and apply the ratio. Our tempo is *already* resolved positionally left-to-right along the
   score, so "refer to what came before" and the chaining fall out of the existing traversal — the
   resolver just learns the ratio case. `TempoMark` grows a way to hold the equation (e.g.
   `{ leftUnit, leftDots, rightUnit, rightDots }`) instead of / beside `bpm`; `captureBeatAnchors`
   already carries tempo marks through rebar/paste, so no new anchor plumbing.

## Compound note values — the "special showing"

The note on either side can itself be a **dotted note, a tuplet, or tied notes** (`♩ = ♪ tied ♪`,
`♩ = triplet ♪`). These are not single characters:

- **Dots** already work — `TempoLayout` draws a `.` after a note as an augmentation-dot glyph, and
  `parseTempoText` reads `♩. = …`. So dotted units on either side are free.
- **Tuplet bracket** (`3` over a group) and **tie/slur** (a curve between two noteheads) are
  *composed graphics* spanning several glyphs, not runs `TempoLayout` can emit today. Supporting them
  is a renderer change (a new run kind: "bracket over notes", "tie between notes"). Defer with the
  rest; note-value-plus-dots covers the common modulations.

## Current behaviour (what shipping the arrows now does and does NOT do)

With the arrow glyphs in the menu, a user can already build and place `← ♩ = ♪ →`. Today it will:

- **draw correctly** — arrows as text, the two notes as SMuFL glyphs, via existing `splitRuns`; and
- **NOT change playback** — `parseTempoText` finds no number after `=`, so the mark states no speed
  and **inherits the prevailing tempo** (the "arbitrary text, no number" rule, D2). It is a visual
  placeholder until part 3 lands.

This is acceptable precisely because it does not *lie the way a segno would*: it makes no false
numeric claim, it simply doesn't modulate yet. When the resolver is built, the same strings start
playing their modulation with no re-authoring.

## Open questions

- **Arrow glyph choice.** The menu inserts Unicode `←`/`→` (U+2190 / U+2192) as text for now. If a
  SMuFL modulation-arrow glyph reads better in the notation font, swap at render time (a `splitRuns`
  mapping, the way note chars already map to `NOTE_GLYPH`).
- **Do the arrows belong *in* the stored string, or are they framing chrome** the renderer adds
  around any note=note equation? Storing them keeps text-as-truth honest (delete an arrow, it's
  gone); deriving them keeps the string clean. Decide when part 2 is built.
- **Interaction with `a tempo` / `Tempo primo`.** All three are relative; the resolver should treat
  them as one family (a mark that computes its qpm from context) rather than three special cases.
