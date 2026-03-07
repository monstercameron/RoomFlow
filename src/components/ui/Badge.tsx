"use client";

import { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  variant?: "info" | "success" | "alert";
};

const variantClasses: Record<string, string> = {
  info: "bg-[var(--color-panel-strong)] text-[var(--color-muted)]",
  success: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
  alert: "bg-[rgba(184,88,51,0.12)] text-[var(--color-accent-strong)]",
};

export function Badge({ children, variant = "info" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}

