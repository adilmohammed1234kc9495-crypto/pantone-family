import React from "react";
import clsx from "clsx";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "bg-white border border-slate-200/90 rounded-lg shadow-subtle overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-4",
        className
      )}
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-900 leading-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5 leading-normal">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={clsx("p-5", className)}>{children}</div>;
}

export function CardFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between",
        className
      )}
    >
      {children}
    </div>
  );
}
