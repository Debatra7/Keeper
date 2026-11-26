
import { ArrowUpRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type AuthMode = 'login' | 'signup' | 'reset' | 'recovery' | 'sent';

import { ToastStack, Toast } from '../../components/ToastStack';

export function AuthScreen({

  onAuthenticated,
  recovery = false,
}: {
  onAuthenticated?: () => void;
  recovery?: boolean;
}) {
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
      setMessage('Passwords do not match.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}${window.location.pathname}`,
        });
        if (error) setMessage('Could not send the reset email right now. Please try again.');
        else setMode('sent');
      } else if (mode === 'recovery') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error)
          setMessage('Could not update the password. Request a new reset link and try again.');
        else {
          setMessage('Your password has been updated.');
          onAuthenticated?.();
        }
      } else {
        const result =
          mode === 'login'
            ? await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
              })
            : await supabase.auth.signUp({ email: email.trim(), password });
        if (result.error)
          setMessage('Unable to authenticate with those details. Check them and try again.');
        else if (mode === 'signup' && !result.data.session)
          setMessage('Check your email to confirm your account, then sign in.');
        else if (result.data.session) onAuthenticated?.();
      }
    } catch {
      setMessage('Could not reach the authentication service. Please try again.');
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
                    onClick={() => setShowPassword((value) => !value)}
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
                        onClick={() => setShowPassword((value) => !value)}
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
                  : mode === 'recovery'
                    ? 'Update password'
                    : mode === 'login'
                      ? 'Sign in'
                      : 'Create account'}{' '}
              <ArrowUpRight size={15} />
            </button>
            {!supabase && (
              <p className="auth-message" role="alert">
                Authentication is not configured. Add the Supabase environment variables to
                continue.
              </p>
            )}
            {mode === 'login' && (
              <button
                className="auth-switch"
                type="button"
                onClick={() => {
                  setMode('reset');
                  setMessage('');
                }}
              >
                Forgot password?
              </button>
            )}
            {(mode === 'login' || mode === 'signup') && (
              <button
                className="auth-switch"
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setMessage('');
                }}
              >
                {mode === 'login'
                  ? 'New to Keeper? Create an account'
                  : 'Already have an account? Sign in'}
              </button>
            )}
            {(mode === 'reset' || mode === 'recovery') && (
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
            )}
          </form>
        )}
      </section>
    </main>
  );
}
