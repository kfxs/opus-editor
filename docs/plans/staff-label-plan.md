# Staff labels — the text before a staff, before it is an instrument (2026-09-28)

His ask: *"text before system … similar to instrument name but is not the same: we have no instrument yet but
still we need the text before staff in each system and in the future the instrument name can be a reference
to this field or viceversa … suppose I'm not working yet in a final score but in a fragment or in a sketch, so I
need an identifier text for the staves but it is not instrument yet."* Then: *"staff label is the idea"* — a
dev-toolbar button to set the label of the selected staff, and two display options for now, **every system**
or **first system only** (*"in the future this will be more customizable … not important now"*).

Research (findings only — ⛔ they do not know what is decided here):
`docs/research/staff-label-books-research.md` · `docs/research/staff-label-engines-research.md` ·
`docs/research/staff-label-industry-research.md`.

## 0. What a staff label IS — and is not

- ⭐ **A STAFF LABEL is a staff's identifier text, printed before the staff at the start of a system.** It is
  what the books already do for voices, characters, *solo*/*tutti*, players, *Primo*/*Secondo* (books §6) —
  the name is Dorico's and MEI's (`label` / `labelAbbr`).
- ⛔ **It is NOT an instrument name.** This editor edits a FRAGMENT (`instruments-plan.md` §1): a staff may
  be "Idea A" long before — or without ever — becoming a Flute. ⭐ No commercial editor can say that (every
  staff there belongs to an instrument, industry §0); MEI and LilyPond can, and so must we.
- ⛔ **It is NOT the title / composer sketch** (`score-header-sketch.md` §6: a new text does not arrive as a
  row of `scoreTextOps`).

## 1. ⭐ The label is the PRIMITIVE; the instrument name is a FALLBACK (the answer to "reference or vice versa")

The same rule `instruments-plan.md` §4 already made for SOUND (`applySound` stands alone; an instrument only
supplies a *default* sound, ⛔ never copied):

1. what the staff's own label says at that point, else
2. ⏭️ (instruments P3) the name of the instrument assigned there — DERIVED at read time, ⛔ never written
   into the label (a copy goes stale the moment the instrument changes — the `defaultTimeSignature` mirror), else
3. nothing.

⇒ A label never needs an instrument, and an instrument never overwrites a label the hand wrote. MuseScore
reached the same place from the other end (a name BUILT from the instrument, then a custom override and a
staff-level label bolted on — engines §2).

## 2. The model — positional (principle 6)

*Can it vary at a point in the score?* Yes — an instrument change relabels a staff (Gould p. 510), a sketch
staff can take a new role — ⇒ ⛔ not a field on `StaffInfo` (that would silently mean "the label at bar 1",
the `score.clef` mistake). It is a statement AT A BAR, per staff, like `Measure.clefs` / `keys`:

```ts
interface StaffLabel {
  staffId: string   // ⛔ required — a label names ONE staff (a group's label is Later, §7)
  text: string      // the full label
  short?: string    // on later systems; absent ⇒ the full text is used there
}
// Measure.staffLabels?: StaffLabel[]   — at most ONE per staff per bar
```

- **Resolved by walking back** from the bar that OPENS a system (`staffLabelAt(score, staffId, measure)`),
  bottoming out in "no label". A statement on a bar that does not open a system shows from the NEXT system
  (Gould p. 510; MusicXML `<print>`; Dorico) — the mid-system "to …" text is Later (§7).
- **No beat.** A label is a system-start fact, like the meter — so it rides its measure through rebar /
  insert / delete; ⚠️ `clearMeasureForRebar` must be told about the field (it deletes beat-anchored arrays).
- **Blank means absent** (`score-header-sketch.md` §7): writing a blank deletes that bar's statement.
- **N=1:** no key until a label is set — a plain sketch's JSON stays byte-identical.
- **Ops in the core** (principle 5): `engine/models/staffLabelOps` — set / clear at (staff, bar), the
  resolver; ⛔ not on `MusicEngine` beyond a one-line `mutate('Staff label')` delegation. Deleting a staff
  deletes its labels. The type goes in `types/score.ts` (the staves chapter).

## 3. Showing it — a document-wide LOOK setting, session-only

Which systems show a label is not about the music: it is the *engraving* branch of principle 6, the
parked boundary case (`DESIGN-PRINCIPLES.md` — `justifyLastLine`, the surface). ⇒ session-only, engine-held,
pushed to the renderer, in `layoutStateKey`, exactly as `justifyLastLine` travels.

`staffLabels: 'every' | 'first' | 'none'` — his two options plus off:

| | first system | later systems |
|---|---|---|
| `every` ⭐ default | `text` | `short` ?? `text` |
| `first` | `text` | — |
| `none` | — | — |

- ⭐ Default `every`: a sketch's identifiers should be on every system, and it is Gould's large-score rule
  (abbreviated on all subsequent pages); `first` is her small-ensemble rule (p. 507).
- `none` HIDES — ⛔ it never deletes the text (MusicXML `print-object`, Finale).
- ⏭️ His future (*"show in certain systems and not in others"*) and Dorico's Full / Abbreviated / None per
  first / subsequent system are Later (§7) — this three-value switch is where they grow from.

## 4. Engraving

⭐ Every number below is a house style's DEFAULT — a changeable ROW (CLAUDE.md rule), and ⛔ none blocks a phase.

- **Where:** in a column LEFT of the system's signs (`layout/systemStartColumn` — braces, brackets), on the
  same axis (sp leftward of the systemic barline). ⛔ Never into the page margin (that module's rule).
- **Vertical:** the text's visual middle on the staff's MIDDLE line (Gould Table 2, measured).
- **Horizontal alignment:** a row — `right` ⭐ default (Gould (b), MuseScore, Verovio) · `centred` (Gould (a),
  "most traditional", LilyPond) · `left` (Gould (c)).
- **Gap:** a row — `gould` ⭐ the labels' right edges on ONE column **2.75 sp from the systemic barline**
  (re-measured at 600 dpi: 2.7–2.8 sp, the same with or without a bracket — the bracket's room is kept free,
  1.8–2.0 sp from its outer edge; never stated) · `musescore` / `verovio` 1.0 sp from the signs · `lilypond`
  0.3 sp. When the signs reach further than the column, the label clears the outermost sign by the signs' own
  gap (0.40 sp).
- **Face:** the WORDS face (Gould p. 508: *"match the one chosen for text instructions"*) — `textFamily(style)`,
  **upright** (Table 2; LilyPond, MuseScore, Verovio all upright). **Size:** a row, in staff spaces and
  staff-scaled — no book STATES one; `gould` ⭐ ≈ 0.85 × her tempo text (measured on Table 2) · `musescore`
  10 pt ≈ 2.0 sp · `lilypond` ≈ 2.2 sp · `verovio` 2.25 sp. ⚠️ Our tempo text's size decides what Gould's ratio
  comes to — read it before choosing.
- **⭐ The INDENT is no longer one width for every system.** Today every system shares the signs' indent
  (`scoreSystemStartIndentSpaces`). With labels the FIRST system takes the widest full `text`, later systems
  the widest `short ?? text` (Gould p. 510: *"The longest abbreviation determines the size of the margin"*) —
  and under `first`, only the signs. It GROWS to fit (MuseScore, Verovio), ⛔ no fixed indent yet.
  - The later-system width is asked of EVERY bar's label in force, not of the system openings — the same
    upper bound that module already uses to stay out of the casting-off's circle.
  - Its readers must agree: `musicSurface` → `MeasureLayout`'s `availableWidth` per line, `lineLeftPx`,
    `barWidthRoom`'s `lineTotal` (the list in `systemStartColumn`'s header).
- **⚠️ The width is MEASURED text** (`painter/glyphPainter.measureTextRun`) — and `layout/` may not import
  `rendering/` (lint:boundary). ⇒ the width is measured where the renderer draws and handed to the layout as a
  number (an injected measurer); ⛔ never an estimated width. jsdom measures 0 ⇒ unit tests inject a
  measurer; the ink's place is proved in the browser suite (`e2e/`).
- **It PRINTS** — engraving, not an editing affordance: no audience gate, the PDF gets it.

## 5. The UI for now — scaffolding in the dev toolbar

In the `Staff:` group, beside `+ Above` / `+ Below` / `Small`, the same gesture (click empty space in a bar
to say which staff) and the same shape as `interactions/controllers/staffSizeToggle`:

- **`Label…`** — opens a small dialog with two fields, *label* and *short*, for the clicked bar's staff;
  writes the statement AT THE CLICKED BAR (bar 1 = the opening label; a later bar = a change). Blank = remove.
- **A display toggle** cycling `every → first → none`.
- The logic lives in its own `interactions/controllers/` module; `devToolbar` gets one-line buttons.
  🚨 `lint:hubs` counts kind names as WORDS in the hubs, strings included — `devToolbar` is one.

## 6. Phases — ⭐ one at a time, each stopped for his check

| Phase | Scope |
|---|---|
| **P0** | This document. |
| **P1** | The model: `StaffLabel`, `Measure.staffLabels`, `staffLabelOps` (set / clear / resolve), JSON round trip + import check, undo, staff delete, rebar / measure insert-delete survival. Unit tests. |
| **P2** | Drawing: the label column, the per-system indent (first vs later), measured width, the rows of §4, PDF. `every` only. Browser tests for where it lands. |
| **P3** | The dev UI (§5) + the display switch (§3). |

## 7. Later — ⛔ not a queue

Selecting the label on the score + Properties editing (a new element module + `ELEMENT_SPECS` row) · a
GROUP's label (one label centred on a brace — Gould Table 2; MEI `staffGrp`; ⛔ `StaffGroup` stays a
presentational overlay, `instruments-plan.md` §9) · the instrument fallback (§1.2, with instruments P3) ·
multi-line labels and accidentals (*"Cl. 1 / in B♭"*, Gould p. 510) · per-system show / hide (his future) and
Dorico's per-position overrides · the mid-system change text (*"to Flute"*) · a statement that ENDS a label
mid-score · the first-system indent when there are NO labels (Gould p. 486; G&L ½ inch) · rotated group labels
(CHORUS, Table 2) · the bent staff's port-map row (`bent-staff-plan.md` §5) · MusicXML / MEI mapping.
