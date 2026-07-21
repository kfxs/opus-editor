import { setDebugLogging } from '@/utils/debug'
import './style.css'
import { createEditorApp } from './App'

// The ONE place the bundler's environment reaches the app: gate the development trace logs (dbg)
// to `npm run dev`. A production `vite build` leaves the switch off, so every dbg() is silent —
// while the framework-agnostic core stays ignorant of Vite and just calls dbg(). See docs/logging.md.
// The cast mirrors ScoreModel's: the project carries no `vite/client` ambient types, so `import.meta`
// is typed without `.env` here. `DEV` is true under `npm run dev`, false in a production build.
const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ?? false
setDebugLogging(isDev)
// The menu layer wires ITSELF to the box the window layer donates (windows.whenMounted). All this
// line does is make sure the module is loaded — the alternative would be App knowing menus exist.
import '@/menus'

const host = document.getElementById('app')
if (!host) throw new Error('#app not found — index.html must provide the mount point')
createEditorApp(host)
