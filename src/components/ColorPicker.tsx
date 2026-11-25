import { Ban, Palette } from 'lucide-react';

export const COLOR_PRESETS = ['#f08f9b', '#e6b879', '#e6dc79', '#88c5a4', '#80c9db', '#a8b5ff', '#c5a6ff'];

export function ColorPicker({ value, onChange, label, fallbackColor = '#a8b5ff', allowNone = false }: {
  value: string;
  onChange: (color: string) => void;
  label: string;
  fallbackColor?: string;
  allowNone?: boolean;
}) {
  const customPicker = <label className="color-picker-custom" title="Choose a custom color">
    <Palette size={14} aria-hidden="true"/><input type="color" aria-label={`${label}: custom color`} value={value || fallbackColor} onChange={event => onChange(event.target.value)}/>
  </label>;

  return <div className="color-picker" role="group" aria-label={label}>
    {allowNone && <button type="button" className={`color-none ${!value ? 'chosen' : ''}`} aria-label={`${label}: no color`} aria-pressed={!value} title="No color" onClick={() => onChange('')}><Ban size={17}/></button>}
    {COLOR_PRESETS.map(color => <button key={color} type="button" className={`color-swatch ${value === color ? 'chosen' : ''}`} style={{ background: color }} aria-label={`${label}: ${color}`} aria-pressed={value === color} title={color} onClick={() => onChange(color)}/>)}
    {customPicker}
  </div>;
}
