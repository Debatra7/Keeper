import type { MouseEvent } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { Collection, Site } from './types';
import { SortableSiteCard, SiteDragPreview } from './SiteCard';

export { SiteDragPreview };

export function CollectionGrid({ collection, onContextMenu, onMenu, onAdd }: {
  collection: Collection;
  onContextMenu: (site: Site, event: MouseEvent) => void;
  onMenu: (site: Site, rect: DOMRect) => void;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `collection-grid:${collection.id}`, data: { collectionId: collection.id } });
  return <div ref={setNodeRef} className={`sites-grid ${isOver ? 'drop-target' : ''}`}>
    <SortableContext items={collection.sites.map(site => site.id)} strategy={rectSortingStrategy}>
      {collection.sites.map((site, index) => <SortableSiteCard key={site.id} site={site} collectionId={collection.id} index={index} onContextMenu={onContextMenu} onMenu={onMenu}/>)}
    </SortableContext>
    <button className="add-site-card" onClick={onAdd}><span className="add-circle"><Plus size={16}/></span><strong>Add a website</strong></button>
  </div>;
}
