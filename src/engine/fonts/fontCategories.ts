/**
 * ⭐⭐ **WHICH FACE A CATEGORY TAG RESOLVES TO — VexFlow's `Metrics` font tree, as ours** (S13a of
 * `docs/vexflow-removal-map.md`).
 *
 * `new Element(tag)` began with `Metrics.getFontInfo(tag)` (`metrics.js`): walk the tag's dotted path
 * down `MetricsDefaults`, keeping the DEEPEST `fontFamily` / `fontSize` / `fontScale` / `fontWeight` /
 * `fontStyle` met on the way, and multiply size by scale. A tag of ours with no row (`'EngravedClef.walk'`)
 * therefore resolves to the ROOT face, and a VexFlow category (`'Annotation'`, `'StaveTempo.glyph'`) to
 * its row — which is why `glyphPainter` says *the tag is not a comment, it selects the font*.
 *
 * ⭐ This is that tree's FONT half, every row VexFlow ships, transcribed — so any tag resolves exactly as
 * it did, including one nobody passes today. ⛔ The non-font rows (paddings, spacings, styles) are not
 * here: nothing asks this module for them.
 *
 * ⛔ No DOM, no vexflow.
 */

/** A face as a category resolves it — `Metrics.getFontInfo`'s shape: the size is a POINT NUMBER here. */
export interface CategoryFont {
  family: string
  size: number
  weight: string
  style: string
}

interface FontNode {
  fontFamily?: string
  fontSize?: number
  fontScale?: number
  fontWeight?: string
  fontStyle?: string
  [category: string]: FontNode | string | number | undefined
}

/** `MetricsDefaults` (`metrics.js`), its font keys only, in its shape. */
const FONT_TREE: FontNode = {
  fontFamily: 'Bravura,Academico',
  fontSize: 30,
  fontScale: 1.0,
  fontWeight: 'normal',
  fontStyle: 'normal',
  Accidental: { cautionary: { fontSize: 20 }, grace: { fontSize: 20 } },
  Annotation: { fontSize: 10 },
  Bend: { fontSize: 10 },
  ChordSymbol: { fontSize: 12 },
  FretHandFinger: { fontSize: 9, fontWeight: 'bold' },
  GraceNote: { fontScale: 2 / 3 },
  GraceTabNote: { fontScale: 2 / 3 },
  PedalMarking: { text: { fontSize: 12, fontStyle: 'italic' } },
  Repetition: { text: { fontSize: 12, fontWeight: 'bold' } },
  Stave: { fontSize: 8 },
  StaveConnector: { text: { fontSize: 16 } },
  StaveLine: { fontSize: 10 },
  StaveSection: { fontSize: 10, fontWeight: 'bold' },
  StaveTempo: { fontSize: 14, glyph: { fontSize: 25 }, name: { fontWeight: 'bold' } },
  StaveText: { fontSize: 16 },
  StaveTie: { fontSize: 10 },
  StringNumber: { fontSize: 10, fontWeight: 'bold' },
  Stroke: { text: { fontSize: 10, fontStyle: 'italic', fontWeight: 'bold' } },
  TabNote: { text: { fontSize: 9 } },
  TabSlide: { fontSize: 10, fontStyle: 'italic', fontWeight: 'bold' },
  TabStave: { fontSize: 8 },
  TabTie: { fontSize: 10 },
  TextBracket: { fontSize: 15, fontStyle: 'italic' },
  TextNote: { text: { fontSize: 12 } },
  Volta: { fontSize: 9, fontWeight: 'bold' },
}

/**
 * `Metrics.get(key)`, transcribed: the value of `key`'s LAST part, from the deepest node on the path
 * that defines it. ⚠️ Kept exactly, quirk included: a path that leaves the tree stops there, keeping
 * what was found above.
 */
function lookup(key: string): string | number | undefined {
  const parts = key.split('.')
  const last = parts.pop()!
  let node: FontNode | undefined = FONT_TREE
  let found: string | number | undefined
  while (node) {
    const value = node[last]
    if (value !== undefined && value !== null && typeof value !== 'object') found = value
    const next = parts.shift()
    if (!next) break
    const child: FontNode | string | number | undefined = node[next]
    node = typeof child === 'object' ? child : undefined
  }
  return found
}

/** ⭐ The face `tag` resolves to — `Metrics.getFontInfo(tag)`, a fresh object each call. */
export function categoryFont(tag: string): CategoryFont {
  return {
    family: lookup(`${tag}.fontFamily`) as string,
    size: (lookup(`${tag}.fontSize`) as number) * (lookup(`${tag}.fontScale`) as number),
    weight: lookup(`${tag}.fontWeight`) as string,
    style: lookup(`${tag}.fontStyle`) as string,
  }
}

/** The ROOT face's family and size — `Metrics.get('fontFamily')` / `Metrics.get('fontSize')`, unscaled. */
export const ROOT_FONT_FAMILY = lookup('fontFamily') as string
export const ROOT_FONT_SIZE_PT = lookup('fontSize') as number
