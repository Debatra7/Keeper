import { FolderPlus, ArrowUpRight } from 'lucide-react';
import { ColorPicker } from '../../components/ColorPicker';

interface CollectionModalProps {
  isEditing: boolean;
  collectionName: string;
  collectionColor: string;
  defaultAccent: string;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function CollectionModal({
  isEditing,
  collectionName,
  collectionColor,
  defaultAccent,
  onNameChange,
  onColorChange,
  onSave,
  onCancel,
}: CollectionModalProps) {
  return (
    <>
      <span className="modal-icon">
        <FolderPlus size={20} />
      </span>
      <div className="modal-eyebrow">{isEditing ? 'UPDATE COLLECTION' : 'A NEW LITTLE CORNER'}</div>
      <h2>{isEditing ? 'Rename collection' : 'Create a collection'}</h2>
      <p>
        {isEditing
          ? 'Choose a name that feels right.'
          : 'Give your favorite places a place of their own.'}
      </p>
      <label className="field-label">COLLECTION NAME</label>
      <input
        className="field"
        autoFocus
        placeholder="e.g. Weekend reading"
        value={collectionName}
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSave()}
      />
      <label className="field-label">COLLECTION COLOR</label>
      <ColorPicker
        label="Collection color"
        value={collectionColor}
        fallbackColor={defaultAccent}
        allowNone
        onChange={onColorChange}
      />
      <div className="modal-actions">
        <button className="cancel-button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-button" onClick={onSave}>
          {isEditing ? 'Save changes' : 'Create collection'} <ArrowUpRight size={15} />
        </button>
      </div>
    </>
  );
}
