# The Keypad

A picture of Sibelius's numeric keypad, as a window (`src/windows/keypad/`). Four columns of
keys plus a voice row, in the geometry of a real numpad — because **the panel and the numpad are
one instrument**: a hand that learns the mouse has learned the keys.

That sentence is the whole design. Everything below follows from taking it literally.

## Pages

The pad is multi-page (Sibelius has several layouts). Today there are two:

| id | name | what's on it |
|---|---|---|
| `noteEntry` | Note entry | durations, accidentals, articulations, tie, rest, dot |
| `beamsTremolos` | Beams/Tremolos | **fully wired** — the beam cluster (`/ * - 7 8 9`), the tremolos (`1`–`6`, `Enter`) and the feathered beams (`0`, `.`) |

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

| what | seam |
|---|---|
| tool mode (the arrow) | `interactions/modeSelection` |
| armed duration / accidental | `durationSelection` / `accidentalSelection` |
| articulations (a set) | `articulationSelection` |
| dot / tie / rest | `dotSelection` / `tieSelection` / `restSelection` |
| beam mode / subdivide / beam-rest | `beamSelection` (a set) / `subdivideSelection` / `beamOverSelection` |
| active voice | `voiceSelection` |
| **which page is showing** | `interactions/keypadPageSelection` |

The lights flow IN through `interactions/keypadSync.ts`, which recomputes them on every state change
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

## Page 2: the beam cluster is wired, the tremolos are not

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
routes to it. Their drawings are documented in `keypadLayouts.ts` (named recipes in the `TREMOLO` map,
baked to one SVG by `tremoloBake.ts`).

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
