import assert from "node:assert/strict";
import test from "node:test";
import { appendWorkflowErrorCodeToPath } from "./workflow-error-routing";

test("appendWorkflowErrorCodeToPath appends workflowError to a path without query params", () => {
  const redirectPath = appendWorkflowErrorCodeToPath(
    "/app/leads/lead_1",
    "LEAD_NOT_FOUND",
  );

  assert.equal(redirectPath, "/app/leads/lead_1?workflowError=LEAD_NOT_FOUND");
});

test("appendWorkflowErrorCodeToPath preserves existing query params", () => {
  const redirectPath = appendWorkflowErrorCodeToPath(
    "/app/inbox?page=2",
    "PROPERTY_NOT_FOUND",
  );

  assert.equal(
    redirectPath,
    "/app/inbox?page=2&workflowError=PROPERTY_NOT_FOUND",
  );
});

test("appendWorkflowErrorCodeToPath replaces an existing workflowError value", () => {
  const redirectPath = appendWorkflowErrorCodeToPath(
    "/app/inbox?workflowError=LEAD_NOT_FOUND",
    "INVALID_STATUS_TRANSITION",
  );

  assert.equal(
    redirectPath,
    "/app/inbox?workflowError=INVALID_STATUS_TRANSITION",
  );
});
