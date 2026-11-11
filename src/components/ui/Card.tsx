import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Card({
  className,
  children,
  hover = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)] transition-all duration-150',
          hover && 'hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:-translate-y-[1px]',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge(clsx('p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between', className))} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={twMerge(clsx('font-heading font-semibold text-slate-900 text-sm sm:text-base tracking-tight', className))} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={twMerge(clsx('text-xs text-slate-500 font-normal mt-0.5', className))} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge(clsx('p-4 sm:p-5', className))} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge(clsx('p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex items-center justify-between', className))} {...props}>
      {children}
    </div>
  );
}
