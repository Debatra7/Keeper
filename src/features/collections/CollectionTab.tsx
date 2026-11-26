import type { MouseEvent } from 'react';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import type { Collection } from '../../components/types';

export function CollectionTab({
  collection,
  active,
  accent,
  onSelect,
  onContextMenu,
}: {
  collection: Collection;
  active: boolean;
  accent: string;
  onSelect: () => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isOver, isDragging } =
    useSortable({
      id: `collection-tab:${collection.id}`,
      data: { type: 'collection', collectionId: collection.id },
      transition: { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    });

  return (
    <button
      ref={setNodeRef}
      style={
        {
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.35 : undefined,
          touchAction: 'none',
          '--collection-tab-color': collection.color || accent,
          '--collection-name-font': collection.nameFont
            ? `'${collection.nameFont}', sans-serif`
            : collection.font
              ? `'${collection.font}', sans-serif`
              : 'var(--ui-font)',
          '--collection-title-size': `${collection.titleFontSize ?? 16}px`,
        } as React.CSSProperties
      }
      {...attributes}
      {...listeners}
      className={`collection-tab ${active ? 'selected' : ''} ${isOver ? 'drop-target' : ''}`}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      <span className="tab-name">{collection.name}</span>
    </button>
  );
}
