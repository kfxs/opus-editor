# Key signatures — the research record

**Companion to `docs/key-signature-plan.md`, which is the BUILD.** This file is the evidence: five
research passes run on 2026-08-27, digested. ⛔ **Nothing here is a task.** Read the plan to know what
to build; read this to know *why a number is that number* — and before proposing a different one.

⭐ **The sources are on disk.** `reference/README.md` is the tracked manifest of the engraving library
(the books are gitignored, the manifest is not) and carries the page offsets, the routes that work
and the ones that are dead. The three engine checkouts are `~/dev/engine-sources/{MuseScore,lilypond,verovio}`
— ⛔ never `/tmp`, which has eaten them twice. The five full agent reports were written to the session
scratchpad (`gould-key-signatures.md`, `ross-gerou-stone-key-signatures.md`,
`engines-key-signatures.md`, `online-key-signatures.md`, `key-signature-ui-survey.md`); ⚠️ a
scratchpad does not survive, so **anything that mattered is quoted here.**

## What was asked, and who answered

| question | answer | where |
|---|---|---|
| staff position per letter per clef | ✅ a table, three sources agreeing | §9.4.1b |
| the tenor exception | ✅ exactly F♯ and G♯, an octave down | §9.4.1, §9.4.1b |
| an alto exception | ⛔ **there is none** | §9.4.1 |
| horizontal spacing | ✅ measured, two conventions, one outlier | §9.4.2, §9.4.2b |
| kerning the signature | 🚨 **forbidden** — Gould, in as many words | §9.2 |
| cancellation: which naturals, in what order | ✅ `outgoing − incoming`, outgoing order | §4.2 of the plan |
| cancellation: the modern default | ✅ dated 1970 → 1996, `none` wins | §4.2 of the plan |
| courtesy at a system break | ✅ universal; the two ends differ | §9.3, §9.4.3 |
| a double barline at a key change | ✅ only at a new musical SECTION | §4.2b of the plan |
| do notes transpose on apply | ✅ no (Finale asks; nobody else does) | §9.3 |
| does a key change reset in-bar accidentals | ⚠️ engines yes; **treatises silent** | §3 of the plan |
| octave-transposing clefs | ⚠️ engines: no effect; **treatises UNKNOWN** | §9.1, §9.4.1 |
| the picker's UI | ✅ surveyed — ⛔ future work | §7 of the plan |

## 9. ✅ What the three engines said (2026-08-27)

Full report: the scratchpad's `engines-key-signatures.md`, every claim carrying `path:LINE`.

### 9.1 ⭐⭐ Vertical placement — and we need no taste call

All three derive it differently and **agree exactly** on treble, bass, alto and tenor (hand-checked:
tenor sharps F♯3 C♯4 G♯3 D♯4 A♯3 E♯4 B♯3; bass flats B♭2 E♭3 A♭2 D♭3 G♭2 C♭3 F♭2 — identical in
MuseScore, LilyPond and Verovio). Their one disagreement is the **soprano/mezzo/baritone** C-clefs,
and ⭐ `Clef` has exactly four values here, so **it cannot reach us**.

| engine | how it knows |
|---|---|
| MuseScore | a literal 14-int array per clef, `ClefInfo::m_lines` — 7 sharp positions then 7 flat |
| LilyPond | a per-clef WINDOW (`sharp-positions '(4 5 4 2 3 2 3)`, `flat-positions '(2 3 4 2 1 2 1)`) — the zigzag falls out of a modulo rather than being tabulated |
| Verovio | an octave-per-pitch-name table per clef, then the ordinary pitch→line route |

✅ **Octave-transposing clefs make NO difference to a signature** in all three, each by its own
mechanism. ⭐ MuseScore's shape is the one to copy — an explicit table is a rule we can read.

### 9.2 Horizontal spacing, in staff spaces — where they disagree, we choose

| gap | MuseScore | LilyPond | Verovio |
|---|---|---|---|
| accidental → accidental | 0.3 (+ SMuFL cut-out tuck) | 0 — glyph extents only | 0.2 |
| …when the glyph CHANGES (naturals→sharps) | 0.6 | 0 | 0.2 |
| natural → natural | 0.4 | 0.15 / 0.3 if the ink bands touch | 0.3 |
| clef → key | 0.75 | 0.82 | 1.0 |
| barline → key | 0.5 | 1.0 | 1.0 |
| key → meter | 1.0 | 1.15 | 1.0 |
| key → first note | 1.75 min | 2.5 ideal, non-stretchable | 1.0 |

⚠️ **These are not strictly commensurable** (a minimum padding, a spring's ideal, a margin), which is
why the last row spans 2.5×. ⭐ Ours already has an answer for that row: `HEADER_TO_NOTE = 2.0`,
derived from LilyPond's own `space-alist` — so a key signature joins the existing rule rather than
bringing a competing number.

⭐⭐ **Only MuseScore KERNS the signature** — it tucks each accidental into the previous glyph's SMuFL
`cutOut` anchor when the pair ascends or descends.

🚨 **DECIDED: we do not kern. Gould forbids it in as many words** (printed p. 92, on flats in
ascending fourths): they *"will fit in very close to each other — **but keep the key signature evenly
spaced** … **Do not overlap the flats**"*, and her figure carries four dashed guides marking the even
grid. ⭐ So the signature is the one place in this codebase where an even PITCH beats an ink fit —
which is a rule we can state, and it is why `layout/kerning.ts` gets no row here. ⛔ Do not
reintroduce the cut-out tuck as an improvement; it is MuseScore disagreeing with the treatise, not a
refinement of it.

### 9.3 The rest, settled

| question | answer |
|---|---|
| opening furniture order | **clef → cancellation → key → meter**, three-way agreement — and a system-opening repeat barline comes AFTER them (which is Gould p. 234, already cited in `BarlineRenderer`) |
| restated each system | yes, all three; an empty key prints nothing |
| change TO C major | draws naturals in all three, **even when cancellation is otherwise off** |
| cancellation set | only what the new key drops; the WHOLE old set when the sign flips |
| naturals repeated on the new system | never |
| accidental state at a key change | reset, all three |
| notes transposed on apply | no |
| double barline | MuseScore only, layout-time, only where a courtesy prints |

## 9.4 ✅ What Gould said (printed pp. 91–94, plus 41–43 and 233–235)

⭐ **Where to look, so nobody hunts again:** `KEY SIGNATURES` is pp. 91–94 (*Placing and order* 91,
*Spacing* 92, *Key changes* 92–93, non-tonal 93–94). ⛔ **The horizontal numbers are NOT there** —
they are in *Spacing symbols*, pp. 41–43. Cautionary/warning signatures are pp. 233–235; the glyph
proportions and "same size as any accidental" are pp. 77–78.

### 9.4.1 Placement — her prose is one sentence, her FIGURE is the specification

p. 91: *"The order of accidentals follows the 'cycle of fifths'. **The arrangement is identical in
each clef except for the tenor-clef layout of sharps**."* All 56 signs of her four-clef figure were
measured (±0.12 step), and three things came out of the drawing that the prose does not say:

- ⭐ **The tenor exception is exactly TWO signs: F♯ and G♯ drop an octave** (to F♯3 / G♯3); C♯ D♯ A♯
  E♯ B♯ sit where the plain shift puts them, and tenor FLATS follow the ordinary shape. Unshifted,
  G♯ would land on a ledger line above the staff. ✅ **This is exactly what MuseScore's `C4` row
  encodes** (§9.1) — treatise and three engines agree, independently.
- ⭐ **There is NO alto-clef exception.** A♯ is drawn at A3, the plain shifted pattern. ⛔ If we ever
  find an alto A♯ special case in our code, it did not come from Gould.
- ⛔ **There is no "keep the signs inside the staff" rule** — her own bass 7-flat puts F♭2 in the
  space *below* the bottom line and the treble 7-sharp puts G♯5 above the top line. What the
  drawings obey is the weaker **"never needs a ledger line"**.
- **Octave-transposing clefs: UNKNOWN** — pp. 506–507 never mention key signatures. (The three
  engines all say "no effect", which is the answer we take, from them.)

### 9.4.1b ⭐⭐ THE TABLE, measured from Gerou & Lusk pp. 80–81 — and three sources agree

G&L print 4 clefs × 7 sharps + 7 flats with **no prose at all**; the drawing IS the specification.
Measured at 400 dpi, in **staff steps above the bottom line** (0 = bottom line, 8 = top line, 9 = the
space above it, −1 = the space below it), method calibrated against the known treble sharps:

| clef | F♯ C♯ G♯ D♯ A♯ E♯ B♯ | B♭ E♭ A♭ D♭ G♭ C♭ F♭ |
|---|---|---|
| treble | 8, 5, 9, 6, 3, 7, 4 | 4, 7, 3, 6, 2, 5, 1 |
| bass | 6, 3, 7, 4, 1, 5, 2 | 2, 5, 1, 4, 0, 3, −1 |
| alto | 7, 4, 8, 5, 2, 6, 3 | 3, 6, 2, 5, 1, 4, 0 |
| **tenor** | **2, 6, 3, 7, 4, 8, 5** | 5, 8, 4, 7, 3, 6, 2 |

⭐ **The rule underneath it**: bass = treble − 2, alto = treble − 1, tenor flats = treble + 1 — and
**tenor SHARPS are the sole exception**: treble + 1 would put G♯ at 10, needing a ledger line, so
**F♯ and G♯ alone drop an octave** (to 2 and 3) and the other five are unchanged.

✅ **This is a three-way independent agreement** — G&L's drawing measured, Gould's four-clef figure
measured (§9.4.1), and MuseScore's `ClefInfo::m_lines` array read as code (§9.1). ⛔ **So the table
is not a taste call and does not need one; write it down and move on.**

⚠️ **The no-ledger-line rule is never stated in prose by ANY of the three treatises** — it is simply
what all 56 drawn signatures satisfy. Record it as the derivation, not as a quotation.

**Ross and Stone have NOTHING on vertical placement** — both checked in full (Ross's index: *Key
changes 148–149*, *Key signature spacing 143–147*; Stone's: *key signatures, 44–45*, which is
spacing). Checked negatives, so nobody re-reads them for this.

### 9.4.2 Spacing — measured, and it agrees with Ross

| | measured |
|---|---|
| sharp → sharp advance | **1.25 sp** (glyph 1.00, gap 0.25) — identical across four clefs and four figures |
| flat → flat advance | **1.12 sp** (glyph 0.85–0.90) |
| natural → natural | **1.13 sp** |
| clef → key | **1–1¼ sp** (p. 42 figure; prose p. 41 says "1–1½" for all three gaps) |
| key → time signature | **1–1½ sp** |
| key → first note | **2½ / 1½ / 1 sp** — by how many accidentals the note itself carries |
| mid-system: barline → key | **1.00 sp** |
| mid-system: key → note | **2.05 sp** |

⭐ **So a flat signature really IS narrower** — by exactly 0.125 sp per sign — which falls out of the
glyph widths rather than needing a rule. ⭐ **Ross pp. 144–146 gives the complete numeric system and
AGREES once converted** (his 3½ sp last-accidental-to-note, minus a 1 sp glyph, is her 2½ sp gap);
he differs only on flats.

### 9.4.2b Ross's numbers — ⭐ his prose and his drawings AGREE (unlike the hairpin)

He states his origin convention outright (printed p. 143): every number is **left-of-character to
left-of-character**, and *"a sharp is measured from the vertical line on its left side"*.

| Ross states | p. | measured on his own engraving |
|---|---|---|
| clef → 1st flat / 1st sharp | 3½ | 3.40 mean / 3.35–3.63 |
| **flat → flat** | **1** | 21 steps, mean **1.005** ✅ |
| **sharp → sharp** | **1 or 1¼** | 21 steps, mean **1.24** — he engraves 1¼ |
| last accidental → time signature | 2½ | 2.51, 2.63 |
| last accidental → 1st note | 3½ | 3.45 |
| time signature → 1st note | 3½ | 3.41 |

⭐⭐ **Sharp→sharp 1.25 sp is now confirmed twice** (Gould's measured advance, Ross's stated and
engraved number) — take it. Flats sit at **1.00 (Ross) / 1.08 (G&L) / 1.12 (Gould)**; ⏳ ours is a
choice in that range, and Bravura's 0.904 advance says the low end is tight.

⭐ **Ross also says WHY sharps need more room**, which makes it a rule rather than a constant: his
INCORRECT/CORRECT pair (p. 144) measures 1.02/0.99/1.06 against 1.30/1.14/1.22 — sharps must
*"expand until the bar-ends align rather than overlap"*. **It is a property of the glyph.**

🚨🚨 **STONE COUNTS DIFFERENTLY AND MIXING THEM IS A SILENT ~1 sp BUG.** His pp. 44–45 numbers —
*"between the clef and any subsequent symbol: one staff-space or a little less; between the key
signature and the time signature: one staff-space; between any of the above and the first note …
1½ staff-spaces"* — are explicitly **GAPS (white space)**, where Ross's are **ORIGINS**. Not a
contradiction; his own footnote defers to Ross by name. ⛔ Never put a number from one table into the
other's arithmetic.

🚨 **And G&L's drawing disagrees with Ross on ONE gap**: last accidental → time signature measures
**1.40 sp against Ross's 2½/2.51** — a full stave-space, on a page that explicitly says *"Notice the
distance … from the key signature to the time signature."* ⏳ Ours to choose; Gould's 1–1½ sits with
G&L, so **Ross is the outlier and we follow the other two**.

🚨 **Her p. 42 gap labels are NOT ink-to-ink.** Her own rulers match her labels but stop 0.25–0.45 sp
short of the next glyph, so the real ink gaps run **~0.3 sp wider** than the printed numbers. ⛔ Do
not implement her numbers as ink distances without that correction — this is the same class of trap
as the thin-double barline, where her stated ¾ sp is contradicted by her own five engravings.

### 9.4.2c Three findings from Ross and G&L that touch code we already have

- ⭐⭐ **A clef and a key signature ALIGN VERTICALLY ACROSS EVERY STAFF OF THE PAGE** — Ross
  pp. 24–25: their x-positions are set by *"a guideline down the plate"*. ✅ That is what
  `MeasurePlacement.system`'s shared `headerExtent` already does (the widest header any staff draws
  wins, for all of them) — so an existing invariant is now a sourced rule rather than an
  implementation detail.
- ⭐ **A courtesy CLEF is cue size, but a courtesy KEY SIGNATURE is NORMAL size** (G&L p. 52). ⚠️ Our
  `cautionaryExtent` already draws the clef small and the meter full size — so a key signature joins
  the **meter's** branch, not the clef's.
- ⭐ **Every cross-system continuation — slur, tie, 8va, pedal, lyric extender — RESTARTS AFTER the
  key signature** (G&L pp. 87, 98, 129, 148). ⚠️ We already have four of those five renderers, and
  they take their left edge from the stave's note-start; adding a key signature moves that edge, so
  **they come along for free — but only because the room is bought in `headerInk`.** A signature
  drawn without reserving room would leave every one of them starting under the accidentals.

### 9.4.3 The rules that are one sentence each

- **Size**: a key-signature accidental is the SAME size as an ordinary one. p. 78: *"An accidental is
  scaled down in size **only** when placed before a grace note … or a cue note."* (Measured: 0.94 sp
  vs 1.00 in one figure at one scale.) ⛔ So no "small signature" variant exists.
- **A simultaneous clef and key change**: *"Place the new clef **before** the barline, the new key
  signature **after** the barline (and in the new clef)."* ⭐ Note the second half — the clef that
  positions the signature is the NEW one. ✅ **Confirmed independently by both other treatises**:
  G&L p. 52 *"The clef sign precedes the barline; the key signature and time signature follow the
  barline"*, and Ross p. 168, who adds that the end-of-staff courtesy is likewise spelled in the new
  clef. Three sources, no dissent.
- **A repeat that opens a section**: clef, key, time, **then** the `‖:` (p. 234, drawn) — the same
  order `BarlineRenderer` already cites.
- **Repetition**: *"It should appear on every stave to which it is relevant, for as long as it is
  relevant."* The C-major exception is drawn, not stated.
- **A second-time bar** takes a bracketed reminder of *clef + key + time in ONE pair of
  parentheses*, full size (p. 235). ⚠️ A **warning** signature at the end of a repeated section is
  **bare, not bracketed**, and sits inside the last bar before the `:‖`.

---

---

## 11. Evidence moved out of the plan

### Gould's drawings confirm Bravura's advance widths

⭐⭐ **And Gould's drawings CONFIRM the font**, measured at 450 dpi: her key-signature sharp is
**1.00 sp** wide against Bravura's 0.996 advance, her flat 0.85–0.90 against 0.904. (Her natural is
drawn 0.75 against Bravura's 0.672 — the one that differs, and her own prose says *"slightly less
than one stave-space"*.) So the computed row is not a leap of faith: two independent sources agree
on the glyph.

### Cancellation: the dated shift, 1970 → 1996

⭐⭐ **AND THE SHIFT IS DATED, which answers "is cancelling old-fashioned?" with evidence rather
  than taste:**
  - **Ross, 1970** (p. 149): *"At present, most engraved music employs cancellation signs."* His
    p. 148 gives the method — cancel *"on the scale degrees not common to the new signature"*,
    naturals first, then the new accidentals, each group in its own signature's order.
  - **Gerou & Lusk, 1996** (p. 79): *"**Cancellations are no longer considered necessary, unless the
    new key is C major or A minor** (no sharps or flats). In that case, cancel … in the same order as
    the old key signature."* Every other key change drawn in that book shows no naturals.

  ⭐ Twenty-six years, two American reference works, opposite defaults — and 1996's is the one the
  five modern implementations converged on. ✅ **So `none` is our default**, and `before` / `after` /
  `before-bar` exist for the older practices. ⛔ It is a settled question now; do not reopen it.

  ⭐ Ross also gives the gap the cancellation group owes: *"Many engravers leave half a space or more
  between the cancellations and the new signature"* — **measured 1.97–2.18 sp at that junction vs
  1.0 within a group, i.e. ≈1 sp extra**, the "or more" end. That is MuseScore's 1.0 exactly.

### The double barline at a key change — who generates one

Among the ENGINES, **only MuseScore generates one at all** — a style decision computed during layout
(`measurelayout.cpp:895-902`), defaulting to `DOUBLE_BEFORE_COURTESY`: a double bar appears **only
where a courtesy key signature actually prints**, i.e. at a system break, not at every mid-line
change. An end repeat overrides it. LilyPond and Verovio never do.

⚠️ **The APPS lean the other way**: Dorico inserts one by default and Sibelius does it
unconditionally; **Finale does not** (a checked negative). So the practice is real and common — but
in every case it is generated, never authored.

🚨 **DECIDED by the treatise: we do NOT auto-insert one.** Gould, printed p. 92: *"Change a key
signature after a barline. **A double barline precedes the new key signature only if the key change
coincides with a new musical section.**"* Every key change she draws uses a plain single barline
(measured 0.15 sp). ⭐ A new musical section is an AUTHORED fact that only the composer knows — so
the double bar stays the user's statement, exactly as `barline-types-plan.md` already has it, and
Sibelius's unconditional one is a guess about music it cannot see.

### The picker UI survey — what the four applications do

- ⭐⭐ **His memory of Finale is exactly right, verbatim**: *"Click the top scroll bar arrow to add
    sharps (or subtract flats)… Click the bottom arrow to add flats (or subtract sharps)"* — wording
    unchanged from the 2009 manual to v27 (the last; discontinued Aug 2024). Major/minor is an
    **orthogonal dropdown** (Major · Minor · Keyless · Nonstandard), so the redundancy never arises.
  - ⭐⭐ **And the stepper is not nostalgia — Dorico ships it, better.** Its Write-mode panel has
    More Sharps/Fewer Flats buttons and an *"Input key signature"* control that is simultaneously
    the live staff preview, the stepper's target and the commit — shipped **alongside** the
    `Shift+K` popover, not instead of it.
  - **The redundancy, quantified — four answers, not two.** Sibelius: **31 cells for 15 distinct
    pictures**, the empty signature appearing **three times** (C major / A minor / Atonal, identical
    thumbnails). Finale and Dorico factor it. MuseScore collapses to 15 cells each labelled *"G major
    / E minor"* — printing the ambiguity rather than hiding it. Dorico's popover encodes mode in
    **letter case** (`D` vs `d`).
  - ⚠️ **One caution against designing the mode away**: Avid's courseware says the major/minor bit is
    used to spell accidentals from MIDI input. The bit may be real; the **multiplication** is the
    choice.
  - ⭐ **Every app's fastest route to a key is TEXT, not its picker** (Dorico's popover, Sibelius
    Command Search, MuseScore's palette search, Finale's metatools). No app offers a graphical circle
    of fifths as an input surface, and none lets you hear a key.
  - 🚨 **Sibelius cannot author a custom signature at all — and the cause is the TYPE, not the UI**:
    its ManuScript API defines a key signature as one signed integer (−8…+7) plus a `Major` flag,
    read-only. Avid's own product manager recommended faking it by editing clef symbols. ⭐⭐ **That
    is this plan's §1 argument, proven on a shipped product**: no picker design could have rescued
    it, because the model had already decided.
