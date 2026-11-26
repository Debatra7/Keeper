import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export const FONT_SIZES = [
  { label: 'Small', value: 14 },
  { label: 'Medium', value: 16 },
  { label: 'Large', value: 20 },
  { label: 'Extra large', value: 24 },
] as const;
export type FontSize = (typeof FONT_SIZES)[number]['value'];

export function FontSizeSelector({
  value,
  onChange,
  label = 'Font size',
}: {
  value: FontSize;
  onChange: (size: FontSize) => void;
  label?: string;
}) {
  return (
    <fieldset className="font-size-control">
      <legend>{label}</legend>
      <div>
        {FONT_SIZES.map((option) => (
          <button
            type="button"
            key={option.value}
            className={value === option.value ? 'chosen' : ''}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function FontSelector({
  value,
  options,
  onChange,
  size,
  onSizeChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (font: string) => void;
  size?: FontSize;
  onSizeChange?: (size: FontSize) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="font-picker">
      <button
        type="button"
        className="font-picker-trigger"
        aria-expanded={open}
        aria-controls="font-options"
        onClick={() => setOpen((show) => !show)}
      >
        <span>
          <strong>{value}</strong>
          <small style={{ fontFamily: `'${value}', sans-serif` }}>Aa · The quick brown fox</small>
        </span>
        <ChevronDown
          size={16}
          className={open ? 'font-picker-chevron open' : 'font-picker-chevron'}
        />
      </button>
      {open && (
        <div className="font-selector" id="font-options" role="group" aria-label="Choose a font">
          {options.map((font) => (
            <button
              key={font}
              type="button"
              className={`font-option ${value === font ? 'selected' : ''}`}
              onClick={() => {
                onChange(font);
                setOpen(false);
              }}
              aria-pressed={value === font}
            >
              <span className="font-option-name">{font}</span>
              <span className="font-option-preview" style={{ fontFamily: `'${font}', sans-serif` }}>
                The quick brown fox
              </span>
              {value === font && <span className="font-option-current">Selected</span>}
            </button>
          ))}
        </div>
      )}
      {size !== undefined && onSizeChange && (
        <FontSizeSelector value={size} onChange={onSizeChange} />
      )}
    </div>
  );
}
