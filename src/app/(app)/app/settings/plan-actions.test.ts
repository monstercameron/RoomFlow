import assert from "node:assert/strict";
import test from "node:test";

import { MembershipRole, WorkspaceCapability, WorkspacePlanType } from "@/generated/prisma/client";
import type {
  TransferBillingOwnerActionDependencies,
  UpdateWorkspacePlanActionDependencies,
} from "./plan-actions";

function getPlanActionsModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./plan-actions") as typeof import("./plan-actions");
}

function createMembership(overrides: Partial<{
  billingOwnerUserId: string | null;
  enabledCapabilities: WorkspaceCapability[];
  role: MembershipRole;
  userId: string;
  workspaceId: string;
}> = {}) {
  const billingOwnerUserId = overrides.billingOwnerUserId ?? "user-1";
  const enabledCapabilities = overrides.enabledCapabilities ?? [WorkspaceCapability.ORG_MEMBERS];

  return {
    role: MembershipRole.OWNER,
    userId: "user-1",
    workspaceId: "workspace-1",
    workspace: {
      billingOwnerUserId,
      enabledCapabilities,
    },
    ...overrides,
  };
}

function createRedirectCapture() {
  const redirects: string[] = [];
  const redirectError = new Error("NEXT_REDIRECT");

  return {
    redirect: (path: string) => {
      redirects.push(path);
      throw redirectError;
    },
    redirectError,
    redirects,
  };
}

test("handleUpdateWorkspacePlanAction redirects when the target plan is invalid or unauthorized", async () => {
  const { handleUpdateWorkspacePlanAction } = getPlanActionsModule();

  const invalidRedirectCapture = createRedirectCapture();
  await assert.rejects(
    handleUpdateWorkspacePlanAction(
      new FormData(),
      {
        getCurrentWorkspaceMembership: async () => createMembership(),
        redirect: invalidRedirectCapture.redirect as never,
        revalidatePath: () => undefined,
        resolveDisabledCapabilitiesForWorkspacePlanChange: () => [],
        resolveEnabledCapabilitiesForWorkspacePlanChange: () => [],
        updateWorkspace: async () => undefined,
      },
    ),
    invalidRedirectCapture.redirectError,
  );
  assert.deepEqual(invalidRedirectCapture.redirects, ["/app/settings"]);

  const unauthorizedRedirectCapture = createRedirectCapture();
  const formData = new FormData();
  formData.set("targetWorkspacePlanType", WorkspacePlanType.ORG);

  await assert.rejects(
    handleUpdateWorkspacePlanAction(
      formData,
      {
        getCurrentWorkspaceMembership: async () =>
          createMembership({
            billingOwnerUserId: "owner-2",
            role: MembershipRole.ADMIN,
          }),
        redirect: unauthorizedRedirectCapture.redirect as never,
        revalidatePath: () => undefined,
        resolveDisabledCapabilitiesForWorkspacePlanChange: () => [],
        resolveEnabledCapabilitiesForWorkspacePlanChange: () => [],
        updateWorkspace: async () => undefined,
      },
    ),
    unauthorizedRedirectCapture.redirectError,
  );
  assert.deepEqual(unauthorizedRedirectCapture.redirects, ["/app/settings"]);
});

test("handleUpdateWorkspacePlanAction updates capabilities and redirects with downgrade or upgrade state", async () => {
  const { handleUpdateWorkspacePlanAction } = getPlanActionsModule();
  const workspaceUpdates: unknown[] = [];
  const revalidatedPaths: string[] = [];

  const downgradeRedirectCapture = createRedirectCapture();
  const downgradeFormData = new FormData();
  downgradeFormData.set("targetWorkspacePlanType", WorkspacePlanType.PERSONAL);

  await assert.rejects(
    handleUpdateWorkspacePlanAction(
      downgradeFormData,
      {
        getCurrentWorkspaceMembership: async () => createMembership(),
        redirect: downgradeRedirectCapture.redirect as never,
        revalidatePath: (path) => {
          revalidatedPaths.push(path);
        },
        resolveDisabledCapabilitiesForWorkspacePlanChange: () => [WorkspaceCapability.ORG_MEMBERS],
        resolveEnabledCapabilitiesForWorkspacePlanChange: () => [],
        updateWorkspace: async (input) => {
          workspaceUpdates.push(input);
        },
      },
    ),
    downgradeRedirectCapture.redirectError,
  );

  const upgradeRedirectCapture = createRedirectCapture();
  const upgradeFormData = new FormData();
  upgradeFormData.set("targetWorkspacePlanType", WorkspacePlanType.ORG);

  await assert.rejects(
    handleUpdateWorkspacePlanAction(
      upgradeFormData,
      {
        getCurrentWorkspaceMembership: async () =>
          createMembership({ enabledCapabilities: [] }),
        redirect: upgradeRedirectCapture.redirect as never,
        revalidatePath: () => undefined,
        resolveDisabledCapabilitiesForWorkspacePlanChange: () => [],
        resolveEnabledCapabilitiesForWorkspacePlanChange: () => [WorkspaceCapability.ORG_MEMBERS],
        updateWorkspace: async (input) => {
          workspaceUpdates.push(input);
        },
      },
    ),
    upgradeRedirectCapture.redirectError,
  );

  assert.deepEqual(workspaceUpdates, [
    {
      workspaceId: "workspace-1",
      enabledCapabilities: [],
      planType: WorkspacePlanType.PERSONAL,
    },
    {
      workspaceId: "workspace-1",
      enabledCapabilities: [WorkspaceCapability.ORG_MEMBERS],
      planType: WorkspacePlanType.ORG,
    },
  ]);
  assert.deepEqual(revalidatedPaths, ["/app/settings", "/app/settings/members"]);
  assert.deepEqual(downgradeRedirectCapture.redirects, ["/app/settings?planChange=downgraded"]);
  assert.deepEqual(upgradeRedirectCapture.redirects, ["/app/settings?planChange=upgraded"]);
});

test("handleTransferBillingOwnerAction validates inputs and transfers billing ownership", async () => {
  const { handleTransferBillingOwnerAction } = getPlanActionsModule();

  const missingTargetRedirectCapture = createRedirectCapture();
  await assert.rejects(
    handleTransferBillingOwnerAction(
      new FormData(),
      {
        findTargetMembership: async () => ({ userId: "user-2" }),
        getCurrentWorkspaceMembership: async () => createMembership(),
        redirect: missingTargetRedirectCapture.redirect as never,
        revalidatePath: () => undefined,
        updateWorkspaceBillingOwner: async () => undefined,
      },
    ),
    missingTargetRedirectCapture.redirectError,
  );
  assert.deepEqual(missingTargetRedirectCapture.redirects, [
    "/app/settings?planChange=billing-owner-unchanged",
  ]);

  const workspaceUpdates: unknown[] = [];
  const successRedirectCapture = createRedirectCapture();
  const revalidatedPaths: string[] = [];
  const formData = new FormData();
  formData.set("targetUserId", "user-2");

  await assert.rejects(
    handleTransferBillingOwnerAction(
      formData,
      {
        findTargetMembership: async () => ({ userId: "user-2" }),
        getCurrentWorkspaceMembership: async () => createMembership(),
        redirect: successRedirectCapture.redirect as never,
        revalidatePath: (path) => {
          revalidatedPaths.push(path);
        },
        updateWorkspaceBillingOwner: async (input) => {
          workspaceUpdates.push(input);
        },
      },
    ),
    successRedirectCapture.redirectError,
  );

  assert.deepEqual(workspaceUpdates, [
    {
      workspaceId: "workspace-1",
      billingOwnerUserId: "user-2",
    },
  ]);
  assert.deepEqual(revalidatedPaths, ["/app/settings"]);
  assert.deepEqual(successRedirectCapture.redirects, [
    "/app/settings?planChange=billing-owner-transferred",
  ]);
});