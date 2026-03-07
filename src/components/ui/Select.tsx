"use client";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select(props: SelectProps) {
  return (
    <select
      className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm focus:border-[var(--color-accent)] focus:outline-none"
      {...props}
    />
  );
}

