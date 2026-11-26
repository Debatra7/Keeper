import { forwardRef } from 'react';
import type { CSSProperties } from 'react';
import { Compass, ExternalLink, FolderPlus, Link2, Settings, X } from 'lucide-react';
import type { Collection, Site } from './types';

export type MenuState = {
  x: number;
  y: number;
  site?: Site;
  collection?: Collection;
} | null;

interface AppContextMenuProps {
  menu: NonNullable<MenuState>;
  collections: Collection[];
  onRenameCollection: (collection: Collection) => void;
  onOpenCollectionSettings: (collectionId: string) => void;
  onDeleteCollection: (collection: Collection) => void;
  onOpenSite: (site: Site) => void;
  onEditSite: (site: Site) => void;
  onMoveSite: (siteId: string, targetCollectionId: string) => void;
  onRemoveSite: (site: Site) => void;
  onGoToDashboard: () => void;
  onNewCollection: () => void;
  onOpenSettings: () => void;

}

export const AppContextMenu = forwardRef<HTMLDivElement, AppContextMenuProps>(
  function AppContextMenu(
    {
      menu,
      collections,
      onRenameCollection,
      onOpenCollectionSettings,
      onDeleteCollection,
      onOpenSite,
      onEditSite,
      onMoveSite,
      onRemoveSite,
      onGoToDashboard,
      onNewCollection,
      onOpenSettings,
    },
    ref
  ) {
    const menuFont =
      menu.collection?.nameFont ??
      menu.collection?.font ??
      (menu.site
        ? collections.find((collection) =>
            collection.sites.some((site) => site.id === menu.site!.id)
          )?.cardFont
        : null) ??
      'var(--ui-font)';

    return (
      <div
        ref={ref}
        className="context-menu"
        style={
          {
            left: Math.min(menu.x, window.innerWidth - 220),
            top: menu.y,
            '--menu-font': menuFont,
          } as CSSProperties
        }
        role="menu"
        onClick={(e) => e.stopPropagation()}
      >
        {menu.collection ? (
          <>
            <button role="menuitem" onClick={() => onRenameCollection(menu.collection!)}>
              <FolderPlus size={15} /> Rename collection
            </button>
            <button role="menuitem" onClick={() => onOpenCollectionSettings(menu.collection!.id)}>
              <Settings size={15} /> Collection settings
            </button>
            <button
              role="menuitem"
              className="danger"
              onClick={() => onDeleteCollection(menu.collection!)}
            >
              <X size={15} /> Delete collection
            </button>
          </>
        ) : menu.site ? (
          <>
            <button role="menuitem" onClick={() => onOpenSite(menu.site!)}>
              <ExternalLink size={15} /> Open website
            </button>
            <button role="menuitem" onClick={() => onEditSite(menu.site!)}>
              <Link2 size={15} /> Edit shortcut
            </button>
            <div className="context-divider" />
            <div className="context-label">MOVE TO COLLECTION</div>
            {collections
              .filter((c) => !c.sites.some((s) => s.id === menu.site!.id))
              .map((c) => (
                <button role="menuitem" key={c.id} onClick={() => onMoveSite(menu.site!.id, c.id)}>
                  <span className="tab-dot" style={{ background: c.color }} />
                  {c.name}
                </button>
              ))}
            <div className="context-divider" />
            <button role="menuitem" className="danger" onClick={() => onRemoveSite(menu.site!)}>
              <X size={15} /> Remove shortcut
            </button>
          </>
        ) : (
          <>
            <button role="menuitem" onClick={onGoToDashboard}>
              <Compass size={15} /> Go to dashboard
            </button>
            <button role="menuitem" onClick={onNewCollection}>
              <FolderPlus size={15} /> New collection
            </button>
            <button role="menuitem" onClick={onOpenSettings}>
              <Settings size={15} /> Settings
            </button>
          </>
        )}
      </div>
    );
  }
);
