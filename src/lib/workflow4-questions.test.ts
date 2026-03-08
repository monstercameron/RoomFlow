import assert from "node:assert/strict";
import test from "node:test";
import { AuditActorType, QuestionType } from "@/generated/prisma/client";
import type { Workflow4QuestionsActionDependencies } from "@/lib/workflow4-questions";

function getWorkflow4QuestionsModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./workflow4-questions") as typeof import("@/lib/workflow4-questions");
}

function createDependencies(
  overrides: Partial<Workflow4QuestionsActionDependencies> = {},
): Workflow4QuestionsActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    findFirstPropertyForWorkspace: async () => ({
      id: "property-1",
      name: "Maple House",
    }),
    findPropertyById: async () => ({
      id: "property-1",
      name: "Maple House",
    }),
    getCurrentWorkspaceMembership: async () => ({
      userId: "user-1",
      workspaceId: "workspace-1",
    }),
    redirect: () => undefined as never,
    replaceActiveQuestionSet: async () => ({
      questionSetId: "set-1",
    }),
    revalidatePath: () => undefined,
    ...overrides,
  };
}

function appendQuestion(
  formData: FormData,
  params: {
    fieldKey: string;
    helperText?: string;
    index: number;
    isCustom?: boolean;
    label: string;
    options?: string[];
    rationale?: string;
    status: "required" | "optional" | "off";
    suggested?: boolean;
    type: QuestionType;
  },
) {
  formData.set(`questionLabel-${params.index}`, params.label);
  formData.set(`questionFieldKey-${params.index}`, params.fieldKey);
  formData.set(`questionType-${params.index}`, params.type);
  formData.set(`questionHelperText-${params.index}`, params.helperText ?? "");
  formData.set(`questionRationale-${params.index}`, params.rationale ?? "");
  formData.set(`questionStatus-${params.index}`, params.status);
  formData.set(`questionOptions-${params.index}`, (params.options ?? []).join("\n"));
  formData.set(`questionIsCustom-${params.index}`, params.isCustom ? "1" : "0");
  formData.set(`questionSuggested-${params.index}`, params.suggested ? "1" : "0");
}

function createValidWorkflow4FormData() {
  const formData = new FormData();
  formData.set("questionCount", "3");
  appendQuestion(formData, {
    fieldKey: "moveInDate",
    index: 0,
    label: "When do you want to move in?",
    rationale: "Scheduling baseline",
    status: "required",
    suggested: true,
    type: QuestionType.DATE,
  });
  appendQuestion(formData, {
    fieldKey: "monthlyBudget",
    index: 1,
    label: "What monthly budget are you working with?",
    rationale: "Budget baseline",
    status: "required",
    suggested: true,
    type: QuestionType.NUMBER,
  });
  appendQuestion(formData, {
    fieldKey: "guestExpectations",
    index: 2,
    isCustom: false,
    label: "What are your regular guest expectations?",
    rationale: "Guest habits",
    status: "optional",
    suggested: true,
    type: QuestionType.TEXT,
  });

  return formData;
}

test("buildWorkflow4QuestionsRetryPath preserves draft state and hydration restores it", () => {
  const {
    buildWorkflow4QuestionsRetryPath,
    hydrateWorkflow4DraftsFromSearchParams,
  } = getWorkflow4QuestionsModule();
  const formData = new FormData();
  formData.set("questionCount", "1");
  appendQuestion(formData, {
    fieldKey: "customQuietHours",
    helperText: "Ask only if it affects roommate fit.",
    index: 0,
    isCustom: true,
    label: "What are your quiet-hours expectations?",
    options: ["Early sleeper", "Flexible"],
    rationale: "Custom question",
    status: "optional",
    type: QuestionType.SELECT,
  });

  const retryPath = buildWorkflow4QuestionsRetryPath({
    basePath: "/onboarding/questions",
    errorMessage: "Select options are required.",
    formData,
    redirectTo: "/onboarding/channels",
    source: "ai",
  });

  const searchParams = new URLSearchParams(retryPath.split("?")[1]);
  const hydratedDrafts = hydrateWorkflow4DraftsFromSearchParams({
    state: searchParams.get("state") ?? undefined,
  });

  assert.equal(searchParams.get("error"), "Select options are required.");
  assert.equal(searchParams.get("redirectTo"), "/onboarding/channels");
  assert.equal(searchParams.get("source"), "ai");
  assert.equal(hydratedDrafts?.length, 1);
  assert.equal(hydratedDrafts?.[0]?.fieldKey, "customQuietHours");
  assert.equal(hydratedDrafts?.[0]?.type, QuestionType.SELECT);
  assert.deepEqual(hydratedDrafts?.[0]?.options, ["Early sleeper", "Flexible"]);
});

test("handleSaveWorkflow4QuestionsAction rejects empty and no-required builders", async () => {
  const { handleSaveWorkflow4QuestionsAction } = getWorkflow4QuestionsModule();
  const emptyFormData = new FormData();
  emptyFormData.set("questionCount", "1");
  appendQuestion(emptyFormData, {
    fieldKey: "moveInDate",
    index: 0,
    label: "When do you want to move in?",
    status: "off",
    type: QuestionType.DATE,
  });

  await assert.rejects(
    handleSaveWorkflow4QuestionsAction(
      emptyFormData,
      { successPath: "/onboarding/channels" },
      createDependencies(),
    ),
    /Turn on at least one question before continuing/,
  );

  const noRequiredFormData = new FormData();
  noRequiredFormData.set("questionCount", "1");
  appendQuestion(noRequiredFormData, {
    fieldKey: "parkingNeed",
    index: 0,
    label: "Do you need parking?",
    status: "optional",
    type: QuestionType.YES_NO,
  });

  await assert.rejects(
    handleSaveWorkflow4QuestionsAction(
      noRequiredFormData,
      { successPath: "/onboarding/channels" },
      createDependencies(),
    ),
    /Mark at least one question as required/,
  );
});

test("handleSaveWorkflow4QuestionsAction rejects select questions without options", async () => {
  const { handleSaveWorkflow4QuestionsAction } = getWorkflow4QuestionsModule();
  const formData = new FormData();
  formData.set("questionCount", "1");
  appendQuestion(formData, {
    fieldKey: "customPreferredShift",
    index: 0,
    isCustom: true,
    label: "What work schedule fits you best?",
    status: "required",
    type: QuestionType.SELECT,
  });

  await assert.rejects(
    handleSaveWorkflow4QuestionsAction(
      formData,
      { successPath: "/onboarding/channels" },
      createDependencies(),
    ),
    /Add at least one answer option/,
  );
});

test("handleSaveWorkflow4QuestionsAction persists active ordering, audits completion, and redirects", async () => {
  const { handleSaveWorkflow4QuestionsAction } = getWorkflow4QuestionsModule();
  const replacedQuestionSets: Array<unknown> = [];
  const auditEvents: Array<unknown> = [];
  const revalidatedPaths: string[] = [];
  let redirectPath: string | null = null;

  await handleSaveWorkflow4QuestionsAction(
    createValidWorkflow4FormData(),
    { successPath: "/onboarding/channels" },
    createDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirectPath = path;
        return undefined as never;
      },
      replaceActiveQuestionSet: async (input) => {
        replacedQuestionSets.push(input);
        return { questionSetId: "set-live-2" };
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
    }),
  );

  assert.deepEqual(replacedQuestionSets, [
    {
      propertyId: "property-1",
      propertyName: "Maple House",
      questions: [
        {
          fieldKey: "moveInDate",
          label: "When do you want to move in?",
          options: [],
          required: true,
          sortOrder: 0,
          type: QuestionType.DATE,
        },
        {
          fieldKey: "monthlyBudget",
          label: "What monthly budget are you working with?",
          options: [],
          required: true,
          sortOrder: 1,
          type: QuestionType.NUMBER,
        },
        {
          fieldKey: "guestExpectations",
          label: "What are your regular guest expectations?",
          options: [],
          required: false,
          sortOrder: 2,
          type: QuestionType.TEXT,
        },
      ],
      workspaceId: "workspace-1",
    },
  ]);

  assert.deepEqual(auditEvents, [
    {
      actorType: AuditActorType.USER,
      actorUserId: "user-1",
      eventType: "qualification_questions_completed",
      payload: {
        optionalQuestionCount: 1,
        propertyId: "property-1",
        questionSetId: "set-live-2",
        requiredQuestionCount: 2,
        totalQuestionCount: 3,
      },
      propertyId: "property-1",
      workspaceId: "workspace-1",
    },
  ]);

  assert.deepEqual(revalidatedPaths, [
    "/onboarding",
    "/app",
    "/app/properties",
    "/onboarding/questions",
    "/app/properties/property-1",
    "/app/properties/property-1/questions",
  ]);
  assert.equal(redirectPath, "/onboarding/channels");
});

test("resolveActiveQualificationQuestionSet prefers the default set and starter suggestions follow property context", () => {
  const {
    getWorkflow4SuggestedQuestionDrafts,
    resolveActiveQualificationQuestionSet,
  } = getWorkflow4QuestionsModule();

  const activeQuestionSet = resolveActiveQualificationQuestionSet([
    {
      id: "set-old",
      isDefault: false,
      questions: [{ id: "q-old", fieldKey: "legacy", label: "Legacy", required: true }],
    },
    {
      id: "set-live",
      isDefault: true,
      questions: [{ id: "q-live", fieldKey: "moveInDate", label: "Move-in", required: true }],
    },
  ]);

  assert.equal(activeQuestionSet?.id, "set-live");

  const suggestedDrafts = getWorkflow4SuggestedQuestionDrafts({
    name: "Maple House",
    parkingAvailable: false,
    petsAllowed: false,
    rentableRoomCount: 4,
    rules: [
      {
        category: "Smoking",
        description: "Smoking is not allowed.",
        label: "No smoking",
      },
      {
        category: "Guests",
        description: "Overnight guests are limited.",
        label: "Overnight guest policy",
      },
    ],
    sharedBathroomCount: 1,
    smokingAllowed: false,
  });

  assert(suggestedDrafts.some((draft) => draft.fieldKey === "moveInDate"));
  assert(suggestedDrafts.some((draft) => draft.fieldKey === "monthlyBudget"));
  assert(suggestedDrafts.some((draft) => draft.fieldKey === "stayLengthMonths"));
  assert(suggestedDrafts.some((draft) => draft.fieldKey === "bathroomSharingAcceptance"));
  assert(suggestedDrafts.some((draft) => draft.fieldKey === "smokingStatus"));
  assert(suggestedDrafts.some((draft) => draft.fieldKey === "petStatus"));
  assert(suggestedDrafts.some((draft) => draft.fieldKey === "parkingNeed"));
  assert(suggestedDrafts.some((draft) => draft.fieldKey === "guestExpectations"));
});