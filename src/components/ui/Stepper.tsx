"use client";

type StepperProps = {
  steps: string[];
  current: number;
};

export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-muted)]">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-2">
          <span
            className={`h-8 w-8 rounded-full border border-[var(--color-line)] flex items-center justify-center text-[var(--color-muted)] ${
              index <= current ? "bg-[var(--color-panel-strong)] text-[var(--color-accent-strong)]" : ""
            }`}
          >
            {index + 1}
          </span>
          <span className={index <= current ? "text-[var(--color-ink)]" : ""}>{step}</span>
        </li>
      ))}
    </ol>
  );
}

