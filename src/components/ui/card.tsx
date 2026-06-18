import { type ReactNode } from 'react';

export function Card({ className = '', children, ...props }: { className?: string; children?: ReactNode; [key: string]: any }) {
  return <div className={`rounded-xl border ${className}`} {...props}>{children}</div>;
}

export function CardHeader({ className = '', children, ...props }: { className?: string; children?: ReactNode; [key: string]: any }) {
  return <div className={`p-5 ${className}`} {...props}>{children}</div>;
}

export function CardTitle({ className = '', children, ...props }: { className?: string; children?: ReactNode; [key: string]: any }) {
  return <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props}>{children}</h3>;
}

export function CardDescription({ className = '', children, ...props }: { className?: string; children?: ReactNode; [key: string]: any }) {
  return <p className={`text-sm text-muted-foreground ${className}`} {...props}>{children}</p>;
}

export function CardContent({ className = '', children, ...props }: { className?: string; children?: ReactNode; [key: string]: any }) {
  return <div className={`p-5 pt-0 ${className}`} {...props}>{children}</div>;
}
