import { useState, useRef, type FormEvent, type KeyboardEvent, type ClipboardEvent } from 'react';
import { LockKeyhole, ShieldAlert, ArrowLeft, KeyRound } from 'lucide-react';
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

interface AdminAuthProps {
  onSuccess: () => void;
  onExit: () => void;
}

export function AdminAuth({ onSuccess, onExit }: AdminAuthProps) {
  const [keyInput, setKeyInput] = useState('');
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);

  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handlePinChange = (index: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1);
    const next = [...pinDigits];
    next[index] = char;
    setPinDigits(next);
    if (error) setError(null);

    if (char && index < 3) {
      pinRefs[index + 1].current?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
  };

  const handlePinPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;
    const next = ['', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setPinDigits(next);
    if (error) setError(null);
    const targetIdx = Math.min(pasted.length, 3);
    pinRefs[targetIdx].current?.focus();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Retrieve credentials from environment variables (no fallback defaults)
    const configuredKey = import.meta.env.VITE_ADMIN_KEY;
    const configuredPin = import.meta.env.VITE_ADMIN_PIN;
    const enteredPin = pinDigits.join('');

    const keyMatches = keyInput.trim() === configuredKey.trim();
    const pinMatches = enteredPin.trim() === configuredPin.trim();

    if (keyMatches && pinMatches) {
      sessionStorage.setItem('keeper_dev_admin_authenticated', 'true');
      setError(null);
      onSuccess();
    } else if (!keyMatches && !pinMatches) {
      setError('Both the developer admin key and 4-digit PIN are incorrect.');
    } else if (!keyMatches) {
      setError('Invalid developer admin key.');
    } else {
      setError('Invalid 4-digit security PIN.');
    }
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
            Protected developer access. Enter your admin key and 4-digit security PIN configured in
            the environment.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-3">
            {/* Developer Secret Key */}
            <div className="space-y-2">
              <label className="text-xs font-semibold tracking-wider text-neutral-300 uppercase">
                Developer Admin Key
              </label>
              <Input
                type="password"
                placeholder="Enter secret key..."
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  if (error) setError(null);
                }}
                autoFocus
                className="bg-neutral-950 border-neutral-700 text-neutral-100 focus-visible:ring-indigo-500"
              />
            </div>

            {/* 4-Digit Security PIN */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold tracking-wider text-neutral-300 uppercase flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> 4-Digit Security PIN
                </label>
              </div>
              <div className="flex justify-between gap-2.5">
                {pinDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={pinRefs[idx]}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(idx, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(idx, e)}
                    onPaste={handlePinPaste}
                    className="w-full h-12 text-center text-xl font-bold rounded-lg border border-neutral-700 bg-neutral-950 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                ))}
              </div>
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
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium h-10"
            >
              Verify Credentials & Access
            </Button>
            <p className="text-[11px] text-neutral-500 text-center">
              Requires both valid environment credentials for admin access.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
