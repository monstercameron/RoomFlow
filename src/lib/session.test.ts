import assert from "node:assert/strict";
import test from "node:test";
import type { SessionDependencies } from "@/lib/session";

function getSessionModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./session") as typeof import("@/lib/session");
}

test("loadServerSession returns the auth session using request headers", async () => {
  const { loadServerSession } = getSessionModule();
    const expectedSession = {
      session: {
        createdAt: new Date("2026-03-08T00:00:00.000Z"),
        expiresAt: new Date("2026-03-09T00:00:00.000Z"),
        id: "session-1",
        ipAddress: "127.0.0.1",
        token: "token-1",
        updatedAt: new Date("2026-03-08T01:00:00.000Z"),
        userAgent: "Playwright",
        userId: "user-1",
      },
      user: {
        createdAt: new Date("2026-03-08T00:00:00.000Z"),
        email: "lead@example.com",
        emailVerified: false,
        id: "user-1",
        image: null,
        name: "Lead Prospect",
        updatedAt: new Date("2026-03-08T01:00:00.000Z"),
      },
    };
  const dependencies: SessionDependencies = {
    getRequestHeaders: async () => new Headers({ cookie: "roomflow=session" }),
    getSession: async ({ headers }) => {
      assert.equal(headers.get("cookie"), "roomflow=session");
      return expectedSession;
    },
    listSessions: async () => [],
  };

  const result = await loadServerSession(dependencies);

  assert.equal(result, expectedSession);
});

test("loadServerSession returns null when auth session lookup fails", async () => {
  const { loadServerSession } = getSessionModule();
  const capturedErrors: unknown[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    capturedErrors.push(args);
  };

  try {
    const dependencies: SessionDependencies = {
      getRequestHeaders: async () => new Headers(),
      getSession: async () => {
        throw new Error("Database offline");
      },
      listSessions: async () => [],
    };

    const result = await loadServerSession(dependencies);

    assert.equal(result, null);
    assert.equal(capturedErrors.length, 1);
  } finally {
    console.error = originalConsoleError;
  }
});

test("loadActiveSessions maps Better Auth session records", async () => {
  const { loadActiveSessions } = getSessionModule();
  const sessionRecord = {
    createdAt: new Date("2026-03-08T00:00:00.000Z"),
    expiresAt: new Date("2026-03-09T00:00:00.000Z"),
      id: "session-1",
    ipAddress: "127.0.0.1",
    token: "token-1",
    updatedAt: new Date("2026-03-08T01:00:00.000Z"),
    userAgent: "Playwright",
    userId: "user-1",
  };
  const dependencies: SessionDependencies = {
    getRequestHeaders: async () => new Headers(),
    getSession: async () => null,
    listSessions: async () => [sessionRecord],
  };

  const result = await loadActiveSessions(dependencies);

  assert.deepEqual(result, [
    {
      createdAt: sessionRecord.createdAt,
      expiresAt: sessionRecord.expiresAt,
      ipAddress: sessionRecord.ipAddress,
      token: sessionRecord.token,
      updatedAt: sessionRecord.updatedAt,
      userAgent: sessionRecord.userAgent,
      userId: sessionRecord.userId,
    },
  ]);
});

test("loadActiveSessions returns an empty array when session listing fails", async () => {
  const { loadActiveSessions } = getSessionModule();
  const capturedErrors: unknown[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    capturedErrors.push(args);
  };

  try {
    const dependencies: SessionDependencies = {
      getRequestHeaders: async () => new Headers(),
      getSession: async () => null,
      listSessions: async () => {
        throw new Error("List failed");
      },
    };

    const result = await loadActiveSessions(dependencies);

    assert.deepEqual(result, []);
    assert.equal(capturedErrors.length, 1);
  } finally {
    console.error = originalConsoleError;
  }
});