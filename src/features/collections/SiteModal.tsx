import { Link2, ArrowUpRight } from 'lucide-react';

interface SiteModalProps {
  isEditing: boolean;
  collectionName?: string;
  siteName: string;
  siteUrl: string;
  onNameChange: (name: string) => void;
  onUrlChange: (url: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function SiteModal({
  isEditing,
  collectionName,
  siteName,
  siteUrl,
  onNameChange,
  onUrlChange,
  onSave,
  onCancel,
}: SiteModalProps) {
  return (
    <>
      <span className="modal-icon">
        <Link2 size={20} />
      </span>
      <div className="modal-eyebrow">
        {isEditing ? 'TIDY UP YOUR COLLECTION' : `ADD TO ${(collectionName ?? '').toUpperCase()}`}
      </div>
      <h2>{isEditing ? 'Edit website' : 'Save a website'}</h2>
      <p>A shortcut to somewhere you love.</p>
      <label className="field-label">DISPLAY NAME</label>
      <input
        className="field"
        autoFocus
        placeholder="e.g. Are.na"
        value={siteName}
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSave()}
      />
      <label className="field-label">WEBSITE ADDRESS</label>
      <input
        className="field"
        placeholder="e.g. are.na"
        value={siteUrl}
        onChange={(e) => onUrlChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSave()}
      />
      <div className="modal-actions">
        <button className="cancel-button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-button" onClick={onSave}>
          {isEditing ? 'Save changes' : 'Save website'} <ArrowUpRight size={15} />
        </button>
      </div>
    </>
  );
}
