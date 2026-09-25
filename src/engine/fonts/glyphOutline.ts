/**
 * ⭐⭐ **A GLYPH'S REAL OUTLINE, read from the font file we ship** — the INK, not a box.
 *
 * Why (his reports, 2026-09-25, on a glissando stopping short of a ♯): measured against the sign's BOX, and
 * then against the box less the font's cut-out corners, the space before the sign changed with the line's
 * angle. Measured against Bravura's real sharp, the reason was plain: its left side is a COMB — two
 * crossbar tips reaching out, empty space between and under them, the stem further in — and a line meets
 * a different tooth at every angle. *"Don't use bbox, use ink"*; *"no, you should not bake"*.
 *
 * So the outline comes from the same `public/fonts/*.otf` the page draws with (`./fontFiles`), parsed with
 * opentype.js as the PDF export parses it (`engine/export/exportFonts`) — once per face, at runtime, and
 * ⛔ never baked into a table. The parse is ASYNC, so {@link glyphOutline} answers null until the face has
 * arrived; the caller keeps its box for that one render, and {@link enableGlyphOutlines}' callback asks
 * for the render that uses the outline.
 *
 * ⚠️ OFF until the app turns it on: a unit test (jsdom, no server) must never fetch a font. A spec hands a
 * parsed face in with {@link installGlyphOutlineFont}.
 *
 * Output: contours of points in STAFF SPACES, SMuFL's axes (y UP, origin = the glyph's origin; 1 em = 4
 * spaces), curves flattened to 16 segments each.
 */
import type { Font } from 'opentype.js'
import { FONT_FILES, fontFileUrl } from './fontFiles'
import { activeMusicFont } from './musicFont'
import { GLYPH_CODEPOINTS, type GlyphName } from './bravuraMetrics'
import { dbg } from '@/utils/debug'

/** One closed contour: `[x, y]` points in staff spaces, y UP. */
export type GlyphContour = ReadonlyArray<readonly [number, number]>

type FaceState = Font | 'loading' | 'failed'

const faces = new Map<string, FaceState>()
const outlines = new Map<string, GlyphContour[]>()
let loaded: (() => void) | null = null
let generation = 0

/** The face every other face falls back to for a glyph it lacks — the drawing's own fallback. */
const FALLBACK_FAMILY = 'Bravura'
/** Segments per curve. */
const STEPS = 16

/**
 * ⭐ Turn loading on — `App.ts`, once. `onLoaded` runs when a face's outlines arrive (the app re-renders,
 * so the render that had to use the box is replaced by one that uses the ink).
 */
export function enableGlyphOutlines(onLoaded: () => void): void {
  loaded = onLoaded
}

/** Bumped whenever a face arrives — in `layout/widthRowGenerations`, so the render it asks for is not
 *  skipped as unchanged (`reference_only_a_stale_render_runs`). */
export function glyphOutlineGeneration(): number {
  return generation
}

/** For a SPEC: a parsed face, as if it had loaded. */
export function installGlyphOutlineFont(family: string, font: Font): void {
  faces.set(family, font)
  for (const key of [...outlines.keys()]) if (key.startsWith(`${family}|`)) outlines.delete(key)
  generation++
}

/**
 * ⭐ The glyph's outline in the ACTIVE music face (Bravura's when that face lacks it), or null when that
 * face has not arrived yet — ⛔ never a guessed shape. Asking starts the load if loading is on.
 */
export function glyphOutline(name: GlyphName): GlyphContour[] | null {
  const char = String.fromCodePoint(GLYPH_CODEPOINTS[name])
  for (const family of [activeMusicFont().family, FALLBACK_FAMILY]) {
    const face = faceOf(family)
    if (!face || face === 'loading' || face === 'failed') {
      if (family === FALLBACK_FAMILY || face === 'loading') return null
      continue
    }
    const key = `${family}|${name}`
    const cached = outlines.get(key)
    if (cached) return cached
    const glyph = face.charToGlyph(char)
    if (!glyph || glyph.index === 0) continue
    const contours = flatten(glyph.path.commands, 4 / face.unitsPerEm)
    outlines.set(key, contours)
    return contours
  }
  return null
}

function faceOf(family: string): FaceState | undefined {
  const state = faces.get(family)
  if (state !== undefined || !loaded) return state
  const file = FONT_FILES.find(row => row.role === 'music' && row.family === family)?.file
  if (!file) return undefined
  faces.set(family, 'loading')
  void Promise.all([import('opentype.js'), fetch(fontFileUrl(file))])
    .then(async ([opentype, response]) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      faces.set(family, opentype.parse(await response.arrayBuffer()))
      generation++
      dbg(`[glyphOutline] ${family} outlines ready`)
      loaded?.()
    })
    .catch(error => {
      faces.set(family, 'failed')
      dbg(`[glyphOutline] ${family} could not load (${String(error)}) — boxes stay the measure`)
    })
  return 'loading'
}

type Command = { type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }

/** opentype's commands (font units, y UP) → contours in staff spaces, curves flattened. */
function flatten(commands: readonly Command[], toSpaces: number): GlyphContour[] {
  const contours: Array<Array<[number, number]>> = []
  let current: Array<[number, number]> = []
  let x = 0, y = 0
  const push = (px: number, py: number) => current.push([px * toSpaces, py * toSpaces])
  for (const c of commands) {
    if (c.type === 'M') {
      if (current.length) contours.push(current)
      current = []
      x = c.x!; y = c.y!
      push(x, y)
    } else if (c.type === 'L') {
      x = c.x!; y = c.y!
      push(x, y)
    } else if (c.type === 'Q') {
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS, u = 1 - t
        push(u * u * x + 2 * u * t * c.x1! + t * t * c.x!, u * u * y + 2 * u * t * c.y1! + t * t * c.y!)
      }
      x = c.x!; y = c.y!
    } else if (c.type === 'C') {
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS, u = 1 - t
        push(
          u * u * u * x + 3 * u * u * t * c.x1! + 3 * u * t * t * c.x2! + t * t * t * c.x!,
          u * u * u * y + 3 * u * u * t * c.y1! + 3 * u * t * t * c.y2! + t * t * t * c.y!,
        )
      }
      x = c.x!; y = c.y!
    } else if (c.type === 'Z') {
      if (current.length) contours.push(current)
      current = []
    }
  }
  if (current.length) contours.push(current)
  return contours
}
