"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function LeadCreateFormContent({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <div
      className={`transition-[opacity,transform,filter] duration-300 ${
        pending ? "scale-[0.992] opacity-70 blur-[1px]" : "scale-100 opacity-100"
      }`}
    >
      {children}
    </div>
  );
}

export function LeadCreatePendingOverlay() {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[2rem] bg-[rgba(246,239,232,0.72)] backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="flex items-center gap-3 rounded-2xl border border-[rgba(184,88,51,0.18)] bg-[rgba(255,251,247,0.96)] px-5 py-4 text-sm font-medium text-[var(--color-accent-strong)] shadow-[0_18px_45px_rgba(62,43,28,0.12)]">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[rgba(184,88,51,0.2)] border-t-[var(--color-accent)]" />
        Creating lead and opening the record...
      </div>
    </div>
  );
}

export function LeadCreateSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex min-w-[10rem] items-center justify-center gap-2 rounded-2xl border border-[rgba(184,88,51,0.24)] bg-[var(--color-accent)] px-5 py-3 font-medium text-white shadow-[0_10px_24px_rgba(141,63,33,0.22)] transition-all duration-150 hover:bg-[var(--color-accent-strong)] disabled:cursor-wait disabled:hover:bg-[var(--color-accent)]"
      disabled={pending}
      type="submit"
    >
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.35)] border-t-white" />
          Creating lead...
        </>
      ) : (
        "Create lead"
      )}
    </button>
  );
}