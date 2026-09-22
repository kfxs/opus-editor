# Grace notes — appoggiatura, acciaccatura, Nachschlag: the plan

> **Status: P0 and P1 committed (2026-09-22). Next: P2 (groups) — or the open list under P1.** 📄 The research is `docs/research/grace-notes-research.md`
> (four sources folded into one file; its §0 is the synthesis this plan reads). ⛔ This plan is the place
> the DECISIONS get made: §0 marks each as ✅ DECIDED (his word, with the date) or ⏳ PROPOSED — until he
> says so it is a default, not a decision (`feedback_an_open_question_is_not_a_decision`). ✅ D1 · D2 ·
> D3 · D4 · D5 · D7 were decided on 2026-09-22, one by one, from the research; D6 is decided for the
> STAMP and open for what a press does to a SELECTED note — a UI-feel question he will iterate on.
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

## 0. The decisions this plan is built on — ✅ decided or ⏳ proposed, his call

| # | decision | status | chosen | why this and not the other |
|---|---|---|---|---|
| **D1** | **where a grace lives** | ✅ 2026-09-22 | ⭐⭐ a **CHILD of its main chord** (`Chord.graceBefore` / `graceAfter`), ⛔ never a slot | MuseScore, VexFlow and Dorico's *"mini-score at a rhythmic position"* all do this; LilyPond's first-class grace moment buys generality and pays for it with its own Known Issues list (barlines and key signatures shifting on the other staves, MIDI *"going back in time"* — research §0.2). ⭐ And it is the FAN's shape: rebar, rest fill, capacity, collision, columns, undo and JSON never see it (`docs/plans/fanned-beams-plan.md` §0) |
| **D2** | **a grace AFTER** | ✅ 2026-09-22 | stored on the note it **follows** (`graceAfter`), drawn as that note's right ink | Stone p. 140: graces *"belong to a main note"*; MuseScore stores it there too and only its LAYOUT pre-appends it to the following segment (research §B.3.1). MusicXML has no attachment and importers guess — we should not have to |
| **D3** | **the slur** | ✅ 2026-09-22 ⚠️ **REVERSED the same day** | ⛔ **a grace draws NO slur of its own** — his words: *"this is not wanted the user is the responsable for enter a real slur if they want"*. A slur on a grace is a REAL one (`Score.slurs`), anchored to the grace's pitch id | the first answer (a flag on the group, drawn by the grace module — Gould p. 130) was built in P1 and felt wrong in use: not selectable, not the user's. The model field (`GraceGroup.slur`) went with it. ⏳ A real slur to or from a grace is STORED and now DRAWN (the grace files its anchor where the slur renderer looks, the fan member's way), but its geometry around a small note is not right yet — its own step |
| **D4** | **playback** | ✅ 2026-09-22 | **MuseScore's rule as the first preset**: every grace ON the beat, the main note delayed — slashed graces a physical **65 ms** each, unslashed **½** of the main note (⅔ dotted); a grace after takes the **end** of its note | the only complete rule found; LilyPond's 9/40-from-the-previous and Dorico's before-the-beat are the second and third rows of the same table (research §0.3). ⛔ A number is never a blocker (`CLAUDE.md`) |
| **D5** | **size** | ✅ 2026-09-22 | **2/3** as the first row (`GRACE_SCALE`) | the fonts draw it (Bravura 0.66, Sebastian 0.64), VexFlow used it, Gould's plate measures 0.60–0.65; Dorico's 0.6 and MuseScore's 0.7 are the presets either side (research §0.4) |
| **D6** | **entry** | ✅ 2026-09-22 the STAMP · ⏳ the rest OPEN | ⭐ **A grace is STAMPED**: arm the grace tool, click a note, a grace appears attached to it at the click's pitch with the armed length (§3). ⏳ **What a press does with a NOTE SELECTED is undecided** — his words: *"probably if a note is selected and we hit grace we just transform that note in a grace, i dont know this is user interaction and needs iteration cause it depends on the feel of the app"*. ⛔ Not MuseScore's "add a grace of the same pitch" by default: that was a proposal, not his call | the stamp is how every attached mark enters (articulation, accidental); the selected-note gesture is a FEEL question, found by trying it (`feedback_an_open_question_is_not_a_decision`: build what does not depend on the answer, ask when it is reached) |
| **D7** | **a grace on a REST** | ✅ 2026-09-22 ⚠️ **REVERSED the same day** | ⭐ **a grace BEFORE a rest is taken** — his words: *"the user wants to enter this first we should not force the user to enter a note before"* · *"attach the grace to the rest and when the rest is changed for a note reattach the grace"* · *"grace in empty measure makes no sense"*. So: `Rest.graceBefore` (⛔ no grace AFTER a rest); on a whole-bar rest the stamp first makes a ONE-BEAT rest at the clicked beat (the meter's felt beat, the bar refilled around it); a slot that takes the rest's place at the SAME beat takes the group (`engine/models/restGraceOps`), and silencing a note keeps its grace on the rest — the rule run backwards. ⚠️ A note that COVERS the beat without starting on it drops the group (logged) — a default | the refusal made the stamp useless on an empty bar (eight silent refusals in a row, his log). The plan's own escape hatch (*"a field on `Rest`"*) was right about the field and silent about the hand-over; the paths a rest leaves the bar by were each proved: the eviction (`slotPlacementOps.evictRestsOverlapping`, beside the tie it already migrated), the keyboard's rest-into-note (`restToChordOps`, extracted from `ScoreModel`), the silencing (`convertToRestOps`), the meter relay (`utils/rebar`: a graced rest travels as content). ⚠️ No book on disk draws a grace before a rest — its picture is a default |

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

1. ⭐ **THE STAMP (decided).** The press arms `{ kind: 'grace'; form; side }` on the `MarkingTool`
   union — it joins the union, `MARKING_TOOL_USES_ARMED_LENGTH` answers **true** (it reads the armed
   length like the rest tool, `docs/how-it-works/marking-tools.md`), and it ghosts (`GHOST_DRAWERS` +
   `ToolGhost` row: one small note following the pointer, at `GRACE_SCALE`, slashed when the form is).
   The click is `interactions/stamps/graceStamp.ts`: **a hit-test, not a position** — it names the NOTE
   the press lands nearest (`findClosestNoteOrRest`), because a grace is attached to something that
   exists, like the articulation stamp and unlike the fan's; the pitch is the click's **y** through
   `pixelToPosition`. Clicking the same note again APPENDS to its group — that is how a group of three
   is typed. The tool stays armed (a stamp is used in runs). Written value = the ARMED duration
   (`selectedDuration` + `selectedDots`); the default a press finds there is the convention's: an
   **8th** for a single grace, and the second click on a note makes both **16ths** (Gould p. 125: *"two
   beams recommended"* for a group, G&L: two = 16ths). ⚠️ Provisional, one function
   (`graceWrittenValue(groupSize)`), ✅ his *"lets say yes"* on 2026-09-22 as a DEFAULT to run, ⛔ not a
   rule — *"after testing in the real UI things can change"*; a value set by hand with the duration keys
   is always respected.
2. ⏳ **A NOTE SELECTED when the button is pressed — OPEN, his to find by iteration.** Candidates he
   named: *transform that note into a grace* (Sibelius's `;` — the slot leaves the bar, its time is
   refilled, and the grace hangs on the note that follows); the fan's *"apply to what is selected"*
   (add a grace of the note's own pitch, MuseScore's way) was the plan's proposal and is NOT chosen.
   ⛔ Until he picks, a press with a note selected does what a press with nothing selected does: it
   arms the stamp. Nothing is built on either candidate.
3. ⏳ **A GRACE selected** — the same: open. (The plan proposed the press toggling the group's
   `slash`; `setGraceSlash` exists in the ops for whatever gesture he settles on.)

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
| the SIZE (head, flag, beam, accidental, ledger, slash) | **2/3** (D5) — ⭐ a preset table since 2026-09-22 (`graceRoom.GRACE_SIZE_RULES`, armed from the console: `__grace.size('dorico' \| … \| 0.62)`), his eye to choose | fonts 0.64–0.66; Gould 0.60–0.65; G&L 0.65; Dorico/Sibelius 0.6; MuseScore 0.7; LilyPond 0.707; Verovio 0.75 |
| `GRACE_STEM_SPACES` (head centre → tip, in the group's own spaces) | **2½ → 3.75 system-sp × k = 2.5** | Stone p. 49; ⭐ Gould's own plate (2.22–2.67, median 2.5) against her text's 2¼; ≈0.75 of a full stem, NOT `3.5 × k` |
| middle-line rule for grace stems | **OFF** | all three engines switch it off |
| ⭐ a grace on LEDGER lines below the staff | ✅ 2026-09-22, his *"yes do it"*: the STEM grows until its tip stands **1.8 sp beyond the ledger nearest the staff** (`graceRoom.GRACE_ROWS.ledgerClearance`); the slash keeps its place under the tip | Gould p. 126 — *"a sufficiently long stem for the diagonal stroke not to obscure a ledger line"*, her and/not pair measured (research §0.8, §E.2); ⚠️ the 1.8 is DERIVED from her drawings (G3 3.25 · F3 3.77 · B3 2.68 sp) — no book states a number; ⛔ no engine implements it |
| stem thickness | **unscaled** (system weight) | Gould's grace plate does not thin it (`docs/research/stem-thickness-research.md` §2.4); ⚠️ the `scale(k)` group WOULD thin it — the stem's stroke is `/k`, as the barline sign keeps the system's weight on a small staff |
| stem direction | **up** (D1's group flag) | research §0.4 |
| slash: where it runs | ⭐ **the FONT's anchors** — `graceNoteSlashSW`→`NE` on the flag (Bravura's 8th: 1.93 × 1.66 sp at full size ⇒ ≈1.3 × 1.1 at 2/3); where a face or a flag has none, **Bravura's 8th anchors as the rows**; weight **0.09 sp** | ✅ his call 2026-09-22 after a side-by-side (*"very ugly"*): the first rows, measured off Gould's plate (2.1 sp · 40° · 1.15 sp past the stem), reached far past the flag of a 2/3 note. MuseScore (flag's right edge, 40°), Verovio (0.375 left → 0.75 right, 45°) and LilyPond (a flag-stroke GLYPH, ≈0.4 → 0.55) all stay inside the flag; ⛔ never SMuFL's precomposed E560–E563 (SMuFL; Leipzig has none) |
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
  ✅ **BUILT 2026-09-22, uncommitted** — types in `types/notes.ts`; `engine/models/graceOps` (add · remove ·
  the three flags · `graceProblems` · the chain-end hand-over); `utils/graceNotes` (the copy with fresh ids);
  `findSlot`'s `graceNotes` opt-in + `attackOf`; `getNote` / `getNotePitch` / `updateNote` opt in (no new
  `ScoreModel` method); `deleteNoteOps` grace branch; `MusicEngine.isGraceNote` + the `loadJSON` report.
  Specs: `graceOps.test.ts`, `graceNotes.test.ts`, `__tests__/graceTravel.test.ts`, the travel table's.
  ⭐ 25 links broken one at a time — all 25 turn a spec red. Three rules the code needed that §1.1 did
  not spell out, ⚠️ each a default, his to change:
  1. **The voice move carries the graces only with the chord's LAST head**: one head leaving a chord leaves
     them on the chord they were played into. They move as the SAME objects (the slot moved, it was not
     copied), and a destination chord's own group wins, the rule every slot statement there follows.
  2. **A duration change across the barline hands the grace AFTER to the new END**: `spanningNoteOps`
     rebuilds the continuations from the pitch alone, so the group is taken off the old chain's end
     before the erosion and hung on the new last piece. Shortening breaks the tie and leaves the
     continuation standing, with its grace.
  3. **An INTERIOR grace** (after a note tied on, before a tied continuation): `addGrace` refuses both,
     but a file or a tie added later can hold one; a paste's tie collapse moves it to the nearest END
     of the chain, unless that end has its own.
  ⏭️ **Owed to P1, not done here**: no `engine/commands/graceCommands` yet (the press needs one —
  one `mutate` per op); facade commands that act on the SLOT (tie, duration, beam, tremolo…) do not yet
  REFUSE a grace id the way `refusesFanMember` does — they fail closed at the model, but a grace can't
  be selected until P1 registers it, so the guards come with the first way to select one.
- **P1 — ONE grace before a note, on the page.** §3 rule 1 (the STAMP: the `MarkingTool` member,
  `MARKING_TOOL_USES_ARMED_LENGTH`, the ghost row, `graceStamp`, the three buttons), §4 (`graceRoom`, the `'grace'` ink kind and its rows), §5 for the single-grace case (head,
  stem, flag, slash, ledger, accidental, the slur), the ElementRegistry registration so the arrows
  work. *End state: arm `acciacc.`, click a note at a pitch, and see a slashed small note before it at that
  pitch, spaced, the bar widened, selectable, re-pitchable.* ⭐ This is the step his eye judges the rows on.
  ✅ **BUILT AND COMMITTED 2026-09-22**, after his UI rounds. Room: `engine/layout/graceRoom`
  (`GRACE_ROWS` toMain · between · stem · ledgerClearance; `GRACE_SIZE_RULES`; `graceLayout` places AND
  reserves) + one `'grace'` box in `measureColumns.slotInk` + the `'grace'` `InkKind`. Ink:
  `engine/engrave/notes/graceGroup` (the slash, pure) + `engine/rendering/GracePass` (one `scaling(k)`
  group per group; `drawGraceStem` shared with the ghost) + `rendering/memberGroup` (the highlight's DOM
  handle, shared with the fan). Entry: the `{ kind: 'grace' }` tool · `ghosts/GraceGhost` ·
  `stamps/graceStamp` (click) · `stamps/graceTool` (press + light) · `engine/commands/graceCommands`
  (`engine.grace.addGrace`, one `mutate`) · two dev-toolbar buttons (`after` present, disabled until P5).
  Rests: `engine/models/restGraceOps` + `restToChordOps` (extracted from `ScoreModel`). Knobs:
  `__grace.size(…)` · `__grace.slash({…})` (`dev/graceConsole`); their generations join the one width/
  shape list, `layout/widthRowGenerations` (both keys used to keep a copy each). Specs: `GracePass.test.ts`
  (scene), `graceRoom` · `graceGroup` · `measureColumns` · `accidentalState` · `graceCommands` ·
  `graceStamp` · `graceTool` · `restGraceOps` · `NoteEntryCoordinator`; break-tested where a path could
  silently vanish. ⭐ **What his UI rounds CHANGED from the first build:**
  - **D3 reversed** — no slur of its own (*"the user is the responsable for enter a real slur"*); a REAL
    slur to/from a grace is stored and drawn (the grace files its anchor on the fan member's terms), but its
    shape around a small note is not right yet ⏭️.
  - **D7 reversed** — a grace BEFORE a rest; on a whole-bar rest the stamp makes a one-beat rest at the
    clicked beat; the slot taking the rest's place takes the grace (§0 D7).
  - **The slash**: the FONT's anchors on a flag (Bravura's 8th; its 8th anchors as the rows elsewhere) —
    the first rows, measured off Gould, were *"very ugly"*; a stem with NO flag gets its own position
    (centred, the 8th's angle and depth, length 1.8 grace sp — his eye between *"to little"* and *"too
    big"*, tunable); no stem, no slash. ⚠️ keyed on `NOTE_DURATION_ROWS`, ⛔ never a list of durations
    (*"in the future we will have more durations"*).
  - **Ledger lines** (Gould p. 126, his *"yes do it"*): a low grace's stem grows until its tip stands
    1.8 sp beyond the ledger nearest the staff (research §0.8, Part E).
  - **The size** is a preset table (`__grace.size`), D5's 2/3 armed.

  ⚠️ **Defaults P1 chose — each his to change:**
  1. **A grace's accidental holds** into its main note and on through the bar — the ONE walk
     (`displayedAccidentals`) visits grace-before → main → fan members → grace-after, MuseScore's order.
  2. **The pair rows** a grace meets are the ones that ran: note → grace 0.3, dot/rest → grace 0.5,
     barline → grace **1.2** (the lead-in's note-start constraint) where Gould's drawing measures 1.0.
  3. **Unfixed ink**: a grace fits into a quarter's gap without moving anything; only a tight gap widens.
  4. **The host is the nearest ordinary note or rest by x** within 45 px of the click, in the clicked bar and staff.
  5. **Nothing lit ⇒ an 8th**; a lit duration key wins. The buttons light by the ARMED tool only.
  6. **A duration key on a selected grace sets its WRITTEN value** — 🚨 found while building: handed a
     grace id, `changeNote` reshaped the host's bar (3 slots → 2); `NoteEntryCoordinator.updateNote` now
     routes a grace as it routes a fan member (`graceOps.setGraceWritten`). Pinned, break-tested.
  7. **A note that COVERS a grace's beat without starting on it drops the grace** (logged).

  ✅ **After the commit, his next rounds (2026-09-22):** an accidental pressed with the grace tool armed
  arms it FOR the grace (`EditorState.MARKING_TOOL_ENTERS_PITCH`, a total table) and the grace is spelled
  exactly as note entry spells a click (`entryAlteration`; an armed ♮ is forced) · the ghost shows the
  accidental, SNAPS to the pitch over a staff and draws its ledger lines (`ElementRegistry.staffGeometryAt`,
  handed to every tool ghost) · ⭐ DOTTED graces: the stamp passes the armed dots; `graceRoom.graceDotXs`
  (the real notes' `INK` dot rows, pushed past the flag's reach on a flagged grace — `modifierStart`'s
  `forceFlagRight`) places them for the room AND the ink; a head on a line lifts its dot.
  ⭐ **ARTICULATIONS** (his *"we should have articulation in the grace"*; Gould p. 125 *"scaled down
  proportionally"*): the model already stored them (P0 — a grace is an `Attack`) but NOTHING drew them —
  an invisible mark. Now `GracePass.drawGraceArticulations` places them by the real notes' rule through the
  fan members' stand-in (`beams/fanArticulations.placeMemberArticulations`, split out of the fan's draw),
  on the REAL staff so a mark still snaps into a space, centred on the grace's head, its step out scaled
  (`articulationPlacement.outwardScale`, opt-in, default 1), the glyph at the grace's size; registered on
  the grace's pitch so it can be clicked; `markOps.flipArticulationPlacement` flips it (auto side: below).
  With the grace tool armed, an articulation key arms FOR the next grace (the accidental's fall-through,
  `MARKING_TOOL_ENTERS_PITCH`); `EditorState.pendingArticulations` is the one reader. ⚠️ Inside the staff
  the snap dominates, so a grace's staccato lands where a normal note's would — the normal notes' rule.
  ⏭️ **Open after P1:** a real slur's shape at a grace · `X` (the stem flip — the stem-down picture and its
  mirrored slash, P6) · a grace CHORD's dots and accidentals (one column, no collision walk). The ghost previews
  the armed articulations too (the page's `placeArticulation` at the snapped pitch; a stack steps one text
  line per mark — a preview's approximation of `articulationStack`) · the slash
  on the 8th/16th has no knob (the font's) · ⏳ **a HOUSE STYLE the score's user sets** (these rows, saved
  in the file, with an options UI — one design for every engraving number, his call when). ⭐ `lint:hubs`
  re-baselined once for P0 (his call — code-shape plan, *After the plan*).
- **P2 — GROUPS.** A second click on the same note appends; two beams at the group's scale; the slash on the first stem;
  `graceWrittenValue`; the slur from the first grace. *End state: a three-note grace run.*
- **P3 — PLAYBACK.** §6, the first preset, `playbackSchedule.grace.test.ts` — checkable because the
  collector is pure. *End state: it sounds.*
- **P4 — the OTHER ways in.** ⏳ §3 rules 2–3, once he has felt the stamp and picked: what a press does
  to a selected NOTE (transform it? add to it?) and to a selected GRACE. *End state: his, after
  iteration.*
- **P5 — grace AFTER.** `graceAfter` through every seam above (right ink, the last piece of a split,
  the end of the note in playback); the third button comes alive.
- **P6 — the toggles.** The slash toggle on a selected grace (whatever gesture P4 settles on);
  `setGraceStem` / `setGraceSlur` reachable from the console until Properties has rows.

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
- **Sibelius's `;`** — turning a selected REAL note into a grace of the next one (and its inverse):
  a real feature, a candidate for §3 rule 2, ⏳ his call after P1.
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
