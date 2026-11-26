import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Toast } from '../../components/ToastStack';
import { ToastStack } from '../../components/ToastStack';

type AuthMode = 'login' | 'signup' | 'reset' | 'recovery' | 'sent';

export function AuthScreen({
  onAuthenticated,
  recovery = false,
}: {
  onAuthenticated?: () => void;
  recovery?: boolean;
}) {
  // Toast handling
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (message: string, tone: Toast['tone']) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, tone }]);
  };
  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const [mode, setMode] = useState<AuthMode>(recovery ? 'recovery' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || busy) return;
    if (mode === 'recovery' && password !== confirmPassword) {
      const msg = 'Passwords do not match.';
      setMessage(msg);
      addToast(msg, 'error');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}${window.location.pathname}`,
        });
        if (error) {
          const msg = 'Could not send the reset email right now. Please try again.';
          setMessage(msg);
          addToast(msg, 'error');
        } else {
          setMode('sent');
          addToast('Reset email sent.', 'success');
        }
      } else if (mode === 'recovery') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          const msg = 'Could not update the password. Request a new reset link and try again.';
          setMessage(msg);
          addToast(msg, 'error');
        } else {
          const msg = 'Your password has been updated.';
          setMessage(msg);
          addToast(msg, 'success');
          onAuthenticated?.();
        }
      } else {
        const result =
          mode === 'login'
            ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
            : await supabase.auth.signUp({ email: email.trim(), password });
        if (result.error) {
          const msg = 'Unable to authenticate with those details. Check them and try again.';
          setMessage(msg);
          addToast(msg, 'error');
        } else if (mode === 'signup' && !result.data.session) {
          const msg = 'Check your email to confirm your account, then sign in.';
          setMessage(msg);
          addToast(msg, 'warning');
        } else if (result.data.session) {
          addToast('Successfully signed in.', 'success');
          onAuthenticated?.();
        }
      }
    } catch {
      const msg = 'Could not reach the authentication service. Please try again.';
      setMessage(msg);
      addToast(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === 'recovery'
      ? 'Choose a new password'
      : mode === 'reset'
        ? 'Reset your password'
        : mode === 'sent'
          ? 'Check your inbox'
          : mode === 'login'
            ? 'Welcome back'
            : 'Create your account';

  const description =
    mode === 'recovery'
      ? 'Use at least 8 characters for your new password.'
      : mode === 'reset'
        ? 'We’ll email a secure link if an account exists for that address.'
        : mode === 'sent'
          ? 'If an account exists for that email, a reset link is on its way.'
          : mode === 'login'
            ? 'Sign in to continue to Keeper.'
            : 'Create an account for Keeper.';

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <span className="auth-mark">
          <LockKeyhole size={19} />
        </span>
        <div className="modal-eyebrow">YOUR QUIET CORNER</div>
        <h1 id="auth-title">{title}</h1>
        <p>{description}</p>
        {mode === 'sent' ? (
          <button
            className="auth-switch"
            type="button"
            onClick={() => {
              setMode('login');
              setMessage('');
            }}
          >
            Return to sign in
          </button>
        ) : (
          <form onSubmit={submit}>
            {mode !== 'recovery' && (
              <>
                <label className="field-label" htmlFor="auth-email">
                  EMAIL
                </label>
                <input
                  id="auth-email"
                  className="field"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </>
            )}
            {mode !== 'reset' && (
              <>
                <label className="field-label" htmlFor="auth-password">
                  {mode === 'recovery' ? 'NEW PASSWORD' : 'PASSWORD'}
                </label>
                <div className="auth-field-wrap">
                  <input
                    id="auth-password"
                    className="field"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={mode === 'login' ? 1 : 8}
                    maxLength={1024}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className="auth-field-toggle"
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {mode === 'recovery' && (
                  <>
                    <label className="field-label" htmlFor="auth-confirm-password">
                      CONFIRM PASSWORD
                    </label>
                    <div className="auth-field-wrap">
                      <input
                        id="auth-confirm-password"
                        className="field"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={1024}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <button
                        className="auth-field-toggle"
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </>
                )}
                {mode === 'signup' && (
                  <small className="auth-hint">Use at least 8 characters.</small>
                )}
              </>
            )}
            {message && (
              <p className="auth-message" role="status">
                {message}
              </p>
            )}
            <button
              className="primary-button auth-submit"
              type="submit"
              disabled={busy || !supabase}
            >
              {busy
                ? 'Please wait…'
                : mode === 'reset'
                  ? 'Send reset link'
                  : mode === 'signup'
                    ? 'Create account'
                    : 'Sign in'}
            </button>
          </form>
        )}
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </section>
    </main>
  );
}
