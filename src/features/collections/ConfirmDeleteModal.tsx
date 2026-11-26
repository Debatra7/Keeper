import { TriangleAlert, X } from 'lucide-react';
import type { Collection } from '../../components/types';

interface ConfirmDeleteModalProps {
  collection: Collection;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteModal({ collection, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  return (
    <div
      className="overlay confirm-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
      >
        <span className="confirm-icon">
          <TriangleAlert size={19} />
        </span>
        <div className="modal-eyebrow">DELETE COLLECTION</div>
        <h2 id="confirm-title">Are you sure?</h2>
        <p id="confirm-description">
          Delete “{collection.name}” and its saved websites? This can’t be undone.
        </p>
        <div className="modal-actions">
          <button className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="confirm-delete-button" onClick={onConfirm}>
            <X size={15} /> Delete collection
          </button>
        </div>
      </section>
    </div>
  );
}
