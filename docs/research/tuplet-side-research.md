# Tuplet side — which side the number and bracket go on, and how it is stored (2026-09-29)

Research for one question in two halves: **(A)** on which side of the notes a tuplet's number and
bracket go by default, and **(B)** how the side is STORED and what a user's flip writes — an absolute
above/below, or a relative "flipped"? Three sources, researched separately: the printed treatises on
disk, the engine sources on disk (`~/dev/engine-sources`), and the formats + product manuals online.

What it changed and decided, for the record:

- The default side became the **stem side** on 2026-09-29 (commit `7dd35366`,
  `NoteBuilder.stemMajorityTupletLocation`) — his rule, stated before this research; ⭐ the research
  backs it on all three fronts.
- `Tuplet.placement?: 'above' | 'below'` (absolute, absent = auto) is **kept** — §B.
- ⭐ **A number on the NOTEHEAD side gets a bracket on `auto`, beamed or not** (§A3 — Gould p. 199,
  Stone p. 27, G&L p. 157). His rule, later on 2026-09-29, reversing his first call (*"not a real
  problem since the user can decide"*): the rule runs only on `auto`, so the user's `always` / `never`
  still decide — `utils/musicUtils.tupletBracketed` + `NoteBuilder.tupletOnNoteheadSide`.

⛔ Distances (how far OUT the mark stands, its air, the bracket's legs) are not this document:
`docs/research/tremolo-tuplet-research.md` and `src/engine/engrave/marks/tupletPlacement.ts`.

---

## A. The side, in the books

All four treatises reached (`reference/README.md`); plates checked for Gould pp. 197–200, Ross
pp. 159–160, Stone pp. 26–29 — each plate draws what its prose says. Printed page numbers.

| case | Gould, *Behind Bars* | Ross | Stone | Gerou & Lusk |
|---|---|---|---|---|
| **1. beamed group (number only)** | p. 197: *"A tuplet indication normally goes to the **stem side** of the notes, since this is where one would expect to read the rhythm. This keeps the space on the notehead side clear for articulation and slurs."* Plate: stems up → above, down → below. p. 200: no bracket *"provided the numeral is next to the beam"* | pp. 159–160: *"Publishers and engravers **differ** as to whether the 3 should be on the head- or stem-end … Many engravers put the 3 **above the staff, regardless**"* | p. 27: *"No brackets are needed as long as the numeral is placed at the **beam side**"* | p. 156: *"the numeral is preferred on the **beam side**, centered"*; p. 157: *"remains placed with the beam, whatever the stem direction"* |
| **2. unbeamed (bracket)** | p. 197 — the same stem-side rule | p. 161: the bracket *"most times is located **above** the staff"* | p. 26: *"The numerals and brackets should be placed at the **stem-side** … so that the space at the note-heads will be free for slurs and other articulation marks"* | — |
| **3. moved to the notehead side** | p. 198: allowed *"with a passage requiring many ledger lines"*; p. 199: *"should be enclosed in a bracket"* | — | p. 27: *"brackets do become essential"* | p. 157: *"add a bracket"* |
| **4. mixed stems** | p. 198: *"often best placed **above** the stave … clear of slurs, articulation and hairpins"*; in another context *"with the majority of stems"* | — | p. 27: *"often best to let the **majority of stems** determine the position"* (also for an equal number) | — |
| **5. two voices on a staff** | p. 199: *"at the **stem end of both parts**"* | — | p. 29: *"at the stem sides of the respective parts … all numerals should be bracketed"* | p. 157: *"placed normally (beam/stem side)"* |
| **6. rests** | must be enclosed (p. 199); ⛔ no side rule | ⛔ no side rule | ⛔ no side rule | — |
| **7. vocal / all above** | p. 198: if alternating brackets distract, *"place all brackets above"*; p. 437: above, *"well away from the text"* | p. 159 (above, regardless) | pp. 42–43: *"In vocal music, all numerals and brackets should be placed above"* | — |
| **8. moving it for a collision** | p. 198: a bracket longer than a slur goes outside it; p. 199: *"Always place the bracket outside the stave"*; p. 214: nested — the whole group on the stem side, the subgroup opposite | p. 159: 3 on the side *"opposite the slur"*; p. 160: *"Be consistent"* for adjacent triplets | p. 27: slurs and articulation closer to the heads than the numeral; p. 28: nested on opposite sides | p. 70: opposite the fingering, with a bracket |

⭐ **Agree:** stem (beam) side by default; each voice at its own stem side; vocal above; the mark
outside the staff, articulation closer to the notes. **Disagree:** Ross (engravers differ, "many"
above regardless); mixed stems — Gould leans above, Stone the majority. **UNKNOWN:** a group of only
rests — no book states a side.

## A′. The auto side, in the engines (`~/dev/engine-sources`)

| engine | auto rule | tie | rests |
|---|---|---|---|
| **MuseScore** | stem majority — a user-forced stem counts ±1000, an auto one ±1 (`rendering/score/tupletlayout.cpp:213-242`) | up; in a bar with voices, voice parity | don't count |
| **LilyPond** | stem direction per note column (`lily/tuplet-bracket.cc:777-813`) | the staff edge nearer the extreme heads, UP on a tie | skipped; all rests → UP |
| **Verovio** | stem count, `ups > downs` → above (`src/tuplet.cpp:208-270`); option `--tupletNumHead` = notehead side | **below** | counted as neither; all rests → below |
| **VexFlow 5** | none — always TOP (`src/tuplet.ts:104,118`) | — | — |

Products (manuals): **Dorico** *"generally placed on the stem side of notes"*, always above on vocal
staves; **Sibelius** above unless all stems down / the implied beam forces them down (the group read
*"as if all notes were beamed together"*), vocal above by default; **MuseScore** Auto = *"closely
connected to the stem direction"*; **Finale** offers *Stem/Beam Side* as one of five placements.

## B. How the side is stored, and what a flip writes

| format / product | stored | absent / default | the flip |
|---|---|---|---|
| **MusicXML 4.0** | `<tuplet placement="above\|below">` — absolute | absent = the application decides | — |
| **MEI v5** | `@num.place` + `@bracket.place` — absolute, ⭐ **separate** for number and bracket | — | — |
| **MNX** | `placement` above / below / **auto** | auto (*"free to use their own algorithms"*) | — |
| **MuseScore** | `Tuplet::m_direction` AUTO/UP/DOWN (`dom/tuplet.h:226`) — absolute | AUTO (styled) | `X` writes the opposite of the drawn side (`flip.cpp:159-163`), toggles UP↔DOWN, ⚠️ never back to AUTO |
| **LilyPond** | `TupletBracket.direction` UP/DOWN; `TupletNumber.direction` its own (defaults to the bracket's) | unset = the callback | `\tupletNeutral` reverts to auto |
| **Dorico** | Placement: Above / Below / cross-staff | the property off | `F` toggles; switching the property off = the default again |
| **Sibelius** | UNKNOWN (manual: *"flip it to the other side"*) | rule above | `X`; whether it resets: UNKNOWN |
| **Finale** | Manual / **Stem-Beam Side / Note Side** / Above / Below (`musxdom` `Options.h:1811-1818`) | UNKNOWN | no flip documented |

⭐ **Every format, engine and product that stores a per-tuplet side stores an ABSOLUTE one.** None has
a "flipped relative to auto" flag. The only relative values are Finale's placement RULES (*Stem/Beam
Side*, *Note Side*) and Verovio's document-wide `tupletNumHead` — style modes, not a flip.

A pinned side stays put when the stems later change, everywhere it is stored (MuseScore returns before
counting stems, `tupletlayout.cpp:215-217`; Verovio's attribute wins before counting).

## C. What we do, against this

| | ours | evidence |
|---|---|---|
| default side | stem majority; tie → above; rests don't vote | ✅ books + engines + products (tie: engines differ) |
| …counted WHEN | after the beams (`rendering/marks/tupletPass`) — a beam turns every stem one way | ✅ what the books mean by the beam side; 🚨 counted before the beams until 2026-09-29 (his Syrinx bar 5: a stems-down beamed triplet drew its 3 above) — `e2e/tupletSide.e2e.ts` |
| two voices | each voice at its own stem side | ✅ Gould, Stone, G&L |
| stored model | `placement?: 'above' \| 'below'`, absent = auto | ✅ = MusicXML / MEI / MNX / MuseScore / Dorico |
| flip `x` | pins the opposite of the drawn side; a second press clears to auto | ≈ Dorico (`F` + property off); friendlier than MuseScore (never back to auto) |
| bracket on the notehead side | on `auto`: bracketed when unbeamed OR on the notehead side (opposite the stem majority; an even split has none) | ✅ Gould p. 199, Stone p. 27, G&L p. 157 — `always` / `never` stay the user's |

## D. Open — his call, ⛔ not a queue

- **The silent flip.** A pin EQUAL to the auto side (e.g. pins made under the old opposite-the-stems
  rule, as in his Syrinx bar 4) makes the next `x` clear it with no visible change. Option: `x` always
  flips what is drawn, and stores nothing when the result is the auto side.
- **Preset rows:** mixed stems / a tie (Gould above · Stone majority · Verovio below); vocal staff
  always above (Gould, Stone, Dorico, Sibelius); a passage "all above" (Gould p. 198).
- **Number side separate from the bracket's** (MEI, LilyPond) — only if an import ever needs it.
- **Stale comment:** `src/types/tuplet.ts` still says "bracket opposite the stems".
