# PDF export

The **Export PDF** button (dev toolbar — it took the Lorem window's seat) writes the whole score to
a vector PDF. Nothing in the pipeline is a screenshot: the file contains paths and text, so it
scales and prints at any size.

## The pipeline

| Step | Module | What it does |
| --- | --- | --- |
| 1 | `engine/export/scoreSvg.ts` | Engraves the **whole** score afresh into its own off-screen SVG. |
| 2 | `engine/export/outlineText.ts` | Turns the music glyphs into outlines; leaves word-runs as text. |
| 3 | `engine/export/pdfExport.ts` | svg2pdf + jsPDF → a saved file. |

### 1. Why a second render

The on-screen SVG is not the score. It **culls** — only the bars in the viewport are painted
(`setCullWindow`) — and it carries the editor's marks: selection colours, the armed tool's ghost,
the caret, the gutter, the play cursor. So an export gets its own `VexFlowRenderer` on its own
container: no cull window (⇒ every bar drawn), wrapped view, nothing selected, no ghost. Zoom needs
no undoing — it is a CSS transform on the app's layer, so the SVG is always at scale 1.

⚠️ The export host is positioned off-screen but **laid out** — never `display: none`. Dynamics
stacking (`DynamicsLayout`) and tempo-mark placement (`TempoLayout`) ask the DOM for `getBBox()`
and place marks by the answer; in a `display: none` subtree every box reads 0×0.

🚨 And the host is inserted **first in the document** for the duration of the render, then moved to
the end. Some engraving reaches back for the element VexFlow just drew — `applyMixedDynamicRuns`
re-lays a dynamic's glyph run at music size that way, and the co-location row, the hand-nudged
offsets and the hit-boxes follow the same path. VexFlow finds it with `document.getElementById`,
and a dynamic's element id **is the model's id**, so while an export render is on the page two
elements answer to it. `getElementById` returns the first in tree order: a host appended at the end
loses every one of those lookups to the live score, and the export keeps the un-enlarged glyph — an
`f` two-and-a-bit times too small, with the editor showing it correctly the whole time. Holding
first place is safe because `renderScore` is synchronous; the position is given back the moment it
returns, so a live render during the export's async tail still finds the editor's own elements.

### 2. Why outline instead of embedding the font

Every glyph VexFlow draws is a `<text>` in Bravura, and VexFlow ships Bravura/Academico as base64
**woff2** installed into `document.fonts`. No PDF writer embeds woff2, and jsPDF cannot embed
OTF/CFF outlines as text even given the file. Outlining sidesteps the question entirely: the PDF
carries no font dependency at all.

`public/fonts/{Bravura,Academico}.otf` are the upstream VexFlow font files (SIL OFL 1.1, see
`OFL.txt` beside them) — the same faces the woff2s were built from, so an outlined glyph is the
shape that was on screen, not a lookalike.

**Positions come from the browser**, not from us: `getStartPositionOfChar(i)` gives each rendered
character's baseline point — after text-anchor, tspan flow and kerning — and the outline is placed
exactly there. This is why the SVG must still be attached and laid out when the outliner runs.

Three rules earn their keep:

- **SMuFL beats the stack.** Dynamics are set in `Georgia, "Times New Roman", Times, serif, Bravura`
  (`dynamicStyle.ts`). No text face carries U+E000–U+F8FF, so for a private-use character the walk
  skips the families we have no file for and reaches the music font — otherwise a `p` glyph would
  be handed to Times and print rubbish.
- **Whitespace inherits the run.** A lone non-breaking space (the engraving is full of them — a
  tempo mark's word/glyph joins are made of them) is dropped rather than becoming a `<text>` node
  containing one invisible space; a space *inside* a kept run stays, or `p sub.` becomes `psub.`.
- **Weight is a face, not an effect.** VexFlow registers Academico's bold as a real face and tempo
  marks are set in it, so `public/fonts/AcademicoBold.otf` is shipped too and the outliner picks by
  the run's weight. Outlining a bold word from the regular file silently un-bolds it.

What stays real text: runs set in a stack we have no file for — the dynamics' and tempo marks'
words — re-anchored to their measured position and drawn with a standard PDF face (Times for a
serif stack). They are selectable in the PDF. Only the music travels as outlines.

⚠️ Such a replacement `<text>` states **every** inherited property — weight, style, and above all
`stroke="none"`. `openGroup` stamps the context's current attributes onto the `<g>` it opens, so an
annotation's group carries a black 1px stroke that the original `<text>` cancelled and a silent
replacement would inherit. Stroked text is text drawn twice: the expression words came out bold.

### 3. One page, on purpose

There is no document model yet — no page size, no margins, no title block — so the export invents
none. The page **is** the engraved surface: wrapped view is already a fixed-width column of
justified systems (`LAYOUT_CONFIG.CONTAINER_WIDTH`), and the PDF is that column at 1:1, however
tall it comes out. Px → pt is 72/96.

A PDF page stops at 14400 pt (200 inches ≈ 128 systems); past that the export refuses with a plain
message rather than writing a file no viewer will open. When a page/layout model arrives, pagination
belongs to **it** — the systems' y-bands are already known from the render (`measureLayoutInfo`
line numbers + `getAllMeasureBounds`), so cutting between systems is arithmetic, not new machinery.

## Not covered yet

- **No title or composer.** `Score` carries them; nothing engraves them, so nothing exports them.
  That is new engraving, not export plumbing.
- **Linear view is not exported.** The export always renders wrapped, whatever the editor is showing.
- The PDF machinery (~730 kB) is loaded on demand by the button, not at startup.
