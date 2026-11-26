import { ArrowUpRight, FolderPlus, Link2, Search, Settings, X } from 'lucide-react';

interface OnboardingModalProps {
  onDismiss: () => void;
}

export function OnboardingModal({ onDismiss }: OnboardingModalProps) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onDismiss()}>
      <section
        className="modal onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <button className="modal-close" onClick={onDismiss} aria-label="Close">
          <X size={17} />
        </button>
        <div className="modal-eyebrow">WELCOME TO KEEPER</div>
        <h2 id="onboarding-title">Your favorite places, all in one spot.</h2>
        <p>Make a personal dashboard for the websites you visit most.</p>
        <ul className="onboarding-features">
          <li>
            <FolderPlus size={17} />
            <span>
              <strong>Collections</strong>Group websites by work, interests, or anything you like.
            </span>
          </li>
          <li>
            <Link2 size={17} />
            <span>
              <strong>Website shortcuts</strong>Save a name and address, then open it from your
              collection.
            </span>
          </li>
          <li>
            <Search size={17} />
            <span>
              <strong>Quick search</strong>Find saved websites or search the web from the home
              screen.
            </span>
          </li>
          <li>
            <Settings size={17} />
            <span>
              <strong>Make it yours</strong>Adjust the look, add clock or calendar widgets, and back
              up your data in settings.
            </span>
          </li>
        </ul>
        <div className="modal-actions">
          <button className="primary-button" onClick={onDismiss}>
            Get started <ArrowUpRight size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}
