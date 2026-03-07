"use client";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea(props: TextareaProps) {
  return (
    <textarea
      className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm focus:border-[var(--color-accent)] focus:outline-none"
      rows={4}
      {...props}
    />
  );
}

