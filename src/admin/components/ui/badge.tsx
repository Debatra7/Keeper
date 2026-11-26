import * as React from 'react';
import { cn } from '../../lib/utils';

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}) {
  const variants = {
    default: 'border-transparent bg-indigo-600/20 text-indigo-300 border border-indigo-500/30',
    secondary: 'border-transparent bg-neutral-800 text-neutral-300',
    destructive: 'border-transparent bg-red-900/40 text-red-300 border border-red-500/30',
    outline: 'text-neutral-300 border border-neutral-700',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
