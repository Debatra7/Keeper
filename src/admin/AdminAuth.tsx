import { useState, type FormEvent } from 'react';
import { LockKeyhole, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './components/ui/card';
import { verifyAdminKey } from '../lib/adminAuth';

interface AdminAuthProps {
  onSuccess: () => void;
  onExit: () => void;
}

export function AdminAuth({ onSuccess, onExit }: AdminAuthProps) {
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await verifyAdminKey(keyInput.trim());

    if (result.ok) {
      onSuccess();
    } else {
      setError(result.error);
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
      <div className="absolute top-6 left-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="text-neutral-400 hover:text-neutral-100"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Keeper
        </Button>
      </div>

      <Card className="w-full max-w-md border-neutral-800 bg-neutral-900/90 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-2 border border-indigo-500/20">
            <LockKeyhole className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Developer Dashboard</CardTitle>
          <CardDescription className="text-neutral-400">
            Protected developer access. Your key is verified server-side and never stored in the
            app.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold tracking-wider text-neutral-300 uppercase">
                Developer Admin Key
              </label>
              <Input
                type="password"
                placeholder="Enter admin key…"
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  if (error) setError(null);
                }}
                autoFocus
                autoComplete="current-password"
                disabled={busy}
                className="bg-neutral-950 border-neutral-700 text-neutral-100 focus-visible:ring-indigo-500"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium h-10"
            >
              {busy ? 'Verifying…' : 'Verify & Access Dashboard'}
            </Button>
            <p className="text-[11px] text-neutral-500 text-center">
              Key is validated server-side — it is never exposed in the browser.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
