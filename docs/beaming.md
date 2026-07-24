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
| `begin` | start a manual group here, ignoring beat boundaries |
| `continue` | this note is in the middle of a beam — **beamed on both sides** |
| `end` | close the manual group after this note |

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
computed over the run the renderer actually beams — **one voice of one staff, sorted by beat** — or
a voice-2 note gets scored against voice 1's grouping, an answer about a beam nobody engraved.

Selection mode with a single note only. In entry mode `beamHighlight` shows the *armed* beam — the
beam of a note that does not exist yet — and there is no role to pair it with.
