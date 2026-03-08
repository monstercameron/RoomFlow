import { Prisma } from "@/generated/prisma/client";

export const availabilityDayOptions = [
  { label: "Mon", value: "MONDAY" },
  { label: "Tue", value: "TUESDAY" },
  { label: "Wed", value: "WEDNESDAY" },
  { label: "Thu", value: "THURSDAY" },
  { label: "Fri", value: "FRIDAY" },
  { label: "Sat", value: "SATURDAY" },
  { label: "Sun", value: "SUNDAY" },
] as const;

export type AvailabilityDay = (typeof availabilityDayOptions)[number]["value"];

export type AvailabilityWindowConfig = {
  days: ReadonlyArray<AvailabilityDay>;
  endLocal: string;
  startLocal: string;
  timeZone: string;
};

const availabilityDayLabelByValue = new Map<AvailabilityDay, string>(
  availabilityDayOptions.map((option) => [option.value, option.label]),
);

export function isAvailabilityDay(value: string): value is AvailabilityDay {
  return availabilityDayOptions.some((option) => option.value === value);
}

function parseTimeToMinutes(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error("Availability times must use HH:MM format.");
  }

  const [hoursText, minutesText] = value.split(":");
  const hours = Number.parseInt(hoursText, 10);
  const minutes = Number.parseInt(minutesText, 10);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error("Availability times must use a valid 24-hour clock value.");
  }

  return hours * 60 + minutes;
}

function normalizeAvailabilityDays(values: ReadonlyArray<string>) {
  const uniqueDays = [...new Set(values)]
    .filter((value): value is AvailabilityDay => isAvailabilityDay(value))
    .sort(
      (leftDay, rightDay) =>
        availabilityDayOptions.findIndex((option) => option.value === leftDay) -
        availabilityDayOptions.findIndex((option) => option.value === rightDay),
    );

  return uniqueDays;
}

export function validateAvailabilityWindowConfig(
  config: AvailabilityWindowConfig,
) {
  if (config.days.length === 0) {
    throw new Error("Select at least one day for the availability window.");
  }

  const normalizedTimeZone = config.timeZone.trim();

  if (!normalizedTimeZone) {
    throw new Error("Availability time zone is required.");
  }

  const startMinutes = parseTimeToMinutes(config.startLocal);
  const endMinutes = parseTimeToMinutes(config.endLocal);

  if (startMinutes >= endMinutes) {
    throw new Error("Availability end time must be after the start time.");
  }

  return {
    ...config,
    days: normalizeAvailabilityDays(config.days),
    timeZone: normalizedTimeZone,
  };
}

export function parseAvailabilityWindowConfig(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const rawRecord = value as Record<string, unknown>;
  const rawDays = Array.isArray(rawRecord.days)
    ? rawRecord.days.filter((entry): entry is string => typeof entry === "string")
    : [];
  const startLocal = typeof rawRecord.startLocal === "string" ? rawRecord.startLocal : "";
  const endLocal = typeof rawRecord.endLocal === "string" ? rawRecord.endLocal : "";
  const timeZone = typeof rawRecord.timeZone === "string" ? rawRecord.timeZone : "";

  try {
    return validateAvailabilityWindowConfig({
      days: normalizeAvailabilityDays(rawDays),
      endLocal,
      startLocal,
      timeZone,
    });
  } catch {
    return null;
  }
}

export function serializeAvailabilityWindowConfig(
  config: AvailabilityWindowConfig | null,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (!config) {
    return Prisma.DbNull;
  }

  const validatedConfig = validateAvailabilityWindowConfig(config);

  return {
    days: validatedConfig.days,
    endLocal: validatedConfig.endLocal,
    startLocal: validatedConfig.startLocal,
    timeZone: validatedConfig.timeZone,
  };
}

export function formatAvailabilityWindow(config: AvailabilityWindowConfig | null) {
  if (!config) {
    return "Not configured";
  }

  const dayLabels = config.days
    .map((day) => availabilityDayLabelByValue.get(day) ?? day)
    .join(", ");

  return `${dayLabels} · ${config.startLocal} to ${config.endLocal} (${config.timeZone})`;
}

function getZonedWeekdayAndMinutes(referenceTime: Date, timeZone: string) {
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone,
  });
  const weekdayText = weekdayFormatter.format(referenceTime).toUpperCase() as AvailabilityDay;
  const timeParts = timeFormatter.formatToParts(referenceTime);
  const hourValue = timeParts.find((part) => part.type === "hour")?.value ?? "00";
  const minuteValue = timeParts.find((part) => part.type === "minute")?.value ?? "00";

  return {
    minutes: parseTimeToMinutes(`${hourValue}:${minuteValue}`),
    weekday: weekdayText,
  };
}

export function isDateTimeWithinAvailabilityWindow(params: {
  availabilityWindow: AvailabilityWindowConfig;
  referenceTime: Date;
}) {
  const validatedConfig = validateAvailabilityWindowConfig(params.availabilityWindow);
  const zonedDateTime = getZonedWeekdayAndMinutes(
    params.referenceTime,
    validatedConfig.timeZone,
  );
  const startMinutes = parseTimeToMinutes(validatedConfig.startLocal);
  const endMinutes = parseTimeToMinutes(validatedConfig.endLocal);

  return (
    validatedConfig.days.includes(zonedDateTime.weekday) &&
    zonedDateTime.minutes >= startMinutes &&
    zonedDateTime.minutes < endMinutes
  );
}