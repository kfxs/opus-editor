# Beaming

Which notes are joined by a beam. The rules live in `src/utils/beaming.ts` — pure, no VexFlow, no
DOM: it takes a bar's slots plus a `MeterInfo` and returns slot-index groups, which
`VexFlowRenderer.createBeamGroups` maps onto its parallel `StaveNote[]`.

## Where a beam lives: on the NOTE

`beam?: BeamMode` is a field of the `Chord` slot (`types/music.ts`), projected onto the flat `Note`
and settable through `NoteParams`. It is stored as **absent** when it is `'auto'`, so the default
costs nothing in JSON and `?? 'auto'` is how you read it back.

It is **not** an engraving override. `EngravingOverrides` holds anchor-relative *visual nudges* in
staff spaces, keyed by element id, which auto-reset when their anchor breaks. A beam mode is not a
nudge — it changes *what is engraved*, which notes are grouped, the same class of statement as
`stemDirection` sitting beside it on the slot. MusicXML puts `<beam>` on the note; music21 puts
`.beams` on the note.

## The default: the meter's beat groups

With no override, notes beam together while they share a `getBeatGroup(beat, meter)` — the bar
partitioned by the meter's own group lengths. 4/4 beams per quarter, 6/8 → 3+3, 9/8 → 3+3+3,
7/8 → 2+2+3, and a stored additive grouping (8/8 as 3+3+2) is honoured as written.

Three things always break a group, whatever the meter: a rest (you cannot beam silence), a
non-beamable duration (quarter and longer), and a group that ends up with fewer than two notes.

Beaming does **not** depend on clef — a beam group may span a mid-measure clef change. See
`docs/note-selection-hit-detection.md` for that companion decision.

## The four overrides

| mode | meaning |
|---|---|
| `auto` | no override — the metric grouping above (stored as no field at all) |
| `single` | force this note out of any beam |
| `begin` | a beam **starts** here — the note before is cut loose, and the meter closes the group |
| `continue` | this note is in the middle of a beam — **beamed on both sides** |
| `end` | close the group after this note |

### `continue` is symmetric (fixed 2026-07-24)

A note marked `continue` has a beam coming in *and* a beam going out. That is what the word means,
and what MusicXML means by it — so the mark must not depend on where the note sits in its group.

It used to. `computeBeamGroups` only removed the break *behind* a `continue` note, so with eight
eighths beamed 2+2+2+2:

- on the **first** note of a group, the boundary you want to cross is behind it → it worked;
- on the **last** note of a group, the boundary is in *front* → the mark did nothing at all.

A `bridgeNext` flag now makes the note *after* a `continue` join across the boundary too. It spends
itself on that one note, so a single `continue` bridges **exactly one boundary** rather than
dissolving every boundary left in the bar: both cases above give `[0,1,2,3] [4,5] [6,7]`.

`begin`…`continue`…`end` is unaffected — `end` closes the group explicitly.

### `begin` starts a beam the METER ends (fixed 2026-07-24)

`begin` used to open a **forced group that ignored every beat boundary** until an `end`, a rest, or the
end of the bar. The group never terminated: eight eighths beamed `2+2+2+2` with `begin` on the second
engraved **one seven-note beam** with the first note flagged, every note after the mark reading
`continue`.

The missing thing was the **end**, not the taking of the next note. `begin` still takes it — a beam of
one note is not a beam, and MusicXML says the same by construction: a `begin` is followed by
`continue`s and an `end`, never by nothing. So the mark bridges **exactly one boundary**, like
`continue`, and then the meter closes the group:

```
auto              (1 2) (3 4) (5 6) (7 8)
`begin` on 2      (1)  (2 3 4)  (5 6) (7 8)     roles: single begin continue end …
```

Two consequences worth knowing:

- **`begin` … `end` alone no longer spans several beats.** One mark bridges one boundary, so a beam
  over six eighths wants `continue` on the notes between — which is what MusicXML writes too. A press
  applies to the whole selection, so "select the run, press `continue`" does it in one action.
- **On the last beamable note of a bar `begin` engraves nothing**, because only `continue` opens a
  barline (below). The mark is kept; there is simply nothing on this side of the barline to start a
  beam with.

## Through the barline

```
 bar 1                    | bar 2
   ♪  ♪  ♪  ♪ ═════════════════ ♪  ♪
```

A barline is the strongest boundary in the bar, and it is still a boundary: mark the note on either
side of it `continue` and the beam carries through. **No new field and no new button** — a second
one ("beam across barline") would be the same statement written twice, and the two could then
disagree. `docs/DESIGN-PRINCIPLES.md` also keeps the measures spine removable, and a feature that
needs a special field for *the boundary that happens to be a barline* has baked bars in.

Either side, because `continue` means the same thing wherever it sits (above). The last note of bar N
has a beam going out; the first note of bar N+1 has one coming in, and across a barline there is
nowhere else it could come from.

Three things follow from the mark being the only thing that opens a barline:

- **The default never joins.** The bar boundary is an unconditional break, and it has to be stated as
  one — `beat` is bar-relative, so beat 0 of bar N+1 falls in the same beat group as beat 0 of bar N
  and the metric rule alone would silently join every bar to the next.
- **Only `continue` opens it.** `begin` bridges one boundary too (above), but not this one: a beam
  through a barline is a deliberate, unusual notation, and it should take the mark that says *this
  note is beamed on both sides* rather than fall out of a mark about starting a group. `begin` …
  `continue` at the barline … `end` is how a manual group spans two bars.
- **Chaining falls out.** A mark at two successive barlines runs the beam through both.

The grouping is `computeCrossBarBeamGroups(bars)` in `utils/beaming.ts`, taking a run of bars — each
with **its own meter**, since a run may contain a time-signature change — and returning `(bar, slot)`
refs. `computeBeamGroups` is now a run of one, so there is one algorithm for both.

### Through a system break too — the half-beam

One VexFlow `Beam` cannot span two lines, so a group straddling a break is not one beam: it is
**planned whole and drawn as one fragment per system**. Each fragment hangs a short **half-beam** over
its open end — the end-of-line fragment carries it through the closing barline into the margin, and the
next line's fragment projects a shorter stub left of its first note. The two read as one beam
continued across the page, which is what real engraving does; before, the pair fell back to two ordinary
flagged groups, and the mark simply had nothing to join on that page.

The mark does not change and nothing is added — `continue` at a barline still means *beamed on both
sides*, and this section is the whole statement. The palette still reads `continue` at the break: the
role is a fact about the **score** and the break a fact about the **layout** — `ScoreModel` does not
know where the lines fall, and now intent and engraving agree rather than merely not being a bug.

How it is drawn — the per-side split, the half-beam stub, the lone-note case, and what stays a
whole-group fact (stem direction, the crossing beam count) — is in `docs/cross-barline-beaming-plan.md`.

## A beam group has ONE stem direction

A beam cannot attach to stems pointing opposite ways, so the group's direction is a property of the
*group*: `calculateBeamGroupStemDirection` resolves it once — an explicit `stemDirection` on any
member wins, then the multi-voice lane's forced side, then the pitch furthest from the middle line —
and every note in the group is set to it. **An `x` flip on any member therefore flips the whole
beam**, which is the only thing it can mean.

⚠️ In a multi-voice bar that collides with the re-assert. `VexFlowRenderer` captures each note's
intended stem *before* the beams exist (to undo VexFlow's same-tick reshuffling after `format`), so
the flipped note's partners were still marked with the voice's own side — and
`StemmableNote.setStemDirection` **clears `note.beam`**. The partner then drew its own stem *and* a
flag while the beam went on drawing a stem for it: doubled stems, from one `x` press. Once a note is
beamed, its intended direction **is** the beam's, and the capture is refreshed to say so
(`multiVoiceStem.test.ts` pins both halves).

## Secondary beam breaks (subdivision)

Six sixteenths beamed as one group, subdivided 3+3: **one** primary beam over all six, the 16th-level
beam broken in the middle. Standard notation — the primary beam shows the group, the secondary shows
how it is felt inside.

```
  ┌─────────────────┐
  ├─────┐   ┌───────┤
  │  │  │   │  │  │
```

`secondaryBreak?: boolean` on the slot, projected onto the flat `Note` and settable through
`NoteParams`, absent when off. It sits on the note that **starts** the new group — the break is in
front of it, the reading `begin` already has, and the note MusicXML puts `<beam number="2">begin` on.

It is **not** a sixth `BeamMode`, because it is a different statement. The mode says *which notes are
beamed together*; this says *how many lines join them*. The six notes above are `auto` — nobody
authored their grouping, the meter did — and they are still subdivided. The two are set
independently, exactly as MusicXML keeps `<beam number="1">` and `<beam number="2">` apart.

Drawing it is VexFlow's own `Beam.breakSecondaryAt`, no geometry of ours. The one wrinkle is an index
translation, and it lives in `secondaryBreakIndices` (pure, tested) rather than inline in the
renderer: our flag marks the note the break is **in front of**, VexFlow wants the note the beam
**ends after** — so a break in front of `i` is `breakSecondaryAt([i - 1])`. A flag on the group's
first note has nothing in front of it and is dropped.

The `subdivide` button is **selection-only** — no armed entry-mode value, unlike the beam mode. A
subdivision is a statement about a group that already exists ("where does the second beam break
*within* these six"), which is not something a note you have not written yet can carry. Sibelius's
break-secondary is a selection edit for the same reason. It toggles across the whole selection as a
set, like the articulations: all of them have it → remove, otherwise add.

## The palette (dev shell)

The `Beam:` row in `dev/devToolbar.ts` reads `beamHighlight(state)` (in `interactions/keypadSync`,
beside `durationHighlight`), which follows the shared single-selection rule:

- **entry mode** — the armed value, what the next note will carry;
- **selection mode, one note** — that note's own beam, synced by
  `SelectionController.syncPaletteToNote`. ⚠️ it reads the engine's projection, because
  `getMeasureNotes` does *not* carry `beam` — reading it there hands back `undefined` for every
  note and looks fixed while doing nothing;
- **nothing, or several notes selected** — nothing lit. `BeamMode` has no "none", so an ungated row
  would always have a button lit, claiming a selection that isn't there is auto-beamed.

`auto` lights in slate rather than the cyan of the explicit modes: it is the value a note has when
it has *no* beam of its own, and it must not read as an authored choice.

### Two facts, two lit buttons (2026-07-24)

The row above answers one question — *did anyone author a beam here?* — and on its own that is not
quality information. Eight auto eighths in 4/4 are beamed 2+2+2+2; every one of them reports `auto`,
so the row says nothing about the four beams you can see on the staff, and nothing about the fact
that the first of each pair *begins* a beam and the second *ends* it.

So the row answers a second, independent question at the same time: *what is this note's beam?* —
`beamRoleAt` in `utils/beaming.ts` (pure), reached through `ScoreModel.getBeamRole(noteId)` and the
`beamRoleHighlight` rule beside `beamHighlight`. First index of its group → `begin`, last → `end`,
between → `continue`, in no group → `single`. There is no `auto` role: `auto` is the absence of a
choice, not a thing a note can be.

The colour carries which fact lit the button:

- **cyan** — you authored this;
- **slate** — this is the case and nobody chose it: `auto`, and the role.

`auto` + slate `begin` reads as one sentence. And the two can **disagree** — an orphaned `end` with
nothing behind it is authored `end` (cyan) and engraved `single` (slate), which is how a mark that
did nothing announces itself.

Two things the role must get right. It is read **live** from the engine on every sync, never mirrored
into `EditorState`: it is a property of the score, and editing the *neighbour* changes it. And it is
computed over the run the renderer actually beams — **one voice of one staff, sorted by beat, across
the whole lane** (`beamRoleAtRef`) — or a voice-2 note gets scored against voice 1's grouping, and a
note beamed through a barline reports the `end` its own bar would call it while the staff shows
`continue`.

Selection mode with a single note only. In entry mode `beamHighlight` shows the *armed* beam — the
beam of a note that does not exist yet — and there is no role to pair it with.

### A rest darkens the whole row

You cannot beam silence, so a selected rest has no beam to author and no role to be in: **both** facts
go null (`getBeamRole` returns null for a rest slot; `beamHighlight` takes a `BeamSource` so it can
ask). `auto` lit over a rest would be the row answering a question the note never asked, and offering
a control that does nothing — `setBeam` has always skipped rests.

### A press applies to the whole selection

The row is dark for a multi-selection — no single value stands for a set — but a **press** is not a
reading. `setBeam` applies to every selected note in one `runBatch`, like every other multi-select
action, because beaming is a statement about a *run* of notes: "select the group, press begin" is the
gesture. It used to write only `selectedNoteId`, leaving the other five notes of a selected six
untouched. Rests in the selection are filtered out rather than refusing the whole press.
