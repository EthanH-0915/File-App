"use client";

import { useEffect, useRef } from "react";

type ConfirmDialogProps = {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus starts on Cancel so a stray Enter never confirms a destructive
  // action, and Escape backs out the same way clicking the backdrop does.
  useEffect(() => {
    cancelRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="text-lg font-semibold text-gray-800">
          {title}
        </h3>
        <p id="confirm-dialog-message" className="text-sm text-gray-600 break-words">
          {message}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={busy}
            className="px-4 h-10 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 h-10 rounded-lg text-white font-medium transition-colors disabled:opacity-50 ${
              destructive ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
