import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'outline';
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
}

export function Badge({
  className,
  variant = 'default',
  size = 'sm',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center font-medium select-none tracking-tight';

  const variants = {
    default: 'bg-slate-900 text-white border border-slate-800',
    secondary: 'bg-slate-100 text-slate-700 border border-slate-200/70',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200/80',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200/80',
    info: 'bg-blue-50 text-blue-700 border border-blue-200/80',
    purple: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80',
    outline: 'bg-transparent text-slate-600 border border-slate-200',
  };

  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.5 rounded-md gap-1 font-medium',
    sm: 'text-xs px-2 py-0.5 rounded-lg gap-1.5 font-medium',
    md: 'text-xs px-2.5 py-1 rounded-lg gap-1.5 font-semibold',
  };

  const dotColors = {
    default: 'bg-white',
    secondary: 'bg-slate-400',
    success: 'bg-emerald-500 animate-pulse',
    warning: 'bg-amber-500 animate-pulse',
    danger: 'bg-rose-500 animate-pulse',
    info: 'bg-blue-500',
    purple: 'bg-indigo-500',
    outline: 'bg-slate-400',
  };

  return (
    <span className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))} {...props}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])} />}
      {children}
    </span>
  );
}
