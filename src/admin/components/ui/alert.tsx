import * as React from 'react';
import { cn } from '../../lib/utils';

export function Alert({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'destructive' | 'success';
}) {
  const variants = {
    default: 'bg-neutral-900/60 border-neutral-800 text-neutral-200',
    destructive: 'bg-red-950/40 border-red-800/60 text-red-300 [&>svg]:text-red-400',
    success: 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300 [&>svg]:text-emerald-400',
  };

  return (
    <div
      role="alert"
      className={cn(
        'relative w-full rounded-xl border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn('mb-1 font-semibold leading-none tracking-tight text-sm', className)}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div className={cn('text-xs text-neutral-400 [&_p]:leading-relaxed', className)} {...props} />
  );
}
