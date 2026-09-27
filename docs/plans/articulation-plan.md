# Articulations — what the research asks of us (2026-09-27)

The research is `docs/research/articulation-research.md` (sources, measured plates, each engine's values
with file:line). This file holds what HE has taken from it: one rule decided, and a list to come back to.
⛔ The list is not a queue — each item is his call when we return to it.

## TODO — decided (his word, 2026-09-27: *"we have to implement this as a rule"*)

- [ ] **T1. Articulations and slurs — inside or outside.** Gould pp. 121–122, Ross p. 130, Stone pp. 42–43
  and Gerou & Lusk p. 128 agree:
  - **staccato and tenuto go INSIDE the slur everywhere**, its first and last notes included;
  - **an accent goes INSIDE in the middle of a slur but OUTSIDE at its two ends.**

  Where it lands today, in both presets (`docs/plans/slur-search-plan.md`):
  - `house`: `rendering/curves/slurArticulationEndpoint.ts:59-70` clears EVERY mark on an end note, so an
    end-note accent ends up inside the slur — the books' opposite.
  - `lilypond`: `rendering/curves/slurSearchProblem.ts` `ARTICULATION_AVOID` hands the accent over as
    `around` (the curve keeps clear of it either way) — LilyPond itself MOVES the accent outside the slur,
    which we do not do (item L2 below).

  ⚠️ The rule needs the ACCENT to be placed outside the slur at an end — which is moving a mark (L2), not
  only choosing what the slur clears. Plan it with L2 in view.

  **T1 has a SLUR-SIDE half that needs no mark to move — measured 2026-09-27, his test.** An accent on a
  MIDDLE note must be inside the slur (the slur passes OVER it). Under the `lilypond` slur preset (the default)
  it is not guaranteed: `slurSearchProblem.ts` `ARTICULATION_AVOID` hands the accent over as `around`, which
  only keeps the curve clear of it, so the slur may slip BETWEEN the note and its accent. Chromium sweep —
  A4 C5 [accented note] E5, slur above, the middle note G3 → E7:
  - G3 – A4: the accent sits below the note (notehead side), the slur above — opposite sides, fine;
  - B4 – B5: the slur passes OVER the accent ✓;
  - **C6 – E7: the slur passes UNDER the accent, between note and accent ✗** (the higher the note, the dearer
    arching over its accent, and `around` lets the curve take the cheaper way under).

  ⭐ The fix: hand an accent on a MIDDLE note to the slur search as `inside` (an end note's accent stays as it
  is until L2 moves it). `house` already clears middle marks from above (a note's box includes its marks).
  ⛔ A slur-plan switch was offered and declined, his call: *"it is part of the articulation and t1 plan so it
  must go in that doc"* — do it with T1.

## LATER — to go back to (his word, 2026-09-27: *"we also have to go back to this later"*)

**Numbers (staff spaces)**, from the research — a menu of sourced defaults, ⛔ not decided:
- **N1.** A staccato stands **1** sp from the head's centre when the head is in a space, **1.5** when it is
  on a line (Stone, Ross).
- **N2.** On the stem side, marks stand about **½** sp from the stem tip; Gould's plate measures
  **0.55–0.60**.
- **N3.** Between stacked marks Gould's plate measures **0.25–0.45** sp, opening to **1.0–1.6** when a slur
  passes between them.
- **N4.** Each engine's own values are in the research doc, with file and line. ⚠️ Our own drawn gaps are
  UNMEASURED — that needs the browser first.

**Where we differ from the books:**
- **L1.** An accent on a slur's first or last note goes INSIDE the slur in ours — all four books put it
  outside at the ends. (= T1.)
- **L2.** We never MOVE a mark to clear a slur; LilyPond and MuseScore do.
- **L3.** Our accent can sit INSIDE the staff (`betweenLines: true`, `EngravedArticulation.ts:77`); all the
  books and all three engines place it outside by default.
- **L4.** A staccato ALONE on the stem side sits on the STEM in Gould, Gerou & Lusk, LilyPond and Verovio;
  ours centres it on the notehead unless the note's stem-align setting is on, which moves all of its
  stem-side marks together.
- **L5.** Cue notes: the mark shrinks, but its distance from the note does not.
