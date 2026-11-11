import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'subdued';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 select-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 active:scale-[0.98]';

    const variants = {
      primary:
        'bg-blue-600 hover:bg-blue-500 text-white shadow-xs border border-blue-700/30 hover:shadow-sm',
      secondary:
        'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 hover:border-slate-300',
      outline:
        'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs hover:border-slate-300 hover:text-slate-900',
      ghost:
        'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900',
      danger:
        'bg-rose-600 hover:bg-rose-500 text-white shadow-xs border border-rose-700/30 hover:shadow-sm',
      subdued:
        'bg-transparent hover:bg-slate-100/70 text-slate-500 hover:text-slate-700 text-xs',
    };

    const sizes = {
      xs: 'text-xs px-2 py-1 rounded-lg gap-1.5 h-7',
      sm: 'text-xs px-2.5 py-1.5 rounded-lg gap-1.5 h-8',
      md: 'text-sm px-3.5 py-2 rounded-xl gap-2 h-9',
      lg: 'text-sm px-4 py-2.5 rounded-xl gap-2.5 h-11 font-semibold',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-current shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
