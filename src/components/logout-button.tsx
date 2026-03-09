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
  const isDisabled = isPending;

  return (
    <button
      className="inline-flex min-h-12 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-[transform,filter,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)] active:translate-y-px disabled:translate-y-0 disabled:cursor-wait disabled:brightness-100"
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
      disabled={isDisabled}
      style={
        isDisabled
          ? {
              backgroundColor: "#fca5a5",
              border: "1px solid #fca5a5",
              boxShadow: "none",
              color: "#fff5f5",
            }
          : {
              backgroundColor: "#dc2626",
              border: "1px solid #991b1b",
              boxShadow: "0 16px 30px rgba(220, 38, 38, 0.32)",
              color: "#ffffff",
            }
      }
      type="button"
    >
      <LogoutIcon />
      <span>{isPending ? "Signing out..." : "Sign out"}</span>
    </button>
  );
}
