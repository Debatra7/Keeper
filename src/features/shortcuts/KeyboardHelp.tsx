import { Command, X } from 'lucide-react';

const IS_MAC = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
const MOD = IS_MAC ? '⌘' : 'Ctrl';

interface ShortcutRow {
  keys: string[];
  label: string;
  note?: string;
  section?: string;
}

const SHORTCUTS: ShortcutRow[] = [
  // Navigation
  { keys: [MOD, 'K'],          label: 'Quick search',          section: 'Navigate' },
  { keys: [MOD, '⇧', 'H'],    label: 'Home / Dashboard',      section: 'Navigate' },
  // Actions
  { keys: [MOD, '⇧', 'A'],    label: 'Add a website',         section: 'Actions', note: 'inside a collection' },
  { keys: [MOD, '⇧', 'K'],    label: 'New collection',        section: 'Actions' },
  // App
  { keys: [MOD, ','],          label: 'Settings',              section: 'App' },
  { keys: [MOD, '/'],          label: 'Show this help',        section: 'App' },
  { keys: ['Esc'],             label: 'Close / dismiss',       section: 'App' },
];

const SECTIONS = ['Navigate', 'Actions', 'App'];

export function KeyboardHelp({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="overlay"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
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
        <p>All shortcuts are browser-safe and work whenever you're not typing in a field.</p>

        {SECTIONS.map(section => {
          const rows = SHORTCUTS.filter(r => r.section === section);
          return (
            <div key={section} className="kb-section">
              <div className="kb-section-label">{section.toUpperCase()}</div>
              <ul className="kb-list">
                {rows.map(row => (
                  <li key={row.label} className="kb-row">
                    <span className="kb-keys">
                      {row.keys.map((k, i) => (
                        <span key={i}>
                          <kbd className="kb-key">{k}</kbd>
                          {i < row.keys.length - 1 && <span className="kb-plus">+</span>}
                        </span>
                      ))}
                    </span>
                    <span className="kb-desc">
                      {row.label}
                      {row.note && <span className="kb-note"> — {row.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
