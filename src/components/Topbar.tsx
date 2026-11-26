import type { MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, LockKeyhole, Plus } from 'lucide-react';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import type { Collection } from './types';
import { CollectionTab } from '../features/collections/CollectionTab';
import { SyncStatusBadge } from './SyncStatusBadge';

interface TopbarProps {
  collections: Collection[];
  visibleCollections: Collection[];
  collectionPage: number;
  collectionPageCount: number;
  showAddCollection: boolean;
  activeCollectionId: string | null;
  accentColor: string;
  isAuthenticated: boolean;
  onPageChange: (newPage: number) => void;
  onSelectCollection: (id: string | null) => void;
  onCollectionContextMenu: (e: MouseEvent, collection: Collection) => void;
  onAddCollection: () => void;
  onOpenDataSettings: () => void;
  onRequireAuth: () => void;
}

export function Topbar({
  collections,
  visibleCollections,
  collectionPage,
  collectionPageCount,
  showAddCollection,
  activeCollectionId,
  accentColor,
  isAuthenticated,
  onPageChange,
  onSelectCollection,
  onCollectionContextMenu,
  onAddCollection,
  onOpenDataSettings,
  onRequireAuth,
}: TopbarProps) {
  return (
    <header className="topbar dashboard-topbar relative z-[3] flex h-[76px] items-center border-b border-[var(--line)] bg-[rgba(12,13,16,0.62)] px-[5.1%] backdrop-blur-[22px] backdrop-saturate-[130%] max-[760px]:h-[65px] max-[760px]:px-[18px]">
      <div className="collections-strip">
        <button
          className={`collection-scroll-button ${collectionPageCount > 1 ? 'shown' : ''}`}
          aria-label="Previous 6 collections"
          title="Previous 6 collections"
          disabled={collectionPage === 0}
          onClick={() => onPageChange(Math.max(0, collectionPage - 1))}
        >
          <ChevronLeft size={17} />
        </button>
        <div className="collection-box">
          <nav className="collections-nav" aria-label="Collections">
            <SortableContext
              items={visibleCollections.map((c) => `collection-tab:${c.id}`)}
              strategy={horizontalListSortingStrategy}
            >
              {visibleCollections.map((c) => (
                <CollectionTab
                  key={c.id}
                  collection={c}
                  active={activeCollectionId === c.id}
                  accent={accentColor}
                  onSelect={() => onSelectCollection(activeCollectionId === c.id ? null : c.id)}
                  onContextMenu={(e) => onCollectionContextMenu(e, c)}
                />
              ))}
            </SortableContext>
            {showAddCollection && (
              <button
                className="add-collection"
                style={{ gridColumn: (collections.length % 6) + 1 }}
                aria-label="New collection"
                title="New collection"
                onClick={onAddCollection}
              >
                <Plus size={15} />
              </button>
            )}
          </nav>
        </div>
        <button
          className={`collection-scroll-button ${collectionPageCount > 1 ? 'shown' : ''}`}
          aria-label="Next 6 collections"
          title="Next 6 collections"
          disabled={collectionPage >= collectionPageCount - 1}
          onClick={() => onPageChange(Math.min(collectionPageCount - 1, collectionPage + 1))}
        >
          <ChevronRight size={17} />
        </button>
      </div>
      <div className="topbar-sync-action">
        {isAuthenticated ? (
          <SyncStatusBadge onOpenSettings={onOpenDataSettings} />
        ) : (
          <button
            type="button"
            className="sync-status-badge sync-nav-trigger paused"
            aria-label="Sign in to use cloud backup and sync"
            title="Sign in to use cloud backup and sync"
            onClick={onRequireAuth}
          >
            <LockKeyhole size={15} />
          </button>
        )}
      </div>
    </header>
  );
}
