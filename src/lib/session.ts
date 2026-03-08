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

type ServerSession = Awaited<ReturnType<typeof auth.api.getSession>>;
type RawActiveSessionRecord = Awaited<ReturnType<typeof auth.api.listSessions>>[number];

export type SessionDependencies = {
  getRequestHeaders: typeof headers;
  getSession: (options: { headers: Awaited<ReturnType<typeof headers>> }) => Promise<ServerSession>;
  listSessions: (options: { headers: Awaited<ReturnType<typeof headers>> }) => Promise<RawActiveSessionRecord[]>;
};

const defaultSessionDependencies: SessionDependencies = {
  getRequestHeaders: headers,
  getSession: (options) => auth.api.getSession(options),
  listSessions: (options) => auth.api.listSessions(options),
};

export async function loadServerSession(
  dependencies: SessionDependencies = defaultSessionDependencies,
): Promise<ServerSession> {
  try {
    return await dependencies.getSession({
      headers: await dependencies.getRequestHeaders(),
    });
  } catch (error) {
    console.error("Failed to fetch server session (database might be down):", error);
    return null;
  }
}

export async function loadActiveSessions(
  dependencies: SessionDependencies = defaultSessionDependencies,
): Promise<ActiveSessionRecord[]> {
  try {
    const activeSessions = await dependencies.listSessions({
      headers: await dependencies.getRequestHeaders(),
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
}

export const getServerSession = cache(async () => loadServerSession());

export const getActiveSessions = cache(async (): Promise<ActiveSessionRecord[]> => loadActiveSessions());
