# Octave clefs — treble 8vb and bass 8vb (PLANNED, not started)

Recorded 2026-07-20, from the Clef window work (`src/windows/clefWindow.ts`). Unlike
percussion (`docs/unpitched-staves-plan.md`), these are ordinary clefs: their staff lines
still mean pitches. Only the octave moves.

## 0. What they are

- **Treble 8vb** (`gClef8vb`) — read as treble, sounds an octave lower. Tenor voice, guitar.
  The one people actually miss.
- **Bass 8vb** (`fClef8vb`) — read as bass, sounds an octave lower. Contrabass. Rarer, but
  free once the mechanism exists.

8va (up an octave) is the mirror image and needs no separate design; it is left out of the
first cut only to keep the picker short.

## 1. THE DECISION — written pitch, not sounding pitch

Under treble 8vb the middle line is **written B4** and **sounds B3**. The model must pick one,
and it decides the size of the whole job.

**DECIDED: the model keeps storing WRITTEN pitch — what the notehead says.** The octave lives
in exactly one place, at the point where written pitch becomes sound.

Consequences, and why this is the cheap side:

- `ElementRegistry.CLEF_REFERENCES` (`src/engine/ElementRegistry.ts:567`) and
  `CLEF_MIDDLE_LINE_DIATONIC` (`src/utils/clefUtils.ts:19`) gain entries **identical to plain
  treble / bass**. No new arithmetic; a click on the middle line yields B4 as it always did.
- Note placement is untouched. VexFlow's `'8vb'` annotation is cosmetic — it swaps the clef
  glyph and does not move notes — which is exactly right when the key we hand it is the
  written pitch.
- Stem direction, tie/slur side, selection, keyboard navigation, copy/paste: all compare
  written pitches to written pitches, and all keep working with no change at all.

### Rejected: store sounding pitch

Then every note under an octave clef must be shifted back UP before it reaches VexFlow, or
B3 is drawn below the staff instead of on the middle line. That means a new per-note coupling
in `NoteBuilder` between each note and its effective clef — and a missed site is an
off-by-an-octave that draws silently wrong. Rejected for the reason the model already rejects
globals: one value must not mean two things depending on who is asking.

## 2. Change surface (small, and all of it table-driven)

1. `Clef` union in `src/types/music.ts` gains `'treble8vb'` and `'bass8vb'`.
2. Both clef tables gain entries copied from their base clef (see §1).
3. The six `addClef` sites pass VexFlow's annotation — `stave.addClef('treble', size, '8vb')`.
   Sites: `VexFlowRenderer.ts:1193, 1196, 2211, 2213, 2865` and `GutterRenderer.ts:96`. A
   `clefToVexflow(clef): [type, annotation]` helper so the mapping exists ONCE.
4. **Playback** — the only place the octave is real. `playbackSchedule.ts:112` currently reads
   `spellingToMidi(np.step, np.alter, np.octave)` with no clef in hand; it must resolve the
   effective clef at that chord's (measure, beat, staff) via `effectiveClefAt` and subtract 12
   under an 8vb clef. This is the one genuinely NEW coupling in the feature — the schedule
   builder does not consult clefs today.
5. Two more rows in `CLEF_CHOICES`. The glyphs are `\uE052` (gClef8vb) and `\uE064` (fClef8vb),
   sitting on the same lines as their base clefs.

## 3. OPEN QUESTION — verify before building

**How does MusicXML treat `clef-octave-change`: is `<pitch>` written or sounding?** It changes
nothing today, but it decides whether a future import/export is a straight mapping or a
conversion — cheap to answer now, expensive to discover after a library of files exists. If
MusicXML turns out to store sounding pitch there, §1's decision still stands for the internal
model; the conversion simply belongs in the import/export layer, and this doc should say so.

## 4. Definition of done

Picking treble 8vb from the Clef window arms it; clicking the score sets it; the staff draws
the 8vb glyph; a note on the middle line still reads B4 everywhere in the editor and **plays
B3**. Tests green, boundary lint clean.
