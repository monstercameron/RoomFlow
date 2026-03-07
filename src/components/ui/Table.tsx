"use client";

import { ReactNode } from "react";

type TableProps = {
  children: ReactNode;
  className?: string;
};

export function Table({ children, className = "" }: TableProps) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white ${className}`}>
      <table className="min-w-full divide-y divide-[var(--color-line)] text-sm text-[var(--color-ink)]">
        {children}
      </table>
    </div>
  );
}

