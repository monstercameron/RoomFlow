import type { Prisma, RuleSeverity, TemplateType } from "@/generated/prisma/client";
import { QuestionType } from "@/generated/prisma/client";
import { z } from "zod";
import { runOpenAiRealtimeTextPrompt } from "@/lib/openai-realtime";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export const aiArtifactKinds = [
  "lead_insights",
  "translation",
  "listing_analyzer",
  "house_rules_generator",
  "intake_form_generator",
  "workflow_template_generator",
  "portfolio_insights",
] as const;

export type AiArtifactKind = (typeof aiArtifactKinds)[number];

export const storedAiArtifactSchema = z.object({
  artifactKind: z.enum(aiArtifactKinds),
  status: z.enum(["ready", "failed"]),
  payload: z.unknown().optional(),
  error: z.string().optional(),
});

export const leadAiInsightsSchema = z.object({
  summary: z.string().min(1),
  replyDraft: z.object({
    subject: z.string().trim().optional().nullable(),
    body: z.string().min(1),
  }),
  missingInfoFollowUp: z.object({
    subject: z.string().trim().optional().nullable(),
    body: z.string().min(1),
    missingItems: z.array(z.string().min(1)).max(6),
  }),
  conflictExplanation: z.string().min(1),
  nextBestAction: z.object({
    label: z.string().min(1),
    rationale: z.string().min(1),
  }),
  duplicateSuggestion: z.object({
    shouldReview: z.boolean(),
    rationale: z.string().min(1),
  }),
  staleLeadRecommendation: z.string().min(1),
});

export const translationArtifactSchema = z.object({
  language: z.string().min(1),
  translatedText: z.string().min(1),
  sourceSummary: z.string().min(1),
});

export const listingAnalyzerSchema = z.object({
  headline: z.string().min(1),
  strengths: z.array(z.string().min(1)).max(5),
  gaps: z.array(z.string().min(1)).max(5),
  recommendations: z.array(z.string().min(1)).max(5),
});

export const houseRulesGeneratorSchema = z.object({
  summary: z.string().min(1),
  rules: z.array(
    z.object({
      label: z.string().min(1),
      description: z.string().min(1),
      severity: z.enum(["REQUIRED", "WARNING", "PREFERENCE"]),
      category: z.string().min(1),
    }),
  ).max(8),
});

export const intakeFormGeneratorSchema = z.object({
  setName: z.string().min(1),
  rationale: z.string().min(1),
  questions: z.array(
    z.object({
      label: z.string().min(1),
      fieldKey: z.string().min(1),
      type: z.enum(["TEXT", "SELECT", "YES_NO", "NUMBER", "DATE"]),
      required: z.boolean(),
    }),
  ).max(10),
});

export const workflowTemplateGeneratorSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    "INITIAL_REPLY",
    "SCREENING_INVITE",
    "MISSING_INFO_FOLLOW_UP",
    "TOUR_CONFIRMATION",
    "TOUR_INVITE",
    "APPLICATION_INVITE",
    "HOUSE_RULES_ACKNOWLEDGMENT",
    "ONBOARDING",
    "DECLINE",
    "WAITLIST_NOTICE",
    "REMINDER",
  ]),
  channel: z.enum(["EMAIL", "SMS"]),
  subject: z.string().trim().optional().nullable(),
  body: z.string().min(1),
  rationale: z.string().min(1),
});

export const portfolioInsightsSchema = z.object({
  summary: z.string().min(1),
  opportunities: z.array(z.string().min(1)).max(6),
  risks: z.array(z.string().min(1)).max(6),
});

export type LeadAiInsights = z.infer<typeof leadAiInsightsSchema>;
export type TranslationArtifact = z.infer<typeof translationArtifactSchema>;
export type ListingAnalyzerArtifact = z.infer<typeof listingAnalyzerSchema>;
export type HouseRulesGeneratorArtifact = z.infer<typeof houseRulesGeneratorSchema>;
export type IntakeFormGeneratorArtifact = z.infer<typeof intakeFormGeneratorSchema>;
export type WorkflowTemplateGeneratorArtifact = z.infer<
  typeof workflowTemplateGeneratorSchema
>;
export type PortfolioInsightsArtifact = z.infer<typeof portfolioInsightsSchema>;

export function buildAiArtifactPayload(
  artifactKind: AiArtifactKind,
  payload: unknown,
): Prisma.InputJsonValue {
  return {
    artifactKind,
    payload: payload as Prisma.InputJsonValue,
    status: "ready",
  } as Prisma.InputJsonValue;
}

export function buildAiArtifactErrorPayload(
  artifactKind: AiArtifactKind,
  error: unknown,
): Prisma.InputJsonValue {
  return {
    artifactKind,
    status: "failed",
    error:
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown AI generation error.",
  } satisfies Prisma.InputJsonValue;
}

export function extractJsonObjectFromText(text: string) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error("OpenAI returned an empty response.");
  }

  const fenceMatch = trimmedText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmedText;
  const objectStartIndex = candidate.indexOf("{");
  const objectEndIndex = candidate.lastIndexOf("}");

  if (objectStartIndex === -1 || objectEndIndex === -1 || objectEndIndex < objectStartIndex) {
    throw new Error("OpenAI response did not contain a JSON object.");
  }

  return JSON.parse(candidate.slice(objectStartIndex, objectEndIndex + 1)) as unknown;
}

export function findLatestAiArtifact<T>(params: {
  auditEvents: Array<{ eventType: string; payload: unknown; createdAt: Date }>;
  artifactKind: AiArtifactKind;
  schema: z.ZodSchema<T>;
}) {
  for (let index = params.auditEvents.length - 1; index >= 0; index -= 1) {
    const auditEvent = params.auditEvents[index];

    if (auditEvent.eventType !== "ai_artifact_generated") {
      continue;
    }

    const parsedStoredArtifact = storedAiArtifactSchema.safeParse(auditEvent.payload);

    if (!parsedStoredArtifact.success) {
      continue;
    }

    if (parsedStoredArtifact.data.artifactKind !== params.artifactKind) {
      continue;
    }

    if (parsedStoredArtifact.data.status === "failed") {
      return {
        createdAt: auditEvent.createdAt,
        error: parsedStoredArtifact.data.error ?? "Unknown AI generation error.",
        status: "failed" as const,
      };
    }

    const parsedPayload = params.schema.safeParse(parsedStoredArtifact.data.payload);

    if (!parsedPayload.success) {
      continue;
    }

    return {
      createdAt: auditEvent.createdAt,
      data: parsedPayload.data,
      status: "ready" as const,
    };
  }

  return null;
}

async function runStructuredAiPrompt<T>(params: {
  schema: z.ZodSchema<T>;
  prompt: string;
  instructions?: string;
}) {
  const response = await runOpenAiRealtimeTextPrompt({
    instructions:
      params.instructions ??
      "You are Roomflow AI. Return strict JSON only. Do not wrap the response in markdown fences.",
    prompt: params.prompt,
  });
  const parsedJson = extractJsonObjectFromText(response.text);
  const parsedResult = params.schema.safeParse(parsedJson);

  if (!parsedResult.success) {
    throw new Error(`OpenAI response did not match the expected schema: ${parsedResult.error.message}`);
  }

  return parsedResult.data;
}

function normalizeQuestionFieldKey(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)/g, (_, group: string) => group.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/^[A-Z]/, (letter) => letter.toLowerCase()) || "customQuestion";
}

export async function generateLeadAiInsights(context: {
  workspaceName: string;
  leadName: string;
  source: string;
  propertyName: string;
  status: string;
  fit: string;
  evaluationSummary: string;
  evaluationIssues: string[];
  latestMessages: string[];
  qualificationAnswers: string[];
  duplicateContext: string | null;
  isStale: boolean;
}) {
  return runStructuredAiPrompt({
    schema: leadAiInsightsSchema,
    prompt: [
      "Generate lead insights for a shared-housing CRM operator.",
      `Workspace: ${context.workspaceName}`,
      `Lead: ${context.leadName}`,
      `Source: ${context.source}`,
      `Property: ${context.propertyName}`,
      `Status: ${context.status}`,
      `Fit: ${context.fit}`,
      `Evaluation summary: ${context.evaluationSummary}`,
      `Evaluation issues: ${context.evaluationIssues.join(" | ") || "None"}`,
      `Qualification answers: ${context.qualificationAnswers.join(" | ") || "None"}`,
      `Duplicate context: ${context.duplicateContext ?? "None"}`,
      `Stale lead: ${context.isStale ? "yes" : "no"}`,
      "Latest conversation snippets:",
      ...context.latestMessages.map((message) => `- ${message}`),
      "Return JSON with keys summary, replyDraft, missingInfoFollowUp, conflictExplanation, nextBestAction, duplicateSuggestion, staleLeadRecommendation.",
      "Keep everything concise, operator-facing, and grounded in the provided context. If no conflict exists, explain why the record looks internally consistent.",
    ].join("\n"),
  });
}

export async function generateTranslatedLeadMessage(context: {
  targetLanguage: string;
  sourceText: string;
  sourceSummary: string;
}) {
  return runStructuredAiPrompt({
    schema: translationArtifactSchema,
    prompt: [
      `Translate the message into ${context.targetLanguage}. Preserve meaning, tone, and operational details.`,
      `Source summary: ${context.sourceSummary}`,
      `Message: ${context.sourceText}`,
      "Return JSON with keys language, translatedText, sourceSummary.",
    ].join("\n"),
  });
}

export async function generateListingAnalyzer(context: {
  propertyName: string;
  locality: string | null;
  propertyType: string | null;
  inquiryCount: number;
  qualificationRateLabel: string;
  tourConversionRateLabel: string;
  topLeadSourceName: string;
  activeRuleCount: number;
  questionCount: number;
}) {
  return runStructuredAiPrompt({
    schema: listingAnalyzerSchema,
    prompt: [
      "Analyze the listing readiness for a shared-housing property.",
      `Property: ${context.propertyName}`,
      `Locality: ${context.locality ?? "Unknown"}`,
      `Property type: ${context.propertyType ?? "Unknown"}`,
      `Recent inquiry count: ${context.inquiryCount}`,
      `Qualification rate: ${context.qualificationRateLabel}`,
      `Tour conversion: ${context.tourConversionRateLabel}`,
      `Top source: ${context.topLeadSourceName}`,
      `Active rules: ${context.activeRuleCount}`,
      `Qualification questions: ${context.questionCount}`,
      "Return JSON with headline, strengths, gaps, recommendations. Focus on copy clarity, screening setup, and conversion blockers.",
    ].join("\n"),
  });
}

export async function generateHouseRules(context: {
  propertyName: string;
  locality: string | null;
  activeRooms: number;
  amenities: string[];
  existingRules: string[];
}) {
  return runStructuredAiPrompt({
    schema: houseRulesGeneratorSchema,
    prompt: [
      "Generate a concise starter set of shared-housing house rules.",
      `Property: ${context.propertyName}`,
      `Locality: ${context.locality ?? "Unknown"}`,
      `Rooms: ${context.activeRooms}`,
      `Amenities/policies: ${context.amenities.join(" | ") || "None"}`,
      `Existing rules: ${context.existingRules.join(" | ") || "None"}`,
      "Return JSON with summary and rules. Each rule needs label, description, severity, and category.",
    ].join("\n"),
  });
}

export async function generateIntakeForm(context: {
  propertyName: string;
  locality: string | null;
  activeRules: string[];
  existingQuestions: string[];
}) {
  const generated = await runStructuredAiPrompt({
    schema: intakeFormGeneratorSchema,
    prompt: [
      "Generate a qualification intake form for a shared-housing property.",
      `Property: ${context.propertyName}`,
      `Locality: ${context.locality ?? "Unknown"}`,
      `Active rules: ${context.activeRules.join(" | ") || "None"}`,
      `Existing questions: ${context.existingQuestions.join(" | ") || "None"}`,
      "Return JSON with setName, rationale, and questions. Each question needs label, fieldKey, type, and required.",
      "Prefer field keys that match existing lead normalization fields when possible.",
    ].join("\n"),
  });

  return {
    ...generated,
    questions: generated.questions.map((question) => ({
      ...question,
      fieldKey: normalizeQuestionFieldKey(question.fieldKey || question.label),
      type: Object.values(QuestionType).includes(question.type as QuestionType)
        ? question.type
        : "TEXT",
    })),
  };
}

export async function generateWorkflowTemplate(context: {
  workspaceName: string;
  propertyName: string | null;
  recentLeadSummary: string;
}) {
  return runStructuredAiPrompt({
    schema: workflowTemplateGeneratorSchema,
    prompt: [
      "Generate one reusable workflow template for a shared-housing CRM.",
      `Workspace: ${context.workspaceName}`,
      `Reference property: ${context.propertyName ?? "None"}`,
      `Recent lead summary: ${context.recentLeadSummary}`,
      "Return JSON with name, type, channel, subject, body, rationale.",
      "Make the body reusable with placeholder-friendly wording and no hard-coded personal data.",
    ].join("\n"),
  });
}

export async function generatePortfolioInsights(context: {
  workspaceName: string;
  propertySummaries: string[];
  staleLeadSummary: string[];
}) {
  return runStructuredAiPrompt({
    schema: portfolioInsightsSchema,
    prompt: [
      "Generate an org-level portfolio insights summary for shared housing operators.",
      `Workspace: ${context.workspaceName}`,
      "Property summaries:",
      ...context.propertySummaries.map((summary) => `- ${summary}`),
      "Stale lead summaries:",
      ...context.staleLeadSummary.map((summary) => `- ${summary}`),
      "Return JSON with summary, opportunities, and risks.",
    ].join("\n"),
  });
}

export function formatRuleSeverityLabel(severity: RuleSeverity) {
  return severity;
}

export function formatTemplateTypeLabel(templateType: TemplateType) {
  return templateType;
}
