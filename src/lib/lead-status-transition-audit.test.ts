import assert from "node:assert/strict";
import test from "node:test";
import { LeadStatus } from "@/generated/prisma/client";
import { buildLeadStatusTransitionAuditPayload } from "./lead-status-transition-audit";

test("buildLeadStatusTransitionAuditPayload includes actor and transition fields", () => {
  const auditPayload = buildLeadStatusTransitionAuditPayload({
    actorUserId: "user_123",
    fromStatus: LeadStatus.NEW,
    toStatus: LeadStatus.AWAITING_RESPONSE,
    transitionReason: "Requested missing move-in date and budget.",
  });

  assert.deepEqual(auditPayload, {
    actorUserId: "user_123",
    fromStatus: LeadStatus.NEW,
    toStatus: LeadStatus.AWAITING_RESPONSE,
    reason: "Requested missing move-in date and budget.",
  });
});
