import { randomInt } from "node:crypto";
import { getConfiguredEmailDeliveryProvider } from "@/lib/email-delivery";
import { prisma } from "@/lib/prisma";
import { normalizeApplicationPath } from "@/lib/auth-urls";

const verificationCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const verificationCodeLength = 8;
const verificationCodeLifetimeMs = 60 * 60 * 1000;
const verificationCodeIdentifierPrefix = "experimental-email-verification-code:";
const verificationEmailIdentifierPrefix = "experimental-email-verification-email:";

type StoredEmailVerificationCode = {
  callbackPath: string;
  code: string;
  emailAddress: string;
  token: string;
};

type VerificationRecord = {
  createdAt?: Date;
  expiresAt: Date;
  identifier: string;
  value: string;
};

export type StoredEmailVerificationCodeRecord = StoredEmailVerificationCode & {
  expiresAt: Date;
  formattedCode: string;
};

export type ConsumeEmailVerificationCodeResult =
  | ({ status: "verified" } & StoredEmailVerificationCodeRecord)
  | { status: "expired" | "invalid" };

export type EmailVerificationCodeDependencies = {
  createVerificationRecord: (record: VerificationRecord) => Promise<void>;
  deleteExpiredVerificationRecords: (prefixes: string[], now: Date) => Promise<void>;
  deleteVerificationRecordsByIdentifier: (identifier: string) => Promise<void>;
  findLatestVerificationRecord: (identifier: string) => Promise<VerificationRecord | null>;
  now: () => Date;
};

const defaultEmailVerificationCodeDependencies: EmailVerificationCodeDependencies = {
  createVerificationRecord: async (record) => {
    await prisma.verification.create({
      data: {
        expiresAt: record.expiresAt,
        identifier: record.identifier,
        value: record.value,
      },
    });
  },
  deleteExpiredVerificationRecords: async (prefixes, now) => {
    await Promise.all(
      prefixes.map((identifierPrefix) =>
        prisma.verification.deleteMany({
          where: {
            expiresAt: {
              lt: now,
            },
            identifier: {
              startsWith: identifierPrefix,
            },
          },
        }),
      ),
    );
  },
  deleteVerificationRecordsByIdentifier: async (identifier) => {
    await prisma.verification.deleteMany({
      where: {
        identifier,
      },
    });
  },
  findLatestVerificationRecord: async (identifier) =>
    prisma.verification.findFirst({
      orderBy: {
        createdAt: "desc",
      },
      where: {
        identifier,
      },
    }),
  now: () => new Date(),
};

function buildVerificationCodeIdentifier(code: string) {
  return `${verificationCodeIdentifierPrefix}${code}`;
}

function buildVerificationEmailIdentifier(emailAddress: string) {
  return `${verificationEmailIdentifierPrefix}${emailAddress.trim().toLowerCase()}`;
}

function parseStoredEmailVerificationCode(value: string): StoredEmailVerificationCode | null {
  try {
    const parsedValue = JSON.parse(value) as Partial<StoredEmailVerificationCode>;

    if (
      typeof parsedValue.callbackPath === "string" &&
      typeof parsedValue.code === "string" &&
      typeof parsedValue.emailAddress === "string" &&
      typeof parsedValue.token === "string"
    ) {
      return {
        callbackPath: normalizeApplicationPath(parsedValue.callbackPath),
        code: normalizeEmailVerificationCode(parsedValue.code),
        emailAddress: parsedValue.emailAddress.trim().toLowerCase(),
        token: parsedValue.token,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function toStoredEmailVerificationCodeRecord(record: VerificationRecord): StoredEmailVerificationCodeRecord | null {
  const parsedValue = parseStoredEmailVerificationCode(record.value);

  if (!parsedValue) {
    return null;
  }

  return {
    ...parsedValue,
    expiresAt: record.expiresAt,
    formattedCode: formatEmailVerificationCode(parsedValue.code),
  };
}

export function normalizeEmailVerificationCode(candidateCode?: string | null) {
  return String(candidateCode ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function formatEmailVerificationCode(code: string) {
  const normalizedCode = normalizeEmailVerificationCode(code);

  if (normalizedCode.length !== verificationCodeLength) {
    return normalizedCode;
  }

  return `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4)}`;
}

export function generateEmailVerificationCode() {
  let nextCode = "";

  for (let index = 0; index < verificationCodeLength; index += 1) {
    nextCode += verificationCodeAlphabet[randomInt(0, verificationCodeAlphabet.length)];
  }

  return nextCode;
}

export function isExperimentalEmailVerificationCodeAccessEnabled() {
  return process.env.NODE_ENV !== "production" || getConfiguredEmailDeliveryProvider() === "mock";
}

export async function storeEmailVerificationCode(params: {
  callbackUrl?: string | null;
  recipientEmailAddress: string;
  token: string;
}, dependencies: EmailVerificationCodeDependencies = defaultEmailVerificationCodeDependencies) {
  const now = dependencies.now();
  const emailAddress = params.recipientEmailAddress.trim().toLowerCase();
  const code = generateEmailVerificationCode();
  const expiresAt = new Date(now.getTime() + verificationCodeLifetimeMs);
  const storedRecord: StoredEmailVerificationCode = {
    callbackPath: normalizeApplicationPath(params.callbackUrl),
    code,
    emailAddress,
    token: params.token,
  };
  const serializedRecord = JSON.stringify(storedRecord);

  await dependencies.deleteExpiredVerificationRecords(
    [verificationCodeIdentifierPrefix, verificationEmailIdentifierPrefix],
    now,
  );
  await dependencies.deleteVerificationRecordsByIdentifier(buildVerificationEmailIdentifier(emailAddress));
  await dependencies.createVerificationRecord({
    expiresAt,
    identifier: buildVerificationCodeIdentifier(code),
    value: serializedRecord,
  });
  await dependencies.createVerificationRecord({
    expiresAt,
    identifier: buildVerificationEmailIdentifier(emailAddress),
    value: serializedRecord,
  });

  return {
    ...storedRecord,
    expiresAt,
    formattedCode: formatEmailVerificationCode(code),
  } satisfies StoredEmailVerificationCodeRecord;
}

export async function peekLatestEmailVerificationCode(
  recipientEmailAddress: string,
  dependencies: EmailVerificationCodeDependencies = defaultEmailVerificationCodeDependencies,
) {
  const now = dependencies.now();
  const record = await dependencies.findLatestVerificationRecord(
    buildVerificationEmailIdentifier(recipientEmailAddress),
  );

  if (!record) {
    return null;
  }

  if (record.expiresAt.getTime() <= now.getTime()) {
    await dependencies.deleteVerificationRecordsByIdentifier(buildVerificationEmailIdentifier(recipientEmailAddress));
    return null;
  }

  return toStoredEmailVerificationCodeRecord(record);
}

export async function consumeEmailVerificationCode(
  candidateCode: string,
  dependencies: EmailVerificationCodeDependencies = defaultEmailVerificationCodeDependencies,
): Promise<ConsumeEmailVerificationCodeResult> {
  const now = dependencies.now();
  const normalizedCode = normalizeEmailVerificationCode(candidateCode);

  if (!normalizedCode) {
    return { status: "invalid" };
  }

  const record = await dependencies.findLatestVerificationRecord(
    buildVerificationCodeIdentifier(normalizedCode),
  );

  if (!record) {
    return { status: "invalid" };
  }

  const storedRecord = toStoredEmailVerificationCodeRecord(record);

  if (!storedRecord) {
    await dependencies.deleteVerificationRecordsByIdentifier(buildVerificationCodeIdentifier(normalizedCode));
    return { status: "invalid" };
  }

  if (record.expiresAt.getTime() <= now.getTime()) {
    await dependencies.deleteVerificationRecordsByIdentifier(buildVerificationCodeIdentifier(normalizedCode));
    await dependencies.deleteVerificationRecordsByIdentifier(
      buildVerificationEmailIdentifier(storedRecord.emailAddress),
    );
    return { status: "expired" };
  }

  await dependencies.deleteVerificationRecordsByIdentifier(buildVerificationCodeIdentifier(normalizedCode));
  await dependencies.deleteVerificationRecordsByIdentifier(
    buildVerificationEmailIdentifier(storedRecord.emailAddress),
  );

  return {
    ...storedRecord,
    status: "verified",
  };
}