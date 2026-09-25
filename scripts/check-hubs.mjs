#!/usr/bin/env node
/**
 * `npm run lint:hubs` — **a new feature adds a MODULE**, as a number (CLAUDE.md;
 * docs/plans/code-shape-plan-2026-09-19.md Phase 2.1).
 *
 * The rule cannot be checked by an import lint: a per-kind slice written into a hub imports exactly
 * what it would have imported from its own module. What CAN be counted is how much a hub knows
 * about individual element kinds, so that is what this counts.
 *
 * Two numbers per hub, comments excluded:
 *
 * - **Kind mentions** — identifier and string tokens that name an element kind (`previewPedalSlot`,
 *   `'hairpin'`, `armOttavaDrag`). This is the measure of a per-kind slice, and denser lines cannot
 *   satisfy it. Its ceiling may only fall, from day one.
 * - **Code lines** — always reported. It gets a ceiling (`lines` below) only once the plan's step
 *   for that hub has emptied it: until then the rule itself allows a facade one delegating line per
 *   feature, and a fall-only ceiling would block a feature until something unrelated was extracted.
 *
 * Two functions are counted OUT by name, because they are switches kept on purpose — exhaustive at
 * one site (`assertNeverElement`), one case per kind, and a new kind legitimately adds its case:
 * Delete (`shortcutWiring`'s `deleteSelected`) and the Properties report
 * (`selectionSnapshot.selectedElements`). See `interactions/elements/chain.ts`'s header.
 *
 * The kind vocabulary is the list below PLUS every `kind: '…'` of the editor's own unions
 * (`SelectedElement`, `MarkingTool` — read out of `EditorState.ts`), so the kind a new feature adds
 * is counted from the commit that adds it; a fixed list would be blind to exactly the growth this
 * exists to see. `rest`, `dot`, `key`, `group` and `note` are never matched as single words — they
 * are everyday identifiers (`dots`, a map's `key`) — and a multi-word kind is matched as its whole
 * name (`keySignature`, `staffGroup`).
 *
 * `node scripts/check-hubs.mjs --detail` prints each hub's count per kind.
 */
import { readFileSync } from 'node:fs'

/** A hub, its ceilings, and the functions counted out of it. `lines: null` = reported, not held. */
// ⚠️ MusicEngine 494 / ScoreModel 928 were RAISED once (grace notes P1, 2026-09-22) — the reason is in
// docs/plans/code-shape-plan-2026-09-19.md, *After the plan*.
const HUBS = [
  { file: 'src/engine/MusicEngine.ts', kinds: 486, lines: null },
  { file: 'src/engine/models/ScoreModel.ts', kinds: 909, lines: null },
  { file: 'src/engine/rendering/ScoreRenderer.ts', kinds: 741, lines: null },
  { file: 'src/interactions/controllers/MouseController.ts', kinds: 258, lines: 1035 },
  { file: 'src/interactions/controllers/PaletteController.ts', kinds: 422, lines: null },
  { file: 'src/interactions/controllers/HighlightController.ts', kinds: 9, lines: 99 },
  { file: 'src/interactions/controllers/shortcutWiring.ts', kinds: 59, lines: 387, except: ['deleteSelected'] },
  { file: 'src/windows/properties/PropertiesWidget.ts', kinds: 0, lines: 73 },
  { file: 'src/interactions/state/selectionSnapshot.ts', kinds: 3, lines: null, except: ['selectedElements'] },
]

/** Where the editor declares its kinds. */
const UNIONS = 'src/interactions/state/EditorState.ts'
/** Kind words the unions spell only inside longer names (`repeatStart`), or not at all. */
const EXTRA_WORDS = ['repeat', 'tie', 'fan']
/** Everyday identifiers: never a kind on their own. */
const STOP_WORDS = new Set(['rest', 'dot', 'key', 'group', 'note'])

/** One camelCase word each, and the multi-word kinds as word sequences. */
const KIND_WORDS = new Set(EXTRA_WORDS)
const KIND_SEQUENCES = []
for (const [, kind] of readFileSync(UNIONS, 'utf8').matchAll(/\bkind: '([A-Za-z]+)'/g)) {
  const ws = words(kind)
  if (ws.length > 1) {
    if (!KIND_SEQUENCES.some(seq => seq.join() === ws.join())) KIND_SEQUENCES.push(ws)
  } else if (!STOP_WORDS.has(ws[0])) KIND_WORDS.add(ws[0])
}
if (KIND_WORDS.size < 10) {
  console.error(`✗ Only ${KIND_WORDS.size} kinds read out of ${UNIONS} — the unions moved. Update scripts/check-hubs.mjs.`)
  process.exit(1)
}

/** Blank out comments, keeping line breaks so line numbers and counts survive. Strings are kept:
 *  a `'hairpin'` literal is a kind mention. ⚠️ Not a parser — a `//` inside a string or a regex
 *  would be cut. Good enough for a count that only has to be stable. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ''))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
}

/**
 * ⭐ `engine.dynamic.addDynamic(…)` names its kind ONCE, as `engine.addDynamic(…)` did. A mark family's
 * commands are reached through a namespace on the facade (`engine/commands/<family>Commands`,
 * docs/plans/code-shape-plan-2026-09-19.md Phase 3.5), and that accessor carries no knowledge the command's
 * own name does not already carry — so it is not a second mention. ⚠️ Narrow on purpose: only a
 * MEMBER access (`.family.`) that is itself followed by a member, and only these families.
 */
const COMMAND_NAMESPACES = ['ottava', 'pedal', 'trill', 'hairpin', 'slur', 'dynamic', 'tempo']
function withoutCommandNamespaces(code) {
  return code.replace(new RegExp(`\\.(?:${COMMAND_NAMESPACES.join('|')})\\.(?=[A-Za-z_])`, 'g'), '.')
}

/**
 * ⭐ An import's PATH is where a module lives, ⛔ not what the hub knows: the names it imports are
 * counted where they are written, and a folder called `marks/dynamics/` would otherwise read as the
 * hub having learned about dynamics (found 2026-09-20, when Phase 6 moved `rendering/` into
 * sub-folders and `ScoreRenderer` "grew" by six without a line of it changing). Only the specifier
 * of `from '…'` and `import('…')` is blanked.
 */
function withoutImportPaths(code) {
  return code.replace(/(\bfrom\s+|\bimport\s*\(\s*)(['"])[^'"\n]*\2/g, (_m, lead, q) => `${lead}${q}${q}`)
}

/** Remove the body of `name` — `name: (…) => {`, `function name(`, or a method `name(` — by brace
 *  matching from its first `{`. */
function withoutFunction(code, name, file) {
  const start = new RegExp(`(?:function\\s+${name}\\s*\\(|\\b${name}\\s*[:=]\\s*(?:async\\s*)?\\(|^\\s+${name}\\s*\\()`, 'm').exec(code)
  if (!start) {
    console.error(`✗ ${file}: \`${name}\` is counted out by name and no longer exists — update scripts/check-hubs.mjs.`)
    process.exit(1)
  }
  // Skip the parameter list, so a destructured `{…}` parameter is not taken for the body.
  let i = code.indexOf('(', start.index)
  for (let depth = 0; i < code.length; i++) {
    if (code[i] === '(') depth++
    else if (code[i] === ')' && --depth === 0) break
  }
  const open = code.indexOf('{', i)
  let depth = 0
  let end = open
  for (; end < code.length; end++) {
    if (code[end] === '{') depth++
    else if (code[end] === '}' && --depth === 0) break
  }
  return code.slice(0, open) + code.slice(open, end + 1).replace(/[^\n]/g, '') + code.slice(end + 1)
}

/** `previewPedalStartAtSlot` → preview, pedal, start, at, slot. Plurals fold onto the singular. */
function words(token) {
  return token
    .split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|[^A-Za-z]+/)
    .filter(Boolean)
    .map(w => w.toLowerCase().replace(/s$/, ''))
}

function kindsIn(token) {
  const ws = words(token)
  const found = []
  ws.forEach((w, i) => {
    if (KIND_WORDS.has(w)) found.push(w)
    for (const seq of KIND_SEQUENCES) if (seq.every((s, j) => ws[i + j] === s)) found.push(seq.join('-'))
  })
  return found
}

const detail = process.argv.includes('--detail')
const failures = []
const falls = []

for (const hub of HUBS) {
  let code = withoutImportPaths(withoutCommandNamespaces(stripComments(readFileSync(hub.file, 'utf8'))))
  for (const name of hub.except ?? []) code = withoutFunction(code, name, hub.file)

  const perKind = new Map()
  let mentions = 0
  for (const token of code.match(/[A-Za-z_$][\w$]*/g) ?? []) {
    // One token is one mention, however many kind words it carries (`hairpinToOttava` is one).
    const found = kindsIn(token)
    if (found.length === 0) continue
    mentions++
    for (const k of found) perKind.set(k, (perKind.get(k) ?? 0) + 1)
  }
  const lines = code.split('\n').filter(l => l.trim() !== '').length

  const name = hub.file.replace(/^src\//, '')
  const held = hub.lines === null ? `${lines} code lines` : `${lines}/${hub.lines} code lines`
  console.log(`  ${name.padEnd(44)} ${String(mentions).padStart(5)}/${String(hub.kinds).padEnd(5)} kind mentions · ${held}`)
  if (detail) {
    const row = [...perKind].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ')
    console.log(`      ${row}`)
  }

  if (mentions > hub.kinds) {
    failures.push(`${name}: ${mentions} kind mentions; the ceiling is ${hub.kinds}.`)
  } else if (mentions < hub.kinds) {
    falls.push(`${name}: kinds ${hub.kinds} → ${mentions}`)
  }
  if (hub.lines !== null) {
    if (lines > hub.lines) failures.push(`${name}: ${lines} code lines; the ceiling is ${hub.lines}.`)
    else if (lines < hub.lines) falls.push(`${name}: lines ${hub.lines} → ${lines}`)
  }
}

if (failures.length) {
  console.error(`\n✗ A hub learned more about individual element kinds.\n`)
  for (const f of failures) console.error(`    ${f}`)
  console.error(`
  A new feature adds a MODULE (CLAUDE.md): the hub may gain a one-line delegation, the kind's logic
  and state live in its own file — interactions/elements/<kind>.ts, engine/models/<kind>Ops.ts, a
  row in the kind's table. If the hub genuinely had to grow, say why in
  docs/plans/code-shape-plan-2026-09-19.md and raise the ceiling in scripts/check-hubs.mjs in the same
  commit — that is a decision, and it should read as one.
`)
  process.exit(1)
}

console.log(`✓ No hub knows more about element kinds than its ceiling allows.`)
if (falls.length) {
  console.log(`⭐ A hub SHRANK — lower its ceiling in scripts/check-hubs.mjs:`)
  for (const f of falls) console.log(`    ${f}`)
}
