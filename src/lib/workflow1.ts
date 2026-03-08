export type Workflow1Plan = "personal" | "org";

export type Workflow1Intent = {
  inviteToken: string | null;
  plan: Workflow1Plan | null;
  source: string | null;
  utmCampaign: string | null;
};

export type Workflow1SignupFields = {
  confirmPassword: string;
  email: string;
  name: string;
  password: string;
};

export type Workflow1SignupFieldErrors = Partial<Record<keyof Workflow1SignupFields, string>>;

export type Workflow1PasswordState = {
  categoryCount: number;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  hasUppercase: boolean;
  isValid: boolean;
  meetsLength: boolean;
  strengthLabel: "Almost there" | "Needs work" | "Strong";
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const workflow1BaseUrl = "http://127.0.0.1:3001";

function normalizeWorkflow1Text(value?: string | null, maxLength = 80) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue.slice(0, maxLength);
}

export function normalizeWorkflow1Plan(value?: string | null): Workflow1Plan | null {
  const normalizedValue = value?.trim().toLowerCase();

  if (normalizedValue === "personal" || normalizedValue === "org") {
    return normalizedValue;
  }

  return null;
}

export function getWorkflow1Intent(params: {
  inviteToken?: string | null;
  plan?: string | null;
  source?: string | null;
  utmCampaign?: string | null;
}): Workflow1Intent {
  return {
    inviteToken: normalizeWorkflow1Text(params.inviteToken, 120),
    plan: normalizeWorkflow1Plan(params.plan),
    source: normalizeWorkflow1Text(params.source),
    utmCampaign: normalizeWorkflow1Text(params.utmCampaign),
  };
}

export function applyWorkflow1IntentSearchParams(
  searchParams: URLSearchParams,
  intent?: {
    inviteToken?: string | null;
    plan?: string | null;
    source?: string | null;
    utmCampaign?: string | null;
  } | null,
) {
  const normalizedIntent = getWorkflow1Intent({
    inviteToken: intent?.inviteToken,
    plan: intent?.plan,
    source: intent?.source,
    utmCampaign: intent?.utmCampaign,
  });

  if (normalizedIntent.plan) {
    searchParams.set("plan", normalizedIntent.plan);
  }

  if (normalizedIntent.inviteToken) {
    searchParams.set("invite", normalizedIntent.inviteToken);
  }

  if (normalizedIntent.source) {
    searchParams.set("source", normalizedIntent.source);
  }

  if (normalizedIntent.utmCampaign) {
    searchParams.set("utm_campaign", normalizedIntent.utmCampaign);
  }
}

export function buildWorkflow1Path(
  candidatePath: string | null | undefined,
  intent?: {
    inviteToken?: string | null;
    plan?: string | null;
    source?: string | null;
    utmCampaign?: string | null;
  } | null,
) {
  const candidateUrl = new URL(candidatePath || "/", workflow1BaseUrl);

  applyWorkflow1IntentSearchParams(candidateUrl.searchParams, intent);

  return `${candidateUrl.pathname}${candidateUrl.search}${candidateUrl.hash}`;
}

function getWorkflow1InviteTokenFromPathname(pathname: string) {
  const invitePrefix = "/invite/";

  if (!pathname.startsWith(invitePrefix)) {
    return null;
  }

  const encodedInviteToken = pathname.slice(invitePrefix.length).trim();

  if (!encodedInviteToken) {
    return null;
  }

  try {
    return decodeURIComponent(encodedInviteToken);
  } catch {
    return encodedInviteToken;
  }
}

function getWorkflow1IntentFromSearchParams(
  searchParams: URLSearchParams,
  pathname: string,
): Workflow1Intent {
  return getWorkflow1Intent({
    inviteToken: searchParams.get("invite") ?? getWorkflow1InviteTokenFromPathname(pathname),
    plan: searchParams.get("plan"),
    source: searchParams.get("source"),
    utmCampaign: searchParams.get("utm_campaign"),
  });
}

export function getWorkflow1IntentFromPath(candidatePath?: string | null) {
  const candidateUrl = new URL(candidatePath || "/", workflow1BaseUrl);
  const nestedCallbackPath = candidateUrl.searchParams.get("callbackURL");
  const directIntent = getWorkflow1IntentFromSearchParams(
    candidateUrl.searchParams,
    candidateUrl.pathname,
  );

  if (!nestedCallbackPath) {
    return directIntent;
  }

  const nestedCallbackUrl = new URL(nestedCallbackPath, workflow1BaseUrl);
  const nestedIntent = getWorkflow1IntentFromSearchParams(
    nestedCallbackUrl.searchParams,
    nestedCallbackUrl.pathname,
  );

  return {
    inviteToken: directIntent.inviteToken ?? nestedIntent.inviteToken,
    plan: directIntent.plan ?? nestedIntent.plan,
    source: directIntent.source ?? nestedIntent.source,
    utmCampaign: directIntent.utmCampaign ?? nestedIntent.utmCampaign,
  };
}

export function getWorkflow1WorkspaceBootstrapDecision(candidatePath?: string | null) {
  const workflow1Intent = getWorkflow1IntentFromPath(candidatePath);

  return {
    plan: workflow1Intent.plan ?? "personal",
    shouldSkipWorkspaceCreation: Boolean(workflow1Intent.inviteToken),
    workflow1Intent,
  };
}

export function getWorkflow1IntentChips(intent: Workflow1Intent) {
  const chips = ["Under a minute", "Secure auth", "Workspace ready"];

  if (intent.plan === "org") {
    chips.unshift("Org workspace");
  }

  if (intent.plan === "personal") {
    chips.unshift("Personal workspace");
  }

  if (intent.inviteToken) {
    chips.unshift("Workspace invite");
  }

  if (intent.source) {
    chips.push(`Source: ${intent.source}`);
  }

  if (intent.utmCampaign) {
    chips.push(`Campaign: ${intent.utmCampaign}`);
  }

  return chips;
}

export function buildWorkflow1InvitePath(inviteToken: string) {
  return `/invite/${encodeURIComponent(inviteToken)}`;
}

export function getWorkflow1PasswordState(password: string): Workflow1PasswordState {
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const categoryCount = [hasUppercase, hasLowercase, hasNumber, hasSymbol].filter(Boolean).length;
  const meetsLength = password.length >= 10;
  const isValid = meetsLength && categoryCount >= 2;

  let strengthLabel: Workflow1PasswordState["strengthLabel"] = "Needs work";

  if (isValid && categoryCount >= 3) {
    strengthLabel = "Strong";
  } else if (password.length > 0) {
    strengthLabel = "Almost there";
  }

  return {
    categoryCount,
    hasLowercase,
    hasNumber,
    hasSymbol,
    hasUppercase,
    isValid,
    meetsLength,
    strengthLabel,
  };
}

export function validateWorkflow1SignupFields(
  fields: Workflow1SignupFields,
): Workflow1SignupFieldErrors {
  const errors: Workflow1SignupFieldErrors = {};
  const normalizedName = fields.name.trim();
  const normalizedEmail = fields.email.trim();
  const passwordState = getWorkflow1PasswordState(fields.password);

  if (normalizedName.length < 2) {
    errors.name = "Enter the operator name for this workspace.";
  }

  if (!emailPattern.test(normalizedEmail)) {
    errors.email = "Enter a valid email address.";
  }

  if (!passwordState.isValid) {
    errors.password = "Use at least 10 characters and any 2 of uppercase, lowercase, number, or symbol.";
  }

  if (fields.confirmPassword !== fields.password) {
    errors.confirmPassword = "Passwords do not match yet.";
  }

  return errors;
}