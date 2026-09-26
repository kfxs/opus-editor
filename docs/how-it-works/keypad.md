# The Keypad

A picture of Sibelius's numeric keypad, as a window (`src/windows/keypad/`). Four columns of
keys plus a voice row, in the geometry of a real numpad — because **the panel and the numpad are
one instrument**: a hand that learns the mouse has learned the keys.

That sentence is the whole design. Everything below follows from taking it literally.

## Pages

The pad is multi-page (Sibelius has several layouts). Today there are three:

| id | name | what's on it |
|---|---|---|
| `noteEntry` | Note entry | durations, accidentals, articulations, tie, rest, dot |
| `grace` | Grace | Sibelius's second layout, drawn. ⭐ **Three keys wired** (2026-09-23) — `/` appoggiatura, `*` acciaccatura, `-` bracketed grace — the dev toolbar's grace buttons exactly: a press goes through `bus.grace` to `interactions/controllers/keypadGraceWiring`, which calls the SAME `pressGraceTool` / `pressBracketedTool` (arm the stamp, or act on the selection) and lights the keys from the SAME `graceToolLit` / `bracketedToolLit`. ⭐ **`1` wired** (2026-09-26) — the parenthesised note, the dev toolbar's `paren.` exactly, through the same seam (`pressEnclosure` / `enclosureLit`): selected notes toggle their brackets, nothing selected arms the stamp, note entry arms them for the next notes. ⭐ **`2` / `3` wired** (same day) — the double and triple dot, the dev toolbar's `..` / `...` exactly (`pressDots` / `dotsLit` with 2 and 3; the counts are a radio). The wiring is handed `palette.dotKeyHost()` for them. ⭐ **`0` wired** (same day) — the full-bar rest, the toolbar's `full bar` exactly (`pressBarRest` / `barRestLit`: selected bars or notes get one, a lit press deletes it, nothing selected arms a one-click stamp). ⭐ **`.` wired** (same day) — the glissando, the toolbar's `gliss` exactly (`pressGlissando` / `glissandoLit`: selected notes each start one — a toggle — nothing selected arms the stamp). ⭐ **`Enter` wired** (same day) — cue size, the toolbar's `cue` exactly (`pressCue` / `cueLit`: selected notes toggle, note entry arms cue for the next notes, nothing selected starts the cue stamp). The other six are still `momentary` (a picture: no light, a press that does nothing) |
| `beamsTremolos` | Beams/Tremolos | **fully wired** — the beam cluster (`/ * - 7 8 9`), the tremolos (`1`–`6`, `Enter`) and the feathered beams (`0`, `.`) |

⭐ **What Sibelius's own panel does — key by key, quoted from its Reference — is
`docs/research/sibelius-keypad.md`.** Read it before deciding what one of our keys should DO: the
Grace page is a picture of Sibelius's second layout, and only its three grace keys, its `1` (the parenthesised note) its `2` / `3` (double / triple dot) its `0` (the full-bar rest) its `.` (the glissando) and its `Enter` (cue size) are wired yet.

`+` turns the page, from the panel or the pad. Every page carries the same two controls in fixed
spots — the select arrow (top-left) and the page-turn `+` — injected by `withControls`, so a new
page lists only its own 15 keys and can neither forget the arrow nor misplace the `+`.

**A page is referenced by `id`, never by index.** Insert a page between two others and a stored
index silently points at a different layout, and the old number stays perfectly valid — a name
either resolves or throws (`keypadPage()` does throw). `KeypadPageId` is *derived* from the `PAGES`
literal, so adding a page widens the union for free and nothing can name a page that doesn't exist.
Order still exists — `nextKeypadPageId()` is the `+` step — and that is the only thing entitled to
care about sequence.

Names follow Sibelius 6's own where ours match a layout of theirs; `noteEntry` is our own, because
that page puts three kinds of key on one pad and isn't any single Sibelius layout.

## Where the state lives

Nothing on this panel is the panel's. Every light comes from an editor seam, so it cannot show you
a state the score doesn't have:

Every seam below is a field on the one `bus` object (`src/bus/index.ts`) — the panel imports
`bus` and nothing else. Each store keeps its own module and its own doc comment; only the exports
collapsed (docs/history/refactor-plan-2026-07-27.md 3b).

| what | seam |
|---|---|
| tool mode (the arrow) | `bus.mode` |
| armed duration / accidental | `bus.duration` / `bus.accidental` |
| articulations (a set) | `bus.articulation` |
| dot / tie / rest | `bus.dot` / `bus.tie` / `bus.rest` |
| beam mode / subdivide / beam-rest | `bus.beam` (a set) / `bus.subdivide` / `bus.beamOver` |
| tremolo / two-note tremolo / fan | `bus.tremolo` / `bus.tremoloPair` / `bus.fan` |
| active voice | `bus.voice` |
| **which page is showing** | `windows/keypad/keypadPageSelection` |

⛔ The page store is the one that is NOT on the bus, deliberately: its value is a `KeypadPageId`,
vocabulary owned by `keypadLayouts`, so putting it there would make the bus depend upward on
`windows/` — the single thing that directory exists to prevent. It sits beside the layouts instead.

The lights flow IN through `interactions/controllers/keypadSync.ts`, which recomputes them on every state change
and pushes them to the seams. Presses flow OUT through the same seams to `PaletteController` — the
same methods the dev toolbar's buttons call.

The page belongs on a seam for the same reason as the rest: **the numpad keys work with the panel
shut**. A page held privately in `KeypadWidget` would be invisible to the keyboard and forgotten
every time the window closed. The widget subscribes and re-lays its grid, like it already did for
duration and voice.

Two ways to change it: `+` steps the ring (`keypadPageSelection.next`, the ONE place page ORDER is
used), and a shortcut can jump straight to a NAMED page — `Ctrl+Numpad1` turns to note entry
(`keypadNoteEntryPage`). A jump names the page, never an index, so inserting a page cannot silently
re-point the key.

🚨 **The top-row `Ctrl+1` is the browser's own tab-switch, and a page cannot `preventDefault` it** —
the same wall the tempo menu and the text editor hit, which is why they route through the numeric
keypad. So the shortcut is bound to the NUMPAD's `1` and to nothing else, by `code`: a MODIFIED
shortcut is looked up by `key` first (which is what keeps `Ctrl+ArrowUp` off the pad) and by `code`
only as a FALLBACK, which is the one way to name a pad key on its own — and the way it survives
NumLock, since with the lock off that key reports `key: 'End'`. (An unmodified key checks `code`
first, which is what routes bare `Numpad4` to a quarter note.) Worth knowing before binding any
other `Ctrl`+digit: our `Ctrl+2`…`Ctrl+9` tuplet presets sit behind the same wall.

## How a key press gets in

Both ways of pressing a key end in the same function, `keypadPress.pressKeypadCell(cell)`:

```
click on a cell ─┐
                 ├─→ pressKeypadCell(cell) ─→ a seam ─→ PaletteController ─→ the score
numpad key ──────┘                                             │
   │                                                           ↓
   │  ShortcutConfig: all 16 pad keys → one `keypadKey` action    keypadSync pushes
   │  shortcutWiring: keypadCellForCode(currentPage, event.code)  the lights back
   └──────────────────────────────────────────────────────────┘
```

`ShortcutConfig` used to spell out `Numpad4 → setDurationQuarter` and twelve more like it — a second
copy of the note-entry page's layout, pinned to that page forever. Press `4` on Beams/Tremolos and
it still set a quarter note under a tremolo picture. Now the config says only *which codes belong to
the pad*, and the layout answers what they mean.

Details worth knowing:

- Bound by `KeyboardEvent.code`, which is what tells the pad from the main row — both report
  `key: '4'`. Main-row `.` keeps its own `toggleDot` binding; the pad's `.` is a Keypad key.
- The 16 entries are **generated** from `NUMPAD_CODE_TO_KEY`. A hand-written list is a list you can
  leave a key off — `.` was, once, and the dot key stopped working on every page.
  `shortcuts/keypadShortcuts.test.ts` guards it.
- `ActionHandler` receives the `KeyboardEvent` so this one handler can serve 16 keys; every other
  handler owns a single key and ignores it.
- A code the pad doesn't define returns `false`, which *declines* the key rather than swallowing it.
- `NumLock` is deliberately unbound — it's the OS's key — so the select arrow stays mouse-only.

## The Beams/Tremolos page: the beam cluster

The top-left cluster (`/ * - 7 8 9`) drives the beam palette — the SAME `PaletteController` methods the
dev toolbar's Beam row calls, which is the point: the beam palette is going away, and the keypad is
where it lands. The mapping (Sibelius 6's own): `*` single, `7` begin, `8` continue, `9` end, `/`
subdivide, `-` beam-rest. Their pictures are kept; only the `select` changed. Three seams back them,
each by how its state is known — `beamSelection` is a **set** (`PaletteToggleSet`), because a note's
authored beam and the role it engraves are independent and light up to two keys at once, exactly as the
toolbar row does; `subdivideSelection` and `beamOverSelection` are on/off singles. All three are
engine-read, so `PaletteController.refresh*` pushes them (on every state change *and* after each toggle,
since none is a reactive field).

The MARK cluster is wired the same way, and each key presses its own value: the six single-note
tremolos (`1`–`5` strokes, `6` the Penderecki sign) through `tremoloSelection`, the two-note pair
(`Enter`) through `tremoloPairSelection` — a SECOND AXIS, so it lights *beside* the lit count rather
than instead of it — and the two FEATHERED BEAMS (`0` accel., `.` rit.) through `fanSelection`. All
three are engine-read: `PaletteController.refresh*Selection` pushes the light, and the rules
(`tremoloHighlight`, `tremoloPairHighlight`, `fanHighlight`) are shared with the dev toolbar's rows, so
a press from the pad, the numpad or the toolbar is one action lighting one set of keys.

The fan pair is a RADIO, like the tremolo counts: a note carries one fan, so pressing the lit direction
takes it off and pressing the other turns it round. `pressFan` owned both rules already — the pad only
routes to it. Their drawings are documented in `keypadLayouts.ts` (named recipes in the `TREMOLO` map).

⭐ **Every page's STACKED drawings are drawn from BAKED OUTLINES** (2026-09-20; the Grace page joined
them 2026-09-23). Each drawing is a hand-stacked
recipe of music-font glyphs — `g(glyph, size, dy, dx)`, against a 26-unit key — and until then it was put
on the key as SVG *text*, which the browser lays out: a browser ZOOM re-rounds that layout and the strokes
slid against their note. Now `npm run bake:keypad` (`e2e/keypadIcons.bake.ts`, its own Playwright config)
measures each drawing in a real browser at 100% zoom, turns the glyphs into outlines with opentype.js from
the same `public/fonts/Bravura.otf`, PROVES the outlines sit on the text drawing (it refuses to write
otherwise — measured 0.03–0.66% of the ink differing, all anti-aliasing), and writes
`windows/keypad/keypadBakedIcons.ts`. The outlines are filed under the RECIPE they came from, so tuning a
number makes that key fall back to the live text form at once; re-bake when it looks right.
`keypadBakedIcons.test.ts` is red in between.

⚠️ **`KEYPAD_BAKE_RECIPES` is what the bake can SEE, and it is the whole pad's table** — it was the
tremolos' alone until the Grace page was drawn. A stacked drawing left out of it is never baked and
draws as live text for ever, silently: nothing fails, the picture is simply the zoom-fragile one.

⚠️ **A layer may be TURNED** — `GlyphSpec.rotate`, degrees clockwise about the box's centre, where
every layer is anchored (the cue-size key's stroke uses it). THREE places have to agree about a
placement or the picture changes the moment it is baked: the live spans (`KeypadWidget`), the svg
text form (`tremoloBake.bakeGlyphStack`) and the outline baker (`e2e/keypadIcons.bake.ts`, which turns
the path about the same centre BEFORE sliding it).

🚨 **And the recipe KEY is load-bearing.** `bakeRecipeKey` is what matches a drawing to its baked
outlines, so a layer that is not turned must key exactly as it did before `rotate` existed. Widening
the key for every layer missed every outline already baked and dropped the whole panel back to the
live text form — visible only as a drawing that had moved (his report, 2026-09-23). `tremoloBake.rotate.test.ts`
pins it.

🚨 **An outline has no HINTING**, and at key size that shows (his two reports the same day, with screenshots
at 90 / 100 / 110%): a beam bar is ~3½ px tall with a 2 px gap to the next, so anti-aliased edges that miss
the pixel grid fill the gap with grey and two bars read as one — the text form never showed it because the
font rasteriser snaps such edges. So `tremoloBake.bakedPathsSvg` draws the drawing as TWO paths by kind of
edge: glyphs made only of horizontal and vertical edges (`isAxisAligned` — the bars, a bare stem) are
`shape-rendering: crispEdges`, snapped to whole pixels at every zoom; everything curved or slanted stays
smooth (a snapped notehead is a staircase). Each kind is ONE merged path, because glyphs filled one by one
blend their overlapping edges twice and show a seam. ⚠️ "Thick enough" is part of the test (≥ 2 units): a
bare stem is ~0.6 px at key size, and snapped it becomes a solid 1 px line that reads heavier than the grey
hairline stems the NOTE glyphs carry beside it.

⭐ **Where a beam ends is MEASURED, not eyeballed** (Bravura.otf, in the 26-unit box): a quarter @22 placed at
`dx` has its stem's OUTER edge at `13 + dx + 3.65`; a bar @30 placed at `dx` spans `13 + dx ∓ 5.13`. The last
bar ends ~½ unit PAST that stem edge on purpose — the bar is snapped and the stem is a hairline, so a bar
ending exactly ON the edge rounds short at some zooms and leaves the stem standing outside the beam.

⚠️ **What is still NOT solved, and why** (measured): at 90% zoom one of two identical bars is 2 px where its
neighbour is 3 (3 / 3 at 100% and 110%). `crispEdges` rounds each EDGE on its own, and at a non-round zoom
nothing lands on the grid — the browser does the same to CSS borders. Sibelius's keypad looks perfect because
its pictures are BITMAPS drawn by hand for one size. The only full fix for a vector is to do the pixel
fitting ourselves at paint time (a canvas sized by `ResizeObserver`'s `device-pixel-content-box`, one rounded
thickness / gap / stem width for the whole page) — proposed, and ⛔ deliberately NOT built:

⭐⭐ **His direction, 2026-09-20: these hand-stacked drawings "always was a momentary solution" — in the end
the keypad gets DEDICATED GLYPHS.** So nothing more is invested in the stacking. What carries over is the
renderer: a key is drawn from a table of path data (`keypadBakedIcons`), and a dedicated glyph is path data
too — or, better, a small keypad ICON FONT, which is the one route where the font rasteriser does the pixel
fitting at every zoom. 💡 Also his, for later: a dev-shell tool to drag a recipe's glyphs and read the numbers
off, rather than tuning them in code. 🚨 Three opentype.js traps the bake found, all now handled in
`engine/export/glyphOutline.ts` (the ONE place a path becomes SVG data, so the PDF export gets them
too): `toPathData`'s default optimiser DROPS A CORNER of a contour the font leaves unclosed
(Bravura's bare stem came out a wedge); the options form flips the picture unless `flipY: false`; and
its rounding is string arithmetic, so a coordinate whose fraction is below ~1e-6 becomes the literal
text `NaN` and the browser draws NOTHING AT ALL. A measured position carries exactly that float32
noise — 11.3 comes back as 11.300000190734863 — which is how the dot key came out invisible
(2026-09-23). Every coordinate is rounded to the places we print before `toPathData` sees it.

⚠️ **A key that lights from the SCORE needs its own `onHighlight` subscription in `KeypadWidget`.** The
mark cluster had none: pressing a tremolo on the selected note changes the score and no other seam, so
every other store short-circuited on "no change" and the pad never repainted — the key you just pressed
stayed dark until something else moved. Adding a wired key means adding its subscription *and* releasing
it in `destroy`.

(The old `keypadProbe` — a temporary light that lit any pressed `momentary` cell so you could see the
page-aware routing work — is gone now that the cluster lights from real editor state.)

## Adding to the pad

**A new page**: add `{ id, name, own }` to `PAGES` with exactly 15 cells (`withControls` throws
otherwise, so a miscounted page fails loud at load instead of sliding every key one seat over). It
gets the arrow, the `+`, and the numpad routing for free.

**Wiring a key**: give the cell a `select` kind and the model value it carries, then handle that kind
in `pressKeypadCell` and in `KeypadWidget.isLit`. Pick the seam by how its state is known — a
reactive `EditorState` field mirrors in through `keypadSync.sync()`; something engine-derived
(articulations, tie, rest) needs a `PaletteController.refresh*` push, because there is no field to
watch.
