import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Camera, Check, Database, Download, Eye, EyeOff, FileUp, Folder, LogIn, Palette, RotateCcw, Settings, Trash2, Upload, UserRound } from 'lucide-react';
import type { Collection } from '../collections/types';
import { ColorPicker } from '../../components/ColorPicker';
import { FontSelector } from '../../components/FontSelector';
import { FontSizeSelector, type FontSize } from '../../components/FontSelector';
import type { Preferences } from './preferences';
import type { DashboardWidget } from '../dashboard/DashboardWidgets';
import { defaultPreferences } from './preferences';
import { FONT_OPTIONS } from './preferences';
import { isBackup } from '../../lib/validation';

export type UserProfile = { name: string; email?: string; hideEmail?: boolean; avatarPath?: string };
export type DataBackup = { version: 1; exportedAt: string; collections: Collection[]; preferences: Preferences; profile: UserProfile; widgets?: DashboardWidget[]; searchPosition?: { x: number; y: number } };

export function SettingsPanel({ preferences, setPreferences, onAppearancePreview, collections, onCollectionsUpdate, onNotify, initialSection, initialCollectionId, profile, setProfile, onImport, widgets, searchPosition, checkpoints, onCheckpointsChange, userEmail, syncState, onSignOut, onSignIn, onAvatarUpload, onAvatarRemove, avatarUrl }: {
  preferences: Preferences;
  setPreferences: Dispatch<SetStateAction<Preferences>>;
  onAppearancePreview: (preferences: Preferences | null) => void;
  collections: Collection[];
  onCollectionsUpdate: (updates: Record<string, Partial<Pick<Collection, 'color' | 'nameFont' | 'titleFontSize' | 'cardFont' | 'cardFontSize'>>>) => void;
  onNotify: (message: string, tone?: 'success' | 'warning' | 'error') => void;
  initialSection: 'appearance' | 'collections' | 'profile' | 'data';
  initialCollectionId?: string;
  profile: UserProfile;
  setProfile: Dispatch<SetStateAction<UserProfile>>;
  onImport: (backup: DataBackup) => void;
  widgets: DashboardWidget[];
  searchPosition: { x: number; y: number };
  checkpoints: DataBackup[];
  onCheckpointsChange: (checkpoints: DataBackup[]) => void;
  userEmail: string;
  onSignOut: () => void;
  onSignIn: () => void;
  onAvatarUpload: (file: File) => Promise<void>;
  onAvatarRemove: () => Promise<void>;
  avatarUrl?: string;
  syncState: 'local' | 'syncing' | 'synced' | 'error';
}) {
  const [section, setSection] = useState<'appearance' | 'collections' | 'profile' | 'data'>(initialSection);
  const [confirmReset, setConfirmReset] = useState(false);
  const [preview, setPreview] = useState<DataBackup | null>(null);
  const [draftPreferences, setDraftPreferences] = useState(preferences);
  const [draftProfile, setDraftProfile] = useState(profile);
  const [draftCollectionStyles, setDraftCollectionStyles] = useState<Record<string, Partial<Pick<Collection, 'color' | 'nameFont' | 'titleFontSize' | 'cardFont' | 'cardFontSize'>>>>(() => Object.fromEntries(collections.map(collection => [collection.id, { color: collection.color, nameFont: collection.nameFont, titleFontSize: collection.titleFontSize, cardFont: collection.cardFont, cardFontSize: collection.cardFontSize }])));
  useEffect(() => setSection(initialSection), [initialSection]);
  useEffect(() => { setDraftCollectionStyles(current => Object.fromEntries(collections.map(collection => [collection.id, current[collection.id] ?? { color: collection.color, nameFont: collection.nameFont, titleFontSize: collection.titleFontSize, cardFont: collection.cardFont, cardFontSize: collection.cardFontSize }]))); }, [collections]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(initialCollectionId ?? collections[0]?.id ?? '');
  const selectedCollection = collections.find(collection => collection.id === selectedCollectionId) ?? collections[0];
  const selectedStyle = selectedCollection ? { ...selectedCollection, ...(draftCollectionStyles[selectedCollection.id] ?? {}) } : undefined;
  const collectionChanges = Object.fromEntries(collections.flatMap(collection => {
    const style = draftCollectionStyles[collection.id] ?? { color: collection.color, nameFont: collection.nameFont, titleFontSize: collection.titleFontSize, cardFont: collection.cardFont, cardFontSize: collection.cardFontSize };
    return style.color !== collection.color || (style.nameFont ?? null) !== (collection.nameFont ?? null) || style.titleFontSize !== collection.titleFontSize || (style.cardFont ?? null) !== (collection.cardFont ?? null) || style.cardFontSize !== collection.cardFontSize ? [[collection.id, style]] : [];
  }));
  const isDirty = JSON.stringify(draftPreferences) !== JSON.stringify(preferences) || JSON.stringify(draftProfile) !== JSON.stringify(profile) || Object.keys(collectionChanges).length > 0;
  const discardChanges = () => {
    setDraftPreferences(preferences);
    setDraftProfile(profile);
    setDraftCollectionStyles(Object.fromEntries(collections.map(collection => [collection.id, { color: collection.color, nameFont: collection.nameFont, titleFontSize: collection.titleFontSize, cardFont: collection.cardFont, cardFontSize: collection.cardFontSize }])));
    onAppearancePreview(null);
  };
  const maskEmail = (value: string) => {
    const [local = '', domain = ''] = value.split('@');
    if (!draftProfile.hideEmail || !domain) return value;
    const visible = local.length < 3 ? local.slice(0, 1) : `${local.slice(0, 2)}${'*'.repeat(Math.min(5, Math.max(2, local.length - 2)))}`;
    return `${visible}@${domain}`;
  };
  const saveChanges = () => {
    setPreferences(draftPreferences);
    onAppearancePreview(null);
    setProfile(draftProfile);
    onCollectionsUpdate(collectionChanges);
    onNotify('Settings saved', 'success');
  };
  const removeProfilePicture = async () => {
    await onAvatarRemove();
    setDraftProfile(current => ({ ...current, avatarPath: undefined }));
  };
  const createBackup = (): DataBackup => ({ version: 1, exportedAt: new Date().toISOString(), collections: collections.map(collection => ({ ...collection, ...(draftCollectionStyles[collection.id] ?? {}) })), preferences: draftPreferences, profile: draftProfile, widgets, searchPosition });
  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(createBackup(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `keeper-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
    onNotify('Data backup exported', 'success');
  };
  const importData = async (file?: File) => {
    if (!file) return;
    if (file.size > 10_000_000) { onNotify('Backup files must be under 10 MB', 'warning'); return; }
    try { const parsed: unknown = JSON.parse(await file.text()); if (!isBackup(parsed)) throw new Error('Invalid backup format'); onImport(parsed); }
    catch { onNotify('That file is not a valid Keeper backup', 'error'); }
  };
  const saveCheckpoints = (items: DataBackup[]) => onCheckpointsChange(items);
  const createCheckpoint = () => {
    if (checkpoints.length >= 5) { onNotify('You can keep up to 5 checkpoints. Delete one to create another.', 'warning'); return; }
    saveCheckpoints([...checkpoints, { ...createBackup(), exportedAt: new Date().toISOString() }]); onNotify('Checkpoint created', 'success');
  };
  const restoreCheckpoint = (checkpoint: DataBackup) => { onImport(checkpoint); setPreview(null); onNotify('Checkpoint restored', 'success'); };

  return <div className="settings-layout">
    <aside className="settings-nav" aria-label="Settings sections">
      <div className="settings-nav-heading"><Settings size={17}/> <span>Settings</span></div>
      <button type="button" aria-current={section === 'profile' ? 'page' : undefined} className={`settings-nav-item ${section === 'profile' ? 'active' : ''}`} onClick={() => setSection('profile')}><UserRound size={16}/> Profile</button>
      <button type="button" aria-current={section === 'appearance' ? 'page' : undefined} className={`settings-nav-item ${section === 'appearance' ? 'active' : ''}`} onClick={() => setSection('appearance')}><Palette size={16}/> Appearance</button>
      <button type="button" aria-current={section === 'collections' ? 'page' : undefined} className={`settings-nav-item ${section === 'collections' ? 'active' : ''}`} onClick={() => setSection('collections')}><Folder size={16}/> Collections</button>
      <button type="button" aria-current={section === 'data' ? 'page' : undefined} className={`settings-nav-item ${section === 'data' ? 'active' : ''}`} onClick={() => setSection('data')}><Database size={16}/> Data</button>
    </aside>
    <section className="settings-main">
      <header className="settings-page-heading"><div className="modal-eyebrow">{section === 'profile' ? 'YOUR ACCOUNT' : section === 'data' ? 'BACKUP & STORAGE' : 'PERSONALIZE YOUR SPACE'}</div><h2>{section === 'appearance' ? 'Appearance' : section === 'collections' ? 'Collections' : section === 'profile' ? 'Profile' : 'Data'}</h2><p>{section === 'appearance' ? 'Changes take effect when you save.' : section === 'collections' ? 'Choose a collection to personalize.' : section === 'profile' ? 'Manage your local profile details.' : 'Back up, restore, and understand your saved data.'}</p></header>
      {section === 'appearance' ? <div className="settings-content">
        <div className="settings-section"><div className="settings-title">ACCENT COLOR</div><ColorPicker label="Accent color" value={draftPreferences.accent} onChange={color => setDraftPreferences(v => { const next = { ...v, accent: color }; onAppearancePreview(next); return next; })}/></div>
        <div className="settings-section"><div className="settings-title">BACKGROUND</div><div className="settings-choice">{(['solid','gradient','image'] as const).map(mode => <button key={mode} className={draftPreferences.background === mode ? 'chosen' : ''} onClick={() => setDraftPreferences(v => { const next = { ...v, background: mode }; onAppearancePreview(next); return next; })}>{mode === 'solid' ? 'Solid' : mode === 'gradient' ? 'Blend' : 'Image'}</button>)}</div>
          {draftPreferences.background !== 'image' ? <div className="background-colors"><div><span>{draftPreferences.background === 'gradient' ? 'Color one' : 'Color'}</span><ColorPicker label={draftPreferences.background === 'gradient' ? 'First background color' : 'Background color'} value={draftPreferences.color1} onChange={color => setDraftPreferences(v => { const next = { ...v, color1: color }; onAppearancePreview(next); return next; })}/></div>{draftPreferences.background === 'gradient' && <div><span>Color two</span><ColorPicker label="Second background color" value={draftPreferences.color2} onChange={color => setDraftPreferences(v => { const next = { ...v, color2: color }; onAppearancePreview(next); return next; })}/></div>}</div> : <><input className="field settings-input" placeholder="Paste an image URL (https://...)" value={draftPreferences.image.startsWith('data:') ? '' : draftPreferences.image} onChange={e => setDraftPreferences(v => { const next = { ...v, image: e.target.value }; onAppearancePreview(next); return next; })}/><div className="image-actions"><label className="upload-button"><Upload size={14}/> Upload image<input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 1_500_000) { onNotify('Choose an image under 1.5 MB', 'warning'); e.currentTarget.value = ''; return; } const reader = new FileReader(); reader.onload = () => { setDraftPreferences(v => { const next = { ...v, image: String(reader.result), background: 'image' as const }; onAppearancePreview(next); return next; }); onNotify('Background image uploaded', 'success'); }; reader.onerror = () => onNotify('Could not read that image', 'error'); reader.readAsDataURL(file); }}/></label>{draftPreferences.image.startsWith('data:') && <button className="text-button" onClick={() => setDraftPreferences(v => { const next = { ...v, image: '' }; onAppearancePreview(next); return next; })}>Remove upload</button>}</div><small className="settings-help">Uploaded images are stored in this browser. Keep files under 1.5 MB.</small></>}
        </div>
        <div className="settings-section"><div className="settings-title">FONT</div><small className="settings-help">Preview a typeface, then select it to apply across Keeper.</small><FontSelector value={draftPreferences.font} options={FONT_OPTIONS} size={draftPreferences.size} onSizeChange={size => { const next = { ...draftPreferences, size }; setDraftPreferences(next); onAppearancePreview(next); }} onChange={font => setDraftPreferences(v => { const next = { ...v, font }; onAppearancePreview(next); return next; })}/><button className="text-button" onClick={() => setConfirmReset(true)}>Reset appearance</button></div>
      </div> : section === 'collections' ? <div className="settings-content"><div className="settings-section collection-settings">
        <div className="settings-title">COLLECTION STYLE</div>
        {collections.length ? <>
          <label className="collection-setting-label">Choose collection<select className="field settings-input" value={selectedCollection?.id ?? ''} onChange={e => setSelectedCollectionId(e.target.value)}>{collections.map(collection => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>
          {selectedCollection && <>
            <div className="collection-setting-label"><span>Collection color</span><ColorPicker label="Collection color" value={selectedStyle!.color} fallbackColor={draftPreferences.accent} allowNone onChange={color => setDraftCollectionStyles(value => ({ ...value, [selectedCollection.id]: { ...value[selectedCollection.id], color } }))}/></div>
            <div className="collection-setting-label"><span>Collection name font</span><small className="settings-help">Controls this collection’s label in the top navigation.</small><FontSelector value={selectedStyle!.nameFont ?? selectedStyle!.font ?? draftPreferences.font} options={FONT_OPTIONS} onChange={font => setDraftCollectionStyles(value => ({ ...value, [selectedCollection.id]: { ...value[selectedCollection.id], nameFont: font } }))}/><button type="button" className="text-button" onClick={() => setDraftCollectionStyles(value => ({ ...value, [selectedCollection.id]: { ...value[selectedCollection.id], nameFont: null } }))}>Use global font</button></div>
            <div className="collection-setting-label"><span>Collection title size</span><small className="settings-help">Controls this collection’s name in the top navigation.</small><FontSizeSelector label="Collection title size" value={selectedStyle!.titleFontSize ?? draftPreferences.size} onChange={(titleFontSize: FontSize) => setDraftCollectionStyles(value => ({ ...value, [selectedCollection.id]: { ...value[selectedCollection.id], titleFontSize } }))}/></div><div className="collection-setting-label"><span>Website card font</span><small className="settings-help">Controls text on cards in this collection.</small><FontSelector value={selectedStyle!.cardFont ?? selectedStyle!.font ?? draftPreferences.font} options={FONT_OPTIONS} onChange={font => setDraftCollectionStyles(value => ({ ...value, [selectedCollection.id]: { ...value[selectedCollection.id], cardFont: font } }))}/><button type="button" className="text-button" onClick={() => setDraftCollectionStyles(value => ({ ...value, [selectedCollection.id]: { ...value[selectedCollection.id], cardFont: null } }))}>Use global font</button><FontSizeSelector label="Website card text size" value={selectedStyle!.cardFontSize ?? draftPreferences.size} onChange={(cardFontSize: FontSize) => setDraftCollectionStyles(value => ({ ...value, [selectedCollection.id]: { ...value[selectedCollection.id], cardFontSize } }))}/></div>
          </>}
        </> : <p className="collection-settings-empty">Create a collection first to set its color and font.</p>}
      </div></div> : section === 'profile' ? <div className="settings-content"><div className="settings-section profile-settings"><div className="profile-avatar-large">{avatarUrl ? <img src={avatarUrl} alt="Profile"/> : profile.name.trim().charAt(0).toUpperCase() || <UserRound size={24}/>}</div>{userEmail && <div className="image-actions"><label className="upload-button profile-avatar-upload"><Camera size={14}/> Change profile picture<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.currentTarget.files?.[0]; if (file) void onAvatarUpload(file); e.currentTarget.value = ''; }}/></label>{profile.avatarPath && <button type="button" className="text-button danger-text profile-avatar-upload" onClick={() => void removeProfilePicture()}>Remove profile picture</button>}</div>}{!userEmail && <small className="settings-help">Sign in to add a profile picture.</small>}<label className="collection-setting-label">Display name<input className="field settings-input" autoComplete="name" placeholder="Your name" value={draftProfile.name} onChange={e => setDraftProfile(value => ({ ...value, name: e.target.value }))}/></label><div className="profile-auth"><div><strong>{userEmail ? maskEmail(userEmail) : 'Optional account'}</strong><small>{userEmail ? 'Signed in with Keeper account' : 'Sign in to use your account across devices.'}</small></div>{userEmail && <button type="button" className="quiet-button email-mask-toggle" onClick={() => setDraftProfile(value => ({ ...value, hideEmail: !value.hideEmail }))} aria-label={draftProfile.hideEmail ? 'Show email address' : 'Hide email address'} aria-pressed={!!draftProfile.hideEmail} title={draftProfile.hideEmail ? 'Show email address' : 'Hide email address'}>{draftProfile.hideEmail ? <Eye size={15}/> : <EyeOff size={15}/>}</button>}{userEmail ? <button type="button" className="primary-button profile-auth-button" onClick={onSignOut}>Sign out</button> : <button type="button" className="primary-button profile-auth-button" onClick={onSignIn}><LogIn size={15}/> Sign in / Sign up</button>}</div><small className="settings-help">Your display name and app data are saved in this browser.</small></div></div> : <div className="settings-content"><div className="settings-section data-settings"><div className="data-sync-card"><span className="data-sync-email">{userEmail ? maskEmail(userEmail) : 'Not linked'}</span><span className={`data-sync-state ${syncState}`} role="status"><i/> {syncState === 'syncing' ? 'Syncing' : syncState === 'synced' ? 'Up to date' : syncState === 'error' ? 'Sync issue' : 'Local only'}</span></div><div className="checkpoint-heading"><div><div className="settings-title">CHECKPOINTS</div><p>Save and restore snapshots of your collections and settings.</p></div><span className="checkpoint-count">{checkpoints.length} / 5</span></div><div className="data-actions"><button className="primary-button" onClick={createCheckpoint} disabled={checkpoints.length >= 5}><Database size={15}/> {checkpoints.length >= 5 ? 'Checkpoint limit reached' : 'Create checkpoint'}</button></div>{checkpoints.length > 0 ? <ul className="checkpoint-list">{checkpoints.map(checkpoint => <li key={checkpoint.exportedAt}><time dateTime={checkpoint.exportedAt}>{new Date(checkpoint.exportedAt).toLocaleString()}</time><div><button className="text-button" onClick={() => setPreview(checkpoint)}><Eye size={14}/> Preview</button><button className="text-button" onClick={() => restoreCheckpoint(checkpoint)}><RotateCcw size={14}/> Restore</button><button className="text-button danger-text" aria-label="Delete checkpoint" onClick={() => saveCheckpoints(checkpoints.filter(item => item !== checkpoint))}><Trash2 size={14}/></button></div></li>)}</ul> : <p className="checkpoint-empty">No checkpoints yet. Create one to keep a restore point.</p>}<div className="settings-title checkpoint-title">BACKUP FILE</div><p>Export your data or restore a Keeper JSON backup.</p><div className="data-size">Approximate backup size <strong>{(new Blob([JSON.stringify(createBackup())]).size / 1024).toFixed(1)} KB</strong></div><div className="data-actions"><button className="primary-button" onClick={exportData}><Download size={15}/> Export backup</button><label className="upload-button"><FileUp size={15}/> Import backup<input type="file" accept="application/json,.json" onChange={e => { void importData(e.target.files?.[0]); e.currentTarget.value = ''; }}/></label></div><small className="settings-help">Importing replaces your current collections, appearance, and profile. Only Keeper JSON backups are accepted (up to 10 MB).</small></div></div>}
      {isDirty && <div className="settings-actions"><button className="cancel-button" onClick={discardChanges}>Discard changes</button><button className="primary-button" onClick={saveChanges}>Save <Check size={15}/></button></div>}
    </section>
      {confirmReset && <div className="overlay confirm-overlay" onMouseDown={event => event.target === event.currentTarget && setConfirmReset(false)}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description"><span className="confirm-icon"><RotateCcw size={19}/></span><div className="modal-eyebrow">RESET APPEARANCE</div><h2 id="reset-title">Restore default appearance?</h2><p id="reset-description">Your current colors, background, font, and UI size will be replaced with the defaults.</p><div className="modal-actions"><button className="cancel-button" onClick={() => setConfirmReset(false)}>Cancel</button><button className="confirm-delete-button" onClick={() => { setDraftPreferences(defaultPreferences); onAppearancePreview(defaultPreferences); setConfirmReset(false); }}><RotateCcw size={15}/> Reset appearance</button></div></section></div>}
    {preview && <div className="overlay confirm-overlay" onMouseDown={event => event.target === event.currentTarget && setPreview(null)}><section className="confirm-dialog checkpoint-preview" role="dialog" aria-modal="true" aria-labelledby="checkpoint-preview-title"><div className="modal-eyebrow">CHECKPOINT PREVIEW · {new Date(preview.exportedAt).toLocaleString()}</div><h2 id="checkpoint-preview-title">{preview.collections.length} collections</h2><ul>{preview.collections.map(collection => <li key={collection.id}><strong>{collection.name}</strong><span>{collection.sites.length} websites</span></li>)}</ul><p>This is a temporary preview. Your current data has not changed.</p><div className="modal-actions"><button className="cancel-button" onClick={() => setPreview(null)}>Close preview</button><button className="primary-button" onClick={() => restoreCheckpoint(preview)}><RotateCcw size={15}/> Restore checkpoint</button></div></section></div>}
  </div>;
}

