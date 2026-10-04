import React from "react";
import { Modal } from "./modal";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmationDialogProps) {
  const icon = {
    danger: <AlertCircle className="w-6 h-6 text-rose-600" />,
    warning: <AlertTriangle className="w-6 h-6 text-amber-600" />,
    primary: <Info className="w-6 h-6 text-teal-600" />,
  }[variant];

  const buttonStyle = {
    danger: "bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500",
    warning: "bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500",
    primary: "bg-teal-600 hover:bg-teal-700 text-white focus:ring-teal-500",
  }[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={isLoading ? () => {} : onClose}
      title={title}
      maxWidth="md"
      footer={
        <>
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${buttonStyle}`}
          >
            {isLoading ? "Processing..." : confirmText}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-full bg-slate-100 flex-shrink-0">{icon}</div>
        <p className="text-sm text-slate-600 leading-relaxed pt-1">{message}</p>
      </div>
    </Modal>
  );
}
