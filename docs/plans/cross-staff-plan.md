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

**Phase 2 — the drawing.** Each head's y comes from ITS display staff: the key's LINE is asked of
the display staff's clef at that beat (`engrave/notes/keyLines`), its y of that staff's PLACED frame
(the ink stands outside the home bar's group — the S4e pattern in `rendering/staff/staveFrame`).
Stem tip/base then follow from `getYs` as they do today. Ledger lines per display staff
(`engrave/notes/ledgerLines`). Stem direction when `auto`: toward the crossed heads (the only
direction one stem can join them). Head displacement for seconds: only among heads on the SAME
staff (Verovio `chord.cpp:160`). ⚠️ To decide while building, not before: whether `EngravedNote`
holds a per-head frame, or the crossed head is expressed as a far LINE of the home frame — the
second is smaller but breaks when the two staves differ in SIZE. Redraw keys: a chord with a
crossed head depends on the staff gap, so the gap joins its bar's shape key
(`rendering/MeasureRedrawKey`). Proof: a scene test (head y's on two frames, one stem) + an e2e
geometry check.

**Phase 3 — the editor.** Two rows in `shortcuts/ShortcutConfig.ts`; the action in the note's
`keys` module (⛔ not a closure in `shortcutWiring`), one `runBatch` for a multi-selection, one undo
entry. Hit-testing and highlight: the crossed head must be pressable and paint selected where it is
DRAWN (`ElementRegistry` records it from the drawn box — verify, do not assume). Pitch arrows on a
crossed head keep working (the pitch is the pitch; only the line is read in another clef).
Accidental context per decision 8 (`models/entryAlteration` + the renderer's accidental state).
Kerning/columns per decision 7.

**Phase 4 — beams (NOT planned here).** Gould pp. 314–315: beam between the staves, stems inward,
shortest stems equal, horizontal when in doubt, ≥ 2½ spaces of stem or all stems one way. The engines'
routes are in the research doc §4. Its own plan when Phase 3 is signed off.

## Open — his call, none blocks a phase

- A slur/tie landing on a crossed head (Gould p. 308: a tie *"must connect the noteheads"*) — it
  should follow the drawn head for free if the curve reads the head's drawn position; verify in
  Phase 2, fix only if reported.
- MusicXML export does not exist yet; the field maps to `<staff>` one-to-one when it does.
- Whether a rest may cross (Sibelius allows it). Not now.
- Gardner Read is UNKNOWN (unreachable 2026-09-21) — a follow-up for the library, not for the code.
