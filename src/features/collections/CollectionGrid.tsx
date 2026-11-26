import type { MouseEvent } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { Collection, Site } from '../../components/types';
import { SortableSiteCard, SiteDragPreview } from './SiteCard';

export { SiteDragPreview };

export function CollectionGrid({
  collection,
  onContextMenu,
  onMenu,
  onAdd,
}: {
  collection: Collection;
  onContextMenu: (site: Site, event: MouseEvent) => void;
  onMenu: (site: Site, rect: DOMRect) => void;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `collection-grid:${collection.id}`,
    data: { collectionId: collection.id },
  });
  return (
    <div
      ref={setNodeRef}
      className={`sites-grid grid flex-1 content-start justify-start grid-cols-[repeat(auto-fill,minmax(115px,125px))] gap-[14px] pt-[14px] max-[760px]:grid-cols-[repeat(auto-fill,minmax(105px,115px))] max-[760px]:gap-3 max-[430px]:grid-cols-[repeat(auto-fill,minmax(100px,108px))] max-[430px]:gap-[10px] ${isOver ? 'drop-target' : ''}`}
    >
      <SortableContext
        items={collection.sites.map((site) => site.id)}
        strategy={rectSortingStrategy}
      >
        {collection.sites.map((site, index) => (
          <SortableSiteCard
            key={site.id}
            site={site}
            collectionId={collection.id}
            index={index}
            onContextMenu={onContextMenu}
            onMenu={onMenu}
          />
        ))}
      </SortableContext>
      <button
        className="add-site-card aspect-square h-full w-full flex-col items-center justify-center gap-2 rounded-[10px] p-[9px] text-center max-[760px]:p-[8px]"
        onClick={onAdd}
      >
        <span className="add-circle mb-0 grid h-[40px] w-[40px] flex-none place-items-center rounded-[8px]">
          <Plus size={32} />
        </span>
        <strong className="mt-0 text-center">Add a website</strong>
      </button>
    </div>
  );
}
