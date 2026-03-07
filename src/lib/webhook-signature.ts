import { createHmac, timingSafeEqual } from "node:crypto";

function normalizeHexSignature(signatureValue: string) {
  return signatureValue.trim().toLowerCase().replace(/^sha256=/, "");
}

export function buildWebhookSignature(rawBody: string, signingSecret: string) {
  return createHmac("sha256", signingSecret).update(rawBody).digest("hex");
}

export function verifyIncomingWebhookSignature(params: {
  rawBody: string;
  providedSignature: string | null | undefined;
  signingSecret: string | null | undefined;
}) {
  if (!params.signingSecret) {
    return true;
  }

  if (!params.providedSignature) {
    return false;
  }

  const expectedSignature = buildWebhookSignature(
    params.rawBody,
    params.signingSecret,
  );
  const normalizedProvidedSignature = normalizeHexSignature(
    params.providedSignature,
  );

  if (normalizedProvidedSignature.length !== expectedSignature.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(normalizedProvidedSignature, "utf8"),
      Buffer.from(expectedSignature, "utf8"),
    );
  } catch {
    return false;
  }
}
