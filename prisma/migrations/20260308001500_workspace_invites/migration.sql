CREATE TABLE IF NOT EXISTS "WorkspaceInvite" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "invitedByUserId" TEXT NOT NULL,
  "acceptedByUserId" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvite_tokenHash_key"
ON "WorkspaceInvite"("tokenHash");

CREATE INDEX IF NOT EXISTS "WorkspaceInvite_workspaceId_createdAt_idx"
ON "WorkspaceInvite"("workspaceId", "createdAt");

CREATE INDEX IF NOT EXISTS "WorkspaceInvite_workspaceId_email_idx"
ON "WorkspaceInvite"("workspaceId", "email");

CREATE INDEX IF NOT EXISTS "WorkspaceInvite_email_expiresAt_idx"
ON "WorkspaceInvite"("email", "expiresAt");

DO $$
BEGIN
  BEGIN
    ALTER TABLE "WorkspaceInvite"
      ADD CONSTRAINT "WorkspaceInvite_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE "WorkspaceInvite"
      ADD CONSTRAINT "WorkspaceInvite_invitedByUserId_fkey"
      FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE "WorkspaceInvite"
      ADD CONSTRAINT "WorkspaceInvite_acceptedByUserId_fkey"
      FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;