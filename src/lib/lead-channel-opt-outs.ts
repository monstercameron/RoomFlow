import { MessageChannel } from "@/generated/prisma/client";

type ChannelOptOutState = {
  optedOutAt: Date | null;
  reason: string | null;
};

export type LeadChannelOptOutSnapshot = {
  optOutAt?: Date | null;
  optOutReason?: string | null;
  emailOptOutAt?: Date | null;
  emailOptOutReason?: string | null;
  smsOptOutAt?: Date | null;
  smsOptOutReason?: string | null;
  whatsappOptOutAt?: Date | null;
  whatsappOptOutReason?: string | null;
  instagramOptOutAt?: Date | null;
  instagramOptOutReason?: string | null;
};

const directMessageChannels = [
  MessageChannel.EMAIL,
  MessageChannel.SMS,
  MessageChannel.WHATSAPP,
  MessageChannel.INSTAGRAM,
] as const;

function getChannelSpecificOptOutState(
  lead: LeadChannelOptOutSnapshot,
  channel: MessageChannel,
): ChannelOptOutState {
  switch (channel) {
    case MessageChannel.EMAIL:
      return {
        optedOutAt: lead.emailOptOutAt ?? null,
        reason: lead.emailOptOutReason ?? null,
      };
    case MessageChannel.SMS:
      return {
        optedOutAt: lead.smsOptOutAt ?? null,
        reason: lead.smsOptOutReason ?? null,
      };
    case MessageChannel.WHATSAPP:
      return {
        optedOutAt: lead.whatsappOptOutAt ?? null,
        reason: lead.whatsappOptOutReason ?? null,
      };
    case MessageChannel.INSTAGRAM:
      return {
        optedOutAt: lead.instagramOptOutAt ?? null,
        reason: lead.instagramOptOutReason ?? null,
      };
    default:
      return {
        optedOutAt: null,
        reason: null,
      };
  }
}

export function formatMessageChannelLabel(channel: MessageChannel) {
  switch (channel) {
    case MessageChannel.INTERNAL_NOTE:
      return "Internal note";
    case MessageChannel.WHATSAPP:
      return "WhatsApp";
    case MessageChannel.INSTAGRAM:
      return "Instagram";
    default:
      return channel;
  }
}

export function resolveLeadChannelOptOutState(
  lead: LeadChannelOptOutSnapshot,
  channel: MessageChannel,
): ChannelOptOutState {
  const channelSpecificState = getChannelSpecificOptOutState(lead, channel);

  if (channelSpecificState.optedOutAt) {
    return channelSpecificState;
  }

  if (
    channel !== MessageChannel.INTERNAL_NOTE &&
    lead.optOutAt &&
    !lead.emailOptOutAt &&
    !lead.smsOptOutAt &&
    !lead.whatsappOptOutAt &&
    !lead.instagramOptOutAt
  ) {
    return {
      optedOutAt: lead.optOutAt,
      reason: lead.optOutReason ?? null,
    };
  }

  return {
    optedOutAt: null,
    reason: null,
  };
}

export function isLeadChannelOptedOut(
  lead: LeadChannelOptOutSnapshot,
  channel: MessageChannel,
) {
  if (channel === MessageChannel.INTERNAL_NOTE) {
    return false;
  }

  return Boolean(resolveLeadChannelOptOutState(lead, channel).optedOutAt);
}

export function resolveLeadOptOutSummary(lead: LeadChannelOptOutSnapshot) {
  const optOutStates = directMessageChannels
    .map((channel) => ({
      channel,
      ...getChannelSpecificOptOutState(lead, channel),
    }))
    .filter((channelState) => channelState.optedOutAt);

  if (optOutStates.length === 0 && lead.optOutAt) {
    return {
      optOutAt: lead.optOutAt,
      optOutReason: lead.optOutReason ?? null,
    };
  }

  if (optOutStates.length === 0) {
    return {
      optOutAt: null,
      optOutReason: null,
    };
  }

  const latestOptOutState = [...optOutStates].sort(
    (leftState, rightState) =>
      (rightState.optedOutAt?.getTime() ?? 0) - (leftState.optedOutAt?.getTime() ?? 0),
  )[0];

  return {
    optOutAt: latestOptOutState.optedOutAt ?? null,
    optOutReason: latestOptOutState.reason ?? null,
  };
}

export function buildLeadChannelOptOutUpdate(params: {
  lead: LeadChannelOptOutSnapshot;
  channel: MessageChannel;
  isOptedOut: boolean;
  changedAt: Date;
  reason?: string | null;
}) {
  const normalizedReason = params.reason?.trim() || null;
  const nextLeadSnapshot: LeadChannelOptOutSnapshot = {
    ...params.lead,
  };

  switch (params.channel) {
    case MessageChannel.EMAIL:
      nextLeadSnapshot.emailOptOutAt = params.isOptedOut ? params.changedAt : null;
      nextLeadSnapshot.emailOptOutReason = params.isOptedOut ? normalizedReason : null;
      break;
    case MessageChannel.SMS:
      nextLeadSnapshot.smsOptOutAt = params.isOptedOut ? params.changedAt : null;
      nextLeadSnapshot.smsOptOutReason = params.isOptedOut ? normalizedReason : null;
      break;
    case MessageChannel.WHATSAPP:
      nextLeadSnapshot.whatsappOptOutAt = params.isOptedOut ? params.changedAt : null;
      nextLeadSnapshot.whatsappOptOutReason = params.isOptedOut ? normalizedReason : null;
      break;
    case MessageChannel.INSTAGRAM:
      nextLeadSnapshot.instagramOptOutAt = params.isOptedOut ? params.changedAt : null;
      nextLeadSnapshot.instagramOptOutReason = params.isOptedOut ? normalizedReason : null;
      break;
    default:
      break;
  }

  const explicitOptOutStates = directMessageChannels
    .map((channel) => getChannelSpecificOptOutState(nextLeadSnapshot, channel))
    .filter((channelState) => channelState.optedOutAt);
  const aggregateOptOutSummary =
    explicitOptOutStates.length > 0
      ? [...explicitOptOutStates].sort(
          (leftState, rightState) =>
            (rightState.optedOutAt?.getTime() ?? 0) -
            (leftState.optedOutAt?.getTime() ?? 0),
        )[0]
      : {
          optedOutAt: null,
          reason: null,
        };

  return {
    emailOptOutAt: nextLeadSnapshot.emailOptOutAt ?? null,
    emailOptOutReason: nextLeadSnapshot.emailOptOutReason ?? null,
    smsOptOutAt: nextLeadSnapshot.smsOptOutAt ?? null,
    smsOptOutReason: nextLeadSnapshot.smsOptOutReason ?? null,
    whatsappOptOutAt: nextLeadSnapshot.whatsappOptOutAt ?? null,
    whatsappOptOutReason: nextLeadSnapshot.whatsappOptOutReason ?? null,
    instagramOptOutAt: nextLeadSnapshot.instagramOptOutAt ?? null,
    instagramOptOutReason: nextLeadSnapshot.instagramOptOutReason ?? null,
    optOutAt: aggregateOptOutSummary.optedOutAt,
    optOutReason: aggregateOptOutSummary.reason,
  };
}
