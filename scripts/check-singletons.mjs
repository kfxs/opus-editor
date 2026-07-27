#!/usr/bin/env node
/**
 * `npm run lint:singletons` — the check behind a REPO FACT
 * (docs/refactor-plan-2026-07-27.md Phase 0c/0e).
 *
 * THE FACT: `docs/DESIGN-PRINCIPLES.md` boundary case 5 counts the module-level singletons that make
 * "exactly one editor" an assumption, and its whole cost argument is that de-singletoning would be
 * *"a contained sweep **because the list is known and short**"*. That argument is only as good as the
 * number. When it was written the doc said thirteen; by 2026-07-27 there were 26, and the two
 * independent recounts in the refactor plan itself said 24 and 25 — three different numbers for one
 * greppable fact, which is exactly the rot Phase 0c exists to stop. A design claim ("N:M is two ints")
 * cannot rot because the code enforces it; a repo claim ("there are N of these") can, so it gets a
 * script instead of a promise.
 *
 * THE RULE, mechanical on purpose: a module-level `export const <camelCase> = new …`, `= {…}`, or
 * `= someFactory(…)`. That works with no hand-maintained list because the codebase is
 * consistent about naming — a mutable state singleton is camelCase (`bus`, `menus`,
 * `menuActions`), while a constant lookup table is SCREAMING_SNAKE (`WINDOW_DEFAULTS`,
 * `NUMPAD_CODE_TO_KEY`, `MARKING_TOOL_USES_ARMED_LENGTH`). Verified 2026-07-27: the rule finds 6
 * with no false positives and no misses.
 *
 * ⚠️ The factory-call form was added in Phase 3b, and it is why the rule is worth re-reading rather
 * than trusting. Collapsing the twenty-one bus stores into one object turned the biggest singleton
 * in the codebase into `export const bus = createEditorBus()` — which the original two forms did NOT
 * match. The count would have fallen from 26 to 5 and looked like a clean win, with the one
 * singleton that matters most invisible to its own check.
 *
 * If that naming convention is ever broken, this check is what notices — which is the point.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = 'src'
const DOC = 'docs/DESIGN-PRINCIPLES.md'

/** A module-level `export const camelCase = new X(…)`, `= { … }` or `= createX(…)`. */
const SINGLETON = /^export const ([a-z][A-Za-z0-9_$]*)(?::[^=]+)? = (?:new [A-Za-z]|\{|[a-z][A-Za-z0-9_$]*\()/

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(p)
  }
  return out
}

const found = []
for (const file of walk(SRC)) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    const m = SINGLETON.exec(line)
    if (m) found.push({ name: m[1], file: relative('.', file).replace(/\\/g, '/'), line: i + 1 })
  })
}

found.sort((a, b) => a.name.localeCompare(b.name))

const doc = readFileSync(DOC, 'utf8')
const claim = /(\d+) module-level singletons/.exec(doc)

if (!claim) {
  console.error(`\n✗ ${DOC} no longer states a singleton count.\n`)
  console.error(`  Expected a phrase like "26 module-level singletons" in boundary case 5.`)
  console.error(`  The count is load-bearing there: the "contained sweep" argument rests on it.\n`)
  process.exit(1)
}

const claimed = Number(claim[1])

if (claimed !== found.length) {
  console.error(`\n✗ singleton count drifted: ${DOC} claims ${claimed}, the code has ${found.length}.\n`)
  for (const f of found) console.error(`  ${f.name.padEnd(32)} ${f.file}:${f.line}`)
  console.error(`
  Update the number in ${DOC} (boundary case 5) — and read what it says while you are
  there. It is not a tidiness count: that entry's argument for de-singletoning being cheap is
  "a contained sweep BECAUSE the list is known and short". Every addition weakens it, so a new
  singleton is a decision, not a detail.
`)
  process.exit(1)
}

console.log(`✓ ${found.length} module-level singletons, matching ${DOC}.`)
