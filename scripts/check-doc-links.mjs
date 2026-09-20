#!/usr/bin/env node
/**
 * `npm run lint:doclinks` — every `docs/<name>.md` a comment or a doc CITES must exist.
 *
 * The code explains itself by pointing at `docs/` — about 1,800 mentions of 120 files — and nothing
 * checked the pointers: on 2026-09-20 six cited files did not exist (27 mentions), some for months.
 * A rule that lives in a doc the reader cannot open is a rule nobody can check. It is also what
 * makes MOVING a doc safe: rewrite the paths, run this, and a missed one is named.
 *
 * Read: `src/`, `e2e/`, `scripts/`, `docs/`, `CLAUDE.md`, `reference/README.md`. A mention is the
 * literal text `docs/….md` (sub-folders allowed). ⚠️ A sentence that says a doc does NOT exist has to
 * spell it without the `docs/` prefix, or list it in KNOWN_ABSENT with its reason.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['src', 'e2e', 'scripts', 'docs']
const FILES = ['CLAUDE.md', 'reference/README.md']
const READ = /\.(ts|mjs|js|md|json|css|html)$/
const MENTION = /docs\/[A-Za-z0-9._/-]+\.md/g

/** Cited on purpose though absent — each with the reason it may stay. Keep this EMPTY if you can. */
const KNOWN_ABSENT = new Map([
  // ['docs/example.md', 'why a dangling name is the honest thing to write here'],
])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (READ.test(entry)) out.push(p)
  }
  return out
}

const files = [...ROOTS.flatMap(r => (existsSync(r) ? walk(r) : [])), ...FILES.filter(f => existsSync(f))]
const missing = new Map() // cited path → [file:line]
let mentions = 0
for (const file of files) {
  if (file === 'scripts/check-doc-links.mjs') continue
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const cited of line.match(MENTION) ?? []) {
      mentions++
      if (existsSync(cited) || KNOWN_ABSENT.has(cited)) continue
      if (!missing.has(cited)) missing.set(cited, [])
      missing.get(cited).push(`${file}:${i + 1}`)
    }
  })
}

if (missing.size === 0) {
  console.log(`✓ Every cited doc exists (${mentions} mentions checked).`)
  process.exit(0)
}
console.error('✗ A comment or a doc cites a file under docs/ that does not exist:\n')
for (const [cited, sites] of [...missing].sort((a, b) => b[1].length - a[1].length)) {
  console.error(`  ${cited}  — ${sites.length} mention${sites.length === 1 ? '' : 's'}`)
  for (const s of sites) console.error(`      ${s}`)
}
console.error('\n  Point the mention at the doc that holds the rule, or write the rule where it is cited.')
process.exit(1)
