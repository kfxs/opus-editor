# A full-bar rest for any voice — the plan

> **Status (2026-09-26): P0 + P1 + P2 built and committed — `engine/models/barRestOps` + `engine/commands/silentBarCommands` (`engine.silentBar`), the `Rest.stamped` flag, R5 in the collapse, the dev-shell button that follows the selection, copy/paste carrying it. ⛔ No ghost (his call). P3's browser check: `e2e/barRest.e2e.ts`.** His brief: the empty bar's automatic full-bar rest
> in voice 1 is right and ⛔ stays exactly as it is. On top of it, the user can say explicitly *"this
> voice is silent for this whole bar"* — typically voice 2 while voice 1 plays. A new dev-shell
> button arms a full-bar-rest stamp for the ACTIVE voice (voice 1 included); a click on a bar puts
> it there.
>
> ⚠️ **The UI is the dev shell's** (`src/dev/devToolbar.ts`), as the glissando's and the cue's were:
> ONE button, no Keypad key, no menu row until he says otherwise.

---

## 0. The decisions — all his, 2026-09-26

| # | decision | status |
|---|---|---|
| **R1** | The automatic full-bar rest (an empty bar, voice 1) is unchanged — same fill, same drawing, same behaviour | ✅ his brief |
| **R2** | The button arms a stamp for the **active voice** (`EditorState.activeVoice`, 1–4). Voice 1 works the same way | ✅ his brief |
| **R3** | A stamp is a full-bar rest: whatever that voice had in the bar is **gone** — its notes, rests and tuplets. The other voices are untouched | ✅ *"a full bar rest is a full bar rest"* |
| **R4** | ⛔ The collapse rule (`voiceOps.collapseEmptyVoices`) is **not** weakened for ordinary rests: a voice with no notes still goes away after a delete, a convert-to-rest, a clear, a re-bar or a voice move — exactly as today | ✅ his words |
| **R5** | A voice counts as **empty** when it has no notes **and no full-bar rest the user stamped**. A stamped one keeps its voice alive in that bar; an automatic one never does | ✅ *"for having a full voice 2 rest the user have to explicit mark it"* |

What follows from those, ⛔ not a question to ask him again:
- **Delete** on a stamped rest removes it, so a voice 2–4 leaves the bar (R4 then applies).
- **Typing a note over it** turns it into notes, as the voice-1 full-bar rest does today
  (`KeyboardController.ts:85`). The stamp mark goes with the rest; if those notes are later
  deleted, the voice collapses (R4).
- **A clear** over the bar replaces the voice's slots with the meter's fill (`clearOps`), so it
  removes the stamp too — the same as Delete.

---

## 1. What already exists (read 2026-09-26)

- **The data** — `Rest.isMeasureRest` has no voice restriction; `restFill.fillRests` makes one;
  `restFillOps` sets its `actualDuration` to the bar's capacity.
- **The drawing** — a bar counts as multi-voice as soon as a second voice has ANY slot, rests
  included (`ScoreRenderer.ts:1840`, `measureColumns.hasSeveralVoices`). A voice-2 measure rest
  already takes the whole-rest path (`NoteBuilder.ts:164`, `alignCenter`), is centred by
  `centerMeasureRests`, and is placed by `restVoicePlacement` (whole rest ⇒ the outer staff line,
  his V3/V1/V2/V4 lane order). ⇒ **No new engraving is expected** — P3 checks it in the browser.
- **The collapse** — ONE function, `voiceOps.collapseEmptyVoices(score, measure)`, called by
  `deleteNoteOps`, `convertToRestOps`, `clearOps`, `rebarOps`, `voiceOps`. R5 is one change there.
- **Clearing a lane** — `clearOps.clearNoteRange(score, ids, deps)` already repairs what removing
  slots owes (ties re-pointed, slurs re-anchored, glissandi pruned, the meter's fill once).
- **A tool that places on a BAR** — `stamps/keySignatureStamp.ts`: `pixelToMeasure`, one
  `engine.runBatch` = one undo, one line in `MouseController.handleClick`'s chain.
- **A dev button with its own module** — `stamps/cueTool.ts` (`pressCue(palette.spanToolHost())` +
  `cueLit`).
- **The flag tables** — `utils/slotFieldTravel.SLOT_FIELD_TRAVEL` (what a rest field does on
  paste/re-bar; `cue: 'carried'` is the precedent) and `MARKING_TOOL_USES_ARMED_LENGTH`.

---

## 2. The model — one flag

```ts
// types/notes.ts, on Rest
/** ⭐ The USER stamped this full-bar rest (voice-measure-rest-plan R5): it keeps its voice alive in
 *  the bar. Only with `isMeasureRest`; absent on every automatic fill. */
stamped?: true
```

- Mirrored on the flat `Note` (`noteProjection`), like `isMeasureRest` and `cue`.
- `SLOT_FIELD_TRAVEL.stamped = 'carried'` — a copied bar pastes the statement with it.
- ⛔ No fill, refill or repair ever SETS it (the `cue` lesson: `feedback_only_delete_clears_cue`).
  Every path that REBUILDS rests must be audited to either carry it or, where the rest is really
  replaced (Delete, clear, a note typed over it), drop it — P1's checklist.
- JSON: the field serialises as it is; no migration (`project_no_json_migration`).
- Set for voice 1 too (one rule). It changes nothing there — voice 1 never collapses — but the
  file records what the user did.

**R5 in `collapseEmptyVoices`:** a secondary voice survives when it has a chord **or a `stamped`
measure rest**. ⚠️ The function works per MEASURE, not per staff (today's behaviour, not touched
here). A stamp on one staff keeps voice N alive across the measure; that can only matter for another
staff's rest-only voice N, which the old rule would already have removed. If P1's tests find a real
case, it is reported separately, ⛔ not fixed inside this plan.

---

## 3. Phases — each stops for his check

### P0 — the score op + R5 (core, no UI) ✅ built
- ⚠️ **Named `barRest`, not `measureRest`**: `lint:hubs` reads a kind name as a WORD SEQUENCE, so a
  `measureRest` tool kind would match every `isMeasureRest` in the hubs.
- `engine/models/barRestOps.ts`: `stampBarRest(score, measure, staff, voice)` + `stampedBarRestAt`.
  Removes the lane's slots (staff + voice) and its tuplets, then pushes ONE `isMeasureRest` rest with
  `stamped: true`. It makes a clear's repairs for the whole lane, but ⛔ does not call
  `clearNoteRange`, which keeps tuplets and refills by the meter — the two things a stamp replaces:
  a tie arriving from outside is re-pointed onto the rest, a tie leaving is severed at its far end,
  slurs re-anchor, glissandi are pruned, and the lane's hand overrides are cleared. Stamping a lane
  that already holds its stamped rest returns null (no edit).
- `engine/commands/silentBarCommands.ts` → `engine.silentBar.stamp(measure, staff, voice)` (ONE undo entry)
  and `.at(…)`.
- `voiceOps.collapseEmptyVoices`: R5 (a chord **or a `stamped` slot** keeps the voice).
- `Rest.stamped` + the flat `Note.stamped` (`noteProjection`; graces/bracketed drop it). The
  `SLOT_FIELD_TRAVEL` row is **`dropped` for now** — whether it survives a re-bar or paste is P1's.
- Specs: `barRestOps.test.ts` (10), `silentBarCommands.test.ts` (9 — delete / convert / clear elsewhere
  keep it; Delete on it collapses v2; undo/redo; JSON round-trip; a note typed over it, then deleted,
  collapses — R4), `voiceOps.test.ts` (+2: automatic collapses, stamped stays).

### P1 — the rebuild audit (the flag survives what it should) ✅ built
⭐ **The rule that came out of it:** a re-bar and a paste rebuild every lane of their region from its
EVENTS, and silence is not an event — so a stamped rest was collapsed away by both. It is now
captured by the TIME it covered (`barRestOps.captureStampedSilence`) and restored onto **every new bar
lying wholly inside it** (`restoreStampedSilence`), right after `materializeRegion` (before the rest
shifts, which need it standing). A bar the silence covers only in part holds music and keeps the
ordinary fill. On paste, the paste window is cut out of the silence on the lanes the paste writes.
`SLOT_FIELD_TRAVEL.stamped = 'sideChannel'`.
🚨 Found by the audit: `ScoreModel.reconcileMeasureRests` (a meter change with `rewrite: 'none'`, its
propagation, a pickup length) dropped every plain rest — a stamped one is now kept and its length
refitted to the bar (`barRestOps.refitStampedRests`).

| path | the stamped rest… | spec |
|---|---|---|
| meter change (re-bar) | bars wholly inside the silence are stamped again, at the new length; partly covered bars get the fill | `barRestOps.rebuild` |
| meter change, barlines kept (`rewrite: 'none'`) | stays, at the new length | `silentBarCommands` |
| pickup length | stays, at the pickup length | `silentBarCommands` |
| bar inserted before it | moves with its bar | `barRestOps.rebuild` |
| paste over OTHER voices / another bar | stays | `barRestOps.rebuild` |
| paste INTO its lane (notes or only rests) | replaced | `barRestOps.rebuild` |
| Delete it | goes; voice 2–4 collapses | `silentBarCommands` |
| a note typed into its lane · the keyboard's edit-in-place | goes | `silentBarCommands` |
| clear a range covering it | goes; voice 2–4 collapses | `silentBarCommands` |
| undo / redo · JSON | round-trip | `silentBarCommands` |

Break tests: with the restore off, 4 re-bar/paste specs fail; with the paste-window cut off, the
rests-only paste spec fails.

### P2 — the button, the tool, the click ✅ built
- `EditorState`: `| { kind: 'barRest' }` in `MarkingTool`; `false` in `MARKING_TOOL_USES_ARMED_LENGTH`
  and `MARKING_TOOL_ENTERS_PITCH`; nothing to promote on a duration press (`stampPromotion`);
  `toolGhost` → null and the blue place-cursor (`scoreCursorClass`) — for good (P3).
- `stamps/barRestTool.ts`: `pressBarRest(host)` arms, a re-press disarms, another armed tool is
  replaced; `barRestLit`. Arming puts the editor in entry mode, so a Keypad voice press while it is
  armed changes the voice and ⛔ does not disarm it.
- `stamps/barRestStamp.ts`: `stampBarRestAtClick` — bar = `pixelToMeasure`, staff =
  `staffIndexAtY`, voice = `activeVoiceToModel(state.activeVoice)` read AT the click;
  `engine.silentBar.stamp(…)`. Stays armed.
- `stamps/staffClickStamps.ts` (new table): the grouping sign + the full-bar rest — the two stamps whose
  click names a staff in a bar. `MouseController` was AT its line ceiling (1029/1029), so the group
  stamp's line became the table's line: net zero lines, no new kind word in the hub.
- ⚠️ The engine namespace is **`engine.silentBar`** (`commands/silentBarCommands`), renamed from
  `engine.barRest`: once `barRest` became a tool kind, the facade's `readonly barRest` line counted as a
  kind mention and pushed `MusicEngine` over its ceiling (489/486). ⛔ Renamed, not raised.
- `devToolbar`: a **Rest:** group with one button, `full bar`. ⛔ REMOVED 2026-09-26 (his call) — the Keypad
  Grace page's `0` presses the same `pressBarRest`.
- Specs: `barRestTool`, `barRestStamp`, `staffClickStamps`.

**After his first test (2026-09-26), the press follows the selection, as every button of the strip does:**
- **BARS selected** (`measureRange`) → each bar × staff gets one in the ACTIVE voice — ONE undo entry,
  nothing armed (`engine.silentBar.stampPassage`). A single box's note half is re-gathered afterwards.
- **NOTES/RESTS selected** → each one's bar, in THAT note's own voice + staff — ONE undo entry; the new
  rests become the selection (`engine.silentBar.stampLanes`).
- **LIT** when armed, or when what is selected already is a stamped rest (every selected note, or every
  selected bar × staff in the active voice) — and ⭐ a press while lit that way turns it OFF: the rests
  are deleted through Delete's own path (`engine.deleteNotes`), so voice 2–4 collapses and voice 1 gets
  its automatic rest back.
- ⭐ **The stamp is ONE click** — then disarmed, back in selection mode (his call: *"we should stamp full
  bar just once… after stamp we just go back to select mode"*). Unlike every other stamp.
- **COPY / PASTE carry it** (moved in from Later, his report): `ClipLane.stampedSilence` — the span of
  each stamped bar wholly inside the copy window (`barRestOps.stampedSilenceInWindow`), restored in
  `pasteEventsBody` after the destination's, re-based and re-voiced like the rest shifts. An ordinary
  full-bar rest copied stays ordinary.

### P3 — the browser check (⛔ NO ghost, his call)
- ⛔ **No ghost** — his call, 2026-09-26: *"for the full bar rest the blue cursor is enough we dont need
  the ghost"*. The blue place-cursor (`scoreCursorClass`) is the tool's indicator, and `toolGhost`
  answers null for good. (The stamp is one click, and the selection press is the main door.)
- ✅ Browser check — `e2e/barRest.e2e.ts` (4 cases, his eye agreed first): v2 stamped under a v1 whole
  note (below it, centred); v1 empty + v2 stamped (two whole rests in ONE column, V1 lifted above where
  it hung alone, V2 below the middle line); his lane order (a v3 stamp above the v1 note, a v4 stamp
  below); a line-opening bar (the stamped rest in the automatic one's column, after the header).
  Break test: with the measure rest's voice shift off in `NoteBuilder`, the three placement cases fail;
  the line-opening case (an x) rightly does not. ⚠️ The harness cannot tell which voice drew a rest,
  so each case pairs the stamp with something whose place is known.

---

## 4. Later — his call, ⛔ not a queue
- A Keypad key / menu row for the stamp.
- Per-staff voice collapse (§2's ⚠️), only if a real case turns up.
