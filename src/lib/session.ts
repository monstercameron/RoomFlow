import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/lib/auth";

export const getServerSession = cache(async () => {
  try {
    return await auth.api.getSession({
      headers: await headers(),
    });
  } catch (error) {
    console.error("Failed to fetch server session (database might be down):", error);
    return null;
  }
});
