import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  iconColor?: 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple' | 'slate';
  trend?: {
    value: string | number;
    direction: 'up' | 'down' | 'neutral';
    label?: string;
  };
  className?: string;
  badge?: React.ReactNode;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  iconColor = 'blue',
  trend,
  className,
  badge,
}: MetricCardProps) {
  const iconColorStyles = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100/80',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100/80',
    amber: 'bg-amber-50 text-amber-600 border-amber-100/80',
    rose: 'bg-rose-50 text-rose-600 border-rose-100/80',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100/80',
    purple: 'bg-purple-50 text-purple-600 border-purple-100/80',
    slate: 'bg-slate-100 text-slate-600 border-slate-200/80',
  };

  return (
    <div
      className={twMerge(
        'bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)] hover:border-slate-300 transition-all duration-150',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider select-none">
            {title}
          </span>
          <div className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 tabular-nums tracking-tight">
            {value}
          </div>
        </div>
        {icon && (
          <div
            className={clsx(
              'w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs',
              iconColorStyles[iconColor]
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {(subtitle || trend || badge) && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          {trend ? (
            <div className="flex items-center gap-1.5 font-medium">
              <span
                className={clsx(
                  'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-semibold tabular-nums',
                  trend.direction === 'up' && 'bg-emerald-50 text-emerald-700',
                  trend.direction === 'down' && 'bg-rose-50 text-rose-700',
                  trend.direction === 'neutral' && 'bg-slate-100 text-slate-600'
                )}
              >
                {trend.direction === 'up' && <TrendingUp className="w-3 h-3 shrink-0" />}
                {trend.direction === 'down' && <TrendingDown className="w-3 h-3 shrink-0" />}
                {trend.direction === 'neutral' && <Minus className="w-3 h-3 shrink-0" />}
                {trend.value}
              </span>
              {trend.label && <span className="text-slate-400 font-normal">{trend.label}</span>}
            </div>
          ) : (
            subtitle && <span className="text-slate-500 font-normal truncate">{subtitle}</span>
          )}

          {badge && <div>{badge}</div>}
        </div>
      )}
    </div>
  );
}
