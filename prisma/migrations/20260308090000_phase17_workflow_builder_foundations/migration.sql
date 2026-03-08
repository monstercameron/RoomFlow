CREATE TYPE "WorkflowScope" AS ENUM ('WORKSPACE', 'PROPERTY', 'ORG_LIBRARY');
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "WorkflowVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');
CREATE TYPE "WorkflowNodeType" AS ENUM ('TRIGGER', 'CONDITION', 'ACTION');
CREATE TYPE "WorkflowTriggerType" AS ENUM ('LEAD_CREATED', 'MESSAGE_RECEIVED', 'FIT_CHANGED', 'TOUR_SCHEDULED', 'SCREENING_COMPLETED', 'APPLICATION_SENT', 'STALE_THRESHOLD_REACHED');
CREATE TYPE "WorkflowConditionType" AS ENUM ('PROPERTY', 'FIT', 'CHANNEL_AVAILABILITY', 'MISSING_FIELDS', 'INACTIVITY_WINDOW', 'STATUS');
CREATE TYPE "WorkflowActionType" AS ENUM ('SEND_TEMPLATE', 'DRAFT_AI_MESSAGE', 'CREATE_TASK', 'ASSIGN_LEAD', 'MOVE_STATUS', 'NOTIFY_OPERATOR', 'SCHEDULE_REMINDER', 'REQUEST_APPROVAL');
CREATE TYPE "WorkflowSharingVisibility" AS ENUM ('PRIVATE', 'WORKSPACE', 'ORG_LIBRARY');

CREATE TABLE "WorkflowDefinition" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "propertyId" TEXT,
  "baseWorkflowId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "scope" "WorkflowScope" NOT NULL DEFAULT 'WORKSPACE',
  "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
  "sharingVisibility" "WorkflowSharingVisibility" NOT NULL DEFAULT 'PRIVATE',
  "isStarterTemplate" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowVersion" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "WorkflowVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowNode" (
  "id" TEXT NOT NULL,
  "workflowVersionId" TEXT NOT NULL,
  "nodeType" "WorkflowNodeType" NOT NULL,
  "name" TEXT NOT NULL,
  "triggerType" "WorkflowTriggerType",
  "conditionType" "WorkflowConditionType",
  "actionType" "WorkflowActionType",
  "config" JSONB,
  "positionX" INTEGER NOT NULL DEFAULT 0,
  "positionY" INTEGER NOT NULL DEFAULT 0,
  "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowEdge" (
  "id" TEXT NOT NULL,
  "workflowVersionId" TEXT NOT NULL,
  "sourceNodeId" TEXT NOT NULL,
  "targetNodeId" TEXT NOT NULL,
  "label" TEXT,
  "branchKey" TEXT,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowEdge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowVersion_workflowId_versionNumber_key" ON "WorkflowVersion"("workflowId", "versionNumber");
CREATE INDEX "WorkflowDefinition_workspaceId_scope_status_idx" ON "WorkflowDefinition"("workspaceId", "scope", "status");
CREATE INDEX "WorkflowDefinition_propertyId_status_idx" ON "WorkflowDefinition"("propertyId", "status");
CREATE INDEX "WorkflowDefinition_baseWorkflowId_idx" ON "WorkflowDefinition"("baseWorkflowId");
CREATE INDEX "WorkflowVersion_workflowId_status_idx" ON "WorkflowVersion"("workflowId", "status");
CREATE INDEX "WorkflowNode_workflowVersionId_orderIndex_idx" ON "WorkflowNode"("workflowVersionId", "orderIndex");
CREATE INDEX "WorkflowEdge_workflowVersionId_orderIndex_idx" ON "WorkflowEdge"("workflowVersionId", "orderIndex");

ALTER TABLE "WorkflowDefinition"
ADD CONSTRAINT "WorkflowDefinition_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowDefinition"
ADD CONSTRAINT "WorkflowDefinition_propertyId_fkey"
FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkflowDefinition"
ADD CONSTRAINT "WorkflowDefinition_baseWorkflowId_fkey"
FOREIGN KEY ("baseWorkflowId") REFERENCES "WorkflowDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkflowVersion"
ADD CONSTRAINT "WorkflowVersion_workflowId_fkey"
FOREIGN KEY ("workflowId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowNode"
ADD CONSTRAINT "WorkflowNode_workflowVersionId_fkey"
FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowEdge"
ADD CONSTRAINT "WorkflowEdge_workflowVersionId_fkey"
FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;