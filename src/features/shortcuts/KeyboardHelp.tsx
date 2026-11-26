import { useEffect, useState } from 'react';
import { Command, RotateCcw, X } from 'lucide-react';
import {
  DEFAULT_SHORTCUTS,
  readShortcutBindings,
  saveShortcutBindings,
  type ShortcutAction,
  type ShortcutBinding,
} from '../../hooks/useKeyboardShortcuts';

const IS_MAC = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
const MOD = IS_MAC ? '⌘' : 'Ctrl';

const SHORTCUTS: {
  action: ShortcutAction;
  label: string;
  section: string;
  note?: string;
}[] = [
  { action: 'search', label: 'Quick search', section: 'Navigate' },
  { action: 'dashboard', label: 'Home / Dashboard', section: 'Navigate' },
  {
    action: 'add-site',
    label: 'Add a website',
    section: 'Actions',
    note: 'inside a collection',
  },
  { action: 'settings', label: 'Settings', section: 'App' },
  { action: 'help', label: 'Show this help', section: 'App' },
  { action: 'help', label: 'Close / dismiss', section: 'App', note: 'Esc' },
];

const SECTIONS = ['Navigate', 'Actions', 'App'];

export function KeyboardHelp({ onClose }: { onClose: () => void }) {
  const [bindings, setBindings] = useState(readShortcutBindings);
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const refresh = () => setBindings(readShortcutBindings());
    window.addEventListener('keeper:shortcuts-change', refresh);
    return () => window.removeEventListener('keeper:shortcuts-change', refresh);
  }, []);
  useEffect(() => {
    if (!recording) return;
    (window as Window & { __keeperShortcutRecording?: boolean }).__keeperShortcutRecording = true;
    const capture = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setRecording(null);
        setMessage('Shortcut change cancelled.');
        return;
      }
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return;
      const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
      if (!hasModifier) {
        setMessage('Include Ctrl/⌘ or Alt in the shortcut.');
        return;
      }
      const binding: ShortcutBinding = {
        key: event.key.toLowerCase(),
        ctrl: event.ctrlKey || event.metaKey,
        shift: event.shiftKey,
        alt: event.altKey,
      };
      const conflict = (
        Object.entries(bindings) as [ShortcutAction, ShortcutBinding | null][]
      ).find(
        ([action, value]) =>
          action !== recording &&
          !!value &&
          value.key === binding.key &&
          value.ctrl === binding.ctrl &&
          value.shift === binding.shift &&
          value.alt === binding.alt
      );
      event.preventDefault();
      event.stopImmediatePropagation();
      if (conflict) {
        setMessage(
          `That shortcut is already assigned to ${SHORTCUTS.find((row) => row.action === conflict[0])?.label ?? conflict[0]}.`
        );
        return;
      }
      const next = { ...bindings, [recording]: binding };
      setBindings(next);
      saveShortcutBindings(next);
      setRecording(null);
      setMessage('Shortcut updated.');
    };
    window.addEventListener('keydown', capture, true);
    return () => {
      window.removeEventListener('keydown', capture, true);
      (window as Window & { __keeperShortcutRecording?: boolean }).__keeperShortcutRecording =
        false;
    };
  }, [bindings, recording]);
  const formatBinding = (binding: ShortcutBinding | null) =>
    binding
      ? [
          binding.ctrl ? MOD : '',
          binding.alt ? (IS_MAC ? '⌥' : 'Alt') : '',
          binding.shift ? '⇧' : '',
          binding.key === ' ' ? 'Space' : binding.key.toUpperCase(),
        ].filter(Boolean)
      : ['Not set'];

  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ zIndex: 50 }}
    >
      <div className="modal kb-help-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={17} />
        </button>

        <span className="modal-icon">
          <Command size={20} />
        </span>
        <div className="modal-eyebrow">KEYBOARD SHORTCUTS</div>
        <h2>Quick reference</h2>
        <p>
          Customize shortcuts for this browser. Keeper intercepts matching keys when the browser
          delivers them to the page; browser-reserved shortcuts may still take precedence.
        </p>

        {SECTIONS.map((section) => {
          const rows = SHORTCUTS.filter((r) => r.section === section);
          return (
            <div key={section} className="kb-section">
              <div className="kb-section-label">{section.toUpperCase()}</div>
              <ul className="kb-list">
                {rows.map((row) => {
                  const keys = row.note === 'Esc' ? ['Esc'] : formatBinding(bindings[row.action]);
                  return (
                    <li key={row.label} className="kb-row">
                      <span className="kb-keys">
                        {keys.map((k, i) => (
                          <span key={i}>
                            <kbd className="kb-key">{k}</kbd>
                            {i < keys.length - 1 && <span className="kb-plus">+</span>}
                          </span>
                        ))}
                      </span>
                      <span className="kb-desc">
                        {row.label}
                        {row.note && row.note !== 'Esc' && (
                          <span className="kb-note"> — {row.note}</span>
                        )}
                      </span>
                      {row.note !== 'Esc' && (
                        <button
                          type="button"
                          className="kb-customize"
                          onClick={() => {
                            setMessage('Press your shortcut now. Escape cancels.');
                            setRecording(row.action);
                          }}
                        >
                          {recording === row.action ? 'Press keys…' : 'Customize'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        <div className="kb-customize-footer">
          <span className="kb-note" role="status">
            {message || 'Shortcuts are saved in this browser.'}
          </span>
          <button
            type="button"
            className="kb-reset"
            onClick={() => {
              const defaults = Object.fromEntries(
                Object.entries(DEFAULT_SHORTCUTS).map(([action, value]) => [
                  action,
                  value && { ...value },
                ])
              ) as Record<ShortcutAction, ShortcutBinding | null>;
              setBindings(defaults);
              saveShortcutBindings(defaults);
              setRecording(null);
              setMessage('Default shortcuts restored.');
            }}
          >
            <RotateCcw size={13} /> Reset defaults
          </button>
        </div>
      </div>
    </div>
  );
}
