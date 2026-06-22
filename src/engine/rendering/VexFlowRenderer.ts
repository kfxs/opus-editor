import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Articulation, Annotation, Modifier, Beam, StaveTie, Dot, Barline, ClefNote, Tuplet as VexFlowTuplet, TextDynamics, Curve } from 'vexflow'
// Engine-owned notation styles (cursor ghosts, selection highlight). Imported here
// so they travel with the renderer — no UI-framework wiring required. See notation.css.
import './notation.css'
import type { Score, Measure, NoteDuration, Clef, ArticulationType, Tuplet, ChordRest, Chord, Fraction, PitchStep, PitchAlter, GhostNote, TimeSignature, Dynamic, DynamicLevel } from '@/types/music'
import { fracToNumber, fracEq, fracCompare, fracLte, fracGte, fracIsZero, fracCreate, fracAdd } from '@/utils/fraction'
import { measureOpeningClef, measureEndingClef, effectiveClefAt, effectiveClefBefore, middleLineDiatonicPos } from '@/utils/clefUtils'
import { beatToFrac, measureCapacityFrac } from '@/utils/musicUtils'
import { durationToVexflow, durationToFraction } from '@/utils/durations'
import { getMeterInfo, type MeterInfo } from '@/utils/meter'
import { fillRests, pickVoiceMode, type RestSlot } from '@/utils/restFill'
import { computeBeamGroups } from '@/utils/beaming'
import { slurNestDepths } from '@/utils/slurs'
import { ElementRegistry, type TupletGeometry, type ClefSegment, type ElementInfo } from '@/engine/ElementRegistry'
import { spellingToMidi, spellingToVexflowKey, spellingDiatonicPos } from '@/utils/pitchSpelling'
// Dynamics styling constants live in ./dynamicStyle so the in-canvas text editor can
// font-match the engraving from the same source of truth (see docs/text-editing-plan.md §3).
import { DYNAMIC_GLYPH_SIZE, DYNAMIC_TEXT_SIZE, DYNAMIC_TEXT_FONT } from './dynamicStyle'
import type { RenderPass } from './RenderPass'

/**
 * Articulation render order — from note outward (first = closest to note head).
 * Staccato always hugs the note, tenuto sits next, accent is outermost.
 * This applies whether the group is above or below the staff.
 * To change the order in the future, edit this array.
 */
const ARTICULATION_RENDER_ORDER: ArticulationType[] = ['staccato', 'tenuto', 'accent']

/**
 * Per-letter SMuFL codepoints for dynamics (`p`/`m`/`f`/`s`/`z`/`r`), reused from
 * VexFlow's TextDynamics. `Glyphs.*` (with precomposed `dynamicMP`/`dynamicMF`)
 * isn't exported by the package, so a level like `mp` is rendered by concatenating
 * its letters' glyphs. This generalizes for free to future ppp…fff / sf / sfz.
 */
const DYNAMIC_LETTER_GLYPHS = TextDynamics.GLYPHS as Record<string, string | undefined>

/** Map a dynamic level (e.g. 'mf') to its SMuFL glyph string. */
function levelToGlyphString(level: DynamicLevel): string {
  return [...level].map(ch => DYNAMIC_LETTER_GLYPHS[ch] ?? ch).join('')
}

/**
 * Layout configuration for proportional measure spacing
 */
export const LAYOUT_CONFIG = {
  /** Minimum pixels between notes for clickability */
  MIN_NOTE_SPACING: 18,
  /** Minimum measure width even for empty measures */
  MIN_MEASURE_WIDTH: 100,
  /** Maximum measure width to prevent one measure dominating */
  MAX_MEASURE_WIDTH: 400,
  /** Space for clef symbol on first measure of line */
  CLEF_WIDTH: 45,
  /** Space for a mid-line clef change (smaller than a line-start clef) */
  CLEF_CHANGE_WIDTH: 30,
  /** Space for time signature */
  TIME_SIG_WIDTH: 30,
  /** Padding before/after barlines */
  BARLINE_PADDING: 10,
  /** Default container width */
  CONTAINER_WIDTH: 1000,
  /** Margin around the score */
  MARGIN: 20,
  /** Stave height */
  STAVE_HEIGHT: 120,
  /** Vertical spacing between lines */
  VERTICAL_SPACING: 30,
}

/**
 * Fixed height of the score *viewport* (the window you scroll inside), sized to ≈ two staff
 * lines so the JSON panel below stays visible. Derived from LAYOUT_CONFIG so it tracks the
 * per-line content height (STAVE_HEIGHT + VERTICAL_SPACING) + the score's top/bottom margins,
 * rather than being a magic 340. See docs/navigation-viewport-plan.md §2.
 */
export const VIEWPORT_TWO_LINE_HEIGHT =
  2 * (LAYOUT_CONFIG.STAVE_HEIGHT + LAYOUT_CONFIG.VERTICAL_SPACING) + LAYOUT_CONFIG.MARGIN * 2

/**
 * Width calculation result for a measure
 */
export interface MeasureWidthInfo {
  measureNumber: number
  minWidth: number
  finalWidth: number
  lineNumber: number
  /** Cautionary clef drawn at this measure's end when the next line opens with a
   *  different clef (last measure of a line only). */
  cautionaryEndClef?: Clef
  /** Cautionary (courtesy) time signature drawn at this measure's end when the next
   *  line opens with a meter change (last measure of a line only). Drawn FULL size
   *  (unlike the cautionary clef), per standard engraving — it sits after the final
   *  barline of the line. */
  cautionaryEndTimeSig?: TimeSignature
}

/**
 * Bounds information for a rendered measure
 */
export interface MeasureBounds {
  /** X position where the measure starts */
  measureX: number
  /** Y position of the measure */
  measureY: number
  /** Total width of the measure */
  measureWidth: number
  /** X position where notes can start (after clef/time sig) */
  noteStartX: number
  /** X position where notes must end */
  noteEndX: number
}

/**
 * VexFlow wrapper service for rendering musical notation
 * This service abstracts VexFlow complexity and provides a clean API
 */
export class VexFlowRenderer {
  private renderer: Renderer | null = null
  private context: any = null
  private readonly svgContainer: HTMLElement
  /** Stored bounds for each rendered measure (keyed by measure number) */
  private measureBounds: Map<number, MeasureBounds> = new Map()
  /** Registry tracking all rendered elements and their positions */
  private elementRegistry: ElementRegistry = new ElementRegistry()
  /** Map of note IDs to their rendered StaveNotes (for tie rendering) */
  private staveNoteMap: Map<string, { staveNote: StaveNote; noteIndex: number }> = new Map()
  /** Map of tuplet IDs to their rendered VexFlow Tuplet objects (for scoped highlight) */
  private tupletObjectMap: Map<string, VexFlowTuplet> = new Map()
  /** Map of dynamic IDs to their rendered VexFlow Annotation objects (for scoped highlight) */
  private dynamicObjectMap: Map<string, Annotation> = new Map()
  /** Map of slur IDs to their rendered SVG group (`<g class="vf-slur">`) for scoped highlight */
  private slurGroupMap: Map<string, SVGGElement> = new Map()
  /** Dynamic currently being edited in the in-canvas text overlay — skipped while
   *  rendering so the engraved glyph doesn't show doubled under the editor. */
  private suppressedDynamicId: string | null = null
  /** Map of measure numbers to their layout info (including line number) */
  private measureLayoutInfo: Map<number, MeasureWidthInfo> = new Map()
  /** Snapshot of the layout captured when frozen. While non-null, renderScore
   *  reuses it instead of recomputing line breaks/widths — used during a clef
   *  drag to stop the score reflowing. Survives clear() (kept off measureLayoutInfo). */
  private frozenLayout: Map<number, MeasureWidthInfo> | null = null
  /** The clef currently being dragged (or null). Used to keep a dragged clef that
   *  sits in a redundant position visible during the drag (it would otherwise be
   *  hidden at beat 0), instead of disappearing under the cursor. */
  private draggingClef: { measure: number; beat: Fraction } | null = null

  constructor(containerElement: HTMLElement) {
    this.svgContainer = containerElement
  }

  /**
   * Get the element registry (contains positions of all rendered elements)
   */
  getElementRegistry(): ElementRegistry {
    return this.elementRegistry
  }

  /**
   * Get the bounds for a specific measure (after rendering)
   */
  getMeasureBounds(measureNumber: number): MeasureBounds | undefined {
    return this.measureBounds.get(measureNumber)
  }

  /**
   * Get all measure bounds
   */
  getAllMeasureBounds(): Map<number, MeasureBounds> {
    return this.measureBounds
  }

  /**
   * Bundle this render's per-render state into a {@link RenderPass}. The pass carries
   * **references** to the instance-field maps (not copies), so the sub-renderers that
   * consume it populate the very maps the post-render accessors later read. Call only
   * after `measureLayoutInfo` has been (re)assigned for this render.
   */
  private createRenderPass(): RenderPass {
    return {
      context: this.context,
      staveNoteMap: this.staveNoteMap,
      tupletObjectMap: this.tupletObjectMap,
      dynamicObjectMap: this.dynamicObjectMap,
      slurGroupMap: this.slurGroupMap,
      measureLayoutInfo: this.measureLayoutInfo,
      measureBounds: this.measureBounds,
      elementRegistry: this.elementRegistry,
    }
  }

  /**
   * Initialize the VexFlow renderer
   * @param width - Canvas width in pixels
   * @param height - Canvas height in pixels
   */
  initialize(width: number, height: number): void {
    // Clear any existing content
    this.svgContainer.innerHTML = ''

    // Create VexFlow SVG renderer
    this.renderer = new Renderer(this.svgContainer as HTMLDivElement, Renderer.Backends.SVG)
    this.renderer.resize(width, height)
    this.context = this.renderer.getContext()

    // Disable save/restore to avoid structuredClone issues with Vue reactivity
    this.context.save = () => {}
    this.context.restore = () => {}
  }

  /**
   * Convert our NoteDuration to VexFlow duration format
   * Appends 'd' for each dot (e.g., "qd" for dotted quarter, "qdd" for double-dotted)
   */
  private convertDuration(duration: NoteDuration, dots: number = 0): string {
    return durationToVexflow(duration, dots)
  }

  /**
   * Map the pure {@link pickVoiceMode} policy onto VexFlow's Voice.Mode enum.
   * `capacity` is the measure's actual playable length (override or nominal), so
   * a pickup bar is judged against its true length.
   */
  private chooseVoiceMode(slots: ChordRest[], capacity: Fraction): number {
    return pickVoiceMode(slots, capacity) === 'soft' ? Voice.Mode.SOFT : Voice.Mode.FULL
  }

  /**
   * Create StaveNotes directly from ChordRest slots.
   * One slot → one StaveNote. Rests → rest StaveNote; Chords → multi-key StaveNote.
   * @param slots - Slots already sorted by beat position
   * @param clefForBeat - Resolves the clef in effect at a given beat (for note
   *   positioning and stem direction). A single Clef is accepted for convenience.
   */
  private createStaveNotesFromSlots(
    slots: ChordRest[],
    clefForBeat: ((beat: Fraction) => Clef) | Clef = 'treble',
  ): StaveNote[] {
    const resolveClef: (beat: Fraction) => Clef =
      typeof clefForBeat === 'function' ? clefForBeat : () => clefForBeat
    const staveNotes: StaveNote[] = []

    // Track the currently active alteration per diatonic staff position within this measure.
    // Key = spellingDiatonicPos(step, octave). Value = active PitchAlter (0 = natural).
    // A position absent from the map has not yet appeared in this measure.
    const activeMeasureAlterations = new Map<number, PitchAlter>()

    for (const slot of slots) {
      if (slot.type === 'rest') {
        if (slot.isMeasureRest) {
          // Whole-bar (measure) rest: a centred whole rest, drawn the same way at
          // any bar length. Its voice runs in SOFT mode (see chooseVoiceMode) so
          // the whole rest's fixed tick value never clashes with the bar capacity.
          staveNotes.push(new StaveNote({ keys: ['b/4'], duration: 'wr', alignCenter: true }))
          continue
        }
        const vexDuration = this.convertDuration(slot.duration, slot.dots || 0)
        // Rests are positioned at fixed staff positions independent of clef.
        // The 'b/4' key anchors the rest to the middle line under the default
        // (treble) clef — passing a clef would shift it (e.g. high in bass clef).
        const staveNote = new StaveNote({ keys: ['b/4'], duration: vexDuration + 'r' })
        for (let d = 0; d < (slot.dots || 0); d++) {
          Dot.buildAndAttach([staveNote], { all: true })
        }
        staveNotes.push(staveNote)
        continue
      }

      // Chord slot — decide which accidental sign (if any) to display for each pitch.
      // displayAccidentals: noteId → VexFlow accidental string, or null if suppressed.
      const displayAccidentals = new Map<string, string | null>()
      for (const p of slot.notes) {
        if (p.tiedFrom) {
          // Tied continuation: never re-show the accidental
          displayAccidentals.set(p.id, null)
          continue
        }
        const dPos = spellingDiatonicPos(p.step, p.octave)
        const activeAlter = activeMeasureAlterations.get(dPos)  // undefined = not seen yet

        if (p.alter !== 0) {
          // Non-natural pitch — show sign unless the same alteration is already active
          if (!p.forceAccidental && activeAlter === p.alter) {
            displayAccidentals.set(p.id, null)  // suppress: redundant
          } else {
            const sign = p.alter === 2 ? '##' : p.alter === 1 ? '#' : p.alter === -1 ? 'b' : 'bb'
            displayAccidentals.set(p.id, sign)
            activeMeasureAlterations.set(dPos, p.alter)
          }
        } else {
          // Natural pitch (alter === 0)
          if (activeAlter !== undefined && activeAlter !== 0) {
            // A previous note on this staff position was altered — show ♮ to cancel it
            displayAccidentals.set(p.id, 'n')
            activeMeasureAlterations.set(dPos, 0)
          } else if (p.forceAccidental) {
            // Caller explicitly wants a courtesy natural sign
            displayAccidentals.set(p.id, 'n')
            activeMeasureAlterations.set(dPos, 0)
          } else {
            displayAccidentals.set(p.id, null)  // no sign needed
          }
        }
      }

      // Sort pitches low→high by MIDI value (VexFlow requires ascending key order for chords)
      const sortedPitches = [...slot.notes].sort(
        (a, b) => spellingToMidi(a.step, a.alter, a.octave) - spellingToMidi(b.step, b.alter, b.octave)
      )
      // Build VexFlow key strings directly from spelling — no MIDI lookup table needed
      const keys = sortedPitches.map(p => spellingToVexflowKey(p.step, p.alter, p.octave))

      // Clef in effect at this slot's beat (mid-measure changes move notes).
      const slotClef = resolveClef(slot.beat)

      // Stem direction — compare diatonic staff position against clef's middle line
      let stemDirection: number
      if (slot.stemDirection === 'up') {
        stemDirection = 1
      } else if (slot.stemDirection === 'down') {
        stemDirection = -1
      } else {
        const middleDiatonic = middleLineDiatonicPos(slotClef)
        let maxDist = 0
        stemDirection = -1  // default down; middle-line notes follow this convention
        for (const p of slot.notes) {
          const dPos = spellingDiatonicPos(p.step, p.octave)
          const dist = Math.abs(dPos - middleDiatonic)
          if (dist > maxDist) {
            maxDist = dist
            stemDirection = dPos >= middleDiatonic ? -1 : 1
          }
        }
      }

      const vexDuration = this.convertDuration(slot.duration, slot.dots || 0)
      const staveNote = new StaveNote({ keys, duration: vexDuration, clef: slotClef, autoStem: false })
      staveNote.setStemDirection(stemDirection)

      // Add accidental modifiers — VexFlow accepts '#', 'b', 'n', '##', 'bb'
      sortedPitches.forEach((p, idx) => {
        const acc = displayAccidentals.get(p.id) ?? null
        if (acc) staveNote.addModifier(new Accidental(acc), idx)
      })

      // Dots
      for (let d = 0; d < (slot.dots || 0); d++) {
        Dot.buildAndAttach([staveNote], { all: true })
      }

      // Articulations are per-chord (stored on slot, not per pitch).
      // Sorted by ARTICULATION_RENDER_ORDER so the first added sits closest to the note head.
      const articulationVexCodes: Record<ArticulationType, string> = { accent: 'a>', staccato: 'a.', tenuto: 'a-' }
      // Auto side = opposite the stem (notehead side); an explicit slot override flips it.
      const autoArticulationPosition = stemDirection === 1 ? Modifier.Position.BELOW : Modifier.Position.ABOVE
      const articulationPosition = slot.articulationPlacement === 'above'
        ? Modifier.Position.ABOVE
        : slot.articulationPlacement === 'below'
          ? Modifier.Position.BELOW
          : autoArticulationPosition
      const sortedArticulations = (slot.articulations ?? []).slice().sort(
        (a, b) => ARTICULATION_RENDER_ORDER.indexOf(a) - ARTICULATION_RENDER_ORDER.indexOf(b)
      )
      for (const art of sortedArticulations) {
        staveNote.addModifier(new Articulation(articulationVexCodes[art]).setPosition(articulationPosition), 0)
      }

      staveNotes.push(staveNote)
    }

    return staveNotes
  }

  /**
   * Attach the measure's dynamics as Annotation modifiers under (or above) the
   * staff, anchored to the slot at each dynamic's beat in its voice. Must run
   * before formatting so the annotation reserves vertical space alongside any
   * articulations (VexFlow's ModifierContext stacks them automatically).
   *
   * Anchor rule: prefer the slot whose beat exactly matches in the same voice;
   * if none (rare with auto rest-fill), use the nearest following slot in that
   * voice, then the last slot in that voice, then the last slot overall. This
   * keeps a dynamic visible even when it sits under an empty/rest beat.
   *
   * Each Annotation's DOM id is set to the Dynamic.id so its `<g class="vf-annotation">`
   * group is individually addressable (Phase 6 highlight); the object is stashed
   * in dynamicObjectMap for that lookup.
   *
   * Multiple dynamics may share one anchor note (the user can stack marks at a
   * beat, e.g. `p dolce`). VexFlow would stack them vertically; we lay them out
   * left-to-right in placement order afterwards — see {@link layoutCoLocatedDynamics}.
   *
   * IMPORTANT: each annotation's modifier width is ZEROED ({@link buildDynamicAnnotation}
   * calls setWidth(0)) so the formatter reserves no horizontal space for it — a long
   * text mark must never push the notes apart. The notes rule the layout; dynamics
   * are a secondary overlay (it overflows freely to the right of its note). The
   * annotation is still a real modifier, so VexFlow's vertical placement (below the
   * staff) and drawing happen normally. The registry bbox is taken from the rendered
   * SVG ({@link registerDynamics}) since the zeroed width would otherwise mis-size it.
   * @returns the dynamic-id groups (size ≥ 2) sharing a note, in placement order.
   */
  private attachDynamicsToSlots(sortedSlots: ChordRest[], staveNotes: StaveNote[], measure: Measure): string[][] {
    const dynamics = measure.dynamics
    if (!dynamics?.length || staveNotes.length === 0) return []

    const byTarget = new Map<number, string[]>()
    for (const dyn of dynamics) {
      if (dyn.id === this.suppressedDynamicId) continue // being edited in the text overlay
      const voice = dyn.voice ?? 0

      let targetIdx = sortedSlots.findIndex(s => (s.voice ?? 0) === voice && fracEq(s.beat, dyn.beat))
      if (targetIdx === -1) {
        targetIdx = sortedSlots.findIndex(s => (s.voice ?? 0) === voice && fracGte(s.beat, dyn.beat))
      }
      if (targetIdx === -1) {
        for (let i = sortedSlots.length - 1; i >= 0; i--) {
          if ((sortedSlots[i].voice ?? 0) === voice) { targetIdx = i; break }
        }
      }
      if (targetIdx === -1) targetIdx = staveNotes.length - 1
      if (targetIdx < 0 || targetIdx >= staveNotes.length) continue

      const annotation = this.buildDynamicAnnotation(dyn)
      staveNotes[targetIdx].addModifier(annotation, 0)
      this.dynamicObjectMap.set(dyn.id, annotation)
      const arr = byTarget.get(targetIdx) ?? []
      arr.push(dyn.id)
      byTarget.set(targetIdx, arr)
    }

    return [...byTarget.values()].filter(ids => ids.length >= 2)
  }

  /**
   * Lay co-located dynamics out on one row, left-to-right in PLACEMENT ORDER
   * (so the newest mark sits on the right), centered on their anchor and aligned
   * on a common vertical center. VexFlow stacks multiple annotations vertically
   * and its modifier offsets are awkward to control, so we reposition the rendered
   * SVG groups directly (a translate), then update each one's registry bbox so
   * hit-testing follows. Must run AFTER {@link registerDynamics}. Pure no-op in
   * non-DOM tests (getBBox unavailable → entries skipped).
   *
   * @param groups dynamic-id groups (placement order) from {@link attachDynamicsToSlots}.
   */
  private layoutCoLocatedDynamics(groups: string[][]): void {
    const GAP = 6
    for (const ids of groups) {
      const items: Array<{ id: string; el: SVGGraphicsElement; box: { x: number; y: number; width: number; height: number } }> = []
      for (const id of ids) {
        const el = this.dynamicObjectMap.get(id)?.getSVGElement?.() as SVGGraphicsElement | undefined
        if (!el?.getBBox) continue
        try {
          const box = el.getBBox()
          items.push({ id, el, box: { x: box.x, y: box.y, width: box.width, height: box.height } })
        } catch { /* getBBox can throw before layout in some envs */ }
      }
      if (items.length < 2) continue

      // Center the row where the group currently sits; align on the first mark's
      // vertical center (placement-order first = leftmost).
      const centerX = items[0].box.x + items[0].box.width / 2
      const centerY = items[0].box.y + items[0].box.height / 2
      const total = items.reduce((s, it) => s + it.box.width, 0) + GAP * (items.length - 1)

      let cursor = 0
      for (const it of items) {
        const targetX = centerX - total / 2 + cursor
        const dx = targetX - it.box.x
        const dy = centerY - (it.box.y + it.box.height / 2)
        it.el.setAttribute('transform', `translate(${dx}, ${dy})`)
        cursor += it.box.width + GAP

        const entry = this.elementRegistry.getById(it.id)
        if (entry) entry.bbox = { x: it.box.x + dx, y: it.box.y + dy, width: it.box.width, height: it.box.height }
      }
    }
  }

  /**
   * Build the VexFlow Annotation for one dynamic. Level marks render the SMuFL
   * dynamics glyph in the music font (global stack); custom-text marks render the
   * user's text in an italic text font. Both default to below-staff placement.
   */
  private buildDynamicAnnotation(dyn: Dynamic): Annotation {
    const isLevel = dyn.kind === 'level' && dyn.level !== undefined
    const label = isLevel ? levelToGlyphString(dyn.level!) : (dyn.text ?? '')

    const annotation = new Annotation(label)
    annotation.setAttribute('id', dyn.id)
    annotation.setVerticalJustification(dyn.placement === 'above' ? 'above' : 'below')
    // Left-justify so the FIRST character anchors on the note (the tick), not the
    // text centre. Dynamics/expression text reads left-to-right from the note.
    annotation.setJustification(Annotation.HorizontalJustify.LEFT)

    if (isLevel) {
      // Level glyph: keep the default family (VexFlow's global Bravura+text stack)
      // so the SMuFL dynamics glyph follows the score's engraving font.
      annotation.setFont({ size: DYNAMIC_GLYPH_SIZE })
    } else {
      // Custom text: an italic serif — the notation convention for expression
      // text (dolce, espr.). A real serif face guarantees a true italic slant
      // (the music font has no italic). User-selectable styling is future work.
      annotation.setFont({ family: DYNAMIC_TEXT_FONT, size: DYNAMIC_TEXT_SIZE, style: 'italic' })
    }

    // Zero the modifier width (AFTER setFont, which re-measures) so the formatter
    // reserves no horizontal space — the mark never pushes the notes apart. The
    // text still renders in full (renderText draws the string); only the reported
    // width is 0. Vertical placement and drawing are unaffected. See attachDynamicsToSlots.
    annotation.setWidth(0)
    return annotation
  }

  /**
   * Build a resolver for the clef in effect at any beat within a measure.
   * Starts from the measure's opening clef and applies each clef change whose
   * beat is at/before the queried beat.
   */
  private makeClefResolver(measure: Measure, openingClef: Clef): (beat: Fraction) => Clef {
    const changes = (measure.clefs ?? []).slice().sort((a, b) => fracCompare(a.beat, b.beat))
    return (beat: Fraction): Clef => {
      let current = openingClef
      for (const ch of changes) {
        if (fracLte(ch.beat, beat)) current = ch.clef
        else break
      }
      return current
    }
  }

  /**
   * Interleave inline ClefNotes (for mid-measure clef changes) among the slot
   * StaveNotes. Each change is inserted before the first slot at/after its beat.
   * ClefNotes ignore ticks, so the voice's tick total is unaffected.
   * @returns the combined tickable list and a map of beat→ClefNote for registration
   */
  private interleaveClefNotes(
    sortedSlots: ChordRest[],
    staveNotes: StaveNote[],
    midChanges: { beat: Fraction; clef: Clef }[],
  ): { tickables: (StaveNote | ClefNote)[]; clefNoteByBeat: Array<{ beat: Fraction; clef: Clef; clefNote: ClefNote }> } {
    const tickables: (StaveNote | ClefNote)[] = []
    const clefNoteByBeat: Array<{ beat: Fraction; clef: Clef; clefNote: ClefNote }> = []
    const remaining = [...midChanges]

    const emit = (change: { beat: Fraction; clef: Clef }) => {
      const clefNote = new ClefNote(change.clef, 'small')
      tickables.push(clefNote)
      clefNoteByBeat.push({ beat: change.beat, clef: change.clef, clefNote })
    }

    for (let i = 0; i < sortedSlots.length; i++) {
      const slotBeat = sortedSlots[i].beat
      // Emit any pending clef change whose beat is at/before this slot's beat.
      while (remaining.length && fracLte(remaining[0].beat, slotBeat)) {
        emit(remaining.shift()!)
      }
      tickables.push(staveNotes[i])
    }
    // Any leftover changes (beat past all slots) append at the end.
    for (const change of remaining) emit(change)

    return { tickables, clefNoteByBeat }
  }

  /**
   * Register rendered inline clef glyphs as 'clef' elements (with measure + beat)
   * for hit detection (mid-measure clef removal) and clef-segment lookup.
   */
  private registerMidMeasureClefs(
    clefNoteByBeat: Array<{ beat: Fraction; clefNote: ClefNote }>,
    measure: Measure,
  ): void {
    for (const { beat, clefNote } of clefNoteByBeat) {
      try {
        const box = clefNote.getBoundingBox()
        if (box) {
          this.elementRegistry.add({
            type: 'clef',
            measure: measure.number,
            beat: fracToNumber(beat),
            bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
          })
        }
      } catch (e) { /* getBoundingBox may fail */ }
    }
  }


  /**
   * Calculate the stem direction for an entire beam group.
   * Uses the pitch furthest from the middle line across all slots.
   * @param slots - ChordRest slots in the beam group
   * @param clef - Clef type for middle line reference
   * @returns VexFlow stem direction value (1 = UP, -1 = DOWN)
   */
  private calculateBeamGroupStemDirection(slots: ChordRest[], clef: Clef = 'treble'): number {
    // Explicit override on any note in the group takes priority over pitch calculation
    for (const slot of slots) {
      if (slot.type === 'chord' && slot.stemDirection === 'up') return 1
      if (slot.type === 'chord' && slot.stemDirection === 'down') return -1
    }

    // No override — use the pitch furthest from the middle line
    const middleDiatonic = middleLineDiatonicPos(clef)
    let maxDistance = 0
    let furthestDiatonic = middleDiatonic
    let hasPitch = false

    for (const slot of slots) {
      if (slot.type === 'rest') continue
      for (const p of slot.notes) {
        const dPos = spellingDiatonicPos(p.step, p.octave)
        const distance = Math.abs(dPos - middleDiatonic)
        if (!hasPitch || distance > maxDistance) {
          maxDistance = distance
          furthestDiatonic = dPos
          hasPitch = true
        }
      }
    }

    return furthestDiatonic >= middleDiatonic ? -1 : 1
  }

  /**
   * Create beam groups from stave notes and their corresponding slots.
   * Returns arrays of StaveNotes that should be beamed together, along with slot data.
   *
   * @param staveNotes - The VexFlow StaveNote objects (one per slot)
   * @param slots - ChordRest slots sorted by beat (parallel to staveNotes)
   * @param meter - The measure's metric hierarchy (drives default grouping)
   * @returns Array of beam group info with stave notes and slots
   */
  private createBeamGroups(
    staveNotes: StaveNote[],
    slots: ChordRest[],
    meter: MeterInfo
  ): { staveNotes: StaveNote[]; slots: ChordRest[] }[] {
    // Pure grouping (slot indices) → map back onto the parallel StaveNotes.
    return computeBeamGroups(slots, meter).map((indices) => ({
      staveNotes: indices.map((i) => staveNotes[i]),
      slots: indices.map((i) => slots[i]),
    }))
  }

  /**
   * Calculate the optimal location (above or below) for a tuplet bracket
   * Based on the stem direction of the notes in the tuplet
   * @param staveNotes - The VexFlow StaveNotes in the tuplet
   * @param clef - The clef type for pitch reference
   * @returns VexFlow.Tuplet.LOCATION_TOP (1) or VexFlow.Tuplet.LOCATION_BOTTOM (-1)
   */
  private calculateTupletLocation(staveNotes: StaveNote[], _clef: Clef): number {
    // VexFlow constants: LOCATION_TOP = 1, LOCATION_BOTTOM = -1
    const LOCATION_TOP = 1
    const LOCATION_BOTTOM = -1

    if (staveNotes.length === 0) return LOCATION_TOP

    // Check if all notes have stems down (then bracket goes above)
    // or if all notes have stems up (then bracket goes below)
    // Mixed directions: use majority or default to above
    let stemsUp = 0
    let stemsDown = 0

    for (const note of staveNotes) {
      try {
        const stem = note.getStem()
        if (stem) {
          // getStemDirection returns 1 for up, -1 for down
          const direction = note.getStemDirection()
          if (direction === 1) stemsUp++
          else if (direction === -1) stemsDown++
        } else {
          // No stem (whole note or rest) - use default
          stemsDown++
        }
      } catch (e) {
        // getStem may fail for rests
        stemsDown++
      }
    }

    // Bracket goes opposite to stem direction:
    // - Stems up → bracket below
    // - Stems down → bracket above
    if (stemsUp > stemsDown) {
      return LOCATION_BOTTOM
    } else {
      return LOCATION_TOP
    }
  }

  /**
   * Create VexFlow Tuplet objects for a measure (adjusts tick values on notes).
   * Must be called BEFORE voice.addTickables() for correct tick calculation.
   * @param measure - The measure containing tuplet definitions
   * @param slots - ChordRest slots sorted by beat (parallel to staveNotes)
   * @param staveNotes - The VexFlow StaveNotes array
   * @returns Map of tupletId to VexFlow Tuplet objects
   */
  private createTupletsForMeasure(
    measure: Measure,
    slots: ChordRest[],
    staveNotes: StaveNote[]
  ): Map<string, VexFlowTuplet> {
    const vexTuplets = new Map<string, VexFlowTuplet>()

    if (!measure.tuplets || measure.tuplets.length === 0) {
      return vexTuplets
    }

    // Build mapping from tupletId to StaveNotes (one slot → one StaveNote)
    const tupletStaveNoteMap = new Map<string, StaveNote[]>()

    for (let i = 0; i < slots.length && i < staveNotes.length; i++) {
      const slot = slots[i]
      if (slot.tupletId) {
        if (!tupletStaveNoteMap.has(slot.tupletId)) {
          tupletStaveNoteMap.set(slot.tupletId, [])
        }
        tupletStaveNoteMap.get(slot.tupletId)!.push(staveNotes[i])
      }
    }

    // Create VexFlow Tuplet objects
    for (const [tupletId, tupletStaveNotes] of tupletStaveNoteMap) {
      const tupletData = measure.tuplets.find(t => t.id === tupletId)
      if (tupletData && tupletStaveNotes.length >= 2) {
        try {
          const vexTuplet = new VexFlowTuplet(tupletStaveNotes, {
            numNotes: tupletData.numNotes,
            notesOccupied: tupletData.notesOccupied,
          })
          vexTuplets.set(tupletId, vexTuplet)
        } catch (e) {
          // Ignore tuplet creation errors
        }
      }
    }

    return vexTuplets
  }

  /**
   * Resolve the opening clef of every measure (the clef drawn at its barline /
   * line start). Mid-measure changes are handled per-slot during rendering.
   * @returns Map of measure number → opening clef
   */
  private computeEffectiveClefs(score: Score): Map<number, Clef> {
    const map = new Map<number, Clef>()
    for (const measure of score.measures) {
      map.set(measure.number, measureOpeningClef(score, measure.number))
    }
    return map
  }

  /**
   * Whether a time-signature glyph is drawn at the start of this measure:
   * measure 1 always, plus any measure that begins an explicit TS change
   * (engraving standard) — UNLESS the glyph has been explicitly hidden
   * (`timeSignatureHidden`, e.g. the deleted default on measure 1; the meter
   * still applies, only the glyph is suppressed). Drives the drawing, its width
   * reservation, AND the clickable registry element.
   */
  private drawsTimeSignature(measure: Measure): boolean {
    if (measure.timeSignatureHidden === true) return false
    return measure.number === 1 || measure.timeSignatureChange === true
  }

  /**
   * Calculate minimum width needed for a single measure based on its content
   * Uses VexFlow's Formatter to estimate space needed for notes
   */
  private calculateMinimumMeasureWidth(
    measure: Measure,
    isFirstInLine: boolean,
    clef: Clef,
    hasClefChange: boolean = false
  ): number {
    // Start with base overhead
    let overhead = LAYOUT_CONFIG.BARLINE_PADDING * 2

    // Add clef width for first measure of each line
    if (isFirstInLine) {
      overhead += LAYOUT_CONFIG.CLEF_WIDTH
    } else if (hasClefChange) {
      // Mid-line clef change renders a smaller clef at the measure start
      overhead += LAYOUT_CONFIG.CLEF_CHANGE_WIDTH
    }

    // Add time signature width wherever a TS glyph is drawn (measure 1 + changes)
    if (this.drawsTimeSignature(measure)) {
      overhead += LAYOUT_CONFIG.TIME_SIG_WIDTH
    }

    // Budget width for each mid-measure (inline) clef change
    const midClefCount = (measure.clefs ?? []).filter(c => !fracIsZero(c.beat)).length
    overhead += midClefCount * LAYOUT_CONFIG.CLEF_CHANGE_WIDTH

    // If measure has no notes or only rests, use minimum width
    const actualNotes = measure.slots.filter(s => s.type === 'chord')
    if (actualNotes.length === 0) {
      return Math.max(LAYOUT_CONFIG.MIN_MEASURE_WIDTH, overhead + 40)
    }

    // Create temporary voice to calculate width
    const sortedSlots = [...measure.slots].sort((a, b) => fracCompare(a.beat, b.beat))
    const staveNotes = this.createStaveNotesFromSlots(sortedSlots, this.makeClefResolver(measure, clef))

    // Create VexFlow Tuplets BEFORE adding notes to voice (adjusts tick values)
    this.createTupletsForMeasure(measure, sortedSlots, staveNotes)

    const voice = new Voice({
      numBeats: measure.timeSignature.numerator,
      beatValue: measure.timeSignature.denominator,
    }).setMode(this.chooseVoiceMode(sortedSlots, measureCapacityFrac(measure)))

    try {
      voice.addTickables(staveNotes)

      // Use VexFlow's formatter to calculate minimum width
      const formatter = new Formatter()
      formatter.joinVoices([voice])
      const minNoteWidth = formatter.preCalculateMinTotalWidth([voice])

      // Add safety buffer (15%) and ensure minimum note spacing
      const noteCount = sortedSlots.filter(s => s.type === 'chord').length
      const minSpacingWidth = noteCount * LAYOUT_CONFIG.MIN_NOTE_SPACING
      const calculatedWidth = Math.max(minNoteWidth * 1.15, minSpacingWidth)

      // Total width = note space + overhead
      let totalWidth = calculatedWidth + overhead

      // Apply min/max constraints
      totalWidth = Math.max(totalWidth, LAYOUT_CONFIG.MIN_MEASURE_WIDTH)
      totalWidth = Math.min(totalWidth, LAYOUT_CONFIG.MAX_MEASURE_WIDTH)

      return totalWidth
    } catch (error) {
      // If calculation fails, fall back to minimum width
      console.warn(`Could not calculate width for measure ${measure.number}:`, error)
      return LAYOUT_CONFIG.MIN_MEASURE_WIDTH
    }
  }

  /**
   * Distribute available width proportionally among measures on a line
   */
  private distributeLineWidths(
    measureInfos: MeasureWidthInfo[],
    availableWidth: number
  ): void {
    if (measureInfos.length === 0) return

    const totalMinWidth = measureInfos.reduce((sum, m) => sum + m.minWidth, 0)

    if (totalMinWidth >= availableWidth) {
      // Need to compress - distribute proportionally to minimum widths
      const compressionRatio = availableWidth / totalMinWidth
      if (compressionRatio < 0.7) {
        console.warn(`Severe measure compression (${(compressionRatio * 100).toFixed(0)}%) on line - measures may be crowded`)
      }
      for (const info of measureInfos) {
        info.finalWidth = info.minWidth * compressionRatio
      }
    } else {
      // Have extra space - distribute proportionally
      const extraSpace = availableWidth - totalMinWidth
      for (const info of measureInfos) {
        const proportion = info.minWidth / totalMinWidth
        info.finalWidth = info.minWidth + (extraSpace * proportion)
      }
    }
  }

  /**
   * Calculate widths for all measures using a two-pass algorithm
   * Pass 1: Calculate minimum widths and group into lines
   * Pass 2: Distribute available space proportionally within each line
   */
  private calculateMeasureWidths(
    score: Score,
    effectiveClefs: Map<number, Clef>
  ): Map<number, MeasureWidthInfo> {
    const results = new Map<number, MeasureWidthInfo>()
    const margin = LAYOUT_CONFIG.MARGIN
    const availableWidth = LAYOUT_CONFIG.CONTAINER_WIDTH - (margin * 2)

    // Pass 1: Calculate minimum widths and assign to lines
    let currentLine = 0
    let currentLineWidth = 0
    let currentLineMeasures: MeasureWidthInfo[] = []

    for (const measure of score.measures) {
      const isFirstInLine = currentLineMeasures.length === 0
      const clef = effectiveClefs.get(measure.number) || 'treble'
      // Redraw the clef at a mid-line measure start only when it actually changes
      // across the barline — i.e. differs from the previous measure's *ending*
      // clef (a mid-measure change already shows its clef inline in that measure).
      const prevEndClef = measure.number > 1 ? measureEndingClef(score, measure.number - 1) : undefined
      const hasClefChange = prevEndClef !== undefined && clef !== prevEndClef
      const minWidth = this.calculateMinimumMeasureWidth(measure, isFirstInLine, clef, hasClefChange)

      // Check if measure fits on current line
      if (currentLineWidth + minWidth > availableWidth && currentLineMeasures.length > 0) {
        // Finalize current line
        this.distributeLineWidths(currentLineMeasures, availableWidth)
        for (const info of currentLineMeasures) {
          results.set(info.measureNumber, info)
        }

        // Start new line
        currentLine++
        currentLineWidth = 0
        currentLineMeasures = []

        // Recalculate width for new line (first-in-line gets a full clef, so a
        // clef change is absorbed into the line-start clef — no extra width)
        const newMinWidth = this.calculateMinimumMeasureWidth(measure, true, clef)

        const info: MeasureWidthInfo = {
          measureNumber: measure.number,
          minWidth: newMinWidth,
          finalWidth: newMinWidth,
          lineNumber: currentLine,
        }
        currentLineMeasures.push(info)
        currentLineWidth = newMinWidth
      } else {
        const info: MeasureWidthInfo = {
          measureNumber: measure.number,
          minWidth,
          finalWidth: minWidth,
          lineNumber: currentLine,
        }
        currentLineMeasures.push(info)
        currentLineWidth += minWidth
      }
    }

    // Finalize last line
    if (currentLineMeasures.length > 0) {
      this.distributeLineWidths(currentLineMeasures, availableWidth)
      for (const info of currentLineMeasures) {
        results.set(info.measureNumber, info)
      }
    }

    this.applyCautionaryClefs(score, effectiveClefs, results, availableWidth)
    this.applyCautionaryTimeSignatures(score, results, availableWidth)

    return results
  }

  /**
   * Add a cautionary clef to the last measure of any line whose *next* line opens
   * with a different clef. The warning shows the upcoming clef just before the
   * line break (standard engraving). Runs after line assignment, so it reserves
   * width on the affected measure and re-distributes that line only — line
   * membership is never changed (no re-wrapping).
   */
  private applyCautionaryClefs(
    score: Score,
    effectiveClefs: Map<number, Clef>,
    results: Map<number, MeasureWidthInfo>,
    availableWidth: number
  ): void {
    const linesToRedistribute = new Set<number>()

    for (let i = 0; i < score.measures.length - 1; i++) {
      const current = results.get(score.measures[i].number)
      const next = results.get(score.measures[i + 1].number)
      if (!current || !next || next.lineNumber <= current.lineNumber) continue

      // The next line opens here; warn only if the clef actually changes across
      // the break (its opening clef differs from this measure's ending clef).
      const nextOpeningClef = effectiveClefs.get(next.measureNumber) || 'treble'
      if (nextOpeningClef === measureEndingClef(score, current.measureNumber)) continue

      current.cautionaryEndClef = nextOpeningClef
      current.minWidth += LAYOUT_CONFIG.CLEF_CHANGE_WIDTH
      linesToRedistribute.add(current.lineNumber)
    }

    // Re-distribute each affected line so the reserved width shrinks note spacing
    // rather than overflowing the margin.
    for (const lineNumber of linesToRedistribute) {
      const lineMeasures = [...results.values()].filter(m => m.lineNumber === lineNumber)
      this.distributeLineWidths(lineMeasures, availableWidth)
    }
  }

  /**
   * Add a cautionary (courtesy) time signature to the last measure of any line
   * whose *next* line opens with a meter change. The warning shows the upcoming
   * time signature just before the line break, after the final barline (standard
   * engraving). Drawn FULL size, unlike the cautionary clef.
   *
   * Runs after line assignment, so it reserves width on the affected measure and
   * re-distributes that line only — line membership is never changed (no re-wrap).
   */
  private applyCautionaryTimeSignatures(
    score: Score,
    results: Map<number, MeasureWidthInfo>,
    availableWidth: number
  ): void {
    const linesToRedistribute = new Set<number>()

    for (let i = 0; i < score.measures.length - 1; i++) {
      const current = results.get(score.measures[i].number)
      const next = results.get(score.measures[i + 1].number)
      if (!current || !next || next.lineNumber <= current.lineNumber) continue

      // The next line opens here; warn only when it actually begins a meter change
      // (same condition that draws the TS glyph at the new line's start).
      const nextMeasure = score.measures[i + 1]
      if (!nextMeasure.timeSignatureChange) continue

      current.cautionaryEndTimeSig = nextMeasure.timeSignature
      current.minWidth += LAYOUT_CONFIG.TIME_SIG_WIDTH
      linesToRedistribute.add(current.lineNumber)
    }

    for (const lineNumber of linesToRedistribute) {
      const lineMeasures = [...results.values()].filter(m => m.lineNumber === lineNumber)
      this.distributeLineWidths(lineMeasures, availableWidth)
    }
  }

  /**
   * Render a single measure
   * @param measure - Measure to render
   * @param x - X position on canvas
   * @param y - Y position on canvas
   * @param width - Width of the measure
   * @param isFirstInLine - Whether this is the first measure in a line
   * @param clef - Effective clef for this measure (rendering and stem direction)
   * @param hasClefChange - Whether this measure's clef differs from the previous measure
   * @param cautionaryEndClef - Clef to draw at the measure end as a cautionary warning
   *   (set when this is a line's last measure and the next line opens with a new clef)
   * @param ghostClefBeat - Beat of a dragged-redundant clef in this measure to keep
   *   visible during the drag even at beat 0, where it would otherwise be hidden
   * @param cautionaryEndTimeSig - Time signature to draw (full size) at the measure
   *   end as a courtesy warning (set when the next line opens with a meter change)
   */
  renderMeasure(
    measure: Measure,
    x: number,
    y: number,
    width: number,
    isFirstInLine: boolean = false,
    clef: Clef = 'treble',
    hasClefChange: boolean = false,
    cautionaryEndClef?: Clef,
    ghostClefBeat?: Fraction,
    cautionaryEndTimeSig?: TimeSignature
  ): void {
    if (!this.context) {
      throw new Error('Renderer not initialized. Call initialize() first.')
    }

    const stave = this.buildAndDrawStave(measure, x, y, width, isFirstInLine, clef, hasClefChange, cautionaryEndClef, cautionaryEndTimeSig)

    // Resolve the clef in effect at any beat within this measure: starts from the
    // opening clef and applies each clef change at/after its beat.
    const clefForBeat = this.makeClefResolver(measure, clef)
    // Mid-measure changes (beat > 0) render as inline ClefNotes before their slot.
    const midChanges: { beat: Fraction; clef: Clef }[] = (measure.clefs ?? [])
      .filter(c => !fracIsZero(c.beat))
      .sort((a, b) => fracCompare(a.beat, b.beat))
      .map(c => ({ beat: c.beat, clef: c.clef }))

    // If the dragged-redundant clef sits at beat 0, the opening clef is suppressed
    // (redundant), so render it as an inline clef at the measure start to keep it
    // visible during the drag (it's removed on drop by commitClefMove).
    if (ghostClefBeat !== undefined && fracIsZero(ghostClefBeat)) {
      const opening = (measure.clefs ?? []).find(c => fracIsZero(c.beat))
      if (opening) midChanges.unshift({ beat: opening.beat, clef: opening.clef })
    }

    // Clef regions for pixel↔pitch lookup; opening clef covers the whole measure,
    // each inline clef (added after draw) starts a new region at its X.
    const clefSegments: ClefSegment[] = [{ fromX: x, clef }]

    if (measure.slots.length > 0) {
      const sortedSlots = [...measure.slots].sort((a, b) => fracCompare(a.beat, b.beat))
      // notesOnly: one StaveNote per slot (used for beams, tuplets, registration).
      const staveNotes = this.createStaveNotesFromSlots(sortedSlots, clefForBeat)

      // Attach dynamics as Annotation modifiers BEFORE formatting so they reserve
      // vertical space and stack with articulations. Co-located marks (stacked at
      // one beat) come back as id-groups, repositioned onto one row after drawing.
      const dynamicGroups = this.attachDynamicsToSlots(sortedSlots, staveNotes, measure)

      // Tuplets must be created BEFORE adding notes to voice — VexFlow adjusts tick values
      const { vexTuplets, tupletStaveNoteMap } = this.buildVexTuplets(sortedSlots, staveNotes, measure, clef)

      // tickables: notesOnly + inline ClefNotes interleaved at change boundaries.
      // ClefNotes ignore ticks, so the voice tick total still matches the notes.
      const { tickables, clefNoteByBeat } = this.interleaveClefNotes(sortedSlots, staveNotes, midChanges)

      const meter = getMeterInfo(measure.timeSignature)
      // VOICE SCAFFOLDING: all slots render in a single VexFlow voice today (only
      // voice 0 is populated). When multi-voice editing lands, group slots by
      // `voice ?? 0` and build one Voice per group, all sharing this numBeats/
      // beatValue (so Formatter.joinVoices won't TickMismatch), then format and
      // draw them together. The model layer (fill/collision) is already per-voice.
      const voice = new Voice({
        numBeats: measure.timeSignature.numerator,
        beatValue: measure.timeSignature.denominator,
      }).setMode(this.chooseVoiceMode(sortedSlots, measureCapacityFrac(measure)))

      try {
        voice.addTickables(tickables)

        const beams = this.buildBeams(staveNotes, sortedSlots, meter, clefForBeat)

        const noteAreaWidth = stave.getNoteEndX() - stave.getNoteStartX()
        const formatWidth = Math.max(noteAreaWidth - 15, 50)
        new Formatter().joinVoices([voice]).format([voice], formatWidth)
        voice.draw(this.context, stave)

        for (const beam of beams) {
          beam.setContext(this.context).draw()
        }

        this.drawAndRegisterTuplets(vexTuplets, tupletStaveNoteMap, measure)
        this.registerSlotElements(sortedSlots, staveNotes, measure)
        this.registerDynamics(measure)
        // Co-located dynamics: reposition onto one row (placement order, newest
        // right) AFTER registration so their bboxes are present to update.
        this.layoutCoLocatedDynamics(dynamicGroups)
        this.registerBeams(beams, measure)
        this.registerMidMeasureClefs(clefNoteByBeat, measure)

        // Extend clef regions with each inline clef's actual X position.
        for (const { clef: segClef, clefNote } of clefNoteByBeat) {
          try {
            const box = clefNote.getBoundingBox()
            if (box) clefSegments.push({ fromX: box.x, clef: segClef })
          } catch (e) { /* getBoundingBox may fail */ }
        }
        clefSegments.sort((a, b) => a.fromX - b.fromX)
      } catch (error) {
        console.error(`  ❌ Could not render measure ${measure.number}: ${error}`)
        console.error(`  - Measure data:`, JSON.stringify(measure, null, 2))
      }
    }

    this.registerStaffAndGeometry(stave, measure, x, y, width, isFirstInLine, clef, hasClefChange, clefSegments)
  }

  private buildAndDrawStave(
    measure: Measure,
    x: number,
    y: number,
    width: number,
    isFirstInLine: boolean,
    clef: Clef,
    hasClefChange: boolean = false,
    cautionaryEndClef?: Clef,
    cautionaryEndTimeSig?: TimeSignature,
  ): Stave {
    const stave = new Stave(x, y, width)

    if (measure.number === 1 || isFirstInLine) {
      // Line start: full-size clef showing the effective clef for this measure
      stave.addClef(clef)
    } else if (hasClefChange) {
      // Mid-line clef change: smaller clef at the start of the measure it applies to
      stave.addClef(clef, 'small')
    }
    if (this.drawsTimeSignature(measure)) {
      stave.addTimeSignature(`${measure.timeSignature.numerator}/${measure.timeSignature.denominator}`)
    }
    if (cautionaryEndClef) {
      // Cautionary clef before a line break: warns of the next line's new clef.
      stave.addEndClef(cautionaryEndClef, 'small')
    }
    if (cautionaryEndTimeSig) {
      // Cautionary time signature before a line break: warns of the next line's new
      // meter. Drawn full size (no 'small') and placed after the final barline.
      stave.addEndTimeSignature(`${cautionaryEndTimeSig.numerator}/${cautionaryEndTimeSig.denominator}`)
    }

    // VexFlow's Stem.draw() leaves ctx.lineWidth at Stem.WIDTH (1.5) and Stave.draw()
    // strokes its lines with whatever width is current — so a prior measure's stems
    // would thicken this staff. Pin it back to 1 before drawing the staff lines.
    this.context!.setLineWidth?.(1)
    stave.setContext(this.context!).draw()

    this.measureBounds.set(measure.number, {
      measureX: x,
      measureY: y,
      measureWidth: width,
      noteStartX: stave.getNoteStartX(),
      noteEndX: stave.getNoteEndX(),
    })

    return stave
  }

  private buildVexTuplets(
    sortedSlots: ChordRest[],
    staveNotes: StaveNote[],
    measure: Measure,
    clef: Clef,
  ): { vexTuplets: VexFlowTuplet[]; tupletStaveNoteMap: Map<string, { staveNotes: StaveNote[]; tuplet: Tuplet }> } {
    const tupletStaveNoteMap = new Map<string, { staveNotes: StaveNote[]; tuplet: Tuplet }>()

    for (let idx = 0; idx < sortedSlots.length && idx < staveNotes.length; idx++) {
      const slot = sortedSlots[idx]
      if (slot.tupletId) {
        const tupletData = (measure.tuplets || []).find(t => t.id === slot.tupletId)
        if (tupletData) {
          if (!tupletStaveNoteMap.has(slot.tupletId)) {
            tupletStaveNoteMap.set(slot.tupletId, { staveNotes: [], tuplet: tupletData })
          }
          tupletStaveNoteMap.get(slot.tupletId)!.staveNotes.push(staveNotes[idx])
        }
      }
    }

    const vexTuplets: VexFlowTuplet[] = []
    for (const [_tupletId, { staveNotes: tupletStaveNotes, tuplet: tupletData }] of tupletStaveNoteMap) {
      if (tupletStaveNotes.length >= 2) {
        try {
          const location = this.calculateTupletLocation(tupletStaveNotes, clef)
          const vexTuplet = new VexFlowTuplet(tupletStaveNotes, {
            numNotes: tupletData.numNotes,
            notesOccupied: tupletData.notesOccupied,
            location,
            bracketed: true,
          })
          vexTuplets.push(vexTuplet)
        } catch (tupletError) {
          console.warn(`Could not create tuplet: ${tupletError}`)
        }
      }
    }

    return { vexTuplets, tupletStaveNoteMap }
  }

  private buildBeams(
    staveNotes: StaveNote[],
    sortedSlots: ChordRest[],
    meter: MeterInfo,
    clefForBeat: (beat: Fraction) => Clef,
  ): Beam[] {
    const beamGroups = this.createBeamGroups(staveNotes, sortedSlots, meter)
    const beams: Beam[] = []

    for (const beamGroup of beamGroups) {
      try {
        // A beam group lies within one clef region; use the clef at its first slot.
        const groupClef = beamGroup.slots.length ? clefForBeat(beamGroup.slots[0].beat) : 'treble'
        const beamStemDirection = this.calculateBeamGroupStemDirection(beamGroup.slots, groupClef)
        for (const staveNote of beamGroup.staveNotes) {
          staveNote.setStemDirection(beamStemDirection)
        }
        beams.push(new Beam(beamGroup.staveNotes))
      } catch (beamError) {
        console.warn(`Could not create beam: ${beamError}`)
      }
    }

    return beams
  }

  private drawAndRegisterTuplets(
    vexTuplets: VexFlowTuplet[],
    tupletStaveNoteMap: Map<string, { staveNotes: StaveNote[]; tuplet: Tuplet }>,
    measure: Measure,
  ): void {
    for (const vexTuplet of vexTuplets) {
      try {
        vexTuplet.setContext(this.context!).draw()

        const tupletNotes = vexTuplet.getNotes() as StaveNote[]
        if (tupletNotes.length === 0) continue

        for (const [tupletId, { staveNotes: tStaveNotes, tuplet: tupletData }] of tupletStaveNoteMap) {
          if (!tStaveNotes.includes(tupletNotes[0])) continue

          const vt = vexTuplet as any
          const notes = vt.notes as StaveNote[]
          const firstNote = notes?.[0]
          const lastNote = notes?.[notes.length - 1]
          if (!firstNote || !lastNote) break

          const location = (vt.options?.location ?? 1) as 1 | -1
          const bracketed = vt.options?.bracketed ?? true

          // Compute stem Y extents across all notes in the tuplet
          let stemMinY = Infinity
          let stemMaxY = -Infinity
          for (const note of notes) {
            try {
              const stemExtents = note.getStemExtents?.()
              if (stemExtents) {
                stemMinY = Math.min(stemMinY, stemExtents.topY, stemExtents.baseY)
                stemMaxY = Math.max(stemMaxY, stemExtents.topY, stemExtents.baseY)
              }
            } catch (e) { /* ignore */ }
          }
          if (stemMinY === Infinity || stemMaxY === -Infinity) {
            for (const note of notes) {
              try {
                const noteBox = note.getBoundingBox()
                if (noteBox) {
                  stemMinY = Math.min(stemMinY, noteBox.getY())
                  stemMaxY = Math.max(stemMaxY, noteBox.getY() + noteBox.getH())
                }
              } catch (e) { /* ignore */ }
            }
          }

          const bracketPadding = 5
          const xStart = bracketed ? firstNote.getTieLeftX() - bracketPadding : firstNote.getStemX()
          const xEnd = bracketed ? lastNote.getTieRightX() + bracketPadding : lastNote.getStemX()
          const tupletWidth = xEnd - xStart

          // Position bracket above or below stems with a fixed gap
          const bracketGap = 10
          const totalHeight = 45
          const bracketY = location === 1
            ? stemMinY - bracketGap - totalHeight
            : stemMaxY + bracketGap

          const tupletGeometry: TupletGeometry = {
            x: xStart,
            y: bracketY,
            width: tupletWidth,
            bracketed,
            location,
            bracketLegLength: 10,
            bracketThickness: 1,
            bracketPadding,
            notationCenterX: xStart + tupletWidth / 2,
            textYOffset: vt.options?.textYOffset ?? 0,
            yOffset: vt.options?.yOffset ?? 0,
          }

          this.elementRegistry.add({
            type: 'tuplet',
            tupletId,
            measure: measure.number,
            startBeat: fracToNumber(tupletData.startBeat),
            numNotes: tupletData.numNotes,
            bbox: { x: xStart, y: bracketY, width: tupletWidth, height: totalHeight },
            tupletGeometry,
          })
          // Keep the VexFlow Tuplet so its own SVG group can be recolored for selection
          // (avoids a document-wide scan that bleeds into neighbouring systems).
          this.tupletObjectMap.set(tupletId, vexTuplet)
          break
        }
      } catch (e) {
        // Drawing or getBoundingBox may fail
      }
    }
  }

  private registerSlotElements(
    sortedSlots: ChordRest[],
    staveNotes: StaveNote[],
    measure: Measure,
  ): void {
    for (let si = 0; si < sortedSlots.length && si < staveNotes.length; si++) {
      const slot = sortedSlots[si]
      const staveNote = staveNotes[si]

      if (slot.type === 'rest') {
        try {
          const box = staveNote.getBoundingBox()
          if (box) {
            this.elementRegistry.add({
              type: 'rest',
              id: slot.id,
              measure: measure.number,
              beat: fracToNumber(slot.beat),
              duration: slot.duration,
              tupletId: slot.tupletId,
              bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
            })
            // Add rest to staveNoteMap so ties pointing to this rest can be rendered
            this.staveNoteMap.set(slot.id, { staveNote, noteIndex: 0 })
          }
        } catch (e) { /* getBoundingBox may fail */ }
      } else {
        try {
          const box = staveNote.getBoundingBox()
          if (box) {
            // Sort pitches low→high by MIDI to match VexFlow's internal key ordering
            const sortedPitches = [...slot.notes].sort(
              (a, b) => spellingToMidi(a.step, a.alter, a.octave) - spellingToMidi(b.step, b.alter, b.octave)
            )

            for (let keyIndex = 0; keyIndex < sortedPitches.length; keyIndex++) {
              const pitch = sortedPitches[keyIndex]
              const pitchMidi = spellingToMidi(pitch.step, pitch.alter, pitch.octave)

              this.elementRegistry.add({
                type: 'note',
                id: pitch.id,
                measure: measure.number,
                beat: fracToNumber(slot.beat),
                pitch: pitchMidi,
                duration: slot.duration,
                tupletId: slot.tupletId,
                bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
              })

              // keyIndex matches VexFlow's sorted pitch order
              this.staveNoteMap.set(pitch.id, { staveNote, noteIndex: keyIndex })

              // Articulations: register on the lowest-pitch note (index 0); data lives on chord
              if (keyIndex === 0 && slot.articulations?.length) {
                try {
                  const modifiers = staveNote.getModifiers()
                  // Modifiers were added in ARTICULATION_RENDER_ORDER, NOT slot order — so
                  // index the same sorted list, or the type↔glyph labels get swapped when a
                  // note has multiple articulations (breaking highlight, delete and flip).
                  const sortedArticulations = (slot.articulations ?? []).slice().sort(
                    (a, b) => ARTICULATION_RENDER_ORDER.indexOf(a) - ARTICULATION_RENDER_ORDER.indexOf(b)
                  )
                  let articulationIndex = 0
                  for (const modifier of modifiers) {
                    if (modifier.getCategory() === 'Articulation') {
                      const artBox = modifier.getBoundingBox()
                      if (artBox) {
                        this.elementRegistry.add({
                          type: 'articulation',
                          noteId: pitch.id,
                          articulationType: sortedArticulations[articulationIndex],
                          measure: measure.number,
                          beat: fracToNumber(slot.beat),
                          bbox: { x: artBox.x, y: artBox.y, width: artBox.w, height: artBox.h },
                        })
                      }
                      articulationIndex++
                    }
                  }
                } catch (e) { /* Articulation bounding box may not be available */ }
              }

              if (pitch.alter !== 0 || pitch.forceAccidental) {
                try {
                  const modifiers = staveNote.getModifiers()
                  for (const modifier of modifiers) {
                    if (modifier.getCategory() === 'Accidental') {
                      const accidental = modifier as Accidental
                      if ((accidental as any).index === keyIndex ||
                          (accidental as any).note_index === keyIndex ||
                          modifiers.filter(m => m.getCategory() === 'Accidental').indexOf(modifier) === keyIndex) {
                        const accBox = accidental.getBoundingBox()
                        if (accBox) {
                          const accStr = pitch.alter === 2 ? '##' : pitch.alter === 1 ? '#'
                            : pitch.alter === -1 ? 'b' : pitch.alter === -2 ? 'bb' : 'n'
                          this.elementRegistry.add({
                            type: 'accidental',
                            noteId: pitch.id,
                            measure: measure.number,
                            beat: fracToNumber(slot.beat),
                            pitch: pitchMidi,
                            accidentalType: accStr,
                            bbox: { x: accBox.x, y: accBox.y, width: accBox.w, height: accBox.h },
                          })
                        }
                        break
                      }
                    }
                  }
                } catch (e) { /* Accidental bounding box may not be available */ }
              }
            }
          }
        } catch (e) { /* getBoundingBox may fail */ }
      }
    }
  }

  /**
   * Register each rendered dynamic into the ElementRegistry (for hit-testing /
   * selection) using its Annotation's bounding box. Runs as a post-pass over the
   * measure's dynamics rather than inside the slot loop, so it covers dynamics
   * anchored to BOTH chords and rests uniformly. The registry entry carries only
   * id + bbox; kind/level/text are looked up from the model when needed.
   */
  private registerDynamics(measure: Measure): void {
    if (!measure.dynamics?.length) return
    for (const dyn of measure.dynamics) {
      const annotation = this.dynamicObjectMap.get(dyn.id)
      if (!annotation) continue
      try {
        // Use the rendered SVG bounds, not Annotation.getBoundingBox(): the modifier
        // width is zeroed (see buildDynamicAnnotation) so getBoundingBox would report
        // a 0-width box, breaking hit-testing. getBBox gives the true painted extent.
        // (Matches what layoutCoLocatedDynamics already uses.)
        const el = annotation.getSVGElement?.() as SVGGraphicsElement | undefined
        const box = el?.getBBox ? el.getBBox() : null
        if (box) {
          this.elementRegistry.add({
            type: 'dynamic',
            id: dyn.id,
            measure: measure.number,
            beat: fracToNumber(dyn.beat),
            bbox: { x: box.x, y: box.y, width: box.width, height: box.height },
          })
        }
      } catch (e) { /* getBBox may fail before layout in some envs */ }
    }
  }

  private registerBeams(beams: Beam[], measure: Measure): void {
    for (const beam of beams) {
      try {
        const box = beam.getBoundingBox()
        if (box) {
          this.elementRegistry.add({
            type: 'beam',
            measure: measure.number,
            bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
          })
        }
      } catch (e) { /* getBoundingBox may fail */ }
    }
  }

  private registerStaffAndGeometry(
    stave: Stave,
    measure: Measure,
    x: number,
    y: number,
    width: number,
    isFirstInLine: boolean,
    clef: Clef,
    hasClefChange: boolean = false,
    clefSegments?: ClefSegment[],
  ): void {
    try {
      const staveBox = stave.getBoundingBox()
      if (staveBox) {
        this.elementRegistry.add({
          type: 'staff',
          measure: measure.number,
          bbox: { x: staveBox.x, y: staveBox.y, width: staveBox.w, height: staveBox.h },
        })
      }

      const lineYPositions: [number, number, number, number, number] = [
        stave.getYForLine(0),
        stave.getYForLine(1),
        stave.getYForLine(2),
        stave.getYForLine(3),
        stave.getYForLine(4),
      ]
      this.elementRegistry.setStaffGeometry({
        measure: measure.number,
        lineYPositions,
        lineSpacing: lineYPositions[1] - lineYPositions[0],
        noteStartX: stave.getNoteStartX(),
        noteEndX: stave.getNoteEndX(),
        clef,
        clefSegments: clefSegments && clefSegments.length > 1 ? clefSegments : undefined,
      })
    } catch (e) { /* getBoundingBox or getYForLine may fail */ }

    // Register the opening clef (beat 0) when a clef glyph is drawn at the
    // measure start: at line starts (full clef) or mid-line clef changes (smaller
    // clef). Mid-measure (inline) clefs are registered separately after drawing.
    // beat 0 lets clef removal target the opening clef specifically.
    if (measure.number === 1 || isFirstInLine) {
      this.elementRegistry.add({
        type: 'clef',
        measure: measure.number,
        beat: 0,
        // The big line-start clef is anchored to the line and cannot be dragged.
        immovable: true,
        bbox: { x, y, width: LAYOUT_CONFIG.CLEF_WIDTH, height: LAYOUT_CONFIG.STAVE_HEIGHT },
      })
    } else if (hasClefChange) {
      this.elementRegistry.add({
        type: 'clef',
        measure: measure.number,
        beat: 0,
        bbox: { x, y, width: LAYOUT_CONFIG.CLEF_CHANGE_WIDTH, height: LAYOUT_CONFIG.STAVE_HEIGHT },
      })
    }

    if (this.drawsTimeSignature(measure)) {
      // Position after whatever clef glyph (if any) was drawn at the measure start.
      const clefOffset =
        measure.number === 1 || isFirstInLine
          ? LAYOUT_CONFIG.CLEF_WIDTH
          : hasClefChange
            ? LAYOUT_CONFIG.CLEF_CHANGE_WIDTH
            : 0
      this.elementRegistry.add({
        type: 'timeSignature',
        measure: measure.number,
        bbox: {
          x: x + clefOffset,
          y,
          width: LAYOUT_CONFIG.TIME_SIG_WIDTH,
          height: LAYOUT_CONFIG.STAVE_HEIGHT,
        },
      })
    }

    this.elementRegistry.add({
      type: 'barline',
      measure: measure.number,
      bbox: { x: x + width - 2, y, width: 4, height: LAYOUT_CONFIG.STAVE_HEIGHT },
    })
  }

  /**
   * Render the complete score
   * @param score - Score to render
   * @param ghostNote - Optional ghost note preview (rawX for smooth cursor following)
   * @returns true if ghost note was rendered, false if not (or no ghost note provided)
   */
  /**
   * Freeze/unfreeze the line layout. Freezing snapshots the current measure
   * widths and line assignments; while frozen, renderScore reuses that snapshot
   * so dragging a clef redraws the notes (re-pitched by the moved clef) without
   * reflowing the score. The snapshot is taken here (not in renderScore) because
   * clearCanvas() wipes measureLayoutInfo before each render.
   */
  setLayoutFrozen(frozen: boolean): void {
    this.frozenLayout = frozen && this.measureLayoutInfo.size > 0
      ? new Map(this.measureLayoutInfo)
      : null
  }

  /** Set/clear the clef currently being dragged (to keep a redundant one visible). */
  setDraggingClef(info: { measure: number; beat: Fraction } | null): void {
    this.draggingClef = info
  }

  /**
   * If a clef is being dragged within this measure AND it's redundant (equals the
   * clef in effect just before it, so it'll be removed on drop), return its beat
   * so it can be force-rendered while dragging. Otherwise undefined.
   */
  private ghostClefBeatFor(score: Score, measureNumber: number): Fraction | undefined {
    if (!this.draggingClef || this.draggingClef.measure !== measureNumber) return undefined
    const beat = this.draggingClef.beat
    const measure = score.measures.find(m => m.number === measureNumber)
    const change = measure?.clefs?.find(c => fracEq(c.beat, beat))
    if (!change) return undefined
    return change.clef === effectiveClefBefore(score, measureNumber, beat) ? beat : undefined
  }

  renderScore(score: Score, ghostNote?: GhostNote): boolean {
    if (!this.context || !this.renderer) {
      throw new Error('Renderer not initialized. Call initialize() first.')
    }

    // Always clear before rendering to prevent accumulation
    this.clear()

    // Use layout configuration
    const margin = LAYOUT_CONFIG.MARGIN
    const staveHeight = LAYOUT_CONFIG.STAVE_HEIGHT
    const verticalSpacing = LAYOUT_CONFIG.VERTICAL_SPACING
    const containerWidth = LAYOUT_CONFIG.CONTAINER_WIDTH

    // Resolve the clef in effect at each measure (handles per-measure changes)
    const effectiveClefs = this.computeEffectiveClefs(score)

    // Calculate proportional widths for all measures (or reuse the frozen layout).
    // Copy the frozen snapshot so the next clear() doesn't wipe it (same Map ref).
    const measureWidths = this.frozenLayout
      ? new Map(this.frozenLayout)
      : this.calculateMeasureWidths(score, effectiveClefs)
    // Store for use in tie rendering (to determine which line each measure is on)
    this.measureLayoutInfo = measureWidths

    // Find the number of lines from the calculated widths
    let maxLine = 0
    for (const info of measureWidths.values()) {
      maxLine = Math.max(maxLine, info.lineNumber)
    }
    const numLines = maxLine + 1
    const totalHeight = numLines * (staveHeight + verticalSpacing) + margin * 2

    // Check if SVG exists (should always exist after initialization)
    const svg = this.getSVGElement()
    if (!svg) {
      throw new Error('SVG element not found. Renderer may not be properly initialized.')
    }

    // Get current SVG size
    const currentWidth = parseInt(svg.getAttribute('width') || '0')
    const currentHeight = parseInt(svg.getAttribute('height') || '0')

    // Only resize if dimensions changed (following VexFlow best practice)
    if (currentWidth !== containerWidth || currentHeight !== totalHeight) {
      this.renderer!.resize(containerWidth, totalHeight)
    }

    // Render each measure with calculated widths
    let currentLine = -1
    let currentX = margin

    score.measures.forEach((measure) => {
      const widthInfo = measureWidths.get(measure.number)
      if (!widthInfo) {
        console.error(`No width info for measure ${measure.number}`)
        return
      }

      // Check if we've moved to a new line
      if (widthInfo.lineNumber !== currentLine) {
        currentLine = widthInfo.lineNumber
        currentX = margin
      }

      const y = margin + currentLine * (staveHeight + verticalSpacing)
      const isFirstInLine = currentX === margin
      const clef = effectiveClefs.get(measure.number) || 'treble'
      const prevEndClef = measure.number > 1 ? measureEndingClef(score, measure.number - 1) : undefined
      const hasClefChange = prevEndClef !== undefined && clef !== prevEndClef
      const ghostClefBeat = this.ghostClefBeatFor(score, measure.number)

      this.renderMeasure(measure, currentX, y, widthInfo.finalWidth, isFirstInLine, clef, hasClefChange, widthInfo.cautionaryEndClef, ghostClefBeat, widthInfo.cautionaryEndTimeSig)

      currentX += widthInfo.finalWidth
    })

    // Bundle this render's per-render state (references to the instance-field maps —
    // see RenderPass for the lifetime contract) for the extracted sub-renderers.
    const pass = this.createRenderPass()

    // Render ties between measures after all measures are drawn
    this.renderTies(pass, score)

    // Render phrasing slurs (top-level spans) after ties, in the same post-measure pass
    this.renderSlurs(pass, score)

    // Render ghost note AFTER all measures (as an overlay)
    let ghostNoteRendered = false
    if (ghostNote) {
      // For ghost note, we need to find the measure's actual position
      const ghostMeasureInfo = measureWidths.get(ghostNote.measure)
      if (ghostMeasureInfo) {
        ghostNoteRendered = this.renderGhostNoteWithDynamicWidths(
          ghostNote,
          score,
          measureWidths,
          margin,
          staveHeight,
          verticalSpacing
        )
      }
    }

    return ghostNoteRendered
  }

  private renderGhostNoteWithDynamicWidths(
    ghostNote: GhostNote,
    score: Score,
    measureWidths: Map<number, MeasureWidthInfo>,
    margin: number,
    staveHeight: number,
    verticalSpacing: number
  ): boolean {
    try {
      const measure = score.measures.find(m => m.number === ghostNote.measure)
      if (!measure) {
        console.warn('Measure not found for ghost note:', ghostNote.measure)
        return false
      }

      const widthInfo = measureWidths.get(ghostNote.measure)
      if (!widthInfo) {
        console.warn('Width info not found for ghost note measure:', ghostNote.measure)
        return false
      }

      // Guard against a malformed spelling (no step) — skip the preview rather
      // than crash the whole score render.
      if (ghostNote.step === undefined) {
        return false
      }

      // Calculate X position by summing widths of previous measures on the same line
      let measureX = margin
      for (const m of score.measures) {
        if (m.number === ghostNote.measure) break
        const mInfo = measureWidths.get(m.number)
        if (mInfo && mInfo.lineNumber === widthInfo.lineNumber) {
          measureX += mInfo.finalWidth
        } else if (mInfo && mInfo.lineNumber < widthInfo.lineNumber) {
          measureX = margin
        }
      }

      const measureY = margin + widthInfo.lineNumber * (staveHeight + verticalSpacing)
      const staveWidth = widthInfo.finalWidth
      const effectiveClefs = this.computeEffectiveClefs(score)
      const openingClef: Clef = effectiveClefs.get(ghostNote.measure) || 'treble'
      // Match the real stave: only redraw the clef when it changes across the
      // barline (vs the previous measure's ending clef), not opening-to-opening.
      const prevEndClef = ghostNote.measure > 1 ? measureEndingClef(score, ghostNote.measure - 1) : undefined
      const hasClefChange = prevEndClef !== undefined && openingClef !== prevEndClef
      // The ghost note must be positioned by the clef in effect at its beat
      // (mid-measure changes), not just the measure's opening clef.
      const clef: Clef = effectiveClefAt(score, ghostNote.measure, beatToFrac(ghostNote.beat))

      const tempStave = new Stave(measureX, measureY, staveWidth)
      const isFirstInLine = measureX === margin
      if (ghostNote.measure === 1 || isFirstInLine) {
        tempStave.addClef(openingClef)
      } else if (hasClefChange) {
        tempStave.addClef(openingClef, 'small')
      }
      if (this.drawsTimeSignature(measure)) {
        tempStave.addTimeSignature(`${measure.timeSignature.numerator}/${measure.timeSignature.denominator}`)
      }
      // Match the real stave's note area so the ghost note aligns with where the
      // committed note will land (a cautionary end clef narrows the note area).
      if (widthInfo.cautionaryEndClef) {
        tempStave.addEndClef(widthInfo.cautionaryEndClef, 'small')
      }
      if (widthInfo.cautionaryEndTimeSig) {
        tempStave.addEndTimeSignature(`${widthInfo.cautionaryEndTimeSig.numerator}/${widthInfo.cautionaryEndTimeSig.denominator}`)
      }
      tempStave.setContext(this.context!)

      const vexNote = spellingToVexflowKey(ghostNote.step, ghostNote.alter, ghostNote.octave)
      const vexDuration = this.convertDuration(ghostNote.duration as any, ghostNote.dots || 0)

      // Stem direction — same diatonic approach as createStaveNotesFromSlots.
      // Include any existing notes at the same beat so the ghost matches the chord's stem.
      const middleDiatonic = middleLineDiatonicPos(clef)
      let stemDirection = -1  // default down; middle-line notes follow this convention
      let maxDist = 0
      const checkDiatonic = (step: PitchStep, octave: number) => {
        const dPos = spellingDiatonicPos(step, octave)
        const dist = Math.abs(dPos - middleDiatonic)
        if (dist > maxDist) { maxDist = dist; stemDirection = dPos >= middleDiatonic ? -1 : 1 }
      }
      for (const slot of measure.slots) {
        if (slot.type === 'chord' && Math.abs(fracToNumber(slot.beat) - ghostNote.beat) < 0.001) {
          for (const p of slot.notes) checkDiatonic(p.step, p.octave)
        }
      }
      checkDiatonic(ghostNote.step, ghostNote.octave)

      const staveNote = new StaveNote({
        keys: [vexNote],
        duration: vexDuration,
        clef,
        autoStem: false,
      })
      staveNote.setStemDirection(stemDirection)

      const dots = ghostNote.dots || 0
      for (let d = 0; d < dots; d++) {
        Dot.buildAndAttach([staveNote], { all: true })
      }

      if (ghostNote.alter !== 0) {
        const sign = ghostNote.alter === 2 ? '##' : ghostNote.alter === 1 ? '#' : ghostNote.alter === -1 ? 'b' : 'bb'
        staveNote.addModifier(new Accidental(sign), 0)
      }

      if (ghostNote.articulations?.length) {
        const articulationVexCodes: Record<ArticulationType, string> = { accent: 'a>', staccato: 'a.', tenuto: 'a-' }
        const articulationPosition = stemDirection === 1 ? Modifier.Position.BELOW : Modifier.Position.ABOVE
        const sortedGhostArticulations = ghostNote.articulations.slice().sort(
          (a, b) => ARTICULATION_RENDER_ORDER.indexOf(a) - ARTICULATION_RENDER_ORDER.indexOf(b)
        )
        for (const art of sortedGhostArticulations) {
          staveNote.addModifier(new Articulation(articulationVexCodes[art]).setPosition(articulationPosition), 0)
        }
      }

      // Meter-aware rest fill around the ghost note (same engine as the model).
      // Positions are exact Fractions in quarter-note beats.
      const meter = getMeterInfo(measure.timeSignature)
      const noteStart = beatToFrac(ghostNote.beat)
      const noteEnd = fracAdd(noteStart, durationToFraction(ghostNote.duration, ghostNote.dots || 0))

      const makeRest = (r: RestSlot) => {
        const sn = new StaveNote({ keys: ['b/4'], duration: durationToVexflow(r.duration, r.dots) + 'r' })
        if (r.dots) Dot.buildAndAttach([sn], { all: true })
        return sn
      }

      const tickables: any[] = []
      for (const r of fillRests(fracCreate(0, 1), noteStart, meter)) tickables.push(makeRest(r))
      tickables.push(staveNote)
      for (const r of fillRests(noteEnd, measureCapacityFrac(measure), meter)) tickables.push(makeRest(r))

      // VexFlow wants the literal time signature, not quarter-beats.
      const voice = new Voice({
        numBeats: measure.timeSignature.numerator,
        beatValue: measure.timeSignature.denominator,
      }).setMode(Voice.Mode.SOFT)
      voice.addTickables(tickables)

      const noteAreaWidth = tempStave.getNoteEndX() - tempStave.getNoteStartX()
      const rightPadding = 15
      const formatWidth = noteAreaWidth > 0 ? Math.max(noteAreaWidth - rightPadding, 50) : staveWidth - 100
      new Formatter().joinVoices([voice]).format([voice], formatWidth)

      const svg = this.getSVGElement()
      if (!svg) {
        console.error('SVG element not found for ghost note')
        return false
      }

      staveNote.setStave(tempStave)

      let targetShiftX: number | null = null
      if (ghostNote.rawX !== undefined) {
        try {
          const noteX = staveNote.getAbsoluteX()
          targetShiftX = ghostNote.rawX - noteX
        } catch (e) {
          // getAbsoluteX might not be available before draw
        }
      }

      const childrenBefore = svg.children.length
      staveNote.setContext(this.context!).draw()

      const newElements: Element[] = []
      for (let i = childrenBefore; i < svg.children.length; i++) {
        newElements.push(svg.children[i])
      }

      if (newElements.length > 0 && targetShiftX !== null) {
        const ghostGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        ghostGroup.setAttribute('class', 'ghost-note-group')
        ghostGroup.setAttribute('transform', `translate(${targetShiftX}, 0)`)
        for (const element of newElements) {
          svg.removeChild(element)
        }
        for (const element of newElements) {
          ghostGroup.appendChild(element)
        }
        svg.appendChild(ghostGroup)
      }

      const applyGhostStyle = (element: Element) => {
        const tagName = element.tagName.toLowerCase()
        if (tagName === 'path' || tagName === 'ellipse' || tagName === 'circle') {
          element.setAttribute('fill', '#3B82F6')
          element.setAttribute('stroke', '#2563EB')
          element.setAttribute('opacity', '0.7')
          const currentStyle = element.getAttribute('style') || ''
          element.setAttribute('style', currentStyle + '; fill: #3B82F6 !important; stroke: #2563EB !important; opacity: 0.7 !important;')
        } else if (tagName === 'text') {
          element.setAttribute('fill', '#3B82F6')
          element.setAttribute('opacity', '0.7')
          const currentStyle = element.getAttribute('style') || ''
          element.setAttribute('style', currentStyle + '; fill: #3B82F6 !important; opacity: 0.7 !important;')
        } else if (tagName === 'line') {
          element.setAttribute('stroke', '#2563EB')
          element.setAttribute('opacity', '0.7')
          const currentStyle = element.getAttribute('style') || ''
          element.setAttribute('style', currentStyle + '; stroke: #2563EB !important; opacity: 0.7 !important;')
        }
        for (let i = 0; i < element.children.length; i++) {
          applyGhostStyle(element.children[i])
        }
      }

      for (let i = childrenBefore; i < svg.children.length; i++) {
        applyGhostStyle(svg.children[i])
      }

      return true
    } catch (error) {
      console.error('Could not render ghost note with dynamic widths:', error)
      return false
    }
  }

  /**
   * Determine tie direction for a pitch within a chord.
   * Returns: -1 for UP (top note), 1 for DOWN (bottom note).
   * @param pitch - MIDI pitch of the note being tied
   * @param beat - Beat position of the chord containing this pitch
   * @param measure - The measure to look up chord info in
   */
  private getTieDirection(notePitch: import('@/types/music').NotePitch, beat: Fraction, measure: Measure): number | undefined {
    // An explicit override (set by flipping the tie with `x`) wins over auto placement.
    if (notePitch.tieDirection !== undefined) return notePitch.tieDirection

    // Find the chord slot at this beat
    const chordAtBeat = measure.slots.find(
      s => s.type === 'chord' && fracEq(s.beat, beat)
    ) as Chord | undefined

    const thisDiatonic = spellingDiatonicPos(notePitch.step, notePitch.octave)

    if (!chordAtBeat || chordAtBeat.notes.length <= 1) {
      // Single note — tie direction based on diatonic distance from middle line (treble B4=34)
      const middleDiatonic = middleLineDiatonicPos('treble')
      return thisDiatonic >= middleDiatonic ? -1 : 1
    }

    // Sort all chord notes by diatonic staff position
    const sortedDiatonics = chordAtBeat.notes
      .map(n => spellingDiatonicPos(n.step, n.octave))
      .sort((a, b) => a - b)
    const lowestDiatonic  = sortedDiatonics[0]
    const highestDiatonic = sortedDiatonics[sortedDiatonics.length - 1]

    if (thisDiatonic === highestDiatonic) return -1  // Top note: tie curves UP
    if (thisDiatonic === lowestDiatonic)  return 1   // Bottom note: tie curves DOWN

    // Middle note: follow nearest outer voice
    const distToTop    = highestDiatonic - thisDiatonic
    const distToBottom = thisDiatonic    - lowestDiatonic
    return distToTop <= distToBottom ? -1 : 1
  }

  /**
   * Draw a tie arc where both endpoints share the source note's Y position.
   * Ties always connect the same pitch, so the arc is horizontally flat with its
   * apex at the X midpoint. Routes through the shared cubic `drawCurveArc` (same
   * `Curve.renderCurve` path as slurs); flat endpoints + symmetric `cps` keep the
   * peak centered, while tie-specific BOW/THICKNESS reproduce the old hand-drawn
   * quadratic look. Returns the bounding box of the drawn arc, or null on failure.
   */
  private drawFlatTie(
    pass: RenderPass,
    fromInfo: { staveNote: StaveNote; noteIndex: number },
    toInfo: { staveNote: StaveNote; noteIndex: number },
    direction: number,
  ): { x: number; y: number; width: number; height: number } | null {
    if (!pass.context) return null
    try {
      const firstX = fromInfo.staveNote.getTieRightX()
      const lastX = toInfo.staveNote.getTieLeftX()
      const ys = fromInfo.staveNote.getYs()
      const y = ys[fromInfo.noteIndex] ?? ys[0]
      if (y === undefined || isNaN(y)) return null

      // Flat endpoints, both lifted off the notehead by TIE_LIFT. Symmetric control
      // heights (same Y, dy=0) → the cubic's peak lands exactly at the X midpoint.
      const tieY = y + VexFlowRenderer.TIE_LIFT * direction
      const p0 = { x: firstX, y: tieY }
      const p1 = { x: lastX, y: tieY }
      const bow = VexFlowRenderer.TIE_BOW
      const cps: [{ x: number; y: number }, { x: number; y: number }] = [
        { x: 0, y: bow },
        { x: 0, y: bow },
      ]
      const arc = this.drawCurveArc(
        pass, p0, p1, cps, direction, VexFlowRenderer.TIE_THICKNESS,
        fromInfo.staveNote, toInfo.staveNote,
      )
      return arc.bbox
    } catch (e) {
      console.error('Could not draw flat tie:', e)
      return null
    }
  }

  /**
   * Render ties between notes that have tiedTo/tiedFrom properties
   */
  private renderTies(pass: RenderPass, score: Score): void {
    if (!pass.context) return

    // Track which ties we've already processed to avoid duplicates
    const processedTies = new Set<string>()

    // Find all notes with ties by iterating chord slots directly
    for (const measure of score.measures) {
      for (const slot of measure.slots) {
        if (slot.type !== 'chord') continue
        for (const pitch of slot.notes) {
          if (!pitch.tiedTo) continue

          const tieKey = `${pitch.id}->${pitch.tiedTo}`
          if (processedTies.has(tieKey)) continue
          processedTies.add(tieKey)

          const fromInfo = pass.staveNoteMap.get(pitch.id)
          const toInfo = pass.staveNoteMap.get(pitch.tiedTo)

          if (fromInfo?.staveNote && toInfo?.staveNote) {
            try {
              const fromMeasure = slot.measure
              // Find the measure containing the target pitch
              let toMeasure: number | undefined
              outer: for (const m of score.measures) {
                for (const s of m.slots) {
                  if (s.type === 'chord' && s.notes.some(p => p.id === pitch.tiedTo)) {
                    toMeasure = m.number
                    break outer
                  }
                  if (s.type === 'rest' && s.id === pitch.tiedTo) {
                    toMeasure = m.number
                    break outer
                  }
                }
              }

              const fromLayout = pass.measureLayoutInfo.get(fromMeasure)
              const toLayout = toMeasure ? pass.measureLayoutInfo.get(toMeasure) : undefined
              const fromLine = fromLayout?.lineNumber ?? 0
              const toLine = toLayout?.lineNumber ?? 0
              const sameLine = fromLine === toLine

              const tieDirection = this.getTieDirection(pitch, slot.beat, measure)
              // note alias for registry callbacks below
              const note = { id: pitch.id, tiedTo: pitch.tiedTo, measure: fromMeasure }

              if (sameLine) {
                // Same line: draw flat arc anchored at the source note's Y
                // (ties always connect the same pitch, so both endpoints share the same Y)
                const bbox = this.drawFlatTie(pass, fromInfo, toInfo, tieDirection ?? 1)
                if (bbox) {
                  pass.elementRegistry.add({
                    type: 'tie',
                    fromNoteId: note.id,
                    toNoteId: note.tiedTo!,
                    fromMeasure: fromMeasure,
                    toMeasure: toMeasure!,
                    tieDirection: tieDirection ?? 1,
                    bbox,
                  })
                }
              } else {
                // Different lines (line break): two partial ties
                // First partial: from note to end of line
                const firstPartialTie = new StaveTie({
                  firstNote: fromInfo.staveNote,
                  firstIndexes: [fromInfo.noteIndex],
                })
                if (tieDirection !== undefined) {
                  firstPartialTie.setDirection(tieDirection)
                }
                firstPartialTie.setContext(pass.context!).draw()

                // Register first partial tie
                try {
                  const box = firstPartialTie.getBoundingBox()
                  if (box) {
                    pass.elementRegistry.add({
                      type: 'tie',
                      fromNoteId: note.id,
                      toNoteId: note.tiedTo!,
                      fromMeasure: fromMeasure,
                      toMeasure: toMeasure!,
                      isPartial: true,
                      partialType: 'end', // ends at line break
                      tieDirection: tieDirection ?? 1,
                      bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
                    })
                  }
                } catch (e) {
                  // getBoundingBox may fail
                }

                // Second partial: from start of line to note
                const secondPartialTie = new StaveTie({
                  lastNote: toInfo.staveNote,
                  lastIndexes: [toInfo.noteIndex],
                })
                if (tieDirection !== undefined) {
                  secondPartialTie.setDirection(tieDirection)
                }
                secondPartialTie.setContext(pass.context!).draw()

                // Register second partial tie
                try {
                  const box = secondPartialTie.getBoundingBox()
                  if (box) {
                    pass.elementRegistry.add({
                      type: 'tie',
                      fromNoteId: note.id,
                      toNoteId: note.tiedTo!,
                      fromMeasure: fromMeasure,
                      toMeasure: toMeasure!,
                      isPartial: true,
                      partialType: 'start', // starts at line break
                      tieDirection: tieDirection ?? 1,
                      bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
                    })
                  }
                } catch (e) {
                  // getBoundingBox may fail
                }
              }
            } catch (e) {
              console.error('Could not render tie:', e)
            }
          }
        }
      }
    }
  }

  /** Measure number containing the chord-head / rest id, or undefined if absent. */
  private measureOfNoteId(score: Score, noteId: string): number | undefined {
    for (const m of score.measures) {
      for (const s of m.slots) {
        if (s.type === 'chord' && s.notes.some(p => p.id === noteId)) return m.number
        if (s.type === 'rest' && s.id === noteId) return m.number
      }
    }
    return undefined
  }

  /** Vertical geometry shared by all slur arcs. */
  private static readonly SLUR_LIFT = 10   // gap between the notehead and the arc's endpoints
  private static readonly SLUR_ARC = 14    // cross-system half-arc apex rise above its endpoint line
  // Default cubic control-point bow height (the two symmetric `cps` deltas fed to
  // Curve.renderCurve). A cubic's peak deviation is 0.75·H, so H≈9.3 reproduces the
  // old quadratic's LIFT + ARC/2 = 17px peak. Phase 6 will let a slur override this.
  private static readonly SLUR_BOW = 9.3        // base arch height (short slurs ≈ old look)
  private static readonly SLUR_BOW_PER_PX = 0.06 // arch height grows with horizontal span…
  private static readonly SLUR_BOW_MAX = 22      // …up to this ceiling (Gould: longer → taller, capped)
  private static readonly SLUR_NEST_GAP = 10     // extra bow height per nesting level (concentric slurs)
  private static readonly SLUR_THICKNESS = 1.5  // Curve.renderCurve return-pass offset (mid swell)
  private static readonly SLUR_OUTLINE = 1      // stroke width pinned around the curve (sharp tips)

  // Tie geometry (same-line, flat). A tie joins one pitch, so both endpoints share a Y
  // and the apex sits at the X midpoint. These reproduce the old hand-drawn quadratic
  // (drawFlatTie: yShift 7, cp1 8, cp2 12) on the shared cubic path: a cubic's symmetric
  // peak is 0.75·H, so BOW 5.3 → ~4px apex (old 0.5·cp1) and THICKNESS 2.7 → ~2px belly
  // (old 0.5·(cp2−cp1)). Kept fuller than a slur — ties read heavier and hug the head.
  private static readonly TIE_LIFT = 7        // gap between the notehead and the flat tie endpoints
  private static readonly TIE_BOW = 5.3       // cubic control height → ~4px apex above the endpoint line
  private static readonly TIE_THICKNESS = 2.7 // belly swell → ~2px at center, pinching to the tips

  /**
   * Compute the cubic `cps` (control-point deltas for `Curve.renderCurve`) that bow the
   * arc by `SLUR_BOW` **vertically above the line between its endpoints** — the two control
   * points stay horizontally centered (no sideways shift) and lift straight up, *following*
   * the chord's slope. This is the engraving default (MuseScore: "slight contour asymmetry,
   * avoid forced tilt"):
   *  - flat / unison → symmetric `[{0,BOW},{0,BOW}]` (perfectly even);
   *  - small interval / close notes → full height, gentle lean, no sideways skew;
   *  - wide leap → clean arch parallel to the contour, no hook and no lopsided air-gap.
   *
   * An earlier *perpendicular* offset shifted the control points sideways by `∝ dy/len`,
   * which blew up for closely-spaced steps (seconds went flat-and-skewed) — hence the
   * vertical-above-chord-line formula here.
   *
   * `renderCurve` places each control point at `(endpointX ± dx/4, endpointY + cp.y·dir)`;
   * we target the chord line at 25%/75% lifted by `BOW`, then invert to recover the deltas.
   */
  /**
   * Stem-aware slur endpoint Y for one anchor note (Gould): if the slur sits on the
   * **notehead side** (opposite the stems) it attaches at the notehead; if it sits on
   * the **stem side** (same side as the stems) it attaches at the **stem tip** instead,
   * so the arc springs from the stem end rather than crossing it. `direction` is the
   * slur's side (-1 above / +1 below); the note's own `getStemDirection()` (1 up / -1
   * down) decides which side the stem is on. Falls back to the notehead if there's no
   * usable stem extent (e.g. whole notes).
   */
  private slurEndpointY(staveNote: StaveNote, noteIndex: number, direction: number): number {
    const ys = staveNote.getYs()
    const headY = ys[noteIndex] ?? ys[0]
    const stemUp = (staveNote.getStemDirection?.() ?? -1) === 1
    const slurAbove = direction === -1
    if (slurAbove === stemUp) {
      // Slur is on the stem side → attach at the stem tip.
      const tipY = staveNote.getStemExtents?.()?.topY
      if (tipY !== undefined && !isNaN(tipY)) return tipY
    }
    return headY
  }

  private slurArchCps(
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    direction: number,
    extraHeight = 0,
  ): [{ x: number; y: number }, { x: number; y: number }] {
    const dy = p1.y - p0.y
    // Arch height grows with horizontal span (Gould/MuseScore: a longer slur arcs higher),
    // floored at the base bow so seconds stay modest and capped so long slurs don't balloon.
    // `extraHeight` lifts an outer slur clear of the slur(s) nested inside it (Phase 8).
    const span = Math.abs(p1.x - p0.x)
    const H = Math.min(
      VexFlowRenderer.SLUR_BOW + span * VexFlowRenderer.SLUR_BOW_PER_PX,
      VexFlowRenderer.SLUR_BOW_MAX,
    ) + extraHeight
    return [
      { x: 0, y: H + 0.25 * dy * direction },
      { x: 0, y: H - 0.25 * dy * direction },
    ]
  }

  /**
   * Render phrasing slurs from {@link Score.slurs}. Each slur is anchored to a
   * start/end head id; both resolve through `staveNoteMap` to their containing
   * chord's StaveNote (a slur arcs over the whole event, not one pitch).
   *
   * Same-line spans draw one arc. Cross-system spans (endpoints on different lines)
   * draw **two half-arcs** (Gould / Sibelius): the first trails off the right edge
   * of the start note's system, the second leads in from the left edge of the end
   * note's system. Each slur (and both its partials) is wrapped in one
   * `<g class="vf-slur">` group for scoped highlight, and registered in the
   * ElementRegistry with sampled arc `points` for proximity hit-testing.
   */
  private renderSlurs(pass: RenderPass, score: Score): void {
    if (!pass.context || !score.slurs) return

    const LIFT = VexFlowRenderer.SLUR_LIFT
    const ARC = VexFlowRenderer.SLUR_ARC
    // Nesting level per slur → extra bow height so concentric slurs don't collide.
    const nestDepths = slurNestDepths(score)

    for (const slur of score.slurs) {
      const fromInfo = pass.staveNoteMap.get(slur.startNoteId)
      const toInfo = pass.staveNoteMap.get(slur.endNoteId)
      if (!fromInfo?.staveNote || !toInfo?.staveNote) continue

      const fromMeasure = this.measureOfNoteId(score, slur.startNoteId)
      const toMeasure = this.measureOfNoteId(score, slur.endNoteId)
      if (fromMeasure === undefined || toMeasure === undefined) continue

      const fromLine = pass.measureLayoutInfo.get(fromMeasure)?.lineNumber ?? 0
      const toLine = pass.measureLayoutInfo.get(toMeasure)?.lineNumber ?? 0

      // Placement (direction -1 = arc above the notes, +1 = below):
      //  - explicit `placement` override always wins;
      //  - otherwise follow the stems, notehead-side (Gould): stems up → slur below,
      //    stems down → slur above. VexFlow getStemDirection() is 1 (up) / -1 (down),
      //    which maps directly onto our +1 (below) / -1 (above).
      const autoDir = (fromInfo.staveNote.getStemDirection?.() ?? -1) === 1 ? 1 : -1
      const direction = slur.placement === 'below' ? 1
        : slur.placement === 'above' ? -1
        : autoDir

      // Endpoint anchor Ys — stem-aware (Gould): a slur on the NOTEHEAD side attaches at
      // the notehead; on the STEM side it attaches at the stem tip. Each endpoint uses
      // its own note's stem, so a flipped (stem-side) slur springs from the stem tips.
      const fromY = this.slurEndpointY(fromInfo.staveNote, fromInfo.noteIndex, direction)
      const toY = this.slurEndpointY(toInfo.staveNote, toInfo.noteIndex, direction)
      if (fromY === undefined || toY === undefined || isNaN(fromY) || isNaN(toY)) continue

      const registerPartial = (
        half: { bbox: { x: number; y: number; width: number; height: number }; points: { x: number; y: number }[] },
        partialType?: 'start' | 'end',
        extra?: Partial<ElementInfo>,
      ) => pass.elementRegistry.add({
        type: 'slur', id: slur.id, fromNoteId: slur.startNoteId, toNoteId: slur.endNoteId,
        fromMeasure, toMeasure, bbox: half.bbox, points: half.points, slurDirection: direction,
        ...(partialType ? { isPartial: true, partialType } : {}),
        ...extra,
      })

      try {
        // One SVG group per slur (both partials live inside it) so the selection
        // highlight can recolor exactly this slur without a bbox path-scan.
        const group = pass.context.openGroup?.('vf-slur', `vf-slur-${slur.id}`) as SVGGElement | undefined

        const fromNote = fromInfo.staveNote
        const toNote = toInfo.staveNote
        // Outer slurs (those enclosing nested slurs) arch higher so concentric arcs
        // don't collide. A manual `cps` shape opts out — the user controls that height.
        const nestLift = (nestDepths.get(slur.id) ?? 0) * VexFlowRenderer.SLUR_NEST_GAP

        if (fromLine === toLine) {
          // Same line: a single arc from the start note to the end note.
          const firstX = fromNote.getTieRightX()
          const lastX = toNote.getTieLeftX()
          const startY = fromY + LIFT * direction
          const endY = toY + LIFT * direction
          const p0 = { x: firstX, y: startY }
          const p1 = { x: lastX, y: endY }
          // A user-edited shape (slur.cps) overrides the auto arch; absent → auto.
          const cps = slur.cps ?? this.slurArchCps(p0, p1, direction, nestLift)
          const arc = this.drawCurveArc(pass, p0, p1, cps, direction, VexFlowRenderer.SLUR_THICKNESS, fromNote, toNote)
          // Store the on-screen control points + endpoint geometry so a selected
          // slur can show draggable handles (Phase 7). Same-line only — a split slur
          // shares one cps, so it gets no handles.
          registerPartial(arc, undefined, {
            controlPoints: [arc.c0, arc.c1],
            slurEndpoints: { p0, p1, direction },
          })
        } else {
          // Cross-system: two half-arcs.
          const fromStave = fromNote.getStave()
          const toStave = toNote.getStave()
          if (fromStave && toStave) {
            // First (trailing) half: from the start note rising to the system's right edge.
            const firstX = fromNote.getTieRightX()
            const rightEdge = fromStave.getNoteEndX()
            const startY = fromY + LIFT * direction
            const apex1 = startY + ARC * direction
            const h1p0 = { x: firstX, y: startY }
            const h1p1 = { x: rightEdge, y: apex1 }
            registerPartial(
              this.drawCurveArc(pass, h1p0, h1p1, this.slurArchCps(h1p0, h1p1, direction, nestLift), direction, VexFlowRenderer.SLUR_THICKNESS, fromNote, toNote),
              'end',
            )
            // Second (leading) half: from the next system's left edge down into the end note.
            const lastX = toNote.getTieLeftX()
            const leftEdge = toStave.getNoteStartX()
            const endY = toY + LIFT * direction
            const apex2 = endY + ARC * direction
            const h2p0 = { x: leftEdge, y: apex2 }
            const h2p1 = { x: lastX, y: endY }
            registerPartial(
              this.drawCurveArc(pass, h2p0, h2p1, this.slurArchCps(h2p0, h2p1, direction, nestLift), direction, VexFlowRenderer.SLUR_THICKNESS, fromNote, toNote),
              'start',
            )
          }
        }

        pass.context.closeGroup?.()
        if (group) pass.slurGroupMap.set(slur.id, group)
      } catch (e) {
        console.error('Could not render slur:', e)
      }
    }
  }

  /**
   * Draw a curved arc (slur **or** tie) as a cubic Bézier via VexFlow's
   * `Curve.renderCurve`, driven by **our own** endpoint geometry (we never call
   * `Curve.draw()`, which would re-derive endpoints from stems and discard our
   * per-chord-head Ys / system-break geometry). Used for the same-line slur arc,
   * each cross-system slur half, and the same-line (flat) tie.
   *
   * `cps` are the two control-point deltas (the editable handle data); `direction`
   * is -1 (above) / +1 (below). `thickness` is the belly swell — `renderCurve`
   * strokes a forward pass at `cp.y` and a return pass at `cp.y + thickness`, so the
   * fill bows out by `thickness` at center and pinches to a point at each endpoint
   * (slurs pass a thin SLUR_THICKNESS, ties a fuller TIE_THICKNESS). We pass
   * `xShift:0`/`yShift:0` so `p0`/`p1` (which already fold in the LIFT) are exact.
   * `renderCurve` strokes **and** fills, so each emitted `<path>` carries both — the
   * selection highlight must override both (see HighlightController).
   *
   * Returns the bbox plus sampled cubic points for arc-proximity hit-testing. The
   * sampling mirrors `renderCurve`'s internal control-point math (`curve.js`) so the
   * hit geometry matches the drawn path exactly.
   */
  private drawCurveArc(
    pass: RenderPass,
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    cps: [{ x: number; y: number }, { x: number; y: number }],
    direction: number,
    thickness: number,
    fromNote: StaveNote,
    toNote: StaveNote,
  ): { bbox: { x: number; y: number; width: number; height: number }; points: { x: number; y: number }[]; c0: { x: number; y: number }; c1: { x: number; y: number } } {
    const curve = new Curve(fromNote, toNote, {
      cps,
      thickness,
      xShift: 0,
      yShift: 0,
    })
    curve.setContext(pass.context)
    // renderCurve strokes the body with the context's *current* line width — left thick by
    // the preceding beam/stem passes, which blunts the curve's tapered tips and over-weights
    // it. Pin a thin slur outline so the fill's natural taper (it pinches to a point at each
    // endpoint) reads as a proper slur. save/restore so we don't leak the width to later draws.
    pass.context.save?.()
    pass.context.setLineWidth?.(VexFlowRenderer.SLUR_OUTLINE)
    curve.renderCurve({ firstX: p0.x, firstY: p0.y, lastX: p1.x, lastY: p1.y, direction })
    pass.context.restore?.()

    // Mirror renderCurve's control-point math (xShift/yShift = 0 → endpoints are exact)
    // to reconstruct the cubic for hit-testing. controlPointSpacing = (lastX-firstX)/(n+2).
    const spacing = (p1.x - p0.x) / (cps.length + 2)
    const c0 = { x: p0.x + spacing + cps[0].x, y: p0.y + cps[0].y * direction }
    const c1 = { x: p1.x - spacing + cps[1].x, y: p1.y + cps[1].y * direction }

    const points: { x: number; y: number }[] = []
    const STEPS = 16
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS
      const mt = 1 - t
      const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t
      points.push({
        x: a * p0.x + b * c0.x + c * c1.x + d * p1.x,
        y: a * p0.y + b * c0.y + c * c1.y + d * p1.y,
      })
    }

    const xs = points.map(p => p.x)
    const ys = points.map(p => p.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    return { bbox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }, points, c0, c1 }
  }

  /** The rendered SVG group (`<g class="vf-slur">`) for a slur, or null. Scoped
   *  highlight uses this to recolor exactly one slur. Must be called after a render. */
  getSlurSVGGroup(slurId: string): SVGGElement | null {
    return this.slurGroupMap.get(slurId) ?? null
  }

  /**
   * Render a dangling (pending) tie from a note with no target yet.
   * Draws a partial arc extending to the right — same as the first half of a cross-barline tie.
   */
  renderPendingTie(noteId: string, score: Score): void {
    if (!this.context) return
    const info = this.staveNoteMap.get(noteId)
    if (!info) return

    // Find the NotePitch and its containing chord/measure
    let foundNotePitch: import('@/types/music').NotePitch | undefined
    let foundBeat: Fraction | undefined
    let foundMeasure: Measure | undefined

    outer: for (const measure of score.measures) {
      for (const slot of measure.slots) {
        if (slot.type === 'chord') {
          const p = slot.notes.find(n => n.id === noteId)
          if (p) {
            foundNotePitch = p
            foundBeat = slot.beat
            foundMeasure = measure
            break outer
          }
        }
      }
    }

    if (!foundNotePitch || !foundBeat || !foundMeasure) return

    const tieDirection = this.getTieDirection(foundNotePitch, foundBeat, foundMeasure)
    const pendingTie = new StaveTie({
      firstNote: info.staveNote,
      firstIndexes: [info.noteIndex],
    })
    if (tieDirection !== undefined) {
      pendingTie.setDirection(tieDirection)
    }
    pendingTie.setContext(this.context).draw()
  }

  /**
   * Clear the canvas content without removing the SVG element
   */
  clear(): void {
    // According to VexFlow best practices, we should keep the SVG element
    // and only clear its contents, not remove the element itself
    const svg = this.getSVGElement()
    if (svg) {
      while (svg.firstChild) {
        svg.removeChild(svg.firstChild)
      }
    }
    // Clear the element registry for the new render
    this.elementRegistry.clear()
    // Clear the stave note map
    this.staveNoteMap.clear()
    // Clear the tuplet object map
    this.tupletObjectMap.clear()
    // Clear the dynamic object map
    this.dynamicObjectMap.clear()
    // Clear the slur group map
    this.slurGroupMap.clear()
    // Clear measure layout info
    this.measureLayoutInfo.clear()
  }

  /**
   * Get the SVG element
   */
  getSVGElement(): SVGElement | null {
    return this.svgContainer.querySelector('svg')
  }

  /**
   * Get the rendered SVG nodes for a note/rest needed to recolor exactly this note
   * (the basis for a bleed-free selection highlight). Must be called after a render
   * (the map and DOM ids are rebuilt each render).
   *
   * - `group`: the note's `<g class="vf-stavenote">` — VexFlow draws its ledger lines,
   *   noteheads and flag inside it (and its stem too, when the note is NOT beamed).
   * - `noteIndex`: the selected pitch's key index within the chord (low→high), matching
   *   the DOM order of the notehead subgroups.
   * - `stem`: the note's stem group, resolved by identity via the Stem object. A beamed
   *   note's stem is drawn by the Beam (inside `<g class="vf-beam">`, NOT the note's
   *   group), so this is the only reliable way to recolor a beamed note's stem.
   */
  getStaveNoteSVGGroup(noteId: string): { group: SVGGElement; noteIndex: number; stem: SVGGElement | null } | null {
    const info = this.staveNoteMap.get(noteId)
    if (!info) return null
    const group = info.staveNote.getSVGElement?.()
    if (!group) return null
    const stem = info.staveNote.getStem?.()?.getSVGElement?.() ?? null
    return {
      group: group as unknown as SVGGElement,
      noteIndex: info.noteIndex,
      stem: (stem as unknown as SVGGElement) ?? null,
    }
  }

  /**
   * Get the rendered SVG group (`<g class="vf-tuplet">`) for a tuplet, containing its
   * bracket and number. Lets the selection highlight recolor exactly this tuplet
   * without a document-wide scan (which bled into neighbouring systems).
   * Must be called after a render.
   */
  getTupletSVGGroup(tupletId: string): SVGGElement | null {
    const group = this.tupletObjectMap.get(tupletId)?.getSVGElement?.()
    return (group as unknown as SVGGElement) ?? null
  }

  /**
   * Get the rendered SVG group (`<g class="vf-annotation">`) for a dynamic, so the
   * selection highlight (Phase 6) can recolor exactly this dynamic without a
   * document-wide scan. Must be called after a render. Mirrors getTupletSVGGroup.
   */
  getDynamicSVGGroup(dynamicId: string): SVGGElement | null {
    const group = this.dynamicObjectMap.get(dynamicId)?.getSVGElement?.()
    return (group as unknown as SVGGElement) ?? null
  }

  /** Suppress one dynamic from the next renders (pass null to restore). Used by the
   *  in-canvas text editor so the engraved glyph isn't drawn under the overlay. The
   *  caller must trigger a re-render for this to take effect. */
  setSuppressedDynamicId(dynamicId: string | null): void {
    this.suppressedDynamicId = dynamicId
  }

  /**
   * Render score with an optional ghost note overlay (preview note during mouse hover)
   * Returns true if ghost note was rendered
   */
  renderScoreWithGhostNote(score: Score, ghostNote?: GhostNote): boolean {
    return this.renderScore(score, ghostNote)
  }

  /**
   * Render the score, then overlay a free-floating translucent ghost clef that
   * follows the cursor (like the ghost note). The clef glyph is drawn alone (via
   * a 0-line stave so no staff lines appear), wrapped in a `.ghost-clef-group`
   * for CSS tinting, and translated so its center sits at the cursor.
   * @returns true if the ghost clef was drawn
   */
  renderScoreWithClefGhost(score: Score, cursorX: number, cursorY: number, clef: Clef): boolean {
    this.renderScore(score)

    const svg = this.getSVGElement()
    if (!svg) return false

    try {
      const childrenBefore = svg.children.length

      // Draw just the clef glyph: a stave with 0 lines and no barlines renders
      // only the clef modifier. Initial position is arbitrary — we reposition below.
      const tempStave = new Stave(0, cursorY, 120, { numLines: 0 })
      tempStave.setBegBarType(Barline.type.NONE)
      tempStave.setEndBarType(Barline.type.NONE)
      tempStave.addClef(clef)
      tempStave.setContext(this.context!).draw()

      const newElements: Element[] = []
      for (let i = childrenBefore; i < svg.children.length; i++) {
        newElements.push(svg.children[i])
      }
      if (newElements.length === 0) return false

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      group.setAttribute('class', 'ghost-clef-group')
      for (const el of newElements) svg.removeChild(el)
      for (const el of newElements) group.appendChild(el)
      svg.appendChild(group)

      // Center the glyph on the cursor so it tracks the mouse freely.
      const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
      if (gbox && gbox.width > 0) {
        const dx = cursorX - (gbox.x + gbox.width / 2)
        const dy = cursorY - (gbox.y + gbox.height / 2)
        group.setAttribute('transform', `translate(${dx}, ${dy})`)
      }

      return true
    } catch (e) {
      return false
    }
  }

  /**
   * Render the score with a free-floating translucent ghost time signature that
   * follows the cursor (mirrors {@link renderScoreWithClefGhost}). Draws just the
   * TS glyph on a 0-line stave, wrapped in a `.ghost-timesig-group` for CSS
   * tinting, translated so its centre sits at the cursor.
   * @returns true if the ghost time signature was drawn
   */
  renderScoreWithTimeSignatureGhost(score: Score, cursorX: number, cursorY: number, ts: TimeSignature): boolean {
    this.renderScore(score)

    const svg = this.getSVGElement()
    if (!svg) return false

    try {
      const childrenBefore = svg.children.length

      const tempStave = new Stave(0, cursorY, 120, { numLines: 0 })
      tempStave.setBegBarType(Barline.type.NONE)
      tempStave.setEndBarType(Barline.type.NONE)
      tempStave.addTimeSignature(`${ts.numerator}/${ts.denominator}`)
      tempStave.setContext(this.context!).draw()

      const newElements: Element[] = []
      for (let i = childrenBefore; i < svg.children.length; i++) {
        newElements.push(svg.children[i])
      }
      if (newElements.length === 0) return false

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      group.setAttribute('class', 'ghost-timesig-group')
      for (const el of newElements) svg.removeChild(el)
      for (const el of newElements) group.appendChild(el)
      svg.appendChild(group)

      const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
      if (gbox && gbox.width > 0) {
        const dx = cursorX - (gbox.x + gbox.width / 2)
        const dy = cursorY - (gbox.y + gbox.height / 2)
        group.setAttribute('transform', `translate(${dx}, ${dy})`)
      }

      return true
    } catch (e) {
      return false
    }
  }

  /**
   * Render the score with a free-floating translucent ghost dynamic that follows
   * the cursor (mirrors {@link renderScoreWithClefGhost}). Builds the real dynamic
   * Annotation (level glyph in the music font, or custom italic text) on a
   * throwaway note, then keeps only the annotation's SVG group — discarding the
   * temp stave/notehead — wrapped in a `.ghost-dynamic-group` and centred on the
   * cursor. On click the mark is applied to the clicked slot (see MouseController).
   *
   * GOTCHA (font-size inheritance): a dynamic level glyph's `<text>` is emitted
   * with NO explicit `font-size` — VexFlow lets it inherit the size from its
   * ancestors in the score's SVG tree. Re-parenting that `<text>` to a group at
   * the SVG root (as we do here) breaks the inheritance chain, so the glyph would
   * collapse to the browser default (~16px) and look tiny next to a placed mark.
   * We therefore re-apply the annotation's resolved font on the wrapper group
   * below. This is a pure SVG/VexFlow behaviour, unrelated to the UI framework.
   * @returns true if the ghost dynamic was drawn
   */
  renderScoreWithDynamicGhost(score: Score, cursorX: number, cursorY: number, dynamic: Dynamic): boolean {
    this.renderScore(score)

    const svg = this.getSVGElement()
    if (!svg) return false

    try {
      const childrenBefore = svg.children.length

      // Draw the annotation on a throwaway quarter note. The note/stave glyphs are
      // discarded below; we keep only the annotation's SVG group.
      const tempStave = new Stave(0, cursorY, 200)
      tempStave.setBegBarType(Barline.type.NONE)
      tempStave.setEndBarType(Barline.type.NONE)
      tempStave.setContext(this.context!)

      const annotation = this.buildDynamicAnnotation(dynamic)
      const note = new StaveNote({ keys: ['b/4'], duration: 'q' })
      note.setStave(tempStave)
      note.addModifier(annotation, 0)

      const voice = new Voice({ numBeats: 1, beatValue: 4 })
      voice.setStrict(false)
      voice.addTickables([note])
      new Formatter().joinVoices([voice]).format([voice], 150)
      voice.draw(this.context!, tempStave)

      const annoEl = annotation.getSVGElement?.() as SVGGElement | undefined

      const newElements: Element[] = []
      for (let i = childrenBefore; i < svg.children.length; i++) {
        newElements.push(svg.children[i])
      }

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      group.setAttribute('class', 'ghost-dynamic-group')
      // The dynamic glyph's <text> carries no explicit font-size — it inherits it
      // from its ancestors in the score. Extracting it to the SVG root breaks that
      // chain (the glyph would shrink to the browser default), so re-apply the
      // annotation's resolved font on the group for the <text> to inherit.
      const f = annotation.fontInfo
      if (f) {
        group.setAttribute('font-family', f.family)
        group.setAttribute('font-size', typeof f.size === 'number' ? `${f.size}pt` : String(f.size))
        if (f.style) group.setAttribute('font-style', f.style)
      }
      // Move just the annotation group out (detaches it from the note's group)…
      if (annoEl) group.appendChild(annoEl)
      // …then discard the leftover temp stave/notehead/stem elements.
      for (const el of newElements) {
        if (el.parentNode === svg) svg.removeChild(el)
      }
      if (!annoEl) return false

      svg.appendChild(group)

      // Centre the glyph on the cursor so it tracks the mouse freely.
      const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
      if (gbox && gbox.width > 0) {
        const dx = cursorX - (gbox.x + gbox.width / 2)
        const dy = cursorY - (gbox.y + gbox.height / 2)
        group.setAttribute('transform', `translate(${dx}, ${dy})`)
      }

      return true
    } catch (e) {
      return false
    }
  }
}
