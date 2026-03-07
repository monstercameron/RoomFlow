type DeliveryState =
  | "queued"
  | "scheduled"
  | "received"
  | "sent"
  | "provider_unresolved"
  | "failed"
  | "retrying";

export type DeliveryStatusPayload = {
  state: DeliveryState;
  provider?: string | null;
  retryCount?: number;
  error?: string | null;
  updatedAt: string;
};

export function serializeDeliveryStatus(
  input: Omit<DeliveryStatusPayload, "updatedAt"> & { updatedAt?: string },
) {
  return JSON.stringify({
    ...input,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  } satisfies DeliveryStatusPayload);
}

export function parseDeliveryStatus(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as DeliveryStatusPayload;
  } catch {
    return {
      state: "sent",
      provider: null,
      retryCount: 0,
      error: null,
      updatedAt: new Date(0).toISOString(),
    } satisfies DeliveryStatusPayload;
  }
}
