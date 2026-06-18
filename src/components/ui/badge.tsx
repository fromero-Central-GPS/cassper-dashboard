import { type ReactNode } from 'react';

const variants: Record<string, string> = {
  default: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  secondary: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  destructive: 'bg-red-500/20 text-red-400 border-red-500/30',
  outline: 'bg-transparent text-slate-400 border-slate-600/50',
};

export function Badge({
  children,
  className = '',
  variant = 'default',
}: {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variants[variant] ?? variants.default} ${className}`}
    >
      {children}
    </span>
  );
}
