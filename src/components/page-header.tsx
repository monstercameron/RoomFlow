import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: ReactNode;
  description: string;
  actions?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
          {eyebrow}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
          {description}
        </p>
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}
