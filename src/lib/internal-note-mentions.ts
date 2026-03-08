type InternalNoteMentionMember = {
  userId: string;
  name: string;
  emailAddress: string;
  membershipRole: string;
};

type InternalNoteMentionDirectoryEntry = InternalNoteMentionMember & {
  canonicalHandle: string;
};

export type ResolvedInternalNoteMention = {
  userId: string;
  name: string;
  emailAddress: string;
  membershipRole: string;
  canonicalHandle: string;
  matchedHandle: string;
};

const internalNoteMentionPattern = /(^|[^\w@])@([a-zA-Z0-9._-]{2,})/g;

function normalizeMentionHandle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function addMentionLookupVariants(lookupValues: Set<string>, rawValue: string) {
  const normalizedValue = normalizeMentionHandle(rawValue);

  if (!normalizedValue) {
    return;
  }

  lookupValues.add(normalizedValue);
  lookupValues.add(normalizedValue.replace(/-/g, ""));
}

function getEmailLocalPart(emailAddress: string) {
  return emailAddress.split("@")[0] ?? "";
}

export function buildInternalNoteMentionDirectory(
  workspaceMembers: InternalNoteMentionMember[],
) {
  const sortedWorkspaceMembers = [...workspaceMembers].sort((left, right) => {
    const nameComparison = left.name.localeCompare(right.name);

    if (nameComparison !== 0) {
      return nameComparison;
    }

    return left.emailAddress.localeCompare(right.emailAddress);
  });
  const canonicalHandleCounts = new Map<string, number>();
  const mentionDirectory = sortedWorkspaceMembers.map((workspaceMember) => {
    const canonicalHandleBase =
      normalizeMentionHandle(workspaceMember.name) ||
      normalizeMentionHandle(getEmailLocalPart(workspaceMember.emailAddress)) ||
      "teammate";
    const canonicalHandleCount =
      (canonicalHandleCounts.get(canonicalHandleBase) ?? 0) + 1;

    canonicalHandleCounts.set(canonicalHandleBase, canonicalHandleCount);

    return {
      ...workspaceMember,
      canonicalHandle:
        canonicalHandleCount === 1
          ? canonicalHandleBase
          : `${canonicalHandleBase}-${canonicalHandleCount}`,
    } satisfies InternalNoteMentionDirectoryEntry;
  });
  const mentionDirectoryByUserId = new Map(
    mentionDirectory.map((mentionDirectoryEntry) => [
      mentionDirectoryEntry.userId,
      mentionDirectoryEntry,
    ]),
  );
  const mentionLookupIndex = new Map<string, Set<string>>();

  for (const mentionDirectoryEntry of mentionDirectory) {
    const lookupValues = new Set<string>();
    const emailLocalPart = getEmailLocalPart(mentionDirectoryEntry.emailAddress);
    const nameParts = mentionDirectoryEntry.name.split(/\s+/).filter(Boolean);

    addMentionLookupVariants(lookupValues, mentionDirectoryEntry.canonicalHandle);
    addMentionLookupVariants(lookupValues, mentionDirectoryEntry.name);
    addMentionLookupVariants(lookupValues, emailLocalPart);

    for (const namePart of nameParts) {
      addMentionLookupVariants(lookupValues, namePart);
    }

    for (const lookupValue of lookupValues) {
      const existingMatches = mentionLookupIndex.get(lookupValue) ?? new Set<string>();

      existingMatches.add(mentionDirectoryEntry.userId);
      mentionLookupIndex.set(lookupValue, existingMatches);
    }
  }

  return {
    mentionDirectory,
    mentionLookupIndex,
    mentionDirectoryByUserId,
  };
}

export function resolveInternalNoteMentions(params: {
  noteBody: string;
  workspaceMembers: InternalNoteMentionMember[];
}) {
  const { mentionDirectory, mentionLookupIndex, mentionDirectoryByUserId } =
    buildInternalNoteMentionDirectory(params.workspaceMembers);
  const resolvedMentionsByUserId = new Map<string, ResolvedInternalNoteMention>();
  const normalizedNoteBody = params.noteBody.replace(
    internalNoteMentionPattern,
    (fullMatch, prefix: string, rawHandle: string) => {
      const normalizedLookupValue = normalizeMentionHandle(rawHandle);
      const matchedUserIds = normalizedLookupValue
        ? mentionLookupIndex.get(normalizedLookupValue)
        : null;

      if (!matchedUserIds || matchedUserIds.size !== 1) {
        return fullMatch;
      }

      const [matchedUserId] = [...matchedUserIds];
      const mentionDirectoryEntry = mentionDirectoryByUserId.get(matchedUserId);

      if (!mentionDirectoryEntry) {
        return fullMatch;
      }

      resolvedMentionsByUserId.set(mentionDirectoryEntry.userId, {
        userId: mentionDirectoryEntry.userId,
        name: mentionDirectoryEntry.name,
        emailAddress: mentionDirectoryEntry.emailAddress,
        membershipRole: mentionDirectoryEntry.membershipRole,
        canonicalHandle: mentionDirectoryEntry.canonicalHandle,
        matchedHandle: rawHandle,
      });

      // Store a canonical handle so every internal note renders the same teammate tag.
      return `${prefix}@${mentionDirectoryEntry.canonicalHandle}`;
    },
  );

  return {
    normalizedNoteBody,
    mentions: [...resolvedMentionsByUserId.values()],
    availableMentions: mentionDirectory.map((mentionDirectoryEntry) => ({
      userId: mentionDirectoryEntry.userId,
      name: mentionDirectoryEntry.name,
      emailAddress: mentionDirectoryEntry.emailAddress,
      membershipRole: mentionDirectoryEntry.membershipRole,
      canonicalHandle: mentionDirectoryEntry.canonicalHandle,
    })),
  };
}