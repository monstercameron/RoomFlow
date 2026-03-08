import type { AuditActorType, Prisma } from "@/generated/prisma/client";
import type { IntakeFormGeneratorArtifact } from "@/lib/ai-assist";
import { normalizedLeadFieldKeys } from "@/lib/lead-field-metadata";

const recommendedRequiredQuestionLimit = 4;

export const workflow4QuestionTypes = ["TEXT", "SELECT", "YES_NO", "NUMBER", "DATE"] as const;

export type Workflow4QuestionType = (typeof workflow4QuestionTypes)[number];

const questionTypeLabels: Record<Workflow4QuestionType, string> = {
  DATE: "Date",
  NUMBER: "Number",
  SELECT: "Select",
  TEXT: "Short text",
  YES_NO: "Yes or no",
};

export type Workflow4QuestionDraftStatus = "required" | "optional" | "off";

export type Workflow4QuestionDraft = {
  fieldKey: string;
  helperText: string;
  id: string;
  isCustom: boolean;
  label: string;
  options: string[];
  rationale: string;
  sortOrder: number;
  status: Workflow4QuestionDraftStatus;
  suggested: boolean;
  type: Workflow4QuestionType;
};

export type Workflow4QuestionSetSnapshot = {
  id: string;
  isDefault?: boolean;
  name: string;
  questions: Array<{
    fieldKey: string;
    id: string;
    label: string;
    options?: string[] | null;
    required: boolean;
    sortOrder: number;
    type: Workflow4QuestionType;
  }>;
};

type Workflow4PropertyContext = {
  name: string;
  parkingAvailable: boolean | null;
  petsAllowed: boolean | null;
  rentableRoomCount?: number | null;
  sharedBathroomCount: number | null;
  smokingAllowed: boolean | null;
  rules: Array<{
    category?: string | null;
    description?: string | null;
    label: string;
  }>;
};

export type Workflow4Membership = {
  userId: string;
  workspaceId: string;
};

export type PersistedQuestionInput = {
  fieldKey: string;
  label: string;
  options: string[];
  required: boolean;
  sortOrder: number;
  type: Workflow4QuestionType;
};

export type SaveQuestionSetInput = {
  propertyId: string;
  propertyName: string;
  questions: PersistedQuestionInput[];
  setName?: string;
  workspaceId: string;
};

export type Workflow4AuditEventInput = {
  actorType: AuditActorType;
  actorUserId: string;
  eventType: string;
  payload: Prisma.InputJsonObject;
  propertyId: string;
  workspaceId: string;
};

export type Workflow4PropertyRecord = {
  id: string;
  name: string;
};

export type Workflow4QuestionsActionDependencies = {
  createAuditEvent: (input: Workflow4AuditEventInput) => Promise<void>;
  findFirstPropertyForWorkspace: (
    workspaceId: string,
  ) => Promise<Workflow4PropertyRecord | null>;
  findPropertyById: (
    propertyId: string,
    workspaceId: string,
  ) => Promise<Workflow4PropertyRecord | null>;
  getCurrentWorkspaceMembership: () => Promise<Workflow4Membership>;
  redirect: (path: string) => never;
  replaceActiveQuestionSet: (input: SaveQuestionSetInput) => Promise<{ questionSetId: string }>;
  revalidatePath: (path: string) => void;
};

export class Workflow4QuestionsActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Workflow4QuestionsActionError";
  }
}

const knownFieldKeySet = new Set<string>(normalizedLeadFieldKeys);

type SuggestedQuestionDefinition = {
  fieldKey: string;
  helperText: string;
  label: string;
  rationale: string;
  recommendedStatus: Workflow4QuestionDraftStatus;
  type: Workflow4QuestionType;
  when: (context: Workflow4PropertyContext) => boolean;
};

const suggestedQuestionDefinitions: SuggestedQuestionDefinition[] = [
  {
    fieldKey: "moveInDate",
    helperText: "Keep this practical so you can time tours and room readiness.",
    label: "When do you want to move in?",
    rationale: "Move-in timing is the first scheduling checkpoint for shared-housing leads.",
    recommendedStatus: "required",
    type: "DATE",
    when: () => true,
  },
  {
    fieldKey: "monthlyBudget",
    helperText: "Budget helps confirm fit before a tour is booked.",
    label: "What monthly budget are you working with?",
    rationale: "Budget is one of the fastest ways to qualify fit without creating a long application.",
    recommendedStatus: "required",
    type: "NUMBER",
    when: () => true,
  },
  {
    fieldKey: "stayLengthMonths",
    helperText: "Useful when the home has a minimum stay expectation or frequent turnover risk.",
    label: "How many months do you expect to stay?",
    rationale: "Stay length matters whenever the home has minimum-stay expectations.",
    recommendedStatus: "required",
    type: "NUMBER",
    when: (context) =>
      context.rentableRoomCount !== null && context.rentableRoomCount !== undefined
        ? context.rentableRoomCount >= 4 || hasRuleSignal(context.rules, ["minimum stay", "stay"])
        : hasRuleSignal(context.rules, ["minimum stay", "stay"]),
  },
  {
    fieldKey: "bathroomSharingAcceptance",
    helperText: "Ask this only when bathroom sharing is part of the actual living setup.",
    label: "Are you comfortable sharing a bathroom?",
    rationale: "Shared bathrooms are a core shared-living fit signal and should be explicit.",
    recommendedStatus: "required",
    type: "YES_NO",
    when: (context) =>
      (context.sharedBathroomCount ?? 0) > 0 || hasRuleSignal(context.rules, ["bathroom"]),
  },
  {
    fieldKey: "smokingStatus",
    helperText: "Use this when smoking expectations could disqualify a lead early.",
    label: "Do you smoke or vape?",
    rationale: "Smoking expectations should map directly to the house rules you already configured.",
    recommendedStatus: "required",
    type: "YES_NO",
    when: (context) =>
      context.smokingAllowed === false || hasRuleSignal(context.rules, ["smoking", "smoke"]),
  },
  {
    fieldKey: "petStatus",
    helperText: "Ask only when pet policy matters for this property.",
    label: "Will you be bringing any pets?",
    rationale: "Pet policy is a common shared-housing mismatch and should be screened early.",
    recommendedStatus: "required",
    type: "YES_NO",
    when: (context) =>
      context.petsAllowed === false || hasRuleSignal(context.rules, ["pet"]),
  },
  {
    fieldKey: "parkingNeed",
    helperText: "Helpful when parking is limited or needs to be coordinated in advance.",
    label: "Do you need parking?",
    rationale: "Parking is usually logistical, so it works well as an optional qualifier.",
    recommendedStatus: "optional",
    type: "YES_NO",
    when: (context) =>
      context.parkingAvailable === false || context.parkingAvailable === true || hasRuleSignal(context.rules, ["parking"]),
  },
  {
    fieldKey: "guestExpectations",
    helperText: "Keep this about routine guest habits, not personal relationships.",
    label: "What are your regular guest expectations?",
    rationale: "Guest policy matters when the home has quiet-hours or overnight-guest rules.",
    recommendedStatus: "optional",
    type: "TEXT",
    when: (context) => hasRuleSignal(context.rules, ["guest", "overnight"]),
  },
  {
    fieldKey: "workStatus",
    helperText: "Useful for aligning schedules and household rhythms without asking for sensitive employment details.",
    label: "What is your work or daily schedule like?",
    rationale: "Work pattern can help coordinate shared living expectations and tour timing.",
    recommendedStatus: "optional",
    type: "TEXT",
    when: () => true,
  },
];

function hasRuleSignal(
  rules: Workflow4PropertyContext["rules"],
  terms: string[],
) {
  return rules.some((rule) => {
    const haystack = `${rule.label} ${rule.description ?? ""}`.toLowerCase();

    return terms.some((term) => haystack.includes(term));
  });
}

function defaultHelperText(fieldKey: string) {
  if (knownFieldKeySet.has(fieldKey)) {
    return "Keep this focused on fit, logistics, or shared-living expectations.";
  }

  return "Ask only what your team genuinely needs to confirm fit and next steps.";
}

function normalizeQuestionFieldKey(label: string) {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+(.)/g, (_, group: string) => group.toUpperCase())
      .replace(/[^a-zA-Z0-9]/g, "")
      .replace(/^[A-Z]/, (letter) => letter.toLowerCase()) || "customQuestion"
  );
}

function buildDraftId(fieldKey: string, index: number) {
  return `${fieldKey || "question"}-${index}`;
}

function dedupeFieldKey(fieldKey: string, usedFieldKeys: Set<string>) {
  if (!usedFieldKeys.has(fieldKey)) {
    usedFieldKeys.add(fieldKey);
    return fieldKey;
  }

  let suffix = 2;
  let nextFieldKey = `${fieldKey}${suffix}`;

  while (usedFieldKeys.has(nextFieldKey)) {
    suffix += 1;
    nextFieldKey = `${fieldKey}${suffix}`;
  }

  usedFieldKeys.add(nextFieldKey);
  return nextFieldKey;
}

function toDraftStatus(required: boolean): Workflow4QuestionDraftStatus {
  return required ? "required" : "optional";
}

function toQuestionDraft(input: {
  fieldKey: string;
  helperText?: string | null;
  isCustom: boolean;
  label: string;
  options?: string[] | null;
  rationale?: string | null;
  sortOrder: number;
  status: Workflow4QuestionDraftStatus;
  suggested: boolean;
  type: Workflow4QuestionType;
}) {
  return {
    fieldKey: input.fieldKey,
    helperText: input.helperText?.trim() || defaultHelperText(input.fieldKey),
    id: buildDraftId(input.fieldKey, input.sortOrder),
    isCustom: input.isCustom,
    label: input.label,
    options: (input.options ?? []).filter((option) => option.trim().length > 0),
    rationale: input.rationale?.trim() || "",
    sortOrder: input.sortOrder,
    status: input.status,
    suggested: input.suggested,
    type: input.type,
  } satisfies Workflow4QuestionDraft;
}

export function getWorkflow4QuestionTypeLabel(questionType: Workflow4QuestionType) {
  return questionTypeLabels[questionType];
}

export function resolveActiveQualificationQuestionSet<T extends { isDefault?: boolean; questions: unknown[] }>(
  questionSets: T[],
) {
  const defaultQuestionSet = [...questionSets]
    .reverse()
    .find((questionSet) => questionSet.isDefault && questionSet.questions.length > 0);

  if (defaultQuestionSet) {
    return defaultQuestionSet;
  }

  return [...questionSets]
    .reverse()
    .find((questionSet) => questionSet.questions.length > 0) ?? null;
}

export function resolveActiveQualificationQuestionSets<T extends { isDefault?: boolean; questions: unknown[] }>(
  questionSets: T[],
) {
  const activeQuestionSet = resolveActiveQualificationQuestionSet(questionSets);

  return activeQuestionSet ? [activeQuestionSet] : [];
}

export function getWorkflow4SuggestedQuestionDrafts(
  context: Workflow4PropertyContext,
) {
  return suggestedQuestionDefinitions
    .filter((definition) => definition.when(context))
    .map((definition, index) =>
      toDraftStatusQuestion(definition, index),
    );
}

function toDraftStatusQuestion(
  definition: SuggestedQuestionDefinition,
  index: number,
) {
  return toQuestionDraft({
    fieldKey: definition.fieldKey,
    helperText: definition.helperText,
    isCustom: false,
    label: definition.label,
    rationale: definition.rationale,
    sortOrder: index,
    status: definition.recommendedStatus,
    suggested: true,
    type: definition.type,
  });
}

export function createEmptyWorkflow4CustomQuestionDraft(index: number): Workflow4QuestionDraft {
  return toQuestionDraft({
    fieldKey: `customQuestion${index + 1}`,
    helperText: defaultHelperText("customQuestion"),
    isCustom: true,
    label: "",
    options: [],
    rationale: "Custom question",
    sortOrder: index,
    status: "optional",
    suggested: false,
    type: "TEXT",
  });
}

export function buildWorkflow4DraftsFromQuestionSet(
  questionSet: Workflow4QuestionSetSnapshot,
) {
  return questionSet.questions
    .slice()
    .sort((leftQuestion, rightQuestion) => leftQuestion.sortOrder - rightQuestion.sortOrder)
    .map((question, index) =>
      toQuestionDraft({
        fieldKey: question.fieldKey,
        helperText: defaultHelperText(question.fieldKey),
        isCustom: !knownFieldKeySet.has(question.fieldKey),
        label: question.label,
        options: question.options ?? [],
        rationale: knownFieldKeySet.has(question.fieldKey)
          ? "Currently live in your intake flow."
          : "Custom question already live in your intake flow.",
        sortOrder: index,
        status: toDraftStatus(question.required),
        suggested: knownFieldKeySet.has(question.fieldKey),
        type: question.type,
      }),
    );
}

export function buildWorkflow4DraftsFromArtifact(
  artifact: IntakeFormGeneratorArtifact,
  fallbackDrafts: Workflow4QuestionDraft[],
) {
  const usedFieldKeys = new Set<string>();
  const artifactDrafts = artifact.questions.map((question, index) =>
    toQuestionDraft({
      fieldKey: dedupeFieldKey(question.fieldKey, usedFieldKeys),
      helperText: defaultHelperText(question.fieldKey),
      isCustom: !knownFieldKeySet.has(question.fieldKey),
      label: question.label,
      options: [],
      rationale: artifact.rationale,
      sortOrder: index,
      status: toDraftStatus(question.required),
      suggested: true,
      type: question.type,
    }),
  );
  const missingFallbackDrafts = fallbackDrafts
    .filter(
      (draft) => !artifactDrafts.some((artifactDraft) => artifactDraft.fieldKey === draft.fieldKey),
    )
    .map((draft, index) => ({
      ...draft,
      id: buildDraftId(draft.fieldKey, artifactDrafts.length + index),
      sortOrder: artifactDrafts.length + index,
      status: draft.status === "required" ? "optional" : draft.status,
    }));

  return [...artifactDrafts, ...missingFallbackDrafts];
}

export function mergeWorkflow4Drafts(params: {
  activeQuestionSet: Workflow4QuestionSetSnapshot | null;
  artifact: IntakeFormGeneratorArtifact | null;
  property: Workflow4PropertyContext;
  queryState: Workflow4QuestionDraft[] | null;
  source: string | null;
}) {
  if (params.queryState) {
    return params.queryState;
  }

  const suggestedDrafts = getWorkflow4SuggestedQuestionDrafts(params.property);

  if (params.activeQuestionSet && params.source !== "ai") {
    const activeDrafts = buildWorkflow4DraftsFromQuestionSet(params.activeQuestionSet);
    return appendMissingSuggestedDrafts(activeDrafts, suggestedDrafts);
  }

  if (params.artifact) {
    return buildWorkflow4DraftsFromArtifact(params.artifact, suggestedDrafts);
  }

  return suggestedDrafts;
}

function appendMissingSuggestedDrafts(
  activeDrafts: Workflow4QuestionDraft[],
  suggestedDrafts: Workflow4QuestionDraft[],
) {
  const existingFieldKeys = new Set(activeDrafts.map((draft) => draft.fieldKey));
  const nextDrafts = [...activeDrafts];

  for (const suggestedDraft of suggestedDrafts) {
    if (existingFieldKeys.has(suggestedDraft.fieldKey)) {
      continue;
    }

    nextDrafts.push({
      ...suggestedDraft,
      id: buildDraftId(suggestedDraft.fieldKey, nextDrafts.length),
      sortOrder: nextDrafts.length,
      status: "off",
    });
  }

  return nextDrafts;
}

type SerializedWorkflow4State = {
  questions: Workflow4QuestionDraft[];
};

export function buildWorkflow4QuestionsRetryPath(params: {
  basePath: string;
  errorMessage: string;
  formData: FormData;
  redirectTo?: string;
  source?: string | null;
}) {
  const queryParameters = new URLSearchParams();
  const questions = parseWorkflow4FormDraftState(params.formData);

  queryParameters.set("error", params.errorMessage);
  queryParameters.set(
    "state",
    JSON.stringify({ questions } satisfies SerializedWorkflow4State),
  );

  if (params.redirectTo) {
    queryParameters.set("redirectTo", params.redirectTo);
  }

  if (params.source) {
    queryParameters.set("source", params.source);
  }

  return `${params.basePath}?${queryParameters.toString()}`;
}

export function hydrateWorkflow4DraftsFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const serializedState = searchParams.state;

  if (typeof serializedState !== "string" || serializedState.trim().length === 0) {
    return null;
  }

  try {
    const parsedState = JSON.parse(serializedState) as SerializedWorkflow4State;

    if (!parsedState || !Array.isArray(parsedState.questions)) {
      return null;
    }

    return parsedState.questions
      .map((question, index) => {
        if (!question || typeof question !== "object") {
          return null;
        }

        const type = workflow4QuestionTypes.includes(question.type)
          ? question.type
          : "TEXT";
        const status: Workflow4QuestionDraftStatus =
          question.status === "required" || question.status === "optional" || question.status === "off"
            ? question.status
            : "optional";

        return toQuestionDraft({
          fieldKey:
            typeof question.fieldKey === "string" && question.fieldKey.trim().length > 0
              ? question.fieldKey
              : `customQuestion${index + 1}`,
          helperText:
            typeof question.helperText === "string" ? question.helperText : defaultHelperText("customQuestion"),
          isCustom: Boolean(question.isCustom),
          label: typeof question.label === "string" ? question.label : "",
          options: Array.isArray(question.options)
            ? question.options.filter((option): option is string => typeof option === "string")
            : [],
          rationale: typeof question.rationale === "string" ? question.rationale : "",
          sortOrder: index,
          status,
          suggested: Boolean(question.suggested),
          type,
        });
      })
      .filter((question): question is Workflow4QuestionDraft => question !== null);
  } catch {
    return null;
  }
}

function parseWorkflow4FormDraftState(formData: FormData) {
  const questionCountValue = formData.get("questionCount");
  const questionCount =
    typeof questionCountValue === "string"
      ? Number.parseInt(questionCountValue, 10)
      : Number.NaN;

  if (!Number.isFinite(questionCount) || questionCount < 0) {
    return [];
  }

  const drafts: Workflow4QuestionDraft[] = [];

  for (let index = 0; index < questionCount; index += 1) {
    const label = readStringEntry(formData, `questionLabel-${index}`);
    const fieldKey =
      readStringEntry(formData, `questionFieldKey-${index}`) || normalizeQuestionFieldKey(label);
    const typeEntry = readStringEntry(formData, `questionType-${index}`);
    const type = workflow4QuestionTypes.includes(typeEntry as Workflow4QuestionType)
      ? (typeEntry as Workflow4QuestionType)
      : "TEXT";
    const helperText = readStringEntry(formData, `questionHelperText-${index}`);
    const rationale = readStringEntry(formData, `questionRationale-${index}`);
    const statusEntry = readStringEntry(formData, `questionStatus-${index}`);
    const status: Workflow4QuestionDraftStatus =
      statusEntry === "required" || statusEntry === "optional" || statusEntry === "off"
        ? statusEntry
        : "optional";
    const options = readStringEntry(formData, `questionOptions-${index}`)
      .split("\n")
      .map((option) => option.trim())
      .filter((option) => option.length > 0);

    drafts.push(
      toQuestionDraft({
        fieldKey,
        helperText,
        isCustom: formData.get(`questionIsCustom-${index}`) === "1",
        label,
        options,
        rationale,
        sortOrder: index,
        status,
        suggested: formData.get(`questionSuggested-${index}`) === "1",
        type,
      }),
    );
  }

  return drafts;
}

function readStringEntry(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function validateWorkflow4Drafts(drafts: Workflow4QuestionDraft[]) {
  const activeDrafts = drafts.filter((draft) => draft.status !== "off");
  const requiredDrafts = drafts.filter((draft) => draft.status === "required");

  if (activeDrafts.length === 0) {
    throw new Workflow4QuestionsActionError(
      "Turn on at least one question before continuing.",
    );
  }

  if (requiredDrafts.length === 0) {
    throw new Workflow4QuestionsActionError(
      "Mark at least one question as required so Roomflow can confirm baseline fit.",
    );
  }

  const usedFieldKeys = new Set<string>();

  for (const activeDraft of activeDrafts) {
    if (activeDraft.label.trim().length === 0) {
      throw new Workflow4QuestionsActionError(
        "Every active question needs a clear prompt.",
      );
    }

    if (activeDraft.type === "SELECT" && activeDraft.options.length === 0) {
      throw new Workflow4QuestionsActionError(
        `Add at least one answer option for \"${activeDraft.label.trim() || "your select question"}\".`,
      );
    }

    const nextFieldKey = activeDraft.fieldKey.trim() || normalizeQuestionFieldKey(activeDraft.label);

    if (usedFieldKeys.has(nextFieldKey)) {
      throw new Workflow4QuestionsActionError(
        `Question field keys must be unique. Adjust \"${activeDraft.label.trim()}\" so it maps cleanly.`,
      );
    }

    usedFieldKeys.add(nextFieldKey);
  }

  return activeDrafts.map((draft, index) => ({
    fieldKey: draft.fieldKey.trim() || normalizeQuestionFieldKey(draft.label),
    label: draft.label.trim(),
    options: draft.options,
    required: draft.status === "required",
    sortOrder: index,
    type: draft.type,
  } satisfies PersistedQuestionInput));
}

export async function handleSaveWorkflow4QuestionsAction(
  formData: FormData,
  params: {
    propertyId?: string;
    successPath: string;
  },
  dependencies: Workflow4QuestionsActionDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const property = params.propertyId
    ? await dependencies.findPropertyById(
        params.propertyId,
        workspaceMembership.workspaceId,
      )
    : await dependencies.findFirstPropertyForWorkspace(workspaceMembership.workspaceId);

  if (!property) {
    dependencies.redirect("/onboarding/property");
  }

  const draftQuestions = parseWorkflow4FormDraftState(formData);
  const activeQuestions = validateWorkflow4Drafts(draftQuestions);
  const requiredQuestionCount = activeQuestions.filter((question) => question.required).length;
  const optionalQuestionCount = activeQuestions.length - requiredQuestionCount;

  const { questionSetId } = await dependencies.replaceActiveQuestionSet({
    propertyId: property.id,
    propertyName: property.name,
    questions: activeQuestions,
    workspaceId: workspaceMembership.workspaceId,
  });

  await dependencies.createAuditEvent({
    actorType: "USER" as AuditActorType,
    actorUserId: workspaceMembership.userId,
    eventType: "qualification_questions_completed",
    payload: {
      optionalQuestionCount,
      propertyId: property.id,
      questionSetId,
      requiredQuestionCount,
      totalQuestionCount: activeQuestions.length,
    },
    propertyId: property.id,
    workspaceId: workspaceMembership.workspaceId,
  });

  dependencies.revalidatePath("/onboarding");
  dependencies.revalidatePath("/app");
  dependencies.revalidatePath("/app/properties");
  dependencies.revalidatePath("/onboarding/questions");
  dependencies.revalidatePath(`/app/properties/${property.id}`);
  dependencies.revalidatePath(`/app/properties/${property.id}/questions`);
  dependencies.redirect(params.successPath);
}

export function summarizeWorkflow4Drafts(drafts: Workflow4QuestionDraft[]) {
  const activeDrafts = drafts.filter((draft) => draft.status !== "off");
  const requiredDraftCount = drafts.filter((draft) => draft.status === "required").length;

  return {
    activeDraftCount: activeDrafts.length,
    hasTooManyRequiredQuestions: requiredDraftCount > recommendedRequiredQuestionLimit,
    recommendedRequiredQuestionLimit,
    requiredDraftCount,
  };
}
