import React from "react";
import clsx from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "brand";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({
  children,
  variant = "neutral",
  size = "sm",
  className,
}: BadgeProps) {
  const styles = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
    warning: "bg-amber-50 text-amber-700 border-amber-200/70",
    danger: "bg-rose-50 text-rose-700 border-rose-200/70",
    info: "bg-sky-50 text-sky-700 border-sky-200/70",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    brand: "bg-teal-50 text-teal-700 border-teal-200",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[11px] font-medium leading-none",
    md: "px-2.5 py-1 text-xs font-medium leading-none",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded border whitespace-nowrap",
        styles[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: boolean | string | undefined | null }) {
  if (status === undefined || status === null) {
    return <Badge variant="neutral">-</Badge>;
  }

  if (typeof status === "boolean") {
    return status ? (
      <Badge variant="success">Active</Badge>
    ) : (
      <Badge variant="danger">Inactive</Badge>
    );
  }

  const s = status.toUpperCase();
  const label = s.replace(/_/g, " ");

  switch (s) {
    case "ACTIVE":
    case "AVAILABLE":
    case "APPROVED":
    case "COMPLETED":
    case "IN_SERVICE":
    case "REGISTERED":
      return <Badge variant="success">{label}</Badge>;

    case "PENDING":
    case "INITIATED":
    case "PENDING_APPROVAL":
    case "IN_TRANSIT":
    case "DISPATCHED":
    case "HANDOVER_PENDING":
    case "REPORTED":
    case "LOW_STOCK":
    case "OVERDUE":
      return <Badge variant="warning">{label}</Badge>;

    case "INACTIVE":
    case "DAMAGED":
    case "LOST":
    case "REJECTED":
    case "CANCELLED":
    case "DISPUTED":
    case "OUT_OF_STOCK":
    case "LOCKED":
      return <Badge variant="danger">{label}</Badge>;

    case "ASSIGNED":
    case "IN_STOCK":
    case "UNDER_MAINTENANCE":
      return <Badge variant="info">{label}</Badge>;

    case "IDLE":
    case "DISPOSED":
    case "WRITTEN_OFF":
    case "TRANSFERRED":
    case "RETIRED":
    default:
      return <Badge variant="neutral">{label}</Badge>;
  }
}
