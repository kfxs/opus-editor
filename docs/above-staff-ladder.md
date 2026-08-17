# The ABOVE-STAFF LADDER — when a family needs one, and when it does not

Research + decision, 2026-08-13. Raised by the trill (`docs/trill-plan.md`), but the question asked
was the general one: *in which cases do we really need a ladder?* — so the answer is written here,
once, rather than inside a feature plan.

`docs/dynamics-line-and-hairpins-plan.md` §12 opened this and deliberately left it open. This file
closes the part that can be closed and states the **trigger** for the part that cannot.

---

> 🚨 **BELOW the staff the order is NOT this file's, since 2026-08-17.** Gould p. 101–102 places an
> octave bracket (and articulation, slurs, tuplet brackets) CLOSER to the notes than dynamics, so the
> below-staff rungs run **trill → ottava → dynamics → pedal**. Above the staff nothing changed. The
> reorder, the evidence and the two hazards that turned out not to be hazards are in
> `docs/ottava-plan.md` §1 rule 5, §5 and P9.
>
> ⚠️ LilyPond's `outside-staff-priority` numbers quoted below are still LilyPond's — we now disagree
> with them on the ottava, deliberately.


## 1. "The ladder" is not one mechanism. It is three.

Every reference engine uses all three, for different families. Conflating them is what makes the
question feel unanswerable.

### (1) A shared BASELINE — alignment

One y per `(system, staff, side)`; every member of the family sits on it.

- **Finale calls them baselines outright**, and gives one to exactly three families: **lyrics, chord
  symbols and expressions** (its word for dynamics + text marks). Four scopes of adjustment: the
  whole score, one staff in all systems, one staff in one system, and the next item entered.
- **Dorico** aligns dynamics within a system and exposes *Align Dynamics* as a command.
- **Ours**: `engine/layout/dynamicsLine.ts`, one line per `(system, staff, placement)`.

⭐ **The test for whether a family needs one: is it READ AS A ROW?** Lyrics must be, or the
syllables jump. A line of dynamics is scanned left-to-right as a level curve. Chord symbols are read
across the bar. A mark that is read **individually, at its note**, does not need a baseline — giving
it one is not neutral, it drags marks away from their own music for no reader benefit.

### (2) SKYLINE avoidance — a per-object push

Place the object as close to the staff as it fits, then push it out until it hits nothing.

- **LilyPond**: outside-staff objects are placed "as close as possible without colliding", and are
  "raised as far as necessary to avoid collisions".
- **MuseScore**: `autoplace` over a skyline, with a `minDistance` style per element type; when two
  objects would collide, one moves further from the staff.

This is the **general fallback**, and it covers everything that has no baseline.

### (3) The ORDER — the ladder proper

Which family gets the inner rung when two want the same space. It is **the tie-break inside
mechanism 2**, not a placement mechanism of its own.

- **LilyPond** states it as a number, `outside-staff-priority` (lower = nearer the staff):

  | grob | priority | | grob | priority |
  |---|---|---|---|---|
  | AccidentalSuggestion | 0 | | VoltaBracket | 600 |
  | MultiMeasureRestScript | 40 | | MeasureCounter / MeasureSpanner | 750 |
  | **TrillSpanner** | **50** | | Pedal line spanners | 1000 |
  | BarNumber | 100 | | TextMark | 1250 |
  | DynamicLineSpanner | 250 | | **MetronomeMark** | **1300** |
  | TextSpanner | 350 | | Coda / Segno | 1400 |
  | OttavaBracket | 400 | | SectionLabel | 1450 |
  | TextScript (technique text) | 450 | | RehearsalMark | 1500 |

- **MuseScore** hardcodes the order per element type ("for elements of the same type, first come
  first served").
- **Dorico** exposes a vertical order for playing techniques **at the same rhythmic position**.

⭐ **So the ladder is needed only when two families can occupy the same horizontal span, on the same
side of the same staff, and neither is already positioned as a note-local modifier.** Placing ONE
family never needs it — that is mechanism 1 or 2.

---

## 2. ⭐⭐ For us, the ORDER is already expressible as INK — and that is not a coincidence

Our passes run in sequence, and `engine/layout/measureColumns.ts` already models *what ink is where*
as located boxes (`InkBox`, with `top`/`bottom` in staff spaces). `dynamicsLine.ts` reads that band
and clears it.

So for any two families where the **inner one is drawn (or measured) before the outer one is
placed**, "priority order" and "the inner family contributes a row of ink" are the same statement —
and we already have the second. `dynamicsLine.ts` says so itself: *"If one of those families must
push the line, it becomes a ROW in that ink model. A second extent computed here would be a second
answer to how low does this bar reach."*

**A priority NUMBER is only needed when two families are placed in the same pass and neither is ink
yet.** We have no such pair today.

---

## 3. Our above-staff citizens — what each one actually needs

| family | today | mechanism it wants | read as a row? | LilyPond priority |
|---|---|---|---|---|
| articulations | VexFlow modifier on the note | note-local stacking (VexFlow's) | no | — (in-staff) |
| slur, above | `SlurRenderer` | note-anchored curve | no | — (in-staff) |
| tuplet bracket | VexFlow | note-local | no | — |
| **trill line** | *this feature* | **skyline over its own span** | **no** | **50 — innermost** |
| dynamics / hairpins, above | `dynamicsLine.ts` (real) | **baseline** | **yes** | 250 |
| future: 8va bracket | — | skyline | no | 400 |
| future: technique text (Alt+T) | — | **baseline** (Finale's "expressions") | **yes** | 450 |
| tempo marks | fixed rung, `stave.getYForTopText(1)` (`TempoLayout.ts:245`) | system-level, outermost | yes, across systems | 1300 |
| future: rehearsal marks | — | system-level, outermost | yes, across staves | 1500 |
| future: lyrics | — | **baseline** (below) | **yes** | — |

Two things fall out of the table:

- **The trill is the innermost family of everything we have or plan.** An innermost family never has
  to know what is above it: it reads the ink below and takes its rung. Every collision it can have
  with an outer family is resolved by the *outer* one moving — which, per §2, it does by reading the
  trill's ink.
- **Tempo is the outermost.** So our two existing non-note-local families sit at opposite ends of the
  standard order, which is why nothing has collided yet, and why nothing is owed today.

---

## 4. THE DECISION

**Do not build a ladder now.** Build the trill with mechanism 2 over its own span, and let mechanism
3 stay implicit in the ink model (§2).

**The trigger to build it — write this down, it is the whole point of the file:** the first family
that is **neither innermost nor on a baseline**. That is the **8va bracket** or **technique text**.
Both sit *between* dynamics-above (250) and tempo (1300), so each would have to be ordered against a
family it does not produce ink for, in a pass that runs at the same time. When one of those is
built, the priority table in §1(3) becomes a module — one row per family, consumed by the
placement functions that exist by then — and `TempoLayout.ts`'s fixed rung is its first customer.

⛔ **Until then, do not add a third private vertical rule.** A new above-staff family must either
join a baseline, or read the ink band the way the trill does. That is the rule this file exists to
make checkable; `DESIGN-PRINCIPLES.md`'s open boundary case warns about exactly the alternative
(two settings arriving by two routes).

### Known and accepted limitation

The ink model holds noteheads, ledgers, dots, accidentals, stems and flags — **not** articulations,
slurs or tuplet brackets. So a trill over a stem-up passage clears the stems and flags honestly, and
is blind to an accent under it, exactly as the dynamics line below is blind to a staccato dot. This
is the same limitation, in the same place, with the same fix: **a row in the ink model**, never a
private extent computed at a draw site. Add the row when his eye says the drawing is wrong, not
before.

---

## Sources

- LilyPond, [Outside-staff objects](https://lilypond.org/doc/v2.24/Documentation/learning/outside_002dstaff-objects)
  and [Default values for outside-staff-priority](https://lilypond.org/doc/v2.24/Documentation/notation/default-values-for-outside_002dstaff_002dpriority)
- LilyPond, [TrillSpanner internals](https://lilypond.org/doc/v2.24/Documentation/internals/trillspanner) — `padding` 0.5, `staff-padding` 1.0, `outside-staff-priority` 50
- MuseScore, [Automatic placement](https://musescore.org/en/handbook/3/automatic-placement) and
  [Positioning of elements](https://handbook.musescore.org/formatting/positioning-of-elements)
- Finale, [Adjust Lyric Baselines dialog](https://usermanuals.finalemusic.com/FinaleMac/Content/Finale/LYRICBASELINESDLG.htm) — the four baseline scopes
- Dorico, [Aligning dynamics](https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_dynamics_aligning_t.html)
  and [Changing the vertical order of playing techniques](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_playing_techniques/notation_reference_playing_techniques_vertical_order_changing_t.html)
