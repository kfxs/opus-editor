/**
 * The score **file** — a wrapper around the score **model**. Development scaffolding
 * (docs/plans/json-io-plan.md); this is not the final file format and is expected to be replaced
 * wholesale when a real document model lands.
 *
 * Why it is not in the engine: `MusicEngine.exportJSON()` / `loadJSON()` are pure model↔string and
 * should stay that way. An *envelope* — "which app wrote this, when, in what version" — is a file
 * concern, and this module is pure string-in/string-out, which is what puts it in `utils/`.
 *
 * ⚠️ It lived in `dev/` until File ▸ Export JSON put it on the menu bar. Nothing that ships may
 * import the shell, so it moved rather than being copied — same graduation as
 * `interactions/staffSizeToggle`. Provisional it remains; it is simply provisional in a place a
 * built site is allowed to reach.
 *
 * The job is narrow. There are no users and the score model changes constantly, so the point is
 * NOT to preserve old files perfectly — it is that an export taken today still opens tomorrow,
 * and that when it genuinely can't, the console says why instead of the app dying.
 *
 * ⛔ **Report, never repair.** Nothing here clamps a bad meter or invents a missing field. A
 * guessing fallback gets believed. Either the file loads as written, or it is refused and the
 * open score is left exactly as it was.
 */
import type { Score } from '@/types/music'

/** Identifies a file as ours. A file without it is treated as a bare pre-envelope `Score`. */
export const SCORE_FILE_FORMAT = 'opus-editor-score'

/**
 * ⚠️ Bump ONLY when a field changes MEANING — i.e. only when files written before the change
 * stop being readable (dynamics going text-as-truth, `score.clef` being deleted). Adding an
 * optional field is NOT a bump: old files still load, because absence is a legal score.
 *
 * That rule is what makes the number mean exactly one thing — *below this, refuse and say why*.
 * It is a tombstone marker, not a migration hook; we do not build migration paths
 * (docs/plans/json-io-plan.md).
 */
export const SCORE_FILE_VERSION = 1

/**
 * Top-level keys of `Score` that this build knows about.
 *
 * ⚠️ A new `Score` field must be named here too. If it isn't, importing a file written by THIS
 * build warns about a field it models perfectly well — which is worse than noisy, because the
 * warning's whole job is to say *a NEWER build wrote something this one dropped on the floor*, and
 * a false one teaches the reader to ignore the true ones.
 *
 * ⭐⭐ **Which is exactly what happened**: `trills` landed on `Score` and never landed here, so
 * every score containing one reported *"top-level field(s) this build does not know: trills"* (his
 * report, 2026-08-17). ⭐ So the list is no longer written by hand — it is the keys of a
 * `Record<keyof Score, true>`, `measureRenderRoles`' device: a new `Score` field now fails to
 * COMPILE until it is classified, and the drift that produced the false warning cannot recur.
 * ⚠️ Do not "simplify" this back to a string array; the table is doing the work, not the list.
 */
const KNOWN_SCORE_KEYS = Object.keys({
  id: true,
  title: true,
  composer: true,
  measures: true,
  staves: true,
  staffGroups: true,
  slurs: true,
  trills: true,
  engravingOverrides: true,
  playback: true,
} satisfies Record<keyof Score, true>)

/**
 * ⭐⭐ **HOW THE FILE WAS BEING LOOKED AT** — the envelope's one non-score block.
 *
 * > *"i dont want to make decisions about layout in this state of the development cause layout will
 * > be in the future, but the examples should be able (and the json score) to store that
 * > information"* — HIS framing, 2026-09-12, and it is what decides the SHAPE of this.
 *
 * ⛔ **This is NOT the engraving object, and must not be mistaken for it.**
 * `docs/DESIGN-PRINCIPLES.md`'s boundary case *"Where do document-wide ENGRAVING settings live?"*
 * is still **OPEN and deliberately parked**: the eventual answer is a document-level engraving
 * object holding *page size, margins, staff size, ragged-last*, of which `engine/layout/surface.ts`
 * is the first built member. ⛔ Nothing here settles that.
 *
 * ⭐ What it does instead is exploit the fact that **this module is scaffolding** (see the file
 * header): the FILE may carry how the editor was showing the score without the MODEL learning
 * anything, so principle 3 — *"Forbidden: page-layout state in the data model or its JSON"* — keeps
 * its full meaning. ⭐ `Score` gains no field; the compartment sits BESIDE the content, which is the
 * shape the boundary case predicts the real object will take anyway.
 *
 * ⚠️ **Named `view`, ⛔ not `engraving` or `layout`**, on purpose: these are the settings the code
 * already calls *view state* (`EditorState.justifyLastLine`, `ScoreRenderer.justifyLastLine` —
 * *"view state, not a score field"*), and a bolder name would be a claim about the future.
 *
 * ⚠️ Absent means **nothing was stated**, ⛔ never "false" — a file written before this existed must
 * not silently turn a toggle off. Every reader takes `undefined` as "leave the session alone".
 */
export interface ScoreFileView {
  /** Was the LAST system stretched to the page width? ⛔ Absent = the file does not say. */
  justifyLastLine?: boolean
}

interface ScoreFileEnvelope {
  format: string
  version: number
  savedAt: string
  view?: ScoreFileView
  score: unknown
}

/** Outcome of reading a file. `scoreJson` is null when the file was REFUSED. */
interface ReadResult {
  /** JSON to hand to `MusicEngine.loadJSON`, or null if the file cannot be read as a score. */
  scoreJson: string | null
  /** One-line summary for the panel. The console carries the detail. */
  summary: string
  /**
   * ⭐ What the file says about how it was being LOOKED at ({@link ScoreFileView}) — `undefined`
   * when it says nothing, which is every file written before the block existed and every
   * hand-written bare `Score`.
   */
  view?: ScoreFileView
}

/**
 * Wrap the engine's model JSON in the file envelope.
 *
 * Takes the STRING from `exportJSON()` rather than the score object: the model is the engine's,
 * and this module has no business holding a reference to it. Re-parsing to nest it costs a
 * round-trip that nobody will ever notice on a dev button.
 */
export function wrapScoreJson(scoreJson: string, savedAt: string, view?: ScoreFileView): string {
  const envelope: ScoreFileEnvelope = {
    format: SCORE_FILE_FORMAT,
    version: SCORE_FILE_VERSION,
    savedAt,
    // ⭐ Absent stays absent, exactly as `ScoreModel.toJSON` treats a missing title: a caller that
    //   states nothing writes no key, so an export gains no block it did not ask for.
    ...(view && Object.keys(view).length > 0 ? { view } : {}),
    score: JSON.parse(scoreJson),
  }
  return JSON.stringify(envelope, null, 2)
}

/**
 * Read the envelope's {@link ScoreFileView} block, or `undefined` when the file does not carry one.
 *
 * ⛔ **Report, never repair** — the file header's rule, applied to a block whose every member is
 * optional: a `justifyLastLine` that is not a boolean is DROPPED with a warning rather than coerced,
 * because a guessing fallback gets believed. ⚠️ Dropping one member does not refuse the file: this
 * block is how the score was being LOOKED at, and a bad look setting is not a bad score.
 */
function readView(data: Record<string, unknown>): ScoreFileView | undefined {
  const raw = data.view
  if (raw === undefined) return undefined
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    console.warn('[score-file] `view` is not an object — ignored.', raw)
    return undefined
  }
  const view: ScoreFileView = {}
  const justify = (raw as Record<string, unknown>).justifyLastLine
  if (justify !== undefined) {
    if (typeof justify === 'boolean') view.justifyLastLine = justify
    else console.warn('[score-file] `view.justifyLastLine` is not a boolean — ignored.', justify)
  }
  return Object.keys(view).length > 0 ? view : undefined
}

/**
 * Read a file's text into score JSON, or refuse it.
 *
 * Everything it decides is logged: `info` for "this is an older shape, loading it anyway",
 * `warn` for "loaded, but something was dropped or is from the future", `error` for a refusal.
 */
export function readScoreFile(text: string): ReadResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (err) {
    console.error('[score-file] not valid JSON — refused.', err)
    return { scoreJson: null, summary: 'refused: not valid JSON' }
  }

  if (!isRecord(data)) {
    console.error('[score-file] top level is not an object — refused.')
    return { scoreJson: null, summary: 'refused: not a score file' }
  }

  const warnings: string[] = []
  let score: unknown
  // ⚠️ Envelope-only: a bare pre-envelope `Score` has nowhere to put one, and inventing a place
  //    inside the model is exactly what principle 3 forbids.
  let view: ScoreFileView | undefined

  if ('format' in data) {
    if (data.format !== SCORE_FILE_FORMAT) {
      console.error(
        `[score-file] format is ${JSON.stringify(data.format)}, expected ` +
        `"${SCORE_FILE_FORMAT}" — this file was not written by this editor. Refused.`,
      )
      return { scoreJson: null, summary: 'refused: not an opus-editor score' }
    }
    const version = typeof data.version === 'number' ? data.version : 0
    if (version > SCORE_FILE_VERSION) {
      // Try anyway. Optional fields mean a newer file usually still loads; if it doesn't, the
      // failure below is specific, which beats refusing on a number alone.
      warnings.push(`from a newer build (v${version} > v${SCORE_FILE_VERSION})`)
      console.warn(
        `[score-file] written by a newer build (v${version}, this one reads v${SCORE_FILE_VERSION}). ` +
        'Loading anyway — a field may have changed meaning.',
      )
    }
    score = data.score
    view = readView(data)
  } else if (Array.isArray(data.measures)) {
    // Every export taken before the envelope existed, plus all hand-written test JSON.
    console.info('[score-file] no envelope — reading as a bare Score.')
    score = data
  } else {
    console.error('[score-file] no `format` and no `measures` array — not a score. Refused.')
    return { scoreJson: null, summary: 'refused: not a score file' }
  }

  if (!isRecord(score) || !Array.isArray(score.measures)) {
    console.error('[score-file] `score.measures` is missing or not an array — refused.')
    return { scoreJson: null, summary: 'refused: no measures' }
  }

  const unknown = Object.keys(score).filter(k => !(KNOWN_SCORE_KEYS as readonly string[]).includes(k))
  if (unknown.length) {
    // The signal that a newer build wrote something this one does not model. Not fatal: the field
    // survives the round-trip through `loadJSON` (nothing strips it), it just isn't understood.
    warnings.push(`${unknown.length} unknown field(s)`)
    console.warn(`[score-file] top-level field(s) this build does not know: ${unknown.join(', ')}`)
  }

  const bars = score.measures.length
  return {
    scoreJson: JSON.stringify(score),
    summary: warnings.length
      ? `loaded ${bars} bars — ${warnings.join('; ')} (see console)`
      : `loaded ${bars} bars`,
    ...(view ? { view } : {}),
  }
}

/** A filesystem-safe name for a score, e.g. "String Quartet no. 2" → `string-quartet-no-2.json`. */
export function scoreFilename(title: string | undefined): string {
  const slug = (title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'score'}.json`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
