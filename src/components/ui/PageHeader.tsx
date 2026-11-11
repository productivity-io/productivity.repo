import React from 'react';
import { ChevronRight } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  badge,
  actions,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div className={twMerge('mb-6 sm:mb-8 space-y-3', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-400">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.label}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
              {crumb.href ? (
                <a
                  href={crumb.href}
                  className="hover:text-slate-600 transition-colors font-medium"
                >
                  {crumb.label}
                </a>
              ) : (
                <span className="text-slate-600 font-semibold">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 tracking-tight">
              {title}
            </h1>
            {badge && <div>{badge}</div>}
          </div>
          {subtitle && <p className="text-xs sm:text-sm text-slate-500 font-normal">{subtitle}</p>}
        </div>

        {actions && <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">{actions}</div>}
      </div>

      {children && <div className="pt-2">{children}</div>}
    </div>
  );
}
