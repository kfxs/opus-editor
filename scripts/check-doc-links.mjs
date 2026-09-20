#!/usr/bin/env node
/**
 * `npm run lint:doclinks` — every `docs/<name>.md` a comment or a doc CITES must exist.
 *
 * The code explains itself by pointing at `docs/` — about 1,800 mentions of 120 files — and nothing
 * checked the pointers: on 2026-09-20 six cited files did not exist (27 mentions), some for months.
 * A rule that lives in a doc the reader cannot open is a rule nobody can check. It is also what
 * makes MOVING a doc safe: rewrite the paths, run this, and a missed one is named.
 *
 * Read: the whole repo but `node_modules/`, `dist/`, `.git/` and the gitignored library under
 * `reference/` (its `README.md` IS read). Two kinds of mention:
 *  - the literal text `docs/….md` (sub-folders allowed), anywhere;
 *  - a RELATIVE markdown link `](name.md)` / `](../folder/name.md)` inside a file under `docs/`,
 *    resolved from that file's own folder — the index and the docs' cross-links.
 * ⚠️ A sentence that says a doc does NOT exist has to spell it without the `docs/` prefix, or list
 * it in KNOWN_ABSENT with its reason.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, dirname, normalize } from 'node:path'

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'reference', 'test-results', 'playwright-report'])
const FILES = ['reference/README.md']
const READ = /(\.(ts|mjs|js|md|json|css|html)|^NOTICE)$/
const MENTION = /docs\/[A-Za-z0-9._/-]+\.md/g
/** `](x.md`, `](./x.md`, `](../y/x.md` — a relative link; ⛔ not a URL, not an absolute path. */
const RELATIVE_LINK = /\]\(((?:\.\.?\/)*[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\.md)(?:#[^)]*)?\)/g

/** Cited on purpose though absent — each with the reason it may stay. Keep this EMPTY if you can. */
const KNOWN_ABSENT = new Map([
  // ['docs/example.md', 'why a dangling name is the honest thing to write here'],
])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (READ.test(entry)) out.push(p)
  }
  return out
}

const files = [...walk('.'), ...FILES.filter(f => existsSync(f))].map(f => normalize(f))
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
    if (!file.startsWith('docs/')) return
    for (const m of line.matchAll(RELATIVE_LINK)) {
      mentions++
      const target = normalize(join(dirname(file), m[1]))
      if (existsSync(target)) continue
      if (!missing.has(target)) missing.set(target, [])
      missing.get(target).push(`${file}:${i + 1} (relative link \`${m[1]}\`)`)
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
