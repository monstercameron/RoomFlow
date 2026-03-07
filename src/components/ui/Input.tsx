"use client";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input(props: InputProps) {
  return (
    <input
      className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm focus:border-[var(--color-accent)] focus:outline-none"
      {...props}
    />
  );
}

