import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { AlertCircle, Check, Database, Download, Eye, EyeOff, FileUp, Folder, Info, LogIn, Palette, PauseCircle, RotateCcw, Settings, Trash2 } from 'lucide-react';
import type { Collection } from '../collections/types';
import { ColorPicker } from '../../components/ColorPicker';
import { FontSelector } from '../../components/FontSelector';
import { FontSizeSelector, type FontSize } from '../../components/FontSelector';
import { WallpaperPicker } from '../../components/WallpaperPicker';
import type { Preferences } from './preferences';
import type { DashboardWidget } from '../dashboard/DashboardWidgets';
import { defaultPreferences } from './preferences';
import { FONT_OPTIONS } from './preferences';
import { isBackup } from '../../lib/validation';
import { syncEngine, type SyncEngineState } from '../../lib/sync';
import { supabase } from '../../lib/supabase';

export type UserProfile = { name: string; email?: string; hideEmail?: boolean; avatarPath?: string };
export type DataBackup = { version: 1; exportedAt: string; collections: Collection[]; preferences: Preferences; profile: UserProfile; widgets?: DashboardWidget[]; searchPosition?: { x: number; y: number } };

export function SettingsPanel({ preferences, setPreferences, onAppearancePreview, collections, onCollectionsUpdate, onNotify, initialSection, initialCollectionId, profile, setProfile, onImport, onWipeLocalData, widgets, searchPosition, checkpoints, onCheckpointsChange, userEmail, isAuthenticated, syncState: _syncState, onSignOut, onSignIn }: {
  preferences: Preferences;
  setPreferences: Dispatch<SetStateAction<Preferences>>;
  onAppearancePreview: (preferences: Preferences | null) => void;
  collections: Collection[];
  onCollectionsUpdate: (updates: Record<string, Partial<Pick<Collection, 'color' | 'font' | 'nameFont' | 'titleFontSize' | 'cardFont' | 'cardFontSize'>>>) => void;
  onNotify: (message: string, tone?: 'success' | 'warning' | 'error') => void;
  initialSection: 'appearance' | 'collections' | 'profile' | 'data';
  initialCollectionId?: string;
  profile: UserProfile;
  setProfile: Dispatch<SetStateAction<UserProfile>>;
  onImport: (backup: DataBackup) => void;
  onWipeLocalData: () => Promise<void>;
  widgets: DashboardWidget[];
  searchPosition: { x: number; y: number };
  checkpoints: DataBackup[];
  onCheckpointsChange: Dispatch<SetStateAction<DataBackup[]>>;
  userEmail: string;
  isAuthenticated: boolean;
  onSignOut: () => void;
  onSignIn: () => void;
  syncState: 'local' | 'syncing' | 'synced' | 'offline' | 'paused' | 'error';
}) {
  const [section, setSection] = useState<'appearance' | 'collections' | 'profile' | 'data'>(initialSection);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmResetCollection, setConfirmResetCollection] = useState(false);
  const [confirmWipeLocal, setConfirmWipeLocal] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [preview, setPreview] = useState<DataBackup | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<DataBackup | null>(null);
  const [confirmDeleteCheckpoint, setConfirmDeleteCheckpoint] = useState<DataBackup | null>(null);
  const [engineState, setEngineState] = useState<SyncEngineState>(() => syncEngine.getState());
  useEffect(() => syncEngine.subscribe(setEngineState), []);
  const [wallpaperToDelete, setWallpaperToDelete] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<DataBackup | null>(null);
  const [draftPreferences, setDraftPreferences] = useState(preferences);
  const [draftProfile, setDraftProfile] = useState(profile);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [draftCollectionStyles, setDraftCollectionStyles] = useState<Record<string, Partial<Pick<Collection, 'color' | 'font' | 'nameFont' | 'titleFontSize' | 'cardFont' | 'cardFontSize'>>>>(() => Object.fromEntries(collections.map(collection => [collection.id, { color: collection.color, font: collection.font, nameFont: collection.nameFont, titleFontSize: collection.titleFontSize, cardFont: collection.cardFont, cardFontSize: collection.cardFontSize }])));
  useEffect(() => setSection(initialSection), [initialSection]);
  useEffect(() => { setDraftCollectionStyles(current => Object.fromEntries(collections.map(collection => [collection.id, current[collection.id] ?? { color: collection.color, font: collection.font, nameFont: collection.nameFont, titleFontSize: collection.titleFontSize, cardFont: collection.cardFont, cardFontSize: collection.cardFontSize }]))); }, [collections]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(initialCollectionId ?? collections[0]?.id ?? '');
  const selectedCollection = collections.find(collection => collection.id === selectedCollectionId) ?? collections[0];
  const selectedStyle = selectedCollection ? { ...selectedCollection, ...(draftCollectionStyles[selectedCollection.id] ?? {}) } : undefined;
  const collectionChanges = Object.fromEntries(collections.flatMap(collection => {
    const style = draftCollectionStyles[collection.id] ?? { color: collection.color, font: collection.font, nameFont: collection.nameFont, titleFontSize: collection.titleFontSize, cardFont: collection.cardFont, cardFontSize: collection.cardFontSize };
    return style.color !== collection.color || style.font !== collection.font || (style.nameFont ?? null) !== (collection.nameFont ?? null) || style.titleFontSize !== collection.titleFontSize || (style.cardFont ?? null) !== (collection.cardFont ?? null) || style.cardFontSize !== collection.cardFontSize ? [[collection.id, style]] : [];
  }));
  const isDirty = JSON.stringify(draftPreferences) !== JSON.stringify(preferences) || JSON.stringify(draftProfile) !== JSON.stringify(profile) || Object.keys(collectionChanges).length > 0;
  const discardChanges = () => {
    setDraftPreferences(preferences);
    setDraftProfile(profile);
    setDraftCollectionStyles(Object.fromEntries(collections.map(collection => [collection.id, { color: collection.color, font: collection.font, nameFont: collection.nameFont, titleFontSize: collection.titleFontSize, cardFont: collection.cardFont, cardFontSize: collection.cardFontSize }])));
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
  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || passwordBusy) return;
    if (newPassword !== confirmNewPassword) { setPasswordMessage('New passwords do not match.'); return; }
    setPasswordBusy(true);
    setPasswordMessage('');
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: userEmail, password: currentPassword });
      if (signInError) { setPasswordMessage('Current password is incorrect.'); return; }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setPasswordMessage('Could not update the password. Please try again.'); return; }
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
      setPasswordMessage('Your password has been updated.');
    } catch {
      setPasswordMessage('Could not reach the authentication service. Please try again.');
    } finally {
      setPasswordBusy(false);
    }
  };
  const createBackup = (): DataBackup => ({ version: 1, exportedAt: new Date().toISOString(), collections: collections.map(collection => ({ ...collection, ...(draftCollectionStyles[collection.id] ?? {}) })), preferences: draftPreferences, profile: draftProfile, widgets, searchPosition });
  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(createBackup(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `keeper-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
    onNotify('Data backup exported', 'success');
  };
  const importData = async (file?: File) => {
    if (!file) return;
    setImportPreview(null);
    if (file.size > 10_000_000) { onNotify('Backup files must be under 10 MB', 'warning'); return; }
    try { const parsed: unknown = JSON.parse(await file.text()); if (!isBackup(parsed)) throw new Error('Invalid backup format'); setImportPreview(parsed); }
    catch { onNotify('That file is not a valid Keeper backup', 'error'); }
  };
  const saveCheckpoints = (update: SetStateAction<DataBackup[]>) => onCheckpointsChange(update);
  const createCheckpoint = () => {
    let created = false;
    saveCheckpoints(current => {
      if (current.length >= 5) return current;
      created = true;
      return [...current, { ...createBackup(), exportedAt: new Date().toISOString() }];
    });
    if (created) onNotify('Checkpoint created', 'success');
    else onNotify('You can keep up to 5 checkpoints. Delete one to create another.', 'warning');
  };
  const restoreCheckpoint = (checkpoint: DataBackup) => { onImport(checkpoint); setPreview(null); setConfirmRestore(null); onNotify('Checkpoint restored', 'success'); };

  return <div className="settings-layout">
    <aside className="settings-nav" aria-label="Settings sections">
      <div className="settings-nav-heading"><Settings size={17}/> <span>Settings</span></div>
      <button type="button" aria-current={section === 'profile' ? 'page' : undefined} className={`settings-nav-item ${section === 'profile' ? 'active' : ''}`} onClick={() => setSection('profile')}><Settings size={16}/> Profile</button>
      <button type="button" aria-current={section === 'appearance' ? 'page' : undefined} className={`settings-nav-item ${section === 'appearance' ? 'active' : ''}`} onClick={() => setSection('appearance')}><Palette size={16}/> Appearance</button>
      <button type="button" aria-current={section === 'collections' ? 'page' : undefined} className={`settings-nav-item ${section === 'collections' ? 'active' : ''}`} onClick={() => setSection('collections')}><Folder size={16}/> Collections</button>
      <button type="button" aria-current={section === 'data' ? 'page' : undefined} className={`settings-nav-item ${section === 'data' ? 'active' : ''}`} onClick={() => setSection('data')}><Database size={16}/> Data</button>
    </aside>
    <section className="settings-main">
      <header className="settings-page-heading"><div className="modal-eyebrow">{section === 'profile' ? 'YOUR ACCOUNT' : section === 'data' ? 'BACKUP & STORAGE' : 'PERSONALIZE YOUR SPACE'}</div><h2>{section === 'appearance' ? 'Appearance' : section === 'collections' ? 'Collections' : section === 'profile' ? 'Profile' : 'Data'}</h2><p>{section === 'appearance' ? 'Changes take effect when you save.' : section === 'collections' ? 'Choose a collection to personalize.' : section === 'profile' ? 'Manage your profile and account.' : 'Back up, restore, and understand your saved data.'}</p></header>
      {section === 'appearance' ? <div className="settings-content">
        <div className="settings-section"><div className="settings-title">ACCENT COLOR</div><ColorPicker label="Accent color" value={draftPreferences.accent} onChange={color => setDraftPreferences(v => { const next = { ...v, accent: color }; onAppearancePreview(next); return next; })}/></div>
        <div className="settings-section"><div className="settings-title">BACKGROUND</div><div className="settings-choice">{(['solid','gradient','image'] as const).map(mode => <button key={mode} className={draftPreferences.background === mode ? 'chosen' : ''} onClick={() => setDraftPreferences(v => { const next = { ...v, background: mode }; onAppearancePreview(next); return next; })}>{mode === 'solid' ? 'Solid' : mode === 'gradient' ? 'Blend' : 'Image'}</button>)}</div>
          {draftPreferences.background !== 'image' ? <div className="background-colors"><div><span>{draftPreferences.background === 'gradient' ? 'Color one' : 'Color'}</span><ColorPicker label={draftPreferences.background === 'gradient' ? 'First background color' : 'Background color'} value={draftPreferences.color1} onChange={color => setDraftPreferences(v => { const next = { ...v, color1: color }; onAppearancePreview(next); return next; })}/></div>{draftPreferences.background === 'gradient' && <div><span>Color two</span><ColorPicker label="Second background color" value={draftPreferences.color2} onChange={color => { const next = { ...draftPreferences, color2: color }; setDraftPreferences(next); onAppearancePreview(next); }}/></div>}</div> : <WallpaperPicker urls={draftPreferences.wallpaperUrls} selectedUrl={draftPreferences.image} onChange={wallpaperUrls => setDraftPreferences(current => { const next = { ...current, wallpaperUrls }; onAppearancePreview(next); return next; })} onSelect={url => setDraftPreferences(current => { const next = { ...current, image: url, imagePath: undefined, background: 'image' as const }; onAppearancePreview(next); return next; })} onDelete={setWallpaperToDelete}/>}
        </div>
        <div className="settings-section"><div className="settings-title">FONT</div><small className="settings-help">Preview a typeface, then select it to apply across Keeper.</small><FontSelector value={draftPreferences.font} options={FONT_OPTIONS} size={draftPreferences.size} onSizeChange={size => { const next = { ...draftPreferences, size }; setDraftPreferences(next); onAppearancePreview(next); }} onChange={font => setDraftPreferences(v => { const next = { ...v, font }; onAppearancePreview(next); return next; })}/><button type="button" className="settings-reset-button" onClick={() => setConfirmReset(true)}><RotateCcw size={14}/> Reset appearance</button></div>
      </div> : section === 'collections' ? <div className="settings-content"><div className="settings-section collection-settings">
        <div className="settings-title">COLLECTION STYLE</div>
        {collections.length ? <>
          <label className="collection-setting-label">Choose collection<select className="field settings-input" value={selectedCollection?.id ?? ''} onChange={e => setSelectedCollectionId(e.target.value)}>{collections.map(collection => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>
          {selectedCollection && <>
            <div className="collection-setting-label"><span>Collection color</span><ColorPicker label="Collection color" value={selectedStyle!.color} fallbackColor={draftPreferences.accent} allowNone onChange={color => setDraftCollectionStyles(value => ({ ...value, [selectedCollection.id]: { ...value[selectedCollection.id], color } }))}/></div>
            <details className="collection-font-dropdown"><summary>Collection Title</summary><small className="settings-help">Controls this collection’s label in the top navigation.</small><FontSelector value={selectedStyle!.nameFont ?? selectedStyle!.font ?? draftPreferences.font} options={FONT_OPTIONS} onChange={font => setDraftCollectionStyles(value => ({ ...value, [selectedCollection.id]: { ...value[selectedCollection.id], nameFont: font } }))}/><button type="button" className="text-button" onClick={() => setDraftCollectionStyles(value => ({ ...value, [selectedCollection.id]: { ...value[selectedCollection.id], nameFont: null } }))}>Use global font</button><div className="collection-setting-label"><span>Collection title size</span><small className="settings-help">Controls this collection’s name in the top navigation.</small><FontSizeSelector label="Collection title size" value={selectedStyle!.titleFontSize ?? draftPreferences.size} onChange={(titleFontSize: FontSize) => setDraftCollectionStyles(value => ({ ...value, [selectedCollection.id]: { ...value[selectedCollection.id], titleFontSize } }))}/></div></details>
            <details className="collection-font-dropdown"><summary>Website Cards</summary><small className="settings-help">Controls text on cards in this collection.</small><FontSelector value={selectedStyle!.cardFont ?? selectedStyle!.font ?? draftPreferences.font} options={FONT_OPTIONS} onChange={font => setDraftCollectionStyles(value => ({ ...value, [selectedCollection.id]: { ...value[selectedCollection.id], cardFont: font } }))}/><button type="button" className="text-button" onClick={() => setDraftCollectionStyles(value => ({ ...value, [selectedCollection.id]: { ...value[selectedCollection.id], cardFont: null } }))}>Use global font</button><FontSizeSelector label="Website card text size" value={selectedStyle!.cardFontSize ?? draftPreferences.size} onChange={(cardFontSize: FontSize) => setDraftCollectionStyles(value => ({ ...value, [selectedCollection.id]: { ...value[selectedCollection.id], cardFontSize } }))}/></details>
            <button type="button" className="settings-reset-button" onClick={() => setConfirmResetCollection(true)}><RotateCcw size={14}/> Reset collection</button>
          </>}
        </> : <p className="collection-settings-empty">Create a collection first to set its color and font.</p>}
      </div></div> : section === 'profile' ? <div className="settings-content profile-content"><div className="settings-section profile-settings">
        <label className="collection-setting-label">Display name<input className="field settings-input" autoComplete="name" placeholder="Your name" value={draftProfile.name} onChange={e => setDraftProfile(value => ({ ...value, name: e.target.value }))}/></label>
        <div className="profile-auth">
          <div className="profile-account-header">
            <div className="profile-account-copy"><strong>{isAuthenticated ? (userEmail ? maskEmail(userEmail) : 'Keeper account') : 'Optional account'}</strong><small>{isAuthenticated ? 'Signed in with Keeper account' : 'Sign in or create an account to unlock:'}</small></div>
            <div className="profile-account-actions">
              {userEmail && <button type="button" className="quiet-button email-mask-toggle" onClick={() => setDraftProfile(value => ({ ...value, hideEmail: !value.hideEmail }))} aria-label={draftProfile.hideEmail ? 'Show email address' : 'Hide email address'} aria-pressed={!!draftProfile.hideEmail} title={draftProfile.hideEmail ? 'Show email address' : 'Hide email address'}>{draftProfile.hideEmail ? <Eye size={15}/> : <EyeOff size={15}/>}</button>}
              {isAuthenticated ? <button type="button" className="primary-button profile-auth-button" onClick={onSignOut}>Sign out</button> : <button type="button" className="primary-button profile-auth-button" onClick={onSignIn}><LogIn size={15}/> Sign in / Sign up</button>}
            </div>
          </div>
          {!isAuthenticated && <ul className="profile-benefits"><li>Cloud backup for your collections, websites, and settings</li><li>Access your saved collections from any signed-in device</li><li>Automatic syncing, with sync status and a manual sync option</li></ul>}
        </div>
        <small className="settings-help">Your display name and app data are saved in this browser.</small>
        {isAuthenticated && <details className="profile-password-disclosure">
          <summary>Change password</summary>
          <form className="profile-password-form" onSubmit={changePassword}>
          <label className="collection-setting-label">Current password<input className="field settings-input" type="password" autoComplete="current-password" required maxLength={1024} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/></label>
          <label className="collection-setting-label">New password<input className="field settings-input" type="password" autoComplete="new-password" required minLength={8} maxLength={1024} value={newPassword} onChange={e => setNewPassword(e.target.value)}/></label>
          <label className="collection-setting-label">Confirm new password<input className="field settings-input" type="password" autoComplete="new-password" required minLength={8} maxLength={1024} value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)}/></label>
          <small className="settings-help">Use at least 8 characters.</small>
          {passwordMessage && <p className="profile-password-message" role="status">{passwordMessage}</p>}
            <button className="primary-button profile-auth-button" type="submit" disabled={passwordBusy || !supabase}>{passwordBusy ? 'Updating…' : 'Update password'}</button>
          </form>
        </details>}
      </div></div> : <div className="settings-content"><div className="settings-section data-settings">
        {/* Cloud Backup On/Off Feature Toggle */}
        <div className="settings-title">CLOUD BACKUP & MULTI-DEVICE SYNC</div>
        {isAuthenticated ? <>
        <div className="sync-backup-toggle-row data-backup-toggle">
          <div>
            <strong>Cloud backup</strong>
            <small className="settings-help">Master cloud option. Turn off to use local-only mode; no cloud backup or sync will be available.</small>
          </div>
          <label className="switch-toggle" aria-label="Toggle cloud backup">
            <input
              type="checkbox"
              checked={engineState.cloudBackupEnabled}
              onChange={e => syncEngine.setCloudBackupEnabled(e.target.checked)}
            />
            <span className="switch-slider" />
          </label>
        </div>
        <div className="sync-backup-toggle-row data-backup-toggle automated-sync-toggle">
          <div><strong>Automated sync</strong><small>When off, changes sync only when you click Sync Now.</small></div>
          <label className="switch-toggle" aria-label="Toggle automated sync"><input type="checkbox" checked={engineState.automatedSyncEnabled} disabled={!engineState.cloudBackupEnabled} onChange={e => { if (e.target.checked && !engineState.cloudBackupEnabled) window.dispatchEvent(new CustomEvent('keeper:toast', { detail: { message: 'Turn on Cloud backup to enable automated sync.', tone: 'warning' } })); else syncEngine.setAutomatedSyncEnabled(e.target.checked); }}/><span className="switch-slider"/></label>
        </div>
        {!engineState.cloudBackupEnabled && (
          <div className="sync-offline-banner">
            <PauseCircle size={15} />
            <span>Cloud backup is turned off. Your collections, websites, and settings are saved strictly on this device.</span>
          </div>
        )}

        {/* Sync Status & Problem Diagnostics */}
        <div className="settings-title" style={{ marginTop: 20 }}>SYNC HEALTH & DIAGNOSTICS</div>
        <div className="data-sync-card">
          <span className="data-sync-email">{userEmail ? maskEmail(userEmail) : 'Not linked to cloud account'}</span>
          <span className={`data-sync-state ${!engineState.cloudBackupEnabled ? 'offline' : engineState.status}`} role="status">
            <i/> {!engineState.cloudBackupEnabled ? 'Cloud paused' : engineState.status === 'syncing' ? 'Syncing' : engineState.status === 'synced' ? 'Up to date' : engineState.status === 'offline' ? 'Offline' : 'Sync issue'}
          </span>
        </div>

        {/* Detailed problem information */}
        {engineState.cloudBackupEnabled && (engineState.status === 'error' || engineState.status === 'offline') && (
          <div className={`sync-issue-card ${engineState.status}`}>
            <div className="sync-issue-header">
              <AlertCircle size={16} className="sync-issue-icon" />
              <strong>{engineState.errorDetails?.title || (engineState.status === 'offline' ? 'Device is offline' : 'Sync encountered an issue')}</strong>
            </div>
            <p className="sync-issue-message">
              {engineState.errorDetails?.message || 'Unable to connect to the cloud service to push pending mutations.'}
            </p>
            <div className="sync-issue-suggestion">
              <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{engineState.errorDetails?.suggestion || 'Check your internet connection or verify your account session in settings.'}</span>
            </div>
            {engineState.errorDetails?.code && (
              <div className="sync-issue-code">
                <span>Error Code: <code>{engineState.errorDetails.code}</code></span>
                {engineState.errorDetails.attempt ? (
                  <span>Retry Attempt: #{engineState.errorDetails.attempt}</span>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* Diagnostics stats */}
        <div className="sync-stats-grid">
          <div className="sync-stat-item">
            <span className="sync-stat-label">Connection</span>
            <strong className="sync-stat-value">{engineState.isOnline ? 'Online' : 'Offline'}</strong>
          </div>
          <div className="sync-stat-item">
            <span className="sync-stat-label">Last Synced</span>
            <strong className="sync-stat-value">{engineState.lastSyncedAt ? new Date(engineState.lastSyncedAt).toLocaleTimeString() : 'Never'}</strong>
          </div>
          <div className="sync-stat-item">
            <span className="sync-stat-label">Local Outbox</span>
            <strong className="sync-stat-value">{engineState.pendingCount === 0 ? '0 pending' : `${engineState.pendingCount} queued`}</strong>
          </div>
          <div className="sync-stat-item">
            <span className="sync-stat-label">Device ID</span>
            <strong className="sync-stat-value" title={engineState.deviceId}>{engineState.deviceId.slice(0, 10)}…</strong>
          </div>
        </div>

        <div className="data-actions" style={{ marginTop: 12, marginBottom: 20 }}>
          <button
            type="button"
            className="primary-button"
            disabled={!engineState.cloudBackupEnabled || engineState.status === 'syncing'}
            onClick={() => void syncEngine.sync()}
          >
            <RotateCcw size={14} className={engineState.status === 'syncing' ? 'spin-icon' : ''} />
            {engineState.status === 'syncing' ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
        </> : <>
          <div className="sync-offline-banner"><PauseCircle size={15}/><span>Sign in before using cloud backup or syncing Keeper across devices.</span></div>
          <div className="data-actions"><button type="button" className="primary-button" onClick={onSignIn}><LogIn size={15}/> Sign in to use cloud sync</button></div>
        </>}

        <div className="checkpoint-heading"><div><div className="settings-title">CHECKPOINTS</div><p>Save and restore snapshots of your collections and settings.</p></div><span className="checkpoint-count">{checkpoints.length} / 5</span></div><div className="data-actions"><button className="primary-button" onClick={createCheckpoint} disabled={checkpoints.length >= 5}><Database size={15}/> {checkpoints.length >= 5 ? 'Checkpoint limit reached' : 'Create checkpoint'}</button></div>{checkpoints.length > 0 ? <ul className="checkpoint-list">{checkpoints.map(checkpoint => <li key={checkpoint.exportedAt}><time dateTime={checkpoint.exportedAt}>{new Date(checkpoint.exportedAt).toLocaleString()}</time><div><button className="text-button" onClick={() => setPreview(checkpoint)}><Eye size={14}/> Preview</button><button className="text-button" onClick={() => setPreview(checkpoint)}><RotateCcw size={14}/> Restore</button><button className="text-button danger-text" aria-label="Delete checkpoint" onClick={() => setConfirmDeleteCheckpoint(checkpoint)}><Trash2 size={14}/></button></div></li>)}</ul> : <p className="checkpoint-empty">No checkpoints yet. Create one to keep a restore point.</p>}<div className="settings-title checkpoint-title">BACKUP FILE</div><p>Export your data or restore a Keeper JSON backup.</p><div className="data-size">Approximate backup size <strong>{(new Blob([JSON.stringify(createBackup())]).size / 1024).toFixed(1)} KB</strong></div><div className="data-actions"><button className="primary-button" onClick={exportData}><Download size={15}/> Export backup</button><label className="upload-button"><FileUp size={15}/> Import backup<input type="file" accept="application/json,.json" onChange={e => { void importData(e.target.files?.[0]); e.currentTarget.value = ''; }}/></label></div><small className="settings-help">Importing replaces your current collections, appearance, and profile. Only Keeper JSON backups are accepted (up to 10 MB).</small><div className="local-wipe-section"><div className="settings-title">DELETE ALL DATA</div><p>This permanently removes Keeper data from this browser{isAuthenticated ? ' and your account' : ''}.</p><button className="confirm-delete-button" onClick={() => setConfirmWipeLocal(true)}><Trash2 size={15}/> Delete all data</button></div></div></div>}
      {isDirty && <div className="settings-actions"><button className="cancel-button" onClick={discardChanges}>Discard changes</button><button className="primary-button" onClick={saveChanges}>Save <Check size={15}/></button></div>}
    </section>
      {confirmReset && <div className="overlay confirm-overlay" onMouseDown={event => event.target === event.currentTarget && setConfirmReset(false)}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description"><span className="confirm-icon"><RotateCcw size={19}/></span><div className="modal-eyebrow">RESET APPEARANCE</div><h2 id="reset-title">Restore default appearance?</h2><p id="reset-description">Your current colors, background, font, and UI size will be replaced with the defaults.</p><div className="modal-actions"><button className="cancel-button" onClick={() => setConfirmReset(false)}>Cancel</button><button className="confirm-delete-button" onClick={() => { setDraftPreferences(defaultPreferences); onAppearancePreview(defaultPreferences); setConfirmReset(false); }}><RotateCcw size={15}/> Reset appearance</button></div></section></div>}
      {confirmResetCollection && selectedCollection && <div className="overlay confirm-overlay" onMouseDown={event => event.target === event.currentTarget && setConfirmResetCollection(false)}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reset-collection-title" aria-describedby="reset-collection-description"><span className="confirm-icon"><RotateCcw size={19}/></span><div className="modal-eyebrow">RESET COLLECTION</div><h2 id="reset-collection-title">Reset “{selectedCollection.name}”?</h2><p id="reset-collection-description">This collection’s font, sizes, and color will be set to the current Appearance values.</p><div className="modal-actions"><button className="cancel-button" onClick={() => setConfirmResetCollection(false)}>Cancel</button><button className="confirm-delete-button" onClick={() => { setDraftCollectionStyles(value => ({ ...value, [selectedCollection.id]: { ...value[selectedCollection.id], color: draftPreferences.accent, font: draftPreferences.font, nameFont: draftPreferences.font, titleFontSize: draftPreferences.size, cardFont: draftPreferences.font, cardFontSize: draftPreferences.size } })); setConfirmResetCollection(false); }}><RotateCcw size={15}/> Reset collection</button></div></section></div>}
      {confirmWipeLocal && <div className="overlay confirm-overlay" onMouseDown={event => event.target === event.currentTarget && !wiping && setConfirmWipeLocal(false)}><section className="confirm-dialog local-wipe-dialog" role="alertdialog" aria-modal="true" aria-labelledby="wipe-title" aria-describedby="wipe-description"><span className="confirm-icon"><Trash2 size={22}/></span><div className="modal-eyebrow">PERMANENT DATA DELETION</div><h2 id="wipe-title">Delete all Keeper data?</h2><p id="wipe-description"><strong>This permanently deletes your collections, websites, profile details, appearance settings, dashboard widgets, and layout position from this browser{isAuthenticated ? ' and your signed-in cloud account' : ''}.</strong> The only data kept will be saved checkpoints, which you can use to restore a backup. If you have no checkpoint, your deleted data cannot be recovered.</p><p className="wipe-cloud-warning">This action cannot be undone. Export a backup or create a checkpoint before continuing if you may need this data.</p><div className="modal-actions"><button className="cancel-button" disabled={wiping} onClick={() => setConfirmWipeLocal(false)}>Keep my data</button><button className="confirm-delete-button" disabled={wiping} onClick={async () => { setWiping(true); await onWipeLocalData(); setWiping(false); }}><Trash2 size={15}/> {wiping ? 'Deleting…' : 'Delete all data'}</button></div></section></div>}
    {preview && <div className="overlay confirm-overlay" onMouseDown={event => event.target === event.currentTarget && setPreview(null)}><section className="confirm-dialog checkpoint-preview" role="dialog" aria-modal="true" aria-labelledby="checkpoint-preview-title"><div className="modal-eyebrow">CHECKPOINT PREVIEW · {new Date(preview.exportedAt).toLocaleString()}</div><h2 id="checkpoint-preview-title">{preview.collections.length} collections</h2><ul>{preview.collections.map(collection => <li key={collection.id}><strong>{collection.name}</strong><span>{collection.sites.length} websites</span></li>)}</ul><p>This is a temporary preview. Your current data has not changed.</p><div className="modal-actions"><button className="cancel-button" onClick={() => setPreview(null)}>Close preview</button><button className="primary-button" onClick={() => setConfirmRestore(preview)}><RotateCcw size={15}/> Restore checkpoint</button></div></section></div>}
    {confirmRestore && <div className="overlay confirm-overlay" onMouseDown={event => event.target === event.currentTarget && setConfirmRestore(null)}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="restore-checkpoint-title" aria-describedby="restore-checkpoint-description"><span className="confirm-icon"><RotateCcw size={19}/></span><div className="modal-eyebrow">RESTORE CHECKPOINT</div><h2 id="restore-checkpoint-title">Restore this checkpoint?</h2><p id="restore-checkpoint-description">This will replace your current collections, appearance, and profile with the saved checkpoint.</p><div className="modal-actions"><button className="cancel-button" onClick={() => setConfirmRestore(null)}>Cancel</button><button className="primary-button" onClick={() => restoreCheckpoint(confirmRestore)}><RotateCcw size={15}/> Restore checkpoint</button></div></section></div>}
    {confirmDeleteCheckpoint && <div className="overlay confirm-overlay" onMouseDown={event => event.target === event.currentTarget && setConfirmDeleteCheckpoint(null)}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-checkpoint-title" aria-describedby="delete-checkpoint-description"><span className="confirm-icon"><Trash2 size={19}/></span><div className="modal-eyebrow">DELETE CHECKPOINT</div><h2 id="delete-checkpoint-title">Delete this checkpoint?</h2><p id="delete-checkpoint-description">This permanently removes the saved checkpoint. You cannot restore it after deletion.</p><div className="modal-actions"><button className="cancel-button" onClick={() => setConfirmDeleteCheckpoint(null)}>Cancel</button><button className="confirm-delete-button" onClick={() => { saveCheckpoints(current => current.filter(item => item !== confirmDeleteCheckpoint)); setConfirmDeleteCheckpoint(null); }}><Trash2 size={15}/> Delete checkpoint</button></div></section></div>}
    {wallpaperToDelete && <div className="overlay confirm-overlay" onMouseDown={event => event.target === event.currentTarget && setWallpaperToDelete(null)}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-wallpaper-title" aria-describedby="delete-wallpaper-description"><span className="confirm-icon"><Trash2 size={19}/></span><div className="modal-eyebrow">DELETE WALLPAPER</div><h2 id="delete-wallpaper-title">Delete this preview?</h2><p id="delete-wallpaper-description">This removes the URL from your saved wallpaper gallery.</p><div className="modal-actions"><button className="cancel-button" onClick={() => setWallpaperToDelete(null)}>Cancel</button><button className="confirm-delete-button" onClick={() => { setDraftPreferences(current => { const next = { ...current, wallpaperUrls: current.wallpaperUrls.filter(url => url !== wallpaperToDelete), ...(current.image === wallpaperToDelete ? { image: '', imagePath: undefined } : {}) }; onAppearancePreview(next); return next; }); setWallpaperToDelete(null); }}><Trash2 size={15}/> Delete preview</button></div></section></div>}
    {importPreview && <div className="overlay confirm-overlay" onMouseDown={event => event.target === event.currentTarget && setImportPreview(null)}><section className="confirm-dialog checkpoint-preview import-preview" role="alertdialog" aria-modal="true" aria-labelledby="import-preview-title" aria-describedby="import-preview-description"><div className="modal-eyebrow">BACKUP PREVIEW · {new Date(importPreview.exportedAt).toLocaleString()}</div><h2 id="import-preview-title">Import this backup?</h2><p id="import-preview-description">This will replace your current collections, appearance, and profile. Review the contents before confirming.</p><div className="import-preview-summary"><strong>{importPreview.collections.length} collections</strong><span>{importPreview.collections.reduce((total, collection) => total + collection.sites.length, 0)} websites · {(importPreview.widgets ?? []).length} dashboard widgets</span></div><ul>{importPreview.collections.map(collection => <li key={collection.id}><strong>{collection.name}</strong><span>{collection.sites.length} websites</span></li>)}</ul><div className="modal-actions"><button className="cancel-button" onClick={() => setImportPreview(null)}>Cancel</button><button className="primary-button" onClick={() => { onImport(importPreview); setImportPreview(null); }}><Check size={15}/> Confirm import</button></div></section></div>}
  </div>;
}




