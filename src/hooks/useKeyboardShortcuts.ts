import { useEffect, useCallback } from 'react';

/** Returns true when the event originates from a text-entry element. */
function isTyping(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export type ShortcutAction =
  | 'add-site'
  | 'new-collection'
  | 'dashboard'
  | 'search'
  | 'settings'
  | 'help';

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
 * All shortcuts use Ctrl (⌘ on macOS) and are carefully chosen to avoid
 * browser-level conflicts.
 *
 * CONFLICT ANALYSIS
 * ─────────────────
 * REMOVED / CHANGED from previous version:
 *   Ctrl+A  → "Select All"      — browser intercepts first          → Ctrl+Shift+A
 *   Ctrl+N  → "New Window"      — JS CANNOT preventDefault() this   → Ctrl+Shift+K
 *   Ctrl+D  → "Bookmark page"   — browser intercepts first          → Ctrl+Shift+H
 *   Ctrl+1–9→ "Switch tab 1–9"  — JS CANNOT preventDefault() this   → REMOVED
 *
 * KEPT (zero browser conflict):
 *   Ctrl+K  → no standard browser binding (app pattern: VS Code, Linear, Slack)
 *   Ctrl+,  → no standard browser binding (universal settings pattern)
 *   Ctrl+/  → no standard browser binding
 *   Escape  → handled separately; never conflicts
 *
 * SAFE NEW BINDINGS:
 *   Ctrl+Shift+A  → Ctrl+A (select-all) conflict fully avoided via Shift
 *   Ctrl+Shift+H  → Ctrl+H opens History; the Shift variant is UNBOUND in all major browsers
 *   Ctrl+Shift+K  → No universal binding in Chrome/Edge; Firefox console is developer-only
 *
 * Shortcut map:
 *   Ctrl+K         → Quick search
 *   Ctrl+Shift+A   → Add a website (only when inside a collection)
 *   Ctrl+Shift+K   → New collection
 *   Ctrl+Shift+H   → Home / Dashboard
 *   Ctrl+,         → Settings
 *   Ctrl+/         → Keyboard shortcuts help
 *   Escape         → Close / dismiss  (handled in App.tsx directly)
 */
export function useKeyboardShortcuts({
  hasActiveCollection,
  onShortcut,
}: Options) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      const typing = isTyping(e);
      const key = e.key.toLowerCase();
      const shift = e.shiftKey;

      // ── Ctrl+K ─ Quick search ────────────────────────────────────────────
      // No browser conflict. Established app shortcut (VS Code, Slack, Linear).
      if (key === 'k' && !shift && !typing) {
        e.preventDefault();
        onShortcut({ action: 'search' });
        return;
      }

      // ── Ctrl+Shift+A ─ Add a website ─────────────────────────────────────
      // Plain Ctrl+A = "Select All" — a universal browser/OS binding we must
      // not steal. Adding Shift makes it collision-free across all browsers.
      // Only fires when the user is inside an active collection.
      if (key === 'a' && shift && !typing) {
        if (hasActiveCollection) {
          e.preventDefault();
          onShortcut({ action: 'add-site' });
        }
        return;
      }

      // ── Ctrl+Shift+K ─ New collection ────────────────────────────────────
      // Ctrl+N = "New Window" — JS cannot preventDefault() this; the browser
      // acts on it before the event reaches the page. Ctrl+Shift+N = Incognito.
      // Ctrl+Shift+K: no binding in Chrome/Edge. Firefox uses it for the
      // Browser Console (a developer tool, not everyday user path).
      if (key === 'k' && shift && !typing) {
        e.preventDefault();
        onShortcut({ action: 'new-collection' });
        return;
      }

      // ── Ctrl+Shift+H ─ Home / Dashboard ──────────────────────────────────
      // Ctrl+D = "Bookmark this page" in Chrome/Edge/Firefox.
      // Ctrl+H = "Open History" — also a browser binding.
      // Ctrl+Shift+H has NO standard binding in Chrome, Edge, Firefox, or Safari.
      if (key === 'h' && shift && !typing) {
        e.preventDefault();
        onShortcut({ action: 'dashboard' });
        return;
      }

      // ── Ctrl+, ─ Settings ─────────────────────────────────────────────────
      // The universal settings shortcut across desktop apps (VS Code, Slack,
      // Discord, Figma, etc.). No browser ever uses this key combination.
      if (key === ',' && !shift && !typing) {
        e.preventDefault();
        onShortcut({ action: 'settings' });
        return;
      }

      // ── Ctrl+/ ─ Keyboard shortcuts help ─────────────────────────────────
      // No browser binding. Slash is widely used for "show help / shortcuts"
      // in web apps (GitHub, Notion, Linear).
      if (key === '/' && !shift && !typing) {
        e.preventDefault();
        onShortcut({ action: 'help' });
        return;
      }

      // NOTE: Ctrl+1–9 (jump to collection) was deliberately removed.
      // Those key combos switch browser tabs at the OS/browser level and
      // cannot be intercepted via preventDefault() in any major browser.
    },
    [hasActiveCollection, onShortcut]
  );

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}
