/**
 * The two tables in {@link chain} — what they say about the twenty-one selectable kinds.
 *
 * These are not decorative assertions. {@link ELEMENT_HIT_ORDER} is an ARRAY whose ORDER IS THE
 * CONTENT: it decides who wins a press two glyphs both cover, and that order was argued for one pair
 * at a time (the dot before the note, the tremolo before the stem, the barline last of all). Nothing
 * in the type system pins it — a reorder compiles and quietly makes the stem unclickable on a
 * tremolo'd note. So the order is written down twice, here and there, and this file is what makes a
 * change to it deliberate.
 */
import { describe, it, expect } from 'vitest'
import { ELEMENT_HIT_ORDER, ELEMENT_SPECS } from './chain'
import type { SelectedElement } from '../state/EditorState'
import { MARK_KINDS } from '../clipboard/enclosedMarks'

/** Every kind in the union, as `SelectedElement['kind']` — the list `assertNeverElement` polices. */
const ALL_KINDS: SelectedElement['kind'][] = [
  'clef', 'timeSignature', 'keySignature', 'tempo', 'dynamic', 'tie', 'slur', 'hairpin', 'trill',
  'ottava', 'pedal', 'accidental', 'articulation', 'dot', 'tremolo', 'stem', 'barline', 'repeatStart',
  'tuplet', 'measureRange', 'scoreText', 'staffGroup',
]

describe('ELEMENT_SPECS — total over the union', () => {
  it('answers for all twenty-two kinds, and nothing else', () => {
    expect(Object.keys(ELEMENT_SPECS).sort()).toEqual([...ALL_KINDS].sort())
  })

  it('every spec agrees with the key it is filed under', () => {
    // The `kind` field is a copy of the key — this is what stops the copy drifting.
    for (const key of ALL_KINDS) expect(ELEMENT_SPECS[key].kind).toBe(key)
  })

  it('every kind says how it paints — a twenty-third cannot be added without deciding', () => {
    for (const key of ALL_KINDS) expect(typeof ELEMENT_SPECS[key].highlight).toBe('function')
  })
})

describe('ELEMENT_SPECS — the `ink` column', () => {
  it('⭐ is exactly the kinds a passage box can hold — a missing row is a mark that never lights', () => {
    // 🚨 Pinned by NAME for the `keys` column's reason below: a lost row is SILENT — the ink pass
    // skips the kind and a selected mark simply stays black.
    const painting = Object.values(ELEMENT_SPECS).filter(spec => spec.ink).map(spec => spec.kind).sort()
    expect(painting).toEqual([...MARK_KINDS].sort())
  })
})

describe('ELEMENT_SPECS — the `keys` column', () => {
  it('⭐ is exactly these kinds — the arrows answer for them through their own row', () => {
    // 🚨 Pinned by NAME because a lost row is SILENT at runtime: the dispatcher declines, the key
    // falls through to the pitch edit, and nothing throws. It happened while this column was being
    // built — an edit dropped `keys:` INSIDE a multi-line `highlight` body, where it parses as a
    // LABELLED STATEMENT: `tsc` accepts it (the lint does not — `no-unused-labels`).
    const answering = Object.values(ELEMENT_SPECS).filter(spec => spec.keys).map(spec => spec.kind).sort()
    expect(answering).toEqual(['clef', 'dynamic', 'hairpin', 'ottava', 'pedal', 'slur', 'tempo', 'tie', 'trill'])
  })

  it('⭐ …these MOVE THROUGH THE MUSIC on `Ctrl+Shift+←/→`, and these have handles for `Tab` to walk', () => {
    const having = (verb: 'reanchor' | 'cycle') =>
      Object.values(ELEMENT_SPECS).filter(spec => spec.keys?.[verb]).map(spec => spec.kind).sort()
    // Every kind that answers the arrows re-anchors too: two chords, two categories, one selection.
    expect(having('reanchor')).toEqual(['clef', 'dynamic', 'hairpin', 'ottava', 'pedal', 'slur', 'tempo', 'trill'])
    // ⛔ A point mark has no handles: only the spans and the slur do.
    expect(having('cycle')).toEqual(['hairpin', 'ottava', 'pedal', 'slur', 'trill'])
  })

  it('every row that answers has BOTH verbs — a nudge with no reset leaves ink nobody can put back', () => {
    for (const spec of Object.values(ELEMENT_SPECS)) {
      if (!spec.keys) continue
      expect(typeof spec.keys.nudge, `${spec.kind}.nudge`).toBe('function')
      expect(typeof spec.keys.reset, `${spec.kind}.reset`).toBe('function')
    }
  })
})

describe('ELEMENT_HIT_ORDER — the priority chain', () => {
  it('⭐ is exactly this order, and the order is the argument', () => {
    expect(ELEMENT_HIT_ORDER.map(e => e.kind)).toEqual([
      // 🚧 The sketched HEADER first — title and composer, one spec for both — drawn in the first
      // page's top margin, where nothing else has ink, so its position is free. It leads because it
      // is the cheapest test in the chain.
      'scoreText',
      // ⭐ The GROUPING SIGN — free rather than load-bearing, like the header above it: it is drawn
      // OUTSIDE the staves, in the indent it reserved for itself, where no staff, bar, note or mark
      // has ink. Nothing competes for those pixels.
      'staffGroup',
      // ⭐⭐ The big header glyphs — and the KEY comes first of the three, which is load-bearing: its
      // box is the signs' own INK, while the clef's and the meter's are padded tier-1 REGIONS that
      // overlap it (measured at bar 1: clef 20→65, meter 65→95, signature 60→82). His report,
      // 2026-08-28: every press on the sharps was answering `timeSignature`.
      'keySignature', 'clef', 'timeSignature',
      // Then the marks above and below the staff, each guarded against stealing a note press.
      'tempo', 'dynamic',
      // Then the curves, then the sub-elements hanging off a notehead.
      // The hairpin sits with the slur: both are spanners hit by proximity to their own ink, and
      // where they overlap the thinner, closer-to-the-notes ARC wins.
      // The trill follows the hairpin: both are registered bands, but a trill's is ABOVE the staff
      // where a wedge's is below, so in practice they never both cover a press.
      // ⭐ The ottava follows the trill, and that pair is the only one here whose overlap is
      // GUARANTEED rather than incidental: an 8va is drawn directly above the `tr` it clears, so
      // their bands are stacked. The inner one wins — the rule the slur already sets against both.
      // ⭐ The pedal follows the ottava, and its position is nearly free: the pedal is drawn BELOW
      // the staff and an 8va above it, so only an 8vb can contend — where the inner mark wins, as
      // everywhere in this run. What matters more is that it claims only its two GLYPH boxes.
      'tie', 'slur', 'hairpin', 'trill', 'ottava', 'pedal', 'accidental', 'articulation',
      // Dots after the other sub-elements: they sit right beside the head.
      'dot',
      // The tremolo immediately before the stem it is drawn ON, so it wins only inside its own ink.
      'tremolo', 'stem',
      // ⭐⭐ The OPEN REPEAT before the barline: a press resolves to the SIGN it landed on. A lone
      // `|:` REPLACES the previous bar's plain line, so a press on it must not answer "barline" on
      // one stroke and "repeat" on the next (his report, 2026-08-26). Its box is its own ink right of
      // the boundary; the barline keeps everything left of it.
      // The barline last: its pad reaches into the bar's last column.
      'repeatStart', 'barline',
    ])
  })

  it('the two PRE-STEP kinds are deliberately absent from it', () => {
    // A tuplet bracket press and a Ctrl+Shift measure box run BEFORE the selection is cleared —
    // they are gestures, not glyphs in the chain. They are still in ELEMENT_SPECS, for the paint.
    const inChain = ELEMENT_HIT_ORDER.map(e => e.kind)
    expect(inChain).not.toContain('tuplet')
    expect(inChain).not.toContain('measureRange')
    expect(ELEMENT_SPECS.tuplet.hit).toBeUndefined()
    expect(ELEMENT_SPECS.measureRange.hit).toBeUndefined()
  })

  it('every entry is the same object the specs table holds — one source per kind', () => {
    for (const entry of ELEMENT_HIT_ORDER) expect(ELEMENT_SPECS[entry.kind]).toBe(entry)
  })

  it('and every other kind has a hit-test', () => {
    const inChain = new Set(ELEMENT_HIT_ORDER.map(e => e.kind))
    for (const key of ALL_KINDS) {
      if (key === 'tuplet' || key === 'measureRange') continue
      expect(inChain.has(key), `${key} is in the chain`).toBe(true)
      expect(typeof ELEMENT_SPECS[key].hit).toBe('function')
    }
  })
})
