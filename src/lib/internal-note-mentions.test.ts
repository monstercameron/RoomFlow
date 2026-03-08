import assert from "node:assert";
import { describe, it } from "node:test";
import { resolveInternalNoteMentions } from "./internal-note-mentions";

describe("internal note mentions", () => {
  const workspaceMembers = [
    {
      userId: "user-alex-1",
      name: "Alex Rivera",
      emailAddress: "alex@example.com",
      membershipRole: "ADMIN",
    },
    {
      userId: "user-jordan",
      name: "Jordan Lee",
      emailAddress: "jordan.lee@example.com",
      membershipRole: "MANAGER",
    },
    {
      userId: "user-alex-2",
      name: "Alex Kim",
      emailAddress: "alex.kim@example.com",
      membershipRole: "VIEWER",
    },
  ];

  it("canonicalizes uniquely matched teammate mentions", () => {
    const resolution = resolveInternalNoteMentions({
      noteBody: "Please have @Jordan review the latest reply.",
      workspaceMembers,
    });

    assert.equal(
      resolution.normalizedNoteBody,
      "Please have @jordan-lee review the latest reply.",
    );
    assert.deepEqual(resolution.mentions.map((mention) => mention.name), [
      "Jordan Lee",
    ]);
  });

  it("leaves ambiguous shorthand mentions untouched", () => {
    const resolution = resolveInternalNoteMentions({
      noteBody: "Escalate this to @Alex before the evening handoff.",
      workspaceMembers,
    });

    assert.equal(
      resolution.normalizedNoteBody,
      "Escalate this to @Alex before the evening handoff.",
    );
    assert.equal(resolution.mentions.length, 0);
  });

  it("does not treat email addresses as teammate mentions", () => {
    const resolution = resolveInternalNoteMentions({
      noteBody: "Lead replied from jordan.lee@example.com after the tour notice.",
      workspaceMembers,
    });

    assert.equal(
      resolution.normalizedNoteBody,
      "Lead replied from jordan.lee@example.com after the tour notice.",
    );
    assert.equal(resolution.mentions.length, 0);
  });
});