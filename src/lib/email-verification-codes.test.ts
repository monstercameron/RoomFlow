import assert from "node:assert/strict";
import test from "node:test";

async function getEmailVerificationCodesModule() {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

  return import("@/lib/email-verification-codes");
}

type EmailVerificationCodeDependencies = Awaited<
  ReturnType<typeof getEmailVerificationCodesModule>
>["EmailVerificationCodeDependencies"];

type InMemoryVerificationRecord = {
  createdAt: Date;
  expiresAt: Date;
  identifier: string;
  value: string;
};

function createInMemoryDependencies(now: Date) {
  const records: InMemoryVerificationRecord[] = [];
  let currentTime = now;

  const dependencies: EmailVerificationCodeDependencies = {
    createVerificationRecord: async (record) => {
      records.push({
        createdAt: new Date(currentTime),
        expiresAt: record.expiresAt,
        identifier: record.identifier,
        value: record.value,
      });
    },
    deleteExpiredVerificationRecords: async (prefixes, comparisonTime) => {
      for (let index = records.length - 1; index >= 0; index -= 1) {
        if (
          prefixes.some((prefix) => records[index]?.identifier.startsWith(prefix)) &&
          records[index] &&
          records[index].expiresAt.getTime() < comparisonTime.getTime()
        ) {
          records.splice(index, 1);
        }
      }
    },
    deleteVerificationRecordsByIdentifier: async (identifier) => {
      for (let index = records.length - 1; index >= 0; index -= 1) {
        if (records[index]?.identifier === identifier) {
          records.splice(index, 1);
        }
      }
    },
    findLatestVerificationRecord: async (identifier) =>
      records
        .filter((record) => record.identifier === identifier)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null,
    now: () => new Date(currentTime),
  };

  return {
    dependencies,
    setNow(nextNow: Date) {
      currentTime = nextNow;
    },
  };
}

test("normalizeEmailVerificationCode strips separators and casing", async () => {
  const { formatEmailVerificationCode, normalizeEmailVerificationCode } =
    await getEmailVerificationCodesModule();

  assert.equal(normalizeEmailVerificationCode(" abcd-ef12 "), "ABCDEF12");
  assert.equal(formatEmailVerificationCode("abcdef12"), "ABCD-EF12");
});

test("storeEmailVerificationCode returns a formatted code and consumeEmailVerificationCode resolves it", async () => {
  const { consumeEmailVerificationCode, storeEmailVerificationCode } =
    await getEmailVerificationCodesModule();
  const inMemoryStore = createInMemoryDependencies(new Date("2026-03-09T12:00:00.000Z"));
  const storedCode = await storeEmailVerificationCode(
    {
      callbackUrl: "/app/settings/profile?profileStatus=email-updated",
      recipientEmailAddress: "next@roomflow.local",
      token: "verification-token-123",
    },
    inMemoryStore.dependencies,
  );

  assert.match(storedCode.formattedCode, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  const consumedCode = await consumeEmailVerificationCode(storedCode.formattedCode, inMemoryStore.dependencies);

  assert.equal(consumedCode.status, "verified");
  if (consumedCode.status !== "verified") {
    return;
  }

  assert.equal(consumedCode.emailAddress, "next@roomflow.local");
  assert.equal(consumedCode.callbackPath, "/app/settings/profile?profileStatus=email-updated");
  assert.equal(consumedCode.token, "verification-token-123");
});

test("consumeEmailVerificationCode expires stale codes", async () => {
  const { consumeEmailVerificationCode, storeEmailVerificationCode } =
    await getEmailVerificationCodesModule();
  const inMemoryStore = createInMemoryDependencies(new Date("2026-03-09T12:00:00.000Z"));
  const storedCode = await storeEmailVerificationCode(
    {
      callbackUrl: "/verify-email?status=verified",
      recipientEmailAddress: "next@roomflow.local",
      token: "verification-token-123",
    },
    inMemoryStore.dependencies,
  );

  inMemoryStore.setNow(new Date("2026-03-09T13:30:00.000Z"));

  const consumedCode = await consumeEmailVerificationCode(storedCode.code, inMemoryStore.dependencies);

  assert.deepEqual(consumedCode, { status: "expired" });
});