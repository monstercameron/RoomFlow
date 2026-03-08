import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceMembership } from "./app-data";
import {
  handleSaveWorkflow4QuestionsAction as handleSaveWorkflow4QuestionsActionBase,
  type SaveQuestionSetInput,
  type Workflow4Membership,
  type Workflow4PropertyRecord,
  type Workflow4QuestionsActionDependencies,
} from "./workflow4-questions";
import type { Workflow4AuditEventInput, PersistedQuestionInput } from "./workflow4-questions";
import type { IntakeFormGeneratorArtifact } from "./ai-assist";

const defaultDependencies: Workflow4QuestionsActionDependencies = {
  createAuditEvent: async (input: Workflow4AuditEventInput) => {
    await prisma.auditEvent.create({
      data: {
        actorType: input.actorType,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload,
        propertyId: input.propertyId,
        workspaceId: input.workspaceId,
      },
    });
  },
  findFirstPropertyForWorkspace: (workspaceId: string) =>
    prisma.property.findFirst({
      where: {
        workspaceId,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }) as Promise<Workflow4PropertyRecord | null>,
  findPropertyById: (propertyId: string, workspaceId: string) =>
    prisma.property.findFirst({
      where: {
        id: propertyId,
        workspaceId,
      },
      select: {
        id: true,
        name: true,
      },
    }) as Promise<Workflow4PropertyRecord | null>,
  getCurrentWorkspaceMembership: async () => {
    const membership = await getCurrentWorkspaceMembership();

    return {
      userId: membership.userId,
      workspaceId: membership.workspaceId,
    } satisfies Workflow4Membership;
  },
  redirect,
  replaceActiveQuestionSet: async (input: SaveQuestionSetInput) => {
    return prisma.$transaction(async (transaction) => {
      await transaction.qualificationQuestionSet.updateMany({
        data: {
          isDefault: false,
        },
        where: {
          propertyId: input.propertyId,
        },
      });

      const questionSet = await transaction.qualificationQuestionSet.create({
        data: {
          isDefault: true,
          name:
            input.setName?.trim() || `${input.propertyName} qualification intake`,
          propertyId: input.propertyId,
        },
        select: {
          id: true,
        },
      });

      if (input.questions.length > 0) {
        await transaction.qualificationQuestion.createMany({
          data: input.questions.map((question) => ({
            fieldKey: question.fieldKey,
            label: question.label,
            options: question.options,
            questionSetId: questionSet.id,
            required: question.required,
            sortOrder: question.sortOrder,
            type: question.type,
          })),
        });
      }

      return {
        questionSetId: questionSet.id,
      };
    });
  },
  revalidatePath,
};

export async function saveWorkflow4QuestionSet(params: SaveQuestionSetInput) {
  return defaultDependencies.replaceActiveQuestionSet(params);
}

export async function applyWorkflow4ArtifactQuestionSet(params: {
  propertyId: string;
  propertyName: string;
  setName: string;
  questions: IntakeFormGeneratorArtifact["questions"];
  workspaceId: string;
}) {
  const persistedQuestions = params.questions.map((question, index) => ({
    fieldKey: question.fieldKey,
    label: question.label,
    options: [],
    required: question.required,
    sortOrder: index,
    type: question.type,
  } satisfies PersistedQuestionInput));

  return saveWorkflow4QuestionSet({
    propertyId: params.propertyId,
    propertyName: params.propertyName,
    questions: persistedQuestions,
    setName: params.setName,
    workspaceId: params.workspaceId,
  });
}

export async function handleSaveWorkflow4QuestionsAction(
  formData: FormData,
  params: {
    propertyId?: string;
    successPath: string;
  },
) {
  return handleSaveWorkflow4QuestionsActionBase(formData, params, defaultDependencies);
}