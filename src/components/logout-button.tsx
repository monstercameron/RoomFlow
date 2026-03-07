"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-2 text-sm font-medium"
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
        router.refresh();
      }}
      type="button"
    >
      Sign out
    </button>
  );
}
