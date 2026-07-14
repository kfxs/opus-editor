import { WindowLayer } from './WindowLayer'

/**
 * The app's one window layer.
 *
 * It lives here — plain TS — and not in `App.vue`, so that ANY framework-agnostic module can open a
 * window by importing it: a shortcut handler, a controller in `interactions/`, the engine. If the
 * instance lived in the Vue component, that component would have to hand it to every opener, and
 * "add a window" would mean "edit App.vue" — the one thing docs/windows-design.md forbids.
 *
 * `App.vue`'s entire share is therefore TWO lines, and both exist only because Vue owns the DOM node
 * and the lifecycle hooks:
 *
 *   onMounted(()   => windows.mount(scoreViewport.value))   // here is the box
 *   onUnmounted(() => windows.destroy())                    // and here is how long it lives
 *
 * The app donates a box. The window system does everything else.
 */
export const windows = new WindowLayer()
