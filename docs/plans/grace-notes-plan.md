# Grace notes — appoggiatura, acciaccatura, Nachschlag: the plan

> **Status: WRITTEN 2026-09-22, nothing built.** 📄 The research is `docs/research/grace-notes-research.md`
> (four sources folded into one file; its §0 is the synthesis this plan reads). ⛔ This plan is the place
> the DECISIONS get made, and §0 lists them as PROPOSED — each is his call, and until he says so it is
> a default, not a decision (`feedback_an_open_question_is_not_a_decision`).
>
> ⚠️ **THE UI IS THE DEV SHELL'S** — `src/dev/devToolbar.ts`, three buttons in a row, the way the
> two-note tremolo shipped (`docs/plans/two-note-tremolo-plan.md` §0). The real interface is undecided;
> nothing here reaches the Keypad, the menus or the Properties window, and nothing here needs them.
>
> ⭐ **Why now, and why it is worth more than the feature.** A grace note is the first notation we
> build whose attacks take NO metric time — after the fan, whose attacks share a slot's time. Together
> they are two of the three time relations free notation needs (§10), and the machinery this plan
> reuses from the fan (attacks that are not slots, one expander for picture and sound, unfixed ink of
> a column) is what that future stands on.

---

## 0. ⏳ The decisions this plan is built on — PROPOSED, his call

| # | decision | proposed | why this and not the other |
|---|---|---|---|
| **D1** | **where a grace lives** | ⭐⭐ a **CHILD of its main chord** (`Chord.graceBefore` / `graceAfter`), ⛔ never a slot | MuseScore, VexFlow and Dorico's *"mini-score at a rhythmic position"* all do this; LilyPond's first-class grace moment buys generality and pays for it with its own Known Issues list (barlines and key signatures shifting on the other staves, MIDI *"going back in time"* — research §0.2). ⭐ And it is the FAN's shape: rebar, rest fill, capacity, collision, columns, undo and JSON never see it (`docs/plans/fanned-beams-plan.md` §0) |
| **D2** | **a grace AFTER** | stored on the note it **follows** (`graceAfter`), drawn as that note's right ink | Stone p. 140: graces *"belong to a main note"*; MuseScore stores it there too and only its LAYOUT pre-appends it to the following segment (research §B.3.1). MusicXML has no attachment and importers guess — we should not have to |
| **D3** | **the slur** | a **flag on the group**, drawn by the grace module from the first grace to the main note, ⛔ not an entry in `Score.slurs` | Gould p. 130: *each group its own slur, even inside a phrase slur* — so it is part of the group's picture, as LilyPond's auto-slur is (`spanner-id 'grace`). A real slur anchored to a grace id stays possible later; today it would drag the slur family's drag/flip/reanchor into P1 for no picture the flag does not give |
| **D4** | **playback** | **MuseScore's rule as the first preset**: every grace ON the beat, the main note delayed — slashed graces a physical **65 ms** each, unslashed **½** of the main note (⅔ dotted); a grace after takes the **end** of its note | the only complete rule found; LilyPond's 9/40-from-the-previous and Dorico's before-the-beat are the second and third rows of the same table (research §0.3). ⛔ A number is never a blocker (`CLAUDE.md`) |
| **D5** | **size** | **2/3** as the first row (`GRACE_SCALE`) | the fonts draw it (Bravura 0.66, Sebastian 0.64), VexFlow used it, Gould's plate measures 0.60–0.65; Dorico's 0.6 and MuseScore's 0.7 are the presets either side (research §0.4) |
| **D6** | **entry** | the fan's TWO WAYS (§3): a press with a note selected ADDS a grace of that pitch; with nothing selected it ARMS a tool that reads the armed length | the same rule the Time Signature window and the feather dialog follow: *"apply to what is selected, otherwise arm"* |
| **D7** | **a grace on a REST** | ⛔ **refused** in this plan, like the fan | no book on disk says what it looks like (research §0.7); a refusal is honest and reversible |

Everything below follows from these seven. Change one and its section changes; nothing else does.

---

## 1. The model — `types/notes.ts`

```ts
/** One grace note or grace chord — an ATTACK with a written value and no counted duration. */
export interface GraceNote extends Attack {
  /** Real NotePitches with ids: a click selects one, the arrows move it, the accidental stamp
   *  re-spells it — through `attackOf`, exactly as a fan member (`FanMemberChord`). */
  pitches: NotePitch[]
  /** What it is DRAWN as. ⛔ Never counted: not by the bar, not by rebar, not by the columns. */
  duration: NoteDuration
  dots?: number
}

/** The graces attached to one side of one main chord — Dorico's "mini-score at a position". */
export interface GraceGroup {
  notes: GraceNote[]
  /** Acciaccatura. ONE flag for the group: a single grace draws it through its flag, a beamed group
   *  once, on the first stem (Gould p. 126). Absent = appoggiatura. */
  slash?: true
  /** Absent = UP, whatever the pitches — all four books, all three engines (research §0.4). The one
   *  written exception is the lower part on a shared stave; voice parity decides BEFORE this. */
  stemDirection?: 'up' | 'down'
  /** Absent = a slur from the first grace to the main note, below (Gould p. 129); `false` = none (Stone). */
  slur?: false
}

// on Chord, beside `fan` / `tremolo`:
graceBefore?: GraceGroup
graceAfter?: GraceGroup
```

⭐ **Why a sibling of `FanMemberChord` and not a reuse of it.** They share `Attack` (marks, placement)
and the reason for real ids; they differ in the one thing the fan model exists to forbid its members —
a fan member has NO written value of its own (its length is the ramp's), a grace has one and NO
sounding one. Two types, one shared base, `attackOf` answering for both (`engine/models/slotLookup`).

⭐ **Absent is the only spelling of every default** — `slash`, `stemDirection`, `slur`, `dots` — because
`laneFingerprint` stringifies the whole slot for the width-cache key (the fan's rule, `normalizeFan`),
and a group with no notes is deleted, never stored as `{ notes: [] }`.

⚠️ **What a grace does NOT have**: a `beat`, a `voice`, a `staffId`, a `tupletId`, a `beam` mode — it
inherits all five from its main chord. A grace group in a tuplet is fine (it is the chord's); a grace
that crosses staves is not in this plan (§9).

### 1.1 What travels — `utils/rebar.ts`, `utils/slotFieldTravel.ts`

`RebarEvent` gains `graceBefore` / `graceAfter`, carried like `fan` (a slot field the relay does not
list is a slot field the relay eats — `docs/plans/tremolo-plan.md` §6). ⭐ The tie-split rule is the fan's
with one more line: **a grace BEFORE rides the FIRST piece, a grace AFTER rides the LAST** — a
Nachschlag belongs to the end of its note, and the end is where the split put it. Paste (the
clipboard flattens through the same events) and a voice move (`PitchInsert`) carry both.
Break-test each link by removing it, as the tremolo's P1 did.

### 1.2 JSON — report, never repair (`docs/plans/json-io-plan.md`)

Two optional keys on a chord, ids validated unique with every other pitch id, a group with no notes
REPORTED. `fromJSON` recomputes nothing here — a grace has no `actualDuration` to recompute.

---

## 2. The operations — `engine/models/graceOps.ts` (⛔ not methods on `ScoreModel`)

| op | does | refuses |
|---|---|---|
| `addGrace(score, chordId, side, note, form)` | appends a `GraceNote` to the chord's group on that side, creating the group; `form` = `acciaccatura` (sets `slash`) / `appoggiatura` | a rest (D7); a fan MEMBER as host (the slot is the host — `found.chord`); a tied CONTINUATION as host for a grace before (the attack is at the chain's head) |
| `removeGrace(score, pitchId)` | takes the pitch out; the last pitch of a note takes the note; the last note takes the group | — |
| `setGraceSlash(score, chordId, side, on)` · `setGraceStem` · `setGraceSlur` | the three group flags, absent-as-default | — |
| pitch / accidental / articulation edits | ⛔ **NOT here** — they go through `attackOf` and the pitch's id exactly as a fan member's do (`ScoreModel.updateNote`, `markOps`) | — |

`findSlotByNoteId` grows a `graceNotes` option beside `fanMembers`, answering `{ chord, pitch,
grace: { side, index, note } }`; `attackOf` returns the `GraceNote`. `isFanMember` gets a sibling
`isGraceNote` on the facade — ⭐ a one-line delegation, the logic in the ops module.

**Delete** (`shortcutWiring` → `deleteNoteOps`): a grace pitch deletes as a grace — one branch beside
the fan member's in `deleteNoteWithRepair`, and no bar repair, because nothing rhythmic left the bar.

**Undo**: a whole-score snapshot, so free — one `mutate(description)` per op.

---

## 3. Entry — the dev palette and the stamp

**Three buttons** in `devToolbar.ts`: `acciacc.` · `appogg.` · `after`. Each calls ONE
`PaletteController` method, `pressGrace(form, side)`, which applies D6:

1. **A note selected** → `graceOps.addGrace` on it with **the note's own pitch** (MuseScore's
   behaviour: the grace appears, you move it with the arrows). Pressing again APPENDS a second grace to
   the same group — that is how a group of three is typed. Written value = the ARMED duration
   (`selectedDuration` + `selectedDots`), which for a fresh score is what the duration keys say; the
   default a press finds there is the convention's: an **8th** for a single grace, and the second press
   of a group makes both **16ths** (Gould p. 125: *"two beams recommended"* for a group, G&L: two =
   16ths). ⚠️ Provisional, one function (`graceWrittenValue(groupSize)`), his eye.
2. **A GRACE selected** → the same press toggles the group's `slash` when the form differs from the
   group's (acciaccatura pressed on an appoggiatura group and back), and appends when it is the same.
3. **Nothing selected** → arms `{ kind: 'grace'; form; side }` on the `MarkingTool` union — it joins
   the union, `MARKING_TOOL_USES_ARMED_LENGTH` answers **true** (it reads the armed length like the rest
   tool, `docs/how-it-works/marking-tools.md`), and it ghosts (`GHOST_DRAWERS` + `ToolGhost` row: one small
   note following the pointer, at `GRACE_SCALE`, slashed when the form is). The click is
   `interactions/stamps/graceStamp.ts`: **a hit-test, not a position** — it names the NOTE the press
   lands nearest (`findClosestNoteOrRest`), because a grace is attached to something that exists, like
   the articulation stamp and unlike the fan's; the pitch is the click's **y** through
   `pixelToPosition`. The tool stays armed (a stamp is used in runs).

**The row lights** by the selected note's own groups, through one `graceHighlight(state, engine)`
read by the toolbar's single subscriber — the tremolo row's shape, three sources in a fixed order.

---

## 4. Room — `engine/layout/graceRoom.ts` (pure, staff spaces)

⭐⭐ **A grace group is UNFIXED INK of its main chord's column** — LEFT ink for a grace before, RIGHT
for a grace after (`docs/plans/spacing-model-plan.md`, *FIXED vs UNFIXED*; LilyPond's
`strict-grace-spacing`: *"grace notes are put left of the musical columns for the main notes"*). It is
what every engine does (research §0.4, *spacing*): the columns never learn a grace exists, the spring
solve floors the gap before the host, and the other staves keep their grid. ⛔ Not a column (LilyPond's
cost), ⛔ not a rod (a rod is for material that CROSSES gaps; a grace crosses none — it takes no time).

**One number feeds the ROOM and the INK** (the `dotGap` / `accidentalGap` rule): `graceGroupWidth(group,
scale)` answers the group's extent in staff spaces, and `GracePass` (§5) places the heads by the SAME
function walking right-to-left from the host's notehead — Verovio and MuseScore both pack from the
principal outward.

| row | first value | source |
|---|---|---|
| grace → grace, edge gap | **0.8 sp** | Gould's drawings measure 0.65–1.0 (research §C.6); MuseScore `graceToGraceNoteDist` 0.3 + the head |
| last grace → main note, edge gap | **1.15 sp** | Gould's drawings 1.15 (2.1–2.5 c-to-c); ⭐ the gap to the principal IS wider than between graces; MuseScore `graceToMainNoteDist` 0.45 + head |
| inside the group, per written value | our spacing rule × **2/3** | LilyPond `GraceSpacing` runs the same law at `increment 0.8` vs 1.2 |
| barline → first grace | **1.0 sp** | Gould's drawing; her p. 43 allows *½ space* in cramped conditions |
| an accidental on a grace | its own left ink at `GRACE_SCALE` | LilyPond scales it one step smaller than the note |

`measureColumns.slotInk` appends the group's boxes to the host's `ink` with a new `InkKind` **`'grace'`**
and the pair rows above in `spacingPadding` (⛔ a new drawn element adds a ROW there, never a constant
elsewhere). ⭐ The `'grace'` kind's band is its heads' lines, so `kerning` can tuck a low grace under a
high preceding head like any other ink. A grace AFTER is right ink of the same column, and the next
column's gap clears it by the same rows mirrored.

⭐ **Multi-voice, multi-staff**: all the graces at one beat are one mini-score (Dorico), and our column
already merges voices and staves at a beat, so the host column's left ink is the `max` over every
group at that beat — for free, and correct in P1. A DIFFERENT group per staff at one beat drawing at
its own x is what Dorico does too (*"the same x on every staff"* is the principal's, not each group's).

⚠️ `shortestDuration` (`docs/plans/shortest-duration-plan.md` §1.4 *"grace notes excluded"*) — excluded
by construction: a grace is not a slot, so the statistic never sees it.

---

## 5. Ink — `engine/engrave/notes/graceGroup.ts` + `engine/rendering/GracePass.ts`

⭐⭐ **A grace is composed from the same parts as a normal note at a scale, placed by one affine —
⛔ never the precomposed SMuFL glyphs.** SMuFL says so itself (research §0.5), Leipzig has no such
glyphs at all, and a glyph cannot be beamed, chorded, given an accidental or a ledger line.

- `engrave/notes/graceGroup.ts` — **the geometry, pure**: given the host's notehead x and the group,
  every member's head x (from `graceRoom`, right to left), its stem tip, its flag or the group's beam
  quads (the page's own `beams/beamGroups` grouping, `EngravedBeam` at the group's scale), the slash
  line, the slur's two ends. Unit-tested in jsdom as arithmetic.
- `rendering/GracePass.ts` — **the drawing**, inside ONE `<g transform="scale(k)">` per group, exactly
  the small staff's mechanism (`docs/plans/staff-size-plan.md` §4.1, `staffScaleGroup`): heads through
  `drawNoteHead` / `EngravedHead`, stems through `drawStem`, flags through `engrave/notes/flag`, ledgers
  through `ledgerLines` (⭐ they come out *"shorter … in proportion"*, Gould p. 26, by the transform
  alone), accidentals through `EngravedAccidental` at the group's size (Gould p. 78), beams through
  `beamLines`, the slur through the curve ink (`docs/plans/slur-plan.md`'s U1 path). ⭐ Every piece goes
  through the pass's `DrawContext`, so the SCENE records it and *"the grace's head stands left of the
  host's by so many spaces"* is a jsdom test (`ScoreRenderer.scene.test.ts`); the ink extents are the
  browser suite's. It registers each head in the `ElementRegistry` under its pitch id (the fan's
  `registerFanInk` shape) so a click selects it and the highlight finds its group.
- ⚠️ **The gap inside `scale(k)` is divided by k** (`project_small_staff_spacing`'s lesson): the head
  gaps `graceRoom` answers are SYSTEM spaces; inside the scaled group they are `/k`.

**The rows** — all changeable, none a blocker; his eye decides (`docs/plans/note-engraving-plan.md` §3
is the precedent):

| row | first value | source |
|---|---|---|
| `GRACE_SCALE` (head, flag, beam, accidental, ledger) | **2/3** (D5) | fonts 0.64–0.66; Gould 0.60–0.65; Dorico 3/5; MuseScore 0.7 |
| `GRACE_STEM_SPACES` (head centre → tip, in the group's own spaces) | **2½ → 3.75 system-sp × k = 2.5** | Stone p. 49; ⭐ Gould's own plate (2.22–2.67, median 2.5) against her text's 2¼; ≈0.75 of a full stem, NOT `3.5 × k` |
| middle-line rule for grace stems | **OFF** | all three engines switch it off |
| stem thickness | **unscaled** (system weight) | Gould's grace plate does not thin it (`docs/research/stem-thickness-research.md` §2.4); ⚠️ the `scale(k)` group WOULD thin it — the stem's stroke is `/k`, as the barline sign keeps the system's weight on a small staff |
| stem direction | **up** (D1's group flag) | research §0.4 |
| slash: length · angle · crossing | **2.1 sp · 40° · mid-stem** (Gould, measured), thickness = staff line | MuseScore `2.0 sp · 40° · 0.125`; SMuFL's Bravura anchors on `flag8thUp` (1.93 × 1.66 sp, 41°) are the sourced row for the 8th-flag case in that face alone — read through `fontMetrics.anchor`, null elsewhere, then the rule |
| slash on a beamed group | **one, on the first stem, diagonal to the beam** | Gould p. 126 *may*; Stone *must*; G&L *never* (a preset later) |
| slur | **below, notehead to notehead**; above when it would hit the main note's accidental or ledgers | Gould pp. 129–130; measured: starts at the grace head's centre, ends 0.17 sp left of the main head's, 0.35–0.5 sp below |
| beams in a group | the group's own beam, at `GRACE_SCALE`; two 16ths = two beams | Gould p. 125; never joined to the principal (all three engines) |

⚠️ The **bar start**: a grace before the first note of a bar stands **after the barline and after the
header signs** (Dorico, LilyPond, Gould p. 127) — which is what left ink of the first column already
does, since the header's own column precedes it. *"Before the barline"* is a later per-group
override (§9). A grace before a **clef change** at the same beat: UNKNOWN in every book — it stands
after the clef, as after every header sign, until someone has a reason.

---

## 6. Playback — `engine/audio/playbackSchedule.ts`, `collectGraceAttacks`

Beside `collectFanAttacks`, read by the same walk, ⭐ **from the same group the drawing reads** —
picture and sound out of one object, as the fan's `fanMembers` guarantees for it. D4's preset as rows
in a `GRACE_PLAYBACK` table (the tremolo's `UNMEASURED_PERIOD_SECONDS` shape: a physical span,
converted to beats at the onset through the tempo map):

| case | first rule | source |
|---|---|---|
| **slashed** (acciaccatura) | each grace **`GRACE_CRUSH_SECONDS` = 0.065 s**, ON the beat; the main note starts after the run and is shortened by it | MuseScore, *"determined empirically"* |
| **unslashed** (appoggiatura), single | **½** of the main note's sounding length (⅔ when dotted); the main note takes the rest | MuseScore; Dorico for ≥ 8th |
| unslashed, a group | the run shares the appoggiatura's half equally | MuseScore (research §B.3.11) |
| **grace after** | each grace `GRACE_CRUSH_SECONDS`, taken from the END of its note | MuseScore; LilyPond's `afterGraceFraction` ¾ is the second row |
| a grace whose main note is tied on | shortens the chain's head; the continuation is untouched | — |

⛔ **Before-the-beat (steal from the PREVIOUS note)** is the SECOND preset, not built here: it needs
the previous event's duration cut after the fact, and the first preset does not. Stone's *"always
before the beat"* and LilyPond's 9/40 wait in the table with their sources.

Velocity and articulation per attack as a fan member's (`articulationEffect` on the grace's own
marks); the dynamic is the slot's.

---

## 7. Selection, highlight, arrows — nothing new, by construction

A grace pitch has an id, so it is selected as a NOTE (`selectedItems`), never a `SelectedElement` kind:
`findSlotByNoteId(…, { graceNotes: true })` finds it, `attackOf` marks it, the arrows re-pitch it
through `updateNote`, the accidental stamp re-spells it, `notePaint` colours the group the registry
handed back. ⛔ No row in `ELEMENT_SPECS` / `ELEMENT_HIT_ORDER`: the grace is not an element kind, it is
a note — exactly the fan member's status (`docs/plans/fanned-beam-pitches-plan.md` §2). The SLASH is not
selectable in this plan; the press toggles it (§3.2).

**Properties** reports the selected grace as a note with its group's three flags — ⏭️ later, not here.

---

## 8. Phases — one step at a time, his UI check between each

- **P0 — the model, the ops, what travels.** §1, §1.1, §1.2, §2. `graceOps` with its spec on a real
  `ScoreModel`; `findSlotByNoteId` / `attackOf` / delete; the relay links each proved by removal; JSON
  report. Nothing drawn. *End state: a grace can be added, found, deleted, pasted and undone in tests.*
- **P1 — ONE grace before a note, on the page.** §3 rule 1 (the press on a selected note, the three
  buttons), §4 (`graceRoom`, the `'grace'` ink kind and its rows), §5 for the single-grace case (head,
  stem, flag, slash, ledger, accidental, the slur), the ElementRegistry registration so the arrows
  work. *End state: press `acciacc.` on a note and see a slashed small note before it, spaced, the bar
  widened, selectable, re-pitchable.* ⭐ This is the step his eye judges the rows on.
- **P2 — GROUPS.** A second press appends; two beams at the group's scale; the slash on the first stem;
  `graceWrittenValue`; the slur from the first grace. *End state: a three-note grace run.*
- **P3 — PLAYBACK.** §6, the first preset, `playbackSchedule.grace.test.ts` — checkable because the
  collector is pure. *End state: it sounds.*
- **P4 — the ARMED tool.** §3 rule 3: the `MarkingTool` member, `MARKING_TOOL_USES_ARMED_LENGTH`, the
  ghost row, `graceStamp`. *End state: arm, click a note at a pitch, a grace appears there.*
- **P5 — grace AFTER.** `graceAfter` through every seam above (right ink, the last piece of a split,
  the end of the note in playback); the third button comes alive.
- **P6 — the toggles.** §3 rule 2 (slash toggle on a selected grace); `setGraceStem` / `setGraceSlur`
  reachable from the console until Properties has rows.

⛔ **Never `vitest` + e2e at once**; the browser suite runs either side of P1, P2 and P5 (renderer
changes), `build:check` after every phase.

---

## 9. Deliberately NOT in this plan

- **"Before the barline"** for a group at a bar's start (Gould p. 127: 3+ before-beat graces MAY) — a
  per-group flag later; Dorico's is broken at repeat barlines, which is a warning about the cost.
- **A grace on a REST** (D7), **a grace inside a grace**, **grace tuplets** (Dorico refuses too),
  **cross-staff graces**, **a grace as a slur/tie ANCHOR in `Score.slurs`** (D3), **a tie from a grace
  to its main note** (the appoggiatura tied over — a real notation, later).
- **The second and third playback presets** (before the beat; LilyPond's fraction) — rows written,
  not wired.
- **The Keypad key** (MuseScore's `/`), **menus**, **Properties rows**, **MusicXML/MEI** — the model
  carries what the formats agree on (research §0.1) so the exporter, when it exists, has nothing to
  invent.
- **A `graceIndex` or any order field** — the array IS the order (MuseScore's is admitted *"not well-
  maintained"*).

---

## 10. ⭐ What this builds toward — the three time relations

| gesture | its time | where it lives | its room |
|---|---|---|---|
| **fan** (built) | OWNS its span — the slot's | `Chord.fan` | a rod over the gaps it crosses |
| **grace** (this plan) | BORROWS from a neighbour | `Chord.graceBefore/After` | unfixed ink of one column |
| **free run** (`docs/research/20c-notation-survey.md` §4; Gould ch. 20 *"placing material freely within a defined time-span"*) | has NO metre — a span in seconds, or none | ⏭️ not modelled | ⏭️ a spacing section of its own |

What the third will take from the first two, and what this plan therefore keeps clean: `Attack` as the
thing a mark is on; one expander read by the drawing AND the playback; ink at a scale inside one
affine; room that is a floor on the grid and never a column. Gould p. 630 keeps grace-note groups
inside proportional notation *"to indicate playing a group as fast as possible"* — the grace is the
one gesture that already belongs to both worlds.
