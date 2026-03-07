import type { LeadWorkflowErrorCode } from "@/lib/lead-workflow-errors";

export function appendWorkflowErrorCodeToPath(
  redirectPath: string,
  workflowErrorCode: LeadWorkflowErrorCode,
) {
  const [basePath, existingQueryString] = redirectPath.split("?");
  const queryParameters = new URLSearchParams(existingQueryString ?? "");

  queryParameters.set("workflowError", workflowErrorCode);

  const encodedQueryString = queryParameters.toString();

  if (!encodedQueryString) {
    return basePath;
  }

  return `${basePath}?${encodedQueryString}`;
}
