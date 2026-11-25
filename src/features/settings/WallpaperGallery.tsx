import { useState } from 'react';
import { Trash2 } from 'lucide-react';

function WallpaperTile({ url, selected, onSelect, onDelete }: {
  url: string;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* The saved URL is still represented in the gallery. */ }

  return <div className={`wallpaper-tile ${selected ? 'selected' : ''}`}>
    <button type="button" className="wallpaper-select" aria-label={`Use wallpaper from ${host}`} aria-pressed={selected} onClick={onSelect}>
      {imageFailed ? <span className="wallpaper-image-fallback"><span>Preview unavailable</span><small>{host}</small></span> : <img src={url} alt={`Wallpaper preview from ${host}`} onError={() => setImageFailed(true)}/>}
    </button>
    <button type="button" className="wallpaper-delete" aria-label={`Delete wallpaper from ${host}`} title="Delete wallpaper" onClick={onDelete}><Trash2 size={13}/></button>
  </div>;
}

export function WallpaperGallery({ urls, selectedUrl, onSelect, onDelete }: {
  urls: string[];
  selectedUrl: string;
  onSelect: (url: string) => void;
  onDelete: (url: string) => void;
}) {
  return <div className="wallpaper-gallery" aria-label={`Saved wallpapers, ${urls.length} of 25`}>
    {urls.map((url, index) => <WallpaperTile key={`${url}-${index}`} url={url} selected={selectedUrl === url} onSelect={() => onSelect(url)} onDelete={() => onDelete(url)}/>)}
    {urls.length === 0 && <p className="wallpaper-gallery-empty">No saved wallpapers yet. Add an image URL below.</p>}
  </div>;
}
