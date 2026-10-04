import React from "react";
import clsx from "clsx";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "destructive" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  rightIcon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      loading = false,
      leftIcon,
      rightIcon,
      icon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      primary:
        "bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white shadow-sm border border-teal-700/20 focus:ring-teal-500/30",
      secondary:
        "bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-300 shadow-sm focus:ring-slate-400/30",
      outline:
        "bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 focus:ring-slate-400/30",
      destructive:
        "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm border border-rose-700/20 focus:ring-rose-500/30",
      ghost:
        "bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-900 border border-transparent focus:ring-slate-400/30",
    };

    const sizeStyles = {
      sm: "h-8 px-2.5 text-xs rounded-md gap-1.5",
      md: "h-9 px-3.5 text-sm rounded-md gap-2",
      lg: "h-10 px-4 text-sm font-medium rounded-lg gap-2.5",
      icon: "h-8 w-8 p-0 rounded-md justify-center",
    };

    const isBusy = isLoading || loading;
    const effectiveLeftIcon = icon || leftIcon;

    const renderIconNode = (ico: React.ReactNode | React.ComponentType<{ className?: string }>) => {
      if (!ico) return null;
      if (React.isValidElement(ico)) return ico;
      if (typeof ico === "function" || (typeof ico === "object" && ico !== null)) {
        const IconComponent = ico as React.ComponentType<{ className?: string }>;
        return <IconComponent className="w-4 h-4" />;
      }
      return ico as React.ReactNode;
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isBusy}
        className={clsx(
          "inline-flex items-center justify-center font-medium transition-colors select-none",
          "focus:outline-none focus:ring-2 focus:ring-offset-1",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isBusy ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          renderIconNode(effectiveLeftIcon)
        )}
        {children}
        {!isBusy && renderIconNode(rightIcon)}
      </button>
    );
  }
);

Button.displayName = "Button";
