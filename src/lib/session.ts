import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/lib/auth";

export type ActiveSessionRecord = {
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string | null;
  token: string;
  updatedAt: Date;
  userAgent?: string | null;
  userId: string;
};

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

export const getActiveSessions = cache(async (): Promise<ActiveSessionRecord[]> => {
  try {
    const activeSessions = await auth.api.listSessions({
      headers: await headers(),
    });

    return activeSessions.map((activeSession) => ({
      createdAt: activeSession.createdAt,
      expiresAt: activeSession.expiresAt,
      ipAddress: activeSession.ipAddress,
      token: activeSession.token,
      updatedAt: activeSession.updatedAt,
      userAgent: activeSession.userAgent,
      userId: activeSession.userId,
    }));
  } catch (error) {
    console.error("Failed to fetch active sessions:", error);
    return [];
  }
});
