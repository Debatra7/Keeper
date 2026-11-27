import { useEffect, useRef } from 'react';
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from 'react';
import { ArrowUpRight, Command, Search } from 'lucide-react';
import { faviconFor } from '../features/collections/model';
import type { Site } from './types';

type SearchSite = Site & { collection: string };

type Props = {
  value: string;
  setValue: Dispatch<SetStateAction<string>>;
  sites: SearchSite[];
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  focusRequest: number;
  variant: 'home' | 'palette';
  position?: { x: number; y: number };
  dragging?: boolean;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export function GlobalSearch({
  value,
  setValue,
  sites,
  open,
  setOpen,
  focusRequest,
  variant,
  position,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const query = value.trim();
  const matches = query
    ? sites
        .filter((site) =>
          `${site.name} ${site.url} ${site.collection}`.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 5)
    : [];

  useEffect(() => {
    if (focusRequest > 0 || (variant === 'palette' && open)) inputRef.current?.focus();
  }, [focusRequest, open, variant]);

  const siteHref = (url: string) => (url.startsWith('http') ? url : `https://${url}`);

  const searchWeb = () => {
    if (!query) return;
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleSearch = () => {
    if (!query) return;
    if (matches.length > 0) {
      window.open(siteHref(matches[0].url), '_blank', 'noopener,noreferrer');
      setOpen(false);
      return;
    }
    searchWeb();
  };
  const searchBox = (
    <div
      className={`search-wrap ${variant === 'home' ? `search-draggable ${dragging ? 'is-dragging' : ''}` : 'w-[min(580px,100%)] flex-none'}`}
      style={
        variant === 'home' && position
          ? { transform: `translate3d(${position.x}px, ${position.y}px, 0)` }
          : undefined
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Search size={19} className="search-icon" />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') handleSearch();
        }}
        placeholder="Search the web or your saved places..."
      />
      <kbd>
        <Command size={11} /> K
      </kbd>
      <button
        className="search-go"
        aria-label="Search saved sites or the web"
        onClick={handleSearch}
      >
        <ArrowUpRight size={17} />
      </button>
      {open && value.trim() && (
        <div className="search-results">
          {matches.map((site) => (
            <a
              key={site.id}
              href={siteHref(site.url)}
              className="search-result"
              onClick={() => setOpen(false)}
            >
              <img src={faviconFor(site.url)} />
              <span>{site.name}</span>
              <small>{site.collection}</small>
            </a>
          ))}
          <button className="web-result" onClick={searchWeb}>
            <Search size={14} /> Search the web for “{value}”
          </button>
        </div>
      )}
    </div>
  );

  if (variant === 'home') return searchBox;
  return open ? (
    <div
      className="fixed inset-0 z-[8] flex items-start justify-center bg-[#1b211b80] px-5 pb-5 pt-[clamp(90px,18vh,180px)] backdrop-blur-[4px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      {searchBox}
    </div>
  ) : null;
}
