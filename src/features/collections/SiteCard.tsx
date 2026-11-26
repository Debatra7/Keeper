import type { MouseEvent } from 'react';
import { ExternalLink, Globe2, MoreHorizontal } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Site } from '../../components/types';
import { domainOf, faviconFor } from './model';

export function SortableSiteCard({
  site,
  collectionId,
  index,
  onContextMenu,
  onMenu,
}: {
  site: Site;
  collectionId: string;
  index: number;
  onContextMenu: (site: Site, event: MouseEvent) => void;
  onMenu: (site: Site, rect: DOMRect) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: site.id,
    data: { type: 'site', collectionId },
    transition: { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  });
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.12 : undefined,
        zIndex: isDragging ? 1 : undefined,
        touchAction: 'none',
      }}
      className={`site-card relative h-auto aspect-square overflow-hidden rounded-[10px] ${isDragging ? 'is-dragging' : ''}`}
      {...attributes}
      {...listeners}
      onContextMenu={(e) => onContextMenu(site, e)}
    >
      <a
        className="site-link relative flex h-full flex-col items-center justify-center gap-2 p-[9px] text-center max-[760px]:gap-2 max-[760px]:p-[8px]"
        href={`https://${site.url}`}
        target="_blank"
        rel="noreferrer"
      >
        <span className="site-top flex w-full justify-center">
          <span className="favicon-frame">
            <img
              src={faviconFor(site.url)}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <Globe2 size={19} className="fallback-icon hidden" />
          </span>
          <span className="site-external absolute top-0 right-0">
            <ExternalLink size={14} />
          </span>
        </span>
        <span className="site-name mt-0 self-center text-center">{site.name}</span>
        <span className="site-url">{domainOf(site.url)}</span>
      </a>
      <button
        className="card-menu"
        aria-label={`Options for ${site.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onMenu(site, e.currentTarget.getBoundingClientRect());
        }}
      >
        <MoreHorizontal size={17} />
      </button>
      <span className="card-index">{String(index + 1).padStart(2, '0')}</span>
    </article>
  );
}

export function SiteDragPreview({ site }: { site: Site }) {
  return (
    <article className="site-card drag-preview aspect-square rounded-[10px]">
      <div className="site-link flex h-full flex-col items-center justify-center gap-2 p-[9px]">
        <span className="site-top flex w-full justify-center">
          <span className="favicon-frame">
            <img
              src={faviconFor(site.url)}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <Globe2 size={19} className="fallback-icon hidden" />
          </span>
        </span>
        <span className="site-name mt-0 self-center text-center">{site.name}</span>
      </div>
    </article>
  );
}
