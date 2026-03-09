import {
  SESv2Client,
  SendEmailCommand,
  type SESv2ClientConfig,
} from "@aws-sdk/client-sesv2";
import { Resend } from "resend";
import type { TextEmailPayload } from "@/lib/email-types";
import { storeMockEmailMessage } from "@/lib/mock-email-service";

export type EmailDeliveryProvider = "mock" | "resend" | "ses";

type ResendClientLike = {
  emails: {
    send: (payload: TextEmailPayload) => Promise<unknown>;
  };
};

type SesClientLike = {
  send: (command: SendEmailCommand) => Promise<unknown>;
};

export type EmailDeliveryClient = {
  provider: EmailDeliveryProvider;
  sendTextEmail: (payload: TextEmailPayload) => Promise<void>;
};

export type EmailDeliveryDependencies = {
  storeMockEmailMessage: typeof storeMockEmailMessage;
  createResendClient: (apiKey: string) => ResendClientLike;
  createSesClient: (config: SESv2ClientConfig) => SesClientLike;
};

const defaultEmailDeliveryDependencies: EmailDeliveryDependencies = {
  storeMockEmailMessage,
  createResendClient: (apiKey) => new Resend(apiKey),
  createSesClient: (config) => new SESv2Client(config),
};

function readConfiguredValue(...candidateValues: Array<string | undefined>) {
  for (const candidateValue of candidateValues) {
    if (!candidateValue) {
      continue;
    }

    const trimmedValue = candidateValue.trim();

    if (trimmedValue.length > 0 && trimmedValue !== "replace-me") {
      return trimmedValue;
    }
  }

  return null;
}

function getConfiguredSesClientConfig(): SESv2ClientConfig | null {
  const region = readConfiguredValue(process.env.AWS_REGION, process.env.AWS_DEFAULT_REGION);

  if (!region) {
    return null;
  }

  const accessKeyId = readConfiguredValue(process.env.AWS_ACCESS_KEY_ID);
  const secretAccessKey = readConfiguredValue(process.env.AWS_SECRET_ACCESS_KEY);
  const sessionToken = readConfiguredValue(process.env.AWS_SESSION_TOKEN);
  const endpoint = readConfiguredValue(process.env.SES_ENDPOINT);
  const clientConfig: SESv2ClientConfig = {
    region,
    ...(endpoint ? { endpoint } : {}),
  };

  if (accessKeyId && secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    };
  }

  return clientConfig;
}

function getConfiguredResendApiKey() {
  return readConfiguredValue(process.env.RESEND_API_KEY);
}

function getConfiguredSesConfigurationSetName() {
  return readConfiguredValue(process.env.SES_CONFIGURATION_SET_NAME);
}

export function getConfiguredEmailDeliveryProvider(): EmailDeliveryProvider {
  const configuredProvider = process.env.EMAIL_DELIVERY_PROVIDER?.trim().toLowerCase();

  if (configuredProvider === "ses") {
    return "ses";
  }

  if (configuredProvider === "mock") {
    return "mock";
  }

  return "resend";
}

export function getConfiguredEmailDeliveryProviderLabel() {
  const provider = getConfiguredEmailDeliveryProvider();

  return provider === "ses"
    ? "Amazon SES"
    : provider === "mock"
      ? "Local mock email"
      : "Resend";
}

export function getConfiguredSenderEmailAddress() {
  const provider = getConfiguredEmailDeliveryProvider();

  return provider === "ses"
    ? readConfiguredValue(process.env.EMAIL_FROM_ADDRESS, process.env.SES_FROM_EMAIL)
    : provider === "mock"
      ? readConfiguredValue(process.env.EMAIL_FROM_ADDRESS, process.env.MOCK_EMAIL_FROM_ADDRESS) ?? "noreply@roomflow.local"
      : readConfiguredValue(process.env.EMAIL_FROM_ADDRESS, process.env.RESEND_FROM_EMAIL);
}

export function getMissingEmailDeliveryConfigurationKeys() {
  const provider = getConfiguredEmailDeliveryProvider();
  const missingConfigurationKeys: string[] = [];

  if (!getConfiguredSenderEmailAddress()) {
    missingConfigurationKeys.push(
      provider === "ses"
        ? "EMAIL_FROM_ADDRESS or SES_FROM_EMAIL"
        : provider === "mock"
          ? "EMAIL_FROM_ADDRESS or MOCK_EMAIL_FROM_ADDRESS"
        : "EMAIL_FROM_ADDRESS or RESEND_FROM_EMAIL",
    );
  }

  if (provider === "mock") {
    return missingConfigurationKeys.filter((key) => !key.includes("MOCK_EMAIL_FROM_ADDRESS"));
  }

  if (provider === "ses") {
    if (!readConfiguredValue(process.env.AWS_REGION, process.env.AWS_DEFAULT_REGION)) {
      missingConfigurationKeys.push("AWS_REGION or AWS_DEFAULT_REGION");
    }
  } else if (!getConfiguredResendApiKey()) {
    missingConfigurationKeys.push("RESEND_API_KEY");
  }

  return missingConfigurationKeys;
}

export function getConfiguredEmailDeliveryClient(
  dependencies: EmailDeliveryDependencies = defaultEmailDeliveryDependencies,
): EmailDeliveryClient | null {
  const provider = getConfiguredEmailDeliveryProvider();

  if (provider === "mock") {
    return {
      provider: "mock",
      async sendTextEmail(payload) {
        await dependencies.storeMockEmailMessage(payload);
      },
    };
  }

  if (provider === "ses") {
    const sesClientConfig = getConfiguredSesClientConfig();

    if (!sesClientConfig) {
      return null;
    }

    const sesClient = dependencies.createSesClient(sesClientConfig);
    const configurationSetName = getConfiguredSesConfigurationSetName();

    return {
      provider: "ses",
      async sendTextEmail(payload) {
        await sesClient.send(
          new SendEmailCommand({
            FromEmailAddress: payload.from,
            Destination: {
              ToAddresses: payload.to,
            },
            Content: {
              Simple: {
                Subject: {
                  Data: payload.subject,
                },
                Body: {
                  Text: {
                    Data: payload.text,
                  },
                },
              },
            },
            ...(configurationSetName
              ? {
                  ConfigurationSetName: configurationSetName,
                }
              : {}),
          }),
        );
      },
    };
  }

  const resendApiKey = getConfiguredResendApiKey();

  if (!resendApiKey) {
    return null;
  }

  const resendClient = dependencies.createResendClient(resendApiKey);

  return {
    provider: "resend",
    async sendTextEmail(payload) {
      await resendClient.emails.send(payload);
    },
  };
}