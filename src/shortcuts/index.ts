/**
 * Keyboard shortcuts module
 *
 * Provides a centralized way to manage keyboard shortcuts.
 *
 * Usage in a Vue component:
 *
 * import { ShortcutManager } from '@/shortcuts'
 *
 * const shortcuts = new ShortcutManager()
 *
 * onMounted(() => {
 *   shortcuts.registerActions({
 *     'setEntryMode': () => { selectedTool.value = 'entry' },
 *     'setSelectionMode': () => { selectedTool.value = 'selection' },
 *     'deleteSelected': () => { deleteSelectedNote() },
 *   })
 *   shortcuts.enable()
 * })
 *
 * onUnmounted(() => {
 *   shortcuts.disable()
 * })
 */

export { ShortcutManager, type ActionHandler } from './ShortcutManager'
export { SHORTCUTS, getShortcutList, type ShortcutDefinition } from './ShortcutConfig'
