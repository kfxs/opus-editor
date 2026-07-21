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

Two rules earn their keep:

- **SMuFL beats the stack.** Dynamics are set in `Georgia, "Times New Roman", Times, serif, Bravura`
  (`dynamicStyle.ts`). No text face carries U+E000–U+F8FF, so for a private-use character the walk
  skips the families we have no file for and reaches the music font — otherwise a `p` glyph would
  be handed to Times and print rubbish.
- **Whitespace inherits the run.** A lone non-breaking space (the engraving is full of them — a
  tempo mark's word/glyph joins are made of them) is dropped rather than becoming a `<text>` node
  containing one invisible space; a space *inside* a kept run stays, or `p sub.` becomes `psub.`.

What stays real text: runs set in a stack we have no file for — the dynamics' and tempo marks'
words — re-anchored to their measured position and drawn with a standard PDF face (Times for a
serif stack). They are selectable in the PDF. Only the music travels as outlines.

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
