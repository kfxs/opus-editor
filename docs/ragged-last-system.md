# The last system — justified, or ragged

Every system is stretched to the page width except, by default, the **last** one, which keeps its
natural width. LilyPond calls this `ragged-last` and defaults it on; MuseScore makes it a setting;
Finale and Sibelius justify. A final system of one bar spread across the whole page reads as a
mistake rather than as music, so ragged is the default here too, with a `Justify last` toggle in the
dev shell beside Wrapped/Linear.

## 1. What it changes — one branch

`calculateMeasureWidths` finalises the last line without calling `distributeLineWidths`; every bar
keeps the `finalWidth: minWidth` it was built with — the width it asks for, which is exactly what
linear view draws.

⚠️ **Ragged means ragged-RIGHT, never ragged past the margin.** A last line whose bars already ask
for more than the page has (a stretched bar, an authored space) is still distributed — the squeeze
is what keeps the music inside the page. So the knob only ever declines to **add** space. Pass 1
over-commits only a *single* bar wider than the page, so that is the one shape this guard fires on.

## 2. Where the flag lives, and why not the score

Renderer-owned view state, inside `layoutStateKey` so flipping it invalidates the cached
casting-off; mirrored on `EditorState` for the toolbar; set through `PaletteController`. The same
path `viewMode` takes.

**Not `engravingOverrides`** — that compartment is id-keyed (*element id → adjustment*), and every
client is an authored tweak anchored to a musical element. "The last system" has no anchor, and
which bars are on it is a layout result that changes on every edit and resize.

**Not the `Score`/JSON** — principle 3 forbids page-layout state in the data model outright.

⚠️ It is therefore **session-only**, which is a stopgap and not an answer: LilyPond and MuseScore
both save this with the document. `DESIGN-PRINCIPLES.md`'s boundary case holds the question open,
along with the discriminator for sorting it when a document-level engraving object exists —
*can it vary at a point in the score?* A line break can (it belongs to its measure, like a clef
change); page size and ragged-last cannot (document-level).

## 3. ⚠️ Justification is what makes bar width a TRANSFER

**Read this before touching anything in `barWidthRoom`.** A justified line has a fixed total, so what
one bar gains its neighbours pay — that is the whole model behind the gesture: payers, tiers, the §4
inversion, pinned barlines, derived ceilings. **A ragged line has no fixed total.** A grown bar
simply makes it longer and nobody pays.

Two consequences, both reported from use rather than predicted:

- **Three existing tests broke when ragged became the default** — not from a bug, but because their
  fixtures fit on one system, and one system is the *last* system. They asserted justified-line
  behaviour on a ragged line. They now use scores long enough to have a line that is not the last.
  ⭐ **A test about justification must have more than one system in its fixture.**
- **A bar alone on a ragged last line could not be widened at all.** The ceiling read *"a bar alone
  on its system IS the line, so that is its maximum"* — sound while justified, false the moment it is
  not. A lone bar on a ragged line is a SHORT line with the rest of the page to grow into. The same
  error applied to the threshold jumps: "nobody can absorb it" does not mean growth is dead when the
  line has no fixed total.

Both limits are now gated on whether the line **actually fills the page** — measured off the drawn
picture (`Σ finalWidth`), not read from the flag, because the layout justifies a ragged last line
anyway when it over-asks. Only what is on screen tells the truth about *this* line.

> Expect more of these. Anything in the width gesture that assumes "the page total is fixed" is
> assuming justification, and the last system no longer provides it.
