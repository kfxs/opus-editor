#!/usr/bin/env node
/**
 * `npm run audit:tests` — the split-completion REPORT (docs/test-layout-plan.md, phase 3a).
 *
 * Lists every source module that has no spec naming it. This is the check that fires on the split
 * shape this repo actually uses: an extraction that KEEPS the parent. Pull `rebarOps` out of
 * `ScoreModel` and `ScoreModel.test.ts` stays green — nothing anywhere notices that 1,390 lines of
 * logic are now specced only under their old parent's name. This does.
 *
 * It is deliberately NOT a gate:
 *  - a listed module is usually tested, through its parent's spec. That is legitimate — unchanged
 *    parent tests staying green is the evidence the behaviour survived the split. The entry says
 *    "this module's spec still lives under its parent's name", which is a to-do, not a defect;
 *  - plenty of modules should never have a spec of their own (colour tables, config, barrels).
 *
 * So it exits 0, always. The hard gate is the other direction — `npm run lint:testnames` (3b).
 *
 * The headline list is the logic layers (`engine/`, `utils/`, `types/`) — the ones the score-layer
 * package would be carved out of, and where an unfinished split costs the most. The UI layers are
 * counted, not listed, because they are mostly one-line selector modules; `--all` lists them too.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, basename, relative } from 'node:path'

const SRC = 'src'
const SHOW_ALL = process.argv.includes('--all')

/** The layers this report speaks about by default. */
const HEADLINE = ['src/engine', 'src/utils', 'src/types']

/** Modules that legitimately have no spec of their own — data tables, config, barrels, entry points. */
const NO_SPEC_EXPECTED = [
  /\/index\.ts$/,            // barrels re-export; the spec belongs to what they re-export
  /Colors\.ts$/,             // voiceColors / chromeColors / selectionColors — colour tables
  /\/debug\.ts$/,
  /\/fontStack\.ts$/,
  /\/layoutConfig\.ts$/,
  /\/main\.ts$/,
  /\/ghostTypes\.ts$/,       // a `type` union and nothing else — no runtime to have a contract
  /\/bravuraMetrics\.ts$/,   // GENERATED font data — its contract is `fontMetrics.test.ts`, and a
                             //   spec of its own could only restate what the script emitted
]

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) out.push(p)
  }
  return out
}

const all = walk(SRC).map(p => relative('.', p).replace(/\\/g, '/'))
const tests = all.filter(f => f.endsWith('.test.ts'))
const sources = all.filter(f => !f.endsWith('.test.ts'))

/** dir → the subjects named by a spec there (`Foo.topic.test.ts` names `Foo`). */
const specSubjects = new Map()
for (const t of tests) {
  const dir = dirname(t)
  if (!specSubjects.has(dir)) specSubjects.set(dir, new Set())
  specSubjects.get(dir).add(basename(t, '.test.ts').split('.')[0])
}

const unspecced = []
for (const s of sources) {
  if (NO_SPEC_EXPECTED.some(re => re.test('/' + s))) continue
  if (specSubjects.get(dirname(s))?.has(basename(s, '.ts'))) continue
  unspecced.push({ rel: s, lines: readFileSync(s, 'utf8').split('\n').length })
}

const isHeadline = u => HEADLINE.some(h => u.rel.startsWith(h + '/'))
const headline = unspecced.filter(isHeadline)
const rest = unspecced.filter(u => !isHeadline(u))
const listed = SHOW_ALL ? unspecced : headline

console.log('Source modules with no spec naming them')
console.log('  — usually specced through a parent whose split never finished. A to-do, not a defect.\n')

let currentDir = null
for (const u of [...listed].sort((a, b) => a.rel.localeCompare(b.rel))) {
  const d = dirname(u.rel)
  if (d !== currentDir) { console.log(`  ${d}/`); currentDir = d }
  console.log(`    ${basename(u.rel).padEnd(30)} ${String(u.lines).padStart(5)} lines`)
}

console.log(`\n  ${listed.length} module${listed.length === 1 ? '' : 's'} in ${SHOW_ALL ? 'src/' : HEADLINE.join(', ')}` +
            ` (of ${sources.length} source modules in src/).`)
if (!SHOW_ALL) {
  console.log(`  ${rest.length} more in the UI layers (dev/, interactions/, menus/, windows/) — mostly` +
              ` one-line\n  selector modules. Run with --all to list them.`)
}

console.log('\nLargest first — where an unfinished split costs the most:')
for (const u of [...listed].sort((a, b) => b.lines - a.lines).slice(0, 8)) {
  console.log(`  ${String(u.lines).padStart(5)}  ${u.rel}`)
}
