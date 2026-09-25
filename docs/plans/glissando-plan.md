# The glissando — one line for gliss, portamento, bend and the slide into a note: the plan

> **Status (2026-09-25): P0 built (not committed) — `engine/models/glissandoOps` + hooks; P1 next.** His brief: a tool that behaves like Sibelius 6's bend
> line, but richer — ONE line that can be a gliss or a bend, with no text by default and a Properties
> switch that shows it later. The research is three files, read before touching this:
> `docs/research/glissando-books-research.md` (Gould · Ross · Stone · Gerou & Lusk, plates measured),
> `docs/research/glissando-engines-research.md` (MuseScore · Verovio · LilyPond, from source),
> `docs/research/glissando-industry-research.md` (MusicXML · MEI · SMuFL · Sibelius · Dorico · Finale).
>
> ⚠️ **The UI is the dev shell's** (`src/dev/devToolbar.ts`), his call: ONE button, no Lines-window
> row and no Keypad key yet. The Keypad Grace page's `.` (`gliss`, `docs/research/sibelius-keypad.md`
> §3b) stays a picture until he says otherwise.
>
> ⚠️ **Not a span mark.** The `spanMarkModel` family (pedal · ottava · trill) is a horizontal line on a
> rung of the ladder. A glissando is a SLANTED line from head to head — nearer a TIE
> (`span-mark-family-plan-2026-08-24.md`: *"a note-to-note line has more in common with a tie"*).
> ⛔ Do not widen `SpanMarkKind` for it.

---

## 0. The decisions

| # | decision | status | proposed | why |
|---|---|---|---|---|
| **G1** | **ONE kind for gliss, portamento and bend** | ✅ 2026-09-25 (his brief) | one `Glissando`; the word (`gliss.` / `port.` / `bend` / free text) is a TEXT field, never a second kind | books: gliss and portamento are *"the same line, a different word"* (Gould p. 140, Stone p. 296); a bend is a line after the head (Gould p. 248, Stone p. 187). ⚠️ Every APP splits note→note from one-note marks (industry §7.1) — Sibelius 6's plain line is the exception he named |
| **G2** | **ONE anchor note, always** | ✅ 2026-09-25 | `noteId`: a head (`NotePitch` id), as a slur's / trill's ends are | his call: *"the beginning anchor … in properties the position"*. Keeps a trill's re-bar / paste / delete machinery (there is no glissando without a note) |
| **G3** | **a SIDE: after (default) or before** | ✅ 2026-09-25 (his call; the switch is Properties, a later phase) | `side?: 'before'` — absent = after | his: *"the solution … from nothing to a note is the same as the parenthesis before or after"* — the bracketed grace's B5. **after** = leaves the note (to a note, or to nothing: fall/doit/bend); **before** = comes INTO the note from nothing (scoop/lift/plop/slide-in). ✅ MuseScore's `ChordLine.isToTheLeft`, Dorico's In/Out, Ross p. 210 (*before-head = into, after-head = out of*) |
| **G4** | **the END is DERIVED, not stored** | ✅ 2026-09-25 (his problem statement) | absent `end` = **follow the NEXT note** in the anchor's lane (staff + voice), found every render. A rest / empty slot there ⇒ drawn as a free end; a note typed there later ⇒ the next render connects it | his: *"the end slot can be empty and later fill with a note and the gliss should be able to know this"*. Also: no end id to repair after a re-bar or a delete. ✅ MuseScore guesses the end from the next chord; Dorico/Sibelius *"to the next note in the same voice"* |
| **G5** | **a free end ON PURPOSE** | ⏳ proposed (Properties, later) | `end?: 'none'` — a fall / doit / bend that must NOT snap onto the note that follows | a fall followed by a note is the common case. ⛔ With `side: 'before'` the end is always free, and the field is refused (one statement, one spelling — the trill's `extension: 'none'` rule) |
| **G6** | **a PINNED target** (another staff, skipping notes) | ⏸️ 2026-09-25, his: *"can wait … to the future"* | later: `endNoteId?` — only on the after side, and it makes the end a stored anchor (re-bar capture/restore then owed, as a slur's) | — |
| **G7** | **CROSSING A SYSTEM BREAK is in the first version** | ✅ 2026-09-25 (*"this is important"*) | two pieces, the target not restated; which slope — **G7a** | Gould pp. 141–142; engines split into segments |
| **G7a** | **the two pieces' SLOPE** | ✅ 2026-09-25 (*"gould is our preset for the moment, after seen the render in the page we can change things"*) | **Gould (default preset): EACH piece spans the whole interval** (the slopes differ); a row `continuous` = one slope cut in two (MuseScore, LilyPond) | 🚨 the sources SPLIT: Gould draws one line cut in two as her WRONG example (books §6.8, measured); MuseScore/LilyPond keep one slope; Verovio halves the angle |
| **G8** | **text OFF by default** | ✅ 2026-09-25 (his brief) | no word drawn until Properties turns it on; P-later adds `text?: string` (absent = none) | ⚠️ every app defaults to AUTO (industry §7.3); Gould wants the word at least the first time; Stone says the line suffices. His call stands |
| **G9** | **per HEAD: a chord gets one line per head** | ⏳ proposed | the button makes one `Glissando` per selected head (each its own anchor); a chord selected whole ⇒ one per head. Target head = **same index from the bottom** of the next chord; surplus heads go to its TOP head | all four books (one line per note, one word); MuseScore + LilyPond pair by index; MuseScore's surplus rule |
| **G10** | **straight by default; wavy a style row** | ⏳ proposed | `style?: 'wavy'` (absent = straight), later, with Properties. Wavy = SMuFL `wiggleGlissando` U+EAAF, tessellated `floor(l / advance)`, centred | Gould recommends straight; Ross's first form is wavy; ⚠️ Gould's own wave is UNSHADED (p. 147) where the trill's is shaded — a separate row from the trill's wiggle |
| **G11** | **the free end's SHAPE** | ⏳ proposed | model stores only its MEANING: `direction?: 'up'` (absent = down: a fall after, a scoop from below before). Its drawn vector is a ROW (MuseScore's ChordLine 1.2 × 1 sp; Ross short ≈ 1–1.5 sp, long ≈ 3 sp) + a hand-nudge in `engravingOverrides` (the slur's endpoint offset, in sp) | nobody stores a pitch for a free end (*"indeterminate"*, industry); MuseScore stores `lengthX/Y` in the model, but a length in sp is PRESENTATION here (DESIGN-PRINCIPLES §3). A PITCH AMOUNT for playback (LilyPond's `delta-step`) is a later field, if playback asks for it |
| **G12** | **where the line meets a head** | ✅ 2026-09-25 (Gould preset, his eye on the render may change it) | **Gould (default preset)**: start **0.2–0.5 sp** after the source head (past its ledger line and dots), end **0.2–0.5 sp** before the target head; each end biased **toward the other note** up to 0.5 sp (steeper than centre-to-centre). A target ACCIDENTAL: stop short of its left edge (≈0.7 sp). All rows; `centres` (the engines: head centre, gap 0.25 / 0.5) is the alternative row | books §6.4–5 (Gould p. 141, measured); engines §6.4 |
| **G13** | **thickness = a staff line's** | ⏳ proposed | the row reads `staffLineThickness` (Gould measured 0.11–0.12 sp); MuseScore/Verovio 0.15 is the alternative row | books §6.3; engines §6.4; SMuFL defines none |
| **G14** | **playback** | ⏳ proposed: none in the first version | P-later: MuseScore's menu (chromatic default · white keys · black keys · diatonic · portamento), built as extra ATTACKS like `audio/trillAttacks` — ⛔ never a MIDI pitch-bend field on the schedule (`project_pitch_not_midi_in_playback`) | engines §6.6 |
| **G15** | **jazz articulations** (fall, doit, plop, scoop, lift, spill, rip, smear, flip) | ❓ **HIS CALL, later** | leaning: the free-end cases ARE this tool (G3 + G11 cover fall/doit/scoop/plop/lift as lines); the small SIGNS (smear, flip) and SMuFL's brass glyphs are not | Ross p. 210 is the only table; no book decides; every app files them as articulations |
| **G16** | **the finishing pitch in brackets** | ⏳ proposed, later | "the next note" includes the anchor's own AFTER-side bracketed grace — Gould's *"not separately articulated"* finishing pitch (p. 144, Stone p. 63) lands on it | `bracketed-grace-plan.md` B5 already names the gliss end as an after-side use |

---

## 0.1 Every number is a NAMED-RULE table — Gould armed, the others beside her

⭐ His words, 2026-09-25: *"gould is our preset default (but we need other values like in the other
projects)"*. So each engraving rule is a table of NAMED, SOURCED rows in the shape of
`layout/dotGap.DOT_GAP_RULES` + `ACTIVE_DOT_GAP_RULE` — ⛔ never one constant. `gould` is ARMED; the
others are there to switch to from a dev console (`__gliss`, as `__dots` arms the dot tables), and
become the preset menu later.

| table | `gould` (ARMED) | the other rows |
|---|---|---|
| `GLISSANDO_END_RULES` — where the line meets a head (G12) | gap 0.2–0.5 sp after / before the heads, each end biased toward the other note up to 0.5 sp, past ledger + dots; stop ≈0.7 sp before a target accidental | `musescore` head centre, 0.25 sp off the chord ink, same-line ±0.25 sp tilt · `lilypond` head centre, 0.5 sp along the line · `verovio` head centre, 0.5 sp along the line |
| `GLISSANDO_THICKNESS_RULES` (G13) | a staff line's weight (measured 0.11–0.12 sp) | `musescore` 0.15 · `verovio` 0.15 · `lilypond` ≈0.10 |
| `GLISSANDO_BREAK_RULES` — the pieces' slope (G7a) | `wholeInterval`: each piece spans the whole interval | `musescore` / `lilypond` `continuous`: one slope cut in two · `verovio` `halfAngle` |
| `GLISSANDO_FREE_END_RULES` (G11, P3) | ⚠️ Gould gives no size — her row is the nearest measured plate, or ⏳ Ross's `short` until one is measured | `musescore` 1.2 × 1 sp, ⅓ sp off the head · `rossShort` ≈1–1.5 sp · `rossLong` ≈3 sp |
| later: text (size, raise, drop-when-short), wavy (glyph, rounding), minimum length | from the research's rows when the phase arrives | |

Exact numbers are taken from the research files' measured values when the row is written; a range
above (0.2–0.5) is written as the plate's measured value, with the range in the row's `source`.

## 1. The model: `types/marks.ts`

```ts
/**
 * A GLISSANDO — one line for gliss, portamento, bend and the slide into a note (docs/plans/glissando-plan.md).
 * Top-level (`score.glissandi`) beside {@link Trill}, for the trill's reason: anchored to a NOTE and
 * free to cross barlines and systems.
 */
export interface Glissando {
  id: string
  /** The anchor head (a `NotePitch` id). ⛔ Never a rest. */
  noteId: string
  /** Absent = AFTER: the line leaves the note. 'before' = it comes INTO the note from nothing. */
  side?: 'before'
  /** Absent = follow the NEXT note of the lane, derived every render (G4). 'none' = a free end on purpose (G5). */
  end?: 'none'
  /** A free end's direction (G11); absent = down. Read only when the end is free. */
  direction?: 'up'
}
// Score: glissandi?: Glissando[]
```

- ⭐ **No `voice`, no `staffId`.** With ONE anchor they are the anchor's, always — a stored copy could
  only go stale (a trill and a slur carry `voice` because their TWO ends may disagree; `voiceOps` has
  to resync it). The lane is asked of the anchor's slot.
- **P0 needs only `id`, `noteId`.** `side`, `end`, `direction` arrive with the phase that
  first reads them (P3) — ⛔ no field the renderer ignores.
- **Absent, never `undefined`-valued** (the `laneFingerprint` rule).
- **JSON**: reported, never repaired — an anchor that names no head, `end` with `side: 'before'`.

## 2. Where the code goes (`CLAUDE.md`: a new feature adds a MODULE)

| module | what it answers |
|---|---|
| `engine/models/glissandoOps.ts` | add / remove / get; refuses a rest and a duplicate on the same head; `glissandoTarget(score, g)` — ⭐ THE ONE answer to *"where does it go?"*: the next slot of the lane (across barlines), a rest ⇒ null, a chord ⇒ the paired head (G9). ⚠️ A pure score question, ⛔ not the renderer's |
| `engine/models/rebarOps.ts` | capture/restore the ANCHOR only, on the trill's terms (`captureTrills`' shape). The end needs nothing — it is derived (G4) |
| `deleteNoteOps` / `convertToRestOps` / `clearOps` / the grace↔note conversions / `removeMeasure` | ⭐ `pruneGlissandi(score)` — ONE sweep: a glissando whose anchor is no longer a live head goes (with its overrides). Called at the end of each op that can remove a head, as `repairDanglingTrills` is after a rebar. ⚠️ A trill is NOT pruned when its note is deleted today (the renderer skips it and the JSON keeps it) — recorded, not fixed here |
| `interactions/clipboard/attachedMarks.ts` | a copied anchor carries its glissando (the trill's row) |
| `engine/commands/glissandoCommands.ts` | the ops call + ONE `mutate('Glissando')`. Facade: one line, `engine.glissando` |
| `engine/engrave/marks/glissandoLine.ts` | ⭐ pure geometry: two head boxes (+ the target's accidental) → the two end points (G12 rows), the thickness row, the system-break pieces (G7a rows). jsdom-testable arithmetic |
| `engine/rendering/marks/lines/GlissandoRenderer.ts` | reads `noteRuler` for each head (as `TieRenderer.headOf`), asks `glissandoLine`, draws through `pass.context` (so the SCENE sees it — geometry becomes a unit test, `ScoreRenderer.recordScene`) |
| `interactions/elements/glissando.ts` | hit-test (a thin slanted band), highlight, a row in `ELEMENT_SPECS` + `ELEMENT_HIT_ORDER`; `SelectedElement` gains `{ kind: 'glissando', id }`; Delete's case in `shortcutWiring.deleteSelected` |
| `interactions/stamps/glissandoTool.ts` | `pressGlissando` / `glissandoLit`: selected heads ⇒ make one per head; nothing selected ⇒ nothing (an armed click-stamp is later). `devToolbar` gets ONE `toggle(…)` row, as `enclosureTool` is wired (`devToolbar.ts:252`) |

🚨 **Known trap — `lint:hubs`.** `ScoreRenderer` calls `renderTies` / `renderSlurs` directly
(`ScoreRenderer.ts:3907`), and a `renderGlissandi` call beside them adds the new kind word to a hub
whose count may only fall. The parenthesised note met the same wall and was called from inside an
existing pass. ⏳ P1 decides the seam (a neutral "note-line passes" list, or the tie pass's
neighbour) — ⛔ never a raised ceiling.

## 3. Phases — one at a time, each stops for his check on the page

| phase | what | he sees |
|---|---|---|
| **P0** ✅ built | the type + `glissandoOps` (add / remove / `glissandoTarget` incl. chord pairing, a rest ⇒ null, across a barline) + specs. Re-bar (both sites) re-finds the anchor; delete / convert-to-rest / clear / note→bracketed / removed measure prune it (`pruneGlissandi`; `removeMeasure` now calls ONE `danglingAnchors.repairDanglingAnchors`). ⚠️ NOT in P0: **paste carrying a glissando** (the clipboard's `attachedMarks` / `clip.ts` rows — P0b, before P1 if he wants copies to keep it); **a JSON load check** — no note-anchored mark has one today (slurs and trills neither), so it is not invented here; an anchor lost to an edit that is none of the above (e.g. typing over it) is skipped by the renderer, the trill's belt | nothing (green specs) |
| **P1** | `glissandoLine` + `GlissandoRenderer` for note → note ON ONE SYSTEM; straight, Gould's gaps and bias (G12), thickness (G13), a target accidental; chords per head (G9). The dev button (`gliss`) | select a note, press `gliss`: a line to the next note; type into an empty next slot and it connects |
| **P2** | the SYSTEM BREAK (G7): two pieces, header-clearing start on the new system, G7a's rows | a gliss whose target opens the next system |
| **P3** | the free end: next slot a rest ⇒ a free end (G11's default vector). `side: 'before'`, `end: 'none'`, `direction` — reachable from the dev console / JSON until Properties exists | a gliss before a rest; a fall; a scoop |
| **P4** | selection + Delete + highlight (`interactions/elements/glissando`) | click the line, Delete |
| **later** | ⛔ a decision list, ⛔ not a queue: Properties (side · end · direction · text on/content · style wavy · text along/level) · end-handle drag + offsets (the slur's `SlurEndpointOffsetOverride` shape) · playback (G14) · pinned target / other staff (G6) · arrow cap (Gould p. 143/340) · curved contour (Gould p. 146, 358) · jazz (G15) · the bracketed finishing pitch (G16) · text repeated on a continuation piece (Dorico repeats it; the trill's `continuationLabel` shape) · minimum length as a spacing request (MuseScore 1.2 / 2.0 sp) · MusicXML mapping (engines §6.8) | — |

⚠️ P3 may move before P2 if he wants the free end sooner — neither depends on the other.

## 4. Open for him

1. **G15** — are the jazz falls/doits/scoops this tool (leaning yes, as free ends), or separate signs?

✅ G7a and G12: **Gould is the preset for now** (his call, 2026-09-25) — the render on the page decides
whether anything changes.
