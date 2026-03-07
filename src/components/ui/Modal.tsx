"use client";

import { ReactNode } from "react";

type ModalProps = {
  children: ReactNode;
  title?: string;
  open?: boolean;
};

export function Modal({ children, title, open = true }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
        {title ? (
          <div className="mb-4 text-lg font-semibold">{title}</div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

