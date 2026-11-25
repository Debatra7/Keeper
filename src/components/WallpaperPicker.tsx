import { useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';

type WallpaperPickerProps = {
  urls: string[];
  selectedUrl: string;
  onChange: (urls: string[]) => void;
  onSelect: (url: string) => void;
  onDelete: (url: string) => void;
};

function WallpaperPreview({ url, selected, refresh, onSelect, onDelete }: { url: string; selected: boolean; refresh: number; onSelect: () => void; onDelete: () => void }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [refresh]);
  const previewUrl = new URL(url);
  previewUrl.searchParams.set('_keeper_refresh', String(refresh));

  return <div className={`wallpaper-tile ${selected ? 'selected' : ''}`}>
    <button type="button" className="wallpaper-select" aria-label="Use this wallpaper" aria-pressed={selected} onClick={onSelect}>
      {failed ? <span className="wallpaper-image-fallback">Preview unavailable</span> : <img src={previewUrl.href} alt="Wallpaper preview" onError={() => setFailed(true)} onLoad={() => setFailed(false)}/>}
    </button>
    <button type="button" className="wallpaper-delete" aria-label="Delete saved wallpaper" onClick={onDelete}><Trash2 size={13}/></button>
  </div>;
}

export function WallpaperPicker({ urls, selectedUrl, onChange, onSelect, onDelete }: WallpaperPickerProps) {
  const [input, setInput] = useState('');
  const [refresh, setRefresh] = useState(0);
  const add = () => {
    const url = input.trim();
    if (!/^https:\/\//i.test(url)) return;
    if (!urls.includes(url)) onChange([url, ...urls].slice(0, 25));
    setInput('');
    onSelect(url);
  };

  return <div className="wallpaper-picker">
    <div className="wallpaper-gallery" aria-label={`Saved wallpapers, ${urls.length} of 25`}>
      {urls.map(url => <WallpaperPreview key={url} url={url} selected={selectedUrl === url} refresh={refresh} onSelect={() => onSelect(url)} onDelete={() => onDelete(url)}/>) }
      <button type="button" className="wallpaper-tile wallpaper-refresh" disabled={!urls.length} onClick={() => setRefresh(value => value + 1)} aria-label="Refresh wallpaper previews" title="Refresh previews"><RotateCcw size={15}/></button>
      {!urls.length && <p className="wallpaper-gallery-empty">Add an image URL to generate its preview.</p>}
    </div>
    <div className="wallpaper-add">
      <input className="field settings-input" type="url" placeholder="Paste an image URL (https://...)" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => event.key === 'Enter' && add()}/>
      <button type="button" className="primary-button" disabled={urls.length >= 25 || !/^https:\/\//i.test(input.trim())} onClick={add}>Add URL</button>
    </div>
    <small className="settings-help">Saved URLs sync when you save settings. Select a working preview to use it.</small>
  </div>;
}
