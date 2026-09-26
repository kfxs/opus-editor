import { bus } from '@/bus'
import type { InspectedOf } from '@/interactions/state/inspectedElement'
import { MAX_FAN_BEAMS, MAX_FAN_COUNT, MAX_FAN_SPREAD, fanRampRange, fanSpread } from '@/utils/fannedBeam'
import type { FanMark, FractionalBeamSide, Note, NoteOffsetOverride } from '@/types/music'
import { BISHOP, commitOnFirstStep } from '../rows'
import { live, overrideOf, type PanelRows } from './panel'
import { durationFlags } from '@/utils/durations'

/**
 * A NOTE, a REST, a GRACE or a BRACKETED grace — the panel's FIRST real control (client #12 — docs/plans/note-offset-plan.md
 * §B): its horizontal offset, an absolute value in staff-spaces. A note adds what only a note has; a
 * grace has only the offset so far (its group's flags are grace-notes-plan P6).
 */
export const noteRows: PanelRows<'note' | 'rest' | 'grace' | 'bracketed'> = (element) => {
  const note = live(element.data)
  if (!note) return []
  const id = note.id
  const rows = [buildOffsetInput(id, currentNoteOffset(element))]
  // ⭐ CUE size (cue-size-plan P5, his ask 2026-09-24) — every kind here can be cue: a note (its chord), a rest,
  //    a grace, a bracketed grace. The same toggle the Keypad's cue key makes.
  rows.push(buildCueCheckbox(id, note.cue === true))
  // ⭐ P6 — a BRACKETED grace's side: before or after its target (his proposal; default before).
  if (element.kind === 'bracketed' && element.derived) rows.push(buildBracketedSideSelect(id, element.derived))
  if (element.kind !== 'note') return rows

  // ⭐ P5 — a bracketed CHORD's one-pair switch, offered only when every head wears brackets (his rule).
  if (element.derived?.enclosureSpan !== undefined) rows.push(buildEnclosureSpanSelect(id, element.derived.enclosureSpan))

  // Only meaningful when the note carries an articulation (the flag moves stem-side marks).
  if (note.articulations?.length) rows.push(buildStemAlignCheckbox(id, note.articulationStemAlign === true))

  // The fanned group's numbers, shown only on a note that HAS one: this row changes the shape of a
  // fan, it never makes one (docs/plans/fanned-beams-plan.md §3, P4). Creating and removing them is the
  // accel./rit. press, which is also where the direction lives.
  if (note.fan) rows.push(buildFanInputs(id, note.fan))

  // ⭐ …and which way its FRACTIONAL BEAM points (his ask, 2026-09-01).
  //
  // ⚠️ **The gate is the note's DURATION, which is looser than the truth**: only a note shorter than
  // its beam group's common level actually carries a stub, and that is a fact about the GROUP, which
  // this snapshot does not hold. So the row can appear on a semiquaver in a run of semiquavers, where
  // it has nothing to move. ⛔ Deliberately not faked tighter by guessing — the honest fix is the one
  // the clef's `offsettable` uses: ask the engine what was DRAWN. See docs/research/beam-hook-research.md §8.
  if (canCarryFractionalBeam(note)) {
    rows.push(buildFractionalBeamSideSelect(id, note.fractionalBeamSide ?? null))
  }
  return rows
}

/**
 * The absolute horizontal-offset control for one note/rest. A labelled number input in
 * staff-spaces; committing (Enter or blur) publishes `{id, x}` to {@link bus.noteOffset}.
 * The window holds no engine — the controller reads the current value and applies the delta — so
 * this only reports the desired absolute, and the panel repaints from `onModelChange` afterward.
 */
function buildOffsetInput(noteId: string, current: number): HTMLElement {
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
    bus.noteOffset.set({ noteId, x })
    // ⭐⭐ THE BOX NEVER KEEPS A NUMBER THE MODEL REFUSED — his report, 2026-08-17: *"the number
    // doesn't stop but keeps on changing after the limit, so to go back we have to do the whole
    // path."* The page limit can decline the write, and a declined write changes nothing, so
    // `bus.inspection` never fires and this row is never rebuilt — leaving a value on screen the
    // score does not have, and a spinner you must wind all the way back down through. So the box
    // is put back to the last KNOWN value on every commit; a write that landed repaints the row
    // over the top of it with the new one. ⛔ The alternative — a success flag back through the
    // seam — would make the window read the engine's answer, which is the boundary it defends.
    input.value = String(current)
  }
  // Enter commits (and blurs, which would otherwise commit a second time — so guard on the blur).
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur() }
  })
  commitOnFirstStep(input, commit)
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
    // Zeroed immediately — a reset only reduces an offset, so the limit cannot refuse it.
    input.value = '0'
    bus.noteOffset.set({ noteId, x: 0 })
  })
  row.appendChild(reset)
  return row
}

/**
 * The "align to stem" toggle for a note's articulations. A checkbox: checked = stem-side marks
 * align to the stem (modern), unchecked = notehead (traditional default). Publishes `{id, align}`
 * to {@link bus.articulationStemAlign}; the controller holds the engine, the window does not.
 */
/** The "Cue size" checkbox — publishes `{ noteId, cue }` to {@link bus.cueSize}; the panel repaints from the model. */
function buildCueCheckbox(noteId: string, current: boolean): HTMLElement {
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
  input.addEventListener('change', () => bus.cueSize.set({ noteId, cue: input.checked }))
  row.appendChild(input)

  const label = document.createElement('span')
  label.textContent = 'cue size'
  row.appendChild(label)
  return row
}

function buildStemAlignCheckbox(noteId: string, current: boolean): HTMLElement {
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
  input.addEventListener('change', () => bus.articulationStemAlign.set({ noteId, align: input.checked }))
  row.appendChild(input)

  const label = document.createElement('span')
  label.textContent = 'align to stem'
  row.appendChild(label)
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
 * ⭐ **`from`/`to` are shown 1-BASED and converted right here** (docs/plans/fan-ramp-range-plan.md P2).
 * "Note 1" is the note he typed, which is how a musician counts a group; the model, the seam and
 * every reader past this line stay 0-based like the rest of the editor. The conversion belongs at
 * the one place a human reads the number, and nowhere deeper.
 *
 * Committing (Enter or blur) re-draws and re-plays at once, because both read the same field.
 */
function buildFanInputs(noteId: string, fan: FanMark): HTMLElement {
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
  label.textContent = 'fan'
  row.appendChild(label)

  // ⭐ WHICH WAY IT RUNS (his ask, 2026-09-24) — switched here as the `accel.`/`rit.` keys turn a fan round: one
  //    field of the mark, the members and the shape kept (`FanEditController`).
  const direction = document.createElement('select')
  for (const value of ['accel', 'rit'] as const) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = value
    direction.appendChild(option)
  }
  direction.value = fan.direction
  direction.title = 'accel. = the notes speed up (open feather) · rit. = they slow down (close feather)'
  const ds = direction.style
  ds.font = 'inherit'
  ds.color = BISHOP
  ds.background = 'transparent'
  ds.border = `1px solid ${BISHOP}`
  ds.borderRadius = '2px'
  direction.addEventListener('change', () => bus.fanEdit.set({ noteId, direction: direction.value === 'rit' ? 'rit' : 'accel' }))
  row.appendChild(direction)

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
 * ⭐⭐ **WHICH WAY THIS NOTE'S FRACTIONAL BEAM POINTS** — his ask, 2026-09-01: *"on fractional beams
 * we should be able the user decide the direction… it is good the default like it is but it will
 * be good also have it on properties"*.
 *
 * ⭐ **`auto` is a real option and it is the FIRST**, because absent is what a score carries until
 * somebody overrides it: auto means the four treatises' metric rule
 * (`engine/engrave/beams/fractionalBeam`), ⛔ not "whatever it happens to look like now". Choosing
 * it back therefore *restores the engraved default* rather than freezing today's picture.
 *
 * ⚠️ The window is a DUMB PUBLISHER — it writes to `bus.fractionalBeamSide` and never touches the
 * engine, the boundary the trill, fan and hairpin rows all keep.
 */
function buildFractionalBeamSideSelect(
  noteId: string,
  current: FractionalBeamSide | null,
): HTMLElement {
  const wrap = document.createElement('label')
  const ws = wrap.style
  ws.display = 'flex'
  ws.alignItems = 'center'
  ws.gap = '6px'
  ws.color = BISHOP
  ws.margin = '2px 0 4px'
  wrap.title =
    'Which side the short beam stub on this note points. Auto follows the beat it belongs to.'

  const caption = document.createElement('span')
  caption.textContent = 'fractional beam direction'
  wrap.appendChild(caption)

  const select = document.createElement('select')
  const ss = select.style
  ss.font = 'inherit'
  ss.color = BISHOP
  ss.background = 'transparent'
  ss.border = `1px solid ${BISHOP}`
  ss.borderRadius = '2px'
  ss.padding = '1px 4px'

  const options: Array<[string, string]> = [
    ['auto', 'auto'],
    ['left', 'left'],
    ['right', 'right'],
  ]
  for (const [value, text] of options) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = text
    if (value === (current ?? 'auto')) option.selected = true
    select.appendChild(option)
  }
  select.addEventListener('change', () => {
    const picked = select.value
    bus.fractionalBeamSide.set({ noteId, side: picked === 'auto' ? null : (picked as FractionalBeamSide) })
  })

  wrap.appendChild(select)
  return wrap
}

/** ⚠️ Necessary, ⛔ not sufficient — see the call site: only a value that can BE a fraction of a
 *  coarser beam may carry a stub at all, but whether one is drawn depends on the beam group. */
function canCarryFractionalBeam(note: Note): boolean {
  return !note.isRest && durationFlags(note.duration) >= 2 // a 16th or shorter
}

/** The note/rest's current horizontal offset in staff-spaces (0 when none), read from the element's
 *  own overrides — the entry at whichever key the engine writes (the slot's, or a fanned MEMBER's
 *  own; `selectionSnapshot` resolves it through `offsetTargetOf`, so a member shows ITS number). */
function currentNoteOffset(element: InspectedOf<'note' | 'rest' | 'grace' | 'bracketed'>): number {
  return overrideOf<NoteOffsetOverride>(element, 'noteOffset')?.x ?? 0
}

/**
 * ⭐ **Before or after its target** — a selected BRACKETED grace (bracketed-grace-plan P6, his proposal,
 * 2026-09-23: *"in the properties we will have a way to place the bracket before or after the target,
 * default is before as now and the user can change it in properties"*). `after` is disabled where the
 * target has no after side (a grace, a rest). A DUMB PUBLISHER: `bus.bracketedSide`, applied by
 * `propertyControllers/BracketedSideController`.
 */
function buildBracketedSideSelect(pitchId: string, info: { side: 'before' | 'after'; canBeAfter: boolean }): HTMLElement {
  const wrap = document.createElement('label')
  const ws = wrap.style
  ws.display = 'flex'
  ws.alignItems = 'center'
  ws.gap = '6px'
  ws.color = BISHOP
  ws.margin = '2px 0 4px'
  wrap.title = info.canBeAfter
    ? 'Which side of its note the bracketed grace stands on: left (before it) or right (after it).'
    : 'Its note is a grace or a rest, which takes a bracketed grace on its left only.'

  const caption = document.createElement('span')
  caption.textContent = 'position' // his call: a word the user understands at a glance
  wrap.appendChild(caption)

  const select = document.createElement('select')
  const ss = select.style
  ss.font = 'inherit'
  ss.color = BISHOP
  ss.background = 'transparent'
  ss.border = `1px solid ${BISHOP}`
  ss.borderRadius = '2px'
  ss.padding = '1px 4px'
  for (const side of ['before', 'after'] as const) {
    const option = document.createElement('option')
    option.value = side
    // His call (2026-09-23): the simple words — where it is DRAWN — ⛔ not "before its target".
    option.textContent = side === 'before' ? 'left' : 'right'
    if (side === info.side) option.selected = true
    if (side === 'after' && !info.canBeAfter) option.disabled = true
    select.appendChild(option)
  }
  select.addEventListener('change', () => {
    bus.bracketedSide.set({ pitchId, side: select.value as 'before' | 'after' })
  })
  wrap.appendChild(select)
  return wrap
}

/**
 * ⭐ **A pair per note, or one round the whole chord** — a selected head of a chord whose EVERY head wears
 * brackets (parenthesised-note-plan N3/P5, his call: both drawable, default per note; his rule: the switch
 * only works when all the notes are in brackets). A DUMB PUBLISHER: `bus.enclosureSpan`, applied by
 * `propertyControllers/EnclosureSpanController`.
 */
function buildEnclosureSpanSelect(pitchId: string, span: 'chord' | null): HTMLElement {
  const wrap = document.createElement('label')
  const ws = wrap.style
  ws.display = 'flex'
  ws.alignItems = 'center'
  ws.gap = '6px'
  ws.color = BISHOP
  ws.margin = '2px 0 4px'
  wrap.title = 'Brackets on a chord: one pair round each note, or one pair round the whole chord.'

  const caption = document.createElement('span')
  caption.textContent = 'brackets'
  wrap.appendChild(caption)

  const select = document.createElement('select')
  const ss = select.style
  ss.font = 'inherit'
  ss.color = BISHOP
  ss.background = 'transparent'
  ss.border = `1px solid ${BISHOP}`
  ss.borderRadius = '2px'
  ss.padding = '1px 4px'
  for (const [value, label] of [['head', 'each note'], ['chord', 'whole chord']] as const) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    if ((span ?? 'head') === value) option.selected = true
    select.appendChild(option)
  }
  select.addEventListener('change', () => {
    bus.enclosureSpan.set({ pitchId, span: select.value === 'chord' ? 'chord' : null })
  })
  wrap.appendChild(select)
  return wrap
}
