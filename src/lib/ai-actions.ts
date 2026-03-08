"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AuditActorType,
  MessageChannel,
  MessageDirection,
  QuestionType,
  RuleMode,
  RuleSeverity,
  TemplateType,
  WorkspaceCapability,
} from "@/generated/prisma/client";
import {
  buildAiArtifactErrorPayload,
  buildAiArtifactPayload,
  findLatestAiArtifact,
  generateHouseRules,
  generateIntakeForm,
  generateLeadAiInsights,
  generateListingAnalyzer,
  generatePortfolioInsights,
  generateTranslatedLeadMessage,
  generateWorkflowTemplate,
  houseRulesGeneratorSchema,
  intakeFormGeneratorSchema,
  listingAnalyzerSchema,
  portfolioInsightsSchema,
  workflowTemplateGeneratorSchema,
} from "@/lib/ai-assist";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import { normalizedLeadFieldKeys, type NormalizedLeadFieldKey } from "@/lib/lead-field-metadata";
import { buildLeadFieldMetadataRows } from "@/lib/lead-field-metadata-view";
import { evaluateLeadQualification, getLeadWorkflowContext } from "@/lib/lead-workflow";
import { onboardingRulePresets } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";
import { workspaceHasCapability } from "@/lib/workspace-plan";

function getRedirectPath(formData: FormData, fallbackPath: string) {
  const redirectValue = formData.get("redirectTo");

  return typeof redirectValue === "string" && redirectValue.length > 0
    ? redirectValue
    : fallbackPath;
}

function revalidateAiPaths(params: {
  leadId?: string;
  propertyId?: string;
}) {
  revalidatePath("/app");
  revalidatePath("/app/inbox");
  revalidatePath("/app/templates");
  revalidatePath("/onboarding/house-rules");

  if (params.leadId) {
    revalidatePath(`/app/leads/${params.leadId}`);
  }

  if (params.propertyId) {
    revalidatePath(`/app/properties/${params.propertyId}`);
    revalidatePath(`/app/properties/${params.propertyId}/questions`);
    revalidatePath(`/app/properties/${params.propertyId}/rules`);
  }
}

async function getAiActionContext() {
  const membership = await getCurrentWorkspaceMembership();

  if (
    !workspaceHasCapability(
      membership.workspace.enabledCapabilities,
      WorkspaceCapability.AI_ASSIST,
    )
  ) {
    throw new Error("AI Assist is not enabled for this workspace.");
  }

  return membership;
}

async function createAiAuditEvent(params: {
  workspaceId: string;
  actorUserId: string;
  leadId?: string;
  propertyId?: string;
  payload: unknown;
}) {
  await prisma.auditEvent.create({
    data: {
      workspaceId: params.workspaceId,
      leadId: params.leadId,
      propertyId: params.propertyId,
      actorUserId: params.actorUserId,
      actorType: AuditActorType.USER,
      eventType: "ai_artifact_generated",
      payload: params.payload as never,
    },
  });
}

function formatAnswerValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return JSON.stringify(value);
}

function coerceBoolean(value: string) {
  const normalizedValue = value.trim().toLowerCase();

  if (["yes", "true", "1", "y"].includes(normalizedValue)) {
    return true;
  }

  if (["no", "false", "0", "n"].includes(normalizedValue)) {
    return false;
  }

  return null;
}

function parseLeadFieldReviewValue(fieldKey: NormalizedLeadFieldKey, rawValue: string) {
  const trimmedValue = rawValue.trim();

  switch (fieldKey) {
    case "monthlyBudget":
    case "stayLengthMonths": {
      const parsedNumber = Number.parseInt(trimmedValue, 10);
      return Number.isFinite(parsedNumber) ? parsedNumber : null;
    }
    case "moveInDate": {
      const parsedDate = new Date(trimmedValue);
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }
    case "smokingStatus":
    case "petStatus":
    case "parkingNeed":
    case "bathroomSharingAcceptance": {
      return coerceBoolean(trimmedValue);
    }
    default:
      return trimmedValue || null;
  }
}

async function upsertLeadFieldReview(params: {
  leadId: string;
  workspaceId: string;
  fieldKey: NormalizedLeadFieldKey;
  action: "accept" | "edit" | "reject";
  editedValue: string | null;
  actorUserId: string;
}) {
  const lead = await prisma.lead.findFirst({
    where: {
      id: params.leadId,
      workspaceId: params.workspaceId,
    },
    include: {
      property: {
        include: {
          questionSets: {
            include: {
              questions: true,
            },
          },
        },
      },
    },
  });

  if (!lead) {
    throw new Error("Lead not found.");
  }

  const metadataRows = buildLeadFieldMetadataRows(lead.fieldMetadata);
  const targetMetadataRow = metadataRows.find((row) => row.key === params.fieldKey);

  if (!targetMetadataRow) {
    throw new Error(`No extracted field metadata exists for ${params.fieldKey}.`);
  }

  const nextMetadata = {
    ...(typeof lead.fieldMetadata === "object" && lead.fieldMetadata ? lead.fieldMetadata : {}),
  } as Record<string, unknown>;
  const currentEntry = nextMetadata[params.fieldKey] as Record<string, unknown> | undefined;

  if (params.action === "reject") {
    nextMetadata[params.fieldKey] = {
      ...(currentEntry ?? {}),
      isSuggested: false,
      isConflicted: false,
      source: "operator_rejected",
      lastUpdatedAt: new Date().toISOString(),
    };

    await prisma.lead.update({
      where: {
        id: lead.id,
      },
      data: {
        fieldMetadata: nextMetadata as never,
      },
    });
    return;
  }

  const sourceValue = params.action === "edit" ? params.editedValue ?? "" : targetMetadataRow.value;
  const nextValue = parseLeadFieldReviewValue(params.fieldKey, sourceValue);

  nextMetadata[params.fieldKey] = {
    ...(currentEntry ?? {}),
    value: nextValue,
    isSuggested: false,
    isConflicted: false,
    source: params.action === "edit" ? "operator_edited" : "operator_accepted",
    confidence: 1,
    lastUpdatedAt: new Date().toISOString(),
  };

  const leadUpdateData: Record<string, unknown> = {
    fieldMetadata: nextMetadata as never,
    lastActivityAt: new Date(),
  };

  switch (params.fieldKey) {
    case "fullName":
    case "email":
    case "phone":
    case "workStatus":
      leadUpdateData[params.fieldKey] = nextValue;
      break;
    case "moveInDate":
      leadUpdateData.moveInDate = nextValue;
      break;
    case "monthlyBudget":
      leadUpdateData.monthlyBudget = nextValue;
      break;
    case "stayLengthMonths":
      leadUpdateData.stayLengthMonths = nextValue;
      break;
    default:
      break;
  }

  await prisma.lead.update({
    where: {
      id: lead.id,
    },
    data: leadUpdateData as never,
  });

  const matchingQuestion = lead.property?.questionSets
    .flatMap((questionSet) => questionSet.questions)
    .find((question) => question.fieldKey === params.fieldKey);

  if (matchingQuestion) {
    await prisma.qualificationAnswer.upsert({
      where: {
        leadId_questionId: {
          leadId: lead.id,
          questionId: matchingQuestion.id,
        },
      },
      update: {
        value: nextValue as never,
      },
      create: {
        leadId: lead.id,
        questionId: matchingQuestion.id,
        value: nextValue as never,
      },
    });
  }

  await prisma.auditEvent.create({
    data: {
      workspaceId: params.workspaceId,
      leadId: lead.id,
      actorUserId: params.actorUserId,
      actorType: AuditActorType.USER,
      eventType: "lead_field_reviewed",
      payload: {
        action: params.action,
        fieldKey: params.fieldKey,
        value: nextValue,
      } as never,
    },
  });
}

export async function reviewLeadFieldSuggestionAction(leadId: string, formData: FormData) {
  const membership = await getAiActionContext();
  const redirectPath = getRedirectPath(formData, `/app/leads/${leadId}`);
  const fieldKey = formData.get("fieldKey");
  const reviewAction = formData.get("reviewAction");
  const editedValue = formData.get("editedValue");

  if (
    typeof fieldKey !== "string" ||
    !normalizedLeadFieldKeys.includes(fieldKey as NormalizedLeadFieldKey) ||
    (reviewAction !== "accept" && reviewAction !== "edit" && reviewAction !== "reject")
  ) {
    throw new Error("Invalid lead field review request.");
  }

  await upsertLeadFieldReview({
    action: reviewAction,
    actorUserId: membership.userId,
    editedValue: typeof editedValue === "string" ? editedValue : null,
    fieldKey: fieldKey as NormalizedLeadFieldKey,
    leadId,
    workspaceId: membership.workspaceId,
  });

  revalidateAiPaths({ leadId });
  redirect(redirectPath);
}

export async function generateLeadInsightsAction(leadId: string, formData: FormData) {
  const membership = await getAiActionContext();
  const redirectPath = getRedirectPath(formData, `/app/leads/${leadId}`);

  try {
    const lead = await getLeadWorkflowContext(membership.workspaceId, leadId);

    if (!lead) {
      throw new Error("Lead not found.");
    }

    const evaluation = evaluateLeadQualification(lead);
    const latestMessages = (lead.conversation?.messages ?? [])
      .slice(-5)
      .map(
        (message) =>
          `${message.channel} ${message.direction}: ${message.body.slice(0, 280)}`,
      );
    const latestPossibleDuplicateEvent = [...lead.auditEvents]
      .reverse()
      .find((auditEvent) => auditEvent.eventType === "possible_duplicate_flagged");
    const generatedInsights = await generateLeadAiInsights({
      duplicateContext: latestPossibleDuplicateEvent
        ? JSON.stringify(latestPossibleDuplicateEvent.payload)
        : null,
      evaluationIssues: evaluation.issues.map((issue) => `${issue.label}: ${issue.detail}`),
      evaluationSummary: evaluation.summary,
      fit: lead.fitResult,
      isStale: lead.isStale,
      latestMessages,
      leadName: lead.fullName,
      propertyName: lead.property?.name ?? "Unassigned",
      qualificationAnswers: lead.answers.map(
        (answer) => `${answer.question.label}: ${formatAnswerValue(answer.value)}`,
      ),
      source: lead.leadSource?.name ?? "Manual",
      status: lead.status,
      workspaceName: lead.workspace.name,
    });

    await createAiAuditEvent({
      actorUserId: membership.userId,
      leadId,
      payload: buildAiArtifactPayload("lead_insights", generatedInsights),
      workspaceId: membership.workspaceId,
    });
  } catch (error) {
    await createAiAuditEvent({
      actorUserId: membership.userId,
      leadId,
      payload: buildAiArtifactErrorPayload("lead_insights", error),
      workspaceId: membership.workspaceId,
    });
  }

  revalidateAiPaths({ leadId });
  redirect(redirectPath);
}

export async function generateLeadTranslationAction(leadId: string, formData: FormData) {
  const membership = await getAiActionContext();
  const redirectPath = getRedirectPath(formData, `/app/leads/${leadId}`);
  const targetLanguage = formData.get("targetLanguage");
  const sourceText = formData.get("sourceText");
  const sourceSummary = formData.get("sourceSummary");

  if (
    typeof targetLanguage !== "string" ||
    typeof sourceText !== "string" ||
    typeof sourceSummary !== "string"
  ) {
    throw new Error("Invalid translation request.");
  }

  try {
    const generatedTranslation = await generateTranslatedLeadMessage({
      sourceSummary,
      sourceText,
      targetLanguage,
    });

    await createAiAuditEvent({
      actorUserId: membership.userId,
      leadId,
      payload: buildAiArtifactPayload("translation", generatedTranslation),
      workspaceId: membership.workspaceId,
    });
  } catch (error) {
    await createAiAuditEvent({
      actorUserId: membership.userId,
      leadId,
      payload: buildAiArtifactErrorPayload("translation", error),
      workspaceId: membership.workspaceId,
    });
  }

  revalidateAiPaths({ leadId });
  redirect(redirectPath);
}

export async function generatePropertyListingAnalyzerAction(
  propertyId: string,
  formData: FormData,
) {
  const membership = await getAiActionContext();
  const redirectPath = getRedirectPath(formData, `/app/properties/${propertyId}`);

  try {
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        workspaceId: membership.workspaceId,
      },
      include: {
        rules: true,
        questionSets: {
          include: {
            questions: true,
          },
        },
        leads: {
          select: {
            createdAt: true,
          },
        },
      },
    });

    if (!property) {
      throw new Error("Property not found.");
    }

    const generatedAnalysis = await generateListingAnalyzer({
      activeRuleCount: property.rules.filter((rule) => rule.active).length,
      inquiryCount: property.leads.length,
      locality: property.locality,
      propertyName: property.name,
      propertyType: property.propertyType,
      qualificationRateLabel:
        property.leads.length === 0
          ? "No inquiries yet"
          : `${Math.round((property.leads.length / Math.max(property.leads.length, 1)) * 100)}%`,
      questionCount: property.questionSets.reduce(
        (totalCount, questionSet) => totalCount + questionSet.questions.length,
        0,
      ),
      topLeadSourceName: property.listingSourceName ?? "Manual",
      tourConversionRateLabel: property.schedulingUrl ? "Scheduling configured" : "Scheduling missing",
    });

    await createAiAuditEvent({
      actorUserId: membership.userId,
      payload: buildAiArtifactPayload("listing_analyzer", generatedAnalysis),
      propertyId,
      workspaceId: membership.workspaceId,
    });
  } catch (error) {
    await createAiAuditEvent({
      actorUserId: membership.userId,
      payload: buildAiArtifactErrorPayload("listing_analyzer", error),
      propertyId,
      workspaceId: membership.workspaceId,
    });
  }

  revalidateAiPaths({ propertyId });
  redirect(redirectPath);
}

export async function generatePropertyHouseRulesAction(
  propertyId: string,
  formData: FormData,
) {
  const membership = await getAiActionContext();
  const redirectPath = getRedirectPath(formData, `/app/properties/${propertyId}`);

  try {
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        workspaceId: membership.workspaceId,
      },
      include: {
        rules: true,
      },
    });

    if (!property) {
      throw new Error("Property not found.");
    }

    const generatedRules = await generateHouseRules({
      activeRooms: property.rentableRoomCount ?? 0,
      amenities: [
        property.parkingAvailable ? "Parking available" : "No parking",
        property.smokingAllowed ? "Smoking allowed" : "No smoking",
        property.petsAllowed ? "Pets allowed" : "No pets",
      ],
      existingRules: property.rules.map((rule) => `${rule.label}: ${rule.description ?? ""}`),
      locality: property.locality,
      propertyName: property.name,
    });

    await createAiAuditEvent({
      actorUserId: membership.userId,
      payload: buildAiArtifactPayload("house_rules_generator", generatedRules),
      propertyId,
      workspaceId: membership.workspaceId,
    });
  } catch (error) {
    await createAiAuditEvent({
      actorUserId: membership.userId,
      payload: buildAiArtifactErrorPayload("house_rules_generator", error),
      propertyId,
      workspaceId: membership.workspaceId,
    });
  }

  revalidateAiPaths({ propertyId });
  redirect(redirectPath);
}

export async function applyPropertyHouseRulesAction(
  propertyId: string,
  formData: FormData,
) {
  const membership = await getAiActionContext();
  const redirectPath = getRedirectPath(formData, `/app/properties/${propertyId}`);
  const auditEvents = await prisma.auditEvent.findMany({
    where: {
      workspaceId: membership.workspaceId,
      propertyId,
      eventType: "ai_artifact_generated",
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      createdAt: true,
      eventType: true,
      payload: true,
    },
  });
  const latestArtifact = findLatestAiArtifact({
    artifactKind: "house_rules_generator",
    auditEvents,
    schema: houseRulesGeneratorSchema,
  });

  if (!latestArtifact || latestArtifact.status !== "ready") {
    throw new Error("No generated house rules are available to apply.");
  }

  await prisma.propertyRule.deleteMany({
    where: {
      propertyId,
    },
  });

  if (latestArtifact.data.rules.length > 0) {
    await prisma.propertyRule.createMany({
      data: latestArtifact.data.rules.map((rule) => ({
        active: true,
        autoDecline: rule.severity === RuleSeverity.REQUIRED,
        category: rule.category,
        description: rule.description,
        label: rule.label,
        mode:
          rule.severity === RuleSeverity.PREFERENCE
            ? RuleMode.INFORMATIONAL
            : rule.severity === RuleSeverity.WARNING
              ? RuleMode.WARNING_ONLY
              : RuleMode.BLOCKING,
        propertyId,
        severity: rule.severity,
        warningOnly: rule.severity === RuleSeverity.WARNING,
      })),
    });
  }

  revalidateAiPaths({ propertyId });
  redirect(redirectPath);
}

export async function generatePropertyIntakeFormAction(
  propertyId: string,
  formData: FormData,
) {
  const membership = await getAiActionContext();
  const redirectPath = getRedirectPath(formData, `/app/properties/${propertyId}/questions`);

  try {
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        workspaceId: membership.workspaceId,
      },
      include: {
        rules: true,
        questionSets: {
          include: {
            questions: true,
          },
        },
      },
    });

    if (!property) {
      throw new Error("Property not found.");
    }

    const generatedForm = await generateIntakeForm({
      activeRules: property.rules
        .filter((rule) => rule.active)
        .map((rule) => `${rule.label}: ${rule.description ?? ""}`),
      existingQuestions: property.questionSets.flatMap((set) =>
        set.questions.map((question) => question.label),
      ),
      locality: property.locality,
      propertyName: property.name,
    });

    await createAiAuditEvent({
      actorUserId: membership.userId,
      payload: buildAiArtifactPayload("intake_form_generator", generatedForm),
      propertyId,
      workspaceId: membership.workspaceId,
    });
  } catch (error) {
    await createAiAuditEvent({
      actorUserId: membership.userId,
      payload: buildAiArtifactErrorPayload("intake_form_generator", error),
      propertyId,
      workspaceId: membership.workspaceId,
    });
  }

  revalidateAiPaths({ propertyId });
  redirect(redirectPath);
}

export async function applyPropertyIntakeFormAction(
  propertyId: string,
  formData: FormData,
) {
  const membership = await getAiActionContext();
  const redirectPath = getRedirectPath(formData, `/app/properties/${propertyId}/questions`);
  const auditEvents = await prisma.auditEvent.findMany({
    where: {
      workspaceId: membership.workspaceId,
      propertyId,
      eventType: "ai_artifact_generated",
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      createdAt: true,
      eventType: true,
      payload: true,
    },
  });
  const latestArtifact = findLatestAiArtifact({
    artifactKind: "intake_form_generator",
    auditEvents,
    schema: intakeFormGeneratorSchema,
  });

  if (!latestArtifact || latestArtifact.status !== "ready") {
    throw new Error("No generated intake form is available to apply.");
  }

  const questionSet = await prisma.qualificationQuestionSet.create({
    data: {
      isDefault: false,
      name: latestArtifact.data.setName,
      propertyId,
    },
  });

  if (latestArtifact.data.questions.length > 0) {
    await prisma.qualificationQuestion.createMany({
      data: latestArtifact.data.questions.map((question, index) => ({
        fieldKey: question.fieldKey,
        label: question.label,
        questionSetId: questionSet.id,
        required: question.required,
        sortOrder: index,
        type: question.type as QuestionType,
      })),
      skipDuplicates: true,
    });
  }

  revalidateAiPaths({ propertyId });
  redirect(redirectPath);
}

export async function generateWorkflowTemplateAction(formData: FormData) {
  const membership = await getAiActionContext();
  const redirectPath = getRedirectPath(formData, "/app/templates");

  try {
    const [sampleLead, sampleProperty] = await Promise.all([
      prisma.lead.findFirst({
        where: {
          workspaceId: membership.workspaceId,
        },
        include: {
          property: true,
          conversation: {
            include: {
              messages: {
                orderBy: {
                  createdAt: "desc",
                },
                take: 2,
              },
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      }),
      prisma.property.findFirst({
        where: {
          workspaceId: membership.workspaceId,
        },
        orderBy: {
          updatedAt: "desc",
        },
      }),
    ]);

    const generatedTemplate = await generateWorkflowTemplate({
      propertyName: sampleProperty?.name ?? sampleLead?.property?.name ?? null,
      recentLeadSummary:
        sampleLead?.conversation?.messages.map((message) => message.body).join(" | ") ??
        "No recent conversation history available.",
      workspaceName: membership.workspace.name,
    });

    await createAiAuditEvent({
      actorUserId: membership.userId,
      payload: buildAiArtifactPayload("workflow_template_generator", generatedTemplate),
      workspaceId: membership.workspaceId,
    });
  } catch (error) {
    await createAiAuditEvent({
      actorUserId: membership.userId,
      payload: buildAiArtifactErrorPayload("workflow_template_generator", error),
      workspaceId: membership.workspaceId,
    });
  }

  revalidateAiPaths({});
  redirect(redirectPath);
}

export async function applyWorkflowTemplateAction(formData: FormData) {
  const membership = await getAiActionContext();
  const redirectPath = getRedirectPath(formData, "/app/templates");
  const auditEvents = await prisma.auditEvent.findMany({
    where: {
      workspaceId: membership.workspaceId,
      eventType: "ai_artifact_generated",
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      createdAt: true,
      eventType: true,
      payload: true,
    },
  });
  const latestArtifact = findLatestAiArtifact({
    artifactKind: "workflow_template_generator",
    auditEvents,
    schema: workflowTemplateGeneratorSchema,
  });

  if (!latestArtifact || latestArtifact.status !== "ready") {
    throw new Error("No generated workflow template is available to apply.");
  }

  await prisma.messageTemplate.create({
    data: {
      body: latestArtifact.data.body,
      channel: latestArtifact.data.channel === "EMAIL" ? MessageChannel.EMAIL : MessageChannel.SMS,
      name: latestArtifact.data.name,
      subject: latestArtifact.data.subject ?? null,
      type: latestArtifact.data.type as TemplateType,
      workspaceId: membership.workspaceId,
    },
  });

  revalidateAiPaths({});
  redirect(redirectPath);
}

export async function generatePortfolioInsightsAction(formData: FormData) {
  const membership = await getAiActionContext();
  const redirectPath = getRedirectPath(formData, "/app");

  try {
    const [properties, staleLeads] = await Promise.all([
      prisma.property.findMany({
        where: {
          workspaceId: membership.workspaceId,
        },
        include: {
          _count: {
            select: {
              leads: true,
              questionSets: true,
              rules: true,
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      }),
      prisma.lead.findMany({
        where: {
          workspaceId: membership.workspaceId,
          isStale: true,
        },
        orderBy: {
          staleAt: "desc",
        },
        take: 8,
      }),
    ]);

    const generatedInsights = await generatePortfolioInsights({
      propertySummaries: properties.map(
        (property) =>
          `${property.name}: ${property._count.leads} leads, ${property._count.rules} rules, ${property._count.questionSets} question sets`,
      ),
      staleLeadSummary: staleLeads.map(
        (lead) => `${lead.fullName}: ${lead.status}, stale reason ${lead.staleReason ?? "unknown"}`,
      ),
      workspaceName: membership.workspace.name,
    });

    await createAiAuditEvent({
      actorUserId: membership.userId,
      payload: buildAiArtifactPayload("portfolio_insights", generatedInsights),
      workspaceId: membership.workspaceId,
    });
  } catch (error) {
    await createAiAuditEvent({
      actorUserId: membership.userId,
      payload: buildAiArtifactErrorPayload("portfolio_insights", error),
      workspaceId: membership.workspaceId,
    });
  }

  revalidateAiPaths({});
  redirect(redirectPath);
}
