import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import clsx from "clsx";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon,
  badge,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  const renderedIcon = React.useMemo(() => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
      const IconComponent = icon as React.ComponentType<{ className?: string }>;
      return <IconComponent className="w-5 h-5 text-teal-600" />;
    }
    return icon as React.ReactNode;
  }, [icon]);

  return (
    <div
      className={clsx(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200/80 mb-6",
        className
      )}
    >
      <div className="space-y-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-xs text-slate-400 mb-1" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-slate-600 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-slate-600 font-medium">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2.5 flex-wrap">
          {renderedIcon && <div className="text-slate-700 flex-shrink-0">{renderedIcon}</div>}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-tight">
            {title}
          </h1>
          {badge}
        </div>

        {description && (
          <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
