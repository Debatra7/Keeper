import { useState, useEffect, useRef } from 'react';
import {
  Check,
  RefreshCw,
  AlertCircle,
  PauseCircle,
  Wifi,
  WifiOff,
  Cloud,
  Info,
  Layers,
  X,
  Clock,
  Laptop,
} from 'lucide-react';
import { syncEngine } from '../lib/sync';
import type { SyncEngineState } from '../lib/sync';

export function SyncStatusBadge({
  className = '',
  onOpenSettings,
}: {
  className?: string;
  onOpenSettings?: () => void;
}) {
  const [syncState, setSyncState] = useState<SyncEngineState>(() => syncEngine.getState());
  const [isRotating, setIsRotating] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return syncEngine.subscribe(next => {
      setSyncState(next);
      if (next.status === 'syncing') {
        setIsRotating(true);
      } else {
        const timer = setTimeout(() => setIsRotating(false), 500);
        return () => clearTimeout(timer);
      }
    });
  }, []);

  // Close popover on click outside
  useEffect(() => {
    if (!popoverOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setPopoverOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [popoverOpen]);

  const handleToggleBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    syncEngine.setCloudBackupEnabled(e.target.checked);
  };

  const handleManualSync = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRotating(true);
    void syncEngine.sync();
  };

  const getLabel = () => {
    if (!syncState.cloudBackupEnabled) {
      return syncState.pendingCount > 0
        ? `Cloud paused (${syncState.pendingCount} local)`
        : 'Cloud backup paused';
    }
    switch (syncState.status) {
      case 'syncing':
        return 'Syncing…';
      case 'offline':
        return syncState.pendingCount > 0
          ? `Offline (${syncState.pendingCount} pending)`
          : 'Offline';
      case 'error':
        return 'Sync issue · View info';
      case 'paused':
        return 'Cloud paused';
      case 'synced':
      default:
        return syncState.pendingCount > 0
          ? `${syncState.pendingCount} pending`
          : 'All changes saved';
    }
  };

  const getNavIcon = () => {
    if (!syncState.cloudBackupEnabled) return <PauseCircle size={15} />;
    if (syncState.status === 'syncing') return <RefreshCw size={15} className={isRotating ? 'spin-icon' : ''} />;
    if (syncState.status === 'offline') return <WifiOff size={15} />;
    if (syncState.status === 'error') return <AlertCircle size={15} />;
    if (syncState.status === 'paused') return <PauseCircle size={15} />;
    if (syncState.pendingCount > 0) return <Clock size={15} />;
    return <Check size={15} />;
  };

  const getStatusClass = () => {
    if (!syncState.cloudBackupEnabled) return 'paused';
    if (syncState.status === 'offline' || syncState.status === 'error') return syncState.status;
    if (syncState.status === 'syncing') return 'syncing';
    if (syncState.pendingCount > 0) return 'pending';
    return 'synced';
  };

  const formatLastSync = (iso: string | null) => {
    if (!iso) return 'Never';
    const date = new Date(iso);
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec} seconds ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="sync-badge-container">
      <button
        ref={triggerRef}
        type="button"
        className={`sync-status-badge sync-nav-trigger ${getStatusClass()} ${className}`}
        onClick={() => setPopoverOpen(open => !open)}
        aria-expanded={popoverOpen}
        aria-label={getLabel()}
        title={`${getLabel()} · Click for sync details`}
      >
        <span className="sync-badge-icon">{getNavIcon()}</span>
      </button>

      {popoverOpen && (
        <div
          ref={popoverRef}
          className="sync-diagnostics-popover"
          role="dialog"
          aria-label="Sync details and status"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sync-popover-header">
            <div className="sync-popover-title">
              <Cloud size={16} />
              <span>Sync & Backup Status</span>
            </div>
            <button
              type="button"
              className="sync-popover-close"
              onClick={() => setPopoverOpen(false)}
              aria-label="Close sync details"
            >
              <X size={14} />
            </button>
          </div>

          {/* Cloud Backup Toggle */}
          <div className="sync-backup-toggle-row">
            <div>
              <strong>Cloud backup</strong>
              <small>Required for any cloud backup. Off keeps all data local to this device.</small>
            </div>
            <label className="switch-toggle" aria-label="Toggle cloud backup">
              <input
                type="checkbox"
                checked={syncState.cloudBackupEnabled}
                onChange={handleToggleBackup}
              />
              <span className="switch-slider" />
            </label>
          </div>

          <div className={`sync-backup-toggle-row automated-sync-toggle ${!syncState.cloudBackupEnabled ? 'disabled' : ''}`}>
            <div><strong>Automated sync</strong><small>{syncState.automatedSyncEnabled ? 'Changes sync automatically when online.' : 'Sync only runs when you select Sync Now.'}</small></div>
            <label className="switch-toggle" aria-label="Toggle automated sync">
              <input type="checkbox" checked={syncState.automatedSyncEnabled} disabled={!syncState.cloudBackupEnabled} onChange={e => { if (e.target.checked && !syncState.cloudBackupEnabled) window.dispatchEvent(new CustomEvent('keeper:toast', { detail: { message: 'Turn on Cloud backup to enable automated sync.', tone: 'warning' } })); else syncEngine.setAutomatedSyncEnabled(e.target.checked); }} />
              <span className="switch-slider" />
            </label>
          </div>

          {/* Problem Diagnostics Alert Box */}
          {syncState.cloudBackupEnabled && (syncState.status === 'error' || syncState.status === 'offline') && (
            <div className={`sync-issue-card ${syncState.status}`}>
              <div className="sync-issue-header">
                <AlertCircle size={16} className="sync-issue-icon" />
                <strong>{syncState.errorDetails?.title || (syncState.status === 'offline' ? 'Device is offline' : 'Sync encountered an issue')}</strong>
              </div>
              <p className="sync-issue-message">
                {syncState.errorDetails?.message || 'Unable to connect to the cloud service to push pending mutations.'}
              </p>
              <div className="sync-issue-suggestion">
                <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{syncState.errorDetails?.suggestion || 'Check your internet connection or verify your account session in settings.'}</span>
              </div>
              {syncState.errorDetails?.code && (
                <div className="sync-issue-code">
                  <span>Error Code: <code>{syncState.errorDetails.code}</code></span>
                  {syncState.errorDetails.attempt ? (
                    <span>Attempt: #{syncState.errorDetails.attempt}</span>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Current Status Stats Grid */}
          <div className="sync-stats-grid">
            <div className="sync-stat-item">
              <span className="sync-stat-label">
                {syncState.isOnline ? <Wifi size={13} className="text-success" /> : <WifiOff size={13} className="text-warning" />}
                Connection
              </span>
              <strong className="sync-stat-value">
                {syncState.isOnline ? 'Online' : 'Offline'}
              </strong>
            </div>

            <div className="sync-stat-item">
              <span className="sync-stat-label">
                <Clock size={13} /> Last Synced
              </span>
              <strong className="sync-stat-value" title={syncState.lastSyncedAt ?? 'None'}>
                {formatLastSync(syncState.lastSyncedAt)}
              </strong>
            </div>

            <div className="sync-stat-item">
              <span className="sync-stat-label">
                <Layers size={13} /> Local Outbox
              </span>
              <strong className="sync-stat-value">
                {syncState.pendingCount === 0 ? 'Up to date' : `${syncState.pendingCount} queued`}
              </strong>
            </div>

            <div className="sync-stat-item">
              <span className="sync-stat-label">
                <Laptop size={13} /> Device ID
              </span>
              <strong className="sync-stat-value" title={syncState.deviceId}>
                {syncState.deviceId.slice(0, 10)}…
              </strong>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="sync-popover-actions">
            {onOpenSettings && (
              <button
                type="button"
                className="quiet-button sync-popover-settings-btn"
                onClick={() => {
                  setPopoverOpen(false);
                  onOpenSettings();
                }}
              >
                Sync Settings
              </button>
            )}
            <button
              type="button"
              className="primary-button sync-popover-now-btn"
              disabled={isRotating || !syncState.cloudBackupEnabled}
              onClick={handleManualSync}
            >
              <RefreshCw size={13} className={isRotating ? 'spin-icon' : ''} />
              {isRotating ? 'Syncing…' : 'Sync Now'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
