import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { TextEmailPayload } from "@/lib/email-types";

export type MockEmailMessage = TextEmailPayload & {
  id: string;
  provider: "mock";
  sentAt: string;
};

const mockEmailDirectoryPath = path.join(process.cwd(), ".local_email");
const mockEmailInboxFilePath = path.join(mockEmailDirectoryPath, "mock-email-inbox.json");

async function ensureMockEmailDirectory() {
  await mkdir(mockEmailDirectoryPath, { recursive: true });
}

async function readStoredMockEmailMessages() {
  try {
    const rawInboxContent = await readFile(mockEmailInboxFilePath, "utf8");
    const parsedInboxContent = JSON.parse(rawInboxContent) as MockEmailMessage[];

    return Array.isArray(parsedInboxContent) ? parsedInboxContent : [];
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

export async function storeMockEmailMessage(payload: TextEmailPayload) {
  await ensureMockEmailDirectory();

  const existingMessages = await readStoredMockEmailMessages();
  const nextMessage: MockEmailMessage = {
    ...payload,
    id: randomUUID(),
    provider: "mock",
    sentAt: new Date().toISOString(),
  };

  await writeFile(
    mockEmailInboxFilePath,
    JSON.stringify([nextMessage, ...existingMessages], null, 2),
    "utf8",
  );

  return nextMessage;
}

export async function listMockEmailMessages() {
  return readStoredMockEmailMessages();
}

export async function clearMockEmailMessages() {
  await rm(mockEmailInboxFilePath, { force: true });
}

export function getMockEmailInboxFilePath() {
  return mockEmailInboxFilePath;
}