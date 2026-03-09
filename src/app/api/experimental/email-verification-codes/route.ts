import { NextResponse } from "next/server";
import {
  isExperimentalEmailVerificationCodeAccessEnabled,
  peekLatestEmailVerificationCode,
} from "@/lib/email-verification-codes";

type EmailVerificationCodeRequestBody = {
  callbackURL?: string;
  email?: string;
};

export type ExperimentalEmailVerificationCodesRouteDependencies = {
  fetch: typeof fetch;
  isEnabled: () => boolean;
  peekLatestCode: typeof peekLatestEmailVerificationCode;
};

const defaultExperimentalEmailVerificationCodesRouteDependencies: ExperimentalEmailVerificationCodesRouteDependencies = {
  fetch,
  isEnabled: isExperimentalEmailVerificationCodeAccessEnabled,
  peekLatestCode: peekLatestEmailVerificationCode,
};

function getNormalizedEmailAddress(searchParams: URLSearchParams, requestBody?: EmailVerificationCodeRequestBody | null) {
  return (requestBody?.email ?? searchParams.get("email") ?? "").trim().toLowerCase();
}

export async function handleExperimentalEmailVerificationCodesGet(
  request: Request,
  dependencies: ExperimentalEmailVerificationCodesRouteDependencies = defaultExperimentalEmailVerificationCodesRouteDependencies,
) {
  if (!dependencies.isEnabled()) {
    return NextResponse.json({ message: "Experimental verification codes are unavailable." }, { status: 403 });
  }

  const requestUrl = new URL(request.url);
  const emailAddress = getNormalizedEmailAddress(requestUrl.searchParams);

  if (!emailAddress) {
    return NextResponse.json({ message: "Email is required." }, { status: 400 });
  }

  const latestCode = await dependencies.peekLatestCode(emailAddress);

  if (!latestCode) {
    return NextResponse.json({ message: "No active verification code found for that email." }, { status: 404 });
  }

  return NextResponse.json({
    callbackPath: latestCode.callbackPath,
    code: latestCode.formattedCode,
    email: latestCode.emailAddress,
    expiresAt: latestCode.expiresAt.toISOString(),
  });
}

export async function handleExperimentalEmailVerificationCodesPost(
  request: Request,
  dependencies: ExperimentalEmailVerificationCodesRouteDependencies = defaultExperimentalEmailVerificationCodesRouteDependencies,
) {
  if (!dependencies.isEnabled()) {
    return NextResponse.json({ message: "Experimental verification codes are unavailable." }, { status: 403 });
  }

  const requestUrl = new URL(request.url);
  const requestBody = (await request.json().catch(() => null)) as EmailVerificationCodeRequestBody | null;
  const emailAddress = getNormalizedEmailAddress(requestUrl.searchParams, requestBody);

  if (!emailAddress) {
    return NextResponse.json({ message: "Email is required." }, { status: 400 });
  }

  const sendVerificationEmailResponse = await dependencies.fetch(
    new URL("/api/auth/send-verification-email", requestUrl.origin),
    {
      body: JSON.stringify({
        callbackURL: requestBody?.callbackURL,
        email: emailAddress,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    },
  );

  if (!sendVerificationEmailResponse.ok) {
    const errorPayload = (await sendVerificationEmailResponse.json().catch(() => null)) as {
      message?: string;
    } | null;

    return NextResponse.json(
      {
        message: errorPayload?.message ?? "Unable to generate a verification code right now.",
      },
      { status: sendVerificationEmailResponse.status || 500 },
    );
  }

  const latestCode = await dependencies.peekLatestCode(emailAddress);

  if (!latestCode) {
    return NextResponse.json({ message: "Verification email sent, but no code was captured." }, { status: 502 });
  }

  return NextResponse.json({
    callbackPath: latestCode.callbackPath,
    code: latestCode.formattedCode,
    email: latestCode.emailAddress,
    expiresAt: latestCode.expiresAt.toISOString(),
    status: true,
  });
}

export async function GET(request: Request) {
  return handleExperimentalEmailVerificationCodesGet(request);
}

export async function POST(request: Request) {
  return handleExperimentalEmailVerificationCodesPost(request);
}