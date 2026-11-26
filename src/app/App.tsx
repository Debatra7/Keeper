import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Compass, ExternalLink, FolderPlus, Home, Link2, LockKeyhole, Plus, Search, Settings, TriangleAlert, X } from 'lucide-react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, Modifier } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CollectionGrid, SiteDragPreview } from '../features/collections/CollectionGrid';
import { CollectionTab } from '../features/collections/CollectionTab';
import { createId, domainOf, readCollections } from '../features/collections/model';
import { GlobalSearch } from '../components/GlobalSearch';
import { ColorPicker } from '../components/ColorPicker';
import type { Collection, Site } from '../components/types';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import type { DataBackup, UserProfile } from '../features/settings/SettingsPanel';
import { defaultPreferences, readPreferences } from '../features/settings/preferences';
import type { Preferences } from '../features/settings/preferences';
import { FONT_OPTIONS } from '../features/settings/preferences';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { KeyboardHelp } from '../features/shortcuts/KeyboardHelp';
import { gsap } from 'gsap';
import { DashboardWidgets, readWidgets } from '../features/dashboard/DashboardWidgets';
import type { DashboardWidget } from '../features/dashboard/DashboardWidgets';
import { getAlignmentTargets, snapToAlignment } from '../features/dashboard/alignment';
import type { AlignmentGuide } from '../features/dashboard/alignment';
import { AuthScreen } from '../features/auth/AuthScreen';
import { clearRemoteKeeperData, supabase } from '../lib/supabase';
import { isBackup, normalizeDocument } from '../lib/validation';
import { SyncStatusBadge } from '../components/SyncStatusBadge';
import { syncEngine, clearOutbox, resetSyncMetadata } from '../lib/sync';

type Menu = { x: number; y: number; site?: Site; collection?: Collection } | null;
type Toast = { id: number; message: string; tone: 'success' | 'warning' | 'error' };
const defaultDisplayName = 'user';
const displayNameFromEmail = (email?: string) => {
  const local = email?.split('@')[0]?.replace(/[._+-]+/g, ' ').trim();
  return local ? local.replace(/\b\p{L}/gu, letter => letter.toUpperCase()) : defaultDisplayName;
};
function App() {
  const [session, setSession] = useState<import('@supabase/supabase-js').Session | null>(null);
  const [collections, setCollections] = useState<Collection[]>(readCollections);
  const [collectionPageIndex, setCollectionPageIndex] = useState(0);
  const [checkpoints, setCheckpoints] = useState<DataBackup[]>(() => { try { const value: unknown = JSON.parse(localStorage.getItem('keeper-checkpoints') || '[]'); return Array.isArray(value) ? value.filter(isBackup).slice(0, 5) : []; } catch { return []; } });
  const [syncState, setSyncState] = useState<'local' | 'syncing' | 'synced' | 'offline' | 'paused' | 'error'>('local');
  const checkpointSnapshot = useRef(checkpoints);
  const [active, setActive] = useState<string | null>(null);
  const [modal, setModal] = useState<'collection' | 'site' | 'settings' | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(() => { try { return localStorage.getItem('keeper-welcome-seen') !== 'true'; } catch { return true; } });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [search, setSearch] = useState('');
  const [searchFocusRequest, setSearchFocusRequest] = useState(0);
  const [menu, setMenu] = useState<Menu>(null);
  const [queryOpen, setQueryOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCollection, setNewCollection] = useState('');
  const [newCollectionColor, setNewCollectionColor] = useState(defaultPreferences.accent);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [appearancePreview, setAppearancePreview] = useState<Preferences | null>(null);
  const displayedPreferences = appearancePreview ?? preferences;
  const [profile, setProfile] = useState<UserProfile>(() => { try { const value: unknown = JSON.parse(localStorage.getItem('keeper-profile') || '{}'); return value && typeof value === 'object' && typeof (value as UserProfile).name === 'string' && (value as UserProfile).name.length <= 200 ? { ...(value as UserProfile), name: (value as UserProfile).name, email: (value as UserProfile).email ?? '' } : { name: defaultDisplayName, email: '' }; } catch { return { name: defaultDisplayName, email: '' }; } });
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>();
  const [settingsSection, setSettingsSection] = useState<'appearance' | 'collections' | 'profile' | 'data'>('appearance');
  const [settingsCollectionId, setSettingsCollectionId] = useState<string | undefined>();
  const [draggedSite, setDraggedSite] = useState<Site | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<Collection | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchPosition, setSearchPosition] = useState<{ x: number; y: number }>(() => { try { return JSON.parse(localStorage.getItem('keeper-search-position') || '{"x":0,"y":0}'); } catch { return { x: 0, y: 0 }; } });
  const appRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => { if (active) setSession(data.session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'SIGNED_IN' && nextSession?.user.email) setProfile(current => current.name.trim().toLowerCase() === defaultDisplayName ? { ...current, name: displayNameFromEmail(nextSession.user.email) } : current);
      if (event === 'PASSWORD_RECOVERY') { setPasswordRecovery(true); setAuthModalOpen(true); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  const [searchDragging, setSearchDragging] = useState(false);
  const [widgets, setWidgets] = useState<DashboardWidget[]>(readWidgets);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const pendingGuides = useRef<AlignmentGuide[]>([]);
  const guideFrame = useRef<number | null>(null);
  const searchDrag = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number; left: number; top: number; width: number; height: number } | null>(null);
  const searchPositionRef = useRef(searchPosition);
  const publishGuides = useCallback((guides: AlignmentGuide[]) => { pendingGuides.current = guides; if (guideFrame.current === null) guideFrame.current = requestAnimationFrame(() => { setAlignmentGuides(pendingGuides.current); guideFrame.current = null; }); }, []);
  const clearGuides = useCallback(() => { pendingGuides.current = []; if (guideFrame.current !== null) cancelAnimationFrame(guideFrame.current); guideFrame.current = null; setAlignmentGuides([]); }, []);
  useEffect(() => () => { if (guideFrame.current !== null) cancelAnimationFrame(guideFrame.current); }, []);
  const widgetDragModifier = useMemo<Modifier>(() => ({ active, activeNodeRect, transform }) => {
    if (!active || active.data.current?.type !== 'widget' || !activeNodeRect) return transform;
    const minX = -activeNodeRect.left, maxX = window.innerWidth - activeNodeRect.right;
    const minY = 76 - activeNodeRect.top, maxY = window.innerHeight - 90 - activeNodeRect.bottom;
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const x = clamp(transform.x, minX, maxX), y = clamp(transform.y, minY, maxY);
    const snap = snapToAlignment({ left: activeNodeRect.left + x, top: activeNodeRect.top + y, width: activeNodeRect.width, height: activeNodeRect.height }, getAlignmentTargets(), { width: window.innerWidth, height: window.innerHeight });
    const snappedX = clamp(x + snap.x, minX, maxX), snappedY = clamp(y + snap.y, minY, maxY);
    publishGuides(snap.guides.filter(guide => guide.axis === 'x' ? Math.abs(snappedX - x - snap.x) < .1 : Math.abs(snappedY - y - snap.y) < .1));
    return { ...transform, x: snappedX, y: snappedY };
  }, [publishGuides]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const current = collections.find(c => c.id === active) ?? null;
  const collectionPageCount = Math.max(1, Math.ceil((collections.length + 1) / 6));
  const collectionPage = Math.min(collectionPageIndex, collectionPageCount - 1);
  const visibleCollections = collections.slice(collectionPage * 6, collectionPage * 6 + 6);
  const showAddCollection = collectionPage === Math.floor(collections.length / 6);
  useLayoutEffect(() => { setCollectionPageIndex(index => Math.min(index, collectionPageCount - 1)); }, [collectionPageCount]);
  const allSites = useMemo(() => collections.flatMap(c => c.sites.map(site => ({ ...site, collection: c.name }))), [collections]);

  useEffect(() => { try { localStorage.setItem('keeper-data', JSON.stringify(collections)); } catch { /* Keep edits in memory if storage is full. */ } }, [collections]);
  useEffect(() => { try { localStorage.setItem('keeper-profile', JSON.stringify(profile)); } catch { /* Keep profile changes in memory if storage is unavailable. */ } }, [profile]);
  useEffect(() => { checkpointSnapshot.current = checkpoints; try { localStorage.setItem('keeper-checkpoints', JSON.stringify(checkpoints)); } catch { /* Keep checkpoints in memory if storage is unavailable. */ } }, [checkpoints]);
  useEffect(() => { try { localStorage.setItem('keeper-widgets', JSON.stringify(widgets)); } catch { /* Keep widgets in memory if storage is unavailable. */ } }, [widgets]);
  const documentSnapshot = useCallback(() => ({ collections, preferences, profile, widgets, checkpoints, searchPosition, wallpaperUrls: preferences.wallpaperUrls }), [collections, preferences, profile, widgets, checkpoints, searchPosition]);
  useEffect(() => {
    let active = true;
    const path = displayedPreferences.imagePath;
    const refresh = async () => {
      if (!session?.user.id || !supabase || !path) { setBackgroundImageUrl(undefined); return; }
      const { data, error } = await supabase.storage.from('background-images').createSignedUrl(path, 3600);
      if (active) setBackgroundImageUrl(error ? undefined : data?.signedUrl);
    };
    void refresh();
    if (!path || !session?.user.id) return () => { active = false; };
    const timer = window.setInterval(() => { void refresh(); }, 50 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session?.user.id, displayedPreferences.imagePath]);
  useEffect(() => {
    if (!session?.user.id) {
      setSyncState('local');
      syncEngine.setSession(null, documentSnapshot);
      return;
    }
    syncEngine.setSession(
      session,
      documentSnapshot,
      remoteDoc => {
        setCollections(current => remoteDoc.collections.length ? remoteDoc.collections : current);
        setPreferences(remoteDoc.preferences);
        setProfile(current => {
          const remoteProfile = remoteDoc.profile ?? { name: defaultDisplayName, email: '' };
          return current.name.trim().toLowerCase() === defaultDisplayName && remoteProfile.name.trim().toLowerCase() === defaultDisplayName
            ? { ...remoteProfile, name: displayNameFromEmail(session.user.email) }
            : remoteProfile;
        });
        setWidgets(remoteDoc.widgets);
        setSearchPosition(remoteDoc.searchPosition);
        searchPositionRef.current = remoteDoc.searchPosition;
        setCheckpoints(remoteDoc.checkpoints);
      }
    );
    const unsubscribe = syncEngine.subscribe(state => {
      setSyncState(state.status);
    });
    return () => {
      unsubscribe();
    };
  }, [session, documentSnapshot]);
  useLayoutEffect(() => {
    const root = appRef.current;
    const scene = root?.querySelector<HTMLElement>('.dashboard-home, .collection-page');
    if (!scene || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = gsap.context(() => {
      gsap.fromTo(scene, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .28, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
      const cards = scene.querySelectorAll('.site-card, .dashboard-widget');
      if (cards.length) gsap.fromTo(cards, { autoAlpha: 0 }, { autoAlpha: 1, duration: .2, stagger: .025, delay: .04, ease: 'power1.out', clearProps: 'opacity,visibility' });
      const searchBar = scene.querySelector('.search-wrap');
      if (searchBar) gsap.fromTo(searchBar, { autoAlpha: 0 }, { autoAlpha: 1, duration: .24, delay: .06, ease: 'power1.out', clearProps: 'opacity,visibility' });
    }, scene);
    return () => context.revert();
  }, [current?.id, current?.sites.length, widgets.length]);
  useLayoutEffect(() => {
    if (!modal && !confirmDelete && !helpOpen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const overlays = appRef.current?.querySelectorAll<HTMLElement>('.overlay');
    const overlay = overlays?.[overlays.length - 1];
    const dialog = overlay?.querySelector<HTMLElement>('.modal, .confirm-dialog');
    if (!overlay || !dialog) return;
    const context = gsap.context(() => {
      gsap.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: .16, ease: 'power1.out' });
      gsap.fromTo(dialog, { autoAlpha: 0, y: 10, scale: .985 }, { autoAlpha: 1, y: 0, scale: 1, duration: .22, delay: .02, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
    }, overlay);
    return () => context.revert();
  }, [modal, confirmDelete?.id, helpOpen]);
  useLayoutEffect(() => {
    if (!widgetPickerOpen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const picker = appRef.current?.querySelector<HTMLElement>('.widget-picker');
    if (picker) gsap.fromTo(picker, { autoAlpha: 0, y: 7, scale: .98 }, { autoAlpha: 1, y: 0, scale: 1, duration: .18, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
  }, [widgetPickerOpen]);
  useLayoutEffect(() => {
    const toast = appRef.current?.querySelector<HTMLElement>('.toast:last-child');
    if (!toast || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(toast, { autoAlpha: 0, x: -8 }, { autoAlpha: 1, x: 0, duration: .18, ease: 'power1.out', clearProps: 'transform,opacity,visibility' });
  }, [toasts.at(-1)?.id]);
  useEffect(() => { searchPositionRef.current = searchPosition; }, [searchPosition]);
  useLayoutEffect(() => {
    const element = menuRef.current;
    if (!menu || !element) return;
    const bounds = element.getBoundingClientRect();
    element.style.left = `${Math.max(8, Math.min(menu.x, window.innerWidth - bounds.width - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - bounds.height - 8))}px`;
  }, [menu]);
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', displayedPreferences.accent);
    root.style.setProperty('--accent-soft', `color-mix(in srgb, ${displayedPreferences.accent} 18%, transparent)`);
    root.style.setProperty('--ui-font', `'${FONT_OPTIONS.includes(displayedPreferences.font as typeof FONT_OPTIONS[number]) ? displayedPreferences.font : 'Roboto'}', sans-serif`);
    root.style.setProperty('--ui-font-size', `${displayedPreferences.size}px`);
    const fontScale = displayedPreferences.size / 16;
    root.style.setProperty('--font-scale', String(fontScale));
    for (const [token, base] of [['--text-xs', 12], ['--text-sm', 14], ['--text-md', 16], ['--text-lg', 20], ['--text-xl', 28]] as const) root.style.setProperty(token, `${base * fontScale}px`);
    const validImage = displayedPreferences.imagePath ? (backgroundImageUrl ?? '') : (displayedPreferences.image || '');
    const background = displayedPreferences.background === 'gradient' ? `linear-gradient(135deg, ${displayedPreferences.color1}, ${displayedPreferences.color2})` : displayedPreferences.background === 'image' && validImage ? `linear-gradient(rgba(8,9,11,.4), rgba(8,9,11,.52)), url("${validImage}")` : `linear-gradient(${displayedPreferences.color1}, ${displayedPreferences.color1})`;
    root.style.setProperty('--canvas-background', background);
    try { localStorage.setItem('keeper-preferences', JSON.stringify(preferences)); } catch { /* Keep the current appearance for this session if storage is full. */ }
  }, [preferences, displayedPreferences, backgroundImageUrl]);
  useEffect(() => { const close = () => { setMenu(null); setWidgetPickerOpen(false); }; window.addEventListener('click', close); return () => window.removeEventListener('click', close); }, []);
  useEffect(() => { const timer = window.setInterval(() => setToasts(items => items.filter(toast => toast.id > Date.now() - 4000)), 500); return () => window.clearInterval(timer); }, []);
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setQueryOpen(false); setModal(null); setMenu(null); setConfirmDelete(null); setHelpOpen(false); setWidgetPickerOpen(false); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);

  // Keyboard shortcut handler
  const handleShortcut = useCallback<Parameters<typeof useKeyboardShortcuts>[0]['onShortcut']>(({ action }) => {
    if (action === 'search')         { setQueryOpen(true); setSearchFocusRequest(request => request + 1); }
    if (action === 'add-site')       { openSiteModal(); }
    if (action === 'dashboard')      { setActive(null); }
    if (action === 'settings')       { setModal('settings'); }
    if (action === 'help')           { setHelpOpen(v => !v); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useKeyboardShortcuts({
    hasActiveCollection: !!current,
    onShortcut: handleShortcut,
  });

  const openCollectionModal = (collection?: Collection) => { setEditingCollection(collection ?? null); setNewCollection(collection?.name ?? ''); setNewCollectionColor(collection ? collection.color : preferences.accent); setModal('collection'); setMenu(null); };
  const startSearchDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('input,button,kbd')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    searchDrag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, ...searchPositionRef.current, left: rect.left - searchPositionRef.current.x, top: rect.top - searchPositionRef.current.y, width: rect.width, height: rect.height };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSearchDragging(true);
  };
  const moveSearch = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = searchDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const minX = -drag.left, maxX = window.innerWidth - drag.left - drag.width;
    const minY = 76 - drag.top, maxY = window.innerHeight - 90 - drag.top - drag.height;
    const x = clamp(drag.x + event.clientX - drag.startX, minX, maxX);
    const y = clamp(drag.y + event.clientY - drag.startY, minY, maxY);
    const snap = snapToAlignment({ left: drag.left + x, top: drag.top + y, width: drag.width, height: drag.height }, getAlignmentTargets(), { width: window.innerWidth, height: window.innerHeight });
    const snappedX = clamp(x + snap.x, minX, maxX), snappedY = clamp(y + snap.y, minY, maxY);
    publishGuides(snap.guides.filter(guide => guide.axis === 'x' ? Math.abs(snappedX - x - snap.x) < .1 : Math.abs(snappedY - y - snap.y) < .1));
    searchPositionRef.current = { x: snappedX, y: snappedY };
    setSearchPosition(searchPositionRef.current);
  };
  const endSearchDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (searchDrag.current?.pointerId !== event.pointerId) return;
    searchDrag.current = null;
    setSearchDragging(false);
    clearGuides();
    try { localStorage.setItem('keeper-search-position', JSON.stringify(searchPositionRef.current)); } catch { /* Keep the position for this session if storage is unavailable. */ }
    setSearchPosition(searchPositionRef.current);
    void syncEngine.queueMutation('search_position', 'user_search_pos', 'update', searchPositionRef.current);
  };
  const saveCollection = () => {
    const name = newCollection.trim();
    if (!name) return;
    if (editingCollection) {
      setCollections(items => items.map(c => c.id === editingCollection.id ? { ...c, name, color: newCollectionColor } : c));
      void syncEngine.queueMutation('collection', editingCollection.id, 'update', { name, color: newCollectionColor });
      notify('Collection updated', 'success');
    } else {
      const item: Collection = { id: createId(), name, color: newCollectionColor, sites: [] };
      setCollections(items => [...items, item]);
      setActive(item.id);
      void syncEngine.queueMutation('collection', item.id, 'insert', item);
      notify('Collection created', 'success');
    }
    setEditingCollection(null); setNewCollection(''); setModal(null);
  };
  const dismissOnboarding = () => { setOnboardingOpen(false); try { localStorage.setItem('keeper-welcome-seen', 'true'); } catch { /* Keep the welcome dismissed for this session. */ } };
  const notify = (message: string, tone: Toast['tone'] = 'success') => setToasts(items => [...items, { id: Date.now(), message, tone }]);
  const importBackup = (backup: DataBackup) => { const document = normalizeDocument({ collections: backup.collections, preferences: backup.preferences, profile: backup.profile, widgets: backup.widgets ?? [], searchPosition: backup.searchPosition, checkpoints }); if (!document) { notify('That backup contains invalid data', 'error'); return; } setCollections(document.collections); setPreferences(document.preferences); setProfile(document.profile); setWidgets(document.widgets); setSearchPosition(document.searchPosition); searchPositionRef.current = document.searchPosition; notify('Backup imported successfully', 'success'); };
  const wipeAllKeeperData = async () => {
    try {
      let preservedCheckpoints = checkpoints;
      if (session?.user.id) {
        if (!supabase) throw new Error('Cloud sync is unavailable');
        const avatarPath = profile.avatarPath;
        if (avatarPath) {
          const { error } = await supabase.storage.from('profile-pictures').remove([avatarPath]);
          if (error) throw error;
        }
        const backgroundPath = preferences.imagePath;
        if (backgroundPath) {
          const { error } = await supabase.storage.from('background-images').remove([backgroundPath]);
          if (error) throw error;
        }
        await clearRemoteKeeperData(session.user.id, preservedCheckpoints);
      }
      await clearOutbox();
      resetSyncMetadata();
      localStorage.setItem('keeper-checkpoints', JSON.stringify(preservedCheckpoints));
      for (const key of ['keeper-data', 'keeper-preferences', 'keeper-profile', 'keeper-widgets', 'keeper-search-position', 'keeper-welcome-seen']) localStorage.removeItem(key);
      window.location.reload();
    } catch {
      notify('Could not complete deletion. Local data was kept; please retry when connected. A cloud image may already have been removed.', 'error');
    }
  };
  const addWidget = (type: DashboardWidget['type']) => {
    const width = type === 'calendar' ? 228 : 180;
    const height = type === 'calendar' ? 230 : 130;
    const areaWidth = document.querySelector('.dashboard-widgets')?.clientWidth ?? window.innerWidth * .898;
    const columns = Math.max(1, Math.floor(areaWidth / 250));
    const index = widgets.length;
    const newWidget: DashboardWidget = { id: createId(), type, width, height, x: index % columns * 250, y: Math.floor(index / columns) * 245 };
    setWidgets(items => [...items, newWidget]);
    void syncEngine.queueMutation('widget', newWidget.id, 'insert', newWidget);
    setWidgetPickerOpen(false);
    notify(`${type === 'clock' ? 'Clock' : 'Calendar'} widget added`, 'success');
  };
  const deleteCollection = (collection: Collection) => {
    setCollections(items => items.filter(c => c.id !== collection.id));
    if (active === collection.id) setActive(null);
    void syncEngine.queueMutation('collection', collection.id, 'delete', null);
    setMenu(null); setConfirmDelete(null); notify(`Deleted ${collection.name}`, 'success');
  };
  const saveSite = () => {
    const url = domainOf(newUrl.trim());
    if (!current || !newName.trim() || !url) { notify('Enter a name and a valid HTTPS website address', 'warning'); return; }
    const site: Site = { id: editing?.id ?? createId(), name: newName.trim().slice(0, 200), url };
    if (editing) {
      setCollections(v => v.map(c => c.id === current.id ? { ...c, sites: c.sites.map(s => s.id === editing.id ? site : s) } : c));
      void syncEngine.queueMutation('site', site.id, 'update', { ...site, collectionId: current.id });
    } else {
      setCollections(v => v.map(c => c.id === current.id ? { ...c, sites: [...c.sites, site] } : c));
      void syncEngine.queueMutation('site', site.id, 'insert', { ...site, collectionId: current.id, sortOrder: current.sites.length });
    }
    setNewName(''); setNewUrl(''); setEditing(null); setModal(null);
    notify(editing ? 'Website updated' : 'Website saved', 'success');
  };
  const openSiteModal = (site?: Site) => { setEditing(site ?? null); setNewName(site?.name ?? ''); setNewUrl(site?.url ?? ''); setModal('site'); setMenu(null); };
  const removeSite = (site: Site) => {
    setCollections(v => v.map(c => ({ ...c, sites: c.sites.filter(s => s.id !== site.id) })));
    void syncEngine.queueMutation('site', site.id, 'delete', null);
    setMenu(null); notify('Website removed', 'success');
  };
  const moveSite = (siteId: string, targetId: string) => {
    let moved: Site | undefined;
    const stripped = collections.map(c => ({ ...c, sites: c.sites.filter(s => { if (s.id === siteId) { moved = s; return false; } return true; }) }));
    setCollections(stripped.map(c => c.id === targetId && moved ? { ...c, sites: [...c.sites, moved] } : c));
    void syncEngine.queueMutation('site', siteId, 'update', { collectionId: targetId });
  };
  const handleDragEnd = ({ active: dragged, over, delta }: DragEndEvent) => {
    if (dragged.data.current?.type === 'widget') {
      const area = document.querySelector('.dashboard-widgets');
      const id = String(dragged.data.current.widgetId);
      let updatedX = 0;
      let updatedY = 0;
      setWidgets(items => items.map(widget => {
        if (widget.id !== id) return widget;
        const width = widget.width ?? (widget.type === 'calendar' ? 228 : 180);
        const height = widget.height ?? (widget.type === 'calendar' ? 230 : 130);
        const bounds = area?.getBoundingClientRect();
        updatedX = Math.max(0, Math.min(window.innerWidth - (bounds?.left ?? 0) - width, (widget.x ?? 0) + delta.x));
        updatedY = Math.max(0, Math.min(window.innerHeight - 90 - (bounds?.top ?? 0) - height, (widget.y ?? 0) + delta.y));
        return { ...widget, x: updatedX, y: updatedY };
      }));
      void syncEngine.queueMutation('widget', id, 'update', { x: updatedX, y: updatedY });
      return;
    }
    if (!over) return;
    if (dragged.data.current?.type === 'collection') {
      if (over.data.current?.type !== 'collection') return;
      const from = String(dragged.data.current.collectionId);
      const to = String(over.data.current.collectionId);
      setCollections(items => {
        const fromIndex = items.findIndex(c => c.id === from);
        const toIndex = items.findIndex(c => c.id === to);
        if (fromIndex >= 0 && toIndex >= 0) {
          const next = arrayMove(items, fromIndex, toIndex);
          next.forEach((col, idx) => {
            void syncEngine.queueMutation('collection', col.id, 'update', { sortOrder: idx });
          });
          return next;
        }
        return items;
      });
      return;
    }
    const sourceId = String(dragged.id);
    const fromCollection = dragged.data.current?.collectionId as string | undefined;
    const toCollection = over.data.current?.collectionId as string | undefined;
    if (!fromCollection || !toCollection) return;
    setCollections(items => {
      const source = items.find(c => c.id === fromCollection);
      const target = items.find(c => c.id === toCollection);
      const sourceIndex = source?.sites.findIndex(s => s.id === sourceId) ?? -1;
      if (!source || !target || sourceIndex < 0) return items;
      if (fromCollection === toCollection) {
        const targetIndex = source.sites.findIndex(s => s.id === String(over.id));
        if (targetIndex < 0 || targetIndex === sourceIndex) return items;
        const reordered = arrayMove(source.sites, sourceIndex, targetIndex);
        reordered.forEach((s, idx) => {
          void syncEngine.queueMutation('site', s.id, 'update', { collectionId: fromCollection, sortOrder: idx });
        });
        return items.map(c => c.id === fromCollection ? { ...c, sites: reordered } : c);
      }
      const [site] = source.sites.slice(sourceIndex, sourceIndex + 1);
      const remaining = source.sites.filter(s => s.id !== sourceId);
      const targetIndex = target.sites.findIndex(s => s.id === String(over.id));
      const destination = [...target.sites];
      destination.splice(targetIndex < 0 ? destination.length : targetIndex, 0, site);
      destination.forEach((s, idx) => {
        void syncEngine.queueMutation('site', s.id, 'update', { collectionId: toCollection, sortOrder: idx });
      });
      return items.map(c => c.id === fromCollection ? { ...c, sites: remaining } : c.id === toCollection ? { ...c, sites: destination } : c);
    });
  };

  return <DndContext sensors={sensors} modifiers={[widgetDragModifier]} collisionDetection={args => { if (args.active.data.current?.type === 'widget') return []; const collisions = pointerWithin(args); return collisions.length ? collisions : closestCenter(args); }} onDragStart={({ active: dragged }) => setDraggedSite(collections.flatMap(c => c.sites).find(site => site.id === String(dragged.id)) ?? null)} onDragEnd={event => { handleDragEnd(event); setDraggedSite(null); clearGuides(); }} onDragCancel={() => { setDraggedSite(null); clearGuides(); }}><main ref={appRef} className="app relative flex min-h-screen flex-col overflow-hidden font-[var(--ui-font)] text-[var(--text)]" onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}>
    <header className="topbar dashboard-topbar relative z-[3] flex h-[76px] items-center border-b border-[var(--line)] bg-[rgba(12,13,16,0.62)] px-[5.1%] backdrop-blur-[22px] backdrop-saturate-[130%] max-[760px]:h-[65px] max-[760px]:px-[18px]">
      <div className="collections-strip">
        <button className={`collection-scroll-button ${collectionPageCount > 1 ? 'shown' : ''}`} aria-label="Previous 6 collections" title="Previous 6 collections" disabled={collectionPage === 0} onClick={() => setCollectionPageIndex(page => Math.max(0, page - 1))}><ChevronLeft size={17}/></button>
        <div className="collection-box">
          <nav className="collections-nav" aria-label="Collections">
            <SortableContext items={visibleCollections.map(c => `collection-tab:${c.id}`)} strategy={horizontalListSortingStrategy}>
              {visibleCollections.map(c => <CollectionTab key={c.id} collection={c} active={active === c.id} accent={preferences.accent} onSelect={() => setActive(active === c.id ? null : c.id)} onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, collection: c }); }}/>) }
            </SortableContext>
            {showAddCollection && <button className="add-collection" style={{ gridColumn: (collections.length % 6) + 1 }} aria-label="New collection" title="New collection" onClick={() => openCollectionModal()}><Plus size={15}/></button>}
          </nav>
        </div>
        <button className={`collection-scroll-button ${collectionPageCount > 1 ? 'shown' : ''}`} aria-label="Next 6 collections" title="Next 6 collections" disabled={collectionPage >= collectionPageCount - 1} onClick={() => setCollectionPageIndex(page => Math.min(collectionPageCount - 1, page + 1))}><ChevronRight size={17}/></button>
      </div>
      <div className="topbar-sync-action">
        {session?.user.id
          ? <SyncStatusBadge onOpenSettings={() => { setSettingsSection('data'); setModal('settings'); }} />
          : <button type="button" className="sync-status-badge sync-nav-trigger paused" aria-label="Sign in to use cloud backup and sync" title="Sign in to use cloud backup and sync" onClick={() => { notify('Please sign in first to use cloud backup and sync.', 'warning'); setAuthModalOpen(true); }}><LockKeyhole size={15}/></button>}
      </div>
    </header>

    <GlobalSearch variant="palette" value={search} setValue={setSearch} sites={allSites} open={!!current && queryOpen} setOpen={setQueryOpen} focusRequest={searchFocusRequest}/>
    {!current ? <section className="home dashboard-home relative grid min-h-[570px] flex-1 place-items-center px-6 pt-[70px] pb-[100px] max-[760px]:min-h-[calc(100vh-111px)] max-[760px]:pt-[50px]">
      <DashboardWidgets
        widgets={widgets}
        onRemove={id => {
          setWidgets(items => items.filter(widget => widget.id !== id));
          void syncEngine.queueMutation('widget', id, 'delete', null);
        }}
        onResize={(id, size) => {
          setWidgets(items => items.map(widget => widget.id === id ? { ...widget, ...size } : widget));
          void syncEngine.queueMutation('widget', id, 'update', size);
        }}
      />
      {alignmentGuides.map((guide, index) => <span key={`${guide.axis}-${guide.position}-${index}`} aria-hidden="true" className={`alignment-guide alignment-guide-${guide.axis}`} style={guide.axis === 'x' ? { left: guide.position } : { top: guide.position }}/>) }
      <div className="hero-copy"><GlobalSearch variant="home" value={search} setValue={setSearch} sites={allSites} open={queryOpen} setOpen={setQueryOpen} focusRequest={searchFocusRequest} position={searchPosition} dragging={searchDragging} onPointerDown={startSearchDrag} onPointerMove={moveSearch} onPointerUp={endSearchDrag}/></div>
      <div className="dashboard-footer-controls">
        <div className="dashboard-add-controls" onClick={event => event.stopPropagation()}><button className="settings-fab dashboard-add-fab" aria-label="Add widget" title="Add widget" aria-expanded={widgetPickerOpen} onClick={() => setWidgetPickerOpen(open => !open)}><Plus size={19}/></button>{widgetPickerOpen && <div className="widget-picker"><div className="widget-picker-heading">ADD A WIDGET</div><button onClick={() => addWidget('clock')}><Clock3 size={16}/> Clock</button><button onClick={() => addWidget('calendar')}><CalendarDays size={16}/> Calendar</button></div>}</div>
        <button className="dashboard-shortcuts-link" title="Open keyboard shortcuts" onClick={() => setHelpOpen(true)}><span>Keyboard shortcuts</span><kbd>Ctrl</kbd><span className="shortcuts-plus">+</span><kbd>/</kbd></button>
        <button className="settings-fab dashboard-settings-fab" aria-label="Open settings" title="Settings" onClick={() => { setSettingsSection('appearance'); setModal('settings'); }}><Settings size={18}/></button>
      </div>
    </section> : <section className="collection-page mx-auto flex min-h-[calc(100vh-122px)] w-[calc(100%-64px)] flex-1 flex-col pt-6 pb-4 max-[760px]:min-h-[calc(100vh-111px)] max-[760px]:w-[calc(100%-32px)] max-[760px]:pt-4 max-[760px]:pb-[10px] max-[430px]:w-[calc(100%-24px)] max-[430px]:pt-3" style={{ '--collection-color': current.color || preferences.accent, '--collection-font': current.cardFont ? `'${current.cardFont}', sans-serif` : current.font ? `'${current.font}', sans-serif` : 'var(--ui-font)', '--card-font-size': `${current.cardFontSize ?? preferences.size}px` } as CSSProperties}>
      <CollectionGrid collection={current} onContextMenu={(site, e) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, site }); }} onMenu={(site, rect) => setMenu({ x: rect.right, y: rect.bottom, site })} onAdd={() => openSiteModal()}/>
      <button className="footer-home collection-dashboard-home" onClick={() => setActive(null)}><Home size={15}/><span>Home</span></button>
      <button className="settings-fab collection-settings-fab" aria-label="Open settings" title="Settings" onClick={() => { setSettingsSection('appearance'); setModal('settings'); }}><Settings size={18}/></button>
    </section>}

    {modal && <div className="overlay" onMouseDown={e => e.target === e.currentTarget && (appearancePreview && modal === 'settings' ? (setAppearancePreview(null), setModal(null)) : setModal(null))}><div className={`modal ${modal === 'settings' ? 'settings-modal' : ''}`}><button className="modal-close" onClick={() => { if (modal === 'settings') setAppearancePreview(null); setModal(null); }} aria-label="Close"><X size={17}/></button>
      {modal === 'collection' && <><span className="modal-icon"><FolderPlus size={20}/></span><div className="modal-eyebrow">{editingCollection ? 'UPDATE COLLECTION' : 'A NEW LITTLE CORNER'}</div><h2>{editingCollection ? 'Rename collection' : 'Create a collection'}</h2><p>{editingCollection ? 'Choose a name that feels right.' : 'Give your favorite places a place of their own.'}</p><label className="field-label">COLLECTION NAME</label><input className="field" autoFocus placeholder="e.g. Weekend reading" value={newCollection} onChange={e => setNewCollection(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveCollection()}/><label className="field-label">COLLECTION COLOR</label><ColorPicker label="Collection color" value={newCollectionColor} fallbackColor={preferences.accent} allowNone onChange={setNewCollectionColor}/><div className="modal-actions"><button className="cancel-button" onClick={() => { setEditingCollection(null); setModal(null); }}>Cancel</button><button className="primary-button" onClick={saveCollection}>{editingCollection ? 'Save changes' : 'Create collection'} <ArrowUpRight size={15}/></button></div></>}
      {modal === 'site' && <><span className="modal-icon"><Link2 size={20}/></span><div className="modal-eyebrow">{editing ? 'TIDY UP YOUR COLLECTION' : `ADD TO ${current?.name.toUpperCase()}`}</div><h2>{editing ? 'Edit website' : 'Save a website'}</h2><p>A shortcut to somewhere you love.</p><label className="field-label">DISPLAY NAME</label><input className="field" autoFocus placeholder="e.g. Are.na" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveSite()}/><label className="field-label">WEBSITE ADDRESS</label><input className="field" placeholder="e.g. are.na" value={newUrl} onChange={e => setNewUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveSite()}/><div className="modal-actions"><button className="cancel-button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button" onClick={saveSite}>{editing ? 'Save changes' : 'Save website'} <ArrowUpRight size={15}/></button></div></>}
      {modal === 'settings' && <SettingsPanel
        preferences={preferences}
        setPreferences={action => {
          setPreferences(current => {
            const next = typeof action === 'function' ? action(current) : action;
            void syncEngine.queueMutation('preferences', 'user_preferences', 'update', next);
            return next;
          });
        }}
        onAppearancePreview={setAppearancePreview}
        collections={collections}
        onCollectionsUpdate={updates => {
          setCollections(items => items.map(collection => ({ ...collection, ...(updates[collection.id] ?? {}) })));
          for (const [colId, patch] of Object.entries(updates)) {
            void syncEngine.queueMutation('collection', colId, 'update', patch);
          }
        }}
        onNotify={notify}
        initialSection={settingsSection}
        initialCollectionId={settingsCollectionId}
        profile={profile}
        setProfile={action => {
          setProfile(current => {
            const next = typeof action === 'function' ? action(current) : action;
            void syncEngine.queueMutation('profile', 'user_profile', 'update', next);
            return next;
          });
        }}
        onImport={importBackup}
        onWipeLocalData={wipeAllKeeperData}
        widgets={widgets}
        searchPosition={searchPosition}
        checkpoints={checkpoints}
        onCheckpointsChange={action => {
          setCheckpoints(current => {
            const next = typeof action === 'function' ? action(current) : action;
            const currentIds = new Set(current.map(c => c.exportedAt));
            const nextIds = new Set(next.map(c => c.exportedAt));
            for (const cp of next) {
              if (!currentIds.has(cp.exportedAt)) {
                void syncEngine.queueMutation('checkpoint', cp.exportedAt, 'insert', cp);
              }
            }
            for (const cp of current) {
              if (!nextIds.has(cp.exportedAt)) {
                void syncEngine.queueMutation('checkpoint', cp.exportedAt, 'delete', null);
              }
            }
            return next;
          });
        }}
        userEmail={session?.user.email ?? ''}
        isAuthenticated={!!session?.user.id}
        syncState={syncState}
        onSignOut={async () => { const { error } = await supabase!.auth.signOut(); if (error) notify('Could not sign out. Please try again.', 'error'); else setModal(null); }}
        onSignIn={() => { setModal(null); setAuthModalOpen(true); }}
      />}

    </div></div>}
    {onboardingOpen && <div className="overlay" onMouseDown={e => e.target === e.currentTarget && dismissOnboarding()}><section className="modal onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><button className="modal-close" onClick={dismissOnboarding} aria-label="Close"><X size={17}/></button><div className="modal-eyebrow">WELCOME TO KEEPER</div><h2 id="onboarding-title">Your favorite places, all in one spot.</h2><p>Make a personal dashboard for the websites you visit most.</p><ul className="onboarding-features"><li><FolderPlus size={17}/><span><strong>Collections</strong>Group websites by work, interests, or anything you like.</span></li><li><Link2 size={17}/><span><strong>Website shortcuts</strong>Save a name and address, then open it from your collection.</span></li><li><Search size={17}/><span><strong>Quick search</strong>Find saved websites or search the web from the home screen.</span></li><li><Settings size={17}/><span><strong>Make it yours</strong>Adjust the look, add clock or calendar widgets, and back up your data in settings.</span></li></ul><div className="modal-actions"><button className="primary-button" onClick={dismissOnboarding}>Get started <ArrowUpRight size={15}/></button></div></section></div>}
    {authModalOpen && <div className="overlay" onMouseDown={e => e.target === e.currentTarget && setAuthModalOpen(false)}><div className="optional-auth-modal"><button className="modal-close" onClick={() => setAuthModalOpen(false)} aria-label="Close"><X size={17}/></button><AuthScreen recovery={passwordRecovery} onAuthenticated={() => { setAuthModalOpen(false); setPasswordRecovery(false); }}/></div></div>}
    {confirmDelete && <div className="overlay confirm-overlay" onMouseDown={e => e.target === e.currentTarget && setConfirmDelete(null)}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><span className="confirm-icon"><TriangleAlert size={19}/></span><div className="modal-eyebrow">DELETE COLLECTION</div><h2 id="confirm-title">Are you sure?</h2><p id="confirm-description">Delete “{confirmDelete.name}” and its saved websites? This can’t be undone.</p><div className="modal-actions"><button className="cancel-button" onClick={() => setConfirmDelete(null)}>Cancel</button><button className="confirm-delete-button" onClick={() => deleteCollection(confirmDelete)}><X size={15}/> Delete collection</button></div></section></div>}
    <div className="toast-stack" aria-live="polite" aria-atomic="false">{toasts.map(toast => <div key={toast.id} className={`toast toast-${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>{toast.tone === 'success' ? <Check size={16}/> : <TriangleAlert size={16}/>}<span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToasts(items => items.filter(item => item.id !== toast.id))}><X size={14}/></button></div>)}</div>
    {menu && <div ref={menuRef} className="context-menu" style={{ left: Math.min(menu.x, window.innerWidth - 220), top: menu.y, '--menu-font': menu.collection?.nameFont ?? menu.collection?.font ?? (menu.site ? collections.find(collection => collection.sites.some(site => site.id === menu.site!.id))?.cardFont : null) ?? 'var(--ui-font)' } as CSSProperties} role="menu" onClick={e => e.stopPropagation()}>{menu.collection ? <><button role="menuitem" onClick={() => openCollectionModal(menu.collection!)}><FolderPlus size={15}/> Rename collection</button><button role="menuitem" onClick={() => { setSettingsCollectionId(menu.collection!.id); setSettingsSection('collections'); setModal('settings'); setMenu(null); }}><Settings size={15}/> Collection settings</button><button role="menuitem" className="danger" onClick={() => { setConfirmDelete(menu.collection!); setMenu(null); }}><X size={15}/> Delete collection</button></> : menu.site ? <><button role="menuitem" onClick={() => { window.open(`https://${menu.site!.url}`, '_blank'); setMenu(null); }}><ExternalLink size={15}/> Open website</button><button role="menuitem" onClick={() => openSiteModal(menu.site)}><Link2 size={15}/> Edit shortcut</button><div className="context-divider"/><div className="context-label">MOVE TO COLLECTION</div>{collections.filter(c => !c.sites.some(s => s.id === menu.site!.id)).map(c => <button role="menuitem" key={c.id} onClick={() => { moveSite(menu.site!.id, c.id); setMenu(null); }}><span className="tab-dot" style={{ background: c.color }}/>{c.name}</button>)}<div className="context-divider"/><button role="menuitem" className="danger" onClick={() => removeSite(menu.site!)}><X size={15}/> Remove shortcut</button></> : <><button role="menuitem" onClick={() => { setActive(null); setMenu(null); }}><Compass size={15}/> Go to dashboard</button><button role="menuitem" onClick={() => openCollectionModal()}><FolderPlus size={15}/> New collection</button><button role="menuitem" onClick={() => { setModal('settings'); setMenu(null); }}><Settings size={15}/> Settings</button></>}</div>}
    <DragOverlay dropAnimation={{ duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>{draggedSite ? <SiteDragPreview site={draggedSite}/> : null}</DragOverlay>
    {helpOpen && <KeyboardHelp onClose={() => setHelpOpen(false)} />}
  </main></DndContext>;
}

export default App;

