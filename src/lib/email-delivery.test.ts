import assert from "node:assert/strict";
import test from "node:test";
import { SendEmailCommand } from "@aws-sdk/client-sesv2";
import {
  getConfiguredEmailDeliveryClient,
  getConfiguredEmailDeliveryProvider,
  getConfiguredSenderEmailAddress,
  getMissingEmailDeliveryConfigurationKeys,
} from "@/lib/email-delivery";

function withEnvironment(overrides: Record<string, string | undefined>, callback: () => Promise<void> | void) {
  const previousValues = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    previousValues.set(key, process.env[key]);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of previousValues.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("email delivery defaults to Resend when no provider is selected", () => {
  withEnvironment(
    {
      EMAIL_DELIVERY_PROVIDER: undefined,
    },
    () => {
      assert.equal(getConfiguredEmailDeliveryProvider(), "resend");
    },
  );
});

test("email delivery supports a local mock provider", async () => {
  const storedPayloads: Array<{
    from: string;
    subject: string;
    text: string;
    to: string[];
  }> = [];

  await withEnvironment(
    {
      EMAIL_DELIVERY_PROVIDER: "mock",
      EMAIL_FROM_ADDRESS: "noreply@roomflow.local",
    },
    async () => {
      const emailDeliveryClient = getConfiguredEmailDeliveryClient({
        storeMockEmailMessage: async (payload) => {
          storedPayloads.push(payload);
          return {
            ...payload,
            id: "mock-1",
            provider: "mock",
            sentAt: new Date().toISOString(),
          };
        },
        createResendClient: () => {
          throw new Error("Resend should not be constructed for mock tests.");
        },
        createSesClient: () => {
          throw new Error("SES should not be constructed for mock tests.");
        },
      });

      assert.equal(emailDeliveryClient?.provider, "mock");

      await emailDeliveryClient?.sendTextEmail({
        from: "noreply@roomflow.local",
        to: ["lead@example.com"],
        subject: "Mock subject",
        text: "Mock body",
      });
    },
  );

  assert.deepEqual(storedPayloads, [
    {
      from: "noreply@roomflow.local",
      to: ["lead@example.com"],
      subject: "Mock subject",
      text: "Mock body",
    },
  ]);
});

test("email delivery uses a shared sender address before provider-specific fallbacks", () => {
  withEnvironment(
    {
      EMAIL_DELIVERY_PROVIDER: "ses",
      EMAIL_FROM_ADDRESS: "noreply@roomflow.app",
      SES_FROM_EMAIL: "ses-only@roomflow.app",
    },
    () => {
      assert.equal(getConfiguredSenderEmailAddress(), "noreply@roomflow.app");
    },
  );
});

test("email delivery reports SES setup gaps before send time", () => {
  withEnvironment(
    {
      EMAIL_DELIVERY_PROVIDER: "ses",
      EMAIL_FROM_ADDRESS: undefined,
      SES_FROM_EMAIL: undefined,
      AWS_REGION: undefined,
      AWS_DEFAULT_REGION: undefined,
    },
    () => {
      assert.deepEqual(getMissingEmailDeliveryConfigurationKeys(), [
        "EMAIL_FROM_ADDRESS or SES_FROM_EMAIL",
        "AWS_REGION or AWS_DEFAULT_REGION",
      ]);
    },
  );
});

test("mock delivery does not report provider setup gaps", () => {
  withEnvironment(
    {
      EMAIL_DELIVERY_PROVIDER: "mock",
      EMAIL_FROM_ADDRESS: undefined,
      MOCK_EMAIL_FROM_ADDRESS: undefined,
    },
    () => {
      assert.deepEqual(getMissingEmailDeliveryConfigurationKeys(), []);
      assert.equal(getConfiguredSenderEmailAddress(), "noreply@roomflow.local");
    },
  );
});

test("email delivery can build an SES sender with configuration set support", async () => {
  const capturedCommands: SendEmailCommand[] = [];

  await withEnvironment(
    {
      EMAIL_DELIVERY_PROVIDER: "ses",
      EMAIL_FROM_ADDRESS: "noreply@roomflow.app",
      AWS_REGION: "us-east-1",
      AWS_ACCESS_KEY_ID: "AKIA123",
      AWS_SECRET_ACCESS_KEY: "secret123",
      SES_CONFIGURATION_SET_NAME: "roomflow-auth",
    },
    async () => {
      const emailDeliveryClient = getConfiguredEmailDeliveryClient({
        createResendClient: () => {
          throw new Error("Resend should not be constructed for SES tests.");
        },
        createSesClient: () => ({
          send: async (command) => {
            capturedCommands.push(command);
            return {};
          },
        }),
      });

      assert.equal(emailDeliveryClient?.provider, "ses");

      await emailDeliveryClient?.sendTextEmail({
        from: "noreply@roomflow.app",
        to: ["lead@example.com"],
        subject: "Subject",
        text: "Body",
      });
    },
  );

  assert.equal(capturedCommands.length, 1);

  const commandInput = capturedCommands[0]?.input;

  assert.equal(commandInput?.FromEmailAddress, "noreply@roomflow.app");
  assert.deepEqual(commandInput?.Destination?.ToAddresses, ["lead@example.com"]);
  assert.equal(commandInput?.Content?.Simple?.Subject?.Data, "Subject");
  assert.equal(commandInput?.Content?.Simple?.Body?.Text?.Data, "Body");
  assert.equal(commandInput?.ConfigurationSetName, "roomflow-auth");
});