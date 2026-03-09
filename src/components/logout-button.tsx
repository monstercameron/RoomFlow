"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function LogoutIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" className="h-4.5 w-4.5">
      <path
        d="M14.75 7.75 19 12m0 0-4.25 4.25M19 12H9.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M10.25 5.75h-2.5A2.5 2.5 0 0 0 5.25 8.25v7.5a2.5 2.5 0 0 0 2.5 2.5h2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <button
      className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-[rgba(170,58,32,0.22)] bg-[linear-gradient(180deg,rgba(255,236,232,0.98),rgba(251,223,216,0.94))] px-4 py-3 text-sm font-semibold text-[#8f2f1c] shadow-[0_10px_22px_rgba(143,47,28,0.08)] transition-[transform,border-color,background-color,color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(143,47,28,0.34)] hover:bg-[linear-gradient(180deg,rgba(255,228,222,1),rgba(247,208,199,0.98))] hover:text-[#6f2416] hover:shadow-[0_14px_28px_rgba(143,47,28,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(170,58,32,0.22)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)] active:translate-y-px disabled:translate-y-0 disabled:cursor-wait disabled:border-[rgba(170,58,32,0.12)] disabled:bg-[rgba(246,224,218,0.72)] disabled:text-[rgba(143,47,28,0.58)] disabled:shadow-none"
      onClick={async () => {
        if (isPending) {
          return;
        }

        setIsPending(true);

        try {
          await authClient.signOut();
          router.push("/login");
          router.refresh();
        } finally {
          setIsPending(false);
        }
      }}
      disabled={isPending}
      type="button"
    >
      <LogoutIcon />
      <span>{isPending ? "Signing out..." : "Sign out"}</span>
    </button>
  );
}
