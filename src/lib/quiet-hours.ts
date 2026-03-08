export type QuietHoursConfig = {
  startLocal: string;
  endLocal: string;
  timeZone: string;
};

export type EffectiveQuietHours = {
  source: "workspace" | "property";
  config: QuietHoursConfig;
};

function parseLocalTime(localTimeValue: string) {
  if (!/^\d{2}:\d{2}$/.test(localTimeValue)) {
    throw new Error("Quiet hours must use HH:MM format.");
  }

  const [hourValue, minuteValue] = localTimeValue.split(":").map(Number);

  if (
    !Number.isInteger(hourValue) ||
    !Number.isInteger(minuteValue) ||
    hourValue < 0 ||
    hourValue > 23 ||
    minuteValue < 0 ||
    minuteValue > 59
  ) {
    throw new Error("Quiet hours must use a valid 24-hour time.");
  }

  return hourValue * 60 + minuteValue;
}

export function isValidQuietHoursTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function validateQuietHoursConfig(config: QuietHoursConfig) {
  const startMinutes = parseLocalTime(config.startLocal);
  const endMinutes = parseLocalTime(config.endLocal);

  if (!isValidQuietHoursTimeZone(config.timeZone)) {
    throw new Error("Quiet hours time zone must be a valid IANA time zone.");
  }

  if (startMinutes === endMinutes) {
    throw new Error("Quiet hours start and end must be different.");
  }

  return {
    ...config,
    startMinutes,
    endMinutes,
  };
}

function getLocalMinutes(referenceTime: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(referenceTime);
  const hourValue = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minuteValue = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );

  return hourValue * 60 + minuteValue;
}

export function isWithinQuietHours(params: {
  quietHours: QuietHoursConfig;
  referenceTime: Date;
}) {
  const validatedQuietHours = validateQuietHoursConfig(params.quietHours);
  const localMinutes = getLocalMinutes(
    params.referenceTime,
    validatedQuietHours.timeZone,
  );

  if (validatedQuietHours.startMinutes < validatedQuietHours.endMinutes) {
    return (
      localMinutes >= validatedQuietHours.startMinutes &&
      localMinutes < validatedQuietHours.endMinutes
    );
  }

  return (
    localMinutes >= validatedQuietHours.startMinutes ||
    localMinutes < validatedQuietHours.endMinutes
  );
}

export function resolveEffectiveQuietHours(params: {
  workspaceQuietHoursStartLocal: string | null | undefined;
  workspaceQuietHoursEndLocal: string | null | undefined;
  workspaceQuietHoursTimeZone: string | null | undefined;
  propertyQuietHoursStartLocal?: string | null | undefined;
  propertyQuietHoursEndLocal?: string | null | undefined;
  propertyQuietHoursTimeZone?: string | null | undefined;
}) {
  if (
    params.propertyQuietHoursStartLocal &&
    params.propertyQuietHoursEndLocal &&
    params.propertyQuietHoursTimeZone
  ) {
    return {
      source: "property",
      config: {
        startLocal: params.propertyQuietHoursStartLocal,
        endLocal: params.propertyQuietHoursEndLocal,
        timeZone: params.propertyQuietHoursTimeZone,
      },
    } satisfies EffectiveQuietHours;
  }

  if (
    params.workspaceQuietHoursStartLocal &&
    params.workspaceQuietHoursEndLocal &&
    params.workspaceQuietHoursTimeZone
  ) {
    return {
      source: "workspace",
      config: {
        startLocal: params.workspaceQuietHoursStartLocal,
        endLocal: params.workspaceQuietHoursEndLocal,
        timeZone: params.workspaceQuietHoursTimeZone,
      },
    } satisfies EffectiveQuietHours;
  }

  return null;
}

export function formatQuietHours(config: QuietHoursConfig | null) {
  if (!config) {
    return "Disabled";
  }

  return `${config.startLocal} to ${config.endLocal} (${config.timeZone})`;
}