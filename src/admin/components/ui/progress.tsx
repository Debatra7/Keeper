import * as React from 'react';
import { cn } from '../../lib/utils';

export function Progress({
  value = 0,
  max = 100,
  className,
  indicatorClassName,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  value?: number;
  max?: number;
  indicatorClassName?: string;
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-neutral-800/80',
        className
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      {...props}
    >
      <div
        className={cn(
          'h-full bg-indigo-500 transition-all duration-500 ease-out rounded-full',
          indicatorClassName
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
