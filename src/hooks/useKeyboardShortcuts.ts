import { useEffect, useCallback } from 'react';

export type ShortcutAction = 'add-site' | 'dashboard' | 'search' | 'settings' | 'help';
export type ShortcutBinding = { key: string; ctrl: boolean; shift: boolean; alt: boolean };
export const DEFAULT_SHORTCUTS: Record<ShortcutAction, ShortcutBinding | null> = {
  search: { key: 'k', ctrl: true, shift: false, alt: false },
  'add-site': { key: 'a', ctrl: true, shift: true, alt: false },
  dashboard: { key: 'h', ctrl: true, shift: true, alt: false },
  settings: { key: ',', ctrl: true, shift: false, alt: false },
  help: { key: '/', ctrl: true, shift: false, alt: false },
};
const SHORTCUTS_STORAGE_KEY = 'keeper-shortcuts';
const SHORTCUTS_CHANGE_EVENT = 'keeper:shortcuts-change';
const PREVIOUS_DEFAULTS: Partial<Record<ShortcutAction, ShortcutBinding[]>> = {
  search: [{ key: 'k', ctrl: true, shift: false, alt: false }],
};

export function readShortcutBindings(): Record<ShortcutAction, ShortcutBinding | null> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SHORTCUTS_STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return DEFAULT_SHORTCUTS;
    return Object.fromEntries(Object.entries(DEFAULT_SHORTCUTS).map(([action, fallback]) => {
      const value = (saved as Record<string, unknown>)[action];
      const valid = value && typeof value === 'object' && typeof (value as ShortcutBinding).key === 'string' && ['ctrl', 'shift', 'alt'].every(key => typeof (value as unknown as Record<string, unknown>)[key] === 'boolean');
      const binding = valid ? value as ShortcutBinding : fallback;
      const previous = PREVIOUS_DEFAULTS[action as ShortcutAction];
      const wasPreviousDefault = previous?.some(item => Object.keys(item).every(key => (binding as unknown as Record<string, unknown>)[key] === (item as unknown as Record<string, unknown>)[key]));
      return [action, valid && wasPreviousDefault ? fallback : binding];
    })) as Record<ShortcutAction, ShortcutBinding | null>;
  } catch { return DEFAULT_SHORTCUTS; }
}

export function saveShortcutBindings(bindings: Record<ShortcutAction, ShortcutBinding | null>): void {
  try { localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(bindings)); } catch { /* Keep shortcut changes in this page session. */ }
  window.dispatchEvent(new Event(SHORTCUTS_CHANGE_EVENT));
}

/** Returns true when the event originates from a text-entry element. */
function isTyping(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  return target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
}

export interface ShortcutEvent {
  action: ShortcutAction;
}

interface Options {
  /** Whether there is a collection currently active (affects add-site). */
  hasActiveCollection: boolean;
  /** Called when a shortcut fires. */
  onShortcut: (event: ShortcutEvent) => void;
}

/**
 * Registers global keyboard shortcuts for Keeper.
 * Shortcuts use Ctrl (⌘ on macOS). Matching page-delivered events are
 * intercepted in capture phase; browser-reserved commands may preempt a page.
 */
export function useKeyboardShortcuts({
  hasActiveCollection,
  onShortcut,
}: Options) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if ((window as Window & { __keeperShortcutRecording?: boolean }).__keeperShortcutRecording) return;
      const typing = isTyping(e);
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl && !e.altKey) return;
      const key = e.key.toLowerCase();
      const bindings = readShortcutBindings();
      const match = (Object.entries(bindings) as [ShortcutAction, (ShortcutBinding | null)][]).find(([, binding]) =>
        !!binding && binding.key.toLowerCase() === key && binding.ctrl === ctrl && binding.shift === e.shiftKey && binding.alt === e.altKey
      );
      if (!match) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if ((typing && match[0] !== 'search') || e.repeat || (match[0] === 'add-site' && !hasActiveCollection)) return;
      onShortcut({ action: match[0] });
    },
    [hasActiveCollection, onShortcut]
  );

  useEffect(() => {
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [handler]);
}
