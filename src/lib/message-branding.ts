import { MessageChannel, TemplateType } from "@/generated/prisma/client";

type MessageBrandingLeadContext = {
  fullName: string;
  property: {
    name: string;
    schedulingUrl: string | null;
  } | null;
  workspace: {
    name: string;
  };
};

const structuredTemplateTypes = new Set<TemplateType>([
  TemplateType.SCREENING_INVITE,
  TemplateType.TOUR_INVITE,
  TemplateType.APPLICATION_INVITE,
  TemplateType.HOUSE_RULES_ACKNOWLEDGMENT,
  TemplateType.ONBOARDING,
  TemplateType.DECLINE,
  TemplateType.WAITLIST_NOTICE,
]);

function buildStructuredMessageSections(params: {
  type: TemplateType;
  lead: MessageBrandingLeadContext;
}) {
  const propertyName = params.lead.property?.name ?? "this property";
  const schedulingUrl =
    params.lead.property?.schedulingUrl ?? "Scheduling link pending";

  switch (params.type) {
    case TemplateType.SCREENING_INVITE:
      return [
        "What I need",
        "- Target move-in timing",
        "- Monthly budget",
        "- Shared-house rule confirmation",
      ];
    case TemplateType.TOUR_INVITE:
      return ["Property", propertyName, "Next step", `Choose a tour time: ${schedulingUrl}`];
    case TemplateType.APPLICATION_INVITE:
      return [
        "Property",
        propertyName,
        "Next step",
        `Complete the application for ${propertyName} and reply once it is submitted.`,
      ];
    case TemplateType.HOUSE_RULES_ACKNOWLEDGMENT:
      return [
        "Property",
        propertyName,
        "Please confirm",
        "- Quiet hours and shared-space expectations work for you",
        "- The current house rules still match your needs",
      ];
    case TemplateType.ONBOARDING:
      return [
        "Property",
        propertyName,
        "What happens next",
        "- Review your onboarding checklist",
        "- Confirm your move-in logistics",
      ];
    case TemplateType.DECLINE:
      return ["Listing", propertyName, "Need a different fit?", "Reply if you want updates about future openings."];
    case TemplateType.WAITLIST_NOTICE:
      return [
        "Listing",
        propertyName,
        "What happens next",
        "I will keep your inquiry active and reach out if availability changes.",
      ];
    default:
      return [];
  }
}

export function formatBrandedMessageForLead(params: {
  body: string;
  channel: MessageChannel;
  type: TemplateType;
  lead: MessageBrandingLeadContext;
}) {
  if (!structuredTemplateTypes.has(params.type)) {
    return params.body;
  }

  if (params.channel === MessageChannel.SMS) {
    return `${params.lead.workspace.name}: ${params.body.trim()}`;
  }

  const firstName = params.lead.fullName.split(" ")[0] || params.lead.fullName;
  const structuredSections = buildStructuredMessageSections({
    type: params.type,
    lead: params.lead,
  });
  const formattedLines = [`Hi ${firstName},`, "", params.body.trim()];

  if (structuredSections.length > 0) {
    formattedLines.push("", ...structuredSections);
  }

  formattedLines.push(
    "",
    "Thanks,",
    `${params.lead.workspace.name} leasing desk`,
  );

  return formattedLines.join("\n").trim();
}