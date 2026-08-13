import type { Widget } from '../content/Widget'
import { bus } from '@/bus'
import type { InspectedElement } from '../../interactions/selectionSnapshot'
import { MAX_FAN_BEAMS, MAX_FAN_COUNT, MAX_FAN_SPREAD, fanRampRange, fanSpread } from '../../utils/fannedBeam'
import type { TrillContinuationLabel } from '../../types/music'
import type { ArticulationType, FanMark } from '../../types/music'

/**
 * What is selected, as the model holds it.
 *
 * A SKETCH, deliberately: it stringifies, it does not edit. Properties will eventually offer the
 * controls for each kind of element, and the way to find out what those controls should be is to
 * look at the objects for a while — which is precisely what this does. It is also the honest state
 * of the seam: the selection reaches this window and repaints when it moves; only the widgets are
 * missing.
 *
 * The panel reads {@link bus.inspection} and nothing else. It never touches EditorState, never
 * holds the engine, and cannot write — so no edit can escape from a window that is not yet an
 * editor.
 */
/**
 * Phosphor green — a terminal's, not the chrome's. Local literals and NOT tokens in
 * {@link ../../utils/chromeColors}: that palette is the shared neutrals every window and menu is
 * drawn in, and this colour MEANS something instead — "this is a readout, not UI". It must be free
 * to differ from the chrome, which a shared token would quietly prevent (the same reason the
 * Keypad's voice and mode colours stay out of CHROME).
 *
 * TWO colours, and only two. The kind headings are AMBER — dimming green to separate it from green
 * lost them against the glass, whereas hue separates for free and keeps both bright. Everything
 * else is the phosphor, "Nothing selected" included: it is what the panel is READING OUT, not a
 * label on something, so it belongs in the readout's own colour.
 *
 * All three are TEMPORARY, like the dump they colour — when Properties grows real controls it is
 * drawn in the chrome like every other panel, and these go with the JSON.
 */
const PHOSPHOR = '#22ff88'
const AMBER = '#ffc93c'
// Bishop purple — the note-offset control's own colour, so the one thing on the panel you can EDIT
// reads as distinct from the green readout and the amber section labels. A third local literal (not
// a chrome token, like the two above) for the same reason: it MEANS "this is a live control", which
// a shared neutral would quietly flatten. A deep, saturated obispo violet (a lighter tint washed out
// on the glass) — full-strength so it still carries against the dark panel.
const BISHOP = '#7c3aed'

export class PropertiesWidget implements Widget {
  private body: HTMLElement | null = null
  private unsubscribe: (() => void) | null = null

  mount(host: HTMLElement): void {
    host.style.overflow = 'hidden'

    const body = document.createElement('div')
    const s = body.style
    s.flex = '1'
    s.minHeight = '0'
    s.overflow = 'auto'
    // Monospace, because this is DATA: aligned braces and columns are how you read a dump. The rest
    // of the toolkit is prose and uses the inherited face.
    s.font = "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    s.lineHeight = '1.45'
    s.whiteSpace = 'pre-wrap'
    // Long ids and pitch keys have no spaces to break at, and a panel that scrolls SIDEWAYS to show
    // the end of an id is a panel you cannot read at a glance.
    s.overflowWrap = 'anywhere'
    s.color = PHOSPHOR

    host.appendChild(body)
    this.body = body

    this.paint(bus.inspection.get())
    this.unsubscribe = bus.inspection.onChange((elements) => this.paint(elements))
  }

  /** The selection lives outside this widget, so the subscription MUST go when the window does. */
  destroy(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  private paint(elements: InspectedElement[]): void {
    const body = this.body
    if (!body) return
    body.textContent = ''

    if (!elements.length) {
      const empty = document.createElement('div')
      empty.textContent = 'Nothing selected'
      body.appendChild(empty)
      return
    }

    for (const element of elements) {
      // The kind is the one thing that is NOT in the JSON — `data` is the element's own object, and
      // an object does not say what it is. Without this a rest and a note are told apart only by
      // spotting `isRest` in the dump.
      const heading = document.createElement('div')
      heading.textContent = element.kind
      heading.style.color = AMBER
      heading.style.margin = '8px 0 2px'
      heading.style.textTransform = 'uppercase'
      heading.style.letterSpacing = '0.06em'
      body.appendChild(heading)

      // The panel's FIRST real control (client #12 — docs/note-offset-plan.md §B): a note/rest's
      // horizontal offset, an absolute value in staff-spaces. Publishes to `bus.noteOffset`; the
      // widget never touches the engine (that is NoteOffsetController's job) — it stays a dumb
      // publisher, and the second editable property will cost almost nothing.
      if ((element.kind === 'note' || element.kind === 'rest')) {
        const id = (element.data as { id?: string; missing?: boolean }).id
        if (id && !(element.data as { missing?: boolean }).missing) {
          body.appendChild(this.buildOffsetInput(id, currentNoteOffset(element)))
          // Only meaningful when the note carries an articulation (the flag moves stem-side marks).
          const artics = (element.data as { articulations?: ArticulationType[] }).articulations
          if (element.kind === 'note' && artics?.length) {
            body.appendChild(this.buildStemAlignCheckbox(id, currentStemAlign(element)))
          }
          // The fanned group's numbers, shown only on a note that HAS one: this row changes the
          // shape of a fan, it never makes one (docs/fanned-beams-plan.md §3, P4). Creating and
          // removing them is the accel./rit. press, which is also where the direction lives.
          const fan = (element.data as { fan?: FanMark }).fan
          if (element.kind === 'note' && fan) {
            body.appendChild(this.buildFanInputs(id, fan))
          }
        }
      }

      // A selected TRILL gets its one stored choice. Same boundary as the fan row above.
      if (element.kind === 'trill') {
        const trill = element.data as { id?: string; missing?: boolean; continuationLabel?: TrillContinuationLabel }
        if (trill.id && !trill.missing) {
          body.appendChild(this.buildTrillLabelSelect(trill.id, trill.continuationLabel ?? 'parenthesised'))
        }
      }

      const dump = document.createElement('div')
      dump.textContent = stringify(element.data)
      body.appendChild(dump)

      // Its own section, under its own label, because the overrides are their own COMPARTMENT — the
      // authored geometry the model deliberately keeps out of the content (staff-spaces, never
      // pixels). Printing them inside the element's object would show a shape the score does not
      // have. Nothing is drawn when the element has none, which is most of the time.
      if (element.overrides) {
        const label = document.createElement('div')
        label.textContent = 'engraving overrides'
        label.style.color = AMBER
        label.style.margin = '6px 0 2px'
        label.style.letterSpacing = '0.06em'
        body.appendChild(label)

        const overrides = document.createElement('div')
        overrides.textContent = stringify(element.overrides)
        body.appendChild(overrides)
      }
    }
    (body.firstElementChild as HTMLElement).style.marginTop = '0'
  }

  /**
   * The absolute horizontal-offset control for one note/rest. A labelled number input in
   * staff-spaces; committing (Enter or blur) publishes `{id, x}` to {@link bus.noteOffset}.
   * The window holds no engine — the controller reads the current value and applies the delta — so
   * this only reports the desired absolute, and the panel repaints from `onModelChange` afterward.
   */
  private buildOffsetInput(noteId: string, current: number): HTMLElement {
    const row = document.createElement('label')
    const rs = row.style
    rs.display = 'flex'
    rs.alignItems = 'center'
    rs.gap = '6px'
    rs.color = BISHOP
    rs.margin = '2px 0 4px'

    const label = document.createElement('span')
    label.textContent = 'offset (sp)'
    row.appendChild(label)

    const input = document.createElement('input')
    input.type = 'number'
    input.step = '0.25'
    input.value = String(current)
    const is = input.style
    is.width = '5em'
    is.font = 'inherit'
    is.color = BISHOP
    is.background = 'transparent'
    is.border = `1px solid ${BISHOP}`
    is.borderRadius = '2px'
    is.padding = '1px 4px'

    const commit = () => {
      const x = parseFloat(input.value)
      if (!Number.isFinite(x)) { input.value = String(current); return }
      bus.noteOffset.set(noteId, x)
    }
    // Enter commits (and blurs, which would otherwise commit a second time — so guard on the blur).
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur() }
    })
    input.addEventListener('change', commit)
    row.appendChild(input)

    // A little reset: publish offset 0 through the same seam (the controller turns it into the nudge
    // back to centre). Kept next to the input so "put this note back" is one click, not a retype.
    const reset = document.createElement('button')
    reset.type = 'button'
    reset.textContent = 'reset'
    reset.title = 'Reset offset to 0'
    const bs = reset.style
    bs.font = 'inherit'
    bs.color = BISHOP
    bs.background = 'transparent'
    bs.border = `1px solid ${BISHOP}`
    bs.borderRadius = '2px'
    bs.padding = '1px 6px'
    bs.cursor = 'pointer'
    reset.addEventListener('click', () => {
      input.value = '0'
      bus.noteOffset.set(noteId, 0)
    })
    row.appendChild(reset)
    return row
  }

  /**
   * The fanned group's shape — how many notes it is played and drawn as, how many beam lines it
   * feathers out to, and which of its notes the feathering covers. One row, four number inputs,
   * publishing to {@link bus.fanEdit}.
   *
   * ⭐ **The numbers ARE the model** (`FanMark`), which is what makes this UI only: nothing here
   * computes a consequence, it just says what the assertion is. The direction is not offered — that
   * is the accel./rit. press, and showing it twice would give one fact two owners.
   *
   * ⭐ **`from`/`to` are shown 1-BASED and converted right here** (docs/fan-ramp-range-plan.md P2).
   * "Note 1" is the note he typed, which is how a musician counts a group; the model, the seam and
   * every reader past this line stay 0-based like the rest of the editor. The conversion belongs at
   * the one place a human reads the number, and nowhere deeper.
   *
   * Committing (Enter or blur) re-draws and re-plays at once, because both read the same field.
   */
  /**
   * ⭐ **How a trill labels itself on a CONTINUATION system** — the three real behaviours in the
   * field, offered as a choice because there is no single right one (see
   * {@link Trill.continuationLabel} for who does which, and docs/trill-plan.md §1 rule 6).
   *
   * ⚠️ The window is a DUMB PUBLISHER: it writes to `bus.trillEdit` and never touches the engine —
   * `TrillEditController` owns the apply, the same boundary the fan inputs keep.
   *
   * ⭐ It CHANGES a trill, never makes one. The row appears only on a selected trill; creating and
   * removing them is the Lines palette and Delete.
   */
  private buildTrillLabelSelect(trillId: string, current: TrillContinuationLabel): HTMLElement {
    const wrap = document.createElement('label')
    const ws = wrap.style
    ws.display = 'flex'
    ws.alignItems = 'center'
    ws.gap = '6px'
    ws.color = BISHOP
    ws.margin = '2px 0 4px'
    wrap.title = 'What a new system shows when this trill carries over from the previous one.'

    const caption = document.createElement('span')
    caption.textContent = 'on a new system'
    wrap.appendChild(caption)

    const select = document.createElement('select')
    const ss = select.style
    ss.font = 'inherit'
    ss.color = BISHOP
    ss.background = 'transparent'
    ss.border = `1px solid ${BISHOP}`
    ss.borderRadius = '2px'
    ss.padding = '1px 4px'

    // ⚠️ The labels say what is DRAWN, not who does it — a user picking one is choosing a picture,
    // not siding with a publisher. The provenance belongs in the docs, and is in them.
    const options: Array<[TrillContinuationLabel, string]> = [
      ['parenthesised', '(tr)'],
      ['plain', 'tr'],
      ['none', 'line only'],
    ]
    for (const [value, text] of options) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = text
      if (value === current) option.selected = true
      select.appendChild(option)
    }
    select.addEventListener('change', () => {
      bus.trillEdit.set({ trillId, continuationLabel: select.value as TrillContinuationLabel })
    })

    wrap.appendChild(select)
    return wrap
  }

  private buildFanInputs(noteId: string, fan: FanMark): HTMLElement {
    const row = document.createElement('div')
    const rs = row.style
    rs.display = 'flex'
    rs.alignItems = 'center'
    rs.gap = '6px'
    // Five numbers and a label do not fit one line in a narrow window; they wrap rather than clip.
    rs.flexWrap = 'wrap'
    rs.color = BISHOP
    rs.margin = '2px 0 4px'

    const label = document.createElement('span')
    label.textContent = `fan (${fan.direction})`
    row.appendChild(label)

    const field = (
      title: string, value: number, max: number, publish: (n: number) => void, hint = title,
      step = 1,
    ): HTMLElement => {
      const wrap = document.createElement('label')
      wrap.style.display = 'flex'
      wrap.style.alignItems = 'center'
      wrap.style.gap = '3px'
      wrap.title = hint

      const caption = document.createElement('span')
      caption.textContent = title
      wrap.appendChild(caption)

      const input = document.createElement('input')
      input.type = 'number'
      input.min = '1'
      input.max = String(max)
      input.step = String(step)
      input.value = String(value)
      const is = input.style
      is.width = '3.5em'
      is.font = 'inherit'
      is.color = BISHOP
      is.background = 'transparent'
      is.border = `1px solid ${BISHOP}`
      is.borderRadius = '2px'
      is.padding = '1px 4px'
      // Enter commits (and blurs, which would otherwise commit twice — the offset input's rule).
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur() }
      })
      input.addEventListener('change', () => {
        // ⚠️ `parseFloat` for a fractional field (the spread), `parseInt` for the counts — a count
        // typed with a decimal point is a typo, not a request for two-thirds of a note.
        const n = step === 1 ? parseInt(input.value, 10) : parseFloat(input.value)
        // A number that is not one is not an edit: put the real value back rather than guessing at
        // what was meant. The controller clamps the rest.
        if (!Number.isFinite(n)) { input.value = String(value); return }
        publish(n)
      })
      wrap.appendChild(input)
      return wrap
    }

    row.appendChild(field('notes', fan.count, MAX_FAN_COUNT, (count) => bus.fanEdit.set({ noteId, count })))
    row.appendChild(field('beams', fan.beams, MAX_FAN_BEAMS, (beams) => bus.fanEdit.set({ noteId, beams })))

    // ⭐ WHERE THE WEDGE STARTS AND ENDS. Read through `fanRampRange`, so a fan that has never been
    // given one shows the whole group — the same answer the drawing and the playback are already
    // using, rather than a second reading of an absent field.
    const ramp = fanRampRange(fan)
    const last = Math.max(1, Math.round(fan.count))
    row.appendChild(field(
      'from', ramp.from + 1, last,
      (n) => bus.fanEdit.set({ noteId, rampFrom: n - 1 }),
      'the note the feathering starts on',
    ))
    row.appendChild(field(
      'to', ramp.to + 1, last,
      (n) => bus.fanEdit.set({ noteId, rampTo: n - 1 }),
      'the note it ends on — outside the mark the notes are even, on one beam',
    ))

    // ⭐ HOW FAR THE WEDGE OPENS — a multiple of the ordinary beam gap, so 1 is both the default and
    // the floor (below it the lines overlap). The only number in this row that does not change the
    // sound: what a reader counts is lines, and spreading them does not change how many there are.
    row.appendChild(field(
      'wide', fanSpread(fan), MAX_FAN_SPREAD,
      (spread) => bus.fanEdit.set({ noteId, spread }),
      'how far apart the beam lines spread — 1 is the normal beam gap; drawing only, the playback does not change',
      0.25,
    ))
    return row
  }

  /**
   * The "align to stem" toggle for a note's articulations. A checkbox: checked = stem-side marks
   * align to the stem (modern), unchecked = notehead (traditional default). Publishes `{id, align}`
   * to {@link bus.articulationStemAlign}; the controller holds the engine, the window does not.
   */
  private buildStemAlignCheckbox(noteId: string, current: boolean): HTMLElement {
    const row = document.createElement('label')
    const rs = row.style
    rs.display = 'flex'
    rs.alignItems = 'center'
    rs.gap = '6px'
    rs.color = BISHOP
    rs.margin = '0 0 4px'
    rs.cursor = 'pointer'

    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = current
    input.style.accentColor = BISHOP
    input.addEventListener('change', () => bus.articulationStemAlign.set(noteId, input.checked))
    row.appendChild(input)

    const label = document.createElement('span')
    label.textContent = 'align to stem'
    row.appendChild(label)
    return row
  }
}

/** The note/rest's current horizontal offset in staff-spaces (0 when none), read from the element's
 *  own overrides — the entry at whichever key the engine writes (the slot's, or a fanned MEMBER's
 *  own; `selectionSnapshot` resolves it through `offsetTargetOf`, so a member shows ITS number). */
function currentNoteOffset(element: InspectedElement): number {
  const entry = element.overrides?.find((o) => o.kind === 'noteOffset') as { x?: number } | undefined
  return entry?.x ?? 0
}

/** The note's current articulation stem-align state (false when unset), read from its own object. */
function currentStemAlign(element: InspectedElement): boolean {
  return (element.data as { articulationStemAlign?: boolean }).articulationStemAlign === true
}

/**
 * JSON, or a plain description of why there isn't any. A `Fraction` beat, a Map, a cyclic reference
 * — anything the model holds that JSON cannot express must show as itself and not take the panel
 * down with it, because a debugging window that throws on the very object you were debugging is
 * worse than useless.
 */
function stringify(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2) ?? String(data)
  } catch (err) {
    return `[unserializable: ${err instanceof Error ? err.message : String(err)}]`
  }
}
