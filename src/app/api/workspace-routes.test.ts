import assert from "node:assert/strict";
import test from "node:test";
import { MembershipRole, WorkspaceCapability } from "@/generated/prisma/client";

async function getWorkspaceRouteModules() {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

  const [workspaceInvitesRoute, acceptWorkspaceInviteRoute, activeWorkspaceRoute, workspaceInvitesModule] =
    await Promise.all([
      import("./workspace-invites/route"),
      import("./workspace-invites/accept/route"),
      import("./workspaces/active/route"),
      import("@/lib/workspace-invites"),
    ]);

  return {
    WorkspaceInviteError: workspaceInvitesModule.WorkspaceInviteError,
    handleAcceptWorkspaceInvitePost:
      acceptWorkspaceInviteRoute.handleAcceptWorkspaceInvitePost,
    handleActiveWorkspacePost: activeWorkspaceRoute.handleActiveWorkspacePost,
    handleCreateWorkspaceInvitePost:
      workspaceInvitesRoute.handleCreateWorkspaceInvitePost,
  };
}

test("create workspace invite route rejects unauthenticated requests", async () => {
  const { handleCreateWorkspaceInvitePost } = await getWorkspaceRouteModules();

  const response = await handleCreateWorkspaceInvitePost(
    new Request("http://localhost/api/workspace-invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new@roomflow.local", role: MembershipRole.MANAGER }),
    }),
    {
      createWorkspaceInvite: async () => undefined as never,
      getCurrentWorkspaceMembership: async () => ({}) as never,
      getServerSession: async () => null,
      revalidatePath: () => undefined,
      workspaceHasCapability: () => true,
    },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Unauthorized" });
});

test("create workspace invite route validates payload and capability gates", async () => {
  const { handleCreateWorkspaceInvitePost } = await getWorkspaceRouteModules();
  const session = {
    user: { id: "user_1", email: "owner@roomflow.local" },
  };

  const missingEmailResponse = await handleCreateWorkspaceInvitePost(
    new Request("http://localhost/api/workspace-invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: MembershipRole.MANAGER }),
    }),
    {
      createWorkspaceInvite: async () => undefined as never,
      getCurrentWorkspaceMembership: async () => ({}) as never,
      getServerSession: async () => session as never,
      revalidatePath: () => undefined,
      workspaceHasCapability: () => true,
    },
  );
  assert.equal(missingEmailResponse.status, 400);
  assert.deepEqual(await missingEmailResponse.json(), {
    message: "Invite email is required.",
  });

  const missingCapabilityResponse = await handleCreateWorkspaceInvitePost(
    new Request("http://localhost/api/workspace-invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new@roomflow.local", role: MembershipRole.MANAGER }),
    }),
    {
      createWorkspaceInvite: async () => undefined as never,
      getCurrentWorkspaceMembership: async () =>
        ({
          workspaceId: "workspace_1",
          workspace: { enabledCapabilities: [] },
        }) as never,
      getServerSession: async () => session as never,
      revalidatePath: () => undefined,
      workspaceHasCapability: () => false,
    },
  );
  assert.equal(missingCapabilityResponse.status, 403);
  assert.deepEqual(await missingCapabilityResponse.json(), {
    message: "Teammate invites require an Org workspace package.",
    requiredCapability: WorkspaceCapability.ORG_MEMBERS,
    upgradePath: "/app/settings?upgrade=org-members",
  });
});

test("create workspace invite route revalidates on success and maps invite errors", async () => {
  const { WorkspaceInviteError, handleCreateWorkspaceInvitePost } =
    await getWorkspaceRouteModules();
  const revalidatedPaths: string[] = [];
  const session = {
    user: { id: "user_1", email: "owner@roomflow.local" },
  };

  const successResponse = await handleCreateWorkspaceInvitePost(
    new Request("http://localhost/api/workspace-invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new@roomflow.local", role: MembershipRole.MANAGER }),
    }),
    {
      createWorkspaceInvite: async () => undefined as never,
      getCurrentWorkspaceMembership: async () =>
        ({
          workspaceId: "workspace_1",
          workspace: { enabledCapabilities: [WorkspaceCapability.ORG_MEMBERS] },
        }) as never,
      getServerSession: async () => session as never,
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      workspaceHasCapability: () => true,
    },
  );

  assert.equal(successResponse.status, 200);
  assert.deepEqual(await successResponse.json(), { status: true });
  assert.deepEqual(revalidatedPaths, ["/app/settings", "/app/settings/members"]);

  const conflictResponse = await handleCreateWorkspaceInvitePost(
    new Request("http://localhost/api/workspace-invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new@roomflow.local", role: MembershipRole.MANAGER }),
    }),
    {
      createWorkspaceInvite: async () => {
        throw new WorkspaceInviteError("ALREADY_MEMBER", "That user already belongs to this workspace.");
      },
      getCurrentWorkspaceMembership: async () =>
        ({
          workspaceId: "workspace_1",
          workspace: { enabledCapabilities: [WorkspaceCapability.ORG_MEMBERS] },
        }) as never,
      getServerSession: async () => session as never,
      revalidatePath: () => undefined,
      workspaceHasCapability: () => true,
    },
  );

  assert.equal(conflictResponse.status, 409);
  assert.deepEqual(await conflictResponse.json(), {
    message: "That user already belongs to this workspace.",
  });
});

test("accept workspace invite route validates auth and token presence", async () => {
  const { handleAcceptWorkspaceInvitePost } = await getWorkspaceRouteModules();

  const unauthorizedResponse = await handleAcceptWorkspaceInvitePost(
    new Request("http://localhost/api/workspace-invites/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "invite-token" }),
    }),
    {
      acceptWorkspaceInvite: async () => ({ workspace: { id: "workspace_1", onboardingCompletedAt: null } }) as never,
      buildEmailVerificationPagePath: () => "/verify-email",
      cookies: async () => ({ set: () => undefined }) as never,
      getServerSession: async () => null,
      revalidatePath: () => undefined,
    },
  );
  assert.equal(unauthorizedResponse.status, 401);
  assert.deepEqual(await unauthorizedResponse.json(), { message: "Unauthorized" });

  const missingTokenResponse = await handleAcceptWorkspaceInvitePost(
    new Request("http://localhost/api/workspace-invites/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
    {
      acceptWorkspaceInvite: async () => ({ workspace: { id: "workspace_1", onboardingCompletedAt: null } }) as never,
      buildEmailVerificationPagePath: () => "/verify-email",
      cookies: async () => ({ set: () => undefined }) as never,
      getServerSession: async () => ({ user: { id: "user_1", email: "member@roomflow.local", emailVerified: true } }) as never,
      revalidatePath: () => undefined,
    },
  );
  assert.equal(missingTokenResponse.status, 400);
  assert.deepEqual(await missingTokenResponse.json(), {
    message: "Invite token is required.",
  });
});

test("accept workspace invite route sets cookie and returns correct redirect paths", async () => {
  const { handleAcceptWorkspaceInvitePost } = await getWorkspaceRouteModules();
  const cookieSets: Array<{ name: string; value: string; options: object }> = [];
  const revalidatedPaths: string[] = [];

  const verifiedResponse = await handleAcceptWorkspaceInvitePost(
    new Request("http://localhost/api/workspace-invites/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "invite-token" }),
    }),
    {
      acceptWorkspaceInvite: async () =>
        ({
          workspace: { id: "workspace_1", onboardingCompletedAt: new Date("2026-03-08T00:00:00.000Z") },
        }) as never,
      buildEmailVerificationPagePath: () => "/verify-email?unused=true",
      cookies: async () =>
        ({
          set: (name: string, value: string, options: object) => {
            cookieSets.push({ name, value, options });
          },
        }) as never,
      getServerSession: async () =>
        ({ user: { id: "user_1", email: "member@roomflow.local", emailVerified: true } }) as never,
      revalidatePath: (path: string) => {
        revalidatedPaths.push(path);
      },
    },
  );

  assert.equal(verifiedResponse.status, 200);
  assert.deepEqual(await verifiedResponse.json(), { redirectPath: "/app" });
  assert.deepEqual(cookieSets[0], {
    name: "roomflow_active_workspace_id",
    value: "workspace_1",
    options: {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    },
  });
  assert.deepEqual(revalidatedPaths, ["/app", "/app/settings", "/app/settings/members"]);

  const unverifiedResponse = await handleAcceptWorkspaceInvitePost(
    new Request("http://localhost/api/workspace-invites/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "invite-token" }),
    }),
    {
      acceptWorkspaceInvite: async () =>
        ({
          workspace: { id: "workspace_2", onboardingCompletedAt: null },
        }) as never,
      buildEmailVerificationPagePath: ({ emailAddress, nextPath }) =>
        `/verify-email?email=${encodeURIComponent(emailAddress ?? "")}&next=${encodeURIComponent(nextPath ?? "")}`,
      cookies: async () => ({ set: () => undefined }) as never,
      getServerSession: async () =>
        ({ user: { id: "user_2", email: "member2@roomflow.local", emailVerified: false } }) as never,
      revalidatePath: () => undefined,
    },
  );

  assert.equal(unverifiedResponse.status, 200);
  assert.deepEqual(await unverifiedResponse.json(), {
    redirectPath:
      "/verify-email?email=member2%40roomflow.local&next=%2Fonboarding",
  });
});

test("accept workspace invite route maps invite errors to HTTP status codes", async () => {
  const { WorkspaceInviteError, handleAcceptWorkspaceInvitePost } =
    await getWorkspaceRouteModules();

  const response = await handleAcceptWorkspaceInvitePost(
    new Request("http://localhost/api/workspace-invites/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "invite-token" }),
    }),
    {
      acceptWorkspaceInvite: async () => {
        throw new WorkspaceInviteError(
          "INVITE_EMAIL_MISMATCH",
          "Sign in with the invited email address before accepting this workspace invite.",
        );
      },
      buildEmailVerificationPagePath: () => "/verify-email",
      cookies: async () => ({ set: () => undefined }) as never,
      getServerSession: async () =>
        ({ user: { id: "user_1", email: "member@roomflow.local", emailVerified: true } }) as never,
      revalidatePath: () => undefined,
    },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    message: "Sign in with the invited email address before accepting this workspace invite.",
  });
});

test("active workspace route validates session and workspace access", async () => {
  const { handleActiveWorkspacePost } = await getWorkspaceRouteModules();

  const unauthorizedResponse = await handleActiveWorkspacePost(
    new Request("http://localhost/api/workspaces/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: "workspace_1" }),
    }),
    {
      cookies: async () => ({ set: () => undefined }) as never,
      getSession: async () => null,
      headers: async () => new Headers(),
      membershipFindFirst: async () => null,
    },
  );
  assert.equal(unauthorizedResponse.status, 401);
  assert.deepEqual(await unauthorizedResponse.json(), { message: "Unauthorized" });

  const missingWorkspaceResponse = await handleActiveWorkspacePost(
    new Request("http://localhost/api/workspaces/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
    {
      cookies: async () => ({ set: () => undefined }) as never,
      getSession: async () => ({ user: { id: "user_1" } }) as never,
      headers: async () => new Headers(),
      membershipFindFirst: async () => null,
    },
  );
  assert.equal(missingWorkspaceResponse.status, 400);
  assert.deepEqual(await missingWorkspaceResponse.json(), {
    message: "Workspace selection is required.",
  });

  const forbiddenResponse = await handleActiveWorkspacePost(
    new Request("http://localhost/api/workspaces/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: "workspace_2" }),
    }),
    {
      cookies: async () => ({ set: () => undefined }) as never,
      getSession: async () => ({ user: { id: "user_1" } }) as never,
      headers: async () => new Headers(),
      membershipFindFirst: async () => null,
    },
  );
  assert.equal(forbiddenResponse.status, 403);
  assert.deepEqual(await forbiddenResponse.json(), {
    message: "Workspace access not found.",
  });
});

test("active workspace route stores the selected workspace cookie on success", async () => {
  const { handleActiveWorkspacePost } = await getWorkspaceRouteModules();
  const cookieSets: Array<{ name: string; value: string; options: object }> = [];

  const response = await handleActiveWorkspacePost(
    new Request("http://localhost/api/workspaces/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: "workspace_1" }),
    }),
    {
      cookies: async () =>
        ({
          set: (name: string, value: string, options: object) => {
            cookieSets.push({ name, value, options });
          },
        }) as never,
      getSession: async () => ({ user: { id: "user_1" } }) as never,
      headers: async () => new Headers(),
      membershipFindFirst: async () => ({ id: "membership_1" }) as never,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: true });
  assert.deepEqual(cookieSets, [
    {
      name: "roomflow_active_workspace_id",
      value: "workspace_1",
      options: {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      },
    },
  ]);
});