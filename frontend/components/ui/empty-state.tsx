import React from "react";
import clsx from "clsx";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode | EmptyStateAction;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  const renderedIcon = React.useMemo(() => {
    if (!icon) return <Inbox className="w-10 h-10 text-slate-300 stroke-[1.5]" />;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
      const IconComponent = icon as React.ComponentType<{ className?: string }>;
      return <IconComponent className="w-10 h-10 text-slate-300 stroke-[1.5]" />;
    }
    return icon as React.ReactNode;
  }, [icon]);

  const effectiveAction = React.useMemo(() => {
    if (React.isValidElement(action)) return action;
    if (action && typeof action === "object" && "label" in action && "onClick" in action) {
      const act = action as EmptyStateAction;
      return (
        <Button variant="primary" size="sm" onClick={act.onClick}>
          {act.label}
        </Button>
      );
    }
    if (actionLabel) {
      return (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      );
    }
    return action as React.ReactNode;
  }, [action, actionLabel, onAction]);

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50",
        className
      )}
    >
      <div className="p-3 rounded-full bg-white border border-slate-200/80 shadow-xs mb-3 text-slate-500">
        {renderedIcon}
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">
          {description}
        </p>
      )}
      {effectiveAction && <div className="mt-1">{effectiveAction}</div>}
    </div>
  );
}
