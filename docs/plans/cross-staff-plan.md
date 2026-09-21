# Cross-staff notes — plan (2026-09-21)

**Goal.** Write Satie's *Gymnopédie No. 1*: a left-hand chord whose lowest head stays on the bass
staff while its upper heads are written on the treble staff, on ONE stem. Research — what the
programs, the engines and the books do — is `docs/research/cross-staff-research.md`.

**Scope of this plan:** a note (one head, several, or a whole chord) written on the adjacent staff,
by shortcut, **unbeamed**. That is all of the Gymnopédie. Cross-staff **beams** are Phase 4, planned
when we get there.

## Settled decisions

1. **The unit is the HEAD — a field on `NotePitch`.** `displayStaffId?: string` (a `StaffInfo` id;
   absent = the chord's own staff, which is every note today). Per-note is what MusicXML `<staff>`,
   MEI `@staff`, Verovio, Dorico and Finale do; the per-chord programs (MuseScore, Sibelius) cannot
   write the Satie bar and fake it with two voices. An id rather than a relative ±1, because
   `staffId` back-pointers already survive a staff reorder.
2. **It is CONTENT, not an engraving override.** `engravingOverrides` is authored *look* — the music
   is identical either way, in staff spaces. Which staff a head is written on is a notational
   statement (it decides the clef the head is read in, its ledger lines, and it is what the
   interchange formats carry). It holds no pixels, so `docs/DESIGN-PRINCIPLES.md` §3 is kept.
3. **The home staff + voice own everything else.** `Chord.staffId` / `voice` do not change: rhythm,
   rest fill, rebar, paste, voice counting and playback never learn the head moved. Rests do NOT
   cross (the Satie quarter rest is the existing rest-shift); Gould p. 305: no rests on the vacated
   stave.
4. **Legality: the ADJACENT staff, and for now every staff of the score is one group.** No
   `StaffGroup` is consulted and no indicator is written — so an existing score (the Prelude) needs
   nothing to be legal. ⏭️ When instruments/groups gate it later, that narrows ONE function
   (`crossStaffOps.canDisplayOn`); a score saved today stays valid as long as its crossings are inside
   what becomes a group. ⚠️ `StaffGroup` today means *a sign at the system's left edge* — it is not
   the legality scope, and this plan does not make it one.
5. **UI: the shortcut only.** `Ctrl+Shift+↑` / `Ctrl+Shift+↓` (free today; Sibelius's and
   MuseScore's keys) on the selected note(s). `Alt+↑/↓` already picks one head of a chord, so the
   Satie bar is: select D4 + F♯4, `Ctrl+Shift+↑`. Crossing back toward home past the home staff is
   refused (adjacent only); crossing a head back onto its home staff DELETES the field. No menu row,
   no Properties row, no ghost — we will see.
6. **One stem, heads on their normal side** (Gould pp. 305, 317). The stem runs from the furthest
   head on one staff to the furthest on the other; its length is whatever the staff gap makes it —
   no source gives a rule, and ours needs none: the gap is an INPUT here (`layout/staffStride` +
   `StaffSpacingOverride`), known before the note is drawn, so there is no second pass of the kind
   Verovio and MuseScore carry.
7. **A crossed head is laid out as the DESTINATION staff's ink** — its clef, its ledger lines, its
   band in `layout/measureColumns` (a box already carries its staff) — as Verovio and MuseScore do.
   The cross-staff stem is in NO staff's band: it may not widen a column or push staves apart.
8. **Accidentals follow the staff the head is written on** (what the reader sees). Sibelius keeps
   the home staff's context and then tells users to hide the redundant signs.

## Phases — one at a time, his UI check between

**Phase 1 — the model. ✅ BUILT 2026-09-21 (no pixel moves).** `NotePitch.displayStaffId`
(`types/notes.ts`) and `engine/models/crossStaffOps.ts`, its only writer: `canDisplayOn` (THE
legality gate), `crossPitch` / `crossPitches` (answer crossed / returned / refused + why),
`displayStaffIndex` + `hasCrossedHead` (what Phase 2 reads), `keepLegalCrossings`,
`crossStaffProblems`. Three invariants held there: never names HOME (coming home deletes the field);
adjacent only; 🚨 a REAL staff id — ⛔ not the slot convention where absent = the first staff.
- **It travels:** every site that rebuilds a pitch carries it — the rebar relay (`RebarPitch`,
  `rebarOps.materializeVoiceBar`), both voice moves, `insertPitch`. Break-tested: without the relay's
  line a meter change brought every head home.
- ⚠️ **Deviation — the clip carries the ABSOLUTE id, not a relative staff.** `flattenRegion` has no
  score to make it relative with, and a tuplet's slots travel as clones. So what materialises a bar
  asks `keepLegalCrossings`: a paste onto the SAME staff keeps its crossings; a paste onto another
  staff keeps them only if the named staff is still adjacent, else the head comes home. ⏭️ Relative
  travel (a bass→bass paste on a second piano keeping its crossings) is a follow-up.
- **Load:** `crossStaffProblems` is warned from `loadJSON`, nothing repaired; a bad id DRAWS at home.
- Fanned members and rests are refused. ⚠️ "Deleting a staff returns its visitors home" was planned
  and is moot: the editor has no staff deletion. Whoever builds it calls `keepLegalCrossings`.

**Phase 2 — the drawing. ✅ BUILT 2026-09-21.** A head keeps its TRUE line on the staff it is
written on and gains a **lift** — how many staff lines that staff stands above the note's own
(`engrave/notes/keyLines`: `KeyRow.lift`, `geoLine`, `KeyCrossing`). ⭐ The two are not folded into
one number because the gap between staves is not a whole count of lines (10.5 at the default), and a
dot's dodge and a ledger line are decided by the line's parity.
- **Who asks which.** `geoLine` (where the head STANDS): the key sort, each head's y, a second's
  displacement, the stem's extremes, `getLineNumber` (articulations, beams), the accidental stack.
  The TRUE line: ledger lines — asked staff by staff in `EngravedNote.drawLedgerLines` — the
  ledger/accidental clearance (own staff's heads only), the dot's dodge.
- **The per-head frame question is settled: the far-LINE route, made exact by the lift.** One frame,
  one affine, nothing new on `EngravedNote` but the struct's `crossings`. ⚠️ Its cost is the one
  predicted: EQUAL STAFF SIZES only — a head crossing onto a smaller staff lands on the right line at
  the home staff's size.
- **`rendering/crossStaff.ts`** (the renderer's half, ⛔ not in `ScoreRenderer`):
  `attachCrossStaffNeighbours` tells a bar holding a crossed head where that staff stands (`dy`) and
  its clef — once the measure's staves have their y's, so ⭐ ONE pass, as decision 6 promised;
  `crossingResolver` is what `NoteBuilder` asks per head. `MeasurePlacement.crossStaff` is a row of
  the SHAPE key (`crossStaffKey`): change the staff gap or the neighbour's clef and the bar
  re-engraves. `lane.slots` already carried the field into both keys.
- **Stem:** toward the crossed heads, and that OUTRANKS the voice default — the Satie chord is a
  second voice (stem-down by parity) reaching up. An explicit `x` flip still wins. The "past an
  octave from the middle line" extension is skipped for a split chord: the gap is already its length.
- **Proof:** `ScoreRenderer.crossStaff.test.ts` (scene) — ⭐ *the crossed D4 stands at the y of the
  treble staff's OWN D4* (so the clef is the other staff's too), one stem from the bass head past
  the top crossed head, ledger lines 2 → 0; `crossStaff.test.ts`, `keyLines.test.ts`. Unit 7202 ✓,
  e2e 306 ✓ (no pixel of an uncrossed score moved), and the bar looked at in Chromium.
- ⚠️ **Seen, not fixed (his call):** the second voice's beat-1 quarter rest stands BELOW the bass
  staff (the voice rule); Satie's engraver lifts it toward the treble — that is the existing
  rest-shift. Dots of heads on two staves are still stacked as one column by their true lines.
  The width path does not know a head crossed (`measureColumns` prices it on its home staff).

**Phase 3 — the editor. ✅ BUILT 2026-09-21 — ⏸️ awaiting his UI check.** `Ctrl+Shift+↑/↓`
(`shortcuts/ShortcutConfig`: `crossStaffUp` / `crossStaffDown`).
- ⚠️ **Deviation — not a `keys` row.** That table is the ONE `selectedElement`'s; notes are the
  multi-selection (`selectedItems`). So the action is `interactions/controllers/crossStaffKeys.ts`
  (which heads, the log, the render) over `MusicEngine.crossNotesToStaff` (the ops call + ONE
  `mutate`; ⛔ none for a press that refused every head).
- ⭐ **It registers ITSELF**: `wireShortcuts(…).register`, called from `App.ts`. `shortcutWiring` was
  at its line ceiling (431/431), and the seam is the point — the next feature's actions need no entry
  in that map either. The one line was paid for by folding the seven `addChord<Letter>` rows the way
  the tuplet presets above them already are; the ceiling FELL to 428 (`scripts/check-hubs.mjs`).
- **Hit-testing:** a note's click target is asked `pitchToPixelY(pitch, …, staff)`, and a crossed
  head was filed under its HOME staff — so its target stood on the staff it left. `ElementInfo`
  gains `headStaff` (absent = `staff`), written by `rendering/crossStaff.crossedHeadStaff`, read at
  all eight pitch→y sites (`ElementRegistry` ×6, `MouseController` ×2). `staff` stays HOME: that is
  the lane the note is edited, navigated and played in.
- ⏭️ **NOT built, and said so: decision 8** (a crossed head's accidental decided in the staff it is
  WRITTEN on). Today it is decided in its home lane — Sibelius's behaviour. `displayedAccidentals`
  walks ONE lane in order; doing this honestly means walking two staves' heads as one stream, which
  is its own step. The Gymnopédie does not need it (its F♯ is the key signature's).
- ⏭️ The width path (`measureColumns`) still prices a crossed head on its home staff (decision 7's
  second half).

**Phase 4 — beams.** Sources: Gould pp. 314–315 (scan), Stone p. 12, G&L p. 43, and the engines'
routes — research doc §4–5. The unit is a beam group whose chords are written on TWO staves (some
wholly crossed, some at home).

*Settled (each is a default, ⛔ not a blocker — CLAUDE.md's engraving-number rule):*
1. **Beam BETWEEN the staves, stems pointing inward** — a chord written on the upper staff takes a
   stem DOWN, on the lower staff UP (Gould p. 315: *"point towards the centre of the system and are
   joined by a common beam"*). It outranks the voice default, as the split chord's stem does.
2. **HORIZONTAL, always, for now** — Gould: *"If in doubt use a horizontal beam"*, and *"Horizontal
   beams… should be placed in the space between the staves"*; it is Sibelius's default too. Her
   slope rules (p. 315 a–d) are a follow-up, ⛔ not this phase.
3. **Where the line stands:** *"Position a beam so that the shortest stems in both directions are of
   equal length"* — midway between the upper chords' lowest head and the lower chords' highest —
   then moved clear of both staves where the gap allows (*"keep beams clear of the staves where
   possible… even if this results in unequal stem lengths"*).
4. **The 2½-space floor:** *"the staves must be far enough apart to give adequate length (at least
   2½ stave-spaces) to all stems"* — when the shortest stem would be shorter, the group is NOT a
   cross-staff beam: it falls back to one direction, today's beam (p. 315: *"Place stems in one
   direction when… the staves cannot be moved further apart"*). ⛔ We do not push the staves apart
   (Verovio's `RequestStaffSpace`, MuseScore's `minVertSpaceForCrossStaffBeams`) — the gap stays an
   INPUT; he widens it by hand. ⏭️ A follow-up if wanted.
5. **An explicit `x` flip on any member wins** — the whole group goes one way, which is Gould's (b),
   *"above or below the system"*.
6. ⭐ **All of it is decided in LINE units at build time** (`geoLine`, Phase 2): no y is needed, so
   the directions are known before the formatter runs — still ONE pass.

*Deferred, said so:* a SPLIT chord inside such a group (the group falls back to one direction);
a cross-staff group that also crosses a BARLINE (`CrossBarBeams` owns those; untouched); the slope;
secondary beams on alternate sides to avoid beam corners (Gould p. 316, Stone pp. 13–14).

**✅ BUILT 2026-09-21 — ⏸️ awaiting his UI check.** As planned, with these notes:
- **4a** — `NoteBuilder` now tells a SPLIT chord (stem toward the other staff) from a WHOLLY crossed
  one (the ordinary rule, against the middle line of the staff it is written on).
- **4b** — `engrave/beams/crossStaffBeam.ts`, pure, in line units; `CROSS_STAFF_BEAM` holds its two
  rows (`minStemSpaces` 2.5 — Gould; `staffClearanceSpaces` 0.5 — ⚠️ unsourced beyond *"keep beams
  clear of the staves"*).
- **4c** — `beamGroups.crossStaffPlanFor` asks it; `EngravedBeam.standOnLine` carries the answer as
  slope 0 + a `lift`, so the stem rule and the beam's ink needed no change at all. A group written
  ENTIRELY on the other staff is an ordinary beam there, its side read in that staff's clef
  (`EngravedNote.writtenClef`) — found in the first Chromium render, where it took the home clef's.
- **Proof:** `crossStaffBeam.test.ts` (the rule), `ScoreRenderer.crossStaff.test.ts` (two stems
  pointing inward, ending on one line BETWEEN the staves; the uncrossed control; an `x` flip wins),
  unit 7223 ✓, e2e 306 ✓, eighths and sixteenths looked at in Chromium.
- ⚠️ **Seen, not fixed:** the other staff's own whole-bar REST stands under notes crossed onto it
  (nothing tells that staff's rest placement it has visitors); each beat's group finds its own
  height, so neighbouring cross-staff beams of one bar stand at different levels.

*Steps:* **4a** a wholly-crossed UNBEAMED chord takes the ordinary stem rule of the staff it is
written on (Phase 2 pointed it at the other staff, which is only right for a split chord) ·
**4b** `engrave/beams/crossStaffBeam.ts` — pure: directions + the line, or null below the floor ·
**4c** `beamGroups.buildBeams` asks it; `EngravedBeam` is told the line (slope 0) and the existing
stem rule (`beamedStems`, which already lengthens a stem AGAINST its beam) does the rest · scene
test + a look in Chromium.

## Open — his call, none blocks a phase

- A slur/tie landing on a crossed head (Gould p. 308: a tie *"must connect the noteheads"*) — it
  should follow the drawn head for free if the curve reads the head's drawn position; verify in
  Phase 2, fix only if reported.
- MusicXML export does not exist yet; the field maps to `<staff>` one-to-one when it does.
- Whether a rest may cross (Sibelius allows it). Not now.
- Gardner Read is UNKNOWN (unreachable 2026-09-21) — a follow-up for the library, not for the code.
